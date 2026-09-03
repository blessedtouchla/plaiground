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
