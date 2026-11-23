'use strict';

/**
 * Saved Song Helper lyrics. Each save appends a row.
 * Users only read and write their own songs.
 */

const db = require('./db');

const TEXT_MAX = 12000;
const TITLE_MAX = 80;
const HISTORY_LIMIT = 30;
const CLAIM_MAX = 48000;

let songs = [];

function resetStore() {
  songs = [];
}

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch (err) {
    return false;
  }
}

function asJson(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  }
  return null;
}

function isoDate(value) {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function clip(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function clipBlock(value, max) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').trim().slice(0, max);
}

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  return err;
}

function tooLargeError(message) {
  const err = new Error(message);
  err.code = 'TOO_LARGE';
  return err;
}

function sanitizeSong(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('A song is required.');
  }
  const text = clipBlock(input.text, TEXT_MAX + 1);
  if (!text) throw validationError('Write a song before you save it.');
  if (text.length > TEXT_MAX) throw tooLargeError('That song is too long to save.');
  const song = {
    title: clip(input.title, TITLE_MAX),
    text: text,
    mode: clip(input.mode, 40),
    mood: clip(input.mood, 40),
    sparkTitle: clip(input.sparkTitle, 80),
    sparkAngle: clip(input.sparkAngle, 280),
    style: clipBlock(input.style, 800),
    label: authorshipLabel(input.label),
  };
  const notebook = sanitizeNotebook(input.notebook);
  if (notebook) song.notebook = notebook;
  if (input.claim) song.claim = sanitizeClaim(input.claim);
  return song;
}

function clipList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(function (item) { return clip(item, 180); }).filter(Boolean).slice(0, 8);
}

function sanitizeNotebook(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const secs = (Array.isArray(input.secs) ? input.secs : []).slice(0, 12).map(function (sec) {
    const lines = (Array.isArray(sec && sec.lines) ? sec.lines : []).slice(0, 24).map(function (line) {
      return { text: clipBlock(line && line.text, 400) };
    }).filter(function (line) { return line.text; });
    return {
      tag: clip(sec && sec.tag, 40),
      target: Math.max(0, Math.min(32, Number(sec && sec.target) || 0)),
      lines: lines,
    };
  }).filter(function (sec) { return sec.tag && sec.lines.length; });
  const book = {
    genre: clip(input.genre, 40),
    era: clip(input.era, 20),
    region: clip(input.region, 40),
    language: clip(input.language, 40),
    topic: clip(input.topic, 80),
    stamp: clip(input.stamp, 40),
    vibe: clipList(input.vibe),
    beat: clipList(input.beat),
    secs: secs,
  };
  if (!book.secs.length && !book.genre && !book.stamp) return null;
  if (JSON.stringify(book).length > 20000) throw tooLargeError('That song is too long to save.');
  return book;
}

function sanitizeClaim(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('A record is required.');
  }
  let claim;
  try {
    claim = JSON.parse(JSON.stringify(input));
  } catch (err) {
    throw validationError('A record is required.');
  }
  delete claim.percent;
  delete claim.score;
  delete claim.yours;
  delete claim.humanPercent;
  if (!clip(claim.id, 40)) throw validationError('A record id is required.');
  claim.id = clip(claim.id, 40);
  const packed = JSON.stringify(claim);
  if (packed.length > CLAIM_MAX) throw tooLargeError('That record is too long to save.');
  return claim;
}

function authorshipLabel(value) {
  const text = clip(value, 40);
  if (text === 'Full AI') return 'Fully AI';
  if (text === 'Human' || text === 'AI-assisted' || text === 'Fully AI') return text;
  return '';
}

function sameSong(a, b) {
  if (!a || !b) return false;
  const lyricsMatch = a.title === b.title && a.text === b.text && a.mode === b.mode && a.mood === b.mood;
  if (!lyricsMatch) return false;
  const aId = a.claim && a.claim.id;
  const bId = b.claim && b.claim.id;
  if (aId || bId) return aId === bId;
  return true;
}

function copyRow(row) {
  const song = asJson(row && row.song);
  return {
    id: String((row && row.id) || ''),
    user_id: String((row && row.user_id) || ''),
    song: song,
    created_at: isoDate(row && row.created_at),
    updated_at: isoDate(row && (row.updated_at || row.created_at)),
  };
}

function publicSong(row) {
  if (!row || !row.song) return null;
  return {
    id: row.id,
    saved_at: row.created_at,
    title: row.song.title || '',
    text: row.song.text || '',
    mode: row.song.mode || '',
    mood: row.song.mood || '',
    sparkTitle: row.song.sparkTitle || '',
    sparkAngle: row.song.sparkAngle || '',
    style: row.song.style || '',
    label: row.song.label || '',
    claim: row.song.claim || null,
    notebook: row.song.notebook || null,
  };
}

async function ready() {
  if (usingAccountsMemory()) return;
  const accounts = require('./accounts');
  await accounts.ensureReady();
}

async function listRows(userId) {
  await ready();
  const want = String(userId || '');
  if (usingAccountsMemory()) {
    return songs
      .filter((row) => String(row.user_id) === want)
      .map(copyRow)
      .filter((row) => row.song)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, HISTORY_LIMIT);
  }
  const rows = await db.query(
    'SELECT id, user_id, song, created_at, updated_at FROM saved_lyrics WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [want, HISTORY_LIMIT]
  );
  return rows.map(copyRow).filter((row) => row.song);
}

