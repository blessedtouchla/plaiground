'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const accounts = require('./accounts');
const claim = require('./claim-record');
const lyrics = require('./lyrics');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

const userLine = { section: 'Chorus', text: 'I still set a place for you.', source: 'user', original: 'I still set a place for you.', edited: false };
const aiLine = { section: 'Chorus', text: 'The porch light stays on.', source: 'generated', original: 'The porch light stays on.', edited: false };
const edited = { section: 'Verse', text: 'The keys stayed in the bowl.', source: 'generated', original: 'The keys were still in the bowl.', edited: true };

assert.strictEqual(claim.tagLine(userLine), 'Written by you');
assert.strictEqual(claim.tagLine(aiLine), 'AI-generated');
assert.strictEqual(claim.tagLine(edited), 'Edited by you');

const record = claim.build({
  id: 'pg-testrecord',
  createdAt: '2026-10-07T16:04:00.000Z',
  title: 'Night bus',
  userName: 'Ada',
  answers: [{ label: 'What happened', value: 'The diner closed' }],
  choices: [{ label: 'Genre', value: 'R&B' }],
  generations: [{ at: '2026-10-07T16:00:00.000Z', title: 'Night bus', text: '[Chorus]\nThe porch light stays on.' }],
  edits: [{ section: 'Verse', before: 'The keys were still in the bowl.', after: 'The keys stayed in the bowl.' }],
  lines: [userLine, aiLine, edited],
  stylePrompt: 'R&B, mid tempo',
  percent: 40,
});

assert.strictEqual(record.lead, 'A record of your creative process that helps show your human contributions.');
assert.strictEqual(record.disclaimer, 'This is not a copyright registration or guarantee. General info, not legal advice.');
assert.strictEqual(record.userName, 'Ada');
assert.strictEqual(record.id, 'pg-testrecord');
assert.strictEqual(record.lines[0].tag, 'Written by you');
assert.strictEqual(record.lines[1].tag, 'AI-generated');
assert.strictEqual(record.lines[2].tag, 'Edited by you');
assert.strictEqual(record.generations.length, 1);
assert.strictEqual(record.edits[0].before, 'The keys were still in the bowl.');
assert.ok(!Object.prototype.hasOwnProperty.call(record, 'percent'));
const packed = JSON.stringify(record);
assert.ok(!/\d+\s*%/.test(packed));
assert.ok(!/suno|udio/i.test(packed));
assert.ok(packed.indexOf('\u2014') === -1);

const href = claim.officialHref(record);
assert.ok(href.indexOf('/contracts/create?') === 0);
assert.ok(href.indexOf('type=split') !== -1);
assert.ok(href.indexOf('declare=1') !== -1);
assert.ok(href.indexOf('Night+bus') !== -1 || href.indexOf('Night%20bus') !== -1);
assert.ok(decodeURIComponent(href).indexOf('pg-testrecord') !== -1);

const declared = claim.declarationText({ you: 'Ada', work: 'Night bus', record: 'pg-testrecord' });
assert.ok(declared.indexOf('Authorship declaration') === 0);
assert.ok(declared.indexOf('Split sheet') === -1);
assert.ok(declared.indexOf(claim.DISCLAIMER) !== -1);

const pdf = Buffer.from(claim.pdfBytes(record)).toString('latin1');
assert.ok(pdf.startsWith('%PDF-1.4'));
assert.ok(pdf.includes('Night bus'));
assert.ok(pdf.includes('Ada'));
assert.ok(pdf.includes('pg-testrecord'));
assert.ok(pdf.includes('Written by you'));
assert.ok(pdf.includes('AI-generated'));
assert.ok(pdf.includes('Edited by you'));
assert.ok(pdf.includes(claim.LEAD));
assert.ok(pdf.includes(claim.DISCLAIMER));
assert.ok(!/% yours|human percent|percentage/i.test(pdf));
assert.ok(pdf.indexOf('\u2014') === -1);
assert.ok(pdf.includes('%%EOF'));

const page = ['song-helper.html', 'claim.html', 'claim.js', 'contracts-create.js', 'song-helper.js', 'song-helper-v2.js'].map(read).join('\n');
assert.ok(page.includes('Claim my human parts'));
assert.ok(page.includes(claim.LEAD));
assert.ok(page.includes(claim.DISCLAIMER));
assert.ok(page.includes('Download PDF'));
assert.ok(page.includes('Make it official'));
assert.ok(page.includes("params.get('declare') === '1'"));
assert.ok(page.indexOf('\u2014') === -1);
assert.ok(!/\d+\s*% yours/.test(page));
assert.ok(!/suno|udio/i.test(read('claim.html') + read('claim.js')));

const vercel = JSON.parse(read('vercel.json'));
assert.ok((vercel.rewrites || []).some(function (row) {
  return row.source === '/claim' && row.destination === '/claim.html';
}));

accounts.useMemoryStore();
lyrics.resetStore();
lyrics.saveOwn('user-1', claim.songFromRecord(record)).then(function (saved) {
  assert.strictEqual(saved.created, true);
  assert.strictEqual(saved.song.claim.id, 'pg-testrecord');
  assert.strictEqual(saved.song.claim.lines[2].tag, 'Edited by you');
  assert.ok(!saved.song.claim.percent);
  return lyrics.saveOwn('user-1', claim.songFromRecord(record));
}).then(function (again) {
  assert.strictEqual(again.created, false);
  return lyrics.listOwn('user-2');
}).then(function (other) {
  assert.strictEqual(other.songs.length, 0);
  console.log('claim-record.test.js ok');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
