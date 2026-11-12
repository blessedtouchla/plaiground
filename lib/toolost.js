'use strict';

/**
 * Hidden PLAIGROUND label OAuth for the TooLost sandbox.
 * Hobby rewrite onto api/me.js. No public nav link.
 *
 *   GET  /api/toolost/start
 *   GET  /api/toolost/callback
 *   GET  /api/toolost/connected
 *   POST /api/toolost/refresh
 *
 * Redirect URI, registered and not editable in the sandbox app:
 *   https://www.wannaplai.com/api/toolost/callback
 *
 * Env names only. Values stay on the host:
 *   TOOLOST_CLIENT_ID
 *   TOOLOST_CLIENT_SECRET
 *   TOOLOST_REDIRECT_URI   (optional; defaults to the registered URI)
 *   DATABASE_URL           (existing account database; ciphertext only)
 *   SESSION_SECRET         (state cookie and token encryption)
 *
 * Authorize: https://sandbox.toolost.com/oauth/authorize
 * Token:     https://sandbox.toolost.com/oauth/token
 * API base:  https://api-sandbox.toolost.com/v1
 * Authorization Code + PKCE S256. This route does not use client_credentials.
 */

const crypto = require('crypto');
const accounts = require('./accounts');
const auth = require('./auth');
const store = require('./toolost-store');
const { pathnameOf, queryValue } = require('./route');

const STATE_COOKIE = 'plaiground_toolost_state';
const HOLD_COOKIE = 'plaiground_toolost_hold';
const STATE_TTL_SEC = 10 * 60;
const HOLD_TTL_SEC = 10 * 60;
const REDIRECT_DEFAULT = 'https://www.wannaplai.com/api/toolost/callback';
const AUTHORIZE_URL = 'https://sandbox.toolost.com/oauth/authorize';
const TOKEN_URL = 'https://sandbox.toolost.com/oauth/token';
const CREDENTIALS_COPY = 'TooLost sandbox credentials are not configured yet.';
const SCOPES = [
  'read:catalog',
  'read:analytics',
  'read:profile',
  'read:releases',
  'read:preferences',
  'read:earnings',
  'read:sales',
  'write:releases',
  'write:preferences',
].join(' ');

const OAUTH_ERRORS = {
  access_denied: 'TooLost did not authorize the label connection.',
  invalid_request: 'TooLost rejected the authorize request.',
  invalid_scope: 'TooLost rejected the requested scopes.',
  server_error: 'TooLost could not finish the authorize request.',
  temporarily_unavailable: 'TooLost is temporarily unavailable.',
};

const TOKEN_ERRORS = {
  invalid_grant: 'TooLost refused the authorization code.',
  invalid_client: 'TooLost refused the sandbox client.',
  invalid_request: 'TooLost refused the token request.',
  unauthorized_client: 'TooLost refused the sandbox client.',
};

let fetchImpl = null;
let nowMs = function () { return Date.now(); };

function sessionSecret() {
  return String(process.env.SESSION_SECRET || '').trim();
}

function clientId() {
  return String(process.env.TOOLOST_CLIENT_ID || '').trim();
}

function clientSecret() {
  return String(process.env.TOOLOST_CLIENT_SECRET || '').trim();
}

function redirectUri() {
  const set = String(process.env.TOOLOST_REDIRECT_URI || '').trim();
  return set || REDIRECT_DEFAULT;
}

function redirectUriOk() {
  try {
    const url = new URL(redirectUri());
    return url.protocol === 'https:' && url.pathname === '/api/toolost/callback' && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function nowSec() {
  return Math.floor(nowMs() / 1000);
}

function readiness() {
  if (!clientId() || !clientSecret()) return { ok: false, message: CREDENTIALS_COPY };
  if (!sessionSecret()) return { ok: false, message: 'The server cannot sign this connection yet.' };
  if (!redirectUriOk()) return { ok: false, message: 'The TooLost redirect URI is not an https callback URL.' };
  const storeReady = store.status();
  if (!storeReady.ok) return storeReady;
  return { ok: true, message: '' };
}

function headerValue(req, name) {
  if (!req || !req.headers) return '';
  const target = String(name || '').toLowerCase();
  const headers = req.headers;
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i].toLowerCase() === target) {
      const value = headers[keys[i]];
      return String(Array.isArray(value) ? value[0] : value || '').trim();
    }
  }
  return '';
}

