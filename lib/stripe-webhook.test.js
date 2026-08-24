'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const authApi = require('../api/auth');
const checkoutApi = require('../api/create-checkout-session');
const { LEGACY_CREATOR_YEAR_PRICE, LEGACY_PRO_YEAR_PRICE, PRICE_BY_PLAN, planForPriceId, prorationBehaviorForChange } = require('./stripe-plans');
const { applyPaidSessionToAccount, applyStripeEvent, recoverPaidPlan, signStripePayload, verifyStripeSignature } = require('./stripe-webhook');
const meApi = require('../api/me');

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
  await accounts.confirmEmail(email);
  const loginRes = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/login',
    headers: {},
    body: { email, password: 'password1' },
  }, loginRes);
  assert.strictEqual(loginRes.statusCode, 200, loginRes.body);
  const row = await accounts.findByEmail(email);
  return { cookie: cookieFrom(loginRes), user: row };
}

function event(type, object) {
  return { id: 'evt_unit', type, data: { object } };
}

async function run() {
  assert.strictEqual(planForPriceId(CREATOR_MONTH), 'creator');
  assert.strictEqual(planForPriceId(CREATOR_YEAR), 'creator');
  assert.strictEqual(planForPriceId(PRO_MONTH), 'pro');
  assert.strictEqual(planForPriceId(PRO_YEAR), 'pro');
  assert.strictEqual(CREATOR_YEAR, 'price_1U7nE647ejpgV1ChOARh5tC3');
  assert.strictEqual(PRO_YEAR, 'price_1U7nDG47ejpgV1ChqpY9Swvb');
  assert.strictEqual(planForPriceId(LEGACY_CREATOR_YEAR_PRICE), 'creator');
  assert.strictEqual(planForPriceId(LEGACY_PRO_YEAR_PRICE), 'pro');
  assert.strictEqual(planForPriceId('price_not_ours'), null);
  assert.strictEqual(prorationBehaviorForChange(CREATOR_MONTH, PRO_MONTH), 'always_invoice');
  assert.strictEqual(prorationBehaviorForChange(CREATOR_MONTH, CREATOR_YEAR), 'always_invoice');
  assert.strictEqual(prorationBehaviorForChange(PRO_MONTH, CREATOR_MONTH), 'none');
  assert.strictEqual(prorationBehaviorForChange(PRO_YEAR, CREATOR_MONTH), 'none');
  assert.strictEqual(prorationBehaviorForChange(CREATOR_MONTH, CREATOR_MONTH), null);

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
      assert.strictEqual(monthParams.get('subscription_data[collection_method]'), null);
      assert.strictEqual(monthParams.get('customer_email'), 'ada@example.com');
      assert.strictEqual(monthParams.get('metadata[email]'), 'ada@example.com');
      assert.strictEqual(monthParams.get('subscription_data[metadata][email]'), 'ada@example.com');

      const signedOut = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: {},
        body: { plan: 'creator', interval: 'year' },
      }, signedOut);
      assert.strictEqual(signedOut.statusCode, 401);
      assert.strictEqual(calls.length, 1, 'logged-out checkout must not create a Stripe session');

      const yearRes = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: created.cookie },
        body: { plan: 'creator', interval: 'year' },
      }, yearRes);
      assert.strictEqual(yearRes.statusCode, 200);
      const yearParams = new URLSearchParams(calls[1].opts.body);
      assert.strictEqual(yearParams.get('mode'), 'subscription');
      assert.strictEqual(yearParams.get('subscription_data[collection_method]'), null);
      assert.strictEqual(yearParams.get('line_items[0][price]'), CREATOR_YEAR);
      assert.strictEqual(yearParams.get('client_reference_id'), userId);
      assert.strictEqual(yearParams.get('metadata[email]'), 'ada@example.com');

      const proYearRes = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: created.cookie },
        body: { plan: 'pro', interval: 'year' },
      }, proYearRes);
      assert.strictEqual(proYearRes.statusCode, 200);
      const proYearParams = new URLSearchParams(calls[2].opts.body);
      assert.strictEqual(proYearParams.get('line_items[0][price]'), PRO_YEAR);
      assert.strictEqual(proYearParams.get('client_reference_id'), userId);

      const legacyCreatorYear = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: {},
        body: { priceId: LEGACY_CREATOR_YEAR_PRICE },
      }, legacyCreatorYear);
      assert.strictEqual(legacyCreatorYear.statusCode, 400, 'old Creator yearly is not a new checkout');

      const legacyProYear = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: {},
        body: { priceId: LEGACY_PRO_YEAR_PRICE },
      }, legacyProYear);
      assert.strictEqual(legacyProYear.statusCode, 400, 'old Pro yearly is not a new checkout');

      const allPrices = [CREATOR_MONTH, CREATOR_YEAR, PRO_MONTH, PRO_YEAR];
      for (let i = 0; i < allPrices.length; i += 1) {
        const priced = mockRes();
        await checkoutApi({
          method: 'POST',
          url: '/api/create-checkout-session',
          headers: { cookie: created.cookie },
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
      amount_paid: 19900,
      customer: 'cus_ada',
      customer_email: 'ada@example.com',
      lines: { data: [{ pricing: { price_details: { price: PRO_YEAR } } }] },
    }));
    assert.strictEqual(yearly.applied, true);
    assert.strictEqual(yearly.plan, 'pro');
    assert.strictEqual((await accounts.findById(userId)).plan, 'pro');

    const legacyYearly = await applyStripeEvent(event('invoice.paid', {
      paid: true,
      amount_paid: 14900,
      customer: 'cus_ada',
      lines: { data: [{ pricing: { price_details: { price: LEGACY_PRO_YEAR_PRICE } } }] },
    }));
    assert.strictEqual(legacyYearly.applied, true);
    assert.strictEqual(legacyYearly.plan, 'pro');

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

    const gmailUser = await signupUser('ceo.dots@gmail.com', 'basic');
    const aliasPaid = await applyStripeEvent(event('checkout.session.completed', {
      id: 'cs_gmail_alias',
      payment_status: 'paid',
      customer: 'cus_gmail_alias',
      customer_details: { email: 'ceodots+vip@gmail.com' },
      line_items: { data: [{ price: { id: CREATOR_MONTH } }] },
    }));
    assert.strictEqual(aliasPaid.applied, true);
    const sameGmail = await accounts.findByEmail('ceo.dots@gmail.com');
    assert.strictEqual(sameGmail.id, gmailUser.user.id);
    assert.strictEqual(sameGmail.plan, 'creator');
    assert.strictEqual(sameGmail.stripe_customer_id, 'cus_gmail_alias');
    assert.strictEqual((await accounts.findByEmail('ceodots@gmail.com')).id, gmailUser.user.id);

    const upcoming = await applyStripeEvent(event('invoice.upcoming', {
      customer: 'cus_ada',
      period_end: now + (7 * 24 * 60 * 60),
    }));
    assert.strictEqual(upcoming.applied, false);
    assert.strictEqual(upcoming.reason, 'upcoming');
    assert.strictEqual((await accounts.findById(userId)).plan, 'pro');
    assert.strictEqual((await accounts.findById(userId)).status, 'active');

    const pastDue = await applyStripeEvent(event('customer.subscription.updated', {
      status: 'past_due',
      customer: 'cus_ada',
      items: { data: [{ price: { id: PRO_YEAR } }] },
    }));
    assert.strictEqual(pastDue.applied, true);
    assert.strictEqual(pastDue.status, 'warning');
    row = await accounts.findById(userId);
    assert.strictEqual(row.plan, 'pro');
    assert.strictEqual(row.status, 'warning');

    const failedBeforeEnd = await applyStripeEvent(event('invoice.payment_failed', {
      customer: 'cus_ada',
      paid: false,
      period_end: now + (7 * 24 * 60 * 60),
    }));
    assert.strictEqual(failedBeforeEnd.applied, true);
    assert.strictEqual(failedBeforeEnd.status, 'warning');
    assert.strictEqual((await accounts.findById(userId)).plan, 'pro');
    assert.strictEqual((await accounts.findById(userId)).status, 'warning');

    const failedIntent = await applyStripeEvent(event('payment_intent.payment_failed', {
      customer: 'cus_ada',
    }));
    assert.strictEqual(failedIntent.applied, true);
    assert.strictEqual(failedIntent.status, 'warning');
    assert.strictEqual((await accounts.findById(userId)).status, 'warning');

    const unpaidSub = await applyStripeEvent(event('customer.subscription.updated', {
      status: 'unpaid',
      customer: 'cus_ada',
    }));
    assert.strictEqual(unpaidSub.applied, true);
    assert.strictEqual(unpaidSub.status, 'hold');
    assert.strictEqual((await accounts.findById(userId)).plan, 'pro');
    assert.strictEqual((await accounts.findById(userId)).status, 'hold');

    const stayShutoff = await applyStripeEvent(event('customer.subscription.updated', {
      status: 'past_due',
      customer: 'cus_ada',
    }));
    assert.strictEqual(stayShutoff.status, 'hold');
    assert.strictEqual((await accounts.findById(userId)).status, 'hold');

    await accounts.updateStripe(userId, { status: 'active' });
    const failedAtEnd = await applyStripeEvent(event('invoice.payment_failed', {
      customer: 'cus_ada',
      paid: false,
      period_end: now - 60,
    }));
    assert.strictEqual(failedAtEnd.applied, true);
    assert.strictEqual(failedAtEnd.status, 'hold');
    assert.strictEqual((await accounts.findById(userId)).plan, 'pro');
    assert.strictEqual((await accounts.findById(userId)).status, 'hold');

    const restored = await applyStripeEvent(event('invoice.paid', {
      paid: true,
      amount_paid: 1999,
      customer: 'cus_ada',
      lines: { data: [{ price: { id: PRO_MONTH } }] },
    }));
    assert.strictEqual(restored.applied, true);
    assert.strictEqual(restored.status, 'active');
    row = await accounts.findById(userId);
    assert.strictEqual(row.plan, 'pro');
    assert.strictEqual(row.status, 'active');

    const canceled = await applyStripeEvent(event('customer.subscription.updated', {
      status: 'canceled',
      customer: 'cus_ada',
    }));
    assert.strictEqual(canceled.applied, true);
    assert.strictEqual(canceled.plan, 'basic');
    assert.strictEqual(canceled.status, 'active');
    assert.strictEqual((await accounts.findById(userId)).plan, 'basic');
    assert.strictEqual((await accounts.findById(userId)).status, 'active');

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

    const stayBasic = await signupUser('basicfail@example.com', 'basic');
    const skipHold = await applyStripeEvent(event('invoice.payment_failed', {
      customer_email: 'basicfail@example.com',
    }));
    assert.strictEqual(skipHold.applied, false);
    assert.strictEqual((await accounts.findById(stayBasic.user.id)).plan, 'basic');
    assert.strictEqual((await accounts.findById(stayBasic.user.id)).status, 'active');

    const ghost = await applyStripeEvent(event('checkout.session.completed', {
      id: 'cs_ghost',
      payment_status: 'paid',
      customer_email: 'nobody@example.com',
      line_items: { data: [{ price: { id: CREATOR_MONTH } }] },
    }));
    assert.strictEqual(ghost.applied, false);

    const victoria = await signupUser('victoria.imtanes@gmail.com', 'basic');
    const otherWealth = await signupUser('realhealthiswealth@gmail.com', 'basic');
    const liveSession = {
      id: 'cs_live_a1xv6w0TBRZiHO8VYfpixiiqOj3pM7aDKLRdsJK8SHiwi2HuEsgPln4xxC',
      object: 'checkout.session',
      payment_status: 'paid',
      customer: 'cus_V84DhHyT0cfpso',
      customer_details: { email: 'powerplantog@gmail.com' },
      metadata: { plan: 'creator' },
      line_items: { data: [{ price: { id: CREATOR_MONTH } }] },
    };
    const linkedPaid = await applyStripeEvent(event('checkout.session.completed', liveSession));
    assert.strictEqual(linkedPaid.applied, true);
    assert.strictEqual(linkedPaid.plan, 'creator');
    const victoriaRow = await accounts.findByEmail('victoriaimtanes@gmail.com');
    assert.strictEqual(victoriaRow.id, victoria.user.id);
    assert.strictEqual(victoriaRow.plan, 'creator');
    assert.strictEqual(victoriaRow.stripe_customer_id, 'cus_V84DhHyT0cfpso');
    assert.strictEqual((await accounts.findByEmail('realhealthiswealth@gmail.com')).plan, 'basic');
    assert.strictEqual((await accounts.findByEmail('powerplantog@gmail.com')), null);

    await accounts.updateStripe(victoria.user.id, { plan: 'basic', sessionId: null, customerId: null, status: 'active' });
    const retrieved = await recoverPaidPlan(await accounts.findByEmail('victoria.imtanes+label@gmail.com'), async () => liveSession);
    assert.strictEqual(retrieved.plan, 'creator');
    assert.strictEqual(retrieved.id, victoria.user.id);
    const otherRecover = await recoverPaidPlan(await accounts.findById(otherWealth.user.id), async () => liveSession);
    assert.strictEqual(otherRecover.plan, 'basic');

    await accounts.updateStripe(victoria.user.id, { plan: 'basic', status: 'active' });
    const prevMeFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).indexOf('checkout/sessions/' + liveSession.id) !== -1) {
        return { ok: true, json: async () => liveSession };
      }
      return { ok: false, json: async () => ({}) };
    };
    const victoriaMe = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: victoria.cookie },
    }, victoriaMe);
    global.fetch = prevMeFetch;
    assert.strictEqual(victoriaMe.statusCode, 200);
    assert.strictEqual(json(victoriaMe).plan, 'creator');
    assert.strictEqual(json(victoriaMe).email, 'victoria.imtanes@gmail.com');

    const paidReturn = await applyPaidSessionToAccount('cs_paid_return', created.user, async () => ({
      id: 'cs_paid_return',
      object: 'checkout.session',
      payment_status: 'paid',
      customer: 'cus_return',
      metadata: { plan: 'creator' },
      line_items: { data: [{ price: { id: CREATOR_MONTH } }] },
    }));
    assert.strictEqual(paidReturn.applied, true);
    assert.strictEqual((await accounts.findById(userId)).plan, 'creator');

    await accounts.updateStripe(userId, { plan: 'basic', status: 'active' });
    const prevFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).indexOf('checkout/sessions/cs_me_return') !== -1) {
        return {
          ok: true,
          json: async () => ({
            id: 'cs_me_return',
            object: 'checkout.session',
            payment_status: 'paid',
            customer: 'cus_me_return',
            metadata: { plan: 'creator' },
            line_items: { data: [{ price: { id: CREATOR_MONTH } }] },
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    };
    const meApply = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me',
      headers: { cookie: created.cookie },
      body: { stripe_session_id: 'cs_me_return', plan: 'pro' },
    }, meApply);
    global.fetch = prevFetch;
    assert.strictEqual(meApply.statusCode, 200);
    assert.strictEqual(json(meApply).plan, 'creator');
    assert.notStrictEqual(json(meApply).plan, 'pro', 'client plan is not trusted');

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

  await withEnv({
    DATABASE_URL: 'postgres://memory',
    SESSION_SECRET,
    STRIPE_SECRET_KEY: STRIPE_SECRET,
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    memory: true,
  }, async () => {
    const paid = await signupUser('switch@example.com', 'creator');
    await accounts.updateStripe(paid.user.id, {
      plan: 'creator',
      customerId: 'cus_switch',
      sessionId: 'cs_switch',
    });
    const basic = await signupUser('basic-switch@example.com', 'basic');

    const originalFetch = global.fetch;
    const calls = [];
    let currentPrice = CREATOR_MONTH;
    global.fetch = async (url, opts) => {
      const href = String(url);
      calls.push({ url: href, opts: opts || {} });
      if (href.indexOf('/v1/invoices/create_preview') !== -1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ amount_due: 1234, total: 1234 }),
        };
      }
      if (href.indexOf('/v1/subscriptions/sub_switch') !== -1) {
        const params = new URLSearchParams(opts && opts.body || '');
        const nextPrice = params.get('items[0][price]') || currentPrice;
        currentPrice = nextPrice;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'sub_switch',
            status: 'active',
            items: { data: [{ id: 'si_switch', price: { id: nextPrice } }] },
          }),
        };
      }
      if (href.indexOf('/v1/subscriptions') !== -1) {
        if (href.indexOf('cus_orphan') !== -1) {
          return { ok: true, status: 200, json: async () => ({ data: [] }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              id: 'sub_switch',
              status: 'active',
              items: { data: [{ id: 'si_switch', price: { id: currentPrice } }] },
            }],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_switch_fallback' }),
      };
    };
    try {
      const upgrade = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: paid.cookie },
        body: { action: 'switch', plan: 'pro', interval: 'month' },
      }, upgrade);
      assert.strictEqual(upgrade.statusCode, 200, upgrade.body);
      const upgraded = json(upgrade);
      assert.strictEqual(upgraded.switched, true);
      assert.strictEqual(upgraded.plan, 'pro');
      assert.strictEqual(upgraded.one_subscription, true);
      assert.strictEqual(upgraded.existing, true);
      assert.ok(!upgraded.url, 'upgrade must not open Checkout');
      assert.strictEqual(upgraded.proration, 'always_invoice');
      assert.ok(upgrade.headers['Set-Cookie'], 'switch refreshes the session cookie');
      const updateCall = calls.find((item) => String(item.url).indexOf('/v1/subscriptions/sub_switch') !== -1);
      assert.ok(updateCall, 'switch updates the subscription');
      const updateParams = new URLSearchParams(updateCall.opts.body);
      assert.strictEqual(updateParams.get('items[0][id]'), 'si_switch');
      assert.strictEqual(updateParams.get('items[0][price]'), PRO_MONTH);
      assert.strictEqual(updateParams.get('proration_behavior'), 'always_invoice');
      assert.strictEqual(updateParams.get('payment_behavior'), 'error_if_incomplete');
      assert.strictEqual(updateParams.get('payment_method_types[0]'), null);
      assert.strictEqual(updateParams.get('automatic_tax[enabled]'), null);
      calls.forEach((item) => {
        assert.ok(String(item.url).indexOf('email') === -1, 'do not look up Stripe subs by email');
        assert.ok(String(item.opts.body || '').indexOf('switch@example.com') === -1, 'do not attach the switch to an email');
      });
      assert.strictEqual((await accounts.findById(paid.user.id)).plan, 'pro');
      const meAfter = mockRes();
      await meApi({
        method: 'GET',
        url: '/api/me',
        headers: { cookie: paid.cookie },
      }, meAfter);
      assert.strictEqual(meAfter.statusCode, 200, meAfter.body);
      assert.strictEqual(json(meAfter).plan, 'pro');
      assert.ok(json(meAfter).plans == null, '/api/me must show one plan, not a list');

      const downgrade = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: paid.cookie },
        body: { action: 'switch', plan: 'creator', interval: 'month' },
      }, downgrade);
      assert.strictEqual(downgrade.statusCode, 200, downgrade.body);
      assert.strictEqual(json(downgrade).proration, 'none');
      const downCall = calls.filter((item) => String(item.url).indexOf('/v1/subscriptions/sub_switch') !== -1).pop();
      const downParams = new URLSearchParams(downCall.opts.body);
      assert.strictEqual(downParams.get('proration_behavior'), 'none');
      assert.strictEqual(downParams.get('payment_behavior'), null);
      assert.strictEqual((await accounts.findById(paid.user.id)).plan, 'creator');

      const yearly = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: paid.cookie },
        body: { action: 'switch', plan: 'creator', interval: 'year' },
      }, yearly);
      assert.strictEqual(yearly.statusCode, 200, yearly.body);
      assert.strictEqual(json(yearly).priceId, CREATOR_YEAR);
      assert.strictEqual(json(yearly).proration, 'always_invoice');

      const legacy = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: paid.cookie },
        body: { action: 'switch', priceId: LEGACY_PRO_YEAR_PRICE },
      }, legacy);
      assert.strictEqual(legacy.statusCode, 400, 'old yearly ids stay off new changes');

      const basicTarget = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: paid.cookie },
        body: { action: 'switch', plan: 'basic' },
      }, basicTarget);
      assert.strictEqual(basicTarget.statusCode, 400);

      const fallback = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: basic.cookie },
        body: { action: 'switch', plan: 'creator', interval: 'month' },
      }, fallback);
      assert.strictEqual(fallback.statusCode, 200, fallback.body);
      assert.ok(json(fallback).url.indexOf('https://checkout.stripe.com/') === 0);

      const billing = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: paid.cookie },
        body: { action: 'billing' },
      }, billing);
      assert.strictEqual(billing.statusCode, 200);
      assert.strictEqual(json(billing).plan, 'creator');
      assert.strictEqual(json(billing).interval, 'year');
      assert.strictEqual(json(billing).priceId, CREATOR_YEAR);

      const updatesBeforePreview = calls.filter((item) => String(item.url).indexOf('/v1/subscriptions/sub_switch') !== -1).length;
      const preview = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: paid.cookie },
        body: { action: 'preview', plan: 'pro', interval: 'year' },
      }, preview);
      assert.strictEqual(preview.statusCode, 200, preview.body);
      const previewed = json(preview);
      assert.strictEqual(previewed.preview, true);
      assert.strictEqual(previewed.proration, 'always_invoice');
      assert.strictEqual(previewed.amount_due, 1234);
      assert.strictEqual(previewed.plan, 'pro');
      assert.strictEqual(previewed.existing, true);
      assert.strictEqual(previewed.checkout, false);
      assert.strictEqual(previewed.recurring_amount, 19900);
      const updatesAfterPreview = calls.filter((item) => String(item.url).indexOf('/v1/subscriptions/sub_switch') !== -1).length;
      assert.strictEqual(updatesAfterPreview, updatesBeforePreview, 'preview must not update the subscription');
      assert.ok(calls.some((item) => String(item.url).indexOf('/v1/invoices/create_preview') !== -1));

      const sessionsBefore = calls.filter((item) => String(item.url).indexOf('/v1/checkout/sessions') !== -1).length;
      const secondCheckout = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: paid.cookie },
        body: { plan: 'pro', interval: 'month' },
      }, secondCheckout);
      assert.strictEqual(secondCheckout.statusCode, 409, secondCheckout.body);
      assert.strictEqual(json(secondCheckout).existing, true);
      assert.ok(!json(secondCheckout).url, 'paid members must not receive a Checkout URL');
      const sessionsAfter = calls.filter((item) => String(item.url).indexOf('/v1/checkout/sessions') !== -1).length;
      assert.strictEqual(sessionsAfter, sessionsBefore, 'paid members must not create a second Checkout Session');

      const ghost = await signupUser('ghost-paid@example.com', 'creator');
      await accounts.updateStripe(ghost.user.id, { plan: 'creator' });
      const ghostSwitch = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: ghost.cookie },
        body: { action: 'switch', plan: 'pro', interval: 'month' },
      }, ghostSwitch);
      assert.strictEqual(ghostSwitch.statusCode, 409, ghostSwitch.body);
      assert.strictEqual(json(ghostSwitch).existing, true);
      assert.ok(!json(ghostSwitch).url);

      const orphan = await signupUser('orphan-paid@example.com', 'creator');
      await accounts.updateStripe(orphan.user.id, { plan: 'creator', customerId: 'cus_orphan' });
      const orphanSwitch = mockRes();
      await checkoutApi({
        method: 'POST',
        url: '/api/create-checkout-session',
        headers: { cookie: orphan.cookie },
        body: { action: 'switch', plan: 'pro', interval: 'month' },
      }, orphanSwitch);
      assert.strictEqual(orphanSwitch.statusCode, 409, orphanSwitch.body);
      assert.strictEqual(json(orphanSwitch).existing, true);
      assert.ok(!json(orphanSwitch).url);
    } finally {
      global.fetch = originalFetch;
    }
  });

  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  assert.ok(schemaSql.includes("'active', 'warning', 'hold'"));
  const payoutsHtml = fs.readFileSync(path.join(__dirname, '..', 'payouts.html'), 'utf8');
  assert.ok(payoutsHtml.includes('data-payout-withdraw'));
  assert.ok(payoutsHtml.includes('data-billing-warning'));
  const checkoutJs = fs.readFileSync(path.join(__dirname, '..', 'checkout.js'), 'utf8');
  assert.ok(checkoutJs.includes("|| 'month'"));
  assert.ok(checkoutJs.includes("action = 'switch'") || checkoutJs.includes("action: 'switch'"));
  assert.ok(checkoutJs.includes('data-checkout-switch'));
  assert.ok(checkoutJs.includes("Still signed in. Try again."));
  assert.ok(checkoutJs.includes('result.data.switched'));
  assert.ok(checkoutJs.includes('result.data.existing'));
  assert.ok(checkoutJs.includes('plan-confirm.html'));
  assert.ok(checkoutJs.includes('Could not start a second subscription.'));
  assert.ok(checkoutJs.includes('data-plan-option'));
  assert.ok(checkoutJs.includes('login.html'));
  assert.ok(checkoutJs.includes('result.status === 401'));

  const handlerSrc = fs.readFileSync(path.join(__dirname, '..', 'api/create-checkout-session.js'), 'utf8');
  assert.ok(handlerSrc.includes('https://wannaplai.com/api/stripe/webhook'));
  assert.ok(handlerSrc.includes('STRIPE_WEBHOOK_SECRET'));
  assert.ok(handlerSrc.includes('checkout.session.completed'));
  assert.ok(handlerSrc.includes('customer.subscription.deleted'));
  assert.ok(handlerSrc.includes('invoice.payment_failed'));
  assert.ok(handlerSrc.includes('invoice.upcoming'));
  assert.ok(!handlerSrc.includes('subscription_data[collection_method]'));
  assert.ok(handlerSrc.includes('payment_intent.payment_failed'));
  assert.ok(handlerSrc.includes('metadata[email]'));
  assert.ok(handlerSrc.includes('Sign in required.'));
  assert.ok(handlerSrc.includes('proration_behavior'));
  assert.ok(handlerSrc.includes('always_invoice'));
  assert.ok(handlerSrc.includes('invoices/create_preview'));
  assert.ok(handlerSrc.includes("actionOf(body) === 'preview'") || handlerSrc.includes("action === 'preview'"));
  assert.ok(handlerSrc.includes('refuseSecondSubscription'));
  assert.ok(handlerSrc.includes('isPaidMember'));
  assert.ok(handlerSrc.includes('one_subscription'));
  assert.ok(!handlerSrc.includes('payment_method_types'));
  assert.ok(!handlerSrc.includes('automatic_tax'));
  assert.ok(!/sk_live_|sk_test_|whsec_/.test(handlerSrc));

  console.log('stripe-webhook.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
