'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const verify = require('./feature-verification');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function run() {
  assert.strictEqual(verify.digits('0123-4567-8901'), '012345678901');
  assert.strictEqual(verify.digits(' UPC 0123456789012 '), '0123456789012');
  assert.strictEqual(verify.message('012345678901'), 'Verifying for UPC 012345678901');
  assert.strictEqual(verify.isUpc('012345678901'), true);
  assert.strictEqual(verify.isUpc('0123456789012'), true);
  assert.strictEqual(verify.isUpc('01234567890'), false);
  assert.strictEqual(verify.isUpc('01234567890123'), false);

  const href = verify.xHref('012345678901');
  assert.ok(href.indexOf('https://x.com/messages/compose?recipient_id=1466086093&text=') === 0, href);
  assert.ok(href.indexOf(encodeURIComponent('Verifying for UPC 012345678901')) !== -1, href);
  assert.strictEqual(verify.xHref('123'), verify.X_FALLBACK);
  assert.strictEqual(verify.IG_PATH, 'https://ig.me/m/distrokid');

  const page = read('feature-verification.html');
  assert.ok(page.includes('<h1>DM DistroKid with your UPC</h1>'));
  assert.ok(page.includes('src="/lib/feature-verification.js"'));
  assert.ok(page.includes('window.open(api.IG_PATH'));
  assert.ok(page.includes('Copy message and open Instagram'));
  assert.ok(page.includes('Enter a 12 or 13 digit UPC first.'));
  assert.ok(!/—|–/.test(page), 'feature page has no em dash');
  assert.ok(!/Suno/i.test(page), 'feature page does not name Suno');

  const help = 'Need to verify a featured artist with DistroKid?';
  assert.ok(read('upload.html').includes(help));
  assert.ok(read('song.html').includes(help));
  assert.ok(read('upload.html').includes('href="/feature-verification"'));
  assert.ok(read('song.html').includes('href="/feature-verification"'));

  const hub = read('blog.html');
  assert.ok(/Seventy-nine posts\./.test(hub));
  assert.ok(hub.indexOf('/blog/when-the-stage-owns-the-pipe') < hub.indexOf('/blog/your-suno-song-your-rights'));
  assert.ok(hub.indexOf('/blog/suno-visuals-music-videos') < hub.indexOf('/blog/your-suno-song-your-rights'));

  const yankee = read('blog-when-the-stage-owns-the-pipe.html');
  assert.ok(yankee.includes('PLAIGROUND takes no commission to release your music. Publishing and placements are separate services with their own agreements.'));
  assert.ok(!yankee.includes('no commission on the store royalties from your distributed masters'));
  assert.ok(yankee.includes('href="/terms.html"'));
  assert.ok(yankee.includes('TikTok') && yankee.includes('DistroKid') && yankee.includes('TuneCore') && yankee.includes('CD Baby'));
  assert.ok(yankee.includes('<h1>When the stage owns the pipe: what TikTok\'s Daddy Yankee deal means for independent creators</h1>'));
  assert.ok(!/—|–/.test(yankee));

  const visuals = read('blog-suno-visuals-music-videos.html');
  assert.ok(visuals.includes('H3 Move'));
  assert.ok(visuals.includes('MiniMax'));
  assert.ok(/Visual credits are separate from Song credits/.test(visuals));
  assert.ok(visuals.includes('9:16'));
  assert.ok(visuals.includes('3 to 8 seconds'));
  assert.ok(/lip-sync off/.test(visuals));
  assert.ok(visuals.includes('<h1>Suno Visuals: what your song can look like now</h1>'));
  assert.ok(!/—|–/.test(visuals));

  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(vercel.rewrites.some(function (row) {
    return row.source === '/feature-verification' && row.destination === '/feature-verification.html';
  }));
  assert.ok(vercel.rewrites.some(function (row) {
    return row.source === '/feature-verification/' && row.destination === '/feature-verification.html';
  }));
  assert.ok(vercel.rewrites.some(function (row) {
    return row.source === '/blog/when-the-stage-owns-the-pipe' && row.destination === '/blog-when-the-stage-owns-the-pipe.html';
  }));
  assert.ok(vercel.rewrites.some(function (row) {
    return row.source === '/blog/suno-visuals-music-videos' && row.destination === '/blog-suno-visuals-music-videos.html';
  }));

  const sitemap = read('sitemap.xml');
  assert.ok(sitemap.includes('<loc>https://www.wannaplai.com/blog</loc><lastmod>2026-11-19</lastmod>'));
  assert.ok(sitemap.includes('<loc>https://www.wannaplai.com/blog/when-the-stage-owns-the-pipe</loc><lastmod>2026-11-19</lastmod>'));
  assert.ok(sitemap.includes('<loc>https://www.wannaplai.com/blog/suno-visuals-music-videos</loc><lastmod>2026-11-19</lastmod>'));
  assert.ok(sitemap.includes('<loc>https://www.wannaplai.com/feature-verification</loc><lastmod>2026-11-19</lastmod>'));

  const apiFiles = fs.readdirSync(path.join(__dirname, '..', 'api'));
  assert.ok(!apiFiles.some(function (name) { return /feature-verification/.test(name); }), 'no new api/ file');

  console.log('lib/feature-verification.test.js ok');
}

run();
