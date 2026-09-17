'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STAMP = '20260917s1';

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function teslaCutCss(css) {
  const start = css.indexOf('/* —— Submitted Tesla cut (calm confirm + hidden order uuid) —— */');
  assert.ok(start !== -1, 'Submitted Tesla-cut block is in site.css');
  return css.slice(start);
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

  assert.ok(html.includes('site.css?v=' + STAMP), 'Submitted cache-busts site.css at ' + STAMP);
  assert.ok(!html.includes('site.css?v=20260912ae1'), 'ae1 stamp is retired after the Submitted Tesla cut');
  assert.strictEqual((html.match(/href="site\.css\?v=/g) || []).length, 1, 'one site.css link only');
  assert.ok(html.includes('family=Space+Grotesk'), 'Space Grotesk loads');
  assert.ok(html.includes('family=Inter'), 'Inter stays loaded');
  assert.strictEqual((html.match(/fonts\.googleapis\.com\/css2/g) || []).length, 1, 'one Google Fonts link');

  assert.ok(html.includes('class="center-page wide submitted-page"'), 'Submitted scopes the Tesla cut');
  assert.ok(html.includes('class="submit-ok"'), 'quiet success check stays');
  assert.ok(!/status-ok lime|Submitted<\/p>/.test(html), 'screaming SUBMITTED lime banner is retired');
  assert.ok(!html.includes('class="lime"'), 'lime rainbow paint is off this page');
  assert.ok(html.includes('data-submit-title'), 'song title + in the queue hook stays');
  assert.ok(/Your song is in the queue\./.test(html), 'queue hero fallback stays');

  assert.ok(html.includes('class="submit-card"'), 'summary is one calm card');
  assert.ok(!html.includes('class="confirm-bar"'), 'four-up confirm bar is retired');
  assert.ok(html.includes('data-submit-release-date'), 'release date hook stays');
  assert.ok(html.includes('$0.00 · included in membership'), 'membership $0 line stays');
  assert.ok(html.includes('data-submit-stores'), 'stores hook stays for the live catalog count');
  assert.ok(html.includes('All stores in your plan'), 'empty catalog uses soft non-numeric copy');
  assert.ok(!/\b52\b|\b55\b|\b150\b|\b163\b|\b164\b/.test(html), 'page does not hardcode a store total');

  assert.ok(html.includes('Order details'), 'order uuid sits behind Order details');
  assert.ok(html.includes('data-submit-order'), 'order paint hook stays');
  assert.ok(html.includes('data-submit-order-copy'), 'order id copies on tap');
  assert.ok(html.includes('data-submit-order-box'), 'order details hide until a real id paints');
  assert.ok(!/>Order<\/small>/.test(html), 'raw ORDER label is not the hero');

  assert.ok((next.match(/<article>/g) || []).length === 3, 'What happens next is three beats');
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

  assert.ok(/\.submitted-page \.submit-ok i[\s\S]*?background:\s*#6f9d78/.test(cut), 'success check is a quiet green');
  assert.ok(/\.submitted-page h1[\s\S]*?font-family:\s*"Space Grotesk"/.test(cut), 'hero stays Space Grotesk');
  assert.ok(/\.submitted-page \.submit-card b[\s\S]*?font-family:\s*"Space Grotesk"/.test(cut), 'summary values stay Space Grotesk');
  assert.ok(/\.submitted-page \.submit-next h3[\s\S]*?font-family:\s*"Space Grotesk"/.test(cut), 'next titles stay Space Grotesk');
  assert.ok(cut.includes('var(--stage-gold)'), 'Copy hint uses Gold');
  assert.ok(cut.includes('var(--stage-purple)'), 'beat numbers use Purple');
  assert.ok(!/#A2FF00|#a2ff00/.test(cut + html), 'lime is off this cut');
  assert.ok(!/#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'neon green / orange stay off this cut');
  assert.ok(!/#d03083|#D03083/.test(cut), 'magenta stays off this cut');
  assert.ok(!/ToneGrid|DistroKid|distributor|hop\.put|Save draft/i.test(cut), 'cut does not invent hop / distributor copy');
  assert.ok(/grid-template-columns:\s*repeat\(3/.test(cut), 'desktop keeps three airy next cards');

  console.log('lib/submitted-tesla-cut.test.js ok');
}

run();
