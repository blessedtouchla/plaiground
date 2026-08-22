'use strict';

/**
 * GET  /api/me          session required
 * POST /api/me          session required; store stripe_session_id + plan
 */

const { findById, updateStripe } = require('../lib/accounts');
const {
  bodyHasPassword,
  isConfigured,
  normalizePaidPlan,
  notConfigured,
  publicUser,
  rejectQueryPassword,
  sessionFromRequest,
} = require('../lib/auth');
const { readBody, sendJson } = require('../lib/tonegrid');

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
  const plan = normalizePaidPlan(body && body.plan);
  const customerId = String((body && (body.stripe_customer_id || body.customer_id)) || '').trim();
  const next = await updateStripe(row.id, {
    plan,
    sessionId: sessionId || undefined,
    customerId: customerId || undefined,
  });
  sendJson(res, 200, publicUser(next || row));
}

module.exports = async function handler(req, res) {
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
