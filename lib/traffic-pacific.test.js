'use strict';

const assert = require('assert');
const marketing = require('./marketing');

async function run() {
  assert.strictEqual(marketing.pacificDay('2026-10-11T05:00:00.000Z'), '2026-10-10');
  assert.strictEqual(marketing.pacificDay('2026-10-11T07:30:00.000Z'), '2026-10-11');
  assert.strictEqual(marketing.pacificDay('2026-12-01T07:30:00.000Z'), '2026-11-30');

  marketing.resetStore();
  marketing.useMemoryStore();
  // 1 PM Pacific on Oct 10. At 8 PM Pacific the UTC day has rolled to Oct 11, but this is still "today".
  await marketing.record('visitor_late_pt01', 'visit', { path: '/' }, '2026-10-10T20:00:00.000Z');
  // 11 PM Pacific on Oct 9 is yesterday, not today.
  await marketing.record('visitor_prev_pt01', 'visit', { path: '/' }, '2026-10-10T06:00:00.000Z');
  // 31 Pacific days back is outside the 30-day window.
  await marketing.record('visitor_old_pt001', 'visit', { path: '/' }, '2026-09-10T18:00:00.000Z');
  const traffic = await marketing.trafficSummary('2026-10-11T03:00:00.000Z'); // 8 PM Pacific, Oct 10
  assert.strictEqual(traffic.visits.today, 1);
  assert.strictEqual(traffic.visits.d7, 2);
  assert.strictEqual(traffic.visits.d30, 2);
  marketing.resetStore();
  console.log('traffic pacific tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
