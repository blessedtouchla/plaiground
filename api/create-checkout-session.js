'use strict';

/**
 * GET  /api/create-checkout-session  → { configured, publishableKey } (does not mint)
 * POST /api/create-checkout-session  → { url } for Stripe-hosted Checkout (mode=subscription)
 * POST { action: "switch" }          → update the signed-in customer's ONE subscription
 * POST { action: "preview" }         → confirm-page copy only (does not charge)
 * Existing Creator/Pro members never get a second Checkout Session.
 * POST { action: "billing" }         → current paid price + live Stripe current_period_end
 *                                        (omit the date when Stripe does not send one)
 * POST { action: "portal" }          → Stripe Customer Billing Portal (card update only)
 * POST /api/stripe/webhook           → verify Stripe-Signature, set Creator/Pro/Basic
 *
 * Hobby-safe: webhook is the same Serverless Function via vercel.json rewrite.
 * Accept Stripe on BOTH hosts. Stripe does not follow redirects, so POST
 * /api/stripe/webhook on wannaplai.com must not 308 to www.
 *   https://wannaplai.com/api/stripe/webhook
 *   https://www.wannaplai.com/api/stripe/webhook
 *
 * Stripe Dashboard (add after deploy; do not invent a secret here):
 *   1. Developers → Webhooks → Add endpoint
 *   2. Endpoint URL: https://www.wannaplai.com/api/stripe/webhook
 *      (apex https://wannaplai.com/api/stripe/webhook must also accept POST)
 *   3. Events: checkout.session.completed, invoice.paid, invoice.upcoming,
 *      invoice.payment_failed, payment_intent.payment_failed,
 *      customer.subscription.updated, customer.subscription.deleted
 *   4. Billing → Subscriptions and emails: Upcoming renewal events = 7 days
 *      and generate invoices 7 days in advance. After retries, mark unpaid.
 *   5. Copy the signing secret into Vercel as STRIPE_WEBHOOK_SECRET
 *
 * Server-only env (names only): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * Publishable env (pk only): NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY or STRIPE_PUBLISHABLE_KEY.
 */

const crypto = require('crypto');
const { findById, updateStripe } = require('../lib/accounts');
const { attachSession, publicUser, sessionFromRequest } = require('../lib/auth');
const { pathnameOf, queryValue } = require('../lib/route');
const {
  ALLOWED_PRICE_IDS,
  PRICE_BY_PLAN,
  amountForPriceId,
  planMetaForPrice,
  prorationBehaviorForChange,
} = require('../lib/stripe-plans');
const { applyStripeEvent, periodEndUnix, verifyStripeSignature, webhookSecret } = require('../lib/stripe-webhook');
const { headerValue } = require('../lib/tonegrid');

const STRIPE_API_BASE = 'https://api.stripe.com/v1/';
const STRIPE_SESSIONS_URL = STRIPE_API_BASE + 'checkout/sessions';
const STRIPE_API_VERSION = '2026-07-29.dahlia';
const SUCCESS_URL = 'https://www.wannaplai.com/confirm.html?session_id={CHECKOUT_SESSION_ID}';
const DEFAULT_CANCEL_URL = 'https://www.wannaplai.com/';
const DEFAULT_PORTAL_RETURN_URL = 'https://www.wannaplai.com/settings.html#manage-billing';
const LIVE_SUB_STATUSES = {
  active: true,
  past_due: true,
  unpaid: true,
  trialing: true,
  paused: true,
};

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

function hasReadableStream(req) {
  if (!req || typeof req.on !== 'function') return false;
  return req.readable === true || typeof req.read === 'function' || !!req.socket;
}

