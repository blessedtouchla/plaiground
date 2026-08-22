'use strict';

/**
 * GET  /api/signup-confirm           → { configured } (does not send)
 * GET  /api/signup-confirm?token=    → { ok, email } when the HMAC token verifies
 * POST /api/signup-confirm           → { ok } after emailing a confirm link
 *
 * Server-only env:
 *   RESEND_API_KEY          (required to send)
 *   CONFIRM_SECRET          (or SIGNUP_CONFIRM_SECRET; HMAC for optional token)
 *   CONFIRM_FROM            (default emailplaiground@gmail.com)
 *
 * Never put these in HTML/JS. No NEXT_PUBLIC_ mail keys.
 */

const crypto = require('crypto');

const RESEND_URL = 'https://api.resend.com/emails';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_ORIGIN = 'https://www.wannaplai.com';
const TOKEN_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_FROM = 'emailplaiground@gmail.com';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body || '{}'));
    } catch {
      return Promise.reject(new Error('Invalid JSON'));
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function resendKey() {
  return String(process.env.RESEND_API_KEY || '').trim();
}

function confirmSecret() {
  return String(process.env.CONFIRM_SECRET || process.env.SIGNUP_CONFIRM_SECRET || '').trim();
}

function fromAddress() {
  return String(process.env.CONFIRM_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM;
}

function isMailConfigured() {
  return Boolean(resendKey());
}

function scrub(text) {
  return String(text || '')
    .replace(/\b(?:re|sk|rk)_[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]')
    .slice(0, 400);
}

function normalizeEmail(value) {
  const email = String(value || '').trim();
  if (!email || !EMAIL_RE.test(email)) return '';
  return email;
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signToken(email) {
  const secret = confirmSecret();
  if (!secret) return '';
  const payload = JSON.stringify({
    email,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', secret).update(body).digest();
  return body + '.' + b64url(sig);
}

function verifyToken(token) {
  const secret = confirmSecret();
  if (!secret) return null;
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const expected = b64url(crypto.createHmac('sha256', secret).update(parts[0]).digest());
  const given = Buffer.from(parts[1]);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  const email = normalizeEmail(payload.email);
  const exp = Number(payload.exp);
  if (!email || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  return { email };
}

function confirmLink(email, token) {
  const url = new URL('/confirmed.html', SITE_ORIGIN);
  url.searchParams.set('email', email);
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

function mailBodies(email, artist, link) {
  const name = String(artist || '').trim();
  const greeting = name ? 'Hi ' + name + ',' : 'Hi,';
  const text = [
    greeting,
    '',
    'Confirm this email for your PLAIGROUND account:',
    link,
    '',
    'This link is good for about 24 hours.',
    '',
    'PLAIGROUND',
  ].join('\n');
  const html = [
    '<p>' + escapeHtml(greeting) + '</p>',
    '<p>Confirm this email for your PLAIGROUND account:</p>',
    '<p><a href="' + escapeHtml(link) + '">' + escapeHtml(link) + '</a></p>',
    '<p>This link is good for about 24 hours.</p>',
  ].join('');
  return { text, html };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resendErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Could not send the confirmation email.';
  }
  const raw =
    (payload.error && typeof payload.error.message === 'string' && payload.error.message) ||
    (typeof payload.error === 'string' && payload.error) ||
    (typeof payload.message === 'string' && payload.message) ||
    '';
  if (/api[\s_-]*key|secret|bearer|authorization/i.test(raw)) {
    return 'Mail provider rejected the request.';
  }
  if (!raw) return 'Could not send the confirmation email.';
  return scrub(raw);
}

async function sendConfirmEmail(req, res) {
  if (!isMailConfigured()) {
    sendJson(res, 503, { error: 'Mail is not configured.' });
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
  if (!email) {
    sendJson(res, 400, { error: 'A valid email is required.' });
    return;
  }

  const artist = String((body && body.artist) || '').trim().slice(0, 120);
  if (Object.prototype.hasOwnProperty.call(body || {}, 'password') || body.password) {
    sendJson(res, 400, { error: 'Do not send a password.' });
    return;
  }

  const token = signToken(email);
  const link = confirmLink(email, token);
  const mail = mailBodies(email, artist, link);
  const from = fromAddress();

  let response;
  try {
    response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + resendKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PLAIGROUND <' + from + '>',
        to: [email],
        subject: 'Confirm your PLAIGROUND email',
        html: mail.html,
        text: mail.text,
      }),
    });
  } catch {
    sendJson(res, 502, { error: 'Could not reach the mail provider.' });
    return;
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    sendJson(res, response.status >= 400 && response.status < 600 ? response.status : 502, {
      error: resendErrorMessage(data),
    });
    return;
  }

  sendJson(res, 200, { ok: true });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const token = String((req.query && req.query.token) || '').trim();
    if (!token) {
      const url = req.url ? String(req.url) : '';
      const q = url.includes('?') ? new URL(url, SITE_ORIGIN).searchParams.get('token') : '';
      if (q) {
        const verified = verifyToken(q);
        if (!verified) {
          sendJson(res, 400, { ok: false, error: 'Invalid or expired token.' });
          return;
        }
        sendJson(res, 200, { ok: true, email: verified.email });
        return;
      }
      sendJson(res, 200, { configured: isMailConfigured() });
      return;
    }
    const verified = verifyToken(token);
    if (!verified) {
      sendJson(res, 400, { ok: false, error: 'Invalid or expired token.' });
      return;
    }
    sendJson(res, 200, { ok: true, email: verified.email });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await sendConfirmEmail(req, res);
};

module.exports._test = {
  signToken,
  verifyToken,
  confirmLink,
  normalizeEmail,
  isMailConfigured,
};
