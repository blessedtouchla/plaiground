'use strict';

const assert = require('assert');
const check = require('./artist-check');

function run() {
  assert.strictEqual(check.checkArtistName('Fuvtu').level, 'green');
  const interceptors = check.checkArtistName('The Interceptors');
  assert.notStrictEqual(interceptors.level, 'empty', 'display name The Interceptors still runs Green/Yellow/Red');
  assert.ok(interceptors.level === 'green' || interceptors.level === 'yellow' || interceptors.level === 'red');
  assert.strictEqual(check.checkArtistName('Drake').level, 'red');
  assert.strictEqual(check.checkArtistName('Drakes').level, 'red');
  assert.ok(check.checkArtistName('Drake').copy.indexOf('too close') !== -1);

  const yellow = check.checkArtistName('Sia');
  assert.strictEqual(yellow.level, 'yellow');
  assert.ok(yellow.copy.indexOf('already exists') !== -1);

  const account = check.checkArtistName('Ada Night', { accountArtists: [{ id: '1', name: 'Ada Night' }] });
  assert.strictEqual(account.level, 'yellow');

  const linked = check.checkArtistName('Drake', { storeLink: 'https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4' });
  assert.strictEqual(linked.level, 'green');
  assert.strictEqual(linked.skip, true);
  assert.strictEqual(linked.linked, true);

  const parsed = check.parseStoreLink('https://music.apple.com/us/artist/demo/123456');
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.platform, 'apple');
  assert.strictEqual(parsed.id, '123456');

  const title = check.checkTitle('Official Exclusive HD Out Now Spotify');
  assert.strictEqual(title.flagged, true);
  assert.strictEqual(title.block, false);
  assert.ok(title.flags.indexOf('promo') !== -1);

  const clean = check.checkTitle('River Light');
  assert.strictEqual(clean.flagged, false);
  assert.strictEqual(clean.block, false);

  console.log('lib/artist-check.test.js ok');
}

run();
