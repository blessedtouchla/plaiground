'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sheets = require('./split-sheets');

function run() {
  assert.strictEqual(sheets.writerFullName({
    legal_first: 'Ada',
    legal_last: 'Night',
  }, null), 'Ada Night');
  assert.strictEqual(sheets.writerFullName({
    artist: 'Fuvtu',
    writers: [{ name: 'Fuvtu' }],
  }, null), '', 'stage names do not fill the writer line');
  assert.strictEqual(sheets.writerFullName({
    writers: [{ first_name: 'Bea', last_name: 'Vale' }],
  }, null), 'Bea Vale');
  assert.strictEqual(sheets.writerFullName({
    legal_first: 'Ada',
    legal_last: 'Night',
  }, { name: 'Victoria' }), 'Ada Night', 'account display name is not the writer');

  assert.strictEqual(sheets.signatureStatus({ solo_owned_100: true }, null), 'self-attested');
  assert.strictEqual(sheets.signatureStatus({ featured: 'Guest', solo_owned_100: true }, null), 'no');
  assert.strictEqual(sheets.signatureStatus({
    signwell_document_id: 'doc_pending_01',
    signwell_status: 'awaiting_signature',
  }, null), 'pending');
  assert.strictEqual(sheets.signatureStatus({
    signwell_document_id: 'doc_done_01',
    signwell_signed: true,
    signwell_status: 'Completed',
  }, null), 'yes');
  assert.strictEqual(sheets.signatureStatus({}, null), 'no');
  assert.strictEqual(sheets.statusCopy('self-attested'), 'self-attested, no sheet required');

  assert.strictEqual(sheets.existingPdf({ split_sheet_pdf: 'https://files.example/sheet.pdf' }, null), 'https://files.example/sheet.pdf');
  assert.strictEqual(sheets.existingPdf({}, { solo_owned_100: true }), '', '100% does not invent a PDF');

  const ids = [
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
  ];
  const me = {
    tonegrid_release_ids: ids,
    profile: {
      releases: ids.map(function (id, index) {
        return {
          tonegrid_release_id: id,
          title: 'Song ' + (index + 1),
          legal_first: 'Ada',
          legal_last: 'Night',
          solo_owned_100: true,
        };
      }),
    },
  };
  const latest = sheets.latestWorks(me, null, 5);
  assert.strictEqual(latest.length, 5);
  assert.strictEqual(latest[0].title, 'Song 6');
  assert.strictEqual(latest[4].title, 'Song 2');
  assert.strictEqual(latest[0].writer, 'Ada Night');
  assert.strictEqual(latest[0].status, 'self-attested');

  const all = sheets.realWorks(me, null);
  assert.strictEqual(all.length, 6);

  const persist = sheets.persistFields(
    { legal_first: 'Ada', legal_last: 'Night', solo_owned_100: true },
    true,
    { signed: false, status: 'solo' },
    '',
    { first: 'Ada', last: 'Night' }
  );
  assert.strictEqual(persist.solo_owned_100, true);
  assert.strictEqual(persist.legal_first, 'Ada');
  assert.strictEqual(persist.legal_last, 'Night');
  assert.strictEqual(persist.signwell_document_id, '');
  assert.strictEqual(persist.signwell_status, 'solo');

  const src = fs.readFileSync(path.join(__dirname, 'split-sheets.js'), 'utf8');
  assert.ok(!/buildPdf|PlaigroundStatementPdf|document_templates/.test(src), 'helper must not mint a PDF or create SignWell');
  assert.ok(!/ToneGrid|InterSpace|DistroKid|95%/.test(src));

  const context = { window: {}, globalThis: {} };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(src, context);
  assert.ok(context.PlaigroundSplitSheets);
  assert.strictEqual(context.PlaigroundSplitSheets.signatureStatus({ solo_owned_100: true }), 'self-attested');

  console.log('lib/split-sheets.test.js ok');
}

run();
