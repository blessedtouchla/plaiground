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

  ['earnings.html', 'releases.html', 'analytics.html', 'dashboard.html', 'song.html', 'payouts.html', 'profile.html', 'artists.html'].forEach(function (file) {
    const html = read(file);
    forbidden.forEach(function (needle) {
      assert.strictEqual(html.indexOf(needle), -1, file + ' still has ' + needle);
    });
    assert.ok(html.indexOf('plai-bubble.js') !== -1, file + ' dropped PLAI');
    assert.ok(!html.includes(['t', 'g', 'k', '_'].join('')), file + ' has a key prefix');
  });

  assert.ok(read('earnings.html').indexOf('No royalties yet.') !== -1);
  assert.ok(read('releases.html').indexOf('Nothing here yet') !== -1);
  assert.ok(read('dashboard.html').indexOf('Your release is in the catalog') !== -1);
  assert.ok(read('dashboard.html').indexOf('data-first-song') !== -1);
  assert.ok(read('dashboard.html').indexOf('data-has-release') !== -1);
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
  assert.ok(read('earnings.html').indexOf('$19.99') === -1);
  assert.ok(read('dashboard.html').indexOf('On Pro') !== -1);

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

  console.log('catalog-earnings.test.js ok');
}

run();
