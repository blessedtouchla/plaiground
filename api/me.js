'use strict';

/**
 * GET  /api/me          session required
 * POST /api/me          session required; store stripe_session_id only
 *                       (plan is set by the signed Stripe webhook, not the client)
 * POST /api/me/catalog  session required; save ToneGrid uuids
 * POST /api/me/profile  session required; save public artist profile on this user
 * POST /api/me/artists  session required; create / link / update Artist Profiles
 *
 * Public URLs stay the same via vercel.json rewrites. One Hobby function.
 */

const { findById, updateCatalog, updateProfile, updateStripe } = require('../lib/accounts');
const artistCheck = require('../lib/artist-check');
const profile = require('../lib/profile');
const {
  attachSession,
  bodyHasPassword,
  isConfigured,
  notConfigured,
  publicUser,
  rejectQueryPassword,
  rejectUnconfirmed,
  sessionFromRequest,
} = require('../lib/auth');
const { pathnameOf, queryValue } = require('../lib/route');
const { isUuid, readBody, sendJson } = require('../lib/tonegrid');

function isCatalog(req) {
  const path = pathnameOf(req);
  if (path === '/api/me/catalog') return true;
  return queryValue(req, 'action') === 'catalog';
}

function isProfile(req) {
  const path = pathnameOf(req);
  if (path === '/api/me/profile') return true;
  return queryValue(req, 'action') === 'profile';
}

function isArtists(req) {
  const path = pathnameOf(req);
  if (path === '/api/me/artists') return true;
  return queryValue(req, 'action') === 'artists';
}

async function loadUser(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return null;
  }
  const session = sessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return null;
  }
  const row = await findById(session.userId);
  if (!row) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return null;
  }
  if (rejectUnconfirmed(res, row)) return null;
  attachSession(req, res, row.id);
  return row;
}

async function updateMembership(req, res, row) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  if (bodyHasPassword(body)) {
    sendJson(res, 400, { error: 'Password is not accepted here.' });
    return;
  }
  const sessionId = String((body && (body.stripe_session_id || body.session_id || body.stripeSessionId)) || '').trim();
  const customerId = String((body && (body.stripe_customer_id || body.customer_id)) || '').trim();
  const next = await updateStripe(row.id, {
    sessionId: sessionId || undefined,
    customerId: customerId || undefined,
  });
  sendJson(res, 200, publicUser(next || row));
}

async function catalog(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (rejectQueryPassword(req, res)) return;
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }

  const session = sessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  if (bodyHasPassword(body)) {
    sendJson(res, 400, { error: 'Password is not accepted here.' });
    return;
  }

  const artistId = String((body && (body.artist_id || body.artistId)) || '').trim();
  const releaseId = String((body && (body.release_id || body.releaseId)) || '').trim();
  const trackId = String((body && (body.track_id || body.trackId)) || '').trim();
  if (artistId && !isUuid(artistId)) {
    sendJson(res, 400, { error: 'artist_id must be a uuid.' });
    return;
  }
  if (releaseId && !isUuid(releaseId)) {
    sendJson(res, 400, { error: 'release_id must be a uuid.' });
    return;
  }
  if (trackId && !isUuid(trackId)) {
    sendJson(res, 400, { error: 'track_id must be a uuid.' });
    return;
  }
  if (!artistId && !releaseId && !trackId) {
    sendJson(res, 400, { error: 'artist_id, release_id, or track_id is required.' });
    return;
  }

  try {
    const row = await findById(session.userId);
    if (!row) {
      sendJson(res, 401, { error: 'Sign in required.' });
      return;
    }
    if (rejectUnconfirmed(res, row)) return;
    attachSession(req, res, row.id);
    const next = await updateCatalog(row.id, {
      artistId: artistId || undefined,
      releaseId: releaseId || undefined,
      trackId: trackId || undefined,
    });
    sendJson(res, 200, publicUser(next || row));
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
}

async function saveProfile(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (rejectQueryPassword(req, res)) return;
  const row = await loadUser(req, res);
  if (!row) return;

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  if (bodyHasPassword(body)) {
    sendJson(res, 400, { error: 'Password is not accepted here.' });
    return;
  }

  const parsed = profile.validate(body, profile.readStored(row));
  if (parsed.error) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }
  const next = await updateProfile(row.id, {
    artist: parsed.artist,
    profile: parsed.profile,
  });
  sendJson(res, 200, publicUser(next || row));
}

