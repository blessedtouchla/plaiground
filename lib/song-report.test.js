'use strict';

const assert = require('assert');
const report = require('./song-report');
const disclosure = require('./ai-disclosure');

const notes = report.build({
  title: 'Kitchen light',
  stamp: 'AI-assisted',
  lines: [
    { section: 'Verse 1', n: 1, text: 'The plates are still warm from Saturday night', target: 8 },
    { section: 'Verse 1', n: 2, text: 'I left a cup beside the window light', target: 8 },
    { section: 'Hook', n: 1, text: 'I kept the kitchen light on', target: 7 },
    { section: 'Hook', n: 2, text: 'Till the whole block was gone', target: 7 },
    { section: 'Bridge', n: 1, text: 'Say it once, then leave the room', target: 7 },
    { section: 'Bridge', n: 2, text: 'The kettle clicks and the house goes soon', target: 7 }
  ]
});
const text = report.plainText(notes);
assert.strictEqual(report.hasGrade(text), false, text);
assert.ok(text.indexOf('%') === -1);
assert.ok(!/\bscore\b|\bgrade\b|\bpercent\b/i.test(text));
assert.ok(text.indexOf('—') === -1 && text.indexOf('–') === -1);
assert.ok(notes.pictures.indexOf('plates') >= 0);
assert.ok(notes.pictures.indexOf('kitchen') >= 0);
assert.ok(notes.beats[0].label === 'Verse 1 · 1');
assert.ok(notes.rhyme.some(function (row) { return row.exact && /night/.test(row.text) && /light/.test(row.text); }));
assert.ok(notes.rhyme.some(function (row) { return row.near && /room/.test(row.text) && /soon/.test(row.text); }));
assert.strictEqual(disclosure.label('no_ai'), 'Human');
assert.strictEqual(disclosure.label('ai_assisted'), 'AI-assisted');
assert.strictEqual(disclosure.label('fully_ai'), 'Fully AI');

console.log('song-report.test.js ok');
