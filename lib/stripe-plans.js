'use strict';

/**
 * Existing live Stripe prices on PLAIGROUND LLC (acct_1U6k4V47ejpgV1Ch).
 * Do not create products or prices. Do not invent IDs. Do not archive prices here.
 *
 * New Checkout Sessions (only these four):
 *   Creator month $14.99  price_1U6kDm47ejpgV1ChUQ7V937J  prod_V6yAuvAiyZV8Jn
 *   Creator year  $149    price_1U7nE647ejpgV1ChOARh5tC3  prod_V83KtcIQcKaCn4
 *   Pro month     $19.99  price_1U6kDz47ejpgV1ChuxQ7yZ86  prod_V6yA0MmLFSeetg
 *   Pro year      $199    price_1U7nDG47ejpgV1ChqpY9Swvb  prod_V83JukLyqvB9CN
 *
 * Webhook-only (do not send on new checkout):
 *   old Creator year $149  price_1U6kE547ejpgV1Chb6vtfjju
 *   old Pro year     $149  price_1U6kE647ejpgV1ChsovROe7H
 */

const LEGACY_CREATOR_YEAR_PRICE = 'price_1U6kE547ejpgV1Chb6vtfjju';
const LEGACY_PRO_YEAR_PRICE = 'price_1U6kE647ejpgV1ChsovROe7H';

const PRICE_BY_PLAN = {
  'creator:month': 'price_1U6kDm47ejpgV1ChUQ7V937J',
  'creator:year': 'price_1U7nE647ejpgV1ChOARh5tC3',
  'pro:month': 'price_1U6kDz47ejpgV1ChuxQ7yZ86',
  'pro:year': 'price_1U7nDG47ejpgV1ChqpY9Swvb',
};

const PLAN_BY_PRICE = {};
const INTERVAL_BY_PRICE = {};
Object.keys(PRICE_BY_PLAN).forEach((key) => {
  const parts = key.split(':');
  PLAN_BY_PRICE[PRICE_BY_PLAN[key]] = parts[0];
  INTERVAL_BY_PRICE[PRICE_BY_PLAN[key]] = parts[1];
});
PLAN_BY_PRICE[LEGACY_CREATOR_YEAR_PRICE] = 'creator';
INTERVAL_BY_PRICE[LEGACY_CREATOR_YEAR_PRICE] = 'year';
PLAN_BY_PRICE[LEGACY_PRO_YEAR_PRICE] = 'pro';
INTERVAL_BY_PRICE[LEGACY_PRO_YEAR_PRICE] = 'year';

const ALLOWED_PRICE_IDS = new Set(Object.values(PRICE_BY_PLAN));

const AMOUNT_BY_PRICE = {
  'price_1U6kDm47ejpgV1ChUQ7V937J': 1499,
  'price_1U7nE647ejpgV1ChOARh5tC3': 14900,
  'price_1U6kDz47ejpgV1ChuxQ7yZ86': 1999,
  'price_1U7nDG47ejpgV1ChqpY9Swvb': 19900,
};
AMOUNT_BY_PRICE[LEGACY_CREATOR_YEAR_PRICE] = 14900;
AMOUNT_BY_PRICE[LEGACY_PRO_YEAR_PRICE] = 14900;

const PLAN_PITCH = {
  creator: 'Creator · $14.99/month or $12.42/month billed yearly',
  pro: 'Pro · $19.99/month or $16.58/month billed yearly',
  basic: 'Basic · $0 forever',
};

const PLAN_DETAIL = {
  creator: 'Creator is Basic with the paid features unlocked. 8 distribution uploads and 8 publishing registrations this UTC month, counted separately. Pro unlocks unlimited.',
  pro: 'Same product as Creator, unlimited, plus catalog migration. Unlimited distribution uploads and publishing registrations.',
  basic: 'One release for the life of the account. Canceling a paid plan drops you here.',
};

function planForPriceId(priceId) {
  const plan = PLAN_BY_PRICE[String(priceId || '').trim()];
  return plan === 'creator' || plan === 'pro' ? plan : null;
}

function intervalForPriceId(priceId) {
  return INTERVAL_BY_PRICE[String(priceId || '').trim()] || '';
}

function planMetaForPrice(priceId) {
  const plan = planForPriceId(priceId);
  if (!plan) return { plan: '', interval: '' };
  return { plan, interval: intervalForPriceId(priceId) };
}

function amountForPriceId(priceId) {
  const n = AMOUNT_BY_PRICE[String(priceId || '').trim()];
  return Number.isFinite(n) ? n : null;
}

function planPitch(plan, interval) {
  const next = String(plan || '').trim().toLowerCase();
  const billed = String(interval || '').trim().toLowerCase();
  if (next === 'creator' && billed === 'month') return 'Creator · $14.99/month';
  if (next === 'creator' && billed === 'year') return 'Creator · $12.42/month billed yearly';
  if (next === 'pro' && billed === 'month') return 'Pro · $19.99/month';
  if (next === 'pro' && billed === 'year') return 'Pro · $16.58/month billed yearly';
  return PLAN_PITCH[next] || 'Your plan';
}

/**
 * Customer Portal has one subscription_update.proration_behavior for every
 * change, so it cannot charge an upgrade now and skip credit on a downgrade.
 * Use Subscriptions API update with a per-change value instead.
 *
 * always_invoice — new amount is higher: prorate and charge the difference now.
 * none — new amount is lower or equal: apply the price now, no credit/refund.
 */
function prorationBehaviorForChange(fromPriceId, toPriceId) {
  if (String(fromPriceId || '').trim() === String(toPriceId || '').trim()) return null;
  const from = amountForPriceId(fromPriceId);
  const to = amountForPriceId(toPriceId);
  if (from == null || to == null) return 'always_invoice';
  return to > from ? 'always_invoice' : 'none';
}

module.exports = {
  ALLOWED_PRICE_IDS,
  AMOUNT_BY_PRICE,
  INTERVAL_BY_PRICE,
  LEGACY_CREATOR_YEAR_PRICE,
  LEGACY_PRO_YEAR_PRICE,
  PLAN_BY_PRICE,
  PLAN_DETAIL,
  PLAN_PITCH,
  PRICE_BY_PLAN,
  amountForPriceId,
  intervalForPriceId,
  planForPriceId,
  planMetaForPrice,
  planPitch,
  prorationBehaviorForChange,
};
