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
  return { ok: true };
}

function otherWriterLineCount(fields) {
  var n = Number(fields && fields.other_writer_count);
  if (!n || n < 1) n = 1;
  if (n > 4) n = 4;
  return n + 1;
}
