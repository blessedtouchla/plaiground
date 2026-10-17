'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const reply = require('./plai-reply');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

assert.ok(reply.FACTS.indexOf('Plai') !== -1);
assert.ok(reply.FACTS.indexOf('$2.49') !== -1);
assert.ok(reply.FACTS.indexOf('100%') !== -1);
assert.ok(/Join free/.test(reply.FACTS));
assert.ok(/Attest the rights/.test(reply.FACTS));
assert.ok(/Sign the split sheet/.test(reply.FACTS));
assert.ok(/free co-writer/.test(reply.FACTS));
assert.ok(/do not say there is no free Basic plan/i.test(reply.FACTS));
assert.ok(/no free release plan/i.test(reply.FACTS));
assert.ok(!/no free Basic plan/i.test(reply.PRICE));
assert.ok(!/[—–]/.test(reply.FACTS + reply.PRICE));
assert.ok(/Never name Suno, ToneGrid, or YouTube/.test(reply.FACTS));
assert.ok(!/Suno|ToneGrid|YouTube/i.test(reply.PRICE));

assert.strictEqual(reply.polish("I'm Play. Play the song when you are ready."), "I'm Plai. Play the song when you are ready.");
assert.strictEqual(reply.polish('I am PLAY.'), 'I am Plai.');
assert.strictEqual(reply.polish('Hello — there.'), 'Hello, there.');
assert.strictEqual(reply.polish('Hello – there.'), 'Hello, there.');
assert.strictEqual(reply.polish('Keep this, and that — plus more.'), 'Keep this, and that, plus more.');
assert.strictEqual(reply.polish('All set — Bring the song.'), 'All set. Bring the song.');
assert.strictEqual(reply.polish('No there is no free Basic plan.'), '');
assert.strictEqual(
  reply.polish('Artists keep 100 percent. Plai.'),
  'Artists keep 100%.'
);
assert.strictEqual(
  reply.polish('Artists keep every bit of their royalties. It is $2.49 if you choose.', { ask: 'How much does it cost?' }),
  'Artists keep 100% of their royalties. It is $2.49 per song if you choose.'
);
assert.strictEqual(
  reply.polish('1. Join free.\n2. Attest the rights.'),
  '1. Join free.\n2. Attest the rights.'
);
assert.ok(/Number only the real steps/.test(reply.FACTS));
assert.ok(/never as list item 1/.test(reply.FACTS));
assert.ok(/normal commas/.test(reply.FACTS));
assert.strictEqual(
  reply.polish('Use Suno for the beat. Then upload the song.'),
  'Then upload the song.'
);
assert.strictEqual(
  reply.polish("Pick Basic, it is free and covers a single song for life. Joining is free.", { ask: 'How much does it cost?' }),
  'Joining is free. ' + reply.PRICE
);
const already = reply.polish('Joining is free. Releasing a song costs 2.49 per song and that release is optional. Artists keep 100 percent of their royalties. There is no free Basic plan.', { ask: 'How much does it cost?' });
assert.strictEqual(already.match(/2\.49/g).length, 1);
assert.ok(!/free basic plan|song for life/i.test(already), already);
const cost = reply.polish('Sure.', { ask: 'How much does it cost?' });
assert.ok(cost.indexOf('$2.49') !== -1);
assert.ok(/optional/i.test(cost));
assert.ok(cost.indexOf('100%') !== -1);
assert.ok(/joining is free/i.test(cost));
assert.ok(!/free basic plan|song for life|no free release plan/i.test(cost), cost);
const parked = reply.polish('No, there is no free plan. What are you releasing?', { ask: 'Is there a free plan?' });
assert.ok(parked.startsWith('Joining is free, and Song Helper is a free co-writer.'), parked);
assert.strictEqual(parked.match(/no free release plan/gi).length, 1, parked);
assert.ok(!/free basic plan|song for life/i.test(parked), parked);
assert.ok(/\$2\.49 per song/.test(parked));
assert.ok(/What are you releasing\?$/.test(parked), parked);
const freePlan = reply.polish('You can look around.', { ask: 'Is there a free plan?' });
assert.ok(freePlan.startsWith('Joining is free, and Song Helper is a free co-writer.'), freePlan);
assert.strictEqual(freePlan.match(/no free release plan/gi).length, 1, freePlan);
assert.ok(!/free basic plan|song for life/i.test(freePlan), freePlan);
assert.ok(freePlan.indexOf('$2.49') !== -1);
assert.strictEqual(reply.polish(freePlan), freePlan);
const steps = reply.polish('1. Hey there, here is how it works.\n1. Pick a release date.\n2. Add metadata.\nWhat genre is it?', { ask: 'How do I release my first song?' });
assert.ok(steps.startsWith('Hey there, here is how it works.'), steps);
assert.strictEqual(steps.split('\n').filter(function (line) { return /^1\./.test(line); }).length, 1, steps);
assert.ok(steps.indexOf('1. Join free.') !== -1, steps);
assert.ok(steps.indexOf('2. Bring a song you already have, or write one.') !== -1, steps);
assert.ok(steps.indexOf('3. Attest the rights.') !== -1, steps);
assert.ok(steps.indexOf('4. Sign the split sheet.') !== -1, steps);
assert.ok(steps.indexOf('5. Review.') !== -1, steps);
assert.ok(/6\. Deliver\./.test(steps), steps);
assert.ok(!/release date|metadata|artwork/i.test(steps), steps);
assert.ok(!/free basic plan|song for life/i.test(steps), steps);
assert.ok(/What genre is it\?$/.test(steps), steps);
assert.strictEqual(reply.polish(steps), steps);
const doubled = reply.polish('1. Hey there, here is how it works.\n1. Join free.\n2. Attest the rights.');
assert.ok(doubled.startsWith('Hey there, here is how it works.'), doubled);
assert.ok(doubled.indexOf('\n1. Join free.') !== -1, doubled);
const cut = reply.polish("That's it. Yo", { truncated: true, ask: 'What should I bring?' });
assert.strictEqual(cut, "That's it.");
assert.ok(!/[—–]/.test(cut + cost + freePlan));

