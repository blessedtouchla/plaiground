'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STAMP = '20260912cr2';

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function teslaCutCss(css) {
  const start = css.indexOf('/* —— Upload Credits Tesla cut (one picker + sentence-case + Logo Blue steps) —— */');
  assert.ok(start !== -1, 'Credits Tesla-cut block is in site.css');
  return css.slice(start);
}

function run() {
  const upload = read('upload.html');
  const css = read('site.css');
  const cut = teslaCutCss(css);
  const leftoverStart = css.indexOf('/* —— Upload leftover: tiny side Credits/Send steps + Artist card —— */');
  const leftover = leftoverStart === -1 ? '' : css.slice(leftoverStart);
  const store = read('store-client.js');
  const artistCard = upload.slice(
    upload.indexOf('data-upload-artist'),
    upload.indexOf('id="tg-artist"')
  );
  const detailsCard = upload.slice(
    upload.indexOf('<h3>Submit the details</h3>'),
    upload.indexOf('id="upload-send"')
  );

  assert.ok(upload.includes('site.css?v=' + STAMP), 'Upload cache-busts site.css at ' + STAMP);
  assert.ok(upload.includes('store-client.js?v=' + STAMP), 'Upload cache-busts store-client.js at ' + STAMP);
  assert.ok(!upload.includes('site.css?v=20260912cr1'), 'cr1 stamp is retired after English default');
  assert.ok(!upload.includes('site.css?v=20260912ca2'), 'ca2 stamp is retired');
  assert.strictEqual((upload.match(/href="site\.css\?v=/g) || []).length, 1, 'one site.css link only');

  assert.ok(/data-artist-mode-field hidden/.test(artistCard), 'mode field stays for existing JS, hidden from the card');
  assert.ok(cut.includes('[data-artist-mode-field]'), 'mode field is display-none on Upload Credits');
  assert.ok(/<label for="tg-artist-select" class="sr-only">Artist<\/label>/.test(artistCard), 'one quiet artist dropdown');
  assert.ok((artistCard.match(/<select /g) || []).filter(Boolean).length >= 2, 'mode select stays in the DOM for existing create/import');
  assert.ok(!/<label for="tg-artist-select">Choose artist profile<\/label>/.test(artistCard), 'duplicate Choose artist profile label is retired');
  assert.ok(artistCard.includes('Profiles hold photo, bio, and genres.'), 'helper stays once');
  assert.ok((artistCard.match(/Profiles hold photo, bio, and genres\./g) || []).length === 1, 'helper is not repeated');

  assert.ok(/<label for="tg-featured">Featured artist<\/label>/.test(detailsCard), 'Featured artist stays sentence case in markup');
  assert.ok(/<label for="tg-genre">Genre<\/label>/.test(detailsCard), 'Genre stays sentence case in markup');
  assert.ok(/<label for="tg-language">Language<\/label>/.test(detailsCard), 'Language stays sentence case in markup');
  assert.ok(/<label for="tg-price">Download price<\/label>/.test(detailsCard), 'Download price stays sentence case in markup');
  assert.ok(/\.upload-credits-card \.field label[\s\S]*?text-transform:\s*none/.test(cut), 'Credits labels do not shout ALL CAPS');
  assert.ok(/\.upload-credits-card h3[\s\S]*?font-family:\s*"Space Grotesk"/.test(cut), 'Credits titles stay Space Grotesk');
  assert.ok(/\.upload-credits-card \.field label[\s\S]*?font-family:\s*Inter/.test(cut), 'Credits labels stay Inter');

  assert.ok(/<span class="stage-step chip-credits" data-stage-chip="credits">Credits<\/span>/.test(upload), 'Credits stays a tiny inert step');
  assert.ok(/<span class="stage-step chip-send" data-stage-chip="send">Send<\/span>/.test(upload), 'Send stays a tiny inert step');
  assert.ok(/\.chip-credits\.is-on,[\s\S]*?color:\s*var\(--stage-blue\)/.test(leftover), 'active CREDITS · SEND is Logo Blue');
  assert.ok(!leftover.includes('var(--stage-gold)'), 'Gold stays off CREDITS · SEND');
  assert.ok(!cut.includes('var(--stage-gold)'), 'Gold stays off this Credits chrome pass');

  assert.ok(/<select id="tg-genre"/.test(detailsCard), 'genre stays the existing select');
  assert.ok(/<select id="tg-language"/.test(detailsCard), 'language stays the existing select');
  assert.ok(!/typeahead/.test(detailsCard), 'Chinasa genre-language typeahead is not reinvented');
  assert.ok(/<option value="">Select language<\/option>/.test(detailsCard), 'language markup stays the existing empty first option');
  assert.ok(!/<option[^>]+selected/.test(detailsCard), 'English default is not a hardcoded selected option');
  assert.ok(store.includes("function defaultCreditsLanguageIfEmpty"), 'empty/new Credits language defaults in the existing binder');
  assert.ok(store.includes("setTypeaheadValue(language, 'en')"), 'English default uses the existing typeahead setter');
  assert.ok(!/setTypeaheadValue\(genre, 'en'\)|setTypeaheadValue\(genre, \"en\"\)/.test(store), 'Genre default is not changed');
  assert.ok(store.includes('if (genre && draft.genre) catalog.setTypeaheadValue(genre, draft.genre)'), 'Genre still only restores a held pick');
  assert.ok(store.includes("createOpt.value = '__create__'"), 'create stays on the one picker');
  assert.ok(store.includes("linkOpt.value = '__link__'"), 'import stays on the one picker');
  assert.ok(!/data-upload-save-draft/.test(upload), 'Save draft stays cancelled');
  assert.ok(!/Save draft/.test(upload + cut), 'Save draft copy is not invented');
  assert.ok(!/ToneGrid|DistroKid|distributor/i.test(upload.replace(/tonegrid\.js|store-client/g, '')), 'no distributor name invented');
  assert.ok(!/hop\.put|Photo Library|Cap invent/.test(cut + artistCard), 'no hop / attach invent');

  console.log('lib/upload-credits-tesla-cut.test.js ok');
}

run();
