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

  function documentIdOf(draft) {
    return String((draft && (draft.signwell_document_id || draft.document_id)) || '').trim();
  }

  function checkSignWell(documentId) {
    if (!documentId) {
      return Promise.resolve({
        ok: false,
        status: 403,
        data: { signed: false, error: 'Sign the split sheet in SignWell before submitting.', code: 'SIGNWELL_REQUIRED' },
      });
    }
    return getJson('/api/signwell?id=' + encodeURIComponent(documentId));
  }

  function submitRelease(draft, releaseDate) {
    if (!draft || !draft.release_id) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Save the upload details first so a catalog release exists.' } } });
    }
    var documentId = documentIdOf(draft);
    if (!documentId) {
      return Promise.resolve({
        unsigned: true,
        result: { data: { error: 'Sign the split sheet in SignWell before submitting.', code: 'SIGNWELL_REQUIRED' } },
      });
    }
    var date = releaseDate || draft.release_date || '';
    if (!String(date || '').trim()) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Release date is required.' } } });
    }
    var submitBody = {
      document_id: documentId,
      release_date: date,
      made_how: draft.made_how || '',
      human_elements: Array.isArray(draft.human_elements) ? draft.human_elements : [],
      human_contribution: draft.human_contribution || '',
      rights_confirmed: draft.rights_confirmed === true,
    };
    return post('/api/tonegrid/releases/' + encodeURIComponent(draft.release_id) + '/submit', submitBody, 'plaiground-submit-' + draft.release_id).then(function (result) {
      if (isUnavailable(result)) return { unavailable: true, result: result };
      if (result.data && result.data.code === 'SIGNWELL_UNSIGNED') return { unsigned: true, result: result };
      if (result.data && result.data.code === 'SIGNWELL_TRIAL') return { trial: true, result: result };
      if (result.data && result.data.code === 'SIGNWELL_REQUIRED') return { unsigned: true, result: result };
      if (!result.ok) return { failed: true, result: result };
      var next = writeDraft({
        submitted: true,
        tonegrid_status: result.data.status || 'pending',
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
      language: draft.language || '',
      price: draft.price || '',
    };
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

  function isAudioFile(file) {
    if (!file) return false;
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    return /\.(wav|flac|mp3)$/.test(name) || /audio\/(wav|x-wav|flac|x-flac|mpeg|mp3)/.test(type);
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
      language: draft.language || '',
    };
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

  function uploadArtwork(releaseId, file) {
    if (!releaseId || !file) return Promise.resolve({ skipped: true });
    if (file.size > MAX_ARTWORK_BYTES) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Artwork must be 15 MB or smaller.' } } });
    }
    if (!isArtFile(file)) {
      return Promise.resolve({ failed: true, result: { data: { error: 'Artwork must be JPG or PNG.' } } });
    }
    var body = new FormData();
    body.append('artwork', file, file.name || 'artwork.jpg');
    return fetch(RELEASES_URL + '/' + encodeURIComponent(releaseId) + '/artwork', {
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
      var art = selectedArtwork();
      var chain = Promise.resolve({ ok: true, draft: next, track: track });
      if (file && next.track_id) {
        setStatus('tg-status', 'Uploading audio…');
        chain = uploadAudio(next.track_id, file).then(function (audio) {
          return { ok: !audio.failed && !audio.unavailable, draft: next, track: track, audio: audio };
        });
      }
      return chain.then(function (result) {
        if (!result.ok || result.failed || result.unavailable) return result;
        if (!art || !next.release_id) return result;
        setStatus('tg-status', 'Uploading artwork…');
        return uploadArtwork(next.release_id, art).then(function (artwork) {
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

  function collectUploadFields() {
    var language = fieldValue('tg-language').toLowerCase();
    if (!/^[a-z]{2}$/.test(language)) language = '';
    return {
      audio: selectedAudio(),
      artwork: selectedArtwork(),
      title: fieldValue('tg-title'),
      name: fieldValue('tg-artist'),
      featured: fieldValue('tg-featured'),
      genre: fieldValue('tg-genre'),
      language: language,
      price: fieldValue('tg-price'),
      explicit: selectedExplicit(),
    };
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
    if (!fields.language) return 'Language is required.';
    if (!fields.price) return 'Download price is required.';
    return '';
  }

  function markIncomplete(el, incomplete) {
    if (!el) return;
    if (el.classList && el.classList.toggle) el.classList.toggle('is-incomplete', Boolean(incomplete));
  }

  function bindUpload() {
    var trigger = document.querySelector('[data-tonegrid-continue]');
    if (!trigger) return;

    function refreshUploadGate() {
      markIncomplete(trigger, Boolean(uploadPageError(collectUploadFields())));
    }
    ['tg-title', 'tg-artist', 'tg-featured', 'tg-genre', 'tg-language', 'tg-price'].forEach(function (id) {
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
    refreshUploadGate();

    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      if (trigger.getAttribute('aria-busy') === 'true') return;

      var fields = collectUploadFields();
      var name = fields.name;
      var title = fields.title;
      var genre = fields.genre;
      var language = fields.language;
      var price = fields.price;
      var featured = fields.featured;
      var explicit = fields.explicit;
      var file = fields.audio;
      var art = fields.artwork;
      var nextHref = trigger.getAttribute('href') || 'attest.html';
      var pageError = uploadPageError(fields);
      if (pageError) {
        setStatus('tg-status', pageError);
        markIncomplete(trigger, true);
        return;
      }
      if (file && file.size > MAX_AUDIO_BYTES) {
        setStatus('tg-status', 'Audio must be 200 MB or smaller.');
        return;
      }
      if (file && !isAudioFile(file)) {
        setStatus('tg-status', 'Audio must be WAV, FLAC, or MP3.');
        return;
      }
      if (art && art.size > MAX_ARTWORK_BYTES) {
        setStatus('tg-status', 'Artwork must be 15 MB or smaller.');
        return;
      }
      if (art && !isArtFile(art)) {
        setStatus('tg-status', 'Artwork must be JPG or PNG.');
        return;
      }

      writeDraft({
        name: name,
        title: title,
        genre: genre,
        language: language,
        price: price,
        featured: featured,
        type: 'single',
        explicit: explicit,
        artwork_name: art && art.name ? art.name : '',
        artwork_type: art && art.type ? art.type : '',
      });
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
            price: price,
            featured: featured,
            type: 'single',
            explicit: explicit,
            artwork_name: art && art.name ? art.name : '',
            artwork_type: art && art.type ? art.type : '',
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
              if (next && next.artwork && next.artwork.failed) {
                setStatus('tg-status', (next.artwork.result && next.artwork.result.data && next.artwork.result.data.error) || 'Could not upload artwork.');
                return;
              }
              if (next && next.artwork && next.artwork.unavailable) {
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

  function finishSubmit(draft, releaseDate, trigger, nextHref) {
    setStatus('tg-status', 'Checking SignWell…');
    return checkSignWell(documentIdOf(draft)).then(function (gate) {
      if (!gate.ok || !gate.data.signed) {
        if (trigger) trigger.removeAttribute('aria-busy');
        setStatus('tg-status', createErrorMessage(gate, 'Sign the split sheet in SignWell before submitting.'));
        return;
      }
      setStatus('tg-status', 'Submitting to ToneGrid…');
      return submitRelease(draft, releaseDate).then(function (sent) {
        if (trigger) trigger.removeAttribute('aria-busy');
        if (sent.unavailable) {
          continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
          return;
        }
        if (sent.unsigned || sent.trial || sent.failed) {
          setStatus('tg-status', createErrorMessage(sent.result, 'Could not submit the release.'));
          return;
        }
        setStatus('tg-status', 'ToneGrid status: ' + ((sent.result && sent.result.data && sent.result.data.status) || 'pending'));
        if (nextHref) go(nextHref);
      });
    });
  }

  function bindReview() {
    var trigger = document.querySelector('[data-tonegrid-submit]');
    var onReview = Boolean(trigger || document.querySelector('[data-review-title]'));
    if (!onReview) return;

    if (trigger) {
      trigger.addEventListener('click', function (event) {
        event.preventDefault();
        if (trigger.getAttribute('aria-busy') === 'true') return;

        var draft = readDraft();
        var nextHref = trigger.getAttribute('href') || 'submitted.html';
        var releaseDate = fieldValue('tg-release-date');
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
        draft = writeDraft({ release_date: releaseDate });

        if (!draft.artist_id) {
          setStatus('tg-status', 'Save the upload details first so a catalog artist exists.');
          return;
        }
        if (!documentIdOf(draft)) {
          setStatus('tg-status', 'Sign the split sheet in SignWell before submitting.');
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
    var readyDate = draft.release_date || fieldValue('tg-release-date');
    if (trigger) {
      markIncomplete(trigger, !String(readyDate || '').trim());
      var dateEl = $('tg-release-date');
      if (dateEl && dateEl.addEventListener) {
        dateEl.addEventListener('input', function () {
          markIncomplete(trigger, !fieldValue('tg-release-date'));
        });
        dateEl.addEventListener('change', function () {
          markIncomplete(trigger, !fieldValue('tg-release-date'));
        });
      }
    }
    if (draft.release_id && documentIdOf(draft) && !draft.submitted && String(readyDate || '').trim()) {
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
  }

  function bindSubmitted() {
    fillSubmitted();
    if (!$('tg-status') && !document.querySelector('[data-submit-title]')) return;
    var draft = readDraft();
    if (!draft.artist_id || !draft.title) return;
    var afterCreate = function (nextDraft) {
      if (!documentIdOf(nextDraft) || nextDraft.submitted) {
        if (!documentIdOf(nextDraft)) setStatus('tg-status', 'Sign the split sheet in SignWell before submitting.');
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
