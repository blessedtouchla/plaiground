'use strict';

/**
 * Owner-only signup list. Reads PLAIGROUND users and a live Stripe GET.
 * Never writes a Stripe customer, subscription, or charge.
 */

const { listUsers } = require('./accounts');
const { normalizePlan } = require('./auth');
const { readLiveSubscription } = require('./stripe-webhook');
const signupGuard = require('./signup-guard');
const { heardAboutLabel } = require('./heard-about');

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

function rawProfile(row) {
  const raw = row && row.profile;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function clip(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

/** First-touch source summary from the stored attribution: utm, click ids, referrer host, landing path. */
function signupSource(attribution) {
  const a = attribution && typeof attribution === 'object' ? attribution : {};
  const parts = [];
  const source = clip(a.utm_source, 60);
  const medium = clip(a.utm_medium, 60);
  const campaign = clip(a.utm_campaign, 60);
  if (source) parts.push(medium ? source + '/' + medium : source);
  if (campaign) parts.push(campaign);
  if (clip(a.ref, 60)) parts.push('ref ' + clip(a.ref, 60));
  if (a.fbclid) parts.push('fbclid');
  if (a.ttclid) parts.push('ttclid');
  if (a.gclid) parts.push('gclid');
  if (a.referrer) {
    let host = clip(a.referrer, 200);
    try {
      host = new URL(a.referrer).host || host;
    } catch {
      /* keep raw */
    }
    parts.push('from ' + host);
  }
  if (!parts.length) parts.push('direct');
  if (clip(a.path, 120)) parts.push('landed ' + clip(a.path, 120));
  return parts.join(', ');
}

function signupRow(row, stripe, trace) {
  const flag = stripe === 'yes' || stripe === 'no' || stripe === 'unknown' ? stripe : 'unknown';
  const t = trace && typeof trace === 'object' ? trace : {};
  const flags = Array.isArray(t.flags) ? t.flags.filter(Boolean) : [];
  const ms = Number(t.time_to_submit_ms);
  return {
    email: row && row.email ? String(row.email) : '',
    name: signupName(row),
    plan: normalizePlan(row && row.plan),
    status: storedStatus(row && row.status),
    signed_up_at: isoDate(row && row.created_at),
    stripe: flag,
    email_confirmed_at: isoDate(row && row.email_confirmed_at),
    source: signupSource(rawProfile(row).attribution),
    heard_about: heardAboutLabel(rawProfile(row).attribution),
    ip: clip(t.ip, 64),
    country: clip(t.country, 8),
    city: clip(t.city, 80),
    user_agent: clip(t.user_agent, 300),
    time_to_submit_s: Number.isFinite(ms) && ms > 0 ? Math.round(ms / 100) / 10 : null,
    flags: flags.join(' '),
    suspected_bot: Boolean(t.suspected_bot || flags.length),
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
  'source',
  'heard_about',
  'ip',
  'country',
  'city',
  'user_agent',
  'time_to_submit_s',
  'flags',
  'suspected_bot',
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
  let traces = {};
  try {
    traces = (await signupGuard.traceByUser()) || {};
  } catch {
    traces = {};
  }
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    let stripe = 'no';
    if (row && String(row.stripe_customer_id || '').trim()) {
      stripe = await stripeFlag(row, retrieve);
    }
    out.push(signupRow(row, stripe, row && row.id ? traces[String(row.id)] : null));
  }
  return out;
}

module.exports = {
  SIGNUP_CSV_COLUMNS,
  listSignupRows,
  signupRow,
  signupRowsToCsv,
  signupSource,
};
