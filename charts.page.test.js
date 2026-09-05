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
  assert.ok(!/ToneGrid|DistroKid|InterSpace/i.test(html + css + js), 'charts page must not name a store partner');

  const sheetAt = html.indexOf('data-charts-sheet');
  assert.ok(sheetAt > 0, 'how-it-is-calculated sheet is on the same page');
  const visibleHero = html.slice(0, sheetAt);
  assert.ok(visibleHero.includes('Top 100'), 'page says these are SIQA’s Top 100 without opening the sheet');
  assert.ok(visibleHero.includes('These are SIQA’s weekly Top 100 AI songs.'), 'Top 100 line is exact');
  assert.ok(visibleHero.includes('Ranked 50/50 streams + airplay vs social. Method is SIQA’s.'), 'ranking teaser is visible next to Top 100');
  assert.ok(visibleHero.includes('How it’s calculated'), 'exact button label How it’s calculated is visible');
  assert.ok(/<button[^>]*data-charts-calc-open[^>]*>How it’s calculated<\/button>/.test(visibleHero), 'How it’s calculated is an on-page button');
  assert.ok(html.includes('week of Aug 25, 2026'), 'sheet names week of Aug 25, 2026');
  assert.ok(html.includes('50% streams'), 'page source includes 50% streams');
  assert.ok(html.includes('emailplaiground@gmail.com'), 'page source includes emailplaiground@gmail.com');
  assert.ok(html.includes('thesiqa.com/charts-faq'), 'page source includes thesiqa.com/charts-faq');
  assert.ok(
    html.includes('These are SIQA’s weekly Top 100 AI songs (week of Aug 25, 2026 until they update).'),
    'sheet week line is locked'
  );
  assert.ok(
    html.includes('SIQA’s public score is 50% streams and airplay + 50% social impact. Listening: Spotify, Apple Music, YouTube. Social: TikTok, Instagram Reels. Discovery includes Shazam. Inner math is theirs and proprietary. Updates Tuesdays 12pm PT. No pay-to-chart.'),
    'sheet method copy is locked'
  );
  assert.ok(
    html.includes('We love this because it is an honest AI chart with a disclosed method, not a fake playlist buy.'),
    'sheet why-we-love copy is locked'
  );
  assert.ok(
    html.includes('If you run charts (genre, language, country, AI-class) and want them listened-to on PLAIGROUND, write'),
    'sheet invite copy is locked'
  );
  assert.ok(html.includes('https://www.thesiqa.com/charts-faq'), 'official SIQA FAQ is a real outbound URL');
  assert.ok(html.includes('data-charts-sheet-close'), 'sheet closes from X or backdrop');
  assert.ok(!/youtube\.com\/watch/.test(html) && !/youtu\.be/.test(html), 'no YouTube watch links on /charts');
  assert.ok(!read('index.html').includes('How it’s calculated'), 'homepage files unchanged');
  assert.ok(!read('index.html').includes('thesiqa.com/charts-faq'), 'homepage files unchanged');
  assert.ok(!read('index.html').includes('50% streams and airplay'), 'homepage files unchanged');

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

  const playerHtml = html.slice(html.indexOf('data-charts-player'), html.indexOf('<footer>'));
  assert.ok(playerHtml.length > 0, 'player bar markup is on the page');
  assert.ok(/<iframe[^>]*data-charts-frame/.test(playerHtml), 'player is a YouTube iframe embed');
  assert.ok(html.includes('https://www.youtube.com/iframe_api'), 'page loads the YouTube IFrame Player API');
  assert.ok(js.includes('onYouTubeIframeAPIReady') && js.includes('YT.Player'), 'JS binds the IFrame Player API');
  assert.ok(js.includes('onStateChange'), 'player watches YouTube state so the next chart song can autoplay');
  assert.ok(js.includes('playAt(currentIndex + 1)'), 'ended songs advance to the next row');
  assert.ok(html.includes('data-charts-browse'), 'browse iframe keeps the player open across the site');
  assert.ok(/class="charts-browse"/.test(css) || /html\.is-charts-browse/.test(css), 'browse iframe stays above the player bar');
  assert.ok(js.includes('https://www.youtube.com/embed/'), 'embed URL is youtube.com/embed/VIDEO_ID');
  assert.ok(js.includes('modestbranding=1'), 'embed uses modestbranding=1');
  assert.ok(js.includes('rel=0'), 'embed uses rel=0');
  assert.ok(js.includes('playsinline=1'), 'embed uses playsinline=1');
  assert.ok(js.includes('origin=https://www.wannaplai.com'), 'embed sets origin to wannaplai.com');
  assert.ok(js.includes('enablejsapi=1'), 'embed enables the IFrame API');
  assert.ok(!/allowfullscreen/i.test(playerHtml), 'player iframe does not request fullscreen');
  assert.ok(!/picture-in-picture/i.test(playerHtml), 'player iframe does not request picture-in-picture');
  assert.ok(!/youtube\.com\/watch/.test(js) && !/youtube\.com\/watch/.test(playerHtml), 'no youtube.com/watch in player or JS');
  assert.ok(!/youtu\.be/.test(js) && !/youtu\.be/.test(playerHtml), 'no youtu.be links in player or JS');
  assert.ok(!/window\.location/.test(js) && !/window\.open/.test(js), 'player never navigates or opens a window');
  assert.ok(!/target="_blank"/.test(playerHtml), 'player bar has no target=_blank');
  assert.ok(!/Open in YouTube|Watch on YouTube/i.test(html + js), 'no owned Open/Watch on YouTube control');
  assert.ok(js.includes('document.createElement("button")'), 'chart rows are on-page buttons');
  assert.ok(/position:\s*fixed/.test(css) || /position:\s*sticky/.test(css), 'player bar stays on the page while scrolling');

  assert.ok(api.includes('youtubei/v1/search'), 'server POSTs InnerTube search');
  assert.ok(/clientName:\s*'WEB'/.test(api), 'InnerTube uses WEB client context');
  assert.ok(api.includes('new Map()') || api.includes('cache'), 'server caches video ids in memory');

  const rewrite = (vercel.rewrites || []).find(function (rule) {
    return rule.source === '/charts' && rule.destination === '/charts.html';
  });
  assert.ok(rewrite, 'vercel.json rewrites /charts to /charts.html');
  const loginRewrite = (vercel.rewrites || []).find(function (rule) {
    return rule.source === '/login' && rule.destination === '/login.html';
  });
  assert.ok(loginRewrite, 'vercel.json rewrites /login to /login.html');
  ['/pricing.html', '/plans.html', '/pricing', '/plans'].forEach(function (source) {
    const rule = (vercel.redirects || []).find(function (row) {
      return row.source === source && String(row.destination).indexOf('#pricing') !== -1;
    });
    assert.ok(rule, 'vercel.json redirects ' + source + ' to the live plans section');
  });

  const nav = html.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(nav, 'charts page keeps the public nav');
  const links = nav[0].match(/<a\b[^>]*>[\s\S]*?<\/a>/g) || [];
  const last = links[links.length - 1] || '';
  assert.ok(/SIQA Charts/.test(last), 'last public nav item is SIQA Charts');
  assert.ok(/href="\/charts"/.test(last), 'SIQA Charts goes to /charts');
  assert.ok(/#F3CB47/.test(last), 'SIQA Charts is gold');

  const dashNav = read('dashboard.html').match(/<nav class="side-nav"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(dashNav, 'dashboard keeps a signed-in side-nav');
  const dashLinks = dashNav[0].match(/<a\b[^>]*>[\s\S]*?<\/a>/g) || [];
  const lastDash = dashLinks[dashLinks.length - 1] || '';
  assert.ok(/SIQA Charts/.test(lastDash), 'signed-in side-nav last item is SIQA Charts');
  assert.ok(/href="\/charts"/.test(lastDash), 'signed-in SIQA Charts goes to /charts');
  assert.ok(/#F3CB47/.test(lastDash), 'signed-in SIQA Charts is gold');
  assert.ok(!read('index.html').includes('class="side-nav"'), 'homepage does not share signed-in side-nav');

  console.log('charts.page.test.js ok');
}

run();
