'use strict';
const assert = require('assert');
delete process.env.XAI_API_KEY;
const M = require('./modernize');
const modes = require('./song-modes');
const srv = require('./arcade-server');

// Reuses the Song Helper counter, not a new one.
assert.strictEqual(M.syllables('There is a house in New Orleans'), modes.lineRuler('There is a house in New Orleans').count);
assert.strictEqual(modes.countSyllables('cat'), 1);
assert.strictEqual(M.syllables('golden river'), 4);
assert.strictEqual(M.syllables(''), 0);
// Hiatus words count as sung.
const exact = { player: 2, layer: 2, mayor: 2, buyer: 2, flyer: 2, poem: 2, create: 2, idea: 3, table: 2, called: 1, wanted: 2, houses: 2, times: 1, going: 2, team: 1, nation: 2, rounder: 2, baltimore: 3 };
Object.keys(exact).forEach((w) => { assert.strictEqual(modes.countSyllables(w), exact[w], w); assert.deepStrictEqual(modes.syllableRange(w), [exact[w], exact[w]], w + ' fixed'); });
assert.strictEqual(modes.countSyllables('lion'), 2);
// Sung as 1 or 2 depending on the singer.
['prayer', 'fire', 'hour', 'flower', 'power', 'tire', 'our', 'lion'].forEach((w) => assert.deepStrictEqual(modes.syllableRange(w), [1, 2], w + ' flexible'));
const ruler = modes.lineRuler('the fire in our hearts');
assert.ok(ruler.count === 5 && ruler.min === 5 && ruler.max === 7 && ruler.pattern && ruler.note, 'classic ruler still works');
// A flexible word passes either way; a real mismatch still flags.
assert.strictEqual(M.pairLines(['light the fire tonight'], ['light the flower tonight'], {}, 'medium')[0].off, false);
assert.strictEqual(M.pairLines(['let a rounder lead me astray'], ['let a player lead me astray'], {}, 'light')[0].off, false);
assert.strictEqual(M.pairLines(['I walk the line tonight'], ['I walk the long line tonight'], {}, 'medium')[0].off, true);
assert.strictEqual(M.rangeLabel([3, 4]), '3-4');

// 1925 text, Robert Winslow Gordon, "Old Songs That Men Have Sung", Adventure magazine (published in the US in 1925, public domain).
const SRC = [
  "There is a house in New Orleans, it's called the Rising Sun",
  "It's been the ruin of many a poor girl, Great God, and I for one",
  "If I had listened to what my mother said, I'd be at home today",
  "But I was a young and foolish poor girl, let a rounder lead me astray",
  "Now tell my sister in Baltimore not to do as I have done",
  "To shun that house in New Orleans, it's called the Rising Sun",
].join('\n');
const lines = M.sourceLines('[Verse]\n' + SRC + '\n');
assert.strictEqual(lines.length, 6);
const hooks = M.hookLines(SRC, 'The Rising Sun', []);
assert.ok(hooks[lines[0].toLowerCase()] && hooks[lines[5].toLowerCase()], 'title lines are the hook');
assert.ok(!hooks[lines[2].toLowerCase()]);

// A Light, "As a woman today" rewrite (hand written for the test).
const NEW = [
  'There is a club in New Orleans, they call it the Glow', // hook: must be reset to original
  "It's been the ruin of many a smart girl, Great God, and I for one",
  "If I had listened to what my mother said, I'd be at work today",
  'But I was a young and swiping poor girl, let a rounder lead me astray',
  'Now text my sister in Baltimore not to do as I have done',
  'gone',
];
const pairs = M.pairLines(lines, NEW, hooks, 'light');
assert.strictEqual(pairs[0].line, lines[0]);
assert.ok(pairs[0].hook && !pairs[0].off);
assert.strictEqual(pairs[1].diff.changedWords, 1);
assert.deepStrictEqual(pairs[1].diff.tokens.filter((t) => t.changed).map((t) => t.w), ['smart']);
assert.strictEqual(pairs[1].off, false);
assert.strictEqual(pairs[5].line, lines[5]);
assert.strictEqual(pairs[3].diff.changedWords, 1);
assert.strictEqual(pairs[4].diff.tokens.filter((t) => t.changed)[0].w, 'text');
const sum = M.summary(pairs);
assert.ok(sum.hookKept);
assert.ok(sum.pct > 0 && sum.pct < 15, 'light keeps most words: ' + sum.pct);
assert.ok(/^\d+% of original words changed, hook kept$/.test(sum.note));
// Count mismatch is flagged.
const bad = M.pairLines(['I walk the line tonight'], ['I walk'], {}, 'light')[0];
assert.ok(bad.off && bad.tooMuch);
assert.strictEqual(M.strength('nope').id, 'light');
assert.deepStrictEqual(M.parseNumbered('1. a b\n2) c d', 2), ['a b', 'c d']);
assert.ok(/As a woman today/.test(M.prompt(lines, M.perspectiveText('woman'), hooks, 'light')));
assert.ok(!/suno|tonegrid|\u2014/i.test(JSON.stringify(M) + M.RULES + M.PD_NOTE));

(async () => {
  const no = await srv.ACTIONS['arcade-modernize']({ text: SRC, perspective: 'woman' });
  assert.strictEqual(no.status, 400);
  const yes = await srv.ACTIONS['arcade-modernize']({ text: SRC, perspective: 'woman', pdConfirmed: true, title: 'The Rising Sun' });
  assert.strictEqual(yes.status, 200);
  assert.strictEqual(yes.body.pairs.length, 6);
  assert.strictEqual(yes.body.strength, 'light');
  assert.strictEqual(yes.body.perspective, 'As a woman today');
  const hookRetry = await srv.ACTIONS['arcade-modernize-line']({ text: SRC, pdConfirmed: true, title: 'The Rising Sun', index: 0 });
  assert.strictEqual(hookRetry.status, 400);
  console.log('modernize tests passed. Light example: ' + sum.note);
})().catch((e) => { console.error(e); process.exit(1); });
