'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const releaseStatus = require('./lib/release-status');
const QC_LINES = releaseStatus.STORE_QC_LINES.join('\n');

const BADGE = /account[\s_-]*ready/i;

const LOGGED_IN_PAGES = [
  'dashboard.html',
  'releases.html',
  'splits.html',
  'splits-empty.html',
  'earnings.html',
  'analytics.html',
  'payouts.html',
  'settings.html',
  'boosts.html',
  'chart-push.html',
  'streaming-push.html',
  'social-push.html',
  'video-collect.html',
  'how.html',
  'library.html',
  'song.html',
  'upload.html',
  'attest.html',
  'review.html',
  'split-sheet.html',
  'admin.html',
];

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function listHtmlAndJs() {
  return fs.readdirSync(__dirname).filter(function (name) {
    return /\.(html|js)$/.test(name) && !name.endsWith('.test.js');
  });
}

function loadDashboardScripts(signedIn) {
  const membershipCode = read('membership.js');
  const accountCode = read('account.js');
  const localStorage = {
    data: signedIn ? { plaigroundSignedIn: '1' } : Object.create(null),
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null;
    },
    setItem(key, value) {
      this.data[key] = String(value);
    },
    removeItem(key) {
      delete this.data[key];
    },
  };
  const nodes = [];
  const document = {
    currentScript: { getAttribute() { return null; } },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement(tag) {
      const el = { tagName: String(tag).toUpperCase(), textContent: '', className: '', hidden: false };
      nodes.push(el);
      return el;
    },
  };
  const context = {
    URLSearchParams,
    localStorage,
    sessionStorage: localStorage,
    document,
    location: { href: 'dashboard.html', pathname: '/dashboard.html', search: '', replace() {} },
    fetch() {
      return Promise.resolve({
        ok: signedIn,
        status: signedIn ? 200 : 401,
        json: function () {
          return Promise.resolve(signedIn ? { artist: 'Fuvtu', plan: 'creator', email: 'victoriaimtanes@gmail.com' } : {});
        },
      });
    },
  };
  context.window = context;
  context.global = context;
  vm.runInNewContext(membershipCode, context);
  vm.runInNewContext(accountCode, context);
  return { api: context.PlaigroundMembership, nodes, document };
}

