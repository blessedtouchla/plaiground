'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const marketing = require('./marketing');
const productEvents = require('./product-events');
const mailFailures = require('./mail-failures');
const readonly = require('./admin-readonly');
const meApi = require('../api/me');

// Fake values for this test only. Never a real token.
const TOKEN = 'unit-test-readonly-token-0123456789abcdef';
const KEYS = ['DATABASE_URL', 'SESSION_SECRET', 'ADMIN_READONLY_TOKEN', 'STRIPE_SECRET_KEY'];

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(chunk) {
      this.body = chunk == null ? '' : String(chunk);
    },
  };
}

function json(res) {
  try {
    return JSON.parse(res.body || '{}');
  } catch {
    return {};
  }
}

async function call(method, url, headers) {
  const res = mockRes();
  await meApi({ method: method, url: url, headers: Object.assign({ 'x-real-ip': '198.51.100.20' }, headers || {}), body: {} }, res);
  return res;
}

async function withEnv(env, fn) {
  const prev = {};
  KEYS.forEach((key) => {
    prev[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  });
  const logs = [];
  const realLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
  };
  accounts.resetStore();
  accounts.useMemoryStore();
  marketing.resetStore();
  marketing.useMemoryStore();
  productEvents.resetStore();
  mailFailures.resetStore();
  mailFailures.useMemoryStore();
  readonly.resetForTests();
  try {
    await fn(logs);
  } finally {
    console.log = realLog;
    accounts.resetStore();
    marketing.resetStore();
    productEvents.resetStore();
    mailFailures.resetStore();
    readonly.resetForTests();
    KEYS.forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  }
}

const ENV = { DATABASE_URL: 'postgres://memory', SESSION_SECRET: 'unit-session-secret', ADMIN_READONLY_TOKEN: TOKEN };

// Every GET admin URL the token unlocks, as the browser sends it after vercel.json rewrites.
const GET_ENDPOINTS = [
  ['/api/admin/signups', '/api/me?action=admin-signups'],
  ['/api/admin/signups?part=signups', '/api/me?action=admin-signups&part=signups'],
  ['/api/admin/signups.csv', '/api/me?action=admin-signups&format=csv'],
  ['/api/admin/events', '/api/me?action=admin-events'],
  ['/api/admin/events.csv', '/api/me?action=admin-events&format=csv'],
  ['/api/admin/marketing', '/api/me?action=admin-marketing'],
  ['/api/admin/marketing.csv', '/api/me?action=admin-marketing&format=csv'],
  ['/api/admin/traffic', '/api/me?action=admin-traffic'],
  ['/api/admin/roadmaps', '/api/me?action=admin-roadmaps'],
  ['/api/admin/applications', '/api/me?action=admin-applications'],
  ['/api/admin/mail-failures', '/api/me?action=admin-mail-failures'],
];

