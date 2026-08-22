'use strict';

/**
 * POST /api/me/catalog { artist_id?, release_id? }
 * Saves ToneGrid uuids on the signed-in PLAIGROUND user.
 */

const { findById, updateCatalog } = require('../../lib/accounts');
const {
  bodyHasPassword,
  isConfigured,
  notConfigured,
  publicUser,
  rejectQueryPassword,
  sessionFromRequest,
} = require('../../lib/auth');
const { isUuid, readBody, sendJson } = require('../../lib/tonegrid');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (rejectQueryPassword(req, res)) return;
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }

  const session = sessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  if (bodyHasPassword(body)) {
    sendJson(res, 400, { error: 'Password is not accepted here.' });
    return;
  }

  const artistId = String((body && (body.artist_id || body.artistId)) || '').trim();
  const releaseId = String((body && (body.release_id || body.releaseId)) || '').trim();
  if (artistId && !isUuid(artistId)) {
    sendJson(res, 400, { error: 'artist_id must be a uuid.' });
    return;
  }
  if (releaseId && !isUuid(releaseId)) {
    sendJson(res, 400, { error: 'release_id must be a uuid.' });
    return;
  }
  if (!artistId && !releaseId) {
    sendJson(res, 400, { error: 'artist_id or release_id is required.' });
    return;
  }

  try {
    const row = await findById(session.userId);
    if (!row) {
      sendJson(res, 401, { error: 'Sign in required.' });
      return;
    }
    const next = await updateCatalog(row.id, {
      artistId: artistId || undefined,
      releaseId: releaseId || undefined,
    });
    sendJson(res, 200, publicUser(next || row));
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
};
