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

function loadClient(search, opts) {
  const options = opts || {};
  const store = Object.assign({}, options.store || {});
  const calls = [];
  const pixels = [];
  const listeners = {};
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
      cookie: options.cookie || '',
      referrer: '',
      readyState: 'complete',
      body: {},
      addEventListener(type, fn) {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    location: {
      search: search || '',
      hostname: 'www.wannaplai.com',
      pathname: options.pathname || '/',
      hash: options.hash || '',
    },
    navigator: {},
    fetch(url, opts) {
      calls.push({ url: url, body: opts && opts.body ? JSON.parse(opts.body) : null });
      return Promise.resolve({ ok: true, status: 200 });
    },
    PlaigroundPixel: {
      track(name) { pixels.push(name); },
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
  };
  vm.runInNewContext(read('product-events.js'), {
    window: window,
    document: window.document,
    globalThis: window,
    URL: URL,
    URLSearchParams: URLSearchParams,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
  });
  return { window: window, store: store, calls: calls, pixels: pixels, listeners: listeners };
}

function flushSoon() {
  return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());
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
  assert.strictEqual(ig.segment, '');
  assert.strictEqual(ig.angle, '');
  const csv = marketing.reportToCsv(report);
  assert.ok(csv.startsWith('utm_source,utm_medium,utm_campaign,utm_content,segment,angle,visits,signups,first_songs,distro_purchases\n'));
  assert.ok(csv.includes('ig,paid,launch,bio,,,1,1,1,1'));
  assert.ok(csv.includes('tool,visitors,events'));
  assert.ok(csv.includes('funnel,step,visitors'));
  assert.ok(csv.includes('return_by,key,segment,visitors,returned_1d,returned_7d'));
  assert.ok(!csv.includes('ada@example.com'));
  assert.ok(!csv.includes('IwAR1234567890'));
  assert.ok(!csv.includes('user_id'));

  await marketing.record('visitor_seg000001', 'visit', {
    utm_source: 'meta',
    utm_medium: 'paid',
    utm_campaign: 'oct',
    utm_content: 'launch_hook_v1',
  }, '2026-10-10T09:00:00.000Z');
  await marketing.record('visitor_back0001', 'tool_view', {
    utm_source: 'ig',
    utm_medium: 'paid',
    utm_campaign: 'launch',
    utm_content: 'launch_hook_v1',
  }, '2026-09-01T12:00:00.000Z', { tool: 'cover_art' });
  await marketing.record('visitor_back0001', 'cover_art', {
    utm_source: 'ig',
    utm_medium: 'paid',
    utm_campaign: 'launch',
    utm_content: 'launch_hook_v1',
  }, '2026-09-02T12:00:00.000Z', { tool: 'cover_art' });
  await marketing.record('visitor_week0001', 'tool_view', {
    utm_source: 'tt',
    utm_content: 'launch_hook_v1',
  }, '2026-09-01T08:00:00.000Z', { tool: 'roadmap' });
  await marketing.record('visitor_week0001', 'roadmap_stage', {
    utm_source: 'tt',
    utm_content: 'launch_hook_v1',
  }, '2026-09-04T08:00:00.000Z', { tool: 'roadmap', step: 'idea' });
  await marketing.record('visitor_week0001', 'roadmap_goal', {
    utm_source: 'tt',
    utm_content: 'launch_hook_v1',
  }, '2026-09-01T08:05:00.000Z', { tool: 'roadmap', step: 'fanbase' });
  const dupView = await marketing.record('visitor_back0001', 'tool_view', {
    utm_content: 'launch_hook_v1',
  }, '2026-09-01T18:00:00.000Z', { tool: 'cover_art' });
  assert.strictEqual(dupView.reason, 'deduped');
  const lyric = await marketing.record('visitor_lyric0001', 'song_helper_section', {
    lyrics: 'secret night line',
    email: 'hidden@example.com',
  }, '2026-10-10T10:00:00.000Z', { tool: 'song_helper', step: 'secret night line' });
  assert.strictEqual(lyric.recorded, true);
  const linked = await marketing.linkVisitor('11111111-1111-4111-8111-111111111111', 'visitor_back0001');
  assert.strictEqual(linked.linked, true);
  assert.ok(linked.count >= 1);
  const againLink = await marketing.linkVisitor('11111111-1111-4111-8111-111111111111', 'visitor_back0001');
  assert.strictEqual(againLink.count, 0);
  const rich = await marketing.report('2026-10-10', '2026-10-10');
  const meta = rich.rows.find((row) => row.utm_source === 'meta');
  assert.strictEqual(meta.segment, 'launch');
  assert.strictEqual(meta.angle, 'hook');
  assert.strictEqual(meta.utm_content, 'launch_hook_v1');
  const coverTool = rich.tools.find((row) => row.tool === 'cover_art');
  assert.ok(coverTool.visitors >= 1);
  const cohort = await marketing.report('2026-09-01', '2026-09-01');
  const coverView = cohort.funnels.find((row) => row.funnel === 'cover_art' && row.step === 'view');
  assert.strictEqual(coverView.visitors, 1);
  const goal = cohort.funnels.find((row) => row.funnel === 'roadmap' && row.step === 'goal');
  assert.strictEqual(goal.visitors, 1);
  const stage = cohort.funnels.find((row) => row.funnel === 'roadmap' && row.step === 'stage');
  assert.strictEqual(stage.visitors, 0);
  const backTool = cohort.returns.by_first_tool.find((row) => row.first_tool === 'cover_art');
  assert.strictEqual(backTool.returned_1d, 1);
  assert.strictEqual(backTool.returned_7d, 1);
  const weekTool = cohort.returns.by_first_tool.find((row) => row.first_tool === 'roadmap');
  assert.strictEqual(weekTool.returned_1d, 0);
  assert.strictEqual(weekTool.returned_7d, 1);
  const src = cohort.returns.by_source.find((row) => row.utm_source === 'ig' && row.segment === 'launch');
  assert.strictEqual(src.returned_1d, 1);
  const dumped = JSON.stringify(rich);
  assert.ok(!dumped.includes('secret'));
  assert.ok(!dumped.includes('11111111-1111-4111-8111-111111111111'));
  assert.ok(!dumped.includes('user_id'));
  assert.ok(!dumped.includes('IwAR'));
  assert.ok(!dumped.includes('@'));
  const richCsv = marketing.reportToCsv(rich);
  assert.ok(richCsv.includes('launch_hook_v1,launch,hook,1,0,0,0'));
  assert.ok(!richCsv.includes('secret'));
  assert.ok(!richCsv.includes('11111111'));

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
    assert.ok(call.body.visitor_id);
  });
  client.window.PlaigroundEvents.track('song_helper_section', {
    tool: 'song_helper',
    step: 'hook',
    lyrics: 'secret line about the night',
  });
  const sectionPost = client.calls.filter((call) => call.body && call.body.name === 'song_helper_section').pop();
  assert.ok(sectionPost);
  assert.strictEqual(sectionPost.body.tool, 'song_helper');
  assert.strictEqual(sectionPost.body.step, 'hook');
  assert.ok(!JSON.stringify(sectionPost.body).includes('secret'));
  assert.ok(!JSON.stringify(sectionPost.body).includes('night'));
  const ask = {
    id: '',
    textContent: 'Ask me a question',
    getAttribute() { return ''; },
    closest(sel) { return sel === 'button' ? ask : null; },
  };
  client.listeners.click[0]({ target: ask });
  const chip = {
    id: '',
    textContent: 'Where do I start?',
    getAttribute() { return ''; },
    closest(sel) { return sel === 'button' ? chip : null; },
  };
  client.listeners.click[0]({ target: chip });
  const askPost = client.calls.filter((call) => call.body && call.body.name === 'song_helper_ask').pop();
  const chipPost = client.calls.filter((call) => call.body && call.body.name === 'plai_chip').pop();
  assert.ok(askPost);
  assert.strictEqual(chipPost.body.step, 'start');
  assert.ok(!JSON.stringify(askPost.body).includes('Ask me'));
  assert.ok(!JSON.stringify(chipPost.body).includes('Where'));

  const denied = loadClient('?utm_source=ig', {
    store: { 'plaiground.consent': 'denied' },
    pathname: '/cover-art.html',
  });
  await flushSoon();
  assert.strictEqual(denied.window.PlaigroundEvents.visitorId(), '');
  assert.ok(!denied.store['plaiground.visitor']);
  assert.ok(!String(denied.window.document.cookie).includes('plaiground_vid'));
  assert.ok(!denied.calls.some((call) => call.url === '/api/me/marketing'));

  const returned = loadClient('', {
    store: { 'plaiground.sessionDay': '2026-10-09' },
    pathname: '/song-helper.html',
  });
  await flushSoon();
  const returnedNames = returned.calls.filter((call) => call.url === '/api/me/marketing').map((call) => call.body.name);
  assert.ok(returnedNames.includes('returned_visit'));
  assert.ok(returnedNames.includes('tool_view'));
  const toolView = returned.calls.find((call) => call.body && call.body.name === 'tool_view');
  assert.strictEqual(toolView.body.tool, 'song_helper');
  assert.strictEqual(returned.store['plaiground.sessionDay'], new Date().toISOString().slice(0, 10));

  const sameDay = loadClient('', {
    store: { 'plaiground.sessionDay': new Date().toISOString().slice(0, 10) },
  });
  await flushSoon();
  assert.ok(!sameDay.calls.some((call) => call.body && call.body.name === 'returned_visit'));

  const doc = read('docs/launch-tracking.md');
  assert.ok(doc.includes('META_PIXEL_ID'));
  assert.ok(doc.includes('TIKTOK_PIXEL_ID'));
  assert.ok(doc.includes('GA4_MEASUREMENT_ID'));
  assert.ok(doc.includes('/api/admin/marketing'));
  assert.ok(doc.includes('returned_visit'));
  assert.ok(doc.includes('check_and_file_completed'));
  assert.ok(doc.includes('segment_angle_version'));
  assert.ok(read('login.html').includes('visitor_id: launchVisitorId()'));
  assert.ok(read('magic.html').includes('visitor_id: launchVisitorId()'));
  assert.ok(read('qualify.js').includes('check_and_file_completed'));
  assert.ok(read('cover-art.js').includes('cover_art_downloaded'));
  assert.ok(read('admin.html').includes('data-launch-tools-body'));
  assert.ok(read('admin.js').includes('by_first_tool'));
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
  assert.ok(schema.includes('user_id uuid'));
  assert.ok(schema.includes('ADD COLUMN IF NOT EXISTS tool'));
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(vercel.rewrites.some((row) => row.source === '/api/admin/marketing'));
  assert.strictEqual(fs.readdirSync(path.join(__dirname, '..', 'api')).filter((name) => name.endsWith('.js')).length, 12);

  console.log('marketing.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
