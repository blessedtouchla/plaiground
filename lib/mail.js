'use strict';

/**
 * Auth mail via Resend: signup confirm, magic sign-in, password reset.
 * Server-only env: RESEND_API_KEY, CONFIRM_SECRET (or SIGNUP_CONFIRM_SECRET), CONFIRM_FROM.
 * Never put these in HTML/JS. No NEXT_PUBLIC_ mail keys. From stays PLAIGROUND.
 */

const crypto = require('crypto');

const RESEND_URL = 'https://api.resend.com/emails';
const SITE_ORIGIN = 'https://www.wannaplai.com';
const TOKEN_TTL_SECONDS = 24 * 60 * 60;
const AUTH_TOKEN_TTL_SECONDS = 60 * 60;
const DEFAULT_FROM = 'PLAIGROUND <confirm@wannaplai.com>';
const MAIL_NOT_CONFIGURED = 'Mail is not configured.';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PURPOSES = { confirm: true, magic: true, reset: true };

function resendKey() {
  return String(process.env.RESEND_API_KEY || '').trim();
}

function confirmSecret() {
  return String(
    process.env.CONFIRM_SECRET || process.env.SIGNUP_CONFIRM_SECRET || process.env.SESSION_SECRET || ''
  ).trim();
}

function fromAddress() {
  const raw = String(process.env.CONFIRM_FROM || '').trim();
  if (!raw) return DEFAULT_FROM;
  if (raw.indexOf('<') !== -1 && raw.indexOf('>') !== -1) return raw;
  return 'PLAIGROUND <' + raw + '>';
}

function isMailConfigured() {
  return Boolean(resendKey());
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return '';
  return email;
}

function scrub(text) {
  return String(text || '')
    .replace(/\b(?:re|sk|rk)_[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]')
    .slice(0, 400);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function normalizePurpose(value) {
  const purpose = String(value || '').trim().toLowerCase();
  return PURPOSES[purpose] ? purpose : 'confirm';
}

function signToken(email, purpose) {
  const secret = confirmSecret();
  if (!secret) return '';
  const kind = normalizePurpose(purpose);
  const ttl = kind === 'confirm' ? TOKEN_TTL_SECONDS : AUTH_TOKEN_TTL_SECONDS;
  const payload = JSON.stringify({
    email,
    exp: Math.floor(Date.now() / 1000) + ttl,
    p: kind,
  });
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', secret).update(body).digest();
  return body + '.' + b64url(sig);
}

function verifyToken(token, purpose) {
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
  const got = payload.p ? normalizePurpose(payload.p) : 'confirm';
  const wantPurpose = purpose ? normalizePurpose(purpose) : got;
  if (got !== wantPurpose) return null;
  return { email, purpose: got, exp };
}

function confirmLink(email) {
  return authLink(email, 'confirm');
}

function authLink(email, purpose) {
  const kind = normalizePurpose(purpose);
  const path = kind === 'magic' ? '/magic.html' : kind === 'reset' ? '/forgot.html' : '/confirmed.html';
  const url = new URL(path, SITE_ORIGIN);
  url.searchParams.set('email', email);
  const token = signToken(email, kind);
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

function mailCopy(purpose) {
  if (purpose === 'magic') {
    return {
      subject: 'Your PLAIGROUND sign-in link',
      line: 'Sign in to PLAIGROUND with this one-time link:',
      ttl: 'This link is good for about one hour. If it is not in the inbox, check Spam and Promotions.',
    };
  }
  if (purpose === 'reset') {
    return {
      subject: 'Reset your PLAIGROUND password',
      line: 'Reset the password on your PLAIGROUND account with this link:',
      ttl: 'This link is good for about one hour. If it is not in the inbox, check Spam and Promotions.',
    };
  }
  return {
    subject: 'Confirm your PLAIGROUND email',
    line: 'Confirm this email for your PLAIGROUND account:',
    ttl: 'This link is good for about 24 hours.',
  };
}

function mailBodies(email, artist, link, purpose) {
  const name = String(artist || '').trim();
  const greeting = name ? 'Hi ' + name + ',' : 'Hi,';
  const copy = mailCopy(normalizePurpose(purpose));
  const text = [
    greeting,
    '',
    copy.line,
    link,
    '',
    copy.ttl,
    '',
    'PLAIGROUND',
  ].join('\n');
  const html = [
    '<p>' + escapeHtml(greeting) + '</p>',
    '<p>' + escapeHtml(copy.line) + '</p>',
    '<p><a href="' + escapeHtml(link) + '">' + escapeHtml(link) + '</a></p>',
    '<p>' + escapeHtml(copy.ttl) + '</p>',
  ].join('');
  return { text, html, subject: copy.subject };
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

async function sendAuthEmail(input) {
  const email = normalizeEmail(input && input.email);
  if (!email) {
    return { mail_sent: false, error: 'A valid email is required.' };
  }
  if (!isMailConfigured()) {
    return { mail_sent: false, error: MAIL_NOT_CONFIGURED };
  }

  const purpose = normalizePurpose(input && (input.purpose || input.kind));
  const artist = String((input && input.artist) || '').trim().slice(0, 120);
  const link = authLink(email, purpose);
  const mail = mailBodies(email, artist, link, purpose);
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
        from,
        to: [email],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
  } catch {
    return { mail_sent: false, error: 'Could not reach the mail provider.' };
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    return { mail_sent: false, error: resendErrorMessage(data) };
  }

  return { mail_sent: true, email, link, purpose, from };
}

function sendConfirmEmail(input) {
  return sendAuthEmail(Object.assign({}, input, { purpose: 'confirm' }));
}

function sendMagicEmail(input) {
  return sendAuthEmail(Object.assign({}, input, { purpose: 'magic' }));
}

function sendResetEmail(input) {
  return sendAuthEmail(Object.assign({}, input, { purpose: 'reset' }));
}

module.exports = {
  AUTH_TOKEN_TTL_SECONDS,
  DEFAULT_FROM,
  MAIL_NOT_CONFIGURED,
  authLink,
  confirmLink,
  confirmSecret,
  fromAddress,
  isMailConfigured,
  normalizeEmail,
  normalizePurpose,
  sendAuthEmail,
  sendConfirmEmail,
  sendMagicEmail,
  sendResetEmail,
  signToken,
  verifyToken,
};
