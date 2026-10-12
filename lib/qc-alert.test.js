'use strict';

const assert = require('assert');

const accounts = require('./accounts');
const auth = require('./auth');
const profile = require('./profile');
const audioChunks = require('./audio-chunks');
const mail = require('./mail');
const tonegridApi = require('../api/tonegrid');

const RELEASE_ID = '11111111-1111-4111-8111-111111111111';

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

async function withAccountUser(fn) {
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
  row = await accounts.updateCatalog(row.id, { releaseId: RELEASE_ID });
  const stored = profile.recoverRoster(profile.readStored(row), row.artist_name, row.tonegrid_artist_id);
  const current = (stored.artists && stored.artists[0]) || {};
  const next = profile.upsertArtist(stored, Object.assign({}, current, {
    name: current.name || row.artist_name || 'Ada Night',
    legal_first: 'Ada',
    legal_last: 'Night',
  }));
  row = await accounts.updateProfile(row.id, { profile: next });
  const headers = { cookie: auth.COOKIE + '=' + auth.signSession(row.id) };
  try {
    await fn(row, headers);
  } finally {
    audioChunks.resetForTests();
    accounts.resetStore();
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
  }
}

function releasePayload(status) {
  return {
    release: {
      uuid: RELEASE_ID,
      title: 'Night Drive',
      status: status || 'draft',
      artwork_url: 'https://cdn.example/night-drive.jpg',
      tracks: [{
        uuid: '33333333-3333-4333-8333-333333333333',
        title: 'Night Drive',
        audio_url: 'https://cdn.example/night-drive.wav',
      }],
    },
  };
}

