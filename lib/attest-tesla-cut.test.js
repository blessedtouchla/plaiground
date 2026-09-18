'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STAMP = '20260917at3';
const JS_STAMP = '20260918vn1';
const REVIEW_STAMP = '20260917r2';
const SUBMITTED_STAMP = '20260917s5';
const ARTISTS_STAMP = '20260917ar1';
const NAV_STAMP = '20260917pl2';

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function teslaCutCss(css) {
  const start = css.indexOf('/* —— Attest Tesla energy (rights confirmation + honest status + sticky dock) —— */');
  assert.ok(start !== -1, 'Attest Tesla-energy block is in site.css');
  return css.slice(start);
}

function visibleCopy(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function run() {
  const html = read('attest.html');
  const css = read('site.css');
  const js = read('attest.js');
  const cut = teslaCutCss(css);
  const visible = visibleCopy(html);
  const review = read('review.html');
  const submitted = read('submitted.html');
  const artists = read('artists.html');
  const dash = read('dashboard.html');
  const blog = read('blog.html');
  const rightsBlock = html.slice(html.indexOf('attest-rights-card'), html.indexOf('attest-actions'));

  assert.ok(html.includes('site.css?v=' + STAMP), 'Attest cache-busts site.css at ' + STAMP);
  assert.ok(html.includes('attest.js?v=' + JS_STAMP), 'Attest cache-busts attest.js at ' + JS_STAMP);
  assert.ok(!html.includes('site.css?v=20260917at2'), 'at2 stamp is retired after the quiet-line leftover');
  assert.ok(!html.includes('site.css?v=20260917at1'), 'at1 stamp is retired after the in-flow helper leftover');
  assert.ok(!html.includes('site.css?v=20260912ae1'), 'ae1 stamp is retired after the Attest Tesla cut');
  assert.ok(!html.includes('attest.js?v=20260906c1'), 'c1 attest.js stamp is retired');
  assert.strictEqual((html.match(/href="site\.css\?v=/g) || []).length, 1, 'one site.css link only');
  assert.ok(html.includes('family=Space+Grotesk'), 'Space Grotesk loads');
  assert.ok(html.includes('family=Inter'), 'Inter stays loaded');

  assert.ok(html.includes('<body class="attest-page">'), 'body carries the energy scope');
  assert.ok(html.includes('class="page wrap-wide upload-page"'), 'Attest keeps Tesla progress paint');
  assert.ok(/<title>Rights confirmation/.test(html), 'document title is Rights confirmation');
  assert.ok(/<h1 class="attest-kicker">Rights confirmation<\/h1>/.test(html), 'H1 is Rights confirmation');
  assert.ok(!html.includes('data-upload-kicker'), 'journey kicker is not overwritten by Submit a song');
  assert.ok(!html.includes('Required by most stores'), 'stores lecture kicker is retired');
  assert.ok(!/Answer honestly and your release clears review/.test(html), 'made-how lecture is retired');
  assert.ok(html.includes('Full AI tracks are accepted.'), 'one quiet made-how line stays');

  assert.ok(html.includes('Pick everything a person did.'), 'one quiet contribution line stays');
  assert.ok(!html.includes('class="attest-help"'), 'contribution ? overlay is retired after the wrap leftover');
  assert.ok(!html.includes('A couple of sentences is plenty.'), 'second helper sentence is retired');
  assert.ok(!html.includes('Pick everything a person did on this record.'), 'fold lecture is retired');
  assert.ok(!html.includes('Reviewers read this when a track is flagged.'), 'reviewer lecture is retired');

  assert.ok(/<label class="checkline"[\s\S]*<span>[\s\S]*<a href="rights.html">rights attestation<\/a>[\s\S]*<a href="terms.html">terms of service<\/a>\.<\/span>/.test(html), 'one flowing checkbox sentence with inline links');
  assert.ok(!/style="color:var\(--purple-bright\)"/.test(rightsBlock), 'rights links are not pulled into a floating column');
  assert.ok(html.includes('data-rights-nudge'), 'unchecked yellow nudge stays');
  assert.ok(html.includes('data-rights-ok'), 'checked quiet Accepted stays');
  assert.ok(/data-rights-ok hidden/.test(html), 'Accepted starts hidden');
  assert.ok(!/Not yet accepted/.test(html), 'always-on accepted lecture is retired');
  assert.ok(js.includes('syncRightsStatus'), 'attest.js keeps one honest rights status');
  assert.ok(/setHiddenEl\(rightsNudge, checked\)/.test(js), 'checked hides the yellow nudge');
  assert.ok(/setHiddenEl\(rightsOk, !checked\)/.test(js), 'unchecked hides Accepted');

  assert.ok(!html.includes('plai-bubble.js'), 'floating PLAI chip stays off attest.html');
  assert.ok(!html.includes('plai-bubble.css'), 'PLAI chip chrome stays off attest.html');
  assert.ok(/body\.attest-page \.plai-bubble-chip[\s\S]*?display:\s*none/.test(cut), 'attest CSS hides leftover PLAI chip');

  assert.ok(/class="flow-actions attest-actions"/.test(html), 'Continue sits in a dock');
  assert.ok(html.includes('class="attest-back"'), 'Back is quiet');
  assert.ok(/href="upload.html">Back</.test(html), 'Back still returns to Upload');
  assert.ok(html.includes('data-attest-continue'), 'Continue hop stays');
  assert.ok(html.includes('Continue to writers and splits'), 'default Continue copy stays');
  assert.ok(html.indexOf('data-attest-continue') < html.indexOf('data-have-problem'), 'Have a problem? sits after Continue');
  assert.ok(!js.includes('/api/signwell'), '100% attest must not create SignWell');
  assert.ok(html.includes('store-client.js?v=20260912a2'), 'store-client stamp is unchanged');
  assert.ok(html.includes('data-require-membership="true"'), 'membership gate stays');

  assert.ok(review.includes('site.css?v=' + REVIEW_STAMP), 'Schedule and review Tesla stamp is not reverted');
  assert.ok(submitted.includes('site.css?v=' + SUBMITTED_STAMP), 'Submitted Tesla stamp is not reverted');
  assert.ok(artists.includes('site.css?v=' + ARTISTS_STAMP), 'Artist Profiles Tesla stamp is not reverted');
  assert.ok(dash.includes('site.css?v=' + NAV_STAMP), 'signed-in nav Tesla stamp is not reverted');
  assert.ok(/Twenty posts|post 20|NO FAKES/i.test(blog) || blog.includes('blog-no-fakes.html'), 'blog Twenty is not reverted');
  assert.ok(/<p class="side-label">PLAI<\/p>\s*<button[^>]*data-plai-talk[^>]*>Talk to PLAI<\/button>\s*<button[^>]*data-plai-text[^>]*>Text to PLAI<\/button>/.test(dash), '#290 Talk/Text stay in the PLAI menu');

  assert.ok(/\.attest-page \.checkline span[\s\S]*?display:\s*block/.test(cut), 'rights sentence is one flowing column');
  assert.ok(/\.attest-page \.checkline a[\s\S]*?display:\s*inline/.test(cut), 'rights links stay inline');
  assert.ok(/\.attest-page \.attest-actions[\s\S]*?position:\s*sticky/.test(cut), 'Continue bar sticks');
  assert.ok(/\.attest-page \.attest-actions[\s\S]*?background:\s*#000/.test(cut), 'sticky bar is a solid dock');
  assert.ok(/body\.attest-page \.flow-top \.logo img[\s\S]*?height:\s*22px/.test(cut), 'logo stays tiny so the dock can be the chrome');
  assert.ok(/\.attest-page \.flow-card > \.hint[\s\S]*?font-size:\s*13px/.test(cut), 'contribution helper is one quiet line');
  assert.ok(/body\.attest-page main\.page[\s\S]*?padding-bottom:\s*168px/.test(cut), 'page clears the sticky Continue dock');
  assert.ok(/\.attest-page \.attest-actions \.btn-gold[\s\S]*?var\(--stage-gold\)/.test(cut), 'Continue stays Gold');
  assert.ok(/\.attest-page \.attest-actions \.btn-gold[\s\S]*?white-space:\s*normal/.test(cut), 'Continue label stays readable');
  assert.ok(/\.attest-page \.attest-actions \.btn-gold\.is-incomplete[\s\S]*?opacity:\s*1/.test(cut), 'incomplete Gold stays readable');
  assert.ok(/\.attest-page \.attest-back[\s\S]*?color:\s*var\(--muted\)/.test(cut), 'Back stays quiet');
  assert.ok(/\.attest-page \.attest-rights-nudge[\s\S]*?var\(--yellow\)/.test(cut), 'unchecked nudge is yellow');
  assert.ok(/\.attest-page \.attest-rights-ok[\s\S]*?var\(--muted\)/.test(cut), 'Accepted stays quiet');
  assert.ok(!/#A2FF00|#a2ff00/.test(cut + html), 'lime is off this cut');
  assert.ok(!/#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'neon green / orange stay off this cut');
  assert.ok(!/#d03083|#D03083/.test(cut), 'magenta stays off this cut');
  assert.ok(!/ToneGrid|DistroKid|distributor|hop\.put|Save draft/i.test(cut), 'cut does not invent hop / distributor copy');
  assert.ok(!/ToneGrid|DistroKid|distributor/i.test(visible), 'no distributor name in Attest copy');
  assert.ok(!/SignWell/i.test(html + js), 'solo attest does not name SignWell');

  console.log('lib/attest-tesla-cut.test.js ok');
}

run();
