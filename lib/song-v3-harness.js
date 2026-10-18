'use strict';

// Real-model check for the v3 writer. Runs api/song-helper.js in-process.
// From the repo root, with the key already in the environment:
//   node lib/song-v3-harness.js
// Writes /tmp/song-v3-live-raw.json. Never prints the key. Caps model calls at 30.
// Pass --fresh to ignore a previous raw file.

const fs = require('fs');
const path = require('path');
const xai = require('./xai-client');
const songV3 = require('./song-v3');

const CAP = 30;
const OUT = '/tmp/song-v3-live-raw.json';
const fresh = process.argv.indexOf('--fresh') !== -1;
const results = !fresh && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
let calls = results.reduce(function (n, row) { return n + (row.calls || 0); }, 0);
let cur = null;
const origChat = xai.chat;
xai.chat = async function (opts) {
  if (calls >= CAP) throw new Error('cap reached');
  calls += 1;
  if (cur) cur.calls += 1;
  const result = await origChat.apply(this, arguments);
  if (cur) cur.raw.push((result && result.content) || '');
  return result;
};
const origAudit = songV3.auditDraft;
songV3.auditDraft = function (text, input) {
  const audit = origAudit.apply(this, arguments);
  if (cur) cur.audits.push(audit.failures);
  return audit;
};

const handler = require('../api/song-helper.js');
// The v3 actions sit behind the hidden-link key. Use a throwaway key for this run.
const HARNESS_KEY = 'harness-' + require('crypto').randomBytes(12).toString('hex');
process.env.SONG_HELPER_V3_KEY_SHA256 = require('crypto').createHash('sha256').update(HARNESS_KEY).digest('hex');
let ip = 1;

function call(body) {
  return new Promise(function (resolve) {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.77.0.' + (ip++) },
      body: Object.assign({ k: HARNESS_KEY }, body),
      query: { action: 'v3-write' },
      url: '/api/song-helper?action=v3-write',
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader: function (key, value) { this.headers[key] = value; },
      end: function (raw) { resolve({ status: this.statusCode, body: JSON.parse(raw) }); },
    };
    handler(req, res);
  });
}

const base = {
  title: 'Salt on Sunday',
  scene: 'We stood by the bus stop with a paper cup',
  addressee: 'An old friend',
  story: '',
  language: 'English',
  explicit: 'Clean',
  vibe: '',
  intent_private: 'make them cry',
  advanced: {},
};
const plan = [];
[1, 2].forEach(function (n) {
  plan.push({ id: 'hiphop-' + n, arm: 'Hip-hop', body: Object.assign({}, base, { genre: 'Hip-hop', feelings: ['Heartbreak'], path: 'together', seed: n }) });
  plan.push({ id: 'country-' + n, arm: 'Country', body: Object.assign({}, base, { genre: 'Country', feelings: ['Heartbreak'], path: 'together', seed: n }) });
  plan.push({ id: 'pop-joy-' + n, arm: 'Pop Joy', body: Object.assign({}, base, { genre: 'Pop', feelings: ['Joy'], path: 'together', seed: n }) });
  plan.push({ id: 'pop-heart-' + n, arm: 'Pop Heartbreak', body: Object.assign({}, base, { genre: 'Pop', feelings: ['Heartbreak'], path: 'together', seed: n }) });
  plan.push({ id: 'fullai-' + n, arm: 'Fully AI (Hip-hop)', body: Object.assign({}, base, { genre: 'Hip-hop', feelings: ['Heartbreak'], path: 'ai', seed: n + 10 }) });
});

(async function () {
  if (!process.env.XAI_API_KEY) {
    console.log('XAI_API_KEY is not set. No model calls were made.');
    process.exit(1);
  }
  var t;
  for (t = 0; t < plan.length; t++) {
    var item = plan[t];
    if (results.some(function (row) { return row.id === item.id; })) continue;
    if (calls >= CAP - 1) {
      console.log('stop: cap');
      break;
    }
    cur = { id: item.id, arm: item.arm, sent: item.body, calls: 0, raw: [], audits: [] };
    var started = Date.now();
    var response = await call(item.body);
    cur.ms = Date.now() - started;
    cur.status = response.status;
    cur.body = response.body;
    results.push(cur);
    fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
    var song = response.body && response.body.song;
    console.log(item.id, response.status, response.body && response.body.source, 'calls', cur.calls, 'retried', song && song.retried, 'fails', JSON.stringify((cur.audits && cur.audits[0]) || []).slice(0, 300));
    cur = null;
  }
  console.log('total model calls', calls);
  console.log('raw', OUT);
})();
