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
    hidden: Boolean(attrs.hidden),
    textContent: attrs.textContent || '',
    className: attrs.className || '',
    style: {},
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
}

function loadClient() {
  const nodes = {
    '[data-analytics-metrics]': makeEl({}),
    '[data-metric="streams"]': makeEl({ textContent: '0' }),
    '[data-metric="revenue"]': makeEl({ textContent: '$0.00' }),
    '[data-metric-top-release]': makeEl({ hidden: true }),
    '[data-metric="top-release"]': makeEl({ textContent: '—' }),
    '[data-metric-top-release-note]': makeEl({ textContent: 'Top release' }),
    '[data-metric-top-dsp]': makeEl({ hidden: true }),
    '[data-metric="top-dsp"]': makeEl({ textContent: '—' }),
    '[data-analytics-dsps]': makeEl({}),
    '[data-analytics-territories]': makeEl({}),
    '[data-analytics-chart]': makeEl({ hidden: true }),
    '[data-analytics-chart-bars]': makeEl({}),
    '[data-analytics-chart-labels]': makeEl({}),
    '[data-analytics-empty]': makeEl({ hidden: true }),
    '[data-analytics-status]': makeEl({ hidden: true }),
  };
  const created = [];
  const context = {
    document: {
      querySelector(sel) {
        return nodes[sel] || null;
      },
      createElement(tag) {
        const el = makeEl({ className: '' });
        el.tagName = String(tag).toUpperCase();
        created.push(el);
        return el;
      },
    },
    fetch() {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ summary: {}, dsps: [], territories: [], series: [] }),
      });
    },
    window: {},
  };
  context.window = context;
  vm.runInNewContext(read('analytics.js'), context);
  return { api: context.PlaigroundAnalytics, nodes };
}

function run() {
  const html = read('analytics.html');
  [
    '7,412,908',
    '$18,942.60',
    '412,530',
    '$3,412.85',
    'Los Angeles',
    'New York',
    'Lagos',
    'São Paulo',
    '$8,904.22',
    'Monthly listeners',
    'height:88%',
    'height:96%',
  ].forEach(function (needle) {
    assert.strictEqual(html.indexOf(needle), -1, 'analytics.html still has ' + needle);
  });
  assert.ok(html.indexOf('metric-row') !== -1);
  assert.ok(html.indexOf('data-analytics-dsps') !== -1);
  assert.ok(html.indexOf('data-analytics-territories') !== -1);
  assert.ok(html.indexOf('data-analytics-chart') !== -1);
  assert.ok(html.indexOf('data-plan-lock="analytics"') !== -1);
  assert.ok(html.indexOf('data-metric="streams"') !== -1);
  assert.ok(html.indexOf('data-metric="revenue"') !== -1);
  assert.ok(html.indexOf('analytics.js') !== -1);
  assert.ok(html.indexOf('plai-bubble.js') !== -1);
  assert.ok(html.indexOf(['t', 'g', 'k', '_'].join('')) === -1);

  const js = read('analytics.js');
  assert.ok(js.indexOf('/api/tonegrid/analytics') !== -1);
  assert.ok(js.indexOf('No plays yet') !== -1);
  assert.ok(js.indexOf(['t', 'g', 'k', '_'].join('')) === -1);

  const loaded = loadClient();
  loaded.api.render({
    summary: {
      total_streams: 12,
      total_revenue_usd: 1.5,
      top_release: { title: 'Night Drive', streams: 12 },
      top_dsp: 'Spotify',
    },
    dsps: [{ dsp: 'Spotify', streams: 12 }],
    territories: [{ territory: 'US', country_name: 'United States', streams: 12 }],
    series: [],
  });
  assert.strictEqual(loaded.nodes['[data-metric="streams"]'].textContent, '12');
  assert.strictEqual(loaded.nodes['[data-metric="revenue"]'].textContent, '$1.50');
  assert.strictEqual(loaded.nodes['[data-metric="top-release"]'].textContent, 'Night Drive');
  assert.strictEqual(loaded.nodes['[data-metric="top-dsp"]'].textContent, 'Spotify');
  assert.strictEqual(loaded.nodes['[data-metric-top-release]'].hidden, false);
  assert.strictEqual(loaded.nodes['[data-analytics-chart]'].hidden, true);
  assert.strictEqual(loaded.nodes['[data-analytics-dsps]'].children.length, 1);
  assert.strictEqual(loaded.nodes['[data-analytics-dsps]'].children[0].children[2].textContent, '12');
  assert.ok(loaded.nodes['[data-analytics-dsps]'].children[0].children[2].textContent.indexOf('$') === -1);
  assert.strictEqual(loaded.nodes['[data-analytics-territories]'].children[0].children[0].textContent, 'United States');
  assert.strictEqual(loaded.api.isEmptyCatalog({
    summary: { total_streams: 0, total_revenue_usd: 0 },
    dsps: [],
    territories: [],
  }), true);

  console.log('analytics.page.test.js ok');
}

run();
