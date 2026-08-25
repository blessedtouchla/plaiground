'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function coachCss(src) {
  const start = src.indexOf('/* PLAI Coach:');
  assert.ok(start !== -1, 'coach layout CSS is marked as layout-only');
  return src.slice(start);
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[key] = value; },
    end(chunk) { this.body = String(chunk || ''); },
  };
}

function mockReq(method, body) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = {};
  if (body && typeof body === 'object') req.body = body;
  return req;
}

async function runSession() {
  const handler = require('./api/plai-session');
  const originalFetch = global.fetch;
  const originalKey = process.env.XAI_API_KEY;
  process.env.XAI_API_KEY = 'test-session-key-not-for-commit';
  global.fetch = async function () {
    return {
      ok: true,
      status: 200,
      json: async () => ({ value: 'ephemeral-test-token' }),
    };
  };
  try {
    const talk = mockRes();
    await handler(mockReq('POST', {}), talk);
    const talkBody = JSON.parse(talk.body);
    assert.strictEqual(talk.statusCode, 200);
    assert.strictEqual(talkBody.value, 'ephemeral-test-token');
    assert.ok(!talkBody.realtime_url, 'Talk/Text mint does not attach the coach socket');

    const coach = mockRes();
    await handler(mockReq('POST', { agent: 'coach' }), coach);
    const coachBody = JSON.parse(coach.body);
    assert.strictEqual(coach.statusCode, 200);
    assert.strictEqual(coachBody.value, 'ephemeral-test-token');
    assert.ok(coachBody.realtime_url.indexOf('agent_9BWdEFlNcpLwxoQR') !== -1, 'coach mint binds the coach agent on the server');
    assert.ok(coachBody.realtime_url.indexOf('agent_BDVzp3Ar3ABtyov5') === -1, 'coach mint does not use the Talk agent');

    const get = mockRes();
    await handler(mockReq('GET'), get);
    assert.strictEqual(get.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(get.body), { configured: true });
  } finally {
    global.fetch = originalFetch;
    if (originalKey == null) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = originalKey;
  }
}

