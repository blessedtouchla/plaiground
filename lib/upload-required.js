'use strict';

/**
 * Required fields for the song upload path.
 * Optional only when existing copy already says so: featured artist and
 * subgenre (and PRO on the split sheet). Do not invent extra optional fields.
 */

var DOWNLOAD_PRICES = ['$0.69', '$0.99'];
var MADE_HOW = { ai_assisted: true, no_ai: true, fully_ai: true };

function isInstrumental(value) {
  if (!value || typeof value !== 'object') return false;
  return value.instrumental === true || value.instrumental === 'true' || value.instrumental === 1 || value.instrumental === '1';
}

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function filled(value) {
  return trim(value) !== '';
}

function required(field) {
  return { error: field + ' is required.' };
}

function clientRequired(label) {
  return { error: label + ' is required.' };
}

function normalizeLanguage(value) {
  var raw = trim(value).toLowerCase();
  if (!raw) return '';
  if (!/^[a-z]{2}$/.test(raw)) return null;
  return raw;
}

function normalizePrice(value) {
  return trim(value);
}

function catalogLists() {
  try {
    if (typeof PlaigroundUploadCatalog !== 'undefined' && PlaigroundUploadCatalog) {
      return PlaigroundUploadCatalog;
    }
  } catch (err) {}
  try {
    return require('../upload-catalog');
  } catch (err) {
    return { GENRES: [], LANGUAGES: [] };
  }
}

function canonicalGenre(value) {
  var raw = trim(value);
  if (!raw) return '';
  var list = catalogLists().GENRES || [];
  if (!list.length) return raw;
  var i;
  for (i = 0; i < list.length; i += 1) {
    if (list[i] === raw) return list[i];
  }
  var lower = raw.toLowerCase();
  for (i = 0; i < list.length; i += 1) {
    if (String(list[i]).toLowerCase() === lower) return list[i];
  }
  return null;
}

function canonicalLanguage(value) {
  var code = normalizeLanguage(value);
  if (code === '') return '';
  var langs = catalogLists().LANGUAGES || [];
  if (code == null) {
    var raw = trim(value).toLowerCase();
    for (var i = 0; i < langs.length; i += 1) {
      if (String(langs[i].name || '').toLowerCase() === raw) return langs[i].code;
    }
    return null;
  }
  if (!langs.length) return code;
  for (var j = 0; j < langs.length; j += 1) {
    if (langs[j].code === code) return code;
  }
  return null;
}

function validateArtist(body) {
  var name = trim(body && body.name);
  if (!name) return required('name');
  return { ok: true, name: name };
}

function validateReleaseCreate(body) {
  var title = trim(body && body.title);
  var genre = canonicalGenre(body && body.genre);
  var instrumental = isInstrumental(body);
  var language = '';
  var price = normalizePrice(body && (body.price || body.download_price));

  if (!title) return required('title');
  if (genre === '') return required('genre');
  if (genre == null) return { error: 'genre must be a listed genre.' };
  if (!instrumental) {
    language = canonicalLanguage(body && body.language);
    if (language === '') return required('language');
    if (language == null) return { error: 'language must be an ISO 639-1 code.' };
  }
  if (!price) return required('price');
  if (DOWNLOAD_PRICES.indexOf(price) === -1) {
    return { error: 'price must be $0.69 or $0.99.' };
  }

  return { ok: true, title: title, genre: genre, language: language, price: price, instrumental: instrumental };
}

function validateReleaseUpdate(body) {
  if (!body || typeof body !== 'object') return { ok: true };
  if (body.title !== undefined && !filled(body.title)) return required('title');
  if (body.genre !== undefined) {
    var genre = canonicalGenre(body.genre);
    if (genre === '') return required('genre');
    if (genre == null) return { error: 'genre must be a listed genre.' };
  }
  if (body.language !== undefined && !isInstrumental(body)) {
    var language = canonicalLanguage(body.language);
    if (language === '') return required('language');
    if (language == null) return { error: 'language must be an ISO 639-1 code.' };
  }
  if (body.price !== undefined || body.download_price !== undefined) {
    var price = normalizePrice(body.price || body.download_price);
    if (!price) return required('price');
    if (DOWNLOAD_PRICES.indexOf(price) === -1) {
      return { error: 'price must be $0.69 or $0.99.' };
    }
  }
  return { ok: true };
}

