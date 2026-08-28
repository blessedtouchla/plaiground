'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

function makeEl(init) {
  const el = {
    className: (init && init.className) || '',
    hidden: !!(init && init.hidden),
    textContent: (init && init.textContent) || '',
    checked: !!(init && init.checked),
    disabled: !!(init && init.disabled),
    attrs: Object.assign({}, (init && init.attrs) || {}),
    listeners: {},
    classList: {
      contains(name) { return (' ' + el.className + ' ').indexOf(' ' + name + ' ') !== -1; },
      add(name) {
        if (!this.contains(name)) el.className = (el.className + ' ' + name).trim();
      },
      remove(name) {
        el.className = el.className.split(/\s+/).filter(function (part) { return part && part !== name; }).join(' ');
      },
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(el.attrs, name) ? el.attrs[name] : null;
    },
    setAttribute(name, value) { el.attrs[name] = String(value); },
    addEventListener(type, fn) { el.listeners[type] = fn; },
  };
  return el;
}

const VENDOR = /Flossy|FlossyTheBoss|@Flossy|FTB\b|DistroKid|TuneCore|CD Baby|CDBaby|Believe Digital|The Orchard|UnitedMasters|United Masters|AWAL|Symphonic|Stem Disinter|ToneGrid|Tonegrid/i;
const BUY = /Choose Chart Push|Choose Streaming Push|Add to cart|Buy now|Checkout|data-checkout/i;
const PARKED_YT = /YouTube Video Promotion|10k[\s–-]*100k|100k views/i;
const OTHER_TOGGLE = /data-playlist-toggle|data-charts-toggle|data-social-ads-toggle/i;

