'use strict';

/**
 * Plays, finishes, top scores, and the most missed line for a stage game.
 * Simple storage. A basic per-IP limit. Turn off with STAGE_STATS_ENABLED.
 */

const db = require('./db');
const features = require('./features');

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 40;

let rows = [];
const hits = new Map();

function resetStore() {
  rows = [];
  hits.clear();
}

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch (err) {
    return false;
  }
}

function asJson(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }
  return {};
}

function mostMissed(missed) {
  var best = '';
  var count = 0;
  var bag = missed && typeof missed === 'object' ? missed : {};
  Object.keys(bag).forEach(function (key) {
    var n = Number(bag[key]) || 0;
    if (n > count) {
      count = n;
      best = key;
    }
  });
  return best;
}

function levelScores(row) {
  var raw = asJson(row && row.level_scores);
  return {
    1: Number(raw['1'] || raw[1]) || 0,
    2: Number(raw['2'] || raw[2]) || 0,
    3: Number(raw['3'] || raw[3]) || 0,
  };
}

function publicStats(row) {
  if (!row) {
    return { plays: 0, finishes: 0, top_score: 0, most_missed: '', levels: { 1: 0, 2: 0, 3: 0 } };
  }
  return {
    plays: Number(row.plays) || 0,
    finishes: Number(row.finishes) || 0,
    top_score: Number(row.top_score) || 0,
    most_missed: mostMissed(asJson(row.missed)),
    levels: levelScores(row),
  };
}

function allow(ip) {
  var now = Date.now();
  var key = String(ip || 'local');
  var recent = (hits.get(key) || []).filter(function (time) { return now - time < WINDOW_MS; });
  if (recent.length >= LIMIT) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

async function ready() {
  if (usingAccountsMemory()) return;
  const accounts = require('./accounts');
  await accounts.ensureReady();
}

async function readRow(slug) {
  await ready();
  var want = String(slug || '');
  if (usingAccountsMemory()) {
    return rows.find(function (row) { return row.game_slug === want; }) || null;
  }
  var found = await db.query(
    'SELECT game_slug, user_id, plays, finishes, top_score, missed, level_scores FROM stage_stats WHERE game_slug = $1',
    [want]
  );
  return found[0] || null;
}

async function writeRow(row) {
  if (usingAccountsMemory()) {
    var index = rows.findIndex(function (item) { return item.game_slug === row.game_slug; });
    if (index === -1) rows.push(row);
    else rows[index] = row;
    return;
  }
  await db.query(
    'INSERT INTO stage_stats (game_slug, user_id, plays, finishes, top_score, missed, level_scores, updated_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, now()) ON CONFLICT (game_slug) DO UPDATE SET plays = EXCLUDED.plays, finishes = EXCLUDED.finishes, top_score = EXCLUDED.top_score, missed = EXCLUDED.missed, level_scores = EXCLUDED.level_scores, updated_at = now()',
    [row.game_slug, row.user_id, row.plays, row.finishes, row.top_score, JSON.stringify(row.missed || {}), JSON.stringify(row.level_scores || {})]
  );
}

function blank(slug, userId) {
  return {
    game_slug: String(slug || ''),
    user_id: String(userId || ''),
    plays: 0,
    finishes: 0,
    top_score: 0,
    missed: {},
    level_scores: {},
  };
}

async function record(item, event, extra) {
  if (!features.enabled('STAGE_STATS_ENABLED')) return { ok: true, saved: false };
  if (!item || !item.game_slug) {
    var missing = new Error('A game is required.');
    missing.code = 'VALIDATION';
    throw missing;
  }
  var name = String(event || '');
  if (name !== 'play' && name !== 'finish' && name !== 'miss') {
    var bad = new Error('That play update is not recognized.');
    bad.code = 'VALIDATION';
    throw bad;
  }
  var current = await readRow(item.game_slug) || blank(item.game_slug, item.user_id);
  current.user_id = String(item.user_id || current.user_id || '');
  current.missed = asJson(current.missed);
  current.level_scores = asJson(current.level_scores);
  if (name === 'play') current.plays = (Number(current.plays) || 0) + 1;
  if (name === 'finish') {
    current.finishes = (Number(current.finishes) || 0) + 1;
    var score = Math.max(0, Math.min(100000, Number(extra && extra.score) || 0));
    var level = Math.round(Number(extra && extra.level) || 1);
    if (level < 1 || level > 3) level = 1;
    var levelKey = String(level);
    if (score > (Number(current.level_scores[levelKey]) || 0)) current.level_scores[levelKey] = score;
    if (score > (Number(current.top_score) || 0)) current.top_score = score;
  }
  if (name === 'miss') {
    var line = String(extra && extra.line || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    var game = item.game || {};
    var allowed = [].concat(game.hookLines || [], game.lines || []);
    (Array.isArray(game.levels) ? game.levels : []).forEach(function (levelRow) {
      allowed = allowed.concat(levelRow && levelRow.lines || []);
    });
    if (line && allowed.indexOf(line) !== -1) {
      current.missed[line] = (Number(current.missed[line]) || 0) + 1;
    }
  }
  await writeRow(current);
  return { ok: true, saved: true, stats: publicStats(current) };
}

async function forSlugs(slugs) {
  var want = (Array.isArray(slugs) ? slugs : []).map(function (slug) { return String(slug || ''); }).filter(Boolean);
  var out = {};
  if (!features.enabled('STAGE_STATS_ENABLED') || !want.length) return out;
  await ready();
  if (usingAccountsMemory()) {
    want.forEach(function (slug) {
      var row = rows.find(function (item) { return item.game_slug === slug; });
      out[slug] = publicStats(row);
    });
    return out;
  }
  var found = await db.query(
    'SELECT game_slug, user_id, plays, finishes, top_score, missed, level_scores FROM stage_stats WHERE game_slug = ANY($1::text[])',
    [want]
  );
  var bySlug = {};
  found.forEach(function (row) { bySlug[row.game_slug] = row; });
  want.forEach(function (slug) { out[slug] = publicStats(bySlug[slug]); });
  return out;
}

async function removeSlug(slug) {
  var want = String(slug || '');
  if (!want) return;
  await ready();
  if (usingAccountsMemory()) {
    rows = rows.filter(function (row) { return row.game_slug !== want; });
    return;
  }
  await db.query('DELETE FROM stage_stats WHERE game_slug = $1', [want]);
}

module.exports = {
  LIMIT: LIMIT,
  allow: allow,
  forSlugs: forSlugs,
  mostMissed: mostMissed,
  record: record,
  removeSlug: removeSlug,
  resetStore: resetStore,
};
