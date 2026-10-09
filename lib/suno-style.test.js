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
assert.strictEqual(style.LIMIT, 900);
assert.ok(text.indexOf('Avoid:') !== -1);
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

const cluesFile = read('lib/style-clues.js');
const html = read('song-helper.html');
assert.ok(cluesFile.indexOf('\u2014') === -1);
assert.ok(!/\bSuno\b/.test(cluesFile));
assert.ok(html.indexOf('lib/style-clues.js') !== -1);
assert.ok(html.indexOf('lib/style-clues.js') < html.indexOf('lib/suno-style.js'));
assert.ok(read('lib/suno-style.js').indexOf("copy.textContent = 'Copy'") !== -1);
assert.ok(read('song-helper-v2.js').indexOf('flowState') !== -1);
assert.ok(read('song-helper-v2.js').indexOf('styleIds') !== -1);
assert.ok(read('song-flow-page.js').indexOf('flowState:') !== -1);

const heal = style.prompt({
  mood: 'in love',
  flow: {
    forId: 'someone',
    aimId: 'heal',
    kindId: 'love',
    scene: 'We were in the kitchen at home'
  }
}, core.stripArtistNames);
assert.ok(heal.indexOf('in love') === 0);
assert.ok(heal.indexOf('70-85 BPM') !== -1);
assert.ok(heal.indexOf('tender close vocal') !== -1);
assert.ok(heal.indexOf('warm acoustic guitar, electric piano') !== -1);
assert.ok(!/(^|, )piano(,| )/.test(heal));
assert.ok(!/(^|, )close(,| )/.test(heal));
assert.ok(!/(^|, )acoustic(\.|$|,)/.test(heal));
assert.ok(heal.indexOf('intimate, direct and personal') !== -1);
assert.ok(heal.indexOf('smooth warm') !== -1);
assert.ok(heal.indexOf('homey') !== -1);
assert.ok(heal.indexOf('Avoid: spoken intro, hard 808s, mismatched tempo') !== -1);
assert.strictEqual(heal, 'in love, 70-85 BPM, tender close vocal, warm acoustic guitar, electric piano, intimate, direct and personal, smooth warm, homey. Avoid: spoken intro, hard 808s, mismatched tempo');
assert.strictEqual(style.prompt({
  mood: 'in love',
  flow: {
    forId: 'someone',
    aimId: 'heal',
    kindId: 'love',
    scene: 'We were in the kitchen at home'
  },
  design: { blend: 'mostly', rhythm: 'lead' }
}, core.stripArtistNames), heal);
assert.ok(heal.indexOf('heavy drums') === -1);
assert.ok(!/\bSuno\b/.test(heal));
assert.ok(heal.indexOf('\u2014') === -1);

const hype = style.prompt({
  mood: 'hyped',
  flow: { forId: 'everyone', aimId: 'hype', kindId: 'hype' }
}, core.stripArtistNames);
assert.ok(hype.indexOf('hyped, 125-145 BPM, confident vocal') === 0);
assert.ok(hype.indexOf('bass, heavy drums') !== -1);
assert.ok(hype.indexOf('big drums') === -1);
assert.ok(hype.indexOf('anthem feel, big singalong chorus, wide mix, high energy') !== -1);
assert.ok(hype.indexOf('Avoid: spoken intro, autotune glitch, a ballad tempo') !== -1);

const confess = style.prompt({
  mood: 'heartbroken',
  flow: {
    forId: 'myself',
    aimId: 'confess',
    kindId: 'heartbreak',
    opener: 'It was late at night'
  }
}, core.stripArtistNames);
assert.ok(confess.indexOf('65-80 BPM') !== -1);
assert.ok(confess.indexOf('whisper-close vocal') !== -1);
assert.ok(confess.indexOf('close-mic') === -1);
assert.ok(confess.indexOf('aching vocal') === -1);
assert.ok(confess.indexOf('bare guitar') !== -1);
assert.ok(confess.indexOf('reflective, sparse') !== -1);
assert.ok(confess.indexOf('slow minor') !== -1);
assert.ok(confess.indexOf('late-night moody pads') !== -1);
assert.ok(confess.indexOf('hard 808s') !== -1);

