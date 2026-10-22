'use strict';
const assert = require('assert');
const SM = require('./slang-mode.js');
const A = require('./arcade.js');
const data = require('../data/slang.json');
const bay = data.entries.filter((e) => e.region_tag === 'Bay Area');
assert.ok(bay.length >= 5, 'bay entries');
bay.forEach((e) => {
  assert.ok(Array.isArray(e.sources) && e.sources.length && e.sources.every((u) => /^https:\/\//.test(u)), e.word + ' needs a source');
  assert.ok(e.define && e.example, e.word + ' needs define + example');
  assert.ok(!/\u2014|\u2013/.test(e.define + e.example + e.meaning), 'no em dashes');
});
assert.ok(!data.entries.some((e) => /ghost ?rid/i.test(e.word)), 'ghost ride skipped');
assert.ok(bay.find((e) => e.word === 'thizz').explicit === true, 'thizz flagged explicit');
assert.strictEqual(data.count, data.entries.length);

const m = SM.matcher(data.entries, 'Bay Area');
const parts = SM.findTerms('We went dumb on the turf, hella hyphy tonight', m);
assert.deepStrictEqual(parts.filter((p) => p.entry).map((p) => p.text), ['went dumb', 'turf', 'hella', 'hyphy']);
assert.strictEqual(parts.map((p) => p.text).join(''), 'We went dumb on the turf, hella hyphy tonight', 'text round-trips');
assert.strictEqual(SM.findTerms('hellacious shellac', m).filter((p) => p.entry).length, 0, 'whole words only');
assert.strictEqual(SM.findTerms('Thizzin all night', m)[0].entry.word, 'thizz');
const pop = SM.popover(bay.find((e) => e.word === 'hella'));
assert.ok(pop.define.length < 140 && pop.example, 'short popover');

const st = { card: 'flip', flip: { slang: 'bay', target: 'Hip hop' }, answers: {} };
const fp = A.flipPrompt('[Verse]\nline', st);
assert.ok(/Hyphy mode/.test(fp) && /hella/.test(fp) && !/thizz/i.test(fp), 'clean mode skips drug words');
const ex = A.flipPrompt('[Verse]\nline', Object.assign({}, st, { explicit: 'ok', ageOk: true, flip: { slang: 'bay', vibe: 'dirty', level: 'Spicy' } }));
assert.ok(/thizz/.test(ex), 'explicit mode may use thizz');
assert.ok(!/thizz/i.test(A.scrubOutput('[Verse]\nall thizzin tonight\nhella good', st)), 'thizz removed when not explicit');
assert.ok(!/hyphy|hella/i.test(A.stylePrompt(st, { genre: 'Hip hop' })), 'slang never in the style prompt');
assert.ok(!/who asked/.test(A.sampleFlip('[Verse]\nline one here', st)), 'bay sample');
console.log('slang mode tests passed');
