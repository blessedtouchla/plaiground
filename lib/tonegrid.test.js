'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const tonegrid = require('./tonegrid');
const health = require('../api/tonegrid/health');
const artists = require('../api/tonegrid/artists');
const releases = require('../api/tonegrid/releases');
const analytics = require('../api/tonegrid/analytics');
const royalties = require('../api/tonegrid/royalties');

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
      const originalFetch = global.fetch;
      const calls = [];
      global.fetch = async function mockFetch(url) {
        calls.push(String(url));
        if (String(url).includes('/analytics/summary')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              from: '2026-04-01',
              to: '2026-04-26',
              total_streams: 12,
              total_revenue_usd: '1.50',
              top_release: { uuid: '11111111-1111-4111-8111-111111111111', title: 'Night Drive', streams: 12 },
              top_dsp: 'Spotify',
              top_territory: 'US',
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
        const res = mockRes();
        await analytics({ method: 'GET', headers: {}, query: { from: '2026-04-01', to: '2026-04-26' } }, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(calls.length, 4);
        assert.ok(calls.some((url) => url === 'https://api-sandbox.tonegrid.pro/api/analytics/summary?from=2026-04-01&to=2026-04-26'));
        assert.ok(calls.some((url) => url.includes('/analytics/dsps')));
        assert.ok(calls.some((url) => url.includes('/analytics/territories')));
        assert.ok(calls.some((url) => url.includes('/analytics/releases')));
        const body = json(res);
        assert.strictEqual(body.configured, true);
        assert.strictEqual(body.sandbox, true);
        assert.strictEqual(body.summary.total_streams, 12);
        assert.strictEqual(body.summary.total_revenue_usd, 1.5);
        assert.strictEqual(body.summary.top_release.title, 'Night Drive');
        assert.deepStrictEqual(body.dsps, [{ dsp: 'Spotify', streams: 12 }]);
        assert.deepStrictEqual(body.territories, [{ territory: 'US', country_name: 'United States', streams: 12 }]);
        assert.deepStrictEqual(body.series, []);
        assert.ok(!res.body.includes('test-key-value-not-for-commit'));
        assert.ok(!res.body.includes('Authorization'));
        assert.ok(!res.body.includes('7,412,908'));
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
      global.fetch = async function mockFetch(url) {
        calls.push(String(url));
        if (String(url).includes('/releases')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ uuid: '11111111-1111-4111-8111-111111111111', title: 'Night Drive', type: 'single', status: 'draft' }],
              total: 1,
              page: 1,
              per_page: 20,
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
      try {
        const res = mockRes();
        await releases({ method: 'GET', headers: {}, query: {} }, res);
        assert.strictEqual(res.statusCode, 200);
        assert.ok(calls.some((url) => url === 'https://api-sandbox.tonegrid.pro/api/releases'));
        const body = json(res);
        assert.strictEqual(body.releases[0].title, 'Night Drive');
        assert.ok(!res.body.includes('Neon Shadows'));
        assert.ok(!res.body.includes('test-key-value-not-for-commit'));
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
      global.fetch = async function mockFetch(url) {
        calls.push(String(url));
        if (String(url).includes('/royalties/statements/stmt_202603')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              statement: {
                breakdown: [{ release_title: 'Night Drive', dsp: 'Spotify', streams: 12, revenue_usd: '1.50' }],
              },
            }),
          };
        }
        if (String(url).includes('/royalties/statements')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ statements: [{ id: 'stmt_202603', period: '2026-03', total_usd: '1.50', status: 'finalized' }] }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ balance: { available_usd: '1.50', pending_usd: '0.00', currency: 'USD' } }),
        };
      };
      try {
        const res = mockRes();
        await royalties({ method: 'GET', headers: {}, query: {} }, res);
        assert.strictEqual(res.statusCode, 200);
        assert.ok(calls.some((url) => url === 'https://api-sandbox.tonegrid.pro/api/royalties/balance'));
        assert.ok(calls.some((url) => url === 'https://api-sandbox.tonegrid.pro/api/royalties/statements'));
        const body = json(res);
        assert.strictEqual(body.balance.available_usd, 1.5);
        assert.strictEqual(body.balance.pending_usd, 0);
        assert.strictEqual(body.statements[0].period, '2026-03');
        assert.strictEqual(body.breakdown[0].dsp, 'Spotify');
        assert.ok(!res.body.includes('19821.50'));
        assert.ok(!res.body.includes('test-key-value-not-for-commit'));
      } finally {
        global.fetch = originalFetch;
      }
    }
  );

  const root = path.join(__dirname, '..');
  const files = [
    'lib/tonegrid.js',
    'lib/tonegrid.test.js',
    'api/tonegrid/health.js',
    'api/tonegrid/artists.js',
    'api/tonegrid/releases.js',
    'api/tonegrid/analytics.js',
    'api/tonegrid/royalties.js',
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
  ];
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
