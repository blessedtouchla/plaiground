'use strict';

// Tests for the writer IPI saved on an account: lib/writer-ipi.js, GET/PUT/DELETE /api/me/ipi,
// lib/writer-ipi-client.js, and the settings panel wiring.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const W = require('./writer-ipi');
const client = require('./writer-ipi-client');
const profile = require('./profile');

const root = path.join(__dirname, '..');
const NOW = new Date('2026-10-23T12:00:00Z');

// normalize: digits only, reasonable length, PRO from the allowlist.
let r = W.normalize({ ipi: ' 00 123-456.789 ', pro: 'bmi' }, NOW);
assert.ok(r.ok, JSON.stringify(r));
assert.deepStrictEqual(r.writer, { ipi: '00123456789', pro: 'BMI', pro_other: '', updated_at: '2026-10-23T12:00:00.000Z' });
assert.strictEqual(W.normalize({ ipi: '00123456789', pro: 'ASCAP' }).writer.pro, 'ASCAP');
assert.strictEqual(W.normalize({ ipi: '00123456789', pro: 'SESAC' }).writer.pro, 'SESAC');
r = W.normalize({ ipi: '00123456789', pro: 'other', pro_other: 'SOCAN<script>' });
assert.strictEqual(r.writer.pro, 'Other');
assert.strictEqual(r.writer.pro_other, 'SOCANscript', 'other PRO name is sanitized');
assert.ok(W.normalize({ ipi: '00123456789', pro: 'Other' }).error, 'Other needs a name');
assert.ok(W.normalize({ ipi: '', pro: 'BMI' }).error);
assert.ok(W.normalize({ ipi: 'I-001234567-8', pro: 'BMI' }).error, 'letters rejected');
assert.ok(W.normalize({ ipi: '12345', pro: 'BMI' }).error, 'too short');
assert.ok(W.normalize({ ipi: '1234567890123456', pro: 'BMI' }).error, 'too long');
assert.ok(W.normalize({ ipi: '00123456789', pro: 'GEMA' }).error, 'PRO must be on the allowlist');
assert.ok(W.normalize({ ipi: '00123456789' }).error, 'PRO required');
assert.ok(/Social Security/.test(W.normalize({ ipi: '123-45-6789', pro: 'BMI' }).error), 'SSN-shaped input is refused');
['ssn', 'dob', 'date_of_birth', 'bank_account', 'routing', 'password', 'pro_login', 'pro_password'].forEach(function (k) {
  const body = { ipi: '00123456789', pro: 'BMI' };
  body[k] = 'x';
  assert.ok(W.normalize(body).error, k + ' is refused');
});
assert.ok(!/\u2014/.test(fs.readFileSync(path.join(__dirname, 'writer-ipi.js'), 'utf8')), 'no em dashes');

// readWriter drops malformed rows.
assert.strictEqual(W.readWriter(null), null);
assert.strictEqual(W.readWriter({ ipi: 'abc', pro: 'BMI' }), null);
assert.strictEqual(W.readWriter({ ipi: '00123456789', pro: 'NOPE' }), null);
assert.deepStrictEqual(W.readWriter({ ipi: '00123456789', pro: 'BMI', updated_at: 'x', extra: 1 }), { ipi: '00123456789', pro: 'BMI', pro_other: '', updated_at: '' });

// profile keeps writer through readStored and a profile/settings save.
assert.strictEqual(profile.emptyProfile().writer, null);
const stored = profile.readStored({ profile: { writer: { ipi: '00123456789', pro: 'BMI', updated_at: NOW.toISOString() } } });
assert.strictEqual(stored.writer.ipi, '00123456789');
const v = profile.validate({ country: 'US' }, stored);
assert.ok(v.ok);
assert.strictEqual(v.profile.writer.ipi, '00123456789', 'settings save keeps the IPI');

// Routing: rewrite present, still one function.
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
assert.ok((vercel.rewrites || []).some((x) => x.source === '/api/me/ipi' && x.destination === '/api/me?action=ipi'), 'rewrite onto api/me');
assert.ok(!fs.existsSync(path.join(root, 'api/ipi.js')) && !fs.existsSync(path.join(root, 'api/me/ipi.js')), 'no new function file');

