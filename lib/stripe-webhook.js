'use strict';

/**
 * Stripe webhook: verify Stripe-Signature, map a paid live price to Creator/Pro.
 *
 * Statuses (plan stays Creator/Pro unless canceled/deleted):
 *   active  — paid, full access, payouts allowed
 *   warning — failed charge before period_end / Stripe past_due. Paid features stay on.
 *             Payouts blocked until the card is fixed.
 *   hold    — shutoff at period_end / Stripe unpaid. Signed in; paid features locked.
 * Cancel / subscription.deleted writes Basic and status=active.
 *
 * Stripe encodes the window (no cron):
 *   past_due = warning
 *   unpaid   = shutoff/hold
 *   invoice.payment_failed uses invoice/subscription period_end when status is missing:
 *     now < period_end → warning; now >= period_end → hold
 *   invoice.upcoming is acknowledged only (still in the paid period)
 *
 * 7-day-early monthly collection is Stripe Billing, not a cron:
 *   Checkout mode=subscription already charges automatically; do not send
 *   subscription_data[collection_method] (Checkout Sessions reject it).
 *   Dashboard → Settings → Billing → Subscriptions and emails:
 *     Upcoming renewal events = 7 days (fires invoice.upcoming)
 *     Generate invoices 7 days in advance (charges when the invoice finalizes)
 *     After retries: mark the subscription unpaid (period-end shutoff)
 *
 * Dashboard endpoint (add after deploy; put the signing secret in Vercel):
 *   https://wannaplai.com/api/stripe/webhook
 * Events:
 *   checkout.session.completed
 *   invoice.paid
 *   invoice.upcoming
 *   invoice.payment_failed
 *   payment_intent.payment_failed
 *   customer.subscription.updated
 *   customer.subscription.deleted
 * Env (names only): STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY
 */

const crypto = require('crypto');
const { findByEmail, findById, findByStripeCustomerId, updateStripe } = require('./accounts');
const { emailsEquivalent, isHoldStatus, normalizePaidPlan, normalizeStatus } = require('./auth');
const { planForPriceId } = require('./stripe-plans');

/**
 * Paid Checkout that never received client_reference_id. Attach only to this
 * existing PLAIGROUND row (Gmail-equivalent). Do not create an account and
 * do not apply this customer to any other email.
 */
const LINKED_PAID_CHECKOUTS = [
  {
    sessionId: 'cs_live_a1xv6w0TBRZiHO8VYfpixiiqOj3pM7aDKLRdsJK8SHiwi2HuEsgPln4xxC',
    customerId: 'cus_V84DhHyT0cfpso',
    email: 'victoriaimtanes@gmail.com',
  },
];

const STRIPE_API_VERSION = '2026-07-29.dahlia';
const SIGNATURE_TOLERANCE_SEC = 300;
const BASIC_SUB_STATUSES = {
  canceled: true,
};

