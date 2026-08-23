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
  assert.strictEqual(status.accountHasLive({ profile: { releases: [{ tonegrid_status: 'live' }] } }), true);
  assert.strictEqual(status.liveCount({ profile: { releases: [{ tonegrid_status: 'pending' }, { tonegrid_status: 'live' }] } }), 1);
  console.log('lib/release-status.test.js ok');
}

run();
