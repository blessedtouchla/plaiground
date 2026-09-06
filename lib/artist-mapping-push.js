'use strict';

/**
 * Stamp Artist Profile mapping URLs onto a linked ToneGrid artist.
 * Only sends URLs/IDs the user already saved. Does not invent links.
 */

const platformLinks = require('./platform-links');
const {
  hopIdempotencyKey,
  isConfigured,
  isUuid,
  tonegridFetch,
} = require('./tonegrid');

const NUMERIC_ARTIST_RE = /^\d{1,12}$/;

const FAIL_COPY = 'Could not send the artist mapping URL to the store.';
const LOG_PREFIX = '[plaiground] ToneGrid artist mapping PATCH failed';

const PLATFORM_FIELDS = {
  spotify: {
    ids: ['spotify_id', 'spotify_artist_id'],
    urls: ['spotify_url'],
  },
  'apple-music': {
    ids: ['apple_id', 'apple_artist_id'],
    urls: ['apple_url', 'apple_music_url'],
  },
  apple: {
    ids: ['apple_id', 'apple_artist_id'],
    urls: ['apple_url', 'apple_music_url'],
  },
};

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function blank(value) {
  return value == null || trim(value) === '';
}

function isStoreArtistId(value) {
  const id = trim(value);
  if (!id) return false;
  if (isUuid(id)) return true;
  return NUMERIC_ARTIST_RE.test(id);
}

function fieldKey(slug) {
  return trim(slug).toLowerCase().replace(/-/g, '_');
}

function unwrapArtist(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.artist && typeof payload.artist === 'object') return payload.artist;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    if (payload.data.artist && typeof payload.data.artist === 'object') return payload.data.artist;
    return payload.data;
  }
  return payload;
}

function specFor(platform) {
  const key = trim(platform).toLowerCase();
  if (PLATFORM_FIELDS[key]) return PLATFORM_FIELDS[key];
  const found = platformLinks.findPlatform(key);
  if (found && PLATFORM_FIELDS[found.slug]) return PLATFORM_FIELDS[found.slug];
  return {
    ids: [],
    urls: [fieldKey((found && found.slug) || key) + '_url'],
  };
}

function buildTonegridMappingFields(artist) {
  const normalized = platformLinks.normalizeFromArtist(artist || {});
  const out = {};
  (normalized.platform_links || []).forEach((link) => {
    if (!link || !link.platform) return;
    const spec = specFor(link.platform);
    const url = trim(link.url || link.value);
    const id = trim(link.id);
    if (url) {
      spec.urls.forEach((key) => {
        if (!out[key]) out[key] = url;
      });
    }
    if (id) {
      spec.ids.forEach((key) => {
        if (!out[key]) out[key] = id;
      });
    }
  });
  return out;
}

function hasMappingFields(fields) {
  return Boolean(fields && Object.keys(fields).some((key) => !blank(fields[key])));
}

function overlayArtist(found, body) {
  const src = found && typeof found === 'object' ? found : {};
  const raw = body && typeof body === 'object' ? body : {};
  const links = Array.isArray(raw.platform_links) ? raw.platform_links : src.platform_links;
  return {
    name: trim(raw.name) || src.name || '',
    tonegrid_artist_id: trim(raw.tonegrid_artist_id) || src.tonegrid_artist_id || '',
    platform_links: Array.isArray(links) ? links : [],
    spotify_id: trim(raw.spotify_id) || src.spotify_id || '',
    apple_id: trim(raw.apple_id) || src.apple_id || '',
    store_url: trim(raw.store_url || raw.url || raw.link) || src.store_url || '',
  };
}

function artistFromRoster(roster, body) {
  const list = roster && Array.isArray(roster.artists) ? roster.artists : [];
  const raw = body && typeof body === 'object' ? body : {};
  const pgId = trim(raw.plaiground_artist_id || raw.artist_profile_id || raw.id || raw.artist_id);
  let found = null;
  if (pgId) {
    found = list.filter((row) => (
      row && (String(row.id) === pgId || String(row.artist_id) === pgId)
    ))[0] || null;
  }
  if (!found && raw.name) {
    const want = trim(raw.name).toLowerCase().replace(/\s+/g, ' ');
    const matches = list.filter((row) => (
      row && trim(row.name).toLowerCase().replace(/\s+/g, ' ') === want
    ));
    if (matches.length === 1) found = matches[0];
  }
  return overlayArtist(found, raw);
}

function pickIfNull(storeArtist, fields) {
  if (!fields) return {};
  if (!storeArtist || typeof storeArtist !== 'object') return Object.assign({}, fields);
  const out = {};
  Object.keys(fields).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(storeArtist, key) && !blank(storeArtist[key])) return;
    out[key] = fields[key];
  });
  return out;
}