const clash = style.prompt({
  flow: { aimId: 'heal', kindId: 'hype' }
}, core.stripArtistNames);
assert.ok(clash.indexOf('70-85 BPM') !== -1);
assert.ok(clash.indexOf('heavy drums') === -1);
assert.ok(clash.indexOf('125') === -1);

const userTempo = style.prompt({
  tempo: 'fast',
  energy: 'high',
  flow: { aimId: 'heal', forId: 'someone', kindId: 'love' }
}, core.stripArtistNames);
assert.ok(userTempo.indexOf('fast tempo') !== -1);
assert.ok(userTempo.indexOf('70-85') === -1);
assert.ok(userTempo.indexOf('warm acoustic') === -1);

const userVocal = style.prompt({
  vocal: 'female',
  flow: { aimId: 'heal', forId: 'someone', kindId: 'love' }
}, core.stripArtistNames);
assert.ok(userVocal.indexOf('tender female vocal') !== -1);
assert.ok(userVocal.indexOf('close vocal') === -1);

const capped = style.prompt({
  instruments: ['synth', 'bass', 'strings'],
  flow: { aimId: 'heal' }
}, core.stripArtistNames);
assert.ok(capped.indexOf('synth, bass, strings, warm acoustic guitar') !== -1);
assert.ok(capped.indexOf('piano') === -1);

const stories = style.prompt({
  flow: {
    aimId: 'other',
    opener: 'The kitchen at night in the rain by the stadium'
  }
}, core.stripArtistNames);
assert.ok(stories.indexOf('close, homey, acoustic') !== -1);
assert.ok(stories.indexOf('late-night moody pads') !== -1);
assert.ok(stories.indexOf('soft rain-like texture') === -1);
assert.ok(stories.indexOf('huge, live') === -1);

const lateStory = ('word ').repeat(80) + 'kitchen';
assert.ok(lateStory.length > 280);
const latePrompt = style.prompt({
  flow: { aimId: 'other', opener: lateStory }
}, core.stripArtistNames);
assert.ok(latePrompt.indexOf('close, homey, acoustic') !== -1);

const kept = style.tweak({
  mood: 'in love',
  flow: { aimId: 'heal', forId: 'someone', kindId: 'love' }
}, 'energy');
assert.strictEqual(kept.flow.aimId, 'heal');
assert.strictEqual(kept.energy, 'medium');
assert.ok(style.prompt(kept).indexOf('70-85') === -1);
assert.ok(style.prompt(kept).indexOf('mid tempo') !== -1);

const clues = require('./style-clues');
assert.strictEqual(clues.cluesFrom({ opener: 'birthday card' }).touches.length, 0);
assert.strictEqual(clues.cluesFrom({ opener: 'in the car' }).touches[0].id, 'radio');
assert.strictEqual(clues.cluesFrom({ scene: 'smooth texture' }).touches.length, 0);
assert.strictEqual(clues.cluesFrom({ scene: 'a text from home' }).touches[0].id, 'kitchen');
assert.deepStrictEqual(clues.dedupeTags(['big drums', 'bass', 'heavy drums']), ['bass', 'heavy drums']);
assert.deepStrictEqual(clues.dedupeTags(['piano', 'electric piano']), ['electric piano']);
assert.deepStrictEqual(clues.dedupeTags(['bass', 'bass']), ['bass']);
assert.deepStrictEqual(clues.dedupeTags(['playful', 'playful bite']), ['playful bite']);
assert.deepStrictEqual(clues.dedupeTags(['live drums', 'heavy drums']), ['live drums', 'heavy drums']);
assert.deepStrictEqual(clues.dedupeTags(['soft piano', 'electric piano']), ['soft piano', 'electric piano']);
assert.deepStrictEqual(clues.dedupeTags(['close', 'tender close vocal']), ['tender close vocal']);
assert.ok(clues.dedupePrompt('warm acoustic guitar, acoustic. Avoid: spoken intro, hard 808s, mismatched tempo').indexOf('hard 808s') !== -1);
assert.ok(clues.dedupePrompt('warm acoustic guitar, acoustic. Avoid: spoken intro, hard 808s, mismatched tempo').indexOf(', acoustic') === -1);
