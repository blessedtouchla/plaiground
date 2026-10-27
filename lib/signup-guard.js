'use strict';

/**
 * Signup bot protection and signup source capture.
 *
 * Hard checks stop the signup before any account or email:
 *   - honeypot field filled (silent fake success, nothing created, nothing mailed)
 *   - missing, forged, too fast (under 2s) or stale form token
 *   - Cloudflare Turnstile failed (only when TURNSTILE_SECRET_KEY is set)
 *   - per IP and per email rate limits
 * Soft signals create the account but flag it suspected_bot and hold the
 * confirm and welcome emails. The person can still use Resend on confirm.html.
 *
 * Attempts are kept in signup_attempts (Neon) when DATABASE_URL is set, so the
 * limits hold across serverless instances. Without a database it falls back to
 * an in-memory store that resets on cold start (best effort only).
 */

const crypto = require('crypto');
const db = require('./db');

const HONEYPOT_FIELD = 'website';
const MIN_FILL_MS = 2000;
const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Shared wifi (a showcase, a school) can put many real artists on one IP.
// These are set high enough for a 15 person pilot on one network.
const LIMITS = {
  ipPerHour: 8,
  ipPerDay: 25,
  emailPerHour: 3,
  mailIpPerHour: 10,
  mailEmailPerHour: 3,
  softIpAcceptedPerDay: 3,
};

const BLOCK_COPY = {
  no_form_token: 'Please reload the page and try again.',
  bad_form_token: 'Please reload the page and try again.',
  stale_form_token: 'This page has been open a while. Please reload and try again.',
  too_fast: 'That was quick. Please wait a moment and try again.',
  turnstile_missing: 'Please finish the quick human check and try again.',
  turnstile_failed: 'The human check did not pass. Please try again.',
  rate_ip: 'Too many signups from this network. Please try again in a bit.',
  rate_email: 'Too many tries for this email. Please try again in a bit.',
};

const SIGNUP_OUTCOMES = ['accepted', 'flagged', 'blocked', 'dropped', 'exists'];

let memory = null;
let forcedStrict = null;

/**
 * Strict everywhere real. The unit-test account store (accounts memory mode,
 * never used in production) relaxes the form token and IP limits so older
 * tests that post straight to the handler keep working. Tests can force it on.
 */
function setStrict(value) {
  forcedStrict = value == null ? null : Boolean(value);
}

function strictMode() {
  if (forcedStrict != null) return forcedStrict;
  return !usingAccountsMemory();
}

function secret() {
  return String(process.env.SESSION_SECRET || '').trim() || 'plai-signup-guard';
}

function sign(text) {
  return crypto.createHmac('sha256', secret()).update('signup-form:' + text).digest('base64url');
}

function issueFormToken(now) {
  const at = String(typeof now === 'number' ? now : Date.now());
  return at + '.' + sign(at);
}

function checkFormToken(token, now) {
  const t = typeof now === 'number' ? now : Date.now();
  const raw = String(token || '').trim();
  if (!raw) return { ok: false, reason: 'no_form_token', elapsed_ms: null };
  const parts = raw.split('.');
  if (parts.length !== 2 || !/^\d{10,16}$/.test(parts[0])) {
    return { ok: false, reason: 'bad_form_token', elapsed_ms: null };
  }
  const want = Buffer.from(sign(parts[0]));
  const got = Buffer.from(parts[1]);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) {
    return { ok: false, reason: 'bad_form_token', elapsed_ms: null };
  }
  const elapsed = t - Number(parts[0]);
  if (elapsed < MIN_FILL_MS) return { ok: false, reason: 'too_fast', elapsed_ms: elapsed };
  if (elapsed > MAX_TOKEN_AGE_MS) return { ok: false, reason: 'stale_form_token', elapsed_ms: elapsed };
  return { ok: true, reason: '', elapsed_ms: elapsed };
}

function honeypotFilled(body) {
  if (!body || typeof body !== 'object') return false;
  return String(body[HONEYPOT_FIELD] || '').trim() !== '';
}

function header(req, name) {
  const headers = (req && req.headers) || {};
  const value = headers[name] != null ? headers[name] : headers[name.toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || '');
  return String(value || '');
}