function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return Promise.resolve(req.rawBody);
  if (typeof req.rawBody === 'string') return Promise.resolve(Buffer.from(req.rawBody, 'utf8'));
  if (req && typeof req.text === 'function' && !hasReadableStream(req)) {
    return Promise.resolve(req.text()).then((text) => Buffer.from(String(text || ''), 'utf8'));
  }
  // Vercel Node helpers expose req.body as a getter that parses JSON and
  // consumes the stream. Never read req.body when the raw stream is still there.
  if (hasReadableStream(req)) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body, 'utf8'));
  if (req.body && typeof req.body === 'object') {
    return Promise.reject(new Error('raw body required'));
  }
  return Promise.resolve(Buffer.alloc(0));
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
  let interval = INTERVAL_ALIASES[String((body && body.interval) || '').trim().toLowerCase()];
  if (plan && !interval) interval = 'month';
  if (!plan || !interval) {
    return { error: 'Provide a valid priceId or plan and interval.' };
  }

  const priceId = PRICE_BY_PLAN[plan + ':' + interval];
  if (!priceId) {
    return { error: 'Unknown price.' };
  }
  return { priceId, plan, interval };
}

function actionOf(body) {
  return String((body && (body.action || body.intent)) || '').trim().toLowerCase();
}

function wantsSwitch(body) {
  if (!body || typeof body !== 'object') return false;
  return actionOf(body) === 'switch' || body.switch === true;
}

function wantsBilling(body) {
  if (!body || typeof body !== 'object') return false;
  return actionOf(body) === 'billing';
}

function wantsPortal(body) {
  if (!body || typeof body !== 'object') return false;
  return actionOf(body) === 'portal';
}

function wantsPreview(body) {
  if (!body || typeof body !== 'object') return false;
  return actionOf(body) === 'preview';
}

function firstSubscriptionItem(sub) {
  const bag = sub && sub.items;
  const rows = Array.isArray(bag) ? bag : bag && Array.isArray(bag.data) ? bag.data : [];
  return rows[0] || null;
}

function priceIdOfSubscription(sub) {
  const item = firstSubscriptionItem(sub);
  if (!item) return '';
  if (typeof item.price === 'string') return item.price;
  if (item.price && typeof item.price === 'object') return String(item.price.id || '');
  return '';
}

function isPaidMember(user) {
  const plan = String((user && user.plan) || '').trim().toLowerCase();
  return plan === 'creator' || plan === 'pro';
}

function refuseSecondSubscription(res, extra) {
  sendJson(res, 409, Object.assign({
    configured: true,
    existing: true,
    error: 'You already have a subscription. This change updates that plan instead of starting a second one.',
  }, extra || {}));
}

function pickLiveSubscription(list) {
  const rows = list && Array.isArray(list.data) ? list.data : Array.isArray(list) ? list : [];
  let fallback = null;
  for (let i = 0; i < rows.length; i += 1) {
    const sub = rows[i];
    if (!sub || !LIVE_SUB_STATUSES[String(sub.status || '')]) continue;
    if (!fallback) fallback = sub;
    if (priceIdOfSubscription(sub) || firstSubscriptionItem(sub)) return sub;
  }
  return fallback;
}

async function hydrateSubscription(sub) {
  if (!sub || !sub.id) return sub;
  if (firstSubscriptionItem(sub) && priceIdOfSubscription(sub)) return sub;
  const got = await stripeRequest('GET', 'subscriptions/' + sub.id, null, {
    'expand[0]': 'items.data.price',
  });
  if (got.ok && got.data) return got.data;
  return sub;
}

async function stripeRequest(method, path, params, query) {
  const url = new URL(STRIPE_API_BASE + String(path || '').replace(/^\//, ''));
  if (query && typeof query === 'object') {
    Object.keys(query).forEach((key) => {
      const value = query[key];
      if (value == null || value === '') return;
      url.searchParams.append(key, String(value));
    });
  }
  const headers = {
    Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
    'Stripe-Version': STRIPE_API_VERSION,
  };
  const opts = { method: method || 'GET', headers };
  if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = params instanceof URLSearchParams ? params.toString() : String(params);
  }
  const response = await fetch(url.toString(), opts);
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { ok: response.ok, status: response.status, data, url: url.toString() };
}

async function loadSignedInUser(req, res) {
  const session = sessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { configured: isConfigured(), error: 'Sign in required.' });
    return null;
  }
  let user;
  try {
    user = await findById(session.userId);
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      sendJson(res, 503, { configured: true, error: 'Accounts are not configured.' });
      return null;
    }
    throw err;
  }
  if (!user) {
    sendJson(res, 401, { configured: isConfigured(), error: 'Sign in required.' });
    return null;
  }
  attachSession(req, res, user.id);
  return user;
}

