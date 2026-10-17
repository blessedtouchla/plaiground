'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rhyme = require('./rhyme-it');
const features = require('./features');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

assert.strictEqual(features.enabled('SONG_TOOLS_ENABLED'), true);
assert.strictEqual(features.enabled('TOOL_RHYME_IT'), true);
assert.strictEqual(features.enabled('SONG_GAME_ENABLED'), true);
assert.ok(read('lib/features.js').includes('SONG_TOOLS_ENABLED: true'));
assert.ok(read('lib/features.js').includes('TOOL_RHYME_IT: true'));

assert.strictEqual(rhyme.queryWord(' Heart '), 'heart');
assert.strictEqual(rhyme.queryWord('a'), '');
assert.strictEqual(rhyme.queryWord('fuck'), '');
assert.strictEqual(rhyme.queryWord('f.u.c.k'), '');
assert.strictEqual(rhyme.blocked('fuuuck'), true);
assert.strictEqual(rhyme.blocked('fart'), true);
assert.strictEqual(rhyme.blocked('pervert'), true);
assert.strictEqual(rhyme.blocked('smart'), false);
assert.strictEqual(rhyme.blocked('nigga'), true);
assert.strictEqual(rhyme.blocked('heart'), false);

var packed = rhyme.packRhymes(
  [{ word: 'part' }, { word: 'start' }, { word: 'shit' }, { word: 'part' }, { word: 'not a word' }],
  [{ word: 'short' }, { word: 'part' }, { word: 'bitch' }, { word: 'support' }]
);
assert.deepStrictEqual(packed.perfect, ['part', 'start']);
assert.deepStrictEqual(packed.close, ['short', 'support']);
assert.strictEqual(packed.empty, false);
assert.strictEqual(rhyme.packRhymes([], [{ word: 'ass' }]).empty, true);
assert.strictEqual(rhyme.EMPTY, 'No rhymes found, try another word');

var placed = rhyme.placeWord('hold the', 8, 8, 'line');
assert.strictEqual(placed.text, 'hold the line');
assert.strictEqual(placed.caret, 13);
var mid = rhyme.placeWord('hold line', 4, 4, 'the');
assert.strictEqual(mid.text, 'hold the line');
assert.strictEqual(mid.caret, 8);
var swap = rhyme.placeWord('hold the start', 9, 14, 'heart');
assert.strictEqual(swap.text, 'hold the heart');

assert.strictEqual(
  rhyme.datamuseUrl('rel_rhy', 'heart'),
  'https://api.datamuse.com/words?rel_rhy=heart&max=24'
);
assert.ok(rhyme.datamuseUrl('rel_nry', 'heart').indexOf('rel_nry=heart') !== -1);

const html = read('song-helper.html');
const page = html.slice(html.indexOf('id="sh-page"'), html.indexOf('id="sh-source"'));
const js = read('song-helper-v2.js');
const css = read('song-helper.css');
assert.ok(page.includes('id="sh-write-stage"'));
assert.ok(page.includes('id="sh-tools"'));
assert.ok(page.includes('id="sh-tool-rhyme"'));
assert.ok(page.includes('Type a word'));
assert.ok(page.includes('Rhyme it'));
assert.ok(page.includes('Perfect rhymes') === false);
assert.ok(js.includes('Perfect rhymes'));
assert.ok(js.includes('Close rhymes'));
assert.ok(js.includes('No rhymes found, try another word') || js.includes('rhyme.EMPTY'));
assert.ok(js.includes("enabled('SONG_TOOLS_ENABLED')"));
assert.ok(js.includes("toolFlagOn('TOOL_RHYME_IT')"));
assert.ok(js.includes('enabled(name)'));
assert.ok(read('lib/rhyme-it.js').includes('api.datamuse.com'));
assert.ok(js.includes("datamuseUrl('rel_rhy'"));
assert.ok(js.includes("datamuseUrl('rel_nry'"));
assert.ok(html.includes('lib/rhyme-it.js?v=20261017tools'));
assert.ok(html.includes('song-helper-v2.js?v=20261017guide'));
assert.ok(html.includes('song-helper.css?v=20261017guide'));
assert.ok(css.includes('.sh-write-stage'));
assert.ok(css.includes('.sh-rhyme-chip'));

const copy = [
  'Small tools',
  'Rhyme it',
  'Type a word',
  'Type a word. Tap a rhyme to drop it on the line you are writing.',
  'Perfect rhymes',
  'Close rhymes',
  rhyme.EMPTY,
  'Looking for rhymes.',
  'Added to the line.',
  'Copied.',
  'Those rhymes did not load. Try that word again.',
].join('\n');
assert.ok(!/—|–/.test(copy));
assert.ok(!/Suno|ToneGrid/i.test(copy));
assert.ok(!/Suno|ToneGrid/i.test(page.slice(page.indexOf('id="sh-tools"'))));
assert.ok(!/x\.ai|XAI_API_KEY|credits/.test(read('lib/rhyme-it.js')));

console.log('rhyme-it.test.js ok');
