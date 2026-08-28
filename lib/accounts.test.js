'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const auth = require('./auth');
const mail = require('./mail');
const plans = require('./plans');
const { recoverPaidPlan } = require('./stripe-webhook');
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
function changePassword(req, res) {
  return authApi(Object.assign({ url: '/api/auth/password' }, req), res);
}
function deleteAccount(req, res) {
  return authApi(Object.assign({ url: '/api/auth/delete' }, req), res);
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
    assert.ok(cookieFrom(confirmed).indexOf('plaiground_signed=1') !== -1, 'readable session hint lets the client keep a live cookie off login.html');
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
    assert.strictEqual(json(badGenre).error, 'genre must be a listed genre.');

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

    const accountPhoto = 'data:image/jpeg;base64,' + 'C'.repeat(4000);
    const accountPhotoSave = mockRes();
    await meProfile({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { profile: { photo: accountPhoto } },
    }, accountPhotoSave);
    assert.strictEqual(accountPhotoSave.statusCode, 200, 'Account Settings photo saves on the existing profile record');
    assert.strictEqual(json(accountPhotoSave).profile.photo, accountPhoto);
    assert.deepStrictEqual(json(accountPhotoSave).profile.genres, ['Electronic', 'Pop'], 'photo-only save must keep genres');
    assert.deepStrictEqual(json(accountPhotoSave).profile.specialties, ['Original lyrics', 'Played an instrument']);
    assert.strictEqual(json(accountPhotoSave).plan, 'basic', 'Change photo must work on Basic without checkout');

    const accountPhotoReload = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, accountPhotoReload);
    assert.strictEqual(json(accountPhotoReload).profile.photo, accountPhoto, 'GET /api/me must return the saved account photo after reload');
    assert.deepStrictEqual(json(accountPhotoReload).profile.genres, ['Electronic', 'Pop']);
    assert.strictEqual(json(accountPhotoReload).plan, 'basic');

    const accountFields = mockRes();
    await meProfile({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        artist: 'Ada Remix',
        profile: { legal_name: 'Ada Lovelace', country: 'Canada' },
      },
    }, accountFields);
    assert.strictEqual(accountFields.statusCode, 200, 'Settings Save changes writes name and fields on the same profile record');
    assert.strictEqual(json(accountFields).artist, 'Ada Remix');
    assert.strictEqual(json(accountFields).profile.legal_name, 'Ada Lovelace');
    assert.strictEqual(json(accountFields).profile.country, 'Canada');
    assert.strictEqual(json(accountFields).profile.photo, accountPhoto, 'field save must keep the account photo');
    assert.deepStrictEqual(json(accountFields).profile.genres, ['Electronic', 'Pop'], 'field save must keep genres');

    const fieldsReload = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, fieldsReload);
    assert.strictEqual(json(fieldsReload).artist, 'Ada Remix', 'GET /api/me must return the saved artist name after reload');
    assert.strictEqual(json(fieldsReload).profile.legal_name, 'Ada Lovelace', 'GET /api/me must return the saved legal name after reload');
    assert.strictEqual(json(fieldsReload).profile.country, 'Canada', 'GET /api/me must return the saved country after reload');
    assert.strictEqual(json(fieldsReload).profile.photo, accountPhoto);

    const photoKeepsFields = mockRes();
    await meProfile({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { profile: { photo: accountPhoto } },
    }, photoKeepsFields);
    assert.strictEqual(json(photoKeepsFields).profile.legal_name, 'Ada Lovelace', 'photo-only save must keep legal name');
    assert.strictEqual(json(photoKeepsFields).profile.country, 'Canada', 'photo-only save must keep country');
    assert.strictEqual(json(photoKeepsFields).artist, 'Ada Remix');

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

    const silent = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'update',
        id: json(createdArtist).created.id,
        bio: 'saved immediately',
      },
    }, silent);
    assert.strictEqual(silent.statusCode, 200);
    assert.strictEqual(json(silent).updated.bio, 'saved immediately');
    assert.strictEqual(json(silent).submitted_edit, false);
    assert.strictEqual(json(silent).updated.edit_status, '');
    const silentReload = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, silentReload);
    const silentAgain = (json(silentReload).profile.artists || []).find(function (row) {
      return row.id === json(createdArtist).created.id;
    });
    assert.ok(silentAgain, 'updated artist must still be on GET /api/me');
    assert.strictEqual(silentAgain.bio, 'saved immediately', 'bio must persist after reload');

    const rewriteClobber = mockRes();
    await meApi({
      url: '/api/me?action=artists',
      query: { action: 'artists' },
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'artists',
        id: json(createdArtist).created.id,
        bio: 'saved after rewrite clobber',
        ai_involvement_percent: 40,
      },
    }, rewriteClobber);
    assert.strictEqual(rewriteClobber.statusCode, 200, 'route action=artists must not no-op an artist update');
    assert.strictEqual(json(rewriteClobber).updated.bio, 'saved after rewrite clobber');
    assert.strictEqual(json(rewriteClobber).updated.ai_involvement_percent, 40);
    const rewriteReload = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, rewriteReload);
    const rewriteAgain = (json(rewriteReload).profile.artists || []).find(function (row) {
      return row.id === json(createdArtist).created.id;
    });
    assert.ok(rewriteAgain, 'clobbered rewrite update must still be on GET /api/me');
    assert.strictEqual(rewriteAgain.bio, 'saved after rewrite clobber');
    assert.strictEqual(rewriteAgain.ai_involvement_percent, 40);

    const accountIdSave = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'update',
        id: 'account',
        name: 'Ada Night',
        bio: 'saved as account id',
      },
    }, accountIdSave);
    assert.strictEqual(accountIdSave.statusCode, 200, 'seeded account id must update the real Basic artist');
    assert.strictEqual(json(accountIdSave).updated.id, json(createdArtist).created.id);
    assert.strictEqual(json(accountIdSave).updated.bio, 'saved as account id');

    const photoKept = mockRes();
    const photoData = 'data:image/jpeg;base64,' + 'A'.repeat(200000);
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'update',
        id: json(createdArtist).created.id,
        photo: photoData,
      },
    }, photoKept);
    assert.strictEqual(photoKept.statusCode, 200);
    assert.strictEqual(json(photoKept).updated.photo, photoData);
    const photoReload = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, photoReload);
    const photoAgain = (json(photoReload).profile.artists || []).find(function (row) {
      return row.id === json(createdArtist).created.id;
    });
    assert.ok(photoAgain, 'photo artist must still be on GET /api/me');
    assert.strictEqual(photoAgain.photo, photoData, 'photo must persist after reload');
    assert.strictEqual(photoAgain.bio, 'saved as account id', 'earlier bio must still be there after a photo save');

    const photoHuge = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'update',
        id: json(createdArtist).created.id,
        photo: 'data:image/jpeg;base64,' + 'B'.repeat(1300000),
      },
    }, photoHuge);
    assert.strictEqual(photoHuge.statusCode, 400);
    assert.match(json(photoHuge).error || '', /too large/i);

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
    assert.strictEqual(json(aiSaved).submitted_edit, false);
    assert.strictEqual(json(aiSaved).updated.edit_status, '');
    assert.deepStrictEqual(json(aiSaved).updated.human_contributions, ['lyrics', 'vocals_performance']);
    assert.strictEqual(json(aiSaved).updated.ai_involvement_percent, 50);

    const lockedName = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'record_release',
        release: {
          title: 'First Live',
          plaiground_artist_id: json(createdArtist).created.id,
          tonegrid_status: 'live',
          tonegrid_release_id: '11111111-1111-4111-8111-111111111111',
        },
      },
    }, lockedName);
    assert.strictEqual(lockedName.statusCode, 200);

    const blockedDelete = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { action: 'delete', id: json(createdArtist).created.id },
    }, blockedDelete);
    assert.strictEqual(blockedDelete.statusCode, 409);
    assert.strictEqual(json(blockedDelete).code, 'ARTIST_HAS_STORE_RELEASE');
    assert.ok(/store \/ the distributor/i.test(json(blockedDelete).error));
    assert.ok((json(blockedDelete).profile.artists || []).some(function (row) {
      return row.id === json(createdArtist).created.id;
    }), 'must not drop the profile when a live store release still exists');

    const namePatch = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'update',
        id: json(createdArtist).created.id,
        name: 'Renamed After Live',
        bio: 'pending bio',
      },
    }, namePatch);
    assert.strictEqual(namePatch.statusCode, 200);
    assert.strictEqual(json(namePatch).updated.name, 'Ada Night', 'locked store name is not patched');
    assert.strictEqual(json(namePatch).updated.bio, 'pending bio');
    assert.strictEqual(json(namePatch).updated.edit_status, '');

    const coverPersist = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'record_release',
        release: {
          title: 'Cover Stay',
          plaiground_artist_id: json(createdArtist).created.id,
          tonegrid_status: 'pending',
          tonegrid_release_id: '22222222-2222-4222-8222-222222222222',
          artwork_url: 'data:image/jpeg;base64,coverstay',
          genre: 'Pop',
          language: 'en',
          artist: 'Ada Night',
          lyrics: 'City lights, I stay',
          release_date: '2026-09-12',
          dsps: ['spotify', 'apple-music'],
        },
      },
    }, coverPersist);
    assert.strictEqual(coverPersist.statusCode, 200);
    const storedCover = (json(coverPersist).profile.releases || []).find(function (row) {
      return row.tonegrid_release_id === '22222222-2222-4222-8222-222222222222';
    });
    assert.ok(storedCover, 'record_release must keep the cover row');
    assert.strictEqual(storedCover.artwork_url, 'data:image/jpeg;base64,coverstay');
    assert.strictEqual(storedCover.genre, 'Pop');
    assert.strictEqual(storedCover.language, 'en');
    assert.strictEqual(storedCover.artist, 'Ada Night');
    assert.strictEqual(storedCover.lyrics, 'City lights, I stay');
    assert.strictEqual(storedCover.release_date, '2026-09-12');
    assert.deepStrictEqual(storedCover.dsps, ['spotify', 'apple-music']);

    const reviewDelete = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { action: 'delete', id: json(red).created.id },
    }, reviewDelete);
    assert.strictEqual(reviewDelete.statusCode, 200);
    assert.strictEqual(json(reviewDelete).deleted.id, json(red).created.id);
    assert.ok(!(json(reviewDelete).profile.artists || []).some(function (row) {
      return row.id === json(red).created.id;
    }), 'review profile drops immediately when it has no live/pending store release');

    const linkedDelete = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { action: 'delete', id: json(linked).created.id },
    }, linkedDelete);
    assert.strictEqual(linkedDelete.statusCode, 200);
    assert.ok(!(json(linkedDelete).profile.artists || []).some(function (row) {
      return row.id === json(linked).created.id;
    }));

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

  await withEnv({ DATABASE_URL: 'postgres://memory', SESSION_SECRET: 'unit-test-session-secret', memory: true }, async () => {
    assert.strictEqual(auth.SESSION_REMEMBER_TTL_SEC, 2592000);

    const keep = await accounts.createUser({
      email: 'keepin@example.com',
      password: 'password1',
      artist: 'Keep In',
    });
    await accounts.confirmEmail(keep.email);

    const shortLogin = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'keepin@example.com', password: 'password1' } }, shortLogin);
    assert.strictEqual(shortLogin.statusCode, 200);
    assert.ok(cookieFrom(shortLogin).indexOf('Max-Age=1800') !== -1);
    assert.ok(cookieFrom(shortLogin).indexOf('Max-Age=2592000') === -1);

    const rememberLogin = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'keepin@example.com', password: 'password1', remember: true } }, rememberLogin);
    assert.strictEqual(rememberLogin.statusCode, 200);
    assert.ok(cookieFrom(rememberLogin).indexOf('Max-Age=2592000') !== -1, 'checked keep-me-signed-in sets a 30-day cookie');
    const rememberCookie = cookieFrom(rememberLogin).split(';')[0];
    const rememberToken = rememberCookie.slice(rememberCookie.indexOf('=') + 1);
    assert.strictEqual(auth.verifySession(rememberToken).remember, true);

    const rememberMe = mockRes();
    await me({ method: 'GET', headers: { cookie: rememberCookie } }, rememberMe);
    assert.strictEqual(rememberMe.statusCode, 200);
    assert.ok(cookieFrom(rememberMe).indexOf('Max-Age=2592000') !== -1, 'GET /api/me keeps the 30-day TTL');

    const changer = await accounts.createUser({
      email: 'pwswap@example.com',
      password: 'oldpass12',
      artist: 'Swap',
    });
    await accounts.confirmEmail(changer.email);
    const changerLogin = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'pwswap@example.com', password: 'oldpass12' } }, changerLogin);
    const changerCookie = cookieFrom(changerLogin).split(';')[0];

    const unsigned = mockRes();
    await changePassword({ method: 'POST', headers: {}, body: { current_password: 'oldpass12', password: 'newpass12' } }, unsigned);
    assert.strictEqual(unsigned.statusCode, 401);

    const wrongCurrent = mockRes();
    await changePassword({
      method: 'POST',
      headers: { cookie: changerCookie },
      body: { current_password: 'nope1234', password: 'newpass12' },
    }, wrongCurrent);
    assert.strictEqual(wrongCurrent.statusCode, 401);
    assert.strictEqual(json(wrongCurrent).error, 'Current password is wrong.');
    const stillOld = await accounts.findByEmail('pwswap@example.com');
    assert.ok(auth.verifyPassword('oldpass12', stillOld.password_hash));

    const changed = mockRes();
    await changePassword({
      method: 'POST',
      headers: { cookie: changerCookie },
      body: { current_password: 'oldpass12', password: 'newpass12' },
    }, changed);
    assert.strictEqual(changed.statusCode, 200);
    const swapped = await accounts.findByEmail('pwswap@example.com');
    assert.ok(auth.verifyPassword('newpass12', swapped.password_hash));
    assert.ok(!auth.verifyPassword('oldpass12', swapped.password_hash));

    const relog = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'pwswap@example.com', password: 'newpass12' } }, relog);
    assert.strictEqual(relog.statusCode, 200);

    const doomed = await accounts.createUser({
      email: 'gone@example.com',
      password: 'password1',
      artist: 'Gone',
    });
    await accounts.confirmEmail(doomed.email);
    const doomedLogin = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'gone@example.com', password: 'password1' } }, doomedLogin);
    const doomedCookie = cookieFrom(doomedLogin).split(';')[0];

    const noConfirm = mockRes();
    await deleteAccount({ method: 'POST', headers: { cookie: doomedCookie }, body: {} }, noConfirm);
    assert.strictEqual(noConfirm.statusCode, 400);
    assert.strictEqual(json(noConfirm).error, 'Type DELETE to confirm.');
    assert.ok(await accounts.findByEmail('gone@example.com'));

    const deleted = mockRes();
    await deleteAccount({ method: 'POST', headers: { cookie: doomedCookie }, body: { confirm: 'DELETE' } }, deleted);
    assert.strictEqual(deleted.statusCode, 200);
    assert.ok(cookieFrom(deleted).indexOf('Max-Age=0') !== -1);
    assert.strictEqual(await accounts.findByEmail('gone@example.com'), null);

    const afterDelete = mockRes();
    await login({ method: 'POST', headers: {}, body: { email: 'gone@example.com', password: 'password1' } }, afterDelete);
    assert.strictEqual(afterDelete.statusCode, 401);

    const lockedEmails = [
      'victoriaimtanes@gmail.com',
      'realhealthiswealth@gmail.com',
      'emailplaiground@gmail.com',
    ];
    for (let i = 0; i < lockedEmails.length; i += 1) {
      const email = lockedEmails[i];
      const locked = await accounts.createUser({
        email: email,
        password: 'password1',
        artist: 'Locked ' + i,
      });
      await accounts.confirmEmail(locked.email);
      const lockedLogin = mockRes();
      await login({ method: 'POST', headers: {}, body: { email: email, password: 'password1' } }, lockedLogin);
      const lockedCookie = cookieFrom(lockedLogin).split(';')[0];
      const blocked = mockRes();
      await deleteAccount({ method: 'POST', headers: { cookie: lockedCookie }, body: { confirm: 'DELETE' } }, blocked);
      assert.strictEqual(blocked.statusCode, 403, email + ' must not be deleted');
      assert.ok(await accounts.findByEmail(email), email + ' stays in the users store');
    }
  });

  assert.strictEqual(auth.STAFF_PRO_EMAIL, 'emailplaiground@gmail.com');
  assert.strictEqual(auth.hasStaffProOverride('emailplaiground@gmail.com'), true);
  assert.strictEqual(auth.hasStaffProOverride('email.plaiground+lab@gmail.com'), true);
  assert.strictEqual(auth.hasStaffProOverride('emailplaiground@googlemail.com'), true);
  assert.strictEqual(auth.hasStaffProOverride('victoriaimtanes@gmail.com'), false);
  assert.strictEqual(auth.hasStaffProOverride('other@example.com'), false);
  assert.strictEqual(auth.normalizePaidPlan(null, 'emailplaiground@gmail.com'), 'pro');
  assert.strictEqual(auth.normalizePaidPlan('basic', 'email.plaiground@gmail.com'), 'pro');
  assert.strictEqual(auth.normalizePaidPlan('creator', 'victoriaimtanes@gmail.com'), 'creator');
  assert.strictEqual(auth.normalizePaidPlan(null, 'victoriaimtanes@gmail.com'), null);

  const staffMe = auth.publicUser({
    email: 'email.plaiground+qa@gmail.com',
    artist_name: 'Staff Pro',
    plan: 'basic',
    status: 'active',
    email_confirmed_at: new Date().toISOString(),
    tonegrid_release_ids: [],
    tonegrid_track_ids: [],
    stripe_session_id: null,
    stripe_customer_id: null,
    profile: { artists: [], releases: [] },
  });
  assert.strictEqual(staffMe.plan, 'pro', 'staff allowlist forces Pro on /api/me reads');
  assert.strictEqual(staffMe.stripe_session_id, null, 'staff Pro does not invent a Stripe session');
  assert.strictEqual(staffMe.upload.plan, 'pro');
  assert.strictEqual(staffMe.upload.limit, null);
  assert.strictEqual(staffMe.upload.album_allowed, true);

  const victoriaPublic = auth.publicUser({
    email: 'victoriaimtanes@gmail.com',
    artist_name: 'Fuvtu',
    plan: 'creator',
    status: 'active',
    email_confirmed_at: new Date().toISOString(),
    stripe_session_id: 'cs_live_victoria',
    profile: { artists: [], releases: [] },
  });
  assert.strictEqual(victoriaPublic.plan, 'creator', 'Victoria stays Creator via her stored plan');
  assert.strictEqual(victoriaPublic.stripe_session_id, 'cs_live_victoria');

  const strangerMe = auth.publicUser({
    email: 'stranger@example.com',
    artist_name: 'Stranger',
    plan: 'basic',
    status: 'active',
    email_confirmed_at: new Date().toISOString(),
    profile: { artists: [], releases: [] },
  });
  assert.strictEqual(strangerMe.plan, 'basic', 'no other email can self-upgrade');

  await withEnv({ DATABASE_URL: 'postgres://memory', SESSION_SECRET: 'unit-test-session-secret', CONFIRM_SECRET: 'unit-confirm-secret', memory: true }, async () => {
    assert.strictEqual(await accounts.findByEmail('emailplaiground@gmail.com'), null, 'do not invent a staff user row');

    const created = mockRes();
    await signup({
      method: 'POST',
      headers: {},
      body: { email: 'email.plaiground+lab@gmail.com', password: 'password1', artist: 'Staff Pro', plan: 'basic' },
    }, created);
    assert.strictEqual(created.statusCode, 200);
    assert.strictEqual(json(created).plan, 'basic', 'signup still stores the requested plan');
    assert.ok(cookieFrom(created).indexOf('plaiground_session=') === -1);

    const confirmed = mockRes();
    await confirm({ method: 'POST', headers: {}, body: { token: mail.signToken('email.plaiground+lab@gmail.com') } }, confirmed);
    assert.strictEqual(confirmed.statusCode, 200);
    const sessionCookie = cookieFrom(confirmed).split(';')[0];

    const stored = await accounts.findByEmail('emailplaiground@gmail.com');
    assert.ok(stored);
    assert.strictEqual(stored.email, 'email.plaiground+lab@gmail.com');
    assert.strictEqual(stored.plan, 'basic', 'override is a read, not a DB write');
    assert.strictEqual(stored.stripe_customer_id, null);
    assert.strictEqual(stored.stripe_session_id, null);

    const meRes = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, meRes);
    assert.strictEqual(meRes.statusCode, 200);
    const meBody = json(meRes);
    assert.strictEqual(meBody.plan, 'pro');
    assert.strictEqual(meBody.upload.plan, 'pro');
    assert.strictEqual(meBody.upload.limit, null);
    assert.strictEqual(meBody.upload.album_allowed, true);
    assert.strictEqual(meBody.stripe_session_id, null);

    const after = await accounts.findByEmail('emailplaiground@gmail.com');
    assert.strictEqual(after.plan, 'basic', 'GET /api/me must not persist Pro');
    assert.strictEqual(after.stripe_customer_id, null);
    assert.strictEqual(after.stripe_session_id, null);

    let recoveredStripe = false;
    const recovered = await recoverPaidPlan(after, async () => {
      recoveredStripe = true;
      return { id: 'cs_should_not_run', payment_status: 'paid', metadata: { plan: 'pro' } };
    });
    assert.strictEqual(recoveredStripe, false, 'staff override must not recover a Stripe subscription');
    assert.strictEqual(recovered.plan, 'basic');
    assert.strictEqual(recovered.stripe_session_id, null);

    const victoriaSignup = mockRes();
    await signup({
      method: 'POST',
      headers: {},
      body: { email: 'victoriaimtanes@gmail.com', password: 'password1', artist: 'Fuvtu', plan: 'creator' },
    }, victoriaSignup);
    assert.strictEqual(victoriaSignup.statusCode, 200);
    const victoriaConfirm = mockRes();
    await confirm({ method: 'POST', headers: {}, body: { token: mail.signToken('victoriaimtanes@gmail.com') } }, victoriaConfirm);
    const victoriaCookie = cookieFrom(victoriaConfirm).split(';')[0];
    const victoriaRow = await accounts.findByEmail('victoriaimtanes@gmail.com');
    const victoriaPaid = await accounts.updateStripe(victoriaRow.id, {
      plan: 'creator',
      sessionId: 'cs_live_victoria',
      customerId: 'cus_victoria',
    });
    assert.strictEqual(victoriaPaid.plan, 'creator');
    const victoriaMe = mockRes();
    await me({ method: 'GET', headers: { cookie: victoriaCookie } }, victoriaMe);
    assert.strictEqual(json(victoriaMe).plan, 'creator');
    assert.strictEqual(json(victoriaMe).email, 'victoriaimtanes@gmail.com');
    assert.strictEqual(json(victoriaMe).stripe_session_id, 'cs_live_victoria');
  });

  await withEnv({ DATABASE_URL: 'postgres://memory', SESSION_SECRET: 'unit-test-session-secret', CONFIRM_SECRET: 'unit-confirm-secret', memory: true }, async () => {
    const created = mockRes();
    await signup({
      method: 'POST',
      headers: {},
      body: { email: 'basic.artist@example.com', password: 'password1', artist: 'Fuvtu', plan: 'basic' },
    }, created);
    assert.strictEqual(created.statusCode, 200);
    const confirmed = mockRes();
    await confirm({ method: 'POST', headers: {}, body: { token: mail.signToken('basic.artist@example.com') } }, confirmed);
    const sessionCookie = cookieFrom(confirmed).split(';')[0];

    const made = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { action: 'create', name: 'Fuvtu' },
    }, made);
    assert.strictEqual(made.statusCode, 200);
    const artistId = json(made).created.id;

    const cataloged = mockRes();
    await catalog({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    }, cataloged);
    assert.strictEqual(cataloged.statusCode, 200);
    assert.strictEqual(json(cataloged).upload.allowed, false);
    assert.strictEqual(json(cataloged).upload.plan, 'basic');

    const pending = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'record_release',
        release: {
          title: 'Too the moon',
          plaiground_artist_id: artistId,
          tonegrid_status: 'pending',
          tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
      },
    }, pending);
    assert.strictEqual(pending.statusCode, 200);
    assert.strictEqual(json(pending).upload.allowed, false);

    const saved = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'artists',
        artist_action: 'update',
        id: artistId,
        name: 'Fuvtu',
        bio: 'basic pending still saves',
        photo: 'data:image/jpeg;base64,abc',
        ai_involvement_percent: 25,
        human_contributions: ['lyrics'],
      },
    }, saved);
    assert.strictEqual(saved.statusCode, 200);
    assert.ok(json(saved).updated, 'Basic update must return the saved artist');
    assert.strictEqual(json(saved).updated.bio, 'basic pending still saves');
    assert.strictEqual(json(saved).updated.ai_involvement_percent, 25);
    assert.deepStrictEqual(json(saved).updated.human_contributions, ['lyrics']);
    assert.notStrictEqual(json(saved).code, 'PLAN_LIMIT');

    const reload = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, reload);
    const again = (json(reload).profile.artists || []).find(function (row) {
      return row.id === artistId;
    });
    assert.ok(again, 'Basic artist must still be on GET /api/me after a pending release');
    assert.strictEqual(again.bio, 'basic pending still saves');
    assert.strictEqual(again.photo, 'data:image/jpeg;base64,abc');
    assert.strictEqual(again.ai_involvement_percent, 25);

    const afterLimit = mockRes();
    await meArtists({
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: {
        action: 'update',
        id: 'account',
        name: 'Fuvtu',
        bio: 'still saves at lifetime limit',
        ai_involvement_percent: 80,
      },
    }, afterLimit);
    assert.strictEqual(afterLimit.statusCode, 200);
    assert.strictEqual(json(afterLimit).updated.bio, 'still saves at lifetime limit');
    assert.strictEqual(json(afterLimit).updated.ai_involvement_percent, 80);
    const afterReload = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, afterReload);
    const kept = (json(afterReload).profile.artists || []).find(function (row) {
      return row.id === artistId;
    });
    assert.strictEqual(kept.bio, 'still saves at lifetime limit');
    assert.strictEqual(kept.ai_involvement_percent, 80);

    const rewriteGet = mockRes();
    await meApi({
      url: '/api/me?resource=artists',
      method: 'GET',
      headers: { cookie: sessionCookie },
    }, rewriteGet);
    assert.strictEqual(rewriteGet.statusCode, 200);
    const rewriteArtists = json(rewriteGet).profile && json(rewriteGet).profile.artists || [];
    assert.ok(rewriteArtists.find(function (row) { return row.id === artistId; }), 'GET /api/me after #154 rewrite must still return the stored artists');
    assert.notStrictEqual(rewriteArtists.length, 0);

    const wiped = await accounts.findByEmail('basic.artist@example.com');
    const wipedStored = require('./profile').readStored(wiped);
    await accounts.updateProfile(wiped.id, {
      artist: 'Victoria Reyes',
      profile: {
        photo: wipedStored.photo,
        genres: wipedStored.genres,
        specialties: wipedStored.specialties,
        artists: [],
        releases: (wipedStored.releases || []).map(function (rel) {
          return Object.assign({}, rel, { artist: 'Fuvtu', title: rel.title || 'Too the moon' });
        }),
      },
    });
    const recovered = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, recovered);
    const recoveredArtists = json(recovered).profile && json(recovered).profile.artists || [];
    assert.ok(recoveredArtists.length, 'Basic + pending Too the moon must recover the roster when artists[] was wiped');
    assert.ok(recoveredArtists.some(function (row) { return row.name === 'Fuvtu'; }), 'recover the last real artist, not a leftover name');
    assert.ok(!JSON.stringify(json(recovered).profile.artists).toLowerCase().includes('reyes'));

    const stillPending = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, stillPending);
    assert.ok((json(stillPending).profile.artists || []).some(function (row) {
      return row.name === 'Fuvtu';
    }), 'recovered Basic artist must still be on GET /api/me after reload');
  });

  await withEnv({ DATABASE_URL: 'postgres://memory', SESSION_SECRET: 'unit-test-session-secret', CONFIRM_SECRET: 'unit-confirm-secret', memory: true }, async () => {
    const created = mockRes();
    await signup({
      method: 'POST',
      headers: {},
      body: { email: 'empty.roster@example.com', password: 'password1', artist: 'Seeded Act', plan: 'basic' },
    }, created);
    const confirmed = mockRes();
    await confirm({ method: 'POST', headers: {}, body: { token: mail.signToken('empty.roster@example.com') } }, confirmed);
    const sessionCookie = cookieFrom(confirmed).split(';')[0];

    const seededGet = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, seededGet);
    assert.strictEqual((json(seededGet).profile.artists || [])[0].id, 'account', 'empty stored roster seeds the account id');

    const fromAccount = mockRes();
    await meApi({
      url: '/api/me?resource=artists',
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { action: 'create', artist_action: 'create', name: 'Second Act' },
    }, fromAccount);
    assert.strictEqual(fromAccount.statusCode, 200, 'Add artist must create when the page only has the seeded account id');
    assert.strictEqual(json(fromAccount).created.name, 'Second Act');
    assert.ok((json(fromAccount).profile.artists || []).some(function (row) {
      return row.name === 'Second Act';
    }));

    const emptyRow = await accounts.findByEmail('empty.roster@example.com');
    await accounts.updateProfile(emptyRow.id, {
      artist: 'John ham',
      profile: { photo: '', genres: [], specialties: [], artists: [], releases: [] },
    });
    const emptyGet = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, emptyGet);
    assert.strictEqual((json(emptyGet).profile.artists || []).length, 0, 'page can show an empty roster');

    const fromEmpty = mockRes();
    await meApi({
      url: '/api/me?resource=artists',
      method: 'POST',
      headers: { cookie: sessionCookie },
      body: { action: 'create', artist_action: 'create', name: 'Fresh Act' },
    }, fromEmpty);
    assert.strictEqual(fromEmpty.statusCode, 200, 'Add artist must create when the page shows empty');
    assert.strictEqual(json(fromEmpty).created.name, 'Fresh Act');
    const afterCreate = mockRes();
    await me({ method: 'GET', headers: { cookie: sessionCookie } }, afterCreate);
    assert.ok((json(afterCreate).profile.artists || []).some(function (row) {
      return row.name === 'Fresh Act';
    }), 'created artist must survive reload on Basic');
  });

  const { queryValue } = require('./route');
  assert.strictEqual(
    queryValue({ url: '/api/me?resource=artists' }, 'resource'),
    'artists',
    'Hobby rewrite query must be read from req.url when req.query is missing'
  );

  const leftoverMe = auth.publicUser({
    email: 'victoriaimtanes@gmail.com',
    artist_name: 'John ham',
    plan: 'creator',
    status: 'active',
    email_confirmed_at: new Date().toISOString(),
    tonegrid_release_ids: [],
    tonegrid_track_ids: [],
    profile: { artists: [], releases: [] },
  });
  assert.strictEqual(leftoverMe.artist, '', '/api/me must strip leftover John ham');
  assert.strictEqual((leftoverMe.profile.artists || []).length, 0, 'must not seed a leftover mock onto the roster');
  assert.ok(!JSON.stringify(leftoverMe).includes('John ham'));

  const leftoverRoster = auth.publicUser({
    email: 'victoriaimtanes@gmail.com',
    artist_name: 'John ham',
    plan: 'creator',
    status: 'active',
    email_confirmed_at: new Date().toISOString(),
    profile: { artists: [{ id: 'mock', name: 'John ham', badge: 'PLAIGROUND' }], releases: [] },
  });
  assert.strictEqual((leftoverRoster.profile.artists || []).length, 0, 'stored John ham roster must not reach /api/me');
  assert.ok(!JSON.stringify(leftoverRoster).includes('John ham'));

  const leftoverReyes = auth.publicUser({
    email: 'victoriaimtanes@gmail.com',
    artist_name: 'Victoria Reyes',
    plan: 'creator',
    status: 'active',
    email_confirmed_at: new Date().toISOString(),
    profile: { artists: [], releases: [] },
  });
  assert.strictEqual(leftoverReyes.artist, '', '/api/me must strip leftover Victoria Reyes');

  const recoveredFromPending = auth.publicUser({
    email: 'victoriaimtanes@gmail.com',
    artist_name: 'Victoria Reyes',
    plan: 'basic',
    status: 'active',
    email_confirmed_at: new Date().toISOString(),
    profile: {
      artists: [],
      releases: [{
        title: 'Too the moon',
        artist: 'Fuvtu',
        plaiground_artist_id: 'artist-keep',
        tonegrid_status: 'pending',
        tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }],
    },
  });
  assert.ok((recoveredFromPending.profile.artists || []).some(function (row) {
    return row.name === 'Fuvtu' && row.id === 'artist-keep';
  }), 'GET /api/me must rebuild the roster from a pending release when artists[] is empty');
  assert.ok(!JSON.stringify(recoveredFromPending).includes('Victoria Reyes'));

  const keptMe = auth.publicUser({
    email: 'victoriaimtanes@gmail.com',
    artist_name: 'Fuvtu',
    plan: 'creator',
    status: 'active',
    email_confirmed_at: new Date().toISOString(),
    profile: { artists: [], releases: [] },
  });
  assert.strictEqual(keptMe.artist, 'Fuvtu');
  assert.strictEqual(keptMe.profile.artists[0].name, 'Fuvtu');

  const realLegal = auth.publicUser({
    email: 'victoriaimtanes@gmail.com',
    artist_name: 'Victoria Imtanes',
    plan: 'creator',
    status: 'active',
    email_confirmed_at: new Date().toISOString(),
    profile: { artists: [], releases: [] },
  });
  assert.strictEqual(realLegal.artist, 'Victoria Imtanes', 'do not invent or strip a real stored name');

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
  const meSrc = fs.readFileSync(path.join(__dirname, '..', 'api', 'me.js'), 'utf8');
  assert.ok(meSrc.includes('Client-sent plan is ignored'), 'no public set-my-plan API');
  assert.ok(meSrc.includes('artistVerb'), 'artist route names must not be treated as update verbs');
  assert.ok(meSrc.includes('resolveArtist'), 'Basic seeded account ids must resolve to the real artist');
  assert.ok(!/\/api\/me\/plan|setPlan|set_plan/.test(meSrc), 'must not add a set-plan route');
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
  assert.ok(!/class="social-row"/.test(loginHtml), 'login has no Google/Apple social row');
  assert.ok(!/>\s*Google\s*</.test(loginHtml), 'login has no Google button');
  assert.ok(!/>\s*Apple\s*</.test(loginHtml), 'login has no Apple button');
  assert.ok(!/class="or"/.test(loginHtml), 'login drops the OR divider that only existed for social login');
  assert.ok(loginHtml.includes('id="keep-signed-in"'), 'Keep me signed in is a real checkbox');
  assert.ok(loginHtml.includes('remember: remember'), 'login posts the keep-me-signed-in choice');
  assert.ok(!signupHtml.includes('class="social-row"'), 'signup has no Google/Apple social row');
  assert.ok(!/>\s*Google\s*</.test(signupHtml), 'signup has no Google button');
  assert.ok(!/>\s*Apple\s*</.test(signupHtml), 'signup has no Apple button');

  const settingsHtml = fs.readFileSync(path.join(__dirname, '..', 'settings.html'), 'utf8');
  const accountJs = fs.readFileSync(path.join(__dirname, '..', 'account.js'), 'utf8');
  assert.ok(settingsHtml.includes('data-change-password'), 'Settings exposes Change password');
  assert.ok(settingsHtml.includes('id="current-password"'));
  assert.ok(settingsHtml.includes('id="new-password"'));
  assert.ok(accountJs.includes('/api/auth/password'));
  assert.ok(accountJs.includes('current_password'));
  assert.ok(accountJs.includes('Current password is wrong.'));
  assert.ok(settingsHtml.includes('data-delete-account'), 'Settings exposes Delete account');
  assert.ok(settingsHtml.includes('Type DELETE to confirm.'));
  assert.ok(accountJs.includes('/api/auth/delete'));
  assert.ok(accountJs.includes("confirm.toUpperCase() !== 'DELETE'"));

  console.log('accounts.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
