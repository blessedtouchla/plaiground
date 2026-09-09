'use strict';

/**
 * Private legal names, writer lines, and store credits.
 * Does not hop, attach, or send Continue.
 */

var LEGAL_BOTH = 'Legal first and last name are both required.';
var LINK_COPY = 'Merge that artist on Artist Profiles first, then pick them here.';
var OTHER_COUNT = 'How many other writers are on this song?';
var PERFORMER = 'Add a performer credit. Use the artist name, not AI.';
var PRODUCER = 'Add a producer credit. If you directed this recording, claim that below.';
var WRITER_LINE = 'This song needs a songwriter legal first and last name.';
var DRAFT_KEY = 'plaiground.store.draft';
var SHEET_KEY = 'plaiground.tonegrid.draft';
var HELD_KEY = 'plaiground.store.held_draft';
var FRESH_KEY = 'plaiground.store.fresh';
var LEGAL_KEY = 'plaiground.artist.legal';

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function filled(value) {
  return trim(value) !== '';
}

function isAiName(value) {
  var raw = trim(value).toLowerCase();
  if (!raw) return false;
  return raw === 'ai' || raw === 'artificial intelligence' || raw === 'an ai' || raw === 'the ai';
}

function splitName(value) {
  var parts = trim(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function joinName(first, last) {
  return [trim(first), trim(last)].filter(Boolean).join(' ');
}

function legalFromWriter(writer) {
  writer = writer || {};
  var first = trim(writer.first_name || writer.legal_first || writer.first);
  var last = trim(writer.last_name || writer.legal_last || writer.last);
  if (!first && !last && filled(writer.name)) {
    var split = splitName(writer.name);
    first = split.first;
    last = split.last;
  }
  return { first: first, last: last, name: joinName(first, last) };
}

function validateLegalName(first, last) {
  if (!filled(first) || !filled(last)) return { error: LEGAL_BOTH };
  return { ok: true, first: trim(first), last: trim(last), name: joinName(first, last) };
}

function writerHasLegalName(writer) {
  var legal = legalFromWriter(writer);
  return Boolean(legal.first && legal.last);
}

function artistLegal(artist) {
  artist = artist || {};
  return {
    first: trim(artist.legal_first || artist.legalFirst),
    last: trim(artist.legal_last || artist.legalLast),
    name: trim(artist.name),
    id: trim(artist.id || artist.artist_id),
  };
}

function validateUploadLegal(fields) {
  fields = fields || {};
  var mode = trim(fields.artist_mode || fields.mode);
  if (mode === 'link') return { error: LINK_COPY };
  var creating = mode === 'create' || fields.creating_artist === true;
  if (creating) {
    var created = validateLegalName(fields.legal_first, fields.legal_last);
    if (created.error) return created;
  }
  return { ok: true };
}

function validateWriterLines(fields) {
  fields = fields || {};
  if (fields.other_writers) {
    var count = Number(fields.other_writer_count);
    if (!count || count < 1) return { error: OTHER_COUNT };
    return { ok: true };
  }
  var legal = validateLegalName(fields.legal_first, fields.legal_last);
  if (legal.error) return { error: WRITER_LINE };
  return { ok: true };
}

function validateCredits(fields) {
  fields = fields || {};
  var credits = fields.credits || {};
  var performer = trim(credits.performer);
  if (!performer || isAiName(performer)) return { error: PERFORMER };
  var producer = trim(credits.producer);
  if (!producer && fields.made_how === 'fully_ai' && !fields.directed) return { error: PRODUCER };
  return { ok: true };
}

function defaultCredits(fields) {
  fields = fields || {};
  var name = joinName(fields.legal_first, fields.legal_last) || trim(fields.name);
  if (fields.made_how === 'fully_ai') {
    return { writer: '', performer: name, producer: name };
  }
  return {
    writer: (fields.did_lyrics || fields.did_beat) ? name : '',
    performer: name,
    producer: fields.did_beat ? name : '',
  };
}

function validateAttestExtras() {
  return { ok: true };
}

function readDraft(win) {
  win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
  var raw = '';
  try {
    if (win && win.localStorage) raw = win.localStorage.getItem(DRAFT_KEY) || win.localStorage.getItem(SHEET_KEY) || '';
  } catch (err) {}
  if (!raw) {
    try {
      if (win && win.sessionStorage) raw = win.sessionStorage.getItem(DRAFT_KEY) || win.sessionStorage.getItem(SHEET_KEY) || '';
    } catch (err2) {}
  }
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch (err3) { return {}; }
}

function writeDraft(patch, win) {
  win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
  var next = readDraft(win);
  Object.keys(patch || {}).forEach(function (key) {
    if (patch[key] !== undefined) next[key] = patch[key];
  });
  var text = JSON.stringify(next);
  try { if (win && win.localStorage) win.localStorage.setItem(DRAFT_KEY, text); } catch (err) {}
  try { if (win && win.sessionStorage) win.sessionStorage.setItem(DRAFT_KEY, text); } catch (err2) {}
  try { if (win && win.localStorage) win.localStorage.setItem(SHEET_KEY, text); } catch (err3) {}
  try { if (win && win.sessionStorage) win.sessionStorage.setItem(SHEET_KEY, text); } catch (err4) {}
  return next;
}

function rememberLegal() {}
function rememberedLegal() { return { first: '', last: '' }; }
function writeLegalToArtist() { return Promise.resolve(null); }
function installUploadGate(root) { return root && root.PlaigroundUploadRequired; }
function seedWriters(fields) {
  fields = fields || {};
  var list = Array.isArray(fields.writers) && fields.writers.length ? fields.writers.slice() : [];
  var first = trim(fields.legal_first);
  var last = trim(fields.legal_last);
  if (!list[0]) {
    list[0] = {
      name: joinName(first, last) || trim(fields.writer_name || fields.name),
      first_name: first,
      last_name: last,
      email: '',
      share: 100,
    };
  }
  var extra = Number(fields.other_writer_count) || 0;
  var i;
  for (i = list.length; i < extra + 1; i += 1) {
    list.push({ name: '', first_name: '', last_name: '', email: '', share: 0 });
  }
  return list;
}
function consumeFreshStart() { return false; }
function activateHeldDraft(win) { return readDraft(win); }
function markFreshStart() {}

function isSavedDraftFlag(draft) {
  return Boolean(draft && (draft.saved_draft === true || draft.saved_draft === 'true'));
}

function isLeftoverSavedDraft(draft) {
  if (!isSavedDraftFlag(draft)) return false;
  if (draft.submitted === true || draft.submitted === 'true') return false;
  var status = trim(draft.tonegrid_status || draft.status).toLowerCase();
  if (status && status !== 'draft') return false;
  return true;
}

function isUnsubmittedDraft(row, draft) {
  row = row || {};
  draft = draft || {};
  if (row.local_draft === true || String(row.id || '') === 'local-draft') return true;
  if (isSavedDraftFlag(row)) return true;
  var rowId = String(row.uuid || (row.id && row.id !== 'local-draft' ? row.id : '') || '').toLowerCase();
  var draftId = String(draft.release_id || '').toLowerCase();
  if (isLeftoverSavedDraft(draft) && rowId && draftId && rowId === draftId) return true;
  var submitted = row.submitted != null ? row.submitted : draft.submitted;
  if (submitted === true || submitted === 'true') return false;
  var status = trim(row.status || row.tonegrid_status).toLowerCase();
  return status === 'draft';
}

function savedDraftRelease() {
  return null;
}

function withSavedDraft(releases) {
  var list = Array.isArray(releases) ? releases.slice() : [];
  return list.filter(function (row) {
    return !isUnsubmittedDraft(row);
  });
}

function displayDraft() {
  return {};
}

function storageOf(win, kind) {
  if (!win) return null;
  try {
    return kind === 'session' ? win.sessionStorage : win.localStorage;
  } catch (err) {
    return null;
  }
}

function removeKey(store, key) {
  try {
    if (store && typeof store.removeItem === 'function') store.removeItem(key);
  } catch (err) {}
}

function clearWorkingDraft(win) {
  win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
  removeKey(storageOf(win, 'local'), DRAFT_KEY);
  removeKey(storageOf(win, 'local'), SHEET_KEY);
  removeKey(storageOf(win, 'session'), DRAFT_KEY);
  removeKey(storageOf(win, 'session'), SHEET_KEY);
}

function clearHeldDraft(win) {
  win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
  removeKey(storageOf(win, 'local'), HELD_KEY);
  removeKey(storageOf(win, 'session'), HELD_KEY);
}

function parkSavedDraft() {
  return false;
}

function dropLeftoverSavedDraft(win) {
  win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
  var draft = readDraft(win);
  if (!isLeftoverSavedDraft(draft)) return false;
  clearWorkingDraft(win);
  clearHeldDraft(win);
  return true;
}

function collapseDuplicateTitles(releases) {
  var list = Array.isArray(releases) ? releases.slice() : [];
  var byTitle = {};
  var out = [];
  list.forEach(function (row) {
    if (!row) return;
    var title = trim(row.title).toLowerCase();
    var id = trim(row.uuid || row.id);
    if (!title || !id) {
      out.push(row);
      return;
    }
    var prev = byTitle[title];
    if (!prev) {
      byTitle[title] = row;
      out.push(row);
      return;
    }
    var prevAt = String(prev.created_at || '');
    var nextAt = String(row.created_at || '');
    if (nextAt > prevAt) {
      out[out.indexOf(prev)] = row;
      byTitle[title] = row;
    }
  });
  return out;
}

var api = {
  DRAFT_KEY: DRAFT_KEY,
  LEGAL_BOTH: LEGAL_BOTH,
  LINK_COPY: LINK_COPY,
  OTHER_COUNT: OTHER_COUNT,
  PERFORMER: PERFORMER,
  PRODUCER: PRODUCER,
  WRITER_LINE: WRITER_LINE,
  activateHeldDraft: activateHeldDraft,
  artistLegal: artistLegal,
  clearHeldDraft: clearHeldDraft,
  clearWorkingDraft: clearWorkingDraft,
  collapseDuplicateTitles: collapseDuplicateTitles,
  consumeFreshStart: consumeFreshStart,
  defaultCredits: defaultCredits,
  displayDraft: displayDraft,
  dropLeftoverSavedDraft: dropLeftoverSavedDraft,
  installUploadGate: installUploadGate,
  isLeftoverSavedDraft: isLeftoverSavedDraft,
  isUnsubmittedDraft: isUnsubmittedDraft,
  joinName: joinName,
  legalFromWriter: legalFromWriter,
  markFreshStart: markFreshStart,
  parkSavedDraft: parkSavedDraft,
  readDraft: readDraft,
  savedDraftRelease: savedDraftRelease,
  rememberLegal: rememberLegal,
  rememberedLegal: rememberedLegal,
  seedWriters: seedWriters,
  splitName: splitName,
  validateAttestExtras: validateAttestExtras,
  validateCredits: validateCredits,
  validateLegalName: validateLegalName,
  validateUploadLegal: validateUploadLegal,
  validateWriterLines: validateWriterLines,
  withSavedDraft: withSavedDraft,
  writeDraft: writeDraft,
  writeLegalToArtist: writeLegalToArtist,
  writerHasLegalName: writerHasLegalName,
};

if (typeof module === 'object' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundReleaseCredits = api;
}
if (typeof window !== 'undefined') {
  window.PlaigroundReleaseCredits = api;
  try { dropLeftoverSavedDraft(window); } catch (err) {}
}
