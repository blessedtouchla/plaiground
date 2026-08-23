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
    style: {},
    children: [],
    attrs: Object.assign({}, (attrs && attrs.attrs) || {}),
    classList: {
      tokens: Object.create(null),
      toggle(name, force) {
        if (force) this.tokens[name] = true;
        else delete this.tokens[name];
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
      return child;
    },
  };
  if (attrs && attrs.life) el.attrs['data-life'] = attrs.life;
  return el;
}

function loadSong(opts) {
  opts = opts || {};
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
  };
  const life = {
    draft: makeEl({ life: 'draft' }),
    signatures: makeEl({ life: 'signatures' }),
    review: makeEl({ life: 'review' }),
    live: makeEl({ life: 'live' }),
    rejected: makeEl({ life: 'rejected' }),
  };
  const context = {
    localStorage: { getItem() { return opts.draft ? JSON.stringify(opts.draft) : null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    URLSearchParams,
    document: {
      querySelector(sel) { return nodes[sel] || null; },
      querySelectorAll(sel) {
        if (sel === '[data-life]') return [life.draft, life.signatures, life.review, life.live, life.rejected];
        return [];
      },
      createElement() { return makeEl({}); },
    },
    fetch() {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ releases: [] }) });
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
  return { api: context.PlaigroundSong, nodes, life };
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

  console.log('song.page.test.js ok');
}

run();
