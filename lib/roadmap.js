'use strict';

/**
 * Saved destination roadmaps and artist profiles.
 * Each save appends a row. Users only read and write their own.
 * The owner desk reads every account. Nothing here writes Stripe.
 */

const destination = require('../destination');
const artistProfiles = require('../artist-profiles');
const db = require('./db');

const PLAN_MAX_CHARS = 20000;
const PROFILES_MAX_CHARS = 40000;
const HISTORY_LIMIT = 20;
const SECTION_BUDGET_MS = 7000;

const COUNT_LABELS = {
  '1': '1',
  '2-5': '2 to 5',
  '6+': '6+',
  label: 'Label or manager',
};

let plans = [];
let profiles = [];

function resetStore() {
  plans = [];
  profiles = [];
}

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch {
    return false;
  }
}

function asJson(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function isoDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function clip(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
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

function assertSize(value, max, message) {
  let raw = '';
  try {
    raw = JSON.stringify(value);
  } catch {
    throw validationError('That save could not be read.');
  }
  if (raw.length > max) throw tooLargeError(message);
  return raw.length;
}

function sanitizePlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('A roadmap plan is required.');
  }
  assertSize(input, PLAN_MAX_CHARS, 'That roadmap is too large.');
  const song = destination.SONGS[input.song] ? input.song : '';
  const goal = destination.GOALS[input.goal] ? input.goal : '';
  if (!song || !goal) throw validationError('A song stage and a goal are required.');
  const stops = [];
  (Array.isArray(input.stops) ? input.stops : []).forEach((id) => {
    const key = String(id || '').trim();
    if (destination.STOPS[key] && stops.indexOf(key) === -1 && stops.length < destination.STOP_ORDER.length) {
      stops.push(key);
    }
  });
  const kit = input.kit === 'release' || input.kit === 'record' || input.kit === 'management' ? input.kit : '';
  const record = destination.planRecord({
    song: song,
    goal: goal,
    note: input.note,
    stops: stops,
    kit: kit,
    managed: kit === 'management',
    artistCount: input.artistCount,
    genres: input.genres,
    genreOther: input.genreOther,
  });
  record.genreOther = '';
  const packed = Array.isArray(record.genres) ? record.genres : [];
  const known = [];
  packed.forEach((name) => {
    if (destination && artistProfiles.GENRES.indexOf(name) !== -1) {
      if (known.indexOf(name) === -1) known.push(name);
    } else if (!record.genreOther) {
      record.genreOther = clip(name, 80);
    }
  });
  const explicitOther = clip(input.genreOther, 80);
  if (explicitOther) record.genreOther = explicitOther;
  record.genres = known;
  assertSize(record, PLAN_MAX_CHARS, 'That roadmap is too large.');
  return record;
}

function profilesMeaningful(record) {
  if (!record || typeof record !== 'object') return false;
  if (clip(record.note, 1)) return true;
  if (record.count) return true;
  return (record.artists || []).some((artist) => {
    if (!artist || typeof artist !== 'object') return false;
    if (clip(artist.name, 1) || clip(artist.city, 1) || artist.stage || artist.madeBy) return true;
    if (artist.genre || artist.genreOther || (artist.genres && artist.genres.length)) return true;
    const links = artist.links || {};
    return Object.keys(links).some((key) => clip(links[key], 1));
  });
}

function sanitizeProfiles(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('Artist profiles are required.');
  }
  assertSize(input, PROFILES_MAX_CHARS, 'Those artist profiles are too large.');
  const record = artistProfiles.normalize(input);
  if (record.artists.length > 30) record.artists = record.artists.slice(0, 30);
  if (!profilesMeaningful(record)) throw validationError('Add a name or a detail before saving artist profiles.');
  assertSize(record, PROFILES_MAX_CHARS, 'Those artist profiles are too large.');
  return record;
}

function sameJson(a, b) {
  return JSON.stringify(a || null) === JSON.stringify(b || null);
}

function copyPlanRow(row) {
  const plan = asJson(row && row.plan);
  return {
    id: String((row && row.id) || ''),
    user_id: String((row && row.user_id) || ''),
    plan: plan,
    created_at: isoDate(row && row.created_at),
    updated_at: isoDate(row && (row.updated_at || row.created_at)),
  };
}

function copyProfileRow(row) {
  const saved = asJson(row && row.profiles);
  return {
    id: String((row && row.id) || ''),
    user_id: String((row && row.user_id) || ''),
    profiles: saved,
    created_at: isoDate(row && row.created_at),
    updated_at: isoDate(row && (row.updated_at || row.created_at)),
  };
}

