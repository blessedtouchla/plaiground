'use strict';

const assert = require('assert');
const storePick = require('./store-pick');

function el(attrs) {
  const node = {
    tagName: (attrs && attrs.tag) || 'DIV',
    type: (attrs && attrs.type) || '',
    className: '',
    id: '',
    value: attrs && attrs.value != null ? attrs.value : '',
    textContent: '',
    checked: Boolean(attrs && attrs.checked),
    hidden: false,
    children: [],
    style: {},
    attrs: Object.assign({}, (attrs && attrs.attrs) || {}),
    listeners: {},
    classList: {
      tokens: Object.create(null),
      add(name) { this.tokens[name] = true; },
      remove(name) { delete this.tokens[name]; },
      toggle(name, force) {
        if (force === false) delete this.tokens[name];
        else if (force) this.tokens[name] = true;
        else if (this.tokens[name]) delete this.tokens[name];
        else this.tokens[name] = true;
      },
      contains(name) { return Boolean(this.tokens[name]); },
    },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    appendChild(child) { this.children.push(child); if (child) child.parentNode = node; return child; },
    querySelector(sel) {
      const all = node.querySelectorAll(sel);
      return all[0] || null;
    },
    querySelectorAll(sel) {
      const out = [];
      function match(item) {
        if (!item) return;
        if (sel === 'input[type="checkbox"]' && item.type === 'checkbox') out.push(item);
        if (sel === '[data-store-all]' && item.attrs && item.attrs['data-store-all'] != null) out.push(item);
        if (sel === '[data-store-customize]' && item.attrs && item.attrs['data-store-customize'] != null) out.push(item);
        if (sel === '[data-store-summary]' && item.attrs && item.attrs['data-store-summary'] != null) out.push(item);
        if (sel === '[data-store-list]' && item.attrs && item.attrs['data-store-list'] != null) out.push(item);
        if (sel === '[data-edit-stores]' && item.attrs && item.attrs['data-edit-stores'] != null) out.push(item);
        if (sel === '.toggle' && String(item.className).indexOf('toggle') === 0) out.push(item);
        (item.children || []).forEach(match);
      }
      (node.children || []).forEach(match);
      if (sel === '[data-store-all]' && node.attrs && node.attrs['data-store-all'] != null) out.push(node);
      return out;
    },
  };
  if (attrs && attrs.attrs) Object.keys(attrs.attrs).forEach((key) => node.setAttribute(key, attrs.attrs[key]));
  return node;
}

