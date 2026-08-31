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
  assert.strictEqual(faq.sentence, 'We deliver to 150 platforms.');
  assert.ok(faq.sentence.indexOf('55') === -1, 'FAQ sentence must not display the live store count');
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
  assert.strictEqual(faqCount.textContent, 'We deliver to 150 platforms.');
  assert.strictEqual(faqList.children.length, 55);

  const fallback = storePick.formatFaqStores();
  assert.strictEqual(fallback.count, 55, 'FAQ fallback matches the live 55 catalog');
  assert.strictEqual(storePick.FAQ_FALLBACK_STORES.length, 55);
  const fallbackNames = fallback.names.slice().sort();
  assert.ok(fallbackNames.indexOf('Spotify') !== -1);
  assert.ok(fallbackNames.indexOf('KKBox') !== -1);
  assert.ok(fallbackNames.indexOf('JOOX') !== -1);
  assert.ok(fallbackNames.indexOf('YouTube Content ID') !== -1);
  assert.ok(fallbackNames.indexOf('Instagram/Facebook') !== -1);
  assert.ok(fallbackNames.indexOf('TIDAL Video') !== -1);
  assert.strictEqual(fallback.groups.length, 3);
  assert.deepStrictEqual(fallback.groups.map(function (g) { return g.title; }), [
    'Streaming',
    'Social / video',
    'Rights / tools',
  ]);
  assert.strictEqual(fallback.groups[0].names.length, 33);
  assert.strictEqual(fallback.groups[1].names.length, 10);
  assert.strictEqual(fallback.groups[2].names.length, 12);
  assert.strictEqual(fallback.groups[2].note, 'Still delivered, not a listening app.');
  const groupedUnknown = storePick.groupFaqStores(live);
  assert.strictEqual(groupedUnknown[groupedUnknown.length - 1].title, 'Also delivered');
  assert.strictEqual(groupedUnknown[groupedUnknown.length - 1].names.length, 55);

  const groupRoot = el();
  const groupCount = el({ attrs: { 'data-faq-store-count': '' } });
  const groupHost = el({ attrs: { 'data-faq-store-groups': '' } });
  groupRoot.appendChild(groupCount);
  groupRoot.appendChild(groupHost);
  groupRoot.querySelector = function (sel) {
    if (sel === '[data-faq-store-count]') return groupCount;
    if (sel === '[data-faq-store-groups]') return groupHost;
    if (sel === '[data-faq-store-list]') return null;
    return null;
  };
  groupRoot.querySelectorAll = function (sel) {
    return sel === '[data-faq-store-count]' ? [groupCount] : [];
  };
  groupRoot.ownerDocument = doc;
  storePick.paintFaqStores(groupRoot);
  assert.strictEqual(groupCount.textContent, 'We deliver to 150 platforms.');
  assert.strictEqual(groupHost.children.length, 3);
  assert.strictEqual(groupHost.children[0].className, 'faq-store-group');
  assert.strictEqual(groupHost.children[0].children[0].textContent, 'Streaming');
  assert.strictEqual(groupHost.children[2].children[0].textContent, 'Rights / tools');
  assert.strictEqual(groupHost.children[2].children[1].textContent, 'Still delivered, not a listening app.');

  const liveCatalog = [
    '7digital', 'acrcloud', 'amazon-music', 'anghami', 'apple-music', 'apple-music-video',
    'audiomack', 'audiomack-video', 'awa', 'bandcamp', 'beatport', 'boomplay', 'boomplay-video',
    'canva', 'claro-musica', 'deezer', 'facebook-audio-library', 'facebook-rights-manager',
    'flo', 'gaana', 'iheartradio', 'imusica', 'instagram-facebook', 'jiosaavn', 'joox',
    'kkbox', 'lickd', 'melon', 'mixcloud', 'napster', 'netease', 'nuuday', 'pandora',
    'peloton', 'pinterest', 'qobuz', 'roxi', 'snapchat', 'soundcloud', 'soundexchange',
    'soundtrack-your-brand', 'spotify', 'taobao', 'tencent-music', 'tidal', 'tidal-video',
    'tiktok', 'tiktok-music', 'trace', 'trebel', 'tuned-global', 'vevo', 'youtube',
    'youtube-content-id', 'youtube-music',
  ];
  assert.strictEqual(liveCatalog.length, 55);
  const liveGrouped = storePick.formatFaqStores(liveCatalog.map(function (slug) {
    return { slug: slug, name: slug };
  }));
  assert.strictEqual(liveGrouped.count, 55);
  assert.strictEqual(liveGrouped.groups.length, 3);
  assert.strictEqual(liveGrouped.groups[0].names.length + liveGrouped.groups[1].names.length + liveGrouped.groups[2].names.length, 55);
  assert.deepStrictEqual(storePick.FAQ_FALLBACK_STORES.map(function (row) { return row.slug; }).sort(), liveCatalog.slice().sort());

  console.log('lib/store-pick.test.js ok');
}

run();
