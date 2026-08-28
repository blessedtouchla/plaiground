'use strict';

/**
 * Private legal names, writer lines, and store credits.
 * Does not hop, attach, or send Continue.
 */

var LEGAL_BOTH = 'Legal first and last name are both required. Not a stage name, rapper name, or band name.';
var LINK_COPY = 'Merge that artist on Artist Profiles first, then pick them here.';
var OTHER_COUNT = 'How many other writers are on this song?';
var PERFORMER = 'Add a performer credit. Use the artist name, not AI.';
var PRODUCER = 'Add a producer credit. If you directed this recording, claim that below.';
var WRITER_LINE = 'This song needs a songwriter legal first and last name.';
var DRAFT_KEY = 'plaiground.store.draft';
var SHEET_KEY = 'plaiground.tonegrid.draft';
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
  try {
    return JSON.parse(raw) || {};
  } catch (err3) {
    return {};
  }
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

function rememberedLegal(win) {
  win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
  try {
    var raw = win && win.localStorage ? win.localStorage.getItem(LEGAL_KEY) : '';
    var parsed = raw ? JSON.parse(raw) : {};
    return {
      first: trim(parsed && parsed.first),
      last: trim(parsed && parsed.last),
    };
  } catch (err) {
    return { first: '', last: '' };
  }
}

function rememberLegal(first, last, win) {
  win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
  if (!filled(first) || !filled(last)) return;
  try {
    if (win && win.localStorage) {
      win.localStorage.setItem(LEGAL_KEY, JSON.stringify({ first: trim(first), last: trim(last) }));
    }
  } catch (err) {}
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

function defaultCredits(fields) {
  fields = fields || {};
  var stage = trim(fields.performer || fields.name || fields.artist);
  var legal = validateLegalName(fields.legal_first, fields.legal_last);
  var writerName = legal.ok ? legal.name : '';
  var lyrics = fields.did_lyrics === true || fields.did_lyrics === 'true';
  var beat = fields.did_beat === true || fields.did_beat === 'true';
  var directed = fields.directed === true || fields.directed === 'true';
  var fullyAi = trim(fields.made_how) === 'fully_ai';
  var credits = fields.credits && typeof fields.credits === 'object' ? fields.credits : {};
  var performer = trim(credits.performer) || stage;
  var writer = trim(credits.writer);
  if (!writer && lyrics && writerName && !fullyAi) writer = writerName;
  if (fullyAi && !lyrics) writer = trim(credits.writer);
  var producer = trim(credits.producer);
  if (!producer && (beat || (fullyAi && directed))) producer = stage || writerName;
  return {
    performer: performer,
    writer: writer,
    producer: producer,
    did_lyrics: lyrics,
    did_beat: beat,
    directed: directed,
  };
}

function validateCredits(fields) {
  var credits = defaultCredits(fields);
  if (!filled(credits.performer) || isAiName(credits.performer)) {
    return { error: PERFORMER };
  }
  if (!filled(credits.producer) || isAiName(credits.producer)) {
    return { error: PRODUCER };
  }
  return { ok: true, credits: credits };
}

function validateWriterLines(fields) {
  var featured = filled(fields && fields.featured);
  var others = fields && (fields.other_writers === true || fields.other_writers === 'true');
  if (featured) others = true;
  if (others) {
    var count = Number(fields && fields.other_writer_count);
    if (!count || count < 1) return { error: OTHER_COUNT };
    return { ok: true };
  }
  var writers = fields && Array.isArray(fields.writers) ? fields.writers : [];
  var firstWriter = writers[0] || {
    first_name: fields && fields.legal_first,
    last_name: fields && fields.legal_last,
  };
  if (!writerHasLegalName(firstWriter)) return { error: WRITER_LINE };
  return { ok: true };
}

function validateAttestExtras(fields) {
  fields = fields || {};
  var gated = fields.credits
    || Object.prototype.hasOwnProperty.call(fields, 'legal_first')
    || Object.prototype.hasOwnProperty.call(fields, 'other_writers')
    || Object.prototype.hasOwnProperty.call(fields, 'did_lyrics');
  if (!gated) return { ok: true };
  var writers = validateWriterLines(fields);
  if (writers.error) return writers;
  return validateCredits(fields);
}

function validateUploadLegal(fields) {
  fields = fields || {};
  var mode = trim(fields.artist_mode || fields.mode);
  if (mode === 'link') return { error: LINK_COPY };
  var creating = mode === 'create' || fields.creating_artist === true;
  if (creating) return validateLegalName(fields.legal_first, fields.legal_last);
  if (!Object.prototype.hasOwnProperty.call(fields, 'legal_first')
    && !Object.prototype.hasOwnProperty.call(fields, 'legal_last')) {
    return { ok: true };
  }
  return validateLegalName(fields.legal_first, fields.legal_last);
}

function otherWriterLineCount(fields) {
  var n = Number(fields && fields.other_writer_count);
  if (!n || n < 1) n = 1;
  if (n > 4) n = 4;
  return n + 1;
}

function seedWriters(fields) {
  fields = fields || {};
  var legal = legalFromWriter({
    first_name: fields.legal_first,
    last_name: fields.legal_last,
    name: fields.writer_name,
  });
  var others = fields.other_writers === true || fields.other_writers === 'true' || filled(fields.featured);
  var list = Array.isArray(fields.writers) && fields.writers.length ? fields.writers.slice() : [];
  var count = others ? otherWriterLineCount(fields) : 1;
  while (list.length < count) {
    list.push({ first_name: '', last_name: '', name: '', email: '', share: 0, pro: '' });
  }
  if (list.length > count) list = list.slice(0, count);
  if (!list[0]) list[0] = {};
  if (!filled(list[0].first_name)) list[0].first_name = legal.first;
  if (!filled(list[0].last_name)) list[0].last_name = legal.last;
  if (!filled(list[0].name)) list[0].name = legal.name;
  var share = count ? Math.round((10000 / count)) / 100 : 100;
  list.forEach(function (row, index) {
    row.share = row.share || (index === 0 ? (100 - share * (count - 1)) : share);
    row.email = trim(row.email);
    row.pro = trim(row.pro);
    var names = legalFromWriter(row);
    row.first_name = names.first;
    row.last_name = names.last;
    row.name = names.name;
  });
  return list;
}

function savedDraftRelease(draft) {
  draft = draft || {};
  if (draft.saved_draft !== true && draft.saved_draft !== 'true') return null;
  if (draft.submitted === true || draft.submitted === 'true') return null;
  var status = trim(draft.tonegrid_status || draft.status).toLowerCase();
  if (status && status !== 'draft') return null;
  return {
    id: 'local-draft',
    uuid: '',
    title: trim(draft.title) || 'Untitled',
    status: 'draft',
    type: trim(draft.type) || 'single',
    artwork_url: trim(draft.artwork_url),
    artwork_object_key: trim(draft.artwork_object_key),
    local_draft: true,
    href: 'upload.html',
  };
}

function withSavedDraft(list, draft) {
  var extra = savedDraftRelease(draft);
  var out = Array.isArray(list) ? list.slice() : [];
  if (!extra) return out;
  var exists = out.some(function (row) {
    return row && (row.id === 'local-draft' || row.local_draft === true);
  });
  if (!exists) out.unshift(extra);
  return out;
}

function writeLegalToArtist(artistId, first, last, win) {
  win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
  rememberLegal(first, last, win);
  if (!trim(artistId) || !filled(first) || !filled(last)) return Promise.resolve(null);
  if (!win || typeof win.fetch !== 'function') return Promise.resolve(null);
  return win.fetch('/api/me/artists', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update',
      artist_action: 'update',
      id: artistId,
      legal_first: trim(first),
      legal_last: trim(last),
      confirm_different: true,
    }),
  }).then(function (response) {
    return response.json().catch(function () { return {}; }).then(function (data) {
      return { ok: response.ok, data: data };
    });
  }).catch(function () {
    return null;
  });
}

