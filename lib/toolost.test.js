'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const authApi = require('../api/auth');
const meApi = require('../api/me');
const toolost = require('./toolost');

const ACCESS = 'access-token-VALUE-test';
const REFRESH = 'refresh-token-VALUE-test';
const SECRET = 'toolost-test-client-secret';
const CLIENT = 'toolost-test-client-id';

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

function cookiePairs(header) {
  const list = Array.isArray(header) ? header : (header ? [String(header)] : []);
  return list.map((row) => String(row).split(';')[0]);
}

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

async function withEnv(env, fn) {
  const keys = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'TOOLOST_CLIENT_ID',
    'TOOLOST_CLIENT_SECRET',
    'TOOLOST_REDIRECT_URI',
  ];
  const prev = {};
  keys.forEach((key) => {
    prev[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  });
  accounts.resetStore();
  toolost.resetForTests();
  if (env.memory) accounts.useMemoryStore();
  if (env.tokenStore) toolost.useMemoryStoreForTests();
  try {
    await fn();
  } finally {
    accounts.resetStore();
    toolost.resetForTests();
    keys.forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  }
}

async function signupUser(email) {
  const res = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/signup',
    headers: {},
    body: { email, password: 'password1', artist: 'Ada Night', plan: 'basic' },
  }, res);
  assert.strictEqual(res.statusCode, 200, res.body);
  await accounts.confirmEmail(email);
  const loginRes = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/login',
    headers: {},
    body: { email, password: 'password1' },
  }, loginRes);
  assert.strictEqual(loginRes.statusCode, 200, loginRes.body);
  return String(loginRes.headers['Set-Cookie'] || '').split(';')[0];
}

function sandboxEnv(extra) {
  return Object.assign({
    memory: true,
    tokenStore: true,
    DATABASE_URL: 'postgres://toolost-test',
    SESSION_SECRET: 'toolost-test-session-secret',
    TOOLOST_CLIENT_ID: CLIENT,
    TOOLOST_CLIENT_SECRET: SECRET,
  }, extra || {});
}

function installFetch(status, body) {
  const calls = [];
  toolost.setFetchForTests(async (url, options) => {
    calls.push({ url: String(url), options });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    };
  });
  return calls;
}

