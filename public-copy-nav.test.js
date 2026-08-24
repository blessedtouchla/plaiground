'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

const APP_PAGES = [
  'dashboard.html',
  'how.html',
  'releases.html',
  'song.html',
  'splits.html',
  'splits-empty.html',
  'earnings.html',
  'analytics.html',
  'payouts.html',
  'settings.html',
  'plan-confirm.html',
  'artists.html',
  'profile.html',
  'library.html',
  'boosts.html',
];

function run() {
  const index = read('index.html');
  assert.ok(index.includes('WANNA PLAI?'), 'homepage eyebrow must restore WANNA PLAI?');
  assert.ok(!/Built for any AI music creator/i.test(index), 'homepage must not use the AI-only eyebrow');
  assert.ok(!/for AI music creators/i.test(index), 'homepage meta must not say for AI music creators');
  assert.ok(/for artists and all music/i.test(index), 'homepage meta must be all-music');
  assert.ok(!/Keep 100% of your royalties/i.test(index), 'do not invent keep-100% copy');

  const how = read('how-it-works.html');
  assert.ok(!/Built for AI-assisted creators/i.test(how), 'how-it-works must not lead as AI-only');
  assert.ok(/For artists who’d rather be making the next one/i.test(how), 'how-it-works sub stays all-music');

  const faq = read('faq.html');
  assert.ok(!/PLAIGROUND is built for AI-assisted artists/i.test(faq), 'FAQ must not use AI-only slogan language');
  assert.ok(/You declare what is human and what is AI-assisted on upload/i.test(faq), 'FAQ keeps the upload attest');
  assert.ok(faq.indexOf('What is PLAI?') < faq.indexOf('Frequently asked questions'), 'FAQ opens with what PLAI is');
  assert.ok(/pronounced[\s\S]*PLAY/i.test(faq), 'FAQ says PLAI is pronounced PLAY');
  assert.ok(/she\/her/i.test(faq), 'FAQ says PLAI uses she/her');
  assert.ok(faq.includes('Talk to PLAI') && faq.includes('Text PLAI'), 'FAQ points to Talk and Text PLAI');
  assert.ok(/does not turn on your microphone/i.test(faq), 'FAQ says Text PLAI does not use the mic');

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
  ];
  PUBLIC_PAGES.forEach(function (file) {
    const html = read(file);
    assert.ok(html.includes('href="index.html#pricing">Plans and Pricing</a>'), file + ' must rename Pricing to Plans and Pricing');
    assert.ok(html.includes('href="basic.html">Learn more: Basic</a>'), file + ' must list Learn more: Basic');
    assert.ok(html.includes('href="creator.html">Learn more: Creator</a>'), file + ' must list Learn more: Creator');
    assert.ok(html.includes('href="pro.html">Learn more: Pro</a>'), file + ' must list Learn more: Pro');
    assert.ok(html.includes('href="faq.html">FAQ</a>'), file + ' must feature FAQ on the public menu');
    assert.ok(html.includes('href="how-it-works.html">How it works</a>'), file + ' keeps How it works public');
    assert.ok(html.includes('href="login.html">Log in</a>'), file + ' keeps Log in');
    assert.ok(html.includes('Release Now'), file + ' keeps Release Now');
    assert.ok(!/href="boost.html">Boost<\/a>/.test(html), file + ' must not put Boost on the public menu');
  });

  assert.ok(index.includes('class="plans"'), 'landing still has the 3 PLAN cards');
  assert.ok(index.includes('plan-name">Basic</div>') && index.includes('plan-name">Creator</div>') && index.includes('plan-name">Pro</div>'), 'plan cards stay Basic / Creator / Pro');
  assert.ok(index.includes('or $149/year'), 'Creator yearly checkout stays available');
  assert.ok(index.includes('or $199/year'), 'Pro yearly displays $199');
  assert.ok(/data-checkout-plan="pro"\s+data-checkout-interval="year"/.test(index), 'Pro yearly starts live $199 checkout');
  assert.ok(/data-checkout-plan="creator"\s+data-checkout-interval="year"/.test(index), 'Creator yearly starts live $149 checkout');
  assert.ok(index.includes('The same product as Pro, with a monthly cap.'), 'Creator card is Pro with a cap');
  assert.ok(index.includes('The same product as Creator, unlimited.'), 'Pro card is the same product');
  assert.ok(!/grow a release/i.test(index), 'do not sell Creator as a different product');
  assert.ok(index.includes('landing-tease'), 'logged-out landing teases publishing / boosts / sync');
  assert.ok(!/Starter[\s\S]*\$49/i.test(index), 'landing must not show Boost size cards');

  const creator = read('creator.html');
  assert.ok(creator.includes('The same product as'), 'Creator Learn more is Pro with a cap');
  assert.ok(creator.includes('8 distribution uploads a month'), 'Creator states the distribution cap');
  assert.ok(creator.includes('8 publishing registrations a month'), 'Creator states the separate publishing cap');
  assert.ok(!/grow a release/i.test(creator), 'Creator Learn more must not sell a different product');
  assert.ok(!/What Creator does not include/i.test(creator), 'Creator must not list Pro-only extras');
  assert.ok(creator.includes('data-checkout-plan="creator"') && creator.includes('data-checkout-interval="year"'), 'Creator yearly checkout stays');

  const pro = read('pro.html');
  assert.ok(pro.includes('The same product as Creator'), 'Pro Learn more is the same product');
  assert.ok(pro.includes('or $199/year'), 'Pro yearly displays $199');
  assert.ok(/data-checkout-plan="pro"\s+data-checkout-interval="year"/.test(pro), 'Pro yearly starts live $199 checkout');
  assert.ok(!/Everything in Creator, plus publishing/i.test(pro), 'Pro must not sell extras Creator already has');

  const boost = read('boost.html');
  assert.ok(!/Go Pro to unlock/i.test(boost), 'boost.html must not lead with a plan pitch CTA');
  assert.ok(!/Every Pro release can add a Boost/i.test(boost), 'boost.html must not say Pro-only');
  assert.ok(!/Pro-only/i.test(boost), 'boost.html must not say Pro-only');
  assert.ok(!/Add a Starter Boost|Add a Momentum Boost|Add a Launch Boost|#boost-sizes/i.test(boost), 'logged-out Boost page is not a live buy');
  assert.ok(!/class="size-grid"/i.test(boost), 'logged-out Boost page must not show the 3 Boost size cards');
  assert.ok(/Starter[\s\S]*\$49/i.test(boost) === false, 'Starter $49 is not a public buy option');
  assert.ok(/publishing/i.test(boost) && /marketing boosts/i.test(boost) && /sync/i.test(boost), 'logged-out Boost page teases publishing, boosts, sync');
  assert.ok(/Creator and Pro can add a Boost/i.test(boost), 'Boost lock is Creator + Pro');
  assert.ok(!/class="plans"/i.test(boost), 'boost.html must not become membership plan cards');

  const boosts = read('boosts.html');
  assert.ok(!/Go Pro to unlock/i.test(boosts), 'boosts.html must not pitch Go Pro');
  assert.ok(/Marketing Boosts/i.test(boosts), 'boosts.html stays a marketing dashboard');
  assert.ok(!/data-require-paid/i.test(boosts), 'boosts.html must not dump Basic to Pick a plan');
  assert.ok(/data-require-membership="true"/i.test(boosts), 'boosts.html stays a signed-in page');
  assert.ok(/Boosts are locked on Basic/i.test(boosts), 'Basic sees a Boost lock, not a plan pitch');
  assert.ok(/Creator and Pro can add a Boost/i.test(boosts), 'Boost lock is Creator + Pro');

  const css = read('site.css');
  assert.ok(/@media \(max-width: 980px\)[\s\S]*\.side \{[\s\S]*transform: translateX\(-110%\)/i.test(css), 'mobile CSS must hide the stacked .side menu');
  assert.ok(/\.app\.nav-open \.side/i.test(css), 'open app drawer must show .side');
  assert.ok(/\.topbar \.menu-toggle \{ display: inline-flex; \}/i.test(css), 'mobile topbar shows the hamburger');
  assert.ok(/\.nav-links,\s*\n\s*\.nav-actions \{ display: none; \}/i.test(css), 'public mobile bar hides the full menu and actions');

  const js = read('site.js');
  assert.ok(js.includes('setupAppMenu') && js.includes('setupPublicMenu'), 'site.js wires both menus');
  assert.ok(js.includes('setupPublicSocials'), 'site.js keeps footer socials from one shared block');
  assert.ok(js.includes('https://www.facebook.com/profile.php?id=61593116849937'), 'shared socials use the PLAIGROUND Facebook profile');
  assert.ok(js.includes('https://www.instagram.com/plaigroundmusic'), 'shared socials use the PLAIGROUND Instagram');
  assert.ok(!js.includes('https://www.tiktok.com') && !js.includes('https://x.com'), 'shared socials drop TikTok and X');
  assert.ok(js.includes('aria-label="Facebook"') && js.includes('aria-label="Instagram"'), 'shared socials stay labeled Facebook and Instagram');
  assert.ok(js.includes('menu-toggle'), 'site.js injects a hamburger');
  assert.ok(js.includes('nav-open'), 'site.js toggles the drawer');

  const FACEBOOK_HREF = 'https://www.facebook.com/profile.php?id=61593116849937';
  const INSTAGRAM_HREF = 'https://www.instagram.com/plaigroundmusic';
  const FACEBOOK_GLYPH = 'M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z';
  const INSTAGRAM_GLYPH = 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm10 2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-5 3.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2zm0 2A1.8 1.8 0 1 0 13.8 12 1.8 1.8 0 0 0 12 10.2zM17.2 6.6a.9.9 0 1 1-.9.9.9.9 0 0 1 .9-.9z';
  const TIKTOK_GLYPH = 'M14.5 3c.4 2.4 1.8 4 4.1 4.2v2.3';
  const X_GLYPH = 'M18.2 3H21l-6.5 7.4L22 21h-6.2';
  const htmlFiles = fs.readdirSync(__dirname).filter(function (name) { return name.endsWith('.html'); });
  const socialPages = htmlFiles.filter(function (file) { return read(file).includes('class="socials"'); });
  assert.ok(socialPages.length >= 20, 'every public footer copy is still scanned');
  socialPages.forEach(function (file) {
    const html = read(file);
    const socials = html.match(/<div class="socials">[\s\S]*?<\/div>/);
    assert.ok(socials, file + ' must keep a socials block');
    const block = socials[0];
    assert.ok(block.includes(FACEBOOK_HREF), file + ' Facebook must be the PLAIGROUND profile');
    assert.ok(block.includes(INSTAGRAM_HREF), file + ' Instagram must be @plaigroundmusic');
    assert.ok(block.includes('aria-label="Facebook"') && block.includes('title="Facebook"'), file + ' Facebook needs an accessible name');
    assert.ok(block.includes('aria-label="Instagram"') && block.includes('title="Instagram"'), file + ' Instagram needs an accessible name');
    assert.ok(block.includes(FACEBOOK_GLYPH), file + ' Facebook icon must look like Facebook');
    assert.ok(block.includes(INSTAGRAM_GLYPH), file + ' Instagram icon must look like Instagram');
    assert.ok(!block.includes(TIKTOK_GLYPH) && !block.includes(X_GLYPH), file + ' must not keep TikTok or X glyphs');
    assert.ok(!block.includes('href="https://www.tiktok.com"') && !block.includes('href="https://x.com"'), file + ' must not keep TikTok or X homepage links');
    assert.ok(!/href="https:\/\/www\.instagram\.com["?#]/i.test(block), file + ' must not keep a bare Instagram homepage link');
    assert.ok((block.match(/target="_blank"/g) || []).length === 2, file + ' socials open in a new tab');
    assert.ok((block.match(/rel="noopener"/g) || []).length === 2, file + ' socials use rel=noopener');
    assert.ok((block.match(/<a /g) || []).length === 2, file + ' footer has Facebook and Instagram only');
  });
  htmlFiles.forEach(function (file) {
    const html = read(file);
    assert.ok(!/href="https:\/\/www\.tiktok\.com"|href="https:\/\/x\.com"/i.test(html), file + ' must not link TikTok or X homepages');
    assert.ok(!/mibextid|igsi/i.test(html), file + ' must not keep share-tracking params');
  });

  APP_PAGES.forEach(function (file) {
    const html = read(file);
    assert.ok(html.includes('class="side"') || html.includes("class='side'"), file + ' is missing the app menu');
    assert.ok(html.includes('src="site.js"'), file + ' must load the hamburger script');
    assert.ok(html.includes('href="how.html">How it works</a>'), file + ' must list How it works in the signed-in menu');
    assert.ok(html.includes('href="splits.html">Splits</a>'), file + ' menu item must be Splits');
    assert.ok(html.includes('href="artists.html">Artist Profiles</a>'), file + ' must list Artist Profiles in the signed-in menu');
    assert.ok(html.includes('href="settings.html">Settings</a>'), file + ' must keep Settings separate from Artist Profiles');
    assert.ok(!/href="splits.html">Split sheets<\/a>/.test(html), file + ' must not use Split sheets as the menu label');
  });

  const dash = read('dashboard.html');
  const howApp = read('how.html');
  assert.ok(!dash.includes('class="workflow"'), 'Overview must not keep the 4-step block in the page body');
  assert.ok(dash.indexOf('Your latest releases') < dash.indexOf('How a submission works'), 'Overview How it works link stays at the bottom');
  assert.ok(howApp.includes('01 Upload') && howApp.includes('02 Attest rights') && howApp.includes('03 Split sheet') && howApp.includes('04 Review'), 'signed-in How it works page keeps the 4-step flow');
  assert.ok(!/data-require-membership|data-require-paid/i.test(howApp), 'How it works must not dump signed-in users to login');

  const terms = read('terms.html');
  assert.ok(terms.includes('src="site.js"'), 'terms.html has public nav chrome and needs the hamburger');
  assert.ok(terms.includes('href="index.html#pricing">Pricing</a>'), 'do not overwrite terms.html public copy');
  const split = read('split-sheet.html');
  assert.ok(!split.includes('class="side"'), 'split-sheet.html is flow chrome, not the app sidebar');
  assert.ok(!split.includes('Learn more: Basic'), 'do not overwrite split-sheet.html');

  console.log('public-copy-nav.test.js ok');
}

run();
