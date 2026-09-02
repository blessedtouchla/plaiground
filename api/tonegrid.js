'use strict';

/**
 * ToneGrid proxy. Public URLs stay the same via vercel.json rewrites. One Hobby function.
 *
 * GET  /api/tonegrid/health
 * GET  /api/tonegrid/stores
 * GET  /api/tonegrid/artists
 * POST /api/tonegrid/artists
 * GET  /api/tonegrid/releases
 * POST /api/tonegrid/releases
 * GET  /api/tonegrid/releases/:id          -> plus ddex/deliveries when live (dsp_release_id only)
 * PUT  /api/tonegrid/releases/:id          -> ToneGrid PATCH /releases/:uuid (edit in place)
 * DELETE /api/tonegrid/releases/:id        -> draft / rejected / not-live: store DELETE
 *                                         must succeed (or 404 gone) BEFORE dropLocal;
 *                                         live / pending / processing: takedown/cancel only,
 *                                         never 200-removed while the store still has the row
 * POST /api/tonegrid/releases/:id/submit   -> skipped when already pending/approved/live
 *                                         made_how ai_assisted/fully_ai PATCHes
 *                                         includes_ai on each track; no_ai omits it
 * POST /api/tonegrid/releases/:id/dsps
 * PUT  /api/tonegrid/releases/:id/dsps     -> ToneGrid PUT /releases/:uuid/dsps
 * POST /api/tonegrid/releases/:id/artwork  -> ToneGrid POST /releases/:uuid/artwork
 * POST /api/tonegrid/tracks
 * PUT  /api/tonegrid/tracks/:id            -> ToneGrid PATCH /tracks/:uuid
 * POST /api/tonegrid/tracks/:id/audio  -> JSON { object_key } (preferred) or leftover multipart
 *   Hop-to-store: pull the private object. Already-WAV/FLAC skips convert
 *   and gets the full store-forward timeout. MP3 converts once, then
 *   forwards with the full store-forward timeout. Wrap as multipart field `audio`
 *   with a real audio MIME. Leftover multipart under the platform hop cap
 *   goes through as one body. Over that cap leftover clients may send
 *   x-plaiground-chunk-* parts; this function assembles, converts MP3 → WAV,
 *   then hops once.
 * POST /api/tonegrid/uploads           -> mint a short-lived PUT for audio/ or covers/
 * GET  /api/tonegrid/uploads?key=      -> owner-only signed GET helper
 * GET  /api/tonegrid/analytics
 * GET  /api/tonegrid/royalties
 *
 * ToneGrid itself (api-docs + sandbox probe): PATCH /releases/:uuid — PUT
 * 404s "Endpoint not found." DELETE /releases/:uuid soft-deletes a draft or rejected
 * release. Never 200-removed while the store still has the row. Live / pending /
 * processing stay takedown/cancel (never fake-delete). Never drop a live store
 * release locally when the store refuses.
 * POST and PUT /releases/:uuid/dsps exist. POST
 * /releases/:uuid/submit exists. GET /releases/:uuid/dsps is not registered.
 * Each ToneGrid write uses a hop-scoped Idempotency-Key (release, track,
 * patch-date, dsps-post, dsps-put, submit) plus method, path, body
 * fingerprint, and a rotated browser key when present. Never forward the
 * browser plaiground-submit-<id> key to every hop.
 * Server-only env: TONEGRID_API_KEY, TONEGRID_BASE_URL (never echo these).
 * Solo 100% submit skips SignWell. Multi-writer submit creates or reuses a
 * SignWell document and emails other writers, then submits to ToneGrid without
 * waiting for every signature. Never call /distribute or /approve.
 */

const crypto = require('crypto');
const accounts = require('../lib/accounts');
const artistCheck = require('../lib/artist-check');
const plans = require('../lib/plans');
const coverUrl = require('../lib/cover-url');
const profileLib = require('../lib/profile');
const signwell = require('../lib/signwell');
const signwellApi = require('./signwell');
const splitSheets = require('../lib/split-sheets');
const uploadRequired = require('../lib/upload-required');
const storeCredits = require('../lib/store-credits');
const storeAi = require('../lib/store-ai');
const audioConvert = require('../lib/audio-convert');
const audioChunks = require('../lib/audio-chunks');
const livePlayer = require('../lib/live-player');
const growthEvents = require('../lib/growth-events');
const objectStore = require('../lib/object-store');
const { personalScope, idAllowed, rejectHold, allowedSet, releaseIdsFrom } = require('../lib/scope');
const { pathnameOf, queryOf, queryValue } = require('../lib/route');
const {
  DOCUMENTED_DSPS,
  LIST_HOP_TIMEOUT_MS,
  STORE_FORWARD_TIMEOUT_MS,
  storeForwardTimeoutMs,
  RELEASE_TYPES,
  SUBMITTABLE,
  YOUTUBE_MUSIC_SLUG,
  documentedStores,
  headerValue,
  healthPayload,
  deriveSlug,
  hopIdempotencyKey,
  idempotencyKey,
  ARTIST_GONE_COPY,
  isArtistGoneError,
  isConfigured,
  isUuid,
  minSubmitDate,
  normalizeCountry,
  normalizeLanguage,
  normalizeReleaseDate,
  normalizeReleaseType,
  notConfigured,
  parseStoreListMeta,
  parseStoreRows,
  parseStoreSlugs,
  readBody,
  sendJson,
  tonegridFetch,
  withYouTubeMusic,
} = require('../lib/tonegrid');

const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_AUDIO_TRANSIT_BYTES = 512 * 1024 * 1024;
const AUDIO_SIZE_COPY = 'Audio must be 200 MB or smaller.';
const AUDIO_SEND_COPY = 'We could not send the audio.';
const MAX_ARTWORK_BYTES = 15 * 1024 * 1024;
const LIST_STATUSES = new Set(['draft', 'pending', 'approved', 'live', 'taken_down']);
const STORE_FACING = new Set([
  'delivered',
  'live',
]);
const CANCEL_FIRST = new Set(['pending', 'pending_review', 'qc_inspection', 'approved', 'processing', 'delivering']);

function decodePart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function routeOf(req) {
  const path = pathnameOf(req);
  let match = path.match(/\/tonegrid\/releases\/([^/]+)\/submit$/i);
  if (match) return { resource: 'submit', id: decodePart(match[1]) };
  match = path.match(/\/tonegrid\/releases\/([^/]+)\/dsps$/i);
  if (match) return { resource: 'dsps', id: decodePart(match[1]) };
  match = path.match(/\/tonegrid\/releases\/([^/]+)\/artwork$/i);
  if (match) return { resource: 'artwork', id: decodePart(match[1]) };
  match = path.match(/\/tonegrid\/releases\/([^/]+)$/i);
  if (match) return { resource: 'release', id: decodePart(match[1]) };
  if (/\/tonegrid\/tracks\/.*audio$/i.test(path) || /\/tonegrid\/tracks\/audio$/i.test(path)) {
    const audioMatch = path.match(/\/tracks\/([^/]+)\/audio$/i);
    let id = '';
    if (audioMatch) id = decodePart(audioMatch[1]);
    if (!id) id = queryValue(req, 'id');
    return { resource: 'audio', id: String(id || '').trim() };
  }
  match = path.match(/\/tonegrid\/tracks\/([^/]+)$/i);
  if (match) return { resource: 'track', id: decodePart(match[1]) };
  match = path.match(/^\/api\/tonegrid\/([^/]+)$/);
  if (match) return { resource: match[1], id: '' };

  const resource = queryValue(req, 'resource');
  const id = queryValue(req, 'id');
  if (resource) return { resource, id };
  if (id) return { resource: 'audio', id };
  return { resource: '', id: '' };
}

function queryFromReq(req) {
  return queryOf(req);
}

function parseExplicit(value) {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0 || value == null || value === '') {
    return false;
  }
  return null;
}

function parsePosition(value) {
  if (value == null || value === '') return 1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function toNumber(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(String(value).replace(/[$,]/g, '').trim());
    return isFinite(n) ? n : 0;
  }
  return 0;
}

function asObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    const merged = {};
    Object.keys(payload).forEach((key) => {
      if (key !== 'data') merged[key] = payload[key];
    });
    Object.keys(payload.data).forEach((key) => {
      merged[key] = payload.data[key];
    });
    return merged;
  }
  return payload;
}

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
  return [];
}

function unwrapRelease(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.release && typeof payload.release === 'object') return payload.release;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    if (payload.data.release && typeof payload.data.release === 'object') return payload.data.release;
    return payload.data;
  }
  return payload;
}

function sectionError(result) {
  if (!result || result.ok) return '';
  if (result.data && typeof result.data.error === 'string') return result.data.error;
  return 'The store rejected the request.';
}

async function health(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const payload = healthPayload();
  if (!isConfigured()) {
    sendJson(res, 503, {
      configured: false,
      sandbox: false,
      error: 'Catalog sync is not configured yet.',
    });
    return;
  }

  sendJson(res, 200, payload);
}

async function requireUpload(req, res) {
  const scope = await personalScope(req, res);
  if (!scope) return null;
  const decision = plans.evaluate(scope.row);
  if (!decision.allowed) {
    sendJson(res, 403, plans.limitBody(decision));
    return null;
  }
  return scope;
}

function createdReleaseId(payload) {
  const row = unwrapRelease(payload);
  const id = String((row && (row.uuid || row.release_uuid || row.id)) || '').trim();
  return isUuid(id) ? id : '';
}

function createdTrackId(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = [
    payload.uuid,
    payload.track && payload.track.uuid,
    payload.data && payload.data.uuid,
    payload.data && payload.data.track && payload.data.track.uuid,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const id = String(candidates[i] || '').trim();
    if (isUuid(id)) return id;
  }
  return '';
}

function sameCatalogId(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase() && Boolean(String(a || '').trim());
}

