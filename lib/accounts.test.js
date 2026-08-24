'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const auth = require('./auth');
const mail = require('./mail');
const plans = require('./plans');
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
function confirm(req, res) {
  return authApi(Object.assign({ url: '/api/auth/confirm' }, req), res);
}
function me(req, res) {
  return meApi(Object.assign({ url: '/api/me' }, req), res);
}
function catalog(req, res) {
  return meApi(Object.assign({ url: '/api/me/catalog' }, req), res);
}
function meProfile(req, res) {
  return meApi(Object.assign({ url: '/api/me/profile' }, req), res);
}
function meArtists(req, res) {
  return meApi(Object.assign({ url: '/api/me/artists' }, req), res);
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

  await withEnv({ DATABASE_URL: 'postgres://memory', SESSION_SECRET: 'unit-test-session-secret', CONFIRM_SECRET: 'unit-confirm-secret', memory: true }, async () => {
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
    assert.strictEqual(createdBody.pending, true);
    assert.strictEqual(createdBody.confirmed, false);
    assert.strictEqual(createdBody.mail_sent, false);
    assert.strictEqual(createdBody.error, 'Mail is not configured.');
    assert.ok(!JSON.stringify(createdBody).includes('password'));
    assert.ok(cookieFrom(created).indexOf('plaiground_session=') === -1);

    const dup = mockRes();
    await signup({ method: 'POST', headers: {}, body: { email: 'ada@example.com', password: 'password1', artist: 'Ada Night' } }, dup);
    assert.strictEqual(dup.statusCode, 409);
    assert.strictEqual(json(dup).error, 'An account with that email already exists. Log in.');
    assert.strictEqual(json(dup).code, 'EMAIL_EXISTS');
    assert.strictEqual(json(dup).login, '/login.html');

    const badLogin = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'ada@example.com', password: 'wrong-pass' } }, badLogin);
    assert.strictEqual(badLogin.statusCode, 401);

    const pendingRow = await accounts.findByEmail('ada@example.com');
    assert.ok(pendingRow);
    assert.ok(!pendingRow.email_confirmed_at);
    const sneak = mockRes();
    await me({
      method: 'GET',
      headers: { cookie: auth.COOKIE + '=' + auth.signSession(pendingRow.id) },
    }, sneak);
    assert.strictEqual(sneak.statusCode, 403);
    assert.strictEqual(json(sneak).pending, true);

    const pendingLogin = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'ada@example.com', password: 'password1' } }, pendingLogin);
    assert.strictEqual(pendingLogin.statusCode, 403);
    assert.strictEqual(json(pendingLogin).pending, true);
    assert.ok(String(json(pendingLogin).error).indexOf('Confirm your email') !== -1);
    assert.ok(cookieFrom(pendingLogin).indexOf('plaiground_session=') === -1);

    const noMe = mockRes();
    await me({ method: 'GET', headers: {} }, noMe);
    assert.strictEqual(noMe.statusCode, 401);

    const confirmed = mockRes();
    await confirm({ method: 'POST', headers: {}, body: { token: mail.signToken('ada@example.com') } }, confirmed);
    assert.strictEqual(confirmed.statusCode, 200);
    assert.strictEqual(json(confirmed).confirmed, true);
    assert.strictEqual(json(confirmed).pending, false);
    assert.ok(cookieFrom(confirmed).indexOf('plaiground_session=') !== -1);
    assert.ok(cookieFrom(confirmed).indexOf('HttpOnly') !== -1);
    assert.ok(cookieFrom(confirmed).indexOf('Max-Age=1800') !== -1);
    assert.ok(cookieFrom(confirmed).indexOf('Expires=') !== -1);
    assert.strictEqual(auth.SESSION_TTL_SEC, 1800);

    const goodLogin = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'ada@example.com', password: 'password1' } }, goodLogin);
    assert.strictEqual(goodLogin.statusCode, 200);
    assert.strictEqual(json(goodLogin).email, 'ada@example.com');
    assert.strictEqual(json(goodLogin).confirmed, true);
    const sessionCookie = cookieFrom(goodLogin).split(';')[0];

    const meRes = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, meRes);
    assert.strictEqual(meRes.statusCode, 200);
    assert.ok(cookieFrom(meRes).indexOf('plaiground_session=') !== -1, 'GET /api/me slides the session cookie');
    assert.ok(cookieFrom(meRes).indexOf('Max-Age=1800') !== -1);
    const meBody = json(meRes);
    assert.strictEqual(meBody.email, 'ada@example.com');
    assert.strictEqual(meBody.artist, 'Ada Night');
    assert.strictEqual(meBody.plan, 'basic');
    assert.strictEqual(meBody.status, 'active');
    assert.deepStrictEqual(meBody.tonegrid_release_ids, []);
    assert.deepStrictEqual(meBody.tonegrid_track_ids, []);
    assert.strictEqual(meBody.upload.allowed, true);
    assert.strictEqual(meBody.upload.used, 0);
    assert.strictEqual(meBody.upload.limit, 1);
    assert.strictEqual(meBody.upload.album_allowed, false);
    assert.strictEqual(meBody.profile.photo, '');
    assert.deepStrictEqual(meBody.profile.genres, []);
    assert.deepStrictEqual(meBody.profile.specialties, []);
    assert.strictEqual(meBody.profile.artists.length, 1);
    assert.strictEqual(meBody.profile.artists[0].name, 'Ada Night');
    assert.strictEqual(meBody.profile.artists[0].source, 'created');
    assert.strictEqual(meBody.profile.artists[0].badge, 'PLAIGROUND');
    assert.strictEqual(meBody.profile.artists[0].ai_involvement_percent, null);
    assert.deepStrictEqual(meBody.profile.artists[0].human_contributions, []);
    assert.deepStrictEqual(meBody.profile.releases, []);
    assert.ok(!JSON.stringify(meBody).includes('password'));

    const badGenre = mockRes();
    await meProfile({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { artist: 'Ada Night', profile: { genres: ['Not A Real Genre'], specialties: [] } },
    }, badGenre);
    assert.strictEqual(badGenre.statusCode, 400);
    assert.strictEqual(json(badGenre).error, 'genre must be a ToneGrid genre.');

    const saved = mockRes();
    await meProfile({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        artist: 'Ada Night',
        profile: {
          photo: '',
          genres: ['Electronic', 'Pop'],
          specialties: ['Original lyrics', 'Played an instrument'],
        },
      },
    }, saved);
    assert.strictEqual(saved.statusCode, 200);
    assert.strictEqual(json(saved).artist, 'Ada Night');
    assert.deepStrictEqual(json(saved).profile.genres, ['Electronic', 'Pop']);
    assert.deepStrictEqual(json(saved).profile.specialties, ['Original lyrics', 'Played an instrument']);
    assert.strictEqual(json(saved).profile.photo, '');

    const againMe = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, againMe);
    assert.deepStrictEqual(json(againMe).profile.genres, ['Electronic', 'Pop']);
    assert.deepStrictEqual(json(againMe).profile.specialties, ['Original lyrics', 'Played an instrument']);

    const createdArtist = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { action: 'create', name: 'Ada Night' },
    }, createdArtist);
    assert.strictEqual(createdArtist.statusCode, 200);
    assert.strictEqual(json(createdArtist).created.name, 'Ada Night');
    assert.strictEqual(json(createdArtist).created.source, 'created');
    assert.strictEqual(json(createdArtist).created.badge, 'PLAIGROUND');
    assert.strictEqual(json(createdArtist).created.ai_involvement_percent, null);

    const yellow = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { action: 'create', name: 'Sia' },
    }, yellow);
    assert.strictEqual(yellow.statusCode, 409);
    assert.strictEqual(json(yellow).code, 'ARTIST_NAME_YELLOW');

    const yellowOk = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { action: 'create', name: 'Sia', confirm_different: true },
    }, yellowOk);
    assert.strictEqual(yellowOk.statusCode, 200);
    assert.strictEqual(json(yellowOk).created.name_check, 'yellow');

    const red = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { action: 'create', name: 'Drake' },
    }, red);
    assert.strictEqual(red.statusCode, 200);
    assert.strictEqual(json(red).created.name_check, 'red');
    assert.strictEqual(json(red).created.review_status, 'pending');

    const linked = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { action: 'link', url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg', name: 'Linked Store' },
    }, linked);
    assert.strictEqual(linked.statusCode, 200);
    assert.strictEqual(json(linked).created.source, 'linked');
    assert.strictEqual(json(linked).created.badge, 'Linked');
    assert.strictEqual(json(linked).created.spotify_id, '0TnOYISbd1XYRBk9myaseg');

    const aiSaved = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'update',
        id: json(createdArtist).created.id,
        human_contributions: ['lyrics', 'vocals_performance'],
        ai_contributions: ['beats_production'],
        ai_process_detail: 'I write all lyrics and sing. AI builds the beat.',
        ai_involvement_percent: 50,
      },
    }, aiSaved);
    assert.strictEqual(aiSaved.statusCode, 200);
    assert.deepStrictEqual(json(aiSaved).updated.human_contributions, ['lyrics', 'vocals_performance']);
    assert.strictEqual(json(aiSaved).updated.ai_involvement_percent, 50);

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
    assert.strictEqual(json(signed).upload.allowed, false);
    assert.strictEqual(json(signed).upload.used, 1);
    assert.strictEqual(json(signed).upload.limit, 1);

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
    assert.strictEqual(json(stripe).plan, 'basic');
    assert.strictEqual(json(stripe).stripe_session_id, 'cs_test_123');

    const ada = await accounts.findByEmail('ada@example.com');
    const paid = await accounts.updateStripe(ada.id, {
      plan: 'pro',
      sessionId: 'cs_test_123',
      customerId: 'cus_ada',
    });
    assert.strictEqual(paid.plan, 'pro');
    assert.strictEqual(paid.status, 'active');
    const byCustomer = await accounts.findByStripeCustomerId('cus_ada');
    assert.strictEqual(byCustomer.email, 'ada@example.com');
    const held = await accounts.updateStripe(ada.id, { status: 'hold' });
    assert.strictEqual(held.plan, 'pro');
    assert.strictEqual(held.status, 'hold');
    const heldMe = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, heldMe);
    assert.strictEqual(json(heldMe).plan, 'pro');
    assert.strictEqual(json(heldMe).status, 'hold');
    const warned = await accounts.updateStripe(ada.id, { status: 'warning' });
    assert.strictEqual(warned.plan, 'pro');
    assert.strictEqual(warned.status, 'warning');
    const warnedMe = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, warnedMe);
    assert.strictEqual(json(warnedMe).plan, 'pro');
    assert.strictEqual(json(warnedMe).status, 'warning');
    const lapsed = await accounts.updateStripe(ada.id, { plan: 'basic', status: 'active' });
    assert.strictEqual(lapsed.plan, 'basic');
    assert.strictEqual(lapsed.status, 'active');

    const other = mockRes();
    await signup({ method: 'POST', headers: {}, body: { email: 'other@example.com', password: 'password1', artist: 'Other Artist' } }, other);
    assert.strictEqual(json(other).pending, true);
    assert.ok(cookieFrom(other).indexOf('plaiground_session=') === -1);
    const otherConfirmed = mockRes();
    await confirm({ method: 'POST', headers: {}, body: { token: mail.signToken('other@example.com') } }, otherConfirmed);
    const otherCookie = cookieFrom(otherConfirmed).split(';')[0];
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
    assert.strictEqual(json(rewriteSignup).pending, true);
    assert.strictEqual(json(rewriteSignup).mail_sent, false);
    const rewriteConfirmed = mockRes();
    await confirm({ method: 'POST', headers: {}, body: { token: mail.signToken('rewrite@example.com') } }, rewriteConfirmed);
    assert.strictEqual(rewriteConfirmed.statusCode, 200);

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
      assert.strictEqual(json(mailed).pending, true);
      assert.strictEqual(json(mailed).confirmed, false);
      assert.strictEqual(json(mailed).mail_sent, true);
      assert.ok(!json(mailed).error);
      assert.ok(cookieFrom(mailed).indexOf('plaiground_session=') === -1);
      assert.strictEqual(mailCalls.length, 1);
      const mailedBody = JSON.parse(mailCalls[0].init.body);
      assert.strictEqual(mailedBody.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.ok(mailedBody.text.indexOf('email=mailer%40example.com') !== -1);
      assert.ok(mailedBody.text.indexOf('token=') !== -1);

      mailCalls.length = 0;
      global.fetch = async (url, init) => {
        mailCalls.push({ url: String(url), init });
        return { ok: true, status: 200, json: async () => ({ id: 're_test' }) };
      };
      const magicMail = mockRes();
      await authApi({
        method: 'POST',
        url: '/api/auth/mail',
        query: { action: 'mail' },
        headers: {},
        body: { email: 'ada@example.com', kind: 'magic' },
      }, magicMail);
      assert.strictEqual(magicMail.statusCode, 200);
      assert.strictEqual(json(magicMail).mail_sent, true);
      assert.strictEqual(mailCalls.length, 1);
      assert.strictEqual(mailCalls[0].url, 'https://api.resend.com/emails');
      const magicBody = JSON.parse(mailCalls[0].init.body);
      assert.strictEqual(magicBody.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.ok(magicBody.subject.toLowerCase().indexOf('sign-in') !== -1);
      assert.ok(String(magicBody.text).indexOf('magic.html') !== -1);
      assert.ok(!String(magicBody.from).toLowerCase().includes('gmail.com'));

      const magicLogin = mockRes();
      await login({ method: 'POST', headers: {}, body: { token: mail.signToken('ada@example.com', 'magic') } }, magicLogin);
      assert.strictEqual(magicLogin.statusCode, 200);
      assert.strictEqual(json(magicLogin).email, 'ada@example.com');
      assert.ok(cookieFrom(magicLogin).indexOf('Max-Age=1800') !== -1);

      mailCalls.length = 0;
      const resetMail = mockRes();
      await authApi({
        method: 'POST',
        url: '/api/auth/mail',
        query: { action: 'mail' },
        headers: {},
        body: { email: 'ada@example.com', kind: 'reset' },
      }, resetMail);
      assert.strictEqual(resetMail.statusCode, 200);
      assert.strictEqual(json(resetMail).mail_sent, true);
      assert.strictEqual(mailCalls.length, 1);
      const resetBody = JSON.parse(mailCalls[0].init.body);
      assert.strictEqual(resetBody.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.ok(resetBody.subject.indexOf('Reset') !== -1);
      assert.ok(String(resetBody.text).indexOf('forgot.html') !== -1);

      mailCalls.length = 0;
      const pendingSignup = mockRes();
      await signup({ method: 'POST', headers: {}, body: { email: 'pending.reset@example.com', password: 'password1', artist: 'Pending Reset' } }, pendingSignup);
      assert.strictEqual(pendingSignup.statusCode, 200);
      assert.ok(!(await accounts.findByEmail('pending.reset@example.com')).email_confirmed_at);
      mailCalls.length = 0;
      const pendingReset = mockRes();
      await authApi({
        method: 'POST',
        url: '/api/auth/mail',
        query: { action: 'mail' },
        headers: {},
        body: { email: 'pending.reset@example.com', kind: 'reset' },
      }, pendingReset);
      assert.strictEqual(pendingReset.statusCode, 200);
      assert.strictEqual(json(pendingReset).mail_sent, true);
      assert.strictEqual(json(pendingReset).kind, 'reset');
      assert.strictEqual(mailCalls.length, 1, 'unconfirmed reset must still call Resend');
      const pendingResetBody = JSON.parse(mailCalls[0].init.body);
      assert.strictEqual(pendingResetBody.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.ok(pendingResetBody.subject.indexOf('Reset') !== -1);
      assert.ok(String(pendingResetBody.text).indexOf('forgot.html') !== -1);
      assert.ok(String(pendingResetBody.subject).indexOf('Confirm') === -1);

      const pendingSave = mockRes();
      await authApi({
        method: 'POST',
        url: '/api/auth/reset',
        query: { action: 'reset' },
        headers: {},
        body: { token: mail.signToken('pending.reset@example.com', 'reset'), password: 'password9' },
      }, pendingSave);
      assert.strictEqual(pendingSave.statusCode, 200);
      assert.strictEqual(json(pendingSave).email, 'pending.reset@example.com');
      assert.ok(cookieFrom(pendingSave).indexOf('plaiground_session=') !== -1);
      assert.ok((await accounts.findByEmail('pending.reset@example.com')).email_confirmed_at);

      const resetSave = mockRes();
      await authApi({
        method: 'POST',
        url: '/api/auth/reset',
        query: { action: 'reset' },
        headers: {},
        body: { token: mail.signToken('ada@example.com', 'reset'), password: 'password2' },
      }, resetSave);
      assert.strictEqual(resetSave.statusCode, 200);
      assert.strictEqual(json(resetSave).email, 'ada@example.com');
      const afterReset = mockRes();
      await login({ method: 'POST', headers: {}, body: { email: 'ada@example.com', password: 'password2' } }, afterReset);
      assert.strictEqual(afterReset.statusCode, 200);

      const unknownMail = mockRes();
      mailCalls.length = 0;
      await authApi({
        method: 'POST',
        url: '/api/auth/mail',
        query: { action: 'mail' },
        headers: {},
        body: { email: 'nobody@example.com', kind: 'magic' },
      }, unknownMail);
      assert.notStrictEqual(unknownMail.statusCode, 200);
      assert.strictEqual(json(unknownMail).mail_sent, false);
      assert.ok(json(unknownMail).error);
      assert.ok(!/not found|no account|unknown/i.test(json(unknownMail).error));
      assert.strictEqual(mailCalls.length, 0, 'unknown emails must not call Resend');

      const dotted = mockRes();
      await signup({ method: 'POST', headers: {}, body: { email: 'victoria.imtanes@gmail.com', password: 'password1', artist: 'Fuvtu' } }, dotted);
      assert.strictEqual(dotted.statusCode, 200);
      const aliasDup = mockRes();
      await signup({ method: 'POST', headers: {}, body: { email: 'victoriaimtanes@gmail.com', password: 'password9', artist: 'Other' } }, aliasDup);
      assert.strictEqual(aliasDup.statusCode, 409);
      assert.strictEqual(json(aliasDup).code, 'EMAIL_EXISTS');
      const plusDup = mockRes();
      await signup({ method: 'POST', headers: {}, body: { email: 'victoria.imtanes+label@gmail.com', password: 'password9', artist: 'Other' } }, plusDup);
      assert.strictEqual(plusDup.statusCode, 409);
      assert.strictEqual(json(plusDup).code, 'EMAIL_EXISTS');
      const googlemailDup = mockRes();
      await signup({ method: 'POST', headers: {}, body: { email: 'victoria.imtanes@googlemail.com', password: 'password9', artist: 'Other' } }, googlemailDup);
      assert.strictEqual(googlemailDup.statusCode, 409);
      assert.strictEqual(json(googlemailDup).code, 'EMAIL_EXISTS');
      await confirm({ method: 'POST', headers: {}, body: { token: mail.signToken('victoria.imtanes@gmail.com') } }, mockRes());
      mailCalls.length = 0;
      global.fetch = async (url, init) => {
        mailCalls.push({ url: String(url), init });
        return { ok: true, status: 200, json: async () => ({ id: 're_test' }) };
      };
      const gmailAlias = mockRes();
      await authApi({
        method: 'POST',
        url: '/api/auth/mail',
        query: { action: 'mail' },
        headers: {},
        body: { email: 'victoriaimtanes@gmail.com', kind: 'magic' },
      }, gmailAlias);
      assert.strictEqual(gmailAlias.statusCode, 200, 'Gmail dot-alias must find the signed-up row');
      assert.strictEqual(json(gmailAlias).mail_sent, true);
      assert.strictEqual(mailCalls.length, 1);
      assert.strictEqual(JSON.parse(mailCalls[0].init.body).from, 'PLAIGROUND <confirm@wannaplai.com>');

      const found = await accounts.findByEmail('victoriaimtanes@gmail.com');
      assert.ok(found);
      assert.strictEqual(found.email, 'victoria.imtanes@gmail.com');

      mailCalls.length = 0;
      global.fetch = async () => { throw new Error('network'); };
      const mailDown = mockRes();
      await signup({ method: 'POST', headers: {}, body: { email: 'down@example.com', password: 'password1', artist: 'Down' } }, mailDown);
      assert.strictEqual(mailDown.statusCode, 200);
      assert.strictEqual(json(mailDown).ok, true);
      assert.strictEqual(json(mailDown).pending, true);
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
      headers: { cookie: cookieFrom(rewriteConfirmed).split(';')[0] },
      body: { track_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' },
    }, rewriteCatalog);
    assert.strictEqual(rewriteCatalog.statusCode, 200);
    assert.deepStrictEqual(json(rewriteCatalog).tonegrid_track_ids, ['ffffffff-ffff-4fff-8fff-ffffffffffff']);
  });

  await withEnv({ DATABASE_URL: 'postgres://memory', SESSION_SECRET: 'unit-test-session-secret', memory: true }, async () => {
    const created = await accounts.createUser({
      email: 'lifetime@example.com',
      password: 'password1',
      artist: 'Lifetime',
      plan: 'basic',
    });
    const recorded = await accounts.updateCatalog(created.id, {
      releaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    assert.deepStrictEqual(recorded.tonegrid_release_ids, ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
    assert.strictEqual(plans.evaluate(recorded).allowed, false);
    const next = await accounts.removeRelease(created.id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    assert.deepStrictEqual(next.tonegrid_release_ids, []);
    assert.deepStrictEqual(next.tonegrid_release_at, []);
    assert.strictEqual(plans.evaluate(next).allowed, true);
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
    'api/create-checkout-session.js',
    'lib/stripe-plans.js',
    'lib/stripe-webhook.js',
  ];
  sourceFiles.forEach((rel) => {
    const text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.ok(!text.includes(['t', 'g', 'k', '_'].join('')), rel + ' has a key prefix');
    assert.ok(!/sk_live_|sk_test_/.test(text), rel + ' has a Stripe secret');
  });

  const signupHtml = fs.readFileSync(path.join(__dirname, '..', 'signup.html'), 'utf8');
  assert.ok(signupHtml.includes('<label for="artist">Artist name</label>'));
  assert.ok(signupHtml.includes('placeholder="Artist name"'));
  assert.ok(!signupHtml.includes('FIRST NAME LAST NAME'));
  assert.ok(!/legal name/i.test(signupHtml));
  assert.ok(signupHtml.includes('/api/auth/signup'));
  assert.ok(signupHtml.includes('mail_sent'));
  assert.ok(signupHtml.includes('confirm.html'));
  assert.ok(!signupHtml.includes("window.location.href = 'dashboard.html'"));
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
  const uploadHtml = fs.readFileSync(path.join(__dirname, '..', 'upload.html'), 'utf8');
  assert.ok(uploadHtml.includes('data-audio-player'));
  assert.ok(uploadHtml.includes('URL.createObjectURL'));
  assert.ok(uploadHtml.includes('revokeObjectURL'));
  assert.ok(uploadHtml.includes('data-track-list'));
  assert.ok(!uploadHtml.includes('indexedDB'));

  const confirmHtml = fs.readFileSync(path.join(__dirname, '..', 'confirm.html'), 'utf8');
  assert.ok(confirmHtml.includes('/api/auth/mail'));
  assert.ok(!confirmHtml.includes('/api/signup-confirm'));
  assert.ok(!confirmHtml.toLowerCase().includes('gmail.com'));
  assert.ok(confirmHtml.includes('If it is not in the inbox, check Spam and Promotions.'));
  assert.ok(confirmHtml.includes('Check Spam and Promotions'));
  assert.ok(confirmHtml.includes('If the confirm email is not in the inbox, look there. It is from PLAIGROUND / confirm@wannaplai.com.'));
  assert.ok(!signupHtml.includes("window.location.href = 'dashboard.html'"));
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'api', 'signup-confirm.js')));
  assert.strictEqual(
    fs.readdirSync(path.join(__dirname, '..', 'api')).filter((name) => name.endsWith('.js')).length,
    6
  );
  assert.ok(!/action="[^"]*\?/.test(signupHtml) || signupHtml.includes('id="signup-form"'));

  const siteCss = fs.readFileSync(path.join(__dirname, '..', 'site.css'), 'utf8');
  assert.ok(siteCss.includes('.auth-hero::before'));
  assert.ok(siteCss.includes('body.auth-full .auth-hero'));
  assert.ok(siteCss.includes('display: none'));
  assert.ok(siteCss.includes('body.auth-full .plai-bubble'));
  assert.ok(siteCss.includes('flex-direction: column'));

  const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'login.html'), 'utf8');
  assert.ok(loginHtml.includes('/api/auth/login'));
  assert.ok(loginHtml.includes('/api/auth/mail'));
  assert.ok(loginHtml.includes('pending'));
  assert.ok(loginHtml.includes("params.get('email')"));
  assert.ok(loginHtml.includes("params.get('existing')"));
  assert.ok(loginHtml.includes('An account with that email already exists. Log in.'));
  assert.ok(loginHtml.includes('Confirm your email to finish creating this account.'));
  assert.ok(!loginHtml.includes('value="••••••••"'));
  assert.ok(!loginHtml.includes('method="get"'));

  console.log('accounts.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
