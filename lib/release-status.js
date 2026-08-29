'use strict';

/**
 * DistroKid-style labels for real ToneGrid release statuses.
 * Live only when ToneGrid/DSPs actually say live or delivered.
 */

var LIVE = { live: true, delivered: true };
var PROCESSING = { approved: true, processing: true, delivering: true, qc_inspection: true };
var PENDING = { pending: true, pending_review: true };
var REJECTED = {
  rejected: true,
  'needs-fix': true,
  needs_fix: true,
  needsfix: true,
  error: true,
  failed: true,
  fail: true,
  delivery_failed: true,
  delivery_fail: true,
  qc_rejected: true,
  qc_reject: true,
  qc_failed: true,
};
var DRAFT = { draft: true };

function normalize(status) {
  return String(status == null ? '' : status).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function group(status) {
  var s = normalize(status);
  if (LIVE[s]) return 'live';
  if (REJECTED[s]) return 'rejected';
  if (PROCESSING[s]) return 'processing';
  if (PENDING[s]) return 'pending';
  if (s === 'signatures') return 'signatures';
  if (s === 'taken_down' || s === 'takedown_submitted') return 'taken_down';
  if (s === 'takedown_failed' || s === 'takedown_fail') return 'takedown_failed';
  if (DRAFT[s] || !s) return 'draft';
  return 'pending';
}

function label(status) {
  var s = normalize(status);
  var g = group(status);
  if (g === 'live') return 'Live';
  if (g === 'rejected' || s === 'qc_inspection') return 'Needs fix';
  if (g === 'processing') return 'Processing';
  if (g === 'pending') return 'Pending';
  if (g === 'signatures') return 'Awaiting signatures';
  if (g === 'taken_down') return 'Taken down';
  if (g === 'takedown_failed') return 'Takedown failed';
  return 'Draft';
}

function dot(status) {
  var g = group(status);
  if (g === 'live') return 'green';
  if (g === 'rejected' || g === 'takedown_failed') return 'red';
  if (g === 'pending' || g === 'processing') return 'yellow';
  return 'gray';
}

function isLive(status) {
  return group(status) === 'live';
}

function isProblem(status) {
  var s = normalize(status);
  return group(status) === 'rejected' || s === 'qc_inspection';
}

function isKnownPipeline(status) {
  var s = normalize(status);
  return Boolean(LIVE[s] || PROCESSING[s] || PENDING[s] || REJECTED[s] || DRAFT[s]
    || s === 'signatures' || s === 'taken_down' || s === 'takedown_submitted'
    || s === 'takedown_failed' || s === 'takedown_fail');
}

function shouldCheckOmissions(status) {
  var s = normalize(status);
  return Boolean(PENDING[s] || PROCESSING[s] || REJECTED[s]);
}

var STORE_QC_LINES = [
  'This release needs a record label.',
  'This release needs rights and ownership details.',
  'This release needs a master owner (the ℗ sound-recording owner).',
  'This release needs a copyright year.',
  'This track needs at least one songwriter.',
  'This release needs a ©/℗ line. Stores show that on the release.',
];

var STATUS_WORDS = {
  live: true,
  delivered: true,
  approved: true,
  processing: true,
  delivering: true,
  qc_inspection: true,
  pending: true,
  pending_review: true,
  rejected: true,
  needs_fix: true,
  needsfix: true,
  error: true,
  failed: true,
  fail: true,
  delivery_failed: true,
  delivery_fail: true,
  qc_rejected: true,
  qc_reject: true,
  qc_failed: true,
  draft: true,
  signatures: true,
  taken_down: true,
  takedown_submitted: true,
  takedown_failed: true,
  takedown_fail: true,
  mystery: true,
};

function sanitizeAlert(text) {
  var next = String(text == null ? '' : text).trim();
  if (!next) return '';
  next = next.replace(/\bthe\s+(?:ToneGrid|InterSpace|Flossy(?:TheBoss)?|DistroKid)\b/gi, 'the store');
  next = next.replace(/ToneGrid|Tonegrid|InterSpace|Flossy(?:TheBoss)?|DistroKid/gi, 'the store');
  return next.replace(/[^\S\n]{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
}

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) {
    return value.map(textOf).filter(Boolean).join(' ');
  }
  if (typeof value === 'object') {
    return textOf(value.name || value.title || value.line || value.text || value.value
      || value.owner || value.notice || value.year || '');
  }
  return '';
}

function bagsOf(row) {
  if (!row || typeof row !== 'object') return [];
  var out = [row];
  ['metadata', 'legal', 'copyright', 'credits', 'ownership', 'rights'].forEach(function (key) {
    if (row[key] && typeof row[key] === 'object' && !Array.isArray(row[key])) out.push(row[key]);
  });
  return out;
}

function firstFilled(bags, keys) {
  var i;
  var j;
  for (i = 0; i < (bags || []).length; i += 1) {
    var bag = bags[i];
    if (!bag || typeof bag !== 'object') continue;
    for (j = 0; j < keys.length; j += 1) {
      var got = textOf(bag[keys[j]]);
      if (got) return got;
    }
  }
  return '';
}

function tracksOf(row) {
  if (!row) return [];
  if (Array.isArray(row.tracks)) return row.tracks;
  if (row.tracks && Array.isArray(row.tracks.data)) return row.tracks.data;
  return [];
}

function hasRecordLabel(row) {
  var bags = bagsOf(row);
  var name = firstFilled(bags, ['label_name', 'record_label', 'recordLabel', 'labelName', 'imprint']);
  if (name) return true;
  var i;
  for (i = 0; i < bags.length; i += 1) {
    var lab = bags[i] && bags[i].label;
    if (lab && typeof lab === 'object' && textOf(lab)) return true;
    if (typeof lab === 'string' && lab.trim() && !STATUS_WORDS[normalize(lab)]) return true;
  }
  return false;
}

function hasRights(row) {
  return Boolean(firstFilled(bagsOf(row), [
    'rights',
    'rights_owner',
    'rightsOwner',
    'rights_holder',
    'rightsHolder',
    'ownership',
    'ownership_details',
    'copyright_owner',
    'copyrightOwner',
  ]));
}

function hasMasterOwner(row) {
  return Boolean(firstFilled(bagsOf(row), [
    'master_owner',
    'masterOwner',
    'p_line_owner',
    'pLineOwner',
    'phonogram_owner',
    'phonogram_copyright_owner',
    'sound_recording_owner',
    'p_owner',
  ]));
}

function hasCopyrightYear(row) {
  var raw = firstFilled(bagsOf(row), [
    'copyright_year',
    'copyrightYear',
    'c_year',
    'p_year',
    'cYear',
    'pYear',
  ]);
  return /(?:^|\D)(?:19|20)\d{2}(?:\D|$)/.test(raw);
}

function hasSongwriter(row) {
  if (firstFilled(bagsOf(row), [
    'songwriters',
    'writers',
    'composers',
    'songwriter',
    'writer',
    'composer',
  ])) return true;
  var tracks = tracksOf(row);
  var i;
  for (i = 0; i < tracks.length; i += 1) {
    if (hasSongwriter(tracks[i])) return true;
  }
  return false;
}

function hasCopyrightLine(row) {
  return Boolean(firstFilled(bagsOf(row), [
    'copyright_line',
    'copyrightLine',
    'copyright_notice',
    'copyrightNotice',
    'c_line',
    'p_line',
    'cLine',
    'pLine',
    'notice',
  ]));
}

function omissionLines(row) {
  var lines = [];
  if (!hasRecordLabel(row)) lines.push(STORE_QC_LINES[0]);
  if (!hasRights(row)) lines.push(STORE_QC_LINES[1]);
  if (!hasMasterOwner(row)) lines.push(STORE_QC_LINES[2]);
  if (!hasCopyrightYear(row)) lines.push(STORE_QC_LINES[3]);
  if (!hasSongwriter(row)) lines.push(STORE_QC_LINES[4]);
  if (!hasCopyrightLine(row)) lines.push(STORE_QC_LINES[5]);
  return lines;
}

function fieldText(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return sanitizeAlert(value.message || value.reason || value.error || '');
  }
  return sanitizeAlert(value);
}