async function listOwn(userId) {
  const rows = await listRows(userId);
  return { ok: true, songs: rows.map(publicSong).filter(Boolean) };
}

function mergeSaved(existing, incoming) {
  const next = Object.assign({}, existing);
  let changed = false;
  if (incoming.style && incoming.style !== existing.style) { next.style = incoming.style; changed = true; }
  if (incoming.label && incoming.label !== existing.label) { next.label = incoming.label; changed = true; }
  return changed ? next : null;
}

async function updateSong(userId, id, song) {
  const want = String(userId || '');
  const sid = String(id || '');
  if (usingAccountsMemory()) {
    const row = songs.find((r) => String(r.id) === sid && String(r.user_id) === want);
    if (!row) return;
    row.song = JSON.parse(JSON.stringify(song));
    row.updated_at = new Date().toISOString();
    return;
  }
  await db.query(
    'UPDATE saved_lyrics SET song = $3::jsonb, updated_at = now() WHERE id::text = $1 AND user_id = $2',
    [sid, want, JSON.stringify(song)]
  );
}

async function saveOwn(userId, input) {
  const song = sanitizeSong(input);
  await ready();
  const existing = await listRows(userId);
  const dup = existing.find((row) => sameSong(row.song, song));
  if (dup) {
    const merged = mergeSaved(dup.song, song);
    if (merged) await updateSong(userId, dup.id, merged);
    const rows = await listRows(userId);
    const kept = rows.find((row) => String(row.id) === String(dup.id)) || rows[0];
    return {
      ok: true,
      created: false,
      song: publicSong(kept),
      songs: rows.map(publicSong).filter(Boolean),
    };
  }
  const now = new Date().toISOString();
  if (usingAccountsMemory()) {
    songs.push({
      id: require('crypto').randomUUID(),
      user_id: String(userId),
      song: JSON.parse(JSON.stringify(song)),
      created_at: now,
      updated_at: now,
    });
    if (songs.length > HISTORY_LIMIT * 4) songs = songs.slice(-HISTORY_LIMIT * 4);
  } else {
    await db.query(
      'INSERT INTO saved_lyrics (user_id, song) VALUES ($1, $2::jsonb)',
      [String(userId), JSON.stringify(song)]
    );
  }
  const rows = await listRows(userId);
  return {
    ok: true,
    created: true,
    song: rows[0] ? publicSong(rows[0]) : null,
    songs: rows.map(publicSong).filter(Boolean),
  };
}

async function updateOwn(userId, id, input) {
  const song = sanitizeSong(input);
  const want = String(userId || '');
  const sid = String(id || '').slice(0, 64);
  if (!sid) throw validationError('Pick a song first.');
  await ready();
  const rows = await listRows(want);
  const row = rows.find(function (item) { return String(item.id) === sid; });
  if (!row) throw validationError('That song is not on this account.');
  await updateSong(want, sid, song);
  const next = await listRows(want);
  const kept = next.find(function (item) { return String(item.id) === sid; }) || next[0];
  return {
    ok: true,
    created: false,
    song: publicSong(kept),
    songs: next.map(publicSong).filter(Boolean),
  };
}

async function renameOwn(userId, id, title) {
  const want = String(userId || '');
  const sid = String(id || '').slice(0, 64);
  const name = clip(title, TITLE_MAX);
  if (!sid) throw validationError('Pick a song first.');
  if (!name) throw validationError('Give the song a title.');
  await ready();
  if (usingAccountsMemory()) {
    const row = songs.find((r) => String(r.id) === sid && String(r.user_id) === want);
    if (!row) throw validationError('That song is not on this account.');
    row.song = Object.assign({}, row.song, { title: name });
    row.updated_at = new Date().toISOString();
  } else {
    const rows = await db.query(
      "UPDATE saved_lyrics SET song = jsonb_set(song, '{title}', to_jsonb($3::text)), updated_at = now() WHERE id::text = $1 AND user_id = $2 RETURNING id",
      [sid, want, name]
    );
    if (!rows.length) throw validationError('That song is not on this account.');
  }
  return listOwn(userId);
}

async function deleteOwn(userId, id) {
  const want = String(userId || '');
  const sid = String(id || '').slice(0, 64);
  if (!sid) throw validationError('Pick a song first.');
  await ready();
  if (usingAccountsMemory()) {
    const before = songs.length;
    songs = songs.filter((r) => !(String(r.id) === sid && String(r.user_id) === want));
    if (songs.length === before) throw validationError('That song is not on this account.');
  } else {
    const rows = await db.query('DELETE FROM saved_lyrics WHERE id::text = $1 AND user_id = $2 RETURNING id', [sid, want]);
    if (!rows.length) throw validationError('That song is not on this account.');
  }
  return listOwn(userId);
}

module.exports = {
  deleteOwn: deleteOwn,
  renameOwn: renameOwn,
  HISTORY_LIMIT: HISTORY_LIMIT,
  TEXT_MAX: TEXT_MAX,
  listOwn: listOwn,
  resetStore: resetStore,
  sanitizeSong: sanitizeSong,
  saveOwn: saveOwn,
  updateOwn: updateOwn,
};
