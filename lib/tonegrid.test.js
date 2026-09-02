'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const tonegrid = require('./tonegrid');
const accounts = require('./accounts');
const auth = require('./auth');
const plans = require('./plans');
const profile = require('./profile');
const tonegridApi = require('../api/tonegrid');
const audioChunks = require('./audio-chunks');
const audioConvert = require('./audio-convert');
const releaseCredits = require('./release-credits');

const TEST_WRITER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function writerIdFromBody(data) {
  if (!data || typeof data !== 'object') return '';
  const candidates = [
    data.uuid,
    data.writer_uuid,
    data.writer && data.writer.uuid,
    data.data && data.data.uuid,
    data.data && data.data.writer && data.data.writer.uuid,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const id = String(candidates[i] || '').trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return id;
  }
  return '';
}

function wrapFetchForCredits(inner) {
  if (typeof inner !== 'function' || inner._creditWrap) return inner;
  async function wrapped(url, options) {
    const result = await inner(url, options);
    const path = String(url);
    const method = String((options && options.method) || 'GET').toUpperCase();
    const isWriterPost = method === 'POST' && /\/writers(?:\?|$)/.test(path) && path.indexOf('/tracks/') === -1;
    if (!isWriterPost || !result || !result.ok) return result;
    let data = null;
    try {
      data = result.json ? await result.json() : null;
    } catch (err) {
      data = null;
    }
    if (writerIdFromBody(data)) {
      return { ok: true, status: result.status, json: async () => data };
    }
    return {
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { uuid: TEST_WRITER_ID } }),
    };
  }
  wrapped._creditWrap = true;
  return wrapped;
}

function releaseCreateCalls(calls) {
  return calls.filter((call) => {
    const url = String(call.url);
    const method = String(call.method || (call.options && call.options.method) || 'GET').toUpperCase();
    return method === 'POST' && /\/releases$/.test(url);
  });
}

function trackCreateCalls(calls) {
  return calls.filter((call) => {
    const url = String(call.url);
    const method = String(call.method || (call.options && call.options.method) || 'GET').toUpperCase();
    return method === 'POST' && /\/releases\/[^/]+\/tracks$/.test(url);
  });
}

function creditFollowupResponse(url, options) {
  const path = String(url);
  const method = String((options && options.method) || 'GET').toUpperCase();
  const allowed = (
    (method === 'PATCH' && /\/releases\/[0-9a-f-]{36}$/i.test(path))
    || (method === 'PUT' && /\/rights$/.test(path))
    || (method === 'POST' && /\/writers$/.test(path) && path.indexOf('/tracks/') === -1)
    || (method === 'PUT' && /\/tracks\/[^/]+\/writers$/.test(path))
  );
  if (!allowed) return null;
  return { ok: true, status: 200, json: async () => ({}) };
}

function health(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/health' }, req), res);
}
function officialStores(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/stores' }, req), res);
}
function artists(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/artists' }, req), res);
}
function releases(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/releases' }, req), res);
}
function tracks(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/tracks' }, req), res);
}
function trackAudio(req, res) {
  const id = req && req.query && req.query.id;
  const fallback = id
    ? '/api/tonegrid/tracks/' + id + '/audio'
    : '/api/tonegrid/tracks/audio';
  return tonegridApi(Object.assign({ url: fallback }, req), res);
}
function analytics(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/analytics' }, req), res);
}
function royalties(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/royalties' }, req), res);
}
function submitRelease(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/releases/' + req.id + '/submit' }, req), res);
}
function releaseArtwork(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/releases/' + req.id + '/artwork' }, req), res);
}
function oneRelease(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/releases/' + req.id, method: req.method }, req), res);
}
function storeWebhook(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/webhook', method: req.method || 'POST' }, req), res);
}
function updateTrack(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/tracks/' + req.id, method: req.method }, req), res);
}
function uploads(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/uploads', method: req.method }, req), res);
}

function mockRes() {
  const res = {
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
  return res;
}

function json(res) {
  return JSON.parse(res.body || '{}');
}

function storeHopBody(options) {
  const body = options && options.body;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body && body.byteLength != null) return Buffer.from(body);
  return Buffer.alloc(0);
}

function assertStoreAudioForward(options, extra) {
  const opts = extra || {};
  const body = storeHopBody(options);
  const type = String((options && options.headers && options.headers['Content-Type']) || '');
  const head = body.slice(0, 500).toString('latin1');
  assert.ok(body.length, 'store hop must send audio bytes');
  assert.match(type, /multipart\/form-data/i, 'store hop must be multipart');
  assert.doesNotMatch(type, /application\/json/i, 'store hop must not be JSON');
  assert.match(head, /name="audio"/, 'store hop field must be audio');
  if (opts.filename) assert.match(head, new RegExp('filename="' + opts.filename + '"', 'i'));
  if (opts.mime) assert.match(head, new RegExp('Content-Type:\\s*' + opts.mime, 'i'));
  if (opts.bytes) assert.ok(body.indexOf(opts.bytes) !== -1, 'store hop must include the audio file');
  assert.strictEqual(String(options.headers['Content-Length']), String(body.length), 'store hop must declare Content-Length so the file is actually sent');
}

async function withAccountUser(attrs, fn) {
  const prevDb = process.env.DATABASE_URL;
  const prevSecret = process.env.SESSION_SECRET;
  process.env.DATABASE_URL = 'postgres://memory';
  process.env.SESSION_SECRET = 'tonegrid-test-session-secret';
  accounts.useMemoryStore();
  const created = await accounts.createUser({
    email: (attrs && attrs.email) || 'ada@example.com',
    password: 'password1',
    artist: (attrs && attrs.artist) || 'Ada Night',
    plan: (attrs && attrs.plan) || 'basic',
  });
  let row = created;
  if (!attrs || attrs.confirmed !== false) {
    row = await accounts.confirmEmail(created.email);
  }
  if (attrs && attrs.releases) {
    row = await accounts.setReleaseHistory(row.id, attrs.releases);
  } else if (attrs && (attrs.artistId || attrs.releaseId || attrs.trackId)) {
    row = await accounts.updateCatalog(row.id, {
      artistId: attrs.artistId,
      releaseId: attrs.releaseId,
      trackId: attrs.trackId,
    });
  }
  if (!attrs || attrs.noLegal !== true) {
    const stored = profile.recoverRoster(
      profile.readStored(row),
      row.artist_name,
      (attrs && attrs.artistId) || row.tonegrid_artist_id
    );
    const current = (stored.artists && stored.artists[0]) || {};
    const next = profile.upsertArtist(stored, Object.assign({}, current, {
      name: current.name || row.artist_name || 'Ada Night',
      legal_first: (attrs && attrs.legalFirst) || 'Ada',
      legal_last: (attrs && attrs.legalLast) || 'Night',
      tonegrid_artist_id: (attrs && attrs.artistId) || current.tonegrid_artist_id || '',
    }));
    row = await accounts.updateProfile(row.id, { profile: next });
  }
  const reqHeaders = { cookie: auth.COOKIE + '=' + auth.signSession(row.id) };
  const prevFetch = global.fetch;
  if (typeof prevFetch === 'function') global.fetch = wrapFetchForCredits(prevFetch);
  try {
    await fn(row, reqHeaders);
  } finally {
    if (prevFetch === undefined) delete global.fetch;
    else global.fetch = prevFetch;
    audioChunks.resetForTests();
    accounts.resetStore();
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
  }
}

async function withEnv(env, fn) {
  const prevKey = process.env.TONEGRID_API_KEY;
  const prevBase = process.env.TONEGRID_BASE_URL;
  if (env.key === undefined) delete process.env.TONEGRID_API_KEY;
  else process.env.TONEGRID_API_KEY = env.key;
  if (env.base === undefined) delete process.env.TONEGRID_BASE_URL;
  else process.env.TONEGRID_BASE_URL = env.base;
  try {
    await fn();
  } finally {
    if (prevKey === undefined) delete process.env.TONEGRID_API_KEY;
    else process.env.TONEGRID_API_KEY = prevKey;
    if (prevBase === undefined) delete process.env.TONEGRID_BASE_URL;
    else process.env.TONEGRID_BASE_URL = prevBase;
  }
}

function hopKeyOf(call) {
  const headers = (call && (call.headers || (call.options && call.options.headers))) || {};
  return String(headers['Idempotency-Key'] || '');
}

