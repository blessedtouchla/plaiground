'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const releaseStatus = require('./lib/release-status');
const QC_LINES = releaseStatus.STORE_QC_LINES.join('\n');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function makeEl(attrs) {
  const el = {
    hidden: Boolean(attrs && attrs.hidden),
    textContent: (attrs && attrs.textContent) || '',
    className: (attrs && attrs.className) || '',
    value: attrs && attrs.value != null ? attrs.value : '',
    disabled: Boolean(attrs && attrs.disabled),
    checked: Boolean(attrs && attrs.checked),
    type: (attrs && attrs.type) || '',
    files: (attrs && attrs.files) || [],
    options: (attrs && attrs.options) || [],
    style: {},
    children: [],
    attrs: Object.assign({}, (attrs && attrs.attrs) || {}),
    classList: {
      tokens: Object.create(null),
      toggle(name, force) {
        if (force === false) delete this.tokens[name];
        else if (force) this.tokens[name] = true;
        else if (this.tokens[name]) delete this.tokens[name];
        else this.tokens[name] = true;
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
    removeAttribute(name) {
      delete this.attrs[name];
    },
    appendChild(child) {
      this.children.push(child);
      if (this.options) this.options.push(child);
      return child;
    },
    querySelectorAll(sel) {
      if (sel === 'input[type="checkbox"]:checked') {
        return this.children.filter((child) => child && child.checked && child.type === 'checkbox');
      }
      return this.children.filter((child) => child && child.sel === sel);
    },
    closest(sel) {
      return sel === '.field' ? this.field || el : null;
    },
    addEventListener(type, fn) {
      this.listeners = this.listeners || {};
      if (!this._listeners) this._listeners = Object.create(null);
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(fn);
      const node = this;
      this.listeners[type] = function (event) {
        const list = node._listeners[type] || [];
        let i;
        for (i = 0; i < list.length; i += 1) list[i](event);
      };
    },
    showPicker() {
      this.pickerOpened = (this.pickerOpened || 0) + 1;
    },
    setCustomValidity(msg) {
      this.customValidity = String(msg || '');
    },
    querySelector(sel) {
      const all = el.querySelectorAll(sel);
      return all[0] || null;
    },
  };
  const prevQueryAll = el.querySelectorAll;
  el.querySelectorAll = function (sel) {
    const out = [];
    function walk(node) {
      if (!node) return;
      if (sel === 'input[type="checkbox"]' || sel === 'input[type="checkbox"]:checked') {
        if (node.type === 'checkbox' && (sel.indexOf(':checked') === -1 || node.checked)) out.push(node);
      } else if (sel.charAt(0) === '[' && sel.charAt(sel.length - 1) === ']') {
        const raw = sel.slice(1, -1);
        const name = raw.split('=')[0];
        if (node.attrs && node.attrs[name] != null) out.push(node);
      } else if (sel.charAt(0) === '.' && String(node.className || '').split(/\s+/).indexOf(sel.slice(1)) !== -1) {
        out.push(node);
      }
      (node.children || []).forEach(walk);
    }
    walk(el);
    if (out.length) return out;
    return prevQueryAll.call(el, sel);
  };
  if (attrs && attrs.life) el.attrs['data-life'] = attrs.life;
  if (attrs && attrs.id) el.id = attrs.id;
  return el;
}

function loadSong(opts) {
  opts = opts || {};
  const calls = opts.calls || [];
  const ids = {
    'edit-title': makeEl({ id: 'edit-title', value: '' }),
    'edit-artist': makeEl({ id: 'edit-artist', value: '' }),
    'edit-genre-type': makeEl({ id: 'edit-genre-type', className: 'typeahead-input', value: '' }),
    'edit-language-type': makeEl({ id: 'edit-language-type', className: 'typeahead-input', value: '' }),
    'edit-featured': makeEl({ id: 'edit-featured', value: '' }),
    'edit-genre': makeEl({ id: 'edit-genre', value: '', options: [{}] }),
    'edit-language': makeEl({ id: 'edit-language', value: '', options: [{}] }),
    'edit-price': makeEl({ id: 'edit-price', value: '$0.99' }),
    'edit-art': makeEl({ id: 'edit-art', files: [] }),
    'edit-audio': makeEl({ id: 'edit-audio', files: [], attrs: { 'data-track-id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } }),
    'edit-instrumental': makeEl({ id: 'edit-instrumental', type: 'checkbox' }),
    'edit-lyrics': makeEl({ id: 'edit-lyrics', value: '' }),
    'edit-release-date': makeEl({ id: 'edit-release-date', value: '2026-09-12' }),
    'edit-preorder-on': makeEl({ id: 'edit-preorder-on', type: 'checkbox' }),
    'edit-preorder-date': makeEl({ id: 'edit-preorder-date', value: '' }),
    'edit-preorder-panel': makeEl({ id: 'edit-preorder-panel', hidden: true }),
    'edit-time-on': makeEl({ id: 'edit-time-on', type: 'checkbox', checked: true }),
    'edit-time-panel': makeEl({ id: 'edit-time-panel' }),
    'edit-release-time': makeEl({ id: 'edit-release-time', value: '00:00' }),
    'edit-release-timezone': makeEl({ id: 'edit-release-timezone', value: 'UTC' }),
  };
  const panel = makeEl({ hidden: true, attrs: { 'data-release-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } });
  const nodes = {
    '[data-song-status]': makeEl({ hidden: true }),
    '[data-song-retry-wrap]': makeEl({ hidden: true }),
    '[data-song-retry]': makeEl({ hidden: true, textContent: 'Retry' }),
    '[data-song-title]': makeEl({}),
    '[data-song-pill]': makeEl({ className: 'pill' }),
    '[data-song-meta]': makeEl({}),
    '[data-song-cover]': makeEl({}),
    '[data-song-cover-note]': makeEl({}),
    '[data-art-clear]': makeEl({ hidden: true }),
    '[data-song-player]': makeEl({}),
    '[data-song-links]': makeEl({ hidden: true }),
    '[data-song-link-list]': makeEl({}),
    '[data-song-stores]': makeEl({}),
    '[data-song-stores-empty]': makeEl({ textContent: 'No store deliveries yet.' }),
    '[data-song-stores-list]': makeEl({ hidden: true }),
    '[data-song-codes]': makeEl({ textContent: 'UPC: Not assigned\nISRC: Not assigned' }),
    '[data-song-streams]': makeEl({ textContent: '0' }),
    '[data-song-earnings]': makeEl({ textContent: '$0.00' }),
    '[data-song-breakdown]': makeEl({ hidden: true }),
    '[data-song-dsps]': makeEl({}),
    '[data-song-breakdown-empty]': makeEl({ hidden: true }),
    '[data-song-writers]': makeEl({}),
    '[data-song-split-status]': makeEl({}),
    '[data-song-split-empty]': makeEl({ hidden: true }),
    '[data-song-split-attest]': makeEl({ hidden: true }),
    '[data-song-split-preview]': makeEl({ hidden: true }),
    '[data-song-split-download]': makeEl({ hidden: true }),
    '[data-song-publishing]': makeEl({ hidden: true }),
    '[data-song-boosts]': makeEl({ hidden: true }),
    '[data-song-boost]': makeEl({ hidden: true }),
    '[data-song-edit]': makeEl({ hidden: true, tagName: 'A', attrs: { href: 'song.html' } }),
    '[data-song-remove]': makeEl({ hidden: true }),
    '[data-song-download]': makeEl({}),
    '[data-song-rejection]': makeEl({ hidden: true }),
    '[data-song-rejection-reason]': makeEl({}),
    '[data-release-edit]': panel,
    '[data-edit-status]': makeEl({}),
    '[data-edit-error]': makeEl({ hidden: true }),
    '[data-edit-stores]': makeEl({}),
    '[data-store-pick]': makeEl({}),
    '[data-store-all]': makeEl({ id: 'edit-store-all', type: 'checkbox', checked: true, attrs: { 'data-store-all': '' } }),
    '[data-store-customize]': makeEl({ attrs: { 'data-store-customize': '' }, textContent: 'Customize' }),
    '[data-store-summary]': makeEl({ attrs: { 'data-store-summary': '' } }),
    '[data-store-list]': makeEl({ attrs: { 'data-store-list': '', 'data-edit-stores': '' } }),
    '[data-edit-attest]': makeEl({ hidden: true }),
    '[data-edit-splits-copy]': makeEl({}),
    '[data-edit-save]': makeEl({}),
    '[data-edit-cancel]': makeEl({}),
    '[data-edit-retry]': makeEl({ hidden: true, textContent: 'Retry' }),
    '[data-edit-troubleshoot]': makeEl({ tagName: 'A', attrs: { href: 'problem.html' } }),
    '[data-language-field]': makeEl({}),
    '[data-edit-lyrics-field]': makeEl({}),
    '#edit-lyrics': ids['edit-lyrics'],
    '#edit-title': ids['edit-title'],
    '#edit-artist': ids['edit-artist'],
    '#edit-featured': ids['edit-featured'],
    '#edit-genre': ids['edit-genre'],
    '#edit-language': ids['edit-language'],
    '#edit-price': ids['edit-price'],
    '#edit-art': ids['edit-art'],
    '#edit-audio': ids['edit-audio'],
    '#edit-instrumental': ids['edit-instrumental'],
    '#edit-release-date': ids['edit-release-date'],
    '#edit-preorder-on': ids['edit-preorder-on'],
    '#edit-preorder-date': ids['edit-preorder-date'],
    '#edit-preorder-panel': ids['edit-preorder-panel'],
    '#edit-time-on': ids['edit-time-on'],
    '#edit-time-panel': ids['edit-time-panel'],
    '#edit-release-time': ids['edit-release-time'],
    '#edit-release-timezone': ids['edit-release-timezone'],
  };
  Object.keys(ids).forEach((id) => { nodes['#' + id] = ids[id]; });
  nodes['[data-store-list]'] = nodes['[data-store-list]'] || nodes['[data-edit-stores]'];
  nodes['[data-edit-stores]'] = nodes['[data-store-list]'];
  const storePick = nodes['[data-store-pick]'];
  storePick.appendChild(nodes['[data-store-all]']);
  storePick.appendChild(nodes['[data-store-customize]']);
  storePick.appendChild(nodes['[data-store-summary]']);
  storePick.appendChild(nodes['[data-store-list]']);
  const life = {
    draft: makeEl({ life: 'draft' }),
    signatures: makeEl({ life: 'signatures' }),
    pending: makeEl({ life: 'pending' }),
    processing: makeEl({ life: 'processing' }),
    live: makeEl({ life: 'live' }),
    removing: makeEl({ life: 'removing' }),
    taken_down: makeEl({ life: 'taken_down' }),
    rejected: makeEl({ life: 'rejected' }),
  };
  const context = {
    Promise,
    setTimeout,
    clearTimeout,
    PlaigroundGonePollMs: 0,
    PlaigroundCatalogTimeoutMs: opts.catalogTimeoutMs || undefined,
    deletedDbs: [],
    localStorage: {
      data: opts.draft ? { 'plaiground.store.draft': JSON.stringify(opts.draft) } : {},
      getItem(key) { return this.data[key] || null; },
      setItem(key, value) { this.data[key] = String(value); },
      removeItem(key) { delete this.data[key]; },
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    URLSearchParams,
    FormData: function FormData() { this.append = function () {}; },
    history: { replaceState() {} },
    document: {
      querySelector(sel) { return nodes[sel] || null; },
      querySelectorAll(sel) {
        if (sel === '[data-life]') return [life.draft, life.signatures, life.pending, life.processing, life.live, life.removing, life.taken_down, life.rejected];
        if (sel === '[data-edit-explicit] [data-explicit]') return [];
        if (sel === '[data-edit-made-how]') return [];
        return [];
      },
      getElementById(id) { return ids[id] || null; },
      createElement() { return makeEl({}); },
      createTextNode(text) { return makeEl({ textContent: text }); },
      body: makeEl({}),
    },
    fetch(url, options) {
      const method = (options && options.method) || 'GET';
      calls.push({ url: String(url), method: method, body: options && options.body });
      if (String(url) === '/api/tonegrid/uploads') {
        const minted = JSON.parse((options && options.body) || '{}');
        const prefix = String(minted.kind || '') === 'cover' ? 'covers' : 'audio';
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            object_key: prefix + '/11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-' + (minted.filename || 'file'),
            upload_url: 'https://hop.test/put',
            headers: { 'Content-Type': minted.content_type || 'application/octet-stream' },
          }),
        });
      }
      if (String(url).indexOf('/api/tonegrid/uploads?key=') === 0 || String(url).indexOf('https://hop.test/') === 0) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ url: 'https://hop.test/get?sig=1' }),
        });
      }
      if (opts.hangWhen && String(url) === opts.hangWhen) {
        opts._hangHits = (opts._hangHits || 0) + 1;
        if (opts._hangHits <= (opts.hangCount || 1)) {
          return new Promise(function () {});
        }
      }
      if (opts.fetch) return opts.fetch(url, options, calls);
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ releases: [], stores: [] }) });
    },
    confirm(message) {
      calls.push({ confirm: message });
      if (typeof opts.confirm === 'function') return opts.confirm(message);
      return opts.confirm !== false;
    },
    location: { href: opts.href || 'song.html', search: opts.search || '', pathname: '/song.html' },
    window: {},
    globalThis: null,
    PlaigroundMembership: {
      currentPlan() { return opts.plan || 'basic'; },
      applyPlanCopy() {},
      whenReady(cb) {
        const result = Promise.resolve({ ok: true, data: opts.me || null });
        if (typeof cb === 'function') result.then(cb);
        return result;
      },
      account() { return opts.me || null; },
      clearNewReleaseState() {
        context.localStorage.removeItem('plaiground.store.draft');
        context.localStorage.removeItem('plaiground.tonegrid.draft');
        context.deletedDbs.push('plaiground-held-audio');
      },
    },
    PlaigroundUploadCatalog: {
      GENRES: ['Electronic', 'Pop', 'Hip-Hop', 'Afrobeats'],
      LANGUAGES: [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
      ],
      canonicalCatalogValue(_select, raw) {
        const v = String(raw || '').trim();
        if (!v) return '';
        const genres = ['Electronic', 'Pop', 'Hip-Hop', 'Afrobeats'];
        for (let i = 0; i < genres.length; i += 1) {
          if (genres[i].toLowerCase() === v.toLowerCase()) return genres[i];
        }
        const langs = [
          { code: 'en', name: 'English' },
          { code: 'es', name: 'Spanish' },
          { code: 'fr', name: 'French' },
        ];
        for (let i = 0; i < langs.length; i += 1) {
          if (langs[i].code === v.toLowerCase() || langs[i].name.toLowerCase() === v.toLowerCase()) return langs[i].code;
        }
        return null;
      },
      setTypeaheadValue(select, value) {
        if (select) select.value = value || '';
        return select ? select.value : '';
      },
      syncTypeahead() {},
      fillUploadSelects() {},
    },
  };
  context.deletedDbs = [];
  context.window = context;
  context.globalThis = context;
  context.document.createElement = function () { return makeEl({}); };
  context.document.createTextNode = function (text) { return makeEl({ textContent: text }); };
  context.URL = {
    createObjectURL(file) { return 'blob:cover-' + (file && file.name ? file.name : 'file'); },
    revokeObjectURL() {},
  };
  context.addEventListener = function () {};
  vm.runInNewContext(read('lib/release-status.js'), context);
  vm.runInNewContext(read('lib/live-player.js'), context);
  vm.runInNewContext(read('lib/audio-accept.js'), context);
  vm.runInNewContext(read('lib/store-pick.js'), context);
  vm.runInNewContext(read('lib/cover-preview.js'), context);
  vm.runInNewContext(read('lib/object-hop.js'), context);
  vm.runInNewContext(read('lib/statement-pdf.js'), context);
  vm.runInNewContext(read('lib/split-sheets.js'), context);
  vm.runInNewContext(read('song.js'), context);
  return { api: context.PlaigroundSong, nodes, life, ids, calls, context };
}

