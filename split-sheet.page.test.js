'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeStorage() {
  const data = Object.create(null);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

function makeEl(attrs) {
  const el = {
    id: attrs.id || '',
    value: attrs.value != null ? attrs.value : '',
    textContent: attrs.textContent || '',
    hidden: Boolean(attrs.hidden),
    disabled: false,
    innerHTML: '',
    href: attrs.href || '',
    className: attrs.className || '',
    attrs: Object.assign({}, attrs.attrs || {}),
    listeners: Object.create(null),
    classList: {
      tokens: Object.create(null),
      toggle(name, force) {
        if (force === undefined) {
          if (this.tokens[name]) delete this.tokens[name];
          else this.tokens[name] = true;
          return;
        }
        if (force) this.tokens[name] = true;
        else delete this.tokens[name];
      },
      add(name) { this.tokens[name] = true; },
      remove(name) { delete this.tokens[name]; },
      contains(name) { return Boolean(this.tokens[name]); },
    },
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    scrollIntoView() {},
  };
  if (attrs.className === 'is-hidden' || /\bis-hidden\b/.test(attrs.className || '')) {
    el.classList.tokens['is-hidden'] = true;
  }
  return el;
}

function extractScript() {
  const html = fs.readFileSync(path.join(__dirname, 'split-sheet.html'), 'utf8');
  const match = html.match(/<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/);
  assert.ok(match, 'missing split-sheet page script');
  return match[1];
}

function load(options) {
  const opts = options || {};
  const title = makeEl({ id: 'song-title', value: '' });
  const writers = makeEl({ id: 'writers' });
  const totalBox = makeEl({ id: 'total-box', textContent: 'Total 100%' });
  const addBtn = makeEl({ id: 'add-writer' });
  const slotNote = makeEl({ id: 'slot-note', className: 'hint is-hidden' });
  const statusEl = makeEl({ id: 'form-status', className: 'alert is-hidden' });
  const configBanner = makeEl({ id: 'config-banner', className: 'alert is-hidden' });
  const signBtn = makeEl({ id: 'sign-in-page' });
  const emailBtn = makeEl({ id: 'email-link' });
  const embedCard = makeEl({ id: 'embed-card', className: 'flow-card embed-card is-hidden' });
  const emailDone = makeEl({ id: 'email-done', className: 'flow-card is-hidden' });
  const signActions = makeEl({ id: 'sign-actions' });
  const incomplete = makeEl({ id: 'incomplete-alert', className: 'alert' });
  const continueReview = makeEl({ href: 'review.html' });

  const byId = {
    writers: writers,
    'total-box': totalBox,
    'add-writer': addBtn,
    'slot-note': slotNote,
    'form-status': statusEl,
    'config-banner': configBanner,
    'sign-in-page': signBtn,
    'email-link': emailBtn,
    'embed-card': embedCard,
    'email-done': emailDone,
    'sign-actions': signActions,
    'song-title': title,
    'incomplete-alert': incomplete,
  };

  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  if (opts.draft) {
    const text = JSON.stringify(opts.draft);
    if (opts.store === 'session') sessionStorage.setItem('plaiground.tonegrid.draft', text);
    else if (opts.store === 'both') {
      localStorage.setItem('plaiground.tonegrid.draft', text);
      sessionStorage.setItem('plaiground.tonegrid.draft', text);
    } else {
      localStorage.setItem('plaiground.tonegrid.draft', text);
    }
  }

  const calls = [];
  const context = {
    document: {
      hidden: false,
      getElementById(id) {
        return byId[id] || null;
      },
      querySelector(sel) {
        if (sel === '#email-done a[href="review.html"]') return continueReview;
        return null;
      },
      addEventListener() {},
    },
    localStorage,
    sessionStorage,
    addEventListener() {},
    fetch(url, options) {
      calls.push({ url: String(url), method: String((options && options.method) || 'GET') });
      if (String(url).indexOf('/api/signwell?id=') !== -1) {
        return Promise.resolve({
          ok: true,
          json: async () => (opts.signwellGet || { signed: false, status: 'Pending' }),
        });
      }
      if (String((options && options.method) || 'GET').toUpperCase() === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ documentId: 'doc_must_not_mint_solo' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ configured: true }),
      });
    },
    PlaigroundUploadRequired: require('./lib/upload-required'),
    PlaigroundReleaseCredits: {
      seedWriters() {
        return Array.isArray(opts.writers) && opts.writers.length
          ? opts.writers
          : [{ first_name: '', last_name: '', name: '', email: '', share: 100, pro: '' }];
      },
    },
  };
  context.window = context;
  context.globalThis = context;

  vm.runInNewContext(extractScript(), context);
  return {
    title,
    incomplete,
    signBtn,
    localStorage,
    sessionStorage,
    listeners: title.listeners,
    status: statusEl,
    calls,
  };
}

