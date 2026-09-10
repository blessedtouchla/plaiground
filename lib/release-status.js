'use strict';

/**
 * Store-facing labels for real catalog release statuses.
 * Live when the status string is live/delivered, or when delivered_at is
 * set and the row is not rejected / needs_fix / qc_rejected.
 * pending / pending_review → PLAIGROUND QC (house review).
 * qc_inspection → Platform QC (store QC). Never name a distributor.
 * Live rows keep badge Live. A subline uses America/Los_Angeles calendar
 * days: YYYY-MM-DD street dates compare as that day; timestamps convert
 * to LA. Future → "Out MMM D". Today, past, or missing → "Out now".
 */

var LIVE = { live: true, delivered: true };
var PROCESSING = { approved: true, processing: true, delivering: true };
var PLATFORM_QC = { qc_inspection: true };
var PENDING = { pending: true, pending_review: true };
var NEEDS_FIX = { needs_fix: true, needsfix: true };
var QC_REJECTED = {
  rejected: true,
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

function deliveredStamp(row) {
  if (!row || typeof row !== 'object') return '';
  var raw = row.delivered_at != null && row.delivered_at !== '' ? row.delivered_at : row.deliveredAt;
  if (raw == null) return '';
  return String(raw).trim();
}

function blocksLiveOverride(status) {
  var g = group(status);
  return g === 'needs_fix' || g === 'qc_rejected';
}

function liveFromDelivery(row, status) {
  return Boolean(deliveredStamp(row)) && !blocksLiveOverride(status);
}

function group(status) {
  var s = normalize(status);
  if (LIVE[s]) return 'live';
  if (NEEDS_FIX[s]) return 'needs_fix';
  if (QC_REJECTED[s]) return 'qc_rejected';
  if (PLATFORM_QC[s]) return 'platform_qc';
  if (PROCESSING[s]) return 'processing';
  if (PENDING[s]) return 'pending';
  if (s === 'signatures') return 'signatures';
  if (s === 'store_gone') return 'store_gone';
  if (s === 'takedown_submitted' || s === 'taken_down' || s === 'removing') return 'removing';
  if (s === 'takedown_failed' || s === 'takedown_fail') return 'takedown_failed';
  if (DRAFT[s] || !s) return 'draft';
  return 'pending';
}

function label(status) {
  var g = group(status);
  if (g === 'live') return 'Live';
  if (g === 'needs_fix') return 'Needs fix';
  if (g === 'qc_rejected') return 'QC rejected';
  if (g === 'platform_qc') return 'Platform QC';
  if (g === 'processing') return 'Processing';
  if (g === 'pending') return 'PLAIGROUND QC';
  if (g === 'signatures') return 'Awaiting signatures';
  if (g === 'removing') return 'Removing';
  if (g === 'takedown_failed') return 'Takedown failed';
  return 'Draft';
}

function dot(status) {
  var g = group(status);
  if (g === 'live') return 'green';
  if (g === 'needs_fix' || g === 'qc_rejected' || g === 'takedown_failed') return 'red';
  if (g === 'pending' || g === 'processing' || g === 'platform_qc' || g === 'removing') return 'yellow';
  return 'gray';
}

function isLive(status) {
  if (status && typeof status === 'object' && !Array.isArray(status)) {
    return displayInfo(status).live;
  }
  return group(status) === 'live';
}

function isNeedsFix(status) {
  return group(status) === 'needs_fix';
}

function isQcRejected(status) {
  return group(status) === 'qc_rejected';
}

var LIGHTNING_RETURNED_ID = 'e41e056b-b316-4de7-ba0f-037f49629377';

var RETURNED_LOCK = [
  { id: 'd412cc82-7acb-44ef-9c04-f92e4f2bcda6', title: 'GOLDEN ERA', reason: 'Audio quality issues' },
  { id: '6629b532-2e78-4be6-84eb-e4dfa9ac33e5', title: 'Metete en el groove', reason: 'Invalid cover art' },
  { id: '37524790-6cbf-4726-a386-384ab959731a', title: 'The night sky', reason: 'Incomplete metadata' },
  { id: LIGHTNING_RETURNED_ID, title: 'Lightning', reason: '' },
];

function catalogIdMatch(have, want) {
  var a = String(have || '').trim().toLowerCase();
  var b = String(want || '').trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  var ha = a.replace(/-/g, '');
  var hb = b.replace(/-/g, '');
  if (!/^[0-9a-f]{8,}$/.test(ha) || !/^[0-9a-f]{8,}$/.test(hb)) return false;
  if (ha.length < 8 || hb.length < 8) return false;
  return ha.indexOf(hb) === 0 || hb.indexOf(ha) === 0;
}

function releaseIdOf(row) {
  return String((row && (row.tonegrid_release_id || row.uuid || row.id)) || '').trim();
}

function isLightningReturned(row) {
  return catalogIdMatch(releaseIdOf(row), LIGHTNING_RETURNED_ID);
}

function isReturnedLockId(id) {
  var raw = String(id || '').trim();
  if (!raw) return false;
  var i;
  for (i = 0; i < RETURNED_LOCK.length; i += 1) {
    if (catalogIdMatch(raw, RETURNED_LOCK[i].id)) return true;
  }
  return false;
}

function isReturnedRelease(row, statusHint) {
  if (!row && !statusHint) return false;
  var status = statusHint || (row && (row.tonegrid_status || row.status)) || '';
  if (isQcRejected(status)) return true;
  if (isLightningReturned(row)) return true;
  return false;
}

function resubmitHref() {
  return 'upload.html';
}

function collectedCatalogIds(releases, me) {
  var ids = [];
  var i;
  (releases || []).forEach(function (row) {
    var id = releaseIdOf(row);
    if (id) ids.push(id);
  });
  if (me && Array.isArray(me.tonegrid_release_ids)) {
    for (i = 0; i < me.tonegrid_release_ids.length; i += 1) {
      if (me.tonegrid_release_ids[i]) ids.push(me.tonegrid_release_ids[i]);
    }
  }
  var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
  for (i = 0; i < stored.length; i += 1) {
    var sid = releaseIdOf(stored[i]);
    if (sid) ids.push(sid);
  }
  return ids;
}

function catalogHasReturnedLock(releases, me) {
  var ids = collectedCatalogIds(releases, me);
  var i;
  for (i = 0; i < ids.length; i += 1) {
    if (isReturnedLockId(ids[i])) return true;
  }
  var rows = (releases || []).slice();
  var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
  for (i = 0; i < stored.length; i += 1) rows.push(stored[i]);
  for (i = 0; i < rows.length; i += 1) {
    var title = String((rows[i] && rows[i].title) || '').trim().toLowerCase();
    if (title === 'golden era' || title === 'metete en el groove' || title === 'the night sky') {
      if (isQcRejected(rows[i] && (rows[i].tonegrid_status || rows[i].status))) return true;
    }
    if (isLightningReturned(rows[i])) return true;
  }
  return false;
}

function returnedFromProfile(me, existing) {
  var have = {};
  (existing || []).forEach(function (row) {
    var id = releaseIdOf(row).toLowerCase();
    if (id) have[id] = true;
  });
  var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
  var extra = [];
  stored.forEach(function (item) {
    if (!isReturnedRelease(item)) return;
    var id = releaseIdOf(item);
    if (!id || have[id.toLowerCase()]) return;
    have[id.toLowerCase()] = true;
    extra.push({
      uuid: id,
      title: String((item && item.title) || '').trim() || 'Untitled',
      type: 'single',
      status: (item && (item.tonegrid_status || item.status)) || 'rejected',
      rejection_reason: String((item && item.rejection_reason) || '').trim(),
    });
  });
  return extra;
}

function hasLightningRow(releases) {
  return (releases || []).some(function (row) {
    return isLightningReturned(row);
  });
}

function mergeReturnedCatalog(releases, me) {
  var list = (releases || []).slice();
  var extra = returnedFromProfile(me, list);
  if (extra.length) list = list.concat(extra);
  if (hasLightningRow(list)) return list;
  var owned = collectedCatalogIds(list, me);
  var ownsLightning = owned.some(function (id) {
    return catalogIdMatch(id, LIGHTNING_RETURNED_ID);
  });
  if (!ownsLightning && !catalogHasReturnedLock(list, me)) return list;
  list.push({
    uuid: LIGHTNING_RETURNED_ID,
    title: 'Lightning',
    type: 'single',
    status: 'draft',
    rejection_reason: '',
  });
  return list;
}

function splitRejected(releases) {
  var main = [];
  var rejected = [];
  (releases || []).forEach(function (row) {
    if (isReturnedRelease(row)) rejected.push(row);
    else main.push(row);
  });
  return { main: main, rejected: rejected };
}

function isProblem(status) {
  var g = group(status);
  return g === 'needs_fix' || g === 'qc_rejected';
}

function isKnownPipeline(status) {
  var s = normalize(status);
  return Boolean(LIVE[s] || PROCESSING[s] || PLATFORM_QC[s] || PENDING[s] || NEEDS_FIX[s] || QC_REJECTED[s] || DRAFT[s]
    || s === 'signatures' || s === 'taken_down' || s === 'takedown_submitted'
    || s === 'removing' || s === 'store_gone'
    || s === 'takedown_failed' || s === 'takedown_fail');
}

function shouldCheckOmissions(status) {
  var s = normalize(status);
  return Boolean(NEEDS_FIX[s] || QC_REJECTED[s]);
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
  removing: true,
  store_gone: true,
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
    'copyright_holder',
    'copyrightHolder',
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

function isLeftoverQcLine(line) {
  var text = String(line == null ? '' : line).trim();
  if (!text) return false;
  var i;
  for (i = 0; i < STORE_QC_LINES.length; i += 1) {
    if (text === STORE_QC_LINES[i]) return true;
  }
  return false;
}

function splitAlertLines(text) {
  return String(text || '').split(/\n+/).map(function (line) {
    return line.trim();
  }).filter(Boolean);
}

function dropInventedLines(lines, status) {
  var list = Array.isArray(lines) ? lines : [];
  if (isNeedsFix(status)) return list.slice();
  return list.filter(function (line) { return !isLeftoverQcLine(line); });
}

function problemAlert(row, statusHint) {
  var status = statusHint || (row && (row.tonegrid_status || row.status)) || '';
  var g = group(status);
  if (g === 'live' || g === 'draft' || g === 'removing' || g === 'store_gone' || g === 'takedown_failed' || g === 'signatures' || g === 'pending' || g === 'processing' || g === 'platform_qc') {
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
  if (msg) parts = parts.concat(splitAlertLines(msg));
  if (omit.length) parts = parts.concat(omit);
  return dropInventedLines(parts, status).join('\n');
}

var OUT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function streetDate(row) {
  if (!row || typeof row !== 'object') return '';
  var raw = row.release_date != null && row.release_date !== '' ? row.release_date
    : (row.releaseDate != null && row.releaseDate !== '' ? row.releaseDate
      : (row.street_date != null && row.street_date !== '' ? row.street_date
        : row.streetDate));
  if (raw == null) return '';
  return String(raw).trim();
}

function calendarDayLA(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  } catch (err) {
    return d.toISOString().slice(0, 10);
  }
}

function todayLA() {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  } catch (err) {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatOutMmmD(day) {
  var parts = String(day || '').split('-');
  var month = Number(parts[1]);
  var date = Number(parts[2]);
  if (!month || !date || !OUT_MONTHS[month - 1]) return 'Out now';
  return 'Out ' + OUT_MONTHS[month - 1] + ' ' + date;
}

function isShownLive(row, status) {
  return liveFromDelivery(row, status) || group(status) === 'live';
}

function outLine(row, statusHint) {
  var status = statusHint || (row && (row.tonegrid_status || row.status)) || '';
  if (!isShownLive(row, status)) return '';
  var day = calendarDayLA(streetDate(row));
  if (!day) return 'Out now';
  if (day > todayLA()) return formatOutMmmD(day);
  return 'Out now';
}

function displayInfo(row, statusHint) {
  var status = statusHint || (row && (row.tonegrid_status || row.status)) || '';
  if (liveFromDelivery(row, status)) {
    return {
      status: normalize(status),
      group: 'live',
      label: 'Live',
      dot: 'green',
      live: true,
      alert: '',
      out: outLine(row, status),
    };
  }
  var mapped = info(status);
  var alert = problemAlert(row, status);
  if (alert && mapped.group === 'qc_rejected') {
    return {
      status: mapped.status,
      group: mapped.group,
      label: 'QC rejected',
      dot: 'red',
      live: false,
      alert: alert,
      out: '',
    };
  }
  if (alert && mapped.group === 'needs_fix') {
    return {
      status: mapped.status,
      group: mapped.group,
      label: 'Needs fix',
      dot: 'red',
      live: false,
      alert: alert,
      out: '',
    };
  }
  return {
    status: mapped.status,
    group: mapped.group,
    label: mapped.label,
    dot: mapped.dot,
    live: mapped.live,
    alert: alert,
    out: mapped.live ? outLine(row, status) : '',
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

function isRemoving(status) {
  return group(status) === 'removing';
}

function isHiddenFromList(status, row) {
  if (row && isReturnedRelease(row, status)) return false;
  var s = normalize(status);
  if (s === 'store_gone') return true;
  if (s === 'draft') return true;
  return false;
}

function isUnsubmittedDraft(row, draft) {
  row = row || {};
  draft = draft || {};
  if (isReturnedRelease(row)) return false;
  if (row.local_draft === true || String(row.id || '') === 'local-draft') return true;
  if (row.saved_draft === true || row.saved_draft === 'true') return true;
  var rowId = String(row.uuid || (row.id && row.id !== 'local-draft' ? row.id : '') || '').toLowerCase();
  var draftId = String(draft.release_id || '').toLowerCase();
  var leftover = draft.saved_draft === true || draft.saved_draft === 'true'
    || draft.local_draft === true || String(draft.id || '') === 'local-draft';
  if (leftover && rowId && draftId && rowId === draftId) return true;
  var submitted = row.submitted != null ? row.submitted : draft.submitted;
  if (submitted === true || submitted === 'true') return false;
  var status = normalize(row.status || row.tonegrid_status);
  return status === 'draft';
}

function isPendingPipeline(card) {
  if (!card || card.live) return false;
  var g = card.group || group(card.status);
  return g === 'pending' || g === 'processing' || g === 'platform_qc' || g === 'needs_fix' || g === 'qc_rejected' || g === 'removing';
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
    delivered_at: deliveredStamp(row),
    release_date: String((row && (row.release_date || row.releaseDate)) || '').trim(),
    updated_at: String((row && (row.updated_at || row.updatedAt)) || '').trim(),
    artwork_url: coverUrl(row),
    alert: mapped.alert,
    out: mapped.out || '',
  };
}

function ownedReleases(me) {
  var have = ownedIds(me);
  var list = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
  var byId = {};
  var hidden = {};
  var i;
  for (i = 0; i < list.length; i += 1) {
    var row = list[i];
    if (!releaseOwned(row, have)) continue;
    if (isHiddenFromList(row.tonegrid_status || row.status, row)) {
      hidden[String((row.tonegrid_release_id || row.id) || '').toLowerCase()] = true;
      continue;
    }
    var card = cardFromRow(row);
    if (!card || !card.id) continue;
    byId[card.id.toLowerCase()] = card;
  }
  var raw = me && Array.isArray(me.tonegrid_release_ids) ? me.tonegrid_release_ids : [];
  var out = [];
  for (i = 0; i < raw.length; i += 1) {
    var id = String(raw[i] || '').trim();
    if (!id) continue;
    if (hidden[id.toLowerCase()]) continue;
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
  LIGHTNING_RETURNED_ID: LIGHTNING_RETURNED_ID,
  RETURNED_LOCK: RETURNED_LOCK,
  STORE_QC_LINES: STORE_QC_LINES,
  accountHasLive: accountHasLive,
  cardFromRow: cardFromRow,
  catalogIdMatch: catalogIdMatch,
  coverUrl: coverUrl,
  deliveryFailMessage: deliveryFailMessage,
  displayInfo: displayInfo,
  dot: dot,
  dropInventedLines: dropInventedLines,
  group: group,
  info: info,
  isHiddenFromList: isHiddenFromList,
  isLeftoverQcLine: isLeftoverQcLine,
  isLightningReturned: isLightningReturned,
  isUnsubmittedDraft: isUnsubmittedDraft,
  isLive: isLive,
  isNeedsFix: isNeedsFix,
  isPendingPipeline: isPendingPipeline,
  isQcRejected: isQcRejected,
  isRemoving: isRemoving,
  isReturnedRelease: isReturnedRelease,
  isPlaceholderRelease: isPlaceholderRelease,
  isProblem: isProblem,
  label: label,
  liveCount: liveCount,
  mergeReturnedCatalog: mergeReturnedCatalog,
  omissionLines: omissionLines,
  outLine: outLine,
  pendingCount: pendingCount,
  normalize: normalize,
  ownedReleases: ownedReleases,
  problemAlert: problemAlert,
  resubmitHref: resubmitHref,
  sanitizeAlert: sanitizeAlert,
  splitRejected: splitRejected,
  storedStatus: storedStatus,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundReleaseStatus = api;
}
