'use strict';

/**
 * "How did you hear about us?" answer from the signup form. Optional.
 * Stored inside the first-touch attribution object so profile saves keep it.
 */

const OPTIONS = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  plainow: 'plainow',
  plaipals: 'plaipals',
  friend: 'Friend or artist',
  google: 'Google search',
  other: 'Other',
};

const OTHER_MAX = 80;

function cleanOther(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, OTHER_MAX);
}

/** { heard_about, heard_about_other? } or null when nothing valid was picked. */
function normalizeHeardAbout(choice, other) {
  if (typeof choice !== 'string') return null;
  const key = choice.trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(OPTIONS, key)) return null;
  const out = { heard_about: key };
  if (key === 'other') {
    const text = cleanOther(other);
    if (text) out.heard_about_other = text;
  }
  return out;
}

/** Human label, e.g. "Instagram" or "Other: a podcast". '' when unanswered. */
function heardAboutLabel(attribution) {
  const a = attribution && typeof attribution === 'object' ? attribution : {};
  const key = typeof a.heard_about === 'string' ? a.heard_about.trim().toLowerCase() : '';
  if (!Object.prototype.hasOwnProperty.call(OPTIONS, key)) return '';
  if (key === 'other') {
    const text = cleanOther(a.heard_about_other);
    return text ? 'Other: ' + text : 'Other';
  }
  return OPTIONS[key];
}

module.exports = { OPTIONS, OTHER_MAX, heardAboutLabel, normalizeHeardAbout };
