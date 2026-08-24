'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WIZARD = ['upload.html', 'attest.html', 'review.html', 'submitted.html', 'split-sheet.html'];
const FORBIDDEN_INPUT_VALUES = [
  'value="Neon Shadows"',
  "value='Neon Shadows'",
  'value="Victoria Reyes"',
  "value='Victoria Reyes'",
  'value="Electronic / Synthwave"',
];

function attr(tag, name) {
  const match = tag.match(new RegExp('\\s' + name + '="([^"]*)"'));
  return match ? match[1] : '';
}

function selectById(html, id) {
  const match = html.match(new RegExp('<select[^>]*id="' + id + '"[\\s\\S]*?<\\/select>'));
  assert.ok(match, 'missing select #' + id);
  return match[0];
}

function options(selectHtml) {
  return Array.from(selectHtml.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)).map(function (match) {
    return {
      attrs: match[1],
      value: attr(match[1], 'value'),
      label: match[2],
      selected: /\sselected\b/.test(match[1]),
    };
  });
}

function testTypeaheadPrefixBlurKeepsFirstOption(select, input, prefix, expectedLabel) {
  input.value = prefix;
  if (input.listeners && input.listeners.input) input.listeners.input();
  input.listeners.blur();
  assert.strictEqual(input.value, expectedLabel, 'typeahead prefix blur keeps first real option');
  assert.ok(String(select.value || ''), 'typeahead prefix blur must apply a real catalog option');
}

function testTypeaheadGarbageStillClears(select, input) {
  input.value = 'zzzz-not-a-real-genre';
  if (input.listeners && input.listeners.input) input.listeners.input();
  input.listeners.blur();
  assert.strictEqual(select.value, '', 'typeahead custom garbage still clears');
  assert.strictEqual(input.value, '', 'typeahead custom garbage still clears the visible field');
}

function testTypeaheadDelayedBlurKeepsListPick(catalog, created) {
  const field = {
    children: [],
    classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; }, remove() {} },
    querySelector(sel) {
      if (sel === '.typeahead-input') return this.children.find(function (node) { return node.className === 'typeahead-input'; }) || null;
      if (sel === '.typeahead-list') return this.children.find(function (node) { return String(node.className || '').indexOf('typeahead-list') !== -1; }) || null;
      return { setAttribute() {} };
    },
    insertBefore(node) { this.children.push(node); return node; },
    appendChild(node) { this.children.push(node); return node; },
  };
  const select = {
    parentNode: field,
    id: 'tg-genre-delay',
    options: [{ value: '', textContent: 'Select genre' }],
    selectedIndex: 0,
    value: '',
    tabIndex: 0,
    classList: { add() {} },
    attrs: {},
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    dispatchEvent() {},
    addEventListener() {},
  };
  const timers = [];
  const prevWindow = global.window;
  const prevDocument = global.document;
  global.window = {
    setTimeout(fn, ms) { timers.push({ fn: fn, ms: ms == null ? 0 : ms }); return timers.length; },
    clearTimeout() {},
    addEventListener() {},
  };
  global.document = {
    addEventListener(type, fn) {
      this.listeners = this.listeners || {};
      this.listeners[type] = fn;
    },
    createElement(tag) {
      const node = {
        tagName: String(tag).toUpperCase(),
        type: '',
        className: '',
        id: '',
        value: '',
        textContent: '',
        children: [],
        style: {},
        attrs: {},
        listeners: {},
        classList: {
          tokens: Object.create(null),
          add(name) { this.tokens[name] = true; },
          remove(name) { delete this.tokens[name]; },
          contains(name) { return Boolean(this.tokens[name]); },
          toggle(name, on) {
            if (on === false) delete this.tokens[name];
            else this.tokens[name] = true;
          },
        },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        appendChild(child) { this.children.push(child); return child; },
      };
      created.push(node);
      return node;
    },
  };
  try {
    catalog.bindTypeahead(select, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
    const input = field.children.find(function (node) { return node.className === 'typeahead-input'; });
    const list = field.children.find(function (node) { return String(node.className || '').indexOf('typeahead-list') !== -1; });
    assert.ok(input);
    assert.ok(list);
    input.listeners.focus();
    const hip = list.children.find(function (btn) { return btn.textContent === 'Hip-Hop'; });
    assert.ok(hip, 'Hip-Hop must be in the open list');
    input.value = 'Hip';
    input.listeners.blur();
    const blurTimer = timers.find(function (row) { return row.ms >= 400; });
    assert.ok(blurTimer, 'typeahead blur delay must be ~400ms so an iOS list tap can win');
    if (hip.listeners.pointerdown) hip.listeners.pointerdown({ preventDefault() {}, stopPropagation() {} });
    timers.forEach(function (row) { row.fn(); });
    assert.strictEqual(select.value, 'Hip-Hop', 'typeahead list pick after delayed blur stays');
    assert.strictEqual(input.value, 'Hip-Hop', 'typeahead list pick after delayed blur stays');
  } finally {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;
    if (prevDocument === undefined) delete global.document;
    else global.document = prevDocument;
  }
}

