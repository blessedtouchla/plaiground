'use strict';

/**
 * GET  /api/me          session required
 * POST /api/me          session required; store stripe_session_id only
 *                       (plan is set by the signed Stripe webhook, not the client)
 * POST /api/me/catalog  session required; save ToneGrid uuids
 *
 * Public URLs stay the same via vercel.json rewrites. One Hobby function.
 */

const { findById, updateCatalog, updateStripe } = require('../lib/accounts');
const {
  attachSession,
  bodyHasPassword,
  isConfigured,
  notConfigured,
  publicUser,
  rejectQueryPassword,
  rejectUnconfirmed,
  sessionFromRequest,
} = require('../lib/auth');
const { pathnameOf, queryValue } = require('../lib/route');
const { isUuid, readBody, sendJson } = require('../lib/tonegrid');

function isCatalog(req) {
  const path = pathnameOf(req);
  if (path === '/api/me/catalog') return true;
  return queryValue(req, 'action') === 'catalog';
}

async function loadUser(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return null;
  }
  const session = sessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return null;
  }
  const row = await findById(session.userId);
  if (!row) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return null;
  }
  if (rejectUnconfirmed(res, row)) return null;
  attachSession(req, res, row.id);
  return row;
}

async function updateMembership(req, res, row) {
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
  const sessionId = String((body && (body.stripe_session_id || body.session_id || body.stripeSessionId)) || '').trim();
  const customerId = String((body && (body.stripe_customer_id || body.customer_id)) || '').trim();
  const next = await updateStripe(row.id, {
    sessionId: sessionId || undefined,
    customerId: customerId || undefined,
  });
  sendJson(res, 200, publicUser(next || row));
}

async function catalog(req, res) {
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
  const trackId = String((body && (body.track_id || body.trackId)) || '').trim();
  if (artistId && !isUuid(artistId)) {
    sendJson(res, 400, { error: 'artist_id must be a uuid.' });
    return;
  }
  if (releaseId && !isUuid(releaseId)) {
    sendJson(res, 400, { error: 'release_id must be a uuid.' });
    return;
  }
  if (trackId && !isUuid(trackId)) {
    sendJson(res, 400, { error: 'track_id must be a uuid.' });
    return;
  }
  if (!artistId && !releaseId && !trackId) {
    sendJson(res, 400, { error: 'artist_id, release_id, or track_id is required.' });
    return;
  }

  try {
    const row = await findById(session.userId);
    if (!row) {
      sendJson(res, 401, { error: 'Sign in required.' });
      return;
    }
    if (rejectUnconfirmed(res, row)) return;
    attachSession(req, res, row.id);
    const next = await updateCatalog(row.id, {
      artistId: artistId || undefined,
      releaseId: releaseId || undefined,
      trackId: trackId || undefined,
    });
    sendJson(res, 200, publicUser(next || row));
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
}

module.exports = async function handler(req, res) {
  if (isCatalog(req)) {
    await catalog(req, res);
    return;
  }
  if (rejectQueryPassword(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  try {
    const row = await loadUser(req, res);
    if (!row) return;
    if (req.method === 'POST') {
      await updateMembership(req, res, row);
      return;
    }
    sendJson(res, 200, publicUser(row));
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
};
