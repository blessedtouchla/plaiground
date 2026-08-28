'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function sliceBetween(src, startNeedle, endNeedle) {
  const start = src.indexOf(startNeedle);
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start !== -1 && end !== -1, 'missing slice ' + startNeedle);
  return src.slice(start, end);
}

function makeNode(tag) {
  const classSet = new Set();
  const node = {
    tagName: String(tag || 'div').toUpperCase(),
    className: '',
    textContent: '',
    hidden: false,
    disabled: false,
    children: [],
    parentNode: null,
    attrs: Object.create(null),
    listeners: Object.create(null),
    dataset: Object.create(null),
    style: {},
    value: '',
    _innerHTML: '',
    scrollTop: 0,
    scrollHeight: 0,
    setAttribute(key, value) {
      this.attrs[key] = String(value);
      if (key === 'id') this.id = String(value);
      if (key === 'class') this.className = String(value);
      if (key.slice(0, 5) === 'data-') {
        const camel = key.slice(5).replace(/-([a-z])/g, function (_, ch) { return ch.toUpperCase(); });
        this.dataset[camel] = String(value);
      }
    },
    getAttribute(key) {
      if (key === 'class') return this.className;
      return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null;
    },
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    addEventListener(type, fn) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(fn);
    },
    click() {
      const ev = {
        type: 'click',
        currentTarget: this,
        target: this,
        preventDefault: function () {},
      };
      (this.listeners.click || []).forEach(function (fn) { fn(ev); });
    },
    querySelector(sel) {
      return queryOne(this, sel);
    },
    querySelectorAll(sel) {
      const out = [];
      walk(this, function (n) {
        if (matches(n, sel)) out.push(n);
      });
      return out;
    },
  };
  Object.defineProperty(node, 'classList', {
    value: {
      add: function (name) { classSet.add(name); syncClass(); },
      remove: function (name) { classSet.delete(name); syncClass(); },
      contains: function (name) { return classSet.has(name); },
      toggle: function (name, on) {
        if (on === undefined) {
          if (classSet.has(name)) classSet.delete(name);
          else classSet.add(name);
        } else if (on) classSet.add(name);
        else classSet.delete(name);
        syncClass();
      },
    },
  });
  function syncClass() {
    const fromName = String(node.className || '').split(/\s+/).filter(Boolean);
    fromName.forEach(function (name) { classSet.add(name); });
    node.className = Array.from(classSet).join(' ');
  }
  Object.defineProperty(node, 'className', {
    get: function () { return this._className || ''; },
    set: function (value) {
      this._className = String(value || '');
      classSet.clear();
      String(value || '').split(/\s+/).filter(Boolean).forEach(function (name) { classSet.add(name); });
    },
  });
  Object.defineProperty(node, 'innerHTML', {
    get: function () { return node._innerHTML || ''; },
    set: function (value) {
      node._innerHTML = String(value);
      if (!value) node.children = [];
    },
  });
  return node;
}

function walk(node, visit) {
  if (!node || node.nodeType === 3) return;
  visit(node);
  (node.children || []).forEach(function (child) { walk(child, visit); });
}

function matches(node, sel) {
  if (!sel || !node || typeof node.getAttribute !== 'function') return false;
  if (sel.charAt(0) === '.') return String(node.className || '').split(/\s+/).indexOf(sel.slice(1)) !== -1;
  if (sel.charAt(0) === '#') return node.id === sel.slice(1);
  if (sel.indexOf('[data-mode="') === 0) {
    return node.getAttribute('data-mode') === sel.slice(12, -2);
  }
  return node.tagName === String(sel).toUpperCase();
}

function queryOne(root, sel) {
  let found = null;
  walk(root, function (n) {
    if (!found && matches(n, sel)) found = n;
  });
  return found;
}

