'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function makeEl(attrs) {
  return {
    hidden: Boolean(attrs && attrs.hidden),
    textContent: (attrs && attrs.textContent) || '',
    className: '',
    style: {},
    children: [],
    colSpan: 0,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
}

function loadScript(file, nodes) {
  const context = {
    document: {
      querySelector(sel) {
        return nodes[sel] || null;
      },
      createElement() {
        return makeEl({});
      },
    },
    fetch() {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    },
    window: {},
  };
  context.window = context;
  vm.runInNewContext(read(file), context);
  return context;
}

function run() {
  const forbidden = [
    '7,412,908',
    '$18,942.60',
    '$3,412.85',
    '$18,412.44',
    'Hi John',
    'John Doe',
    'John ham',
    'John Ham',
    '4,182,680',
    'Neon Shadows',
    'Neon Sermon',
    'Victoria Reyes',
    '128,412',
    '$486.20',
    'PG-2026-04427',
    'Neon Santos',
    'Los Angeles',
    '$1,284.40',
    '3,462,104',
  ];

  ['earnings.html', 'releases.html', 'analytics.html', 'dashboard.html', 'song.html', 'payouts.html', 'profile.html', 'artists.html', 'settings.html', 'splits.html', 'splits-empty.html', 'publishing-register.html', 'boosts.html', 'how.html', 'upload.html'].forEach(function (file) {
    const html = read(file);
    forbidden.forEach(function (needle) {
      assert.strictEqual(html.indexOf(needle), -1, file + ' still has ' + needle);
    });
    assert.ok(html.indexOf('plai-bubble.js') !== -1, file + ' dropped PLAI');
    assert.ok(!html.includes(['t', 'g', 'k', '_'].join('')), file + ' has a key prefix');
  });

  assert.ok(read('earnings.html').indexOf('No royalties yet.') !== -1);
  assert.ok(read('earnings.html').indexOf('data-earn-download') !== -1, 'Download statement must have a handler');
  assert.ok(read('releases.html').indexOf('Nothing here yet') !== -1);
  assert.ok(read('dashboard.html').indexOf('Your release is in the catalog') !== -1);
  assert.ok(read('dashboard.html').indexOf('data-first-song') !== -1);
  assert.ok(read('dashboard.html').indexOf('data-has-release') !== -1);
  assert.ok(read('dashboard.html').indexOf('data-for-plans="basic">Your song is in the catalog. Basic includes this one lifetime release.') !== -1);
  assert.ok(read('dashboard.html').indexOf('PRO •') === -1, 'publishing badge must not say Pro-only');
  assert.ok(read('dashboard.html').indexOf('INCLUDED IN YOUR PLAN') !== -1);
  assert.ok(read('dashboard.html').indexOf('Upgrade to Pro only') === -1);
  assert.ok(read('earnings.html').indexOf('data-require-membership="true"') !== -1);
  assert.ok(read('earnings.html').indexOf('data-require-paid') === -1, 'earnings must not bounce Basic to Pick a plan');
  assert.ok(read('earnings.html').indexOf('Upgrade to Creator') !== -1);
  assert.ok(read('earnings.html').indexOf('Upgrade to Pro') !== -1);
  assert.ok(read('earnings.html').indexOf('Retrieve payouts on Creator or Pro') !== -1);
  assert.ok(read('earnings.html').indexOf('retrieve / get paid') !== -1);
  assert.ok(read('earnings.html').indexOf('data-for-plans="basic creator"') === -1, 'Creator is not locked out of payouts');
  assert.ok(read('payouts.html').indexOf('data-require-membership="true"') !== -1);
  assert.ok(read('payouts.html').indexOf('data-require-paid') === -1);
  assert.ok(read('payouts.html').indexOf('Upgrade to Creator') !== -1);
  assert.ok(read('payouts.html').indexOf('Upgrade to Pro') !== -1);
  assert.ok(read('payouts.html').indexOf('$0.00') !== -1);
  assert.ok(read('payouts.html').indexOf('No payouts yet.') !== -1);
  assert.ok(read('payouts.html').indexOf('$19.99') === -1);
  const payouts = read('payouts.html');
  assert.ok(payouts.indexOf('Distribution is included. Retrieve / get paid unlocks on Creator or Pro.') !== -1);
  assert.ok(payouts.indexOf('data-payout-withdraw data-for-plans="creator pro"') !== -1);
  assert.ok(payouts.indexOf('data-for-plans="basic creator"') === -1, 'Creator is not locked out of payouts');
  assert.ok(!/data-for-plans="basic"[^>]*>[^<]*publishing/i.test(payouts), 'Basic payouts copy must not mention publishing');
  assert.ok(/Royalties are collected quarterly and paid automatically once your balance clears \$10/.test(payouts), 'Creator/Pro payouts intro is quarterly');
  assert.ok(/Payouts run quarterly once your balance clears \$10/.test(payouts), 'payouts math has a quarterly disclaimer');
  assert.ok(payouts.indexOf('PLAIGROUND takes no commission on your royalties. Submission fees are charged once, at the point of release, and never withheld from a payout.') !== -1);
  assert.ok(payouts.indexOf('data-require-membership="true"') !== -1, 'payouts keeps the login gate');
  assert.ok(!/collected monthly/i.test(payouts) && !/paid monthly/i.test(payouts), 'payouts must not say monthly collection or pay');
  assert.ok(read('earnings.html').indexOf('$19.99') === -1);
  assert.ok(read('dashboard.html').indexOf('data-account-plan-title') !== -1);
  assert.ok(read('dashboard.html').indexOf('>On Pro<') === -1, 'Overview must not default to leftover On Pro');
  assert.ok(read('releases.html').indexOf('>On Pro<') === -1, 'Releases must not default to leftover On Pro');
  assert.ok(read('releases.html').indexOf('data-release-filter="live"') !== -1, 'Live tab must be a real filter');
  assert.ok(read('splits.html').indexOf('data-account-who>Hi there') !== -1);
  assert.ok(read('splits-empty.html').indexOf('membership.js') !== -1, 'splits-empty must refresh the session');
  assert.ok(read('splits-empty.html').indexOf('href="earnings.html">Earnings</a>') !== -1);
  assert.ok(read('publishing-register.html').indexOf('data-require-publishing="true"') !== -1);
  assert.ok(read('publishing-register.html').indexOf('data-require-paid') === -1, 'publishing register must not use the public paid dump');
  assert.ok(read('publishing-register.html').indexOf('class="side"') !== -1, 'publishing register stays a signed-in page');
  assert.ok(read('how.html').indexOf('data-signed-in-upload') !== -1);
  assert.ok(read('earnings.html').indexOf('Upgrade to Pro only') === -1);
  assert.ok(read('payouts.html').indexOf('Upgrade to Pro only') === -1);
  assert.ok(read('earnings.html').indexOf('Hi John') === -1);
  assert.ok(read('payouts.html').indexOf('Hi John') === -1);
  assert.ok(read('settings.html').indexOf('Hi John') === -1);
  assert.ok(read('settings.html').indexOf('John ham') === -1);
  assert.ok(read('settings.html').indexOf('>VV<') === -1);
  assert.ok(read('settings.html').indexOf('data-account-artist') !== -1);

  const earnNodes = {
    '[data-earn-metrics]': makeEl({}),
    '[data-earn="available"]': makeEl({ textContent: '$0.00' }),
    '[data-earn="pending"]': makeEl({ textContent: '$0.00' }),
    '[data-earn-sources]': makeEl({}),
    '[data-earn-period]': makeEl({}),
    '[data-earn-chart]': makeEl({ hidden: true }),
    '[data-earn-chart-bars]': makeEl({}),
    '[data-earn-chart-labels]': makeEl({}),
    '[data-earn-empty]': makeEl({ hidden: true }),
    '[data-earn-status]': makeEl({ hidden: true }),
    '[data-earn-download]': makeEl({}),
  };
  const earn = loadScript('earnings.js', earnNodes);
  earn.PlaigroundEarnings.render({
    balance: { available_usd: 1.5, pending_usd: 0 },
    statements: [{ id: 'stmt_202603', period: '2026-03', total_usd: 1.5 }],
    breakdown: [{ dsp: 'Spotify', streams: 12, revenue_usd: 1.5 }],
  });
  assert.strictEqual(earnNodes['[data-earn="available"]'].textContent, '$1.50');
  assert.strictEqual(earnNodes['[data-earn="pending"]'].textContent, '$0.00');
  assert.strictEqual(earn.PlaigroundEarnings.isEmpty({
    balance: { available_usd: 0, pending_usd: 0 },
    statements: [],
    breakdown: [],
  }), true);
  assert.strictEqual(earn.PlaigroundEarnings.downloadStatement({
    balance: { available_usd: 0, pending_usd: 0 },
    statements: [],
    breakdown: [],
  }), false);
  assert.strictEqual(earnNodes['[data-earn-status]'].textContent, 'No statement yet');
  assert.ok(/No statement yet/.test(earnNodes['[data-earn-empty]'].textContent));
  assert.strictEqual(earnNodes['[data-earn="available"]'].textContent, '$0.00');

  const catalogNodes = {
    '[data-stat="total"]': makeEl({ textContent: '0' }),
    '[data-stat="live"]': makeEl({ textContent: '0' }),
    '[data-stat="review"]': makeEl({ textContent: '0' }),
    '[data-stat="draft"]': makeEl({ textContent: '0' }),
    '[data-release-rows]': makeEl({}),
    '[data-release-empty]': makeEl({}),
    '[data-release-table]': makeEl({ hidden: true }),
    '[data-release-count]': makeEl({}),
    '[data-release-status]': makeEl({ hidden: true }),
  };
  const catalog = loadScript('catalog.js', catalogNodes);
  catalog.PlaigroundCatalog.render({ releases: [], total: 0, analytics: {} });
  assert.strictEqual(catalogNodes['[data-stat="total"]'].textContent, '0');
  assert.strictEqual(catalogNodes['[data-release-empty]'].hidden, false);
  catalog.PlaigroundCatalog.render({
    releases: [{ uuid: '11111111-1111-4111-8111-111111111111', title: 'Night Drive', type: 'single', status: 'draft' }],
    total: 1,
    analytics: { releases: [{ release_uuid: '11111111-1111-4111-8111-111111111111', streams: 12 }] },
  });
  assert.strictEqual(catalogNodes['[data-stat="total"]'].textContent, '1');
  assert.strictEqual(catalogNodes['[data-stat="draft"]'].textContent, '1');
  assert.strictEqual(catalogNodes['[data-release-empty]'].hidden, true);
  assert.strictEqual(catalogNodes['[data-release-table]'].hidden, false);
  assert.strictEqual(catalogNodes['[data-release-rows]'].children[0].children[3].textContent, '0');
  assert.strictEqual(catalogNodes['[data-release-rows]'].children[0].children[4].textContent, '$0.00');

  const extra = catalog.PlaigroundCatalog.accountFallback({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  }, []);
  assert.strictEqual(extra.length, 1);
  assert.strictEqual(extra[0].uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.strictEqual(extra[0].status, 'pending');

  const filtered = catalog.PlaigroundCatalog.applyFilter([
    { uuid: '1', status: 'live' },
    { uuid: '2', status: 'pending' },
    { uuid: '3', status: 'draft' },
  ], 'live');
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].status, 'live');

  catalogNodes['[data-release-empty-title]'] = makeEl({ textContent: 'Your first release goes here.' });
  catalogNodes['[data-release-empty-body]'] = makeEl({});
  catalog.PlaigroundCatalog.setFilter('live');
  catalog.PlaigroundCatalog.render({ releases: [], total: 0, analytics: {} });
  assert.ok(catalogNodes['[data-release-empty-title]'].textContent.indexOf('No live releases') !== -1);
  assert.strictEqual(catalogNodes['[data-release-empty]'].hidden, false);

  const signedInEmpty = {
    '[data-stat="total"]': makeEl({ textContent: '0' }),
    '[data-stat="live"]': makeEl({ textContent: '0' }),
    '[data-stat="review"]': makeEl({ textContent: '0' }),
    '[data-stat="draft"]': makeEl({ textContent: '0' }),
    '[data-release-rows]': makeEl({}),
    '[data-release-empty]': makeEl({}),
    '[data-release-empty-title]': makeEl({ textContent: 'Your first release goes here.' }),
    '[data-release-empty-body]': makeEl({ textContent: 'Nothing here yet. Submit a song and it will show in this catalog when the store has it.' }),
    '[data-release-table]': makeEl({ hidden: true }),
    '[data-release-count]': makeEl({}),
    '[data-release-status]': makeEl({ hidden: true, textContent: '' }),
  };
  const signedInCatalog = {
    URLSearchParams,
    document: {
      querySelector(sel) {
        return signedInEmpty[sel] || null;
      },
      querySelectorAll() {
        return [];
      },
      createElement() {
        return makeEl({});
      },
    },
    fetch(url) {
      if (String(url).indexOf('/api/tonegrid/releases') !== -1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async function () { return { error: 'Sign in required.' }; },
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async function () { return {}; },
      });
    },
    PlaigroundMembership: {
      whenReady(cb) {
        const result = null;
        if (typeof cb === 'function') cb(result);
        return Promise.resolve(result);
      },
      account() { return null; },
      isSignedIn() { return true; },
      hasLiveSession() { return true; },
    },
    window: {},
    location: { search: '' },
  };
  signedInCatalog.window = signedInCatalog;
  vm.runInNewContext(read('catalog.js'), signedInCatalog);

  const cookieOnlyEmpty = {
    '[data-stat="total"]': makeEl({ textContent: '0' }),
    '[data-stat="live"]': makeEl({ textContent: '0' }),
    '[data-stat="review"]': makeEl({ textContent: '0' }),
    '[data-stat="draft"]': makeEl({ textContent: '0' }),
    '[data-release-rows]': makeEl({}),
    '[data-release-empty]': makeEl({}),
    '[data-release-empty-title]': makeEl({ textContent: 'Your first release goes here.' }),
    '[data-release-empty-body]': makeEl({ textContent: 'Nothing here yet. Submit a song and it will show in this catalog when the store has it.' }),
    '[data-release-table]': makeEl({ hidden: true }),
    '[data-release-count]': makeEl({}),
    '[data-release-status]': makeEl({ hidden: true, textContent: '' }),
  };
  const cookieOnlyCatalog = {
    URLSearchParams,
    document: {
      cookie: 'plaiground_signed=1',
      querySelector(sel) {
        return cookieOnlyEmpty[sel] || null;
      },
      querySelectorAll() {
        return [];
      },
      createElement() {
        return makeEl({});
      },
    },
    fetch(url) {
      if (String(url).indexOf('/api/tonegrid/releases') !== -1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async function () { return { error: 'Sign in required.' }; },
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async function () { return {}; },
      });
    },
    PlaigroundMembership: {
      whenReady(cb) {
        if (typeof cb === 'function') cb(null);
        return Promise.resolve(null);
      },
      account() { return null; },
      isSignedIn() { return false; },
      hasLiveSession() { return false; },
    },
    window: {},
    location: { search: '' },
  };
  cookieOnlyCatalog.window = cookieOnlyCatalog;
  vm.runInNewContext(read('catalog.js'), cookieOnlyCatalog);

  assert.ok(read('releases.html').indexOf('data-signed-in-upload') !== -1, 'releases upload links wait for the session');
  assert.ok(read('dashboard.html').indexOf('href="upload.html?type=album" data-album-upload data-signed-in-upload') !== -1
    || /upload\.html\?type=album[^>]*data-signed-in-upload/.test(read('dashboard.html')),
    'dashboard Upload an album waits for the session');

  const splits = loadScript('splits.js', {
    '[data-splits-empty]': makeEl({}),
    '[data-splits-table]': makeEl({ hidden: true }),
    '[data-splits-rows]': makeEl({}),
  });
  assert.strictEqual(splits.PlaigroundSplits.realWorks({
    tonegrid_release_ids: [],
    profile: { releases: [{ title: 'Neon Sermon', tonegrid_status: 'live' }] },
  }).length, 0);
  splits.PlaigroundSplits.render({
    tonegrid_release_ids: [],
    profile: { releases: [{ title: 'Neon Sermon', tonegrid_status: 'live' }] },
  });
  assert.strictEqual(splits.document.querySelector('[data-splits-empty]').hidden, false);

  return new Promise(function (resolve) { setImmediate(resolve); }).then(function () {
    return new Promise(function (resolve) { setImmediate(resolve); });
  }).then(function () {
    const status = signedInEmpty['[data-release-status]'].textContent;
    assert.ok(status.indexOf('Sign in to see') === -1, 'signed-in empty catalog must not say Sign in to see your releases');
    assert.strictEqual(signedInEmpty['[data-release-empty]'].hidden, false);
    assert.ok(signedInEmpty['[data-release-empty-title]'].textContent.indexOf('Your first release goes here') !== -1);
    assert.strictEqual(signedInEmpty['[data-stat="total"]'].textContent, '0');
    const cookieStatus = cookieOnlyEmpty['[data-release-status]'].textContent;
    assert.ok(cookieStatus.indexOf('Sign in to see') === -1, 'plaiground_signed empty catalog must not say Sign in to see your releases');
    assert.strictEqual(cookieOnlyEmpty['[data-release-empty]'].hidden, false);
    assert.ok(cookieOnlyEmpty['[data-release-empty-title]'].textContent.indexOf('Your first release goes here') !== -1);

    const ambiguousEmpty = {
      '[data-stat="total"]': makeEl({ textContent: '0' }),
      '[data-stat="live"]': makeEl({ textContent: '0' }),
      '[data-stat="review"]': makeEl({ textContent: '0' }),
      '[data-stat="draft"]': makeEl({ textContent: '0' }),
      '[data-release-rows]': makeEl({}),
      '[data-release-empty]': makeEl({}),
      '[data-release-empty-title]': makeEl({ textContent: 'Your first release goes here.' }),
      '[data-release-empty-body]': makeEl({ textContent: 'Nothing here yet. Submit a song and it will show in this catalog when the store has it.' }),
      '[data-release-table]': makeEl({ hidden: true }),
      '[data-release-count]': makeEl({}),
      '[data-release-status]': makeEl({ hidden: true, textContent: '' }),
    };
    const ambiguousCatalog = {
      URLSearchParams,
      document: {
        cookie: '',
        querySelector(sel) {
          return ambiguousEmpty[sel] || null;
        },
        querySelectorAll() {
          return [];
        },
        createElement() {
          return makeEl({});
        },
      },
      fetch(url) {
        if (String(url).indexOf('/api/tonegrid/releases') !== -1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async function () { return { error: 'Sign in required.' }; },
          });
        }
        return Promise.resolve({
          ok: false,
          status: 503,
          json: async function () { return { error: 'Accounts are not configured.' }; },
        });
      },
      PlaigroundMembership: {
        whenReady(cb) {
          const result = { ok: false, status: 503, data: {} };
          if (typeof cb === 'function') cb(result);
          return Promise.resolve(result);
        },
        account() { return null; },
        isSignedIn() { return false; },
        hasLiveSession() { return false; },
        isConfirmedLoggedOut() { return false; },
      },
      window: {},
      location: { search: '' },
    };
    ambiguousCatalog.window = ambiguousCatalog;
    vm.runInNewContext(read('catalog.js'), ambiguousCatalog);
    return new Promise(function (resolve) { setImmediate(resolve); }).then(function () {
      return new Promise(function (resolve) { setImmediate(resolve); });
    }).then(function () {
      const ambiguousStatus = ambiguousEmpty['[data-release-status]'].textContent;
      assert.ok(ambiguousStatus.indexOf('Sign in to see') === -1, '/api/me 503 plus store 401 must not say Sign in to see your releases');
      assert.strictEqual(ambiguousEmpty['[data-release-empty]'].hidden, false);
      assert.strictEqual(ambiguousEmpty['[data-stat="total"]'].textContent, '0');
      console.log('catalog-earnings.test.js ok');
    });
  });
}

Promise.resolve(run()).catch((err) => {
  console.error(err);
  process.exit(1);
});
