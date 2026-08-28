'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const {
  adminStatusLabel,
  listAdminOverview,
  pickAdminDeliveries,
  pickIsrc,
  pickLiveDate,
  pickStreetDate,
  pickUpc,
  takedownLabel,
} = require('./admin-overview');
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

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
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

async function run() {
  assert.strictEqual(adminStatusLabel('live'), 'Live');
  assert.strictEqual(adminStatusLabel('pending'), 'Pending');
  assert.strictEqual(adminStatusLabel('processing'), 'Processing');
  assert.strictEqual(adminStatusLabel('needs-fix'), 'Needs fix');
  assert.strictEqual(adminStatusLabel('mystery'), 'Unknown');
  assert.strictEqual(adminStatusLabel(''), 'Unknown');
  assert.notStrictEqual(adminStatusLabel('mystery'), 'Live');
  assert.strictEqual(takedownLabel('taken_down'), 'Taken down');
  assert.strictEqual(takedownLabel('takedown_failed'), 'Takedown failed');
  assert.strictEqual(takedownLabel('live'), '');
  assert.strictEqual(pickUpc({}), '');
  assert.strictEqual(pickUpc({ upc: '194399123456' }), '194399123456');
  assert.strictEqual(pickIsrc({}), '');
  assert.strictEqual(pickIsrc({ tracks: [{ isrc: 'USRC17607839' }] }), 'USRC17607839');
  assert.strictEqual(pickStreetDate({ release_date: '2026-08-01' }), '2026-08-01');
  assert.strictEqual(pickLiveDate({}), '');
  assert.strictEqual(pickLiveDate({ live_at: '2026-08-12T00:00:00.000Z' }), '2026-08-12');

  const mixed = pickAdminDeliveries({
    deliveries: [
      { dsp: 'spotify', status: 'live', dsp_release_id: 'spotify:album:7v0Ytestalbumid00001' },
      { dsp: 'apple-music', status: 'failed' },
      { dsp: 'youtube-music', status: 'pending' },
      { dsp: 'tonegrid', status: 'live' },
    ],
  });
  assert.strictEqual(mixed.length, 3, 'only real storefront destinations');
  assert.ok(mixed.some((row) => row.destination === 'Spotify' && row.status === 'Landed'));
  assert.ok(mixed.some((row) => row.destination === 'Apple Music' && row.status === 'Failed'));
  assert.ok(mixed.some((row) => row.destination === 'YouTube Music' && row.status === 'Pending'));
  assert.ok(!mixed.some((row) => /tonegrid|interspace|distrokid/i.test(JSON.stringify(row))));

  const emptyDest = pickAdminDeliveries({ deliveries: [] });
  assert.deepStrictEqual(emptyDest, []);

  await withEnv({
    DATABASE_URL: 'postgres://memory',
    SESSION_SECRET: 'unit-test-session-secret',
    memory: true,
  }, async () => {
    const owner = await signupUser('emailplaiground@gmail.com', 'basic');
    const paid = await signupUser('paid@example.com', 'creator');
    await accounts.updateStripe(paid.user.id, {
      plan: 'creator',
      customerId: 'cus_paid',
      sessionId: 'cs_live_paid',
    });
    await accounts.setReleaseHistory(paid.user.id, [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ]);
    const stored = await accounts.findById(paid.user.id);
    await accounts.updateProfile(paid.user.id, {
      profile: Object.assign({}, stored.profile, {
        releases: [
          { tonegrid_release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Dolly', artist: 'Fuvtu' },
          { tonegrid_release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Too the moon', artist: 'Fuvtu' },
          { tonegrid_release_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Lightning', artist: 'Fuvtu' },
        ],
      }),
    });

    const stripeCalls = [];
    const storeCalls = [];
    const retrieve = async (path) => {
      stripeCalls.push(String(path));
      if (String(path).indexOf('checkout/sessions') === 0) {
        return {
          data: [
            {
              id: 'cs_live_paid',
              payment_status: 'paid',
              amount_total: 1499,
              currency: 'usd',
              customer: 'cus_paid',
              customer_email: 'paid@example.com',
              created: 1780000000,
              metadata: { plan: 'creator' },
            },
            { id: 'cs_open', payment_status: 'unpaid', amount_total: 1999 },
          ],
        };
      }
      if (String(path).indexOf('subscriptions') === 0 && String(path).indexOf('customer=') === -1) {
        return {
          data: [{
            id: 'sub_paid',
            status: 'active',
            customer: 'cus_paid',
            created: 1780000000,
            items: { data: [{ price: { id: 'price_1U6kDm47ejpgV1ChUQ7V937J' } }] },
          }],
        };
      }
      if (String(path).indexOf('subscriptions?customer=') === 0) {
        return { data: [{ id: 'sub_paid', status: 'active' }] };
      }
      if (String(path).indexOf('charges') === 0) {
        return { data: [{ id: 'ch_paid', amount: 1499, currency: 'usd', status: 'succeeded', customer: 'cus_paid', created: 1780000000 }] };
      }
      if (String(path).indexOf('refunds') === 0) {
        return { data: [{ id: 're_1', amount: 500, currency: 'usd', status: 'succeeded', customer: 'cus_paid', created: 1780000100 }] };
      }
      if (String(path).indexOf('payouts') === 0) {
        return { data: [{ id: 'po_1', amount: 900, currency: 'usd', status: 'paid', arrival_date: 1780000200 }] };
      }
      return { data: [] };
    };
    const storeFetch = async (path) => {
      storeCalls.push(String(path));
      if (String(path) === '/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') {
        return {
          ok: true,
          data: {
            uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            title: 'Dolly',
            artist: 'Fuvtu',
            status: 'live',
            release_date: '2026-08-01',
            live_at: '2026-08-12T00:00:00.000Z',
            upc: '194399123456',
            tracks: [{ uuid: '11111111-1111-4111-8111-111111111111', title: 'Dolly', isrc: 'USRC17607839' }],
          },
        };
      }
      if (String(path) === '/releases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/ddex/deliveries') {
        return {
          ok: true,
          data: {
            deliveries: [
              { dsp: 'spotify', status: 'live', dsp_release_id: 'spotify:album:7v0Ydolly00000000001' },
              { dsp: 'apple-music', status: 'failed' },
            ],
          },
        };
      }
      if (String(path) === '/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') {
        return {
          ok: true,
          data: {
            uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            title: 'Too the moon',
            artist: 'Fuvtu',
            status: 'pending',
            release_date: '2026-08-20',
          },
        };
      }
      if (String(path) === '/releases/cccccccc-cccc-4ccc-8ccc-cccccccccccc') {
        return {
          ok: true,
          data: {
            uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            title: 'Lightning',
            artist: 'Fuvtu',
            status: 'needs-fix',
            rejection_reason: 'Cover art is too small.',
          },
        };
      }
      if (String(path) === '/royalties/statements') {
        return { ok: true, data: { statements: [{ id: 'stmt_202608', period: '2026-08', total_usd: 12.34, status: 'finalized' }] } };
      }
      if (String(path) === '/royalties/statements/stmt_202608') {
        return {
          ok: true,
          data: {
            breakdown: [{ release_title: 'Dolly', dsp: 'spotify', streams: 80, revenue_usd: 12.34 }],
          },
        };
      }
      return { ok: false, status: 404, data: {} };
    };

    const listed = await listAdminOverview({ retrieve: retrieve, storeFetch: storeFetch });
    assert.ok(Array.isArray(listed.signups));
    assert.ok(listed.signups.some((row) => row.email === 'paid@example.com'));
    assert.strictEqual(listed.checkouts.length, 1);
    assert.strictEqual(listed.checkouts[0].email, 'paid@example.com');
    assert.strictEqual(listed.checkouts[0].amount_cents, 1499);
    assert.strictEqual(listed.checkouts[0].status, 'paid');
    assert.strictEqual(listed.subscriptions.length, 1);
    assert.strictEqual(listed.subscriptions[0].status, 'active');
    assert.strictEqual(listed.money.charges.length, 1);
    assert.strictEqual(listed.money.refunds.length, 1);
    assert.strictEqual(listed.money.payouts.length, 1);
    const titles = listed.submissions.map((row) => row.title).sort();
    assert.deepStrictEqual(titles, ['Dolly', 'Lightning', 'Too the moon']);
    const dolly = listed.submissions.find((row) => row.title === 'Dolly');
    assert.strictEqual(dolly.status, 'Live');
    assert.strictEqual(dolly.upc, '194399123456');
    assert.strictEqual(dolly.isrc, 'USRC17607839');
    assert.strictEqual(dolly.street_date, '2026-08-01');
    assert.strictEqual(dolly.live_date, '2026-08-12');
    assert.ok(dolly.deliveries.some((row) => row.destination === 'Spotify' && row.status === 'Landed'));
    assert.ok(dolly.deliveries.some((row) => row.destination === 'Apple Music' && row.status === 'Failed'));
    assert.ok(!dolly.deliveries.some((row) => /tonegrid|interspace|distrokid/i.test(JSON.stringify(row))));
    const moon = listed.submissions.find((row) => row.title === 'Too the moon');
    assert.strictEqual(moon.status, 'Pending');
    assert.strictEqual(moon.upc, '');
    assert.strictEqual(moon.isrc, '');
    assert.strictEqual(moon.live_date, '');
    assert.deepStrictEqual(moon.deliveries, []);
    const lightning = listed.submissions.find((row) => row.title === 'Lightning');
    assert.strictEqual(lightning.status, 'Needs fix');
    assert.strictEqual(lightning.alert, 'Cover art is too small.');
    assert.strictEqual(listed.store_royalties.length, 1);
    assert.strictEqual(listed.store_royalties[0].title, 'Dolly');
    assert.strictEqual(listed.store_royalties[0].destination, 'Spotify');
    assert.strictEqual(listed.store_royalties[0].amount_usd, 12.34);
    assert.ok(JSON.stringify(listed).indexOf('ToneGrid') === -1);
    assert.ok(JSON.stringify(listed).indexOf('InterSpace') === -1);
    assert.ok(JSON.stringify(listed).indexOf('DistroKid') === -1);
    assert.ok(storeCalls.some((path) => path.indexOf('/ddex/deliveries') !== -1));
    assert.ok(!storeCalls.some((path) => path.indexOf('/ddex/purge') !== -1));
    stripeCalls.forEach((path) => {
      assert.ok(/checkout\/sessions|subscriptions|charges|refunds|payouts/.test(path));
    });

    const ownerRes = mockRes();
    const prevFetch = global.fetch;
    global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) });
    try {
      await meApi({
        method: 'GET',
        url: '/api/admin/signups',
        headers: { cookie: owner.cookie },
      }, ownerRes);
    } finally {
      global.fetch = prevFetch;
    }
    assert.strictEqual(ownerRes.statusCode, 200);
    const body = json(ownerRes);
    assert.ok(Array.isArray(body.signups));
    assert.ok(Array.isArray(body.checkouts));
    assert.ok(Array.isArray(body.subscriptions));
    assert.ok(body.money && Array.isArray(body.money.rows));
    assert.ok(Array.isArray(body.submissions));
    assert.ok(Array.isArray(body.store_royalties));
  });

  const adminHtml = read('admin.html');
  const adminJs = read('admin.js');
  const songHtml = read('song.html');
  const songJs = read('song.js');
  assert.ok(adminHtml.includes('data-signups-body'));
  assert.ok(adminHtml.includes('<h3>Signups</h3>'));
  assert.ok(adminHtml.includes('<h3>Paid checkouts</h3>'));
  assert.ok(adminHtml.includes('<h3>Subscriptions</h3>'));
  assert.ok(adminHtml.includes('<h3>Money in and out</h3>'));
  assert.ok(adminHtml.includes('<h3>Submissions</h3>'));
  assert.ok(adminHtml.includes('<h3>Store deliveries</h3>'));
  assert.ok(adminHtml.includes('<h3>Store royalties</h3>'));
  assert.ok(adminHtml.includes('<th>Street date</th>'));
  assert.ok(adminHtml.includes('<th>Live date</th>'));
  assert.ok(adminHtml.includes('<th>UPC</th>'));
  assert.ok(adminHtml.includes('<th>ISRC</th>'));
  assert.ok(adminHtml.includes('<th>Takedown</th>'));
  assert.ok(!/ToneGrid|InterSpace|DistroKid|tonegrid\.pro/i.test(adminHtml));
  assert.ok(!adminHtml.includes('<iframe'));
  assert.ok(!/>Admin</.test(adminHtml.match(/<nav class="side-nav"[\s\S]*?<\/nav>/)[0]));
  assert.ok(adminJs.includes('/api/admin/signups'));
  assert.ok(adminJs.includes('emailplaiground@gmail.com'));
  assert.ok(!/ToneGrid|InterSpace|DistroKid/i.test(adminJs));
  assert.ok(songHtml.includes('<h3>Stores</h3>'));
  assert.ok(songHtml.includes('data-song-stores-list'));
  assert.ok(songHtml.includes('UPC: Not assigned'));
  assert.ok(!/takedown|royalt/i.test(songHtml.match(/data-song-stores[\s\S]*?data-song-links/)[0]));
  assert.ok(!/ToneGrid|InterSpace|DistroKid/i.test(songHtml));
  assert.ok(songJs.includes('mountStoreStatus'));
  assert.ok(songJs.includes('Not assigned'));
  assert.ok(!/ToneGrid|InterSpace|DistroKid/i.test(songHtml.match(/data-song-stores[\s\S]*?data-song-links/)[0]));

  console.log('lib/admin-overview.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
