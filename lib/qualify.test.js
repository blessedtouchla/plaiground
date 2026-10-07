const assert = require('assert');
const fs = require('fs');
const path = require('path');
const qualify = require('./qualify');
const copyright = require('./copyright');
const destination = require('../destination');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

const human = {
  lyrics: 'human',
  melody: 'human',
  vocals: 'human',
  instruments: 'human',
  tool: 'none',
  files: 'yes',
  traction: 'no'
};

assert.strictEqual(qualify.QUESTIONS.length, 4);
assert.deepStrictEqual(qualify.QUESTIONS.map(function (step) { return step.id; }), [
  'lyrics', 'melody', 'vocals', 'instruments'
]);
assert.ok(!qualify.QUESTIONS.some(function (step) { return step.id === 'tool' || step.id === 'files' || step.id === 'traction'; }));
assert.strictEqual(qualify.INTRO.title, 'What this check is for');
assert.ok(qualify.INTRO.lead.indexOf('four things') !== -1);
assert.deepStrictEqual(qualify.FOR.map(function (item) { return item.title; }), [
  'Copyright registration',
  'Publishing',
  'Sync placements',
  'Clean release with distributors and labels'
]);
assert.ok(qualify.FOR[1].detail.indexOf('BMI or ASCAP') !== -1);
assert.ok(qualify.FOR[2].detail.indexOf('TV, film, ads, and games') !== -1);
assert.strictEqual(qualify.DISCLAIMER, 'General info, not legal advice.');
assert.strictEqual(qualify.TRUTH, 'A human re-record protects the new recording. The song itself needs human authorship.');
assert.strictEqual(qualify.CLEAR, 'The aim is a record labels, supervisors and distributors can clear.');

assert.strictEqual(qualify.outcomeId(human), 'ready');
assert.strictEqual(qualify.outcomeId(Object.assign({}, human, { vocals: 'ai' })), 'almost');
assert.strictEqual(qualify.outcomeId(Object.assign({}, human, { instruments: 'ai' })), 'almost');
assert.strictEqual(qualify.outcomeId(Object.assign({}, human, { vocals: 'ai', instruments: 'ai' })), 'almost');
assert.strictEqual(qualify.outcomeId(Object.assign({}, human, { lyrics: 'ai' })), 'needs');
assert.strictEqual(qualify.outcomeId(Object.assign({}, human, { melody: 'ai' })), 'needs');
assert.strictEqual(qualify.outcomeId(Object.assign({}, human, { lyrics: 'mix', vocals: 'ai' })), 'needs');
assert.strictEqual(qualify.outcomeId(Object.assign({}, human, { melody: 'mix' })), 'needs');

const ready = qualify.result(Object.assign({}, human, { tool: 'suno', traction: 'yes' }));
assert.strictEqual(ready.id, 'ready');
assert.strictEqual(ready.title, 'Ready for sync & publishing');
assert.strictEqual(ready.href, '/make-human#sync');
assert.strictEqual(ready.cta, 'See the sync-ready package');
assert.ok(ready.steps.indexOf('Name the tool in the disclosure line.') !== -1);
assert.ok(ready.steps.indexOf('Traction helps people find the song. It does not replace human authorship.') !== -1);
assert.ok(ready.steps.indexOf('Bring the project files. They show what a person did.') !== -1);
assert.deepStrictEqual(ready.gates.map(function (item) { return item.status; }), ['Ready', 'Ready', 'Ready', 'Ready']);

const almostVoice = qualify.result(Object.assign({}, human, { vocals: 'ai', files: 'no', tool: 'udio' }));
assert.strictEqual(almostVoice.id, 'almost');
assert.strictEqual(almostVoice.title, 'Almost there');
assert.strictEqual(almostVoice.href, '/make-human#resing');
assert.strictEqual(almostVoice.cta, 'Start a human re-sing');
assert.ok(almostVoice.steps.indexOf('Save what you still have: the words, the date, and the tool name.') !== -1);
assert.deepStrictEqual(almostVoice.gates.map(function (item) { return item.status; }), [
  'Song ready. Recording after a human re-sing.',
  'Ready',
  'After a human re-sing',
  'After a human re-sing'
]);

const almostBeat = qualify.result(Object.assign({}, human, { instruments: 'ai' }));
assert.strictEqual(almostBeat.href, '/make-human#master');
assert.strictEqual(almostBeat.cta, 'Start a new human master');
assert.strictEqual(almostBeat.gates[0].status, 'Song ready. Recording after a new human master.');
assert.strictEqual(almostBeat.gates[1].status, 'Ready');
assert.strictEqual(almostBeat.gates[2].status, 'After a new human master');
assert.strictEqual(almostBeat.gates[3].status, 'After a new human master');

