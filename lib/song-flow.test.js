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
assert.strictEqual(flow.nextStep(started).id, 'wisdom');

const heart = flow.sensorySteps(['heartbreak']);
assert.strictEqual(heart[0].ask, 'Who broke it, or who did you lose?');
const grateful = flow.sensorySteps(['grateful']);
assert.ok(grateful[0].ask.indexOf('thanking') !== -1);
assert.notStrictEqual(heart[0].ask, grateful[0].ask);

const full = flow.clean({
  forId: 'myself',
  forText: 'me, out loud',
  aims: ['cry', 'other'],
  aimOther: 'tell the truth',
  wisdom: 'Leaving can still be love.',
  reveals: { never: 'I kept the key.', scared: 'I wanted them to stay.', nobody: 'The quiet was the cruel part.' },
  sensory: { who: 'Junie', object: 'the porch light' },
  kinds: ['heartbreak'],
  skipped: ['moment'],
});
assert.strictEqual(flow.nextStep(full).id, 'quote');
const prompt = flow.promptText(full);
assert.ok(prompt.indexOf('North star.') === 0);
assert.ok(prompt.indexOf('Myself') !== -1);
assert.ok(prompt.indexOf('Leaving can still be love.') !== -1);
assert.ok(prompt.indexOf('I kept the key.') !== -1);
assert.ok(prompt.indexOf('porch light') !== -1);
assert.ok(/every section serves this north star/i.test(prompt));
assert.ok(/do not add wisdom they did not write/i.test(prompt));
assert.ok(/cliches/i.test(prompt));
assert.ok(prompt.indexOf('\u2014') === -1);

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