// Settings panel wiring and copy.
const settings = fs.readFileSync(path.join(root, 'settings.html'), 'utf8');
const panelJs = fs.readFileSync(path.join(root, 'writer-ipi.js'), 'utf8');
assert.ok(/<h3>IPI number/.test(settings));
assert.ok(/href="\/ipi-guide">Get my IPI \/ Unlock publishing<\/a>/.test(settings));
assert.ok(/writer-ipi-client\.js/.test(settings) && /writer-ipi\.js/.test(settings));
assert.ok(!/\u2014/.test(settings + panelJs), 'no em dashes');
assert.ok(!/type="password"[^>]*data-writer|data-writer[^>]*type="password"/.test(settings), 'no password field in the panel');
assert.ok(!/guarantee|you will earn|get paid more/i.test(settings + panelJs), 'no payout claims');

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(chunk) { this.body = chunk == null ? '' : String(chunk); },
  };
}

async function runClient() {
  const calls = [];
  let saved = null;
  function fakeFetch(url, opts) {
    calls.push({ url: url, opts: opts });
    const json = (status, data) => Promise.resolve({ ok: status < 300, status: status, json: () => Promise.resolve(data) });
    if (opts.method === 'GET') return json(200, { writer: saved });
    saved = Object.assign({ pro_other: '', updated_at: NOW.toISOString() }, JSON.parse(opts.body));
    return json(200, { ok: true, writer: saved });
  }
  const mem = {};
  const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, val) => { mem[k] = String(val); } };
  storage.setItem(client.GUIDE_KEY, JSON.stringify({ ipi: '00123456789', step: 8 }));
  const m = await client.migrateLocal(fakeFetch, storage);
  assert.ok(m.signedIn && m.migrated, 'device IPI copied to account');
  assert.strictEqual(m.writer.ipi, '00123456789');
  assert.strictEqual(m.writer.pro, 'BMI');
  assert.ok(calls.every((c) => c.url === '/api/me/ipi' && c.opts.credentials === 'same-origin'));
  assert.ok(JSON.parse(mem[client.GUIDE_KEY]).accountSavedAt, 'local copy marked');
  const again = await client.migrateLocal(fakeFetch, storage);
  assert.strictEqual(again.migrated, false, 'account copy wins, no second write');
  const out = await client.migrateLocal(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) }), storage);
  assert.deepStrictEqual(out, { signedIn: false, writer: null, migrated: false }, 'logged out keeps localStorage only');
}