function run() {
  const hub = read('boosts.html');
  const index = read('index.html');
  const playlists = read('playlists.html');
  const charts = read('charts.html');
  const social = read('social-ads.html');
  const video = read('video-collect.html');
  const pages = {
    'boosts.html': hub,
    'playlists.html': playlists,
    'charts.html': charts,
    'social-ads.html': social,
    'video-collect.html': video,
    'index.html': index,
  };

  const cards = hubCards(hub);
  assert.strictEqual(cards.length, 4, 'Boost hub must have exactly four equal cards');
  assert.ok(!PARKED_YT.test(hub), 'parked YouTube views packages must stay off the hub');

  const titles = cards.map(function (card) {
    const h3 = card.match(/<h3>([\s\S]*?)<\/h3>/);
    return h3 ? stripTags(h3[1]) : '';
  });
  assert.deepStrictEqual(titles, ['Playlists', 'Charts', 'Social Ads', 'Video Collect']);

  assert.ok(cards[0].includes('href="playlists.html"'), 'Playlists card links to its own page');
  assert.ok(cards[1].includes('href="charts.html"'), 'Charts card links to its own page');
  assert.ok(cards[2].includes('href="social-ads.html"'), 'Social Ads card links to its own page');
  assert.ok(cards[3].includes('href="video-collect.html"'), 'Video Collect card links to its own page');

  assert.ok(/Playlist pitching on Spotify/.test(cards[0]), 'Playlists hub blurb stays an explainer');
  assert.ok(/chart-eligible activity/.test(cards[1]), 'Charts hub blurb stays an explainer');
  assert.ok(/Instagram and short-form video/.test(cards[2]), 'Social Ads hub blurb stays an explainer');
  assert.ok(/Get paid when someone uses your song in a video\.\s*YouTube, Instagram, Facebook, TikTok\.\s*We take 0%\.\s*You get 100% of the payout\./.test(stripTags(cards[3])), 'Video Collect hub copy is locked');

  cards.forEach(function (card, i) {
    assert.strictEqual(lastLine(card), 'Creator and Pro only.', 'hub card ' + (i + 1) + ' last line must be exactly Creator and Pro only.');
  });

  assert.ok(!BUY.test(hub), 'hub must not be a live buy');
  assert.ok(!/\$203|\$227/.test(hub), 'old package prices must not sit on the hub as checkout');
  assert.ok(!/type="checkbox"|role="switch"|data-video-collect-toggle/.test(hub), 'hub must not ship the Video Collect toggle');
  assert.ok(!OTHER_TOGGLE.test(hub + playlists + charts + social), 'Playlists / Charts / Social Ads must not get toggles');

  const tease = index.match(/<section class="landing-tease"[\s\S]*?<\/section>/);
  assert.ok(tease, 'homepage still has the marketing tease');
  assert.ok(/href="boosts.html">Marketing boosts<\/a>/.test(tease[0]), 'homepage marketing tease points at the Boost hub');
  assert.ok(!/href="video-collect\.html"/.test(tease[0]), 'homepage must not make Video Collect its own MSP');

  assert.ok(!/type="checkbox"|role="switch"/.test(playlists + charts + social), 'first three pages stay explainer only');
  assert.ok(!/\$\d/.test(playlists + charts + social), 'first three pages must not show prices');

  const playlistOpts = optionCards(playlists);
  assert.strictEqual(playlistOpts.length, 3, 'Playlists page lists three playlist tiers');
  assert.deepStrictEqual(playlistOpts.map(function (card) {
    return stripTags((card.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1] || '');
  }), ['Platinum', 'Diamond', 'Legacy']);

  const chartOpts = optionCards(charts);
  assert.strictEqual(chartOpts.length, 3, 'Charts page lists three charting options');
  assert.deepStrictEqual(chartOpts.map(function (card) {
    return stripTags((card.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1] || '');
  }), ['Single Top 50', 'Album Top 50', '#1 Video']);
  assert.ok(!/guaranteed #1|guarantee you|#1 result|\bbots?\b/i.test(charts), 'Charts must not hype a guaranteed #1 or claim bots');

  assert.ok(/Instagram clipping campaign/i.test(social) || /Influencers share the song on Reels/i.test(social), 'Social Ads page is the Instagram Reels explainer');

  const videoArticle = video.match(/<article class="boost-explainer"[\s\S]*?<\/article>/)[0];
  assert.ok(/Get paid when someone uses your song in a video\. YouTube, Instagram, Facebook, TikTok\. We take 0%\. You get 100% of the payout\./.test(stripTags(videoArticle)), 'Video Collect page uses locked copy');
  assert.strictEqual(lastLine(videoArticle), 'Creator and Pro only.');
  assert.ok(video.includes('data-video-collect-toggle'), 'Video Collect page ships the only marketing toggle');
  assert.ok(video.includes('video-collect.js'), 'Video Collect toggle has a handler');
  assert.ok(/<input[^>]*data-video-collect-toggle[^>]*>/.test(video) && /<input[^>]*disabled[^>]*data-video-collect-toggle|<input[^>]*data-video-collect-toggle[^>]*disabled/.test(video), 'Video Collect toggle is not a fake working switch');
  assert.ok(/The payout connection is not available/.test(video), 'Video Collect shows a real connection error');
  assert.ok(!/api\/tonegrid|ToneGrid/.test(video + read('video-collect.js')), 'Video Collect must not name a partner API');

  Object.keys(pages).forEach(function (file) {
    const html = pages[file];
    assert.ok(!VENDOR.test(html), file + ' must never name a vendor or partner');
    assert.ok(!/15\s*%/.test(html), file + ' must not mention a 15% cut');
    assert.ok(!PARKED_YT.test(html), file + ' must keep YouTube views packages parked');
    if (file !== 'index.html') {
      assert.ok(!BUY.test(html), file + ' must not become a live buy');
      assert.ok(/data-require-membership="true"/.test(html), file + ' stays signed-in');
      assert.ok(html.includes('href="boosts.html">Boosts</a>'), file + ' sidebar Boosts stays on the hub');
    }
  });

  [playlists, charts, social].forEach(function (html) {
    optionCards(html).concat(html.match(/<article class="boost-explainer"[\s\S]*?<\/article>/g) || []).forEach(function (card) {
      assert.strictEqual(lastLine(card), 'Creator and Pro only.');
    });
  });

  const toggle = makeEl({
    disabled: false,
    checked: true,
    attrs: { 'data-video-collect-toggle': '', 'aria-disabled': 'false', 'aria-checked': 'true' },
  });
  toggle.nextElementSibling = makeEl({ className: 'toggle on' });
  const label = makeEl({ className: 'toggle-line', attrs: { 'data-video-collect-label': '' } });
  const error = makeEl({ attrs: { 'data-video-collect-error': '' }, textContent: '' });
  const nodes = {
    '[data-video-collect-toggle]': toggle,
    '[data-video-collect-label]': label,
    '[data-video-collect-error]': error,
  };
  function loadToggle(paid) {
    toggle.checked = true;
    toggle.disabled = false;
    error.textContent = '';
    const ctx = {
      document: {
        querySelector(sel) { return nodes[sel] || null; },
      },
      PlaigroundMembership: {
        hasPaidAccess() { return paid; },
      },
      window: {},
    };
    ctx.window = ctx;
    vm.runInNewContext(read('video-collect.js'), ctx);
    return ctx.PlaigroundVideoCollect;
  }

  const basic = loadToggle(false);
  assert.strictEqual(basic.status().on, false, 'Basic cannot turn Video Collect on');
  assert.strictEqual(basic.status().locked, true);
  assert.strictEqual(basic.status().error, 'Creator and Pro only.');
  assert.strictEqual(toggle.disabled, true, 'Basic toggle stays locked');
  assert.strictEqual(toggle.checked, false, 'Basic toggle must not fake on');
  assert.strictEqual(error.textContent, 'Creator and Pro only.');

  const paid = loadToggle(true);
  assert.strictEqual(paid.status().on, false, 'Creator/Pro must not fake a working toggle');
  assert.strictEqual(paid.status().locked, true);
  assert.strictEqual(paid.status().error, 'Video Collect could not be turned on. The payout connection is not available.');
  assert.strictEqual(toggle.disabled, true, 'Creator/Pro toggle stays disabled without a real connection');
  assert.strictEqual(toggle.checked, false);
  assert.strictEqual(error.textContent, 'Video Collect could not be turned on. The payout connection is not available.');
  toggle.listeners.click({ preventDefault() {} });
  assert.strictEqual(toggle.checked, false, 'click must not flip Video Collect on');

  const apiJs = fs.readdirSync(path.join(__dirname, 'api')).filter(function (name) { return name.endsWith('.js'); });
  assert.strictEqual(apiJs.length, 6, 'do not invent a new partner API function');
  assert.ok(!apiJs.some(function (name) { return /video/i.test(name); }), 'do not add a video-collect API file');

  console.log('boost-hub.test.js ok');
}

run();
