'use strict';

/**
 * Read-only admin token for the assistant.
 *
 * Set ADMIN_READONLY_TOKEN in Vercel (32+ random characters). A request that
 * sends it in the `x-plai-admin-token` header (or `Authorization: Bearer ...`)
 * may read GET /api/admin/* data. It can never write: any other method that
 * carries the token is refused with 403, and only the GET admin handlers ever
 * look at it. It is never read from the query string, it never sets a cookie,
 * and every use is written to the server log. Delete the env var and redeploy
 * to revoke it.
 */

const crypto = require('crypto');
const { clientIp } = require('./signup-guard');

const HEADER = 'x-plai-admin-token';
const MIN_LENGTH = 32;
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const FAIL_LIMIT = 20;
const failures = new Map();

function headerValue(req, name) {
  const headers = (req && req.headers) || {};
  let value = headers[name];
  if (value == null) {
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === want) {
        value = headers[key];
        break;
      }
    }
  }
  if (Array.isArray(value)) value = value[0];
  return String(value || '').trim();
}

/** Token the caller sent, or '' when none. Query strings are ignored on purpose. */
function presentedToken(req) {
  const direct = headerValue(req, HEADER);
  if (direct) return direct;
  const auth = headerValue(req, 'authorization');
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1].trim() : '';
}

function configuredToken() {
  const value = String(process.env.ADMIN_READONLY_TOKEN || '').trim();
  return value.length >= MIN_LENGTH ? value : '';
}

function isEnabled() {
  return Boolean(configuredToken());
}

function safeEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right) && String(a).length === String(b).length;
}

function pathOf(req) {
  const url = String((req && req.url) || '');
  const path = url.split('?')[0];
  const action = /[?&]action=([^&]+)/.exec(url);
  return action ? path + ' (' + decodeURIComponent(action[1]).slice(0, 40) + ')' : path;
}

function audit(req, outcome) {
  try {
    console.log(
      '[admin-readonly] ' +
        JSON.stringify({
          outcome: outcome,
          method: String((req && req.method) || ''),
          path: pathOf(req).slice(0, 120),
          ip: clientIp(req),
          at: new Date().toISOString(),
        })
    );
  } catch {
    /* logging must never break the request */
  }
}

function tooManyFailures(ip) {
  const now = Date.now();
  const hits = (failures.get(ip) || []).filter((t) => now - t < FAIL_WINDOW_MS);
  failures.set(ip, hits);
  return hits.length >= FAIL_LIMIT;
}

function noteFailure(ip) {
  const hits = failures.get(ip) || [];
  hits.push(Date.now());
  failures.set(ip, hits);
  if (failures.size > 5000) failures.clear();
}

/**
 * Check a request for the read-only token.
 *   'none'    no token sent; caller falls back to the owner session
 *   'ok'      valid token on a GET; caller may serve read-only data
 *   'denied'  a response (401/403/429) was already sent; caller must return
 */
function checkReadonly(req, res, sendJson) {
  const presented = presentedToken(req);
  if (!presented) return 'none';
  const ip = clientIp(req) || 'unknown';
  if (String((req && req.method) || '').toUpperCase() !== 'GET') {
    audit(req, 'refused_write');
    sendJson(res, 403, { error: 'Read-only token cannot change anything.' });
    return 'denied';
  }
  if (tooManyFailures(ip)) {
    audit(req, 'rate_limited');
    sendJson(res, 429, { error: 'Too many attempts. Try again later.' });
    return 'denied';
  }
  const expected = configuredToken();
  if (!expected || !safeEqual(presented, expected)) {
    noteFailure(ip);
    audit(req, expected ? 'bad_token' : 'disabled');
    sendJson(res, 401, { error: 'Invalid admin token.' });
    return 'denied';
  }
  audit(req, 'read');
  if (res && typeof res.setHeader === 'function') res.setHeader('Cache-Control', 'no-store');
  return 'ok';
}

function resetForTests() {
  failures.clear();
}

module.exports = {
  HEADER,
  MIN_LENGTH,
  checkReadonly,
  isEnabled,
  presentedToken,
  resetForTests,
};