function decodeState(setCookie) {
  const pair = cookiePairs(setCookie).find((row) => row.indexOf(toolost.STATE_COOKIE + '=') === 0);
  assert.ok(pair, 'state cookie set');
  const raw = decodeURIComponent(pair.slice(pair.indexOf('=') + 1));
  const payload = raw.slice(0, raw.lastIndexOf('.'));
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

async function run() {
  await withEnv({ memory: true }, async () => {
    const res = mockRes();
    await meApi({ method: 'GET', url: '/api/toolost/callback', headers: {} }, res);
    assert.strictEqual(res.statusCode, 503);
    assert.ok(res.body.includes(toolost.CREDENTIALS_COPY));
    assert.ok(res.body.indexOf(ACCESS) === -1);
    const rewritten = mockRes();
    await meApi({ method: 'GET', url: '/api/me?action=toolost-callback', headers: {} }, rewritten);
    assert.strictEqual(rewritten.statusCode, 503);
    const start = mockRes();
    await meApi({ method: 'GET', url: '/api/toolost/start', headers: {} }, start);
    assert.strictEqual(start.statusCode, 503);
    assert.ok(!start.headers.Location);
  });

  await withEnv(sandboxEnv(), async () => {
    const artist = await signupUser('artist@example.com');
    const blocked = mockRes();
    await meApi({ method: 'GET', url: '/api/toolost/start', headers: { cookie: artist } }, blocked);
    assert.strictEqual(blocked.statusCode, 403);
    assert.ok(!blocked.headers.Location);

    const owner = await signupUser('emailplaiground@gmail.com');
    const start = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/me?action=toolost-start',
      headers: { cookie: owner },
    }, start);
    assert.strictEqual(start.statusCode, 302);
    const location = new URL(String(start.headers.Location));
    assert.strictEqual(location.origin + location.pathname, toolost.AUTHORIZE_URL);
    assert.strictEqual(location.searchParams.get('response_type'), 'code');
    assert.strictEqual(location.searchParams.get('client_id'), CLIENT);
    assert.strictEqual(location.searchParams.get('redirect_uri'), toolost.REDIRECT_DEFAULT);
    assert.strictEqual(location.searchParams.get('scope'), toolost.SCOPES);
    assert.strictEqual(location.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(!location.searchParams.get('code_verifier'));
    assert.ok(String(start.headers.Location).indexOf(SECRET) === -1);
    const pending = decodeState(start.headers['Set-Cookie']);
    const challenge = crypto.createHash('sha256').update(pending.v).digest('base64url');
    assert.strictEqual(location.searchParams.get('code_challenge'), challenge);
    assert.strictEqual(location.searchParams.get('state'), pending.s);
    assert.ok(String(start.headers['Set-Cookie']).indexOf(pending.v) === -1);

    const calls = installFetch(200, {
      access_token: ACCESS,
      refresh_token: REFRESH,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: toolost.SCOPES,
    });
    const statePair = cookiePairs(start.headers['Set-Cookie'])[0];
    const callback = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/callback?code=auth-code-1&state=' + encodeURIComponent(pending.s),
      headers: { cookie: owner + '; ' + statePair },
    }, callback);
    assert.strictEqual(callback.statusCode, 302);
    assert.strictEqual(callback.headers.Location, '/api/toolost/connected');
    assert.ok(String(callback.headers.Location).indexOf(ACCESS) === -1);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, toolost.TOKEN_URL);
    assert.strictEqual(calls[0].options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const form = new URLSearchParams(calls[0].options.body);
    assert.strictEqual(form.get('grant_type'), 'authorization_code');
    assert.strictEqual(form.get('code'), 'auth-code-1');
    assert.strictEqual(form.get('redirect_uri'), toolost.REDIRECT_DEFAULT);
    assert.strictEqual(form.get('client_id'), CLIENT);
    assert.strictEqual(form.get('client_secret'), SECRET);
    assert.strictEqual(form.get('code_verifier'), pending.v);
    const stored = await toolost.labelTokenForTests();
    assert.strictEqual(stored.access_token, ACCESS);
    assert.ok(cookiePairs(callback.headers['Set-Cookie']).join(';').indexOf(ACCESS) === -1);

    const memory = toolost.useMemoryStoreForTests();
    await memory.save(stored);
    const sealed = memory.exportState();
    assert.ok(sealed.indexOf(ACCESS) === -1);
    memory.importState('');
    assert.strictEqual(await toolost.labelTokenForTests(), null);
    memory.importState(sealed);
    assert.strictEqual((await toolost.labelTokenForTests()).refresh_token, REFRESH);

    const connected = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/connected',
      headers: { cookie: owner },
    }, connected);
    assert.strictEqual(connected.statusCode, 200);
    assert.ok(connected.body.includes('TooLost sandbox is connected for the PLAIGROUND label account.'));
    assert.ok(connected.body.indexOf(ACCESS) === -1);
    assert.ok(connected.body.indexOf(SECRET) === -1);

    let fetched = false;
    toolost.setFetchForTests(async () => {
      fetched = true;
      return { ok: false, status: 400, text: async () => '{"access_token":"should-not-leak"}' };
    });
    const mismatch = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/callback?code=auth-code-1&state=not-the-state',
      headers: { cookie: owner },
    }, mismatch);
    assert.strictEqual(mismatch.statusCode, 400);
    assert.strictEqual(fetched, false);
    assert.ok(mismatch.body.indexOf('should-not-leak') === -1);

    const artistCallback = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/callback?code=auth-code-1&state=' + encodeURIComponent(pending.s),
      headers: { cookie: artist + '; ' + statePair },
    }, artistCallback);
    assert.strictEqual(artistCallback.statusCode, 403);
    assert.strictEqual(fetched, false);
  });

  await withEnv(sandboxEnv(), async () => {
    const owner = await signupUser('emailplaiground@gmail.com');
    const start = mockRes();
    await meApi({ method: 'GET', url: '/api/toolost/start', headers: { cookie: owner } }, start);
    const pending = decodeState(start.headers['Set-Cookie']);
    toolost.setNowForTests(function () { return Date.now() + (30 * 60 * 1000); });
    let fetched = false;
    toolost.setFetchForTests(async () => {
      fetched = true;
      return { ok: false, status: 400, text: async () => '{}' };
    });
    const expired = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/callback?code=late&state=' + encodeURIComponent(pending.s),
      headers: { cookie: owner + '; ' + cookiePairs(start.headers['Set-Cookie'])[0] },
    }, expired);
    assert.strictEqual(expired.statusCode, 400);
    assert.strictEqual(fetched, false);
  });

  ['index.html', 'dashboard.html', 'admin.html', 'site.js', 'login.html', 'signup.html'].forEach((file) => {
    assert.ok(!read(file).includes('/api/toolost'), file + ' does not link the label callback');
  });
  const vercel = JSON.parse(read('vercel.json'));
  const callback = vercel.rewrites.find((row) => row.source === '/api/toolost/callback');
  assert.ok(callback);
  assert.strictEqual(callback.destination, '/api/me?action=toolost-callback');
  const apiFiles = fs.readdirSync(path.join(__dirname, '..', 'api')).filter((name) => name.endsWith('.js'));
  assert.strictEqual(apiFiles.length, 12);
  assert.ok(!apiFiles.includes('toolost.js'));
  assert.ok(!read('lib/toolost.js').includes('a3269ee0-cb0b-4d0b-9a5e-5e902b014002'));
  assert.ok(read('.env.example').includes('TOOLOST_CLIENT_ID='));
  assert.ok(read('.env.example').includes('TOOLOST_CLIENT_SECRET='));

  console.log('lib/toolost.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
