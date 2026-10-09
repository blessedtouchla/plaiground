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

var EXPECTED = {
  'gospel+trap': '140 BPM gospel-trap, both styles locked in one pocket groove, choir stacks and Hammond organ with trap hi-hats and 808s, powerful soulful lead, big chorus',
  'bossa nova+drill': '142 BPM bossa nova and drill, both styles locked in one pocket groove, nylon guitar with sliding 808s and dark hats, hushed vocal, soft chorus',
  'country+house': '122 BPM country-house, both styles locked in one pocket groove, banjo and twang with four-on-the-floor and warm synth chords, warm vocal, singalong chorus',
  '50s doo-wop+hip hop': '92 BPM doo-wop and hip-hop, both styles locked in one pocket groove, close chords and finger snaps with boom bap drums, stacked vocal, catchy chorus',
  'reggaeton+ambient': '94 BPM reggaeton and ambient, both styles locked in one pocket groove, dembow with wide pads, rhythmic vocal, dance chorus',
  'Afrobeats+folk': '105 BPM Afrobeats and folk, both styles locked in one pocket groove, talking drums and guitar licks with acoustic guitar, warm vocal, dance chorus',
  'R&B+lo-fi jazz': '80 BPM R&B and lo-fi jazz, both styles locked in one pocket groove, smooth electric piano with mellow keys and brushed drums, silky vocal, soft chorus',
  'rock+gospel': '118 BPM rock and gospel, both styles locked in one pocket groove, live drums and guitar chords with choir stacks and Hammond organ, powerful vocal, big chorus',
  'pop+Latin guitar': '108 BPM pop and Latin guitar, both styles locked in one pocket groove, bright chords with nylon guitar and hand percussion, clear vocal, catchy chorus',
  'synth pop+soul': '116 BPM synth pop and soul, both styles locked in one pocket groove, drum machine and synth chords with warm horns, bright vocal, catchy chorus'
};

design.RECIPES.forEach(function (recipe) {
  var text = style.prompt({
    design: { lead: recipe.lead, flavor: recipe.flavor, blend: 'mostly' }
  }, core.stripArtistNames);
  var body = text.split('Avoid:')[0].replace(/[.\s]+$/, '');
  assert.strictEqual(body, EXPECTED[recipe.name], recipe.name + ' got ' + body);
  assert.strictEqual((text.match(/\d{2,3} BPM/g) || []).length, 1, recipe.name);
  assert.ok(!/\d+-\d+ BPM/.test(text), recipe.name);
  assert.ok(!/\bowns\b/.test(text), recipe.name);
  assert.ok(!/\d+\/\d+/.test(text), recipe.name);
  assert.ok(text.indexOf('Avoid:') > text.indexOf('BPM'), recipe.name);
  assert.ok(text.length <= design.LIMIT, recipe.name);
  assert.ok(text.indexOf('\u2014') === -1, recipe.name);
  assert.ok(!/\bSuno\b/.test(text), recipe.name);
});

var leadTempo = style.prompt({
  design: { lead: 'gospel', flavor: 'trap', rhythm: 'lead' }
}, core.stripArtistNames);
assert.ok(leadTempo.indexOf('78 BPM gospel-trap') === 0);
assert.ok(leadTempo.indexOf('trap hi-hats and 808s') !== -1);
var flavorTempo = style.prompt({
  design: { lead: 'gospel', flavor: 'trap', rhythm: 'flavor' }
}, core.stripArtistNames);
assert.ok(flavorTempo.indexOf('140 BPM gospel-trap') === 0);

var mix = style.prompt({
  design: { lead: 'pop', flavor: 'latinguitar', blend: 'mix' }
}, core.stripArtistNames);
assert.ok(mix.indexOf('bright chords layered with nylon guitar and hand percussion') !== -1);
assert.ok(mix.indexOf('108 BPM') !== -1);
assert.ok(!/\d+\/\d+/.test(mix));
assert.ok(!/\bowns\b/.test(mix));
var touch = style.prompt({
  design: { lead: 'synthpop', flavor: 'soul', blend: 'touch', rhythm: 'flavor' }
}, core.stripArtistNames);
assert.ok(touch.indexOf('drum machine and synth chords up front, small touches of warm horns') !== -1);
assert.ok(touch.indexOf('88 BPM') !== -1);
assert.ok(touch.split('Avoid:')[0].indexOf('drum machine') !== -1);
assert.ok(!/\bowns\b/.test(touch));
assert.ok(!/85\/15/.test(touch));

