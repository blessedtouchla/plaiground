'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
  'how.html',
  'library.html',
  'song.html',
  'upload.html',
  'attest.html',
  'review.html',
  'split-sheet.html',
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
  assert.ok(dash.includes('Start your first song submission'), 'dashboard greeting is missing');
  assert.ok(dash.includes('<h1>Your releases</h1>'), 'dashboard heading must be Your releases');
  assert.ok(!/<h1[^>]*>Your release<\/h1>/.test(dash), 'dashboard heading must not stay singular');
  assert.ok(dash.includes('Submit your first song'), 'first-song CTA is missing');
  assert.ok(dash.includes('data-first-song'), 'first-song empty state hook is missing');
  assert.ok(dash.includes('data-has-release'), 'submitted-release hook is missing');
  assert.ok(dash.includes('data-latest-edit'), 'latest-release card must have Edit release');
  assert.ok(dash.includes('Edit release'), 'latest-release card must label Edit release');
  assert.ok(dash.includes('All releases'), 'latest-release card must keep All releases');
  assert.ok(!dash.includes('View release'), 'Overview purple button must not stay View release');
  assert.ok(/class="btn btn-purple btn-md" href="upload.html" data-new-release data-signed-in-upload>New release<\/a>/.test(dash), 'Overview purple button is New release to upload.html');
  assert.ok(!/data-latest-link/.test(dash), 'Overview New release must not be rewritten to the latest song');
  assert.ok(dash.includes('data-release-tiles'), 'release cover tiles are missing');
  assert.ok(dash.includes('Unlock MSP — Multiple Streams of Revenue'), 'publishing CTA must unlock MSP');
  assert.ok(dash.includes('Publishing unlocks MSP (societies, not stores)'), 'MSP unlock copy is missing');
  assert.ok(dash.includes('data-msp-section'), 'MSP section is missing');
  assert.ok(read('site.css').includes('.pub-call[hidden]'), 'publishing CTA must stay hidden when empty');
  assert.ok(dash.includes('Pending'), 'submitted Pending copy is missing');
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
  assert.ok(dash.includes('data-first-song'), 'empty first-song hero stays in markup');
  assert.ok(dash.includes('data-has-release'), 'submitted-release hero is in markup');
  assert.ok(dash.includes('Pending'), 'submitted state shows Pending');
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
      '[data-latest-edit]': makeNode({ href: 'song.html' }),
      '[data-account-releases]': makeNode({ textContent: '0' }),
      '[data-account-who]': makeNode({ textContent: 'Hi there' }),
      '[data-account-avatar]': makeNode({ textContent: 'PG' }),
      '[data-account-artist]': makeNode({ tagName: 'INPUT', value: '' }),
      '[data-pub-call]': makeNode({ hidden: true }),
      '[data-pub-badge]': makeNode({ textContent: 'INCLUDED IN YOUR PLAN' }),
      '[data-account-plan-title]': makeNode({ textContent: 'Your plan' }),
      '[data-account-plan-price]': makeNode({ textContent: 'Your plan' }),
      '[data-account-plan-year]': makeNode({ hidden: true }),
      '[data-release-tiles]': makeHost(),
      '[data-msp-section]': makeNode({ hidden: true }),
      '[data-msp-lock]': makeNode({ hidden: true }),
      '[data-msp-open]': makeNode({ hidden: true }),
      '[data-msp-songs]': makeHost(),
    };
  }

  function fillAccount(me) {
    const nodes = fillNodes();
    const fillDoc = {
      currentScript: { getAttribute() { return null; } },
      querySelector(sel) { return nodes[sel] || null; },
      querySelectorAll(sel) { return nodes[sel] ? [nodes[sel]] : []; },
      createElement() { return makeNode({}); },
      addEventListener() {},
    };
    const fillCtx = {
      URLSearchParams,
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      document: fillDoc,
      location: { href: 'dashboard.html', pathname: '/dashboard.html', search: '', replace() {} },
      fetch() { return Promise.resolve({ ok: false, status: 401, json: async () => ({}) }); },
    };
    fillCtx.window = fillCtx;
    fillCtx.globalThis = fillCtx;
    vm.runInNewContext(read('lib/release-status.js'), fillCtx);
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
  assert.strictEqual(nodes['[data-first-song]'].hidden, true, 'first-song hero hides after Basic submit');
  assert.strictEqual(nodes['[data-has-release]'].hidden, false);
  assert.strictEqual(nodes['[data-first-upload]'].hidden, true);
  assert.strictEqual(nodes['[data-latest-status]'].textContent, 'Pending');
  assert.ok(String(nodes['[data-latest-link]'].href).indexOf('song.html?id=') !== -1);
  assert.ok(String(nodes['[data-latest-edit]'].href).indexOf('song.html?id=') !== -1);
  assert.ok(String(nodes['[data-latest-edit]'].href).indexOf('edit=1') !== -1);
  assert.strictEqual(nodes['[data-account-who]'].textContent, 'Hi Fuvtu!');
  assert.strictEqual(nodes['[data-account-avatar]'].textContent, 'FU');
  assert.strictEqual(nodes['[data-pub-badge]'].textContent, 'INCLUDED ON CREATOR AND PRO');
  assert.strictEqual(nodes['[data-pub-call]'].hidden, false, 'publishing CTA shows after a real release exists');
  assert.strictEqual(nodes['[data-release-tiles]'].hidden, false);
  assert.strictEqual(nodes['[data-release-tiles]'].children.length, 1);
  assert.strictEqual(nodes['[data-release-tiles]'].children[0].href, 'song.html?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.strictEqual(nodes['[data-msp-section]'].hidden, false);
  assert.strictEqual(nodes['[data-msp-lock]'].hidden, false, 'pending releases keep MSP locked');
  assert.strictEqual(nodes['[data-msp-open]'].hidden, true);
  assert.strictEqual(nodes['[data-msp-songs]'].children.length, 0);

  const named = fillAccount({ artist: 'Victoria Imtanes', plan: 'creator', email: 'victoriaimtanes@gmail.com' });
  assert.strictEqual(named['[data-account-who]'].textContent, 'Hi Victoria!');
  assert.strictEqual(named['[data-account-avatar]'].textContent, 'VI');
  assert.strictEqual(named['[data-pub-badge]'].textContent, 'INCLUDED IN YOUR PLAN');
  assert.strictEqual(named['[data-account-plan-title]'].textContent, 'On Creator');
  assert.strictEqual(named['[data-account-plan-price]'].textContent, 'Creator · $14.99/month');
  assert.strictEqual(named['[data-account-plan-year]'].textContent, 'or $149/year');
  assert.strictEqual(named['[data-account-plan-year]'].hidden, false);

  const creator = fillAccount({ artist: 'Fuvtu', plan: 'creator', email: 'victoriaimtanes@gmail.com' });
  assert.strictEqual(creator['[data-account-who]'].textContent, 'Hi Fuvtu!');
  assert.strictEqual(creator['[data-pub-badge]'].textContent, 'INCLUDED IN YOUR PLAN');
  assert.ok(creator['[data-pub-badge]'].textContent.indexOf('PRO') === -1, 'Creator publishing badge must not say Pro-only');

  const pro = fillAccount({ artist: 'Fuvtu', plan: 'pro' });
  assert.strictEqual(pro['[data-pub-badge]'].textContent, 'INCLUDED IN YOUR PLAN');

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
  assert.strictEqual(leftoverLive['[data-msp-section]'].hidden, true, 'empty catalog must not open MSP');
  assert.strictEqual(leftoverLive['[data-release-tiles]'].children.length, 0);

  const liveRelease = fillAccount({
    artist: 'Fuvtu',
    plan: 'creator',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'live' }] },
  });
  assert.strictEqual(liveRelease['[data-msp-lock]'].hidden, true);
  assert.strictEqual(liveRelease['[data-msp-open]'].hidden, false, 'live releases open MSP');
  assert.strictEqual(liveRelease['[data-msp-songs]'].children.length, 1);
  assert.strictEqual(liveRelease['[data-msp-songs]'].children[0].children[0].textContent, 'Night Drive');
  assert.ok(liveRelease['[data-msp-songs]'].children[0].children.some(function (child) {
    return (child.children || []).some(function (inner) { return inner.textContent === '$0.00'; });
  }), 'MSP stays at $0 until real society data exists');
  assert.strictEqual(liveRelease['[data-release-tiles]'].children[0].children[1].textContent, 'Night Drive');
  assert.strictEqual(liveRelease['[data-release-tiles]'].children[0].children[2].textContent, 'Live');
  assert.strictEqual(liveRelease['[data-account-releases]'].textContent, '1');

  const namedField = fillAccount({ artist: 'Victoria Imtanes', plan: 'creator' });
  assert.strictEqual(namedField['[data-account-artist]'].value, 'Victoria Imtanes', 'a real stored name stays');
  assert.strictEqual(named['[data-account-artist]'].value, 'Victoria Imtanes');

  assert.ok(!dash.includes('Hi John'), 'dashboard.html must not hardcode Hi John');
  assert.ok(dash.includes('data-account-who>Hi there'), 'unsigned greeting stays Hi there');
  assert.ok(dash.includes('data-account-plan-price'), 'Overview sidebar price is filled from /api/me');
  assert.ok(dash.includes('data-account-plan-year'), 'Overview yearly price stays on its own line');
  assert.ok(!/PRO\s*•/.test(dash), 'dashboard must not tag publishing as Pro-only');
  assert.ok(dash.includes('data-pub-badge'), 'publishing badge is filled from the signed-in plan');
  assert.ok(dash.includes('INCLUDED IN YOUR PLAN'), 'paid publishing badge copy is present');
  assert.ok(dash.includes('data-for-plans="basic">Your song is in the catalog. Basic includes this one lifetime release.'), 'Basic lifetime copy is Basic-only');
  assert.ok(dash.includes('data-for-plans="creator pro" hidden>Your song is in the catalog.'), 'Creator/Pro catalog copy omits Basic lifetime language');
  assert.ok(dash.includes('data-for-plans="basic">Submitted and in the queue. Open it anytime — a second first upload is not included on Basic.'), 'Basic queue copy stays Basic-only');
  assert.ok(!/data-for-plans="creator[^"]*"[^>]*>[^<]*lifetime release/.test(dash), 'Creator/Pro must not see Basic lifetime language');
  assert.ok(!dash.includes('Upgrade to Pro only'), 'dashboard must not say Upgrade to Pro only');
  assert.ok(!dash.includes('Hi John!'), 'dashboard must not greet John');
  assert.ok(!/>On Pro</.test(dash), 'dashboard sidebar must not default to On Pro');

  const settings = read('settings.html');
  assert.ok(!settings.includes('Hi John'), 'settings.html must not hardcode Hi John');
  assert.ok(!settings.includes('John ham'), 'settings.html must not hardcode John ham');
  assert.ok(!/>JH</.test(settings), 'settings.html must not hardcode JH initials');
  assert.ok(!/>VV</.test(settings), 'settings.html must not hardcode leftover VV initials');
  assert.ok(settings.includes('data-account-who>Hi there'), 'settings unsigned greeting stays Hi there');
  assert.ok(settings.includes('data-account-avatar>PG'), 'settings unsigned initials stay PG');
  assert.ok(settings.includes('placeholder="Artist name"'), 'settings artist field stays an artist-name placeholder');
  assert.ok(!/data-account-artist[^>]*(legal name|FIRST NAME LAST NAME)/i.test(settings));
  ['earnings.html', 'payouts.html', 'splits.html', 'splits-empty.html', 'releases.html', 'how.html', 'upload.html'].forEach(function (file) {
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
  assert.ok(dash.includes('data-publishing-register'), 'Register for publishing is gated in JS');
  assert.ok(dash.includes('href="publishing-register.html"'), 'paid Register opens the registration page');
  assert.ok(dash.includes('upload.html?type=album'), 'dashboard can start an album');
  assert.ok(read('releases.html').includes('upload.html?type=album'), 'releases can start an album');

  console.log('dashboard.page.test.js ok');
}

run();
