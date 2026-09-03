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
  const fromArtist = typeof credits.artistLegal === 'function'
    ? credits.artistLegal(artist)
    : { first: '', last: '', name: artist && artist.name };
  const namedArtist = namedSongwriter(fromArtist.first, fromArtist.last, fromArtist.name);
  if (namedArtist) return namedArtist;
  const stage = trim(body && (body.artist_name || body.name || body.performer || body.artist || body.copyright_holder || body.copyright_owner || body.master_owner));
  if (stage) return namedSongwriter('', '', stage);
  const list = Array.isArray(artists) ? artists : [];
  for (let i = 0; i < list.length; i += 1) {
    const rosterName = trim(list[i] && list[i].name);
    if (rosterName) return namedSongwriter('', '', rosterName);
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

function isCreditsObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && (value.cOwner != null || value.pOwner != null || value.label != null
      || value.copyright_holder != null || value.master_owner != null
      || value.year != null));
}

function normalizeCredits(creditsOrOwner, year) {
  if (isCreditsObject(creditsOrOwner)) {
    const c = trim(creditsOrOwner.cOwner || creditsOrOwner.copyright_holder);
    const p = trim(creditsOrOwner.pOwner || creditsOrOwner.master_owner);
    return {
      label: trim(creditsOrOwner.label),
      cOwner: c,
      pOwner: p,
      year: creditsOrOwner.year || year || '',
    };
  }
  const name = trim(creditsOrOwner);
  return { label: '', cOwner: name, pOwner: name, year: year || '' };
}

function creditsFromHop(body, songwriter, fallbackYear) {
  const name = songwriter && songwriter.name ? trim(songwriter.name) : '';
  const label = trim(body && (body.label || body.record_label));
  const cOwner = trim(body && (body.copyright_holder || body.copyright_owner || body.c_owner)) || name;
  const pOwner = trim(body && (body.master_owner || body.p_owner || body.phonogram_owner)) || name;
  const year = copyrightYearFromDate(body && (body.copyright_year || body.copyrightYear)) || fallbackYear || '';
  return { label: label, cOwner: cOwner, pOwner: pOwner, year: year };
}

function copyrightLines(cOwner, pOwner, year) {
  const c = trim(cOwner);
  const p = trim(pOwner);
  const y = year;
  if (!y || (!c && !p)) return { c_line: '', p_line: '', copyright_line: '' };
  const parts = [];
  if (c) parts.push('© ' + y + ' ' + c);
  if (p) parts.push('℗ ' + y + ' ' + p);
  return {
    c_line: c ? '(C) ' + y + ' ' + c : '',
    p_line: p ? '(P) ' + y + ' ' + p : '',
    copyright_line: parts.join(' / '),
  };
}

function creditOwners(cOwner, pOwner) {
  return {
    copyright_holder: trim(cOwner),
    copyright_owner: trim(cOwner),
    rights_owner: trim(cOwner),
    master_owner: trim(pOwner),
  };
}

function releaseCreateFields(creditsOrOwner, year) {
  const credits = normalizeCredits(creditsOrOwner, year);
  const payload = Object.assign(hopLabelFields(credits.label), creditOwners(credits.cOwner, credits.pOwner));
  if (credits.year) payload.copyright_year = credits.year;
  const lines = copyrightLines(credits.cOwner, credits.pOwner, credits.year);
  if (lines.c_line) payload.c_line = lines.c_line;
  if (lines.p_line) payload.p_line = lines.p_line;
  if (lines.copyright_line) payload.copyright_line = lines.copyright_line;
  return payload;
}

function releasePatchFields(creditsOrOwner, year) {
  return releaseCreateFields(creditsOrOwner, year);
}

function rightsEnvelope(creditsOrOwner, year) {
  const credits = normalizeCredits(creditsOrOwner, year);
  const lines = copyrightLines(credits.cOwner, credits.pOwner, credits.year);
  const payload = creditOwners(credits.cOwner, credits.pOwner);
  if (credits.year) payload.copyright_year = credits.year;
  if (lines.p_line) payload.p_line = lines.p_line;
  if (lines.c_line) payload.c_line = lines.c_line;
  if (lines.copyright_line) payload.copyright_line = lines.copyright_line;
  return payload;
}

function rightsEnvelopeRetry(creditsOrOwner, year) {
  const credits = normalizeCredits(creditsOrOwner, year);
  const base = rightsEnvelope(credits);
  const pName = trim(credits.pOwner);
  return {
    copyrightHolder: base.copyright_holder,
    copyrightOwner: base.copyright_owner,
    rightsOwner: base.rights_owner,
    masterOwner: base.master_owner,
    copyrightYear: base.copyright_year,
    cLine: base.c_line,
    pLine: base.p_line,
    copyrightLine: base.copyright_line,
    p_line_owner: pName,
    phonogram_owner: pName,
    copyright_line: base.copyright_line,
    c_line: base.c_line,
    p_line: base.p_line,
    copyright_year: base.copyright_year,
    copyright_holder: base.copyright_holder,
    rights_owner: base.rights_owner,
    master_owner: base.master_owner,
  };
}

function storedCreditFields(creditsOrOwner, year) {
  const credits = normalizeCredits(creditsOrOwner, year);
  const writerName = trim(credits.cOwner) || trim(credits.pOwner);
  const lines = copyrightLines(credits.cOwner, credits.pOwner, credits.year);
  const out = {
    label: hopLabel(credits.label),
    rights_owner: trim(credits.cOwner),
    copyright_owner: trim(credits.cOwner),
    copyright_holder: trim(credits.cOwner),
    master_owner: trim(credits.pOwner),
    writers: writerName ? [{ name: writerName }] : [],
  };
  if (credits.year) out.copyright_year = credits.year;
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

function personNameFields(owner) {
  const parts = songwriterParts(owner);
  if (!parts.name) return null;
  const row = { name: parts.name };
  if (parts.first) row.first_name = parts.first;
  if (parts.last) row.last_name = parts.last;
  return row;
}

function trackSongwriterFields(owner) {
  const person = personNameFields(owner);
  if (!person) return null;
  return {
    contributors: [
      Object.assign({}, person, { role: 'Songwriter' }),
      Object.assign({}, person, { role: 'Composer' }),
    ],
    songwriters: [person],
    composers: [Object.assign({}, person)],
  };
}

function trackWritersNameBody(owner) {
  const person = personNameFields(owner);
  if (!person) return { writers: [] };
  return {
    writers: [
      Object.assign({}, person, {
        role: WRITER_ROLE,
        composer_share_percent: 100,
        master_share_percent: 0,
      }),
    ],
  };
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
  WRITER_ROLE,
  hopLabel,
  hopLabelFields,
  copyrightLines,
  copyrightYearFromDate,
  creditsFromHop,
  pickArtist,
  releaseCreateFields,
  releasePatchFields,
  resolveSongwriter,
  rightsEnvelope,
  rightsEnvelopeRetry,
  songwriterParts,
  storedCreditFields,
  trackSongwriterFields,
  trackWritersBody,
  trackWritersNameBody,
  writerCreateBody,
  filled,
};
