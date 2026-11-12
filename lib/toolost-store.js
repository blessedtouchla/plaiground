'use strict';

/**
 * One PLAIGROUND label token. Ciphertext only, in the existing account database.
 * The browser never receives the access token or the refresh token.
 */

const crypto = require('crypto');
const db = require('./db');

const ROW_ID = 'plaiground-sandbox';
const STORE_COPY = 'The label token store is not configured yet.';

let injected = null;

function sessionSecret() {
  return String(process.env.SESSION_SECRET || '').trim();
}

function key() {
  return crypto.createHash('sha256').update(sessionSecret() + ':toolost-label-token').digest();
}

function encrypt(record) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const plain = Buffer.from(JSON.stringify(record), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decrypt(blob) {
  const parts = String(blob || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || !sessionSecret()) return null;
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const data = Buffer.from(parts[3], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    const record = JSON.parse(plain);
    if (!record || typeof record.access_token !== 'string' || !record.access_token) return null;
    return record;
  } catch {
    return null;
  }
}

function publicView(record) {
  if (!record || !record.access_token) return { connected: false };
  return {
    connected: true,
    env: 'sandbox',
    scope: String(record.scope || ''),
    expires_at: String(record.expires_at || ''),
    has_refresh: Boolean(record.refresh_token),
    updated_at: String(record.updated_at || ''),
  };
}

function createMemoryStore() {
  let blob = '';
  return {
    kind: 'memory',
    async read() {
      return decrypt(blob);
    },
    async save(record) {
      blob = encrypt(record);
      return true;
    },
    exportState() {
      return blob;
    },
    importState(value) {
      blob = String(value || '');
    },
  };
}

function status() {
  if (injected) return { ok: true, kind: 'memory' };
  if (!sessionSecret()) return { ok: false, message: 'The server cannot sign this connection yet.' };
  if (!db.hasDatabase()) return { ok: false, message: STORE_COPY };
  return { ok: true, kind: 'postgres' };
}

async function ensureTable() {
  await db.query(
    'CREATE TABLE IF NOT EXISTS toolost_label_oauth ('
    + 'id text PRIMARY KEY, ciphertext text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())'
  );
}

async function read() {
  if (injected) return injected.read();
  if (!status().ok) return null;
  await ensureTable();
  const rows = await db.query('SELECT ciphertext FROM toolost_label_oauth WHERE id = $1', [ROW_ID]);
  const blob = rows[0] && rows[0].ciphertext;
  return decrypt(blob);
}

async function save(record) {
  if (!record || !record.access_token || record.env !== 'sandbox') return false;
  if (injected) return injected.save(record);
  if (!status().ok) return false;
  await ensureTable();
  const blob = encrypt(record);
  await db.query(
    'INSERT INTO toolost_label_oauth (id, ciphertext, updated_at) VALUES ($1, $2, now()) '
    + 'ON CONFLICT (id) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, updated_at = now()',
    [ROW_ID, blob]
  );
  return true;
}

function useMemoryStoreForTests() {
  injected = createMemoryStore();
  return injected;
}

function resetForTests() {
  injected = null;
}

module.exports = {
  STORE_COPY,
  createMemoryStore,
  publicView,
  read,
  resetForTests,
  save,
  status,
  useMemoryStoreForTests,
};
