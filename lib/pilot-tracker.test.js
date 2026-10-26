'use strict';
const assert = require('assert');
const pilot = require('./pilot-tracker');
const D = (n) => new Date(Date.UTC(2026, 9, 1) + n * 86400000).toISOString();
const users = [
  { id: 'a', email: 'a@x.com', artist_name: 'A', created_at: D(0), tonegrid_release_at: [D(5), D(20)] },
  { id: 'b', email: 'b@x.com', created_at: D(0), tonegrid_release_at: [] },
  { id: 'c', email: 'c@x.com', created_at: D(0), tonegrid_release_at: [D(1), D(40)] },
];
const roll = [
  { user_id: 'a', event_name: 'cover_art_generated', event_count: 1, first_at: D(2), last_at: D(2) },
  { user_id: 'a', event_name: 'song_helper_started', event_count: 3, first_at: D(1), last_at: D(3) },
  { user_id: 'a', event_name: 'split_sheet_signed', event_count: 1, first_at: D(3), last_at: D(3) },
  { user_id: 'a', event_name: 'qualify_completed', event_count: 1, first_at: D(4), last_at: D(4) },
  { user_id: 'b', event_name: 'split_sheet_created', event_count: 1, first_at: D(2), last_at: D(2) },
];
const rows = pilot.buildPilot(users, roll, D(60));
assert.strictEqual(rows[0].first_tool, 'Song Lab');
assert.strictEqual(rows[0].second_release_30d, 'yes');
assert.strictEqual(rows[0].last_step, 'Second release in 30 days');
assert.strictEqual(rows[1].first_tool, 'Split sheet');
assert.strictEqual(rows[1].last_step, 'Split sheet started');
assert.strictEqual(rows[1].second_release_30d, 'no release yet');
assert.strictEqual(rows[2].second_release_30d, 'no');
assert.strictEqual(rows[2].last_step, 'Release submitted');
const f = pilot.funnel(rows);
assert.deepStrictEqual(f.map((x) => x.artists), [3, 2, 1, 1, 1, 2, 1]);
assert.strictEqual(pilot.buildPilot(users, roll, D(10))[2].second_release_30d, 'window open');
console.log('pilot-tracker ok');
