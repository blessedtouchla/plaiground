'use strict';

/**
 * Locked quotas. Count is server-side from the PLAIGROUND account.
 *
 * Creator is Basic with the paid features unlocked, then a monthly cap.
 * Pro unlocks unlimited.
 *
 * Basic   = 1 release for the LIFE of the account (tonegrid_release_ids length).
 *           No publishing, no Boost, no withdraw.
 * Creator = 8 distribution uploads this UTC month + 8 publishing regs this
 *           UTC month. Those two caps are separate.
 * Pro     = unlimited distribution uploads and unlimited publishing regs.
 *
 * Missing timestamps on an existing id count as this month (fail closed).
 */

const { isUuid } = require('./tonegrid');

const BASIC_LIMIT = 1;
const CREATOR_MONTHLY = 8;
const PLANS = { basic: true, creator: true, pro: true };
const BASIC_ERROR = 'Basic includes one release. Upgrade to Creator or Pro to upload more.';
const CREATOR_ERROR = 'Creator includes 8 releases per month. Upgrade to Pro to upload more.';
const ALBUM_ERROR = 'Albums are on Creator and Pro. Upgrade to upload a multi-track release.';

function normalizePlan(value) {
  const plan = String(value || '').trim().toLowerCase();
  return PLANS[plan] ? plan : null;
}

function uniqueReleaseIds(row) {
  const raw = row && Array.isArray(row.tonegrid_release_ids) ? row.tonegrid_release_ids : [];
  const seen = new Set();
  const out = [];
  raw.forEach((value) => {
    const id = String(value || '').trim();
    if (!isUuid(id)) return;
    const key = id.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(id);
  });
  return out;
}

function asDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function calendarMonthKey(value, now) {
  const d = asDate(value) || asDate(now) || new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return year + '-' + month;
}

function releaseTimes(row, ids) {
  const raw = row && Array.isArray(row.tonegrid_release_at) ? row.tonegrid_release_at : [];
  return ids.map((_, i) => asDate(raw[i]));
}

function usedThisMonth(row, now) {
  const ids = uniqueReleaseIds(row);
  const times = releaseTimes(row, ids);
  const key = calendarMonthKey(now || new Date());
  let used = 0;
  ids.forEach((_, i) => {
    const at = times[i];
    if (!at || calendarMonthKey(at) === key) used += 1;
  });
  return used;
}

function sameReleaseId(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase() && Boolean(String(a || '').trim());
}

function canStartAlbum(plan) {
  return plan === 'creator' || plan === 'pro';
}

function evaluate(row, now, options) {
  const onHold = String((row && row.status) || '').trim().toLowerCase() === 'hold';
  const plan = onHold ? 'basic' : (normalizePlan(row && row.plan) || 'basic');
  const ids = uniqueReleaseIds(row);
  const lifetime = ids.length;
  const continueId = String((options && (options.continueReleaseId || options.releaseId)) || '').trim();
  const continuing = Boolean(continueId && ids.some((id) => sameReleaseId(id, continueId)));
  const wantAlbum = String((options && options.type) || '').trim().toLowerCase() === 'album';
  const albumAllowed = canStartAlbum(plan);

  if (wantAlbum && !albumAllowed) {
    return {
      allowed: false,
      plan,
      used: plan === 'creator' ? usedThisMonth(row, now) : lifetime,
      limit: plan === 'pro' ? null : (plan === 'creator' ? CREATOR_MONTHLY : BASIC_LIMIT),
      period: plan === 'creator' ? 'month' : 'lifetime',
      album_allowed: false,
      error: ALBUM_ERROR,
    };
  }

  if (continuing) {
    return {
      allowed: true,
      plan,
      used: plan === 'creator' ? usedThisMonth(row, now) : lifetime,
      limit: plan === 'pro' ? null : (plan === 'creator' ? CREATOR_MONTHLY : BASIC_LIMIT),
      period: plan === 'creator' ? 'month' : 'lifetime',
      album_allowed: albumAllowed,
      continuing: true,
    };
  }

  if (plan === 'pro') {
    return {
      allowed: true,
      plan,
      used: lifetime,
      limit: null,
      period: 'lifetime',
      album_allowed: true,
    };
  }

  if (plan === 'creator') {
    const used = usedThisMonth(row, now);
    const allowed = used < CREATOR_MONTHLY;
    return {
      allowed,
      plan,
      used,
      limit: CREATOR_MONTHLY,
      period: 'month',
      album_allowed: true,
      error: allowed ? undefined : CREATOR_ERROR,
    };
  }

  const allowed = lifetime < BASIC_LIMIT;
  return {
    allowed,
    plan: 'basic',
    used: lifetime,
    limit: BASIC_LIMIT,
    period: 'lifetime',
    album_allowed: false,
    error: allowed ? undefined : BASIC_ERROR,
  };
}

function limitBody(decision) {
  const body = {
    error: decision.error,
    code: 'PLAN_LIMIT',
    plan: decision.plan,
    used: decision.used,
    limit: decision.limit,
    period: decision.period,
    upgrade: {
      creator: '/creator.html',
      pro: '/pro.html',
    },
  };
  if (decision.plan === 'basic') body.upgrade.creator = '/creator.html';
  return body;
}

module.exports = {
  ALBUM_ERROR,
  BASIC_ERROR,
  BASIC_LIMIT,
  CREATOR_ERROR,
  CREATOR_MONTHLY,
  calendarMonthKey,
  canStartAlbum,
  evaluate,
  limitBody,
  uniqueReleaseIds,
  usedThisMonth,
};
