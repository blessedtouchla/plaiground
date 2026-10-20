'use strict';
const test = require('node:test');
const assert = require('node:assert');
const tg = require('./tonegrid');
const storeCredits = require('../lib/store-credits');

const scope = { row: { artist_name: 'hhuu', profile: { artists: [
  { id: 'a1', name: 'VEXA', tonegrid_artist_id: '11111111-1111-4111-8111-111111111111' },
  { id: 'a2', name: 'Other Act' },
] } } };

test('track artist is the chosen artist', () => {
  assert.strictEqual(tg.primaryArtistName(scope, { primary_artist: 'VEXA', plaiground_artist_id: 'a1' }), 'VEXA');
  assert.strictEqual(tg.primaryArtistName(scope, { plaiground_artist_id: 'a1' }), 'VEXA');
});

test('multi-artist account with no artist never falls back to the display name', () => {
  assert.strictEqual(tg.primaryArtistName(scope, { title: 'Be Sneaky' }), '');
});

test('email/record artist uses the release artist, not the display name', () => {
  assert.strictEqual(tg.releaseArtistName(scope, { artist: 'VEXA' }, {}), 'VEXA');
  assert.strictEqual(tg.releaseArtistName(scope, {}, { artist: { name: 'VEXA' } }), 'VEXA');
  assert.strictEqual(tg.releaseArtistName(scope, {}, {}), '');
});

test('submit songwriter needs legal first and last name', () => {
  const ok = storeCredits.resolveSongwriter({ legal_first: 'Victoria', legal_last: 'Imtanes', name: 'VEXA' }, [], { requireLegal: true });
  assert.strictEqual(ok.name, 'Victoria Imtanes');
  const bad = storeCredits.resolveSongwriter({ name: 'VEXA', artist: 'VEXA' }, [{ name: 'VEXA' }], { requireLegal: true });
  assert.strictEqual(bad.code, 'LEGAL_NAME_REQUIRED');
  const saved = storeCredits.resolveSongwriter({ plaiground_artist_id: 'a1' }, [{ id: 'a1', name: 'VEXA', legal_first: 'Victoria', legal_last: 'Imtanes' }], { requireLegal: true });
  assert.strictEqual(saved.name, 'Victoria Imtanes');
  // lenient path unchanged for non-submit hops
  assert.ok(storeCredits.resolveSongwriter({ name: 'VEXA' }, []).ok);
});
