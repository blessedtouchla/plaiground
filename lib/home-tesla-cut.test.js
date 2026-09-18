'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const CSS_STAMP = '20260918h3';
const JS_STAMP = '20260918h1';
const NAV_STAMP = '20260917pl2';
const ARTISTS_STAMP = '20260917ar1';
const REVIEW_STAMP = '20260917r2';
const SUBMITTED_STAMP = '20260917s5';
const ATTEST_STAMP = '20260917at3';

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function teslaCutCss(css) {
  const start = css.indexOf('/* —— Homepage Tesla energy (living wordmark + SIQA proof + pinned phone Login) —— */');
  assert.ok(start !== -1, 'Homepage Tesla-energy block is in site.css');
  return css.slice(start);
}

function visibleCopy(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function run() {
  const html = read('index.html');
  const css = read('site.css');
  const js = read('site.js');
  const cut = teslaCutCss(css);
  const visible = visibleCopy(html);
  const header = html.match(/<header class="nav">[\s\S]*?<\/header>/);
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>/);
  const welcome = html.match(/data-plai-coach-float[\s\S]*?<\/div>\s*<script src="membership\.js">/);
  const dash = read('dashboard.html');
  const artists = read('artists.html');
  const review = read('review.html');
  const submitted = read('submitted.html');
  const attest = read('attest.html');
  const blog = read('blog.html');
  const chart = JSON.parse(read('data/siqa-chart.json'));
  const chartsHtml = read('charts.html');
  const chartsTop = read('charts-top-100.html');

  assert.ok(header, 'homepage keeps the public header');
  assert.ok(hero, 'homepage keeps the portal hero');
  assert.ok(html.includes('site.css?v=' + CSS_STAMP), 'homepage cache-busts site.css at ' + CSS_STAMP);
  assert.ok(html.includes('site.js?v=' + JS_STAMP), 'homepage cache-busts site.js at ' + JS_STAMP);
  assert.ok(!html.includes('site.css?v=20260918h1'), 'h1 stamp is retired after the living-logo pass');
  assert.ok(!html.includes('site.css?v=20260918h2'), 'h2 stamp is retired after the floating-mark pass');
  assert.ok(!html.includes('site.css?v=20260912ae1'), 'ae1 stamp is retired after the homepage Tesla pass');
  assert.ok(!html.includes('site.js?v=20260912w1'), 'w1 site.js stamp is retired on homepage');
  assert.strictEqual((html.match(/href="site\.css\?v=/g) || []).length, 1, 'one site.css link only');
  assert.ok(html.includes('family=Space+Grotesk'), 'Space Grotesk loads');
  assert.ok(html.includes('family=Inter'), 'Inter stays loaded');

  assert.ok(html.includes('<body class="home-portal">'), 'body carries the portal scope');
  assert.ok(/class="public-header-tools"/.test(header[0]), 'Login cluster is in the homepage HTML');
  assert.ok(/class="login public-header-login" href="login.html">Log in</.test(header[0]), 'quiet Log in is pinned top-right');
  assert.ok(/class="menu-toggle public-menu-toggle"/.test(header[0]), 'public menu toggle is in the homepage HTML');
  assert.ok(!/<div class="nav-actions">[\s\S]*href="login.html">Log in/.test(header[0]), 'Log in is not buried only inside nav-actions');
  assert.ok(header[0].includes('Release Now'), 'desktop Release Now stays in nav-actions');

  assert.ok(html.includes('WANNA PLAI?'), 'eyebrow stays');
  assert.ok(/href="signup.html\?plan=basic"[^>]*data-plan="basic">Enter the PLAIGROUND</.test(hero[0]), 'gold door CTA stays on Basic signup');
  assert.ok(/class="btn btn-gold btn-md"/.test(hero[0]), 'enter CTA is gold');
  assert.ok(/href="how-it-works.html">How it works</.test(hero[0]), 'How it works stays the quiet secondary');
  assert.ok(!/Join for free/.test(hero[0]), 'hero does not keep a second primary');
  assert.ok(hero[0].includes('class="hero-logo-live"'), 'living wordmark is the hero visual');
  assert.ok(hero[0].includes('src="assets/plaiground-wordmark-live.png"'), 'living loop uses the punched real wordmark');
  assert.ok(require('fs').existsSync(require('path').join(__dirname, '..', 'assets', 'plaiground-logo.png')), 'original wordmark asset stays');
  assert.ok(require('fs').existsSync(require('path').join(__dirname, '..', 'assets', 'plaiground-wordmark-live.png')), 'transparent living mark is derived and shipped');
  assert.ok(hero[0].includes('class="hero-logo-live-shimmer"'), 'wordmark has a purple-to-gold shimmer');
  assert.ok(hero[0].includes('class="hero-logo-live-note"'), 'wordmark note pulse stays on the mark');
  assert.ok(!/hero-cover-tease|hero-cover-front|hero-float-note/.test(hero[0]), 'yellow P card and flyer stack are gone');
  assert.ok(!/<span class="hero-cover-front">P<\/span>/.test(html), 'fake P cover is gone');
  assert.ok(!/flyer|brochure-stack|album cover/i.test(hero[0]), 'hero does not invent a flyer brochure stack');
  assert.ok(!/After you sign in/.test(hero[0]), 'hero does not lecture');

  assert.ok(/class="hero-siqa-proof" href="\/charts"/.test(hero[0]), 'SIQA proof strip clicks through to /charts');
  assert.ok(hero[0].includes('Let Me Be · #1 · Week of Sep 15'), 'proof strip uses the live #1 week');
  assert.strictEqual(chart.tracks[0].title, 'Let Me Be', 'proof strip title is the real SIQA #1');
  assert.strictEqual(chart.tracks[0].rank, 1, 'proof strip rank is the real SIQA #1');
  assert.ok(/September 15/.test(chart.week), 'proof strip week matches the live SIQA week');
  assert.ok(!/RUBBERZ|GG EZ|Banjo Boy/.test(hero[0]), 'hero does not invent extra chart rows');
  assert.ok(!/\$[0-9.,]+k|\bearnings\b|CEO|hop\.put/i.test(hero[0]), 'hero does not invent earnings, hop, or a CEO');

  assert.ok(html.includes('landing-tease'), 'publishing / boosts / sync tease stays below the fold');
  assert.ok(html.includes('class="plans"'), 'plan cards stay');
  assert.ok(html.includes('data-plai-coach-float'), 'PLAI greeter stays on pre-login');
  assert.ok(welcome && /data-plai-talk[^>]*>Talk</.test(welcome[0]), 'Talk stays locked');
  assert.ok(welcome && /data-plai-text[^>]*>Text</.test(welcome[0]), 'Text stays locked');
  assert.ok(html.includes('plai-welcome.js?v=20260912w1'), 'welcome script stamp stays');
  assert.ok(html.includes('plai-bubble.js'), 'Talk/Text bubble still loads');

  assert.ok(js.includes('setupPublicHeaderLogin') && js.includes('public-header-tools'), 'shared public nav still pins Login');
  assert.ok(js.includes('drawer.id = drawer.id || "public-menu"'), 'existing homepage Menu still wires the drawer');
  assert.ok(!js.includes('object-hop') && !js.includes('hop.put'), 'homepage JS does not invent hop');

  assert.ok(/@keyframes home-portal-glow/.test(cut), 'portal glow pulse stays');
  assert.ok(/@keyframes home-logo-scale/.test(cut), 'wordmark soft-scale loop stays');
  assert.ok(/@keyframes home-logo-shimmer/.test(cut), 'purple-to-gold shimmer loop stays');
  assert.ok(/@keyframes home-logo-note/.test(cut), 'note pulse lives on the wordmark');
  assert.ok(!/@keyframes home-portal-cover/.test(cut), 'fake cover flip is gone');
  assert.ok(/\.home-portal \.hero-ctas \.btn-gold[\s\S]*?#f3cb47/.test(cut), 'enter CTA is gold #F3CB47');
  assert.ok(/\.home-portal \.hero-logo-live-shimmer[\s\S]*?#782fb1/.test(cut), 'shimmer uses purple #782FB1');
  assert.ok(/6\.4s/.test(cut), 'living loop stays in the 4-8s film range');
  assert.ok(/\.home-portal \.hero[\s\S]*?padding-bottom:\s*168px/.test(cut), 'phone hero clears the PLAI greeter so it cannot cover CTAs');
  assert.ok(/\.home-portal:has\(\[data-plai-welcome-state="open"\]\) \.plai-bubble-chip[\s\S]*?display:\s*none/.test(cut), 'open greeter hides the competing Talk chip');
  assert.ok(/prefers-reduced-motion: reduce/.test(cut), 'soft motion yields when asked');
  assert.ok(!/#A2FF00|#a2ff00/.test(cut), 'lime stays off this cut');
  assert.ok(!/#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'neon green / orange stay off this cut');
  assert.ok(!/#d03083|#D03083/.test(cut), 'magenta stays off this cut');
  assert.ok(!/ToneGrid|DistroKid|distributor|hop\.put|Elon|CEO/i.test(cut), 'cut does not invent hop / distributor / CEO');
  assert.ok(!/ToneGrid|DistroKid|distributor|Elon|CEO/i.test(visible), 'no distributor or CEO name on the homepage');
  assert.strictEqual(chart.tracks[0].youtubeId, '1WwS3IcEzcA', '#299 Let Me Be play id is not reverted');
  assert.ok(chartsHtml.includes('SIQA Charts') && chartsTop.includes('data-charts-src="/data/siqa-chart.json"'), '#299 charts hub and Top 100 stay');
  assert.ok(read('charts-rnb.html').includes('siqa-rnb.json'), '#299 R&B genre page stays');
  assert.ok(read('charts-gospel.html').includes('siqa-gospel.json'), '#299 Gospel genre page stays');
  assert.ok(read('charts-country.html').includes('siqa-country.json'), '#299 Country genre page stays');

  assert.ok(dash.includes('site.css?v=' + NAV_STAMP), '#290 signed-in nav Tesla stamp is not reverted');
  assert.ok(/<p class="side-label">PLAI<\/p>\s*<button[^>]*data-plai-talk[^>]*>Talk to PLAI<\/button>\s*<button[^>]*data-plai-text[^>]*>Text to PLAI<\/button>/.test(dash), '#290 Talk/Text stay in the PLAI menu');
  assert.ok(artists.includes('site.css?v=' + ARTISTS_STAMP), '#293 Artist Profiles Tesla stamp is not reverted');
  assert.ok(review.includes('site.css?v=' + REVIEW_STAMP), '#294 Schedule and review Tesla stamp is not reverted');
  assert.ok(submitted.includes('site.css?v=' + SUBMITTED_STAMP), '#295 Submitted desktop Tesla stamp is not reverted');
  assert.ok(attest.includes('site.css?v=' + ATTEST_STAMP), '#296 Attest Tesla stamp is not reverted');
  assert.ok(css.includes('/* —— Attest Tesla energy (rights confirmation + honest status + sticky dock) —— */'), '#296 Attest CSS block stays');
  assert.ok(/Twenty-seven posts/.test(blog) && blog.includes('blog-no-fakes.html'), 'blog Twenty-seven is not reverted');

  console.log('lib/home-tesla-cut.test.js ok');
}

run();
