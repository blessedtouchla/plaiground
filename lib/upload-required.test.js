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

  assert.strictEqual(rules.validateReleaseCreate({
    title: 'Night Drive',
    genre: 'Not A Real Genre',
    language: 'en',
    price: '$0.99',
  }).error, 'genre must be a ToneGrid genre.');
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
  assert.ok(rules.validateAttest({
    made_how: 'ai_assisted',
    human_elements: ['Original lyrics'],
    human_contribution: 'I wrote the lyrics.',
    rights_confirmed: true,
  }).ok);
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

  console.log('lib/upload-required.test.js ok');
}

run();
