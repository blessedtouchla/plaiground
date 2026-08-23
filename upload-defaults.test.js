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
  assert.ok(upload.indexOf('<label for="tg-artist">Primary artist</label>') !== -1);
  assert.ok(upload.indexOf('placeholder="Artist name"') !== -1);
  assert.ok(!/id="tg-artist"[^>]*(legal name|FIRST NAME LAST NAME)/i.test(upload));
  assert.ok(upload.indexOf('placeholder="Optional featured"') !== -1);

  const settings = fs.readFileSync(path.join(__dirname, 'settings.html'), 'utf8');
  assert.ok(settings.indexOf('<label>Artist name</label>') !== -1);
  assert.ok(settings.indexOf('data-account-artist') !== -1);
  assert.ok(settings.indexOf('placeholder="Artist name"') !== -1);
  assert.ok(!/data-account-artist[^>]*(legal name|FIRST NAME LAST NAME)/i.test(settings));
  assert.ok(!/Legal name[\s\S]{0,80}required/i.test(settings));
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
  assert.ok(upload.indexOf('accept=".wav,.flac,.mp3,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/mpeg,audio/mp3"') !== -1);
  assert.ok(upload.indexOf('accept=".jpg,.jpeg,.png,image/jpeg,image/png"') !== -1);
  assert.ok(upload.indexOf('data-art-pick') !== -1);
  assert.ok(upload.indexOf('data-art-input') !== -1);
  assert.ok(upload.indexOf('MP3 is converted to WAV before it goes to stores') !== -1);
  assert.ok(upload.indexOf('id="tg-instrumental"') !== -1);
  assert.ok(upload.indexOf('type="checkbox"') !== -1);
  assert.ok(upload.indexOf('data-language-field') !== -1);
  assert.ok(upload.indexOf('data-upload-loader') !== -1);
  assert.ok(upload.indexOf('hidden') !== -1);
  assert.ok(!/accept="[^"]*audio\/mp4|m4a|aiff/i.test(upload));
  assert.ok(upload.indexOf('ToneGrid accepts MP3') === -1);

  const catalog = require('./upload-catalog');
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
  const css = fs.readFileSync(path.join(__dirname, 'site.css'), 'utf8');
  assert.ok(/\.typeahead-list\s*\{[\s\S]*?overflow-y:\s*auto/.test(css));
  assert.ok(/\.typeahead-list\s*\{[\s\S]*?max-height:\s*240px/.test(css));

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
  } finally {
    if (prevDocument === undefined) delete global.document;
    else global.document = prevDocument;
  }

  console.log('upload-defaults.test.js ok');
}

run();
