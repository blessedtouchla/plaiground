'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'tonegrid.js'), 'utf8');

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
    value: attrs.value || '',
    textContent: '',
    hidden: true,
    href: attrs.href || '',
    attrs: Object.assign({}, attrs.attrs || {}),
    listeners: {},
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
  };
  return el;
}

function load(options) {
  const opts = options || {};
  const title = makeEl({ id: 'tg-title', value: opts.title || '' });
  const artist = makeEl({ id: 'tg-artist', value: opts.artist || '' });
  const genre = makeEl({ id: 'tg-genre', value: opts.genre || '' });
  const date = makeEl({ id: 'tg-release-date', value: opts.releaseDate || '' });
  const status = makeEl({ id: 'tg-status' });
  const continueBtn = makeEl({
    attrs: { href: 'attest.html', 'data-tonegrid-continue': '' },
  });
  const payBtn = makeEl({
    attrs: { href: 'submitted.html', 'data-tonegrid-submit': '' },
  });
  const calls = [];
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  if (opts.draft) {
    localStorage.setItem('plaiground.tonegrid.draft', JSON.stringify(opts.draft));
  }

  const elements = {
    'tg-title': title,
    'tg-artist': artist,
    'tg-genre': genre,
    'tg-release-date': date,
    'tg-status': status,
  };

  const context = {
    localStorage,
    sessionStorage,
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector(sel) {
        if (sel === '[data-tonegrid-continue]') return opts.bind === 'review' || opts.bind === 'submitted' ? null : continueBtn;
        if (sel === '[data-tonegrid-submit]') return opts.bind === 'review' ? payBtn : null;
        if (sel === '[data-review-title]' || sel === '[data-review-meta]' || sel === '[data-submit-title]') {
          return opts.bind === 'submitted' ? makeEl({}) : null;
        }
        return null;
      },
    },
    fetch(url, init) {
      calls.push({ url: String(url), init: init || {} });
      const queued = (opts.responses || []).shift();
      const response = queued || { ok: true, status: 201, data: { uuid: '11111111-1111-4111-8111-111111111111' } };
      return Promise.resolve({
        ok: response.ok,
        status: response.status,
        json: async () => response.data,
      });
    },
    location: { href: opts.page || 'upload.html' },
    window: {},
  };
  context.window = context;
  context.window.location = context.location;
  vm.runInNewContext(code, context);
  return { continueBtn, payBtn, status, calls, localStorage, location: context.location };
}

function draftOf(localStorage) {
  return JSON.parse(localStorage.getItem('plaiground.tonegrid.draft') || '{}');
}

async function run() {
  const blocked = load({ title: '', artist: '' });
  blocked.continueBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(blocked.calls.length, 0);
  assert.strictEqual(blocked.status.textContent, 'Primary artist is required.');

  const noTitle = load({ title: '', artist: 'Ada Night' });
  noTitle.continueBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(noTitle.calls.length, 0);
  assert.strictEqual(noTitle.status.textContent, 'Song title is required.');

  const upload = load({
    title: 'Night Drive',
    artist: 'Ada Night',
    genre: 'Pop',
    responses: [
      { ok: true, status: 201, data: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
      { ok: true, status: 201, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
    ],
  });
  upload.continueBtn.listeners.click({ preventDefault() {} });
  await new Promise(function (resolve) { setImmediate(resolve); });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(upload.calls.length, 2);
  assert.strictEqual(upload.calls[0].url, '/api/tonegrid/artists');
  assert.strictEqual(upload.calls[1].url, '/api/tonegrid/releases');
  const artistBody = JSON.parse(upload.calls[0].init.body);
  const releaseBody = JSON.parse(upload.calls[1].init.body);
  assert.strictEqual(artistBody.name, 'Ada Night');
  assert.strictEqual(releaseBody.artist_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.strictEqual(releaseBody.title, 'Night Drive');
  assert.strictEqual(releaseBody.type, 'single');
  assert.strictEqual(releaseBody.genre, 'Pop');
  assert.strictEqual(releaseBody.release_date, undefined);
  const draft = draftOf(upload.localStorage);
  assert.strictEqual(draft.artist_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.strictEqual(draft.release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.strictEqual(upload.location.href, 'attest.html');

  const unavailable = load({
    title: 'Night Drive',
    artist: 'Ada Night',
    responses: [{ ok: false, status: 503, data: { configured: false, error: 'ToneGrid is not configured.' } }],
  });
  unavailable.continueBtn.listeners.click({ preventDefault() {} });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(unavailable.calls.length, 1);
  assert.strictEqual(unavailable.status.textContent, 'Catalog sync is not configured yet.');
  assert.strictEqual(unavailable.location.href, 'attest.html');

  const paySkip = load({
    bind: 'review',
    draft: {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
  });
  paySkip.payBtn.listeners.click({ preventDefault() {} });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(paySkip.calls.length, 0);
  assert.strictEqual(paySkip.location.href, 'submitted.html');

  const submittedRetry = load({
    bind: 'submitted',
    page: 'submitted.html',
    draft: {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      type: 'single',
    },
    responses: [{ ok: true, status: 201, data: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } }],
  });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(submittedRetry.calls.length, 1);
  assert.strictEqual(submittedRetry.calls[0].url, '/api/tonegrid/releases');
  assert.strictEqual(draftOf(submittedRetry.localStorage).release_id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

  const source = fs.readFileSync(path.join(__dirname, 'tonegrid.js'), 'utf8');
  assert.ok(!source.includes('Neon Shadows'));
  assert.ok(!source.includes('Victoria Reyes'));
  assert.ok(!source.includes(['t', 'g', 'k', '_'].join('')));

  console.log('tonegrid.client.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
