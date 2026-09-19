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

function profileOf(row) {
  return row && row.profile && typeof row.profile === 'object' ? row.profile : {};
}

function signupName(row) {
  const artist = row && row.artist_name != null ? String(row.artist_name).trim() : '';
  if (artist) return artist;
  const profile = profileOf(row);
  const first = String(profile.legal_first || '').trim();
  const last = String(profile.legal_last || '').trim();
  return [first, last].filter(Boolean).join(' ');
}

function signupRow(row, stripe) {
  const flag = stripe === 'yes' || stripe === 'no' || stripe === 'unknown' ? stripe : 'unknown';
  return {
    email: row && row.email ? String(row.email) : '',
    name: signupName(row),
    plan: normalizePlan(row && row.plan),
    status: storedStatus(row && row.status),
    signed_up_at: isoDate(row && row.created_at),
    stripe: flag,
    email_confirmed_at: isoDate(row && row.email_confirmed_at),
  };
}

const SIGNUP_CSV_COLUMNS = [
  'email',
  'name',
  'plan',
  'status',
  'signed_up_at',
  'stripe',
  'email_confirmed_at',
];

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function signupRowsToCsv(rows) {
  const lines = [SIGNUP_CSV_COLUMNS.join(',')];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    lines.push(SIGNUP_CSV_COLUMNS.map((key) => csvCell(row && row[key])).join(','));
  });
  return lines.join('\r\n') + '\r\n';
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
  SIGNUP_CSV_COLUMNS,
  listSignupRows,
  signupRow,
  signupRowsToCsv,
};
