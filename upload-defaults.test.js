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
  assert.ok(upload.indexOf('placeholder="FIRST NAME LAST NAME"') !== -1);
  assert.ok(upload.indexOf('placeholder="Optional featured"') !== -1);
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

  console.log('upload-defaults.test.js ok');
}

run();