async function runHttp() {
  const accounts = require('./accounts');
  const authApi = require('../api/auth');
  const meApi = require('../api/me');
  const prev = { DATABASE_URL: process.env.DATABASE_URL, SESSION_SECRET: process.env.SESSION_SECRET };
  process.env.SESSION_SECRET = 'writer-ipi-test-secret';
  process.env.DATABASE_URL = 'postgres://memory';
  accounts.resetStore();
  accounts.useMemoryStore();
  try {
    const anon = mockRes();
    await meApi({ method: 'GET', url: '/api/me/ipi', headers: {} }, anon);
    assert.strictEqual(anon.statusCode, 401, 'auth required');
    const anonPut = mockRes();
    await meApi({ method: 'PUT', url: '/api/me?action=ipi', headers: {}, body: { ipi: '00123456789', pro: 'BMI' } }, anonPut);
    assert.strictEqual(anonPut.statusCode, 401, 'auth required for PUT');

    const signup = mockRes();
    await authApi({ method: 'POST', url: '/api/auth/signup', headers: {}, body: { email: 'jordan.rivers@example.com', password: 'password1', artist: 'Jordan Rivers' } }, signup);
    assert.strictEqual(signup.statusCode, 200, signup.body);
    await accounts.confirmEmail('jordan.rivers@example.com');
    const login = mockRes();
    await authApi({ method: 'POST', url: '/api/auth/login', headers: {}, body: { email: 'jordan.rivers@example.com', password: 'password1' } }, login);
    assert.strictEqual(login.statusCode, 200, login.body);
    const cookie = String(login.headers['Set-Cookie'] || '').split(';')[0];

    const empty = mockRes();
    await meApi({ method: 'GET', url: '/api/me/ipi', headers: { cookie } }, empty);
    assert.strictEqual(empty.statusCode, 200, empty.body);
    assert.deepStrictEqual(JSON.parse(empty.body), { writer: null });

    const bad = mockRes();
    await meApi({ method: 'PUT', url: '/api/me/ipi', headers: { cookie }, body: { ipi: '123-45-6789', pro: 'BMI' } }, bad);
    assert.strictEqual(bad.statusCode, 400);
    const badPro = mockRes();
    await meApi({ method: 'PUT', url: '/api/me/ipi', headers: { cookie }, body: { ipi: '00123456789', pro: 'XYZ' } }, badPro);
    assert.strictEqual(badPro.statusCode, 400);
    const withPw = mockRes();
    await meApi({ method: 'PUT', url: '/api/me/ipi', headers: { cookie }, body: { ipi: '00123456789', pro: 'BMI', password: 'x' } }, withPw);
    assert.strictEqual(withPw.statusCode, 400);

    const put = mockRes();
    await meApi({ method: 'PUT', url: '/api/me?action=ipi', headers: { cookie }, body: { ipi: '00 1234 56789', pro: 'BMI', ssn_ignored: undefined } }, put);
    assert.strictEqual(put.statusCode, 400, 'any ssn-like key is refused');
    const put2 = mockRes();
    await meApi({ method: 'PUT', url: '/api/me?action=ipi', headers: { cookie }, body: { ipi: '00 1234 56789', pro: 'BMI' } }, put2);
    assert.strictEqual(put2.statusCode, 200, put2.body);
    assert.strictEqual(JSON.parse(put2.body).writer.ipi, '00123456789');

    const got = mockRes();
    await meApi({ method: 'GET', url: '/api/me/ipi', headers: { cookie } }, got);
    assert.strictEqual(JSON.parse(got.body).writer.pro, 'BMI', 'it is always there');

    const me = mockRes();
    await meApi({ method: 'GET', url: '/api/me', headers: { cookie } }, me);
    assert.strictEqual(me.statusCode, 200, me.body);
    assert.strictEqual(JSON.parse(me.body).profile.writer.ipi, '00123456789', 'publishing can read it from /api/me');

    const prof = mockRes();
    await meApi({ method: 'POST', url: '/api/me/profile', headers: { cookie }, body: { country: 'US' } }, prof);
    assert.strictEqual(prof.statusCode, 200, prof.body);
    const after = mockRes();
    await meApi({ method: 'GET', url: '/api/me/ipi', headers: { cookie } }, after);
    assert.strictEqual(JSON.parse(after.body).writer.ipi, '00123456789', 'profile save does not wipe the IPI');

    const asc = mockRes();
    await meApi({ method: 'POST', url: '/api/me/ipi', headers: { cookie }, body: { ipi: '00987654321', pro: 'Other', pro_other: 'SOCAN' } }, asc);
    assert.strictEqual(asc.statusCode, 200, asc.body);
    assert.strictEqual(JSON.parse(asc.body).writer.pro_other, 'SOCAN');

    const del = mockRes();
    await meApi({ method: 'DELETE', url: '/api/me/ipi', headers: { cookie } }, del);
    assert.strictEqual(del.statusCode, 200, del.body);
    const gone = mockRes();
    await meApi({ method: 'GET', url: '/api/me/ipi', headers: { cookie } }, gone);
    assert.deepStrictEqual(JSON.parse(gone.body), { writer: null });

    const patch = mockRes();
    await meApi({ method: 'PATCH', url: '/api/me/ipi', headers: { cookie } }, patch);
    assert.strictEqual(patch.statusCode, 405);
  } finally {
    accounts.resetStore();
    if (prev.DATABASE_URL === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prev.DATABASE_URL;
    if (prev.SESSION_SECRET === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = prev.SESSION_SECRET;
  }
}

runClient().then(runHttp).then(function () {
  console.log('writer-ipi tests passed');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
