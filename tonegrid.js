(function () {
  var ARTISTS_URL = '/api/tonegrid/artists';
  var RELEASES_URL = '/api/tonegrid/releases';
  var TRACKS_URL = '/api/tonegrid/tracks';
  var DRAFT_KEY = 'plaiground.tonegrid.draft';
  var MAX_AUDIO_BYTES = 200 * 1024 * 1024;
  var MAX_ARTWORK_BYTES = 15 * 1024 * 1024;

  function $(id) {
    return document.getElementById(id);
  }

  function fieldValue(id) {
    var el = $(id);
    return el ? String(el.value || '').trim() : '';
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

  function setStatus(id, text) {
    var el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  function pickUuid(payload) {
    if (!payload || typeof payload !== 'object') return '';
    if (typeof payload.uuid === 'string') return payload.uuid;
    if (payload.artist && typeof payload.artist.uuid === 'string') return payload.artist.uuid;
    if (payload.release && typeof payload.release.uuid === 'string') return payload.release.uuid;
    if (payload.track && typeof payload.track.uuid === 'string') return payload.track.uuid;
    if (payload.data && typeof payload.data === 'object') {
      if (typeof payload.data.uuid === 'string') return payload.data.uuid;
      if (payload.data.artist && typeof payload.data.artist.uuid === 'string') {
        return payload.data.artist.uuid;
      }
      if (payload.data.release && typeof payload.data.release.uuid === 'string') {
        return payload.data.release.uuid;
      }
      if (payload.data.track && typeof payload.data.track.uuid === 'string') {
        return payload.data.track.uuid;
      }
    }
    return '';
  }

  function parseJson(response) {
    return response.json().then(function (data) {
      return { ok: response.ok, status: response.status, data: data || {} };
    }).catch(function () {
      return { ok: false, status: response.status, data: {} };
    });
  }

  function post(url, body, idempotencyKey) {
    var headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 255);
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: headers,
      body: JSON.stringify(body),
    }).then(parseJson);
  }

  function getJson(url) {
    return fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(parseJson);
  }

  function minSubmitDate() {
    var d = new Date();
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  function toIsoDate(value) {
    var raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    var mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!mdy) return '';
    return mdy[3] + '-' + String(mdy[1]).padStart(2, '0') + '-' + String(mdy[2]).padStart(2, '0');
  }

  function normalizePickedDate(value) {
    var date = toIsoDate(value);
    if (!date || date < minSubmitDate()) return '';
    return date;
  }

  function bindReleaseDatePicker(dateEl) {
    if (!dateEl) return '';
    var min = minSubmitDate();
    dateEl.type = 'date';
    dateEl.min = min;
    dateEl.required = true;
    if (dateEl.setAttribute) {
      dateEl.setAttribute('type', 'date');
      dateEl.setAttribute('min', min);
      dateEl.setAttribute('required', '');
    }
    var picked = normalizePickedDate(dateEl.value) || normalizePickedDate(readDraft().release_date);
    dateEl.value = picked;
    return picked;
  }

  function persistReleaseDate(dateEl) {
    var picked = normalizePickedDate(dateEl && dateEl.value);
    if (dateEl && dateEl.value !== picked) dateEl.value = picked;
    writeDraft({ release_date: picked });
    return picked;
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
    var releaseDate = persistReleaseDate($('tg-release-date')) || toIsoDate(readDraft().release_date);
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
    return post('/api/tonegrid/releases/' + encodeURIComponent(draft.release_id) + '/submit', submitBody, 'plaiground-submit-' + draft.release_id).then(function (result) {
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

  function planLimitMessage(plan) {
    return plan === 'creator'
      ? 'Creator includes 8 releases per month. Upgrade to Pro to upload more.'
      : 'Basic includes one release. Upgrade to Creator or Pro to upload more.';
  }

  function createErrorMessage(result, fallback) {
    if (result && result.data && result.data.error) return result.data.error;
    return fallback;
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
    if (!body.instrumental && draft.language) body.language = draft.language;
    if (releaseDate) body.release_date = releaseDate;
    return body;
  }

  function selectedAudio() {
    var input = document.querySelector('[data-audio-input]');
    if (input && input.files && input.files[0]) return input.files[0];
    if (input && input._plaigroundFile) return input._plaigroundFile;
    return null;
  }

  function selectedArtwork() {
    var input = document.querySelector('[data-art-input]');
    if (input && input.files && input.files[0]) return input.files[0];
    if (input && input._plaigroundFile) return input._plaigroundFile;
    return null;
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

  function trackKey(draft) {
    if (draft.track_idempotency_key) return draft.track_idempotency_key;
    return ('plaiground-track-' + String(draft.release_id || '') + ':1').slice(0, 255);
  }

  function createTrack(draft) {
    if (draft.track_id) {
      return Promise.resolve({ skipped: true, draft: draft });
    }
    if (!draft.release_id || !draft.title) {
      return Promise.resolve({ skipped: true, missing: true, draft: draft });
    }
    var key = trackKey(draft);
    if (!draft.track_idempotency_key) writeDraft({ track_idempotency_key: key });
    var trackBody = {
      release_id: draft.release_id,
      title: draft.title,
      position: 1,
      explicit: draft.explicit === true,
      instrumental: draft.instrumental === true,
    };
    if (!trackBody.instrumental && draft.language) trackBody.language = draft.language;
    return post(TRACKS_URL, trackBody, key).then(function (result) {
      if (isUnavailable(result)) {
        return { unavailable: true, result: result, draft: draft };
      }
      if (!result.ok) {
        return { failed: true, result: result, draft: draft };
      }
      var trackId = pickUuid(result.data);
      var next = draft;
      if (trackId) next = writeDraft({ track_id: trackId });
      if (next.artist_id || next.release_id || trackId) {
        saveCatalog({ artist_id: next.artist_id, release_id: next.release_id, track_id: trackId });
      }
      return { created: true, draft: next, result: result };
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

  function showUploadLoader(step, percent) {
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
    if (meta) meta.textContent = hasPercent ? Math.round(percent) + '%' : '';
  }

  function hideUploadLoader() {
    var loader = document.querySelector('[data-upload-loader]');
    if (!loader) return;
    loader.hidden = true;
    if (loader.classList && loader.classList.add) loader.classList.add('is-hidden');
  }

  function postForm(url, body, onProgress) {
    if (typeof XMLHttpRequest === 'function') {
      return new Promise(function (resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Accept', 'application/json');
        if (xhr.upload && typeof onProgress === 'function') {
          xhr.upload.onprogress = function (event) {
            if (event && event.lengthComputable && event.total) {
              onProgress(Math.round((event.loaded / event.total) * 100));
            }
          };
        }
        xhr.onerror = function () {
          resolve({ ok: false, status: 0, data: { error: 'Could not reach catalog.' } });
        };
        xhr.onload = function () {
          var data = {};
          try { data = JSON.parse(xhr.responseText || '{}') || {}; } catch (err) { data = {}; }
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data: data });
        };
        xhr.send(body);
      });
    }
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      body: body,
    }).then(parseJson);
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
      var body = new FormData();
      body.append('audio', file, file.name || 'audio.wav');
      return postForm(TRACKS_URL + '/' + encodeURIComponent(trackId) + '/audio', body, onProgress).then(function (result) {
        if (isUnavailable(result)) return { unavailable: true, result: result };
        if (!result.ok) return { failed: true, result: result };
        return { uploaded: true, result: result };
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

  function afterRelease(draft) {
    return createTrack(draft).then(function (track) {
      var next = track.draft || draft;
      if (track.unavailable || track.failed) return track;
      var file = selectedAudio();
      var art = selectedArtwork();
      var chain = Promise.resolve({ ok: true, draft: next, track: track });
      if (file && next.track_id) {
        if (isMp3File(file)) {
          showUploadLoader('Converting MP3 to WAV');
          setStatus('tg-status', 'Converting MP3 to WAV…');
        } else {
          showUploadLoader('Uploading audio');
          setStatus('tg-status', 'Uploading audio…');
        }
        chain = uploadAudio(next.track_id, file, function (percent) {
          showUploadLoader('Uploading audio', percent);
        }).then(function (audio) {
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

  function createRelease(draft, releaseDate) {
    if (draft.release_id) {
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
      var next = draft;
      if (releaseId) next = writeDraft({ release_id: releaseId, release_date: releaseDate || draft.release_date || '' });
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

  function artistCheckApi() {
    return (typeof PlaigroundArtistCheck !== 'undefined' && PlaigroundArtistCheck) || null;
  }

  function rosterFromMe(me) {
    var row = me || accountRecord() || {};
    var artists = row.profile && Array.isArray(row.profile.artists) ? row.profile.artists.slice() : [];
    if (!artists.length && row.artist) {
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
    if (!sel || sel.selectedIndex < 0 || !sel.options) return null;
    var opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) return null;
    return { id: String(opt.value), name: String(opt.getAttribute('data-name') || opt.textContent || '').trim() };
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
    var language = fieldValue('tg-language').toLowerCase();
    if (!/^[a-z]{2}$/.test(language)) language = '';
    if (instrumental) language = '';
    return {
      audio: selectedAudio(),
      artwork: selectedArtwork(),
      title: fieldValue('tg-title'),
      name: syncArtistHidden() || fieldValue('tg-artist'),
      featured: fieldValue('tg-featured'),
      genre: fieldValue('tg-genre'),
      language: language,
      price: fieldValue('tg-price'),
      explicit: selectedExplicit(),
      instrumental: instrumental,
      dsps: selectedUploadStores(),
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

  function persistStorePick(slugs, allOn) {
    writeDraft({ dsps: slugs || [], dsps_all: allOn !== false });
  }

  function bindStorePick(root, selected) {
    if (!root || typeof PlaigroundStorePick === 'undefined') return;
    var draft = readDraft();
    var picked = Array.isArray(selected) ? selected : (Array.isArray(draft.dsps) ? draft.dsps : null);
    function apply(stores) {
      PlaigroundStorePick.bind(root, {
        stores: stores,
        selected: picked && picked.length ? picked : null,
        onChange: persistStorePick,
      });
    }
    var fallback = PlaigroundStorePick.DEFAULT_STORES || [];
    getJson('/api/tonegrid/stores').then(function (result) {
      apply((result.ok && result.data && result.data.stores) || fallback);
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
    if (!fields.audio) return 'Audio is required.';
    if (!fields.artwork) return 'Artwork is required.';
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
    if (releaseId) {
      if (!artistId && catalog.artist_id) patch.artist_id = catalog.artist_id;
      if (!trackId && onlyTrack) patch.track_id = onlyTrack;
      return Object.keys(patch).length ? writeDraft(patch) : draft;
    }
    if (artistId && onlyRelease && (!catalog.artist_id || sameUuid(artistId, catalog.artist_id))) {
      patch.release_id = onlyRelease;
      if (!trackId && onlyTrack) patch.track_id = onlyTrack;
      return writeDraft(patch);
    }
    if (!artistId && !releaseId && (catalog.artist_id || onlyRelease)) {
      if (catalog.artist_id) patch.artist_id = catalog.artist_id;
      if (onlyRelease) patch.release_id = onlyRelease;
      if (onlyTrack) patch.track_id = onlyTrack;
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

  function showLimitPanel(show) {
    var el = $('tg-limit');
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

    function fillSelect(artists) {
      var sel = $('tg-artist-select');
      if (!sel) return;
      var current = sel.value;
      sel.textContent = '';
      var blank = document.createElement('option');
      blank.value = '';
      blank.textContent = artists.length ? 'Select an artist' : 'No artist profiles yet';
      sel.appendChild(blank);
      artists.forEach(function (artist) {
        var opt = document.createElement('option');
        opt.value = artist.id;
        opt.setAttribute('data-name', artist.name);
        opt.textContent = artist.name + (artist.badge ? ' · ' + artist.badge : '');
        sel.appendChild(opt);
      });
      if (current) sel.value = current;
      else if (artists.length === 1) sel.value = artists[0].id;
    }

    function liveNameCheck() {
      var api = artistCheckApi();
      var msg = $('artist-name-check');
      var yellow = $('artist-yellow-actions');
      var red = $('artist-red-actions');
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
    });
    showMode(modeEl.value || 'choose');

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
        setStatus('tg-status', 'This name will be held for review and will not go to ToneGrid automatically.');
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
      if (!picked || !picked.name) {
        return Promise.resolve({ error: 'Choose an artist profile.' });
      }
      var existing = null;
      artists.forEach(function (row) { if (row.id === picked.id) existing = row; });
      return Promise.resolve({
        name: picked.name,
        id: picked.id === 'account' ? '' : picked.id,
        check: { level: (existing && existing.name_check) || 'green' },
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

  function bindUpload() {
    var trigger = document.querySelector('[data-tonegrid-continue]');
    if (!trigger) return;
    bindArtistSection();
    bindStorePick(storePickRoot());
    var uploadRunning = false;

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

    function failUpload(message, upgrade) {
      setUploadBusy(false);
      markIncomplete(trigger, false);
      setStatus('tg-status', message || '');
      markStatusError(Boolean(message));
      showLimitPanel(upgrade === true);
      showUpgrade(upgrade === true);
    }

    function finishToAttest(nextHref, message) {
      showUploadLoader('Opening SignWell');
      setStatus('tg-status', message || 'Opening SignWell…');
      continueAfterCatalog(nextHref, message);
    }

    function refreshUploadGate() {
      syncLanguageField(selectedInstrumental());
      markIncomplete(trigger, Boolean(uploadPageError(collectUploadFields())));
    }
    ['tg-title', 'tg-artist', 'tg-artist-new', 'tg-artist-select', 'tg-artist-mode', 'tg-artist-link', 'tg-artist-link-name', 'tg-featured', 'tg-genre', 'tg-language', 'tg-price', 'tg-instrumental'].forEach(function (id) {
      var el = $(id);
      if (!el || !el.addEventListener) return;
      el.addEventListener('input', refreshUploadGate);
      el.addEventListener('change', refreshUploadGate);
    });
    var audioInput = document.querySelector('[data-audio-input]');
    if (audioInput && audioInput.addEventListener) {
      audioInput.addEventListener('change', refreshUploadGate);
    }
    var artInput = document.querySelector('[data-art-input]');
    if (artInput && artInput.addEventListener) {
      artInput.addEventListener('change', refreshUploadGate);
    }
    var savedDraft = readDraft();
    var instEl = $('tg-instrumental');
    if (instEl && savedDraft.instrumental === true) instEl.checked = true;
    refreshUploadGate();
    showUpgrade(false);
    showLimitPanel(false);
    whenAccountReady().then(function (result) {
      var me = (result && result.data) || accountRecord();
      var catalog = catalogFromAccount(me);
      var draft = readDraft();
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
    }

    function afterCatalogReady(draft, nextHref) {
      showUploadLoader('Creating track');
      setStatus('tg-status', 'Creating track…');
      return afterRelease(draft).then(function (next) {
        if (next && next.unavailable) {
          finishToAttest(nextHref, 'Catalog sync is not configured yet.');
          return;
        }
        if (next && next.failed) {
          failUpload((next.result && next.result.data && next.result.data.error) || 'Could not create the track.');
          return;
        }
        if (next && next.audio && next.audio.failed) {
          failUpload((next.audio.result && next.audio.result.data && next.audio.result.data.error) || 'Could not upload audio.');
          return;
        }
        if (next && next.audio && next.audio.unavailable) {
          finishToAttest(nextHref, 'Catalog sync is not configured yet.');
          return;
        }
        if (next && next.artwork && next.artwork.failed) {
          failUpload((next.artwork.result && next.artwork.result.data && next.artwork.result.data.error) || 'Could not upload artwork.');
          return;
        }
        if (next && next.artwork && next.artwork.unavailable) {
          finishToAttest(nextHref, 'Catalog sync is not configured yet.');
          return;
        }
        finishToAttest(nextHref);
      });
    }

    function afterArtistReady(draft, nextHref) {
      if (draft.release_id) {
        return afterCatalogReady(draft, nextHref);
      }
      showUploadLoader('Creating release');
      setStatus('tg-status', 'Creating release…');
      return createRelease(draft, '').then(function (created) {
        if (created.unavailable) {
          finishToAttest(nextHref, 'Catalog sync is not configured yet.');
          return;
        }
        if (created.limited) {
          failUpload(createErrorMessage(created.result, 'Basic includes one release. Upgrade to Creator or Pro to upload more.'), true);
          return;
        }
        if (created.failed) {
          failUpload(created.result.data.error || 'Could not create release.', false);
          return;
        }
        return afterCatalogReady(created.draft || draft, nextHref).then(function () {
          return recordLocalRelease(created.draft || draft, {
            id: (created.draft || draft).plaiground_artist_id,
            check: { level: (created.draft || draft).artist_check },
          });
        });
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
      var file = fields.audio;
      var art = fields.artwork;
      var nextHref = trigger.getAttribute('href') || 'attest.html';
      var pageError = uploadPageError(fields);
      if (pageError) {
        fieldError(pageError);
        return;
      }
      if (file && file.size > MAX_AUDIO_BYTES) {
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
      writeDraft({
        name: name,
        title: title,
        genre: genre,
        language: language,
        price: price,
        featured: featured,
        type: 'single',
        explicit: explicit,
        instrumental: instrumental,
        dsps: dsps,
        artwork_name: art && art.name ? art.name : '',
        artwork_type: art && art.type ? art.type : '',
        title_check: titleCheck,
      });
      setUploadBusy(true);
      markStatusError(false);
      showLimitPanel(false);
      showUpgrade(false);

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
            type: 'single',
            explicit: explicit,
            instrumental: instrumental,
            dsps: dsps,
            artwork_name: art && art.name ? art.name : '',
            artwork_type: art && art.type ? art.type : '',
            title_check: titleCheck,
          }), me);
          var catalog = catalogFromAccount(me);
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
                finishToAttest(nextHref, 'This artist name is held for review and was not sent to ToneGrid.');
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
                  finishToAttest(nextHref, 'This artist name is held for review and was not sent to ToneGrid.');
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

      if (file) {
        fileLooksAllowed(file).then(function (ok) {
          if (!ok) {
            fieldError(AUDIO_ERROR);
            return;
          }
          startUpload();
        });
        return;
      }
      startUpload();
    });
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
    if (draft && (draft.pending_review || draft.artist_check === 'red')) {
      writeDraft({ tonegrid_status: 'pending_review', submitted: true });
      return recordLocalRelease(readDraft(), {
        id: draft.plaiground_artist_id,
        check: { level: 'red' },
      }).then(function () {
        if (trigger) trigger.removeAttribute('aria-busy');
        setStatus('tg-status', 'Held for review. This name was not sent to ToneGrid.');
        if (nextHref) go(nextHref);
      });
    }
    var solo = isSoloOwned(draft);
    setStatus('tg-status', solo ? 'Submitting to ToneGrid…' : 'Sending split sheet…');
    var ready = solo ? Promise.resolve(draft) : refreshSignWellDraft(draft);
    return ready.then(function (next) {
      setStatus('tg-status', 'Submitting to ToneGrid…');
      return submitRelease(next || draft, releaseDate).then(function (sent) {
        if (trigger) trigger.removeAttribute('aria-busy');
        if (sent.unavailable) {
          continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
          return;
        }
        if (sent.unsigned || sent.trial || sent.failed) {
          setStatus('tg-status', createErrorMessage(sent.result, 'Could not submit the release.'));
          return;
        }
        var toneStatus = (sent.result && sent.result.data && sent.result.data.status) || 'pending';
        var sheetStatus = (sent.result && sent.result.data && sent.result.data.signwell_status) || '';
        setStatus('tg-status', sheetStatus && sheetStatus !== 'solo' && sheetStatus !== 'Completed'
          ? 'ToneGrid status: ' + toneStatus + ' · awaiting signature'
          : 'ToneGrid status: ' + toneStatus);
        if (nextHref) go(nextHref);
      });
    });
  }

  function bindReview() {
    var trigger = document.querySelector('[data-tonegrid-submit]');
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
          if (reviewed && reviewed.error) reviewError = reviewed.error;
        } else if (!releaseDate) {
          reviewError = 'Release date is required.';
        }
        if (reviewError) {
          setStatus('tg-status', reviewError);
          markIncomplete(trigger, true);
          return;
        }
        draft = writeDraft({ release_date: releaseDate, dsps: selectedUploadStores() });

        if (!draft.artist_id) {
          setStatus('tg-status', 'Save the upload details first so a catalog artist exists.');
          return;
        }
        if (!isSoloOwned(draft) && !documentIdOf(draft)) {
          setStatus('tg-status', 'Create the split sheet before submitting.');
          return;
        }
        if (!draft.release_id && !draft.title) {
          setStatus('tg-status', 'Song title is required.');
          return;
        }

        trigger.setAttribute('aria-busy', 'true');
        if (draft.release_id) {
          finishSubmit(draft, releaseDate, trigger, nextHref).catch(function () {
            trigger.removeAttribute('aria-busy');
            setStatus('tg-status', 'Could not reach catalog.');
          });
          return;
        }

        setStatus('tg-status', 'Creating release…');
        createRelease(draft, releaseDate)
          .then(function (created) {
            if (created.unavailable) {
              trigger.removeAttribute('aria-busy');
              continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
              return;
            }
            if (created.limited) {
              trigger.removeAttribute('aria-busy');
              setStatus('tg-status', createErrorMessage(created.result, 'Basic includes one release. Upgrade to Creator or Pro to upload more.'));
              showUpgrade(true);
              return;
            }
            if (created.failed) {
              trigger.removeAttribute('aria-busy');
              setStatus('tg-status', created.result.data.error || 'Could not create release.');
              showUpgrade(false);
              return;
            }
            return afterRelease(created.draft || draft).then(function (next) {
              if (next && next.failed) {
                trigger.removeAttribute('aria-busy');
                setStatus('tg-status', (next.result && next.result.data && next.result.data.error) || 'Could not create the track.');
                return;
              }
              return finishSubmit(next && next.draft ? next.draft : (created.draft || draft), releaseDate, trigger, nextHref);
            });
          })
          .catch(function () {
            trigger.removeAttribute('aria-busy');
            setStatus('tg-status', 'Could not reach catalog.');
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
        var syncPickedDate = function () {
          var picked = persistReleaseDate(dateEl);
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
        /* stay on review after auto-submit so the exact ToneGrid status is visible */
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
  }

  function fillSubmitted() {
    var titleEl = document.querySelector('[data-submit-title]');
    if (!titleEl) return;
    var draft = readDraft();
    if (draft.title) titleEl.textContent = draft.title + ' is in the queue.';
    if (draft.tonegrid_status) setStatus('tg-status', 'ToneGrid status: ' + draft.tonegrid_status);
    var view = document.querySelector('a[href="song.html"]');
    if (view && draft.release_id) view.setAttribute('href', 'song.html?id=' + encodeURIComponent(draft.release_id));
  }

  function bindSubmitted() {
    fillSubmitted();
    if (!$('tg-status') && !document.querySelector('[data-submit-title]')) return;
    var draft = readDraft();
    if (!draft.artist_id || !draft.title) return;
    var afterCreate = function (nextDraft) {
      if (nextDraft.submitted) return;
      if (!documentIdOf(nextDraft) && !isSoloOwned(nextDraft)) {
        setStatus('tg-status', 'Create the split sheet before submitting.');
        return;
      }
      return submitRelease(nextDraft, nextDraft.release_date || '').then(function (sent) {
        if (sent.unsigned || sent.trial || sent.failed) {
          setStatus('tg-status', createErrorMessage(sent.result, 'Could not submit the release.'));
          return;
        }
        if (sent.submitted) setStatus('tg-status', 'ToneGrid status: ' + ((sent.result && sent.result.data && sent.result.data.status) || 'pending'));
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
      return afterRelease(created.draft || draft).then(function (next) {
        if (next && next.failed) {
          setStatus('tg-status', (next.result && next.result.data && next.result.data.error) || 'Could not create the track.');
          return;
        }
        return afterCreate(next && next.draft ? next.draft : (created.draft || draft));
      });
    }).catch(function () {
      setStatus('tg-status', 'Could not reach catalog.');
    });
  }

  bindUpload();
  bindReview();
  fillReviewSummary();
  bindSubmitted();
})();
