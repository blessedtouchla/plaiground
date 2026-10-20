'use strict';
const assert = require('assert');
delete process.env.XAI_API_KEY;
const A = require('./arcade');
const srv = require('./arcade-server');

(async () => {
  const xmas = A.stylePrompt({ type: 'holiday', answers: { holiday: 'Christmas' } }, {});
  assert.ok(/sleigh bells/.test(xmas));
  assert.ok(!/\u2014/.test(xmas) && xmas.length <= 520);
  assert.ok(!/suno|tonegrid/i.test(JSON.stringify(A) + srv.PAGE_HTML));
  assert.strictEqual(A.explicitAllowed({ type: 'roast', explicit: 'ok', ageOk: false }), false);
  assert.strictEqual(A.explicitAllowed({ type: 'roast', explicit: 'ok', ageOk: true }), true);
  assert.strictEqual(A.explicitAllowed({ type: 'kids', explicit: 'ok', ageOk: true }), false);
  assert.ok(A.crisis('i want to die'));
  const human = await srv.ACTIONS['arcade-write']({ state: { type: 'jam', aiLevel: 'human', built: ['my line one', 'my line two'], answers: {} } });
  assert.strictEqual(human.status, 200);
  assert.ok(/my line one/.test(human.body.lyrics));
  const par = await srv.ACTIONS['arcade-write']({ state: { type: 'parody', aiLevel: 'full', answers: { song: 'Some Song', artist: 'Some Artist', newTopic: 'my landlord' } } });
  assert.strictEqual(par.status, 200);
  assert.ok(par.body.sample);
  const lines = await srv.ACTIONS['arcade-lines']({ state: { type: 'kids', aiLevel: 'assist', answers: {} }, slot: 'Chorus line 1' });
  assert.strictEqual(lines.body.lines.length, 3);
  const fix = await srv.ACTIONS['arcade-fix']({ state: {}, text: '[Verse]\nI walk the line tonight\nand you are always right\n[Chorus]\nhey hey hey', off: [] });
  assert.ok(fix.body.lyrics);
  const flip = await srv.ACTIONS['arcade-flip']({ state: { flip: { target: 'Country', vibe: 'dirty', level: 'Filthy', keep: [] } }, text: 'some lyrics here\nmore lyrics there' });
  assert.ok(flip.status === 400 || flip.body.ok === false, 'Filthy without 18+ must be refused');
  const battle = await srv.ACTIONS['arcade-battle']({ state: { type: 'roast', sub: 'battle', answers: {} }, round: 1, userBars: 'yo yo' });
  assert.ok(battle.body.bars);
  for (const k of Object.keys(srv.ACTIONS)) assert.ok(!/\u2014/.test(JSON.stringify((await srv.ACTIONS[k]({ state: { type: 'jam', answers: {} }, text: 'a b c d e f g h i j k l' })).body)));
  console.log('arcade tests passed');
})().catch((e) => { console.error(e); process.exit(1); });

// Parody angles always target the original song or artist (fair use).
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const base = A.parodyAngles('Shake It Off', 'Taylor Swift');
  assert.strictEqual(base.length, 3);
  base.forEach((t) => assert.ok(A.tiedToOriginal(t, 'Shake It Off', 'Taylor Swift'), t));
  const fixed = A.normalizeAngles({ says: 'Laundry day is the worst', how: 'Spoof the hand clap breakdown in the song', artist: 'Taylor Swift and her very public breakups' }, 'Shake It Off', 'Taylor Swift');
  assert.ok(/What it says: poke at the message of "Shake It Off"/.test(fixed[0]), 'general topic replaced');
  assert.ok(/^How it says it: Spoof the hand clap/.test(fixed[1]));
  assert.ok(/^The artist: Taylor Swift/.test(fixed[2]));
  console.log('parody angle tests passed');
})();

