'use strict';

/**
 * GET /api/auth  → apply schema when DATABASE_URL + SESSION_SECRET are set.
 */

const { ensureReady } = require('../lib/accounts');
const { isConfigured, notConfigured } = require('../lib/auth');
const { sendJson } = require('../lib/tonegrid');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  try {
    await ensureReady();
  } catch {
    notConfigured(res);
    return;
  }
  sendJson(res, 200, { ok: true, configured: true });
};
