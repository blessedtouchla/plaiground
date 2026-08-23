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
 * GET  /api/tonegrid/releases/:id
 * PUT  /api/tonegrid/releases/:id
 * POST /api/tonegrid/releases/:id/submit
 * POST /api/tonegrid/releases/:id/dsps
 * PUT  /api/tonegrid/releases/:id/dsps
 * POST /api/tonegrid/releases/:id/artwork
 * POST /api/tonegrid/tracks
 * PUT  /api/tonegrid/tracks/:id
 * POST /api/tonegrid/tracks/:id/audio
 * GET  /api/tonegrid/analytics
 * GET  /api/tonegrid/royalties
 *
 * ToneGrid itself (api-docs + sandbox probe): PATCH /releases/:uuid — PUT
 * 404s "Endpoint not found." POST and PUT /releases/:uuid/dsps exist. POST
 * /releases/:uuid/submit exists. GET /releases/:uuid/dsps is not registered.
 * Each ToneGrid write uses a hop-scoped Idempotency-Key (patch-date,
 * dsps-post, dsps-put, submit) plus method, path, and body fingerprint.
 * Never forward the browser plaiground-submit-<id> key to every hop.
 * Server-only env: TONEGRID_API_KEY, TONEGRID_BASE_URL (never echo these).
 * Solo 100% submit skips SignWell. Multi-writer submit creates or reuses a
 * SignWell document and emails other writers, then submits to ToneGrid without
 * waiting for every signature. Never call /distribute or /approve.
 */

const accounts = require('../lib/accounts');
const plans = require('../lib/plans');
const signwell = require('../lib/signwell');
const signwellApi = require('./signwell');
const uploadRequired = require('../lib/upload-required');
const audioConvert = require('../lib/audio-convert');
const { personalScope, idAllowed, rejectHold } = require('../lib/scope');
const { pathnameOf, queryOf, queryValue } = require('../lib/route');
const {
  DOCUMENTED_DSPS,
  RELEASE_TYPES,
  SUBMITTABLE,
  YOUTUBE_MUSIC_SLUG,
  documentedStores,
  headerValue,
  healthPayload,
  deriveSlug,
  hopIdempotencyKey,
  idempotencyKey,
  isConfigured,
  isUuid,
  minSubmitDate,
  normalizeCountry,
  normalizeLanguage,
  normalizeReleaseDate,
  normalizeReleaseType,
  notConfigured,
  parseStoreSlugs,
  readBody,
  sendJson,
  tonegridFetch,
  withYouTubeMusic,
} = require('../lib/tonegrid');

const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_ARTWORK_BYTES = 15 * 1024 * 1024;
const LIST_STATUSES = new Set(['draft', 'pending', 'approved', 'live', 'taken_down']);

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
  return 'ToneGrid rejected the request.';
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
      error: 'ToneGrid is not configured.',
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

