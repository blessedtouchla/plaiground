'use strict';

/**
 * Per-IP caps for public Song Lab model calls.
 *
 * Neon (song_rate_hits) when DATABASE_URL is a real Postgres URL, so the
 * count is shared across serverless instances. Otherwise an in-memory
 * window on this instance. A database error falls back to memory and still
 * counts the hit. It does not fail open.
 *
 * The key is an HMAC of the IP. The raw address is not stored.
 * Windows are fixed buckets from the unix epoch, not a sliding window.
 *
 * Heavy calls are model writes (a full song, a line, a battle round, a flip).
 * One assisted song is about eight line calls plus one write. 24 an hour
 * is two of those, plus a few retries. 80 a day is about six assisted songs
 * from one address: a household or a small meetup, not an open scraper.
 * Turnstile is unchanged. It stays off unless the owner sets both Turnstile
 * keys and XAI_API_KEY (see lib/song-guard.js).
 */

const crypto = require('crypto');
const db = require('./db');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HEAVY_PER_HOUR = 24;
const HEAVY_PER_DAY = 80;
const LIGHT_PER_HOUR = 120;

const memory = new Map();
let tableReady = null;
let modeOverride = null;

function hashIp(ip) {
  const salt = String(process.env.SESSION_SECRET || 'plaiground-song-rate').trim() || 'plaiground-song-rate';
  return crypto.createHmac('sha256', salt).update('song-ip:' + String(ip || 'unknown')).digest('hex').slice(0, 32);
}

function canUseNeon() {
  if (modeOverride === 'memory') return false;
  const url = String(process.env.DATABASE_URL || '').trim();
  if (!url) return false;
  if (/postgres:\/\/memory/i.test(url)) return false;
  return true;
}

function limitsFor(kind) {
  if (kind === 'light') {
    return [{ scope: 'hour', windowMs: HOUR_MS, max: LIGHT_PER_HOUR }];
  }
  return [
    { scope: 'hour', windowMs: HOUR_MS, max: HEAVY_PER_HOUR },
    { scope: 'day', windowMs: DAY_MS, max: HEAVY_PER_DAY },
  ];
}

function bucket(now, windowMs) {
  return Math.floor(now / windowMs);
}

function memoryKey(ipKey, kind, windowMs, slot) {
  return [ipKey, kind, windowMs, slot].join(':');
}

function memoryTake(ipKey, kind, limits, now) {
  for (let i = 0; i < limits.length; i += 1) {
    const lim = limits[i];
    const slot = bucket(now, lim.windowMs);
    const key = memoryKey(ipKey, kind, lim.windowMs, slot);
    const hits = (memory.get(key) || 0) + 1;
    memory.set(key, hits);
    if (hits > lim.max) {
      return { ok: false, store: 'memory', kind: kind, scope: lim.scope, limit: lim.max, hits: hits };
    }
  }
  return { ok: true, store: 'memory', kind: kind };
}

function ensureTable() {
  if (tableReady) return tableReady;
  tableReady = db.query(
    'CREATE TABLE IF NOT EXISTS song_rate_hits ('
    + 'ip_key text NOT NULL, '
    + 'kind text NOT NULL, '
    + 'window_ms integer NOT NULL, '
    + 'bucket bigint NOT NULL, '
    + 'hits integer NOT NULL DEFAULT 0, '
    + 'updated_at timestamptz NOT NULL DEFAULT now(), '
    + 'PRIMARY KEY (ip_key, kind, window_ms, bucket))'
  ).catch(function (err) {
    tableReady = null;
    throw err;
  });
  return tableReady;
}

async function neonTake(ipKey, kind, limits, now) {
  await ensureTable();
  let last = { ok: true, store: 'neon', kind: kind };
  for (let i = 0; i < limits.length; i += 1) {
    const lim = limits[i];
    const slot = bucket(now, lim.windowMs);
    const rows = await db.query(
      'INSERT INTO song_rate_hits (ip_key, kind, window_ms, bucket, hits) VALUES ($1, $2, $3, $4, 1) '
      + 'ON CONFLICT (ip_key, kind, window_ms, bucket) DO UPDATE SET hits = song_rate_hits.hits + 1, updated_at = now() '
      + 'RETURNING hits',
      [ipKey, kind, lim.windowMs, slot]
    );
    const hits = Number(rows[0] && rows[0].hits) || 0;
    if (hits > lim.max) {
      last = { ok: false, store: 'neon', kind: kind, scope: lim.scope, limit: lim.max, hits: hits };
      break;
    }
  }
  if (Math.random() < 0.02) {
    db.query("DELETE FROM song_rate_hits WHERE updated_at < now() - interval '3 days'").catch(function () {});
  }
  return last;
}

async function take(ip, kind, now) {
  const t = typeof now === 'number' ? now : Date.now();
  const useKind = kind === 'light' ? 'light' : 'heavy';
  const limits = limitsFor(useKind);
  const key = hashIp(ip);
  if (!canUseNeon()) return memoryTake(key, useKind, limits, t);
  try {
    return await neonTake(key, useKind, limits, t);
  } catch (err) {
    return memoryTake(key, useKind, limits, t);
  }
}

function limitMessage(result) {
  if (result && result.kind === 'light') {
    return 'Slow down a little. Try again in a few minutes.';
  }
  if (result && result.scope === 'day') {
    return 'That is the daily limit of ' + HEAVY_PER_DAY + ' AI writes from this connection. Try again tomorrow.';
  }
  return 'You hit the hourly limit of ' + HEAVY_PER_HOUR + ' AI writes from this connection. Take a breather and come back soon.';
}

function useMemory() {
  modeOverride = 'memory';
  memory.clear();
  tableReady = null;
}

function resetForTests() {
  memory.clear();
  tableReady = null;
  modeOverride = null;
}

module.exports = {
  HEAVY_PER_HOUR: HEAVY_PER_HOUR,
  HEAVY_PER_DAY: HEAVY_PER_DAY,
  LIGHT_PER_HOUR: LIGHT_PER_HOUR,
  HOUR_MS: HOUR_MS,
  DAY_MS: DAY_MS,
  take: take,
  limitMessage: limitMessage,
  hashIp: hashIp,
  useMemory: useMemory,
  resetForTests: resetForTests,
};
