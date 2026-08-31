'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8');
}

function classList() {
  const tokens = Object.create(null);
  return {
    tokens,
    toggle(name, force) {
      if (force === false) delete tokens[name];
      else if (force) tokens[name] = true;
      else if (tokens[name]) delete tokens[name];
      else tokens[name] = true;
    },
    add(name) { tokens[name] = true; },
    contains(name) { return Boolean(tokens[name]); },
  };
}

function el(opts) {
  opts = opts || {};
  const node = {
    id: opts.id || '',
    value: opts.value != null ? opts.value : '',
    hidden: Boolean(opts.hidden),
    attrs: Object.assign({}, opts.attrs || {}),
    listeners: {},
    classList: classList(),
    setAttribute(name, value) { node.attrs[name] = String(value); },
    getAttribute(name) { return node.attrs[name] == null ? null : node.attrs[name]; },
    addEventListener(type, fn) {
      const key = String(type || '');
      if (!node.listeners[key]) node.listeners[key] = [];
      node.listeners[key].push(fn);
    },
    dispatch(type) {
      const ev = { type: type, target: node, preventDefault() {} };
      (node.listeners[String(type)] || []).forEach(function (fn) { fn(ev); });
    },
  };
  return node;
}

function storage() {
  const data = Object.create(null);
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
    _data: data,
  };
}