function sameSongText(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function releaseBelongsToCreateBody(row, body) {
  if (!row) return false;
  const wantTitle = String((body && body.title) || '').trim();
  const gotTitle = String((row && row.title) || '').trim();
  if (wantTitle && gotTitle && sameSongText(wantTitle, gotTitle)) return true;
  const stem = audioStemOf(body && (body.audio_name || body.audioName || body.audio_picked_name));
  return Boolean(stem && gotTitle && sameSongText(gotTitle, stem));
}

const RECORD_EXISTS_COPY = 'A record with these details already exists.';

function artistIdOfRelease(row) {
  if (!row || typeof row !== 'object') return '';
  const candidates = [
    row.artist_id,
    row.artist_uuid,
    row.artist && (row.artist.uuid || row.artist.id || row.artist.artist_id),
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const id = String(candidates[i] || '').trim();
    if (isUuid(id)) return id;
  }
  return '';
}

function isAlreadyExistsResult(result) {
  if (!result || result.ok) return false;
  const msg = String((result.data && (result.data.error || result.data.message)) || '').toLowerCase();
  if (/already exists|already exist|a record with these details/.test(msg)) return true;
  if (/fingerprint|audio[-_ ]?hash|unique constraint|duplicate key/.test(msg)) return true;
  if (result.status === 409 && /duplicate|unique|exists/.test(msg)) return true;
  return false;
}

const PROTECTED_CATALOG_IDS = [
  'c0102e1c-b62b-4dcf-9fe1-00d063df51a4',
  '6629b532-2e78-4be6-84eb-e4dfa9ac33e5',
  '490b789a-0a33-4372-9d81-665f47b3cbf1',
  '1f26369b-e107-4c79-bde1-4c5382f9d511',
  'df51342b-ba22-4093-93ff-35b6402b61c0',
  '7544eade-ce02-472c-92d0-a5d61609999d',
];

const KNOWN_ADOPT_RELEASES = [
  {
    id: '7a928125-b12e-4609-bd37-26ce0edf819e',
    title: 'Rainbow Road',
    artist: 'Victoria PLAIGROUND',
  },
  {
    id: 'cefce28e-8020-435e-8097-177de07f0c44',
    title: 'FUEGO GODDESS',
    artist: 'Victoria PLAIGROUND',
  },
  {
    id: '0767cb74-c5aa-4b18-8023-729fd4fb2808',
    title: 'I Set the Tone',
    artist: 'VEXA',
  },
];

function isKnownAdoptRelease(id) {
  const nid = String(id || '').trim();
  return Boolean(nid && KNOWN_ADOPT_RELEASES.some((have) => sameCatalogId(have.id, nid)));
}

function knownAdoptRow(id) {
  const nid = String(id || '').trim();
  if (!nid) return null;
  for (let i = 0; i < KNOWN_ADOPT_RELEASES.length; i += 1) {
    if (sameCatalogId(KNOWN_ADOPT_RELEASES[i].id, nid)) return KNOWN_ADOPT_RELEASES[i];
  }
  return null;
}

function knownAdoptIdForTitle(title) {
  const want = String(title || '').trim();
  if (!want) return '';
  for (let i = 0; i < KNOWN_ADOPT_RELEASES.length; i += 1) {
    if (sameSongText(KNOWN_ADOPT_RELEASES[i].title, want)) return KNOWN_ADOPT_RELEASES[i].id;
  }
  return '';
}

function isFuegoGoddessTitle(title) {
  return sameSongText(title, 'FUEGO GODDESS');
}

function fuegoGoddessAdoptId() {
  const known = knownAdoptRow('cefce28e-8020-435e-8097-177de07f0c44');
  return (known && known.id) || 'cefce28e-8020-435e-8097-177de07f0c44';
}

const FUEGO_GODDESS_TRACK_IDS = [
  '1f346f71-a70d-4648-bb66-5c5aff5f5243',
  '81e47b6f-6b13-44e6-a436-de81ffaa849f',
];

const PREFERRED_LEFTOVER_TRACK_IDS = FUEGO_GODDESS_TRACK_IDS.concat([
  'afce23fb-aa5f-42ac-94ae-2ce58bf48402',
]);

function trackIdFromRow(row) {
  if (!row || typeof row !== 'object') return '';
  const id = String(row.uuid || row.track_id || row.id || '').trim();
  return isUuid(id) ? id : '';
}

function preferLeftoverTrackId(tracks) {
  const list = Array.isArray(tracks) ? tracks : [];
  for (let i = 0; i < PREFERRED_LEFTOVER_TRACK_IDS.length; i += 1) {
    const want = PREFERRED_LEFTOVER_TRACK_IDS[i];
    for (let j = 0; j < list.length; j += 1) {
      if (sameCatalogId(trackIdFromRow(list[j]), want)) return want;
    }
  }
  return trackIdFromRow(list[0]);
}

function preferFuegoLeftoverTrackId(tracks) {
  return preferLeftoverTrackId(tracks);
}

async function leftoverTracksForContinue(releaseId) {
  const loaded = await fetchStoreReleaseRaw(releaseId);
  let tracks = pickTracks(loaded.row);
  if (!tracks.length) {
    const tracksRes = await tonegridFetch('/releases/' + releaseId + '/tracks', { method: 'GET' });
    if (tracksRes.ok) tracks = pickTracks(tracksRes.data);
  }
  return tracks;
}

function leftoverTracksMatchingTitle(tracks, title) {
  const list = Array.isArray(tracks) ? tracks : [];
  const want = String(title || '').trim();
  if (!want) return list;
  const titled = list.filter((row) => {
    const got = String((row && row.title) || '').trim();
    return !got || sameSongText(got, want);
  });
  return titled.length ? titled : list;
}

async function continueLeftoverTrack(res, releaseId, body, songwriter, scope) {
  const tracks = leftoverTracksMatchingTitle(
    await leftoverTracksForContinue(releaseId),
    (body && body.title) || ''
  );
  if (!tracks.length) return false;
  const reuseId = preferLeftoverTrackId(tracks);
  if (!isUuid(reuseId)) return false;
  const attached = await attachTrackWriters(reuseId, songwriter);
  if (!attached.ok) {
    sendJson(res, attached.status, attached.data);
    return true;
  }
  const leftoverAi = storeAi.trackAiFields(body);
  if (leftoverAi) {
    try {
      await applyTrackAiDisclosure(reuseId, leftoverAi);
    } catch {
      /* leftover continue still hops if the AI tag misses */
    }
  }
  await accounts.updateCatalog(scope.userId, { trackId: reuseId });
  sendJson(res, 200, { uuid: reuseId, continued: true });
  return true;
}

async function continueFuegoLeftoverTrack(res, releaseId, body, songwriter, scope) {
  return continueLeftoverTrack(res, releaseId, body, songwriter, scope);
}

function knownLeftoverBelongsToScope(scope, row) {
  if (!scope || !row) return false;
  const id = row.uuid || row.release_uuid || row.id;
  const known = knownAdoptRow(id);
  if (!known) return false;
  if (isProtectedCatalogRelease(id, row.title)) return false;
  if (row.title && sameSongText(row.title, known.title) === false) return false;
  const rowArtist = artistCheck.normalizeName(artistNameOf(row) || '');
  const accountArtist = artistCheck.normalizeName((scope.row && scope.row.artist_name) || '');
  if (rowArtist && accountArtist && rowArtist === accountArtist) return true;
  const knownArtist = artistCheck.normalizeName(known.artist || '');
  if (knownArtist && accountArtist && knownArtist === accountArtist) return true;
  const rowArtistId = artistIdOfRelease(row);
  if (rowArtistId && scope.artistId && sameCatalogId(rowArtistId, scope.artistId)) return true;
  return false;
}

async function findKnownAdoptCollision(body, artistId, wantName) {
  const wantTitle = String((body && body.title) || '').trim();
  if (!wantTitle) return null;
  for (let i = 0; i < KNOWN_ADOPT_RELEASES.length; i += 1) {
    const known = KNOWN_ADOPT_RELEASES[i];
    if (!sameSongText(known.title, wantTitle)) continue;
    const id = known.id;
    if (isProtectedCatalogRelease(id)) continue;
    const loaded = await fetchStoreReleaseRaw(id);
    if (loaded.row && isBlockingStoreLeftover(loaded.row.status)) continue;
    // Title-only. Numeric artist_id (196) and a different display name are fine.
    return {
      id: id,
      status: normalizeReleaseStatus((loaded.row && loaded.row.status) || 'draft'),
      row: loaded.row || { uuid: id, title: known.title },
    };
  }
  return null;
}

function protectedCatalogTitleOf(title) {
  return String(title || '').trim().toLowerCase().replace(/,/g, '');
}

function isProtectedCatalogRelease(id, title) {
  const nid = String(id || '').trim().toLowerCase();
  if (nid && PROTECTED_CATALOG_IDS.some((have) => sameCatalogId(have, nid))) return true;
  const n = protectedCatalogTitleOf(title);
  return n === 'lightning'
    || n === 'thank you dolly'
    || n === 'metete en el groove'
    || n === 'too the moon'
    || n === 'cgi'
    || n === 'vhnjuk';
}

function audioStemOf(name) {
  return String(name || '').trim().replace(/\.[a-z0-9]{2,5}$/i, '').trim();
}

function isDeletableStoreLeftover(status) {
  const s = normalizeReleaseStatus(status);
  return !s || s === 'draft' || s === 'rejected' || s === 'needs_fix';
}

function isBlockingStoreLeftover(status) {
  const s = normalizeReleaseStatus(status);
  return storeFacingStatus(s) || cancelFirstStatus(s);
}

function isStoreDeleteGone(result) {
  if (!result) return false;
  if (result.ok) return true;
  return result.status === 404 || isReleaseGoneResult(result);
}

async function deleteStoreRelease(releaseId) {
  if (isKnownAdoptRelease(releaseId) || isProtectedCatalogRelease(releaseId)) {
    return { ok: false, status: 403, data: { error: 'Release cannot be removed.' } };
  }
  return tonegridFetch('/releases/' + releaseId, {
    method: 'DELETE',
    idempotencyKey: hopIdempotencyKey('delete-release', 'DELETE', '/releases/' + releaseId, releaseId),
  });
}

function storeListTotal(payload, meta) {
  const root = payload && typeof payload === 'object' ? payload : {};
  return Number(root.total || (meta && meta.total) || 0) || 0;
}

async function listStoreReleasePages(queryExtra) {
  const collected = [];
  for (let page = 1; page <= 20; page += 1) {
    const query = Object.assign({ per_page: 100, page: page }, queryExtra || {});
    const result = await tonegridFetch('/releases', {
      method: 'GET',
      query: query,
      timeoutMs: LIST_HOP_TIMEOUT_MS,
    });
    if (!result.ok) return { ok: collected.length > 0, result: result, rows: collected };
    const rows = asList(result.data).map((row) => unwrapRelease(row) || row).filter(Boolean);
    collected.push.apply(collected, rows);
    const meta = parseStoreListMeta(result.data);
    const total = storeListTotal(result.data, meta);
    if (meta.lastPage && page >= meta.lastPage) break;
    if (total && collected.length >= total) break;
    if (!rows.length) break;
    if (!meta.lastPage && !meta.nextCursor && rows.length < 100) break;
  }
  return { ok: true, rows: collected };
}

function wantArtistNameOf(body) {
  if (!body || typeof body !== 'object') return '';
  return artistNameOf(body) || String(body.artist || body.artist_name || body.name || '').trim();
}

function artistMatchesCollision(row, body, artistId, wantName) {
  const gotId = artistIdOfRelease(row);
  const idMatch = Boolean(gotId && artistId && sameCatalogId(gotId, artistId));
  const gotName = artistNameOf(row);
  const want = String(wantName || wantArtistNameOf(body) || '').trim();
  const nameMatch = Boolean(
    gotName && want && artistCheck.normalizeName(gotName) === artistCheck.normalizeName(want)
  );
  return idMatch || nameMatch;
}

function artistConflictsCollision(row, body, artistId, wantName) {
  const gotId = artistIdOfRelease(row);
  if (gotId && artistId) return !sameCatalogId(gotId, artistId);
  const gotName = artistNameOf(row);
  const want = String(wantName || wantArtistNameOf(body) || '').trim();
  if (gotName && want) {
    return artistCheck.normalizeName(gotName) !== artistCheck.normalizeName(want);
  }
  return false;
}

function catalogHasId(ids, releaseId) {
  return (ids || []).some((id) => sameCatalogId(id, releaseId));
}

async function resolveWantArtistName(body, artistId, userRow) {
  const fromBody = wantArtistNameOf(body);
  if (fromBody) return fromBody;
  if (artistId && userRow) {
    const list = (rosterOf(userRow).artists || []);
    for (let i = 0; i < list.length; i += 1) {
      if (sameCatalogId(list[i].tonegrid_artist_id, artistId) && list[i].name) {
        return String(list[i].name).trim();
      }
    }
  }
  if (!artistId) return '';
  const loaded = await tonegridFetch('/artists/' + artistId, { method: 'GET' });
  if (!loaded.ok) return '';
  const row = unwrapRelease(loaded.data) || loaded.data;
  const name = row && (row.name || row.title);
  return name ? String(name).trim() : '';
}

async function fetchStoreReleaseRaw(releaseId) {
  const result = await tonegridFetch('/releases/' + releaseId, { method: 'GET' });
  if (!result.ok) return { result, row: null };
  return { result, row: unwrapRelease(result.data) || result.data };
}

async function findStoreCollision(body, artistId, options) {
  const wantTitle = String((body && body.title) || '').trim();
  if (!wantTitle) return null;
  // Owned catalog ids stay visible: same-title leftovers must attach, not hide behind skipIds.
  const wantName = (options && options.wantName) || wantArtistNameOf(body);
  const known = await findKnownAdoptCollision(body, artistId, wantName);
  if (known && known.id) return known;
  const searches = [{ status: 'draft' }, { status: 'rejected' }, {}];
  const seen = Object.create(null);
  let titleOnly = null;
  for (let s = 0; s < searches.length; s += 1) {
    const listed = await listStoreReleasePages(searches[s]);
    const rows = listed.rows || [];
    for (let i = 0; i < rows.length; i += 1) {
      const raw = rows[i];
      const row = unwrapRelease(raw) || raw;
      const id = String((row && (row.uuid || row.release_uuid || row.id)) || '').trim();
      if (!isUuid(id) || seen[id.toLowerCase()]) continue;
      if (isProtectedCatalogRelease(id, row && row.title)) continue;
      if (!releaseBelongsToCreateBody(row, body)) continue;
      seen[id.toLowerCase()] = true;
      let detail = row;
      if (!artistIdOfRelease(row) || !artistNameOf(row) || !row.status) {
        const loaded = await fetchStoreReleaseRaw(id);
        if (loaded.row) detail = Object.assign({}, row, loaded.row);
      }
      if (isBlockingStoreLeftover(detail.status || row.status)) continue;
      const hit = {
        id: id,
        status: normalizeReleaseStatus(detail.status || row.status),
        row: detail,
      };
      if (artistMatchesCollision(detail, body, artistId, wantName)) return hit;
      if (!titleOnly) titleOnly = hit;
    }
  }
  return titleOnly;
}

function createdWriterId(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = [
    payload.uuid,
    payload.writer_uuid,
    payload.writer && payload.writer.uuid,
    payload.data && payload.data.uuid,
    payload.data && payload.data.writer && payload.data.writer.uuid,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const id = String(candidates[i] || '').trim();
    if (isUuid(id)) return id;
  }
  return '';
}

function createdArtistId(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = [
    payload.uuid,
    payload.artist_id,
    payload.artist && payload.artist.uuid,
    payload.data && payload.data.uuid,
    payload.data && payload.data.artist && payload.data.artist.uuid,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const id = String(candidates[i] || '').trim();
    if (isUuid(id)) return id;
  }
  return '';
}

async function listArtists(req, res) {
  const query = queryFromReq(req);
  const out = {};
  ['page', 'per_page', 'q', 'search'].forEach((key) => {
    if (query[key] !== undefined && query[key] !== '') out[key] = query[key];
  });
  const result = await tonegridFetch('/artists', {
    method: 'GET',
    query: out,
  });
  sendJson(res, result.status, result.data);
}

function rosterOf(row) {
  return profileLib.recoverRoster(profileLib.readStored(row), row && row.artist_name, row && row.tonegrid_artist_id);
}

function matchingTonegridArtist(row, body) {
  const stored = rosterOf(row);
  const pgId = String((body && (body.plaiground_artist_id || body.artist_profile_id)) || '').trim();
  const name = String((body && body.name) || '').trim();
  if (pgId) {
    const found = profileLib.findArtist(stored, pgId);
    if (found && found.tonegrid_artist_id) return found.tonegrid_artist_id;
  }
  if (name) {
    const want = artistCheck.normalizeName(name);
    const list = stored.artists || [];
    for (let i = 0; i < list.length; i += 1) {
      if (artistCheck.normalizeName(list[i].name) === want && list[i].tonegrid_artist_id) {
        return list[i].tonegrid_artist_id;
      }
    }
  }
  return '';
}

async function attachTonegridArtist(row, plaigroundId, tonegridId) {
  if (!plaigroundId || !tonegridId) return;
  const stored = rosterOf(row);
  const current = profileLib.findArtist(stored, plaigroundId);
  if (!current) return;
  await accounts.updateProfile(row.id, {
    profile: profileLib.upsertArtist(stored, Object.assign({}, current, { tonegrid_artist_id: tonegridId })),
  });
}

// matchingTonegridArtist() only checks this account's own local roster. When
// that roster lost track of an artist's tonegrid_artist_id (a different local
// profile record was used, or the link never got written), POST /artists
// re-attempts a create and the store rejects it because the slug is already
// taken - the artist genuinely exists over there, we just do not know its id.
// This mirrors findStoreCollision()'s self-heal for release-title collisions:
// search the store's own /artists list and adopt the match instead of
// relaying the raw "slug already taken" error.
function isSlugTakenResult(result) {
  if (!result || result.ok) return false;
  const msg = String((result.data && (result.data.error || result.data.message)) || '').toLowerCase();
  if (!msg) return false;
  if (/slug/.test(msg) && /(already|taken|exist|in use|duplicate)/.test(msg)) return true;
  if (result.status === 409 && /slug/.test(msg)) return true;
  return false;
}

async function listStoreArtistPages(queryExtra) {
  const collected = [];
  for (let page = 1; page <= 20; page += 1) {
    const query = Object.assign({ per_page: 100, page: page }, queryExtra || {});
    const result = await tonegridFetch('/artists', {
      method: 'GET',
      query: query,
      timeoutMs: LIST_HOP_TIMEOUT_MS,
    });
    if (!result.ok) return { ok: collected.length > 0, result: result, rows: collected };
    const rows = asList(result.data).map((row) => unwrapRelease(row) || row).filter(Boolean);
    collected.push.apply(collected, rows);
    const meta = parseStoreListMeta(result.data);
    const total = storeListTotal(result.data, meta);
    if (meta.lastPage && page >= meta.lastPage) break;
    if (total && collected.length >= total) break;
    if (!rows.length) break;
    if (!meta.lastPage && !meta.nextCursor && rows.length < 100) break;
  }
  return { ok: true, rows: collected };
}

function artistRowMatches(row, name, slug) {
  const gotSlug = String((row && row.slug) || '').trim().toLowerCase();
  if (slug && gotSlug && gotSlug === String(slug).toLowerCase()) return true;
  const gotName = String((row && row.name) || '').trim();
  if (name && gotName && artistCheck.normalizeName(gotName) === artistCheck.normalizeName(name)) return true;
  return false;
}

async function findExistingArtistBySlug(name, slug) {
  if (!name && !slug) return null;
  const passes = [{ q: name || slug }, {}];
  const seen = Object.create(null);
  for (let p = 0; p < passes.length; p += 1) {
    const listed = await listStoreArtistPages(passes[p]);
    const rows = listed.rows || [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const id = String((row && (row.uuid || row.artist_uuid || row.id)) || '').trim();
      if (!isUuid(id) || seen[id.toLowerCase()]) continue;
      seen[id.toLowerCase()] = true;
      if (artistRowMatches(row, name, slug)) return { id: id, row: row };
    }
  }
  return null;
}

function isArtistGoneResult(result) {
  if (!result || result.ok) return false;
  if (typeof isMissingEndpoint === 'function' && isMissingEndpoint(result)) return false;
  const msg = String((result.data && (result.data.error || result.data.message)) || '');
  if (isArtistGoneError(msg)) return true;
  return false;
}

async function notifyFirstStoreLive(user, status, extras) {
  try {
    await growthEvents.recordFirstStoreLive(user, status, extras);
  } catch {
    /* live hook must not block store-status writes */
  }
}

async function persistReleaseMeta(row, releaseId, status, reason, artworkUrl, artworkObjectKey, credits, extras) {
  if (!row || !releaseId) return;
  const stored = rosterOf(row);
  let next = stored;
  if (status || reason !== undefined) {
    next = profileLib.applyReleaseStatus(stored, releaseId, status, reason);
  }
  if (artworkUrl || artworkObjectKey || (credits && typeof credits === 'object')) {
    next = profileLib.upsertRelease(next, Object.assign({
      id: releaseId,
      tonegrid_release_id: releaseId,
      artwork_url: artworkUrl,
      artwork_object_key: artworkObjectKey,
    }, credits && typeof credits === 'object' ? credits : {}));
  }
  await accounts.updateProfile(row.id, { profile: next });
  if (status && !isGoneHiddenStatus(status) && !isRemovingStoreStatus(status)) {
    await notifyFirstStoreLive(row, status, Object.assign({
      release_id: releaseId,
      links: extras && extras.links,
      release: extras && extras.release,
    }, extras || {}));
  }
}

function creditArtistsOf(row) {
  return rosterOf(row).artists || [];
}

function songwriterFromHop(body, row) {
  return storeCredits.resolveSongwriter(body, creditArtistsOf(row));
}

function filledCreditsFromRow(row) {
  if (!row || typeof row !== 'object') return null;
  const keys = [
    'label',
    'copyright_year',
    'copyright_holder',
    'copyright_owner',
    'rights_owner',
    'master_owner',
    'c_line',
    'p_line',
    'copyright_line',
  ];
  const out = {};
  keys.forEach((key) => {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      out[key] = row[key];
    }
  });
  if (Array.isArray(row.writers) && row.writers.length) out.writers = row.writers;
  return Object.keys(out).length ? out : null;
}

