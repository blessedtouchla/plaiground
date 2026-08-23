'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const signwell = require('./signwell');
const signwellApi = require('../api/signwell');

function mockRes() {
  const res = {
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
  return res;
}

function json(res) {
  return JSON.parse(res.body || '{}');
}

async function withSignwell(env, fn) {
  const prevKey = process.env.SIGNWELL_API_KEY;
  const prevTpl = process.env.SIGNWELL_TEMPLATE_ID;
  if (env.key === undefined) delete process.env.SIGNWELL_API_KEY;
  else process.env.SIGNWELL_API_KEY = env.key;
  if (env.template === undefined) delete process.env.SIGNWELL_TEMPLATE_ID;
  else process.env.SIGNWELL_TEMPLATE_ID = env.template;
  try {
    await fn();
  } finally {
    if (prevKey === undefined) delete process.env.SIGNWELL_API_KEY;
    else process.env.SIGNWELL_API_KEY = prevKey;
    if (prevTpl === undefined) delete process.env.SIGNWELL_TEMPLATE_ID;
    else process.env.SIGNWELL_TEMPLATE_ID = prevTpl;
  }
}

async function run() {
  assert.strictEqual(signwell.isConfigured(), false);
  assert.strictEqual(signwell.documentSigned({ status: 'Pending' }), false);
  assert.strictEqual(signwell.documentSigned({ status: 'Completed' }), true);
  assert.strictEqual(signwell.documentSigned({ status: 'Manually completed' }), true);
  assert.strictEqual(signwell.documentSigned({
    status: 'Pending',
    recipients: [{ status: 'Completed' }, { status: 'Pending' }],
  }), false);
  assert.strictEqual(signwell.documentSigned({
    status: 'Pending',
    recipients: [{ status: 'Completed' }, { status: 'Completed' }],
  }), true);
  assert.strictEqual(signwell.documentSigned({
    status: 'Pending',
    recipients: [
      { placeholder_name: 'Writer 1', status: 'signed' },
      { placeholder_name: 'Writer 2', signed_status: 'Signed' },
      { placeholder_name: 'document sender', status: 'Pending' },
    ],
  }), true);
  assert.strictEqual(signwell.documentSigned({
    status: 'Pending',
    recipients: [
      { placeholder_name: 'Writer 1', signed: true },
      { placeholder_name: 'document sender', status: 'Pending' },
    ],
  }), true);
  assert.strictEqual(signwell.documentSigned({
    status: 'Pending',
    recipients: [
      { placeholder_name: 'Writer 1', status: 'signed' },
      { placeholder_name: 'Writer 2', status: 'Pending' },
    ],
  }), false);
  assert.strictEqual(signwell.isTrialError('Your trial ended on August 20, 2026.'), true);
  assert.strictEqual(signwell.errorCode('Your trial ended on August 20, 2026.'), 'SIGNWELL_TRIAL');

  await withSignwell({ key: undefined, template: undefined }, async () => {
    const res = mockRes();
    await signwellApi({ method: 'GET', headers: {}, query: {} }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(json(res), { configured: false });
  });

  await withSignwell({ key: 'signwell-test-key-not-for-commit', template: 'tpl_test_not_for_commit' }, async () => {
    const gate = await signwell.requireSignedDocument('');
    assert.strictEqual(gate.ok, false);
    assert.strictEqual(gate.code, 'SIGNWELL_REQUIRED');
    assert.strictEqual(gate.signed, false);
  });

  await withSignwell({ key: 'signwell-test-key-not-for-commit', template: 'tpl_test_not_for_commit' }, async () => {
    const originalFetch = global.fetch;
    global.fetch = async function mockFetch() {
      return { ok: false, status: 402, json: async () => ({ error: 'Your trial ended on August 20, 2026.' }) };
    };
    try {
      const gate = await signwell.requireSignedDocument('doc_split_sheet_01');
      assert.strictEqual(gate.ok, false);
      assert.strictEqual(gate.signed, false);
      assert.strictEqual(gate.code, 'SIGNWELL_TRIAL');
      assert.strictEqual(gate.error, 'Your trial ended on August 20, 2026.');
      const res = mockRes();
      await signwellApi({ method: 'GET', headers: {}, query: { id: 'doc_split_sheet_01' } }, res);
      assert.strictEqual(res.statusCode, 402);
      assert.strictEqual(json(res).error, 'Your trial ended on August 20, 2026.');
      assert.strictEqual(json(res).signed, false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await withSignwell({ key: 'signwell-test-key-not-for-commit', template: 'tpl_test_not_for_commit' }, async () => {
    const originalFetch = global.fetch;
    let createBody = null;
    global.fetch = async function mockFetch(url, options) {
      if (String(url).includes('document_templates')) {
        createBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'doc_live_01',
            status: 'Pending',
            recipients: [{
              id: '1',
              placeholder_name: 'Writer 1',
              embedded_signing_url: 'https://www.signwell.com/embedded/doc_live_01',
            }],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ id: 'doc_split_sheet_01', status: 'Completed', recipients: [{ status: 'Completed' }] }) };
    };
    try {
      const res = mockRes();
      await signwellApi({
        method: 'POST',
        headers: {},
        body: {
          songTitle: 'Live Gate Song',
          writers: [{ name: 'Writer One', email: 'writer1@example.com', share: 100, pro: 'ASCAP' }],
        },
      }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(createBody.test_mode, false);
      assert.strictEqual(createBody.recipients.length, 2);
      assert.strictEqual(createBody.recipients[0].placeholder_name, 'Writer 1');
      assert.strictEqual(createBody.recipients[0].name, 'Writer One');
      assert.strictEqual(createBody.recipients[0].email, 'writer1@example.com');
      assert.strictEqual(createBody.recipients[0].send_email, false);
      assert.strictEqual(createBody.recipients[1].placeholder_name, 'document sender');
      assert.strictEqual(createBody.recipients[1].name, 'PLAIGROUND');
      assert.strictEqual(createBody.recipients[1].email, 'emailplaiground@gmail.com');
      assert.strictEqual(createBody.recipients[1].send_email, false);
      assert.deepStrictEqual(createBody.exclude_placeholders, ['Writer 2']);
      assert.strictEqual(json(res).documentId, 'doc_live_01');
      assert.ok(json(res).embeddedSigningUrl);
      assert.ok(!res.body.includes('signwell-test-key-not-for-commit'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  await withSignwell({ key: 'signwell-test-key-not-for-commit', template: 'tpl_test_not_for_commit' }, async () => {
    const originalFetch = global.fetch;
    let createBody = null;
    global.fetch = async function mockFetch(url, options) {
      if (String(url).includes('document_templates')) {
        createBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'doc_two_writer_01',
            status: 'Pending',
            recipients: [
              {
                id: 'document_sender',
                placeholder_name: 'document sender',
                embedded_signing_url: 'https://www.signwell.com/embedded/sender_must_not_win',
              },
              {
                id: '1',
                placeholder_name: 'Writer 1',
                embedded_signing_url: 'https://www.signwell.com/embedded/writer1_embed',
              },
              {
                id: '2',
                placeholder_name: 'Writer 2',
                embedded_signing_url: 'https://www.signwell.com/embedded/writer2_embed',
              },
            ],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };
    try {
      const res = mockRes();
      await signwellApi({
        method: 'POST',
        headers: {},
        body: {
          songTitle: 'Two Writer Song',
          writers: [
            { name: 'Writer One', email: 'writer1@example.com', share: 50, pro: 'ASCAP' },
            { name: 'Writer Two', email: 'writer2@example.com', share: 50, pro: 'BMI' },
          ],
        },
      }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(createBody.test_mode, false);
      assert.strictEqual(createBody.recipients.length, 3);
      assert.strictEqual(createBody.recipients[0].placeholder_name, 'Writer 1');
      assert.strictEqual(createBody.recipients[0].send_email, false);
      assert.strictEqual(createBody.recipients[1].placeholder_name, 'Writer 2');
      assert.strictEqual(createBody.recipients[1].send_email, true);
      assert.strictEqual(createBody.recipients[2].placeholder_name, 'document sender');
      assert.strictEqual(createBody.recipients[2].name, 'PLAIGROUND');
      assert.strictEqual(createBody.recipients[2].email, 'emailplaiground@gmail.com');
      assert.strictEqual(createBody.recipients[2].send_email, false);
      assert.ok(!createBody.exclude_placeholders);
      assert.strictEqual(json(res).embeddedSigningUrl, 'https://www.signwell.com/embedded/writer1_embed');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await withSignwell({ key: 'signwell-test-key-not-for-commit', template: 'tpl_test_not_for_commit' }, async () => {
    const originalFetch = global.fetch;
    global.fetch = async function mockFetch() {
      return { ok: true, status: 200, json: async () => ({ id: 'doc_split_sheet_01', status: 'Completed', recipients: [{ status: 'Completed' }] }) };
    };
    try {
      const gate = await signwell.requireSignedDocument('doc_split_sheet_01');
      assert.strictEqual(gate.ok, true);
      assert.strictEqual(gate.signed, true);
      const res = mockRes();
      await signwellApi({ method: 'GET', headers: {}, query: { id: 'doc_split_sheet_01' } }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(json(res).signed, true);
      assert.ok(!res.body.includes('signwell-test-key-not-for-commit'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  await withSignwell({ key: 'signwell-test-key-not-for-commit', template: 'tpl_test_not_for_commit' }, async () => {
    const originalFetch = global.fetch;
    global.fetch = async function mockFetch() {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'doc_email_signed_01',
          status: 'Pending',
          recipients: [
            { placeholder_name: 'Writer 1', status: 'signed' },
            { placeholder_name: 'Writer 2', signed_status: 'Signed' },
            { placeholder_name: 'document sender', status: 'Pending' },
          ],
        }),
      };
    };
    try {
      const res = mockRes();
      await signwellApi({ method: 'GET', headers: {}, query: { id: 'doc_email_signed_01' } }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(json(res).signed, true);
      assert.ok(json(res).recipients.some((row) => row.name === 'Writer 1' && row.signed));
    } finally {
      global.fetch = originalFetch;
    }
  });

  await withSignwell({ key: 'signwell-test-key-not-for-commit', template: 'tpl_test_not_for_commit' }, async () => {
    const originalFetch = global.fetch;
    global.fetch = async function mockFetch() {
      return {
        ok: false,
        status: 400,
        json: async () => ({
          errors: {
            recipients: ['Recipient Writer 2 is required.'],
          },
        }),
      };
    };
    try {
      const res = mockRes();
      await signwellApi({
        method: 'POST',
        headers: {},
        body: {
          songTitle: 'Live Gate Song',
          writers: [{ name: 'Writer One', email: 'writer1@example.com', share: 100, pro: '' }],
        },
      }, res);
      assert.strictEqual(res.statusCode, 400);
      assert.ok(json(res).error.indexOf('Recipient Writer 2 is required.') !== -1);
      assert.ok(json(res).error.indexOf('SignWell rejected the request.') === -1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  assert.ok(signwell.signwellErrorMessage({
    errors: { recipients: { Writer2: ['is missing'] } },
  }).indexOf('is missing') !== -1);

  const split = fs.readFileSync(path.join(__dirname, '..', 'split-sheet.html'), 'utf8');
  const signwellApiSrc = fs.readFileSync(path.join(__dirname, '..', 'api', 'signwell.js'), 'utf8');
  assert.ok(split.includes('SignWellEmbed'));
  assert.ok(split.includes('signwell-embed'));
  assert.ok(split.includes('/api/signwell?id='));
  assert.ok(split.includes('awaiting_signature'));
  assert.ok(split.includes('This is not a homemade signature pad.'));
  assert.ok(signwellApiSrc.includes('test_mode: false'));
  assert.ok(!signwellApiSrc.includes('test_mode: true'));
  assert.ok(signwellApiSrc.includes("'document sender'"));
  assert.ok(signwellApiSrc.includes('emailplaiground@gmail.com'));
  assert.ok(!signwellApiSrc.includes('NEXT_PUBLIC_'));
  assert.ok(!fs.readFileSync(path.join(__dirname, '..', 'terms.html'), 'utf8').includes('document_id'));

  console.log('signwell self-test ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
