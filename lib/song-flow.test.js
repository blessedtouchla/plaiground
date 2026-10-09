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

const ids = flow.styleIds({
  forId: 'someone',
  aims: ['heal', 'hype'],
  kinds: ['love', 'hype'],
  opener: 'We cooked in the kitchen',
  sensory: { place: 'at home', object: 'a mug', who: 'mom' }
});
assert.strictEqual(ids.forId, 'someone');
assert.strictEqual(ids.aimId, 'heal');
assert.strictEqual(ids.kindId, 'love');
assert.strictEqual(ids.opener, 'We cooked in the kitchen');
assert.ok(ids.scene.indexOf('at home') !== -1);
assert.ok(ids.scene.indexOf('mom') !== -1);
assert.strictEqual(ids.object, 'a mug');
assert.strictEqual(flow.styleIds({ forId: 'nope', aims: ['other'] }).forId, '');
assert.strictEqual(flow.styleIds({ aims: ['other'] }).aimId, 'other');

assert.strictEqual(flow.STORY_MAX, 1500);
assert.strictEqual(flow.STORY_NEAR, 1350);
const story = ('We left for a new experience and new adventure. ').repeat(8).trim();
assert.ok(story.length > 280 && story.length <= flow.STORY_MAX);
const keptStory = flow.clean({
  forId: 'someone',
  aims: ['heal'],
  opener: story,
});
assert.strictEqual(keptStory.opener, story);
assert.ok(flow.promptText(keptStory).indexOf(story) !== -1);
assert.ok(flow.cardRows(keptStory).some(function (row) {
  return row.id === 'open' && row.value === story;
}));
assert.throws(function () {
  flow.clean({ opener: 'y'.repeat(flow.STORY_MAX + 1) });
}, function (err) { return err && err.code === 'long'; });

const existing = 'I already wrote this story about the porch.';
const blocked = flow.proposeStory(existing, existing.length, existing.length, 'y'.repeat(1600));
assert.strictEqual(blocked.ok, false);
assert.strictEqual(blocked.value, existing);
assert.strictEqual(blocked.message, flow.TOO_LONG);
assert.ok(blocked.message.indexOf('\u2014') === -1);
const typed = flow.proposeStory('hello', 5, 5, '!');
assert.deepStrictEqual(typed, { ok: true, value: 'hello!', message: '' });
const atCap = 'a'.repeat(flow.STORY_MAX);
const more = flow.proposeStory(atCap, atCap.length, atCap.length, 'b');
assert.strictEqual(more.ok, false);
assert.strictEqual(more.value, atCap);
assert.strictEqual(flow.countLabel('adventure'), '9 / 1500');
assert.strictEqual(flow.nearLimit('a'.repeat(1349)), false);
assert.strictEqual(flow.nearLimit('a'.repeat(1350)), true);

const questions = require('./song-questions');
const core = require('./song-helper');
const modes = require('./song-modes');
const pass = require('./song-pass');
assert.strictEqual(questions.STORY_MAX, flow.STORY_MAX);
assert.strictEqual(core.STORY_MAX, flow.STORY_MAX);
assert.strictEqual(core.LIMITS.happened, flow.STORY_MAX);
assert.strictEqual(core.LIMITS.why, flow.STORY_MAX);
assert.strictEqual(core.LIMITS.line, flow.STORY_MAX);
assert.strictEqual(core.LIMITS.word, flow.STORY_MAX);
assert.strictEqual(core.LIMITS.sparkStory, flow.STORY_MAX);
assert.strictEqual(modes.STORY_MAX, flow.STORY_MAX);
assert.strictEqual(pass.STORY_MAX, flow.STORY_MAX);

const session = questions.open({ kind: 'heartbreak', mode: 'write', part: 'hook' });
session.draft = story;
questions.next(session);
assert.strictEqual(session.saved[0].text, story);
assert.ok(session.saved[0].text.indexOf('new adventure') !== -1);
assert.throws(function () {
  session.draft = 'z'.repeat(flow.STORY_MAX + 1);
  questions.next(session);
}, function (err) { return err && err.code === 'long'; });

const prepared = modes.normalizeInput({ mode: 'hook', happened: story, line: 'I still set a place for you tonight.', why: 'It changed the whole week.' });
assert.strictEqual(prepared.happened, story);
assert.ok(modes.userPrompt(prepared).indexOf(story) !== -1);
assert.throws(function () {
  modes.normalizeInput({ mode: 'hook', happened: 'q'.repeat(flow.STORY_MAX + 1) });
}, function (err) { return err && err.code === 'long'; });

const answerRows = pass.summary({ happened: story, mood: 'sad' });
const happenedRow = answerRows.filter(function (row) { return row.id === 'happened'; })[0];
assert.strictEqual(happenedRow.label, 'What happened');
assert.strictEqual(happenedRow.value, story);
assert.ok(happenedRow.value.length > 180);

const interview = core.normalizeInterview({
  mood: 'heartbroken',
  happened: story,
  who: 'M',
  why: 'You stopped answering when I asked you to stay.',
  line: 'I still set a place for you like you are coming home.',
  north: { forId: 'someone', aims: ['heal'], opener: story },
});
assert.strictEqual(interview.happened, story);
assert.strictEqual(interview.north.opener, story);
assert.ok(core.interviewPrompt(interview).indexOf(story) !== -1);
assert.throws(function () {
  core.normalizeInterview({
    mood: 'heartbroken',
    happened: 'm'.repeat(flow.STORY_MAX + 1),
    who: 'M',
    why: 'You stopped answering when I asked you to stay.',
    line: 'I still set a place for you like you are coming home.',
  });
}, function (err) { return err && err.code === 'long'; });

console.log('song-flow.test.js ok');
