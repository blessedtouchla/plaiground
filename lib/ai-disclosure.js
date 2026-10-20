'use strict';

/**
 * PLAIGROUND's own copy of each song's AI disclosure.
 * Saved on the release record in the account profile (releases[].plaiground_ai_disclosure).
 * Internal only. Never forwarded to the distributor; store-ai.js still decides what goes out.
 */

var MADE_HOW = { no_ai: true, ai_assisted: true, fully_ai: true };
var MAX_TEXT = 4000;
var MAX_LYRICS = 20000;

function trim(value, max) {
  var out = String(value == null ? '' : value).trim();
  return max ? out.slice(0, max) : out;
}

function bool(value) {
  return value === true || value === 'true';
}

function isoOrEmpty(value) {
  var text = trim(value, 40);
  if (!text) return '';
  var date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function madeHow(value) {
  var key = trim(value).toLowerCase();
  return MADE_HOW[key] ? key : '';
}

function tagList(list) {
  return (Array.isArray(list) ? list : [])
    .map(function (item) { return trim(item, 80); })
    .filter(Boolean)
    .slice(0, 30);
}

function trackLyrics(list) {
  return (Array.isArray(list) ? list : []).slice(0, 50).map(function (row) {
    row = row && typeof row === 'object' ? row : {};
    return {
      track_id: trim(row.track_id || row.id, 80),
      title: trim(row.title, 200),
      lyrics: trim(row.lyrics, MAX_LYRICS),
    };
  }).filter(function (row) { return row.lyrics; });
}

/** Normalize a stored or incoming record. Returns null when there is nothing worth keeping. */
function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  var out = {
    made_how: madeHow(raw.made_how),
    auto_switched: bool(raw.auto_switched),
    switched_from: madeHow(raw.switched_from),
    ai_used: bool(raw.ai_used),
    human_elements: tagList(raw.human_elements),
    human_contribution: trim(raw.human_contribution, MAX_TEXT),
    ai_service: trim(raw.ai_service, 80),
    ai_service_other: trim(raw.ai_service_other, 80),
    made_caption: trim(raw.made_caption, 600),
    rights_confirmed: bool(raw.rights_confirmed),
    rights_confirmed_at: isoOrEmpty(raw.rights_confirmed_at),
    plaiground_artist_id: trim(raw.plaiground_artist_id, 80),
    artist: trim(raw.artist, 200),
    legal_first: trim(raw.legal_first, 120),
    legal_last: trim(raw.legal_last, 120),
    instrumental: bool(raw.instrumental),
    lyrics: trim(raw.lyrics, MAX_LYRICS),
    track_lyrics: trackLyrics(raw.track_lyrics),
    saved_at: isoOrEmpty(raw.saved_at),
  };
  if (!out.switched_from && out.auto_switched) out.switched_from = 'ai_assisted';
  if (!out.auto_switched) out.switched_from = '';
  if (!out.made_how && !out.human_elements.length && !out.human_contribution && !out.rights_confirmed) return null;
  return out;
}

/**
 * Build the record from the submit body. Reads body.plaiground_disclosure when the
 * client sent it, and falls back to the flat fields the submit already carries.
 */
