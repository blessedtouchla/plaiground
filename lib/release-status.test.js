'use strict';

const assert = require('assert');
const status = require('./release-status');

function run() {
  assert.strictEqual(status.label('pending'), 'Pending');
  assert.strictEqual(status.label('draft'), 'Draft');
  assert.strictEqual(status.label('approved'), 'Processing');
  assert.strictEqual(status.label('processing'), 'Processing');
  assert.strictEqual(status.label('rejected'), 'QC rejected');
  assert.strictEqual(status.label('needs-fix'), 'Needs fix');
  assert.strictEqual(status.label('live'), 'Live');
  assert.strictEqual(status.label('delivered'), 'Live');
  assert.strictEqual(status.label('taken_down'), 'Removing');
  assert.strictEqual(status.label('takedown_submitted'), 'Removing');
  assert.strictEqual(status.group('takedown_submitted'), 'removing');
  assert.strictEqual(status.group('taken_down'), 'removing');
  assert.strictEqual(status.isRemoving('takedown_submitted'), true);
  assert.strictEqual(status.isHiddenFromList('store_gone'), true);
  assert.strictEqual(status.label('store_gone'), 'Draft');
  assert.strictEqual(status.label('takedown_failed'), 'Takedown failed');
  assert.strictEqual(status.group('takedown_failed'), 'takedown_failed');
  assert.strictEqual(status.label('qc_rejected'), 'QC rejected');
  assert.strictEqual(status.label('delivery_failed'), 'QC rejected');
  assert.strictEqual(status.label('qc_inspection'), 'Processing');
  assert.strictEqual(status.isProblem('qc_inspection'), false);
  assert.strictEqual(status.isQcRejected('rejected'), true);
  assert.strictEqual(status.isNeedsFix('needs_fix'), true);
  assert.strictEqual(status.isQcRejected('needs_fix'), false);
  assert.strictEqual(status.isLive('pending'), false);
  assert.strictEqual(status.isLive('live'), true);
  assert.strictEqual(status.isLive('mystery'), false, 'unknown status must not invent Live');
  assert.strictEqual(status.isLive(''), false);
  assert.strictEqual(status.isLive(null), false);
  assert.strictEqual(status.label('mystery'), 'Pending');
  const draftId = '55555555-5555-4555-8555-555555555555';
  const pendingId = '66666666-6666-4666-8666-666666666666';
  assert.strictEqual(status.isUnsubmittedDraft({ uuid: draftId, status: 'draft' }, {}), true);
  assert.strictEqual(status.isUnsubmittedDraft({ uuid: pendingId, status: 'pending' }, {}), false);
  assert.strictEqual(status.isUnsubmittedDraft({ uuid: pendingId, status: 'pending' }, { release_id: pendingId, submitted: false }), true);
  assert.strictEqual(status.isUnsubmittedDraft({ local_draft: true, id: 'local-draft', status: 'draft' }, {}), true);
  assert.strictEqual(status.isUnsubmittedDraft({ uuid: pendingId, status: 'qc_inspection' }, { release_id: pendingId, submitted: true }), false);
  assert.strictEqual(status.resumeHref({ uuid: draftId, status: 'draft' }, {}), 'upload.html');
  assert.strictEqual(status.resumeHref({ uuid: pendingId, status: 'pending' }, {}), 'song.html?id=' + pendingId + '&edit=1');
  assert.strictEqual(status.openHref({ uuid: pendingId, status: 'pending' }, {}), 'song.html?id=' + pendingId);
  assert.strictEqual(status.openHref({ uuid: draftId, status: 'draft' }, {}), 'upload.html');
  assert.strictEqual(status.resumeHref({
    uuid: draftId,
    status: 'draft',
    title: 'Ready',
  }, {
    release_id: draftId,
    submitted: false,
    title: 'Ready',
    name: 'Ada Night',
    genre: 'Pop',
    audio_name: 'ready.wav',
    artwork_name: 'ready.jpg',
  }), 'attest.html');
  const unicornId = '77777777-7777-4777-8777-777777777777';
  const unicorn = { uuid: unicornId, title: 'Unicorn in West Hollywood', status: 'draft' };
  assert.strictEqual(status.isUnsubmittedDraft(unicorn, {}), true, 'Unicorn in West Hollywood ToneGrid draft is unsubmitted');
  assert.strictEqual(status.resumeHref(unicorn, {}), 'upload.html');
  assert.strictEqual(status.openHref(unicorn, {}), 'upload.html');
  assert.ok(String(status.resumeHref(unicorn, {})).indexOf('song.html') === -1);
  assert.strictEqual(status.resumeHref({
    uuid: unicornId,
    title: 'Unicorn in West Hollywood',
    status: 'pending',
  }, {
    release_id: unicornId,
    title: 'Unicorn in West Hollywood',
    submitted: false,
    tonegrid_status: 'draft',
  }), 'upload.html', 'Unicorn never-submitted matching store draft resumes upload');
  assert.strictEqual(status.resumeHref({
    uuid: unicornId,
    title: 'Unicorn in West Hollywood',
    status: 'qc_inspection',
  }, { release_id: unicornId, submitted: true }), 'song.html?id=' + unicornId + '&edit=1');
  const qcLines = status.STORE_QC_LINES.join('\n');
  assert.deepStrictEqual(status.STORE_QC_LINES, [
    'This release needs a record label.',
    'This release needs rights and ownership details.',
    'This release needs a master owner (the ℗ sound-recording owner).',
    'This release needs a copyright year.',
    'This track needs at least one songwriter.',
    'This release needs a ©/℗ line. Stores show that on the release.',
  ]);
  assert.strictEqual(status.problemAlert({ status: 'needs-fix' }), qcLines, 'needs-fix without store credits surfaces the six lines');
  assert.strictEqual(status.problemAlert({ status: 'qc_inspection' }), '');
  assert.strictEqual(status.problemAlert({ status: 'qc_rejected' }), '');
  assert.strictEqual(status.problemAlert({ status: 'rejected' }), '');
  assert.strictEqual(status.problemAlert({ status: 'live', rejection_reason: 'Cover is too small.' }), '', 'live rows do not show leftover errors');
  assert.strictEqual(status.problemAlert({ status: 'pending' }), qcLines, 'pending without the six store fields is Needs fix copy');
  assert.strictEqual(status.problemAlert({ status: 'processing' }), '');
  assert.strictEqual(status.problemAlert({ status: 'needs-fix', rejection_reason: 'Cover is too small.' }), 'Cover is too small.\n' + qcLines);
  assert.strictEqual(status.problemAlert({ status: 'rejected', rejection_reason: 'QC rejected the audio.' }), 'QC rejected the audio.');
  assert.strictEqual(status.problemAlert({
    status: 'delivery_failed',
    deliveries: [{ status: 'failed', error: 'Store delivery failed for this release.' }],
  }), 'Store delivery failed for this release.');
  assert.ok(!/ToneGrid|InterSpace|DistroKid|Flossy/i.test(status.problemAlert({
    status: 'needs-fix',
    rejection_reason: 'ToneGrid QC rejected this InterSpace row.',
  })));
  const credited = {
    status: 'pending',
    label_name: 'Night Work',
    rights_owner: 'Ada Night',
    master_owner: 'Ada Night',
    copyright_year: '2026',
    writers: [{ name: 'Ada Night' }],
    copyright_line: '© 2026 Ada Night. ℗ 2026 Ada Night.',
  };
  assert.strictEqual(status.problemAlert(credited), '', 'complete store credits stay quiet on pending');
  assert.strictEqual(status.displayInfo(credited).label, 'Pending');
  assert.strictEqual(status.problemAlert({ status: 'pending', label: 'Pending' }), qcLines, 'status-word label is not a record label');
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
  }), 1, 'removing stays listed as a real in-progress status');
  assert.strictEqual(status.accountHasLive({
    profile: { releases: [{ title: 'Neon Sermon', tonegrid_status: 'live' }] },
  }), false);
  const pendingCards = status.ownedReleases({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'pending', artwork_url: 'https://cdn.example/night.jpg' }] },
  });
  assert.strictEqual(pendingCards.length, 1);
  assert.strictEqual(pendingCards[0].title, 'Night Drive');
  assert.strictEqual(pendingCards[0].label, 'Needs fix');
  assert.strictEqual(pendingCards[0].alert, qcLines);
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
  assert.strictEqual(mixed[0].label, 'Needs fix');
  assert.strictEqual(mixed[0].alert, qcLines);
  assert.strictEqual(mixed[0].live, false);
  assert.strictEqual(mixed[1].label, 'Live');
  assert.strictEqual(mixed[1].alert, '');
  assert.strictEqual(mixed[2].label, 'Needs fix');
  assert.strictEqual(mixed[2].alert, 'Cover art is too small.\n' + qcLines);
  const unknownCard = status.cardFromRow({ uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'Maybe', status: 'mystery' });
  assert.strictEqual(unknownCard.live, false, 'unknown catalog status must not invent Live');
  assert.strictEqual(unknownCard.label, 'Pending');
  assert.strictEqual(unknownCard.alert, '');
  const taken = status.ownedReleases({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'taken_down' }] },
  });
  assert.strictEqual(taken[0].label, 'Removing');
  const goneCards = status.ownedReleases({
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    profile: { releases: [{ tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Night Drive', tonegrid_status: 'store_gone' }] },
  });
  assert.strictEqual(goneCards.length, 0, 'store-confirmed gone drops from the visible list');
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
  assert.strictEqual(idOnly[0].label, 'Needs fix');
  assert.strictEqual(idOnly[0].alert, qcLines);
  console.log('lib/release-status.test.js ok');
}

run();
