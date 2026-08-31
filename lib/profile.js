'use strict';

/**
 * Account store on users.profile JSON.
 * Keeps the legacy public fields (photo / genres / specialties) and the
 * Artist Profiles roster: artists[] + releases[].
 */

const crypto = require('crypto');
const catalog = require('../upload-catalog');
const platformLinks = require('./platform-links');

const MAX_PHOTO_CHARS = 1200000;
const MAX_GENRES = 5;
const MAX_BIO = 2000;
const MAX_AI_DETAIL = 500;
const PHOTO_RE = /^data:image\/(jpeg|jpg|png);base64,/i;
const LIVE_STATUSES = new Set(['live', 'approved']);
const BLOCKING_RELEASE_STATUSES = new Set([
  'live',
  'approved',
  'delivered',
  'pending',
  'pending_review',
  'processing',
  'delivering',
]);
const HUMAN_CONTRIBUTIONS = [
  'lyrics',
  'vocals_performance',
  'melody_topline',
  'beats_production',
  'arrangement_mix',
  'concept_direction',
];
const AI_CONTRIBUTIONS = [
  'lyrics',
  'vocals_performance',
  'melody_topline',
  'beats_production',
  'arrangement_mix',
  'full_track_support',
];

function trim(value) {
  return String(value == null ? '' : value).trim();
}

const PLACEHOLDER_ARTISTS = {
  john: true,
  'john ham': true,
  'john doe': true,
  'john harper': true,
  patrick: true,
  'neon shadows': true,
  'neon sermon': true,
  'neon santos': true,
  'victoria reyes': true,
  'victoria void': true,
};

function artistKey(name) {
  return trim(name).toLowerCase().replace(/\s+/g, ' ');
}

function isPlaceholderArtist(name) {
  const next = artistKey(name);
  if (!next) return false;
  if (PLACEHOLDER_ARTISTS[next]) return true;
  const first = next.split(' ')[0];
  return first === 'john' || first === 'patrick';
}

function displayArtistName(name) {
  const next = trim(name);
  if (!next || isPlaceholderArtist(next)) return '';
  return next;
}

const USERNAME_RE = /^[a-z][a-z0-9_]{2,23}$/;
const RESERVED_USERNAMES = {
  admin: true,
  api: true,
  help: true,
  login: true,
  owner: true,
  plaiground: true,
  root: true,
  settings: true,
  signup: true,
  support: true,
  wannaplai: true,
};

function normalizeUsername(value) {
  const raw = trim(value);
  if (!raw) return { ok: true, username: '' };
  const next = raw.toLowerCase();
  if (next.length < 3 || next.length > 24) return { error: 'Username must be 3–24 characters.' };
  if (!USERNAME_RE.test(next)) {
    return { error: 'Username must start with a letter and use only letters, numbers, or _.' };
  }
  if (RESERVED_USERNAMES[next]) return { error: 'This username is reserved.' };
  return { ok: true, username: next };
}

function emptyProfile() {
  return { photo: '', genres: [], specialties: [], artists: [], releases: [], legal_name: '', country: '', username: '' };
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'pg-' + crypto.randomBytes(16).toString('hex');
}

function canonicalGenre(value) {
  const raw = trim(value);
  if (!raw) return '';
  const list = catalog.GENRES || [];
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] === raw) return list[i];
  }
  const lower = raw.toLowerCase();
  for (let j = 0; j < list.length; j += 1) {
    if (String(list[j]).toLowerCase() === lower) return list[j];
  }
  return null;
}

function canonicalSpecialty(value) {
  const raw = trim(value);
  if (!raw) return '';
  const list = catalog.HUMAN_TAGS || [];
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] === raw) return list[i];
  }
  const lower = raw.toLowerCase();
  for (let j = 0; j < list.length; j += 1) {
    if (String(list[j]).toLowerCase() === lower) return list[j];
  }
  return null;
}

function uniquePicks(values, canonicalize, unknownError, limit) {
  const out = [];
  const seen = new Set();
  const list = Array.isArray(values) ? values : [];
  for (let i = 0; i < list.length; i += 1) {
    const pick = canonicalize(list[i]);
    if (pick === '') continue;
    if (pick == null) return { error: unknownError };
    const key = pick.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pick);
    if (out.length > limit) return { error: 'Pick up to ' + limit + '.' };
  }
  return { ok: true, values: out };
}