async function applyReleaseCredits(releaseId, hopCredits, opts) {
  const options = opts || {};
  const credits = hopCredits && typeof hopCredits === 'object' ? hopCredits : {};
  if (!credits.cOwner && !credits.pOwner) return { ok: true, skipped: true };
  if (options.patch !== false) {
    const patch = storeCredits.releasePatchFields(credits);
    const patched = await tonegridFetch('/releases/' + releaseId, {
      method: 'PATCH',
      body: patch,
      idempotencyKey: hopIdempotencyKey('credits-patch', 'PATCH', '/releases/' + releaseId, JSON.stringify(patch)),
    });
    if (!patched.ok && !isMissingEndpoint(patched)) return patched;
  }
  const rights = storeCredits.rightsEnvelope(credits);
  if (!rights.p_line && !rights.c_line) return { ok: true };
  const updated = await tonegridFetch('/releases/' + releaseId + '/rights', {
    method: 'PUT',
    body: rights,
    idempotencyKey: hopIdempotencyKey('rights', 'PUT', '/releases/' + releaseId + '/rights', JSON.stringify(rights)),
  });
  if (updated.ok) return { ok: true };
  if (isMissingEndpoint(updated)) {
    const retryBody = storeCredits.rightsEnvelopeRetry(credits);
    const retried = await tonegridFetch('/releases/' + releaseId + '/rights', {
      method: 'PUT',
      body: retryBody,
      idempotencyKey: hopIdempotencyKey('rights-retry', 'PUT', '/releases/' + releaseId + '/rights', JSON.stringify(retryBody)),
    });
    if (retried.ok) return { ok: true };
    const fallback = storeCredits.releasePatchFields(credits);
    const patchedRights = await tonegridFetch('/releases/' + releaseId, {
      method: 'PATCH',
      body: fallback,
      idempotencyKey: hopIdempotencyKey('credits-rights-patch', 'PATCH', '/releases/' + releaseId, JSON.stringify(fallback)),
    });
    if (patchedRights.ok) return { ok: true };
    return retried.ok === false ? retried : updated;
  }
  return updated;
}

async function attachTrackWriters(trackId, songwriter) {
  const name = songwriter && songwriter.name;
  if (!name || !isUuid(trackId)) return { ok: true, skipped: true };
  const writerBody = storeCredits.writerCreateBody(songwriter);
  const created = await tonegridFetch('/writers', {
    method: 'POST',
    body: writerBody,
    idempotencyKey: hopIdempotencyKey('writer', 'POST', '/writers', [name, songwriter.first || '', songwriter.last || ''].join('\n')),
  });
  if (!created.ok) {
    if (isMissingEndpoint(created)) return { ok: true, skipped: true };
    return created;
  }
  const writerId = createdWriterId(created.data);
  if (!writerId) {
    return { ok: false, status: 502, data: { error: storeCredits.resolveSongwriter({}, []).error } };
  }
  const attach = storeCredits.trackWritersBody(writerId, songwriter);
  const put = await tonegridFetch('/tracks/' + trackId + '/writers', {
    method: 'PUT',
    body: attach,
    idempotencyKey: hopIdempotencyKey('track-writers', 'PUT', '/tracks/' + trackId + '/writers', JSON.stringify(attach)),
  });
  if (!put.ok && !isMissingEndpoint(put)) return put;
  return { ok: true };
}

async function applyTrackAiDisclosure(trackId, fields) {
  if (!fields || !isUuid(trackId)) return { ok: true, skipped: true };
  return tonegridFetch('/tracks/' + trackId, {
    method: 'PATCH',
    body: fields,
    idempotencyKey: hopIdempotencyKey('track-ai', 'PATCH', '/tracks/' + trackId, JSON.stringify(fields)),
  });
}

