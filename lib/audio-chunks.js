'use strict';

/**
 * Ephemeral audio-chunk staging so a normal song can cross the Vercel
 * ~4.5 MB function hop as several small POSTs. Assembled bytes then
 * convert (MP3 → WAV) and hop once to the store.
 *
 * Memory first (same warm instance). Neon when DATABASE_URL is a real
 * Postgres URL — not a second object store, not a new function.
 */

const db = require('./db');

const TTL_MS = 60 * 60 * 1000;
const memory = new Map();

function canUseNeon() {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (!url) return false;
  if (/postgres:\/\/memory/i.test(url)) return false;
  return true;
}

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }
  if (typeof value === 'string') {
    try {
      return Buffer.from(value, 'base64');
    } catch {
      return Buffer.alloc(0);
    }
  }
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.alloc(0);
}

function sessionKey(uploadId) {
  return String(uploadId || '').trim();
}

function pruneMemory(now) {
  const cutoff = (now || Date.now()) - TTL_MS;
  memory.forEach((session, key) => {
    if (!session || Number(session.createdAt) < cutoff) memory.delete(key);
  });
}

function resetForTests() {
  memory.clear();
}

function parseChunkMeta(headerValue, req) {
  const uploadId = headerValue(req, 'x-plaiground-upload-id');
  const index = Number(headerValue(req, 'x-plaiground-chunk-index'));
  const count = Number(headerValue(req, 'x-plaiground-chunk-count'));
  const filename = headerValue(req, 'x-plaiground-filename');
  const mime = headerValue(req, 'x-plaiground-mime');
  const totalBytes = Number(headerValue(req, 'x-plaiground-total-bytes'));
  if (!uploadId) return null;
  if (!Number.isInteger(index) || !Number.isInteger(count)) return null;
  if (count < 2 || index < 0 || index >= count) return null;
  return {
    uploadId,
    index,
    count,
    filename: filename || '',
    mime: mime || '',
    totalBytes: totalBytes > 0 && isFinite(totalBytes) ? totalBytes : 0,
  };
}

function readMemory(uploadId) {
  pruneMemory();
  return memory.get(sessionKey(uploadId)) || null;
}

function writeMemory(session) {
  memory.set(sessionKey(session.uploadId), session);
}

async function ensureTable() {
  if (!canUseNeon()) return;
  await db.query(
    'CREATE TABLE IF NOT EXISTS audio_upload_chunks ('
    + 'upload_id text NOT NULL, '
    + 'user_id text NOT NULL, '
    + 'track_id text NOT NULL, '
    + 'chunk_index integer NOT NULL, '
    + 'chunk_count integer NOT NULL, '
    + 'filename text NOT NULL DEFAULT \'\', '
    + 'mime text NOT NULL DEFAULT \'\', '
    + 'payload text NOT NULL, '
    + 'created_at timestamptz NOT NULL DEFAULT now(), '
    + 'PRIMARY KEY (upload_id, chunk_index)'
    + ')'
  );
}

async function persistNeon(session, index, data) {
  if (!canUseNeon()) return;
  try {
    await ensureTable();
    await db.query(
      'DELETE FROM audio_upload_chunks WHERE created_at < now() - interval \'1 hour\''
    );
    await db.query(
      'INSERT INTO audio_upload_chunks '
      + '(upload_id, user_id, track_id, chunk_index, chunk_count, filename, mime, payload) '
      + 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8) '
      + 'ON CONFLICT (upload_id, chunk_index) DO UPDATE SET payload = EXCLUDED.payload, created_at = now()',
      [
        session.uploadId,
        session.userId,
        session.trackId,
        index,
        session.count,
        session.filename || '',
        session.mime || '',
        data.toString('base64'),
      ]
    );
  } catch {
    /* same-instance memory still holds the chunk */
  }
}

async function loadNeon(userId, trackId, uploadId) {
  if (!canUseNeon()) return null;
  try {
    await ensureTable();
    const rows = await db.query(
      'SELECT chunk_index, chunk_count, filename, mime, payload '
      + 'FROM audio_upload_chunks WHERE upload_id = $1 AND user_id = $2 AND track_id = $3 '
      + 'ORDER BY chunk_index ASC',
      [uploadId, userId, trackId]
    );
    if (!rows || !rows.length) return null;
    const chunks = new Map();
    rows.forEach((row) => {
      chunks.set(Number(row.chunk_index), asBuffer(row.payload));
    });
    return {
      uploadId,
      userId,
      trackId,
      count: Number(rows[0].chunk_count) || rows.length,
      filename: rows[0].filename || '',
      mime: rows[0].mime || '',
      createdAt: Date.now(),
      chunks,
    };
  } catch {
    return null;
  }
}

async function dropNeon(uploadId) {
  if (!canUseNeon()) return;
  try {
    await db.query('DELETE FROM audio_upload_chunks WHERE upload_id = $1', [uploadId]);
  } catch {
    /* ignore */
  }
}

async function saveChunk({ userId, trackId, meta, data }) {
  const buf = asBuffer(data);
  if (!buf.length) {
    const err = new Error('empty');
    err.code = 'EMPTY_CHUNK';
    throw err;
  }
  let session = readMemory(meta.uploadId);
  if (!session) {
    session = {
      uploadId: meta.uploadId,
      userId: String(userId || ''),
      trackId: String(trackId || ''),
      count: meta.count,
      filename: meta.filename || '',
      mime: meta.mime || '',
      createdAt: Date.now(),
      chunks: new Map(),
    };
  }
  if (session.userId && userId && session.userId !== String(userId)) {
    const err = new Error('mismatch');
    err.code = 'CHUNK_MISMATCH';
    throw err;
  }
  if (session.trackId && trackId && session.trackId !== String(trackId)) {
    const err = new Error('mismatch');
    err.code = 'CHUNK_MISMATCH';
    throw err;
  }
  if (session.count !== meta.count) {
    const err = new Error('mismatch');
    err.code = 'CHUNK_MISMATCH';
    throw err;
  }
  session.userId = String(userId || session.userId || '');
  session.trackId = String(trackId || session.trackId || '');
  if (meta.filename) session.filename = meta.filename;
  if (meta.mime) session.mime = meta.mime;
  session.chunks.set(meta.index, buf);
  writeMemory(session);
  await persistNeon(session, meta.index, buf);
  return session;
}

function completeFromSession(session) {
  if (!session || !session.chunks) return null;
  const parts = [];
  let i;
  for (i = 0; i < session.count; i += 1) {
    const next = session.chunks.get(i);
    if (!next || !next.length) return null;
    parts.push(next);
  }
  return {
    filename: session.filename || '',
    mime: session.mime || '',
    data: Buffer.concat(parts),
  };
}

async function assemble({ userId, trackId, uploadId }) {
  let session = readMemory(uploadId);
  let assembled = completeFromSession(session);
  if (assembled) return assembled;
  session = await loadNeon(userId, trackId, uploadId);
  assembled = completeFromSession(session);
  if (assembled) {
    if (session) writeMemory(session);
    return assembled;
  }
  return null;
}

async function drop(uploadId) {
  memory.delete(sessionKey(uploadId));
  await dropNeon(uploadId);
}

module.exports = {
  TTL_MS,
  assemble,
  drop,
  parseChunkMeta,
  resetForTests,
  saveChunk,
};