function pickKeys(values, allowed) {
  const allow = new Set(allowed);
  const out = [];
  const list = Array.isArray(values) ? values : [];
  for (let i = 0; i < list.length; i += 1) {
    const key = trim(list[i]);
    if (!key || !allow.has(key) || out.indexOf(key) !== -1) continue;
    out.push(key);
  }
  return out;
}

function normalizeInvolvement(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 0 || i > 100) return null;
  return i;
}

function sanitizePhoto(value) {
  const raw = trim(value);
  if (!raw) return { ok: true, photo: '' };
  if (!PHOTO_RE.test(raw)) return { error: 'Photo must be a JPG or PNG.' };
  if (raw.length > MAX_PHOTO_CHARS) return { error: 'Photo is too large.' };
  return { ok: true, photo: raw };
}

function normalizeArtist(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = trim(raw.name);
  if (!name) return null;
  const source = raw.source === 'linked' ? 'linked' : 'created';
  const badge = source === 'linked' ? 'Linked' : 'PLAIGROUND';
  const genres = uniquePicks(raw.genres, canonicalGenre, 'genre must be a listed genre.', MAX_GENRES);
  const photo = sanitizePhoto(raw.photo);
  const check = String(raw.name_check || raw.artist_check || '').toLowerCase();
  const nameCheck = check === 'red' || check === 'yellow' || check === 'green' ? check : '';
  const artistId = trim(raw.id || raw.artist_id) || newId();
  const links = platformLinks.normalizeFromArtist(raw);
  return {
    id: artistId,
    artist_id: artistId,
    name: name,
    source: source,
    badge: badge,
    spotify_id: links.spotify_id,
    apple_id: links.apple_id,
    store_url: links.store_url,
    platform_links: links.platform_links,
    locked: raw.locked === true,
    name_check: nameCheck,
    review_status: trim(raw.review_status),
    impersonation_confirmed: raw.impersonation_confirmed === true,
    tonegrid_artist_id: trim(raw.tonegrid_artist_id),
    photo: photo.ok ? photo.photo : '',
    bio: trim(raw.bio).slice(0, MAX_BIO),
    genres: genres.values || [],
    human_contributions: pickKeys(raw.human_contributions, HUMAN_CONTRIBUTIONS),
    ai_contributions: pickKeys(raw.ai_contributions, AI_CONTRIBUTIONS),
    ai_process_detail: trim(raw.ai_process_detail).slice(0, MAX_AI_DETAIL),
    ai_involvement_percent: normalizeInvolvement(raw.ai_involvement_percent),
    change_request: trim(raw.change_request).slice(0, 1000),
    legal_first: trim(raw.legal_first).slice(0, 80),
    legal_last: trim(raw.legal_last).slice(0, 80),
    edit_status: trim(raw.edit_status).toLowerCase() === 'pending' ? 'pending' : '',
    pending_edit: normalizePendingEdit(raw.pending_edit),
    created_at: trim(raw.created_at) || new Date().toISOString(),
  };
}

function isAccepted(artist) {
  if (!artist || !trim(artist.name)) return false;
  const review = trim(artist.review_status).toLowerCase();
  if (review === 'pending' || review === 'in_review' || review === 'review') return false;
  if (String(artist.name_check || '').toLowerCase() === 'red' && review !== 'accepted') return false;
  return artist.source === 'created' || artist.source === 'linked';
}

function normalizePendingEdit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const genres = uniquePicks(raw.genres, canonicalGenre, 'genre must be a listed genre.', MAX_GENRES);
  const photo = sanitizePhoto(raw.photo);
  const name = trim(raw.name);
  const links = platformLinks.normalizeFromArtist(raw);
  return {
    name: name,
    photo: photo.ok ? photo.photo : '',
    bio: trim(raw.bio).slice(0, MAX_BIO),
    genres: genres.values || [],
    spotify_id: links.spotify_id,
    apple_id: links.apple_id,
    store_url: links.store_url,
    platform_links: links.platform_links,
    human_contributions: pickKeys(raw.human_contributions, HUMAN_CONTRIBUTIONS),
    ai_contributions: pickKeys(raw.ai_contributions, AI_CONTRIBUTIONS),
    ai_process_detail: trim(raw.ai_process_detail).slice(0, MAX_AI_DETAIL),
    ai_involvement_percent: normalizeInvolvement(raw.ai_involvement_percent),
    change_request: trim(raw.change_request).slice(0, 1000),
    submitted_at: trim(raw.submitted_at) || new Date().toISOString(),
  };
}

