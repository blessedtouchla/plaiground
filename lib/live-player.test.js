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

  const tidal = player.parseDelivery({
    dsp: 'tidal',
    store_url: 'https://listen.tidal.com/album/123456789',
  });
  assert.strictEqual(tidal.open, 'https://listen.tidal.com/album/123456789');
  assert.strictEqual(tidal.name, 'Tidal');

  const pendingWithIds = player.state({
    status: 'pending',
    deliveries: [{ dsp: 'spotify', dsp_release_id: 'spotify:album:7v0Ytestalbumid00001' }],
  });
  assert.strictEqual(pendingWithIds.links.length, 0, 'pending never lists store links');

  const dests = player.pickDeliveries({
    deliveries: [
      { dsp: 'spotify', status: 'live', dsp_release_id: 'spotify:album:7v0Ytestalbumid00001' },
      { dsp: 'apple-music', status: 'failed' },
      { dsp: 'tonegrid', status: 'live' },
    ],
  });
  assert.ok(dests.some((row) => row.dsp_name === 'Spotify' && row.label === 'Landed'));
  assert.ok(dests.some((row) => row.dsp_name === 'Apple Music' && row.label === 'Failed'));
  assert.ok(!dests.some((row) => /tonegrid|interspace|distrokid/i.test(JSON.stringify(row))));
  assert.strictEqual(player.deliveryLabel('live'), 'Landed');
  assert.strictEqual(player.deliveryLabel('pending'), 'Pending');
  assert.strictEqual(player.deliveryLabel('failed'), 'Failed');
  assert.strictEqual(player.deliveryLabel('mystery'), 'Unknown');

  const liveOther = player.linksFrom({
    deliveries: [
      { dsp: 'spotify', dsp_release_id: 'spotify:album:7v0Ytestalbumid00001' },
      { dsp: 'apple-music', dsp_release_id: '1543210987' },
      { dsp: 'youtube-music', store_url: 'https://music.youtube.com/playlist?list=OLAK5uy_testlist' },
      { dsp: 'tidal', store_url: 'https://listen.tidal.com/album/123456789' },
    ],
  });
  assert.strictEqual(liveOther.length, 4);
  assert.ok(liveOther.some((row) => row.name === 'Spotify' && row.open.indexOf('open.spotify.com') !== -1));
  assert.ok(liveOther.some((row) => row.name === 'Apple Music' && row.open.indexOf('music.apple.com') !== -1));
  assert.ok(liveOther.some((row) => row.name === 'YouTube Music' && row.open.indexOf('OLAK5uy_testlist') !== -1));
  assert.ok(liveOther.some((row) => row.name === 'Tidal' && row.open === 'https://listen.tidal.com/album/123456789'));
  assert.strictEqual(player.parseDelivery({ dsp: 'deezer', dsp_release_id: 'not-a-url' }), null);

  function el() {
    return {
      hidden: false,
      className: '',
      children: [],
      attrs: {},
      classList: { toggle() {} },
      setAttribute(name, value) { this.attrs[name] = String(value); },
      appendChild(child) { this.children.push(child); return child; },
    };
  }
  global.document = { createElement() { return el(); } };
  const host = el();
  const mounted = player.mountLinks(host, {
    status: 'live',
    deliveries: [
      { dsp: 'spotify', dsp_release_id: 'spotify:album:7v0Ytestalbumid00001' },
      { dsp: 'tidal', store_url: 'https://listen.tidal.com/album/123456789' },
    ],
  });
  assert.strictEqual(mounted.links.length, 2);
  assert.strictEqual(host.hidden, false);
  assert.strictEqual(host.children.length, 2);
  assert.strictEqual(host.children[0].children[0].href, 'https://open.spotify.com/album/7v0Ytestalbumid00001');
  assert.strictEqual(host.children[0].children[0].target, '_blank');
  assert.strictEqual(host.children[0].children[0].rel, 'noopener noreferrer');
  const hidden = el();
  player.mountLinks(hidden, {
    status: 'pending',
    deliveries: [{ dsp: 'spotify', dsp_release_id: 'spotify:album:7v0Ytestalbumid00001' }],
  });
  assert.strictEqual(hidden.hidden, true);
  assert.strictEqual(hidden.children.length, 0);

  console.log('lib/live-player.test.js ok');
}

run();
