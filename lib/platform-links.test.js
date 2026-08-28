'use strict';

const assert = require('assert');
const platformLinks = require('./platform-links');
const storePick = require('./store-pick');
const profile = require('./profile');

function run() {
  const catalog = platformLinks.platformList();
  assert.ok(catalog.length > 2, 'dropdown uses the live store catalog fallback, not a Spotify/Apple pair');
  assert.ok(catalog.length < 80, 'dropdown must not invent a fake 150+ list');
  storePick.DEFAULT_STORES.forEach(function (row) {
    assert.ok(catalog.some(function (item) { return item.slug === row.slug; }), 'catalog includes ' + row.slug);
  });

  const spotifyUrl = platformLinks.matchPlatformValue('spotify', 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(spotifyUrl.ok, true);
  assert.strictEqual(spotifyUrl.platform, 'spotify');
  assert.strictEqual(spotifyUrl.id, '0TnOYISbd1XYRBk9myaseg');

  const appleUrl = platformLinks.matchPlatformValue('apple-music', 'https://music.apple.com/us/artist/demo/123456789');
  assert.strictEqual(appleUrl.ok, true);
  assert.strictEqual(appleUrl.id, '123456789');

  const mismatch = platformLinks.matchPlatformValue('spotify', 'https://music.apple.com/us/artist/demo/123456789');
  assert.strictEqual(mismatch.ok, false);

  const leftover = platformLinks.normalizeFromArtist({
    name: 'Old Act',
    spotify_id: '0TnOYISbd1XYRBk9myaseg',
    apple_id: '123456789',
  });
  assert.strictEqual(leftover.platform_links.length, 2);

  const artist = profile.normalizeArtist({
    name: 'Legacy Act',
    spotify_id: '0TnOYISbd1XYRBk9myaseg',
  });
  assert.strictEqual(artist.platform_links[0].platform, 'spotify');

  assert.ok(/open\.spotify\.com\/artist/.test(platformLinks.urlPlaceholder('spotify')));
  assert.ok(/open\.spotify\.com\/artist/.test(platformLinks.urlHint('spotify')));
  assert.ok(/music\.apple\.com/.test(platformLinks.urlPlaceholder('apple-music')));
  const hints = platformLinks.hintSlugs();
  assert.ok(hints.length >= 5 && hints.length <= 10, 'hints stay top 5–10 stores, not the full catalog');
  ['spotify', 'apple-music', 'youtube-music', 'amazon-music', 'deezer', 'tidal'].forEach(function (slug) {
    assert.ok(hints.indexOf(slug) !== -1, 'hint list includes ' + slug);
  });
  assert.strictEqual(platformLinks.hasStoreHint('kkbox'), false);
  assert.strictEqual(platformLinks.urlHint('kkbox'), 'Paste that store’s public artist page.');
  assert.strictEqual(platformLinks.urlPlaceholder('kkbox'), 'Artist URL');

  const two = platformLinks.validateList([
    { platform: 'spotify', url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg' },
    { platform: 'apple-music', url: 'https://music.apple.com/us/artist/demo/123456789' },
  ]);
  assert.strictEqual(two.ok, true);
  assert.strictEqual(two.links.length, 2);

  console.log('lib/platform-links.test.js ok');
}

run();
