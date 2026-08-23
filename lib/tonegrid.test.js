'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const tonegrid = require('./tonegrid');
const accounts = require('./accounts');
const auth = require('./auth');
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
  const row = await accounts.confirmEmail(created.email);
  if (attrs && (attrs.artistId || attrs.releaseId)) {
    await accounts.updateCatalog(row.id, {
      artistId: attrs.artistId,
      releaseId: attrs.releaseId,
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

async function run() {
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
      const req = new EventEmitter();
      req.method = 'POST';
      req.headers = {};
      req.body = { title: 'Neon Shadows', type: 'single', release_date: '2026-09-12', genre: 'Electronic' };
      const res = mockRes();
      await releases(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(json(res).error, 'artist_id is required.');
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
        const res = mockRes();
        await releases({
          method: 'POST',
          headers: {},
          body: {
            artist_id: '11111111-1111-4111-8111-111111111111',
            title: 'Night Drive',
            type: 'single',
          },
        }, res);
        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(calls.length, 1);
        const sent = JSON.parse(calls[0].options.body);
        assert.strictEqual(sent.title, 'Night Drive');
        assert.strictEqual(sent.type, 'single');
        assert.strictEqual(sent.genre, undefined);
        assert.strictEqual(sent.release_date, undefined);
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
        const res = mockRes();
        await artists({ method: 'POST', headers: {}, body: { name: 'Victoria Reyes' } }, res);
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
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const missing = mockRes();
      await tracks({ method: 'POST', headers: {}, body: { title: 'Night Drive' } }, missing);
      assert.strictEqual(missing.statusCode, 400);
      assert.strictEqual(json(missing).error, 'release_id is required.');

      const noTitle = mockRes();
      await tracks({
        method: 'POST',
        headers: {},
        body: { release_id: '11111111-1111-4111-8111-111111111111' },
      }, noTitle);
      assert.strictEqual(noTitle.statusCode, 400);
      assert.strictEqual(json(noTitle).error, 'title is required.');
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
        const res = mockRes();
        await tracks({
          method: 'POST',
          headers: {},
          body: {
            release_id: '22222222-2222-4222-8222-222222222222',
            title: 'Night Drive',
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
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  await withEnv(
    { key: 'test-key-value-not-for-commit', base: 'https://api-sandbox.tonegrid.pro/api' },
    async () => {
      const notMulti = mockRes();
      await trackAudio({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        query: { id: '33333333-3333-4333-8333-333333333333' },
        body: Buffer.from('{"no":true}'),
      }, notMulti);
      assert.strictEqual(notMulti.statusCode, 400);
      assert.ok(/multipart/i.test(json(notMulti).error));

      const noId = mockRes();
      await trackAudio({
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=xx' },
        query: {},
        url: '/api/tonegrid/tracks/audio',
        body: Buffer.from('x'),
      }, noId);
      assert.strictEqual(noId.statusCode, 400);

      const tooBig = mockRes();
      await trackAudio({
        method: 'POST',
        headers: {
          'content-type': 'multipart/form-data; boundary=xx',
          'content-length': String(200 * 1024 * 1024 + 1),
        },
        query: { id: '33333333-3333-4333-8333-333333333333' },
        body: Buffer.from('x'),
      }, tooBig);
      assert.strictEqual(tooBig.statusCode, 413);

      const mp3 = mockRes();
      await trackAudio({
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=xx' },
        query: { id: '33333333-3333-4333-8333-333333333333' },
        body: Buffer.from('Content-Disposition: form-data; name="audio"; filename="song.mp3"\r\n\r\nxx'),
      }, mp3);
      assert.strictEqual(mp3.statusCode, 400);
      assert.ok(/WAV or FLAC/i.test(json(mp3).error));
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
        assert.deepStrictEqual(tonegridApi.config, { api: { bodyParser: false } });
        const res = mockRes();
        await trackAudio({
          method: 'POST',
          headers: { 'content-type': 'multipart/form-data; boundary=----bound' },
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

  const root = path.join(__dirname, '..');
  const files = [
    'lib/tonegrid.js',
    'lib/tonegrid.test.js',
    'api/tonegrid.js',
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
    'lib/route.js',
    'account.js',
    'api/auth.js',
    'lib/mail.js',
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
  assert.ok(sources.includes('/api/tonegrid/tracks/:id/audio'));
  assert.ok(sources.includes('/api/tonegrid/:resource'));
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
