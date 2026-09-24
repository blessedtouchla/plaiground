'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STAMP = '20260917ar1';
const ARTISTS_STAMP = '20260922ar3';
const NAV_STAMP = '20260917pl2';
const SUBMITTED_STAMP = '20260917s5';

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function teslaCutCss(css) {
  const start = css.indexOf('/* —— Artist Profiles Tesla energy (roster wall + overflow + collapsed lecture) —— */');
  assert.ok(start !== -1, 'Artist Profiles Tesla-energy block is in site.css');
  const end = css.indexOf('/* —— Attest Tesla energy', start + 1);
  return end === -1 ? css.slice(start) : css.slice(start, end);
}

function visibleCopy(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function run() {
  const html = read('artists.html');
  const css = read('site.css');
  const js = read('artists.js');
  const store = read('store-client.js');
  const upload = read('upload.html');
  const cut = teslaCutCss(css);
  const visible = visibleCopy(html);
  const listFn = js.slice(js.indexOf('function renderList()'), js.indexOf('function setEditingScreen'));
  const sideNav = html.match(/<nav class="side-nav">[\s\S]*?<\/nav>/);
  const submitted = read('submitted.html');
  const dash = read('dashboard.html');

  assert.ok(html.includes('site.css?v=' + ARTISTS_STAMP), 'Artist Profiles cache-busts site.css at ' + ARTISTS_STAMP);
  assert.ok(!html.includes('site.css?v=' + NAV_STAMP), 'pl2 stamp is retired on Artist Profiles after the energy pass');
  assert.ok(!html.includes('site.css?v=' + STAMP), 'old ar1 site.css stamp is retired on Artist Profiles after persona education');
  assert.strictEqual((html.match(/href="site\.css\?v=/g) || []).length, 1, 'one site.css link only');
  assert.ok(html.includes('family=Space+Grotesk'), 'Space Grotesk loads');
  assert.ok(html.includes('family=Inter'), 'Inter stays loaded');
  assert.ok(html.includes('artists.js?v=' + ARTISTS_STAMP), 'Artist Profiles cache-busts artists.js');
  assert.ok(!html.includes('artists.js?v=20260915r2'), 'r2 artists.js stamp is retired');
  assert.ok(!html.includes('artists.js?v=' + STAMP), 'old ar1 artists.js stamp is retired');

  assert.ok(sideNav, 'signed-in drawer stays');
  assert.ok(/<p class="side-label">Create<\/p>/.test(sideNav[0]), 'Create stays');
  assert.ok(/<p class="side-label">Money<\/p>/.test(sideNav[0]), 'Money stays');
  assert.ok(/<p class="side-label">PLAI<\/p>/.test(sideNav[0]), 'PLAI stays');
  assert.ok(/<p class="side-label">Account<\/p>/.test(sideNav[0]), 'Account stays');
  assert.ok(/data-plai-talk[^>]*>Talk to PLAI</.test(sideNav[0]), 'Talk to PLAI stays');
  assert.ok(/data-plai-text[^>]*>Text to PLAI</.test(sideNav[0]), 'Text to PLAI stays');
  assert.ok(/data-new-release data-signed-in-upload>New release</.test(sideNav[0]), 'gold New release stays');

  assert.ok(submitted.includes('site.css?v=' + SUBMITTED_STAMP), 'Submitted Tesla energy stamp is not reverted');
  assert.ok(dash.includes('site.css?v=' + NAV_STAMP), 'Overview keeps the nav Tesla stamp');

  assert.ok(html.includes('<h1>Artist Profiles</h1>'), 'title stays');
  assert.ok(html.includes('class="artists-help"'), 'lecture sits under ?');
  assert.ok(html.includes('Create the artist once. Later songs pick that profile.'), 'one helper stays under ?');
  assert.ok(html.includes('class="artists-act-edu"'), 'Act, not just files panel sits on Artist Profiles');
  assert.ok(/Act, not just files/.test(visible), 'persona education summary is visible in markup');
  assert.ok(/Streaming rewards people and acts/.test(html), 'panel explains acts over files');
  assert.ok(/consistent persona helps discovery/i.test(html), 'panel explains persona discovery');
  assert.ok(/Locked look/.test(html) && /First-person bio/.test(html) && /Origin story/.test(html), 'checklist teaser stays');
  assert.ok(/Consistent covers/.test(html) && /Platform-native clips before dumping tracks/.test(html), 'checklist covers clips before dumps');
  assert.ok(/Human<\/strong>\s*·\s*<strong>AI-infused<\/strong>/.test(html), 'disclosure classes name AI-infused');
  assert.ok(/Fully AI/.test(html), 'Fully AI stays available on profile education');
  assert.ok(/No secret-human AI/.test(html) && /No fake trauma bios/.test(html), 'soft-stops stay on the panel');
  assert.ok(!/guaranteed #1|we guarantee (placement|streams|playlists)/i.test(html), 'no hype placement promise');
  assert.ok(/href="ar\.html">A&R · EPK included</.test(html), 'panel links A&R');
  assert.ok(/href="epk\.html">What’s in an EPK</.test(html), 'panel links EPK');
  assert.ok(!/href="transparency\.html"/.test(html), 'no transparency link until that page exists on this HOLD');
  assert.ok(html.includes('class="artists-fill-guide"'), 'edit flow has How to fill this out guide');
  assert.ok(/How to fill this out/.test(html), 'fill guide summary stays');
  assert.ok(/data-artist-class-pick/.test(html) && /AI-infused/.test(html), 'profile class picks Human / AI-infused');
  assert.ok(/data-artist-ai-mix/.test(html) && /data-ai-mix="lyrics"/.test(html), 'AI-infused mix breakdown sits on edit');
  assert.ok(/Avatar \/ persona kit coming/.test(html), 'avatar designer stays deferred with a note');
  assert.ok(html.includes('data-artist-photo-pick') && html.includes('id="artist-photo"'), 'photo upload reuses existing pattern');
  assert.ok(html.includes('class="artists-act-edu-lite"'), 'preview keeps a one-line act cue');
  assert.ok(!html.includes('class="kicker">Release names'), 'Release names kicker is retired');
  assert.ok(!html.includes('After first live, the store page stays attached.'), 'second lecture paragraph is off the fold');
  assert.ok(!html.includes('Click a profile to preview it. Edit is left of Delete.'), 'list lecture is retired');
  assert.ok(!/Create the artist once[\s\S]*After first live[\s\S]*Import or merge here, not on submit\./.test(
    html.slice(html.indexOf('<h1>Artist Profiles</h1>'), html.indexOf('data-artists-status'))
  ), 'three process paragraphs are not above the fold');

  assert.ok(/class="btn btn-gold btn-sm"[^>]*data-artist-add>Add artist</.test(html), 'Add artist is gold primary');
  assert.ok(/class="btn btn-ghost btn-sm"[^>]*data-artist-import>Import Artist</.test(html), 'Import Artist stays outline');

  assert.ok(html.includes('data-artist-preview'), 'Preview hook stays');
  const previewChunk = html.slice(html.indexOf('data-artist-preview'), html.indexOf('class="artist-edit-screen"'));
  assert.ok(/data-artist-edit-open[\s\S]*data-artist-delete/.test(previewChunk), 'Preview Edit stays left of Delete');
  assert.ok(previewChunk.includes('data-artist-preview-release'), 'Preview keeps New release with…');
  assert.ok(previewChunk.includes('data-new-release'), 'Preview release uses the existing fresh-start hook');
  assert.ok(previewChunk.includes('data-signed-in-upload'), 'Preview release uses the existing signed-in upload hook');

  assert.ok(listFn.includes('artist-card'), 'roster renders photo cards');
  assert.ok(listFn.includes('artist-card-photo'), 'cards show a photo or avatar');
  assert.ok(listFn.includes('artist-card-name'), 'stage name sits on the card');
  assert.ok(listFn.includes("textContent = 'New release with…'"), 'each card has New release with…');
  assert.ok(js.includes('upload.html?artist='), 'card release uses the existing upload artist pick');
  assert.ok(listFn.includes("setAttribute('data-new-release'"), 'card release uses the existing New release hook');
  assert.ok(listFn.includes("setAttribute('data-signed-in-upload'"), 'card release uses the existing signed-in upload hook');
  assert.ok(listFn.includes('artist-card-more'), 'Edit/Delete sit in overflow');
  assert.ok(listFn.indexOf("textContent = 'Edit'") < listFn.indexOf("textContent = 'Delete'"), 'overflow Edit stays left of Delete');
  assert.ok(!listFn.includes('artist-row-wrap'), 'full-width name bars are retired');
  assert.ok(!listFn.includes('artist-row-actions'), 'twin Edit/Delete pills are off the list');
  assert.ok(!listFn.includes('PLAIGROUND'), 'list must not render a leftover site chip');

  assert.ok(store.includes("get('artist')"), 'Upload picker honors ?artist= from Artist Profiles');
  assert.ok(store.includes('function queryPickedArtist'), 'artist prefill stays on the existing picker');
  assert.ok(upload.includes('store-client.js?v=' + STAMP), 'Upload cache-busts store-client after the artist pick');
  assert.ok(!upload.includes('store-client.js?v=20260915r2'), 'r2 store-client stamp is retired on Upload');
  assert.ok(!js.includes('object-hop'), 'Artist Profiles does not invent hop');
  assert.ok(!js.includes('store-client'), 'Artist Profiles does not load store-client');

  assert.ok(/\.artists-page \.artist-list \{[\s\S]*?grid-template-columns:\s*repeat\(2/.test(cut), 'phone roster is a 2-up card grid');
  assert.ok(/\.artists-page \.artist-list \{[\s\S]*?grid-template-columns:\s*repeat\(4/.test(cut), 'desktop roster is a 4-up card grid');
  assert.ok(/\.artists-page \.artist-card-photo \{[\s\S]*?aspect-ratio:\s*1/.test(cut), 'cards are photo tiles');
  assert.ok(/\.artists-page \.artist-card-name \{[\s\S]*?font-family:\s*"Space Grotesk"/.test(cut), 'stage names stay Space Grotesk');
  assert.ok(/\.artists-page \.artist-card-release[\s\S]*?color:\s*#f3cb47/.test(cut), 'New release with… is quiet gold');
  assert.ok(/\.artists-page \.page-head-actions \[data-artist-add\] \{[\s\S]*?background:\s*#f3cb47/.test(cut), 'Add artist is gold #F3CB47');
  assert.ok(cut.includes('#782fb1') || cut.includes('120, 47, 177'), 'selected card uses Purple #782FB1');
  assert.ok(/\.artists-page \.artist-card-more summary \{[\s\S]*?width:\s*44px/.test(cut), 'overflow stay phone-safe');
  assert.ok(/\.artists-page \.artist-card-menu button \{[\s\S]*?min-height:\s*44px/.test(cut), 'overflow Edit/Delete stay phone-safe');
  assert.ok(!/#A2FF00|#a2ff00/.test(cut), 'lime stays off this cut');
  assert.ok(!/#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'neon green / orange stay off this cut');
  assert.ok(!/#d03083|#D03083/.test(cut), 'magenta stays off this cut');
  assert.ok(!/ToneGrid|DistroKid|distributor|hop\.put|inventory|SKU|price-tag/i.test(cut), 'cut does not invent hop / distributor / inventory chrome');
  assert.ok(!/ToneGrid|DistroKid/i.test(visible), 'no distributor name in Artist Profiles copy');
  assert.ok(!/Spotify|Apple Music|YouTube Music/.test(visible.replace(/SIQA Charts/g, '')), 'page does not invent store names in the lecture');
  assert.ok(/#f3cb47/i.test(cut) && /#782fb1/i.test(cut), 'persona education uses gold and purple');
  assert.ok(cut.includes('artists-act-edu'), 'persona education styles sit in the Tesla cut');

  console.log('lib/artists-tesla-cut.test.js ok');
}

run();
