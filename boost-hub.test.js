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
const TOGGLE = /type="checkbox"|role="switch"|data-video-collect-toggle|video-collect-toggle|already on|upload switch/i;
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
  assert.ok(!PARKED_YT.test(hub), 'parked YouTube views packages must stay off the hub');
  assert.ok(!DEAD_IA.test(hub), 'do not use Playlists / Charts / Social Ads as hub titles');

  const titles = cards.map(function (card) {
    const h3 = card.match(/<h3>([\s\S]*?)<\/h3>/);
    return h3 ? stripTags(h3[1]) : '';
  });
  assert.deepStrictEqual(titles, ['Chart Push', 'Streaming Push', 'Social Push', 'Video Collect']);

  assert.ok(cards[0].includes('href="chart-push.html"'));
  assert.ok(cards[1].includes('href="streaming-push.html"'));
  assert.ok(cards[2].includes('href="social-push.html"'));
  assert.ok(cards[3].includes('href="video-collect.html"'));

  assert.ok(/A broad curator and playlist campaign built to drive chart-eligible activity\./.test(cards[0]));
  assert.ok(/Playlist pitching on Spotify, with outreach to the audiences most likely to keep it\./.test(cards[1]));
  assert.ok(/Real people sharing your song across Instagram and short-form video\./.test(cards[2]));
  assert.ok(!/Coming soon/i.test(hub), 'Boost hub must not say Coming soon');
  assert.ok(/Get paid when someone uses your song in a video\.\s*YouTube, Instagram, Facebook, TikTok\.\s*We take 0%\.\s*You get 100% of the payout\./.test(stripTags(cards[3])));

  cards.forEach(function (card, i) {
    assert.strictEqual(lastLine(card), 'Creator and Pro only.', 'hub card ' + (i + 1) + ' last line must be exactly Creator and Pro only.');
    assert.ok(/Not for sale/.test(card), 'hub card ' + titles[i] + ' keeps Not for sale');
  });

  assert.ok(!BUY.test(hub), 'hub must not be a live buy');
  assert.ok(!/\$203|\$227/.test(hub), 'old package prices must not sit on the hub as checkout');
  assert.ok(!TOGGLE.test(hub), 'hub must not ship a Video Collect toggle');
  assert.ok(!TOGGLE.test(video), 'Video Collect is explainer only — no toggle');
  assert.ok(!fs.existsSync(path.join(__dirname, 'video-collect.js')), 'do not ship a Video Collect toggle script');
  assert.ok(!/video-collect\.js/.test(video), 'Video Collect page must not load a toggle script');

  const tease = index.match(/<section class="landing-tease"[\s\S]*?<\/section>/);
  assert.ok(tease);
  assert.ok(/href="boosts.html">Marketing boosts<\/a>/.test(tease[0]), 'homepage marketing tease points at the Boost hub');
  assert.ok(!/href="video-collect\.html"/.test(tease[0]));

  const chartOpts = optionCards(chart);
  assert.deepStrictEqual(chartOpts.map(function (card) {
    return stripTags((card.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1] || '');
  }), ['Single Top 50', 'Album Top 50', '#1 Video']);

  const streamOpts = optionCards(streaming);
  assert.deepStrictEqual(streamOpts.map(function (card) {
    return stripTags((card.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1] || '');
  }), ['Platinum', 'Diamond', 'Legacy']);

  const videoArticle = video.match(/<article class="boost-explainer"[\s\S]*?<\/article>/)[0];
  assert.ok(/Get paid when someone uses your song in a video\. YouTube, Instagram, Facebook, TikTok\. We take 0%\. You get 100% of the payout\./.test(stripTags(videoArticle)));
  assert.strictEqual(lastLine(videoArticle), 'Creator and Pro only.');

  Object.keys(pages).forEach(function (file) {
    const html = pages[file];
    assert.ok(!VENDOR.test(html), file + ' must never name a vendor or partner');
    assert.ok(!/15\s*%/.test(html), file + ' must not mention a 15% cut');
    if (file !== 'index.html') {
      assert.ok(/Not for sale/.test(html), file + ' keeps Not for sale');
      assert.ok(!BUY.test(html), file + ' must not become a live buy');
      assert.ok(!TOGGLE.test(html), file + ' must not ship a Video Collect toggle');
      assert.ok(/data-require-membership="true"/.test(html));
      assert.ok(html.includes('href="boosts.html">Boosts</a>'));
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
