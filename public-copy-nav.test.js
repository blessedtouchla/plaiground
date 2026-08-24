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
    'royalties.html',
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
    const nav = html.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
    assert.ok(nav, file + ' must keep the public nav');
    assert.ok(nav[0].includes('href="royalties.html"'), file + ' must list How you get paid as its own top-level public menu item');
    assert.ok(nav[0].includes('How you get paid') || nav[0].includes('Royalties'), file + ' menu label is How you get paid or Royalties');
    assert.ok(nav[0].includes('href="faq.html">FAQ</a>'), file + ' keeps FAQ on the public menu');
    assert.ok(!/<details[\s\S]{0,500}href="royalties.html"/.test(nav[0]), file + ' must not nest How you get paid inside a Plans submenu');
    assert.ok(!/class="[^"]*(sub-?menu|dropdown)[^"]*"[\s\S]{0,400}href="royalties.html"/.test(nav[0]), file + ' How you get paid stays outside any Plans dropdown');
    assert.ok(nav[0].includes('href="index.html#pricing">Plans and Pricing</a>'), file + ' Plans and Pricing must stay a real compare-page link');
    assert.ok(nav[0].includes('href="basic.html">Learn more: Basic</a>'), file + ' header still lists Learn more: Basic for the shared menu to nest');
    assert.ok(nav[0].includes('href="creator.html">Learn more: Creator</a>'), file + ' header still lists Learn more: Creator for the shared menu to nest');
    assert.ok(nav[0].includes('href="pro.html">Learn more: Pro</a>'), file + ' header still lists Learn more: Pro for the shared menu to nest');
    assert.ok(!/href="boost.html">Marketing Boost<\/a>/.test(nav[0]), file + ' must not put Marketing Boost in the public header');
  });

  const royalties = read('royalties.html');
  assert.ok(royalties.includes('WANNA PLAI?'), 'royalties page keeps the WANNA PLAI? landing look');
  assert.ok(/PLAIGROUND takes no commission/i.test(royalties), 'royalties page states no commission');
  assert.ok(/0% cut of royalties/i.test(royalties), 'royalties page states a 0% cut');
  assert.ok(/only PLAIGROUND fee is membership/i.test(royalties), 'royalties page says membership is the only PLAIGROUND fee');
  assert.ok(royalties.includes('Basic is free, 1 song') || /Basic is free/i.test(royalties), 'royalties page states Basic is free, 1 song');
  assert.ok(royalties.includes('$14.99/mo or $149/yr'), 'royalties page states Creator membership');
  assert.ok(royalties.includes('$19.99/mo or $199/yr'), 'royalties page states Pro membership');
  assert.ok(/Creator is Basic with the paid features unlocked/i.test(royalties), 'royalties page uses Creator 1-2-3 voice');
  assert.ok(/Pro unlocks unlimited/i.test(royalties), 'royalties page then says Pro unlocks unlimited');
  assert.ok(!/Creator and Pro are the same product/i.test(royalties), 'royalties page must not use same-product Creator framing');
  assert.ok(/8 distribution uploads/i.test(royalties) && /8 publishing registrations/i.test(royalties), 'royalties page states the Creator caps');
  assert.ok(/Publishing registration is separate from distribution/i.test(royalties), 'publishing stays separate from distribution');
  assert.ok(/not included on Basic/i.test(royalties), 'do not say publishing is included on Basic');
  assert.ok(/Stores \(Spotify, Apple/i.test(royalties), 'royalties page says stores take their usual cut');
  assert.ok(!/\d+\s*%\s*(of (streams|revenue)|DSP|Spotify|Apple)/i.test(royalties), 'do not invent DSP percentages');
  assert.ok(/Royalties pass through after the stores pay/i.test(royalties), 'no invented ToneGrid take: royalties pass through after stores pay');
  assert.ok(!/ToneGrid (takes|take|fee|commission|cut)/i.test(royalties), 'do not invent a ToneGrid take rate');
  assert.ok(/Money shows as \$0 until a release is actually live/i.test(royalties), 'money stays $0 until a live release reports');
  assert.ok(/Payouts only after real royalties arrive/i.test(royalties), 'payouts wait for real royalties');
  assert.ok(/Basic can see totals but cannot withdraw/i.test(royalties), 'Basic can see totals and cannot withdraw');
  assert.ok(/Creator and Pro can retrieve payouts/i.test(royalties), 'Creator and Pro can retrieve payouts');
  assert.ok(!/\$199 per work/i.test(royalties) || royalties.includes('no $199 per work'), 'do not sell a $199 per-work fee');
  assert.ok(royalties.includes('no $199 per work') && royalties.includes('no $49 per release'), 'page denies per-work and per-release PLAIGROUND fees');
  assert.ok(!/Keep 100% of your royalties/i.test(royalties), 'do not invent keep-100% copy');

  const faqPaid = read('faq.html');
  assert.ok(faqPaid.includes('href="royalties.html">How you get paid</a>'), 'FAQ links to How you get paid');
  assert.ok(/PLAIGROUND takes no commission/i.test(faqPaid), 'FAQ commission answer matches the lock');
  assert.ok(read('index.html').includes('href="royalties.html">How you get paid</a>'), 'Plans and Pricing landing links Get paid to the royalties page');
  assert.ok(read('how-it-works.html').includes('href="royalties.html">How you get paid</a>'), 'How it works Get paid step links the royalties page');
  assert.ok(read('creator.html').includes('href="royalties.html">How you get paid</a>'), 'Creator Learn more links Get paid to the royalties page');
  assert.ok(read('basic.html').includes('href="royalties.html">How you get paid</a>'), 'Basic Learn more links the royalties page from the existing payout copy');

  assert.ok(index.includes('class="plans"'), 'landing still has the 3 PLAN cards');
  assert.ok(index.includes('plan-name">Basic</div>') && index.includes('plan-name">Creator</div>') && index.includes('plan-name">Pro</div>'), 'plan cards stay Basic / Creator / Pro');
  assert.ok(index.includes('or $149/year'), 'Creator yearly checkout stays available');
  assert.ok(index.includes('or $199/year'), 'Pro yearly displays $199');
  assert.ok(/data-checkout-plan="pro"\s+data-checkout-interval="year"/.test(index), 'Pro yearly starts live $199 checkout');
  assert.ok(/data-checkout-plan="creator"\s+data-checkout-interval="year"/.test(index), 'Creator yearly starts live $149 checkout');
  assert.ok(/paid features unlocked/i.test(index), 'Creator card uses Basic + paid unlocks voice');
  assert.ok(/Pro unlocks unlimited/i.test(index), 'pricing then says Pro unlocks unlimited');
  assert.ok(!/The same product as Pro/i.test(index), 'Creator card must not say same as Pro');
  assert.ok(index.includes('The same product as Creator, unlimited.'), 'Pro card may say same as Creator');
  assert.ok(!/grow a release/i.test(index), 'do not sell Creator as a different product');
  assert.ok(index.includes('landing-tease'), 'logged-out landing teases publishing / boosts / sync');
  assert.ok(!/Starter[\s\S]*\$49/i.test(index), 'landing must not show Boost size cards');

  const creator = read('creator.html');
  assert.ok(/Basic[\s\S]*paid features[\s\S]*unlocked/i.test(creator), 'Creator Learn more leads with Basic + paid unlocks');
  assert.ok(creator.includes('8 distribution uploads a month'), 'Creator states the distribution cap');
  assert.ok(creator.includes('8 publishing registrations a month'), 'Creator states the separate publishing cap');
  assert.ok(/Pro unlocks unlimited/i.test(creator), 'Creator then says Pro unlocks unlimited');
  assert.ok(creator.includes('or $149/year'), 'Creator yearly stays on its own line');
  assert.ok(!/The same product as/i.test(creator), 'Creator must not headline same product as Pro');
  assert.ok(!/same as Pro|same product as Pro|Creator is Pro|It is Pro|Same features as Pro|only difference from Pro|a month for Pro|Pro with a monthly cap|Pro with the monthly cap|Pro with 8|Same release tools as Pro/i.test(creator), 'Creator-facing same-as-Pro copy is banned');
  assert.ok(!/grow a release/i.test(creator), 'Creator Learn more must not sell a different product');
  assert.ok(!/What Creator does not include/i.test(creator), 'Creator must not list Pro-only extras');
  assert.ok(creator.includes('data-checkout-plan="creator"') && creator.includes('data-checkout-interval="year"'), 'Creator yearly checkout stays');

  const CREATOR_FACING = [
    'creator.html',
    'index.html',
    'how-it-works.html',
    'faq.html',
    'royalties.html',
    'basic.html',
    'settings.html',
    'plan-confirm.html',
    'earnings.html',
    'payouts.html',
    'account.js',
  ];
  CREATOR_FACING.forEach(function (file) {
    const text = read(file);
    assert.ok(!/same product as Pro/i.test(text), file + ' must not say same product as Pro');
    assert.ok(!/same as Pro/i.test(text), file + ' must not say same as Pro');
    assert.ok(!/Creator is Pro/i.test(text), file + ' must not say Creator is Pro');
    assert.ok(!/It is Pro with/i.test(text), file + ' must not say it is Pro');
    assert.ok(!/Same features as Pro/i.test(text), file + ' must not say same features as Pro');
    assert.ok(!/Creator and Pro are the same product/i.test(text), file + ' must not use same-product Creator framing');
  });
  assert.ok(!/Same product as Pro/i.test(read('lib/stripe-plans.js')), 'checkout plan detail must not say same product as Pro');
  assert.ok(/Creator is Basic with the paid features unlocked/i.test(read('account.js')), 'Settings JS uses Creator 1-2-3 voice');
  assert.ok(/Same product as Creator, unlimited/i.test(read('account.js')), 'Pro Settings copy may say same as Creator');

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
  assert.ok(css.includes('.public-header-tools'), 'public header keeps a Login + Menu cluster outside the drawer');
  assert.ok(/\.public-header-tools \{[\s\S]*flex-direction: column/i.test(css), 'phone stacks Login above the Menu pill');
  assert.ok(css.includes('.public-header-tools .login'), 'pinned Login keeps the existing pill look');
  assert.ok(css.includes('.nav-submenu'), 'public nav has a plans submenu');
  assert.ok(css.includes('.nav-submenu-toggle'), 'public nav has a chevron toggle');
  assert.ok(css.includes('.nav-links > a[href="basic.html"]'), 'un-nested Learn more stays hidden until the shared menu nests it');
  assert.ok(/hover: hover[\s\S]*\.nav-item\.has-submenu:hover \.nav-submenu/i.test(css), 'desktop hover reveals the plan submenu');
  assert.ok(/\.nav\.nav-open \.nav-item\.has-submenu\.open \.nav-submenu/i.test(css), 'phone open chevron reveals Basic / Creator / Pro');

  const js = read('site.js');
  assert.ok(js.includes('setupAppMenu') && js.includes('setupPublicMenu'), 'site.js wires both menus');
  assert.ok(js.includes('setupPublicHeaderLogin') && js.includes('public-header-tools'), 'shared public nav pins Login above Menu');
  assert.ok(js.includes('public-header-login'), 'shared public nav reuses one header Login');
  assert.ok(js.includes('href = "login.html"') || js.includes('href="login.html"'), 'pinned Login reuses the existing sign-in page');
  assert.ok(js.includes('isSignedIn'), 'pinned Login hides when already signed in');
  assert.ok(js.includes('document.body.classList.contains("app")'), 'signed-in app chrome does not get the public Login');
  assert.ok(js.includes('setupPublicPlansMenu'), 'shared public nav nests plan pages once');
  assert.ok(js.includes('nav-submenu-toggle'), 'phone chevron expands Basic / Creator / Pro');
  assert.ok(js.includes('Show Basic, Creator, and Pro'), 'chevron is labeled for the plan pages');
  assert.ok(js.includes('chevron.type = "button"'), 'chevron must not be a link that blocks the compare page');
  assert.ok(js.includes('submenu.appendChild(basic)') && js.includes('submenu.appendChild(creator)') && js.includes('submenu.appendChild(pro)'), 'submenu nests Basic, Creator, and Pro');
  assert.ok(!/boost\.html/.test(js), 'shared public nav must not nest Boost');
  assert.ok(!/royalties\.html/.test(js), 'shared public nav must not nest How you get paid');
  assert.ok(js.includes('setupPublicSocials'), 'site.js keeps footer socials from one shared block');
  assert.ok(js.includes('https://www.facebook.com/profile.php?id=61593116849937'), 'shared socials use the PLAIGROUND Facebook profile');
  assert.ok(js.includes('https://www.instagram.com/plaigroundmusic'), 'shared socials use the PLAIGROUND Instagram');
  assert.ok(!js.includes('https://www.tiktok.com') && !js.includes('https://x.com'), 'shared socials drop TikTok and X');
  assert.ok(js.includes('aria-label="Facebook"') && js.includes('aria-label="Instagram"'), 'shared socials stay labeled Facebook and Instagram');
  assert.ok(js.includes('menu-toggle'), 'site.js injects a hamburger');
  assert.ok(js.includes('public-menu-toggle'), 'Menu pill stays on the public header');
  assert.ok(js.includes('nav-open'), 'site.js toggles the drawer');
  assert.ok(!/catalog-migrate|catalogMigrate/.test(js), 'shared public nav must not add catalog migrate');

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

  const publicNav = runPublicNav({ signedIn: false, app: false });
  assert.ok(publicNav.tools, 'logged-out public header builds the Login + Menu cluster');
  assert.strictEqual(publicNav.login.getAttribute('href'), 'login.html', 'pinned Login uses the existing sign-in page');
  assert.strictEqual(publicNav.login.hidden, false, 'logged-out public header shows Login');
  assert.ok(publicNav.toggle, 'Menu pill stays next to the pinned Login');
  assert.strictEqual(publicNav.tools.children[0], publicNav.login, 'Login is first in the header cluster');
  assert.strictEqual(publicNav.tools.children[1], publicNav.toggle, 'Menu sits under / after Login');
  assert.strictEqual(publicNav.header.querySelectorAll('a.login').length, 1, 'only one header Login');
  assert.ok(publicNav.heroJoin, 'Join for free stays in the hero');

  const signedInPublic = runPublicNav({ signedIn: true, app: false });
  assert.strictEqual(signedInPublic.login.hidden, true, 'signed-in visitors do not get the public header Login');
  assert.ok(signedInPublic.toggle, 'signed-in public pages still keep Menu');

  const appNav = runPublicNav({ signedIn: true, app: true });
  assert.ok(!appNav.tools, 'signed-in app chrome does not gain the public Login cluster');
  assert.ok(!appNav.login, 'signed-in Hi there / PG pages do not get a header Login');
  assert.ok(!appNav.toggle || !appNav.toggle.classList.contains('public-menu-toggle'), 'app Menu is not the public header cluster');

  console.log('public-copy-nav.test.js ok');
}

function el(tag, attrs, kids) {
  const node = {
    tagName: String(tag).toUpperCase(),
    className: '',
    id: '',
    hidden: false,
    href: '',
    type: '',
    parentNode: null,
    children: [],
    attributes: Object.create(null),
    textContent: '',
    innerHTML: '',
    classList: {
      contains: function (name) {
        return (' ' + node.className + ' ').indexOf(' ' + name + ' ') !== -1;
      },
      add: function (name) {
        if (!node.classList.contains(name)) node.className = (node.className + ' ' + name).trim();
      },
      remove: function (name) {
        node.className = node.className.split(/\s+/).filter(function (part) { return part && part !== name; }).join(' ');
      },
      toggle: function (name, on) {
        if (on === false) node.classList.remove(name);
        else if (on === true || !node.classList.contains(name)) node.classList.add(name);
        else node.classList.remove(name);
        return node.classList.contains(name);
      },
    },
    setAttribute: function (key, value) {
      node.attributes[key] = String(value);
      if (key === 'class') node.className = String(value);
      if (key === 'id') node.id = String(value);
      if (key === 'href') node.href = String(value);
      if (key === 'type') node.type = String(value);
    },
    getAttribute: function (key) {
      if (key === 'class') return node.className;
      if (key === 'id') return node.id;
      if (key === 'href') return node.href;
      if (key === 'type') return node.type;
      return Object.prototype.hasOwnProperty.call(node.attributes, key) ? node.attributes[key] : null;
    },
    appendChild: function (child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    insertBefore: function (child, ref) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = node;
      const index = node.children.indexOf(ref);
      if (index === -1) node.children.push(child);
      else node.children.splice(index, 0, child);
      return child;
    },
    removeChild: function (child) {
      node.children = node.children.filter(function (item) { return item !== child; });
      child.parentNode = null;
      return child;
    },
    addEventListener: function () {},
    contains: function (other) {
      if (other === node) return true;
      return node.children.some(function (child) { return child.contains(other); });
    },
    querySelector: function (sel) { return qsa(node, sel)[0] || null; },
    querySelectorAll: function (sel) { return qsa(node, sel); },
  };
  Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
  (kids || []).forEach(function (child) { node.appendChild(child); });
  return node;
}

function match(node, sel) {
  sel = String(sel || '');
  var attr = '';
  if (sel.indexOf('[') !== -1) {
    attr = sel.slice(sel.indexOf('[') + 1, sel.lastIndexOf(']'));
    sel = sel.slice(0, sel.indexOf('['));
  }
  var parts = sel.split('.');
  var tag = parts[0];
  var classes = parts.slice(1);
  if (tag && node.tagName !== tag.toUpperCase()) return false;
  for (var i = 0; i < classes.length; i += 1) {
    if (!node.classList.contains(classes[i])) return false;
  }
  if (!attr) return true;
  if (attr.indexOf('=') === -1) return node.getAttribute(attr) != null;
  var name = attr.split('=')[0];
  var value = attr.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  return String(node.getAttribute(name) || '') === value;
}

function qsa(root, selector) {
  const parts = String(selector || '').trim().split(/\s+/);
  function walk(node, acc) {
    acc.push(node);
    node.children.forEach(function (child) { walk(child, acc); });
    return acc;
  }
  let current = [root];
  parts.forEach(function (part) {
    const next = [];
    current.forEach(function (node) {
      walk(node, []).forEach(function (candidate) {
        if (candidate !== node && match(candidate, part) && next.indexOf(candidate) === -1) next.push(candidate);
      });
    });
    current = next;
  });
  current.forEach = Array.prototype.forEach;
  return current;
}

function runPublicNav(options) {
  const vm = require('vm');
  const document = {
    body: null,
    querySelector: function (sel) { return document.body.querySelector(sel); },
    querySelectorAll: function (sel) { return document.body.querySelectorAll(sel); },
    createElement: function (tag) { return el(tag); },
    addEventListener: function () {},
  };
  const context = {
    document: document,
    window: {
      PlaigroundMembership: {
        isSignedIn: function () { return !!options.signedIn; },
        whenReady: function (cb) { if (typeof cb === 'function') cb(); },
      },
    },
    NodeList: Array,
  };
  context.window.document = document;

  if (options.app) {
    const who = el('a', { class: 'who', href: 'settings.html' });
    who.textContent = 'Hi there';
    const topbar = el('div', { class: 'topbar' }, [who]);
    const side = el('aside', { class: 'side' }, [el('a', { href: 'dashboard.html' })]);
    document.body = el('body', { class: 'app' }, [side, el('div', { class: 'app-main' }, [topbar])]);
    vm.runInNewContext(read('site.js'), context);
    return {
      header: null,
      tools: document.body.querySelector('.public-header-tools'),
      login: document.body.querySelector('a.login'),
      toggle: document.body.querySelector('.public-menu-toggle'),
      heroJoin: null,
    };
  }

  const login = el('a', { class: 'login', href: 'login.html' });
  login.textContent = 'Log in';
  const actions = el('div', { class: 'nav-actions' }, [
    login,
    el('a', { class: 'btn btn-purple btn-sm', href: 'signup.html' }),
  ]);
  const links = el('nav', { class: 'nav-links' }, [
    el('a', { href: 'how-it-works.html' }),
    el('a', { href: 'index.html#pricing' }),
    el('a', { href: 'basic.html' }),
    el('a', { href: 'creator.html' }),
    el('a', { href: 'pro.html' }),
    el('a', { href: 'royalties.html' }),
    el('a', { href: 'faq.html' }),
  ]);
  const inner = el('div', { class: 'nav-inner wrap' }, [
    el('a', { class: 'logo', href: 'index.html' }),
    links,
    actions,
  ]);
  const header = el('header', { class: 'nav' }, [inner]);
  const heroJoin = el('a', { class: 'btn btn-purple btn-md', href: 'signup.html?plan=basic' });
  heroJoin.setAttribute('data-plan', 'basic');
  heroJoin.textContent = 'Join for free';
  document.body = el('body', {}, [
    header,
    el('main', {}, [el('div', { class: 'hero-ctas' }, [heroJoin])]),
  ]);
  vm.runInNewContext(read('site.js'), context);
  return {
    header: header,
    tools: inner.querySelector('.public-header-tools'),
    login: header.querySelector('a.login'),
    toggle: inner.querySelector('.menu-toggle'),
    heroJoin: heroJoin,
  };
}

run();
