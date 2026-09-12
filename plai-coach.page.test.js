'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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

  const welcome = index.match(/data-plai-coach-float[\s\S]*?<\/div>\s*<script src="membership\.js">/);
  assert.ok(index.includes('data-plai-coach-float'), 'homepage has the circular PLAI float');
  assert.ok(welcome, 'homepage welcome is the existing PLAI girl card');
  assert.ok(/Is it your first time here\?/.test(welcome[0]), 'homepage welcome copy is locked');
  assert.ok(/Feel free to click Talk/.test(welcome[0]) && /or Text to ask/.test(welcome[0]), 'welcome points at Talk and Text');
  assert.ok(/uploading your first song/.test(welcome[0]), 'welcome mentions uploading a first song');
  assert.ok(/data-plai-talk[^>]*>Talk</.test(welcome[0]), 'welcome Talk opens the existing Talk path');
  assert.ok(/data-plai-text[^>]*>Text</.test(welcome[0]), 'welcome Text opens the existing Text path');
  assert.ok(/data-plai-welcome-dismiss/.test(welcome[0]) && /Got it</.test(welcome[0]), 'welcome is dismissible');
  assert.ok(!/href="plai\.html"/.test(welcome[0]), 'welcome must not invent a new public bot page');
  assert.ok(!/Need help getting your track out\?/.test(index), 'old always-on nag copy is gone');
  assert.ok(!/ToneGrid|Tonegrid|DistroKid|chart|stream/i.test(welcome[0]), 'welcome must not promise charts or name distributors');
  assert.ok(!/Capacitor|App Store|hop\/submit/i.test(welcome[0]), 'welcome must not invent hop or store work');
  assert.ok(index.includes('plai-welcome.js?v=20260912w1'), 'homepage cache-busts the welcome script at 20260912w1');
  assert.ok(index.includes('site.css?v=20260912ae1'), 'homepage cache-busts site.css at 20260912ae1');
  assert.ok(index.includes('site.js?v=20260912w1'), 'homepage cache-busts site.js at 20260912w1');
  assert.ok(!index.includes('site.css?v=20260912w1'), 'homepage must cache-bust past 20260912w1');
  assert.ok(!index.includes('site.css?v=20260912w2'), 'homepage must cache-bust past 20260912w2');
  const floatBlock = css.match(/\.plai-coach-float\s*\{[\s\S]*?\}/);
  assert.ok(floatBlock && /bottom:\s*92px/.test(floatBlock[0]), 'homepage float sits above the Talk/Text pair');
  assert.ok(css.includes('.plai-coach-float-close'), 'welcome close control is styled');
  assert.ok(css.includes('.plai-coach-float-actions'), 'welcome Talk/Text row is styled');

  ['faq.html', 'how-it-works.html', 'dashboard.html', 'about.html', 'contact.html', 'upload.html'].forEach(function (file) {
    const html = read(file);
    assert.ok(!html.includes('data-plai-coach-float'), file + ' must not get the homepage-only coach float');
    assert.ok(!html.includes('plai-welcome.js'), file + ' must not load the first-visit welcome');
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

  ['plai.html', 'index.html', 'plai-coach.js', 'plai-bubble.js', 'plai-bubble.css', 'site.js', 'plai-welcome.js'].forEach(function (file) {
    const text = read(file);
    assert.ok(!text.includes('XAI_API_KEY'), file + ' must not leak XAI_API_KEY');
    assert.ok(!/elevenlabs/i.test(text), file + ' must not add ElevenLabs');
    assert.ok(!text.includes('agent_9BWdEFlNcpLwxoQR'), file + ' must not hardcode the coach agent');
  });
  assert.ok(!/ToneGrid|Tonegrid/.test(page.replace(/<script\b[\s\S]*?<\/script>/gi, '')), 'no ToneGrid in coach page copy');
  const welcomeJs = read('plai-welcome.js');
  assert.ok(welcomeJs.includes("STORAGE_KEY = 'plaiground.plai-welcome-dismissed'"), 'welcome remembers dismiss in localStorage');
  assert.ok(welcomeJs.includes("COOKIE_NAME = 'plai_welcome_dismissed'"), 'welcome also remembers dismiss in a cookie');
  assert.ok(welcomeJs.includes('data-plai-talk') && welcomeJs.includes('data-plai-text'), 'welcome Talk/Text stay on the site bubble paths');
}

function makeBtn(attrs) {
  const node = {
    attrs: Object.assign({}, attrs || {}),
    listeners: Object.create(null),
    setAttribute(key, value) { this.attrs[key] = String(value); },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null; },
    addEventListener(type, fn) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(fn);
    },
    click(event) {
      const ev = event || { preventDefault: function () {}, stopPropagation: function () {} };
      (this.listeners.click || []).forEach(function (fn) { fn(ev); });
    },
  };
  return node;
}

