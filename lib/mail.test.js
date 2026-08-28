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

  await withEnv({ CONFIRM_SECRET: 'unit-confirm-secret' }, async () => {
    const link = mail.confirmLink('ada@example.com');
    assert.ok(link.indexOf('https://www.wannaplai.com/confirmed.html?') === 0);
    assert.ok(link.indexOf('email=ada%40example.com') !== -1);
    assert.ok(link.indexOf('token=') !== -1);
    assert.ok(link.indexOf('/confirm.html') === -1);
  });

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
    await withEnv({ RESEND_API_KEY: 're_test_key', CONFIRM_SECRET: 'unit-confirm-secret', CONFIRM_FROM: undefined }, async () => {
      const sent = await mail.sendConfirmEmail({ email: 'Ada@Example.com', artist: 'Ada Night' });
      assert.strictEqual(sent.mail_sent, true);
      assert.strictEqual(sent.email, 'ada@example.com');
      assert.ok(sent.link.indexOf('https://www.wannaplai.com/confirmed.html?') === 0);
      assert.ok(sent.link.indexOf('email=ada%40example.com') !== -1);
      assert.ok(sent.link.indexOf('token=') !== -1);
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].url, 'https://api.resend.com/emails');
      const body = JSON.parse(calls[0].init.body);
      assert.strictEqual(body.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.deepStrictEqual(body.to, ['ada@example.com']);
      assert.ok(body.text.indexOf('email=ada%40example.com') !== -1);
      assert.ok(body.text.indexOf('token=') !== -1);
      assert.ok(!String(body.from).toLowerCase().includes('gmail.com'));
      assert.ok(!JSON.stringify(body).includes('re_test_key'));
      assert.ok(!JSON.stringify(body).includes('unit-confirm-secret'));

      calls.length = 0;
      const magic = await mail.sendMagicEmail({ email: 'ada@example.com', artist: 'Ada' });
      assert.strictEqual(magic.mail_sent, true);
      assert.strictEqual(magic.purpose, 'magic');
      assert.strictEqual(magic.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.ok(magic.link.indexOf('https://www.wannaplai.com/magic.html?') === 0);
      const magicBody = JSON.parse(calls[0].init.body);
      assert.strictEqual(magicBody.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.ok(magicBody.subject.indexOf('sign-in') !== -1);
      assert.ok(magicBody.text.indexOf('Spam and Promotions') !== -1);
      assert.ok(!String(magicBody.from).toLowerCase().includes('gmail.com'));

      calls.length = 0;
      const reset = await mail.sendResetEmail({ email: 'ada@example.com', artist: 'Ada' });
      assert.strictEqual(reset.mail_sent, true);
      assert.strictEqual(reset.purpose, 'reset');
      assert.ok(reset.link.indexOf('https://www.wannaplai.com/forgot.html?') === 0);
      const resetBody = JSON.parse(calls[0].init.body);
      assert.strictEqual(resetBody.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.ok(resetBody.subject.indexOf('Reset') !== -1);
      assert.ok(!String(resetBody.from).toLowerCase().includes('gmail.com'));

      calls.length = 0;
      const report = await mail.sendProblemReport({
        email: 'Ada@Example.com',
        problem: 'The upload button is stuck.',
      });
      assert.strictEqual(report.mail_sent, true);
      assert.strictEqual(report.to, 'emailplaiground@gmail.com');
      assert.strictEqual(report.email, 'ada@example.com');
      assert.strictEqual(mail.CONTACT_EMAIL, 'emailplaiground@gmail.com');
      const reportBody = JSON.parse(calls[0].init.body);
      assert.deepStrictEqual(reportBody.to, ['emailplaiground@gmail.com']);
      assert.ok(reportBody.text.indexOf('The upload button is stuck.') !== -1);
      assert.ok(reportBody.text.indexOf('ada@example.com') !== -1);
      assert.ok(reportBody.text.indexOf('song.html?id=') === -1);

      calls.length = 0;
      const linked = await mail.sendProblemReport({
        email: 'ada@example.com',
        problem: 'Wrong artist page.',
        release: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        artist: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      });
      assert.strictEqual(linked.mail_sent, true);
      assert.ok(linked.release.indexOf('https://www.wannaplai.com/song.html?id=') === 0);
      assert.ok(linked.artist.indexOf('https://www.wannaplai.com/artists.html?id=') === 0);
      const linkedBody = JSON.parse(calls[0].init.body);
      assert.ok(linkedBody.text.indexOf('https://www.wannaplai.com/song.html?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') !== -1);
      assert.ok(linkedBody.text.indexOf('https://www.wannaplai.com/artists.html?id=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') !== -1);
      assert.ok(!/ToneGrid|DistroKid|InterSpace|Flossy/i.test(linkedBody.text));
      assert.ok(!JSON.stringify(reportBody).includes('victoriaimtanes@'));
      assert.ok(!JSON.stringify(reportBody).includes('realhealthiswealth@'));
      assert.ok(!JSON.stringify(reportBody).includes('powerplantog@'));
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

  const files = ['lib/mail.js', 'api/auth.js', 'api/me.js', 'problem.js', 'problem.html', 'signup.html', 'confirm.html', 'confirmed.html', 'login.html', 'forgot.html', 'magic.html', 'README.md', '.env.example'];
  files.forEach((rel) => {
    const text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.ok(!text.includes(['t', 'g', 'k', '_'].join('')), rel + ' has a key prefix');
    assert.ok(!/sk_live_|sk_test_/.test(text), rel + ' has a Stripe secret');
    assert.ok(!/NEXT_PUBLIC_RESEND|NEXT_PUBLIC_CONFIRM/.test(text), rel + ' exposes a public mail key');
  });

  const confirmHtml = fs.readFileSync(path.join(__dirname, '..', 'confirm.html'), 'utf8');
  assert.ok(confirmHtml.includes('/api/auth/mail'));
  assert.ok(!confirmHtml.includes('/api/signup-confirm'));
  assert.ok(confirmHtml.includes('If it is not in the inbox, check Spam and Promotions.'));
  assert.ok(confirmHtml.includes('Check Spam and Promotions'));
  assert.ok(confirmHtml.includes('PLAIGROUND / confirm@wannaplai.com'));

  const confirmedHtml = fs.readFileSync(path.join(__dirname, '..', 'confirmed.html'), 'utf8');
  assert.ok(confirmedHtml.includes('/api/auth/confirm'));
  assert.ok(confirmedHtml.includes('token'));

  const magicHtml = fs.readFileSync(path.join(__dirname, '..', 'magic.html'), 'utf8');
  assert.ok(magicHtml.includes('/api/auth/mail'));
  assert.ok(magicHtml.includes("kind: kind"));
  assert.ok(magicHtml.includes("kind !== 'reset'"));
  assert.ok(magicHtml.includes('Check Spam and Promotions'));
  assert.ok(magicHtml.includes('PLAIGROUND / confirm@wannaplai.com'));
  assert.ok(!magicHtml.includes('14:52'));
  assert.ok(!magicHtml.includes("params.get('sent')"));
  assert.ok(!magicHtml.includes('alreadySent'));
  assert.ok(!magicHtml.toLowerCase().includes('gmail.com'));

  const forgotHtml = fs.readFileSync(path.join(__dirname, '..', 'forgot.html'), 'utf8');
  assert.ok(forgotHtml.includes('magic.html?kind=reset'));
  assert.ok(forgotHtml.includes('/api/auth/reset'));
  assert.ok(forgotHtml.includes('Check Spam and Promotions'));
  assert.ok(forgotHtml.includes('PLAIGROUND / confirm@wannaplai.com'));
  assert.ok(!forgotHtml.includes('sent=1'));
  assert.ok(!forgotHtml.includes('action="magic.html"'));
  assert.ok(!forgotHtml.toLowerCase().includes('gmail.com'));

  const signupHtml = fs.readFileSync(path.join(__dirname, '..', 'signup.html'), 'utf8');
  assert.ok(signupHtml.includes('mail_sent'));
  assert.ok(signupHtml.includes('confirm.html'));
  assert.ok(!signupHtml.includes('window.location.href = \'dashboard.html\''));
  assert.ok(!signupHtml.includes('/api/signup-confirm'));
  assert.ok(!signupHtml.includes('Email sent'));

  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'api', 'signup-confirm.js')));

  console.log('mail.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