function clientIp(req) {
  const real = header(req, 'x-real-ip').trim();
  if (real) return real.slice(0, 64);
  const vercel = header(req, 'x-vercel-forwarded-for').split(',')[0].trim();
  if (vercel) return vercel.slice(0, 64);
  const fwd = header(req, 'x-forwarded-for').split(',')[0].trim();
  if (fwd) return fwd.slice(0, 64);
  const sock = req && req.socket && req.socket.remoteAddress;
  return String(sock || '').slice(0, 64);
}

function decodeHeader(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    return decodeURIComponent(text).slice(0, 80);
  } catch {
    return text.slice(0, 80);
  }
}

function geoOf(req) {
  return {
    country: decodeHeader(header(req, 'x-vercel-ip-country')).toUpperCase().slice(0, 4),
    region: decodeHeader(header(req, 'x-vercel-ip-country-region')),
    city: decodeHeader(header(req, 'x-vercel-ip-city')),
  };
}

function userAgentOf(req) {
  return header(req, 'user-agent').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 300);
}

function ipKey(ip) {
  return crypto.createHmac('sha256', secret()).update('signup-ip:' + String(ip || '')).digest('hex').slice(0, 32);
}

/** "a+tag@host" -> "a@host"; '' when there is no +tag. */
function plusBase(value) {
  const email = String(value || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0) return '';
  const local = email.slice(0, at);
  const plus = local.indexOf('+');
  if (plus <= 0) return '';
  return local.slice(0, plus) + email.slice(at);
}

/** Dup and rate key: lowercased, +tag dropped, Gmail dots dropped, googlemail = gmail. */
function emailKey(value) {
  const email = String(value || '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  let local = email.slice(0, at).split('+')[0];
  let domain = email.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return local + '@' + domain;
}

function softSignals(email) {
  const reasons = [];
  const lower = String(email || '').trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  const local = at > 0 ? lower.slice(0, at) : lower;
  const domain = at > 0 ? lower.slice(at + 1) : '';
  if ((domain === 'gmail.com' || domain === 'googlemail.com') && (local.match(/\./g) || []).length >= 3) {
    reasons.push('gmail_many_dots');
  }
  if (domain === 'googlemail.com') reasons.push('googlemail_alias');
  return reasons;
}

function turnstileSiteKey() {
  return String(process.env.TURNSTILE_SITE_KEY || '').trim();
}

function turnstileSecret() {
  return String(process.env.TURNSTILE_SECRET_KEY || '').trim();
}

function turnstileOn() {
  return Boolean(turnstileSiteKey() && turnstileSecret());
}

/**
 * { ok: true, skipped: true } when the env vars are unset.
 * Network trouble does not block a person; it comes back as a soft flag.
 */
async function verifyTurnstile(token, ip) {
  if (!turnstileOn()) return { ok: true, skipped: true };
  const response = String(token || '').trim();
  if (!response) return { ok: false, reason: 'turnstile_missing' };
  if (typeof fetch !== 'function') return { ok: true, soft: 'turnstile_unreachable' };
  try {
    const form = new URLSearchParams();
    form.set('secret', turnstileSecret());
    form.set('response', response.slice(0, 2048));
    if (ip) form.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (data && data.success === true) return { ok: true };
    return { ok: false, reason: 'turnstile_failed' };
  } catch {
    return { ok: true, soft: 'turnstile_unreachable' };
  }
}

function createMemoryStore() {
  const rows = [];
  return {
    async insert(row) {
      rows.push(Object.assign({ created_at: new Date().toISOString() }, row));
    },
    async count(field, value, sinceMs, outcomes) {
      const since = Date.now() - sinceMs;
      return rows.filter((row) => row[field] === value
        && Date.parse(row.created_at) >= since
        && (!outcomes || outcomes.indexOf(row.outcome) !== -1)).length;
    },
    async list() {
      return rows.slice().reverse();
    },
    async forUsers() {
      return rows.filter((row) => row.user_id).reverse();
    },
  };
}

function useMemoryStore(store) {
  memory = store || createMemoryStore();
  return memory;
}

function resetStore() {
  memory = null;
}

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch {
    return false;
  }
}

