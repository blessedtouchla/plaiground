'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const credits = require('./release-credits');
const rules = require('./upload-required');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function run() {
  const artists = read('artists.html');
  const signup = read('signup.html');
  const upload = read('upload.html');
  const attest = read('attest.html');
  const splits = read('split-sheet.html');
  const index = read('index.html');

  assert.ok(artists.includes('id="artist-create-legal-first"') && artists.includes('id="artist-create-legal-last"'), 'create already has legal first/last');
  assert.ok(artists.includes('id="artist-legal-first"') && artists.includes('id="artist-legal-last"'), 'edit already has legal first/last');
  assert.ok(artists.includes('Required. Private. Not the artist name people see.'));
  assert.ok(artists.includes('Prefills songwriter lines on later songs'));

  assert.ok(!signup.includes('id="first-name"') && !signup.includes('id="last-name"'), 'signup does not collect first/last');
  assert.ok(!signup.includes('First and last name are required.'), 'Join for free is not blocked over a name');
  assert.ok(!/legal_first|first_name:/.test(signup), 'signup does not invent a second name store');
  assert.ok(signup.includes('id="email"') && signup.includes('id="password"'), 'email + password stay enough to get in');

  assert.ok(!upload.includes('id="tg-legal-first"') && !upload.includes('id="tg-legal-last-create"'), 'Upload does not duplicate Artist Profiles legal fields');
  assert.ok(upload.includes('lib/upload-credits.js?v=20260918vn1'), 'Upload stamps persist/prefill');
  assert.ok(attest.includes('id="attest-writer-first"') && attest.includes('id="attest-writer-last"'), '100% writer lines live on Attest');
  assert.ok(attest.includes('attest.js?v=20260918vn1'));
  assert.ok(splits.includes('Legal first name') && splits.includes('Legal last name'), 'co-writer lines stay on the split sheet');
  assert.ok(splits.includes('needs a legal first and last name'));

  assert.ok(index.includes('Enter the PLAIGROUND'));
  assert.ok(!/First and last name are required/.test(index), 'homepage Enter is not a name gate');

  assert.strictEqual(credits.WRITER_LINE, 'This song needs a songwriter legal first and last name.');
  assert.ok(!/stage name|rapper|\bband\b/i.test(credits.WRITER_LINE));
  assert.strictEqual(credits.validateWriterLines({ legal_first: '', legal_last: '' }).error, credits.WRITER_LINE);
  assert.ok(credits.validateWriterLines({ legal_first: 'Ada', legal_last: 'Night' }).ok);
  assert.strictEqual(rules.validateSplit({
    songTitle: 'Night Drive',
    writers: [{ first_name: '', last_name: '', name: 'Ada Night' }],
  }).error, 'Writer 1 needs a legal first and last name.');
  assert.ok(rules.validateSplit({
    songTitle: 'Night Drive',
    writers: [{ first_name: 'Ada', last_name: 'Night', name: 'Ada Night', email: 'ada@example.com', share: 50 }, { first_name: 'Bea', last_name: 'Vale', name: 'Bea Vale', email: 'bea@example.com', share: 50 }],
  }).ok);

  assert.ok(!/ToneGrid|DistroKid|CEO/i.test(attest + signup + upload));
  assert.ok(!/SignWell/i.test(attest));

  console.log('lib/legal-name-hold.test.js ok');
}

run();
