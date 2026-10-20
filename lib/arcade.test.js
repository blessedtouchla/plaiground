'use strict';
const assert = require('assert');
delete process.env.XAI_API_KEY;
const A = require('./arcade');
const srv = require('./arcade-server');

(async () => {
  const xmas = A.stylePrompt({ type: 'holiday', answers: { holiday: 'Christmas' } }, {});
  assert.ok(/sleigh bells/.test(xmas));
  assert.ok(!/\u2014/.test(xmas) && xmas.length <= 200);
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
  assert.ok(Number(a1.match(/(\d+) BPM/)[1]) < Number(a2.match(/(\d+) BPM/)[1]), 'vibe moves tempo');
  console.log('style dial tests passed');
})();