function openFilledEdit(page, extraDraft) {
  page.ids['edit-title'].value = 'Fuvtu Edit';
  page.ids['edit-genre'].value = 'Electronic';
  page.ids['edit-language'].value = 'en';
  page.ids['edit-release-date'].value = '2026-09-12';
  page.ids['edit-lyrics'].value = 'City lights, I stay';
  page.api.openEdit({
    me: {
      artist: 'Fuvtu',
      plan: 'basic',
      tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    },
    draft: Object.assign({
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      made_how: 'no_ai',
      rights_confirmed: true,
      submitted: true,
      track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    }, extraDraft || {}),
    release: {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      status: 'pending',
      genre: 'Electronic',
      language: 'en',
      release_date: '2026-08-24',
      artist: 'Fuvtu',
      tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu' }],
      dsps: ['spotify'],
    },
  });
  page.ids['edit-title'].value = 'Fuvtu Edit';
  page.ids['edit-genre'].value = 'Electronic';
  page.ids['edit-language'].value = 'en';
  page.ids['edit-release-date'].value = '2026-09-12';
  page.ids['edit-lyrics'].value = 'City lights, I stay';
}

function testEditSubmitLeftovers() {
  const multiCalls = [];
  const multi = loadSong({
    plan: 'basic',
    me: {
      artist: 'Fuvtu',
      plan: 'basic',
      tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    },
    search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    calls: multiCalls,
    fetch(url, options) {
      const method = (options && options.method) || 'GET';
      if (method === 'POST' && /\/submit$/.test(String(url))) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Create the split sheet before submitting.', code: 'SIGNWELL_REQUIRED' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, status: 'pending' }) });
    },
  });
  openFilledEdit(multi, {
    solo_owned_100: false,
    writers: [{ name: 'Fuvtu', share: 50 }, { name: 'Ada', share: 50 }],
  });
  return multi.api.submitEdit().then(function (result) {
    assert.ok(result.ok, 'multi-writer can still edit while a split is awaiting');
    assert.strictEqual(result.applied, true);
    assert.ok(!multiCalls.some((row) => row.method === 'PUT' && /\/api\/tonegrid\//.test(row.url)), 'pending edit must not wait on the store');
    assert.ok(!multiCalls.some((row) => row.method === 'POST' && /\/submit$/.test(row.url)), 'edit must not block on a split sheet submit');
    assert.ok(!/edit-submitted\.html/.test(String(multi.context.location.href)), 'pending edit stays on the song');
    assert.strictEqual(multi.nodes['[data-song-title]'].textContent, 'Fuvtu Edit');
    assert.ok(!/Create the split sheet/.test(multi.nodes['[data-edit-error]'].textContent));
    assert.ok(!/ToneGrid/i.test(multi.nodes['[data-edit-error]'].textContent));
    assert.ok(!/Submitting edit to the store/.test(multi.nodes['[data-edit-error]'].textContent));

    const awaitingCalls = [];
    const awaiting = loadSong({
      plan: 'basic',
      me: {
        artist: 'Fuvtu',
        plan: 'basic',
        tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      },
      search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      calls: awaitingCalls,
      fetch(url, options) {
        const method = (options && options.method) || 'GET';
        if (method === 'POST' && /\/submit$/.test(String(url))) {
          return Promise.resolve({
            ok: false,
            status: 403,
            json: async () => ({ error: 'Create the split sheet before submitting.', code: 'SIGNWELL_REQUIRED' }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, status: 'signatures' }) });
      },
    });
    awaiting.ids['edit-title'].value = 'Fuvtu Edit';
    awaiting.ids['edit-genre'].value = 'Electronic';
    awaiting.ids['edit-language'].value = 'en';
    awaiting.ids['edit-release-date'].value = '2026-09-12';
    awaiting.api.openEdit({
      me: {
        artist: 'Fuvtu',
        plan: 'basic',
        tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      },
      draft: {
        release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Fuvtu',
        made_how: 'no_ai',
        rights_confirmed: true,
        solo_owned_100: false,
        submitted: false,
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        writers: [{ name: 'Fuvtu', share: 50 }, { name: 'Ada', share: 50 }],
      },
      release: {
        uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Fuvtu',
        status: 'signatures',
        genre: 'Electronic',
        language: 'en',
        release_date: '2026-08-24',
        artist: 'Fuvtu',
        tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu' }],
        dsps: ['spotify'],
      },
    });
    awaiting.ids['edit-title'].value = 'Fuvtu Edit';
    awaiting.ids['edit-genre'].value = 'Electronic';
    awaiting.ids['edit-language'].value = 'en';
    awaiting.ids['edit-release-date'].value = '2026-09-12';
    return awaiting.api.submitEdit().then(function (awaitingResult) {
      assert.ok(awaitingResult.ok, 'awaiting-split edit must save without a new split');
      assert.strictEqual(awaitingResult.applied, true);
      assert.ok(!awaitingCalls.some((row) => row.method === 'POST' && /\/submit$/.test(row.url)));
      assert.ok(!awaitingCalls.some((row) => row.method === 'PUT' && /\/api\/tonegrid\//.test(row.url)));
      assert.ok(!/edit-submitted\.html/.test(String(awaiting.context.location.href)));
      assert.strictEqual(awaiting.nodes['[data-song-title]'].textContent, 'Fuvtu Edit');
      assert.ok(!/Create the split sheet/.test(awaiting.nodes['[data-edit-error]'].textContent));
    }).then(function () {

    const timedCalls = [];
    const timed = loadSong({
      plan: 'basic',
      me: {
        artist: 'Fuvtu',
        plan: 'basic',
        tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      },
      search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      catalogTimeoutMs: 40,
      hangWhen: '/api/tonegrid/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      hangCount: 1,
      calls: timedCalls,
      fetch(url, options) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            status: 'live',
            uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            title: 'Fuvtu',
            releases: [{ uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Fuvtu', status: 'live' }],
          }),
        });
      },
    });
    openFilledEdit(timed, { solo_owned_100: true });
    timed.api.openEdit({
      me: {
        artist: 'Fuvtu',
        plan: 'basic',
        tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      },
      draft: {
        release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Fuvtu',
        made_how: 'no_ai',
        rights_confirmed: true,
        solo_owned_100: true,
        submitted: true,
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      release: {
        uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Fuvtu',
        status: 'live',
        genre: 'Electronic',
        language: 'en',
        release_date: '2026-08-24',
        artist: 'Fuvtu',
        tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu' }],
        dsps: ['spotify'],
      },
    });
    timed.ids['edit-title'].value = 'Fuvtu Edit';
    timed.ids['edit-genre'].value = 'Electronic';
    timed.ids['edit-language'].value = 'en';
    timed.ids['edit-release-date'].value = '2026-09-12';
    return timed.api.submitEdit().then(function (first) {
      assert.strictEqual(first.ok, false);
      assert.ok(first.timedOut, 'live edit times out when the store does not answer');
      assert.match(timed.nodes['[data-edit-error]'].textContent, /could not reach the store/i);
      assert.ok(!/ToneGrid/i.test(timed.nodes['[data-edit-error]'].textContent));
      assert.strictEqual(timed.nodes['[data-edit-retry]'].hidden, false);
      assert.strictEqual(timed.nodes['[data-edit-retry]'].textContent, 'Retry');
      assert.ok(!/edit-submitted\.html/.test(String(timed.context.location.href)));
      return timed.api.submitEdit().then(function (retry) {
        assert.ok(retry.ok, 'Retry after timeout must succeed');
        assert.ok(/edit-submitted\.html/.test(String(timed.context.location.href)));
        assert.strictEqual(timed.nodes['[data-edit-retry]'].hidden, true);
      });
    });
  }).then(function () {
    const coverCalls = [];
    const cover = loadSong({
      plan: 'basic',
      me: {
        artist: 'Fuvtu',
        plan: 'basic',
        tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      },
      search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      calls: coverCalls,
      fetch(url, options) {
        const method = (options && options.method) || 'GET';
        if (method === 'POST' && /\/submit$/.test(String(url))) {
          return new Promise(function () {});
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, status: 'pending', artwork_url: 'https://cdn.example/cover.jpg' }),
        });
      },
    });
    openFilledEdit(cover, { solo_owned_100: true, submitted: true });
    cover.ids['edit-art'].files = [{ name: 'new-cover.jpg', type: 'image/jpeg' }];
    return cover.api.submitEdit().then(function (result) {
      assert.ok(result.ok, 'pending cover change applies without waiting on the store');
      assert.strictEqual(result.applied, true);
      assert.ok(!coverCalls.some((row) => row.method === 'POST' && /\/artwork$/.test(row.url)));
      assert.ok(!coverCalls.some((row) => row.method === 'POST' && /\/submit$/.test(row.url)));
      assert.ok(!/edit-submitted\.html/.test(String(cover.context.location.href)));
      assert.strictEqual(cover.nodes['[data-song-title]'].textContent, 'Fuvtu Edit');
      assert.ok(!/Submitting edit to the store/.test(cover.nodes['[data-edit-error]'].textContent));
      assert.ok(!/ToneGrid/i.test(cover.nodes['[data-edit-error]'].textContent));

      const hangCoverCalls = [];
      const hangCover = loadSong({
        plan: 'basic',
        me: {
          artist: 'Fuvtu',
          plan: 'basic',
          tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
        },
        search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        catalogTimeoutMs: 40,
        hangWhen: '/api/tonegrid/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/artwork',
        hangCount: 1,
        calls: hangCoverCalls,
        fetch(url, options) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              status: 'live',
              uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              title: 'Fuvtu',
              releases: [{ uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Fuvtu', status: 'live' }],
            }),
          });
        },
      });
      hangCover.ids['edit-title'].value = 'Fuvtu Edit';
      hangCover.ids['edit-genre'].value = 'Electronic';
      hangCover.ids['edit-language'].value = 'en';
      hangCover.ids['edit-release-date'].value = '2026-09-12';
      hangCover.api.openEdit({
        me: {
          artist: 'Fuvtu',
          plan: 'basic',
          tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
        },
        draft: {
          release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          title: 'Fuvtu',
          made_how: 'no_ai',
          rights_confirmed: true,
          solo_owned_100: true,
          submitted: true,
          track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        },
        release: {
          uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          title: 'Fuvtu',
          status: 'live',
          genre: 'Electronic',
          language: 'en',
          release_date: '2026-08-24',
          artist: 'Fuvtu',
          tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu' }],
          dsps: ['spotify'],
        },
      });
      hangCover.ids['edit-art'].files = [{ name: 'new-cover.jpg', type: 'image/jpeg' }];
      hangCover.ids['edit-title'].value = 'Fuvtu Edit';
      hangCover.ids['edit-genre'].value = 'Electronic';
      hangCover.ids['edit-language'].value = 'en';
      return hangCover.api.submitEdit().then(function (first) {
        assert.strictEqual(first.ok, false);
        assert.ok(first.timedOut);
        assert.match(hangCover.nodes['[data-edit-error]'].textContent, /could not reach the store/i);
        assert.ok(!/ToneGrid/i.test(hangCover.nodes['[data-edit-error]'].textContent));
        assert.strictEqual(hangCover.nodes['[data-edit-retry]'].hidden, false);
        assert.ok(!/edit-submitted\.html/.test(String(hangCover.context.location.href)));
        return hangCover.api.submitEdit().then(function (again) {
          assert.ok(again.ok, 'Retry after a hung live cover upload must confirm');
          assert.ok(/edit-submitted\.html/.test(String(hangCover.context.location.href)));
          return testAllPlanEditRule();
        });
      });
    });
  });
  });
}