function loadWelcome(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.storage || {});
  let cookie = opts.cookie || '';
  const closeBtn = makeBtn({ 'data-plai-welcome-dismiss': '' });
  const gotIt = makeBtn({ 'data-plai-welcome-dismiss': '' });
  const talk = makeBtn({ 'data-plai-talk': '' });
  const text = makeBtn({ 'data-plai-text': '' });
  const details = {
    open: false,
    listeners: Object.create(null),
    addEventListener(type, fn) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(fn);
    },
  };
  const root = {
    hidden: true,
    attrs: Object.create(null),
    setAttribute(key, value) { this.attrs[key] = String(value); },
    querySelector(sel) { return sel === 'details' ? details : null; },
    querySelectorAll(sel) {
      if (sel === '[data-plai-welcome-dismiss]') return [closeBtn, gotIt];
      if (sel === '[data-plai-talk], [data-plai-text]') return [talk, text];
      return [];
    },
  };
  const docListeners = Object.create(null);
  const document = {
    get cookie() { return cookie; },
    set cookie(value) {
      const bit = String(value || '').split(';')[0];
      const eq = bit.indexOf('=');
      const name = eq === -1 ? bit : bit.slice(0, eq);
      const rest = cookie ? cookie.split('; ') : [];
      const next = rest.filter(function (part) { return part.indexOf(name + '=') !== 0; });
      next.push(bit);
      cookie = next.join('; ');
    },
    querySelector(sel) { return sel === '[data-plai-coach-float]' ? root : null; },
    addEventListener(type, fn) {
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push(fn);
    },
  };
  const membership = opts.membership || {
    isSignedIn: function () { return false; },
  };
  vm.runInNewContext(read('plai-welcome.js'), {
    window: {
      localStorage: {
        getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
        setItem: function (key, value) { store[key] = String(value); },
      },
      PlaigroundMembership: membership,
    },
    document: document,
  });
  return {
    root: root,
    details: details,
    closeBtn: closeBtn,
    gotIt: gotIt,
    talk: talk,
    text: text,
    store: store,
    cookie: function () { return cookie; },
    keydown: function (key) {
      const ev = { key: key };
      (docListeners.keydown || []).forEach(function (fn) { fn(ev); });
    },
  };
}

function runWelcome() {
  const first = loadWelcome();
  assert.strictEqual(first.root.hidden, false, 'fresh first visit shows the welcome');
  assert.strictEqual(first.details.open, true, 'fresh first visit pops the PLAI card');
  assert.strictEqual(first.root.attrs['data-plai-welcome-state'], 'open');

  first.closeBtn.click();
  assert.strictEqual(first.root.hidden, true, 'X dismisses the welcome');
  assert.strictEqual(first.store['plaiground.plai-welcome-dismissed'], '1');
  assert.ok(/plai_welcome_dismissed=1/.test(first.cookie()), 'dismiss writes the cookie too');

  const again = loadWelcome({ storage: { 'plaiground.plai-welcome-dismissed': '1' } });
  assert.strictEqual(again.root.hidden, true, 'dismissed visitors do not get the nag again');
  assert.strictEqual(again.details.open, false);

  const cookied = loadWelcome({ cookie: 'plai_welcome_dismissed=1' });
  assert.strictEqual(cookied.root.hidden, true, 'cookie dismiss also stops the nag');

  const signedIn = loadWelcome({
    membership: { isSignedIn: function () { return true; } },
  });
  assert.strictEqual(signedIn.root.hidden, true, 'signed-in homepage must not pop the first-visit welcome');
  assert.ok(!signedIn.store['plaiground.plai-welcome-dismissed'], 'signed-in hide is not a forever dismiss');

  const talk = loadWelcome();
  talk.talk.click();
  assert.strictEqual(talk.root.hidden, true, 'Talk dismisses the welcome so it does not cover the page');
  assert.strictEqual(talk.store['plaiground.plai-welcome-dismissed'], '1');

  const text = loadWelcome();
  text.text.click();
  assert.strictEqual(text.store['plaiground.plai-welcome-dismissed'], '1', 'Text also stops the nag');

  const got = loadWelcome();
  got.gotIt.click();
  assert.strictEqual(got.root.hidden, true, 'Got it dismisses forever');

  const esc = loadWelcome();
  esc.keydown('Escape');
  assert.strictEqual(esc.root.hidden, true, 'Escape dismisses the welcome');
  assert.strictEqual(esc.store['plaiground.plai-welcome-dismissed'], '1');
}

async function run() {
  runStatic();
  runWelcome();
  await runSession();
  console.log('plai-coach.page.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
