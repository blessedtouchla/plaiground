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
  const injected = session.nodes.map(function (el) { return String(el.textContent || ''); }).join(' ');
  assert.ok(!BADGE.test(injected), 'logged-in dashboard JS injected ACCOUNT READY');

  const upload = read('upload.html');
  assert.ok(upload.includes('<label for="tg-artist">Primary artist</label>'));
  assert.ok(upload.includes('placeholder="Artist name"'));
  assert.ok(!/id="tg-artist"[^>]*legal name/i.test(upload));

  console.log('dashboard.page.test.js ok');
}

run();
