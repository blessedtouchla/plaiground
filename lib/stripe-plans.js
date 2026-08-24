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
  LEGACY_CREATOR_YEAR_PRICE,
  LEGACY_PRO_YEAR_PRICE,
  PLAN_BY_PRICE,
  PRICE_BY_PLAN,
  intervalForPriceId,
  planForPriceId,
  planMetaForPrice,
};