function displayArtist(artist) {
  if (!artist) return null;
  const pending = artist.pending_edit;
  if (!pending) return artist;
  const locked = artist.locked === true;
  return Object.assign({}, artist, pending, {
    name: locked ? artist.name : (pending.name || artist.name),
    spotify_id: locked ? artist.spotify_id : (pending.spotify_id || artist.spotify_id),
    apple_id: locked ? artist.apple_id : (pending.apple_id || artist.apple_id),
    store_url: locked ? artist.store_url : (pending.store_url || artist.store_url),
    platform_links: locked
      ? (artist.platform_links || [])
      : (pending.platform_links && pending.platform_links.length ? pending.platform_links : (artist.platform_links || [])),
    locked: locked,
    source: artist.source,
    badge: artist.badge,
    name_check: artist.name_check,
    review_status: artist.review_status,
    edit_status: artist.edit_status,
    pending_edit: pending,
    tonegrid_artist_id: artist.tonegrid_artist_id,
    id: artist.id,
    artist_id: artist.artist_id,
  });
}

function coverUrlApi() {
  try {
    return require('./cover-url');
  } catch (err) {
    return null;
  }
}

function storedArtworkUrl(raw) {
  const api = coverUrlApi();
  if (api && typeof api.stored === 'function') return api.stored(raw);
  const url = trim(raw && (raw.artwork_url || raw.cover_art_url || raw.cover_url));
  return /^https?:\/\//i.test(url) ? url : '';
}

function storedArtworkKey(raw) {
  const api = coverUrlApi();
  if (api && typeof api.objectKey === 'function') return api.objectKey(raw);
  const key = trim(raw && (raw.artwork_object_key || raw.cover_object_key || raw.object_key));
  return /^(audio|covers)\//.test(key) ? key : '';
}

