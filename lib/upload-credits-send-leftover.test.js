'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function leftoverCss(css) {
  const start = css.indexOf('/* —— Upload leftover: tiny side Credits/Send steps + Artist card —— */');
  assert.ok(start !== -1, 'leftover chrome block is in site.css');
  return css.slice(start);
}

function run() {
  const upload = read('upload.html');
  const css = read('site.css');
  const leftover = leftoverCss(css);
  const stage = read('lib/upload-stage.js');
  const store = read('store-client.js');
  const artistCard = upload.slice(
    upload.indexOf('data-upload-artist'),
    upload.indexOf('id="tg-artist"')
  );

  assert.ok(upload.includes('site.css?v=20260912cr1'), 'Upload Credits Tesla cut cache-busts site.css at 20260912cr1');
  assert.ok(!upload.includes('site.css?v=20260912ca2'), 'ca2 stamp is retired after the Credits Tesla cut');
  assert.ok(!upload.includes('site.css?v=20260912ca1'), 'ca1 stamp is retired after the tiny-step leftover');
  assert.ok(!upload.includes('site.css?v=20260912ae1'), 'ae1 stamp is retired on Upload');
  assert.strictEqual((upload.match(/href="site\.css\?v=/g) || []).length, 1, 'one site.css link only');

  assert.ok(/>Add audio</.test(upload), 'Add audio chip stays');
  assert.ok(/>Add cover</.test(upload), 'Add cover chip stays');
  assert.ok(/<span class="stage-step chip-credits" data-stage-chip="credits">Credits<\/span>/.test(upload), 'Credits is inert step text');
  assert.ok(/<span class="stage-step chip-send" data-stage-chip="send">Send<\/span>/.test(upload), 'Send is inert step text');
  assert.ok(!/data-stage-chip="credits"[^>]*href=/.test(upload), 'Credits has no href hop');
  assert.ok(!/data-stage-chip="send"[^>]*href=/.test(upload), 'Send has no href hop');
  assert.ok(!/<a[^>]*data-stage-chip="credits"/.test(upload), 'Credits is not a link');
  assert.ok(!/<a[^>]*data-stage-chip="send"/.test(upload), 'Send is not a link');
  assert.ok(!/<button[^>]*data-stage-chip="credits"/.test(upload), 'Credits is not a button');
  assert.ok(!/<button[^>]*data-stage-chip="send"/.test(upload), 'Send is not a button');
  assert.ok(!/class="stage-chip chip-credits"/.test(upload), 'Credits left the CTA chip class');
  assert.ok(!/class="stage-chip chip-send"/.test(upload), 'Send left the CTA chip class');

  assert.ok(leftover.includes('.upload-page .stage-step.chip-credits'), 'Credits step is restyled on Upload only');
  assert.ok(leftover.includes('.upload-page .stage-step.chip-send'), 'Send step is restyled on Upload only');
  assert.ok(leftover.includes('pointer-events: none'), 'Credits/Send are not clickable');
  assert.ok(leftover.includes('cursor: default'), 'Credits/Send do not look actionable');
  assert.ok(leftover.includes('letter-spacing: 0.18em'), 'Credits/Send match progress-line tracking');
  assert.ok(leftover.includes('text-transform: uppercase'), 'Credits/Send match progress-line case');
  assert.ok(/\.stage-step\.chip-credits,[\s\S]*?font-size:\s*11px/.test(leftover), 'Credits/Send use the tiny progress type size');
  assert.ok(!leftover.includes('border-radius: 999px'), 'Credits/Send are not stadium pills');
  assert.ok(!leftover.includes('var(--stage-gold)'), 'Gold chip paint stays off Credits/Send');
  assert.ok(/\.chip-credits\.is-on,[\s\S]*?color:\s*var\(--stage-blue\)/.test(leftover), 'active Credits/Send is Logo Blue');
  assert.ok(!leftover.includes('border-color: var(--stage-blue)'), 'Logo Blue is step text, not a chip outline');
  assert.ok(!leftover.includes('#d03083') && !leftover.includes('var(--stage-magenta)'), 'Magenta stays off leftover chrome');
  assert.ok(!/#3[Ff][Ee]07[Aa]|#F09416/.test(leftover), 'Green/Orange stay off leftover chrome');

  const brandStart = css.indexOf('/* —— Upload brand accents (Tesla leftover: sparse purple/gold) —— */');
  const sleeveQuietStart = css.indexOf('/* —— Upload sleeve helper quiet (chips + BUILDING YOUR RELEASE stay) —— */');
  const brandCss = brandStart === -1 ? '' : css.slice(brandStart, sleeveQuietStart === -1 ? css.length : sleeveQuietStart);
  assert.ok(brandCss.includes('.upload-page .stage-chip.chip-audio'), 'Add audio Tesla gold stays');
  assert.ok(brandCss.includes('.upload-page .stage-chip.chip-cover'), 'Add cover Tesla gold stays');

  assert.ok(/<h3>Artist<\/h3>/.test(artistCard), 'Artist card title stays Artist');
  assert.ok(artistCard.includes('Choose who this song is released under. Profiles hold photo, bio, and genres.'), 'helper keeps the existing idea, shortened');
  assert.ok(!artistCard.includes('Artist name is the public name stores show.'), 'shouty helper line is retired');
  assert.ok(leftover.includes('[data-upload-artist] h3'), 'Artist title is painted on the existing card');
  assert.ok(/\[data-upload-artist\] h3[\s\S]*?font-family:\s*"Space Grotesk"/.test(leftover), 'Artist title is Space Grotesk');
  assert.ok(/\[data-upload-artist\][\s\S]*?\[data-artist-copy\][\s\S]*?font-family:\s*Inter/.test(leftover), 'Artist helper stays Inter');
  assert.ok(/\[data-upload-artist\] \.field label[\s\S]*?text-transform:\s*none/.test(leftover), 'Artist field labels stop all-caps shout');
  assert.ok(/\.upload-credits-card \.field label[\s\S]*?text-transform:\s*none/.test(leftover), 'Credits labels stop all-caps shout');
  assert.ok(leftover.includes('background: #0a0a0a'), 'Artist card stays a solid soft card');
  assert.ok(/data-artist-mode-field hidden/.test(artistCard), 'mode dropdown stays wired but is not a second picker');
  assert.ok(/<label for="tg-artist-select" class="sr-only">Artist<\/label>/.test(artistCard), 'one quiet artist dropdown');
  assert.ok(!/<label for="tg-artist-select">Choose artist profile<\/label>/.test(artistCard), 'duplicate Choose artist profile label is retired');

  assert.ok(upload.includes('id="tg-artist-mode"'), 'existing artist mode field stays');
  assert.ok(upload.includes('id="tg-artist-select"'), 'existing artist picker stays');
  assert.ok(upload.includes('id="tg-artist-new"'), 'existing create-name field stays');
  assert.ok(upload.includes('data-upload-go-artists'), 'existing Artist Profiles hop stays — not invented here');
  assert.ok(!/data-upload-save-draft/.test(upload), 'Save draft stays cancelled');
  assert.ok(!/Save draft/.test(upload + leftover), 'Save draft copy is not invented');
  assert.ok(!/ToneGrid|DistroKid|distributor/i.test(upload.replace(/tonegrid\.js|store-client/g, '')), 'no distributor name invented');
  assert.ok(!/hop\.put|create-artist|Photo Library|Cap invent/.test(leftover + artistCard), 'no hop / attach / Cap / Photo Library invent');
  assert.ok(stage.includes('Does not hop'), 'stage helper still documents the soft-stop');
  assert.ok(!/hop\.put|create-artist/.test(stage), 'stage helper still does not invent hop');
  assert.ok(stage.includes("chip.classList.toggle('is-on'"), 'existing is-on paint stays — no new chip wiring');

  assert.ok(store.includes('Choose who this song is released under. Profiles hold photo, bio, and genres.'), 'single helper shorten is shared with the live paint');
  assert.ok(store.includes('Choose who this album is released under. Profiles hold photo, bio, and genres.'), 'album helper shorten keeps the same idea');
  assert.ok(!store.includes('A new name is enough here'), 'longer helper lecture is retired');
  assert.ok(store.includes("createOpt.value = '__create__'"), 'create stays an option on the one picker — not a second dropdown');
  assert.ok(store.includes("linkOpt.value = '__link__'"), 'import stays an option on the one picker — not a second dropdown');
  assert.ok(store.includes("setBoxHidden('artist-choose-wrap', false)"), 'the one picker stays visible in create/import');
  assert.ok(/<select id="tg-genre"/.test(upload), 'genre stays the existing select');
  assert.ok(/<select id="tg-language"/.test(upload), 'language stays the existing select');
  assert.ok(!/id="tg-genre"[^>]*typeahead|id="tg-language"[^>]*typeahead/.test(upload), 'genre/language typeahead is not reinvented');

  console.log('lib/upload-credits-send-leftover.test.js ok');
}

run();