function loadWidget(options) {
  options = options || {};
  const body = makeNode('body');
  const document = {
    readyState: 'complete',
    body: body,
    documentElement: makeNode('html'),
    createElement: makeNode,
    createTextNode: function (text) {
      return { nodeType: 3, textContent: String(text), parentNode: null };
    },
    getElementById: function (id) {
      return queryOne(body, '#' + id);
    },
    addEventListener: function () {},
  };
  const store = Object.create(null);
  const storage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { store[key] = String(value); },
    removeItem: function (key) { delete store[key]; },
  };
  const getUserMediaCalls = [];
  const sockets = [];
  function FakeWebSocket() {
    this.readyState = 1;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    sockets.push(this);
    const self = this;
    setImmediate(function () {
      if (typeof self.onopen === 'function') self.onopen();
    });
  }
  FakeWebSocket.OPEN = 1;
  FakeWebSocket.prototype.send = function (data) { this.sent.push(data); };
  FakeWebSocket.prototype.close = function () {
    this.readyState = 3;
    if (typeof this.onclose === 'function') this.onclose();
  };

  const context = {
    console: console,
    setTimeout: setTimeout,
    setImmediate: setImmediate,
    clearTimeout: clearTimeout,
    document: document,
    window: {
      AudioContext: function () {
        return {
          state: 'running',
          sampleRate: 24000,
          resume: function () { return Promise.resolve(); },
          createMediaStreamSource: function () { return { connect: function () {}, disconnect: function () {} }; },
          createScriptProcessor: function () { return { connect: function () {}, disconnect: function () {}, onaudioprocess: null }; },
          createGain: function () { return { gain: { value: 0 }, connect: function () {}, disconnect: function () {} }; },
          createBuffer: function () { return { getChannelData: function () { return []; } }; },
          createBufferSource: function () { return { connect: function () {}, start: function () {}, stop: function () {}, disconnect: function () {} }; },
          destination: {},
        };
      },
      addEventListener: function () {},
    },
    sessionStorage: storage,
    WebSocket: FakeWebSocket,
    navigator: {
      mediaDevices: {
        getUserMedia: function (constraints) {
          getUserMediaCalls.push(constraints);
          if (options.denyMic) return Promise.reject(new Error('denied'));
          return Promise.resolve({ getTracks: function () { return []; } });
        },
      },
    },
    fetch: function (url, init) {
      const method = (init && init.method) || 'GET';
      if (String(url).indexOf('/api/plai-session') !== -1) {
        if (method === 'GET') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: function () { return Promise.resolve({ configured: true }); },
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: function () { return Promise.resolve({ value: 'test-token' }); },
        });
      }
      return Promise.reject(new Error('unexpected fetch ' + url));
    },
    atob: function () { return ''; },
    btoa: function () { return ''; },
    encodeURIComponent: encodeURIComponent,
  };
  context.window.document = document;
  context.window.sessionStorage = storage;
  context.window.WebSocket = FakeWebSocket;
  context.window.navigator = context.navigator;
  context.window.fetch = context.fetch;
  vm.runInNewContext(read('plai-bubble.js'), context, { filename: 'plai-bubble.js' });
  return {
    document: document,
    getUserMediaCalls: getUserMediaCalls,
    sockets: sockets,
    root: function () { return document.getElementById('plai-bubble'); },
    pill: function (mode) { return queryOne(body, '[data-mode="' + mode + '"]'); },
    statusText: function () {
      const status = queryOne(body, '.plai-bubble-status');
      if (!status) return '';
      return status.children.map(function (child) { return child.textContent || ''; }).join(' ');
    },
  };
}

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function runStatic() {
  const js = read('plai-bubble.js');
  const css = read('plai-bubble.css');
  const session = read('api/plai-session.js');
  const faq = read('faq.html');
  const apiFiles = fs.readdirSync(path.join(__dirname, 'api'));

  assert.ok(js.includes("text: 'Talk to PLAI'"), 'Talk to PLAI button stays');
  assert.ok(js.includes("text: 'Text PLAI'"), 'Text PLAI button stays');
  assert.ok(js.includes("'data-mode': 'talk'") && js.includes("'data-mode': 'text'"), 'pills are tagged by mode');
  assert.ok(js.includes('is-talk') && js.includes('is-text'), 'two distinct pills');
  assert.ok(js.includes("openMode(mode === 'talk')"), 'Talk label is the only path that turns the mic on');
  assert.ok(!/talkPill\.addEventListener\('click', function \(\) \{ openMode\(false\)/.test(js), 'Talk pill is not bound to text mode');
  assert.ok(!/textPill\.addEventListener\('click', function \(\) \{ openMode\(true\)/.test(js), 'Text pill is not bound to voice mode');

  const talkDecl = sliceBetween(js, "talkPill = el('button'", 'textPill = el(');
  assert.ok(talkDecl.includes("'data-mode': 'talk'"), 'Talk markup is data-mode=talk');
  assert.ok(talkDecl.includes("text: 'Talk to PLAI'"), 'Talk label stays on the talk pill');
  assert.ok(talkDecl.includes('is-talk'), 'Talk chrome stays on the talk pill');

  const textDecl = sliceBetween(js, "textPill = el('button'", 'panel.id');
  assert.ok(textDecl.includes("'data-mode': 'text'"), 'Text markup is data-mode=text');
  assert.ok(textDecl.includes("text: 'Text PLAI'"), 'Text label stays on the text pill');
  assert.ok(textDecl.includes('is-text'), 'Text chrome stays on the text pill');

  const playDelta = sliceBetween(js, 'function playDelta', 'function sendAppend');
  assert.ok(playDelta.includes('!wantMic'), 'Text PLAI must not play voice audio');

  const handleAudio = sliceBetween(js, "event.type === 'response.output_audio.delta'", "event.type === 'response.done'");
  assert.ok(handleAudio.includes('if (!wantMic) return'), 'Talking chrome is voice-only');

  const startTalk = sliceBetween(js, 'async function startTalk', 'function isLive');
  assert.ok(startTalk.includes('if (wantMic)'), 'startTalk only captures when Talk was chosen');
  assert.ok(startTalk.includes('stopCapture()'), 'Text path stops/skips the mic');
  assert.ok(startTalk.includes('Allow the microphone to Talk to PLAI.'), 'Talk does not fake a Text PLAI header if the mic is denied');
  assert.ok(!startTalk.includes("setState('text')") || startTalk.indexOf('if (wantMic)') < startTalk.indexOf("setState(restoring"), 'Talk start does not open as Text PLAI');

  assert.ok(js.includes("AGENT_ID = 'agent_BDVzp3Ar3ABtyov5'"), 'keeps the Voice Agent Builder agent');
  assert.ok(js.includes('/api/plai-session'), 'reuses the existing session route');
  assert.ok(/PLAI:\s*'PLAY'/.test(js) && /Plai:\s*'PLAY'/.test(js) && /plai:\s*'PLAY'/.test(js), 'spoken PLAI / Plai / plai is PLAY');
  assert.ok(/"I'm PLAI":\s*"I'm PLAY"/.test(js), 'spoken I\'m PLAI is I\'m PLAY');
  assert.ok(!/session\.instructions|instructions:/.test(js), 'frontend must not set Voice Agent instructions');
  const sessionUpdate = sliceBetween(js, 'function configureSession', 'function seedHistory');
  assert.ok(!/buy a car at the click of a button/i.test(sessionUpdate), 'voice session must not dump the FAQ intro');
  assert.ok(!/Meet PLAI/i.test(sessionUpdate), 'voice session must not dump the Meet PLAI FAQ lead');
  assert.ok(!/session\.instructions|instructions:/.test(sessionUpdate), 'configureSession must not set Voice Agent instructions');
  assert.ok(js.includes('sounds like PLAY'), 'visible name stays PLAI with PLAY hint');
  assert.ok(!js.includes('XAI_API_KEY'), 'frontend must not contain XAI_API_KEY');
  assert.ok(!js.includes('ELEVEN') && !/elevenlabs/i.test(js), 'no ElevenLabs');
  assert.ok(!js.includes('tgk_'), 'do not invent a ToneGrid key');
  assert.ok(js.indexOf('getUserMedia') === js.lastIndexOf('getUserMedia'), 'getUserMedia lives in one place');
  assert.ok(js.indexOf('async function startCapture') < js.indexOf('getUserMedia'), 'mic is only requested inside startCapture');

  assert.ok(css.includes('.plai-bubble-pill.is-text'), 'Text PLAI has its own chrome');
  assert.ok(css.includes('.plai-bubble-hint'), 'PLAY pronunciation hint is styled');
  const siteCss = read('site.css');
  assert.ok(siteCss.includes('body.app > .plai-bubble'), 'signed-in chrome keeps Talk/Text PLAI on screen');
  assert.ok(!/body\.auth-full \.plai-bubble\s*\{\s*display:\s*none/.test(siteCss), 'login/signup must not hide Talk/Text PLAI');
  ['dashboard.html', 'faq.html', 'earnings.html', 'boosts.html', 'playlists.html', 'charts.html', 'social-ads.html', 'video-collect.html'].forEach(function (file) {
    const html = read(file);
    assert.ok(html.includes('plai-bubble.js'), file + ' must load Talk/Text PLAI');
  });

  assert.ok(session.includes('process.env.XAI_API_KEY'), 'session route keeps the server key');
  assert.ok(session.includes("method === 'GET'"), 'GET still reports configured without minting');
  assert.strictEqual(apiFiles.filter((name) => name.endsWith('.js')).length, 6, 'no new api/*.js files');

  assert.ok(faq.includes('Talk to PLAI') && faq.includes('Text PLAI'), 'FAQ still names both buttons');
  assert.ok(/type only, no mic/i.test(faq), 'FAQ Text PLAI copy stays');
  assert.ok(/pronounced[\s\S]*PLAY/i.test(faq) && /she\/her/i.test(faq), 'FAQ PLAY / she-her copy stays');
  assert.ok(faq.indexOf('Frequently asked questions') < faq.indexOf('Talk to PLAI'), 'FAQ PLAI pointer is not the page lead');
  assert.ok(!/Meet PLAI/i.test(faq) && !/<h1>What is PLAI\?<\/h1>/.test(faq), 'FAQ no longer opens as the voice-agent intro');

  const frontend = [
    'plai-bubble.js',
    'plai-bubble.css',
    'index.html',
    'faq.html',
    'plai.html',
    'plai-coach.js',
    'site.js',
    'checkout.js',
  ];
  frontend.forEach(function (file) {
    const text = read(file);
    assert.ok(!text.includes('XAI_API_KEY'), file + ' must not leak XAI_API_KEY');
    assert.ok(!text.includes('tgk_'), file + ' must not invent a ToneGrid key');
    assert.ok(!/elevenlabs/i.test(text), file + ' must not add ElevenLabs');
  });
}

function runClicks() {
  const textUi = loadWidget();
  return wait(20).then(function () {
    const text = textUi.pill('text');
    const talk = textUi.pill('talk');
    assert.ok(text && talk, 'both pills mount');
    assert.strictEqual(text.querySelector('.plai-bubble-label').textContent, 'Text PLAI');
    assert.strictEqual(talk.querySelector('.plai-bubble-label').textContent, 'Talk to PLAI');
    text.click();
    return wait(40);
  }).then(function () {
    assert.strictEqual(textUi.getUserMediaCalls.length, 0, 'Text PLAI must not activate the mic');
    assert.ok(/Text PLAI/.test(textUi.statusText()), 'Text PLAI keeps the type-only header');
    assert.ok(/Mic is off/.test(textUi.statusText()), 'Text PLAI says the mic stays off');
    assert.strictEqual(textUi.pill('text').getAttribute('aria-expanded'), 'true');
    assert.strictEqual(textUi.pill('talk').getAttribute('aria-expanded'), 'false');

    const voice = loadWidget();
    return wait(20).then(function () {
      voice.pill('talk').click();
      return wait(40);
    }).then(function () {
      assert.ok(voice.getUserMediaCalls.length >= 1, 'Talk to PLAI activates the mic');
      assert.ok(!/Mic is off/.test(voice.statusText()), 'Talk to PLAI does not open the Text PLAI header');

      const denied = loadWidget({ denyMic: true });
      return wait(20).then(function () {
        denied.pill('talk').click();
        return wait(40);
      }).then(function () {
        assert.ok(/microphone/i.test(denied.statusText()), 'denied mic stays a Talk error, not Text PLAI');
        assert.ok(!/Mic is off/.test(denied.statusText()), 'denied Talk does not masquerade as Text PLAI');
      });
    });
  });
}

function run() {
  runStatic();
  return runClicks().then(function () {
    console.log('plai-bubble.test.js ok');
  });
}

Promise.resolve(run()).catch(function (err) {
  console.error(err);
  process.exit(1);
});
