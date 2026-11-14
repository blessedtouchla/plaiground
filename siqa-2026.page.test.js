'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = __dirname;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const files = [
  'siqa-2026.html',
  'siqa-2026-highlights.html',
  'siqa-daydream-interview.html',
  'siqa-post-four-to-five-times-a-day.html',
  'siqa-merch-start-with-10.html',
  'siqa-every-ai-artist-needs-a-music-video.html',
  'siqa-this-is-a-tool.html',
  'siqa-ava-bentley-interview.html',
  'siqa-ava-bentley-acceptance-speech.html'
];

const banned = [
  '[VERIFY]',
  'noindex',
  'German Nunez',
  'Romel Murphy',
  'Vanera',
  'sat down',
  'Grok',
  'superintelligence',
  'Sony',
  'Artists keep their ownership',
  'MonkMotion.com',
  'monkmotion.com',
  'Ava Bently',
  'ava-bently'
];

const videos = {
  'siqa-daydream-interview.html': {
    id: '1W0z9TijpFJqMOHncT0nxQyOumvjqS_P3',
    duration: 'PT6M27S',
    uploadDate: '2026-11-12T12:37:00-08:00'
  },
  'siqa-post-four-to-five-times-a-day.html': {
    id: '1xrBCBlY1lWlrhTVtzR7uiaA1sXW-MrPm',
    duration: 'PT5M49S',
    uploadDate: '2026-11-12T12:09:00-08:00'
  },
  'siqa-merch-start-with-10.html': {
    id: '1xrBCBlY1lWlrhTVtzR7uiaA1sXW-MrPm',
    duration: 'PT5M49S',
    uploadDate: '2026-11-12T12:09:00-08:00'
  },
  'siqa-every-ai-artist-needs-a-music-video.html': {
    id: '1LWw0PkkGtMrTxYVr5x_kYmnKgowOPoF-',
    duration: 'PT1M11S',
    uploadDate: '2026-11-12T10:54:00-08:00'
  },
  'siqa-this-is-a-tool.html': {
    id: '1eQAyFAuYZygE8C0sNp8VUXSlFY9q1wMn',
    duration: 'PT4M19S',
    uploadDate: '2026-11-12T10:58:00-08:00'
  },
  'siqa-ava-bentley-interview.html': {
    id: '1RhzAw6Svn84xPIIeEOxCowKkHF9DY8Pv',
    duration: 'PT2M30S',
    uploadDate: '2026-11-13T21:12:00-08:00'
  },
  'siqa-ava-bentley-acceptance-speech.html': {
    id: '1Z2Moh1oB6gZRzrZ9DZfhxdoEeJD9nTB8',
    duration: 'PT4M19S',
    uploadDate: '2026-11-13'
  }
};

const paths = {
  'siqa-2026.html': '/siqa/2026',
  'siqa-2026-highlights.html': '/siqa/2026/siqa-2026-highlights',
  'siqa-daydream-interview.html': '/siqa/2026/daydream-interview',
  'siqa-post-four-to-five-times-a-day.html': '/siqa/2026/post-four-to-five-times-a-day',
  'siqa-merch-start-with-10.html': '/siqa/2026/merch-start-with-10',
  'siqa-every-ai-artist-needs-a-music-video.html': '/siqa/2026/every-ai-artist-needs-a-music-video',
  'siqa-this-is-a-tool.html': '/siqa/2026/this-is-a-tool',
  'siqa-ava-bentley-interview.html': '/siqa/2026/ava-bentley-interview',
  'siqa-ava-bentley-acceptance-speech.html': '/siqa/2026/ava-bentley-acceptance-speech'
};

assert.strictEqual(fs.existsSync(path.join(root, 'siqa-sony-interview.html')), false);

const vercel = JSON.parse(read('vercel.json'));
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(function (match) { return match[1]; });
assert.strictEqual(new Set(locs).size, locs.length, 'sitemap locs are unique');

files.forEach(function (file) {
  const html = read(file);
  banned.forEach(function (word) {
    assert.ok(!html.includes(word), file + ' contains ' + word);
  });
  assert.ok(html.includes('<h1>'), file + ' h1');
  assert.ok(html.includes('href="/signup">Join free</a>'), file + ' join free');
  assert.ok(html.includes('href="/song-helper">Song Lab</a>'), file + ' song lab');
  assert.ok(html.includes('https://registry.thesiqa.com/submit'), file + ' siqa verified');
  assert.ok(html.includes('Get SIQA Verified'), file + ' verified label');
  assert.ok(html.includes('rel="canonical" href="https://www.wannaplai.com' + paths[file] + '"'), file + ' canonical');
  assert.ok(!html.includes('name="robots"'), file + ' should not set a robots meta');
  if (file !== 'siqa-2026.html') {
    assert.ok(html.includes('href="/siqa/2026"'), file + ' links to the hub');
  }
});

Object.keys(videos).forEach(function (file) {
  const html = read(file);
  const spec = videos[file];
  const embed = 'https://drive.google.com/file/d/' + spec.id + '/preview';
  assert.ok(html.includes('src="' + embed + '"'), file + ' iframe');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(function (match) {
    return JSON.parse(match[1]);
  });
  const video = blocks.find(function (block) { return block['@type'] === 'VideoObject'; });
  assert.ok(video, file + ' VideoObject');
  assert.ok(video.name && video.description && video.uploadDate && video.duration && video.embedUrl);
  assert.strictEqual(video.embedUrl, embed);
  assert.strictEqual(video.duration, spec.duration);
  assert.strictEqual(video.uploadDate, spec.uploadDate);
});

