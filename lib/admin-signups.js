'use strict';

/**
 * Owner-only signup list. Reads PLAIGROUND users and a live Stripe GET.
 * Never writes a Stripe customer, subscription, or charge.
 */

const { listUsers } = require('./accounts');
const { normalizePlan } = require('./auth');
const { readLiveSubscription } = require('./stripe-webhook');

function isoDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function storedStatus(value) {
  if (value == null || value === '') return '';
  return String(value);
}

async function stripeFlag(row, retrieve) {
  const result = await readLiveSubscription(row && row.stripe_customer_id, retrieve);
  if (result && (result.stripe === 'yes' || result.stripe === 'no' || result.stripe === 'unknown')) {
    return result.stripe;
  }
  return 'unknown';
}

function signupRow(row, stripe) {
  const flag = stripe === 'yes' || stripe === 'no' || stripe === 'unknown' ? stripe : 'unknown';
  return {
    email: row && row.email ? String(row.email) : '',
    plan: normalizePlan(row && row.plan),
    status: storedStatus(row && row.status),
    signed_up_at: isoDate(row && row.created_at),
    stripe: flag,
  };
}

async function listSignupRows(options) {
  const retrieve = options && options.retrieve;
  const rows = await listUsers();
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    let stripe = 'no';
    if (row && String(row.stripe_customer_id || '').trim()) {
      stripe = await stripeFlag(row, retrieve);
    }
    out.push(signupRow(row, stripe));
  }
  return out;
}

module.exports = {
  listSignupRows,
  signupRow,
};
