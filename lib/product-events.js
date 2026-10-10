'use strict';

/**
 * Product usage events. Every occurrence is stored with a user id and time.
 * Rollups keep count, first_at, and last_at per user and event.
 * Payloads stay small. Lyrics and other free text are dropped.
 * return_visit is one row per user per UTC day.
 */

const db = require('./db');

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 30;
const COHORT_WINDOW_DAYS = 7;

const EVENTS = {
  split_sheet_created: 'Split sheet created',
  split_sheet_sent: 'Split sheet sent',
  split_sheet_signed: 'Split sheet signed',
  qualify_started: 'Qualify my song started',
  qualify_completed: 'Qualify my song completed',
  claim_created: 'Claim my human parts created',
  claim_pdf_downloaded: 'Claim PDF downloaded',
  song_helper_started: 'Song Helper session started',
  song_helper_draft: 'Song Helper draft generated',
  song_helper_style_copied: 'Song Helper style prompt copied',
  song_helper_lyrics_copied: 'Song Helper lyrics copied',
  song_helper_saved: 'Song Helper saved',
  song_helper_first: 'First Song Helper song',
  cover_art_generated: 'Cover Art generated',
  cover_art_used: 'Cover Art used in submit',
  cover_reposition_used: 'Cover reposition used',
  contract_reviewed: 'Contract reviewed',
  contract_fixed: 'Contract fixed',
  contract_created: 'Contract created',
  copyright_choice: 'Copyright choice',
  route_map_built: 'Route map built',
  route_map_edited: 'Route map edited',
  route_stop_completed: 'Route stop completed',
  payout_method_setup: 'Payout method set up',
  signup: 'Account created',
  distro_checkout_started: 'Distribution checkout started',
  distro_checkout_completed: 'Distribution checkout completed',
  return_visit: 'Return visit',
  whats_new_viewed: "What's new viewed",
};

const ROLES = {
  artist: 'Artist',
  producer: 'Producer',
  songwriter: 'Songwriter',
  team: 'Team or label',
  manager: 'Manager',
};

const SONG_STAGES = { idea: true, made: true, out: true };
const WANTS = { release: true, heard: true, paid: true, team: true };
const PACES = { fast: true, cheap: true };

const TIERS = { ready: true, almost: true, needs: true };
const LANES = { human: true, ai: true };

const ATTR_EVENTS = {
  signup: true,
  song_helper_first: true,
  cover_art_generated: true,
  distro_checkout_started: true,
  distro_checkout_completed: true,
};

let memory = null;

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch (err) {
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
  const events = [];
  const rollups = new Map();

  function rollKey(userId, eventName) {
    return String(userId || '') + '\0' + String(eventName || '');
  }

  return {
    async insert(userId, eventName, payload, at) {
      const row = {
        id: 'mem-' + String(events.length + 1),
        user_id: userId,
        event_name: eventName,
        payload: payload && typeof payload === 'object' ? Object.assign({}, payload) : {},
        created_at: at,
      };
      events.push(row);
      const key = rollKey(userId, eventName);
      const prev = rollups.get(key);
      if (!prev) {
        rollups.set(key, {
          user_id: userId,
          event_name: eventName,
          event_count: 1,
          first_at: at,
          last_at: at,
        });
      } else {
        prev.event_count += 1;
        if (String(at) < String(prev.first_at)) prev.first_at = at;
        if (String(at) > String(prev.last_at)) prev.last_at = at;
      }
      return Object.assign({}, row, { payload: Object.assign({}, row.payload) });
    },
    async findDay(userId, eventName, dayStart, dayEnd) {
      const start = new Date(dayStart).getTime();
      const end = new Date(dayEnd).getTime();
      return events.some((row) => {
        if (String(row.user_id) !== String(userId)) return false;
        if (row.event_name !== eventName) return false;
        const t = new Date(row.created_at).getTime();
        return t >= start && t < end;
      });
    },
    async listRollups() {
      return Array.from(rollups.values()).map((row) => Object.assign({}, row));
    },
  };
}

function repo() {
  if (memory) return memory;
  if (usingAccountsMemory() || !db.hasDatabase()) {
    if (!memory) memory = createMemoryStore();
    return memory;
  }
  return neonRepo();
}

