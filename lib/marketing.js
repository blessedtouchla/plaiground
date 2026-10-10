'use strict';

/**
 * Launch-sprint marketing counts.
 * First-party visitor id plus UTM and ad click ids.
 * No email, name, or lyrics are stored.
 * user_id is internal. It is set on signup or login and never leaves in the report.
 * visit and returned_visit are one row per visitor per UTC day.
 * signup and song_first are one row per visitor.
 * tool_view is one row per visitor, tool, and UTC day.
 */

const db = require('./db');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 62;
const DAY_CAP = 40;
const LOOKAHEAD_DAYS = 7;

const EVENTS = {
  visit: true,
  returned_visit: true,
  signup: true,
  song_first: true,
  song_helper_started: true,
  song_helper_step: true,
  song_helper_draft: true,
  song_helper_section: true,
  song_helper_ask: true,
  song_helper_rhymify: true,
  song_helper_sounds: true,
  song_helper_style_made: true,
  song_helper_style_copied: true,
  cover_art: true,
  cover_art_downloaded: true,
  roadmap_stage: true,
  roadmap_goal: true,
  check_and_file_completed: true,
  contract_opened: true,
  distro_started: true,
  distro_purchased: true,
  plai_opened: true,
  plai_chip: true,
  tool_view: true,
};

const ONCE = {
  signup: true,
  song_first: true,
};

const DAY_ONCE = {
  visit: true,
  returned_visit: true,
};

const DAY_SLOT = {
  tool_view: 'tool',
  song_helper_step: 'step',
  contract_opened: 'step',
  roadmap_stage: 'step',
  roadmap_goal: 'step',
  plai_chip: 'step',
};

const TOOLS = {
  song_helper: true,
  cover_art: true,
  roadmap: true,
  qualify: true,
  contracts: true,
  distribution: true,
  ar: true,
  epk: true,
  pricing: true,
  plai: true,
};