assert.ok(!read('siqa-2026-highlights.html').includes('drive.google.com/file'), 'highlights has no full-cut embed');
assert.ok(read('siqa-2026-highlights.html').includes('VANYRA X'));
assert.ok(read('siqa-2026-highlights.html').includes('Bijou Nicole'));
assert.ok(read('siqa-2026-highlights.html').includes('Best AI Rock/Alt Song'));
assert.ok(read('siqa-2026-highlights.html').includes('announced'));
assert.ok(read('siqa-daydream-interview.html').includes('dai+drm'));
assert.ok(read('siqa-daydream-interview.html').includes('instagram.com/dai_drm'));
assert.ok(read('siqa-daydream-interview.html').includes('standing'));
assert.ok(!read('siqa-daydream-interview.html').includes('taking ownership'));
assert.ok(read('siqa-every-ai-artist-needs-a-music-video.html').includes('MonkMotion'));
assert.ok(read('siqa-this-is-a-tool.html').includes("Don't quit your day jobs."));
assert.ok(read('siqa-ava-bentley-interview.html').includes('Ava Bentley'));
assert.ok(read('siqa-ava-bentley-interview.html').includes('instagram.com/avabentlymusic'));
assert.ok(read('siqa-ava-bentley-interview.html').includes('standing'));
assert.ok(read('siqa-ava-bentley-interview.html').includes('SIQA Music Awards, Fri Nov 13, 2026'));
assert.ok(read('siqa-ava-bentley-acceptance-speech.html').includes('SIQA Music Awards, Fri Nov 13, 2026'));
assert.ok(read('siqa-ava-bentley-acceptance-speech.html').includes('announced on stage'));
assert.ok(read('siqa-ava-bentley-acceptance-speech.html').includes('https://www.instagram.com/reel/Dft-HF0jZRH/'));
assert.ok(read('siqa-merch-start-with-10.html').includes('dai+drm artists keep their show money'));
assert.ok(read('siqa-post-four-to-five-times-a-day.html').includes('one 5:49 full cut'));

Object.keys(paths).forEach(function (file) {
  const loc = 'https://www.wannaplai.com' + paths[file];
  assert.ok(locs.includes(loc), 'sitemap missing ' + loc);
  assert.ok(vercel.rewrites.some(function (row) {
    return row.source === paths[file] && row.destination === '/' + file;
  }), 'rewrite missing ' + paths[file]);
});

assert.ok(!locs.some(function (loc) { return loc.includes('sony') || loc.includes('ava-bently'); }));

[
  ['/siqa/2026/ava-bently-interview', '/siqa/2026/ava-bentley-interview'],
  ['/siqa/2026/ava-bently-interview/', '/siqa/2026/ava-bentley-interview'],
  ['/siqa/2026/ava-bently-acceptance-speech', '/siqa/2026/ava-bentley-acceptance-speech'],
  ['/siqa/2026/ava-bently-acceptance-speech/', '/siqa/2026/ava-bentley-acceptance-speech']
].forEach(function (pair) {
  const row = vercel.redirects.find(function (item) { return item.source === pair[0]; });
  assert.ok(row, 'missing redirect ' + pair[0]);
  assert.strictEqual(row.destination, pair[1]);
  assert.strictEqual(row.permanent, true);
});

const shorts = [
  ['/siqa', '/siqa/2026'],
  ['/siqa/', '/siqa/2026'],
  ['/ava', '/siqa/2026/ava-bentley-acceptance-speech'],
  ['/ava/', '/siqa/2026/ava-bentley-acceptance-speech'],
  ['/ava-interview', '/siqa/2026/ava-bentley-interview'],
  ['/ava-interview/', '/siqa/2026/ava-bentley-interview'],
  ['/daydream', '/siqa/2026/daydream-interview'],
  ['/daydream/', '/siqa/2026/daydream-interview'],
  ['/post5', '/siqa/2026/post-four-to-five-times-a-day'],
  ['/post5/', '/siqa/2026/post-four-to-five-times-a-day'],
  ['/merch10', '/siqa/2026/merch-start-with-10'],
  ['/merch10/', '/siqa/2026/merch-start-with-10'],
  ['/musicvideo', '/siqa/2026/every-ai-artist-needs-a-music-video'],
  ['/musicvideo/', '/siqa/2026/every-ai-artist-needs-a-music-video'],
  ['/tool', '/siqa/2026/this-is-a-tool'],
  ['/tool/', '/siqa/2026/this-is-a-tool'],
  ['/siqa-highlights', '/siqa/2026/siqa-2026-highlights'],
  ['/siqa-highlights/', '/siqa/2026/siqa-2026-highlights']
];
shorts.forEach(function (pair) {
  const hits = vercel.redirects.filter(function (item) { return item.source === pair[0]; });
  assert.strictEqual(hits.length, 1, 'redirect count for ' + pair[0]);
  assert.strictEqual(hits[0].destination, pair[1]);
  assert.strictEqual(hits[0].permanent, true);
  assert.ok(!vercel.rewrites.some(function (item) { return item.source === pair[0]; }), pair[0] + ' must stay a redirect');
});

const hub = read('siqa-2026.html');
assert.ok(hub.includes('class="siqa-links"'));
shorts.filter(function (pair) { return pair[1] !== '/siqa/2026' && !pair[0].endsWith('/'); }).forEach(function (pair) {
  assert.ok(hub.includes('class="siqa-link" href="' + pair[1] + '"'), 'hub card ' + pair[1]);
});
assert.strictEqual((hub.match(/class="siqa-link"/g) || []).length, 8);

assert.ok(!read('site.js').includes('/siqa/2026'), 'main nav script unchanged');
assert.ok(!read('index.html').includes('/siqa/2026'), 'homepage nav unchanged');

console.log('siqa-2026.page.test.js ok');
