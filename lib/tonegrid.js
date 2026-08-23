'use strict';

/**
 * Server-only ToneGrid helpers. Read TONEGRID_API_KEY and TONEGRID_BASE_URL
 * from process.env. Never log Authorization or the key.
 */

const crypto = require('crypto');

const SANDBOX_HOST = 'api-sandbox.tonegrid.pro';
const RELEASE_TYPES = new Set(['single', 'ep', 'album']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO2_RE = /^[A-Za-z]{2}$/;
const ISO_LANG_RE = /^[a-z]{2}$/;
const YOUTUBE_MUSIC_SLUG = 'youtube-music';
const DOCUMENTED_DSPS = [
  'spotify',
  'apple-music',
  'youtube-music',
  'amazon-music',
  'deezer',
  'tidal',
  'soundcloud',
  'boomplay',
  'audiomack',
  'pandora',
  'napster',
  'anghami',
  'tiktok',
  'tiktok-music',
  'iheartradio',
  'kkbox',
  'jiosaavn',
  'youtube',
];
const SUBMITTABLE = new Set(['draft', 'rejected']);
const EDITABLE_RELEASE = new Set(['draft', 'pending']);

function apiKey() {
  return String(process.env.TONEGRID_API_KEY || '').trim();
}

function baseUrl() {
  return String(process.env.TONEGRID_BASE_URL || '').trim().replace(/\/+$/, '');
}

function isConfigured() {
  return Boolean(apiKey() && baseUrl());
}

function parsedBase() {
  try {
    return new URL(baseUrl());
  } catch {
    return null;
  }
}

function isSandboxBase() {
  const parsed = parsedBase();
  if (!parsed) return false;
  return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === SANDBOX_HOST;
}

function healthPayload() {
  const configured = isConfigured();
  return {
    configured,
    sandbox: configured && isSandboxBase(),
  };
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function notConfigured(res) {
  sendJson(res, 503, {
    configured: false,
    error: 'ToneGrid is not configured.',
  });
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body || '{}'));
    } catch {
      return Promise.reject(new Error('Invalid JSON'));
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function headerValue(req, name) {
  if (!req || !req.headers) return '';
  const target = String(name || '').toLowerCase();
  const headers = req.headers;
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i].toLowerCase() === target) {
      const value = headers[keys[i]];
      return String(Array.isArray(value) ? value[0] : value || '').trim();
    }
  }
  return '';
}

function stripAuthorization(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = {};
  Object.keys(value).forEach((key) => {
    if (String(key).toLowerCase() === 'authorization') return;
    out[key] = value[key];
  });
  return out;
}

function scrub(text) {
  const secret = apiKey();
  let out = String(text || '');
  if (secret) out = out.split(secret).join('[redacted]');
  return out
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/authorization\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi, 'authorization: [redacted]')
    .slice(0, 400);
}

function fieldMessages(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const bags = [payload.fields, payload.errors];
  const out = [];
  bags.forEach((bag) => {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return;
    Object.keys(bag).forEach((key) => {
      const value = bag[key];
      if (typeof value === 'string' && value.trim()) out.push(value.trim());
      else if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'string' && item.trim()) out.push(item.trim());
          else if (item && typeof item.message === 'string') out.push(item.message.trim());
        });
      } else if (value && typeof value.message === 'string') {
        out.push(value.message.trim());
      }
    });
  });
  return out;
}

function tonegridErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'ToneGrid rejected the request.';
  }
  const raw =
    (typeof payload.error === 'string' && payload.error) ||
    (payload.error && typeof payload.error.message === 'string' && payload.error.message) ||
    (typeof payload.message === 'string' && payload.message) ||
    fieldMessages(payload).join(' ') ||
    '';
  if (/api[\s_-]*key|secret|bearer|authorization/i.test(raw)) {
    return 'ToneGrid rejected the request.';
  }
  if (!raw) return 'ToneGrid rejected the request.';
  return scrub(raw);
}

function deriveSlug(value) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug;
}

function normalizeCountry(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!ISO2_RE.test(raw)) return null;
  return raw.toUpperCase();
}

function normalizeReleaseType(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeReleaseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (ISO_DATE_RE.test(raw)) return raw;
  const mdy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdy) {
    const month = mdy[1].padStart(2, '0');
    const day = mdy[2].padStart(2, '0');
    return mdy[3] + '-' + month + '-' + day;
  }
  return '';
}

