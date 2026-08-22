'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const auth = require('./auth');
const signup = require('../api/auth/signup');
const login = require('../api/auth/login');
const logout = require('../api/auth/logout');
const me = require('../api/me');
const catalog = require('../api/me/catalog');
const bootstrap = require('../api/auth');

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
  return JSON.parse(res.body || '{}');
}

function cookieFrom(res) {
  return String(res.headers['Set-Cookie'] || '');
}

async function withEnv(env, fn) {
  const prev = {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };
  if (env.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = env.DATABASE_URL;
  if (env.SESSION_SECRET === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = env.SESSION_SECRET;
  accounts.resetStore();
  if (env.memory) accounts.useMemoryStore();
  try {
    await fn();
  } finally {
    accounts.resetStore();
    Object.keys(prev).forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  }
}

async function run() {
  await withEnv({ DATABASE_URL: undefined, SESSION_SECRET: undefined }, async () => {
    const res = mockRes();
    await signup({ method: 'POST', headers: {}, body: { email: 'a@b.com', password: 'password1', artist: 'Ada' } }, res);
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(json(res).error, 'Accounts are not configured.');
    assert.ok(!res.body.includes('ok'));
  });

  await withEnv({ DATABASE_URL: undefined, SESSION_SECRET: 'secret' }, async () => {
    const res = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'a@b.com', password: 'password1' } }, res);
    assert.strictEqual(res.statusCode, 503);
  });

  await withEnv({ DATABASE_URL: 'postgres://memory', SESSION_SECRET: undefined }, async () => {
    const res = mockRes();
    await me({ method: 'GET', headers: {} }, res);
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(json(res).error, 'Accounts are not configured.');
  });

  await withEnv({ DATABASE_URL: 'postgres://memory', SESSION_SECRET: 'unit-test-session-secret', memory: true }, async () => {
    const rejected = mockRes();
    await signup({ method: 'POST', url: '/api/auth/signup?password=password1', query: { password: 'password1' }, headers: {}, body: { email: 'ada@example.com', password: 'password1', artist: 'Ada Night' } }, rejected);
    assert.strictEqual(rejected.statusCode, 400);
    assert.ok(json(rejected).error.indexOf('query') !== -1);

    const created = mockRes();
    await signup({ method: 'POST', headers: {}, body: { email: 'Ada@Example.com', password: 'password1', artist: 'Ada Night', plan: 'basic' } }, created);
    assert.strictEqual(created.statusCode, 200);
    const createdBody = json(created);
    assert.strictEqual(createdBody.ok, true);
    assert.strictEqual(createdBody.email, 'ada@example.com');
    assert.strictEqual(createdBody.artist, 'Ada Night');
    assert.strictEqual(createdBody.plan, 'basic');
    assert.ok(!JSON.stringify(createdBody).includes('password'));
    assert.ok(cookieFrom(created).indexOf('plaiground_session=') !== -1);
    assert.ok(cookieFrom(created).indexOf('HttpOnly') !== -1);
    assert.ok(cookieFrom(created).indexOf('SameSite=Lax') !== -1);
    assert.ok(cookieFrom(created).indexOf('password') === -1);

    const dup = mockRes();
    await signup({ method: 'POST', headers: {}, body: { email: 'ada@example.com', password: 'password1', artist: 'Ada Night' } }, dup);
    assert.strictEqual(dup.statusCode, 409);

    const badLogin = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'ada@example.com', password: 'wrong-pass' } }, badLogin);
    assert.strictEqual(badLogin.statusCode, 401);

    const goodLogin = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'ada@example.com', password: 'password1' } }, goodLogin);
    assert.strictEqual(goodLogin.statusCode, 200);
    assert.strictEqual(json(goodLogin).email, 'ada@example.com');
    const sessionCookie = cookieFrom(goodLogin).split(';')[0];

    const meRes = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, meRes);
    assert.strictEqual(meRes.statusCode, 200);
    const meBody = json(meRes);
    assert.strictEqual(meBody.email, 'ada@example.com');
    assert.strictEqual(meBody.artist, 'Ada Night');
    assert.strictEqual(meBody.plan, 'basic');
    assert.deepStrictEqual(meBody.tonegrid_release_ids, []);
    assert.deepStrictEqual(meBody.tonegrid_track_ids, []);
    assert.ok(!JSON.stringify(meBody).includes('password'));

    const signed = mockRes();
    await catalog({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
    }, signed);
    assert.strictEqual(signed.statusCode, 200);
    assert.strictEqual(json(signed).tonegrid_artist_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.deepStrictEqual(json(signed).tonegrid_release_ids, ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);

    const again = mockRes();
    await catalog({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        artist_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
    }, again);
    assert.strictEqual(json(again).tonegrid_artist_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.deepStrictEqual(json(again).tonegrid_release_ids, ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);

    const extra = mockRes();
    await catalog({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { release_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
    }, extra);
    assert.deepStrictEqual(json(extra).tonegrid_release_ids, [
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    ]);

    const tracked = mockRes();
    await catalog({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { track_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
    }, tracked);
    assert.deepStrictEqual(json(tracked).tonegrid_track_ids, ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']);
    const trackedAgain = mockRes();
    await catalog({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { track_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
    }, trackedAgain);
    assert.deepStrictEqual(json(trackedAgain).tonegrid_track_ids, ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']);

    const pwCatalog = mockRes();
    await catalog({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', password: 'password1' },
    }, pwCatalog);
    assert.strictEqual(pwCatalog.statusCode, 400);

    const stripe = mockRes();
    await me({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { stripe_session_id: 'cs_test_123', plan: 'pro' },
    }, stripe);
    assert.strictEqual(stripe.statusCode, 200);
    assert.strictEqual(json(stripe).plan, 'pro');
    assert.strictEqual(json(stripe).stripe_session_id, 'cs_test_123');

    const other = mockRes();
    await signup({ method: 'POST', headers: {}, body: { email: 'other@example.com', password: 'password1', artist: 'Other Artist' } }, other);
    const otherCookie = cookieFrom(other).split(';')[0];
    const otherMe = mockRes();
    await me({ method: 'GET', headers: { cookie: otherCookie } }, otherMe);
    assert.strictEqual(json(otherMe).email, 'other@example.com');
    assert.strictEqual(json(otherMe).tonegrid_artist_id, null);
    assert.deepStrictEqual(json(otherMe).tonegrid_release_ids, []);
    assert.deepStrictEqual(json(otherMe).tonegrid_track_ids, []);

    const hashed = await accounts.findByEmail('ada@example.com');
    assert.ok(hashed.password_hash);
    assert.ok(!hashed.password_hash.includes('password1'));

    const loggedOut = mockRes();
    await logout({ method: 'POST', headers: { cookie: sessionCookie } }, loggedOut);
    assert.strictEqual(loggedOut.statusCode, 200);
    assert.ok(cookieFrom(loggedOut).indexOf('Max-Age=0') !== -1);

    const boot = mockRes();
    await bootstrap({ method: 'GET', headers: {} }, boot);
    assert.strictEqual(boot.statusCode, 200);
    assert.strictEqual(json(boot).configured, true);
  });

  const hash = auth.hashPassword('password1');
  assert.ok(auth.verifyPassword('password1', hash));
  assert.ok(!auth.verifyPassword('password2', hash));
  const token = (() => {
    process.env.SESSION_SECRET = 'unit-test-session-secret';
    return auth.signSession('user-1');
  })();
  assert.strictEqual(auth.verifySession(token).userId, 'user-1');
  assert.ok(!token.includes('password'));

  const sourceFiles = [
    'api/auth/signup.js',
    'api/auth/login.js',
    'api/me.js',
    'api/me/catalog.js',
    'signup.html',
    'login.html',
    'account.js',
    'membership.js',
  ];
  sourceFiles.forEach((rel) => {
    const text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.ok(!text.includes(['t', 'g', 'k', '_'].join('')), rel + ' has a key prefix');
    assert.ok(!/sk_live_|sk_test_/.test(text), rel + ' has a Stripe secret');
  });

  const signupHtml = fs.readFileSync(path.join(__dirname, '..', 'signup.html'), 'utf8');
  assert.ok(signupHtml.includes('FIRST NAME LAST NAME'));
  assert.ok(signupHtml.includes('/api/auth/signup'));
  assert.ok(signupHtml.includes('Accounts are not configured.'));
  assert.ok(!/action="[^"]*\?/.test(signupHtml) || signupHtml.includes('id="signup-form"'));

  const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'login.html'), 'utf8');
  assert.ok(loginHtml.includes('/api/auth/login'));
  assert.ok(!loginHtml.includes('value="••••••••"'));
  assert.ok(!loginHtml.includes('method="get"'));

  console.log('accounts.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
