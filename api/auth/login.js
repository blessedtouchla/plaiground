'use strict';

/**
 * POST /api/auth/login { email, password }
 */

const { findByEmail } = require('../../lib/accounts');
const {
  attachSession,
  authPayload,
  isConfigured,
  isEmail,
  normalizeEmail,
  notConfigured,
  rejectQueryPassword,
  verifyPassword,
} = require('../../lib/auth');
const { readBody, sendJson } = require('../../lib/tonegrid');

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

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const email = normalizeEmail(body && body.email);
  const password = body && body.password != null ? String(body.password) : '';
  if (!isEmail(email) || !password) {
    sendJson(res, 401, { error: 'Invalid email or password.' });
    return;
  }

  try {
    const row = await findByEmail(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      sendJson(res, 401, { error: 'Invalid email or password.' });
      return;
    }
    attachSession(req, res, row.id);
    sendJson(res, 200, authPayload(row));
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
};
