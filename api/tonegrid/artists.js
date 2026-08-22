'use strict';

/**
 * GET  /api/tonegrid/artists  → GET {TONEGRID_BASE_URL}/artists
 * POST /api/tonegrid/artists  → POST {TONEGRID_BASE_URL}/artists
 *
 * Server-only env: TONEGRID_API_KEY, TONEGRID_BASE_URL (never echo these).
 */

const {
  deriveSlug,
  idempotencyKey,
  isConfigured,
  normalizeCountry,
  notConfigured,
  readBody,
  sendJson,
  tonegridFetch,
} = require('../../lib/tonegrid');

function queryFromReq(req) {
  const query = req.query && typeof req.query === 'object' ? req.query : {};
  const out = {};
  ['page', 'per_page', 'q', 'search'].forEach((key) => {
    if (query[key] !== undefined && query[key] !== '') out[key] = query[key];
  });
  return out;
}

async function listArtists(req, res) {
  const result = await tonegridFetch('/artists', {
    method: 'GET',
    query: queryFromReq(req),
  });
  sendJson(res, result.status, result.data);
}

async function createArtist(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const name = String((body && body.name) || '').trim();
  if (!name) {
    sendJson(res, 400, { error: 'Artist name is required.' });
    return;
  }

  const slug = deriveSlug((body && body.slug) || name);
  if (!slug) {
    sendJson(res, 400, { error: 'Artist name needs at least one letter or number for a slug.' });
    return;
  }

  const payload = { name, slug };
  if (body && body.country !== undefined && body.country !== '') {
    const country = normalizeCountry(body.country);
    if (!country) {
      sendJson(res, 400, { error: 'Country must be a 2-letter ISO code.' });
      return;
    }
    payload.country = country;
  }

  const result = await tonegridFetch('/artists', {
    method: 'POST',
    body: payload,
    idempotencyKey: idempotencyKey(req, 'artist:' + slug),
  });
  sendJson(res, result.status, result.data);
}

module.exports = async function handler(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }

  if (req.method === 'GET') {
    await listArtists(req, res);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await createArtist(req, res);
};