var third = style.prompt({
  design: { lead: 'gospel', flavor: 'trap', third: 'soul', blend: 'mostly' }
}, core.stripArtistNames);
assert.ok(third.indexOf('and a hint of warm horns') !== -1);
assert.ok(third.indexOf('140 BPM') !== -1);
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
assert.ok(artistWins.indexOf('fast tempo gospel-trap') !== -1);
assert.ok(artistWins.indexOf('70-85') === -1);
assert.ok(!/\d{2,3} BPM/.test(artistWins));
assert.ok(artistWins.indexOf('raspy female vocal') !== -1);
assert.ok(artistWins.indexOf('tender close vocal') === -1);
assert.ok(artistWins.indexOf('piano') !== -1);
assert.ok(artistWins.split('Avoid:')[0].indexOf('808') !== -1);
assert.ok(!/\bowns\b/.test(artistWins));

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
  base: '140 BPM gospel-trap, choir stacks and Hammond organ with trap hi-hats and 808s',
  withThird: '140 BPM gospel-trap, choir stacks and Hammond organ with trap hi-hats and 808s and a hint of warm horns',
  mood: 'in love',
  extraMood: ['smooth warm', 'intimate and personal'],
  bpm: '78 BPM',
  vocal: 'breathy mid sung vocal, close and intimate',
  instruments: 'hand claps',
  tags: ['70s', 'lo-fi tape'],
  structure: 'The chorus opens wide and stays with the lead.',
  instrumental: '',
  avoid: 'Avoid: spoken intro, hard 808s, mismatched tempo'
};
var full = design.fit(model, 900);
assert.ok(full.indexOf('hint of warm horns') !== -1);
assert.ok(full.indexOf('opens wide') !== -1);
assert.ok(full.indexOf('smooth warm') !== -1);
assert.ok(!/\bowns\b/.test(full));
assert.ok(!/\d+\/\d+/.test(full));
var noStructure = design.fit(model, full.length - 5);
assert.ok(noStructure.indexOf('opens wide') === -1);
assert.ok(noStructure.indexOf('smooth warm') !== -1);
assert.ok(noStructure.indexOf('hint of warm horns') !== -1);
var noMood = design.fit(model, noStructure.length - 5);
assert.ok(noMood.indexOf('smooth warm') === -1);
assert.ok(noMood.indexOf('hint of warm horns') !== -1);
var noThird = design.fit(model, noMood.length - 5);
assert.ok(noThird.indexOf('hint of warm horns') === -1);
assert.ok(noThird.indexOf('140 BPM gospel-trap, choir stacks and Hammond organ with trap hi-hats and 808s') !== -1);
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
assert.ok(read('lib/style-design.js').indexOf('Who sets the tempo') !== -1);
assert.ok(read('lib/style-design.js').indexOf('Lead sets the tempo') !== -1);
assert.ok(read('lib/style-design.js').indexOf('How should they come together?') !== -1);
assert.ok(read('lib/style-design.js').indexOf('How much of the flavor') === -1);
assert.ok(!/\bowns\b/.test(read('lib/style-design.js')));
assert.ok(!/\d+\/\d+/.test(read('lib/style-design.js')));
assert.strictEqual(design.COMES.length, 8);
var comeCopy = JSON.stringify(design.COMES);
assert.ok(comeCopy.indexOf('\u2014') === -1);
assert.ok(!/\bSuno\b/.test(comeCopy));
assert.strictEqual(design.explain({ blend: 'pocket' }), 'Both styles play together on one shared beat.');
assert.strictEqual(design.explain({ lead: 'gospel', flavor: 'trap', blend: 'surprise' }), 'Plai picked Same beat. Both styles play together on one shared beat.');
assert.strictEqual(design.explain({ lead: 'country', flavor: 'house', blend: 'surprise' }), 'Plai picked Layer them. One style\'s drums and bass sit under the other\'s tunes and singing.');
assert.strictEqual(design.explain({ lead: 'bossa', flavor: 'drill', blend: 'surprise' }), 'Plai picked One leads, one colors. The first style carries the song. The other adds small touches.');
assert.strictEqual(design.noteFor({ lead: 'bossa', flavor: 'drill', blend: 'pocket' }), 'These two pull in different directions. Want a bridge between them?');
assert.strictEqual(design.noteFor({ lead: 'bossa', flavor: 'drill', blend: 'collide' }), 'This can be hit or miss. A retry or two is normal.');
assert.strictEqual(design.noteFor({ lead: 'gospel', flavor: 'trap', blend: 'pocket' }), '');
assert.strictEqual(design.noteFor({ lead: 'gospel', flavor: 'trap', blend: 'collide' }), 'This can be hit or miss. A retry or two is normal.');
assert.strictEqual(design.comeId({ lead: 'gospel', flavor: 'trap', blend: 'surprise' }), 'pocket');
assert.strictEqual(design.comeId({ lead: 'country', flavor: 'house', blend: 'surprise' }), 'layer');
assert.strictEqual(design.comeId({ lead: 'bossa', flavor: 'drill', blend: 'surprise' }), 'colors');
assert.strictEqual(design.comeId({ blend: 'mostly' }), 'pocket');
assert.strictEqual(design.comeId({ blend: 'mix' }), 'layer');
assert.strictEqual(design.comeId({ blend: 'touch' }), 'colors');

function bodyOf(lead, flavor, blend) {
  return style.prompt({
    design: { lead: lead, flavor: flavor, blend: blend }
  }, core.stripArtistNames).split('Avoid:')[0].replace(/[.\s]+$/, '');
}