async function createArtist(req, res) {
  const scope = await personalScope(req, res);
  if (!scope) return;

  let body = {};
  try {
    if (req.method === 'POST') body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const pgId = String((body && (body.plaiground_artist_id || body.artist_profile_id)) || '').trim();
  const continueId = matchingTonegridArtist(scope.row, body);
  // Name-only create must POST. Never fall back to a leftover catalog UUID.
  if (continueId) {
    const loaded = await tonegridFetch('/artists/' + continueId, { method: 'GET' });
    if (loaded.ok) {
      sendJson(res, 200, { uuid: continueId, continued: true });
      return;
    }
    sendJson(res, loaded.status || 404, { error: ARTIST_GONE_COPY });
    return;
  }

  const artistGate = uploadRequired.validateArtist(body);
  if (artistGate.error) {
    sendJson(res, 400, { error: artistGate.error });
    return;
  }
  const name = artistGate.name;
  const parsed = artistCheck.parseStoreLink(body && (body.store_url || body.link || body.url));
  const check = artistCheck.checkArtistName(name, {
    accountArtists: rosterOf(scope.row).artists,
    storeLink: parsed.ok ? parsed.url : '',
    skipId: String((body && body.plaiground_artist_id) || '').trim(),
  });
  if (check.level === 'red' && !parsed.ok) {
    sendJson(res, 409, {
      error: artistCheck.RED_COPY,
      code: 'ARTIST_NAME_RED',
      check: check,
    });
    return;
  }
  if (check.level === 'yellow' && !parsed.ok && body.confirm_different !== true) {
    sendJson(res, 409, {
      error: artistCheck.YELLOW_COPY,
      code: 'ARTIST_NAME_YELLOW',
      check: check,
    });
    return;
  }

  const decision = plans.evaluate(scope.row);
  if (!decision.allowed) {
    sendJson(res, 403, plans.limitBody(decision));
    return;
  }

  const slug = deriveSlug((body && body.slug) || name);
  if (!slug) {
    sendJson(res, 400, { error: 'Artist name needs at least one letter or number for a slug.' });
    return;
  }

  const payload = { name, slug };
  if (body && body.country !== undefined && body.country !== '') {
    const country = normalizeCountry(body.country);
    if (!country) {
      sendJson(res, 400, { error: 'Country must be a 2-letter ISO code.' });
      return;
    }
    payload.country = country;
  }

  const result = await tonegridFetch('/artists', {
    method: 'POST',
    body: payload,
    idempotencyKey: idempotencyKey(req, 'artist:' + slug),
  });
  if (result.ok) {
    const artistId = createdArtistId(result.data);
    if (artistId) {
      await accounts.updateCatalog(scope.userId, { artistId: artistId, replaceArtistId: true });
      const latest = await accounts.findById(scope.userId);
      await attachTonegridArtist(latest || scope.row, pgId, artistId);
    }
    sendJson(res, result.status, result.data);
    return;
  }
  if (isSlugTakenResult(result)) {
    const existing = await findExistingArtistBySlug(name, slug);
    if (existing && existing.id) {
      await accounts.updateCatalog(scope.userId, { artistId: existing.id, replaceArtistId: true });
      const latest = await accounts.findById(scope.userId);
      await attachTonegridArtist(latest || scope.row, pgId, existing.id);
      sendJson(res, 200, { uuid: existing.id, continued: true });
      return;
    }
  }
  sendJson(res, result.status, result.data);
}

async function artists(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method === 'GET') {
    await listArtists(req, res);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await createArtist(req, res);
}

function pickTracks(payload) {
  let list = [];
  if (Array.isArray(payload)) list = payload;
  else if (payload && Array.isArray(payload.tracks)) list = payload.tracks;
  else if (payload && payload.tracks && Array.isArray(payload.tracks.data)) list = payload.tracks.data;
  else if (payload && Array.isArray(payload.data)) list = payload.data;
  return list.map((row) => {
    if (!row || typeof row !== 'object') return null;
    const uuid = String(row.uuid || row.track_id || row.id || '').trim();
    if (!uuid) return null;
    return {
      uuid,
      title: String(row.title || '').trim(),
      position: Number(row.position) || 1,
      language: String(row.language || '').trim().toLowerCase(),
      explicit: row.explicit === true,
      isrc: String(row.isrc || row.ISRC || '').trim(),
      writers: Array.isArray(row.writers) ? row.writers : [],
      composers: Array.isArray(row.composers) ? row.composers : [],
      contributors: Array.isArray(row.contributors) ? row.contributors : [],
    };
  }).filter(Boolean);
}

function creditWritersOf(row) {
  if (Array.isArray(row && row.writers) && row.writers.length) return row.writers;
  if (Array.isArray(row && row.composers) && row.composers.length) return row.composers;
  const contrib = Array.isArray(row && row.contributors) ? row.contributors : [];
  return contrib.filter((item) => {
    const role = String((item && item.role) || '').toLowerCase();
    return /composer|songwriter|lyricist|writer/.test(role);
  });
}

function artistNameOf(row) {
  if (!row || typeof row !== 'object') return '';
  if (typeof row.artist === 'string') return row.artist.trim();
  if (row.artist && typeof row.artist === 'object') {
    return String(row.artist.name || row.artist.title || '').trim();
  }
  return String(row.artist_name || row.primary_artist || '').trim();
}

function pickRelease(row) {
  if (!row || typeof row !== 'object') return null;
  const title = String(row.title || '').trim();
  const uuid = String(row.uuid || row.release_uuid || '').trim();
  if (!title && !uuid) return null;
  return {
    uuid,
    title,
    type: normalizeReleaseType(row.type) || 'single',
    status: String(row.status || '').trim().toLowerCase(),
    genre: String(row.genre || '').trim(),
    language: String(row.language || '').trim().toLowerCase(),
    artwork_url: coverUrl.from(row),
    release_date: normalizeReleaseDate(row.release_date || row.releaseDate) || '',
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    artist: artistNameOf(row),
    tracks: pickTracks(row),
    dsps: parseStoreSlugs(row),
    deliveries: Array.isArray(row.deliveries) ? livePlayer.pickDeliveries(row.deliveries) : [],
    rejection_reason: String(row.rejection_reason || row.reject_reason || row.reason || row.notes || '').trim(),
    upc: String(row.upc || row.UPC || row.barcode || row.ean || '').trim(),
    isrc: String(row.isrc || row.ISRC || '').trim(),
    label: String(row.label || row.label_name || row.record_label || '').trim(),
    copyright_year: row.copyright_year || row.copyrightYear || '',
    copyright_holder: String(row.copyright_holder || row.copyright_owner || row.copyrightOwner || '').trim(),
    copyright_owner: String(row.copyright_owner || row.copyrightOwner || row.copyright_holder || '').trim(),
    rights_owner: String(row.rights_owner || row.rightsOwner || row.copyright_holder || row.copyright_owner || '').trim(),
    master_owner: String(row.master_owner || row.masterOwner || row.p_line_owner || row.copyright_holder || '').trim(),
    c_line: String(row.c_line || row.cLine || '').trim(),
    p_line: String(row.p_line || row.pLine || '').trim(),
    copyright_line: String(row.copyright_line || row.copyrightLine || row.copyright_notice || '').trim(),
    writers: creditWritersOf(row),
  };
}

async function attachDeliveries(row, releaseId) {
  if (!row) return row;
  const id = String(releaseId || row.uuid || '').trim();
  if (!Array.isArray(row.deliveries)) row.deliveries = [];
  if (!id || !livePlayer.isLiveStatus(row.status)) return row;
  const result = await tonegridFetch('/releases/' + id + '/ddex/deliveries', { method: 'GET' });
  if (result.ok) {
    row.deliveries = livePlayer.pickDeliveries(result.data);
    return row;
  }
  const fallback = await tonegridFetch('/releases/' + id + '/distribution', { method: 'GET' });
  if (fallback.ok) row.deliveries = livePlayer.pickDeliveries(fallback.data);
  return row;
}

function bodyFingerprint(buf) {
  return crypto.createHash('sha256').update(buf && buf.length ? buf : Buffer.from('')).digest('hex').slice(0, 32);
}

async function listReleases(req, res) {
  const scope = await personalScope(req, res);
  if (!scope) return;

  const query = queryFromReq(req);
  if (query.status) {
    const status = String(query.status).trim().toLowerCase();
    if (!LIST_STATUSES.has(status)) {
      sendJson(res, 400, { error: 'status must be draft, pending, approved, live, or taken_down.' });
      return;
    }
  }
  if (query.type) {
    const type = normalizeReleaseType(query.type);
    if (!RELEASE_TYPES.has(type)) {
      sendJson(res, 400, { error: 'type must be single, ep, or album.' });
      return;
    }
  }

  const healthInfo = healthPayload();
  if (scope.empty) {
    sendJson(res, 200, {
      configured: true,
      sandbox: healthInfo.sandbox,
      empty: true,
      releases: [],
      total: 0,
      page: 1,
      per_page: 0,
    });
    return;
  }

  const collected = [];
  const stored = rosterOf(scope.row);
  const storedById = {};
  (stored.releases || []).forEach((item) => {
    const key = String((item && (item.tonegrid_release_id || item.id)) || '').toLowerCase();
    if (key) storedById[key] = item;
  });
  const fetched = await Promise.all(scope.releaseIds.map((id) => {
    return tonegridFetch('/releases/' + id, {
      method: 'GET',
      timeoutMs: LIST_HOP_TIMEOUT_MS,
    }).then((result) => ({ id, result }));
  }));
  let latestAccount = scope.row;
  for (let i = 0; i < fetched.length; i += 1) {
    const id = fetched[i].id;
    const result = fetched[i].result;
    const local = storedById[String(id).toLowerCase()];
    const localStatus = normalizeReleaseStatus((local && (local.tonegrid_status || local.status)) || '');
    if (isReleaseGoneResult(result) && (isRemovingStoreStatus(localStatus) || isGoneHiddenStatus(localStatus))) {
      if (isRemovingStoreStatus(localStatus)) {
        latestAccount = (await hideGoneRelease(latestAccount, id)) || latestAccount;
      }
      continue;
    }
    if (isGoneHiddenStatus(localStatus) && !(result && result.ok)) continue;
    let row = result.ok ? pickRelease(unwrapRelease(result.data)) : null;
    if (row) row.status = displayStoreStatus(row.status);
    if (!row && local) {
      row = {
        uuid: id,
        title: local.title || '',
        type: 'single',
        status: displayStoreStatus(local.tonegrid_status || 'pending'),
        genre: '',
        language: '',
        artwork_url: coverUrl.from(local),
        release_date: '',
        created_at: '',
        artist: '',
        tracks: [],
        dsps: [],
        rejection_reason: local.rejection_reason || '',
      };
    }
    if (!row) {
      row = {
        uuid: id,
        title: '',
        type: 'single',
        status: 'pending',
        genre: '',
        language: '',
        artwork_url: coverUrl.from(local),
        release_date: '',
        created_at: '',
        artist: '',
        tracks: [],
        dsps: [],
        rejection_reason: '',
      };
    }
    if (local && local.rejection_reason && !row.rejection_reason) {
      row.rejection_reason = local.rejection_reason;
    }
    if (row && !row.artwork_url && local) {
      row.artwork_url = coverUrl.from(local);
    }
    if (row && isGoneHiddenStatus(row.status)) continue;
    await attachDeliveries(row, id);
    if (query.status && row.status !== String(query.status).trim().toLowerCase()) continue;
    if (query.type && row.type !== normalizeReleaseType(query.type)) continue;
    collected.push(row);
  }
  if (collected.length) {
    const latestRow = await accounts.findById(scope.userId);
    const previous = rosterOf(latestRow || scope.row);
    let nextProfile = previous;
    collected.forEach((row) => {
      nextProfile = profileLib.upsertRelease(nextProfile, {
        id: row.uuid,
        title: row.title,
        artist: row.artist,
        tonegrid_release_id: row.uuid,
        tonegrid_status: row.status,
        rejection_reason: row.rejection_reason,
        artwork_url: row.artwork_url,
      });
    });
    nextProfile = profileLib.recoverRoster(
      nextProfile,
      (latestRow || scope.row).artist_name,
      (latestRow || scope.row).tonegrid_artist_id
    );
    nextProfile = profileLib.keepArtistsIfDropped(nextProfile, previous);
    await accounts.updateProfile(scope.userId, { profile: nextProfile });
    const latestUser = await accounts.findById(scope.userId);
    for (let i = 0; i < collected.length; i += 1) {
      const liveRow = collected[i];
      await notifyFirstStoreLive(latestUser || scope.row, liveRow && liveRow.status, {
        release_id: liveRow && liveRow.uuid,
        release: liveRow,
        links: growthEvents.publicStoreLinks(liveRow),
      });
    }
  }

  sendJson(res, 200, {
    configured: true,
    sandbox: healthInfo.sandbox,
    empty: collected.length === 0,
    releases: collected,
    total: collected.length,
    page: 1,
    per_page: collected.length,
  });
}

async function createRelease(req, res) {
  const scope = await personalScope(req, res);
  if (!scope) return;

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const continueId = String((body && (body.release_id || body.releaseId)) || '').trim();
  const replaceId = String((body && (body.replace_release_id || body.replaceReleaseId)) || '').trim();
  const artistId = String((body && (body.artist_id || body.artistId)) || '').trim();
  const existingIds = plans.uniqueReleaseIds(scope.row);
  const type = normalizeReleaseType(body && body.type);
  const decision = plans.evaluate(scope.row, undefined, { continueReleaseId: continueId, type });
  if (type === 'album' && decision.album_allowed === false) {
    sendJson(res, 403, plans.limitBody(decision));
    return;
  }
  const songwriter = songwriterFromHop(body, scope.row);
  if (songwriter.error) {
    sendJson(res, 400, { error: songwriter.error });
    return;
  }
  const releaseDateEarly = normalizeReleaseDate(body && (body.release_date || body.releaseDate));
  const creditYear = storeCredits.copyrightYearFromDate(body && (body.copyright_year || body.copyrightYear))
    || storeCredits.copyrightYearFromDate(releaseDateEarly);
  const hopCredits = storeCredits.creditsFromHop(body, songwriter, creditYear);
  const storedCredits = storeCredits.storedCreditFields(hopCredits);

  async function attachContinuedRelease(existingId) {
    const credited = await applyReleaseCredits(existingId, hopCredits, { patch: true });
    if (!credited.ok) return { ok: false, credited: credited };
    await persistReleaseMeta(scope.row, existingId, null, undefined, '', '', storedCredits);
    return { ok: true };
  }

  async function finishContinuedRelease(existingId) {
    const attached = await attachContinuedRelease(existingId);
    if (!attached.ok) {
      sendJson(res, attached.credited.status, attached.credited.data);
      return false;
    }
    const tracks = await leftoverTracksForContinue(existingId);
    sendJson(res, 200, { uuid: existingId, continued: true, tracks });
    return true;
  }

  let deadReplaceId = '';
  // replace_release_id / only-catalog continue only for THIS song's living owned id.
  // GET /releases/:id 404 can be requireOwnedRelease (id not in this allow-list) while
  // the partner still has the row. Do not treat that as partner-gone and 200-continue
  // the same unowned id. Leftover sandbox/prod ids 404 on the configured store.
  if (isUuid(replaceId) && existingIds.some((id) => sameCatalogId(id, replaceId))) {
    const loaded = await fetchReleaseRow(replaceId);
    if (loaded.result && loaded.result.ok && releaseBelongsToCreateBody(loaded.row, body)) {
      await finishContinuedRelease(replaceId);
      return;
    }
    if (isReleaseGoneResult(loaded.result)) {
      deadReplaceId = replaceId;
    }
  }
  const explicitId = (decision.continuing && isUuid(continueId)) ? continueId : '';
  let skippedCatalogContinue = false;
  if (explicitId && !sameCatalogId(explicitId, deadReplaceId)) {
    const loaded = await fetchReleaseRow(explicitId);
    if (
      loaded.result && loaded.result.ok
      && releaseBelongsToCreateBody(loaded.row, body)
      && !artistConflictsCollision(loaded.row, body, artistId)
    ) {
      await finishContinuedRelease(explicitId);
      return;
    }
    if (isReleaseGoneResult(loaded.result)) {
      deadReplaceId = explicitId;
    } else if (loaded.result && loaded.result.ok) {
      skippedCatalogContinue = true;
    }
  } else if (
    !deadReplaceId
    && type !== 'album'
    && existingIds.length === 1
    && isUuid(artistId)
    && scope.artistId
    && artistId.toLowerCase() === scope.artistId.toLowerCase()
  ) {
    const leftoverId = existingIds[0];
    const loaded = await fetchReleaseRow(leftoverId);
    if (loaded.result && loaded.result.ok && releaseBelongsToCreateBody(loaded.row, body)) {
      await finishContinuedRelease(leftoverId);
      return;
    }
    if (isReleaseGoneResult(loaded.result)) {
      deadReplaceId = leftoverId;
    }
  }
  const createDecision = skippedCatalogContinue
    ? plans.evaluate(scope.row, undefined, { type })
    : decision;
  if (!createDecision.allowed && !deadReplaceId) {
    sendJson(res, 403, plans.limitBody(createDecision));
    return;
  }
  const releaseDate = normalizeReleaseDate(body && (body.release_date || body.releaseDate));
  const fields = uploadRequired.validateReleaseCreate(body);

  if (!artistId) {
    sendJson(res, 400, { error: 'artist_id is required.' });
    return;
  }
  if (!isUuid(artistId)) {
    sendJson(res, 400, { error: 'artist_id must be a uuid.' });
    return;
  }
  if (fields.error) {
    sendJson(res, 400, { error: fields.error });
    return;
  }
  if (!RELEASE_TYPES.has(type)) {
    sendJson(res, 400, { error: 'type must be single, ep, or album.' });
    return;
  }
  if ((body && (body.release_date || body.releaseDate)) && !releaseDate) {
    sendJson(res, 400, { error: 'release_date must be YYYY-MM-DD.' });
    return;
  }

  let payload = Object.assign({
    artist_id: artistId,
    title: fields.title,
    type,
    genre: fields.genre,
  }, storeCredits.releaseCreateFields(storeCredits.creditsFromHop(
    body,
    songwriter,
    storeCredits.copyrightYearFromDate(body && (body.copyright_year || body.copyrightYear))
      || storeCredits.copyrightYearFromDate(releaseDate)
  )));
  if (fields.language) payload.language = fields.language;
  if (releaseDate) payload.release_date = releaseDate;

  const browserKey = headerValue(req, 'idempotency-key');
  async function postRelease(nextPayload, extra) {
    return tonegridFetch('/releases', {
      method: 'POST',
      body: nextPayload,
      idempotencyKey: hopIdempotencyKey(
        'release',
        'POST',
        '/releases',
        [JSON.stringify(nextPayload), browserKey || '', extra && extra.collideRetry ? 'collide-retry' : ''].join('\n')
      ),
    });
  }

  async function rememberCreatedRelease(created) {
    const releaseId = createdReleaseId(created.data);
    if (!releaseId) return true;
    const credited = await applyReleaseCredits(
      releaseId,
      storeCredits.creditsFromHop(
        body,
        songwriter,
        storeCredits.copyrightYearFromDate(body && (body.copyright_year || body.copyrightYear))
          || storeCredits.copyrightYearFromDate(releaseDate)
      ),
      { patch: false }
    );
    if (!credited.ok) {
      sendJson(res, credited.status, credited.data);
      return false;
    }
    if (deadReplaceId) {
      await accounts.removeRelease(scope.userId, deadReplaceId);
    }
    await accounts.updateCatalog(scope.userId, {
      artistId: artistId,
      releaseId: releaseId,
    });
    const latest = await accounts.findById(scope.userId);
    await persistReleaseMeta(latest || scope.row, releaseId, null, undefined, '', '', storedCredits);
    return true;
  }

  async function continueStoreLeftover(leftoverId) {
    if (isProtectedCatalogRelease(leftoverId)) return false;
    await accounts.updateCatalog(scope.userId, {
      artistId: artistId,
      releaseId: leftoverId,
    });
    await attachContinuedRelease(leftoverId);
    const tracks = await leftoverTracksForContinue(leftoverId);
    sendJson(res, 200, { uuid: leftoverId, continued: true, tracks });
    return true;
  }

  async function continueKnownAdoptByTitle(opts) {
    const wantTitle = String((body && body.title) || '').trim();
    if (!wantTitle) return false;
    const requireRow = !opts || opts.requireRow !== false;
    for (let i = 0; i < KNOWN_ADOPT_RELEASES.length; i += 1) {
      const known = KNOWN_ADOPT_RELEASES[i];
      if (!sameSongText(known.title, wantTitle)) continue;
      if (isProtectedCatalogRelease(known.id)) continue;
      const loaded = await fetchStoreReleaseRaw(known.id);
      if (loaded.row && isBlockingStoreLeftover(loaded.row.status)) continue;
      if (requireRow && !loaded.row) continue;
      // Title-only. Numeric artist_id 196 / display-name mismatch must still attach.
      return continueStoreLeftover(known.id);
    }
    return false;
  }

  async function continueOwnedFuegoGoddess() {
    return continueKnownAdoptByTitle();
  }

  async function continueOwnedLeftoverByTitle(wantName) {
    const leftover = await findStoreCollision(body, artistId, { wantName: wantName });
    if (!leftover || !leftover.id) return false;
    if (isProtectedCatalogRelease(leftover.id, leftover.row && leftover.row.title)) return false;
    if (isBlockingStoreLeftover(leftover.status)) return false;
    return continueStoreLeftover(leftover.id);
  }

  // Title-only: never POST a second create for a known leftover Draft.
  if (await continueKnownAdoptByTitle({ requireRow: false })) return;

  let wantCollisionName = wantArtistNameOf(body);

  const result = await postRelease(payload);
  if (!result.ok && isArtistGoneResult(result)) {
    sendJson(res, result.status, { error: ARTIST_GONE_COPY });
    return;
  }
  if (result.ok) {
    if (!await rememberCreatedRelease(result)) return;
    sendJson(res, result.status, result.data);
    return;
  }
  if (isAlreadyExistsResult(result)) {
    if (await continueKnownAdoptByTitle({ requireRow: false })) return;
    if (!wantCollisionName) {
      wantCollisionName = await resolveWantArtistName(body, artistId, scope.row);
    }
    if (await continueOwnedLeftoverByTitle(wantCollisionName)) return;
    const leftover = await findStoreCollision(body, artistId, {
      wantName: wantCollisionName,
    });
    if (leftover && leftover.id) {
      if (isProtectedCatalogRelease(leftover.id, leftover.row && leftover.row.title)) {
        if (await continueKnownAdoptByTitle({ requireRow: false })) return;
        sendJson(res, result.status || 409, { error: RECORD_EXISTS_COPY });
        return;
      }
      if (isBlockingStoreLeftover(leftover.status)) {
        if (await continueKnownAdoptByTitle({ requireRow: false })) return;
        sendJson(res, result.status || 409, { error: RECORD_EXISTS_COPY });
        return;
      }
      if (await continueStoreLeftover(leftover.id)) return;
      if (isDeletableStoreLeftover(leftover.status) && !isKnownAdoptRelease(leftover.id)) {
        const wiped = await deleteStoreRelease(leftover.id);
        if (isStoreDeleteGone(wiped)) {
          await accounts.removeRelease(scope.userId, leftover.id);
          const retried = await postRelease(payload, { collideRetry: true });
          if (retried.ok) {
            if (!await rememberCreatedRelease(retried)) return;
            sendJson(res, retried.status, retried.data);
            return;
          }
          if (!isAlreadyExistsResult(retried)) {
            sendJson(res, retried.status, retried.data);
            return;
          }
        }
      }
      const knownTitleId = knownAdoptIdForTitle((body && body.title) || '');
      if (knownTitleId && await continueStoreLeftover(knownTitleId)) return;
      if (knownTitleId) {
        sendJson(res, 200, { uuid: knownTitleId, continued: true });
        return;
      }
      sendJson(res, result.status || 409, { error: RECORD_EXISTS_COPY });
      return;
    }
    if (await continueKnownAdoptByTitle({ requireRow: false })) return;
  }
  const knownTitleId = knownAdoptIdForTitle((body && body.title) || '');
  if (knownTitleId && isAlreadyExistsResult(result) && await continueStoreLeftover(knownTitleId)) return;
  if (knownTitleId && isAlreadyExistsResult(result)) {
    sendJson(res, 200, { uuid: knownTitleId, continued: true });
    return;
  }
  sendJson(res, result.status, result.data);
}

async function releases(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method === 'GET') {
    await listReleases(req, res);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await createRelease(req, res);
}

async function createTrack(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const scope = await personalScope(req, res);
  if (!scope) return;

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const releaseId = String((body && (body.release_id || body.releaseId)) || '').trim();
  const continueTrackId = String((body && (body.track_id || body.trackId)) || '').trim();
  const position = parsePosition(body && body.position);
  const explicit = parseExplicit(body && body.explicit);
  const fields = uploadRequired.validateTrackCreate(body);
  const songwriter = songwriterFromHop(body, scope.row);
  if (songwriter.error) {
    sendJson(res, 400, { error: songwriter.error });
    return;
  }

  if (!releaseId) {
    sendJson(res, 400, { error: 'release_id is required.' });
    return;
  }
  if (!isUuid(releaseId)) {
    sendJson(res, 400, { error: 'release_id must be a uuid.' });
    return;
  }
  if (continueTrackId && isUuid(continueTrackId)) {
    const preferredTrack = PREFERRED_LEFTOVER_TRACK_IDS.some((id) => sameCatalogId(id, continueTrackId));
    if (preferredTrack || idAllowed(scope.trackAllow, continueTrackId)) {
      const attached = await attachTrackWriters(continueTrackId, songwriter);
      if (!attached.ok) {
        sendJson(res, attached.status, attached.data);
        return;
      }
      sendJson(res, 200, { uuid: continueTrackId, continued: true });
      return;
    }
  }
  if (fields.error) {
    sendJson(res, 400, { error: fields.error });
    return;
  }
  if (position == null) {
    sendJson(res, 400, { error: 'position must be a positive integer.' });
    return;
  }
  if (explicit == null) {
    sendJson(res, 400, { error: 'explicit must be true or false.' });
    return;
  }

  const trackPayload = { title: fields.title, position, explicit };
  if (fields.language) trackPayload.language = fields.language;
  storeAi.applyTrackAiFields(trackPayload, body);

  if (isKnownAdoptRelease(releaseId) && await continueLeftoverTrack(res, releaseId, Object.assign({}, body, { title: fields.title }), songwriter, scope)) {
    return;
  }

  const browserKey = headerValue(req, 'idempotency-key');
  const result = await tonegridFetch('/releases/' + releaseId + '/tracks', {
    method: 'POST',
    body: trackPayload,
    idempotencyKey: hopIdempotencyKey(
      'track',
      'POST',
      '/releases/' + releaseId + '/tracks',
      [JSON.stringify(trackPayload), browserKey || ''].join('\n')
    ),
  });
  if (result.ok) {
    const trackId = createdTrackId(result.data);
    if (trackId) {
      const attached = await attachTrackWriters(trackId, songwriter);
      if (!attached.ok) {
        sendJson(res, attached.status, attached.data);
        return;
      }
      await accounts.updateCatalog(scope.userId, { trackId });
      const latest = await accounts.findById(scope.userId);
      await persistReleaseMeta(latest || scope.row, releaseId, null, undefined, '', '', {
        writers: [{ name: songwriter.name, first_name: songwriter.first, last_name: songwriter.last }],
      });
    }
  }
  if (!result.ok && isAlreadyExistsResult(result)) {
    if (await continueLeftoverTrack(res, releaseId, Object.assign({}, body, { title: fields.title }), songwriter, scope)) {
      return;
    }
  }
  sendJson(res, result.status, result.data);
}

function looksLikeAudioPart(buf) {
  return audioConvert.incomingAudioAllowed(buf);
}

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (Buffer.isBuffer(req.body)) {
    const raw = req.body.toString('utf8').trim();
    if (!raw) return Promise.resolve({});
    return Promise.resolve(JSON.parse(raw));
  }
  if (typeof req.body === 'string') {
    const raw = req.body.trim();
    if (!raw) return Promise.resolve({});
    return Promise.resolve(JSON.parse(raw));
  }
  return readBody(req);
}