function normalizeRelease(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = trim(raw.title);
  const id = trim(raw.id || raw.tonegrid_release_id);
  if (!title && !id) return null;
  const artistCheck = String(raw.artist_check || '').toLowerCase();
  const titleCheck = raw.title_check && typeof raw.title_check === 'object'
    ? {
      flagged: raw.title_check.flagged === true,
      flags: Array.isArray(raw.title_check.flags) ? raw.title_check.flags.map(trim).filter(Boolean) : [],
      block: false,
    }
    : { flagged: false, flags: [], block: false };
  const out = {
    id: id || newId(),
    title: title,
    plaiground_artist_id: trim(raw.plaiground_artist_id),
    title_check: titleCheck,
    artist_check: artistCheck === 'red' || artistCheck === 'yellow' || artistCheck === 'green' ? artistCheck : '',
    tonegrid_status: trim(raw.tonegrid_status || raw.status).toLowerCase(),
    rejection_reason: trim(raw.rejection_reason || raw.reason),
    tonegrid_release_id: trim(raw.tonegrid_release_id || (id && /^[0-9a-f-]{36}$/i.test(id) ? id : '')),
    artwork_url: storedArtworkUrl(raw),
    artwork_object_key: storedArtworkKey(raw),
    genre: trim(raw.genre),
    language: trim(raw.language),
  };
  if (Object.prototype.hasOwnProperty.call(raw, 'artist') || Object.prototype.hasOwnProperty.call(raw, 'name')) {
    out.artist = trim(raw.artist || raw.name);
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'lyrics')) out.lyrics = String(raw.lyrics == null ? '' : raw.lyrics);
  if (Object.prototype.hasOwnProperty.call(raw, 'release_date')) out.release_date = trim(raw.release_date);
  if (Array.isArray(raw.dsps)) out.dsps = raw.dsps.map(trim).filter(Boolean);
  if (Object.prototype.hasOwnProperty.call(raw, 'featured')) out.featured = trim(raw.featured);
  if (Object.prototype.hasOwnProperty.call(raw, 'price')) out.price = trim(raw.price);
  if (Object.prototype.hasOwnProperty.call(raw, 'select_preorder')) out.select_preorder = raw.select_preorder === true || raw.select_preorder === 'true';
  if (Object.prototype.hasOwnProperty.call(raw, 'preorder_date')) out.preorder_date = trim(raw.preorder_date);
  if (Object.prototype.hasOwnProperty.call(raw, 'define_time')) out.define_time = raw.define_time === true || raw.define_time === 'true';
  if (Object.prototype.hasOwnProperty.call(raw, 'release_time')) out.release_time = trim(raw.release_time);
  if (Object.prototype.hasOwnProperty.call(raw, 'release_timezone')) out.release_timezone = trim(raw.release_timezone);
  const creditKeys = [
    'label',
    'copyright_year',
    'copyright_holder',
    'copyright_owner',
    'rights_owner',
    'master_owner',
    'c_line',
    'p_line',
    'copyright_line',
  ];
  creditKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(raw, key) || raw[key] === undefined || raw[key] === null || raw[key] === '') {
      return;
    }
    out[key] = typeof raw[key] === 'number' ? raw[key] : trim(raw[key]);
  });
  if (Array.isArray(raw.writers) && raw.writers.length) out.writers = raw.writers;
  if (Object.prototype.hasOwnProperty.call(raw, 'legal_first')) out.legal_first = trim(raw.legal_first);
  if (Object.prototype.hasOwnProperty.call(raw, 'legal_last')) out.legal_last = trim(raw.legal_last);
  if (Object.prototype.hasOwnProperty.call(raw, 'solo_owned_100')) {
    out.solo_owned_100 = raw.solo_owned_100 === true || raw.solo_owned_100 === 'true';
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'signwell_status')) out.signwell_status = trim(raw.signwell_status);
  if (Object.prototype.hasOwnProperty.call(raw, 'signwell_signed')) {
    out.signwell_signed = raw.signwell_signed === true || raw.signwell_signed === 'true';
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'signwell_document_id') || Object.prototype.hasOwnProperty.call(raw, 'document_id')) {
    out.signwell_document_id = trim(raw.signwell_document_id || raw.document_id);
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'split_sheet_pdf') || Object.prototype.hasOwnProperty.call(raw, 'split_pdf')) {
    out.split_sheet_pdf = trim(raw.split_sheet_pdf || raw.split_pdf);
  }
  return out;
}

function readArtists(raw) {
  if (!raw || !Array.isArray(raw.artists)) return [];
  return raw.artists.map(normalizeArtist).filter(function (row) {
    return row && !isPlaceholderArtist(row.name);
  });
}

function readReleases(raw) {
  if (!raw || !Array.isArray(raw.releases)) return [];
  return raw.releases.map(normalizeRelease).filter(Boolean);
}

