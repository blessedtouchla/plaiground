'use strict';

const assert = require('assert');
const credits = require('./release-credits');
const storeCredits = require('./store-credits');

function run() {
  assert.strictEqual(storeCredits.STORE_LABEL, undefined);
  assert.strictEqual(storeCredits.hopLabel(''), 'PLAIGROUND');
  assert.strictEqual(storeCredits.hopLabel('   '), 'PLAIGROUND');
  assert.strictEqual(storeCredits.hopLabel('Night Records'), 'Night Records');
  const fields = storeCredits.hopLabelFields('');
  assert.strictEqual(fields.label, 'PLAIGROUND');
  assert.strictEqual(fields.record_label, 'PLAIGROUND');
  assert.strictEqual(fields.label_name, 'PLAIGROUND');
  const typedFields = storeCredits.hopLabelFields('Night Records');
  assert.strictEqual(typedFields.label, 'Night Records');
  assert.strictEqual(typedFields.record_label, 'Night Records');
  assert.strictEqual(typedFields.label_name, 'Night Records');
  assert.strictEqual(storeCredits.copyrightYearFromDate('2026-09-12'), 2026);
  assert.strictEqual(storeCredits.copyrightYearFromDate('2026-01-01'), 2026);
  assert.strictEqual(storeCredits.copyrightYearFromDate(''), '');
  assert.strictEqual(storeCredits.copyrightYearFromDate('soon'), '');

  const lines = storeCredits.copyrightLines('Jane Doe', 'Ada Night', 2026);
  assert.strictEqual(lines.c_line, '(C) 2026 Jane Doe');
  assert.strictEqual(lines.p_line, '(P) 2026 Ada Night');
  assert.strictEqual(lines.copyright_line, '© 2026 Jane Doe / ℗ 2026 Ada Night');

  const create = storeCredits.releaseCreateFields('Jane Doe', 2026);
  assert.strictEqual(create.label, 'PLAIGROUND');
  assert.strictEqual(create.record_label, 'PLAIGROUND');
  assert.strictEqual(create.label_name, 'PLAIGROUND');
  assert.strictEqual(create.copyright_holder, 'Jane Doe');
  assert.strictEqual(create.copyright_owner, 'Jane Doe');
  assert.strictEqual(create.rights_owner, 'Jane Doe');
  assert.strictEqual(create.master_owner, 'Jane Doe');
  assert.strictEqual(create.copyright_year, 2026);
  assert.strictEqual(create.c_line, '(C) 2026 Jane Doe');
  assert.strictEqual(create.p_line, '(P) 2026 Jane Doe');
  assert.ok(create.copyright_line.indexOf('Jane Doe') !== -1);

  const typed = storeCredits.releaseCreateFields({
    label: 'Night Records',
    cOwner: 'Jane Doe',
    pOwner: 'Ada Night',
    year: 2026,
  });
  assert.strictEqual(typed.label, 'Night Records');
  assert.strictEqual(typed.copyright_holder, 'Jane Doe');
  assert.strictEqual(typed.master_owner, 'Ada Night');
  assert.strictEqual(typed.c_line, '(C) 2026 Jane Doe');
  assert.strictEqual(typed.p_line, '(P) 2026 Ada Night');
  assert.ok(typed.copyright_line.indexOf('Jane Doe') !== -1);
  assert.ok(typed.copyright_line.indexOf('Ada Night') !== -1);
  assert.ok(typed.c_line.indexOf('PLAIGROUND') === -1);
  assert.ok(typed.p_line.indexOf('PLAIGROUND') === -1);

  const blankLabel = storeCredits.releaseCreateFields({
    label: '',
    cOwner: 'Jane Doe',
    pOwner: 'Ada Night',
    year: 2026,
  });
  assert.strictEqual(blankLabel.label, 'PLAIGROUND');
  assert.strictEqual(blankLabel.record_label, 'PLAIGROUND');
  assert.strictEqual(blankLabel.label_name, 'PLAIGROUND');
  assert.strictEqual(blankLabel.copyright_holder, 'Jane Doe');
  assert.strictEqual(blankLabel.master_owner, 'Ada Night');

  const rights = storeCredits.rightsEnvelope({
    cOwner: 'Jane Doe',
    pOwner: 'Ada Night',
    year: 2026,
  });
  assert.strictEqual(rights.p_line, '(P) 2026 Ada Night');
  assert.strictEqual(rights.c_line, '(C) 2026 Jane Doe');
  assert.strictEqual(rights.copyright_year, 2026);
  assert.strictEqual(rights.copyright_holder, 'Jane Doe');
  assert.strictEqual(rights.master_owner, 'Ada Night');
  assert.strictEqual(rights.rights_owner, 'Jane Doe');
  assert.ok(rights.copyright_line.indexOf('Jane Doe') !== -1);
  assert.ok(!rights.label);

  const fromWriter = storeCredits.resolveSongwriter({
    writers: [{ first_name: 'Ada', last_name: 'Night' }],
    legal_first: 'Ignored',
    legal_last: 'Person',
    name: 'Fuvtu',
  }, [{ name: 'Fuvtu', legal_first: 'Nope', legal_last: 'Nope' }]);
  assert.strictEqual(fromWriter.name, 'Ada Night');

  const fromBody = storeCredits.resolveSongwriter({
    legal_first: 'Ada',
    legal_last: 'Night',
    name: 'Fuvtu',
  }, [{ name: 'Fuvtu' }]);
  assert.strictEqual(fromBody.name, 'Ada Night');

  const fromArtist = storeCredits.resolveSongwriter({
    artist_id: '11111111-1111-4111-8111-111111111111',
    name: 'Fuvtu',
  }, [{
    name: 'Fuvtu',
    legal_first: 'Ada',
    legal_last: 'Night',
    tonegrid_artist_id: '11111111-1111-4111-8111-111111111111',
  }]);
  assert.strictEqual(fromArtist.name, 'Ada Night');

  const missing = storeCredits.resolveSongwriter({
    name: 'Fuvtu',
  }, [{ name: 'Fuvtu' }]);
  assert.strictEqual(missing.error, credits.WRITER_LINE);
  assert.ok(!missing.ok);

  const hop = storeCredits.creditsFromHop({
    label: 'Night Records',
    copyright_holder: 'Jane Doe',
    master_owner: 'Ada Night',
    copyright_year: '2026',
  }, { name: 'Fallback Person' }, 2025);
  assert.strictEqual(hop.label, 'Night Records');
  assert.strictEqual(hop.cOwner, 'Jane Doe');
  assert.strictEqual(hop.pOwner, 'Ada Night');
  assert.strictEqual(hop.year, 2026);

  const hopBlank = storeCredits.creditsFromHop({}, { name: 'Ada Night' }, 2026);
  assert.strictEqual(hopBlank.label, '');
  assert.strictEqual(hopBlank.cOwner, 'Ada Night');
  assert.strictEqual(hopBlank.pOwner, 'Ada Night');
  assert.strictEqual(storeCredits.hopLabel(hopBlank.label), 'PLAIGROUND');
  assert.ok(hopBlank.cOwner !== 'PLAIGROUND');
  assert.ok(hopBlank.pOwner !== 'PLAIGROUND');

  const stored = storeCredits.storedCreditFields({
    label: '',
    cOwner: 'Ada Night',
    pOwner: 'Ada Night',
    year: 2026,
  });
  assert.strictEqual(stored.label, 'PLAIGROUND');
  assert.strictEqual(stored.rights_owner, 'Ada Night');
  assert.strictEqual(stored.master_owner, 'Ada Night');
  assert.strictEqual(stored.copyright_year, 2026);
  assert.strictEqual(stored.writers[0].name, 'Ada Night');
  assert.ok(stored.copyright_line.indexOf('Ada Night') !== -1);

  const writer = storeCredits.writerCreateBody({ first: 'Ada', last: 'Night', name: 'Ada Night' });
  assert.strictEqual(writer.name, 'Ada Night');
  assert.strictEqual(writer.legal_name, 'Ada Night');
  assert.strictEqual(writer.first_name, 'Ada');
  assert.strictEqual(writer.last_name, 'Night');
  assert.strictEqual(writer.legal_first, 'Ada');
  assert.strictEqual(writer.legal_last, 'Night');
  const fromString = storeCredits.writerCreateBody('Ada Night');
  assert.strictEqual(fromString.first_name, 'Ada');
  assert.strictEqual(fromString.last_name, 'Night');
  const attach = storeCredits.trackWritersBody('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
    first: 'Ada',
    last: 'Night',
    name: 'Ada Night',
  });
  assert.strictEqual(attach.writers[0].role, 'composer_lyricist');
  assert.strictEqual(attach.writers[0].composer_share_percent, 100);
  assert.strictEqual(attach.writers[0].first_name, 'Ada');
  assert.strictEqual(attach.writers[0].last_name, 'Night');
  assert.strictEqual(attach.writers[0].name, 'Ada Night');

  const qc = storeCredits.trackSongwriterFields({ first: 'Ada', last: 'Night', name: 'Ada Night' });
  assert.strictEqual(qc.contributors[0].role, 'Songwriter');
  assert.strictEqual(qc.contributors[1].role, 'Composer');
  assert.strictEqual(qc.contributors[0].name, 'Ada Night');
  assert.strictEqual(qc.contributors[0].first_name, 'Ada');
  assert.strictEqual(qc.contributors[0].last_name, 'Night');
  assert.strictEqual(qc.songwriters[0].name, 'Ada Night');
  assert.strictEqual(qc.composers[0].name, 'Ada Night');
  const namedWriters = storeCredits.trackWritersNameBody({ first: 'Ada', last: 'Night', name: 'Ada Night' });
  assert.strictEqual(namedWriters.writers[0].role, 'composer_lyricist');
  assert.strictEqual(namedWriters.writers[0].name, 'Ada Night');
  assert.strictEqual(namedWriters.writers[0].composer_share_percent, 100);
  assert.strictEqual(storeCredits.trackSongwriterFields({ name: '' }), null);

  const profile = require('./profile');
  const saved = profile.upsertRelease(profile.emptyProfile(), {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    title: 'Night Drive',
    label: 'Night Records',
    rights_owner: 'Ada Night',
    master_owner: 'Ada Night',
    copyright_year: 2026,
    copyright_holder: 'Ada Night',
    writers: [{ name: 'Ada Night' }],
    c_line: '(C) 2026 Ada Night',
    p_line: '(P) 2026 Ada Night',
  });
  assert.strictEqual(saved.releases[0].label, 'Night Records');
  assert.strictEqual(saved.releases[0].rights_owner, 'Ada Night');
  const merged = profile.upsertRelease(saved, {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    writers: [{ name: 'Ada Night' }],
  });
  assert.strictEqual(merged.releases[0].label, 'Night Records');
  assert.strictEqual(merged.releases[0].master_owner, 'Ada Night');
  assert.strictEqual(merged.releases[0].copyright_year, 2026);

  console.log('lib/store-credits.test.js ok');
}

run();