var comeSamples = [
  ['gospel', 'trap', 'pocket', '140 BPM gospel-trap, both styles locked in one pocket groove, choir stacks and Hammond organ with trap hi-hats and 808s, powerful soulful lead, big chorus'],
  ['gospel', 'trap', 'trade', '140 BPM gospel-trap, verses in gospel, chorus flips to trap hi-hats and 808s, powerful soulful lead, big chorus'],
  ['gospel', 'trap', 'collide', '140 BPM gospel-trap, choir stacks and Hammond organ set against trap hi-hats and 808s, powerful soulful lead, big chorus'],
  ['country', 'house', 'layer', '122 BPM country-house, four-on-the-floor and warm synth chords under banjo and twang, warm vocal, singalong chorus'],
  ['country', 'house', 'colors', '122 BPM country-house, banjo and twang up front, small touches of four-on-the-floor and warm synth chords, warm vocal, singalong chorus'],
  ['country', 'house', 'drift', '122 BPM country-house, starts with banjo and twang, drifts into four-on-the-floor and warm synth chords by the bridge, warm vocal, singalong chorus'],
  ['bossa', 'drill', 'pocket', '142 BPM bossa nova and drill, both styles locked in one pocket groove, nylon guitar with sliding 808s and dark hats, hushed vocal, soft chorus'],
  ['bossa', 'drill', 'collide', '142 BPM bossa nova and drill, nylon guitar set against sliding 808s and dark hats, hushed vocal, soft chorus'],
  ['bossa', 'drill', 'surprise', '142 BPM bossa nova and drill, nylon guitar up front, small touches of sliding 808s and dark hats, hushed vocal, soft chorus'],
  ['rnb', 'lofijazz', 'layer', '80 BPM R&B and lo-fi jazz, smooth electric piano layered with mellow keys and brushed drums, silky vocal, soft chorus'],
  ['rnb', 'lofijazz', 'answer', '80 BPM R&B and lo-fi jazz, smooth electric piano, answered by mellow keys and brushed drums, silky vocal, soft chorus'],
  ['rnb', 'lofijazz', 'pocket', '80 BPM R&B and lo-fi jazz, both styles locked in one pocket groove, smooth electric piano with mellow keys and brushed drums, silky vocal, soft chorus'],
  ['synthpop', 'soul', 'trade', '116 BPM synth pop and soul, verses in synth pop, chorus flips to warm horns, bright vocal, catchy chorus'],
  ['synthpop', 'soul', 'colors', '116 BPM synth pop and soul, drum machine and synth chords up front, small touches of warm horns, bright vocal, catchy chorus'],
  ['synthpop', 'soul', 'surprise', '116 BPM synth pop and soul, both styles locked in one pocket groove, drum machine and synth chords with warm horns, bright vocal, catchy chorus']
];
comeSamples.forEach(function (row) {
  var text = style.prompt({
    design: { lead: row[0], flavor: row[1], blend: row[2] }
  }, core.stripArtistNames);
  assert.strictEqual(bodyOf(row[0], row[1], row[2]), row[3], row[0] + ' ' + row[2]);
  assert.strictEqual((text.match(/\d{2,3} BPM/g) || []).length, 1, row[2]);
  assert.ok(text.length <= design.LIMIT, row[2]);
  assert.ok(!/\bowns\b/.test(text), row[2]);
  assert.ok(!/\d+\/\d+/.test(text), row[2]);
  assert.ok(text.indexOf('\u2014') === -1, row[2]);
});

var ids = design.GENRES.map(function (item) { return item.id; });
assert.ok(ids.indexOf('latin') !== -1);
assert.ok(ids.indexOf('lofi') !== -1);
assert.ok(ids.indexOf('indie') !== -1);
for (var i = 0; i < ids.length; i += 1) {
  for (var j = 0; j < ids.length; j += 1) {
    if (i === j) {
      assert.strictEqual(design.pairLevel(ids[i], ids[j]), '');
      assert.strictEqual(design.warning(ids[i], ids[j]), '');
      continue;
    }
    var level = design.pairLevel(ids[i], ids[j]);
    assert.ok(level === 'great' || level === 'works' || level === 'risky', ids[i] + ' ' + ids[j] + ' ' + level);
    var warn = design.warning(ids[i], ids[j]);
    if (level === 'risky') assert.strictEqual(warn, 'These two pull in different directions. Want a bridge between them?', ids[i] + ' ' + ids[j]);
    else assert.strictEqual(warn, '', ids[i] + ' ' + ids[j]);
  }
}
assert.strictEqual(design.pairLevel('nope', 'gospel'), 'risky');
assert.strictEqual(design.warning('indie', 'trap'), 'These two pull in different directions. Want a bridge between them?');
assert.strictEqual(design.pairLevel('latin', 'pop'), 'works');
assert.strictEqual(design.pairLevel('lofi', 'rnb'), 'works');
assert.strictEqual(design.pairLevel('indie', 'country'), 'great');
assert.strictEqual(design.pairLevel('drill', 'folk'), 'risky');
assert.strictEqual(design.warning('drill', 'folk'), 'These two pull in different directions. Want a bridge between them?');

console.log('style-design.test.js ok');