function readStored(row) {
  const raw = row && row.profile;
  if (!raw) return emptyProfile();
  if (typeof raw === 'string') {
    try {
      return readStored(Object.assign({}, row, { profile: JSON.parse(raw) }));
    } catch (err) {
      return emptyProfile();
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return emptyProfile();
  const photo = typeof raw.photo === 'string' && PHOTO_RE.test(raw.photo) ? raw.photo : '';
  const genres = uniquePicks(raw.genres, canonicalGenre, 'genre must be a listed genre.', MAX_GENRES);
  const specialties = uniquePicks(raw.specialties, canonicalSpecialty, 'specialty must be an attest tag.', catalog.HUMAN_TAGS.length);
  return {
    photo: photo,
    genres: genres.values || [],
    specialties: specialties.values || [],
    artists: readArtists(raw),
    releases: readReleases(raw),
    legal_name: trim(raw.legal_name || raw.legalName).slice(0, 120),
    country: trim(raw.country).slice(0, 80),
    username: normalizeUsername(raw.username).username || '',
  };
}

function hasOwn(obj, key) {
  return Boolean(obj && Object.prototype.hasOwnProperty.call(obj, key));
}

function validate(body, current) {
  const src = body && typeof body === 'object' ? (body.profile && typeof body.profile === 'object' ? body.profile : body) : {};
  const artist = trim(body && (body.artist || body.artist_name || src.artist || src.artist_name));
  const keep = current && typeof current === 'object' ? current : emptyProfile();
  const photo = hasOwn(src, 'photo') ? sanitizePhoto(src.photo) : { ok: true, photo: keep.photo || '' };
  if (photo.error) return { error: photo.error };
  const genres = hasOwn(src, 'genres')
    ? uniquePicks(src.genres, canonicalGenre, 'genre must be a listed genre.', MAX_GENRES)
    : { ok: true, values: keep.genres || [] };
  if (genres.error) {
    return { error: genres.error === 'Pick up to ' + MAX_GENRES + '.' ? 'Pick up to 5 genres.' : genres.error };
  }
  const specialties = hasOwn(src, 'specialties')
    ? uniquePicks(src.specialties, canonicalSpecialty, 'specialty must be an attest tag.', (catalog.HUMAN_TAGS || []).length)
    : { ok: true, values: keep.specialties || [] };
  if (specialties.error) return { error: specialties.error };
  const legalName = hasOwn(src, 'legal_name') || hasOwn(src, 'legalName')
    ? trim(src.legal_name || src.legalName).slice(0, 120)
    : (keep.legal_name || '');
  const country = hasOwn(src, 'country')
    ? trim(src.country).slice(0, 80)
    : (keep.country || '');
  const usernameSrc = hasOwn(body, 'username') || hasOwn(src, 'username')
    ? (hasOwn(body, 'username') ? body.username : src.username)
    : null;
  const username = usernameSrc != null
    ? normalizeUsername(usernameSrc)
    : { ok: true, username: keep.username || '' };
  if (username.error) return { error: username.error };
  return {
    ok: true,
    artist: artist,
    profile: {
      photo: photo.photo,
      genres: genres.values,
      specialties: specialties.values,
      artists: Array.isArray(src.artists) ? readArtists(src) : (keep.artists || []),
      releases: Array.isArray(src.releases) ? readReleases(src) : (keep.releases || []),
      legal_name: legalName,
      country: country,
      username: username.username,
    },
  };
}

function findArtist(profile, id) {
  const list = profile && Array.isArray(profile.artists) ? profile.artists : [];
  const want = trim(id);
  if (!want) return null;
  for (let i = 0; i < list.length; i += 1) {
    if (String(list[i].id) === want || String(list[i].artist_id) === want) return list[i];
  }
  return null;
}

function resolveArtist(profile, id, name) {
  const found = findArtist(profile, id);
  if (found) return found;
  const list = profile && Array.isArray(profile.artists) ? profile.artists : [];
  const want = trim(id);
  if (want) {
    for (let i = 0; i < list.length; i += 1) {
      if (String(list[i].tonegrid_artist_id || '') === want) return list[i];
    }
  }
  const wantName = artistKey(name);
  if (wantName) {
    const matches = list.filter((row) => row && artistKey(row.name) === wantName);
    if (matches.length === 1) return matches[0];
  }
  if (list.length === 1 && (!want || want === 'account')) return list[0];
  return null;
}

function upsertArtist(profile, artist) {
  const next = Object.assign(emptyProfile(), profile || {});
  const row = normalizeArtist(artist);
  if (!row) return next;
  const list = Array.isArray(next.artists) ? next.artists.slice() : [];
  const idx = list.findIndex((item) => item.id === row.id);
  if (idx >= 0) list[idx] = Object.assign({}, list[idx], row);
  else list.push(row);
  next.artists = list;
  return next;
}

function removeArtist(profile, id) {
  const next = Object.assign(emptyProfile(), profile || {});
  const want = trim(id);
  next.artists = (Array.isArray(next.artists) ? next.artists : []).filter(function (row) {
    return row && String(row.id) !== want && String(row.artist_id) !== want;
  });
  return next;
}

function releaseBelongsToArtist(release, artist, onlyArtist) {
  if (!release || !artist) return false;
  const owner = trim(release.plaiground_artist_id);
  if (owner && (owner === artist.id || owner === artist.artist_id)) return true;
  return onlyArtist === true;
}

function artistHasBlockingRelease(profile, artist) {
  const releases = profile && Array.isArray(profile.releases) ? profile.releases : [];
  const artists = profile && Array.isArray(profile.artists) ? profile.artists : [];
  const onlyArtist = artists.length === 1 && artists[0] && (artists[0].id === artist.id || artists[0].artist_id === artist.id);
  for (let i = 0; i < releases.length; i += 1) {
    const row = releases[i];
    const status = trim(row && (row.tonegrid_status || row.status)).toLowerCase();
    if (!BLOCKING_RELEASE_STATUSES.has(status)) continue;
    if (releaseBelongsToArtist(row, artist, onlyArtist)) return row;
  }
  return null;
}

function upsertRelease(profile, release) {
  const next = Object.assign(emptyProfile(), profile || {});
  const row = normalizeRelease(release);
  if (!row) return next;
  const list = Array.isArray(next.releases) ? next.releases.slice() : [];
  const idx = list.findIndex((item) => {
    if (item.id && row.id && item.id === row.id) return true;
    if (item.tonegrid_release_id && row.tonegrid_release_id && item.tonegrid_release_id === row.tonegrid_release_id) return true;
    return false;
  });
  if (idx >= 0) {
    const prev = list[idx] || {};
    const merged = Object.assign({}, prev, row);
    if (!row.title && prev.title) merged.title = prev.title;
    if (!row.artwork_url && prev.artwork_url) merged.artwork_url = prev.artwork_url;
    if (!row.artwork_object_key && prev.artwork_object_key) merged.artwork_object_key = prev.artwork_object_key;
    if (!row.genre && prev.genre) merged.genre = prev.genre;
    if (!row.language && prev.language) merged.language = prev.language;
    if (!row.artist && prev.artist) merged.artist = prev.artist;
    if (!row.release_date && prev.release_date) merged.release_date = prev.release_date;
    if (!Array.isArray(row.dsps) && Array.isArray(prev.dsps)) merged.dsps = prev.dsps;
    if (row.lyrics === undefined && prev.lyrics !== undefined) merged.lyrics = prev.lyrics;
    if (!row.featured && prev.featured) merged.featured = prev.featured;
    if (!row.price && prev.price) merged.price = prev.price;
    [
      'label',
      'copyright_year',
      'copyright_holder',
      'copyright_owner',
      'rights_owner',
      'master_owner',
      'c_line',
      'p_line',
      'copyright_line',
    ].forEach((key) => {
      if (!row[key] && prev[key]) merged[key] = prev[key];
    });
    if ((!Array.isArray(row.writers) || !row.writers.length) && Array.isArray(prev.writers) && prev.writers.length) {
      merged.writers = prev.writers;
    }
    ['legal_first', 'legal_last', 'signwell_status', 'signwell_document_id', 'split_sheet_pdf'].forEach((key) => {
      if (!row[key] && prev[key]) merged[key] = prev[key];
    });
    if (row.solo_owned_100 == null && prev.solo_owned_100 != null) merged.solo_owned_100 = prev.solo_owned_100;
    if (row.signwell_signed == null && prev.signwell_signed != null) merged.signwell_signed = prev.signwell_signed;
    list[idx] = merged;
  } else list.push(row);
  next.releases = list;
  return lockArtistsFromReleases(next);
}

function lockArtistsFromReleases(profile) {
  const next = Object.assign(emptyProfile(), profile || {});
  const releases = Array.isArray(next.releases) ? next.releases : [];
  const live = {};
  releases.forEach((row) => {
    if (row.plaiground_artist_id && LIVE_STATUSES.has(row.tonegrid_status)) {
      live[row.plaiground_artist_id] = true;
    }
  });
  next.artists = (Array.isArray(next.artists) ? next.artists : []).map((artist) => {
    if (!live[artist.id]) return artist;
    return Object.assign({}, artist, { locked: true });
  });
  return next;
}

function removeRelease(profile, releaseId) {
  const id = trim(releaseId).toLowerCase();
  const next = Object.assign(emptyProfile(), profile || {});
  next.releases = (Array.isArray(next.releases) ? next.releases : []).filter((row) => {
    const have = String((row && (row.tonegrid_release_id || row.id)) || '').trim().toLowerCase();
    return !id || have !== id;
  });
  return lockArtistsFromReleases(next);
}

function applyReleaseStatus(profile, releaseId, status, reason) {
  const id = trim(releaseId);
  const next = Object.assign(emptyProfile(), profile || {});
  const list = Array.isArray(next.releases) ? next.releases.slice() : [];
  let found = false;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].id === id || list[i].tonegrid_release_id === id) {
      list[i] = Object.assign({}, list[i], {
        tonegrid_status: trim(status).toLowerCase(),
        rejection_reason: reason !== undefined ? trim(reason) : list[i].rejection_reason,
      });
      found = true;
    }
  }
  if (!found && id) {
    list.push(normalizeRelease({
      id: id,
      tonegrid_release_id: id,
      tonegrid_status: status,
      rejection_reason: reason,
    }));
  }
  next.releases = list.filter(Boolean);
  return lockArtistsFromReleases(next);
}