function objectKeyFromBody(body) {
  if (!body || typeof body !== 'object') return '';
  return String(body.object_key || body.objectKey || body.key || '').trim();
}

function namelessStoreError(kind) {
  return objectStore.sendCopy(kind);
}

async function loadHoppedObject(scope, key, kind) {
  if (!objectStore.isConfigured()) {
    const err = new Error(objectStore.missingCopy());
    err.status = 503;
    err.nameless = true;
    throw err;
  }
  const owned = objectStore.ownedKey(key, scope.userId, kind);
  if (!owned) {
    const err = new Error(objectStore.STEP_FAIL_COPY);
    err.status = 400;
    err.nameless = true;
    throw err;
  }
  const got = await objectStore.getObject(key);
  if (!got || !got.body || !got.body.length) {
    const err = new Error(namelessStoreError(kind));
    err.status = 400;
    err.nameless = true;
    throw err;
  }
  const max = kind === 'audio' ? MAX_AUDIO_BYTES : MAX_ARTWORK_BYTES;
  if (got.body.length > max) {
    const err = new Error(kind === 'audio' ? 'Audio must be 200 MB or smaller.' : 'Artwork must be 15 MB or smaller.');
    err.status = 413;
    throw err;
  }
  return {
    body: got.body,
    contentType: got.contentType,
    filename: objectStore.filenameOf(key, owned.filename),
    parsed: owned,
  };
}

async function uploads(req, res) {
  const scope = await personalScope(req, res);
  if (!scope) return;
  if (!objectStore.isConfigured()) {
    sendJson(res, 503, { error: objectStore.missingCopy() });
    return;
  }
  if (req.method === 'GET') {
    const key = String(queryValue(req, 'key') || '').trim();
    const owned = objectStore.ownedKey(key, scope.userId);
    if (!owned) {
      sendJson(res, 404, { error: objectStore.STEP_FAIL_COPY });
      return;
    }
    const signed = objectStore.presignGet(key);
    sendJson(res, 200, {
      object_key: key,
      url: signed.url,
      expires_in: signed.expires_in,
    });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: objectStore.STEP_FAIL_COPY });
    return;
  }
  const kind = objectStore.parseKind(body && (body.kind || body.type));
  const check = objectStore.validateMint(
    kind,
    body && (body.filename || body.name),
    body && (body.content_type || body.contentType || body.type),
    body && (body.size || body.bytes)
  );
  if (check.error) {
    sendJson(res, 400, { error: check.error });
    return;
  }
  const key = objectStore.objectKey(check.kind, scope.userId, check.filename);
  if (!key) {
    sendJson(res, 400, { error: objectStore.STEP_FAIL_COPY });
    return;
  }
  const contentType = String((body && (body.content_type || body.contentType)) || '').trim()
    || (check.kind === 'cover' ? 'image/jpeg' : 'application/octet-stream');
  const signed = objectStore.presignPut(key, contentType);
  sendJson(res, 200, {
    object_key: key,
    upload_url: signed.url,
    headers: signed.headers,
    expires_in: signed.expires_in,
  });
}

function readRawBody(req, maxBytes) {
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > maxBytes) {
      return Promise.reject(Object.assign(new Error('too large'), { code: 'TOO_LARGE' }));
    }
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > maxBytes) {
        done = true;
        reject(Object.assign(new Error('too large'), { code: 'TOO_LARGE' }));
        if (typeof req.destroy === 'function') req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

async function trackAudio(req, res, trackId) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const id = String(trackId || '').trim();
  if (!id) {
    sendJson(res, 400, { error: 'track id is required.' });
    return;
  }
  if (!isUuid(id)) {
    sendJson(res, 400, { error: 'track id must be a uuid.' });
    return;
  }
  const scope = await personalScope(req, res);
  if (!scope) return;

  const contentType = headerValue(req, 'content-type');
  let raw = null;
  let hopKey = '';
  let hopType = contentType;
  let chunkMeta = null;
  if (/application\/json/i.test(contentType)) {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'audio file is required.' });
      return;
    }
    hopKey = objectKeyFromBody(body);
    if (!hopKey) {
      sendJson(res, 400, { error: 'audio file is required.' });
      return;
    }
    let hopped;
    const hopStarted = Date.now();
    try {
      hopped = await loadHoppedObject(scope, hopKey, 'audio');
    } catch (err) {
      sendJson(res, (err && err.status) || 400, { error: (err && err.message) || objectStore.AUDIO_SEND_COPY });
      return;
    }
    const hopKind = audioConvert.sniffKind(hopped.body, hopped.filename, hopped.contentType);
    let preparedHop;
    if (hopKind === 'wav' || hopKind === 'flac') {
      preparedHop = Object.assign(
        audioConvert.buildAudioMultipart(
          audioConvert.storeFilename(hopped.filename, hopKind),
          audioConvert.storeMime(hopKind),
          hopped.body
        ),
        { kind: hopKind, converted: false }
      );
    } else {
      preparedHop = await audioConvert.prepareFromBytes(
        hopped.body,
        hopped.filename,
        hopped.contentType
      );
    }
    if (preparedHop.error) {
      sendJson(res, 400, { error: preparedHop.error });
      return;
    }
    if (preparedHop.converted && !audioConvert.toneGridBodyIsWav(preparedHop.rawBody)) {
      sendJson(res, 400, { error: 'MP3 must be converted to WAV before it goes to the store.' });
      return;
    }
    const timeoutMs = storeForwardTimeoutMs(preparedHop.converted, hopStarted);
    const hopResult = await tonegridFetch('/tracks/' + id + '/audio', {
      method: 'POST',
      rawBody: preparedHop.rawBody,
      contentType: preparedHop.contentType,
      timeoutMs: timeoutMs,
      idempotencyKey: hopIdempotencyKey('audio', 'POST', '/tracks/' + id + '/audio', bodyFingerprint(preparedHop.rawBody)),
    });
    const hopPayload = hopResult.data && typeof hopResult.data === 'object'
      ? Object.assign({}, hopResult.data)
      : hopResult.data;
    if (hopResult.ok && hopKey && hopPayload && typeof hopPayload === 'object') hopPayload.audio_object_key = hopKey;
    sendJson(res, hopResult.status, hopPayload);
    return;
  } else if (/multipart\/form-data/i.test(contentType)) {
    const declared = Number(headerValue(req, 'content-length') || 0);
    if (declared > MAX_AUDIO_TRANSIT_BYTES) {
      sendJson(res, 413, { error: AUDIO_SEND_COPY });
      return;
    }

    chunkMeta = audioChunks.parseChunkMeta(headerValue, req);
    if (chunkMeta && chunkMeta.totalBytes > MAX_AUDIO_BYTES) {
      sendJson(res, 413, { error: AUDIO_SIZE_COPY });
      return;
    }

    try {
      raw = await readRawBody(req, MAX_AUDIO_TRANSIT_BYTES);
    } catch (err) {
      if (err && err.code === 'TOO_LARGE') {
        sendJson(res, 413, { error: AUDIO_SEND_COPY });
        return;
      }
      sendJson(res, 400, { error: 'Could not read the audio upload.' });
      return;
    }
  } else {
    sendJson(res, 400, { error: 'audio file is required.' });
    return;
  }

  if (!raw || !raw.length) {
    sendJson(res, 400, { error: 'audio file is required.' });
    return;
  }

  if (chunkMeta) {
    const part = audioConvert.parseMultipartAudio(raw);
    const piece = part && part.data && part.data.length ? part.data : raw;
    if (!piece || !piece.length) {
      sendJson(res, 400, { error: 'audio file is required.' });
      return;
    }
    try {
      await audioChunks.saveChunk({
        userId: scope.userId,
        trackId: id,
        meta: Object.assign({}, chunkMeta, {
          filename: chunkMeta.filename || (part && part.filename) || '',
          mime: chunkMeta.mime || (part && part.mime) || '',
        }),
        data: piece,
      });
    } catch (err) {
      if (err && err.code === 'CHUNK_MISMATCH') {
        sendJson(res, 409, { error: AUDIO_SEND_COPY });
        return;
      }
      sendJson(res, 400, { error: AUDIO_SEND_COPY });
      return;
    }
    if (chunkMeta.index < chunkMeta.count - 1) {
      sendJson(res, 200, { received: true, index: chunkMeta.index, count: chunkMeta.count });
      return;
    }
    const assembled = await audioChunks.assemble({
      userId: scope.userId,
      trackId: id,
      uploadId: chunkMeta.uploadId,
    });
    if (!assembled || !assembled.data || !assembled.data.length) {
      sendJson(res, 409, { error: AUDIO_SEND_COPY });
      return;
    }
    if (assembled.data.length > MAX_AUDIO_BYTES) {
      await audioChunks.drop(chunkMeta.uploadId);
      sendJson(res, 413, { error: AUDIO_SIZE_COPY });
      return;
    }
    const wrapped = audioConvert.buildAudioMultipart(
      assembled.filename || 'audio.bin',
      assembled.mime || 'application/octet-stream',
      assembled.data
    );
    if (!looksLikeAudioPart(wrapped.rawBody)) {
      await audioChunks.drop(chunkMeta.uploadId);
      sendJson(res, 400, { error: 'Audio must be WAV, FLAC, or MP3.' });
      return;
    }
    const preparedChunk = await audioConvert.prepareFromBytes(
      assembled.data,
      assembled.filename,
      assembled.mime
    );
    if (preparedChunk.error) {
      await audioChunks.drop(chunkMeta.uploadId);
      sendJson(res, 400, { error: preparedChunk.error });
      return;
    }
    if (preparedChunk.converted && !audioConvert.toneGridBodyIsWav(preparedChunk.rawBody)) {
      await audioChunks.drop(chunkMeta.uploadId);
      sendJson(res, 400, { error: 'MP3 must be converted to WAV before it goes to the store.' });
      return;
    }
    const chunkHop = await tonegridFetch('/tracks/' + id + '/audio', {
      method: 'POST',
      rawBody: preparedChunk.rawBody,
      contentType: preparedChunk.contentType || contentType,
      idempotencyKey: hopIdempotencyKey(
        'audio',
        'POST',
        '/tracks/' + id + '/audio',
        bodyFingerprint(preparedChunk.rawBody || assembled.data)
      ),
    });
    await audioChunks.drop(chunkMeta.uploadId);
    sendJson(res, chunkHop.status, chunkHop.data);
    return;
  }

  if (!looksLikeAudioPart(raw)) {
    sendJson(res, 400, { error: 'Audio must be WAV, FLAC, or MP3.' });
    return;
  }

  const prepared = await audioConvert.prepareToneGridAudio(raw);
  if (prepared.error) {
    sendJson(res, 400, { error: prepared.error });
    return;
  }
  if (prepared.converted && !audioConvert.toneGridBodyIsWav(prepared.rawBody)) {
    sendJson(res, 400, { error: 'MP3 must be converted to WAV before it goes to the store.' });
    return;
  }

  const result = await tonegridFetch('/tracks/' + id + '/audio', {
    method: 'POST',
    rawBody: prepared.rawBody,
    contentType: prepared.contentType || hopType || contentType,
    idempotencyKey: hopIdempotencyKey('audio', 'POST', '/tracks/' + id + '/audio', bodyFingerprint(prepared.rawBody || raw)),
  });
  const payload = result.data && typeof result.data === 'object' ? Object.assign({}, result.data) : result.data;
  if (result.ok && hopKey && payload && typeof payload === 'object') payload.audio_object_key = hopKey;
  sendJson(res, result.status, payload);
}

