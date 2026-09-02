'use strict';

/**
 * Map on-site attest made_how onto the store AI transparency tag.
 * One sticker: AI-assisted and Fully AI both send includes_ai.
 * No AI omits the flag. Do not stamp a brand on ai_service.
 * When includes_ai is set, the store requires ai_elements:
 * vocals, instrumentation, composition, lyrics, production.
 */

var GENERIC_AI_SERVICE = 'generative AI';
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

function aiServiceOther(body) {
  var named = trim(body && (body.human_contribution || body.humanContribution));
  return named || GENERIC_AI_SERVICE;
}

function humanElementsOf(body) {
  var raw = (body && (body.human_elements || body.humanElements)) || [];
  if (!Array.isArray(raw)) return [];
  return raw.map(function (item) { return trim(item); }).filter(Boolean);
}

function aiElementsOf(body) {
  if (!usesAi(body)) return [];
  if (madeHowOf(body) === 'fully_ai') return STORE_AI_ELEMENTS.slice();
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
    ai_service_other: aiServiceOther(body),
    ai_elements: aiElementsOf(body),
  };
}

function applyTrackAiFields(payload, body) {
  var fields = trackAiFields(body);
  if (!fields || !payload || typeof payload !== 'object') return payload;
  payload.track_properties = fields.track_properties;
  payload.ai_service_other = fields.ai_service_other;
  payload.ai_elements = fields.ai_elements;
  return payload;
}

var api = {
  GENERIC_AI_SERVICE: GENERIC_AI_SERVICE,
  STORE_AI_ELEMENTS: STORE_AI_ELEMENTS,
  usesAi: usesAi,
  aiElementsOf: aiElementsOf,
  trackAiFields: trackAiFields,
  applyTrackAiFields: applyTrackAiFields,
};

if (typeof module === 'object' && module.exports) {
  module.exports = api;
} else if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundStoreAi = api;
}
