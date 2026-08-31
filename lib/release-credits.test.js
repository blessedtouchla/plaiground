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
  const draft = credits.savedDraftRelease({ saved_draft: true, title: 'The Interceptors' });
  assert.strictEqual(draft.status, 'draft');
  assert.strictEqual(draft.title, 'The Interceptors');
  assert.strictEqual(draft.uuid, '');
  assert.strictEqual(draft.id, 'local-draft');
  assert.strictEqual(draft.live, undefined);
  assert.ok(!/pending/i.test(draft.status));
  const mixed = credits.withSavedDraft([{ id: 'a', status: 'live', title: 'Rainbow Road', uuid: '7a928125-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }], { saved_draft: true, title: 'The Interceptors' });
  assert.strictEqual(mixed[0].id, 'local-draft');
  assert.strictEqual(mixed[0].title, 'The Interceptors');
  assert.strictEqual(mixed[1].title, 'Rainbow Road');
  assert.strictEqual(mixed[1].status, 'live');

  const ghost = credits.withSavedDraft([
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'The Interceptors', status: 'pending' },
  ], { saved_draft: true, title: 'The Interceptors' });
  assert.strictEqual(ghost.length, 1, 'do not resurrect a local Interceptors draft when the store already has that title');
  assert.strictEqual(ghost[0].uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.ok(!ghost.some(function (row) { return row.id === 'local-draft' || row.local_draft; }));

  const liveTwin = credits.withSavedDraft([
    { id: 'local-draft', local_draft: true, title: 'The Interceptors', status: 'draft' },
    { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'The Interceptors', status: 'live' },
  ], { saved_draft: true, title: 'The Interceptors' });
  assert.strictEqual(liveTwin.length, 1);
  assert.strictEqual(liveTwin[0].status, 'live');
  assert.ok(liveTwin[0].uuid);

  const twoStore = credits.collapseDuplicateTitles([
    { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'The Interceptors', status: 'draft', created_at: '2026-01-01' },
    { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'The Interceptors', status: 'pending', created_at: '2026-08-31' },
    { uuid: '7a928125-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Rainbow Road', status: 'live' },
  ]);
  assert.strictEqual(twoStore.length, 2, 'same-title store drafts collapse; other catalog songs stay');
  assert.strictEqual(twoStore[0].uuid, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'keep the later real Interceptors');
  assert.strictEqual(twoStore[1].title, 'Rainbow Road');

  const keptCatalog = credits.withSavedDraft([
    { uuid: 'c0102e1c-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'vhnjuk', status: 'live' },
    { uuid: '6629b532-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Metete', status: 'live' },
    { uuid: '490b789a-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Cgi', status: 'live' },
    { uuid: '1f26369b-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Lightning', status: 'live' },
    { uuid: 'df51342b-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Dolly', status: 'live' },
    { uuid: '7a928125-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Rainbow Road', status: 'live' },
  ], { saved_draft: true, title: 'The Interceptors' });
  assert.strictEqual(keptCatalog.length, 7);
  assert.strictEqual(keptCatalog[0].id, 'local-draft');
  assert.ok(keptCatalog.some(function (row) { return row.title === 'Rainbow Road' && row.uuid.indexOf('7a928125') === 0; }));

  const storage = {
    data: Object.create(null),
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
    setItem(key, value) { this.data[key] = String(value); },
    removeItem(key) { delete this.data[key]; },
  };
  const win = { localStorage: storage, sessionStorage: storage };
  credits.writeDraft({ saved_draft: true, title: 'The Interceptors', tonegrid_status: 'draft' }, win);
  assert.ok(credits.parkSavedDraft(win));
  credits.clearWorkingDraft(win);
  const parked = credits.displayDraft(win);
  assert.strictEqual(parked.title, 'The Interceptors', 'New release parks the saved draft instead of destroying it');
  assert.strictEqual(credits.readDraft(win).title, undefined);
  const restored = credits.activateHeldDraft(win);
  assert.strictEqual(restored.title, 'The Interceptors');

  console.log('lib/release-credits.test.js ok');
}

run();
