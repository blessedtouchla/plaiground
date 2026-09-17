'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STAMP = '20260917s2';

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function teslaCutCss(css) {
  const start = css.indexOf('/* —— Submitted Tesla energy (cover hero + one date + collapsed next) —— */');
  const end = css.indexOf('/* —— Signed-in nav Tesla cut');
  assert.ok(start !== -1, 'Submitted Tesla-energy block is in site.css');
  assert.ok(end !== -1 && end > start, 'Submitted energy block ends before the nav Tesla cut');
  return css.slice(start, end);
}

function visibleCopy(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function run() {
  const html = read('submitted.html');
  const css = read('site.css');
  const cut = teslaCutCss(css);
  const visible = visibleCopy(html);
  const next = html.slice(html.indexOf('What happens next'), html.indexOf('id="tg-status"'));
  const storeClientAt = html.search(/src="store-client\.js\?v=/);

  assert.ok(html.includes('site.css?v=' + STAMP), 'Submitted cache-busts site.css at ' + STAMP);
  assert.ok(!html.includes('site.css?v=20260917s1'), 's1 stamp is retired after the energy pass');
  assert.ok(!html.includes('site.css?v=20260912ae1'), 'ae1 stamp is retired after the Submitted Tesla cut');
  assert.strictEqual((html.match(/href="site\.css\?v=/g) || []).length, 1, 'one site.css link only');
  assert.ok(html.includes('family=Space+Grotesk'), 'Space Grotesk loads');
  assert.ok(html.includes('family=Inter'), 'Inter stays loaded');
  assert.strictEqual((html.match(/fonts\.googleapis\.com\/css2/g) || []).length, 1, 'one Google Fonts link');

  assert.ok(html.includes('class="center-page wide submitted-page"'), 'Submitted scopes the Tesla cut');
  assert.ok(html.includes('<body class="submitted-page">'), 'body carries the energy scope for the tiny logo');
  assert.ok(!html.includes('class="submit-ok"'), 'standalone success-check hero is retired');
  assert.ok(!/status-ok lime|Submitted<\/p>/.test(html), 'screaming SUBMITTED lime banner is retired');
  assert.ok(!html.includes('class="lime"'), 'lime rainbow paint is off this page');
  assert.ok(html.includes('data-submit-title'), 'queue paint hook stays for store-client');
  assert.ok(/<p hidden data-submit-title>Your song is in the queue\.<\/p>/.test(html), 'queue essay is hidden, not the hero');
  assert.ok(/<h1 data-submit-song>Your song<\/h1>/.test(html), 'visible title is the song name');
  assert.ok(html.includes('data-review-cover'), 'cover art uses the existing review cover hook');
  assert.ok(html.includes('class="submit-cover"'), 'cover tile is the hero');
  assert.ok(html.includes("You're all set. We're sending it to stores."), 'one calm confidence line stays');
  assert.ok(!/Thank You/.test(visible), 'thank-you essay stays off');

  assert.ok(!html.includes('class="submit-card"'), 'equal-weight summary card is retired');
  assert.ok(!html.includes('class="confirm-bar"'), 'four-up confirm bar is retired');
  assert.ok(/<small>Out<\/small>/.test(html), 'street date is the Out highlight');
  assert.ok(html.includes('data-submit-release-date'), 'release date hook stays');
  assert.ok(html.includes('$0.00 · included in membership'), 'membership $0 line stays');
  assert.ok(html.includes('class="submit-included"'), 'membership copy sits under order details');
  assert.ok(html.includes('data-submit-stores'), 'stores hook stays for the live catalog count');
  assert.ok(html.includes('All stores in your plan'), 'empty catalog uses soft non-numeric copy');
  assert.ok(!/\b52\b|\b55\b|\b150\b|\b163\b|\b164\b/.test(html), 'page does not hardcode a store total');

  assert.ok(html.includes('Order details'), 'order uuid sits behind Order details');
  assert.ok(html.includes('data-submit-order'), 'order paint hook stays');
  assert.ok(html.includes('data-submit-order-copy'), 'order id copies on tap');
  assert.ok(html.includes('data-submit-order-box'), 'order details hide until a real id paints');
  assert.ok(!/>Order<\/small>/.test(html), 'raw ORDER label is not the hero');

  assert.ok(html.includes('<details class="submit-next">'), 'What happens next is a collapsed accordion');
  assert.ok((next.match(/<article>/g) || []).length === 0, 'essay next cards are not the main scroll');
  assert.ok(!html.includes('class="next-4"'), 'four-up next grid is retired');
  assert.ok(next.includes('Content scan'), 'beat 01 is content scan');
  assert.ok(next.includes('Review and QC'), 'beat 02 is review/QC');
  assert.ok(next.includes('Live on stores'), 'beat 03 is live on stores');
  assert.ok(next.includes('data-submit-writers'), 'writers paint hook stays on beat 02');
  assert.ok(next.includes('data-submit-deliver-date'), 'deliver date paint hook stays on beat 03');
  assert.ok(!/PLAI|PLAY/.test(next), 'PLAI is not bolted onto the beats');
  assert.ok(!/ToneGrid|DistroKid|distributor/i.test(visible), 'no distributor name in confirmation copy');

  assert.ok(html.includes('Back to Overview'), 'primary CTA matches Overview');
  assert.ok(/href="dashboard.html">Back to Overview</.test(html), 'Back to Overview keeps dashboard.html');
  assert.ok(/href="upload.html"[^>]*>New release</.test(html), 'New release keeps upload.html');
  assert.ok(html.includes('data-new-release'), 'New release uses the existing fresh-start hook');
  assert.ok(!html.includes('Back to dashboard'), 'dashboard wording is retired');
  assert.ok(!html.includes('View this song'), 'second button is retired');
  assert.ok(!html.includes('Download receipt'), 'receipt ghost link is retired');
  assert.ok(html.indexOf('Back to Overview') < html.indexOf('data-have-problem'), 'Have a problem? sits after the primary CTA');
  assert.ok(!html.includes('plai-bubble.js'), 'floating PLAI chip is off this page');
  assert.ok(!html.includes('plai-bubble.css'), 'PLAI chip chrome is off this page');

  assert.ok(html.includes('store-client.js?v=20260912a3'), 'submit hop stamp is unchanged');
  assert.ok(html.includes('lib/store-pick.js?v=20260912a2'), 'store-pick stamp is unchanged');
  assert.ok(html.includes('lib/upload-required.js'), 'upload-required stays');
  assert.ok(html.includes('data-require-membership="true"'), 'membership gate stays');
  ['lib/cover-url.js', 'lib/cover-preview.js', 'lib/object-hop.js'].forEach(function (src) {
    assert.ok(html.indexOf('src="' + src) !== -1, 'Submitted loads ' + src + ' so the cover hero can resolve');
    assert.ok(html.indexOf('src="' + src) < storeClientAt, src + ' must load before store-client.js');
  });

  assert.ok(/body\.submitted-page \.flow-top \.logo img[\s\S]*?height:\s*22px/.test(cut), 'logo stays tiny so cover can be the hero');
  assert.ok(/\.submitted-page \.submit-cover[\s\S]*?width:\s*min\(78vw, 320px\)/.test(cut), 'cover is the almost-above-the-fold star');
  assert.ok(/\.submitted-page \.submit-out b[\s\S]*?font-size:\s*clamp\(2rem/.test(cut), 'Out date is larger than Total paid / Stores');
  assert.ok(/\.submitted-page \.submit-quiet-row span[\s\S]*?font-size:\s*13px/.test(cut), 'Total paid / Stores stay quiet');
  assert.ok(/\.submitted-page \.submit-hero h1[\s\S]*?font-family:\s*"Space Grotesk"/.test(cut), 'song title stays Space Grotesk');
  assert.ok(/\.submitted-page \.submit-dots b[\s\S]*?font-family:\s*"Space Grotesk"/.test(cut), 'collapsed next titles stay Space Grotesk');
  assert.ok(cut.includes('var(--stage-gold)'), 'Copy hint uses Gold');
  assert.ok(cut.includes('var(--stage-purple)'), 'timeline dots use quiet Purple');
  assert.ok(!/#A2FF00|#a2ff00/.test(cut + html), 'lime is off this cut');
  assert.ok(!/#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'neon green / orange stay off this cut');
  assert.ok(!/#d03083|#D03083/.test(cut), 'magenta stays off this cut');
  assert.ok(!/ToneGrid|DistroKid|distributor|hop\.put|Save draft/i.test(cut), 'cut does not invent hop / distributor copy');
  assert.ok(!/grid-template-columns:\s*repeat\(3/.test(cut), 'three equal next cards stay collapsed');
  assert.ok(!/\.submit-ok i/.test(cut), 'green check is no longer the emotional hero');

  console.log('lib/submitted-tesla-cut.test.js ok');
}

run();