function neonStore() {
  return {
    async insert(row) {
      await db.query(
        'INSERT INTO signup_attempts (kind, outcome, ip, ip_key, email_key, country, user_agent, reasons, region, city, time_to_submit_ms, turnstile, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::uuid)',
        [row.kind, row.outcome, row.ip, row.ip_key, row.email_key, row.country, row.user_agent, row.reasons,
          row.region, row.city, row.time_to_submit_ms, row.turnstile, row.user_id || null]
      );
      if (Math.random() < 0.05) {
        await db.query("DELETE FROM signup_attempts WHERE created_at < now() - interval '90 days'");
      }
    },
    async count(field, value, sinceMs, outcomes) {
      const col = field === 'email_key' ? 'email_key' : 'ip_key';
      const params = [value, new Date(Date.now() - sinceMs).toISOString()];
      let sql = 'SELECT count(*)::int AS n FROM signup_attempts WHERE ' + col + ' = $1 AND created_at >= $2::timestamptz';
      if (outcomes && outcomes.length) {
        params.push(outcomes);
        sql += ' AND outcome = ANY($3::text[])';
      }
      const rows = await db.query(sql, params);
      return Number((rows[0] && rows[0].n) || 0);
    },
    async list(limit) {
      return db.query(
        'SELECT kind, outcome, ip, country, region, city, user_agent, reasons, time_to_submit_ms, turnstile, user_id, created_at FROM signup_attempts ORDER BY created_at DESC LIMIT $1',
        [Math.min(Number(limit) || 200, 500)]
      );
    },
    async forUsers() {
      return db.query(
        'SELECT kind, outcome, ip, country, region, city, user_agent, reasons, time_to_submit_ms, turnstile, user_id, created_at FROM signup_attempts WHERE user_id IS NOT NULL ORDER BY created_at DESC LIMIT 5000'
      );
    },
  };
}

function store() {
  if (memory) return memory;
  if (usingAccountsMemory() || !db.hasDatabase()) {
    memory = createMemoryStore();
    return memory;
  }
  return neonStore();
}

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function logAttempt(ctx, kind, outcome, reasons, extra) {
  const more = extra || {};
  await safe(() => store().insert({
    kind: kind,
    outcome: outcome,
    ip: ctx.ip || '',
    ip_key: ctx.ip_key || '',
    email_key: ctx.email_key || '',
    country: (ctx.geo && ctx.geo.country) || '',
    user_agent: ctx.user_agent || '',
    reasons: (reasons || []).join(','),
    region: (ctx.geo && ctx.geo.region) || '',
    city: (ctx.geo && ctx.geo.city) || '',
    time_to_submit_ms: Number.isFinite(more.time_to_submit_ms) ? Math.round(more.time_to_submit_ms) : null,
    turnstile: more.turnstile || '',
    user_id: more.user_id || null,
  }), null);
}

function requestContext(req, email) {
  const ip = clientIp(req);
  return {
    ip: ip,
    ip_key: ipKey(ip),
    email_key: emailKey(email),
    geo: geoOf(req),
    user_agent: userAgentOf(req),
  };
}

/**
 * Runs every signup check. Never throws.
 * Returns { action: 'drop' | 'block' | 'allow', reason, error, status, flags, meta }.
 */
async function checkSignup(req, body, email) {
  const ctx = requestContext(req, email);
  const meta = {
    ip: ctx.ip,
    country: ctx.geo.country,
    region: ctx.geo.region,
    city: ctx.geo.city,
    user_agent: ctx.user_agent,
    time_to_submit_ms: null,
    turnstile: turnstileOn() ? 'on' : 'off',
    checked_at: new Date().toISOString(),
  };
  const out = { ctx: ctx, meta: meta, flags: [] };

  if (honeypotFilled(body)) {
    await logAttempt(ctx, 'signup', 'dropped', ['honeypot']);
    return Object.assign(out, { action: 'drop', reason: 'honeypot' });
  }

  const strict = strictMode();
  const token = checkFormToken(body && (body.form_token || body.formToken));
  meta.time_to_submit_ms = token.elapsed_ms;
  if (!token.ok && strict) {
    await logAttempt(ctx, 'signup', 'blocked', [token.reason]);
    return Object.assign(out, {
      action: 'block',
      reason: token.reason,
      status: token.reason === 'too_fast' ? 429 : 400,
      error: BLOCK_COPY[token.reason],
    });
  }

  const ipHour = await safe(() => store().count('ip_key', ctx.ip_key, HOUR_MS, SIGNUP_OUTCOMES), 0);
  const ipDay = await safe(() => store().count('ip_key', ctx.ip_key, DAY_MS, SIGNUP_OUTCOMES), 0);
  if (strict && (ipHour >= LIMITS.ipPerHour || ipDay >= LIMITS.ipPerDay)) {
    await logAttempt(ctx, 'signup', 'blocked', ['rate_ip']);
    return Object.assign(out, { action: 'block', reason: 'rate_ip', status: 429, error: BLOCK_COPY.rate_ip });
  }
  const emailHour = await safe(() => store().count('email_key', ctx.email_key, HOUR_MS, SIGNUP_OUTCOMES), 0);
  if (strict && emailHour >= LIMITS.emailPerHour) {
    await logAttempt(ctx, 'signup', 'blocked', ['rate_email']);
    return Object.assign(out, { action: 'block', reason: 'rate_email', status: 429, error: BLOCK_COPY.rate_email });
  }

  const turnstile = await verifyTurnstile(body && (body.turnstile_token || body['cf-turnstile-response']), ctx.ip);
  if (!turnstile.ok) {
    await logAttempt(ctx, 'signup', 'blocked', [turnstile.reason]);
    return Object.assign(out, { action: 'block', reason: turnstile.reason, status: 400, error: BLOCK_COPY[turnstile.reason] });
  }
  if (turnstile.soft) out.flags.push(turnstile.soft);
  meta.turnstile = turnstile.skipped ? 'off' : 'passed';

  softSignals(email).forEach((reason) => out.flags.push(reason));
  const acceptedToday = await safe(
    () => store().count('ip_key', ctx.ip_key, DAY_MS, ['accepted', 'flagged']),
    0
  );
  if (strict && acceptedToday >= LIMITS.softIpAcceptedPerDay) out.flags.push('ip_repeat_24h');

  return Object.assign(out, { action: 'allow', reason: '' });
}

