'use strict';

/**
 * Launch-sprint marketing counts.
 * First-party visitor id plus UTM and ad click ids.
 * No email, name, or account id is stored here.
 * visit is one row per visitor per UTC day.
 * signup and song_first are one row per visitor.
 */

const db = require('./db');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 62;
const DAY_CAP = 20;

const EVENTS = {
  visit: true,
  signup: true,
  song_first: true,
  cover_art: true,
  distro_started: true,
  distro_purchased: true,
};

const ONCE = {
  signup: true,
  song_first: true,
};

const DAY_ONCE = {
  visit: true,
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
  const rows = [];
  return {
    async insert(row) {
      const saved = Object.assign({ id: 'mem-' + String(rows.length + 1) }, row);
      rows.push(saved);
      return Object.assign({}, saved);
    },
    async findName(visitorId, eventName) {
      return rows.some((row) => row.visitor_id === visitorId && row.event_name === eventName);
    },
    async findDay(visitorId, eventName, dayStart, dayEnd) {
      const start = new Date(dayStart).getTime();
      const end = new Date(dayEnd).getTime();
      return rows.some((row) => {
        if (row.visitor_id !== visitorId || row.event_name !== eventName) return false;
        const t = new Date(row.created_at).getTime();
        return t >= start && t < end;
      });
    },
    async countDay(visitorId, dayStart, dayEnd) {
      const start = new Date(dayStart).getTime();
      const end = new Date(dayEnd).getTime();
      return rows.filter((row) => {
        if (row.visitor_id !== visitorId) return false;
        const t = new Date(row.created_at).getTime();
        return t >= start && t < end;
      }).length;
    },
    async listRange(start, end) {
      const from = new Date(start).getTime();
      const to = new Date(end).getTime();
      return rows.filter((row) => {
        const t = new Date(row.created_at).getTime();
        return t >= from && t < to;
      }).map((row) => Object.assign({}, row));
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
    async insert(row) {
      const rows = await db.query(
        'INSERT INTO marketing_events (visitor_id, event_name, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, ttclid, gclid, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz) RETURNING id',
        [
          row.visitor_id,
          row.event_name,
          row.utm_source,
          row.utm_medium,
          row.utm_campaign,
          row.utm_content,
          row.utm_term,
          row.fbclid,
          row.ttclid,
          row.gclid,
          row.created_at,
        ]
      );
      return rows[0] || null;
    },
    async findName(visitorId, eventName) {
      const rows = await db.query(
        'SELECT 1 AS hit FROM marketing_events WHERE visitor_id = $1 AND event_name = $2 LIMIT 1',
        [visitorId, eventName]
      );
      return Boolean(rows[0]);
    },
    async findDay(visitorId, eventName, dayStart, dayEnd) {
      const rows = await db.query(
        'SELECT 1 AS hit FROM marketing_events WHERE visitor_id = $1 AND event_name = $2 AND created_at >= $3::timestamptz AND created_at < $4::timestamptz LIMIT 1',
        [visitorId, eventName, dayStart, dayEnd]
      );
      return Boolean(rows[0]);
    },
    async countDay(visitorId, dayStart, dayEnd) {
      const rows = await db.query(
        'SELECT count(*)::int AS n FROM marketing_events WHERE visitor_id = $1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz',
        [visitorId, dayStart, dayEnd]
      );
      return rows[0] ? Number(rows[0].n) || 0 : 0;
    },
    async listRange(start, end) {
      return db.query(
        'SELECT event_name, utm_source, utm_medium, utm_campaign, utm_content, created_at FROM marketing_events WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz',
        [start, end]
      );
    },
  };
}

function clip(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
}

function visitorId(value) {
  const text = clip(value, 64);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(text)) return '';
  return text;
}

function clickId(value) {
  const text = clip(value, 200);
  if (!/^[A-Za-z0-9._~-]{4,200}$/.test(text)) return '';
  return text;
}

function parseTime(value) {
  const now = new Date();
  if (!value) return now.toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return now.toISOString();
  if (d.getTime() > Date.now() + 60 * 1000) return now.toISOString();
  return d.toISOString();
}

function utcDayRange(iso) {
  const day = String(iso).slice(0, 10);
  return {
    start: day + 'T00:00:00.000Z',
    end: new Date(Date.parse(day + 'T00:00:00.000Z') + DAY_MS).toISOString(),
  };
}

function normalizeTouch(value) {
  const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    utm_source: clip(src.utm_source, 120),
    utm_medium: clip(src.utm_medium, 120),
    utm_campaign: clip(src.utm_campaign, 120),
    utm_content: clip(src.utm_content, 120),
    utm_term: clip(src.utm_term, 120),
    fbclid: clickId(src.fbclid),
    ttclid: clickId(src.ttclid),
    gclid: clickId(src.gclid),
  };
}