async function subscriptionForCustomer(customerId) {
  const id = String(customerId || '').trim();
  if (!id || id.indexOf('cus_') !== 0) return null;
  const listed = await stripeRequest('GET', 'subscriptions', null, {
    customer: id,
    limit: '10',
    'expand[0]': 'data.items.data.price',
  });
  if (!listed.ok) return { error: stripeErrorMessage(listed.data), status: listed.status };
  let sub = pickLiveSubscription(listed.data);
  if (sub) sub = await hydrateSubscription(sub);
  return { sub };
}

function isBillingPortalUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:') return false;
    if (host === 'dashboard.stripe.com' || host.indexOf('dashboard.stripe.') === 0) return false;
    return host === 'billing.stripe.com' || host.endsWith('.billing.stripe.com');
  } catch {
    return false;
  }
}

function safePortalReturnUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_PORTAL_RETURN_URL;

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

  return DEFAULT_PORTAL_RETURN_URL;
}

async function createPortalConfiguration() {
  const params = new URLSearchParams();
  params.append('features[payment_method_update][enabled]', 'true');
  params.append('features[invoice_history][enabled]', 'false');
  params.append('features[customer_update][enabled]', 'false');
  params.append('features[subscription_cancel][enabled]', 'false');
  params.append('features[subscription_update][enabled]', 'false');
  return stripeRequest('POST', 'billing_portal/configurations', params);
}

async function createPortalSession(req, res, body) {
  if (!isConfigured()) {
    sendJson(res, 503, { configured: false, error: 'Billing is not available yet.' });
    return;
  }

  const user = await loadSignedInUser(req, res);
  if (!user) return;

  const customerId = String(user.stripe_customer_id || '').trim();
  if (!customerId || customerId.indexOf('cus_') !== 0) {
    sendJson(res, 200, {
      configured: true,
      no_card: true,
      has_card: false,
      error: 'There is no card on file.',
    });
    return;
  }

  const returnUrl = safePortalReturnUrl(body && (body.returnUrl || body.return_url));
  const params = new URLSearchParams();
  params.append('customer', customerId);
  params.append('return_url', returnUrl);
  params.append('flow_data[type]', 'payment_method_update');

  let created;
  try {
    created = await stripeRequest('POST', 'billing_portal/sessions', params);
  } catch {
    sendJson(res, 502, { configured: true, error: 'Could not reach Stripe.' });
    return;
  }

  if (!created.ok) {
    let config;
    try {
      config = await createPortalConfiguration();
    } catch {
      config = null;
    }
    if (config && config.ok && config.data && config.data.id) {
      params.append('configuration', config.data.id);
      try {
        created = await stripeRequest('POST', 'billing_portal/sessions', params);
      } catch {
        sendJson(res, 502, { configured: true, error: 'Could not reach Stripe.' });
        return;
      }
    }
  }

  if (!created.ok) {
    sendJson(res, created.status >= 400 && created.status < 600 ? created.status : 502, {
      configured: true,
      error: stripeErrorMessage(created.data),
    });
    return;
  }

  const url = created.data && typeof created.data.url === 'string' ? created.data.url : '';
  if (!isBillingPortalUrl(url)) {
    sendJson(res, 502, { configured: true, error: 'Stripe did not return a billing portal.' });
    return;
  }

  sendJson(res, 200, { url, portal: true });
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

async function attachPayer(params, req) {
  const session = sessionFromRequest(req);
  if (!session) return { ok: false, status: 401, error: 'Sign in required.' };
  let user;
  try {
    user = await findById(session.userId);
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      return { ok: false, status: 503, error: 'Accounts are not configured.' };
    }
    throw err;
  }
  if (!user) return { ok: false, status: 401, error: 'Sign in required.' };
  params.append('client_reference_id', user.id);
  params.append('metadata[userId]', user.id);
  params.append('metadata[email]', user.email);
  params.append('subscription_data[metadata][userId]', user.id);
  params.append('subscription_data[metadata][email]', user.email);
  if (user.stripe_customer_id) {
    params.append('customer', user.stripe_customer_id);
  } else if (user.email) {
    params.append('customer_email', user.email);
  }
  return { ok: true, user };
}

