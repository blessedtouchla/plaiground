'use strict';

const assert = require('assert');
const plans = require('./plans');

function uuid(n) {
  const hex = String(n).padStart(12, '0');
  return '11111111-1111-4111-8111-' + hex;
}

function row(plan, releases) {
  const ids = [];
  const at = [];
  (releases || []).forEach((item) => {
    if (typeof item === 'string') {
      ids.push(item);
      at.push(null);
      return;
    }
    ids.push(item.id);
    at.push(item.at || null);
  });
  return { plan, tonegrid_release_ids: ids, tonegrid_release_at: at };
}

function run() {
  const now = new Date('2026-08-23T12:00:00.000Z');
  assert.strictEqual(plans.calendarMonthKey(now), '2026-08');
  assert.strictEqual(plans.BASIC_LIMIT, 1);
  assert.strictEqual(plans.CREATOR_MONTHLY, 8);

  const emptyBasic = plans.evaluate(row('basic', []), now);
  assert.strictEqual(emptyBasic.allowed, true);
  assert.strictEqual(emptyBasic.used, 0);
  assert.strictEqual(emptyBasic.limit, 1);
  assert.strictEqual(emptyBasic.period, 'lifetime');

  const usedBasic = plans.evaluate(row('basic', [uuid(1)]), now);
  assert.strictEqual(usedBasic.allowed, false);
  assert.strictEqual(usedBasic.used, 1);
  assert.strictEqual(usedBasic.error, plans.BASIC_ERROR);
  const basicBody = plans.limitBody(usedBasic);
  assert.strictEqual(basicBody.code, 'PLAN_LIMIT');
  assert.strictEqual(basicBody.upgrade.creator, '/creator.html');
  assert.strictEqual(basicBody.upgrade.pro, '/pro.html');

  const noPlan = plans.evaluate({ tonegrid_release_ids: [uuid(1)] }, now);
  assert.strictEqual(noPlan.plan, 'basic');
  assert.strictEqual(noPlan.allowed, false);

  const creatorOpen = plans.evaluate(row('creator', [
    { id: uuid(1), at: '2026-08-01T00:00:00.000Z' },
    { id: uuid(2), at: '2026-08-10T00:00:00.000Z' },
    { id: uuid(3), at: '2026-07-31T23:00:00.000Z' },
  ]), now);
  assert.strictEqual(creatorOpen.allowed, true);
  assert.strictEqual(creatorOpen.used, 2);
  assert.strictEqual(creatorOpen.limit, 8);
  assert.strictEqual(creatorOpen.period, 'month');

  const sevenThisMonth = [];
  for (let i = 1; i <= 7; i += 1) sevenThisMonth.push({ id: uuid(i), at: '2026-08-0' + i + 'T00:00:00.000Z' });
  for (let i = 8; i <= 20; i += 1) sevenThisMonth.push({ id: uuid(i), at: '2026-07-01T00:00:00.000Z' });
  const creator7 = plans.evaluate(row('creator', sevenThisMonth), now);
  assert.strictEqual(creator7.allowed, true);
  assert.strictEqual(creator7.used, 7);

  const eightThisMonth = sevenThisMonth.slice();
  eightThisMonth[6] = { id: uuid(7), at: '2026-08-07T00:00:00.000Z' };
  eightThisMonth.splice(7, 0, { id: uuid(21), at: '2026-08-20T00:00:00.000Z' });
  const creator8 = plans.evaluate(row('creator', eightThisMonth), now);
  assert.strictEqual(creator8.allowed, false);
  assert.strictEqual(creator8.used, 8);
  assert.strictEqual(creator8.error, plans.CREATOR_ERROR);

  const undated8 = [];
  for (let i = 1; i <= 8; i += 1) undated8.push(uuid(i));
  const creatorUndated = plans.evaluate(row('creator', undated8), now);
  assert.strictEqual(creatorUndated.allowed, false, 'missing timestamps count as this month');
  assert.strictEqual(creatorUndated.used, 8);

  const lastMonthOnly = [];
  for (let i = 1; i <= 8; i += 1) lastMonthOnly.push({ id: uuid(i), at: '2026-07-15T00:00:00.000Z' });
  const creatorReset = plans.evaluate(row('creator', lastMonthOnly), now);
  assert.strictEqual(creatorReset.allowed, true);
  assert.strictEqual(creatorReset.used, 0);

  const pro = plans.evaluate(row('pro', eightThisMonth.concat(lastMonthOnly)), now);
  assert.strictEqual(pro.allowed, true);
  assert.strictEqual(pro.limit, null);
  assert.ok(!pro.error);

  assert.strictEqual(plans.canUseExtras('basic'), false);
  assert.strictEqual(plans.canUseExtras('creator'), true);
  assert.strictEqual(plans.canUseExtras('pro'), true);
  const forbidden = plans.featureBody('publishing', 'basic');
  assert.strictEqual(forbidden.code, 'PLAN_FORBIDDEN');
  assert.strictEqual(forbidden.error, plans.PUBLISHING_ERROR);

  console.log('plans.test.js ok');
}

run();
