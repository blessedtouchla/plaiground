'use strict';

/**
 * Existing live Stripe prices on PLAIGROUND LLC (acct_1U6k4V47ejpgV1Ch).
 * Do not create products or prices. Do not invent IDs.
 *
 * Creator (prod_V6yAuvAiyZV8Jn):
 *   month $14.99  price_1U6kDm47ejpgV1ChUQ7V937J
 *   year  $149    price_1U6kE547ejpgV1Chb6vtfjju
 * Pro (prod_V6yA0MmLFSeetg):
 *   month $19.99  price_1U6kDz47ejpgV1ChuxQ7yZ86
 *   year  $149    price_1U6kE647ejpgV1ChsovROe7H
 */

const PRICE_BY_PLAN = {
  'creator:month': 'price_1U6kDm47ejpgV1ChUQ7V937J',
  'creator:year': 'price_1U6kE547ejpgV1Chb6vtfjju',
  'pro:month': 'price_1U6kDz47ejpgV1ChuxQ7yZ86',
  'pro:year': 'price_1U6kE647ejpgV1ChsovROe7H',
};

const PLAN_BY_PRICE = {};
const INTERVAL_BY_PRICE = {};
Object.keys(PRICE_BY_PLAN).forEach((key) => {
  const parts = key.split(':');
  PLAN_BY_PRICE[PRICE_BY_PLAN[key]] = parts[0];
  INTERVAL_BY_PRICE[PRICE_BY_PLAN[key]] = parts[1];
});

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

module.exports = {
  ALLOWED_PRICE_IDS,
  INTERVAL_BY_PRICE,
  PLAN_BY_PRICE,
  PRICE_BY_PLAN,
  intervalForPriceId,
  planForPriceId,
  planMetaForPrice,
};
