'use strict';

/**
 * Server-only ToneGrid helpers. Read TONEGRID_API_KEY and TONEGRID_BASE_URL
 * from process.env. Never log Authorization or the key.
 */

const crypto = require('crypto');

const SANDBOX_HOST = 'api-sandbox.tonegrid.pro';
const DEFAULT_HOP_TIMEOUT_MS = 8000;
const AUDIO_HOP_TIMEOUT_MS = 90000;
const STORE_FORWARD_TIMEOUT_MS = 55000;
const LIST_HOP_TIMEOUT_MS = 5000;
const REACH_COPY = 'We could not reach the store.';
const AUDIO_SEND_COPY = 'We could not send the audio.';
const SANDBOX_REFUSAL_RE = /sandbox[- ]only|not enabled for (distribution|delivery)|production (key|account|environment) required|live environment required|sandbox (key|account) cannot/i;
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

function hopTimeoutMs(opts) {
  const options = opts || {};
  const n = Number(options.timeoutMs);
  if (n > 0 && isFinite(n)) return n;
  if (options.rawBody !== undefined) return STORE_FORWARD_TIMEOUT_MS;
  return DEFAULT_HOP_TIMEOUT_MS;
}

function storeForwardTimeoutMs(_converted, _startedAt) {
  return STORE_FORWARD_TIMEOUT_MS;
}

function hopBodyBytes(raw) {
  if (raw == null) return 0;
  if (typeof raw === 'string') return Buffer.byteLength(raw);
  if (Buffer.isBuffer(raw)) return raw.length;
  if (raw && raw.byteLength != null) return Number(raw.byteLength) || 0;
  return 0;
}

function asHopBody(raw) {
  if (Buffer.isBuffer(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  }
  return raw;
}

function isSandboxDistributionRefusal(text) {
  return SANDBOX_REFUSAL_RE.test(String(text || ''));
}

function storeUnreachable(extra) {
  return Object.assign({ ok: false, status: 502, timedOut: true, data: { error: REACH_COPY } }, extra || {});
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
    error: 'Catalog sync is not configured yet.',
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

const STEP_FAIL_COPY = 'We could not finish this step.';
const ARTIST_GONE_COPY = 'We could not create that artist. Try the name again.';

function isIdempotencyReuseError(text) {
  const raw = String(text || '');
  return /idempotency[- ]key/i.test(raw)
    || /reused with a different request body/i.test(raw)
    || (/rotate the key/i.test(raw) && /request body/i.test(raw));
}

function isArtistGoneError(text) {
  const raw = String(text || '').toLowerCase();
  return /not found in this tenant/.test(raw)
    || /artist not found/.test(raw)
    || /could not create that artist/.test(raw)
    || (/\btenant\b/.test(raw) && /artist/.test(raw));
}

function sanitizePartnerCopy(text) {
  const raw = String(text == null ? '' : text);
  if (/request entry too large|request entity too large|payload too large|function_payload_too_large|content too large/i.test(raw)) {
    return AUDIO_SEND_COPY;
  }
  if (isIdempotencyReuseError(raw)) return STEP_FAIL_COPY;
  if (isArtistGoneError(raw) || /\btenant\b/i.test(raw)) return ARTIST_GONE_COPY;
  return raw
    .replace(/\bthe\s+ToneGrid\b/gi, 'the store')
    .replace(/ToneGrid/gi, 'the store')
    .replace(/\bCloudflare\b/gi, 'the store')
    .replace(/\bInterSpace\b/gi, 'the store')
    .replace(/\bR2\b/g, 'the store')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function scrub(text) {
  const secret = apiKey();
  let out = String(text || '');
  if (secret) out = out.split(secret).join('[redacted]');
  return sanitizePartnerCopy(out
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/authorization\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi, 'authorization: [redacted]')
    .slice(0, 400));
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
    return 'The store rejected the request.';
  }
  const fields = fieldMessages(payload);
  const top =
    (typeof payload.error === 'string' && payload.error) ||
    (payload.error && typeof payload.error.message === 'string' && payload.error.message) ||
    (typeof payload.message === 'string' && payload.message) ||
    '';
  const raw = (fields.length && (!top || /^validation failed\.?$/i.test(String(top).trim()))
    ? fields.join(' ')
    : (top || fields.join(' ')));
  if (/api[\s_-]*key|secret|bearer|authorization/i.test(raw)) {
    return 'The store rejected the request.';
  }
  if (isIdempotencyReuseError(raw)) return STEP_FAIL_COPY;
  if (isArtistGoneError(raw) || /\btenant\b/i.test(raw)) return ARTIST_GONE_COPY;
  if (!raw) return 'The store rejected the request.';
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

function walkStorePayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.dsps)) return payload.dsps;
  if (Array.isArray(payload.stores)) return payload.stores;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === 'object') {
    if (Array.isArray(payload.data.dsps)) return payload.data.dsps;
    if (Array.isArray(payload.data.stores)) return payload.data.stores;
    if (Array.isArray(payload.data.data)) return payload.data.data;
  }
  return [];
}