function neonRepo() {
  return {
    async insert(userId, eventName, payload, at) {
      const rows = await db.query(
        'INSERT INTO product_events (user_id, event_name, payload, created_at) VALUES ($1, $2, $3::jsonb, $4::timestamptz) RETURNING id, user_id, event_name, payload, created_at',
        [userId, eventName, JSON.stringify(payload && typeof payload === 'object' ? payload : {}), at]
      );
      const row = rows[0];
      if (!row) return null;
      await db.query(
        'INSERT INTO product_event_rollups (user_id, event_name, event_count, first_at, last_at) VALUES ($1, $2, 1, $3::timestamptz, $3::timestamptz) ON CONFLICT (user_id, event_name) DO UPDATE SET event_count = product_event_rollups.event_count + 1, last_at = CASE WHEN EXCLUDED.last_at > product_event_rollups.last_at THEN EXCLUDED.last_at ELSE product_event_rollups.last_at END, first_at = CASE WHEN EXCLUDED.first_at < product_event_rollups.first_at THEN EXCLUDED.first_at ELSE product_event_rollups.first_at END',
        [userId, eventName, at]
      );
      return row;
    },
    async findDay(userId, eventName, dayStart, dayEnd) {
      const rows = await db.query(
        'SELECT 1 AS hit FROM product_events WHERE user_id = $1 AND event_name = $2 AND created_at >= $3::timestamptz AND created_at < $4::timestamptz LIMIT 1',
        [userId, eventName, dayStart, dayEnd]
      );
      return Boolean(rows[0]);
    },
    async listRollups() {
      return db.query(
        'SELECT user_id, event_name, event_count, first_at, last_at FROM product_event_rollups'
      );
    },
  };
}

function clip(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
}

function cleanId(value) {
  const text = clip(value, 80);
  if (!text || !/^[A-Za-z0-9_.:-]{1,80}$/.test(text)) return '';
  return text;
}

function clickId(value) {
  const text = clip(value, 200);
  if (!/^[A-Za-z0-9._~-]{4,200}$/.test(text)) return '';
  return text;
}

function eventName(value) {
  const name = String(value || '').trim().toLowerCase();
  return EVENTS[name] ? name : '';
}

function sanitizePayload(name, payload) {
  const src = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const out = {};
  if (name === 'qualify_completed' && TIERS[src.tier]) out.tier = src.tier;
  if (name === 'copyright_choice' && LANES[src.lane]) out.lane = src.lane;
  const releaseId = cleanId(src.release_id || src.releaseId);
  if (releaseId && (name === 'copyright_choice' || name === 'cover_art_used')) out.release_id = releaseId;
  const stopId = cleanId(src.stop_id || src.stopId);
  if (stopId && name === 'route_stop_completed') out.stop_id = stopId;
  if (ATTR_EVENTS[name]) {
    const attr = normalizeAttribution(src.attribution);
    if (attr) out.attribution = attr;
  }
  return out;
}

function parseTime(value) {
  const now = new Date();
  if (!value) return now.toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return now.toISOString();
  if (d.getTime() > Date.now() + 60 * 1000) return now.toISOString();
  return d.toISOString();
}

function eventTime(value) {
  const iso = parseTime(value);
  const skew = Date.now() - new Date(iso).getTime();
  if (skew > 5 * 60 * 1000) return new Date().toISOString();
  return iso;
}

function utcDayRange(iso) {
  const day = String(iso).slice(0, 10);
  return {
    start: day + 'T00:00:00.000Z',
    end: new Date(Date.parse(day + 'T00:00:00.000Z') + DAY_MS).toISOString(),
  };
}

async function recordEvent(userId, eventNameValue, payload, at) {
  const id = String(userId || '').trim();
  const name = eventName(eventNameValue);
  if (!id || !name) return { recorded: false, reason: 'bad_event' };
  const when = parseTime(at);
  const store = repo();
  if (name === 'return_visit') {
    const range = utcDayRange(when);
    const exists = await store.findDay(id, name, range.start, range.end);
    if (exists) return { recorded: false, reason: 'deduped' };
  }
  const row = await store.insert(id, name, sanitizePayload(name, payload), when);
  if (!row) return { recorded: false, reason: 'no_store' };
  return { recorded: true, event: row };
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ROLES[role] ? role : '';
}

function normalizeAttribution(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const next = {
    utm_source: clip(value.utm_source, 120),
    utm_medium: clip(value.utm_medium, 120),
    utm_campaign: clip(value.utm_campaign, 120),
    utm_content: clip(value.utm_content, 120),
    utm_term: clip(value.utm_term, 120),
    fbclid: clickId(value.fbclid),
    ttclid: clickId(value.ttclid),
    gclid: clickId(value.gclid),
    referrer: clip(value.referrer, 300),
    ref: clip(value.ref, 64).replace(/[^A-Za-z0-9_-]/g, ''),
    landed_at: parseTime(value.landed_at),
  };
  const any = next.utm_source || next.utm_medium || next.utm_campaign || next.utm_content || next.utm_term || next.fbclid || next.ttclid || next.gclid || next.referrer || next.ref;
  if (!any && !value.landed_at) return null;
  return next;
}

