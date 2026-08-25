/**
 * Publishing register: pick a real catalog release, then fill the work
 * from that release and any signed split already on the draft.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PlaigroundPublishingRegister = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var DUMMY = {
    'your release': true,
    'neon sermon': true,
    'neon shadows': true,
    'neon santos': true,
  };

  function trim(value) {
    return String(value == null ? '' : value).replace(/^\s+|\s+$/g, '');
  }

  function isDummyTitle(title) {
    return Boolean(DUMMY[trim(title).toLowerCase().replace(/\s+/g, ' ')]);
  }

  function releaseIdOf(row) {
    return trim((row && (row.uuid || row.tonegrid_release_id || row.release_id || row.id)) || '');
  }

  function artistOf(row, roster) {
    var name = '';
    if (row && typeof row.artist === 'string') name = trim(row.artist);
    else if (row && row.artist && typeof row.artist === 'object') {
      name = trim(row.artist.name || row.artist.title);
    }
    if (!name) name = trim((row && (row.artist_name || row.primary_artist || row.performing_artist)) || '');
    if (name) return name;
    var want = trim((row && row.plaiground_artist_id) || '');
    var list = roster || [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (!list[i]) continue;
      if (want && (list[i].id === want || list[i].artist_id === want)) return trim(list[i].name);
    }
    return '';
  }

  function formatDate(value) {
    var raw = trim(value);
    var m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : raw;
  }

  function aiCopy(draft) {
    var how = trim(draft && draft.made_how).toLowerCase();
    var bits = draft && Array.isArray(draft.human_elements)
      ? draft.human_elements.map(trim).filter(Boolean)
      : [];
    if (how === 'no_ai') return 'No AI — from your attestation';
    if (how === 'fully_ai' || how === 'full_ai') return 'Fully AI — from your attestation';
    if (how === 'ai_assisted') {
      return bits.length
        ? ('AI-assisted · ' + bits.join(', '))
        : 'AI-assisted — from your attestation';
    }
    return bits.length ? bits.join(', ') : 'From your attestation';
  }

  function writersCopy(draft) {
    var writers = draft && Array.isArray(draft.writers) ? draft.writers : [];
    var parts = writers.map(function (row) {
      var name = trim(row && (row.name || row.writer || row.legal_name));
      if (!name) return '';
      var share = row && row.share != null && row.share !== '' ? trim(row.share) : '';
      return share ? (name + ' · ' + share) : name;
    }).filter(Boolean);
    if (parts.length) return parts.join(', ');
    return 'From the signed split sheet for this work.';
  }

  function sameId(a, b) {
    return trim(a).toLowerCase() === trim(b).toLowerCase() && Boolean(trim(a));
  }

  function catalogReleases(me, liveRows) {
    var have = {};
    var out = [];
    function add(row) {
      if (!row) return;
      var id = releaseIdOf(row);
      var title = trim(row.title);
      if (isDummyTitle(title)) title = '';
      if (!id && !title) return;
      var key = (id || title).toLowerCase();
      if (have[key]) {
        var prev = have[key];
        if (!prev.title && title) prev.title = title;
        if (!prev.artist && artistOf(row)) prev.artist = artistOf(row);
        if (!prev.release_date && (row.release_date || row.releaseDate)) {
          prev.release_date = formatDate(row.release_date || row.releaseDate);
        }
        return;
      }
      var next = {
        id: id,
        title: title,
        artist: artistOf(row, me && me.profile && me.profile.artists),
        release_date: formatDate(row.release_date || row.releaseDate || ''),
        plaiground_artist_id: trim(row.plaiground_artist_id),
        status: trim(row.status || row.tonegrid_status),
      };
      have[key] = next;
      out.push(next);
    }
    (liveRows || []).forEach(add);
    var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
    stored.forEach(add);
    var ids = me && Array.isArray(me.tonegrid_release_ids) ? me.tonegrid_release_ids : [];
    ids.forEach(function (id) {
      add({ id: id, uuid: id, title: '' });
    });
    if (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus.ownedReleases) {
      (PlaigroundReleaseStatus.ownedReleases(me) || []).forEach(add);
    }
    return out.filter(function (row) {
      return row && (row.id || row.title) && !isDummyTitle(row.title);
    });
  }

  function matchingDraft(release, draft) {
    draft = draft || {};
    if (!release) return null;
    if (release.id && (sameId(draft.release_id, release.id) || sameId(draft.tonegrid_release_id, release.id))) {
      return draft;
    }
    if (release.title && trim(draft.title).toLowerCase() === release.title.toLowerCase()) return draft;
    return null;
  }

  function workFromRelease(release, opts) {
    opts = opts || {};
    var draft = matchingDraft(release, opts.draft) || {};
    var title = trim((release && release.title) || draft.title);
    if (isDummyTitle(title)) title = '';
    return {
      id: release && release.id ? release.id : '',
      title: title,
      artist: artistOf(release, opts.roster) || trim(draft.name) || '',
      date: formatDate((release && release.release_date) || draft.release_date),
      ai: aiCopy(draft),
      writers: writersCopy(draft),
    };
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text == null ? '' : String(text);
  }

  var SUBMIT_KEY = 'plaiground.publishing.submit';
  var DEFAULT_STATUS = 'Pending at BMI';
  var DEFAULT_PAID = '$0.00 · included in membership';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function filedIso(value) {
    if (typeof value === 'string') {
      var fromText = trim(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (fromText) return fromText[1] + '-' + fromText[2] + '-' + fromText[3];
    }
    if (value && typeof value.getFullYear === 'function' && !isNaN(value.getTime())) {
      return value.getFullYear() + '-' + pad2(value.getMonth() + 1) + '-' + pad2(value.getDate());
    }
    return '';
  }

  function formatFiledDisplay(value) {
    var iso = filedIso(value);
    var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    return String(Number(m[3])) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
  }

  function queryParam(search, name) {
    var q = trim(search);
    if (q.charAt(0) === '?') q = q.slice(1);
    if (!q) return '';
    var parts = q.split('&');
    var i;
    for (i = 0; i < parts.length; i += 1) {
      if (!parts[i]) continue;
      var eq = parts[i].indexOf('=');
      var key = eq === -1 ? parts[i] : parts[i].slice(0, eq);
      var val = eq === -1 ? '' : parts[i].slice(eq + 1);
      try { key = decodeURIComponent(key.replace(/\+/g, ' ')); } catch (err) {}
      if (trim(key).toLowerCase() !== name) continue;
      try { return trim(decodeURIComponent(val.replace(/\+/g, ' '))); } catch (err2) { return trim(val); }
    }
    return '';
  }

  function rememberSubmit(storage, row) {
    if (!storage || typeof storage.setItem !== 'function' || !row) return;
    try {
      storage.setItem(SUBMIT_KEY, JSON.stringify(row));
    } catch (err) {}
  }

  function readSubmit(storage) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      var raw = storage.getItem(SUBMIT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function readSubmitAny(opts) {
    if (opts && opts.submit) return opts.submit;
    var from = readSubmit(opts && opts.storage);
    if (from) return from;
    if (typeof sessionStorage !== 'undefined') {
      from = readSubmit(sessionStorage);
      if (from) return from;
    }
    if (typeof localStorage !== 'undefined') {
      from = readSubmit(localStorage);
      if (from) return from;
    }
    return null;
  }

  function writeSubmit(opts, row) {
    rememberSubmit(opts && opts.storage, row);
    if (typeof sessionStorage !== 'undefined') rememberSubmit(sessionStorage, row);
    if (typeof localStorage !== 'undefined') rememberSubmit(localStorage, row);
  }

  function confirmHref(row) {
    var id = trim(row && row.id);
    if (id) return 'publishing-confirm.html?release=' + encodeURIComponent(id);
    var title = trim(row && row.title);
    if (title && !isDummyTitle(title)) {
      return 'publishing-confirm.html?title=' + encodeURIComponent(title);
    }
    return 'publishing-confirm.html';
  }

  function findCatalogRow(list, id, title) {
    var rows = list || [];
    var i;
    if (id) {
      for (i = 0; i < rows.length; i += 1) {
        if (sameId(rows[i] && rows[i].id, id)) return rows[i];
      }
    }
    var want = trim(title).toLowerCase();
    if (want && !isDummyTitle(title)) {
      for (i = 0; i < rows.length; i += 1) {
        if (trim(rows[i] && rows[i].title).toLowerCase() === want) return rows[i];
      }
    }
    return null;
  }

  function snapshotRow(work, now) {
    var title = trim(work && work.title);
    if (isDummyTitle(title)) title = '';
    return {
      id: trim(work && work.id),
      title: title,
      artist: trim(work && work.artist),
      filed: filedIso(work && work.filed) || filedIso(now) || filedIso(new Date()),
      status: trim(work && work.status) || DEFAULT_STATUS,
      paid: trim(work && work.paid) || DEFAULT_PAID,
    };
  }

  function confirmView(opts) {
    opts = opts || {};
    var search = opts.search || '';
    var queryId = queryParam(search, 'release') || queryParam(search, 'id');
    var queryTitle = queryParam(search, 'title');
    var snap = readSubmitAny(opts) || {};
    var catalog = opts.releases || catalogReleases(opts.me, opts.liveRows);
    var snapMatchesQuery = (!queryId || !trim(snap.id) || sameId(snap.id, queryId))
      && (!queryTitle || !trim(snap.title) || trim(snap.title).toLowerCase() === trim(queryTitle).toLowerCase());
    var wantId = queryId || (snapMatchesQuery ? trim(snap.id) : '');
    var wantTitle = queryTitle || (snapMatchesQuery ? trim(snap.title) : '');
    var row = findCatalogRow(catalog, wantId, wantTitle);
    var title = '';
    var artist = '';
    if (snapMatchesQuery) {
      title = trim(snap.title);
      artist = trim(snap.artist);
    }
    if (isDummyTitle(title)) title = '';
    if (row) {
      if (!title) title = trim(row.title);
      if (!artist) artist = trim(row.artist);
    }
    if (isDummyTitle(title)) title = '';
    var filedRaw = (snapMatchesQuery && snap.filed) || opts.filed || '';
    return {
      id: wantId || (row && row.id) || (snapMatchesQuery ? trim(snap.id) : ''),
      title: title,
      artist: artist,
      filed: formatFiledDisplay(filedRaw) || formatFiledDisplay(opts.now) || '',
      status: (snapMatchesQuery && trim(snap.status)) || DEFAULT_STATUS,
      paid: (snapMatchesQuery && trim(snap.paid)) || DEFAULT_PAID,
      headline: title ? (title + ' is filed for publishing.') : 'This work is filed for publishing.',
      songHref: (wantId || (row && row.id))
        ? ('song.html?id=' + encodeURIComponent(wantId || row.id))
        : 'song.html',
    };
  }

  function bindConfirm(doc, opts) {
    opts = opts || {};
    var document = doc || (typeof root.document !== 'undefined' ? root.document : null);
    if (!document || !document.querySelector) return null;
    var view = confirmView(opts);
    setText(document.querySelector('[data-confirm-headline]'), view.headline);
    setText(document.querySelector('[data-confirm-artist]'), view.artist);
    setText(document.querySelector('[data-confirm-status]'), view.status);
    setText(document.querySelector('[data-confirm-filed]'), view.filed);
    setText(document.querySelector('[data-confirm-paid]'), view.paid);
    var song = document.querySelector('[data-confirm-song]');
    if (song && song.setAttribute) song.setAttribute('href', view.songHref);
    return view;
  }

  function bind(doc, opts) {
    opts = opts || {};
    var document = doc || (typeof root.document !== 'undefined' ? root.document : null);
    if (!document || !document.querySelector) return null;
    var rootEl = document.querySelector('[data-publishing-pick]');
    if (!rootEl) return null;
    var sel = document.querySelector('[data-publishing-release]') || document.getElementById('pub-release');
    var empty = document.querySelector('[data-publishing-empty]');
    var carry = document.querySelector('[data-publishing-carry]');
    var cap = document.querySelector('[data-publishing-cap]');
    var submitBtn = document.querySelector('[data-publishing-submit]') || document.getElementById('submit-reg');
    var releases = [];

    function showCarry(on) {
      if (!carry) return;
      carry.hidden = !on;
    }

    function paintWork(work) {
      setText(document.querySelector('[data-work-title]'), (work && work.title) || '');
      setText(document.querySelector('[data-work-artist]'), (work && work.artist) || '');
      setText(document.querySelector('[data-work-date]'), (work && work.date) || '');
      setText(document.querySelector('[data-work-ai]'), (work && work.ai) || '');
      setText(document.querySelector('[data-work-writers]'), (work && work.writers) || '');
      showCarry(Boolean(work && (work.title || work.artist || work.date)));
    }

    function releasePickValue(row, index) {
      return (row && row.id) || ('title:' + index);
    }

    function bindPicker() {
      var catalog = (typeof PlaigroundUploadCatalog !== 'undefined' && PlaigroundUploadCatalog) || null;
      if (!sel || !catalog || typeof catalog.bindTypeahead !== 'function' || !releases.length) return;
      if (sel.removeAttribute) sel.removeAttribute('data-typeahead');
      catalog.bindTypeahead(sel, releases, function (row) {
        var i;
        for (i = 0; i < releases.length; i += 1) {
          if (releases[i] === row) return releasePickValue(row, i);
        }
        return releasePickValue(row, 0);
      }, function (row) {
        return (row && row.title) || 'Untitled release';
      });
    }

    function fillSelect(list) {
      releases = list || [];
      if (empty) empty.hidden = Boolean(releases.length);
      if (!sel) return;
      if (sel.options && typeof sel.options.length === 'number') sel.options.length = 0;
      else while (sel.firstChild) sel.removeChild(sel.firstChild);
      var blank = document.createElement('option');
      blank.value = '';
      blank.textContent = releases.length ? 'Select a release' : 'No releases yet';
      sel.appendChild(blank);
      releases.forEach(function (row, index) {
        var opt = document.createElement('option');
        opt.value = releasePickValue(row, index);
        opt.textContent = row.title || 'Untitled release';
        sel.appendChild(opt);
      });
      sel.value = '';
      paintWork(null);
      syncSubmitHref();
      bindPicker();
    }

    function picked() {
      if (!sel) return null;
      var value = String(sel.value || '');
      if (!value) return null;
      var i;
      for (i = 0; i < releases.length; i += 1) {
        if ((releases[i].id || ('title:' + i)) === value) return releases[i];
      }
      return null;
    }

    function currentWork() {
      var release = picked();
      return release ? workFromRelease(release, opts) : null;
    }

    function syncSubmitHref() {
      if (!submitBtn || !submitBtn.setAttribute) return;
      submitBtn.setAttribute('href', confirmHref(currentWork()));
    }

    function persistSubmit(event) {
      if (!submitBtn) return;
      if (submitBtn.classList && submitBtn.classList.contains('is-off')) {
        if (event && event.preventDefault) event.preventDefault();
        return;
      }
      if (submitBtn.getAttribute && submitBtn.getAttribute('aria-disabled') === 'true') {
        if (event && event.preventDefault) event.preventDefault();
        return;
      }
      var work = currentWork();
      if (!work || !work.title || isDummyTitle(work.title)) {
        if (event && event.preventDefault) event.preventDefault();
        return;
      }
      var row = snapshotRow(work, opts.now);
      writeSubmit(opts, row);
      if (submitBtn.setAttribute) submitBtn.setAttribute('href', confirmHref(row));
    }

    function applyPick() {
      var release = picked();
      if (!release) {
        paintWork(null);
        syncSubmitHref();
        return;
      }
      var work = workFromRelease(release, opts);
      paintWork(work);
      syncSubmitHref();
      if (release.id && typeof opts.loadRelease === 'function') {
        Promise.resolve(opts.loadRelease(release.id)).then(function (live) {
          if (!live) return;
          var merged = Object.assign({}, release, live, {
            id: releaseIdOf(live) || release.id,
            title: trim(live.title) || release.title,
            artist: artistOf(live, opts.roster) || release.artist,
            release_date: formatDate(live.release_date || live.releaseDate) || release.release_date,
          });
          if (picked() && sameId(picked().id, merged.id)) {
            paintWork(workFromRelease(merged, opts));
            syncSubmitHref();
          }
        }).catch(function () {});
      }
    }

    if (sel && sel.addEventListener) sel.addEventListener('change', applyPick);
    if (submitBtn && submitBtn.addEventListener) submitBtn.addEventListener('click', persistSubmit);
    var plan = trim(opts.plan || (opts.me && opts.me.plan)).toLowerCase();
    if (cap) cap.hidden = plan !== 'creator';
    fillSelect(opts.releases || catalogReleases(opts.me, opts.liveRows));
    return {
      releases: function () { return releases.slice(); },
      applyPick: applyPick,
      fillSelect: fillSelect,
      persistSubmit: persistSubmit,
    };
  }

  return {
    isDummyTitle: isDummyTitle,
    catalogReleases: catalogReleases,
    workFromRelease: workFromRelease,
    aiCopy: aiCopy,
    writersCopy: writersCopy,
    formatFiledDisplay: formatFiledDisplay,
    confirmHref: confirmHref,
    confirmView: confirmView,
    rememberSubmit: rememberSubmit,
    readSubmit: readSubmit,
    bindConfirm: bindConfirm,
    bind: bind,
  };
});
