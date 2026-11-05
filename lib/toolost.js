'use strict';

/**
 * PLAIGROUND label-account OAuth for TooLost. Authorization Code only.
 * One label connection. No artist login.
 *
 * Public URLs, via vercel.json rewrites onto api/me.js (Hobby function cap):
 *   GET /api/toolost/start
 *   GET /api/toolost/callback
 *   GET /api/toolost/connected
 *
 * Registered redirect URI:
 *   https://www.wannaplai.com/api/toolost/callback
 *
 * Server env (names only; never commit values):
 *   TOOLOST_CLIENT_ID
 *   TOOLOST_CLIENT_SECRET
 *   TOOLOST_REDIRECT_URI   (defaults to the registered URI)
 *   TOOLOST_ENV            sandbox (default) | production
 *
 * State and PKCE verifier live in a short-lived HttpOnly cookie signed with
 * SESSION_SECRET. Access and refresh tokens stay in this server process.
 * They are never written to the account database, the browser URL, or HTML.
 */

const crypto = require('crypto');
const accounts = require('./accounts');
const auth = require('./auth');
const { pathnameOf, queryValue } = require('./route');

const STATE_COOKIE = 'plaiground_toolost_state';
const HOLD_COOKIE = 'plaiground_toolost_hold';
const STATE_TTL_SEC = 10 * 60;
const HOLD_TTL_SEC = 10 * 60;
const REDIRECT_DEFAULT = 'https://www.wannaplai.com/api/toolost/callback';
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

const HOSTS = {
  sandbox: {
    authorize: 'https://sandbox.toolost.com/oauth/authorize',
    token: 'https://sandbox.toolost.com/oauth/token',
    api: 'https://api-sandbox.toolost.com/v1',
  },
  production: {
    authorize: 'https://toolost.com/oauth/authorize',
    token: 'https://toolost.com/oauth/token',
    api: 'https://api.toolost.com/v1',
  },
};

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

let memoryRecord = null;
let fetchImpl = null;

function sessionSecret() {
  return String(process.env.SESSION_SECRET || '').trim();
}

function clientId() {
  return String(process.env.TOOLOST_CLIENT_ID || '').trim();
}

function clientSecret() {
  return String(process.env.TOOLOST_CLIENT_SECRET || '').trim();
}

function envName() {
  return String(process.env.TOOLOST_ENV || '').trim().toLowerCase() === 'production'
    ? 'production'
    : 'sandbox';
}

function endpoints() {
  return HOSTS[envName()];
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

function credentialsReady() {
  return Boolean(clientId() && clientSecret());
}

function readiness() {
  if (!credentialsReady()) return { ok: false, message: CREDENTIALS_COPY };
  if (!sessionSecret()) return { ok: false, message: 'The server cannot sign this connection yet.' };
  if (!redirectUriOk()) return { ok: false, message: 'The TooLost redirect URI is not an https callback URL.' };
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
  return new Date(Date.now() + Number(maxAge || 0) * 1000).toUTCString();
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
  const action = queryValue(req, 'action');
  if (action === 'toolost-callback') return 'callback';
  if (action === 'toolost-start') return 'start';
  if (action === 'toolost-connected') return 'connected';
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
  const url = new URL(endpoints().authorize);
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
  if (data.n !== 'sandbox' && data.n !== 'production') return null;
  return data;
}

function readHoldCookie(req) {
  const data = verifyPayload(parseCookies(req)[HOLD_COOKIE]);
  if (!data || data.k !== 'hold') return null;
  if (typeof data.e !== 'number' || data.e < Math.floor(Date.now() / 1000)) return null;
  if (data.n !== 'sandbox' && data.n !== 'production') return null;
  return data;
}

function labelStatus() {
  if (!memoryRecord || !memoryRecord.access_token) {
    return { connected: false, env: envName() };
  }
  return {
    connected: true,
    env: memoryRecord.env,
    scope: memoryRecord.scope,
    expires_at: memoryRecord.expires_at,
    has_refresh: Boolean(memoryRecord.refresh_token),
    updated_at: memoryRecord.updated_at,
  };
}

function safeScope(value) {
  const parts = String(value || '').split(/\s+/).filter((part) => /^(read|write):[a-z]+$/.test(part));
  return parts.length ? parts.join(' ') : SCOPES;
}

function rememberToken(token) {
  const access = String((token && token.access_token) || '');
  if (!access) return;
  const expiresIn = Number(token.expires_in);
  memoryRecord = {
    env: envName(),
    access_token: access,
    refresh_token: token.refresh_token ? String(token.refresh_token) : '',
    token_type: token.token_type ? String(token.token_type).slice(0, 40) : 'Bearer',
    scope: safeScope(token.scope),
    expires_at: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : '',
    updated_at: new Date().toISOString(),
  };
}

function currentFetch() {
  if (typeof fetchImpl === 'function') return fetchImpl;
  if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis);
  return null;
}

