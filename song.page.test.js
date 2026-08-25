'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
      this.listeners[type] = fn;
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
    'edit-artist': makeEl({ id: 'edit-artist', value: '', disabled: true }),
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
    '[data-song-title]': makeEl({}),
    '[data-song-pill]': makeEl({ className: 'pill' }),
    '[data-song-meta]': makeEl({}),
    '[data-song-cover]': makeEl({}),
    '[data-song-cover-note]': makeEl({}),
    '[data-art-clear]': makeEl({ hidden: true }),
    '[data-song-player]': makeEl({}),
    '[data-song-links]': makeEl({ hidden: true }),
    '[data-song-link-list]': makeEl({}),
    '[data-song-streams]': makeEl({ textContent: '0' }),
    '[data-song-earnings]': makeEl({ textContent: '$0.00' }),
    '[data-song-breakdown]': makeEl({ hidden: true }),
    '[data-song-dsps]': makeEl({}),
    '[data-song-breakdown-empty]': makeEl({ hidden: true }),
    '[data-song-writers]': makeEl({}),
    '[data-song-split-status]': makeEl({}),
    '[data-song-split-empty]': makeEl({ hidden: true }),
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
    taken_down: makeEl({ life: 'taken_down' }),
    rejected: makeEl({ life: 'rejected' }),
  };
  const context = {
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
        if (sel === '[data-life]') return [life.draft, life.signatures, life.pending, life.processing, life.live, life.taken_down, life.rejected];
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
    },
  };
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
  vm.runInNewContext(read('lib/statement-pdf.js'), context);
  vm.runInNewContext(read('song.js'), context);
  return { api: context.PlaigroundSong, nodes, life, ids, calls, context };
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
  assert.ok(html.includes('data-song-links'));
  assert.ok(html.includes('data-song-link-list'));
  assert.ok(html.includes('<h3>Links</h3>'));
  assert.ok(css.includes('.song-store-links'));
  assert.ok(html.includes('lib/live-player.js'));
  assert.ok(html.includes('data-song-streams'));
  assert.ok(html.includes('song.js'));
  assert.ok(html.includes('lib/audio-accept.js'));
  assert.ok(html.includes('lib/store-pick.js'));
  assert.ok(html.includes('lib/cover-preview.js'));
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
  assert.ok(!html.includes('indexedDB'));
  assert.ok(!read('song.js').includes('indexedDB'));
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
      writers: [{ name: 'Fuvtu', share: 100 }],
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
  assert.strictEqual(page.nodes['[data-song-pill]'].textContent, 'Pending');
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
  assert.ok(page.nodes['[data-song-writers]'].children[0].children[0].textContent.indexOf('Fuvtu') !== -1);
  assert.ok(page.nodes['[data-song-writers]'].children[0].children[0].textContent.indexOf('Hale') === -1);

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

  const writers = page.api.splitWriters({ artist: 'Fuvtu' }, { solo_owned_100: true, name: 'Fuvtu' }, basicMe);
  assert.strictEqual(writers.length, 1);
  assert.strictEqual(writers[0].name, 'Fuvtu');
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
  assert.ok(css.includes('.btn[hidden]'), 'hidden Edit/Remove/Boost buttons must stay hidden');
  assert.ok(html.includes('data-song-remove'));
  assert.ok(html.includes('data-song-download'));
  assert.ok(html.includes('lib/statement-pdf.js'));
  assert.ok(/data-song-download>Download<\/button>/.test(html));
  assert.ok(html.includes('data-life="taken_down"'));
  assert.ok(html.includes('data-edit-save'));
  assert.ok(html.includes('id="edit-release-date"'));
  assert.ok(html.includes('id="edit-release-date-hint"'));
  assert.ok(html.includes('id="edit-preorder-on"'));
  assert.ok(html.includes('id="edit-time-on"'));
  assert.ok(html.includes('id="edit-artist"'));
  assert.ok(html.includes('id="edit-lyrics"'));
  assert.ok(html.includes('<label for="edit-lyrics">Lyrics</label>'));
  assert.ok(html.includes('data-edit-lyrics-field'));
  assert.ok(html.includes('The store locks the catalog artist'));
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
  assert.strictEqual(page.ids['edit-artist'].disabled, true, 'catalog artist stays locked');
  assert.strictEqual(page.ids['edit-genre'].value, 'Electronic');
  assert.ok(page.nodes['[data-edit-attest]'].hidden === false, 'AI attest stays visible when already collected');
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
  editor.ids['edit-lyrics'].value = 'City lights, I stay';
  return editor.api.submitEdit().then(function (result) {
    assert.ok(result.ok, 'Basic edit submit must succeed');
    assert.strictEqual(result.created, false);
    assert.strictEqual(result.releaseId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const mutating = editCalls.filter((row) => row.method && row.method !== 'GET');
    assert.ok(mutating.some((row) => row.method === 'PUT' && /\/releases\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa$/.test(row.url)));
    assert.ok(mutating.some((row) => row.method === 'PUT' && /\/dsps$/.test(row.url)));
    assert.ok(mutating.some((row) => row.method === 'PUT' && /\/tracks\//.test(row.url)));
    assert.ok(mutating.some((row) => row.method === 'POST' && /\/submit$/.test(row.url)));
    assert.ok(!mutating.some((row) => editor.api.isCreateReleaseUrl(row.url, row.method)), 'edit must not POST a new release or artist');
    const savedDraft = JSON.parse(editor.context.localStorage.getItem('plaiground.store.draft'));
    assert.strictEqual(savedDraft.lyrics, 'City lights, I stay', 'edit lyrics must save in place on the Plaiground draft');
    mutating.filter((row) => typeof row.body === 'string').forEach((row) => {
      let body = {};
      try { body = JSON.parse(row.body); } catch (err) { body = {}; }
      assert.strictEqual(body.lyrics, undefined, 'edit must not invent a ToneGrid lyrics field');
      assert.strictEqual(body.lyric_text, undefined);
    });
    assert.ok(!mutating.some((row) => row.method === 'POST' && /PLAN_LIMIT/.test(String(row.body || ''))));
    assert.ok(editor.api.isCreateReleaseUrl('/api/tonegrid/releases', 'POST'));
    assert.ok(!editor.api.isCreateReleaseUrl('/api/tonegrid/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'PUT'));
    assert.ok(!editor.api.isCreateReleaseUrl('/api/tonegrid/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/submit', 'POST'));
    assert.strictEqual(editor.nodes['[data-song-pill]'].textContent, 'Pending');
    assert.ok(!editor.life.live.classList.contains('on'), 'edit must not fake LIVE');
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
    assert.ok(down.life.taken_down.classList.contains('on'));

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
        assert.ok(draftCalls.some((row) => row.method === 'DELETE' && /\/releases\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa$/.test(row.url)));

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
                  json: async () => ({ ok: true, takedown: true, removed: false, status: 'takedown_submitted' }),
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
          pendingOk.api.render({
            me: Object.assign({}, basicMe, { plan: 'creator' }),
            release: { uuid: basicMe.tonegrid_release_ids[0], title: 'mexeu', status: 'pending', type: 'single' },
            analytics: {},
          });
          return pendingOk.api.removeRelease().then(function (pendingRemoved) {
            assert.ok(pendingRemoved.ok);
            assert.strictEqual(pendingRemoved.takedown, true);
            assert.ok(pendingCalls.some((row) => String(row.confirm || '').indexOf('Ask stores') !== -1));
            assert.ok(pendingCalls.some((row) => String(row.confirm || '').indexOf('stays listed until the store confirms') !== -1));
            assert.strictEqual(
              pendingOk.nodes['[data-song-status]'].textContent,
              'Takedown submitted to stores. This release stays listed until the store confirms.'
            );
            assert.notStrictEqual(pendingOk.context.location.href, 'releases.html');
            assert.strictEqual(pendingOk.nodes['[data-song-remove]'].hidden, true);

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
              release: { uuid: basicMe.tonegrid_release_ids[0], title: 'mexeu', status: 'pending', type: 'single' },
              analytics: {},
            });
            return leftover.api.removeRelease().then(function (leftoverFail) {
              assert.strictEqual(leftoverFail.ok, false);
              assert.strictEqual(leftover.nodes['[data-song-status]'].textContent, 'The store could not take this release down.');
              assert.ok(!/only draft or rejected releases can be deleted/i.test(leftover.nodes['[data-song-status]'].textContent));
              assert.notStrictEqual(leftover.context.location.href, 'releases.html');
              console.log('song.page.test.js ok');
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
