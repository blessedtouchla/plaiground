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
// Shape the voice: compact, early, varied by default, Surprise fills rows.
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const base = { type: 'jam', vibe: 'Happy', answers: { topic: 'summer' } };
  const full = { gender: 'Female', voiceShape: { range: 'Soprano', texture: 'Raspy', delivery: 'Belted', age: 'Mature weathered', flavor: 'Southern drawl', emotion: 'Fierce', effects: 'Doubled', arrangement: 'Choir' } };
  const d = A.voiceDescriptor(base, full);
  assert.ok(d.length <= 60 && /^raspy soprano female voice/.test(d), d);
  const p = A.stylePrompt(base, { tune: full });
  assert.ok(p.indexOf('raspy soprano female voice') > -1 && p.indexOf('raspy soprano female voice') < 120 && p.length <= 520, p);
  const s1 = A.voiceDescriptor(base, { gender: 'Surprise me', surprise: 12345 }), s2 = A.voiceDescriptor(base, { gender: 'Surprise me', surprise: 98765 });
  assert.ok(s1 !== s2 && s1.length <= 60 && s1.split(',').length >= 3, s1 + ' | ' + s2);
  const defaults = new Set(['Happy', 'Sad', 'Hype', 'Dark', 'Love'].map((v) => A.voiceDescriptor(Object.assign({}, base, { vibe: v }), {})));
  assert.ok(defaults.size === 5, 'default voice varies by vibe');
  const t1 = A.voiceDescriptor(Object.assign({}, base, { title: 'One' }), {}), t2 = A.voiceDescriptor(Object.assign({}, base, { title: 'Two two' }), {}), t3 = A.voiceDescriptor(Object.assign({}, base, { title: 'Three' }), {});
  assert.ok(new Set([t1, t2, t3]).size >= 2, 'default voice varies by seed');
  A.TYPES.forEach((t) => { const q = A.stylePrompt({ type: t.id, sub: t.sub ? t.sub[0] : '', vibe: 'Sad', answers: {} }, { tune: { gender: 'Male', voiceShape: { delivery: 'Rapped' } } }); assert.ok(/male voice, rapped/.test(q), t.id); });
  console.log('shape the voice tests passed');
})();
(function () {
  const assert = require('assert'); const A = require('./arcade.js');
  A.TYPES.forEach((t) => A.VIBES.forEach((v) => ['', 'x', 'long title here'].forEach((title) => { const p = A.stylePrompt({ type: t.id, sub: t.sub ? t.sub[0] : '', vibe: v, title, answers: { name: 'Lil Dicky', spice: 'Spicy' } }, {}); assert.ok(!/undefined/.test(p) && p.length <= 520, t.id + v + p); })));
  console.log('no undefined in prompts test passed');
})();
// Give me ideas: doors, safety rules, facts tied to real feed items.
(function () {
  const assert = require('assert'); const A = require('./arcade.js');
  assert.deepStrictEqual(A.IDEA_DOORS.map((d) => d.tiles.length), [4, 8]);
  assert.ok(A.ideaTile('expose') && A.ideaTile('expose').door === 'news');
  const st = [{ title: 'Town rallies to rebuild flooded library', source: 'Local News', date: '2026-10-19', link: 'https://example.com/a' }, { title: 'City council split on new curfew', source: 'Daily', date: '2026-10-18', link: 'https://example.com/b' }];
  const p = A.newsIdeasPrompt(A.ideaTile('expose'), st);
  assert.ok(/Verified facts only/.test(p) && /never stated as fact/.test(p) && /not on record/.test(p) && /no minors as targets/.test(p) && /partisan/.test(p));
  assert.ok(/both sides/i.test(A.newsIdeasPrompt(A.ideaTile('debate'), st)));
  const out = A.parseNewsIdeas('[{"i":0,"angle":"Pages drying \u2014 in the sun","story":"Town rallies to rebuild flooded library","sides":[]},{"i":7,"angle":"x","story":"y"},{"i":1,"angle":"Clock tower holds its breath","story":"City council split","sides":[]}]', st, A.ideaTile('debate'));
  assert.strictEqual(out.length, 0, 'debate tile needs both sides');
  const o2 = A.parseNewsIdeas('[{"i":0,"angle":"Pages drying \u2014 in the sun","story":"Town rallies to rebuild flooded library"},{"i":9,"angle":"fake","story":"fake"}]', st, A.ideaTile('home'));
  assert.ok(o2.length === 1 && o2[0].link === 'https://example.com/a' && !/\u2014/.test(o2[0].angle), 'links come from the feed, invented indexes dropped');
  assert.ok(/No fresh stories/.test(A.NO_STORIES));
  console.log('give me ideas tests passed');
})();