function draftOf(storage) {
  return JSON.parse(storage.getItem('plaiground.tonegrid.draft') || '{}');
}

async function flush() {
  await new Promise(function (resolve) { setImmediate(resolve); });
  await new Promise(function (resolve) { setImmediate(resolve); });
}

async function run() {
  const html = fs.readFileSync(path.join(__dirname, 'split-sheet.html'), 'utf8');
  assert.ok(html.indexOf('id="song-title"') !== -1);
  assert.ok(html.indexOf('value="Neon Shadows"') === -1);
  assert.ok(html.indexOf('value="Victoria Reyes"') === -1);

  const filled = load({ draft: { title: 'Night Drive' } });
  assert.strictEqual(filled.title.value, 'Night Drive');
  assert.ok(filled.incomplete.classList.contains('is-hidden') === false);
  assert.ok(filled.signBtn.classList.contains('is-incomplete'));

  const empty = load({});
  assert.strictEqual(empty.title.value, '');
  assert.strictEqual(empty.incomplete.textContent, 'Song title is required.');
  assert.ok(empty.incomplete.classList.contains('is-hidden') === false);
  assert.ok(empty.signBtn.classList.contains('is-incomplete'));

  const sessionOnly = load({ draft: { title: 'Night Drive' }, store: 'session' });
  assert.strictEqual(sessionOnly.title.value, 'Night Drive');

  const songTitleKey = load({ draft: { songTitle: 'Night Drive' } });
  assert.strictEqual(songTitleKey.title.value, 'Night Drive');

  const demo = load({ draft: { title: 'Neon Shadows' } });
  assert.strictEqual(demo.title.value, '');
  assert.strictEqual(demo.incomplete.textContent, 'Song title is required.');

  filled.title.value = 'Night Drive Live';
  filled.listeners.input();
  assert.strictEqual(draftOf(filled.localStorage).title, 'Night Drive Live');
  assert.strictEqual(draftOf(filled.sessionStorage).title, 'Night Drive Live');

  const signed = load({
    draft: { title: 'Night Drive', signwell_document_id: 'doc_email_signed_01' },
    signwellGet: {
      signed: true,
      status: 'Completed',
      recipients: [
        { name: 'Writer 1', status: 'signed', signed: true },
        { name: 'document sender', status: 'Pending', signed: false },
      ],
    },
  });
  await flush();
  assert.strictEqual(signed.title.value, 'Night Drive');
  assert.strictEqual(draftOf(signed.localStorage).signwell_signed, true);
  assert.strictEqual(signed.status.textContent, 'Split sheet signed.');
  assert.ok(signed.calls.some(function (call) {
    return String(call.url).indexOf('/api/signwell?id=doc_email_signed_01') !== -1;
  }));

  const soloMint = load({
    draft: { title: 'Night Drive', solo_owned_100: true, legal_first: 'Ada', legal_last: 'Night' },
    writers: [{ first_name: 'Ada', last_name: 'Night', name: 'Ada Night', email: 'ada@example.com', share: 100, pro: '' }],
  });
  await flush();
  await soloMint.signBtn.listeners.click();
  await flush();
  assert.ok(!soloMint.calls.some(function (call) {
    return String(call.method).toUpperCase() === 'POST' && String(call.url).indexOf('/api/signwell') !== -1;
  }), '1-writer split-sheet.html must not POST /api/signwell');
  assert.ok(soloMint.status.textContent.indexOf('attested') !== -1);

  console.log('split-sheet.page.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
