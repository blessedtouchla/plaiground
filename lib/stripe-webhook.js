'use strict';

/**
 * Stripe webhook: verify Stripe-Signature, map a paid live price to Creator/Pro,
 * write that plan on the user. Failed pay writes status=hold (plan stays).
 * Cancel / subscription.deleted writes Basic and status=active.
 *
 * Dashboard endpoint (add after deploy; put the signing secret in Vercel):
 *   https://wannaplai.com/api/stripe/webhook
 * Events:
 *   checkout.session.completed
 *   invoice.paid
 *   invoice.payment_failed
 *   payment_intent.payment_failed
 *   customer.subscription.updated
 *   customer.subscription.deleted
 * Env (names only): STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY
 */

const crypto = require('crypto');
const { findByEmail, findById, findByStripeCustomerId, updateStripe } = require('./accounts');
const { isHoldStatus, normalizePaidPlan } = require('./auth');
const { planForPriceId } = require('./stripe-plans');

const STRIPE_API_VERSION = '2026-07-29.dahlia';
const SIGNATURE_TOLERANCE_SEC = 300;
const HOLD_SUB_STATUSES = {
  past_due: true,
  unpaid: true,
};
const BASIC_SUB_STATUSES = {
  canceled: true,
};

function webhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
}

function stripeSecret() {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function signStripePayload(rawBody, secret, timestamp) {
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  return crypto.createHmac('sha256', secret).update(String(timestamp) + '.' + raw).digest('hex');
}

function verifyStripeSignature(rawBody, header, secret, nowSec) {
  const sec = String(secret || '').trim();
  if (!sec) return { ok: false, reason: 'missing_secret' };

  let timestamp = '';
  const signatures = [];
  String(header || '')
    .split(',')
    .map((part) => part.trim())
    .forEach((part) => {
      const eq = part.indexOf('=');
      if (eq === -1) return;
      const key = part.slice(0, eq);
      const value = part.slice(eq + 1);
      if (key === 't') timestamp = value;
      if (key === 'v1' && value) signatures.push(value);
    });

  if (!timestamp || !signatures.length) return { ok: false, reason: 'bad_header' };

  const ts = Number(timestamp);
  const now = nowSec != null ? nowSec : Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > SIGNATURE_TOLERANCE_SEC) {
    return { ok: false, reason: 'timestamp' };
  }

  const expected = signStripePayload(rawBody, sec, timestamp);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const match = signatures.some((sig) => {
    const actual = Buffer.from(String(sig), 'utf8');
    return actual.length === expectedBuf.length && crypto.timingSafeEqual(actual, expectedBuf);
  });
  return match ? { ok: true } : { ok: false, reason: 'mismatch' };
}

function pushPriceId(value, out) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('price_')) return;
  if (out.indexOf(raw) === -1) out.push(raw);
}

function pricesFromItem(item, out) {
  if (!item || typeof item !== 'object') return;
  if (typeof item.price === 'string') pushPriceId(item.price, out);
  if (item.price && typeof item.price === 'object') pushPriceId(item.price.id, out);
  if (item.plan && typeof item.plan === 'object') pushPriceId(item.plan.id, out);
  if (item.pricing && item.pricing.price_details) {
    const priced = item.pricing.price_details.price;
    if (typeof priced === 'string') pushPriceId(priced, out);
    else if (priced && typeof priced === 'object') pushPriceId(priced.id, out);
  }
}

function collectPriceIds(obj) {
  const out = [];
  if (!obj || typeof obj !== 'object') return out;
  pricesFromItem(obj, out);
  ['line_items', 'lines', 'items'].forEach((key) => {
    const bag = obj[key];
    const rows = Array.isArray(bag) ? bag : bag && Array.isArray(bag.data) ? bag.data : [];
    rows.forEach((item) => pricesFromItem(item, out));
  });
  return out;
}

function customerIdOf(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (typeof obj.customer === 'string' && obj.customer.indexOf('cus_') === 0) return obj.customer;
  if (obj.customer && typeof obj.customer === 'object' && obj.customer.id) {
    return String(obj.customer.id);
  }
  return '';
}

function metadataOf(obj) {
  const bags = [];
  if (obj && obj.metadata && typeof obj.metadata === 'object') bags.push(obj.metadata);
  if (obj && obj.subscription_details && obj.subscription_details.metadata) {
    bags.push(obj.subscription_details.metadata);
  }
  if (obj && obj.parent && obj.parent.subscription_details && obj.parent.subscription_details.metadata) {
    bags.push(obj.parent.subscription_details.metadata);
  }
  const merged = {};
  bags.forEach((meta) => {
    Object.keys(meta).forEach((key) => {
      if (merged[key] == null || merged[key] === '') merged[key] = meta[key];
    });
  });
  return merged;
}

function collectUserHints(obj) {
  const meta = metadataOf(obj);
  const details = obj && obj.customer_details && typeof obj.customer_details === 'object'
    ? obj.customer_details
    : {};
  return {
    userId: String(
      (obj && obj.client_reference_id) || meta.userId || meta.user_id || ''
    ).trim(),
    email: String(
      (obj && (obj.customer_email || obj.email)) || details.email || ''
    ).trim(),
    customerId: customerIdOf(obj),
  };
}

function planFromPriceIds(ids) {
  for (let i = 0; i < ids.length; i += 1) {
    const plan = planForPriceId(ids[i]);
    if (plan) return plan;
  }
  return null;
}