function installUploadGate(root) {
  root = root || (typeof globalThis !== 'undefined' ? globalThis : null);
  if (!root || !root.PlaigroundUploadRequired || root.PlaigroundUploadRequired._creditsGate) return root && root.PlaigroundUploadRequired;
  var api = root.PlaigroundUploadRequired;
  var originalUpload = api.validateUploadPage;
  var originalAttest = api.validateAttestPage;
  api.validateUploadPage = function (fields) {
    var checked = originalUpload ? originalUpload(fields) : { ok: true };
    if (checked && checked.error) return checked;
    return validateUploadLegal(fields);
  };
  api.validateAttestPage = function (fields) {
    var checked = originalAttest ? originalAttest(fields) : { ok: true };
    if (checked && checked.error) return checked;
    return validateAttestExtras(fields);
  };
  api._creditsGate = true;
  return api;
}

var api = {
  DRAFT_KEY: DRAFT_KEY,
  LEGAL_BOTH: LEGAL_BOTH,
  LINK_COPY: LINK_COPY,
  OTHER_COUNT: OTHER_COUNT,
  PERFORMER: PERFORMER,
  PRODUCER: PRODUCER,
  WRITER_LINE: WRITER_LINE,
  artistLegal: artistLegal,
  defaultCredits: defaultCredits,
  installUploadGate: installUploadGate,
  joinName: joinName,
  legalFromWriter: legalFromWriter,
  otherWriterLineCount: otherWriterLineCount,
  readDraft: readDraft,
  rememberLegal: rememberLegal,
  rememberedLegal: rememberedLegal,
  savedDraftRelease: savedDraftRelease,
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
}