function normalizeLanguage(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (!ISO_LANG_RE.test(raw)) return null;
  return raw;
}

function minSubmitDate(now) {
  const d = now instanceof Date ? new Date(now.getTime()) : new Date(now || Date.now());
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() + 7);
    return fallback.toISOString().slice(0, 10);
  }
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function normalizeDspSlug(value) {
  return String(value || '').trim().toLowerCase();
}

function documentedStores() {
  return DOCUMENTED_DSPS.slice();
}

function withYouTubeMusic(slugs) {
  const out = [];
  const seen = new Set();
  (Array.isArray(slugs) ? slugs : []).forEach((value) => {
    const slug = normalizeDspSlug(value);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  if (!seen.has(YOUTUBE_MUSIC_SLUG)) out.push(YOUTUBE_MUSIC_SLUG);
  return out;
}

function parseStoreSlugs(payload) {
  if (Array.isArray(payload)) {
    return payload.map((row) => {
      if (typeof row === 'string') return normalizeDspSlug(row);
      if (!row || typeof row !== 'object') return '';
      return normalizeDspSlug(row.slug || row.dsp || row.name || row.dsp_slug);
    }).filter(Boolean);
  }
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.dsps)) return parseStoreSlugs(payload.dsps);
  if (Array.isArray(payload.stores)) return parseStoreSlugs(payload.stores);
  if (Array.isArray(payload.data)) return parseStoreSlugs(payload.data);
  if (payload.data && Array.isArray(payload.data.dsps)) return parseStoreSlugs(payload.data.dsps);
  return [];
}

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function idempotencyKey(req, fallbackParts) {
  const fromHeader = headerValue(req, 'idempotency-key');
  if (fromHeader && fromHeader.length <= 255) return fromHeader;
  const digest = crypto
    .createHash('sha256')
    .update(String(fallbackParts || crypto.randomUUID()))
    .digest('hex')
    .slice(0, 32);
  return ('plaiground-' + digest).slice(0, 255);
}

function joinUrl(path, query) {
  let url;
  try {
    url = new URL(baseUrl() + (String(path || '').startsWith('/') ? path : '/' + path));
  } catch {
    return null;
  }
  if (query && typeof query === 'object') {
    Object.keys(query).forEach((key) => {
      const value = query[key];
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function tonegridFetch(path, options) {
  const opts = options || {};
  const method = String(opts.method || 'GET').toUpperCase();
  const target = joinUrl(path, opts.query);
  if (!target) {
    return { ok: false, status: 503, data: { configured: false, error: 'ToneGrid is not configured.' } };
  }
  const headers = {
    Accept: 'application/json',
    Authorization: 'Bearer ' + apiKey(),
  };
  let body;
  if (opts.rawBody !== undefined) {
    if (opts.contentType) headers['Content-Type'] = String(opts.contentType);
    body = opts.rawBody;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (method !== 'GET' && opts.idempotencyKey) {
    headers['Idempotency-Key'] = String(opts.idempotencyKey).slice(0, 255);
  }

  let response;
  try {
    response = await fetch(target, {
      method,
      headers,
      body,
    });
  } catch {
    return { ok: false, status: 502, data: { error: 'Could not reach ToneGrid.' } };
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = {
      error: tonegridErrorMessage(data),
    };
    if (data && typeof data === 'object' && data.errors && typeof data.errors === 'object') {
      error.errors = data.errors;
    }
    if (data && typeof data === 'object' && data.fields && typeof data.fields === 'object') {
      error.fields = data.fields;
    }
    return {
      ok: false,
      status: response.status >= 400 && response.status < 600 ? response.status : 502,
      data: error,
    };
  }

  return { ok: true, status: response.status, data };
}

module.exports = {
  DOCUMENTED_DSPS,
  EDITABLE_RELEASE,
  RELEASE_TYPES,
  SUBMITTABLE,
  YOUTUBE_MUSIC_SLUG,
  apiKey,
  baseUrl,
  deriveSlug,
  documentedStores,
  healthPayload,
  headerValue,
  idempotencyKey,
  isConfigured,
  isSandboxBase,
  isUuid,
  minSubmitDate,
  normalizeCountry,
  normalizeDspSlug,
  normalizeLanguage,
  normalizeReleaseDate,
  normalizeReleaseType,
  notConfigured,
  parseStoreSlugs,
  readBody,
  sendJson,
  stripAuthorization,
  tonegridErrorMessage,
  tonegridFetch,
  withYouTubeMusic,
};
