'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const guide = require('./guide-tiles');
const features = require('./features');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

assert.strictEqual(features.enabled('GUIDE_TILES_ENABLED'), true);
assert.ok(read('lib/features.js').includes('GUIDE_TILES_ENABLED: true'));

const verse = guide.tilesFor({ id: 'verse-1', kind: 'verse', label: 'Verse 1' }, {});
assert.deepStrictEqual(verse.questions.map(function (row) { return row.label; }), [
  'Where were you?',
  'What did they say?',
  'What did you see?',
  'Who was with you?',
]);
assert.ok(verse.questions.length >= 3 && verse.questions.length <= 4);
assert.strictEqual(verse.topics.length, 0);

const hook = guide.tilesFor({ id: 'hook', kind: 'hook', label: 'Hook' }, {});
assert.ok(hook.questions.some(function (row) { return row.label === "What's the one line you'd shout?"; }));
assert.ok(hook.questions.some(function (row) { return row.label === 'What do you want them to feel?'; }));
assert.ok(hook.questions.some(function (row) { return /one or two/i.test(row.prompt); }));
assert.ok(hook.questions.length >= 3 && hook.questions.length <= 4);

const bridge = guide.tilesFor({ id: 'bridge', kind: 'bridge', label: 'Bridge' }, {});
assert.ok(bridge.questions.some(function (row) { return row.label === 'What changed?'; }));
assert.ok(bridge.questions.some(function (row) { return row.label === "What's the truth you haven't said?"; }));

const verse2 = guide.tilesFor({ id: 'verse-2', kind: 'verse', label: 'Verse 2' }, {});
assert.ok(verse2.questions.length >= 3 && verse2.questions.length <= 4);
assert.ok(verse2.questions.every(function (row) { return verse.questions.every(function (other) { return other.id !== row.id; }); }));

const topics = guide.topicTiles({
  kinds: ['heartbreak', 'nostalgic'],
  aims: ['hype'],
  story: 'the first night',
  opener: 'we met at the door',
  wisdom: 'keep going',
});
assert.deepStrictEqual(topics.map(function (row) { return row.label; }), [
  'The first moment',
  'The fight',
  'Looking back',
  "What's next",
]);

const copy = guide.tilesFor({ id: 'verse-1', kind: 'verse', label: 'Verse 1' }, {
  kinds: ['angry'],
  story: 'the fight',
}).tiles.map(function (row) {
  return [row.label, row.prompt, row.example].join(' ');
}).join('\n');
assert.ok(!/—|–/.test(copy));
assert.ok(!/Suno|ToneGrid/i.test(copy));
assert.ok(!/Suno|ToneGrid/i.test(read('lib/guide-tiles.js')));

const html = read('song-helper.html');
const js = read('song-helper-v2.js');
assert.ok(html.includes('lib/guide-tiles.js?v=20261017guide'));
assert.ok(js.includes("enabled('GUIDE_TILES_ENABLED')"));
assert.ok(js.includes('Give me a line'));
assert.ok(js.includes("action: 'suggest'"));
assert.ok(js.includes('Plai: '));

console.log('guide-tiles.test.js ok');
