'use strict';

const assert = require('assert');
const storeAnalytics = require('./store-analytics');
const accounts = require('./accounts');
const auth = require('./auth');
const tonegridApi = require('../api/tonegrid');

const MINE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const THEIRS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(chunk) { this.body = chunk == null ? '' : String(chunk); },
  };
  return res;
}

function json(res) {
  return JSON.parse(res.body || '{}');
}

async function withUser(attrs, fn) {
  const prevDb = process.env.DATABASE_URL;
  const prevSecret = process.env.SESSION_SECRET;
  process.env.DATABASE_URL = 'postgres://memory';
  process.env.SESSION_SECRET = 'tonegrid-test-session-secret';
  accounts.useMemoryStore();
  const created = await accounts.createUser({
    email: (attrs && attrs.email) || 'ada@example.com',
    password: 'password1',
    artist: 'Ada Night',
    plan: (attrs && attrs.plan) || 'basic',
  });
  let row = await accounts.confirmEmail(created.email);
  if (attrs && attrs.releaseId) {
    row = await accounts.updateCatalog(row.id, { releaseId: attrs.releaseId });
  }
  const headers = { cookie: auth.COOKIE + '=' + auth.signSession(row.id) };
  try {
    await fn(row, headers);
  } finally {
    accounts.resetStore();
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
  }
}

async function withStoreEnv(fn) {
  const prevKey = process.env.TONEGRID_API_KEY;
  const prevBase = process.env.TONEGRID_BASE_URL;
  process.env.TONEGRID_API_KEY = 'test-key-value-not-for-commit';
  process.env.TONEGRID_BASE_URL = 'https://api-sandbox.tonegrid.pro/api';
  try {
    await fn();
  } finally {
    if (prevKey === undefined) delete process.env.TONEGRID_API_KEY;
    else process.env.TONEGRID_API_KEY = prevKey;
    if (prevBase === undefined) delete process.env.TONEGRID_BASE_URL;
    else process.env.TONEGRID_BASE_URL = prevBase;
  }
}

function hop(url, body) {
  return { ok: true, status: 200, json: async () => body };
}

