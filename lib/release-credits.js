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
  return { ok: true };
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
  if (!list[0]) list[0] = { name: trim(fields.writer_name || fields.name), first_name: '', last_name: '', email: '', share: 100 };
  return list;
}
function consumeFreshStart() { return false; }
function activateHeldDraft(win) { return readDraft(win); }
function clearHeldDraft() {}
function markFreshStart() {}
function parkSavedDraft() { return false; }

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
  consumeFreshStart: consumeFreshStart,
  installUploadGate: installUploadGate,
  joinName: joinName,
  legalFromWriter: legalFromWriter,
  markFreshStart: markFreshStart,
  parkSavedDraft: parkSavedDraft,
  readDraft: readDraft,
  rememberLegal: rememberLegal,
  rememberedLegal: rememberedLegal,
  seedWriters: seedWriters,
  splitName: splitName,
  validateAttestExtras: validateAttestExtras,
  validateLegalName: validateLegalName,
  validateUploadLegal: validateUploadLegal,
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
