'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const authApi = require('../api/auth');
const checkoutApi = require('../api/create-checkout-session');
const { PRICE_BY_PLAN, planForPriceId } = require('./stripe-plans');
const { applyStripeEvent, signStripePayload, verifyStripeSignature } = require('./stripe-webhook');

const CREATOR_MONTH = PRICE_BY_PLAN['creator:month'];
const CREATOR_YEAR = PRICE_BY_PLAN['creator:year'];
const PRO_MONTH = PRICE_BY_PLAN['pro:month'];
const PRO_YEAR = PRICE_BY_PLAN['pro:year'];
const WEBHOOK_SECRET = 'unit-test-webhook-secret';
const STRIPE_SECRET = 'unit-test-stripe-secret';
const SESSION_SECRET = 'unit-test-session-secret';

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(chunk) {
      this.body = chunk == null ? '' : String(chunk);
    },
  };
}

function json(res) {
  return JSON.parse(res.body || '{}');
}

function cookieFrom(res) {
  return String(res.headers['Set-Cookie'] || '').split(';')[0];
}

async function withEnv(env, fn) {
  const keys = ['DATABASE_URL', 'SESSION_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
  const prev = {};
  keys.forEach((key) => {
    prev[key] = process.env[key];
  });
  keys.forEach((key) => {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  });
  accounts.resetStore();
  if (env.memory) accounts.useMemoryStore();
  try {
    await fn();
  } finally {
    accounts.resetStore();
    keys.forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  }
}

async function signupUser(email, plan) {
  const res = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/signup',
    headers: {},
    body: { email, password: 'password1', artist: 'Ada Night', plan: plan || 'basic' },
  }, res);
  assert.strictEqual(res.statusCode, 200, res.body);
  const row = await accounts.findByEmail(email);
  return { cookie: cookieFrom(res), user: row };
}

function event(type, object) {
  return { id: 'evt_unit', type, data: { object } };
}

