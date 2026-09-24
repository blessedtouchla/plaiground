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
  const ar = read('ar.html');
  const epk = read('epk.html');
  const index = read('index.html');
  const css = read('site.css');
  const vercel = read('vercel.json');
  const seen = visible(ar + '\n' + epk);

  const tagline =
    'We don’t just distribute files. We help distribute acts — with honest AI/Human labels, and a Human lane that doesn’t get buried.';
  assert.ok(ar.includes(tagline), 'A&R keeps the locked tagline');
  assert.ok(epk.includes(tagline), 'EPK keeps the locked tagline');

  const q1 = 'Every platform treats AI differently. We handle disclosure and compliance so your release stays clear.';
  const q2 = 'Human artists stay Human. Clear labeling, clear rights, and a lane that doesn’t get buried under AI.';
  const q3 = 'EPK included — because acts need a pack, not a file.';
  assert.ok(ar.includes(q1) && ar.includes(q2) && ar.includes(q3), 'A&R wall quotes stay locked');
  assert.ok(epk.includes(q3), 'EPK leads with the pack quote');

  assert.ok(/wannaplai DIY/i.test(ar) && /PLAIGROUND A&R/i.test(ar), 'A&R names both rails');
  assert.ok(/Human<\/strong>\s*·\s*<strong>AI-assisted<\/strong>\s*·\s*<strong>Fully AI/i.test(ar), 'DIY rail names the three disclosure classes');
  assert.ok(/Persona kit/i.test(ar) && /EPK included/i.test(ar) && /Release QC/i.test(ar), 'A&R package lists persona kit, EPK, QC');
  assert.ok(/Compliance routing/i.test(ar) && /PLAI Research/i.test(ar), 'A&R package lists compliance and PLAI Research');
  assert.ok(/Optional Growth/i.test(ar) && /Optional Sync/i.test(ar), 'A&R package lists optional Growth and Sync');
  assert.ok(/hosted and updated/i.test(ar), 'A&R EPK is hosted and updated');
  assert.ok(/Pricing on request/i.test(ar), 'A&R uses pricing on request');

  assert.ok(/No fake trauma bios/i.test(seen), 'soft-stop: no fake trauma bios');
  assert.ok(/No secret-human AI/i.test(seen), 'soft-stop: no secret-human AI');
  assert.ok(/No bury-Human/i.test(seen), 'soft-stop: no bury-Human');
  assert.ok(/No guaranteed placements or streams/i.test(seen), 'soft-stop: no guaranteed placements');
  assert.ok(/No spam farms/i.test(seen), 'soft-stop: no spam farms');

  assert.ok(/Disclosure line/i.test(epk) && /mix %/i.test(epk), 'EPK includes disclosure line + mix %');
  assert.ok(/Sync-ready notes/i.test(epk) && /stems/i.test(epk) && /instrumental/i.test(epk) && /one-stop/i.test(epk), 'EPK includes sync-ready notes');
  assert.ok(/DIY template/i.test(epk) && /hosted \+ updated/i.test(epk), 'EPK contrasts DIY vs A&R hosted');
  assert.ok(/bio/i.test(epk) && /Photos/i.test(epk) && /Music embeds/i.test(epk) && /One-sheet/i.test(epk) && /Socials/i.test(epk), 'EPK lists core pack pieces');

  assert.ok(!/\$\d/.test(visible(ar)), 'A&R does not invent dollar prices');
  assert.ok(!/ToneGrid|DistroKid|InterSpace|\bFrank\b|hop\.put|object hop/i.test(seen), 'pages do not invent hop or name a store partner');
  assert.ok(!/Spotify for Artists|SubmitHub|UnitedMasters|CD Baby/i.test(seen), 'pages do not name a distributor brand beyond PLAIGROUND/wannaplai');
  assert.ok(!/we guarantee (playlist|placement|streams)|guaranteed #1|playlist guarantee/i.test(seen), 'no guaranteed placement promise copy');

  const arNav = ar.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
  const epkNav = epk.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(arNav && !/ar\.html|epk\.html/.test(arNav[0]), 'A&R stays out of primary nav');
  assert.ok(arNav && !/>\s*Fully AI\s*</i.test(arNav[0]) && !/>\s*AI-assisted\s*</i.test(arNav[0]), 'disclosure classes are not primary nav categories');
  assert.ok(epkNav && !/ar\.html|epk\.html/.test(epkNav[0]), 'EPK stays out of primary nav');

  assert.ok(/class="home-acts-link" href="ar\.html">PLAIGROUND A&R · EPK</.test(index), 'homepage trust/tease area links A&R quietly');
  const hero = index.match(/<section class="hero"[\s\S]*?<\/section>/);
  assert.ok(hero && !/ar\.html|epk\.html/.test(hero[0]), 'A&R/EPK stay out of the hero primary CTA cluster');
  assert.ok(!/class="btn[^"]*" href="ar\.html"/.test(index) && !/class="btn[^"]*" href="epk\.html"/.test(index), 'A&R/EPK are not button primaries on the homepage');
  const indexNav = index.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(indexNav && !/ar\.html|epk\.html/.test(indexNav[0]), 'homepage top nav does not gain A&R/EPK primaries');
  const indexFooter = index.match(/<footer>[\s\S]*?<\/footer>/);
  assert.ok(indexFooter && /href="ar\.html">A&R</.test(indexFooter[0]) && /href="epk\.html">EPK</.test(indexFooter[0]), 'homepage footer lists A&R and EPK');

  assert.ok(/"source":\s*"\/ar"/.test(vercel) && /"destination":\s*"\/ar\.html"/.test(vercel), 'vercel rewrites /ar');
  assert.ok(/"source":\s*"\/epk"/.test(vercel) && /"destination":\s*"\/epk\.html"/.test(vercel), 'vercel rewrites /epk');

  const cutStart = css.indexOf('/* —— PLAIGROUND A&R + EPK');
  assert.ok(cutStart !== -1, 'site.css has the A&R/EPK cut');
  const cut = css.slice(cutStart);
  assert.ok(/#f3cb47/i.test(cut) && /#782fb1/i.test(cut), 'A&R/EPK accents use gold and purple');
  assert.ok(!/#d03083|#D03083|#A2FF00|#3[Ff][Ee]07[Aa]|#F09416/.test(cut), 'A&R/EPK cut stays off competing primaries');

  assert.ok(!/epk\/example|fake artist|press quote from/i.test(seen), 'no invented example EPK bios or press quotes');

  const artists = read('artists.html');
  assert.ok(artists.includes('class="artists-act-edu"'), 'Artist Profiles carries Act, not just files education');
  assert.ok(/href="ar\.html">A&R · EPK included</.test(artists), 'Artist Profiles soft-links A&R');
  assert.ok(/href="epk\.html">What’s in an EPK</.test(artists), 'Artist Profiles soft-links EPK');

  console.log('lib/ar-epk-hold.test.js ok');
}

run();
