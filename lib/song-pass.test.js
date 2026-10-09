const assert = require('assert');
const fs = require('fs');
const path = require('path');
const pass = require('./song-pass');
const core = require('./song-helper');
const modes = require('./song-modes');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

const rich = {
  topic: 'The diner closed and the keys were still in the bowl',
  happened: 'The diner closed and the keys were still in the bowl',
  who: 'M',
  why: 'You stopped answering when I asked you to stay.',
  line: 'I still set a place for you like you are coming home.',
  mood: 'heartbroken',
  genre: 'R&B',
  place: 'the diner booth',
  object: 'a chipped mug',
  region: 'Houston',
  language: 'english',
  explicit: 'clean',
  length: 'full',
  words: [{ label: 'Place', text: 'booth by the window' }]
};

assert.strictEqual(pass.followups(rich).length, 0);
const rows = pass.summary(rich);
assert.ok(rows.some(function (row) { return row.id === 'happened'; }));
const longHappened = ('We left for a new experience and new adventure. ').repeat(6).trim();
const longRows = pass.summary({ happened: longHappened });
assert.strictEqual(longRows.filter(function (row) { return row.id === 'happened'; })[0].value, longHappened);
assert.ok(!rows.some(function (row) { return row.id === 'idea'; }));
assert.ok(rows.some(function (row) { return row.label === 'Filters' && row.value === 'Houston'; }));

const thin = { topic: 'love', happened: 'love', mood: 'sad' };
const asks = pass.followups(thin);
assert.ok(asks.length >= 1 && asks.length <= 2);
assert.strictEqual(asks[0].id, 'place');
assert.ok(pass.followups({ happened: 'The bus left without my coat', place: 'the stop', object: 'a coat' }).length === 0);
assert.strictEqual(pass.followups({
  happened: 'The diner closed and the keys were still in the bowl',
  who: 'M',
  why: 'You stopped answering when I asked you to stay.'
}).length, 0);
assert.ok(pass.followups({ happened: 'keys in the bowl' }).length >= 1);
assert.ok(pass.isGeneric('vibes'));
assert.ok(!pass.isGeneric('The bus left without my coat'));

const clear = pass.feedbackPlan({ chips: ['cheesy', 'hook'], note: 'keep the second verse' });
assert.strictEqual(clear.clear, true);
assert.ok(clear.instruction.indexOf('Change only what this asks') !== -1);
assert.ok(clear.instruction.indexOf('less cheesy') !== -1);
assert.ok(clear.instruction.indexOf('keep the second verse') !== -1);

const lengthChoice = pass.feedbackPlan({ chips: ['long', 'short'] });
assert.strictEqual(lengthChoice.ask, 'Shorter or longer?');
const shorterId = lengthChoice.options.filter(function (opt) { return opt.label === 'Shorter'; })[0].id;
assert.ok(pass.feedbackPlan({ chips: [shorterId] }).instruction.indexOf('Shorten the draft') !== -1);
assert.strictEqual(pass.feedbackPlan({ chips: ['more-slang', 'less-slang'] }).ask, 'More slang or less?');
assert.strictEqual(pass.feedbackPlan({ chips: [], note: 'make it better' }).ask, 'What should change?');
assert.strictEqual(pass.feedbackPlan({ chips: ['more-slang'], note: 'less slang please' }).ask, 'More slang or less?');
assert.strictEqual(pass.feedbackPlan({ chips: [], note: '' }).empty, true);

const shorter = pass.feedbackPlan({ chips: ['long'] });
assert.strictEqual(shorter.clear, true);
assert.ok(shorter.instruction.indexOf('Shorten the draft') !== -1);
const longer = pass.feedbackPlan({ chips: ['short'] });
assert.ok(longer.instruction.indexOf('Add a few generated lines') !== -1);

const revised = core.normalizeInterview({
  mood: 'heartbroken',
  happened: 'The diner closed and the keys were still in the bowl',
  who: 'M',
  why: 'You stopped answering when I asked you to stay.',
  line: 'I still set a place for you like you are coming home.',
  words: {},
  shape: { pack: 'rnb', language: 'english', explicit: 'clean', length: 'full' },
  followPlace: 'the diner booth',
  followObject: 'a chipped mug',
  revision: 'Revise the draft. Change only what this asks.',
  previous: 'Verse\nOld line'
});
assert.strictEqual(revised.followPlace, 'the diner booth');
assert.ok(revised.revision.indexOf('Change only what this asks') !== -1);
const prompt = core.interviewPrompt(revised);
assert.ok(prompt.indexOf('the diner booth') !== -1);
assert.ok(prompt.indexOf('This is a revision') !== -1);
assert.ok(prompt.indexOf('Keep hookSentenceVerbatim') !== -1);
assert.ok(prompt.indexOf('Old line') !== -1);

const plain = core.interviewPrompt(core.normalizeInterview({
  mood: 'heartbroken',
  happened: 'The diner closed and the keys were still in the bowl',
  who: 'M',
  why: 'You stopped answering when I asked you to stay.',
  line: 'I still set a place for you like you are coming home.',
  words: {},
  shape: { pack: 'rnb' }
}));
assert.ok(plain.indexOf('This is a revision') === -1);

const modeInput = modes.normalizeInput({
  mode: 'write',
  place: 'kitchen',
  object: 'mug',
  quote: 'stay',
  mood: 'hyped',
  revision: 'Use less slang in the generated lines.',
  previous: 'Verse\nKeep this'
});
assert.strictEqual(modeInput.revision, 'Use less slang in the generated lines.');
const modePrompt = modes.userPrompt(modeInput);
assert.ok(modePrompt.indexOf('Use less slang') !== -1);
assert.ok(modePrompt.indexOf('Keep this') !== -1);
assert.ok(modes.systemPrompt(modeInput).indexOf('Change only what revision asks') !== -1);

const page = ['lib/song-pass.js', 'song-helper.js', 'song-helper-v2.js', 'song-helper.html'].map(read).join('\n');
assert.ok(page.indexOf('\u2014') === -1);
assert.ok(page.indexOf('Your answers') !== -1);
assert.ok(page.indexOf('Too cheesy') !== -1);
assert.ok(page.indexOf("Doesn't rhyme enough") !== -1);
assert.ok(page.indexOf('id="sh-answers"') !== -1);
assert.ok(page.indexOf('id="sh-feedback"') !== -1);