function pickSummary(payload) {
  const raw = asObject(payload);
  const topRelease = raw.top_release && typeof raw.top_release === 'object' ? raw.top_release : null;
  return {
    from: typeof raw.from === 'string' ? raw.from : '',
    to: typeof raw.to === 'string' ? raw.to : '',
    total_streams: toNumber(raw.total_streams),
    total_revenue_usd: raw.total_revenue_usd == null || raw.total_revenue_usd === ''
      ? null
      : toNumber(raw.total_revenue_usd),
    top_release: topRelease
      ? {
          uuid: typeof topRelease.uuid === 'string' ? topRelease.uuid : '',
          title: typeof topRelease.title === 'string' ? topRelease.title : '',
          streams: toNumber(topRelease.streams),
        }
      : null,
    top_dsp: typeof raw.top_dsp === 'string' ? raw.top_dsp : '',
    top_territory: typeof raw.top_territory === 'string' ? raw.top_territory : '',
  };
}

function pickReleases(payload) {
  return asList(payload).map((row) => ({
    release_uuid: String((row && (row.release_uuid || row.uuid)) || '').trim(),
    title: String((row && row.title) || '').trim(),
    streams: toNumber(row && row.streams),
  }));
}

function pickTerritories(payload) {
  return asList(payload).map((row) => ({
    territory: String((row && (row.territory || row.country)) || '').trim(),
    country_name: String((row && (row.country_name || row.name)) || '').trim(),
    streams: toNumber(row && row.streams),
  }));
}

function pickDsps(payload) {
  return asList(payload).map((row) => ({
    dsp: String((row && (row.dsp || row.name || row.platform)) || '').trim(),
    streams: toNumber(row && row.streams),
  }));
}

function pickSeries(payload) {
  const raw = asObject(payload);
  const candidates = [raw.series, raw.monthly, raw.history, raw.months];
  for (let i = 0; i < candidates.length; i += 1) {
    if (!Array.isArray(candidates[i]) || !candidates[i].length) continue;
    const series = candidates[i].map((row) => ({
      label: String((row && (row.label || row.month || row.period || row.from)) || '').trim(),
      streams: toNumber(row && (row.streams != null ? row.streams : row.value)),
      revenue_usd: row && row.revenue_usd != null ? toNumber(row.revenue_usd) : null,
    })).filter((row) => row.label);
    if (series.length) return series;
  }
  return [];
}

function emptyAnalytics(query) {
  const healthInfo = healthPayload();
  return {
    configured: true,
    sandbox: healthInfo.sandbox,
    empty: true,
    from: (query && query.from) || '',
    to: (query && query.to) || '',
    summary: pickSummary({}),
    releases: [],
    territories: [],
    dsps: [],
    series: [],
  };
}

function mergeNamed(rows, keyName) {
  const map = new Map();
  rows.forEach((row) => {
    const key = String((row && row[keyName]) || '').trim();
    if (!key) return;
    const current = map.get(key) || Object.assign({}, row, { streams: 0 });
    current.streams += toNumber(row && row.streams);
    if (!current[keyName]) current[keyName] = key;
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.streams - a.streams);
}

function summaryFromReleases(rows, query) {
  let total = 0;
  let top = null;
  rows.forEach((row) => {
    const streams = toNumber(row && row.streams);
    total += streams;
    if (!top || streams > top.streams) {
      top = {
        uuid: String((row && row.release_uuid) || ''),
        title: String((row && row.title) || ''),
        streams,
      };
    }
  });
  return {
    from: (query && query.from) || '',
    to: (query && query.to) || '',
    total_streams: total,
    total_revenue_usd: 0,
    top_release: top && top.streams ? top : null,
    top_dsp: '',
    top_territory: '',
  };
}

function dateQuery(req) {
  const query = queryFromReq(req);
  const out = {};
  if (query.from !== undefined && query.from !== '') {
    const from = normalizeReleaseDate(query.from);
    if (!from) return { error: 'from must be YYYY-MM-DD.' };
    out.from = from;
  }
  if (query.to !== undefined && query.to !== '') {
    const to = normalizeReleaseDate(query.to);
    if (!to) return { error: 'to must be YYYY-MM-DD.' };
    out.to = to;
  }
  return { query: out };
}

async function loadAnalytics(req, res) {
  const dates = dateQuery(req);
  if (dates.error) {
    sendJson(res, 400, { error: dates.error });
    return;
  }

  const scope = await personalScope(req, res);
  if (!scope) return;
  if (rejectHold(res, scope)) return;

  const query = dates.query || {};
  const rawRelease = String(queryFromReq(req).release_uuid || queryFromReq(req).releaseUuid || '').trim();
  if (rawRelease && !isUuid(rawRelease)) {
    sendJson(res, 400, { error: 'release_uuid must be a uuid.' });
    return;
  }
  if (rawRelease && !idAllowed(scope.allow, rawRelease)) {
    sendJson(res, 200, emptyAnalytics(query));
    return;
  }
  if (scope.empty) {
    sendJson(res, 200, emptyAnalytics(query));
    return;
  }

  const releaseFilter = rawRelease || '';
  const releasesRes = await tonegridFetch('/analytics/releases', { method: 'GET', query });
  const errors = {};
  if (!releasesRes.ok) errors.releases = sectionError(releasesRes);

  const releaseRows = (releasesRes.ok ? pickReleases(releasesRes.data) : []).filter((row) => {
    if (releaseFilter) return String(row.release_uuid).toLowerCase() === releaseFilter.toLowerCase();
    return idAllowed(scope.allow, row.release_uuid);
  });

  const ids = releaseFilter ? [releaseFilter] : scope.releaseIds;
  const territoryLists = [];
  const dspLists = [];
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const scopedQuery = Object.assign({}, query, { release_uuid: id });
    const [territoriesRes, dspsRes] = await Promise.all([
      tonegridFetch('/analytics/territories', { method: 'GET', query: scopedQuery }),
      tonegridFetch('/analytics/dsps', { method: 'GET', query: scopedQuery }),
    ]);
    if (territoriesRes.ok) territoryLists.push(pickTerritories(territoriesRes.data));
    else errors.territories = sectionError(territoriesRes);
    if (dspsRes.ok) dspLists.push(pickDsps(dspsRes.data));
    else errors.dsps = sectionError(dspsRes);
  }

  const territories = mergeNamed(territoryLists.flat(), 'territory');
  let dsps = mergeNamed(dspLists.flat(), 'dsp');
  const userStreams = releaseRows.reduce((sum, row) => sum + toNumber(row.streams), 0);
  const dspStreams = dsps.reduce((sum, row) => sum + toNumber(row.streams), 0);
  if (dspStreams > userStreams + 1) dsps = [];

  const summary = summaryFromReleases(releaseRows, query);
  if (dsps[0]) summary.top_dsp = dsps[0].dsp;
  if (territories[0]) summary.top_territory = territories[0].territory || territories[0].country_name || '';

  const healthInfo = healthPayload();
  const body = {
    configured: true,
    sandbox: healthInfo.sandbox,
    empty: releaseRows.length === 0 && userStreams === 0,
    from: summary.from || query.from || '',
    to: summary.to || query.to || '',
    summary,
    releases: releaseRows,
    territories,
    dsps,
    series: [],
  };
  if (Object.keys(errors).length) body.errors = errors;
  sendJson(res, 200, body);
}

async function analytics(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await loadAnalytics(req, res);
}

function pickBalance(payload) {
  const raw = asObject(payload);
  return {
    available_usd: toNumber(raw.available_usd),
    pending_usd: toNumber(raw.pending_usd),
    currency: typeof raw.currency === 'string' && raw.currency ? raw.currency : 'USD',
    last_updated: typeof raw.last_updated === 'string' ? raw.last_updated : '',
  };
}

function isStatementId(value) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(String(value || ''));
}

function pickStatement(row) {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.id || '').trim();
  return {
    id,
    period: String(row.period || '').trim(),
    total_usd: toNumber(row.total_usd),
    status: String(row.status || '').trim(),
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

function asStatements(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.statements)) return payload.statements;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.statements)) return payload.data.statements;
  return [];
}

function pickBreakdown(payload) {
  const raw = payload && typeof payload === 'object' ? payload : {};
  const statement = raw.statement && typeof raw.statement === 'object' ? raw.statement : raw;
  const rows = Array.isArray(statement.breakdown)
    ? statement.breakdown
    : (Array.isArray(raw.breakdown) ? raw.breakdown : []);
  return rows.map((row) => ({
    release_title: String((row && row.release_title) || '').trim(),
    dsp: String((row && row.dsp) || '').trim(),
    streams: toNumber(row && row.streams),
    revenue_usd: toNumber(row && row.revenue_usd),
  }));
}

function emptyRoyalties() {
  const healthInfo = healthPayload();
  return {
    configured: true,
    sandbox: healthInfo.sandbox,
    empty: true,
    balance: pickBalance({}),
    statements: [],
    breakdown: [],
  };
}

function lineMatches(row, allow, titles) {
  const uuid = String((row && (row.release_uuid || row.uuid)) || '').trim().toLowerCase();
  if (uuid && allow.has(uuid)) return true;
  const title = String((row && (row.release_title || row.title)) || '').trim().toLowerCase();
  return Boolean(title && titles.has(title));
}

async function loadRoyalties(req, res) {
  const scope = await personalScope(req, res);
  if (!scope) return;
  if (rejectHold(res, scope)) return;

  const healthInfo = healthPayload();
  if (scope.empty) {
    sendJson(res, 200, emptyRoyalties());
    return;
  }

  const titles = new Set();
  for (let i = 0; i < scope.releaseIds.length; i += 1) {
    const result = await tonegridFetch('/releases/' + scope.releaseIds[i], { method: 'GET' });
    const row = result.ok ? unwrapRelease(result.data) : null;
    const title = row && String(row.title || '').trim().toLowerCase();
    if (title) titles.add(title);
  }

  const statementsRes = await tonegridFetch('/royalties/statements', { method: 'GET' });
  const errors = {};
  if (!statementsRes.ok) errors.statements = sectionError(statementsRes);

  const listed = statementsRes.ok
    ? asStatements(statementsRes.data).map(pickStatement).filter(Boolean)
    : [];

  const statements = [];
  let breakdown = [];
  for (let i = 0; i < listed.length; i += 1) {
    const item = listed[i];
    if (!item.id || !isStatementId(item.id)) continue;
    const detail = await tonegridFetch('/royalties/statements/' + item.id, { method: 'GET' });
    if (!detail.ok) {
      errors.statement = sectionError(detail);
      continue;
    }
    const lines = pickBreakdown(detail.data).filter((row) => lineMatches(row, scope.allow, titles));
    if (!lines.length) continue;
    const total = lines.reduce((sum, row) => sum + toNumber(row.revenue_usd), 0);
    statements.push(Object.assign({}, item, { total_usd: total }));
    if (!breakdown.length) breakdown = lines;
  }

  const lifetime = statements.reduce((sum, row) => sum + toNumber(row.total_usd), 0);
  const body = {
    configured: true,
    sandbox: healthInfo.sandbox,
    empty: statements.length === 0 && breakdown.length === 0,
    balance: {
      available_usd: lifetime,
      pending_usd: 0,
      currency: 'USD',
      last_updated: '',
    },
    statements,
    breakdown,
  };
  if (Object.keys(errors).length) body.errors = errors;
  sendJson(res, 200, body);
}

async function royalties(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await loadRoyalties(req, res);
}

function mergeStoreRows(into, rows) {
  const seen = Object.create(null);
  into.forEach((row) => { if (row && row.slug) seen[row.slug] = true; });
  (rows || []).forEach((row) => {
    if (!row || !row.slug || seen[row.slug]) return;
    seen[row.slug] = true;
    into.push(row);
  });
  return into;
}

async function loadOfficialStores() {
  if (!isConfigured()) {
    return {
      configured: false,
      source: 'tonegrid-docs',
      stores: documentedStores().map((slug) => ({ slug, name: slug })),
      youtube_music: YOUTUBE_MUSIC_SLUG,
    };
  }
  const stores = [];
  let page = 1;
  let cursor = '';
  let live = false;
  for (let hop = 0; hop < 20; hop += 1) {
    const query = { per_page: 100, page: page };
    if (cursor) query.cursor = cursor;
    const result = await tonegridFetch('/supply-chain/dsps', {
      method: 'GET',
      query: query,
      timeoutMs: LIST_HOP_TIMEOUT_MS,
    });
    if (!result.ok) break;
    const rows = parseStoreRows(result.data);
    if (!rows.length && !stores.length) break;
    mergeStoreRows(stores, rows);
    live = stores.length > 0;
    const meta = parseStoreListMeta(result.data);
    if (meta.nextCursor && (meta.hasMore || hop === 0)) {
      cursor = meta.nextCursor;
      continue;
    }
    if (meta.lastPage && page < meta.lastPage) {
      page += 1;
      cursor = '';
      continue;
    }
    if (meta.total && stores.length < meta.total && rows.length) {
      page += 1;
      cursor = '';
      continue;
    }
    if (!meta.lastPage && !meta.nextCursor && rows.length >= 100) {
      page += 1;
      continue;
    }
    break;
  }
  const fallback = documentedStores().map((slug) => ({ slug, name: slug }));
  return {
    configured: true,
    source: live ? 'tonegrid' : 'tonegrid-docs',
    stores: stores.length ? stores : fallback,
    youtube_music: YOUTUBE_MUSIC_SLUG,
  };
}

async function stores(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  sendJson(res, 200, await loadOfficialStores());
}

function requestedStores(body) {
  if (!body) return null;
  if (Array.isArray(body.dsps)) return body.dsps;
  if (Array.isArray(body.stores)) return body.stores;
  return null;
}

function isMissingEndpoint(result) {
  if (!result || result.ok || result.status !== 404) return false;
  return /endpoint not found/i.test(String((result.data && result.data.error) || ''));
}

function isReleaseGoneResult(result) {
  if (!result || result.ok) return false;
  if (result.status === 404) return true;
  const msg = String((result.data && (result.data.error || result.data.message)) || '').toLowerCase();
  return /release not found/.test(msg);
}

async function tonegridReleaseExists(releaseId) {
  if (!isUuid(releaseId)) return false;
  const loaded = await fetchReleaseRow(releaseId);
  if (loaded.result && loaded.result.ok) return true;
  return false;
}

async function requireOwnedRelease(req, res, releaseId) {
  const scope = await personalScope(req, res);
  if (!scope) return null;
  const id = String(releaseId || '').trim();
  if (!isUuid(id)) {
    sendJson(res, 400, { error: 'release id must be a uuid.' });
    return null;
  }
  if (!idAllowed(scope.allow, id)) {
    if (isKnownAdoptRelease(id) && !isProtectedCatalogRelease(id)) {
      const loaded = await fetchReleaseRow(id);
      if (loaded.row && knownLeftoverBelongsToScope(scope, loaded.row)) {
        await accounts.updateCatalog(scope.userId, { releaseId: id });
        const nextIds = releaseIdsFrom({
          tonegrid_release_ids: (scope.releaseIds || []).concat([id]),
        });
        const latest = await accounts.findById(scope.userId);
        return Object.assign({}, scope, {
          row: latest || scope.row,
          releaseIds: nextIds,
          allow: allowedSet(nextIds),
        });
      }
    }
    sendJson(res, 404, { error: 'Release not found.' });
    return null;
  }
  return scope;
}

