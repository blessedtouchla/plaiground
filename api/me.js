'use strict';

/**
 * GET  /api/me          session required
 * POST /api/me          session required; store stripe_session_id and, when the
 *                       Checkout Session is paid, write Creator/Pro on this row.
 *                       Client-sent plan is ignored. Webhook is the other writer.
 * POST /api/me/catalog  session required; save ToneGrid uuids
 * POST /api/me/profile  session required; save public artist profile on this user
 * POST /api/me/artists  session required; create / link / update Artist Profiles.
 *                       Rewrite query uses resource=artists so it cannot clobber
 *                       the JSON verb (update / delete / create).
 * POST /api/me/problem  session required; emails emailplaiground via Resend.
 * GET  /api/admin/signups  owner session only; signups, paid rows, store rows, growth events
 *
 * Public URLs stay the same via vercel.json rewrites. One Hobby function.
 */

const { listAdminOverview } = require('../lib/admin-overview');
const { findById, updateCatalog, updateProfile, updateStripe } = require('../lib/accounts');
const artistCheck = require('../lib/artist-check');
const artistMappingPush = require('../lib/artist-mapping-push');
const platformLinks = require('../lib/platform-links');
const profile = require('../lib/profile');
const releaseCredits = require('../lib/release-credits');
const {
  attachSession,
  bodyHasPassword,
  hasStaffProOverride,
  isConfigured,
  normalizePaidPlan,
  notConfigured,
  publicUser,
  rejectQueryPassword,
  rejectUnconfirmed,
  sessionFromRequest,
} = require('../lib/auth');
const { MAIL_NOT_CONFIGURED, sendProblemReport } = require('../lib/mail');
const { applyPaidSessionToAccount, recoverPaidPlan } = require('../lib/stripe-webhook');
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
  return queryValue(req, 'action') === 'artists' || queryValue(req, 'resource') === 'artists';
}

const ROUTE_ACTIONS = { artists: true, catalog: true, profile: true, problem: true, 'admin-signups': true };

function artistVerb(body) {
  const explicit = String((body && body.artist_action) || '').trim().toLowerCase();
  if (explicit && !ROUTE_ACTIONS[explicit]) return explicit;
  const raw = String((body && body.action) || '').trim().toLowerCase();
  if (raw && !ROUTE_ACTIONS[raw]) return raw;
  if (body && body.release) return 'record_release';
  if (
    body
    && String((body.tonegrid_artist_id || '')).trim()
    && (body.id || body.plaiground_artist_id)
    && body.bio === undefined
    && body.name === undefined
    && body.photo === undefined
  ) {
    return 'attach_tonegrid';
  }
  if (body && (body.url || body.link) && !(body.id || body.artist_id)) return 'link';
  if (body && (body.id || body.artist_id)) return 'update';
  return 'create';
}

function isAdminSignups(req) {
  const path = pathnameOf(req);
  if (path === '/api/admin/signups' || path === '/api/me/admin/signups') return true;
  return queryValue(req, 'action') === 'admin-signups';
}

function isProblem(req) {
  const path = pathnameOf(req);
  if (path === '/api/me/problem') return true;
  return queryValue(req, 'action') === 'problem';
}

