'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WIZARD = ['upload.html', 'attest.html', 'review.html', 'submitted.html', 'split-sheet.html'];
const FORBIDDEN_VALUES = [
  'value="Neon Shadows"',
  "value='Neon Shadows'",
  'value="Victoria Reyes"',
  "value='Victoria Reyes'",
  'value="Electronic / Synthwave"',
  'value="English"',
  'value="$0.99"',
];

function run() {
  WIZARD.forEach(function (file) {
    const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
    FORBIDDEN_VALUES.forEach(function (needle) {
      assert.strictEqual(html.indexOf(needle), -1, file + ' still has ' + needle);
    });
    assert.strictEqual(/name:\s*'Victoria Reyes'/.test(html), false, file + ' still defaults a writer to Victoria Reyes');
  });

  const upload = fs.readFileSync(path.join(__dirname, 'upload.html'), 'utf8');
  assert.ok(upload.indexOf('placeholder="SONG TITLE"') !== -1);
  assert.ok(upload.indexOf('placeholder="FIRST NAME LAST NAME"') !== -1);
  assert.ok(upload.indexOf('id="tg-title"') !== -1);
  assert.ok(/id="tg-title"[^>]*value=""/.test(upload));
  assert.ok(/id="tg-artist"[^>]*value=""/.test(upload));
  assert.ok(/id="tg-genre"[^>]*value=""/.test(upload));
  assert.ok(/id="tg-language"[^>]*value=""/.test(upload));
  assert.ok(/id="tg-price"[^>]*value=""/.test(upload));
  assert.ok(upload.indexOf('placeholder="Optional"') !== -1);

  console.log('upload-defaults.test.js ok');
}

run();
