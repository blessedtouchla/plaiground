'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const accounts = require('./accounts');
const authApi = require('../api/auth');
const meApi = require('../api/me');
const marketing = require('./marketing');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(chunk) { this.body = chunk == null ? '' : String(chunk); },
  };
}

function json(res) {
  return JSON.parse(res.body || '{}');
}

function loadClient(search) {
  const store = {};
  const calls = [];
  const pixels = [];
  const window = {
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
      setItem(key, value) { store[key] = String(value); },
      removeItem(key) { delete store[key]; },
    },
    sessionStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    document: {
      cookie: '',
      referrer: '',
      readyState: 'complete',
      addEventListener() {},
      querySelector() { return null; },
    },
    location: { search: search, hostname: 'www.wannaplai.com', pathname: '/' },
    navigator: {},
    fetch(url, opts) {
      calls.push({ url: url, body: opts && opts.body ? JSON.parse(opts.body) : null });
      return Promise.resolve({ ok: true, status: 200 });
    },
    PlaigroundPixel: {
      track(name) { pixels.push(name); },
    },
  };
  window.document.addEventListener = function () {};
  vm.runInNewContext(read('product-events.js'), {
    window: window,
    document: window.document,
    globalThis: window,
    URL: URL,
    URLSearchParams: URLSearchParams,
  });
  return { window: window, store: store, calls: calls, pixels: pixels };
}