async function run() {
  assert.strictEqual(planForPriceId(CREATOR_MONTH), 'creator');
  assert.strictEqual(planForPriceId(CREATOR_YEAR), 'creator');
  assert.strictEqual(planForPriceId(PRO_MONTH), 'pro');
  assert.strictEqual(planForPriceId(PRO_YEAR), 'pro');
  assert.strictEqual(planForPriceId('price_not_ours'), null);

  const now = Math.floor(Date.now() / 1000);
  const raw = '{"ok":true}';
  const good = signStripePayload(raw, WEBHOOK_SECRET, now);
  assert.strictEqual(verifyStripeSignature(raw, 't=' + now + ',v1=' + good, WEBHOOK_SECRET, now).ok, true);
  assert.strictEqual(verifyStripeSignature(raw, 't=' + now + ',v1=deadbeef', WEBHOOK_SECRET, now).ok, false);
  assert.strictEqual(verifyStripeSignature(raw, 't=' + (now - 400) + ',v1=' + good, WEBHOOK_SECRET, now).ok, false);

  await withEnv({
    DATABASE_URL: 'postgres://memory',
    SESSION_SECRET,
    STRIPE_SECRET_KEY: STRIPE_SECRET,
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    memory: true,
  }, async () => {
    const created = await signupUser('ada@example.com', 'basic');
    const userId = created.user.id;

    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, opts) => {
      calls.push({ url: String(url), opts });
      return {
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_unit' }),
      };
    };
    try {
      const monthRes = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: created.cookie },
        body: { plan: 'creator' },
      }, monthRes);
      assert.strictEqual(monthRes.statusCode, 200);
      assert.strictEqual(json(monthRes).url.indexOf('https://checkout.stripe.com/') === 0, true);
      const monthParams = new URLSearchParams(calls[0].opts.body);
      assert.strictEqual(monthParams.get('mode'), 'subscription');
      assert.strictEqual(monthParams.get('line_items[0][price]'), CREATOR_MONTH);
      assert.strictEqual(monthParams.get('client_reference_id'), userId);
      assert.strictEqual(monthParams.get('metadata[userId]'), userId);
      assert.strictEqual(monthParams.get('subscription_data[metadata][userId]'), userId);
      assert.strictEqual(monthParams.get('customer_email'), 'ada@example.com');

      const yearRes = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: {},
        body: { plan: 'pro', interval: 'year' },
      }, yearRes);
      assert.strictEqual(yearRes.statusCode, 200);
      const yearParams = new URLSearchParams(calls[1].opts.body);
      assert.strictEqual(yearParams.get('mode'), 'subscription');
      assert.strictEqual(yearParams.get('line_items[0][price]'), PRO_YEAR);

      const allPrices = [CREATOR_MONTH, CREATOR_YEAR, PRO_MONTH, PRO_YEAR];
      for (let i = 0; i < allPrices.length; i += 1) {
        const priced = mockRes();
        await checkoutApi({
          method: 'POST',
          url: '/api/create-checkout-session',
          headers: {},
          body: { priceId: allPrices[i] },
        }, priced);
        assert.strictEqual(priced.statusCode, 200, allPrices[i]);
      }

      const rejected = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: {},
        body: { priceId: 'price_not_ours' },
      }, rejected);
      assert.strictEqual(rejected.statusCode, 400);
    } finally {
      global.fetch = originalFetch;
    }

    const unpaid = await applyStripeEvent(event('checkout.session.completed', {
      id: 'cs_unpaid',
      payment_status: 'unpaid',
      client_reference_id: userId,
      metadata: { plan: 'pro' },
      line_items: { data: [{ price: { id: PRO_MONTH } }] },
    }));
    assert.strictEqual(unpaid.applied, false);
    assert.strictEqual((await accounts.findById(userId)).plan, 'basic');

    const unknown = await applyStripeEvent(event('checkout.session.completed', {
      id: 'cs_unknown',
      payment_status: 'paid',
      client_reference_id: userId,
      line_items: { data: [{ price: { id: 'price_someone_else' } }] },
    }));
    assert.strictEqual(unknown.applied, false);
    assert.strictEqual((await accounts.findById(userId)).plan, 'basic');

    const monthly = await applyStripeEvent(event('checkout.session.completed', {
      id: 'cs_creator_month',
      payment_status: 'paid',
      client_reference_id: userId,
      customer: 'cus_ada',
      line_items: { data: [{ price: { id: CREATOR_MONTH } }] },
    }));
    assert.strictEqual(monthly.applied, true);
    assert.strictEqual(monthly.plan, 'creator');
    let row = await accounts.findById(userId);
    assert.strictEqual(row.plan, 'creator');
    assert.strictEqual(row.stripe_customer_id, 'cus_ada');
    assert.strictEqual(row.stripe_session_id, 'cs_creator_month');

    const again = await applyStripeEvent(event('checkout.session.completed', {
      id: 'cs_creator_month',
      payment_status: 'paid',
      client_reference_id: userId,
      customer: 'cus_ada',
      line_items: { data: [{ price: { id: CREATOR_MONTH } }] },
    }));
    assert.strictEqual(again.applied, true);
    assert.strictEqual((await accounts.findById(userId)).plan, 'creator');

    const yearly = await applyStripeEvent(event('invoice.paid', {
      paid: true,
      amount_paid: 14900,
      customer: 'cus_ada',
      customer_email: 'ada@example.com',
      lines: { data: [{ pricing: { price_details: { price: PRO_YEAR } } }] },
    }));
    assert.strictEqual(yearly.applied, true);
    assert.strictEqual(yearly.plan, 'pro');
    assert.strictEqual((await accounts.findById(userId)).plan, 'pro');

    const metadataUser = await signupUser('meta@example.com', 'basic');
    const fromMeta = await applyStripeEvent(event('customer.subscription.updated', {
      status: 'active',
      customer: 'cus_meta',
      metadata: { userId: metadataUser.user.id },
      items: { data: [{ price: { id: CREATOR_YEAR } }] },
    }));
    assert.strictEqual(fromMeta.applied, true);
    assert.strictEqual((await accounts.findById(metadataUser.user.id)).plan, 'creator');

    const emailUser = await signupUser('email@example.com', 'basic');
    const fromEmail = await applyStripeEvent(event('checkout.session.completed', {
      id: 'cs_email',
      payment_status: 'paid',
      customer_details: { email: 'email@example.com' },
      line_items: { data: [{ price: { id: PRO_MONTH } }] },
    }));
    assert.strictEqual(fromEmail.applied, true);
    assert.strictEqual((await accounts.findByEmail('email@example.com')).plan, 'pro');
    assert.ok(emailUser.user.id);

    const pastDue = await applyStripeEvent(event('customer.subscription.updated', {
      status: 'past_due',
      customer: 'cus_ada',
      items: { data: [{ price: { id: PRO_YEAR } }] },
    }));
    assert.strictEqual(pastDue.applied, false);
    assert.strictEqual((await accounts.findById(userId)).plan, 'pro');

    const canceled = await applyStripeEvent(event('customer.subscription.updated', {
      status: 'canceled',
      customer: 'cus_ada',
    }));
    assert.strictEqual(canceled.applied, true);
    assert.strictEqual(canceled.plan, 'basic');
    assert.strictEqual((await accounts.findById(userId)).plan, 'basic');

    await applyStripeEvent(event('invoice.paid', {
      paid: true,
      amount_paid: 1999,
      customer: 'cus_ada',
      lines: { data: [{ price: { id: PRO_MONTH } }] },
    }));
    assert.strictEqual((await accounts.findById(userId)).plan, 'pro');

    const deleted = await applyStripeEvent(event('customer.subscription.deleted', {
      customer: 'cus_ada',
      metadata: { userId },
    }));
    assert.strictEqual(deleted.applied, true);
    assert.strictEqual((await accounts.findById(userId)).plan, 'basic');

    const ghost = await applyStripeEvent(event('checkout.session.completed', {
      id: 'cs_ghost',
      payment_status: 'paid',
      customer_email: 'nobody@example.com',
      line_items: { data: [{ price: { id: CREATOR_MONTH } }] },
    }));
    assert.strictEqual(ghost.applied, false);

    const missingSecret = mockRes();
    const prevWebhook = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await checkoutApi({
      method: 'POST',
      url: '/api/stripe/webhook',
      headers: { 'stripe-signature': 't=1,v1=nope' },
      body: '{}',
    }, missingSecret);
    process.env.STRIPE_WEBHOOK_SECRET = prevWebhook;
    assert.strictEqual(missingSecret.statusCode, 503);

    const badSig = mockRes();
    await checkoutApi({
      method: 'POST',
      url: '/api/stripe/webhook',
      query: { action: 'webhook' },
      headers: { 'stripe-signature': 't=' + now + ',v1=nope' },
      body: JSON.stringify(event('checkout.session.completed', { payment_status: 'paid' })),
    }, badSig);
    assert.strictEqual(badSig.statusCode, 400);

    const paidBody = JSON.stringify(event('checkout.session.completed', {
      id: 'cs_http',
      payment_status: 'paid',
      client_reference_id: userId,
      customer: 'cus_ada',
      line_items: { data: [{ price: { id: CREATOR_MONTH } }] },
    }));
    const ts = Math.floor(Date.now() / 1000);
    const okSig = mockRes();
    await checkoutApi({
      method: 'POST',
      url: '/api/stripe/webhook',
      headers: { 'stripe-signature': 't=' + ts + ',v1=' + signStripePayload(paidBody, WEBHOOK_SECRET, ts) },
      body: paidBody,
    }, okSig);
    assert.strictEqual(okSig.statusCode, 200);
    assert.strictEqual(json(okSig).received, true);
    assert.strictEqual((await accounts.findById(userId)).plan, 'creator');
  });

  const checkoutJs = fs.readFileSync(path.join(__dirname, '..', 'checkout.js'), 'utf8');
  assert.ok(checkoutJs.includes("|| 'month'"));

  const handlerSrc = fs.readFileSync(path.join(__dirname, '..', 'api/create-checkout-session.js'), 'utf8');
  assert.ok(handlerSrc.includes('https://wannaplai.com/api/stripe/webhook'));
  assert.ok(handlerSrc.includes('STRIPE_WEBHOOK_SECRET'));
  assert.ok(handlerSrc.includes('checkout.session.completed'));
  assert.ok(handlerSrc.includes('customer.subscription.deleted'));
  assert.ok(!/sk_live_|sk_test_|whsec_/.test(handlerSrc));

  console.log('stripe-webhook.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
