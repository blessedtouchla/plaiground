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
  const node = {
    hidden: Boolean(attrs && attrs.hidden),
    className: '',
    style: {},
    href: '',
    type: '',
    attrs: {},
    children: [],
    colSpan: 0,
    _text: (attrs && attrs.textContent) || '',
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
  Object.defineProperty(node, 'textContent', {
    get() { return this._text; },
    set(value) {
      this._text = String(value == null ? '' : value);
      if (this._text === '') this.children = [];
    },
    configurable: true,
  });
  return node;
}

function findByText(node, text) {
  if (!node) return null;
  if (node.textContent === text) return node;
  const kids = node.children || [];
  for (let i = 0; i < kids.length; i += 1) {
    const found = findByText(kids[i], text);
    if (found) return found;
  }
  return null;
}

function loadScript(file, nodes) {
  const context = {
    document: {
      querySelector(sel) {
        return nodes[sel] || null;
      },
      createElement(tag) {
        const el = makeEl({});
        el.tagName = String(tag || 'DIV').toUpperCase();
        return el;
      },
      body: makeEl({}),
    },
    fetch() {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    },
    localStorage: {
      data: {},
      getItem(key) { return this.data[key] || null; },
      setItem(key, value) { this.data[key] = String(value); },
    },
    window: {},
  };
  context.window = context;
  if (file === 'earnings.js') {
    vm.runInNewContext(read('lib/statement-pdf.js'), context);
  }
  if (file === 'catalog.js') {
    vm.runInNewContext(read('lib/cover-url.js'), context);
    vm.runInNewContext(read('lib/release-status.js'), context);
  }
  if (file === 'splits.js') {
    vm.runInNewContext(read('lib/split-sheets.js'), context);
  }
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

  ['earnings.html', 'releases.html', 'analytics.html', 'dashboard.html', 'song.html', 'payouts.html', 'profile.html', 'artists.html', 'settings.html', 'splits.html', 'splits-empty.html', 'publishing-register.html', 'boosts.html', 'chart-push.html', 'streaming-push.html', 'social-push.html', 'video-collect.html', 'how.html', 'upload.html'].forEach(function (file) {
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
  assert.ok(read('releases.html').indexOf('lib/cover-preview.js') !== -1);
  assert.ok(read('releases.html').indexOf('lib/cover-url.js') !== -1);
  assert.ok(read('releases.html').indexOf('data-edit-art-box') !== -1);
  assert.ok(read('upload.html').indexOf('lib/cover-preview.js') !== -1);
  assert.ok(read('upload.html').indexOf('lib/cover-url.js') !== -1);
  assert.ok(read('dashboard.html').indexOf('lib/cover-url.js') !== -1);
  assert.ok(read('dashboard.html').indexOf('data-first-song') !== -1);
  assert.ok(read('dashboard.html').indexOf('data-has-release') !== -1);
  assert.ok(read('dashboard.html').indexOf('data-next-up') !== -1);
  assert.ok(read('dashboard.html').indexOf('Releases pending') !== -1);
  assert.ok(read('dashboard.html').indexOf('Artist profiles') !== -1);
  assert.ok(/data-latest-edit href="releases.html">Edit release<\/a>/.test(read('library.html')), 'Library Edit release entry is the catalog list');
  assert.ok(read('dashboard.html').indexOf('PRO •') === -1, 'publishing badge must not say Pro-only');
  assert.ok(read('dashboard.html').indexOf('Upgrade to Pro only') === -1);
  assert.ok(read('dashboard.html').indexOf('Your song is in the catalog') === -1, 'Overview is not a second Releases page');
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
  assert.ok(read('publishing-register.html').indexOf('data-publishing-release') !== -1);
  assert.ok(!/>Your release</.test(read('publishing-register.html')), 'publishing register must not hardcode Your release');
  assert.ok(read('publishing-confirm.html').indexOf('data-require-publishing="true"') !== -1, 'publishing confirm stays Creator/Pro');
  assert.ok(read('publishing-confirm.html').indexOf('data-require-paid') === -1, 'publishing confirm must not use the public paid dump');
  assert.ok(!/Neon Sermon/.test(read('publishing-confirm.html')), 'publishing confirm must not hardcode Neon Sermon');
  assert.ok(read('how.html').indexOf('data-signed-in-upload') !== -1);
  assert.ok(read('earnings.html').indexOf('Upgrade to Pro only') === -1);
  assert.ok(read('payouts.html').indexOf('Upgrade to Pro only') === -1);
  assert.ok(read('earnings.html').indexOf('Hi John') === -1);
  assert.ok(read('payouts.html').indexOf('Hi John') === -1);
  assert.ok(read('settings.html').indexOf('Hi John') === -1);
  assert.ok(read('settings.html').indexOf('John ham') === -1);
  assert.ok(read('settings.html').indexOf('>VV<') === -1);
  assert.ok(read('settings.html').indexOf('data-account-username') !== -1);
  assert.ok(read('settings.html').indexOf('data-account-artist') === -1);

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
  }, { artist: 'Fuvtu' }), true, 'zero totals are still a real PDF statement');
  const zeroPdf = earn.PlaigroundEarnings.statementPdf({
    balance: { available_usd: 0, pending_usd: 0 },
    statements: [],
    breakdown: [],
  }, { artist: 'Fuvtu' });
  assert.ok(zeroPdf.indexOf('%PDF') === 0);
  assert.ok(zeroPdf.indexOf('plaiground-statement') === -1);
  assert.ok(zeroPdf.indexOf('Fuvtu') !== -1);
  assert.ok(zeroPdf.indexOf('Available') !== -1);
  assert.ok(zeroPdf.indexOf('Pending') !== -1);
  assert.ok(zeroPdf.indexOf('$0.00') !== -1);
  assert.ok(!/No statement yet/.test(zeroPdf));
  assert.ok(!/7,412,908|Neon Sermon|Victoria Reyes/.test(zeroPdf));
  const unnamed = earn.PlaigroundEarnings.statementPdf({
    balance: { available_usd: 0, pending_usd: 0 },
    statements: [],
    breakdown: [],
  }, null);
  assert.ok(unnamed.indexOf('$0.00') !== -1);
  assert.ok(unnamed.indexOf('Account: ?') === -1);
  assert.ok(unnamed.indexOf('Account:') === -1, 'omit account when there is no real name');
  assert.strictEqual(earn.PlaigroundStatementPdf.lastDownload().filename, 'plaiground-statement.pdf');
  assert.ok(read('earnings.html').indexOf('lib/statement-pdf.js') !== -1);
  assert.ok(read('earnings.js').indexOf('statementCsv') === -1, 'earnings download is PDF, not CSV');
  assert.strictEqual(earnNodes['[data-earn="available"]'].textContent, '$1.50');

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
    '[data-release-tiles]': makeEl({}),
  };
  const catalog = loadScript('catalog.js', catalogNodes);
  catalog.PlaigroundCatalog.render({ releases: [], total: 0, analytics: {} });
  assert.strictEqual(catalogNodes['[data-stat="total"]'].textContent, '0');
  assert.strictEqual(catalogNodes['[data-release-empty]'].hidden, false);
  catalog.PlaigroundCatalog.render({
    releases: [{ uuid: '11111111-1111-4111-8111-111111111111', title: 'Night Drive', type: 'single', status: 'draft', artwork_url: 'https://cdn.example/night.jpg' }],
    total: 1,
    analytics: { releases: [{ release_uuid: '11111111-1111-4111-8111-111111111111', streams: 12 }] },
  });
  assert.strictEqual(catalogNodes['[data-stat="total"]'].textContent, '1');
  assert.strictEqual(catalogNodes['[data-stat="draft"]'].textContent, '1');
  assert.strictEqual(catalogNodes['[data-release-empty]'].hidden, true);
  assert.strictEqual(catalogNodes['[data-release-table]'].hidden, false);
  const firstRow = catalogNodes['[data-release-rows]'].children[0];
  assert.strictEqual(firstRow.children.length, 6, 'Release, Edit, Status, Splits, Streams, Earnings');
  assert.strictEqual(firstRow.children[1].className, 'release-edit-col', 'Edit release sits in its own aligned column');
  assert.strictEqual(firstRow.children[4].textContent, '0');
  assert.strictEqual(firstRow.children[5].textContent, '$0.00');
  assert.ok(catalogNodes['[data-release-tiles]'].children[0].children[0].style.backgroundImage.indexOf('night.jpg') !== -1, 'Releases tiles paint catalog cover art');
  catalog.PlaigroundCatalog.render({
    releases: [{ uuid: '11111111-1111-4111-8111-111111111111', title: 'Night Drive', type: 'single', status: 'draft' }],
    total: 1,
    analytics: {},
  });
  assert.strictEqual(catalogNodes['[data-release-tiles]'].children[0].children[0].style.backgroundImage || '', '', 'Releases tiles keep the empty placeholder when there is no cover');
  const catalogEdit = findByText(catalogNodes['[data-release-rows]'].children[0].children[1], 'Edit release');
  assert.ok(catalogEdit, 'catalog cards must include Edit release');
  assert.strictEqual(catalogEdit.tagName, 'A');
  assert.ok(String(catalogEdit.href).indexOf('song.html?id=11111111-1111-4111-8111-111111111111') !== -1);
  assert.ok(String(catalogEdit.href).indexOf('edit=1') !== -1);
  assert.ok(!findByText(catalogNodes['[data-release-rows]'].children[0].children[0], 'Edit release'), 'Edit release is not jammed after the title');
  assert.ok(read('releases.html').includes('href="releases.html">Releases</a>'), 'sidebar Releases stays on the catalog list');
  assert.ok(!/side-nav[\s\S]{0,400}href="song\.html/.test(read('releases.html')), 'sidebar Releases must not point at a leftover song');
  assert.ok(!/side-nav[\s\S]{0,400}href="song\.html/.test(read('dashboard.html')), 'Creator menu Releases must not point at a leftover song');
  assert.ok(read('catalog.js').includes("editPanel.hidden = true"), 'Releases must not auto-open Edit release');
  assert.ok(read('catalog.js').includes("editCell.className = 'release-edit-col'"), 'Edit release is built as its own table column');
  assert.ok(!read('catalog.js').includes('copy.appendChild(edit)'), 'Edit release is not jammed after the title');
  assert.ok(read('catalog.js').includes('function pickedCatalogValue'), 'catalog edit must read typeahead genre/language');
  assert.ok(read('song.js').includes("location.href = 'releases.html'"), 'song.html without an id returns to the list');
  assert.ok(read('song.js').includes("return next ? ('song.html?id=' + encodeURIComponent(next) + '&edit=1') : 'releases.html'"), 'bare Edit href goes to the list, not latest');
  assert.strictEqual(catalogNodes['[data-release-rows]'].children.length, 1, 'one release still shows the list row');
  assert.ok(catalogNodes['[data-release-table]'].hidden === false, 'one release must not skip the catalog list');

  catalog.PlaigroundCatalog.render({
    releases: [{ title: 'No store id yet', type: 'single', status: 'draft' }],
    total: 1,
    analytics: {},
  });
  const catalogRows = catalogNodes['[data-release-rows]'].children;
  const lastRow = catalogRows[catalogRows.length - 1];
  assert.strictEqual(lastRow.children[1].className, 'release-edit-col');
  const missingEdit = findByText(lastRow.children[1], 'Edit release');
  assert.ok(missingEdit, 'catalog still shows Edit when the store id is missing');
  assert.strictEqual(missingEdit.tagName, 'BUTTON');
  assert.strictEqual(missingEdit.getAttribute('data-edit-missing'), '');

  const extra = catalog.PlaigroundCatalog.accountFallback({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  }, []);
  assert.strictEqual(extra.length, 1);
  assert.strictEqual(extra[0].uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.strictEqual(extra[0].status, 'pending');

  catalog.localStorage.data['plaiground.store.draft'] = JSON.stringify({
    release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'mexeu',
    genre: 'Electronic',
  });
  const overlaid = catalog.PlaigroundCatalog.overlayPendingCatalog([
    { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Old Title', status: 'pending' },
    { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Live One', status: 'live' },
  ], { profile: { releases: [] } });
  assert.strictEqual(overlaid[0].title, 'mexeu', 'pending catalog title follows the Plaiground edit');
  assert.strictEqual(overlaid[1].title, 'Live One', 'live catalog title is not overwritten by a draft');

  const filtered = catalog.PlaigroundCatalog.applyFilter([
    { uuid: '1', status: 'live' },
    { uuid: '2', status: 'pending' },
    { uuid: '3', status: 'draft' },
  ], 'live');
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].status, 'live');
  const allShown = catalog.PlaigroundCatalog.applyFilter([
    { uuid: '1', status: 'live' },
    { uuid: '2', status: 'pending' },
    { uuid: '3', status: 'needs-fix' },
    { uuid: '4', status: 'mystery' },
  ], 'all');
  assert.strictEqual(allShown.length, 4, 'default Releases list includes pending and live');
  assert.ok(allShown.some(function (row) { return row.status === 'pending'; }), 'pending stays in the All list');
  assert.ok(allShown.some(function (row) { return row.status === 'live'; }), 'live stays in the All list');

  catalog.PlaigroundCatalog.setFilter('all');
  catalog.PlaigroundCatalog.render({
    releases: [
      { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Waiting', type: 'single', status: 'pending' },
      { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Night Drive', type: 'single', status: 'live' },
      { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fix Me', type: 'single', status: 'needs-fix', rejection_reason: 'Cover art is too small.' },
      { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'Maybe', type: 'single', status: 'mystery' },
    ],
    total: 4,
    analytics: {},
  });
  assert.strictEqual(catalogNodes['[data-stat="total"]'].textContent, '4');
  assert.strictEqual(catalogNodes['[data-release-rows]'].children.length, 4, 'Releases table is not live-only');
  const pendingRow = catalogNodes['[data-release-rows]'].children[0];
  const liveRow = catalogNodes['[data-release-rows]'].children[1];
  const fixRow = catalogNodes['[data-release-rows]'].children[2];
  const unknownRow = catalogNodes['[data-release-rows]'].children[3];
  assert.strictEqual(pendingRow.children[2].children[1].textContent, 'Needs fix');
  assert.strictEqual(liveRow.children[2].children[1].textContent, 'Live');
  assert.strictEqual(fixRow.children[2].children[1].textContent, 'Needs fix');
  assert.strictEqual(fixRow.children[2].children[2].textContent, 'Cover art is too small.\n' + QC_LINES);
  assert.ok(findByText(pendingRow.children[0], 'Needs fix'), 'phone inline status keeps Needs fix on the row');
  assert.ok(findByText(pendingRow.children[0], QC_LINES), 'phone inline status keeps the six store lines');
  assert.ok(findByText(fixRow.children[0], 'Needs fix'), 'phone inline status keeps Needs fix on the row');
  assert.ok(findByText(fixRow.children[0], 'Cover art is too small.\n' + QC_LINES), 'phone inline status keeps the real error on the row');
  assert.ok(String(fixRow.children[2].className).indexOf('has-alert') !== -1);
  assert.ok(String(pendingRow.children[2].className).indexOf('has-alert') !== -1);
  assert.strictEqual(unknownRow.children[2].children[1].textContent, 'Pending');
  assert.notStrictEqual(unknownRow.children[2].children[1].textContent, 'Live', 'unknown status must not invent Live');
  assert.ok(!findByText(unknownRow, 'Cover art is too small.'), 'no fake error on an unknown row');
  assert.strictEqual(catalogNodes['[data-release-tiles]'].children.length, 4, 'Overview tiles on the shared list include pending');
  assert.strictEqual(catalogNodes['[data-release-tiles]'].children[2].children[3].textContent, 'Cover art is too small.\n' + QC_LINES);
  assert.strictEqual(catalogNodes['[data-release-tiles]'].children[0].children[2].textContent, 'Needs fix');
  assert.strictEqual(catalogNodes['[data-release-tiles]'].children[0].children[3].textContent, QC_LINES);

  assert.ok(read('releases.html').includes('href="problem.html"'), 'Have a problem? stays the typed report page');
  assert.ok(read('catalog.js').includes("&& !$('[data-release-tiles]')"), 'Overview shares the catalog list');
  assert.ok(read('site.css').includes('.release-inline-status'), 'phone Releases keeps status under the title so it stays readable');
  assert.ok(read('site.css').includes('.release-tile-alert'), 'on-card store errors use existing chrome');

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
  assert.ok(read('releases.html').indexOf('href="upload.html?type=album" data-album-upload data-signed-in-upload') !== -1
    || /upload\.html\?type=album[^>]*data-signed-in-upload/.test(read('releases.html')),
    'Releases Upload an album waits for the session');
  assert.ok(read('dashboard.html').indexOf('upload.html?type=album') === -1, 'Overview must not keep Upload an album');

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
  splits.PlaigroundSplits.render({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{
      tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      legal_first: 'Ada',
      legal_last: 'Night',
      solo_owned_100: true,
    }] },
  });
  assert.strictEqual(splits.document.querySelector('[data-splits-empty]').hidden, true);
  assert.strictEqual(splits.document.querySelector('[data-splits-rows]').children[0].children[1].textContent, 'Ada Night');
  assert.strictEqual(splits.document.querySelector('[data-splits-rows]').children[0].children[2].textContent, 'self-attested, no sheet required');

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
