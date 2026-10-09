'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const authApi = require('../api/auth');
const events = require('./product-events');

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

async function withMemory(fn) {
  const prev = process.env.DATABASE_URL;
  const secret = process.env.SESSION_SECRET;
  process.env.DATABASE_URL = 'postgres://memory';
  process.env.SESSION_SECRET = 'unit-test-session-secret';
  accounts.resetStore();
  accounts.useMemoryStore();
  events.resetStore();
  events.useMemoryStore();
  try {
    await fn();
  } finally {
    accounts.resetStore();
    events.resetStore();
    if (prev === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev;
    if (secret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = secret;
  }
}

async function run() {
  await withMemory(async () => {
    const first = await events.recordEvent('user-1', 'qualify_started', { lyrics: 'do not store this' }, '2026-01-02T00:00:00.000Z');
    assert.strictEqual(first.recorded, true);
    assert.deepStrictEqual(first.event.payload, {});
    const second = await events.recordEvent('user-1', 'qualify_started', {}, '2026-01-03T00:00:00.000Z');
    assert.strictEqual(second.recorded, true);
    const done = await events.recordEvent('user-1', 'qualify_completed', {
      tier: 'ready',
      lyrics: 'verse one',
      text: 'nope',
    }, '2026-01-03T01:00:00.000Z');
    assert.deepStrictEqual(done.event.payload, { tier: 'ready' });
    const bad = await events.recordEvent('user-1', 'not_an_event', {});
    assert.strictEqual(bad.recorded, false);

    const day = await events.recordEvent('user-1', 'return_visit', {}, '2026-02-05T01:00:00.000Z');
    assert.strictEqual(day.recorded, true);
    const same = await events.recordEvent('user-1', 'return_visit', {}, '2026-02-05T18:00:00.000Z');
    assert.strictEqual(same.recorded, false);
    assert.strictEqual(same.reason, 'deduped');
    const next = await events.recordEvent('user-1', 'return_visit', {}, '2026-02-06T00:00:00.000Z');
    assert.strictEqual(next.recorded, true);

    const store = events.useMemoryStore();
    await events.recordEvent('user-1', 'song_helper_started', {}, '2026-01-02T00:00:00.000Z');
    await events.recordEvent('user-1', 'song_helper_started', {}, '2026-01-04T00:00:00.000Z');
    const rollups = await store.listRollups();
    const helper = rollups.find((row) => row.event_name === 'song_helper_started');
    assert.ok(helper);
    assert.strictEqual(helper.event_count, 2);
    assert.strictEqual(new Date(helper.first_at).toISOString(), '2026-01-02T00:00:00.000Z');
    assert.strictEqual(new Date(helper.last_at).toISOString(), '2026-01-04T00:00:00.000Z');

    const rows = events.cohortRows([
      { id: 'user-1', created_at: '2026-01-01T00:00:00.000Z', tonegrid_release_at: [] },
      { id: 'user-2', created_at: '2026-01-01T00:00:00.000Z', tonegrid_release_at: ['2026-02-10T00:00:00.000Z'] },
      { id: 'user-3', created_at: '2026-02-20T00:00:00.000Z', tonegrid_release_at: [] },
    ], [
      { user_id: 'user-1', event_name: 'song_helper_started', event_count: 2, first_at: '2026-01-02T00:00:00.000Z', last_at: '2026-01-04T00:00:00.000Z' },
      { user_id: 'user-1', event_name: 'return_visit', event_count: 1, first_at: '2026-02-05T00:00:00.000Z', last_at: '2026-02-05T00:00:00.000Z' },
      { user_id: 'user-2', event_name: 'song_helper_started', event_count: 1, first_at: '2026-01-02T00:00:00.000Z', last_at: '2026-01-02T00:00:00.000Z' },
      { user_id: 'user-3', event_name: 'song_helper_started', event_count: 1, first_at: '2026-02-21T00:00:00.000Z', last_at: '2026-02-21T00:00:00.000Z' },
    ], '2026-03-15T00:00:00.000Z');
    const cohort = rows.find((row) => row.event === 'song_helper_started');
    assert.strictEqual(cohort.count, 4);
    assert.strictEqual(cohort.unique_users, 3);
    assert.strictEqual(cohort.cohort_did_in_7d, 2);
    assert.strictEqual(cohort.cohort_retained_30, 2);

    const csv = events.eventsToCsv(rows);
    assert.ok(csv.startsWith('event,label,count,unique_users,cohort_did_in_7d,cohort_retained_30\n'));
    assert.ok(csv.includes('song_helper_started'));

    assert.strictEqual(events.normalizeRole('Artist'), 'artist');
    assert.strictEqual(events.normalizeRole('nope'), '');
    const attr = events.normalizeAttribution({
      utm_source: 'ig',
      utm_medium: 'social',
      utm_campaign: 'spring',
      utm_content: 'bio',
      referrer: 'https://example.com/a',
      ref: 'ada_1',
      landed_at: '2026-01-01T00:00:00.000Z',
      lyrics: 'no',
    });
    assert.strictEqual(attr.utm_source, 'ig');
    assert.strictEqual(attr.ref, 'ada_1');
    assert.ok(!attr.lyrics);
    const guide = events.normalizeGuide({
      status: 'completed',
      song: 'idea',
      wants: ['release', 'paid', 'nope'],
      route: ['helper', 'cover'],
      pace: 'fast',
    });
    assert.deepStrictEqual(guide.wants, ['release', 'paid']);
    assert.deepStrictEqual(guide.route, ['helper', 'cover']);
    assert.strictEqual(guide.song, 'idea');

    const res = mockRes();
    await authApi({
      method: 'POST',
      url: '/api/auth/signup',
      headers: {},
      body: {
        email: 'ada@example.com',
        password: 'password1',
        artist: 'Ada Night',
        plan: 'basic',
        role: 'artist',
        attribution: attr,
      },
    }, res);
    assert.strictEqual(res.statusCode, 200, res.body);
    const user = await accounts.findByEmail('ada@example.com');
    assert.strictEqual(user.profile.role, 'artist');
    assert.strictEqual(user.profile.attribution.utm_source, 'ig');
    assert.strictEqual(user.profile.attribution.ref, 'ada_1');
  });

  const privacy = read('privacy.html');
  assert.ok(privacy.includes('Product usage events (which features you use, and when) so we can improve the service. These events do not include your lyrics.'));
  const signup = read('signup.html');
  assert.ok(signup.includes("I'm a..."));
  assert.ok(signup.includes('value="artist">Artist'));
  assert.ok(signup.includes('Skip for now'));
  const guide = read('guide.html');
  assert.ok(guide.includes('id="guide-role"'));
  const admin = read('admin.html');
  assert.ok(admin.includes('data-product-events-body'));
  assert.ok(admin.includes('/api/admin/events.csv'));
  assert.ok(!/—/.test(read('product-events.js')));
  assert.ok(!/Suno/i.test(read('product-events.js')));
  assert.ok(!/Suno/i.test(read('lib/product-events.js')));
  const added = read('privacy.html').split('Product usage events')[1].slice(0, 180);
  assert.ok(!/—/.test(added));

  const recent = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  assert.strictEqual(events.eventTime(recent), new Date(recent).toISOString());
  const backdated = events.eventTime(new Date(Date.now() - 20 * 60 * 1000).toISOString());
  assert.ok(Math.abs(Date.now() - new Date(backdated).getTime()) < 5000, 'client time older than a few minutes uses server time');

  console.log('product-events.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
