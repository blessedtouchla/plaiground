'use strict';

/**
 * Required fields for the song upload path.
 * Optional only when existing copy already says so: featured artist and
 * subgenre (and PRO on the split sheet). Do not invent extra optional fields.
 */

var DOWNLOAD_PRICES = ['$0.69', '$0.99'];
var MADE_HOW = { ai_assisted: true, no_ai: true };

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
  var language = canonicalLanguage(body && body.language);
  var price = normalizePrice(body && (body.price || body.download_price));

  if (!title) return required('title');
  if (genre === '') return required('genre');
  if (genre == null) return { error: 'genre must be a ToneGrid genre.' };
  if (language === '') return required('language');
  if (language == null) return { error: 'language must be an ISO 639-1 code.' };
  if (!price) return required('price');
  if (DOWNLOAD_PRICES.indexOf(price) === -1) {
    return { error: 'price must be $0.69 or $0.99.' };
  }

  return { ok: true, title: title, genre: genre, language: language, price: price };
}

function validateReleaseUpdate(body) {
  if (!body || typeof body !== 'object') return { ok: true };
  if (body.title !== undefined && !filled(body.title)) return required('title');
  if (body.genre !== undefined) {
    var genre = canonicalGenre(body.genre);
    if (genre === '') return required('genre');
    if (genre == null) return { error: 'genre must be a ToneGrid genre.' };
  }
  if (body.language !== undefined) {
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
  var language = normalizeLanguage(body && body.language);
  if (!title) return required('title');
  if (language === '') return required('language');
  if (language == null) return { error: 'language must be an ISO 639-1 code.' };
  return { ok: true, title: title, language: language };
}

function validateTrackUpdate(body) {
  if (!body || typeof body !== 'object') return { ok: true };
  if (body.title !== undefined && !filled(body.title)) return required('title');
  if (body.language !== undefined) {
    var language = normalizeLanguage(body.language);
    if (language === '') return required('language');
    if (language == null) return { error: 'language must be an ISO 639-1 code.' };
  }
  return { ok: true };
}

function validateUploadPage(fields) {
  fields = fields || {};
  if (!fields.audio) return clientRequired('Audio');
  if (!fields.artwork) return clientRequired('Artwork');
  if (!filled(fields.title)) return clientRequired('Song title');
  if (!filled(fields.name)) return clientRequired('Primary artist');
  if (!filled(fields.genre)) return clientRequired('Genre');
  if (canonicalGenre(fields.genre) == null) return { error: 'Genre is required.' };
  var language = canonicalLanguage(fields.language);
  if (!language) return clientRequired('Language');
  if (!filled(fields.price)) return clientRequired('Download price');
  if (DOWNLOAD_PRICES.indexOf(normalizePrice(fields.price)) === -1) {
    return { error: 'Download price is required.' };
  }
  return { ok: true };
}

function validateAttest(fields) {
  fields = fields || {};
  var madeHow = trim(fields.made_how);
  if (!madeHow || !MADE_HOW[madeHow]) return required('made_how');
  if (madeHow === 'ai_assisted') {
    var elements = fields.human_elements;
    if (!Array.isArray(elements) || !elements.some(function (item) { return filled(item); })) {
      return required('human_elements');
    }
    if (!filled(fields.human_contribution)) return required('human_contribution');
  }
  if (fields.rights_confirmed !== true && fields.rights_confirmed !== 'true') {
    return required('rights_confirmed');
  }
  return { ok: true };
}

function validateAttestPage(fields) {
  var result = validateAttest(fields);
  if (!result.error) return result;
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
    made_how: body.made_how,
    human_elements: body.human_elements,
    human_contribution: body.human_contribution,
    rights_confirmed: body.rights_confirmed,
  });
  if (attest.error) return attest;
  return { ok: true };
}

function validateSplit(payload) {
  payload = payload || {};
  if (!filled(payload.songTitle || payload.song_title)) return clientRequired('Song title');
  var writers = payload.writers;
  if (!Array.isArray(writers) || !writers.length) return { error: 'Writer 1 needs a name.' };
  for (var i = 0; i < writers.length; i += 1) {
    var writer = writers[i] || {};
    if (!filled(writer.name)) return { error: 'Writer ' + (i + 1) + ' needs a name.' };
    if (!filled(writer.email)) return { error: 'Writer ' + (i + 1) + ' needs an email.' };
  }
  return { ok: true };
}

var api = {
  DOWNLOAD_PRICES: DOWNLOAD_PRICES,
  filled: filled,
  trim: trim,
  normalizeLanguage: normalizeLanguage,
  canonicalGenre: canonicalGenre,
  canonicalLanguage: canonicalLanguage,
  validateArtist: validateArtist,
  validateReleaseCreate: validateReleaseCreate,
  validateReleaseUpdate: validateReleaseUpdate,
  validateTrackCreate: validateTrackCreate,
  validateTrackUpdate: validateTrackUpdate,
  validateUploadPage: validateUploadPage,
  validateAttest: validateAttest,
  validateAttestPage: validateAttestPage,
  validateReviewPage: validateReviewPage,
  validateSubmit: validateSubmit,
  validateSplit: validateSplit,
};

if (typeof module === 'object' && module.exports) {
  module.exports = api;
} else if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundUploadRequired = api;
} else if (typeof window !== 'undefined') {
  window.PlaigroundUploadRequired = api;
}