function testAllPlanEditRule() {
  assert.ok(read('song.js').includes('var liveEdit = isLiveConfirmed'));
  assert.ok(!/liveEdit = .*\.plan/.test(read('song.js')), 'pending vs live is not a plan gate');
  function one(plan, status, title) {
    const me = {
      artist: 'Fuvtu',
      plan: plan,
      tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    };
    const calls = [];
    const page = loadSong({
      plan: plan,
      me: me,
      search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      calls: calls,
      fetch() {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            status: status,
            uuid: me.tonegrid_release_ids[0],
            title: 'Fuvtu',
            releases: [{ uuid: me.tonegrid_release_ids[0], title: 'Fuvtu', status: status }],
          }),
        });
      },
    });
    page.ids['edit-title'].value = title;
    page.ids['edit-genre'].value = 'Electronic';
    page.ids['edit-language'].value = 'en';
    page.ids['edit-release-date'].value = '2026-09-12';
    page.api.openEdit({
      me: me,
      draft: {
        release_id: me.tonegrid_release_ids[0],
        title: 'Fuvtu',
        made_how: 'no_ai',
        submitted: true,
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      release: {
        uuid: me.tonegrid_release_ids[0],
        title: 'Fuvtu',
        status: status,
        genre: 'Electronic',
        language: 'en',
        tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu' }],
        dsps: ['spotify'],
      },
    });
    page.ids['edit-title'].value = title;
    page.ids['edit-genre'].value = 'Electronic';
    page.ids['edit-language'].value = 'en';
    return page.api.submitEdit().then(function (result) {
      if (status === 'live') {
        assert.ok(result.ok, plan + ' live edit still goes to the store');
        assert.ok(!result.applied);
        assert.ok(calls.some((row) => row.method === 'PUT' && /\/api\/tonegrid\//.test(row.url)));
        assert.ok(/edit-submitted\.html/.test(String(page.context.location.href)));
        return;
      }
      assert.ok(result.applied, plan + ' pending applies immediately');
      assert.ok(!calls.some((row) => row.method && row.method !== 'GET' && /\/api\/tonegrid\//.test(row.url)));
      assert.strictEqual(page.nodes['[data-song-title]'].textContent, title);
    });
  }
  return one('basic', 'pending', 'Basic Pending')
    .then(function () { return one('creator', 'pending', 'Creator Pending'); })
    .then(function () { return one('pro', 'pending', 'Pro Pending'); })
    .then(function () { return one('creator', 'live', 'Creator Live'); })
    .then(function () { return one('pro', 'live', 'Pro Live'); });
}

function testSongLoadHangRetry() {
  const basicMe = {
    artist: 'Fuvtu',
    plan: 'basic',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  };
  const hung = loadSong({
    plan: 'basic',
    me: basicMe,
    search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    catalogTimeoutMs: 40,
    hangWhen: '/api/tonegrid/releases',
    hangCount: 1,
    draft: {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Mexeu',
      submitted: true,
    },
  });
  return new Promise(function (resolve) { setTimeout(resolve, 80); }).then(function () {
    assert.match(hung.nodes['[data-song-status]'].textContent, /could not reach the store/i);
    assert.ok(!/ToneGrid/i.test(hung.nodes['[data-song-status]'].textContent));
    assert.strictEqual(hung.nodes['[data-song-retry-wrap]'].hidden, false);
    assert.strictEqual(hung.nodes['[data-song-retry]'].textContent, 'Retry');
    assert.strictEqual(hung.nodes['[data-song-title]'].textContent, 'Mexeu');
    const before = hung.calls.filter(function (call) {
      return call.url === '/api/tonegrid/releases';
    }).length;
    hung.nodes['[data-song-retry]'].listeners.click({ preventDefault() {} });
    return new Promise(function (resolve) { setTimeout(resolve, 20); }).then(function () {
      const after = hung.calls.filter(function (call) {
        return call.url === '/api/tonegrid/releases';
      }).length;
      assert.ok(after > before, 'Retry must GET the catalog again');
    });
  });
}

function testEditLiveStoreCount() {
  const catalog87 = [];
  for (let i = 0; i < 87; i += 1) catalog87.push({ slug: 'live-' + i, name: 'Live ' + i });
  const page = loadSong({
    fetch(url) {
      if (String(url).indexOf('/api/tonegrid/stores') !== -1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ stores: catalog87 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ releases: [] }) });
    },
  });
  page.api.openEdit({
    me: { artist: 'Fuvtu', plan: 'basic', tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] },
    draft: {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      made_how: 'no_ai',
      dsps_all: true,
    },
    release: {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      status: 'pending',
      dsps: [],
    },
  });
  return new Promise(function (resolve) { setImmediate(resolve); }).then(function () {
    return new Promise(function (resolve) { setImmediate(resolve); });
  }).then(function () {
    const summary = page.nodes['[data-store-summary]'].textContent;
    assert.strictEqual(summary, 'All 87 stores will receive this release.');
    assert.ok(summary.indexOf('55') === -1);
    assert.ok(summary.indexOf('150') === -1);
  });
}

