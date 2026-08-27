'use strict';

const assert = require('assert');
const platformLinks = require('./platform-links');
const profile = require('./profile');

function run() {
  assert.strictEqual(platformLinks.matchPlatformValue('', 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg').ok, false);
  assert.strictEqual(platformLinks.matchPlatformValue('spotify', '').error, 'Paste the artist URL or ID.');

  const spotifyUrl = platformLinks.matchPlatformValue('spotify', 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(spotifyUrl.ok, true);
  assert.strictEqual(spotifyUrl.platform, 'spotify');
  assert.strictEqual(spotifyUrl.id, '0TnOYISbd1XYRBk9myaseg');

  const spotifyId = platformLinks.matchPlatformValue('spotify', '0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(spotifyId.ok, true);
  assert.strictEqual(spotifyId.id, '0TnOYISbd1XYRBk9myaseg');
  assert.ok(/spotify\.com\/artist\/0TnOYISbd1XYRBk9myaseg/.test(spotifyId.url));

  const appleUrl = platformLinks.matchPlatformValue('apple', 'https://music.apple.com/us/artist/demo/123456789');
  assert.strictEqual(appleUrl.ok, true);
  assert.strictEqual(appleUrl.platform, 'apple');
  assert.strictEqual(appleUrl.id, '123456789');

  const appleId = platformLinks.matchPlatformValue('apple', '123456789');
  assert.strictEqual(appleId.ok, true);
  assert.strictEqual(appleId.id, '123456789');

  const youtube = platformLinks.matchPlatformValue('youtube-music', 'https://music.youtube.com/channel/UCtestdemoartist');
  assert.strictEqual(youtube.ok, true);
  assert.strictEqual(youtube.platform, 'youtube-music');

  const mismatch = platformLinks.matchPlatformValue('spotify', 'https://music.apple.com/us/artist/demo/123456789');
  assert.strictEqual(mismatch.ok, false);
  assert.match(mismatch.error, /does not match Spotify/);

  const ytOnSpotify = platformLinks.matchPlatformValue('spotify', 'https://music.youtube.com/channel/UCtestdemoartist');
  assert.strictEqual(ytOnSpotify.ok, false);

  const two = platformLinks.validateList([
    { platform: 'spotify', url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg' },
    { platform: 'apple', url: 'https://music.apple.com/us/artist/demo/123456789' },
  ]);
  assert.strictEqual(two.ok, true);
  assert.strictEqual(two.links.length, 2);

  const dup = platformLinks.validateList([
    { platform: 'spotify', url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg' },
    { platform: 'spotify', id: '4dpARuHxo51G3z768sgnrY' },
  ]);
  assert.strictEqual(dup.error, 'That platform is already on the list.');

  const bad = platformLinks.validateList([
    { platform: 'apple', url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg' },
  ]);
  assert.ok(bad.error);
  assert.match(bad.error, /does not match Apple Music/);

  const leftover = platformLinks.normalizeFromArtist({
    name: 'Old Act',
    spotify_id: '0TnOYISbd1XYRBk9myaseg',
    apple_id: '123456789',
  });
  assert.strictEqual(leftover.spotify_id, '0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(leftover.apple_id, '123456789');
  assert.strictEqual(leftover.platform_links.length, 2);
  assert.strictEqual(leftover.platform_links[0].platform, 'spotify');
  assert.strictEqual(leftover.platform_links[0].value, '0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(leftover.platform_links[1].platform, 'apple');
  assert.strictEqual(leftover.platform_links[1].value, '123456789');

  const empty = platformLinks.normalizeFromArtist({ name: 'Fresh' });
  assert.deepStrictEqual(empty.platform_links, []);
  assert.strictEqual(empty.spotify_id, '');
  assert.strictEqual(empty.apple_id, '');

  const artist = profile.normalizeArtist({
    name: 'Legacy Act',
    spotify_id: '0TnOYISbd1XYRBk9myaseg',
    apple_id: '123456789',
  });
  assert.strictEqual(artist.spotify_id, '0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(artist.apple_id, '123456789');
  assert.strictEqual(artist.platform_links.length, 2);

  const created = profile.normalizeArtist({ name: 'Name Only', source: 'created' });
  assert.deepStrictEqual(created.platform_links, []);

  const used = platformLinks.availablePlatforms(['spotify'], '');
  assert.ok(!used.some(function (row) { return row.slug === 'spotify'; }));
  assert.ok(used.some(function (row) { return row.slug === 'apple'; }));
  const keep = platformLinks.availablePlatforms(['spotify', 'apple'], 'spotify');
  assert.ok(keep.some(function (row) { return row.slug === 'spotify'; }));
  assert.ok(!keep.some(function (row) { return row.slug === 'apple'; }));

  console.log('lib/platform-links.test.js ok');
}

run();
