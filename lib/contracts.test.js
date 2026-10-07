const assert = require('assert');
const fs = require('fs');
const path = require('path');
const contracts = require('./contracts');
const guard = require('./song-guard');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

assert.strictEqual(contracts.TYPES.length, 17);
assert.strictEqual(contracts.DISCLAIMER, 'General info, not legal advice. Have a lawyer review before signing anything big.');
assert.strictEqual(contracts.PAY_LINE, 'Pay per use. Victoria will set the amount.');
assert.ok(!/\$/.test(contracts.PAY_LINE));

const human = contracts.typesFor('human').map(function (type) { return type.id; });
const ai = contracts.typesFor('ai').map(function (type) { return type.id; });
['session', 'booking', 'band'].forEach(function (id) {
  assert.ok(human.indexOf(id) !== -1, id);
  assert.ok(ai.indexOf(id) === -1, id);
});
['ai-terms', 'ai-voice', 'ai-train', 'ai-stems'].forEach(function (id) {
  assert.ok(ai.indexOf(id) !== -1, id);
  assert.ok(human.indexOf(id) === -1, id);
});
assert.ok(human.indexOf('split') !== -1 && ai.indexOf('split') !== -1);
assert.strictEqual(contracts.typesFor('all').length, 17);
assert.strictEqual(contracts.tagFor(contracts.typeById('session')), 'Human');
assert.strictEqual(contracts.tagFor(contracts.typeById('ai-voice')), 'AI');
assert.strictEqual(contracts.tagFor(contracts.typeById('split')), 'Human and AI');

const flagged = contracts.analyze('The company owns all rights in perpetuity, with cross-collateralization, a 360 cut, and AI voice use. You may not terminate.');
assert.strictEqual(flagged.ok, true);
['Ownership grab', 'A very long term', 'Cross-collateralization', 'A 360 clause', 'AI, voice, or stems', 'No way out'].forEach(function (title) {
  assert.ok(flagged.redFlags.some(function (row) { return row.title === title; }), title);
});
assert.ok(flagged.redlines.length >= 4);
assert.ok(flagged.ask.length >= 4);

const consented = contracts.analyze('AI training only with your written consent.');
assert.ok(consented.fair.some(function (row) { return row.title === 'Consent is mentioned'; }));
assert.ok(!consented.redFlags.some(function (row) { return row.title === 'AI, voice, or stems'; }));

const half = contracts.analyze('The writer keeps 80% and the company takes the rest.');
assert.ok(half.redFlags.some(function (row) { return row.title === 'A high percentage'; }));

const draft = contracts.buildDraft({
  type: 'split',
  you: 'Ada',
  them: 'Bea',
  work: 'Night Drive',
  keep: 'You keep the song.',
  term: 'Until you end it',
  leave: 'Yes, with 30 days notice',
  share: 'half'
});
assert.ok(draft.indexOf('Ada') !== -1 && draft.indexOf('Bea') !== -1 && draft.indexOf('Night Drive') !== -1);
assert.ok(draft.indexOf(contracts.DISCLAIMER) !== -1);
assert.ok(draft.indexOf(contracts.PAY_LINE) !== -1);
assert.ok(draft.indexOf('$') === -1);
assert.ok(draft.indexOf('\u2014') === -1);

const beatQuestions = contracts.questionsFor('beat', false).map(function (step) { return step.id; });
assert.ok(beatQuestions.indexOf('exclusive') !== -1);
assert.ok(beatQuestions.indexOf('type') === -1);
assert.ok(contracts.questionsFor('', true)[0].id === 'type');

const parsed = contracts.fromModel('{"redFlags":[{"title":"Term","plain":"Too long."}],"fair":[],"ask":[],"redlines":[{"title":"Term","instead":"One year."}]}');
assert.strictEqual(parsed.redFlags[0].plain, 'Too long.');
assert.strictEqual(parsed.redlines[0].instead, 'One year.');
assert.strictEqual(guard.contentFilter('voice model of the artist', { allowVoice: true }).ok, true);
assert.strictEqual(guard.contentFilter('clone the voice of the singer').ok, false);

const pages = ['contracts.html', 'contracts-review.html', 'contracts-fix.html', 'contracts-create.html', 'contracts-hub.js', 'contracts-ai.js', 'contracts-create.js', 'contracts.css', 'lib/contracts.js', 'api/contracts.js'];
const blob = pages.map(read).join('\n');
assert.ok(blob.indexOf('\u2014') === -1);
assert.ok(blob.indexOf('$') === -1);
assert.ok(!/\bplans?\b/i.test(blob));
pages.slice(0, 4).forEach(function (name) {
  assert.ok(read(name).indexOf(contracts.DISCLAIMER) !== -1, name);
});
assert.ok(read('contracts.html').indexOf('Review mine') !== -1);
assert.ok(read('contracts.html').indexOf('Fix mine') !== -1);
assert.ok(read('contracts.html').indexOf('Create mine') !== -1);
assert.ok(read('contracts.html').indexOf('Contracts in the biz') !== -1);
assert.ok(read('contracts-hub.js').indexOf("What's fair") !== -1);
assert.ok(read('api/contracts.js').indexOf('verifyTurnstile') !== -1);
assert.ok(read('api/contracts.js').indexOf('allowVoice: true') !== -1);
assert.ok(read('api/contracts.js').indexOf('xai.chat') !== -1);
assert.ok(read('api/contracts.js').indexOf('createDailyLimiter') !== -1);
assert.ok(read('site.js').indexOf('ensureContractsPublic') !== -1);
assert.ok(read('site.js').indexOf('ensureContractsSide') !== -1);
assert.ok(read('site.js').indexOf('href: "/contracts"') !== -1);
assert.ok(read('vercel.json').indexOf('"/contracts"') !== -1);
assert.ok(read('destination.js').indexOf("href: '/contracts'") !== -1);
assert.ok(read('index.html').indexOf('href="/contracts">Contracts</a>') !== -1);

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader: function (key, value) { this.headers[key] = value; },
    end: function (payload) { this.body = payload; }
  };
}

async function runHandler() {
  const handler = require('../api/contracts');
  const statusRes = mockRes();
  await handler({ method: 'GET', url: '/api/contracts?action=status', headers: {} }, statusRes);
  const statusJson = JSON.parse(statusRes.body);
  assert.strictEqual(statusJson.ok, true);
  assert.strictEqual(statusJson.pay, contracts.PAY_LINE);
  if (!process.env.XAI_API_KEY) {
    const reviewRes = mockRes();
    await handler({
      method: 'POST',
      url: '/api/contracts',
      headers: {},
      body: { action: 'review', text: 'We own all rights in perpetuity.' }
    }, reviewRes);
    const reviewJson = JSON.parse(reviewRes.body);
    assert.strictEqual(reviewRes.statusCode, 200);
    assert.strictEqual(reviewJson.demo, true);
    assert.ok(reviewJson.redFlags.some(function (row) { return row.title === 'Ownership grab'; }));
  }
}

runHandler().then(function () {
  console.log('contracts.test.js ok');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