function storeRowFrom(row) {
  if (typeof row === 'string') {
    const slug = normalizeDspSlug(row);
    return slug ? { slug: slug, name: slug } : null;
  }
  if (!row || typeof row !== 'object') return null;
  const slug = normalizeDspSlug(row.slug || row.dsp || row.dsp_slug || row.name);
  if (!slug) return null;
  const name = String(row.name || row.title || '').trim();
  return {
    slug: slug,
    name: name && name.toLowerCase() !== slug ? name : slug,
  };
}

function parseStoreRows(payload) {
  const seen = Object.create(null);
  const out = [];
  walkStorePayload(payload).forEach((row) => {
    const parsed = storeRowFrom(row);
    if (!parsed || seen[parsed.slug]) return;
    seen[parsed.slug] = true;
    out.push(parsed);
  });
  return out;
}

function parseStoreSlugs(payload) {
  return parseStoreRows(payload).map((row) => row.slug);
}

function parseStoreListMeta(payload) {
  const root = payload && typeof payload === 'object' ? payload : {};
  const meta = (root.meta && typeof root.meta === 'object' ? root.meta : null)
    || (root.data && root.data.meta && typeof root.data.meta === 'object' ? root.data.meta : null)
    || {};
  const summary = (root.data && root.data.summary && typeof root.data.summary === 'object')
    ? root.data.summary
    : {};
  return {
    total: Number(meta.total || summary.total_active || 0) || 0,
    page: Number(meta.current_page || meta.page || 0) || 0,
    lastPage: Number(meta.last_page || 0) || 0,
    perPage: Number(meta.per_page || 0) || 0,
    hasMore: meta.has_more === true,
    nextCursor: String(meta.next_cursor || ''),
  };
}

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function hopIdempotencyKey(hop, method, path, fingerprint) {
  const label = String(hop || 'hop')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'hop';
  const material = [label, String(method || '').toUpperCase(), String(path || ''), String(fingerprint || '')].join('\n');
  const digest = crypto.createHash('sha256').update(material).digest('hex').slice(0, 32);
  return ('plaiground-' + label + '-' + digest).slice(0, 255);
}

function idempotencyKey(req, fallbackParts) {
  // Never forward the browser Idempotency-Key to ToneGrid as-is.
  // Submit sends plaiground-submit-<releaseId>; reusing that raw key on
  // PATCH date / POST dsps / POST submit (different bodies) is rejected.
  return hopIdempotencyKey('op', '', '', fallbackParts || crypto.randomUUID());
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
    return { ok: false, status: 503, data: { configured: false, error: 'Catalog sync is not configured yet.' } };
  }
  const headers = {
    Accept: 'application/json',
    Authorization: 'Bearer ' + apiKey(),
  };
  let body;
  if (opts.rawBody !== undefined) {
    if (opts.contentType) headers['Content-Type'] = String(opts.contentType);
    const bytes = hopBodyBytes(opts.rawBody);
    if (bytes > 0) headers['Content-Length'] = String(bytes);
    body = asHopBody(opts.rawBody);
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (method !== 'GET' && opts.idempotencyKey) {
    headers['Idempotency-Key'] = String(opts.idempotencyKey).slice(0, 255);
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const ms = hopTimeoutMs(opts);
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try { if (controller) controller.abort(); } catch {
        /* ignore */
      }
      const err = new Error(REACH_COPY);
      err.name = 'AbortError';
      err.timedOut = true;
      reject(err);
    }, ms);
  });

  let response;
  try {
    const fetchOpts = {
      method,
      headers,
      body,
    };
    if (controller) fetchOpts.signal = controller.signal;
    response = await Promise.race([
      fetch(target, fetchOpts),
      timeoutPromise,
    ]);
  } catch {
    if (timer) clearTimeout(timer);
    return storeUnreachable();
  }
  if (timer) clearTimeout(timer);

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
  AUDIO_HOP_TIMEOUT_MS,
  AUDIO_SEND_COPY,
  STORE_FORWARD_TIMEOUT_MS,
  asHopBody,
  hopBodyBytes,
  DEFAULT_HOP_TIMEOUT_MS,
  DOCUMENTED_DSPS,
  EDITABLE_RELEASE,
  LIST_HOP_TIMEOUT_MS,
  REACH_COPY,
  RELEASE_TYPES,
  SUBMITTABLE,
  YOUTUBE_MUSIC_SLUG,
  apiKey,
  baseUrl,
  hopTimeoutMs,
  storeForwardTimeoutMs,
  isSandboxDistributionRefusal,
  deriveSlug,
  documentedStores,
  healthPayload,
  headerValue,
  hopIdempotencyKey,
  idempotencyKey,
  isArtistGoneError,
  isIdempotencyReuseError,
  ARTIST_GONE_COPY,
  STEP_FAIL_COPY,
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
  parseStoreListMeta,
  parseStoreRows,
  parseStoreSlugs,
  readBody,
  sendJson,
  stripAuthorization,
  tonegridErrorMessage,
  tonegridFetch,
  withYouTubeMusic,
};
