'use strict';

/**
 * Existing live Stripe prices on PLAIGROUND LLC (acct_1U6k4V47ejpgV1Ch).
 * Do not create products or prices. Do not invent IDs. Do not archive prices here.
 *
 * Creator (prod_V6yAuvAiyZV8Jn):
 *   month $14.99  price_1U6kDm47ejpgV1ChUQ7V937J
 *   year  $149    price_1U6kE547ejpgV1Chb6vtfjju
 * Pro (prod_V6yA0MmLFSeetg):
 *   month $19.99  price_1U6kDz47ejpgV1ChuxQ7yZ86
 *   year  display $199 — no live $199 price id yet.
 *   Do not send new checkouts to old Pro yearly $149
 *   price_1U6kE647ejpgV1ChsovROe7H. That id stays mapped for
 *   existing subscriptions / webhooks only.
 */

const LEGACY_PRO_YEAR_PRICE = 'price_1U6kE647ejpgV1ChsovROe7H';

const PRICE_BY_PLAN = {
  'creator:month': 'price_1U6kDm47ejpgV1ChUQ7V937J',
  'creator:year': 'price_1U6kE547ejpgV1Chb6vtfjju',
  'pro:month': 'price_1U6kDz47ejpgV1ChuxQ7yZ86',
};

const PLAN_BY_PRICE = {};
const INTERVAL_BY_PRICE = {};
Object.keys(PRICE_BY_PLAN).forEach((key) => {
  const parts = key.split(':');
  PLAN_BY_PRICE[PRICE_BY_PLAN[key]] = parts[0];
  INTERVAL_BY_PRICE[PRICE_BY_PLAN[key]] = parts[1];
});
PLAN_BY_PRICE[LEGACY_PRO_YEAR_PRICE] = 'pro';
INTERVAL_BY_PRICE[LEGACY_PRO_YEAR_PRICE] = 'year';

const ALLOWED_PRICE_IDS = new Set(Object.values(PRICE_BY_PLAN));

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

function checkoutUnavailableReason(plan, interval) {
  if (plan === 'pro' && interval === 'year') {
    return 'Pro yearly checkout is not available yet. Monthly still works.';
  }
  return '';
}

module.exports = {
  ALLOWED_PRICE_IDS,
  INTERVAL_BY_PRICE,
  LEGACY_PRO_YEAR_PRICE,
  PLAN_BY_PRICE,
  PRICE_BY_PLAN,
  checkoutUnavailableReason,
  intervalForPriceId,
  planForPriceId,
  planMetaForPrice,
};