function testDraftArtworkNeverBlob() {
  const page = loadSong({
    plan: 'basic',
    me: {
      artist: 'Fuvtu',
      plan: 'basic',
      tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    },
    search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  page.api.openEdit({
    me: {
      artist: 'Fuvtu',
      plan: 'basic',
      tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    },
    draft: {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Chk g',
      made_how: 'no_ai',
      rights_confirmed: true,
      solo_owned_100: true,
      writers: [{ name: 'Fuvtu', share: 100 }],
    },
    release: {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Chk g',
      status: 'draft',
      genre: 'Electronic',
      language: 'en',
      release_date: '2026-08-24',
      artist: 'Fuvtu',
      dsps: ['spotify'],
    },
  });
  page.ids['edit-title'].value = 'Chk g';
  page.ids['edit-genre'].value = 'Electronic';
  page.ids['edit-language'].value = 'en';
  page.ids['edit-release-date'].value = '2026-09-12';
  page.ids['edit-art'].files = [{ name: 'cover.jpg', type: 'image/jpeg' }];
  page.ids['edit-art'].listeners.change();
  assert.ok(page.nodes['[data-song-cover]'].style.backgroundImage.indexOf('blob:cover-cover.jpg') !== -1, 'the picked file previews locally while the panel is still open');
  return page.api.submitEdit().then(function (result) {
    assert.ok(result.ok, 'a draft release must save a newly added cover');
    assert.strictEqual(result.applied, true, 'draft status saves through the immediate-edit path, not the store submit path');
    const release = page.api.currentEditState().release;
    assert.ok(!release.artwork_url || !/^blob:/i.test(release.artwork_url), 'release.artwork_url must never be a revoked blob: URL once closeEdit() has run');
    assert.ok(!/blob:/i.test(page.nodes['[data-song-cover]'].style.backgroundImage || ''), 'the painted cover tile must not reference a revoked blob: URL');
  });
}

function run() {
  const html = read('song.html');
  const css = read('site.css');
  [
    'Neon Sermon',
    'Victoria Reyes',
    'With data',
    'Awaiting data',
    '128,412',
    '$486.20',
    '74,288',
    '28,946',
    '15,250',
    'PG-2026-04427',
    '$100.00',
    'M. Hale',
    'I. Novak',
    'Chart Push',
    'Streaming Push',
    'Social Push',
    '82,500',
  ].forEach(function (needle) {
    assert.strictEqual(html.indexOf(needle), -1, 'song.html still has ' + needle);
  });
  assert.ok(!html.includes('class="seg"'));
  assert.ok(html.includes('data-song-title'));
  assert.ok(html.includes('data-song-player'));
  assert.ok(html.includes('data-song-retry'));
  assert.ok(html.includes('Retry'));
  assert.ok(html.includes('data-song-links'));
  assert.ok(html.includes('data-song-link-list'));
  assert.ok(html.includes('<h3>Links</h3>'));
  assert.ok(html.includes('<h3>Stores</h3>'));
  assert.ok(html.includes('data-song-stores-list'));
  assert.ok(html.includes('data-song-codes'));
  assert.ok(!/ToneGrid|InterSpace|DistroKid/i.test(html));
  assert.ok(css.includes('.song-store-links'));
  assert.ok(html.includes('lib/live-player.js'));
  assert.ok(html.includes('data-song-streams'));
  assert.ok(html.includes('song.js'));
  assert.ok(html.includes('lib/audio-accept.js'));
  assert.ok(html.includes('lib/store-pick.js'));
  assert.ok(html.includes('lib/cover-preview.js'));
  assert.ok(html.includes('lib/cover-url.js'));
  assert.ok(html.includes('data-art-clear'));
  assert.ok(html.includes('Pre-select all stores'));
  assert.ok(html.includes('data-store-customize'));
  assert.ok(html.includes('name="release-language"'));
  assert.ok(css.includes('flex-wrap: wrap'));
  assert.ok(css.includes('.store-pick-box'));
  assert.ok(css.includes('white-space: nowrap'));
  assert.ok(/\.store-pick label input[\s\S]*position:\s*static/.test(css), 'store chips must not use toggle-input absolute overlay');
  assert.ok(read('lib/store-pick.js').includes("box.className = 'store-pick-box'"));
  assert.ok(!/fillList[\s\S]*box\.className = 'toggle-input'/.test(read('lib/store-pick.js')));
  assert.ok(html.includes('accept="audio/*,.wav,.flac,.mp3,.mpeg,.mpga'));
  assert.ok(read('song.js').includes('function postTrackAudio'));
  assert.ok(read('song.js').includes('x-plaiground-upload-id'));
  assert.ok(read('song.js').includes('AUDIO_CHUNK_BYTES'));
  assert.ok(!html.includes('indexedDB'));
  assert.ok(!read('song.js').includes('indexedDB'));
  assert.ok(read('song.js').includes('clearNewReleaseState') || read('song.js').includes('wipeHeld'), 'Remove wipes held audio through the existing draft helper, not a song.js idb hop');
  assert.ok(html.includes('0'));
  assert.ok(html.includes('$0.00'));
  assert.ok(css.includes('.cover-lg.has-art'));
  assert.ok(css.includes('.art.has-art'));

  const basicMe = {
    artist: 'Fuvtu',
    plan: 'basic',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  };
  const page = loadSong({ plan: 'basic', me: basicMe, search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  page.api.render({
    me: basicMe,
    draft: {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      name: 'Fuvtu',
      genre: 'Electronic',
      release_date: '2026-08-24',
      submitted: true,
      solo_owned_100: true,
      legal_first: 'Ada',
      legal_last: 'Night',
      writers: [{ first_name: 'Ada', last_name: 'Night', name: 'Ada Night', share: 100 }],
    },
    release: {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      type: 'single',
      status: 'pending',
      genre: 'Electronic',
      release_date: '2026-08-24',
      artwork_url: '',
      artist: 'Fuvtu',
    },
    analytics: { summary: { total_streams: 0, total_revenue_usd: 0 }, releases: [], dsps: [] },
  });
  assert.strictEqual(page.nodes['[data-song-title]'].textContent, 'Fuvtu');
  assert.strictEqual(page.nodes['[data-song-pill]'].textContent, 'Needs fix');
  assert.strictEqual(page.nodes['[data-song-rejection]'].hidden, false);
  assert.strictEqual(page.nodes['[data-song-rejection-reason]'].textContent, QC_LINES);
  assert.ok(page.life.pending.classList.contains('on'));
  assert.ok(!page.life.live.classList.contains('on'), 'pending must not show Live');
  assert.ok(page.nodes['[data-song-meta]'].textContent.indexOf('Fuvtu') !== -1);
  assert.strictEqual(page.nodes['[data-song-streams]'].textContent, '0');
  assert.strictEqual(page.nodes['[data-song-earnings]'].textContent, '$0.00');
  assert.ok(page.nodes['[data-song-player]'].children.some(function (child) {
    return child && child.textContent === 'Available when live.';
  }), 'pending player stays disabled until live');
  assert.strictEqual(page.nodes['[data-song-links]'].hidden, true, 'pending song hides Links');
  assert.strictEqual(page.nodes['[data-song-link-list]'].children.length, 0);
  assert.strictEqual(page.nodes['[data-song-stores-list]'].hidden, true, 'no deliveries stay empty');
  assert.strictEqual(page.nodes['[data-song-stores-empty]'].hidden, false);
  assert.ok(page.nodes['[data-song-codes]'].textContent.indexOf('Not assigned') !== -1);
  assert.strictEqual(page.nodes['[data-song-breakdown]'].hidden, true, 'Basic locks platform breakdown');
  assert.strictEqual(page.nodes['[data-song-publishing]'].hidden, true, 'Basic hides publishing');
  assert.strictEqual(page.nodes['[data-song-boosts]'].hidden, false, 'Basic can still see locked Boost history');
  assert.strictEqual(page.nodes['[data-song-boost]'].hidden, false, 'Basic can still see a locked Boost CTA');
  assert.ok(page.nodes['[data-song-boost]'].classList.contains('is-off'), 'Basic Boost CTA stays locked');
  assert.strictEqual(page.nodes['[data-song-boost]'].getAttribute('aria-disabled'), 'true');
  assert.strictEqual(page.nodes['[data-song-cover]'].style.backgroundImage, '');
  page.ids['edit-art'].files = [{ name: 'new.jpg', type: 'image/jpeg' }];
  page.ids['edit-art'].listeners.change();
  assert.ok(page.nodes['[data-song-cover]'].style.backgroundImage.indexOf('blob:cover-new.jpg') !== -1, 'local pick paints the cover tile');
  assert.ok(page.nodes['[data-song-cover]'].classList.contains('has-art'));
  page.ids['edit-art'].files = [{ name: 'swap.png', type: 'image/png' }];
  page.ids['edit-art'].listeners.change();
  assert.ok(page.nodes['[data-song-cover]'].style.backgroundImage.indexOf('blob:cover-swap.png') !== -1, 'replace updates the cover tile');
  page.ids['edit-art'].files = [];
  page.ids['edit-art'].listeners.change();
  assert.strictEqual(page.nodes['[data-song-cover]'].style.backgroundImage, '', 'clear restores the empty cover');

  const coverPage = loadSong({ plan: 'basic', me: basicMe, search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  coverPage.api.render({
    me: basicMe,
    draft: { release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Fuvtu' },
    release: {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      type: 'single',
      status: 'pending',
      artwork_url: 'https://cdn.example/old.jpg',
      artist: 'Fuvtu',
    },
    analytics: { summary: { total_streams: 0, total_revenue_usd: 0 }, releases: [], dsps: [] },
  });
  assert.ok(coverPage.nodes['[data-song-cover]'].style.backgroundImage.indexOf('old.jpg') !== -1);
  coverPage.ids['edit-art'].files = [{ name: 'local.jpg', type: 'image/jpeg' }];
  coverPage.ids['edit-art'].listeners.change();
  assert.ok(coverPage.nodes['[data-song-cover]'].style.backgroundImage.indexOf('blob:cover-local.jpg') !== -1, 'local pick wins over stored cover');
  coverPage.ids['edit-art'].files = [];
  coverPage.ids['edit-art'].listeners.change();
  assert.ok(coverPage.nodes['[data-song-cover]'].style.backgroundImage.indexOf('old.jpg') !== -1, 'clear restores the stored cover');
  assert.strictEqual(page.nodes['[data-song-writers]'].children.length, 1);
  assert.ok(page.nodes['[data-song-writers]'].children[0].children[0].textContent.indexOf('Ada Night') !== -1);
  assert.ok(page.nodes['[data-song-writers]'].children[0].children[0].textContent.indexOf('Fuvtu') === -1);
  assert.ok(page.nodes['[data-song-writers]'].children[0].children[0].textContent.indexOf('Hale') === -1);
  assert.strictEqual(page.nodes['[data-song-split-attest]'].hidden, false);
  assert.strictEqual(page.nodes['[data-song-split-attest]'].textContent, 'self-attested, no sheet required');
  assert.strictEqual(page.nodes['[data-song-split-status]'].textContent, 'self-attested');
  assert.strictEqual(page.nodes['[data-song-split-preview]'].hidden, true, '100% does not invent a Preview PDF');
  assert.strictEqual(page.nodes['[data-song-split-download]'].hidden, true, '100% does not invent a Download PDF');

  const pendingSplit = loadSong({ plan: 'basic', me: basicMe, search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  pendingSplit.api.render({
    me: basicMe,
    draft: {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      solo_owned_100: false,
      signwell_document_id: 'doc_pending_01',
      signwell_status: 'awaiting_signature',
      writers: [
        { first_name: 'Ada', last_name: 'Night', share: 50 },
        { first_name: 'Bea', last_name: 'Vale', share: 50 },
      ],
    },
    release: { uuid: basicMe.tonegrid_release_ids[0], title: 'Fuvtu', status: 'pending', type: 'single' },
    analytics: {},
  });
  assert.strictEqual(pendingSplit.nodes['[data-song-split-status]'].textContent, 'pending');
  assert.strictEqual(pendingSplit.nodes['[data-song-split-attest]'].hidden, true);
  assert.strictEqual(pendingSplit.nodes['[data-song-split-preview]'].hidden, true);

  const havePdf = loadSong({ plan: 'basic', me: basicMe, search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  havePdf.api.render({
    me: Object.assign({}, basicMe, {
      profile: {
        releases: [{
          tonegrid_release_id: basicMe.tonegrid_release_ids[0],
          split_sheet_pdf: 'https://files.example/sheet.pdf',
          signwell_signed: true,
          signwell_status: 'Completed',
          writers: [{ first_name: 'Ada', last_name: 'Night' }],
        }],
      },
    }),
    draft: {},
    release: { uuid: basicMe.tonegrid_release_ids[0], title: 'Fuvtu', status: 'pending', type: 'single' },
    analytics: {},
  });
  assert.strictEqual(havePdf.nodes['[data-song-split-preview]'].hidden, false);
  assert.strictEqual(havePdf.nodes['[data-song-split-download]'].hidden, false);

  const creator = loadSong({ plan: 'creator', me: { artist: 'Fuvtu', plan: 'creator', tonegrid_release_ids: basicMe.tonegrid_release_ids } });
  creator.api.render({
    me: { artist: 'Fuvtu', plan: 'creator' },
    draft: { solo_owned_100: true, name: 'Fuvtu', writers: [{ name: 'Fuvtu', share: 100 }] },
    release: { uuid: basicMe.tonegrid_release_ids[0], title: 'Fuvtu', status: 'pending', type: 'single' },
    analytics: { summary: { total_streams: 0, total_revenue_usd: 0 }, dsps: [] },
  });
  assert.strictEqual(creator.nodes['[data-song-publishing]'].hidden, false);
  assert.strictEqual(creator.nodes['[data-song-boosts]'].hidden, false);
  assert.ok(!creator.nodes['[data-song-boost]'].classList.contains('is-off'), 'Creator Boost CTA stays open');
  assert.strictEqual(creator.nodes['[data-song-breakdown]'].hidden, false);

  const live = loadSong({ plan: 'basic', me: basicMe });
  live.api.render({
    me: basicMe,
    release: { uuid: basicMe.tonegrid_release_ids[0], title: 'Fuvtu', status: 'live', type: 'single' },
    analytics: {},
  });
  assert.strictEqual(live.nodes['[data-song-pill]'].textContent, 'Live');
  assert.ok(live.life.live.classList.contains('on'));
  assert.ok(live.nodes['[data-song-player]'].children.some(function (child) {
    return child && String(child.textContent || '').indexOf('Stream links appear') !== -1;
  }), 'live without a store ID still does not invent audio');
  assert.strictEqual(live.nodes['[data-song-links]'].hidden, true, 'live without store IDs keeps Links hidden');
  assert.strictEqual(live.nodes['[data-song-link-list]'].children.length, 0);

  const streamed = loadSong({ plan: 'basic', me: basicMe });
  streamed.api.render({
    me: basicMe,
    release: {
      uuid: basicMe.tonegrid_release_ids[0],
      title: 'Fuvtu',
      status: 'live',
      type: 'single',
      deliveries: [{ dsp: 'spotify', status: 'live', dsp_release_id: 'spotify:album:7v0Ytestalbumid00001' }],
    },
    analytics: {},
  });
  assert.ok(streamed.nodes['[data-song-player]'].children.some(function (child) {
    return child && child.href === 'https://open.spotify.com/album/7v0Ytestalbumid00001';
  }), 'live Play opens the official Spotify link');
  assert.ok(!streamed.nodes['[data-song-player]'].children.some(function (child) {
    return child && child.type === 'audio';
  }), 'live Play does not host a local audio file');
  assert.strictEqual(streamed.nodes['[data-song-streams]'].textContent, '0');
  assert.strictEqual(streamed.nodes['[data-song-links]'].hidden, false, 'live song shows Links when the store sent IDs');
  assert.ok(streamed.nodes['[data-song-link-list]'].children.some(function (child) {
    return child && child.children && child.children[0] && child.children[0].href === 'https://open.spotify.com/album/7v0Ytestalbumid00001'
      && child.children[0].target === '_blank'
      && child.children[0].textContent === 'Spotify';
  }), 'Links lists the official Spotify URL');

  const pendingWithIds = loadSong({ plan: 'basic', me: basicMe });
  pendingWithIds.api.render({
    me: basicMe,
    release: {
      uuid: basicMe.tonegrid_release_ids[0],
      title: 'Fuvtu',
      status: 'pending',
      type: 'single',
      deliveries: [{ dsp: 'spotify', status: 'live', dsp_release_id: 'spotify:album:7v0Ytestalbumid00001' }],
    },
    analytics: {},
  });
  assert.strictEqual(pendingWithIds.nodes['[data-song-links]'].hidden, true, 'pending never shows Links even if a delivery payload is present');
  assert.strictEqual(pendingWithIds.nodes['[data-song-link-list]'].children.length, 0);
  assert.strictEqual(pendingWithIds.nodes['[data-song-stores-list]'].hidden, false, 'pending still shows real store delivery status');
  assert.ok(pendingWithIds.nodes['[data-song-stores-list]'].children.some(function (child) {
    return child && child.children && child.children[0] && child.children[0].textContent === 'Spotify'
      && child.children[1] && child.children[1].textContent === 'Landed';
  }));

  const liveStores = loadSong({ plan: 'basic', me: basicMe });
  liveStores.api.render({
    me: basicMe,
    release: {
      uuid: basicMe.tonegrid_release_ids[0],
      title: 'Fuvtu',
      status: 'delivered',
      type: 'single',
      deliveries: [
        { dsp: 'spotify', status: 'live', dsp_release_id: 'spotify:album:7v0Ytestalbumid00001' },
        { dsp: 'apple-music', status: 'live', dsp_release_id: '1543210987' },
        { dsp: 'youtube-music', store_url: 'https://music.youtube.com/playlist?list=OLAK5uy_testlist' },
        { dsp: 'tidal', store_url: 'https://listen.tidal.com/album/123456789' },
      ],
    },
    analytics: {},
  });
  assert.strictEqual(liveStores.nodes['[data-song-links]'].hidden, false);
  const hrefs = liveStores.nodes['[data-song-link-list]'].children.map(function (row) {
    return row && row.children && row.children[0] ? row.children[0].href : '';
  });
  const names = liveStores.nodes['[data-song-link-list]'].children.map(function (row) {
    return row && row.children && row.children[0] ? row.children[0].textContent : '';
  });
  assert.ok(hrefs.indexOf('https://open.spotify.com/album/7v0Ytestalbumid00001') !== -1);
  assert.ok(hrefs.indexOf('https://music.apple.com/album/1543210987') !== -1);
  assert.ok(hrefs.some(function (href) { return href.indexOf('OLAK5uy_testlist') !== -1; }));
  assert.ok(hrefs.indexOf('https://listen.tidal.com/album/123456789') !== -1);
  assert.deepStrictEqual(names.slice().sort(), ['Apple Music', 'Spotify', 'Tidal', 'YouTube Music']);

  const storeStatus = loadSong({ plan: 'basic', me: basicMe });
  storeStatus.api.render({
    me: basicMe,
    release: {
      uuid: basicMe.tonegrid_release_ids[0],
      title: 'Dolly',
      status: 'live',
      type: 'single',
      upc: '194399123456',
      tracks: [{ uuid: '11111111-1111-4111-8111-111111111111', title: 'Dolly', isrc: 'USRC17607839' }],
      deliveries: [
        { dsp: 'spotify', status: 'live', dsp_release_id: 'spotify:album:7v0Ydolly00000000001' },
        { dsp: 'apple-music', status: 'failed' },
        { dsp: 'youtube-music', status: 'pending' },
      ],
    },
    analytics: {},
  });
  assert.strictEqual(storeStatus.nodes['[data-song-stores-empty]'].hidden, true);
  assert.strictEqual(storeStatus.nodes['[data-song-stores-list]'].hidden, false);
  const destNames = storeStatus.nodes['[data-song-stores-list]'].children.map(function (row) {
    return row && row.children && row.children[0] ? row.children[0].textContent : '';
  });
  const destStatus = storeStatus.nodes['[data-song-stores-list]'].children.map(function (row) {
    return row && row.children && row.children[1] ? row.children[1].textContent : '';
  });
  assert.ok(destNames.indexOf('Spotify') !== -1);
  assert.ok(destNames.indexOf('Apple Music') !== -1);
  assert.ok(destNames.indexOf('YouTube Music') !== -1);
  assert.strictEqual(destNames.length, 3, 'no fake 150 list');
  assert.ok(destStatus.indexOf('Landed') !== -1);
  assert.ok(destStatus.indexOf('Failed') !== -1);
  assert.ok(destStatus.indexOf('Pending') !== -1);
  assert.ok(storeStatus.nodes['[data-song-codes]'].textContent.indexOf('194399123456') !== -1);
  assert.ok(storeStatus.nodes['[data-song-codes]'].textContent.indexOf('USRC17607839') !== -1);
  assert.ok(storeStatus.nodes['[data-song-codes]'].textContent.indexOf('Takedown') === -1);
  assert.ok(!/ToneGrid|InterSpace|DistroKid/i.test(JSON.stringify(destNames)));

  const listFirst = loadSong({ plan: 'basic', me: basicMe, search: '' });
  assert.strictEqual(
    listFirst.api.pickRelease(
      [{ uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Helgas revenge phonic' }],
      basicMe,
      { release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Mexeu', submitted: true }
    ),
    null,
    'song.html without an id must not auto-open a leftover or latest release'
  );
  assert.strictEqual(listFirst.context.location.href, 'releases.html', 'bare song.html goes to the Releases list');
  assert.strictEqual(listFirst.api.editHref(''), 'releases.html', 'Edit without a picked id goes to the list');
  assert.strictEqual(
    listFirst.api.editHref('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
    'song.html?id=cccccccc-cccc-4ccc-8ccc-cccccccccccc&edit=1',
    'Edit after a picked row targets only that id'
  );
  assert.strictEqual(
    listFirst.api.pickRelease(
      [
        { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'arrays bday', status: 'draft' },
        { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'other draft', status: 'draft' },
      ],
      { artist: 'Mamamastermind', plan: 'creator', tonegrid_release_ids: ['dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'] },
      { release_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'arrays bday', submitted: false }
    ),
    null,
    'song.html without an id must not auto-open the first draft'
  );

  const picker = loadSong({
    plan: 'basic',
    me: basicMe,
    search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  const picked = picker.api.pickRelease(
    [{ uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Other' }],
    basicMe,
    { release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Fuvtu', submitted: true }
  );
  assert.strictEqual(picked.uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.strictEqual(picked.title, 'Fuvtu');

  const blocked = picker.api.pickRelease(
    [{ uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Other' }],
    basicMe,
    {}
  );
  assert.ok(blocked);
  assert.strictEqual(blocked.uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.notStrictEqual(blocked.title, 'Other');

  const writers = page.api.splitWriters(
    { artist: 'Fuvtu' },
    { solo_owned_100: true, name: 'Fuvtu', legal_first: 'Ada', legal_last: 'Night' },
    basicMe
  );
  assert.strictEqual(writers.length, 1);
  assert.strictEqual(writers[0].name, 'Ada Night');
  assert.strictEqual(writers[0].selfAttested, true);
  assert.notStrictEqual(writers[0].name, 'Fuvtu');
  const stageOnly = page.api.splitWriters({ artist: 'Fuvtu' }, { solo_owned_100: true, name: 'Fuvtu' }, basicMe);
  assert.strictEqual(stageOnly[0].name, '', 'solo writer line does not fall back to stage name');
  assert.strictEqual(page.api.splitWriters({}, {}, basicMe).length, 0);

  const catalog = read('catalog.js');
  assert.ok(catalog.includes('song.html?id='));
  assert.ok(catalog.includes('edit=1'));
  assert.ok(catalog.includes('Edit release'));
  assert.ok(catalog.includes('data-edit-missing'));
  assert.ok(catalog.includes('no store ID yet'));

  assert.ok(html.includes('Edit release'));
  assert.ok(html.includes('Submit for editing'));
  assert.ok(html.includes('data-song-edit'));
  assert.ok(/<a[^>]*data-song-edit[^>]*>Edit release<\/a>/.test(html), 'Edit release must be a real link, not a dead button');
  assert.ok(/<a[^>]*href="releases.html"[^>]*data-song-edit/.test(html) || /<a[^>]*data-song-edit[^>]*href="releases.html"/.test(html), 'song.html Edit without a picked id stays on the list');
  assert.ok(css.includes('.btn[hidden]'), 'hidden Edit/Remove/Boost buttons must stay hidden');
  assert.ok(html.includes('data-song-remove'));
  assert.ok(html.includes('data-song-download'));
  assert.ok(html.includes('lib/statement-pdf.js'));
  assert.ok(/data-song-download>Download<\/button>/.test(html));
  assert.ok(html.includes('data-life="taken_down"'));
  assert.ok(html.includes('data-life="removing"'));
  assert.ok(html.includes('data-edit-save'));
  assert.ok(html.includes('data-edit-retry'));
  assert.ok(/class="btn btn-purple btn-sm"[^>]*>Open full split sheet</.test(html), 'Open full split sheet stays purple');
  assert.ok(html.includes('data-song-split-preview'), 'song.html has split Preview');
  assert.ok(html.includes('data-song-split-download'), 'song.html has split Download');
  assert.ok(html.includes('data-song-split-attest'), 'song.html has self-attested copy');
  assert.ok(!/data-for-plans="[^"]*"[^>]*>Preview</.test(html), 'split Preview is not plan-gated');
  assert.ok(!/data-for-plans="[^"]*"[^>]*>Download</.test(html), 'split Download is not plan-gated');
  assert.ok(/class="btn btn-gold btn-sm" data-edit-save/.test(html), 'Submit for editing is the only gold CTA');
  assert.ok(!/class="btn btn-purple btn-sm" data-edit-save/.test(html), 'Submit for editing is not purple');
  assert.ok(/class="btn btn-purple btn-sm" data-edit-retry/.test(html), 'Retry stays purple');
  assert.ok(/class="btn btn-purple btn-sm"[^>]*data-song-edit/.test(html) || /data-song-edit[^>]*class="btn btn-purple btn-sm"/.test(html), 'Edit release stays purple');
  assert.ok(/class="btn btn-ghost btn-sm" data-edit-cancel/.test(html), 'Cancel stays secondary');
  assert.ok(/\.btn-gold \{[\s\S]*background:\s*#f3cb47/.test(css), 'Submit for editing uses brand gold #f3cb47');
  assert.strictEqual((html.match(/class="btn btn-gold/g) || []).length, 1, 'Edit page has one gold button');
  assert.ok(read('releases.html').includes('class="btn btn-purple btn-sm" data-edit-save'), 'list Save to the store stays purple');
  assert.ok(html.includes('data-edit-actions'));
  assert.ok(/data-edit-troubleshoot[^>]*>Troubleshoot</.test(html), 'Edit release has bottom Troubleshoot');
  assert.ok(/class="btn btn-ghost btn-sm" data-edit-troubleshoot/.test(html), 'Edit Troubleshoot stays secondary');
  assert.ok(/href="problem.html"/.test(html.match(/data-edit-troubleshoot[\s\S]*?<\/a>/)[0]), 'Edit Troubleshoot opens Have a problem?');
  assert.ok(html.indexOf('data-edit-actions') < html.indexOf('data-edit-troubleshoot'), 'Troubleshoot sits under the edit actions');
  assert.ok(!/data-plai-text/.test(html), 'Edit Troubleshoot is not Text PLAI');
  assert.ok(!/<select[^>]*data-problem/.test(html), 'Edit release does not add a type picker');
  const splitsField = html.match(/<div class="field" data-edit-splits>[\s\S]*?<\/div>/);
  assert.ok(splitsField, 'Splits field exists');
  assert.ok(!/class="learn"/.test(splitsField[0]), 'Splits is not an inline-text row for Submit/Cancel');
  assert.ok(!/Submit for editing/.test(splitsField[0]));
  assert.ok(!/data-edit-cancel/.test(splitsField[0]));
  assert.ok(css.includes('.edit-actions [data-edit-save]'));
  assert.ok(/\.edit-actions \{[\s\S]*border-top:\s*1px solid var\(--line\)/.test(css), 'edit actions sit in their own row, not under Splits');
  const confirmHtml = read('edit-submitted.html');
  assert.ok(confirmHtml.includes('href="dashboard.html">Back to Overview</a>'));
  assert.ok(confirmHtml.includes('href="releases.html">View Releases</a>'));
  assert.ok(!/ToneGrid|Tonegrid/i.test(confirmHtml));
  assert.ok(!/Submitting edit to the store/.test(confirmHtml));
  assert.ok(!/M\. Hale|I\. Novak/.test(confirmHtml));
  assert.ok(!html.includes('All 55 stores'), 'edit page must not hardcode a store count');
  assert.ok(html.includes('All stores will receive this release.'), 'store copy waits for the live catalog count');
  assert.ok(html.includes('id="edit-release-date"'));
  assert.ok(html.includes('id="edit-release-date-hint"'));
  assert.ok(/calendar-picker-indicator[\s\S]*?width:\s*100%/.test(css), 'edit date indicator must cover the whole field');
  assert.ok(read('song.js').includes('showPicker'), 'edit release date must open the native picker on tap');
  assert.ok(html.includes('id="edit-preorder-on"'));
  assert.ok(html.includes('id="edit-time-on"'));
  assert.ok(html.includes('id="edit-artist"'));
  assert.ok(html.includes('id="edit-lyrics"'));
  assert.ok(html.includes('<label for="edit-lyrics">Lyrics</label>'));
  assert.ok(html.includes('data-edit-lyrics-field'));
  assert.ok(html.includes('The store keeps the same artist ID'));
  assert.ok(!html.includes('The store locks the catalog artist'));
  assert.ok(!html.includes('tonegrid.js'));
  assert.ok(!html.includes('data-require-membership'));
  assert.ok(html.includes('upload-catalog.js'));
  assert.ok(html.includes('fillUploadSelects(document)'));
  assert.ok(html.includes('<select id="edit-genre"'));
  assert.ok(!html.includes('<input id="edit-genre"'));
  assert.ok(!html.includes('id="edit-subgenre"'));
  assert.ok(!html.includes('name="release-subgenre"'));
  assert.ok(read('song.js').includes('setTypeaheadValue'));
  assert.ok(read('song.js').includes('canonicalCatalogValue'));
  assert.ok(read('song.js').includes('function pickedLanguage'));
  assert.ok(read('song.js').includes('typeaheadTypedValue'));
  assert.ok(read('song.js').includes('fillCatalogSelects();'));
  assert.ok(read('upload-catalog.js').includes("id === 'edit-genre' || id === 'edit-language'"));
  assert.ok(read('upload-catalog.js').includes('isEditCatalogSelect'));
  assert.ok(!/if \(paid\) \{\s*fillCatalogSelects/.test(read('song.js')), 'Basic edit must bind genre/language typeahead');
  const songHtml = html;
  assert.ok(!/data-for-plans/.test(songHtml.slice(Math.max(0, songHtml.indexOf('id="edit-genre"') - 280), songHtml.indexOf('id="edit-genre"') + 180)));
  assert.ok(!/data-for-plans/.test(songHtml.slice(Math.max(0, songHtml.indexOf('id="edit-language"') - 280), songHtml.indexOf('id="edit-language"') + 180)));
  assert.ok(read('song.js').includes('persistEditReleaseDate'));
  assert.ok(read('song.js').includes('ignoreEmpty'));
  assert.ok(css.includes('::-webkit-datetime-edit'));

  assert.strictEqual(page.nodes['[data-song-edit]'].hidden, false, 'Edit release is on the real song');
  assert.strictEqual(
    page.nodes['[data-song-edit]'].getAttribute('href'),
    'song.html?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&edit=1',
    'Edit release href must target the same store release'
  );
  var editPrevented = false;
  assert.strictEqual(page.api.beginEdit({ preventDefault: function () { editPrevented = true; } }), true);
  assert.ok(editPrevented, 'successful in-place edit must consume the click');
  assert.strictEqual(page.nodes['[data-release-edit]'].hidden, false, 'Edit click must open the same-release editor');
  assert.strictEqual(page.nodes['[data-release-edit]'].getAttribute('data-release-id'), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

  const pickedThenEdit = loadSong({
    plan: 'creator',
    me: {
      artist: 'Mamamastermind',
      plan: 'creator',
      tonegrid_release_ids: [
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ],
    },
    search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  pickedThenEdit.api.render({
    me: {
      artist: 'Mamamastermind',
      plan: 'creator',
      tonegrid_release_ids: [
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ],
    },
    release: {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'picked row',
      status: 'draft',
      type: 'single',
    },
    analytics: {},
  });
  assert.strictEqual(
    pickedThenEdit.nodes['[data-song-edit]'].getAttribute('href'),
    'song.html?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&edit=1',
    'Edit after opening a picked row edits that id only'
  );
  assert.ok(String(pickedThenEdit.nodes['[data-song-edit]'].getAttribute('href')).indexOf('dddddddd-dddd-4ddd-8ddd-dddddddddddd') === -1);

  const noId = loadSong({ plan: 'pro', me: { artist: 'Fuvtu', plan: 'pro' } });
  noId.api.render({
    me: { artist: 'Fuvtu', plan: 'pro' },
    release: { title: 'Draft only', status: 'draft', type: 'single' },
    analytics: {},
  });
  assert.strictEqual(noId.nodes['[data-song-edit]'].hidden, false, 'Edit stays visible so a missing id is not a silent dead control');
  var missingPrevented = false;
  assert.strictEqual(noId.api.beginEdit({ preventDefault: function () { missingPrevented = true; } }), false);
  assert.ok(missingPrevented);
  assert.ok(noId.nodes['[data-song-status]'].textContent.indexOf('no store ID') !== -1, 'missing release id must show a real error');
  assert.strictEqual(noId.nodes['[data-release-edit]'].hidden, true, 'editor must not open without a store id');

  const proClick = loadSong({
    plan: 'pro',
    me: { artist: 'Fuvtu', plan: 'pro', tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] },
    search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  proClick.api.render({
    me: { artist: 'Fuvtu', plan: 'pro', tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] },
    release: {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      status: 'pending',
      type: 'single',
    },
    analytics: {},
  });
  assert.strictEqual(proClick.nodes['[data-song-edit]'].hidden, false);
  assert.ok(String(proClick.nodes['[data-song-edit]'].getAttribute('href')).indexOf('edit=1') !== -1);
  proClick.nodes['[data-song-edit]'].listeners.click({ preventDefault: function () {} });
  assert.strictEqual(proClick.nodes['[data-release-edit]'].hidden, false, 'Pro Edit release click opens the editor');
  assert.strictEqual(proClick.ids['edit-title'].value, 'Fuvtu');
  page.api.openEdit({
    me: basicMe,
    draft: {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      name: 'Fuvtu',
      genre: 'Electronic',
      language: 'en',
      price: '$0.99',
      made_how: 'no_ai',
      submitted: true,
      solo_owned_100: true,
      artist_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    },
    release: {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      type: 'single',
      status: 'pending',
      genre: 'Electronic',
      language: 'en',
      release_date: '2026-08-24',
      artist: 'Fuvtu',
      tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu', language: 'en' }],
      dsps: ['spotify', 'youtube-music'],
    },
  });
  assert.strictEqual(page.nodes['[data-release-edit]'].hidden, false);
  assert.strictEqual(page.ids['edit-title'].value, 'Fuvtu');
  assert.strictEqual(page.ids['edit-artist'].value, 'Fuvtu');
  assert.strictEqual(page.ids['edit-artist'].disabled, false, 'primary artist stays editable');
  assert.strictEqual(page.ids['edit-genre'].disabled, false, 'genre stays editable');
  assert.strictEqual(page.ids['edit-language'].disabled, false, 'language stays editable');
  assert.strictEqual(page.ids['edit-genre'].value, 'Electronic');
  assert.ok(page.nodes['[data-edit-attest]'].hidden === false, 'AI attest stays visible when already collected');
  assert.ok(
    String(page.nodes['[data-edit-troubleshoot]'].getAttribute('href') || '').indexOf('problem.html?release=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') === 0,
    'Edit Troubleshoot carries the release id into Have a problem?'
  );
  page.ids['edit-lyrics'].value = '';
  page.api.openEdit({
    me: basicMe,
    draft: {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      language: 'en',
      lyrics: 'Night after night',
      instrumental: false,
    },
    release: {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      status: 'pending',
      language: 'en',
      tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu' }],
    },
  });
  assert.strictEqual(page.ids['edit-lyrics'].value, 'Night after night');
  assert.strictEqual(page.nodes['[data-edit-lyrics-field]'].hidden, false);
  page.ids['edit-instrumental'].checked = true;
  page.ids['edit-instrumental'].listeners.change();
  assert.strictEqual(page.nodes['[data-edit-lyrics-field]'].hidden, true);

  const pickedDate = '2026-09-12';
  page.ids['edit-release-date'].value = pickedDate;
  page.ids['edit-release-date'].listeners.input({ type: 'input' });
  assert.strictEqual(page.ids['edit-release-date'].value, pickedDate, 'clicked edit-release date must stay visible');
  assert.strictEqual(JSON.parse(page.context.localStorage.getItem('plaiground.store.draft')).release_date, pickedDate);
  page.ids['edit-release-date'].value = '';
  page.ids['edit-release-date'].listeners.input({ type: 'input' });
  assert.strictEqual(page.ids['edit-release-date'].value, pickedDate, 'empty input during edit-release pick must not wipe the shown date');
  assert.strictEqual(JSON.parse(page.context.localStorage.getItem('plaiground.store.draft')).release_date, pickedDate);

  function pad2(n) { return String(n).padStart(2, '0'); }
  function localShift(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function todayLocal() {
    return localShift(0);
  }
  const futureEdit = loadSong({
    plan: 'basic',
    me: basicMe,
    search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    draft: {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      release_date: localShift(14),
    },
  });
  futureEdit.api.openEdit({
    me: basicMe,
    draft: { release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', release_date: localShift(14) },
    release: {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      status: 'pending',
      release_date: localShift(14),
      tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu' }],
    },
  });
  assert.ok(
    !futureEdit.ids['edit-release-date'].min || futureEdit.ids['edit-release-date'].min <= todayLocal(),
    'edit-release native min must not be the 7-day lock'
  );
  const insideEdit = localShift(1);
  futureEdit.ids['edit-release-date'].value = insideEdit;
  futureEdit.ids['edit-release-date'].listeners.change();
  assert.strictEqual(futureEdit.ids['edit-release-date'].value, insideEdit, 'persistEditReleaseDate must not empty a date inside the 7-day window');
  futureEdit.ids['edit-release-date'].listeners.click();
  assert.ok(futureEdit.ids['edit-release-date'].pickerOpened >= 1, 'edit release date must open the native picker on tap');
  futureEdit.ids['edit-preorder-date'].listeners.click();
  assert.ok(futureEdit.ids['edit-preorder-date'].pickerOpened >= 1, 'edit pre-order date must open the native picker on tap');
  futureEdit.ids['edit-release-date'].value = '';
  futureEdit.ids['edit-release-date'].listeners.change();
  assert.notStrictEqual(futureEdit.ids['edit-release-date'].value, localShift(7), 'empty edit change must not snap the 7-day lock');
  assert.ok(
    !futureEdit.ids['edit-release-date'].value || futureEdit.ids['edit-release-date'].value === insideEdit,
    'empty edit change must keep the last date or stay empty'
  );

  const editCalls = [];
  const editor = loadSong({
    plan: 'basic',
    me: basicMe,
    search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    draft: {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      name: 'Fuvtu',
      genre: 'Electronic',
      language: 'en',
      price: '$0.99',
      made_how: 'no_ai',
      rights_confirmed: true,
      solo_owned_100: true,
      submitted: true,
      artist_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    },
    calls: editCalls,
    fetch(url, options) {
      const method = (options && options.method) || 'GET';
      let body = {};
      if (options && typeof options.body === 'string') {
        try { body = JSON.parse(options.body); } catch (err) { body = {}; }
      }
      if (String(body.error || '').indexOf('PLAN_LIMIT') !== -1) {
        return Promise.resolve({ ok: false, status: 403, json: async () => ({ code: 'PLAN_LIMIT' }) });
      }
      if (method === 'PUT' && /\/releases\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa$/.test(String(url))) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: body.title, status: 'pending' }) });
      }
      if (method === 'POST' && /\/releases\/?$/.test(String(url).split('?')[0])) {
        return Promise.resolve({ ok: false, status: 403, json: async () => ({ error: 'Basic includes one release.', code: 'PLAN_LIMIT' }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          title: 'Fuvtu',
          status: 'pending',
          skipped: /\/submit$/.test(String(url)),
          stores: [{ slug: 'spotify', name: 'Spotify' }],
          releases: [{ uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Fuvtu', status: 'pending' }],
        }),
      });
    },
  });
  editor.ids['edit-title'].value = 'Fuvtu Edit';
  editor.ids['edit-genre'].value = 'Electronic';
  editor.ids['edit-language'].value = 'en';
  editor.ids['edit-release-date'].value = '2026-09-12';
  editor.ids['edit-lyrics'].value = 'City lights, I stay';
  editor.api.openEdit({
    me: basicMe,
    draft: {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      made_how: 'no_ai',
      rights_confirmed: true,
      solo_owned_100: true,
      submitted: true,
      track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    },
    release: {
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fuvtu',
      status: 'pending',
      genre: 'Electronic',
      language: 'en',
      release_date: '2026-08-24',
      artist: 'Fuvtu',
      tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu' }],
      dsps: ['spotify'],
    },
  });
  editor.ids['edit-title'].value = 'Fuvtu Edit';
  editor.ids['edit-artist'].value = 'Ada Night';
  editor.ids['edit-genre'].value = 'Electronic';
  editor.ids['edit-genre-type'].value = 'Pop';
  editor.ids['edit-language'].value = 'en';
  editor.ids['edit-language-type'].value = 'Spanish';
  editor.ids['edit-lyrics'].value = 'City lights, I stay';
  editor.ids['edit-featured'].value = 'Guest';
  editor.ids['edit-price'].value = '$0.69';
  editor.ids['edit-release-date'].value = '2026-09-12';
  return editor.api.submitEdit().then(function (result) {
    assert.ok(result.ok, 'Basic pending edit must apply immediately');
    assert.strictEqual(result.created, false);
    assert.strictEqual(result.applied, true);
    assert.strictEqual(result.releaseId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const mutating = editCalls.filter((row) => row.method && row.method !== 'GET');
    assert.ok(!mutating.some((row) => /\/api\/tonegrid\//.test(row.url)), 'pending edit must not wait on the store');
    assert.ok(mutating.some((row) => row.method === 'POST' && /\/api\/me\/artists$/.test(row.url)), 'pending edit records the Plaiground release');
    assert.ok(!mutating.some((row) => row.method === 'POST' && /\/submit$/.test(row.url)), 'pending edit must not wait on a second store submit');
    assert.ok(!/edit-submitted\.html/.test(String(editor.context.location.href)), 'pending edit does not go to the store confirm page');
    assert.strictEqual(editor.nodes['[data-song-title]'].textContent, 'Fuvtu Edit');
    assert.ok(/Pop/.test(editor.nodes['[data-song-meta]'].textContent), 'edited genre must show');
    assert.ok(!/Submitting edit to the store/.test(editor.nodes['[data-edit-error]'].textContent));
    assert.ok(!mutating.some((row) => editor.api.isCreateReleaseUrl(row.url, row.method)), 'edit must not POST a new release or artist');
    const savedDraft = JSON.parse(editor.context.localStorage.getItem('plaiground.store.draft'));
    assert.strictEqual(savedDraft.title, 'Fuvtu Edit');
    assert.strictEqual(savedDraft.artist, 'Ada Night');
    assert.strictEqual(savedDraft.genre, 'Pop');
    assert.strictEqual(savedDraft.language, 'es');
    assert.strictEqual(savedDraft.edit_applied, true);
    const recorded = mutating.find((row) => row.method === 'POST' && /\/api\/me\/artists$/.test(row.url));
    let recordedBody = {};
    try { recordedBody = JSON.parse(recorded && recorded.body); } catch (err) { recordedBody = {}; }
    assert.strictEqual(recordedBody.release && recordedBody.release.genre, 'Pop', 'pending edit persists the changed genre');
    assert.strictEqual(recordedBody.release && recordedBody.release.language, 'es', 'pending edit persists the changed language');
    assert.strictEqual(recordedBody.release && recordedBody.release.artist, 'Ada Night', 'pending edit persists the changed artist');
    assert.strictEqual(recordedBody.release && recordedBody.release.lyrics, 'City lights, I stay', 'pending edit persists lyrics on the Plaiground record');
    assert.strictEqual(recordedBody.release && recordedBody.release.release_date, '2026-09-12', 'pending edit persists the changed date');
    assert.strictEqual(savedDraft.lyrics, 'City lights, I stay', 'edit lyrics must save in place on the Plaiground draft');
    mutating.filter((row) => typeof row.body === 'string').forEach((row) => {
      let body = {};
      try { body = JSON.parse(row.body); } catch (err) { body = {}; }
      assert.strictEqual(body.lyrics, undefined, 'edit must not invent a ToneGrid lyrics field');
      assert.strictEqual(body.lyric_text, undefined);
    });
    return editor.api.load().then(function (reloaded) {
      assert.ok(reloaded, 'pending edit reload must keep the same release');
      assert.strictEqual(editor.nodes['[data-song-title]'].textContent, 'Fuvtu Edit', 'reload must keep the edited title');
      assert.ok(/Pop/.test(editor.nodes['[data-song-meta]'].textContent), 'reload must keep the edited genre');
      assert.ok(/Ada Night/.test(editor.nodes['[data-song-meta]'].textContent), 'reload must keep the edited artist');
      editor.api.openEdit(editor.api.currentEditState());
      assert.strictEqual(editor.ids['edit-title'].value, 'Fuvtu Edit');
      assert.strictEqual(editor.ids['edit-artist'].value, 'Ada Night');
      assert.strictEqual(editor.ids['edit-genre'].value, 'Pop');
      assert.strictEqual(editor.ids['edit-language'].value, 'es');
      assert.strictEqual(editor.ids['edit-lyrics'].value, 'City lights, I stay');
      assert.strictEqual(editor.ids['edit-release-date'].value, '2026-09-12');
      assert.strictEqual(editor.ids['edit-featured'].value, 'Guest');
      assert.strictEqual(editor.ids['edit-price'].value, '$0.69');
    assert.ok(!mutating.some((row) => row.method === 'POST' && /PLAN_LIMIT/.test(String(row.body || ''))));
    assert.ok(editor.api.isCreateReleaseUrl('/api/tonegrid/releases', 'POST'));
    assert.ok(!editor.api.isCreateReleaseUrl('/api/tonegrid/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'PUT'));
    assert.ok(!editor.api.isCreateReleaseUrl('/api/tonegrid/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/submit', 'POST'));
    assert.strictEqual(editor.nodes['[data-song-pill]'].textContent, 'Needs fix');
    assert.ok(!editor.life.live.classList.contains('on'), 'edit must not fake LIVE');
    assert.ok(editor.api.isLiveConfirmed({ status: 'live' }, {}) === true);
    assert.ok(editor.api.isLiveConfirmed({ status: 'pending' }, {}) === false);
    assert.ok(editor.api.isLiveConfirmed({ status: 'processing' }, {}) === false);

    const liveCalls = [];
    const liveEditor = loadSong({
      plan: 'basic',
      me: basicMe,
      search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      calls: liveCalls,
      fetch(url, options) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            status: 'live',
            uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            title: 'Fuvtu',
            releases: [{ uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Fuvtu', status: 'live' }],
          }),
        });
      },
    });
    liveEditor.ids['edit-title'].value = 'Fuvtu Live Edit';
    liveEditor.ids['edit-genre'].value = 'Electronic';
    liveEditor.ids['edit-language'].value = 'en';
    liveEditor.ids['edit-release-date'].value = '2026-09-12';
    liveEditor.api.openEdit({
      me: basicMe,
      draft: {
        release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Fuvtu',
        made_how: 'no_ai',
        submitted: true,
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      release: {
        uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Fuvtu',
        status: 'live',
        genre: 'Electronic',
        language: 'en',
        tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu' }],
        dsps: ['spotify'],
      },
    });
    liveEditor.ids['edit-title'].value = 'Fuvtu Live Edit';
    liveEditor.ids['edit-genre'].value = 'Pop';
    liveEditor.ids['edit-language'].value = 'es';
    assert.strictEqual(liveEditor.ids['edit-genre'].disabled, false, 'live genre stays editable');
    assert.strictEqual(liveEditor.ids['edit-language'].disabled, false, 'live language stays editable');
    return liveEditor.api.submitEdit().then(function (liveResult) {
      assert.ok(liveResult.ok, 'live edit still goes to the store');
      assert.ok(!liveResult.applied);
      const releasePut = liveCalls.find((row) => row.method === 'PUT' && /\/releases\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa$/.test(row.url));
      assert.ok(releasePut, 'live edit PUTs the release');
      let releaseBody = {};
      try { releaseBody = JSON.parse(releasePut.body); } catch (err) { releaseBody = {}; }
      assert.strictEqual(releaseBody.genre, 'Pop', 'live edit must send the changed genre');
      assert.strictEqual(releaseBody.language, 'es', 'live edit must send the changed language');
      assert.ok(releaseBody.title === 'Fuvtu Live Edit', 'live edit must send the changed title');
      assert.ok(liveCalls.some((row) => row.method === 'PUT' && /\/dsps$/.test(row.url)));
      assert.ok(/edit-submitted\.html/.test(String(liveEditor.context.location.href)));
      const liveRecord = liveCalls.find((row) => row.method === 'POST' && /\/api\/me\/artists$/.test(row.url));
      let liveRecorded = {};
      try { liveRecorded = JSON.parse(liveRecord && liveRecord.body); } catch (err) { liveRecorded = {}; }
      assert.strictEqual(liveRecorded.release && liveRecorded.release.title, 'Fuvtu Live Edit', 'live edit must update the local record');
      assert.strictEqual(liveRecorded.release && liveRecorded.release.genre, 'Pop');
      const liveDraft = JSON.parse(liveEditor.context.localStorage.getItem('plaiground.store.draft'));
      assert.strictEqual(liveDraft.edit_applied, true);
      const overlaidLive = liveEditor.api.overlayPendingEdit({
        uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Fuvtu',
        status: 'live',
        genre: 'Electronic',
        language: 'en',
      }, liveDraft, basicMe);
      assert.strictEqual(overlaidLive.title, 'Fuvtu Live Edit', 'live overlay must keep the submitted edit');

      const creatorMe = Object.assign({}, basicMe, { plan: 'creator' });
      const creatorPendingCalls = [];
      const creatorPending = loadSong({
        plan: 'creator',
        me: creatorMe,
        search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        calls: creatorPendingCalls,
        fetch(url, options) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, status: 'pending' }) });
        },
      });
      creatorPending.ids['edit-title'].value = 'Creator Pending';
      creatorPending.ids['edit-genre'].value = 'Electronic';
      creatorPending.ids['edit-language'].value = 'en';
      creatorPending.ids['edit-release-date'].value = '2026-09-12';
      creatorPending.api.openEdit({
        me: creatorMe,
        draft: {
          release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          title: 'Fuvtu',
          made_how: 'no_ai',
          submitted: true,
          track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        },
        release: {
          uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          title: 'Fuvtu',
          status: 'pending',
          genre: 'Electronic',
          language: 'en',
          tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu' }],
          dsps: ['spotify'],
        },
      });
      creatorPending.ids['edit-title'].value = 'Creator Pending';
      creatorPending.ids['edit-genre'].value = 'Electronic';
      creatorPending.ids['edit-language'].value = 'en';
      return creatorPending.api.submitEdit().then(function (creatorResult) {
        assert.ok(creatorResult.applied, 'Creator pending also applies immediately');
        assert.ok(!creatorPendingCalls.some((row) => row.method && row.method !== 'GET' && /\/api\/tonegrid\//.test(row.url)));
        assert.strictEqual(creatorPending.nodes['[data-song-title]'].textContent, 'Creator Pending');

        const creatorLiveCalls = [];
        const creatorLive = loadSong({
          plan: 'creator',
          me: creatorMe,
          search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          calls: creatorLiveCalls,
          fetch(url, options) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                ok: true,
                status: 'live',
                uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                title: 'Fuvtu',
                releases: [{ uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Fuvtu', status: 'live' }],
              }),
            });
          },
        });
        creatorLive.ids['edit-title'].value = 'Creator Live';
        creatorLive.ids['edit-genre'].value = 'Electronic';
        creatorLive.ids['edit-language'].value = 'en';
        creatorLive.ids['edit-release-date'].value = '2026-09-12';
        creatorLive.api.openEdit({
          me: creatorMe,
          draft: {
            release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            title: 'Fuvtu',
            made_how: 'no_ai',
            submitted: true,
            track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          },
          release: {
            uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            title: 'Fuvtu',
            status: 'live',
            genre: 'Electronic',
            language: 'en',
            tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fuvtu' }],
            dsps: ['spotify'],
          },
        });
        creatorLive.ids['edit-title'].value = 'Creator Live';
        creatorLive.ids['edit-genre'].value = 'Hip-Hop';
        creatorLive.ids['edit-language'].value = 'fr';
        assert.strictEqual(creatorLive.ids['edit-genre'].disabled, false);
        assert.strictEqual(creatorLive.ids['edit-language'].disabled, false);
        return creatorLive.api.submitEdit().then(function (creatorLiveResult) {
          assert.ok(creatorLiveResult.ok, 'Creator live edit still goes to the store');
          assert.ok(!creatorLiveResult.applied);
          const creatorPut = creatorLiveCalls.find((row) => row.method === 'PUT' && /\/releases\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa$/.test(row.url));
          let creatorBody = {};
          try { creatorBody = JSON.parse(creatorPut && creatorPut.body); } catch (err) { creatorBody = {}; }
          assert.strictEqual(creatorBody.genre, 'Hip-Hop', 'Creator live edit must send the changed genre');
          assert.strictEqual(creatorBody.language, 'fr', 'Creator live edit must send the changed language');
          assert.ok(creatorLiveCalls.some((row) => row.method === 'PUT' && /\/api\/tonegrid\//.test(row.url)));
          assert.ok(/edit-submitted\.html/.test(String(creatorLive.context.location.href)));
          assert.strictEqual(page.nodes['[data-song-remove]'].hidden, false, 'owner sees Remove on their release');

    assert.ok(page.api.downloadReleaseStatement(), 'release statement downloads at $0');
    const releasePdf = page.api.releaseStatementPdf();
    assert.ok(releasePdf.indexOf('%PDF') === 0);
    assert.ok(releasePdf.indexOf('Fuvtu') !== -1);
    assert.ok(releasePdf.indexOf('Pending') !== -1);
    assert.ok(releasePdf.indexOf('$0.00') !== -1);
    assert.ok(releasePdf.indexOf('Streams') !== -1);
    assert.ok(!/7,412,908|Neon Sermon|Victoria Reyes/.test(releasePdf));
    assert.strictEqual(page.context.PlaigroundStatementPdf.lastDownload().filename, 'plaiground-release-statement.pdf');

    const missingId = loadSong({ me: null, search: '' });
    missingId.api.render({ error: 'No release on this account yet.' });
    assert.strictEqual(missingId.api.downloadReleaseStatement(), false, 'no release id is a real error');
    assert.ok(/Open a release before downloading a statement/.test(missingId.nodes['[data-song-status]'].textContent));
    assert.strictEqual(missingId.nodes['[data-song-status]'].hidden, false);

    const unsigned = loadSong({ me: null });
    unsigned.api.render({ error: 'Sign in to see this release.' });
    assert.strictEqual(unsigned.nodes['[data-song-remove]'].hidden, true, 'signed-out viewers do not see Remove');

    const down = loadSong({ plan: 'basic', me: basicMe });
    down.api.render({
      me: basicMe,
      release: { uuid: basicMe.tonegrid_release_ids[0], title: 'Fuvtu', status: 'taken_down', type: 'single' },
      analytics: {},
    });
    assert.strictEqual(down.nodes['[data-song-remove]'].hidden, true, 'taken down releases keep the lifetime slot');
    assert.ok(down.life.removing.classList.contains('on'));
    assert.strictEqual(down.nodes['[data-song-pill]'].textContent, 'Removing');

    const cancelCalls = [];
    const cancelled = loadSong({
      plan: 'basic',
      me: basicMe,
      confirm: false,
      calls: cancelCalls,
    });
    cancelled.api.render({
      me: basicMe,
      release: { uuid: basicMe.tonegrid_release_ids[0], title: 'Fuvtu', status: 'draft', type: 'single' },
      analytics: {},
    });
    return cancelled.api.removeRelease().then(function (result) {
      assert.strictEqual(result.cancelled, true);
      assert.ok(!cancelCalls.some((row) => row.method === 'DELETE'));
      assert.ok(cancelCalls.some((row) => String(row.confirm || '').indexOf('Remove this release') !== -1));

      const draftCalls = [];
      const drafted = loadSong({
        plan: 'basic',
        me: basicMe,
        confirm: true,
        calls: draftCalls,
        draft: { release_id: basicMe.tonegrid_release_ids[0], title: 'Fuvtu' },
        fetch(url, options) {
          const method = (options && options.method) || 'GET';
          if (method === 'DELETE') {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({ ok: true, removed: true, redirect: '/releases.html' }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              releases: [{ uuid: basicMe.tonegrid_release_ids[0], title: 'Fuvtu', status: 'draft' }],
            }),
          });
        },
      });
      drafted.api.render({
        me: basicMe,
        draft: { release_id: basicMe.tonegrid_release_ids[0], title: 'Fuvtu' },
        release: { uuid: basicMe.tonegrid_release_ids[0], title: 'Fuvtu', status: 'draft', type: 'single' },
        analytics: {},
      });
      return drafted.api.removeRelease().then(function (removed) {
        assert.ok(removed.ok);
        assert.strictEqual(removed.redirect, 'releases.html');
        assert.strictEqual(drafted.context.location.href, 'releases.html');
        assert.strictEqual(drafted.context.localStorage.getItem('plaiground.store.draft'), null);
        assert.ok(drafted.context.deletedDbs.indexOf('plaiground-held-audio') !== -1, 'Remove wipes held audio so upload cannot restore it');
        assert.ok(draftCalls.some((row) => row.method === 'DELETE' && /\/releases\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa$/.test(row.url)));

        const savedDraftCalls = [];
        const savedDrafted = loadSong({
          plan: 'basic',
          me: basicMe,
          confirm: true,
          calls: savedDraftCalls,
          draft: { saved_draft: true, title: 'The recording.' },
          fetch(url, options) {
            const method = (options && options.method) || 'GET';
            if (method === 'DELETE') {
              return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ ok: true, removed: true, redirect: '/releases.html' }),
              });
            }
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                releases: [{ uuid: basicMe.tonegrid_release_ids[0], title: 'The recording.', status: 'draft' }],
              }),
            });
          },
        });
        savedDrafted.api.render({
          me: basicMe,
          draft: { saved_draft: true, title: 'The recording.' },
          release: { uuid: basicMe.tonegrid_release_ids[0], title: 'The recording.', status: 'draft', type: 'single' },
          analytics: {},
        });
        return savedDrafted.api.removeRelease().then(function (savedRemoved) {
          assert.ok(savedRemoved.ok);
          assert.strictEqual(savedDrafted.context.localStorage.getItem('plaiground.store.draft'), null, 'save-draft localStorage must drop with Remove');
          assert.ok(savedDrafted.context.deletedDbs.indexOf('plaiground-held-audio') !== -1, 'save-draft held audio must drop with Remove');

        const liveCalls = [];
        const liveFail = loadSong({
          plan: 'basic',
          me: basicMe,
          confirm: true,
          calls: liveCalls,
          href: 'song.html?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          fetch(url, options) {
            const method = (options && options.method) || 'GET';
            if (method === 'DELETE') {
              return Promise.resolve({
                ok: false,
                status: 422,
                json: async () => ({ error: 'DSP rejected takedown', removed: false }),
              });
            }
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({
                releases: [{ uuid: basicMe.tonegrid_release_ids[0], title: 'Fuvtu', status: 'live' }],
              }),
            });
          },
        });
        liveFail.api.render({
          me: basicMe,
          release: { uuid: basicMe.tonegrid_release_ids[0], title: 'Fuvtu', status: 'live', type: 'single' },
          analytics: {},
        });
        return liveFail.api.removeRelease().then(function (failed) {
          assert.strictEqual(failed.ok, false);
          assert.ok(liveCalls.some((row) => String(row.confirm || '').indexOf('Ask stores') !== -1));
          assert.strictEqual(liveFail.nodes['[data-song-status]'].textContent, 'DSP rejected takedown');
          assert.notStrictEqual(liveFail.context.location.href, 'releases.html');

          const pendingCalls = [];
          const pendingOk = loadSong({
            plan: 'creator',
            me: Object.assign({}, basicMe, { plan: 'creator' }),
            confirm: true,
            calls: pendingCalls,
            href: 'song.html?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            fetch(url, options) {
              const method = (options && options.method) || 'GET';
              if (method === 'DELETE') {
                return Promise.resolve({
                  ok: true,
                  status: 202,
                  json: async () => ({ ok: true, removed: false, takedown: true, status: 'takedown_submitted' }),
                });
              }
              return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({
                  uuid: basicMe.tonegrid_release_ids[0],
                  title: 'mexeu',
                  status: 'takedown_submitted',
                  releases: [{ uuid: basicMe.tonegrid_release_ids[0], title: 'mexeu', status: 'takedown_submitted' }],
                }),
              });
            },
          });
          pendingOk.api.render({
            me: Object.assign({}, basicMe, { plan: 'creator' }),
            release: { uuid: basicMe.tonegrid_release_ids[0], title: 'mexeu', status: 'pending', type: 'single' },
            analytics: {},
          });
          return pendingOk.api.removeRelease().then(function (pendingRemoved) {
            assert.ok(pendingRemoved.ok);
            assert.strictEqual(pendingRemoved.removed, undefined);
            assert.strictEqual(pendingRemoved.takedown, true);
            assert.ok(!pendingRemoved.redirect);
            assert.ok(pendingCalls.some((row) => /Ask stores|stays listed until the store confirms/i.test(String(row.confirm || ''))));
            assert.ok(!/Deleted|Taken down/i.test(pendingOk.nodes['[data-song-pill]'].textContent));
            assert.ok(/Removing|Pending/i.test(pendingOk.nodes['[data-song-pill]'].textContent));
            assert.notStrictEqual(pendingOk.context.location.href, 'releases.html');

            const processingCalls = [];
            const processingOk = loadSong({
              plan: 'creator',
              me: Object.assign({}, basicMe, { plan: 'creator' }),
              confirm: true,
              calls: processingCalls,
              href: 'song.html?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              fetch(url, options) {
                const method = (options && options.method) || 'GET';
                if (method === 'DELETE') {
                  return Promise.resolve({
                    ok: true,
                    status: 202,
                    json: async () => ({ ok: true, removed: false, takedown: true, status: 'takedown_submitted' }),
                  });
                }
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({
                    uuid: basicMe.tonegrid_release_ids[0],
                    title: 'mexeu',
                    status: 'takedown_submitted',
                    releases: [{ uuid: basicMe.tonegrid_release_ids[0], title: 'mexeu', status: 'takedown_submitted' }],
                  }),
                });
              },
            });
            processingOk.api.render({
              me: Object.assign({}, basicMe, { plan: 'creator' }),
              release: { uuid: basicMe.tonegrid_release_ids[0], title: 'mexeu', status: 'processing', type: 'single' },
              analytics: {},
            });
            return processingOk.api.removeRelease().then(function (processingRemoved) {
              assert.ok(processingRemoved.ok);
              assert.strictEqual(processingRemoved.removed, undefined);
              assert.strictEqual(processingRemoved.takedown, true);
              assert.ok(processingCalls.some((row) => /Ask stores|stays listed until the store confirms/i.test(String(row.confirm || ''))));
              assert.ok(!/Deleted|Taken down/i.test(processingOk.nodes['[data-song-pill]'].textContent));
              assert.notStrictEqual(processingOk.context.location.href, 'releases.html');

            const leftoverCalls = [];
            const leftover = loadSong({
              plan: 'creator',
              me: Object.assign({}, basicMe, { plan: 'creator' }),
              confirm: true,
              calls: leftoverCalls,
              href: 'song.html?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              fetch(url, options) {
                const method = (options && options.method) || 'GET';
                if (method === 'DELETE') {
                  return Promise.resolve({
                    ok: false,
                    status: 409,
                    json: async () => ({ error: 'Only draft or rejected releases can be deleted.', removed: false }),
                  });
                }
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({
                    releases: [{ uuid: basicMe.tonegrid_release_ids[0], title: 'mexeu', status: 'pending' }],
                  }),
                });
              },
            });
            leftover.api.render({
              me: Object.assign({}, basicMe, { plan: 'creator' }),
              release: { uuid: basicMe.tonegrid_release_ids[0], title: 'mexeu', status: 'live', type: 'single' },
              analytics: {},
            });
            return leftover.api.removeRelease().then(function (leftoverFail) {
              assert.strictEqual(leftoverFail.ok, false);
              assert.strictEqual(leftover.nodes['[data-song-status]'].textContent, 'The store could not take this release down.');
              assert.ok(!/only draft or rejected releases can be deleted/i.test(leftover.nodes['[data-song-status]'].textContent));
              assert.ok(!/ToneGrid|DistroKid/i.test(leftover.nodes['[data-song-status]'].textContent));
              assert.notStrictEqual(leftover.context.location.href, 'releases.html');

              const goneCalls = [];
              const pendingGone = loadSong({
                plan: 'creator',
                me: Object.assign({}, basicMe, { plan: 'creator' }),
                confirm: true,
                calls: goneCalls,
                href: 'song.html?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                search: '?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                fetch(url, options) {
                  const method = (options && options.method) || 'GET';
                  if (method === 'DELETE') {
                    return Promise.resolve({
                      ok: true,
                      status: 202,
                      json: async () => ({ ok: true, removed: false, takedown: true, status: 'takedown_submitted' }),
                    });
                  }
                  if (method === 'GET' && /\/releases\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa$/.test(String(url))) {
                    return Promise.resolve({
                      ok: false,
                      status: 404,
                      json: async () => ({ error: 'Release not found.' }),
                    });
                  }
                  return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                      releases: [{ uuid: basicMe.tonegrid_release_ids[0], title: 'mexeu', status: 'pending' }],
                    }),
                  });
                },
              });
              pendingGone.api.render({
                me: Object.assign({}, basicMe, { plan: 'creator' }),
                release: { uuid: basicMe.tonegrid_release_ids[0], title: 'mexeu', status: 'pending', type: 'single' },
                analytics: {},
              });
              return pendingGone.api.removeRelease().then(function (goneRemoved) {
                assert.ok(goneRemoved.ok);
                assert.strictEqual(goneRemoved.removed, true);
                assert.strictEqual(goneRemoved.redirect, 'releases.html');
                assert.strictEqual(pendingGone.context.location.href, 'releases.html');
                assert.ok(!goneCalls.some((row) => /ToneGrid|DistroKid/i.test(String(row.confirm || ''))));
                assert.ok(!/ToneGrid|DistroKid/i.test(pendingGone.nodes['[data-song-status]'].textContent));
                return testEditSubmitLeftovers().then(testSongLoadHangRetry).then(testEditLiveStoreCount).then(testDraftArtworkNeverBlob).then(function () {
                  console.log('song.page.test.js ok');
                });
              });
            });
          });
        });
      });
    });
    });
  });
  });
    });
    });
    });
    });
}

Promise.resolve(run()).catch((err) => {
  console.error(err);
  process.exit(1);
});
