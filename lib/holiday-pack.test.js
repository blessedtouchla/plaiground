'use strict';
const assert = require('assert');
const q = require('./song-questions.js');
const m = require('./song-modes.js');

assert.ok(q.KINDS.some((k) => k.id === 'holiday'));
assert.deepStrictEqual(q.HOLIDAY_STARTERS.map((s) => s.id), ['missing', 'pictures', 'twolang']);
['missing', 'pictures', 'twolang'].forEach((id) => {
  const s = q.open({ kind: 'holiday', starter: id, mode: 'write' });
  assert.strictEqual(s.starter, id);
  const v = q.view(s);
  assert.ok(v.ask && !v.done, id);
  const blanks = q.madlibs('holiday', id);
  assert.strictEqual(blanks.length, 4);
  const sm = q.open({ kind: 'holiday', starter: id, mode: 'madlibs' });
  assert.ok(q.view(sm).madlib);
});
assert.ok(/kid/.test(q.view(q.open({ kind: 'holiday', starter: 'missing' })).ask));
assert.ok(/language/i.test(q.view(q.open({ kind: 'holiday', starter: 'twolang' })).ask));

// Copy rules
const copy = JSON.stringify(q.HOLIDAY_STARTERS) + JSON.stringify(m.FEELING_FAMILIES);
assert.ok(!/\u2014/.test(copy), 'no em dashes');
assert.ok(!/suno|tonegrid/i.test(copy));

// Two-tap feelings
m.FEELING_FAMILIES.forEach((fam) => fam.precise.forEach((id) => assert.ok(m.feelingById(id), id)));
assert.deepStrictEqual(m.feelingFamily('sad').precise.slice(0, 3), ['homesick', 'lonely', 'bittersweet']);
const input = m.normalizeInput ? m.normalizeInput({ mode: 'write', feelings: ['homesick', 'cozy'], starter: 'pictures' }) : null;
if (input) {
  assert.deepStrictEqual(input.feelings, ['homesick', 'cozy']);
  assert.strictEqual(input.starter, 'pictures');
  const sys = m.systemPrompt(input);
  assert.ok(/Homesick, Cozy/.test(sys));
  assert.ok(/Four pictures/.test(sys));
  assert.ok(/"starter":"pictures"/.test(m.userPrompt(input)));
  assert.strictEqual(m.normalizeInput({ mode: 'write', starter: 'bogus' }).starter, '');
}
console.log('holiday-pack ok', input ? '(prompt checked)' : '');
