'use strict';

/**
 * Store webhook verifier + event → status mapping.
 * Uses the existing hop to refresh the release after a signed event.
 * Never paints Live from a rejection / QC fail.
 */

const crypto = require('crypto');

const MAX_AGE_SEC = 5 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAIL_RE = /\.(rejected|failed|error)$|ingestion\.rejected|qc[._-]?fail|quality.?control.?fail/i;

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const target = String(name || '').toLowerCase();
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i].toLowerCase() === target) {
      const value = headers[keys[i]];
      return String(Array.isArray(value) ? value[0] : value || '').trim();
    }
  }
  return '';
}

function readRawBody(req) {
  if (!req) return Promise.resolve(Buffer.alloc(0));
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body));
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseSignatureHeader(header) {
  let timestamp = '';
  const signatures = [];
  String(header || '')
    .split(',')
    .map((part) => part.trim())
    .forEach((part) => {
      const eq = part.indexOf('=');
      if (eq === -1) return;
      const key = part.slice(0, eq);
      const value = part.slice(eq + 1);
      if (key === 't') timestamp = value;
      if (key === 'v1' && value) signatures.push(value);
    });
  return { timestamp, signatures };
}

function sign(rawBody, secret, timestamp) {
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  return crypto.createHmac('sha256', String(secret || '')).update(String(timestamp) + '.' + raw).digest('hex');
}

function verify(rawBody, headers, secret, nowSec) {
  const sec = String(secret || '').trim();
  if (!sec) return { ok: true, skipped: true };

  const header = headerValue(headers, 'x-tonegrid-signature')
    || headerValue(headers, 'x-webhook-signature');
  const parsed = parseSignatureHeader(header);
  if (!parsed.timestamp || !parsed.signatures.length) {
    return { ok: false, reason: 'bad_header' };
  }

  const ts = Number(parsed.timestamp);
  const now = nowSec != null ? nowSec : Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_AGE_SEC) {
    return { ok: false, reason: 'timestamp' };
  }

  const expected = sign(rawBody, sec, parsed.timestamp);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const match = parsed.signatures.some((sig) => {
    const actual = Buffer.from(String(sig), 'utf8');
    return actual.length === expectedBuf.length && crypto.timingSafeEqual(actual, expectedBuf);
  });
  return match ? { ok: true } : { ok: false, reason: 'mismatch' };
}

function eventName(headers, data) {
  const fromHeader = headerValue(headers, 'x-tonegrid-event');
  if (fromHeader) return fromHeader;
  const raw = data && typeof data === 'object' ? data : {};
  return String(raw.event || raw.type || raw.name || '').trim();
}

function pickReleaseId(data) {
  const raw = data && typeof data === 'object' ? data : {};
  const nested = raw.data && typeof raw.data === 'object' ? raw.data : {};
  const release = (nested.release && typeof nested.release === 'object')
    ? nested.release
    : (raw.release && typeof raw.release === 'object' ? raw.release : {});
  const id = String(
    raw.release_id
    || raw.releaseId
    || nested.release_id
    || nested.releaseId
    || release.uuid
    || release.id
    || raw.uuid
    || nested.uuid
    || ''
  ).trim();
  return UUID_RE.test(id) ? id : '';
}

function pickReason(data) {
  const raw = data && typeof data === 'object' ? data : {};
  const nested = raw.data && typeof raw.data === 'object' ? raw.data : {};
  const release = (nested.release && typeof nested.release === 'object')
    ? nested.release
    : (raw.release && typeof raw.release === 'object' ? raw.release : {});
  return String(
    raw.rejection_reason
    || raw.error_message
    || raw.reason
    || raw.message
    || nested.rejection_reason
    || nested.error_message
    || nested.reason
    || nested.message
    || release.rejection_reason
    || release.error_message
    || release.reason
    || ''
  ).trim();
}

function pickPayloadStatus(data) {
  const raw = data && typeof data === 'object' ? data : {};
  const nested = raw.data && typeof raw.data === 'object' ? raw.data : {};
  const release = (nested.release && typeof nested.release === 'object')
    ? nested.release
    : (raw.release && typeof raw.release === 'object' ? raw.release : {});
  return String(
    raw.status
    || raw.tonegrid_status
    || nested.status
    || release.status
    || ''
  ).trim().toLowerCase();
}

function isFailEvent(event, status) {
  const name = String(event || '');
  const s = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (FAIL_RE.test(name)) return true;
  return s === 'rejected'
    || s === 'needs_fix'
    || s === 'needsfix'
    || s === 'error'
    || s === 'failed'
    || s === 'qc_failed'
    || s === 'qc_fail';
}

function statusFromEvent(event, payloadStatus) {
  const name = String(event || '');
  const payload = String(payloadStatus || '').trim().toLowerCase();
  if (isFailEvent(name, payload)) return 'needs-fix';
  if (/\.live$/.test(name) || payload === 'live' || payload === 'delivered') return payload || 'live';
  if (/\.taken_down$|takedown/.test(name) || payload === 'taken_down' || payload === 'takedown_submitted') {
    return payload || 'taken_down';
  }
  if (/\.accepted$|\.submitted$/.test(name) || payload === 'approved' || payload === 'processing' || payload === 'delivering' || payload === 'accepted' || payload === 'qc_inspection') {
    return payload || 'processing';
  }
  if (/release\.submitted$/.test(name) || payload === 'pending' || payload === 'pending_review') {
    return payload || 'pending';
  }
  if (/release\.created$/.test(name) || payload === 'draft') return 'draft';
  return payload || '';
}

function parseEvent(event, data) {
  const payloadStatus = pickPayloadStatus(data);
  const status = statusFromEvent(event, payloadStatus);
  const fail = isFailEvent(event, payloadStatus);
  return {
    event: String(event || ''),
    releaseId: pickReleaseId(data),
    status: fail ? 'needs-fix' : status,
    reason: pickReason(data),
    forceNeedsFix: fail,
  };
}

function persistStatus(storeStatus, parsed) {
  if (parsed && parsed.forceNeedsFix) return 'needs-fix';
  return String((storeStatus || (parsed && parsed.status) || '')).trim().toLowerCase();
}

module.exports = {
  MAX_AGE_SEC,
  eventName,
  headerValue,
  isFailEvent,
  parseEvent,
  persistStatus,
  pickReleaseId,
  readRawBody,
  sign,
  statusFromEvent,
  verify,
};