function testTypeaheadRebindsIfInputMissing(catalog) {
  const field = {
    children: [],
    classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; }, remove() {} },
    querySelector() { return null; },
    insertBefore(node) { this.children.push(node); return node; },
    appendChild(node) { this.children.push(node); return node; },
  };
  const select = {
    parentNode: field,
    id: 'edit-genre',
    options: [{ value: '', textContent: 'Select genre' }],
    selectedIndex: 0,
    value: '',
    tabIndex: 0,
    classList: { add() {} },
    attrs: { 'data-typeahead': 'on' },
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    dispatchEvent() {},
    addEventListener() {},
  };
  const created = [];
  const prevDocument = global.document;
  global.document = {
    createElement(tag) {
      const node = {
        tagName: String(tag).toUpperCase(),
        type: '',
        className: '',
        id: '',
        value: '',
        textContent: '',
        children: [],
        style: {},
        attrs: {},
        listeners: {},
        classList: {
          tokens: Object.create(null),
          add(name) { this.tokens[name] = true; },
          remove(name) { delete this.tokens[name]; },
          contains(name) { return Boolean(this.tokens[name]); },
        },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        appendChild(child) { this.children.push(child); return child; },
      };
      created.push(node);
      return node;
    },
  };
  try {
    catalog.bindTypeahead(select, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
    const input = created.find(function (node) { return node.className === 'typeahead-input'; });
    assert.ok(input, 'bindTypeahead must run again when the typeahead input is missing');
  } finally {
    if (prevDocument === undefined) delete global.document;
    else global.document = prevDocument;
  }
}

