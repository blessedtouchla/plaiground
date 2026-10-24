'use strict';
// Repro: Herman typed "Herman Watson" but the release went to The Iintercepterzz,
// because a store artist id left on an old draft (or the account default) was reused
// without checking it against the typed name.
const test = require('node:test');
const assert = require('node:assert/strict');
const check = require('./artist-check');

const INTER = 'aaaaaaaa-1111-4111-8111-000000000195';
const HERMAN = 'bbbbbbbb-2222-4222-8222-000000000377';
const roster = [
  { id: 'pg-195', name: 'The Iintercepterzz', tonegrid_artist_id: INTER },
  { id: 'pg-377', name: 'Herman Watson', tonegrid_artist_id: HERMAN },
  { id: 'pg-gn', name: 'Germán Núñez', tonegrid_artist_id: '' },
];

test('typed name never rides on another artist id (the bug)', () => {
  const staleDraft = { name: 'Herman Watson', artist_id: INTER, artist_bound_name: 'The Iintercepterzz' };
  assert.equal(check.storeIdBoundToName(roster, staleDraft.artist_id, staleDraft.name, staleDraft.artist_bound_name), false);
  assert.equal(check.storeIdNameConflict(roster, INTER, 'Herman Watson'), 'The Iintercepterzz');
});

test('typed name exact-matches the roster, case and accent insensitive', () => {
  assert.equal(check.rosterStoreIdForName(roster, 'herman watson'), HERMAN);
  assert.equal(check.rosterStoreIdForName(roster, '  HERMAN   WATSON '), HERMAN);
  assert.equal(check.storeIdBoundToName(roster, HERMAN, 'Herman Watson'), true);
  assert.equal(check.artistNameKey('Germán Núñez'), check.artistNameKey('german nunez'));
  assert.equal(check.storeIdNameConflict(roster, HERMAN, 'herman watson'), '');
});

test('no exact match means create new, never a fuzzy fallback', () => {
  assert.equal(check.rosterStoreIdForName(roster, 'Herman Watson Jr'), '');
  assert.equal(check.rosterStoreIdForName(roster, 'Iintercepterzz'), '');
  assert.equal(check.rosterStoreIdForName(roster, 'Germán Núñez'), '');
  assert.equal(check.rosterStoreIdForName([roster[0]], 'Herman Watson'), '');
});

test('an id not on the roster only counts when it was saved for this same name', () => {
  const other = 'cccccccc-3333-4333-8333-000000000999';
  assert.equal(check.storeIdBoundToName(roster, other, 'Herman Watson', 'Herman Watson'), true);
  assert.equal(check.storeIdBoundToName(roster, other, 'Herman Watson', ''), false);
  assert.equal(check.storeIdBoundToName(roster, other, 'Herman Watson', 'The Iintercepterzz'), false);
});