async function fetchReleaseRow(releaseId) {
  const result = await tonegridFetch('/releases/' + releaseId, { method: 'GET' });
  if (!result.ok) return { result, row: null };
  const row = pickRelease(unwrapRelease(result.data));
  if (row && !row.tracks.length) {
    const tracksRes = await tonegridFetch('/releases/' + releaseId + '/tracks', { method: 'GET' });
    if (tracksRes.ok) row.tracks = pickTracks(tracksRes.data);
  }
  // GET /releases/:uuid/dsps is not a ToneGrid route (404 Endpoint not found).
  // Store selection is on the release row after POST/PUT /releases/:uuid/dsps.
  // Live store stream IDs come from GET /releases/:uuid/ddex/deliveries.
  if (row) await attachDeliveries(row, releaseId);
  return { result, row };
}

async function getOneRelease(req, res, releaseId) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, PUT, DELETE');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  const scope = await requireOwnedRelease(req, res, releaseId);
  if (!scope) return;
  const loaded = await fetchReleaseRow(releaseId);
  const localStatus = localReleaseStatusOf(scope.row, releaseId);
  if (!loaded.result.ok) {
    if (isReleaseGoneResult(loaded.result) && (isRemovingStoreStatus(localStatus) || isGoneHiddenStatus(localStatus))) {
      if (isRemovingStoreStatus(localStatus)) await hideGoneRelease(scope.row, releaseId);
    }
    sendJson(res, loaded.result.status, loaded.result.data);
    return;
  }
  if (loaded.row) {
    loaded.row.status = displayStoreStatus(loaded.row.status);
    await persistReleaseMeta(
      scope.row,
      releaseId,
      loaded.row.status,
      loaded.row.rejection_reason,
      loaded.row.artwork_url,
      '',
      filledCreditsFromRow(loaded.row),
      { release: loaded.row, links: growthEvents.publicStoreLinks(loaded.row) }
    );
  }
  sendJson(res, 200, Object.assign({ configured: true, sandbox: healthPayload().sandbox }, loaded.row));
}

function webhookSecret() {
  return String(process.env.TONEGRID_WEBHOOK_SECRET || '').trim();
}

async function webhook(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const secret = webhookSecret();
  if (secret) {
    const got = headerValue(req, 'x-tonegrid-signature')
      || headerValue(req, 'x-webhook-secret')
      || headerValue(req, 'authorization').replace(/^Bearer\s+/i, '');
    if (got !== secret) {
      sendJson(res, 401, { error: 'Invalid webhook signature.' });
      return;
    }
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const data = body && typeof body === 'object' ? body : {};
  const nested = data.data && typeof data.data === 'object' ? data.data : {};
  const release = nested.release && typeof nested.release === 'object' ? nested.release : (data.release || {});
  const releaseId = String(
    data.release_id
    || data.releaseId
    || release.uuid
    || release.id
    || nested.release_id
    || ''
  ).trim();
  const status = String(data.status || data.tonegrid_status || release.status || nested.status || '').trim().toLowerCase();
  const reason = String(
    data.rejection_reason
    || data.reason
    || data.message
    || release.rejection_reason
    || release.reason
    || ''
  ).trim();
  if (!isUuid(releaseId)) {
    sendJson(res, 400, { error: 'release_id must be a uuid.' });
    return;
  }

  const row = await accounts.findByReleaseId(releaseId);
  if (!row) {
    sendJson(res, 404, { error: 'Release not found.' });
    return;
  }
  const incoming = normalizeReleaseStatus(status);
  if (incoming === 'taken_down' || incoming === 'deleted' || incoming === 'gone' || incoming === 'purged' || incoming === 'removed') {
    const loaded = await fetchReleaseRow(releaseId);
    if (isReleaseGoneResult(loaded.result)) {
      await hideGoneRelease(row, releaseId);
      sendJson(res, 200, { ok: true, release_id: releaseId, removed: true });
      return;
    }
    if (loaded.result && loaded.result.ok) {
      await persistReleaseMeta(row, releaseId, 'takedown_submitted', reason);
      sendJson(res, 200, { ok: true, release_id: releaseId, status: 'takedown_submitted', removed: false });
      return;
    }
  }
  const nextStatus = incoming === 'taken_down' ? 'takedown_submitted' : status;
  await persistReleaseMeta(row, releaseId, nextStatus, reason);
  sendJson(res, 200, { ok: true, release_id: releaseId, status: nextStatus || undefined });
}

function releaseUpdatePayload(body) {
  const payload = {};
  if (!body || typeof body !== 'object') return { payload };
  const fields = uploadRequired.validateReleaseUpdate(body);
  if (fields.error) return { error: fields.error };
  if (body.title !== undefined) {
    payload.title = String(body.title || '').trim();
  }
  if (body.release_date !== undefined || body.releaseDate !== undefined) {
    const date = normalizeReleaseDate(body.release_date || body.releaseDate);
    if ((body.release_date || body.releaseDate) && !date) {
      return { error: 'release_date must be YYYY-MM-DD.' };
    }
    if (date) payload.release_date = date;
  }
  if (body.genre !== undefined) {
    payload.genre = String(body.genre || '').trim();
  }
  if (body.language !== undefined) {
    const language = normalizeLanguage(body.language);
    if (language) payload.language = language;
  }
  return { payload };
}

async function updateRelease(req, res, releaseId) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  const scope = await requireOwnedRelease(req, res, releaseId);
  if (!scope) return;

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const parsed = releaseUpdatePayload(body);
  if (parsed.error) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }
  if (!Object.keys(parsed.payload).length) {
    sendJson(res, 400, { error: 'Provide title, release_date, genre, or language.' });
    return;
  }

  const result = await tonegridFetch('/releases/' + releaseId, {
    method: 'PATCH',
    body: parsed.payload,
    idempotencyKey: hopIdempotencyKey('patch-release', 'PATCH', '/releases/' + releaseId, JSON.stringify(parsed.payload)),
  });
  if (result.ok) {
    const stored = rosterOf(scope.row);
    await accounts.updateProfile(scope.row.id, {
      profile: profileLib.upsertRelease(stored, Object.assign({
        id: releaseId,
        tonegrid_release_id: releaseId,
      }, parsed.payload)),
    });
  }
  sendJson(res, result.status, result.data);
}

async function attachStores(releaseId, slugs) {
  const dsps = withYouTubeMusic(slugs && slugs.length ? slugs : DOCUMENTED_DSPS);
  const path = '/releases/' + releaseId + '/dsps';
  const posted = await tonegridFetch(path, {
    method: 'POST',
    body: { dsps },
    idempotencyKey: hopIdempotencyKey('dsps-post', 'POST', path, dsps.join(',')),
  });
  if (posted.ok || !isMissingEndpoint(posted)) return posted;
  return tonegridFetch(path, {
    method: 'PUT',
    body: { dsps },
    idempotencyKey: hopIdempotencyKey('dsps-put', 'PUT', path, dsps.join(',')),
  });
}

async function replaceStores(releaseId, slugs) {
  const dsps = withYouTubeMusic(slugs || []);
  const path = '/releases/' + releaseId + '/dsps';
  return tonegridFetch(path, {
    method: 'PUT',
    body: { dsps },
    idempotencyKey: hopIdempotencyKey('dsps-put', 'PUT', path, dsps.join(',')),
  });
}

async function releaseDsps(req, res, releaseId) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method !== 'POST' && req.method !== 'PUT') {
    res.setHeader('Allow', 'POST, PUT');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const scope = await requireOwnedRelease(req, res, releaseId);
  if (!scope) return;
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  const slugs = requestedStores(body);
  const result = req.method === 'PUT'
    ? await replaceStores(releaseId, slugs || [])
    : await attachStores(releaseId, slugs || []);
  sendJson(res, result.status, result.data);
}

async function submitRelease(req, res, releaseId) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  const id = String(releaseId || '').trim();
  if (!id || !isUuid(id)) {
    sendJson(res, 400, { error: 'Save the upload first.' });
    return;
  }
  const scope = await requireOwnedRelease(req, res, releaseId);
  if (!scope) return;

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  let documentId = String((body && (body.document_id || body.documentId || body.signwell_document_id)) || '').trim();
  const solo = uploadRequired.isSoloOwned(body);
  let signwellInfo = { signed: false, status: '', document: null };

  if (solo) {
    documentId = '';
    signwellInfo = { signed: false, status: 'solo', document: null };
  } else {
    if (!documentId) {
      const songTitle = String((body && (body.songTitle || body.song_title || body.title)) || '').trim();
      const writers = body && body.writers;
      if (songTitle && Array.isArray(writers) && writers.length >= 2 && typeof signwellApi.createSplitDocument === 'function') {
        const created = await signwellApi.createSplitDocument({
          songTitle: songTitle,
          writers: writers,
          emailLinkOnly: true,
        });
        if (!created.ok) {
          sendJson(res, created.status, created.data || { error: 'Could not create the split sheet.', signed: false });
          return;
        }
        documentId = String((created.data && created.data.documentId) || '').trim();
        signwellInfo = {
          signed: Boolean(created.data && created.data.signed),
          status: (created.data && created.data.signwell_status) || 'awaiting_signature',
          document: created.data || null,
        };
      }
    }
    if (!documentId) {
      sendJson(res, 403, {
        error: 'Create the split sheet before submitting.',
        code: 'SIGNWELL_REQUIRED',
        signed: false,
        document: null,
      });
      return;
    }
    if (signwell.isConfigured()) {
      const looked = await signwell.getDocument(documentId);
      if (looked.ok) {
        const info = signwell.publicDocument(looked.data);
        signwellInfo = {
          signed: Boolean(info.signed),
          status: info.signed ? info.status : (info.status || 'awaiting_signature'),
          document: info,
        };
      } else if (!signwellInfo.status) {
        signwellInfo = { signed: false, status: 'awaiting_signature', document: null };
      }
    } else if (!signwellInfo.status) {
      signwellInfo = { signed: false, status: 'awaiting_signature', document: null };
    }
  }

  const loaded = await fetchReleaseRow(releaseId);
  if (!loaded.result.ok) {
    sendJson(res, loaded.result.status, loaded.result.data);
    return;
  }
  const row = loaded.row || {};
  const status = String(row.status || '').toLowerCase();
  if (status === 'pending' || status === 'approved' || status === 'live') {
    sendJson(res, 200, {
      ok: true,
      skipped: true,
      status,
      signed: true,
      message: 'Release is already ' + status + '.',
    });
    return;
  }
  if (status && !SUBMITTABLE.has(status)) {
    sendJson(res, 409, {
      error: 'Only draft or rejected releases can be submitted.',
      status,
      signed: true,
    });
    return;
  }

  const songwriter = songwriterFromHop(body, scope.row);
  if (songwriter.error) {
    sendJson(res, 400, { error: songwriter.error });
    return;
  }

  const submitFields = uploadRequired.validateSubmit(body, row);
  if (submitFields.error) {
    sendJson(res, 400, { error: submitFields.error });
    return;
  }

  let releaseDate = normalizeReleaseDate((body && (body.release_date || body.releaseDate)) || row.release_date);
  const minDate = minSubmitDate();
  if (!releaseDate) {
    sendJson(res, 400, { error: 'release_date is required.' });
    return;
  }
  if (releaseDate < minDate) releaseDate = minDate;
  if (releaseDate !== row.release_date) {
    const dated = await tonegridFetch('/releases/' + releaseId, {
      method: 'PATCH',
      body: { release_date: releaseDate },
      idempotencyKey: hopIdempotencyKey('patch-date', 'PATCH', '/releases/' + releaseId, releaseDate),
    });
    if (!dated.ok) {
      sendJson(res, dated.status, dated.data);
      return;
    }
  }

  const slugs = requestedStores(body);
  const attached = await attachStores(releaseId, slugs || DOCUMENTED_DSPS);
  if (!attached.ok) {
    const existing = (row.dsps || []).length;
    if (!isMissingEndpoint(attached) || !existing) {
      sendJson(res, attached.status, attached.data);
      return;
    }
  }

  const creditYear = storeCredits.copyrightYearFromDate(body && (body.copyright_year || body.copyrightYear))
    || storeCredits.copyrightYearFromDate(releaseDate);
  const hopCredits = storeCredits.creditsFromHop(body, songwriter, creditYear);
  const credits = storeCredits.storedCreditFields(hopCredits);
  const credited = await applyReleaseCredits(releaseId, hopCredits, { patch: true });
  if (!credited.ok) {
    sendJson(res, credited.status, credited.data);
    return;
  }
  const trackIds = [];
  (row.tracks || []).forEach((tr) => {
    const tid = tr && (tr.uuid || tr.id);
    if (tid) trackIds.push(String(tid));
  });
  if (body && body.track_id) trackIds.push(String(body.track_id));
  if (body && Array.isArray(body.track_ids)) {
    body.track_ids.forEach((tid) => trackIds.push(String(tid)));
  }
  const seenTracks = {};
  const aiFields = storeAi.trackAiFields(body);
  for (let i = 0; i < trackIds.length; i += 1) {
    const tid = String(trackIds[i] || '').trim();
    if (!isUuid(tid) || seenTracks[tid]) continue;
    seenTracks[tid] = true;
    const writersHop = await attachTrackWriters(tid, songwriter);
    if (!writersHop.ok) {
      sendJson(res, writersHop.status, writersHop.data);
      return;
    }
    if (aiFields) {
      const tagged = await applyTrackAiDisclosure(tid, aiFields);
      if (!tagged.ok) {
        sendJson(res, tagged.status, tagged.data);
        return;
      }
    }
  }

  const submitted = await tonegridFetch('/releases/' + releaseId + '/submit', {
    method: 'POST',
    body: {},
    idempotencyKey: hopIdempotencyKey('submit', 'POST', '/releases/' + releaseId + '/submit', releaseId),
  });
  if (!submitted.ok) {
    sendJson(res, submitted.status, submitted.data);
    return;
  }

  const next = unwrapRelease(submitted.data) || submitted.data || {};
  const submittedStatus = String(next.status || 'pending').toLowerCase();
  const splitMeta = splitSheets.persistFields(body, solo, signwellInfo, documentId, songwriter);
  await persistReleaseMeta(scope.row, releaseId, submittedStatus, '', '', '', Object.assign({}, credits || {}, splitMeta));
  sendJson(res, submitted.status, {
    ok: true,
    signed: Boolean(signwellInfo.signed),
    signwell_status: signwellInfo.status || (solo ? 'solo' : 'awaiting_signature'),
    document_id: documentId || null,
    status: String(next.status || 'pending').toLowerCase(),
    message: typeof next.message === 'string' ? next.message : 'Release submitted for review.',
    release_date: releaseDate,
    dsps: withYouTubeMusic(slugs || DOCUMENTED_DSPS),
    document: signwellInfo.document,
  });
}

