'use strict';

/**
 * Map on-site attest made_how onto the store AI transparency tag.
 * AI-assisted and Fully AI both send includes_ai.
 * No AI clears a previous flag by sending track_properties without includes_ai.
 * Release rights ai_disclosure: no_ai none, ai_assisted partial, fully_ai full.
 * The Suno choice sends ai_service. Other text stays in ai_service_other.
 * Do not put the human description there, and do not invent a tool name.
 * When includes_ai is set, the store requires ai_elements:
 * vocals, instrumentation, composition, lyrics, production.
 * Fully AI keeps lyrics off that list when Original lyrics is claimed.
 */

var AI_MADE_HOW = { ai_assisted: true, fully_ai: true };
var KNOWN_AI_SERVICES = { suno: 'Suno', udio: 'Udio' };
var AI_DISCLOSURE = { no_ai: 'none', ai_assisted: 'partial', fully_ai: 'full' };
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

function canonicalAiService(value) {
  return KNOWN_AI_SERVICES[trim(value).toLowerCase()] || '';
}

function aiDisclosureOf(body) {
  return AI_DISCLOSURE[madeHowOf(body)] || '';
}

function aiServiceFields(body) {
  if (!usesAi(body)) return {};
  var named = canonicalAiService(body && (body.ai_service || body.ai_tool || body.aiTool));
  var otherRaw = trim(body && (body.ai_service_other || body.ai_tool_other || body.aiToolOther));
  if (named) return { ai_service: named };
  if (otherRaw) return { ai_service_other: otherRaw };
  return {};
}

function trackAiFields(body) {
  if (!usesAi(body)) return null;
  return Object.assign({
    track_properties: ['includes_ai'],
    ai_elements: aiElementsOf(body),
  }, aiServiceFields(body));
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
  if (fields.ai_service) payload.ai_service = fields.ai_service;
  else delete payload.ai_service;
  if (fields.ai_service_other) payload.ai_service_other = fields.ai_service_other;
  else delete payload.ai_service_other;
  return payload;
}

var api = {
  STORE_AI_ELEMENTS: STORE_AI_ELEMENTS,
  usesAi: usesAi,
  aiDisclosureOf: aiDisclosureOf,
  aiServiceFields: aiServiceFields,
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