async function ready() {
  if (usingAccountsMemory()) return;
  const accounts = require('./accounts');
  await accounts.ensureReady();
}

async function listPlanRows(userId) {
  await ready();
  const want = String(userId || '');
  if (usingAccountsMemory()) {
    return plans
      .filter((row) => String(row.user_id) === want)
      .map(copyPlanRow)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  const rows = await db.query(
    'SELECT id, user_id, plan, created_at, updated_at FROM roadmap_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [want, HISTORY_LIMIT]
  );
  return rows.map(copyPlanRow).filter((row) => row.plan);
}

async function listProfileRows(userId) {
  await ready();
  const want = String(userId || '');
  if (usingAccountsMemory()) {
    return profiles
      .filter((row) => String(row.user_id) === want)
      .map(copyProfileRow)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  const rows = await db.query(
    'SELECT id, user_id, profiles, created_at, updated_at FROM artist_profile_saves WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [want, HISTORY_LIMIT]
  );
  return rows.map(copyProfileRow).filter((row) => row.profiles);
}

async function listAllPlanRows() {
  await ready();
  if (usingAccountsMemory()) {
    return plans.map(copyPlanRow).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  const rows = await db.query(
    'SELECT id, user_id, plan, created_at, updated_at FROM (SELECT id, user_id, plan, created_at, updated_at, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS n FROM roadmap_plans) ranked WHERE n <= $1 ORDER BY created_at DESC',
    [HISTORY_LIMIT]
  );
  return rows.map(copyPlanRow).filter((row) => row.plan);
}

async function listAllProfileRows() {
  await ready();
  if (usingAccountsMemory()) {
    return profiles.map(copyProfileRow).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  const rows = await db.query(
    'SELECT id, user_id, profiles, created_at, updated_at FROM (SELECT id, user_id, profiles, created_at, updated_at, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS n FROM artist_profile_saves) ranked WHERE n <= $1 ORDER BY created_at DESC',
    [HISTORY_LIMIT]
  );
  return rows.map(copyProfileRow).filter((row) => row.profiles);
}

function publicPlan(row) {
  if (!row || !row.plan) return null;
  return {
    id: row.id,
    saved_at: row.created_at,
    plan: row.plan,
    summary: summarizePlan(row.plan),
  };
}

function publicProfiles(row) {
  if (!row || !row.profiles) return null;
  return {
    id: row.id,
    saved_at: row.created_at,
    profiles: row.profiles,
  };
}

async function readOwnPlan(userId) {
  const rows = await listPlanRows(userId);
  const latest = rows[0] || null;
  return {
    plan: latest ? latest.plan : null,
    summary: latest ? summarizePlan(latest.plan) : null,
    saved_at: latest ? latest.created_at : '',
    history: rows.map(publicPlan),
  };
}

async function readOwnProfiles(userId) {
  const rows = await listProfileRows(userId);
  return {
    profiles: rows[0] ? rows[0].profiles : null,
    saved_at: rows[0] ? rows[0].created_at : '',
    history: rows.map(publicProfiles),
  };
}

async function saveOwnPlan(userId, input) {
  const plan = sanitizePlan(input);
  await ready();
  const existing = await listPlanRows(userId);
  if (existing[0] && sameJson(existing[0].plan, plan)) {
    return { created: false, plan: existing[0].plan, saved_at: existing[0].created_at, history: existing.map(publicPlan) };
  }
  const now = new Date().toISOString();
  if (usingAccountsMemory()) {
    plans.push({
      id: require('crypto').randomUUID(),
      user_id: String(userId),
      plan: JSON.parse(JSON.stringify(plan)),
      created_at: now,
      updated_at: now,
    });
  } else {
    await db.query(
      'INSERT INTO roadmap_plans (user_id, plan) VALUES ($1, $2::jsonb)',
      [String(userId), JSON.stringify(plan)]
    );
  }
  const rows = await listPlanRows(userId);
  return {
    created: true,
    plan: rows[0] ? rows[0].plan : plan,
    saved_at: rows[0] ? rows[0].created_at : now,
    history: rows.map(publicPlan),
  };
}

async function saveOwnProfiles(userId, input) {
  const record = sanitizeProfiles(input);
  await ready();
  const existing = await listProfileRows(userId);
  if (existing[0] && sameJson(existing[0].profiles, record)) {
    return {
      created: false,
      profiles: existing[0].profiles,
      saved_at: existing[0].created_at,
      history: existing.map(publicProfiles),
    };
  }
  const now = new Date().toISOString();
  if (usingAccountsMemory()) {
    profiles.push({
      id: require('crypto').randomUUID(),
      user_id: String(userId),
      profiles: JSON.parse(JSON.stringify(record)),
      created_at: now,
      updated_at: now,
    });
  } else {
    await db.query(
      'INSERT INTO artist_profile_saves (user_id, profiles) VALUES ($1, $2::jsonb)',
      [String(userId), JSON.stringify(record)]
    );
  }
  const rows = await listProfileRows(userId);
  return {
    created: true,
    profiles: rows[0] ? rows[0].profiles : record,
    saved_at: rows[0] ? rows[0].created_at : now,
    history: rows.map(publicProfiles),
  };
}

function summarizePlan(plan) {
  const song = destination.SONGS[plan && plan.song];
  const goal = destination.GOALS[plan && plan.goal];
  const stops = [];
  (plan && Array.isArray(plan.stops) ? plan.stops : []).forEach((id) => {
    const stop = destination.STOPS[id];
    if (stop) stops.push(stop.title);
  });
  const genres = [];
  (plan && Array.isArray(plan.genres) ? plan.genres : []).forEach((name) => {
    const text = clip(name, 80);
    if (text && genres.indexOf(text) === -1) genres.push(text);
  });
  const other = clip(plan && plan.genreOther, 80);
  if (other && genres.indexOf(other) === -1) genres.push(other);
  return {
    goal: goal ? goal.label : '',
    stage: song ? song.label : '',
    stops: stops,
    artist_count: COUNT_LABELS[plan && plan.artistCount] || '',
    genres: genres,
    note: clip(plan && plan.note, destination.NOTE_LIMIT || 240),
    kit: plan && plan.kit ? String(plan.kit) : '',
  };
}

function profileNames(record) {
  const names = [];
  (record && Array.isArray(record.artists) ? record.artists : []).forEach((artist) => {
    const name = clip(artist && artist.name, 80);
    if (name) names.push(name);
  });
  return names;
}

function groupByUser(rows) {
  const grouped = {};
  (rows || []).forEach((row) => {
    const id = String(row.user_id || '');
    if (!id) return;
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(row);
  });
  Object.keys(grouped).forEach((id) => {
    grouped[id].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    grouped[id] = grouped[id].slice(0, HISTORY_LIMIT);
  });
  return grouped;
}

async function listAdminRoadmaps() {
  const accounts = require('./accounts');
  const users = await accounts.listUsers();
  const planGroups = groupByUser(await listAllPlanRows());
  const profileGroups = groupByUser(await listAllProfileRows());
  const seen = {};
  const out = [];
  (users || []).forEach((user) => {
    const id = String(user && user.id || '');
    if (!id || seen[id]) return;
    const planRows = planGroups[id] || [];
    const profileRows = profileGroups[id] || [];
    if (!planRows.length && !profileRows.length) return;
    seen[id] = true;
    const latestPlan = planRows[0] || null;
    const latestProfiles = profileRows[0] || null;
    const summary = summarizePlan(latestPlan && latestPlan.plan);
    out.push({
      user_id: id,
      email: user.email ? String(user.email) : '',
      name: user.artist_name ? String(user.artist_name) : '',
      saved_at: latestPlan ? latestPlan.created_at : '',
      goal: summary.goal,
      stage: summary.stage,
      stops: summary.stops,
      artist_count: summary.artist_count,
      genres: summary.genres,
      note: summary.note,
      kit: summary.kit,
      plan: latestPlan ? latestPlan.plan : null,
      history: planRows.map(publicPlan),
      profiles: latestProfiles ? latestProfiles.profiles : null,
      profile_saved_at: latestProfiles ? latestProfiles.created_at : '',
      profile_names: profileNames(latestProfiles && latestProfiles.profiles),
      profile_history: profileRows.map(publicProfiles),
    });
  });
  out.sort((a, b) => String(b.saved_at || b.profile_saved_at || '').localeCompare(String(a.saved_at || a.profile_saved_at || '')));
  return out;
}

module.exports = {
  HISTORY_LIMIT,
  PLAN_MAX_CHARS,
  PROFILES_MAX_CHARS,
  SECTION_BUDGET_MS,
  listAdminRoadmaps,
  profilesMeaningful,
  readOwnPlan,
  readOwnProfiles,
  resetStore,
  sanitizePlan,
  sanitizeProfiles,
  saveOwnPlan,
  saveOwnProfiles,
  summarizePlan,
};
