(function (global) {
  var RELEASES_URL = '/api/tonegrid/releases';
  var POLL_MS = 60000;
  var watching = null;

  function statusApi() {
    return (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus)
      || (global && global.PlaigroundReleaseStatus)
      || null;
  }

  function groupOf(status) {
    var api = statusApi();
    if (api && typeof api.group === 'function') return api.group(status);
    var s = String(status == null ? '' : status).trim().toLowerCase();
    if (s === 'live' || s === 'delivered') return 'live';
    if (s === 'rejected' || s === 'needs-fix' || s === 'needs_fix' || s === 'error' || s === 'failed') return 'rejected';
    if (s === 'approved' || s === 'processing' || s === 'delivering' || s === 'qc_inspection') return 'processing';
    if (s === 'pending' || s === 'pending_review') return 'pending';
    return s || 'draft';
  }

  function needsPoll(statuses) {
    var list = Array.isArray(statuses) ? statuses : [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      var g = groupOf(list[i]);
      if (g === 'pending' || g === 'processing') return true;
    }
    return false;
  }

  function clearTimer() {
    if (watching && watching.timer && typeof clearInterval === 'function') {
      clearInterval(watching.timer);
    }
    if (watching) watching.timer = null;
  }

  function watch(opts) {
    opts = opts || {};
    var refresh = typeof opts.refresh === 'function' ? opts.refresh : null;
    clearTimer();
    function run() {
      if (global.document && global.document.hidden) return;
      if (refresh) refresh();
    }
    function onFocus() {
      run();
    }
    if (!watching) {
      if (global.window && typeof global.window.addEventListener === 'function') {
        global.window.addEventListener('focus', onFocus);
      }
      if (global.document && typeof global.document.addEventListener === 'function') {
        global.document.addEventListener('visibilitychange', onFocus);
      }
      watching = { refresh: refresh, timer: null, bound: true };
    } else {
      watching.refresh = refresh;
    }
    if (needsPoll(opts.statuses) && typeof setInterval === 'function') {
      watching.timer = setInterval(run, POLL_MS);
    }
    return watching;
  }

  var api = {
    RELEASES_URL: RELEASES_URL,
    POLL_MS: POLL_MS,
    groupOf: groupOf,
    needsPoll: needsPoll,
    watch: watch,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.PlaigroundStoreStatusRefresh = api;
  }
  if (global) global.PlaigroundStoreStatusRefresh = api;
})(typeof window !== 'undefined' ? window : globalThis);