function isSecureRequest(req) {
  if (String(process.env.VERCEL || '') === '1') return true;
  const proto = headerValue(req, 'x-forwarded-proto').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

function parseCookies(req) {
  const header = headerValue(req, 'cookie');
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  });
  return out;
}

function signPayload(data) {
  const payload = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function verifyPayload(token) {
  const raw = String(token || '').trim();
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!payload || !sig || !sessionSecret()) return null;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function cookieExpiresAt(maxAge) {
  return new Date(nowMs() + Number(maxAge || 0) * 1000).toUTCString();
}

function cookieHeader(name, value, req, maxAge) {
  const parts = [
    name + '=' + encodeURIComponent(value || ''),
    'Path=/api/toolost',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + String(maxAge),
    'Expires=' + cookieExpiresAt(maxAge),
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  return parts.join('; ');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function actionOf(req) {
  const path = pathnameOf(req);
  if (path === '/api/toolost/callback') return 'callback';
  if (path === '/api/toolost/start') return 'start';
  if (path === '/api/toolost/connected') return 'connected';
  if (path === '/api/toolost/refresh') return 'refresh';
  const action = queryValue(req, 'action');
  if (action === 'toolost-callback') return 'callback';
  if (action === 'toolost-start') return 'start';
  if (action === 'toolost-connected') return 'connected';
  if (action === 'toolost-refresh') return 'refresh';
  return '';
}

function sendPage(res, status, paragraphs, link) {
  const lines = (Array.isArray(paragraphs) ? paragraphs : [paragraphs]).filter(Boolean);
  const body = lines.map((line) => '<p>' + escapeHtml(line) + '</p>').join('');
  const extra = link
    ? '<p><a href="' + escapeHtml(link.href) + '">' + escapeHtml(link.label) + '</a></p>'
    : '';
  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow">',
    '<meta name="referrer" content="no-referrer">',
    '<title>PLAIGROUND label connection</title>',
    '</head>',
    '<body>',
    '<h1>PLAIGROUND label connection</h1>',
    body,
    extra,
    '</body>',
    '</html>',
  ].join('');
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(html);
}

function authorizeUrl(state, challenge) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId());
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

function readStateCookie(req) {
  const data = verifyPayload(parseCookies(req)[STATE_COOKIE]);
  if (!data || data.k !== 'state') return null;
  if (typeof data.s !== 'string' || typeof data.v !== 'string' || typeof data.e !== 'number') return null;
  if (data.n !== 'sandbox') return null;
  return data;
}

function readHoldCookie(req) {
  const data = verifyPayload(parseCookies(req)[HOLD_COOKIE]);
  if (!data || data.k !== 'hold') return null;
  if (typeof data.e !== 'number' || data.e < nowSec()) return null;
  if (data.n !== 'sandbox') return null;
  return data;
}

function safeScope(value) {
  const parts = String(value || '').split(/\s+/).filter((part) => /^(read|write):[a-z]+$/.test(part));
  return parts.length ? parts.join(' ') : SCOPES;
}

function tokenRecord(token, previous) {
  const access = String((token && token.access_token) || '');
  if (!access) return null;
  const expiresIn = Number(token.expires_in);
  const prior = previous && typeof previous === 'object' ? previous : {};
  return {
    env: 'sandbox',
    access_token: access,
    refresh_token: token.refresh_token ? String(token.refresh_token) : String(prior.refresh_token || ''),
    token_type: token.token_type ? String(token.token_type).slice(0, 40) : 'Bearer',
    scope: safeScope(token.scope || prior.scope),
    expires_at: expiresIn > 0 ? new Date(nowMs() + expiresIn * 1000).toISOString() : String(prior.expires_at || ''),
    updated_at: new Date(nowMs()).toISOString(),
  };
}

async function rememberToken(token, previous) {
  const record = tokenRecord(token, previous);
  if (!record) return false;
  return store.save(record);
}

function currentFetch() {
  if (typeof fetchImpl === 'function') return fetchImpl;
  if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis);
  return null;
}