async function exchangeCode(code, verifier) {
  const fetcher = currentFetch();
  if (!fetcher) {
    return { ok: false, message: 'The TooLost token endpoint did not answer.' };
  }
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('redirect_uri', redirectUri());
  body.set('client_id', clientId());
  body.set('client_secret', clientSecret());
  if (verifier) body.set('code_verifier', verifier);
  const timeout = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(10000)
    : undefined;
  const response = await fetcher(endpoints().token, {
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
      scope: data.scope ? String(data.scope) : SCOPES,
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

function startLink() {
  return { href: '/api/toolost/start', label: 'Start the label connection' };
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
  const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SEC;
  const sealed = signPayload({ k: 'state', s: state, v: verifier, e: exp, n: envName() });
  res.setHeader('Set-Cookie', cookieHeader(STATE_COOKIE, sealed, req, STATE_TTL_SEC));
  res.statusCode = 302;
  res.setHeader('Location', authorizeUrl(state, challenge));
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
  const fresh = pending && pending.e >= Math.floor(Date.now() / 1000) && pending.n === envName();
  if (!fresh || !safeEqual(pending.s, state)) {
    res.setHeader('Set-Cookie', cookieHeader(STATE_COOKIE, '', req, 0));
    sendPage(res, 400, 'The sandbox connection state did not match. Start it again from the label page.');
    return;
  }
  const owner = await requireOwner(req, res);
  if (!owner) return;
  let exchanged;
  try {
    exchanged = await exchangeCode(code, pending.v);
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
  rememberToken(exchanged.token);
  const saved = labelStatus();
  const hold = signPayload({
    k: 'hold',
    n: saved.env,
    r: saved.has_refresh ? 1 : 0,
    x: saved.expires_at || '',
    p: saved.scope || '',
    e: Math.floor(Date.now() / 1000) + HOLD_TTL_SEC,
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
  const status = labelStatus();
  const hold = readHoldCookie(req);
  const lines = [];
  if (status.connected) {
    lines.push('TooLost ' + status.env + ' is connected for the PLAIGROUND label account.');
    lines.push('The access token stays on this server.');
    if (status.has_refresh) lines.push('A refresh token is stored on this server.');
    if (status.expires_at) lines.push('Access expires at ' + status.expires_at + '.');
    if (status.scope) lines.push('Scopes: ' + status.scope);
  } else if (hold) {
    lines.push('TooLost ' + hold.n + ' accepted the PLAIGROUND label connection.');
    lines.push('The access token stayed on the server that received the callback.');
    if (hold.r === 1) lines.push('A refresh token was stored on that server.');
    if (hold.x) lines.push('Access expires at ' + hold.x + '.');
    if (hold.p) lines.push('Scopes: ' + hold.p);
  } else {
    lines.push('The PLAIGROUND label account has no TooLost connection in this server process.');
  }
  const ready = readiness();
  if (!ready.ok) lines.push(ready.message);
  sendPage(res, ready.ok ? 200 : 503, lines, ready.ok ? startLink() : null);
}

async function handle(req, res) {
  try {
    const action = actionOf(req);
    if (!action) {
      sendPage(res, 404, 'Not found.');
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
  memoryRecord = null;
  fetchImpl = null;
}

function setFetchForTests(fn) {
  fetchImpl = fn;
}

function labelTokenForTests() {
  if (!memoryRecord) return null;
  return Object.assign({}, memoryRecord);
}

module.exports = {
  CREDENTIALS_COPY,
  HOLD_COOKIE,
  REDIRECT_DEFAULT,
  SCOPES,
  STATE_COOKIE,
  actionOf,
  endpoints,
  handle,
  labelStatus,
  labelTokenForTests,
  readiness,
  redirectUri,
  resetForTests,
  setFetchForTests,
};
