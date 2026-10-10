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

assert.strictEqual(flow.STORY_MAX, 3000);
assert.strictEqual(flow.STORY_NEAR, 2700);
const story = ('We left for a new experience and new adventure. ').repeat(45).trim();
assert.ok(story.length >= 2000 && story.length <= flow.STORY_MAX);
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
}, function (err) {
  return err && err.code === 'long' && /What happened/.test(err.message) && /3000/.test(err.message);
});

const existing = 'I already wrote this story about the porch.';
const blocked = flow.proposeStory(existing, existing.length, existing.length, 'y'.repeat(flow.STORY_MAX));
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
assert.strictEqual(flow.countLabel('adventure'), '9 / 3000');
assert.strictEqual(flow.nearLimit('a'.repeat(2699)), false);
assert.strictEqual(flow.nearLimit('a'.repeat(2700)), true);

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
assert.strictEqual(core.LIMITS.who, flow.STORY_MAX);
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

const emptyMeter = flow.humanMeter('');
assert.strictEqual(emptyMeter.band, 'empty');
assert.strictEqual(emptyMeter.label, 'Not started');
assert.strictEqual(emptyMeter.gap, 2400);
assert.ok(emptyMeter.line.indexOf('Add about 2400 more characters to make it fully human.') !== -1);
assert.ok(emptyMeter.note.indexOf('your own words') !== -1);
assert.ok(emptyMeter.note.indexOf('not a copyright') !== -1);
assert.ok(emptyMeter.note.indexOf('legal guarantee') !== -1);
assert.ok(emptyMeter.line.indexOf('\u2014') === -1);
assert.strictEqual(flow.humanMeter('a'.repeat(1)).band, 'started');
assert.strictEqual(flow.humanMeter('a'.repeat(799)).band, 'started');
assert.strictEqual(flow.humanMeter('a'.repeat(flow.HUMAN_MOSTLY)).band, 'mostly');
assert.strictEqual(flow.humanMeter('a'.repeat(flow.HUMAN_MOSTLY)).label, 'Mostly yours');
const almost = flow.humanMeter('a'.repeat(2160));
assert.strictEqual(almost.band, 'mostly');
assert.strictEqual(almost.gap, 240);
assert.ok(almost.line.indexOf('Add about 240 more characters to make it fully human.') !== -1);
assert.strictEqual(flow.humanMeter('a'.repeat(flow.HUMAN_FULL)).band, 'full');
assert.strictEqual(flow.humanMeter('a'.repeat(flow.HUMAN_FULL)).label, 'Fully human');
assert.ok(flow.humanMeter('a'.repeat(3000)).line.indexOf('fully human') !== -1);
assert.ok(!/Human first/i.test(emptyMeter.line + emptyMeter.note));

const guideEmpty = flow.nextGuide('');
assert.strictEqual(guideEmpty.step, 'verse');
assert.strictEqual(guideEmpty.gap, flow.GUIDE_START);
assert.ok(guideEmpty.line.indexOf('first verse') !== -1);
assert.ok(guideEmpty.line.indexOf('Add about 400 more characters') !== -1);
const guideStart = flow.nextGuide('a'.repeat(400));
assert.strictEqual(guideStart.step, 'hook');
assert.strictEqual(guideStart.gap, 400);
assert.strictEqual(guideStart.line, 'Good start. Add about 400 more characters, then write your hook (the line people will repeat).');
const guideMid = flow.nextGuide('a'.repeat(450));
assert.strictEqual(guideMid.gap, 350);
assert.ok(guideMid.line.indexOf('Good start. Add about 350 more characters, then write your hook (the line people will repeat).') !== -1);
const guideHook = flow.nextGuide('a'.repeat(flow.HUMAN_MOSTLY));
assert.strictEqual(guideHook.step, 'hook');
assert.ok(guideHook.line.indexOf('Write your hook, the line people will repeat.') === 0);
assert.ok(guideHook.line.indexOf('next verse') !== -1);
const guideVerse2 = flow.nextGuide('a'.repeat(flow.GUIDE_VERSE2));
assert.strictEqual(guideVerse2.step, 'verse2');
assert.ok(guideVerse2.line.indexOf('Write the next verse.') === 0);
assert.ok(guideVerse2.line.indexOf('then a bridge') !== -1);
const guideBridge = flow.nextGuide('a'.repeat(flow.GUIDE_BRIDGE));
assert.strictEqual(guideBridge.step, 'bridge');
assert.ok(guideBridge.line.indexOf('Write a bridge, the turn in the song.') === 0);
assert.strictEqual(guideBridge.gap, flow.HUMAN_FULL - flow.GUIDE_BRIDGE);
const guideFull = flow.nextGuide('a'.repeat(flow.HUMAN_FULL));
assert.strictEqual(guideFull.step, 'full');
assert.strictEqual(guideFull.gap, 0);
assert.ok(guideFull.line.indexOf('fully human') !== -1);
assert.ok(guideFull.line.indexOf('Add about') === -1);
const hookLine = 'I still set a place for you';
const withHook = 'The mug sat in the kitchen after you left.\n' + hookLine + '\nThe porch light stayed on.\n' + hookLine + '\n' + 'a'.repeat(360);
const guideHookIn = flow.nextGuide(withHook);
assert.strictEqual(guideHookIn.hook, true);
assert.ok(guideHookIn.count >= 400);
assert.ok(guideHookIn.line.indexOf('can be your hook') !== -1);
assert.ok(guideHookIn.line.indexOf('write your hook') === -1);
assert.ok(guideHookIn.line.indexOf('Good start') === -1);
assert.strictEqual(flow.repeatedHook('yeah\nyeah'), '');
assert.strictEqual(flow.nextGuide('yeah\nyeah').hook, false);
assert.ok(guideStart.line.indexOf('\u2014') === -1);
assert.ok(!/\bSuno\b/.test(guideStart.line + guideHookIn.line + guideFull.line));
assert.ok(!/Human first/i.test(guideStart.line + guideHookIn.line));
assert.ok(!/guaranteed/i.test(guideStart.line + guideBridge.line + guideFull.line));

