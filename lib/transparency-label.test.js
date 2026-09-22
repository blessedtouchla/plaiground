'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function visible(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function run() {
  const index = read('index.html');
  const page = read('transparency.html');
  const hero = index.match(/<section class="hero"[\s\S]*?<\/section>/);
  const nav = index.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
  const footer = index.match(/<footer>[\s\S]*?<\/footer>/);
  const pageNav = page.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
  const pageFooter = page.match(/<footer>[\s\S]*?<\/footer>/);
  const seen = visible(index + '\n' + page);

  assert.ok(hero, 'homepage keeps the hero');
  assert.ok(/Using AI to<br \/>Power your <span class="accent">Music\.<\/span>/.test(hero[0]), 'homepage headline is Using AI to Power your Music');
  assert.ok(!/Upload once\.<br \/>Get paid/.test(hero[0]), 'old upload-once headline is replaced');
  const lockedQuote = 'Every platform treats AI differently. We handle disclosure and compliance so your release stays clear.';
  assert.ok(hero[0].includes('class="home-trust-quote"'), 'locked quote sits in the trust strip');
  assert.ok(hero[0].includes(lockedQuote), 'homepage quote is Victoria’s locked line');
  assert.ok(hero[0].indexOf('home-trust-quote') < hero[0].indexOf('home-trust-line'), 'quote leads the trust strip');
  assert.ok(page.includes('class="label-quote"') && page.includes(lockedQuote), 'transparency page uses the same locked line');
  assert.ok(!/we detect every stem|detect every stem/i.test(seen), 'quote stays disclosure and compliance');
  assert.ok(hero[0].includes('class="home-trust"'), 'labeling strip sits in the hero');
  assert.ok(hero[0].indexOf('home-trust') < hero[0].indexOf('Enter the PLAIGROUND'), 'strip sits above the gold door');
  assert.ok(/Transparent distribution — from 100% Human to Fully AI\. Your label\. Your call\./.test(hero[0]), 'support line stays');
  assert.ok(/100% Human stays Human — we don’t auto-tag your release as AI/.test(hero[0]), 'Human stays Human');
  assert.ok(/AI-assisted \/ Fully AI — you declare it; we send that truth to the stores/.test(hero[0]), 'artist declares AI classes');
  assert.ok(/Non-exclusive — keep your rights; leave anytime/.test(hero[0]), 'non-exclusive line stays');
  assert.ok(/class="home-trust-link" href="transparency\.html">How labeling works</.test(hero[0]), 'How labeling works goes to transparency.html');
  assert.ok(!/class="btn[^"]*" href="transparency\.html"/.test(hero[0]), 'labeling link is not a second primary button');
  assert.ok(nav && !/transparency\.html/.test(nav[0]), 'signed-out top nav does not gain a Transparency primary');
  assert.ok(footer && /href="transparency\.html">Transparency</.test(footer[0]), 'homepage footer lists Transparency near FAQ');

  assert.ok(/<h1>Human, assisted, or fully AI — you choose\.<\/h1>/.test(page), 'transparency H1 stays');
  assert.ok(/Artists who don’t want AI still belong here/.test(page), 'Human artists still belong');
  assert.ok(/do not rebrand it as AI/.test(page), 'Human releases are not rebranded as AI');
  assert.ok(/You attest the class on upload/.test(page), 'class is attested on upload');
  assert.ok(/Human, AI-assisted, or Fully AI/.test(page), 'the three classes are named');
  assert.ok(/do not scan the audio and assign a class/.test(page), 'PLAIGROUND does not invent the class');
  assert.ok(/We send that label to the stores/.test(page), 'the attested label is what goes to stores');
  assert.ok(/do not promise a listing, a payout, or a playlist/.test(page), 'no fake store-policy guarantee');
  assert.ok(/Any creator\. Any mix/.test(page), 'inclusive mix stays');
  assert.ok(/you can leave/.test(page), 'non-exclusive leave stays');
  assert.ok(/Publishing, if you add it, is a separate agreement/.test(page), 'publishing stays a separate choice');
  assert.ok(/href="upload\.html">Upload</.test(page), 'page links back to upload');
  assert.ok(/href="how-it-works\.html">How it works</.test(page), 'page links back to how it works');
  assert.ok(/href="faq\.html">FAQ</.test(page), 'page links back to FAQ');
  assert.ok(pageNav && !/transparency\.html/.test(pageNav[0]), 'transparency page does not stuff the top nav');
  assert.ok(pageFooter && /href="transparency\.html">Transparency</.test(pageFooter[0]), 'transparency footer lists the page');

  assert.ok(!/\b(we|PLAIGROUND)\s+(detect|detected|detects)\b/i.test(seen), 'do not claim we detect AI');
  assert.ok(!/AI detection|auto-detect|automatically detect/i.test(seen), 'do not claim automatic AI detection');
  assert.ok(!/ToneGrid|DistroKid|\bdistributor\b|hop\.put/i.test(seen), 'do not name a distributor or invent hop');
  const css = read('site.css');
  const cut = css.slice(css.indexOf('/* —— Labeling transparency'), css.indexOf('/* —— Public nav Tesla cut'));
  assert.ok(cut.includes('#f3cb47') && cut.includes('#782fb1'), 'labeling strip uses gold and purple');
  assert.ok(!/#d03083|#D03083|#A2FF00|#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'labeling cut stays off competing primaries');

  console.log('lib/transparency-label.test.js ok');
}

run();
