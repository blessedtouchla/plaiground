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
    node._className = Array.from(classSet).join(' ');
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
    querySelector: function (sel) {
      return queryOne(body, sel);
    },
    querySelectorAll: function (sel) {
      const out = [];
      walk(body, function (n) {
        if (matches(n, sel)) out.push(n);
      });
      return out;
    },
    listeners: Object.create(null),
    addEventListener: function (type, fn) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(fn);
    },
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
      matchMedia: function (query) {
        return {
          matches: Boolean(options.phone) && /max-width:\s*720px/.test(String(query)),
          media: String(query),
          addEventListener: function () {},
          removeEventListener: function () {},
          addListener: function () {},
          removeListener: function () {},
        };
      },
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
    chip: function () { return queryOne(body, '.plai-bubble-chip'); },
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
  assert.ok(css.includes('.plai-bubble-chip'), 'phone collapse uses a PLAI chip');
  assert.ok(js.includes("text: 'PLAI'") && js.includes('plai-bubble-chip'), 'chip label stays PLAI');
  assert.ok(!/plai-bubble-chip[\s\S]{0,400}PLAY/.test(js), 'do not rename the chip PLAY');
  assert.ok(!/plai-avatar\.png/.test(js) && !/plai-avatar\.png/.test(css), 'do not put the girl PNG on the signed-in bubble');
  assert.ok(js.includes("PHONE_MQ = '(max-width: 720px)'"), 'phone collapse matches the 720px breakpoint');

  const phoneCss = css.match(/@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*$/);
  assert.ok(phoneCss, 'phone chrome lives in a 720px query');
  assert.ok(/\.plai-bubble\s*\{[\s\S]*?top:\s*92px/.test(phoneCss[0]), 'phone bubble sits top-right');
  assert.ok(/\.plai-bubble\s*\{[\s\S]*?bottom:\s*auto/.test(phoneCss[0]), 'phone bubble is not pinned to the bottom');
  assert.ok(/\.plai-bubble-chip\s*\{[\s\S]*?display:\s*inline-flex/.test(phoneCss[0]), 'phone shows the PLAI chip');
  assert.ok(/\.plai-bubble-row\s*\{[\s\S]*?display:\s*none/.test(phoneCss[0]), 'phone hides the Talk/Text pair until the chip opens');
  assert.ok(/\.plai-bubble\.is-menu-open \.plai-bubble-row/.test(phoneCss[0]), 'open chip reveals Talk/Text as a menu');
  assert.ok(!/bottom:\s*1?2px/.test(phoneCss[0]), 'phone Talk/Text must not sit on Submit');

  const desktopBubble = css.match(/\.plai-bubble\s*\{[\s\S]*?\}/);
  assert.ok(desktopBubble && /bottom:\s*24px/.test(desktopBubble[0]) && /right:\s*24px/.test(desktopBubble[0]), 'desktop keeps Talk/Text bottom-right');
  const desktopChip = css.match(/\.plai-bubble-chip\s*\{[\s\S]*?\}/);
  assert.ok(desktopChip && /display:\s*none/.test(desktopChip[0]), 'desktop does not show the PLAI chip');

  const siteCss = read('site.css');
  assert.ok(siteCss.includes('body.app > .plai-bubble'), 'signed-in chrome keeps Talk/Text PLAI on screen');
  assert.ok(!/body\.auth-full \.plai-bubble\s*\{\s*display:\s*none/.test(siteCss), 'login/signup must not hide Talk/Text PLAI');
  assert.ok(!/body\.app\s*>\s*\.plai-bubble\s*\{[^}]*bottom:\s*12px/.test(siteCss), 'signed-in phone chrome must not pin Talk/Text over bottom CTAs');
  const sitePhone = siteCss.match(/@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*?body\.app\s*>\s*\.plai-bubble[\s\S]*?\}/);
  assert.ok(sitePhone && /top:\s*92px/.test(sitePhone[0]) && /bottom:\s*auto/.test(sitePhone[0]), 'signed-in phone bubble stays top-right');
  assert.ok(!read('upload.html').includes('data-plai-coach-float'), 'signed-in submit must not get the landing girl');
  assert.ok(!read('upload.html').includes('plai-avatar.png'), 'signed-in submit must not load the girl PNG');
  ['dashboard.html', 'faq.html', 'earnings.html', 'boosts.html', 'chart-push.html', 'streaming-push.html', 'social-push.html', 'video-collect.html'].forEach(function (file) {
    const html = read(file);
    assert.ok(html.includes('plai-bubble.js'), file + ' must load Talk/Text PLAI');
  });
  assert.ok(read('dashboard.html').includes('data-plai-talk'), 'Overview has a Talk to PLAI CTA');
  assert.ok(/data-plai-talk[^>]*>Talk to PLAI</.test(read('dashboard.html')), 'Overview Talk CTA is written PLAI');
  assert.ok(read('plai-bubble.js').includes('data-plai-talk'), 'Talk CTA opens the existing voice agent');
  assert.ok(read('plai-bubble.js').includes('data-plai-text'), 'Troubleshoot opens the existing Text PLAI');
  assert.ok(/data-plai-text[^>]*>Troubleshoot</.test(faq), 'FAQ Troubleshoot is written Troubleshoot');
  assert.ok(!/data-plai-talk[^>]*>Troubleshoot</.test(faq), 'FAQ Troubleshoot must not open Talk to PLAI');
  assert.ok(!read('dashboard.html').includes('XAI_API_KEY'), 'Overview must not leak XAI_API_KEY');

  assert.ok(session.includes('process.env.XAI_API_KEY'), 'session route keeps the server key');
  assert.ok(session.includes("method === 'GET'"), 'GET still reports configured without minting');
  assert.strictEqual(apiFiles.filter((name) => name.endsWith('.js')).length, 7, 'no new api/*.js files');

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

function runPhoneChrome() {
  const desktop = loadWidget();
  return wait(20).then(function () {
    const root = desktop.root();
    const chip = desktop.chip();
    assert.ok(root && chip, 'desktop still mounts the bubble and chip node');
    assert.ok(!root.classList.contains('is-phone'), 'desktop does not collapse to the phone chip');
    assert.ok(!root.classList.contains('is-menu-open'), 'desktop does not open a phone menu');
    assert.strictEqual(chip.querySelector('.plai-bubble-label').textContent, 'PLAI');
    assert.ok(desktop.pill('talk') && desktop.pill('text'), 'desktop keeps the Talk + Text pair');
    assert.strictEqual(desktop.pill('talk').querySelector('.plai-bubble-label').textContent, 'Talk to PLAI');
    assert.strictEqual(desktop.pill('text').querySelector('.plai-bubble-label').textContent, 'Text PLAI');

    const phone = loadWidget({ phone: true });
    return wait(20).then(function () {
      const phoneRoot = phone.root();
      const phoneChip = phone.chip();
      assert.ok(phoneRoot.classList.contains('is-phone'), 'phone marks the collapsed chrome');
      assert.ok(!phoneRoot.classList.contains('is-menu-open'), 'phone chip starts closed');
      assert.strictEqual(phoneChip.querySelector('.plai-bubble-label').textContent, 'PLAI');
      assert.notStrictEqual(phoneChip.querySelector('.plai-bubble-label').textContent, 'PLAY');
      assert.ok(phone.pill('talk') && phone.pill('text'), 'Talk and Text still exist on phone');
      phoneChip.click();
      assert.ok(phoneRoot.classList.contains('is-menu-open'), 'tapping the chip opens Talk / Text');
      assert.strictEqual(phoneChip.getAttribute('aria-expanded'), 'true');
      phone.pill('text').click();
      return wait(40).then(function () {
        assert.strictEqual(phone.getUserMediaCalls.length, 0, 'phone Text PLAI still does not use the mic');
        assert.ok(/Text PLAI/.test(phone.statusText()), 'phone Text PLAI still opens type-only');
        phoneChip.click();
        assert.ok(!phoneRoot.classList.contains('is-menu-open'), 'tapping the chip again closes the menu');

        const voice = loadWidget({ phone: true });
        return wait(20).then(function () {
          voice.chip().click();
          voice.pill('talk').click();
          return wait(40).then(function () {
            assert.ok(voice.getUserMediaCalls.length >= 1, 'phone Talk to PLAI still activates the mic');
            assert.ok(!/Mic is off/.test(voice.statusText()), 'phone Talk does not open as Text PLAI');
          });
        });
      });
    });
  });
}

function runPageTalk() {
  const ui = loadWidget();
  return wait(20).then(function () {
    const cta = makeNode('button');
    cta.setAttribute('data-plai-talk', '');
    cta.textContent = 'Talk to PLAI';
    ui.document.body.appendChild(cta);
    const ev = { type: 'click', target: cta, currentTarget: cta, preventDefault: function () {} };
    (ui.document.listeners.click || []).forEach(function (fn) { fn(ev); });
    return wait(40).then(function () {
      assert.ok(ui.getUserMediaCalls.length >= 1, 'Overview Talk to PLAI CTA activates the mic');
      assert.ok(!/Mic is off/.test(ui.statusText()), 'Overview Talk CTA is not Text PLAI');
    });
  });
}

function runPageText() {
  const ui = loadWidget();
  return wait(20).then(function () {
    const cta = makeNode('button');
    cta.setAttribute('data-plai-text', '');
    cta.textContent = 'Troubleshoot';
    ui.document.body.appendChild(cta);
    const ev = { type: 'click', target: cta, currentTarget: cta, preventDefault: function () {} };
    (ui.document.listeners.click || []).forEach(function (fn) { fn(ev); });
    return wait(40).then(function () {
      assert.strictEqual(ui.getUserMediaCalls.length, 0, 'FAQ Troubleshoot must not activate the mic');
      assert.ok(/Text PLAI/.test(ui.statusText()), 'FAQ Troubleshoot opens Text PLAI');
      assert.ok(/Mic is off/.test(ui.statusText()), 'FAQ Troubleshoot stays type only');
      assert.strictEqual(ui.pill('text').getAttribute('aria-expanded'), 'true');
      assert.strictEqual(ui.pill('talk').getAttribute('aria-expanded'), 'false');
    });
  });
}

function run() {
  runStatic();
  return runClicks().then(runPhoneChrome).then(runPageTalk).then(runPageText).then(function () {
    console.log('plai-bubble.test.js ok');
  });
}

Promise.resolve(run()).catch(function (err) {
  console.error(err);
  process.exit(1);
});