async function run() {
  marketing.resetStore();
  marketing.useMemoryStore();

  const touch = {
    utm_source: 'ig',
    utm_medium: 'paid',
    utm_campaign: 'launch',
    utm_content: 'bio',
    utm_term: 'ballad',
    fbclid: 'IwAR1234567890',
    email: 'ada@example.com',
  };
  const visit = await marketing.record('visitor_12345678', 'visit', touch, '2026-10-10T12:00:00.000Z');
  assert.strictEqual(visit.recorded, true);
  const again = await marketing.record('visitor_12345678', 'visit', touch, '2026-10-10T18:00:00.000Z');
  assert.strictEqual(again.reason, 'deduped');
  await marketing.record('visitor_12345678', 'signup', touch, '2026-10-10T12:05:00.000Z');
  await marketing.record('visitor_12345678', 'signup', touch, '2026-10-11T12:05:00.000Z');
  await marketing.record('visitor_12345678', 'song_first', touch, '2026-10-10T13:00:00.000Z');
  await marketing.record('visitor_12345678', 'cover_art', touch, '2026-10-10T13:30:00.000Z');
  await marketing.record('visitor_12345678', 'distro_purchased', touch, '2026-10-10T14:00:00.000Z');
  await marketing.record('visitor_87654321', 'visit', { utm_source: 'tt', utm_medium: 'paid', utm_campaign: 'launch', utm_content: 'hook' }, '2026-10-10T15:00:00.000Z');
  await marketing.record('visitor_direct1', 'visit', {}, '2026-10-10T16:00:00.000Z');

  const bad = await marketing.record('nope', 'visit', touch);
  assert.strictEqual(bad.reason, 'bad_event');
  const pii = marketing.normalizeTouch(touch);
  assert.strictEqual(pii.utm_term, 'ballad');
  assert.strictEqual(pii.fbclid, 'IwAR1234567890');
  assert.ok(!pii.email);

  const report = await marketing.report('2026-10-10', '2026-10-10');
  assert.strictEqual(report.from, '2026-10-10');
  const ig = report.rows.find((row) => row.utm_source === 'ig');
  assert.ok(ig);
  assert.strictEqual(ig.utm_medium, 'paid');
  assert.strictEqual(ig.utm_campaign, 'launch');
  assert.strictEqual(ig.utm_content, 'bio');
  assert.strictEqual(ig.visits, 1);
  assert.strictEqual(ig.signups, 1);
  assert.strictEqual(ig.first_songs, 1);
  assert.strictEqual(ig.distro_purchases, 1);
  assert.ok(!ig.fbclid);
  assert.ok(!ig.email);
  const tt = report.rows.find((row) => row.utm_source === 'tt');
  assert.strictEqual(tt.visits, 1);
  assert.strictEqual(tt.signups, 0);
  const direct = report.rows.find((row) => row.utm_source === 'direct');
  assert.strictEqual(direct.visits, 1);
  const csv = marketing.reportToCsv(report);
  assert.ok(csv.startsWith('utm_source,utm_medium,utm_campaign,utm_content,visits,signups,first_songs,distro_purchases\n'));
  assert.ok(csv.includes('ig,paid,launch,bio,1,1,1,1'));
  assert.ok(!csv.includes('ada@example.com'));
  assert.ok(!csv.includes('IwAR1234567890'));

  const tooLong = await marketing.report('2026-01-01', '2026-06-01');
  assert.strictEqual(tooLong.error, 'range_too_long');

  const prevDb = process.env.DATABASE_URL;
  const prevSecret = process.env.SESSION_SECRET;
  process.env.DATABASE_URL = 'postgres://memory';
  process.env.SESSION_SECRET = 'unit-test-session-secret';
  accounts.resetStore();
  accounts.useMemoryStore();
  marketing.resetStore();
  marketing.useMemoryStore();
  try {
    const open = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/marketing',
      headers: {},
      body: {
        name: 'visit',
        visitor_id: 'visitor_abcdef12',
        attribution: { utm_source: 'ig', utm_content: 'bio', email: 'hidden@example.com' },
      },
    }, open);
    assert.strictEqual(open.statusCode, 200, open.body);
    assert.strictEqual(json(open).recorded, true);

    const denied = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/marketing',
      headers: {},
      body: { name: 'visit', visitor_id: 'visitor_abcdef12', email: 'ada@example.com' },
    }, denied);
    assert.strictEqual(denied.statusCode, 400);

    const locked = mockRes();
    await meApi({ method: 'GET', url: '/api/admin/marketing', headers: {} }, locked);
    assert.strictEqual(locked.statusCode, 401);

    const signup = mockRes();
    await authApi({
      method: 'POST',
      url: '/api/auth/signup',
      headers: {},
      body: {
        email: 'launch@example.com',
        password: 'password1',
        artist: 'Ada Night',
        visitor_id: 'visitor_abcdef12',
        attribution: { utm_source: 'ig', utm_medium: 'paid', utm_campaign: 'launch', utm_content: 'bio', utm_term: 'ballad' },
      },
    }, signup);
    assert.strictEqual(signup.statusCode, 200, signup.body);
    const day = await marketing.report(new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10));
    const row = day.rows.find((item) => item.utm_source === 'ig' && item.utm_medium === 'paid');
    assert.ok(row);
    assert.strictEqual(row.signups, 1);
    assert.strictEqual(row.utm_campaign, 'launch');
    const visit = day.rows.find((item) => item.utm_source === 'ig' && item.visits > 0);
    assert.ok(visit);
  } finally {
    accounts.resetStore();
    marketing.resetStore();
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
  }

  const client = loadClient('?utm_source=ig&utm_medium=paid&utm_campaign=launch&utm_content=bio&utm_term=ballad&fbclid=IwAR1234567890&gclid=Cj0KCQjw1234&ttclid=E.C.P.abc12345');
  const attr = client.window.PlaigroundEvents.readAttribution();
  assert.strictEqual(attr.utm_source, 'ig');
  assert.strictEqual(attr.utm_term, 'ballad');
  assert.strictEqual(attr.fbclid, 'IwAR1234567890');
  assert.strictEqual(attr.gclid, 'Cj0KCQjw1234');
  assert.strictEqual(attr.ttclid, 'E.C.P.abc12345');
  assert.ok(!attr.email);
  client.window.location.search = '?utm_source=other';
  const kept = client.window.PlaigroundEvents.captureAttribution();
  assert.strictEqual(kept.utm_source, 'ig');
  client.window.PlaigroundEvents.track('song_helper_draft', {});
  client.window.PlaigroundEvents.track('song_helper_draft', {});
  client.window.PlaigroundEvents.track('cover_art_generated', {});
  client.window.PlaigroundEvents.track('distro_checkout_started', {});
  client.window.PlaigroundEvents.track('distro_checkout_completed', {});
  const first = client.calls.filter((call) => call.body && call.body.name === 'song_helper_first');
  assert.strictEqual(first.length, 1);
  assert.strictEqual(first[0].body.attribution.utm_source, 'ig');
  assert.strictEqual(first[0].body.attribution.fbclid, 'IwAR1234567890');
  assert.ok(!first[0].body.email);
  assert.ok(!JSON.stringify(first[0].body).includes('@'));
  assert.ok(client.pixels.indexOf('Lead') !== -1);
  assert.ok(client.pixels.indexOf('InitiateCheckout') !== -1);
  assert.ok(client.pixels.indexOf('Purchase') !== -1);
  assert.strictEqual(client.pixels.filter((name) => name === 'Lead').length, 1);
  const marketingPosts = client.calls.filter((call) => call.url === '/api/me/marketing');
  assert.ok(marketingPosts.some((call) => call.body.name === 'visit'));
  marketingPosts.forEach((call) => {
    assert.ok(!call.body.email);
    assert.ok(!JSON.stringify(call.body).includes('@'));
  });

  const doc = read('docs/launch-tracking.md');
  assert.ok(doc.includes('META_PIXEL_ID'));
  assert.ok(doc.includes('TIKTOK_PIXEL_ID'));
  assert.ok(doc.includes('GA4_MEASUREMENT_ID'));
  assert.ok(doc.includes('/api/admin/marketing'));
  assert.ok(!/—/.test(doc));
  assert.ok(!/Suno/i.test(doc));
  assert.ok(!/Suno/i.test(read('product-events.js')));
  assert.ok(!/Suno/i.test(read('lib/marketing.js')));
  assert.ok(!/—/.test(read('product-events.js')));
  assert.ok(!/—/.test(read('lib/marketing.js')));
  const admin = read('admin.html');
  assert.ok(admin.includes('data-launch-body'));
  assert.ok(admin.includes('/api/admin/marketing.csv'));
  const checkout = read('checkout.js');
  assert.ok(checkout.includes('distro_checkout_started'));
  assert.ok(checkout.includes('data-checkout-kind'));
  const confirm = read('confirm.html');
  assert.ok(confirm.includes('distro_checkout_completed'));
  const schema = read('schema.sql');
  assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS marketing_events'));
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(vercel.rewrites.some((row) => row.source === '/api/admin/marketing'));
  assert.strictEqual(fs.readdirSync(path.join(__dirname, '..', 'api')).filter((name) => name.endsWith('.js')).length, 12);

  console.log('marketing.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
