'use strict';

const assert = require('assert');
const accounts = require('./accounts');
const auth = require('./auth');
const tonegridApi = require('../api/tonegrid');
const storeCredits = require('./store-credits');

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

function submitRelease(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/releases/' + req.id + '/submit' }, req), res);
}

async function withAccountUser(fn) {
  const prevDb = process.env.DATABASE_URL;
  const prevSecret = process.env.SESSION_SECRET;
  process.env.DATABASE_URL = 'postgres://memory';
  process.env.SESSION_SECRET = 'tonegrid-test-session-secret';
  accounts.useMemoryStore();
  const created = await accounts.createUser({
    email: 'credits-send@example.com',
    password: 'password1',
    artist: 'Ada Night',
    plan: 'creator',
  });
  let row = await accounts.confirmEmail(created.email);
  row = await accounts.updateCatalog(row.id, { releaseId: '11111111-1111-4111-8111-111111111111' });
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

async function run() {
  const declared = storeCredits.declaredTrackContributors({
    credits: { performer: 'Ada Night', producer: 'Ada Night' },
  });
  assert.strictEqual(declared[0].role, 'Performer');
  assert.strictEqual(declared[1].role, 'Producer');
  assert.deepStrictEqual(storeCredits.declaredTrackContributors({
    credits: { performer: 'AI', producer: '' },
    name: 'Fuvtu',
  }), []);

  const prevKey = process.env.TONEGRID_API_KEY;
  const prevBase = process.env.TONEGRID_BASE_URL;
  process.env.TONEGRID_API_KEY = 'test-key-value-not-for-commit';
  process.env.TONEGRID_BASE_URL = 'https://api-sandbox.tonegrid.pro/api';
  const originalFetch = global.fetch;
  const calls = [];
  const mine = '11111111-1111-4111-8111-111111111111';
  const trackId = '33333333-3333-4333-8333-333333333333';
  global.fetch = async function mockFetch(url, options) {
    calls.push({ url: String(url), method: options && options.method, body: options && options.body });
    if (String(url).includes('/releases/' + mine + '/submit')) {
      return { ok: true, status: 200, json: async () => ({ message: 'Release submitted for review.', status: 'pending' }) };
    }
    if (String(url).includes('/releases/' + mine + '/dsps')) {
      return { ok: true, status: 200, json: async () => ({ dsps: [{ dsp_name: 'YouTube Music' }] }) };
    }
    if (String(url).includes('/releases/' + mine) && options && options.method === 'PATCH') {
      return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'rejected' } }) };
    }
    if (String(url).includes('/releases/' + mine)) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          release: {
            uuid: mine,
            title: 'Dolly',
            status: 'rejected',
            artwork_url: 'https://cdn.example/dolly.jpg',
            tracks: [{ uuid: trackId, title: 'Dolly', audio_url: 'https://cdn.example/dolly.wav' }],
          },
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  try {
    await withAccountUser(async (_row, headers) => {
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
          credits: { performer: 'Ada Night', producer: 'Ada Night' },
        },
      }, res);
      assert.strictEqual(res.statusCode, 200, res.body);
      const contribPatch = calls.find((call) => {
        if (call.method !== 'PATCH' || !/\/tracks\/[^/]+$/.test(String(call.url))) return false;
        const body = JSON.parse(call.body || '{}');
        return Array.isArray(body.contributors);
      });
      assert.ok(contribPatch, 'already-collected credits must PATCH track contributors in place');
      const contribs = JSON.parse(contribPatch.body || '{}').contributors;
      assert.ok(contribs.some((row) => row.role === 'Performer' && row.name === 'Ada Night'));
      assert.ok(contribs.some((row) => row.role === 'Producer' && row.name === 'Ada Night'));
      assert.ok(!contribs.some((row) => /ai/i.test(String(row.name || ''))));
      assert.ok(!calls.some((call) => String((call.method || '')).toUpperCase() === 'DELETE'));
      assert.ok(!calls.some((call) => {
        const method = String(call.method || '').toUpperCase();
        return method === 'POST' && /\/releases$/.test(String(call.url));
      }), 'contributor send must not remint a release');

      const empty = mockRes();
      const beforeEmpty = calls.length;
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
          credits: { performer: '', producer: '' },
          name: 'Fuvtu',
        },
      }, empty);
      assert.strictEqual(empty.statusCode, 200, empty.body);
      const emptyPatch = calls.slice(beforeEmpty).find((call) => {
        if (call.method !== 'PATCH' || !/\/tracks\/[^/]+$/.test(String(call.url))) return false;
        const body = JSON.parse(call.body || '{}');
        return Array.isArray(body.contributors);
      });
      const emptyContribs = emptyPatch ? JSON.parse(emptyPatch.body || '{}').contributors : [];
      assert.ok(emptyContribs.some((row) => row.role === 'Performer' && row.name === 'Ada Night'), 'first-submit maps the collected name onto Performer');
      assert.ok(emptyContribs.some((row) => row.role === 'Producer' && row.name === 'Ada Night'), 'first-submit maps the collected name onto Producer');
    });
  } finally {
    global.fetch = originalFetch;
    if (prevKey === undefined) delete process.env.TONEGRID_API_KEY;
    else process.env.TONEGRID_API_KEY = prevKey;
    if (prevBase === undefined) delete process.env.TONEGRID_BASE_URL;
    else process.env.TONEGRID_BASE_URL = prevBase;
  }
  console.log('lib/track-credits-send.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
