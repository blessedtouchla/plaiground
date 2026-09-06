'use strict';

const assert = require('assert');
const accounts = require('./accounts');
const auth = require('./auth');
const profile = require('./profile');
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

function submitRelease(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/releases/' + req.id + '/submit' }, req), res);
}

function trackAiPatches(calls) {
  return calls.filter((call) => {
    if (String(call.method || '').toUpperCase() !== 'PATCH') return false;
    if (!/\/tracks\/[0-9a-f-]{36}$/i.test(String(call.url))) return false;
    const body = String(call.body || '');
    return body.includes('includes_ai') || body.includes('track_properties') || body.includes('ai_service');
  });
}

function includesAi(call) {
  return String(call.body || '').includes('includes_ai');
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
  row = await accounts.updateCatalog(row.id, {
    releaseId: attrs.releaseId,
    trackId: attrs.trackId,
  });
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
  const prevSw = process.env.SIGNWELL_API_KEY;
  const prevTpl = process.env.SIGNWELL_TEMPLATE_ID;
  process.env.TONEGRID_API_KEY = 'test-key-value-not-for-commit';
  process.env.TONEGRID_BASE_URL = 'https://api-sandbox.tonegrid.pro/api';
  process.env.SIGNWELL_API_KEY = 'signwell-test-key-not-for-commit';
  process.env.SIGNWELL_TEMPLATE_ID = 'tpl_test_not_for_commit';
  try {
    await fn();
  } finally {
    if (prevKey === undefined) delete process.env.TONEGRID_API_KEY;
    else process.env.TONEGRID_API_KEY = prevKey;
    if (prevBase === undefined) delete process.env.TONEGRID_BASE_URL;
    else process.env.TONEGRID_BASE_URL = prevBase;
    if (prevSw === undefined) delete process.env.SIGNWELL_API_KEY;
    else process.env.SIGNWELL_API_KEY = prevSw;
    if (prevTpl === undefined) delete process.env.SIGNWELL_TEMPLATE_ID;
    else process.env.SIGNWELL_TEMPLATE_ID = prevTpl;
  }
}

async function runSubmit(madeHow, extra) {
  const mine = '11111111-1111-4111-8111-111111111111';
  const trackId = '33333333-3333-4333-8333-333333333333';
  const calls = [];
  const originalFetch = global.fetch;
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
      return {
        ok: true,
        status: 200,
        json: async () => ({
          release: {
            uuid: mine,
            title: 'Night Drive',
            status: 'draft',
            artwork_url: 'https://cdn.example/night.jpg',
            tracks: [{ uuid: trackId, title: 'Night Drive', audio_url: 'https://cdn.example/night.wav' }],
          },
        }),
      };
    }
    if (String(url).includes('/writers') && options && options.method === 'POST') {
      return { ok: true, status: 201, json: async () => ({ uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  try {
    await withAccountUser({ releaseId: mine, trackId: trackId }, async (_row, headers) => {
      const res = mockRes();
      await submitRelease({
        method: 'POST',
        headers,
        id: mine,
        body: Object.assign({
          document_id: 'doc_split_sheet_01',
          release_date: '2026-09-12',
          made_how: madeHow,
          rights_confirmed: true,
        }, extra || {}),
      }, res);
      assert.strictEqual(res.statusCode, 200, json(res).error || 'submit should succeed');
    });
    return calls;
  } finally {
    global.fetch = originalFetch;
  }
}

async function run() {
  await withEnv(async () => {
    const noAi = await runSubmit('no_ai');
    assert.ok(!noAi.some(includesAi), 'no_ai hop submit must not send includes_ai');
    assert.strictEqual(trackAiPatches(noAi).length, 0, 'no_ai hop submit must not PATCH track AI');

    const assisted = await runSubmit('ai_assisted', {
      human_elements: ['Original lyrics'],
      human_contribution: 'I wrote the lyrics and sang the lead.',
    });
    const assistedPatch = trackAiPatches(assisted);
    assert.ok(assistedPatch.length, 'ai_assisted hop submit must PATCH the track');
    const assistedBody = JSON.parse(assistedPatch[0].body || '{}');
    assert.deepStrictEqual(assistedBody.track_properties, ['includes_ai']);
    assert.strictEqual(assistedBody.ai_service_other, 'I wrote the lyrics and sang the lead.');
    assert.strictEqual(assistedBody.ai_service, undefined);
    assert.deepStrictEqual(assistedBody.ai_elements, ['vocals', 'instrumentation', 'composition', 'production']);
    assert.ok(!/suno/i.test(JSON.stringify(assistedBody)));

    const full = await runSubmit('fully_ai');
    const fullPatch = trackAiPatches(full);
    assert.ok(fullPatch.length, 'fully_ai hop submit must PATCH the track');
    const fullBody = JSON.parse(fullPatch[0].body || '{}');
    assert.deepStrictEqual(fullBody.track_properties, ['includes_ai']);
    assert.strictEqual(fullBody.ai_service_other, 'generative AI');
    assert.strictEqual(fullBody.ai_service, undefined);
    assert.deepStrictEqual(fullBody.ai_elements, ['vocals', 'instrumentation', 'composition', 'lyrics', 'production']);
    assert.ok(!/suno/i.test(JSON.stringify(fullBody)));
  });

  console.log('lib/store-ai-hop.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