async function postToken(fields) {
  const fetcher = currentFetch();
  if (!fetcher) return { ok: false, message: 'The TooLost token endpoint did not answer.' };
  const body = new URLSearchParams();
  Object.keys(fields).forEach((name) => {
    if (fields[name]) body.set(name, fields[name]);
  });
  const timeout = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(10000)
    : undefined;
  const response = await fetcher(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    signal: timeout,
  });
  const text = await response.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (!response.ok || !data || !data.access_token) {
    const known = data && TOKEN_ERRORS[data.error];
    return { ok: false, message: known || 'TooLost refused the token request.' };
  }
  return {
    ok: true,
    token: {
      access_token: String(data.access_token),
      refresh_token: data.refresh_token ? String(data.refresh_token) : '',
      token_type: data.token_type ? String(data.token_type) : 'Bearer',
      scope: data.scope ? String(data.scope) : '',
      expires_in: Number(data.expires_in) || 0,
    },
  };
}

async function requireOwner(req, res) {
  if (!auth.isConfigured()) {
    sendPage(res, 503, 'The owner sign-in is not configured yet.');
    return null;
  }
  try {
    const session = auth.sessionFromRequest(req);
    if (!session) {
      sendPage(res, 401, 'Sign in with the PLAIGROUND label owner account first.');
      return null;
    }
    const row = await accounts.findById(session.userId);
    if (!row || !auth.isConfirmed(row)) {
      sendPage(res, 401, 'Sign in with the PLAIGROUND label owner account first.');
      return null;
    }
    if (!auth.hasStaffProOverride(row.email)) {
      sendPage(res, 403, 'This page connects the PLAIGROUND label account.');
      return null;
    }
    return row;
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      sendPage(res, 503, 'The owner sign-in is not configured yet.');
      return null;
    }
    throw err;
  }
}

async function handleStart(req, res) {
  const ready = readiness();
  if (!ready.ok) {
    sendPage(res, 503, ready.message);
    return;
  }
  const owner = await requireOwner(req, res);
  if (!owner) return;
  const state = crypto.randomBytes(32).toString('base64url');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const location = authorizeUrl(state, challenge);
  if (location.indexOf(AUTHORIZE_URL + '?') !== 0) {
    sendPage(res, 503, 'The sandbox authorize URL is not available.');
    return;
  }
  const sealed = signPayload({ k: 'state', s: state, v: verifier, e: nowSec() + STATE_TTL_SEC, n: 'sandbox' });
  res.setHeader('Set-Cookie', cookieHeader(STATE_COOKIE, sealed, req, STATE_TTL_SEC));
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end('');
}

async function handleCallback(req, res) {
  const ready = readiness();
  if (!ready.ok) {
    sendPage(res, 503, ready.message);
    return;
  }
  const oauthError = queryValue(req, 'error');
  if (oauthError) {
    sendPage(res, 400, OAUTH_ERRORS[oauthError] || 'TooLost did not authorize the label connection.');
    return;
  }
  const code = queryValue(req, 'code');
  const state = queryValue(req, 'state');
  if (!code || !state || code.length > 512 || state.length > 200) {
    sendPage(res, 400, 'The sandbox connection did not include a usable code.');
    return;
  }
  const pending = readStateCookie(req);
  const fresh = pending && pending.e >= nowSec() && pending.n === 'sandbox';
  if (!fresh || !safeEqual(pending.s, state)) {
    res.setHeader('Set-Cookie', cookieHeader(STATE_COOKIE, '', req, 0));
    sendPage(res, 400, 'The sandbox connection state did not match. Start it again from the label page.');
    return;
  }
  const owner = await requireOwner(req, res);
  if (!owner) return;
  let exchanged;
  try {
    exchanged = await postToken({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri(),
      client_id: clientId(),
      client_secret: clientSecret(),
      code_verifier: pending.v,
    });
  } catch {
    res.setHeader('Set-Cookie', cookieHeader(STATE_COOKIE, '', req, 0));
    sendPage(res, 502, 'The TooLost token endpoint did not answer.');
    return;
  }
  if (!exchanged.ok) {
    res.setHeader('Set-Cookie', cookieHeader(STATE_COOKIE, '', req, 0));
    sendPage(res, 502, exchanged.message);
    return;
  }
  const kept = await rememberToken(exchanged.token);
  if (!kept) {
    res.setHeader('Set-Cookie', cookieHeader(STATE_COOKIE, '', req, 0));
    sendPage(res, 503, store.STORE_COPY);
    return;
  }
  const saved = store.publicView(await store.read());
  const hold = signPayload({
    k: 'hold',
    n: 'sandbox',
    r: saved.has_refresh ? 1 : 0,
    x: saved.expires_at || '',
    p: saved.scope || '',
    e: nowSec() + HOLD_TTL_SEC,
  });
  res.setHeader('Set-Cookie', [
    cookieHeader(STATE_COOKIE, '', req, 0),
    cookieHeader(HOLD_COOKIE, hold, req, HOLD_TTL_SEC),
  ]);
  res.statusCode = 302;
  res.setHeader('Location', '/api/toolost/connected');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end('');
}

