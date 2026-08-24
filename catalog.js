(function (global) {
  var RELEASES_URL = '/api/tonegrid/releases';
  var ANALYTICS_URL = '/api/tonegrid/analytics';

  function $(sel) {
    return document.querySelector(sel);
  }

  function toNumber(value) {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string') {
      var n = Number(String(value).replace(/[$,]/g, '').trim());
      return isFinite(n) ? n : 0;
    }
    return 0;
  }

  function formatCount(value) {
    return toNumber(value).toLocaleString('en-US');
  }

  function setText(sel, text) {
    var el = $(sel);
    if (el) el.textContent = text;
  }

  function setHidden(sel, hidden) {
    var el = $(sel);
    if (el) el.hidden = Boolean(hidden);
  }

  function statusApi() {
    return (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus) || null;
  }

  function statusLabel(status) {
    var api = statusApi();
    if (api) return api.label(status);
    if (status === 'live' || status === 'delivered') return 'Live';
    if (status === 'draft') return 'Draft';
    if (status === 'rejected' || status === 'needs-fix' || status === 'needs_fix') return 'Needs fix';
    if (status === 'approved' || status === 'processing' || status === 'delivering') return 'Processing';
    if (status === 'pending') return 'Pending';
    return 'Pending';
  }

  function statusGroup(status) {
    var api = statusApi();
    var g = api ? api.group(status) : '';
    if (g === 'live') return 'live';
    if (g === 'pending' || g === 'processing') return 'review';
    if (g === 'rejected') return 'review';
    if (status === 'live' || status === 'delivered') return 'live';
    if (status === 'pending' || status === 'approved' || status === 'processing' || status === 'delivering' || status === 'rejected') return 'review';
    return 'draft';
  }

  function typeLabel(type) {
    if (type === 'ep') return 'EP';
    if (type === 'album') return 'Album';
    return 'Single';
  }

  function formatDate(value) {
    if (!value) return '';
    var parts = String(value).split('-');
    if (parts.length !== 3) return value;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var month = months[Number(parts[1]) - 1];
    if (!month) return value;
    return month + ' ' + Number(parts[2]) + ' ' + parts[0];
  }

  function streamMap(analytics) {
    var map = {};
    ((analytics && analytics.releases) || []).forEach(function (row) {
      var id = row.release_uuid || row.uuid;
      if (id) map[id] = toNumber(row.streams);
    });
    return map;
  }

  function counts(releases) {
    var out = { total: releases.length, live: 0, review: 0, draft: 0 };
    releases.forEach(function (row) {
      var group = statusGroup(row.status);
      out[group] += 1;
    });
    return out;
  }

  function renderStats(releases) {
    var stats = counts(releases);
    setText('[data-stat="total"]', formatCount(stats.total));
    setText('[data-stat="live"]', formatCount(stats.live));
    setText('[data-stat="review"]', formatCount(stats.review));
    setText('[data-stat="draft"]', formatCount(stats.draft));
  }

  function renderRows(releases, analytics) {
    var host = $('[data-release-rows]');
    if (!host) return;
    host.textContent = '';
    var streams = streamMap(analytics);
    releases.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.className = 'is-pick';
      if (row.uuid && tr.setAttribute) tr.setAttribute('data-release-id', row.uuid);
      var titleCell = document.createElement('td');
      var wrap = document.createElement('div');
      wrap.className = 'rel';
      var thumb = document.createElement('span');
      var live = statusApi() ? statusApi().isLive(row.status) : row.status === 'live';
      thumb.className = live ? 'thumb' : 'thumb grey';
      var copy = document.createElement('div');
      var title = document.createElement('a');
      title.href = row.uuid ? ('song.html?id=' + encodeURIComponent(row.uuid)) : 'song.html';
      title.textContent = row.title || 'Untitled';
      title.style.color = 'inherit';
      title.style.textDecoration = 'none';
      title.style.fontWeight = '700';
      var meta = document.createElement('small');
      var when = formatDate(row.release_date);
      meta.textContent = typeLabel(row.type) + (when ? ' · ' + when : '');
      copy.appendChild(title);
      copy.appendChild(meta);
      if (row.uuid) {
        var edit = document.createElement('a');
        edit.href = 'song.html?id=' + encodeURIComponent(row.uuid) + '&edit=1';
        edit.textContent = 'Edit release';
        edit.className = 'learn';
        edit.style.display = 'inline-block';
        edit.style.marginTop = '4px';
        copy.appendChild(edit);
      }
      wrap.appendChild(thumb);
      wrap.appendChild(copy);
      titleCell.appendChild(wrap);

      var statusCell = document.createElement('td');
      var mapped = statusApi() ? statusApi().info(row.status) : { label: statusLabel(row.status), dot: live ? 'green' : 'yellow', live: live };
      statusCell.className = 'status-cell is-' + mapped.dot + (mapped.live ? ' live' : '');
      var dot = document.createElement('i');
      dot.className = 'status-dot';
      statusCell.appendChild(dot);
      var statusText = document.createElement('span');
      statusText.textContent = mapped.label;
      statusCell.appendChild(statusText);

      var splits = document.createElement('td');
      splits.textContent = '—';

      var streamCell = document.createElement('td');
      streamCell.textContent = formatCount(live ? (streams[row.uuid] || 0) : 0);

      var earnCell = document.createElement('td');
      earnCell.textContent = '$0.00';

      tr.appendChild(titleCell);
      tr.appendChild(statusCell);
      tr.appendChild(splits);
      tr.appendChild(streamCell);
      tr.appendChild(earnCell);
      host.appendChild(tr);
    });
  }

  var lastReleases = [];
  var lastAnalytics = {};
  var lastTotal = 0;
  var currentFilter = 'all';

  function filterFromSearch() {
    try {
      var status = new URLSearchParams(global.location.search).get('status');
      if (status === 'live') return 'live';
      if (status === 'pending' || status === 'review') return 'review';
      if (status === 'draft' || status === 'drafts') return 'draft';
    } catch (err) {}
    return 'all';
  }

  function applyFilter(releases, filter) {
    var list = releases || [];
    if (!filter || filter === 'all') return list;
    return list.filter(function (row) {
      return statusGroup(row && row.status) === filter;
    });
  }

  function emptyCopy(filter) {
    if (filter === 'live') {
      return {
        title: 'No live releases yet.',
        body: 'Nothing is live. When a release is delivered, it will show in Live.',
      };
    }
    if (filter === 'review') {
      return {
        title: 'No pending releases.',
        body: 'Nothing is waiting for review in this catalog.',
      };
    }
    if (filter === 'draft') {
      return {
        title: 'No drafts.',
        body: 'Nothing is saved as a draft in this catalog.',
      };
    }
    return {
      title: 'Your first release goes here.',
      body: 'Nothing here yet. Submit a song and it will show in this catalog when ToneGrid has it.',
    };
  }

  function highlightFilters(filter) {
    var doc = global.document;
    if (!doc || typeof doc.querySelectorAll !== 'function') return;
    var tabs = doc.querySelectorAll('[data-release-filter]');
    for (var i = 0; i < tabs.length; i += 1) {
      var on = String(tabs[i].getAttribute('data-release-filter') || 'all') === filter;
      if (tabs[i].classList && tabs[i].classList.toggle) tabs[i].classList.toggle('on', on);
    }
  }

  function render(data) {
    lastReleases = (data && data.releases) || [];
    lastAnalytics = (data && data.analytics) || {};
    lastTotal = (data && data.total) || lastReleases.length;
    if (!currentFilter) currentFilter = filterFromSearch();
    var shown = applyFilter(lastReleases, currentFilter);
    renderStats(lastReleases);
    renderRows(shown, lastAnalytics);
    var empty = !shown.length;
    setHidden('[data-release-empty]', !empty);
    setHidden('[data-release-table]', empty);
    var copy = emptyCopy(currentFilter);
    setText('[data-release-empty-title]', copy.title);
    setText('[data-release-empty-body]', copy.body);
    highlightFilters(currentFilter);
    setText('[data-release-count]', empty ? '' : ('Showing ' + shown.length + ' of ' + lastTotal + ' releases'));
  }

  function setStatus(text) {
    setText('[data-release-status]', text || '');
    setHidden('[data-release-status]', !text);
  }

  function getJson(url) {
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (response) {
      return response.json().then(function (body) {
        return { ok: response.ok, status: response.status, data: body || {} };
      }).catch(function () {
        return { ok: false, status: response.status, data: {} };
      });
    });
  }

  function readDraft() {
    try {
      return JSON.parse((global.localStorage && global.localStorage.getItem('plaiground.tonegrid.draft')) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function accountFallback(me, existing) {
    var have = {};
    (existing || []).forEach(function (row) {
      if (row && row.uuid) have[String(row.uuid).toLowerCase()] = true;
    });
    var ids = (me && Array.isArray(me.tonegrid_release_ids)) ? me.tonegrid_release_ids : [];
    var draft = readDraft();
    var extra = [];
    ids.forEach(function (id) {
      var key = String(id || '').toLowerCase();
      if (!key || have[key]) return;
      var matchesDraft = Boolean(draft && String(draft.release_id || '').toLowerCase() === key);
      extra.push({
        uuid: String(id),
        title: String((draft && draft.title) || '').trim() || 'Untitled',
        type: 'single',
        status: (function () {
          var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
          var found = '';
          stored.forEach(function (item) {
            if (String((item && (item.tonegrid_release_id || item.id)) || '').toLowerCase() === key) {
              found = String((item && item.tonegrid_status) || '').toLowerCase();
            }
          });
          if (found) return found;
          if (matchesDraft && draft && draft.tonegrid_status) return String(draft.tonegrid_status).toLowerCase();
          return matchesDraft && draft && !draft.submitted ? 'draft' : 'pending';
        })(),
        rejection_reason: '',
        genre: matchesDraft ? String(draft.genre || '').trim() : '',
        release_date: matchesDraft ? String(draft.release_date || '').trim() : '',
      });
    });
    return extra;
  }

  function loadAccount() {
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.whenReady === 'function') {
      return global.PlaigroundMembership.whenReady().then(function (result) {
        if (result && result.ok && result.data) return result.data;
        return global.PlaigroundMembership.account ? global.PlaigroundMembership.account() : null;
      });
    }
    return getJson('/api/me').then(function (result) {
      return result.ok ? result.data : null;
    });
  }

  function load() {
    if (!$('[data-release-rows]') && !$('[data-release-empty]')) return;
    setStatus('Loading catalog…');
    Promise.all([getJson(RELEASES_URL), getJson(ANALYTICS_URL), loadAccount()])
      .then(function (results) {
        var list = results[0];
        var analytics = results[1];
        var me = results[2];
        if (list.status === 401) {
          var signedIn = Boolean(me && !me.pending)
            || (global.PlaigroundMembership && typeof global.PlaigroundMembership.isSignedIn === 'function' && global.PlaigroundMembership.isSignedIn())
            || Boolean(global.PlaigroundMembership && global.PlaigroundMembership.account && global.PlaigroundMembership.account());
          if (signedIn) {
            var signedInOwned = accountFallback(me, []);
            setStatus('');
            render({ releases: signedInOwned, total: signedInOwned.length, analytics: {} });
            return;
          }
          setStatus('Sign in to see your releases.');
          render({ releases: [], total: 0, analytics: {} });
          return;
        }
        var owned = accountFallback(me, (list.ok && list.data && list.data.releases) || []);
        if (list.status === 503 || list.data.configured === false) {
          setStatus(list.data && list.data.error === 'Accounts are not configured.'
            ? 'Accounts are not configured.'
            : (owned.length ? '' : 'Catalog sync is not configured yet.'));
          render({ releases: owned, total: owned.length, analytics: {} });
          return;
        }
        if (!list.ok) {
          setStatus(owned.length ? '' : (list.data.error || 'Could not load releases.'));
          render({ releases: owned, total: owned.length, analytics: {} });
          return;
        }
        var releases = list.data.releases || [];
        var extra = accountFallback(me, releases);
        releases = releases.concat(extra);
        render({
          releases: releases,
          total: list.data.total || releases.length,
          analytics: analytics.ok ? analytics.data : {},
        });
        setStatus('');
      })
      .catch(function () {
        setStatus('Could not reach catalog.');
        render({ releases: [], total: 0, analytics: {} });
      });
  }

  function setEditError(text) {
    setText('[data-edit-error]', text || '');
    setHidden('[data-edit-error]', !text);
  }

  function selectedStores() {
    var root = $('[data-store-pick]') || $('[data-edit-stores]');
    if (root && global.PlaigroundStorePick && typeof global.PlaigroundStorePick.selected === 'function') {
      return global.PlaigroundStorePick.selected(root);
    }
    var host = $('[data-edit-stores]');
    if (!host) return [];
    return Array.prototype.slice.call(host.querySelectorAll('input[type="checkbox"]:checked')).map(function (el) {
      return el.value;
    });
  }

  function fillStores(stores, selected) {
    var root = $('[data-store-pick]') || $('[data-edit-stores]');
    if (root && global.PlaigroundStorePick && typeof global.PlaigroundStorePick.bind === 'function') {
      global.PlaigroundStorePick.bind(root, {
        stores: stores,
        selected: selected && selected.length ? selected : null,
      });
      return;
    }
    var host = $('[data-edit-stores]');
    if (!host) return;
    host.textContent = '';
    var picked = {};
    var allOn = !selected || !selected.length;
    (selected || []).forEach(function (slug) { picked[String(slug).toLowerCase()] = true; });
    (stores || []).forEach(function (row) {
      var slug = typeof row === 'string' ? row : row.slug;
      if (!slug) return;
      var label = document.createElement('label');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.value = slug;
      box.checked = allOn || Boolean(picked[slug.toLowerCase()]);
      label.appendChild(box);
      label.appendChild(document.createTextNode(' ' + (row.name || slug)));
      host.appendChild(label);
    });
  }

  function fillEdit(release) {
    var panel = $('[data-release-edit]');
    if (!panel || !release) return;
    panel.hidden = false;
    panel.setAttribute('data-release-id', release.uuid || '');
    setText('[data-edit-status]', statusLabel(release.status));
    var title = $('#edit-title');
    var date = $('#edit-date');
    var genre = $('#edit-genre');
    var language = $('#edit-language');
    var trackTitle = $('#edit-track-title');
    var catalog = global.PlaigroundUploadCatalog;
    if (title) title.value = release.title || '';
    if (date) date.value = release.release_date || '';
    var track = (release.tracks && release.tracks[0]) || {};
    if (trackTitle) {
      trackTitle.value = track.title || '';
      trackTitle.setAttribute('data-track-id', track.uuid || '');
    }
    getJson('/api/tonegrid/stores').then(function (result) {
      fillStores((result.ok && result.data.stores) || [], release.dsps || []);
    });
    if (catalog && typeof catalog.fillUploadSelects === 'function') {
      try { catalog.fillUploadSelects(document); } catch (err) {}
    }
    if (catalog && genre && genre.options && genre.options.length < 3 && catalog.GENRES) {
      catalog.GENRES.forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        genre.appendChild(opt);
      });
    }
    if (catalog && language && language.options && language.options.length < 3 && catalog.LANGUAGES) {
      catalog.LANGUAGES.forEach(function (row) {
        var opt = document.createElement('option');
        opt.value = row.code;
        opt.textContent = row.name;
        language.appendChild(opt);
      });
    }
    if (catalog && typeof catalog.bindTypeahead === 'function') {
      if (genre && catalog.GENRES) catalog.bindTypeahead(genre, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
      if (language && catalog.LANGUAGES) {
        catalog.bindTypeahead(language, catalog.LANGUAGES, function (row) { return row.code; }, function (row) { return row.name; });
      }
    }
    if (catalog && typeof catalog.setTypeaheadValue === 'function') {
      catalog.setTypeaheadValue(genre, release.genre || '');
      catalog.setTypeaheadValue(language, release.language || '');
    } else {
      if (genre) genre.value = release.genre || '';
      if (language) language.value = release.language || '';
      if (catalog && typeof catalog.syncTypeahead === 'function') {
        catalog.syncTypeahead(genre);
        catalog.syncTypeahead(language);
      }
    }
    setEditError('');
  }

  function saveEdit() {
    var panel = $('[data-release-edit]');
    var id = panel && panel.getAttribute('data-release-id');
    if (!id) return;
    var saveBtn = $('[data-edit-save]');
    if (saveBtn) saveBtn.setAttribute('aria-busy', 'true');
    setEditError('Saving…');
    var title = $('#edit-title') ? $('#edit-title').value.trim() : '';
    var date = $('#edit-date') ? $('#edit-date').value.trim() : '';
    var genre = $('#edit-genre') ? $('#edit-genre').value.trim() : '';
    var catalog = global.PlaigroundUploadCatalog;
    if (catalog && typeof catalog.canonicalCatalogValue === 'function') {
      var canon = catalog.canonicalCatalogValue($('#edit-genre'), genre);
      if (genre && canon == null) {
        if (saveBtn) saveBtn.removeAttribute('aria-busy');
        setEditError('Pick a genre from the ToneGrid list.');
        return;
      }
      if (canon) genre = canon;
    }
    var language = $('#edit-language') ? $('#edit-language').value.trim() : '';
    var trackTitle = $('#edit-track-title') ? $('#edit-track-title').value.trim() : '';
    var trackId = $('#edit-track-title') ? $('#edit-track-title').getAttribute('data-track-id') : '';
    var art = $('#edit-art') && $('#edit-art').files && $('#edit-art').files[0];
    var body = { title: title };
    if (date) body.release_date = date;
    if (genre) body.genre = genre;
    if (language) body.language = language;
    var tasks = [
      fetch('/api/tonegrid/releases/' + encodeURIComponent(id), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(parseSave),
      fetch('/api/tonegrid/releases/' + encodeURIComponent(id) + '/dsps', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ dsps: selectedStores() }),
      }).then(parseSave),
    ];
    if (trackId && trackTitle) {
      tasks.push(fetch('/api/tonegrid/tracks/' + encodeURIComponent(trackId), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trackTitle }),
      }).then(parseSave));
    }
    if (art) {
      var form = new FormData();
      form.append('artwork', art, art.name || 'artwork.jpg');
      tasks.push(fetch('/api/tonegrid/releases/' + encodeURIComponent(id) + '/artwork', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        body: form,
      }).then(parseSave));
    }
    Promise.all(tasks).then(function (results) {
      if (saveBtn) saveBtn.removeAttribute('aria-busy');
      var failed = results.find(function (row) { return !row.ok; });
      if (failed) {
        setEditError((failed.data && failed.data.error) || 'ToneGrid rejected the edit.');
        return;
      }
      setEditError('Saved to ToneGrid.');
      load();
    }).catch(function () {
      if (saveBtn) saveBtn.removeAttribute('aria-busy');
      setEditError('Could not reach ToneGrid.');
    });
  }

  function parseSave(response) {
    return response.json().then(function (data) {
      return { ok: response.ok, status: response.status, data: data || {} };
    }).catch(function () {
      return { ok: false, status: response.status, data: { error: 'ToneGrid rejected the edit.' } };
    });
  }

  function bindEdit() {
    var host = $('[data-release-rows]');
    if (host && host.addEventListener) {
      host.addEventListener('click', function (event) {
        var tr = event.target && event.target.closest ? event.target.closest('tr[data-release-id]') : null;
        if (!tr) return;
        if (event.target && event.target.closest && event.target.closest('a')) return;
        var id = tr.getAttribute('data-release-id');
        if (!id) return;
        global.location.href = 'song.html?id=' + encodeURIComponent(id);
      });
    }
    var saveBtn = $('[data-edit-save]');
    if (saveBtn) saveBtn.addEventListener('click', saveEdit);
  }

  function bindFilters() {
    var host = document.querySelector('[data-release-filters]') || document.querySelector('.tabs');
    if (!host || !host.addEventListener) return;
    host.addEventListener('click', function (event) {
      var link = event.target && event.target.closest ? event.target.closest('[data-release-filter]') : null;
      if (!link) return;
      event.preventDefault();
      currentFilter = String(link.getAttribute('data-release-filter') || 'all');
      try {
        if (global.history && global.history.replaceState) {
          var url = currentFilter === 'all' ? 'releases.html' : ('releases.html?status=' + encodeURIComponent(currentFilter === 'review' ? 'pending' : currentFilter));
          global.history.replaceState({}, '', url);
        }
      } catch (err) {}
      render({ releases: lastReleases, analytics: lastAnalytics, total: lastTotal });
    });
  }

  global.PlaigroundCatalog = {
    render: render,
    accountFallback: accountFallback,
    applyFilter: applyFilter,
    setFilter: function (next) { currentFilter = String(next || 'all'); },
  };
  bindFilters();
  currentFilter = filterFromSearch();
  bindEdit();
  load();
})(window);