async function adminSignups(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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
  try {
    const row = await findById(session.userId);
    if (!row) {
      sendJson(res, 401, { error: 'Sign in required.' });
      return;
    }
    if (rejectUnconfirmed(res, row)) return;
    if (!hasStaffProOverride(row.email)) {
      sendJson(res, 403, { error: 'Not allowed.' });
      return;
    }
    attachSession(req, res, row.id);
    const overview = await listAdminOverview();
    sendJson(res, 200, overview);
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
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
  if (sessionId) {
    const applied = await applyPaidSessionToAccount(sessionId, row);
    if (applied.applied && applied.row) {
      sendJson(res, 200, publicUser(applied.row));
      return;
    }
  }
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
  try {
    const next = await updateProfile(row.id, {
      artist: parsed.artist,
      profile: parsed.profile,
    });
    sendJson(res, 200, publicUser(next || row));
  } catch (err) {
    if (err && err.code === 'USERNAME_TAKEN') {
      sendJson(res, 409, { error: err.message, code: 'USERNAME_TAKEN' });
      return;
    }
    if (err && err.code === 'VALIDATION') {
      sendJson(res, 400, { error: err.message });
      return;
    }
    throw err;
  }
}

function seedRoster(row) {
  return profile.recoverRoster(
    profile.readStored(row),
    row.artist_name,
    row.tonegrid_artist_id
  );
}

function shouldPersistRecoveredRoster(row, stored) {
  const have = profile.readStored(row).artists || [];
  const next = stored && Array.isArray(stored.artists) ? stored.artists : [];
  return have.length === 0 && next.length > 0;
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

async function pushSavedArtistMapping(res, row, artist, extras) {
  const push = await artistMappingPush.pushArtistMapping({
    artist: artist,
    onlyIfNull: false,
  });
  if (push.skipped || push.ok) return false;
  sendJson(res, 502, Object.assign(publicUser(row), extras || {}, {
    error: artistMappingPush.FAIL_COPY,
    mapping_error: true,
  }));
  return true;
}

async function backfillLinkedMappings(stored) {
  try {
    await artistMappingPush.backfillRosterMappings(stored);
  } catch (err) {
    console.error(artistMappingPush.LOG_PREFIX, {
      artist_id: '',
      status: 0,
      error: err && err.message,
      fields: ['backfill'],
    });
  }
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
    if (shouldPersistRecoveredRoster(row, stored)) {
      const next = await persistRoster(row, stored);
      await backfillLinkedMappings(stored);
      sendJson(res, 200, publicUser(next || row));
      return;
    }
    await backfillLinkedMappings(stored);
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

  const action = artistVerb(body);

  if (action === 'create') {
    const name = String((body && body.name) || '').trim();
    if (!name) {
      sendJson(res, 400, { error: 'Artist name is required.' });
      return;
    }
    const legal = releaseCredits.validateLegalName(body && body.legal_first, body && body.legal_last);
    if (legal.error) {
      sendJson(res, 400, { error: legal.error });
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
      legal_first: body && body.legal_first,
      legal_last: body && body.legal_last,
    });
    const nextProfile = profile.upsertArtist(stored, artist);
    const next = await persistRoster(row, nextProfile, stored.artists.length ? row.artist_name : name);
    sendJson(res, 200, Object.assign(publicUser(next || row), { artist: (next || row).artist_name, created: artist, check: check }));
    return;
  }

  if (action === 'link') {
    let parsed = null;
    const url = body && (body.url || body.link || body.store_url);
    const platform = body && body.platform;
    if (platform && url) {
      const matched = platformLinks.matchPlatformValue(platform, url);
      if (matched.ok) parsed = matched;
    }
    if (!parsed || !parsed.ok) {
      parsed = artistCheck.parseStoreLink(url);
    }
    if ((!parsed || !parsed.ok) && url) {
      const guessed = platformLinks.guessPlatformFromUrl(url);
      if (guessed) parsed = platformLinks.matchPlatformValue(guessed.slug, url);
    }
    let links = [];
    if (body && body.platform_links !== undefined) {
      const checked = platformLinks.validateList(body.platform_links);
      if (checked.error) {
        sendJson(res, 400, { error: checked.error });
        return;
      }
      links = checked.links || [];
      if (!parsed || !parsed.ok) parsed = links[0] || parsed;
    }
    if (!parsed || !parsed.ok) {
      sendJson(res, 400, { error: 'Paste a store artist link.' });
      return;
    }
    if (!links.length) {
      links = [{
        platform: parsed.platform,
        id: parsed.id || '',
        url: parsed.url || url,
        value: parsed.url || url,
      }];
    }
    const name = String((body && body.name) || '').trim() || 'Linked artist';
    const artist = profile.normalizeArtist({
      name: name,
      source: 'linked',
      badge: 'Linked',
      store_url: parsed.url,
      spotify_id: parsed.platform === 'spotify' ? parsed.id : '',
      apple_id: (parsed.platform === 'apple' || parsed.platform === 'apple-music') ? parsed.id : '',
      platform_links: links,
      name_check: 'green',
      locked: false,
    });
    const nextProfile = profile.upsertArtist(stored, artist);
    const next = await persistRoster(row, nextProfile, stored.artists.length ? row.artist_name : name);
    const linkedPayload = Object.assign(publicUser(next || row), { created: artist, check: { level: 'green', skip: true, linked: true } });
    if (await pushSavedArtistMapping(res, next || row, artist, linkedPayload)) return;
    sendJson(res, 200, linkedPayload);
    return;
  }

  if (action === 'delete') {
    const id = String((body && (body.id || body.artist_id)) || '').trim();
    const current = profile.resolveArtist(stored, id, body && body.name);
    if (!current) {
      sendJson(res, 404, { error: 'Artist profile not found.' });
      return;
    }
    const blocked = profile.artistHasBlockingRelease(stored, current);
    if (blocked) {
      sendJson(res, 409, Object.assign(publicUser(row), {
        error: 'This artist still has a live or pending store release. The store / the distributor cannot delete it.',
        code: 'ARTIST_HAS_STORE_RELEASE',
        release_status: blocked.tonegrid_status || blocked.status || '',
      }));
      return;
    }
    const nextProfile = profile.removeArtist(stored, current.id);
    const next = await persistRoster(row, nextProfile);
    sendJson(res, 200, Object.assign(publicUser(next || row), { deleted: { id: current.id } }));
    return;
  }

  if (action === 'update' || action === 'submit_edit') {
    const id = String((body && (body.id || body.artist_id)) || '').trim();
    const current = profile.resolveArtist(stored, id, body && body.name);
    if (!current) {
      sendJson(res, 404, { error: 'Artist profile not found.' });
      return;
    }
    const locked = current.locked === true;
    const nextName = body.name !== undefined ? String(body.name || '').trim() : current.name;
    const nextSpotify = body.spotify_id !== undefined ? String(body.spotify_id || '').trim() : current.spotify_id;
    const nextApple = body.apple_id !== undefined ? String(body.apple_id || '').trim() : current.apple_id;
    const nextUrl = body.store_url !== undefined ? String(body.store_url || '').trim() : current.store_url;
    let nextLinks = current.platform_links;
    if (!locked && body.platform_links !== undefined) {
      const checked = platformLinks.validateList(body.platform_links);
      if (checked.error) {
        sendJson(res, 400, { error: checked.error });
        return;
      }
      nextLinks = checked.links;
    }
    let nameCheck = current.name_check;
    const applyName = !locked;
    if (applyName && nextName !== current.name && current.source !== 'linked') {
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
    if (body.photo !== undefined) {
      const photoCheck = profile.sanitizePhoto(photo);
      if (photoCheck && photoCheck.error) {
        sendJson(res, 400, { error: photoCheck.error });
        return;
      }
    }
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
      name: applyName ? nextName : current.name,
      photo: photo,
      bio: body.bio !== undefined ? body.bio : current.bio,
      genres: genres,
      spotify_id: applyName ? nextSpotify : current.spotify_id,
      apple_id: applyName ? nextApple : current.apple_id,
      store_url: applyName ? nextUrl : current.store_url,
      platform_links: applyName
        ? (body.platform_links !== undefined
          ? nextLinks
          : ((body.spotify_id !== undefined || body.apple_id !== undefined || body.store_url !== undefined)
            ? undefined
            : current.platform_links))
        : current.platform_links,
      human_contributions: body.human_contributions !== undefined ? body.human_contributions : current.human_contributions,
      ai_contributions: body.ai_contributions !== undefined ? body.ai_contributions : current.ai_contributions,
      ai_process_detail: body.ai_process_detail !== undefined ? body.ai_process_detail : current.ai_process_detail,
      ai_involvement_percent: body.ai_involvement_percent !== undefined ? body.ai_involvement_percent : current.ai_involvement_percent,
      change_request: body.change_request !== undefined ? body.change_request : current.change_request,
      legal_first: body.legal_first !== undefined ? body.legal_first : current.legal_first,
      legal_last: body.legal_last !== undefined ? body.legal_last : current.legal_last,
      name_check: nameCheck,
      impersonation_confirmed: body.confirm_different === true || current.impersonation_confirmed,
      edit_status: '',
      pending_edit: null,
    }));
    if (artist.photo === '' && photo && String(photo).indexOf('data:image') === 0) {
      sendJson(res, 400, { error: 'Photo must be a JPG or PNG.' });
      return;
    }
    const nextProfile = profile.upsertArtist(stored, artist);
    const next = await persistRoster(row, nextProfile);
    const updatedPayload = Object.assign(publicUser(next || row), {
      updated: artist,
      submitted_edit: false,
    });
    if (await pushSavedArtistMapping(res, next || row, artist, updatedPayload)) return;
    sendJson(res, 200, updatedPayload);
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
    const current = profile.resolveArtist(stored, id, body && body.name);
    if (!current) {
      sendJson(res, 404, { error: 'Artist profile not found.' });
      return;
    }
    const artist = profile.normalizeArtist(Object.assign({}, current, {
      tonegrid_artist_id: String((body && body.tonegrid_artist_id) || '').trim(),
    }));
    const next = await persistRoster(row, profile.upsertArtist(stored, artist));
    if (await pushSavedArtistMapping(res, next || row, artist, publicUser(next || row))) return;
    sendJson(res, 200, publicUser(next || row));
    return;
  }

  sendJson(res, 400, { error: 'Unknown artist action.' });
}

