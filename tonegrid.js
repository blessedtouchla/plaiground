(function () {
  var ARTISTS_URL = '/api/tonegrid/artists';
  var RELEASES_URL = '/api/tonegrid/releases';
  var DRAFT_KEY = 'plaiground.tonegrid.draft';

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
    if (payload.data && typeof payload.data === 'object') {
      if (typeof payload.data.uuid === 'string') return payload.data.uuid;
      if (payload.data.artist && typeof payload.data.artist.uuid === 'string') {
        return payload.data.artist.uuid;
      }
      if (payload.data.release && typeof payload.data.release.uuid === 'string') {
        return payload.data.release.uuid;
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
    if (!body.artist_id && !body.release_id) return Promise.resolve();
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

  function releasePayload(draft, releaseDate) {
    var body = {
      artist_id: draft.artist_id,
      title: draft.title,
      type: draft.type || 'single',
    };
    if (draft.genre) body.genre = draft.genre;
    if (releaseDate) body.release_date = releaseDate;
    return body;
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
      var nextHref = trigger.getAttribute('href') || 'attest.html';

      if (!name) {
        setStatus('tg-status', 'Primary artist is required.');
        return;
      }
      if (!title) {
        setStatus('tg-status', 'Song title is required.');
        return;
      }

      writeDraft({ name: name, title: title, genre: genre, type: 'single' });
      trigger.setAttribute('aria-busy', 'true');
      setStatus('tg-status', 'Saving artist…');

      post(ARTISTS_URL, { name: name })
        .then(function (result) {
          if (isUnavailable(result)) {
            trigger.removeAttribute('aria-busy');
            continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
            return;
          }
          if (!result.ok) {
            trigger.removeAttribute('aria-busy');
            setStatus('tg-status', result.data.error || 'Could not save artist.');
            return;
          }
          var artistId = pickUuid(result.data);
          var draft = writeDraft({
            artist_id: artistId,
            name: name,
            title: title,
            genre: genre,
            type: 'single',
          });
          if (artistId) saveCatalog({ artist_id: artistId });
          if (!artistId) {
            trigger.removeAttribute('aria-busy');
            continueAfterCatalog(nextHref, 'Artist saved. Release will retry on the next step.');
            return;
          }
          setStatus('tg-status', 'Creating release…');
          return createRelease(draft, '').then(function (created) {
            trigger.removeAttribute('aria-busy');
            if (created.unavailable) {
              continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
              return;
            }
            if (created.failed) {
              continueAfterCatalog(nextHref, created.result.data.error || 'Could not create release yet. You can continue.');
              return;
            }
            continueAfterCatalog(nextHref, created.skipped && created.missing ? '' : 'Creating release…');
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
      if (releaseDate) draft = writeDraft({ release_date: releaseDate });

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
          trigger.removeAttribute('aria-busy');
          if (created.unavailable) {
            continueAfterCatalog(nextHref, 'Catalog sync is not configured yet.');
            return;
          }
          if (created.failed) {
            setStatus('tg-status', created.result.data.error || 'Could not create release.');
            return;
          }
          go(nextHref);
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
      if (created.failed) {
        setStatus('tg-status', created.result.data.error || 'Could not create release.');
        return;
      }
      if (created.created) setStatus('tg-status', 'Release saved to the catalog.');
    }).catch(function () {
      setStatus('tg-status', 'Could not reach catalog.');
    });
  }

  bindUpload();
  bindReview();
  fillReviewSummary();
  bindSubmitted();
})();
