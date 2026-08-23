'use strict';

/**
 * Public artist profile stored on the PLAIGROUND user record.
 * Genres must be ToneGrid catalog picks. Specialties reuse attest tags.
 */

const catalog = require('../upload-catalog');

const MAX_PHOTO_CHARS = 180000;
const MAX_GENRES = 5;
const PHOTO_RE = /^data:image\/(jpeg|jpg|png);base64,/i;

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function emptyProfile() {
  return { photo: '', genres: [], specialties: [] };
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

function sanitizePhoto(value) {
  const raw = trim(value);
  if (!raw) return { ok: true, photo: '' };
  if (!PHOTO_RE.test(raw)) return { error: 'Photo must be a JPG or PNG.' };
  if (raw.length > MAX_PHOTO_CHARS) return { error: 'Photo is too large.' };
  return { ok: true, photo: raw };
}

function readStored(row) {
  const raw = row && row.profile;
  if (!raw) return emptyProfile();
  if (typeof raw === 'string') {
    try {
      return readStored({ profile: JSON.parse(raw) });
    } catch (err) {
      return emptyProfile();
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return emptyProfile();
  const photo = typeof raw.photo === 'string' && PHOTO_RE.test(raw.photo) ? raw.photo : '';
  const genres = uniquePicks(raw.genres, canonicalGenre, 'genre must be a ToneGrid genre.', MAX_GENRES);
  const specialties = uniquePicks(raw.specialties, canonicalSpecialty, 'specialty must be an attest tag.', catalog.HUMAN_TAGS.length);
  return {
    photo: photo,
    genres: genres.values || [],
    specialties: specialties.values || [],
  };
}

function validate(body) {
  const src = body && typeof body === 'object' ? (body.profile && typeof body.profile === 'object' ? body.profile : body) : {};
  const artist = trim(body && (body.artist || body.artist_name || src.artist || src.artist_name));
  const photo = sanitizePhoto(src.photo);
  if (photo.error) return { error: photo.error };
  const genres = uniquePicks(src.genres, canonicalGenre, 'genre must be a ToneGrid genre.', MAX_GENRES);
  if (genres.error) {
    return { error: genres.error === 'Pick up to ' + MAX_GENRES + '.' ? 'Pick up to 5 genres.' : genres.error };
  }
  const specialties = uniquePicks(src.specialties, canonicalSpecialty, 'specialty must be an attest tag.', (catalog.HUMAN_TAGS || []).length);
  if (specialties.error) return { error: specialties.error };
  return {
    ok: true,
    artist: artist,
    profile: {
      photo: photo.photo,
      genres: genres.values,
      specialties: specialties.values,
    },
  };
}

module.exports = {
  HUMAN_TAGS: catalog.HUMAN_TAGS,
  MAX_GENRES: MAX_GENRES,
  emptyProfile: emptyProfile,
  readStored: readStored,
  validate: validate,
};
