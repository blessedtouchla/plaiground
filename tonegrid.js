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

  function readDraft() {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') || {};
    } catch (err) {
      return {};
    }
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
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
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

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(parseJson);
  }

  function go(href) {
    window.location.href = href;
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

      writeDraft({ name: name, title: title, genre: genre, type: 'single' });
      trigger.setAttribute('aria-busy', 'true');
      setStatus('tg-status', 'Saving artist…');

      post(ARTISTS_URL, { name: name })
        .then(function (result) {
          trigger.removeAttribute('aria-busy');
          if (result.status === 503 || result.data.configured === false) {
            setStatus('tg-status', 'Catalog sync is not configured yet.');
            go(nextHref);
            return;
          }
          if (!result.ok) {
            setStatus('tg-status', result.data.error || 'Could not save artist.');
            return;
          }
          var artistId = pickUuid(result.data);
          if (artistId) writeDraft({ artist_id: artistId, name: name, title: title, genre: genre, type: 'single' });
          go(nextHref);
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
      var title = draft.title || 'Neon Shadows';
      var genre = draft.genre || 'Electronic';
      var type = draft.type || 'single';
      var artistId = draft.artist_id;

      if (!artistId) {
        setStatus('tg-status', 'Save the upload details first so a catalog artist exists.');
        return;
      }

      trigger.setAttribute('aria-busy', 'true');
      setStatus('tg-status', 'Creating release…');

      post(RELEASES_URL, {
        artist_id: artistId,
        title: title,
        type: type,
        release_date: releaseDate,
        genre: genre,
      })
        .then(function (result) {
          trigger.removeAttribute('aria-busy');
          if (result.status === 503 || result.data.configured === false) {
            setStatus('tg-status', 'Catalog sync is not configured yet.');
            go(nextHref);
            return;
          }
          if (!result.ok) {
            setStatus('tg-status', result.data.error || 'Could not create release.');
            return;
          }
          var releaseId = pickUuid(result.data);
          if (releaseId) writeDraft({ release_id: releaseId, release_date: releaseDate });
          go(nextHref);
        })
        .catch(function () {
          trigger.removeAttribute('aria-busy');
          setStatus('tg-status', 'Could not reach catalog.');
        });
    });
  }

  bindUpload();
  bindReview();
})();
