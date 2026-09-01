'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function run() {
  const html = read('charts.html');
  const css = read('charts.css');
  const js = read('charts.js');
  const api = read('api/youtube.js');
  const vercel = JSON.parse(read('vercel.json'));
  const chart = JSON.parse(read('data/siqa-chart.json'));

  assert.ok(html.includes('Listen-only'), 'badge is Listen-only');
  assert.ok(html.includes('SIQA’s chart · player by PLAIGROUND'), 'kicker is exact');
  assert.ok(html.includes('Hear the chart.'), 'headline starts Hear the chart.');
  assert.ok(html.includes('Don’t search it.'), 'headline ends Don’t search it.');
  assert.ok(
    html.includes('SIQA ranks the week. We added play so you can tap a song and listen — instead of hunting every title on YouTube.'),
    'lead copy is exact'
  );
  assert.ok(html.includes('https://www.thesiqa.com/charts'), 'official charts URL is present');
  assert.ok(html.includes('Official charts:'), 'Official charts label is present');
  assert.ok(html.includes('Week of August 25th, 2026'), 'week line is exact');
  assert.ok(html.includes('Not affiliated · not a copy of SIQA'), 'disclaimer is exact');
  assert.ok(html.includes('assets/plaiground-logo.png'), 'uses the existing PLAIGROUND logo');
  assert.ok(!/collab/i.test(html) && !/PLAIGROUND × SIQA/.test(html), 'must not call this a collab');
  assert.ok(!/ToneGrid|DistroKid|InterSpace/i.test(html), 'charts page must not name a store partner');

  assert.ok(/#D03083/.test(css) && /#F3CB47/.test(css) && /#782FB1/.test(css), 'charts CSS uses brand pink, gold, purple');
  assert.ok(/#61B63A/.test(css) && /#F09416/.test(css) && /#08060C/.test(css), 'charts CSS uses brand green, orange, dark');

  assert.strictEqual(chart.week, 'August 25th, 2026');
  assert.strictEqual(chart.official, 'https://www.thesiqa.com/charts');
  assert.strictEqual(chart.tracks.length, 100, 'Top 100 only');
  assert.strictEqual(chart.tracks[0].rank, 1);
  assert.strictEqual(chart.tracks[0].title, 'RUBBERZ');
  assert.strictEqual(chart.tracks[0].artist, 'Fenix Flexin');
  assert.strictEqual(chart.tracks[0].youtubeId, 'Hl5_Lc6b3AU', 'rank 1 YouTube id is hardcoded');
  assert.strictEqual(chart.tracks[99].rank, 100);
  assert.strictEqual(chart.tracks[99].title, 'Iron Sharpens Iron');
  chart.tracks.forEach(function (track, i) {
    assert.strictEqual(track.rank, i + 1, 'ranks stay 1–100 in order');
    assert.ok(track.title && track.artist, 'track ' + track.rank + ' has title and artist');
    if (track.rank !== 1) assert.ok(!track.youtubeId, 'only rank 1 ships a youtubeId');
  });

  assert.ok(js.includes('Hl5_Lc6b3AU'), 'player hardcodes rank 1 id');
  assert.ok(js.includes('/api/youtube'), 'browser calls our YouTube API');
  assert.ok(!/youtubei\/v1\/search/.test(js), 'browser must not call InnerTube');
  assert.ok(!/AIza/.test(js) && !/AIza/.test(html), 'no YouTube API key in the frontend');

  assert.ok(api.includes('youtubei/v1/search'), 'server POSTs InnerTube search');
  assert.ok(/clientName:\s*'WEB'/.test(api), 'InnerTube uses WEB client context');
  assert.ok(api.includes('new Map()') || api.includes('cache'), 'server caches video ids in memory');

  const rewrite = (vercel.rewrites || []).find(function (rule) {
    return rule.source === '/charts' && rule.destination === '/charts.html';
  });
  assert.ok(rewrite, 'vercel.json rewrites /charts to /charts.html');

  const nav = html.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(nav, 'charts page keeps the public nav');
  const links = nav[0].match(/<a\b[^>]*>[\s\S]*?<\/a>/g) || [];
  const last = links[links.length - 1] || '';
  assert.ok(/SIQA Charts/.test(last), 'last public nav item is SIQA Charts');
  assert.ok(/href="\/charts"/.test(last), 'SIQA Charts goes to /charts');
  assert.ok(/#F3CB47/.test(last), 'SIQA Charts is gold');

  console.log('charts.page.test.js ok');
}

run();
