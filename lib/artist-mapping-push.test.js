'use strict';

const assert = require('assert');
const mappingPush = require('./artist-mapping-push');

function run() {
  const empty = mappingPush.buildTonegridMappingFields({ name: 'Ada', platform_links: [] });
  assert.deepStrictEqual(empty, {}, 'no invented mapping fields');

  const spotify = mappingPush.buildTonegridMappingFields({
    name: 'Ada',
    platform_links: [{
      platform: 'spotify',
      url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg',
    }],
  });
  assert.strictEqual(spotify.spotify_url, 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(spotify.spotify_id, '0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(spotify.spotify_artist_id, '0TnOYISbd1XYRBk9myaseg');
  assert.ok(!spotify.apple_url, 'must not invent an Apple URL');

  const apple = mappingPush.buildTonegridMappingFields({
    name: 'Ada',
    platform_links: [{
      platform: 'apple-music',
      url: 'https://music.apple.com/us/artist/demo/123456789',
    }],
  });
  assert.strictEqual(apple.apple_url, 'https://music.apple.com/us/artist/demo/123456789');
  assert.strictEqual(apple.apple_music_url, 'https://music.apple.com/us/artist/demo/123456789');
  assert.strictEqual(apple.apple_id, '123456789');
  assert.strictEqual(apple.apple_artist_id, '123456789');
  assert.ok(!apple.spotify_url, 'must not invent a Spotify URL');

  const deezer = mappingPush.buildTonegridMappingFields({
    name: 'Ada',
    platform_links: [{
      platform: 'deezer',
      url: 'https://www.deezer.com/artist/42',
    }],
  });
  assert.strictEqual(deezer.deezer_url, 'https://www.deezer.com/artist/42');

  const fromLegacy = mappingPush.buildTonegridMappingFields({
    name: 'Ada',
    spotify_id: '0TnOYISbd1XYRBk9myaseg',
  });
  assert.strictEqual(fromLegacy.spotify_id, '0TnOYISbd1XYRBk9myaseg');
  assert.ok(fromLegacy.spotify_url.indexOf('0TnOYISbd1XYRBk9myaseg') !== -1);

  const store = {
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Ada',
    spotify_url: null,
    spotify_id: '',
    apple_url: 'https://music.apple.com/artist/keep',
  };
  const merged = mappingPush.pickIfNull(store, {
    spotify_url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg',
    spotify_id: '0TnOYISbd1XYRBk9myaseg',
    apple_url: 'https://music.apple.com/artist/new',
  });
  assert.strictEqual(merged.spotify_url, 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(merged.spotify_id, '0TnOYISbd1XYRBk9myaseg');
  assert.ok(!merged.apple_url, 'already-set Apple URL must stay');

  const roster = mappingPush.artistFromRoster({
    artists: [{
      id: 'pg-ada',
      name: 'Ada Night',
      platform_links: [{
        platform: 'spotify',
        url: 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg',
      }],
    }],
  }, {
    plaiground_artist_id: 'pg-ada',
    spotify_id: '',
    apple_id: '',
    store_url: '',
  });
  assert.strictEqual(roster.platform_links[0].platform, 'spotify');
  assert.ok(roster.spotify_id === '' || roster.platform_links[0].url, 'empty body DSP ids must not wipe saved profile URLs');

  assert.strictEqual(mappingPush.hasMappingFields({}), false);
  assert.strictEqual(mappingPush.hasMappingFields({ spotify_url: '' }), false);
  assert.strictEqual(mappingPush.hasMappingFields({ spotify_url: 'https://open.spotify.com/artist/1' }), true);

  console.log('lib/artist-mapping-push.test.js ok');
}

run();
