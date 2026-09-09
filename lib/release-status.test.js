'use strict';

const assert = require('assert');
const status = require('./release-status');

function run() {
  assert.strictEqual(status.isReturnedRelease({ status: 'rejected' }), true);
  assert.strictEqual(status.isReturnedRelease({ status: 'qc_rejected', title: 'GOLDEN ERA' }), true);
  assert.strictEqual(status.isReturnedRelease({
    uuid: 'e41e056b-b316-4de7-ba0f-037f49629377',
    title: 'Lightning',
    status: 'draft',
  }), true, 'Lightning e41e056b is returned even as a catalog draft');
  assert.strictEqual(status.catalogIdMatch('6629b532-ffff-4fff-8fff-ffffffffffff', '6629b532'), true, 'Metete matches uuid prefix 6629b532');
  assert.strictEqual(status.isReturnedRelease({
    uuid: '6629b532-ffff-4fff-8fff-ffffffffffff',
    title: 'Metete en el groove',
    status: 'rejected',
  }), true);
  assert.strictEqual(status.isReturnedRelease({
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'My heart',
    status: 'draft',
  }), false, 'plain drafts stay out of Rejected');
  assert.strictEqual(status.isReturnedRelease({
    uuid: '7a928125-b12e-4609-bd37-26ce0edf819e',
    title: 'Rainbow Road',
    status: 'draft',
  }), false);
  assert.strictEqual(status.resubmitHref(), 'upload.html');
  assert.ok(!/song\.html|edit=1/i.test(status.resubmitHref()), 'Resubmit is the new-release path, not Edit');
  const split = status.splitRejected([
    { uuid: 'd412cc82-7acb-44ef-9c04-f92e4f2bcda6', title: 'GOLDEN ERA', status: 'rejected', rejection_reason: 'Audio quality issues' },
    { uuid: '6629b532-2e78-4be6-84eb-e4dfa9ac33e5', title: 'Metete en el groove', status: 'rejected', rejection_reason: 'Invalid cover art' },
    { uuid: '37524790-6cbf-4726-a386-384ab959731a', title: 'The night sky', status: 'rejected', rejection_reason: 'Incomplete metadata' },
    { uuid: 'e41e056b-b316-4de7-ba0f-037f49629377', title: 'Lightning', status: 'draft' },
    { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'My heart', status: 'draft' },
    { uuid: '7a928125-b12e-4609-bd37-26ce0edf819e', title: 'Rainbow Road', status: 'live' },
  ]);
  assert.strictEqual(split.rejected.length, 4);
  assert.deepStrictEqual(split.rejected.map(function (row) { return row.title; }), [
    'GOLDEN ERA',
    'Metete en el groove',
    'The night sky',
    'Lightning',
  ]);
  assert.strictEqual(split.main.length, 2);
  assert.ok(split.main.some(function (row) { return row.title === 'My heart'; }));
  const merged = status.mergeReturnedCatalog([
    { uuid: 'd412cc82-7acb-44ef-9c04-f92e4f2bcda6', title: 'GOLDEN ERA', status: 'rejected' },
  ], {});
  assert.ok(merged.some(function (row) {
    return status.isLightningReturned(row) && row.title === 'Lightning';
  }), 'Lightning is pulled into the returned catalog when Victoria rejected rows are present');
  const leftoverDrafts = status.mergeReturnedCatalog([
    { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'My heart', status: 'draft' },
    { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'I Set the Tone', status: 'draft' },
    { uuid: '7a928125-b12e-4609-bd37-26ce0edf819e', title: 'Rainbow Road', status: 'live' },
  ], {});
  assert.strictEqual(leftoverDrafts.length, 3, 'plain drafts do not mint a Lightning row');
  assert.ok(!leftoverDrafts.some(function (row) { return status.isLightningReturned(row); }));

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
  assert.strictEqual(status.isHiddenFromList('draft'), true, 'unsubmitted store drafts do not list');
  assert.ok(status.isUnsubmittedDraft({ status: 'draft' }));
  assert.ok(status.isUnsubmittedDraft({ id: 'local-draft', status: 'draft' }));
  assert.ok(!status.isUnsubmittedDraft({ status: 'pending' }));
  assert.ok(!status.isUnsubmittedDraft({ status: 'draft' }, { submitted: true }));
  assert.ok(!status.isUnsubmittedDraft({
    uuid: 'e41e056b-b316-4de7-ba0f-037f49629377',
    title: 'Lightning',
    status: 'draft',
  }), 'returned Lightning draft is not dropped as unsubmitted');
  assert.ok(!status.isUnsubmittedDraft({
    uuid: 'd412cc82-7acb-44ef-9c04-f92e4f2bcda6',
    title: 'GOLDEN ERA',
    status: 'rejected',
  }), 'qc-rejected rows stay listable');
  assert.ok(status.isUnsubmittedDraft({
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    title: 'My heart',
    status: 'draft',
  }), 'plain drafts still drop from the list');
  assert.ok(!status.isHiddenFromList('draft', {
    uuid: 'e41e056b-b316-4de7-ba0f-037f49629377',
    title: 'Lightning',
    status: 'draft',
  }), 'Lightning draft stays visible when the row is returned');
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
  assert.strictEqual(status.problemAlert({ status: 'pending' }), '', 'pending does not invent Needs fix copy');
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
  assert.strictEqual(status.problemAlert({ status: 'pending', label: 'Pending' }), '', 'pending stays quiet');
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
  assert.strictEqual(pendingCards[0].label, 'Pending');
  assert.strictEqual(pendingCards[0].alert, '');
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
  assert.strictEqual(mixed[0].alert, '');
  assert.strictEqual(mixed[0].live, false);
  assert.strictEqual(mixed[1].label, 'Live');
  assert.strictEqual(mixed[1].alert, '');
  assert.strictEqual(mixed[2].label, 'Needs fix');
  assert.strictEqual(mixed[2].alert, 'Cover art is too small.\n' + qcLines);
  const deliveredApproved = status.displayInfo({
    status: 'approved',
    delivered_at: '2026-09-08T16:10:57Z',
  });
  assert.strictEqual(deliveredApproved.label, 'Live', 'approved + delivered_at labels Live');
  assert.strictEqual(deliveredApproved.dot, 'green');
  assert.strictEqual(deliveredApproved.live, true);
  assert.strictEqual(deliveredApproved.group, 'live');
  assert.strictEqual(status.displayInfo({ status: 'approved' }).label, 'Processing', 'approved without delivered_at stays Processing');
  assert.strictEqual(status.displayInfo({ status: 'processing' }).label, 'Processing');
  assert.strictEqual(status.displayInfo({ status: 'delivering' }).label, 'Processing');
  assert.strictEqual(status.displayInfo({ status: 'pending' }).label, 'Pending');
  assert.strictEqual(status.displayInfo({ status: 'pending', delivered_at: '' }).label, 'Pending', 'empty delivered_at does not flip pending');
  assert.strictEqual(status.displayInfo({
    status: 'processing',
    delivered_at: '2026-09-07T20:07:56Z',
  }).label, 'Live', 'processing + delivered_at labels Live');
  const rejectedDelivered = status.displayInfo({
    status: 'rejected',
    delivered_at: '2026-01-01T00:00:00Z',
    approved_at: '2026-01-01T00:00:00Z',
  });
  assert.strictEqual(rejectedDelivered.label, 'QC rejected', 'rejected stays QC rejected even with delivered_at');
  assert.strictEqual(rejectedDelivered.live, false);
  assert.strictEqual(status.displayInfo({
    status: 'needs_fix',
    delivered_at: '2026-09-08T16:10:57Z',
  }).label, 'Needs fix', 'needs_fix is not overridden by delivered_at');
  assert.strictEqual(status.isLive({ status: 'approved', delivered_at: '2026-09-08T16:10:57Z' }), true);
  assert.strictEqual(status.isLive({ status: 'approved' }), false);
  assert.strictEqual(status.isLive('approved'), false);
  const deliveredCard = status.cardFromRow({
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    title: 'Night Drive',
    status: 'approved',
    delivered_at: '2026-09-08T16:10:57Z',
  });
  assert.strictEqual(deliveredCard.label, 'Live');
  assert.strictEqual(deliveredCard.live, true);
  assert.strictEqual(deliveredCard.delivered_at, '2026-09-08T16:10:57Z');
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
  assert.strictEqual(idOnly[0].label, 'Pending');
  assert.strictEqual(idOnly[0].alert, '');
  console.log('lib/release-status.test.js ok');
}

run();