function normalizeGuide(value) {
  const src = value && typeof value === 'object' ? value : {};
  const status = src.status === 'skipped' ? 'skipped' : (src.status === 'completed' ? 'completed' : '');
  if (!status) return null;
  const song = SONG_STAGES[src.song] ? src.song : '';
  const rawWants = Array.isArray(src.wants) ? src.wants : (src.want ? [src.want] : []);
  const wants = [];
  rawWants.forEach((id) => {
    const next = String(id || '').trim();
    if (WANTS[next] && wants.indexOf(next) === -1) wants.push(next);
  });
  const rawRoute = Array.isArray(src.route) ? src.route : (Array.isArray(src.stops) ? src.stops : []);
  const route = [];
  rawRoute.forEach((id) => {
    const next = cleanId(id);
    if (next && route.indexOf(next) === -1 && route.length < 24) route.push(next);
  });
  const pace = PACES[src.pace] ? src.pace : '';
  return {
    status: status,
    song: song,
    wants: wants,
    route: route,
    pace: pace,
    at: parseTime(src.at),
  };
}

function ms(value) {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function retainedAtDay30(user, visitLastAt) {
  const start = ms(user && user.created_at);
  if (!start) return false;
  const cutoff = start + RETENTION_DAYS * DAY_MS;
  if (ms(visitLastAt) >= cutoff) return true;
  const releases = user && Array.isArray(user.tonegrid_release_at) ? user.tonegrid_release_at : [];
  return releases.some((at) => ms(at) >= cutoff);
}

function measurableAtDay30(user, now) {
  const start = ms(user && user.created_at);
  if (!start) return false;
  return ms(now || new Date().toISOString()) >= start + RETENTION_DAYS * DAY_MS;
}

function didInFirst7Days(user, firstAt) {
  const start = ms(user && user.created_at);
  const first = ms(firstAt);
  if (!start || !first) return false;
  return first >= start && first < start + COHORT_WINDOW_DAYS * DAY_MS;
}

function cohortRows(users, rollups, now) {
  const people = Array.isArray(users) ? users : [];
  const rows = Array.isArray(rollups) ? rollups : [];
  const byUser = {};
  people.forEach((user) => {
    if (user && user.id) byUser[String(user.id)] = user;
  });
  const visits = {};
  rows.forEach((row) => {
    if (row && row.event_name === 'return_visit') visits[String(row.user_id)] = row.last_at;
  });
  return Object.keys(EVENTS).map((name) => {
    const mine = rows.filter((row) => row && row.event_name === name);
    let count = 0;
    const unique = {};
    let did = 0;
    let retained = 0;
    mine.forEach((row) => {
      const n = Number(row.event_count);
      count += Number.isFinite(n) && n > 0 ? n : 0;
      const id = String(row.user_id || '');
      if (!id || unique[id]) return;
      unique[id] = true;
      const user = byUser[id];
      if (!user || !measurableAtDay30(user, now)) return;
      if (!didInFirst7Days(user, row.first_at)) return;
      did += 1;
      if (retainedAtDay30(user, visits[id])) retained += 1;
    });
    return {
      event: name,
      label: EVENTS[name],
      count: count,
      unique_users: Object.keys(unique).length,
      cohort_did_in_7d: did,
      cohort_retained_30: retained,
    };
  });
}

async function summarize(users, now) {
  const rollups = typeof repo().listRollups === 'function' ? await repo().listRollups() : [];
  return cohortRows(users, rollups, now);
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function eventsToCsv(rows) {
  const header = ['event', 'label', 'count', 'unique_users', 'cohort_did_in_7d', 'cohort_retained_30'];
  const lines = [header.join(',')];
  (rows || []).forEach((row) => {
    lines.push([
      csvCell(row.event),
      csvCell(row.label),
      csvCell(row.count),
      csvCell(row.unique_users),
      csvCell(row.cohort_did_in_7d),
      csvCell(row.cohort_retained_30),
    ].join(','));
  });
  return lines.join('\n') + '\n';
}

module.exports = {
  EVENTS: EVENTS,
  ROLES: ROLES,
  cohortRows: cohortRows,
  createMemoryStore: createMemoryStore,
  eventsToCsv: eventsToCsv,
  normalizeAttribution: normalizeAttribution,
  normalizeGuide: normalizeGuide,
  normalizeRole: normalizeRole,
  eventTime: eventTime,
  recordEvent: recordEvent,
  resetStore: resetStore,
  sanitizePayload: sanitizePayload,
  summarize: summarize,
  useMemoryStore: useMemoryStore,
};
