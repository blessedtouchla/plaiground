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
  'siqa-ava-bently-interview.html',
  'siqa-ava-bently-acceptance-speech.html',
  'siqa-sheena-taylor.html',
  'siqa-tammy-taylor.html',
  'siqa-olivia-b-moore.html',
  'siqa-colourfull4life.html',
  'siqa-rebel-redeemed-316.html',
  'siqa-dj-shawn-q.html',
  'siqa-slime-dot.html',
  'siqa-astrazit.html',
  'siqa-aries-ivory.html'
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
  'Ava Bentley',
  'ava-bentley'
];

const videos = {
  'siqa-daydream-interview.html': {
    id: 'ElACta-GPZI',
    duration: 'PT6M27S',
    uploadDate: '2026-11-12T12:37:00-08:00'
  },
  'siqa-post-four-to-five-times-a-day.html': {
    id: '9p78NHE0Q90',
    duration: 'PT5M49S',
    uploadDate: '2026-11-12T12:09:00-08:00'
  },
  'siqa-merch-start-with-10.html': {
    id: '9p78NHE0Q90',
    duration: 'PT5M49S',
    uploadDate: '2026-11-12T12:09:00-08:00'
  },
  'siqa-every-ai-artist-needs-a-music-video.html': {
    id: 'j9803hyCMYA',
    duration: 'PT1M11S',
    uploadDate: '2026-11-12T10:54:00-08:00'
  },
  'siqa-this-is-a-tool.html': {
    id: 'xJ4BdjSZbJA',
    duration: 'PT4M19S',
    uploadDate: '2026-11-12T10:58:00-08:00'
  },
  'siqa-ava-bently-interview.html': {
    id: 'Nle-samaNpE',
    duration: 'PT2M30S',
    uploadDate: '2026-11-13T21:12:00-08:00'
  },
  'siqa-ava-bently-acceptance-speech.html': {
    id: 'JyRvo9Pu72Q',
    duration: 'PT4M19S',
    uploadDate: '2026-11-13'
  },
  'siqa-sheena-taylor.html': {
    id: '6fRXiLr6Bv8',
    uploadDate: '2026-11-13'
  },
  'siqa-tammy-taylor.html': {
    id: '0rmGy6K7Fuo',
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
  'siqa-ava-bently-interview.html': '/siqa/2026/ava-bently-interview',
  'siqa-ava-bently-acceptance-speech.html': '/siqa/2026/ava-bently-acceptance-speech',
  'siqa-sheena-taylor.html': '/siqa/2026/sheena-taylor',
  'siqa-tammy-taylor.html': '/siqa/2026/tammy-taylor',
  'siqa-olivia-b-moore.html': '/siqa/2026/olivia-b-moore',
  'siqa-colourfull4life.html': '/siqa/2026/colourfull4life',
  'siqa-rebel-redeemed-316.html': '/siqa/2026/rebel-redeemed-316',
  'siqa-dj-shawn-q.html': '/siqa/2026/dj-shawn-q',
  'siqa-slime-dot.html': '/siqa/2026/slime-dot',
  'siqa-astrazit.html': '/siqa/2026/astrazit',
  'siqa-aries-ivory.html': '/siqa/2026/aries-ivory'
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
  const embed = 'https://www.youtube-nocookie.com/embed/' + spec.id;
  const watch = 'https://www.youtube.com/watch?v=' + spec.id;
  assert.ok(html.includes('src="' + embed + '?playsinline=1"'), file + ' iframe');
  assert.ok(html.includes('playsinline'), file + ' playsinline');
  assert.ok(html.includes('allowfullscreen'), file + ' allowfullscreen');
  assert.ok(html.includes('href="' + watch + '"'), file + ' watch link');
  assert.ok(html.includes('Watch on YouTube'), file + ' watch label');
  assert.ok(!html.includes('drive.google.com'), file + ' still has Drive');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(function (match) {
    return JSON.parse(match[1]);
  });
  const video = blocks.find(function (block) { return block['@type'] === 'VideoObject'; });
  assert.ok(video, file + ' VideoObject');
  assert.ok(video.name && video.description && video.uploadDate && video.embedUrl && video.contentUrl);
  assert.strictEqual(video.embedUrl, embed);
  assert.strictEqual(video.contentUrl, watch);
  if (spec.duration) assert.strictEqual(video.duration, spec.duration);
  assert.strictEqual(video.uploadDate, spec.uploadDate);
});

