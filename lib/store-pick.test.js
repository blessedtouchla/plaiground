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
  boxes[1].checked = false;
  boxes[1].listeners.change();
  assert.strictEqual(all.checked, false);
  assert.deepStrictEqual(storePick.selected(root), ['spotify', 'youtube-music']);

  all.checked = true;
  all.listeners.change();
  assert.deepStrictEqual(storePick.selected(root), ['spotify', 'apple-music', 'youtube-music']);
  assert.strictEqual(list.hidden, true);

  console.log('lib/store-pick.test.js ok');
}

run();
