'use strict';

/**
 * An artist's stage: saved songs, order, and the public tiles.
 * The game config is built here only when SONG_GAME_ENABLED is on.
 */

const crypto = require('crypto');
const db = require('./db');
const features = require('./features');
const songGame = require('./song-game');
const stageStats = require('./stage-stats');

let items = [];

function resetStore() {
  items = [];
}

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch (err) {
    return false;
  }
}

function asJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (err) {
      return fallback;
    }
  }
  return fallback;
}

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  return err;
}

function slugify(value) {
  var slug = String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return slug || 'song';
}

function copyItem(row) {
  return {
    id: String(row.id || ''),
    user_id: String(row.user_id || ''),
    lyric_id: String(row.lyric_id || ''),
    position: Number(row.position) || 0,
    title: String(row.title || ''),
    game_slug: String(row.game_slug || ''),
    artist_slug: String(row.artist_slug || ''),
    artist_name: String(row.artist_name || ''),
    artist_photo: String(row.artist_photo || ''),
    artist_colors: asJson(row.artist_colors, []),
    game: asJson(row.game, null),
  };
}

function publicItem(row, stats) {
  var item = copyItem(row);
  var play = '';
  if (features.enabled('SONG_GAME_ENABLED') && item.game && item.game.hookWords && item.game.hookWords.length) {
    play = '/play/' + item.game_slug;
  }
  var out = {
    id: item.id,
    lyric_id: item.lyric_id,
    title: item.title || (item.game && item.game.title) || 'Untitled',
    position: item.position,
    slug: item.game_slug,
    play: play,
  };
  if (stats) out.stats = stats;
  return out;
}

async function ready() {
  if (usingAccountsMemory()) return;
  const accounts = require('./accounts');
  await accounts.ensureReady();
}

async function listItems(userId) {
  await ready();
  var want = String(userId || '');
  if (usingAccountsMemory()) {
    return items
      .filter(function (row) { return String(row.user_id) === want; })
      .map(copyItem)
      .sort(function (a, b) { return a.position - b.position; });
  }
  var rows = await db.query(
    'SELECT id, user_id, lyric_id, position, title, game_slug, artist_slug, artist_name, artist_photo, artist_colors, game FROM stage_items WHERE user_id = $1 ORDER BY position ASC, created_at ASC',
    [want]
  );
  return rows.map(copyItem);
}

async function bySlug(slug) {
  await ready();
  var want = String(slug || '');
  if (!want) return null;
  if (usingAccountsMemory()) {
    var found = items.find(function (row) { return row.game_slug === want; });
    return found ? copyItem(found) : null;
  }
  var rows = await db.query(
    'SELECT id, user_id, lyric_id, position, title, game_slug, artist_slug, artist_name, artist_photo, artist_colors, game FROM stage_items WHERE game_slug = $1',
    [want]
  );
  return rows[0] ? copyItem(rows[0]) : null;
}

async function slugTaken(slug) {
  var row = await bySlug(slug);
  return Boolean(row);
}

async function makeSlug(title, id) {
  var base = slugify(title);
  var tail = String(id || '').replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase();
  var slug = tail ? base + '-' + tail : base;
  if (!(await slugTaken(slug))) return slug;
  return slug + '-' + crypto.randomBytes(2).toString('hex');
}

