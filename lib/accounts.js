'use strict';

/**
 * PLAIGROUND users table. Password hashes stay on the server.
 */

const crypto = require('crypto');
const db = require('./db');
const {
  emailsEquivalent,
  gmailLocalKey,
  hashPassword,
  isConfigured,
  isEmail,
  normalizeEmail,
  normalizePlan,
  normalizeStatus,
  publicUser,
} = require('./auth');

const PROTECTED_EMAILS = [
  'victoriaimtanes@gmail.com',
  'realhealthiswealth@gmail.com',
  'emailplaiground@gmail.com',
];
const profile = require('./profile');

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
          tonegrid_release_at: Array.isArray(row.tonegrid_release_at) ? row.tonegrid_release_at.slice() : [],
        })
      : null;
  }

  return {
    async migrate() {},
    async findByEmail(email) {
      const exact = emails.get(email) || emails.get(String(email || '').toLowerCase());
      if (exact) return copy(users.get(exact));
      const want = gmailLocalKey(email);
      if (!want) return null;
      const rows = Array.from(users.values());
      for (let i = 0; i < rows.length; i += 1) {
        if (gmailLocalKey(rows[i].email) === want) return copy(rows[i]);
      }
      return null;
    },
    async findById(id) {
      return copy(users.get(id));
    },
    async findByStripeCustomerId(customerId) {
      const target = String(customerId || '').trim();
      if (!target) return null;
      const rows = Array.from(users.values());
      for (let i = 0; i < rows.length; i += 1) {
        if (rows[i].stripe_customer_id === target) return copy(rows[i]);
      }
      return null;
    },
    async listAll() {
      const rows = Array.from(users.values()).map(copy);
      rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      return rows;
    },
    async findByReleaseId(releaseId) {
      const want = String(releaseId || '').trim().toLowerCase();
      if (!want) return null;
      const rows = Array.from(users.values());
      for (let i = 0; i < rows.length; i += 1) {
        if (rowOwnsRelease(rows[i], want)) return copy(rows[i]);
      }
      return null;
    },
    async create(input) {
      const existing = await this.findByEmail(input.email);
      if (existing || emails.has(input.email)) {
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
        status: 'active',
        stripe_customer_id: null,
        stripe_session_id: null,
        tonegrid_artist_id: null,
        tonegrid_release_ids: [],
        tonegrid_track_ids: [],
        tonegrid_release_at: [],
        email_confirmed_at: null,
        profile: profile.emptyProfile(),
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
    async remove(id) {
      const row = users.get(id);
      if (!row) return null;
      users.delete(id);
      emails.delete(row.email);
      return copy(row);
    },
  };
}

function rowOwnsRelease(row, want) {
  const ids = Array.isArray(row && row.tonegrid_release_ids) ? row.tonegrid_release_ids : [];
  if (ids.some((id) => String(id || '').toLowerCase() === want)) return true;
  const stored = row && row.profile && typeof row.profile === 'object' ? row.profile : {};
  const releases = Array.isArray(stored.releases) ? stored.releases : [];
  return releases.some((item) => {
    const id = String((item && (item.tonegrid_release_id || item.id)) || '').toLowerCase();
    return id === want;
  });
}

function isUniqueViolation(err) {
  return Boolean(err && (err.code === '23505' || /duplicate|unique/i.test(String(err.message || ''))));
}

const RETURNING = 'id, email, artist_name, plan, status, stripe_customer_id, stripe_session_id, tonegrid_artist_id, tonegrid_release_ids, tonegrid_track_ids, tonegrid_release_at, email_confirmed_at, profile, created_at, updated_at';

function neonRepo() {
  return {
    async migrate() {
      await db.migrate();
    },
    async findByEmail(email) {
      const gmailKey = gmailLocalKey(email);
      const rows = await db.query(
        'SELECT id, email, password_hash, artist_name, plan, status, stripe_customer_id, stripe_session_id, tonegrid_artist_id, tonegrid_release_ids, tonegrid_track_ids, tonegrid_release_at, email_confirmed_at, profile, created_at, updated_at FROM users WHERE lower(btrim(email)) = $1 OR ($2 <> \'\' AND replace(split_part(split_part(lower(btrim(email)), \'@\', 1), \'+\', 1), \'.\', \'\') = $2 AND lower(split_part(btrim(email), \'@\', 2)) IN (\'gmail.com\', \'googlemail.com\')) LIMIT 1',
        [email, gmailKey]
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
    async findByStripeCustomerId(customerId) {
      const target = String(customerId || '').trim();
      if (!target) return null;
      const rows = await db.query(
        'SELECT id, email, password_hash, artist_name, plan, status, stripe_customer_id, stripe_session_id, tonegrid_artist_id, tonegrid_release_ids, tonegrid_track_ids, tonegrid_release_at, email_confirmed_at, profile, created_at, updated_at FROM users WHERE stripe_customer_id = $1 LIMIT 1',
        [target]
      );
      return rows[0] || null;
    },
    async listAll() {
      return db.query(
        'SELECT id, email, artist_name, plan, status, stripe_customer_id, stripe_session_id, email_confirmed_at, created_at, updated_at FROM users ORDER BY created_at DESC'
      );
    },
    async findByReleaseId(releaseId) {
      const want = String(releaseId || '').trim().toLowerCase();
      if (!want) return null;
      const rows = await db.query(
        'SELECT id, email, password_hash, artist_name, plan, status, stripe_customer_id, stripe_session_id, tonegrid_artist_id, tonegrid_release_ids, tonegrid_track_ids, tonegrid_release_at, email_confirmed_at, profile, created_at, updated_at FROM users WHERE EXISTS (SELECT 1 FROM unnest(COALESCE(tonegrid_release_ids, ARRAY[]::text[])) x WHERE lower(x) = $1) OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(profile->\'releases\', \'[]\'::jsonb)) r WHERE lower(COALESCE(r->>\'tonegrid_release_id\', r->>\'id\', \'\')) = $1) LIMIT 1',
        [want]
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
        'UPDATE users SET artist_name = COALESCE($2, artist_name), plan = COALESCE($3, plan), status = COALESCE($4, status), stripe_customer_id = COALESCE($5, stripe_customer_id), stripe_session_id = COALESCE($6, stripe_session_id), tonegrid_artist_id = $7, tonegrid_release_ids = $8, tonegrid_track_ids = $9, tonegrid_release_at = $10, email_confirmed_at = COALESCE($11, email_confirmed_at), profile = COALESCE($12, profile), updated_at = now() WHERE id = $1 RETURNING ' + RETURNING,
        [
          id,
          patch.artist_name,
          patch.plan,
          patch.status,
          patch.stripe_customer_id,
          patch.stripe_session_id,
          patch.tonegrid_artist_id,
          patch.tonegrid_release_ids,
          patch.tonegrid_track_ids,
          patch.tonegrid_release_at,
          patch.email_confirmed_at,
          patch.profile == null ? null : JSON.stringify(patch.profile),
        ]
      );
      return rows[0] || null;
    },
    async remove(id) {
      const rows = await db.query(
        'DELETE FROM users WHERE id = $1 RETURNING ' + RETURNING,
        [id]
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
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return repo().findByEmail(normalized);
}

async function findById(id) {
  await ensureReady();
  if (!id) return null;
  return repo().findById(id);
}

async function findByReleaseId(releaseId) {
  await ensureReady();
  const want = String(releaseId || '').trim();
  if (!want) return null;
  if (typeof repo().findByReleaseId === 'function') {
    return repo().findByReleaseId(want);
  }
  return null;
}

async function findByStripeCustomerId(customerId) {
  await ensureReady();
  if (!customerId) return null;
  return repo().findByStripeCustomerId(customerId);
}

async function listUsers() {
  await ensureReady();
  if (typeof repo().listAll !== 'function') return [];
  return repo().listAll();
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
  // Gmail dots / +tags / googlemail are the same person. UNIQUE(email) only
  // covers the stored spelling, so look up the equivalent row first.
  const existing = await findByEmail(normalized);
  if (existing) {
    const dup = new Error('An account with that email already exists. Log in.');
    dup.code = 'EMAIL_EXISTS';
    throw dup;
  }
  try {
    return await repo().create({
      email: normalized,
      passwordHash: hashPassword(passwordText),
      artistName,
      plan: nextPlan,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const dup = new Error('An account with that email already exists. Log in.');
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

function alignedReleaseAt(row, nextIds, at) {
  const prevIds = Array.isArray(row.tonegrid_release_ids) ? row.tonegrid_release_ids : [];
  const prevAt = Array.isArray(row.tonegrid_release_at) ? row.tonegrid_release_at.slice() : [];
  while (prevAt.length < prevIds.length) prevAt.push(null);
  const out = [];
  nextIds.forEach((id) => {
    const idx = prevIds.findIndex((value) => String(value).toLowerCase() === String(id).toLowerCase());
    if (idx >= 0 && prevAt[idx] != null) {
      out.push(prevAt[idx]);
      return;
    }
    if (idx >= 0) {
      out.push(prevAt[idx] || null);
      return;
    }
    out.push(at || new Date().toISOString());
  });
  return out;
}

function catalogPatch(row, extras) {
  return Object.assign({
    artist_name: row.artist_name,
    plan: row.plan,
    status: row.status || 'active',
    stripe_customer_id: row.stripe_customer_id,
    stripe_session_id: row.stripe_session_id,
    tonegrid_artist_id: row.tonegrid_artist_id,
    tonegrid_release_ids: Array.isArray(row.tonegrid_release_ids) ? row.tonegrid_release_ids : [],
    tonegrid_track_ids: Array.isArray(row.tonegrid_track_ids) ? row.tonegrid_track_ids : [],
    tonegrid_release_at: Array.isArray(row.tonegrid_release_at) ? row.tonegrid_release_at : [],
    email_confirmed_at: row.email_confirmed_at,
    profile: (function () {
      const raw = row.profile;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        } catch (err) { /* keep empty fallback below */ }
      }
      return raw && typeof raw === 'object' ? raw : profile.emptyProfile();
    }()),
  }, extras || {});
}

async function updateCatalog(id, { artistId, releaseId, trackId, at }) {
  await ensureReady();
  const row = await repo().findById(id);
  if (!row) return null;
  let artist = row.tonegrid_artist_id || null;
  if (artistId && !artist) artist = artistId;
  const nextIds = appendId(row.tonegrid_release_ids, releaseId);
  return repo().update(id, catalogPatch(row, {
    tonegrid_artist_id: artist,
    tonegrid_release_ids: nextIds,
    tonegrid_track_ids: appendId(row.tonegrid_track_ids, trackId),
    tonegrid_release_at: alignedReleaseAt(row, nextIds, at),
  }));
}

async function removeRelease(id, releaseId) {
  await ensureReady();
  const row = await repo().findById(id);
  if (!row) return null;
  const want = String(releaseId || '').trim().toLowerCase();
  if (!want) return row;
  const prevIds = Array.isArray(row.tonegrid_release_ids) ? row.tonegrid_release_ids : [];
  const prevAt = Array.isArray(row.tonegrid_release_at) ? row.tonegrid_release_at.slice() : [];
  const nextIds = [];
  const nextAt = [];
  prevIds.forEach((value, i) => {
    if (String(value || '').trim().toLowerCase() === want) return;
    nextIds.push(value);
    nextAt.push(prevAt[i] != null ? prevAt[i] : null);
  });
  return repo().update(id, catalogPatch(row, {
    tonegrid_release_ids: nextIds,
    tonegrid_release_at: nextAt,
    profile: profile.removeRelease(profile.readStored(row), releaseId),
  }));
}

async function setReleaseHistory(id, releases) {
  await ensureReady();
  const row = await repo().findById(id);
  if (!row) return null;
  const ids = [];
  const times = [];
  (Array.isArray(releases) ? releases : []).forEach((item) => {
    const releaseId = typeof item === 'string' ? item : item && (item.id || item.release_id);
    if (!releaseId) return;
    if (ids.some((value) => String(value).toLowerCase() === String(releaseId).toLowerCase())) return;
    ids.push(releaseId);
    const at = typeof item === 'string' ? null : item && (item.at || item.created_at);
    times.push(at || new Date().toISOString());
  });
  return repo().update(id, catalogPatch(row, {
    tonegrid_release_ids: ids,
    tonegrid_release_at: times,
  }));
}

async function updateProfile(id, { artist, profile: nextProfile }) {
  await ensureReady();
  const row = await repo().findById(id);
  if (!row) return null;
  const artistName = String(artist || '').trim();
  return repo().update(id, catalogPatch(row, {
    artist_name: artistName || row.artist_name,
    profile: nextProfile || profile.emptyProfile(),
  }));
}

async function updateStripe(id, { plan, sessionId, customerId, status }) {
  await ensureReady();
  const row = await repo().findById(id);
  if (!row) return null;
  const nextPlan = normalizePlan(plan) || row.plan;
  const nextStatus = normalizeStatus(status) || row.status || 'active';
  return repo().update(id, catalogPatch(row, {
    plan: nextPlan,
    status: nextStatus,
    stripe_customer_id: customerId || row.stripe_customer_id,
    stripe_session_id: sessionId || row.stripe_session_id,
  }));
}

async function confirmEmail(email) {
  await ensureReady();
  const row = await repo().findByEmail(normalizeEmail(email));
  if (!row) return null;
  if (row.email_confirmed_at) return row;
  return repo().update(row.id, catalogPatch(row, {
    email_confirmed_at: new Date().toISOString(),
  }));
}

async function setPassword(id, password) {
  const passwordText = String(password || '');
  if (passwordText.length < 8) {
    const err = new Error('Password must be at least 8 characters.');
    err.code = 'VALIDATION';
    throw err;
  }
  await ensureReady();
  const row = await repo().findById(id);
  if (!row) return null;
  const passwordHash = hashPassword(passwordText);
  if (memory) {
    return repo().update(id, { password_hash: passwordHash });
  }
  const rows = await db.query(
    'UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1 RETURNING ' + RETURNING,
    [id, passwordHash]
  );
  return rows[0] || null;
}

function isProtectedAccount(email) {
  return PROTECTED_EMAILS.some((locked) => emailsEquivalent(email, locked));
}

async function deleteUser(id) {
  await ensureReady();
  if (!id) return null;
  const row = await repo().findById(id);
  if (!row) return null;
  if (isProtectedAccount(row.email)) {
    const err = new Error('This account cannot be deleted.');
    err.code = 'PROTECTED';
    throw err;
  }
  if (typeof repo().remove !== 'function') return null;
  return repo().remove(id);
}

module.exports = {
  createMemoryStore,
  confirmEmail,
  createUser,
  deleteUser,
  ensureReady,
  findByEmail,
  findById,
  findByReleaseId,
  findByStripeCustomerId,
  isProtectedAccount,
  listUsers,
  isUniqueViolation,
  publicUser,
  removeRelease,
  resetStore,
  setPassword,
  setReleaseHistory,
  updateCatalog,
  updateProfile,
  updateStripe,
  useMemoryStore,
};