function installFetch(calls, opts) {
  const options = opts || {};
  global.fetch = async function mockFetch(url, init) {
    const hit = { url: String(url), method: init && init.method, body: init && init.body };
    calls.push(hit);
    if (String(url).includes('api.resend.com')) {
      if (options.resendThrows) throw new Error('resend down');
      if (options.resendFails) return { ok: false, status: 500, json: async () => ({ message: 'no' }) };
      return { ok: true, status: 200, json: async () => ({ id: 're_qc' }) };
    }
    if (String(url).includes('/releases/' + RELEASE_ID + '/submit')) {
      if (options.submitFails) return { ok: false, status: 422, json: async () => ({ error: 'not ready' }) };
      return { ok: true, status: 200, json: async () => ({ message: 'Release submitted for review.', status: 'pending' }) };
    }
    if (String(url).includes('/releases/' + RELEASE_ID) && init && init.method === 'PATCH') {
      return { ok: true, status: 200, json: async () => releasePayload(options.releaseStatus || 'draft') };
    }
    if (String(url).includes('/releases/' + RELEASE_ID)) {
      return { ok: true, status: 200, json: async () => releasePayload(options.releaseStatus || 'draft') };
    }
    if (/\/writers(?:\?|$)/.test(String(url))) {
      return { ok: true, status: 201, json: async () => ({ success: true, data: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
}

function qcMails(calls) {
  return calls
    .filter((call) => String(call.url).includes('api.resend.com'))
    .map((call) => JSON.parse(call.body))
    .filter((body) => body.subject === 'New release in QC');
}

async function submit(headers, body) {
  const res = mockRes();
  await tonegridApi(Object.assign({
    method: 'POST',
    url: '/api/tonegrid/releases/' + RELEASE_ID + '/submit',
    headers: headers,
    id: RELEASE_ID,
    body: body || {
      solo_owned_100: true,
      release_date: '2026-09-12',
      made_how: 'no_ai',
      rights_confirmed: true,
      title: 'Night Drive',
    },
  }), res);
  return res;
}

async function withStore(fn) {
  const prevKey = process.env.TONEGRID_API_KEY;
  const prevBase = process.env.TONEGRID_BASE_URL;
  const prevResend = process.env.RESEND_API_KEY;
  const prevFrom = process.env.CONFIRM_FROM;
  const prevFetch = global.fetch;
  process.env.TONEGRID_API_KEY = 'test-key-value-not-for-commit';
  process.env.TONEGRID_BASE_URL = 'https://api-sandbox.tonegrid.pro/api';
  process.env.RESEND_API_KEY = 're_test_key';
  delete process.env.CONFIRM_FROM;
  try {
    await fn();
  } finally {
    if (prevFetch === undefined) delete global.fetch;
    else global.fetch = prevFetch;
    if (prevKey === undefined) delete process.env.TONEGRID_API_KEY;
    else process.env.TONEGRID_API_KEY = prevKey;
    if (prevBase === undefined) delete process.env.TONEGRID_BASE_URL;
    else process.env.TONEGRID_BASE_URL = prevBase;
    if (prevResend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevResend;
    if (prevFrom === undefined) delete process.env.CONFIRM_FROM;
    else process.env.CONFIRM_FROM = prevFrom;
  }
}

async function run() {
  const prevFetch = global.fetch;
  const direct = [];
  global.fetch = async (url, init) => {
    direct.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ id: 're_direct' }) };
  };
  const prevResend = process.env.RESEND_API_KEY;
  const prevFrom = process.env.CONFIRM_FROM;
  process.env.RESEND_API_KEY = 're_test_key';
  delete process.env.CONFIRM_FROM;
  try {
    const sent = await mail.sendQcReleaseAlert({
      artist: 'Jugg Montana',
      title: 'Night Drive',
      release_id: RELEASE_ID,
      password: 'password1',
      password_hash: 'hashed-secret',
      at: new Date('2026-10-12T18:43:00Z'),
    });
    assert.strictEqual(sent.mail_sent, true);
    assert.strictEqual(sent.to, 'emailplaiground@gmail.com');
    assert.strictEqual(sent.from, 'PLAIGROUND <confirm@wannaplai.com>');
    assert.strictEqual(direct[0].subject, 'New release in QC');
    assert.deepStrictEqual(direct[0].to, ['emailplaiground@gmail.com']);
    assert.strictEqual(direct[0].from, 'PLAIGROUND <confirm@wannaplai.com>');
    assert.ok(direct[0].text.includes('Artist: Jugg Montana'));
    assert.ok(direct[0].text.includes('Title: Night Drive'));
    assert.ok(direct[0].text.includes('Release id: ' + RELEASE_ID));
    assert.ok(direct[0].text.includes('Time: Oct 12, 2026, 11:43 AM PT'));
    assert.ok(direct[0].text.includes('QC: https://www.wannaplai.com/admin#submissions'));
    assert.ok(!/password/i.test(direct[0].text + direct[0].html));
    assert.ok(!direct[0].text.includes('hashed-secret'));
  } finally {
    global.fetch = prevFetch;
    if (prevResend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevResend;
    if (prevFrom === undefined) delete process.env.CONFIRM_FROM;
    else process.env.CONFIRM_FROM = prevFrom;
  }

  await withStore(async () => {
    const calls = [];
    installFetch(calls);
    await withAccountUser(async (row, headers) => {
      const res = await submit(headers);
      assert.strictEqual(res.statusCode, 200, res.body);
      assert.strictEqual(json(res).status, 'pending');
      const mailed = qcMails(calls);
      assert.strictEqual(mailed.length, 1);
      assert.strictEqual(mailed[0].subject, 'New release in QC');
      assert.deepStrictEqual(mailed[0].to, ['emailplaiground@gmail.com']);
      assert.ok(mailed[0].text.includes('Artist: Ada Night'));
      assert.ok(mailed[0].text.includes('Title: Night Drive'));
      assert.ok(mailed[0].text.includes('Release id: ' + RELEASE_ID));
      assert.ok(/\bPT\b/.test(mailed[0].text));
      assert.ok(mailed[0].text.includes('https://www.wannaplai.com/admin#submissions'));
      assert.ok(!mailed[0].text.includes('password1'));
      assert.ok(!mailed[0].text.includes(row.password_hash));
    });
  });

  await withStore(async () => {
    const calls = [];
    installFetch(calls, { releaseStatus: 'pending' });
    await withAccountUser(async (_row, headers) => {
      const res = await submit(headers);
      assert.strictEqual(res.statusCode, 200, res.body);
      assert.strictEqual(json(res).skipped, true);
      assert.strictEqual(qcMails(calls).length, 0);
      assert.ok(!calls.some((call) => String(call.url).includes('/submit') && call.method === 'POST'));
    });
  });

  await withStore(async () => {
    const calls = [];
    installFetch(calls, { submitFails: true });
    await withAccountUser(async (_row, headers) => {
      const res = await submit(headers);
      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(qcMails(calls).length, 0);
    });
  });

  await withStore(async () => {
    const calls = [];
    installFetch(calls, { resendFails: true });
    await withAccountUser(async (_row, headers) => {
      const res = await submit(headers);
      assert.strictEqual(res.statusCode, 200, res.body);
      assert.strictEqual(json(res).status, 'pending');
    });
  });

  console.log('qc-alert.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
