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
assert.ok(/no free Basic plan/i.test(reply.FACTS));
assert.ok(!/[—–]/.test(reply.FACTS + reply.PRICE));
assert.ok(/Never name Suno, ToneGrid, or YouTube/.test(reply.FACTS));
assert.ok(!/Suno|ToneGrid|YouTube/i.test(reply.PRICE));

assert.strictEqual(reply.polish("I'm Play. Play the song when you are ready."), "I'm Plai. Play the song when you are ready.");
assert.strictEqual(reply.polish('I am PLAY.'), 'I am Plai.');
assert.strictEqual(reply.polish('Hello — there.'), 'Hello, there.');
assert.strictEqual(reply.polish('Hello – there.'), 'Hello, there.');
assert.strictEqual(
  reply.polish('Use Suno for the beat. Then upload the song.'),
  'Then upload the song.'
);
assert.strictEqual(
  reply.polish("Pick Basic, it is free and covers a single song for life. Joining is free.", { ask: 'How much does it cost?' }),
  'Joining is free. ' + reply.PRICE
);
const cost = reply.polish('Sure.', { ask: 'How much does it cost?' });
assert.ok(cost.indexOf('$2.49') !== -1);
assert.ok(/optional/i.test(cost));
assert.ok(cost.indexOf('100%') !== -1);
assert.ok(/joining is free/i.test(cost));
const freePlan = reply.polish('You can look around.', { ask: 'Is there a free plan?' });
assert.ok(/no free Basic plan/i.test(freePlan));
assert.ok(freePlan.indexOf('$2.49') !== -1);
const cut = reply.polish("That's it. Yo", { truncated: true, ask: 'How do I release my first song?' });
assert.strictEqual(cut, "That's it.");
assert.ok(!/[—–]/.test(cut + cost + freePlan));

const coach = read('plai-coach.js');
const page = read('plai.html');
const session = read('api/plai-session.js');
assert.ok(page.includes('lib/plai-reply.js?v=20261017plai'));
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
    assert.ok(/no free Basic plan/i.test(body.reply), body.reply);
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
