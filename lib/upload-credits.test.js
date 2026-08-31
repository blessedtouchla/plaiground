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
  const artistHidden = el({ id: 'tg-artist', value: opts.artist || '' });
  const artistNew = el({ id: 'tg-artist-new', value: opts.artistNew || '' });
  const title = el({ id: 'tg-title', value: opts.title || '' });
  const featured = el({ id: 'tg-featured', value: opts.featured || '' });
  const genre = el({ id: 'tg-genre', value: opts.genre || '' });
  const language = el({ id: 'tg-language', value: opts.language || '' });
  const price = el({ id: 'tg-price', value: opts.price || '' });
  const lyrics = el({ id: 'tg-lyrics', value: opts.lyrics || '' });
  const instrumental = el({ id: 'tg-instrumental', value: '' });
  instrumental.checked = Boolean(opts.instrumental);
  instrumental.type = 'checkbox';
  const wrapFirst = el({ id: 'tg-legal-first', value: opts.wrapFirst || '' });
  const wrapLast = el({ id: 'tg-legal-last', value: opts.wrapLast || '' });
  const createFirst = el({ id: 'tg-legal-first-create', value: opts.createFirst || '' });
  const createLast = el({ id: 'tg-legal-last-create', value: opts.createLast || '' });
  const label = el({ id: 'tg-label', value: opts.label != null ? opts.label : '' });
  const copyrightOwner = el({ id: 'tg-copyright-owner', value: opts.copyrightOwner || '' });
  const phonogramOwner = el({ id: 'tg-phonogram-owner', value: opts.phonogramOwner || '' });
  const copyrightYear = el({ id: 'tg-copyright-year', value: opts.copyrightYear || '' });
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
    'tg-title': title,
    'tg-featured': featured,
    'tg-genre': genre,
    'tg-language': language,
    'tg-price': price,
    'tg-lyrics': lyrics,
    'tg-instrumental': instrumental,
    'tg-legal-first': wrapFirst,
    'tg-legal-last': wrapLast,
    'tg-legal-first-create': createFirst,
    'tg-legal-last-create': createLast,
    'tg-label': label,
    'tg-copyright-owner': copyrightOwner,
    'tg-phonogram-owner': phonogramOwner,
    'tg-copyright-year': copyrightYear,
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
    location: { href: opts.href || 'upload.html', search: opts.search || '' },
    fetchCalls: [],
    fetch() {
      context.fetchCalls.push({ url: arguments[0], opts: arguments[1] });
      return Promise.resolve({ ok: true, json: async function () { return {}; } });
    },
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
    title,
    wrap,
    hint,
    wrapFirst,
    wrapLast,
    createFirst,
    createLast,
    label,
    copyrightOwner,
    phonogramOwner,
    copyrightYear,
    account,
    readyResolve,
    local,
    context,
    fetchCalls: context.fetchCalls,
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
  assert.strictEqual(createPage.label.value, '', 'Record label starts empty');
  assert.ok(!/readonly/i.test(createPage.label.getAttribute('readonly') || ''), 'Record label is not locked');
  assert.ok(!/Victoria/i.test(createPage.copyrightOwner.value), '© must not use the account name on create');
  assert.ok(!/Victoria/i.test(createPage.phonogramOwner.value), '℗ must not use the account name on create');
  assert.ok(createPage.copyrightOwner.value.indexOf('PLAIGROUND') === -1, '© is never PLAIGROUND');
  assert.ok(createPage.phonogramOwner.value.indexOf('PLAIGROUND') === -1, '℗ is never PLAIGROUND');
  assert.ok(createPage.copyrightYear.value, 'year is prefilled');
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

  createPage.createFirst.value = 'Ada';
  createPage.createLast.value = 'Night';
  createPage.createFirst.dispatch('input');
  createPage.createLast.dispatch('input');
  assert.strictEqual(createPage.copyrightOwner.value, 'Ada Night', '© prefills from the typed songwriter');
  assert.strictEqual(createPage.phonogramOwner.value, 'Ada Night', '℗ prefills from the typed songwriter');
  createPage.copyrightOwner.value = 'Jane Doe';
  createPage.copyrightOwner.dispatch('input');
  createPage.createLast.value = 'Stone';
  createPage.createLast.dispatch('input');
  assert.strictEqual(createPage.copyrightOwner.value, 'Jane Doe', 'typed © is kept when legal names change');
  assert.strictEqual(createPage.phonogramOwner.value, 'Ada Stone', '℗ still tracks the songwriter until they edit it');
  createPage.label.value = 'Night Records';
  createPage.label.dispatch('input');
  assert.strictEqual(createPage.label.value, 'Night Records', 'typed record label is kept');
  createPage.createFirst.value = 'Victoria';
  createPage.createFirst.dispatch('input');
  createPage.createFirst.value = '';
  createPage.createFirst.dispatch('input');
  createPage.createFirst.dispatch('change');
  createPage.api.prefillLegal(createPage.context.document);
  assert.strictEqual(createPage.createFirst.value, '', 'emptying a create field must not refill from the account');
  assert.strictEqual(createPage.copyrightOwner.value, 'Jane Doe', 'empty first does not refill © from the account');
  assert.ok(createPage.phonogramOwner.value.indexOf('Victoria') === -1, 'empty first does not put Victoria on ℗');

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
  assert.strictEqual(pickPage.copyrightOwner.value, 'Ada Night', '© prefills from the picked artist legal name');
  assert.strictEqual(pickPage.phonogramOwner.value, 'Ada Night', '℗ prefills from the picked artist legal name');
  assert.strictEqual(pickPage.label.value, '', 'existing-artist label stays empty');

  const restored = loadPage({
    mode: 'choose',
    artistId: 'act-2',
    artists: [{ id: 'act-2', name: 'Night Drive', legal_first: 'Ada', legal_last: 'Night' }],
    draft: {
      label: 'Night Records',
      copyright_holder: 'Jane Doe',
      master_owner: 'Ada Night',
      copyright_year: '2025',
    },
  });
  assert.strictEqual(restored.label.value, 'Night Records', 'typed label restores from the draft');
  assert.strictEqual(restored.copyrightOwner.value, 'Jane Doe', 'typed © restores from the draft');
  assert.strictEqual(restored.phonogramOwner.value, 'Ada Night');
  assert.strictEqual(restored.copyrightYear.value, '2025');

  const lockedDraft = loadPage({
    mode: 'choose',
    artistId: 'act-2',
    artists: [{ id: 'act-2', name: 'Night Drive', legal_first: 'Ada', legal_last: 'Night' }],
    draft: { label: 'PLAIGROUND' },
  });
  assert.strictEqual(lockedDraft.label.value, '', 'old locked PLAIGROUND label does not refill the box');

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

  pickPage.createFirst.value = 'Ada';
  pickPage.createLast.value = 'German Nunez';
  const twoWord = pickPage.api.collectPageFields();
  assert.strictEqual(twoWord.legal_last, 'German Nunez');
  const credits = pickPage.context.PlaigroundReleaseCredits;
  assert.ok(credits.validateLegalName(twoWord.legal_first, twoWord.legal_last).ok);
  assert.ok(credits.validateUploadLegal(twoWord).ok, 'create + two-word last must pass required-only legal check');
  const emptyLast = credits.validateUploadLegal({
    artist_mode: 'create',
    legal_first: 'Ada',
    legal_last: '',
  });
  assert.strictEqual(emptyLast.error, credits.LEGAL_BOTH);
  assert.ok(!/stage name|rapper|\bband\b/i.test(emptyLast.error));

  const savePage = loadPage({
    mode: 'choose',
    title: 'The Interceptors',
    artist: 'The Interceptors',
    wrapFirst: 'German',
    wrapLast: 'Nunez',
    artistId: 'act-2',
    artists: [{ id: 'act-2', name: 'The Interceptors', legal_first: 'German', legal_last: 'Nunez' }],
  });
  savePage.title.value = 'The Interceptors';
  await savePage.api.saveDraft('');
  const saved = JSON.parse(savePage.local.getItem('plaiground.store.draft') || '{}');
  assert.strictEqual(saved.saved_draft, true, 'saveDraft writes saved_draft');
  assert.strictEqual(saved.title, 'The Interceptors');
  assert.strictEqual(saved.tonegrid_status, 'draft');
  assert.ok(!savePage.fetchCalls.some(function (call) {
    return /\/api\/tonegrid\/releases/.test(String(call.url || ''));
  }), 'Save draft never POSTs /releases');
  assert.ok(!/'[^']*ToneGrid[^']*'|"[^"]*ToneGrid[^"]*"/.test(src));
  assert.ok(!/DistroKid/i.test(src));

  const reopen = loadPage({
    mode: 'choose',
    artistId: 'act-2',
    artists: [{ id: 'act-2', name: 'The Interceptors', legal_first: 'German', legal_last: 'Nunez' }],
    draft: {
      saved_draft: true,
      tonegrid_status: 'draft',
      title: 'The Interceptors',
      name: 'The Interceptors',
      legal_first: 'German',
      legal_last: 'Nunez',
    },
  });
  assert.strictEqual(reopen.title.value, 'The Interceptors', 'upload restore fills title');
  assert.strictEqual(reopen.wrapFirst.value, 'German');
  assert.strictEqual(reopen.wrapLast.value, 'Nunez');

  console.log('lib/upload-credits.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