const blanks = flow.blankSections();
assert.deepStrictEqual(blanks.map(function (row) { return row.label; }), ['Verse 1', 'Hook', 'Verse 2', 'Bridge']);
const withVerse = flow.addSection(blanks, 'verse');
assert.strictEqual(withVerse[withVerse.length - 1].label, 'Verse 3');
const withOutro = flow.addSection(withVerse, 'outro');
assert.strictEqual(withOutro[withOutro.length - 1].label, 'Outro');
assert.strictEqual(flow.addSection(withOutro, 'outro').filter(function (row) { return row.kind === 'outro'; }).length, 1);
const keptWords = flow.blankSections();
keptWords[3].text = 'turn';
const blockedRemove = flow.removeSection(keptWords, 'bridge');
assert.strictEqual(blockedRemove.ok, false);
assert.strictEqual(blockedRemove.sections[3].text, 'turn');
assert.ok(/Clear it first/.test(blockedRemove.message));
keptWords[3].text = '';
const removed = flow.removeSection(keptWords, 'bridge');
assert.strictEqual(removed.ok, true);
assert.strictEqual(removed.sections.length, 3);
const only = [{ id: 'verse-1', kind: 'verse', label: 'Verse 1', text: '' }];
const lastPart = flow.removeSection(only, 'verse-1');
assert.strictEqual(lastPart.ok, false);
assert.ok(/at least one/.test(lastPart.message));
const crowded = flow.blankSections();
crowded[0].text = 'a'.repeat(2000);
crowded[1].text = 'b'.repeat(500);
const overPart = flow.proposeSectionText(crowded, 'hook', 'b'.repeat(1200));
assert.strictEqual(overPart.ok, false);
assert.strictEqual(overPart.message, flow.TOO_LONG);
assert.strictEqual(overPart.sections[1].text, 'b'.repeat(500));
assert.strictEqual(crowded[1].text, 'b'.repeat(500));
const shorter = flow.proposeSectionText(crowded, 'verse-1', 'a'.repeat(100));
assert.strictEqual(shorter.ok, true);
assert.strictEqual(shorter.sections[0].text, 'a'.repeat(100));
const suggestion = 'Sing this line back to me.';
const untouched = flow.blankSections();
assert.strictEqual(untouched[1].text, '');
const applied = flow.applySuggestion(untouched, 'hook', suggestion);
assert.strictEqual(applied.ok, true);
assert.ok(applied.sections[1].text.indexOf(suggestion) !== -1);
assert.strictEqual(untouched[1].text, '');
const overSuggest = flow.applySuggestion([{ id: 'hook', kind: 'hook', label: 'Hook', text: 'a'.repeat(2990) }], 'hook', 'b'.repeat(20));
assert.strictEqual(overSuggest.ok, false);
assert.strictEqual(overSuggest.sections[0].text, 'a'.repeat(2990));
const sheet = '[Verse 1]\nMug on the chair\n[Hook]\nStay with me tonight\n[Verse 2]\nPorch light\n[Bridge]\nI turned around\n';
const split = flow.splitLyrics(sheet);
assert.ok(split);
assert.deepStrictEqual(split.map(function (row) { return row.label; }), ['Verse 1', 'Hook', 'Verse 2', 'Bridge']);
assert.ok(split[0].text.indexOf('Mug on the chair') !== -1);
assert.ok(split[1].text.indexOf('Stay with me tonight') !== -1);
assert.ok(split[2].text.indexOf('Porch light') !== -1);
assert.ok(split[3].text.indexOf('I turned around') !== -1);
const chorus = flow.splitLyrics('[Verse 1]\nMug on the chair\n[Chorus]\nStay with me tonight\n');
assert.strictEqual(chorus[1].kind, 'hook');
assert.strictEqual(chorus[1].label, 'Hook');
assert.strictEqual(flow.splitLyrics('just words\nno headers'), null);
assert.strictEqual(flow.splitLyrics('[Verse 1]\nonly one header'), null);
const firstGuide = flow.nextGuide(flow.blankSections());
assert.strictEqual(firstGuide.section, 'Verse 1');
assert.strictEqual(firstGuide.gap, 400);
assert.ok(firstGuide.line.indexOf('Write Verse 1 next') !== -1);
const startedParts = flow.blankSections();
startedParts[0].text = 'a'.repeat(400);
const hookGuide = flow.nextGuide(startedParts);
assert.strictEqual(hookGuide.section, 'Hook');
assert.strictEqual(hookGuide.gap, 200);
assert.ok(hookGuide.line.indexOf('Good start') !== -1);
assert.ok(hookGuide.line.indexOf('Hook') !== -1);
assert.ok(hookGuide.line.indexOf('line people will repeat') !== -1);
const repeatedParts = flow.blankSections();
repeatedParts[0].text = 'I still set a place for you\n' + 'a'.repeat(400) + '\nI still set a place for you';
const repeatedGuide = flow.nextGuide(repeatedParts);
assert.strictEqual(repeatedGuide.section, 'Verse 2');
assert.ok(repeatedGuide.line.indexOf('can be your hook') !== -1);
assert.ok(repeatedGuide.line.indexOf('write your hook') === -1);
const guideCopy = firstGuide.line + hookGuide.line + repeatedGuide.line;
assert.ok(guideCopy.indexOf('\u2014') === -1);
assert.ok(!/\bSuno\b/.test(guideCopy));
assert.ok(!/Human first/i.test(guideCopy));
assert.ok(!/guaranteed/i.test(guideCopy));

