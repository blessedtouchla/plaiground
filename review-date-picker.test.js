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
    max: attrs.max || '',
    required: Boolean(attrs.required),
    checked: Boolean(attrs.checked),
    textContent: '',
    hidden: attrs.hidden != null ? Boolean(attrs.hidden) : true,
    href: attrs.href || '',
    style: {},
    options: attrs.options || [],
    nextElementSibling: attrs.nextElementSibling || null,
    attrs: Object.assign({}, attrs.attrs || {}),
    listeners: {},
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
      if (name === 'min') this.min = String(value);
      if (name === 'max') this.max = String(value);
      if (name === 'type') this.type = String(value);
      if (name === 'required') this.required = true;
      if (name === 'aria-checked') this.attrs['aria-checked'] = String(value);
    },
    removeAttribute(name) {
      delete this.attrs[name];
      if (name === 'max') this.max = '';
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    appendChild(child) {
      this.options.push(child);
      return child;
    },
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
      add(name) {
        this.tokens[name] = true;
      },
      remove(name) {
        delete this.tokens[name];
      },
      contains(name) {
        return Boolean(this.tokens[name]);
      },
    },
  };
  if (attrs.on) el.classList.add('on');
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
  const preorderKnob = makeEl({});
  const timeKnob = makeEl({ on: true });
  const preorderOn = makeEl({
    id: 'tg-preorder-on',
    type: 'checkbox',
    checked: false,
    nextElementSibling: preorderKnob,
  });
  const timeOn = makeEl({
    id: 'tg-time-on',
    type: 'checkbox',
    checked: true,
    nextElementSibling: timeKnob,
  });
  const preorderDate = makeEl({
    id: 'tg-preorder-date',
    type: 'date',
    value: '',
  });
  const releaseTime = makeEl({
    id: 'tg-release-time',
    type: 'time',
    value: '00:00',
  });
  const releaseTimezone = makeEl({
    id: 'tg-release-timezone',
    value: 'UTC',
    options: [
      { value: 'UTC' },
      { value: 'America/New_York' },
      { value: 'America/Los_Angeles' },
    ],
  });
  const preorderPanel = makeEl({ id: 'tg-preorder-panel', hidden: true });
  const timePanel = makeEl({ id: 'tg-time-panel', hidden: false });
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
    'tg-preorder-on': preorderOn,
    'tg-time-on': timeOn,
    'tg-preorder-date': preorderDate,
    'tg-release-time': releaseTime,
    'tg-release-timezone': releaseTimezone,
    'tg-preorder-panel': preorderPanel,
    'tg-time-panel': timePanel,
    'tg-status': status,
  };
  const context = {
    localStorage,
    sessionStorage,
    Intl,
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector(sel) {
        if (sel === '[data-tonegrid-submit]') return payBtn;
        if (sel === '[data-review-title]') return makeEl({});
        return null;
      },
      createElement(tag) {
        return { tag: tag, value: '', textContent: '' };
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
    preorderOn,
    timeOn,
    preorderDate,
    releaseTime,
    releaseTimezone,
    preorderPanel,
    timePanel,
    preorderKnob,
    timeKnob,
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
  assert.ok(review.includes('id="tg-preorder-on"'));
  assert.ok(review.includes('id="tg-time-on"'));
  assert.ok(review.includes('id="tg-preorder-date"'));
  assert.ok(review.includes('id="tg-release-time"'));
  assert.ok(review.includes('id="tg-release-timezone"'));
  assert.ok(review.includes('type="checkbox"'));
  assert.ok(!/<div class="toggle-line"><span class="toggle"/.test(review), 'toggles must not stay visual-only');

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

  assert.strictEqual(empty.preorderOn.checked, false);
  assert.strictEqual(empty.preorderPanel.hidden, true);
  assert.strictEqual(empty.timeOn.checked, true);
  assert.strictEqual(empty.timePanel.hidden, false);
  empty.preorderOn.checked = true;
  empty.preorderOn.listeners.change();
  assert.strictEqual(empty.preorderOn.checked, true);
  assert.strictEqual(empty.preorderOn.attrs['aria-checked'], 'true');
  assert.strictEqual(empty.preorderPanel.hidden, false);
  assert.strictEqual(draftOf(empty.localStorage).select_preorder, true);
  empty.preorderDate.value = min;
  empty.preorderDate.listeners.change();
  assert.strictEqual(draftOf(empty.localStorage).preorder_date, min);
  empty.timeOn.checked = false;
  empty.timeOn.listeners.change();
  assert.strictEqual(empty.timeOn.checked, false);
  assert.strictEqual(empty.timePanel.hidden, true);
  assert.strictEqual(draftOf(empty.localStorage).define_time, false);

  const restored = loadReview({
    draft: {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      release_date: later,
      select_preorder: true,
      preorder_date: min,
      define_time: false,
      release_time: '09:30',
      release_timezone: 'America/Los_Angeles',
    },
  });
  assert.strictEqual(restored.preorderOn.checked, true);
  assert.strictEqual(restored.preorderPanel.hidden, false);
  assert.strictEqual(restored.preorderDate.value, min);
  assert.strictEqual(restored.timeOn.checked, false);
  assert.strictEqual(restored.timePanel.hidden, true);
  assert.strictEqual(restored.releaseTime.value, '09:30');
  assert.strictEqual(restored.releaseTimezone.value, 'America/Los_Angeles');
  assert.strictEqual(draftOf(restored.localStorage).select_preorder, true);
  assert.strictEqual(draftOf(restored.localStorage).define_time, false);
  assert.strictEqual(draftOf(restored.localStorage).preorder_date, min);
  assert.strictEqual(draftOf(restored.localStorage).release_time, '09:30');
  assert.strictEqual(draftOf(restored.localStorage).release_timezone, 'America/Los_Angeles');

  console.log('review-date-picker.test.js ok');
}

run();
