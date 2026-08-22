'use strict';

/**
 * POST /api/auth/logout
 */

const { clearSession, isConfigured, notConfigured } = require('../../lib/auth');
const { sendJson } = require('../../lib/tonegrid');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  clearSession(req, res);
  sendJson(res, 200, { ok: true });
};
