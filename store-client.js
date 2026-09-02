(function () {
  var ARTISTS_URL = '/api/tonegrid/artists';
  var RELEASES_URL = '/api/tonegrid/releases';
  var TRACKS_URL = '/api/tonegrid/tracks';
  var DRAFT_KEY = 'plaiground.store.draft';
  var MAX_AUDIO_BYTES = 200 * 1024 * 1024;
  var PLATFORM_AUDIO_BYTES = Math.floor(4.2 * 1024 * 1024);
  var AUDIO_CHUNK_BYTES = 3 * 1024 * 1024;
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

  function isNewReleaseStart() {
    try {
      return new URLSearchParams((typeof location !== 'undefined' && location.search) || '').get('new') === '1';
    } catch (err) {
      return false;
    }
  }

  function clearHeldAudio() {
    heldAudioFile = null;
    heldPickedFile = null;
    heldArtworkFile = null;
    try {
      if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
        indexedDB.deleteDatabase(AUDIO_HOLD_DB);
      }
    } catch (err) {}
  }

  function clearNewReleaseDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (err) {}
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (err) {}
    clearHeldAudio();
  }

  function confirmCancelInProgress() {
    var ok = true;
    try {
      if (typeof window.confirm === 'function') {
        ok = window.confirm('Cancel this upload? This loses the in-progress info.');
      }
    } catch (err) {
      ok = true;
    }
    return ok;
  }

  function leaveAfterCancel(href) {
    clearNewReleaseDraft();
    try {
      if (typeof location !== 'undefined') location.href = href;
    } catch (err) {}
    return true;
  }

  function cancelInProgressUpload(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!confirmCancelInProgress()) return false;
    return leaveAfterCancel('upload.html?new=1');
  }

  function cancelInProgressSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!confirmCancelInProgress()) return false;
    return leaveAfterCancel('dashboard.html');
  }

  function stripNewReleaseFlag() {
    try {
      if (!isNewReleaseStart() || !window.history || !window.history.replaceState) return;
      var url = 'upload.html';
      try {
        var params = new URLSearchParams(location.search || '');
        params.delete('new');
        var keep = params.toString();
        var path = String((location.pathname || 'upload.html').split('/').pop() || 'upload.html');
        url = keep ? (path + '?' + keep) : path;
      } catch (err) {}
      window.history.replaceState({}, '', url);
    } catch (err) {}
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

  var AUDIO_SIZE_COPY = 'Audio must be 200 MB or smaller.';
  var AUDIO_SEND_COPY = 'We could not send the audio.';

  function isPlatformPayloadError(text, status) {
    if (status === 413) return true;
    return /request entry too large|request entity too large|payload too large|function_payload_too_large|content too large/i.test(String(text || ''));
  }

  function isSizeCapError(text) {
    return /audio must be 200\s*mb or smaller/i.test(String(text || ''));
  }

  var STEP_FAIL_COPY = 'We could not finish this step.';
  var ARTIST_GONE_COPY = 'We could not create that artist. Try the name again.';

  function isArtistGoneError(text) {
    var raw = String(text || '').toLowerCase();
    return /not found in this tenant/.test(raw)
      || /artist not found/.test(raw)
      || /could not create that artist/.test(raw)
      || (/\btenant\b/.test(raw) && /artist/.test(raw));
  }

  function isIdempotencyReuseError(text) {
    var raw = String(text || '');
    return /idempotency[- ]key/i.test(raw)
      || /reused with a different request body/i.test(raw)
      || (/rotate the key/i.test(raw) && /request body/i.test(raw));
  }

  function originalOverRealCap() {
    var draft = readDraft() || {};
    var picked = Number(draft.audio_picked_size) || 0;
    if (picked > MAX_AUDIO_BYTES) return true;
    if (heldPickedFile && Number(heldPickedFile.size) > MAX_AUDIO_BYTES) return true;
    return false;
  }

  function platformPayloadCopy() {
    return originalOverRealCap() ? AUDIO_SIZE_COPY : AUDIO_SEND_COPY;
  }

  function classifyStoreFailure(result, err) {
    var status = result && result.status;
    var text = '';
    if (result && result.data) text = result.data.error || result.data.message || '';
    if (!text && err) text = err.message || '';
    if ((err && err.timedOut) || (result && result.timedOut) || isHangStatus(status)) return 'timeout';
    if (isSizeCapError(text) || (status === 413 && originalOverRealCap())) return 'size_cap';
    if (status === 413 || isPlatformPayloadError(text, status)) return 'platform_payload';
    if (isIdempotencyReuseError(text)) return 'idempotency';
    if (result && isMissingTrackError(result)) return 'leftover_id';
    if (status >= 500) return 'sandbox_5xx';
    if (!result || status === 0) return 'hop';
    return 'other';
  }

  function noteStoreFailure(result, err) {
    var row = {
      status: result && result.status != null ? Number(result.status) : 0,
      class: classifyStoreFailure(result, err),
      timedOut: Boolean((result && result.timedOut) || (err && err.timedOut)),
    };
    try {
      if (typeof window !== 'undefined') window.PlaigroundLastStoreFailure = row;
    } catch (ignore) {}
    return row;
  }

  function sanitizePartnerCopy(text, status) {
    var next = humanErrorText(text, '');
    if (isPlatformPayloadError(next, status)) return platformPayloadCopy();
    if (isSizeCapError(next)) return AUDIO_SIZE_COPY;
    if (isIdempotencyReuseError(next)) return STEP_FAIL_COPY;
    if (isArtistGoneError(next) || /\btenant\b/i.test(next)) {
      var named = readDraft();
      if (named && String(named.plaiground_artist_id || '').trim() && String(named.name || '').trim()) {
        return STEP_FAIL_COPY;
      }
      return ARTIST_GONE_COPY;
    }
    if (/we could not send the audio/i.test(next)) return AUDIO_SEND_COPY;
    next = next.replace(/\bthe\s+ToneGrid\b/gi, 'the store');
    next = next.replace(/ToneGrid/gi, 'the store');
    next = next.replace(/\bCloudflare\b/gi, 'the store');
    next = next.replace(/\bInterSpace\b/gi, 'the store');
    next = next.replace(/\bR2\b/g, 'the store');
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
      || asId(payload.release_uuid)
      || asId(payload.artist && (payload.artist.uuid || payload.artist.id))
      || asId(payload.release && (payload.release.uuid || payload.release.id))
      || asId(payload.track && (payload.track.uuid || payload.track.id))
      || asId(payload.data && payload.data.uuid)
      || asId(payload.data && payload.data.id)
      || asId(payload.data && payload.data.release_uuid)
      || asId(payload.data && payload.data.artist && (payload.data.artist.uuid || payload.data.artist.id))
      || asId(payload.data && payload.data.release && (payload.data.release.uuid || payload.data.release.id))
      || asId(payload.data && payload.data.track && (payload.data.track.uuid || payload.data.track.id));
  }

  function parseJson(response) {
    return response.json().then(function (data) {
      var next = data || {};
      if (isPlatformPayloadError(next.error || next.message, response.status)) {
        next.error = platformPayloadCopy();
      } else if (isSizeCapError(next.error || next.message)) {
        next.error = AUDIO_SIZE_COPY;
      } else if (isIdempotencyReuseError(next.error || next.message)) {
        next.error = STEP_FAIL_COPY;
      }
      return { ok: response.ok, status: response.status, data: next };
    }).catch(function () {
      var fallback = {};
      if (isPlatformPayloadError('', response.status)) fallback.error = platformPayloadCopy();
      return { ok: false, status: response.status, data: fallback };
    });
  }

  var DEFAULT_CATALOG_TIMEOUT_MS = 30000;
  var AUDIO_POST_TIMEOUT_MS = 90000;

  function catalogTimeoutMs() {
    try {
      if (typeof window !== 'undefined' && window.PlaigroundCatalogTimeoutMs != null) {
        var n = Number(window.PlaigroundCatalogTimeoutMs);
        if (n > 0 && isFinite(n)) return n;
      }
    } catch (err) {}
    return DEFAULT_CATALOG_TIMEOUT_MS;
  }

  function audioPostTimeoutMs() {
    try {
      if (typeof window !== 'undefined' && window.PlaigroundAudioTimeoutMs != null) {
        var n = Number(window.PlaigroundAudioTimeoutMs);
        if (n > 0 && isFinite(n)) return n;
      }
      if (typeof window !== 'undefined' && window.PlaigroundCatalogTimeoutMs != null) {
        return catalogTimeoutMs();
      }
    } catch (err) {}
    return AUDIO_POST_TIMEOUT_MS;
  }

  function waitMsForUrl(url) {
    return /\/audio(?:\?|$)/i.test(String(url || '')) ? audioPostTimeoutMs() : catalogTimeoutMs();
  }

  function hopApi() {
    try {
      if (typeof PlaigroundObjectHop !== 'undefined' && PlaigroundObjectHop) return PlaigroundObjectHop;
    } catch (err) {}
    if (typeof window !== 'undefined' && window && window.PlaigroundObjectHop) return window.PlaigroundObjectHop;
    return null;
  }

  function hopFile(kind, file, onProgress) {
    var api = hopApi();
    if (!api || typeof api.put !== 'function' || !file) {
      return Promise.resolve({ failed: true, result: { data: { error: kind === 'audio' ? AUDIO_SEND_COPY : STEP_FAIL_COPY } } });
    }
    return api.put(kind, file, { onProgress: onProgress }).then(function (key) {
      if (!key) return { failed: true, result: { data: { error: kind === 'audio' ? AUDIO_SEND_COPY : STEP_FAIL_COPY } } };
      return { object_key: key };
    }).catch(function (err) {
      return { failed: true, result: (err && err.result) || { data: { error: kind === 'audio' ? AUDIO_SEND_COPY : STEP_FAIL_COPY } } };
    });
  }

  function reuseHopKey(kind, file, draft) {
    if (!file || !draft) return '';
    if (kind === 'audio' && draft.audio_object_key && draft.audio_name === file.name && Number(draft.audio_hop_size) === Number(file.size)) {
      return String(draft.audio_object_key);
    }
    if (kind === 'cover' && draft.artwork_object_key && draft.artwork_name === file.name && Number(draft.artwork_size) === Number(file.size)) {
      return String(draft.artwork_object_key);
    }
    return '';
  }

  function catalogTimeoutMessage() {
    return 'We could not reach the store. Try again.';
  }

  function rememberPickedOriginal(file) {
    if (!file || looksLikeWav(file)) return;
    heldPickedFile = file;
    writeDraft({
      audio_picked_size: Number(file.size) || Number((readDraft() || {}).audio_picked_size) || 0,
      audio_picked_name: file.name || (readDraft() || {}).audio_picked_name || '',
    });
    persistPickedAudio(file);
  }

  function rememberPickedAudio(file) {
    if (!file) return;
    var draft = readDraft();
    var convertedWav = alreadyConverted(draft) && looksLikeWav(file);
    if (!convertedWav) {
      writeDraft({
        audio_picked_size: Number(file.size) || 0,
        audio_picked_name: file.name || '',
      });
      if (!looksLikeWav(file)) rememberPickedOriginal(file);
    }
    if (alreadyConverted(draft) && looksLikeWav(heldAudioFile) && !looksLikeWav(file)) {
      rememberPickedOriginal(file);
      return;
    }
    rememberAudioFile(file);
  }

  function measuredAudioBytes(file) {
    var draft = readDraft() || {};
    var picked = Number(draft.audio_picked_size) || 0;
    if (alreadyConverted(draft) && looksLikeWav(file)) return picked;
    if (file && file.size != null && isFinite(Number(file.size))) return Number(file.size);
    return picked;
  }

  function audioOverRealCap(file) {
    return Boolean(file) && measuredAudioBytes(file) > MAX_AUDIO_BYTES;
  }

  function isHangStatus(status) {
    return status === 0 || status === 502 || status === 504 || status === 524;
  }

  function isNoStoreResponse(result, err) {
    if (err && (err.timedOut === true || /did not respond|could not reach|timed out/i.test(String(err.message || '')))) {
      return true;
    }
    if (!result) return Boolean(err);
    if (result.timedOut === true) return true;
    if (isHangStatus(result.status)) return true;
    return false;
  }

  function withCatalogTimeout(work, timeoutMs) {
    var ms = Number(timeoutMs);
    if (!(ms > 0 && isFinite(ms))) ms = catalogTimeoutMs();
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
    }, waitMsForUrl(url));
  }

  function getJson(url) {
    return withCatalogTimeout(function () {
      return fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }).then(parseJson);
    }).catch(function (err) {
      if (isNoStoreResponse(null, err)) return storeUnreachableResult();
      return { ok: false, status: 0, data: { error: catalogTimeoutMessage() } };
    });
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

  function openNativeDatePicker(dateEl) {
    if (!dateEl || dateEl.disabled || typeof dateEl.showPicker !== 'function') return;
    try {
      dateEl.showPicker();
    } catch (err) {
      /* Safari throws if the sheet is already open or the call is not from a gesture. */
    }
  }

  function bindNativeDatePicker(dateEl) {
    if (!dateEl || !dateEl.addEventListener) return dateEl;
    if (dateEl.type !== 'time') {
      dateEl.type = 'date';
      if (dateEl.setAttribute) dateEl.setAttribute('type', 'date');
    }
    dateEl.addEventListener('click', function () {
      openNativeDatePicker(dateEl);
    });
    return dateEl;
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
    bindNativeDatePicker(dateEl);
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
      bindNativeDatePicker(preorderEl);
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

  function draftHasTrackFile(draft) {
    if (selectedAudio() || fileForStoreUpload(selectedAudio())) return true;
    if (alreadyConverted(draft) || alreadyUploaded(draft) || draftHasTrackId(draft)) return true;
    if (draft && (draft.audio_name || draft.audio_attached || draft.audio_picked_name || Number(draft.audio_picked_size) > 0)) return true;
    var rows = albumRowsForSubmit(draft);
    for (var i = 0; i < rows.length; i += 1) {
      var track = rows[i] || {};
      if (track.audio || track.file || track.audio_name || track.audio_uploaded || track.track_id || track.audio_attached) return true;
    }
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

  function attachFailedMessage() {
    return 'Could not attach the audio. Retry.';
  }

  function keepHeldWavForRetry() {
    if (!looksLikeWav(heldAudioFile)) return;
    writeDraft({ audio_uploaded: false });
    if (heldPickedFile) persistPickedAudio(heldPickedFile);
    persistHeldAudio(heldAudioFile);
  }

  function hideMissingTrackFailure(sent, draft, liveFile) {
    if (liveFile || draftHasTrackFile(draft) || alreadyConverted(draft)) {
      return {
        failed: true,
        result: { data: { error: attachFailedMessage() } },
        draft: draft,
      };
    }
    return sent;
  }

  function firstStoreTrackId(tracks) {
    var i;
    for (i = 0; i < (tracks || []).length; i += 1) {
      var id = trackIdOf(tracks[i]);
      if (id) return id;
    }
    return '';
  }

  function trackIdOnStore(id, tracks) {
    var want = String(id || '').trim();
    if (!want) return '';
    var i;
    for (i = 0; i < (tracks || []).length; i += 1) {
      if (sameUuid(trackIdOf(tracks[i]), want)) return want;
    }
    return '';
  }

  function flagOn(value) {
    return value === true || value === 'true';
  }

  function alreadyUploaded(draft) {
    if (!draft) return false;
    if (String(draft.type || '') === 'album') return false;
    return flagOn(draft.audio_uploaded);
  }

  function alreadyConverted(draft) {
    if (!draft) return false;
    return flagOn(draft.audio_converted) || alreadyUploaded(draft);
  }

  function alreadyHasAudio(draft) {
    return alreadyUploaded(draft);
  }

  function looksLikeWav(file) {
    if (!file) return false;
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    return /\.wav$/i.test(name) || /audio\/(x-)?wav|audio\/wave/.test(type);
  }

  function leftoverHopFile(file) {
    var held = fileFromHeld(heldAudioFile);
    var live = fileFromHeld(file);
    var picked = fileFromHeld(heldPickedFile);
    if (picked && Number(picked.size) > 0 && !looksLikeWav(picked)) return picked;
    if (live && Number(live.size) > 0 && !looksLikeWav(live)) return live;
    if (held && Number(held.size) > 0 && !looksLikeWav(held)) return held;
    if (picked && Number(picked.size) > 0) return picked;
    if (live && Number(live.size) > 0) return live;
    if (held && Number(held.size) > 0) return held;
    return selectedAudio() || null;
  }

  function fileForStoreUpload(file) {
    var draft = readDraft();
    var held = fileFromHeld(heldAudioFile);
    if (alreadyUploaded(draft)) return null;
    if (looksLikeWav(held) && (alreadyConverted(draft) || !file || isMp3File(file))) {
      return held;
    }
    if (!file) return held || null;
    if (alreadyConverted(draft) && isMp3File(file) && !looksLikeWav(file)) {
      return looksLikeWav(held) ? held : null;
    }
    return fileFromHeld(file) || file;
  }

  function pickedOriginalFile(file) {
    if (heldPickedFile && !looksLikeWav(heldPickedFile)) return heldPickedFile;
    if (file && !looksLikeWav(file)) return file;
    var input = document.querySelector('[data-audio-input]');
    var live = (input && input.files && input.files[0]) || (input && input._plaigroundFile) || null;
    if (live && !looksLikeWav(live)) return live;
    return null;
  }

  function fileForTransitUpload(file) {
    if (file && !looksLikeWav(file)) {
      return leftoverHopFile(file) || fileFromHeld(file) || file;
    }
    return fileForStoreUpload(file) || file || heldAudioFile;
  }

  function needsAudioUpload(draft, file) {
    if (alreadyUploaded(draft)) return false;
    return Boolean(fileForStoreUpload(file));
  }

  function isAudioRequiredError(value) {
    return /audio file is required/i.test(String(value || ''));
  }

  function audioRequiredResult(source) {
    var msg = '';
    if (source && source.result && source.result.data) msg = source.result.data.error;
    else if (source && source.data) msg = source.data.error;
    else if (source && source.message) msg = source.message;
    return isAudioRequiredError(msg);
  }

  function persistFoundTracks(draft, tracks) {
    var ordered = tracks || [];
    var prefer = preferLeftoverTrack(ordered);
    if (prefer) {
      ordered = [prefer].concat(ordered.filter(function (row) {
        return !sameUuid(trackIdOf(row), trackIdOf(prefer));
      }));
    }
    var ids = [];
    ordered.forEach(function (row) {
      var id = trackIdOf(row);
      if (id) ids.push(id);
    });
    if (!ids.length) return draft;
    var patch = {};
    if (!draft.track_id) patch.track_id = ids[0];
    if (draft.type !== 'album' && flagOn(draft.audio_uploaded)) patch.audio_uploaded = true;
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
  var sessionReleaseTracks = [];
  var sessionReleaseTracksListed = false;
  var deadReleaseIds = [];
  var heldAudioFile = null;
  var heldPickedFile = null;
  var heldArtworkFile = null;
  var AUDIO_HOLD_DB = 'plaiground-held-audio';
  var AUDIO_HOLD_STORE = 'files';
  var AUDIO_HOLD_KEY = 'master';
  var AUDIO_PICKED_KEY = 'picked';
  var ARTWORK_HOLD_KEY = 'cover';
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

  function unmarkDeadRelease(id) {
    var next = String(id || '').trim();
    if (!next) return;
    deadReleaseIds = deadReleaseIds.filter(function (have) {
      return !sameUuid(have, next);
    });
  }

  function isHeldRecord(value) {
    return Boolean(value && value.__held === 1 && (value.buffer || Number(value.size) > 0));
  }

  function cloneForHold(file) {
    if (!file) return Promise.resolve(null);
    if (isHeldRecord(file)) return Promise.resolve(file);
    if (typeof file.arrayBuffer !== 'function') return Promise.resolve(file);
    return Promise.resolve().then(function () {
      return file.arrayBuffer();
    }).then(function (buf) {
      if (!buf || !buf.byteLength) return file;
      return {
        __held: 1,
        name: file.name || '',
        type: file.type || '',
        lastModified: file.lastModified || Date.now(),
        size: buf.byteLength,
        buffer: buf,
      };
    }).catch(function () {
      return file;
    });
  }

  function heldFallbackType(value) {
    if (value && value.type) return value.type;
    if (value && /\.(jpe?g|png)$/i.test(value.name || '')) return 'image/jpeg';
    return 'audio/wav';
  }

  function heldFallbackName(value) {
    if (value && value.name) return value.name;
    return heldFallbackType(value).indexOf('image/') === 0 ? 'cover.jpg' : 'audio.wav';
  }

  function fileFromHeld(value) {
    if (!value) return null;
    if (isHeldRecord(value)) {
      var mime = heldFallbackType(value);
      var label = heldFallbackName(value);
      if (typeof Blob === 'function' && value.buffer) {
        try {
          var blob = new Blob([value.buffer], { type: mime });
          if (typeof File === 'function') {
            return new File([blob], label, {
              type: mime,
              lastModified: value.lastModified || Date.now(),
            });
          }
          blob.name = label;
          return blob;
        } catch (err) {}
      }
      return {
        name: label,
        type: mime,
        size: value.size || (value.buffer && value.buffer.byteLength) || 0,
        buffer: value.buffer,
      };
    }
    if (value && value.size === 0 && value.buffer) {
      return fileFromHeld({
        __held: 1,
        name: value.name,
        type: value.type,
        lastModified: value.lastModified,
        size: value.buffer.byteLength || 0,
        buffer: value.buffer,
      });
    }
    return value;
  }

  function rememberAudioFile(file) {
    if (!file) return Promise.resolve(null);
    heldAudioFile = fileFromHeld(file) || file;
    return persistHeldAudio(heldAudioFile);
  }

  function persistHeldSlot(file, key, assign) {
    return cloneForHold(file).then(function (stored) {
      var live = (file && Number(file.size) > 0 ? file : null) || fileFromHeld(stored) || file;
      if (live && typeof assign === 'function') assign(live);
      return new Promise(function (resolve) {
        if (!stored && !live) {
          resolve(null);
          return;
        }
        try {
          if (typeof indexedDB === 'undefined' || !indexedDB.open) {
            resolve(live || stored);
            return;
          }
          var req = indexedDB.open(AUDIO_HOLD_DB, 1);
          req.onerror = function () { resolve(live || stored); };
          req.onupgradeneeded = function () {
            if (req.result && !req.result.objectStoreNames.contains(AUDIO_HOLD_STORE)) {
              req.result.createObjectStore(AUDIO_HOLD_STORE);
            }
          };
          req.onsuccess = function () {
            try {
              var tx = req.result.transaction(AUDIO_HOLD_STORE, 'readwrite');
              tx.oncomplete = function () { resolve(live || stored); };
              tx.onerror = function () { resolve(live || stored); };
              tx.onabort = function () { resolve(live || stored); };
              tx.objectStore(AUDIO_HOLD_STORE).put(stored || live, key);
            } catch (err) {
              resolve(live || stored);
            }
          };
        } catch (err) {
          resolve(live || stored);
        }
      });
    });
  }

  function persistHeldAudio(file) {
    var ready = file || heldAudioFile;
    if (ready) heldAudioFile = ready;
    return persistHeldSlot(ready, AUDIO_HOLD_KEY, function (next) { heldAudioFile = next; });
  }

  function persistPickedAudio(file) {
    var ready = file || heldPickedFile;
    if (ready) heldPickedFile = ready;
    return persistHeldSlot(ready, AUDIO_PICKED_KEY, function (next) { heldPickedFile = next; });
  }

  function persistHeldArtwork(file) {
    var ready = file || heldArtworkFile;
    if (ready) heldArtworkFile = ready;
    return persistHeldSlot(ready, ARTWORK_HOLD_KEY, function (next) { heldArtworkFile = next; });
  }

  function rememberArtworkFile(file) {
    if (!file) return Promise.resolve(null);
    heldArtworkFile = fileFromHeld(file) || file;
    return persistHeldArtwork(heldArtworkFile);
  }

  function restoreHeldAudio() {
    return new Promise(function (resolve) {
      function done() {
        if (!heldPickedFile) {
          var input = document.querySelector('[data-audio-input]');
          var live = (input && input.files && input.files[0]) || (input && input._plaigroundFile) || null;
          if (live && !looksLikeWav(live)) rememberPickedOriginal(live);
        }
        if (!heldArtworkFile) {
          var artInput = document.querySelector('[data-art-input]');
          var art = (artInput && artInput.files && artInput.files[0]) || (artInput && artInput._plaigroundFile) || null;
          if (art) rememberArtworkFile(art);
        }
        resolve(heldAudioFile || null);
      }
      if (heldAudioFile && heldPickedFile && heldArtworkFile) {
        resolve(heldAudioFile);
        return;
      }
      try {
        if (typeof indexedDB === 'undefined' || !indexedDB.open) {
          done();
          return;
        }
        var req = indexedDB.open(AUDIO_HOLD_DB, 1);
        req.onerror = function () { done(); };
        req.onupgradeneeded = function () {
          if (req.result && !req.result.objectStoreNames.contains(AUDIO_HOLD_STORE)) {
            req.result.createObjectStore(AUDIO_HOLD_STORE);
          }
        };
        req.onsuccess = function () {
          try {
            var tx = req.result.transaction(AUDIO_HOLD_STORE, 'readonly');
            var store = tx.objectStore(AUDIO_HOLD_STORE);
            var getMaster = store.get(AUDIO_HOLD_KEY);
            var getPicked = store.get(AUDIO_PICKED_KEY);
            var getCover = store.get(ARTWORK_HOLD_KEY);
            var pending = 3;
            function takeHeld(got, slot) {
              var next = fileFromHeld(got);
              if (!next) return;
              if (slot === 'picked') {
                if (!heldPickedFile || !heldPickedFile.size) heldPickedFile = next;
                return;
              }
              if (slot === 'cover') {
                if (!heldArtworkFile || !heldArtworkFile.size) heldArtworkFile = next;
                return;
              }
              if (!heldAudioFile || !heldAudioFile.size) heldAudioFile = next;
            }
            function one() {
              pending -= 1;
              if (pending <= 0) done();
            }
            takeHeld(getMaster.result, 'master');
            takeHeld(getPicked.result, 'picked');
            takeHeld(getCover.result, 'cover');
            getMaster.onerror = one;
            getPicked.onerror = one;
            getCover.onerror = one;
            getMaster.onsuccess = function () {
              takeHeld(getMaster.result, 'master');
              one();
            };
            getPicked.onsuccess = function () {
              takeHeld(getPicked.result, 'picked');
              one();
            };
            getCover.onsuccess = function () {
              takeHeld(getCover.result, 'cover');
              one();
            };
          } catch (err) {
            done();
          }
        };
      } catch (err) {
        done();
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

  function releaseArtistNameOf(data) {
    if (!data || typeof data !== 'object') return '';
    if (typeof data.artist === 'string' && data.artist.trim()) return String(data.artist).trim();
    if (data.artist && data.artist.name) return String(data.artist.name).trim();
    if (data.artist_name) return String(data.artist_name).trim();
    if (data.release && typeof data.release.artist === 'string') return String(data.release.artist).trim();
    if (data.release && data.release.artist && data.release.artist.name) {
      return String(data.release.artist.name).trim();
    }
    if (data.data && typeof data.data.artist === 'string') return String(data.data.artist).trim();
    return '';
  }

  function releaseArtistIdOf(data) {
    if (!data || typeof data !== 'object') return '';
    var candidates = [
      data.artist_id,
      data.artist_uuid,
      data.artist && (data.artist.uuid || data.artist.id || data.artist.artist_id),
      data.release && (data.release.artist_id || data.release.artist_uuid),
      data.release && data.release.artist && (data.release.artist.uuid || data.release.artist.id),
    ];
    var i;
    for (i = 0; i < candidates.length; i += 1) {
      var id = String(candidates[i] || '').trim();
      if (isUuidValue(id)) return id;
    }
    return '';
  }

  function livingReleaseArtistConflicts(draft, data) {
    var wantId = String((draft && draft.artist_id) || '').trim();
    var gotId = releaseArtistIdOf(data);
    if (wantId && gotId && !sameUuid(wantId, gotId)) return true;
    var wantName = String((draft && draft.name) || '').trim();
    var gotName = releaseArtistNameOf(data);
    if (wantName && gotName && !sameSongText(wantName, gotName)) return true;
    return false;
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
    unmarkDeadRelease(living.id);
    rememberSessionRelease(living.id, true, living.tracks || [], true);
    var trackId = '';
    if (living.tracks && living.tracks.length) {
      trackId = trackIdOf(preferLeftoverTrack(living.tracks)) || trackIdOf(living.tracks[0]);
    }
    var next = writeDraft({
      release_id: living.id,
      track_id: trackId || draft.track_id || '',
      audio_uploaded: Boolean(draft.audio_uploaded),
      audio_attached: Boolean(draft.audio_attached || draft.audio_name || (living.tracks && living.tracks.length)),
      replaced_release_id: '',
    });
    if (living.tracks && living.tracks.length) next = persistFoundTracks(next, living.tracks);
    return next;
  }

  function adoptCandidateIds(draft, skipId) {
    var seen = {};
    var out = [];
    function add(id) {
      var n = String(id || '').trim();
      if (!isUuidValue(n)) return;
      if (sameUuid(n, skipId) || isProtectedCatalogRelease(n)) return;
      if (isKnownDeadRelease(n) && !isKnownAdoptRelease(n)) return;
      var key = n.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(n);
    }
    var i;
    var known = knownAdoptIdsForDraft(draft);
    for (i = 0; i < known.length; i += 1) add(known[i]);
    var catalog = catalogReleaseIds();
    for (i = 0; i < catalog.length; i += 1) add(catalog[i]);
    return out;
  }

  function findLivingSongRelease(draft, skipId) {
    var current = draft || readDraft();
    var ids = adoptCandidateIds(current, skipId);
    if (!ids.length) return Promise.resolve(null);
    var index = 0;
    function next() {
      if (index >= ids.length) return Promise.resolve(null);
      var id = ids[index];
      index += 1;
      return fetchReleaseTracks(id).then(function (loaded) {
        if (!loaded.ok) {
          if (isReleaseMissing(loaded.result) && !isKnownAdoptRelease(id)) markDeadRelease(id);
          return next();
        }
        var data = loaded.data || (loaded.result && loaded.result.data);
        var title = releaseTitleOf(data);
        var want = String((current && current.title) || '').trim();
        if (!want || !title || !sameSongText(title, want)) return next();
        if (isProtectedCatalogRelease(id, title)) return next();
        if (!isAdoptableStoreStatus(releaseStatusOf(data))) return next();
        return {
          id: id,
          tracks: loaded.tracks || [],
          result: loaded.result,
          data: data,
          status: releaseStatusOf(data),
          title: title,
        };
      });
    }
    return next();
  }

  function shouldReattach(draft, hasFile, storeTracks) {
    if (hasFile) return false;
    if (storeTracks && storeTracks.length) return false;
    if (hadAudioEvidence(draft)) return false;
    return pickedAudioEvidence(draft) || Boolean(draft && String(draft.title || '').trim());
  }

  function rememberSessionRelease(id, verified, tracks, listed) {
    var next = String(id || '').trim();
    if (!next) return;
    var same = sameUuid(sessionReleaseId, next) || sameUuid(sessionReleaseChecked, next);
    sessionReleaseId = next;
    sessionReleaseChecked = next;
    if (verified) sessionReleaseVerified = next;
    if (arguments.length >= 3) {
      sessionReleaseTracks = tracks || [];
      sessionReleaseTracksListed = listed === true;
    } else if (!same) {
      sessionReleaseTracks = [];
      sessionReleaseTracksListed = false;
    }
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

  function releaseStatusOf(data) {
    if (!data || typeof data !== 'object') return '';
    if (data.status) return String(data.status);
    if (data.release && data.release.status) return String(data.release.status);
    if (data.data && data.data.status) return String(data.data.status);
    return '';
  }

  function isAdoptableStoreStatus(status) {
    var s = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (!s) return true;
    if (s === 'draft' || s === 'rejected' || s === 'needs_fix') return true;
    if (
      s === 'live'
      || s === 'pending'
      || s === 'pending_review'
      || s === 'processing'
      || s === 'approved'
      || s === 'delivering'
      || s === 'delivered'
      || s === 'qc_inspection'
    ) return false;
    return true;
  }

  var PROTECTED_CATALOG_IDS = [
    'c0102e1c-b62b-4dcf-9fe1-00d063df51a4',
    '6629b532-2e78-4be6-84eb-e4dfa9ac33e5',
    '490b789a-0a33-4372-9d81-665f47b3cbf1',
    '1f26369b-e107-4c79-bde1-4c5382f9d511',
    'df51342b-ba22-4093-93ff-35b6402b61c0',
    '7544eade-ce02-472c-92d0-a5d61609999d',
  ];

  var KNOWN_ADOPT_RELEASES = [
    {
      id: '7a928125-b12e-4609-bd37-26ce0edf819e',
      title: 'Rainbow Road',
      artist: 'Victoria PLAIGROUND',
    },
    {
      id: 'cefce28e-8020-435e-8097-177de07f0c44',
      title: 'FUEGO GODDESS',
      artist: 'Victoria PLAIGROUND',
    },
    {
      id: '0767cb74-c5aa-4b18-8023-729fd4fb2808',
      title: 'I Set the Tone',
      artist: 'VEXA',
    },
  ];

  function isKnownAdoptRelease(id) {
    var nid = String(id || '').trim();
    var i;
    for (i = 0; i < KNOWN_ADOPT_RELEASES.length; i += 1) {
      if (sameUuid(KNOWN_ADOPT_RELEASES[i].id, nid)) return true;
    }
    return false;
  }

  function knownAdoptIdsForDraft(draft) {
    var want = String((draft && draft.title) || '').trim();
    var out = [];
    var i;
    for (i = 0; i < KNOWN_ADOPT_RELEASES.length; i += 1) {
      var row = KNOWN_ADOPT_RELEASES[i];
      if (!sameSongText(row.title, want)) continue;
      out.push(row.id);
    }
    return out;
  }

  var FUEGO_GODDESS_TRACK_IDS = [
    '1f346f71-a70d-4648-bb66-5c5aff5f5243',
    '81e47b6f-6b13-44e6-a436-de81ffaa849f',
  ];

  var PREFERRED_LEFTOVER_TRACK_IDS = FUEGO_GODDESS_TRACK_IDS.concat([
    'afce23fb-aa5f-42ac-94ae-2ce58bf48402',
  ]);

  function fuegoGoddessAdoptId() {
    return 'cefce28e-8020-435e-8097-177de07f0c44';
  }

  function isFuegoGoddessTitle(title) {
    return sameSongText(title, 'FUEGO GODDESS');
  }

  function isFuegoLeftoverRelease(id) {
    return sameUuid(id, fuegoGoddessAdoptId());
  }

  function preferLeftoverTrack(tracks) {
    var preferred = PREFERRED_LEFTOVER_TRACK_IDS;
    var i;
    var j;
    for (i = 0; i < preferred.length; i += 1) {
      for (j = 0; j < (tracks || []).length; j += 1) {
        if (sameUuid(trackIdOf(tracks[j]), preferred[i])) return tracks[j];
      }
    }
    return (tracks && tracks[0]) || null;
  }

  function preferFuegoLeftoverTrack(tracks) {
    return preferLeftoverTrack(tracks);
  }

  function fallbackTracksForKnownTitle(draft) {
    if (sameSongText((draft && draft.title) || '', 'I Set the Tone')) {
      return [{ uuid: 'afce23fb-aa5f-42ac-94ae-2ce58bf48402', title: 'I Set the Tone', status: 'draft' }];
    }
    return [];
  }

  function storeTrackHasAudio(row) {
    if (!row || typeof row !== 'object') return false;
    function present(value) {
      if (value == null || value === false) return false;
      if (typeof value === 'object') {
        return present(value.url || value.key || value.s3 || value.audio_url || value.s3_key);
      }
      return Boolean(String(value).trim());
    }
    return present(row.audio_url)
      || present(row.s3)
      || present(row.s3_key)
      || present(row.s3_url)
      || present(row.audio_s3)
      || present(row.audio_object_key)
      || present(row.object_key)
      || present(row.audio);
  }

  function knownLeftoverNeedsAudioHop(draft, tracks) {
    if (!draft) return false;
    var rows = tracks || [];
    if (!rows.length) return false;
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (storeTrackHasAudio(rows[i])) return false;
    }
    if (String(draft.audio_url || draft.audio_s3_key || '').trim()) return false;
    if (!alreadyUploaded(draft)) return false;
    return Boolean(leftoverHopFile(null) || heldPickedFile || heldAudioFile);
  }

  function leftoverHopFailure(audio, draft) {
    var result = (audio && audio.result) || { ok: false, data: { error: AUDIO_SEND_COPY } };
    if (!result.data) result.data = {};
    var err = String(result.data.error || '');
    if (!err || isAudioRequiredError(err)) result.data.error = AUDIO_SEND_COPY;
    return { failed: true, result: result, draft: draft };
  }

  function hopKnownLeftoverCover(draft) {
    var art = selectedArtwork();
    if (!art && !(draft && draft.artwork_object_key)) return Promise.resolve({ ok: true, draft: draft });
    if (!draft || !draft.release_id) return Promise.resolve({ ok: true, draft: draft });
    return uploadArtwork(draft.release_id, art).then(function (artwork) {
      if (artwork && (artwork.failed || artwork.unavailable)) return artwork;
      return { ok: true, draft: draft };
    });
  }

  function clearStaleLeftoverUploadFlags(draft, send) {
    var next = draft || readDraft();
    var patch = {};
    if (flagOn(next.audio_uploaded)) patch.audio_uploaded = false;
    if (send && !looksLikeWav(send) && flagOn(next.audio_converted)) patch.audio_converted = false;
    return Object.keys(patch).length ? writeDraft(patch) : next;
  }

  function attachKnownLeftoverNow(draft) {
    var current = draft || readDraft();
    var known = knownAdoptIdsForDraft(current);
    if (!known[0]) return null;
    var fallback = fallbackTracksForKnownTitle(current);
    return fetchReleaseTracks(known[0]).then(function (loaded) {
      var found = (loaded.ok && loaded.tracks && loaded.tracks.length) ? loaded.tracks : fallback;
      if (!found.length) found = fallback;
      var adopted = adoptLivingRelease(current, { id: known[0], tracks: found });
      return {
        ok: true,
        created: true,
        found: true,
        draft: adopted,
        tracks: found,
        tracksListed: found.length > 0,
        result: { ok: true, status: 200, data: { uuid: known[0], continued: true, tracks: found } },
      };
    });
  }

  function isProtectedCatalogRelease(id, title) {
    var nid = String(id || '').trim().toLowerCase();
    var i;
    for (i = 0; i < PROTECTED_CATALOG_IDS.length; i += 1) {
      if (sameUuid(PROTECTED_CATALOG_IDS[i], nid)) return true;
    }
    var n = String(title || '').trim().toLowerCase().replace(/,/g, '');
    return n === 'lightning'
      || n === 'thank you dolly'
      || n === 'metete en el groove'
      || n === 'too the moon'
      || n === 'cgi'
      || n === 'vhnjuk';
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
    sessionReleaseTracks = [];
    sessionReleaseTracksListed = false;
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
      release_idempotency_body: '',
      track_idempotency_key: '',
      track_idempotency_body: '',
      audio_uploaded: false,
      audio_converted: false,
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

  var trackKeyNonce = 0;
  function freshTrackKey(draft, position) {
    trackKeyNonce += 1;
    return ('plaiground-track-' + String((draft && draft.release_id) || '') + ':' + String(position || 1) + ':' + String(Date.now()) + ':' + String(trackKeyNonce)).slice(0, 255);
  }

  var rotateIdempotencyOnce = false;

  function stableIdempotencyBody(body) {
    try {
      return JSON.stringify(body || {});
    } catch (err) {
      return '';
    }
  }

  var submitKeyNonce = 0;
  function freshSubmitKey(draft) {
    submitKeyNonce += 1;
    return ('plaiground-submit-' + String((draft && draft.release_id) || '') + ':' + String(Date.now()) + ':' + String(submitKeyNonce)).slice(0, 255);
  }

  function rotateIdempotencyKeys() {
    rotateIdempotencyOnce = true;
    writeDraft({
      release_idempotency_key: '',
      track_idempotency_key: '',
      submit_idempotency_key: '',
      release_idempotency_body: '',
      track_idempotency_body: '',
      submit_idempotency_body: '',
    });
  }

  function takeIdempotencyKey(kind, draft, body, forceRotate) {
    var serialized = stableIdempotencyBody(body);
    var keyField = kind === 'release'
      ? 'release_idempotency_key'
      : kind === 'submit'
        ? 'submit_idempotency_key'
        : 'track_idempotency_key';
    var bodyField = kind === 'release'
      ? 'release_idempotency_body'
      : kind === 'submit'
        ? 'submit_idempotency_body'
        : 'track_idempotency_body';
    var leftover = String((draft && draft[keyField]) || '');
    var lastBody = String((draft && draft[bodyField]) || '');
    var rotate = forceRotate === true
      || rotateIdempotencyOnce
      || !leftover
      || !lastBody
      || lastBody !== serialized;
    var key = leftover;
    if (rotate) {
      key = kind === 'release'
        ? freshReleaseKey(draft)
        : kind === 'submit'
          ? freshSubmitKey(draft)
          : freshTrackKey(draft, body && body.position);
    }
    rotateIdempotencyOnce = false;
    var patch = {};
    patch[keyField] = key;
    patch[bodyField] = serialized;
    writeDraft(patch);
    return key;
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
      release_idempotency_body: '',
      track_idempotency_key: '',
      track_idempotency_body: '',
      audio_uploaded: false,
      audio_converted: false,
      audio_attached: Boolean(current.audio_attached || hadAudioEvidence(current)),
      replaced_release_id: deadId || current.replaced_release_id || '',
      tracks: stored,
    });
    sessionReleaseId = '';
    sessionReleaseChecked = '';
    sessionReleaseVerified = '';
    sessionReleaseTracks = [];
    sessionReleaseTracksListed = false;
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
      var keepTracks = (created.tracks && created.tracks.length) ? created.tracks : sessionReleaseTracks;
      var listed = created.tracksListed === true || sessionReleaseTracksListed === true || Boolean(keepTracks && keepTracks.length);
      if (keepTracks && keepTracks.length) {
        rememberSessionRelease(draft.release_id, true, keepTracks, true);
      } else {
        rememberSessionRelease(draft.release_id);
      }
      if (draft.replaced_release_id) draft = writeDraft({ replaced_release_id: '' });
      return Object.assign({ ok: true }, created, { draft: draft, tracks: keepTracks, tracksListed: listed });
    }
    return {
      failed: true,
      result: created.result || { data: { error: 'Could not create release.' } },
      draft: draft,
    };
  }

  function rosterLocalArtistId(row) {
    if (!row || String(row.id || '') === 'account') return '';
    return String(row.id || row.artist_id || row.plaiground_artist_id || row.uuid || '').trim();
  }

  function rosterStoreArtistId(row) {
    var storeId = String((row && row.tonegrid_artist_id) || '').trim();
    if (!isUuidValue(storeId)) return '';
    if (sameUuid(storeId, rosterLocalArtistId(row))) return '';
    return storeId;
  }

  function isLocalProfileArtistId(id, draft) {
    var want = String(id || '').trim();
    if (!isUuidValue(want)) return false;
    var current = draft || {};
    var pgId = String(current.plaiground_artist_id || '').trim();
    if (pgId && sameUuid(want, pgId)) return true;
    var artists = rosterFromMe();
    var i;
    for (i = 0; i < artists.length; i += 1) {
      var row = artists[i] || {};
      if (String(row.id || '') === 'account') continue;
      var storeId = rosterStoreArtistId(row);
      if (storeId && sameUuid(want, storeId)) return false;
      if (sameUuid(want, row.id) || sameUuid(want, row.artist_id) || sameUuid(want, row.uuid) || sameUuid(want, row.plaiground_artist_id)) {
        return true;
      }
    }
    return false;
  }

  function matchingRosterStoreArtistId(draft) {
    var current = draft || {};
    var artists = rosterFromMe();
    var pgId = String(current.plaiground_artist_id || '').trim();
    var name = String(current.name || '').trim();
    var i;
    for (i = 0; i < artists.length; i += 1) {
      var row = artists[i] || {};
      var storeId = rosterStoreArtistId(row);
      if (String(row.id || '') === 'account') {
        var accountStore = String(row.tonegrid_artist_id || '').trim();
        if (isUuidValue(accountStore) && name && String(row.name || '').toLowerCase() === name.toLowerCase()) {
          return accountStore;
        }
        continue;
      }
      var sameProfile = (pgId && (String(row.id || '') === pgId || String(row.plaiground_artist_id || '') === pgId))
        || (name && String(row.name || '').toLowerCase() === name.toLowerCase());
      if (!sameProfile) continue;
      if (storeId) return storeId;
      return '';
    }
    return '';
  }

  function liveChosenStoreArtistId(artist) {
    if (!artist) return '';
    var id = String(artist.tonegridId || artist.tonegrid_artist_id || '').trim();
    if (!isUuidValue(id)) return '';
    if (isLocalProfileArtistId(id, {
      plaiground_artist_id: artist.id,
      name: artist.name,
    })) return '';
    return id;
  }

  function existingStoreArtistId(draft) {
    var current = draft || {};
    if (String(current.artist_id || '') === 'account' && isUuidValue(current.tonegrid_artist_id)) {
      var accountId = String(current.tonegrid_artist_id).trim();
      return isLocalProfileArtistId(accountId, current) ? '' : accountId;
    }
    var fromRoster = matchingRosterStoreArtistId(current);
    if (fromRoster && !isLocalProfileArtistId(fromRoster, current)) return fromRoster;
    var candidates = [current.tonegrid_artist_id, current.artist_id];
    var liveOnDraft = '';
    var i;
    for (i = 0; i < candidates.length; i += 1) {
      if (isUuidValue(candidates[i]) && !isLocalProfileArtistId(candidates[i], current)) {
        liveOnDraft = String(candidates[i]).trim();
        break;
      }
    }
    if (liveOnDraft && current.tonegrid_artist_id && sameUuid(liveOnDraft, current.tonegrid_artist_id)) {
      return isLocalProfileArtistId(liveOnDraft, current) ? '' : liveOnDraft;
    }
    var artists = rosterFromMe();
    var pgId = String(current.plaiground_artist_id || '').trim();
    var name = String(current.name || '').trim();
    var profileNeedsCreate = Boolean(pgId) || artists.some(function (row) {
      if (!row || String(row.id || '') === 'account') return false;
      var sameProfile = (pgId && (String(row.id || '') === pgId || String(row.plaiground_artist_id || '') === pgId))
        || (name && String(row.name || '').toLowerCase() === name.toLowerCase());
      return sameProfile && !rosterStoreArtistId(row);
    });
    if (profileNeedsCreate) return '';
    return liveOnDraft;
  }

  function ensureCatalogArtist(draft) {
    var current = draft || readDraft();
    var artistId = existingStoreArtistId(current);
    if (isUuidValue(artistId)) {
      var reuse = {};
      if (String(current.artist_id || '').trim() !== artistId) reuse.artist_id = artistId;
      if (String(current.tonegrid_artist_id || '').trim() !== artistId) reuse.tonegrid_artist_id = artistId;
      if (Object.keys(reuse).length) {
        current = writeDraft(reuse);
        saveCatalog({ artist_id: artistId });
      }
      return Promise.resolve({ ok: true, draft: current });
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
    var pgId = String(current.plaiground_artist_id || '').trim();
    if (!pgId && name) {
      var roster = rosterFromMe();
      var r;
      for (r = 0; r < roster.length; r += 1) {
        var row = roster[r] || {};
        if (String(row.id || '') === 'account') continue;
        if (String(row.name || '').toLowerCase() === name.toLowerCase()) {
          pgId = rosterLocalArtistId(row);
          break;
        }
      }
    }
    if (pgId && String(current.plaiground_artist_id || '').trim() !== pgId) {
      current = writeDraft({ plaiground_artist_id: pgId });
    }
    return post(ARTISTS_URL, {
      name: name,
      plaiground_artist_id: pgId,
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
      var next = writeDraft({
        artist_id: id,
        tonegrid_artist_id: id,
        plaiground_artist_id: pgId || current.plaiground_artist_id || '',
      });
      saveCatalog({ artist_id: id });
      rememberRosterArtist({
        id: pgId || current.plaiground_artist_id || id,
        name: name,
        tonegrid_artist_id: id,
        source: 'created',
      });
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
      var knownNow = attachKnownLeftoverNow(current);
      if (knownNow) return knownNow;
      return findLivingSongRelease(current, '').then(function (living) {
        if (living && living.id) {
          var adopted = adoptLivingRelease(current, living);
          return {
            ok: true,
            draft: adopted,
            found: true,
            tracks: living.tracks || [],
            result: living.result,
          };
        }
        return createRelease(current, current.release_date || '').then(function (created) {
          var resolved = asResolvedRelease(created);
          if (resolved && (resolved.failed || resolved.missing)) resolved.createFreshFailed = true;
          return resolved;
        });
      });
    });
  }

  function mintOrReuseAfterDead(current, skipId, loaded) {
    return findLivingSongRelease(current, skipId).then(function (living) {
      if (living && living.id) {
        var adopted = adoptLivingRelease(current, living);
        return { ok: true, draft: adopted, found: true, tracks: living.tracks || [], result: living.result };
      }
      var keepId = String((current && current.release_id) || skipId || '').trim();
      if (keepId) {
        rememberSessionRelease(keepId, true, [], true);
        return { ok: true, draft: current, found: true, tracks: [], keepLeftover: true, tracksListed: true };
      }
      return deadReleaseResult(loaded && loaded.result, current);
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
        rememberSessionRelease(id, true, [], true);
        return { ok: true, draft: current, found: true, tracks: [], keepLeftover: true, tracksListed: true };
      });
    }
    if (id && sessionReleaseVerified && sameUuid(id, sessionReleaseVerified)) {
      return Promise.resolve({
        ok: true,
        draft: current,
        reused: true,
        found: true,
        tracks: sessionReleaseTracks,
        tracksListed: sessionReleaseTracksListed,
      });
    }
    if (id && sessionReleaseId && sameUuid(id, sessionReleaseId)) {
      return Promise.resolve({
        ok: true,
        draft: current,
        reused: true,
        justCreated: true,
        tracks: sessionReleaseTracks,
        tracksListed: sessionReleaseTracksListed,
      });
    }
    if (id && sessionReleaseChecked && sameUuid(id, sessionReleaseChecked)) {
      return Promise.resolve({
        ok: true,
        draft: current,
        reused: true,
        tracks: sessionReleaseTracks,
        tracksListed: sessionReleaseTracksListed,
      });
    }
    if (!id) {
      return createFreshRelease(current);
    }
    return fetchReleaseTracks(id).then(function (loaded) {
      if (loaded.ok) {
        var listed = Boolean(
          loaded.result
          && loaded.result.data
          && Object.prototype.hasOwnProperty.call(loaded.result.data, 'tracks')
        );
        rememberSessionRelease(id, true, loaded.tracks, listed);
        return { ok: true, draft: current, found: true, tracks: loaded.tracks, tracksListed: listed, result: loaded.result };
      }
      if (isUnavailable(loaded.result)) {
        return { unavailable: true, result: loaded.result, draft: current };
      }
      if (isPlanLimit(loaded.result)) {
        return { limited: true, result: loaded.result, draft: current };
      }
      if (isNoStoreResponse(loaded.result)) {
        return { failed: true, timedOut: true, result: storeUnreachableResult(), draft: current };
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
    var next = draft;
    var knownTracks = (opts && opts.tracks) || [];
    var needsKnownHop = knownLeftoverNeedsAudioHop(next, knownTracks);
    var send = fileForStoreUpload(selectedAudio());
    if (needsKnownHop) {
      send = leftoverHopFile(selectedAudio()) || send;
      next = clearStaleLeftoverUploadFlags(next, send);
    }
    var liveFile = Boolean(selectedAudio()) || Boolean(send) || albumRowsForSubmit(next).some(function (track) {
      return track && (track.audio || track.file);
    });
    var force = Boolean(opts && opts.force);
    if ((alreadyUploaded(next) || alreadyConverted(next)) && !force && knownTracks.length && !needsKnownHop) {
      next = persistFoundTracks(next, knownTracks);
      var reuseId = next.track_id || (knownTracks[0] && trackIdOf(knownTracks[0]));
      if (send && reuseId && !alreadyUploaded(next)) {
        return uploadTrackAudio(reuseId, send).then(function (audio) {
          if (audio.failed && audioRequiredResult(audio) && alreadyConverted(next)) {
            return { ok: true, draft: next, reused: true };
          }
          if (audio.failed || audio.unavailable) return audio;
          next = writeDraft({
            audio_uploaded: true,
            audio_attached: true,
            audio_converted: true,
            audio_name: send.name || next.audio_name || '',
          });
          return { ok: true, draft: next, reused: true };
        });
      }
      return Promise.resolve({ ok: true, draft: next, reused: true });
    }
    if (send && (!alreadyUploaded(next) || needsKnownHop)) {
      var attachId = trackIdOnStore(next.track_id, knownTracks) || firstStoreTrackId(knownTracks);
      if (!attachId && (!force || isKnownAdoptRelease(next.release_id))) {
        attachId = String(next.track_id || '').trim();
      }
      if (attachId) {
        return uploadTrackAudio(attachId, send, null, { force: needsKnownHop }).then(function (audio) {
          if (audio.failed && audioRequiredResult(audio) && alreadyConverted(next) && !needsKnownHop) {
            return { ok: true, draft: next, reused: true };
          }
          if (audio.skipped && needsKnownHop) return leftoverHopFailure(audio, next);
          if (audio.failed || audio.unavailable) {
            return needsKnownHop ? leftoverHopFailure(audio, next) : audio;
          }
          next = writeDraft({
            track_id: attachId,
            audio_uploaded: true,
            audio_attached: true,
            audio_converted: true,
            audio_name: send.name || next.audio_name || '',
          });
          return { ok: true, draft: next, reused: true };
        });
      }
      if (needsKnownHop) return leftoverHopFailure(null, next);
    }
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
            if (file && trackId && !track.audio_uploaded && needsAudioUpload(next, file)) {
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
    var mustMint = force || Boolean(send && !knownTracks.length);
    if (mustMint && send && !knownTracks.length) {
      next = writeDraft({
        track_id: '',
        track_idempotency_key: '',
        track_idempotency_body: '',
        audio_uploaded: false,
      });
    } else if (send && alreadyUploaded(next) && mustMint) {
      next = writeDraft({ audio_uploaded: false });
    }
    return createTrack(next, { force: mustMint, title: next && next.title }).then(function (created) {
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
      if (!next.track_id || (created.created && send)) next = writeDraft({ track_id: trackId });
      var file = send || fileForStoreUpload(selectedAudio()) || selectedAudio();
      if (file && trackId && (needsAudioUpload(next, file) || Boolean(send && created.created))) {
        if (alreadyUploaded(next) && send) next = writeDraft({ audio_uploaded: false });
        return uploadTrackAudio(trackId, file).then(function (audio) {
          if (audio.failed && audioRequiredResult(audio) && alreadyHasAudio(next)) {
            return { ok: true, draft: next, created: true };
          }
          if (audio.failed || audio.unavailable) return audio;
          next = writeDraft({ audio_uploaded: true, audio_attached: true, audio_converted: true, audio_name: send && send.name ? send.name : (file.name || next.audio_name || '') });
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
      var needsKnownHop = knownLeftoverNeedsAudioHop(next, storeTracks);
      var existingSend = fileForStoreUpload(selectedAudio());
      if (needsKnownHop && storeTracks.length) {
        next = persistFoundTracks(next, storeTracks);
        existingSend = leftoverHopFile(selectedAudio()) || existingSend;
        next = clearStaleLeftoverUploadFlags(next, existingSend);
        var leftoverTrackId = next.track_id || trackIdOf(preferLeftoverTrack(storeTracks));
        if (!existingSend || !leftoverTrackId) return leftoverHopFailure(null, next);
        return uploadTrackAudio(leftoverTrackId, existingSend, null, { force: true }).then(function (audio) {
          if (audio.skipped || audio.failed || audio.unavailable) return leftoverHopFailure(audio, next);
          next = writeDraft({
            track_id: leftoverTrackId,
            audio_uploaded: true,
            audio_attached: true,
            audio_converted: true,
            audio_name: existingSend.name || next.audio_name || '',
          });
          return hopKnownLeftoverCover(next).then(function (cover) {
            if (cover && (cover.failed || cover.unavailable)) return cover;
            return { ok: true, draft: next };
          });
        });
      }
      if ((resolved.found || storeTracks.length) && storeTracks.length) {
        next = persistFoundTracks(next, storeTracks);
        if (existingSend && next.track_id && !alreadyUploaded(next)) {
          return uploadTrackAudio(next.track_id, existingSend).then(function (audio) {
            if (audio.failed && audioRequiredResult(audio) && alreadyConverted(next)) {
              return { ok: true, draft: next };
            }
            if (audio.failed || audio.unavailable) return audio;
            next = writeDraft({
              audio_uploaded: true,
              audio_attached: true,
              audio_converted: true,
              audio_name: existingSend.name || next.audio_name || '',
            });
            return { ok: true, draft: next };
          });
        }
        return { ok: true, draft: next };
      }
      if (hasId || hasFile || uploaded || picked || titled || existingSend || draftHasTrackFile(next) || String(next.title || '').trim()) {
        return createMissingTracks(next, {
          force: (Boolean(resolved.found || resolved.created) && !alreadyUploaded(next) && !alreadyConverted(next))
            || Boolean(existingSend && !storeTracks.length),
          tracks: storeTracks,
        }).then(function (created) {
          if (created.ok) return created;
          if (created.unavailable) return created;
          if (hasId && alreadyUploaded(next) && !existingSend && !selectedAudio()) {
            return { ok: true, draft: created.draft || next };
          }
          if (shouldReattach(created.draft || next, hasFile || Boolean(existingSend), storeTracks)) {
            return reattachResult(created.draft || next);
          }
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
    var key = takeIdempotencyKey('submit', draft, submitBody);
    return post(
      '/api/tonegrid/releases/' + encodeURIComponent(draft.release_id) + '/submit',
      submitBody,
      key
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
    var legal = hopLegalFields(draft);
    if (legal.legal_first) submitBody.legal_first = legal.legal_first;
    if (legal.legal_last) submitBody.legal_last = legal.legal_last;
    var credit = hopCreditFields(draft);
    if (credit.label) submitBody.label = credit.label;
    if (credit.copyright_holder) submitBody.copyright_holder = credit.copyright_holder;
    if (credit.copyright_owner) submitBody.copyright_owner = credit.copyright_owner;
    if (credit.master_owner) submitBody.master_owner = credit.master_owner;
    if (credit.copyright_year) submitBody.copyright_year = credit.copyright_year;
    if (!solo) {
      submitBody.document_id = documentId;
      if (Array.isArray(draft.writers)) submitBody.writers = draft.writers;
      else if (legal.writers) submitBody.writers = legal.writers;
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
        var liveFile = Boolean(selectedAudio()) || Boolean(fileForStoreUpload(selectedAudio())) || albumRowsForSubmit(next).some(function (track) {
          return track && (track.audio || track.file);
        });
        if (sent.failed && isMissingTrackError(sent.result) && (liveFile || draftHasTrackFile(next) || alreadyConverted(next))) {
          keepHeldWavForRetry();
          return createMissingTracks(readDraft(), { force: true, tracks: [] }).then(function (created) {
            if (created.recover) return { recover: true, result: created.result, draft: created.draft || next };
            if (created.failed) {
              if (shouldReattach(created.draft || next, liveFile, [])) return reattachResult(created.draft || next);
              return hideMissingTrackFailure(created, created.draft || next, liveFile);
            }
            if (created.unavailable) return created;
            var createdIds = draftTrackIds(created.draft || next);
            if (createdIds.length) submitBody.track_id = createdIds[0];
            if (createdIds.length > 1) submitBody.track_ids = createdIds;
            return postSubmitRelease(created.draft || next, submitBody, date, documentId, solo).then(function (retried) {
              if (retried.failed && isMissingTrackError(retried.result)) {
                if (shouldReattach(created.draft || next, liveFile, [])) return reattachResult(created.draft || next);
                return hideMissingTrackFailure(retried, created.draft || next, liveFile);
              }
              return retried;
            });
          });
        }
        if (sent.failed && isMissingTrackError(sent.result) && shouldReattach(next, liveFile, [])) {
          return reattachResult(next);
        }
        if (sent.failed && isMissingTrackError(sent.result) && draftHasTrackFile(next)) {
          return hideMissingTrackFailure(sent, next, liveFile);
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
    var status = result && result.status;
    noteStoreFailure(result);
    if (isNoStoreResponse(result) && !/sandbox[- ]only|not enabled for (distribution|delivery)|production (key|account|environment) required/i.test(String(raw || ''))) {
      return catalogTimeoutMessage();
    }
    var shown = sanitizePartnerCopy(raw, status);
    if (shown) return shown;
    if (isSizeCapError(fallback)) return AUDIO_SIZE_COPY;
    return sanitizePartnerCopy(fallback || '', status);
  }

  function hopLegalFields(draft) {
    var modeEl = document.getElementById('tg-artist-mode');
    var mode = modeEl ? String(modeEl.value || '').trim() : '';
    var firstEl = mode === 'create'
      ? (document.getElementById('tg-legal-first-create') || document.getElementById('tg-legal-first'))
      : (document.getElementById('tg-legal-first') || document.getElementById('tg-legal-first-create'));
    var lastEl = mode === 'create'
      ? (document.getElementById('tg-legal-last-create') || document.getElementById('tg-legal-last'))
      : (document.getElementById('tg-legal-last') || document.getElementById('tg-legal-last-create'));
    var first = firstEl ? String(firstEl.value || '').trim() : '';
    var last = lastEl ? String(lastEl.value || '').trim() : '';
    if (mode !== 'create') {
      if (!first) first = String((draft && draft.legal_first) || '').trim();
      if (!last) last = String((draft && draft.legal_last) || '').trim();
    }
    var out = {};
    if (first) {
      out.legal_first = first;
      out.first_name = first;
    }
    if (last) {
      out.legal_last = last;
      out.last_name = last;
    }
    if (first && last) {
      out.writers = [{ first_name: first, last_name: last, name: [first, last].join(' ') }];
    } else if (draft && Array.isArray(draft.writers) && draft.writers.length) {
      out.writers = draft.writers;
    }
    return out;
  }

  function hopCreditFields(draft) {
    var label = fieldValue('tg-label') || String((draft && draft.label) || '').trim();
    if (label === 'PLAIGROUND') label = '';
    var cOwner = fieldValue('tg-copyright-owner') || String((draft && draft.copyright_holder) || '').trim();
    var pOwner = fieldValue('tg-phonogram-owner') || String((draft && draft.master_owner) || '').trim();
    if (cOwner === 'PLAIGROUND') cOwner = '';
    if (pOwner === 'PLAIGROUND') pOwner = '';
    if (!cOwner || !pOwner) {
      var legal = hopLegalFields(draft);
      var name = [legal.legal_first, legal.legal_last].filter(Boolean).join(' ');
      if (!cOwner) cOwner = name;
      if (!pOwner) pOwner = name;
    }
    var year = fieldValue('tg-copyright-year') || String((draft && draft.copyright_year) || '').trim();
    if (!year && draft && draft.release_date) {
      var match = String(draft.release_date).match(/^(\d{4})/);
      if (match) year = match[1];
    }
    var out = {};
    if (label) out.label = label;
    if (cOwner) {
      out.copyright_holder = cOwner;
      out.copyright_owner = cOwner;
    }
    if (pOwner) out.master_owner = pOwner;
    if (year) out.copyright_year = year;
    return out;
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
    if (draft.name) body.artist = draft.name;
    if (draft.audio_name) body.audio_name = draft.audio_name;
    if (draft.audio_picked_name) body.audio_picked_name = draft.audio_picked_name;
    return Object.assign(body, hopLegalFields(draft), hopCreditFields(draft));
  }

  function selectedAudio() {
    var draft = readDraft();
    var input = document.querySelector('[data-audio-input]');
    var picked = (input && input.files && input.files[0])
      || (input && input._plaigroundFile)
      || null;
    var held = fileFromHeld(heldAudioFile);
    if (alreadyConverted(draft) && looksLikeWav(held)) {
      if (!picked || isMp3File(picked) || picked === heldAudioFile || picked === held) return held;
    }
    if (picked && Number(picked.size) > 0) {
      rememberPickedAudio(picked);
      return picked;
    }
    return held || null;
  }

  function selectedArtwork() {
    var input = document.querySelector('[data-art-input]');
    var live = (input && input.files && input.files[0])
      || (input && input._plaigroundFile)
      || null;
    if (live && Number(live.size) > 0) {
      heldArtworkFile = fileFromHeld(live) || live;
      return live;
    }
    return fileFromHeld(heldArtworkFile) || null;
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
    var trackBody = {
      release_id: draft.release_id,
      title: title,
      position: position,
      explicit: draft.explicit === true,
      instrumental: draft.instrumental === true,
    };
    if (existingId) trackBody.track_id = existingId;
    if (!trackBody.instrumental && draft.language) trackBody.language = draft.language;
    if (draft.made_how) trackBody.made_how = draft.made_how;
    if (draft.human_contribution) trackBody.human_contribution = draft.human_contribution;
    trackBody = Object.assign(trackBody, hopLegalFields(draft));
    var key = takeIdempotencyKey('track', draft, trackBody, force);
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
    if (result && (result.ok === false || (result.status && result.status >= 400))) {
      noteStoreFailure(result);
    }
    if (result && result.data && result.data.error) {
      result.data.error = sanitizePartnerCopy(result.data.error, result.status);
    } else if (result && isPlatformPayloadError('', result.status)) {
      result.data = result.data || {};
      result.data.error = platformPayloadCopy();
    }
    return result;
  }

  function applyFormHeaders(target, extraHeaders) {
    var headers = extraHeaders || {};
    var keys = Object.keys(headers);
    var i;
    for (i = 0; i < keys.length; i += 1) {
      if (headers[keys[i]] == null || headers[keys[i]] === '') continue;
      target[keys[i]] = String(headers[keys[i]]);
    }
    return target;
  }

  function postForm(url, body, onProgress, extraHeaders) {
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
        var waitMs = waitMsForUrl(url);
        xhr.timeout = waitMs;
        xhr.setRequestHeader('Accept', 'application/json');
        var headerKeys = Object.keys(extraHeaders || {});
        var hi;
        for (hi = 0; hi < headerKeys.length; hi += 1) {
          if (extraHeaders[headerKeys[hi]] == null || extraHeaders[headerKeys[hi]] === '') continue;
          xhr.setRequestHeader(headerKeys[hi], String(extraHeaders[headerKeys[hi]]));
        }
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
        }, waitMs + 250);
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
          if (isPlatformPayloadError((data && (data.error || data.message)) || xhr.responseText, xhr.status)) {
            data.error = platformPayloadCopy();
          } else if (isSizeCapError((data && (data.error || data.message)) || xhr.responseText)) {
            data.error = AUDIO_SIZE_COPY;
          } else if (isIdempotencyReuseError((data && (data.error || data.message)) || xhr.responseText)) {
            data.error = STEP_FAIL_COPY;
          }
          done({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data: data });
        };
        xhr.send(body);
      });
    }
    return withCatalogTimeout(function () {
      return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: applyFormHeaders({ Accept: 'application/json' }, extraHeaders),
        body: body,
      }).then(parseJson);
    }, waitMsForUrl(url)).then(sanitizeResultError);
  }

  function audioNeedsChunks(file) {
    return Boolean(file && Number(file.size) > PLATFORM_AUDIO_BYTES && typeof file.slice === 'function');
  }

  function newAudioUploadId() {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch (err) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) {
      var r = Math.random() * 16 | 0;
      var v = ch === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function chunkHeaders(send, uploadId, index, count) {
    var headers = {
      'x-plaiground-upload-id': uploadId,
      'x-plaiground-chunk-index': String(index),
      'x-plaiground-chunk-count': String(count),
      'x-plaiground-filename': send.name || 'audio.wav',
      'x-plaiground-total-bytes': String(Number(send.size) || 0),
    };
    if (send.type) headers['x-plaiground-mime'] = send.type;
    return headers;
  }

  function postChunkedAudio(trackId, send, onProgress) {
    var size = Number(send.size) || 0;
    var count = Math.max(2, Math.ceil(size / AUDIO_CHUNK_BYTES));
    var uploadId = newAudioUploadId();
    var url = TRACKS_URL + '/' + encodeURIComponent(trackId) + '/audio';
    var index = 0;
    function next() {
      if (index >= count) return Promise.resolve({ ok: true, status: 200, data: {} });
      var start = index * AUDIO_CHUNK_BYTES;
      var end = Math.min(size, start + AUDIO_CHUNK_BYTES);
      var part = send.slice(start, end, send.type || 'application/octet-stream');
      var body = new FormData();
      body.append('audio', part, send.name || 'audio.wav');
      var thisIndex = index;
      index += 1;
      return postForm(url, body, function (percent) {
        if (typeof onProgress !== 'function') return;
        var base = (thisIndex / count) * 100;
        var span = 100 / count;
        onProgress(Math.round(base + (Number(percent) || 0) * span / 100));
      }, chunkHeaders(send, uploadId, thisIndex, count)).then(function (result) {
        if (!result || !result.ok) return result;
        if (thisIndex >= count - 1) return result;
        return next();
      });
    }
    return next();
  }

  function storeUnreachableResult() {
    return { ok: false, status: 0, timedOut: true, data: { error: catalogTimeoutMessage() } };
  }

  function uploadAudio(trackId, file, onProgress) {
    if (!trackId || !file) return Promise.resolve({ skipped: true });
    var transit = fileForTransitUpload(file);
    if (!transit) return Promise.resolve({ skipped: true });
    if (audioOverRealCap(transit) && audioOverRealCap(file)) {
      return Promise.resolve({ failed: true, result: { data: { error: AUDIO_SIZE_COPY } } });
    }
    if (originalOverRealCap()) {
      return Promise.resolve({ failed: true, result: { data: { error: AUDIO_SIZE_COPY } } });
    }
    return fileLooksAllowed(transit).then(function (ok) {
      if (!ok) {
        return { failed: true, result: { data: { error: AUDIO_ERROR } } };
      }
      function postFile(send) {
        var reused = reuseHopKey('audio', send, readDraft());
        var hopped = reused
          ? Promise.resolve({ object_key: reused })
          : hopFile('audio', send, onProgress);
        return hopped.then(function (next) {
          if (next && next.failed) return next.result || { ok: false, data: { error: AUDIO_SEND_COPY } };
          if (!next || !next.object_key) return { ok: false, data: { error: AUDIO_SEND_COPY } };
          writeDraft({
            audio_object_key: next.object_key,
            audio_name: send.name || readDraft().audio_name || '',
            audio_hop_size: Number(send.size) || 0,
          });
          return post(TRACKS_URL + '/' + encodeURIComponent(trackId) + '/audio', { object_key: next.object_key });
        });
      }
      function interpret(result, err) {
        if (result && result.ok) return { uploaded: true, result: result };
        if (isUnavailable(result)) return { unavailable: true, result: result };
        if (isNoStoreResponse(result, err)) {
          noteStoreFailure(result || storeUnreachableResult(), err);
          return { failed: true, timedOut: true, result: storeUnreachableResult() };
        }
        noteStoreFailure(result, err);
        return { failed: true, result: sanitizeResultError(result || { ok: false, data: { error: AUDIO_SEND_COPY } }) };
      }
      return postFile(transit).then(function (result) {
        if (result && result.ok) return { uploaded: true, result: result };
        if (isUnavailable(result)) return { unavailable: true, result: result };
        if (isNoStoreResponse(result)) {
          return postFile(transit).then(function (retry) {
            return interpret(retry);
          }).catch(function (retryErr) {
            return interpret(null, retryErr);
          });
        }
        return interpret(result);
      }).catch(function (err) {
        if (isNoStoreResponse(null, err)) {
          return postFile(transit).then(function (retry) {
            return interpret(retry);
          }).catch(function (retryErr) {
            return interpret(null, retryErr);
          });
        }
        return interpret(null, err);
      });
    });
  }

  function artworkUrlFromResult(result) {
    var data = result && result.data;
    if (!data) return '';
    try {
      if (typeof PlaigroundCoverUrl !== 'undefined' && PlaigroundCoverUrl) {
        return String(PlaigroundCoverUrl.stored(data) || PlaigroundCoverUrl.from(data) || '').trim();
      }
    } catch (err) {}
    return String(data.artwork_url || data.cover_art_url || data.cover_url || '').trim();
  }

  function fileToCoverDataUrl(file) {
    if (!file || typeof FileReader !== 'function') return Promise.resolve('');
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        var data = String(reader.result || '');
        resolve(/^data:image\//i.test(data) ? data : '');
      };
      reader.onerror = function () { resolve(''); };
      try { reader.readAsDataURL(file); } catch (err) { resolve(''); }
    });
  }

  function persistLocalReleaseCover(releaseId, url) {
    var keep = String(url || '').trim();
    if (!releaseId || !keep) return Promise.resolve();
    if (!/^https?:\/\//i.test(keep) && !/^data:image\//i.test(keep)) return Promise.resolve();
    var draft = readDraft();
    writeDraft({ artwork_url: keep });
    try {
      return fetch('/api/me/artists', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_release',
          release: {
            title: String((draft && draft.title) || '').trim() || 'Untitled',
            plaiground_artist_id: String((draft && draft.plaiground_artist_id) || '').trim(),
            tonegrid_status: String((draft && draft.tonegrid_status) || 'pending').toLowerCase(),
            tonegrid_release_id: releaseId,
            id: releaseId,
            artwork_url: keep,
            artwork_object_key: String((draft && draft.artwork_object_key) || '').trim(),
            genre: String((draft && draft.genre) || '').trim(),
            language: String((draft && draft.language) || '').trim(),
          },
        }),
      }).then(function () {}, function () {});
    } catch (err) {
      return Promise.resolve();
    }
  }

  function rememberArtworkUrl(releaseId, result, file) {
    var url = artworkUrlFromResult(result);
    if (url && (/^https?:\/\//i.test(url) || /^data:image\//i.test(url))) {
      return persistLocalReleaseCover(releaseId, url).then(function () { return url; });
    }
    return fileToCoverDataUrl(file).then(function (data) {
      if (!data) return '';
      return persistLocalReleaseCover(releaseId, data).then(function () { return data; });
    });
  }

  function uploadArtwork(releaseId, file, onProgress) {
    var draft = readDraft();
    if (!releaseId) return Promise.resolve({ skipped: true });
    if (!file && draft.artwork_object_key) {
      return post(RELEASES_URL + '/' + encodeURIComponent(releaseId) + '/artwork', {
        object_key: draft.artwork_object_key,
      }).then(function (result) {
        if (isUnavailable(result)) return { unavailable: true, result: result };
        if (!result.ok) return { failed: true, result: result };
        return rememberArtworkUrl(releaseId, result, null).then(function () {
          return { uploaded: true, result: result, object_key: draft.artwork_object_key };
        });
      });
    }
    if (!file) return Promise.resolve({ skipped: true });
    if (file.size > MAX_ARTWORK_BYTES) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Artwork must be 15 MB or smaller.' } } });
    }
    if (!isArtFile(file)) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Artwork must be JPG or PNG.' } } });
    }
    var reused = reuseHopKey('cover', file, readDraft());
    var hopped = reused
      ? Promise.resolve({ object_key: reused })
      : hopFile('cover', file, onProgress);
    return hopped.then(function (next) {
      if (next && next.failed) return next;
      if (!next || !next.object_key) return { failed: true, result: { data: { error: STEP_FAIL_COPY } } };
      writeDraft({
        artwork_object_key: next.object_key,
        artwork_name: file.name || readDraft().artwork_name || '',
        artwork_type: file.type || readDraft().artwork_type || '',
        artwork_size: Number(file.size) || 0,
      });
      return post(RELEASES_URL + '/' + encodeURIComponent(releaseId) + '/artwork', { object_key: next.object_key }).then(function (result) {
        if (isUnavailable(result)) return { unavailable: true, result: result };
        if (!result.ok) return { failed: true, result: result };
        return rememberArtworkUrl(releaseId, result, file).then(function () {
          return { uploaded: true, result: result, object_key: next.object_key };
        });
      });
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
    if (file && !looksLikeWav(file)) rememberPickedOriginal(file);
    if (alreadyConverted(readDraft()) || looksLikeWav(file)) {
      return Promise.resolve({ file: file, didConvert: false, copy: '', skipped: true });
    }
    return resolveConvertCopy(file).then(function (copy) {
      if (!copy) return { file: file, didConvert: false, copy: '' };
      showConvertLoader(copy);
      var hook = convertHook();
      if (!hook) {
        return { file: file, didConvert: false, copy: copy, failed: true, result: { data: { error: AUDIO_SEND_COPY } } };
      }
      return withCatalogTimeout(function () {
        return Promise.resolve(hook(file));
      }).then(function (next) {
        var ready = next;
        if (ready && typeof ready === 'object' && ready.file) ready = ready.file;
        if (ready && typeof ready.name === 'string' && (ready.size != null || typeof ready.slice === 'function')) {
          return persistHeldAudio(ready).then(function () {
            writeDraft({ audio_converted: true, audio_name: ready.name || (file && file.name) || '' });
            return { file: ready, didConvert: true, copy: copy };
          });
        }
        return { file: file, didConvert: false, copy: copy, failed: true, result: { data: { error: AUDIO_SEND_COPY } } };
      }).catch(function (err) {
        if (err && err.timedOut) {
          return { file: file, didConvert: false, copy: copy, failed: true, timedOut: true, result: storeUnreachableResult() };
        }
        return { file: file, didConvert: false, copy: copy, failed: true, result: { data: { error: AUDIO_SEND_COPY } } };
      });
    });
  }

  function uploadTrackAudio(trackId, file, label, opts) {
    var force = Boolean(opts && opts.force);
    var send = force
      ? (leftoverHopFile(file) || fileForStoreUpload(file) || fileFromHeld(file) || file)
      : fileForStoreUpload(file);
    if (!trackId) return Promise.resolve({ skipped: true });
    if (!force && alreadyUploaded(readDraft())) return Promise.resolve({ skipped: true, reused: true });
    if (!send) return Promise.resolve({ skipped: true, reused: Boolean(!force && alreadyConverted(readDraft())) });
    var sendLabel = label || 'Uploading audio';
    var leftoverOriginal = Boolean(force);
    var convertStep = leftoverOriginal
      ? Promise.resolve({ file: send, didConvert: false, copy: '', skipped: true })
      : runConvertStep(send);
    return convertStep.then(function (ready) {
      if (ready && ready.failed) return ready;
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
      var storeTracks = (resolved.tracks && resolved.tracks.length) ? resolved.tracks : [];
      var listed = resolved.tracksListed === true || Boolean(
        resolved.result
        && resolved.result.data
        && Object.prototype.hasOwnProperty.call(resolved.result.data, 'tracks')
      );
      if (storeTracks.length) {
        ready = persistFoundTracks(ready, storeTracks);
        return createTrackOnRelease(ready);
      }
      if (listed || ready.track_id || ready.track_idempotency_key || resolved.found) {
        ready = writeDraft({
          track_id: '',
          track_idempotency_key: '',
          track_idempotency_body: '',
          audio_uploaded: false,
          audio_converted: false,
        });
        return createTrackOnRelease(ready, { force: true });
      }
      return createTrackOnRelease(ready);
    });
  }

  function createTrackOnRelease(draft, opts) {
    return createTrack(draft, { force: Boolean(opts && opts.force), title: draft && draft.title }).then(function (track) {
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
      var chain = Promise.resolve({ ok: true, draft: next, track: track });
      if (file && next.track_id && needsAudioUpload(next, file)) {
        chain = uploadTrackAudio(next.track_id, file).then(function (audio) {
          if (audio.failed && audioRequiredResult(audio) && alreadyHasAudio(next)) {
            return { ok: true, draft: next, track: track, audio: audio };
          }
          if (audio.failed || audio.unavailable) {
            return {
              ok: false,
              failed: Boolean(audio.failed),
              unavailable: Boolean(audio.unavailable),
              result: audio.result,
              draft: next,
              track: track,
              audio: audio,
            };
          }
          next = writeDraft({ audio_uploaded: true, audio_attached: true, audio_converted: true, audio_name: file.name || next.audio_name || '' });
          return { ok: true, draft: next, track: track, audio: audio };
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

  function isAlreadyExistsResult(result) {
    if (!result || result.ok) return false;
    var msg = String((result.data && (result.data.error || result.data.message)) || '').toLowerCase();
    if (/already exists|already exist|a record with these details/.test(msg)) return true;
    if (result.status === 409 && /duplicate|unique|exists/.test(msg)) return true;
    return false;
  }

  function adoptKnownDraftOnCollide(draft, result) {
    var known = knownAdoptIdsForDraft(draft);
    return findLivingSongRelease(draft, '').then(function (living) {
      if (living && living.id) {
        var adopted = adoptLivingRelease(draft, living);
        return {
          ok: true,
          created: true,
          found: true,
          draft: adopted,
          tracks: living.tracks || [],
          result: living.result || { ok: true, status: 200, data: { uuid: living.id, continued: true } },
        };
      }
      if (known[0]) {
        return fetchReleaseTracks(known[0]).then(function (loaded) {
          var found = (loaded.ok && loaded.tracks && loaded.tracks.length) ? loaded.tracks : [];
          var adoptedKnown = adoptLivingRelease(draft, { id: known[0], tracks: found });
          return {
            ok: true,
            created: true,
            found: true,
            draft: adoptedKnown,
            tracks: found,
            tracksListed: found.length > 0,
            result: { ok: true, status: 200, data: { uuid: known[0], continued: true, tracks: found } },
          };
        });
      }
      return { failed: true, result: result, draft: draft };
    });
  }

  function createRelease(draft, releaseDate, opts) {
    if (draft.release_id) {
      rememberSessionRelease(draft.release_id);
      return Promise.resolve({ skipped: true, draft: draft });
    }
    if (!draft.artist_id || !draft.title) {
      return Promise.resolve({ skipped: true, missing: true, draft: draft });
    }
    var knownSkip = attachKnownLeftoverNow(draft);
    if (knownSkip) return knownSkip;
    var body = releasePayload(draft, releaseDate);
    var key = takeIdempotencyKey('release', draft, body, Boolean(opts && opts.rotateKey));
    return post(RELEASES_URL, body, key).then(function (result) {
      if (isUnavailable(result)) {
        return { unavailable: true, result: result, draft: draft };
      }
      if (isPlanLimit(result)) {
        return { limited: true, result: result, draft: draft };
      }
      if (!result.ok) {
        if (isArtistGoneError(result.data && result.data.error)) {
          var kept = draft;
          if (!String((draft && draft.plaiground_artist_id) || '').trim() && !knownAdoptIdsForDraft(draft)[0]) {
            kept = writeDraft({ artist_id: '' });
          }
          var goneCopy = String((kept && kept.plaiground_artist_id) || '').trim()
            ? STEP_FAIL_COPY
            : ARTIST_GONE_COPY;
          return {
            failed: true,
            result: { data: { error: goneCopy } },
            draft: kept,
          };
        }
        if (isAlreadyExistsResult(result)) {
          return adoptKnownDraftOnCollide(draft, result);
        }
        return { failed: true, result: result, draft: draft };
      }
      var releaseId = pickUuid(result.data);
      if (!releaseId) {
        var knownCreated = knownAdoptIdsForDraft(draft);
        if (knownCreated[0]) releaseId = knownCreated[0];
      }
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
          release_idempotency_body: '',
        });
        return createRelease(retryDraft, releaseDate, { retriedDead: true, rotateKey: true });
      }
      var next = draft;
      var continuedTracks = releaseTrackList(result.data);
      if (releaseId) {
        unmarkDeadRelease(releaseId);
        next = writeDraft({
          release_id: releaseId,
          release_date: releaseDate || draft.release_date || '',
          replaced_release_id: '',
        });
        if (continuedTracks.length) {
          rememberSessionRelease(releaseId, true, continuedTracks, true);
          next = persistFoundTracks(next, continuedTracks);
        } else {
          rememberSessionRelease(releaseId);
        }
      }
      if (releaseId || draft.artist_id) {
        saveCatalog({ artist_id: draft.artist_id, release_id: releaseId });
      }
      return {
        created: true,
        draft: next,
        result: result,
        tracks: continuedTracks,
        tracksListed: continuedTracks.length > 0,
      };
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

  var rememberedArtists = [];
  var refreshArtistSelect = function () {};

  function rememberRosterArtist(artist) {
    if (!artist || !artist.name || isLeftoverArtistName(artist.name)) return;
    var id = String(artist.id || artist.artist_id || '').trim();
    rememberedArtists = rememberedArtists.filter(function (row) {
      return row && String(row.id || '') !== id && String(row.name || '') !== String(artist.name || '');
    });
    rememberedArtists.push({
      id: id || artist.name,
      name: artist.name,
      source: artist.source || 'created',
      badge: artist.badge || 'PLAIGROUND',
      tonegrid_artist_id: artist.tonegrid_artist_id || '',
    });
    refreshArtistSelect();
  }

  function rosterFromMe(me) {
    var row = me || accountRecord() || {};
    var artists = row.profile && Array.isArray(row.profile.artists) ? row.profile.artists.slice() : [];
    artists = artists.filter(function (artist) {
      return artist && artist.name && !isLeftoverArtistName(artist.name);
    }).map(function (artist) {
      var id = String((artist && (artist.id || artist.artist_id || artist.uuid || artist.tonegrid_artist_id)) || '').trim();
      return Object.assign({}, artist, { id: id || artist.name });
    });
    rememberedArtists.forEach(function (extra) {
      if (!extra || !extra.name) return;
      if (artists.some(function (row) { return row && (row.id === extra.id || row.name === extra.name); })) return;
      artists.push(extra);
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
    var name = String((opt && ((opt.getAttribute && opt.getAttribute('data-name')) || opt.textContent)) || '').trim();
    if (!id || !name) {
      var typed = typeaheadTypedValue(sel);
      if (typed) {
        var roster = rosterFromMe();
        var i;
        for (i = 0; i < roster.length; i += 1) {
          if (String(roster[i].name || '').toLowerCase() === typed.toLowerCase() || String(roster[i].id || '') === typed) {
            id = id || String(roster[i].id || '');
            name = name || String(roster[i].name || '');
            break;
          }
        }
      }
    }
    if (!id) return null;
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
      artwork_object_key: draft.artwork_object_key || '',
      title: fieldValue('tg-title') || draft.title || '',
      name: syncArtistHidden() || fieldValue('tg-artist') || draft.name || '',
      featured: fieldValue('tg-featured') || draft.featured || '',
      legal_first: fieldValue('tg-legal-first') || fieldValue('tg-legal-first-create') || draft.legal_first || '',
      legal_last: fieldValue('tg-legal-last') || fieldValue('tg-legal-last-create') || draft.legal_last || '',
      label: fieldValue('tg-label') || draft.label || '',
      copyright_holder: fieldValue('tg-copyright-owner') || draft.copyright_holder || '',
      master_owner: fieldValue('tg-phonogram-owner') || draft.master_owner || '',
      copyright_year: fieldValue('tg-copyright-year') || draft.copyright_year || '',
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
    if (draft.dsps_all !== false) picked = null;
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
    if (!fields.artwork && !fields.artwork_name && !fields.artwork_object_key) return 'Artwork is required.';
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
      return String((artist && (artist.id || artist.artist_id || artist.uuid || artist.tonegrid_artist_id || artist.name)) || '').trim();
    }

    function setSelectValue(sel, value) {
      sel.value = value;
      if (!sel.options) return;
      var i;
      for (i = 0; i < sel.options.length; i += 1) {
        if (String(sel.options[i].value || '') === String(value || '')) {
          sel.selectedIndex = i;
          return;
        }
      }
      sel.selectedIndex = value ? sel.selectedIndex : 0;
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
      if (current && artists.some(function (artist) { return artistPickValue(artist) === current; })) {
        setSelectValue(sel, current);
      } else if (artists.length === 1) {
        setSelectValue(sel, artistPickValue(artists[0]));
      } else {
        setSelectValue(sel, '');
      }
      syncArtistHidden();
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

    refreshArtistSelect = function () {
      fillSelect(rosterFromMe(accountRecord()));
    };

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
        if (
          row.id === picked.id
          || row.artist_id === picked.id
          || row.uuid === picked.id
          || row.tonegrid_artist_id === picked.id
          || row.name === picked.name
          || row.name === picked.id
        ) {
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
    var legal = hopLegalFields(readDraft());
    return post('/api/me/artists', {
      action: 'create',
      name: name,
      legal_first: legal.legal_first || (fields && fields.legal_first) || '',
      legal_last: legal.legal_last || (fields && fields.legal_last) || '',
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
          release_idempotency_body: '',
          track_idempotency_key: '',
          track_idempotency_body: '',
        });
      } else if (next === 'single' && draft.type === 'album') {
        writeDraft({
          type: 'single',
          release_id: '',
          track_id: '',
          tracks: [],
          album_count: '',
          release_idempotency_key: '',
          release_idempotency_body: '',
          track_idempotency_key: '',
          track_idempotency_body: '',
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
    rememberPickedAudio(file);
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
    if (draft.label && draft.label !== 'PLAIGROUND') fill('tg-label', draft.label);
    if (draft.copyright_holder && draft.copyright_holder !== 'PLAIGROUND') fill('tg-copyright-owner', draft.copyright_holder);
    if (draft.master_owner && draft.master_owner !== 'PLAIGROUND') fill('tg-phonogram-owner', draft.master_owner);
    fill('tg-copyright-year', draft.copyright_year);
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
    if (draft.artwork_object_key && hopApi() && typeof hopApi().previewUrl === 'function') {
      hopApi().previewUrl(draft.artwork_object_key).then(function (url) {
        if (url && window.PlaigroundUploadCover && typeof window.PlaigroundUploadCover.setStored === 'function') {
          window.PlaigroundUploadCover.setStored(url);
        }
      });
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
    var freshStart = isNewReleaseStart();
    if (freshStart) {
      var credits = window.PlaigroundReleaseCredits;
      var parked = credits && typeof credits.parkSavedDraft === 'function' && credits.parkSavedDraft(window);
      if (parked) {
        if (typeof credits.clearWorkingDraft === 'function') credits.clearWorkingDraft(window);
        else {
          try { localStorage.removeItem(DRAFT_KEY); } catch (err) {}
          try { sessionStorage.removeItem(DRAFT_KEY); } catch (err2) {}
        }
        if (typeof credits.markFreshStart === 'function') credits.markFreshStart(window);
      } else {
        clearNewReleaseDraft();
      }
      stripNewReleaseFlag();
    }
    var cancelBtn = document.querySelector('[data-upload-cancel]');
    if (cancelBtn && cancelBtn.addEventListener) {
      cancelBtn.addEventListener('click', cancelInProgressUpload);
    }
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
        rotateIdempotencyKeys();
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
      var shown = sanitizePartnerCopy(shownError || '');
      setStatus('tg-status', shown || '');
      markStatusError(Boolean(shown));
      showLimitPanel(upgrade === true, /Albums are on Creator/.test(message || '') ? 'album' : '');
      showUpgrade(upgrade === true);
      var retryable = !upgrade && Boolean(shown) && !/is required|must be|Upgrade to|Albums are on|Pick how many/i.test(shown);
      showUploadRetry(retryable);
    }

    function persistLocalUploadFiles() {
      var files = (typeof window !== 'undefined' && window.PlaigroundUploadDraftFiles) || null;
      var persistCover = files && typeof files.persistPickedFiles === 'function'
        ? files.persistPickedFiles(window)
        : persistHeldArtwork(heldArtworkFile || selectedArtwork());
      return Promise.all([
        persistHeldAudio(heldAudioFile || selectedAudio()),
        persistPickedAudio(heldPickedFile),
        persistCover,
      ]);
    }

    function finishToAttest(nextHref, message) {
      showUploadLoader('Opening SignWell');
      setStatus('tg-status', message || 'Opening SignWell…');
      return persistLocalUploadFiles().then(function () {
        setUploadBusy(false);
        continueAfterCatalog(nextHref, message);
      });
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
          rememberPickedAudio(picked);
          rotateIdempotencyKeys();
          writeDraft({
            audio_name: picked.name,
            audio_uploaded: false,
            audio_attached: true,
            audio_converted: false,
            audio_picked_size: Number(picked.size) || 0,
            audio_picked_name: picked.name || '',
          });
        }
        refreshUploadGate();
      });
    }
    var artInput = document.querySelector('[data-art-input]');
    if (artInput && artInput.addEventListener) {
      artInput.addEventListener('change', function () {
        var art = selectedArtwork();
        if (art) persistHeldArtwork(art);
        refreshUploadGate();
      });
    }
    var savedDraft = freshStart ? {} : readDraft();
    if (!freshStart) {
      restoreHeldAudio();
      restoreUploadDraft(savedDraft);
    }
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

    function afterArtistReady(_draft, nextHref) {
      return finishToAttest(nextHref);
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
      if (file) rememberPickedAudio(file);
      var art = fields.artwork;
      var nextHref = trigger.getAttribute('href') || 'attest.html';
      var pageError = uploadPageError(fields);
      if (pageError) {
        fieldError(pageError);
        return;
      }
      if (releaseType === 'album') {
        for (var t = 0; t < albumTracks.length; t += 1) {
          if (albumTracks[t].audio && audioOverRealCap(albumTracks[t].audio)) {
            fieldError('Track ' + (t + 1) + ' must be 200 MB or smaller.');
            return;
          }
        }
      } else if (file && audioOverRealCap(file)) {
        fieldError(AUDIO_SIZE_COPY);
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
        legal_first: fields.legal_first || readDraft().legal_first || '',
        legal_last: fields.legal_last || readDraft().legal_last || '',
        label: fields.label || readDraft().label || '',
        copyright_holder: fields.copyright_holder || readDraft().copyright_holder || '',
        master_owner: fields.master_owner || readDraft().master_owner || '',
        copyright_year: fields.copyright_year || readDraft().copyright_year || '',
        type: releaseType,
        explicit: explicit,
        instrumental: instrumental,
        lyrics: instrumental ? '' : (fields.lyrics || ''),
        dsps: dsps,
        artwork_name: art && art.name ? art.name : (readDraft().artwork_name || ''),
        artwork_type: art && art.type ? art.type : (readDraft().artwork_type || ''),
        artwork_object_key: readDraft().artwork_object_key || '',
        audio_name: file && file.name ? file.name : (readDraft().audio_name || ''),
        audio_picked_size: (file && !looksLikeWav(file)) || !alreadyConverted(readDraft())
          ? (Number(file && file.size) || Number(readDraft().audio_picked_size) || 0)
          : (Number(readDraft().audio_picked_size) || Number(file && file.size) || 0),
        audio_picked_name: file && !looksLikeWav(file)
          ? (file.name || '')
          : (readDraft().audio_picked_name || (file && file.name) || ''),
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
            legal_first: fields.legal_first || readDraft().legal_first || '',
            legal_last: fields.legal_last || readDraft().legal_last || '',
            label: fields.label || readDraft().label || '',
            copyright_holder: fields.copyright_holder || readDraft().copyright_holder || '',
            master_owner: fields.master_owner || readDraft().master_owner || '',
            copyright_year: fields.copyright_year || readDraft().copyright_year || '',
            type: releaseType,
            explicit: explicit,
            instrumental: instrumental,
            lyrics: instrumental ? '' : (fields.lyrics || ''),
            dsps: dsps,
            artwork_name: art && art.name ? art.name : (readDraft().artwork_name || ''),
            artwork_type: art && art.type ? art.type : (readDraft().artwork_type || ''),
            artwork_object_key: readDraft().artwork_object_key || '',
            audio_name: file && file.name ? file.name : (readDraft().audio_name || ''),
            audio_attached: Boolean((file && file.name) || readDraft().audio_attached || readDraft().audio_name),
            title_check: titleCheck,
            tracks: releaseType === 'album' ? persistAlbumTracks(albumTracks).tracks : readDraft().tracks,
          }), me);
          if (!continuingSame) {
            var keepStoreArtist = existingStoreArtistId(readDraft());
            draft = writeDraft(keepStoreArtist
              ? { track_id: '' }
              : { artist_id: '', track_id: '' });
          }
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
            var artistMode = fieldValue('tg-artist-mode') || '';
            var storeId = liveChosenStoreArtistId(artist);
            if (!storeId && artistMode !== 'create') storeId = existingStoreArtistId(readDraft());
            if (storeId && isLocalProfileArtistId(storeId, readDraft())) storeId = '';
            var persist = {
              name: (artist && artist.name) || name,
              plaiground_artist_id: (artist && artist.id && artist.id !== 'account') ? artist.id : '',
              artist_check: (artist && artist.check && artist.check.level) || '',
              artist_linked: Boolean(artist && artist.linked),
              confirm_different: Boolean(artist && artist.confirmDifferent),
            };
            if (artistMode === 'create' || !storeId) {
              persist.artist_id = '';
              persist.tonegrid_artist_id = '';
            } else {
              persist.artist_id = storeId;
              persist.tonegrid_artist_id = storeId;
            }
            var nextDraft = writeDraft(persist);
            if (artist && artist.name) {
              rememberRosterArtist({
                id: artist.id,
                name: artist.name,
                source: artist.linked ? 'linked' : 'created',
                tonegrid_artist_id: storeId || liveChosenStoreArtistId(artist) || '',
              });
            }
            if (artist && (artist.skipTonegrid || (artist.check && artist.check.level === 'red'))) {
              writeDraft({ pending_review: true, tonegrid_status: 'pending_review', artist_check: 'red' });
              return recordLocalRelease(readDraft(), artist).then(function () {
                finishToAttest(nextHref, 'This artist name is held for review and was not sent to the store.');
              });
            }
            if (artistMode === 'create') nextDraft = writeDraft({ artist_id: '', tonegrid_artist_id: '' });
            return afterArtistReady(nextDraft, nextHref);
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

  function showSubmitRetry(on) {
    var wrap = document.querySelector('[data-upload-retry-wrap]') || $('tg-retry-wrap');
    if (wrap) wrap.hidden = !on;
  }

  function failSubmit(message, trigger) {
    hideUploadLoader();
    if (trigger) trigger.removeAttribute('aria-busy');
    keepHeldWavForRetry();
    var shown = sanitizePartnerCopy(message || '');
    var draft = readDraft();
    var knownLeftover = Boolean(knownAdoptIdsForDraft(draft)[0] || isKnownAdoptRelease(draft && draft.release_id));
    if (isAudioRequiredError(shown) && alreadyHasAudio(draft) && !knownLeftover) {
      shown = '';
    }
    if (isMissingTrackError({ data: { error: shown } }) && draftHasTrackFile(draft)) {
      shown = attachFailedMessage();
    }
    if (/already exists|already exist|a record with these details/i.test(shown) && knownAdoptIdsForDraft(draft)[0]) {
      shown = '';
    }
    if (knownLeftover && (isAudioRequiredError(shown) || isAudioRequiredError(message) || /could not send the audio/i.test(String(shown || message || '')))) {
      shown = AUDIO_SEND_COPY;
    }
    setStatus('tg-status', shown);
    markStatusError(Boolean(shown));
    showSubmitRetry(Boolean(shown) || Boolean(message));
  }

  function finishSubmit(draft, releaseDate, trigger, nextHref) {
    return restoreHeldAudio().then(function () {
      return finishSubmitReady(readDraft(), releaseDate, trigger, nextHref);
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
        if (sent.unavailable) {
          hideUploadLoader();
          if (trigger) trigger.removeAttribute('aria-busy');
          continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
          return;
        }
        if (sent.recover) {
          failSubmit(createErrorMessage(sent.result, recoverUploadMessage()), trigger);
          var back = document.querySelector('.flow-actions a[href="split-sheet.html"], .flow-actions a[href="attest.html"], .flow-actions a.btn-ghost');
          if (back && back.setAttribute) back.setAttribute('href', 'upload.html');
          return;
        }
        if (sent.unsigned || sent.trial || sent.failed) {
          var submitErr = createErrorMessage(sent.result, 'Could not submit the release.');
          var knownLeftover = Boolean(knownAdoptIdsForDraft(next || draft)[0] || isKnownAdoptRelease((next || draft).release_id));
          if (isAudioRequiredError(submitErr) && alreadyHasAudio(next || draft) && !knownLeftover) {
            hideUploadLoader();
            if (trigger) trigger.removeAttribute('aria-busy');
            writeDraft({ submitted: true, tonegrid_status: 'pending' });
            setStatus('tg-status', 'Store status: pending');
            showSubmitRetry(false);
            if (nextHref) go(nextHref);
            return;
          }
          failSubmit(submitErr, trigger);
          return;
        }
        hideUploadLoader();
        if (trigger) trigger.removeAttribute('aria-busy');
        var toneStatus = (sent.result && sent.result.data && sent.result.data.status) || 'pending';
        var sheetStatus = (sent.result && sent.result.data && sent.result.data.signwell_status) || '';
        setStatus('tg-status', sheetStatus && sheetStatus !== 'solo' && sheetStatus !== 'Completed'
          ? 'Store status: ' + toneStatus + ' · awaiting signature'
          : 'Store status: ' + toneStatus);
        showSubmitRetry(false);
        if (nextHref) go(nextHref);
      }).catch(function (err) {
        failSubmit((err && err.message) || 'Could not reach catalog.', trigger);
      });
    });
  }

  function reviewInstrumental() {
    return selectedInstrumental() || Boolean(readDraft().instrumental);
  }

  function persistReviewCatalog() {
    var current = readDraft();
    var genre = catalogFieldValue('tg-genre') || current.genre || '';
    var language = reviewInstrumental() ? '' : (catalogLanguageValue() || current.language || '');
    writeDraft({ genre: genre, language: language });
    fillReviewSummary();
  }

  function bindReviewCatalog() {
    var genre = $('tg-genre');
    var language = $('tg-language');
    if (!genre && !language) return;
    var catalog = null;
    try { catalog = ensureUploadTypeahead(); } catch (err) {}
    var draft = readDraft();
    try {
      if (catalog && typeof catalog.setTypeaheadValue === 'function') {
        if (genre && draft.genre) catalog.setTypeaheadValue(genre, draft.genre);
        if (language && draft.language) catalog.setTypeaheadValue(language, draft.language);
      } else {
        if (genre && draft.genre) genre.value = draft.genre;
        if (language && draft.language) language.value = draft.language;
      }
    } catch (err) {
      if (genre && draft.genre) genre.value = draft.genre;
      if (language && draft.language) language.value = draft.language;
    }
    syncLanguageField(reviewInstrumental());
    persistReviewCatalog();
    ['tg-genre', 'tg-language'].forEach(function (id) {
      var el = $(id);
      if (!el || !el.addEventListener) return;
      el.addEventListener('change', persistReviewCatalog);
    });
  }

  function bindReview() {
    var trigger = document.querySelector('[data-store-submit]');
    var onReview = Boolean(trigger || document.querySelector('[data-review-title]'));
    if (!onReview) return;
    var cancelBtn = document.querySelector('[data-upload-cancel]');
    if (cancelBtn && cancelBtn.addEventListener) {
      cancelBtn.addEventListener('click', cancelInProgressSubmit);
    }
    bindReviewCatalog();
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
        var reviewGenre = catalogFieldValue('tg-genre');
        var reviewLanguage = reviewInstrumental() ? '' : catalogLanguageValue();
        if (reviewGenre) submitPatch.genre = reviewGenre;
        if (!reviewInstrumental()) submitPatch.language = reviewLanguage || draft.language || '';
        else submitPatch.language = '';
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
        showSubmitRetry(false);
        releaseRecreateCount = 0;
        if (knownAdoptIdsForDraft(draft)[0] && !draft.release_id) {
          ensureCatalogArtist(draft).then(function (ready) {
            if (ready.unavailable || ready.limited || ready.failed || ready.missing) {
              failSubmit(createErrorMessage(ready.result, 'Save the upload details first so a catalog artist exists.'), trigger);
              return;
            }
            return attachKnownLeftoverNow(ready.draft || draft).then(function (attached) {
              var next = (attached && attached.draft) || readDraft();
              if (!next.release_id) {
                failSubmit('Could not create release.', trigger);
                return;
              }
              showUploadLoader('Uploading audio');
              return restoreHeldAudio().then(function () {
                return afterRelease(next).then(function (hopped) {
                  if (hopped && hopped.failed) {
                    failSubmit(createErrorMessage(hopped.result, 'Could not create the track.'), trigger);
                    return;
                  }
                  hideUploadLoader();
                  return finishSubmit(hopped && hopped.draft ? hopped.draft : next, releaseDate, trigger, nextHref);
                });
              });
            });
          }).catch(function (err) {
            failSubmit((err && err.message) || 'Could not reach catalog.', trigger);
          });
          return;
        }
        ensureCatalogArtist(draft).then(function (ready) {
          if (ready.unavailable) {
            hideUploadLoader();
            trigger.removeAttribute('aria-busy');
            continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
            return;
          }
          if (ready.limited) {
            failSubmit(createErrorMessage(ready.result, 'Basic includes one release. Upgrade to Creator or Pro to upload more.'), trigger);
            showUpgrade(true);
            return;
          }
          if (ready.failed || ready.missing) {
            failSubmit(createErrorMessage(ready.result, 'Save the upload details first so a catalog artist exists.'), trigger);
            return;
          }
          var nextDraft = ready.draft || draft;
          setStatus('tg-status', nextDraft.release_id ? 'Uploading audio…' : 'Creating release…');
          showUploadLoader(nextDraft.release_id ? 'Uploading audio' : 'Creating release');
          return restoreHeldAudio().then(function () {
          return resolveLiveRelease(readDraft()).then(function (created) {
            if (created.unavailable) {
              hideUploadLoader();
              trigger.removeAttribute('aria-busy');
              continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
              return;
            }
            if (created.limited) {
              failSubmit(createErrorMessage(created.result, 'Basic includes one release. Upgrade to Creator or Pro to upload more.'), trigger);
              showUpgrade(true);
              return;
            }
            if (created.failed || created.missing) {
              failSubmit(createErrorMessage(created.result, 'Could not create release.'), trigger);
              showUpgrade(false);
              return;
            }
            showUploadLoader('Creating track');
            return afterRelease(created.draft || nextDraft).then(function (next) {
              if (next && next.failed) {
                failSubmit(createErrorMessage(next.result, 'Could not create the track.'), trigger);
                return;
              }
              hideUploadLoader();
              return finishSubmit(next && next.draft ? next.draft : (created.draft || nextDraft), releaseDate, trigger, nextHref);
            }).catch(function (err) {
              failSubmit((err && err.message) || 'Could not reach catalog.', trigger);
            });
          }).catch(function (err) {
            failSubmit((err && err.message) || 'Could not reach catalog.', trigger);
          });
          });
        }).catch(function (err) {
          failSubmit((err && err.message) || 'Could not reach catalog.', trigger);
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
    restoreHeldAudio();
    var retryBtn = document.querySelector('[data-upload-retry]');
    if (retryBtn && retryBtn.addEventListener && trigger) {
      retryBtn.addEventListener('click', function (event) {
        if (event && event.preventDefault) event.preventDefault();
        trigger.removeAttribute('aria-busy');
        rotateIdempotencyKeys();
        showSubmitRetry(false);
        if (trigger.listeners && typeof trigger.listeners.click === 'function') {
          trigger.listeners.click({ preventDefault: function () {} });
          return;
        }
        if (typeof trigger.click === 'function') trigger.click();
      });
    }
    if (trigger) {
      markIncomplete(trigger, !String(readyDate || '').trim());
      if (dateEl && dateEl.addEventListener) {
        var syncPickedDate = function () {
          // Never snap on tap/change. Writing a date on first tap cancels the iOS sheet.
          var picked = persistReleaseDate(dateEl, { ignoreEmpty: true });
          if ($('tg-preorder-on') || $('tg-time-on')) collectReleaseSchedule();
          markIncomplete(trigger, !picked);
        };
        dateEl.addEventListener('input', syncPickedDate);
        dateEl.addEventListener('change', syncPickedDate);
      }
    }
    if (draft.release_id && !draft.submitted && String(readyDate || '').trim() && (documentIdOf(draft) || isSoloOwned(draft))) {
      setStatus('tg-status', 'Checking SignWell…');
      restoreHeldAudio().then(function () {
        return afterRelease(readDraft());
      }).then(function (next) {
        if (next && next.failed) {
          failSubmit(createErrorMessage(next.result, 'Could not create the track.'), trigger);
          return;
        }
        return finishSubmit(next && next.draft ? next.draft : readDraft(), readyDate, trigger, null);
      }).then(function () {
        /* stay on review after auto-submit so the exact store status is visible */
      }).catch(function () {
        failSubmit('Could not reach catalog.', trigger);
      });
    }
  }

  function coverUrlApi() {
    try {
      if (typeof PlaigroundCoverUrl !== 'undefined' && PlaigroundCoverUrl) return PlaigroundCoverUrl;
    } catch (err) {}
    return (typeof window !== 'undefined' && window && window.PlaigroundCoverUrl) || null;
  }

  function coverPreviewApi() {
    try {
      if (typeof PlaigroundCoverPreview !== 'undefined' && PlaigroundCoverPreview) return PlaigroundCoverPreview;
    } catch (err) {}
    return (typeof window !== 'undefined' && window && window.PlaigroundCoverPreview) || null;
  }

  function paintReviewCoverTile(el, url) {
    if (!el) return;
    var preview = coverPreviewApi();
    if (preview && typeof preview.paintTile === 'function') {
      preview.paintTile(el, url);
      return;
    }
    var art = String(url || '').trim();
    if (el.style) {
      el.style.backgroundImage = art ? ('url("' + art.replace(/"/g, '') + '")') : '';
      el.style.backgroundSize = art ? 'cover' : '';
      el.style.backgroundPosition = art ? 'center' : '';
    }
    if (el.classList && el.classList.toggle) el.classList.toggle('has-art', Boolean(art));
  }

  function paintReviewCover(draft, el) {
    el = el || document.querySelector('[data-review-cover]');
    if (!el) return;
    var api = coverUrlApi();
    var url = api && typeof api.stored === 'function'
      ? api.stored(draft)
      : String((draft && draft.artwork_url) || '').trim();
    if (url) paintReviewCoverTile(el, url);
    var key = api && typeof api.objectKey === 'function'
      ? api.objectKey(draft)
      : String((draft && draft.artwork_object_key) || '').trim();
    if (!url && key && hopApi() && typeof hopApi().previewUrl === 'function') {
      hopApi().previewUrl(key).then(function (resolved) {
        if (resolved && el.isConnected !== false) paintReviewCoverTile(el, resolved);
      }, function () {});
    }
  }

  function fillReviewSummary() {
    var titleEl = document.querySelector('[data-review-title]');
    var metaEl = document.querySelector('[data-review-meta]');
    var coverEl = document.querySelector('[data-review-cover]');
    if (!titleEl && !metaEl && !coverEl) return;
    var draft = readDraft();
    if (coverEl) paintReviewCover(draft, coverEl);
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
    if (document.querySelector('[data-submit-stores]')) {
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
    if (!draft.title) return;
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
    restoreHeldAudio().then(function () {
      return ensureCatalogArtist(readDraft());
    }).then(function (ready) {
      if (ready && (ready.unavailable || ready.limited || ready.failed || ready.missing)) {
        hideUploadLoader();
        if (ready.unavailable) setStatus('tg-status', 'Catalog sync is not configured yet.');
        else if (ready.limited) {
          setStatus('tg-status', createErrorMessage(ready.result, 'Basic includes one release. Upgrade to Creator or Pro to upload more.'));
          showUpgrade(true);
        } else {
          setStatus('tg-status', createErrorMessage(ready.result, 'Could not create release.'));
        }
        return;
      }
      draft = (ready && ready.draft) || readDraft();
    return createRelease(draft, draft.release_date || '').then(function (created) {
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
