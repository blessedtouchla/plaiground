'use strict';

/**
 * Auto-fill store credit / legal fields from names we already collect.
 * No form widgets. Never uses a stage, rapper, or band name.
 */

const credits = require('./release-credits');
const profileLib = require('./profile');

const STORE_LABEL = 'PLAIGROUND';
const WRITER_ROLE = 'composer_lyricist';

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function filled(value) {
  return trim(value) !== '';
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

function resolveSongwriter(body, artists) {
  const writers = body && Array.isArray(body.writers) ? body.writers : [];
  if (writers[0]) {
    const fromWriter = credits.legalFromWriter(writers[0]);
    if (fromWriter.first && fromWriter.last) {
      return {
        ok: true,
        first: fromWriter.first,
        last: fromWriter.last,
        name: fromWriter.name,
      };
    }
  }
  const fromBody = credits.validateLegalName(
    body && (body.legal_first || body.legalFirst),
    body && (body.legal_last || body.legalLast)
  );
  if (fromBody.ok) return fromBody;
  const artist = pickArtist(artists, body);
  const fromArtist = credits.artistLegal(artist);
  if (fromArtist.first && fromArtist.last) {
    return credits.validateLegalName(fromArtist.first, fromArtist.last);
  }
  return { error: credits.WRITER_LINE };
}

function copyrightYearFromDate(date) {
  const raw = trim(date);
  const match = raw.match(/^(\d{4})/);
  if (!match) return '';
  const year = Number(match[1]);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return '';
  return year;
}

function copyrightLines(owner, year) {
  const name = trim(owner);
  const y = year;
  if (!name || !y) return { c_line: '', p_line: '', copyright_line: '' };
  return {
    c_line: '(C) ' + y + ' ' + name,
    p_line: '(P) ' + y + ' ' + name,
    copyright_line: '© ' + y + ' ' + name + ' / ℗ ' + y + ' ' + name,
  };
}

function releaseCreateFields(owner, year) {
  const payload = {
    label: STORE_LABEL,
    copyright_holder: trim(owner),
  };
  if (year) payload.copyright_year = year;
  return payload;
}

function releasePatchFields(owner, year) {
  return releaseCreateFields(owner, year);
}

function rightsEnvelope(owner, year) {
  const lines = copyrightLines(owner, year);
  const payload = {};
  if (lines.p_line) payload.p_line = lines.p_line;
  if (lines.c_line) payload.c_line = lines.c_line;
  if (year) payload.copyright_year = year;
  return payload;
}

function storedCreditFields(owner, year) {
  const name = trim(owner);
  const lines = copyrightLines(name, year);
  const out = {
    label: STORE_LABEL,
    rights_owner: name,
    copyright_owner: name,
    copyright_holder: name,
    master_owner: name,
    writers: name ? [{ name: name }] : [],
  };
  if (year) out.copyright_year = year;
  if (lines.c_line) out.c_line = lines.c_line;
  if (lines.p_line) out.p_line = lines.p_line;
  if (lines.copyright_line) out.copyright_line = lines.copyright_line;
  return out;
}

function writerCreateBody(owner) {
  const name = trim(owner);
  return { name: name, legal_name: name };
}

function trackWritersBody(writerId) {
  return {
    writers: [{
      writer_uuid: trim(writerId),
      role: WRITER_ROLE,
      composer_share_percent: 100,
      master_share_percent: 0,
    }],
  };
}

module.exports = {
  STORE_LABEL,
  WRITER_ROLE,
  copyrightLines,
  copyrightYearFromDate,
  pickArtist,
  releaseCreateFields,
  releasePatchFields,
  resolveSongwriter,
  rightsEnvelope,
  storedCreditFields,
  trackWritersBody,
  writerCreateBody,
  filled,
};
