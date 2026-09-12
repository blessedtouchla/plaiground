'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8');
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

function makeEl(text) {
  return {
    textContent: text == null ? '' : String(text),
    hidden: false,
    attrs: {},
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

function loadSubmitted(draft) {
  const submitTitle = makeEl('Your song is in the queue.');
  const submitReleaseDate = makeEl('—');
  const submitOrder = makeEl('—');
  const submitWriters = makeEl('Co-writers get signing links once the scan clears.');
  const submitDeliverDate = makeEl('the release date you picked');
  const submitDeliverDatePro = makeEl('the release date you picked');
  const submitStores = makeEl('');
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  localStorage.setItem('plaiground.store.draft', JSON.stringify(draft || {}));
  const document = {
    getElementById() { return null; },
    querySelectorAll(sel) {
      if (sel === '[data-submit-deliver-date]') return [submitDeliverDate, submitDeliverDatePro];
      return [];
    },
    querySelector(sel) {
      if (sel === '[data-submit-title]') return submitTitle;
      if (sel === '[data-submit-release-date]') return submitReleaseDate;
      if (sel === '[data-submit-order]') return submitOrder;
      if (sel === '[data-submit-writers]') return submitWriters;
      if (sel === '[data-submit-deliver-date]') return submitDeliverDate;
      if (sel === '[data-submit-stores]') return submitStores;
      return null;
    },
    addEventListener() {},
  };
  const context = {
    document,
    localStorage,
    sessionStorage,
    fetch() {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ stores: [] }) });
    },
    location: { href: 'submitted.html', search: '', pathname: '/submitted.html' },
    window: {},
    console,
    setTimeout,
    clearTimeout,
    URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} },
    PlaigroundUploadCatalog: require('./upload-catalog'),
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(read('lib/upload-required.js'), context);
  vm.runInNewContext(read('lib/store-pick.js'), context);
  vm.runInNewContext(read('store-client.js'), context);
  return {
    submitTitle,
    submitReleaseDate,
    submitOrder,
    submitWriters,
    submitDeliverDate,
    submitDeliverDatePro,
    submitStores,
  };
}

function run() {
  const html = read('submitted.html');
  const source = read('store-client.js');

  assert.ok(html.includes('data-submit-release-date'), 'confirm bar marks the release date');
  assert.ok(html.includes('data-submit-deliver-date'), 'step-04 deliver line marks the date');
  assert.ok(html.includes('data-submit-order'), 'confirm bar marks the order');
  assert.ok(html.includes('data-submit-writers'), 'step-02 marks writers');
  assert.ok(html.includes('store-client.js?v=20260912a3'), 'submitted.html cache-busts store-client.js at 20260912a3');
  assert.ok(!html.includes('store-client.js?v=20260912a2'), 'submitted.html must cache-bust past 20260912a2');
  assert.ok(!html.includes('PG-2026-0314'), 'must not keep mock order PG-2026-0314');
  assert.ok(!html.includes('12 Sep'), 'must not keep hardcoded 12 Sep');
  assert.ok(!html.includes('M. Hale'), 'must not keep mock writer M. Hale');
  assert.ok(!html.includes('I. Novak'), 'must not keep mock writer I. Novak');
  assert.ok(!/ToneGrid|App Store|\biOS\b|distributor/i.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, '')));
  assert.ok(source.includes('function formatSubmittedDate'));
  assert.ok(source.includes('data-submit-release-date'));
  assert.ok(source.includes('data-submit-deliver-date'));

  const painted = loadSubmitted({
    title: 'Night Drive',
    release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    release_date: '2026-09-18',
    writers: [
      { name: 'Ada Night' },
      { first_name: 'Bea', last_name: 'Night' },
    ],
  });
  assert.strictEqual(painted.submitTitle.textContent, 'Night Drive is in the queue.');
  assert.strictEqual(painted.submitReleaseDate.textContent, 'Sep 18 2026');
  assert.strictEqual(painted.submitDeliverDate.textContent, 'Sep 18 2026');
  assert.strictEqual(painted.submitDeliverDatePro.textContent, 'Sep 18 2026');
  assert.strictEqual(painted.submitOrder.textContent, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.strictEqual(painted.submitWriters.textContent, 'Ada Night and Bea Night get signing links once the scan clears.');

  const solo = loadSubmitted({
    title: 'Night Drive',
    release_date: '2026-09-18',
    solo_owned_100: true,
    legal_first: 'Ada',
    legal_last: 'Night',
  });
  assert.strictEqual(solo.submitReleaseDate.textContent, 'Sep 18 2026');
  assert.strictEqual(solo.submitDeliverDate.textContent, 'Sep 18 2026');
  assert.ok(solo.submitWriters.textContent.indexOf('Ada Night') !== -1);
  assert.ok(solo.submitWriters.textContent.indexOf('Hale') === -1);
  assert.strictEqual(solo.submitOrder.textContent, '—');

  console.log('submitted.confirm.test.js ok');
}

run();