// Celebrity roast: research feeds the writer, explicit toggle changes the dial, guardrails stay.
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const research = { persona: 'Rapper comedian', songs: ['Ex-Boyfriend (insecurity)'], brand: ['Self-roasting nice guy'], moments: ['Big viral video'], jokes: ['His stage name'], career: ['Made a TV show'] };
  const base = { type: 'roast', sub: 'celeb', answers: { name: 'Test Star', spice: 'Spicy' }, research };
  const clean = A.songPrompt(Object.assign({}, base, { explicit: 'off', ageOk: false }));
  assert.ok(/Roast ammo/.test(clean) && /Ex-Boyfriend/.test(clean), 'ammo fed to writer');
  assert.ok(/Never invent crimes, abuse, diseases/.test(clean), 'guardrails present');
  assert.ok(/race, ethnicity, religion, sexual orientation, or disability/.test(clean));
  assert.ok(/Keep it clean: no profanity/.test(clean), 'clean dial when explicit off');
  assert.ok(/No sexual content about real named people/.test(A.baseRules(Object.assign({}, base, { explicit: 'off' }))));
  const hot = Object.assign({}, base, { explicit: 'ok', ageOk: true });
  assert.ok(/rude mode/.test(A.songPrompt(hot)) && /Genuinely raunchy/.test(A.songPrompt(hot)), 'raunchy dial when 18+ on');
  assert.ok(/No graphic sex acts/.test(A.baseRules(hot)) && /No slurs/.test(A.baseRules(hot)));
  assert.ok(!/raunchy/.test(A.baseRules(Object.assign({}, hot, { ageOk: false }))), 'needs the 18+ check');
  assert.ok(/Do not quote any lyrics/.test(A.celebResearchPrompt('Test Star')));
  console.log('celeb roast tests passed');
})();
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const out = A.scrubOutput('Line about his bar mitzvah\nLine about his cameo habit\nThe whitest boy alive', { type: 'roast', sub: 'celeb', explicit: 'off' });
  assert.ok(!/mitzvah/.test(out) && /cameo/.test(out), 'identity lines dropped from roasts');
  console.log('roast identity scrub test passed');
})();