async function recordOutcome(check, outcome, userId) {
  if (!check || !check.ctx) return;
  await logAttempt(check.ctx, 'signup', outcome, check.flags || [], {
    time_to_submit_ms: check.meta && check.meta.time_to_submit_ms,
    turnstile: check.meta && check.meta.turnstile,
    user_id: userId || null,
  });
}

/** Latest signup trace per user id: { [userId]: { ip, country, region, city, user_agent, flags, ... } }. */
async function traceByUser() {
  const rows = await safe(() => store().forUsers(), []);
  const out = {};
  (rows || []).forEach((row) => {
    const id = String(row.user_id || '');
    if (!id || out[id]) return;
    const flags = String(row.reasons || '').split(',').map((v) => v.trim()).filter(Boolean);
    out[id] = {
      ip: row.ip || '',
      country: row.country || '',
      region: row.region || '',
      city: row.city || '',
      user_agent: row.user_agent || '',
      time_to_submit_ms: row.time_to_submit_ms == null ? null : Number(row.time_to_submit_ms),
      turnstile: row.turnstile || '',
      flags: flags,
      suspected_bot: row.outcome === 'flagged' || flags.length > 0,
    };
  });
  return out;
}

/** Resend and magic-link mail limits. Returns { ok, error }. Never throws. */
async function checkMail(req, email) {
  const ctx = requestContext(req, email);
  const ipHour = await safe(() => store().count('ip_key', ctx.ip_key, HOUR_MS, ['mail']), 0);
  const emailHour = await safe(() => store().count('email_key', ctx.email_key, HOUR_MS, ['mail']), 0);
  if (strictMode() && (ipHour >= LIMITS.mailIpPerHour || emailHour >= LIMITS.mailEmailPerHour)) {
    await logAttempt(ctx, 'mail', 'mail_blocked', ['rate_mail']);
    return { ok: false, error: 'Too many emails requested. Please try again in a bit.' };
  }
  await logAttempt(ctx, 'mail', 'mail', []);
  return { ok: true };
}

/** Public form config: a fresh form token and the Turnstile site key, if any. */
function formConfig(now) {
  return {
    form_token: issueFormToken(now),
    turnstile_site_key: turnstileOn() ? turnstileSiteKey() : '',
    honeypot: HONEYPOT_FIELD,
  };
}

async function listAttempts(limit) {
  return safe(() => store().list(limit), []);
}

module.exports = {
  BLOCK_COPY,
  HONEYPOT_FIELD,
  LIMITS,
  MIN_FILL_MS,
  checkFormToken,
  checkMail,
  checkSignup,
  clientIp,
  createMemoryStore,
  emailKey,
  formConfig,
  geoOf,
  honeypotFilled,
  issueFormToken,
  plusBase,
  listAttempts,
  recordOutcome,
  resetStore,
  setStrict,
  softSignals,
  traceByUser,
  turnstileOn,
  useMemoryStore,
  userAgentOf,
  verifyTurnstile,
};
