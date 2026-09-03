'use strict';

/**
 * Auto-fill store credit / legal fields from names we already collect.
 * Label: typed value, or PLAIGROUND only when blank at hop/map time.
 * Never uses a stage, rapper, or band name for © / ℗.
 */

const credits = require('./release-credits');
const profileLib = require('./profile');

const WRITER_ROLE = 'composer_lyricist';

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function filled(value) {
  return trim(value) !== '';
}

function hopLabel(value) {
  const typed = trim(value);
  return typed || 'PLAIGROUND';
}

function hopLabelFields(value) {
  const label = hopLabel(value);
  return { label: label, record_label: label, label_name: label };
}

function pickArtist(artists, body) {
  const list = Array.isArray(artists) ? artists : [];
  const stored = { artists: list };
  const pgId = trim(body && (body.plaiground_artist_id || body.artist_profile_id));
  const storeId = trim(body && (body.artist_id || body.artistId));
  const name = trim(body && (body.artist_name || body.name));
  if (pgId) {
    const found = profileLib.findArtist(stored, pgId);
    if (found) return found;
  }
  if (storeId) {
    for (let i = 0; i < list.length; i += 1) {
      if (trim(list[i] && list[i].tonegrid_artist_id).toLowerCase() === storeId.toLowerCase()) {
        return list[i];
      }
    }
  }
  const resolved = profileLib.resolveArtist(stored, pgId || storeId, name);
  if (resolved) return resolved;
  if (list.length === 1) return list[0];
  return null;
}

function namedSongwriter(first, last, name) {
  first = trim(first);
  last = trim(last);
  const legalName = [first, last].filter(Boolean).join(' ');
  const display = (first && last) ? legalName : (trim(name) || legalName);
  if (!display) return null;
  const split = credits.splitName(display);
  const nextFirst = first || split.first || display;
  const nextLast = last || split.last || nextFirst;
  return { ok: true, first: nextFirst, last: nextLast, name: display };
}

function resolveSongwriter(body, artists) {
  const writers = body && Array.isArray(body.writers) ? body.writers : [];
  if (writers[0]) {
    const fromWriter = credits.legalFromWriter(writers[0]);
    const named = namedSongwriter(
      fromWriter.first,
      fromWriter.last,
      writers[0].name || fromWriter.name
    );
    if (named) return named;
  }
  const fromBody = namedSongwriter(
    body && (body.legal_first || body.legalFirst),
    body && (body.legal_last || body.legalLast),
    body && (body.songwriter_name || body.writer_name)
  );
  if (fromBody) return fromBody;
  const artist = pickArtist(artists, body);
  const fromArtist = credits.artistLegal(artist);
  const namedArtist = namedSongwriter(fromArtist.first, fromArtist.last, fromArtist.name);
  if (namedArtist) return namedArtist;
  const stage = trim(body && (body.artist_name || body.name || body.performer));
  if (stage) return namedSongwriter('', '', stage);
  return { error: credits.WRITER_LINE };
}
