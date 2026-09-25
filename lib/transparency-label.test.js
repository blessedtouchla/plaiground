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
  assert.ok(/<h1>AI-powered marketing for the act\.<\/h1>/.test(hero[0]), 'homepage headline leads with AI-powered marketing');
  assert.ok(/A&amp;R, an EPK, and research on where the sound fits\./.test(hero[0]), 'homepage sub leads with growth');
  assert.ok(!/\$2\.49/.test(hero[0]), 'homepage hero does not lead with the per-song price');
  assert.ok(!/Upload once\.<br \/>Get paid/.test(hero[0]), 'old upload-once headline is replaced');
  assert.ok(!hero[0].includes('class="home-trust-quote"'), 'hero does not stack the quote before the CTAs');
  assert.ok(!hero[0].includes('home-trust-points'), 'hero does not stack the three bullets before the CTAs');
  const tiles = index.match(/<section class="story-tiles"[\s\S]*?<\/section>/);
  assert.ok(tiles, 'honesty tiles sit outside the hero');
  assert.ok(/Human stays Human/.test(tiles[0]), 'tile: Human stays Human');
  assert.ok(/You declare/.test(tiles[0]), 'tile: You declare');
  assert.ok(/You keep rights/.test(tiles[0]), 'tile: You keep rights');
  const lockedQuote = 'Every platform treats AI differently. You attest the label. We pass it on. Stores decide pay and playlist rules.';
  const humanLane = 'Human artists stay Human. Clear labeling, clear rights, and a lane that doesn’t get buried under AI.';
  assert.ok(page.includes('class="label-quote"') && page.includes(lockedQuote), 'transparency page uses the same locked line');
  assert.ok(page.includes(humanLane), 'transparency page carries the Human-lane lock');
  assert.ok(!/humans only|human club|no AI allowed/i.test(seen), 'Human lane stays inclusive');
  assert.ok(!/we detect every stem|detect every stem/i.test(seen), 'quote stays disclosure and compliance');
  assert.ok(hero[0].indexOf('hero-ctas') < index.indexOf('story-tiles'), 'tiles sit after the hero CTAs');
  assert.ok(/You declare/.test(tiles[0]) && /Human, assisted, or fully AI/.test(tiles[0]), 'you declare the class');
  assert.ok(/Non-exclusive\. Leave anytime\./.test(tiles[0]), 'rights tile stays easy');
  assert.ok(/class="home-trust-link" href="transparency\.html">How labeling works</.test(tiles[0]), 'How labeling works goes to transparency.html');
  assert.ok(!/class="btn[^"]*" href="transparency\.html"/.test(index), 'labeling link is not a second primary button');
  assert.ok(nav && /data-nav-group="trust"[\s\S]*transparency\.html/.test(nav[0]), 'Transparency sits in Trust, not as a plans primary');
  assert.ok(nav && !/class="btn[^"]*"[^>]*href="transparency\.html"/.test(nav[0]), 'Transparency is not a nav button primary');
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
  assert.ok(pageNav && /data-nav-group="trust"[\s\S]*transparency\.html/.test(pageNav[0]), 'Transparency sits in the Trust section, not as a plans link');
  assert.ok(pageFooter && /href="transparency\.html">Transparency</.test(pageFooter[0]), 'transparency footer lists the page');

  assert.ok(!/\b(we|PLAIGROUND)\s+(detect|detected|detects)\b/i.test(seen), 'do not claim we detect AI');
  assert.ok(!/AI detection|auto-detect|automatically detect/i.test(seen), 'do not claim automatic AI detection');
  assert.ok(!/ToneGrid|DistroKid|\bdistributor\b|hop\.put/i.test(seen), 'do not name a distributor or invent hop');
  const css = read('site.css');
  const cut = css.slice(css.indexOf('/* —— Labeling transparency'), css.indexOf('/* —— Public nav sections'));
  assert.ok(cut.includes('#f3cb47') && cut.includes('#782fb1'), 'labeling strip uses gold and purple');
  assert.ok(!/#d03083|#D03083|#A2FF00|#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'labeling cut stays off competing primaries');

  console.log('lib/transparency-label.test.js ok');
}

run();