function validateTrackCreate(body) {
  var title = trim(body && body.title);
  var instrumental = isInstrumental(body);
  if (!title) return required('title');
  if (instrumental) {
    return { ok: true, title: title, language: '', instrumental: true };
  }
  var language = normalizeLanguage(body && body.language);
  if (language === '') return required('language');
  if (language == null) return { error: 'language must be an ISO 639-1 code.' };
  return { ok: true, title: title, language: language };
}

function validateTrackUpdate(body) {
  if (!body || typeof body !== 'object') return { ok: true };
  if (body.title !== undefined && !filled(body.title)) return required('title');
  if (body.language !== undefined && !isInstrumental(body)) {
    var language = normalizeLanguage(body.language);
    if (language === '') return required('language');
    if (language == null) return { error: 'language must be an ISO 639-1 code.' };
  }
  return { ok: true };
}

var AUDIO_REQUIRED = 'Audio required — upload your master before sending';
var COVER_REQUIRED = 'Cover art is required.';

function presentStoreValue(value) {
  if (value == null || value === false) return false;
  if (typeof value === 'object') {
    return presentStoreValue(value.url || value.key || value.s3 || value.audio_url || value.s3_key);
  }
  return filled(value);
}

function trackHasStoreAudio(track) {
  if (!track || typeof track !== 'object') return false;
  return presentStoreValue(track.audio_url)
    || presentStoreValue(track.audio_s3_key)
    || presentStoreValue(track.s3_key)
    || presentStoreValue(track.s3)
    || presentStoreValue(track.s3_url)
    || Number(track.file_size) > 0;
}

function releaseHasStoreAudio(row) {
  var tracks = (row && row.tracks) || [];
  var i;
  for (i = 0; i < tracks.length; i += 1) {
    if (trackHasStoreAudio(tracks[i])) return true;
  }
  return trackHasStoreAudio(row);
}

function releaseHasStoreCover(row) {
  if (!row || typeof row !== 'object') return false;
  return presentStoreValue(row.artwork_url)
    || presentStoreValue(row.cover_art_url)
    || presentStoreValue(row.cover_url)
    || presentStoreValue(row.artwork_object_key);
}

function hasPersistedAudio(fields) {
  fields = fields || {};
  if (fields.audio) return true;
  if (fields.audio_uploaded === true || fields.audio_uploaded === 'true') return true;
  if (filled(fields.audio_name) || filled(fields.audio_picked_name)) return true;
  if (filled(fields.audio_url) || filled(fields.audio_object_key)) return true;
  return releaseHasStoreAudio(fields);
}

function hasPersistedArtwork(fields) {
  fields = fields || {};
  if (fields.artwork) return true;
  if (filled(fields.artwork_name)) return true;
  if (filled(fields.artwork_object_key)) return true;
  return false;
}

function writerNameOf(body, row) {
  var writers = (body && body.writers) || (row && row.writers) || [];
  if (Array.isArray(writers) && writers[0]) {
    var w = writers[0];
    var fromWriter = trim(w.name || [w.first_name, w.last_name].filter(Boolean).join(' '));
    if (fromWriter) return fromWriter;
  }
  return trim(
    (body && (body.songwriter_name || body.writer_name || body.copyright_holder || body.copyright_owner || body.master_owner || body.name || body.artist_name || body.artist)) ||
    (row && (row.copyright_holder || row.master_owner || row.name || row.artist_name))
  );
}

