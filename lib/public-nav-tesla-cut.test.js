'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STAMP = '20260918n2';
const AUTH_STAMP = '20260921g1';
const NAV_STAMP = '20260917pl2';
const ARTISTS_STAMP = '20260917ar1';
const HOME_OLD = '20260918h3';
const AUTH_PAGES = { 'login.html': true, 'signup.html': true };

const PUBLIC_PAGES = [
  'index.html',
  'how-it-works.html',
  'faq.html',
  'basic.html',
  'creator.html',
  'pro.html',
  'boost.html',
  'about.html',
  'contact.html',
  'login.html',
  'signup.html',
  'royalties.html',
  'plai.html',
  'blog.html',
  'charts.html',
];

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function teslaCut(css) {
  const start = css.indexOf('/* —— Public nav Tesla cut (always-visible top links, pre-login only) —— */');
  assert.ok(start !== -1, 'public nav Tesla cut is in site.css');
  return css.slice(start);
}

function run() {
  const css = read('site.css');
  const js = read('site.js');
  const cut = teslaCut(css);
  const index = read('index.html');
  const dash = read('dashboard.html');
  const artists = read('artists.html');
  const header = index.match(/<header class="nav">[\s\S]*?<\/header>/);
  const hero = index.match(/<section class="hero"[\s\S]*?<\/section>/);

  assert.ok(header, 'homepage keeps the public header');
  assert.ok(index.includes('site.css?v=' + STAMP), 'homepage cache-busts site.css at ' + STAMP);
  assert.ok(index.includes('site.js?v=' + STAMP), 'homepage cache-busts site.js at ' + STAMP);
  assert.ok(!index.includes('site.css?v=' + HOME_OLD), 'h3 stamp is retired after the public nav pass');
  assert.ok(!index.includes('site.css?v=20260918n1'), 'n1 stamp is retired after the visible-bar fix');
  assert.ok(!index.includes('site.js?v=20260918h1'), 'h1 site.js stamp is retired after the public nav pass');
  assert.ok(/href="\/index\.html"/.test(header[0].match(/<a class="logo"[^>]*>/)[0]), 'homepage wordmark is root-absolute /index.html');

  PUBLIC_PAGES.forEach(function (file) {
    const html = read(file);
    const nav = html.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
    assert.ok(nav, file + ' keeps the public nav');
    const stamp = AUTH_PAGES[file] ? AUTH_STAMP : STAMP;
    assert.ok(html.includes('site.css?v=' + stamp), file + ' cache-busts site.css at ' + stamp);
    assert.ok(nav[0].includes('How it works'), file + ' keeps How it works');
    assert.ok(nav[0].includes('FAQ'), file + ' keeps FAQ');
    assert.ok(/SIQA Charts/.test(nav[0]), file + ' keeps SIQA Charts');
    assert.ok(/href="(?:\/)?index\.html#pricing">Plans and Pricing</.test(nav[0]), file + ' keeps Plans and Pricing');
    assert.ok(/How you get paid|Royalties/.test(nav[0]), file + ' keeps How you get paid / Royalties');
    assert.ok(html.includes('Log in'), file + ' keeps Log in');
    assert.ok(!/href="boost.html">Boost<\/a>/.test(nav[0]), file + ' does not invent Boost on the public bar');
    assert.ok(!/>Admin</.test(nav[0]), file + ' does not invent Admin on the public bar');
    assert.ok(!/ToneGrid|DistroKid|hop\.put|\bCEO\b/i.test(nav[0]), file + ' no hop / distributor / CEO in the public bar');
  });

  assert.ok(js.includes('header.classList.add("is-public-bar")'), 'public header is marked for the Tesla bar');
  assert.ok(js.includes('return "/index.html"'), 'logged-out wordmark stays root-absolute /index.html');
  assert.ok(js.includes('setupPublicMenu') && js.includes('setupAppMenu'), 'signed-in and public menus stay separate');
  assert.ok(js.includes('setupPublicBlogLink'), 'Blog injector stays');
  assert.ok(!js.includes('hop.put') && !/ToneGrid|DistroKid/.test(js), 'public nav JS does not invent hop or a distributor');

  assert.ok(!/\.nav-links,\s*\n\s*\.nav-actions \{ display: none; \}/.test(css), 'source 1180/980 queries no longer hide .nav-links');
  assert.ok(!/\.public-menu-toggle \{ display: inline-flex; \}/.test(css), 'source 1180/980 queries no longer show public Menu');
  assert.ok(/Do not hide \.nav-links or promote Menu/.test(css), '1180/980 queries keep public destinations on the bar');
  assert.ok(/\.nav-links \{[\s\S]*display:\s*flex !important/.test(cut), 'phone/tablet keeps primary links visible');
  assert.ok(/overflow-x:\s*auto/.test(cut), 'tablet uses sparse horizontal scroll when the bar is tight');
  assert.ok(/flex-wrap:\s*wrap/.test(cut), 'phone wraps so the existing destinations stay visible');
  assert.ok(/\.public-menu-toggle \{ display: none !important; \}/.test(cut), 'Menu pill is not the only way to see links');
  assert.ok(/\.nav-actions \{ display: none !important; \}/.test(cut), 'Release Now stays off the phone bar so gold Enter stays the primary');
  assert.ok(/flex-direction:\s*row/.test(cut), 'Log in stays quiet on the same top row');
  assert.ok(!/#d03083|#D03083/.test(cut), 'Magenta stays off this public bar pass');
  assert.ok(!/#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'Green/Orange stay off this public bar pass');
  assert.ok(!/ToneGrid|DistroKid|distributor|hop\.put|Elon|CEO/i.test(cut), 'cut does not invent hop / distributor / CEO');

  assert.ok(dash.includes('site.css?v=' + NAV_STAMP), '#290 signed-in nav Tesla stamp is not reverted');
  assert.ok(/<p class="side-label">Create<\/p>/.test(dash) && /<p class="side-label">Money<\/p>/.test(dash) && /<p class="side-label">PLAI<\/p>/.test(dash) && /<p class="side-label">Account<\/p>/.test(dash), '#290 Create / Money / PLAI / Account stays');
  assert.ok(artists.includes('site.css?v=' + ARTISTS_STAMP), '#293 Artist Profiles Tesla stamp is not reverted');
  assert.ok(hero[0].includes('Enter the PLAIGROUND'), 'gold Enter stays the homepage primary');
  assert.ok(!/Join for free/.test(hero[0]), 'hero does not grow a second primary');
  assert.ok(index.includes('class="hero-logo-live"'), '#303 living wordmark is not reverted');
  assert.ok(read('charts-top-100.html').includes('href="/index.html"'), '#301 genre logo still goes home');
  assert.ok(read('charts.js').includes('openBrowse(href)'), '#302 mini-player browse shell stays');

  console.log('lib/public-nav-tesla-cut.test.js ok');
}

run();