function run() {
  const dash = read('dashboard.html');
  assert.ok(dash.includes('<h1>Overview</h1>'), 'dashboard heading must be Overview, not a second Releases page');
  assert.ok(!/<h1[^>]*>Your releases<\/h1>/.test(dash), 'Overview heading must not stay Your releases');
  assert.ok(dash.includes('data-next-up'), 'next-up card is missing');
  assert.ok(dash.includes('Submit your first song'), 'first-song next-up copy is missing');
  assert.ok(dash.includes('data-first-song'), 'first-song empty strip hook is missing');
  assert.ok(dash.includes('data-has-release'), 'submitted-release hook is missing');
  assert.ok(dash.includes('All releases'), 'Overview strip keeps All releases');
  assert.ok(/data-has-release[^>]*data-all-releases[^>]*hidden|data-all-releases[^>]*hidden/.test(dash), 'All releases stays hidden until there is a catalog');
  assert.ok(!dash.includes('View release'), 'Overview purple button must not stay View release');
  assert.ok(!dash.includes('Upload an album'), 'Overview must not keep Upload an album');
  assert.ok(!dash.includes('About 10 minutes'), 'Overview must not keep the album time line');
  assert.ok(!/upload\.html\?type=album/.test(dash), 'Overview must not start an album');
  assert.ok(!dash.includes('Edit release'), 'Overview must not clone the Releases edit action');
  assert.ok(!/class="release-pills"/.test(dash), 'Overview must not keep the Releases pill row');
  const siteCss = read('site.css');
  assert.ok(siteCss.includes('[data-has-release][hidden]'), 'All releases cannot leak through .learn display');
  assert.ok(siteCss.includes('table.data th.release-edit-col') && siteCss.includes('table.data td.release-edit-col .btn'), 'desktop Edit column from #140 stays aligned');
  assert.ok(read('account.js').includes("el.setAttribute('href', 'releases.html')"), 'sidebar Releases stays on the catalog list');
  assert.ok(!/data-latest-link/.test(dash), 'Overview must not rewrite a latest-song link');
  assert.ok(dash.includes('data-release-tiles'), 'release cover tiles are missing');
  assert.ok(dash.includes('is-strip'), 'Overview tiles are a short recent strip');
  assert.ok(!dash.includes('Unlock MSP — Multiple Streams of Revenue'), 'Overview must not keep the MSP unlock clone');
  assert.ok(!dash.includes('data-msp-section'), 'Overview must not keep the MSP earnings board');
  assert.ok(dash.includes('data-dash-shortcuts'), 'Creator/Pro Boost and Publishing shortcuts are missing');
  assert.ok(/data-for-plans="creator pro"[\s\S]*Boosts/.test(dash), 'Boost shortcut is Creator/Pro only');
  assert.ok(/data-for-plans="creator pro"[\s\S]*Publishing/.test(dash), 'Publishing shortcut is Creator/Pro only');
  assert.ok(dash.includes('data-plai-talk') && dash.includes('Talk to PLAI'), 'Overview Talk to PLAI CTA is missing');
  assert.ok(dash.includes('data-split-sheets'), 'Overview Split sheets section is missing');
  assert.ok(dash.includes('data-split-sheets-rows'), 'Overview latest split rows are missing');
  assert.ok(/href="splits.html"[^>]*>Split sheets</.test(dash) || /data-split-sheets-all/.test(dash), 'Overview Split sheets button is missing');
  assert.ok(dash.includes('Writers sign the sheet. The song can still submit.'), 'Overview split copy must stay honest');
  assert.ok(!dash.includes('Every writer signs before delivery'), 'Overview must not say writers sign before delivery');
  assert.ok(dash.indexOf('data-split-sheets') < dash.indexOf('data-dash-shortcuts'), 'Split sheets stays on Overview, not under Boosts');
  assert.ok(!/data-for-plans="[^"]*"[^>]*>Split sheets</.test(dash), 'Split sheets is not plan-gated on Overview');
  assert.ok(!/P-L-A-I/.test(dash), 'Overview must not spell P-L-A-I');
  assert.ok(!/>PLAY</.test(dash), 'Overview must not rename PLAI to PLAY in UI copy');
  assert.ok(dash.includes('Releases pending'), 'Your account card is missing Releases pending');
  assert.ok(dash.includes('data-account-pending>0'), 'pending empty default is 0');
  assert.ok(dash.includes('Artist profiles'), 'Your account card is missing Artist profiles');
  assert.ok(dash.includes('data-account-artists>0'), 'artist profiles empty default is 0');
  assert.ok(dash.includes('href="artists.html"'), 'Artist profiles line links to Artist Profiles');
  assert.ok(dash.includes('data-account-who'), 'dashboard greeting name slot is missing');
  assert.ok(dash.includes('class="topbar"'), 'dashboard menu/topbar is missing');
  assert.ok(dash.includes('class="side-nav"'), 'dashboard menu is missing');
  assert.ok(!BADGE.test(dash), 'dashboard.html still renders ACCOUNT READY');
  assert.ok(!dash.includes('class="ready"'), 'dashboard.html still has a ready status chip');

  LOGGED_IN_PAGES.forEach(function (file) {
    const html = read(file);
    assert.ok(!BADGE.test(html), file + ' still renders ACCOUNT READY');
  });

  ['account.js', 'site.js'].forEach(function (file) {
    const js = read(file);
    assert.ok(!BADGE.test(js), file + ' still renders ACCOUNT READY');
  });

  const membership = read('membership.js');
  assert.ok(!/ACCOUNT READY|Account ready|account-ready|account_ready/.test(membership), 'membership.js still renders ACCOUNT READY');

  listHtmlAndJs().forEach(function (file) {
    const text = read(file);
    const display = text.replace(/\baccountReady\b/g, '');
    assert.ok(!/ACCOUNT READY|Account ready|account-ready|account_ready/.test(display), file + ' still has ACCOUNT READY copy');
  });

  const session = loadDashboardScripts(true);
  assert.strictEqual(session.api.isSignedIn(), true);
  assert.ok(dash.includes('data-first-song'), 'empty first-song strip stays in markup');
  assert.ok(dash.includes('data-has-release'), 'submitted-release hook is in markup');
  assert.ok(dash.includes('data-next-up'), 'next-up card stays in markup');
  const injected = session.nodes.map(function (el) { return String(el.textContent || ''); }).join(' ');
  assert.ok(!BADGE.test(injected), 'logged-in dashboard JS injected ACCOUNT READY');

  function makeNode(attrs) {
    return {
      hidden: Boolean(attrs && attrs.hidden),
      textContent: (attrs && attrs.textContent) || '',
      href: (attrs && attrs.href) || '',
      tagName: (attrs && attrs.tagName) || 'DIV',
      value: (attrs && attrs.value) || '',
      className: '',
      style: {},
      children: [],
      classList: {
        toggle() {},
      },
      setAttribute(name, value) { this[name] = value; },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
    };
  }

  function makeHost() {
    const host = makeNode({ hidden: true });
    Object.defineProperty(host, 'textContent', {
      get() { return this._text || ''; },
      set(value) {
        this._text = String(value);
        if (value === '') this.children = [];
      },
      configurable: true,
    });
    return host;
  }

  function fillNodes() {
    return {
      '[data-first-song]': makeNode({ hidden: false }),
      '[data-has-release]': makeNode({ hidden: true }),
      '[data-first-upload]': makeNode({ hidden: false }),
      '[data-latest-title]': makeNode({}),
      '[data-latest-status]': makeNode({}),
      '[data-latest-link]': makeNode({ href: 'releases.html' }),
      '[data-latest-edit]': makeNode({ href: 'releases.html' }),
      '[data-account-releases]': makeNode({ textContent: '0' }),
      '[data-account-pending]': makeNode({ textContent: '0' }),
      '[data-account-artists]': makeNode({ textContent: '0' }),
      '[data-account-who]': makeNode({ textContent: 'Hi there' }),
      '[data-account-avatar]': makeNode({ textContent: 'PG' }),
      '[data-account-artist]': makeNode({ tagName: 'INPUT', value: '' }),
      '[data-pub-call]': makeNode({ hidden: true }),
      '[data-pub-badge]': makeNode({ textContent: 'INCLUDED IN YOUR PLAN' }),
      '[data-account-plan-title]': makeNode({ textContent: 'Your plan' }),
      '[data-account-plan-price]': makeNode({ textContent: 'Your plan' }),
      '[data-account-plan-year]': makeNode({ hidden: true }),
      '[data-release-tiles]': makeHost(),
      '[data-split-sheets-rows]': makeHost(),
      '[data-split-sheets-table]': makeNode({ hidden: true }),
      '[data-split-sheets-empty]': makeNode({ hidden: false }),
      '[data-next-up]': makeNode({ hidden: true }),
      '[data-next-up-title]': makeNode({ textContent: 'Submit your first song' }),
      '[data-next-up-body]': makeNode({}),
      '[data-next-up-link]': makeNode({ href: 'upload.html', textContent: 'Submit your first song' }),
      '[data-msp-section]': makeNode({ hidden: true }),
      '[data-msp-lock]': makeNode({ hidden: true }),
      '[data-msp-open]': makeNode({ hidden: true }),
      '[data-msp-songs]': makeHost(),
    };
  }

  function fillAccount(me, draft) {
    const nodes = fillNodes();
    const store = {
      data: Object.create(null),
      getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
      setItem(key, value) { this.data[key] = String(value); },
      removeItem(key) { delete this.data[key]; },
    };
    if (draft) store.setItem('plaiground.store.draft', JSON.stringify(draft));
    const fillDoc = {
      currentScript: { getAttribute() { return null; } },
      querySelector(sel) { return nodes[sel] || null; },
      querySelectorAll(sel) { return nodes[sel] ? [nodes[sel]] : []; },
      createElement() { return makeNode({}); },
      addEventListener() {},
    };
    const fillCtx = {
      URLSearchParams,
      localStorage: store,
      sessionStorage: store,
      document: fillDoc,
      location: { href: 'dashboard.html', pathname: '/dashboard.html', search: '', replace() {} },
      fetch() { return Promise.resolve({ ok: false, status: 401, json: async () => ({}) }); },
    };
    fillCtx.window = fillCtx;
    fillCtx.globalThis = fillCtx;
    vm.runInNewContext(read('lib/cover-url.js'), fillCtx);
    vm.runInNewContext(read('lib/release-status.js'), fillCtx);
    vm.runInNewContext(read('lib/release-credits.js'), fillCtx);
    vm.runInNewContext(read('lib/split-sheets.js'), fillCtx);
    vm.runInNewContext(read('account.js'), fillCtx);
    fillCtx.PlaigroundAccount.fill(me);
    return nodes;
  }

  const nodes = fillAccount({
    artist: 'Fuvtu',
    plan: 'basic',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    upload: { allowed: false },
  });
  assert.strictEqual(nodes['[data-first-song]'].hidden, true, 'first-song empty strip hides after Basic submit');
  assert.strictEqual(nodes['[data-has-release]'].hidden, false);
  assert.strictEqual(nodes['[data-account-who]'].textContent, 'Hi Fuvtu!');
  assert.strictEqual(nodes['[data-account-avatar]'].textContent, 'FU');
  assert.strictEqual(nodes['[data-pub-call]'].hidden, true, 'Overview does not keep the publishing unlock clone');
  assert.strictEqual(nodes['[data-release-tiles]'].hidden, false);
  assert.strictEqual(nodes['[data-release-tiles]'].children.length, 1);
  assert.strictEqual(nodes['[data-release-tiles]'].children[0].href, 'song.html?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.strictEqual(nodes['[data-account-releases]'].textContent, '0');
  assert.strictEqual(nodes['[data-account-pending]'].textContent, '1');
  assert.strictEqual(nodes['[data-next-up]'].hidden, false);
  assert.strictEqual(nodes['[data-next-up-title]'].textContent, 'Fix this release');
  assert.strictEqual(nodes['[data-next-up-body]'].textContent, QC_LINES);
  assert.strictEqual(nodes['[data-msp-section]'].hidden, true, 'Overview does not open an MSP board');
  assert.strictEqual(nodes['[data-msp-songs]'].children.length, 0);

  const draftOnly = fillAccount(
    { artist: 'The Interceptors', plan: 'basic', email: 'victoriaimtanes@gmail.com' },
    { saved_draft: true, title: 'The Interceptors', tonegrid_status: 'draft' }
  );
  assert.strictEqual(draftOnly['[data-first-song]'].hidden, true, 'local saved draft hides the empty strip');
  assert.strictEqual(draftOnly['[data-has-release]'].hidden, false);
  assert.strictEqual(draftOnly['[data-release-tiles]'].hidden, false);
  assert.strictEqual(draftOnly['[data-release-tiles]'].children.length, 1);
  assert.strictEqual(draftOnly['[data-release-tiles]'].children[0].href, 'upload.html');
  assert.strictEqual(draftOnly['[data-release-tiles]'].children[0].children[1].textContent, 'The Interceptors');
  assert.strictEqual(draftOnly['[data-release-tiles]'].children[0].children[2].textContent, 'Draft');

  const named = fillAccount({ artist: 'Victoria Imtanes', plan: 'creator', email: 'victoriaimtanes@gmail.com' });
  assert.strictEqual(named['[data-account-who]'].textContent, 'Hi Victoria!');
  assert.strictEqual(named['[data-account-avatar]'].textContent, 'VI');
  assert.strictEqual(named['[data-account-avatar]'].style.backgroundImage || '', '', 'header stays initials when no account photo');

  const namedPhoto = fillAccount({
    artist: 'mexeu mexeu',
    plan: 'basic',
    email: 'victoriaimtanes@gmail.com',
    profile: { photo: 'data:image/jpeg;base64,abc' },
  });
  assert.ok(String(namedPhoto['[data-account-avatar]'].style.backgroundImage || '').indexOf('data:image/jpeg') !== -1, 'header uses the saved account photo');
  assert.strictEqual(namedPhoto['[data-account-avatar]'].textContent, '', 'account photo replaces leftover MM initials');

  const namedNoPhoto = fillAccount({ artist: 'mexeu mexeu', plan: 'basic', email: 'victoriaimtanes@gmail.com' });
  assert.strictEqual(namedNoPhoto['[data-account-avatar]'].textContent, 'MM', 'header uses initials when no account photo');
  assert.strictEqual(namedNoPhoto['[data-account-avatar]'].style.backgroundImage || '', '');
  assert.strictEqual(named['[data-account-pending]'].textContent, '0');
  assert.strictEqual(named['[data-account-artists]'].textContent, '0');
  assert.strictEqual(named['[data-next-up-title]'].textContent, 'Submit your first song');
  assert.strictEqual(named['[data-account-plan-title]'].textContent, 'On Creator');
  assert.strictEqual(named['[data-account-plan-price]'].textContent, 'Creator · $14.99/month');
  assert.strictEqual(named['[data-account-plan-year]'].textContent, 'or $149/year');
  assert.strictEqual(named['[data-account-plan-year]'].hidden, false);

  const creator = fillAccount({ artist: 'Fuvtu', plan: 'creator', email: 'victoriaimtanes@gmail.com' });
  assert.strictEqual(creator['[data-account-who]'].textContent, 'Hi Fuvtu!');
  assert.strictEqual(creator['[data-next-up-title]'].textContent, 'Submit your first song');

  const creatorCatalog = fillAccount({
    artist: 'Mamamastermind',
    plan: 'creator',
    email: 'victoriaimtanes@gmail.com',
    tonegrid_release_ids: [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ],
  });
  assert.strictEqual(creatorCatalog['[data-release-tiles]'].children.length, 2, 'Overview strip keeps a short list');
  assert.strictEqual(creatorCatalog['[data-account-pending]'].textContent, '2');

  const pro = fillAccount({ artist: 'Fuvtu', plan: 'pro' });
  assert.strictEqual(pro['[data-next-up-title]'].textContent, 'Submit your first song');

  const missing = fillAccount({ artist: '', plan: 'creator', email: 'victoriaimtanes@gmail.com' });
  assert.strictEqual(missing['[data-account-who]'].textContent, 'Hi there');
  assert.strictEqual(missing['[data-account-avatar]'].textContent, 'PG');

  const leftoverJohn = fillAccount({ artist: 'John Harper', plan: 'creator' });
  assert.strictEqual(leftoverJohn['[data-account-who]'].textContent, 'Hi there', 'Patrick/John mock must not greet as John');
  assert.strictEqual(leftoverJohn['[data-account-avatar]'].textContent, 'PG');
  assert.strictEqual(leftoverJohn['[data-account-artist]'].value, '', 'Settings must not prefill a John mock');

  const leftoverHam = fillAccount({ artist: 'John ham', plan: 'creator', email: 'victoriaimtanes@gmail.com' });
  assert.strictEqual(leftoverHam['[data-account-who]'].textContent, 'Hi there', 'John ham leftover must not greet as John');
  assert.strictEqual(leftoverHam['[data-account-avatar]'].textContent, 'PG');
  assert.strictEqual(leftoverHam['[data-account-artist]'].value, '', 'Settings artist field must stay empty for John ham');

  ['John Ham', 'Patrick', 'Neon Shadows', 'Victoria Reyes', 'Victoria Void'].forEach(function (name) {
    const leftover = fillAccount({ artist: name, plan: 'creator' });
    assert.strictEqual(leftover['[data-account-who]'].textContent, 'Hi there', name + ' leftover must greet as Hi there');
    assert.strictEqual(leftover['[data-account-avatar]'].textContent, 'PG', name + ' leftover must use PG initials');
    assert.strictEqual(leftover['[data-account-artist]'].value, '', name + ' leftover must not prefill Settings');
  });

  const fromRoster = fillAccount({
    artist: 'John ham',
    plan: 'creator',
    profile: { artists: [{ name: 'Fuvtu' }] },
  });
  assert.strictEqual(fromRoster['[data-account-who]'].textContent, 'Hi Fuvtu!', 'use the real roster name over a John mock');
  assert.strictEqual(fromRoster['[data-account-avatar]'].textContent, 'FU');
  assert.strictEqual(fromRoster['[data-account-artist]'].value, '', 'Settings must not copy a roster name over a leftover account artist');
  assert.strictEqual(fromRoster['[data-account-artists]'].textContent, '1');

  const realArtist = fillAccount({ artist: 'Fuvtu', plan: 'creator' });
  assert.strictEqual(realArtist['[data-account-artist]'].value, 'Fuvtu');

  const leftoverLive = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: [],
    profile: { releases: [{ title: 'Neon Sermon', tonegrid_status: 'live' }] },
  });
  assert.strictEqual(leftoverLive['[data-pub-call]'].hidden, true, 'empty catalog must not claim a live release');
  assert.strictEqual(leftoverLive['[data-account-releases]'].textContent, '0');
  assert.strictEqual(leftoverLive['[data-account-pending]'].textContent, '0');
  assert.strictEqual(leftoverLive['[data-next-up-title]'].textContent, 'Submit your first song');
  assert.strictEqual(leftoverLive['[data-msp-section]'].hidden, true, 'empty catalog must not open MSP');
  assert.strictEqual(leftoverLive['[data-release-tiles]'].children.length, 0);

  const liveRelease = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'live' }] },
  });
  assert.strictEqual(liveRelease['[data-msp-section]'].hidden, true, 'Overview must not invent MSP earnings');
  assert.strictEqual(liveRelease['[data-msp-songs]'].children.length, 0);
  assert.strictEqual(liveRelease['[data-release-tiles]'].children[0].children[1].textContent, 'Night Drive');
  assert.strictEqual(liveRelease['[data-release-tiles]'].children[0].children[2].textContent, 'Live');
  assert.strictEqual(liveRelease['[data-account-releases]'].textContent, '1');
  assert.strictEqual(liveRelease['[data-account-pending]'].textContent, '0');
  assert.strictEqual(liveRelease['[data-next-up-title]'].textContent, 'Add a payout method');

  const liveCover = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'live', artwork_url: 'https://cdn.example/night.jpg' }] },
  });
  assert.ok(liveCover['[data-release-tiles]'].children[0].children[0].style.backgroundImage.indexOf('night.jpg') !== -1, 'Overview tiles paint stored cover art');
  const emptyCover = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'pending' }] },
  });
  assert.strictEqual(emptyCover['[data-release-tiles]'].children[0].children[0].style.backgroundImage || '', '', 'empty placeholder stays when there is no cover');
  assert.strictEqual(emptyCover['[data-release-tiles]'].children[0].children[2].textContent, 'Needs fix');
  assert.strictEqual(emptyCover['[data-release-tiles]'].children[0].children[3].textContent, QC_LINES);

  const mixedTiles = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ],
    profile: { releases: [
      { tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Waiting', tonegrid_status: 'pending' },
      { tonegrid_release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Night Drive', tonegrid_status: 'live' },
      { tonegrid_release_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fix Me', tonegrid_status: 'needs-fix', rejection_reason: 'Cover art is too small.' },
    ] },
  });
  assert.strictEqual(mixedTiles['[data-release-tiles]'].children.length, 3, 'Overview strip includes pending with live');
  assert.strictEqual(mixedTiles['[data-release-tiles]'].children[0].children[2].textContent, 'Needs fix');
  assert.strictEqual(mixedTiles['[data-release-tiles]'].children[1].children[2].textContent, 'Live');
  assert.strictEqual(mixedTiles['[data-release-tiles]'].children[2].children[2].textContent, 'Needs fix');
  assert.strictEqual(mixedTiles['[data-release-tiles]'].children[0].children[3].textContent, 'Cover art is too small.\n' + QC_LINES);
  assert.strictEqual(mixedTiles['[data-release-tiles]'].children[2].children[3].textContent, QC_LINES);
  assert.strictEqual(mixedTiles['[data-account-releases]'].textContent, '1', 'Releases live stays a live count');
  assert.strictEqual(mixedTiles['[data-account-pending]'].textContent, '2');
  assert.strictEqual(mixedTiles['[data-next-up-title]'].textContent, 'Fix this release');
  assert.strictEqual(mixedTiles['[data-next-up-body]'].textContent, QC_LINES);

  const songwriterFix = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{
      tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fix Me',
      tonegrid_status: 'needs-fix',
      rejection_reason: 'Songwriter name cannot be a stage or rapper name.',
    }] },
  });
  assert.strictEqual(songwriterFix['[data-next-up-title]'].textContent, 'Fix this release');
  assert.strictEqual(songwriterFix['[data-next-up-body]'].textContent, 'Stores need real songwriter names, not a stage, rapper, or band name.\n' + QC_LINES);

  const creditFix = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{
      tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fix Me',
      tonegrid_status: 'needs-fix',
      rejection_reason: 'Missing performer credit and producer credit.',
    }] },
  });
  assert.strictEqual(creditFix['[data-next-up-body]'].textContent, 'This release needs a performer credit and a producer credit.\n' + QC_LINES);
  assert.strictEqual(emptyCover['[data-next-up-title]'].textContent, 'Fix this release');
  assert.strictEqual(emptyCover['[data-next-up-body]'].textContent, QC_LINES);
  assert.strictEqual(mixedTiles['[data-next-up-body]'].textContent, QC_LINES);

  const missingWriterNames = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{
      tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fix Me',
      tonegrid_status: 'needs-fix',
      rejection_reason: 'Missing songwriter names.',
    }] },
  });
  assert.strictEqual(missingWriterNames['[data-next-up-body]'].textContent, 'Stores need real songwriter names, not a stage, rapper, or band name.\n' + QC_LINES);

  const firstLastWriter = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{
      tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fix Me',
      tonegrid_status: 'needs-fix',
      rejection_reason: 'Each songwriter must have a first and last name.',
    }] },
  });
  assert.strictEqual(firstLastWriter['[data-next-up-body]'].textContent, 'Stores need real songwriter names, not a stage, rapper, or band name.\n' + QC_LINES);

  const performerOnly = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{
      tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fix Me',
      tonegrid_status: 'needs-fix',
      rejection_reason: 'Performer credit is required.',
    }] },
  });
  assert.strictEqual(performerOnly['[data-next-up-body]'].textContent, 'This release needs a performer credit and a producer credit.\n' + QC_LINES);

  const producerOnly = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{
      tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fix Me',
      tonegrid_status: 'needs-fix',
      rejection_reason: 'Producer credit is missing.',
    }] },
  });
  assert.strictEqual(producerOnly['[data-next-up-body]'].textContent, 'This release needs a performer credit and a producer credit.\n' + QC_LINES);

  const legalOnly = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{
      tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fix Me',
      tonegrid_status: 'needs-fix',
      rejection_reason: 'Legal name is required.',
    }] },
  });
  assert.strictEqual(legalOnly['[data-next-up-body]'].textContent, 'Legal name is required.\n' + QC_LINES, 'legal-name QC must not invent the songwriter leftover');

  const firstLastOnly = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{
      tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Fix Me',
      tonegrid_status: 'needs-fix',
      rejection_reason: 'First and last name required.',
    }] },
  });
  assert.strictEqual(firstLastOnly['[data-next-up-body]'].textContent, 'First and last name required.\n' + QC_LINES, 'first-last without songwriter must not invent that leftover');
  assert.ok(!/ToneGrid|InterSpace|Flossy/i.test(songwriterFix['[data-next-up-body]'].textContent));
  assert.ok(!/ToneGrid|InterSpace|Flossy/i.test(creditFix['[data-next-up-body]'].textContent));
  assert.ok(String(mixedTiles['[data-next-up-link]'].href).indexOf('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') !== -1);

  const unknownTiles = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Maybe', tonegrid_status: 'mystery' }] },
  });
  assert.strictEqual(unknownTiles['[data-release-tiles]'].children[0].children[2].textContent, 'Pending');
  assert.notStrictEqual(unknownTiles['[data-release-tiles]'].children[0].children[2].textContent, 'Live', 'unknown status must not invent Live');
  assert.strictEqual(unknownTiles['[data-release-tiles]'].children[0].children.length, 3, 'unknown status has no fake error');
  assert.strictEqual(unknownTiles['[data-account-releases]'].textContent, '0');
  assert.strictEqual(unknownTiles['[data-account-pending]'].textContent, '1');
  assert.notStrictEqual(unknownTiles['[data-next-up-title]'].textContent, 'Fix this release', 'unknown status must not invent a problem');

  const sixTiles = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
    ],
  });
  assert.strictEqual(sixTiles['[data-release-tiles]'].children.length, 4, 'Overview strip is not the full catalog');
  assert.strictEqual(sixTiles['[data-account-pending]'].textContent, '6');

  const splitLatest = fillAccount({
    artist: 'Fuvtu',
    plan: 'basic',
    tonegrid_release_ids: [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
    ],
    profile: { releases: [
      { tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'One', legal_first: 'Ada', legal_last: 'Night', solo_owned_100: true },
      { tonegrid_release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Two', legal_first: 'Ada', legal_last: 'Night', solo_owned_100: true },
      { tonegrid_release_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Three', signwell_document_id: 'doc_pending_01', signwell_status: 'awaiting_signature', writers: [{ first_name: 'Ada', last_name: 'Night' }, { first_name: 'Bea', last_name: 'Vale' }] },
      { tonegrid_release_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'Four' },
      { tonegrid_release_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Five', signwell_signed: true, signwell_status: 'Completed', writers: [{ first_name: 'Ada', last_name: 'Night' }] },
      { tonegrid_release_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', title: 'Six', legal_first: 'Ada', legal_last: 'Night', solo_owned_100: true },
    ] },
  });
  assert.strictEqual(splitLatest['[data-split-sheets-rows]'].children.length, 5, 'Overview Split sheets shows latest 5');
  assert.strictEqual(splitLatest['[data-split-sheets-table]'].hidden, false);
  assert.strictEqual(splitLatest['[data-split-sheets-empty]'].hidden, true);
  assert.strictEqual(splitLatest['[data-split-sheets-rows]'].children[0].children[0].children[0].textContent, 'Six');
  assert.strictEqual(splitLatest['[data-split-sheets-rows]'].children[0].children[1].textContent, 'Ada Night');
  assert.strictEqual(splitLatest['[data-split-sheets-rows]'].children[0].children[2].textContent, 'self-attested, no sheet required');
  assert.strictEqual(splitLatest['[data-split-sheets-rows]'].children[1].children[2].textContent, 'yes');
  assert.strictEqual(splitLatest['[data-split-sheets-rows]'].children[2].children[2].textContent, 'no');
  assert.strictEqual(splitLatest['[data-split-sheets-rows]'].children[3].children[2].textContent, 'pending');
  assert.notStrictEqual(splitLatest['[data-split-sheets-rows]'].children[0].children[1].textContent, 'Fuvtu', 'writer line is legal name, not stage name');

  const splitEmpty = fillAccount({ artist: 'Fuvtu', plan: 'basic' });
  assert.strictEqual(splitEmpty['[data-split-sheets-empty]'].hidden, false);
  assert.strictEqual(splitEmpty['[data-split-sheets-table]'].hidden, true);

  const leftoverArtists = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    profile: { artists: [{ name: 'John ham' }, { name: 'Ada Night' }] },
  });
  assert.strictEqual(leftoverArtists['[data-account-artists]'].textContent, '1', 'leftover mock artists do not count');

  assert.ok(dash.includes('href="problem.html"'), 'Have a problem? stays the typed report page');
  assert.ok(!/release-tile[\s\S]{0,200}Have a problem\?/.test(dash), 'on-card status is not the typed report');

  const namedField = fillAccount({ artist: 'Victoria Imtanes', plan: 'creator' });
  assert.strictEqual(namedField['[data-account-artist]'].value, 'Victoria Imtanes', 'a real stored name stays');
  assert.strictEqual(named['[data-account-artist]'].value, 'Victoria Imtanes');

  assert.ok(!dash.includes('Hi John'), 'dashboard.html must not hardcode Hi John');
  assert.ok(dash.includes('data-account-who>Hi there'), 'unsigned greeting stays Hi there');
  assert.ok(dash.includes('data-account-plan-price'), 'Overview sidebar price is filled from /api/me');
  assert.ok(dash.includes('data-account-plan-year'), 'Overview yearly price stays on its own line');
  assert.ok(!/PRO\s*•/.test(dash), 'dashboard must not tag publishing as Pro-only');
  assert.ok(!dash.includes('INCLUDED IN YOUR PLAN'), 'Overview must not keep the publishing unlock badge');
  assert.ok(!dash.includes('Your song is in the catalog'), 'Overview must not clone Releases catalog copy');
  assert.ok(!dash.includes('Upgrade to Pro only'), 'dashboard must not say Upgrade to Pro only');
  assert.ok(!dash.includes('Hi John!'), 'dashboard must not greet John');
  assert.ok(!/>On Pro</.test(dash), 'dashboard sidebar must not default to On Pro');
  assert.ok(!dash.includes('Split sheets signed'), 'Overview must not show Split sheets signed');
  assert.ok(!dash.includes('Plan renews'), 'Overview must not show a Plan renews line');
  assert.ok(!dash.includes('data-plan-renews'), 'Overview must not paint a Stripe renewal date');
  const accountCard = dash.match(/<div class="account-card">[\s\S]*<div class="release-board">/);
  assert.ok(accountCard, 'Overview Your account card is present');
  assert.ok(accountCard[0].includes('Releases live'), 'Your account keeps Releases live');
  assert.ok(accountCard[0].includes('Releases pending'), 'Your account keeps Releases pending');
  assert.ok(accountCard[0].includes('Artist profiles'), 'Your account keeps Artist profiles');
  assert.ok(accountCard[0].includes('Payout method'), 'Your account keeps Payout method');
  assert.ok(!accountCard[0].includes('Split sheets signed'), 'Your account card must not keep Split sheets signed');
  assert.ok(!accountCard[0].includes('Plan renews'), 'Your account card must not keep Plan renews');
  assert.ok(read('account.js').includes('stripOverviewLeftoverRows'), 'Overview leftover rows are stripped if HTML still has them');
  assert.ok(read('settings.html').includes('data-plan-renews'), 'Plan renews stays on Settings only');
  assert.ok(!read('settings.html').includes('Releases pending'), 'Settings stays off the pending leftover');
  assert.ok(!read('settings.html').includes('data-account-pending'), 'Settings must not paint Releases pending');
  assert.ok(!read('settings.html').includes('data-account-artists'), 'Settings must not paint Artist profiles count');
  assert.ok(!read('settings.html').includes('data-next-up'), 'Settings must not get the Overview next-up card');
  assert.ok(!read('settings.html').includes('data-plai-talk'), 'Settings must not get the Overview Talk CTA');

  const leftoverSigned = makeNode({ textContent: 'Split sheets signed' });
  leftoverSigned.querySelector = function () { return { textContent: 'Split sheets signed' }; };
  const leftoverRenews = makeNode({ textContent: 'Plan renews' });
  leftoverRenews.querySelector = function () { return { textContent: 'Plan renews' }; };
  const payoutRow = makeNode({ textContent: 'Payout method' });
  payoutRow.querySelector = function () { return { textContent: 'Payout method' }; };
  const leftoverParent = {
    children: [leftoverSigned, leftoverRenews, payoutRow],
    removeChild(child) {
      this.children = this.children.filter(function (row) { return row !== child; });
      return child;
    },
  };
  leftoverSigned.parentNode = leftoverParent;
  leftoverRenews.parentNode = leftoverParent;
  payoutRow.parentNode = leftoverParent;
  const leftoverDoc = {
    currentScript: { getAttribute() { return null; } },
    querySelector() { return null; },
    querySelectorAll(sel) {
      if (sel === '.account-card .row') return leftoverParent.children.slice();
      return [];
    },
    addEventListener() {},
  };
  const leftoverCtx = {
    document: leftoverDoc,
    location: { href: 'dashboard.html', pathname: '/dashboard.html', search: '', replace() {} },
    fetch() { return Promise.resolve({ ok: false, status: 401, json: async () => ({}) }); },
  };
  leftoverCtx.window = leftoverCtx;
  leftoverCtx.globalThis = leftoverCtx;
  vm.runInNewContext(read('account.js'), leftoverCtx);
  leftoverCtx.PlaigroundAccount.stripOverviewLeftoverRows();
  assert.strictEqual(leftoverParent.children.length, 1, 'leftover Split sheets signed and Plan renews rows are removed');
  assert.strictEqual(leftoverParent.children[0], payoutRow, 'Payout method stays on the Your account card');

  const settings = read('settings.html');
  assert.ok(!settings.includes('Hi John'), 'settings.html must not hardcode Hi John');
  assert.ok(!settings.includes('John ham'), 'settings.html must not hardcode John ham');
  assert.ok(!/>JH</.test(settings), 'settings.html must not hardcode JH initials');
  assert.ok(!/>VV</.test(settings), 'settings.html must not hardcode leftover VV initials');
  assert.ok(settings.includes('data-account-who>Hi there'), 'settings unsigned greeting stays Hi there');
  assert.ok(settings.includes('data-account-avatar>PG'), 'settings unsigned initials stay PG');
  assert.ok(settings.includes('placeholder="Username"'), 'settings username field is the community handle');
  assert.ok(!settings.includes('placeholder="Artist name"'), 'settings must not collect artist name');
  assert.ok(!/data-account-username[^>]*(legal name|FIRST NAME LAST NAME)/i.test(settings));
  ['earnings.html', 'payouts.html', 'splits.html', 'splits-empty.html', 'releases.html', 'how.html', 'upload.html', 'contact.html', 'faq.html'].forEach(function (file) {
    const html = read(file);
    assert.ok(!html.includes('Hi John'), file + ' must not hardcode Hi John');
    assert.ok(!html.includes('John ham'), file + ' must not hardcode John ham');
    assert.ok(!html.includes('Hi Victoria!'), file + ' must not hardcode Hi Victoria');
    assert.ok(html.includes('data-account-who>Hi there'), file + ' unsigned greeting stays Hi there');
    assert.ok(html.includes('data-account-avatar>PG'), file + ' unsigned initials stay PG');
  });

  const upload = read('upload.html');
  assert.ok(upload.includes('Choose artist profile'));
  assert.ok(upload.includes('placeholder="Artist name"'));
  assert.ok(!/id="tg-artist"[^>]*legal name/i.test(upload));
  assert.ok(upload.includes('data-type="album"'), 'upload page can start an album');
  assert.ok(upload.includes('data-track-list'), 'album track list is on the upload page');
  assert.ok(read('store-client.js').includes('syncAlbumUi(next)'), 'Album click applies album, not the leftover Single class');
  assert.ok(dash.includes('data-publishing-register'), 'Publishing shortcut is gated in JS');
  assert.ok(dash.includes('href="publishing-register.html"'), 'paid Publishing shortcut opens the registration page');
  assert.ok(!dash.includes('upload.html?type=album'), 'dashboard must not start an album');
  assert.ok(read('releases.html').includes('upload.html?type=album'), 'releases can start an album');
  assert.ok(/data-album-upload[^>]*data-for-plans="creator pro"|data-for-plans="creator pro"[^>]*data-album-upload/.test(read('releases.html')), 'album on Releases is Creator and Pro only');

  console.log('dashboard.page.test.js ok');
}

run();
