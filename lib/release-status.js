'use strict';

/**
 * DistroKid-style labels for real ToneGrid release statuses.
 * Live only when ToneGrid/DSPs actually say live or delivered.
 */

var LIVE = { live: true, delivered: true };
var PROCESSING = { approved: true, processing: true, delivering: true };
var PENDING = { pending: true, pending_review: true };
var REJECTED = { rejected: true, 'needs-fix': true, needs_fix: true, needsfix: true, error: true };
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
  if (s === 'taken_down') return 'taken_down';
  if (DRAFT[s] || !s) return 'draft';
  return 'pending';
}

function label(status) {
  var g = group(status);
  if (g === 'live') return 'Live';
  if (g === 'rejected') return 'Needs fix';
  if (g === 'processing') return 'Processing';
  if (g === 'pending') return 'Pending';
  if (g === 'signatures') return 'Awaiting signatures';
  if (g === 'taken_down') return 'Taken down';
  return 'Draft';
}

function dot(status) {
  var g = group(status);
  if (g === 'live') return 'green';
  if (g === 'rejected') return 'red';
  if (g === 'pending' || g === 'processing') return 'yellow';
  return 'gray';
}

function isLive(status) {
  return group(status) === 'live';
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

function accountHasLive(me) {
  var list = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
  var i;
  for (i = 0; i < list.length; i += 1) {
    if (isLive(list[i] && (list[i].tonegrid_status || list[i].status))) return true;
  }
  return false;
}

function liveCount(me) {
  var list = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
  var n = 0;
  var i;
  for (i = 0; i < list.length; i += 1) {
    if (isLive(list[i] && (list[i].tonegrid_status || list[i].status))) n += 1;
  }
  return n;
}

var api = {
  accountHasLive: accountHasLive,
  dot: dot,
  group: group,
  info: info,
  isLive: isLive,
  label: label,
  liveCount: liveCount,
  normalize: normalize,
  storedStatus: storedStatus,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundReleaseStatus = api;
}