function dayStamp(value) {
  const text = clip(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const t = Date.parse(text + 'T00:00:00.000Z');
  if (Number.isNaN(t)) return '';
  return text;
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function resolveRange(from, to) {
  const start = dayStamp(from) || utcToday();
  const endDay = dayStamp(to) || start;
  if (endDay < start) return { error: 'bad_range' };
  const startMs = Date.parse(start + 'T00:00:00.000Z');
  const endMs = Date.parse(endDay + 'T00:00:00.000Z') + DAY_MS;
  if ((endMs - startMs) / DAY_MS > MAX_RANGE_DAYS) return { error: 'range_too_long' };
  return {
    from: start,
    to: endDay,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}

async function record(visitor, eventName, touch, at) {
  const id = visitorId(visitor);
  const name = String(eventName || '').trim().toLowerCase();
  if (!id || !EVENTS[name]) return { recorded: false, reason: 'bad_event' };
  const when = parseTime(at);
  const attr = normalizeTouch(touch);
  const store = repo();
  const range = utcDayRange(when);
  if (DAY_ONCE[name]) {
    const exists = await store.findDay(id, name, range.start, range.end);
    if (exists) return { recorded: false, reason: 'deduped' };
  }
  if (ONCE[name]) {
    const exists = await store.findName(id, name);
    if (exists) return { recorded: false, reason: 'deduped' };
  }
  if (!DAY_ONCE[name] && !ONCE[name]) {
    const count = await store.countDay(id, range.start, range.end);
    if (count >= DAY_CAP) return { recorded: false, reason: 'capped' };
  }
  const row = await store.insert({
    visitor_id: id,
    event_name: name,
    utm_source: attr.utm_source,
    utm_medium: attr.utm_medium,
    utm_campaign: attr.utm_campaign,
    utm_content: attr.utm_content,
    utm_term: attr.utm_term,
    fbclid: attr.fbclid,
    ttclid: attr.ttclid,
    gclid: attr.gclid,
    created_at: when,
  });
  if (!row) return { recorded: false, reason: 'no_store' };
  return { recorded: true };
}

function sourceLabel(value) {
  const text = clip(value, 120);
  return text || 'direct';
}

function addCount(bucket, name) {
  if (name === 'visit') bucket.visits += 1;
  else if (name === 'signup') bucket.signups += 1;
  else if (name === 'song_first') bucket.first_songs += 1;
  else if (name === 'distro_purchased') bucket.distro_purchases += 1;
}

async function report(from, to) {
  const range = resolveRange(from, to);
  if (range.error) return { error: range.error, from: '', to: '', rows: [] };
  const list = await repo().listRange(range.start, range.end);
  const groups = new Map();
  (list || []).forEach((row) => {
    const source = sourceLabel(row.utm_source);
    const medium = clip(row.utm_medium, 120);
    const campaign = clip(row.utm_campaign, 120);
    const content = clip(row.utm_content, 120);
    const key = [source, medium, campaign, content].join('\0');
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = {
        utm_source: source,
        utm_medium: medium,
        utm_campaign: campaign,
        utm_content: content,
        visits: 0,
        signups: 0,
        first_songs: 0,
        distro_purchases: 0,
      };
      groups.set(key, bucket);
    }
    addCount(bucket, row.event_name);
  });
  const rows = Array.from(groups.values()).filter((row) => (
    row.visits || row.signups || row.first_songs || row.distro_purchases
  ));
  rows.sort((a, b) => b.visits - a.visits || a.utm_source.localeCompare(b.utm_source));
  return { from: range.from, to: range.to, rows: rows };
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function reportToCsv(result) {
  const header = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'visits', 'signups', 'first_songs', 'distro_purchases'];
  const lines = [header.join(',')];
  const rows = result && Array.isArray(result.rows) ? result.rows : [];
  rows.forEach((row) => {
    lines.push([
      csvCell(row.utm_source),
      csvCell(row.utm_medium),
      csvCell(row.utm_campaign),
      csvCell(row.utm_content),
      csvCell(row.visits),
      csvCell(row.signups),
      csvCell(row.first_songs),
      csvCell(row.distro_purchases),
    ].join(','));
  });
  return lines.join('\n') + '\n';
}

module.exports = {
  EVENTS: EVENTS,
  createMemoryStore: createMemoryStore,
  normalizeTouch: normalizeTouch,
  record: record,
  report: report,
  reportToCsv: reportToCsv,
  resetStore: resetStore,
  resolveRange: resolveRange,
  useMemoryStore: useMemoryStore,
  visitorId: visitorId,
};
