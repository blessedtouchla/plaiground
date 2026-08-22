'use strict';

/**
 * POST /api/tonegrid/releases → POST {TONEGRID_BASE_URL}/releases
 *
 * Server-only env: TONEGRID_API_KEY, TONEGRID_BASE_URL (never echo these).
 * Roster access is on; every create must include artist_id.
 */

const {
  RELEASE_TYPES,
  idempotencyKey,
  isConfigured,
  isUuid,
  normalizeReleaseDate,
  normalizeReleaseType,
  notConfigured,
  readBody,
  sendJson,
  tonegridFetch,
} = require('../../lib/tonegrid');

async function createRelease(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const artistId = String((body && (body.artist_id || body.artistId)) || '').trim();
  const title = String((body && body.title) || '').trim();
  const type = normalizeReleaseType(body && body.type);
  const releaseDate = normalizeReleaseDate(body && (body.release_date || body.releaseDate));
  const genre = String((body && body.genre) || '').trim();

  if (!artistId) {
    sendJson(res, 400, { error: 'artist_id is required.' });
    return;
  }
  if (!isUuid(artistId)) {
    sendJson(res, 400, { error: 'artist_id must be a uuid.' });
    return;
  }
  if (!title) {
    sendJson(res, 400, { error: 'title is required.' });
    return;
  }
  if (!RELEASE_TYPES.has(type)) {
    sendJson(res, 400, { error: 'type must be single, ep, or album.' });
    return;
  }
  if ((body && (body.release_date || body.releaseDate)) && !releaseDate) {
    sendJson(res, 400, { error: 'release_date must be YYYY-MM-DD.' });
    return;
  }

  const payload = {
    artist_id: artistId,
    title,
    type,
  };
  if (releaseDate) payload.release_date = releaseDate;
  if (genre) payload.genre = genre;

  const result = await tonegridFetch('/releases', {
    method: 'POST',
    body: payload,
    idempotencyKey: idempotencyKey(req, ['release', artistId, title, type, releaseDate].join(':')),
  });
  sendJson(res, result.status, result.data);
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
  await createRelease(req, res);
};
