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
  assert.strictEqual(status.label('qc_rejected'), 'Needs fix');
  assert.strictEqual(status.label('delivery_failed'), 'Needs fix');
  assert.strictEqual(status.label('qc_inspection'), 'Processing');
  assert.strictEqual(status.isLive('pending'), false);
  assert.strictEqual(status.isLive('live'), true);
  assert.strictEqual(status.isLive('mystery'), false, 'unknown status must not invent Live');
  assert.strictEqual(status.isLive(''), false);
  assert.strictEqual(status.isLive(null), false);
  assert.strictEqual(status.label('mystery'), 'Pending');
  assert.strictEqual(status.problemAlert({ status: 'needs-fix' }), '', 'no fake error when the catalog has no reason');
  assert.strictEqual(status.problemAlert({ status: 'live', rejection_reason: 'Cover is too small.' }), '', 'live rows do not show leftover errors');
  assert.strictEqual(status.problemAlert({ status: 'pending' }), '');
  assert.strictEqual(status.problemAlert({ status: 'needs-fix', rejection_reason: 'Cover is too small.' }), 'Cover is too small.');
  assert.strictEqual(status.problemAlert({ status: 'rejected', rejection_reason: 'QC rejected the audio.' }), 'QC rejected the audio.');
  assert.strictEqual(status.problemAlert({
    status: 'delivery_failed',
    deliveries: [{ status: 'failed', error: 'Store delivery failed for this release.' }],
  }), 'Store delivery failed for this release.');
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
  assert.strictEqual(status.pendingCount({
    tonegrid_release_ids: [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ],
    profile: { releases: [
      { tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tonegrid_status: 'pending' },
      { tonegrid_release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tonegrid_status: 'live' },
      { tonegrid_release_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', tonegrid_status: 'needs-fix' },
    ] },
  }), 2, 'pending + needs-fix count, live does not');
  assert.strictEqual(status.pendingCount({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tonegrid_status: 'processing' }] },
  }), 1);
  assert.strictEqual(status.pendingCount({
    tonegrid_release_ids: [],
    profile: { releases: [{ title: 'Neon Sermon', tonegrid_status: 'pending' }] },
  }), 0, 'leftover mock pending releases do not count');
  assert.strictEqual(status.pendingCount({}), 0, 'empty catalog pending is 0');
  assert.strictEqual(status.pendingCount({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tonegrid_status: 'taken_down' }] },
  }), 0, 'taken down is not pending');
  assert.strictEqual(status.accountHasLive({
    profile: { releases: [{ title: 'Neon Sermon', tonegrid_status: 'live' }] },
  }), false);
  const pendingCards = status.ownedReleases({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'pending', artwork_url: 'https://cdn.example/night.jpg' }] },
  });
  assert.strictEqual(pendingCards.length, 1);
  assert.strictEqual(pendingCards[0].title, 'Night Drive');
  assert.strictEqual(pendingCards[0].label, 'Pending');
  assert.strictEqual(pendingCards[0].live, false);
  assert.strictEqual(pendingCards[0].artwork_url, 'https://cdn.example/night.jpg');
  assert.strictEqual(status.coverUrl({ cover: { url: 'https://cdn.example/nested.jpg' } }), 'https://cdn.example/nested.jpg');
  assert.strictEqual(status.coverUrl({ title: 'No art' }), '');
  const liveCards = status.ownedReleases({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'live' }] },
  });
  assert.strictEqual(liveCards.length, 1);
  assert.strictEqual(liveCards[0].label, 'Live');
  assert.strictEqual(liveCards[0].live, true);
  const mixed = status.ownedReleases({
    tonegrid_release_ids: [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ],
    profile: { releases: [
      { tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Pending One', tonegrid_status: 'pending' },
      { tonegrid_release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Live One', tonegrid_status: 'live' },
      { tonegrid_release_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fix Me', tonegrid_status: 'needs-fix', rejection_reason: 'Cover art is too small.' },
    ] },
  });
  assert.strictEqual(mixed.length, 3, 'pending stays in the list with live');
  assert.strictEqual(mixed[0].label, 'Pending');
  assert.strictEqual(mixed[0].live, false);
  assert.strictEqual(mixed[1].label, 'Live');
  assert.strictEqual(mixed[2].label, 'Needs fix');
  assert.strictEqual(mixed[2].alert, 'Cover art is too small.');
  const unknownCard = status.cardFromRow({ uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'Maybe', status: 'mystery' });
  assert.strictEqual(unknownCard.live, false, 'unknown catalog status must not invent Live');
  assert.strictEqual(unknownCard.label, 'Pending');
  assert.strictEqual(unknownCard.alert, '');
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
