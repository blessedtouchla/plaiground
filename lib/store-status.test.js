'use strict';
const assert = require('assert');
const ss = require('./store-status');

const rows = ss.normalize({ deliveries: [
  { dsp: 'spotify', dsp_name: 'Spotify', status: 'live', dsp_release_id: 'spotify:album:4uLU6hMCjMI75M1A2tKUQC', submitted_at: '2026-10-01T10:00:00Z', live_at: '2026-10-03T09:00:00Z' },
  { dsp: 'deezer', dsp_name: 'Deezer', status: 'live', dsp_release_id: '123456', submitted_at: '2026-10-01T10:00:00Z', live_at: '2026-10-01T10:02:00Z' },
  { dsp: 'audiomack', dsp_name: 'Audiomack', status: 'live', submitted_at: '2026-10-01T10:00:00Z', live_at: '2026-10-02T10:00:00Z' },
  { dsp: 'tidal', status: 'submitted', submitted_at: '2026-10-01T10:00:00Z' },
  { dsp: 'apple-music', status: 'rejected', error_message: 'ToneGrid says artwork bad' },
  { dsp: 'tonegrid', status: 'live' },
] });
const by = Object.fromEntries(rows.map((r) => [r.dsp, r]));
assert.strictEqual(rows.length, 5);
assert.strictEqual(by.spotify.confirmed, true);
assert.strictEqual(by.spotify.tone, 'live');
assert.strictEqual(by.spotify.store_url, 'https://open.spotify.com/album/4uLU6hMCjMI75M1A2tKUQC');
assert.strictEqual(by.spotify.live_date, '2026-10-03');
// fast simulated timeline: never green
assert.strictEqual(by.deezer.simulated, true);
assert.strictEqual(by.deezer.tone, 'wait');
assert.strictEqual(by.deezer.note, ss.UNCONFIRMED_COPY);
// live with no store id: never green
assert.strictEqual(by.audiomack.confirmed, false);
assert.strictEqual(by.audiomack.note, ss.UNCONFIRMED_COPY);
assert.strictEqual(by.tidal.label, 'Processing');
assert.strictEqual(by['apple-music'].tone, 'bad');
assert.ok(!/tonegrid|interspace|distrokid/i.test(JSON.stringify(rows)), 'no partner names');
assert.ok(rows.filter((r) => r.tone === 'live').every((r) => r.confirmed && r.store_url));
assert.ok(!/\u2014/.test(require('fs').readFileSync(__filename.replace('.test', ''), 'utf8')));

// Real-data shape: bulk flip, same second, no store IDs, zoneless timestamps.
const bulk = ss.normalize({ release_id: 'x', deliveries: ['spotify', 'apple-music', 'deezer', 'tidal'].map((d) => ({ dsp: d, dsp_name: d, status: 'live', dsp_release_id: d === 'spotify' ? 'spotify:album:4uLU6hMCjMI75M1A2tKUQC' : null, submitted_at: '2026-09-07 20:08:02', live_at: '2026-09-23 23:16:42' })) });
assert.strictEqual(bulk.length, 4);
assert.ok(bulk.every((r) => !r.confirmed && r.simulated && r.tone === 'wait'), 'bulk flip never green, even with an ID');
assert.strictEqual(bulk[0].dsp, 'spotify', 'top stores first');
assert.strictEqual(bulk[0].live_date, '2026-09-23');
assert.deepStrictEqual(ss.counts(bulk), { confirmed: 0, reported_not_confirmed: 4, pending: 0, rejected: 0, taken_down: 0 });

(async () => {
  const tg = require('../api/tonegrid');
  const calls = [];
  const fake = async (path) => {
    calls.push(path);
    if (path.endsWith('/ddex/deliveries')) return { ok: true, data: { deliveries: [{ dsp: 'spotify', status: 'live', dsp_release_id: 'spotify:album:4uLU6hMCjMI75M1A2tKUQC', submitted_at: '2026-10-01T00:00:00Z', live_at: '2026-10-02T00:00:00Z' }] } };
    return { ok: false };
  };
  const id = '11111111-2222-3333-4444-555555555555';
  const a = await tg.storeStatusFor(id, fake);
  const b = await tg.storeStatusFor(id, fake);
  assert.strictEqual(a.stores[0].confirmed, true);
  assert.strictEqual(calls.length, 1, 'second read served from cache');
  assert.deepStrictEqual(a, b);
  console.log('lib/store-status.test.js ok');
})().catch((e) => { console.error(e); process.exit(1); });