function validateSharedUploadDetails(fields, titleLabel) {
  if (!hasPersistedArtwork(fields)) return clientRequired('Artwork');
  if (!filled(fields.title)) return clientRequired(titleLabel);
  if (!filled(fields.name)) return clientRequired('Primary artist');
  if (!filled(fields.genre)) return clientRequired('Genre');
  if (canonicalGenre(fields.genre) == null) return { error: 'Genre is required.' };
  if (!isInstrumental(fields)) {
    var language = canonicalLanguage(fields.language);
    if (!language) return clientRequired('Language');
  }
  if (!filled(fields.price)) return clientRequired('Download price');
  if (DOWNLOAD_PRICES.indexOf(normalizePrice(fields.price)) === -1) {
    return { error: 'Download price is required.' };
  }
  return { ok: true };
}

function validateAlbumTracks(tracks) {
  if (!Array.isArray(tracks) || !tracks.length) {
    return { error: 'Pick how many songs are on this album.' };
  }
  for (var i = 0; i < tracks.length; i += 1) {
    var track = tracks[i] || {};
    if (!track.audio && !track.file && !hasPersistedAudio(track)) {
      return { error: 'Track ' + (i + 1) + ' needs audio.' };
    }
    if (!filled(track.title)) return { error: 'Track ' + (i + 1) + ' needs a title.' };
  }
  return { ok: true };
}

function validateAlbumUploadPage(fields) {
  fields = fields || {};
  var details = validateSharedUploadDetails(fields, 'Album title');
  if (details.error) return details;
  return validateAlbumTracks(fields.tracks);
}

function creditsApi() {
  try {
    if (typeof PlaigroundReleaseCredits !== 'undefined' && PlaigroundReleaseCredits) {
      return PlaigroundReleaseCredits;
    }
  } catch (err) {}
  try {
    return require('./release-credits');
  } catch (err2) {
    return null;
  }
}

function validateUploadPage(fields) {
  fields = fields || {};
  if (String(fields.type || '').trim().toLowerCase() === 'album') {
    var album = validateAlbumUploadPage(fields);
    if (album.error) return album;
    return extraUploadChecks(fields);
  }
  if (!fields.audio && !hasPersistedAudio(fields)) return clientRequired('Audio');
  var details = validateSharedUploadDetails(fields, 'Song title');
  if (details.error) return details;
  return extraUploadChecks(fields);
}

function extraUploadChecks(fields) {
  var credits = creditsApi();
  if (credits && typeof credits.validateUploadLegal === 'function') {
    var legal = credits.validateUploadLegal(fields);
    if (legal && legal.error) return legal;
  }
  return { ok: true };
}

function hasHumanElements(fields) {
  var elements = fields && fields.human_elements;
  if (!Array.isArray(elements)) return false;
  return elements.some(function (item) { return filled(item); });
}

function validateAttest(fields) {
  fields = fields || {};
  var madeHow = trim(fields.made_how);
  if (!madeHow || !MADE_HOW[madeHow]) return required('made_how');
  if (madeHow === 'ai_assisted') {
    if (!hasHumanElements(fields) && !filled(fields.human_contribution)) {
      return required('human_elements');
    }
  }
  if (fields.rights_confirmed !== true && fields.rights_confirmed !== 'true') {
    return required('rights_confirmed');
  }
  return { ok: true };
}

function validateAttestPage(fields) {
  var result = validateAttest(fields);
  if (result.error) {
    if (result.error.indexOf('made_how') !== -1) {
      return { error: 'How the song was made is required.' };
    }
    if (result.error.indexOf('human_elements') !== -1) {
      return { error: 'Human element is required.' };
    }
    if (result.error.indexOf('human_contribution') !== -1) {
      return { error: 'Describe the human contribution is required.' };
    }
    return { error: 'Rights confirmation is required.' };
  }
  var credits = creditsApi();
  if (credits && typeof credits.validateAttestExtras === 'function') {
    var extra = credits.validateAttestExtras(fields);
    if (extra && extra.error) return extra;
  }
  return result;
}

