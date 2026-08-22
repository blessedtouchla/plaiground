'use strict';

/**
 * POST /api/tonegrid/tracks → POST {TONEGRID_BASE_URL}/releases/:uuid/tracks
 *
 * Server-only env: TONEGRID_API_KEY, TONEGRID_BASE_URL (never echo these).
 * Body: { release_id, title, position?, explicit? }
 */

const {
  idempotencyKey,
  isConfigured,
  isUuid,
  notConfigured,
  readBody,
  sendJson,
  tonegridFetch,
} = require('../../lib/tonegrid');

function parseExplicit(value) {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0 || value == null || value === '') {
    return false;
  }
  return null;
}

function parsePosition(value) {
  if (value == null || value === '') return 1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

module.exports = async function handler(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const releaseId = String((body && (body.release_id || body.releaseId)) || '').trim();
  const title = String((body && body.title) || '').trim();
  const position = parsePosition(body && body.position);
  const explicit = parseExplicit(body && body.explicit);

  if (!releaseId) {
    sendJson(res, 400, { error: 'release_id is required.' });
    return;
  }
  if (!isUuid(releaseId)) {
    sendJson(res, 400, { error: 'release_id must be a uuid.' });
    return;
  }
  if (!title) {
    sendJson(res, 400, { error: 'title is required.' });
    return;
  }
  if (position == null) {
    sendJson(res, 400, { error: 'position must be a positive integer.' });
    return;
  }
  if (explicit == null) {
    sendJson(res, 400, { error: 'explicit must be true or false.' });
    return;
  }

  const result = await tonegridFetch('/releases/' + releaseId + '/tracks', {
    method: 'POST',
    body: { title, position, explicit },
    idempotencyKey: idempotencyKey(req, ['track', releaseId, title, String(position)].join(':')),
  });
  sendJson(res, result.status, result.data);
};
