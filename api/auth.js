'use strict';

/**
 * GET  /api/auth           → apply schema when DATABASE_URL + SESSION_SECRET are set
 * GET  /api/auth/pixel     → { pixel_id } from META_PIXEL_ID only; empty when unset
 * POST /api/auth/signup    pending user only; no session; tries confirm mail; records signup once
 * POST /api/auth/login     confirmed users only; remember=true → 30-day cookie
 * POST /api/auth/logout
 * POST /api/auth/password  signed-in current + new password; no email token
 * POST /api/auth/delete    signed-in; body.confirm must be DELETE
 * POST /api/auth/confirm   { token } → mark confirmed + attach session
 * GET  /api/auth/mail      → { configured } (does not send)
 * GET  /api/auth/mail?token= → { ok, email } when HMAC verifies
 * POST /api/auth/mail      { email, kind } → confirm, magic, or reset.
 * Reset always sends purpose=reset when the account exists.
 *
 * Public URLs stay the same via vercel.json rewrites. One Hobby function.
 */

const { confirmEmail, createUser, deleteUser, findByEmail, findById, ensureReady, setPassword } = require('../lib/accounts');
const profile = require('../lib/profile');
const {
  attachSession,
  authPayload,
  clearSession,
  emailsEquivalent,
  isConfigured,
  isConfirmed,
  isEmail,
  normalizeEmail,
  notConfigured,
  pendingPayload,
  rejectQueryPassword,
  sessionFromRequest,
  verifyPassword,
} = require('../lib/auth');
const {
  MAIL_NOT_CONFIGURED,
  isMailConfigured,
  normalizePurpose,
  sendAuthEmail,
  sendConfirmEmail,
  sendResetEmail,
  verifyToken,
} = require('../lib/mail');
const { pathnameOf, queryValue } = require('../lib/route');
const { readBody, sendJson } = require('../lib/tonegrid');
const { pixelId } = require('../lib/growth-pixel');
const { recordSignup } = require('../lib/growth-events');

function authAction(req) {
  const path = pathnameOf(req);
  const match = path.match(/^\/api\/auth\/([^/]+)$/);
  if (match) return match[1];
  return queryValue(req, 'action');
}

