'use strict';

/**
 * Map on-site attest made_how onto the store AI transparency tag.
 * One sticker: AI-assisted and Fully AI both send includes_ai.
 * No AI omits the flag. Do not stamp a brand on ai_service.
 */

var GENERIC_AI_SERVICE = 'generative AI';
var AI_MADE_HOW = { ai_assisted: true, fully_ai: true };

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

function trackAiFields(body) {
  if (!usesAi(body)) return null;
  return {
    track_properties: ['includes_ai'],
    ai_service_other: aiServiceOther(body),
  };
}

function applyTrackAiFields(payload, body) {
  var fields = trackAiFields(body);
  if (!fields || !payload || typeof payload !== 'object') return payload;
  payload.track_properties = fields.track_properties;
  payload.ai_service_other = fields.ai_service_other;
  return payload;
}

var api = {
  GENERIC_AI_SERVICE: GENERIC_AI_SERVICE,
  usesAi: usesAi,
  trackAiFields: trackAiFields,
  applyTrackAiFields: applyTrackAiFields,
};

if (typeof module === 'object' && module.exports) {
  module.exports = api;
} else if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundStoreAi = api;
}
