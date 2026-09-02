'use strict';

/**
 * Once-per-user growth events. Persist, then optionally mail.
 * signup / first_upload / first_store_live / paid. Never invent Live or pay.
 * first_upload mails only after POST /releases/:id/submit succeeds.
 */

const db = require('./db');
const releaseStatus = require('./release-status');
const livePlayer = require('./live-player');
const { sendLifecycleEmail } = require('./growth-mail');

const EVENT_NAMES = {
  signup: true,
  first_upload: true,
  first_store_live: true,
  paid: true,
};

const STORE_LINK_DSPS = {
  spotify: true,
  'apple-music': true,
  'youtube-music': true,
};

let memory = null;

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch {
    return false;
  }
}

function useMemoryStore(store) {
  memory = store || createMemoryStore();
  return memory;
}

function resetStore() {
  memory = null;
}

function createMemoryStore() {
  const rows = new Map();

  function keyOf(userId, eventName) {
    return String(userId || '') + '\0' + String(eventName || '');
  }

  return {
    async insert(userId, eventName, payload, at) {
      const key = keyOf(userId, eventName);
      if (rows.has(key)) return null;
      const row = {
        user_id: userId,
        event_name: eventName,
        payload: payload && typeof payload === 'object' ? Object.assign({}, payload) : {},
        created_at: at || new Date().toISOString(),
      };
      rows.set(key, row);
      return Object.assign({}, row, {
        payload: Object.assign({}, row.payload),
      });
    },
    async find(userId, eventName) {
      const row = rows.get(keyOf(userId, eventName));
      return row
        ? Object.assign({}, row, { payload: Object.assign({}, row.payload) })
        : null;
    },
    async listAll() {
      const out = Array.from(rows.values()).map((row) => Object.assign({}, row, {
        payload: Object.assign({}, row.payload),
      }));
      out.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      return out;
    },
  };
}

function repo() {
  if (memory) return memory;
  if (usingAccountsMemory()) {
    memory = createMemoryStore();
    return memory;
  }
  if (!db.hasDatabase()) {
    if (!memory) memory = createMemoryStore();
    return memory;
  }
  return neonRepo();
}

function neonRepo() {
  return {
    async insert(userId, eventName, payload, at) {
      const rows = await db.query(
        'INSERT INTO user_events (user_id, event_name, payload, created_at) VALUES ($1, $2, $3::jsonb, COALESCE($4::timestamptz, now())) ON CONFLICT (user_id, event_name) DO NOTHING RETURNING user_id, event_name, payload, created_at',
        [userId, eventName, JSON.stringify(payload && typeof payload === 'object' ? payload : {}), at || null]
      );
      return rows[0] || null;
    },
    async find(userId, eventName) {
      const rows = await db.query(
        'SELECT user_id, event_name, payload, created_at FROM user_events WHERE user_id = $1 AND event_name = $2 LIMIT 1',
        [userId, eventName]
      );
      return rows[0] || null;
    },
    async listAll() {
      return db.query(
        'SELECT user_id, event_name, payload, created_at FROM user_events ORDER BY created_at DESC'
      );
    },
  };
}

function normalizeEventName(value) {
  const name = String(value || '').trim().toLowerCase();
  return EVENT_NAMES[name] ? name : '';
}

function publicStoreLinks(release) {
  const links = livePlayer.linksFrom(release) || [];
  const out = [];
  const seen = {};
  links.forEach((item) => {
    const dsp = String((item && item.dsp) || '').trim().toLowerCase();
    const open = String((item && item.open) || '').trim();
    const name = String((item && item.name) || '').trim();
    if (!STORE_LINK_DSPS[dsp]) return;
    if (!/^https:\/\//i.test(open)) return;
    if (seen[open]) return;
    seen[open] = true;
    out.push({
      name: name || (dsp === 'spotify' ? 'Spotify' : dsp === 'apple-music' ? 'Apple Music' : 'YouTube Music'),
      open: open,
      dsp: dsp,
    });
  });
  return out;
}

async function recordEvent(userId, eventName, payload) {
  const id = String(userId || '').trim();
  const name = normalizeEventName(eventName);
  if (!id || !name) return { recorded: false, reason: 'bad_event' };
  const store = repo();
  if (typeof store.insert !== 'function') return { recorded: false, reason: 'no_store' };
  const row = await store.insert(id, name, payload && typeof payload === 'object' ? payload : {});
  if (!row) return { recorded: false, reason: 'duplicate' };
  return { recorded: true, event: row };
}

async function hasEvent(userId, eventName) {
  const id = String(userId || '').trim();
  const name = normalizeEventName(eventName);
  if (!id || !name) return false;
  const row = await repo().find(id, name);
  return Boolean(row);
}

async function listEvents() {
  if (typeof repo().listAll !== 'function') return [];
  return repo().listAll();
}

async function recordAndNotify(user, eventName, payload) {
  if (!user || !user.id) return { recorded: false, reason: 'no_user' };
  const recorded = await recordEvent(user.id, eventName, payload);
  if (!recorded.recorded) return recorded;
  try {
    recorded.mail = await sendLifecycleEmail(eventName, user, payload);
  } catch (err) {
    recorded.mail = { mail_sent: false, error: 'Could not send the lifecycle email.' };
  }
  return recorded;
}

async function recordSignup(user) {
  return recordAndNotify(user, 'signup', {});
}

async function recordFirstUpload(user, extras) {
  const releaseId = String((extras && (extras.release_id || extras.releaseId)) || '').trim();
  return recordAndNotify(user, 'first_upload', releaseId ? { release_id: releaseId } : {});
}

async function recordFirstStoreLive(user, status, extras) {
  if (!releaseStatus.isLive(status)) return { recorded: false, reason: 'not_live' };
  const releaseId = String((extras && (extras.release_id || extras.releaseId)) || '').trim();
  const links = Array.isArray(extras && extras.links)
    ? extras.links.filter((item) => item && /^https:\/\//i.test(String(item.open || '')))
    : publicStoreLinks(extras && extras.release);
  const payload = {};
  if (releaseId) payload.release_id = releaseId;
  if (links.length) payload.links = links.map((item) => ({ name: item.name, open: item.open }));
  return recordAndNotify(user, 'first_store_live', payload);
}

async function recordPaid(user, plan) {
  const next = String(plan || (user && user.plan) || '').trim().toLowerCase();
  if (next !== 'creator' && next !== 'pro') return { recorded: false, reason: 'not_paid' };
  return recordAndNotify(user, 'paid', { plan: next });
}

module.exports = {
  EVENT_NAMES: Object.keys(EVENT_NAMES),
  createMemoryStore,
  hasEvent,
  listEvents,
  publicStoreLinks,
  recordAndNotify,
  recordEvent,
  recordFirstStoreLive,
  recordFirstUpload,
  recordPaid,
  recordSignup,
  resetStore,
  useMemoryStore,
};
