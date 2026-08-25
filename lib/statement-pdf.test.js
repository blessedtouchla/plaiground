'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const context = { window: {}, document: { createElement() { return { click() {} }; }, body: null } };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'statement-pdf.js'), 'utf8'), context);
  return context.PlaigroundStatementPdf;
}

function run() {
  const pdf = load();
  const zero = pdf.build({
    title: 'PLAIGROUND',
    subtitle: 'Earnings statement',
    fields: [
      { label: 'Account', value: 'Fuvtu' },
      { label: 'Available', value: '$0.00' },
      { label: 'Pending', value: '$0.00' },
    ],
  });
  assert.ok(zero.indexOf('%PDF-1.4') === 0, 'PDF header');
  assert.ok(zero.indexOf('%%EOF') !== -1, 'PDF trailer');
  assert.ok(zero.indexOf('Earnings statement') !== -1);
  assert.ok(zero.indexOf('Fuvtu') !== -1);
  assert.ok(zero.indexOf('$0.00') !== -1);
  assert.ok(!/ToneGrid|Tonegrid|7,412,908|Neon Sermon|Victoria Reyes/.test(zero));

  const withRows = pdf.build({
    title: 'PLAIGROUND',
    subtitle: 'Release statement',
    fields: [
      { label: 'Title', value: 'Fuvtu' },
      { label: 'Artist', value: 'Fuvtu' },
      { label: 'Status', value: 'Pending' },
      { label: 'Streams', value: '0' },
      { label: 'Earnings', value: '$0.00' },
    ],
    columns: ['Platform', 'Streams', 'Earnings'],
    rows: [['Spotify', '12', '$1.50']],
  });
  assert.ok(withRows.indexOf('Spotify') !== -1);
  assert.ok(withRows.indexOf('$1.50') !== -1);
  assert.ok(withRows.indexOf('Pending') !== -1);

  const saved = pdf.download('plaiground-statement.pdf', zero);
  assert.strictEqual(saved.filename, 'plaiground-statement.pdf');
  assert.ok(saved.bytes.indexOf('%PDF') === 0);
  assert.strictEqual(pdf.lastDownload().filename, 'plaiground-statement.pdf');

  const src = fs.readFileSync(path.join(__dirname, 'statement-pdf.js'), 'utf8');
  assert.ok(!/ToneGrid|Tonegrid/.test(src), 'PDF helper must not name the store partner');
  console.log('lib/statement-pdf.test.js ok');
}

run();