function deliveryFailMessage(row) {
  var list = row && Array.isArray(row.deliveries) ? row.deliveries : [];
  var i;
  for (i = 0; i < list.length; i += 1) {
    var item = list[i];
    var st = normalize(item && item.status);
    if (st !== 'failed' && st !== 'fail' && st !== 'error' && st !== 'rejected' && st !== 'delivery_failed') continue;
    var msg = fieldText(item && (item.error_message || item.error || item.message || item.reason || item.notes));
    if (msg) return msg;
  }
  return '';
}

function problemAlert(row, statusHint) {
  var status = statusHint || (row && (row.tonegrid_status || row.status)) || '';
  var g = group(status);
  if (g === 'live' || g === 'draft' || g === 'taken_down' || g === 'takedown_failed' || g === 'signatures') {
    return '';
  }
  var known = isKnownPipeline(status);
  var checkOmit = shouldCheckOmissions(status);
  if (!known && !isProblem(status)) return '';
  if (!isProblem(status) && !checkOmit) return '';
  var msg = fieldText(row && (
    row.rejection_reason
    || row.reject_reason
    || row.error_message
    || row.qc_message
    || row.qc_reason
    || row.delivery_error
    || row.fail_reason
    || row.reason
    || row.message
    || row.error
    || row.notes
  ));
  if (!msg) msg = deliveryFailMessage(row);
  var omit = checkOmit ? omissionLines(row) : [];
  var parts = [];
  if (msg) parts.push(msg);
  if (omit.length) parts = parts.concat(omit);
  return parts.join('\n');
}

function displayInfo(row, statusHint) {
  var status = statusHint || (row && (row.tonegrid_status || row.status)) || '';
  var mapped = info(status);
  var alert = problemAlert(row, status);
  if (alert && !mapped.live) {
    return {
      status: mapped.status,
      group: mapped.group,
      label: 'Needs fix',
      dot: 'red',
      live: false,
      alert: alert,
    };
  }
  return {
    status: mapped.status,
    group: mapped.group,
    label: mapped.label,
    dot: mapped.dot,
    live: mapped.live,
    alert: alert,
  };
}

