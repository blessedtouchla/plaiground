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

function creditOwners(owner) {
  const name = trim(owner);
  return {
    copyright_holder: name,
    copyright_owner: name,
    rights_owner: name,
    master_owner: name,
  };
}

function releaseCreateFields(owner, year) {
  const payload = Object.assign({
    label: STORE_LABEL,
  }, creditOwners(owner));
  if (year) payload.copyright_year = year;
  const lines = copyrightLines(owner, year);
  if (lines.c_line) payload.c_line = lines.c_line;
  if (lines.p_line) payload.p_line = lines.p_line;
  if (lines.copyright_line) payload.copyright_line = lines.copyright_line;
  return payload;
}

function releasePatchFields(owner, year) {
  return releaseCreateFields(owner, year);
}

function rightsEnvelope(owner, year) {
  const lines = copyrightLines(owner, year);
  const payload = creditOwners(owner);
  if (year) payload.copyright_year = year;
  if (lines.p_line) payload.p_line = lines.p_line;
  if (lines.c_line) payload.c_line = lines.c_line;
  if (lines.copyright_line) payload.copyright_line = lines.copyright_line;
  return payload;
}

function rightsEnvelopeRetry(owner, year) {
  const base = rightsEnvelope(owner, year);
  const name = trim(owner);
  return {
    copyrightHolder: base.copyright_holder,
    copyrightOwner: base.copyright_owner,
    rightsOwner: base.rights_owner,
    masterOwner: base.master_owner,
    copyrightYear: base.copyright_year,
    cLine: base.c_line,
    pLine: base.p_line,
    copyrightLine: base.copyright_line,
    p_line_owner: name,
    phonogram_owner: name,
    copyright_line: base.copyright_line,
    c_line: base.c_line,
    p_line: base.p_line,
    copyright_year: base.copyright_year,
    copyright_holder: base.copyright_holder,
    rights_owner: base.rights_owner,
    master_owner: base.master_owner,
  };
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

function songwriterParts(owner) {
  if (owner && typeof owner === 'object') {
    const first = trim(owner.first || owner.first_name || owner.legal_first);
    const last = trim(owner.last || owner.last_name || owner.legal_last);
    const name = trim(owner.name) || [first, last].filter(Boolean).join(' ');
    return { first: first, last: last, name: name };
  }
  const name = trim(owner);
  const split = credits.splitName(name);
  return { first: split.first, last: split.last, name: name };
}

function writerCreateBody(owner) {
  const parts = songwriterParts(owner);
  const body = { name: parts.name, legal_name: parts.name };
  if (parts.first) {
    body.first_name = parts.first;
    body.legal_first = parts.first;
  }
  if (parts.last) {
    body.last_name = parts.last;
    body.legal_last = parts.last;
  }
  return body;
}

function trackWritersBody(writerId, owner) {
  const parts = songwriterParts(owner);
  const row = {
    writer_uuid: trim(writerId),
    role: WRITER_ROLE,
    composer_share_percent: 100,
    master_share_percent: 0,
  };
  if (parts.name) {
    row.name = parts.name;
    row.legal_name = parts.name;
  }
  if (parts.first) {
    row.first_name = parts.first;
    row.legal_first = parts.first;
  }
  if (parts.last) {
    row.last_name = parts.last;
    row.legal_last = parts.last;
  }
  return { writers: [row] };
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
  rightsEnvelopeRetry,
  songwriterParts,
  storedCreditFields,
  trackWritersBody,
  writerCreateBody,
  filled,
};
