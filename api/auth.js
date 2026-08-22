'use strict';

/**
 * GET  /api/auth           → apply schema when DATABASE_URL + SESSION_SECRET are set
 * POST /api/auth/signup    { email, password, artist, plan? } → also tries confirm mail
 * POST /api/auth/login     { email, password }
 * POST /api/auth/logout
 * GET  /api/auth/mail      → { configured } (does not send)
 * GET  /api/auth/mail?token= → { ok, email } when HMAC verifies
 * POST /api/auth/mail      { email, artist } → resend confirm mail
 *
 * Public URLs stay the same via vercel.json rewrites. One Hobby function.
 */

const { createUser, findByEmail, ensureReady } = require('../lib/accounts');
const {
  attachSession,
  authPayload,
  clearSession,
  isConfigured,
  isEmail,
  normalizeEmail,
  notConfigured,
  rejectQueryPassword,
  verifyPassword,
} = require('../lib/auth');
const {
  MAIL_NOT_CONFIGURED,
  isMailConfigured,
  sendConfirmEmail,
  verifyToken,
} = require('../lib/mail');
const { pathnameOf, queryValue } = require('../lib/route');
const { readBody, sendJson } = require('../lib/tonegrid');

function authAction(req) {
  const path = pathnameOf(req);
  const match = path.match(/^\/api\/auth\/([^/]+)$/);
  if (match) return match[1];
  return queryValue(req, 'action');
}

async function bootstrap(req, res) {
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
}

async function signup(req, res) {
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
    let mail;
    try {
      mail = await sendConfirmEmail({ email: row.email, artist: row.artist_name });
    } catch {
      mail = { mail_sent: false, error: 'Could not send the confirmation email.' };
    }
    const payload = Object.assign(authPayload(row), {
      mail_sent: Boolean(mail && mail.mail_sent),
    });
    if (!payload.mail_sent) {
      payload.error = (mail && mail.error) || MAIL_NOT_CONFIGURED;
    }
    sendJson(res, 200, payload);
  } catch (err) {
    if (err && err.code === 'EMAIL_EXISTS') {
      sendJson(res, 409, {
        error: err.message,
        code: 'EMAIL_EXISTS',
        login: '/login.html',
      });
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
}

async function login(req, res) {
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
}

async function mail(req, res) {
  if (req.method === 'GET') {
    const token = queryValue(req, 'token');
    if (token) {
      const verified = verifyToken(token);
      if (!verified) {
        sendJson(res, 400, { ok: false, mail_sent: false, error: 'Invalid or expired token.' });
        return;
      }
      sendJson(res, 200, { ok: true, email: verified.email });
      return;
    }
    sendJson(res, 200, { configured: isMailConfigured() });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { mail_sent: false, error: 'Invalid JSON.' });
    return;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'password') || (body && body.password)) {
    sendJson(res, 400, { mail_sent: false, error: 'Do not send a password.' });
    return;
  }

  const email = normalizeEmail(body && body.email);
  if (!isEmail(email)) {
    sendJson(res, 400, { mail_sent: false, error: 'A valid email is required.' });
    return;
  }

  let result;
  try {
    result = await sendConfirmEmail({
      email,
      artist: String((body && body.artist) || '').trim(),
    });
  } catch {
    result = { mail_sent: false, error: 'Could not send the confirmation email.' };
  }

  if (result.mail_sent) {
    sendJson(res, 200, { ok: true, mail_sent: true });
    return;
  }

  const error = result.error || MAIL_NOT_CONFIGURED;
  const status = error === MAIL_NOT_CONFIGURED ? 503 : 502;
  sendJson(res, status, { ok: false, mail_sent: false, error });
}

async function logout(req, res) {
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
}

module.exports = async function handler(req, res) {
  const action = authAction(req);
  if (action === 'signup') {
    await signup(req, res);
    return;
  }
  if (action === 'login') {
    await login(req, res);
    return;
  }
  if (action === 'logout') {
    await logout(req, res);
    return;
  }
  if (action === 'mail') {
    await mail(req, res);
    return;
  }
  if (action) {
    sendJson(res, 404, { error: 'Not found.' });
    return;
  }
  await bootstrap(req, res);
};
