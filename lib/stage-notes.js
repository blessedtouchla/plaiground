'use strict';

/**
 * A short note for fans who already played, when the artist adds a song.
 * Shown on the stage page and on the play page. Turn off with the stage or stats flag.
 */

const db = require('./db');
const features = require('./features');
const stage = require('./stage');

let fans = [];

function resetStore() {
  fans = [];
}

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch (err) {
    return false;
  }
}

function asList(value) {
  if (Array.isArray(value)) return value.map(function (item) { return String(item || ''); }).filter(Boolean);
  if (typeof value === 'string') {
    try {
      var parsed = JSON.parse(value);
      return Array.isArray(parsed) ? asList(parsed) : [];
    } catch (err) {
      return [];
    }
  }
  return [];
}

function asTold(value) {
  var raw = value;
  if (typeof value === 'string') {
    try { raw = JSON.parse(value); } catch (err) { raw = {}; }
  }
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    stage: asList(raw.stage),
    play: asList(raw.play),
  };
}

function enabled() {
  return features.enabled('STAGE_ENABLED') && features.enabled('STAGE_STATS_ENABLED');
}

function fanKey(fan, ip) {
  var id = String(fan || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
  if (id) return 'fan:' + id;
  return 'ip:' + String(ip || 'local').slice(0, 80);
}

function noteText(name) {
  var clean = String(name || 'this artist').replace(/\s+/g, ' ').trim().slice(0, 40) || 'this artist';
  return 'New on ' + clean + "'s stage";
}

async function ready() {
  if (usingAccountsMemory()) return;
  const accounts = require('./accounts');
  await accounts.ensureReady();
}

async function readFan(key, artistSlug) {
  await ready();
  if (usingAccountsMemory()) {
    return fans.find(function (row) {
      return row.fan_key === key && row.artist_slug === artistSlug;
    }) || null;
  }
  var found = await db.query(
    'SELECT fan_key, artist_slug, known, seen, told FROM stage_fans WHERE fan_key = $1 AND artist_slug = $2',
    [key, artistSlug]
  );
  return found[0] || null;
}

async function writeFan(row) {
  await ready();
  if (usingAccountsMemory()) {
    var index = fans.findIndex(function (item) {
      return item.fan_key === row.fan_key && item.artist_slug === row.artist_slug;
    });
    if (index === -1) fans.push(row);
    else fans[index] = row;
    return;
  }
  await db.query(
    'INSERT INTO stage_fans (fan_key, artist_slug, known, seen, told, updated_at) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, now()) ON CONFLICT (fan_key, artist_slug) DO UPDATE SET known = EXCLUDED.known, seen = EXCLUDED.seen, told = EXCLUDED.told, updated_at = now()',
    [row.fan_key, row.artist_slug, JSON.stringify(row.known || []), JSON.stringify(row.seen || []), JSON.stringify(row.told || {})]
  );
}

async function rememberPlay(opts) {
  if (!enabled()) return;
  var artistSlug = String(opts && opts.artist || '');
  var gameSlug = String(opts && opts.slug || '');
  if (!artistSlug || !gameSlug) return;
  var key = fanKey(opts.fan, opts.ip);
  var songs = await stage.listByArtist(artistSlug);
  var slugs = songs.map(function (row) { return row.game_slug; }).filter(Boolean);
  var current = await readFan(key, artistSlug);
  if (!current) {
    current = {
      fan_key: key,
      artist_slug: artistSlug,
      known: slugs.slice(),
      seen: [],
      told: { stage: [], play: [] },
    };
  } else {
    current.known = asList(current.known);
    current.seen = asList(current.seen);
    current.told = asTold(current.told);
  }
  if (current.seen.indexOf(gameSlug) === -1) current.seen.push(gameSlug);
  await writeFan(current);
}

async function notice(opts) {
  if (!enabled()) return '';
  var artistSlug = String(opts && opts.artist || '');
  if (!artistSlug) return '';
  var surface = opts && opts.surface === 'stage' ? 'stage' : 'play';
  var key = fanKey(opts.fan, opts.ip);
  var current = await readFan(key, artistSlug);
  if (!current) return '';
  var known = asList(current.known);
  var seen = asList(current.seen);
  var told = asTold(current.told);
  var songs = await stage.listByArtist(artistSlug);
  var fresh = songs.filter(function (row) {
    return row.game_slug && known.indexOf(row.game_slug) === -1 && seen.indexOf(row.game_slug) === -1;
  });
  var pending = fresh.filter(function (row) { return told[surface].indexOf(row.game_slug) === -1; });
  if (!pending.length) return '';
  pending.forEach(function (row) { told[surface].push(row.game_slug); });
  current.known = known;
  current.seen = seen;
  current.told = told;
  await writeFan(current);
  var name = songs[0] && songs[0].artist_name;
  return noteText(name);
}

module.exports = {
  noteText: noteText,
  notice: notice,
  rememberPlay: rememberPlay,
  resetStore: resetStore,
};