function validateReviewPage(fields) {
  if (!filled(fields && fields.release_date)) return clientRequired('Release date');
  return { ok: true };
}

function validateSubmit(body, row) {
  body = body || {};
  row = row || {};
  var date = trim(body.release_date || body.releaseDate || row.release_date || row.releaseDate);
  if (!date) return required('release_date');
  var attest = validateAttest({
    made_how: body.made_how || row.made_how,
    human_elements: body.human_elements || row.human_elements,
    human_contribution: body.human_contribution || row.human_contribution,
    rights_confirmed: body.rights_confirmed || row.rights_confirmed,
  });
  if (attest.error) return attest;
  return { ok: true };
}

function writerCount(fields) {
  var writers = fields && fields.writers;
  if (!Array.isArray(writers)) return 0;
  var count = 0;
  for (var i = 0; i < writers.length; i += 1) {
    var writer = writers[i] || {};
    if (filled(writer.name) || filled(writer.email)) count += 1;
  }
  return count;
}

function hasOtherArtist(fields) {
  fields = fields || {};
  if (filled(fields.featured)) return true;
  return writerCount(fields) > 1;
}

function isSoloOwned(fields) {
  fields = fields || {};
  var flagged = fields.solo_owned_100 === true || fields.solo_owned_100 === 'true';
  if (!flagged) return false;
  if (hasOtherArtist(fields)) return false;
  return true;
}

function validateSplit(payload) {
  payload = payload || {};
  if (!filled(payload.songTitle || payload.song_title)) return clientRequired('Song title');
  var writers = payload.writers;
  if (!Array.isArray(writers) || !writers.length) return { error: 'Writer 1 needs a name.' };
  for (var i = 0; i < writers.length; i += 1) {
    var writer = writers[i] || {};
    if (!filled(writer.name) && !filled(writer.first_name) && !filled(writer.last_name)) {
      return { error: 'Writer ' + (i + 1) + ' needs a name.' };
    }
    if (!filled(writer.email) && writers.length > 1) {
      return { error: 'Writer ' + (i + 1) + ' needs an email.' };
    }
  }
  return { ok: true };
}

var api = {
  DOWNLOAD_PRICES: DOWNLOAD_PRICES,
  AUDIO_REQUIRED: AUDIO_REQUIRED,
  COVER_REQUIRED: COVER_REQUIRED,
  filled: filled,
  trim: trim,
  trackHasStoreAudio: trackHasStoreAudio,
  releaseHasStoreAudio: releaseHasStoreAudio,
  releaseHasStoreCover: releaseHasStoreCover,
  hasPersistedAudio: hasPersistedAudio,
  isInstrumental: isInstrumental,
  normalizeLanguage: normalizeLanguage,
  canonicalGenre: canonicalGenre,
  canonicalLanguage: canonicalLanguage,
  validateArtist: validateArtist,
  validateReleaseCreate: validateReleaseCreate,
  validateReleaseUpdate: validateReleaseUpdate,
  validateTrackCreate: validateTrackCreate,
  validateTrackUpdate: validateTrackUpdate,
  validateAlbumTracks: validateAlbumTracks,
  validateAlbumUploadPage: validateAlbumUploadPage,
  validateUploadPage: validateUploadPage,
  validateAttest: validateAttest,
  validateAttestPage: validateAttestPage,
  validateReviewPage: validateReviewPage,
  validateSubmit: validateSubmit,
  validateSplit: validateSplit,
  writerCount: writerCount,
  writerNameOf: writerNameOf,
  hasOtherArtist: hasOtherArtist,
  isSoloOwned: isSoloOwned,
};

if (typeof module === 'object' && module.exports) {
  module.exports = api;
} else if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundUploadRequired = api;
} else if (typeof window !== 'undefined') {
  window.PlaigroundUploadRequired = api;
}