assert.ok(!read('siqa-2026-highlights.html').includes('drive.google.com'), 'highlights has no Drive embed');
assert.ok(!read('siqa-2026-highlights.html').includes('youtube.com'), 'highlights stays a text page');
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
assert.ok(read('siqa-ava-bently-interview.html').includes('Ava Bently'));
assert.ok(read('siqa-ava-bently-interview.html').includes('instagram.com/avabentlymusic'));
assert.ok(read('siqa-ava-bently-interview.html').includes('standing'));
assert.ok(read('siqa-ava-bently-interview.html').includes('SIQA Music Awards, Fri Nov 13, 2026'));
assert.ok(read('siqa-ava-bently-acceptance-speech.html').includes('SIQA Music Awards, Fri Nov 13, 2026'));
assert.ok(read('siqa-ava-bently-acceptance-speech.html').includes('announced on stage'));
assert.ok(read('siqa-ava-bently-acceptance-speech.html').includes('I am Ava Bently.'));
assert.ok(read('siqa-ava-bently-acceptance-speech.html').includes('https://www.instagram.com/reel/Dft-HF0jZRH/'));
assert.ok(read('siqa-merch-start-with-10.html').includes('dai+drm artists keep their show money'));
assert.ok(read('siqa-post-four-to-five-times-a-day.html').includes('one 5:49 full cut'));

Object.keys(paths).forEach(function (file) {
  const loc = 'https://www.wannaplai.com' + paths[file];
  assert.ok(locs.includes(loc), 'sitemap missing ' + loc);
  assert.ok(vercel.rewrites.some(function (row) {
    return row.source === paths[file] && row.destination === '/' + file;
  }), 'rewrite missing ' + paths[file]);
});

assert.ok(!locs.some(function (loc) { return loc.includes('sony') || loc.includes('ava-bentley'); }));

[
  ['/siqa/2026/ava-bentley-interview', '/siqa/2026/ava-bently-interview'],
  ['/siqa/2026/ava-bentley-interview/', '/siqa/2026/ava-bently-interview'],
  ['/siqa/2026/ava-bentley-acceptance-speech', '/siqa/2026/ava-bently-acceptance-speech'],
  ['/siqa/2026/ava-bentley-acceptance-speech/', '/siqa/2026/ava-bently-acceptance-speech']
].forEach(function (pair) {
  const row = vercel.redirects.find(function (item) { return item.source === pair[0]; });
  assert.ok(row, 'missing redirect ' + pair[0]);
  assert.strictEqual(row.destination, pair[1]);
  assert.strictEqual(row.permanent, true);
});