function looksLikeArtPart(buf) {
  const head = buf.slice(0, 8192).toString('latin1');
  if (/filename="[^"]+\.(jpe?g|png)"/i.test(head)) return true;
  if (/filename="/i.test(head) && !/\.(jpe?g|png)"/i.test(head)) return false;
  return true;
}

async function releaseArtwork(req, res, releaseId) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const scope = await requireOwnedRelease(req, res, releaseId);
  if (!scope) return;

  const contentType = headerValue(req, 'content-type');
  let raw = null;
  let hopKey = '';
  let hopType = contentType;
  if (/application\/json/i.test(contentType)) {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'artwork file is required.' });
      return;
    }
    hopKey = objectKeyFromBody(body);
    if (!hopKey) {
      sendJson(res, 400, { error: 'artwork file is required.' });
      return;
    }
    let hopped;
    try {
      hopped = await loadHoppedObject(scope, hopKey, 'cover');
    } catch (err) {
      sendJson(res, (err && err.status) || 400, { error: (err && err.message) || objectStore.STEP_FAIL_COPY });
      return;
    }
    const wrapped = objectStore.asMultipart('artwork', hopped.filename, hopped.contentType || 'image/jpeg', hopped.body);
    raw = wrapped.rawBody;
    hopType = wrapped.contentType;
  } else if (/multipart\/form-data/i.test(contentType)) {
    const declared = Number(headerValue(req, 'content-length') || 0);
    if (declared > MAX_ARTWORK_BYTES) {
      sendJson(res, 413, { error: 'Artwork must be 15 MB or smaller.' });
      return;
    }
    try {
      raw = await readRawBody(req, MAX_ARTWORK_BYTES);
    } catch (err) {
      if (err && err.code === 'TOO_LARGE') {
        sendJson(res, 413, { error: 'Artwork must be 15 MB or smaller.' });
        return;
      }
      sendJson(res, 400, { error: 'Could not read the artwork upload.' });
      return;
    }
  } else {
    sendJson(res, 400, { error: 'artwork file is required.' });
    return;
  }
  if (!raw || !raw.length) {
    sendJson(res, 400, { error: 'artwork file is required.' });
    return;
  }
  if (!looksLikeArtPart(raw)) {
    sendJson(res, 400, { error: 'Artwork must be JPG or PNG.' });
    return;
  }
  const result = await tonegridFetch('/releases/' + releaseId + '/artwork', {
    method: 'POST',
    rawBody: raw,
    contentType: hopType || contentType,
    idempotencyKey: hopIdempotencyKey('artwork', 'POST', '/releases/' + releaseId + '/artwork', bodyFingerprint(raw)),
  });
  const uploaded = coverUrl.from(result && result.data) || coverUrl.from(unwrapRelease(result && result.data));
  if (result.ok && (uploaded || hopKey)) {
    await persistReleaseMeta(scope.row, releaseId, null, undefined, uploaded, hopKey);
  }
  const payload = result.data && typeof result.data === 'object' ? Object.assign({}, result.data) : result.data;
  if (result.ok && hopKey && payload && typeof payload === 'object') payload.artwork_object_key = hopKey;
  sendJson(res, result.status, payload);
}

async function trackOwned(scope, trackId) {
  if (idAllowed(scope.trackAllow, trackId)) return true;
  for (let i = 0; i < scope.releaseIds.length; i += 1) {
    const loaded = await fetchReleaseRow(scope.releaseIds[i]);
    const tracks = loaded.row && loaded.row.tracks ? loaded.row.tracks : [];
    if (tracks.some((row) => String(row.uuid).toLowerCase() === trackId.toLowerCase())) return true;
  }
  return false;
}

async function updateTrack(req, res, trackId) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const id = String(trackId || '').trim();
  if (!isUuid(id)) {
    sendJson(res, 400, { error: 'track id must be a uuid.' });
    return;
  }
  const scope = await personalScope(req, res);
  if (!scope) return;
  if (!(await trackOwned(scope, id))) {
    sendJson(res, 404, { error: 'Track not found.' });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const payload = {};
  const trackFields = uploadRequired.validateTrackUpdate(body);
  if (trackFields.error) {
    sendJson(res, 400, { error: trackFields.error });
    return;
  }
  if (body && body.title !== undefined) {
    payload.title = String(body.title || '').trim();
  }
  if (body && body.language !== undefined) {
    const language = normalizeLanguage(body.language);
    if (language) payload.language = language;
  }
  if (body && body.explicit !== undefined) {
    const explicit = parseExplicit(body.explicit);
    if (explicit == null) {
      sendJson(res, 400, { error: 'explicit must be true or false.' });
      return;
    }
    payload.explicit = explicit;
  }
  storeAi.applyTrackAiFields(payload, body);
  if (!Object.keys(payload).length) {
    sendJson(res, 400, { error: 'Provide title, language, or explicit.' });
    return;
  }

  const result = await tonegridFetch('/tracks/' + id, {
    method: 'PATCH',
    body: payload,
    idempotencyKey: hopIdempotencyKey(
      'track-patch',
      'PATCH',
      '/tracks/' + id,
      [JSON.stringify(payload), headerValue(req, 'idempotency-key') || ''].join('\n')
    ),
  });
  sendJson(res, result.status, result.data);
}

function normalizeReleaseStatus(status) {
  return String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function storeFacingStatus(status) {
  return STORE_FACING.has(normalizeReleaseStatus(status));
}

function cancelFirstStatus(status) {
  return CANCEL_FIRST.has(normalizeReleaseStatus(status));
}

function leftoverDeleteCopy(error) {
  return /only draft or rejected releases can be deleted/i.test(String(error || ''));
}

function displayStoreStatus(status) {
  const s = normalizeReleaseStatus(status);
  if (s === 'taken_down') return 'takedown_submitted';
  return status;
}

function isRemovingStoreStatus(status) {
  const s = normalizeReleaseStatus(status);
  return s === 'takedown_submitted' || s === 'taken_down' || s === 'removing';
}

function isGoneHiddenStatus(status) {
  return normalizeReleaseStatus(status) === 'store_gone';
}

function needsStoreTakedown(status) {
  return storeFacingStatus(status) || cancelFirstStatus(status) || isRemovingStoreStatus(status);
}

function localReleaseStatusOf(row, releaseId) {
  const stored = rosterOf(row);
  const want = String(releaseId || '').trim().toLowerCase();
  const list = (stored && stored.releases) || [];
  for (let i = 0; i < list.length; i += 1) {
    const id = String((list[i] && (list[i].tonegrid_release_id || list[i].id)) || '').trim().toLowerCase();
    if (id && id === want) return normalizeReleaseStatus(list[i].tonegrid_status || list[i].status);
  }
  return '';
}

function isMissingStoreEndpoint(result) {
  if (!result || result.ok) return false;
  if (result.status === 404 || result.status === 405) return true;
  const msg = String((result.data && result.data.error) || '').toLowerCase();
  return /endpoint not found|not (registered|supported|available)|method not allowed/.test(msg);
}

function tonegridErrorOf(result, fallback) {
  const raw = String((result && result.data && result.data.error) || fallback || 'The store rejected the request.');
  if (leftoverDeleteCopy(raw)) return 'The store could not take this release down.';
  return raw;
}

function storeTakedownError(result) {
  if (isMissingStoreEndpoint(result)) return 'The store could not take this release down.';
  return tonegridErrorOf(result, 'The store could not take this release down.');
}

async function requestStoreCancelOrTakedown(releaseId, status) {
  let last = null;
  if (cancelFirstStatus(status)) {
    last = await tonegridFetch('/releases/' + releaseId + '/takedown', {
      method: 'POST',
      body: { reason: 'Artist request.' },
      idempotencyKey: hopIdempotencyKey('takedown', 'POST', '/releases/' + releaseId + '/takedown', releaseId),
    });
    if (last.ok) return last;
  }

  const purged = await tonegridFetch('/releases/' + releaseId + '/ddex/purge', {
    method: 'POST',
    body: {},
    idempotencyKey: hopIdempotencyKey('purge', 'POST', '/releases/' + releaseId + '/ddex/purge', releaseId),
  });
  if (purged.ok) return purged;
  if (last && !isMissingStoreEndpoint(last) && isMissingStoreEndpoint(purged)) return last;
  return purged.ok === false ? purged : last;
}

async function dropLocalRelease(row, releaseId) {
  if (!row || !row.id) return null;
  return accounts.removeRelease(row.id, releaseId);
}

async function hideGoneRelease(row, releaseId) {
  if (!row || !row.id || !releaseId) return row;
  await persistReleaseMeta(row, releaseId, 'store_gone', '');
  return accounts.findById(row.id);
}

function keepLifetimeSlot(status) {
  const s = normalizeReleaseStatus(status);
  return needsStoreTakedown(s) || isGoneHiddenStatus(s);
}

async function dropAfterStoreGone(row, releaseId, status) {
  if (keepLifetimeSlot(status)) return hideGoneRelease(row, releaseId);
  return dropLocalRelease(row, releaseId);
}

async function finishRemoved(res, next, scope, releaseId, extras) {
  sendJson(res, 200, Object.assign({
    ok: true,
    removed: true,
    takedown: false,
    release_id: releaseId,
    redirect: '/releases.html',
    upload: plans.evaluate(next || scope.row),
  }, extras || {}));
}

async function finishTakedownPending(res, row, releaseId) {
  await persistReleaseMeta(row, releaseId, 'takedown_submitted', '');
  sendJson(res, 202, {
    ok: true,
    takedown: true,
    removed: false,
    release_id: releaseId,
    status: 'takedown_submitted',
  });
}

async function deleteRelease(req, res, releaseId) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  const scope = await requireOwnedRelease(req, res, releaseId);
  if (!scope) return;

  const loaded = await fetchReleaseRow(releaseId);
  if (loaded.result && !loaded.result.ok && !isReleaseGoneResult(loaded.result)) {
    sendJson(res, loaded.result.status, {
      error: tonegridErrorOf(loaded.result, 'The store could not load this release.'),
      removed: false,
      takedown: false,
    });
    return;
  }
  const missing = Boolean(loaded.result && isReleaseGoneResult(loaded.result));
  const storeStatus = loaded.row ? normalizeReleaseStatus(loaded.row.status) : '';
  const localStatus = localReleaseStatusOf(scope.row, releaseId);
  const status = storeStatus || localStatus;

  if (missing || isGoneHiddenStatus(localStatus)) {
    const next = await dropAfterStoreGone(scope.row, releaseId, status || localStatus);
    await finishRemoved(res, next, scope, releaseId);
    return;
  }

  if (isRemovingStoreStatus(status) || isRemovingStoreStatus(storeStatus)) {
    const deleted = await deleteStoreRelease(releaseId);
    const again = await fetchReleaseRow(releaseId);
    if (isReleaseGoneResult(again.result) || (isStoreDeleteGone(deleted) && again.result && isReleaseGoneResult(again.result))) {
      const next = await dropAfterStoreGone(scope.row, releaseId, status);
      await finishRemoved(res, next, scope, releaseId);
      return;
    }
    if (again.result && again.result.ok) {
      await finishTakedownPending(res, scope.row, releaseId);
      return;
    }
    if (!isStoreDeleteGone(deleted)) {
      sendJson(res, (deleted && deleted.status) || 502, {
        error: tonegridErrorOf(deleted, 'The store could not remove this release.'),
        removed: false,
        takedown: false,
      });
      return;
    }
    await finishTakedownPending(res, scope.row, releaseId);
    return;
  }

  if (needsStoreTakedown(status)) {
    const cancelled = await requestStoreCancelOrTakedown(releaseId, status);
    if (!cancelled || !cancelled.ok) {
      sendJson(res, (cancelled && cancelled.status) || 502, {
        error: storeTakedownError(cancelled),
        takedown: false,
        removed: false,
      });
      return;
    }
    const again = await fetchReleaseRow(releaseId);
    if (isReleaseGoneResult(again.result)) {
      const next = await dropAfterStoreGone(scope.row, releaseId, status);
      await finishRemoved(res, next, scope, releaseId);
      return;
    }
    await finishTakedownPending(res, scope.row, releaseId);
    return;
  }

  const deleted = await deleteStoreRelease(releaseId);
  if (!isStoreDeleteGone(deleted)) {
    sendJson(res, (deleted && deleted.status) || 502, {
      error: tonegridErrorOf(deleted, 'The store could not remove this release.'),
      removed: false,
      takedown: false,
    });
    return;
  }
  const again = await fetchReleaseRow(releaseId);
  if (again.result && again.result.ok && !isReleaseGoneResult(again.result)) {
    sendJson(res, 409, {
      error: tonegridErrorOf(again.result, 'The store still has this release.'),
      removed: false,
      takedown: false,
    });
    return;
  }

  const next = await dropLocalRelease(scope.row, releaseId);
  await finishRemoved(res, next, scope, releaseId);
}

async function oneRelease(req, res, releaseId) {
  if (req.method === 'GET') {
    await getOneRelease(req, res, releaseId);
    return;
  }
  if (req.method === 'PUT') {
    await updateRelease(req, res, releaseId);
    return;
  }
  if (req.method === 'DELETE') {
    await deleteRelease(req, res, releaseId);
    return;
  }
  res.setHeader('Allow', 'GET, PUT, DELETE');
  sendJson(res, 405, { error: 'Method not allowed.' });
}

async function handler(req, res) {
  const route = routeOf(req);
  if (route.resource === 'health') {
    await health(req, res);
    return;
  }
  if (route.resource === 'stores') {
    await stores(req, res);
    return;
  }
  if (route.resource === 'artists') {
    await artists(req, res);
    return;
  }
  if (route.resource === 'webhook') {
    await webhook(req, res);
    return;
  }
  if (route.resource === 'releases') {
    await releases(req, res);
    return;
  }
  if (route.resource === 'release') {
    await oneRelease(req, res, route.id);
    return;
  }
  if (route.resource === 'submit') {
    await submitRelease(req, res, route.id);
    return;
  }
  if (route.resource === 'dsps') {
    await releaseDsps(req, res, route.id);
    return;
  }
  if (route.resource === 'artwork') {
    await releaseArtwork(req, res, route.id);
    return;
  }
  if (route.resource === 'uploads') {
    await uploads(req, res);
    return;
  }
  if (route.resource === 'tracks') {
    await createTrack(req, res);
    return;
  }
  if (route.resource === 'track') {
    await updateTrack(req, res, route.id);
    return;
  }
  if (route.resource === 'audio') {
    await trackAudio(req, res, route.id);
    return;
  }
  if (route.resource === 'analytics') {
    await analytics(req, res);
    return;
  }
  if (route.resource === 'royalties') {
    await royalties(req, res);
    return;
  }
  sendJson(res, 404, { error: 'Not found.' });
}

handler.config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

module.exports = handler;
module.exports.pickSummary = pickSummary;
module.exports.pickDsps = pickDsps;
module.exports.pickTerritories = pickTerritories;
module.exports.pickDeliveries = livePlayer.pickDeliveries;
module.exports.pickSeries = pickSeries;
