'use strict';

/**
 * GET  /api/plai-session  → { configured: boolean } (does not mint)
 * POST /api/plai-session  → proxies xAI ephemeral token
 *
 * Server-only env: XAI_API_KEY (never echo it).
 * Docs: https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens
 */

const xai = require('../lib/xai-client');
const reply = require('../lib/plai-reply');

const CLIENT_SECRETS_URL = 'https://api.x.ai/v1/realtime/client_secrets';
const REALTIME_BASE = 'wss://api.x.ai/v1/realtime';
const COACH_AGENT_ID = 'agent_9BWdEFlNcpLwxoQR';

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body || '{}'));
    } catch {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve) => {
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
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function wantsCoach(body) {
  return Boolean(body && (body.agent === 'coach' || body.role === 'coach'));
}

function coachRealtimeUrl() {
  return REALTIME_BASE + '?agent_id=' + encodeURIComponent(COACH_AGENT_ID);
}

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

async function coachText(res, text) {
  var asked = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!asked) {
    sendJson(res, 400, { error: 'Type a question first.' });
    return;
  }
  if (!xai.configured()) {
    sendJson(res, 503, { configured: false });
    return;
  }
  var response;
  try {
    response = await xai.postJson(xai.CHAT_URL, xai.key(), {
      model: xai.chatModel(),
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: 'system', content: reply.FACTS },
        { role: 'user', content: asked },
      ],
    }, 20000);
  } catch (err) {
    sendJson(res, 502, { configured: true, error: 'Plai could not answer just now.' });
    return;
  }
  var data = {};
  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }
  if (!response.ok) {
    sendJson(res, 502, { configured: true, error: 'Plai could not answer just now.' });
    return;
  }
  var choice = data.choices && data.choices[0];
  var message = choice && choice.message;
  var content = '';
  if (message && typeof message.content === 'string') content = message.content;
  else if (message && Array.isArray(message.content)) {
    content = message.content.map(function (part) {
      if (typeof part === 'string') return part;
      return part && part.text ? part.text : '';
    }).join(' ');
  }
  var reason = choice && choice.finish_reason;
  var polished = reply.polish(content, { truncated: reason === 'length', ask: asked });
  if (!polished) polished = reply.PRICE;
  sendJson(res, 200, { configured: true, reply: polished });
}

async function mintToken(res, coach) {
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

  const payload = sanitizeMintPayload(data);
  if (coach) payload.realtime_url = coachRealtimeUrl();
  sendJson(res, 200, payload);
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
  let body = {};
  try {
    body = await readBody(req);
  } catch {
    body = {};
  }
  if (wantsCoach(body) && String(body.text || '').trim()) {
    await coachText(res, body.text);
    return;
  }
  await mintToken(res, wantsCoach(body));
};
