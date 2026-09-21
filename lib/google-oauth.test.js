'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const auth = require('./auth');
const googleOauth = require('./google-oauth');
const authApi = require('../api/auth');
const meApi = require('../api/me');

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

function cookieList(res) {
  const raw = res.headers['Set-Cookie'];
  if (Array.isArray(raw)) return raw.map(String);
  return raw ? [String(raw)] : [];
}

function cookieFrom(res) {
  return cookieList(res).join('\n');
}

function sessionCookieFrom(res) {
  const row = cookieList(res).find((item) => item.indexOf(auth.COOKIE + '=') === 0);
  return row ? row.split(';')[0] : '';
}

async function withEnv(env, fn) {
  const keys = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
  ];
  const prev = {};
  keys.forEach((key) => {
    prev[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  });
  accounts.resetStore();
  if (env.memory) accounts.useMemoryStore();
  try {
    await fn();
  } finally {
    accounts.resetStore();
    googleOauth.setFetchForTests();
    keys.forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  }
}

function googleUserFetch(user) {
  return async function (url) {
    const href = String(url);
    if (href.indexOf('oauth2.googleapis.com/token') !== -1) {
      return { ok: true, json: async () => ({ access_token: 'google-access' }) };
    }
    if (href.indexOf('openidconnect.googleapis.com/v1/userinfo') !== -1) {
      return { ok: true, json: async () => user };
    }
    throw new Error('unexpected fetch ' + href);
  };
}

