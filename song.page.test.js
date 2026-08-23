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
    addEventListener() {},
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
    '[data-song-edit]': makeEl({ hidden: true }),
    '[data-release-edit]': panel,
    '[data-edit-status]': makeEl({}),
    '[data-edit-error]': makeEl({ hidden: true }),
    '[data-edit-stores]': makeEl({}),
    '[data-edit-attest]': makeEl({ hidden: true }),
    '[data-edit-splits-copy]': makeEl({}),
    '[data-edit-save]': makeEl({}),
    '[data-edit-cancel]': makeEl({}),
    '[data-language-field]': makeEl({}),
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
  const life = {
    draft: makeEl({ life: 'draft' }),
    signatures: makeEl({ life: 'signatures' }),
    review: makeEl({ life: 'review' }),
    live: makeEl({ life: 'live' }),
    rejected: makeEl({ life: 'rejected' }),
  };
  const context = {
    localStorage: {
      data: opts.draft ? { 'plaiground.tonegrid.draft': JSON.stringify(opts.draft) } : {},
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
        if (sel === '[data-life]') return [life.draft, life.signatures, life.review, life.live, life.rejected];
        if (sel === '[data-edit-explicit] [data-explicit]') return [];
        if (sel === '[data-edit-made-how]') return [];
        return [];
      },
      getElementById(id) { return ids[id] || null; },
      createElement() { return makeEl({}); },
      createTextNode(text) { return makeEl({ textContent: text }); },
    },
    fetch(url, options) {
      const method = (options && options.method) || 'GET';
      calls.push({ url: String(url), method: method, body: options && options.body });
      if (opts.fetch) return opts.fetch(url, options, calls);
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ releases: [], stores: [] }) });
    },
    location: { href: opts.href || 'song.html', search: opts.search || '', pathname: '/song.html' },
    window: {},
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
  assert.ok(html.includes('data-song-streams'));
  assert.ok(html.includes('song.js'));
  assert.ok(html.includes('0'));
  assert.ok(html.includes('$0.00'));
  assert.ok(css.includes('.cover-lg.has-art'));

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
  assert.strictEqual(page.nodes['[data-song-pill]'].textContent, 'In review');
  assert.ok(page.life.review.classList.contains('on'));
  assert.ok(!page.life.live.classList.contains('on'), 'pending must not show Live');
  assert.ok(page.nodes['[data-song-meta]'].textContent.indexOf('Fuvtu') !== -1);
  assert.strictEqual(page.nodes['[data-song-streams]'].textContent, '0');
  assert.strictEqual(page.nodes['[data-song-earnings]'].textContent, '$0.00');
  assert.strictEqual(page.nodes['[data-song-breakdown]'].hidden, true, 'Basic locks platform breakdown');
  assert.strictEqual(page.nodes['[data-song-publishing]'].hidden, true, 'Basic hides publishing');
  assert.strictEqual(page.nodes['[data-song-boosts]'].hidden, false, 'Basic can still see locked Boost history');
  assert.strictEqual(page.nodes['[data-song-boost]'].hidden, false, 'Basic can still see a locked Boost CTA');
  assert.ok(page.nodes['[data-song-boost]'].classList.contains('is-off'), 'Basic Boost CTA stays locked');
  assert.strictEqual(page.nodes['[data-song-boost]'].getAttribute('aria-disabled'), 'true');
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

  const picker = loadSong({ plan: 'basic', me: basicMe, search: '' });
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

  assert.ok(html.includes('Edit release'));
  assert.ok(html.includes('Submit for editing'));
  assert.ok(html.includes('data-song-edit'));
  assert.ok(html.includes('data-edit-save'));
  assert.ok(html.includes('id="edit-release-date"'));
  assert.ok(html.includes('id="edit-preorder-on"'));
  assert.ok(html.includes('id="edit-time-on"'));
  assert.ok(html.includes('id="edit-artist"'));
  assert.ok(html.includes('ToneGrid locks the catalog artist'));
  assert.ok(!html.includes('tonegrid.js'));
  assert.ok(!html.includes('data-require-membership'));
  assert.ok(html.includes('upload-catalog.js'));

  assert.strictEqual(page.nodes['[data-song-edit]'].hidden, false, 'Edit release is on the real song');
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
    assert.ok(!mutating.some((row) => row.method === 'POST' && /PLAN_LIMIT/.test(String(row.body || ''))));
    assert.ok(editor.api.isCreateReleaseUrl('/api/tonegrid/releases', 'POST'));
    assert.ok(!editor.api.isCreateReleaseUrl('/api/tonegrid/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'PUT'));
    assert.ok(!editor.api.isCreateReleaseUrl('/api/tonegrid/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/submit', 'POST'));
    assert.strictEqual(editor.nodes['[data-song-pill]'].textContent, 'In review');
    assert.ok(!editor.life.live.classList.contains('on'), 'edit must not fake LIVE');
    console.log('song.page.test.js ok');
  });
}

Promise.resolve(run()).catch((err) => {
  console.error(err);
  process.exit(1);
});
