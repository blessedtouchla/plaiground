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
    classList: {
      tokens: Object.create(null),
      toggle(name, force) {
        if (force) this.tokens[name] = true;
        else delete this.tokens[name];
      },
      contains(name) { return Boolean(this.tokens[name]); },
    },
    querySelector(sel) {
      if (sel === '[data-analytics-lock]' && this.lock) return this.lock;
      return null;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
}

function loadClient(opts) {
  opts = opts || {};
  const plan = opts.plan || 'creator';
  const lockA = makeEl({ hidden: true });
  const lockB = makeEl({ hidden: true });
  const lockC = makeEl({ hidden: true });
  const dspPanel = makeEl({});
  dspPanel.lock = lockA;
  const locPanel = makeEl({});
  locPanel.lock = lockB;
  const chartPanel = makeEl({ hidden: true });
  chartPanel.lock = lockC;
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
    '[data-analytics-chart]': chartPanel,
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
      querySelectorAll(sel) {
        if (sel === '[data-analytics-lock]') return [lockA, lockB, lockC];
        if (sel === '.panel') return [dspPanel, locPanel, chartPanel];
        return [];
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
    PlaigroundMembership: {
      currentPlan() { return plan; },
      hasPaidAccess() { return plan === 'creator' || plan === 'pro'; },
      applyPlanCopy() {},
    },
  };
  context.window = context;
  vm.runInNewContext(read('analytics.js'), context);
  return { api: context.PlaigroundAnalytics, nodes, locks: [lockA, lockB, lockC], panels: [dspPanel, locPanel, chartPanel] };
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
    '128,412',
    '$486.20',
    '74,288',
    'Neon Sermon',
  ].forEach(function (needle) {
    assert.strictEqual(html.indexOf(needle), -1, 'analytics.html still has ' + needle);
  });
  assert.ok(html.indexOf('data-require-membership="true"') !== -1);
  assert.ok(html.indexOf('data-require-paid') === -1, 'analytics must not bounce Basic to Pick a plan');
  assert.ok(html.indexOf('Locked on Basic') !== -1);
  assert.ok(html.indexOf('metric-row') !== -1);
  assert.ok(html.indexOf('data-analytics-dsps') !== -1);
  assert.ok(html.indexOf('data-analytics-territories') !== -1);
  assert.ok(html.indexOf('data-analytics-chart') !== -1);
  assert.ok(html.indexOf('analytics.js') !== -1);
  assert.ok(html.indexOf('plai-bubble.js') !== -1);
  assert.ok(html.indexOf(['t', 'g', 'k', '_'].join('')) === -1);

  const js = read('analytics.js');
  assert.ok(js.indexOf('/api/tonegrid/analytics') !== -1);
  assert.ok(js.indexOf('No plays yet') !== -1);
  assert.ok(js.indexOf(['t', 'g', 'k', '_'].join('')) === -1);

  const loaded = loadClient({ plan: 'creator' });
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

  const basic = loadClient({ plan: 'basic' });
  basic.api.render({
    summary: {
      total_streams: 0,
      total_revenue_usd: 0,
      top_release: { title: 'Night Drive', streams: 12 },
      top_dsp: 'Spotify',
    },
    dsps: [{ dsp: 'Spotify', streams: 12 }],
    territories: [{ territory: 'US', country_name: 'United States', streams: 12 }],
    series: [{ label: 'Aug', streams: 12 }],
  });
  assert.strictEqual(basic.nodes['[data-metric="streams"]'].textContent, '0');
  assert.strictEqual(basic.nodes['[data-metric="revenue"]'].textContent, '$0.00');
  assert.strictEqual(basic.nodes['[data-metric-top-release]'].hidden, true);
  assert.strictEqual(basic.nodes['[data-metric-top-dsp]'].hidden, true);
  assert.strictEqual(basic.nodes['[data-analytics-dsps]'].children[0].className, 'hint');
  assert.strictEqual(basic.nodes['[data-analytics-chart]'].hidden, false, 'advanced chart stays visible when locked');
  basic.locks.forEach(function (el) {
    assert.strictEqual(el.hidden, false, 'Basic sees locked advanced covers');
  });
  basic.panels.forEach(function (el) {
    assert.ok(el.classList.contains('is-locked'));
  });

  basic.api.render({
    summary: { total_streams: 4, total_revenue_usd: 0.2 },
    dsps: [{ dsp: 'Spotify', streams: 4 }],
    territories: [{ country_name: 'United States', streams: 4 }],
    series: [],
  });
  assert.strictEqual(basic.nodes['[data-metric="streams"]'].textContent, '4');
  assert.strictEqual(basic.nodes['[data-metric="revenue"]'].textContent, '$0.20');
  assert.strictEqual(basic.nodes['[data-analytics-dsps]'].children[0].className, 'hint');
  assert.strictEqual(basic.nodes['[data-metric-top-dsp]'].hidden, true);

  console.log('analytics.page.test.js ok');
}

run();
