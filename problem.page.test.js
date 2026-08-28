'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const accounts = require('./lib/accounts');
const auth = require('./lib/auth');
const mail = require('./lib/mail');
const authApi = require('./api/auth');
const meApi = require('./api/me');

const THANKS = 'Thank you. We will look at this within 24 hours.';
const BANNED = ['victoriaimtanes@', 'realhealthiswealth@', 'powerplantog@'];
const APP_PAGES = [
  'dashboard.html',
  'how.html',
  'releases.html',
  'song.html',
  'splits.html',
  'earnings.html',
  'analytics.html',
  'payouts.html',
  'settings.html',
  'artists.html',
  'boosts.html',
  'chart-push.html',
  'streaming-push.html',
  'social-push.html',
  'video-collect.html',
  'publishing-register.html',
  'problem.html',
];

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(chunk) { this.body = chunk == null ? '' : String(chunk); },
  };
}

function json(res) {
  return JSON.parse(res.body || '{}');
}

function cookieFrom(res) {
  return String(res.headers['Set-Cookie'] || '');
}

async function withEnv(env, fn) {
  const keys = ['DATABASE_URL', 'SESSION_SECRET', 'RESEND_API_KEY', 'CONFIRM_SECRET', 'CONFIRM_FROM'];
  const prev = {};
  keys.forEach((key) => {
    prev[key] = process.env[key];
    if (!(key in env)) return;
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  });
  accounts.resetStore();
  if (env.memory) accounts.useMemoryStore();
  try {
    await fn();
  } finally {
    accounts.resetStore();
    keys.forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  }
}

