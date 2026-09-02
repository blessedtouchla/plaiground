'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const authApi = require('../api/auth');
const growth = require('./growth-events');
const mailCopy = require('./growth-mail');
const { pixelId, isPublicPage } = require('./growth-pixel');
const { applyStripeEvent } = require('./stripe-webhook');
const { PRICE_BY_PLAN } = require('./stripe-plans');

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

async function withEnv(env, fn) {
  const keys = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'RESEND_API_KEY',
    'CONFIRM_SECRET',
    'CONFIRM_FROM',
    'META_PIXEL_ID',
  ];
  const prev = {};
  keys.forEach((key) => {
    prev[key] = process.env[key];
    if (!(key in env)) return;
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  });
  accounts.resetStore();
  growth.resetStore();
  if (env.memory) accounts.useMemoryStore();
  try {
    await fn();
  } finally {
    accounts.resetStore();
    growth.resetStore();
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
    body: { email: email, password: 'password1', artist: 'Ada Night', plan: plan || 'basic' },
  }, res);
  assert.strictEqual(res.statusCode, 200, res.body);
  return accounts.findByEmail(email);
}

async function run() {
  await withEnv({
    DATABASE_URL: 'postgres://memory',
    SESSION_SECRET: 'unit-test-session-secret',
    CONFIRM_SECRET: 'unit-confirm-secret',
    RESEND_API_KEY: undefined,
    META_PIXEL_ID: undefined,
    memory: true,
  }, async () => {
    const user = await signupUser('ada@example.com', 'basic');
    assert.ok(await growth.hasEvent(user.id, 'signup'));
    const again = await growth.recordSignup(user);
    assert.strictEqual(again.recorded, false);
    assert.strictEqual(again.reason, 'duplicate');

    const first = await accounts.updateCatalog(user.id, {
      releaseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    assert.ok(first);
    assert.ok(!(await growth.hasEvent(user.id, 'first_upload')), 'draft catalog write must not mail first_upload');
    const mailed = await growth.recordFirstUpload(user, {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    assert.strictEqual(mailed.recorded, true);
    assert.ok(await growth.hasEvent(user.id, 'first_upload'));
    const firstAgain = await accounts.updateCatalog(user.id, {
      releaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    assert.ok(firstAgain.tonegrid_release_ids.length >= 2);
    const uploadEvents = (await growth.listEvents()).filter((row) => row.event_name === 'first_upload');
    assert.strictEqual(uploadEvents.length, 1);

    const pending = await growth.recordFirstStoreLive(user, 'pending', {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    assert.strictEqual(pending.recorded, false);
    assert.strictEqual(pending.reason, 'not_live');
    assert.ok(!(await growth.hasEvent(user.id, 'first_store_live')));

    const draft = await growth.recordFirstStoreLive(user, 'draft', {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    assert.strictEqual(draft.recorded, false);

    const live = await growth.recordFirstStoreLive(user, 'live', {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      links: [{ name: 'Spotify', open: 'https://open.spotify.com/album/abc123def456abc123def4' }],
    });
    assert.strictEqual(live.recorded, true);
    const liveAgain = await growth.recordFirstStoreLive(user, 'delivered', {
      release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    assert.strictEqual(liveAgain.recorded, false);
    const liveEvents = (await growth.listEvents()).filter((row) => row.event_name === 'first_store_live');
    assert.strictEqual(liveEvents.length, 1);

    const notPaid = await growth.recordPaid(user, 'basic');
    assert.strictEqual(notPaid.recorded, false);
    const paid = await applyStripeEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          object: 'checkout.session',
          id: 'cs_growth',
          payment_status: 'paid',
          client_reference_id: user.id,
          customer: 'cus_growth',
          line_items: { data: [{ price: { id: PRICE_BY_PLAN['creator:month'] } }] },
        },
      },
    });
    assert.strictEqual(paid.applied, true);
    assert.ok(await growth.hasEvent(user.id, 'paid'));
    const paidAgain = await applyStripeEvent({
      type: 'invoice.paid',
      data: {
        object: {
          paid: true,
          amount_paid: 1499,
          customer: 'cus_growth',
          lines: { data: [{ price: { id: PRICE_BY_PLAN['creator:month'] } }] },
        },
      },
    });
    assert.strictEqual(paidAgain.applied, true);
    const paidEvents = (await growth.listEvents()).filter((row) => row.event_name === 'paid');
    assert.strictEqual(paidEvents.length, 1);

    const listed = await growth.listEvents();
    assert.strictEqual(listed.length, 4);
    listed.forEach((row) => {
      assert.ok(['signup', 'first_upload', 'first_store_live', 'paid'].indexOf(row.event_name) !== -1);
    });
  });

  const signupMail = mailCopy.buildLifecycle('signup', { email: 'ada@example.com', plan: 'basic' }, {});
  assert.strictEqual(signupMail.subject, 'You’re in. One song is free.');
  assert.ok(signupMail.text.indexOf('One song. No card. Fully AI, assisted, or human.') !== -1);
  assert.ok(signupMail.text.indexOf('Upload → https://www.wannaplai.com/upload.html') !== -1);
  assert.ok(signupMail.html.indexOf('https://www.wannaplai.com/upload.html') !== -1);
  assert.ok(!/monetize instantly|95\s*%|hello@/i.test(signupMail.text + signupMail.html));

  const uploadMail = mailCopy.buildLifecycle('first_upload', { email: 'ada@example.com' }, {});
  assert.strictEqual(uploadMail.subject, 'Woo-hoo! Your first song has been submitted!');
  assert.ok(uploadMail.text.indexOf('Your first song has been submitted!') !== -1);
  assert.ok(uploadMail.text.indexOf('We are now going through QC and will email you as soon as it’s Live!') !== -1);
  assert.ok(uploadMail.text.indexOf('Dashboard → https://www.wannaplai.com/dashboard.html') !== -1);
  assert.ok(uploadMail.text.indexOf('FAQ → https://www.wannaplai.com/faq.html') !== -1);
  assert.ok(uploadMail.text.indexOf('SIQA Charts → https://www.wannaplai.com/charts') !== -1);
  assert.ok(uploadMail.html.indexOf('https://www.wannaplai.com/dashboard.html') !== -1);
  assert.ok(uploadMail.html.indexOf('https://www.wannaplai.com/faq.html') !== -1);
  assert.ok(uploadMail.html.indexOf('https://www.wannaplai.com/charts') !== -1);
  assert.ok(uploadMail.text.indexOf('Sincerely,') !== -1);
  assert.ok(uploadMail.text.indexOf('Plaiground Team') !== -1);
  assert.ok(uploadMail.text.indexOf('emailplaiground@gmail.com') !== -1);
  assert.ok(uploadMail.html.indexOf('mailto:emailplaiground@gmail.com') !== -1);
  assert.ok(!/monetize instantly/i.test(uploadMail.text));

  const liveBasic = mailCopy.buildLifecycle('first_store_live', {
    email: 'ada@example.com',
    plan: 'basic',
    tonegrid_release_ids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  }, {
    links: [{ name: 'Spotify', open: 'https://open.spotify.com/album/abc123def456abc123def4' }],
  });
  assert.strictEqual(liveBasic.subject, 'It’s up.');
  assert.ok(liveBasic.text.indexOf('Here’s the link. Post it. Track 2 is how you keep 0% on more than one song.') !== -1);
  assert.ok(liveBasic.text.indexOf('https://open.spotify.com/album/abc123def456abc123def4') !== -1);
  assert.ok(liveBasic.text.indexOf('Add track 2 → https://www.wannaplai.com/upload.html') !== -1);
  assert.ok(liveBasic.text.indexOf('Creator and Pro unlock more than one song') !== -1);
  assert.ok(liveBasic.text.indexOf('https://www.wannaplai.com/creator.html') !== -1);

  const livePro = mailCopy.buildLifecycle('first_store_live', {
    email: 'ada@example.com',
    plan: 'pro',
  }, {
    links: [{ name: 'Apple Music', open: 'https://music.apple.com/album/123' }],
  });
  assert.ok(livePro.text.indexOf('https://music.apple.com/album/123') !== -1);
  assert.ok(livePro.text.indexOf('Creator and Pro unlock') === -1);
  assert.ok(livePro.text.indexOf('Add track 2 → https://www.wannaplai.com/upload.html') !== -1);

  const liveNoLink = mailCopy.buildLifecycle('first_store_live', { email: 'ada@example.com', plan: 'creator' }, {});
  assert.ok(liveNoLink.text.indexOf('We’ll add the store link when it’s public.') !== -1);
  assert.ok(liveNoLink.text.indexOf('open.spotify.com') === -1);
  assert.ok(liveNoLink.text.indexOf('Creator and Pro unlock') === -1);

  const fakeLink = mailCopy.buildLifecycle('first_store_live', { email: 'ada@example.com', plan: 'basic' }, {
    links: [{ name: 'Spotify', open: 'not-a-url' }],
  });
  assert.ok(fakeLink.text.indexOf('We’ll add the store link when it’s public.') !== -1);

  [signupMail, uploadMail, liveBasic, livePro, liveNoLink].forEach((mail) => {
    const blob = mail.subject + mail.text + mail.html;
    assert.ok(!/ToneGrid|DistroKid|InterSpace|Flossy|hello@/i.test(blob));
    assert.ok(!/monetize instantly|95\s*%/i.test(blob));
  });

  await withEnv({
    RESEND_API_KEY: undefined,
    CONFIRM_FROM: undefined,
  }, async () => {
    const skipped = await mailCopy.sendLifecycleEmail('signup', { email: 'ada@example.com' }, {});
    assert.strictEqual(skipped.mail_sent, false);
    assert.strictEqual(skipped.error, 'Mail is not configured.');
    assert.strictEqual(mailCopy.lifecycleFrom(), 'PLAIGROUND <confirm@wannaplai.com>');
  });

  const prevFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init: init });
    return { ok: true, status: 200, json: async () => ({ id: 're_test' }) };
  };
  try {
    await withEnv({
      RESEND_API_KEY: 're_test_key',
      CONFIRM_FROM: undefined,
    }, async () => {
      const sent = await mailCopy.sendLifecycleEmail('signup', { email: 'Ada@Example.com' }, {});
      assert.strictEqual(sent.mail_sent, true);
      assert.strictEqual(sent.from, 'PLAIGROUND <confirm@wannaplai.com>');
      const body = JSON.parse(calls[0].init.body);
      assert.strictEqual(body.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.deepStrictEqual(body.to, ['ada@example.com']);
      assert.strictEqual(body.subject, 'You’re in. One song is free.');
      assert.ok(!String(body.from).toLowerCase().includes('gmail.com'));
      assert.ok(!String(body.from).toLowerCase().includes('hello@'));
    });

    calls.length = 0;
    await withEnv({
      RESEND_API_KEY: 're_test_key',
      CONFIRM_FROM: 'PLAIGROUND <hello@wannaplai.com>',
    }, async () => {
      const sent = await mailCopy.sendLifecycleEmail('first_upload', { email: 'ada@example.com' }, {});
      assert.strictEqual(sent.mail_sent, true);
      assert.strictEqual(sent.from, 'PLAIGROUND <confirm@wannaplai.com>');
    });
  } finally {
    global.fetch = prevFetch;
  }

  assert.strictEqual(pixelId({ META_PIXEL_ID: '' }), '');
  assert.strictEqual(pixelId({ META_PIXEL_ID: 'not-a-pixel' }), '');
  assert.strictEqual(pixelId({ META_PIXEL_ID: '123456789012345' }), '123456789012345');
  assert.ok(isPublicPage('/signup.html'));
  assert.ok(isPublicPage('/index.html'));
  assert.ok(!isPublicPage('/upload.html'));
  assert.ok(!isPublicPage('/dashboard.html'));

  await withEnv({ META_PIXEL_ID: undefined }, async () => {
    const res = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/pixel', headers: {} }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(json(res).pixel_id, '');
  });
  await withEnv({ META_PIXEL_ID: '123456789012345' }, async () => {
    const res = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/pixel', headers: {} }, res);
    assert.strictEqual(json(res).pixel_id, '123456789012345');
  });

  const siteJs = read('site.js');
  assert.ok(siteJs.includes('/api/auth/pixel'));
  assert.ok(siteJs.includes('PageView'));
  assert.ok(siteJs.includes('CompleteRegistration'));
  assert.ok(siteJs.includes('META_PIXEL_ID') === false);
  assert.ok(!/fbq\(\s*['"]init['"]\s*,\s*['"]\d+['"]/.test(siteJs));
  assert.ok(!/track\(\s*['"]Upload['"]/.test(siteJs));
  assert.ok(!/track\(\s*['"]Purchase['"]/.test(siteJs));
  assert.ok(!siteJs.includes('Purchase'));
  assert.ok(siteJs.indexOf("track('Upload'") === -1);

  const signupHtml = read('signup.html');
  assert.ok(signupHtml.includes('plaigroundCompleteRegistration'));
  assert.ok(signupHtml.includes('CompleteRegistration'));
  assert.ok(!/fbq\(\s*['"]track['"]\s*,\s*['"]Upload['"]/.test(signupHtml));
  assert.ok(!/fbq\(\s*['"]track['"]\s*,\s*['"]Purchase['"]/.test(signupHtml));

  const growthMailSrc = read('lib/growth-mail.js');
  assert.ok(growthMailSrc.includes('confirm@wannaplai.com'));
  assert.ok(!/<(?:hello@wannaplai\.com|hello@)/.test(growthMailSrc));
  assert.ok(growthMailSrc.includes('emailplaiground@gmail.com'), 'submitted mail PS is emailplaiground@gmail.com');
  assert.ok(!/from:.*gmail/i.test(growthMailSrc));

  const webhookSrc = read('lib/stripe-webhook.js');
  assert.ok(webhookSrc.includes('recordPaid'));
  assert.ok(webhookSrc.includes('notifyPaid'));

  const accountsSrc = read('lib/accounts.js');
  assert.ok(!accountsSrc.includes('recordFirstUpload'), 'catalog writes must not mail first_upload');

  const tonegridSrc = read('api/tonegrid.js');
  assert.ok(tonegridSrc.includes('recordFirstUpload'));
  assert.ok(tonegridSrc.includes('notifyFirstUpload'));
  assert.ok(tonegridSrc.includes('recordFirstStoreLive'));
  assert.ok(!/\/distribute|\/approve/.test(tonegridSrc.match(/notifyFirstStoreLive[\s\S]{0,200}/)[0]));

  [
    'lib/growth-events.js',
    'lib/growth-mail.js',
    'lib/growth-pixel.js',
    'schema.sql',
    'api/auth.js',
    'signup.html',
  ].forEach((rel) => {
    const src = read(rel);
    assert.ok(!/referral|invite.?code|share card|suno-to-spotify/i.test(src), rel + ' must not ship referral');
    assert.ok(!/\$10 Creator|creator credit|referral credit/i.test(src), rel + ' must not ship a $10 Creator credit');
  });

  console.log('growth-events.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
