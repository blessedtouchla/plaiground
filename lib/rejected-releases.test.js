'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const status = require('./release-status');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
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

function loadCatalog(nodes) {
  const context = {
    document: {
      querySelector(sel) { return nodes[sel] || null; },
      querySelectorAll() { return []; },
      createElement(tag) {
        const el = makeEl({});
        el.tagName = String(tag || 'DIV').toUpperCase();
        return el;
      },
      body: makeEl({}),
    },
    fetch() { return Promise.resolve({ ok: true, status: 200, json: async () => ({}) }); },
    localStorage: { data: {}, getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { data: {}, getItem() { return null; }, setItem() {}, removeItem() {} },
    window: {},
    URLSearchParams,
    location: { search: '' },
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(read('lib/cover-url.js'), context);
  vm.runInNewContext(read('lib/release-status.js'), context);
  vm.runInNewContext(read('lib/release-credits.js'), context);
  vm.runInNewContext(read('catalog.js'), context);
  return context;
}

function run() {
  assert.strictEqual(status.resubmitHref(), 'upload.html');
  assert.ok(!/song\.html|edit=1/i.test(status.resubmitHref()));
  const split = status.splitRejected([
    { uuid: 'd412cc82-7acb-44ef-9c04-f92e4f2bcda6', title: 'GOLDEN ERA', status: 'rejected', rejection_reason: 'Audio quality issues' },
    { uuid: '6629b532-2e78-4be6-84eb-e4dfa9ac33e5', title: 'Metete en el groove', status: 'rejected', rejection_reason: 'Invalid cover art' },
    { uuid: '37524790-6cbf-4726-a386-384ab959731a', title: 'The night sky', status: 'rejected', rejection_reason: 'Incomplete metadata' },
    { uuid: 'e41e056b-b316-4de7-ba0f-037f49629377', title: 'Lightning', status: 'draft' },
    { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'My heart', status: 'draft' },
    { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'I Set the Tone', status: 'draft' },
    { uuid: '7a928125-b12e-4609-bd37-26ce0edf819e', title: 'Rainbow Road', status: 'live' },
    { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'Unicorn', status: 'draft' },
    { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'FUEGO', status: 'draft' },
    { uuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff', title: 'Take it Back with Grace', status: 'draft' },
  ]);
  assert.deepStrictEqual(split.rejected.map(function (row) { return row.title; }), [
    'GOLDEN ERA',
    'Metete en el groove',
    'The night sky',
    'Lightning',
  ]);
  assert.ok(split.main.every(function (row) {
    return ['My heart', 'I Set the Tone', 'Rainbow Road', 'Unicorn', 'FUEGO', 'Take it Back with Grace'].indexOf(row.title) !== -1;
  }));

  const nodes = {
    '[data-stat="total"]': makeEl({}),
    '[data-stat="live"]': makeEl({}),
    '[data-stat="review"]': makeEl({}),
    '[data-stat="draft"]': makeEl({}),
    '[data-release-rows]': makeEl({}),
    '[data-release-empty]': makeEl({}),
    '[data-release-table]': makeEl({ hidden: true }),
    '[data-release-count]': makeEl({}),
    '[data-release-status]': makeEl({ hidden: true }),
    '[data-rejected-section]': makeEl({ hidden: true }),
    '[data-rejected-rows]': makeEl({}),
  };
  const catalog = loadCatalog(nodes);
  catalog.PlaigroundCatalog.render({
    releases: [
      { uuid: 'd412cc82-7acb-44ef-9c04-f92e4f2bcda6', title: 'GOLDEN ERA', type: 'single', status: 'rejected', rejection_reason: 'Audio quality issues' },
      { uuid: '6629b532-2e78-4be6-84eb-e4dfa9ac33e5', title: 'Metete en el groove', type: 'single', status: 'rejected', rejection_reason: 'Invalid cover art' },
      { uuid: '37524790-6cbf-4726-a386-384ab959731a', title: 'The night sky', type: 'single', status: 'rejected', rejection_reason: 'Incomplete metadata' },
      { uuid: 'e41e056b-b316-4de7-ba0f-037f49629377', title: 'Lightning', type: 'single', status: 'draft' },
      { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'My heart', type: 'single', status: 'draft' },
    ],
    total: 5,
    analytics: {},
  });
  assert.strictEqual(nodes['[data-rejected-section]'].hidden, false);
  assert.strictEqual(nodes['[data-rejected-rows]'].children.length, 4);
  ['GOLDEN ERA', 'Metete en el groove', 'The night sky', 'Lightning'].forEach(function (title) {
    assert.ok(findByText(nodes['[data-rejected-rows]'], title), title + ' lands in Rejected');
  });
  assert.ok(!findByText(nodes['[data-rejected-rows]'], 'My heart'));
  assert.ok(!findByText(nodes['[data-release-rows]'], 'My heart'), 'plain drafts stay off the list after #262');
  assert.ok(!findByText(nodes['[data-release-rows]'], 'Lightning'));
  assert.ok(!status.isUnsubmittedDraft({
    uuid: 'e41e056b-b316-4de7-ba0f-037f49629377',
    title: 'Lightning',
    status: 'draft',
  }));
  nodes['[data-rejected-rows]'].children.forEach(function (row) {
    const btn = findByText(row, 'Resubmit');
    assert.ok(btn);
    assert.strictEqual(btn.href, 'upload.html');
    assert.ok(!/song\.html|edit=1/i.test(btn.href));
    assert.ok(!findByText(row, 'Edit release'));
  });

  const html = read('releases.html');
  assert.ok(html.includes('<h3>Rejected</h3>'));
  assert.ok(html.includes('lib/release-status.js?v=20260910r3'));
  assert.ok(html.includes('catalog.js?v=20260912a1'));
  assert.ok(!/DistroKid|ToneGrid|InterSpace/i.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, '')));
  assert.ok(!/Save draft/.test(html));
  console.log('lib/rejected-releases.test.js ok');
}

run();
