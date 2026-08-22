'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mail = require('./mail');

async function withEnv(env, fn) {
  const keys = ['RESEND_API_KEY', 'CONFIRM_SECRET', 'SIGNUP_CONFIRM_SECRET', 'CONFIRM_FROM'];
  const prev = {};
  keys.forEach((key) => {
    prev[key] = process.env[key];
    if (!(key in env)) return;
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  });
  try {
    await fn();
  } finally {
    keys.forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  }
}

async function run() {
  await withEnv({
    RESEND_API_KEY: undefined,
    CONFIRM_FROM: undefined,
    CONFIRM_SECRET: undefined,
    SIGNUP_CONFIRM_SECRET: undefined,
  }, async () => {
    assert.strictEqual(mail.isMailConfigured(), false);
    assert.strictEqual(mail.fromAddress(), 'PLAIGROUND <confirm@wannaplai.com>');
    const result = await mail.sendConfirmEmail({ email: 'ada@example.com', artist: 'Ada' });
    assert.strictEqual(result.mail_sent, false);
    assert.strictEqual(result.error, 'Mail is not configured.');
  });

  assert.strictEqual(
    mail.confirmLink('ada@example.com'),
    'https://www.wannaplai.com/confirmed.html?email=ada%40example.com'
  );
  assert.ok(!mail.confirmLink('ada@example.com').includes('confirm.html'));

  await withEnv({ CONFIRM_FROM: 'confirm@wannaplai.com' }, async () => {
    assert.strictEqual(mail.fromAddress(), 'PLAIGROUND <confirm@wannaplai.com>');
  });
  await withEnv({ CONFIRM_FROM: 'PLAIGROUND <hello@wannaplai.com>' }, async () => {
    assert.strictEqual(mail.fromAddress(), 'PLAIGROUND <hello@wannaplai.com>');
  });
  assert.ok(!mail.DEFAULT_FROM.toLowerCase().includes('gmail.com'));
  assert.ok(!mail.fromAddress().toLowerCase().includes('gmail.com'));

  await withEnv({ CONFIRM_SECRET: 'unit-confirm-secret' }, async () => {
    const token = mail.signToken('ada@example.com');
    assert.ok(token);
    assert.strictEqual(mail.verifyToken(token).email, 'ada@example.com');
    assert.strictEqual(mail.verifyToken('nope'), null);
  });

  const prevFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 're_test' }),
    };
  };
  try {
    await withEnv({ RESEND_API_KEY: 're_test_key', CONFIRM_FROM: undefined }, async () => {
      const sent = await mail.sendConfirmEmail({ email: 'Ada@Example.com', artist: 'Ada Night' });
      assert.strictEqual(sent.mail_sent, true);
      assert.strictEqual(sent.email, 'ada@example.com');
      assert.strictEqual(sent.link, 'https://www.wannaplai.com/confirmed.html?email=ada%40example.com');
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].url, 'https://api.resend.com/emails');
      const body = JSON.parse(calls[0].init.body);
      assert.strictEqual(body.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.deepStrictEqual(body.to, ['ada@example.com']);
      assert.ok(body.text.indexOf('https://www.wannaplai.com/confirmed.html?email=ada%40example.com') !== -1);
      assert.ok(!String(body.from).toLowerCase().includes('gmail.com'));
      assert.ok(!JSON.stringify(body).includes('re_test_key'));
    });

    calls.length = 0;
    global.fetch = async () => {
      throw new Error('network');
    };
    await withEnv({ RESEND_API_KEY: 're_test_key' }, async () => {
      const failed = await mail.sendConfirmEmail({ email: 'ada@example.com' });
      assert.strictEqual(failed.mail_sent, false);
      assert.strictEqual(failed.error, 'Could not reach the mail provider.');
    });

    global.fetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({ message: 'The domain is not verified.' }),
    });
    await withEnv({ RESEND_API_KEY: 're_test_key' }, async () => {
      const rejected = await mail.sendConfirmEmail({ email: 'ada@example.com' });
      assert.strictEqual(rejected.mail_sent, false);
      assert.ok(rejected.error.indexOf('domain') !== -1);
    });
  } finally {
    global.fetch = prevFetch;
  }

  const files = ['lib/mail.js', 'api/auth.js', 'signup.html', 'confirm.html', 'README.md', '.env.example'];
  files.forEach((rel) => {
    const text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.ok(!text.includes(['t', 'g', 'k', '_'].join('')), rel + ' has a key prefix');
    assert.ok(!/sk_live_|sk_test_/.test(text), rel + ' has a Stripe secret');
    assert.ok(!/NEXT_PUBLIC_RESEND|NEXT_PUBLIC_CONFIRM/.test(text), rel + ' exposes a public mail key');
  });

  const confirmHtml = fs.readFileSync(path.join(__dirname, '..', 'confirm.html'), 'utf8');
  assert.ok(confirmHtml.includes('/api/auth/mail'));
  assert.ok(!confirmHtml.includes('/api/signup-confirm'));

  const signupHtml = fs.readFileSync(path.join(__dirname, '..', 'signup.html'), 'utf8');
  assert.ok(signupHtml.includes('mail_sent'));
  assert.ok(!signupHtml.includes('/api/signup-confirm'));
  assert.ok(!signupHtml.includes('Email sent'));

  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'api', 'signup-confirm.js')));

  console.log('mail.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
