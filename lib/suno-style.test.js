const assert = require('assert');
const fs = require('fs');
const path = require('path');
const style = require('./suno-style');
const core = require('./song-helper');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

const full = {
  genre: 'R&B',
  mood: 'heartbroken',
  region: 'East Coast',
  energy: 'medium',
  vocal: 'female',
  era: '2010s',
  instruments: ['electric piano', 'bass']
};

assert.strictEqual(style.missing(full).length, 0);
const vocalOnly = style.missing({ genre: 'R&B', energy: 'medium' });
assert.strictEqual(vocalOnly.length, 1);
assert.strictEqual(vocalOnly[0].id, 'vocal');
const two = style.missing({});
assert.strictEqual(two.length, 2);
assert.strictEqual(two[0].id, 'genre');
assert.strictEqual(two[1].id, 'vocal');

const text = style.prompt(full, core.stripArtistNames);
assert.ok(text.indexOf('R&B') === 0);
assert.ok(text.indexOf('heartbroken') !== -1);
assert.ok(text.indexOf('electric piano, bass') !== -1);
assert.ok(text.indexOf('female vocal') !== -1);
assert.ok(text.indexOf('2010s') !== -1);
assert.ok(text.indexOf('mid tempo') !== -1);
assert.ok(text.indexOf('medium energy') !== -1);
assert.ok(text.indexOf('East Coast feel') !== -1);
assert.ok(text.length <= style.LIMIT);
assert.ok(text.indexOf(', ') !== -1);

const named = style.prompt({
  genre: 'R&B',
  mood: 'intimate like Drake',
  energy: 'low',
  vocal: 'female'
}, core.stripArtistNames);
assert.ok(!/drake/i.test(named));
assert.ok(named.length <= style.LIMIT);

const louder = style.tweak(full, 'energy');
assert.strictEqual(louder.energy, 'high');
assert.ok(style.prompt(louder).indexOf('fast tempo') !== -1);
const softer = style.tweak(full, 'softer');
assert.strictEqual(softer.energy, 'low');
assert.strictEqual(softer.texture, 'soft');
const other = style.tweak(full, 'vocal');
assert.strictEqual(other.vocal, 'male');
const more = style.tweak(full, 'instruments');
assert.ok(more.instruments.length === full.instruments.length + 1);

const applied = style.applyAnswers({ genre: 'Pop' }, { vocal: 'duet', tempo: 'fast' });
assert.strictEqual(applied.vocal, 'duet');
assert.strictEqual(applied.energy, 'high');
assert.strictEqual(style.missing(applied).length, 0);

const page = ['song-helper.html', 'song-helper.js', 'song-helper-v2.js', 'lib/suno-style.js'].map(read).join('\n');
assert.ok(page.indexOf('\u2014') === -1);
assert.ok(page.indexOf('Make my style prompt') !== -1);
assert.ok(page.indexOf('Copy lyrics') !== -1);
assert.ok(page.indexOf('Make my Suno style prompt') === -1);
assert.ok(page.indexOf('Copy for Suno') === -1);
assert.ok(page.indexOf('Your style prompt') !== -1);
assert.ok(page.indexOf('id="sh-suno-style"') !== -1);
assert.ok(page.indexOf('id="sh-v2-style"') !== -1);
assert.ok(page.indexOf('id="sh-style-feel"') !== -1);
assert.ok(read('song-helper.js').indexOf("getElementById('sh-style-feel')") !== -1);
assert.ok(read('song-helper.js').indexOf('feelingInput.value.trim()') === -1);
