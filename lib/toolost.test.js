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
    'TOOLOST_ENV',
    'VERCEL',
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
    DATABASE_URL: 'postgres://toolost-test',
    SESSION_SECRET: 'toolost-test-session-secret',
    TOOLOST_CLIENT_ID: CLIENT,
    TOOLOST_CLIENT_SECRET: SECRET,
    TOOLOST_ENV: 'sandbox',
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
    assert.ok(!res.body.includes(ACCESS));
    const rewritten = mockRes();
    await meApi({ method: 'GET', url: '/api/me?action=toolost-callback', headers: {} }, rewritten);
    assert.strictEqual(rewritten.statusCode, 503);
    assert.ok(rewritten.body.includes(toolost.CREDENTIALS_COPY));
    const start = mockRes();
    await meApi({ method: 'GET', url: '/api/toolost/start', headers: {} }, start);
    assert.strictEqual(start.statusCode, 503);
    assert.ok(!start.headers.Location);
  });

  await withEnv(sandboxEnv({ TOOLOST_REDIRECT_URI: 'http://evil.example/api/toolost/callback' }), async () => {
    const res = mockRes();
    await meApi({ method: 'GET', url: '/api/toolost/callback?code=x&state=y', headers: {} }, res);
    assert.strictEqual(res.statusCode, 503);
    assert.ok(res.body.includes('https callback URL'));
    assert.ok(!res.headers.Location);
  });

  await withEnv(sandboxEnv(), async () => {
    const artist = await signupUser('artist@example.com');
    const blocked = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/start',
      headers: { cookie: artist },
    }, blocked);
    assert.strictEqual(blocked.statusCode, 403);
    assert.ok(!blocked.headers.Location);
    assert.ok(blocked.body.includes('PLAIGROUND label account'));

    const owner = await signupUser('emailplaiground@gmail.com');
    const start = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/me?action=toolost-start',
      headers: { cookie: owner },
    }, start);
    assert.strictEqual(start.statusCode, 302);
    const location = String(start.headers.Location || '');
    const authorize = new URL(location);
    assert.strictEqual(authorize.origin + authorize.pathname, 'https://sandbox.toolost.com/oauth/authorize');
    assert.strictEqual(authorize.searchParams.get('response_type'), 'code');
    assert.strictEqual(authorize.searchParams.get('client_id'), CLIENT);
    assert.strictEqual(authorize.searchParams.get('redirect_uri'), toolost.REDIRECT_DEFAULT);
    assert.strictEqual(authorize.searchParams.get('scope'), toolost.SCOPES);
    assert.strictEqual(authorize.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(!authorize.searchParams.get('code_verifier'));
    assert.ok(location.indexOf(SECRET) === -1);
    const pending = decodeState(start.headers['Set-Cookie']);
    const challenge = crypto.createHash('sha256').update(pending.v).digest('base64url');
    assert.strictEqual(authorize.searchParams.get('code_challenge'), challenge);
    assert.strictEqual(authorize.searchParams.get('state'), pending.s);
    assert.ok(String(start.headers['Set-Cookie']).indexOf('HttpOnly') !== -1);
    assert.ok(String(start.headers['Set-Cookie']).indexOf(SECRET) === -1);
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
    assert.ok(String(callback.headers.Location).indexOf(REFRESH) === -1);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, 'https://sandbox.toolost.com/oauth/token');
    assert.strictEqual(calls[0].options.method, 'POST');
    assert.strictEqual(calls[0].options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const form = new URLSearchParams(calls[0].options.body);
    assert.strictEqual(form.get('grant_type'), 'authorization_code');
    assert.strictEqual(form.get('code'), 'auth-code-1');
    assert.strictEqual(form.get('redirect_uri'), toolost.REDIRECT_DEFAULT);
    assert.strictEqual(form.get('client_id'), CLIENT);
    assert.strictEqual(form.get('client_secret'), SECRET);
    assert.strictEqual(form.get('code_verifier'), pending.v);
    const stored = toolost.labelTokenForTests();
    assert.strictEqual(stored.access_token, ACCESS);
    assert.strictEqual(stored.refresh_token, REFRESH);
    const setCookies = cookiePairs(callback.headers['Set-Cookie']).join(';');
    assert.ok(setCookies.indexOf(ACCESS) === -1);
    assert.ok(setCookies.indexOf(REFRESH) === -1);
    assert.ok(setCookies.indexOf(pending.v) === -1);

    const holdPair = cookiePairs(callback.headers['Set-Cookie']).find((row) => row.indexOf(toolost.HOLD_COOKIE + '=') === 0);
    const connected = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/connected',
      headers: { cookie: owner + '; ' + holdPair },
    }, connected);
    assert.strictEqual(connected.statusCode, 200);
    assert.ok(connected.body.includes('TooLost sandbox is connected for the PLAIGROUND label account.'));
    assert.ok(connected.body.includes('The access token stays on this server.'));
    assert.ok(connected.body.includes('/api/toolost/start'));
    assert.ok(connected.body.indexOf(ACCESS) === -1);
    assert.ok(connected.body.indexOf(REFRESH) === -1);
    assert.ok(connected.body.indexOf(SECRET) === -1);
    assert.ok(connected.body.includes('noindex'));

    toolost.resetForTests();
    const mismatch = mockRes();
    let fetched = false;
    toolost.setFetchForTests(async () => {
      fetched = true;
      return { ok: false, status: 400, text: async () => '{}' };
    });
    await meApi({
      method: 'GET',
      url: '/api/toolost/callback?code=auth-code-1&state=' + encodeURIComponent(pending.s),
      headers: { cookie: owner },
    }, mismatch);
    assert.strictEqual(mismatch.statusCode, 400);
    assert.strictEqual(fetched, false);
    assert.strictEqual(toolost.labelTokenForTests(), null);

    const denied = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/callback?error=access_denied&state=abc',
      headers: { cookie: owner },
    }, denied);
    assert.strictEqual(denied.statusCode, 400);
    assert.ok(denied.body.includes('did not authorize'));
    assert.strictEqual(fetched, false);

    const artistCallback = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/callback?code=auth-code-1&state=' + encodeURIComponent(pending.s),
      headers: { cookie: artist + '; ' + statePair },
    }, artistCallback);
    assert.strictEqual(artistCallback.statusCode, 403);
    assert.strictEqual(fetched, false);
  });

  await withEnv(sandboxEnv({ TOOLOST_ENV: 'production' }), async () => {
    const owner = await signupUser('emailplaiground@gmail.com');
    const start = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/start',
      headers: { cookie: owner },
    }, start);
    const location = new URL(String(start.headers.Location));
    assert.strictEqual(location.origin + location.pathname, 'https://toolost.com/oauth/authorize');
    const pending = decodeState(start.headers['Set-Cookie']);
    const calls = installFetch(200, { access_token: ACCESS, expires_in: 60 });
    const done = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/callback?code=prod-code&state=' + encodeURIComponent(pending.s),
      headers: { cookie: owner + '; ' + cookiePairs(start.headers['Set-Cookie'])[0] },
    }, done);
    assert.strictEqual(done.statusCode, 302);
    assert.strictEqual(calls[0].url, 'https://toolost.com/oauth/token');
    assert.ok(calls[0].url.indexOf('sandbox') === -1);
  });

  await withEnv(sandboxEnv({ TOOLOST_ENV: 'nope' }), async () => {
    assert.strictEqual(toolost.endpoints().authorize, 'https://sandbox.toolost.com/oauth/authorize');
    assert.strictEqual(toolost.endpoints().token, 'https://sandbox.toolost.com/oauth/token');
    assert.strictEqual(toolost.endpoints().api, 'https://api-sandbox.toolost.com/v1');
  });

  const publicFiles = ['index.html', 'dashboard.html', 'admin.html', 'site.js', 'login.html', 'signup.html'];
  publicFiles.forEach((file) => {
    assert.ok(!read(file).includes('/api/toolost'), file + ' does not link the label callback');
    assert.ok(!/toolost/i.test(read(file)), file + ' does not mention TooLost');
  });

  const vercel = JSON.parse(read('vercel.json'));
  const callback = vercel.rewrites.find((row) => row.source === '/api/toolost/callback');
  assert.ok(callback);
  assert.strictEqual(callback.destination, '/api/me?action=toolost-callback');
  assert.ok(vercel.rewrites.some((row) => row.source === '/api/toolost/start'));
  assert.ok(vercel.rewrites.some((row) => row.source === '/api/toolost/connected'));
  const apiFiles = fs.readdirSync(path.join(__dirname, '..', 'api')).filter((name) => name.endsWith('.js'));
  assert.strictEqual(apiFiles.length, 12);
  assert.ok(!apiFiles.includes('toolost.js'));
  const readme = read('README.md');
  assert.ok(readme.includes('TOOLOST_CLIENT_ID'));
  assert.ok(readme.includes('TOOLOST_CLIENT_SECRET'));
  assert.ok(readme.includes('TOOLOST_REDIRECT_URI'));
  assert.ok(readme.includes('TOOLOST_ENV'));
  assert.ok(readme.includes('https://www.wannaplai.com/api/toolost/callback'));
  assert.ok(read('.env.example').includes('TOOLOST_ENV=sandbox'));
  assert.ok(!toolost.SCOPES.includes('read:audience'));
  assert.ok(!toolost.SCOPES.includes('write:publishing'));

  console.log('lib/toolost.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
