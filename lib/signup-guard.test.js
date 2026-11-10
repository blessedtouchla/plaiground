'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const guard = require('./signup-guard');
const { listSignupRows, SIGNUP_CSV_COLUMNS } = require('./admin-signups');
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

function json(res) {
  return JSON.parse(res.body || '{}');
}

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

const KEYS = ['DATABASE_URL', 'SESSION_SECRET', 'CONFIRM_SECRET', 'RESEND_API_KEY', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'];

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
    const target = String(url);
    if (/api\.resend\.com/.test(target)) {
      sent.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ id: 'mail_' + sent.length }), text: async () => '{}' };
    }
    if (/challenges\.cloudflare\.com/.test(target)) {
      const params = new URLSearchParams(String(init.body));
      const ok = params.get('response') === 'good-token';
      return { ok: true, status: 200, json: async () => ({ success: ok }) };
    }
    throw new Error('unexpected fetch ' + target);
  };
  accounts.resetStore();
  guard.resetStore();
  guard.setStrict(env.strict === undefined ? true : env.strict);
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

let ipCounter = 10;
function freshIp() {
  ipCounter += 1;
  return '203.0.113.' + ipCounter;
}

async function call(url, body, headers, method) {
  const res = mockRes();
  await authApi({ method: method || 'POST', url: url, headers: headers || {}, body: body }, res);
  return res;
}

function oldToken(ms) {
  return guard.issueFormToken(Date.now() - (ms == null ? 5000 : ms));
}

function signupBody(email, extra) {
  return Object.assign({ email: email, password: 'password1', artist: 'Ada Night', form_token: oldToken() }, extra || {});
}

function headersFor(ip, extra) {
  return Object.assign({
    'x-real-ip': ip,
    'x-vercel-ip-country': 'US',
    'x-vercel-ip-country-region': 'CA',
    'x-vercel-ip-city': 'Los%20Angeles',
    'user-agent': 'Mozilla/5.0 UnitTest',
  }, extra || {});
}

const BASE_ENV = {
  DATABASE_URL: 'postgres://memory',
  SESSION_SECRET: 'unit-session-secret',
  CONFIRM_SECRET: 'unit-confirm-secret',
  RESEND_API_KEY: 'unit-resend',
};

