'use strict';

const assert = require('assert');
const accounts = require('./accounts');
const auth = require('./auth');
const profile = require('./profile');
const releaseStatus = require('./release-status');
const tonegridApi = require('../api/tonegrid');

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

function releases(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/releases' }, req), res);
}

async function withAccountUser(attrs, fn) {
  const prevDb = process.env.DATABASE_URL;
  const prevSecret = process.env.SESSION_SECRET;
  process.env.DATABASE_URL = 'postgres://memory';
  process.env.SESSION_SECRET = 'tonegrid-test-session-secret';
  accounts.useMemoryStore();
  const created = await accounts.createUser({
    email: 'ada@example.com',
    password: 'password1',
    artist: 'Ada Night',
    plan: 'basic',
  });
  let row = await accounts.confirmEmail(created.email);
  row = await accounts.updateCatalog(row.id, { releaseId: attrs.releaseId });
  const stored = profile.recoverRoster(profile.readStored(row), row.artist_name, row.tonegrid_artist_id);
  const current = (stored.artists && stored.artists[0]) || {};
  const next = profile.upsertArtist(stored, Object.assign({}, current, {
    name: current.name || 'Ada Night',
    legal_first: 'Ada',
    legal_last: 'Night',
  }));
  row = await accounts.updateProfile(row.id, { profile: next });
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

async function withEnv(fn) {
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

async function run() {
  await withEnv(async () => {
    const mine = '11111111-1111-4111-8111-111111111111';
    const originalFetch = global.fetch;
    global.fetch = async function mockFetch(url) {
      if (String(url).includes('/releases/' + mine + '/rights')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ c_line: '(C) 2026 Ada Night', p_line: '(P) 2026 Ada Night' }),
        };
      }
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
              copyright_year: 2026,
              copyright_holder: 'Ada Night',
              master_owner: 'Ada Night',
              tracks: [{
                uuid: '33333333-3333-4333-8333-333333333333',
                title: 'Night Drive',
                contributors: [{ name: 'Ada Night', role: 'Songwriter' }],
              }],
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
        const stored = profile.recoverRoster(profile.readStored(row), row.artist_name, row.tonegrid_artist_id);
        const next = profile.upsertRelease(stored, {
          id: mine,
          tonegrid_release_id: mine,
          title: 'Night Drive',
          label: 'PLAIGROUND',
          copyright_year: 2026,
          copyright_holder: 'Ada Night',
          master_owner: 'Ada Night',
          writers: [{ name: 'Ada Night' }],
          copyright_line: '© 2026 Ada Night / ℗ 2026 Ada Night',
        });
        await accounts.updateProfile(row.id, { profile: next });
        const res = mockRes();
        await releases({ method: 'GET', headers, query: {} }, res);
        assert.strictEqual(res.statusCode, 200, res.body);
        const listed = json(res).releases[0];
        assert.strictEqual(listed.label, 'PLAIGROUND');
        assert.ok(listed.writers && listed.writers.length);
        assert.ok(listed.c_line || listed.copyright_line);
        assert.strictEqual(releaseStatus.problemAlert(listed), '');
        assert.strictEqual(releaseStatus.displayInfo(listed).label, 'Pending');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  console.log('lib/credits-overlay.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