async function createArtist(req, res) {
  const scope = await personalScope(req, res);
  if (!scope) return;

  if (scope.artistId) {
    sendJson(res, 200, { uuid: scope.artistId, continued: true });
    return;
  }

  const decision = plans.evaluate(scope.row);
  if (!decision.allowed) {
    sendJson(res, 403, plans.limitBody(decision));
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const artistGate = uploadRequired.validateArtist(body);
  if (artistGate.error) {
    sendJson(res, 400, { error: artistGate.error });
    return;
  }
  const name = artistGate.name;

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
      await accounts.updateCatalog(scope.userId, { artistId });
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
    const uuid = String(row.uuid || '').trim();
    if (!uuid) return null;
    return {
      uuid,
      title: String(row.title || '').trim(),
      position: Number(row.position) || 1,
      language: String(row.language || '').trim().toLowerCase(),
      explicit: row.explicit === true,
    };
  }).filter(Boolean);
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
    artwork_url: String(row.artwork_url || row.cover_art_url || '').trim(),
    release_date: normalizeReleaseDate(row.release_date || row.releaseDate) || '',
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    tracks: pickTracks(row),
    dsps: parseStoreSlugs(row),
  };
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
  for (let i = 0; i < scope.releaseIds.length; i += 1) {
    const id = scope.releaseIds[i];
    const result = await tonegridFetch('/releases/' + id, { method: 'GET' });
    if (!result.ok) continue;
    const row = pickRelease(unwrapRelease(result.data));
    if (!row) continue;
    if (query.status && row.status !== String(query.status).trim().toLowerCase()) continue;
    if (query.type && row.type !== normalizeReleaseType(query.type)) continue;
    collected.push(row);
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
  const artistId = String((body && (body.artist_id || body.artistId)) || '').trim();
  const existingIds = plans.uniqueReleaseIds(scope.row);
  const decision = plans.evaluate(scope.row, undefined, { continueReleaseId: continueId });
  if (decision.continuing && isUuid(continueId)) {
    sendJson(res, 200, { uuid: continueId, continued: true });
    return;
  }
  if (
    existingIds.length === 1
    && isUuid(artistId)
    && scope.artistId
    && artistId.toLowerCase() === scope.artistId.toLowerCase()
  ) {
    sendJson(res, 200, { uuid: existingIds[0], continued: true });
    return;
  }
  if (!decision.allowed) {
    sendJson(res, 403, plans.limitBody(decision));
    return;
  }
  const type = normalizeReleaseType(body && body.type);
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

  const payload = {
    artist_id: artistId,
    title: fields.title,
    type,
    genre: fields.genre,
  };
  if (fields.language) payload.language = fields.language;
  if (releaseDate) payload.release_date = releaseDate;

  const result = await tonegridFetch('/releases', {
    method: 'POST',
    body: payload,
    idempotencyKey: idempotencyKey(req, ['release', artistId, fields.title, type, releaseDate].join(':')),
  });
  if (result.ok) {
    const releaseId = createdReleaseId(result.data);
    if (releaseId) {
      await accounts.updateCatalog(scope.userId, { artistId, releaseId });
    }
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
  const position = parsePosition(body && body.position);
  const explicit = parseExplicit(body && body.explicit);
  const fields = uploadRequired.validateTrackCreate(body);

  if (!releaseId) {
    sendJson(res, 400, { error: 'release_id is required.' });
    return;
  }
  if (!isUuid(releaseId)) {
    sendJson(res, 400, { error: 'release_id must be a uuid.' });
    return;
  }
  if (scope.trackIds.length === 1 && idAllowed(scope.allow, releaseId)) {
    sendJson(res, 200, { uuid: scope.trackIds[0], continued: true });
    return;
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

  const result = await tonegridFetch('/releases/' + releaseId + '/tracks', {
    method: 'POST',
    body: trackPayload,
    idempotencyKey: idempotencyKey(req, ['track', releaseId, fields.title, String(position)].join(':')),
  });
  sendJson(res, result.status, result.data);
}

function looksLikeAudioPart(buf) {
  return audioConvert.incomingAudioAllowed(buf);
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
  if (!/multipart\/form-data/i.test(contentType)) {
    sendJson(res, 400, { error: 'audio must be multipart/form-data.' });
    return;
  }

  const declared = Number(headerValue(req, 'content-length') || 0);
  if (declared > MAX_AUDIO_BYTES) {
    sendJson(res, 413, { error: 'Audio must be 200 MB or smaller.' });
    return;
  }

  let raw;
  try {
    raw = await readRawBody(req, MAX_AUDIO_BYTES);
  } catch (err) {
    if (err && err.code === 'TOO_LARGE') {
      sendJson(res, 413, { error: 'Audio must be 200 MB or smaller.' });
      return;
    }
    sendJson(res, 400, { error: 'Could not read the audio upload.' });
    return;
  }

  if (!raw || !raw.length) {
    sendJson(res, 400, { error: 'audio file is required.' });
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
    sendJson(res, 400, { error: 'MP3 must be converted to WAV before ToneGrid.' });
    return;
  }

  const result = await tonegridFetch('/tracks/' + id + '/audio', {
    method: 'POST',
    rawBody: prepared.rawBody,
    contentType: prepared.contentType || contentType,
    idempotencyKey: idempotencyKey(req, 'audio:' + id),
  });
  sendJson(res, result.status, result.data);
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

async function loadOfficialStores() {
  if (!isConfigured()) {
    return {
      configured: false,
      source: 'tonegrid-docs',
      stores: documentedStores().map((slug) => ({ slug, name: slug })),
      youtube_music: YOUTUBE_MUSIC_SLUG,
    };
  }
  const result = await tonegridFetch('/supply-chain/dsps', { method: 'GET' });
  const slugs = result.ok ? parseStoreSlugs(result.data) : [];
  const stores = (slugs.length ? slugs : documentedStores()).map((slug) => ({ slug, name: slug }));
  return {
    configured: true,
    source: slugs.length ? 'tonegrid' : 'tonegrid-docs',
    stores,
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

async function requireOwnedRelease(req, res, releaseId) {
  const scope = await personalScope(req, res);
  if (!scope) return null;
  const id = String(releaseId || '').trim();
  if (!isUuid(id)) {
    sendJson(res, 400, { error: 'release id must be a uuid.' });
    return null;
  }
  if (!idAllowed(scope.allow, id)) {
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
  return { result, row };
}

async function getOneRelease(req, res, releaseId) {
  if (req.method !== 'GET') {
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
  const loaded = await fetchReleaseRow(releaseId);
  if (!loaded.result.ok) {
    sendJson(res, loaded.result.status, loaded.result.data);
    return;
  }
  sendJson(res, 200, Object.assign({ configured: true, sandbox: healthPayload().sandbox }, loaded.row));
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
  if (!/multipart\/form-data/i.test(contentType)) {
    sendJson(res, 400, { error: 'artwork must be multipart/form-data.' });
    return;
  }
  const declared = Number(headerValue(req, 'content-length') || 0);
  if (declared > MAX_ARTWORK_BYTES) {
    sendJson(res, 413, { error: 'Artwork must be 15 MB or smaller.' });
    return;
  }
  let raw;
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
    contentType,
    idempotencyKey: idempotencyKey(req, 'artwork:' + releaseId),
  });
  sendJson(res, result.status, result.data);
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
  if (!Object.keys(payload).length) {
    sendJson(res, 400, { error: 'Provide title, language, or explicit.' });
    return;
  }

  const result = await tonegridFetch('/tracks/' + id, {
    method: 'PATCH',
    body: payload,
    idempotencyKey: idempotencyKey(req, ['track-patch', id, JSON.stringify(payload)].join(':')),
  });
  sendJson(res, result.status, result.data);
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
  res.setHeader('Allow', 'GET, PUT');
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
};

module.exports = handler;
module.exports.pickSummary = pickSummary;
module.exports.pickDsps = pickDsps;
module.exports.pickTerritories = pickTerritories;
module.exports.pickSeries = pickSeries;
