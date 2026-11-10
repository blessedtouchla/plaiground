'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const publishing = require('./publishing');

const root = path.join(__dirname, '..');
const NOW = new Date('2026-11-02T15:00:00.000Z');
const ARTIST = '11111111-1111-4111-8111-111111111111';
const OTHER = '33333333-3333-4333-8333-333333333333';
const CREATOR = '22222222-2222-4222-8222-222222222222';

function user(id, plan, email) {
  return {
    id: id,
    email: email,
    plan: plan || 'basic',
    tonegrid_release_ids: [],
    tonegrid_release_at: [],
  };
}

function body(over) {
  return Object.assign({
    performing_artist: 'Ada Night',
    pro: 'BMI',
    ipi: '00123456789',
    title: 'Paper Boat',
    writers: [
      { name: 'Ada Night', pro: 'BMI', share: 60, ipi: '00123456789' },
      { name: 'Bo Lane', pro: 'SESAC', share: 40 },
    ],
    publisher_share_percent: 25,
    other_publishers: [{ name: 'Lane Music', share: 25 }],
    made_how: 'no_ai',
    human_contribution: 'Wrote the lyrics and the melody.',
    credits: { performers: 'Ada Night', producers: 'Bo Lane', featured: 'Cee Guest' },
    mandate: true,
    idempotency_key: 'paper-boat-1',
  }, over || {});
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

async function main() {
  const accounts = require('./accounts');
  const prev = {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    ADMIN_READONLY_TOKEN: process.env.ADMIN_READONLY_TOKEN,
  };
  process.env.DATABASE_URL = 'postgres://memory';
  process.env.SESSION_SECRET = 'publishing-intake-test-secret';
  accounts.resetStore();
  accounts.useMemoryStore();
  publishing.resetStore();

  assert.strictEqual(publishing.eligibilityOf('fully_ai', 'Typed prompts until the song appeared.').eligibility, 'not_eligible');
  assert.strictEqual(publishing.eligibilityOf('ai_assisted', 'Prompts only').eligibility, 'not_eligible');
  assert.strictEqual(publishing.eligibilityOf('ai_assisted', 'Wrote the chorus lyric and edited the melody.').eligibility, 'review');
  assert.strictEqual(publishing.eligibilityOf('no_ai', 'Wrote the lyrics and the melody.').eligibility, 'eligible');
  assert.strictEqual(publishing.eligibilityOf('unsure', 'I changed some words.').eligibility, 'review');
  assert.strictEqual(publishing.legalReview().signing_integration, false);
  assert.strictEqual(publishing.legalReview().approved_template, false);
  assert.strictEqual(publishing.legalReview().pro_api, false);
  assert.ok(!/signwell\.com|\/api\/signwell/i.test(fs.readFileSync(path.join(__dirname, 'publishing.js'), 'utf8')));
  assert.ok(!/\u2014/.test(fs.readFileSync(path.join(__dirname, 'publishing.js'), 'utf8')));

  const schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');
  assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS publishing_registrations'));
  assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS publishing_events'));
  assert.ok(schema.includes('CONSTRAINT publishing_agreements_reviewed CHECK (reviewed = true)'));
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.ok((vercel.rewrites || []).some((row) => row.source === '/api/me/publishing' && row.destination === '/api/me?action=publishing'));
  assert.ok((vercel.rewrites || []).some((row) => row.source === '/api/admin/publishing' && row.destination === '/api/me?action=admin-publishing'));
  assert.ok(fs.readFileSync(path.join(root, 'api/me.js'), 'utf8').includes("require('../lib/publishing')"));

  const missingShare = await publishing.submitOwn(user(ARTIST), body({ publisher_share_percent: '', idempotency_key: 'paper-boat-blank' }), NOW);
  assert.strictEqual(missingShare.status, 400);
  assert.ok(/not filled in/i.test(missingShare.body.error));

  const noMandate = await publishing.submitOwn(user(ARTIST), body({ mandate: false, idempotency_key: 'paper-boat-nomandate' }), NOW);
  assert.strictEqual(noMandate.status, 400);
  assert.ok(/not a publishing contract/i.test(noMandate.body.error));

  const contract = await publishing.submitOwn(user(ARTIST), body({ contract_text: 'signed today', idempotency_key: 'paper-boat-contract' }), NOW);
  assert.strictEqual(contract.status, 400);

  const saved = await publishing.submitOwn(user(ARTIST), body(), NOW);
  assert.strictEqual(saved.status, 201, JSON.stringify(saved.body));
  const row = saved.body.registrations[0];
  assert.strictEqual(row.status, 'needs_agreement');
  assert.strictEqual(row.public_status, 'not_covered');
  assert.strictEqual(row.status_label, 'Not covered');
  assert.notStrictEqual(row.status_label, 'Pending at BMI');
  assert.ok(/Nothing has been sent|not filing/i.test(row.status_detail));
  assert.strictEqual(row.publisher_share_percent, 25);
  assert.strictEqual(row.publisher_share_explicit, true);
  assert.strictEqual(row.mandate_is_contract, false);
  assert.strictEqual(row.agreement, null);
  assert.strictEqual(row.credits.featured, 'Cee Guest');
  assert.strictEqual(row.writers[1].pro, 'SESAC');
  assert.strictEqual(row.events[0].to_status, 'request_received');
  assert.strictEqual(row.events[1].to_status, 'needs_agreement');
  assert.strictEqual(saved.body.legal_review.signing_integration, false);
  assert.strictEqual(saved.body.agreement_integration.available, false);

  const again = await publishing.submitOwn(user(ARTIST), body(), NOW);
  assert.strictEqual(again.status, 200);
  assert.strictEqual(again.body.idempotent, true);
  assert.strictEqual(again.body.registrations[0].id, row.id);

  const dup = await publishing.submitOwn(user(ARTIST), body({ idempotency_key: 'paper-boat-2' }), NOW);
  assert.strictEqual(dup.status, 409);

  const reloaded = await publishing.readOwn(user(ARTIST), { id: row.id });
  assert.strictEqual(reloaded.status, 200);
  assert.strictEqual(reloaded.body.registration.status, 'needs_agreement');
  assert.strictEqual(reloaded.body.registration.credits.producers, 'Bo Lane');
  const hidden = await publishing.readOwn(user(OTHER), { id: row.id });
  assert.strictEqual(hidden.status, 404);

  const album = await publishing.submitOwn(user(ARTIST), {
    performing_artist: 'Ada Night',
    pro: 'ASCAP',
    ipi: '00987654321',
    album_title: 'Harbor Lights',
    mandate: true,
    idempotency_key: 'harbor-lights-1',
    works: [
      {
        title: 'First Light',
        track_position: 1,
        writers: [{ name: 'Ada Night', pro: 'ASCAP', share: 100 }],
        publisher_share_percent: 10,
        made_how: 'ai_assisted',
        human_contribution: 'Wrote the vocal melody and the first verse.',
        credits: { performers: 'Ada Night', producers: 'Bo Lane', featured: 'Cee Guest' },
      },
      {
        title: 'Second Light',
        track_position: 2,
        writers: [{ name: 'Bo Lane', pro: 'BMI', share: 70 }, { name: 'Dee Cole', pro: 'GMR', share: 30 }],
        publisher_share_percent: 40,
        made_how: 'no_ai',
        human_contribution: 'Wrote the lyrics and the chord changes.',
        credits: { performers: 'Bo Lane', producers: 'Ada Night', featured: 'Dee Guest' },
      },
    ],
  }, NOW);
  assert.strictEqual(album.status, 201, JSON.stringify(album.body));
  assert.strictEqual(album.body.registrations.length, 2);
  assert.ok(album.body.registrations.every((item) => item.album_group_id && item.status === 'needs_agreement'));
  assert.strictEqual(album.body.registrations[0].credits.featured, 'Cee Guest');
  assert.strictEqual(album.body.registrations[1].credits.featured, 'Dee Guest');
  assert.strictEqual(album.body.registrations[0].publisher_share_percent, 10);
  assert.strictEqual(album.body.registrations[1].writers[0].pro, 'BMI');
  assert.strictEqual(album.body.registrations[1].writers[1].pro, 'GMR');
  const grouped = await publishing.readOwn(user(ARTIST), { group: album.body.registrations[0].album_group_id });
  assert.strictEqual(grouped.body.registrations.length, 2);
  assert.strictEqual(grouped.body.registrations[1].work_title, 'Second Light');
  const foreignGroup = await publishing.readOwn(user(OTHER), { group: album.body.registrations[0].album_group_id });
  assert.strictEqual(foreignGroup.status, 404);

  const fullAi = await publishing.submitOwn(user(ARTIST), body({
    title: 'Prompt Only',
    made_how: 'fully_ai',
    human_contribution: 'I typed prompts and kept the output.',
    idempotency_key: 'prompt-only-1',
  }), NOW);
  assert.strictEqual(fullAi.status, 201);
  assert.strictEqual(fullAi.body.registrations[0].status, 'needs_information');
  assert.strictEqual(fullAi.body.registrations[0].eligibility, 'not_eligible');

  const earlySubmit = await publishing.staffWrite(user('44444444-4444-4444-8444-444444444444', 'pro', 'emailplaiground@gmail.com'), {
    action: 'status',
    id: row.id,
    status: 'submitted',
    reference: 'BMI-12345',
  }, NOW);
  assert.strictEqual(earlySubmit.status, 409);

  const unreviewed = await publishing.staffWrite(user('44444444-4444-4444-8444-444444444444'), {
    action: 'agreement',
    user_id: ARTIST,
    reference: 'FILE-100',
    version: 'draft',
    signed_on: '2026-10-01',
    catalog_scope: { kind: 'account' },
    reviewed: false,
  }, NOW);
  assert.strictEqual(unreviewed.status, 400);

  const agreement = await publishing.staffWrite(user('44444444-4444-4444-8444-444444444444'), {
    action: 'agreement',
    user_id: ARTIST,
    reference: 'FILE-100',
    version: 'reviewed-2026-10-01',
    signed_on: '2026-10-01',
    catalog_scope: { kind: 'titles', titles: ['Paper Boat'] },
    reviewed: true,
    note: 'Reviewed outside this product.',
  }, NOW);
  assert.strictEqual(agreement.status, 201);
  assert.strictEqual(agreement.body.contract_stored, false);
  assert.deepStrictEqual(agreement.body.promoted, [row.id]);
  const held = await publishing.readOwn(user(ARTIST), { id: row.id });
  assert.strictEqual(held.body.registration.status, 'under_review');
  assert.strictEqual(held.body.registration.agreement.version, 'reviewed-2026-10-01');
  assert.strictEqual(held.body.registration.agreement.signed_on, '2026-10-01');
  const stillBlocked = await publishing.readOwn(user(ARTIST), { id: fullAi.body.registrations[0].id });
  assert.strictEqual(stillBlocked.body.registration.status, 'needs_information');
  const albumStillHeld = await publishing.readOwn(user(ARTIST), { id: album.body.registrations[0].id });
  assert.strictEqual(albumStillHeld.body.registration.status, 'needs_agreement');

  const submitted = await publishing.staffWrite(user('44444444-4444-4444-8444-444444444444'), {
    action: 'status',
    id: row.id,
    status: 'submitted',
    reference: 'PRO-REF-100',
    note: 'Filed by hand.',
  }, NOW);
  assert.strictEqual(submitted.status, 200, JSON.stringify(submitted.body));
  assert.strictEqual(submitted.body.registration.status, 'submitted');
  assert.strictEqual(submitted.body.registration.public_status, 'submitted');
  assert.strictEqual(submitted.body.registration.status_label, 'Submitted');
  assert.strictEqual(submitted.body.registration.external_reference, 'PRO-REF-100');
  assert.ok(submitted.body.registration.events.some((event) => event.to_status === 'submitted' && event.reference === 'PRO-REF-100'));

  const accepted = await publishing.staffWrite(user('44444444-4444-4444-8444-444444444444'), {
    action: 'status',
    id: row.id,
    status: 'accepted',
    evidence: 'Society email accepted the work on 2 Nov 2026.',
  }, NOW);
  assert.strictEqual(accepted.body.registration.status, 'accepted');
  assert.strictEqual(accepted.body.registration.public_status, 'registered');
  assert.strictEqual(accepted.body.registration.status_label, 'Registered');
  assert.ok(/Society email/.test(accepted.body.registration.evidence));
  const matchedBare = await publishing.staffWrite(user('44444444-4444-4444-8444-444444444444'), {
    action: 'status',
    id: row.id,
    status: 'matched',
  }, NOW);
  assert.strictEqual(matchedBare.status, 409);
  const matched = await publishing.staffWrite(user('44444444-4444-4444-8444-444444444444'), {
    action: 'status',
    id: row.id,
    status: 'matched',
    match_receipt: 'MLC match letter 3 Nov 2026.',
  }, NOW);
  assert.strictEqual(matched.status, 200, JSON.stringify(matched.body));
  assert.strictEqual(matched.body.registration.status_label, 'Matched');
  const paidBare = await publishing.staffWrite(user('44444444-4444-4444-8444-444444444444'), {
    action: 'status',
    id: row.id,
    status: 'paid',
    reference: 'no',
  }, NOW);
  assert.strictEqual(paidBare.status, 409);
  const paid = await publishing.staffWrite(user('44444444-4444-4444-8444-444444444444'), {
    action: 'status',
    id: row.id,
    status: 'paid',
    payment_receipt: 'Statement paid $12.40 on 4 Nov 2026.',
  }, NOW);
  assert.strictEqual(paid.status, 200, JSON.stringify(paid.body));
  assert.strictEqual(paid.body.registration.status_label, 'Paid');
  assert.strictEqual(paid.body.registration.public_status, 'paid');

  const badFile = await publishing.staffWrite(user('44444444-4444-4444-8444-444444444444'), {
    action: 'status',
    id: fullAi.body.registrations[0].id,
    status: 'submitted',
    reference: 'SHOULD-NOT',
  }, NOW);
  assert.strictEqual(badFile.status, 409);

  publishing.resetStore();
  accounts.useMemoryStore();
  const creator = user(CREATOR, 'creator', 'creator@example.com');
  for (let i = 0; i < 7; i += 1) {
    const made = await publishing.submitOwn(creator, body({
      title: 'Cap Song ' + i,
      idempotency_key: 'cap-song-' + i,
    }), NOW);
    assert.strictEqual(made.status, 201, made.body.error || '');
  }
  const tooMany = await publishing.submitOwn(creator, {
    performing_artist: 'Ada Night',
    pro: 'BMI',
    ipi: '00123456789',
    album_title: 'Cap Album',
    mandate: true,
    idempotency_key: 'cap-album-1',
    works: [
      body({ title: 'Cap Eight', idempotency_key: 'ignored-a' }),
      body({ title: 'Cap Nine', idempotency_key: 'ignored-b' }),
    ],
  }, NOW);
  assert.strictEqual(tooMany.status, 403);
  assert.strictEqual(tooMany.body.limit, 8);

  const queue = await publishing.staffRead({});
  assert.ok(queue.body.registrations.length >= 7);
  assert.ok(queue.body.registrations[0].checklist.filing_note.includes('No PRO or MLC API'));
  const csv = await publishing.staffRead({ format: 'csv' });
  assert.ok(csv.csv.includes('Manual staff filing only'));
  assert.ok(!csv.csv.includes('Pending at BMI'));

  const authApi = require('../api/auth');
  const meApi = require('../api/me');
  const adminReadonly = require('./admin-readonly');
  accounts.resetStore();
  accounts.useMemoryStore();
  publishing.resetStore();
  adminReadonly.resetForTests();

  const anon = mockRes();
  await meApi({ method: 'POST', url: '/api/me/publishing', headers: {}, body: body() }, anon);
  assert.strictEqual(anon.statusCode, 401);

  async function signup(email) {
    const created = mockRes();
    await authApi({
      method: 'POST',
      url: '/api/auth/signup',
      headers: {},
      body: { email: email, password: 'password1', artist: 'Ada Night' },
    }, created);
    assert.strictEqual(created.statusCode, 200, created.body);
    await accounts.confirmEmail(email);
    const login = mockRes();
    await authApi({
      method: 'POST',
      url: '/api/auth/login',
      headers: {},
      body: { email: email, password: 'password1' },
    }, login);
    assert.strictEqual(login.statusCode, 200, login.body);
    return String(login.headers['Set-Cookie'] || '').split(';')[0];
  }

  const ada = await signup('ada.night@example.com');
  const bo = await signup('bo.lane@example.com');
  const staff = await signup('emailplaiground@gmail.com');

  const posted = mockRes();
  await meApi({ method: 'POST', url: '/api/me?action=publishing', headers: { cookie: ada }, body: body({ idempotency_key: 'http-paper-1', title: 'HTTP Paper' }) }, posted);
  assert.strictEqual(posted.statusCode, 201, posted.body);
  const postedBody = JSON.parse(posted.body);
  const id = postedBody.registrations[0].id;
  assert.strictEqual(postedBody.registrations[0].status, 'needs_agreement');

  const replay = mockRes();
  await meApi({ method: 'POST', url: '/api/me/publishing', headers: { cookie: ada }, body: body({ idempotency_key: 'http-paper-1', title: 'HTTP Paper' }) }, replay);
  assert.strictEqual(replay.statusCode, 200);
  assert.strictEqual(JSON.parse(replay.body).idempotent, true);

  const otherGet = mockRes();
  await meApi({ method: 'GET', url: '/api/me/publishing?id=' + id, headers: { cookie: bo } }, otherGet);
  assert.strictEqual(otherGet.statusCode, 404);

  const ownGet = mockRes();
  await meApi({ method: 'GET', url: '/api/me/publishing?id=' + encodeURIComponent(id), headers: { cookie: ada } }, ownGet);
  assert.strictEqual(ownGet.statusCode, 200);
  assert.strictEqual(JSON.parse(ownGet.body).registration.id, id);
  assert.strictEqual(JSON.parse(ownGet.body).registration.credits.featured, 'Cee Guest');

  const password = mockRes();
  await meApi({ method: 'POST', url: '/api/me/publishing', headers: { cookie: ada }, body: body({ password: 'nope', idempotency_key: 'http-paper-2', title: 'Other Paper' }) }, password);
  assert.strictEqual(password.statusCode, 400);

  const artistAdmin = mockRes();
  await meApi({ method: 'GET', url: '/api/admin/publishing', headers: { cookie: ada } }, artistAdmin);
  assert.strictEqual(artistAdmin.statusCode, 403);

  const staffList = mockRes();
  await meApi({ method: 'GET', url: '/api/admin/publishing', headers: { cookie: staff } }, staffList);
  assert.strictEqual(staffList.statusCode, 200, staffList.body);
  assert.ok(JSON.parse(staffList.body).registrations.some((item) => item.id === id));

  process.env.ADMIN_READONLY_TOKEN = 'publishing-readonly-token-0123456789';
  const tokenRead = mockRes();
  await meApi({
    method: 'GET',
    url: '/api/admin/publishing.csv',
    headers: { 'x-plai-admin-token': process.env.ADMIN_READONLY_TOKEN },
  }, tokenRead);
  assert.strictEqual(tokenRead.statusCode, 200, tokenRead.body);
  assert.ok(tokenRead.body.includes('HTTP Paper'));
  assert.ok(tokenRead.body.includes('Manual staff filing only'));
  const tokenWrite = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/admin/publishing',
    headers: { 'x-plai-admin-token': process.env.ADMIN_READONLY_TOKEN },
    body: { action: 'status', id: id, status: 'submitted', reference: 'NO' },
  }, tokenWrite);
  assert.strictEqual(tokenWrite.statusCode, 403);

  const adaAccount = await accounts.findByEmail('ada.night@example.com');
  const adaRow = adaAccount.id;
  const recorded = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/admin/publishing',
    headers: { cookie: staff },
    body: {
      action: 'agreement',
      user_id: adaRow,
      reference: 'FILE-HTTP',
      version: 'reviewed-2026-10-02',
      signed_on: '2026-10-02',
      catalog_scope: { kind: 'account' },
      reviewed: true,
    },
  }, recorded);
  assert.strictEqual(recorded.statusCode, 201, recorded.body);
  const afterAgreement = mockRes();
  await meApi({ method: 'GET', url: '/api/me/publishing?id=' + id, headers: { cookie: ada } }, afterAgreement);
  assert.strictEqual(JSON.parse(afterAgreement.body).registration.status, 'under_review');

  const filed = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me?action=admin-publishing',
    headers: { cookie: staff },
    body: { action: 'status', id: id, status: 'submitted', reference: 'HAND-200' },
  }, filed);
  assert.strictEqual(filed.statusCode, 200, filed.body);
  assert.strictEqual(JSON.parse(filed.body).registration.external_reference, 'HAND-200');

  if (prev.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = prev.DATABASE_URL;
  if (prev.SESSION_SECRET === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = prev.SESSION_SECRET;
  if (prev.ADMIN_READONLY_TOKEN === undefined) delete process.env.ADMIN_READONLY_TOKEN;
  else process.env.ADMIN_READONLY_TOKEN = prev.ADMIN_READONLY_TOKEN;
  accounts.resetStore();
  console.log('publishing tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