async function handleConnected(req, res) {
  const owner = await requireOwner(req, res);
  if (!owner) return;
  const status = store.publicView(await store.read());
  const hold = readHoldCookie(req);
  const lines = [];
  if (status.connected) {
    lines.push('TooLost sandbox is connected for the PLAIGROUND label account.');
    lines.push('The access token stays on this server.');
    if (status.has_refresh) lines.push('A refresh token is stored on this server.');
    if (status.expires_at) lines.push('Access expires at ' + status.expires_at + '.');
    if (status.scope) lines.push('Scopes: ' + status.scope);
  } else if (hold) {
    lines.push('TooLost sandbox accepted the PLAIGROUND label connection.');
    lines.push('The access token stayed on the server that received the callback.');
  } else {
    lines.push('The PLAIGROUND label account has no TooLost connection stored.');
  }
  const ready = readiness();
  if (!ready.ok) lines.push(ready.message);
  sendPage(res, ready.ok ? 200 : 503, lines, ready.ok ? { href: '/api/toolost/start', label: 'Start the label connection' } : null);
}

async function handleRefresh(req, res) {
  const ready = readiness();
  if (!ready.ok) {
    sendPage(res, 503, ready.message);
    return;
  }
  const owner = await requireOwner(req, res);
  if (!owner) return;
  const current = await store.read();
  if (!current || !current.refresh_token || current.env !== 'sandbox') {
    sendPage(res, 409, 'No sandbox refresh token is stored.');
    return;
  }
  let exchanged;
  try {
    exchanged = await postToken({
      grant_type: 'refresh_token',
      refresh_token: current.refresh_token,
      client_id: clientId(),
      client_secret: clientSecret(),
    });
  } catch {
    sendPage(res, 502, 'The TooLost token endpoint did not answer.');
    return;
  }
  if (!exchanged.ok) {
    sendPage(res, 502, exchanged.message);
    return;
  }
  const rotated = Boolean(exchanged.token.refresh_token);
  const kept = await rememberToken(exchanged.token, current);
  if (!kept) {
    sendPage(res, 503, store.STORE_COPY);
    return;
  }
  sendPage(res, 200, rotated
    ? 'The sandbox refresh token was rotated and stored.'
    : 'The sandbox access token was refreshed and stored.');
}

async function handle(req, res) {
  try {
    const action = actionOf(req);
    if (!action) {
      sendPage(res, 404, 'Not found.');
      return;
    }
    if (action === 'refresh') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendPage(res, 405, 'Use POST.');
        return;
      }
      await handleRefresh(req, res);
      return;
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      sendPage(res, 405, 'Use GET.');
      return;
    }
    if (action === 'callback') {
      await handleCallback(req, res);
      return;
    }
    if (action === 'start') {
      await handleStart(req, res);
      return;
    }
    await handleConnected(req, res);
  } catch {
    if (!res.headersSent && !res.writableEnded) {
      sendPage(res, 500, 'The label connection did not finish.');
    }
  }
}

function resetForTests() {
  fetchImpl = null;
  nowMs = function () { return Date.now(); };
  store.resetForTests();
}

function setFetchForTests(fn) {
  fetchImpl = fn;
}

function setNowForTests(fn) {
  nowMs = typeof fn === 'function' ? fn : function () { return Date.now(); };
}

function useMemoryStoreForTests() {
  return store.useMemoryStoreForTests();
}

async function labelTokenForTests() {
  return store.read();
}

module.exports = {
  AUTHORIZE_URL,
  CREDENTIALS_COPY,
  HOLD_COOKIE,
  REDIRECT_DEFAULT,
  SCOPES,
  STATE_COOKIE,
  TOKEN_URL,
  actionOf,
  handle,
  labelTokenForTests,
  readiness,
  redirectUri,
  resetForTests,
  setFetchForTests,
  setNowForTests,
  useMemoryStoreForTests,
};