function makeNode(attrs) {
  const node = {
    tagName: String((attrs && attrs.tagName) || 'DIV').toUpperCase(),
    className: (attrs && attrs.className) || '',
    hidden: Boolean(attrs && attrs.hidden),
    href: (attrs && attrs.href) || '',
    value: (attrs && attrs.value) || '',
    textContent: (attrs && attrs.textContent) || '',
    disabled: false,
    parentNode: null,
    children: [],
    attributes: Object.assign({}, (attrs && attrs.attributes) || {}),
    listeners: Object.create(null),
    classList: {
      contains: function (name) {
        return (' ' + node.className + ' ').indexOf(' ' + name + ' ') !== -1;
      },
      add: function (name) {
        if (!this.contains(name)) node.className = (node.className + ' ' + name).trim();
      },
      toggle: function (name, on) {
        if (on === false) {
          node.className = node.className.split(/\s+/).filter(function (part) { return part && part !== name; }).join(' ');
          return false;
        }
        this.add(name);
        return true;
      },
    },
    setAttribute: function (key, value) {
      this.attributes[key] = String(value);
      if (key === 'href') this.href = String(value);
      if (key === 'class') this.className = String(value);
    },
    removeAttribute: function (key) {
      delete this.attributes[key];
    },
    getAttribute: function (key) {
      if (key === 'href') return this.href;
      if (key === 'class') return this.className;
      return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null;
    },
    appendChild: function (child) {
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    insertBefore: function (child, ref) {
      child.parentNode = node;
      const index = node.children.indexOf(ref);
      if (index === -1) node.children.push(child);
      else node.children.splice(index, 0, child);
      return child;
    },
    addEventListener: function (type, fn) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(fn);
    },
    querySelector: function (sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll: function (sel) {
      const out = [];
      function walk(current) {
        current.children.forEach(function (child) {
          if (matchSel(child, sel)) out.push(child);
          walk(child);
        });
      }
      walk(this);
      return out;
    },
  };
  if (attrs && attrs['data-have-problem']) node.attributes['data-have-problem'] = attrs['data-have-problem'];
  return node;
}

function matchSel(node, sel) {
  const raw = String(sel || '');
  if (raw.charAt(0) === '.') return node.classList.contains(raw.slice(1));
  if (raw.indexOf('[data-have-problem]') !== -1) return node.getAttribute('data-have-problem') != null;
  if (raw.indexOf('[data-problem-') !== -1) {
    const name = raw.slice(1, raw.indexOf(']'));
    return node.getAttribute(name) != null;
  }
  return false;
}

function loadProblem(options) {
  const signedIn = !!(options && options.signedIn);
  const email = (options && options.email) || 'ada@example.com';
  const fetchImpl = options && options.fetch;
  const sideNav = makeNode({ className: 'side-nav' });
  const flowTop = makeNode({ className: 'flow-top' });
  const who = makeNode({ className: 'who', tagName: 'A' });
  flowTop.appendChild(who);
  const form = makeNode({ tagName: 'FORM', attributes: { 'data-problem-form': '1' } });
  const field = makeNode({ tagName: 'TEXTAREA', attributes: { 'data-problem-text': '1' } });
  const submit = makeNode({ tagName: 'BUTTON', attributes: { 'data-problem-submit': '1' } });
  const error = makeNode({ attributes: { 'data-problem-error': '1' }, hidden: true });
  const thanks = makeNode({ attributes: { 'data-problem-thanks': '1' }, hidden: true });
  const thanksCopy = makeNode({ attributes: { 'data-problem-thanks-copy': '1' }, textContent: '' });
  form.appendChild(field);
  form.appendChild(submit);
  const body = makeNode({ tagName: 'BODY', className: 'app' });
  body.appendChild(sideNav);
  body.appendChild(flowTop);
  body.appendChild(form);
  body.appendChild(error);
  body.appendChild(thanks);
  thanks.appendChild(thanksCopy);

  const document = {
    body: body,
    readyState: 'complete',
    querySelector: function (sel) {
      if (sel === '.side-nav') return sideNav;
      if (sel === '.flow-top') return flowTop;
      if (sel === '[data-problem-form]') return form;
      if (sel === '[data-problem-error]') return error;
      if (sel === '[data-problem-thanks]') return thanks;
      if (sel === '[data-problem-thanks-copy]') return thanksCopy;
      return body.querySelector(sel);
    },
    querySelectorAll: function (sel) {
      return body.querySelectorAll(sel);
    },
    createElement: function (tag) {
      return makeNode({ tagName: tag });
    },
    addEventListener: function () {},
  };

  const calls = [];
  const context = {
    window: null,
    document: document,
    fetch: fetchImpl || function (url, init) {
      calls.push({ url: String(url), init: init || {} });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () { return Promise.resolve({ ok: true, mail_sent: true }); },
      });
    },
    PlaigroundMembership: {
      isSignedIn: function () { return signedIn; },
      account: function () { return signedIn ? { email: email } : null; },
      whenReady: function (cb) { if (typeof cb === 'function') cb(); },
    },
  };
  context.window = context;
  vm.runInNewContext(read('problem.js'), context);
  return {
    api: context.PlaigroundProblem,
    sideNav: sideNav,
    flowTop: flowTop,
    form: form,
    field: field,
    submit: submit,
    error: error,
    thanks: thanks,
    thanksCopy: thanksCopy,
    calls: calls,
    submitForm: function () {
      const fns = form.listeners.submit || [];
      fns.forEach(function (fn) { fn({ preventDefault: function () {} }); });
    },
  };
}