function seedFromAccount(profile, artistName, tonegridArtistId) {
  const next = Object.assign(emptyProfile(), profile || {});
  const name = displayArtistName(artistName);
  if (!name || (Array.isArray(next.artists) && next.artists.length)) return next;
  next.artists = [normalizeArtist({
    id: 'account',
    name: name,
    source: 'created',
    badge: 'PLAIGROUND',
    tonegrid_artist_id: trim(tonegridArtistId),
    name_check: 'green',
  })];
  return next;
}

function releaseArtistName(release) {
  if (!release || typeof release !== 'object') return '';
  return displayArtistName(release.artist || release.artist_name || release.name);
}

function recoverRoster(profile, artistName, tonegridArtistId) {
  const next = seedFromAccount(profile, artistName, tonegridArtistId);
  if (Array.isArray(next.artists) && next.artists.length) return next;
  const seen = new Set();
  const recovered = [];
  function push(raw) {
    const row = normalizeArtist(raw);
    if (!row || isPlaceholderArtist(row.name)) return;
    const key = artistKey(row.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    recovered.push(row);
  }
  (Array.isArray(next.releases) ? next.releases : []).forEach((release) => {
    const name = releaseArtistName(release);
    const id = trim(release && (release.plaiground_artist_id || release.artist_id));
    if (!name) return;
    push({
      id: id || undefined,
      name: name,
      source: 'created',
      badge: 'PLAIGROUND',
      tonegrid_artist_id: trim((release && release.tonegrid_artist_id) || tonegridArtistId),
      name_check: 'green',
    });
  });
  if (recovered.length) next.artists = recovered;
  return next;
}

function keepArtistsIfDropped(nextProfile, previousProfile) {
  const next = Object.assign(emptyProfile(), nextProfile || {});
  if (Array.isArray(next.artists) && next.artists.length) return next;
  const previous = previousProfile && Array.isArray(previousProfile.artists)
    ? previousProfile.artists.filter(Boolean)
    : [];
  if (previous.length) next.artists = previous;
  return next;
}

module.exports = {
  AI_CONTRIBUTIONS: AI_CONTRIBUTIONS,
  HUMAN_CONTRIBUTIONS: HUMAN_CONTRIBUTIONS,
  HUMAN_TAGS: catalog.HUMAN_TAGS,
  MAX_AI_DETAIL: MAX_AI_DETAIL,
  MAX_GENRES: MAX_GENRES,
  MAX_PHOTO_CHARS: MAX_PHOTO_CHARS,
  PHOTO_RE: PHOTO_RE,
  sanitizePhoto: sanitizePhoto,
  applyReleaseStatus: applyReleaseStatus,
  artistHasBlockingRelease: artistHasBlockingRelease,
  displayArtist: displayArtist,
  displayArtistName: displayArtistName,
  emptyProfile: emptyProfile,
  findArtist: findArtist,
  recoverRoster: recoverRoster,
  keepArtistsIfDropped: keepArtistsIfDropped,
  resolveArtist: resolveArtist,
  isAccepted: isAccepted,
  isPlaceholderArtist: isPlaceholderArtist,
  lockArtistsFromReleases: lockArtistsFromReleases,
  newId: newId,
  normalizeArtist: normalizeArtist,
  normalizeRelease: normalizeRelease,
  normalizeUsername: normalizeUsername,
  readStored: readStored,
  removeArtist: removeArtist,
  removeRelease: removeRelease,
  seedFromAccount: seedFromAccount,
  upsertArtist: upsertArtist,
  upsertRelease: upsertRelease,
  validate: validate,
};
