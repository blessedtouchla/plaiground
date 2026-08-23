'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const tonegrid = require('./tonegrid');
const accounts = require('./accounts');
const auth = require('./auth');
const plans = require('./plans');
const tonegridApi = require('../api/tonegrid');

function health(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/health' }, req), res);
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
function updateTrack(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/tracks/' + req.id, method: req.method }, req), res);
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
  const reqHeaders = { cookie: auth.COOKIE + '=' + auth.signSession(row.id) };
  try {
    await fn(row, reqHeaders);
  } finally {
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
    assert.strictEqual(json(trackRes).error, 'ToneGrid is not configured.');

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
          assert.strictEqual(json(fakeGenre).error, 'genre must be a ToneGrid genre.');

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
          assert.strictEqual(calls.length, 1);
          const sent = JSON.parse(calls[0].options.body);
          assert.strictEqual(sent.title, 'Night Drive');
          assert.strictEqual(sent.type, 'single');
          assert.strictEqual(sent.genre, 'Pop');
          assert.strictEqual(sent.language, 'en');
          assert.strictEqual(sent.price, undefined);
          assert.strictEqual(sent.release_date, undefined);
          assert.strictEqual(sent.instrumental, undefined);
          const stored = await accounts.findById(row.id);
          assert.deepStrictEqual(stored.tonegrid_release_ids, ['22222222-2222-4222-8222-222222222222']);
          assert.strictEqual(stored.tonegrid_release_at.length, 1);
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
          assert.strictEqual(calls.length, 1);
          assert.strictEqual(calls[0].url, 'https://api-sandbox.tonegrid.pro/api/releases/22222222-2222-4222-8222-222222222222/tracks');
          assert.ok(calls[0].options.headers.Authorization);
          assert.ok(calls[0].options.headers.Authorization.indexOf('test-key-value-not-for-commit') !== -1);
          assert.ok(!res.body.includes('test-key-value-not-for-commit'));
          assert.ok(!res.body.includes('Authorization'));
          const sent = JSON.parse(calls[0].options.body);
          assert.strictEqual(sent.title, 'Night Drive');
          assert.strictEqual(sent.position, 1);
          assert.strictEqual(sent.explicit, false);
          assert.strictEqual(sent.language, 'en');

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
          const instSent = JSON.parse(calls[1].options.body);
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
      await withAccountUser({}, async (_row, headers) => {
        const notMulti = mockRes();
        await trackAudio({
          method: 'POST',
          headers: Object.assign({ 'content-type': 'application/json' }, headers),
          query: { id: '33333333-3333-4333-8333-333333333333' },
          body: Buffer.from('{"no":true}'),
        }, notMulti);
        assert.strictEqual(notMulti.statusCode, 400);
        assert.ok(/multipart/i.test(json(notMulti).error));

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
            'content-length': String(200 * 1024 * 1024 + 1),
          }, headers),
          query: { id: '33333333-3333-4333-8333-333333333333' },
          body: Buffer.from('x'),
        }, tooBig);
        assert.strictEqual(tooBig.statusCode, 413);

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
          assert.deepStrictEqual(tonegridApi.config, { api: { bodyParser: false } });
          const res = mockRes();
          await trackAudio({
            method: 'POST',
            headers: Object.assign({ 'content-type': 'multipart/form-data; boundary=----bound' }, headers),
            query: { id: '33333333-3333-4333-8333-333333333333' },
            body: raw,
          }, res);
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(calls.length, 1);
          assert.strictEqual(calls[0].url, 'https://api-sandbox.tonegrid.pro/api/tracks/33333333-3333-4333-8333-333333333333/audio');
          assert.strictEqual(calls[0].options.method, 'POST');
          assert.ok(calls[0].options.headers.Authorization);
          assert.ok(Buffer.isBuffer(calls[0].options.body));
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
          const sent = calls[0].options.body;
          assert.ok(Buffer.isBuffer(sent));
          const head = sent.slice(0, 500).toString('latin1');
          assert.ok(/filename="tone.wav"/i.test(head));
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

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch() {
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
          assert.strictEqual(reusedRelease.statusCode, 200);
          assert.strictEqual(json(reusedRelease).uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
          assert.strictEqual(json(reusedRelease).continued, true);
          assert.strictEqual(calls.length, 0);
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
          assert.strictEqual(json(res).signwell_status, 'solo');
          assert.strictEqual(json(res).document_id, null);
          assert.ok(!calls.some((call) => String(call.url).includes('signwell.com')));
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
            return url.includes('/releases/' + mine) && !url.includes('/dsps') && !url.includes('/submit') && call.method === 'PUT';
          }));
          assert.ok(!calls.some((call) => String(call.url).includes('/distribute')));
          assert.ok(!calls.some((call) => String(call.url).includes('/approve')));

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

  const root = path.join(__dirname, '..');
  const files = [
    'lib/tonegrid.js',
    'lib/tonegrid.test.js',
    'lib/signwell.js',
    'lib/signwell.test.js',
    'api/tonegrid.js',
    'lib/live-player.js',
    'api/signwell.js',
    'api/me.js',
    'tonegrid.js',
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
  ]);
  assert.ok(entrypoints.length <= 12);

  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const sources = (vercel.rewrites || []).map((row) => row.source);
  assert.ok(sources.includes('/api/auth/:action'));
  assert.ok(sources.includes('/api/me/catalog'));
  assert.ok(sources.includes('/api/me/profile'));
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
  assert.strictEqual(fs.readdirSync(path.join(root, 'api')).filter((name) => name.endsWith('.js')).length, 6);
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