async function run() {
  assert.strictEqual(googleOauth.safeNext('https://evil.example/phish'), '');
  assert.strictEqual(googleOauth.safeNext('//evil.example'), '');
  assert.strictEqual(googleOauth.safeNext('../login.html'), '');
  assert.strictEqual(googleOauth.safeNext('dashboard.html'), 'dashboard.html');
  assert.strictEqual(googleOauth.safeNext('/dashboard.html'), '/dashboard.html');
  assert.strictEqual(googleOauth.successLocation('releases.html'), 'releases.html');
  assert.strictEqual(googleOauth.successLocation(''), '/dashboard.html');

  await withEnv({}, async () => {
    const res = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/google' }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(json(res).configured, false);
  });

  await withEnv({
    DATABASE_URL: 'postgres://memory',
    SESSION_SECRET: 'unit-test-session-secret',
    memory: true,
  }, async () => {
    const status = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/google' }, status);
    assert.strictEqual(json(status).configured, false);

    const start = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/google-start' }, start);
    assert.strictEqual(start.statusCode, 503);
    assert.strictEqual(json(start).configured, false);
    assert.ok(!start.headers.Location);
  });

  await withEnv({
    DATABASE_URL: 'postgres://memory',
    SESSION_SECRET: 'unit-test-session-secret',
    GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    memory: true,
  }, async () => {
    const status = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/google' }, status);
    assert.strictEqual(status.statusCode, 200);
    assert.strictEqual(json(status).configured, true);

    const start = mockRes();
    await authApi({
      method: 'GET',
      url: '/api/auth/google-start?remember=1',
      headers: { host: 'www.wannaplai.com', 'x-forwarded-proto': 'https' },
    }, start);
    assert.strictEqual(start.statusCode, 302);
    const location = String(start.headers.Location || '');
    assert.ok(location.indexOf('https://accounts.google.com/o/oauth2/v2/auth?') === 0);
    const started = new URL(location);
    assert.strictEqual(started.searchParams.get('client_id'), 'client-id.apps.googleusercontent.com');
    assert.strictEqual(started.searchParams.get('redirect_uri'), 'https://www.wannaplai.com/api/auth/google-callback');
    assert.strictEqual(started.searchParams.get('scope'), 'openid email profile');
    const state = googleOauth.verifyState(started.searchParams.get('state'));
    assert.ok(state);
    assert.strictEqual(state.remember, true);
    assert.strictEqual(state.next, '');

    googleOauth.setFetchForTests(googleUserFetch({
      email: 'Ada.Night@gmail.com',
      email_verified: true,
      name: 'Ada Night',
    }));
    const created = mockRes();
    await authApi({
      method: 'GET',
      url: '/api/auth/google-callback?code=ok&state=' + encodeURIComponent(started.searchParams.get('state')),
      headers: { host: 'www.wannaplai.com', 'x-forwarded-proto': 'https' },
    }, created);
    assert.strictEqual(created.statusCode, 302, cookieFrom(created));
    assert.strictEqual(created.headers.Location, '/dashboard.html');
    assert.ok(cookieFrom(created).indexOf('plaiground_session=') !== -1);
    assert.ok(cookieFrom(created).indexOf('Max-Age=2592000') !== -1, 'remember from Google start keeps the 30-day cookie');
    const first = await accounts.findByEmail('adanight@gmail.com');
    assert.ok(first);
    assert.ok(first.email_confirmed_at);
    assert.strictEqual(first.artist_name, 'Ada Night');

    const meRes = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: sessionCookieFrom(created) },
    }, meRes);
    assert.strictEqual(meRes.statusCode, 200);
    assert.strictEqual(json(meRes).email, 'ada.night@gmail.com');
    assert.strictEqual(json(meRes).confirmed, true);

    googleOauth.setFetchForTests(googleUserFetch({
      email: 'ada.night+live@gmail.com',
      email_verified: true,
      name: 'Ada Duplicate',
    }));
    const mergeStart = mockRes();
    await authApi({
      method: 'GET',
      url: '/api/auth/google-start',
      headers: { host: 'www.wannaplai.com', 'x-forwarded-proto': 'https' },
    }, mergeStart);
    const mergeState = new URL(mergeStart.headers.Location).searchParams.get('state');
    const merged = mockRes();
    await authApi({
      method: 'GET',
      url: '/api/auth/google-callback?code=ok&state=' + encodeURIComponent(mergeState),
      headers: { host: 'www.wannaplai.com', 'x-forwarded-proto': 'https' },
    }, merged);
    assert.strictEqual(merged.statusCode, 302);
    const after = await accounts.listUsers();
    assert.strictEqual(after.length, 1, 'same Gmail must not fork a second account');
    assert.strictEqual(after[0].id, first.id);
    assert.strictEqual(after[0].artist_name, 'Ada Night');

    const pending = await accounts.createUser({
      email: 'pending.google@example.com',
      password: 'password1',
      artist: 'Pending Ada',
    });
    assert.ok(!pending.email_confirmed_at);
    googleOauth.setFetchForTests(googleUserFetch({
      email: 'pending.google@example.com',
      email_verified: true,
      name: 'Pending Ada',
    }));
    const pendingStart = mockRes();
    await authApi({
      method: 'GET',
      url: '/api/auth/google-start',
      headers: { host: 'www.wannaplai.com' },
    }, pendingStart);
    const pendingCb = mockRes();
    await authApi({
      method: 'GET',
      url: '/api/auth/google-callback?code=ok&state=' + encodeURIComponent(new URL(pendingStart.headers.Location).searchParams.get('state')),
    }, pendingCb);
    const confirmed = await accounts.findByEmail('pending.google@example.com');
    assert.ok(confirmed.email_confirmed_at, 'Google on a pending email confirms that account');
    assert.strictEqual(confirmed.id, pending.id);
    assert.ok(cookieFrom(pendingCb).indexOf('plaiground_session=') !== -1);

    googleOauth.setFetchForTests(googleUserFetch({
      email: 'not-verified@example.com',
      email_verified: false,
      name: 'Nope',
    }));
    const unverifiedStart = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/google-start' }, unverifiedStart);
    const unverified = mockRes();
    await authApi({
      method: 'GET',
      url: '/api/auth/google-callback?code=ok&state=' + encodeURIComponent(new URL(unverifiedStart.headers.Location).searchParams.get('state')),
    }, unverified);
    assert.strictEqual(unverified.headers.Location, '/login.html?google=0');
    assert.ok(!(await accounts.findByEmail('not-verified@example.com')));

    const denied = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/google-callback?error=access_denied' }, denied);
    assert.strictEqual(denied.headers.Location, '/login.html?google=0');

    const local = mockRes();
    await authApi({
      method: 'GET',
      url: '/api/auth/google-start',
      headers: { host: 'localhost:4173' },
    }, local);
    assert.strictEqual(
      new URL(local.headers.Location).searchParams.get('redirect_uri'),
      'http://localhost:4173/api/auth/google-callback'
    );

    const liveOrigin = googleOauth.redirectUri({
      headers: { host: 'preview.vercel.app', 'x-forwarded-proto': 'https' },
    });
    assert.strictEqual(liveOrigin, 'https://www.wannaplai.com/api/auth/google-callback');
  });

  await withEnv({
    DATABASE_URL: 'postgres://memory',
    SESSION_SECRET: 'unit-test-session-secret',
    GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    memory: true,
  }, async () => {
    const existing = await accounts.createUser({
      email: 'merge@example.com',
      password: 'password1',
      artist: 'Merge Ada',
    });
    await accounts.confirmEmail(existing.email);
    const result = await accounts.findOrCreateFromGoogle({
      email: 'merge@example.com',
      artist: 'Other Name',
    });
    assert.strictEqual(result.created, false);
    assert.strictEqual(result.row.id, existing.id);
    assert.strictEqual((await accounts.listUsers()).length, 1);
  });

  const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'login.html'), 'utf8');
  const signupHtml = fs.readFileSync(path.join(__dirname, '..', 'signup.html'), 'utf8');
  assert.ok(!/Sign in with Apple|Continue with Apple/i.test(loginHtml + signupHtml));
  assert.ok(!/plainow/i.test(loginHtml + signupHtml), 'this PR is wannaplai only');
  assert.ok(loginHtml.includes('id="continue-google"') && signupHtml.includes('id="continue-google"'));
  assert.ok(auth.COOKIE === 'plaiground_session');

  console.log('google-oauth.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
