'use strict';

const assert = require('assert');
const player = require('./live-player');

function run() {
  assert.strictEqual(player.isLiveStatus('pending'), false);
  assert.strictEqual(player.isLiveStatus('processing'), false);
  assert.strictEqual(player.isLiveStatus('live'), true);
  assert.strictEqual(player.isLiveStatus('delivered'), true);
  assert.strictEqual(player.WAIT_COPY, 'Available when live.');

  const spotify = player.parseDelivery({
    dsp: 'spotify',
    status: 'live',
    dsp_release_id: 'spotify:album:7v0Ytestalbumid00001',
  });
  assert.strictEqual(spotify.open, 'https://open.spotify.com/album/7v0Ytestalbumid00001');
  assert.strictEqual(spotify.embed, 'https://open.spotify.com/embed/album/7v0Ytestalbumid00001');

  const apple = player.parseDelivery({
    dsp: 'apple_music',
    dsp_release_id: '1543210987',
  });
  assert.strictEqual(apple.open, 'https://music.apple.com/album/1543210987');
  assert.ok(apple.embed.indexOf('embed.music.apple.com') !== -1);

  const youtube = player.parseDelivery({
    dsp: 'youtube-music',
    store_url: 'https://music.youtube.com/playlist?list=OLAK5uy_testlist',
  });
  assert.ok(youtube.open.indexOf('OLAK5uy_testlist') !== -1);

  const waiting = player.state({ status: 'pending', deliveries: [] });
  assert.strictEqual(waiting.live, false);
  assert.strictEqual(waiting.disabled, true);
  assert.strictEqual(waiting.note, player.WAIT_COPY);
  assert.strictEqual(waiting.links.length, 0);

  const liveEmpty = player.state({ status: 'live', deliveries: [] });
  assert.strictEqual(liveEmpty.live, true);
  assert.strictEqual(liveEmpty.disabled, true);
  assert.ok(liveEmpty.note.indexOf('Stream links appear') !== -1);

  const liveReady = player.state({
    status: 'live',
    deliveries: player.pickDeliveries({
      data: {
        deliveries: [
          { dsp: 'spotify', status: 'live', dsp_release_id: 'spotify:album:7v0Ytestalbumid00001' },
        ],
      },
    }),
  });
  assert.strictEqual(liveReady.links.length, 1);
  assert.strictEqual(liveReady.disabled, false);

  console.log('lib/live-player.test.js ok');
}

run();