async function showBilling(req, res) {
  if (!isConfigured()) {
    sendJson(res, 503, { configured: false });
    return;
  }
  const user = await loadSignedInUser(req, res);
  if (!user) return;
  const customerId = String(user.stripe_customer_id || '').trim();
  if (!customerId) {
    sendJson(res, 200, {
      plan: user.plan || 'basic',
      interval: '',
      priceId: '',
      has_card: false,
      no_card: true,
    });
    return;
  }
  let found;
  try {
    found = await subscriptionForCustomer(customerId);
  } catch {
    sendJson(res, 502, { configured: true, error: 'Could not reach Stripe.' });
    return;
  }
  if (found && found.error) {
    sendJson(res, found.status >= 400 && found.status < 600 ? found.status : 502, {
      configured: true,
      error: found.error,
    });
    return;
  }
  const priceId = found && found.sub ? priceIdOfSubscription(found.sub) : '';
  const meta = planMetaForPrice(priceId);
  const plan = meta.plan || user.plan || 'basic';
  const payload = {
    plan: plan,
    interval: meta.interval || '',
    priceId: priceId || '',
    has_card: true,
    no_card: false,
  };
  const periodEnd = found && found.sub ? periodEndUnix(found.sub) : null;
  if ((plan === 'creator' || plan === 'pro') && periodEnd != null) {
    payload.current_period_end = periodEnd;
  }
  sendJson(res, 200, payload);
}

