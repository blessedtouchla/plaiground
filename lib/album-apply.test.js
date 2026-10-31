'use strict';
// Sample run: a fake 3-track album through apply-all, one override, per-track
// checks, and the submit body the server reads. Nothing is sent to a store.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const A = require('./album-apply');
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'album-test-secret';
const api = require('../api/tonegrid');
const storeAi = require('./store-ai');

const album = {
  artist: 'Nova Lane',
  made_how: 'ai_assisted',
  ai_service: 'Udio',
  contributors: [{ name: 'Nova Lane', role: 'performer' }, { name: 'Kei Park', role: 'producer' }],
  writers: [{ name: 'Nova Lane', share: 50 }, { name: 'Kei Park', share: 50 }],
};
let tracks = [
  { title: 'Morning Static', audio_name: 'one.wav', track_id: '11111111-1111-4111-8111-111111111111' },
  { title: 'Paper Moon', audio_name: 'two.wav', track_id: '22222222-2222-4222-8222-222222222222' },
  { title: 'Last Ferry', audio_name: 'three.wav', track_id: '33333333-3333-4333-8333-333333333333' },
];

// Apply to all: every track reads from the album.
tracks = A.applyToAll(tracks);
tracks.forEach((t, i) => {
  const r = A.resolveTrack(album, Object.assign({ position: i + 1 }, t));
  assert.strictEqual(r.applied_from_album, true);
  assert.strictEqual(r.artist, 'Nova Lane');
  assert.strictEqual(r.made_how, 'ai_assisted');
  assert.strictEqual(r.writers.length, 2);
});

// One override: track 3 is fully human with a solo writer.
tracks[2] = A.overrideTrack(tracks[2], { made_how: 'no_ai', writers: [{ name: 'Nova Lane', share: 100 }], artist: 'Someone Else' });
const r3 = A.resolveTrack(album, tracks[2]);
assert.strictEqual(r3.applied_from_album, false);
assert.strictEqual(r3.made_how, 'no_ai');
assert.strictEqual(r3.source.made_how, 'track');
assert.strictEqual(r3.source.contributors, 'album');
assert.strictEqual(r3.artist, 'Nova Lane', 'artist profile always comes from the album');

// Each track runs its own check, and the album passes.
const ok = A.verifyAlbum(album, tracks);
assert.deepStrictEqual(ok.problems, []);
assert.strictEqual(ok.ok, true);
assert.strictEqual(ok.tracks.length, 3);

// A bad track blocks the whole album.
const bad = tracks.slice();
bad[1] = A.overrideTrack(bad[1], { writers: [{ name: 'Kei Park', share: 60 }] });
bad[0] = Object.assign({}, bad[0], { audio_name: '' });
const failed = A.verifyAlbum(album, bad);
assert.strictEqual(failed.ok, false);
assert.ok(failed.problems.some((p) => /Track 1 needs its own audio/.test(p)));
assert.ok(failed.problems.some((p) => /Track 2 writer splits add up to 60%/.test(p)));
assert.strictEqual(A.verifyAlbum(album, [tracks[0], Object.assign({}, tracks[1], { title: 'morning static' })]).ok, false, 'duplicate titles fail');
assert.strictEqual(A.verifyAlbum(album, [tracks[0]]).ok, false, 'one track is not an album');

// Use album settings again clears the override.
assert.strictEqual(A.resolveTrack(album, A.clearOverride(tracks[2])).applied_from_album, true);

// Release naming.
assert.strictEqual(A.releaseKind([{ duration: 200 }, { duration: 200 }]), 'single');
assert.strictEqual(A.releaseKind([1, 2, 3, 4].map(() => ({ duration: 200 }))), 'ep');
assert.strictEqual(A.releaseKind([1, 2, 3, 4, 5, 6, 7].map(() => ({ duration: 200 }))), 'album');

// Submit body: one release, per-track rows; server applies the override only to track 3.
const meta = A.tracksMeta(album, tracks);
assert.strictEqual(meta.length, 3);
assert.deepStrictEqual(meta.map((m) => m.position), [1, 2, 3]);
const body = { made_how: 'ai_assisted', ai_service: 'Udio', tracks_meta: meta };
assert.strictEqual(api.albumTracksMetaError(body), '');
assert.strictEqual(api.albumTrackBody(body, meta[0].track_id), body, 'track 1 keeps the album body');
const t3 = api.albumTrackBody(body, meta[2].track_id);
assert.strictEqual(t3.made_how, 'no_ai');
assert.strictEqual(storeAi.trackAiFields(t3), null, 'human track sends no AI tag');
assert.ok(storeAi.trackAiFields(body), 'AI-assisted tracks still send the AI tag');
assert.ok(/Track 2 needs a Human/.test(api.albumTracksMetaError({ tracks_meta: [meta[0], Object.assign({}, meta[1], { made_how: '' })] })));

// Upload page copy rules.
const ui = fs.readFileSync(path.join(__dirname, '..', 'album-apply-ui.js'), 'utf8')
  + fs.readFileSync(path.join(__dirname, 'album-apply.js'), 'utf8');
assert.ok(!/\u2014/.test(ui), 'no em dashes');
assert.ok(!/suno|tonegrid/i.test(ui), 'no partner names');
assert.ok(/Apply to all tracks/.test(ui) && /Applied from album/.test(ui) && /Edit this track/.test(ui));
const upload = fs.readFileSync(path.join(__dirname, '..', 'upload.html'), 'utf8');
assert.ok(upload.includes('lib/album-apply.js') && upload.includes('album-apply-ui.js'));

console.log('album-apply sample: 3 tracks, apply-all ok, track 3 override (Human, solo writer), album check passed');