function artistSnapshot(artist) {
  var persona = artist && artist.persona && typeof artist.persona === 'object' ? artist.persona : {};
  var look = persona.look && typeof persona.look === 'object' ? persona.look : {};
  var colors = Array.isArray(persona.colors) ? persona.colors.filter(function (hex) {
    return /^#[0-9a-fA-F]{6}$/.test(String(hex || ''));
  }).slice(0, 3) : [];
  var name = String((artist && artist.name) || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  var slug = String(persona.slug || '').trim() || slugify(name);
  if (slug === 'song') slug = slugify(name);
  return {
    artist_slug: slug && slug !== 'song' ? slug : '',
    artist_name: name,
    artist_photo: String(look.photo || (artist && artist.photo) || '').slice(0, 300),
    artist_colors: colors,
  };
}

async function addSong(userId, song, artist) {
  if (!features.enabled('STAGE_ENABLED')) {
    var off = new Error('Stage is turned off.');
    off.code = 'OFF';
    throw off;
  }
  if (!song || !song.id) throw validationError('Choose a saved song first.');
  var existing = await listItems(userId);
  var already = existing.find(function (row) { return row.lyric_id === String(song.id); });
  if (already) return { ok: true, created: false, item: already };
  var snap = artistSnapshot(artist);
  var game = null;
  if (features.enabled('SONG_GAME_ENABLED')) {
    game = songGame.build(song, { colors: snap.artist_colors });
    if (!game.hookWords || game.hookWords.length < 2) {
      throw validationError('This song needs a few more hook words before it can be a game.');
    }
  }
  var id = crypto.randomUUID();
  var slug = await makeSlug(song.title || (game && game.title) || 'song', id);
  var row = {
    id: id,
    user_id: String(userId),
    lyric_id: String(song.id),
    position: existing.length,
    title: String(song.title || (game && game.title) || 'Untitled').slice(0, 80),
    game_slug: slug,
    artist_slug: snap.artist_slug,
    artist_name: snap.artist_name,
    artist_photo: snap.artist_photo,
    artist_colors: snap.artist_colors,
    game: game,
  };
  await ready();
  if (usingAccountsMemory()) {
    items.push(JSON.parse(JSON.stringify(row)));
  } else {
    await db.query(
      'INSERT INTO stage_items (id, user_id, lyric_id, position, title, game_slug, artist_slug, artist_name, artist_photo, artist_colors, game) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)',
      [row.id, row.user_id, row.lyric_id, row.position, row.title, row.game_slug, row.artist_slug, row.artist_name, row.artist_photo, JSON.stringify(row.artist_colors), row.game ? JSON.stringify(row.game) : null]
    );
  }
  return { ok: true, created: true, item: copyItem(row) };
}

async function removeItem(userId, id) {
  var wantUser = String(userId || '');
  var wantId = String(id || '');
  var existing = await listItems(wantUser);
  var found = existing.find(function (row) { return row.id === wantId; });
  if (!found) throw validationError('That song is not on your stage.');
  await ready();
  if (usingAccountsMemory()) {
    items = items.filter(function (row) { return !(String(row.user_id) === wantUser && String(row.id) === wantId); });
    var left = items.filter(function (row) { return String(row.user_id) === wantUser; }).sort(function (a, b) {
      return (Number(a.position) || 0) - (Number(b.position) || 0);
    });
    left.forEach(function (row, index) { row.position = index; });
  } else {
    await db.query('DELETE FROM stage_items WHERE user_id = $1 AND id = $2', [wantUser, wantId]);
    var rest = await listItems(wantUser);
    for (var i = 0; i < rest.length; i += 1) {
      await db.query('UPDATE stage_items SET position = $1, updated_at = now() WHERE id = $2 AND user_id = $3', [i, rest[i].id, wantUser]);
    }
  }
  await stageStats.removeSlug(found.game_slug);
  return { ok: true };
}

async function reorder(userId, ids) {
  var wantUser = String(userId || '');
  var existing = await listItems(wantUser);
  var order = Array.isArray(ids) ? ids.map(function (id) { return String(id || ''); }) : [];
  if (!order.length) throw validationError('Choose the new order first.');
  var known = {};
  existing.forEach(function (row) { known[row.id] = row; });
  var next = [];
  order.forEach(function (id) {
    if (known[id] && next.indexOf(known[id]) === -1) next.push(known[id]);
  });
  existing.forEach(function (row) {
    if (next.indexOf(row) === -1) next.push(row);
  });
  await ready();
  if (usingAccountsMemory()) {
    next.forEach(function (row, index) {
      var live = items.find(function (item) { return String(item.id) === row.id; });
      if (live) live.position = index;
    });
  } else {
    for (var i = 0; i < next.length; i += 1) {
      await db.query('UPDATE stage_items SET position = $1, updated_at = now() WHERE id = $2 AND user_id = $3', [i, next[i].id, wantUser]);
    }
  }
  return listOwn(wantUser);
}

async function listOwn(userId) {
  var rows = await listItems(userId);
  var stats = features.enabled('STAGE_STATS_ENABLED')
    ? await stageStats.forSlugs(rows.map(function (row) { return row.game_slug; }))
    : null;
  return {
    ok: true,
    items: rows.map(function (row) {
      return publicItem(row, stats ? (stats[row.game_slug] || { plays: 0, finishes: 0, top_score: 0, most_missed: '' }) : null);
    }),
  };
}

async function listByArtist(artistSlug) {
  await ready();
  var want = String(artistSlug || '');
  if (!want) return [];
  var rows;
  if (usingAccountsMemory()) {
    rows = items.filter(function (row) { return String(row.artist_slug) === want; }).map(copyItem);
  } else {
    var found = await db.query(
      'SELECT id, user_id, lyric_id, position, title, game_slug, artist_slug, artist_name, artist_photo, artist_colors, game FROM stage_items WHERE artist_slug = $1 ORDER BY position ASC, created_at ASC',
      [want]
    );
    rows = found.map(copyItem);
  }
  rows.sort(function (a, b) { return a.position - b.position; });
  return rows;
}

async function tilesForSlug(artistSlug) {
  if (!features.enabled('STAGE_ENABLED')) return [];
  var rows = await listByArtist(artistSlug);
  return rows.map(function (row) {
    var item = publicItem(row, null);
    return {
      title: item.title,
      slug: item.slug,
      href: item.play,
    };
  });
}

function publicGamePayload(item, artist) {
  var game = item && item.game;
  if (!game || !Array.isArray(game.hookWords) || game.hookWords.length < 2) return null;
  var colors = artist && Array.isArray(artist.colors) && artist.colors.length ? artist.colors : (game.colors || []);
  return {
    ok: true,
    game: {
      slug: item.game_slug,
      title: item.title || game.title || 'Untitled',
      hook: game.hook || '',
      hookLines: Array.isArray(game.hookLines) ? game.hookLines : [],
      hookWords: game.hookWords,
      wordLines: Array.isArray(game.wordLines) ? game.wordLines : [],
      decoys: Array.isArray(game.decoys) ? game.decoys : [],
      colors: Array.isArray(game.colors) ? game.colors : [],
      mood: game.mood || '',
      levels: (Array.isArray(game.levels) ? game.levels : []).map(function (level) {
        return {
          id: level.id,
          label: level.label,
          name: level.name,
          words: level.words || [],
          wordLines: level.wordLines || [],
          lines: level.lines || [],
          hook: level.hook || '',
          decoys: level.decoys || [],
        };
      }),
    },
    artist: {
      name: (artist && artist.name) || item.artist_name || '',
      slug: (artist && artist.slug) || item.artist_slug || '',
      photo: (artist && artist.photo) || item.artist_photo || '',
      colors: colors,
    },
  };
}

module.exports = {
  addSong: addSong,
  artistSnapshot: artistSnapshot,
  bySlug: bySlug,
  listByArtist: listByArtist,
  listOwn: listOwn,
  publicGamePayload: publicGamePayload,
  removeItem: removeItem,
  reorder: reorder,
  resetStore: resetStore,
  tilesForSlug: tilesForSlug,
};