const shorts = [
  ['/siqa', '/siqa/2026'],
  ['/siqa/', '/siqa/2026'],
  ['/ava', '/siqa/2026/ava-bently-acceptance-speech'],
  ['/ava/', '/siqa/2026/ava-bently-acceptance-speech'],
  ['/ava-interview', '/siqa/2026/ava-bently-interview'],
  ['/ava-interview/', '/siqa/2026/ava-bently-interview'],
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
  ['/sheena', '/siqa/2026/sheena-taylor'],
  ['/sheena/', '/siqa/2026/sheena-taylor'],
  ['/tammy', '/siqa/2026/tammy-taylor'],
  ['/tammy/', '/siqa/2026/tammy-taylor'],
  ['/olivia', '/siqa/2026/olivia-b-moore'],
  ['/olivia/', '/siqa/2026/olivia-b-moore'],
  ['/colourfull4life', '/siqa/2026/colourfull4life'],
  ['/colourfull4life/', '/siqa/2026/colourfull4life'],
  ['/rebel-redeemed-316', '/siqa/2026/rebel-redeemed-316'],
  ['/rebel-redeemed-316/', '/siqa/2026/rebel-redeemed-316'],
  ['/dj-shawn-q', '/siqa/2026/dj-shawn-q'],
  ['/dj-shawn-q/', '/siqa/2026/dj-shawn-q'],
  ['/slime-dot', '/siqa/2026/slime-dot'],
  ['/slime-dot/', '/siqa/2026/slime-dot'],
  ['/astrazit', '/siqa/2026/astrazit'],
  ['/astrazit/', '/siqa/2026/astrazit'],
  ['/aries-ivory', '/siqa/2026/aries-ivory'],
  ['/aries-ivory/', '/siqa/2026/aries-ivory'],
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
assert.strictEqual((hub.match(/class="siqa-link"/g) || []).length, 17);
assert.ok(!read('siqa-sheena-taylor.html').includes('instagram.com/'));
assert.ok(!read('siqa-tammy-taylor.html').includes('instagram.com/'));
assert.ok(!/sat down/i.test(read('siqa-sheena-taylor.html') + read('siqa-tammy-taylor.html') + read('siqa-olivia-b-moore.html') + read('siqa-colourfull4life.html')));

const reels = {
  'siqa-olivia-b-moore.html': ['DfvrZDiho5n', 'DfvrIeFvT81'],
  'siqa-colourfull4life.html': ['Dfvq0fEN41U'],
  'siqa-rebel-redeemed-316.html': ['Dfvu_ZDuR40'],
  'siqa-dj-shawn-q.html': ['DfvviYUPCHa'],
  'siqa-slime-dot.html': ['Dfvv6YZNJgK'],
  'siqa-astrazit.html': ['DfvwMm6h8oi'],
  'siqa-aries-ivory.html': ['DfvwlaSt882']
};
Object.keys(reels).forEach(function (file) {
  const html = read(file);
  reels[file].forEach(function (code) {
    const embed = 'https://www.instagram.com/reel/' + code + '/embed';
    const watch = 'https://www.instagram.com/reel/' + code + '/';
    assert.ok(html.includes('src="' + embed + '"'), file + ' iframe ' + code);
    assert.ok(html.includes('href="' + watch + '"'), file + ' watch ' + code);
  });
  assert.ok(html.includes('Watch on Instagram'), file + ' watch label');
  assert.ok(html.includes('allowfullscreen'), file + ' allowfullscreen');
  assert.ok(!html.includes('youtube.com'), file + ' has no YouTube');
  assert.ok(!html.includes('drive.google.com'), file + ' has no Drive');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(function (match) {
    return JSON.parse(match[1]);
  });
  const videosLd = blocks.filter(function (block) { return block['@type'] === 'VideoObject'; });
  assert.strictEqual(videosLd.length, reels[file].length, file + ' VideoObject count');
  reels[file].forEach(function (code) {
    const video = videosLd.find(function (block) { return block.embedUrl.endsWith('/' + code + '/embed'); });
    assert.ok(video, file + ' VideoObject ' + code);
    assert.strictEqual(video.contentUrl, 'https://www.instagram.com/reel/' + code + '/');
    assert.strictEqual(video.uploadDate, '2026-11-13');
  });
});
const olivia = read('siqa-olivia-b-moore.html');
assert.ok(olivia.includes('Backstage at The Mayan'));
assert.ok(olivia.includes('https://www.instagram.com/oliviabmoore/'));
assert.ok(olivia.includes('https://oliviabmoore.com/'));
assert.ok(olivia.includes('No. 2 on the SIQA Top 100 AI Songs chart'));
assert.ok(olivia.includes('AI-generated'));
assert.ok(!olivia.includes('&ldquo;'));
const colour = read('siqa-colourfull4life.html');
assert.ok(colour.includes('Best AI International Song'));
assert.ok(colour.includes('Waltz of Love C4L'));
assert.ok(!colour.includes('instagram.com/colour'));
const colourVisible = colour.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, '');
assert.ok(!colourVisible.includes('@'), 'colourfull4life has no Instagram handle');
assert.ok(!colour.includes('&ldquo;'));
['siqa-rebel-redeemed-316.html', 'siqa-dj-shawn-q.html', 'siqa-slime-dot.html', 'siqa-astrazit.html'].forEach(function (file) {
  assert.ok(!read(file).includes('“'), file + ' has no quote');
  assert.ok(!read(file).includes('&ldquo;'), file + ' has no quote entity');
});
const aries = read('siqa-aries-ivory.html');
assert.ok(aries.includes('Before there was AI, I don\'t think there were any rules when it came to making music. So just because there\'s AI, I don\'t think the rules should start right now.'));
assert.ok(aries.includes('Eric Bellinger'));
assert.ok(aries.includes('https://www.instagram.com/ariesivorymusic/'));
assert.ok(aries.includes('https://www.instagram.com/ericbellinger/'));
assert.strictEqual((aries.match(/“/g) || []).length, 1, 'aries has one quote');

assert.ok(!read('site.js').includes('/siqa/2026'), 'main nav script unchanged');
assert.ok(!read('index.html').includes('/siqa/2026'), 'homepage nav unchanged');

console.log('siqa-2026.page.test.js ok');
