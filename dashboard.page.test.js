'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BADGE = /account[\s_-]*ready/i;

const LOGGED_IN_PAGES = [
  'dashboard.html',
  'releases.html',
  'splits.html',
  'splits-empty.html',
  'earnings.html',
  'analytics.html',
  'payouts.html',
  'settings.html',
  'boosts.html',
  'how.html',
  'library.html',
  'song.html',
  'upload.html',
  'attest.html',
  'review.html',
  'split-sheet.html',
];

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function listHtmlAndJs() {
  return fs.readdirSync(__dirname).filter(function (name) {
    return /\.(html|js)$/.test(name) && !name.endsWith('.test.js');
  });
}

function loadDashboardScripts(signedIn) {
  const membershipCode = read('membership.js');
  const accountCode = read('account.js');
  const localStorage = {
    data: signedIn ? { plaigroundSignedIn: '1' } : Object.create(null),
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null;
    },
    setItem(key, value) {
      this.data[key] = String(value);
    },
    removeItem(key) {
      delete this.data[key];
    },
  };
  const nodes = [];
  const document = {
    currentScript: { getAttribute() { return null; } },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement(tag) {
      const el = { tagName: String(tag).toUpperCase(), textContent: '', className: '', hidden: false };
      nodes.push(el);
      return el;
    },
  };
  const context = {
    URLSearchParams,
    localStorage,
    sessionStorage: localStorage,
    document,
    location: { href: 'dashboard.html', pathname: '/dashboard.html', search: '', replace() {} },
    fetch() {
      return Promise.resolve({
        ok: signedIn,
        status: signedIn ? 200 : 401,
        json: function () {
          return Promise.resolve(signedIn ? { artist: 'John Doe', plan: 'basic', email: 'john@example.com' } : {});
        },
      });
    },
  };
  context.window = context;
  context.global = context;
  vm.runInNewContext(membershipCode, context);
  vm.runInNewContext(accountCode, context);
  return { api: context.PlaigroundMembership, nodes, document };
}

function run() {
  const dash = read('dashboard.html');
  assert.ok(dash.includes('Start your first song submission'), 'dashboard greeting is missing');
  assert.ok(dash.includes('Submit your first song'), 'first-song CTA is missing');
  assert.ok(dash.includes('data-first-song'), 'first-song empty state hook is missing');
  assert.ok(dash.includes('data-has-release'), 'submitted-release hook is missing');
  assert.ok(dash.includes('In Review'), 'submitted In Review copy is missing');
  assert.ok(dash.includes('data-account-who'), 'dashboard greeting name slot is missing');
  assert.ok(dash.includes('class="topbar"'), 'dashboard menu/topbar is missing');
  assert.ok(dash.includes('class="side-nav"'), 'dashboard menu is missing');
  assert.ok(!BADGE.test(dash), 'dashboard.html still renders ACCOUNT READY');
  assert.ok(!dash.includes('class="ready"'), 'dashboard.html still has a ready status chip');

  LOGGED_IN_PAGES.forEach(function (file) {
    const html = read(file);
    assert.ok(!BADGE.test(html), file + ' still renders ACCOUNT READY');
  });

  ['account.js', 'site.js'].forEach(function (file) {
    const js = read(file);
    assert.ok(!BADGE.test(js), file + ' still renders ACCOUNT READY');
  });

  const membership = read('membership.js');
  assert.ok(!/ACCOUNT READY|Account ready|account-ready|account_ready/.test(membership), 'membership.js still renders ACCOUNT READY');

  listHtmlAndJs().forEach(function (file) {
    const text = read(file);
    const display = text.replace(/\baccountReady\b/g, '');
    assert.ok(!/ACCOUNT READY|Account ready|account-ready|account_ready/.test(display), file + ' still has ACCOUNT READY copy');
  });

  const session = loadDashboardScripts(true);
  assert.strictEqual(session.api.isSignedIn(), true);
  assert.ok(dash.includes('data-first-song'), 'empty first-song hero stays in markup');
  assert.ok(dash.includes('data-has-release'), 'submitted-release hero is in markup');
  assert.ok(dash.includes('In Review'), 'submitted state shows In Review');
  const injected = session.nodes.map(function (el) { return String(el.textContent || ''); }).join(' ');
  assert.ok(!BADGE.test(injected), 'logged-in dashboard JS injected ACCOUNT READY');

  const nodes = {
    '[data-first-song]': { hidden: false },
    '[data-has-release]': { hidden: true },
    '[data-first-upload]': { hidden: false },
    '[data-latest-title]': { textContent: '' },
    '[data-latest-status]': { textContent: '' },
    '[data-latest-link]': { href: 'releases.html', setAttribute(name, value) { this[name] = value; } },
    '[data-account-releases]': { textContent: '0' },
    '[data-pub-call]': { hidden: true },
  };
  const fillDoc = {
    currentScript: { getAttribute() { return null; } },
    querySelector() { return null; },
    querySelectorAll(sel) { return nodes[sel] ? [nodes[sel]] : []; },
    addEventListener() {},
  };
  const fillCtx = {
    URLSearchParams,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: fillDoc,
    location: { href: 'dashboard.html', pathname: '/dashboard.html', search: '', replace() {} },
    fetch() { return Promise.resolve({ ok: false, status: 401, json: async () => ({}) }); },
  };
  fillCtx.window = fillCtx;
  vm.runInNewContext(read('account.js'), fillCtx);
  fillCtx.PlaigroundAccount.fill({
    artist: 'Fuvtu',
    plan: 'basic',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    upload: { allowed: false },
  });
  assert.strictEqual(nodes['[data-first-song]'].hidden, true, 'first-song hero hides after Basic submit');
  assert.strictEqual(nodes['[data-has-release]'].hidden, false);
  assert.strictEqual(nodes['[data-first-upload]'].hidden, true);
  assert.strictEqual(nodes['[data-latest-status]'].textContent, 'In Review');
  assert.ok(String(nodes['[data-latest-link]'].href).indexOf('song.html?id=') !== -1);

  const upload = read('upload.html');
  assert.ok(upload.includes('<label for="tg-artist">Primary artist</label>'));
  assert.ok(upload.includes('placeholder="Artist name"'));
  assert.ok(!/id="tg-artist"[^>]*legal name/i.test(upload));

  console.log('dashboard.page.test.js ok');
}

run();