async function run() {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const rewrites = vercel.rewrites || [];
  GET_ENDPOINTS.forEach(([publicUrl]) => {
    const bare = publicUrl.split('?')[0];
    assert.ok(rewrites.some((r) => r.source === bare), 'rewrite exists for ' + bare);
  });

  // Pure helpers.
  assert.strictEqual(readonly.presentedToken({ headers: { 'x-plai-admin-token': ' abc ' } }), 'abc');
  assert.strictEqual(readonly.presentedToken({ headers: { authorization: 'Bearer xyz' } }), 'xyz');
  assert.strictEqual(readonly.presentedToken({ headers: { Authorization: 'Basic xyz' } }), '');
  assert.strictEqual(readonly.presentedToken({ url: '/api/admin/signups?token=abc', headers: {} }), '');

  await withEnv(ENV, async (logs) => {
    assert.strictEqual(readonly.isEnabled(), true);

    // Real-looking data so we can see the token reads it.
    await accounts.createUser({ email: 'reader.check@example.com', password: 'password1', artist: 'Reader Check' });

    for (const [publicUrl, url] of GET_ENDPOINTS) {
      for (const headers of [{ 'x-plai-admin-token': TOKEN }, { authorization: 'Bearer ' + TOKEN }]) {
        const res = await call('GET', url, headers);
        assert.strictEqual(res.statusCode, 200, publicUrl + ' -> ' + res.statusCode + ' ' + res.body);
        assert.ok(!res.headers['Set-Cookie'], 'token never sets a session cookie: ' + publicUrl);
      }
    }
    const overview = json(await call('GET', '/api/me?action=admin-signups', { 'x-plai-admin-token': TOKEN }));
    assert.ok(JSON.stringify(overview).includes('reader.check@example.com'));
    const csv = await call('GET', '/api/me?action=admin-signups&format=csv', { 'x-plai-admin-token': TOKEN });
    assert.strictEqual(csv.headers['Content-Type'], 'text/csv; charset=utf-8');
    assert.ok(csv.body.includes('reader.check@example.com'));

    // Audit log: one line per use, with path and IP, never the token.
    const reads = logs.filter((line) => line.indexOf('[admin-readonly]') === 0 && line.includes('"outcome":"read"'));
    assert.ok(reads.length >= GET_ENDPOINTS.length * 2);
    assert.ok(reads[0].includes('198.51.100.20'));
    assert.ok(reads[0].includes('admin-signups'));
    assert.ok(!logs.some((line) => line.includes(TOKEN)), 'token never logged');

    // Wrong token: 401, logged, no data.
    const bad = await call('GET', '/api/me?action=admin-signups', { 'x-plai-admin-token': TOKEN + 'x' });
    assert.strictEqual(bad.statusCode, 401);
    assert.ok(!bad.body.includes('reader.check@example.com'));
    assert.ok(logs.some((line) => line.includes('"outcome":"bad_token"')));

    // Query string is ignored: falls back to session and gets 401.
    const viaQuery = await call('GET', '/api/me?action=admin-signups&token=' + TOKEN, {});
    assert.strictEqual(viaQuery.statusCode, 401);
    assert.strictEqual(json(viaQuery).error, 'Sign in required.');

    // Writes are refused even with a valid token.
    const testMail = await call('POST', '/api/me?action=admin-test-emails', { 'x-plai-admin-token': TOKEN });
    assert.strictEqual(testMail.statusCode, 403);
    assert.ok(logs.some((line) => line.includes('"outcome":"refused_write"')));
    const postSignups = await call('POST', '/api/me?action=admin-signups', { 'x-plai-admin-token': TOKEN });
    assert.strictEqual(postSignups.statusCode, 405);

    // Token does not open non-admin routes: /api/me still needs a session.
    const me = await call('GET', '/api/me', { 'x-plai-admin-token': TOKEN });
    assert.strictEqual(me.statusCode, 401);
    const profile = await call('POST', '/api/me/profile', { 'x-plai-admin-token': TOKEN });
    assert.strictEqual(profile.statusCode, 401);

    // Brute force: many bad tries from one IP get 429, even with the right token after.
    readonly.resetForTests();
    for (let i = 0; i < 20; i += 1) {
      await call('GET', '/api/me?action=admin-signups', { 'x-plai-admin-token': 'wrong-' + i, 'x-real-ip': '198.51.100.99' });
    }
    const limited = await call('GET', '/api/me?action=admin-signups', { 'x-plai-admin-token': TOKEN, 'x-real-ip': '198.51.100.99' });
    assert.strictEqual(limited.statusCode, 429);
  });

  // Revoked: env var deleted means the token stops working.
  await withEnv(Object.assign({}, ENV, { ADMIN_READONLY_TOKEN: undefined }), async (logs) => {
    assert.strictEqual(readonly.isEnabled(), false);
    const res = await call('GET', '/api/me?action=admin-signups', { 'x-plai-admin-token': TOKEN });
    assert.strictEqual(res.statusCode, 401);
    assert.ok(logs.some((line) => line.includes('"outcome":"disabled"')));
  });

  // Too short to be safe: treated as off.
  await withEnv(Object.assign({}, ENV, { ADMIN_READONLY_TOKEN: 'short' }), async () => {
    assert.strictEqual(readonly.isEnabled(), false);
    const res = await call('GET', '/api/me?action=admin-signups', { 'x-plai-admin-token': 'short' });
    assert.strictEqual(res.statusCode, 401);
  });

  // No token sent: the owner-session path is unchanged (anon gets 401).
  await withEnv(ENV, async () => {
    const res = await call('GET', '/api/me?action=admin-events', {});
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(json(res).error, 'Sign in required.');
  });

  console.log('admin-readonly tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
