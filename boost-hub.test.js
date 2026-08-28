'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function lastLine(html) {
  const matches = String(html).match(/<p[^>]*>[\s\S]*?<\/p>/g) || [];
  assert.ok(matches.length, 'card is missing a last line');
  return stripTags(matches[matches.length - 1]);
}

function hubCards(hub) {
  const grid = hub.match(/<div class="boost-hub-grid"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(grid, 'boosts.html is missing the four-card hub grid');
  const cards = grid[1].match(/<a class="boost-hub-card"[\s\S]*?<\/a>/g) || [];
  return cards;
}

function optionCards(html) {
  return html.match(/<article class="boost-option"[\s\S]*?<\/article>/g) || [];
}

const VENDOR = /Flossy|FlossyTheBoss|@Flossy|FTB\b|DistroKid|TuneCore|CD Baby|CDBaby|Believe Digital|The Orchard|UnitedMasters|United Masters|AWAL|Symphonic|Stem Disinter|ToneGrid|Tonegrid/i;
const TOGGLE = /type="checkbox"|role="switch"|data-opt-in|data-video-collect-toggle|video-collect-toggle/i;
const BUY = /Choose Chart Push|Choose Streaming Push|Add to cart|Buy now|Checkout|data-checkout/i;
const PARKED_YT = /YouTube Video Promotion|10k[\s–-]*100k|100k views/i;
const DEAD_IA = /<h3>\s*Playlists\s*<\/h3>|<h3>\s*Charts\s*<\/h3>|<h3>\s*Social Ads\s*<\/h3>/i;

function run() {
  const hub = read('boosts.html');
  const index = read('index.html');
  const chart = read('chart-push.html');
  const streaming = read('streaming-push.html');
  const social = read('social-push.html');
  const video = read('video-collect.html');
  const pages = {
    'boosts.html': hub,
    'chart-push.html': chart,
    'streaming-push.html': streaming,
    'social-push.html': social,
    'video-collect.html': video,
    'index.html': index,
  };

  const cards = hubCards(hub);
  assert.strictEqual(cards.length, 4, 'Boost hub must have exactly four equal cards');
  assert.ok(!/boost-hub-card[\s\S]*YouTube Video Promotion/i.test(hub), 'do not add a fifth YouTube-views card');
  assert.ok(!PARKED_YT.test(hub), 'parked YouTube views packages must stay off the hub');

  const titles = cards.map(function (card) {
    const h3 = card.match(/<h3>([\s\S]*?)<\/h3>/);
    return h3 ? stripTags(h3[1]) : '';
  });
  assert.deepStrictEqual(titles, ['Chart Push', 'Streaming Push', 'Social Push', 'Video Collect']);

  assert.ok(cards[0].includes('href="chart-push.html"'), 'Chart Push card links to its own page');
  assert.ok(cards[1].includes('href="streaming-push.html"'), 'Streaming Push card links to its own page');
  assert.ok(cards[2].includes('href="social-push.html"'), 'Social Push card links to its own page');
  assert.ok(cards[3].includes('href="video-collect.html"'), 'Video Collect card links to its own page');

  assert.ok(/A broad curator and playlist campaign built to drive chart-eligible activity\./.test(cards[0]), 'Chart Push hub blurb stays in PLAIGROUND voice');
  assert.ok(/Playlist pitching on Spotify, with outreach to the audiences most likely to keep it\./.test(cards[1]), 'Streaming Push hub blurb stays');
  assert.ok(/Real people sharing your song across Instagram and short-form video\./.test(cards[2]), 'Social Push hub blurb is the live line');
  assert.ok(!/Coming soon/i.test(cards[2]), 'Social Push coming soon is filled in');
  assert.ok(/Get paid when someone uses your song in a video\.\s*YouTube, Instagram, Facebook, TikTok\.\s*We take 0%\.\s*You get 100% of the payout\./.test(stripTags(cards[3])), 'Video Collect hub copy is locked');

  cards.forEach(function (card, i) {
    assert.strictEqual(lastLine(card), 'Creator and Pro only.', 'hub card ' + (i + 1) + ' last line must be exactly Creator and Pro only.');
    assert.ok(/Not for sale/.test(card), 'hub card ' + titles[i] + ' keeps Not for sale');
  });

  assert.ok(!BUY.test(hub), 'hub must not be a live buy');
  assert.ok(!/\$203|\$227/.test(hub), 'old package prices must not sit on the hub as checkout');
  assert.ok(!TOGGLE.test(hub) && !TOGGLE.test(video), 'Video Collect must not ship a toggle');
  assert.ok(!DEAD_IA.test(hub), 'dead Playlists / Charts / Social Ads titles stay off the hub');

  const tease = index.match(/<section class="landing-tease"[\s\S]*?<\/section>/);
  assert.ok(tease, 'homepage still has the marketing tease');
  assert.ok(/href="boosts.html">Marketing boosts<\/a>/.test(tease[0]), 'homepage marketing tease points at the Boost hub');
  assert.ok(!/href="video-collect\.html"/.test(tease[0]), 'homepage must not make Video Collect its own MSP');
  assert.ok(!/href="chart-push\.html"|href="streaming-push\.html"|href="social-push\.html"/.test(tease[0]), 'homepage tease goes to the hub, not a vendor page');

  const chartOpts = optionCards(chart);
  assert.strictEqual(chartOpts.length, 3, 'Chart Push page lists three charting options');
  assert.deepStrictEqual(chartOpts.map(function (card) {
    return stripTags((card.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1] || '');
  }), ['Single Top 50', 'Album Top 50', '#1 Video']);
  assert.ok(/iTunes/.test(chart), 'Chart Push page names iTunes charting options');
  assert.ok(!/guaranteed #1|guarantee you|#1 result|\bbots?\b/i.test(chart), 'Chart Push must not hype a guaranteed #1 or claim bots');

  const streamOpts = optionCards(streaming);
  assert.strictEqual(streamOpts.length, 3, 'Streaming Push page lists three playlist tiers');
  assert.deepStrictEqual(streamOpts.map(function (card) {
    return stripTags((card.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1] || '');
  }), ['Platinum', 'Diamond', 'Legacy']);
  assert.ok(/Spotify/.test(streaming), 'Streaming Push page stays a Spotify playlist campaign');

  assert.ok(/Instagram clipping campaign/i.test(social) || /Influencers share the song on Reels/i.test(social), 'Social Push page is the Instagram Reels clipping campaign');
  assert.ok(/Reels/.test(social), 'Social Push page names Reels');
  assert.ok(!/Coming soon/i.test(social), 'Social Push page is filled in, not coming soon');

  const videoText = stripTags(video.match(/<article class="boost-explainer"[\s\S]*?<\/article>/)[0]);
  assert.ok(/Get paid when someone uses your song in a video\. YouTube, Instagram, Facebook, TikTok\. We take 0%\. You get 100% of the payout\./.test(videoText), 'Video Collect page uses locked copy');
  assert.strictEqual(lastLine(video.match(/<article class="boost-explainer"[\s\S]*?<\/article>/)[0]), 'Creator and Pro only.');
  assert.ok(!/upload\.html/.test(video) || video.indexOf('data-signed-in-upload') !== -1, 'Video Collect page may keep the signed-in menu upload link');
  assert.ok(!/opt-in|turn on Video Collect|enable Video Collect/i.test(video), 'Video Collect is explainer only');

  Object.keys(pages).forEach(function (file) {
    const html = pages[file];
    assert.ok(!VENDOR.test(html), file + ' must never name a vendor or partner');
    assert.ok(!/15\s*%/.test(html), file + ' must not mention a 15% cut');
    assert.ok(!PARKED_YT.test(html), file + ' must keep YouTube views packages parked');
    if (file !== 'index.html') {
      assert.ok(/Not for sale/.test(html), file + ' keeps Not for sale');
      assert.ok(!BUY.test(html), file + ' must not become a live buy');
      assert.ok(/data-require-membership="true"/.test(html), file + ' stays signed-in');
      assert.ok(html.includes('href="boosts.html">Boosts</a>'), file + ' sidebar Boosts stays on the hub');
    }
  });

  [chart, streaming, social, video].forEach(function (html) {
    optionCards(html).concat(html.match(/<article class="boost-explainer"[\s\S]*?<\/article>/g) || []).forEach(function (card) {
      assert.strictEqual(lastLine(card), 'Creator and Pro only.');
    });
  });

  console.log('boost-hub.test.js ok');
}

run();