const STEP_VALUES = {
  roadmap_stage: { idea: true, made: true, out: true },
  roadmap_goal: { money: true, fanbase: true, release: true },
  plai_chip: { start: true, distribution: true, cost: true, protect: true },
  contract_opened: { review: true, fix: true, create: true, read: true },
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

function publicRow(row) {
  return {
    visitor_id: row.visitor_id,
    event_name: row.event_name,
    utm_source: row.utm_source || '',
    utm_medium: row.utm_medium || '',
    utm_campaign: row.utm_campaign || '',
    utm_content: row.utm_content || '',
    segment: row.segment || '',
    angle: row.angle || '',
    tool: row.tool || '',
    step: row.step || '',
    created_at: row.created_at,
  };
}

function createMemoryStore() {
  const rows = [];
  return {
    async insert(row) {
      const saved = Object.assign({ id: 'mem-' + String(rows.length + 1), user_id: null }, row);
      rows.push(saved);
      return { id: saved.id };
    },
    async findName(visitorId, eventName) {
      return rows.some((row) => row.visitor_id === visitorId && row.event_name === eventName);
    },
    async findSlot(visitorId, eventName, dayStart, dayEnd, tool, step) {
      const start = new Date(dayStart).getTime();
      const end = new Date(dayEnd).getTime();
      return rows.some((row) => {
        if (row.visitor_id !== visitorId || row.event_name !== eventName) return false;
        const t = new Date(row.created_at).getTime();
        if (t < start || t >= end) return false;
        if (tool && row.tool !== tool) return false;
        if (step && row.step !== step) return false;
        return true;
      });
    },
    async countName(visitorId, eventName, dayStart, dayEnd) {
      const start = new Date(dayStart).getTime();
      const end = new Date(dayEnd).getTime();
      return rows.filter((row) => {
        if (row.visitor_id !== visitorId || row.event_name !== eventName) return false;
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
      }).map(publicRow);
    },
    async link(userId, visitorId) {
      let count = 0;
      rows.forEach((row) => {
        if (row.visitor_id === visitorId && !row.user_id) {
          row.user_id = userId;
          count += 1;
        }
      });
      return count;
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

async function openStore() {
  if (!(memory || usingAccountsMemory() || !db.hasDatabase())) {
    await db.migrate();
  }
  return repo();
}

function neonRepo() {
  return {
    async insert(row) {
      const rows = await db.query(
        'INSERT INTO marketing_events (visitor_id, event_name, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, ttclid, gclid, tool, step, segment, angle, version, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::timestamptz) RETURNING id',
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
          row.tool,
          row.step,
          row.segment,
          row.angle,
          row.version,
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
    async findSlot(visitorId, eventName, dayStart, dayEnd, tool, step) {
      const params = [visitorId, eventName, dayStart, dayEnd];
      let sql = 'SELECT 1 AS hit FROM marketing_events WHERE visitor_id = $1 AND event_name = $2 AND created_at >= $3::timestamptz AND created_at < $4::timestamptz';
      if (tool) {
        params.push(tool);
        sql += ' AND tool = $' + String(params.length);
      }
      if (step) {
        params.push(step);
        sql += ' AND step = $' + String(params.length);
      }
      sql += ' LIMIT 1';
      const rows = await db.query(sql, params);
      return Boolean(rows[0]);
    },
    async countName(visitorId, eventName, dayStart, dayEnd) {
      const rows = await db.query(
        'SELECT count(*)::int AS n FROM marketing_events WHERE visitor_id = $1 AND event_name = $2 AND created_at >= $3::timestamptz AND created_at < $4::timestamptz',
        [visitorId, eventName, dayStart, dayEnd]
      );
      return rows[0] ? Number(rows[0].n) || 0 : 0;
    },
    async listRange(start, end) {
      return db.query(
        'SELECT visitor_id, event_name, utm_source, utm_medium, utm_campaign, utm_content, segment, angle, tool, step, created_at FROM marketing_events WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz',
        [start, end]
      );
    },
    async link(userId, visitorId) {
      const rows = await db.query(
        'UPDATE marketing_events SET user_id = $1::uuid WHERE visitor_id = $2 AND user_id IS NULL RETURNING id',
        [userId, visitorId]
      );
      return rows.length;
    },
  };
}

function clip(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
}

function token(value, max) {
  const text = clip(value, max).toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(text)) return '';
  return text.slice(0, max);
}

function visitorId(value) {
  const text = clip(value, 64);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(text)) return '';
  return text;
}

function accountId(value) {
  const text = clip(value, 64).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(text)) return '';
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

function parseSegment(content) {
  const text = clip(content, 120);
  const match = /^([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)$/.exec(text);
  if (!match) return { segment: '', angle: '', version: '' };
  return {
    segment: match[1].toLowerCase().slice(0, 40),
    angle: match[2].toLowerCase().slice(0, 40),
    version: match[3].toLowerCase().slice(0, 40),
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

function cleanTool(value) {
  const text = token(value, 40);
  return TOOLS[text] ? text : '';
}

function cleanStep(eventName, value) {
  const text = token(value, 24);
  if (!text) return '';
  const allowed = STEP_VALUES[eventName];
  if (allowed) return allowed[text] ? text : '';
  return text;
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

function emptyReport(error) {
  return {
    error: error || '',
    from: '',
    to: '',
    rows: [],
    tools: [],
    funnels: [],
    returns: { by_first_tool: [], by_source: [] },
  };
}

async function record(visitor, eventName, touch, at, meta) {
  const id = visitorId(visitor);
  const name = String(eventName || '').trim().toLowerCase();
  if (!id || !EVENTS[name]) return { recorded: false, reason: 'bad_event' };
  const extra = meta && typeof meta === 'object' ? meta : {};
  const tool = cleanTool(extra.tool);
  const step = cleanStep(name, extra.step);
  if (name === 'tool_view' && !tool) return { recorded: false, reason: 'bad_event' };
  const when = parseTime(at);
  const attr = normalizeTouch(touch);
  const parts = parseSegment(attr.utm_content);
  const store = await openStore();
  const range = utcDayRange(when);
  if (DAY_ONCE[name]) {
    const exists = await store.findSlot(id, name, range.start, range.end, '', '');
    if (exists) return { recorded: false, reason: 'deduped' };
  }
  if (ONCE[name]) {
    const exists = await store.findName(id, name);
    if (exists) return { recorded: false, reason: 'deduped' };
  }
  const slot = DAY_SLOT[name];
  if (slot === 'tool' && tool) {
    const exists = await store.findSlot(id, name, range.start, range.end, tool, '');
    if (exists) return { recorded: false, reason: 'deduped' };
  }
  if (slot === 'step' && step) {
    const exists = await store.findSlot(id, name, range.start, range.end, '', step);
    if (exists) return { recorded: false, reason: 'deduped' };
  }
  if (!DAY_ONCE[name] && !ONCE[name] && !(slot === 'tool' && tool) && !(slot === 'step' && step)) {
    const count = await store.countName(id, name, range.start, range.end);
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
    tool: tool,
    step: step,
    segment: parts.segment,
    angle: parts.angle,
    version: parts.version,
    created_at: when,
  });
  if (!row) return { recorded: false, reason: 'no_store' };
  return { recorded: true };
}

async function linkVisitor(userId, visitor) {
  const uid = accountId(userId);
  const id = visitorId(visitor);
  if (!uid || !id) return { linked: false, count: 0 };
  const store = await openStore();
  const count = await store.link(uid, id);
  return { linked: true, count: Number(count) || 0 };
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

function toolOf(row) {
  const explicit = cleanTool(row && row.tool);
  if (explicit) return explicit;
  const name = String(row && row.event_name || '');
  if (name === 'song_first' || name.indexOf('song_helper') === 0) return 'song_helper';
  if (name === 'cover_art' || name.indexOf('cover_art') === 0) return 'cover_art';
  if (name.indexOf('roadmap') === 0) return 'roadmap';
  if (name.indexOf('distro') === 0) return 'distribution';
  if (name.indexOf('contract') === 0) return 'contracts';
  if (name.indexOf('plai') === 0) return 'plai';
  if (name === 'check_and_file_completed') return 'qualify';
  return '';
}

function dayKey(value) {
  return String(value || '').slice(0, 10);
}

function addDays(day, n) {
  return new Date(Date.parse(day + 'T00:00:00.000Z') + n * DAY_MS).toISOString().slice(0, 10);
}

function bumpReturn(map, key, ret1, ret7, fields) {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = Object.assign({ visitors: 0, returned_1d: 0, returned_7d: 0 }, fields);
    map.set(key, bucket);
  }
  bucket.visitors += 1;
  if (ret1) bucket.returned_1d += 1;
  if (ret7) bucket.returned_7d += 1;
}

function buildReturns(inWindow, later) {
  const byVisitor = new Map();
  function add(row, inRange) {
    const id = row.visitor_id;
    if (!id) return;
    if (!byVisitor.has(id)) byVisitor.set(id, { window: [], all: [] });
    const bag = byVisitor.get(id);
    bag.all.push(row);
    if (inRange) bag.window.push(row);
  }
  (inWindow || []).forEach((row) => add(row, true));
  (later || []).forEach((row) => add(row, false));
  const toolBuckets = new Map();
  const sourceBuckets = new Map();
  byVisitor.forEach((bag) => {
    if (!bag.window.length) return;
    const ordered = bag.window.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const firstDay = dayKey(ordered[0].created_at);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDay)) return;
    const views = ordered.filter((item) => item.event_name === 'tool_view' && toolOf(item));
    let firstTool = views.length ? toolOf(views[0]) : '';
    if (!firstTool) {
      ordered.some((item) => {
        firstTool = toolOf(item);
        return Boolean(firstTool);
      });
    }
    if (!firstTool) firstTool = 'none';
    const source = sourceLabel(ordered[0].utm_source);
    const segment = token(ordered[0].segment, 40);
    const day1 = addDays(firstDay, 1);
    const day7 = addDays(firstDay, 7);
    let ret1 = false;
    let ret7 = false;
    bag.all.forEach((item) => {
      const day = dayKey(item.created_at);
      if (!day || day <= firstDay) return;
      if (day === day1) ret1 = true;
      if (day <= day7) ret7 = true;
    });
    if (ret1) ret7 = true;
    bumpReturn(toolBuckets, firstTool, ret1, ret7, { first_tool: firstTool });
    bumpReturn(sourceBuckets, source + '\0' + segment, ret1, ret7, { utm_source: source, segment: segment });
  });
  const byTool = Array.from(toolBuckets.values());
  const bySource = Array.from(sourceBuckets.values());
  byTool.sort((a, b) => b.visitors - a.visitors || a.first_tool.localeCompare(b.first_tool));
  bySource.sort((a, b) => b.visitors - a.visitors || a.utm_source.localeCompare(b.utm_source));
  return { by_first_tool: byTool, by_source: bySource };
}

function visitorSet(rows, pred) {
  const set = new Set();
  (rows || []).forEach((row) => {
    if (row.visitor_id && pred(row)) set.add(row.visitor_id);
  });
  return set.size;
}

function isToolView(row, tool) {
  return row.event_name === 'tool_view' && toolOf(row) === tool;
}

function buildFunnels(rows) {
  const defs = [
    ['song_helper', 'view', (row) => isToolView(row, 'song_helper')],
    ['song_helper', 'start', (row) => row.event_name === 'song_helper_started'],
    ['song_helper', 'draft', (row) => row.event_name === 'song_helper_draft' || row.event_name === 'song_first'],
    ['song_helper', 'section', (row) => row.event_name === 'song_helper_section'],
    ['song_helper', 'ask', (row) => row.event_name === 'song_helper_ask'],
    ['song_helper', 'rhymify', (row) => row.event_name === 'song_helper_rhymify'],
    ['song_helper', 'sounds', (row) => row.event_name === 'song_helper_sounds'],
    ['song_helper', 'style', (row) => row.event_name === 'song_helper_style_made' || row.event_name === 'song_helper_style_copied'],
    ['cover_art', 'view', (row) => isToolView(row, 'cover_art')],
    ['cover_art', 'generated', (row) => row.event_name === 'cover_art'],
    ['cover_art', 'downloaded', (row) => row.event_name === 'cover_art_downloaded'],
    ['roadmap', 'view', (row) => isToolView(row, 'roadmap')],
    ['roadmap', 'stage', (row) => row.event_name === 'roadmap_stage'],
    ['roadmap', 'goal', (row) => row.event_name === 'roadmap_goal'],
    ['qualify', 'view', (row) => isToolView(row, 'qualify')],
    ['qualify', 'completed', (row) => row.event_name === 'check_and_file_completed'],
    ['contracts', 'view', (row) => isToolView(row, 'contracts')],
    ['contracts', 'opened', (row) => row.event_name === 'contract_opened'],
    ['distribution', 'view', (row) => isToolView(row, 'distribution')],
    ['distribution', 'started', (row) => row.event_name === 'distro_started'],
    ['distribution', 'completed', (row) => row.event_name === 'distro_purchased'],
    ['plai', 'opened', (row) => row.event_name === 'plai_opened' || isToolView(row, 'plai')],
    ['plai', 'chip', (row) => row.event_name === 'plai_chip'],
  ];
  return defs.map((item) => ({
    funnel: item[0],
    step: item[1],
    visitors: visitorSet(rows, item[2]),
  }));
}

function buildTools(rows) {
  const groups = new Map();
  (rows || []).forEach((row) => {
    const tool = toolOf(row);
    if (!tool) return;
    let bucket = groups.get(tool);
    if (!bucket) {
      bucket = { tool: tool, visitors: new Set(), events: 0 };
      groups.set(tool, bucket);
    }
    bucket.events += 1;
    if (row.visitor_id) bucket.visitors.add(row.visitor_id);
  });
  const list = Array.from(groups.values()).map((bucket) => ({
    tool: bucket.tool,
    visitors: bucket.visitors.size,
    events: bucket.events,
  }));
  list.sort((a, b) => b.visitors - a.visitors || a.tool.localeCompare(b.tool));
  return list;
}

async function report(from, to) {
  const range = resolveRange(from, to);
  if (range.error) return emptyReport(range.error);
  const lookEnd = new Date(Date.parse(range.end) + LOOKAHEAD_DAYS * DAY_MS).toISOString();
  const list = await (await openStore()).listRange(range.start, lookEnd);
  const endMs = Date.parse(range.end);
  const inWindow = [];
  const later = [];
  (list || []).forEach((row) => {
    const t = new Date(row.created_at).getTime();
    if (t < endMs) inWindow.push(row);
    else later.push(row);
  });
  const groups = new Map();
  inWindow.forEach((row) => {
    const source = sourceLabel(row.utm_source);
    const medium = clip(row.utm_medium, 120);
    const campaign = clip(row.utm_campaign, 120);
    const content = clip(row.utm_content, 120);
    const segment = token(row.segment, 40);
    const angle = token(row.angle, 40);
    const key = [source, medium, campaign, content, segment, angle].join('\0');
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = {
        utm_source: source,
        utm_medium: medium,
        utm_campaign: campaign,
        utm_content: content,
        segment: segment,
        angle: angle,
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
  return {
    from: range.from,
    to: range.to,
    rows: rows,
    tools: buildTools(inWindow),
    funnels: buildFunnels(inWindow),
    returns: buildReturns(inWindow, later),
  };
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function reportToCsv(result) {
  const header = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'segment', 'angle', 'visits', 'signups', 'first_songs', 'distro_purchases'];
  const lines = [header.join(',')];
  const rows = result && Array.isArray(result.rows) ? result.rows : [];
  rows.forEach((row) => {
    lines.push([
      csvCell(row.utm_source),
      csvCell(row.utm_medium),
      csvCell(row.utm_campaign),
      csvCell(row.utm_content),
      csvCell(row.segment),
      csvCell(row.angle),
      csvCell(row.visits),
      csvCell(row.signups),
      csvCell(row.first_songs),
      csvCell(row.distro_purchases),
    ].join(','));
  });
  lines.push('');
  lines.push('tool,visitors,events');
  const tools = result && Array.isArray(result.tools) ? result.tools : [];
  tools.forEach((row) => {
    lines.push([csvCell(row.tool), csvCell(row.visitors), csvCell(row.events)].join(','));
  });
  lines.push('');
  lines.push('funnel,step,visitors');
  const funnels = result && Array.isArray(result.funnels) ? result.funnels : [];
  funnels.forEach((row) => {
    lines.push([csvCell(row.funnel), csvCell(row.step), csvCell(row.visitors)].join(','));
  });
  lines.push('');
  lines.push('return_by,key,segment,visitors,returned_1d,returned_7d');
  const returns = result && result.returns ? result.returns : {};
  const byTool = Array.isArray(returns.by_first_tool) ? returns.by_first_tool : [];
  byTool.forEach((row) => {
    lines.push([
      'first_tool',
      csvCell(row.first_tool),
      '',
      csvCell(row.visitors),
      csvCell(row.returned_1d),
      csvCell(row.returned_7d),
    ].join(','));
  });
  const bySource = Array.isArray(returns.by_source) ? returns.by_source : [];
  bySource.forEach((row) => {
    lines.push([
      'source',
      csvCell(row.utm_source),
      csvCell(row.segment),
      csvCell(row.visitors),
      csvCell(row.returned_1d),
      csvCell(row.returned_7d),
    ].join(','));
  });
  return lines.join('\n') + '\n';
}

module.exports = {
  EVENTS: EVENTS,
  createMemoryStore: createMemoryStore,
  linkVisitor: linkVisitor,
  normalizeTouch: normalizeTouch,
  parseSegment: parseSegment,
  record: record,
  report: report,
  reportToCsv: reportToCsv,
  resetStore: resetStore,
  resolveRange: resolveRange,
  useMemoryStore: useMemoryStore,
  visitorId: visitorId,
};
