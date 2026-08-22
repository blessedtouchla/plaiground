'use strict';

/**
 * POST /api/auth/signup { email, password, artist, plan? }
 * Creates a PLAIGROUND user and sets a session cookie.
 * Does not POST the password to ToneGrid.
 */

const { createUser } = require('../../lib/accounts');
const {
  attachSession,
  authPayload,
  isConfigured,
  isEmail,
  normalizeEmail,
  notConfigured,
  rejectQueryPassword,
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
  const artist = String((body && (body.artist || body.artist_name)) || '').trim();
  const plan = body && body.plan;

  if (!isEmail(email)) {
    sendJson(res, 400, { error: 'A valid email is required.' });
    return;
  }
  if (password.length < 8) {
    sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
    return;
  }
  if (!artist) {
    sendJson(res, 400, { error: 'Artist name is required.' });
    return;
  }

  try {
    const row = await createUser({ email, password, artist, plan });
    attachSession(req, res, row.id);
    sendJson(res, 200, authPayload(row));
  } catch (err) {
    if (err && err.code === 'EMAIL_EXISTS') {
      sendJson(res, 409, { error: err.message });
      return;
    }
    if (err && err.code === 'VALIDATION') {
      sendJson(res, 400, { error: err.message });
      return;
    }
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
};
