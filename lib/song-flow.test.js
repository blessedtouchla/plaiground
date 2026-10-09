'use strict';

const assert = require('assert');
const flow = require('./song-flow');

assert.strictEqual(flow.FOR_OPTIONS.length, 3);
assert.strictEqual(flow.AIM_OPTIONS.length, 11);
assert.ok(flow.AIM_OPTIONS.some(function (row) { return row.label === 'Get revenge/clap back'; }));
assert.ok(flow.AIM_OPTIONS.some(function (row) { return row.id === 'other'; }));

const empty = flow.blank();
assert.strictEqual(flow.readyForDraft(empty), false);
assert.strictEqual(flow.nextStep(empty).id, 'for');
assert.strictEqual(flow.promptText(empty), '');

const started = flow.clean({
  forId: 'someone',
  forText: 'my sister',
  aims: ['heal', 'confess', 'nope'],
  kinds: ['heartbreak', 'nostalgic', 'hype'],
});
assert.deepStrictEqual(started.aims, ['heal', 'confess']);
assert.deepStrictEqual(started.kinds, ['heartbreak', 'nostalgic']);
assert.strictEqual(flow.readyForDraft(started), true);
assert.strictEqual(flow.nextStep(started).id, 'open');
assert.deepStrictEqual(flow.steps(empty).map(function (step) { return step.id; }), ['for', 'aim', 'open', 'scene', 'wisdom', 'reveal', 'keep']);
assert.strictEqual(flow.steps(started).filter(function (step) { return step.id === 'reveal'; })[0].recommended, true);
assert.strictEqual(flow.steps({ forId: 'everyone', aims: ['heal'] }).filter(function (step) { return step.id === 'reveal'; })[0].recommended, false);
assert.strictEqual(flow.sceneBoxes(['love', 'hype']).length, 3);
flow.AIM_OPTIONS.forEach(function (row) {
  assert.ok(flow.OPENERS[row.id], row.id);
});
assert.strictEqual(flow.blank().keep, '');

const heart = flow.sensorySteps(['heartbreak']);
assert.strictEqual(heart[0].ask, 'Tell me about a good day with them, before it broke.');
const grateful = flow.sensorySteps(['grateful']);
assert.ok(grateful[0].ask.indexOf('showed up') !== -1);
assert.notStrictEqual(heart[0].ask, grateful[0].ask);

const full = flow.clean({
  forId: 'myself',
  forText: 'me, out loud',
  aims: ['cry', 'other'],
  aimOther: 'tell the truth',
  opener: 'The porch was still warm.',
  wisdom: 'Leaving can still be love.',
  keep: 'Stay.',
  reveals: { never: 'I kept the key.', scared: 'I wanted them to stay.', nobody: 'The quiet was the cruel part.' },
  sensory: { who: 'Junie', object: 'the porch light' },
  kinds: ['heartbreak'],
  notes: [{ ask: 'If you could say it to them in one sentence, what would it be?', text: 'Leaving can still be love.' }],
  skipped: ['moment'],
});
assert.strictEqual(full.keep, 'Stay.');
assert.strictEqual(flow.nextStep(full), null);
const prompt = flow.promptText(full);
assert.ok(prompt.indexOf('North star.') === 0);
assert.ok(prompt.indexOf('Myself') !== -1);
assert.ok(prompt.indexOf('Leaving can still be love.') !== -1);
assert.ok(prompt.indexOf('I kept the key.') !== -1);
assert.ok(prompt.indexOf('porch light') !== -1);
assert.ok(/every section serves this north star/i.test(prompt));
assert.ok(prompt.indexOf('Stay.') !== -1);
assert.ok(/do not add a story they did not tell/i.test(prompt));
assert.ok(/their own words come first/i.test(prompt));
assert.ok(/do not add wisdom they did not write/i.test(prompt));
assert.ok(/cliches/i.test(prompt));
assert.ok(prompt.indexOf('\u2014') === -1);
assert.ok(!/\bSuno\b/.test(prompt));
const copy = JSON.stringify({
  openers: flow.OPENERS,
  reveals: flow.REVEALS,
  sensory: flow.SENSORY,
  starters: flow.STARTERS,
  follows: flow.FOLLOWS,
  stories: flow.FOR_STORIES,
});
assert.ok(copy.indexOf('\u2014') === -1);
assert.ok(!/\bSuno\b/.test(copy));
assert.ok(!/\bsoon\b/i.test(copy));

const rows = flow.cardRows(full);
assert.strictEqual(rows[0].label, 'For');
assert.strictEqual(rows[1].label, 'Aim');
assert.ok(rows[1].value.indexOf('tell the truth') !== -1);
assert.strictEqual(rows[2].label, 'Wisdom');

const capped = flow.toggle(['love'], 'heartbreak', 2);
assert.deepStrictEqual(capped, ['love', 'heartbreak']);
assert.deepStrictEqual(flow.toggle(capped, 'hype', 2), capped);
assert.deepStrictEqual(flow.toggle(['heal', 'cry'], 'cry'), ['heal']);

console.log('song-flow.test.js ok');