async function reportProblem(req, res) {
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

  const problem = String((body && (body.problem || body.text || body.message)) || '').trim();
  if (!problem) {
    sendJson(res, 400, { error: 'Describe the problem.' });
    return;
  }

  let mail;
  try {
    mail = await sendProblemReport({
      email: row.email,
      problem,
      release: body && (body.release || body.release_id),
      artist: body && (body.artist || body.artist_id),
    });
  } catch {
    mail = { mail_sent: false, error: 'Could not send the problem report.' };
  }

  if (!mail || !mail.mail_sent) {
    const error = (mail && mail.error) || MAIL_NOT_CONFIGURED;
    const status = error === MAIL_NOT_CONFIGURED ? 503 : 502;
    sendJson(res, status, { ok: false, mail_sent: false, error });
    return;
  }

  sendJson(res, 200, { ok: true, mail_sent: true });
}

module.exports = async function handler(req, res) {
  if (isAdminSignups(req)) {
    await adminSignups(req, res);
    return;
  }
  if (isProblem(req)) {
    await reportProblem(req, res);
    return;
  }
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
    let next = row;
    if (!normalizePaidPlan(row.plan, row.email)) {
      next = await recoverPaidPlan(row);
    }
    const stored = seedRoster(next || row);
    if (shouldPersistRecoveredRoster(next || row, stored)) {
      next = await persistRoster(next || row, stored);
    }
    await backfillLinkedMappings(stored);
    sendJson(res, 200, publicUser(next || row));
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      notConfigured(res);
      return;
    }
    sendJson(res, 503, { error: 'Accounts are not configured.' });
  }
};
