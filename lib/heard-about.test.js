'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const guard = require('./signup-guard');
const { listSignupRows, signupRowsToCsv, SIGNUP_CSV_COLUMNS } = require('./admin-signups');
const { normalizeHeardAbout, heardAboutLabel, OPTIONS } = require('./heard-about');
const authApi = require('../api/auth');

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

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

const KEYS = ['DATABASE_URL', 'SESSION_SECRET', 'CONFIRM_SECRET', 'RESEND_API_KEY', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'];
const BASE_ENV = {
  DATABASE_URL: 'postgres://memory',
  SESSION_SECRET: 'unit-session-secret',
  CONFIRM_SECRET: 'unit-confirm-secret',
  RESEND_API_KEY: 'unit-resend',
};

async function withEnv(env, fn) {
  const prev = {};
  KEYS.forEach((key) => {
    prev[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  });
  const realFetch = global.fetch;
  const sent = [];
  global.fetch = async (url, init) => {
    if (/api\.resend\.com/.test(String(url))) {
      sent.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ id: 'mail_' + sent.length }), text: async () => '{}' };
    }
    throw new Error('unexpected fetch ' + url);
  };
  accounts.resetStore();
  guard.resetStore();
  guard.setStrict(true);
  accounts.useMemoryStore();
  try {
    await fn(sent);
  } finally {
    global.fetch = realFetch;
    accounts.resetStore();
    guard.resetStore();
    guard.setStrict(null);
    KEYS.forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  }
}

let ipCounter = 40;
function headersFor() {
  ipCounter += 1;
  return { 'x-real-ip': '203.0.113.' + ipCounter, 'user-agent': 'Mozilla/5.0 UnitTest' };
}

async function signup(email, extra) {
  const res = mockRes();
  const body = Object.assign({
    email: email,
    password: 'password1',
    artist: 'Ada Night',
    form_token: guard.issueFormToken(Date.now() - 5000),
  }, extra || {});
  await authApi({ method: 'POST', url: '/api/auth/signup', headers: headersFor(), body: body }, res);
  return res;
}

async function run() {
  // Pure helpers.
  assert.deepStrictEqual(Object.keys(OPTIONS), ['instagram', 'tiktok', 'plainow', 'plaipals', 'friend', 'google', 'other']);
  assert.deepStrictEqual(normalizeHeardAbout('Instagram'), { heard_about: 'instagram' });
  assert.deepStrictEqual(normalizeHeardAbout('tiktok', 'ignored'), { heard_about: 'tiktok' });
  assert.strictEqual(normalizeHeardAbout(''), null);
  assert.strictEqual(normalizeHeardAbout('myspace'), null);
  assert.strictEqual(normalizeHeardAbout({ toString: null }), null);
  assert.deepStrictEqual(normalizeHeardAbout('other', '  a <b>podcast</b>\n '), { heard_about: 'other', heard_about_other: 'a b podcast /b' });
  assert.strictEqual(normalizeHeardAbout('other', 'x'.repeat(300)).heard_about_other.length, 80);
  assert.deepStrictEqual(normalizeHeardAbout('other', '   '), { heard_about: 'other' });
  assert.strictEqual(heardAboutLabel({ heard_about: 'friend' }), 'Friend or artist');
  assert.strictEqual(heardAboutLabel({ heard_about: 'other', heard_about_other: 'a zine' }), 'Other: a zine');
  assert.strictEqual(heardAboutLabel({ heard_about: 'other' }), 'Other');
  assert.strictEqual(heardAboutLabel({ heard_about: 'nope' }), '');
  assert.strictEqual(heardAboutLabel(null), '');
  assert.ok(SIGNUP_CSV_COLUMNS.includes('heard_about'));

  // Copy: optional field on signup, column in admin, no em dashes or vendor names.
  const signupHtml = read('signup.html');
  assert.ok(signupHtml.includes('How did you hear about us?'));
  ['instagram', 'tiktok', 'plainow', 'plaipals', 'friend', 'google', 'other'].forEach((value) => {
    assert.ok(signupHtml.includes('<option value="' + value + '">'), value);
  });
  assert.ok(signupHtml.includes('id="heard-about-other"'));
  assert.ok(signupHtml.includes('body.heard_about = heard'));
  assert.ok(read('admin.html').includes('<th>Heard about</th>'));
  assert.ok(read('admin.js').includes("cell('Heard about'"));
  [signupHtml, read('lib/heard-about.js'), read('lib/admin-readonly.js'), read('admin.html'), read('admin.js')].forEach((text) => {
    assert.ok(!text.includes('\u2014'), 'no em dashes');
  });
  assert.ok(!/suno|tonegrid/i.test(read('lib/heard-about.js')));

  // End to end: stored in attribution, shown in admin row, CSV, and owner alert.
  await withEnv(BASE_ENV, async (sent) => {
    let res = await signup('ig.artist@example.com', {
      heard_about: 'instagram',
      attribution: { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'bio', path: '/' },
    });
    assert.strictEqual(res.statusCode, 200, res.body);
    res = await signup('other.artist@example.com', { heard_about: 'other', heard_about_other: 'Saw a flyer' });
    assert.strictEqual(res.statusCode, 200, res.body);
    res = await signup('skip.artist@example.com', {});
    assert.strictEqual(res.statusCode, 200, res.body);
    res = await signup('junk.artist@example.com', { heard_about: '<script>' });
    assert.strictEqual(res.statusCode, 200, res.body);

    const ig = await accounts.findByEmail('ig.artist@example.com');
    const igProfile = typeof ig.profile === 'string' ? JSON.parse(ig.profile) : ig.profile;
    assert.strictEqual(igProfile.attribution.heard_about, 'instagram');
    assert.strictEqual(igProfile.attribution.utm_source, 'instagram');

    const rows = await listSignupRows();
    const by = (email) => rows.find((r) => r.email === email);
    assert.strictEqual(by('ig.artist@example.com').heard_about, 'Instagram');
    assert.ok(by('ig.artist@example.com').source.includes('instagram/social'));
    assert.strictEqual(by('other.artist@example.com').heard_about, 'Other: Saw a flyer');
    assert.strictEqual(by('skip.artist@example.com').heard_about, '');
    assert.strictEqual(by('junk.artist@example.com').heard_about, '');

    const csv = signupRowsToCsv(rows);
    assert.ok(csv.split(/\r?\n/)[0].includes(',source,heard_about,ip,'));
    assert.ok(csv.includes('Other: Saw a flyer'));

    const alerts = sent.filter((m) => /New signup/.test(m.subject));
    const alertFor = (email) => alerts.find((m) => m.text.includes('Email: ' + email));
    assert.ok(alertFor('ig.artist@example.com').text.includes('Heard about: Instagram'));
    assert.ok(alertFor('other.artist@example.com').text.includes('Heard about: Other: Saw a flyer'));
    assert.ok(alertFor('skip.artist@example.com').text.includes('Heard about: (not answered)'));
  });

  console.log('heard-about tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
