'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function run() {
  const html = read('blog-your-suno-song-your-rights.html');
  const hub = read('blog.html');
  const vercel = JSON.parse(read('vercel.json'));
  const sitemap = read('sitemap.xml');
  const style = (html.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
  const visible = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');

  assert.ok(html.includes('<h1>Your Suno song, your rights: what to check before you release</h1>'), 'H1 matches the approved title');
  assert.ok(html.includes('https://www.wannaplai.com/blog/your-suno-song-your-rights'), 'canonical is the pretty URL');
  assert.ok(html.includes('<h2>FAQ</h2>'), 'FAQ stays');
  assert.ok(html.includes('<h2>Sources</h2>'), 'sources stay');
  assert.ok(html.includes('https://suno.com/terms'), 'Suno terms stay sourced');
  assert.ok(html.includes('https://www.copyright.gov/ai/'), 'Copyright Office stay sourced');
  assert.ok(!/—|–/.test(html), 'no em dash or en dash');
  assert.ok(!/sat down/i.test(html), 'does not use the phrase sat down');
  assert.ok(!/not_for_publication|awaiting GO|Victoria's review|not published|not scheduled|status: draft/i.test(html), 'editor notes are gone');
  assert.ok(!/suno-is-in-court|Suno is in court/i.test(html), 'unpublished court post is not linked');
  assert.ok(!/pass(?:es|ing)? AI credits|AI credits to (?:DSPs|stores|Spotify)/i.test(html), 'does not claim AI credits are passed to DSPs');
  assert.ok(!/#(?:F3CB47|F5C542|F0C84A)|var\(--gold\)/i.test(style), 'article styling does not use gold');
  assert.ok(/radial-gradient|linear-gradient/.test(style), 'article uses gradients');
  assert.ok(/box-shadow|drop-shadow/.test(style), 'article uses glow');
  assert.ok(style.includes('#000'), 'cards stay solid black');
  assert.ok(html.includes('class="rights-icon"'), 'cartoon icons are in the article');

  [
    '/copyright',
    '/blog/can-my-ai-song-be-published',
    '/ai-labels',
    '/split-sheets',
    '/research',
    '/distribution'
  ].forEach(function (href) {
    assert.ok(html.includes('href="' + href + '"'), 'keeps ' + href);
    const rule = (vercel.rewrites || []).find(function (row) { return row.source === href; });
    assert.ok(rule, href + ' is a live rewrite');
  });

  const rewrite = (vercel.rewrites || []).find(function (row) {
    return row.source === '/blog/your-suno-song-your-rights';
  });
  assert.ok(rewrite && rewrite.destination === '/blog-your-suno-song-your-rights.html', 'pretty path rewrites to the post');
  assert.ok(sitemap.includes('<loc>https://www.wannaplai.com/blog/your-suno-song-your-rights</loc>'), 'sitemap lists the post');
  assert.ok(/Seventy-five posts\./.test(hub), 'hub count is seventy-five');
  const firstCard = hub.indexOf('<div class="tease-grid">');
  const card = hub.indexOf('blog-your-suno-song-your-rights.html');
  const previous = hub.indexOf('blog-cd-era-vs-streaming-pay.html');
  assert.ok(card > firstCard && card < previous, 'new card is the top card');

  assert.ok(!/editor note|TODO|FIXME/i.test(visible), 'no leftover editor marks');
  console.log('lib/blog-suno-rights.test.js ok');
}

run();
