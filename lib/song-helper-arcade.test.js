'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const arcade = require('./song-helper-arcade');
const features = require('./features');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

assert.strictEqual(features.enabled('SONG_HELPER_ARCADE'), true);
assert.strictEqual(features.enabled('PARODY_V2_ENABLED'), true);
assert.strictEqual(features.FLAGS.WORD_TILES_ENABLED, false);

assert.deepStrictEqual(arcade.CABINETS.map(function (cab) { return cab.title; }), [
  'Write my song',
  'Make a parody',
  'Style prompt only',
]);
assert.strictEqual(arcade.CABINETS[1].tilt, true);
assert.strictEqual(arcade.CABINETS[1].fresh, true);
assert.strictEqual(arcade.HALL_TITLE, 'Pick your game');
assert.strictEqual(arcade.CREDIT_LINE, 'Answering questions is free. Writing with AI uses 1 credit.');
assert.strictEqual(arcade.PARODY_NOTE, 'This is a parody. All new words, nothing copied.');
assert.strictEqual(arcade.OPEN_LABEL, 'Copy and open my music app');
assert.ok(arcade.OPEN_URL.indexOf('https://suno.com/create') === 0);

const parodyScenes = arcade.scenes('parody');
assert.strictEqual(parodyScenes[0].ask, 'What are you poking fun at?');
assert.ok(parodyScenes[0].tiles.some(function (tile) { return tile.label === 'Preaching one thing, doing another'; }));
assert.ok(parodyScenes.every(function (scene) { return scene.ask && scene.help; }));
assert.ok(!parodyScenes.some(function (scene) { return /word tile/i.test(JSON.stringify(scene.tiles || [])); }));

const writeScenes = arcade.scenes('write');
assert.strictEqual(writeScenes[0].ask, 'How does it feel?');
assert.strictEqual(writeScenes[1].ask, 'What happened?');
assert.strictEqual(writeScenes[3].ask, 'Which part do you want first?');
assert.ok(writeScenes[3].tiles.some(function (tile) { return tile.id === 'hook'; }));

var state = arcade.blank();
state.game = 'parody';
assert.strictEqual(arcade.ready(state), false);
state = arcade.pick(state, 'preach');
assert.ok(state.parody.tiles.indexOf('preach') !== -1);
assert.ok(state.points >= 50);
assert.strictEqual(arcade.trail(state).label, 'Level 1/4');
assert.strictEqual(arcade.ready(state), true);

state.parody.take = 'preaching humility while picking fights';
state.parody.song = 'Old Example';
state.parody.artist = 'Sample Name';
state.parody.title = 'Me Sneaky';
state.parody.version = 'weird';
const input = arcade.parodyInput(state);
assert.strictEqual(input.title, 'Me Sneaky');
assert.strictEqual(input.version, 'weird');
assert.ok(/Preaching one thing/.test(input.comment));
assert.ok(/Sample Name/.test(input.originalTitle));

const written = arcade.writePack({
  mood: 'heartbreak',
  who: 'someone',
  story: 'The kitchen light stayed on.',
  part: 'hook',
  line: 'The kitchen light stayed on.',
  title: 'Kitchen Light',
});
assert.ok(arcade.plain(written).indexOf('The kitchen light stayed on.') !== -1);
assert.ok(written.stylePrompt.length > 10);
assert.ok(!/kendrick|suno|tonegrid/i.test(written.stylePrompt));

const named = arcade.filterNames('minimal Kendrick piano', ['Kendrick Lamar']);
assert.ok(!/kendrick/i.test(named));
assert.ok(/piano/i.test(named));

const style = arcade.stylePack({ genre: 'hiphop', energy: 'loud' });
assert.strictEqual(style.credit, 0);
assert.ok(/hip-hop/i.test(style.stylePrompt));
assert.strictEqual(style.sections.length, 0);

const facing = arcade.userFacing();
assert.ok(facing.indexOf('Press start') !== -1);
assert.ok(facing.indexOf('Weird Al style mix') !== -1);
assert.ok(!/\bSuno\b|\bToneGrid\b/.test(facing));
assert.ok(!/—|–/.test(facing));
assert.ok(!/Tap a word/i.test(facing));

const page = read('song-helper-arcade.js');
const css = read('song-helper-arcade.css');
const html = read('song-helper.html');
assert.ok(page.includes('Copy and open my music app') || page.includes('OPEN_LABEL'));
assert.ok(page.includes("enabled('SONG_HELPER_ARCADE')"));
assert.ok(!/\bSuno\b|\bToneGrid\b/.test(page + css));
assert.ok(!/—|–/.test(page + css + read('lib/song-helper-arcade.js')));
assert.ok(html.includes('song-helper-arcade.js?v=20261017arcade'));
assert.ok(html.includes('id="sh-start"'));
assert.ok(!/id="sh-start"[^>]*hidden/.test(html));
assert.ok(html.includes('How do you want to start?'));
assert.ok(read('api/song-helper.js').includes("action === 'arcade-write'"));
assert.ok(read('api/song-helper.js').includes('chargeCredit'));
assert.ok(css.includes('prefers-reduced-motion: reduce'));

console.log('song-helper-arcade ok');