async function defaultRetrieve(path, expand) {
  const key = stripeSecret();
  if (!key) return null;
  const url = new URL('https://api.stripe.com/v1/' + String(path || '').replace(/^\//, ''));
  (expand || []).forEach((item) => url.searchParams.append('expand[]', item));
  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: 'Bearer ' + key,
        'Stripe-Version': STRIPE_API_VERSION,
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function subscriptionIdOf(obj) {
  if (!obj) return '';
  if (typeof obj.subscription === 'string') return obj.subscription;
  if (obj.subscription && typeof obj.subscription === 'object' && obj.subscription.id) {
    return String(obj.subscription.id);
  }
  if (obj.object === 'subscription' && obj.id) return String(obj.id);
  return '';
}

async function resolvePaidPlan(obj, retrieve) {
  const direct = planFromPriceIds(collectPriceIds(obj));
  if (direct) return direct;

  const fetchObj = typeof retrieve === 'function' ? retrieve : defaultRetrieve;
  const subId = subscriptionIdOf(obj);
  if (subId) {
    const sub = await fetchObj('subscriptions/' + subId);
    const fromSub = planFromPriceIds(collectPriceIds(sub));
    if (fromSub) return fromSub;
  }
  if (obj && obj.object === 'checkout.session' && obj.id) {
    const session = await fetchObj('checkout/sessions/' + obj.id, ['line_items']);
    const fromSession = planFromPriceIds(collectPriceIds(session));
    if (fromSession) return fromSession;
  }

  return normalizePaidPlan(metadataOf(obj).plan);
}

async function findUserFromHints(hints) {
  if (hints.userId) {
    const byId = await findById(hints.userId);
    if (byId) return byId;
  }
  if (hints.customerId) {
    const byCustomer = await findByStripeCustomerId(hints.customerId);
    if (byCustomer) return byCustomer;
  }
  if (hints.email) {
    const byEmail = await findByEmail(hints.email);
    if (byEmail) return byEmail;
  }
  return null;
}

async function writePlan(obj, plan, extra) {
  const hints = collectUserHints(obj);
  const user = await findUserFromHints(hints);
  if (!user) return { applied: false, reason: 'no_user' };
  const status = (extra && extra.status) || 'active';
  const next = await updateStripe(user.id, {
    plan,
    status,
    sessionId: extra && extra.sessionId,
    customerId: (extra && extra.customerId) || hints.customerId,
  });
  return {
    applied: true,
    plan,
    status,
    userId: user.id,
    email: next && next.email,
  };
}

async function writeHold(obj) {
  const hints = collectUserHints(obj);
  const user = await findUserFromHints(hints);
  if (!user) return { applied: false, reason: 'no_user' };
  if (user.plan !== 'creator' && user.plan !== 'pro') {
    return { applied: false, reason: 'not_paid' };
  }
  if (isHoldStatus(user.status)) {
    return { applied: true, plan: user.plan, status: 'hold', userId: user.id };
  }
  const next = await updateStripe(user.id, {
    status: 'hold',
    customerId: hints.customerId,
  });
  return {
    applied: true,
    plan: next && next.plan,
    status: 'hold',
    userId: user.id,
  };
}

function isPaidInvoice(obj) {
  if (!obj) return false;
  if (obj.paid === true && Number(obj.amount_paid) > 0) return true;
  if (obj.paid === true && obj.amount_paid == null) return true;
  return Number(obj.amount_paid) > 0;
}

async function applyStripeEvent(event, options) {
  const type = event && event.type;
  const obj = event && event.data && event.data.object;
  if (!obj || typeof obj !== 'object') return { applied: false, reason: 'empty' };
  const retrieve = options && options.retrieve;

  if (type === 'checkout.session.completed') {
    if (String(obj.payment_status || '') !== 'paid') {
      return { applied: false, reason: 'unpaid' };
    }
    const plan = await resolvePaidPlan(obj, retrieve);
    if (!plan) return { applied: false, reason: 'unknown_price' };
    return writePlan(obj, plan, {
      sessionId: obj.id,
      customerId: customerIdOf(obj),
      status: 'active',
    });
  }

  if (type === 'invoice.paid') {
    if (!isPaidInvoice(obj)) return { applied: false, reason: 'unpaid' };
    const plan = await resolvePaidPlan(obj, retrieve);
    if (!plan) return { applied: false, reason: 'unknown_price' };
    return writePlan(obj, plan, { customerId: customerIdOf(obj), status: 'active' });
  }

  if (type === 'invoice.payment_failed' || type === 'payment_intent.payment_failed') {
    return writeHold(obj);
  }

  if (type === 'customer.subscription.updated') {
    const status = String(obj.status || '');
    if (BASIC_SUB_STATUSES[status]) {
      return writePlan(obj, 'basic', { customerId: customerIdOf(obj), status: 'active' });
    }
    if (HOLD_SUB_STATUSES[status]) {
      return writeHold(obj);
    }
    if (status !== 'active') return { applied: false, reason: 'inactive' };
    const plan = await resolvePaidPlan(obj, retrieve);
    if (!plan) return { applied: false, reason: 'unknown_price' };
    return writePlan(obj, plan, { customerId: customerIdOf(obj), status: 'active' });
  }

  if (type === 'customer.subscription.deleted') {
    return writePlan(obj, 'basic', { customerId: customerIdOf(obj), status: 'active' });
  }

  return { applied: false, reason: 'ignored' };
}

module.exports = {
  SIGNATURE_TOLERANCE_SEC,
  applyStripeEvent,
  collectPriceIds,
  collectUserHints,
  planFromPriceIds,
  resolvePaidPlan,
  signStripePayload,
  verifyStripeSignature,
  webhookSecret,
};
