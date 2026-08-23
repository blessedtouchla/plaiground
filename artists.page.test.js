'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function run() {
  const html = read('artists.html');
  ['Neon Sermon', 'Victoria Reyes', 'John Doe', 'Hi John', 'Neon Shadows'].forEach(function (needle) {
    assert.strictEqual(html.indexOf(needle), -1, 'artists.html still has ' + needle);
  });
  assert.ok(html.includes('Artist Profiles'));
  assert.ok(html.includes('Your artists'));
  assert.ok(html.includes('Create new artist'));
  assert.ok(html.includes('Link existing artist'));
  assert.ok(html.includes('How this artist usually creates'));
  assert.ok(html.includes('AI musician type'));
  assert.ok(html.includes('Estimated AI involvement'));
  assert.ok(html.includes('Self-declared. This is a profile average, not a verified score for every song.'));
  assert.ok(html.includes('data-human-contribution="lyrics"'));
  assert.ok(html.includes('data-ai-contribution="full_track_support"'));
  assert.ok(html.includes('I write all lyrics and sing. AI builds the beat and helps with arrangement.'));
  assert.ok(html.includes('href="artists.html">Artist Profiles</a>'));
  assert.ok(html.includes('href="settings.html">Settings</a>'));
  assert.ok(!html.includes('data-require-membership'));
  assert.ok(!html.includes('data-require-paid'));
  const js = read('artists.js');
  assert.ok(html.includes('artists.js'));
  assert.ok(html.includes('This artist\'s songs'));
  assert.ok(html.includes('data-artist-song-list'));
  assert.ok(html.includes('lib/live-player.js'));
  assert.ok(html.includes('waits until ToneGrid says live'));
  assert.ok(!js.includes('indexedDB'));
  assert.ok(!html.includes('tonegrid.js'));
  assert.ok(html.indexOf('human_contributions') === -1 || html.includes('data-human-contribution'));

  const upload = read('upload.html');
  assert.ok(upload.includes('Create new artist profile'));
  assert.ok(!upload.includes('How this artist usually creates'));
  assert.ok(!upload.includes('Estimated AI involvement'));
  assert.ok(!upload.includes('data-human-contribution'));

  assert.ok(js.includes('ai_involvement_percent'));
  assert.ok(js.includes('human_contributions'));
  assert.ok(js.includes('/api/me/artists'));

  const profile = read('profile.html');
  assert.ok(profile.includes('artists.html'));
  assert.ok(profile.includes('Artist Profiles'));

  const apiFiles = fs.readdirSync(path.join(__dirname, 'api')).filter(function (name) { return name.endsWith('.js'); }).sort();
  assert.deepStrictEqual(apiFiles, [
    'auth.js',
    'create-checkout-session.js',
    'me.js',
    'plai-session.js',
    'signwell.js',
    'tonegrid.js',
  ]);

  console.log('artists.page.test.js ok');
}

run();
