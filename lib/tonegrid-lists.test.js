'use strict';

const assert = require('assert');
const lists = require('./tonegrid-lists');

function run() {
  assert.ok(lists.LANGUAGES.length >= 180);
  assert.strictEqual(lists.normalizeLanguage('en'), 'en');
  assert.strictEqual(lists.normalizeLanguage('English'), 'en');
  assert.strictEqual(lists.normalizeLanguage('EN'), 'en');
  assert.strictEqual(lists.normalizeLanguage(''), '');
  assert.strictEqual(lists.normalizeLanguage('not-a-language'), null);

  assert.ok(lists.GENRES.length > 40);
  assert.ok(lists.GENRES.indexOf('Afrobeats') !== -1);
  assert.strictEqual(lists.genrePayload().subgenre, false);

  assert.strictEqual(lists.YOUTUBE_MUSIC_SLUG, 'youtube-music');
  assert.strictEqual(lists.youtubeMusicSlug(lists.documentedStores()), 'youtube-music');
  const merged = lists.withYouTubeMusic(['spotify'], lists.documentedStores());
  assert.ok(merged.indexOf('spotify') !== -1);
  assert.ok(merged.indexOf('youtube-music') !== -1);

  const parsed = lists.parseStores({
    data: { dsps: [{ slug: 'youtube-music', name: 'YouTube Music' }, { slug: 'spotify', name: 'Spotify' }] },
  });
  assert.strictEqual(parsed[0].slug, 'youtube-music');
  assert.ok(lists.isYouTubeMusicStore(parsed[0]));

  console.log('tonegrid-lists.test.js ok');
}

run();
