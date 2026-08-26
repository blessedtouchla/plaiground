'use strict';

/**
 * Server-only private object hop. Browser never sees these env values.
 * Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET, R2_ENDPOINT. Missing any of them is a nameless error.
 */

const crypto = require('crypto');

const STEP_FAIL_COPY = 'We could not finish this step.';
const AUDIO_SEND_COPY = 'We could not send the audio. Retry.';
const REGION = 'auto';
const SERVICE = 's3';
const PUT_EXPIRES = 300;
const GET_EXPIRES = 120;
const GET_TIMEOUT_MS = 20000;
const AUDIO_MAX = 200 * 1024 * 1024;
const COVER_MAX = 15 * 1024 * 1024;
const KINDS = {
  audio: { prefix: 'audio', max: AUDIO_MAX },
  cover: { prefix: 'covers', max: COVER_MAX },
};
const USER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_RE = /^(audio|covers)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([A-Za-z0-9._-]+)$/i;

function env(name) {
  return String(process.env[name] || '').trim();
}

function isConfigured() {
  return Boolean(
    env('R2_ACCOUNT_ID')
    && env('R2_ACCESS_KEY_ID')
    && env('R2_SECRET_ACCESS_KEY')
    && env('R2_BUCKET')
    && env('R2_ENDPOINT')
  );
}

function missingCopy() {
  return STEP_FAIL_COPY;
}

function sendCopy(kind) {
  return kind === 'audio' ? AUDIO_SEND_COPY : STEP_FAIL_COPY;
}

function endpointBase() {
  return env('R2_ENDPOINT').replace(/\/+$/, '');
}

function endpointHost() {
  try {
    return new URL(endpointBase()).host;
  } catch {
    return '';
  }
}

