'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const authApi = require('../api/auth');
const meApi = require('../api/me');
const growth = require('./growth-events');
const mailCopy = require('./growth-mail');
const mailFailures = require('./mail-failures');
const { ga4MeasurementId, pixelId, tiktokPixelId, isPublicPage, adsAllowed } = require('./growth-pixel');
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

function cookieFrom(res) {
  return String(res.headers['Set-Cookie'] || '').split(';')[0];
}

async function withEnv(env, fn) {
  const keys = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'RESEND_API_KEY',
    'CONFIRM_SECRET',
    'CONFIRM_FROM',
    'META_PIXEL_ID',
    'TIKTOK_PIXEL_ID',
    'GA4_MEASUREMENT_ID',
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

  const uploadMail = mailCopy.buildLifecycle('first_upload', { email: 'ada@example.com' }, {
    title: 'Cash',
    release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    release_date: '2026-11-14',
  });
  assert.strictEqual(uploadMail.subject, 'Your FIRST song! Submitted, in QC');
  assert.ok(uploadMail.text.indexOf('Your FIRST song!') !== -1);
  assert.ok(uploadMail.text.indexOf('Your first song has been submitted!') !== -1);
  assert.ok(uploadMail.text.indexOf('We are now going through QC and will email you as soon as it’s Live!') !== -1);
  assert.ok(uploadMail.text.indexOf('1. Submitted. Done.') !== -1);
  assert.ok(uploadMail.text.indexOf('2. In QC review. You are here.') !== -1);
  assert.ok(uploadMail.text.indexOf('3. Released to stores (on release date).') !== -1);
  assert.ok(uploadMail.text.indexOf('4. Live and growing.') !== -1);
  assert.ok(uploadMail.text.indexOf('While you wait, do this for your song') !== -1);
  assert.ok(uploadMail.text.indexOf('Finish your artist profile → https://www.wannaplai.com/artists.html') !== -1);
  assert.ok(uploadMail.text.indexOf('Finish your EPK → https://www.wannaplai.com/epk') !== -1);
  assert.ok(uploadMail.text.indexOf('Plan your release → https://www.wannaplai.com/destination') !== -1);
  assert.ok(uploadMail.text.indexOf('See the charts → https://www.wannaplai.com/charts') !== -1);
  assert.ok(uploadMail.html.indexOf('Where your song is') !== -1);
  assert.ok(uploadMail.html.indexOf('https://www.wannaplai.com/artists.html') !== -1);
  assert.ok(uploadMail.html.indexOf('https://www.wannaplai.com/epk') !== -1);
  assert.ok(uploadMail.html.indexOf('https://www.wannaplai.com/destination') !== -1);
  assert.ok(uploadMail.html.indexOf('https://www.wannaplai.com/charts') !== -1);
  assert.ok(uploadMail.text.indexOf('Song: Cash') !== -1);
  assert.ok(uploadMail.text.indexOf('Release ID: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') !== -1);
  assert.ok(uploadMail.text.indexOf('Release date: November 14, 2026') !== -1);
  assert.ok(uploadMail.text.indexOf('What happens next: we review it in QC.') !== -1);
  assert.ok(uploadMail.text.indexOf('Dashboard → https://www.wannaplai.com/dashboard.html') !== -1);
  assert.ok(uploadMail.text.indexOf('FAQ → https://www.wannaplai.com/faq.html') !== -1);
  assert.ok(uploadMail.text.indexOf('SIQA Charts → https://www.wannaplai.com/charts') !== -1);
  assert.ok(uploadMail.html.indexOf('https://www.wannaplai.com/assets/plai-avatar.png') !== -1);
  assert.ok(uploadMail.html.indexOf('https://www.wannaplai.com/assets/plaiground-logo.png') !== -1);
  assert.ok(uploadMail.html.indexOf('https://www.wannaplai.com/assets/plaiground-wordmark-live.png') !== -1);
  assert.ok(uploadMail.html.indexOf('Cash') !== -1);
  assert.ok(uploadMail.html.indexOf('max-width:560px') !== -1);
  assert.ok(!/[—–]/.test(uploadMail.subject + uploadMail.text + uploadMail.html));
  assert.ok(!/pre-save|presave|teaser/i.test(uploadMail.text + uploadMail.html));
  assert.ok(!/ToneGrid|Suno/i.test(uploadMail.text + uploadMail.html));
  const everyMail = mailCopy.buildLifecycle('song_submitted', { email: 'ada@example.com' }, {
    title: 'Cash',
    release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    release_date: '2026-12-01',
  });
  assert.strictEqual(everyMail.subject, 'Submitted, in QC');
  assert.ok(everyMail.text.indexOf('Your song has been submitted.') !== -1);
  assert.ok(everyMail.text.indexOf('Song: Cash') !== -1);
  assert.ok(everyMail.text.indexOf('Release date: December 1, 2026') !== -1);
  assert.ok(everyMail.text.indexOf('Dashboard → https://www.wannaplai.com/dashboard.html') !== -1);
  assert.ok(everyMail.html.indexOf('https://www.wannaplai.com/assets/plai-avatar.png') !== -1);
  assert.ok(!/first song/i.test(everyMail.subject + everyMail.text));
  assert.ok(everyMail.text.indexOf('1. Submitted. Done.') !== -1);
  assert.ok(everyMail.text.indexOf('2. In QC review. You are here.') !== -1);
  assert.ok(everyMail.text.indexOf('While you wait, do this for your song') !== -1);
  assert.ok(everyMail.html.indexOf('https://www.wannaplai.com/destination') !== -1);
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
  assert.ok(liveBasic.text.indexOf('Your first song is live.') !== -1);
  assert.ok(liveBasic.text.indexOf('What happens next: share the link') !== -1);
  assert.ok(liveBasic.text.indexOf('Dashboard → https://www.wannaplai.com/dashboard.html') !== -1);
  assert.ok(liveBasic.text.indexOf('FAQ → https://www.wannaplai.com/faq.html') !== -1);
  assert.ok(liveBasic.html.indexOf('https://www.wannaplai.com/assets/plai-avatar.png') !== -1);
  assert.ok(liveBasic.html.indexOf('https://www.wannaplai.com/assets/plaiground-logo.png') !== -1);
  assert.ok(liveBasic.text.indexOf('1. Submitted. Done.') !== -1);
  assert.ok(liveBasic.text.indexOf('2. In QC review. Done.') !== -1);
  assert.ok(liveBasic.text.indexOf('3. Released to stores (on release date). Done.') !== -1);
  assert.ok(liveBasic.text.indexOf('4. Live and growing.') !== -1);
  assert.ok(liveBasic.text.indexOf('You are here') === -1);
  assert.ok(liveBasic.html.indexOf('Where your song is') !== -1);
  assert.ok(liveBasic.text.indexOf('Here’s the link. Post it, share it, and start your next one.') !== -1);
  assert.ok(liveBasic.text.indexOf('Track 2 is how you keep 0%') === -1);
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

  const laterLive = mailCopy.buildLifecycle('song_live', { email: 'ada@example.com', plan: 'pro' }, {
    title: 'Next One',
    release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    release_date: '2026-12-01',
  });
  assert.strictEqual(laterLive.subject, 'It’s up.');
  assert.ok(laterLive.text.indexOf('Your song is live.') !== -1);
  assert.ok(laterLive.text.indexOf('Here’s the link. Post it, share it, and start your next one.') !== -1);
  assert.ok(laterLive.text.indexOf('Track 2 is how you keep 0%') === -1);
  assert.ok(laterLive.text.indexOf('Song: Next One') !== -1);
  assert.ok(laterLive.text.indexOf('Release date: December 1, 2026') !== -1);
  assert.ok(!/first song/i.test(laterLive.subject + laterLive.text));
  assert.ok(laterLive.html.indexOf('https://www.wannaplai.com/assets/plai-avatar.png') !== -1);
  assert.ok(!/[—–]/.test(laterLive.subject + laterLive.text + laterLive.html));

  [signupMail, uploadMail, everyMail, liveBasic, livePro, liveNoLink, laterLive].forEach((mail) => {
    const blob = mail.subject + mail.text + mail.html;
    assert.ok(!/ToneGrid|DistroKid|InterSpace|Flossy|hello@/i.test(blob));
    assert.ok(!/monetize instantly|95\s*%/i.test(blob));
    assert.ok(!/[—–]/.test(blob));
    assert.ok(!/\bSuno\b/i.test(blob));
  });

  await withEnv({
    RESEND_API_KEY: undefined,
    CONFIRM_FROM: undefined,
  }, async () => {
    mailFailures.useMemoryStore();
    const skipped = await mailCopy.sendLifecycleEmail('signup', { email: 'ada@example.com' }, {});
    assert.strictEqual(skipped.mail_sent, false);
    assert.strictEqual(skipped.error, 'Mail is not configured.');
    assert.strictEqual(mailCopy.lifecycleFrom(), 'PLAIGROUND <confirm@wannaplai.com>');
    const missed = await mailFailures.listMailFailures();
    assert.strictEqual(missed.length, 1);
    assert.strictEqual(missed[0].error, 'Mail is not configured.');
    assert.strictEqual(missed[0].to_email, 'ada@example.com');
    assert.strictEqual(missed[0].event_name, 'signup');
    assert.ok(!/password|api[\s_-]*key|secret/i.test(JSON.stringify(missed[0])));
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
      assert.deepStrictEqual(body.bcc, ['emailplaiground@gmail.com']);
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

    calls.length = 0;
    await withEnv({
      DATABASE_URL: 'postgres://memory',
      SESSION_SECRET: 'unit-test-session-secret',
      CONFIRM_SECRET: 'unit-confirm-secret',
      RESEND_API_KEY: 're_test_key',
      CONFIRM_FROM: undefined,
      memory: true,
    }, async () => {
      const user = await signupUser('song@example.com', 'basic');
      calls.length = 0;
      const first = await growth.recordFirstUpload(user, {
        release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Cash',
        release_date: '2026-11-14',
      });
      assert.strictEqual(first.recorded, true);
      const firstBodies = calls.map(function (call) { return JSON.parse(call.init.body); });
      assert.strictEqual(firstBodies.length, 1);
      assert.strictEqual(firstBodies[0].subject, 'Your FIRST song! Submitted, in QC');
      assert.ok(firstBodies[0].text.indexOf('Song: Cash') !== -1);
      assert.ok(firstBodies[0].text.indexOf('Release date: November 14, 2026') !== -1);
      assert.deepStrictEqual(firstBodies[0].to, ['song@example.com']);
      assert.deepStrictEqual(firstBodies[0].bcc, ['emailplaiground@gmail.com']);
      assert.ok(firstBodies[0].text && firstBodies[0].html);
      calls.length = 0;
      const again = await growth.recordFirstUpload(user, {
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        title: 'Next One',
        release_date: '2026-12-01',
      });
      assert.strictEqual(again.recorded, false);
      assert.strictEqual(again.reason, 'duplicate');
      const nextBodies = calls.map(function (call) { return JSON.parse(call.init.body); });
      assert.strictEqual(nextBodies.length, 1);
      assert.strictEqual(nextBodies[0].subject, 'Submitted, in QC');
      assert.ok(nextBodies[0].text.indexOf('2. In QC review. You are here.') !== -1);
      assert.ok(nextBodies[0].text.indexOf('Song: Next One') !== -1);
      assert.ok(!/first song/i.test(nextBodies[0].subject + nextBodies[0].text));
      assert.deepStrictEqual(nextBodies[0].to, ['song@example.com']);
      assert.deepStrictEqual(nextBodies[0].bcc, ['emailplaiground@gmail.com']);
      calls.length = 0;
      const live = await growth.recordFirstStoreLive(user, 'live', {
        release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Cash',
        release_date: '2026-11-14',
        links: [{ name: 'Spotify', open: 'https://open.spotify.com/album/abc123def456abc123def4' }],
      });
      assert.strictEqual(live.recorded, true);
      const liveBodies = calls.map(function (call) { return JSON.parse(call.init.body); });
      assert.strictEqual(liveBodies.length, 1);
      assert.strictEqual(liveBodies[0].subject, 'It’s up.');
      assert.ok(liveBodies[0].text.indexOf('Your first song is live.') !== -1);
      assert.ok(liveBodies[0].text.indexOf('Song: Cash') !== -1);
      assert.deepStrictEqual(liveBodies[0].bcc, ['emailplaiground@gmail.com']);
      calls.length = 0;
      const sameLive = await growth.recordFirstStoreLive(user, 'delivered', {
        release_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Cash',
      });
      assert.strictEqual(sameLive.recorded, false);
      assert.strictEqual(calls.length, 0);
      const nextLive = await growth.recordFirstStoreLive(user, 'live', {
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        title: 'Next One',
        release_date: '2026-12-01',
      });
      assert.strictEqual(nextLive.recorded, false);
      const nextLiveBodies = calls.map(function (call) { return JSON.parse(call.init.body); });
      assert.strictEqual(nextLiveBodies.length, 1);
      assert.strictEqual(nextLiveBodies[0].subject, 'It’s up.');
      assert.ok(nextLiveBodies[0].text.indexOf('Your song is live.') !== -1);
      assert.ok(nextLiveBodies[0].text.indexOf('Song: Next One') !== -1);
      assert.ok(!/first song/i.test(nextLiveBodies[0].subject + nextLiveBodies[0].text));
      assert.deepStrictEqual(nextLiveBodies[0].bcc, ['emailplaiground@gmail.com']);
    });

    calls.length = 0;
    global.fetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Domain is not verified' }),
    });
    await withEnv({
      DATABASE_URL: 'postgres://memory',
      SESSION_SECRET: 'unit-test-session-secret',
      CONFIRM_SECRET: 'unit-confirm-secret',
      RESEND_API_KEY: 're_test_key',
      CONFIRM_FROM: undefined,
      memory: true,
    }, async () => {
      mailFailures.useMemoryStore();
      const failed = await mailCopy.sendLifecycleEmail('song_submitted', {
        email: 'ada@example.com',
      }, {
        release_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        title: 'Cash',
      });
      assert.strictEqual(failed.mail_sent, false);
      assert.strictEqual(failed.error, 'Domain is not verified');
      const rows = await mailFailures.listMailFailures();
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].error, 'Domain is not verified');
      assert.strictEqual(rows[0].event_name, 'song_submitted');
      assert.strictEqual(rows[0].to_email, 'ada@example.com');
      assert.strictEqual(rows[0].release_id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
      assert.strictEqual(rows[0].subject, 'Submitted, in QC');
      assert.ok(!/re_test_key|password|api[\s_-]*key/i.test(JSON.stringify(rows)));

      global.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid api_key re_test_key' }),
      });
      mailFailures.useMemoryStore();
      const hidden = await mailCopy.sendLifecycleEmail('first_upload', { email: 'ada@example.com' }, {});
      assert.strictEqual(hidden.mail_sent, false);
      assert.strictEqual(hidden.error, 'Mail provider rejected the request.');
      const hiddenRows = await mailFailures.listMailFailures();
      assert.strictEqual(hiddenRows.length, 1);
      assert.ok(!/re_test_key|api_key/i.test(JSON.stringify(hiddenRows)));

      calls.length = 0;
      global.fetch = async (url, init) => {
        calls.push({ url: String(url), init: init });
        return { ok: true, status: 200, json: async () => ({ id: 're_owner' }) };
      };
      const quiet = await mailCopy.sendLifecycleEmail('song_submitted', {
        email: 'emailplaiground@gmail.com',
      }, { title: 'Cash' });
      assert.strictEqual(quiet.mail_sent, true);
      assert.strictEqual(calls.length, 1);
      const ownerBody = JSON.parse(calls[0].init.body);
      assert.deepStrictEqual(ownerBody.to, ['emailplaiground@gmail.com']);
      assert.ok(!ownerBody.bcc);

      const anon = mockRes();
      await meApi({ method: 'GET', url: '/api/admin/mail-failures', headers: {} }, anon);
      assert.strictEqual(anon.statusCode, 401);

      async function loginCookie(email) {
        const signed = mockRes();
        await authApi({
          method: 'POST',
          url: '/api/auth/signup',
          headers: {},
          body: { email: email, password: 'password1', artist: 'Ada Night', plan: 'basic' },
        }, signed);
        assert.strictEqual(signed.statusCode, 200, signed.body);
        await accounts.confirmEmail(email);
        const loginRes = mockRes();
        await authApi({
          method: 'POST',
          url: '/api/auth/login',
          headers: {},
          body: { email: email, password: 'password1' },
        }, loginRes);
        assert.strictEqual(loginRes.statusCode, 200, loginRes.body);
        return cookieFrom(loginRes);
      }

      const stranger = await loginCookie('other-mail@example.com');
      const denied = mockRes();
      await meApi({
        method: 'GET',
        url: '/api/admin/mail-failures',
        headers: { cookie: stranger },
      }, denied);
      assert.strictEqual(denied.statusCode, 403);

      const owner = await loginCookie('emailplaiground@gmail.com');
      const desk = mockRes();
      await meApi({
        method: 'GET',
        url: '/api/me?action=admin-mail-failures',
        headers: { cookie: owner },
      }, desk);
      assert.strictEqual(desk.statusCode, 200, desk.body);
      const listed = json(desk).failures;
      assert.ok(listed.some(function (row) { return row.error === 'Mail provider rejected the request.'; }));
      assert.ok(!JSON.stringify(listed).includes('password1'));
      assert.ok(!JSON.stringify(listed).includes('re_test_key'));
    });
  } finally {
    global.fetch = prevFetch;
  }

  const { GA4_FALLBACK, META_FALLBACK } = require('./growth-pixel');
  assert.strictEqual(pixelId({ META_PIXEL_ID: '' }), META_FALLBACK);
  assert.strictEqual(pixelId({ META_PIXEL_ID: 'not-a-pixel' }), '');
  assert.strictEqual(pixelId({ META_PIXEL_ID: '123456789012345' }), '123456789012345');
  assert.strictEqual(tiktokPixelId({ TIKTOK_PIXEL_ID: '' }), '');
  assert.strictEqual(tiktokPixelId({ TIKTOK_PIXEL_ID: 'short' }), '');
  assert.strictEqual(tiktokPixelId({ TIKTOK_PIXEL_ID: 'C1234567890' }), 'C1234567890');
  assert.strictEqual(ga4MeasurementId({ GA4_MEASUREMENT_ID: '' }), GA4_FALLBACK);
  assert.strictEqual(ga4MeasurementId({ GA4_MEASUREMENT_ID: 'UA-1' }), '');
  assert.strictEqual(ga4MeasurementId({ GA4_MEASUREMENT_ID: 'G-TEST1234' }), 'G-TEST1234');
  assert.strictEqual(adsAllowed(''), true);
  assert.strictEqual(adsAllowed('granted'), true);
  assert.strictEqual(adsAllowed('denied'), false);
  assert.ok(isPublicPage('/signup.html'));
  assert.ok(isPublicPage('/index.html'));
  assert.ok(isPublicPage('/song-helper'));
  assert.ok(isPublicPage('/cover-art'));
  assert.ok(!isPublicPage('/upload.html'));
  assert.ok(!isPublicPage('/dashboard.html'));

  await withEnv({ META_PIXEL_ID: undefined, GA4_MEASUREMENT_ID: undefined, TIKTOK_PIXEL_ID: undefined }, async () => {
    const res = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/pixel', headers: {} }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(json(res).pixel_id, META_FALLBACK);
    assert.strictEqual(json(res).tiktok_pixel_id, '');
    assert.strictEqual(json(res).ga4_measurement_id, GA4_FALLBACK);
  });
  await withEnv({ META_PIXEL_ID: '123456789012345', GA4_MEASUREMENT_ID: undefined, TIKTOK_PIXEL_ID: undefined }, async () => {
    const res = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/pixel', headers: {} }, res);
    assert.strictEqual(json(res).pixel_id, '123456789012345');
    assert.strictEqual(json(res).tiktok_pixel_id, '');
    assert.strictEqual(json(res).ga4_measurement_id, GA4_FALLBACK);
  });
  const prevTikTok = process.env.TIKTOK_PIXEL_ID;
  const prevGa4 = process.env.GA4_MEASUREMENT_ID;
  process.env.TIKTOK_PIXEL_ID = 'C1234567890';
  process.env.GA4_MEASUREMENT_ID = 'G-TEST1234';
  try {
    const res = mockRes();
    await authApi({ method: 'GET', url: '/api/auth/pixel', headers: {} }, res);
    assert.strictEqual(json(res).tiktok_pixel_id, 'C1234567890');
    assert.strictEqual(json(res).ga4_measurement_id, 'G-TEST1234');
  } finally {
    if (prevTikTok === undefined) delete process.env.TIKTOK_PIXEL_ID;
    else process.env.TIKTOK_PIXEL_ID = prevTikTok;
    if (prevGa4 === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = prevGa4;
  }

  const siteJs = read('site.js');
  assert.ok(siteJs.includes('/api/auth/pixel'));
  assert.ok(siteJs.includes('PageView'));
  assert.ok(siteJs.includes('trackPageView'));
  assert.ok(siteJs.includes('pushState'));
  assert.ok(siteJs.includes('hashchange'));
  assert.ok(siteJs.includes('G-3033FJLNC7'));
  assert.ok(siteJs.includes('1646654180170753'));
  assert.ok(siteJs.includes('SubmitApplication'));
  assert.ok(siteJs.includes('submit_application'));
  assert.ok(siteJs.includes('send_page_view: false'));
  assert.ok(siteJs.includes('vercel-insights'));
  assert.ok(read('product-events.js').includes("submission: 'SubmitApplication'"));
  assert.ok(read('product-events.js').includes("signup: 'CompleteRegistration'"));
  assert.ok(read('product-events.js').includes("distro_checkout_completed: 'Purchase'"));
  assert.ok(read('store-client.js').includes("name: 'submission'"));
  assert.ok(siteJs.includes('CompleteRegistration'));
  assert.ok(siteJs.includes('META_PIXEL_ID') === false);
  assert.ok(!/fbq\(\s*['"]init['"]\s*,\s*['"]\d+['"]/.test(siteJs));
  assert.ok(!/track\(\s*['"]Upload['"]/.test(siteJs));
  assert.ok(siteJs.includes('Purchase'));
  assert.ok(siteJs.includes('Lead'));
  assert.ok(siteJs.includes('InitiateCheckout'));
  assert.ok(siteJs.includes('plaiground_consent'));
  assert.ok(!/fbq\(\s*["']track["']\s*,\s*[^)]+,\s*\{/.test(siteJs));
  assert.ok(!/ttq\.identify/.test(siteJs));
  assert.ok(!/gtag\/js\?id=G-[A-Z0-9]/.test(siteJs));
  assert.ok(!/ttq\.load\(\s*['"][A-Za-z0-9]+['"]/.test(siteJs));
  assert.ok(siteJs.includes('TIKTOK_PIXEL_ID') === false);
  assert.ok(siteJs.includes('GA4_MEASUREMENT_ID') === false);
  assert.ok(!/track\(\s*['"]Purchase['"]/.test(siteJs));
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
  assert.ok(tonegridSrc.includes('notifyQcRelease'));
  assert.ok(tonegridSrc.includes('title: songTitle'));
  assert.ok(tonegridSrc.includes('release_date: releaseDate'));
  assert.ok(!/\/distribute|\/approve/.test(tonegridSrc.match(/notifyFirstStoreLive[\s\S]{0,200}/)[0]));
  assert.ok(read('vercel.json').includes('/api/admin/mail-failures'));
  assert.ok(read('api/me.js').includes('admin-mail-failures'));
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'api', 'mail-failures.js')));

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

  const prevOwnerFetch = global.fetch;
  const ownerCalls = [];
  global.fetch = async (url, init) => {
    ownerCalls.push({ url: String(url), init: init });
    return { ok: true, status: 200, json: async () => ({ id: 're_owner' }) };
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
      const user = await signupUser('nova@example.com', 'basic');
      const bodies = ownerCalls.map((call) => JSON.parse(call.init.body));
      const owner = bodies.find((body) => body.subject === 'New signup');
      assert.ok(owner, 'signup emails the owner');
      assert.deepStrictEqual(owner.to, ['emailplaiground@gmail.com']);
      assert.strictEqual(owner.from, 'PLAIGROUND <confirm@wannaplai.com>');
      assert.ok(owner.text.includes('Name: Ada Night'));
      assert.ok(owner.text.includes('Email: nova@example.com'));
      assert.ok(owner.text.includes('Plan: Free account'));
      assert.ok(/\bPT\b/.test(owner.text));
      assert.ok(!owner.text.includes('password1'));
      assert.ok(!owner.text.includes(user.password_hash));
      assert.ok(!/password/i.test(owner.text + owner.html));
      assert.ok(bodies.some((body) => body.subject !== 'New signup' && (body.to || []).indexOf('nova@example.com') !== -1), 'the artist still gets their own mail');
      const before = bodies.filter((body) => body.subject === 'New signup').length;
      const again = await growth.recordSignup(user);
      assert.strictEqual(again.recorded, false);
      const after = ownerCalls.map((call) => JSON.parse(call.init.body)).filter((body) => body.subject === 'New signup');
      assert.strictEqual(after.length, before, 'a duplicate signup does not email again');
    });
  } finally {
    global.fetch = prevOwnerFetch;
  }

  const testCalls = [];
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    testCalls.push(body);
    if (body.subject === '[TEST] Submitted, in QC') {
      return { ok: false, status: 422, json: async () => ({ message: 'Domain is not verified' }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: 're_test_mail' }) };
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
      const open = mockRes();
      await meApi({
        method: 'POST',
        url: '/api/admin/test-emails',
        headers: {},
        body: { email: 'artist@example.com' },
      }, open);
      assert.strictEqual(open.statusCode, 401);

      async function loginCookie(email) {
        const signed = mockRes();
        await authApi({
          method: 'POST',
          url: '/api/auth/signup',
          headers: {},
          body: { email: email, password: 'password1', artist: 'Ada Night', plan: 'basic' },
        }, signed);
        assert.strictEqual(signed.statusCode, 200, signed.body);
        await accounts.confirmEmail(email);
        const loginRes = mockRes();
        await authApi({
          method: 'POST',
          url: '/api/auth/login',
          headers: {},
          body: { email: email, password: 'password1' },
        }, loginRes);
        assert.strictEqual(loginRes.statusCode, 200, loginRes.body);
        return cookieFrom(loginRes);
      }

      const stranger = await loginCookie('artist-test@example.com');
      testCalls.length = 0;
      const denied = mockRes();
      await meApi({
        method: 'POST',
        url: '/api/me?action=admin-test-emails',
        headers: { cookie: stranger },
        body: { email: 'artist@example.com' },
      }, denied);
      assert.strictEqual(denied.statusCode, 403);
      assert.strictEqual(testCalls.length, 0);

      const owner = await loginCookie('emailplaiground@gmail.com');
      testCalls.length = 0;
      const sent = mockRes();
      await meApi({
        method: 'POST',
        url: '/api/admin/test-emails',
        headers: { cookie: owner },
        body: { email: 'artist@example.com', to: 'artist@example.com' },
      }, sent);
      assert.strictEqual(sent.statusCode, 200, sent.body);
      const report = json(sent).emails;
      assert.strictEqual(report.length, 4);
      assert.deepStrictEqual(report.map((row) => row.label), [
        'First song submitted',
        'Later submitted',
        'First live',
        'Later live',
      ]);
      assert.strictEqual(report[0].mail_sent, true);
      assert.strictEqual(report[1].mail_sent, false);
      assert.strictEqual(report[1].error, 'Domain is not verified');
      assert.strictEqual(report[2].mail_sent, true);
      assert.strictEqual(report[3].mail_sent, true);
      assert.strictEqual(testCalls.length, 4);
      testCalls.forEach((body) => {
        assert.deepStrictEqual(body.to, ['emailplaiground@gmail.com']);
        assert.ok(!body.bcc);
        assert.ok(body.subject.indexOf('[TEST] ') === 0);
        assert.ok(body.text.indexOf('TEST song. Not a real release.') !== -1);
        assert.ok(body.text.indexOf('Release ID: test-not-a-release') !== -1);
        assert.ok(body.text.indexOf('not sent to an artist') !== -1);
        assert.ok(!JSON.stringify(body).includes('artist@example.com'));
        assert.ok(!JSON.stringify(body).includes('artist-test@example.com'));
      });
      assert.strictEqual(testCalls[0].subject, 'Your FIRST song! Submitted, in QC'.replace(/^/, '[TEST] '));
      assert.ok(testCalls[2].text.indexOf('Your first song is live.') !== -1);
      assert.ok(testCalls[3].text.indexOf('Your song is live.') !== -1);
      const failures = await mailFailures.listMailFailures();
      const failed = failures.find((row) => row.event_name === 'song_submitted');
      assert.ok(failed);
      assert.strictEqual(failed.to_email, 'emailplaiground@gmail.com');
      assert.strictEqual(failed.release_id, 'test-not-a-release');
      assert.strictEqual(failed.error, 'Domain is not verified');
      assert.ok(!JSON.stringify(failures).includes('artist@example.com'));

      const again = mockRes();
      await meApi({
        method: 'POST',
        url: '/api/admin/test-emails',
        headers: { cookie: owner },
        body: {},
      }, again);
      assert.strictEqual(again.statusCode, 429, again.body);
      assert.strictEqual(testCalls.length, 4);
      assert.ok(json(again).error.indexOf('Wait a minute') !== -1);
    });
  } finally {
    global.fetch = prevOwnerFetch;
  }

  console.log('growth-events.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
