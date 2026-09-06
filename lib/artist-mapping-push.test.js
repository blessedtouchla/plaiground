'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const accounts = require('./accounts');
const auth = require('./auth');
const mappingPush = require('./artist-mapping-push');
const mail = require('./mail');
const profile = require('./profile');
const authApi = require('../api/auth');
const meApi = require('../api/me');
const tonegridApi = require('../api/tonegrid');

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(chunk) { this.body = chunk == null ? '' : String(chunk); },
  };
}

function json(res) {
  return JSON.parse(res.body || '{}');
}

function cookieFrom(res) {
  return String(res.headers['Set-Cookie'] || '');
}

async function run() {
  const empty = mappingPush.buildTonegridMappingFields({ name: 'Ada', platform_links: [] });
  assert.deepStrictEqual(empty, {}, 'no invented mapping fields');

  const spotify = mappingPush.buildTonegridMappingFields({
    name: 'Ada',
    platform_links: [{
      platform: 'spotify',
      url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg',
    }],
  });
  assert.strictEqual(spotify.spotify_url, 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(spotify.spotify_id, '0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(spotify.spotify_artist_id, '0TnOYISbd1XYRBk9myaseg');
  assert.ok(!spotify.apple_url, 'must not invent an Apple URL');

  const apple = mappingPush.buildTonegridMappingFields({
    name: 'Ada',
    platform_links: [{
      platform: 'apple-music',
      url: 'https://music.apple.com/us/artist/demo/123456789',
    }],
  });
  assert.strictEqual(apple.apple_url, 'https://music.apple.com/us/artist/demo/123456789');
  assert.strictEqual(apple.apple_music_url, 'https://music.apple.com/us/artist/demo/123456789');
  assert.strictEqual(apple.apple_id, '123456789');
  assert.strictEqual(apple.apple_artist_id, '123456789');
  assert.ok(!apple.spotify_url, 'must not invent a Spotify URL');

  const deezer = mappingPush.buildTonegridMappingFields({
    name: 'Ada',
    platform_links: [{
      platform: 'deezer',
      url: 'https://www.deezer.com/artist/42',
    }],
  });
  assert.strictEqual(deezer.deezer_url, 'https://www.deezer.com/artist/42');

  const fromLegacy = mappingPush.buildTonegridMappingFields({
    name: 'Ada',
    spotify_id: '0TnOYISbd1XYRBk9myaseg',
  });
  assert.strictEqual(fromLegacy.spotify_id, '0TnOYISbd1XYRBk9myaseg');
  assert.ok(fromLegacy.spotify_url.indexOf('0TnOYISbd1XYRBk9myaseg') !== -1);

  const store = {
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Ada',
    spotify_url: null,
    spotify_id: '',
    apple_url: 'https://music.apple.com/artist/keep',
  };
  const merged = mappingPush.pickIfNull(store, {
    spotify_url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg',
    spotify_id: '0TnOYISbd1XYRBk9myaseg',
    apple_url: 'https://music.apple.com/artist/new',
  });
  assert.strictEqual(merged.spotify_url, 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(merged.spotify_id, '0TnOYISbd1XYRBk9myaseg');
  assert.ok(!merged.apple_url, 'already-set Apple URL must stay');

  const roster = mappingPush.artistFromRoster({
    artists: [{
      id: 'pg-ada',
      name: 'Ada Night',
      platform_links: [{
        platform: 'spotify',
        url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg',
      }],
    }],
  }, {
    plaiground_artist_id: 'pg-ada',
    spotify_id: '',
    apple_id: '',
    store_url: '',
  });
  assert.strictEqual(roster.platform_links[0].platform, 'spotify');
  assert.ok(roster.spotify_id === '' || roster.platform_links[0].url, 'empty body DSP ids must not wipe saved profile URLs');

  const storeClient = fs.readFileSync(path.join(__dirname, '..', 'store-client.js'), 'utf8');
  assert.ok(storeClient.includes('function catalogArtistMapping'));
  assert.ok(storeClient.includes('function mergeCatalogArtistMapping'));
  assert.ok(storeClient.includes('catalogArtistMapping(current)'));
  assert.ok(storeClient.includes('mergeCatalogArtistMapping(draft)'));
  const meSrc = fs.readFileSync(path.join(__dirname, '..', 'api', 'me.js'), 'utf8');
  assert.ok(meSrc.includes('pushSavedArtistMapping'));
  assert.ok(meSrc.includes("action === 'update'"));
  const tgSrc = fs.readFileSync(path.join(__dirname, '..', 'api', 'tonegrid.js'), 'utf8');
  assert.ok(tgSrc.includes('mergeLinkedArtistMapping'));
  assert.ok(!/legal_first|genre|language|performer|producer/.test(
    tgSrc.slice(tgSrc.indexOf('async function mergeLinkedArtistMapping'), tgSrc.indexOf('async function listStoreArtistPages'))
  ), 'mapping merge must not rewrite create-artist, genre, language, or credits');

  assert.strictEqual(mappingPush.hasMappingFields({}), false);
  assert.strictEqual(mappingPush.hasMappingFields({ spotify_url: '' }), false);
  assert.strictEqual(mappingPush.hasMappingFields({ spotify_url: 'https://open.spotify.com/artist/1' }), true);

  const prev = {
    db: process.env.DATABASE_URL,
    secret: process.env.SESSION_SECRET,
    confirm: process.env.CONFIRM_SECRET,
    key: process.env.TONEGRID_API_KEY,
    base: process.env.TONEGRID_BASE_URL,
  };
  process.env.DATABASE_URL = 'postgres://memory';
  process.env.SESSION_SECRET = 'unit-test-session-secret';
  process.env.CONFIRM_SECRET = 'unit-confirm-secret';
  process.env.TONEGRID_API_KEY = 'test-key-value-not-for-commit';
  process.env.TONEGRID_BASE_URL = 'https://api-sandbox.tonegrid.pro/api';
  accounts.useMemoryStore();
  const originalFetch = global.fetch;
  const calls = [];
  const storeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const errors = [];
  const originalError = console.error;
  console.error = function () { errors.push(Array.prototype.slice.call(arguments)); };
  global.fetch = async function mockFetch(url, options) {
    const method = String((options && options.method) || 'GET').toUpperCase();
    calls.push({ url: String(url), method: method, body: options && options.body });
    if (method === 'PATCH' && String(url).indexOf('/artists/' + storeId) !== -1) {
      const sent = JSON.parse((options && options.body) || '{}');
      return { ok: true, status: 200, json: async () => Object.assign({ uuid: storeId }, sent) };
    }
    if (method === 'PUT' && String(url).indexOf('/artists/' + storeId) !== -1) {
      throw new Error('profile save must PATCH the store artist, not PUT first');
    }
    throw new Error('unexpected store call ' + method + ' ' + String(url));
  };
  try {
    const created = mockRes();
    await authApi(Object.assign({ url: '/api/auth/signup' }, {
      method: 'POST',
      headers: {},
      body: { email: 'map@example.com', password: 'password1', artist: 'Map Act' },
    }), created);
    assert.strictEqual(created.statusCode, 200);
    await authApi(Object.assign({ url: '/api/auth/confirm' }, {
      method: 'POST',
      headers: {},
      body: { token: mail.signToken('map@example.com') },
    }), mockRes());
    const loginRes = mockRes();
    await authApi(Object.assign({ url: '/api/auth/login' }, {
      method: 'POST',
      headers: {},
      body: { email: 'map@example.com', password: 'password1' },
    }), loginRes);
    const cookie = cookieFrom(loginRes).split(';')[0];
    const minted = mockRes();
    await meApi(Object.assign({ url: '/api/me/artists' }, {
      method: 'POST',
      headers: { cookie: cookie },
      body: { action: 'create', name: 'Map Act', legal_first: 'Ada', legal_last: 'Night' },
    }), minted);
    assert.strictEqual(minted.statusCode, 200, minted.body);
    const artistId = json(minted).created.id;
    const attached = mockRes();
    await meApi(Object.assign({ url: '/api/me/artists' }, {
      method: 'POST',
      headers: { cookie: cookie },
      body: { action: 'attach_tonegrid', id: artistId, tonegrid_artist_id: storeId },
    }), attached);
    assert.strictEqual(attached.statusCode, 200, attached.body);
    const saved = mockRes();
    await meApi(Object.assign({ url: '/api/me/artists' }, {
      method: 'POST',
      headers: { cookie: cookie },
      body: {
        action: 'update',
        id: artistId,
        platform_links: [{
          platform: 'spotify',
          url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg',
        }],
      },
    }), saved);
    assert.strictEqual(saved.statusCode, 200, saved.body);
    assert.strictEqual(json(saved).updated.spotify_id, '0TnOYISbd1XYRBk9myaseg');
    const patches = calls.filter((call) => call.method === 'PATCH' && String(call.url).indexOf('/artists/' + storeId) !== -1);
    assert.ok(patches.length >= 1, 'Artist Profile save must PATCH the linked store artist');
    const sent = JSON.parse(patches[patches.length - 1].body || '{}');
    assert.strictEqual(sent.spotify_url, 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg');
    assert.strictEqual(sent.spotify_id, '0TnOYISbd1XYRBk9myaseg');
    assert.ok(!sent.apple_url, 'must not invent an Apple URL');

    global.fetch = async function failFetch(url, options) {
      calls.push({ url: String(url), method: String((options && options.method) || 'GET').toUpperCase() });
      return { ok: false, status: 500, json: async () => ({ error: 'store mapping refused' }) };
    };
    const failed = mockRes();
    await meApi(Object.assign({ url: '/api/me/artists' }, {
      method: 'POST',
      headers: { cookie: cookie },
      body: {
        action: 'update',
        id: artistId,
        platform_links: [{
          platform: 'spotify',
          url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg',
        }],
      },
    }), failed);
    assert.strictEqual(failed.statusCode, 502);
    assert.strictEqual(json(failed).mapping_error, true);
    assert.ok(json(failed).updated, 'local save still returns the updated artist');
    assert.ok(errors.some((row) => String(row[0]).indexOf('ToneGrid artist mapping PATCH failed') !== -1), 'PATCH failure must log loudly');
  } finally {
    console.error = originalError;
    accounts.resetStore();
    if (originalFetch === undefined) delete global.fetch;
    else global.fetch = originalFetch;
    if (prev.db === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev.db;
    if (prev.secret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prev.secret;
    if (prev.confirm === undefined) delete process.env.CONFIRM_SECRET;
    else process.env.CONFIRM_SECRET = prev.confirm;
    if (prev.key === undefined) delete process.env.TONEGRID_API_KEY;
    else process.env.TONEGRID_API_KEY = prev.key;
    if (prev.base === undefined) delete process.env.TONEGRID_BASE_URL;
    else process.env.TONEGRID_BASE_URL = prev.base;
  }

  process.env.DATABASE_URL = 'postgres://memory';
  process.env.SESSION_SECRET = 'unit-test-session-secret';
  process.env.TONEGRID_API_KEY = 'test-key-value-not-for-commit';
  process.env.TONEGRID_BASE_URL = 'https://api-sandbox.tonegrid.pro/api';
  accounts.useMemoryStore();
  const continueId = '04c74127-11a8-40cf-beec-d1ffa16abd70';
  const continueCalls = [];
  const continueFetch = global.fetch;
  global.fetch = async function mockContinue(url, options) {
    const method = String((options && options.method) || 'GET').toUpperCase();
    continueCalls.push({ url: String(url), method: method, body: options && options.body });
    if (method === 'GET' && String(url).indexOf('/artists/' + continueId) !== -1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          uuid: continueId,
          name: 'VEXA',
          spotify_url: null,
          spotify_id: null,
          apple_url: null,
          apple_id: '',
        }),
      };
    }
    if ((method === 'PATCH' || method === 'PUT') && String(url).indexOf('/artists/' + continueId) !== -1) {
      return { ok: true, status: 200, json: async () => ({ uuid: continueId }) };
    }
    if (method === 'POST' && /\/artists$/.test(String(url))) {
      throw new Error('mapping merge must not POST a second artist');
    }
    throw new Error('unexpected store call ' + method + ' ' + String(url));
  };
  try {
    const user = await accounts.createUser({
      email: 'vexa-map-artist@example.com',
      password: 'password1',
      artist: 'VEXA',
      plan: 'creator',
    });
    let row = await accounts.confirmEmail(user.email);
    row = await accounts.updateCatalog(row.id, { artistId: continueId, replaceArtistId: true });
    const stored = profile.recoverRoster(profile.readStored(row), row.artist_name, row.tonegrid_artist_id);
    const localId = stored.artists[0].id;
    await accounts.updateProfile(row.id, {
      profile: profile.upsertArtist(stored, Object.assign({}, stored.artists[0], {
        legal_first: 'Ada',
        legal_last: 'Night',
        platform_links: [{
          platform: 'spotify',
          url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg',
        }],
      })),
    });
    const headers = { cookie: auth.COOKIE + '=' + auth.signSession(row.id) };
    const res = mockRes();
    await tonegridApi(Object.assign({ url: '/api/tonegrid/artists' }, {
      method: 'POST',
      headers,
      body: { name: 'VEXA', plaiground_artist_id: localId },
    }), res);
    assert.strictEqual(res.statusCode, 200, res.body);
    assert.strictEqual(json(res).uuid, continueId);
    assert.strictEqual(json(res).continued, true);
    const patches = continueCalls.filter((call) => (
      (call.method === 'PATCH' || call.method === 'PUT')
      && String(call.url).indexOf('/artists/' + continueId) !== -1
    ));
    assert.ok(patches.length >= 1, 'first-link continue must merge saved mapping URLs onto the store artist');
    const sent = JSON.parse(patches[0].body || '{}');
    assert.strictEqual(sent.spotify_url, 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg');
    assert.strictEqual(sent.spotify_id, '0TnOYISbd1XYRBk9myaseg');
    assert.ok(!sent.apple_url, 'must not invent an Apple URL');
  } finally {
    accounts.resetStore();
    if (continueFetch === undefined) delete global.fetch;
    else global.fetch = continueFetch;
    if (prev.db === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev.db;
    if (prev.secret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prev.secret;
    if (prev.key === undefined) delete process.env.TONEGRID_API_KEY;
    else process.env.TONEGRID_API_KEY = prev.key;
    if (prev.base === undefined) delete process.env.TONEGRID_BASE_URL;
    else process.env.TONEGRID_BASE_URL = prev.base;
  }

  console.log('lib/artist-mapping-push.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