function centsDue(invoice) {
  if (!invoice || typeof invoice !== 'object') return null;
  const keys = ['amount_due', 'amount_remaining', 'total'];
  for (let i = 0; i < keys.length; i += 1) {
    const n = Number(invoice[keys[i]]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

async function previewSubscription(req, res, body) {
  if (!isConfigured()) {
    sendJson(res, 503, { configured: false });
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
  if (meta.plan !== 'creator' && meta.plan !== 'pro') {
    sendJson(res, 400, { error: 'Basic is not a paid switch target.' });
    return;
  }

  const user = await loadSignedInUser(req, res);
  if (!user) return;

  const recurringAmount = amountForPriceId(resolved.priceId);
  const customerId = String(user.stripe_customer_id || '').trim();
  if (!customerId) {
    sendJson(res, 200, {
      preview: true,
      checkout: !isPaidMember(user),
      existing: isPaidMember(user),
      plan: meta.plan,
      interval: meta.interval,
      currentPlan: user.plan || 'basic',
      currentInterval: '',
      recurring_amount: recurringAmount,
    });
    return;
  }

  let found;
  try {
    found = await subscriptionForCustomer(customerId);
  } catch {
    sendJson(res, 200, {
      preview: true,
      checkout: !isPaidMember(user),
      existing: isPaidMember(user),
      plan: meta.plan,
      interval: meta.interval,
      currentPlan: user.plan || 'basic',
      currentInterval: '',
      recurring_amount: recurringAmount,
    });
    return;
  }
  if (!found || found.error || !found.sub) {
    sendJson(res, 200, {
      preview: true,
      checkout: !isPaidMember(user),
      existing: isPaidMember(user),
      plan: meta.plan,
      interval: meta.interval,
      currentPlan: user.plan || 'basic',
      currentInterval: '',
      recurring_amount: recurringAmount,
    });
    return;
  }

  const sub = found.sub;
  const item = firstSubscriptionItem(sub);
  const currentPriceId = priceIdOfSubscription(sub);
  const currentMeta = planMetaForPrice(currentPriceId);
  if (currentPriceId === resolved.priceId) {
    sendJson(res, 200, {
      preview: true,
      unchanged: true,
      existing: true,
      plan: meta.plan,
      interval: meta.interval,
      currentPlan: currentMeta.plan || user.plan,
      currentInterval: currentMeta.interval || '',
      priceId: resolved.priceId,
      recurring_amount: recurringAmount,
    });
    return;
  }

  const proration = prorationBehaviorForChange(currentPriceId, resolved.priceId) || 'none';
  let amountDue = null;
  if (proration === 'always_invoice' && item && item.id) {
    const params = new URLSearchParams();
    params.append('customer', customerId);
    params.append('subscription', sub.id);
    params.append('subscription_details[items][0][id]', item.id);
    params.append('subscription_details[items][0][price]', resolved.priceId);
    params.append('subscription_details[proration_behavior]', 'always_invoice');
    try {
      const previewed = await stripeRequest('POST', 'invoices/create_preview', params);
      if (previewed.ok) amountDue = centsDue(previewed.data);
    } catch {
      amountDue = null;
    }
  }

  sendJson(res, 200, {
    preview: true,
    existing: true,
    checkout: false,
    plan: meta.plan,
    interval: meta.interval,
    currentPlan: currentMeta.plan || user.plan || 'basic',
    currentInterval: currentMeta.interval || '',
    priceId: resolved.priceId,
    proration,
    amount_due: amountDue,
    recurring_amount: recurringAmount,
  });
}

async function switchSubscription(req, res, body) {
  if (!isConfigured()) {
    sendJson(res, 503, { configured: false });
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
  if (meta.plan !== 'creator' && meta.plan !== 'pro') {
    sendJson(res, 400, { error: 'Basic is not a paid switch target.' });
    return;
  }

  const user = await loadSignedInUser(req, res);
  if (!user) return;

  const customerId = String(user.stripe_customer_id || '').trim();
  if (!customerId) {
    if (isPaidMember(user)) {
      refuseSecondSubscription(res, { confirm: true, plan: meta.plan, interval: meta.interval });
      return;
    }
    await createCheckoutSession(req, res, body);
    return;
  }

  let found;
  try {
    found = await subscriptionForCustomer(customerId);
  } catch {
    sendJson(res, 502, { configured: true, error: 'Could not reach Stripe.' });
    return;
  }
  if (found && found.error) {
    sendJson(res, found.status >= 400 && found.status < 600 ? found.status : 502, {
      configured: true,
      error: found.error,
    });
    return;
  }
  if (!found || !found.sub) {
    if (isPaidMember(user)) {
      refuseSecondSubscription(res, { confirm: true, plan: meta.plan, interval: meta.interval });
      return;
    }
    await createCheckoutSession(req, res, body);
    return;
  }

  const sub = found.sub;
  const item = firstSubscriptionItem(sub);
  const currentPriceId = priceIdOfSubscription(sub);
  if (!item || !item.id) {
    sendJson(res, 502, { configured: true, error: 'Could not find the current plan item.' });
    return;
  }
  if (currentPriceId === resolved.priceId) {
    sendJson(res, 200, {
      switched: true,
      unchanged: true,
      plan: meta.plan,
      interval: meta.interval,
      priceId: resolved.priceId,
      account: publicUser(user),
    });
    return;
  }

  const proration = prorationBehaviorForChange(currentPriceId, resolved.priceId) || 'none';
  const params = new URLSearchParams();
  params.append('items[0][id]', item.id);
  params.append('items[0][price]', resolved.priceId);
  params.append('proration_behavior', proration);
  if (proration === 'always_invoice') {
    params.append('payment_behavior', 'error_if_incomplete');
  }
  if (meta.plan) params.append('metadata[plan]', meta.plan);
  if (meta.interval) params.append('metadata[interval]', meta.interval);

  let updated;
  try {
    updated = await stripeRequest('POST', 'subscriptions/' + sub.id, params);
  } catch {
    sendJson(res, 502, { configured: true, error: 'Could not reach Stripe.' });
    return;
  }
  if (!updated.ok) {
    sendJson(res, updated.status >= 400 && updated.status < 600 ? updated.status : 502, {
      configured: true,
      error: stripeErrorMessage(updated.data),
    });
    return;
  }

  const nextPriceId = priceIdOfSubscription(updated.data) || resolved.priceId;
  const nextMeta = planMetaForPrice(nextPriceId);
  const plan = nextMeta.plan || meta.plan;
  const interval = nextMeta.interval || meta.interval;
  const next = await updateStripe(user.id, {
    plan,
    status: 'active',
    customerId: customerId,
  });
  const account = publicUser(next || user) || {};
  account.billing_interval = interval;
  account.interval = interval;
  sendJson(res, 200, {
    switched: true,
    existing: true,
    one_subscription: true,
    plan,
    interval,
    priceId: nextPriceId,
    proration,
    account,
  });
}

async function createCheckoutSession(req, res, preloaded) {
  if (!isConfigured()) {
    sendJson(res, 503, { configured: false });
    return;
  }

  let body = preloaded;
  if (!body) {
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON.' });
      return;
    }
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
  if (meta.plan) {
    params.append('metadata[plan]', meta.plan);
    params.append('subscription_data[metadata][plan]', meta.plan);
  }
  if (meta.interval) {
    params.append('metadata[interval]', meta.interval);
    params.append('subscription_data[metadata][interval]', meta.interval);
  }
  let payer;
  try {
    payer = await attachPayer(params, req);
  } catch {
    sendJson(res, 503, { configured: true, error: 'Accounts are not configured.' });
    return;
  }
  if (!payer || !payer.ok) {
    sendJson(res, (payer && payer.status) || 401, {
      configured: true,
      error: (payer && payer.error) || 'Sign in required.',
    });
    return;
  }

  const payerUser = payer.user;
  const existingCustomerId = String((payerUser && payerUser.stripe_customer_id) || '').trim();
  if (existingCustomerId) {
    let existing;
    try {
      existing = await subscriptionForCustomer(existingCustomerId);
    } catch {
      existing = null;
    }
    if (existing && existing.sub) {
      refuseSecondSubscription(res, {
        confirm: true,
        plan: meta.plan,
        interval: meta.interval,
      });
      return;
    }
  }
  if (isPaidMember(payerUser)) {
    refuseSecondSubscription(res, {
      confirm: true,
      plan: meta.plan,
      interval: meta.interval,
    });
    return;
  }

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

function isWebhook(req) {
  const path = pathnameOf(req);
  if (path === '/api/stripe/webhook' || path === '/api/stripe') return true;
  return queryValue(req, 'action') === 'webhook';
}

async function handleWebhook(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const secret = webhookSecret();
  if (!secret) {
    sendJson(res, 503, { configured: false, error: 'Webhook is not configured.' });
    return;
  }

  let raw;
  try {
    raw = await readRawBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid body.' });
    return;
  }

  const verified = verifyStripeSignature(raw, headerValue(req, 'stripe-signature'), secret);
  if (!verified.ok) {
    sendJson(res, 400, { error: 'Invalid signature.' });
    return;
  }

  let event;
  try {
    event = JSON.parse(raw.toString('utf8') || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  try {
    await applyStripeEvent(event);
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      sendJson(res, 503, { error: 'Accounts are not configured.' });
      return;
    }
    sendJson(res, 500, { error: 'Webhook failed.' });
    return;
  }

  sendJson(res, 200, { received: true });
}

async function handler(req, res) {
  if (isWebhook(req)) {
    await handleWebhook(req, res);
    return;
  }
  if (req.method === 'GET') {
    sendJson(res, 200, { configured: isConfigured(), publishableKey: publishableKey() });
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
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  if (wantsBilling(body)) {
    await showBilling(req, res);
    return;
  }
  if (wantsPortal(body)) {
    await createPortalSession(req, res, body);
    return;
  }
  if (wantsPreview(body)) {
    await previewSubscription(req, res, body);
    return;
  }
  if (wantsSwitch(body)) {
    await switchSubscription(req, res, body);
    return;
  }
  await createCheckoutSession(req, res, body);
}

handler.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = handler;
module.exports.config = handler.config;