function wantsRemember(body) {
  if (!body || typeof body !== 'object') return false;
  const value = body.remember;
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

function deleteConfirmed(body) {
  const value = String((body && (body.confirm || body.confirmation)) || '').trim();
  return value.toUpperCase() === 'DELETE';
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

async function pixel(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const id = pixelId();
  sendJson(res, 200, { pixel_id: id });
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
  const username = String((body && body.username) || '').trim();
  const plan = body && body.plan;

  if (!isEmail(email)) {
    sendJson(res, 400, { error: 'A valid email is required.' });
    return;
  }
  if (password.length < 8) {
    sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
    return;
  }

  try {
    const row = await createUser({ email, password, artist, plan, username });
    try {
      await recordSignup(row);
    } catch {
      /* signup event must not fail account create */
    }
    let mail;
    try {
      mail = await sendConfirmEmail({ email: row.email, artist: row.artist_name });
    } catch {
      mail = { mail_sent: false, error: 'Could not send the confirmation email.' };
    }
    const payload = {
      ok: true,
      pending: true,
      confirmed: false,
      email: row.email,
      artist: row.artist_name,
      username: profile.readStored(row).username || '',
      plan: row.plan || null,
      mail_sent: Boolean(mail && mail.mail_sent),
    };
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
    if (err && err.code === 'USERNAME_TAKEN') {
      sendJson(res, 409, { error: err.message, code: 'USERNAME_TAKEN' });
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
  const token = String((body && body.token) || '').trim();
  // Username is a community handle. Sign-in stays email.
  if (token) {
    await loginWithToken(req, res, token);
    return;
  }
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
    if (!isConfirmed(row)) {
      sendJson(res, 403, pendingPayload(row));
      return;
    }
    attachSession(req, res, row.id, { remember: wantsRemember(body) });
    sendJson(res, 200, authPayload(row));
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
}

async function loginWithToken(req, res, token) {
  const verified = verifyToken(token, 'magic');
  if (!verified) {
    sendJson(res, 400, { error: 'Invalid or expired sign-in link.' });
    return;
  }
  try {
    const row = await findByEmail(verified.email);
    if (!row) {
      sendJson(res, 400, { error: 'Invalid or expired sign-in link.' });
      return;
    }
    if (!isConfirmed(row)) {
      sendJson(res, 403, pendingPayload(row));
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

async function changePassword(req, res) {
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

  const current = String((body && (body.current_password || body.currentPassword || body.current)) || '');
  const password = String((body && (body.password || body.new_password || body.newPassword)) || '');
  if (password.length < 8) {
    sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
    return;
  }

  try {
    const row = await findById(session.userId);
    if (!row) {
      sendJson(res, 401, { error: 'Sign in required.' });
      return;
    }
    if (!verifyPassword(current, row.password_hash)) {
      sendJson(res, 401, { error: 'Current password is wrong.' });
      return;
    }
    const next = await setPassword(row.id, password);
    attachSession(req, res, row.id);
    sendJson(res, 200, authPayload(next || row));
  } catch (err) {
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

async function deleteAccount(req, res) {
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

  if (!deleteConfirmed(body)) {
    sendJson(res, 400, { error: 'Type DELETE to confirm.' });
    return;
  }

  try {
    const row = await findById(session.userId);
    if (!row) {
      sendJson(res, 401, { error: 'Sign in required.' });
      return;
    }
    await deleteUser(row.id);
    clearSession(req, res);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    if (err && err.code === 'PROTECTED') {
      sendJson(res, 403, { error: err.message });
      return;
    }
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
}

async function resetPassword(req, res) {
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

  const token = String((body && body.token) || '').trim();
  const password = body && body.password != null ? String(body.password) : '';
  const verified = verifyToken(token, 'reset');
  if (!verified) {
    sendJson(res, 400, { error: 'Invalid or expired reset link.' });
    return;
  }
  if (password.length < 8) {
    sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
    return;
  }

  try {
    const row = await findByEmail(verified.email);
    if (!row) {
      sendJson(res, 400, { error: 'Invalid or expired reset link.' });
      return;
    }
    let next = await setPassword(row.id, password);
    if (!isConfirmed(next || row)) {
      next = (await confirmEmail(row.email)) || next;
    }
    attachSession(req, res, row.id);
    sendJson(res, 200, authPayload(next || row));
  } catch (err) {
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

async function sendAccessEmail(req, email, purpose) {
  if (!isMailConfigured()) {
    return { mail_sent: false, error: MAIL_NOT_CONFIGURED };
  }
  if (!isConfigured()) {
    return { mail_sent: false, error: 'Accounts are not configured.' };
  }
  let row;
  try {
    row = await findByEmail(email);
    if (!row) {
      const session = sessionFromRequest(req);
      if (session) {
        const mine = await findById(session.userId);
        if (mine && emailsEquivalent(mine.email, email)) row = mine;
      }
    }
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      return { mail_sent: false, error: 'Accounts are not configured.' };
    }
    throw err;
  }
  if (!row) {
    return { mail_sent: false, error: 'Could not send the email.' };
  }
  const to = normalizeEmail(row.email) || email;
  if (purpose === 'reset') {
    return sendResetEmail({ email: to, artist: row.artist_name });
  }
  if (!isConfirmed(row)) {
    return sendConfirmEmail({ email: to, artist: row.artist_name });
  }
  return sendAuthEmail({ email: to, artist: row.artist_name, purpose });
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

  const purpose = normalizePurpose(body && (body.kind || body.purpose));
  let result;
  try {
    if (purpose === 'magic' || purpose === 'reset') {
      result = await sendAccessEmail(req, email, purpose);
    } else {
      result = await sendConfirmEmail({
        email,
        artist: String((body && body.artist) || '').trim(),
      });
    }
  } catch {
    result = { mail_sent: false, error: 'Could not send the email.' };
  }

  if (result.mail_sent) {
    sendJson(res, 200, { ok: true, mail_sent: true, kind: result.purpose || purpose });
    return;
  }

  const error = result.error || MAIL_NOT_CONFIGURED;
  const status = error === MAIL_NOT_CONFIGURED ? 503 : 502;
  sendJson(res, status, { ok: false, mail_sent: false, error: error, kind: result.purpose || purpose });
}

async function confirm(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }

  let token = queryValue(req, 'token');
  if (!token && req.method === 'POST') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON.', confirmed: false });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'password') || (body && body.password)) {
      sendJson(res, 400, { error: 'Do not send a password.', confirmed: false });
      return;
    }
    token = String((body && body.token) || '').trim();
  }

  const verified = verifyToken(token, 'confirm');
  if (!verified) {
    sendJson(res, 400, { ok: false, confirmed: false, error: 'Invalid or expired token.' });
    return;
  }

  try {
    const row = await confirmEmail(verified.email);
    if (!row) {
      sendJson(res, 400, { ok: false, confirmed: false, error: 'Invalid or expired token.' });
      return;
    }
    attachSession(req, res, row.id);
    sendJson(res, 200, Object.assign(authPayload(row), { confirmed: true, pending: false }));
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
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
  if (action === 'password') {
    await changePassword(req, res);
    return;
  }
  if (action === 'delete') {
    await deleteAccount(req, res);
    return;
  }
  if (action === 'pixel') {
    await pixel(req, res);
    return;
  }
  if (action === 'mail') {
    await mail(req, res);
    return;
  }
  if (action === 'confirm') {
    await confirm(req, res);
    return;
  }
  if (action === 'reset') {
    await resetPassword(req, res);
    return;
  }
  if (action) {
    sendJson(res, 404, { error: 'Not found.' });
    return;
  }
  await bootstrap(req, res);
};
