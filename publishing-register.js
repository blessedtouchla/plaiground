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

    function applyPick() {
      var release = picked();
      if (!release) {
        paintWork(null);
        return;
      }
      var work = workFromRelease(release, opts);
      paintWork(work);
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
          }
        }).catch(function () {});
      }
    }

    if (sel && sel.addEventListener) sel.addEventListener('change', applyPick);
    var plan = trim(opts.plan || (opts.me && opts.me.plan)).toLowerCase();
    if (cap) cap.hidden = plan !== 'creator';
    fillSelect(opts.releases || catalogReleases(opts.me, opts.liveRows));
    return {
      releases: function () { return releases.slice(); },
      applyPick: applyPick,
      fillSelect: fillSelect,
    };
  }

  return {
    isDummyTitle: isDummyTitle,
    catalogReleases: catalogReleases,
    workFromRelease: workFromRelease,
    aiCopy: aiCopy,
    writersCopy: writersCopy,
    bind: bind,
  };
});
