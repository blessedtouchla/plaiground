(function () {
  var ARTISTS_URL = '/api/tonegrid/artists';
  var RELEASES_URL = '/api/tonegrid/releases';
  var TRACKS_URL = '/api/tonegrid/tracks';
  var DRAFT_KEY = 'plaiground.store.draft';
  var MAX_AUDIO_BYTES = 200 * 1024 * 1024;
  var MAX_ARTWORK_BYTES = 15 * 1024 * 1024;

  function $(id) {
    return document.getElementById(id);
  }

  function qsAll(sel) {
    if (!document || typeof document.querySelectorAll !== 'function') return [];
    var found = document.querySelectorAll(sel);
    return found || [];
  }

  function fieldValue(id) {
    var el = $(id);
    return el ? String(el.value || '').trim() : '';
  }

  function typeaheadTypedValue(select) {
    if (!select) return '';
    var field = select.parentNode;
    var input = field && field.querySelector ? field.querySelector('.typeahead-input') : null;
    if (!input && typeof document !== 'undefined' && document.getElementById && select.id) {
      input = document.getElementById(select.id + '-type');
    }
    return input ? String(input.value || '').trim() : '';
  }

  function catalogFieldValue(id) {
    var el = $(id);
    var raw = el ? String(el.value || '').trim() : '';
    if (!raw) raw = typeaheadTypedValue(el);
    var catalog = (typeof PlaigroundUploadCatalog !== 'undefined' && PlaigroundUploadCatalog) || null;
    if (catalog && typeof catalog.canonicalCatalogValue === 'function') {
      var canon = catalog.canonicalCatalogValue(el, raw);
      if (canon) return String(canon);
    }
    return raw;
  }

  function catalogLanguageValue() {
    var raw = catalogFieldValue('tg-language').toLowerCase();
    return /^[a-z]{2}$/.test(raw) ? raw : '';
  }

  function rules() {
    return (typeof PlaigroundUploadRequired !== 'undefined' && PlaigroundUploadRequired) || null;
  }

  function isDemoCopy(value) {
    return /^(neon shadows|victoria reyes|victoria void|electronic \/ synthwave)$/i.test(String(value || '').trim());
  }

  function storageGet(key) {
    try {
      var local = localStorage.getItem(key);
      if (local) return local;
    } catch (err) {}
    try {
      return sessionStorage.getItem(key) || '';
    } catch (err) {
      return '';
    }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (err) {}
    try { sessionStorage.setItem(key, value); } catch (err) {}
  }

  function readDraft() {
    var draft;
    try {
      draft = JSON.parse(storageGet(DRAFT_KEY) || '{}') || {};
    } catch (err) {
      draft = {};
    }
    if (isDemoCopy(draft.title)) draft.title = '';
    if (isDemoCopy(draft.name)) draft.name = '';
    if (isDemoCopy(draft.genre)) draft.genre = '';
    return draft;
  }

  function writeDraft(patch) {
    var next = {};
    var current = readDraft();
    Object.keys(current).forEach(function (key) {
      next[key] = current[key];
    });
    Object.keys(patch || {}).forEach(function (key) {
      if (patch[key] !== undefined) next[key] = patch[key];
    });
    storageSet(DRAFT_KEY, JSON.stringify(next));
    return next;
  }

  function humanErrorText(value, fallback) {
    if (value == null || value === '') return fallback || '';
    if (typeof value === 'string') {
      var trimmed = String(value).replace(/^\s+|\s+$/g, '');
      if (!trimmed || trimmed === '[object Object]') return fallback || 'Something went wrong. Retry.';
      return trimmed;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
      if (typeof value.message === 'string' && value.message) return humanErrorText(value.message, fallback);
      if (typeof value.error === 'string' && value.error) return humanErrorText(value.error, fallback);
      if (value.error && value.error !== value) return humanErrorText(value.error, fallback);
      if (typeof value.detail === 'string' && value.detail) return humanErrorText(value.detail, fallback);
      if (typeof value.description === 'string' && value.description) return humanErrorText(value.description, fallback);
      try {
        var keys = Object.keys(value);
        var i;
        for (i = 0; i < keys.length; i += 1) {
          var next = value[keys[i]];
          if (typeof next === 'string' && next && next !== '[object Object]') return next;
        }
      } catch (err) {}
    }
    return fallback || 'Something went wrong. Retry.';
  }

  function sanitizePartnerCopy(text) {
    var next = humanErrorText(text, '');
    next = next.replace(/\bthe\s+ToneGrid\b/gi, 'the store');
    next = next.replace(/ToneGrid/gi, 'the store');
    next = next.replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
    return next;
  }

  function setStatus(id, text) {
    var el = $(id);
    if (!el) return;
    var shown = sanitizePartnerCopy(text || '');
    el.textContent = shown;
    el.hidden = !shown;
  }

  function pickUuid(payload) {
    if (!payload || typeof payload !== 'object') return '';
    function asId(value) {
      var next = String(value || '').trim();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(next) ? next : '';
    }
    return asId(payload.uuid)
      || asId(payload.id)
      || asId(payload.artist && (payload.artist.uuid || payload.artist.id))
      || asId(payload.release && (payload.release.uuid || payload.release.id))
      || asId(payload.track && (payload.track.uuid || payload.track.id))
      || asId(payload.data && payload.data.uuid)
      || asId(payload.data && payload.data.id)
      || asId(payload.data && payload.data.artist && (payload.data.artist.uuid || payload.data.artist.id))
      || asId(payload.data && payload.data.release && (payload.data.release.uuid || payload.data.release.id))
      || asId(payload.data && payload.data.track && (payload.data.track.uuid || payload.data.track.id));
  }

  function parseJson(response) {
    return response.json().then(function (data) {
      return { ok: response.ok, status: response.status, data: data || {} };
    }).catch(function () {
      return { ok: false, status: response.status, data: {} };
    });
  }

  var DEFAULT_CATALOG_TIMEOUT_MS = 30000;

  function catalogTimeoutMs() {
    try {
      if (typeof window !== 'undefined' && window.PlaigroundCatalogTimeoutMs != null) {
        var n = Number(window.PlaigroundCatalogTimeoutMs);
        if (n > 0 && isFinite(n)) return n;
      }
    } catch (err) {}
    return DEFAULT_CATALOG_TIMEOUT_MS;
  }

  function catalogTimeoutMessage() {
    return 'We could not reach the store. Try again.';
  }

  function isNoStoreResponse(result, err) {
    if (err && (err.timedOut === true || /did not respond|could not reach|timed out/i.test(String(err.message || '')))) {
      return true;
    }
    if (!result) return Boolean(err);
    if (result.timedOut === true) return true;
    if (result.status === 0) return true;
    return false;
  }

  function withCatalogTimeout(work) {
    var ms = catalogTimeoutMs();
    var settled = false;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        var err = new Error(catalogTimeoutMessage());
        err.timedOut = true;
        reject(err);
      }, ms);
      Promise.resolve()
        .then(work)
        .then(function (value) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }, function (err) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  function post(url, body, idempotencyKey) {
    var headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 255);
    return withCatalogTimeout(function () {
      return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: headers,
        body: JSON.stringify(body),
      }).then(parseJson);
    });
  }

  function getJson(url) {
    return fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(parseJson);
  }

  function pad2(n) {
    return String(n).padStart ? String(n).padStart(2, '0') : ('0' + n).slice(-2);
  }

  function toLocalIsoDate(d) {
    if (!d || typeof d.getFullYear !== 'function') return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function minSubmitDate() {
    var d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalIsoDate(d);
  }

  function todayLocal() {
    return toLocalIsoDate(new Date());
  }

  function toIsoDate(value) {
    var raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    var mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!mdy) return '';
    return mdy[3] + '-' + String(mdy[1]).padStart(2, '0') + '-' + String(mdy[2]).padStart(2, '0');
  }

  function normalizePickedDate(value) {
    return toIsoDate(value);
  }

  function isReadyReleaseDate(value) {
    var date = toIsoDate(value);
    return Boolean(date && date >= minSubmitDate());
  }

  function releaseDateHint(dateEl) {
    if (!dateEl || typeof document === 'undefined' || !document.getElementById) return null;
    var id = dateEl.id === 'edit-release-date' ? 'edit-release-date-hint' : 'tg-release-date-hint';
    return document.getElementById(id);
  }

  function markReleaseDateState(dateEl, date) {
    var ready = isReadyReleaseDate(date);
    var tooSoon = Boolean(date && !ready);
    var message = tooSoon ? 'Stores need 7 days of lead time.' : '';
    if (dateEl && typeof dateEl.setCustomValidity === 'function') {
      dateEl.setCustomValidity(message);
    }
    if (dateEl && dateEl.classList) {
      if (dateEl.classList.toggle) dateEl.classList.toggle('is-invalid', tooSoon);
      else if (tooSoon && dateEl.classList.add) dateEl.classList.add('is-invalid');
      else if (dateEl.classList.remove) dateEl.classList.remove('is-invalid');
    }
    if (dateEl && dateEl.setAttribute) {
      if (tooSoon) dateEl.setAttribute('aria-invalid', 'true');
      else if (dateEl.removeAttribute) dateEl.removeAttribute('aria-invalid');
    }
    var hint = releaseDateHint(dateEl);
    if (hint && hint.classList) {
      if (hint.classList.toggle) hint.classList.toggle('is-error', tooSoon);
      else if (tooSoon && hint.classList.add) hint.classList.add('is-error');
      else if (hint.classList.remove) hint.classList.remove('is-error');
    }
    return ready;
  }

  function bindReleaseDatePicker(dateEl) {
    if (!dateEl) return '';
    dateEl.type = 'date';
    dateEl.required = true;
    // Do not set min to the 7-day lock — iOS clears any tap below min.
    dateEl.min = '';
    if (dateEl.setAttribute) {
      dateEl.setAttribute('type', 'date');
      dateEl.setAttribute('required', '');
      dateEl.setAttribute('aria-describedby', 'tg-release-date-hint');
    }
    if (dateEl.removeAttribute) dateEl.removeAttribute('min');
    var shown = normalizePickedDate(dateEl.value) || normalizePickedDate(readDraft().release_date);
    if (shown) dateEl.value = shown;
    markReleaseDateState(dateEl, shown);
    return isReadyReleaseDate(shown) ? shown : '';
  }

  function persistReleaseDate(dateEl, opts) {
    opts = opts || {};
    var raw = dateEl ? String(dateEl.value || '').trim() : '';
    var picked = normalizePickedDate(raw);
    if (!raw && opts.ignoreEmpty) {
      var kept = normalizePickedDate(readDraft().release_date);
      if (dateEl && kept && !dateEl.value) dateEl.value = kept;
      markReleaseDateState(dateEl, dateEl ? normalizePickedDate(dateEl.value) : kept);
      var restored = normalizePickedDate(dateEl && dateEl.value) || kept;
      return isReadyReleaseDate(restored) ? restored : '';
    }
    if (picked) {
      if (dateEl && dateEl.value !== picked) dateEl.value = picked;
      markReleaseDateState(dateEl, picked);
      writeDraft({ release_date: picked });
      return isReadyReleaseDate(picked) ? picked : '';
    }
    if (opts.snapIfEmpty) {
      var snap = minSubmitDate();
      if (dateEl) dateEl.value = snap;
      markReleaseDateState(dateEl, snap);
      writeDraft({ release_date: snap });
      return snap;
    }
    markReleaseDateState(dateEl, '');
    writeDraft({ release_date: '' });
    return '';
  }

  function todayUtc() {
    return new Date().toISOString().slice(0, 10);
  }

  function truthyFlag(value, fallback) {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return fallback;
  }

  function setSwitch(input, on) {
    if (!input) return;
    input.checked = Boolean(on);
    if (input.setAttribute) input.setAttribute('aria-checked', on ? 'true' : 'false');
    var knob = input.nextElementSibling;
    if (knob && knob.classList) {
      if (on) knob.classList.add('on');
      else knob.classList.remove('on');
    }
  }

  function setPanel(panel, show) {
    if (!panel) return;
    panel.hidden = !show;
    if (panel.classList && panel.classList.toggle) panel.classList.toggle('is-hidden', !show);
  }

  function browserTimezone() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz ? String(tz) : '';
    } catch (err) {
      return '';
    }
  }

  function ensureTimezoneOption(select, value) {
    if (!select || !value) return;
    var options = select.options || [];
    for (var i = 0; i < options.length; i += 1) {
      if (String(options[i].value) === value) return;
    }
    if (typeof document === 'undefined' || !document.createElement) return;
    var opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }

  function normalizePreorderDate(value, releaseDate) {
    var date = toIsoDate(value);
    if (!date || date < todayUtc()) return '';
    var release = toIsoDate(releaseDate);
    if (release && date > release) return release;
    return date;
  }

  function collectReleaseSchedule() {
    var preorderOn = $('tg-preorder-on');
    var timeOn = $('tg-time-on');
    var preorderEl = $('tg-preorder-date');
    var timeEl = $('tg-release-time');
    var zoneEl = $('tg-release-timezone');
    var releaseDate = persistReleaseDate($('tg-release-date'), { ignoreEmpty: true });
    var selectPreorder = Boolean(preorderOn && preorderOn.checked);
    var defineTime = Boolean(timeOn && timeOn.checked);
    var preorderDate = '';
    if (preorderEl) {
      preorderEl.min = todayUtc();
      if (releaseDate) preorderEl.max = releaseDate;
      else if (preorderEl.removeAttribute) preorderEl.removeAttribute('max');
      preorderDate = normalizePreorderDate(preorderEl.value, releaseDate);
      if (preorderEl.value !== preorderDate) preorderEl.value = preorderDate;
    }
    var releaseTime = timeEl ? String(timeEl.value || '').trim() : '';
    var releaseTimezone = zoneEl ? String(zoneEl.value || '').trim() : '';
    setSwitch(preorderOn, selectPreorder);
    setSwitch(timeOn, defineTime);
    setPanel($('tg-preorder-panel'), selectPreorder);
    setPanel($('tg-time-panel'), defineTime);
    return writeDraft({
      select_preorder: selectPreorder,
      preorder_date: preorderDate,
      define_time: defineTime,
      release_time: releaseTime,
      release_timezone: releaseTimezone,
    });
  }

  function bindReleaseSchedule() {
    var preorderOn = $('tg-preorder-on');
    var timeOn = $('tg-time-on');
    if (!preorderOn && !timeOn) return;
    var draft = readDraft();
    var preorderEl = $('tg-preorder-date');
    var timeEl = $('tg-release-time');
    var zoneEl = $('tg-release-timezone');
    var selectPreorder = truthyFlag(draft.select_preorder, Boolean(toIsoDate(draft.preorder_date)));
    var defineTime = truthyFlag(draft.define_time, true);
    if (preorderEl) {
      preorderEl.type = 'date';
      preorderEl.min = todayUtc();
      if (preorderEl.setAttribute) {
        preorderEl.setAttribute('type', 'date');
        preorderEl.setAttribute('min', todayUtc());
      }
      preorderEl.value = normalizePreorderDate(draft.preorder_date, draft.release_date);
    }
    if (timeEl) {
      timeEl.value = draft.release_time || timeEl.value || '00:00';
    }
    if (zoneEl) {
      var zone = draft.release_timezone || browserTimezone() || zoneEl.value || 'UTC';
      ensureTimezoneOption(zoneEl, zone);
      zoneEl.value = zone;
    }
    setSwitch(preorderOn, selectPreorder);
    setSwitch(timeOn, defineTime);
    setPanel($('tg-preorder-panel'), selectPreorder);
    setPanel($('tg-time-panel'), defineTime);
    var sync = function () { collectReleaseSchedule(); };
    [preorderOn, timeOn, preorderEl, timeEl, zoneEl].forEach(function (el) {
      if (!el || !el.addEventListener) return;
      el.addEventListener('change', sync);
      el.addEventListener('input', sync);
      el.addEventListener('click', function () {
        if (el === preorderOn || el === timeOn) {
          /* native checkbox already flipped; persist after the tap */
          sync();
        }
      });
    });
    collectReleaseSchedule();
  }

  function documentIdOf(draft) {
    return String((draft && (draft.signwell_document_id || draft.document_id)) || '').trim();
  }

  function isSoloOwned(draft) {
    var gate = rules();
    if (gate && typeof gate.isSoloOwned === 'function') return gate.isSoloOwned(draft);
    return draft && (draft.solo_owned_100 === true || draft.solo_owned_100 === 'true') && !String((draft && draft.featured) || '').trim();
  }

  function checkSignWell(documentId) {
    if (!documentId) {
      return Promise.resolve({
        ok: false,
        status: 403,
        data: { signed: false, error: 'Create the split sheet before submitting.', code: 'SIGNWELL_REQUIRED' },
      });
    }
    return getJson('/api/signwell?id=' + encodeURIComponent(documentId));
  }

  function persistSignWellStatus(documentId, data) {
    var signed = Boolean(data && data.signed);
    return writeDraft({
      signwell_document_id: documentId,
      signwell_signed: signed,
      signwell_status: signed ? (data.status || 'Completed') : ((data && data.status) || 'awaiting_signature'),
    });
  }

  function releaseTrackList(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.tracks)) return data.tracks;
    if (data.release && Array.isArray(data.release.tracks)) return data.release.tracks;
    if (data.tracks && Array.isArray(data.tracks.data)) return data.tracks.data;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  function trackIdOf(row) {
    if (!row || typeof row !== 'object') return '';
    return String(row.uuid || row.track_id || row.id || '').trim();
  }

  function draftTrackIds(draft) {
    var ids = [];
    if (draft && draft.track_id) ids.push(String(draft.track_id));
    if (Array.isArray(draft && draft.tracks)) {
      draft.tracks.forEach(function (track) {
        if (track && track.track_id) ids.push(String(track.track_id));
      });
    }
    return ids.filter(Boolean);
  }

  function draftHasTrackId(draft) {
    return draftTrackIds(draft).length > 0;
  }

  function albumRowsForSubmit(draft) {
    var live = collectAlbumTracks();
    if (live.length) return live;
    if (Array.isArray(draft && draft.tracks)) {
      return draft.tracks.map(function (track, i) {
        return {
          title: (track && track.title) || '',
          audio: (track && (track.audio || track.file)) || null,
          file: (track && (track.file || track.audio)) || null,
          track_id: (track && track.track_id) || '',
          audio_uploaded: Boolean(track && track.audio_uploaded),
          audio_name: (track && track.audio_name) || '',
          position: (track && track.position) || (i + 1),
        };
      });
    }
    return [];
  }

  function cameThroughUpload(draft) {
    if (!draft) return false;
    if (draft.audio_attached || draft.audio_name || draft.audio_uploaded || draft.track_id) return true;
    if (draft.artwork_name || draft.replaced_release_id) return true;
    if (draft.made_how || draft.rights_confirmed === true) return true;
    if (String(draft.title || '').trim()) return true;
    return false;
  }

  function pickedAudioEvidence(draft) {
    if (selectedAudio()) return true;
    if (cameThroughUpload(draft)) return true;
    var rows = albumRowsForSubmit(draft);
    for (var i = 0; i < rows.length; i += 1) {
      var track = rows[i] || {};
      if (track.audio || track.file || track.audio_name || track.audio_uploaded || track.track_id || track.audio_attached) return true;
    }
    return false;
  }

  function hadAudioEvidence(draft) {
    if (selectedAudio()) return true;
    if (draft && (draft.audio_attached || draft.audio_uploaded || draft.audio_name || draft.track_id)) return true;
    var rows = albumRowsForSubmit(draft);
    for (var i = 0; i < rows.length; i += 1) {
      var track = rows[i] || {};
      if (track.audio || track.file || track.audio_name || track.audio_uploaded || track.track_id || track.audio_attached) return true;
    }
    return false;
  }

  function reattachResult(draft) {
    return {
      recover: true,
      draft: draft,
      result: { data: { error: recoverUploadMessage(), code: 'TRACK_REATTACH' } },
    };
  }

  function isMissingTrackError(result) {
    var msg = String((result && result.data && (result.data.error || result.data.message)) || '');
    return /at least one track|add (a |one )?track|no tracks/i.test(msg);
  }

  function recoverUploadMessage() {
    return 'The audio file is no longer on this page. Go back to Upload and re-attach it, then return to Review.';
  }

  function genuineEmptyMessage() {
    return 'Please add at least one track.';
  }

  function persistFoundTracks(draft, tracks) {
    var ids = [];
    (tracks || []).forEach(function (row) {
      var id = trackIdOf(row);
      if (id) ids.push(id);
    });
    if (!ids.length) return draft;
    var patch = {};
    if (!draft.track_id) patch.track_id = ids[0];
    if (draft.type === 'album') {
      var stored = Array.isArray(draft.tracks) ? draft.tracks.slice() : [];
      if (!stored.length) {
        stored = ids.map(function (id, i) {
          return { title: draft.title || '', track_id: id, audio_uploaded: true, position: i + 1 };
        });
      } else {
        stored = stored.map(function (track, i) {
          var next = {};
          Object.keys(track || {}).forEach(function (key) { next[key] = track[key]; });
          if (!next.track_id && ids[i]) next.track_id = ids[i];
          if (next.track_id) next.audio_uploaded = true;
          return next;
        });
      }
      patch.tracks = stored;
    }
    return Object.keys(patch).length ? writeDraft(patch) : draft;
  }

  function fetchReleaseTracks(releaseId) {
    return getJson(RELEASES_URL + '/' + encodeURIComponent(releaseId)).then(function (result) {
      if (!result.ok) return { ok: false, tracks: [], result: result };
      return { ok: true, tracks: releaseTrackList(result.data).filter(trackIdOf), result: result, data: result.data };
    }).catch(function () {
      return { ok: false, tracks: [], result: { data: { error: 'Could not reach catalog.' } } };
    });
  }

  var sessionReleaseId = '';
  var sessionReleaseChecked = '';
  var sessionReleaseVerified = '';
  var deadReleaseIds = [];
  var heldAudioFile = null;
  var AUDIO_HOLD_DB = 'plaiground-held-audio';
  var AUDIO_HOLD_STORE = 'files';
  var AUDIO_HOLD_KEY = 'master';
  var releaseRecreateCount = 0;
  var MAX_RELEASE_RECREATES = 2;
  var DEAD_RELEASE_COPY = 'Could not create the release. Retry.';

  function markDeadRelease(id) {
    var next = String(id || '').trim();
    if (!next) return;
    var i;
    for (i = 0; i < deadReleaseIds.length; i += 1) {
      if (sameUuid(deadReleaseIds[i], next)) return;
    }
    deadReleaseIds.push(next);
  }

  function isKnownDeadRelease(id) {
    var i;
    for (i = 0; i < deadReleaseIds.length; i += 1) {
      if (sameUuid(deadReleaseIds[i], id)) return true;
    }
    return false;
  }

  function rememberAudioFile(file) {
    if (!file) return;
    heldAudioFile = file;
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB.open) return;
      var req = indexedDB.open(AUDIO_HOLD_DB, 1);
      req.onupgradeneeded = function () {
        if (req.result && !req.result.objectStoreNames.contains(AUDIO_HOLD_STORE)) {
          req.result.createObjectStore(AUDIO_HOLD_STORE);
        }
      };
      req.onsuccess = function () {
        try {
          var tx = req.result.transaction(AUDIO_HOLD_STORE, 'readwrite');
          tx.objectStore(AUDIO_HOLD_STORE).put(file, AUDIO_HOLD_KEY);
        } catch (err) {}
      };
    } catch (err) {}
  }

  function restoreHeldAudio() {
    if (heldAudioFile) return Promise.resolve(heldAudioFile);
    return new Promise(function (resolve) {
      try {
        if (typeof indexedDB === 'undefined' || !indexedDB.open) {
          resolve(null);
          return;
        }
        var req = indexedDB.open(AUDIO_HOLD_DB, 1);
        req.onerror = function () { resolve(null); };
        req.onupgradeneeded = function () {
          if (req.result && !req.result.objectStoreNames.contains(AUDIO_HOLD_STORE)) {
            req.result.createObjectStore(AUDIO_HOLD_STORE);
          }
        };
        req.onsuccess = function () {
          try {
            var tx = req.result.transaction(AUDIO_HOLD_STORE, 'readonly');
            var get = tx.objectStore(AUDIO_HOLD_STORE).get(AUDIO_HOLD_KEY);
            get.onerror = function () { resolve(null); };
            get.onsuccess = function () {
              if (get.result) heldAudioFile = get.result;
              resolve(heldAudioFile || null);
            };
          } catch (err) {
            resolve(null);
          }
        };
      } catch (err) {
        resolve(null);
      }
    });
  }

  function releaseTitleOf(data) {
    if (!data || typeof data !== 'object') return '';
    if (data.title) return String(data.title || '').trim();
    if (data.release && data.release.title) return String(data.release.title || '').trim();
    if (data.data && data.data.title) return String(data.data.title || '').trim();
    return '';
  }

  function catalogReleaseIds() {
    var catalog = catalogFromAccount(accountRecord());
    var ids = (catalog.release_ids || []).slice();
    var me = accountRecord() || {};
    var rows = (me.profile && Array.isArray(me.profile.releases)) ? me.profile.releases : [];
    var i;
    for (i = 0; i < rows.length; i += 1) {
      var id = String((rows[i] && (rows[i].tonegrid_release_id || rows[i].id || rows[i].uuid)) || '').trim();
      if (!isUuidValue(id)) continue;
      if (!ids.some(function (have) { return sameUuid(have, id); })) ids.push(id);
    }
    return ids.filter(isUuidValue);
  }

  function adoptLivingRelease(draft, living) {
    if (!living || !living.id) return draft;
    rememberSessionRelease(living.id, true);
    var trackId = '';
    if (living.tracks && living.tracks.length) trackId = trackIdOf(living.tracks[0]);
    var next = writeDraft({
      release_id: living.id,
      track_id: trackId || draft.track_id || '',
      audio_uploaded: Boolean((living.tracks && living.tracks.length) || draft.audio_uploaded || trackId),
      audio_attached: Boolean(draft.audio_attached || draft.audio_name || (living.tracks && living.tracks.length)),
      replaced_release_id: '',
    });
    if (living.tracks && living.tracks.length) next = persistFoundTracks(next, living.tracks);
    return next;
  }

  function findLivingSongRelease(draft, skipId) {
    var current = draft || readDraft();
    var ids = catalogReleaseIds().filter(function (id) {
      return !sameUuid(id, skipId) && !isKnownDeadRelease(id);
    });
    if (!ids.length) return Promise.resolve(null);
    var matches = [];
    var chain = Promise.resolve();
    ids.forEach(function (id) {
      chain = chain.then(function () {
        return fetchReleaseTracks(id).then(function (loaded) {
          if (!loaded.ok) {
            if (isReleaseMissing(loaded.result)) markDeadRelease(id);
            return;
          }
          var title = releaseTitleOf(loaded.data || (loaded.result && loaded.result.data));
          var want = String((current && current.title) || '').trim();
          if (want && title && !sameSongText(title, want)) return;
          if (want && !title && !(loaded.tracks && loaded.tracks.length)) return;
          matches.push({
            id: id,
            tracks: loaded.tracks || [],
            result: loaded.result,
            data: loaded.data,
          });
        });
      });
    });
    return chain.then(function () {
      var withTracks = matches.filter(function (row) { return row.tracks && row.tracks.length; });
      return withTracks[0] || matches[0] || null;
    });
  }

  function shouldReattach(draft, hasFile, storeTracks) {
    if (hasFile) return false;
    if (storeTracks && storeTracks.length) return false;
    if (hadAudioEvidence(draft)) return false;
    return pickedAudioEvidence(draft) || Boolean(draft && String(draft.title || '').trim());
  }

  function rememberSessionRelease(id, verified) {
    var next = String(id || '').trim();
    if (!next) return;
    sessionReleaseId = next;
    sessionReleaseChecked = next;
    if (verified) sessionReleaseVerified = next;
  }

  function isReleaseMissing(result) {
    if (!result) return false;
    if (result.status === 404) return true;
    var msg = String((result.data && (result.data.error || result.data.message)) || '').toLowerCase();
    return /release not found/.test(msg);
  }

  function deadReleaseResult(result, draft) {
    return {
      failed: true,
      result: { data: { error: DEAD_RELEASE_COPY } },
      draft: draft || (result && result.draft) || readDraft(),
    };
  }

  function sameSongText(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function releaseBelongsToThisSong(draft, fields) {
    if (!draft || !String(draft.release_id || '').trim()) return false;
    var prevTitle = String(draft.title || '').trim();
    var nextTitle = String((fields && fields.title) || '').trim();
    if (prevTitle && nextTitle && !sameSongText(prevTitle, nextTitle)) return false;
    var prevArtist = String(draft.name || '').trim();
    var nextArtist = String((fields && fields.name) || '').trim();
    if (prevArtist && nextArtist && !sameSongText(prevArtist, nextArtist)) return false;
    return true;
  }

  function detachForeignRelease(draft) {
    var current = draft || readDraft();
    if (!String(current.release_id || '').trim()) return current;
    sessionReleaseId = '';
    sessionReleaseChecked = '';
    sessionReleaseVerified = '';
    var stored = Array.isArray(current.tracks) ? current.tracks.map(function (track) {
      var next = {};
      Object.keys(track || {}).forEach(function (key) { next[key] = track[key]; });
      next.track_id = '';
      next.audio_uploaded = false;
      return next;
    }) : current.tracks;
    return writeDraft({
      artist_id: current.artist_id || '',
      release_id: '',
      track_id: '',
      release_idempotency_key: '',
      track_idempotency_key: '',
      audio_uploaded: false,
      submitted: false,
      replaced_release_id: '',
      tracks: stored,
    });
  }

  var releaseKeyNonce = 0;
  function freshReleaseKey(draft) {
    releaseKeyNonce += 1;
    return ('plaiground-release-' + String((draft && draft.artist_id) || '') + ':' + String((draft && draft.title) || '') + ':' + String(Date.now()) + ':' + String(releaseKeyNonce)).slice(0, 255);
  }

  function clearDeadReleaseIds(draft) {
    var current = draft || readDraft();
    var deadId = String(current.release_id || '').trim();
    var stored = Array.isArray(current.tracks) ? current.tracks.map(function (track) {
      var next = {};
      Object.keys(track || {}).forEach(function (key) { next[key] = track[key]; });
      next.track_id = '';
      next.audio_uploaded = false;
      return next;
    }) : current.tracks;
    if (deadId) markDeadRelease(deadId);
    var artistId = String(current.artist_id || '').trim();
    if (!isUuidValue(artistId)) {
      artistId = catalogFromAccount(accountRecord()).artist_id || '';
    }
    var next = writeDraft({
      artist_id: artistId,
      release_id: '',
      track_id: '',
      release_idempotency_key: freshReleaseKey(Object.assign({}, current, { artist_id: artistId })),
      track_idempotency_key: '',
      audio_uploaded: false,
      audio_attached: Boolean(current.audio_attached || hadAudioEvidence(current)),
      replaced_release_id: deadId || current.replaced_release_id || '',
      tracks: stored,
    });
    sessionReleaseId = '';
    sessionReleaseChecked = '';
    sessionReleaseVerified = '';
    var rows = qsAll('[data-track-row]');
    var i;
    for (i = 0; i < rows.length; i += 1) {
      stampTrackRow(i, { track_id: '', audio_uploaded: false });
    }
    return next;
  }

  function asResolvedRelease(created) {
    if (!created) return { failed: true, result: { data: { error: 'Could not create release.' } } };
    if (created.unavailable || created.limited || created.failed || created.missing) return created;
    var draft = created.draft || readDraft();
    if (draft && draft.release_id) {
      rememberSessionRelease(draft.release_id);
      if (draft.replaced_release_id) draft = writeDraft({ replaced_release_id: '' });
      return Object.assign({ ok: true }, created, { draft: draft });
    }
    return {
      failed: true,
      result: created.result || { data: { error: 'Could not create release.' } },
      draft: draft,
    };
  }

  function ensureCatalogArtist(draft) {
    var current = draft || readDraft();
    var artistId = String(current.artist_id || '').trim();
    if (isUuidValue(artistId)) return Promise.resolve({ ok: true, draft: current });
    var catalog = catalogFromAccount(accountRecord());
    if (isUuidValue(catalog.artist_id)) {
      return Promise.resolve({ ok: true, draft: writeDraft({ artist_id: catalog.artist_id }) });
    }
    var name = String(current.name || '').trim();
    if (!name) {
      return Promise.resolve({
        failed: true,
        missing: true,
        draft: current,
        result: { data: { error: 'Artist name is required.' } },
      });
    }
    return post(ARTISTS_URL, {
      name: name,
      plaiground_artist_id: current.plaiground_artist_id || '',
    }).then(function (result) {
      if (isUnavailable(result)) return { unavailable: true, result: result, draft: current };
      if (isPlanLimit(result)) return { limited: true, result: result, draft: current };
      if (!result.ok) return { failed: true, result: result, draft: current };
      var id = pickUuid(result.data);
      if (!id) {
        return {
          failed: true,
          result: { data: { error: createErrorMessage(result, 'Could not save artist.') } },
          draft: current,
        };
      }
      var next = writeDraft({ artist_id: id });
      saveCatalog({ artist_id: id });
      return { ok: true, draft: next, created: true };
    });
  }

  function createFreshRelease(draft) {
    var current = draft || readDraft();
    if (!current.title) {
      return Promise.resolve({
        failed: true,
        missing: true,
        draft: current,
        result: { data: { error: 'Song title is required.' } },
      });
    }
    return ensureCatalogArtist(current).then(function (ready) {
      if (ready.unavailable || ready.limited || ready.failed || ready.missing) return ready;
      current = ready.draft || current;
      if (!current.artist_id) {
        return {
          failed: true,
          missing: true,
          draft: current,
          result: { data: { error: 'Save the upload details first so a catalog artist exists.' } },
        };
      }
      return createRelease(current, current.release_date || '').then(function (created) {
        var resolved = asResolvedRelease(created);
        if (resolved && (resolved.failed || resolved.missing)) resolved.createFreshFailed = true;
        return resolved;
      });
    });
  }

  function mintOrReuseAfterDead(current, skipId, loaded) {
    markDeadRelease(skipId);
    return findLivingSongRelease(current, skipId).then(function (living) {
      if (living && living.id) {
        var adopted = adoptLivingRelease(current, living);
        return { ok: true, draft: adopted, found: true, tracks: living.tracks || [], result: living.result };
      }
      if (releaseRecreateCount >= MAX_RELEASE_RECREATES) {
        return deadReleaseResult(loaded && loaded.result, clearDeadReleaseIds(current));
      }
      releaseRecreateCount += 1;
      return createFreshRelease(clearDeadReleaseIds(current)).then(function (created) {
        if (created && created.missing) return created;
        if (created && created.failed && !isReleaseMissing(created.result)) return created;
        if (created && (created.failed || created.missing) && isReleaseMissing(created.result)) {
          return deadReleaseResult(created.result, created.draft || readDraft());
        }
        return created;
      });
    });
  }

  function resolveLiveRelease(draft) {
    var current = draft || readDraft();
    var id = String(current.release_id || '').trim();
    if (id && isKnownDeadRelease(id)) {
      return findLivingSongRelease(current, id).then(function (living) {
        if (living && living.id) {
          return { ok: true, draft: adoptLivingRelease(current, living), found: true, tracks: living.tracks || [], result: living.result };
        }
        return createFreshRelease(String(current.release_id || '').trim() ? clearDeadReleaseIds(current) : current);
      });
    }
    if (id && sessionReleaseId && sameUuid(id, sessionReleaseId)) {
      return Promise.resolve({ ok: true, draft: current, reused: true, justCreated: true });
    }
    if (id && sessionReleaseChecked && sameUuid(id, sessionReleaseChecked)) {
      return Promise.resolve({ ok: true, draft: current, reused: true });
    }
    if (!id) {
      if (selectedAudio()) return createFreshRelease(current);
      return findLivingSongRelease(current, '').then(function (living) {
        if (living && living.id) {
          return { ok: true, draft: adoptLivingRelease(current, living), found: true, tracks: living.tracks || [], result: living.result };
        }
        return createFreshRelease(current);
      });
    }
    return fetchReleaseTracks(id).then(function (loaded) {
      if (loaded.ok) {
        rememberSessionRelease(id, true);
        return { ok: true, draft: current, found: true, tracks: loaded.tracks, result: loaded.result };
      }
      if (isUnavailable(loaded.result)) {
        return { unavailable: true, result: loaded.result, draft: current };
      }
      if (isPlanLimit(loaded.result)) {
        return { limited: true, result: loaded.result, draft: current };
      }
      if (!isReleaseMissing(loaded.result) && loaded.result && loaded.result.status >= 500) {
        return { failed: true, result: loaded.result, draft: current };
      }
      if (!isReleaseMissing(loaded.result) && loaded.result && loaded.result.status && loaded.result.status !== 404) {
        return { failed: true, result: loaded.result || { data: { error: 'Could not load release.' } }, draft: current };
      }
      return mintOrReuseAfterDead(current, id, loaded);
    });
  }

  function createMissingTracks(draft, opts) {
    var force = Boolean(opts && opts.force);
    var next = draft;
    var knownTracks = (opts && opts.tracks) || [];
    var liveFile = Boolean(selectedAudio()) || albumRowsForSubmit(next).some(function (track) {
      return track && (track.audio || track.file);
    });
    if (!liveFile && knownTracks.length) {
      return Promise.resolve({ ok: true, draft: persistFoundTracks(next, knownTracks), reused: true });
    }
    if ((draft && draft.type) === 'album') {
      var rows = albumRowsForSubmit(draft);
      if (!rows.length && draft.title) {
        rows = [{ title: draft.title, audio: selectedAudio(), track_id: force ? '' : draft.track_id, position: 1 }];
      }
      if (!rows.length) {
        return Promise.resolve({
          failed: true,
          draft: next,
          result: { data: { error: genuineEmptyMessage() } },
        });
      }
      var chain = Promise.resolve({ ok: true, draft: next });
      rows.forEach(function (track, index) {
        chain = chain.then(function (result) {
          if (!result.ok || result.failed || result.unavailable) return result;
          next = result.draft || next;
          return createTrack(next, {
            title: track.title || next.title,
            position: track.position || (index + 1),
            track_id: force ? '' : track.track_id,
            force: force,
          }).then(function (created) {
            if (created.unavailable) return created;
            var trackId = created.track_id || track.track_id;
            if (created.failed || created.missing || !trackId) {
              return {
                failed: true,
                result: created.result || { data: { error: 'Could not create the track.' } },
                draft: created.draft || next,
              };
            }
            next = created.draft || next;
            if (index === 0 && !next.track_id) next = writeDraft({ track_id: trackId });
            var stored = Array.isArray(next.tracks) ? next.tracks.slice() : [];
            stored[index] = Object.assign({}, stored[index] || {}, {
              title: track.title || (stored[index] && stored[index].title) || next.title,
              track_id: trackId,
              position: index + 1,
            });
            next = persistAlbumTracks(stored);
            var file = track.audio || track.file;
            if (file && trackId && !track.audio_uploaded) {
              return uploadTrackAudio(trackId, file).then(function (audio) {
                if (audio.failed || audio.unavailable) return audio;
                stored[index] = Object.assign({}, stored[index], { audio_uploaded: true, audio_name: file.name || '' });
                next = persistAlbumTracks(stored);
                return { ok: true, draft: next, created: true };
              });
            }
            return { ok: true, draft: next, created: true };
          });
        });
      });
      return chain;
    }
    return createTrack(next, { force: force, title: next && next.title }).then(function (created) {
      if (created.unavailable) return created;
      var trackId = created.track_id || (created.draft && created.draft.track_id);
      if (created.failed || created.missing || !trackId) {
        return {
          failed: true,
          result: created.result || { data: { error: 'Could not create the track.' } },
          draft: created.draft || next,
        };
      }
      next = created.draft || next;
      if (!next.track_id) next = writeDraft({ track_id: trackId });
      var file = selectedAudio();
      if (file && trackId) {
        return uploadTrackAudio(trackId, file).then(function (audio) {
          if (audio.failed || audio.unavailable) return audio;
          next = writeDraft({ audio_uploaded: true, audio_attached: true, audio_name: file.name || next.audio_name || '' });
          return { ok: true, draft: next, created: true };
        });
      }
      return { ok: true, draft: next, created: Boolean(created.created || created.skipped) };
    });
  }

  function resolveSubmitTracks(draft) {
    var current = draft || readDraft();
    var hasFile = Boolean(selectedAudio()) || albumRowsForSubmit(current).some(function (track) {
      return track && (track.audio || track.file);
    });
    var uploaded = current.audio_uploaded === true || albumRowsForSubmit(current).some(function (track) {
      return track && track.audio_uploaded;
    });
    var picked = pickedAudioEvidence(current);
    var titled = Boolean(current && String(current.title || '').trim());
    return resolveLiveRelease(current).then(function (resolved) {
      if (resolved.unavailable) return resolved;
      if (resolved.limited) return { failed: true, result: resolved.result, draft: resolved.draft || current };
      if (resolved.failed || resolved.missing) {
        return {
          failed: true,
          result: resolved.result || { data: { error: 'Save the upload details first so a catalog release exists.' } },
          draft: resolved.draft || current,
        };
      }
      var next = resolved.draft || current;
      if (!next.release_id) {
        return {
          failed: true,
          result: { data: { error: 'Save the upload details first so a catalog release exists.' } },
          draft: next,
        };
      }
      var hasId = draftHasTrackId(next);
      var storeTracks = (resolved.tracks && resolved.tracks.length) ? resolved.tracks : [];
      if ((resolved.found || storeTracks.length) && storeTracks.length) {
        return { ok: true, draft: persistFoundTracks(next, storeTracks) };
      }
      if (hasId || hasFile || uploaded || picked || titled || String(next.title || '').trim()) {
        return createMissingTracks(next, {
          force: Boolean(resolved.found || resolved.created),
          tracks: storeTracks,
        }).then(function (created) {
          if (created.ok) return created;
          if (created.unavailable) return created;
          if (hasId) return { ok: true, draft: created.draft || next };
          if (shouldReattach(created.draft || next, hasFile, storeTracks)) return reattachResult(created.draft || next);
          return {
            failed: true,
            result: created.result || { data: { error: genuineEmptyMessage() } },
            draft: created.draft || next,
          };
        });
      }
      if (shouldReattach(next, hasFile, storeTracks) && !hasId) return reattachResult(next);
      return { failed: true, result: { data: { error: genuineEmptyMessage() } }, draft: next };
    });
  }

  function applySubmitResult(draft, date, documentId, solo, result) {
    if (isUnavailable(result)) return { unavailable: true, result: result };
    if (result.data && result.data.code === 'SIGNWELL_TRIAL') return { trial: true, result: result };
    if (result.data && result.data.code === 'SIGNWELL_REQUIRED') return { unsigned: true, result: result };
    if (!result.ok) return { failed: true, result: result };
    var next = writeDraft({
      submitted: true,
      tonegrid_status: result.data.status || 'pending',
      signwell_status: result.data.signwell_status || (solo ? 'solo' : 'awaiting_signature'),
      signwell_signed: Boolean(result.data.signed),
      signwell_document_id: result.data.document_id || documentId || '',
      release_date: result.data.release_date || date,
    });
    return { submitted: true, draft: next, result: result };
  }

  function postSubmitRelease(draft, submitBody, date, documentId, solo) {
    return post(
      '/api/tonegrid/releases/' + encodeURIComponent(draft.release_id) + '/submit',
      submitBody,
      'plaiground-submit-' + draft.release_id
    ).then(function (result) {
      return applySubmitResult(draft, date, documentId, solo, result);
    });
  }

  function submitRelease(draft, releaseDate) {
    if (!draft || !draft.release_id) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Save the upload details first so a catalog release exists.' } } });
    }
    var solo = isSoloOwned(draft);
    var documentId = documentIdOf(draft);
    if (!solo && !documentId) {
      return Promise.resolve({
        unsigned: true,
        result: { data: { error: 'Create the split sheet before submitting.', code: 'SIGNWELL_REQUIRED' } },
      });
    }
    var date = releaseDate || draft.release_date || '';
    if (!String(date || '').trim()) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Release date is required.' } } });
    }
    var submitBody = {
      release_date: date,
      made_how: draft.made_how || '',
      human_elements: Array.isArray(draft.human_elements) ? draft.human_elements : [],
      human_contribution: draft.human_contribution || '',
      rights_confirmed: draft.rights_confirmed === true,
      solo_owned_100: solo,
      featured: draft.featured || '',
      title: draft.title || '',
      songTitle: draft.title || draft.songTitle || '',
    };
    if (Array.isArray(draft.dsps) && draft.dsps.length) submitBody.dsps = draft.dsps;
    if (!solo) {
      submitBody.document_id = documentId;
      if (Array.isArray(draft.writers)) submitBody.writers = draft.writers;
    }
    var ids = draftTrackIds(draft);
    if (ids.length) submitBody.track_id = ids[0];
    if (ids.length > 1) submitBody.track_ids = ids;
    return resolveSubmitTracks(draft).then(function (ready) {
      if (ready.recover) return { recover: true, result: ready.result, draft: ready.draft || draft };
      if (ready.failed) return { failed: true, result: ready.result, draft: ready.draft || draft };
      if (ready.unavailable) return { unavailable: true, result: ready.result, draft: ready.draft || draft };
      var next = ready.draft || draft;
      var nextIds = draftTrackIds(next);
      if (nextIds.length) submitBody.track_id = nextIds[0];
      if (nextIds.length > 1) submitBody.track_ids = nextIds;
      return postSubmitRelease(next, submitBody, date, documentId, solo).then(function (sent) {
        var liveFile = Boolean(selectedAudio()) || albumRowsForSubmit(next).some(function (track) {
          return track && (track.audio || track.file);
        });
        if (sent.failed && isMissingTrackError(sent.result) && !ready.created) {
          return createMissingTracks(next, { force: true }).then(function (created) {
            if (created.recover) return { recover: true, result: created.result, draft: created.draft || next };
            if (created.failed) {
              if (shouldReattach(created.draft || next, liveFile, [])) return reattachResult(created.draft || next);
              return { failed: true, result: created.result, draft: created.draft || next };
            }
            if (created.unavailable) return created;
            var createdIds = draftTrackIds(created.draft || next);
            if (createdIds.length) submitBody.track_id = createdIds[0];
            if (createdIds.length > 1) submitBody.track_ids = createdIds;
            return postSubmitRelease(created.draft || next, submitBody, date, documentId, solo).then(function (retried) {
              if (retried.failed && isMissingTrackError(retried.result) && shouldReattach(created.draft || next, liveFile, [])) {
                return reattachResult(created.draft || next);
              }
              return retried;
            });
          });
        }
        if (sent.failed && isMissingTrackError(sent.result) && shouldReattach(next, liveFile, [])) {
          return reattachResult(next);
        }
        return sent;
      });
    });
  }

  function saveCatalog(ids) {
    var body = {};
    if (ids && ids.artist_id) body.artist_id = ids.artist_id;
    if (ids && ids.release_id) body.release_id = ids.release_id;
    if (ids && ids.track_id) body.track_id = ids.track_id;
    if (!body.artist_id && !body.release_id && !body.track_id) return Promise.resolve();
    return fetch('/api/me/catalog', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (response) {
      if (response.status === 401 || response.status === 503) return null;
      return parseJson(response);
    }).catch(function () {
      return null;
    });
  }

  function go(href) {
    window.location.href = href;
  }

  function isUnavailable(result) {
    return Boolean(result && (result.status === 503 || (result.data && result.data.configured === false)));
  }

  function isPlanLimit(result) {
    if (!result || (result.status !== 403 && result.status !== 409)) return false;
    if (result.data && result.data.code === 'PLAN_LIMIT') return true;
    var msg = result.data && result.data.error ? String(result.data.error) : '';
    return /upgrade to (creator|pro)/i.test(msg);
  }

  function showUpgrade(show) {
    var el = $('tg-upgrade');
    if (el) el.hidden = !show;
  }

  function planLimitMessage(plan, kind) {
    if (kind === 'album') return 'Albums are on Creator and Pro. Upgrade to upload a multi-track release.';
    return plan === 'creator'
      ? 'Creator includes 8 releases per month. Upgrade to Pro to upload more.'
      : 'Basic includes one release. Upgrade to Creator or Pro to upload more.';
  }

  function albumAllowedFor(me) {
    var row = me || accountRecord() || {};
    if (row.upload && row.upload.album_allowed === true) return true;
    if (row.upload && row.upload.album_allowed === false) return false;
    var plan = String((row.upload && row.upload.plan) || row.plan || '').toLowerCase();
    return plan === 'creator' || plan === 'pro';
  }

  function accountPlanOf(me) {
    var row = me || accountRecord() || {};
    return String((row.upload && row.upload.plan) || row.plan || '').toLowerCase();
  }

  function albumTrackCap(me) {
    var plan = accountPlanOf(me);
    if (plan === 'pro') return Infinity;
    if (plan === 'creator') return 8;
    return 0;
  }

  function billingIntervalOf(me) {
    var row = me || accountRecord() || {};
    var billed = String(row.billing_interval || row.interval || (row.upload && row.upload.interval) || '').toLowerCase();
    if (billed === 'yearly' || billed === 'year') return 'year';
    return 'month';
  }

  var PRO_ALBUM_UPGRADE_COPY = 'Albums with 9 or more tracks are on Pro. Pro is $5 extra on monthly (Creator $14.99 → Pro $19.99). You pay the same-interval difference on your existing Stripe subscription — not a new $19.99 and not a second Checkout. Confirm the real amount due, then Submit.';

  function showCreatorAlbumUpgrade(me) {
    var interval = billingIntervalOf(me);
    var box = document.querySelector('[data-album-pro-upgrade]');
    setPanelHidden(box, false);
    var link = document.querySelector('[data-album-pro-confirm]');
    if (link && link.setAttribute) {
      link.setAttribute('href', 'plan-confirm.html?plan=pro&interval=' + encodeURIComponent(interval));
    }
    setStatus('tg-status', PRO_ALBUM_UPGRADE_COPY);
    markStatusError(true);
  }

  function hideCreatorAlbumUpgrade() {
    setPanelHidden(document.querySelector('[data-album-pro-upgrade]'), true);
  }

  function createErrorMessage(result, fallback) {
    var raw = result && result.data ? result.data.error : '';
    var shown = sanitizePartnerCopy(raw);
    if (shown) return shown;
    return sanitizePartnerCopy(fallback || '');
  }

  function releasePayload(draft, releaseDate) {
    var body = {
      artist_id: draft.artist_id,
      title: draft.title,
      type: draft.type || 'single',
      genre: draft.genre || '',
      price: draft.price || '',
      instrumental: draft.instrumental === true,
    };
    if (draft.release_id) body.release_id = draft.release_id;
    if (draft.replaced_release_id) body.replace_release_id = draft.replaced_release_id;
    if (!body.instrumental && draft.language) body.language = draft.language;
    if (releaseDate) body.release_date = releaseDate;
    return body;
  }

  function selectedAudio() {
    var input = document.querySelector('[data-audio-input]');
    if (input && input.files && input.files[0]) {
      rememberAudioFile(input.files[0]);
      return input.files[0];
    }
    if (input && input._plaigroundFile) {
      rememberAudioFile(input._plaigroundFile);
      return input._plaigroundFile;
    }
    return heldAudioFile || null;
  }

  function selectedArtwork() {
    var input = document.querySelector('[data-art-input]');
    if (input && input.files && input.files[0]) return input.files[0];
    if (input && input._plaigroundFile) return input._plaigroundFile;
    return null;
  }

  function queryTypeAlbum() {
    try {
      var search = (window.location && window.location.search) || '';
      if (typeof URLSearchParams === 'function') {
        return new URLSearchParams(search).get('type') === 'album';
      }
      return /(?:^\?|&)type=album(?:&|$)/i.test(String(search));
    } catch (err) {
      return false;
    }
  }

  function selectedReleaseType() {
    var draft = readDraft();
    if (draft && draft.type === 'album') return 'album';
    if (draft && draft.type === 'single') return 'single';
    if (queryTypeAlbum()) return 'album';
    var on = document.querySelector('[data-type].on');
    if (on && on.getAttribute('data-type') === 'album') return 'album';
    return 'single';
  }

  function setPanelHidden(el, hidden) {
    if (!el) return;
    el.hidden = Boolean(hidden);
    if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
  }

  function audioFileOf(input) {
    if (!input) return null;
    if (input.files && input.files[0]) return input.files[0];
    if (input._plaigroundFile) return input._plaigroundFile;
    return null;
  }

  function collectAlbumTracks() {
    var rows = qsAll('[data-track-row]');
    var saved = readDraft().tracks;
    var out = [];
    var i;
    for (i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var titleEl = row.querySelector('[data-track-title]');
      var input = row.querySelector('[data-audio-input]');
      var prior = (Array.isArray(saved) && saved[i]) || {};
      var trackId = row.getAttribute('data-track-id') || prior.track_id || '';
      var uploaded = row.getAttribute('data-audio-uploaded') === 'true' || prior.audio_uploaded === true;
      var lyricsEl = row.querySelector('[data-track-lyrics]');
      out.push({
        title: titleEl ? String(titleEl.value || '').trim() : '',
        lyrics: lyricsEl ? lyricsText(lyricsEl.value) : lyricsText(prior.lyrics),
        audio: audioFileOf(input),
        file: audioFileOf(input),
        track_id: trackId,
        audio_uploaded: uploaded,
        position: i + 1,
      });
    }
    return out;
  }

  function stampTrackRow(index, patch) {
    var rows = qsAll('[data-track-row]');
    var row = rows[index];
    if (!row || !row.setAttribute) return;
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'track_id')) {
      row.setAttribute('data-track-id', patch.track_id || '');
    }
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'audio_uploaded')) {
      row.setAttribute('data-audio-uploaded', patch.audio_uploaded ? 'true' : 'false');
    }
  }

  function persistAlbumTracks(tracks) {
    var stored = (tracks || []).map(function (track, i) {
      return {
        title: String((track && track.title) || '').trim(),
        lyrics: lyricsText(track && track.lyrics),
        track_id: (track && track.track_id) || '',
        audio_uploaded: Boolean(track && track.audio_uploaded),
        audio_name: track && track.audio && track.audio.name ? track.audio.name : ((track && track.audio_name) || ''),
        position: i + 1,
      };
    });
    return writeDraft({ tracks: stored, type: 'album', album_count: stored.length });
  }

  function isArtFile(file) {
    if (!file) return false;
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    return /\.(jpe?g|png)$/.test(name) || /image\/(jpeg|jpg|png)/.test(type);
  }

  function selectedExplicit() {
    var on = document.querySelector('[data-explicit].on, [data-explicit-toggle] .on');
    if (on && on.getAttribute('data-explicit') === 'true') return true;
    var draft = readDraft();
    return draft.explicit === true;
  }

  var AUDIO_ERROR = 'Audio must be WAV, FLAC, or MP3.';

  function audioAccept() {
    return typeof PlaigroundAudioAccept !== 'undefined' ? PlaigroundAudioAccept : null;
  }

  function isAudioFile(file) {
    if (!file) return false;
    var helper = audioAccept();
    if (helper && typeof helper.fileLooksAllowedSync === 'function') {
      return helper.fileLooksAllowedSync(file);
    }
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    return /\.(wav|flac|mp3|mpeg|mpga)$/.test(name) || /audio\/(wav|x-wav|wave|flac|x-flac|mpeg|mp3|x-mpeg|x-mp3|mpeg3|mpg)/.test(type);
  }

  function fileLooksAllowed(file) {
    if (isAudioFile(file)) return Promise.resolve(true);
    var helper = audioAccept();
    if (helper && typeof helper.fileLooksAllowed === 'function') return helper.fileLooksAllowed(file);
    return Promise.resolve(false);
  }

  function trackKey(draft, position) {
    var pos = position || 1;
    if (pos === 1 && draft.track_idempotency_key) return draft.track_idempotency_key;
    return ('plaiground-track-' + String(draft.release_id || '') + ':' + pos).slice(0, 255);
  }

  function createTrack(draft, trackInfo) {
    var info = trackInfo || {};
    var title = info.title || draft.title;
    var position = info.position || 1;
    var force = info.force === true;
    var existingId = force ? '' : (info.track_id || (position === 1 ? draft.track_id : ''));
    if (existingId) {
      return Promise.resolve({ skipped: true, draft: draft, track_id: existingId });
    }
    if (!draft.release_id || !title) {
      return Promise.resolve({
        failed: true,
        missing: true,
        draft: draft,
        result: { data: { error: 'Could not create the track. Missing release or title.' } },
      });
    }
    var key = trackKey(draft, position);
    if (position === 1 && !draft.track_idempotency_key) writeDraft({ track_idempotency_key: key });
    var trackBody = {
      release_id: draft.release_id,
      title: title,
      position: position,
      explicit: draft.explicit === true,
      instrumental: draft.instrumental === true,
    };
    if (existingId) trackBody.track_id = existingId;
    if (!trackBody.instrumental && draft.language) trackBody.language = draft.language;
    return post(TRACKS_URL, trackBody, key).then(function (result) {
      if (isUnavailable(result)) {
        return { unavailable: true, result: result, draft: draft };
      }
      if (
        !result.ok
        && isReleaseMissing(result)
        && info.retriedRelease !== true
        && !(draft.release_id && sessionReleaseVerified && sameUuid(draft.release_id, sessionReleaseVerified))
      ) {
        return resolveLiveRelease(clearDeadReleaseIds(draft)).then(function (resolved) {
          if (resolved.unavailable) return resolved;
          if (resolved.limited || resolved.failed || resolved.missing) {
            return {
              failed: true,
              result: resolved.result || result,
              draft: resolved.draft || draft,
            };
          }
          return createTrack(resolved.draft || readDraft(), Object.assign({}, info, {
            retriedRelease: true,
            track_id: '',
            force: true,
          }));
        });
      }
      if (!result.ok) {
        return {
          failed: true,
          result: result,
          draft: draft,
        };
      }
      var trackId = pickUuid(result.data);
      var next = draft;
      if (trackId && position === 1) next = writeDraft({ track_id: trackId });
      if (next.artist_id || next.release_id || trackId) {
        saveCatalog({ artist_id: next.artist_id, release_id: next.release_id, track_id: trackId });
      }
      if (!trackId) {
        return { failed: true, result: result, draft: next, track_id: '' };
      }
      return { created: true, draft: next, result: result, track_id: trackId };
    });
  }

  function isMp3File(file) {
    if (!file) return false;
    var helper = audioAccept();
    if (helper && typeof helper.fileLooksLikeMp3 === 'function') {
      return helper.fileLooksLikeMp3(file);
    }
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    return /\.(mp3|mpeg|mpga)$/.test(name) || /audio\/(x-)?(mpeg|mp3|mpeg3|mpg)/.test(type);
  }

  function showUploadLoader(step, percent, hint) {
    var loader = document.querySelector('[data-upload-loader]');
    var stepEl = document.querySelector('[data-upload-loader-step]');
    var fill = document.querySelector('[data-upload-loader-fill]');
    var meta = document.querySelector('[data-upload-loader-meta]');
    if (loader) {
      loader.hidden = false;
      if (loader.classList && loader.classList.remove) loader.classList.remove('is-hidden');
    }
    if (stepEl) stepEl.textContent = step || '';
    var hasPercent = typeof percent === 'number' && !isNaN(percent) && percent >= 0;
    if (loader && loader.classList) {
      if (loader.classList.toggle) loader.classList.toggle('is-wait', !hasPercent);
      else if (!hasPercent && loader.classList.add) loader.classList.add('is-wait');
      else if (hasPercent && loader.classList.remove) loader.classList.remove('is-wait');
    }
    if (fill && fill.style) fill.style.width = hasPercent ? Math.max(0, Math.min(100, percent)) + '%' : '32%';
    if (meta) {
      if (hint) meta.textContent = hint;
      else meta.textContent = hasPercent ? Math.round(percent) + '%' : '';
    }
  }

  function hideUploadLoader() {
    var loader = document.querySelector('[data-upload-loader]');
    if (!loader) return;
    loader.hidden = true;
    if (loader.classList && loader.classList.add) loader.classList.add('is-hidden');
  }

  function sanitizeResultError(result) {
    if (result && result.data && result.data.error) {
      result.data.error = sanitizePartnerCopy(result.data.error);
    }
    return result;
  }

  function postForm(url, body, onProgress) {
    if (typeof XMLHttpRequest === 'function') {
      return new Promise(function (resolve) {
        var settled = false;
        function done(result) {
          if (settled) return;
          settled = true;
          resolve(sanitizeResultError(result));
        }
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.withCredentials = true;
        xhr.timeout = catalogTimeoutMs();
        xhr.setRequestHeader('Accept', 'application/json');
        if (xhr.upload && typeof onProgress === 'function') {
          xhr.upload.onprogress = function (event) {
            if (event && event.lengthComputable && event.total) {
              onProgress(Math.round((event.loaded / event.total) * 100));
            }
          };
        }
        var timer = setTimeout(function () {
          try { xhr.abort(); } catch (err) {}
          done({ ok: false, status: 0, timedOut: true, data: { error: catalogTimeoutMessage() } });
        }, catalogTimeoutMs() + 250);
        xhr.onerror = function () {
          clearTimeout(timer);
          done({ ok: false, status: 0, data: { error: catalogTimeoutMessage() } });
        };
        xhr.ontimeout = function () {
          clearTimeout(timer);
          done({ ok: false, status: 0, timedOut: true, data: { error: catalogTimeoutMessage() } });
        };
        xhr.onload = function () {
          clearTimeout(timer);
          var data = {};
          try { data = JSON.parse(xhr.responseText || '{}') || {}; } catch (err) { data = {}; }
          done({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data: data });
        };
        xhr.send(body);
      });
    }
    return withCatalogTimeout(function () {
      return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        body: body,
      }).then(parseJson);
    }).then(sanitizeResultError);
  }

  function storeUnreachableResult() {
    return { ok: false, status: 0, timedOut: true, data: { error: catalogTimeoutMessage() } };
  }

  function uploadAudio(trackId, file, onProgress) {
    if (!trackId || !file) return Promise.resolve({ skipped: true });
    if (file.size > MAX_AUDIO_BYTES) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Audio must be 200 MB or smaller.' } } });
    }
    return fileLooksAllowed(file).then(function (ok) {
      if (!ok) {
        return { failed: true, result: { data: { error: AUDIO_ERROR } } };
      }
      function postOnce() {
        var body = new FormData();
        body.append('audio', file, file.name || 'audio.wav');
        return postForm(TRACKS_URL + '/' + encodeURIComponent(trackId) + '/audio', body, onProgress);
      }
      function interpret(result, err) {
        if (result && result.ok) return { uploaded: true, result: result };
        if (isUnavailable(result)) return { unavailable: true, result: result };
        if (isNoStoreResponse(result, err)) {
          return { failed: true, timedOut: true, result: storeUnreachableResult() };
        }
        return { failed: true, result: sanitizeResultError(result || { ok: false, data: { error: catalogTimeoutMessage() } }) };
      }
      return postOnce().then(function (result) {
        if (result && result.ok) return { uploaded: true, result: result };
        if (isUnavailable(result)) return { unavailable: true, result: result };
        if (isNoStoreResponse(result)) {
          return postOnce().then(function (retry) {
            return interpret(retry);
          }).catch(function (retryErr) {
            return interpret(null, retryErr);
          });
        }
        return interpret(result);
      }).catch(function (err) {
        if (isNoStoreResponse(null, err)) {
          return postOnce().then(function (retry) {
            return interpret(retry);
          }).catch(function (retryErr) {
            return interpret(null, retryErr);
          });
        }
        return interpret(null, err);
      });
    });
  }

  function uploadArtwork(releaseId, file, onProgress) {
    if (!releaseId || !file) return Promise.resolve({ skipped: true });
    if (file.size > MAX_ARTWORK_BYTES) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Artwork must be 15 MB or smaller.' } } });
    }
    if (!isArtFile(file)) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Artwork must be JPG or PNG.' } } });
    }
    var body = new FormData();
    body.append('artwork', file, file.name || 'artwork.jpg');
    return postForm(RELEASES_URL + '/' + encodeURIComponent(releaseId) + '/artwork', body, onProgress).then(function (result) {
      if (isUnavailable(result)) return { unavailable: true, result: result };
      if (!result.ok) return { failed: true, result: result };
      return { uploaded: true, result: result };
    });
  }

  var CONVERT_HINT = 'This can take a minute.';

  function convertProgressCopy(file, kind) {
    var helper = audioAccept();
    if (helper && typeof helper.convertProgressCopy === 'function') {
      return helper.convertProgressCopy(file, kind);
    }
    var name = String((file && file.name) || '');
    if (/\.wav$/i.test(name) || /\.flac$/i.test(name)) return '';
    if (kind === 'wav' || kind === 'flac') return '';
    if (kind === 'mp3' || isMp3File(file)) return 'Converting MP3 to WAV';
    if (kind) return 'Converting to WAV';
    return '';
  }

  function resolveConvertCopy(file) {
    var sync = convertProgressCopy(file);
    if (sync) return Promise.resolve(sync);
    var helper = audioAccept();
    if (helper && (helper.fileLooksLikeWav && helper.fileLooksLikeWav(file)
      || helper.fileLooksLikeFlac && helper.fileLooksLikeFlac(file))) {
      return Promise.resolve('');
    }
    if (helper && typeof helper.sniffKind === 'function') {
      return helper.sniffKind(file).then(function (kind) {
        return convertProgressCopy(file, kind);
      });
    }
    return Promise.resolve('');
  }

  function showConvertLoader(copy) {
    showUploadLoader(copy, null, CONVERT_HINT);
    setStatus('tg-status', copy + '. ' + CONVERT_HINT);
  }

  function convertHook() {
    try {
      if (typeof PlaigroundConvertUploadAudio === 'function') return PlaigroundConvertUploadAudio;
    } catch (err) {}
    if (typeof window !== 'undefined' && window && typeof window.PlaigroundConvertUploadAudio === 'function') {
      return window.PlaigroundConvertUploadAudio;
    }
    return null;
  }

  function runConvertStep(file) {
    return resolveConvertCopy(file).then(function (copy) {
      if (!copy) return { file: file, didConvert: false, copy: '' };
      showConvertLoader(copy);
      var hook = convertHook();
      if (!hook) return { file: file, didConvert: false, copy: copy };
      return Promise.resolve(hook(file)).then(function (next) {
        var ready = next;
        if (ready && typeof ready === 'object' && ready.file) ready = ready.file;
        if (ready && typeof ready.name === 'string' && (ready.size != null || typeof ready.slice === 'function')) {
          return { file: ready, didConvert: true, copy: copy };
        }
        return { file: file, didConvert: true, copy: copy };
      }).catch(function () {
        return { file: file, didConvert: false, copy: copy };
      });
    });
  }

  function uploadTrackAudio(trackId, file, label) {
    if (!trackId || !file) return Promise.resolve({ skipped: true });
    var sendLabel = label || 'Uploading audio';
    return runConvertStep(file).then(function (ready) {
      var convertLabel = ready.copy;
      var keepConvert = Boolean(convertLabel && !ready.didConvert);
      if (keepConvert) {
        showConvertLoader(convertLabel);
      } else {
        showUploadLoader(sendLabel);
        setStatus('tg-status', sendLabel + '…');
      }
      return uploadAudio(trackId, ready.file, function (percent) {
        if (keepConvert) {
          showConvertLoader(convertLabel);
          return;
        }
        showUploadLoader(sendLabel, percent);
      });
    });
  }

  function albumTrackError(index, total, source) {
    var prefix = 'Track ' + (index + 1) + ' of ' + total;
    var detail = '';
    if (source && source.result && source.result.data && source.result.data.error) {
      detail = sanitizePartnerCopy(source.result.data.error);
    } else if (source && source.message) {
      detail = sanitizePartnerCopy(source.message);
    } else {
      detail = 'The store did not create the track.';
    }
    if (/^Track \d+ of \d+/.test(detail)) return detail;
    return prefix + ' failed. ' + detail;
  }

  function failAlbumTrack(index, total, created, draft) {
    var result = created || {};
    result.failed = true;
    result.ok = false;
    result.draft = (created && created.draft) || draft;
    result.result = (created && created.result) || { data: {} };
    if (!result.result.data) result.result.data = {};
    result.result.data.error = albumTrackError(index, total, created);
    return result;
  }

  function afterAlbumRelease(draft) {
    var tracks = collectAlbumTracks();
    persistAlbumTracks(tracks);
    var next = draft;
    var chain = Promise.resolve({ ok: true, draft: next });
    tracks.forEach(function (track, index) {
      chain = chain.then(function (result) {
        if (!result.ok || result.failed || result.unavailable) return result;
        next = result.draft || next;
        var label = 'Creating track ' + (index + 1) + ' of ' + tracks.length;
        showUploadLoader(label);
        setStatus('tg-status', label + '…');
        return createTrack(next, {
          title: track.title,
          position: index + 1,
          track_id: track.track_id,
        }).then(function (created) {
          if (created.unavailable) return created;
          if (created.failed || created.missing) return failAlbumTrack(index, tracks.length, created, next);
          next = created.draft || next;
          var trackId = created.track_id || track.track_id;
          if (!trackId) return failAlbumTrack(index, tracks.length, created, next);
          tracks[index].track_id = trackId;
          stampTrackRow(index, { track_id: trackId });
          persistAlbumTracks(tracks);
          if (track.audio_uploaded || !track.audio) {
            return { ok: true, draft: next };
          }
          return uploadTrackAudio(trackId, track.audio, 'Uploading audio ' + (index + 1) + ' of ' + tracks.length).then(function (audio) {
            if (audio.failed || audio.unavailable) {
              if (audio.failed) {
                audio.result = audio.result || { data: {} };
                if (!audio.result.data) audio.result.data = {};
                audio.result.data.error = albumTrackError(index, tracks.length, audio);
              }
              return audio;
            }
            tracks[index].audio_uploaded = true;
            stampTrackRow(index, { audio_uploaded: true });
            persistAlbumTracks(tracks);
            return { ok: true, draft: next, audio: audio };
          });
        }).catch(function (err) {
          return failAlbumTrack(index, tracks.length, err, next);
        });
      });
    });
    return chain.then(function (result) {
      if (!result.ok || result.failed || result.unavailable) return result;
      next = result.draft || next;
      var art = selectedArtwork();
      if (!art || !next.release_id) return result;
      showUploadLoader('Uploading artwork');
      setStatus('tg-status', 'Uploading artwork…');
      return uploadArtwork(next.release_id, art, function (percent) {
        showUploadLoader('Uploading artwork', percent);
      }).then(function (artwork) {
        result.artwork = artwork;
        result.ok = !artwork.failed && !artwork.unavailable;
        return result;
      });
    });
  }

  function afterRelease(draft) {
    return resolveLiveRelease(draft).then(function (resolved) {
      if (resolved.unavailable || resolved.limited || resolved.failed || resolved.missing) return resolved;
      var ready = resolved.draft || draft;
      if (ready.type === 'album') return afterAlbumRelease(ready);
      return createTrackOnRelease(ready);
    });
  }

  function createTrackOnRelease(draft) {
    return createTrack(draft).then(function (track) {
      var next = track.draft || draft;
      if (track.unavailable || track.failed) return track;
      if (!track.track_id && !next.track_id) {
        return {
          failed: true,
          draft: next,
          result: (track && track.result) || { data: { error: 'Could not create the track.' } },
        };
      }
      var file = selectedAudio();
      var art = selectedArtwork();
      if (file && file.name) next = writeDraft({ audio_name: file.name });
      if (next.track_id && (next.audio_uploaded || !file)) {
        next = writeDraft({ audio_uploaded: Boolean(next.audio_uploaded || next.track_id) });
      }
      var chain = Promise.resolve({ ok: true, draft: next, track: track });
      if (file && next.track_id) {
        chain = uploadTrackAudio(next.track_id, file).then(function (audio) {
          if (!audio.failed && !audio.unavailable) {
            next = writeDraft({ audio_uploaded: true, audio_attached: true, audio_name: file.name || next.audio_name || '' });
          }
          return { ok: !audio.failed && !audio.unavailable, draft: next, track: track, audio: audio };
        });
      }
      return chain.then(function (result) {
        if (!result.ok || result.failed || result.unavailable) return result;
        if (!art || !next.release_id) return result;
        showUploadLoader('Uploading artwork');
        setStatus('tg-status', 'Uploading artwork…');
        return uploadArtwork(next.release_id, art, function (percent) {
          showUploadLoader('Uploading artwork', percent);
        }).then(function (artwork) {
          result.artwork = artwork;
          result.ok = !artwork.failed && !artwork.unavailable;
          return result;
        });
      });
    });
  }

  function releaseKey(draft) {
    if (draft.release_idempotency_key) return draft.release_idempotency_key;
    return ('plaiground-release-' + String(draft.artist_id || '') + ':' + String(draft.title || '')).slice(0, 255);
  }

  function createRelease(draft, releaseDate, opts) {
    if (draft.release_id) {
      rememberSessionRelease(draft.release_id);
      return Promise.resolve({ skipped: true, draft: draft });
    }
    if (!draft.artist_id || !draft.title) {
      return Promise.resolve({ skipped: true, missing: true, draft: draft });
    }
    var key = releaseKey(draft);
    if (!draft.release_idempotency_key) writeDraft({ release_idempotency_key: key });
    return post(RELEASES_URL, releasePayload(draft, releaseDate), key).then(function (result) {
      if (isUnavailable(result)) {
        return { unavailable: true, result: result, draft: draft };
      }
      if (isPlanLimit(result)) {
        return { limited: true, result: result, draft: draft };
      }
      if (!result.ok) {
        return { failed: true, result: result, draft: draft };
      }
      var releaseId = pickUuid(result.data);
      if (releaseId && draft.replaced_release_id && sameUuid(releaseId, draft.replaced_release_id)) {
        if (opts && opts.retriedDead) {
          return {
            failed: true,
            result: { data: { error: DEAD_RELEASE_COPY } },
            draft: draft,
          };
        }
        var retryDraft = writeDraft({
          release_id: '',
          release_idempotency_key: freshReleaseKey(draft),
        });
        return createRelease(retryDraft, releaseDate, { retriedDead: true });
      }
      var next = draft;
      if (releaseId) {
        next = writeDraft({
          release_id: releaseId,
          release_date: releaseDate || draft.release_date || '',
          replaced_release_id: '',
        });
        rememberSessionRelease(releaseId);
      }
      if (releaseId || draft.artist_id) {
        saveCatalog({ artist_id: draft.artist_id, release_id: releaseId });
      }
      return { created: true, draft: next, result: result };
    });
  }

  function continueAfterCatalog(nextHref, message) {
    if (message) setStatus('tg-status', message);
    go(nextHref);
  }

  function selectedInstrumental() {
    var el = $('tg-instrumental') || document.querySelector('[data-instrumental]');
    return Boolean(el && (el.checked === true || el.getAttribute && el.getAttribute('checked') === 'true'));
  }

  function syncLanguageField(instrumental) {
    var field = document.querySelector('[data-language-field]');
    if (!field) return;
    field.hidden = Boolean(instrumental);
    if (field.classList && field.classList.toggle) field.classList.toggle('is-hidden', Boolean(instrumental));
  }

  function lyricsText(value) {
    return String(value == null ? '' : value);
  }

  function selectedLyrics() {
    if (selectedInstrumental()) return '';
    var el = $('tg-lyrics') || document.querySelector('[data-lyrics]');
    if (el) return lyricsText(el.value);
    return '';
  }

  function setHiddenEl(el, hidden) {
    if (!el) return;
    el.hidden = Boolean(hidden);
    if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
  }

  function openLyricsField() {
    if (selectedInstrumental()) return false;
    var field = document.querySelector('[data-lyrics-field]');
    var open = document.querySelector('[data-lyrics-open]');
    if (!field) return false;
    setHiddenEl(field, false);
    if (open && open.setAttribute) open.setAttribute('aria-expanded', 'true');
    var el = $('tg-lyrics');
    if (el && typeof el.focus === 'function') el.focus();
    return true;
  }

  function syncLyricsField(instrumental) {
    var on = Boolean(instrumental);
    var open = document.querySelector('[data-lyrics-open]');
    var field = document.querySelector('[data-lyrics-field]');
    var wraps = qsAll('[data-track-lyrics-wrap]');
    var i;
    setHiddenEl(open, on);
    if (on) {
      setHiddenEl(field, true);
      if (open && open.setAttribute) open.setAttribute('aria-expanded', 'false');
    }
    for (i = 0; i < wraps.length; i += 1) {
      setHiddenEl(wraps[i], on);
    }
  }

  function artistCheckApi() {
    return (typeof PlaigroundArtistCheck !== 'undefined' && PlaigroundArtistCheck) || null;
  }

  function isLeftoverArtistName(name) {
    var next = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!next) return false;
    if (
      next === 'john'
      || next === 'john ham'
      || next === 'john doe'
      || next === 'john harper'
      || next === 'patrick'
      || next === 'neon shadows'
      || next === 'neon sermon'
      || next === 'neon santos'
      || next === 'victoria reyes'
      || next === 'victoria void'
    ) return true;
    var first = next.split(' ')[0];
    return first === 'john' || first === 'patrick';
  }

  function rosterFromMe(me) {
    var row = me || accountRecord() || {};
    var artists = row.profile && Array.isArray(row.profile.artists) ? row.profile.artists.slice() : [];
    artists = artists.filter(function (artist) {
      return artist && artist.name && !isLeftoverArtistName(artist.name);
    }).map(function (artist) {
      var id = String((artist && (artist.id || artist.artist_id)) || '').trim();
      return Object.assign({}, artist, { id: id || artist.name });
    });
    if (!artists.length && row.artist && !isLeftoverArtistName(row.artist)) {
      artists.push({
        id: 'account',
        name: row.artist,
        source: 'created',
        badge: 'PLAIGROUND',
        tonegrid_artist_id: row.tonegrid_artist_id || '',
        name_check: 'green',
      });
    }
    return artists;
  }

  function selectedArtistOption() {
    var sel = $('tg-artist-select');
    if (!sel) return null;
    var opt = null;
    if (sel.options && sel.selectedIndex >= 0) opt = sel.options[sel.selectedIndex];
    var id = String((opt && opt.value) || sel.value || '').trim();
    if (!id) return null;
    var name = String((opt && (opt.getAttribute && opt.getAttribute('data-name') || opt.textContent)) || '').trim();
    return { id: id, name: name };
  }

  function syncArtistHidden() {
    var hidden = $('tg-artist');
    if (!hidden) return fieldValue('tg-artist');
    var mode = fieldValue('tg-artist-mode') || 'choose';
    var name = '';
    if (mode === 'create') name = fieldValue('tg-artist-new');
    else if (mode === 'link') name = fieldValue('tg-artist-link-name');
    else {
      var picked = selectedArtistOption();
      name = picked ? picked.name : fieldValue('tg-artist');
    }
    if (name) hidden.value = name;
    return hidden.value;
  }

  function collectUploadFields() {
    var instrumental = selectedInstrumental();
    var language = catalogLanguageValue();
    if (instrumental) language = '';
    var type = selectedReleaseType();
    var draft = readDraft();
    var tracks = type === 'album' ? collectAlbumTracks() : [];
    var audio = type === 'album' ? (tracks[0] && tracks[0].audio) : selectedAudio();
    var art = selectedArtwork();
    var first = tracks[0] || {};
    return {
      audio: audio,
      artwork: art,
      artwork_name: (art && art.name) || draft.artwork_name || '',
      title: fieldValue('tg-title') || draft.title || '',
      name: syncArtistHidden() || fieldValue('tg-artist') || draft.name || '',
      featured: fieldValue('tg-featured') || draft.featured || '',
      genre: catalogFieldValue('tg-genre') || draft.genre || '',
      language: language || draft.language || '',
      price: fieldValue('tg-price') || draft.price || '',
      explicit: selectedExplicit(),
      instrumental: instrumental,
      lyrics: instrumental ? '' : (selectedLyrics() || draft.lyrics || ''),
      dsps: selectedUploadStores(),
      type: type,
      tracks: tracks,
      track_id: type === 'album' ? (first.track_id || '') : (draft.track_id || ''),
      audio_uploaded: type === 'album'
        ? Boolean(first.audio_uploaded)
        : (draft.audio_uploaded === true || Boolean(draft.track_id)),
      audio_name: type === 'album'
        ? (first.audio_name || '')
        : ((audio && audio.name) || draft.audio_name || ''),
      release_id: draft.release_id || '',
    };
  }

  function storePickRoot() {
    return document.querySelector('[data-store-pick]');
  }

  function selectedUploadStores() {
    var root = storePickRoot();
    if (root && typeof PlaigroundStorePick !== 'undefined' && PlaigroundStorePick.selected) {
      return PlaigroundStorePick.selected(root);
    }
    var draft = readDraft();
    return Array.isArray(draft.dsps) ? draft.dsps.slice() : [];
  }

  function persistStorePick(slugs, allOn, total) {
    var patch = { dsps: slugs || [], dsps_all: allOn !== false };
    var n = Number(total);
    if (n > 0) patch.dsps_total = n;
    writeDraft(patch);
  }

  function storePickSnapshot() {
    var root = storePickRoot();
    var draft = readDraft();
    var slugs = selectedUploadStores();
    var allBox = root && root.querySelector ? root.querySelector('[data-store-all]') : null;
    var list = root && root.querySelector
      ? (root.querySelector('[data-store-list]') || root.querySelector('[data-edit-stores]'))
      : null;
    var boxes = list && list.querySelectorAll ? list.querySelectorAll('input[type="checkbox"]') : [];
    var listTotal = boxes && boxes.length ? boxes.length : 0;
    var total = listTotal || Number(draft.dsps_total) || 0;
    var allOn = allBox ? Boolean(allBox.checked) : draft.dsps_all !== false;
    if (total > 0 && slugs.length >= total) allOn = true;
    return { slugs: slugs, allOn: allOn, total: total };
  }

  function bindStorePick(root, selected) {
    if (!root || typeof PlaigroundStorePick === 'undefined') return;
    var draft = readDraft();
    var picked = Array.isArray(selected) ? selected : (Array.isArray(draft.dsps) ? draft.dsps : null);
    function apply(stores) {
      var catalog = Array.isArray(stores) ? stores : [];
      PlaigroundStorePick.bind(root, {
        stores: catalog,
        selected: picked && picked.length ? picked : null,
        onChange: function (slugs, allOn, total) {
          persistStorePick(slugs, allOn, total || catalog.length);
        },
      });
    }
    var fallback = PlaigroundStorePick.DEFAULT_STORES || [];
    getJson('/api/tonegrid/stores').then(function (result) {
      var live = result.ok && result.data && result.data.stores;
      apply(live && live.length ? live : fallback);
    }).catch(function () {
      apply(fallback);
    });
  }

  function uploadPageError(fields) {
    var gate = rules();
    if (gate && typeof gate.validateUploadPage === 'function') {
      var checked = gate.validateUploadPage(fields);
      return checked && checked.error ? checked.error : '';
    }
    if (!fields.audio && !fields.track_id && !fields.audio_uploaded) return 'Audio is required.';
    if (!fields.artwork && !fields.artwork_name) return 'Artwork is required.';
    if (!fields.name) return 'Primary artist is required.';
    if (!fields.title) return 'Song title is required.';
    if (!fields.genre) return 'Genre is required.';
    if (!fields.instrumental && !fields.language) return 'Language is required.';
    if (!fields.price) return 'Download price is required.';
    return '';
  }

  function markIncomplete(el, incomplete) {
    if (!el) return;
    if (el.classList && el.classList.toggle) el.classList.toggle('is-incomplete', Boolean(incomplete));
  }

  function sameUuid(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase() && Boolean(String(a || '').trim());
  }

  function isUuidValue(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
  }

  function membershipApi() {
    return (typeof PlaigroundMembership !== 'undefined' && PlaigroundMembership) || null;
  }

  function whenAccountReady() {
    var api = membershipApi();
    if (api && typeof api.whenReady === 'function') return api.whenReady();
    return Promise.resolve(null);
  }

  function accountRecord() {
    var api = membershipApi();
    if (api && typeof api.account === 'function') return api.account();
    return null;
  }

  function catalogFromAccount(me) {
    var row = me || accountRecord() || {};
    var releases = Array.isArray(row.tonegrid_release_ids) ? row.tonegrid_release_ids.filter(isUuidValue) : [];
    var tracks = Array.isArray(row.tonegrid_track_ids) ? row.tonegrid_track_ids.filter(isUuidValue) : [];
    return {
      artist_id: isUuidValue(row.tonegrid_artist_id) ? row.tonegrid_artist_id : '',
      release_ids: releases,
      track_ids: tracks,
      allowed: row.upload ? row.upload.allowed !== false : true,
      plan: String(row.plan || '').toLowerCase(),
    };
  }

  function mergeCatalogIds(draft, me) {
    var catalog = catalogFromAccount(me);
    var artistId = isUuidValue(draft.artist_id) ? draft.artist_id : '';
    var releaseId = isUuidValue(draft.release_id) ? draft.release_id : '';
    var trackId = isUuidValue(draft.track_id) ? draft.track_id : '';
    var patch = {};
    var onlyRelease = catalog.release_ids.length === 1 ? catalog.release_ids[0] : '';
    var onlyTrack = catalog.track_ids.length === 1 ? catalog.track_ids[0] : '';
    if (String(draft.type || '') === 'album') {
      if (!artistId && catalog.artist_id) return writeDraft({ artist_id: catalog.artist_id });
      return draft;
    }
    var titled = Boolean(String(draft.title || '').trim());
    if (releaseId) {
      if (!artistId && catalog.artist_id) patch.artist_id = catalog.artist_id;
      if (!trackId && onlyTrack) patch.track_id = onlyTrack;
      return Object.keys(patch).length ? writeDraft(patch) : draft;
    }
    if (artistId && onlyRelease && !titled && (!catalog.artist_id || sameUuid(artistId, catalog.artist_id))) {
      patch.release_id = onlyRelease;
      if (!trackId && onlyTrack) patch.track_id = onlyTrack;
      return writeDraft(patch);
    }
    if (!artistId && !releaseId && (catalog.artist_id || onlyRelease)) {
      if (catalog.artist_id) patch.artist_id = catalog.artist_id;
      if (onlyRelease && !titled) patch.release_id = onlyRelease;
      if (onlyTrack && !titled) patch.track_id = onlyTrack;
      return Object.keys(patch).length ? writeDraft(patch) : draft;
    }
    return draft;
  }

  function markStatusError(on) {
    var el = $('tg-status');
    if (!el || !el.classList) return;
    if (el.classList.toggle) el.classList.toggle('upload-status-error', Boolean(on));
    else if (on && el.classList.add) el.classList.add('upload-status-error');
    else if (!on && el.classList.remove) el.classList.remove('upload-status-error');
  }

  function showLimitPanel(show, kind) {
    var el = $('tg-limit');
    var copy = $('tg-limit-copy');
    if (copy && kind === 'album') copy.textContent = 'Albums are on Creator and Pro.';
    else if (copy && show) copy.textContent = 'This is a new song. Basic includes one release.';
    if (el) el.hidden = !show;
  }

  function setBoxHidden(id, hidden) {
    var el = $(id);
    if (!el) return;
    el.hidden = Boolean(hidden);
  }

  function bindArtistSection() {
    var modeEl = $('tg-artist-mode');
    if (!modeEl) return;

    function showMode(mode) {
      setBoxHidden('artist-choose-wrap', mode !== 'choose');
      setBoxHidden('artist-create-wrap', mode !== 'create');
      setBoxHidden('artist-link-wrap', mode !== 'link');
    }

    function clearSelect(sel) {
      if (!sel) return;
      if (sel.options && typeof sel.options.length === 'number') {
        sel.options.length = 0;
        return;
      }
      while (sel.firstChild) sel.removeChild(sel.firstChild);
    }

    function artistPickValue(artist) {
      return String((artist && (artist.id || artist.artist_id || artist.name)) || '').trim();
    }

    function fillSelect(artists) {
      var sel = $('tg-artist-select');
      if (!sel) return;
      var current = sel.value;
      clearSelect(sel);
      var blank = document.createElement('option');
      blank.value = '';
      blank.textContent = artists.length ? 'Select an artist' : 'No artist profiles yet';
      sel.appendChild(blank);
      artists.forEach(function (artist) {
        var opt = document.createElement('option');
        opt.value = artistPickValue(artist);
        if (opt.setAttribute) opt.setAttribute('data-name', artist.name);
        opt.textContent = artist.name;
        sel.appendChild(opt);
      });
      if (current && artists.some(function (artist) { return artistPickValue(artist) === current; })) sel.value = current;
      else if (artists.length === 1) sel.value = artistPickValue(artists[0]);
      else sel.value = '';
      syncArtistHidden();
      var catalog = (typeof PlaigroundUploadCatalog !== 'undefined' && PlaigroundUploadCatalog) || null;
      if (catalog && typeof catalog.bindTypeahead === 'function' && artists.length) {
        if (sel.removeAttribute) sel.removeAttribute('data-typeahead');
        catalog.bindTypeahead(sel, artists, artistPickValue, function (artist) { return artist.name; });
        if (catalog.setTypeaheadValue && sel.value) catalog.setTypeaheadValue(sel, sel.value);
      }
    }

    function liveNameCheck() {
      var mode = fieldValue('tg-artist-mode') || 'choose';
      var api = artistCheckApi();
      var msg = $('artist-name-check');
      var yellow = $('artist-yellow-actions');
      var red = $('artist-red-actions');
      if (mode !== 'create') {
        if (msg) {
          msg.hidden = true;
          msg.textContent = '';
        }
        if (yellow) yellow.hidden = true;
        if (red) red.hidden = true;
        return { level: 'green' };
      }
      var name = fieldValue('tg-artist-new');
      if (!api) return { level: 'green' };
      var check = api.checkArtistName(name, { accountArtists: rosterFromMe() });
      if (msg) {
        msg.hidden = !name || check.level === 'empty';
        msg.textContent = check.level === 'green' && name
          ? 'No close match. This artist page can be created instantly.'
          : (check.copy || '');
        if (msg.classList && msg.classList.toggle) {
          msg.classList.toggle('is-green', check.level === 'green' && Boolean(name));
          msg.classList.toggle('is-yellow', check.level === 'yellow');
          msg.classList.toggle('is-red', check.level === 'red');
        }
      }
      if (yellow) yellow.hidden = check.level !== 'yellow';
      if (red) red.hidden = check.level !== 'red';
      if (check.level !== 'yellow') {
        var wrap = $('artist-impersonation-wrap');
        var box = $('artist-confirm-different');
        if (wrap) wrap.hidden = true;
        if (box) box.checked = false;
      }
      return check;
    }

    function liveTitleCheck() {
      var api = artistCheckApi();
      var msg = $('title-check-msg');
      if (!api || !msg) return;
      var result = api.checkTitle(fieldValue('tg-title'), { artistName: syncArtistHidden() });
      msg.hidden = !result.flagged;
      msg.textContent = result.copy || '';
    }

    modeEl.addEventListener('change', function () {
      showMode(modeEl.value || 'choose');
      syncArtistHidden();
      liveNameCheck();
    });
    showMode(modeEl.value || 'choose');
    var artistSel = $('tg-artist-select');
    if (artistSel && artistSel.addEventListener) {
      artistSel.addEventListener('change', function () {
        syncArtistHidden();
        liveNameCheck();
      });
    }

    var newName = $('tg-artist-new');
    if (newName) {
      newName.addEventListener('input', liveNameCheck);
      newName.addEventListener('change', liveNameCheck);
    }
    var title = $('tg-title');
    if (title) {
      title.addEventListener('input', liveTitleCheck);
      title.addEventListener('change', liveTitleCheck);
    }
    document.querySelectorAll('[data-artist-to-link]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modeEl.value = 'link';
        showMode('link');
      });
    });
    var continueDifferent = $('artist-continue-different');
    if (continueDifferent) {
      continueDifferent.addEventListener('click', function () {
        var wrap = $('artist-impersonation-wrap');
        if (wrap) wrap.hidden = false;
      });
    }
    var submitReview = $('artist-submit-review');
    if (submitReview) {
      submitReview.addEventListener('click', function () {
        writeDraft({ artist_review: true });
        setStatus('tg-status', 'This name will be held for review and will not go to the store automatically.');
      });
    }

    whenAccountReady().then(function (result) {
      fillSelect(rosterFromMe((result && result.data) || accountRecord()));
    });

    liveNameCheck();
    liveTitleCheck();
  }

  function resolveUploadArtist(fields) {
    var modeEl = $('tg-artist-mode');
    if (!modeEl) {
      return Promise.resolve({
        name: fields.name,
        id: '',
        check: { level: 'green' },
        confirmDifferent: false,
        linked: false,
      });
    }
    var mode = fieldValue('tg-artist-mode') || 'choose';
    var api = artistCheckApi();
    var me = accountRecord();
    var artists = rosterFromMe(me);

    if (mode === 'choose') {
      var picked = selectedArtistOption();
      if (!picked || !picked.id) {
        return Promise.resolve({ error: 'Choose an artist profile.' });
      }
      var existing = null;
      artists.forEach(function (row) {
        if (row.id === picked.id || row.artist_id === picked.id || row.name === picked.name || row.name === picked.id) {
          existing = row;
        }
      });
      var chosenName = (existing && existing.name) || picked.name;
      if (!chosenName) {
        return Promise.resolve({ error: 'Choose an artist profile.' });
      }
      return Promise.resolve({
        name: chosenName,
        id: picked.id === 'account' ? '' : picked.id,
        check: { level: 'green' },
        confirmDifferent: Boolean(existing && existing.impersonation_confirmed),
        linked: Boolean(existing && existing.source === 'linked'),
        skipTonegrid: Boolean(existing && existing.review_status === 'pending'),
        tonegridId: existing && existing.tonegrid_artist_id,
      });
    }

    if (mode === 'link') {
      var url = fieldValue('tg-artist-link');
      var parsed = api ? api.parseStoreLink(url) : { ok: false };
      if (!parsed.ok) {
        return Promise.resolve({ error: 'Paste a Spotify, Apple Music, or store artist link.' });
      }
      var linkName = fieldValue('tg-artist-link-name') || fields.name || 'Linked artist';
      return post('/api/me/artists', { action: 'link', url: url, name: linkName }).then(function (result) {
        if (!result.ok) return { error: (result.data && result.data.error) || 'Could not link artist.' };
        var created = (result.data && result.data.created) || {};
        return {
          name: created.name || linkName,
          id: created.id || '',
          check: { level: 'green', skip: true, linked: true },
          confirmDifferent: false,
          linked: true,
        };
      });
    }

    var name = fieldValue('tg-artist-new') || fields.name;
    if (!name) return Promise.resolve({ error: 'Artist name is required.' });
    var check = api ? api.checkArtistName(name, { accountArtists: artists }) : { level: 'green' };
    var confirmDifferent = Boolean($('artist-confirm-different') && $('artist-confirm-different').checked);
    var submitReview = Boolean(readDraft().artist_review) || check.level === 'red';
    if (check.level === 'yellow' && !confirmDifferent) {
      return Promise.resolve({ error: (api && api.YELLOW_COPY) || 'Confirm this is a different artist to continue.' });
    }
    return post('/api/me/artists', {
      action: 'create',
      name: name,
      confirm_different: confirmDifferent,
    }).then(function (result) {
      if (result.status === 409 && result.data && result.data.code === 'ARTIST_NAME_YELLOW' && !confirmDifferent) {
        return { error: (result.data && result.data.error) || 'Confirm this is a different artist to continue.' };
      }
      if (!result.ok) return { error: (result.data && result.data.error) || 'Could not save artist.' };
      var created = (result.data && result.data.created) || {};
      return {
        name: created.name || name,
        id: created.id || '',
        check: (result.data && result.data.check) || check,
        confirmDifferent: confirmDifferent,
        linked: false,
        skipTonegrid: check.level === 'red' || submitReview,
      };
    });
  }

  function recordLocalRelease(draft, artist) {
    return post('/api/me/artists', {
      action: 'record_release',
      release: {
        title: draft.title,
        plaiground_artist_id: artist && artist.id,
        title_check: draft.title_check || { flagged: false, flags: [], block: false },
        artist_check: (artist && artist.check && artist.check.level) || draft.artist_check || '',
        tonegrid_status: draft.tonegrid_status || '',
        rejection_reason: draft.rejection_reason || '',
        tonegrid_release_id: draft.release_id || '',
        id: draft.release_id || '',
      },
    });
  }

  function bindAlbumUi(onChange) {
    var list = document.querySelector('[data-track-list]');
    var addBtn = document.querySelector('[data-add-track]');
    var typeToggle = document.querySelector('[data-type-toggle]');
    var countGo = document.querySelector('[data-album-count-go]');
    var countInput = document.querySelector('[data-album-count-input]') || $('tg-album-count');
    if (typeToggle) {
      typeToggle.addEventListener('click', function (event) {
        var choice = event.target && event.target.closest && event.target.closest('[data-type]');
        if (!choice) return;
        event.preventDefault();
        applyReleaseType(choice.getAttribute('data-type') === 'album' ? 'album' : 'single');
        if (typeof onChange === 'function') onChange();
      });
    }
    if (countGo) {
      countGo.addEventListener('click', function (event) {
        event.preventDefault();
        applyAlbumCount(countInput && countInput.value).then(function () {
          if (typeof onChange === 'function') onChange();
        });
      });
    }
    if (countInput && countInput.addEventListener) {
      countInput.addEventListener('keydown', function (event) {
        if (!event || event.key !== 'Enter') return;
        event.preventDefault();
        applyAlbumCount(countInput.value).then(function () {
          if (typeof onChange === 'function') onChange();
        });
      });
    }
    if (addBtn) {
      addBtn.addEventListener('click', function (event) {
        event.preventDefault();
        if (selectedReleaseType() !== 'album') return;
        var me = accountRecord();
        if (me && !albumAllowedFor(me)) {
          setStatus('tg-status', planLimitMessage(accountPlanOf(me), 'album'));
          markStatusError(true);
          showLimitPanel(true, 'album');
          showUpgrade(true);
          return;
        }
        var cap = albumTrackCap(me);
        if (isFinite(cap) && cap > 0 && qsAll('[data-track-row]').length >= cap) {
          showCreatorAlbumUpgrade(me);
          return;
        }
        addTrackRow();
        writeDraft({ album_count: qsAll('[data-track-row]').length, type: 'album' });
        persistAlbumTracks(collectAlbumTracks());
        if (typeof onChange === 'function') onChange();
      });
    }
    if (list) {
      list.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest && event.target.closest('[data-track-up], [data-track-down], [data-track-remove]');
        if (!btn) return;
        event.preventDefault();
        var row = btn.closest('[data-track-row]');
        if (!row || !list) return;
        if (btn.hasAttribute('data-track-remove')) {
          var remaining = list.querySelectorAll ? list.querySelectorAll('[data-track-row]').length : qsAll('[data-track-row]').length;
          if (remaining <= 1) return;
          revokeTrackPreview(row);
          list.removeChild(row);
          writeDraft({ album_count: qsAll('[data-track-row]').length });
        } else if (btn.hasAttribute('data-track-up') && row.previousElementSibling) {
          list.insertBefore(row, row.previousElementSibling);
        } else if (btn.hasAttribute('data-track-down') && row.nextElementSibling) {
          list.insertBefore(row.nextElementSibling, row);
        }
        numberTrackRows();
        persistAlbumTracks(collectAlbumTracks());
        if (typeof onChange === 'function') onChange();
      });
      list.addEventListener('input', function () {
        persistAlbumTracks(collectAlbumTracks());
        if (typeof onChange === 'function') onChange();
      });
      list.addEventListener('change', function (event) {
        var input = event.target && event.target.closest && event.target.closest('[data-audio-input]');
        if (input) bindTrackAudio(input.closest('[data-track-row]'), audioFileOf(input));
        persistAlbumTracks(collectAlbumTracks());
        if (typeof onChange === 'function') onChange();
      });
    }
    applyReleaseType(queryTypeAlbum() || readDraft().type === 'album' ? 'album' : 'single', { initial: true });
  }

  function syncTypeUrl(type) {
    try {
      if (!window.history || !history.replaceState) return;
      var next = type === 'album' ? 'upload.html?type=album' : 'upload.html';
      var current = String((window.location && (window.location.pathname || '')) || '').split('/').pop();
      if (current && current !== 'upload.html') return;
      history.replaceState(null, '', next);
    } catch (err) {}
  }

  function applyReleaseType(type, opts) {
    var next = type === 'album' ? 'album' : 'single';
    var draft = readDraft();
    if (!(opts && opts.initial && draft.type === next)) {
      if (next === 'album' && draft.type !== 'album') {
        writeDraft({
          type: 'album',
          release_id: '',
          track_id: '',
          tracks: [],
          album_count: '',
          release_idempotency_key: '',
          track_idempotency_key: '',
        });
      } else if (next === 'single' && draft.type === 'album') {
        writeDraft({
          type: 'single',
          release_id: '',
          track_id: '',
          tracks: [],
          album_count: '',
          release_idempotency_key: '',
          track_idempotency_key: '',
        });
      } else {
        writeDraft({ type: next });
      }
    } else {
      writeDraft({ type: next });
    }
    if (!(opts && opts.initial)) syncTypeUrl(next);
    syncAlbumUi(next);
  }

  function albumCountReady() {
    var draft = readDraft();
    if (Number(draft.album_count) > 0) return true;
    if (Array.isArray(draft.tracks) && draft.tracks.length) return true;
    return qsAll('[data-track-row]').length > 0;
  }

  function applyAlbumCount(raw) {
    var n = parseInt(String(raw == null ? '' : raw).trim(), 10);
    if (!n || n < 1 || !isFinite(n)) {
      setStatus('tg-status', 'Pick how many songs are on this album.');
      markStatusError(true);
      return Promise.resolve(false);
    }
    n = Math.floor(n);
    return whenAccountReady().then(function (result) {
      var me = (result && result.data) || accountRecord();
      if (!albumAllowedFor(me)) {
        setStatus('tg-status', planLimitMessage(catalogFromAccount(me).plan, 'album'));
        markStatusError(true);
        showLimitPanel(true, 'album');
        showUpgrade(true);
        syncAlbumUi('album');
        return false;
      }
      var cap = albumTrackCap(me);
      if (isFinite(cap) && n > cap) {
        showCreatorAlbumUpgrade(me);
        return false;
      }
      hideCreatorAlbumUpgrade();
      writeDraft({ type: 'album', album_count: n });
      var list = document.querySelector('[data-track-list]');
      while (qsAll('[data-track-row]').length < n) addTrackRow();
      while (qsAll('[data-track-row]').length > n) {
        var rows = qsAll('[data-track-row]');
        var extra = rows[rows.length - 1];
        revokeTrackPreview(extra);
        if (list && typeof list.removeChild === 'function') list.removeChild(extra);
      }
      numberTrackRows();
      persistAlbumTracks(collectAlbumTracks());
      writeDraft({ album_count: n, type: 'album' });
      syncAlbumUi('album');
      setStatus('tg-status', '');
      markStatusError(false);
      return true;
    });
  }

  function syncAlbumUi(type) {
    var album = (type || selectedReleaseType()) === 'album';
    qsAll('[data-type]').forEach(function (el) {
      if (el.classList && el.classList.toggle) {
        el.classList.toggle('on', el.getAttribute('data-type') === (album ? 'album' : 'single'));
      }
    });
    var me = accountRecord();
    var known = Boolean(me);
    var allowed = !known || albumAllowedFor(me);
    var counted = albumCountReady();
    var showCount = album && allowed && !counted;
    var showTracks = album && allowed && counted;
    setPanelHidden(document.querySelector('[data-single-audio]'), album);
    setPanelHidden(document.querySelector('[data-album-count]'), !showCount);
    setPanelHidden(document.querySelector('[data-album-tracks]'), !showTracks);
    setPanelHidden(document.querySelector('[data-album-hint]'), !album);
    var kicker = document.querySelector('[data-upload-kicker]');
    var heading = document.querySelector('[data-upload-heading]');
    var titleLabel = document.querySelector('[data-title-label]');
    var artistCopy = document.querySelector('[data-artist-copy]');
    var artistMode = document.querySelector('[data-artist-mode-label]');
    if (kicker) kicker.textContent = album ? 'Submit an album' : 'Submit a song';
    if (heading) heading.textContent = album ? 'Upload album' : 'Upload';
    if (titleLabel) titleLabel.textContent = album ? 'Album title' : 'Song title';
    if (artistCopy) {
      artistCopy.textContent = album
        ? 'Choose who this album is released under. A new name is enough here — photo, bio, and genres live on Artist Profiles.'
        : 'Choose who this song is released under. A new name is enough here — photo, bio, and genres live on Artist Profiles.';
    }
    if (artistMode) artistMode.textContent = album ? 'Artist for this album' : 'Artist for this song';
    var titleInput = $('tg-title');
    if (titleInput) titleInput.setAttribute('placeholder', album ? 'ALBUM TITLE' : 'SONG TITLE');
    if (showTracks) ensureAlbumTracks();
  }

  function ensureAlbumTracks() {
    var list = document.querySelector('[data-track-list]');
    if (!list) return;
    if (!albumCountReady()) return;
    if (!qsAll('[data-track-row]').length) {
      var saved = readDraft().tracks;
      var want = Number(readDraft().album_count) || 0;
      if (Array.isArray(saved) && saved.length) {
        saved.forEach(function (track) { addTrackRow(track); });
        if (!want) want = saved.length;
      }
      while (want > 0 && qsAll('[data-track-row]').length < want) addTrackRow();
    }
    numberTrackRows();
  }

  function addTrackRow(track) {
    var list = document.querySelector('[data-track-list]');
    if (!list || !document.createElement) return;
    var row = document.createElement('div');
    row.className = 'track-row';
    row.setAttribute('data-track-row', '');
    if (track && track.track_id) row.setAttribute('data-track-id', track.track_id);
    if (track && (track.audio || track.file)) rememberAudioFile(track.audio || track.file);
    if (track && track.audio_uploaded) row.setAttribute('data-audio-uploaded', 'true');
    row.innerHTML = ''
      + '<div class="track-row-head">'
      + '<strong data-track-index>Track</strong>'
      + '<div class="track-row-actions">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-track-up>Up</button>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-track-down>Down</button>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-track-remove>Remove</button>'
      + '</div></div>'
      + '<div class="field"><label>Track title</label>'
      + '<input type="text" data-track-title placeholder="Track title" autocomplete="off" /></div>'
      + '<div class="field" data-track-lyrics-wrap><label>Lyrics</label>'
      + '<textarea data-track-lyrics rows="4" placeholder="Type or paste lyrics" autocomplete="off"></textarea>'
      + '<p class="hint">Optional. Timed .srt or .lrc can be added later.</p></div>'
      + '<label class="dashbox audio-drop" data-audio-drop>Drop WAV, FLAC, or MP3 here'
      + '<span>16-bit or higher · MP3 is converted to WAV before it goes to stores</span>'
      + '<input type="file" accept="audio/*,.wav,.flac,.mp3,.mpeg,.mpga,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/mpeg,audio/mp3,audio/x-mpeg,audio/x-mp3,audio/mpeg3,audio/mpg" hidden data-audio-input /></label>'
      + '<div class="audio-bar" data-audio-preview hidden><div>'
      + '<b data-audio-name>No file selected</b>'
      + '<div style="color:var(--muted);font-size:12px" data-audio-meta>WAV, FLAC, or MP3 · 16-bit or higher</div></div>'
      + '<audio data-audio-player controls preload="metadata"></audio>'
      + '<button class="play" type="button" data-audio-play aria-label="Play">▶</button></div>';
    list.appendChild(row);
    var titleEl = row.querySelector('[data-track-title]');
    if (titleEl && track && track.title) titleEl.value = track.title;
    var lyricsEl = row.querySelector('[data-track-lyrics]');
    if (lyricsEl && track && track.lyrics) lyricsEl.value = track.lyrics;
    var drop = row.querySelector('[data-audio-drop]');
    var input = row.querySelector('[data-audio-input]');
    if (drop && input) {
      drop.addEventListener('dragover', function (event) {
        event.preventDefault();
        drop.classList.add('is-over');
      });
      drop.addEventListener('dragleave', function () {
        drop.classList.remove('is-over');
      });
      drop.addEventListener('drop', function (event) {
        event.preventDefault();
        drop.classList.remove('is-over');
        var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        bindTrackAudio(row, file);
      });
      if (input.addEventListener) {
        input.addEventListener('change', function () {
          bindTrackAudio(row, audioFileOf(input));
        });
      }
    }
    var playBtn = row.querySelector('[data-audio-play]');
    var player = row.querySelector('[data-audio-player]');
    if (playBtn && player) {
      playBtn.addEventListener('click', function (event) {
        event.preventDefault();
        if (!player.getAttribute('src') && !player.src) return;
        if (player.paused === false) player.pause();
        else if (typeof player.play === 'function') player.play();
      });
      player.addEventListener('play', function () {
        playBtn.textContent = '❚❚';
        playBtn.setAttribute('aria-label', 'Pause');
      });
      player.addEventListener('pause', function () {
        playBtn.textContent = '▶';
        playBtn.setAttribute('aria-label', 'Play');
      });
      player.addEventListener('ended', function () {
        playBtn.textContent = '▶';
        playBtn.setAttribute('aria-label', 'Play');
      });
    }
    if (track && track.audio_name) {
      var nameEl = row.querySelector('[data-audio-name]');
      var preview = row.querySelector('[data-audio-preview]');
      if (nameEl) nameEl.textContent = track.audio_name;
      if (preview) preview.hidden = false;
      if (drop) drop.hidden = true;
    }
    numberTrackRows();
  }

  function numberTrackRows() {
    var rows = qsAll('[data-track-row]');
    for (var i = 0; i < rows.length; i += 1) {
      var label = rows[i].querySelector('[data-track-index]');
      if (label) label.textContent = 'Track ' + (i + 1);
    }
  }

  function revokeTrackPreview(row) {
    if (!row) return;
    var player = row.querySelector('[data-audio-player]');
    var url = row.getAttribute('data-preview-url');
    if (player) {
      try { player.pause(); } catch (err) {}
      player.removeAttribute('src');
      if (typeof player.load === 'function') player.load();
    }
    if (url && window.URL && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(url); } catch (err) {}
    }
    row.removeAttribute('data-preview-url');
  }

  function bindTrackAudio(row, file) {
    if (!row) return;
    var input = row.querySelector('[data-audio-input]');
    if (!file) file = audioFileOf(input);
    if (!file) return;
    var drop = row.querySelector('[data-audio-drop]');
    var preview = row.querySelector('[data-audio-preview]');
    var nameEl = row.querySelector('[data-audio-name]');
    var metaEl = row.querySelector('[data-audio-meta]');
    var player = row.querySelector('[data-audio-player]');
    if (input) {
      try {
        var dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      } catch (err) {}
      input._plaigroundFile = file;
    }
    rememberAudioFile(file);
    if (nameEl) nameEl.textContent = file.name || 'Audio file';
    if (metaEl) metaEl.textContent = file.type || 'Audio file';
    if (preview) preview.hidden = false;
    if (drop) drop.hidden = true;
    revokeTrackPreview(row);
    if (player && window.URL && URL.createObjectURL) {
      var url = URL.createObjectURL(file);
      row.setAttribute('data-preview-url', url);
      player.src = url;
    }
    row.removeAttribute('data-audio-uploaded');
  }

  function ensureUploadTypeahead() {
    var catalog = (typeof PlaigroundUploadCatalog !== 'undefined' && PlaigroundUploadCatalog) || null;
    var genre = $('tg-genre');
    var language = $('tg-language');
    if (!genre && !language) return catalog;
    if (catalog && typeof catalog.fillUploadSelects === 'function') {
      try { catalog.fillUploadSelects(document); } catch (err) {}
    }
    if (catalog && genre && genre.appendChild && genre.options && genre.options.length < 3 && catalog.GENRES) {
      catalog.GENRES.forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        genre.appendChild(opt);
      });
    }
    if (catalog && language && language.appendChild && language.options && language.options.length < 3 && catalog.LANGUAGES) {
      catalog.LANGUAGES.forEach(function (row) {
        var opt = document.createElement('option');
        opt.value = row.code;
        opt.textContent = row.name;
        language.appendChild(opt);
      });
    }
    if (catalog && (typeof catalog.ensureTypeahead === 'function' || typeof catalog.bindTypeahead === 'function')) {
      var bind = catalog.ensureTypeahead || catalog.bindTypeahead;
      try {
        if (genre && catalog.GENRES) bind.call(catalog, genre, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
        if (language && catalog.LANGUAGES) {
          bind.call(catalog, language, catalog.LANGUAGES, function (row) { return row.code; }, function (row) { return row.name; });
        }
      } catch (err) {}
    }
    return catalog;
  }

  function bindUploadCatalog() {
    var catalog = ensureUploadTypeahead();
    var genre = $('tg-genre');
    var language = $('tg-language');
    if (catalog && typeof catalog.setTypeaheadValue === 'function') {
      var draft = readDraft();
      if (genre && draft.genre) catalog.setTypeaheadValue(genre, draft.genre);
      if (language && draft.language) catalog.setTypeaheadValue(language, draft.language);
    }
  }

  function restoreUploadDraft(draft) {
    draft = draft || readDraft();
    function fill(id, value) {
      var el = $(id);
      if (!el || value == null || value === '') return;
      if (!el.value || isDemoCopy(el.value)) el.value = value;
    }
    fill('tg-title', draft.title);
    fill('tg-artist', draft.name);
    fill('tg-featured', draft.featured);
    fill('tg-price', draft.price);
    fill('tg-genre', draft.genre);
    fill('tg-language', draft.language);
    fill('tg-lyrics', draft.lyrics);
    if (draft.lyrics && !draft.instrumental) openLyricsField();
    if (draft.explicit === true) {
      var toggle = document.querySelector('[data-explicit-toggle]');
      if (toggle && toggle.querySelectorAll) {
        var choices = toggle.querySelectorAll('[data-explicit]');
        for (var i = 0; i < choices.length; i += 1) {
          var on = choices[i].getAttribute('data-explicit') === 'true';
          if (choices[i].classList && choices[i].classList.toggle) choices[i].classList.toggle('on', on);
        }
      }
    }
    if (draft.artwork_name && !selectedArtwork()) {
      var artMeta = document.querySelector('[data-art-meta]');
      if (artMeta) artMeta.textContent = draft.artwork_name;
    }
    if (window.PlaigroundUploadCover && typeof window.PlaigroundUploadCover.setStored === 'function' && draft.artwork_url) {
      window.PlaigroundUploadCover.setStored(draft.artwork_url);
    }
    if (draft.type !== 'album' && (draft.track_id || draft.audio_uploaded) && !selectedAudio()) {
      var nameEl = document.querySelector('[data-audio-name]');
      var preview = document.querySelector('[data-audio-preview]');
      var drop = document.querySelector('[data-audio-drop]');
      if (nameEl) nameEl.textContent = draft.audio_name || 'Audio already uploaded';
      if (preview) preview.hidden = false;
      if (drop) drop.hidden = true;
    }
  }

  function bindUpload() {
    var trigger = document.querySelector('[data-store-continue]');
    if (!trigger) return;
    bindUploadCatalog();
    bindArtistSection();
    bindStorePick(storePickRoot());
    bindAlbumUi(refreshUploadGate);
    var uploadRunning = false;
    var retryBtn = document.querySelector('[data-upload-retry]');
    if (retryBtn && retryBtn.addEventListener) {
      retryBtn.addEventListener('click', function (event) {
        event.preventDefault();
        if (uploadRunning) return;
        var ev = { preventDefault: function () {} };
        if (trigger && trigger.listeners && typeof trigger.listeners.click === 'function') {
          trigger.listeners.click(ev);
          return;
        }
        if (trigger && typeof trigger.click === 'function') trigger.click();
      });
    }

    function setUploadBusy(busy) {
      uploadRunning = Boolean(busy);
      if (busy) {
        trigger.setAttribute('aria-busy', 'true');
        trigger.setAttribute('aria-disabled', 'true');
      } else {
        trigger.removeAttribute('aria-busy');
        trigger.removeAttribute('aria-disabled');
        hideUploadLoader();
      }
    }

    function showUploadRetry(on) {
      var wrap = document.querySelector('[data-upload-retry-wrap]') || $('tg-retry-wrap');
      if (wrap) wrap.hidden = !on;
    }

    function failUpload(message, upgrade, opts) {
      setUploadBusy(false);
      markIncomplete(trigger, false);
      var shownError = (opts && opts.createFreshFailed && /release not found/i.test(String(message || '')))
        ? DEAD_RELEASE_COPY
        : message;
      setStatus('tg-status', shownError || '');
      markStatusError(Boolean(shownError));
      showLimitPanel(upgrade === true, /Albums are on Creator/.test(message || '') ? 'album' : '');
      showUpgrade(upgrade === true);
      var shown = sanitizePartnerCopy(shownError || '');
      var retryable = !upgrade && Boolean(shown) && !/is required|must be|Upgrade to|Albums are on|Pick how many/i.test(shown);
      showUploadRetry(retryable);
    }

    function finishToAttest(nextHref, message) {
      showUploadLoader('Opening SignWell');
      setStatus('tg-status', message || 'Opening SignWell…');
      continueAfterCatalog(nextHref, message);
    }

    function persistLyricsFromUi() {
      var instrumental = selectedInstrumental();
      writeDraft({ lyrics: instrumental ? '' : selectedLyrics() });
    }

    function refreshUploadGate() {
      syncLanguageField(selectedInstrumental());
      syncLyricsField(selectedInstrumental());
      var genre = catalogFieldValue('tg-genre');
      var language = selectedInstrumental() ? '' : catalogLanguageValue();
      if (genre || language || selectedInstrumental()) {
        writeDraft({
          genre: genre || readDraft().genre || '',
          language: language,
        });
      }
      markIncomplete(trigger, Boolean(uploadPageError(collectUploadFields())));
    }
    ['tg-title', 'tg-artist', 'tg-artist-new', 'tg-artist-select', 'tg-artist-mode', 'tg-artist-link', 'tg-artist-link-name', 'tg-featured', 'tg-genre', 'tg-language', 'tg-price', 'tg-instrumental', 'tg-lyrics'].forEach(function (id) {
      var el = $(id);
      if (!el || !el.addEventListener) return;
      el.addEventListener('input', refreshUploadGate);
      el.addEventListener('change', refreshUploadGate);
    });
    ['tg-genre', 'tg-language'].forEach(function (id) {
      var select = $(id);
      var field = select && select.parentNode;
      var typed = field && field.querySelector ? field.querySelector('.typeahead-input') : null;
      if (!typed && select && select.id && document.getElementById) {
        typed = document.getElementById(select.id + '-type');
      }
      if (typed && typed.addEventListener) typed.addEventListener('change', refreshUploadGate);
    });
    var audioInput = document.querySelector('[data-audio-input]');
    if (audioInput && audioInput.addEventListener) {
      audioInput.addEventListener('change', function () {
        var picked = audioFileOf(audioInput);
        if (picked && picked.name) {
          rememberAudioFile(picked);
          writeDraft({ audio_name: picked.name, audio_uploaded: false, audio_attached: true });
        }
        refreshUploadGate();
      });
    }
    var artInput = document.querySelector('[data-art-input]');
    if (artInput && artInput.addEventListener) {
      artInput.addEventListener('change', refreshUploadGate);
    }
    var savedDraft = readDraft();
    restoreHeldAudio();
    restoreUploadDraft(savedDraft);
    var instEl = $('tg-instrumental');
    if (instEl && savedDraft.instrumental === true) instEl.checked = true;
    var lyricsOpen = document.querySelector('[data-lyrics-open]');
    if (lyricsOpen && lyricsOpen.addEventListener) {
      lyricsOpen.addEventListener('click', function (event) {
        event.preventDefault();
        openLyricsField();
      });
    }
    var lyricsInput = $('tg-lyrics');
    if (lyricsInput && lyricsInput.addEventListener) {
      lyricsInput.addEventListener('input', persistLyricsFromUi);
      lyricsInput.addEventListener('change', persistLyricsFromUi);
    }
    refreshUploadGate();
    showUpgrade(false);
    showLimitPanel(false);
    whenAccountReady().then(function (result) {
      ensureUploadTypeahead();
      var me = (result && result.data) || accountRecord();
      var catalog = catalogFromAccount(me);
      var draft = readDraft();
      if (selectedReleaseType() === 'album') {
        if (!albumAllowedFor(me)) {
          setStatus('tg-status', planLimitMessage(catalog.plan, 'album'));
          markStatusError(true);
          showLimitPanel(true, 'album');
          showUpgrade(true);
          syncAlbumUi('album');
          return;
        }
        syncAlbumUi('album');
      }
      if (catalog.allowed === false && !draft.release_id) {
        setStatus('tg-status', planLimitMessage(catalog.plan));
        markStatusError(true);
        showLimitPanel(true);
        showUpgrade(true);
      }
    });

    function fieldError(message) {
      failUpload(message, false);
      markIncomplete(trigger, true);
      var wrap = document.querySelector('[data-upload-retry-wrap]') || $('tg-retry-wrap');
      if (wrap) wrap.hidden = true;
    }

    function fireContinue() {
      var ev = { preventDefault: function () {} };
      if (trigger.listeners && typeof trigger.listeners.click === 'function') {
        trigger.listeners.click(ev);
        return;
      }
      if (typeof trigger.click === 'function') trigger.click();
    }

    function keepUploadBarVisible() {
      var loader = document.querySelector('[data-upload-loader]');
      if (!loader) return;
      loader.hidden = false;
      if (loader.classList && loader.classList.remove) loader.classList.remove('is-hidden');
    }

    function stepHrefOf(step) {
      if (!step || !step.getAttribute) return '';
      return step.getAttribute('href') || step.getAttribute('data-flow-step') || '';
    }

    function isLeavingUpload(href) {
      var next = String(href || '').toLowerCase();
      if (!next || next.indexOf('upload.html') !== -1) return false;
      return /attest\.html|split-sheet\.html|review\.html/.test(next);
    }

    function stepFromEvent(event) {
      var target = event && event.target;
      if (!target) return null;
      if (target.closest) {
        return target.closest('.st') || target.closest('[data-flow-step]') || target.closest('a[href]');
      }
      return target;
    }

    function guardLeaveUpload(event) {
      var step = stepFromEvent(event);
      if (!step || !isLeavingUpload(stepHrefOf(step))) return;
      if (event && event.preventDefault) event.preventDefault();
      if (event && event.stopPropagation) event.stopPropagation();
      var file = selectedAudio();
      if (file) rememberAudioFile(file);
      if (uploadRunning || trigger.getAttribute('aria-busy') === 'true' || trigger.getAttribute('aria-disabled') === 'true') {
        keepUploadBarVisible();
        return;
      }
      fireContinue();
    }

    function bindLeaveUploadGuard() {
      var stepper = document.querySelector('.stepper');
      if (!stepper || typeof stepper.addEventListener !== 'function') return;
      stepper.addEventListener('click', guardLeaveUpload, true);
      stepper.addEventListener('keydown', function (event) {
        if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
        guardLeaveUpload(event);
      }, true);
    }

    function afterCatalogReady(draft, nextHref) {
      showUploadLoader('Creating track');
      setStatus('tg-status', 'Creating track…');
      return afterRelease(draft).then(function (next) {
        if (next && next.unavailable) {
          finishToAttest(nextHref, 'Catalog sync is not configured yet.');
          return true;
        }
        if (next && next.failed) {
          failUpload((next.result && next.result.data && next.result.data.error) || 'Could not create the track.');
          return false;
        }
        if (next && next.audio && next.audio.failed) {
          failUpload((next.audio.result && next.audio.result.data && next.audio.result.data.error) || 'Could not upload audio.');
          return false;
        }
        if (next && next.audio && next.audio.unavailable) {
          finishToAttest(nextHref, 'Catalog sync is not configured yet.');
          return true;
        }
        if (next && next.artwork && next.artwork.failed) {
          failUpload((next.artwork.result && next.artwork.result.data && next.artwork.result.data.error) || 'Could not upload artwork.');
          return false;
        }
        if (next && next.artwork && next.artwork.unavailable) {
          finishToAttest(nextHref, 'Catalog sync is not configured yet.');
          return true;
        }
        finishToAttest(nextHref);
        return true;
      }).catch(function (err) {
        var step = '';
        var stepEl = document.querySelector('[data-upload-loader-step]');
        if (stepEl) step = String(stepEl.textContent || '').trim();
        var detail = (err && err.message) || 'Could not reach catalog.';
        failUpload(step ? (step + ' failed. ' + detail) : detail, false);
        return false;
      });
    }

    function afterArtistReady(draft, nextHref) {
      var known = Boolean(draft.release_id && sessionReleaseId && sameUuid(draft.release_id, sessionReleaseId));
      if (known) return afterCatalogReady(draft, nextHref);
      showUploadLoader(draft.release_id ? 'Opening release' : 'Creating release');
      setStatus('tg-status', draft.release_id ? 'Opening release…' : 'Creating release…');
      return resolveLiveRelease(draft).then(function (created) {
        if (created.unavailable) {
          finishToAttest(nextHref, 'Catalog sync is not configured yet.');
          return;
        }
        if (created.limited) {
          failUpload(createErrorMessage(created.result, 'Basic includes one release. Upgrade to Creator or Pro to upload more.'), true);
          return;
        }
        if (created.failed || created.missing) {
          failUpload(
            (created.result && created.result.data && created.result.data.error) || DEAD_RELEASE_COPY,
            false,
            { createFreshFailed: created.createFreshFailed === true }
          );
          return;
        }
        return afterCatalogReady(created.draft || draft, nextHref).then(function (ok) {
          if (ok === false) return;
          return recordLocalRelease(created.draft || draft, {
            id: (created.draft || draft).plaiground_artist_id,
            check: { level: (created.draft || draft).artist_check },
          });
        });
      }).catch(function (err) {
        failUpload((err && err.message) || 'Could not create release.', false);
      });
    }

    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      if (uploadRunning || trigger.getAttribute('aria-busy') === 'true' || trigger.getAttribute('aria-disabled') === 'true') return;

      var fields = collectUploadFields();
      var name = fields.name;
      var title = fields.title;
      var genre = fields.genre;
      var language = fields.language;
      var price = fields.price;
      var featured = fields.featured;
      var explicit = fields.explicit;
      var instrumental = fields.instrumental === true;
      var releaseType = fields.type === 'album' ? 'album' : 'single';
      var albumTracks = fields.tracks || [];
      var file = fields.audio;
      if (file) rememberAudioFile(file);
      var art = fields.artwork;
      var nextHref = trigger.getAttribute('href') || 'attest.html';
      var pageError = uploadPageError(fields);
      if (pageError) {
        fieldError(pageError);
        return;
      }
      if (releaseType === 'album') {
        for (var t = 0; t < albumTracks.length; t += 1) {
          if (albumTracks[t].audio && albumTracks[t].audio.size > MAX_AUDIO_BYTES) {
            fieldError('Track ' + (t + 1) + ' must be 200 MB or smaller.');
            return;
          }
        }
      } else if (file && file.size > MAX_AUDIO_BYTES) {
        fieldError('Audio must be 200 MB or smaller.');
        return;
      }
      if (art && art.size > MAX_ARTWORK_BYTES) {
        fieldError('Artwork must be 15 MB or smaller.');
        return;
      }
      if (art && !isArtFile(art)) {
        fieldError('Artwork must be JPG or PNG.');
        return;
      }

      var titleCheck = artistCheckApi() ? artistCheckApi().checkTitle(title, { artistName: name }) : { flagged: false, flags: [], block: false };
      var dsps = fields.dsps || selectedUploadStores();
      function startUpload() {
      releaseRecreateCount = 0;
      var previous = readDraft();
      if (previous.release_id && !releaseBelongsToThisSong(previous, fields)) {
        detachForeignRelease(previous);
      }
      writeDraft({
        name: name,
        title: title,
        genre: genre,
        language: language,
        price: price,
        featured: featured,
        type: releaseType,
        explicit: explicit,
        instrumental: instrumental,
        lyrics: instrumental ? '' : (fields.lyrics || ''),
        dsps: dsps,
        artwork_name: art && art.name ? art.name : (readDraft().artwork_name || ''),
        artwork_type: art && art.type ? art.type : (readDraft().artwork_type || ''),
        audio_name: file && file.name ? file.name : (readDraft().audio_name || ''),
        audio_attached: Boolean((file && file.name) || readDraft().audio_attached || readDraft().audio_name),
        title_check: titleCheck,
        tracks: releaseType === 'album' ? persistAlbumTracks(albumTracks).tracks : readDraft().tracks,
      });
      setUploadBusy(true);
      markStatusError(false);
      showLimitPanel(false);
      showUpgrade(false);
      showUploadRetry(false);

      var continuingSame = Boolean(readDraft().release_id);
      whenAccountReady()
        .then(function (result) {
          var me = (result && result.data) || accountRecord();
          var draft = mergeCatalogIds(writeDraft({
            name: name,
            title: title,
            genre: genre,
            language: language,
            price: price,
            featured: featured,
            type: releaseType,
            explicit: explicit,
            instrumental: instrumental,
            lyrics: instrumental ? '' : (fields.lyrics || ''),
            dsps: dsps,
            artwork_name: art && art.name ? art.name : (readDraft().artwork_name || ''),
            artwork_type: art && art.type ? art.type : (readDraft().artwork_type || ''),
            audio_name: file && file.name ? file.name : (readDraft().audio_name || ''),
            audio_attached: Boolean((file && file.name) || readDraft().audio_attached || readDraft().audio_name),
            title_check: titleCheck,
            tracks: releaseType === 'album' ? persistAlbumTracks(albumTracks).tracks : readDraft().tracks,
          }), me);
          var catalog = catalogFromAccount(me);
          if (releaseType === 'album' && !albumAllowedFor(me)) {
            failUpload(planLimitMessage(catalog.plan, 'album'), true);
            showLimitPanel(true, 'album');
            return;
          }
          if (!continuingSame && catalog.allowed === false) {
            failUpload(planLimitMessage(catalog.plan), true);
            return;
          }
          return resolveUploadArtist(fields).then(function (artist) {
            if (artist && artist.error) {
              failUpload(artist.error, false);
              return;
            }
            var nextDraft = writeDraft({
              name: (artist && artist.name) || name,
              plaiground_artist_id: (artist && artist.id) || '',
              artist_check: (artist && artist.check && artist.check.level) || '',
              artist_linked: Boolean(artist && artist.linked),
              confirm_different: Boolean(artist && artist.confirmDifferent),
            });
            if (artist && (artist.skipTonegrid || (artist.check && artist.check.level === 'red'))) {
              writeDraft({ pending_review: true, tonegrid_status: 'pending_review', artist_check: 'red' });
              return recordLocalRelease(readDraft(), artist).then(function () {
                finishToAttest(nextHref, 'This artist name is held for review and was not sent to the store.');
              });
            }
            var reusing = Boolean(nextDraft.artist_id || nextDraft.release_id || (artist && artist.tonegridId));
            if (artist && artist.tonegridId && !nextDraft.artist_id) {
              nextDraft = writeDraft({ artist_id: artist.tonegridId });
            }
            if (reusing) {
              return afterArtistReady(nextDraft, nextHref);
            }
            if (catalog.allowed === false) {
              failUpload(planLimitMessage(catalog.plan), true);
              return;
            }
            showUploadLoader('Saving artist');
            setStatus('tg-status', 'Saving artist…');
            return post(ARTISTS_URL, {
              name: (artist && artist.name) || name,
              plaiground_artist_id: (artist && artist.id) || '',
              confirm_different: Boolean(artist && artist.confirmDifferent),
              store_url: fieldValue('tg-artist-link'),
            }).then(function (artistResult) {
              if (artistResult.status === 409 && artistResult.data && artistResult.data.code === 'ARTIST_NAME_RED') {
                writeDraft({ pending_review: true, tonegrid_status: 'pending_review', artist_check: 'red' });
                return recordLocalRelease(readDraft(), artist).then(function () {
                  finishToAttest(nextHref, 'This artist name is held for review and was not sent to the store.');
                });
              }
              if (isUnavailable(artistResult)) {
                finishToAttest(nextHref, 'Catalog sync is not configured yet.');
                return;
              }
              if (isPlanLimit(artistResult)) {
                failUpload(createErrorMessage(artistResult, 'Basic includes one release. Upgrade to Creator or Pro to upload more.'), true);
                return;
              }
              if (!artistResult.ok) {
                failUpload(artistResult.data.error || 'Could not save artist.', false);
                return;
              }
              var artistId = pickUuid(artistResult.data);
              var next = writeDraft({ artist_id: artistId });
              if (artistId) saveCatalog({ artist_id: artistId });
              if (artist && artist.id && artistId) {
                post('/api/me/artists', { action: 'attach_tonegrid', id: artist.id, tonegrid_artist_id: artistId });
              }
              if (!artistId) {
                finishToAttest(nextHref, 'Artist saved. Release will retry on the next step.');
                return;
              }
              return afterArtistReady(next, nextHref);
            });
          });
        })
        .catch(function () {
          failUpload('Could not reach catalog.');
        });
      }

      var filesToCheck = releaseType === 'album'
        ? albumTracks.map(function (track) { return track.audio; }).filter(Boolean)
        : (file ? [file] : []);
      if (filesToCheck.length) {
        Promise.all(filesToCheck.map(function (item) { return fileLooksAllowed(item); })).then(function (oks) {
          if (oks.some(function (ok) { return !ok; })) {
            fieldError(AUDIO_ERROR);
            return;
          }
          startUpload();
        });
        return;
      }
      startUpload();
    });
    bindLeaveUploadGuard();
  }

  function refreshSignWellDraft(draft) {
    var documentId = documentIdOf(draft);
    if (!documentId || isSoloOwned(draft)) return Promise.resolve(draft);
    return checkSignWell(documentId).then(function (gate) {
      if (gate && gate.data && gate.data.error && !gate.data.signed) {
        setStatus('tg-status', createErrorMessage(gate, gate.data.error));
      }
      if (gate && gate.ok && gate.data) {
        return persistSignWellStatus(documentId, gate.data);
      }
      return draft;
    });
  }

  function finishSubmit(draft, releaseDate, trigger, nextHref) {
    return restoreHeldAudio().then(function () {
      return finishSubmitReady(draft, releaseDate, trigger, nextHref);
    });
  }

  function finishSubmitReady(draft, releaseDate, trigger, nextHref) {
    if (draft && (draft.pending_review || draft.artist_check === 'red')) {
      writeDraft({ tonegrid_status: 'pending_review', submitted: true });
      return recordLocalRelease(readDraft(), {
        id: draft.plaiground_artist_id,
        check: { level: 'red' },
      }).then(function () {
        if (trigger) trigger.removeAttribute('aria-busy');
        setStatus('tg-status', 'Held for review. This name was not sent to the store.');
        if (nextHref) go(nextHref);
      });
    }
    var solo = isSoloOwned(draft);
    setStatus('tg-status', solo ? 'Submitting to the store…' : 'Sending split sheet…');
    var ready = solo ? Promise.resolve(draft) : refreshSignWellDraft(draft);
    return ready.then(function (next) {
      setStatus('tg-status', 'Submitting to the store…');
      return submitRelease(next || draft, releaseDate).then(function (sent) {
        if (trigger) trigger.removeAttribute('aria-busy');
        if (sent.unavailable) {
          continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
          return;
        }
        if (sent.recover) {
          setStatus('tg-status', createErrorMessage(sent.result, recoverUploadMessage()));
          var back = document.querySelector('.flow-actions a[href="split-sheet.html"], .flow-actions a[href="attest.html"], .flow-actions a.btn-ghost');
          if (back && back.setAttribute) back.setAttribute('href', 'upload.html');
          return;
        }
        if (sent.unsigned || sent.trial || sent.failed) {
          setStatus('tg-status', createErrorMessage(sent.result, 'Could not submit the release.'));
          return;
        }
        var toneStatus = (sent.result && sent.result.data && sent.result.data.status) || 'pending';
        var sheetStatus = (sent.result && sent.result.data && sent.result.data.signwell_status) || '';
        setStatus('tg-status', sheetStatus && sheetStatus !== 'solo' && sheetStatus !== 'Completed'
          ? 'Store status: ' + toneStatus + ' · awaiting signature'
          : 'Store status: ' + toneStatus);
        if (nextHref) go(nextHref);
      });
    });
  }

  function bindReview() {
    var trigger = document.querySelector('[data-store-submit]');
    var onReview = Boolean(trigger || document.querySelector('[data-review-title]'));
    if (!onReview) return;
    bindStorePick(storePickRoot(), readDraft().dsps);

    if (trigger) {
      trigger.addEventListener('click', function (event) {
        event.preventDefault();
        if (trigger.getAttribute('aria-busy') === 'true') return;

        var draft = readDraft();
        var nextHref = trigger.getAttribute('href') || 'submitted.html';
        if ($('tg-preorder-on') || $('tg-time-on')) collectReleaseSchedule();
        var releaseDate = persistReleaseDate($('tg-release-date'));
        var reviewGate = rules();
        var reviewError = '';
        if (reviewGate && typeof reviewGate.validateReviewPage === 'function') {
          var reviewed = reviewGate.validateReviewPage({ release_date: releaseDate });
          if (reviewed && reviewed.error) {
            var shownDate = toIsoDate($('tg-release-date') && $('tg-release-date').value);
            reviewError = shownDate && !isReadyReleaseDate(shownDate)
              ? 'Stores need 7 days of lead time.'
              : reviewed.error;
          }
        } else if (!releaseDate) {
          reviewError = toIsoDate($('tg-release-date') && $('tg-release-date').value)
            ? 'Stores need 7 days of lead time.'
            : 'Release date is required.';
        }
        if (reviewError) {
          setStatus('tg-status', reviewError);
          markIncomplete(trigger, true);
          return;
        }
        var pick = storePickSnapshot();
        var submitPatch = { release_date: releaseDate, dsps: pick.slugs, dsps_all: pick.allOn };
        if (pick.total > 0) submitPatch.dsps_total = pick.total;
        draft = writeDraft(submitPatch);

        if (!isSoloOwned(draft) && !documentIdOf(draft)) {
          setStatus('tg-status', 'Create the split sheet before submitting.');
          return;
        }
        if (!draft.release_id && !draft.title) {
          setStatus('tg-status', 'Song title is required.');
          return;
        }

        trigger.setAttribute('aria-busy', 'true');
        releaseRecreateCount = 0;
        ensureCatalogArtist(draft).then(function (ready) {
          if (ready.unavailable) {
            trigger.removeAttribute('aria-busy');
            continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
            return;
          }
          if (ready.limited) {
            trigger.removeAttribute('aria-busy');
            setStatus('tg-status', createErrorMessage(ready.result, 'Basic includes one release. Upgrade to Creator or Pro to upload more.'));
            showUpgrade(true);
            return;
          }
          if (ready.failed || ready.missing) {
            trigger.removeAttribute('aria-busy');
            setStatus('tg-status', createErrorMessage(ready.result, 'Save the upload details first so a catalog artist exists.'));
            return;
          }
          var nextDraft = ready.draft || draft;
          if (nextDraft.release_id) {
            return finishSubmit(nextDraft, releaseDate, trigger, nextHref).catch(function () {
              trigger.removeAttribute('aria-busy');
              setStatus('tg-status', 'Could not reach catalog.');
            });
          }

          setStatus('tg-status', 'Creating release…');
          showUploadLoader('Creating release');
          return resolveLiveRelease(nextDraft).then(function (created) {
            if (created.unavailable) {
              hideUploadLoader();
              trigger.removeAttribute('aria-busy');
              continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
              return;
            }
            if (created.limited) {
              hideUploadLoader();
              trigger.removeAttribute('aria-busy');
              setStatus('tg-status', createErrorMessage(created.result, 'Basic includes one release. Upgrade to Creator or Pro to upload more.'));
              showUpgrade(true);
              return;
            }
            if (created.failed || created.missing) {
              hideUploadLoader();
              trigger.removeAttribute('aria-busy');
              setStatus('tg-status', createErrorMessage(created.result, 'Could not create release.'));
              showUpgrade(false);
              return;
            }
            showUploadLoader('Creating track');
            return afterRelease(created.draft || nextDraft).then(function (next) {
              if (next && next.failed) {
                hideUploadLoader();
                trigger.removeAttribute('aria-busy');
                setStatus('tg-status', createErrorMessage(next.result, 'Could not create the track.'));
                return;
              }
              hideUploadLoader();
              return finishSubmit(next && next.draft ? next.draft : (created.draft || nextDraft), releaseDate, trigger, nextHref);
            }).catch(function (err) {
              hideUploadLoader();
              trigger.removeAttribute('aria-busy');
              setStatus('tg-status', (err && err.message) || 'Could not reach catalog.');
            });
          }).catch(function (err) {
            hideUploadLoader();
            trigger.removeAttribute('aria-busy');
            setStatus('tg-status', (err && err.message) || 'Could not reach catalog.');
          });
        }).catch(function (err) {
          trigger.removeAttribute('aria-busy');
          setStatus('tg-status', (err && err.message) || 'Could not reach catalog.');
        });
      });
    }

    var draft = readDraft();
    var dateEl = $('tg-release-date');
    var readyDate = bindReleaseDatePicker(dateEl);
    if (readyDate !== String(draft.release_date || '').trim()) {
      draft = writeDraft({ release_date: readyDate });
    }
    bindReleaseSchedule();
    var back = document.querySelector('.flow-actions a[href="split-sheet.html"]');
    if (back && isSoloOwned(draft)) back.setAttribute('href', 'attest.html');
    if (documentIdOf(draft) && !isSoloOwned(draft) && typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('focus', function () { refreshSignWellDraft(readDraft()); });
      if (document.addEventListener) {
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) refreshSignWellDraft(readDraft());
        });
      }
    }
    if (trigger) {
      markIncomplete(trigger, !String(readyDate || '').trim());
      if (dateEl && dateEl.addEventListener) {
        var syncPickedDate = function (event) {
          var ignoreEmpty = Boolean(event && event.type === 'input');
          var picked = persistReleaseDate(dateEl, { ignoreEmpty: ignoreEmpty, snapIfEmpty: true });
          if ($('tg-preorder-on') || $('tg-time-on')) collectReleaseSchedule();
          markIncomplete(trigger, !picked);
        };
        dateEl.addEventListener('input', syncPickedDate);
        dateEl.addEventListener('change', syncPickedDate);
      }
    }
    if (draft.release_id && !draft.submitted && String(readyDate || '').trim() && (documentIdOf(draft) || isSoloOwned(draft))) {
      setStatus('tg-status', 'Checking SignWell…');
      finishSubmit(draft, readyDate, trigger, null).then(function () {
        /* stay on review after auto-submit so the exact store status is visible */
      }).catch(function () {
        setStatus('tg-status', 'Could not reach catalog.');
      });
    }
  }

  function fillReviewSummary() {
    var titleEl = document.querySelector('[data-review-title]');
    var metaEl = document.querySelector('[data-review-meta]');
    if (!titleEl && !metaEl) return;
    var draft = readDraft();
    if (titleEl && draft.title) titleEl.textContent = draft.title;
    if (metaEl && draft.name) {
      metaEl.textContent = draft.genre
        ? draft.name + ' · Single · ' + draft.genre
        : draft.name + ' · Single';
    }
    var lyricsBox = document.querySelector('[data-review-lyrics]');
    var lyricsTextEl = document.querySelector('[data-review-lyrics-text]');
    var lyricsCopy = '';
    if (!draft.instrumental) {
      if (draft.type === 'album' && Array.isArray(draft.tracks)) {
        lyricsCopy = draft.tracks.map(function (track, i) {
          var text = lyricsText(track && track.lyrics).trim();
          if (!text) return '';
          return (track.title || ('Track ' + (i + 1))) + '\n' + text;
        }).filter(Boolean).join('\n\n');
      } else {
        lyricsCopy = lyricsText(draft.lyrics).trim();
      }
    }
    if (lyricsTextEl) lyricsTextEl.textContent = lyricsCopy;
    setHiddenEl(lyricsBox, !lyricsCopy);
  }

  function submittedStoreCopy(draft) {
    var slugs = draft && Array.isArray(draft.dsps) ? draft.dsps : [];
    var total = Number(draft && draft.dsps_total) || 0;
    var allOn = !draft || draft.dsps_all !== false;
    if (typeof PlaigroundStorePick !== 'undefined' && PlaigroundStorePick.formatSubmitted) {
      return PlaigroundStorePick.formatSubmitted(slugs.length, total, allOn);
    }
    if (allOn || (total > 0 && slugs.length >= total)) {
      return (total || slugs.length) ? 'All ' + (total || slugs.length) + ' stores' : '';
    }
    if (total > 0) return slugs.length + ' of ' + total + ' stores';
    return slugs.length ? slugs.length + ' stores' : '';
  }

  function paintSubmittedStores(draft) {
    var el = document.querySelector('[data-submit-stores]');
    if (!el) return;
    var copy = submittedStoreCopy(draft);
    if (copy) el.textContent = copy;
  }

  function fillSubmitted() {
    var titleEl = document.querySelector('[data-submit-title]');
    if (!titleEl) return;
    var draft = readDraft();
    if (draft.title) titleEl.textContent = draft.title + ' is in the queue.';
    if (draft.tonegrid_status) setStatus('tg-status', 'Store status: ' + draft.tonegrid_status);
    var view = document.querySelector('a[href="song.html"]');
    if (view && draft.release_id) view.setAttribute('href', 'song.html?id=' + encodeURIComponent(draft.release_id));
    paintSubmittedStores(draft);
    if (document.querySelector('[data-submit-stores]') && !Number(draft.dsps_total)) {
      getJson('/api/tonegrid/stores').then(function (result) {
        var stores = (result.ok && result.data && result.data.stores) || [];
        if (!stores.length) return;
        paintSubmittedStores(writeDraft({ dsps_total: stores.length }));
      }).catch(function () {});
    }
  }

  function bindSubmitted() {
    fillSubmitted();
    if (!document.querySelector('[data-submit-title]')) return;
    var draft = readDraft();
    if (!draft.artist_id || !draft.title) return;
    var afterCreate = function (nextDraft) {
      if (nextDraft.submitted) return;
      if (!documentIdOf(nextDraft) && !isSoloOwned(nextDraft)) {
        setStatus('tg-status', 'Create the split sheet before submitting.');
        return;
      }
      return submitRelease(nextDraft, nextDraft.release_date || '').then(function (sent) {
        if (sent.recover) {
          setStatus('tg-status', createErrorMessage(sent.result, recoverUploadMessage()));
          return;
        }
        if (sent.unsigned || sent.trial || sent.failed) {
          setStatus('tg-status', createErrorMessage(sent.result, 'Could not submit the release.'));
          return;
        }
        if (sent.submitted) setStatus('tg-status', 'Store status: ' + ((sent.result && sent.result.data && sent.result.data.status) || 'pending'));
      });
    };
    if (draft.release_id) {
      afterCreate(draft);
      return;
    }
    setStatus('tg-status', 'Creating release…');
    createRelease(draft, draft.release_date || '').then(function (created) {
      if (created.unavailable) {
        setStatus('tg-status', 'Catalog sync is not configured yet.');
        return;
      }
      if (created.limited) {
        setStatus('tg-status', createErrorMessage(created.result, 'Basic includes one release. Upgrade to Creator or Pro to upload more.'));
        showUpgrade(true);
        return;
      }
      if (created.failed) {
        setStatus('tg-status', created.result.data.error || 'Could not create release.');
        showUpgrade(false);
        return;
      }
      showUploadLoader('Creating track');
      return afterRelease(created.draft || draft).then(function (next) {
        if (next && next.failed) {
          hideUploadLoader();
          setStatus('tg-status', (next.result && next.result.data && next.result.data.error) || 'Could not create the track.');
          return;
        }
        hideUploadLoader();
        return afterCreate(next && next.draft ? next.draft : (created.draft || draft));
      }).catch(function (err) {
        hideUploadLoader();
        setStatus('tg-status', (err && err.message) || 'Could not reach catalog.');
      });
    }).catch(function (err) {
      hideUploadLoader();
      setStatus('tg-status', (err && err.message) || 'Could not reach catalog.');
    });
  }

  bindUpload();
  bindReview();
  fillReviewSummary();
  bindSubmitted();
})();