const LIVE_SUB_STATUSES = {
  active: true,
  past_due: true,
  unpaid: true,
  trialing: true,
  paused: true,
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

function pushEmail(value, out) {
  const email = String(value || '').trim();
  if (!email || out.indexOf(email) !== -1) return;
  out.push(email);
}

function sessionIdOf(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (obj.object === 'checkout.session' && obj.id) return String(obj.id);
  if (typeof obj.id === 'string' && obj.id.indexOf('cs_') === 0) return obj.id;
  const meta = metadataOf(obj);
  return String(meta.checkout_session_id || meta.session_id || '').trim();
}

function collectUserHints(obj) {
  const meta = metadataOf(obj);
  const details = obj && obj.customer_details && typeof obj.customer_details === 'object'
    ? obj.customer_details
    : {};
  const emails = [];
  pushEmail(obj && (obj.customer_email || obj.email), emails);
  pushEmail(details.email, emails);
  pushEmail(meta.email, emails);
  pushEmail(meta.plaiground_email, emails);
  return {
    userId: String(
      (obj && obj.client_reference_id) || meta.userId || meta.user_id || ''
    ).trim(),
    email: emails[0] || '',
    emails,
    customerId: customerIdOf(obj),
    sessionId: sessionIdOf(obj),
  };
}

function linkedPaidCheckout(hints) {
  const sessionId = String((hints && hints.sessionId) || '').trim();
  const customerId = String((hints && hints.customerId) || '').trim();
  for (let i = 0; i < LINKED_PAID_CHECKOUTS.length; i += 1) {
    const link = LINKED_PAID_CHECKOUTS[i];
    if (sessionId && sessionId === link.sessionId) return link;
    if (customerId && customerId === link.customerId) return link;
  }
  return null;
}

function linkedSessionForEmail(email) {
  for (let i = 0; i < LINKED_PAID_CHECKOUTS.length; i += 1) {
    if (emailsEquivalent(email, LINKED_PAID_CHECKOUTS[i].email)) {
      return LINKED_PAID_CHECKOUTS[i].sessionId;
    }
  }
  return '';
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
      method: 'GET',
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

async function readLiveSubscription(customerId, retrieve) {
  const id = String(customerId || '').trim();
  if (!id || id.indexOf('cus_') !== 0) {
    return { stripe: 'no', live: false };
  }
  const fetchObj = typeof retrieve === 'function' ? retrieve : defaultRetrieve;
  let list;
  try {
    list = await fetchObj('subscriptions?customer=' + encodeURIComponent(id) + '&limit=10');
  } catch {
    return { stripe: 'unknown', live: false };
  }
  if (!list || typeof list !== 'object' || list.error) {
    return { stripe: 'unknown', live: false };
  }
  const rows = Array.isArray(list.data) ? list.data : [];
  const live = rows.some((sub) => sub && LIVE_SUB_STATUSES[String(sub.status || '')]);
  return { stripe: live ? 'yes' : 'no', live };
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

async function findLinkedPaidAccount(hints) {
  const link = linkedPaidCheckout(hints);
  if (!link) return null;
  return findByEmail(link.email);
}

async function findUserFromHints(hints) {
  if (hints.userId) {
    const byId = await findById(hints.userId);
    if (byId) return byId;
  }
  const linked = await findLinkedPaidAccount(hints);
  if (linked) return linked;
  if (hints.customerId) {
    const byCustomer = await findByStripeCustomerId(hints.customerId);
    if (byCustomer) return byCustomer;
  }
  const emails = hints.emails && hints.emails.length
    ? hints.emails
    : (hints.email ? [hints.email] : []);
  for (let i = 0; i < emails.length; i += 1) {
    const byEmail = await findByEmail(emails[i]);
    if (byEmail) return byEmail;
  }
  return null;
}

async function applyPaidSessionToAccount(sessionId, user, retrieve) {
  const id = String(sessionId || '').trim();
  if (!id || !user || !user.id) return { applied: false, reason: 'no_user' };
  const fetchObj = typeof retrieve === 'function' ? retrieve : defaultRetrieve;
  const session = await fetchObj('checkout/sessions/' + id, ['line_items']);
  if (!session || typeof session !== 'object') return { applied: false, reason: 'no_session' };
  if (String(session.payment_status || '') !== 'paid') {
    return { applied: false, reason: 'unpaid' };
  }
  const plan = await resolvePaidPlan(session, fetchObj);
  if (!plan) return { applied: false, reason: 'unknown_price' };
  const next = await updateStripe(user.id, {
    plan,
    status: 'active',
    sessionId: session.id || id,
    customerId: customerIdOf(session),
  });
  return {
    applied: true,
    plan,
    status: 'active',
    userId: user.id,
    email: next && next.email,
    row: next,
  };
}

async function recoverPaidPlan(row, retrieve) {
  if (!row) return row;
  if (normalizePaidPlan(row.plan, row.email)) return row;
  const sessionId = String(row.stripe_session_id || '').trim() || linkedSessionForEmail(row.email);
  if (!sessionId) return row;
  const result = await applyPaidSessionToAccount(sessionId, row, retrieve);
  return result.row || row;
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

function asUnix(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return n > 1e12 ? Math.floor(n / 1000) : n;
  }
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

function pushUnix(value, out) {
  const unix = asUnix(value);
  if (unix != null) out.push(unix);
}

function periodEndUnix(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const found = [];
  pushUnix(obj.period_end, found);
  pushUnix(obj.current_period_end, found);
  const bags = [];
  ['lines', 'items'].forEach((key) => {
    const bag = obj[key];
    if (Array.isArray(bag)) bags.push(bag);
    else if (bag && Array.isArray(bag.data)) bags.push(bag.data);
  });
  bags.forEach((rows) => {
    rows.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      if (item.period) pushUnix(item.period.end, found);
      pushUnix(item.current_period_end, found);
    });
  });
  if (obj.parent && obj.parent.subscription_details) {
    pushUnix(obj.parent.subscription_details.current_period_end, found);
  }
  return found.length ? Math.max.apply(null, found) : null;
}

function failedPayStatus(obj, nowSec) {
  const end = periodEndUnix(obj);
  const now = nowSec != null ? nowSec : Math.floor(Date.now() / 1000);
  if (end != null && now >= end) return 'hold';
  return 'warning';
}

async function writePaidStatus(obj, status) {
  const nextStatus = normalizeStatus(status);
  if (nextStatus !== 'warning' && nextStatus !== 'hold') {
    return { applied: false, reason: 'bad_status' };
  }
  const hints = collectUserHints(obj);
  const user = await findUserFromHints(hints);
  if (!user) return { applied: false, reason: 'no_user' };
  if (user.plan !== 'creator' && user.plan !== 'pro') {
    return { applied: false, reason: 'not_paid' };
  }
  if (isHoldStatus(user.status) && nextStatus === 'warning') {
    return { applied: true, plan: user.plan, status: 'hold', userId: user.id };
  }
  if (normalizeStatus(user.status) === nextStatus) {
    return { applied: true, plan: user.plan, status: nextStatus, userId: user.id };
  }
  const next = await updateStripe(user.id, {
    status: nextStatus,
    customerId: hints.customerId,
  });
  return {
    applied: true,
    plan: next && next.plan,
    status: nextStatus,
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
  const nowSec = options && options.nowSec != null ? options.nowSec : Math.floor(Date.now() / 1000);

  if (type === 'invoice.upcoming') {
    return { applied: false, reason: 'upcoming' };
  }

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
    return writePaidStatus(obj, failedPayStatus(obj, nowSec));
  }

  if (type === 'customer.subscription.updated') {
    const status = String(obj.status || '');
    if (BASIC_SUB_STATUSES[status]) {
      return writePlan(obj, 'basic', { customerId: customerIdOf(obj), status: 'active' });
    }
    if (status === 'unpaid') {
      return writePaidStatus(obj, 'hold');
    }
    if (status === 'past_due') {
      return writePaidStatus(obj, 'warning');
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
  applyPaidSessionToAccount,
  applyStripeEvent,
  collectPriceIds,
  collectUserHints,
  failedPayStatus,
  periodEndUnix,
  planFromPriceIds,
  readLiveSubscription,
  recoverPaidPlan,
  resolvePaidPlan,
  signStripePayload,
  verifyStripeSignature,
  webhookSecret,
};
