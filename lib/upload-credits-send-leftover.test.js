'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function leftoverCss(css) {
  const start = css.indexOf('/* —— Upload leftover: quiet Credits/Send chips + Artist card —— */');
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

  assert.ok(upload.includes('site.css?v=20260912ca1'), 'Upload leftover cache-busts site.css at 20260912ca1');
  assert.ok(!upload.includes('site.css?v=20260912ae1'), 'ae1 stamp is retired on Upload');
  assert.strictEqual((upload.match(/href="site\.css\?v=/g) || []).length, 1, 'one site.css link only');

  assert.ok(/>Add audio</.test(upload), 'Add audio chip stays');
  assert.ok(/>Add cover</.test(upload), 'Add cover chip stays');
  assert.ok(/data-stage-chip="credits"[^>]*href="#upload-credits">Credits</.test(upload), 'Credits chip still hops to the existing credits card');
  assert.ok(/data-stage-chip="send"[^>]*href="#upload-send">Send</.test(upload), 'Send chip still hops to the existing send row');
  assert.ok(!/data-stage-chip="credits"[^>]*class="[^"]*btn/.test(upload), 'Credits is still a stage chip, not a new button');

  assert.ok(leftover.includes('.upload-page .stage-chip.chip-credits'), 'Credits chip is restyled on Upload only');
  assert.ok(leftover.includes('.upload-page .stage-chip.chip-send'), 'Send chip is restyled on Upload only');
  assert.ok(leftover.includes('background: transparent'), 'Credits/Send drop the charcoal stadium fill');
  assert.ok(leftover.includes('text-transform: none'), 'Credits/Send stop shouting all-caps');
  assert.ok(/\.chip-credits[\s\S]*?font-size:\s*11px/.test(leftover), 'Credits/Send use the quiet stage-chip type size');
  assert.ok(!leftover.includes('#0a0a0a') || leftover.indexOf('.stage-chip.chip-credits') < leftover.indexOf('#0a0a0a'), 'chip leftover does not refill charcoal pills');
  assert.ok(/\.chip-credits\.is-on[\s\S]*?var\(--stage-blue\)/.test(leftover), 'Credits lights Logo Blue only when that step is on');
  assert.ok(/\.chip-send\.is-on[\s\S]*?var\(--stage-gold\)/.test(leftover), 'Send lights Gold only when that step is on');
  assert.ok(!/chip-credits[\s\S]{0,220}var\(--stage-gold\)/.test(leftover.split('.chip-credits.is-on')[0]), 'idle Credits stays muted, not Gold');
  assert.ok(!/chip-send \{[\s\S]*?var\(--stage-gold\)/.test(leftover.split('.chip-send.is-on')[0]), 'idle Send stays muted, not Gold');
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
  assert.ok(!artistCard.includes('A new name is enough here'), 'store helper is not dumped into the card');
  assert.ok(leftover.includes('[data-upload-artist] h3'), 'Artist title is painted on the existing card');
  assert.ok(/\[data-upload-artist\] h3[\s\S]*?font-family:\s*"Space Grotesk"/.test(leftover), 'Artist title is Space Grotesk');
  assert.ok(/\[data-upload-artist\][\s\S]*?\[data-artist-copy\][\s\S]*?font-family:\s*Inter/.test(leftover), 'Artist helper stays Inter');
  assert.ok(/\[data-upload-artist\] \.field label[\s\S]*?text-transform:\s*none/.test(leftover), 'Artist field labels stop all-caps shout');
  assert.ok(/\[data-upload-artist\] \.field label[\s\S]*?font-weight:\s*500/.test(leftover), 'Artist field labels use quieter weight');
  assert.ok(leftover.includes('background: #0a0a0a'), 'Artist card stays a solid soft card');

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

  console.log('lib/upload-credits-send-leftover.test.js ok');
}

run();