function info(status) {
  return {
    status: normalize(status),
    group: group(status),
    label: label(status),
    dot: dot(status),
    live: isLive(status),
  };
}

function storedStatus(me, releaseId) {
  var list = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
  var want = String(releaseId || '').toLowerCase();
  if (!want) return '';
  var i;
  for (i = 0; i < list.length; i += 1) {
    var id = String((list[i] && (list[i].tonegrid_release_id || list[i].id)) || '').toLowerCase();
    if (id === want) return normalize(list[i].tonegrid_status || list[i].status);
  }
  return '';
}

function ownedIds(me) {
  var raw = me && Array.isArray(me.tonegrid_release_ids) ? me.tonegrid_release_ids : [];
  var have = {};
  var i;
  for (i = 0; i < raw.length; i += 1) {
    var id = String(raw[i] || '').trim().toLowerCase();
    if (id) have[id] = true;
  }
  return have;
}

function isPlaceholderRelease(row) {
  var title = String((row && row.title) || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return title === 'neon sermon' || title === 'neon shadows' || title === 'neon santos';
}

function releaseOwned(row, have) {
  var id = String((row && (row.tonegrid_release_id || row.id)) || '').trim().toLowerCase();
  if (!id || !have[id]) return false;
  if (isPlaceholderRelease(row)) return false;
  return true;
}

function accountHasLive(me) {
  return liveCount(me) > 0;
}

function liveCount(me) {
  var list = ownedReleases(me);
  var n = 0;
  var i;
  for (i = 0; i < list.length; i += 1) {
    if (list[i] && list[i].live) n += 1;
  }
  return n;
}

function isPendingPipeline(card) {
  if (!card || card.live) return false;
  var g = card.group || group(card.status);
  return g === 'pending' || g === 'processing' || g === 'rejected';
}

function pendingCount(me) {
  var list = ownedReleases(me);
  var n = 0;
  var i;
  for (i = 0; i < list.length; i += 1) {
    if (isPendingPipeline(list[i])) n += 1;
  }
  return n;
}

function coverUrl(row) {
  var api = (typeof PlaigroundCoverUrl !== 'undefined' && PlaigroundCoverUrl)
    || (typeof globalThis !== 'undefined' && globalThis.PlaigroundCoverUrl)
    || null;
  if (!api && typeof require === 'function') {
    try { api = require('./cover-url'); } catch (err) { api = null; }
  }
  if (api && typeof api.from === 'function') return api.from(row);
  return String((row && (row.artwork_url || row.cover_art_url || row.cover_url)) || '').trim();
}

function cardFromRow(row, fallbackId, fallbackStatus) {
  var id = String((row && (row.tonegrid_release_id || row.uuid || row.id)) || fallbackId || '').trim();
  var rawStatus = (row && (row.tonegrid_status || row.status)) || fallbackStatus || 'pending';
  var mapped = displayInfo(row, rawStatus);
  var title = String((row && row.title) || '').trim();
  if (isPlaceholderRelease({ title: title })) {
    return null;
  }
  return {
    id: id,
    title: title,
    status: mapped.status,
    label: mapped.label,
    group: mapped.group,
    live: mapped.live,
    artwork_url: coverUrl(row),
    alert: mapped.alert,
  };
}

function ownedReleases(me) {
  var have = ownedIds(me);
  var list = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
  var byId = {};
  var i;
  for (i = 0; i < list.length; i += 1) {
    var row = list[i];
    if (!releaseOwned(row, have)) continue;
    var card = cardFromRow(row);
    if (!card || !card.id) continue;
    byId[card.id.toLowerCase()] = card;
  }
  var raw = me && Array.isArray(me.tonegrid_release_ids) ? me.tonegrid_release_ids : [];
  var out = [];
  for (i = 0; i < raw.length; i += 1) {
    var id = String(raw[i] || '').trim();
    if (!id) continue;
    var found = byId[id.toLowerCase()];
    if (found) {
      out.push(found);
      delete byId[id.toLowerCase()];
    } else {
      out.push(cardFromRow(null, id, 'pending'));
    }
  }
  Object.keys(byId).forEach(function (key) {
    out.push(byId[key]);
  });
  return out.filter(Boolean);
}

var api = {
  STORE_QC_LINES: STORE_QC_LINES,
  accountHasLive: accountHasLive,
  cardFromRow: cardFromRow,
  coverUrl: coverUrl,
  deliveryFailMessage: deliveryFailMessage,
  displayInfo: displayInfo,
  dot: dot,
  group: group,
  info: info,
  isLive: isLive,
  isPendingPipeline: isPendingPipeline,
  isPlaceholderRelease: isPlaceholderRelease,
  isProblem: isProblem,
  label: label,
  liveCount: liveCount,
  omissionLines: omissionLines,
  pendingCount: pendingCount,
  normalize: normalize,
  ownedReleases: ownedReleases,
  problemAlert: problemAlert,
  sanitizeAlert: sanitizeAlert,
  storedStatus: storedStatus,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundReleaseStatus = api;
}