const coach = read('plai-coach.js');
const page = read('plai.html');
const session = read('api/plai-session.js');
assert.ok(page.includes('lib/plai-reply.js?v=20261017steps'));
assert.ok(page.includes('plai-coach.js?v=20261017steps'));
assert.ok(read('plai-coach.js').includes("bubble.style.whiteSpace = 'pre-line'"));
assert.ok(coach.includes("body: JSON.stringify({ agent: 'coach' })"));
assert.ok(coach.includes("body: JSON.stringify({ agent: 'coach', text: text })"));
assert.ok(!/session\.instructions|instructions:/.test(coach));
assert.ok(/Plai:\s*'PLAY'/.test(coach));
assert.ok(session.includes('reply.polish'));
assert.ok(session.includes('finish_reason'));
assert.ok(session.includes('reply.FACTS'));

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[key] = value; },
    end(chunk) { this.body = String(chunk || ''); },
  };
}

function mockReq(body) {
  const req = new EventEmitter();
  req.method = 'POST';
  req.headers = {};
  req.body = body;
  return req;
}

async function runHandler() {
  const handler = require('../api/plai-session');
  const originalFetch = global.fetch;
  const originalKey = process.env.XAI_API_KEY;
  process.env.XAI_API_KEY = 'test-session-key-not-for-commit';
  global.fetch = async function (url, opts) {
    assert.ok(String(url).indexOf('/chat/completions') !== -1);
    const sent = JSON.parse(opts.body);
    assert.ok(sent.max_tokens >= 500);
    assert.ok(sent.temperature >= 0.6);
    assert.ok(sent.messages[0].content.indexOf('$2.49') !== -1);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{
          finish_reason: 'length',
          message: { content: "I'm Play — pick Basic, it is free and covers a single song for life. That's it. Yo" },
        }],
      }),
    };
  };
  try {
    const res = mockRes();
    await handler(mockReq({ agent: 'coach', text: 'How much does it cost?' }), res);
    const body = JSON.parse(res.body);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(!/\bPlay\b/.test(body.reply), body.reply);
    assert.ok(body.reply.indexOf('$2.49') !== -1, body.reply);
    assert.ok(!/no free basic plan|song for life/i.test(body.reply), body.reply);
    assert.ok(!/[—–]/.test(body.reply), body.reply);
    assert.ok(!/\bYo$/.test(body.reply), body.reply);
    assert.ok(!/Suno|ToneGrid|YouTube/i.test(body.reply));
  } finally {
    global.fetch = originalFetch;
    if (originalKey == null) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = originalKey;
  }
}

runHandler().then(function () {
  console.log('plai-reply.test.js ok');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
