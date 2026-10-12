'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const applications = require('./applications');
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
  const keys = ['DATABASE_URL', 'SESSION_SECRET', 'CONFIRM_SECRET', 'RESEND_API_KEY', 'CONFIRM_FROM'];
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

function applyReq(body, ip) {
  return {
    method: 'POST',
    url: '/api/me?action=apply',
    headers: { 'x-forwarded-for': ip || '203.0.113.10' },
    body: body,
  };
}

async function signupUser(email) {
  const res = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/signup',
    headers: {},
    body: { email, password: 'password1', artist: 'Ada Night', plan: 'basic' },
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
  return cookieFrom(loginRes);
}

const good = {
  name: 'Ada Night',
  email: 'Ada@Example.com',
  phone: '415-555-0134',
  package: 'Persona package',
  help: 'I want a bio and a starter EPK.',
  company_website: '',
};

async function run() {
  const schema = read('schema.sql');
  assert.ok(/CREATE TABLE IF NOT EXISTS applications/i.test(schema));
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(vercel.rewrites.some((row) => row.source === '/api/apply' && row.destination === '/api/me?action=apply'), 'apply stays on the me.js Hobby function');
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'api', 'apply.js')));
  assert.ok(vercel.rewrites.some((row) => row.source === '/api/admin/applications'));
  ['apply.js', 'apply.css', 'lib/applications.js', 'index.html', 'ar.html', 'epk.html'].forEach((rel) => {
    const src = read(rel);
    assert.ok(!src.includes('\u2014'), rel + ' has no em dash');
    assert.ok(!/suno/i.test(src), rel + ' does not say Suno');
  });
  assert.ok(!applications.PACKAGES['A&R Act Pack']);
  assert.ok(applications.PACKAGES['Persona package']);
  assert.ok(applications.PACKAGES.Coaching);
  assert.ok(applications.PACKAGES.Starter);

  const prevFetch = global.fetch;
  const mailCalls = [];
  global.fetch = async (url, init) => {
    mailCalls.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ id: 're_apply' }) };
  };
  try {
    await withEnv({
      DATABASE_URL: 'postgres://memory',
      SESSION_SECRET: 'unit-test-session-secret',
      CONFIRM_SECRET: 'unit-confirm-secret',
      RESEND_API_KEY: 're_test_key',
      CONFIRM_FROM: undefined,
      memory: true,
    }, async () => {
      const getRes = mockRes();
      await meApi({ method: 'GET', url: '/api/me?action=apply', headers: {} }, getRes);
      assert.strictEqual(getRes.statusCode, 405);

      const honey = mockRes();
      await meApi(applyReq(Object.assign({}, good, { company_website: 'https://spam.example' }), '203.0.113.20'), honey);
      assert.strictEqual(honey.statusCode, 400);
      assert.strictEqual((await applications.listApplications()).length, 0);

      const missing = mockRes();
      await meApi(applyReq({ name: 'Ada' }, '203.0.113.21'), missing);
      assert.strictEqual(missing.statusCode, 400);

      const secret = mockRes();
      await meApi(applyReq(Object.assign({}, good, { password: 'password1' }), '203.0.113.22'), secret);
      assert.strictEqual(secret.statusCode, 400);
      assert.strictEqual(json(secret).error, 'Password is not accepted here.');
      assert.ok(!json(secret).error.includes('password1'));
      assert.strictEqual((await applications.listApplications()).length, 0);
      assert.ok(!mailCalls.some((body) => String(body.text || '').includes('password1')));

      const pack = mockRes();
      await meApi(applyReq(Object.assign({}, good, { package: 'A&R Act Pack' }), '203.0.113.23'), pack);
      assert.strictEqual(pack.statusCode, 400);

      mailCalls.length = 0;
      const ok = mockRes();
      await meApi(applyReq(good, '203.0.113.24'), ok);
      assert.strictEqual(ok.statusCode, 200, ok.body);
      assert.strictEqual(json(ok).message, "We'll reach out soon.");
      assert.strictEqual(json(ok).mail_sent, true);
      const saved = await applications.listApplications();
      assert.strictEqual(saved.length, 1);
      assert.strictEqual(saved[0].email, 'ada@example.com');
      assert.strictEqual(saved[0].package, 'Persona package');
      assert.strictEqual(saved[0].phone, '415-555-0134');
      assert.ok(!saved[0].password);
      const mailed = mailCalls.find((body) => body.subject === 'New application');
      assert.ok(mailed, 'application emails the owner');
      assert.deepStrictEqual(mailed.to, ['emailplaiground@gmail.com']);
      assert.strictEqual(mailed.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.ok(mailed.text.includes('Name: Ada Night'));
      assert.ok(mailed.text.includes('Package: Persona package'));
      assert.ok(mailed.text.includes('I want a bio and a starter EPK.'));
      assert.ok(/\bPT\b/.test(mailed.text));
      assert.ok(!/password/i.test(mailed.text + mailed.html));

      const anon = mockRes();
      await meApi({ method: 'GET', url: '/api/admin/applications', headers: {} }, anon);
      assert.strictEqual(anon.statusCode, 401);

      const stranger = await signupUser('other@example.com');
      const denied = mockRes();
      await meApi({ method: 'GET', url: '/api/admin/applications', headers: { cookie: stranger } }, denied);
      assert.strictEqual(denied.statusCode, 403);

      const owner = await signupUser('emailplaiground@gmail.com');
      const desk = mockRes();
      await meApi({ method: 'GET', url: '/api/admin/applications', headers: { cookie: owner } }, desk);
      assert.strictEqual(desk.statusCode, 200, desk.body);
      assert.strictEqual(json(desk).applications.length, 1);
      assert.strictEqual(json(desk).applications[0].name, 'Ada Night');
      assert.ok(!JSON.stringify(json(desk)).includes('password1'));

      let limited = 0;
      for (let i = 0; i < 11; i += 1) {
        const res = mockRes();
        await meApi(applyReq({}, '203.0.113.99'), res);
        limited = res.statusCode;
      }
      assert.strictEqual(limited, 429);
    });
  } finally {
    global.fetch = prevFetch;
  }

  const admin = read('admin.html');
  const adminJs = read('admin.js');
  assert.ok(admin.includes('id="applications"'));
  assert.ok(adminJs.includes('/api/admin/applications'));
  assert.ok(adminJs.includes('renderApplications'));
  assert.ok(read('index.html').includes('apply.js'));
  assert.ok(read('destination.js').includes('Apply free'));
  assert.ok(read('destination.js').includes('No charge to apply'));
  assert.ok(!read('destination.js').includes('$'));

  console.log('apply.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