function runStatic() {
  const page = read('plai.html');
  const index = read('index.html');
  const css = read('site.css');
  const coach = coachCss(css);
  const coachJs = read('plai-coach.js');
  const session = read('api/plai-session.js');
  const bubbleJs = read('plai-bubble.js');
  const bubbleCss = read('plai-bubble.css');

  assert.ok(page.includes('class="plai-coach-identity"'), 'coach page has the PLAI identity');
  assert.ok(/<h1>\s*PLAI\s*<\/h1>/.test(page), 'written name is PLAI');
  assert.ok(!/<h1>\s*PLAY\s*<\/h1>/.test(page), 'do not rename her PLAY on the page');
  assert.ok(page.includes('Your Release Coach'), 'subtitle is Your Release Coach');
  assert.ok(page.includes('class="card plai-coach-chat"'), 'chat shell reuses the site card');
  assert.ok(page.includes('data-plai-coach-talk'), 'coach page has a Talk control');
  assert.ok(page.includes('data-plai-coach-form'), 'coach page has the text form');
  assert.ok(page.includes('src="plai-coach.js"'), 'coach page loads the coach session client');
  assert.ok(page.includes('plai-bubble.js'), 'Talk/Text PLAI still load on the coach page');
  assert.ok(page.includes('class="card plai-coach-plan"'), 'Action Plan reuses the site card');
  assert.ok(page.includes('id="plai-action-plan-title">Action Plan</h2>'), 'Action Plan is labeled');
  const plan = page.match(/class="card plai-coach-plan"[\s\S]*?<\/section>/)[0];
  assert.ok(!/<li\b/.test(plan) && !/Once we talk/i.test(plan), 'Action Plan stays empty for later');

  assert.ok(page.includes('header class="nav"'), 'logged-out chrome uses the public header');
  assert.ok(page.includes('class="side"'), 'signed-in chrome-swap keeps the app sidebar');
  assert.ok(!/href="plai.html">PLAI<\/a>/.test(page.match(/<nav class="side-nav">[\s\S]*?<\/nav>/)[0]), 'do not add PLAI Coach to the signed-in product menu');
  assert.ok(!/buy a car at the click of a button/i.test(page), 'coach page must not dump the FAQ car-click essay');
  assert.ok(!/Hey\. I'm PLAI/i.test(page), 'do not paste a first chat bubble');
  assert.ok(!/Real AI coming soon/i.test(page) && !/function sendMessage/.test(page), 'do not ship a fake sendMessage AI');
  assert.ok(!/<style[\s>]/.test(page), 'do not paste standalone inline page styles');

  assert.ok(index.includes('data-plai-coach-float'), 'homepage has the circular PLAI float');
  assert.ok(index.includes('Need help getting your track out?'), 'homepage popup copy is locked');
  assert.ok(/href="plai.html">Talk to PLAI<\/a>/.test(index), 'homepage popup links to the coach page');
  const floatBlock = css.match(/\.plai-coach-float\s*\{[\s\S]*?\}/);
  assert.ok(floatBlock && /bottom:\s*92px/.test(floatBlock[0]), 'homepage float sits above the Talk/Text pair');

  ['faq.html', 'how-it-works.html', 'dashboard.html', 'about.html', 'contact.html'].forEach(function (file) {
    assert.ok(!read(file).includes('data-plai-coach-float'), file + ' must not get the homepage-only coach float');
  });

  assert.ok(bubbleJs.includes("AGENT_ID = 'agent_BDVzp3Ar3ABtyov5'"), 'Talk/Text stay on the existing voice agent');
  assert.ok(bubbleJs.includes("text: 'Talk to PLAI'") && bubbleJs.includes("text: 'Text PLAI'"), 'Talk/Text labels stay');
  assert.ok(!bubbleJs.includes('agent_9BWdEFlNcpLwxoQR'), 'Talk/Text must not switch to the coach agent');
  assert.ok(session.includes("COACH_AGENT_ID = 'agent_9BWdEFlNcpLwxoQR'"), 'coach agent id lives on the server');
  assert.ok(session.includes("body.agent === 'coach'"), 'coach mint is selected from the POST body');
  assert.ok(coachJs.includes("body: JSON.stringify({ agent: 'coach' })"), 'coach client asks the server for the coach agent');
  assert.ok(coachJs.includes('/api/plai-session'), 'coach client reuses the existing session route');
  assert.ok(!coachJs.includes('agent_9BWdEFlNcpLwxoQR'), 'frontend must not hardcode the coach agent id');
  assert.ok(!coachJs.includes('XAI_API_KEY') && !page.includes('XAI_API_KEY'), 'coach frontend must not leak XAI_API_KEY');
  assert.ok(!/session\.instructions|instructions:/.test(coachJs), 'coach client must not set Voice Agent instructions');
  assert.ok(/PLAI:\s*'PLAY'/.test(coachJs), 'spoken PLAI is PLAY');
  assert.ok(bubbleCss.includes('.plai-bubble-pill.is-text'), 'Talk/Text chrome file was not replaced');

  assert.ok(page.includes('assets/plai-avatar.png') && index.includes('assets/plai-avatar.png'), 'avatar slot points at plai-avatar.png');
  assert.ok(!/linear-gradient/.test(coach), 'do not add a second gradient system for PLAI');
  assert.ok(!/#d03083|#782fb1|#f3cb47|#0a0a0f|#12121a|#1e1e2e/.test(coach), 'do not paste her standalone palette');

  ['plai.html', 'index.html', 'plai-coach.js', 'plai-bubble.js', 'plai-bubble.css', 'site.js'].forEach(function (file) {
    const text = read(file);
    assert.ok(!text.includes('XAI_API_KEY'), file + ' must not leak XAI_API_KEY');
    assert.ok(!/elevenlabs/i.test(text), file + ' must not add ElevenLabs');
    assert.ok(!text.includes('agent_9BWdEFlNcpLwxoQR'), file + ' must not hardcode the coach agent');
  });
  assert.ok(!/ToneGrid|Tonegrid/.test(page.replace(/<script\b[\s\S]*?<\/script>/gi, '')), 'no ToneGrid in coach page copy');
}

async function run() {
  runStatic();
  await runSession();
  console.log('plai-coach.page.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
