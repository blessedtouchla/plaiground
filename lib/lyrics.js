'use strict';

/**
 * Saved Song Helper lyrics. Each save appends a row.
 * Users only read and write their own songs.
 */

const db = require('./db');

const TEXT_MAX = 12000;
const TITLE_MAX = 80;
const HISTORY_LIMIT = 30;

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
  return {
    title: clip(input.title, TITLE_MAX),
    text: text,
    mode: clip(input.mode, 40),
    mood: clip(input.mood, 40),
    sparkTitle: clip(input.sparkTitle, 80),
    sparkAngle: clip(input.sparkAngle, 280),
  };
}

function sameSong(a, b) {
  if (!a || !b) return false;
  return a.title === b.title && a.text === b.text && a.mode === b.mode && a.mood === b.mood;
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

async function saveOwn(userId, input) {
  const song = sanitizeSong(input);
  await ready();
  const existing = await listRows(userId);
  if (existing[0] && sameSong(existing[0].song, song)) {
    return {
      ok: true,
      created: false,
      song: publicSong(existing[0]),
      songs: existing.map(publicSong).filter(Boolean),
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

module.exports = {
  HISTORY_LIMIT: HISTORY_LIMIT,
  TEXT_MAX: TEXT_MAX,
  listOwn: listOwn,
  resetStore: resetStore,
  sanitizeSong: sanitizeSong,
  saveOwn: saveOwn,
};
