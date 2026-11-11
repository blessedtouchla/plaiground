'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.DATABASE_URL = 'postgres://memory';
const rate = require('./song-rate');
const handler = require('../api/song-helper');

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader: function (key, value) { this.headers[key] = value; },
    end: function (raw) {
      this.body = raw;
      this.json = JSON.parse(raw);
    },
  };
}

function mockReq(ip) {
  return {
    method: 'POST',
    url: '/api/song-helper?action=arcade-write',
    headers: { 'x-forwarded-for': ip },
    body: {
      state: {
        type: 'jam',
        aiLevel: 'human',
        built: ['one long enough line', 'two long enough line'],
        answers: { topic: 'a late train' },
      },
    },
  };
}

async function post(ip) {
  const res = mockRes();
  await handler(mockReq(ip), res);
  return res;
}

async function run() {
  rate.useMemory();
  assert.notStrictEqual(rate.hashIp('203.0.113.8'), rate.hashIp('203.0.113.9'));
  assert.strictEqual(rate.hashIp('203.0.113.8'), rate.hashIp('203.0.113.8'));
  assert.ok(!/203\.0\.113\.8/.test(rate.hashIp('203.0.113.8')), 'the stored key is not the raw IP');

  const hour = 1_700_000_000_000;
  for (let i = 0; i < rate.HEAVY_PER_HOUR; i += 1) {
    const hit = await rate.take('203.0.113.8', 'heavy', hour);
    assert.strictEqual(hit.ok, true, 'hit ' + i);
    assert.strictEqual(hit.store, 'memory');
  }
  const blocked = await rate.take('203.0.113.8', 'heavy', hour);
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.scope, 'hour');
  assert.ok(/24 AI writes/.test(rate.limitMessage(blocked)));

  const other = await rate.take('203.0.113.9', 'heavy', hour);
  assert.strictEqual(other.ok, true, 'a different address has its own cap');

  const light = await rate.take('203.0.113.8', 'light', hour);
  assert.strictEqual(light.ok, true, 'light calls do not share the heavy hour');

  rate.useMemory();
  const dayStart = 1699920000000;
  for (let i = 0; i < rate.HEAVY_PER_DAY; i += 1) {
    const hit = await rate.take('198.51.100.4', 'heavy', dayStart + (i % 4) * rate.HOUR_MS);
    assert.strictEqual(hit.ok, true, 'day hit ' + i + ' ' + (hit.scope || ''));
  }
  const dayBlocked = await rate.take('198.51.100.4', 'heavy', dayStart);
  assert.strictEqual(dayBlocked.ok, false);
  assert.strictEqual(dayBlocked.scope, 'day');
  assert.ok(/daily limit of 80/.test(rate.limitMessage(dayBlocked)));

  rate.useMemory();
  const ip = '192.0.2.40';
  for (let i = 0; i < rate.HEAVY_PER_HOUR; i += 1) {
    const res = await post(ip);
    assert.strictEqual(res.statusCode, 200, res.body);
    assert.strictEqual(res.json.ok, true);
  }
  const over = await post(ip);
  assert.strictEqual(over.statusCode, 429);
  assert.strictEqual(over.json.ok, false);
  assert.ok(/hourly limit of 24/.test(over.json.error));
  const next = await post('192.0.2.41');
  assert.strictEqual(next.statusCode, 200, next.body);

  const api = fs.readFileSync(path.join(__dirname, '..', 'api', 'song-helper.js'), 'utf8');
  assert.ok(api.includes("songRate.take"), 'arcade actions use the shared cap');
  assert.ok(!api.includes('hourly limit of 30 songs'), 'the old in-memory 30-song copy is gone');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS song_rate_hits'));
  assert.ok(!/ip text/.test(schema.slice(schema.indexOf('song_rate_hits'))), 'the rate table does not store a raw IP column');

  console.log('lib/song-rate.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
