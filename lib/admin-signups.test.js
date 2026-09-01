'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const { listSignupRows, signupRow } = require('./admin-signups');
const { readLiveSubscription } = require('./stripe-webhook');
const authApi = require('../api/auth');
const meApi = require('../api/me');

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
  const keys = ['DATABASE_URL', 'SESSION_SECRET', 'STRIPE_SECRET_KEY', 'CONFIRM_SECRET'];
  const prev = {};
  keys.forEach((key) => {
    prev[key] = process.env[key];
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

async function signupUser(email, plan, extras) {
  const res = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/signup',
    headers: {},
    body: {
      email,
      password: 'password1',
      artist: extras && extras.artist != null ? extras.artist : 'Ada Night',
      username: extras && extras.username != null ? extras.username : '',
      plan: plan || 'basic',
    },
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

function adminReq(cookie, extras) {
  return Object.assign({
    method: 'GET',
    url: '/api/admin/signups',
    headers: cookie ? { cookie } : {},
  }, extras || {});
}

async function adminApi(req) {
  const res = mockRes();
  await meApi(req, res);
  return res;
}

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

async function run() {
  const empty = await readLiveSubscription('');
  assert.strictEqual(empty.stripe, 'no');
  const unknown = await readLiveSubscription('cus_missing', async () => null);
  assert.strictEqual(unknown.stripe, 'unknown');
  const live = await readLiveSubscription('cus_live', async () => ({ data: [{ status: 'active' }] }));
  assert.strictEqual(live.stripe, 'yes');
  const canceled = await readLiveSubscription('cus_old', async () => ({ data: [{ status: 'canceled' }] }));
  assert.strictEqual(canceled.stripe, 'no');

  await withEnv({
    DATABASE_URL: 'postgres://memory',
    SESSION_SECRET: 'unit-test-session-secret',
    memory: true,
  }, async () => {
    const emptyRes = mockRes();
    await meApi(adminReq(''), emptyRes);
    assert.strictEqual(emptyRes.statusCode, 401);

    const emptyList = await listSignupRows();
    assert.deepStrictEqual(emptyList, []);

    async function signupAfter(email, plan) {
      await new Promise((resolve) => setTimeout(resolve, 8));
      return signupUser(email, plan);
    }
    const victoria = await signupUser('victoriaimtanes@gmail.com', 'creator');
    const health = await signupAfter('realhealthiswealth@gmail.com', 'basic');
    const owner = await signupAfter('emailplaiground@gmail.com', 'basic');
    const later = await signupAfter('later@example.com', 'pro');

    await accounts.updateStripe(victoria.user.id, {
      plan: 'creator',
      status: 'warning',
      customerId: 'cus_victoria',
      sessionId: 'cs_live_victoria',
    });
    await accounts.updateStripe(health.user.id, {
      plan: 'basic',
      status: 'hold',
    });

    const victoriaRes = await adminApi(adminReq(victoria.cookie));
    assert.strictEqual(victoriaRes.statusCode, 403);
    assert.strictEqual(json(victoriaRes).error, 'Not allowed.');
    assert.ok(!Object.prototype.hasOwnProperty.call(json(victoriaRes), 'signups'));
    assert.ok(!victoriaRes.body.includes('later@example.com'));
    assert.ok(!victoriaRes.body.includes('emailplaiground@gmail.com'));

    const healthRes = await adminApi(adminReq(health.cookie));
    assert.strictEqual(healthRes.statusCode, 403);
    assert.ok(!healthRes.body.includes('later@example.com'));

    const stranger = await signupAfter('stranger@example.com', 'basic');
    const strangerRes = await adminApi(adminReq(stranger.cookie));
    assert.strictEqual(strangerRes.statusCode, 403);

    const retrieveCalls = [];
    const listed = await listSignupRows({
      retrieve: async (path) => {
        retrieveCalls.push({ method: 'GET', path: String(path) });
        assert.ok(String(path).indexOf('subscriptions?') === 0, 'admin Stripe read must list subscriptions');
        if (String(path).indexOf('cus_victoria') !== -1) {
          return { data: [{ id: 'sub_victoria', status: 'active' }] };
        }
        return { data: [] };
      },
    });
    assert.ok(listed.length >= 5);
    assert.strictEqual(listed[0].email, 'stranger@example.com', 'newest signups first');
    listed.forEach((row) => {
      assert.ok(row.email);
      assert.strictEqual(typeof row.name, 'string');
      assert.ok(row.plan === 'basic' || row.plan === 'creator' || row.plan === 'pro' || row.plan === null);
      assert.ok(typeof row.status === 'string');
      assert.ok(row.signed_up_at);
      assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(row.signed_up_at), 'signed_up_at stays ISO');
      assert.ok(row.stripe === 'yes' || row.stripe === 'no' || row.stripe === 'unknown');
      assert.ok(!Object.prototype.hasOwnProperty.call(row, 'username'));
      assert.ok(!Object.prototype.hasOwnProperty.call(row, 'legal_name'));
      assert.ok(!/last.?login|phone|ipi/i.test(JSON.stringify(row)));
      assert.ok(!/patrick|john ham|demo@|placeholder@/i.test(JSON.stringify(row)));
    });
    const victoriaRow = listed.find((row) => row.email === 'victoriaimtanes@gmail.com');
    assert.ok(victoriaRow);
    assert.strictEqual(victoriaRow.name, 'Ada Night');
    assert.strictEqual(victoriaRow.plan, 'creator');
    assert.strictEqual(victoriaRow.status, 'warning');
    assert.strictEqual(victoriaRow.stripe, 'yes');
    const healthRow = listed.find((row) => row.email === 'realhealthiswealth@gmail.com');
    assert.ok(healthRow);
    assert.strictEqual(healthRow.plan, 'basic');
    assert.strictEqual(healthRow.status, 'hold');
    assert.strictEqual(healthRow.stripe, 'no');
    const ownerRow = listed.find((row) => row.email === 'emailplaiground@gmail.com');
    assert.ok(ownerRow);
    assert.strictEqual(ownerRow.plan, 'basic', 'admin list shows the stored plan, not a painted override');
    assert.ok(retrieveCalls.length >= 1);
    retrieveCalls.forEach((call) => {
      assert.strictEqual(call.method, 'GET');
      assert.ok(!/charges|checkout\/sessions|subscription_items/.test(call.path));
    });

    let stripeWrites = 0;
    const originalUpdate = accounts.updateStripe;
    accounts.updateStripe = async function patchedUpdate() {
      stripeWrites += 1;
      return originalUpdate.apply(this, arguments);
    };
    try {
      const ownerRes = await adminApi(adminReq(owner.cookie));
      assert.strictEqual(ownerRes.statusCode, 200);
      const body = json(ownerRes);
      assert.ok(Array.isArray(body.signups));
      assert.ok(Array.isArray(body.checkouts));
      assert.ok(Array.isArray(body.subscriptions));
      assert.ok(body.money && Array.isArray(body.money.rows));
      assert.ok(Array.isArray(body.submissions));
      assert.ok(Array.isArray(body.store_royalties));
      assert.ok(body.signups.length >= 5);
      assert.strictEqual(body.signups[0].email, 'stranger@example.com');
      const shaped = body.signups.find((row) => row.email === 'later@example.com');
      assert.ok(shaped);
      assert.strictEqual(shaped.name, 'Ada Night');
      assert.strictEqual(shaped.plan, 'pro');
      assert.strictEqual(shaped.status, 'active');
      assert.ok(shaped.signed_up_at);
      assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(shaped.signed_up_at));
      assert.ok(shaped.stripe === 'yes' || shaped.stripe === 'no' || shaped.stripe === 'unknown');
      assert.ok(!body.signups.some((row) => /patrick|john ham/i.test(JSON.stringify(row))));
      assert.strictEqual(stripeWrites, 0, 'admin list must not write Stripe fields');
    } finally {
      accounts.updateStripe = originalUpdate;
    }

    const failedLookup = await listSignupRows({
      retrieve: async () => {
        throw new Error('stripe down');
      },
    });
    const failedVictoria = failedLookup.find((row) => row.email === 'victoriaimtanes@gmail.com');
    assert.strictEqual(failedVictoria.stripe, 'unknown');
    assert.strictEqual(failedVictoria.plan, 'creator');

    const named = signupRow({
      email: 'named@example.com',
      artist_name: 'Ada Night',
      plan: 'basic',
      status: 'active',
      created_at: '2026-08-27T00:16:00.000Z',
      profile: { username: 'handle', legal_name: 'Ada Lovelace' },
    }, 'no');
    assert.strictEqual(named.name, 'Ada Night');
    assert.strictEqual(named.signed_up_at, '2026-08-27T00:16:00.000Z');
    assert.deepStrictEqual(Object.keys(named).sort(), ['email', 'name', 'plan', 'signed_up_at', 'status', 'stripe']);
    assert.ok(!/handle|Ada Lovelace|legal_name|username/.test(JSON.stringify(named)));

    const emptyName = signupRow({
      email: 'new@example.com',
      artist_name: '',
      plan: 'basic',
      status: 'active',
      created_at: '2026-08-28T01:00:00.000Z',
      profile: { username: 'community' },
    }, 'no');
    assert.strictEqual(emptyName.name, '', 'empty artist_name stays empty; username is not a fallback');
    assert.ok(!/community/.test(JSON.stringify(emptyName)));

    const missing = signupRow({ email: 'missing@example.com', created_at: '2026-08-28T01:00:00.000Z' }, 'no');
    assert.strictEqual(missing.name, '');
  });

  await withEnv({
    DATABASE_URL: 'postgres://memory',
    SESSION_SECRET: 'unit-test-session-secret',
    STRIPE_SECRET_KEY: 'unit-test-stripe-secret',
    memory: true,
  }, async () => {
    const owner = await signupUser('emailplaiground@gmail.com', 'basic');
    const paid = await signupUser('paid@example.com', 'creator');
    await accounts.updateStripe(paid.user.id, {
      plan: 'creator',
      customerId: 'cus_paid',
    });

    const calls = [];
    const prevFetch = global.fetch;
    global.fetch = async (url, init) => {
      calls.push({
        url: String(url),
        method: String((init && init.method) || 'GET').toUpperCase(),
        body: init && init.body,
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'sub_paid', status: 'past_due' }] }),
      };
    };
    try {
      const ownerRes = await adminApi(adminReq(owner.cookie));
      assert.strictEqual(ownerRes.statusCode, 200);
      const paidRow = json(ownerRes).signups.find((row) => row.email === 'paid@example.com');
      assert.ok(paidRow);
      assert.strictEqual(paidRow.stripe, 'yes');
      assert.ok(calls.length >= 1);
      calls.forEach((call) => {
        assert.strictEqual(call.method, 'GET', 'admin path must not POST to Stripe');
        assert.ok(call.url.indexOf('https://api.stripe.com/v1/') === 0);
        assert.ok(!call.body);
        assert.ok(/\/(subscriptions|checkout\/sessions|charges|refunds|payouts)/.test(call.url));
        assert.ok(!/payment_intents/.test(call.url));
      });
    } finally {
      global.fetch = prevFetch;
    }
  });

  const adminHtml = read('admin.html');
  const adminJs = read('admin.js');
  const adminLib = read('lib/admin-signups.js');
  const siteCss = read('site.css');
  const meSrc = read('api/me.js');
  const webhookSrc = read('lib/stripe-webhook.js');
  const vercel = read('vercel.json');

  assert.ok(adminHtml.includes('data-signups-body'));
  assert.ok(adminHtml.includes('data-checkouts-body'));
  assert.ok(adminHtml.includes('data-subs-body'));
  assert.ok(adminHtml.includes('data-money-body'));
  assert.ok(adminHtml.includes('data-submissions-body'));
  assert.ok(adminHtml.includes('<th>Email</th>'));
  assert.ok(adminHtml.includes('<th>Name</th>'));
  assert.ok(adminHtml.includes('<th>Plan</th>'));
  assert.ok(adminHtml.includes('<th>Status</th>'));
  assert.ok(adminHtml.includes('<th>Signed up</th>'));
  assert.ok(adminHtml.includes('<th>Stripe</th>'));
  assert.ok(!/Last login|Phone|IPI/i.test(adminHtml));
  assert.ok(adminHtml.includes('No accounts yet.'));
  assert.ok(!/Patrick|John ham|John Doe|demo@|placeholder@/i.test(adminHtml));
  assert.ok(!adminHtml.includes('victoriaimtanes@gmail.com'));
  assert.ok(!adminHtml.includes('realhealthiswealth@gmail.com'));
  const ownerNav = adminHtml.match(/<nav class="side-nav"[\s\S]*?<\/nav>/)[0];
  assert.ok(/>Admin</.test(ownerNav), 'owner desk marks Admin as home');
  assert.ok(/href="dashboard.html">Dashboard<\/a>/.test(ownerNav), 'owner desk can open Overview');
  assert.ok(adminHtml.includes('href="how.html">How it works</a>'));
  assert.ok(!adminHtml.includes('href="artists.html">Artist Profiles</a>'));
  assert.ok(!adminHtml.includes('data-new-release'));
  assert.ok(!/Your plan|Hi there/.test(adminHtml));
  assert.ok(adminJs.includes('/api/admin/signups'));
  assert.ok(adminJs.includes('emailplaiground@gmail.com'));
  assert.ok(adminJs.includes('America/Los_Angeles'));
  assert.ok(adminJs.includes('formatSignedUpAt'));
  assert.ok(adminJs.includes("' PT'"));
  assert.ok(adminJs.includes('admin-signup-name'));
  assert.ok(adminJs.includes('row.name'));
  assert.ok(!adminJs.includes('row.username'));
  assert.ok(!adminJs.includes('legal_name'));
  assert.ok(!/Patrick|John ham|XAI_API_KEY|sk_live_|sk_test_/.test(adminJs));
  assert.ok(adminLib.includes('artist_name'));
  assert.ok(!/profile\.username|row\.username/.test(adminLib));
  assert.ok(!adminLib.includes('updateStripe'));
  assert.ok(siteCss.includes('.admin-signup-meta'));
  assert.ok(siteCss.includes('[data-owner-desk] .admin-table-wrap'));
  assert.ok(siteCss.includes('overflow-x: hidden'));
  assert.ok(siteCss.includes('td.admin-signup-dup'));
  assert.ok(!adminLib.includes('applyPaidSessionToAccount'));
  assert.ok(!/charges|checkout\/sessions/.test(adminLib));
  assert.ok(meSrc.includes('action') && meSrc.includes('admin-signups'));
  assert.ok(meSrc.includes('hasStaffProOverride'));
  assert.ok(meSrc.includes("sendJson(res, 403, { error: 'Not allowed.' })"));
  assert.ok(webhookSrc.includes("method: 'GET'"));
  assert.ok(webhookSrc.includes('readLiveSubscription'));
  assert.ok(vercel.includes('/api/admin/signups'));
  assert.ok(vercel.includes('/admin/signups'));

  const menuFiles = [
    'index.html',
    'how-it-works.html',
    'dashboard.html',
    'settings.html',
    'artists.html',
    'faq.html',
    'login.html',
    'signup.html',
  ];
  menuFiles.forEach((rel) => {
    const html = read(rel);
    const nav = html.match(/<nav class="(?:side-nav|nav-links)"[^>]*>[\s\S]*?<\/nav>/);
    if (!nav) return;
    assert.ok(!/>Admin</.test(nav[0]), rel + ' must not put Admin on the menu');
    assert.ok(!/href="admin(?:\.html|\/signups)?"/.test(nav[0]), rel + ' must not link the owner admin page');
  });

  assert.strictEqual(
    fs.readdirSync(path.join(__dirname, '..', 'api')).filter((name) => name.endsWith('.js')).length,
    7,
    'admin signups stay on the existing /api/me Hobby function'
  );

  console.log('admin-signups.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
