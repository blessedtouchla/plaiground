'use strict';

const assert = require('assert');
const rules = require('./upload-required');

function run() {
  assert.strictEqual(rules.validateUploadPage({}).error, 'Audio is required.');
  assert.strictEqual(rules.validateUploadPage({
    audio: { name: 'a.wav' },
  }).error, 'Artwork is required.');
  assert.ok(!rules.validateUploadPage({
    audio: { name: 'a.wav' },
    artwork: { name: 'c.jpg' },
    title: 'Night Drive',
    name: 'Ada Night',
    genre: 'Pop',
    language: 'en',
    price: '$0.99',
    featured: '',
  }).error);
  assert.ok(!rules.validateUploadPage({
    audio: { name: 'a.wav' },
    artwork: { name: 'c.jpg' },
    title: 'Night Drive',
    name: 'Ada Night',
    genre: 'Pop',
    language: '',
    price: '$0.99',
    instrumental: true,
  }).error);
  assert.strictEqual(rules.validateUploadPage({
    audio: { name: 'a.wav' },
    artwork: { name: 'c.jpg' },
    title: 'Night Drive',
    name: 'Ada Night',
    genre: 'Pop',
    language: '',
    price: '$0.99',
    instrumental: false,
  }).error, 'Language is required.');

  assert.strictEqual(rules.validateUploadPage({
    type: 'album',
    artwork: { name: 'c.jpg' },
    title: 'Night Drive LP',
    name: 'Ada Night',
    genre: 'Pop',
    language: 'en',
    price: '$0.99',
    tracks: [],
  }).error, 'Pick how many songs are on this album.');
  assert.ok(!rules.validateUploadPage({
    type: 'album',
    artwork: { name: 'c.jpg' },
    title: 'Night Drive LP',
    name: 'Ada Night',
    genre: 'Pop',
    language: 'en',
    price: '$0.99',
    tracks: [{ title: 'Only', audio: { name: 'a.wav' } }],
  }).error);
  assert.strictEqual(rules.validateUploadPage({
    type: 'album',
    artwork: { name: 'c.jpg' },
    title: 'Night Drive LP',
    name: 'Ada Night',
    genre: 'Pop',
    language: 'en',
    price: '$0.99',
    tracks: [{ title: 'Intro', audio: { name: 'a.wav' } }, { title: '', audio: { name: 'b.wav' } }],
  }).error, 'Track 2 needs a title.');
  assert.ok(!rules.validateUploadPage({
    type: 'album',
    artwork: { name: 'c.jpg' },
    title: 'Night Drive LP',
    name: 'Ada Night',
    genre: 'Pop',
    language: 'en',
    price: '$0.99',
    tracks: [{ title: 'Intro', audio: { name: 'a.wav' } }, { title: 'Outro', file: { name: 'b.wav' } }],
  }).error);
  assert.ok(!rules.validateAlbumTracks([
    { title: 'Intro', audio_uploaded: true, track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
  ]).error, 'album row with audio_uploaded and no File is not empty');
  assert.ok(!rules.validateUploadPage({
    artwork_name: 'cover.jpg',
    title: 'Night Drive',
    name: 'Ada Night',
    genre: 'Pop',
    language: 'en',
    price: '$0.99',
    track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    audio_uploaded: true,
  }).error, 'single with persisted track_id and no File is not empty');
  assert.ok(!rules.validateUploadPage({
    artwork_object_key: 'covers/11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-cover.jpg',
    title: 'Night Drive',
    name: 'Ada Night',
    genre: 'Pop',
    language: 'en',
    price: '$0.99',
    track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    audio_uploaded: true,
  }).error, 'cover object key counts as persisted artwork');
  assert.strictEqual(rules.validateAlbumTracks([
    { title: 'Intro' },
  ]).error, 'Track 1 needs audio.');

  assert.strictEqual(rules.validateReleaseCreate({
    title: 'Night Drive',
    genre: 'Not A Real Genre',
    language: 'en',
    price: '$0.99',
  }).error, 'genre must be a listed genre.');
  assert.strictEqual(rules.validateReleaseCreate({
    title: 'Night Drive',
    genre: 'Electronic',
    language: 'en',
    price: '$0.99',
  }).genre, 'Electronic');
  assert.ok(!rules.validateReleaseCreate({
    title: 'Night Drive',
    genre: 'Electronic',
    language: 'en',
    price: '$0.99',
    featured: '',
    subgenre: '',
  }).error);
  assert.ok(!rules.validateReleaseCreate({
    title: 'Night Drive',
    genre: 'Electronic',
    price: '$0.99',
    instrumental: true,
  }).error);
  assert.strictEqual(rules.validateReleaseCreate({
    title: 'Night Drive',
    genre: 'Electronic',
    price: '$0.99',
  }).error, 'language is required.');
  assert.ok(!rules.validateTrackCreate({
    title: 'Night Drive',
    instrumental: true,
  }).error);
  assert.strictEqual(rules.validateTrackCreate({
    title: 'Night Drive',
  }).error, 'language is required.');

  assert.ok(rules.validateAttest({ made_how: 'no_ai', rights_confirmed: true }).ok);
  assert.ok(rules.validateAttest({
    made_how: 'ai_assisted',
    human_elements: [],
    human_contribution: '',
    rights_confirmed: true,
  }).error);
  assert.strictEqual(rules.validateAttest({
    made_how: 'ai_assisted',
    human_elements: [],
    human_contribution: '',
    rights_confirmed: true,
  }).error, 'human_elements is required.');
  assert.ok(rules.validateAttest({
    made_how: 'ai_assisted',
    human_elements: ['Original lyrics'],
    human_contribution: '',
    rights_confirmed: true,
  }).ok, 'one chip and empty describe is enough');
  assert.ok(rules.validateAttest({
    made_how: 'ai_assisted',
    human_elements: [],
    human_contribution: 'I wrote the lyrics.',
    rights_confirmed: true,
  }).ok, 'describe text is a fallback when no chip is picked');
  assert.ok(rules.validateAttest({
    made_how: 'ai_assisted',
    human_elements: ['Original lyrics'],
    human_contribution: 'I wrote the lyrics.',
    rights_confirmed: true,
  }).ok);
  assert.ok(!rules.validateAttestPage({
    made_how: 'ai_assisted',
    human_elements: ['Original lyrics'],
    human_contribution: '',
    rights_confirmed: true,
  }).error);
  assert.strictEqual(rules.validateAttestPage({
    made_how: 'ai_assisted',
    human_elements: [],
    human_contribution: '',
    rights_confirmed: true,
  }).error, 'Human element is required.');
  assert.ok(rules.validateAttest({
    made_how: 'fully_ai',
    rights_confirmed: true,
  }).ok);
  assert.ok(rules.validateAttest({
    made_how: 'fully_ai',
    rights_confirmed: false,
  }).error);
  assert.ok(rules.validateAttestPage({
    made_how: 'fully_ai',
    rights_confirmed: true,
  }).ok);

  assert.strictEqual(rules.isSoloOwned({ solo_owned_100: true }), true);
  assert.strictEqual(rules.isSoloOwned({ solo_owned_100: true, featured: '' }), true);
  assert.strictEqual(rules.isSoloOwned({ solo_owned_100: true, featured: 'Guest' }), false);
  assert.strictEqual(rules.isSoloOwned({
    solo_owned_100: true,
    writers: [{ name: 'Ada', email: 'ada@example.com' }, { name: 'Bea', email: 'bea@example.com' }],
  }), false);
  assert.strictEqual(rules.isSoloOwned({ solo_owned_100: false }), false);
  assert.strictEqual(rules.isSoloOwned({}), false);

  assert.strictEqual(rules.validateReviewPage({}).error, 'Release date is required.');
  assert.strictEqual(rules.validateReviewPage({ release_date: '' }).error, 'Release date is required.');
  assert.ok(rules.validateReviewPage({ release_date: '2026-09-12' }).ok);
  assert.strictEqual(
    rules.validateUploadPage({
      artwork: { name: 'c.jpg' },
      title: 'Night Drive',
      name: 'Ada Night',
      genre: 'Pop',
      language: 'en',
      price: '$0.99',
      track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    }).error,
    'Audio is required.',
    'a store track_id without a master is not audio'
  );
  assert.ok(!rules.releaseHasStoreAudio({ tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] }));
  assert.ok(rules.releaseHasStoreAudio({
    tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', audio_url: 'https://cdn.example/a.wav' }],
  }));
  assert.strictEqual(rules.AUDIO_REQUIRED, 'Audio required — upload your master before sending');

  assert.ok(rules.validateArtist({ name: 'Amplify' }).ok, 'stage name is enough to create');
  assert.strictEqual(rules.validateArtist({ name: 'Amplify' }).name, 'Amplify');
  assert.ok(rules.validateArtist({ name: 'Amplify', legal_first: '', legal_last: '' }).ok, 'legal names are filled-only, not a block');
  assert.strictEqual(rules.validateArtist({ name: '' }).error, 'name is required.');
  assert.ok(!/legal/i.test(rules.validateArtist({ name: 'Amplify' }).error || ''), 'validateArtist must not require legal names');

  console.log('lib/upload-required.test.js ok');
}

run();
