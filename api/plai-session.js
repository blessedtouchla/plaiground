'use strict';

/**
 * GET  /api/plai-session  → { configured: boolean } (does not mint)
 * POST /api/plai-session  → proxies xAI ephemeral token
 *
 * Server-only env: XAI_API_KEY (never echo it).
 * Docs: https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens
 */

const CLIENT_SECRETS_URL = 'https://api.x.ai/v1/realtime/client_secrets';

function isConfigured() {
  return Boolean(String(process.env.XAI_API_KEY || '').trim());
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function scrub(text) {
  return String(text || '')
    .replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]')
    .slice(0, 400);
}

function xaiErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'xAI could not mint a session token.';
  }
  if (typeof payload.error === 'string') return scrub(payload.error);
  if (payload.error && typeof payload.error.message === 'string') {
    return scrub(payload.error.message);
  }
  if (typeof payload.message === 'string') return scrub(payload.message);
  return 'xAI could not mint a session token.';
}

function sanitizeMintPayload(data) {
  const out = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    out.configured = true;
    return out;
  }

  Object.keys(data).forEach((key) => {
    const lower = key.toLowerCase();
    if (lower === 'api_key' || lower === 'xai_api_key' || lower === 'authorization') {
      return;
    }
    out[key] = data[key];
  });
  out.configured = true;
  return out;
}

async function mintToken(res) {
  if (!isConfigured()) {
    sendJson(res, 503, { configured: false });
    return;
  }

  let response;
  try {
    response = await fetch(CLIENT_SECRETS_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.XAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { seconds: 300 },
      }),
    });
  } catch {
    sendJson(res, 502, { configured: true, error: 'Could not reach xAI.' });
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
      configured: true,
      error: xaiErrorMessage(data),
    });
    return;
  }

  sendJson(res, 200, sanitizeMintPayload(data));
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    sendJson(res, 200, { configured: isConfigured() });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await mintToken(res);
};
