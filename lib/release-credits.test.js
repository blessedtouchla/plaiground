'use strict';

const assert = require('assert');
const credits = require('./release-credits');

function noLecture(text) {
  assert.ok(!/stage name|rapper|\bband\b/i.test(String(text || '')), 'required copy must not lecture about stage names');
}

function run() {
  assert.strictEqual(credits.LEGAL_BOTH, 'Legal first and last name are both required.');
  noLecture(credits.LEGAL_BOTH);
  noLecture(credits.WRITER_LINE);
  assert.strictEqual(credits.validateLegalName('Ada', '').error, credits.LEGAL_BOTH);
  noLecture(credits.validateLegalName('', 'German Nunez').error);
  noLecture(credits.validateLegalName('Ada', '   ').error);
  assert.ok(credits.validateLegalName('Ada', 'Night').ok);
  const twoWord = credits.validateLegalName('Ada', 'German Nunez');
  assert.ok(twoWord.ok, 'two-word last names must pass');
  assert.strictEqual(twoWord.last, 'German Nunez');
  assert.ok(credits.validateLegalName('José', 'García-López').ok, 'accents and hyphens must pass');
  assert.ok(credits.validateLegalName('Ada', 'Night Jr.').ok, 'suffixes must pass');
  assert.ok(credits.validateLegalName('The', 'Interceptors').ok, 'legal pair is not a display-name check');
  assert.strictEqual(credits.validateUploadLegal({ artist_mode: 'link' }).error, credits.LINK_COPY);
  assert.ok(credits.validateUploadLegal({}).ok, 'missing legal keys stay optional for older callers');
  assert.strictEqual(credits.validateUploadLegal({
    artist_mode: 'create',
    legal_first: '',
    legal_last: '',
  }).error, credits.LEGAL_BOTH);
  assert.strictEqual(credits.validateUploadLegal({ artist_mode: 'create' }).error, credits.LEGAL_BOTH);
  assert.strictEqual(credits.validateUploadLegal({ creating_artist: true }).error, credits.LEGAL_BOTH);
  assert.ok(credits.validateUploadLegal({
    artist_mode: 'create',
    legal_first: 'Ada',
    legal_last: 'Night',
  }).ok);
  assert.ok(credits.validateUploadLegal({
    artist_mode: 'choose',
    legal_first: 'Ada',
    legal_last: 'Night',
  }).ok);
  assert.ok(credits.validateUploadLegal({
    artist_mode: 'create',
    legal_first: 'Ada',
    legal_last: 'German Nunez',
  }).ok, 'upload create accepts a two-word last name');

  assert.strictEqual(credits.validateWriterLines({
    solo_owned_100: true,
    legal_first: 'Ada',
  }).error, credits.WRITER_LINE);
  assert.ok(credits.validateWriterLines({
    legal_first: 'Ada',
    legal_last: 'Night',
  }).ok);
  assert.strictEqual(credits.validateWriterLines({
    other_writers: true,
  }).error, credits.OTHER_COUNT);
  assert.ok(credits.validateWriterLines({
    other_writers: true,
    other_writer_count: 2,
  }).ok);

  assert.strictEqual(credits.validateCredits({
    name: 'Ada Night',
    credits: { performer: 'AI', producer: 'Ada Night' },
  }).error, credits.PERFORMER);
  assert.strictEqual(credits.validateCredits({
    name: 'Ada Night',
    made_how: 'fully_ai',
    credits: { performer: 'Ada Night' },
  }).error, credits.PRODUCER);
  assert.ok(credits.validateCredits({
    name: 'Ada Night',
    made_how: 'fully_ai',
    directed: true,
    credits: { performer: 'Ada Night' },
  }).ok, 'directed claim can fill producer');
  const fully = credits.defaultCredits({
    name: 'Ada Night',
    made_how: 'fully_ai',
    legal_first: 'Ada',
    legal_last: 'Night',
  });
  assert.strictEqual(fully.writer, '', 'Fully AI does not invent a human writer');
  const lyrics = credits.defaultCredits({
    name: 'Ada Night',
    legal_first: 'Ada',
    legal_last: 'Night',
    did_lyrics: true,
    did_beat: true,
  });
  assert.strictEqual(lyrics.writer, 'Ada Night');
  assert.strictEqual(lyrics.producer, 'Ada Night');
  assert.strictEqual(lyrics.performer, 'Ada Night');

  const lines = credits.seedWriters({
    legal_first: 'Ada',
    legal_last: 'Night',
    other_writers: true,
    other_writer_count: 2,
  });
  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[0].first_name, 'Ada');
  assert.strictEqual(lines[0].last_name, 'Night');

  assert.strictEqual(credits.savedDraftRelease({ title: 'Held' }), null);
  const draft = credits.savedDraftRelease({ saved_draft: true, title: 'Held Song' });
  assert.strictEqual(draft.status, 'draft');
  assert.strictEqual(draft.live, undefined);
  assert.ok(!/pending/i.test(draft.status));
  const mixed = credits.withSavedDraft([{ id: 'a', status: 'live' }], { saved_draft: true, title: 'Held Song' });
  assert.strictEqual(mixed[0].id, 'local-draft');
  assert.strictEqual(mixed[1].status, 'live');

  console.log('lib/release-credits.test.js ok');
}

run();
