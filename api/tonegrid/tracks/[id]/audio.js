'use strict';

/**
 * POST /api/tonegrid/tracks/:id/audio
 * Forwards multipart field `audio` to ToneGrid. Never exposes TONEGRID_API_KEY.
 * Max 200MB per ToneGrid docs. Audio is stored by ToneGrid, not PLAIGROUND.
 */

const {
  headerValue,
  idempotencyKey,
  isConfigured,
  isUuid,
  notConfigured,
  sendJson,
  tonegridFetch,
} = require('../../../../lib/tonegrid');

const MAX_BYTES = 200 * 1024 * 1024;

function trackIdFromReq(req) {
  const query = req && req.query && typeof req.query === 'object' ? req.query : {};
  if (query.id) return String(query.id).trim();
  const rawUrl = req && req.url ? String(req.url) : '';
  const match = rawUrl.match(/\/tracks\/([^/?#]+)\/audio/i);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

function looksLikeAudioPart(buf) {
  const head = buf.slice(0, 8192).toString('latin1');
  if (/filename="[^"]+\.(wav|flac)"/i.test(head)) return true;
  if (/filename="/i.test(head) && !/\.(wav|flac)"/i.test(head)) return false;
  return true;
}

function readRawBody(req, maxBytes) {
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > maxBytes) {
      return Promise.reject(Object.assign(new Error('too large'), { code: 'TOO_LARGE' }));
    }
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > maxBytes) {
        done = true;
        reject(Object.assign(new Error('too large'), { code: 'TOO_LARGE' }));
        if (typeof req.destroy === 'function') req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

async function handler(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const trackId = trackIdFromReq(req);
  if (!trackId) {
    sendJson(res, 400, { error: 'track id is required.' });
    return;
  }
  if (!isUuid(trackId)) {
    sendJson(res, 400, { error: 'track id must be a uuid.' });
    return;
  }

  const contentType = headerValue(req, 'content-type');
  if (!/multipart\/form-data/i.test(contentType)) {
    sendJson(res, 400, { error: 'audio must be multipart/form-data.' });
    return;
  }

  const declared = Number(headerValue(req, 'content-length') || 0);
  if (declared > MAX_BYTES) {
    sendJson(res, 413, { error: 'Audio must be 200 MB or smaller.' });
    return;
  }

  let raw;
  try {
    raw = await readRawBody(req, MAX_BYTES);
  } catch (err) {
    if (err && err.code === 'TOO_LARGE') {
      sendJson(res, 413, { error: 'Audio must be 200 MB or smaller.' });
      return;
    }
    sendJson(res, 400, { error: 'Could not read the audio upload.' });
    return;
  }

  if (!raw || !raw.length) {
    sendJson(res, 400, { error: 'audio file is required.' });
    return;
  }
  if (!looksLikeAudioPart(raw)) {
    sendJson(res, 400, { error: 'Audio must be WAV or FLAC.' });
    return;
  }

  const result = await tonegridFetch('/tracks/' + trackId + '/audio', {
    method: 'POST',
    rawBody: raw,
    contentType,
    idempotencyKey: idempotencyKey(req, 'audio:' + trackId),
  });
  sendJson(res, result.status, result.data);
}

handler.config = {
  api: { bodyParser: false },
};

module.exports = handler;
