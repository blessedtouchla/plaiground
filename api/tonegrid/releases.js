'use strict';

/**
 * GET  /api/tonegrid/releases → GET  {TONEGRID_BASE_URL}/releases
 * POST /api/tonegrid/releases → POST {TONEGRID_BASE_URL}/releases
 *
 * Server-only env: TONEGRID_API_KEY, TONEGRID_BASE_URL (never echo these).
 * Roster access is on; every create must include artist_id.
 */

const {
  RELEASE_TYPES,
  healthPayload,
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

const LIST_STATUSES = new Set(['draft', 'pending', 'approved', 'live', 'taken_down']);

function queryFromReq(req) {
  return req.query && typeof req.query === 'object' ? req.query : {};
}

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
  if (Array.isArray(payload.releases)) return payload.releases;
  return [];
}

function pickRelease(row) {
  if (!row || typeof row !== 'object') return null;
  const title = String(row.title || '').trim();
  const uuid = String(row.uuid || row.release_uuid || '').trim();
  if (!title && !uuid) return null;
  return {
    uuid,
    title,
    type: normalizeReleaseType(row.type) || 'single',
    status: String(row.status || '').trim().toLowerCase(),
    release_date: normalizeReleaseDate(row.release_date || row.releaseDate) || '',
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

async function listReleases(req, res) {
  const query = queryFromReq(req);
  const forwarded = {};
  if (query.page !== undefined && query.page !== '') forwarded.page = query.page;
  if (query.per_page !== undefined && query.per_page !== '') forwarded.per_page = query.per_page;
  if (query.status) {
    const status = String(query.status).trim().toLowerCase();
    if (!LIST_STATUSES.has(status)) {
      sendJson(res, 400, { error: 'status must be draft, pending, approved, live, or taken_down.' });
      return;
    }
    forwarded.status = status;
  }
  if (query.type) {
    const type = normalizeReleaseType(query.type);
    if (!RELEASE_TYPES.has(type)) {
      sendJson(res, 400, { error: 'type must be single, ep, or album.' });
      return;
    }
    forwarded.type = type;
  }

  const result = await tonegridFetch('/releases', { method: 'GET', query: forwarded });
  if (!result.ok) {
    sendJson(res, result.status, result.data);
    return;
  }

  const raw = result.data && typeof result.data === 'object' ? result.data : {};
  const releases = asList(raw).map(pickRelease).filter(Boolean);
  const health = healthPayload();
  sendJson(res, 200, {
    configured: true,
    sandbox: health.sandbox,
    releases,
    total: typeof raw.total === 'number' ? raw.total : releases.length,
    page: typeof raw.page === 'number' ? raw.page : 1,
    per_page: typeof raw.per_page === 'number' ? raw.per_page : releases.length,
  });
}

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
  if (req.method === 'GET') {
    await listReleases(req, res);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await createRelease(req, res);
};