async function run() {
  const clientSubmitKey = 'plaiground-submit-11111111-1111-4111-8111-111111111111';
  const datePath = '/releases/11111111-1111-4111-8111-111111111111';
  const dateKey = tonegrid.hopIdempotencyKey('patch-date', 'PATCH', datePath, '2026-09-12');
  const dspsKey = tonegrid.hopIdempotencyKey('dsps-post', 'POST', datePath + '/dsps', 'spotify,youtube-music');
  const submitHopKey = tonegrid.hopIdempotencyKey('submit', 'POST', datePath + '/submit', '11111111-1111-4111-8111-111111111111');
  assert.notStrictEqual(dateKey, clientSubmitKey);
  assert.notStrictEqual(dspsKey, clientSubmitKey);
  assert.notStrictEqual(submitHopKey, clientSubmitKey);
  assert.notStrictEqual(dateKey, dspsKey);
  assert.notStrictEqual(dspsKey, submitHopKey);
  assert.notStrictEqual(dateKey, submitHopKey);
  assert.ok(dateKey.startsWith('plaiground-patch-date-'));
  assert.ok(dspsKey.startsWith('plaiground-dsps-post-'));
  assert.ok(submitHopKey.startsWith('plaiground-submit-'));
  assert.strictEqual(dateKey, tonegrid.hopIdempotencyKey('patch-date', 'PATCH', datePath, '2026-09-12'));
  assert.notStrictEqual(dateKey, tonegrid.hopIdempotencyKey('patch-date', 'PATCH', datePath, '2026-10-01'));
  assert.notStrictEqual(
    tonegrid.idempotencyKey({ headers: { 'idempotency-key': clientSubmitKey } }, 'release-date'),
    clientSubmitKey
  );
  const reusedCopy = 'Idempotency-Key reused with a different request body. Either send the exact same body, or rotate the key.';
  assert.strictEqual(tonegrid.isIdempotencyReuseError(reusedCopy), true);
  assert.strictEqual(tonegrid.tonegridErrorMessage({ error: reusedCopy }), 'We could not finish this step.');
  assert.strictEqual(tonegrid.isArtistGoneError('artist not found in this tenant'), true);
  assert.strictEqual(
    tonegrid.tonegridErrorMessage({ error: 'artist not found in this tenant' }),
    'We could not create that artist. Try the name again.'
  );
  assert.ok(!/tenant|tonegrid/i.test(tonegrid.tonegridErrorMessage({ error: 'artist not found in this tenant' })));
  assert.ok(!/Idempotency-Key|request body|rotate the key/i.test(tonegrid.tonegridErrorMessage({ error: reusedCopy })));
  assert.strictEqual(
    tonegrid.tonegridErrorMessage({
      error: 'Validation failed',
      errors: { slug: ['The slug has already been taken.'] },
    }),
    'The slug has already been taken.'
  );
  const sameReleaseBody = JSON.stringify({ artist_id: '11111111-1111-4111-8111-111111111111', title: 'Night Drive', type: 'single', genre: 'Pop' });
  const amharicReleaseBody = JSON.stringify({ artist_id: '11111111-1111-4111-8111-111111111111', title: 'Night Drive', type: 'single', genre: 'African Dancehall', language: 'am' });
  const leftoverReleaseKey = 'plaiground-release-11111111-1111-4111-8111-111111111111:Night Drive';
  assert.notStrictEqual(
    tonegrid.hopIdempotencyKey('release', 'POST', '/releases', [sameReleaseBody, leftoverReleaseKey].join('\n')),
    tonegrid.hopIdempotencyKey('release', 'POST', '/releases', [amharicReleaseBody, leftoverReleaseKey].join('\n')),
    'leftover release key plus a new body must mint a new hop key'
  );
  const leftoverTrackKey = 'plaiground-track-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1';
  assert.notStrictEqual(
    tonegrid.hopIdempotencyKey('track', 'POST', '/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/tracks', [JSON.stringify({ title: 'Night Drive', position: 1, explicit: false }), leftoverTrackKey].join('\n')),
    tonegrid.hopIdempotencyKey('track', 'POST', '/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/tracks', [JSON.stringify({ title: 'Night Drive', position: 1, explicit: false, language: 'am' }), leftoverTrackKey].join('\n')),
    'leftover track key plus a new body must mint a new hop key'
  );

  await withEnv({ key: undefined, base: undefined }, async () => {
    assert.strictEqual(tonegrid.isConfigured(), false);
    const res = mockRes();
    await health({ method: 'GET', headers: {} }, res);
    assert.strictEqual(res.statusCode, 503);
    const body = json(res);
    assert.strictEqual(body.configured, false);
    assert.strictEqual(body.sandbox, false);
    assert.ok(body.error);
    assert.ok(!JSON.stringify(body).includes('Bearer'));
  });

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      assert.strictEqual(tonegrid.isConfigured(), true);
      assert.strictEqual(tonegrid.isSandboxBase(), true);
      const res = mockRes();
      await health({ method: 'GET', headers: {} }, res);
      assert.strictEqual(res.statusCode, 200);
      const body = json(res);
      assert.deepStrictEqual(body, { configured: true, sandbox: true });
      assert.ok(!JSON.stringify(body).includes(process.env.TONEGRID_API_KEY));
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://example.invalid/api' },
    async () => {
      const res = mockRes();
      await health({ method: 'GET', headers: {} }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(json(res), { configured: true, sandbox: false });
    }
  );

  const pageOne = [];
  const pageTwo = [];
  for (let i = 0; i < 55; i += 1) pageOne.push({ slug: 'store-' + i, name: 'Store ' + i });
  for (let i = 55; i < 87; i += 1) pageTwo.push({ slug: 'store-' + i, name: 'Store ' + i });
  assert.strictEqual(tonegrid.parseStoreSlugs({ data: { dsps: pageOne } }).length, 55);
  assert.strictEqual(tonegrid.parseStoreRows({ data: { stores: pageTwo } }).length, 32);
  assert.strictEqual(tonegrid.parseStoreListMeta({ meta: { total: 87, current_page: 1, last_page: 2, per_page: 55 } }).total, 87);
  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url) {
        const target = String(url);
        calls.push(target);
        if (target.indexOf('/supply-chain/dsps') === -1) {
          return { ok: false, status: 404, json: async () => ({ error: 'Endpoint not found.' }) };
        }
        const page = /[?&]page=2(?:&|$)/.test(target) ? 2 : 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { dsps: page === 1 ? pageOne : pageTwo },
            meta: { total: 87, current_page: page, last_page: 2, per_page: 55 },
          }),
        };
      };
      try {
        const res = mockRes();
        await officialStores({ method: 'GET', headers: {} }, res);
        assert.strictEqual(res.statusCode, 200);
        const body = json(res);
        assert.strictEqual(body.source, 'tonegrid');
        assert.strictEqual(body.stores.length, 87, 'store catalog must walk every live page, not stop at 55');
        assert.strictEqual(body.stores[0].name, 'Store 0');
        assert.strictEqual(body.stores[86].slug, 'store-86');
        assert.ok(calls.some((url) => /per_page=100/.test(url)), 'first hop asks for a full page');
        assert.ok(calls.some((url) => /page=2/.test(url)), 'second page of the live catalog is fetched');
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  assert.strictEqual(tonegrid.deriveSlug('Victoria Reyes'), 'victoria-reyes');
  assert.strictEqual(tonegrid.deriveSlug('  Neon   Shadows!! '), 'neon-shadows');
  assert.strictEqual(tonegrid.normalizeCountry('us'), 'US');
  assert.strictEqual(tonegrid.normalizeCountry('United States'), null);
  assert.strictEqual(tonegrid.normalizeReleaseDate('09/12/2026'), '2026-09-12');
  assert.strictEqual(tonegrid.normalizeReleaseDate('2026-09-12'), '2026-09-12');
  assert.strictEqual(tonegrid.normalizeReleaseType('Single'), 'single');

  const stripped = tonegrid.stripAuthorization({
    Accept: 'application/json',
    Authorization: 'Bearer should-never-log',
    'Content-Type': 'application/json',
  });
  assert.strictEqual(stripped.Authorization, undefined);
  assert.strictEqual(stripped.Accept, 'application/json');

  await withEnv({ key: undefined, base: undefined }, async () => {
    const artistRes = mockRes();
    await artists({ method: 'GET', headers: {}, query: {} }, artistRes);
    assert.strictEqual(artistRes.statusCode, 503);
    assert.strictEqual(json(artistRes).configured, false);

    const releaseRes = mockRes();
    await releases({ method: 'POST', headers: {}, body: { title: 'x' } }, releaseRes);
    assert.strictEqual(releaseRes.statusCode, 503);

    const trackRes = mockRes();
    await tracks({ method: 'POST', headers: {}, body: { release_id: '11111111-1111-4111-8111-111111111111', title: 'x' } }, trackRes);
    assert.strictEqual(trackRes.statusCode, 503);
    assert.strictEqual(json(trackRes).error, 'Catalog sync is not configured yet.');

    const audioRes = mockRes();
    await trackAudio({
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=xx' },
      query: { id: '11111111-1111-4111-8111-111111111111' },
      body: Buffer.from('audio'),
    }, audioRes);
    assert.strictEqual(audioRes.statusCode, 503);
    assert.ok(!audioRes.body.includes('Bearer'));
  });

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const unsigned = mockRes();
      await releases({
        method: 'POST',
        headers: {},
        body: { title: 'Neon Shadows', type: 'single', release_date: '2026-09-12', genre: 'Electronic' },
      }, unsigned);
      assert.strictEqual(unsigned.statusCode, 503);
      assert.strictEqual(json(unsigned).error, 'Accounts are not configured.');

      await withAccountUser({}, async (_row, headers) => {
        const req = new EventEmitter();
        req.method = 'POST';
        req.headers = headers;
        req.body = { title: 'Neon Shadows', type: 'single', release_date: '2026-09-12', genre: 'Electronic' };
        const res = mockRes();
        await releases(req, res);
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(json(res).error, 'artist_id is required.');
      });
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        return {
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { uuid: '22222222-2222-4222-8222-222222222222', title: 'Night Drive' } }),
        };
      };
      try {
        await withAccountUser({}, async (row, headers) => {
          const missingGenre = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              language: 'en',
              price: '$0.99',
            },
          }, missingGenre);
          assert.strictEqual(missingGenre.statusCode, 400);
          assert.strictEqual(json(missingGenre).error, 'genre is required.');

          const fakeGenre = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              genre: 'Not A Real Genre',
              language: 'en',
              price: '$0.99',
            },
          }, fakeGenre);
          assert.strictEqual(fakeGenre.statusCode, 400);
          assert.strictEqual(json(fakeGenre).error, 'genre must be a listed genre.');

          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, res);
          assert.strictEqual(res.statusCode, 201);
          const created = releaseCreateCalls(calls);
          assert.strictEqual(created.length, 1);
          const sent = JSON.parse(created[0].options.body);
          assert.strictEqual(sent.title, 'Night Drive');
          assert.strictEqual(sent.type, 'single');
          assert.strictEqual(sent.genre, 'Pop');
          assert.strictEqual(sent.language, 'en');
          assert.strictEqual(sent.price, undefined);
          assert.strictEqual(sent.release_date, undefined);
          assert.strictEqual(sent.instrumental, undefined);
          assert.strictEqual(sent.label, 'PLAIGROUND');
          assert.strictEqual(sent.copyright_holder, 'Ada Night');
          assert.strictEqual(sent.copyright_year, undefined);
          const stored = await accounts.findById(row.id);
          assert.deepStrictEqual(stored.tonegrid_release_ids, ['22222222-2222-4222-8222-222222222222']);
          assert.strictEqual(stored.tonegrid_release_at.length, 1);
          const credited = (profile.readStored(stored).releases || []).find((item) => {
            return item.tonegrid_release_id === '22222222-2222-4222-8222-222222222222';
          });
          assert.ok(credited);
          assert.strictEqual(credited.label, 'PLAIGROUND');
          assert.strictEqual(credited.rights_owner, 'Ada Night');
          assert.strictEqual(credited.master_owner, 'Ada Night');
        });

        await withAccountUser({ email: 'dated-credits@example.com' }, async (_row, headers) => {
          calls.length = 0;
          const dated = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
              release_date: '2026-09-12',
            },
          }, dated);
          assert.strictEqual(dated.statusCode, 201);
          const datedSent = JSON.parse(releaseCreateCalls(calls)[0].options.body);
          assert.strictEqual(datedSent.copyright_year, 2026);
          assert.strictEqual(datedSent.label, 'PLAIGROUND');
          assert.strictEqual(datedSent.copyright_holder, 'Ada Night');
          assert.strictEqual(datedSent.master_owner, 'Ada Night');
          assert.strictEqual(datedSent.rights_owner, 'Ada Night');
          const rightsCall = calls.find((call) => /\/rights$/.test(String(call.url)) && String((call.options && call.options.method) || '') === 'PUT');
          assert.ok(rightsCall, 'create with a street date must PUT the documented rights envelope');
          const rightsBody = JSON.parse(rightsCall.options.body);
          assert.strictEqual(rightsBody.p_line, '(P) 2026 Ada Night');
          assert.strictEqual(rightsBody.c_line, '(C) 2026 Ada Night');
          assert.strictEqual(rightsBody.copyright_year, 2026);
          assert.strictEqual(rightsBody.copyright_holder, 'Ada Night');
          assert.strictEqual(rightsBody.master_owner, 'Ada Night');
        });

        await withAccountUser({ email: 'typed-label@example.com' }, async (_row, headers) => {
          calls.length = 0;
          const typed = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
              label: 'Night Records',
              copyright_holder: 'Jane Doe',
              master_owner: 'Ada Night',
              copyright_year: 2026,
              release_date: '2026-09-12',
            },
          }, typed);
          assert.strictEqual(typed.statusCode, 201);
          const typedSent = JSON.parse(releaseCreateCalls(calls)[0].options.body);
          assert.strictEqual(typedSent.label, 'Night Records');
          assert.strictEqual(typedSent.copyright_holder, 'Jane Doe');
          assert.strictEqual(typedSent.master_owner, 'Ada Night');
          assert.strictEqual(typedSent.c_line, '(C) 2026 Jane Doe');
          assert.strictEqual(typedSent.p_line, '(P) 2026 Ada Night');
          assert.ok(String(typedSent.c_line).indexOf('PLAIGROUND') === -1);
          assert.ok(String(typedSent.p_line).indexOf('PLAIGROUND') === -1);
          const typedRights = calls.find((call) => /\/rights$/.test(String(call.url)) && String((call.options && call.options.method) || '') === 'PUT');
          assert.ok(typedRights);
          const typedRightsBody = JSON.parse(typedRights.options.body);
          assert.strictEqual(typedRightsBody.c_line, '(C) 2026 Jane Doe');
          assert.strictEqual(typedRightsBody.p_line, '(P) 2026 Ada Night');
          assert.strictEqual(typedRightsBody.copyright_holder, 'Jane Doe');
          assert.strictEqual(typedRightsBody.master_owner, 'Ada Night');
        });

        await withAccountUser({ email: 'nolegal@example.com', noLegal: true }, async (_row, headers) => {
          const missing = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              language: 'en',
            },
          }, missing);
          assert.strictEqual(missing.statusCode, 400);
          assert.strictEqual(json(missing).error, releaseCredits.WRITER_LINE);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        if (path.indexOf('/releases/22222222-2222-4222-8222-222222222222') !== -1 && (!options || !options.method || options.method === 'GET')) {
          return { ok: false, status: 404, json: async () => ({ error: 'release not found' }) };
        }
        return {
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { uuid: '33333333-3333-4333-8333-333333333333', title: 'Night Drive' } }),
        };
      };
      try {
        await withAccountUser({
          email: 'stale-release@example.com',
          plan: 'basic',
          artistId: '11111111-1111-4111-8111-111111111111',
          releaseId: '22222222-2222-4222-8222-222222222222',
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers: Object.assign({}, headers, {
              'Idempotency-Key': 'plaiground-release-11111111-1111-4111-8111-111111111111:Night Drive:1770000000000',
            }),
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
              replace_release_id: '22222222-2222-4222-8222-222222222222',
            },
          }, res);
          assert.strictEqual(res.statusCode, 201);
          assert.strictEqual(json(res).data.uuid, '33333333-3333-4333-8333-333333333333');
          assert.ok(!json(res).continued);
          assert.ok(calls.some((call) => String(call.url) === 'https://api-sandbox.tonegrid.pro/api/releases' && call.options.method === 'POST'));
          const stored = await accounts.findById(row.id);
          assert.deepStrictEqual(stored.tonegrid_release_ids, ['33333333-3333-4333-8333-333333333333']);
          assert.ok(!stored.tonegrid_release_ids.includes('22222222-2222-4222-8222-222222222222'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        if (path.indexOf('/releases/22222222-2222-4222-8222-222222222222') !== -1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ uuid: '22222222-2222-4222-8222-222222222222', title: 'Night Drive', status: 'draft' }),
          };
        }
        throw new Error('must not POST a second release when GET succeeds');
      };
      try {
        await withAccountUser({
          email: 'live-release@example.com',
          plan: 'basic',
          artistId: '11111111-1111-4111-8111-111111111111',
          releaseId: '22222222-2222-4222-8222-222222222222',
        }, async (_row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, '22222222-2222-4222-8222-222222222222');
          assert.strictEqual(json(res).continued, true);
          assert.ok(!calls.some((call) => call.options && call.options.method === 'POST'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (path.indexOf('/releases/22222222-2222-4222-8222-222222222222') !== -1 && method === 'GET') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ uuid: '22222222-2222-4222-8222-222222222222', title: 'Night Drive', status: 'draft' }),
          };
        }
        if (method === 'POST' && path === 'https://api-sandbox.tonegrid.pro/api/releases') {
          return {
            ok: true,
            status: 201,
            json: async () => ({ success: true, data: { uuid: '33333333-3333-4333-8333-333333333333', title: 'Night Drive' } }),
          };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'replace-still-live@example.com',
          plan: 'creator',
          artistId: '11111111-1111-4111-8111-111111111111',
          releaseId: '22222222-2222-4222-8222-222222222222',
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
              replace_release_id: '22222222-2222-4222-8222-222222222222',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, '22222222-2222-4222-8222-222222222222');
          assert.strictEqual(json(res).continued, true);
          assert.ok(!calls.some((call) => call.options && call.options.method === 'POST'));
          const stored = await accounts.findById(row.id);
          assert.deepStrictEqual(stored.tonegrid_release_ids, ['22222222-2222-4222-8222-222222222222']);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (path.indexOf('/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') !== -1 && method === 'GET') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              title: 'Old Single',
              status: 'draft',
            }),
          };
        }
        if (method === 'POST' && path === 'https://api-sandbox.tonegrid.pro/api/releases') {
          return {
            ok: true,
            status: 201,
            json: async () => ({ success: true, data: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'New Single' } }),
          };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'creator-new-title@example.com',
          plan: 'creator',
          artistId: '11111111-1111-4111-8111-111111111111',
          releaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'New Single',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, res);
          assert.strictEqual(res.statusCode, 201);
          assert.strictEqual(json(res).data.uuid, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
          assert.ok(!json(res).continued);
          assert.ok(calls.some((call) => String(call.url) === 'https://api-sandbox.tonegrid.pro/api/releases' && call.options.method === 'POST'));
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_release_ids.includes('cccccccc-cccc-4ccc-8ccc-cccccccccccc'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const unowned = '22222222-2222-4222-8222-222222222222';
      const catalogId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (path.indexOf('/releases/' + unowned) !== -1 && method === 'GET') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ uuid: unowned, title: 'Night Drive', status: 'draft' }),
          };
        }
        if (path.indexOf('/releases/' + catalogId) !== -1 && method === 'GET') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ uuid: catalogId, title: 'Other Song', status: 'draft' }),
          };
        }
        if (method === 'POST' && path === 'https://api-sandbox.tonegrid.pro/api/releases') {
          return {
            ok: true,
            status: 201,
            json: async () => ({ success: true, data: { uuid: '33333333-3333-4333-8333-333333333333', title: 'Night Drive' } }),
          };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'unowned-replace@example.com',
          plan: 'creator',
          artistId: '11111111-1111-4111-8111-111111111111',
          releaseId: catalogId,
        }, async (_row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
              replace_release_id: unowned,
            },
          }, res);
          assert.strictEqual(res.statusCode, 201);
          assert.strictEqual(json(res).data.uuid, '33333333-3333-4333-8333-333333333333');
          assert.ok(!json(res).continued);
          assert.ok(calls.some((call) => String(call.url) === 'https://api-sandbox.tonegrid.pro/api/releases' && call.options.method === 'POST'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (path.indexOf('/releases/22222222-2222-4222-8222-222222222222') !== -1 && method === 'GET') {
          return { ok: false, status: 503, json: async () => ({ error: 'upstream unavailable' }) };
        }
        if (method === 'POST' && path === 'https://api-sandbox.tonegrid.pro/api/releases') {
          return {
            ok: true,
            status: 201,
            json: async () => ({ success: true, data: { uuid: '33333333-3333-4333-8333-333333333333', title: 'Night Drive' } }),
          };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'exists-5xx@example.com',
          plan: 'creator',
          artistId: '11111111-1111-4111-8111-111111111111',
          releaseId: '22222222-2222-4222-8222-222222222222',
        }, async (_row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, res);
          assert.strictEqual(res.statusCode, 201);
          assert.ok(!json(res).continued);
          assert.ok(calls.some((call) => String(call.url) === 'https://api-sandbox.tonegrid.pro/api/releases' && call.options.method === 'POST'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = '99999999-9999-4999-8999-999999999999';
      const created = '33333333-3333-4333-8333-333333333333';
      const lightning = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const dolly = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const metete = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const cgi = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const vhnjuk = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const otherSongs = [
        { uuid: lightning, title: 'Lightning', status: 'draft', artist_id: artistId },
        { uuid: dolly, title: 'Thank You, Dolly', status: 'draft', artist_id: artistId },
        { uuid: metete, title: 'Metete en el groove', status: 'pending', artist_id: artistId },
        { uuid: cgi, title: 'Cgi', status: 'draft', artist_id: artistId },
        { uuid: vhnjuk, title: 'vhnjuk', status: 'draft', artist_id: artistId },
      ];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          const alreadyPosted = calls.filter((call) => {
            const u = String(call.url).split('?')[0];
            return String((call.options && call.options.method) || 'GET').toUpperCase() === 'POST' && /\/releases$/.test(u);
          }).length;
          if (alreadyPosted === 1) {
            return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
          }
          return { ok: true, status: 201, json: async () => ({ success: true, data: { uuid: created, title: 'The recording.' } }) };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: otherSongs.concat([{ uuid: leftover, title: 'The recording.', status: 'draft', artist_id: artistId }]),
              total: 6,
              page: 1,
              per_page: 100,
            }),
          };
        }
        if (method === 'DELETE' && path.indexOf('/releases/' + leftover) !== -1) {
          return { ok: true, status: 204, json: async () => { throw new Error('empty'); } };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'collide-delete@example.com',
          plan: 'creator',
          artistId: artistId,
          releases: [lightning, dolly, metete, cgi, vhnjuk],
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              title: 'The recording.',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true);
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'), 'attach owned leftover, do not delete first');
          assert.ok(!calls.some((call) => {
            const u = String(call.url);
            const m = String((call.options && call.options.method) || '');
            return m === 'DELETE' && (u.includes(lightning) || u.includes(dolly) || u.includes(metete) || u.includes(cgi) || u.includes(vhnjuk));
          }));
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_release_ids.includes(leftover));
          assert.ok(!stored.tonegrid_release_ids.includes(created));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = '99999999-9999-4999-8999-999999999999';
      const lightning = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                { uuid: lightning, title: 'Lightning', status: 'draft', artist_id: artistId },
                { uuid: leftover, title: 'The recording.', status: 'draft', artist_id: artistId },
              ],
              total: 2,
              page: 1,
              per_page: 100,
            }),
          };
        }
        if (method === 'DELETE' && path.indexOf('/releases/' + leftover) !== -1) {
          return { ok: false, status: 409, json: async () => ({ error: 'Only draft or rejected releases can be deleted.' }) };
        }
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ uuid: leftover, title: 'The recording.', status: 'draft', artist_id: artistId }),
          };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'collide-continue@example.com',
          plan: 'creator',
          artistId: artistId,
          releases: [lightning],
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              title: 'The recording.',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true);
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'), 'attach before delete');
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_release_ids.includes(leftover));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const lightning = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const dolly = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                { uuid: lightning, title: 'Lightning', status: 'draft', artist_id: artistId },
                { uuid: dolly, title: 'Thank You, Dolly', status: 'draft', artist_id: artistId },
              ],
              total: 2,
              page: 1,
              per_page: 100,
            }),
          };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete other songs ' + path);
        }
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'collide-other-songs@example.com',
          plan: 'creator',
          artistId: artistId,
          releases: [lightning, dolly],
        }, async (_row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              title: 'The recording.',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, res);
          assert.strictEqual(res.statusCode, 409);
          assert.strictEqual(json(res).error, 'A record with these details already exists.');
          assert.ok(!json(res).continued);
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = '99999999-9999-4999-8999-999999999999';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ uuid: leftover, title: 'The recording.', status: 'pending', artist_id: artistId }],
              total: 1,
              page: 1,
              per_page: 100,
            }),
          };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete a pending leftover ' + path);
        }
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'collide-pending@example.com',
          plan: 'creator',
          artistId: artistId,
        }, async (_row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              title: 'The recording.',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, res);
          assert.strictEqual(res.statusCode, 409);
          assert.strictEqual(json(res).error, 'A record with these details already exists.');
          assert.ok(!json(res).continued);
          assert.ok(!/ToneGrid|InterSpace|DistroKid/i.test(JSON.stringify(json(res))));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = '7a928125-b12e-4609-bd37-26ce0edf819e';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      const dolly = 'df51342b-ba22-4093-93ff-35b6402b61c0';
      const metete = '6629b532-2e78-4be6-84eb-e4dfa9ac33e5';
      const cgi = '490b789a-0a33-4372-9d81-665f47b3cbf1';
      const vhnjuk = 'c0102e1c-b62b-4dcf-9fe1-00d063df51a4';
      const catalogIds = [lightning, dolly, metete, cgi, vhnjuk];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          throw new Error('must attach leftover ' + leftover + ', not POST a second create');
        }
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              uuid: leftover,
              title: 'Rainbow Road',
              status: 'draft',
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              tracks: [],
            }),
          };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                { uuid: lightning, title: 'Lightning', status: 'needs_fix', artist_id: artistId },
                { uuid: dolly, title: 'Thank You, Dolly', status: 'needs_fix', artist_id: artistId },
                { uuid: metete, title: 'Metete en el groove', status: 'pending', artist_id: artistId },
                { uuid: cgi, title: 'Cgi', status: 'draft', artist_id: artistId },
                { uuid: vhnjuk, title: 'vhnjuk', status: 'draft', artist_id: artistId },
                { uuid: leftover, title: 'Rainbow Road', status: 'draft', artist_id: artistId, artist: 'Victoria PLAIGROUND' },
              ],
              total: 6,
              page: 1,
              per_page: 100,
            }),
          };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete catalog leftover when attach works ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'rainbow-owned-draft@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: catalogIds,
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              title: 'Rainbow Road',
              type: 'single',
              genre: 'Blues',
              language: 'en',
              price: '$0.99',
              audio_name: 'The recording.wav',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true, 'owned Rainbow Road draft is attached, not a 409');
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'POST' && /\/releases$/.test(String(call.url).split('?')[0])));
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'));
          catalogIds.forEach((id) => {
            assert.ok(!calls.some((call) => {
              const m = String((call.options && call.options.method) || '');
              return m === 'DELETE' && String(call.url).includes(id);
            }), 'must not delete protected ' + id);
          });
          const stored = await accounts.findById(row.id);
          catalogIds.forEach((id) => {
            assert.ok(stored.tonegrid_release_ids.includes(id), 'catalog id must stay ' + id);
          });
          assert.ok(stored.tonegrid_release_ids.includes(leftover), 'leftover uuid must be attached to the catalog');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = 'cefce28e-8020-435e-8097-177de07f0c44';
      const rainbow = '7a928125-b12e-4609-bd37-26ce0edf819e';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      const dolly = 'df51342b-ba22-4093-93ff-35b6402b61c0';
      const metete = '6629b532-2e78-4be6-84eb-e4dfa9ac33e5';
      const cgi = '490b789a-0a33-4372-9d81-665f47b3cbf1';
      const vhnjuk = 'c0102e1c-b62b-4dcf-9fe1-00d063df51a4';
      const catalogIds = [lightning, dolly, metete, cgi, vhnjuk];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          throw new Error('must attach leftover ' + leftover + ', not POST a second create');
        }
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              uuid: leftover,
              title: 'FUEGO GODDESS',
              status: 'draft',
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              tracks: [],
            }),
          };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                { uuid: lightning, title: 'Lightning', status: 'needs_fix', artist_id: artistId },
                { uuid: dolly, title: 'Thank You, Dolly', status: 'needs_fix', artist_id: artistId },
                { uuid: metete, title: 'Metete en el groove', status: 'pending', artist_id: artistId },
                { uuid: cgi, title: 'Cgi', status: 'draft', artist_id: artistId },
                { uuid: vhnjuk, title: 'vhnjuk', status: 'draft', artist_id: artistId },
                { uuid: leftover, title: 'FUEGO GODDESS', status: 'draft', artist_id: artistId, artist: 'Victoria PLAIGROUND' },
              ],
              total: 6,
              page: 1,
              per_page: 100,
            }),
          };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete catalog leftover when attach works ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'fuego-owned-draft@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: catalogIds,
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              title: 'FUEGO GODDESS',
              type: 'single',
              genre: 'Latin',
              language: 'es',
              price: '$0.99',
              audio_name: 'FUEGO GODDESS.wav',
              release_date: '2026-09-09',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true, 'owned FUEGO GODDESS draft is attached, not a 409');
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'POST' && /\/releases$/.test(String(call.url).split('?')[0])));
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'));
          assert.ok(!calls.some((call) => String(call.url).includes(rainbow)));
          catalogIds.forEach((id) => {
            assert.ok(!calls.some((call) => {
              const m = String((call.options && call.options.method) || '');
              return m === 'DELETE' && String(call.url).includes(id);
            }), 'must not delete protected ' + id);
          });
          const stored = await accounts.findById(row.id);
          catalogIds.forEach((id) => {
            assert.ok(stored.tonegrid_release_ids.includes(id), 'catalog id must stay ' + id);
          });
          assert.ok(stored.tonegrid_release_ids.includes(leftover), 'FUEGO leftover uuid must be attached to the catalog');
          assert.ok(!stored.tonegrid_release_ids.includes(rainbow));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = 'cefce28e-8020-435e-8097-177de07f0c44';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      let leftoverGets = 0;
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          leftoverGets += 1;
          if (leftoverGets === 1) {
            return { ok: false, status: 404, json: async () => ({ error: 'Release not found.' }) };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              uuid: leftover,
              title: 'FUEGO GODDESS',
              status: 'draft',
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              tracks: [],
            }),
          };
        }
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete owned FUEGO leftover ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'fuego-409-attach@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: [lightning],
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              title: 'FUEGO GODDESS',
              type: 'single',
              genre: 'Latin',
              language: 'es',
              price: '$0.99',
              audio_name: 'FUEGO GODDESS.wav',
              release_date: '2026-09-09',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true, '409 path attaches owned FUEGO draft');
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'));
          assert.ok(!/ToneGrid|InterSpace|DistroKid/i.test(JSON.stringify(json(res))));
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_release_ids.includes(leftover));
          assert.ok(stored.tonegrid_release_ids.includes(lightning));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = 'cefce28e-8020-435e-8097-177de07f0c44';
      const rainbow = '7a928125-b12e-4609-bd37-26ce0edf819e';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      const dolly = 'df51342b-ba22-4093-93ff-35b6402b61c0';
      const metete = '6629b532-2e78-4be6-84eb-e4dfa9ac33e5';
      const cgi = '490b789a-0a33-4372-9d81-665f47b3cbf1';
      const vhnjuk = 'c0102e1c-b62b-4dcf-9fe1-00d063df51a4';
      const catalogIds = [lightning, dolly, metete, cgi, vhnjuk];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          throw new Error('must attach leftover ' + leftover + ', not POST a second create');
        }
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              uuid: leftover,
              title: 'FUEGO GODDESS',
              status: 'draft',
              artist_id: 194,
              artist: 'Victoria PLAIGROUND',
              submitted_at: null,
              tracks: [],
            }),
          };
        }
        if (method === 'PATCH' && path.indexOf('/releases/' + leftover) !== -1) {
          return { ok: false, status: 500, json: async () => ({ error: 'could not attach credits' }) };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete catalog leftover when attach works ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'fuego-title-only-numeric@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: catalogIds,
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              artist: 'Ada Night',
              title: 'FUEGO GODDESS',
              type: 'single',
              genre: 'Flamenco',
              language: 'en',
              price: '$0.99',
              audio_name: 'FUEGO GODDESS.wav',
              release_date: '2026-09-09',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true, 'FUEGO title-only attach ignores artist name and numeric artist_id');
          assert.ok(!json(res).error || !/already exists/i.test(String(json(res).error)));
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'POST' && /\/releases$/.test(String(call.url).split('?')[0])));
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'));
          [leftover, rainbow].concat(catalogIds).forEach((id) => {
            assert.ok(!calls.some((call) => {
              const m = String((call.options && call.options.method) || '');
              return m === 'DELETE' && String(call.url).includes(id);
            }), 'must not delete ' + id);
          });
          const stored = await accounts.findById(row.id);
          catalogIds.forEach((id) => {
            assert.ok(stored.tonegrid_release_ids.includes(id), 'catalog id must stay ' + id);
          });
          assert.ok(stored.tonegrid_release_ids.includes(leftover));
          assert.ok(!stored.tonegrid_release_ids.includes(rainbow));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = 'cefce28e-8020-435e-8097-177de07f0c44';
      const rainbow = '7a928125-b12e-4609-bd37-26ce0edf819e';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      const dolly = 'df51342b-ba22-4093-93ff-35b6402b61c0';
      const metete = '6629b532-2e78-4be6-84eb-e4dfa9ac33e5';
      const catalogIds = [lightning, dolly, metete];
      let leftoverGets = 0;
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          leftoverGets += 1;
          if (leftoverGets === 1) {
            return { ok: false, status: 404, json: async () => ({ error: 'Release not found.' }) };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              uuid: leftover,
              title: 'FUEGO GODDESS',
              status: 'draft',
              artist_id: 194,
              artist: 'Victoria PLAIGROUND',
              submitted_at: null,
              tracks: [],
            }),
          };
        }
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [], total: 0, page: 1, per_page: 100 }),
          };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete owned FUEGO leftover ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'fuego-409-title-only@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: catalogIds,
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              artist: 'Ada Night',
              title: 'FUEGO GODDESS',
              type: 'single',
              genre: 'Flamenco',
              language: 'en',
              price: '$0.99',
              audio_name: 'FUEGO GODDESS.wav',
              release_date: '2026-09-09',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true, '409 still title-only continues FUEGO when collision match misses');
          assert.ok(!json(res).error, 'must never send RECORD_EXISTS_COPY for owned FUEGO uuid');
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'));
          [leftover, rainbow].concat(catalogIds).forEach((id) => {
            assert.ok(!calls.some((call) => {
              const m = String((call.options && call.options.method) || '');
              return m === 'DELETE' && String(call.url).includes(id);
            }), 'must not delete ' + id);
          });
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_release_ids.includes(leftover));
          catalogIds.forEach((id) => {
            assert.ok(stored.tonegrid_release_ids.includes(id));
          });
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const leftover = '7a928125-b12e-4609-bd37-26ce0edf819e';
      const artistId = '11111111-1111-4111-8111-111111111111';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      global.fetch = async function mockFetch(url, options) {
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              uuid: leftover,
              title: 'Rainbow Road',
              status: 'draft',
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              tracks: [],
            }),
          };
        }
        if (method === 'DELETE') throw new Error('must not delete leftover ' + path);
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({
          email: 'rainbow-get-leftover@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: [lightning],
        }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'GET', headers, id: leftover }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).title, 'Rainbow Road');
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_release_ids.includes(leftover), 'GET leftover must add the uuid to catalog');
          assert.ok(stored.tonegrid_release_ids.includes(lightning));
        });
        await withAccountUser({
          email: 'other-artist-leftover@example.com',
          artist: 'Ada Night',
          plan: 'creator',
          artistId: '22222222-2222-4222-8222-222222222222',
        }, async (_row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'GET', headers, id: leftover }, res);
          assert.strictEqual(res.statusCode, 404, 'other artist must not read the leftover');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const leftover = 'cefce28e-8020-435e-8097-177de07f0c44';
      const artistId = '11111111-1111-4111-8111-111111111111';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      global.fetch = async function mockFetch(url, options) {
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              uuid: leftover,
              title: 'FUEGO GODDESS',
              status: 'draft',
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              tracks: [],
            }),
          };
        }
        if (method === 'DELETE') throw new Error('must not delete leftover ' + path);
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({
          email: 'fuego-get-leftover@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: [lightning],
        }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'GET', headers, id: leftover }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).title, 'FUEGO GODDESS');
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_release_ids.includes(leftover), 'GET leftover must add the FUEGO uuid to catalog');
          assert.ok(stored.tonegrid_release_ids.includes(lightning));
        });
        await withAccountUser({
          email: 'other-artist-fuego@example.com',
          artist: 'Ada Night',
          plan: 'creator',
          artistId: '22222222-2222-4222-8222-222222222222',
        }, async (_row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'GET', headers, id: leftover }, res);
          assert.strictEqual(res.statusCode, 404, 'other artist must not read the FUEGO leftover');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = 'cefce28e-8020-435e-8097-177de07f0c44';
      const trackA = '1f346f71-a70d-4648-bb66-5c5aff5f5243';
      const trackB = '81e47b6f-6b13-44e6-a436-de81ffaa849f';
      const rainbow = '7a928125-b12e-4609-bd37-26ce0edf819e';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      const dolly = 'df51342b-ba22-4093-93ff-35b6402b61c0';
      const metete = '6629b532-2e78-4be6-84eb-e4dfa9ac33e5';
      const cgi = '490b789a-0a33-4372-9d81-665f47b3cbf1';
      const vhnjuk = 'c0102e1c-b62b-4dcf-9fe1-00d063df51a4';
      const catalogIds = [lightning, dolly, metete, cgi, vhnjuk];
      const leftoverTracks = [
        { uuid: trackB, title: 'FUEGO GODDESS', status: 'draft' },
        { uuid: trackA, title: 'FUEGO GODDESS', status: 'draft' },
      ];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          throw new Error('must attach leftover ' + leftover + ', not POST a second create');
        }
        if (method === 'POST' && /\/releases\/[^/]+\/tracks$/.test(path.split('?')[0])) {
          throw new Error('must reuse leftover tracks, not POST /tracks ' + path);
        }
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              uuid: leftover,
              title: 'FUEGO GODDESS',
              status: 'draft',
              artist_id: 194,
              artist: 'Victoria PLAIGROUND',
              submitted_at: null,
              tracks: leftoverTracks,
            }),
          };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete catalog leftover when attach works ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'fuego-leftover-two-tracks@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: catalogIds,
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              title: 'FUEGO GODDESS',
              type: 'single',
              genre: 'Latin',
              language: 'en',
              price: '$0.99',
              audio_name: 'FUEGO GODDESS.wav',
              release_date: '2026-09-09',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true, 'owned FUEGO leftover with tracks is attached, not a 409');
          assert.ok(Array.isArray(json(res).tracks), 'continue must return leftover tracks');
          assert.strictEqual(json(res).tracks.length, 2);
          assert.ok(json(res).tracks.some((track) => track.uuid === trackA));
          assert.ok(json(res).tracks.some((track) => track.uuid === trackB));
          assert.ok(!json(res).error, 'must never send RECORD_EXISTS_COPY for leftover with tracks');
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'POST' && /\/releases$/.test(String(call.url).split('?')[0])));
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'POST' && /\/releases\/[^/]+\/tracks$/.test(String(call.url).split('?')[0])));
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'));
          assert.ok(!calls.some((call) => String(call.url).includes(rainbow)));
          catalogIds.forEach((id) => {
            assert.ok(!calls.some((call) => {
              const m = String((call.options && call.options.method) || '');
              return m === 'DELETE' && String(call.url).includes(id);
            }), 'must not delete protected ' + id);
          });
          const stored = await accounts.findById(row.id);
          catalogIds.forEach((id) => {
            assert.ok(stored.tonegrid_release_ids.includes(id), 'catalog id must stay ' + id);
          });
          assert.ok(stored.tonegrid_release_ids.includes(leftover));

          const trackRes = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: leftover,
              title: 'FUEGO GODDESS',
              language: 'en',
            },
          }, trackRes);
          assert.strictEqual(trackRes.statusCode, 200);
          assert.strictEqual(json(trackRes).uuid, trackA, 'must reuse the preferred leftover track');
          assert.strictEqual(json(trackRes).continued, true);
          assert.ok(!json(trackRes).error);
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'POST' && /\/releases\/[^/]+\/tracks$/.test(String(call.url).split('?')[0])));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = 'cefce28e-8020-435e-8097-177de07f0c44';
      const fuegoTrackA = '1f346f71-a70d-4648-bb66-5c5aff5f5243';
      const fuegoTrackB = '81e47b6f-6b13-44e6-a436-de81ffaa849f';
      const minted = '33333333-3333-4333-8333-333333333333';
      const mintedTrack = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          return { ok: true, status: 201, json: async () => ({ uuid: minted, title: 'Night Drive' }) };
        }
        if (method === 'POST' && /\/releases\/[^/]+\/tracks$/.test(path.split('?')[0])) {
          return { ok: true, status: 201, json: async () => ({ track: { uuid: mintedTrack, title: 'Night Drive' } }) };
        }
        if (method === 'GET' && path.indexOf('/releases/' + minted) !== -1) {
          return { ok: true, status: 200, json: async () => ({ uuid: minted, title: 'Night Drive', status: 'draft', tracks: [] }) };
        }
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          throw new Error('different title must not continue leftover ' + leftover);
        }
        if (method === 'DELETE') {
          throw new Error('must not delete leftover for a different title ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'different-title-not-fuego@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: [lightning],
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
              audio_name: 'Night Drive.wav',
              release_date: '2026-09-12',
            },
          }, res);
          assert.strictEqual(res.statusCode, 201);
          assert.strictEqual(json(res).uuid, minted);
          assert.notStrictEqual(json(res).uuid, leftover);
          assert.ok(!json(res).continued);
          assert.ok(calls.some((call) => String((call.options && call.options.method) || '') === 'POST' && /\/releases$/.test(String(call.url).split('?')[0])));
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_release_ids.includes(minted));
          assert.ok(!stored.tonegrid_release_ids.includes(leftover));

          const trackRes = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: minted,
              title: 'Night Drive',
              language: 'en',
            },
          }, trackRes);
          assert.strictEqual(trackRes.statusCode, 201);
          assert.strictEqual(json(trackRes).track.uuid, mintedTrack);
          assert.ok(!json(trackRes).continued);
          assert.notStrictEqual(json(trackRes).track.uuid, fuegoTrackA);
          assert.notStrictEqual(json(trackRes).track.uuid, fuegoTrackB);
          assert.ok(trackCreateCalls(calls).length >= 1);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '04c74127-11a8-40cf-beec-d1ffa16abd70';
      const leftover = '0767cb74-c5aa-4b18-8023-729fd4fb2808';
      const leftoverTrack = 'afce23fb-aa5f-42ac-94ae-2ce58bf48402';
      const fuego = 'cefce28e-8020-435e-8097-177de07f0c44';
      const rainbow = '7a928125-b12e-4609-bd37-26ce0edf819e';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      const dolly = 'df51342b-ba22-4093-93ff-35b6402b61c0';
      const metete = '6629b532-2e78-4be6-84eb-e4dfa9ac33e5';
      const moon = '7544eade-ce02-472c-92d0-a5d61609999d';
      const catalogIds = [lightning, dolly, metete, moon];
      const leftoverRow = {
        uuid: leftover,
        title: 'I Set the Tone',
        status: 'draft',
        artist_id: 196,
        artist: 'VEXA',
        submitted_at: null,
        upc: null,
        language: 'en',
        release_date: '2026-09-10',
        tracks: [{ uuid: leftoverTrack, title: 'I Set the Tone', status: 'draft' }],
      };
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
        }
        if (method === 'POST' && /\/releases\/[^/]+\/tracks$/.test(path.split('?')[0])) {
          return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
        }
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          return { ok: true, status: 200, json: async () => leftoverRow };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                { uuid: lightning, title: 'Lightning', status: 'needs_fix', artist_id: artistId },
                { uuid: dolly, title: 'Thank You, Dolly', status: 'needs_fix', artist_id: artistId },
                leftoverRow,
              ],
              total: 3,
              page: 1,
              per_page: 100,
            }),
          };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete leftover ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'iset-the-tone-leftover@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: catalogIds,
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              title: 'I Set the Tone',
              type: 'single',
              genre: 'Funk',
              language: 'en',
              price: '$0.99',
              audio_name: 'I Set the Tone.wav',
              release_date: '2026-09-10',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true, 'I Set the Tone leftover attaches on title-only continue');
          assert.ok(Array.isArray(json(res).tracks));
          assert.ok(json(res).tracks.some((track) => track.uuid === leftoverTrack));
          assert.ok(!json(res).error || !/already exists/i.test(String(json(res).error)));
          assert.ok(!/ToneGrid|InterSpace|DistroKid/i.test(JSON.stringify(json(res))));
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'));
          [fuego, rainbow].concat(catalogIds).forEach((id) => {
            assert.ok(!calls.some((call) => {
              const m = String((call.options && call.options.method) || '');
              return m === 'DELETE' && String(call.url).includes(id);
            }), 'must not delete ' + id);
          });
          const stored = await accounts.findById(row.id);
          catalogIds.forEach((id) => {
            assert.ok(stored.tonegrid_release_ids.includes(id), 'catalog id must stay ' + id);
          });
          assert.ok(stored.tonegrid_release_ids.includes(leftover));
          assert.ok(!stored.tonegrid_release_ids.includes(fuego));

          const trackRes = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: leftover,
              title: 'I Set the Tone',
              language: 'en',
            },
          }, trackRes);
          assert.strictEqual(trackRes.statusCode, 200);
          assert.strictEqual(json(trackRes).uuid, leftoverTrack, 'must reuse leftover I Set the Tone track');
          assert.strictEqual(json(trackRes).continued, true);
          assert.ok(!json(trackRes).error);
          assert.ok(trackCreateCalls(calls).every((call) => {
            return String(call.url).indexOf(leftover) !== -1;
          }), 'track 409 must stay on leftover release');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '04c74127-11a8-40cf-beec-d1ffa16abd70';
      const leftover = '0767cb74-c5aa-4b18-8023-729fd4fb2808';
      const leftoverTrack = 'afce23fb-aa5f-42ac-94ae-2ce58bf48402';
      const fuego = 'cefce28e-8020-435e-8097-177de07f0c44';
      const rainbow = '7a928125-b12e-4609-bd37-26ce0edf819e';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      const leftoverRow = {
        uuid: leftover,
        title: 'I Set the Tone',
        status: 'draft',
        artist_id: 196,
        artist: 'VEXA',
        submitted_at: null,
        tracks: [{ uuid: leftoverTrack, title: 'I Set the Tone', status: 'draft' }],
      };
      let leftoverGets = 0;
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          leftoverGets += 1;
          if (leftoverGets === 1) {
            return { ok: false, status: 404, json: async () => ({ error: 'Release not found.' }) };
          }
          return { ok: true, status: 200, json: async () => leftoverRow };
        }
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ uuid: lightning, title: 'Lightning', status: 'needs_fix', artist_id: artistId }],
              total: 1,
              page: 1,
              per_page: 100,
            }),
          };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete leftover ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'iset-the-tone-409-title-only@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: [lightning],
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              title: 'I Set the Tone',
              type: 'single',
              genre: 'Funk',
              language: 'en',
              price: '$0.99',
              audio_name: 'I Set the Tone.wav',
              release_date: '2026-09-10',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true, '409 must title-only continue I Set the Tone, no artist fingerprint');
          assert.ok(!json(res).error || !/already exists/i.test(String(json(res).error)));
          assert.ok(!/ToneGrid|InterSpace|DistroKid/i.test(JSON.stringify(json(res))));
          assert.strictEqual(releaseCreateCalls(calls).length, 0, 'I Set the Tone must continue leftover, never POST create');
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'));
          [fuego, rainbow, leftover].forEach((id) => {
            assert.ok(!calls.some((call) => {
              const m = String((call.options && call.options.method) || '');
              return m === 'DELETE' && String(call.url).includes(id);
            }), 'must not delete ' + id);
          });
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_release_ids.includes(leftover));
          assert.ok(stored.tonegrid_release_ids.includes(lightning));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = '55555555-5555-4555-8555-555555555555';
      const leftoverTrack = '66666666-6666-4666-8666-666666666666';
      const fuego = 'cefce28e-8020-435e-8097-177de07f0c44';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      const leftoverRow = {
        uuid: leftover,
        title: 'Midnight Radio',
        status: 'draft',
        artist_id: 201,
        artist: 'VEXA',
        tracks: [{ uuid: leftoverTrack, title: 'Midnight Radio', status: 'draft' }],
      };
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
        }
        if (method === 'POST' && /\/releases\/[^/]+\/tracks$/.test(path.split('?')[0])) {
          return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
        }
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          return { ok: true, status: 200, json: async () => leftoverRow };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [leftoverRow, { uuid: lightning, title: 'Lightning', status: 'needs_fix', artist_id: artistId }],
              total: 2,
              page: 1,
              per_page: 100,
            }),
          };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete leftover ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'next-leftover-title@example.com',
          artist: 'Victoria PLAIGROUND',
          plan: 'creator',
          artistId: artistId,
          releases: [lightning],
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              artist: 'Victoria PLAIGROUND',
              title: 'Midnight Radio',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true, 'any owned leftover Draft attaches by title without a hardcoded row');
          assert.ok(json(res).tracks.some((track) => track.uuid === leftoverTrack));
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'));
          assert.ok(!calls.some((call) => String(call.url).includes(fuego)));
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_release_ids.includes(leftover));
          assert.ok(stored.tonegrid_release_ids.includes(lightning));

          const trackRes = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: leftover,
              title: 'Midnight Radio',
              language: 'en',
            },
          }, trackRes);
          assert.strictEqual(trackRes.statusCode, 200);
          assert.strictEqual(json(trackRes).uuid, leftoverTrack);
          assert.strictEqual(json(trackRes).continued, true);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const artistId = '11111111-1111-4111-8111-111111111111';
      const leftover = '7a928125-b12e-4609-bd37-26ce0edf819e';
      const created = '33333333-3333-4333-8333-333333333333';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      let leftoverGets = 0;
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          return { ok: false, status: 409, json: async () => ({ error: 'audio fingerprint already exists' }) };
        }
        if (method === 'GET' && path.indexOf('/releases/' + leftover) !== -1) {
          leftoverGets += 1;
          if (leftoverGets === 1) {
            return { ok: false, status: 404, json: async () => ({ error: 'Release not found.' }) };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ uuid: leftover, title: 'Rainbow Road', status: 'draft', artist_id: artistId, tracks: [] }),
          };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ uuid: lightning, title: 'Lightning', status: 'draft', artist_id: artistId }],
              total: 1,
              page: 1,
              per_page: 100,
            }),
          };
        }
        if (method === 'PATCH' && path.indexOf('/releases/' + leftover) !== -1) {
          return { ok: false, status: 500, json: async () => ({ error: 'could not attach credits' }) };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete leftover ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'attach-fail-delete@example.com',
          plan: 'creator',
          artistId: artistId,
          releases: [lightning],
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: artistId,
              title: 'Rainbow Road',
              type: 'single',
              genre: 'Blues',
              language: 'en',
              price: '$0.99',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true, '409 Rainbow Road attaches 7a928125, never a second create');
          assert.strictEqual(releaseCreateCalls(calls).length, 0, 'Rainbow Road must continue leftover, never POST create');
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'), 'must not delete Rainbow Road leftover');
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE' && String(call.url).includes(lightning)));
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_release_ids.includes(leftover));
          assert.ok(stored.tonegrid_release_ids.includes(lightning));
          assert.ok(!stored.tonegrid_release_ids.includes(created));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const imtanesArtist = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const vexaArtist = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const plaigroundArtist = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const vhnjuk = 'c0102e1c-b62b-4dcf-9fe1-00d063df51a4';
      const metete = '6629b532-2e78-4be6-84eb-e4dfa9ac33e5';
      const cgi = '490b789a-0a33-4372-9d81-665f47b3cbf1';
      const lightning = '1f26369b-e107-4c79-bde1-4c5382f9d511';
      const dolly = 'df51342b-ba22-4093-93ff-35b6402b61c0';
      const leftover = '99999999-9999-4999-8999-999999999999';
      const plaigroundSameTitle = '88888888-8888-4888-8888-888888888888';
      const created = '33333333-3333-4333-8333-333333333333';
      const catalogIds = [vhnjuk, metete, cgi, lightning, dolly];
      const storeRows = [
        { uuid: plaigroundSameTitle, title: 'The recording.', status: 'draft', artist_id: plaigroundArtist, artist: 'Victoria PLAIGROUND' },
        { uuid: vhnjuk, title: 'vhnjuk', status: 'draft', artist_id: plaigroundArtist, artist: 'Victoria PLAIGROUND' },
        { uuid: metete, title: 'Metete en el groove', status: 'pending', artist_id: vexaArtist, artist: 'VEXA' },
        { uuid: cgi, title: 'Cgi', status: 'draft', artist_id: vexaArtist, artist: 'VEXA' },
        { uuid: lightning, title: 'Lightning', status: 'needs_fix', artist_id: vexaArtist, artist: 'VEXA' },
        { uuid: dolly, title: 'Thank You, Dolly', status: 'needs_fix', artist_id: plaigroundArtist, artist: 'Victoria PLAIGROUND' },
        { uuid: leftover, title: 'The recording.', status: 'draft', artist_id: imtanesArtist, artist: 'Victoria Imtanes' },
      ];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/releases$/.test(path.split('?')[0])) {
          const alreadyPosted = calls.filter((call) => {
            const u = String(call.url).split('?')[0];
            return String((call.options && call.options.method) || 'GET').toUpperCase() === 'POST' && /\/releases$/.test(u);
          }).length;
          if (alreadyPosted === 1) {
            return { ok: false, status: 409, json: async () => ({ error: 'A record with these details already exists.' }) };
          }
          return { ok: true, status: 201, json: async () => ({ success: true, data: { uuid: created, title: 'The recording.' } }) };
        }
        if (method === 'GET' && /\/releases(\?|$)/.test(path) && !/\/releases\/[0-9a-f-]{36}/i.test(path)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: storeRows, total: storeRows.length, page: 1, per_page: 100 }),
          };
        }
        if (method === 'GET' && path.indexOf('/releases/' + lightning) !== -1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              uuid: lightning,
              title: 'Lightning',
              status: 'needs_fix',
              artist_id: vexaArtist,
              artist: 'VEXA',
              tracks: [{ uuid: '12121212-1212-4121-8121-121212121212', title: 'Lightning' }],
            }),
          };
        }
        if (method === 'DELETE' && path.indexOf('/releases/' + leftover) !== -1) {
          return { ok: true, status: 204, json: async () => { throw new Error('empty'); } };
        }
        if (method === 'DELETE') {
          throw new Error('must not delete catalog or other-artist leftover ' + path);
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + path);
      };
      try {
        await withAccountUser({
          email: 'victoriaimtanes@gmail.com',
          artist: 'Victoria Imtanes',
          plan: 'creator',
          artistId: imtanesArtist,
          releases: catalogIds,
        }, async (row, headers) => {
          const res = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: imtanesArtist,
              artist: 'Victoria Imtanes',
              title: 'The recording.',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
              release_id: lightning,
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, leftover);
          assert.strictEqual(json(res).continued, true, 'same-artist leftover is attached, not a second create');
          assert.ok(!calls.some((call) => String((call.options && call.options.method) || '') === 'DELETE'), 'attach preferred over delete');
          catalogIds.concat([plaigroundSameTitle]).forEach((id) => {
            assert.ok(!calls.some((call) => {
              const m = String((call.options && call.options.method) || '');
              return m === 'DELETE' && String(call.url).includes(id);
            }), 'must not delete ' + id);
            assert.ok(!calls.some((call) => {
              const m = String((call.options && call.options.method) || '');
              return m === 'PATCH' && String(call.url).includes('/releases/' + id);
            }), 'must not retitle catalog ' + id);
          });
          const stored = await accounts.findById(row.id);
          catalogIds.forEach((id) => {
            assert.ok(stored.tonegrid_release_ids.includes(id), 'catalog id must stay ' + id);
          });
          assert.ok(stored.tonegrid_release_ids.includes(leftover));
          assert.ok(!stored.tonegrid_release_ids.includes(created));
          assert.ok(!stored.tonegrid_release_ids.includes(plaigroundSameTitle));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        return {
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { uuid: '22222222-2222-4222-8222-222222222222', title: 'Night Drive' } }),
        };
      };
      try {
        await withAccountUser({ plan: 'creator', email: 'inst@example.com' }, async (_row, headers) => {
          const instRes = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              price: '$0.99',
              instrumental: true,
            },
          }, instRes);
          assert.strictEqual(instRes.statusCode, 201);
          const instSent = JSON.parse(calls[0].options.body);
          assert.strictEqual(instSent.genre, 'Pop');
          assert.strictEqual(instSent.language, undefined);
          assert.strictEqual(instSent.instrumental, undefined);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        if (String(url).indexOf('/tracks') !== -1) {
          const sent = JSON.parse((options && options.body) || '{}');
          const pos = sent.position || 1;
          const id = pos === 2
            ? '44444444-4444-4444-8444-444444444444'
            : '33333333-3333-4333-8333-333333333333';
          return { ok: true, status: 201, json: async () => ({ track: { uuid: id, title: sent.title, position: pos } }) };
        }
        return {
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { uuid: '22222222-2222-4222-8222-222222222222', title: 'Night Drive LP', type: 'album' } }),
        };
      };
      try {
        await withAccountUser({
          email: 'album-tracks@example.com',
          plan: 'creator',
        }, async (row, headers) => {
          const albumRes = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive LP',
              type: 'album',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, albumRes);
          assert.strictEqual(albumRes.statusCode, 201);
          const albumSent = JSON.parse(calls[0].options.body);
          assert.strictEqual(albumSent.type, 'album');
          assert.strictEqual(albumSent.title, 'Night Drive LP');

          const track1 = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'Intro',
              language: 'en',
              position: 1,
            },
          }, track1);
          const track2 = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'Outro',
              language: 'en',
              position: 2,
            },
          }, track2);
          assert.strictEqual(track1.statusCode, 201);
          assert.strictEqual(track2.statusCode, 201);
          assert.strictEqual(json(track1).track.uuid, '33333333-3333-4333-8333-333333333333');
          assert.strictEqual(json(track2).track.uuid, '44444444-4444-4444-8444-444444444444');
          const trackCalls = trackCreateCalls(calls);
          assert.strictEqual(trackCalls.length, 2);
          assert.strictEqual(JSON.parse(trackCalls[0].options.body).position, 1);
          assert.strictEqual(JSON.parse(trackCalls[1].options.body).position, 2);
          const stored = await accounts.findById(row.id);
          assert.ok(stored.tonegrid_track_ids.indexOf('33333333-3333-4333-8333-333333333333') !== -1);
          assert.ok(stored.tonegrid_track_ids.indexOf('44444444-4444-4444-8444-444444444444') !== -1);
          assert.strictEqual(stored.tonegrid_release_ids.length, 1, 'album is one release');
        });

        await withAccountUser({
          email: 'second-track@example.com',
          plan: 'creator',
          artistId: '11111111-1111-4111-8111-111111111111',
          releaseId: '22222222-2222-4222-8222-222222222222',
          trackId: '33333333-3333-4333-8333-333333333333',
        }, async (_row, headers) => {
          calls.length = 0;
          const continued = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              track_id: '33333333-3333-4333-8333-333333333333',
              title: 'Intro',
              language: 'en',
              position: 1,
            },
          }, continued);
          assert.strictEqual(continued.statusCode, 200);
          assert.strictEqual(json(continued).continued, true);
          assert.strictEqual(json(continued).uuid, '33333333-3333-4333-8333-333333333333');
          assert.strictEqual(trackCreateCalls(calls).length, 0);
          assert.ok(calls.some((call) => /\/writers$/.test(String(call.url)) && String((call.options && call.options.method) || 'POST') === 'POST'));

          const second = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'Outro',
              language: 'en',
              position: 2,
            },
          }, second);
          assert.strictEqual(second.statusCode, 201);
          const minted = trackCreateCalls(calls);
          assert.strictEqual(minted.length, 1);
          assert.strictEqual(JSON.parse(minted[0].options.body).position, 2);
          assert.strictEqual(json(second).track.uuid, '44444444-4444-4444-8444-444444444444');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        return {
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { uuid: '11111111-1111-4111-8111-111111111111', name: 'Victoria Reyes' } }),
        };
      };
      try {
        await withAccountUser({}, async (_row, headers) => {
          const res = mockRes();
          await artists({ method: 'POST', headers, body: { name: 'Victoria Reyes' } }, res);
          assert.strictEqual(res.statusCode, 201);
          assert.strictEqual(calls.length, 1);
          assert.strictEqual(calls[0].url, 'https://api-sandbox.tonegrid.pro/api/artists');
          assert.strictEqual(calls[0].options.method, 'POST');
          assert.ok(calls[0].options.headers.Authorization);
          assert.ok(calls[0].options.headers['Idempotency-Key']);
          assert.ok(!res.body.includes('test-key-value-not-for-commit'));
          assert.ok(!res.body.includes('Authorization'));
          const sent = JSON.parse(calls[0].options.body);
          assert.strictEqual(sent.name, 'Victoria Reyes');
          assert.strictEqual(sent.slug, 'victoria-reyes');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const leftover = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const liveId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const mintedId = '99999999-9999-4999-8999-999999999999';
      global.fetch = async function mockFetch(url, options) {
        const method = String((options && options.method) || 'GET').toUpperCase();
        calls.push({ url: String(url), method: method, options: options || {} });
        if (method === 'GET' && String(url).indexOf('/artists/' + leftover) !== -1) {
          return { ok: false, status: 404, json: async () => ({ error: 'artist not found in this tenant' }) };
        }
        if (method === 'POST' && /\/artists$/.test(String(url))) {
          const sent = JSON.parse((options && options.body) || '{}');
          if (sent.name === 'Leftover Act') {
            return { ok: true, status: 201, json: async () => ({ uuid: mintedId, name: 'Leftover Act', slug: 'leftover-act' }) };
          }
          return { ok: true, status: 201, json: async () => ({ uuid: liveId, name: 'Neon Nova' }) };
        }
        if (method === 'POST' && /\/releases$/.test(String(url))) {
          const sent = JSON.parse((options && options.body) || '{}');
          if (sent.artist_id === leftover) {
            return { ok: false, status: 404, json: async () => ({ error: 'artist not found in this tenant' }) };
          }
          return { ok: true, status: 201, json: async () => ({ uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }) };
        }
        return { ok: true, status: 200, json: async () => ({ uuid: leftover }) };
      };
      try {
        await withAccountUser({
          email: 'dead-artist@example.com',
          plan: 'creator',
          artist: 'Leftover Act',
          artistId: leftover,
        }, async (row, headers) => {
          await accounts.updateProfile(row.id, {
            artist: 'Leftover Act',
            profile: {
              artists: [{
                id: 'pg-leftover',
                name: 'Leftover Act',
                source: 'created',
                legal_first: 'Ada',
                legal_last: 'Night',
                tonegrid_artist_id: leftover,
              }],
            },
          });

          const created = mockRes();
          await artists({
            method: 'POST',
            headers,
            body: { name: 'Neon Nova', plaiground_artist_id: 'pg-new' },
          }, created);
          assert.strictEqual(created.statusCode, 201);
          assert.strictEqual(json(created).uuid, liveId);
          assert.ok(!json(created).continued);
          const artistPost = calls.filter((call) => call.method === 'POST' && /\/artists$/.test(call.url));
          assert.strictEqual(artistPost.length, 1);
          const sent = JSON.parse(artistPost[0].options.body);
          assert.strictEqual(sent.name, 'Neon Nova');
          assert.ok(!sent.artist_id);
          assert.ok(!sent.uuid);
          const stored = await accounts.findById(row.id);
          assert.strictEqual(stored.tonegrid_artist_id, liveId);
          assert.ok(!calls.some((call) => (
            call.method === 'GET' && String(call.url).indexOf('/artists/' + leftover) !== -1
          )), 'name-only create must not look up a leftover catalog artist id');

          const reusedDead = mockRes();
          await artists({
            method: 'POST',
            headers,
            body: { name: 'Leftover Act', plaiground_artist_id: 'pg-leftover' },
          }, reusedDead);
          assert.strictEqual(reusedDead.statusCode, 201);
          assert.strictEqual(json(reusedDead).uuid, mintedId);
          assert.ok(!json(reusedDead).error);
          assert.ok(!/could not create that artist/i.test(reusedDead.body));
          const leftoverPost = calls.filter((call) => call.method === 'POST' && /\/artists$/.test(call.url));
          assert.strictEqual(leftoverPost.length, 2, 'dead leftover store id must POST by stage name');
          const leftoverSent = JSON.parse(leftoverPost[1].options.body);
          assert.strictEqual(leftoverSent.name, 'Leftover Act');
          assert.ok(!leftoverSent.artist_id);
          assert.ok(!leftoverSent.uuid);

          const releaseRes = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: leftover,
              name: 'Neon Nova',
              title: 'Night Drive',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, releaseRes);
          assert.strictEqual(releaseRes.statusCode, 404);
          assert.strictEqual(json(releaseRes).error, 'We could not create that artist. Try the name again.');
          assert.ok(!/tenant/i.test(releaseRes.body));
          const releasePosts = calls.filter((call) => call.method === 'POST' && /\/releases$/.test(call.url));
          assert.ok(releasePosts.length >= 1);
          assert.ok(releasePosts.every((call) => {
            const sent = JSON.parse(call.options.body);
            return sent.artist_id !== liveId;
          }), 'leftover artist id must not be reminted onto a live release');
          const lastRelease = JSON.parse(releasePosts[releasePosts.length - 1].options.body);
          assert.notStrictEqual(lastRelease.artist_id, liveId);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  // A second song under an artist that already has a live ToneGrid record,
  // but whose tonegrid_artist_id got lost from this account's own roster
  // (a different local profile record, or the link never got written back).
  // POST /artists re-attempts a create, ToneGrid rejects with a slug
  // collision because the artist genuinely already exists - createArtist must
  // self-heal by finding and adopting that existing artist, the same way
  // createRelease finds and adopts a colliding release, instead of relaying
  // the raw "slug already taken" error and leaving the account stuck.
  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const existingArtistId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      global.fetch = async function mockFetch(url, options) {
        const method = String((options && options.method) || 'GET').toUpperCase();
        calls.push({ url: String(url), method: method, options: options || {} });
        if (method === 'POST' && /\/artists$/.test(String(url))) {
          return { ok: false, status: 409, json: async () => ({ error: 'Artist slug already taken.' }) };
        }
        if (method === 'GET' && /\/artists(\?|$)/.test(String(url))) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ uuid: existingArtistId, name: 'Vexa', slug: 'vexa' }],
              total: 1,
              page: 1,
              per_page: 100,
            }),
          };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + String(url));
      };
      try {
        await withAccountUser({
          email: 'vexa-second-song@example.com',
          plan: 'creator',
          artist: 'Vexa',
        }, async (row, headers) => {
          const before = await accounts.findById(row.id);
          const stored = profile.recoverRoster(profile.readStored(before), before.artist_name, before.tonegrid_artist_id);
          const localArtistId = stored.artists[0].id;
          assert.ok(!stored.artists[0].tonegrid_artist_id, 'roster starts without a tonegrid_artist_id, like the desynced account');

          const res = mockRes();
          await artists({
            method: 'POST',
            headers,
            body: { name: 'Vexa', plaiground_artist_id: localArtistId },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, existingArtistId);
          assert.strictEqual(json(res).continued, true, 'a slug collision must adopt the existing artist, not fail');
          assert.ok(!json(res).error);

          const artistPosts = calls.filter((call) => call.method === 'POST' && /\/artists$/.test(call.url));
          assert.strictEqual(artistPosts.length, 1, 'must not retry POST /artists after finding the existing one');

          const after = await accounts.findById(row.id);
          assert.strictEqual(after.tonegrid_artist_id, existingArtistId, 'account catalog must point at the recovered artist');
          const afterStored = profile.recoverRoster(profile.readStored(after), after.artist_name, after.tonegrid_artist_id);
          const afterArtist = profile.findArtist(afterStored, localArtistId);
          assert.strictEqual(afterArtist.tonegrid_artist_id, existingArtistId, 'the roster link must be repaired so this does not recur on the next song');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  // ToneGrid 422 "Validation failed" with errors.slug taken — same self-heal as 409.
  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const existingArtistId = 'c0ffeeee-ffff-4fff-8fff-ffffffffffff';
      global.fetch = async function mockFetch(url, options) {
        const method = String((options && options.method) || 'GET').toUpperCase();
        calls.push({ url: String(url), method: method, options: options || {} });
        if (method === 'POST' && /\/artists$/.test(String(url))) {
          return {
            ok: false,
            status: 422,
            json: async () => ({
              success: false,
              error: 'Validation failed',
              errors: { slug: ['The slug has already been taken.'] },
            }),
          };
        }
        if (method === 'GET' && /\/artists(\?|$)/.test(String(url))) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ uuid: existingArtistId, name: 'Vexa Two', slug: 'vexa-two' }],
              total: 1,
              page: 1,
              per_page: 100,
            }),
          };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + String(url));
      };
      try {
        await withAccountUser({
          email: 'vexa-validation-failed@example.com',
          plan: 'creator',
          artist: 'Vexa Two',
        }, async (row, headers) => {
          const stored = profile.recoverRoster(profile.readStored(row), row.artist_name, row.tonegrid_artist_id);
          const localArtistId = stored.artists[0].id;
          const res = mockRes();
          await artists({
            method: 'POST',
            headers,
            body: { name: 'Vexa Two', plaiground_artist_id: localArtistId },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, existingArtistId);
          assert.strictEqual(json(res).continued, true);
          assert.ok(!json(res).error);
          assert.ok(!/validation failed/i.test(res.body));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const existingArtistId = '04c74127-11a8-40cf-beec-d1ffa16abd70';
      global.fetch = async function mockFetch(url, options) {
        const method = String((options && options.method) || 'GET').toUpperCase();
        calls.push({ url: String(url), method: method, options: options || {} });
        if (method === 'GET' && String(url).indexOf('/artists/' + existingArtistId) !== -1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ uuid: existingArtistId, name: 'VEXA', spotify_id: '', apple_id: '' }),
          };
        }
        if (method === 'POST' && /\/artists$/.test(String(url))) {
          throw new Error('must reuse existing artist uuid, not POST /artists');
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + String(url));
      };
      try {
        await withAccountUser({
          email: 'vexa-reuse-artist@example.com',
          plan: 'creator',
          artist: 'VEXA',
          artistId: existingArtistId,
        }, async (row, headers) => {
          const stored = profile.recoverRoster(profile.readStored(row), row.artist_name, row.tonegrid_artist_id);
          const localArtistId = stored.artists[0].id;
          const res = mockRes();
          await artists({
            method: 'POST',
            headers,
            body: {
              name: 'VEXA',
              plaiground_artist_id: localArtistId,
              spotify_id: '',
              apple_id: '',
              store_url: '',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).uuid, existingArtistId);
          assert.strictEqual(json(res).continued, true, 'existing store artist uuid must be reused');
          assert.ok(!json(res).error);
          assert.ok(!/ToneGrid|DistroKid|InterSpace/i.test(JSON.stringify(json(res))));
          const artistPosts = calls.filter((call) => call.method === 'POST' && /\/artists$/.test(call.url));
          assert.strictEqual(artistPosts.length, 0, 'empty DSP URLs must not trigger artist create');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const localId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const liveId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      global.fetch = async function mockFetch(url, options) {
        const method = String((options && options.method) || 'GET').toUpperCase();
        calls.push({ url: String(url), method: method, options: options || {} });
        if (method === 'GET' && String(url).indexOf('/artists/' + localId) !== -1) {
          return { ok: false, status: 404, json: async () => ({ error: 'artist not found in this tenant' }) };
        }
        if (method === 'POST' && /\/artists$/.test(String(url))) {
          const sent = JSON.parse((options && options.body) || '{}');
          assert.strictEqual(sent.name, 'Amplify');
          assert.ok(!sent.legal_first, 'legal first is filled-only, not a create field');
          assert.ok(!sent.legal_last, 'legal last is filled-only, not a create field');
          assert.ok(!sent.spotify_id, 'empty DSP ids must not go on create');
          assert.ok(!sent.apple_id, 'empty DSP ids must not go on create');
          return { ok: true, status: 201, json: async () => ({ uuid: liveId, name: 'Amplify' }) };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + String(url));
      };
      try {
        await withAccountUser({
          email: 'amplify-submit@example.com',
          plan: 'creator',
          artist: 'Victoria PLAIGROUND',
        }, async (row, headers) => {
          await accounts.updateProfile(row.id, {
            artist: 'Victoria PLAIGROUND',
            profile: {
              artists: [{
                id: localId,
                name: 'Amplify',
                source: 'created',
                legal_first: 'Herman',
                legal_last: 'Amplify',
              }],
            },
          });
          const res = mockRes();
          await artists({
            method: 'POST',
            headers,
            body: {
              name: 'Amplify',
              plaiground_artist_id: localId,
              artist_id: localId,
              uuid: localId,
              spotify_id: '',
              apple_id: '',
            },
          }, res);
          assert.strictEqual(res.statusCode, 201);
          assert.strictEqual(json(res).uuid, liveId);
          assert.ok(!json(res).continued);
          assert.ok(!json(res).error);
          assert.ok(!/could not create that artist/i.test(res.body));
          assert.ok(!/ToneGrid|DistroKid|InterSpace/i.test(JSON.stringify(json(res))));
          const artistPosts = calls.filter((call) => call.method === 'POST' && /\/artists$/.test(call.url));
          assert.strictEqual(artistPosts.length, 1, 'Amplify local profile must create the store artist once');
          assert.ok(!calls.some((call) => (
            call.method === 'GET' && String(call.url).indexOf('/artists/' + localId) !== -1
          )), 'local profile uuid must not be looked up as a store artist');
          const after = await accounts.findById(row.id);
          const stored = profile.recoverRoster(profile.readStored(after), after.artist_name, after.tonegrid_artist_id);
          const amplify = profile.findArtist(stored, localId);
          assert.strictEqual(amplify.tonegrid_artist_id, liveId, 'store artist id must write back onto Amplify');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  // #229/#230 copied the local profile uuid onto tonegrid_artist_id. Continue
  // must not GET that leftover as a store artist and 404 as ARTIST_GONE —
  // first Submit POSTs by stage name and writes the live store uuid back.
  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const localId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const liveId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      global.fetch = async function mockFetch(url, options) {
        const method = String((options && options.method) || 'GET').toUpperCase();
        calls.push({ url: String(url), method: method, options: options || {} });
        if (method === 'GET' && String(url).indexOf('/artists/' + localId) !== -1) {
          return { ok: false, status: 404, json: async () => ({ error: 'artist not found in this tenant' }) };
        }
        if (method === 'POST' && /\/artists$/.test(String(url))) {
          const sent = JSON.parse((options && options.body) || '{}');
          assert.strictEqual(sent.name, 'Amplify');
          assert.ok(!sent.artist_id, 'must never send a local profile uuid as store artist_id');
          assert.ok(sent.slug === undefined || sent.slug === 'amplify' || typeof sent.slug === 'string');
          return { ok: true, status: 201, json: async () => ({ uuid: liveId, name: 'Amplify', slug: 'amplify' }) };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + String(url));
      };
      try {
        await withAccountUser({
          email: 'amplify-polluted-roster@example.com',
          plan: 'creator',
          artist: 'Victoria PLAIGROUND',
        }, async (row, headers) => {
          await accounts.updateProfile(row.id, {
            artist: 'Victoria PLAIGROUND',
            profile: {
              artists: [{
                id: localId,
                name: 'Amplify',
                source: 'created',
                legal_first: 'Herman',
                legal_last: 'Amplify',
                tonegrid_artist_id: localId,
              }],
            },
          });
          const res = mockRes();
          await artists({
            method: 'POST',
            headers,
            body: {
              name: 'Amplify',
              plaiground_artist_id: localId,
              artist_id: localId,
            },
          }, res);
          assert.strictEqual(res.statusCode, 201);
          assert.strictEqual(json(res).uuid, liveId);
          assert.ok(!json(res).continued);
          assert.ok(!/could not create that artist/i.test(res.body));
          assert.strictEqual(
            calls.filter((call) => call.method === 'POST' && /\/artists$/.test(call.url)).length,
            1,
            'polluted local uuid must POST /artists by stage name once'
          );
          assert.ok(!calls.some((call) => (
            call.method === 'GET' && String(call.url).indexOf('/artists/' + localId) !== -1
          )), 'mirrored local uuid must not be looked up as a store artist');
          const after = await accounts.findById(row.id);
          const stored = profile.recoverRoster(profile.readStored(after), after.artist_name, after.tonegrid_artist_id);
          const amplify = profile.findArtist(stored, localId);
          assert.strictEqual(amplify.tonegrid_artist_id, liveId, 'live store uuid must replace the mirrored local id');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  // Same slug collision, but nothing on the store actually matches this name
  // or slug (a genuinely different artist owns that slug) - must not adopt an
  // unrelated artist and must still surface a clear error.
  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        const method = String((options && options.method) || 'GET').toUpperCase();
        calls.push({ url: String(url), method: method, options: options || {} });
        if (method === 'POST' && /\/artists$/.test(String(url))) {
          return { ok: false, status: 409, json: async () => ({ error: 'Artist slug already taken.' }) };
        }
        if (method === 'GET' && /\/artists(\?|$)/.test(String(url))) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Totally Different Act', slug: 'totally-different-act' }],
              total: 1,
              page: 1,
              per_page: 100,
            }),
          };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        throw new Error('unexpected store call ' + method + ' ' + String(url));
      };
      try {
        await withAccountUser({
          email: 'unmatched-slug-collision@example.com',
          plan: 'creator',
          artist: 'Nova Unmatched',
        }, async (row, headers) => {
          const stored = profile.recoverRoster(profile.readStored(row), row.artist_name, row.tonegrid_artist_id);
          const localArtistId = stored.artists[0].id;

          const res = mockRes();
          await artists({
            method: 'POST',
            headers,
            body: { name: 'Nova Unmatched', plaiground_artist_id: localArtistId },
          }, res);
          assert.strictEqual(res.statusCode, 409);
          assert.strictEqual(json(res).error, 'Artist slug already taken.');
          assert.ok(!json(res).continued);
          assert.ok(!json(res).uuid, 'must not adopt an unrelated artist just because a slug collided');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      await withAccountUser({}, async (_row, headers) => {
        const missing = mockRes();
        await tracks({ method: 'POST', headers, body: { title: 'Night Drive' } }, missing);
        assert.strictEqual(missing.statusCode, 400);
        assert.strictEqual(json(missing).error, 'release_id is required.');

        const noTitle = mockRes();
        await tracks({
          method: 'POST',
          headers,
          body: { release_id: '11111111-1111-4111-8111-111111111111' },
        }, noTitle);
        assert.strictEqual(noTitle.statusCode, 400);
        assert.strictEqual(json(noTitle).error, 'title is required.');
      });
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        return {
          ok: true,
          status: 201,
          json: async () => ({ track: { uuid: '33333333-3333-4333-8333-333333333333', title: 'Night Drive', position: 1, explicit: false } }),
        };
      };
      try {
        await withAccountUser({}, async (_row, headers) => {
          const res = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'Night Drive',
              language: 'en',
            },
          }, res);
          assert.strictEqual(res.statusCode, 201);
          const minted = trackCreateCalls(calls);
          assert.strictEqual(minted.length, 1);
          assert.strictEqual(minted[0].url, 'https://api-sandbox.tonegrid.pro/api/releases/22222222-2222-4222-8222-222222222222/tracks');
          assert.ok(minted[0].options.headers.Authorization);
          assert.ok(minted[0].options.headers.Authorization.indexOf('test-key-value-not-for-commit') !== -1);
          assert.ok(!res.body.includes('test-key-value-not-for-commit'));
          assert.ok(!res.body.includes('Authorization'));
          const sent = JSON.parse(minted[0].options.body);
          assert.strictEqual(sent.title, 'Night Drive');
          assert.strictEqual(sent.position, 1);
          assert.strictEqual(sent.explicit, false);
          assert.strictEqual(sent.language, 'en');
          assert.strictEqual(sent.songwriters, undefined);
          assert.strictEqual(sent.composers, undefined);
          assert.strictEqual(sent.track_properties, undefined, 'no made_how must omit includes_ai');
          const writerCall = calls.find((call) => /\/writers$/.test(String(call.url)) && String((call.options && call.options.method) || 'POST') === 'POST');
          assert.ok(writerCall, 'track create must POST /writers');
          const writerBody = JSON.parse(writerCall.options.body);
          assert.strictEqual(writerBody.first_name, 'Ada');
          assert.strictEqual(writerBody.last_name, 'Night');
          assert.strictEqual(writerBody.legal_first, 'Ada');
          assert.strictEqual(writerBody.legal_last, 'Night');
          assert.strictEqual(writerBody.name, 'Ada Night');
          const attachCall = calls.find((call) => /\/tracks\/[^/]+\/writers$/.test(String(call.url)) && String((call.options && call.options.method) || '') === 'PUT');
          assert.ok(attachCall, 'track create must attach writers');
          const attachBody = JSON.parse(attachCall.options.body);
          assert.strictEqual(attachBody.writers[0].first_name, 'Ada');
          assert.strictEqual(attachBody.writers[0].last_name, 'Night');

          const instTrack = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'Night Drive',
              instrumental: true,
            },
          }, instTrack);
          assert.strictEqual(instTrack.statusCode, 201);
          const instMinted = trackCreateCalls(calls);
          const instSent = JSON.parse(instMinted[1].options.body);
          assert.strictEqual(instSent.language, undefined);
          assert.strictEqual(instSent.instrumental, undefined);
          assert.strictEqual(instSent.track_properties, undefined);

          const aiTrack = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'Night Drive',
              language: 'en',
              made_how: 'ai_assisted',
              human_contribution: 'I wrote the lyrics and sang the lead.',
            },
          }, aiTrack);
          assert.strictEqual(aiTrack.statusCode, 201);
          const aiSent = JSON.parse(trackCreateCalls(calls)[2].options.body);
          assert.deepStrictEqual(aiSent.track_properties, ['includes_ai']);
          assert.strictEqual(aiSent.ai_service_other, 'I wrote the lyrics and sang the lead.');
          assert.strictEqual(aiSent.ai_service, undefined);
          assert.ok(!/suno/i.test(JSON.stringify(aiSent)));

          const fullTrack = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'Night Drive',
              language: 'en',
              made_how: 'fully_ai',
            },
          }, fullTrack);
          assert.strictEqual(fullTrack.statusCode, 201);
          const fullSent = JSON.parse(trackCreateCalls(calls)[3].options.body);
          assert.deepStrictEqual(fullSent.track_properties, ['includes_ai']);
          assert.strictEqual(fullSent.ai_service_other, 'generative AI');
          assert.strictEqual(fullSent.ai_service, undefined);

          const noAiTrack = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'Night Drive',
              language: 'en',
              made_how: 'no_ai',
            },
          }, noAiTrack);
          assert.strictEqual(noAiTrack.statusCode, 201);
          const noAiSent = JSON.parse(trackCreateCalls(calls)[4].options.body);
          assert.strictEqual(noAiSent.track_properties, undefined);
          assert.strictEqual(noAiSent.ai_service_other, undefined);
          assert.ok(!JSON.stringify(noAiSent).includes('includes_ai'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const trackId = '33333333-3333-4333-8333-333333333333';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        const path = String(url);
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'PATCH' && /\/tracks\//.test(path)) {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        return {
          ok: true,
          status: 201,
          json: async () => ({ track: { uuid: trackId, title: 'I Set the Tone', position: 1, explicit: false } }),
        };
      };
      try {
        await withAccountUser({}, async (_row, headers) => {
          const ai = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'I Set the Tone',
              language: 'en',
              made_how: 'ai_assisted',
              human_elements: ['Original lyrics'],
              rights_confirmed: true,
            },
          }, ai);
          assert.strictEqual(ai.statusCode, 201);
          const minted = trackCreateCalls(calls);
          assert.strictEqual(minted.length, 1);
          const sent = JSON.parse(minted[0].options.body);
          assert.deepStrictEqual(sent.track_properties, ['includes_ai']);
          assert.strictEqual(sent.ai_service_other, 'generative AI');
          assert.ok(!/suno/i.test(JSON.stringify(sent)));

          const named = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'I Set the Tone',
              language: 'en',
              made_how: 'fully_ai',
              ai_tool: 'Udio',
              rights_confirmed: true,
            },
          }, named);
          assert.strictEqual(named.statusCode, 201);
          const namedSent = JSON.parse(trackCreateCalls(calls)[1].options.body);
          assert.deepStrictEqual(namedSent.track_properties, ['includes_ai']);
          assert.strictEqual(namedSent.ai_service_other, 'generative AI');
          assert.strictEqual(namedSent.ai_service, undefined);

          const suno = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'I Set the Tone',
              language: 'en',
              made_how: 'ai_assisted',
              ai_service_other: 'Suno',
              human_elements: ['Original lyrics'],
              rights_confirmed: true,
            },
          }, suno);
          const sunoSent = JSON.parse(trackCreateCalls(calls)[2].options.body);
          assert.deepStrictEqual(sunoSent.track_properties, ['includes_ai']);
          assert.strictEqual(sunoSent.ai_service_other, 'generative AI');
          assert.ok(!/suno/i.test(JSON.stringify(sunoSent)));

          const none = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'I Set the Tone',
              language: 'en',
              made_how: 'no_ai',
              rights_confirmed: true,
            },
          }, none);
          const noneSent = JSON.parse(trackCreateCalls(calls)[3].options.body);
          assert.strictEqual(noneSent.track_properties, undefined, 'no AI must omit the tag');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        return {
          ok: true,
          status: 201,
          json: async () => ({ track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Night Drive' } }),
        };
      };
      try {
        await withAccountUser({
          plan: 'basic',
          artistId: '11111111-1111-4111-8111-111111111111',
          releaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          trackId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        }, async (_row, headers) => {
          const res = mockRes();
          await tracks({
            method: 'POST',
            headers,
            body: {
              release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              title: 'Night Drive',
              language: 'en',
            },
          }, res);
          assert.strictEqual(res.statusCode, 201, JSON.stringify(json(res)));
          assert.ok(!json(res).continued, 'Basic leftover catalog track must not pretend the store already has it');
          assert.strictEqual(json(res).track.uuid, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
          const minted = trackCreateCalls(calls);
          assert.strictEqual(minted.length, 1, 'Basic with one leftover catalog track must still hop a new store track');
          assert.strictEqual(
            minted[0].url,
            'https://api-sandbox.tonegrid.pro/api/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/tracks'
          );
          assert.ok(!/cccccccc-cccc-4ccc-8ccc-cccccccccccc/.test(minted[0].options.body || ''));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const leftover = 'plaiground-track-22222222-2222-4222-8222-222222222222:1';
      const reused = 'Idempotency-Key reused with a different request body. Either send the exact same body, or rotate the key.';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        if (calls.length === 1) {
          return { ok: false, status: 422, json: async () => ({ error: reused }) };
        }
        return {
          ok: true,
          status: 201,
          json: async () => ({ track: { uuid: '33333333-3333-4333-8333-333333333333', title: 'Night Drive' } }),
        };
      };
      try {
        await withAccountUser({}, async (_row, headers) => {
          const first = mockRes();
          await tracks({
            method: 'POST',
            headers: Object.assign({ 'idempotency-key': leftover }, headers),
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'Night Drive',
              language: 'en',
            },
          }, first);
          assert.strictEqual(first.statusCode, 422);
          assert.strictEqual(json(first).error, 'We could not finish this step.');
          assert.ok(!/Idempotency-Key|request body|rotate the key/i.test(first.body));

          const second = mockRes();
          await tracks({
            method: 'POST',
            headers: Object.assign({ 'idempotency-key': leftover }, headers),
            body: {
              release_id: '22222222-2222-4222-8222-222222222222',
              title: 'Night Drive',
              language: 'am',
            },
          }, second);
          assert.strictEqual(second.statusCode, 201);
          const minted = trackCreateCalls(calls);
          assert.strictEqual(minted.length, 2);
          assert.notStrictEqual(hopKeyOf(minted[0]), leftover);
          assert.notStrictEqual(hopKeyOf(minted[1]), leftover);
          assert.notStrictEqual(hopKeyOf(minted[0]), hopKeyOf(minted[1]));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      await withAccountUser({}, async (_row, headers) => {
        const notMulti = mockRes();
        await trackAudio({
          method: 'POST',
          headers: Object.assign({ 'content-type': 'application/json' }, headers),
          query: { id: '33333333-3333-4333-8333-333333333333' },
          body: Buffer.from('{"no":true}'),
        }, notMulti);
        assert.strictEqual(notMulti.statusCode, 400);
        assert.ok(/audio file is required/i.test(json(notMulti).error));
        assert.ok(!/Cloudflare|R2|bucket/i.test(json(notMulti).error));

        const noId = mockRes();
        await trackAudio({
          method: 'POST',
          headers: Object.assign({ 'content-type': 'multipart/form-data; boundary=xx' }, headers),
          query: {},
          url: '/api/tonegrid/tracks/audio',
          body: Buffer.from('x'),
        }, noId);
        assert.strictEqual(noId.statusCode, 400);

        const tooBig = mockRes();
        await trackAudio({
          method: 'POST',
          headers: Object.assign({
            'content-type': 'multipart/form-data; boundary=xx',
            'content-length': String(512 * 1024 * 1024 + 1),
          }, headers),
          query: { id: '33333333-3333-4333-8333-333333333333' },
          body: Buffer.from('x'),
        }, tooBig);
        assert.strictEqual(tooBig.statusCode, 413);
        assert.strictEqual(json(tooBig).error, 'We could not send the audio.');
        assert.ok(!/200\s*MB/i.test(json(tooBig).error || ''), 'transit 413 must not fake a 200 MB cap');
        assert.ok(!/could not reach the store/i.test(json(tooBig).error || ''), 'transit 413 must not pretend the store was unreachable');

        const m4a = mockRes();
        await trackAudio({
          method: 'POST',
          headers: Object.assign({ 'content-type': 'multipart/form-data; boundary=xx' }, headers),
          query: { id: '33333333-3333-4333-8333-333333333333' },
          body: Buffer.from('Content-Disposition: form-data; name="audio"; filename="song.m4a"\r\n\r\nxx'),
        }, m4a);
        assert.strictEqual(m4a.statusCode, 400);
        assert.ok(/WAV, FLAC, or MP3/i.test(json(m4a).error));

        const junkMp3 = mockRes();
        await trackAudio({
          method: 'POST',
          headers: Object.assign({ 'content-type': 'multipart/form-data; boundary=xx' }, headers),
          query: { id: '33333333-3333-4333-8333-333333333333' },
          body: Buffer.from('Content-Disposition: form-data; name="audio"; filename="song.mp3"\r\n\r\nxx'),
        }, junkMp3);
        assert.strictEqual(junkMp3.statusCode, 400);
        assert.ok(/MP3|decode|convert/i.test(json(junkMp3).error));
      });
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const raw = Buffer.from(
        '------bound\r\nContent-Disposition: form-data; name="audio"; filename="song.wav"\r\nContent-Type: audio/wav\r\n\r\nRIFF....WAVE\r\n------bound--\r\n'
      );
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        return { ok: true, status: 200, json: async () => ({ audio_status: 'processing' }) };
      };
      try {
        await withAccountUser({}, async (_row, headers) => {
          assert.deepStrictEqual(tonegridApi.config, { api: { bodyParser: false }, maxDuration: 60 });
          const res = mockRes();
          await trackAudio({
            method: 'POST',
            headers: Object.assign({ 'content-type': 'multipart/form-data; boundary=----bound' }, headers),
            query: { id: '33333333-3333-4333-8333-333333333333' },
            body: raw,
          }, res);
          if (res.statusCode !== 200) console.error('AUDIO STATUS', res.statusCode, res.body);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(calls.length, 1);
          assert.strictEqual(calls[0].url, 'https://api-sandbox.tonegrid.pro/api/tracks/33333333-3333-4333-8333-333333333333/audio');
          assert.strictEqual(calls[0].options.method, 'POST');
          assert.ok(calls[0].options.headers.Authorization);
          assertStoreAudioForward(calls[0].options, { filename: 'song.wav', mime: 'audio/wav' });
          assert.strictEqual(calls[0].options.headers['Content-Type'], 'multipart/form-data; boundary=----bound');
          assert.ok(!res.body.includes('test-key-value-not-for-commit'));
          assert.ok(!res.body.includes('Authorization'));
          assert.strictEqual(json(res).audio_status, 'processing');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mp3 = fs.readFileSync(path.join(__dirname, 'fixtures', 'tone.mp3'));
      const raw = Buffer.concat([
        Buffer.from('--bound\r\nContent-Disposition: form-data; name="audio"; filename="tone.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'),
        mp3,
        Buffer.from('\r\n--bound--\r\n'),
      ]);
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        return { ok: true, status: 200, json: async () => ({ audio_status: 'processing' }) };
      };
      try {
        await withAccountUser({}, async (_row, headers) => {
          const res = mockRes();
          await trackAudio({
            method: 'POST',
            headers: Object.assign({ 'content-type': 'multipart/form-data; boundary=bound' }, headers),
            query: { id: '33333333-3333-4333-8333-333333333333' },
            body: raw,
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(calls.length, 1);
          assertStoreAudioForward(calls[0].options, { filename: 'tone.wav', mime: 'audio/wav' });
          const sent = storeHopBody(calls[0].options);
          const head = sent.slice(0, 500).toString('latin1');
          assert.ok(!/\.mp3/i.test(head));
          assert.ok(!/audio\/mpeg/i.test(head));
          assert.ok(sent.indexOf(Buffer.from('RIFF')) !== -1);
          assert.ok(sent.indexOf(Buffer.from('WAVE')) !== -1);
        });

        const missingArt = mockRes();
        await withAccountUser({ releaseId: '11111111-1111-4111-8111-111111111111' }, async (_row, headers) => {
          await releaseArtwork({
            method: 'POST',
            headers: Object.assign({ 'content-type': 'multipart/form-data; boundary=xx' }, headers),
            id: '11111111-1111-4111-8111-111111111111',
            body: Buffer.from(''),
          }, missingArt);
          assert.strictEqual(missingArt.statusCode, 400);
          assert.ok(/artwork/i.test(json(missingArt).error));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  function audioPart(filename, mime, data) {
    return Buffer.concat([
      Buffer.from('--bound\r\nContent-Disposition: form-data; name="audio"; filename="' + filename + '"\r\nContent-Type: ' + mime + '\r\n\r\n'),
      Buffer.isBuffer(data) ? data : Buffer.from(data),
      Buffer.from('\r\n--bound--\r\n'),
    ]);
  }

  function chunkReqHeaders(headers, uploadId, index, count, filename, extra) {
    return Object.assign({
      'content-type': 'multipart/form-data; boundary=bound',
      'x-plaiground-upload-id': uploadId,
      'x-plaiground-chunk-index': String(index),
      'x-plaiground-chunk-count': String(count),
      'x-plaiground-filename': filename,
    }, extra || {}, headers);
  }

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mp3 = fs.readFileSync(path.join(__dirname, 'fixtures', 'tone.mp3'));
      const mid = Math.floor(mp3.length / 2);
      const uploadId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        return { ok: true, status: 200, json: async () => ({ audio_status: 'processing' }) };
      };
      try {
        await withAccountUser({}, async (_row, headers) => {
          const first = mockRes();
          await trackAudio({
            method: 'POST',
            headers: chunkReqHeaders(headers, uploadId, 0, 2, 'tone.mp3', {
              'x-plaiground-mime': 'audio/mpeg',
              'x-plaiground-total-bytes': String(mp3.length),
            }),
            query: { id: '33333333-3333-4333-8333-333333333333' },
            body: audioPart('tone.mp3', 'audio/mpeg', mp3.slice(0, mid)),
          }, first);
          assert.strictEqual(first.statusCode, 200);
          assert.strictEqual(json(first).received, true);
          assert.strictEqual(calls.length, 0, 'first chunk must not hop the store');

          const last = mockRes();
          await trackAudio({
            method: 'POST',
            headers: chunkReqHeaders(headers, uploadId, 1, 2, 'tone.mp3', {
              'x-plaiground-mime': 'audio/mpeg',
              'x-plaiground-total-bytes': String(mp3.length),
            }),
            query: { id: '33333333-3333-4333-8333-333333333333' },
            body: audioPart('tone.mp3', 'audio/mpeg', mp3.slice(mid)),
          }, last);
          assert.strictEqual(last.statusCode, 200, JSON.stringify(json(last)));
          assert.strictEqual(calls.length, 1, 'assembled MP3 hops once');
          assert.strictEqual(calls[0].url, 'https://api-sandbox.tonegrid.pro/api/tracks/33333333-3333-4333-8333-333333333333/audio');
          assertStoreAudioForward(calls[0].options, { filename: 'tone.wav', mime: 'audio/wav' });
          const sent = storeHopBody(calls[0].options);
          const head = sent.slice(0, 500).toString('latin1');
          assert.ok(!/\.mp3/i.test(head));
          assert.ok(sent.indexOf(Buffer.from('RIFF')) !== -1);
          assert.ok(sent.indexOf(Buffer.from('WAVE')) !== -1);
          assert.ok(!/test-key-value-not-for-commit/.test(last.body));
          assert.ok(!/Authorization|Idempotency-Key/i.test(last.body));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const wav = Buffer.from('RIFF    WAVEfmt data-chunk-body');
      wav.write('WAVE', 8);
      const uploadId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), options: options || {} });
        return { ok: true, status: 200, json: async () => ({ audio_status: 'processing' }) };
      };
      try {
        await withAccountUser({}, async (_row, headers) => {
          const lastOnly = mockRes();
          await trackAudio({
            method: 'POST',
            headers: chunkReqHeaders(headers, uploadId, 1, 2, 'song.wav', {
              'x-plaiground-mime': 'audio/wav',
            }),
            query: { id: '33333333-3333-4333-8333-333333333333' },
            body: audioPart('song.wav', 'audio/wav', wav.slice(8)),
          }, lastOnly);
          assert.strictEqual(lastOnly.statusCode, 409);
          assert.strictEqual(json(lastOnly).error, 'We could not send the audio.');
          assert.strictEqual(calls.length, 0, 'incomplete assemble must not hop');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url, options) {
        const method = String((options && options.method) || 'GET').toUpperCase();
        if (method === 'GET') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              title: 'Same Song',
              status: 'draft',
            }),
          };
        }
        const credit = creditFollowupResponse(url, options);
        if (credit) return credit;
        calls.push(1);
        return { ok: true, status: 201, json: async () => ({ uuid: '99999999-9999-4999-8999-999999999999' }) };
      };
      try {
        await withAccountUser({
          plan: 'basic',
          releaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        }, async (_row, headers) => {
          const blocked = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Second Song',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, blocked);
          assert.strictEqual(blocked.statusCode, 403);
          assert.strictEqual(json(blocked).code, 'PLAN_LIMIT');
          assert.strictEqual(json(blocked).error, plans.BASIC_ERROR);
          assert.strictEqual(json(blocked).used, 1);
          assert.strictEqual(json(blocked).limit, 1);
          assert.strictEqual(json(blocked).upgrade.creator, '/creator.html');
          assert.strictEqual(calls.length, 0);

          const artistBlocked = mockRes();
          await artists({ method: 'POST', headers, body: { name: 'Brand New Act' } }, artistBlocked);
          assert.strictEqual(artistBlocked.statusCode, 403);
          assert.strictEqual(json(artistBlocked).error, plans.BASIC_ERROR);
          assert.strictEqual(calls.length, 0);

          const continued = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              title: 'Same Song',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, continued);
          assert.strictEqual(continued.statusCode, 200);
          assert.strictEqual(json(continued).uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
          assert.strictEqual(json(continued).continued, true);
          assert.strictEqual(calls.length, 0);
        });

        await withAccountUser({
          email: 'retry@example.com',
          plan: 'basic',
          artist: 'Products',
          artistId: '11111111-1111-4111-8111-111111111111',
          releaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        }, async (_row, headers) => {
          const reusedArtist = mockRes();
          await artists({ method: 'POST', headers, body: { name: 'Products' } }, reusedArtist);
          assert.strictEqual(reusedArtist.statusCode, 200);
          assert.strictEqual(json(reusedArtist).uuid, '11111111-1111-4111-8111-111111111111');
          assert.strictEqual(json(reusedArtist).continued, true);
          assert.strictEqual(calls.length, 0);

          const reusedRelease = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Products Song',
              type: 'single',
              genre: 'Cajun',
              language: 'en',
              price: '$0.69',
            },
          }, reusedRelease);
          assert.strictEqual(reusedRelease.statusCode, 403);
          assert.strictEqual(json(reusedRelease).code, 'PLAN_LIMIT');
          assert.ok(!json(reusedRelease).continued);
          assert.strictEqual(calls.length, 0);
        });

        await withAccountUser({
          email: 'basic-album@example.com',
          plan: 'basic',
        }, async (_row, headers) => {
          const blockedAlbum = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'First Album',
              type: 'album',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, blockedAlbum);
          assert.strictEqual(blockedAlbum.statusCode, 403);
          assert.strictEqual(json(blockedAlbum).code, 'PLAN_LIMIT');
          assert.strictEqual(json(blockedAlbum).error, plans.ALBUM_ERROR);
          assert.strictEqual(calls.length, 0);
        });

        await withAccountUser({
          email: 'creator-album@example.com',
          plan: 'creator',
          artistId: '11111111-1111-4111-8111-111111111111',
          releaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        }, async (_row, headers) => {
          const albumRes = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Night Drive LP',
              type: 'album',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, albumRes);
          assert.strictEqual(albumRes.statusCode, 201);
          assert.strictEqual(calls.length, 1, 'album must create a new ToneGrid release, not reuse the single');
          assert.notStrictEqual(json(albumRes).uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
          calls.length = 0;
        });

        const thisMonth = new Date();
        const lastMonthDate = new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - 1, 15));
        const thisMonthStamp = thisMonth.toISOString();
        const lastMonthStamp = lastMonthDate.toISOString();
        const creatorReleases = [];
        for (let i = 1; i <= 8; i += 1) {
          creatorReleases.push({
            id: 'cccccccc-cccc-4ccc-8ccc-' + String(i).padStart(12, '0'),
            at: thisMonthStamp,
          });
        }
        await withAccountUser({
          email: 'creator@example.com',
          plan: 'creator',
          releases: creatorReleases,
        }, async (_row, headers) => {
          const ninth = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Ninth Song',
              type: 'single',
            },
          }, ninth);
          assert.strictEqual(ninth.statusCode, 403);
          assert.strictEqual(json(ninth).code, 'PLAN_LIMIT');
          assert.strictEqual(json(ninth).error, plans.CREATOR_ERROR);
          assert.strictEqual(json(ninth).used, 8);
          assert.strictEqual(json(ninth).limit, 8);
          assert.strictEqual(calls.length, 0);
        });

        const lastMonth = [];
        for (let i = 1; i <= 8; i += 1) {
          lastMonth.push({
            id: 'dddddddd-dddd-4ddd-8ddd-' + String(i).padStart(12, '0'),
            at: lastMonthStamp,
          });
        }
        await withAccountUser({
          email: 'creator-reset@example.com',
          plan: 'creator',
          releases: lastMonth,
        }, async (_row, headers) => {
          const allowed = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'New Month Song',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, allowed);
          assert.strictEqual(allowed.statusCode, 201);
          assert.ok(calls.length >= 1);
        });

        const many = [];
        for (let i = 1; i <= 20; i += 1) {
          many.push({
            id: 'eeeeeeee-eeee-4eee-8eee-' + String(i).padStart(12, '0'),
            at: '2026-08-10T00:00:00.000Z',
          });
        }
        await withAccountUser({
          email: 'pro@example.com',
          plan: 'pro',
          releases: many,
        }, async (_row, headers) => {
          const proOk = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Pro Song',
              type: 'single',
              genre: 'Pop',
              language: 'en',
              price: '$0.99',
            },
          }, proOk);
          assert.strictEqual(proOk.statusCode, 201);
        });

        await withAccountUser({
          email: 'pending@example.com',
          plan: 'basic',
          confirmed: false,
        }, async (_row, headers) => {
          const pending = mockRes();
          await releases({
            method: 'POST',
            headers,
            body: {
              artist_id: '11111111-1111-4111-8111-111111111111',
              title: 'Too Soon',
              type: 'single',
            },
          }, pending);
          assert.strictEqual(pending.statusCode, 403);
          assert.strictEqual(json(pending).pending, true);
          assert.ok(String(json(pending).error).indexOf('Confirm your email') !== -1);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv({ key: undefined, base: undefined }, async () => {
    const res = mockRes();
    await analytics({ method: 'GET', headers: {}, query: {} }, res);
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(json(res).configured, false);
    assert.ok(!JSON.stringify(json(res)).includes('Bearer'));
  });

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const res = mockRes();
      await analytics({ method: 'GET', headers: {}, query: { from: 'not-a-date' } }, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(json(res).error, 'from must be YYYY-MM-DD.');
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const res = mockRes();
      await analytics({ method: 'GET', headers: {}, query: { from: '2026-04-01', to: '2026-04-26' } }, res);
      assert.strictEqual(res.statusCode, 503);
      assert.strictEqual(json(res).error, 'Accounts are not configured.');
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url) {
        calls.push(String(url));
        return { ok: true, status: 200, json: async () => ({ total_streams: 999999, data: [{ release_uuid: '11111111-1111-4111-8111-111111111111', title: 'Tenant Hit', streams: 999999 }] }) };
      };
      try {
        await withAccountUser({}, async (_row, headers) => {
          const res = mockRes();
          await analytics({ method: 'GET', headers, query: { from: '2026-04-01', to: '2026-04-26' } }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(calls.length, 0, 'no ToneGrid call when the user has no release ids');
          const body = json(res);
          assert.strictEqual(body.empty, true);
          assert.strictEqual(body.summary.total_streams, 0);
          assert.deepStrictEqual(body.releases, []);
          assert.ok(!res.body.includes('999999'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      await withAccountUser({ plan: 'pro' }, async (row, headers) => {
        await accounts.updateStripe(row.id, { status: 'hold' });
        const res = mockRes();
        await analytics({ method: 'GET', headers, query: { from: '2026-04-01', to: '2026-04-26' } }, res);
        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(json(res).status, 'hold');
        const roy = mockRes();
        await royalties({ method: 'GET', headers }, roy);
        assert.strictEqual(roy.statusCode, 403);
        assert.strictEqual(json(roy).status, 'hold');
      });
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ total_streams: 0, data: [] }),
      });
      try {
        await withAccountUser({ plan: 'pro' }, async (row, headers) => {
          await accounts.updateStripe(row.id, { status: 'warning' });
          const res = mockRes();
          await analytics({ method: 'GET', headers, query: { from: '2026-04-01', to: '2026-04-26' } }, res);
          assert.strictEqual(res.statusCode, 200, 'warning keeps analytics');
          const roy = mockRes();
          await royalties({ method: 'GET', headers }, roy);
          assert.strictEqual(roy.statusCode, 200, 'warning keeps royalties');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      const theirs = '22222222-2222-4222-8222-222222222222';
      global.fetch = async function mockFetch(url) {
        calls.push(String(url));
        if (String(url).includes('/analytics/releases')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                { release_uuid: mine, title: 'Night Drive', streams: 12 },
                { release_uuid: theirs, title: 'Tenant Hit', streams: 9000 },
              ],
            }),
          };
        }
        if (String(url).includes('/analytics/dsps')) {
          return { ok: true, status: 200, json: async () => ({ data: [{ dsp: 'Spotify', streams: 12 }] }) };
        }
        if (String(url).includes('/analytics/territories')) {
          return { ok: true, status: 200, json: async () => ({ data: [{ territory: 'US', country_name: 'United States', streams: 12 }] }) };
        }
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const res = mockRes();
          await analytics({
            method: 'GET',
            headers,
            query: { from: '2026-04-01', to: '2026-04-26' },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.ok(!calls.some((url) => url.includes('/analytics/summary')));
          const body = json(res);
          assert.strictEqual(body.summary.total_streams, 12);
          assert.strictEqual(body.releases.length, 1);
          assert.strictEqual(body.releases[0].title, 'Night Drive');
          assert.ok(!res.body.includes('Tenant Hit'));
          assert.ok(!res.body.includes('9000'));
          assert.ok(!res.body.includes('7,412,908'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv({ key: undefined, base: undefined }, async () => {
    const listRes = mockRes();
    await releases({ method: 'GET', headers: {}, query: {} }, listRes);
    assert.strictEqual(listRes.statusCode, 503);

    const royRes = mockRes();
    await royalties({ method: 'GET', headers: {}, query: {} }, royRes);
    assert.strictEqual(royRes.statusCode, 503);
    assert.strictEqual(json(royRes).configured, false);
  });

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url) {
        calls.push(String(url));
        if (String(url).includes('/releases/' + mine)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { uuid: mine, title: 'Night Drive', type: 'single', status: 'draft' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ uuid: mine, title: 'Night Drive' }, { uuid: '33333333-3333-4333-8333-333333333333', title: 'Someone Else' }],
            total: 2,
          }),
        };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const res = mockRes();
          await releases({ method: 'GET', headers, query: {} }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.ok(calls.every((url) => !url.endsWith('/api/releases') || url.includes(mine)));
          const body = json(res);
          assert.strictEqual(body.releases.length, 1);
          assert.strictEqual(body.releases[0].title, 'Night Drive');
          assert.ok(!res.body.includes('Someone Else'));
          assert.ok(!res.body.includes('Neon Shadows'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url) {
        if (String(url).includes('/releases/' + mine) && !String(url).includes('/ddex/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              release: {
                uuid: mine,
                title: 'Night Drive',
                type: 'single',
                status: 'pending',
                cover: { url: 'https://cdn.example/store-cover.jpg' },
              },
            }),
          };
        }
        if (String(url).includes('/ddex/deliveries')) {
          return { ok: true, status: 200, json: async () => ({ deliveries: [] }) };
        }
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await releases({ method: 'GET', headers, query: {} }, res);
          assert.strictEqual(res.statusCode, 200);
          const body = json(res);
          assert.strictEqual(body.releases[0].artwork_url, 'https://cdn.example/store-cover.jpg');
          const next = await accounts.findById(row.id);
          const stored = (next.profile && next.profile.releases || []).find(function (item) {
            return String((item && (item.tonegrid_release_id || item.id)) || '') === mine;
          });
          assert.ok(stored);
          assert.strictEqual(stored.artwork_url, 'https://cdn.example/store-cover.jpg');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const mine = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const profileLib = require('./profile');
      let releaseFetch;
      global.fetch = async function mockFetch(url) {
        if (String(url).includes('/releases/' + mine) && !String(url).includes('/ddex/')) {
          return new Promise(function (resolve) {
            releaseFetch = function () {
              resolve({
                ok: true,
                status: 200,
                json: async () => ({
                  release: { uuid: mine, title: 'Too the moon', type: 'single', status: 'pending' },
                }),
              });
            };
          });
        }
        if (String(url).includes('/ddex/deliveries')) {
          return { ok: true, status: 200, json: async () => ({ deliveries: [] }) };
        }
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      };
      try {
        await withAccountUser({
          plan: 'basic',
          artist: 'Fuvtu',
          releaseId: mine,
        }, async (row, headers) => {
          const seeded = profileLib.upsertArtist(profileLib.readStored(row), {
            name: 'Fuvtu',
            source: 'created',
            bio: '',
            photo: '',
          });
          await accounts.updateProfile(row.id, { artist: 'Fuvtu', profile: seeded });
          const before = profileLib.readStored(await accounts.findById(row.id));
          const artistId = before.artists[0].id;

          const res = mockRes();
          const listPromise = releases({ method: 'GET', headers, query: {} }, res);
          await new Promise(function (resolve) {
            const wait = function () {
              if (releaseFetch) {
                resolve();
                return;
              }
              setTimeout(wait, 10);
            };
            wait();
          });

          const next = profileLib.upsertArtist(profileLib.readStored(await accounts.findById(row.id)), {
            id: artistId,
            name: 'Fuvtu',
            source: 'created',
            bio: 'saved while songs were loading',
            ai_involvement_percent: 30,
          });
          await accounts.updateProfile(row.id, { artist: 'Fuvtu', profile: next });
          releaseFetch();
          await listPromise;
          assert.strictEqual(res.statusCode, 200);

          const after = profileLib.readStored(await accounts.findById(row.id));
          const kept = (after.artists || []).find(function (item) { return item.id === artistId; });
          assert.ok(kept, 'list write-back must not drop the Basic artist');
          assert.strictEqual(kept.bio, 'saved while songs were loading');
          assert.strictEqual(kept.ai_involvement_percent, 30);
          assert.ok((after.releases || []).some(function (item) {
            return item.tonegrid_release_id === mine;
          }), 'pending song is still recorded');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const mine = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const profileLib = require('./profile');
      global.fetch = async function mockFetch(url) {
        if (String(url).includes('/releases/' + mine) && !String(url).includes('/ddex/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              release: { uuid: mine, title: 'Too the moon', type: 'single', status: 'pending', artist: 'Fuvtu' },
            }),
          };
        }
        if (String(url).includes('/ddex/deliveries')) {
          return { ok: true, status: 200, json: async () => ({ deliveries: [] }) };
        }
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      };
      try {
        await withAccountUser({
          plan: 'basic',
          artist: 'Victoria Reyes',
          releaseId: mine,
        }, async (row, headers) => {
          await accounts.updateProfile(row.id, {
            artist: 'Victoria Reyes',
            profile: {
              photo: '',
              genres: [],
              specialties: [],
              artists: [{ id: 'keep-me', name: 'Fuvtu', source: 'created', bio: 'do not wipe' }],
              releases: [{
                title: 'Too the moon',
                artist: 'Fuvtu',
                plaiground_artist_id: 'keep-me',
                tonegrid_status: 'pending',
                tonegrid_release_id: mine,
              }],
            },
          });
          const res = mockRes();
          await releases({ method: 'GET', headers, query: {} }, res);
          assert.strictEqual(res.statusCode, 200);
          const after = profileLib.readStored(await accounts.findById(row.id));
          const kept = (after.artists || []).find(function (item) { return item.name === 'Fuvtu'; });
          assert.ok(kept, 'Basic + pending release must not wipe or hide artists');
          assert.strictEqual(kept.bio, 'do not wipe');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url) {
        calls.push(String(url));
        if (String(url).includes('/royalties/statements/stmt_202603')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              statement: {
                breakdown: [
                  { release_title: 'Night Drive', dsp: 'Spotify', streams: 12, revenue_usd: '1.50' },
                  { release_title: 'Tenant Hit', dsp: 'Apple Music', streams: 9000, revenue_usd: '19821.50' },
                ],
              },
            }),
          };
        }
        if (String(url).includes('/royalties/statements')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ statements: [{ id: 'stmt_202603', period: '2026-03', total_usd: '19821.50', status: 'finalized' }] }),
          };
        }
        if (String(url).includes('/releases/' + mine)) {
          return { ok: true, status: 200, json: async () => ({ data: { uuid: mine, title: 'Night Drive' } }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ balance: { available_usd: '19821.50', pending_usd: '0.00', currency: 'USD' } }),
        };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const res = mockRes();
          await royalties({ method: 'GET', headers, query: {} }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.ok(!calls.some((url) => url.endsWith('/royalties/balance')));
          const body = json(res);
          assert.strictEqual(body.balance.available_usd, 1.5);
          assert.strictEqual(body.statements[0].period, '2026-03');
          assert.strictEqual(body.breakdown.length, 1);
          assert.strictEqual(body.breakdown[0].dsp, 'Spotify');
          assert.ok(!res.body.includes('19821.50'));
          assert.ok(!res.body.includes('Tenant Hit'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const mine = '11111111-1111-4111-8111-111111111111';
      await withAccountUser({ releaseId: mine }, async (_row, headers) => {
        const missing = mockRes();
        await submitRelease({
          method: 'POST',
          headers,
          id: mine,
          body: {},
        }, missing);
        assert.strictEqual(missing.statusCode, 403);
        assert.strictEqual(json(missing).code, 'SIGNWELL_REQUIRED');
        assert.strictEqual(json(missing).signed, false);
      });
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method, body: options && options.body });
        if (String(url).includes('signwell.com')) {
          return { ok: false, status: 500, json: async () => ({ error: 'SignWell should not be called for solo.' }) };
        }
        if (String(url).includes('/releases/' + mine + '/submit')) {
          return { ok: true, status: 200, json: async () => ({ message: 'Release submitted for review.', status: 'pending' }) };
        }
        if (String(url).includes('/releases/' + mine + '/dsps')) {
          return { ok: true, status: 200, json: async () => ({ dsps: [{ dsp_name: 'YouTube Music' }] }) };
        }
        if (String(url).includes('/releases/' + mine) && options && options.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'draft', release_date: '2026-09-01' } }) };
        }
        if (String(url).includes('/releases/' + mine)) {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, title: 'Night Drive', status: 'draft' } }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              solo_owned_100: true,
              release_date: '2026-09-12',
              made_how: 'no_ai',
              rights_confirmed: true,
              legal_first: 'Ada',
              legal_last: 'Night',
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).status, 'pending');
          assert.strictEqual(json(res).signwell_status, 'solo');
          assert.strictEqual(json(res).document_id, null);
          assert.ok(!calls.some((call) => String(call.url).includes('signwell.com')));
          assert.ok(!calls.some((call) => String(call.url).includes('/api/signwell')));
          const next = await accounts.findById(row.id);
          const stored = ((next && next.profile && next.profile.releases) || []).find(function (item) {
            return String((item && (item.tonegrid_release_id || item.id)) || '') === mine;
          });
          assert.ok(stored);
          assert.strictEqual(stored.solo_owned_100, true);
          assert.strictEqual(stored.legal_first, 'Ada');
          assert.strictEqual(stored.legal_last, 'Night');
          assert.strictEqual(stored.signwell_document_id, '');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const prevKey = process.env.SIGNWELL_API_KEY;
      const prevTpl = process.env.SIGNWELL_TEMPLATE_ID;
      process.env.SIGNWELL_API_KEY = 'signwell-test-key-not-for-commit';
      process.env.SIGNWELL_TEMPLATE_ID = 'tpl_test_not_for_commit';
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method, body: options && options.body });
        if (String(url).includes('signwell.com/api/v1/documents/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'doc_pending_01',
              status: 'Pending',
              recipients: [
                { placeholder_name: 'Writer 1', status: 'Pending' },
                { placeholder_name: 'Writer 2', status: 'Pending' },
                { placeholder_name: 'document sender', status: 'Pending' },
              ],
            }),
          };
        }
        if (String(url).includes('/releases/' + mine + '/submit')) {
          return { ok: true, status: 200, json: async () => ({ message: 'Release submitted for review.', status: 'pending' }) };
        }
        if (String(url).includes('/releases/' + mine + '/dsps')) {
          return { ok: true, status: 200, json: async () => ({ dsps: [{ dsp_name: 'YouTube Music' }] }) };
        }
        if (String(url).includes('/releases/' + mine) && options && options.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'draft', release_date: '2026-09-01' } }) };
        }
        if (String(url).includes('/releases/' + mine)) {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, title: 'Night Drive', status: 'draft' } }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const res = mockRes();
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              document_id: 'doc_pending_01',
              release_date: '2026-09-12',
              made_how: 'no_ai',
              rights_confirmed: true,
              writers: [
                { name: 'Writer One', email: 'writer1@example.com', share: 50 },
                { name: 'Writer Two', email: 'writer2@example.com', share: 50 },
              ],
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).status, 'pending');
          assert.strictEqual(json(res).signed, false);
          assert.ok(json(res).signwell_status);
          assert.notStrictEqual(json(res).code, 'SIGNWELL_UNSIGNED');
          assert.ok(calls.some((call) => String(call.url).includes('/releases/' + mine + '/submit')));
          assert.ok(!calls.some((call) => String(call.url).includes('document_templates')));
        });
      } finally {
        global.fetch = originalFetch;
        if (prevKey === undefined) delete process.env.SIGNWELL_API_KEY;
        else process.env.SIGNWELL_API_KEY = prevKey;
        if (prevTpl === undefined) delete process.env.SIGNWELL_TEMPLATE_ID;
        else process.env.SIGNWELL_TEMPLATE_ID = prevTpl;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const prevKey = process.env.SIGNWELL_API_KEY;
      const prevTpl = process.env.SIGNWELL_TEMPLATE_ID;
      process.env.SIGNWELL_API_KEY = 'signwell-test-key-not-for-commit';
      process.env.SIGNWELL_TEMPLATE_ID = 'tpl_test_not_for_commit';
      const originalFetch = global.fetch;
      const calls = [];
      let createBody = null;
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method, body: options && options.body });
        if (String(url).includes('document_templates')) {
          createBody = JSON.parse(options.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'doc_created_on_submit',
              status: 'Pending',
              recipients: [
                { placeholder_name: 'Writer 1', status: 'Pending' },
                { placeholder_name: 'Writer 2', status: 'Pending' },
                { placeholder_name: 'document sender', status: 'Pending' },
              ],
            }),
          };
        }
        if (String(url).includes('signwell.com/api/v1/documents/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'doc_created_on_submit',
              status: 'Pending',
              recipients: [
                { placeholder_name: 'Writer 1', status: 'Pending' },
                { placeholder_name: 'Writer 2', status: 'Pending' },
              ],
            }),
          };
        }
        if (String(url).includes('/releases/' + mine + '/submit')) {
          return { ok: true, status: 200, json: async () => ({ message: 'Release submitted for review.', status: 'pending' }) };
        }
        if (String(url).includes('/releases/' + mine + '/dsps')) {
          return { ok: true, status: 200, json: async () => ({ dsps: [{ dsp_name: 'YouTube Music' }] }) };
        }
        if (String(url).includes('/releases/' + mine) && options && options.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'draft', release_date: '2026-09-01' } }) };
        }
        if (String(url).includes('/releases/' + mine)) {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, title: 'Night Drive', status: 'draft' } }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const res = mockRes();
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              songTitle: 'Night Drive',
              release_date: '2026-09-12',
              made_how: 'no_ai',
              rights_confirmed: true,
              writers: [
                { name: 'Writer One', email: 'writer1@example.com', share: 50, pro: 'ASCAP' },
                { name: 'Writer Two', email: 'writer2@example.com', share: 50, pro: 'BMI' },
              ],
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).status, 'pending');
          assert.strictEqual(json(res).signed, false);
          assert.strictEqual(json(res).document_id, 'doc_created_on_submit');
          assert.ok(createBody);
          assert.strictEqual(createBody.test_mode, false);
          assert.strictEqual(createBody.recipients[1].placeholder_name, 'Writer 2');
          assert.notStrictEqual(createBody.recipients[1].send_email, false);
          assert.ok(calls.some((call) => String(call.url).includes('/releases/' + mine + '/submit')));
        });
      } finally {
        global.fetch = originalFetch;
        if (prevKey === undefined) delete process.env.SIGNWELL_API_KEY;
        else process.env.SIGNWELL_API_KEY = prevKey;
        if (prevTpl === undefined) delete process.env.SIGNWELL_TEMPLATE_ID;
        else process.env.SIGNWELL_TEMPLATE_ID = prevTpl;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const prevKey = process.env.SIGNWELL_API_KEY;
      const prevTpl = process.env.SIGNWELL_TEMPLATE_ID;
      process.env.SIGNWELL_API_KEY = 'signwell-test-key-not-for-commit';
      process.env.SIGNWELL_TEMPLATE_ID = 'tpl_test_not_for_commit';
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method, body: options && options.body });
        if (String(url).includes('signwell.com/api/v1/documents/')) {
          return { ok: true, status: 200, json: async () => ({ id: 'doc_split_sheet_01', status: 'Completed', recipients: [{ status: 'Completed' }] }) };
        }
        if (String(url).includes('/releases/' + mine + '/submit')) {
          return { ok: true, status: 200, json: async () => ({ message: 'Release submitted for review.', status: 'pending' }) };
        }
        if (String(url).includes('/releases/' + mine + '/dsps')) {
          return { ok: true, status: 200, json: async () => ({ dsps: [{ dsp_name: 'YouTube Music' }] }) };
        }
        if (String(url).includes('/releases/' + mine) && options && options.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'draft', release_date: '2026-09-01' } }) };
        }
        if (String(url).includes('/releases/' + mine)) {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, title: 'Night Drive', status: 'draft', tracks: [{ uuid: '33333333-3333-4333-8333-333333333333', title: 'Night Drive' }] } }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const res = mockRes();
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              document_id: 'doc_split_sheet_01',
              release_date: '2026-09-12',
              made_how: 'no_ai',
              rights_confirmed: true,
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          const body = json(res);
          assert.strictEqual(body.status, 'pending');
          assert.strictEqual(body.signed, true);
          assert.ok(body.dsps.indexOf('youtube-music') !== -1);
          assert.ok(calls.some((call) => String(call.url).includes('/releases/' + mine + '/dsps') && call.method === 'POST'));
          assert.ok(calls.some((call) => String(call.url).includes('/releases/' + mine + '/submit') && call.method === 'POST'));
          assert.ok(calls.some((call) => {
            const url = String(call.url);
            return url.includes('/releases/' + mine) && !url.includes('/dsps') && !url.includes('/submit') && call.method === 'PATCH';
          }));
          assert.ok(!calls.some((call) => {
            const url = String(call.url);
            return url.includes('/releases/' + mine) && !url.includes('/dsps') && !url.includes('/submit') && !url.includes('/rights') && call.method === 'PUT';
          }));
          const rightsCall = calls.find((call) => String(call.url).includes('/releases/' + mine + '/rights') && call.method === 'PUT');
          assert.ok(rightsCall, 'submit must PUT the documented rights envelope');
          const rightsBody = JSON.parse(rightsCall.body || '{}');
          assert.strictEqual(rightsBody.p_line, '(P) 2026 Ada Night');
          assert.strictEqual(rightsBody.c_line, '(C) 2026 Ada Night');
          assert.strictEqual(rightsBody.copyright_year, 2026);
          const submitHop = calls.find((call) => String(call.url).includes('/releases/' + mine + '/submit') && call.method === 'POST');
          assert.deepStrictEqual(JSON.parse(submitHop.body || '{}'), {});
          assert.ok(calls.some((call) => /\/writers$/.test(String(call.url)) && call.method === 'POST'));
          assert.ok(calls.some((call) => /\/tracks\/[^/]+\/writers$/.test(String(call.url)) && call.method === 'PUT'));
          assert.ok(!calls.some((call) => String(call.url).includes('/distribute')));
          assert.ok(!calls.some((call) => String(call.url).includes('/approve')));
          assert.ok(!calls.some((call) => String(call.body || '').includes('includes_ai')), 'no_ai submit must not send includes_ai');

          const noAttest = mockRes();
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              document_id: 'doc_split_sheet_01',
              release_date: '2026-09-12',
            },
          }, noAttest);
          assert.strictEqual(noAttest.statusCode, 400);
          assert.strictEqual(json(noAttest).error, 'made_how is required.');

          const aiMissingHuman = mockRes();
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              document_id: 'doc_split_sheet_01',
              release_date: '2026-09-12',
              made_how: 'ai_assisted',
              human_elements: [],
              human_contribution: '',
              rights_confirmed: true,
            },
          }, aiMissingHuman);
          assert.strictEqual(aiMissingHuman.statusCode, 400);
          assert.strictEqual(json(aiMissingHuman).error, 'human_elements is required.');

          const fullAi = mockRes();
          const beforeFullAi = calls.length;
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              document_id: 'doc_split_sheet_01',
              release_date: '2026-09-12',
              made_how: 'fully_ai',
              rights_confirmed: true,
            },
          }, fullAi);
          assert.strictEqual(fullAi.statusCode, 200);
          const fullAiHops = calls.slice(beforeFullAi);
          const fullAiPatch = fullAiHops.find((call) => {
            return call.method === 'PATCH' && /\/tracks\/[^/]+$/.test(String(call.url));
          });
          assert.ok(fullAiPatch, 'fully_ai submit must PATCH the track');
          const fullAiBody = JSON.parse(fullAiPatch.body || '{}');
          assert.deepStrictEqual(fullAiBody.track_properties, ['includes_ai']);
          assert.strictEqual(fullAiBody.ai_service_other, 'generative AI');
          assert.strictEqual(fullAiBody.ai_service, undefined);
          assert.ok(!/suno/i.test(JSON.stringify(fullAiBody)));

          const assisted = mockRes();
          const beforeAssisted = calls.length;
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              document_id: 'doc_split_sheet_01',
              release_date: '2026-09-12',
              made_how: 'ai_assisted',
              human_elements: ['Original lyrics'],
              human_contribution: 'I wrote the lyrics and sang the lead.',
              rights_confirmed: true,
            },
          }, assisted);
          assert.strictEqual(assisted.statusCode, 200);
          const assistedHops = calls.slice(beforeAssisted);
          const assistedPatch = assistedHops.find((call) => {
            return call.method === 'PATCH' && /\/tracks\/[^/]+$/.test(String(call.url));
          });
          assert.ok(assistedPatch, 'ai_assisted submit must PATCH the track');
          const assistedBody = JSON.parse(assistedPatch.body || '{}');
          assert.deepStrictEqual(assistedBody.track_properties, ['includes_ai']);
          assert.strictEqual(assistedBody.ai_service_other, 'I wrote the lyrics and sang the lead.');
          assert.strictEqual(assistedBody.ai_service, undefined);
          assert.ok(!/suno/i.test(JSON.stringify(assistedBody)));
        });
      } finally {
        global.fetch = originalFetch;
        if (prevKey === undefined) delete process.env.SIGNWELL_API_KEY;
        else process.env.SIGNWELL_API_KEY = prevKey;
        if (prevTpl === undefined) delete process.env.SIGNWELL_TEMPLATE_ID;
        else process.env.SIGNWELL_TEMPLATE_ID = prevTpl;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const prevKey = process.env.SIGNWELL_API_KEY;
      const prevTpl = process.env.SIGNWELL_TEMPLATE_ID;
      process.env.SIGNWELL_API_KEY = 'signwell-test-key-not-for-commit';
      process.env.SIGNWELL_TEMPLATE_ID = 'tpl_test_not_for_commit';
      const originalFetch = global.fetch;
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        if (String(url).includes('signwell.com')) {
          return { ok: false, status: 402, json: async () => ({ error: 'Your trial ended on August 20, 2026.' }) };
        }
        if (String(url).includes('/releases/' + mine + '/submit')) {
          return { ok: true, status: 200, json: async () => ({ message: 'Release submitted for review.', status: 'pending' }) };
        }
        if (String(url).includes('/releases/' + mine + '/dsps')) {
          return { ok: true, status: 200, json: async () => ({ dsps: [{ dsp_name: 'YouTube Music' }] }) };
        }
        if (String(url).includes('/releases/' + mine) && options && options.method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'draft', release_date: '2026-09-01' } }) };
        }
        return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'draft' } }) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const res = mockRes();
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              document_id: 'doc_split_sheet_01',
              release_date: '2026-09-12',
              made_how: 'no_ai',
              rights_confirmed: true,
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).status, 'pending');
          assert.strictEqual(json(res).signed, false);
          assert.strictEqual(json(res).signwell_status, 'awaiting_signature');
        });
      } finally {
        global.fetch = originalFetch;
        if (prevKey === undefined) delete process.env.SIGNWELL_API_KEY;
        else process.env.SIGNWELL_API_KEY = prevKey;
        if (prevTpl === undefined) delete process.env.SIGNWELL_TEMPLATE_ID;
        else process.env.SIGNWELL_TEMPLATE_ID = prevTpl;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method, body: options && options.body });
        if (options && options.method === 'PATCH' && String(url).includes('/releases/' + mine)) {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, title: 'Night Drive Live', genre: 'Afrobeats', language: 'en' } }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const res = mockRes();
          await oneRelease({
            method: 'PUT',
            headers,
            id: mine,
            body: { title: 'Night Drive Live', genre: 'Afrobeats', language: 'en', release_date: '2026-09-12' },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(calls.length, 1);
          assert.strictEqual(calls[0].method, 'PATCH');
          const sent = JSON.parse(calls[0].body);
          assert.strictEqual(sent.title, 'Night Drive Live');
          assert.strictEqual(sent.genre, 'Afrobeats');
          assert.strictEqual(sent.language, 'en');
          const fresh = await accounts.findById(_row.id);
          const stored = require('./profile').readStored(fresh);
          const kept = (stored.releases || []).find(function (row) {
            return row.tonegrid_release_id === mine;
          });
          assert.ok(kept, 'store PUT must write the local release record');
          assert.strictEqual(kept.title, 'Night Drive Live');
          assert.strictEqual(kept.genre, 'Afrobeats');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method, body: options && options.body });
        return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, title: 'Fuvtu Edit', status: 'pending' } }) };
      };
      try {
        await withAccountUser({
          plan: 'basic',
          artist: 'Fuvtu',
          artistId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          releaseId: mine,
        }, async (row, headers) => {
          assert.strictEqual(row.plan, 'basic');
          assert.deepStrictEqual(row.tonegrid_release_ids, [mine]);
          const res = mockRes();
          await oneRelease({
            method: 'PUT',
            headers,
            id: mine,
            body: { title: 'Fuvtu Edit', genre: 'Electronic', language: 'en', release_date: '2026-09-12' },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.notStrictEqual(json(res).code, 'PLAN_LIMIT');
          assert.ok(calls.every((call) => call.method !== 'POST' || !String(call.url).endsWith('/releases')));
          assert.ok(calls.some((call) => call.method === 'PATCH' && String(call.url).endsWith('/releases/' + mine)));
          const sent = JSON.parse(calls[0].body);
          assert.strictEqual(sent.title, 'Fuvtu Edit');
          assert.strictEqual(sent.price, undefined);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch() {
        return { ok: false, status: 409, json: async () => ({ error: 'Only draft or pending releases can be updated.' }) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const res = mockRes();
          await oneRelease({
            method: 'PUT',
            headers,
            id: mine,
            body: { title: 'Too Late' },
          }, res);
          assert.strictEqual(res.statusCode, 409);
          assert.strictEqual(json(res).error, 'Only draft or pending releases can be updated.');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      await withAccountUser({ releaseId: '11111111-1111-4111-8111-111111111111' }, async (_row, headers) => {
        const missing = mockRes();
        await tonegridApi({
          method: 'POST',
          headers,
          url: '/api/tonegrid',
          query: { resource: 'submit', id: '' },
          body: { solo_owned_100: true, release_date: '2026-09-12', made_how: 'no_ai', rights_confirmed: true },
        }, missing);
        assert.strictEqual(missing.statusCode, 400);
        assert.strictEqual(json(missing).error, 'Save the upload first.');

        const invalid = mockRes();
        await submitRelease({
          method: 'POST',
          headers,
          id: 'not-a-release',
          body: { solo_owned_100: true, release_date: '2026-09-12', made_how: 'no_ai', rights_confirmed: true },
        }, invalid);
        assert.strictEqual(invalid.statusCode, 400);
        assert.strictEqual(json(invalid).error, 'Save the upload first.');
        assert.notStrictEqual(json(invalid).error, 'Endpoint not found.');
      });
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      const clientKey = 'plaiground-submit-' + mine;
      const reused = 'Idempotency-Key reused with a different request body. Either send the exact same body, or rotate the key.';
      global.fetch = async function mockFetch(url, options) {
        const method = options && options.method;
        const headers = (options && options.headers) || {};
        const key = String(headers['Idempotency-Key'] || '');
        calls.push({ url: String(url), method, body: options && options.body, headers });
        if (key && key === clientKey) {
          return { ok: false, status: 422, json: async () => ({ error: reused }) };
        }
        if (String(url).includes('/releases/' + mine + '/submit')) {
          return { ok: true, status: 200, json: async () => ({ message: 'Release submitted for review.', status: 'pending' }) };
        }
        if (String(url).includes('/releases/' + mine + '/dsps')) {
          return { ok: true, status: 200, json: async () => ({ dsps: [{ dsp_name: 'YouTube Music' }] }) };
        }
        if (String(url).endsWith('/releases/' + mine) && method === 'PUT') {
          return { ok: false, status: 404, json: async () => ({ error: 'Endpoint not found.' }) };
        }
        if (String(url).endsWith('/releases/' + mine) && method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'draft', release_date: '2026-09-12' } }) };
        }
        if (String(url).includes('/releases/' + mine)) {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, title: 'Night Drive', status: 'draft' } }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const body = {
            solo_owned_100: true,
            release_date: '2026-09-12',
            made_how: 'no_ai',
            rights_confirmed: true,
          };
          const first = mockRes();
          await submitRelease({
            method: 'POST',
            headers: Object.assign({ 'idempotency-key': clientKey }, headers),
            id: mine,
            body,
          }, first);
          assert.strictEqual(first.statusCode, 200);
          assert.strictEqual(json(first).status, 'pending');

          const mutating = calls.filter((call) => call.method && call.method !== 'GET');
          const keys = mutating.map(hopKeyOf);
          assert.ok(keys.length >= 3);
          assert.ok(keys.every((key) => key && key !== clientKey));
          const patchKey = hopKeyOf(mutating.find((call) => String(call.url).endsWith('/releases/' + mine) && call.method === 'PATCH'));
          const dspsKey = hopKeyOf(mutating.find((call) => String(call.url).includes('/dsps') && call.method === 'POST'));
          const submitKey = hopKeyOf(mutating.find((call) => String(call.url).includes('/submit') && call.method === 'POST'));
          assert.ok(patchKey.startsWith('plaiground-patch-date-'));
          assert.ok(dspsKey.startsWith('plaiground-dsps-post-'));
          assert.ok(submitKey.startsWith('plaiground-submit-'));
          assert.notStrictEqual(patchKey, dspsKey);
          assert.notStrictEqual(dspsKey, submitKey);
          assert.notStrictEqual(patchKey, submitKey);

          const before = mutating.length;
          const second = mockRes();
          await submitRelease({
            method: 'POST',
            headers: Object.assign({ 'idempotency-key': clientKey }, headers),
            id: mine,
            body,
          }, second);
          assert.strictEqual(second.statusCode, 200);
          const retryMutating = calls.slice(before).filter((call) => call.method && call.method !== 'GET');
          assert.strictEqual(
            hopKeyOf(retryMutating.find((call) => String(call.url).endsWith('/releases/' + mine) && call.method === 'PATCH')),
            patchKey
          );
          assert.strictEqual(
            hopKeyOf(retryMutating.find((call) => String(call.url).includes('/dsps') && call.method === 'POST')),
            dspsKey
          );
          assert.strictEqual(
            hopKeyOf(retryMutating.find((call) => String(call.url).includes('/submit') && call.method === 'POST')),
            submitKey
          );
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        const method = options && options.method;
        calls.push({ url: String(url), method, body: options && options.body });
        if (String(url).includes('/releases/' + mine + '/submit')) {
          return { ok: true, status: 200, json: async () => ({ message: 'Release submitted for review.', status: 'pending' }) };
        }
        if (String(url).includes('/releases/' + mine + '/dsps') && method === 'POST') {
          return { ok: false, status: 404, json: async () => ({ error: 'Endpoint not found.' }) };
        }
        if (String(url).includes('/releases/' + mine + '/dsps') && method === 'PUT') {
          return { ok: true, status: 200, json: async () => ({ dsps: [{ dsp_name: 'Spotify' }] }) };
        }
        if (String(url).endsWith('/releases/' + mine) && method === 'PUT') {
          return { ok: false, status: 404, json: async () => ({ error: 'Endpoint not found.' }) };
        }
        if (String(url).endsWith('/releases/' + mine) && method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'draft', release_date: '2026-09-12' } }) };
        }
        if (String(url).includes('/releases/' + mine)) {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, title: 'Night Drive', status: 'draft' } }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const res = mockRes();
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              solo_owned_100: true,
              release_date: '2026-09-12',
              made_how: 'no_ai',
              rights_confirmed: true,
            },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).status, 'pending');
          assert.ok(calls.some((call) => String(call.url).includes('/releases/' + mine + '/dsps') && call.method === 'POST'));
          assert.ok(calls.some((call) => String(call.url).includes('/releases/' + mine + '/dsps') && call.method === 'PUT'));
          assert.ok(calls.some((call) => String(call.url).includes('/releases/' + mine + '/submit') && call.method === 'POST'));
          assert.ok(calls.some((call) => String(call.url).endsWith('/releases/' + mine) && call.method === 'PATCH'));
          assert.ok(!calls.some((call) => String(call.url).endsWith('/releases/' + mine) && call.method === 'PUT'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        const method = options && options.method;
        calls.push({ url: String(url), method });
        if (String(url).includes('/releases/' + mine + '/submit')) {
          return { ok: true, status: 200, json: async () => ({ message: 'Release submitted for review.', status: 'pending' }) };
        }
        if (String(url).includes('/releases/' + mine + '/dsps')) {
          return { ok: false, status: 404, json: async () => ({ error: 'Endpoint not found.' }) };
        }
        if (String(url).includes('/releases/' + mine) && method === 'PATCH') {
          return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'draft', release_date: '2026-09-12' } }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: { uuid: mine, title: 'Night Drive', status: 'draft', dsps: ['spotify', 'youtube-music'] },
          }),
        };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const skipped = mockRes();
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              solo_owned_100: true,
              release_date: '2026-09-12',
              made_how: 'no_ai',
              rights_confirmed: true,
            },
          }, skipped);
          assert.strictEqual(skipped.statusCode, 200);
          assert.strictEqual(json(skipped).status, 'pending');
          assert.ok(calls.some((call) => String(call.url).includes('/releases/' + mine + '/submit') && call.method === 'POST'));

          const empty = mockRes();
          global.fetch = async function mockEmpty(url, options) {
            const method = options && options.method;
            calls.push({ url: String(url), method });
            if (String(url).includes('/releases/' + mine + '/dsps')) {
              return { ok: false, status: 404, json: async () => ({ error: 'Endpoint not found.' }) };
            }
            if (String(url).includes('/releases/' + mine + '/submit')) {
              return { ok: true, status: 200, json: async () => ({ status: 'pending' }) };
            }
            if (method === 'PATCH') {
              return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'draft', release_date: '2026-09-12' } }) };
            }
            return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, title: 'Night Drive', status: 'draft' } }) };
          };
          await submitRelease({
            method: 'POST',
            headers,
            id: mine,
            body: {
              solo_owned_100: true,
              release_date: '2026-09-12',
              made_how: 'no_ai',
              rights_confirmed: true,
            },
          }, empty);
          assert.strictEqual(empty.statusCode, 404);
          assert.strictEqual(json(empty).error, 'Endpoint not found.');
          assert.ok(!String(empty.body).includes('Not found.'));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: (options && options.method) || 'GET' });
        if (String(url).includes('/ddex/deliveries')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                deliveries: [
                  { dsp: 'spotify', status: 'live', dsp_release_id: 'spotify:album:7v0Ytestalbumid00001' },
                  { dsp: 'apple-music', status: 'live', dsp_release_id: '1543210987' },
                ],
              },
            }),
          };
        }
        if (String(url).includes('/releases/' + mine)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ release: { uuid: mine, title: 'Night Drive', status: 'live' } }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({ releaseId: mine }, async (_row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'GET', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 200);
          const body = json(res);
          assert.strictEqual(body.status, 'live');
          assert.ok(calls.some((call) => String(call.url).includes('/ddex/deliveries')));
          assert.strictEqual(body.deliveries[0].dsp_release_id, 'spotify:album:7v0Ytestalbumid00001');
          assert.strictEqual(tonegridApi.pickDeliveries(body.deliveries).length, 2);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      let storeDeleted = false;
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method });
        if (options && options.method === 'DELETE' && String(url).includes('/releases/' + mine)) {
          storeDeleted = true;
          return { ok: true, status: 204, json: async () => { throw new Error('empty'); } };
        }
        if (storeDeleted && String(url).includes('/releases/' + mine) && (!options || !options.method || options.method === 'GET')) {
          return { ok: false, status: 404, json: async () => ({ error: 'Release not found.' }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: {
              uuid: mine,
              title: 'Night Drive',
              status: 'draft',
              tracks: [{ uuid: '22222222-2222-4222-8222-222222222222', title: 'Night Drive' }],
            },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'basic', releaseId: mine }, async (row, headers) => {
          assert.deepStrictEqual(row.tonegrid_release_ids, [mine]);
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 200);
          const body = json(res);
          assert.strictEqual(body.removed, true);
          assert.strictEqual(body.redirect, '/releases.html');
          assert.strictEqual(body.upload.allowed, true);
          assert.ok(calls.some((call) => call.method === 'DELETE' && String(call.url).includes('/releases/' + mine)));
          assert.ok(!calls.some((call) => String(call.url).includes('/ddex/purge')));
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, []);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method });
        if (options && options.method === 'POST' && String(url).includes('/takedown')) {
          return { ok: true, status: 202, json: async () => ({ status: 'takedown_submitted' }) };
        }
        if (String(url).includes('/ddex/deliveries')) {
          return { ok: true, status: 200, json: async () => ({ deliveries: [] }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: {
              uuid: mine,
              title: 'mexeu',
              status: 'pending',
              tracks: [{ uuid: '22222222-2222-4222-8222-222222222222', title: 'mexeu' }],
            },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'creator', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 202);
          const body = json(res);
          assert.strictEqual(body.removed, false);
          assert.strictEqual(body.takedown, true);
          assert.strictEqual(body.status, 'takedown_submitted');
          assert.ok(calls.some((call) => call.method === 'POST' && String(call.url).includes('/takedown')));
          assert.ok(!calls.some((call) => call.method === 'DELETE'));
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine]);
          const stored = profile.readStored(next);
          const rel = (stored.releases || []).find((item) => String(item.tonegrid_release_id) === mine);
          assert.strictEqual(rel && rel.tonegrid_status, 'takedown_submitted');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method });
        if (options && options.method === 'POST' && String(url).includes('/takedown')) {
          return { ok: false, status: 409, json: async () => ({ error: 'Only draft or rejected releases can be deleted.' }) };
        }
        if (options && options.method === 'POST' && String(url).includes('/ddex/purge')) {
          return { ok: false, status: 409, json: async () => ({ error: 'Only draft or rejected releases can be deleted.' }) };
        }
        if (String(url).includes('/ddex/deliveries')) {
          return { ok: true, status: 200, json: async () => ({ deliveries: [] }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: {
              uuid: mine,
              title: 'mexeu',
              status: 'pending',
              tracks: [{ uuid: '22222222-2222-4222-8222-222222222222', title: 'mexeu' }],
            },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'creator', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 409);
          assert.strictEqual(json(res).removed, false);
          assert.strictEqual(json(res).takedown, false);
          assert.strictEqual(json(res).error, 'The store could not take this release down.');
          assert.ok(!/ToneGrid|DistroKid/i.test(json(res).error));
          assert.ok(calls.some((call) => call.method === 'POST' && String(call.url).includes('/takedown')));
          assert.ok(!calls.some((call) => call.method === 'DELETE'));
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine]);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method });
        if (options && options.method === 'POST' && String(url).includes('/takedown')) {
          return { ok: false, status: 409, json: async () => ({ error: 'Only draft or rejected releases can be deleted.' }) };
        }
        if (options && options.method === 'POST' && String(url).includes('/ddex/purge')) {
          return { ok: false, status: 409, json: async () => ({ error: 'Only draft or rejected releases can be deleted.' }) };
        }
        if (String(url).includes('/ddex/deliveries')) {
          return { ok: true, status: 200, json: async () => ({ deliveries: [] }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: {
              uuid: mine,
              title: 'mexeu',
              status: 'processing',
              tracks: [{ uuid: '22222222-2222-4222-8222-222222222222', title: 'mexeu' }],
            },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'creator', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 409);
          assert.strictEqual(json(res).removed, false);
          assert.strictEqual(json(res).takedown, false);
          assert.strictEqual(json(res).error, 'The store could not take this release down.');
          assert.ok(!/ToneGrid|DistroKid/i.test(json(res).error));
          assert.ok(calls.some((call) => call.method === 'POST' && String(call.url).includes('/takedown')));
          assert.ok(!calls.some((call) => call.method === 'DELETE'));
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine]);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method });
        if (options && options.method === 'DELETE' && String(url).includes('/releases/' + mine)) {
          return { ok: false, status: 502, json: async () => ({ error: 'Upstream timeout' }) };
        }
        if (String(url).includes('/ddex/deliveries')) {
          return { ok: true, status: 200, json: async () => ({ deliveries: [] }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: {
              uuid: mine,
              title: 'mexeu',
              status: 'draft',
              tracks: [{ uuid: '22222222-2222-4222-8222-222222222222', title: 'mexeu' }],
            },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'creator', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 502);
          assert.strictEqual(json(res).removed, false);
          assert.strictEqual(json(res).error, 'Upstream timeout');
          assert.ok(calls.some((call) => call.method === 'DELETE' && String(call.url).includes('/releases/' + mine)));
          assert.ok(!calls.some((call) => String(call.url).includes('/takedown') || String(call.url).includes('/ddex/purge')));
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine]);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      let storeDeleted = false;
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method });
        if (options && options.method === 'DELETE' && String(url).includes('/releases/' + mine)) {
          storeDeleted = true;
          return { ok: true, status: 204, json: async () => { throw new Error('empty'); } };
        }
        if (storeDeleted && String(url).includes('/releases/' + mine) && (!options || !options.method || options.method === 'GET')) {
          return { ok: false, status: 404, json: async () => ({ error: 'Release not found.' }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: {
              uuid: mine,
              title: 'Night Drive',
              status: 'rejected',
              tracks: [{ uuid: '22222222-2222-4222-8222-222222222222', title: 'Night Drive' }],
            },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'creator', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).removed, true);
          assert.ok(calls.some((call) => call.method === 'DELETE' && String(call.url).includes('/releases/' + mine)));
          assert.ok(!calls.some((call) => String(call.url).includes('/takedown') || String(call.url).includes('/ddex/purge')));
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, []);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      let storeDeleted = false;
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method });
        if (options && options.method === 'DELETE' && String(url).includes('/releases/' + mine)) {
          storeDeleted = true;
          return { ok: false, status: 404, json: async () => ({ error: 'Release not found.' }) };
        }
        if (storeDeleted && String(url).includes('/releases/' + mine) && (!options || !options.method || options.method === 'GET')) {
          return { ok: false, status: 404, json: async () => ({ error: 'Release not found.' }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: {
              uuid: mine,
              title: 'The recording.',
              status: 'draft',
              tracks: [{ uuid: '22222222-2222-4222-8222-222222222222', title: 'The recording.' }],
            },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'creator', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).removed, true);
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, []);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method });
        if (options && options.method === 'POST' && String(url).includes('/ddex/purge')) {
          return { ok: true, status: 202, json: async () => ({ status: 'takedown_submitted' }) };
        }
        if (String(url).includes('/ddex/deliveries')) {
          return { ok: true, status: 200, json: async () => ({ deliveries: [] }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: {
              uuid: mine,
              title: 'Night Drive',
              status: 'live',
              tracks: [{ uuid: '22222222-2222-4222-8222-222222222222', title: 'Night Drive' }],
            },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'basic', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 202);
          const body = json(res);
          assert.strictEqual(body.removed, false);
          assert.strictEqual(body.takedown, true);
          assert.strictEqual(body.status, 'takedown_submitted');
          assert.ok(calls.some((call) => call.method === 'POST' && String(call.url).includes('/releases/' + mine + '/ddex/purge')));
          assert.ok(!calls.some((call) => call.method === 'DELETE'));
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine]);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method });
        if (options && options.method === 'POST' && String(url).includes('/ddex/purge')) {
          return { ok: false, status: 422, json: async () => ({ error: 'DSP rejected takedown' }) };
        }
        if (String(url).includes('/ddex/deliveries')) {
          return { ok: true, status: 200, json: async () => ({ deliveries: [] }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: {
              uuid: mine,
              title: 'Night Drive',
              status: 'live',
              tracks: [{ uuid: '22222222-2222-4222-8222-222222222222', title: 'Night Drive' }],
            },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'basic', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 422);
          assert.strictEqual(json(res).error, 'DSP rejected takedown');
          assert.strictEqual(json(res).removed, false);
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine]);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        calls.push({ url: String(url), method: options && options.method });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: {
              uuid: mine,
              title: 'Night Drive',
              status: 'taken_down',
              tracks: [{ uuid: '22222222-2222-4222-8222-222222222222', title: 'Night Drive' }],
            },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'basic', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 202);
          assert.strictEqual(json(res).removed, false);
          assert.strictEqual(json(res).status, 'takedown_submitted');
          assert.ok(!/Taken down|Deleted/i.test(JSON.stringify(json(res))));
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine]);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const mine = '11111111-1111-4111-8111-111111111111';
      let storeDeleted = false;
      global.fetch = async function mockFetch(url, options) {
        if (options && options.method === 'DELETE' && String(url).includes('/releases/' + mine)) {
          storeDeleted = true;
          return { ok: true, status: 204, json: async () => ({}) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: {
              uuid: mine,
              title: 'Ghost Draft',
              status: 'draft',
              tracks: [{ uuid: '22222222-2222-4222-8222-222222222222', title: 'Ghost Draft' }],
            },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'creator', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 409);
          assert.strictEqual(json(res).removed, false);
          assert.ok(storeDeleted);
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine], 'store-backed draft stays until GET 404');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const mine = '11111111-1111-4111-8111-111111111111';
      let gone = false;
      global.fetch = async function mockFetch(url, options) {
        if (options && options.method === 'POST' && String(url).includes('/ddex/purge')) {
          gone = true;
          return { ok: true, status: 202, json: async () => ({ status: 'takedown_submitted' }) };
        }
        if (gone && String(url).includes('/releases/' + mine) && (!options || !options.method || options.method === 'GET')) {
          return { ok: false, status: 404, json: async () => ({ error: 'Release not found.' }) };
        }
        if (String(url).includes('/ddex/deliveries')) {
          return { ok: true, status: 200, json: async () => ({ deliveries: [] }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            release: { uuid: mine, title: 'Night Drive', status: 'live', tracks: [] },
          }),
        };
      };
      try {
        await withAccountUser({ plan: 'basic', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).removed, true);
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine], 'live takedown keeps the lifetime slot');
          assert.strictEqual(plans.evaluate(next).allowed, false);
          const stored = profile.readStored(next);
          const rel = (stored.releases || []).find((item) => String(item.tonegrid_release_id) === mine);
          assert.strictEqual(rel && rel.tonegrid_status, 'store_gone');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url, options) {
        if (String(url).includes('/releases/' + mine) && (!options || !options.method || options.method === 'GET')) {
          return { ok: false, status: 404, json: async () => ({ error: 'Release not found.' }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({ plan: 'basic', releaseId: mine }, async (row, headers) => {
          await accounts.updateProfile(row.id, {
            profile: profile.applyReleaseStatus(profile.readStored(row), mine, 'takedown_submitted', ''),
          });
          const res = mockRes();
          await oneRelease({ method: 'GET', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 404);
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine]);
          const stored = profile.readStored(next);
          const rel = (stored.releases || []).find((item) => String(item.tonegrid_release_id) === mine);
          assert.strictEqual(rel && rel.tonegrid_status, 'store_gone');
          const listed = mockRes();
          await releases({ method: 'GET', headers }, listed);
          assert.strictEqual(listed.statusCode, 200);
          assert.strictEqual((json(listed).releases || []).length, 0);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url) {
        if (String(url).includes('/releases/' + mine)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ release: { uuid: mine, title: 'Night Drive', status: 'taken_down', tracks: [] } }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({ plan: 'basic', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await storeWebhook({
            method: 'POST',
            headers,
            body: { release_id: mine, status: 'taken_down' },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).removed, false);
          assert.strictEqual(json(res).status, 'takedown_submitted');
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine]);
          const stored = profile.readStored(next);
          const rel = (stored.releases || []).find((item) => String(item.tonegrid_release_id) === mine);
          assert.strictEqual(rel && rel.tonegrid_status, 'takedown_submitted');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch(url) {
        if (String(url).includes('/releases/' + mine)) {
          return { ok: false, status: 404, json: async () => ({ error: 'Release not found.' }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        await withAccountUser({ plan: 'basic', releaseId: mine }, async (row, headers) => {
          const res = mockRes();
          await storeWebhook({
            method: 'POST',
            headers,
            body: { release_id: mine, status: 'taken_down' },
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(json(res).removed, true);
          const next = await accounts.findById(row.id);
          assert.deepStrictEqual(next.tonegrid_release_ids, [mine], 'webhook gone keeps the lifetime slot');
          assert.strictEqual(plans.evaluate(next).allowed, false);
          const stored = profile.readStored(next);
          const rel = (stored.releases || []).find((item) => String(item.tonegrid_release_id) === mine);
          assert.strictEqual(rel && rel.tonegrid_status, 'store_gone');
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      let called = 0;
      const mine = '11111111-1111-4111-8111-111111111111';
      global.fetch = async function mockFetch() {
        called += 1;
        throw new Error('ToneGrid should not be called');
      };
      try {
        await withAccountUser({ releaseId: '22222222-2222-4222-8222-222222222222' }, async (_row, headers) => {
          const res = mockRes();
          await oneRelease({ method: 'DELETE', headers, id: mine }, res);
          assert.strictEqual(res.statusCode, 404);
          assert.strictEqual(called, 0);
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  const root = path.join(__dirname, '..');
  const files = [
    'lib/tonegrid.js',
    'lib/tonegrid.test.js',
    'lib/signwell.js',
    'lib/signwell.test.js',
    'api/tonegrid.js',
    'lib/audio-chunks.js',
    'lib/live-player.js',
    'api/signwell.js',
    'api/me.js',
    'store-client.js',
    'earnings.js',
    'catalog.js',
    'earnings.html',
    'releases.html',
    'catalog-earnings.test.js',
    'tonegrid.client.test.js',
    'analytics.js',
    'analytics.html',
    'analytics.page.test.js',
    'README.md',
    '.env.example',
    'upload.html',
    'review.html',
    'lib/auth.js',
    'lib/accounts.js',
    'lib/plans.js',
    'lib/plans.test.js',
    'lib/route.js',
    'account.js',
    'api/auth.js',
    'lib/mail.js',
    'api/create-checkout-session.js',
    'lib/stripe-plans.js',
    'lib/stripe-webhook.js',
    'vercel.json',
  ];

  const apiRoot = path.join(root, 'api');
  const entrypoints = [];
  function walkApi(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((ent) => {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walkApi(full);
      else if (ent.isFile() && ent.name.endsWith('.js')) {
        entrypoints.push(path.relative(apiRoot, full).split(path.sep).join('/'));
      }
    });
  }
  walkApi(apiRoot);
  entrypoints.sort();
  assert.deepStrictEqual(entrypoints, [
    'auth.js',
    'create-checkout-session.js',
    'me.js',
    'plai-session.js',
    'signwell.js',
    'tonegrid.js',
    'youtube.js',
  ]);
  assert.strictEqual(tonegrid.isSandboxDistributionRefusal('account is sandbox-only'), true);
  assert.strictEqual(tonegrid.isSandboxDistributionRefusal('not enabled for distribution'), true);
  assert.strictEqual(tonegrid.isSandboxDistributionRefusal('We could not reach the store.'), false);
  assert.strictEqual(tonegrid.AUDIO_HOP_TIMEOUT_MS, 90000);
  assert.strictEqual(tonegrid.STORE_FORWARD_TIMEOUT_MS, 55000);
  assert.ok(tonegrid.STORE_FORWARD_TIMEOUT_MS < tonegrid.AUDIO_HOP_TIMEOUT_MS, 'store forward must finish inside the Hobby function');
  assert.strictEqual(tonegrid.hopTimeoutMs({ rawBody: Buffer.from('x') }), tonegrid.STORE_FORWARD_TIMEOUT_MS);
  assert.strictEqual(tonegrid.storeForwardTimeoutMs(false, Date.now() - 30000), tonegrid.STORE_FORWARD_TIMEOUT_MS);
  assert.strictEqual(tonegrid.storeForwardTimeoutMs(true, Date.now() - 30000), tonegrid.STORE_FORWARD_TIMEOUT_MS, 'MP3 convert still gets the full store-forward timeout');
  assert.strictEqual(tonegrid.AUDIO_SEND_COPY, 'We could not send the audio.');
  const audioApi = fs.readFileSync(path.join(root, 'api', 'tonegrid.js'), 'utf8');
  assert.ok(audioApi.includes("require('../lib/audio-chunks')"));
  assert.ok(audioApi.includes('x-plaiground-upload-id') || audioApi.includes('parseChunkMeta'));
  assert.ok(audioApi.includes('maxDuration: 60'));
  assert.ok(audioApi.includes('prepareFromBytes'));
  assert.ok(audioApi.includes('sniffKind'));
  assert.ok(audioApi.includes("hopKind === 'wav' || hopKind === 'flac'"), 'already-WAV/FLAC object_key skips prepareFromBytes convert');
  assert.ok(audioApi.includes('storeForwardTimeoutMs'));
  assert.ok(audioApi.includes('STORE_FORWARD_TIMEOUT_MS'));
  assert.ok(!audioApi.includes("asMultipart('audio'"), 'hopped audio wraps once as store multipart, not a second object wrap');
  assert.ok(audioApi.includes('hopType = wrapped.contentType'));
  assert.ok(audioApi.includes('prepared.contentType || hopType || contentType'));
  assert.ok(!audioApi.includes('FUNCTION_PAYLOAD_TOO_LARGE') || audioApi.includes('AUDIO_SEND_COPY'));
  assert.ok(!/trackIds\.length === 1/.test(audioApi), 'Basic leftover 1-track catalog must not skip minting a store track');

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      global.fetch = function hangFetch() {
        return new Promise(function () {});
      };
      try {
        const started = Date.now();
        const result = await tonegrid.tonegridFetch('/releases/11111111-1111-4111-8111-111111111111', {
          method: 'GET',
          timeoutMs: 30,
        });
        assert.ok(Date.now() - started < 1000, 'hung hop must time out');
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.status, 502);
        assert.strictEqual(result.timedOut, true);
        assert.strictEqual(result.data.error, 'We could not reach the store.');
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      global.fetch = function hangFetch() {
        return new Promise(function () {});
      };
      try {
        const started = Date.now();
        const raw = Buffer.from(
          '------bound\r\nContent-Disposition: form-data; name="audio"; filename="song.wav"\r\nContent-Type: audio/wav\r\n\r\nRIFF....WAVE\r\n------bound--\r\n'
        );
        const result = await tonegrid.tonegridFetch('/tracks/11111111-1111-4111-8111-111111111111/audio', {
          method: 'POST',
          rawBody: raw,
          contentType: 'multipart/form-data; boundary=----bound',
          timeoutMs: 30,
        });
        assert.ok(Date.now() - started < 1000, 'hung store forward must time out');
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.status, 502);
        assert.strictEqual(result.timedOut, true);
        assert.notStrictEqual(result.status, 200, 'timeout must not be a fake success');
        assert.strictEqual(result.data.error, 'We could not reach the store.');
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      global.fetch = async function mockFetch() {
        return {
          ok: false,
          status: 403,
          json: async () => ({ error: 'This account is sandbox-only and is not enabled for distribution.' }),
        };
      };
      try {
        const result = await tonegrid.tonegridFetch('/releases', { method: 'POST', body: { title: 'Night Drive' } });
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.status, 403);
        assert.ok(!result.timedOut);
        assert.match(result.data.error, /not enabled for distribution|sandbox-only/i);
        assert.doesNotMatch(result.data.error, /could not reach the store/i);
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const leftover = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const living = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      global.fetch = function mockFetch(url) {
        if (String(url).includes('/releases/' + leftover)) {
          return new Promise(function () {});
        }
        if (String(url).includes('/releases/' + living)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              uuid: living,
              title: 'Night Drive',
              status: 'pending',
              type: 'single',
            }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      };
      try {
        await withAccountUser({
          plan: 'basic',
          releases: [leftover, living],
        }, async (_row, headers) => {
          const res = mockRes();
          const started = Date.now();
          await releases({ method: 'GET', headers, query: {} }, res);
          assert.ok(Date.now() - started < 8000, 'leftover hung id must not stall the catalog');
          assert.strictEqual(res.statusCode, 200);
          const body = json(res);
          assert.strictEqual(body.configured, true);
          assert.ok(Array.isArray(body.releases));
          const ids = body.releases.map((row) => row && row.uuid);
          assert.ok(ids.includes(living), 'living release still loads');
          assert.ok(ids.includes(leftover), 'leftover id falls back locally instead of failing the page');
          assert.ok(!/could not reach the store/i.test(JSON.stringify(body)));
        });
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      await withAccountUser({}, async (_row, headers) => {
        const missing = mockRes();
        await uploads({
          method: 'POST',
          headers,
          body: { kind: 'audio', filename: 'song.wav', content_type: 'audio/wav', size: 7000000 },
        }, missing);
        assert.strictEqual(missing.statusCode, 503);
        assert.strictEqual(json(missing).error, 'We could not finish this step.');
        assert.ok(!/Cloudflare|R2|bucket|object store/i.test(missing.body));
      });
    }
  );

  const r2Prev = {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
  };
  process.env.R2_ACCOUNT_ID = 'acct-test';
  process.env.R2_ACCESS_KEY_ID = 'AKIA-TEST-NOT-REAL';
  process.env.R2_SECRET_ACCESS_KEY = 'secret-test-not-for-commit';
  process.env.R2_BUCKET = 'plaiground-uploads';
  process.env.R2_ENDPOINT = 'https://acct-test.example.test';
  try {
    await withEnv(
      { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
      async () => {
        await withAccountUser({}, async (row, headers) => {
          const minted = mockRes();
          await uploads({
            method: 'POST',
            headers,
            body: { kind: 'audio', filename: 'song.wav', content_type: 'audio/wav', size: 7000000 },
          }, minted);
          assert.strictEqual(minted.statusCode, 200);
          const mint = json(minted);
          assert.ok(mint.object_key.indexOf('audio/' + row.id + '/') === 0);
          assert.ok(mint.upload_url.indexOf('https://acct-test.example.test/') === 0);
          assert.ok(!minted.body.includes('secret-test-not-for-commit'));
          assert.ok(!minted.body.includes('AKIA-TEST-NOT-REAL') || mint.upload_url.includes('AKIA-TEST-NOT-REAL'));

          const coverMint = mockRes();
          await uploads({
            method: 'POST',
            headers,
            body: { kind: 'cover', filename: 'cover.jpg', content_type: 'image/jpeg', size: 2048 },
          }, coverMint);
          assert.strictEqual(coverMint.statusCode, 200);
          assert.ok(json(coverMint).object_key.indexOf('covers/' + row.id + '/') === 0);

          const originalFetch = global.fetch;
          const calls = [];
          const wav = Buffer.from('RIFF....WAVE');
          const leftoverTrack = 'afce23fb-aa5f-42ac-94ae-2ce58bf48402';
          let prepareCalls = 0;
          const origPrepare = audioConvert.prepareFromBytes;
          audioConvert.prepareFromBytes = async function spyPrepare() {
            prepareCalls += 1;
            return origPrepare.apply(this, arguments);
          };
          global.fetch = async function mockFetch(url, options) {
            const href = String(url);
            calls.push({ url: href, options: options || {} });
            if (href.indexOf('acct-test.example.test') !== -1) {
              return {
                ok: true,
                status: 200,
                arrayBuffer: async () => wav,
                headers: { get() { return 'audio/wav'; } },
              };
            }
            return { ok: true, status: 200, json: async () => ({ audio_status: 'processing' }) };
          };
          try {
            const key = 'audio/' + row.id + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-song.wav';
            const hopped = mockRes();
            await trackAudio({
              method: 'POST',
              headers: Object.assign({ 'content-type': 'application/json' }, headers),
              query: { id: '33333333-3333-4333-8333-333333333333' },
              body: { object_key: key },
            }, hopped);
            if (hopped.statusCode !== 200) console.error('HOP AUDIO', hopped.statusCode, hopped.body);
            assert.strictEqual(hopped.statusCode, 200);
            assert.strictEqual(json(hopped).audio_object_key, key);
            const storeCall = calls.find((call) => /\/tracks\/33333333-3333-4333-8333-333333333333\/audio/.test(call.url));
            assert.ok(storeCall, 'server pulls the object and forwards to the store');
            assertStoreAudioForward(storeCall.options, {
              filename: 'song.wav',
              mime: 'audio/wav',
              bytes: wav,
            });
            assert.ok(!JSON.stringify({ object_key: key }).includes(wav.toString()));

            prepareCalls = 0;
            const leftoverKey = 'audio/' + row.id + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-iset.wav';
            const leftoverCalls = [];
            global.fetch = async function mockLeftoverWav(url, options) {
              const href = String(url);
              leftoverCalls.push({ url: href, options: options || {} });
              if (href.indexOf('acct-test.example.test') !== -1) {
                return {
                  ok: true,
                  status: 200,
                  arrayBuffer: async () => wav,
                  headers: { get() { return 'audio/wav'; } },
                };
              }
              return { ok: true, status: 200, json: async () => ({ audio_status: 'processing' }) };
            };
            const leftoverHop = mockRes();
            await trackAudio({
              method: 'POST',
              headers: Object.assign({ 'content-type': 'application/json' }, headers),
              query: { id: leftoverTrack },
              body: { object_key: leftoverKey },
            }, leftoverHop);
            assert.strictEqual(leftoverHop.statusCode, 200, JSON.stringify(json(leftoverHop)));
            assert.strictEqual(prepareCalls, 0, 'already-WAV object_key skips prepareFromBytes convert');
            assert.strictEqual(json(leftoverHop).audio_object_key, leftoverKey);
            const leftoverStore = leftoverCalls.find((call) => /\/tracks\/afce23fb-aa5f-42ac-94ae-2ce58bf48402\/audio/.test(call.url));
            assert.ok(leftoverStore, 'WAV hop POSTs leftover track afce23fb');
            assertStoreAudioForward(leftoverStore.options, {
              filename: 'iset.wav',
              mime: 'audio/wav',
              bytes: wav,
            });

            const octetCalls = [];
            global.fetch = async function mockOctetFetch(url, options) {
              const href = String(url);
              octetCalls.push({ url: href, options: options || {} });
              if (href.indexOf('acct-test.example.test') !== -1) {
                return {
                  ok: true,
                  status: 200,
                  arrayBuffer: async () => wav,
                  headers: { get() { return 'application/octet-stream'; } },
                };
              }
              return { ok: true, status: 200, json: async () => ({ audio_status: 'processing' }) };
            };
            const octetHop = mockRes();
            await trackAudio({
              method: 'POST',
              headers: Object.assign({ 'content-type': 'application/json' }, headers),
              query: { id: '33333333-3333-4333-8333-333333333333' },
              body: { object_key: key },
            }, octetHop);
            assert.strictEqual(octetHop.statusCode, 200, 'hopped WAV with a nameless object type still forwards');
            const octetStore = octetCalls.find((call) => /\/tracks\/33333333-3333-4333-8333-333333333333\/audio/.test(call.url));
            assert.ok(octetStore, 'octet-stream hop still reaches the store');
            assertStoreAudioForward(octetStore.options, {
              filename: 'song.wav',
              mime: 'audio/wav',
              bytes: wav,
            });

            const flac = Buffer.from('fLaC....');
            const flacKey = 'audio/' + row.id + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-song.flac';
            const flacCalls = [];
            global.fetch = async function mockFlacHop(url, options) {
              const href = String(url);
              flacCalls.push({ url: href, options: options || {} });
              if (href.indexOf('acct-test.example.test') !== -1) {
                return {
                  ok: true,
                  status: 200,
                  arrayBuffer: async () => flac,
                  headers: { get() { return 'application/octet-stream'; } },
                };
              }
              return { ok: true, status: 200, json: async () => ({ audio_status: 'processing' }) };
            };
            const flacHop = mockRes();
            await trackAudio({
              method: 'POST',
              headers: Object.assign({ 'content-type': 'application/json' }, headers),
              query: { id: '33333333-3333-4333-8333-333333333333' },
              body: { object_key: flacKey },
            }, flacHop);
            assert.strictEqual(flacHop.statusCode, 200, JSON.stringify(json(flacHop)));
            const flacStore = flacCalls.find((call) => /\/tracks\/33333333-3333-4333-8333-333333333333\/audio/.test(call.url));
            assert.ok(flacStore, 'FLAC hop forwards to the store');
            assertStoreAudioForward(flacStore.options, {
              filename: 'song.flac',
              mime: 'audio/flac',
              bytes: flac,
            });

            const failCalls = [];
            global.fetch = async function mockFailFetch(url, options) {
              const href = String(url);
              failCalls.push({ url: href, options: options || {} });
              if (href.indexOf('acct-test.example.test') !== -1) {
                return {
                  ok: true,
                  status: 200,
                  arrayBuffer: async () => wav,
                  headers: { get() { return 'audio/wav'; } },
                };
              }
              return {
                ok: false,
                status: 502,
                json: async () => ({ error: 'We could not reach the store.' }),
              };
            };
            const failed = mockRes();
            await trackAudio({
              method: 'POST',
              headers: Object.assign({ 'content-type': 'application/json' }, headers),
              query: { id: '33333333-3333-4333-8333-333333333333' },
              body: { object_key: key },
            }, failed);
            assert.strictEqual(failed.statusCode, 502, 'store 502 is a real fail');
            assert.notStrictEqual(failed.statusCode, 200, 'timeout/502 must not be a fake success');
            assert.match(String(json(failed).error || ''), /could not reach the store/i);
            const failStore = failCalls.find((call) => /\/tracks\/33333333-3333-4333-8333-333333333333\/audio/.test(call.url));
            assert.ok(failStore, '502 path still forwarded audio');
            assertStoreAudioForward(failStore.options, {
              filename: 'song.wav',
              mime: 'audio/wav',
              bytes: wav,
            });

            prepareCalls = 0;
            const mp3 = fs.readFileSync(path.join(__dirname, 'fixtures', 'tone.mp3'));
            const mp3Calls = [];
            global.fetch = async function mockMp3Hop(url, options) {
              const href = String(url);
              mp3Calls.push({ url: href, options: options || {} });
              if (href.indexOf('acct-test.example.test') !== -1) {
                return {
                  ok: true,
                  status: 200,
                  arrayBuffer: async () => mp3,
                  headers: { get() { return 'audio/mpeg'; } },
                };
              }
              return { ok: true, status: 200, json: async () => ({ audio_status: 'processing' }) };
            };
            const mp3Key = 'audio/' + row.id + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-song.mp3';
            const mp3Hop = mockRes();
            await trackAudio({
              method: 'POST',
              headers: Object.assign({ 'content-type': 'application/json' }, headers),
              query: { id: '33333333-3333-4333-8333-333333333333' },
              body: { object_key: mp3Key },
            }, mp3Hop);
            assert.strictEqual(mp3Hop.statusCode, 200, JSON.stringify(json(mp3Hop)));
            const mp3Store = mp3Calls.find((call) => /\/tracks\/33333333-3333-4333-8333-333333333333\/audio/.test(call.url));
            assert.ok(mp3Store, 'MP3 hop still forwards after convert');
            assertStoreAudioForward(mp3Store.options, {
              filename: 'song.wav',
              mime: 'audio/wav',
            });
            const mp3Body = storeHopBody(mp3Store.options);
            assert.ok(mp3Body.indexOf(Buffer.from('RIFF')) !== -1, 'only an MP3 hop reconverts on the server');
            assert.strictEqual(prepareCalls, 1, 'MP3 object_key still converts once');

            prepareCalls = 0;
            const leftoverMp3Calls = [];
            global.fetch = async function mockLeftoverMp3(url, options) {
              const href = String(url);
              leftoverMp3Calls.push({ url: href, options: options || {} });
              if (href.indexOf('acct-test.example.test') !== -1) {
                return {
                  ok: true,
                  status: 200,
                  arrayBuffer: async () => mp3,
                  headers: { get() { return 'audio/mpeg'; } },
                };
              }
              return { ok: true, status: 200, json: async () => ({ audio_status: 'processing' }) };
            };
            const leftoverMp3Key = 'audio/' + row.id + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-iset.mp3';
            const leftoverMp3Hop = mockRes();
            await trackAudio({
              method: 'POST',
              headers: Object.assign({ 'content-type': 'application/json' }, headers),
              query: { id: leftoverTrack },
              body: { object_key: leftoverMp3Key },
            }, leftoverMp3Hop);
            assert.strictEqual(leftoverMp3Hop.statusCode, 200, JSON.stringify(json(leftoverMp3Hop)));
            assert.strictEqual(prepareCalls, 1, 'leftover MP3 object_key converts once');
            assert.strictEqual(json(leftoverMp3Hop).audio_object_key, leftoverMp3Key);
            const leftoverMp3Store = leftoverMp3Calls.find((call) => /\/tracks\/afce23fb-aa5f-42ac-94ae-2ce58bf48402\/audio/.test(call.url));
            assert.ok(leftoverMp3Store, 'leftover MP3 hop POSTs track afce23fb');
            assertStoreAudioForward(leftoverMp3Store.options, {
              filename: 'iset.wav',
              mime: 'audio/wav',
            });
          } finally {
            audioConvert.prepareFromBytes = origPrepare;
            global.fetch = originalFetch;
          }
        });
      }
    );
  } finally {
    Object.keys(r2Prev).forEach((name) => {
      if (r2Prev[name] === undefined) delete process.env[name];
      else process.env[name] = r2Prev[name];
    });
  }

  assert.ok(entrypoints.length <= 12);

  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const sources = (vercel.rewrites || []).map((row) => row.source);
  assert.ok(sources.includes('/api/auth/:action'));
  assert.ok(sources.includes('/api/me/catalog'));
  assert.ok(sources.includes('/api/me/profile'));
  assert.ok(sources.includes('/api/me/artists'));
  assert.strictEqual(
    (vercel.rewrites || []).find((row) => row.source === '/api/me/artists').destination,
    '/api/me?resource=artists'
  );
  const routeSrc = fs.readFileSync(path.join(root, 'lib', 'route.js'), 'utf8');
  assert.ok(routeSrc.includes('queryFromUrl'), 'rewrite resource=artists must be read from the URL when req.query is empty');
  const tonegridSrc = fs.readFileSync(path.join(root, 'api', 'tonegrid.js'), 'utf8');
  assert.ok(tonegridSrc.includes('keepArtistsIfDropped'), 'songs-list write-back must not persist an empty roster over stored artists');
  assert.ok(tonegridSrc.includes('recoverRoster'), 'songs-list write-back must recover artists from the pending release');
  assert.ok(tonegridSrc.includes('KNOWN_ADOPT_RELEASES'));
  assert.ok(tonegridSrc.includes('cefce28e-8020-435e-8097-177de07f0c44'));
  assert.ok(tonegridSrc.includes('7a928125-b12e-4609-bd37-26ce0edf819e'));
  assert.ok(tonegridSrc.includes('0767cb74-c5aa-4b18-8023-729fd4fb2808'));
  assert.ok(tonegridSrc.includes("title: 'I Set the Tone'"));
  assert.ok(tonegridSrc.includes('continueOwnedFuegoGoddess'));
  assert.ok(tonegridSrc.includes('continueOwnedLeftoverByTitle'));
  assert.ok(tonegridSrc.includes('continueKnownAdoptByTitle'));
  assert.ok(tonegridSrc.includes('isFuegoGoddessTitle'));
  assert.ok(tonegridSrc.includes('leftoverTracksForContinue'));
  assert.ok(tonegridSrc.includes('continueFuegoLeftoverTrack'));
  assert.ok(tonegridSrc.includes('continueLeftoverTrack'));
  assert.ok(tonegridSrc.includes("require('../lib/store-ai')"), 'submit hop must map attest made_how');
  assert.ok(tonegridSrc.includes('applyTrackAiDisclosure'), 'hop submit PATCHes includes_ai after attest');
  assert.ok(!/ai_service:\s*['"]Suno['"]/i.test(tonegridSrc), 'must not stamp Suno on every track');
  assert.ok(tonegridSrc.includes('1f346f71-a70d-4648-bb66-5c5aff5f5243'));
  assert.ok(tonegridSrc.includes('81e47b6f-6b13-44e6-a436-de81ffaa849f'));
  assert.ok(tonegridSrc.includes('afce23fb-aa5f-42ac-94ae-2ce58bf48402'));
  assert.ok(!tonegridSrc.includes("sameSongText(row.title, 'Rainbow Road')"), 'known leftover scope must not be Rainbow Road only');
  assert.ok(sources.includes('/api/tonegrid/uploads'));
  assert.ok(sources.includes('/api/tonegrid/tracks/:id/audio'));
  assert.ok(sources.includes('/api/tonegrid/releases/:id/submit'));
  assert.ok(sources.includes('/api/tonegrid/releases/:id/dsps'));
  assert.ok(sources.includes('/api/tonegrid/releases/:id/artwork'));
  assert.ok(sources.includes('/api/tonegrid/releases/:id'));
  assert.ok(sources.includes('/api/tonegrid/tracks/:id'));
  assert.ok(sources.includes('/api/signwell/:id'));
  assert.ok(sources.includes('/api/tonegrid/:resource'));
  assert.ok(sources.includes('/api/stripe/webhook'));
  assert.strictEqual(
    (vercel.rewrites || []).find((row) => row.source === '/api/stripe/webhook').destination,
    '/api/create-checkout-session?action=webhook'
  );
  const apexRedirects = (vercel.redirects || []).filter((row) => (
    (row.has || []).some((rule) => rule.type === 'host' && rule.value === 'wannaplai.com')
  ));
  assert.ok(apexRedirects.length, 'apex pages still redirect to www');
  assert.ok(!apexRedirects.some((row) => String(row.source).indexOf('api/stripe') !== -1), 'Stripe webhook must not 308 on apex');
  assert.ok(!apexRedirects.some((row) => String(row.source).indexOf('(?!') !== -1));
  assert.ok(!apexRedirects.some((row) => String(row.source).indexOf('WEBHOOK') !== -1));
  assert.strictEqual(fs.readdirSync(path.join(root, 'api')).filter((name) => name.endsWith('.js')).length, 7);
  assert.ok(!fs.readFileSync(path.join(root, 'terms.html'), 'utf8').includes('/api/tonegrid/releases/'));
  const needle = ['t', 'g', 'k', '_'].join('');
  files.forEach((rel) => {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(!text.includes(needle), rel + ' must not contain a key prefix');
  });

  console.log('tonegrid self-test ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
