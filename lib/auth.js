'use strict';

/**
 * PLAIGROUND sessions and password hashes.
 * Cookie is HMAC-signed with SESSION_SECRET. Passwords never go in cookies.
 */

const crypto = require('crypto');
const { headerValue, sendJson } = require('./tonegrid');
const plans = require('./plans');
const profile = require('./profile');

const COOKIE = 'plaiground_session';
const SESSION_TTL_SEC = 30 * 60;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLANS = { basic: true, creator: true, pro: true };
const PAID_PLANS = { creator: true, pro: true };
const STATUSES = { active: true, warning: true, hold: true };
const NOT_CONFIGURED = { error: 'Accounts are not configured.' };
const PENDING_MESSAGE = 'Confirm your email to finish creating this account.';

function sessionSecret() {
  return String(process.env.SESSION_SECRET || '').trim();
}

function isConfigured() {
  return Boolean(String(process.env.DATABASE_URL || '').trim() && sessionSecret());
}

function notConfigured(res) {
  sendJson(res, 503, NOT_CONFIGURED);
}

function normalizeEmail(value) {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .trim()
    .toLowerCase();
}

function gmailLocalKey(value) {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf('@');
  if (at <= 0) return '';
  const domain = email.slice(at + 1);
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return '';
  return email.slice(0, at).split('+')[0].replace(/\./g, '');
}

function emailsEquivalent(left, right) {
  const a = normalizeEmail(left);
  const b = normalizeEmail(right);
  if (a && a === b) return true;
  const keyA = gmailLocalKey(a);
  const keyB = gmailLocalKey(b);
  return Boolean(keyA && keyA === keyB);
}

function isEmail(value) {
  return EMAIL_RE.test(normalizeEmail(value));
}

function normalizePlan(value) {
  const plan = String(value || '').trim().toLowerCase();
  return PLANS[plan] ? plan : null;
}

function normalizePaidPlan(value) {
  const plan = normalizePlan(value);
  return plan && PAID_PLANS[plan] ? plan : null;
}

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return STATUSES[status] ? status : null;
}

function publicStatus(value) {
  return normalizeStatus(value) || 'active';
}

function isHoldStatus(value) {
  return publicStatus(value) === 'hold';
}

function isWarningStatus(value) {
  return publicStatus(value) === 'warning';
}

function isPayoutBlocked(value) {
  const status = publicStatus(value);
  return status === 'warning' || status === 'hold';
}

function queryHasPassword(req) {
  const query = req && req.query && typeof req.query === 'object' ? req.query : {};
  if (Object.prototype.hasOwnProperty.call(query, 'password') || Object.prototype.hasOwnProperty.call(query, 'Password')) {
    return true;
  }
  const rawUrl = req && req.url ? String(req.url) : '';
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    return parsed.searchParams.has('password') || parsed.searchParams.has('Password');
  } catch {
    return /[?&]password=/i.test(rawUrl);
  }
}

function rejectQueryPassword(req, res) {
  if (!queryHasPassword(req)) return false;
  sendJson(res, 400, { error: 'Password cannot be sent as a query parameter.' });
  return true;
}

function bodyHasPassword(body) {
  if (!body || typeof body !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(body, 'password')
    || Object.prototype.hasOwnProperty.call(body, 'password_hash');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], 'base64url');
    expected = Buffer.from(parts[5], 'base64url');
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) return false;
  const actual = crypto.scryptSync(String(password), salt, expected.length, { N: n, r, p });
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function isSecureRequest(req) {
  if (String(process.env.VERCEL || '') === '1') return true;
  const proto = headerValue(req, 'x-forwarded-proto').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

function signSession(userId) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const payload = Buffer.from(JSON.stringify({ u: String(userId), e: exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function verifySession(token) {
  const raw = String(token || '').trim();
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data.u !== 'string' || !data.u) return null;
  if (typeof data.e !== 'number' || data.e < Math.floor(Date.now() / 1000)) return null;
  return { userId: data.u, exp: data.e };
}

function parseCookies(req) {
  const header = headerValue(req, 'cookie');
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  });
  return out;
}

function sessionFromRequest(req) {
  if (!isConfigured()) return null;
  const cookies = parseCookies(req);
  return verifySession(cookies[COOKIE]);
}

function cookieExpiresAt(maxAge) {
  return new Date(Date.now() + Number(maxAge || 0) * 1000).toUTCString();
}

function cookieHeader(token, req, maxAge) {
  const parts = [
    COOKIE + '=' + (token || ''),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + String(maxAge),
    'Expires=' + cookieExpiresAt(maxAge),
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  return parts.join('; ');
}

function attachSession(req, res, userId) {
  res.setHeader('Set-Cookie', cookieHeader(signSession(userId), req, SESSION_TTL_SEC));
}

function clearSession(req, res) {
  res.setHeader('Set-Cookie', cookieHeader('', req, 0));
}

function isConfirmed(row) {
  return Boolean(row && row.email_confirmed_at);
}

function pendingPayload(row) {
  const payload = {
    error: PENDING_MESSAGE,
    pending: true,
    confirmed: false,
  };
  if (row && row.email) payload.email = row.email;
  return payload;
}

function rejectUnconfirmed(res, row) {
  if (isConfirmed(row)) return false;
  sendJson(res, 403, pendingPayload(row));
  return true;
}

function publicUser(row) {
  if (!row) return null;
  const releases = Array.isArray(row.tonegrid_release_ids) ? row.tonegrid_release_ids.filter(Boolean) : [];
  const tracks = Array.isArray(row.tonegrid_track_ids) ? row.tonegrid_track_ids.filter(Boolean) : [];
  const confirmed = isConfirmed(row);
  const quota = plans.evaluate(row);
  return {
    email: row.email,
    artist: row.artist_name,
    plan: row.plan || null,
    status: publicStatus(row.status),
    confirmed,
    pending: !confirmed,
    tonegrid_artist_id: row.tonegrid_artist_id || null,
    tonegrid_release_ids: releases,
    tonegrid_track_ids: tracks,
    stripe_session_id: row.stripe_session_id || null,
    profile: profile.readStored(row),
    upload: {
      allowed: quota.allowed,
      used: quota.used,
      limit: quota.limit,
      period: quota.period,
      plan: quota.plan,
    },
  };
}

function authPayload(row) {
  const user = publicUser(row);
  return {
    ok: true,
    email: user.email,
    artist: user.artist,
    plan: user.plan,
    status: user.status,
    confirmed: user.confirmed,
    pending: user.pending,
  };
}

module.exports = {
  COOKIE,
  SESSION_TTL_SEC,
  NOT_CONFIGURED,
  PENDING_MESSAGE,
  attachSession,
  authPayload,
  bodyHasPassword,
  clearSession,
  hashPassword,
  isConfigured,
  isConfirmed,
  isEmail,
  emailsEquivalent,
  gmailLocalKey,
  normalizeEmail,
  isHoldStatus,
  isPayoutBlocked,
  isWarningStatus,
  normalizePaidPlan,
  normalizePlan,
  normalizeStatus,
  notConfigured,
  pendingPayload,
  publicStatus,
  publicUser,
  queryHasPassword,
  rejectQueryPassword,
  rejectUnconfirmed,
  sessionFromRequest,
  signSession,
  verifyPassword,
  verifySession,
};
