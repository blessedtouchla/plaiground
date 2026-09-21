'use strict';

/**
 * Google OAuth for wannaplai.com sign-in / create-account.
 * Server-only env: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
 * Optional GOOGLE_REDIRECT_URI overrides the callback URL.
 */

const crypto = require('crypto');
const { headerValue } = require('./tonegrid');

function sessionSecret() {
  return String(process.env.SESSION_SECRET || '').trim();
}

const LIVE_ORIGIN = 'https://www.wannaplai.com';
const CALLBACK_PATH = '/api/auth/google-callback';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const STATE_TTL_SEC = 10 * 60;
const SCOPE = 'openid email profile';

let fetchImpl = globalThis.fetch.bind(globalThis);

function setFetchForTests(fn) {
  fetchImpl = typeof fn === 'function' ? fn : globalThis.fetch.bind(globalThis);
}

function clientId() {
  return String(process.env.GOOGLE_CLIENT_ID || '').trim();
}

function clientSecret() {
  return String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
}

function isGoogleConfigured() {
  return Boolean(clientId() && clientSecret());
}

function requestHostHeader(req) {
  const forwarded = headerValue(req, 'x-forwarded-host').split(',')[0].trim();
  return forwarded || headerValue(req, 'host');
}

function requestHostname(req) {
  return requestHostHeader(req).split(':')[0].trim().toLowerCase();
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isSecureRequest(req) {
  if (String(process.env.VERCEL || '') === '1') return true;
  const proto = headerValue(req, 'x-forwarded-proto').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

function requestOrigin(req) {
  const host = requestHostHeader(req);
  const hostname = requestHostname(req);
  if (host && isLocalHost(hostname)) {
    const proto = isSecureRequest(req) ? 'https' : 'http';
    return proto + '://' + host;
  }
  return LIVE_ORIGIN;
}

function redirectUri(req) {
  const override = String(process.env.GOOGLE_REDIRECT_URI || '').trim();
  if (override) return override;
  return requestOrigin(req) + CALLBACK_PATH;
}

function safeNext(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return '';
  if (raw.indexOf('//') !== -1 || raw.indexOf('\\') !== -1 || raw.indexOf('..') !== -1) return '';
  const pathOnly = raw.split('?')[0].split('#')[0];
  if (!pathOnly) return '';
  const file = pathOnly.split('/').pop();
  if (file === 'login.html' || file === 'signup.html' || file === 'login' || file === 'signup') return '';
  if (raw.charAt(0) === '/') {
    if (!/^\/[A-Za-z0-9._~/-]*$/.test(pathOnly)) return '';
    return raw.length > 180 ? '' : raw;
  }
  if (!/^[A-Za-z0-9._-]+\.html$/.test(pathOnly)) return '';
  return raw.length > 180 ? '' : raw;
}

function normalizePlan(value) {
  const plan = String(value || '').trim().toLowerCase();
  return plan === 'basic' || plan === 'creator' || plan === 'pro' ? plan : '';
}

function wantsRemember(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

function signState(data) {
  const secret = sessionSecret();
  if (!secret) return '';
  const payload = Buffer.from(JSON.stringify({
    n: crypto.randomBytes(16).toString('base64url'),
    r: data && data.remember ? 1 : 0,
    next: safeNext(data && data.next),
    plan: normalizePlan(data && data.plan),
    e: Math.floor(Date.now() / 1000) + STATE_TTL_SEC,
  }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function verifyState(token) {
  const secret = sessionSecret();
  const raw = String(token || '').trim();
  const dot = raw.lastIndexOf('.');
  if (!secret || dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data.e !== 'number' || data.e < Math.floor(Date.now() / 1000)) return null;
  return {
    remember: data.r === 1,
    next: safeNext(data.next),
    plan: normalizePlan(data.plan),
  };
}

function startUrl(req, options) {
  if (!isGoogleConfigured()) return '';
  const state = signState(options || {});
  if (!state) return '';
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: SCOPE,
    state: state,
    access_type: 'online',
    prompt: 'select_account',
    include_granted_scopes: 'false',
  });
  return AUTH_URL + '?' + params.toString();
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function exchangeCode(code, req) {
  const token = String(code || '').trim();
  if (!token || !isGoogleConfigured()) return null;
  const body = new URLSearchParams({
    code: token,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(req),
    grant_type: 'authorization_code',
  });
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = await readJson(response);
  const access = data && data.access_token ? String(data.access_token).trim() : '';
  if (!response.ok || !access) return null;
  return access;
}

function emailVerified(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

async function fetchGoogleUser(accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) return null;
  const response = await fetchImpl(USERINFO_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer ' + token,
    },
  });
  const data = await readJson(response);
  if (!response.ok || !data) return null;
  const email = String(data.email || '').trim();
  if (!email || !emailVerified(data.email_verified)) return null;
  return {
    email: email,
    artist: String(data.name || data.given_name || '').trim(),
  };
}

function sendRedirect(res, location, status) {
  res.statusCode = status || 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function loginErrorLocation() {
  return '/login.html?google=0';
}

function successLocation(next) {
  return safeNext(next) || '/dashboard.html';
}

module.exports = {
  CALLBACK_PATH,
  LIVE_ORIGIN,
  clientId,
  exchangeCode,
  fetchGoogleUser,
  isGoogleConfigured,
  loginErrorLocation,
  redirectUri,
  requestOrigin,
  safeNext,
  sendRedirect,
  setFetchForTests,
  signState,
  startUrl,
  successLocation,
  verifyState,
  wantsRemember,
};
