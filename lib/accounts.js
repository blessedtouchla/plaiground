'use strict';

/**
 * PLAIGROUND users table. Password hashes stay on the server.
 */

const crypto = require('crypto');
const db = require('./db');
const {
  hashPassword,
  isConfigured,
  isEmail,
  normalizeEmail,
  normalizePaidPlan,
  normalizePlan,
  publicUser,
} = require('./auth');

let memory = null;

function useMemoryStore(store) {
  memory = store || createMemoryStore();
  return memory;
}

function resetStore() {
  memory = null;
}

function createMemoryStore() {
  const users = new Map();
  const emails = new Map();

  function copy(row) {
    return row
      ? Object.assign({}, row, {
          tonegrid_release_ids: Array.isArray(row.tonegrid_release_ids) ? row.tonegrid_release_ids.slice() : [],
          tonegrid_track_ids: Array.isArray(row.tonegrid_track_ids) ? row.tonegrid_track_ids.slice() : [],
        })
      : null;
  }

  return {
    async migrate() {},
    async findByEmail(email) {
      const id = emails.get(email);
      return id ? copy(users.get(id)) : null;
    },
    async findById(id) {
      return copy(users.get(id));
    },
    async create(input) {
      if (emails.has(input.email)) {
        const err = new Error('duplicate key value violates unique constraint');
        err.code = '23505';
        throw err;
      }
      const now = new Date().toISOString();
      const row = {
        id: crypto.randomUUID(),
        email: input.email,
        password_hash: input.passwordHash,
        artist_name: input.artistName,
        plan: input.plan || null,
        stripe_customer_id: null,
        stripe_session_id: null,
        tonegrid_artist_id: null,
        tonegrid_release_ids: [],
        tonegrid_track_ids: [],
        created_at: now,
        updated_at: now,
      };
      users.set(row.id, row);
      emails.set(row.email, row.id);
      return copy(row);
    },
    async update(id, patch) {
      const row = users.get(id);
      if (!row) return null;
      Object.keys(patch).forEach((key) => {
        if (patch[key] !== undefined) row[key] = patch[key];
      });
      row.updated_at = new Date().toISOString();
      return copy(row);
    },
  };
}

function isUniqueViolation(err) {
  return Boolean(err && (err.code === '23505' || /duplicate|unique/i.test(String(err.message || ''))));
}

const RETURNING = 'id, email, artist_name, plan, stripe_customer_id, stripe_session_id, tonegrid_artist_id, tonegrid_release_ids, tonegrid_track_ids, created_at, updated_at';

function neonRepo() {
  return {
    async migrate() {
      await db.migrate();
    },
    async findByEmail(email) {
      const rows = await db.query(
        'SELECT id, email, password_hash, artist_name, plan, stripe_customer_id, stripe_session_id, tonegrid_artist_id, tonegrid_release_ids, tonegrid_track_ids, created_at, updated_at FROM users WHERE email = $1 LIMIT 1',
        [email]
      );
      return rows[0] || null;
    },
    async findById(id) {
      const rows = await db.query(
        'SELECT ' + RETURNING + ', password_hash FROM users WHERE id = $1 LIMIT 1',
        [id]
      );
      return rows[0] || null;
    },
    async create(input) {
      const rows = await db.query(
        'INSERT INTO users (email, password_hash, artist_name, plan) VALUES ($1, $2, $3, $4) RETURNING ' + RETURNING,
        [input.email, input.passwordHash, input.artistName, input.plan]
      );
      return rows[0] || null;
    },
    async update(id, patch) {
      const rows = await db.query(
        'UPDATE users SET artist_name = COALESCE($2, artist_name), plan = COALESCE($3, plan), stripe_customer_id = COALESCE($4, stripe_customer_id), stripe_session_id = COALESCE($5, stripe_session_id), tonegrid_artist_id = $6, tonegrid_release_ids = $7, tonegrid_track_ids = $8, updated_at = now() WHERE id = $1 RETURNING ' + RETURNING,
        [
          id,
          patch.artist_name,
          patch.plan,
          patch.stripe_customer_id,
          patch.stripe_session_id,
          patch.tonegrid_artist_id,
          patch.tonegrid_release_ids,
          patch.tonegrid_track_ids,
        ]
      );
      return rows[0] || null;
    },
  };
}

function repo() {
  return memory || neonRepo();
}

async function ensureReady() {
  if (!isConfigured() && !memory) {
    const err = new Error('Accounts are not configured.');
    err.code = 'ACCOUNTS_UNCONFIGURED';
    throw err;
  }
  await repo().migrate();
}

async function findByEmail(email) {
  await ensureReady();
  return repo().findByEmail(normalizeEmail(email));
}

async function findById(id) {
  await ensureReady();
  if (!id) return null;
  return repo().findById(id);
}

async function createUser({ email, password, artist, plan }) {
  const normalized = normalizeEmail(email);
  if (!isEmail(normalized)) {
    const err = new Error('A valid email is required.');
    err.code = 'VALIDATION';
    throw err;
  }
  const artistName = String(artist || '').trim();
  if (!artistName) {
    const err = new Error('Artist name is required.');
    err.code = 'VALIDATION';
    throw err;
  }
  const passwordText = String(password || '');
  if (passwordText.length < 8) {
    const err = new Error('Password must be at least 8 characters.');
    err.code = 'VALIDATION';
    throw err;
  }
  const nextPlan = normalizePlan(plan);
  await ensureReady();
  try {
    return await repo().create({
      email: normalized,
      passwordHash: hashPassword(passwordText),
      artistName,
      plan: nextPlan,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const dup = new Error('An account with that email already exists.');
      dup.code = 'EMAIL_EXISTS';
      throw dup;
    }
    throw err;
  }
}

function appendId(list, id) {
  const next = Array.isArray(list) ? list.slice() : [];
  if (!id) return next;
  if (next.some((value) => String(value).toLowerCase() === String(id).toLowerCase())) return next;
  next.push(id);
  return next;
}

async function updateCatalog(id, { artistId, releaseId, trackId }) {
  await ensureReady();
  const row = await repo().findById(id);
  if (!row) return null;
  let artist = row.tonegrid_artist_id || null;
  if (artistId && !artist) artist = artistId;
  return repo().update(id, {
    artist_name: row.artist_name,
    plan: row.plan,
    stripe_customer_id: row.stripe_customer_id,
    stripe_session_id: row.stripe_session_id,
    tonegrid_artist_id: artist,
    tonegrid_release_ids: appendId(row.tonegrid_release_ids, releaseId),
    tonegrid_track_ids: appendId(row.tonegrid_track_ids, trackId),
  });
}

async function updateStripe(id, { plan, sessionId, customerId }) {
  await ensureReady();
  const row = await repo().findById(id);
  if (!row) return null;
  const nextPlan = normalizePaidPlan(plan) || row.plan;
  return repo().update(id, {
    artist_name: row.artist_name,
    plan: nextPlan,
    stripe_customer_id: customerId || row.stripe_customer_id,
    stripe_session_id: sessionId || row.stripe_session_id,
    tonegrid_artist_id: row.tonegrid_artist_id,
    tonegrid_release_ids: Array.isArray(row.tonegrid_release_ids) ? row.tonegrid_release_ids : [],
    tonegrid_track_ids: Array.isArray(row.tonegrid_track_ids) ? row.tonegrid_track_ids : [],
  });
}

module.exports = {
  createMemoryStore,
  createUser,
  ensureReady,
  findByEmail,
  findById,
  isUniqueViolation,
  publicUser,
  resetStore,
  updateCatalog,
  updateStripe,
  useMemoryStore,
};
