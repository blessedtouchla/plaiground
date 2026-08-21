'use strict';

/**
 * GET  /api/create-checkout-session  → { configured, publishableKey } (does not mint)
 * POST /api/create-checkout-session  → { url } for Stripe-hosted Checkout
 *
 * Server-only env: STRIPE_SECRET_KEY (never echo it).
 * Publishable env (pk only): NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY or STRIPE_PUBLISHABLE_KEY.
 */

const crypto = require('crypto');

const STRIPE_SESSIONS_URL = 'https://api.stripe.com/v1/checkout/sessions';
const STRIPE_API_VERSION = '2026-07-29.dahlia';
const SUCCESS_URL = 'https://www.wannaplai.com/confirm.html?session_id={CHECKOUT_SESSION_ID}';
const DEFAULT_CANCEL_URL = 'https://www.wannaplai.com/';

const PRICE_BY_PLAN = {
  'creator:month': 'price_1U6kDm47ejpgV1ChUQ7V937J',
  'creator:year': 'price_1U6kE547ejpgV1Chb6vtfjju',
  'pro:month': 'price_1U6kDz47ejpgV1ChuxQ7yZ86',
  'pro:year': 'price_1U6kE647ejpgV1ChsovROe7H',
};

const ALLOWED_PRICE_IDS = new Set(Object.values(PRICE_BY_PLAN));

const PLAN_ALIASES = { creator: 'creator', pro: 'pro' };
const INTERVAL_ALIASES = {
  month: 'month',
  monthly: 'month',
  year: 'year',
  yearly: 'year',
};

function isConfigured() {
  return Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim());
}

function publishableKey() {
  const candidates = [
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    process.env.STRIPE_PUBLISHABLE_KEY,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const raw = String(candidates[i] || '').trim();
    if (raw.startsWith('pk_')) return raw;
  }
  return null;
}

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

function scrub(text) {
  return String(text || '')
    .replace(/\b(?:sk|rk|pk)_[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]')
    .slice(0, 400);
}

function stripeErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Stripe could not start checkout.';
  }
  const raw =
    (payload.error && typeof payload.error.message === 'string' && payload.error.message) ||
    (typeof payload.error === 'string' && payload.error) ||
    (typeof payload.message === 'string' && payload.message) ||
    '';
  if (/api[\s_-]*key|secret|bearer|authorization/i.test(raw)) {
    return 'Stripe rejected the request.';
  }
  if (!raw) return 'Stripe could not start checkout.';
  return scrub(raw);
}

function randomLetters(count) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.randomBytes(count);
  let out = '';
  for (let i = 0; i < count; i += 1) {
    out += alphabet[bytes[i] % 26];
  }
  return out;
}

function resolvePrice(body) {
  const direct = String((body && (body.priceId || body.price_id)) || '').trim();
  if (direct) {
    if (!ALLOWED_PRICE_IDS.has(direct)) {
      return { error: 'Unknown price.' };
    }
    return { priceId: direct };
  }

  const plan = PLAN_ALIASES[String((body && body.plan) || '').trim().toLowerCase()];
  const interval = INTERVAL_ALIASES[String((body && body.interval) || '').trim().toLowerCase()];
  if (!plan || !interval) {
    return { error: 'Provide a valid priceId or plan and interval.' };
  }

  const priceId = PRICE_BY_PLAN[plan + ':' + interval];
  if (!priceId) {
    return { error: 'Unknown price.' };
  }
  return { priceId, plan, interval };
}

function safeCancelUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_CANCEL_URL;

  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return 'https://www.wannaplai.com' + raw;
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol === 'https:' && (host === 'wannaplai.com' || host === 'www.wannaplai.com')) {
      return parsed.toString();
    }
  } catch {
    // fall through
  }

  return DEFAULT_CANCEL_URL;
}

function planMetaForPrice(priceId) {
  const entry = Object.entries(PRICE_BY_PLAN).find(([, id]) => id === priceId);
  if (!entry) return { plan: '', interval: '' };
  const [plan, interval] = entry[0].split(':');
  return { plan, interval };
}

async function createCheckoutSession(req, res) {
  if (!isConfigured()) {
    sendJson(res, 503, { configured: false });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const resolved = resolvePrice(body);
  if (resolved.error) {
    sendJson(res, 400, { error: resolved.error });
    return;
  }

  const meta = resolved.plan
    ? { plan: resolved.plan, interval: resolved.interval }
    : planMetaForPrice(resolved.priceId);

  const params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('line_items[0][price]', resolved.priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('success_url', SUCCESS_URL);
  params.append('cancel_url', safeCancelUrl(body && (body.cancelUrl || body.cancel_url)));
  params.append('integration_identifier', 'plaiground_checkout_' + randomLetters(8));
  if (meta.plan) params.append('metadata[plan]', meta.plan);
  if (meta.interval) params.append('metadata[interval]', meta.interval);

  let response;
  try {
    response = await fetch(STRIPE_SESSIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION,
      },
      body: params.toString(),
    });
  } catch {
    sendJson(res, 502, { configured: true, error: 'Could not reach Stripe.' });
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
      error: stripeErrorMessage(data),
    });
    return;
  }

  const url = data && typeof data.url === 'string' ? data.url : '';
  if (!url) {
    sendJson(res, 502, { configured: true, error: 'Stripe did not return a checkout URL.' });
    return;
  }

  sendJson(res, 200, { url });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    sendJson(res, 200, { configured: isConfigured(), publishableKey: publishableKey() });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await createCheckoutSession(req, res);
};
