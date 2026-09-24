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

  assert.ok(/A&amp;R Act Pack/.test(ar), 'A&R page is the Act Pack');
  assert.ok(/\$149/.test(ar) && /draft/i.test(ar), 'Act Pack shows the draft $149');
  assert.ok(/Not charged/.test(ar), 'Act Pack does not pretend checkout is live');
  assert.ok(/Persona kit/i.test(ar) && /Hosted EPK/i.test(ar), 'Act Pack includes persona kit and hosted EPK');
  assert.ok(/Disclosure \/ QC/i.test(ar) && /PLAI Research/i.test(ar), 'Act Pack includes disclosure/QC and PLAI Research');
  assert.ok(/Human<\/strong>\s*·\s*<strong>AI-assisted<\/strong>\s*·\s*<strong>Fully AI/i.test(ar), 'disclosure names the three classes');
  assert.ok(/hosted and updated/i.test(ar), 'hosted EPK stays hosted and updated');
  assert.ok(/Already releasing elsewhere\? Start here\./.test(ar), 'A&R works without a PLAIGROUND release');
  assert.ok(/A&amp;R without Distro/.test(ar), 'already-releasing path is A&R without Distro');
  assert.ok(/href="contact\.html"/.test(ar), 'Act Pack CTA goes to contact, not a new Stripe charge');
  assert.ok(!/data-checkout-plan/.test(ar), 'Act Pack does not start Checkout');

  const q3 = 'EPK included — because acts need a pack, not a file.';
  assert.ok(epk.includes(q3), 'EPK keeps the pack quote');

  assert.ok(/No fake trauma bios/i.test(seen), 'soft-stop: no fake trauma bios');
  assert.ok(/No fake bios/i.test(seen), 'soft-stop: no fake bios');
  assert.ok(/No secret-human AI/i.test(seen), 'soft-stop: no secret-human AI');
  assert.ok(/No bury-Human/i.test(seen), 'soft-stop: no bury-Human');
  assert.ok(/No guaranteed placements or streams/i.test(seen), 'soft-stop: no guaranteed placements');
  assert.ok(/No detector promises/i.test(seen), 'soft-stop: no detector promises');
  assert.ok(/No spam farms/i.test(seen), 'soft-stop: no spam farms');

  assert.ok(/Disclosure line/i.test(epk) && /mix %/i.test(epk), 'EPK includes disclosure line + mix %');
  assert.ok(/Sync-ready notes/i.test(epk) && /stems/i.test(epk) && /instrumental/i.test(epk) && /one-stop/i.test(epk), 'EPK includes sync-ready notes');
  assert.ok(/DIY template/i.test(epk) && /hosted \+ updated/i.test(epk), 'EPK contrasts DIY vs A&R hosted');
  assert.ok(/bio/i.test(epk) && /Photos/i.test(epk) && /Music embeds/i.test(epk) && /One-sheet/i.test(epk) && /Socials/i.test(epk), 'EPK lists core pack pieces');

  assert.ok(/\$149/.test(visible(ar)) && !/\$14\.99|\$19\.99/.test(visible(ar)), 'A&R price is the draft Act Pack, not a membership');
  assert.ok(!/ToneGrid|DistroKid|InterSpace|\bFrank\b|hop\.put|object hop/i.test(seen), 'pages do not invent hop or name a store partner');
  assert.ok(!/Spotify for Artists|SubmitHub|UnitedMasters|CD Baby/i.test(seen), 'pages do not name a distributor brand beyond PLAIGROUND/wannaplai');
  assert.ok(!/we guarantee (playlist|placement|streams)|guaranteed #1|playlist guarantee/i.test(seen), 'no guaranteed placement promise copy');

  const arNav = ar.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
  const epkNav = epk.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(arNav && /data-nav-group="after"[\s\S]*ar\.html[\s\S]*epk\.html/.test(arNav[0]), 'A&R and EPK sit under After upload, not as top-level plan links');
  assert.ok(arNav && !/>\s*Fully AI\s*</i.test(arNav[0]) && !/>\s*AI-assisted\s*</i.test(arNav[0]), 'disclosure classes are not primary nav categories');
  assert.ok(epkNav && /data-nav-group="after"[\s\S]*ar\.html[\s\S]*epk\.html/.test(epkNav[0]), 'EPK page uses the same After upload group');

  assert.ok(/class="after-stay"[\s\S]*href="ar\.html"[\s\S]*href="epk\.html"[\s\S]*href="royalties\.html"/.test(index), 'homepage after-upload cards are A&R, EPK, How you get paid');
  const hero = index.match(/<section class="hero"[\s\S]*?<\/section>/);
  assert.ok(hero && !/ar\.html|epk\.html/.test(hero[0]), 'A&R/EPK stay out of the hero primary CTA cluster');
  assert.ok(!/class="btn[^"]*" href="ar\.html"/.test(index) && !/class="btn[^"]*" href="epk\.html"/.test(index), 'A&R/EPK are not button primaries on the homepage');
  const indexNav = index.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(indexNav && /data-nav-group="after"[\s\S]*href="ar\.html"[\s\S]*href="epk\.html"/.test(indexNav[0]), 'homepage After upload lists A&R and EPK');
  assert.ok(indexNav && !/class="btn[^"]*"[^>]*href="ar\.html"/.test(indexNav[0]), 'A&R is not a nav button primary');
  const indexFooter = index.match(/<footer>[\s\S]*?<\/footer>/);
  assert.ok(indexFooter && /<h4>After upload<\/h4>[\s\S]*href="ar\.html">A&R<\/a>[\s\S]*href="epk\.html">EPK<\/a>/.test(indexFooter[0]), 'homepage footer puts A&R and EPK under After upload');
  assert.ok(indexFooter && /<h4>Company<\/h4>[\s\S]*About us[\s\S]*Blog[\s\S]*Contact us/.test(indexFooter[0]), 'Company bucket stays About, Blog, Contact');
  assert.ok(indexFooter && /<h4>Legal<\/h4>/.test(indexFooter[0]) && /<h4>Trust<\/h4>[\s\S]*transparency\.html[\s\S]*faq\.html/.test(indexFooter[0]), 'Trust and Legal buckets stay');

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
