'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const db = require('./db');
const roadmap = require('./roadmap');
const accountClient = require('../roadmap-account');
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

function req(cookie, extra) {
  return Object.assign({
    method: 'GET',
    url: '/api/me/roadmap',
    headers: cookie ? { cookie: cookie } : {},
  }, extra || {});
}

const samplePlan = {
  song: 'made',
  goal: 'fanbase',
  note: 'rap in LA',
  stops: ['persona', 'check', 'distro', 'not-a-stop'],
  kit: '',
  artistCount: '2-5',
  genres: ['Hip-Hop'],
  genreOther: 'shoegaze',
};

const sampleProfiles = {
  count: '2-5',
  note: 'two acts',
  artists: [{
    id: 'a1',
    name: 'Ada Night',
    genre: 'Hip-Hop',
    genres: [],
    genreOther: '',
    city: 'LA',
    stage: 'made',
    madeBy: 'both',
    links: { spotify: 'https://open.spotify.com/artist/ada', instagram: '', tiktok: '', youtube: '' },
    picked: true,
  }],
};

async function run() {
  const schema = read('schema.sql');
  const statements = db.splitStatements(schema);
  assert.ok(statements.some((sql) => /CREATE TABLE IF NOT EXISTS roadmap_plans/i.test(sql)));
  assert.ok(statements.some((sql) => /CREATE TABLE IF NOT EXISTS artist_profile_saves/i.test(sql)));
  assert.ok(schema.includes('roadmap_plans_user_created_idx'));

  const fromQuery = accountClient.planFromSearch(new URLSearchParams('plan=basic&song=made&goal=money&stops=check,sync&note=city&artistCount=1&genres=Pop,Jazz'));
  assert.strictEqual(fromQuery.song, 'made');
  assert.strictEqual(fromQuery.goal, 'money');
  assert.deepStrictEqual(fromQuery.stops, ['check', 'sync']);
  assert.strictEqual(fromQuery.note, 'city');
  assert.strictEqual(fromQuery.artistCount, '1');
  assert.deepStrictEqual(fromQuery.genres, ['Pop', 'Jazz']);
  assert.strictEqual(accountClient.profilesWorthSaving({ artists: [{ name: '' }] }), false);
  assert.strictEqual(accountClient.profilesWorthSaving(sampleProfiles), true);

  const clean = roadmap.sanitizePlan(samplePlan);
  assert.strictEqual(clean.song, 'made');
  assert.strictEqual(clean.goal, 'fanbase');
  assert.deepStrictEqual(clean.stops, ['persona', 'check', 'distro']);
  assert.strictEqual(clean.artistCount, '2-5');
  assert.deepStrictEqual(clean.genres, ['Hip-Hop']);
  assert.strictEqual(clean.genreOther, 'shoegaze');
  assert.throws(() => roadmap.sanitizePlan({ song: 'nope', goal: 'money' }), (err) => err.code === 'VALIDATION');
  const huge = { song: 'idea', goal: 'money', note: 'x', extra: 'y'.repeat(roadmap.PLAN_MAX_CHARS) };
  assert.throws(() => roadmap.sanitizePlan(huge), (err) => err.code === 'TOO_LARGE');

  const summary = roadmap.summarizePlan(clean);
  assert.strictEqual(summary.goal, 'Build a fanbase');
  assert.strictEqual(summary.stage, "It's made");
  assert.deepStrictEqual(summary.stops, ['Persona + EPK', 'Song check', 'Distribution']);
  assert.strictEqual(summary.artist_count, '2 to 5');
  assert.ok(summary.genres.indexOf('Hip-Hop') !== -1);
  assert.ok(summary.genres.indexOf('shoegaze') !== -1);

  await withEnv({
    DATABASE_URL: 'postgres://memory',
    SESSION_SECRET: 'unit-test-session-secret',
    memory: true,
  }, async () => {
    const anonRes = mockRes();
    await meApi(req('', { method: 'POST', body: { plan: samplePlan } }), anonRes);
    assert.strictEqual(anonRes.statusCode, 401);

    const ada = await signupUser('ada@example.com', 'basic');
    const other = await signupUser('other@example.com', 'basic');
    const owner = await signupUser('emailplaiground@gmail.com', 'basic');

    const saved = mockRes();
    await meApi(req(ada.cookie, {
      method: 'POST',
      url: '/api/me?action=roadmap',
      body: { plan: samplePlan },
    }), saved);
    assert.strictEqual(saved.statusCode, 200, saved.body);
    const first = json(saved);
    assert.strictEqual(first.created, true);
    assert.strictEqual(first.plan.goal, 'fanbase');
    assert.strictEqual(first.history.length, 1);

    const again = mockRes();
    await meApi(req(ada.cookie, { method: 'POST', body: { plan: samplePlan } }), again);
    assert.strictEqual(json(again).created, false);
    assert.strictEqual(json(again).history.length, 1);

    const edited = Object.assign({}, samplePlan, { stops: ['persona', 'pitch'] });
    const second = mockRes();
    await meApi(req(ada.cookie, { method: 'POST', body: { plan: edited } }), second);
    assert.strictEqual(json(second).created, true);
    assert.strictEqual(json(second).history.length, 2);
    assert.deepStrictEqual(json(second).plan.stops, ['persona', 'pitch']);
    assert.notStrictEqual(json(second).history[0].id, json(second).history[1].id);

    const mine = mockRes();
    await meApi(req(ada.cookie), mine);
    assert.strictEqual(mine.statusCode, 200);
    assert.strictEqual(json(mine).summary.goal, 'Build a fanbase');
    assert.strictEqual(json(mine).summary.stage, "It's made");
    assert.ok(json(mine).summary.stops.indexOf('Playlist and blog pitching') !== -1);
    assert.strictEqual(json(mine).history.length, 2);

    const theirs = mockRes();
    await meApi(req(other.cookie), theirs);
    assert.strictEqual(json(theirs).plan, null);
    assert.deepStrictEqual(json(theirs).history, []);

    const profiles = mockRes();
    await meApi(req(ada.cookie, {
      method: 'POST',
      url: '/api/me/artist-profiles',
      body: { profiles: sampleProfiles },
    }), profiles);
    assert.strictEqual(profiles.statusCode, 200, profiles.body);
    assert.strictEqual(json(profiles).created, true);
    assert.strictEqual(json(profiles).profiles.artists[0].name, 'Ada Night');

    const emptyProfiles = mockRes();
    await meApi(req(ada.cookie, {
      method: 'POST',
      url: '/api/me/artist-profiles',
      body: { profiles: { artists: [{ name: '' }] } },
    }), emptyProfiles);
    assert.strictEqual(emptyProfiles.statusCode, 400);

    const tooBig = mockRes();
    await meApi(req(ada.cookie, {
      method: 'POST',
      body: { plan: huge },
    }), tooBig);
    assert.strictEqual(tooBig.statusCode, 413);

    const stranger = mockRes();
    await meApi(req(other.cookie, { method: 'GET', url: '/api/admin/roadmaps' }), stranger);
    assert.strictEqual(stranger.statusCode, 403);

    const desk = mockRes();
    await meApi(req(owner.cookie, { method: 'GET', url: '/api/admin/roadmaps' }), desk);
    assert.strictEqual(desk.statusCode, 200, desk.body);
    const row = json(desk).roadmaps.find((item) => item.email === 'ada@example.com');
    assert.ok(row, 'owner can read the saved roadmap');
    assert.strictEqual(row.goal, 'Build a fanbase');
    assert.strictEqual(row.stage, "It's made");
    assert.strictEqual(row.artist_count, '2 to 5');
    assert.ok(row.stops.indexOf('Playlist and blog pitching') !== -1);
    assert.ok(row.genres.indexOf('Hip-Hop') !== -1);
    assert.ok(row.saved_at);
    assert.strictEqual(row.history.length, 2);
    assert.ok(row.profile_names.indexOf('Ada Night') !== -1);
    assert.ok(row.profiles.artists[0].city === 'LA');
    assert.ok(!json(desk).roadmaps.some((item) => item.email === 'other@example.com'));

    const part = mockRes();
    await meApi(req(owner.cookie, { url: '/api/admin/signups?part=signups' }), part);
    assert.strictEqual(part.statusCode, 200, part.body);
    assert.ok(json(part).signups.some((item) => item.email === 'ada@example.com'));
    assert.strictEqual(json(part).checkouts, undefined);
    assert.strictEqual(json(part).submissions, undefined);
  });

  const page = read('my-roadmap.html');
  const pageJs = read('my-roadmap.js');
  const adminHtml = read('admin.html');
  const adminJs = read('admin.js');
  const siteJs = read('site.js');
  const destHtml = read('destination.html');
  const loginHtml = read('login.html');
  const confirmedHtml = read('confirmed.html');
  assert.ok(page.includes('My roadmap'));
  assert.ok(page.includes('Edit this roadmap'));
  assert.ok(page.includes('href="/destination"'));
  assert.ok(page.includes('No roadmap saved yet.'));
  assert.ok(!page.includes('\u2014'));
  assert.ok(pageJs.includes('/api/me/roadmap'));
  assert.ok(siteJs.includes('My roadmap'));
  assert.ok(siteJs.includes('"/my-roadmap"'));
  assert.ok(destHtml.includes('Sign up free to save your roadmap'));
  assert.ok(loginHtml.includes('roadmap-account.js'));
  assert.ok(loginHtml.includes('claimLocal'));
  assert.ok(confirmedHtml.includes('claimLocal'));
  assert.ok(adminHtml.includes('id="roadmaps"'));
  assert.ok(adminHtml.includes('data-roadmap-detail'));
  assert.ok(adminJs.includes('renderRoadmaps'));
  assert.ok(adminJs.includes('/api/admin/roadmaps'));
  assert.ok(adminJs.includes('part=signups'));
  const added = read('destination.html') + read('destination.js') + read('destination.css') + page + pageJs;
  assert.ok(!added.includes('\u2014'));

  console.log('roadmap.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