// Too wordy: only deletes the writer's words, never drops a line, keeps rhyme words.
(function () {
  const T = "I live with no regret i never stay upset truly humble to the neck when I represent\n\nI know the worlds a mess but I don't gotta stress because when life gets hard and the real shit starts I remember that it's just a test";
  const lines = A.localLines(T);
  const items = A.alignDraft(T, lines, true);
  assert.strictEqual(A.countWords(A.draftText(items)), A.countWords(T), 'cleanup keeps every word');
  assert.ok(/real shit starts/.test(A.draftText(items)), 'explicit line from the writer is not dropped');
  // A model draft that drops a line and invents a word: the invented word never shows, the dropped words come back.
  const bad = A.alignDraft(T, '[Verse 1]\nI live with no regret\nnever stay upset brand new words\n[Verse 2]\nI remember that it is just a test', true);
  const txt = A.draftText(bad);
  assert.ok(!/brand|new words/.test(txt) && /real shit starts/.test(txt), 'alignment uses only original words');
  const cutItems = A.alignDraft(T, lines, true);
  A.applyCutList(cutItems, A.parseCutList('2: truly\n2: never\n5: gotta\n9: test\n9: just'), 10);
  const out = A.draftText(cutItems);
  assert.ok(!/truly/.test(out) && /never/.test(out) && /test$/.test(out), 'cuts filler, keeps negations and last word');
  const undone = {}; cutItems.forEach((it, i) => { if (it.words) undone[i] = true; });
  assert.strictEqual(A.countWords(A.draftText(cutItems, undone)), A.countWords(T), 'undo per line restores every word');
  assert.ok(/About 40%/.test(A.TRIM_LEVELS[2].small) && /keep|delete/i.test(A.trimPrompt(lines, 'bone')));
  // Tighten and Cut to the bone: per-line rewrite, checked in code, delete-only fallback per line.
  assert.ok(!A.isRewriteLevel('little') && A.isRewriteLevel('tighten') && A.isRewriteLevel('bone'));
  assert.strictEqual(A.checkRewrite('I live with no regret i never stay upset', 'Live with no regret, never stay upset', 6), '');
  assert.strictEqual(A.checkRewrite('I live with no regret i never stay upset', 'I live with no regret i never stay mad', 6), 'rhyme word changed');
  assert.strictEqual(A.checkRewrite('Because when life gets hard and the real shit starts', 'When life gets hard and real trouble starts', 7), 'dropped explicit word');
  assert.strictEqual(A.checkRewrite('You will never find me hanging out I dont even call', 'Find me hanging out I dont even call', 7), 'meaning flipped');
  assert.strictEqual(A.checkRewrite('I keep my circle small', 'Dragons wizards circle small', 3), 'too many new words');
  const D2 = '[Verse 1]\nI live with no regret i never stay upset\ntruly humble to the neck when I represent\nit\'s like some medicine I know it\'s evident\nthat I\'m heavin sent so I gotta hold it down\nfor the regiment cause I\'m comparative\n[Chorus]\nI keep my circle small and these feelings tall\nYou\'ll never find me hanging out I dont even call\n[Verse 2]\nI know the worlds a mess but I don\'t gotta stress\nbecause when life gets hard and the real shit starts\nI remember that it\'s just a test';
  const rw = A.alignDraft(T, D2, true), fb = A.alignDraft(T, D2, true);
  A.applyCutList(fb, A.parseCutList('2: truly'), 1);
  const tg = A.lineTargets(rw, 25);
  const pool = A.parseRewrites('1a: I live with no regret never stay upset\n1b: Live with no regret, never stay upset\n2a: brand new line about nothing');
  assert.strictEqual(pool[1].length, 2);
  const chosen = A.chooseRewrites(A.alignDraft(T, D2, true), pool, tg, 1);
  assert.strictEqual(chosen[1], 'Live with no regret, never stay upset', 'picks the shorter passing version when over goal');
  const rep = A.applyRewrites(rw, fb, chosen, tg);
  const rtxt = A.draftText(rw);
  assert.strictEqual(rtxt.split('\n').filter((l) => l && !/^\[/.test(l)).length, A.draftText(fb).split('\n').filter((l) => l && !/^\[/.test(l)).length, 'line count unchanged');
  assert.ok(/^Live with no regret, never stay upset$/m.test(rtxt) && !/brand new/.test(rtxt), 'passing rewrite used, failing line falls back');
  assert.ok(rep[1] && !rep[1].ok && /^Humble to the neck/m.test(rtxt), 'fallback uses the delete-only cut');
  const allUndone = {}; rw.forEach((it, i) => { if (it.words) allUndone[i] = true; });
  assert.strictEqual(A.countWords(A.draftText(rw, allUndone)), A.countWords(T), 'undo per line brings back the original line');
  assert.ok(A.checkSong(rw, 88, 25).rhymes, 'every rhyme word kept');
  assert.deepStrictEqual(A.dropJudged({ 1: ['a', 'b'] }, '1b'), { 1: ['a'] });
  assert.ok(!/[\u2014\u2013]/.test(A.rewritePrompt(rw, 'bone', tg)), 'no dashes in prompt');
  // Writer's spellings and slang stay.
  assert.strictEqual(A.checkRewrite("that I'm heavin sent so I gotta hold it down", "I'm heaven sent so I hold it down", 6), 'spelling changed');
  assert.strictEqual(A.checkRewrite("that I'm heavin sent so I gotta hold it down", "I'm heavin sent so I hold it down", 6), '');
  assert.ok(A.nearSpelling('heavin', 'heaven') && !A.nearSpelling('hold', 'hold') && !A.nearSpelling('small', 'tall'));
  // Section tags match the original: paragraphs become Verse 1, Verse 2 every time, whatever the model tagged.
  const tagged1 = A.draftText(A.fixTags(T, A.alignDraft(T, D2, true)));
  const tagged2 = A.draftText(A.fixTags(T, A.alignDraft(T, D2.replace('[Chorus]', '[Bridge]').replace('[Verse 2]', '[Hook]'), true)));
  assert.strictEqual(tagged1, tagged2, 'same tags no matter what the model called them');
  assert.deepStrictEqual(tagged1.split('\n').filter((l) => /^\[/.test(l)), ['[Verse 1]', '[Verse 2]']);
  assert.strictEqual(A.countWords(tagged1), A.countWords(T));
  const own = '[Intro]\nyeah yeah we here now\n[Hook]\nI keep my circle small and these feelings tall';
  const ownTags = A.draftText(A.fixTags(own, A.alignDraft(own, '[Verse 1]\nyeah yeah we here now I keep my circle small\nand these feelings tall', true)));
  assert.deepStrictEqual(ownTags.split('\n').filter((l) => /^\[/.test(l)), ['[Intro]', '[Hook]'], 'writer tags kept, line split at the tag');
  assert.ok(/^I keep my circle small/m.test(ownTags));
  console.log('too wordy tests passed');
})();

// Fix My Song bug fixes: line rewrites, chip focus, cleanup chorus tags.
(function () {
  const song = '[Verse 1]\nI woke up early in the morning light\nGot my coffee and I felt alright\nCarrying my heavy load\n\n[Chorus]\nOh oh life is good\nLiving like I knew I would\n\n[Verse 2]\nMy boss came in and he was mad today\nAnd that was that';
  const echo = '[Verse 1]\nI woke up early in the morning light\nGot my coffee and I felt alright\nShouldering burdens down the road\nBearing the weight that I have known';
  assert.deepStrictEqual(A.parseLineOptions(echo, song, 'Carrying my heavy load'), ['Shouldering burdens down the road', 'Bearing the weight that I have known'], 'song lines echoed back are never options');
  assert.deepStrictEqual(A.parseLineOptions('Sure:\n1. Hauling my heavy load\n2. Oh oh life is good\n3. Lifting all my weight', song, 'Carrying my heavy load'), ['Hauling my heavy load', 'Lifting all my weight']);
  assert.ok(/Rewrite ONE lyric line/.test(A.fixPrompt(song, [], 'Carrying my heavy load')));
  assert.deepStrictEqual(A.focusLines(song, 'Chorus is weak'), ['Oh oh life is good', 'Living like I knew I would']);
  assert.deepStrictEqual(A.focusLines(song, 'Ending falls flat'), ['My boss came in and he was mad today', 'And that was that']);
  const fixed = song.replace('Oh oh life is good', 'NEW HOOK').replace('Got my coffee', 'CHANGED');
  const kept = A.keepUntouched(song, fixed, ['Chorus is weak']);
  assert.ok(/NEW HOOK/.test(kept) && /Got my coffee/.test(kept) && !/CHANGED/.test(kept), 'chorus chip only changes the chorus');
  assert.strictEqual(A.keepUntouched(song, fixed, ['Rhymes feel forced']), fixed, 'whole-song chips keep the full fix');
  assert.ok(/chorus/i.test(A.fixPrompt(song, ['Chorus is weak'], '')));
  const flat = 'walking down this road so long tonight\nthinking of the things we used to say\nBaby baby you know I need you here\nEvery night and day I wish you near\ndriving past the corner where we met\nBaby baby you know I need you here\nEvery night and day I wish you near';
  assert.deepStrictEqual(A.originalSections(flat).map((x) => x.tag), ['[Verse 1]', '[Chorus]', '[Verse 2]', '[Chorus]'], 'repeated lines become [Chorus] even with no blank lines');
  assert.deepStrictEqual(A.originalSections('a b c\n\nd e f\n\na b c').map((x) => x.tag), ['[Chorus]', '[Verse 1]', '[Chorus]']);
  console.log('fix my song bug tests passed');
})();

// Chorus chips on untagged lyrics, and chorus fixes keep line count and every copy.
{
  const A2 = require('./arcade');
  const assert2 = require('assert');
  const raw = 'I walk the block at night\nNobody sees me shine\nLift me up lift me higher\nSet the whole sky on fire\nWe never coming down\nWe own this little town\nMy mama said keep going\nThe river keeps on flowing\nLift me up lift me higher\nSet the whole sky on fire\nWe never coming down\nWe own this little town';
  const p = A2.prepSections(raw, ['Chorus is weak']);
  assert2.strictEqual(p.note, '');
  assert2.strictEqual(A2.chorusLines(p.text).length, 4, 'untagged chorus found');
  assert2.ok(A2.focusLines(p.text, 'Chorus is weak').length === 4, 'chorus lights up');
  assert2.strictEqual(A2.prepSections('one line here\nanother line', ['Chorus is weak']).note, A2.NO_CHORUS);
  const sw = A2.swapChorus(p.text, '1. A\n2. B\n3. C\n4. D');
  assert2.strictEqual((sw.match(/^A$/mg) || []).length, 2, 'every chorus copy replaced');
  assert2.strictEqual(A2.chorusLines(sw).length, 4, 'same line count');
  assert2.strictEqual(A2.swapChorus(p.text, '1. A\n2. B\n3. C'), null, 'short answer rejected');
  assert2.strictEqual(A2.autoSections('[Verse 1]\na\n[Chorus]\nb'), '[Verse 1]\na\n[Chorus]\nb', 'tagged left alone');
  console.log('chorus untagged tests passed');
}
