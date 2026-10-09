'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const design = require('./style-design');
const style = require('./suno-style');
const core = require('./song-helper');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

assert.strictEqual(design.RECIPES.length, 10);
assert.strictEqual(design.warning('bossa', 'drill'), 'These two pull in different directions. Want a bridge between them?');
assert.strictEqual(design.warning('gospel', 'trap'), '');
assert.strictEqual(design.pairLevel('gospel', 'trap'), 'great');
assert.strictEqual(design.pairLevel('country', 'house'), 'works');
assert.strictEqual(design.pairLevel('drill', 'bossa'), 'risky');

for (var seed = 0; seed < 24; seed += 1) {
  var spin = design.roulette(seed);
  var level = design.pairLevel(spin.lead, spin.flavor);
  assert.ok(level === 'great' || level === 'works', level);
}

assert.strictEqual(design.swapInstrument('piano'), 'Rhodes');
assert.strictEqual(design.swapInstrument('808s'), 'handpan');
assert.strictEqual(design.swapInstrument('hard 808s'), 'handpan');
var swapped = design.swapOne(['piano', 'bass']);
assert.strictEqual(swapped.from, 'piano');
assert.strictEqual(swapped.to, 'Rhodes');
assert.deepStrictEqual(swapped.instruments, ['Rhodes', 'bass']);

var fresher = design.lessGeneric({ era: 'now', tone: 'smooth', mix: 'radio', instruments: ['piano'] });
assert.strictEqual(fresher.design.era, '70s');
assert.strictEqual(fresher.design.tone, 'breathy');
assert.strictEqual(fresher.design.mix, 'tape');
assert.ok(fresher.design.instruments.indexOf('Rhodes') !== -1);
assert.ok(fresher.changes.length >= 3);
var undone = design.lessGeneric(fresher.design);
assert.notStrictEqual(undone.design.era, fresher.design.era);