const almostBoth = qualify.result(Object.assign({}, human, { vocals: 'ai', instruments: 'ai' }));
assert.strictEqual(almostBoth.href, '/make-human#master');

const needs = qualify.result(Object.assign({}, human, { lyrics: 'ai', vocals: 'ai', tool: 'other' }));
assert.strictEqual(needs.id, 'needs');
assert.strictEqual(needs.title, 'Needs a human pass');
assert.strictEqual(needs.href, '/make-human#sync');
assert.strictEqual(needs.cta, 'Start with a writing pass');
assert.strictEqual(needs.truth, qualify.TRUTH);
assert.strictEqual(needs.clear, qualify.CLEAR);
assert.ok(needs.steps.some(function (line) { return /human writing pass|person writes/i.test(line); }));
assert.deepStrictEqual(needs.gates.map(function (item) { return item.status; }), [
  'After a human writing pass',
  'After a human writing pass',
  'After a human writing pass',
  'After a human writing pass'
]);

['ready', 'almost', 'needs'].forEach(function (id) {
  const card = qualify.OUTCOMES[id];
  assert.ok(card.steps.length >= 3, id);
  assert.ok(card.href.indexOf('/make-human#') === 0, id);
});

const pages = ['qualify.html', 'qualify.js', 'qualify.css', 'make-human.html', 'lib/qualify.js'].map(read).join('\n');
assert.ok(pages.indexOf('\u2014') === -1, 'no em dash');
assert.ok(!/\$/.test(pages), 'no prices');
assert.ok(!/no longer AI/i.test(pages));
assert.ok(!/\bplans?\b/i.test(pages));
assert.ok(pages.indexOf('General info, not legal advice.') !== -1);
assert.ok(pages.indexOf('a record labels, supervisors and distributors can clear') !== -1);
assert.ok(read('qualify.html').indexOf('lib/qualify.js') !== -1);
assert.ok(read('qualify.html').indexOf('site.css?v=20261007polish') !== -1);
assert.ok(read('qualify.js').indexOf('api.INTRO.title') === -1);
assert.ok(read('qualify.js').indexOf('card.gates') !== -1);
assert.ok(read('qualify.js').indexOf('data-qualify-start') === -1);

const service = read('make-human.html');
assert.ok(service.indexOf('id="resing"') !== -1);
assert.ok(service.indexOf('id="master"') !== -1);
assert.ok(service.indexOf('id="sync"') !== -1);
assert.strictEqual((service.match(/Pricing coming soon/g) || []).length, 3);
assert.ok(service.indexOf('Victoria will set this.') !== -1);
assert.ok(service.indexOf('Jason Derulo') !== -1);
assert.ok(service.indexOf('LET ME BE') !== -1);
assert.ok(service.indexOf('Sept 2026') !== -1);
assert.ok(service.indexOf('human vocals and new verses') !== -1);
assert.ok(service.indexOf('It is not a claim about a copyright win.') !== -1);
assert.ok(!/won a copyright|copyright victory|copyright win for/i.test(service));
assert.ok(service.indexOf('Split sheets') !== -1);
assert.ok(service.indexOf('Chain of title') !== -1);
assert.ok(service.indexOf('honest AI disclosure') !== -1);
assert.ok(service.indexOf('PRO signup') !== -1);
assert.ok(service.indexOf('origin story') !== -1);
assert.ok(service.indexOf('No placement promise') !== -1);

const ai = copyright.screens({ lane: 'ai' });
const paths = ai.filter(function (screen) { return screen.id === 'paths'; })[0];
assert.ok(paths);
assert.deepStrictEqual(paths.links, [
  { href: '/qualify', label: 'Qualify my song' }
]);
assert.ok(copyright.screens({ lane: 'human' }).every(function (screen) { return screen.id !== 'paths'; }));
assert.ok(read('copyright.js').indexOf("kind === 'paths'") !== -1);

assert.strictEqual(destination.STOPS.qualify.href, '/qualify');
assert.strictEqual(destination.STOPS.makehuman.href, '/make-human');
assert.ok(destination.recommendedIds('idea', 'fanbase').indexOf('qualify') === -1);
assert.ok(destination.recommendedIds('idea', 'fanbase').indexOf('makehuman') === -1);
assert.ok(destination.recommendedIds('made', 'release').indexOf('qualify') === -1);
assert.ok(destination.STOP_ORDER.indexOf('makehuman') === -1);
assert.ok(read('vercel.json').indexOf('"/qualify"') !== -1);
assert.ok(read('vercel.json').indexOf('"/make-human"') !== -1);
