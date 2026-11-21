'use strict';

const assert = require('assert');
const bpm = require('./genre-bpm');

bpm.genres.forEach(function (genre) {
  const row = bpm.row(genre);
  assert.ok(row.bpm >= row.min && row.bpm <= row.max, genre + ' default sits in its range');
  assert.strictEqual(bpm.label(genre), row.bpm + ' BPM');
});
assert.strictEqual(bpm.bpm('Pop'), 116);
assert.strictEqual(bpm.bpm('Hip hop'), 90);
assert.strictEqual(bpm.bpm('R&B'), 70);
assert.ok(bpm.row('Hip hop').alt && bpm.row('Hip hop').alt.bpm === 140);

console.log('genre-bpm.test.js ok');