function rejectedFieldNames(result) {
  const names = [];
  const bags = [
    result && result.data && result.data.errors,
    result && result.data && result.data.fields,
  ];
  bags.forEach((bag) => {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return;
    Object.keys(bag).forEach((key) => {
      if (key && names.indexOf(key) === -1) names.push(key);
    });
  });
  return names;
}

function dropKeys(fields, keys) {
  const skip = {};
  (keys || []).forEach((key) => { skip[key] = true; });
  const out = {};
  Object.keys(fields || {}).forEach((key) => {
    if (skip[key]) return;
    out[key] = fields[key];
  });
  return out;
}

function logMappingFail(detail) {
  const safe = {
    artist_id: detail && detail.artist_id,
    status: detail && detail.status,
    error: detail && detail.error,
    fields: detail && detail.fields,
  };
  console.error(LOG_PREFIX, safe);
}

async function writeArtist(artistId, fields) {
  const path = '/artists/' + artistId;
  const fingerprint = JSON.stringify(fields);
  const patchKey = hopIdempotencyKey('artist-map', 'PATCH', path, fingerprint);
  let result = await tonegridFetch(path, {
    method: 'PATCH',
    body: fields,
    idempotencyKey: patchKey,
  });
  if (!result.ok && result.status === 405) {
    const putKey = hopIdempotencyKey('artist-map', 'PUT', path, fingerprint);
    result = await tonegridFetch(path, {
      method: 'PUT',
      body: fields,
      idempotencyKey: putKey,
    });
  }
  return result;
}

async function pushArtistMapping(opts) {
  const options = opts || {};
  const artist = options.artist || {};
  const artistId = trim(options.tonegridArtistId || artist.tonegrid_artist_id);
  if (!isConfigured()) return { skipped: true, reason: 'not_configured' };
  if (!isStoreArtistId(artistId)) return { skipped: true, reason: 'no_tonegrid_id' };

  const built = buildTonegridMappingFields(artist);
  if (!hasMappingFields(built)) return { skipped: true, reason: 'no_urls' };

  let storeArtist = options.storeArtist ? unwrapArtist(options.storeArtist) : null;
  if (options.onlyIfNull && !storeArtist) {
    const loaded = await tonegridFetch('/artists/' + artistId, { method: 'GET' });
    if (!loaded.ok) {
      logMappingFail({
        artist_id: artistId,
        status: loaded.status,
        error: loaded.data && loaded.data.error,
        fields: Object.keys(built),
      });
      return { ok: false, status: loaded.status, error: (loaded.data && loaded.data.error) || FAIL_COPY, result: loaded };
    }
    storeArtist = unwrapArtist(loaded.data);
  }

  let fields = options.onlyIfNull ? pickIfNull(storeArtist, built) : Object.assign({}, built);
  if (!hasMappingFields(fields)) return { skipped: true, reason: 'already_set' };

  let result = await writeArtist(artistId, fields);
  if (!result.ok && (result.status === 400 || result.status === 422)) {
    const rejected = rejectedFieldNames(result);
    const next = dropKeys(fields, rejected);
    if (hasMappingFields(next) && rejected.length) {
      fields = next;
      result = await writeArtist(artistId, fields);
    }
  }
  if (!result.ok) {
    logMappingFail({
      artist_id: artistId,
      status: result.status,
      error: result.data && result.data.error,
      fields: Object.keys(fields),
    });
    return {
      ok: false,
      status: result.status,
      error: (result.data && result.data.error) || FAIL_COPY,
      fields: fields,
      result: result,
    };
  }
  return { ok: true, fields: fields, result: result };
}

function artistNeedsBackfill(artist) {
  if (!isStoreArtistId(artist && artist.tonegrid_artist_id)) return false;
  return hasMappingFields(buildTonegridMappingFields(artist));
}

async function backfillRosterMappings(roster) {
  const list = roster && Array.isArray(roster.artists) ? roster.artists : [];
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const artist = list[i];
    if (!artistNeedsBackfill(artist)) continue;
    out.push(await pushArtistMapping({
      artist: artist,
      onlyIfNull: true,
    }));
  }
  return out;
}

module.exports = {
  FAIL_COPY,
  LOG_PREFIX,
  artistFromRoster,
  artistNeedsBackfill,
  backfillRosterMappings,
  buildTonegridMappingFields,
  hasMappingFields,
  isStoreArtistId,
  overlayArtist,
  pickIfNull,
  pushArtistMapping,
  unwrapArtist,
};