async function run() {
  assert.strictEqual(storeAnalytics.isLiveStatus('pending'), false);
  assert.strictEqual(storeAnalytics.isLiveStatus('live'), true);
  assert.deepStrictEqual(storeAnalytics.liveIds([
    { id: MINE, status: 'pending' },
    { id: THEIRS, status: 'live' },
  ]), [THEIRS]);

  const empty = storeAnalytics.untilLive(false, {
    summary: { total_streams: 7412908, total_revenue_usd: 18942.6 },
    releases: [{ title: 'Neon Sermon', streams: 7412908 }],
    dsps: [{ dsp: 'Spotify', streams: 7412908 }],
    territories: [{ country_name: 'Los Angeles', streams: 12 }],
    series: [{ label: 'Apr', revenue_usd: 99 }],
  }, {});
  assert.strictEqual(empty.summary.total_streams, 0);
  assert.strictEqual(empty.summary.total_revenue_usd, 0);
  assert.deepStrictEqual(empty.releases, []);
  assert.deepStrictEqual(empty.dsps, []);
  assert.ok(!JSON.stringify(empty).includes('Neon Sermon'));
  assert.ok(!JSON.stringify(empty).includes('7412908'));

  const live = storeAnalytics.untilLive(true, {
    summary: { total_streams: 12, total_revenue_usd: 1.5 },
    releases: [{ release_uuid: MINE, title: 'Night Drive', streams: 12 }],
    dsps: [{ dsp: 'Spotify', streams: 12 }],
    territories: [],
    series: [],
  }, {});
  assert.strictEqual(live.summary.total_streams, 12);
  assert.strictEqual(storeAnalytics.isEmptyCatalog(empty), true);
  assert.strictEqual(storeAnalytics.isEmptyCatalog(live), false);

  const series = storeAnalytics.seriesFromStatements([
    { period: '2026-04', total_usd: 2 },
    { period: '2026-03', total_usd: 1 },
  ]);
  assert.strictEqual(series[0].label, 'Mar 2026');
  assert.strictEqual(series[1].label, 'Apr 2026');
  assert.strictEqual(storeAnalytics.royaltiesPaid([{ total_usd: 1.25 }, { total_usd: 0.75 }]), 2);

  await withStoreEnv(async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async function mockFetch(url) {
      calls.push(String(url));
      if (/\/releases\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa(?:\?|$)/.test(String(url))) {
        return hop(url, { uuid: MINE, title: 'Night Drive', status: 'pending' });
      }
      if (String(url).includes('/analytics/releases')) {
        return hop(url, { data: [{ release_uuid: MINE, title: 'Night Drive', streams: 99 }] });
      }
      return hop(url, { data: [{ dsp: 'Spotify', streams: 99 }] });
    };
    try {
      await withUser({ releaseId: MINE }, async (_row, headers) => {
        const res = mockRes();
        await tonegridApi(Object.assign({
          method: 'GET',
          url: '/api/tonegrid/analytics',
          headers,
          query: {},
        }), res);
        assert.strictEqual(res.statusCode, 200);
        const body = json(res);
        assert.strictEqual(body.summary.total_streams, 0);
        assert.strictEqual(body.summary.total_revenue_usd, 0);
        assert.deepStrictEqual(body.dsps, []);
        assert.ok(!calls.some((url) => url.includes('/analytics/releases')), 'pending must not pull store analytics');
        assert.ok(!res.body.includes('99'));
        assert.ok(!res.body.includes('Neon Sermon'));
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  await withStoreEnv(async () => {
    const originalFetch = global.fetch;
    global.fetch = async function mockFetch(url) {
      if (/\/releases\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa(?:\?|$)/.test(String(url))) {
        return hop(url, { uuid: MINE, title: 'Night Drive', status: 'live' });
      }
      if (String(url).includes('/analytics/releases')) {
        return hop(url, {
          data: [
            { release_uuid: MINE, title: 'Night Drive', streams: 12 },
            { release_uuid: THEIRS, title: 'Neon Sermon', streams: 7412908 },
          ],
        });
      }
      if (String(url).includes('/analytics/dsps')) {
        return hop(url, { data: [{ dsp: 'Spotify', streams: 12 }] });
      }
      if (String(url).includes('/analytics/territories')) {
        return hop(url, { data: [{ territory: 'US', country_name: 'United States', streams: 12 }] });
      }
      if (String(url).includes('/royalties/statements/stmt_202603')) {
        return hop(url, {
          statement: {
            id: 'stmt_202603',
            period: '2026-03',
            breakdown: [{ release_title: 'Night Drive', dsp: 'Spotify', streams: 12, revenue_usd: '1.50' }],
          },
        });
      }
      if (String(url).includes('/royalties/statements')) {
        return hop(url, { statements: [{ id: 'stmt_202603', period: '2026-03', total_usd: '19821.50' }] });
      }
      return hop(url, { data: [] });
    };
    try {
      await withUser({ releaseId: MINE, plan: 'creator' }, async (_row, headers) => {
        const res = mockRes();
        await tonegridApi(Object.assign({
          method: 'GET',
          url: '/api/tonegrid/analytics',
          headers,
          query: {},
        }), res);
        assert.strictEqual(res.statusCode, 200);
        const body = json(res);
        assert.strictEqual(body.summary.total_streams, 12);
        assert.strictEqual(body.summary.total_revenue_usd, 1.5);
        assert.strictEqual(body.releases.length, 1);
        assert.strictEqual(body.releases[0].title, 'Night Drive');
        assert.strictEqual(body.dsps[0].dsp, 'Spotify');
        assert.strictEqual(body.series[0].label, 'Mar 2026');
        assert.ok(!res.body.includes('Neon Sermon'));
        assert.ok(!res.body.includes('7412908'));
        assert.ok(!res.body.includes('19821.50'));
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  console.log('lib/store-analytics.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