const aiVerse = flow.blankSections();
aiVerse[0].text = 'a'.repeat(400);
aiVerse[0].marks = 'a'.repeat(400);
assert.strictEqual(flow.humanText(aiVerse), '');
assert.strictEqual(flow.ownedLength(aiVerse[0]), 0);
assert.strictEqual(flow.sectionTotal(aiVerse), 400);
const aiGuide = flow.nextGuide(aiVerse);
assert.strictEqual(aiGuide.section, 'Verse 1');
assert.strictEqual(aiGuide.gap, 400);
const editedMarks = flow.retagMarks('aaaa', 'aaaa', 'aaXa');
assert.strictEqual(editedMarks, 'aaua');
assert.strictEqual(flow.ownedLength({ text: 'aaXa', marks: editedMarks }), 1);
const extendedMarks = flow.previewMarks('extend', 'Hello', 'uuuuu', 'Hello\nMore', false);
assert.strictEqual(extendedMarks.indexOf('a'), 5);
assert.strictEqual(extendedMarks.slice(0, 5), 'uuuuu');
assert.strictEqual(flow.previewMarks('rhymify', 'Hello', 'uuuuu', 'Hello there', true), 'u'.repeat('Hello there'.length));
assert.strictEqual(flow.previewMarks('rhymify', 'Hello', 'uuuuu', 'Hello there', false).indexOf('u'), -1);
const inserted = flow.insertSection(flow.blankSections(), 'hook');
assert.strictEqual(inserted[2].label, 'Verse 3');
assert.strictEqual(inserted[1].label, 'Hook');
const cappedAi = flow.blankSections();
cappedAi[0].text = 'a'.repeat(2990);
const tooWide = flow.proposeSectionText(cappedAi, 'verse-1', 'a'.repeat(2990) + '\nthis extra line is too long');
assert.strictEqual(tooWide.ok, false);
assert.strictEqual(tooWide.message, flow.TOO_LONG);
assert.strictEqual(cappedAi[0].text, 'a'.repeat(2990));
assert.ok(flow.humanMeter('').note.indexOf('AI-assisted') !== -1);
assert.ok(flow.humanMeter('').note.indexOf('\u2014') === -1);

const kept = flow.cleanPageLyrics('hello  \n\n\nworld\n');
assert.strictEqual(kept, 'hello\n\nworld');
assert.ok(kept.indexOf('hello') !== -1 && kept.indexOf('world') !== -1);

const added = flow.appendAnswer('The mug is chipped.', 'It was blue.');
assert.strictEqual(added.ok, true);
assert.strictEqual(added.value, 'The mug is chipped.\n\nIt was blue.');
assert.ok(added.value.length > 'The mug is chipped.'.length);
const blockedAppend = flow.appendAnswer('a'.repeat(2990), 'b'.repeat(20));
assert.strictEqual(blockedAppend.ok, false);
assert.strictEqual(blockedAppend.value, 'a'.repeat(2990));
assert.strictEqual(blockedAppend.message, flow.TOO_LONG);
assert.strictEqual(flow.appendAnswer('Hi', '   ').ok, false);
assert.strictEqual(flow.appendAnswer('Hi', '   ').message, flow.ANSWER_EMPTY);

console.log('song-flow.test.js ok');
