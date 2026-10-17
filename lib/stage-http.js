'use strict';

/**
 * Signed-in stage routes and the public play route.
 * Both ride on the existing /api/me function.
 */

const { findById } = require('./accounts');
const {
  attachSession,
  bodyHasPassword,
  isConfigured,
  notConfigured,
  rejectQueryPassword,
  rejectUnconfirmed,
  sessionFromRequest,
} = require('./auth');
const features = require('./features');
const lyrics = require('./lyrics');
const profile = require('./profile');
const stage = require('./stage');
const stageStats = require('./stage-stats');
const { readBody, sendJson } = require('./tonegrid');

function clientIp(req) {
  var headers = req && req.headers ? req.headers : {};
  var fwd = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  if (fwd) return String(fwd).split(',')[0].trim() || 'local';
  return 'local';
}

function artistFor(row) {
  var stored = profile.readStored(row) || {};
  var artists = Array.isArray(stored.artists) ? stored.artists : [];
  var published = artists.find(function (artist) {
    return artist && artist.persona && artist.persona.published === true;
  });
  var withPersona = artists.find(function (artist) { return artist && artist.persona; });
  return published || withPersona || artists[0] || null;
}

function freshArtist(row, item) {
  var artist = artistFor(row);
  var snap = stage.artistSnapshot(artist);
  if (!item) return snap;
  return {
    name: snap.artist_name || item.artist_name || '',
    slug: snap.artist_slug || item.artist_slug || '',
    photo: snap.artist_photo || item.artist_photo || '',
    colors: (snap.artist_colors && snap.artist_colors.length) ? snap.artist_colors : (item.artist_colors || []),
  };
}

async function loadUser(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return null;
  }
  var session = sessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return null;
  }
  var row = await findById(session.userId);
  if (!row) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return null;
  }
  if (rejectUnconfirmed(res, row)) return null;
  attachSession(req, res, row.id);
  return row;
}

async function handleStage(req, res) {
  if (!features.enabled('STAGE_ENABLED')) {
    sendJson(res, 404, { error: 'Stage is turned off.' });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (rejectQueryPassword(req, res)) return;
  var row = await loadUser(req, res);
  if (!row) return;
  try {
    if (req.method === 'GET') {
      sendJson(res, 200, await stage.listOwn(row.id));
      return;
    }
    var body = await readBody(req);
    if (bodyHasPassword(body)) {
      sendJson(res, 400, { error: 'Password is not accepted here.' });
      return;
    }
    var action = String((body && body.action) || 'add').trim().toLowerCase();
    if (action === 'remove') {
      await stage.removeItem(row.id, body && body.id);
      sendJson(res, 200, await stage.listOwn(row.id));
      return;
    }
    if (action === 'reorder') {
      sendJson(res, 200, await stage.reorder(row.id, body && body.ids));
      return;
    }
    var listed = await lyrics.listOwn(row.id);
    var songs = listed && Array.isArray(listed.songs) ? listed.songs : [];
    var song = songs.find(function (item) { return item && String(item.id) === String(body && body.lyric_id || ''); });
    if (!song) {
      sendJson(res, 404, { error: 'That song is not in your saved lyrics.' });
      return;
    }
    var saved = await stage.addSong(row.id, song, artistFor(row));
    var board = await stage.listOwn(row.id);
    var item = (board.items || []).find(function (entry) { return entry.id === saved.item.id; }) || null;
    sendJson(res, 200, { ok: true, created: saved.created, item: item, items: board.items });
  } catch (err) {
    if (err && (err.code === 'VALIDATION' || err.code === 'OFF')) {
      sendJson(res, 400, { error: err.message });
      return;
    }
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'The stage did not save just now.' });
  }
}

async function handlePlay(req, res) {
  if (!features.enabled('SONG_GAME_ENABLED')) {
    sendJson(res, 404, { error: 'This game is turned off right now.' });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  try {
    if (req.method === 'GET') {
      var slug = '';
      try {
        slug = new URL(req.url || '/', 'http://localhost').searchParams.get('slug')
          || new URL(req.url || '/', 'http://localhost').searchParams.get('song')
          || '';
      } catch (err) {
        slug = '';
      }
      var item = await stage.bySlug(slug);
      if (!item) {
        sendJson(res, 404, { error: 'This game is not ready yet.' });
        return;
      }
      var owner = null;
      try { owner = await findById(item.user_id); } catch (err) { owner = null; }
      var payload = stage.publicGamePayload(item, owner ? freshArtist(owner, item) : null);
      if (!payload) {
        sendJson(res, 404, { error: 'This game is not ready yet.' });
        return;
      }
      sendJson(res, 200, payload);
      return;
    }
    if (!features.enabled('STAGE_STATS_ENABLED')) {
      sendJson(res, 200, { ok: true, saved: false });
      return;
    }
    if (!stageStats.allow(clientIp(req))) {
      sendJson(res, 429, { error: 'Slow down a moment, then try the game again.' });
      return;
    }
    var body = await readBody(req);
    var played = await stage.bySlug(body && body.slug);
    if (!played) {
      sendJson(res, 404, { error: 'This game is not ready yet.' });
      return;
    }
    var saved = await stageStats.record(played, body && body.event, {
      score: body && body.score,
      line: body && body.line,
    });
    sendJson(res, 200, saved);
  } catch (err) {
    if (err && err.code === 'VALIDATION') {
      sendJson(res, 400, { error: err.message });
      return;
    }
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'The game did not load just now.' });
  }
}

module.exports = {
  handlePlay: handlePlay,
  handleStage: handleStage,
};
