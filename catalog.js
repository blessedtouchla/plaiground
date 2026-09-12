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

  function isInactiveDspError(text) {
    var raw = String(text || '');
    if (/not found or inactive/i.test(raw)) return true;
    return /youtube[-_ ]?music/i.test(raw) && /not found|inactive|unavailable/i.test(raw);
  }

  function inactiveStoreCopy(list) {
    if (global.PlaigroundStorePick && global.PlaigroundStorePick.inactiveStoreError) {
      return global.PlaigroundStorePick.inactiveStoreError(list);
    }
    return 'YouTube Music is not available. Choose other stores and submit again.';
  }

  function sanitizePartnerCopy(text) {
    var next = String(text == null ? '' : text);
    if (isInactiveDspError(next)) return inactiveStoreCopy();
    next = next.replace(/\bthe\s+ToneGrid\b/gi, 'the store');
    next = next.replace(/ToneGrid/gi, 'the store');
    next = next.replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
    return next;
  }

  function setText(sel, text) {
    var el = $(sel);
    if (el) el.textContent = text == null ? '' : sanitizePartnerCopy(text);
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
    if (status === 'rejected' || status === 'qc_rejected' || status === 'qc_failed' || status === 'error' || status === 'failed') return 'QC rejected';
    if (status === 'needs-fix' || status === 'needs_fix') return 'Needs fix';
    if (status === 'qc_inspection') return 'Platform QC';
    if (status === 'approved' || status === 'processing' || status === 'delivering') return 'Processing';
    if (status === 'pending' || status === 'pending_review') return 'PLAIGROUND QC';
    return 'PLAIGROUND QC';
  }

  function statusGroup(status) {
    var api = statusApi();
    if (status && typeof status === 'object') {
      if (api && typeof api.displayInfo === 'function') {
        var shown = api.displayInfo(status);
        if (shown && shown.group === 'live') return 'live';
      }
      return statusGroup(status.status || status.tonegrid_status || '');
    }
    var g = api ? api.group(status) : '';
    if (g === 'live') return 'live';
    if (g === 'pending' || g === 'processing' || g === 'platform_qc' || g === 'removing' || g === 'needs_fix') return 'review';
    if (g === 'qc_rejected' || g === 'rejected') return 'rejected';
    if (g === 'store_gone') return '';
    if (status === 'live' || status === 'delivered') return 'live';
    if (status === 'pending' || status === 'pending_review' || status === 'qc_inspection' || status === 'approved' || status === 'processing' || status === 'delivering' || status === 'needs_fix' || status === 'takedown_submitted' || status === 'removing') return 'review';
    if (status === 'rejected' || status === 'qc_rejected') return 'rejected';
    return 'draft';
  }

  function isReturnedRow(row) {
    var api = statusApi();
    if (api && typeof api.isReturnedRelease === 'function') return api.isReturnedRelease(row);
    return statusGroup(row && row.status) === 'rejected';
  }

  function splitRejected(releases) {
    var api = statusApi();
    if (api && typeof api.splitRejected === 'function') return api.splitRejected(releases);
    var main = [];
    var rejected = [];
    (releases || []).forEach(function (row) {
      if (isReturnedRow(row)) rejected.push(row);
      else main.push(row);
    });
    return { main: main, rejected: rejected };
  }

  function resubmitHref() {
    var api = statusApi();
    if (api && typeof api.resubmitHref === 'function') return api.resubmitHref();
    return 'upload.html';
  }

  function mergeReturned(releases, me) {
    var api = statusApi();
    if (api && typeof api.mergeReturnedCatalog === 'function') return api.mergeReturnedCatalog(releases, me);
    return releases || [];
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
      var group = statusGroup(row);
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

  function coverOf(row) {
    var api = statusApi();
    if (api && typeof api.coverUrl === 'function') return api.coverUrl(row);
    if (global.PlaigroundCoverUrl && typeof global.PlaigroundCoverUrl.from === 'function') {
      return global.PlaigroundCoverUrl.from(row);
    }
    return String((row && (row.artwork_url || row.cover_art_url || row.cover_url)) || '').trim();
  }

  function applyCover(el, url) {
    if (global.PlaigroundCoverPreview && typeof global.PlaigroundCoverPreview.paintTile === 'function') {
      global.PlaigroundCoverPreview.paintTile(el, url);
      return;
    }
    var art = String(url || '').trim();
    if (el && el.style) {
      el.style.backgroundImage = art ? ('url("' + art.replace(/"/g, '') + '")') : '';
      el.style.backgroundSize = art ? 'cover' : '';
      el.style.backgroundPosition = art ? 'center' : '';
      el.style.backgroundColor = art ? '#111' : '';
    }
    if (el && el.classList && el.classList.toggle) el.classList.toggle('has-art', Boolean(art));
  }

  function hopApi() {
    try {
      if (typeof PlaigroundObjectHop !== 'undefined' && PlaigroundObjectHop) return PlaigroundObjectHop;
    } catch (err) {}
    return global.PlaigroundObjectHop || null;
  }

  function coverObjectKeyOf(row) {
    if (global.PlaigroundCoverUrl && typeof global.PlaigroundCoverUrl.objectKey === 'function') {
      return global.PlaigroundCoverUrl.objectKey(row);
    }
    return String((row && row.artwork_object_key) || '').trim();
  }

  function resolveCoverFallback(el, row, currentUrl) {
    if (currentUrl) return;
    var key = coverObjectKeyOf(row);
    var api = hopApi();
    if (!key || !api || typeof api.previewUrl !== 'function') return;
    api.previewUrl(key).then(function (url) {
      if (url && el && el.isConnected) applyCover(el, url);
    });
  }

  function isUnsubmittedDraft(row, draft) {
    if (isReturnedRow(row)) return false;
    var api = statusApi();
    if (api && typeof api.isUnsubmittedDraft === 'function') return api.isUnsubmittedDraft(row, draft);
    if (global.PlaigroundReleaseCredits && typeof global.PlaigroundReleaseCredits.isUnsubmittedDraft === 'function') {
      if (global.PlaigroundReleaseCredits.isUnsubmittedDraft(row, draft)) return true;
    }
    if (!row) return false;
    if (row.local_draft === true || row.id === 'local-draft') return true;
    if (row.saved_draft === true || row.saved_draft === 'true') return true;
    if (row.submitted === true || row.submitted === 'true') return false;
    var status = String(row.status || row.tonegrid_status || '').toLowerCase();
    if (status === 'draft') return true;
    if (draft) {
      var id = String(row.uuid || row.id || '').toLowerCase();
      var draftId = String(draft.release_id || '').toLowerCase();
      if (id && draftId === id && (draft.submitted === false || draft.submitted === 'false' || draft.saved_draft)) {
        return true;
      }
    }
    return false;
  }

  function dropUnsubmitted(releases, draft) {
    return (releases || []).filter(function (row) {
      return !isUnsubmittedDraft(row, draft);
    });
  }

  function catalogHref(row, opts) {
    opts = opts || {};
    if (isUnsubmittedDraft(row)) return '';
    var id = row && (row.uuid || (row.id && row.id !== 'local-draft' ? row.id : ''));
    if (!id) return opts.edit ? '' : 'releases.html';
    if (opts.edit) return 'song.html?id=' + encodeURIComponent(id) + '&edit=1';
    return 'song.html?id=' + encodeURIComponent(id);
  }

  function overviewCards(releases) {
    return dropUnsubmitted(releases || []).map(function (row) {
      var api = statusApi();
      var mapped = (api && typeof api.displayInfo === 'function') ? api.displayInfo(row) : (api ? api.info(row && row.status) : {
        label: statusLabel(row && row.status),
        live: String((row && row.status) || '') === 'live' || String((row && row.status) || '') === 'delivered',
        dot: 'gray',
        alert: '',
      });
      return {
        id: String((row && (row.uuid || row.id)) || ''),
        title: String((row && row.title) || '').trim(),
        status: String((row && row.status) || ''),
        label: mapped.label,
        live: mapped.live,
        dot: mapped.dot,
        out: mapped.out || '',
        delivered_at: row && (row.delivered_at || row.deliveredAt) || '',
        release_date: row && (row.release_date || row.releaseDate) || '',
        updated_at: row && (row.updated_at || row.updatedAt) || '',
        artwork_url: coverOf(row),
        artwork_object_key: coverObjectKeyOf(row),
        local_draft: false,
        href: '',
        alert: mapped.alert || ((api && typeof api.problemAlert === 'function') ? api.problemAlert(row) : ''),
      };
    }).filter(function (card) {
      var api = statusApi();
      if (api && typeof api.isHiddenFromList === 'function' && api.isHiddenFromList(card && card.status)) return false;
      if (api && typeof api.isReturnedRelease === 'function' && api.isReturnedRelease(card)) return false;
      return !(api && typeof api.isPlaceholderRelease === 'function' && api.isPlaceholderRelease(card));
    });
  }

  function renderOverviewTiles(releases) {
    var cards = overviewCards(releases);
    if (!cards.length) return;
    if (global.PlaigroundAccount && typeof global.PlaigroundAccount.renderOverview === 'function') {
      global.PlaigroundAccount.renderOverview(cards);
      return;
    }
    var host = $('[data-release-tiles]');
    if (!host) return;
    host.textContent = '';
    if (!cards.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    cards.forEach(function (card) {
      var link = document.createElement('a');
      link.className = 'release-tile';
      link.href = catalogHref(card) || 'releases.html';
      var art = document.createElement('span');
      art.className = 'release-tile-art';
      applyCover(art, card.artwork_url);
      resolveCoverFallback(art, card, card.artwork_url);
      var title = document.createElement('strong');
      title.textContent = card.title || 'Untitled';
      var status = document.createElement('span');
      var tileLabel = card.label || 'PLAIGROUND QC';
      var tileDot = card.live ? 'green' : ((card.dot) || ((tileLabel === 'Needs fix' || tileLabel === 'QC rejected') ? 'red' : ((statusApi() && statusApi().dot(card.status)) || 'gray')));
      status.className = 'release-tile-status is-' + tileDot;
      status.textContent = tileLabel;
      link.appendChild(art);
      link.appendChild(title);
      link.appendChild(status);
      if (card.out) {
        var out = document.createElement('small');
        out.className = 'release-out-line';
        out.textContent = card.out;
        link.appendChild(out);
      }
      if (card.alert) {
        var note = document.createElement('p');
        note.className = 'release-tile-alert';
        note.textContent = card.alert;
        link.appendChild(note);
      }
      host.appendChild(link);
    });
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
      var mapped = (statusApi() && typeof statusApi().displayInfo === 'function')
        ? statusApi().displayInfo(row)
        : (statusApi() ? statusApi().info(row.status) : {
          label: statusLabel(row.status),
          dot: (row.status === 'live' || row.status === 'delivered') ? 'green' : 'yellow',
          live: row.status === 'live' || row.status === 'delivered',
          alert: '',
        });
      var live = mapped.live;
      var alertText = mapped.alert || ((statusApi() && typeof statusApi().problemAlert === 'function')
        ? statusApi().problemAlert(row)
        : '');
      if (!alertText && Array.isArray(row.tracks) && row.tracks.length) {
        var hasMaster = row.tracks.some(function (track) {
          return track && (track.audio_url || track.audio_s3_key || track.s3_key || Number(track.file_size) > 0);
        });
        if (!hasMaster) alertText = 'Audio required — upload your master before sending';
      }
      var titleCell = document.createElement('td');
      var wrap = document.createElement('div');
      wrap.className = 'rel';
      var thumb = document.createElement('span');
      thumb.className = live ? 'thumb' : 'thumb grey';
      var thumbCover = coverOf(row);
      applyCover(thumb, thumbCover);
      resolveCoverFallback(thumb, row, thumbCover);
      var copy = document.createElement('div');
      var title = document.createElement('a');
      title.href = catalogHref(row) || 'releases.html';
      title.textContent = row.title || 'Untitled';
      title.style.color = 'inherit';
      title.style.textDecoration = 'none';
      title.style.fontWeight = '700';
      var meta = document.createElement('small');
      var when = formatDate(row.release_date);
      meta.textContent = typeLabel(row.type) + (when ? ' · ' + when : '');
      copy.appendChild(title);
      copy.appendChild(meta);
      var inlineStatus = document.createElement('small');
      inlineStatus.className = 'release-inline-status is-' + mapped.dot;
      inlineStatus.textContent = mapped.label;
      copy.appendChild(inlineStatus);
      if (mapped.out) {
        var inlineOut = document.createElement('small');
        inlineOut.className = 'release-out-line';
        inlineOut.textContent = mapped.out;
        copy.appendChild(inlineOut);
      }
      if (alertText) {
        var inlineAlert = document.createElement('p');
        inlineAlert.className = 'release-row-alert';
        inlineAlert.textContent = alertText;
        copy.appendChild(inlineAlert);
      }
      wrap.appendChild(thumb);
      wrap.appendChild(copy);
      titleCell.appendChild(wrap);

      var editCell = document.createElement('td');
      editCell.className = 'release-edit-col';
      var editHref = catalogHref(row, { edit: true });
      var edit = document.createElement(editHref || row.uuid ? 'a' : 'button');
      edit.textContent = 'Edit release';
      edit.className = 'btn btn-ghost btn-sm';
      if (editHref) {
        edit.href = editHref;
      } else if (row.uuid && !isUnsubmittedDraft(row)) {
        edit.href = 'song.html?id=' + encodeURIComponent(row.uuid) + '&edit=1';
      } else if (!row.uuid && !isUnsubmittedDraft(row)) {
        edit.type = 'button';
        edit.setAttribute('data-edit-missing', '');
      } else {
        edit.type = 'button';
        edit.setAttribute('data-edit-blocked', '');
        edit.hidden = true;
      }
      editCell.appendChild(edit);

      var statusCell = document.createElement('td');
      statusCell.className = 'status-cell is-' + mapped.dot + (mapped.live ? ' live' : '');
      var dot = document.createElement('i');
      dot.className = 'status-dot';
      statusCell.appendChild(dot);
      var statusText = document.createElement('span');
      statusText.textContent = mapped.label;
      statusCell.appendChild(statusText);
      if (mapped.out) {
        statusCell.className += ' has-out';
        var outLine = document.createElement('small');
        outLine.className = 'release-out-line';
        outLine.textContent = mapped.out;
        statusCell.appendChild(outLine);
      }
      if (alertText) {
        statusCell.className += ' has-alert';
        var note = document.createElement('p');
        note.className = 'release-row-alert';
        note.textContent = alertText;
        statusCell.appendChild(note);
      }

      var splits = document.createElement('td');
      splits.textContent = '—';

      var streamCell = document.createElement('td');
      streamCell.textContent = formatCount(live ? (streams[row.uuid] || 0) : 0);

      var earnCell = document.createElement('td');
      earnCell.textContent = '$0.00';

      tr.appendChild(titleCell);
      tr.appendChild(editCell);
      tr.appendChild(statusCell);
      tr.appendChild(splits);
      tr.appendChild(streamCell);
      tr.appendChild(earnCell);
      host.appendChild(tr);
    });
  }

  function renderRejectedRows(releases) {
    var host = $('[data-rejected-rows]');
    var section = $('[data-rejected-section]');
    if (!host) {
      if (section) section.hidden = true;
      return;
    }
    host.textContent = '';
    var list = releases || [];
    if (section) section.hidden = !list.length;
    list.forEach(function (row) {
      var tr = document.createElement('tr');
      if (row.uuid && tr.setAttribute) tr.setAttribute('data-release-id', row.uuid);
      var mapped = (statusApi() && typeof statusApi().displayInfo === 'function')
        ? statusApi().displayInfo(row)
        : (statusApi() ? statusApi().info(row.status) : { label: 'Rejected', dot: 'red', live: false, alert: '' });
      var alertText = mapped.alert || ((statusApi() && typeof statusApi().problemAlert === 'function')
        ? statusApi().problemAlert(row)
        : '');
      if (!alertText) alertText = String((row && row.rejection_reason) || '').trim();
      var titleCell = document.createElement('td');
      var wrap = document.createElement('div');
      wrap.className = 'rel';
      var thumb = document.createElement('span');
      thumb.className = 'thumb grey';
      var thumbCover = coverOf(row);
      applyCover(thumb, thumbCover);
      resolveCoverFallback(thumb, row, thumbCover);
      var copy = document.createElement('div');
      var title = document.createElement('strong');
      title.textContent = row.title || 'Untitled';
      var meta = document.createElement('small');
      var when = formatDate(row.release_date);
      meta.textContent = typeLabel(row.type) + (when ? ' · ' + when : '');
      var inlineStatus = document.createElement('small');
      inlineStatus.className = 'release-inline-status is-red';
      inlineStatus.textContent = 'Rejected';
      copy.appendChild(title);
      copy.appendChild(meta);
      copy.appendChild(inlineStatus);
      if (alertText) {
        var inlineAlert = document.createElement('p');
        inlineAlert.className = 'release-row-alert';
        inlineAlert.textContent = alertText;
        copy.appendChild(inlineAlert);
      }
      wrap.appendChild(thumb);
      wrap.appendChild(copy);
      titleCell.appendChild(wrap);

      var actionCell = document.createElement('td');
      actionCell.className = 'release-edit-col';
      var resubmit = document.createElement('a');
      resubmit.textContent = 'Resubmit';
      resubmit.className = 'btn btn-purple btn-sm';
      resubmit.href = resubmitHref();
      resubmit.setAttribute('data-resubmit', '');
      actionCell.appendChild(resubmit);

      var statusCell = document.createElement('td');
      statusCell.className = 'status-cell is-red';
      var dot = document.createElement('i');
      dot.className = 'status-dot';
      statusCell.appendChild(dot);
      var statusText = document.createElement('span');
      statusText.textContent = 'Rejected';
      statusCell.appendChild(statusText);
      if (alertText) {
        statusCell.className += ' has-alert';
        var note = document.createElement('p');
        note.className = 'release-row-alert';
        note.textContent = alertText;
        statusCell.appendChild(note);
      }

      var splits = document.createElement('td');
      splits.textContent = '—';
      var streamCell = document.createElement('td');
      streamCell.textContent = '0';
      var earnCell = document.createElement('td');
      earnCell.textContent = '$0.00';

      tr.appendChild(titleCell);
      tr.appendChild(actionCell);
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
  var lastMe = null;
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
      return statusGroup(row) === filter;
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
        body: 'Nothing here yet. Submit a song and it will show in this catalog when the store has it.',
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
    var localDraft = readDraft();
    if (global.PlaigroundReleaseCredits && typeof global.PlaigroundReleaseCredits.dropLeftoverSavedDraft === 'function') {
      global.PlaigroundReleaseCredits.dropLeftoverSavedDraft(global);
    }
    if (global.PlaigroundReleaseCredits && typeof global.PlaigroundReleaseCredits.withSavedDraft === 'function') {
      lastReleases = global.PlaigroundReleaseCredits.withSavedDraft(lastReleases, localDraft);
    }
    lastMe = (data && data.me) || lastMe;
    lastReleases = mergeReturned(lastReleases, lastMe);
    lastReleases = dropUnsubmitted(lastReleases, localDraft);
    lastAnalytics = (data && data.analytics) || {};
    var parts = splitRejected(lastReleases);
    var main = parts.main;
    var rejected = parts.rejected;
    lastTotal = (data && data.total) || main.length;
    if (main.length > lastTotal) lastTotal = main.length;
    if (!currentFilter) currentFilter = filterFromSearch();
    var shown = applyFilter(main, currentFilter);
    renderStats(main);
    renderRows(shown, lastAnalytics);
    renderRejectedRows(rejected);
    renderOverviewTiles(main);
    var empty = !shown.length;
    var hideEmptyCard = !empty || (rejected.length > 0 && !main.length && (!currentFilter || currentFilter === 'all'));
    setHidden('[data-release-empty]', hideEmptyCard);
    setHidden('[data-release-table]', empty);
    var copy = emptyCopy(currentFilter);
    setText('[data-release-empty-title]', copy.title);
    setText('[data-release-empty-body]', copy.body);
    highlightFilters(currentFilter);
    setText('[data-release-count]', empty ? '' : ('Showing ' + shown.length + ' of ' + lastTotal + ' releases'));
    var editPanel = $('[data-release-edit]');
    if (editPanel) editPanel.hidden = true;
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
      return JSON.parse((global.localStorage && global.localStorage.getItem('plaiground.store.draft')) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function overlayPendingCatalog(releases, me) {
    var draft = readDraft();
    var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
    return (releases || []).map(function (row) {
      if (!row) return row;
      var id = String(row.uuid || row.id || '').toLowerCase();
      if (!id) return row;
      var live = statusApi() ? statusApi().isLive(row) : (String(row.status || '') === 'live' || String(row.status || '') === 'delivered');
      var next = Object.assign({}, row);
      stored.forEach(function (item) {
        if (String((item && (item.tonegrid_release_id || item.id)) || '').toLowerCase() !== id) return;
        if (item && item.title) next.title = item.title;
        if (item && item.genre) next.genre = item.genre;
        if (item && item.language) next.language = item.language;
        if (item && item.release_date) next.release_date = item.release_date;
        if (item && item.artist) next.artist = item.artist;
        if (item && item.rejection_reason && !next.rejection_reason) next.rejection_reason = item.rejection_reason;
        if (item && (item.delivered_at || item.deliveredAt) && !next.delivered_at && !next.deliveredAt) {
          next.delivered_at = item.delivered_at || item.deliveredAt;
        }
        var art = coverOf(item);
        if (art) next.artwork_url = art;
        [
          'label',
          'copyright_year',
          'copyright_holder',
          'copyright_owner',
          'rights_owner',
          'master_owner',
          'c_line',
          'p_line',
          'copyright_line',
        ].forEach(function (key) {
          if (item && item[key] && !next[key]) next[key] = item[key];
        });
        if ((!Array.isArray(next.writers) || !next.writers.length) && Array.isArray(item.writers) && item.writers.length) {
          next.writers = item.writers;
        }
      });
      var applied = draft && (draft.edit_applied === true || draft.edit_applied === 'true');
      if (draft && String(draft.release_id || '').toLowerCase() === id && (!live || applied)) {
        if (String(draft.title || '').trim()) next.title = String(draft.title).trim();
        if (String(draft.genre || '').trim()) next.genre = String(draft.genre).trim();
        if (String(draft.language || '').trim()) next.language = String(draft.language).trim();
        if (String(draft.release_date || '').trim()) next.release_date = String(draft.release_date).trim();
        if (String(draft.artist || draft.name || '').trim()) next.artist = String(draft.artist || draft.name).trim();
        var draftArt = coverOf(draft);
        if (draftArt) next.artwork_url = draftArt;
      }
      return next;
    });
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
        rejection_reason: (function () {
          var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
          var found = '';
          stored.forEach(function (item) {
            if (String((item && (item.tonegrid_release_id || item.id)) || '').toLowerCase() === key) {
              found = String((item && item.rejection_reason) || '').trim();
            }
          });
          return found;
        })(),
        genre: matchesDraft ? String(draft.genre || '').trim() : '',
        release_date: matchesDraft ? String(draft.release_date || '').trim() : '',
        artwork_url: (function () {
          var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
          var found = '';
          stored.forEach(function (item) {
            if (String((item && (item.tonegrid_release_id || item.id)) || '').toLowerCase() === key) {
              found = coverOf(item);
            }
          });
          return found || (matchesDraft ? coverOf(draft) : '');
        })(),
        delivered_at: (function () {
          var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
          var found = '';
          stored.forEach(function (item) {
            if (String((item && (item.tonegrid_release_id || item.id)) || '').toLowerCase() === key) {
              found = String((item && (item.delivered_at || item.deliveredAt)) || '').trim();
            }
          });
          return found;
        })(),
      });
    });
    return extra;
  }

  function hasReadableSessionCookie() {
    try {
      var raw = String((global.document && global.document.cookie) || '');
      return /(?:^|;\s*)plaiground_signed=/.test(raw) || /(?:^|;\s*)plaiground_session=/.test(raw);
    } catch (err) {
      return false;
    }
  }

  function sessionLooksSignedIn(me) {
    if (me && (me.email || me.plan || me.pending === false)) return true;
    var api = global.PlaigroundMembership;
    if (api && typeof api.isConfirmedLoggedOut === 'function' && !api.isConfirmedLoggedOut()) return true;
    if (api && typeof api.hasLiveSession === 'function' && api.hasLiveSession()) return true;
    if (api && typeof api.isSignedIn === 'function' && api.isSignedIn()) return true;
    if (api && api.account && api.account()) return true;
    return hasReadableSessionCookie();
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
    if (!$('[data-release-rows]') && !$('[data-release-empty]') && !$('[data-release-tiles]')) return;
    setStatus('Loading catalog…');
    Promise.all([getJson(RELEASES_URL), getJson(ANALYTICS_URL), loadAccount()])
      .then(function (results) {
        var list = results[0];
        var analytics = results[1];
        var me = results[2];
        if (list.status === 401) {
          if (sessionLooksSignedIn(me)) {
            var signedInOwned = accountFallback(me, []);
            setStatus('');
            render({ releases: overlayPendingCatalog(signedInOwned, me), total: signedInOwned.length, analytics: {}, me: me });
            return;
          }
          setStatus('');
          render({ releases: [], total: 0, analytics: {}, me: me });
          return;
        }
        var owned = accountFallback(me, (list.ok && list.data && list.data.releases) || []);
        if (list.status === 503 || list.data.configured === false) {
          setStatus(list.data && list.data.error === 'Accounts are not configured.'
            ? 'Accounts are not configured.'
            : (owned.length ? '' : 'Catalog sync is not configured yet.'));
          render({ releases: overlayPendingCatalog(owned, me), total: owned.length, analytics: {}, me: me });
          return;
        }
        if (!list.ok) {
          setStatus(owned.length ? '' : (list.data.error || 'Could not load releases.'));
          render({ releases: overlayPendingCatalog(owned, me), total: owned.length, analytics: {}, me: me });
          return;
        }
        var releases = list.data.releases || [];
        var extra = accountFallback(me, releases);
        releases = overlayPendingCatalog(releases.concat(extra), me);
        render({
          releases: releases,
          total: list.data.total || releases.length,
          analytics: analytics.ok ? analytics.data : {},
          me: me,
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
    var slugs = Array.prototype.slice.call(host.querySelectorAll('input[type="checkbox"]:checked')).map(function (el) {
      return el.value;
    });
    if (global.PlaigroundStorePick && global.PlaigroundStorePick.selectableSlugs) {
      return global.PlaigroundStorePick.selectableSlugs(slugs);
    }
    return slugs;
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
      var stores = (result.ok && result.data.stores) || [];
      if (global.PlaigroundStorePick && global.PlaigroundStorePick.selectableStores) {
        stores = global.PlaigroundStorePick.selectableStores(stores);
      }
      var picked = (release.dsps || []).filter(function (slug) {
        return !(global.PlaigroundStorePick && global.PlaigroundStorePick.isExcludedStore
          && global.PlaigroundStorePick.isExcludedStore(slug));
      });
      fillStores(stores, picked);
    });
    if (genre) {
      genre.disabled = false;
      if (genre.removeAttribute) {
        genre.removeAttribute('disabled');
        genre.removeAttribute('aria-disabled');
      }
      var genreField = genre.closest ? genre.closest('.field') : null;
      if (genreField && genreField.classList) genreField.classList.remove('is-locked');
    }
    if (language) {
      language.disabled = false;
      if (language.removeAttribute) {
        language.removeAttribute('disabled');
        language.removeAttribute('aria-disabled');
      }
      var languageField = language.closest ? language.closest('.field') : null;
      if (languageField && languageField.classList) languageField.classList.remove('is-locked');
    }
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
    if (catalog && (typeof catalog.ensureTypeahead === 'function' || typeof catalog.bindTypeahead === 'function')) {
      var bind = catalog.ensureTypeahead || catalog.bindTypeahead;
      try {
        if (genre && catalog.GENRES) bind.call(catalog, genre, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
        if (language && catalog.LANGUAGES) {
          bind.call(catalog, language, catalog.LANGUAGES, function (row) { return row.code; }, function (row) { return row.name; });
        }
      } catch (err) {}
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
    if (editCover) editCover.setStored(coverOf(release));
    setEditError('');
  }

  function typeaheadTypedValue(select, fallbackId) {
    if (!select) return '';
    var input = select.parentNode && select.parentNode.querySelector
      ? select.parentNode.querySelector('.typeahead-input')
      : null;
    if (!input && typeof document !== 'undefined' && document.getElementById) {
      input = document.getElementById(fallbackId || (select.id ? select.id + '-type' : ''));
    }
    return input ? String(input.value || '').trim() : '';
  }

  function pickedCatalogValue(select, fallbackId) {
    var raw = select ? String(select.value || '').trim() : '';
    if (!raw) raw = typeaheadTypedValue(select, fallbackId);
    var catalog = global.PlaigroundUploadCatalog;
    if (catalog && typeof catalog.canonicalCatalogValue === 'function') {
      var canon = catalog.canonicalCatalogValue(select, raw);
      if (canon === '') return '';
      if (canon) return canon;
      return raw ? null : '';
    }
    return raw;
  }

  function saveEdit() {
    var panel = $('[data-release-edit]');
    var id = panel && panel.getAttribute('data-release-id');
    if (!id) return;
    var storeRoot = $('[data-store-pick]') || $('[data-edit-stores]');
    if (storeRoot && global.PlaigroundStorePick && global.PlaigroundStorePick.selectedBlocked) {
      var blocked = global.PlaigroundStorePick.selectedBlocked(storeRoot);
      if (blocked && blocked.length) {
        setEditError(inactiveStoreCopy(blocked));
        return;
      }
    }
    var saveBtn = $('[data-edit-save]');
    if (saveBtn) saveBtn.setAttribute('aria-busy', 'true');
    setEditError('Saving…');
    var title = $('#edit-title') ? $('#edit-title').value.trim() : '';
    var date = $('#edit-date') ? $('#edit-date').value.trim() : '';
    var catalog = global.PlaigroundUploadCatalog;
    var genre = pickedCatalogValue($('#edit-genre'), 'edit-genre-type');
    if (genre === null) {
      if (saveBtn) saveBtn.removeAttribute('aria-busy');
      setEditError('Pick a genre from the list.');
      return;
    }
    var language = pickedCatalogValue($('#edit-language'), 'edit-language-type') || '';
    var trackTitle = $('#edit-track-title') ? $('#edit-track-title').value.trim() : '';
    var trackId = $('#edit-track-title') ? $('#edit-track-title').getAttribute('data-track-id') : '';
    var artInput = $('#edit-art');
    var art = (artInput && artInput._plaigroundFile) || (artInput && artInput.files && artInput.files[0]) || null;
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
        setEditError((failed.data && failed.data.error) || 'The store rejected the edit.');
        return;
      }
      setEditError('Saved to the store.');
      load();
    }).catch(function () {
      if (saveBtn) saveBtn.removeAttribute('aria-busy');
      setEditError('We could not reach the store.');
    });
  }

  function parseSave(response) {
    return response.json().then(function (data) {
      return { ok: response.ok, status: response.status, data: data || {} };
    }).catch(function () {
      return { ok: false, status: response.status, data: { error: 'The store rejected the edit.' } };
    });
  }

  var editCover = null;

  function bindCoverPreview() {
    var api = global.PlaigroundCoverPreview;
    if (!api || typeof api.bind !== 'function') return;
    if (editCover) return;
    var input = $('#edit-art');
    var tile = $('[data-edit-art-box]') || $('[data-art-box]');
    if (!input && !tile) return;
    editCover = api.bind({
      input: input,
      tile: tile,
      clearButton: $('[data-art-clear]'),
      storedUrl: '',
      window: global,
      URL: global.URL,
    });
  }

  function bindEdit() {
    var host = $('[data-release-rows]');
    if (host && host.addEventListener) {
      host.addEventListener('click', function (event) {
        var missing = event.target && event.target.closest ? event.target.closest('[data-edit-missing]') : null;
        if (missing) {
          if (event.preventDefault) event.preventDefault();
          if (event.stopPropagation) event.stopPropagation();
          setStatus('This release has no store ID yet, so it cannot be edited.');
          return;
        }
        var tr = event.target && event.target.closest ? event.target.closest('tr[data-release-id]') : null;
        if (!tr) return;
        if (event.target && event.target.closest && event.target.closest('a')) return;
        var id = tr.getAttribute('data-release-id');
        if (!id) {
          setStatus('This release has no store ID yet, so it cannot be edited.');
          return;
        }
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
      render({ releases: lastReleases, analytics: lastAnalytics, total: lastTotal, me: lastMe });
    });
  }

  global.PlaigroundCatalog = {
    render: render,
    isUnsubmittedDraft: isUnsubmittedDraft,
    catalogHref: catalogHref,
    accountFallback: accountFallback,
    overlayPendingCatalog: overlayPendingCatalog,
    applyFilter: applyFilter,
    isReturnedRow: isReturnedRow,
    resubmitHref: resubmitHref,
    splitRejected: splitRejected,
    setFilter: function (next) { currentFilter = String(next || 'all'); },
    fillEdit: fillEdit,
    coverPreview: function () { return editCover; },
  };
  bindFilters();
  currentFilter = filterFromSearch();
  bindEdit();
  bindCoverPreview();
  load();
})(window);