function run() {
  const root = el();
  const all = el({ type: 'checkbox', checked: true, attrs: { 'data-store-all': '' } });
  const customize = el({ attrs: { 'data-store-customize': '' } });
  customize.textContent = 'Customize';
  const summary = el({ attrs: { 'data-store-summary': '' } });
  const list = el({ attrs: { 'data-store-list': '', 'data-edit-stores': '' } });
  list.hidden = true;
  root.appendChild(all);
  root.appendChild(customize);
  root.appendChild(summary);
  root.appendChild(list);

  const doc = {
    createElement(tag) {
      return el({ tag: tag });
    },
    createTextNode(text) {
      return el({ tag: 'TEXT' });
    },
  };

  const api = storePick.bind(root, {
    document: doc,
    stores: [
      { slug: 'spotify', name: 'Spotify' },
      { slug: 'apple-music', name: 'Apple Music' },
      { slug: 'youtube-music', name: 'YouTube Music' },
    ],
    selected: null,
  });
  assert.ok(api);
  assert.strictEqual(list.hidden, true, 'list stays collapsed by default');
  assert.strictEqual(customize.textContent, 'Customize');
  assert.ok(all.checked, 'pre-select all defaults on');
  assert.deepStrictEqual(storePick.selected(root), ['spotify', 'apple-music', 'youtube-music']);
  assert.ok(/All 3 stores/.test(summary.textContent));

  customize.listeners.click({ preventDefault() {} });
  assert.strictEqual(list.hidden, false, 'Customize opens the checklist');
  assert.strictEqual(customize.textContent, 'Hide stores');

  const boxes = list.querySelectorAll('input[type="checkbox"]');
  assert.strictEqual(boxes.length, 3);
  boxes.forEach(function (box) {
    assert.strictEqual(box.className, 'store-pick-box');
    assert.notStrictEqual(box.className, 'toggle-input');
  });
  assert.strictEqual(list.children[0].className, 'store-pick-item');
  const nameChip = list.children[0].children.find(function (child) {
    return child && child.className === 'store-pick-name';
  });
  assert.ok(nameChip, 'each store chip must put the name beside the checkbox');
  assert.strictEqual(nameChip.textContent, 'Spotify');
  boxes[1].checked = false;
  boxes[1].listeners.change();
  assert.strictEqual(all.checked, false);
  assert.deepStrictEqual(storePick.selected(root), ['spotify', 'youtube-music']);

  all.checked = true;
  all.listeners.change();
  assert.deepStrictEqual(storePick.selected(root), ['spotify', 'apple-music', 'youtube-music']);
  assert.strictEqual(list.hidden, true);
  assert.strictEqual(summary.textContent, 'All 3 stores will receive this release.');

  assert.strictEqual(storePick.formatReviewSummary(55, 55, true), 'All 55 stores will receive this release.');
  assert.strictEqual(storePick.formatSubmitted(55, 55, true), 'All 55 stores');
  assert.strictEqual(storePick.formatReviewSummary(40, 55, false), '40 of 55 stores selected.');
  assert.strictEqual(storePick.formatSubmitted(40, 55, false), '40 of 55 stores');
  assert.strictEqual(storePick.formatSubmitted(164, 163, true), 'All 163 stores');
  assert.strictEqual(storePick.formatSubmitted(164, 163, false), 'All 163 stores');
  assert.ok(storePick.formatSubmitted(164, 163, true).indexOf('164 of 163') === -1);
  assert.ok(storePick.formatReviewSummary(164, 163, true).indexOf('164 of 163') === -1);

  const live = [];
  for (let i = 0; i < 55; i += 1) live.push({ slug: 'store-' + i, name: 'Store ' + i });
  const liveRoot = el();
  const liveAll = el({ type: 'checkbox', checked: true, attrs: { 'data-store-all': '' } });
  const liveCustomize = el({ attrs: { 'data-store-customize': '' } });
  const liveSummary = el({ attrs: { 'data-store-summary': '' } });
  const liveList = el({ attrs: { 'data-store-list': '', 'data-edit-stores': '' } });
  liveList.hidden = true;
  liveRoot.appendChild(liveAll);
  liveRoot.appendChild(liveCustomize);
  liveRoot.appendChild(liveSummary);
  liveRoot.appendChild(liveList);
  let liveChange = null;
  storePick.bind(liveRoot, {
    document: doc,
    stores: live,
    selected: null,
    onChange: function (slugs, allOn, total) {
      liveChange = { slugs: slugs, allOn: allOn, total: total };
    },
  });
  assert.strictEqual(liveSummary.textContent, 'All 55 stores will receive this release.');
  assert.ok(liveChange);
  assert.strictEqual(liveChange.total, 55);
  assert.strictEqual(liveChange.slugs.length, 55);
  assert.strictEqual(liveChange.allOn, true);
  assert.strictEqual(storePick.formatSubmitted(liveChange.slugs.length, liveChange.total, liveChange.allOn), 'All 55 stores');

  const liveBoxes = liveList.querySelectorAll('input[type="checkbox"]');
  liveBoxes[0].checked = false;
  liveBoxes[0].listeners.change();
  assert.strictEqual(liveSummary.textContent, '54 of 55 stores selected.');
  assert.strictEqual(storePick.formatSubmitted(liveChange.slugs.length, liveChange.total, liveChange.allOn), '54 of 55 stores');

  const faq = storePick.formatFaqStores(live);
  assert.strictEqual(faq.count, 55);
  assert.strictEqual(faq.names.length, 55);
  assert.strictEqual(faq.sentence, 'We deliver to 55 stores:');
  assert.ok(faq.names.indexOf('Store 0') !== -1);
  const faqRoot = el();
  const faqCount = el({ attrs: { 'data-faq-store-count': '' } });
  const faqList = el({ attrs: { 'data-faq-store-list': '' } });
  faqRoot.appendChild(faqCount);
  faqRoot.appendChild(faqList);
  faqRoot.querySelector = function (sel) {
    if (sel === '[data-faq-store-count]') return faqCount;
    if (sel === '[data-faq-store-list]') return faqList;
    return null;
  };
  faqRoot.ownerDocument = doc;
  storePick.paintFaqStores(faqRoot, live);
  assert.strictEqual(faqCount.textContent, 'We deliver to 55 stores:');
  assert.strictEqual(faqList.children.length, 55);

  console.log('lib/store-pick.test.js ok');
}

run();
