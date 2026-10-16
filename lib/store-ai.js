'use strict';

/**
 * Map on-site attest made_how onto the store AI transparency tag.
 * AI-assisted and Fully AI both send includes_ai.
 * No AI clears a previous flag by sending track_properties without includes_ai.
 * ai_service_other is the tool name at the store. Do not put the human
 * description there, and do not invent a tool name. Do not stamp ai_service.
 * When includes_ai is set, the store requires ai_elements:
 * vocals, instrumentation, composition, lyrics, production.
 * Fully AI keeps lyrics off that list when Original lyrics is claimed.
 */

var AI_MADE_HOW = { ai_assisted: true, fully_ai: true };
var STORE_AI_ELEMENTS = ['vocals', 'instrumentation', 'composition', 'lyrics', 'production'];
var HUMAN_TAG_TO_ELEMENT = {
  'original lyrics': 'lyrics',
  'lead vocals performed': 'vocals',
  'backing vocals': 'vocals',
  'played an instrument': 'instrumentation',
  'melody written': 'composition',
  'arrangement': 'composition',
  'mixed by a person': 'production',
  'mastered by a person': 'production',
};

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function madeHowOf(body) {
  return trim(body && (body.made_how || body.madeHow)).toLowerCase();
}

function usesAi(body) {
  return AI_MADE_HOW[madeHowOf(body)] === true;
}

function humanElementsOf(body) {
  var raw = (body && (body.human_elements || body.humanElements)) || [];
  if (!Array.isArray(raw)) return [];
  return raw.map(function (item) { return trim(item); }).filter(Boolean);
}

function claimedOriginalLyrics(body) {
  return humanElementsOf(body).some(function (tag) {
    return tag.toLowerCase() === 'original lyrics';
  });
}

function aiElementsOf(body) {
  if (!usesAi(body)) return [];
  if (madeHowOf(body) === 'fully_ai') {
    return STORE_AI_ELEMENTS.filter(function (item) {
      return !(item === 'lyrics' && claimedOriginalLyrics(body));
    });
  }
  var human = {};
  humanElementsOf(body).forEach(function (tag) {
    var mapped = HUMAN_TAG_TO_ELEMENT[tag.toLowerCase()];
    if (mapped) human[mapped] = true;
  });
  var ai = STORE_AI_ELEMENTS.filter(function (item) { return !human[item]; });
  return ai.length ? ai : ['instrumentation'];
}

function trackAiFields(body) {
  if (!usesAi(body)) return null;
  return {
    track_properties: ['includes_ai'],
    ai_elements: aiElementsOf(body),
  };
}

function shouldClearTrackAi(body) {
  return madeHowOf(body) === 'no_ai';
}

function clearTrackProperties(existing) {
  if (!Array.isArray(existing)) return [];
  return existing.map(function (item) { return trim(item); }).filter(function (item) {
    return item && item !== 'includes_ai';
  });
}

function applyTrackAiFields(payload, body) {
  var fields = trackAiFields(body);
  if (!fields || !payload || typeof payload !== 'object') return payload;
  payload.track_properties = fields.track_properties;
  payload.ai_elements = fields.ai_elements;
  return payload;
}

var api = {
  STORE_AI_ELEMENTS: STORE_AI_ELEMENTS,
  usesAi: usesAi,
  shouldClearTrackAi: shouldClearTrackAi,
  clearTrackProperties: clearTrackProperties,
  aiElementsOf: aiElementsOf,
  trackAiFields: trackAiFields,
  applyTrackAiFields: applyTrackAiFields,
};

if (typeof module === 'object' && module.exports) {
  module.exports = api;
} else if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundStoreAi = api;
}
