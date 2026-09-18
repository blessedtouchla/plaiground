'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STAMP = '20260917pl2';
const ARTISTS_STAMP = '20260917ar1';
const PUBLIC_NAV_STAMP = '20260918n2';
const PUBLIC_NAV_PAGES = {
  'faq.html': true,
  'contact.html': true,
  'plai.html': true,
};
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
  'chart-push.html',
  'streaming-push.html',
  'social-push.html',
  'video-collect.html',
  'publishing-register.html',
  'faq.html',
  'contact.html',
  'plai.html',
  'problem.html',
];

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function run() {
  const css = read('site.css');
  const js = read('site.js');
  const cutStart = css.indexOf('/* —— Signed-in nav Tesla cut (Create / Money / PLAI / Account, no Overview nest) —— */');
  assert.ok(cutStart !== -1, 'sectioned drawer Tesla cut is in site.css');
  const cut = css.slice(cutStart);

  assert.ok(/\.side-nav a\.side-action[\s\S]*?background:\s*#f3cb47/.test(cut), 'New release gold #f3cb47 stays the only filled CTA');
  assert.ok(/\.side-nav a\.on \{[\s\S]*?background:\s*transparent/.test(cut), 'current page is not a filled purple pill');
  assert.ok(/inset 0 0 0 1px rgba\(120, 47, 177/.test(cut), 'current page uses purple #782FB1 outline accent');
  assert.ok(/\.side-nav a\.side-problem[\s\S]*?border:\s*0/.test(cut), 'Have a problem? is a quiet row, not a gold box');
  assert.ok(/\.side-nav a\.side-problem[\s\S]*?color:\s*var\(--muted-2\)/.test(cut), 'Have a problem? does not compete with the gold CTA');
  assert.ok(/\.side-nav a\.nav-siqa[\s\S]*?font-weight:\s*500/.test(cut), 'SIQA Charts stays gold text, not a second gold button');
  assert.ok(cut.includes('font-family: "Space Grotesk"'), 'Create CTA / section labels use Space Grotesk');
  assert.ok(cut.includes('font-family: Inter'), 'drawer rows stay Inter');
  assert.ok(cut.includes('min-height: 44px'), 'phone rows keep a 44px hit target');
  assert.ok(!cut.includes('#d03083') && !cut.includes('#D03083'), 'Magenta stays off this drawer pass');
  assert.ok(!/#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'Green/Orange stay off this drawer pass');
  assert.ok(!/ToneGrid|DistroKid|hop\.put/i.test(cut), 'no hop / distributor invent on drawer CSS');

  assert.ok(!js.includes('setupOverviewSubmenu'), 'Overview nest JS is retired');
  assert.ok(!js.includes('data-overview-menu'), 'Overview nest selector is retired');
  assert.ok(js.includes('setupAppBlogLink'), 'Blog injector is not invented-removed');

  APP_PAGES.forEach(function (file) {
    const html = read(file);
    const sideNav = html.match(/<nav class="side-nav">[\s\S]*?<\/nav>/);
    assert.ok(sideNav, file + ' keeps the signed-in drawer');
    const stamp = file === 'artists.html' ? ARTISTS_STAMP : (PUBLIC_NAV_PAGES[file] ? PUBLIC_NAV_STAMP : STAMP);
    assert.ok(html.includes('site.css?v=' + stamp), file + ' cache-busts site.css at ' + stamp);
    assert.ok(html.includes('family=Space+Grotesk'), file + ' loads Space Grotesk');
    assert.ok(html.includes('family=Inter'), file + ' loads Inter');
    assert.ok(/<p class="side-label">Create<\/p>/.test(sideNav[0]), file + ' has Create');
    assert.ok(/<p class="side-label">Money<\/p>/.test(sideNav[0]), file + ' has Money');
    assert.ok(/<p class="side-label">PLAI<\/p>/.test(sideNav[0]), file + ' has PLAI');
    assert.ok(/data-plai-talk[^>]*>Talk to PLAI</.test(sideNav[0]), file + ' Talk to PLAI uses the existing Talk path');
    assert.ok(/data-plai-text[^>]*>Text to PLAI</.test(sideNav[0]), file + ' Text to PLAI uses the existing Text path');
    assert.ok(!/>PLAY</.test(sideNav[0]), file + ' menu stays PLAI, not PLAY');
    assert.ok(/<p class="side-label">Account<\/p>/.test(sideNav[0]), file + ' has Account');
    assert.ok(/data-new-release data-signed-in-upload>New release</.test(sideNav[0]), file + ' gold New release stays top of Create');
    assert.ok(/href="releases.html">Releases</.test(sideNav[0]), file + ' keeps Releases');
    assert.ok(/href="artists.html">Artist Profiles</.test(sideNav[0]), file + ' keeps Artist Profiles');
    assert.ok(/href="splits.html">Split sheets</.test(sideNav[0]), file + ' keeps Split sheets');
    assert.ok(/href="boosts.html"[^>]*data-for-plans="creator pro"/.test(sideNav[0]), file + ' Boosts stays Creator/Pro gated');
    assert.ok(/data-publishing-register[^>]*data-for-plans="creator pro"/.test(sideNav[0]), file + ' Publishing stays Creator/Pro gated');
    assert.ok(/href="earnings.html">Earnings</.test(sideNav[0]), file + ' keeps Earnings');
    assert.ok(/href="analytics.html">Analytics</.test(sideNav[0]), file + ' keeps Analytics');
    assert.ok(/href="payouts.html">Payouts</.test(sideNav[0]), file + ' keeps Payouts');
    assert.ok(/href="settings.html">Settings</.test(sideNav[0]), file + ' keeps Settings');
    assert.ok(/href="how.html">How it works</.test(sideNav[0]), file + ' keeps How it works');
    assert.ok(/href="faq.html">FAQ</.test(sideNav[0]), file + ' keeps FAQ');
    assert.ok(!/href="dashboard.html">Overview</.test(sideNav[0]), file + ' Overview parent is gone');
    assert.ok(!/data-overview-menu|side-submenu/.test(sideNav[0]), file + ' Overview nest box is gone');
    assert.ok(!/>Blog</.test(sideNav[0]), file + ' does not invent Blog into Account HTML');
    assert.ok(!/ToneGrid|DistroKid|hop\.put/i.test(sideNav[0]), file + ' no hop / distributor invent in the drawer');
  });

  const bubbleCss = read('plai-bubble.css');
  const bubbleJs = read('plai-bubble.js');
  assert.ok(/body\.app \.plai-bubble-chip[\s\S]*?display:\s*none/.test(bubbleCss), 'signed-in app hides the floating PLAI chip');
  assert.ok(/body:has\(> \.flow-top\) \.plai-bubble-chip[\s\S]*?display:\s*none/.test(bubbleCss), 'upload/submitted flow hides the floating PLAI chip');
  assert.ok(!/body\.auth-full \.plai-bubble-chip[\s\S]*?display:\s*none/.test(bubbleCss), 'login/signup keep the marketing PLAI chip');
  assert.ok(bubbleJs.includes("AGENT_ID = 'agent_BDVzp3Ar3ABtyov5'"), 'Talk stays on the existing voice agent');
  assert.ok(!/elevenlabs/i.test(bubbleJs + bubbleCss), 'no ElevenLabs invent');
  assert.ok(js.includes('[data-plai-talk]') && js.includes('[data-plai-text]'), 'phone drawer closes after Talk/Text');

  assert.ok(!read('admin.html').includes('data-overview-menu'), 'owner desk is not rewritten onto the artist IA');
  assert.ok(!read('upload.html').includes('site.css?v=' + STAMP), 'Upload stamp stays on its own Tesla cut');
  assert.ok(read('index.html').includes('plai-bubble.js'), 'marketing homepage still loads the PLAI chip');

  console.log('nav-drawer-tesla-cut.test.js: ok');
}

run();