async function run() {
  const page = read('problem.html');
  const js = read('problem.js');
  const mailSrc = read('lib/mail.js');
  const meSrc = read('api/me.js');
  const vercel = read('vercel.json');

  assert.ok(page.includes('data-require-membership="true"'), 'problem.html dumps logged-out visitors to login');
  assert.ok(page.includes('data-problem-form'), 'problem.html has the form');
  assert.ok(page.includes('data-problem-text'), 'problem.html collects the problem text');
  assert.ok(page.includes(THANKS), 'thank-you copy is exact');
  assert.ok(page.includes('href="dashboard.html"') && page.includes('data-problem-overview'), 'thank-you CTA goes to Overview');
  assert.ok(/data-problem-overview[^>]*>Back to Overview</.test(page), 'Overview CTA is a real button');
  assert.ok(page.includes('Have a problem?'), 'page keeps the exact button label');
  assert.ok(!/stripe|checkout/i.test(page), 'problem form is not a paid flow');
  assert.ok(/no charge/i.test(page), 'problem form says there is no charge');
  BANNED.forEach(function (bit) {
    assert.ok(!page.toLowerCase().includes(bit), 'problem.html must not name a personal inbox');
    assert.ok(!js.toLowerCase().includes(bit), 'problem.js must not name a personal inbox');
    assert.ok(!mailSrc.toLowerCase().includes(bit), 'mail.js must not name a personal inbox');
  });
  assert.ok(mailSrc.includes("CONTACT_EMAIL = 'emailplaiground@gmail.com'"), 'problem mail stays on the public PLAIGROUND inbox');
  assert.ok(meSrc.includes('sendProblemReport'), 'me.js reuses the existing Resend helper');
  assert.ok(vercel.includes('/api/me/problem'), 'Hobby rewrite keeps one me.js function');
  assert.ok(js.includes("LABEL = 'Have a problem?'"), 'chrome button label is exact');
  assert.ok(js.includes("THANKS = '" + THANKS + "'"), 'client thank-you copy is exact');
  assert.ok(js.includes("ENDPOINT = '/api/me/problem'"), 'form posts to the session problem route');
  assert.ok(!js.includes('header.nav'), 'do not inject into the public header');

  APP_PAGES.forEach(function (file) {
    const html = read(file);
    const sideNav = html.match(/<nav class="side-nav">[\s\S]*?<\/nav>/);
    assert.ok(sideNav, file + ' keeps a side-nav');
    assert.ok(sideNav[0].includes('Have a problem?'), file + ' signed-in menu has Have a problem?');
    assert.ok(sideNav[0].includes('href="problem.html"'), file + ' problem control opens problem.html');
  });

  const index = read('index.html');
  assert.ok(!index.includes('Have a problem?'), 'marketing landing does not show Have a problem?');
  assert.ok(!index.includes('data-have-problem'), 'marketing landing does not ship the signed-in control');
  assert.ok(!index.includes('problem.js'), 'marketing landing does not load the problem form');

  const signedOut = loadProblem({ signedIn: false });
  assert.strictEqual(signedOut.sideNav.querySelector('[data-have-problem]'), null, 'logged-out chrome does not inject the button');
  assert.strictEqual(signedOut.flowTop.querySelector('[data-have-problem]'), null, 'logged-out flow-top does not inject the button');

  const signedIn = loadProblem({ signedIn: true, email: 'ada@example.com' });
  const sideBtn = signedIn.sideNav.querySelector('[data-have-problem]');
  const flowBtn = signedIn.flowTop.querySelector('[data-have-problem]');
  assert.ok(sideBtn, 'signed-in side nav gets Have a problem?');
  assert.strictEqual(sideBtn.textContent, 'Have a problem?');
  assert.strictEqual(sideBtn.href, 'problem.html');
  assert.ok(flowBtn, 'signed-in upload chrome gets Have a problem?');
  assert.strictEqual(flowBtn.textContent, 'Have a problem?');
  assert.strictEqual(signedIn.thanksCopy.textContent, THANKS);

  signedIn.field.value = 'Cover art will not save.';
  signedIn.submitForm();
  await new Promise(function (resolve) { setImmediate(resolve); });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(signedIn.calls.length, 1, 'submit posts once');
  assert.strictEqual(signedIn.calls[0].url, '/api/me/problem');
  const payload = JSON.parse(signedIn.calls[0].init.body);
  assert.strictEqual(payload.problem, 'Cover art will not save.');
  assert.strictEqual(payload.email, 'ada@example.com');
  assert.strictEqual(signedIn.thanks.hidden, false, 'success shows the thank-you screen');
  assert.strictEqual(signedIn.form.hidden, true, 'success hides the form');

  const failed = loadProblem({
    signedIn: true,
    email: 'ada@example.com',
    fetch: function () {
      return Promise.resolve({
        ok: false,
        status: 503,
        json: function () { return Promise.resolve({ ok: false, mail_sent: false, error: 'Mail is not configured.' }); },
      });
    },
  });
  failed.field.value = 'Still broken.';
  failed.submitForm();
  await new Promise(function (resolve) { setImmediate(resolve); });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(failed.thanks.hidden, true, 'mail failure must not fake a thank-you');
  assert.strictEqual(failed.form.hidden, false, 'mail failure keeps the form');
  assert.ok(String(failed.error.textContent).indexOf('Mail is not configured.') !== -1, 'mail failure is honest');

  await withEnv({
    DATABASE_URL: 'postgres://memory',
    SESSION_SECRET: 'unit-test-session-secret',
    CONFIRM_SECRET: 'unit-confirm-secret',
    RESEND_API_KEY: undefined,
    memory: true,
  }, async () => {
    const created = mockRes();
    await authApi(Object.assign({ url: '/api/auth/signup' }, {
      method: 'POST',
      headers: {},
      body: { email: 'ada@example.com', password: 'password1', artist: 'Ada Night', plan: 'basic' },
    }), created);
    assert.strictEqual(created.statusCode, 200);
    const confirmed = mockRes();
    await authApi(Object.assign({ url: '/api/auth/confirm' }, {
      method: 'POST',
      headers: {},
      body: { token: mail.signToken('ada@example.com') },
    }), confirmed);
    const login = mockRes();
    await authApi(Object.assign({ url: '/api/auth/login' }, {
      method: 'POST',
      headers: {},
      body: { email: 'ada@example.com', password: 'password1' },
    }), login);
    const cookie = cookieFrom(login).split(';')[0];

    const anon = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/problem',
      headers: {},
      body: { problem: 'It is broken.' },
    }, anon);
    assert.strictEqual(anon.statusCode, 401);
    assert.strictEqual(json(anon).mail_sent, undefined);

    const empty = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/problem',
      headers: { cookie: cookie },
      body: { problem: '   ' },
    }, empty);
    assert.strictEqual(empty.statusCode, 400);

    const noMail = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/problem',
      headers: { cookie: cookie },
      body: { problem: 'The catalog is empty.' },
    }, noMail);
    assert.strictEqual(noMail.statusCode, 503);
    assert.strictEqual(json(noMail).mail_sent, false);
    assert.strictEqual(json(noMail).ok, false);
  });

  const prevFetch = global.fetch;
  const sent = [];
  global.fetch = async function (url, init) {
    sent.push({ url: String(url), init: init || {} });
    return { ok: true, status: 200, json: async () => ({ id: 're_problem' }) };
  };
  try {
    await withEnv({
      DATABASE_URL: 'postgres://memory',
      SESSION_SECRET: 'unit-test-session-secret',
      CONFIRM_SECRET: 'unit-confirm-secret',
      RESEND_API_KEY: 're_test_key',
      CONFIRM_FROM: undefined,
      memory: true,
    }, async () => {
      const created = mockRes();
      await authApi(Object.assign({ url: '/api/auth/signup' }, {
        method: 'POST',
        headers: {},
        body: { email: 'ada@example.com', password: 'password1', artist: 'Ada Night', plan: 'basic' },
      }), created);
      await authApi(Object.assign({ url: '/api/auth/confirm' }, {
        method: 'POST',
        headers: {},
        body: { token: mail.signToken('ada@example.com') },
      }), mockRes());
      const login = mockRes();
      await authApi(Object.assign({ url: '/api/auth/login' }, {
        method: 'POST',
        headers: {},
        body: { email: 'ada@example.com', password: 'password1' },
      }), login);
      const cookie = cookieFrom(login).split(';')[0];
      sent.length = 0;
      const ok = mockRes();
      await meApi({
        method: 'POST',
        url: '/api/me/problem',
        headers: { cookie: cookie },
        body: { problem: 'Earnings stay at $0.', email: 'ignore-this@example.com' },
      }, ok);
      assert.strictEqual(ok.statusCode, 200);
      assert.strictEqual(json(ok).ok, true);
      assert.strictEqual(json(ok).mail_sent, true);
      assert.strictEqual(sent.length, 1);
      const body = JSON.parse(sent[0].init.body);
      assert.deepStrictEqual(body.to, ['emailplaiground@gmail.com']);
      assert.ok(body.text.indexOf('Earnings stay at $0.') !== -1);
      assert.ok(body.text.indexOf('ada@example.com') !== -1);
      assert.ok(!body.text.includes('ignore-this@example.com'), 'session email wins over a spoofed body email');
      assert.ok(!JSON.stringify(body).includes('victoriaimtanes@'));
      assert.ok(!JSON.stringify(body).includes('realhealthiswealth@'));
      assert.ok(!JSON.stringify(body).includes('powerplantog@'));
    });
  } finally {
    global.fetch = prevFetch;
  }

  console.log('problem.page.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
