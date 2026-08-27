'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const storeWebhook = require('./store-webhook');
const accounts = require('./accounts');
const auth = require('./auth');
const tonegridApi = require('../api/tonegrid');

const SECRET = 'unit-test-store-webhook-secret';
const MINE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

function signedHeaders(raw, extra) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = storeWebhook.sign(raw, SECRET, ts);
  return Object.assign({
    'x-tonegrid-signature': 't=' + ts + ',v1=' + sig,
    'content-type': 'application/json',
  }, extra || {});
}

function streamReq(headers, raw) {
  const req = Object.assign(new EventEmitter(), {
    method: 'POST',
    url: '/api/tonegrid/webhook',
    headers: headers || {},
  });
  const buf = Buffer.from(raw == null ? '' : raw);
  setImmediate(() => {
    if (buf.length) req.emit('data', buf);
    req.emit('end');
  });
  return req;
}

async function withUser(fn) {
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
  row = await accounts.updateCatalog(row.id, { releaseId: MINE });
  try {
    await fn(row);
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
  const prevHook = process.env.TONEGRID_WEBHOOK_SECRET;
  process.env.TONEGRID_API_KEY = 'test-key-value-not-for-commit';
  process.env.TONEGRID_BASE_URL = 'https://api-sandbox.tonegrid.pro/api';
  process.env.TONEGRID_WEBHOOK_SECRET = SECRET;
  try {
    await fn();
  } finally {
    if (prevKey === undefined) delete process.env.TONEGRID_API_KEY;
    else process.env.TONEGRID_API_KEY = prevKey;
    if (prevBase === undefined) delete process.env.TONEGRID_BASE_URL;
    else process.env.TONEGRID_BASE_URL = prevBase;
    if (prevHook === undefined) delete process.env.TONEGRID_WEBHOOK_SECRET;
    else process.env.TONEGRID_WEBHOOK_SECRET = prevHook;
  }
}

async function run() {
  const raw = JSON.stringify({
    event: 'release.dsp.spotify.rejected',
    release_id: MINE,
    status: 'rejected',
    rejection_reason: 'Artwork failed QC',
  });
  const ok = storeWebhook.verify(raw, signedHeaders(raw), SECRET);
  assert.strictEqual(ok.ok, true);

  const bad = storeWebhook.verify(raw, { 'x-tonegrid-signature': 't=1,v1=deadbeef' }, SECRET);
  assert.strictEqual(bad.ok, false);

  const skipped = storeWebhook.verify(raw, {}, '');
  assert.strictEqual(skipped.ok, true);
  assert.strictEqual(skipped.skipped, true);

  const parsed = storeWebhook.parseEvent('release.dsp.spotify.rejected', JSON.parse(raw));
  assert.strictEqual(parsed.releaseId, MINE);
  assert.strictEqual(parsed.forceNeedsFix, true);
  assert.strictEqual(parsed.status, 'needs-fix');
  assert.strictEqual(storeWebhook.persistStatus('live', parsed), 'needs-fix');
  assert.strictEqual(storeWebhook.persistStatus('pending', parsed), 'needs-fix');

  const liveEvent = storeWebhook.parseEvent('release.dsp.spotify.live', {
    data: { release: { uuid: MINE, status: 'live' } },
  });
  assert.strictEqual(liveEvent.forceNeedsFix, false);
  assert.strictEqual(liveEvent.status, 'live');

  const qc = storeWebhook.parseEvent('ingestion.rejected', { release_id: MINE, message: 'QC failed' });
  assert.strictEqual(qc.forceNeedsFix, true);
  assert.strictEqual(qc.status, 'needs-fix');

  await withStoreEnv(async () => {
    await withUser(async (row) => {
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ uuid: MINE, title: 'Night Drive', status: 'pending' }),
      });
      try {
        const rejectRaw = JSON.stringify({
          event: 'release.dsp.spotify.rejected',
          release_id: MINE,
          status: 'rejected',
          rejection_reason: 'Artwork failed QC',
        });
        const res = mockRes();
        await tonegridApi(streamReq(signedHeaders(rejectRaw, { 'x-tonegrid-event': 'release.dsp.spotify.rejected' }), rejectRaw), res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(json(res).status, 'needs-fix');
        const next = await accounts.findById(row.id);
        const stored = ((next.profile && next.profile.releases) || []).find((item) => {
          return String(item.tonegrid_release_id || item.id) === MINE;
        });
        assert.ok(stored);
        assert.strictEqual(stored.tonegrid_status, 'needs-fix');
        assert.ok(stored.tonegrid_status !== 'live');
        assert.ok(/Artwork failed QC/.test(stored.rejection_reason));
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  await withStoreEnv(async () => {
    await withUser(async () => {
      const rejectRaw = JSON.stringify({
        event: 'release.dsp.spotify.rejected',
        release_id: MINE,
        status: 'rejected',
      });
      const res = mockRes();
      await tonegridApi(streamReq({ 'x-tonegrid-signature': 't=1,v1=nope' }, rejectRaw), res);
      assert.strictEqual(res.statusCode, 401);
    });
  });

  await withStoreEnv(async () => {
    await withUser(async (row) => {
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ uuid: MINE, title: 'Night Drive', status: 'live' }),
      });
      try {
        const liveRaw = JSON.stringify({
          event: 'release.dsp.spotify.rejected',
          release_id: MINE,
          status: 'rejected',
        });
        const res = mockRes();
        await tonegridApi(streamReq(signedHeaders(liveRaw, { 'x-tonegrid-event': 'release.dsp.spotify.rejected' }), liveRaw), res);
        assert.strictEqual(json(res).status, 'needs-fix', 'rejection must win over a live GET');
        const next = await accounts.findById(row.id);
        const stored = ((next.profile && next.profile.releases) || []).find((item) => {
          return String(item.tonegrid_release_id || item.id) === MINE;
        });
        assert.strictEqual(stored.tonegrid_status, 'needs-fix');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  console.log('lib/store-webhook.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
