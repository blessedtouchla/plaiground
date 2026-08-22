'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const auth = require('./auth');
const authApi = require('../api/auth');
const meApi = require('../api/me');

function signup(req, res) {
  return authApi(Object.assign({ url: '/api/auth/signup' }, req), res);
}
function login(req, res) {
  return authApi(Object.assign({ url: '/api/auth/login' }, req), res);
}
function logout(req, res) {
  return authApi(Object.assign({ url: '/api/auth/logout' }, req), res);
}
function bootstrap(req, res) {
  return authApi(Object.assign({ url: '/api/auth' }, req), res);
}
function me(req, res) {
  return meApi(Object.assign({ url: '/api/me' }, req), res);
}
function catalog(req, res) {
  return meApi(Object.assign({ url: '/api/me/catalog' }, req), res);
}

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
  const keys = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'RESEND_API_KEY',
    'CONFIRM_SECRET',
    'SIGNUP_CONFIRM_SECRET',
    'CONFIRM_FROM',
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
    keys.forEach((key) => {
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

    const shortPw = mockRes();
    await signup({ method: 'POST', headers: {}, body: { email: 'short@example.com', password: 'short', artist: 'Short' } }, shortPw);
    assert.strictEqual(shortPw.statusCode, 400);
    assert.strictEqual(json(shortPw).error, 'Password must be at least 8 characters.');

    const created = mockRes();
    await signup({ method: 'POST', headers: {}, body: { email: 'Ada@Example.com', password: 'password1', artist: 'Ada Night', plan: 'basic' } }, created);
    assert.strictEqual(created.statusCode, 200);
    const createdBody = json(created);
    assert.strictEqual(createdBody.ok, true);
    assert.strictEqual(createdBody.email, 'ada@example.com');
    assert.strictEqual(createdBody.artist, 'Ada Night');
    assert.strictEqual(createdBody.plan, 'basic');
    assert.strictEqual(createdBody.mail_sent, false);
    assert.strictEqual(createdBody.error, 'Mail is not configured.');
    assert.ok(!JSON.stringify(createdBody).includes('password'));
    assert.ok(cookieFrom(created).indexOf('plaiground_session=') !== -1);
    assert.ok(cookieFrom(created).indexOf('HttpOnly') !== -1);
    assert.ok(cookieFrom(created).indexOf('SameSite=Lax') !== -1);
    assert.ok(cookieFrom(created).indexOf('password') === -1);

    const dup = mockRes();
    await signup({ method: 'POST', headers: {}, body: { email: 'ada@example.com', password: 'password1', artist: 'Ada Night' } }, dup);
    assert.strictEqual(dup.statusCode, 409);
    assert.strictEqual(json(dup).error, 'An account with that email already exists. Log in.');
    assert.strictEqual(json(dup).code, 'EMAIL_EXISTS');
    assert.strictEqual(json(dup).login, '/login.html');

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

    const rewriteSignup = mockRes();
    await authApi({
      method: 'POST',
      url: '/api/auth?action=signup',
      query: { action: 'signup' },
      headers: {},
      body: { email: 'rewrite@example.com', password: 'password1', artist: 'Rewrite' },
    }, rewriteSignup);
    assert.strictEqual(rewriteSignup.statusCode, 200);
    assert.strictEqual(json(rewriteSignup).email, 'rewrite@example.com');
    assert.strictEqual(json(rewriteSignup).mail_sent, false);

    const mailGet = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/mail', query: { action: 'mail' }, headers: {} }, mailGet);
    assert.strictEqual(mailGet.statusCode, 200);
    assert.strictEqual(json(mailGet).configured, false);

    const mailPost = mockRes();
    await authApi({
      method: 'POST',
      url: '/api/auth/mail',
      query: { action: 'mail' },
      headers: {},
      body: { email: 'rewrite@example.com', artist: 'Rewrite' },
    }, mailPost);
    assert.strictEqual(mailPost.statusCode, 503);
    assert.strictEqual(json(mailPost).mail_sent, false);
    assert.strictEqual(json(mailPost).error, 'Mail is not configured.');

    const prevFetch = global.fetch;
    const mailCalls = [];
    global.fetch = async (url, init) => {
      mailCalls.push({ url: String(url), init });
      return { ok: true, status: 200, json: async () => ({ id: 're_test' }) };
    };
    try {
      process.env.RESEND_API_KEY = 're_test_key';
      const mailed = mockRes();
      await signup({ method: 'POST', headers: {}, body: { email: 'mailer@example.com', password: 'password1', artist: 'Mailer' } }, mailed);
      assert.strictEqual(mailed.statusCode, 200);
      assert.strictEqual(json(mailed).ok, true);
      assert.strictEqual(json(mailed).mail_sent, true);
      assert.ok(!json(mailed).error);
      assert.strictEqual(mailCalls.length, 1);
      const mailedBody = JSON.parse(mailCalls[0].init.body);
      assert.strictEqual(mailedBody.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.ok(mailedBody.text.indexOf('https://www.wannaplai.com/confirmed.html?email=mailer%40example.com') !== -1);

      mailCalls.length = 0;
      global.fetch = async () => { throw new Error('network'); };
      const mailDown = mockRes();
      await signup({ method: 'POST', headers: {}, body: { email: 'down@example.com', password: 'password1', artist: 'Down' } }, mailDown);
      assert.strictEqual(mailDown.statusCode, 200);
      assert.strictEqual(json(mailDown).ok, true);
      assert.strictEqual(json(mailDown).email, 'down@example.com');
      assert.strictEqual(json(mailDown).mail_sent, false);
      assert.ok(json(mailDown).error);
    } finally {
      delete process.env.RESEND_API_KEY;
      global.fetch = prevFetch;
    }

    const rewriteCatalog = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me?action=catalog',
      query: { action: 'catalog' },
      headers: { cookie: cookieFrom(rewriteSignup).split(';')[0] },
      body: { track_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' },
    }, rewriteCatalog);
    assert.strictEqual(rewriteCatalog.statusCode, 200);
    assert.deepStrictEqual(json(rewriteCatalog).tonegrid_track_ids, ['ffffffff-ffff-4fff-8fff-ffffffffffff']);
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
    'api/auth.js',
    'api/me.js',
    'signup.html',
    'login.html',
    'confirm.html',
    'account.js',
    'membership.js',
    'lib/mail.js',
  ];
  sourceFiles.forEach((rel) => {
    const text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.ok(!text.includes(['t', 'g', 'k', '_'].join('')), rel + ' has a key prefix');
    assert.ok(!/sk_live_|sk_test_/.test(text), rel + ' has a Stripe secret');
  });

  const signupHtml = fs.readFileSync(path.join(__dirname, '..', 'signup.html'), 'utf8');
  assert.ok(signupHtml.includes('FIRST NAME LAST NAME'));
  assert.ok(signupHtml.includes('/api/auth/signup'));
  assert.ok(signupHtml.includes('mail_sent'));
  assert.ok(signupHtml.includes('confirm.html'));
  assert.ok(signupHtml.includes('dashboard.html'));
  assert.ok(signupHtml.includes('Accounts are not configured.'));
  assert.ok(signupHtml.includes('409'));
  assert.ok(signupHtml.includes('EMAIL_EXISTS'));
  assert.ok(signupHtml.includes('An account with that email already exists. Log in.'));
  assert.ok(signupHtml.includes('existing=1'));
  assert.ok(signupHtml.includes('login.html'));
  assert.ok(signupHtml.includes('auth-hero'));
  assert.ok(signupHtml.includes('Upload once. Get paid everywhere.'));
  assert.ok(signupHtml.includes('Make an account'));
  assert.ok(signupHtml.includes('Create account'));
  assert.ok(signupHtml.includes('id="password-rule"'));
  assert.ok(signupHtml.includes('Password must be at least 8 characters.'));
  assert.ok(signupHtml.includes('password.length < 8'));
  assert.ok(!signupHtml.includes('/api/signup-confirm'));
  assert.ok(!signupHtml.includes('Email sent'));

  const confirmHtml = fs.readFileSync(path.join(__dirname, '..', 'confirm.html'), 'utf8');
  assert.ok(confirmHtml.includes('/api/auth/mail'));
  assert.ok(!confirmHtml.includes('/api/signup-confirm'));
  assert.ok(!confirmHtml.toLowerCase().includes('gmail.com'));
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'api', 'signup-confirm.js')));
  assert.ok(!/action="[^"]*\?/.test(signupHtml) || signupHtml.includes('id="signup-form"'));

  const siteCss = fs.readFileSync(path.join(__dirname, '..', 'site.css'), 'utf8');
  assert.ok(siteCss.includes('.auth-hero::before'));
  assert.ok(siteCss.includes('white-space: normal'));
  assert.ok(siteCss.includes('overflow-wrap: break-word'));

  const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'login.html'), 'utf8');
  assert.ok(loginHtml.includes('/api/auth/login'));
  assert.ok(loginHtml.includes("params.get('email')"));
  assert.ok(loginHtml.includes("params.get('existing')"));
  assert.ok(loginHtml.includes('An account with that email already exists. Log in.'));
  assert.ok(!loginHtml.includes('value="••••••••"'));
  assert.ok(!loginHtml.includes('method="get"'));

  console.log('accounts.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
