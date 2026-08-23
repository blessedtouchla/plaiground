'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function minSubmitDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function utcShift(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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
    type: attrs.type || 'text',
    min: attrs.min || '',
    required: Boolean(attrs.required),
    textContent: '',
    hidden: true,
    href: attrs.href || '',
    style: {},
    attrs: Object.assign({}, attrs.attrs || {}),
    listeners: {},
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
      if (name === 'min') this.min = String(value);
      if (name === 'type') this.type = String(value);
      if (name === 'required') this.required = true;
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    classList: {
      tokens: Object.create(null),
      toggle(name, force) {
        if (force) this.tokens[name] = true;
        else delete this.tokens[name];
      },
      add(name) {
        this.tokens[name] = true;
      },
      contains(name) {
        return Boolean(this.tokens[name]);
      },
    },
  };
  return el;
}

function loadReview(opts) {
  opts = opts || {};
  const date = makeEl({
    id: 'tg-release-date',
    type: 'date',
    value: opts.releaseDate || '',
    required: true,
  });
  const status = makeEl({ id: 'tg-status' });
  const payBtn = makeEl({
    attrs: { href: 'submitted.html', 'data-tonegrid-submit': '' },
  });
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  if (opts.draft) {
    localStorage.setItem('plaiground.tonegrid.draft', JSON.stringify(opts.draft));
  }
  const elements = {
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
        if (sel === '[data-tonegrid-submit]') return payBtn;
        if (sel === '[data-review-title]') return makeEl({});
        return null;
      },
    },
    fetch() {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ signed: true, status: 'Completed' }),
      });
    },
    location: { href: 'review.html' },
    window: {},
  };
  context.window = context;
  context.window.location = context.location;
  vm.runInNewContext(read('lib/upload-required.js'), context);
  vm.runInNewContext(read('tonegrid.js'), context);
  return {
    date,
    payBtn,
    status,
    localStorage,
  };
}

function draftOf(localStorage) {
  return JSON.parse(localStorage.getItem('plaiground.tonegrid.draft') || '{}');
}

function run() {
  const review = read('review.html');
  const upload = read('upload.html');
  const attest = read('attest.html');
  const css = read('site.css');

  assert.ok(/id="tg-release-date"[^>]*type="date"/.test(review) || /type="date"[^>]*id="tg-release-date"/.test(review), 'review date picker is missing');
  assert.ok(review.includes('id="tg-release-date"'));
  assert.ok(review.includes('type="date"'));
  assert.ok(/\srequired[\s>]/.test(review.match(/<input[^>]*id="tg-release-date"[^>]*>/)[0]) || review.includes('required'), 'release date stays required');
  assert.ok(review.includes('class="date-picker"') || review.includes('date-picker'));
  assert.strictEqual((review.match(/id="tg-release-date"/g) || []).length, 1);
  assert.ok(!review.includes('placeholder="MM/DD/YYYY"'));
  assert.ok(!/id="tg-release-date"/.test(upload), 'do not add a second required date on upload');
  assert.ok(!/id="tg-release-date"/.test(attest), 'do not add a second required date on attest');
  assert.ok(css.includes('.date-picker') || css.includes('input[type="date"]'));
  assert.ok(css.includes('color-scheme: dark'));

  const empty = loadReview({
    draft: {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      signwell_document_id: 'doc_split_sheet_01',
    },
  });
  const min = minSubmitDate();
  assert.strictEqual(empty.date.type, 'date');
  assert.strictEqual(empty.date.min, min);
  assert.strictEqual(empty.date.required, true);
  assert.strictEqual(empty.date.value, '');
  empty.payBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(empty.status.textContent, 'Release date is required.');
  assert.ok(!String(draftOf(empty.localStorage).release_date || '').trim());

  empty.date.value = utcShift(-1);
  empty.date.listeners.change();
  assert.strictEqual(empty.date.value, '', 'yesterday is not selectable');
  assert.strictEqual(draftOf(empty.localStorage).release_date, '');

  empty.date.value = utcShift(1);
  empty.date.listeners.change();
  assert.strictEqual(empty.date.value, '', 'tomorrow under +7 days is not selectable');
  assert.strictEqual(draftOf(empty.localStorage).release_date, '');

  empty.date.value = min;
  empty.date.listeners.change();
  assert.strictEqual(empty.date.value, min);
  assert.strictEqual(draftOf(empty.localStorage).release_date, min);

  const later = utcShift(14);
  const saved = loadReview({
    draft: {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      release_date: later,
    },
  });
  assert.strictEqual(saved.date.min, min);
  assert.strictEqual(saved.date.value, later);
  assert.strictEqual(draftOf(saved.localStorage).release_date, later);

  console.log('review-date-picker.test.js ok');
}

run();
