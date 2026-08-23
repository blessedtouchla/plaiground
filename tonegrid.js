(function () {
  var ARTISTS_URL = '/api/tonegrid/artists';
  var RELEASES_URL = '/api/tonegrid/releases';
  var TRACKS_URL = '/api/tonegrid/tracks';
  var LANGUAGES_URL = '/api/tonegrid/languages';
  var GENRES_URL = '/api/tonegrid/genres';
  var STORES_URL = '/api/tonegrid/stores';
  var DRAFT_KEY = 'plaiground.tonegrid.draft';
  var MAX_AUDIO_BYTES = 200 * 1024 * 1024;

  function $(id) {
    return document.getElementById(id);
  }

  function fieldValue(id) {
    var el = $(id);
    return el ? String(el.value || '').trim() : '';
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
    if (isDemoCopy(draft.language)) draft.language = '';
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

  function createErrorMessage(result, fallback) {
    if (result && result.data && result.data.error) return result.data.error;
    return fallback;
  }

  function releasePayload(draft, releaseDate) {
    var body = {
      artist_id: draft.artist_id,
      title: draft.title,
      type: draft.type || 'single',
    };
    if (draft.genre) body.genre = draft.genre;
    if (draft.language) body.language = draft.language;
    if (releaseDate) body.release_date = releaseDate;
    if (draft.stores && draft.stores.length) body.stores = draft.stores;
    return body;
  }

  function selectedAudio() {
    var input = document.querySelector('[data-audio-input]');
    if (input && input.files && input.files[0]) return input.files[0];
    if (input && input._plaigroundFile) return input._plaigroundFile;
    return null;
  }

  function selectedExplicit() {
    var on = document.querySelector('[data-explicit].on, [data-explicit-toggle] .on');
    if (on && on.getAttribute('data-explicit') === 'true') return true;
    var draft = readDraft();
    return draft.explicit === true;
  }

  function isAudioFile(file) {
    if (!file) return false;
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    return /\.(wav|flac)$/.test(name) || /audio\/(wav|x-wav|flac|x-flac)/.test(type);
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
    writeDraft({ track_idempotency_key: key });
    var trackBody = {
      release_id: draft.release_id,
      title: draft.title,
      position: 1,
      explicit: draft.explicit === true,
    };
    if (draft.language) trackBody.language = draft.language;
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

  function uploadAudio(trackId, file) {
    if (!trackId || !file) return Promise.resolve({ skipped: true });
    if (file.size > MAX_AUDIO_BYTES) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Audio must be 200 MB or smaller.' } } });
    }
    if (!isAudioFile(file)) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Audio must be WAV or FLAC.' } } });
    }
    var body = new FormData();
    body.append('audio', file, file.name || 'audio.wav');
    return fetch(TRACKS_URL + '/' + encodeURIComponent(trackId) + '/audio', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      body: body,
    }).then(parseJson).then(function (result) {
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
      if (!file || !next.track_id) return { ok: true, draft: next, track: track };
      setStatus('tg-status', 'Uploading audio…');
      return uploadAudio(next.track_id, file).then(function (audio) {
        return { ok: !audio.failed && !audio.unavailable, draft: next, track: track, audio: audio };
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
    writeDraft({ release_idempotency_key: key });
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

  function bindUpload() {
    var trigger = document.querySelector('[data-tonegrid-continue]');
    if (!trigger) return;

    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      if (trigger.getAttribute('aria-busy') === 'true') return;

      var name = fieldValue('tg-artist');
      var title = fieldValue('tg-title');
      var genre = fieldValue('tg-genre');
      var language = fieldValue('tg-language');
      var explicit = selectedExplicit();
      var file = selectedAudio();
      var nextHref = trigger.getAttribute('href') || 'attest.html';

      if (!name) {
        setStatus('tg-status', 'Primary artist is required.');
        return;
      }
      if (!title) {
        setStatus('tg-status', 'Song title is required.');
        return;
      }
      if (file && file.size > MAX_AUDIO_BYTES) {
        setStatus('tg-status', 'Audio must be 200 MB or smaller.');
        return;
      }
      if (file && !isAudioFile(file)) {
        setStatus('tg-status', 'Audio must be WAV or FLAC.');
        return;
      }

      writeDraft({ name: name, title: title, genre: genre, language: language, type: 'single', explicit: explicit });
      trigger.setAttribute('aria-busy', 'true');
      setStatus('tg-status', 'Saving artist…');

      post(ARTISTS_URL, { name: name })
        .then(function (result) {
          if (isUnavailable(result)) {
            trigger.removeAttribute('aria-busy');
            continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
            return;
          }
          if (isPlanLimit(result)) {
            trigger.removeAttribute('aria-busy');
            setStatus('tg-status', createErrorMessage(result, 'Basic includes one release. Upgrade to Creator or Pro to upload more.'));
            showUpgrade(true);
            return;
          }
          if (!result.ok) {
            trigger.removeAttribute('aria-busy');
            setStatus('tg-status', result.data.error || 'Could not save artist.');
            showUpgrade(false);
            return;
          }
          var artistId = pickUuid(result.data);
          var draft = writeDraft({
            artist_id: artistId,
            name: name,
            title: title,
            genre: genre,
            language: language,
            type: 'single',
            explicit: explicit,
          });
          if (artistId) saveCatalog({ artist_id: artistId });
          if (!artistId) {
            trigger.removeAttribute('aria-busy');
            continueAfterCatalog(nextHref, 'Artist saved. Release will retry on the next step.');
            return;
          }
          setStatus('tg-status', 'Creating release…');
          return createRelease(draft, '').then(function (created) {
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
            setStatus('tg-status', 'Creating track…');
            return afterRelease(created.draft || draft).then(function (next) {
              trigger.removeAttribute('aria-busy');
              if (next && next.unavailable) {
                continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
                return;
              }
              if (next && next.failed) {
                setStatus('tg-status', (next.result && next.result.data && next.result.data.error) || 'Could not create the track.');
                return;
              }
              if (next && next.audio && next.audio.failed) {
                setStatus('tg-status', (next.audio.result && next.audio.result.data && next.audio.result.data.error) || 'Could not upload audio.');
                return;
              }
              if (next && next.audio && next.audio.unavailable) {
                continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
                return;
              }
              continueAfterCatalog(nextHref);
            });
          });
        })
        .catch(function () {
          trigger.removeAttribute('aria-busy');
          setStatus('tg-status', 'Could not reach catalog.');
        });
    });
  }

  function bindReview() {
    var trigger = document.querySelector('[data-tonegrid-submit]');
    if (!trigger) return;

    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      if (trigger.getAttribute('aria-busy') === 'true') return;

      var draft = readDraft();
      var nextHref = trigger.getAttribute('href') || 'submitted.html';
      var releaseDate = fieldValue('tg-release-date');
      var stores = selectedStores();
      var patch = {};
      if (releaseDate) patch.release_date = releaseDate;
      if (stores && stores.length) patch.stores = stores;
      if (Object.keys(patch).length) draft = writeDraft(patch);

      if (!draft.artist_id) {
        setStatus('tg-status', 'Save the upload details first so a catalog artist exists.');
        return;
      }

      if (draft.release_id) {
        go(nextHref);
        return;
      }

      if (!draft.title) {
        setStatus('tg-status', 'Song title is required.');
        return;
      }

      trigger.setAttribute('aria-busy', 'true');
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
            trigger.removeAttribute('aria-busy');
            if (next && next.failed) {
              setStatus('tg-status', (next.result && next.result.data && next.result.data.error) || 'Could not create the track.');
              return;
            }
            go(nextHref);
          });
        })
        .catch(function () {
          trigger.removeAttribute('aria-busy');
          setStatus('tg-status', 'Could not reach catalog.');
        });
    });
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
  }

  function bindSubmitted() {
    fillSubmitted();
    if (!$('tg-status') && !document.querySelector('[data-submit-title]')) return;
    var draft = readDraft();
    if (!draft.artist_id || draft.release_id || !draft.title) return;
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
        if (created.created || (next && next.created)) setStatus('tg-status', 'Release saved to the catalog.');
      });
    }).catch(function () {
      setStatus('tg-status', 'Could not reach catalog.');
    });
  }

  function fillSelect(el, items, selected) {
    if (!el) return;
    var current = selected || el.value || '';
    var placeholder = el.querySelector('option[value=""]');
    el.textContent = '';
    if (placeholder) el.appendChild(placeholder);
    else {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = el.getAttribute('data-placeholder') || 'Select';
      el.appendChild(empty);
    }
    (items || []).forEach(function (item) {
      var opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      el.appendChild(opt);
    });
    if (current) el.value = current;
  }

  function loadJson(url) {
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(parseJson)
      .catch(function () {
        return { ok: false, status: 0, data: {} };
      });
  }

  function fillCatalogLists() {
    var genreEl = $('tg-genre');
    var languageEl = $('tg-language');
    var draft = readDraft();
    if (genreEl && genreEl.getAttribute('data-tg-list') === 'genres') {
      loadJson(GENRES_URL).then(function (result) {
        var rows = (result.data && result.data.genres) || [];
        fillSelect(genreEl, rows.map(function (name) {
          return { value: name, label: name };
        }), draft.genre);
      });
    }
    if (languageEl && languageEl.getAttribute('data-tg-list') === 'languages') {
      loadJson(LANGUAGES_URL).then(function (result) {
        var rows = (result.data && result.data.languages) || [];
        fillSelect(languageEl, rows.map(function (row) {
          return { value: row.code || row.value, label: row.name || row.label || row.code };
        }), draft.language);
      });
    }
  }

  function selectedStores() {
    var host = document.querySelector('[data-tg-stores]');
    if (!host) return [];
    var boxes = host.querySelectorAll('input[type="checkbox"][data-store-slug]');
    var out = [];
    boxes.forEach(function (box) {
      if (box.checked) out.push(box.getAttribute('data-store-slug'));
    });
    return out;
  }

  function renderStores(payload) {
    var host = document.querySelector('[data-tg-stores]');
    if (!host) return;
    var stores = (payload && payload.stores) || [];
    var draft = readDraft();
    var chosen = Array.isArray(draft.stores) ? draft.stores : null;
    host.textContent = '';
    stores.forEach(function (row) {
      var slug = row.slug || row.value;
      if (!slug) return;
      var label = document.createElement('label');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.setAttribute('data-store-slug', slug);
      box.checked = !chosen || chosen.indexOf(slug) !== -1;
      var name = document.createElement('span');
      name.textContent = row.name || slug;
      label.appendChild(box);
      label.appendChild(name);
      host.appendChild(label);
    });
    var count = document.querySelector('[data-store-count]');
    if (count) {
      var on = selectedStores().length;
      count.textContent = stores.length ? (on + ' of ' + stores.length + ' stores') : 'No stores returned.';
    }
  }

  function bindStoreToggles() {
    function setChecked(on) {
      var host = document.querySelector('[data-tg-stores]');
      if (!host) return;
      var boxes = host.querySelectorAll('input[type="checkbox"][data-store-slug]');
      boxes.forEach(function (box) { box.checked = on; });
      var count = document.querySelector('[data-store-count]');
      if (count) count.textContent = (on ? boxes.length : 0) + ' of ' + boxes.length + ' stores';
    }
    var all = document.querySelector('[data-store-all]');
    var none = document.querySelector('[data-store-none]');
    if (all) all.addEventListener('click', function (event) {
      event.preventDefault();
      setChecked(true);
    });
    if (none) none.addEventListener('click', function (event) {
      event.preventDefault();
      setChecked(false);
    });
  }

  function fillStores() {
    if (!document.querySelector('[data-tg-stores]')) return;
    loadJson(STORES_URL).then(function (result) {
      renderStores(result.data || {});
    });
  }

  bindUpload();
  bindReview();
  fillReviewSummary();
  bindSubmitted();
  fillCatalogLists();
  bindStoreToggles();
  fillStores();
})();