function uriEncode(value, pathname) {
  const encoded = encodeURIComponent(String(value == null ? '' : value))
    .replace(/[!'()*]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
  return pathname ? encoded.replace(/%2F/g, '/') : encoded;
}

function encodeKey(key) {
  return String(key || '').split('/').map((part) => uriEncode(part, false)).join('/');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function signingKey(secret, stamp) {
  const kDate = hmac('AWS4' + secret, stamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

function safeFilename(name) {
  const raw = String(name || 'file').split(/[/\\]/).pop() || 'file';
  const cleaned = raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (cleaned || 'file').slice(0, 80);
}

function parseKind(kind) {
  const key = String(kind || '').trim().toLowerCase();
  if (key === 'artwork' || key === 'art' || key === 'cover') return 'cover';
  if (key === 'audio') return 'audio';
  return '';
}

function objectKey(kind, userId, filename) {
  const parsed = parseKind(kind);
  const spec = KINDS[parsed];
  const user = String(userId || '').trim();
  if (!spec || !USER_RE.test(user)) return '';
  return spec.prefix + '/' + user + '/' + crypto.randomUUID() + '-' + safeFilename(filename);
}

function parseObjectKey(key) {
  const match = String(key || '').trim().match(KEY_RE);
  if (!match) return null;
  return {
    kind: match[1] === 'covers' ? 'cover' : 'audio',
    prefix: match[1],
    userId: match[2],
    id: match[3],
    filename: match[4],
  };
}

function isObjectKey(value) {
  return Boolean(parseObjectKey(value));
}

function ownedKey(key, userId, kind) {
  const parsed = parseObjectKey(key);
  if (!parsed) return null;
  if (String(parsed.userId).toLowerCase() !== String(userId || '').trim().toLowerCase()) return null;
  if (kind && parsed.kind !== parseKind(kind) && parsed.kind !== kind) return null;
  return parsed;
}

function filenameOf(key, fallback) {
  const parsed = parseObjectKey(key);
  return (parsed && parsed.filename) || safeFilename(fallback) || 'file';
}

function canonicalUri(key) {
  return '/' + uriEncode(env('R2_BUCKET'), false) + '/' + encodeKey(key);
}

function queryString(params) {
  return Object.keys(params).sort().map((name) => (
    uriEncode(name, false) + '=' + uriEncode(params[name], false)
  )).join('&');
}

function presign(method, key, opts) {
  const options = opts || {};
  if (!isConfigured()) {
    const err = new Error(missingCopy());
    err.code = 'OBJECT_STORE_MISSING';
    throw err;
  }
  const now = options.now instanceof Date ? options.now : new Date();
  const expires = Number(options.expires) > 0 ? Number(options.expires) : (method === 'GET' ? GET_EXPIRES : PUT_EXPIRES);
  const contentType = String(options.contentType || '').trim();
  const host = endpointHost();
  const amz = amzDate(now);
  const stamp = amz.slice(0, 8);
  const credential = env('R2_ACCESS_KEY_ID') + '/' + stamp + '/' + REGION + '/' + SERVICE + '/aws4_request';
  const signedHeaders = contentType ? 'content-type;host' : 'host';
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amz,
    'X-Amz-Expires': String(Math.min(Math.max(Math.floor(expires), 30), 3600)),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const query = queryString(params);
  const canonicalHeaders = (contentType ? 'content-type:' + contentType.toLowerCase() + '\n' : '')
    + 'host:' + host + '\n';
  const canonicalRequest = [
    String(method || 'PUT').toUpperCase(),
    canonicalUri(key),
    query,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amz,
    stamp + '/' + REGION + '/' + SERVICE + '/aws4_request',
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = crypto.createHmac('sha256', signingKey(env('R2_SECRET_ACCESS_KEY'), stamp))
    .update(stringToSign, 'utf8')
    .digest('hex');
  const url = endpointBase() + canonicalUri(key) + '?' + query + '&X-Amz-Signature=' + signature;
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  return {
    url: url,
    headers: headers,
    expires_in: Number(params['X-Amz-Expires']),
    object_key: key,
  };
}

function presignPut(key, contentType, opts) {
  return presign('PUT', key, Object.assign({}, opts, { contentType: contentType }));
}

function presignGet(key, opts) {
  return presign('GET', key, opts);
}

async function getObject(key, opts) {
  if (!isConfigured()) {
    const err = new Error(missingCopy());
    err.code = 'OBJECT_STORE_MISSING';
    throw err;
  }
  const signed = presignGet(key);
  const ms = Number(opts && opts.timeoutMs);
  const timeoutMs = ms > 0 && isFinite(ms) ? ms : GET_TIMEOUT_MS;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try { if (controller) controller.abort(); } catch { /* ignore */ }
      const err = new Error(STEP_FAIL_COPY);
      err.code = 'OBJECT_STORE_GET';
      err.name = 'AbortError';
      reject(err);
    }, timeoutMs);
  });
  let response;
  try {
    const fetchOpts = { method: 'GET' };
    if (controller) fetchOpts.signal = controller.signal;
    response = await Promise.race([
      fetch(signed.url, fetchOpts),
      timeoutPromise,
    ]);
  } catch {
    const err = new Error(STEP_FAIL_COPY);
    err.code = 'OBJECT_STORE_GET';
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!response || !response.ok) {
    const err = new Error(STEP_FAIL_COPY);
    err.code = 'OBJECT_STORE_GET';
    err.status = response ? response.status : 502;
    throw err;
  }
  const buf = Buffer.from(await response.arrayBuffer());
  return {
    body: buf,
    contentType: String((response.headers && response.headers.get && response.headers.get('content-type')) || '').trim(),
    contentLength: buf.length,
  };
}

function asMultipart(field, filename, contentType, body) {
  const boundary = '----plaiground' + crypto.randomBytes(12).toString('hex');
  const name = String(filename || 'file').replace(/"/g, '');
  const type = String(contentType || 'application/octet-stream');
  const head = Buffer.from(
    '--' + boundary + '\r\n'
    + 'Content-Disposition: form-data; name="' + String(field || 'file') + '"; filename="' + name + '"\r\n'
    + 'Content-Type: ' + type + '\r\n\r\n'
  );
  const fileBuf = Buffer.isBuffer(body) ? body : Buffer.from(body || '');
  const tail = Buffer.from('\r\n--' + boundary + '--\r\n');
  return {
    rawBody: Buffer.concat([head, fileBuf, tail]),
    contentType: 'multipart/form-data; boundary=' + boundary,
    filename: name,
    mime: type,
  };
}

function validateMint(kind, filename, contentType, size) {
  const parsed = parseKind(kind);
  const spec = KINDS[parsed];
  if (!spec) return { error: STEP_FAIL_COPY };
  const bytes = Number(size);
  if (!isFinite(bytes) || bytes < 1) return { error: STEP_FAIL_COPY };
  if (bytes > spec.max) {
    return {
      error: parsed === 'audio' ? 'Audio must be 200 MB or smaller.' : 'Artwork must be 15 MB or smaller.',
    };
  }
  const name = safeFilename(filename);
  if (parsed === 'audio') {
    if (!/\.(wav|flac|mp3|mpeg|mpga)$/i.test(name) && !/audio\/(wav|x-wav|wave|flac|x-flac|mpeg|mp3|x-mpeg|x-mp3|mpeg3|mpg)/i.test(String(contentType || ''))) {
      return { error: 'Audio must be WAV, FLAC, or MP3.' };
    }
  } else if (!/\.(jpe?g|png)$/i.test(name) && !/image\/(jpeg|jpg|png)/i.test(String(contentType || ''))) {
    return { error: 'Artwork must be JPG or PNG.' };
  }
  return { ok: true, kind: parsed, filename: name, max: spec.max };
}

module.exports = {
  AUDIO_MAX,
  AUDIO_SEND_COPY,
  COVER_MAX,
  GET_EXPIRES,
  GET_TIMEOUT_MS,
  PUT_EXPIRES,
  STEP_FAIL_COPY,
  asMultipart,
  endpointBase,
  filenameOf,
  getObject,
  isConfigured,
  isObjectKey,
  missingCopy,
  objectKey,
  ownedKey,
  parseKind,
  parseObjectKey,
  presignGet,
  presignPut,
  safeFilename,
  sendCopy,
  validateMint,
};