// Style prompt dial: researched sound per artist, and each vibe reshapes it.
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const soundA = A.normalizeSound({ genre: 'Country', sub: 'Bro country', era: '2010s', bpm: 104, inst: 'banjo, pedal steel, trap hats', production: 'polished Nashville gloss', vocal: 'drawled sing-rap', key: 'major' }, ['Artist One']);
  const soundB = A.normalizeSound({ genre: 'Electronic', sub: 'Synthwave', era: '80s revival', bpm: 118, inst: 'analog arpeggios, gated drums', production: 'gated reverb, tape saturation', vocal: 'airy falsetto Artist Two', key: 'minor' }, ['Artist Two']);
  assert.ok(!/Artist Two/.test(soundB.vocal), 'names stripped from sound');
  const mk = (sound, vibe, level) => A.stylePrompt({ card: 'flip', type: 'parody', research: { sound }, answers: { song: 'Song', artist: 'Artist' }, flip: { vibe, level } }, {});
  const words = (t) => new Set(t.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const overlap = (x, y) => { const a = words(x), b = words(y); let n = 0; a.forEach((w) => { if (b.has(w)) n++; }); return n / Math.max(a.size, b.size); };
  const a1 = mk(soundA, 'sad'), b1 = mk(soundB, 'sad');
  const a2 = mk(soundA, 'hype'), a3 = mk(soundA, 'funny', 'Unhinged');
  assert.ok(overlap(a1, b1) < 0.7, 'different artists differ: ' + overlap(a1, b1));
  assert.ok(overlap(a1, a2) < 0.6 && overlap(a2, a3) < 0.6, 'different vibes differ');
  assert.ok(/banjo/.test(a1) && /synthwave|arpeggio/.test(b1), 'research drives the base');
  assert.ok(/minor key/.test(a1) && /major key/.test(a2), 'vibe moves key');
  assert.ok(Number(a1.match(/BPM (\d+)/)[1]) < Number(a2.match(/BPM (\d+)/)[1]), 'vibe moves tempo');
  console.log('style dial tests passed');
})();
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const p = A.stylePrompt({ card: 'flip', flip: { vibe: 'hype' }, answers: {} }, { genre: 'Electronic' });
  assert.ok(/syncopated/.test(p) && !/four on the floor/.test(p), 'electronic avoids four on the floor');
  assert.ok(/BPM \d+/.test(p), 'explicit BPM field');
  assert.ok(p.toLowerCase().indexOf('garage') > p.indexOf('BPM'), 'texture leads, genre tag last');
  assert.ok(!/\u2014/.test(p));
  console.log('style guide rules test passed');
})();
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const st = { type: 'parody', answers: { song: 'Loud Anthem', artist: 'Famous Person' }, vibe: 'Happy' };
  const plain = A.stylePrompt(st, {});
  const tuned = A.stylePrompt(st, { tune: { speed: 'Slow', vocals: 'Duet', gender: 'Female', tone: 'Raspy', must: ['Horns', 'Organ'], energy: 'Slow build', extra: 'like Famous Person but dusty https://x.y' } });
  assert.ok(/BPM \d+/.test(plain) && !/BPM/.test(tuned) && /slow tempo/.test(tuned), 'speed words replace BPM');
  assert.ok(/raspy female voice/.test(tuned) && /duet/.test(tuned) && /must have horns, organ/.test(tuned) && /slow build/.test(tuned));
  assert.ok(!/Famous|https/.test(tuned) && /dusty/.test(tuned), 'anything else is sanitized');
  const withBpm = A.stylePrompt(st, { tune: { speed: 'Fast', bpm: '92' } });
  assert.ok(/92 bpm/.test(withBpm) && !/fast tempo/.test(withBpm), 'typed BPM wins');
  const huge = A.stylePrompt(st, { tune: { must: A.TUNE.must, extra: 'x'.repeat(500), energy: 'Big drop', vocals: 'Choir' } });
  assert.ok(huge.length <= 520 && /choir/.test(huge) && /big drop/.test(huge), 'cap holds and keeps tune');
  console.log('fine-tune tests passed');
})();
// Every mode: vibe chips and Fine-tune picks change the style prompt.
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const modes = [];
  A.TYPES.forEach((t) => { if (t.sub) t.sub.forEach((sub) => modes.push({ type: t.id, sub })); else modes.push({ type: t.id, sub: '' }); });
  modes.forEach((m) => {
    ['Mild', 'Spicy'].forEach((spice) => {
      const base = { type: m.type, sub: m.sub, answers: { spice, holiday: 'Halloween', name: 'Test Name' } };
      const p = ['Happy', 'Sad', 'Hype'].map((vibe) => A.stylePrompt(Object.assign({}, base, { vibe }), {}));
      assert.ok(new Set(p).size === 3, 'vibes differ for ' + m.type + '/' + m.sub + '/' + spice);
      const tuned = A.stylePrompt(Object.assign({}, base, { vibe: 'Happy' }), { tune: { speed: 'Fast', vocals: 'Choir' } });
      assert.ok(tuned !== p[0] && /fast tempo/.test(tuned) && /choir/.test(tuned), 'fine-tune changes ' + m.type + '/' + m.sub);
    });
  });
  console.log('every mode vibe + fine-tune tests passed (' + modes.length + ' modes)');
})();
// Next line: rhyme, continue, twist; never repeat the song.
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const prev = 'Halloween night at the Sphere in Vegas';
  const s = { type: 'holiday', answers: { holiday: 'Halloween', who: 'My partner' }, built: [prev] };
  const out = A.sampleNextLines(s, 'chorus');
  assert.strictEqual(out.length, 3);
  assert.ok(out.every((l) => !A.nearDuplicate(l, prev)), 'no repeat of line 1');
  assert.ok(/(stages|faces|places)$/.test(out[0]), 'option 1 rhymes with Vegas: ' + out[0]);
  // AI output that repeats line 1 gets replaced.
  const fixed = A.finishNextLines(A.parseNextLines('RHYME: ' + prev + '\nCONTINUE: The crowd went wild in costumes and paint\nTWIST: The Sphere turned into a giant pumpkin'), s, 'chorus');
  assert.ok(fixed.length === 3 && fixed.every((l) => !A.nearDuplicate(l, prev)));
  assert.ok(fixed.includes('The Sphere turned into a giant pumpkin'));
  // Use my line also feeds the next suggestions, every mode.
  A.TYPES.forEach((t) => {
    const b = ['I wrote this one myself about the night', 'We sang it loud beneath the city light'];
    const o = A.sampleNextLines({ type: t.id, sub: t.sub ? t.sub[0] : '', answers: { name: 'Test Name' }, built: b }, 'verse');
    assert.strictEqual(o.length, 3, t.id);
    assert.ok(o.every((l) => b.every((x) => !A.nearDuplicate(l, x))), t.id);
    assert.ok(Math.abs(A.lineSyllables(o[0]) - A.lineSyllables(b[1])) <= 5, t.id + ' syllables');
    assert.ok(/night|light|bright|sight|flight|fright|kite|height|fight|moonlight|white|bite/.test(o[0].split(' ').pop()), t.id + ' rhyme ' + o[0]);
    assert.ok(/Previous line: "We sang it loud/.test(A.nextLinePrompt({ type: t.id, answers: {}, built: b }, 'verse')));
  });
  console.log('next line tests passed');
})();
// Vibes swap texture first, and a full chorus + verse never recycles a line.
(async function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const heads = A.VIBES.map((v) => A.stylePrompt({ type: 'holiday', vibe: v, answers: { holiday: 'Christmas' } }, {}).slice(0, 30));
  assert.strictEqual(new Set(heads).size, A.VIBES.length, 'each vibe leads with its own texture');
  const saved = process.env.XAI_API_KEY; delete process.env.XAI_API_KEY;
  const AS = require('./arcade-server.js');
  for (const [type, sub] of [['tribute', 'celeb'], ['holiday', ''], ['roast', 'friend'], ['jam', ''], ['kids', '']]) {
    const built = [];
    for (let i = 0; i < 8; i++) {
      const r = await AS.ACTIONS['arcade-lines']({ state: { type, sub, vibe: 'Happy', answers: { name: 'Jack Nicholson', holiday: 'Halloween' }, built: built.slice(), aiLevel: 'assist' }, slot: i < 4 ? 'chorus' : 'verse' });
      const lines = r.body.lines;
      assert.strictEqual(lines.length, 3, type + ' slot ' + i);
      lines.forEach((l) => assert.ok(built.every((b) => !A.nearDuplicate(l, b)), type + ' recycled: ' + l));
      built.push(i === 2 ? 'My own line about the silver screen' : lines[i % 3]);
    }
  }
  if (saved) process.env.XAI_API_KEY = saved;
  console.log('full song no-repeat tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
// Couplets: two fresh lines when 2+ lines remain, single when 1 left.
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const s = { type: 'holiday', answers: { holiday: 'Halloween' }, built: ['Halloween night at the Sphere in Vegas'] };
  const c = A.finishNextLines(['A / B'.replace('A', 'The moon hangs low above the neon stages').replace('B', 'our costumes glowing like a hundred faces')], s, 'chorus', 3);
  assert.ok(c.length === 3 && c.every((x) => x.split(' / ').length === 2), JSON.stringify(c));
  const flat = c.join(' / ').split(' / ');
  assert.strictEqual(A.dedupeLines(flat, s.built).length, flat.length, 'couplet lines all fresh');
  const one = A.finishNextLines([], { type: 'jam', answers: {}, built: ['a', 'b', 'c'].map((x) => 'line ' + x + ' about the light') }, 'chorus', 1);
  assert.ok(one.length === 3 && one.every((x) => !/ \/ /.test(x)));
  console.log('couplet tests passed');
})();
// Idea chips: real-fact rules for people and songs, picked ideas reach line and song prompts.
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const t = { type: 'tribute', sub: 'celeb', answers: { name: 'Jack Nicholson' } };
  assert.ok(/REAL, well-known, verifiable/.test(A.ideasPrompt(t)) && /\(unsure\)/.test(A.ideasPrompt(t)));
  assert.ok(/Roast safety/.test(A.ideasPrompt({ type: 'roast', sub: 'celeb', answers: { name: 'Jack Nicholson' } })));
  assert.ok(A.sampleIdeas(t).length >= 6 && A.sampleIdeas({ type: 'jam', answers: {} }).length >= 6);
  const withIdeas = Object.assign({}, t, { ideas: ['The Shining axe scene'], built: ['My own line stays'] });
  assert.ok(/The Shining axe scene/.test(A.nextLinePrompt(withIdeas, 'chorus', 3)) && /word for word/.test(A.songPrompt(withIdeas)));
  assert.deepStrictEqual(A.parseIdeas('1. One idea\n- Two idea\nOne idea', t), ['One idea', 'Two idea']);
  console.log('idea chip tests passed');
})();
// Change topic keeps the user's own lines verbatim and never repeats the song.
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const s = { type: 'tribute', sub: 'celeb', answers: { name: 'Jack Nicholson' } };
  const song = '[Chorus]\nThat grin could light a city block\nMy own line about the silver screen\nHe owns the night\nWe sing it loud\n[Verse]\nCourtside seats and shades on tight';
  const sec = 'That grin could light a city block\nMy own line about the silver screen\nHe owns the night\nWe sing it loud';
  const out = A.finishSection('Line one about the moon\nLine two about the tide\nCourtside seats and shades on tight\nLine four', s, sec, ['My own line about the silver screen'], song);
  assert.strictEqual(out.length, 4);
  assert.strictEqual(out[1], 'My own line about the silver screen');
  assert.ok(!out.includes('Courtside seats and shades on tight'));
  assert.ok(/new idea: The Shining/.test(A.sectionPrompt(s, sec, 'The Shining', [], song)));
  console.log('change topic tests passed');
})();