function seedRoster(row) {
  return profile.seedFromAccount(
    profile.readStored(row),
    row.artist_name,
    row.tonegrid_artist_id
  );
}

function sameName(a, b) {
  return artistCheck.normalizeName(a) === artistCheck.normalizeName(b);
}

async function persistRoster(row, nextProfile, artistName) {
  return updateProfile(row.id, {
    artist: artistName || row.artist_name,
    profile: nextProfile,
  });
}

async function saveArtists(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (rejectQueryPassword(req, res)) return;
  const row = await loadUser(req, res);
  if (!row) return;

  let stored = seedRoster(row);
  if (req.method === 'GET') {
    if (!(row.profile && row.profile.artists && row.profile.artists.length) && stored.artists.length) {
      const next = await persistRoster(row, stored);
      sendJson(res, 200, publicUser(next || row));
      return;
    }
    sendJson(res, 200, publicUser(row));
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  if (bodyHasPassword(body)) {
    sendJson(res, 400, { error: 'Password is not accepted here.' });
    return;
  }

  const action = String((body && body.action) || 'create').trim().toLowerCase();

  if (action === 'create') {
    const name = String((body && body.name) || '').trim();
    if (!name) {
      sendJson(res, 400, { error: 'Artist name is required.' });
      return;
    }
    const check = artistCheck.checkArtistName(name, { accountArtists: stored.artists });
    const existingSame = (stored.artists || []).find(function (row) { return sameName(row.name, name); });
    if (existingSame && body.confirm_different !== true && check.level !== 'red') {
      const next = await persistRoster(row, stored, row.artist_name);
      sendJson(res, 200, Object.assign(publicUser(next || row), { created: existingSame, check: check, continued: true }));
      return;
    }
    if (check.level === 'yellow' && body.confirm_different !== true) {
      sendJson(res, 409, {
        error: artistCheck.YELLOW_COPY,
        code: 'ARTIST_NAME_YELLOW',
        check: check,
      });
      return;
    }
    const artist = profile.normalizeArtist({
      name: name,
      source: 'created',
      badge: 'PLAIGROUND',
      name_check: check.level === 'empty' ? 'green' : check.level,
      review_status: check.level === 'red' ? 'pending' : '',
      impersonation_confirmed: body.confirm_different === true,
    });
    const nextProfile = profile.upsertArtist(stored, artist);
    const next = await persistRoster(row, nextProfile, stored.artists.length ? row.artist_name : name);
    sendJson(res, 200, Object.assign(publicUser(next || row), { artist: (next || row).artist_name, created: artist, check: check }));
    return;
  }

  if (action === 'link') {
    const parsed = artistCheck.parseStoreLink(body && (body.url || body.link || body.store_url));
    if (!parsed.ok) {
      sendJson(res, 400, { error: 'Paste a Spotify, Apple Music, or store artist link.' });
      return;
    }
    const name = String((body && body.name) || '').trim() || 'Linked artist';
    const artist = profile.normalizeArtist({
      name: name,
      source: 'linked',
      badge: 'Linked',
      store_url: parsed.url,
      spotify_id: parsed.platform === 'spotify' ? parsed.id : '',
      apple_id: parsed.platform === 'apple' ? parsed.id : '',
      name_check: 'green',
      locked: false,
    });
    const nextProfile = profile.upsertArtist(stored, artist);
    const next = await persistRoster(row, nextProfile, stored.artists.length ? row.artist_name : name);
    sendJson(res, 200, Object.assign(publicUser(next || row), { created: artist, check: { level: 'green', skip: true, linked: true } }));
    return;
  }

  if (action === 'update') {
    const id = String((body && (body.id || body.artist_id)) || '').trim();
    const current = profile.findArtist(stored, id);
    if (!current) {
      sendJson(res, 404, { error: 'Artist profile not found.' });
      return;
    }
    const locked = current.locked === true;
    const nextName = body.name !== undefined ? String(body.name || '').trim() : current.name;
    const nextSpotify = body.spotify_id !== undefined ? String(body.spotify_id || '').trim() : current.spotify_id;
    const nextApple = body.apple_id !== undefined ? String(body.apple_id || '').trim() : current.apple_id;
    const nextUrl = body.store_url !== undefined ? String(body.store_url || '').trim() : current.store_url;
    if (locked && (nextName !== current.name || nextSpotify !== current.spotify_id || nextApple !== current.apple_id || nextUrl !== current.store_url)) {
      sendJson(res, 409, {
        error: 'Name and platform IDs are locked after the first successful release. Submit a change request.',
        code: 'ARTIST_LOCKED',
      });
      return;
    }
    let nameCheck = current.name_check;
    if (!locked && nextName !== current.name && current.source !== 'linked') {
      const check = artistCheck.checkArtistName(nextName, { accountArtists: stored.artists, skipId: current.id });
      if (check.level === 'red') {
        sendJson(res, 409, { error: artistCheck.RED_COPY, code: 'ARTIST_NAME_RED', check: check });
        return;
      }
      if (check.level === 'yellow' && body.confirm_different !== true) {
        sendJson(res, 409, { error: artistCheck.YELLOW_COPY, code: 'ARTIST_NAME_YELLOW', check: check });
        return;
      }
      nameCheck = check.level;
    }
    const photo = body.photo !== undefined ? body.photo : current.photo;
    const genres = body.genres !== undefined ? body.genres : current.genres;
    if (body.ai_involvement_percent !== undefined && body.ai_involvement_percent !== null && body.ai_involvement_percent !== '') {
      const pct = Number(body.ai_involvement_percent);
      if (!Number.isFinite(pct) || Math.round(pct) < 0 || Math.round(pct) > 100) {
        sendJson(res, 400, { error: 'AI involvement must be 0–100 or empty.' });
        return;
      }
    }
    if (body.ai_process_detail !== undefined && String(body.ai_process_detail || '').trim().length > profile.MAX_AI_DETAIL) {
      sendJson(res, 400, { error: 'AI process detail must be 500 characters or fewer.' });
      return;
    }
    const artist = profile.normalizeArtist(Object.assign({}, current, {
      name: nextName,
      photo: photo,
      bio: body.bio !== undefined ? body.bio : current.bio,
      genres: genres,
      spotify_id: nextSpotify,
      apple_id: nextApple,
      store_url: nextUrl,
      human_contributions: body.human_contributions !== undefined ? body.human_contributions : current.human_contributions,
      ai_contributions: body.ai_contributions !== undefined ? body.ai_contributions : current.ai_contributions,
      ai_process_detail: body.ai_process_detail !== undefined ? body.ai_process_detail : current.ai_process_detail,
      ai_involvement_percent: body.ai_involvement_percent !== undefined ? body.ai_involvement_percent : current.ai_involvement_percent,
      change_request: body.change_request !== undefined ? body.change_request : current.change_request,
      name_check: nameCheck,
      impersonation_confirmed: body.confirm_different === true || current.impersonation_confirmed,
    }));
    if (artist.photo === '' && photo && String(photo).indexOf('data:image') === 0) {
      sendJson(res, 400, { error: 'Photo must be a JPG or PNG.' });
      return;
    }
    const nextProfile = profile.upsertArtist(stored, artist);
    const next = await persistRoster(row, nextProfile);
    sendJson(res, 200, Object.assign(publicUser(next || row), { updated: artist }));
    return;
  }

  if (action === 'record_release') {
    const nextProfile = profile.upsertRelease(stored, body && (body.release || body));
    const next = await persistRoster(row, nextProfile);
    sendJson(res, 200, publicUser(next || row));
    return;
  }

  if (action === 'attach_tonegrid') {
    const id = String((body && (body.id || body.plaiground_artist_id)) || '').trim();
    const current = profile.findArtist(stored, id);
    if (!current) {
      sendJson(res, 404, { error: 'Artist profile not found.' });
      return;
    }
    const artist = profile.normalizeArtist(Object.assign({}, current, {
      tonegrid_artist_id: String((body && body.tonegrid_artist_id) || '').trim(),
    }));
    const next = await persistRoster(row, profile.upsertArtist(stored, artist));
    sendJson(res, 200, publicUser(next || row));
    return;
  }

  sendJson(res, 400, { error: 'Unknown artist action.' });
}

module.exports = async function handler(req, res) {
  if (isCatalog(req)) {
    await catalog(req, res);
    return;
  }
  if (isArtists(req)) {
    await saveArtists(req, res);
    return;
  }
  if (isProfile(req)) {
    await saveProfile(req, res);
    return;
  }
  if (rejectQueryPassword(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  try {
    const row = await loadUser(req, res);
    if (!row) return;
    if (req.method === 'POST') {
      await updateMembership(req, res, row);
      return;
    }
    sendJson(res, 200, publicUser(row));
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
};