async function run() {
  // Pure helpers.
  assert.strictEqual(guard.emailKey('A.d.A+promo@GoogleMail.com'), 'ada@gmail.com');
  assert.strictEqual(guard.emailKey('ada+x@example.com'), 'ada@example.com');
  assert.deepStrictEqual(guard.softSignals('a.b.c.d@gmail.com'), ['gmail_many_dots']);
  assert.deepStrictEqual(guard.softSignals('ada.night@gmail.com'), []);
  const tok = guard.issueFormToken(1000000000000);
  assert.strictEqual(guard.checkFormToken(tok, 1000000000500).reason, 'too_fast');
  assert.strictEqual(guard.checkFormToken(tok, 1000000003000).ok, true);
  assert.strictEqual(guard.checkFormToken(tok, 1000000003000).elapsed_ms, 3000);
  assert.strictEqual(guard.checkFormToken(tok.replace(/.$/, tok.slice(-1) === 'A' ? 'B' : 'A'), 1000000003000).reason, 'bad_form_token');
  assert.strictEqual(guard.checkFormToken('', 1).reason, 'no_form_token');
  assert.strictEqual(guard.checkFormToken(tok, 1000000000000 + 25 * 3600 * 1000).reason, 'stale_form_token');
  assert.strictEqual(guard.clientIp({ headers: { 'x-forwarded-for': '198.51.100.7, 10.0.0.1' } }), '198.51.100.7');

  // Schema and copy.
  const schema = read('schema.sql');
  assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS signup_attempts'));
  const signupHtml = read('signup.html');
  assert.ok(signupHtml.includes('name="website"'));
  assert.ok(signupHtml.includes('/api/auth/form'));
  assert.ok(signupHtml.includes('turnstile'));
  [read('lib/signup-guard.js'), signupHtml, read('admin.html'), read('admin.js'), read('lib/mail.js')].forEach((text) => {
    assert.ok(!text.includes('\u2014'), 'no em dashes');
  });
  Object.keys(guard.BLOCK_COPY).forEach((key) => {
    assert.ok(!/suno|tonegrid|\u2014/i.test(guard.BLOCK_COPY[key]));
  });

  // Form config.
  await withEnv(BASE_ENV, async () => {
    const res = await call('/api/auth/form', undefined, {}, 'GET');
    assert.strictEqual(res.statusCode, 200, res.body);
    const data = json(res);
    assert.ok(/^\d+\.[\w-]+$/.test(data.form_token));
    assert.strictEqual(data.turnstile_site_key, '');
    assert.strictEqual(data.honeypot, 'website');
    assert.strictEqual(res.headers['Cache-Control'], 'no-store');
  });

  // Honeypot: fake success, no user, no mail.
  await withEnv(BASE_ENV, async (sent) => {
    const res = await call('/api/auth/signup', signupBody('bot1@example.com', { website: 'http://spam' }), headersFor(freshIp()));
    assert.strictEqual(res.statusCode, 200, res.body);
    assert.strictEqual(json(res).pending, true);
    assert.strictEqual(await accounts.findByEmail('bot1@example.com'), null);
    assert.strictEqual(sent.length, 0);
    const attempts = await guard.listAttempts(10);
    assert.strictEqual(attempts[0].outcome, 'dropped');
    assert.strictEqual(attempts[0].reasons, 'honeypot');
  });

  // Missing token, too fast.
  await withEnv(BASE_ENV, async (sent) => {
    const ip = freshIp();
    let res = await call('/api/auth/signup', signupBody('fast@example.com', { form_token: '' }), headersFor(ip));
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(json(res).code, 'SIGNUP_CHECK');
    res = await call('/api/auth/signup', signupBody('fast@example.com', { form_token: oldToken(300) }), headersFor(ip));
    assert.strictEqual(res.statusCode, 429);
    assert.strictEqual(json(res).reason, 'too_fast');
    assert.strictEqual(await accounts.findByEmail('fast@example.com'), null);
    assert.strictEqual(sent.length, 0);
  });

  // Clean signup: confirm, welcome and owner alert with trace lines; trace in admin rows.
  await withEnv(BASE_ENV, async (sent) => {
    const ip = freshIp();
    const res = await call('/api/auth/signup', signupBody('real.artist@example.com', {
      attribution: { utm_source: 'tiktok', utm_medium: 'paid', referrer: 'https://www.tiktok.com/', path: '/plans.html' },
    }), headersFor(ip));
    assert.strictEqual(res.statusCode, 200, res.body);
    assert.strictEqual(json(res).mail_sent, true);
    const alert = sent.find((m) => /New signup/.test(m.subject));
    assert.ok(alert, 'owner alert');
    assert.strictEqual(alert.subject, 'New signup');
    assert.ok(alert.text.includes('IP: ' + ip));
    assert.ok(alert.text.includes('Location: Los Angeles, CA, US'));
    assert.ok(alert.text.includes('Source: source=tiktok, medium=paid'));
    assert.ok(alert.text.includes('Referrer: https://www.tiktok.com/'));
    assert.ok(alert.text.includes('Landing page: /plans.html'));
    assert.ok(/Time to submit: \d+\.\ds/.test(alert.text));
    assert.ok(alert.text.includes('Flags: none'));
    const toArtist = sent.filter((m) => (m.to || []).indexOf('real.artist@example.com') !== -1);
    assert.ok(toArtist.length >= 1, 'artist got confirm mail');

    const rows = await listSignupRows();
    const row = rows.find((r) => r.email === 'real.artist@example.com');
    assert.strictEqual(row.ip, ip);
    assert.strictEqual(row.country, 'US');
    assert.strictEqual(row.user_agent, 'Mozilla/5.0 UnitTest');
    assert.ok(row.source.indexOf('tiktok/paid') === 0);
    assert.ok(row.source.includes('from www.tiktok.com'));
    assert.strictEqual(row.suspected_bot, false);
    assert.ok(row.time_to_submit_s >= 4);
    assert.ok(SIGNUP_CSV_COLUMNS.indexOf('ip') > SIGNUP_CSV_COLUMNS.indexOf('email_confirmed_at'));

    // Gmail-style variant of an existing account is a duplicate.
    const dup = await call('/api/auth/signup', signupBody('ada.lovelace@gmail.com'), headersFor(freshIp()));
    assert.strictEqual(dup.statusCode, 200, dup.body);
    const variant = await call('/api/auth/signup', signupBody('a.d.a.lovelace+x@gmail.com'), headersFor(freshIp()));
    assert.strictEqual(variant.statusCode, 409, variant.body);
    const plusVariant = await call('/api/auth/signup', signupBody('real.artist+2@example.com'), headersFor(freshIp()));
    assert.strictEqual(plusVariant.statusCode, 409, plusVariant.body);
    assert.strictEqual(guard.plusBase('a+b@x.com'), 'a@x.com');
    assert.strictEqual(guard.plusBase('a@x.com'), '');
  });

  // Suspicious signup: account kept and flagged, artist mail held, owner told.
  await withEnv(BASE_ENV, async (sent) => {
    const res = await call('/api/auth/signup', signupBody('j.o.h.n.d.o.e@gmail.com'), headersFor(freshIp()));
    assert.strictEqual(res.statusCode, 200, res.body);
    const data = json(res);
    assert.strictEqual(data.mail_sent, false);
    assert.ok(/Resend/.test(data.error));
    assert.ok(await accounts.findByEmail('j.o.h.n.d.o.e@gmail.com'));
    assert.strictEqual(sent.filter((m) => (m.to || []).indexOf('j.o.h.n.d.o.e@gmail.com') !== -1).length, 0);
    const alert = sent.find((m) => /New signup/.test(m.subject));
    assert.strictEqual(alert.subject, 'New signup (suspected bot)');
    assert.ok(alert.text.includes('Flags: gmail_many_dots'));
    const rows = await listSignupRows();
    const row = rows.find((r) => r.email === 'j.o.h.n.d.o.e@gmail.com');
    assert.strictEqual(row.suspected_bot, true);
    assert.strictEqual(row.flags, 'gmail_many_dots');

    // Resend still works for the real owner of a held account.
    const resend = await call('/api/auth/mail', { email: 'j.o.h.n.d.o.e@gmail.com', kind: 'confirm' }, headersFor(freshIp()));
    assert.strictEqual(json(resend).mail_sent, true, resend.body);
  });

  // Per-IP limit and repeat-IP soft flag.
  await withEnv(BASE_ENV, async () => {
    const ip = freshIp();
    const results = [];
    for (let i = 0; i < 9; i += 1) {
      const res = await call('/api/auth/signup', signupBody('user' + i + '@example.com'), headersFor(ip));
      results.push(res.statusCode);
    }
    assert.deepStrictEqual(results.slice(0, 8), [200, 200, 200, 200, 200, 200, 200, 200]);
    assert.strictEqual(results[8], 429);
    const rows = await listSignupRows();
    assert.strictEqual(rows.find((r) => r.email === 'user0@example.com').suspected_bot, false);
    assert.strictEqual(rows.find((r) => r.email === 'user3@example.com').flags, 'ip_repeat_24h');
  });

  // Per-email limit (variants share one key).
  await withEnv(BASE_ENV, async () => {
    const codes = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await call('/api/auth/signup', signupBody('same' + (i ? '+' + i : '') + '@example.com', { password: 'short' }), headersFor(freshIp()));
      codes.push(res.statusCode);
    }
    // Short passwords never reach the guard, so these are all plain 400s.
    assert.deepStrictEqual(codes, [400, 400, 400, 400]);
    const tries = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await call('/api/auth/signup', signupBody('dupe' + (i ? '+' + i : '') + '@example.com'), headersFor(freshIp()));
      tries.push(res.statusCode);
    }
    assert.deepStrictEqual(tries, [200, 409, 409, 429]);
  });

  // Mail endpoint: no mail to strangers, and per-email limit.
  await withEnv(BASE_ENV, async (sent) => {
    const stranger = await call('/api/auth/mail', { email: 'stranger@example.com', kind: 'confirm' }, headersFor(freshIp()));
    assert.strictEqual(json(stranger).mail_sent, false);
    assert.strictEqual(sent.length, 0);
    const codes = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await call('/api/auth/mail', { email: 'stranger@example.com', kind: 'confirm' }, headersFor(freshIp()));
      codes.push(res.statusCode);
    }
    assert.strictEqual(codes[codes.length - 1], 429);
  });

  // Turnstile on: missing and failed tokens block, good token passes.
  await withEnv(Object.assign({}, BASE_ENV, { TURNSTILE_SITE_KEY: 'site-key', TURNSTILE_SECRET_KEY: 'secret-key' }), async () => {
    const cfg = json(await call('/api/auth/form', undefined, {}, 'GET'));
    assert.strictEqual(cfg.turnstile_site_key, 'site-key');
    let res = await call('/api/auth/signup', signupBody('ts1@example.com'), headersFor(freshIp()));
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(json(res).reason, 'turnstile_missing');
    res = await call('/api/auth/signup', signupBody('ts1@example.com', { turnstile_token: 'bad' }), headersFor(freshIp()));
    assert.strictEqual(json(res).reason, 'turnstile_failed');
    res = await call('/api/auth/signup', signupBody('ts1@example.com', { turnstile_token: 'good-token' }), headersFor(freshIp()));
    assert.strictEqual(res.statusCode, 200, res.body);
  });

  // Relaxed mode (unit-test account store) keeps legacy handler tests working.
  await withEnv(Object.assign({}, BASE_ENV, { strict: null }), async () => {
    const res = await call('/api/auth/signup', { email: 'legacy@example.com', password: 'password1', artist: 'Ada' }, {});
    assert.strictEqual(res.statusCode, 200, res.body);
  });

  console.log('signup-guard tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