function fromSubmit(body, extra) {
  body = body && typeof body === 'object' ? body : {};
  extra = extra && typeof extra === 'object' ? extra : {};
  var nested = body.plaiground_disclosure && typeof body.plaiground_disclosure === 'object'
    ? body.plaiground_disclosure
    : {};
  function pick(key) {
    return Object.prototype.hasOwnProperty.call(nested, key) ? nested[key] : body[key];
  }
  return normalize({
    made_how: pick('made_how'),
    auto_switched: nested.auto_switched,
    switched_from: nested.switched_from,
    ai_used: Object.prototype.hasOwnProperty.call(nested, 'ai_used')
      ? nested.ai_used
      : (madeHow(body.made_how) === 'ai_assisted' || madeHow(body.made_how) === 'fully_ai'),
    human_elements: pick('human_elements'),
    human_contribution: pick('human_contribution'),
    ai_service: pick('ai_service'),
    ai_service_other: pick('ai_service_other'),
    made_caption: nested.made_caption,
    rights_confirmed: pick('rights_confirmed'),
    rights_confirmed_at: nested.rights_confirmed_at || (bool(pick('rights_confirmed')) ? (extra.at || new Date()).toISOString() : ''),
    plaiground_artist_id: nested.plaiground_artist_id || extra.plaiground_artist_id || body.plaiground_artist_id,
    artist: nested.artist || extra.artist || body.artist,
    legal_first: nested.legal_first || extra.legal_first || body.legal_first,
    legal_last: nested.legal_last || extra.legal_last || body.legal_last,
    instrumental: nested.instrumental,
    lyrics: nested.lyrics,
    track_lyrics: nested.track_lyrics,
    saved_at: (extra.at || new Date()).toISOString(),
  });
}

function label(how) {
  if (how === 'no_ai') return 'Human';
  if (how === 'ai_assisted') return 'AI-assisted';
  if (how === 'fully_ai') return 'Fully AI';
  return '(not set)';
}

function toolName(rec) {
  if (rec.ai_service) return rec.ai_service;
  if (rec.ai_service_other) return 'Other: ' + rec.ai_service_other;
  return '(none)';
}

/** Short one-line summary for the admin table. */
function summary(raw) {
  var rec = normalize(raw);
  if (!rec) return '';
  var parts = [label(rec.made_how)];
  if (rec.auto_switched) parts.push('auto-switched from ' + label(rec.switched_from));
  if (rec.made_how !== 'no_ai') parts.push('tool ' + toolName(rec));
  if (rec.human_elements.length) parts.push(rec.human_elements.join(', '));
  parts.push(rec.rights_confirmed ? 'rights OK' : 'rights NOT confirmed');
  return parts.join(' | ');
}

/** Plain text lines for the QC email. */
function emailLines(raw) {
  var rec = normalize(raw);
  if (!rec) return ['AI disclosure: (none saved)'];
  var name = [rec.legal_first, rec.legal_last].filter(Boolean).join(' ');
  var lyricCount = rec.track_lyrics.length;
  return [
    'AI disclosure: ' + label(rec.made_how) + (rec.auto_switched ? ' (auto-switched from ' + label(rec.switched_from) + ')' : ''),
    'Used AI box: ' + (rec.ai_used ? 'checked' : 'not checked'),
    'AI tool: ' + toolName(rec),
    'Human elements: ' + (rec.human_elements.length ? rec.human_elements.join(', ') : '(none)'),
    'Human contribution: ' + (rec.human_contribution || '(blank)'),
    'Rights attested: ' + (rec.rights_confirmed ? 'yes' : 'no')
      + (rec.rights_confirmed_at ? ' at ' + rec.rights_confirmed_at : '')
      + (name ? ' by ' + name : ''),
    'Lyrics: ' + (rec.instrumental ? 'instrumental' : (rec.lyrics ? rec.lyrics.length + ' chars' : '(none)'))
      + (lyricCount ? ' + ' + lyricCount + ' track lyric sheet(s)' : ''),
  ];
}

/** Artist-facing read-only line for their own account. Never names the AI tool. */
function howItWasMade(raw) {
  var rec = normalize(raw);
  if (!rec || !rec.made_how) return null;
  var did = rec.made_how === 'fully_ai' && !rec.human_elements.length
    ? ''
    : rec.human_elements.join(', ');
  return {
    label: label(rec.made_how),
    human: did,
    description: rec.human_contribution,
    text: 'How it was made: ' + label(rec.made_how) + '.' + (did ? ' A person did: ' + did + '.' : ''),
  };
}

var api = { howItWasMade: howItWasMade, normalize: normalize, fromSubmit: fromSubmit, summary: summary, emailLines: emailLines, label: label };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.PlaigroundAiDisclosure = api;
