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

  function statusLabel(status) {
    if (status === 'live') return 'Live';
    if (status === 'draft') return 'Draft';
    if (status === 'pending' || status === 'approved') return 'In review';
    if (status === 'taken_down') return 'Taken down';
    return status || 'Draft';
  }

  function statusGroup(status) {
    if (status === 'live') return 'live';
    if (status === 'pending' || status === 'approved') return 'review';
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
      var titleCell = document.createElement('td');
      var wrap = document.createElement('div');
      wrap.className = 'rel';
      var thumb = document.createElement('span');
      thumb.className = row.status === 'live' ? 'thumb' : 'thumb grey';
      var copy = document.createElement('div');
      var title = document.createElement('b');
      title.textContent = row.title || 'Untitled';
      var meta = document.createElement('small');
      var when = formatDate(row.release_date);
      meta.textContent = typeLabel(row.type) + (when ? ' · ' + when : '');
      copy.appendChild(title);
      copy.appendChild(meta);
      wrap.appendChild(thumb);
      wrap.appendChild(copy);
      titleCell.appendChild(wrap);

      var statusCell = document.createElement('td');
      statusCell.textContent = statusLabel(row.status);
      if (row.status === 'live') statusCell.className = 'live';

      var splits = document.createElement('td');
      splits.textContent = '—';

      var streamCell = document.createElement('td');
      streamCell.textContent = formatCount(streams[row.uuid] || 0);

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

  function render(data) {
    var releases = (data && data.releases) || [];
    var analytics = (data && data.analytics) || {};
    renderStats(releases);
    renderRows(releases, analytics);
    var empty = !releases.length;
    setHidden('[data-release-empty]', !empty);
    setHidden('[data-release-table]', empty);
    setText('[data-release-count]', empty ? '' : ('Showing ' + releases.length + ' of ' + (data.total || releases.length) + ' releases'));
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

  function load() {
    if (!$('[data-release-rows]') && !$('[data-release-empty]')) return;
    setStatus('Loading catalog…');
    Promise.all([getJson(RELEASES_URL), getJson(ANALYTICS_URL)])
      .then(function (results) {
        var list = results[0];
        var analytics = results[1];
        if (list.status === 401) {
          setStatus('Sign in to see your releases.');
          render({ releases: [], total: 0, analytics: {} });
          return;
        }
        if (list.status === 503 || list.data.configured === false) {
          setStatus(list.data && list.data.error === 'Accounts are not configured.'
            ? 'Accounts are not configured.'
            : 'Catalog sync is not configured yet.');
          render({ releases: [], total: 0, analytics: {} });
          return;
        }
        if (!list.ok) {
          setStatus(list.data.error || 'Could not load releases.');
          render({ releases: [], total: 0, analytics: {} });
          return;
        }
        render({
          releases: list.data.releases || [],
          total: list.data.total,
          analytics: analytics.ok ? analytics.data : {},
        });
        setStatus('');
      })
      .catch(function () {
        setStatus('Could not reach catalog.');
        render({ releases: [], total: 0, analytics: {} });
      });
  }

  global.PlaigroundCatalog = { render: render };
  load();
})(window);