assert.strictEqual(design.capTags(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']).length, 8);
assert.ok(design.SCENES.length >= 12);
var sceneCopy = JSON.stringify(design.SCENES);
assert.ok(sceneCopy.indexOf('\u2014') === -1);
assert.ok(!/\bSuno\b/.test(sceneCopy));
assert.ok(!/drake|beatles|taylor swift/i.test(sceneCopy));
assert.ok(design.collectTags({
  era: '70s',
  mix: 'tape',
  bridge: true,
  scene: 'sunday-kitchen'
}).length <= 8);

design.RECIPES.forEach(function (recipe) {
  var text = style.prompt({
    design: { lead: recipe.lead, flavor: recipe.flavor, blend: 'mostly', rhythm: 'lead' }
  }, core.stripArtistNames);
  var lead = design.GENRES.filter(function (item) { return item.id === recipe.lead; })[0];
  var flavor = design.GENRES.filter(function (item) { return item.id === recipe.flavor; })[0];
  var body = text.split('Avoid:')[0];
  assert.ok(text.indexOf(lead.label) !== -1, recipe.name);
  assert.ok(text.indexOf(flavor.label) !== -1, recipe.name);
  assert.ok(text.indexOf('70/30') !== -1, recipe.name);
  assert.ok(text.indexOf(lead.bpm + ' BPM') !== -1, recipe.name);
  assert.strictEqual((text.match(/\d{2,3} BPM/g) || []).length, 1, recipe.name);
  assert.ok(!/\d+-\d+ BPM/.test(text), recipe.name);
  assert.ok(text.indexOf('owns rhythm and drums') !== -1, recipe.name);
  assert.ok(body.indexOf(flavor.drums) === -1, recipe.name + ' flavor drums');
  assert.ok(text.indexOf('Avoid:') > text.indexOf('BPM'), recipe.name);
  assert.ok(text.length <= 900, recipe.name);
  assert.ok(text.indexOf('\u2014') === -1, recipe.name);
  assert.ok(!/\bSuno\b/.test(text), recipe.name);
});

var mix = style.prompt({
  design: { lead: 'pop', flavor: 'latinguitar', blend: 'mix', rhythm: 'lead' }
}, core.stripArtistNames);
assert.ok(mix.indexOf('50/50') !== -1);
var touch = style.prompt({
  design: { lead: 'synthpop', flavor: 'soul', blend: 'touch', rhythm: 'flavor' }
}, core.stripArtistNames);
assert.ok(touch.indexOf('85/15') !== -1);
assert.ok(touch.indexOf('Soul owns rhythm and drums') !== -1);
assert.ok(touch.indexOf('88 BPM') !== -1);
assert.ok(touch.split('Avoid:')[0].indexOf('drum machine') === -1);

var third = style.prompt({
  design: { lead: 'gospel', flavor: 'trap', third: 'soul', blend: 'mostly' }
}, core.stripArtistNames);
assert.ok(third.indexOf('hint of Soul') !== -1);
assert.strictEqual((third.match(/\d{2,3} BPM/g) || []).length, 1);

var instrumental = style.prompt({
  design: { lead: 'gospel', flavor: 'trap', instrumental: true, tone: 'raspy' }
}, core.stripArtistNames);
assert.ok(/instrumental\. Avoid:/.test(instrumental));
assert.ok(instrumental.split('Avoid:')[0].indexOf('raspy') === -1);

var named = style.prompt({
  design: { lead: 'rnb', flavor: 'lofijazz', accent: 'like Drake', tone: 'smooth' }
}, core.stripArtistNames);
assert.ok(!/drake/i.test(named));
assert.ok(named.indexOf('warm tone') !== -1);

var artistWins = style.prompt({
  mood: 'in love',
  tempo: 'fast',
  energy: 'high',
  vocal: 'female',
  flow: { forId: 'someone', aimId: 'heal', kindId: 'love', scene: 'in the kitchen at home' },
  design: { lead: 'gospel', flavor: 'trap', blend: 'mostly', tone: 'raspy', instruments: ['piano'] }
}, core.stripArtistNames);
assert.ok(artistWins.indexOf('fast tempo') !== -1);
assert.ok(artistWins.indexOf('70-85') === -1);
assert.ok(artistWins.indexOf('78 BPM') === -1);
assert.ok(artistWins.indexOf('raspy female vocal') !== -1);
assert.ok(artistWins.indexOf('tender close vocal') === -1);
assert.ok(artistWins.indexOf('piano') !== -1);
assert.ok(artistWins.split('Avoid:')[0].indexOf('808') === -1);

var capped = style.prompt({
  design: {
    lead: 'gospel',
    flavor: 'trap',
    instruments: ['piano', 'bass', 'synth', 'strings', 'handpan', 'Rhodes']
  }
}, core.stripArtistNames);
assert.ok(capped.indexOf('piano, bass, synth, strings') !== -1);
assert.ok(capped.indexOf('handpan') === -1);
assert.ok(capped.indexOf('Rhodes') === -1);

var model = {
  base: 'Gospel with a trap flavor, 70/30. Gospel owns rhythm and drums. Trap owns harmony, audible in the chorus.',
  withThird: 'Gospel with a trap flavor and a hint of Soul, 70/30. Gospel owns rhythm and drums. Trap owns harmony, audible in the chorus.',
  mood: 'in love',
  extraMood: ['smooth warm', 'intimate and personal'],
  bpm: '78 BPM',
  vocal: 'breathy mid sung vocal, close and intimate',
  instruments: 'hand claps',
  tags: ['70s', 'lo-fi tape'],
  structure: 'Verses stay with the lead. The flavor lifts the chorus.',
  instrumental: '',
  avoid: 'Avoid: spoken intro, hard 808s, mismatched tempo'
};
var full = design.fit(model, 900);
assert.ok(full.indexOf('hint of Soul') !== -1);
assert.ok(full.indexOf('Verses stay') !== -1);
assert.ok(full.indexOf('smooth warm') !== -1);
var noStructure = design.fit(model, full.length - 5);
assert.ok(noStructure.indexOf('Verses stay') === -1);
assert.ok(noStructure.indexOf('smooth warm') !== -1);
assert.ok(noStructure.indexOf('hint of Soul') !== -1);
var noMood = design.fit(model, noStructure.length - 5);
assert.ok(noMood.indexOf('smooth warm') === -1);
assert.ok(noMood.indexOf('hint of Soul') !== -1);
var noThird = design.fit(model, noMood.length - 5);
assert.ok(noThird.indexOf('hint of Soul') === -1);
assert.ok(noThird.indexOf('Gospel with a trap flavor, 70/30') !== -1);
assert.ok(noThird.length <= noMood.length - 5);

var files = ['lib/style-design.js', 'lib/style-swaps.js', 'song-helper-v2.js', 'song-helper.html'].map(read).join('\n');
assert.ok(files.indexOf('\u2014') === -1);
assert.ok(!/\bSuno\b/.test(read('lib/style-design.js')));
assert.ok(!/\bSuno\b/.test(read('lib/style-swaps.js')));
assert.ok(read('lib/style-design.js').indexOf('Design my style') !== -1);
assert.ok(read('song-helper.html').indexOf('id="sh-style-design"') !== -1);
assert.ok(read('song-helper-v2.js').indexOf('paintStyleDesign') !== -1);
assert.ok(read('song-helper.html').indexOf('lib/style-design.js') < read('song-helper.html').indexOf('lib/suno-style.js'));
assert.ok(!design.active(design.blank()));

console.log('style-design.test.js ok');