function loadPage(opts) {
  opts = opts || {};
  const mode = el({ id: 'tg-artist-mode', value: opts.mode || 'choose' });
  const select = el({ id: 'tg-artist-select', value: opts.artistId || '' });
  const artistHidden = el({ id: 'tg-artist', value: '' });
  const artistNew = el({ id: 'tg-artist-new', value: opts.artistNew || '' });
  const wrapFirst = el({ id: 'tg-legal-first', value: opts.wrapFirst || '' });
  const wrapLast = el({ id: 'tg-legal-last', value: opts.wrapLast || '' });
  const createFirst = el({ id: 'tg-legal-first-create', value: opts.createFirst || '' });
  const createLast = el({ id: 'tg-legal-last-create', value: opts.createLast || '' });
  const wrap = el({ id: 'artist-legal-wrap', hidden: false });
  wrap.attrs['data-artist-legal'] = '';
  const hint = el({ hidden: false });
  hint.attrs['data-artist-legal-hint'] = '';
  const choose = el({ id: 'artist-choose-wrap', hidden: opts.mode === 'create' || opts.mode === 'link' });
  const createWrap = el({ id: 'artist-create-wrap', hidden: opts.mode !== 'create' });
  const link = el({ id: 'artist-link-wrap', hidden: opts.mode !== 'link' });
  const byId = {
    'tg-artist-mode': mode,
    'tg-artist-select': select,
    'tg-artist': artistHidden,
    'tg-artist-new': artistNew,
    'tg-legal-first': wrapFirst,
    'tg-legal-last': wrapLast,
    'tg-legal-first-create': createFirst,
    'tg-legal-last-create': createLast,
    'artist-legal-wrap': wrap,
    'artist-choose-wrap': choose,
    'artist-create-wrap': createWrap,
    'artist-link-wrap': link,
  };
  const account = opts.account || {
    artist: 'Victoria',
    username: 'victoria',
    profile: {
      legal_name: 'Victoria',
      artists: opts.artists || [],
    },
  };
  let readyResolve;
  const ready = new Promise(function (resolve) { readyResolve = resolve; });
  const local = storage();
  const session = storage();
  if (opts.remembered) {
    local.setItem('plaiground.artist.legal', JSON.stringify(opts.remembered));
  }
  if (opts.draft) {
    local.setItem('plaiground.store.draft', JSON.stringify(opts.draft));
  }
  const context = {
    document: {
      readyState: 'loading',
      getElementById(id) { return byId[id] || null; },
      querySelector(sel) {
        if (sel === '[data-artist-legal]') return wrap;
        if (sel === '[data-artist-legal-hint]') return hint;
        if (sel === '[data-upload-save-draft]') return null;
        return null;
      },
      querySelectorAll() { return []; },
      addEventListener() {},
    },
    localStorage: local,
    sessionStorage: session,
    location: { href: 'upload.html' },
    PlaigroundMembership: {
      account() { return account; },
      whenReady() { return ready; },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(read('release-credits.js'), context);
  vm.runInNewContext(read('upload-credits.js'), context);
  context.PlaigroundUploadCredits.bind(context.document);
  return {
    api: context.PlaigroundUploadCredits,
    mode,
    select,
    wrap,
    hint,
    wrapFirst,
    wrapLast,
    createFirst,
    createLast,
    account,
    readyResolve,
    local,
    context,
  };
}

function visibleLegalPairs(page) {
  const pairs = [];
  if (!page.wrap.hidden) pairs.push('wrap');
  return pairs;
}

async function run() {
  const src = read('upload-credits.js');
  assert.ok(!/syncCreateLegal/.test(src), 'do not copy wrap legal values into create fields');
  assert.ok(!/setVal\('tg-legal-first-create'/.test(src), 'create legal fields must not be prefilled');
  assert.ok(!/rememberedLegal/.test(src) || !/setVal\('tg-legal-first-create'/.test(src));

  const createPage = loadPage({
    mode: 'create',
    remembered: { first: 'Victoria', last: 'Reyes' },
    draft: { legal_first: 'Victoria', legal_last: 'Reyes' },
    artists: [{ id: 'acct', name: 'Victoria', legal_first: 'Victoria', legal_last: 'Reyes' }],
    artistId: 'acct',
  });
  assert.strictEqual(createPage.wrap.hidden, true, 'Create new hides the existing-artist wrap pair');
  assert.ok(createPage.wrap.classList.contains('is-hidden'), 'Create new marks wrap hidden');
  assert.strictEqual(createPage.hint.hidden, true, 'Create new hides wrap prefill hint');
  assert.strictEqual(createPage.createFirst.value, '', 'Create new legal first starts empty');
  assert.strictEqual(createPage.createLast.value, '', 'Create new legal last starts empty');
  assert.strictEqual(createPage.wrapFirst.value, '', 'hidden wrap pair must not keep an account name');
  assert.strictEqual(visibleLegalPairs(createPage).length, 0, 'only the create pair stays on Create new');
  const created = createPage.api.collectPageFields();
  assert.strictEqual(created.artist_mode, 'create');
  assert.strictEqual(created.creating_artist, true);
  assert.strictEqual(created.legal_first, '', 'create collect must not take the account first name');
  assert.strictEqual(created.legal_last, '', 'create collect must not take the account last name');

  createPage.readyResolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(createPage.createFirst.value, '', 'membership ready must not fill create first from the account');
  assert.strictEqual(createPage.createLast.value, '', 'membership ready must not fill create last from the account');

  createPage.createFirst.value = 'Victoria';
  createPage.createFirst.dispatch('input');
  createPage.createFirst.value = '';
  createPage.createFirst.dispatch('input');
  createPage.createFirst.dispatch('change');
  createPage.api.prefillLegal(createPage.context.document);
  assert.strictEqual(createPage.createFirst.value, '', 'emptying a create field must not refill from the account');

  const pickPage = loadPage({
    mode: 'choose',
    remembered: { first: 'Victoria', last: 'Reyes' },
    draft: { legal_first: 'Victoria', legal_last: 'Reyes' },
    artistId: 'act-2',
    artists: [
      { id: 'acct', name: 'Victoria', legal_first: 'Victoria', legal_last: 'Reyes' },
      { id: 'act-2', name: 'Night Drive', legal_first: 'Ada', legal_last: 'Night' },
    ],
  });
  assert.strictEqual(pickPage.wrap.hidden, false, 'existing artist keeps the wrap pair');
  assert.strictEqual(pickPage.wrapFirst.value, 'Ada', 'wrap first prefills from the picked artist');
  assert.strictEqual(pickPage.wrapLast.value, 'Night', 'wrap last prefills from the picked artist');
  assert.notStrictEqual(pickPage.wrapFirst.value, 'Victoria', 'wrap first must not use the account name');
  assert.strictEqual(pickPage.createFirst.value, '', 'create pair stays empty while choosing an existing artist');

  pickPage.select.value = 'acct';
  pickPage.select.dispatch('change');
  assert.strictEqual(pickPage.wrapFirst.value, 'Victoria');
  assert.strictEqual(pickPage.wrapLast.value, 'Reyes');
  pickPage.select.value = 'act-2';
  pickPage.select.dispatch('change');
  assert.strictEqual(pickPage.wrapFirst.value, 'Ada', 'switching artists prefills from that artist, not the account');
  assert.strictEqual(pickPage.wrapLast.value, 'Night');

  pickPage.mode.value = 'create';
  pickPage.mode.dispatch('change');
  assert.strictEqual(pickPage.wrap.hidden, true, 'switching to Create new hides the wrap pair');
  assert.strictEqual(pickPage.createFirst.value, '', 'switching to Create new does not copy artist or account names');
  assert.strictEqual(pickPage.createLast.value, '');
  assert.strictEqual(pickPage.wrapFirst.value, '', 'hidden wrap is cleared so it cannot leak into submit');

  console.log('lib/upload-credits.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
