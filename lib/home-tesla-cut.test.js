'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STAMP = '20260918h1';
const NAV_STAMP = '20260917pl2';
const ARTISTS_STAMP = '20260917ar1';
const REVIEW_STAMP = '20260917r2';
const SUBMITTED_STAMP = '20260917s5';
const ATTEST_STAMP = '20260917at3';

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function teslaCutCss(css) {
  const start = css.indexOf('/* —— Homepage Tesla energy (portal hero + pinned phone Login) —— */');
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

  assert.ok(header, 'homepage keeps the public header');
  assert.ok(hero, 'homepage keeps the portal hero');
  assert.ok(html.includes('site.css?v=' + STAMP), 'homepage cache-busts site.css at ' + STAMP);
  assert.ok(html.includes('site.js?v=' + STAMP), 'homepage cache-busts site.js at ' + STAMP);
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
  assert.ok(hero[0].includes('class="hero-float-note"'), 'one floating note stays');
  assert.ok(hero[0].includes('class="hero-cover-tease"'), 'one cover tease sits under the CTA');
  assert.ok(hero[0].includes('class="hero-cover"'), 'cover flip energy stays sparse');
  assert.ok(!/After you sign in/.test(hero[0]), 'hero does not lecture');

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
  assert.ok(/@keyframes home-portal-note/.test(cut), 'one floating note animates');
  assert.ok(/@keyframes home-portal-cover/.test(cut), 'cover flip energy stays');
  assert.ok(/\.home-portal \.hero-ctas \.btn-gold[\s\S]*?#f3cb47/.test(cut), 'enter CTA is gold #F3CB47');
  assert.ok(/\.home-portal \.hero-cover-back[\s\S]*?#782fb1/.test(cut), 'cover back uses purple #782FB1');
  assert.ok(/\.home-portal \.hero[\s\S]*?padding-bottom:\s*168px/.test(cut), 'phone hero clears the PLAI greeter so it cannot cover CTAs');
  assert.ok(/\.home-portal:has\(\[data-plai-welcome-state="open"\]\) \.plai-bubble-chip[\s\S]*?display:\s*none/.test(cut), 'open greeter hides the competing Talk chip');
  assert.ok(/prefers-reduced-motion: reduce/.test(cut), 'soft motion yields when asked');
  assert.ok(!/#A2FF00|#a2ff00/.test(cut), 'lime stays off this cut');
  assert.ok(!/#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'neon green / orange stay off this cut');
  assert.ok(!/#d03083|#D03083/.test(cut), 'magenta stays off this cut');
  assert.ok(!/ToneGrid|DistroKid|distributor|hop\.put|Elon|CEO/i.test(cut), 'cut does not invent hop / distributor / CEO');
  assert.ok(!/ToneGrid|DistroKid|distributor|Elon|CEO/i.test(visible), 'no distributor or CEO name on the homepage');

  assert.ok(dash.includes('site.css?v=' + NAV_STAMP), '#290 signed-in nav Tesla stamp is not reverted');
  assert.ok(/<p class="side-label">PLAI<\/p>\s*<button[^>]*data-plai-talk[^>]*>Talk to PLAI<\/button>\s*<button[^>]*data-plai-text[^>]*>Text to PLAI<\/button>/.test(dash), '#290 Talk/Text stay in the PLAI menu');
  assert.ok(artists.includes('site.css?v=' + ARTISTS_STAMP), '#293 Artist Profiles Tesla stamp is not reverted');
  assert.ok(review.includes('site.css?v=' + REVIEW_STAMP), '#294 Schedule and review Tesla stamp is not reverted');
  assert.ok(submitted.includes('site.css?v=' + SUBMITTED_STAMP), '#295 Submitted desktop Tesla stamp is not reverted');
  assert.ok(attest.includes('site.css?v=' + ATTEST_STAMP), '#296 Attest Tesla stamp is not reverted');
  assert.ok(css.includes('/* —— Attest Tesla energy (rights confirmation + honest status + sticky dock) —— */'), '#296 Attest CSS block stays');
  assert.ok(/Twenty posts/.test(blog) && blog.includes('blog-no-fakes.html'), 'blog Twenty is not reverted');

  console.log('lib/home-tesla-cut.test.js ok');
}

run();
