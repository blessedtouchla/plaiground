'use strict';

/**
 * GET /api/tonegrid/health
 * Reports whether TONEGRID_API_KEY and TONEGRID_BASE_URL are set.
 * Does not call ToneGrid and never echoes the key.
 */

const { healthPayload, isConfigured, sendJson } = require('../../lib/tonegrid');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const payload = healthPayload();
  if (!isConfigured()) {
    sendJson(res, 503, {
      configured: false,
      sandbox: false,
      error: 'ToneGrid is not configured.',
    });
    return;
  }

  sendJson(res, 200, payload);
};
