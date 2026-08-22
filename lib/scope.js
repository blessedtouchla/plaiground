'use strict';

/**
 * Session-scoped ToneGrid ids for the signed-in PLAIGROUND user.
 * Never treat the tenant catalog as theirs.
 */

const accounts = require('./accounts');
const {
  isConfigured,
  notConfigured,
  publicUser,
  sessionFromRequest,
} = require('./auth');
const { isUuid, sendJson } = require('./tonegrid');

function releaseIdsFrom(row) {
  const raw = row && Array.isArray(row.tonegrid_release_ids) ? row.tonegrid_release_ids : [];
  const seen = new Set();
  const out = [];
  raw.forEach((value) => {
    const id = String(value || '').trim();
    if (!isUuid(id)) return;
    const key = id.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(id);
  });
  return out;
}

function artistIdFrom(row) {
  const id = String((row && row.tonegrid_artist_id) || '').trim();
  return isUuid(id) ? id : '';
}

function allowedSet(ids) {
  const set = new Set();
  ids.forEach((id) => set.add(String(id).toLowerCase()));
  return set;
}

async function personalScope(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return null;
  }
  const session = sessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return null;
  }
  const row = await accounts.findById(session.userId);
  if (!row) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return null;
  }
  const releaseIds = releaseIdsFrom(row);
  const artistId = artistIdFrom(row);
  return {
    user: publicUser(row),
    artistId,
    releaseIds,
    allow: allowedSet(releaseIds),
    empty: releaseIds.length === 0,
  };
}

function idAllowed(allow, value) {
  const id = String(value || '').trim().toLowerCase();
  return Boolean(id && allow && allow.has(id));
}

module.exports = {
  allowedSet,
  artistIdFrom,
  idAllowed,
  personalScope,
  releaseIdsFrom,
};
