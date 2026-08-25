'use strict';

const assert = require('assert');
const status = require('./release-status');

function run() {
  assert.strictEqual(status.label('pending'), 'Pending');
  assert.strictEqual(status.label('draft'), 'Draft');
  assert.strictEqual(status.label('approved'), 'Processing');
  assert.strictEqual(status.label('processing'), 'Processing');
  assert.strictEqual(status.label('rejected'), 'Needs fix');
  assert.strictEqual(status.label('needs-fix'), 'Needs fix');
  assert.strictEqual(status.label('live'), 'Live');
  assert.strictEqual(status.label('delivered'), 'Live');
  assert.strictEqual(status.label('taken_down'), 'Taken down');
  assert.strictEqual(status.label('takedown_submitted'), 'Taken down');
  assert.strictEqual(status.group('takedown_submitted'), 'taken_down');
  assert.strictEqual(status.isLive('pending'), false);
  assert.strictEqual(status.isLive('live'), true);
  assert.strictEqual(status.dot('pending'), 'yellow');
  assert.strictEqual(status.dot('processing'), 'yellow');
  assert.strictEqual(status.dot('live'), 'green');
  assert.strictEqual(status.dot('rejected'), 'red');
  assert.strictEqual(status.accountHasLive({ profile: { releases: [{ tonegrid_status: 'pending' }] } }), false);
  assert.strictEqual(status.accountHasLive({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tonegrid_status: 'live' }] },
  }), true);
  assert.strictEqual(status.liveCount({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tonegrid_status: 'pending' }, { tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tonegrid_status: 'live' }] },
  }), 1);
  assert.strictEqual(status.liveCount({
    tonegrid_release_ids: [],
    profile: { releases: [{ title: 'Neon Sermon', tonegrid_status: 'live' }] },
  }), 0, 'leftover mock live releases do not count');
  assert.strictEqual(status.accountHasLive({
    profile: { releases: [{ title: 'Neon Sermon', tonegrid_status: 'live' }] },
  }), false);
  const pendingCards = status.ownedReleases({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'pending' }] },
  });
  assert.strictEqual(pendingCards.length, 1);
  assert.strictEqual(pendingCards[0].title, 'Night Drive');
  assert.strictEqual(pendingCards[0].label, 'Pending');
  assert.strictEqual(pendingCards[0].live, false);
  const liveCards = status.ownedReleases({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'live' }] },
  });
  assert.strictEqual(liveCards.length, 1);
  assert.strictEqual(liveCards[0].label, 'Live');
  assert.strictEqual(liveCards[0].live, true);
  const taken = status.ownedReleases({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'taken_down' }] },
  });
  assert.strictEqual(taken[0].label, 'Taken down');
  const leftoverCards = status.ownedReleases({
    tonegrid_release_ids: [],
    profile: { releases: [{ title: 'Neon Sermon', tonegrid_status: 'live' }] },
  });
  assert.strictEqual(leftoverCards.length, 0, 'leftover mock live releases do not become tiles');
  const idOnly = status.ownedReleases({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  });
  assert.strictEqual(idOnly.length, 1);
  assert.strictEqual(idOnly[0].title, '');
  assert.strictEqual(idOnly[0].label, 'Pending');
  console.log('lib/release-status.test.js ok');
}

run();
