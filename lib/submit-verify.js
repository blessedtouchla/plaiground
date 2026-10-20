'use strict';
// Submit safety: a fresh key per real submit attempt, and a check that the store really took it.
const crypto = require('crypto');

const IN_REVIEW = new Set(['pending', 'pending_review', 'qc_inspection', 'in_review', 'review', 'approved', 'processing', 'delivering']);
const NOT_SENT_COPY = "We couldn't send this yet. Try again or contact us.";
const DEDUPE_MS = 60 * 1000;

function norm(status) {
  return String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

// Same release + same starting status + same updated stamp + same 60s window => same key (double-tap dedupe).
// A resubmit after "Returned for Changes" (later window and/or new status/stamp) gets a new key.
function submitFingerprint(releaseId, row, now) {
  const r = row || {};
  const t = typeof now === 'number' ? now : Date.now();
  return [
    String(releaseId || ''),
    norm(r.status),
    String(r.updated_at || r.updatedAt || ''),
    String(Math.floor(t / DEDUPE_MS)),
  ].join('|');
}

function submitKey(releaseId, row, now) {
  const digest = crypto.createHash('sha256').update('submit\n' + submitFingerprint(releaseId, row, now)).digest('hex').slice(0, 32);
  return 'plaiground-submit-' + digest;
}

// True only when the store now shows the release in review and that is a real change from before.
function submitLanded(beforeStatus, afterStatus) {
  const before = norm(beforeStatus);
  const after = norm(afterStatus);
  if (!IN_REVIEW.has(after)) return false;
  return before !== after || !IN_REVIEW.has(before);
}

module.exports = { submitFingerprint, submitKey, submitLanded, IN_REVIEW, NOT_SENT_COPY, DEDUPE_MS, norm };
