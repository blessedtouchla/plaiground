'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STAMP = '20260917r1';

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function teslaCutCss(css) {
  const start = css.indexOf('/* —— Review Tesla energy (schedule + review, no Pay) —— */');
  assert.ok(start !== -1, 'Review Tesla-energy block is in site.css');
  return css.slice(start);
}

function visibleCopy(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function run() {
  const html = read('review.html');
  const css = read('site.css');
  const split = read('split-sheet.html');
  const submitted = read('submitted.html');
  const cut = teslaCutCss(css);
  const visible = visibleCopy(html);
  const storeClientAt = html.search(/src="store-client\.js\?v=/);

  assert.ok(html.includes('site.css?v=' + STAMP), 'Review cache-busts site.css at ' + STAMP);
  assert.ok(!html.includes('site.css?v=20260912ae1'), 'ae1 stamp is retired after the Review Tesla cut');
  assert.strictEqual((html.match(/href="site\.css\?v=/g) || []).length, 1, 'one site.css link only');
  assert.ok(html.includes('family=Space+Grotesk'), 'Space Grotesk loads');
  assert.ok(html.includes('family=Inter'), 'Inter stays loaded');

  assert.ok(html.includes('class="page wrap-wide upload-page"'), 'Review keeps Tesla progress paint');
  assert.ok(html.includes('<body class="review-page">'), 'body carries the energy scope');
  assert.ok(/<title>Schedule and review/.test(html), 'document title drops Pay');
  assert.ok(/<h1 class="review-kicker">Schedule and review<\/h1>/.test(html), 'H1 is Schedule and review');
  assert.ok(!/Review and pay|Review & Pay|Review and Pay/.test(visible), 'Pay is off this step');
  assert.ok(!/Pay and submit/.test(html), 'Pay CTA stays retired');

  assert.ok(html.includes('data-review-cover'), 'cover hook stays for store-client');
  assert.ok(html.includes('class="thumb review-cover"'), 'cover tile is the small hero');
  assert.ok(html.includes('data-review-title'), 'song title hook stays');
  assert.ok(html.includes('class="review-song"'), 'song title sits next to the cover');
  assert.ok(html.includes('data-review-meta'), 'artist/type meta stays');
  assert.ok(html.includes('data-review-genre'), 'genre paint hook stays');
  assert.ok(html.includes('data-review-language'), 'language paint hook stays');

  assert.ok(/<small>Out<\/small>/.test(html), 'street date is the Out highlight');
  assert.ok(html.includes('id="tg-release-date"'), 'release date input stays');
  assert.ok(html.includes('More schedule options'), 'pre-order and time sit behind More schedule options');
  assert.ok(html.includes('<details class="review-more">'), 'More schedule options is collapsed');
  assert.ok(!/<details class="review-more"[^>]*\sopen/.test(html), 'More schedule options is closed by default');
  assert.ok(html.includes('id="tg-preorder-on"') && html.includes('id="tg-time-on"'), 'schedule extras keep their existing switches');

  assert.ok(!html.includes('prescreen'), 'pre-screen card is gone');
  assert.ok(!/Pre-screen your audio|Run pre-screen|Optional · \$9\.99/.test(html), 'pre-screen upsell is gone');
  assert.ok(!/Due now[\s\S]*\$9\.99/.test(html), 'Due now does not invent a replacement upsell price');

  assert.ok(html.includes('Due now'), 'Due now heading stays');
  assert.ok(html.includes('$0.00'), 'Total is $0.00');
  assert.ok(html.includes('Included in membership. Nothing is charged on this screen.'), 'one membership footnote');
  assert.strictEqual((html.match(/Included in membership/g) || []).length, 1, 'membership included is said once');
  assert.ok(!/Publishing registration/.test(visible), 'Due now does not repeat publishing line items');
  assert.ok(!/Distribution\$0/.test(html), 'Distribution$0 space bug cannot return');
  assert.ok(html.includes('data-review-upsell'), 'existing Basic upgrade hook stays, not a new upsell');

  assert.ok(html.includes('All stores · included'), 'default stores copy is soft');
  assert.ok(html.includes('data-store-copy="included"'), 'live catalog can paint All N stores · included');
  assert.ok(html.includes('data-store-customize'), 'Customize stays the one store control');
  assert.ok(!html.includes('Pre-select all stores'), 'all-stores toggle is not a second control');
  assert.ok(!html.includes('Choose where it goes'), 'stores essay heading is retired');
  assert.ok(!/\b52\b|\b55\b|\b150\b|\b163\b|\b164\b/.test(html), 'page does not hardcode a store total');
  assert.ok(html.includes('data-store-all'), 'hidden all-stores switch stays for store-pick');

  assert.ok(html.includes('data-store-submit'), 'Submit hop stays');
  assert.ok(/data-store-submit[^>]*>Submit</.test(html), 'primary CTA stays Submit');
  assert.ok(html.includes('class="review-back"'), 'Back is quiet');
  assert.ok(/href="split-sheet.html">Back</.test(html), 'Back still returns to the split sheet');
  assert.ok(html.includes('data-plai-sticky'), 'sticky Submit bar lifts the PLAI chip');
  assert.ok(html.indexOf('data-store-submit') < html.indexOf('data-have-problem'), 'Have a problem? sits after Submit');

  assert.ok(split.includes('Continue to schedule and review'), 'Splits CTA drops Pay');
  assert.ok(!split.includes('Continue to review and pay'), 'old Pay CTA is retired on Splits');
  assert.ok(read('lib/split-solo-bind.js').includes('Continue to schedule and review'), 'solo continue drops Pay');

  assert.ok(html.includes('store-client.js?v=20260917a1'), 'submit hop stamp is unchanged');
  assert.ok(html.includes('lib/store-pick.js?v=' + STAMP), 'store-pick stamp matches the Review cut');
  assert.ok(html.includes('lib/object-hop.js?v=20260913b1'), 'object-hop stamp is unchanged');
  ['lib/cover-url.js', 'lib/cover-preview.js', 'lib/object-hop.js'].forEach(function (src) {
    assert.ok(html.indexOf('src="' + src) !== -1, 'Review loads ' + src + ' so the cover hero can resolve');
    assert.ok(html.indexOf('src="' + src) < storeClientAt, src + ' must load before store-client.js');
  });
  assert.ok(html.includes('data-require-membership="true"'), 'membership gate stays');

  assert.ok(/\.review-page \.review-cover[\s\S]*?width:\s*72px/.test(cut), 'cover stays a small hero tile');
  assert.ok(/\.review-page \.review-song[\s\S]*?font-family:\s*"Space Grotesk"/.test(cut), 'song title stays Space Grotesk');
  assert.ok(/\.review-page \.review-out \.field input\.date-picker[\s\S]*?font-size:\s*clamp\(1\.45rem/.test(cut), 'Out date is the schedule star');
  assert.ok(/\.review-page \.review-actions[\s\S]*?position:\s*sticky/.test(cut), 'Submit bar sticks');
  assert.ok(/\.review-page \.review-actions \.btn-gold[\s\S]*?var\(--stage-gold\)/.test(cut), 'Submit stays Gold');
  assert.ok(/\.review-page \.review-back[\s\S]*?color:\s*var\(--muted\)/.test(cut), 'Back stays quiet');
  assert.ok(cut.includes('accent-color: var(--muted)'), 'date fields do not scream Purple as primary');
  assert.ok(!/#A2FF00|#a2ff00/.test(cut + html), 'lime is off this cut');
  assert.ok(!/#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'neon green / orange stay off this cut');
  assert.ok(!/#d03083|#D03083/.test(cut), 'magenta stays off this cut');
  assert.ok(!/ToneGrid|DistroKid|distributor|hop\.put|Save draft/i.test(cut), 'cut does not invent hop / distributor copy');
  assert.ok(!/ToneGrid|DistroKid|distributor/i.test(visible), 'no distributor name in Review copy');

  assert.ok(submitted.includes('site.css?v=20260917s4'), 'Submitted Tesla stamp is not reverted');
  assert.ok(submitted.includes("You're all set. We're sending it to stores."), 'Submitted energy copy stays');
  assert.ok(!submitted.includes('class="submit-ok"'), 'Submitted check hero stays retired');

  console.log('lib/review-tesla-cut.test.js ok');
}

run();