function run() {
  WIZARD.forEach(function (file) {
    const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
    FORBIDDEN_INPUT_VALUES.forEach(function (needle) {
      assert.strictEqual(html.indexOf(needle), -1, file + ' still has ' + needle);
    });
    assert.strictEqual(/name:\s*'Victoria Reyes'/.test(html), false, file + ' still defaults a writer to Victoria Reyes');
  });

  const upload = fs.readFileSync(path.join(__dirname, 'upload.html'), 'utf8');
  assert.ok(/id="tg-title"[^>]*value=""/.test(upload));
  assert.ok(/id="tg-artist"[^>]*value=""/.test(upload));
  assert.ok(upload.indexOf('placeholder="SONG TITLE"') !== -1);
  assert.ok(upload.indexOf('Choose artist profile') !== -1);
  assert.ok(upload.indexOf('Create new artist profile') !== -1);
  assert.ok(upload.indexOf('Add external artist') !== -1);
  assert.ok(upload.indexOf('id="tg-artist-new"') !== -1);
  assert.ok(upload.indexOf('id="tg-artist-link"') !== -1);
  assert.ok(upload.indexOf('human_contributions') === -1);
  assert.ok(upload.indexOf('ai_involvement') === -1);
  assert.ok(upload.indexOf('placeholder="Artist name"') !== -1);
  assert.ok(!/id="tg-artist"[^>]*(legal name|FIRST NAME LAST NAME)/i.test(upload));
  assert.ok(upload.indexOf('placeholder="Optional featured"') !== -1);

  const settings = fs.readFileSync(path.join(__dirname, 'settings.html'), 'utf8');
  assert.ok(settings.indexOf('<label>Artist name</label>') !== -1);
  assert.ok(settings.indexOf('data-account-artist') !== -1);
  assert.ok(settings.indexOf('placeholder="Artist name"') !== -1);
  assert.ok(!/data-account-artist[^>]*(legal name|FIRST NAME LAST NAME)/i.test(settings));
  assert.ok(!/Legal name[\s\S]{0,80}required/i.test(settings));
  assert.ok(settings.indexOf('John ham') === -1);
  assert.ok(settings.indexOf('>VV<') === -1);
  assert.ok(settings.indexOf('data-account-avatar>PG') !== -1);
  assert.ok(upload.indexOf('placeholder="Electronic"') === -1);
  assert.ok(upload.indexOf('placeholder="$0.00"') === -1);
  assert.ok(upload.indexOf('placeholder="Price"') === -1);
  assert.ok(upload.indexOf('<input id="tg-genre"') === -1);
  assert.ok(upload.indexOf('<input id="tg-language"') === -1);
  assert.ok(upload.indexOf('<input id="tg-price"') === -1);
  assert.ok(upload.indexOf('<select id="tg-genre"') !== -1);
  assert.ok(upload.indexOf('<select id="tg-language"') !== -1);
  assert.ok(upload.indexOf('<select id="tg-price"') !== -1);
  assert.ok(upload.indexOf('plai-bubble.js') !== -1);
  assert.ok(upload.indexOf('membership.js') !== -1);
  assert.ok(upload.indexOf('data-require-membership="true"') !== -1);
  assert.ok(upload.indexOf('id="tg-upgrade"') !== -1);
  assert.ok(upload.indexOf('href="creator.html"') !== -1);
  assert.ok(upload.indexOf('href="pro.html"') !== -1);

  assert.ok(upload.indexOf('upload-catalog.js') !== -1);
  assert.ok(upload.indexOf('bindTypeahead') !== -1 || fs.readFileSync(path.join(__dirname, 'upload-catalog.js'), 'utf8').indexOf('bindTypeahead') !== -1);
  assert.ok(upload.indexOf('id="tg-subgenre"') === -1);
  assert.ok(upload.indexOf('name="release-subgenre"') === -1);
  assert.ok(upload.indexOf('capture=') === -1);
  assert.ok(upload.indexOf('accept="audio/*,.wav,.flac,.mp3,.mpeg,.mpga,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/mpeg,audio/mp3,audio/x-mpeg,audio/x-mp3,audio/mpeg3,audio/mpg"') !== -1);
  assert.ok(upload.indexOf('lib/audio-accept.js') !== -1);
  assert.ok(upload.indexOf('lib/store-pick.js') !== -1);
  assert.ok(upload.indexOf('Pre-select all stores') !== -1);
  assert.ok(upload.indexOf('data-store-customize') !== -1);
  assert.ok(upload.indexOf('data-store-all') !== -1);
  assert.ok(upload.indexOf('data-store-list') !== -1);
  assert.ok(upload.indexOf('data-store-pick') !== -1);
  assert.ok(upload.indexOf('accept=".jpg,.jpeg,.png,image/jpeg,image/png"') !== -1);
  assert.ok(upload.indexOf('data-art-pick') !== -1);
  assert.ok(upload.indexOf('data-art-input') !== -1);
  assert.ok(upload.indexOf('MP3 is converted to WAV before it goes to stores') !== -1);
  assert.ok(upload.indexOf('data-audio-preview') !== -1);
  assert.ok(upload.indexOf('data-audio-player') !== -1);
  assert.ok(upload.indexOf('data-audio-play') !== -1);
  assert.ok(upload.indexOf('URL.createObjectURL') !== -1);
  assert.ok(upload.indexOf('URL.revokeObjectURL') !== -1);
  assert.ok(upload.indexOf('pagehide') !== -1);
  assert.ok(upload.indexOf('indexedDB') === -1);
  assert.ok(upload.indexOf('Play this file here to confirm it is the right master') !== -1);
  assert.ok(upload.indexOf('id="tg-instrumental"') !== -1);
  assert.ok(upload.indexOf('type="checkbox"') !== -1);
  assert.ok(upload.indexOf('data-language-field') !== -1);
  assert.ok(upload.indexOf('data-upload-loader') !== -1);
  assert.ok(upload.indexOf('hidden') !== -1);
  assert.ok(!/accept="[^"]*audio\/mp4|m4a|aiff/i.test(upload));
  assert.ok(upload.indexOf('ToneGrid accepts MP3') === -1);

  const catalog = require('./upload-catalog');
  const vm = require('vm');
  const dual = { module: { exports: {} }, window: { document: null }, document: null };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'upload-catalog.js'), 'utf8'), dual);
  assert.strictEqual(dual.window.PlaigroundUploadCatalog, dual.module.exports, 'window catalog must exist even when module.exports is set');
  assert.ok(dual.window.PlaigroundUploadCatalog.GENRES.length >= 180);
  assert.ok(typeof dual.window.PlaigroundUploadCatalog.bindTypeahead === 'function');
  assert.ok(catalog.GENRES.indexOf('Afrobeats') !== -1);
  assert.ok(catalog.GENRES.indexOf('Afropop') !== -1);
  assert.ok(catalog.GENRES.indexOf('Electronic') !== -1);
  assert.ok(catalog.GENRES.length >= 180);
  assert.ok(catalog.LANGUAGES.length >= 180);
  assert.ok(catalog.LANGUAGES.every(function (row) { return /^[a-z]{2}$/.test(row.code); }));
  assert.ok(catalog.LANGUAGES.some(function (row) { return row.code === 'en' && row.name === 'English'; }));
  assert.ok(catalog.LANGUAGES.some(function (row) { return row.code === 'es'; }));
  assert.ok(!catalog.LANGUAGES.some(function (row) { return row.code === 'English'; }));

  const genre = options(selectById(upload, 'tg-genre'));
  assert.deepStrictEqual(genre.map(function (opt) { return opt.value; }), ['']);
  assert.strictEqual(genre[0].label, 'Select genre');
  assert.ok(genre.every(function (opt) { return !opt.selected; }));

  const language = options(selectById(upload, 'tg-language'));
  assert.strictEqual(language[0].value, '');
  assert.strictEqual(language[0].label, 'Select language');
  assert.ok(!language.some(function (opt) { return opt.value === 'English'; }));
  assert.ok(language.every(function (opt) { return !opt.selected; }));

  const price = options(selectById(upload, 'tg-price'));
  assert.deepStrictEqual(price.map(function (opt) { return opt.value; }), ['', '$0.69', '$0.99']);
  assert.strictEqual(price[0].label, 'Select price');
  assert.ok(price.every(function (opt) { return !opt.selected; }));

  const catalogSrc = fs.readFileSync(path.join(__dirname, 'upload-catalog.js'), 'utf8');
  assert.ok(catalogSrc.indexOf('if (matches.length >= 12) break;') === -1);
  assert.ok(catalogSrc.indexOf('visualViewport') !== -1);
  assert.ok(catalogSrc.indexOf('pointerdown') !== -1);
  assert.ok(catalogSrc.indexOf('must not jump the input') !== -1);
  assert.ok(/if \(typeof module === 'object' && module.exports\) \{[\s\S]*?\}\s*if \(typeof window !== 'undefined'\)/.test(catalogSrc), 'catalog must attach on window even when CommonJS module exists');
  const tonegridSrc = fs.readFileSync(path.join(__dirname, 'tonegrid.js'), 'utf8');
  assert.ok(tonegridSrc.indexOf('function bindUploadCatalog') !== -1, 'upload must bind typeahead itself, not only wait for DOMContentLoaded');
  assert.ok(tonegridSrc.indexOf('fillUploadSelects') !== -1);
  assert.ok(tonegridSrc.indexOf('bindTypeahead') !== -1);
  assert.ok(tonegridSrc.indexOf('ignoreEmpty') !== -1, 'calendar input must not wipe a just-picked date');
  const css = fs.readFileSync(path.join(__dirname, 'site.css'), 'utf8');
  assert.ok(/\.typeahead-list\s*\{[\s\S]*?overflow-y:\s*auto/.test(css));
  assert.ok(/\.typeahead-list\s*\{[\s\S]*?max-height:\s*240px/.test(css));
  assert.ok(/input\.typeahead-input[\s\S]*?font-size:\s*16px/.test(css));
  assert.ok(/select\.is-typeahead-source[\s\S]*?width:\s*0/.test(css));
  assert.ok(/select\.details-select\.is-typeahead-source/.test(css));
  assert.ok(/select\.is-typeahead-source[\s\S]*?pointer-events:\s*none/.test(css));
  assert.ok(/\.typeahead-field\.is-typeahead-open\s*\{[^}]*z-index:\s*4100/.test(css), 'open typeahead must sit above the PLAI bubble');
  assert.ok(/\.typeahead-list\s*\{[\s\S]*?z-index:\s*4200/.test(css), 'typeahead list must sit above the PLAI bubble');
  assert.ok(css.indexOf('::-webkit-datetime-edit') !== -1, 'picked calendar date must keep visible text');
  assert.ok(catalog.LANGUAGES.filter(function (row) { return row.name === 'Akan'; }).length === 1);
  assert.ok(catalog.LANGUAGES.some(function (row) { return row.code === 'tw' && row.name === 'Twi'; }));
  assert.ok(/\.typeahead-list\.is-above/.test(css));
  assert.ok(/\.typeahead-list button[\s\S]*?min-height:\s*44px/.test(css));

  const aGenres = catalog.GENRES.filter(function (name) { return /^a/i.test(name); });
  assert.ok(aGenres.length > 12, 'catalog must have more than 12 A-genres so the old 12-cap was stuck on A');
  assert.ok(catalog.GENRES.some(function (name) { return /^b/i.test(name); }));

  const field = {
    children: [],
    classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; } },
    querySelector() { return { setAttribute() {} }; },
    insertBefore(node) { this.children.push(node); return node; },
    appendChild(node) { this.children.push(node); return node; },
  };
  const select = {
    parentNode: field,
    id: 'tg-genre',
    options: [{ value: '', textContent: 'Select genre' }],
    selectedIndex: 0,
    value: '',
    tabIndex: 0,
    classList: { add() {} },
    attrs: {},
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    dispatchEvent() {},
  };
  const created = [];
  const prevDocument = global.document;
  global.document = {
    createElement(tag) {
      const node = {
        tagName: String(tag).toUpperCase(),
        type: '',
        className: '',
        id: '',
        value: '',
        textContent: '',
        children: [],
        style: {},
        attrs: {},
        listeners: {},
        classList: {
          tokens: Object.create(null),
          add(name) { this.tokens[name] = true; },
          remove(name) { delete this.tokens[name]; },
          contains(name) { return Boolean(this.tokens[name]); },
          toggle(name, on) {
            if (on === false) delete this.tokens[name];
            else this.tokens[name] = true;
          },
        },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        appendChild(child) { this.children.push(child); return child; },
      };
      created.push(node);
      return node;
    },
  };
  try {
    catalog.bindTypeahead(select, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
    const input = created.find(function (node) { return node.className === 'typeahead-input'; });
    const list = created.find(function (node) { return String(node.className).indexOf('typeahead-list') !== -1; });
    assert.ok(input);
    assert.ok(list);
    input.listeners.focus();
    assert.ok(list.children.length > 12, 'empty query must render the full match set, not a 12-item clip');
    assert.ok(list.children.length === catalog.GENRES.length);
    assert.strictEqual(list.style.overflowY, 'auto');
    assert.ok(Number(String(list.style.maxHeight).replace('px', '')) >= 240);
    input.value = 'A';
    input.listeners.input();
    assert.ok(list.children.length > 12, 'A-query must stay scrollable past the first letter');
    assert.ok(list.children.some(function (btn) { return /^B/i.test(btn.textContent); }), 'full A-match set must include items past A');

    testTypeaheadPrefixBlurKeepsFirstOption(select, input, 'Hip', 'Hip-Hop');
    testTypeaheadGarbageStillClears(select, input);

    const langField = {
      children: [],
      classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; } },
      querySelector() { return { setAttribute() {} }; },
      insertBefore(node) { this.children.push(node); return node; },
      appendChild(node) { this.children.push(node); return node; },
    };
    const langSelect = {
      parentNode: langField,
      id: 'tg-language',
      options: [{ value: '', textContent: 'Select language' }],
      selectedIndex: 0,
      value: '',
      tabIndex: 0,
      classList: { add() {} },
      attrs: {},
      getAttribute(name) { return this.attrs[name] || null; },
      setAttribute(name, value) { this.attrs[name] = String(value); },
      dispatchEvent() {},
      addEventListener() {},
    };
    const langCreated = [];
    global.document.createElement = function (tag) {
      const node = {
        tagName: String(tag).toUpperCase(),
        type: '',
        className: '',
        id: '',
        value: '',
        textContent: '',
        children: [],
        style: {},
        attrs: {},
        listeners: {},
        classList: {
          tokens: Object.create(null),
          add(name) { this.tokens[name] = true; },
          remove(name) { delete this.tokens[name]; },
          contains(name) { return Boolean(this.tokens[name]); },
          toggle(name, on) {
            if (on === false) delete this.tokens[name];
            else this.tokens[name] = true;
          },
        },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        appendChild(child) { this.children.push(child); return child; },
        getBoundingClientRect() {
          return this._rect || { top: 40, bottom: 84, left: 16, width: 280, height: 44 };
        },
      };
      langCreated.push(node);
      return node;
    };
    catalog.bindTypeahead(langSelect, catalog.LANGUAGES, function (row) { return row.code; }, function (row) { return row.name; });
    const langInput = langCreated.find(function (node) { return node.className === 'typeahead-input'; });
    const langList = langCreated.find(function (node) { return String(node.className).indexOf('typeahead-list') !== -1; });
    assert.ok(langInput);
    assert.ok(langList);
    langInput.listeners.focus();
    assert.ok(langList.children.length >= 180, 'language typeahead must list the full ISO set');
    langInput.value = 'En';
    langInput.listeners.input();
    assert.ok(langList.children.length >= 1);
    assert.ok(langList.children.some(function (btn) { return btn.textContent === 'English'; }));
    assert.strictEqual(langInput.value, 'En', 'ISO code must not jump the visible field to English');
    assert.strictEqual(langSelect.value, '', 'ISO code is a filter, not a mid-type pick');
    langInput.value = 'English';
    langInput.listeners.input();
    assert.strictEqual(langSelect.value, 'en');
    assert.strictEqual(langInput.value, 'English');
    const english = langList.children.find(function (btn) { return btn.textContent === 'English'; });
    assert.ok(english);
    english.listeners.pointerdown({ preventDefault() {}, stopPropagation() {} });
    assert.strictEqual(langSelect.value, 'en');
    assert.strictEqual(langInput.value, 'English');
    langInput.value = 'en';
    langInput.listeners.input();
    assert.strictEqual(langInput.value, 'en');
    langInput.listeners.blur();
    assert.strictEqual(langSelect.value, 'en');
    assert.strictEqual(langInput.value, 'English');
    testTypeaheadPrefixBlurKeepsFirstOption(langSelect, langInput, 'Engl', 'English');
    assert.strictEqual(langSelect.value, 'en');
    langInput.value = 'Klingon';
    langInput.listeners.input();
    assert.strictEqual(langSelect.value, '');
    langInput._rect = { top: 80, bottom: 124, left: 16, width: 280, height: 44 };
    const prevWindow = global.window;
    global.window = {
      innerHeight: 280,
      innerWidth: 390,
      visualViewport: { offsetTop: 0, offsetLeft: 0, width: 390, height: 280, addEventListener() {} },
      addEventListener() {},
      scrolled: 0,
      scrollBy(x, y) { this.scrolled += y; },
      setTimeout(fn) { fn(); return 1; },
      clearTimeout() {},
    };
    try {
      langInput.value = '';
      langInput.listeners.focus();
      const maxH = Number(String(langList.style.maxHeight).replace('px', ''));
      assert.ok(maxH <= 148, 'list must shrink to the space above the keyboard');
      assert.ok(maxH >= 120);
      assert.ok(global.window.scrolled !== 0, 'focused language field must scroll into the visible viewport');
      langInput._rect = { top: 430, bottom: 474, left: 16, width: 280, height: 44 };
      global.window.innerHeight = 520;
      global.window.visualViewport.height = 520;
      langInput.listeners.focus();
      assert.ok(langList.classList.contains('is-above'), 'list flips above when the keyboard leaves no room below');
    } finally {
      if (prevWindow === undefined) delete global.window;
      else global.window = prevWindow;
    }
  } finally {
    if (prevDocument === undefined) delete global.document;
    else global.document = prevDocument;
  }

  const review = fs.readFileSync(path.join(__dirname, 'review.html'), 'utf8');
  assert.ok(review.indexOf('Pre-select all stores') !== -1);
  assert.ok(review.indexOf('data-store-customize') !== -1);
  assert.ok(review.indexOf('164 of 165 stores') === -1);
  assert.ok(review.indexOf('All 156 other stores') === -1);

  const song = fs.readFileSync(path.join(__dirname, 'song.html'), 'utf8');
  assert.ok(song.indexOf('id="edit-language"') !== -1);
  assert.ok(song.indexOf('<select id="edit-genre"') !== -1);
  assert.ok(song.indexOf('<input id="edit-genre"') === -1);
  assert.ok(song.indexOf('id="edit-subgenre"') === -1);
  assert.ok(song.indexOf('name="release-subgenre"') === -1);
  assert.ok(song.indexOf('Pre-select all stores') !== -1);
  assert.ok(song.indexOf('data-store-customize') !== -1);
  assert.ok(song.indexOf('accept="audio/*,.wav,.flac,.mp3,.mpeg,.mpga') !== -1);
  assert.ok(song.indexOf('lib/audio-accept.js') !== -1);
  assert.ok(song.indexOf('lib/store-pick.js') !== -1);

  const editSelectHtml = selectById(song, 'edit-genre');
  const editGenre = options(editSelectHtml);
  assert.deepStrictEqual(editGenre.map(function (opt) { return opt.value; }), ['']);
  assert.strictEqual(editGenre[0].label, 'Select genre');

  function realisticSelect(id) {
    const field = {
      children: [],
      classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; } },
      querySelector(sel) {
        if (sel && sel.indexOf('label') === 0) return { setAttribute() {} };
        if (sel === '.typeahead-input') return this.children.find(function (node) { return node.className === 'typeahead-input'; }) || null;
        return null;
      },
      insertBefore(node) { this.children.push(node); return node; },
      appendChild(node) { this.children.push(node); return node; },
    };
    const optionsArr = [{ value: '', textContent: 'Select genre', parentNode: field }];
    const select = {
      parentNode: field,
      id: id,
      options: optionsArr,
      selectedIndex: 0,
      _value: '',
      tabIndex: 0,
      classList: { add() {} },
      attrs: {},
      get value() { return this._value; },
      set value(next) {
        const found = this.options.find(function (opt) { return opt.value === next; });
        if (found) {
          this._value = next;
          this.selectedIndex = this.options.indexOf(found);
        } else {
          this._value = '';
          this.selectedIndex = 0;
        }
      },
      getAttribute(name) { return this.attrs[name] || null; },
      setAttribute(name, value) { this.attrs[name] = String(value); },
      dispatchEvent() {},
      addEventListener() {},
      querySelectorAll(sel) { return sel === 'option' ? this.options : []; },
      appendChild(child) {
        child.parentNode = this;
        this.options.push(child);
        return child;
      },
    };
    return { field: field, select: select };
  }

  const createdEdit = [];
  const prevDoc2 = global.document;
  global.document = {
    createElement(tag) {
      const node = {
        tagName: String(tag).toUpperCase(),
        type: '',
        className: '',
        id: '',
        value: '',
        textContent: '',
        children: [],
        style: {},
        attrs: {},
        listeners: {},
        classList: {
          tokens: Object.create(null),
          add(name) { this.tokens[name] = true; },
          remove(name) { delete this.tokens[name]; },
          contains(name) { return Boolean(this.tokens[name]); },
        },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        appendChild(child) { this.children.push(child); return child; },
      };
      createdEdit.push(node);
      return node;
    },
    activeElement: null,
  };
  try {
    const edit = realisticSelect('edit-genre');
    catalog.fillSelect = catalog.fillSelect;
    catalog.fillUploadSelects({
      getElementById(id) { return id === 'edit-genre' ? edit.select : null; },
    });
    assert.ok(edit.select.options.length > 180, 'edit genre must load the same ToneGrid list as upload');
    catalog.bindTypeahead(edit.select, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
    const editInput = createdEdit.find(function (node) { return node.className === 'typeahead-input'; });
    const editList = createdEdit.find(function (node) { return String(node.className).indexOf('typeahead-list') !== -1; });
    assert.ok(editInput);
    assert.ok(editList);
    catalog.setTypeaheadValue(edit.select, 'electronic');
    assert.strictEqual(edit.select.value, 'Electronic');
    assert.strictEqual(editInput.value, 'Electronic');
    editInput.value = 'Afrobeat';
    editInput.listeners.input();
    assert.ok(editList.children.some(function (btn) { return btn.textContent === 'Afrobeats'; }));
    const afro = editList.children.find(function (btn) { return btn.textContent === 'Afrobeats'; });
    afro.listeners.mousedown({ preventDefault() {} });
    assert.strictEqual(edit.select.value, 'Afrobeats');
    assert.strictEqual(editInput.value, 'Afrobeats');
    editInput.value = 'Made Up Genre';
    editInput.listeners.input();
    assert.strictEqual(edit.select.value, '');
    assert.strictEqual(catalog.canonicalCatalogValue(edit.select, 'Made Up Genre'), null);
    assert.strictEqual(catalog.canonicalCatalogValue(edit.select, 'Pop'), 'Pop');
    testTypeaheadDelayedBlurKeepsListPick(catalog, createdEdit);
    testTypeaheadRebindsIfInputMissing(catalog);
  } finally {
    if (prevDoc2 === undefined) delete global.document;
    else global.document = prevDoc2;
  }

  console.log('upload-defaults.test.js ok');
}

run();
