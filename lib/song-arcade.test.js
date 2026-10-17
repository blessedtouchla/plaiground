'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const arcade = require('./song-arcade');
const features = require('./features');

const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function wordsOf(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
}

const lyric = [
  'I keep the porch light on',
  'I keep the porch light on',
  'I keep the porch light on',
  'no',
  'The dog waited by the door',
].join('\n');

const titles = arcade.CABINETS.map(function (row) { return row.title; });
assert.deepStrictEqual(titles, ['Write or fix my song', 'Make a parody', 'Remix my song']);

const first = arcade.stepWrite({});
assert.strictEqual(first.scene.ask, 'Starting fresh or fixing one?');
assert.deepStrictEqual(first.scene.tiles.map(function (row) { return row.label; }), ['Starting fresh', 'Fixing one']);
assert.strictEqual(first.scene.fields.length, 0);

const freshClass = arcade.stepWrite({ path: 'fresh' });
assert.strictEqual(freshClass.scene.ask, 'How do you want to write it?');
assert.deepStrictEqual(freshClass.scene.tiles.map(function (row) { return row.label; }), [
  "I'll write, coach me",
  "Let's write it together",
  'Write it for me',
]);
assert.deepStrictEqual(freshClass.scene.tiles.map(function (row) { return row.note; }), ['Human', 'AI-assisted', 'Fully AI']);

const fixClass = arcade.stepWrite({ path: 'fix' });
assert.deepStrictEqual(fixClass.scene.tiles.map(function (row) { return row.label; }), [
  'Coach me to fix it',
  'Suggest fixes',
  'Fix it for me',
]);

const mood = arcade.stepWrite({ path: 'fresh', classId: 'human' });
assert.strictEqual(mood.scene.ask, 'What mood is this?');
assert.strictEqual(mood.scene.fields.length, 0);

const story = arcade.stepWrite({ path: 'fresh', classId: 'human', mood: 'Love' });
assert.strictEqual(story.scene.ask, 'What happened?');
assert.strictEqual(story.scene.fields.length, 1);

const who = arcade.stepWrite({ path: 'fresh', classId: 'full', mood: 'Love', story: 'I left the porch light on for my sister.' });
assert.strictEqual(who.scene.id, 'who');
assert.strictEqual(who.scene.fields.length, 1);

const mark = arcade.trail('write', {});
assert.strictEqual(mark.index, 1);
assert.ok(mark.total > 1);

const shown = arcade.reveal('show', {
  path: 'fresh',
  classId: 'human',
  mood: 'Love',
  story: 'I left the porch light on for my sister.',
  whoAsked: true,
  keepAsked: true,
  lyrics: 'I left the porch light on\nMy sister laughed',
});
assert.strictEqual(shown.classLabel, 'Human');
assert.strictEqual(shown.madeHow, 'no_ai');
assert.ok(shown.style.indexOf('Mood: Love') !== -1);
assert.ok(shown.style.length > 10);

const fixed = arcade.reveal('fix', {
  path: 'fix',
  classId: 'full',
  lyrics: lyric,
  fixes: ['weak', 'hook'],
});
assert.strictEqual(fixed.heading, 'Before and after');
assert.strictEqual(fixed.classLabel, 'Fully AI');
assert.ok(fixed.style);
assert.ok(fixed.lines.some(function (line) { return line.changed; }));
const allowed = {};
wordsOf(lyric).forEach(function (word) { allowed[word] = true; });
['verse', 'hook', 'bridge', 'outro'].forEach(function (word) { allowed[word] = true; });
wordsOf(fixed.after).forEach(function (word) {
  assert.ok(allowed[word], 'invented word ' + word);
});

const remix = arcade.reveal('remix', {
  lyrics: lyric,
  fromGenre: 'Pop',
  toGenre: 'Afrobeats',
  vibe: 'Bright',
  genreAsked: true,
  moodAsked: true,
});
assert.strictEqual(remix.heading, 'Pop to Afrobeats');
assert.ok(remix.style.indexOf('Afrobeats') !== -1);
const unnamed = arcade.reveal('remix', {
  lyrics: lyric,
  toGenre: 'Jazz',
  vibe: 'Soft',
  genreAsked: true,
  moodAsked: true,
});
assert.strictEqual(unnamed.heading, 'Your song to Jazz');

assert.strictEqual(arcade.coachTips({ classId: 'human', mood: 'Calm' }).length > 0, true);
assert.strictEqual(features.FLAGS.SONG_HELPER_ARCADE, true);
assert.strictEqual(features.enabled('SONG_HELPER_ARCADE'), true);

const page = read('song-helper.html');
assert.ok(page.includes('lib/song-arcade.js?v=20261017arcade'));
assert.ok(page.includes('song-helper-arcade.js?v=20261017arcade'));
assert.ok(!/id="sh-start"[^>]*hidden/.test(page));
assert.ok(read('song-helper-v2.js').includes('openParody'));
assert.ok(read('api/song-helper.js').includes("action === 'arcade-fix'"));
assert.ok(read('api/song-helper.js').includes("action === 'arcade-remix'"));
assert.ok(read('api/song-helper.js').includes("body.action === 'arcade-write'"));

const bundle = [
  read('lib/song-arcade.js'),
  read('song-helper-arcade.js'),
  read('song-helper-arcade.css'),
].join('\n');
assert.ok(!/Song Mechanic/.test(bundle));
assert.ok(!/Style prompt only/.test(bundle));
assert.ok(!/\bSuno\b/.test(bundle));
assert.ok(!/\bToneGrid\b/.test(bundle));
assert.ok(bundle.indexOf('\u2014') === -1);
assert.ok(bundle.indexOf('\u2013') === -1);
assert.ok(bundle.includes('Your style prompt'));
assert.ok(bundle.includes('Copy and open'));
assert.ok(bundle.includes('sh-arcade-progress'));
assert.ok(bundle.includes('data-arcade-host'));

console.log('song-arcade tests passed');
