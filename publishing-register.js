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
    if (how === 'no_ai') return 'Human. From your attestation';
    if (how === 'fully_ai' || how === 'full_ai') return 'Fully AI. From your attestation';
    if (how === 'ai_assisted') {
      return bits.length
        ? ('AI-assisted · ' + bits.join(', '))
        : 'AI-assisted. From your attestation';
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
  var DEFAULT_STATUS = 'Draft';
  var DEFAULT_PAID = '$0.00 · included';
  var PUBLIC_LABELS = ['Draft', 'Not covered', 'Submitted', 'Registered', 'Matched', 'Paid'];
  var PUBLIC_EXPLAIN = {
    Draft: 'Saved with PLAIGROUND. Nothing has been sent to a society, The MLC, SoundExchange, or YouTube.',
    'Not covered': 'PLAIGROUND is not filing this work. No society, MLC, SoundExchange, or YouTube status is on file.',
    Submitted: 'A receipt is on file that this work was sent. That is not acceptance, a match, or a payment.',
    Registered: 'A receipt is on file that a registry accepted this work. The receipt is the only proof.',
    Matched: 'A receipt is on file that a recording was matched to this work. The receipt is the only proof.',
    Paid: 'A receipt is on file that money was paid for this work. The receipt is the only proof.',
  };
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

  function receiptOn(row) {
    return trim(row && (row.receipt || row.external_reference || row.evidence || row.match_receipt || row.payment_receipt));
  }

  function displayStatus(value, row) {
    var raw = trim(value);
    if (PUBLIC_LABELS.indexOf(raw) !== -1) {
      if ((raw === 'Submitted' || raw === 'Registered' || raw === 'Matched' || raw === 'Paid') && row && !receiptOn(row) && !row.status_label) {
        return DEFAULT_STATUS;
      }
      return raw;
    }
    var key = raw.toLowerCase().replace(/[\s-]+/g, '_');
    if (key === 'needs_agreement' || key === 'rejected' || key === 'not_covered') return 'Not covered';
    if (key === 'needs_information' || key === 'under_review' || key === 'request_received' || key === 'draft') return 'Draft';
    var receipt = receiptOn(row);
    if (!receipt) return DEFAULT_STATUS;
    if (key === 'submitted') return 'Submitted';
    if (key === 'accepted' || key === 'registered') return 'Registered';
    if (key === 'matched') return 'Matched';
    if (key === 'paid') return 'Paid';
    return DEFAULT_STATUS;
  }

  function explainStatus(label) {
    return PUBLIC_EXPLAIN[label] || PUBLIC_EXPLAIN.Draft;
  }

  function headlineFor(title, status, row) {
    var label = displayStatus(status, row);
    var name = title || 'This work';
    if (label === 'Not covered') return name + ' is not covered.';
    if (label === 'Submitted') return name + ' is submitted.';
    if (label === 'Registered') return name + ' is registered.';
    if (label === 'Matched') return name + ' is matched.';
    if (label === 'Paid') return name + ' is paid.';
    return name + ' is a draft.';
  }

  function snapshotRow(work, now) {
    var title = trim(work && work.title);
    if (isDummyTitle(title)) title = '';
    var snap = {
      id: trim(work && work.id),
      title: title,
      artist: trim(work && work.artist),
      filed: filedIso(work && work.filed) || filedIso(now) || filedIso(new Date()),
      status: displayStatus(work && work.status, work),
      paid: trim(work && work.paid) || DEFAULT_PAID,
    };
    ['external_reference', 'evidence', 'match_receipt', 'payment_receipt'].forEach(function (key) {
      var value = trim(work && work[key]);
      if (value) snap[key] = value;
    });
    return snap;
  }

  function confirmView(opts) {
    opts = opts || {};
    if (opts.registration && typeof opts.registration === 'object') {
      var reg = opts.registration;
      var regTitle = trim(reg.work_title || reg.title);
      if (isDummyTitle(regTitle)) regTitle = '';
      var regStatus = reg.status_label || reg.status;
      var shownReg = displayStatus(regStatus, reg);
      return {
        id: trim(reg.release_id || reg.id),
        title: regTitle,
        artist: trim(reg.performing_artist || reg.artist),
        filed: formatFiledDisplay(reg.created_at || reg.filed) || formatFiledDisplay(opts.now) || '',
        status: shownReg,
        paid: DEFAULT_PAID,
        lead: trim(reg.status_detail || reg.lead) || explainStatus(shownReg),
        headline: headlineFor(regTitle, regStatus, reg),
        songHref: trim(reg.release_id)
          ? ('song.html?id=' + encodeURIComponent(trim(reg.release_id)))
          : 'publishing-register.html',
      };
    }
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
    var snapRow = snapMatchesQuery ? snap : null;
    var snapStatus = (snapMatchesQuery && snap.status) || opts.status || '';
    var shownSnap = displayStatus(snapStatus, snapRow);
    return {
      id: wantId || (row && row.id) || (snapMatchesQuery ? trim(snap.id) : ''),
      title: title,
      artist: artist,
      filed: formatFiledDisplay(filedRaw) || formatFiledDisplay(opts.now) || '',
      status: shownSnap,
      paid: (snapMatchesQuery && trim(snap.paid)) || DEFAULT_PAID,
      lead: explainStatus(shownSnap),
      headline: headlineFor(title, snapStatus, snapRow),
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
    setText(document.querySelector('[data-confirm-lead]'), view.lead || '');
    setText(document.querySelector('[data-confirm-filed]'), view.filed);
    setText(document.querySelector('[data-confirm-paid]'), view.paid);
    var song = document.querySelector('[data-confirm-song]');
    if (song && song.setAttribute) song.setAttribute('href', view.songHref);
    return view;
  }

  function inputValue(doc, sel) {
    var el = doc && doc.querySelector ? doc.querySelector(sel) : null;
    return el ? trim(el.value) : '';
  }

  function checked(doc, sel) {
    var el = doc && doc.querySelector ? doc.querySelector(sel) : null;
    return Boolean(el && el.checked);
  }

  function writerFromRow(row) {
    if (!row || !row.querySelector) return null;
    return {
      name: trim(row.querySelector('[data-writer-name]') && row.querySelector('[data-writer-name]').value),
      share: trim(row.querySelector('[data-writer-share]') && row.querySelector('[data-writer-share]').value),
      pro: trim(row.querySelector('[data-writer-pro]') && row.querySelector('[data-writer-pro]').value),
      ipi: trim(row.querySelector('[data-writer-ipi]') && row.querySelector('[data-writer-ipi]').value),
      pro_other: trim(row.querySelector('[data-writer-pro-other]') && row.querySelector('[data-writer-pro-other]').value),
    };
  }

  function writersFrom(root) {
    var rows = root && root.querySelectorAll ? root.querySelectorAll('[data-writer-row]') : [];
    var out = [];
    var i;
    for (i = 0; i < rows.length; i += 1) {
      var writer = writerFromRow(rows[i]);
      if (writer && (writer.name || writer.share || writer.pro)) out.push(writer);
    }
    return out;
  }

  function otherPublishersFrom(text) {
    var lines = String(text || '').split(/\n+/);
    var out = [];
    var i;
    for (i = 0; i < lines.length; i += 1) {
      var line = trim(lines[i]);
      if (!line) continue;
      var parts = line.split(',');
      out.push({ name: trim(parts[0]), share: trim(parts.slice(1).join(',')) });
    }
    return out;
  }

  function workFields(root, title) {
    return {
      title: title,
      writers: writersFrom(root),
      publisher_share_percent: inputValue(root, '[data-pub-publisher-share]'),
      other_publishers: otherPublishersFrom(inputValue(root, '[data-pub-other-publishers]')),
      made_how: inputValue(root, '[data-pub-made-how]'),
      human_contribution: inputValue(root, '[data-pub-contribution]'),
      alternate_title: inputValue(root, '[data-pub-alt]'),
      duration: inputValue(root, '[data-pub-duration]'),
      language: inputValue(root, '[data-pub-language]'),
      isrc: inputValue(root, '[data-pub-isrc]'),
      credits: {
        performers: inputValue(root, '[data-pub-performers]'),
        producers: inputValue(root, '[data-pub-producers]'),
        featured: inputValue(root, '[data-pub-featured]'),
      },
    };
  }

  function idempotencyKey(storage) {
    var keyName = 'plaiground.publishing.idempotency';
    var existing = storage && storage.getItem ? storage.getItem(keyName) : '';
    if (existing && /^[A-Za-z0-9._:-]{8,80}$/.test(existing)) return existing;
    var next = 'pub-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    if (storage && storage.setItem) {
      try { storage.setItem(keyName, next); } catch (err) {}
    }
    return next;
  }

  function writerRowHtml() {
    return '<div class="form-grid" data-writer-row>'
      + '<div class="field"><label>Writer legal name<input data-writer-name autocomplete="name" /></label></div>'
      + '<div class="field"><label>Share of writer half<input data-writer-share inputmode="decimal" placeholder="50" /></label></div>'
      + '<div class="field"><label>PRO<select data-writer-pro><option value="">Select</option><option>BMI</option><option>ASCAP</option><option>SESAC</option><option>GMR</option><option>Other</option><option>None / not yet</option></select></label></div>'
      + '<div class="field"><label>IPI, if they have one<input data-writer-ipi inputmode="numeric" /></label></div>'
      + '</div>';
  }

  function trackCardHtml(index) {
    return '<article class="flow-card" data-pub-track>'
      + '<h3>Composition ' + index + '</h3>'
      + '<div class="field"><label>Title<input data-track-title /></label></div>'
      + '<div data-writer-list>' + writerRowHtml() + '</div>'
      + '<p><button class="btn btn-ghost btn-sm" type="button" data-pub-add-writer>Add writer</button></p>'
      + '<div class="field"><label>Publisher share PLAIGROUND may represent<input data-pub-publisher-share type="number" min="0" max="100" step="0.01" placeholder="Enter the share" /></label></div>'
      + '<div class="field"><label>How it was made<select data-pub-made-how><option value="">Select</option><option value="no_ai">Human, no AI in the composition</option><option value="ai_assisted">AI-assisted, a human wrote part</option><option value="fully_ai">Fully AI, prompts only</option><option value="unsure">Not sure</option></select></label></div>'
      + '<div class="field"><label>Human contribution<textarea data-pub-contribution rows="3"></textarea></label></div>'
      + '<div class="form-grid">'
      + '<div class="field"><label>Performers<input data-pub-performers /></label></div>'
      + '<div class="field"><label>Producers<input data-pub-producers /></label></div>'
      + '<div class="field"><label>Featured<input data-pub-featured /></label></div>'
      + '</div>'
      + '<div class="form-grid">'
      + '<div class="field"><label>Duration<input data-pub-duration placeholder="3:41" /></label></div>'
      + '<div class="field"><label>ISRC<input data-pub-isrc /></label></div>'
      + '</div>'
      + '</article>';
  }

  function mountIntake(doc) {
    if (!doc || !doc.querySelector || !doc.querySelector('[data-pub-publisher-share]')) return;
    var albumBox = doc.querySelector('[data-pub-album]');
    var albumFields = doc.querySelector('[data-pub-album-fields]');
    var single = doc.querySelector('[data-pub-single]');
    var tracks = doc.querySelector('[data-pub-tracks]');
    function syncAlbum() {
      var on = Boolean(albumBox && albumBox.checked);
      if (albumFields) albumFields.hidden = !on;
      if (single) single.hidden = on;
      if (on && tracks && !tracks.querySelector('[data-pub-track]')) {
        tracks.insertAdjacentHTML('beforeend', trackCardHtml(1) + trackCardHtml(2));
      }
    }
    if (albumBox && albumBox.addEventListener) albumBox.addEventListener('change', syncAlbum);
    var addTrack = doc.querySelector('[data-pub-add-track]');
    if (addTrack && addTrack.addEventListener) {
      addTrack.addEventListener('click', function () {
        if (!tracks) return;
        var count = tracks.querySelectorAll('[data-pub-track]').length + 1;
        tracks.insertAdjacentHTML('beforeend', trackCardHtml(count));
      });
    }
    if (doc.addEventListener) {
      doc.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('[data-pub-add-writer]') : null;
        if (!button) return;
        var list = button.parentNode && button.parentNode.parentNode && button.parentNode.parentNode.querySelector
          ? button.parentNode.parentNode.querySelector('[data-writer-list]')
          : null;
        if (!list && single) list = single.querySelector('[data-writer-list]');
        if (list && list.insertAdjacentHTML) list.insertAdjacentHTML('beforeend', writerRowHtml());
      });
    }
    var share = doc.querySelector('[data-pub-single] [data-pub-publisher-share]');
    var shareNote = doc.querySelector('[data-pub-share-note]');
    function syncShare() {
      if (!shareNote || !share) return;
      shareNote.hidden = String(share.value) !== '100';
    }
    if (share && share.addEventListener) share.addEventListener('input', syncShare);
    syncAlbum();
  }

  function paintRequests(doc, rows) {
    var host = doc && doc.querySelector ? doc.querySelector('[data-publishing-rows]') : null;
    if (!host) return;
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      host.textContent = 'No publishing requests yet.';
      return;
    }
    host.innerHTML = '';
    list.forEach(function (row) {
      var p = doc.createElement('p');
      var title = trim(row.album_title) ? (row.album_title + ' / ' + row.work_title) : row.work_title;
      p.textContent = title + ' · ' + displayStatus(row.status_label || row.status, row);
      host.appendChild(p);
    });
  }

  function postIntake(payload) {
    if (typeof fetch !== 'function') {
      return Promise.resolve({ ok: false, error: 'Publishing intake needs a signed-in session.' });
    }
    return fetch('/api/me/publishing', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      }, function () {
        return { ok: false, error: 'Could not save the request.' };
      });
    }).catch(function () {
      return { ok: false, error: 'Could not save the request.' };
    });
  }

  function buildIntake(doc, work, opts) {
    opts = opts || {};
    if (!doc || !doc.querySelector || !doc.querySelector('[data-pub-publisher-share]')) return null;
    var outside = checked(doc, '[data-pub-outside]');
    var album = checked(doc, '[data-pub-album]');
    var title = inputValue(doc, '[data-pub-title]') || trim(work && work.title);
    var artist = inputValue(doc, '[data-pub-artist]') || trim(work && work.artist);
    var releaseId = outside ? '' : trim(work && work.id);
    var payload = {
      performing_artist: artist,
      release_id: releaseId,
      pro: inputValue(doc, '[data-pub-pro]'),
      ipi: inputValue(doc, '[data-pub-ipi]'),
      pro_other: inputValue(doc, '[data-pub-pro-other]'),
      mandate: checked(doc, '[data-pub-mandate]') || checked(doc, '#confirm-human'),
      idempotency_key: idempotencyKey(opts.storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null)),
    };
    if (album) {
      payload.album_title = inputValue(doc, '[data-pub-album-title]') || title;
      var cards = doc.querySelectorAll('[data-pub-track]');
      payload.works = [];
      var i;
      for (i = 0; i < cards.length; i += 1) {
        var card = cards[i];
        var item = workFields(card, inputValue(card, '[data-track-title]'));
        item.track_position = i + 1;
        payload.works.push(item);
      }
      if (payload.works.length < 2) return { error: 'Add at least two compositions. Each one keeps its own rights.' };
    } else {
      var singleRoot = doc.querySelector('[data-pub-single]') || doc;
      var single = workFields(singleRoot, title);
      Object.keys(single).forEach(function (key) { payload[key] = single[key]; });
      payload.title = title;
    }
    if (!payload.mandate) return { error: 'Authorize PLAIGROUND to prepare the filing. That authorization is not a publishing contract.' };
    if (!album && !payload.publisher_share_percent) {
      return { error: 'Enter the publisher share PLAIGROUND is authorized to represent. 100% is not assumed.' };
    }
    return { payload: payload };
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
      var titleInput = document.querySelector('[data-pub-title]');
      var artistInput = document.querySelector('[data-pub-artist]');
      if (titleInput && work && work.title) titleInput.value = work.title;
      if (artistInput && work && work.artist) artistInput.value = work.artist;
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
      var intake = buildIntake(document, work, opts);
      if (intake && intake.error) {
        if (event && event.preventDefault) event.preventDefault();
        setText(document.querySelector('[data-publishing-error]'), intake.error);
        var errEl = document.querySelector('[data-publishing-error]');
        if (errEl) errEl.hidden = false;
        return;
      }
      if (intake && intake.payload) {
        if (event && event.preventDefault) event.preventDefault();
        var send = opts.save || postIntake;
        Promise.resolve(send(intake.payload)).then(function (result) {
          var data = result && (result.data || result);
          var rows = data && (data.registrations || (data.registration ? [data.registration] : []));
          var first = rows && rows[0];
          if (!result || result.ok === false || !first) {
            setText(document.querySelector('[data-publishing-error]'), (data && data.error) || (result && result.error) || 'Could not save the request.');
            var fail = document.querySelector('[data-publishing-error]');
            if (fail) fail.hidden = false;
            return;
          }
          var snap = snapshotRow({
            id: first.release_id || first.id,
            title: first.work_title || first.album_title,
            artist: first.performing_artist,
            filed: first.created_at,
            status: first.status_label || first.status,
            external_reference: first.external_reference,
            evidence: first.evidence,
            match_receipt: first.match_receipt,
            payment_receipt: first.payment_receipt,
          }, opts.now);
          snap.lead = first.status_detail || '';
          writeSubmit(opts, snap);
          if (typeof sessionStorage !== 'undefined') {
            try { sessionStorage.removeItem('plaiground.publishing.idempotency'); } catch (err) {}
          }
          var next = 'publishing-confirm.html?id=' + encodeURIComponent(first.id);
          if (first.album_group_id) next += '&group=' + encodeURIComponent(first.album_group_id);
          if (opts.assign) opts.assign(next);
          else if (typeof window !== 'undefined' && window.location) window.location.href = next;
        }).catch(function () {
          setText(document.querySelector('[data-publishing-error]'), 'Could not save the request.');
        });
        return;
      }
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
    mountIntake(document);
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
    buildIntake: buildIntake,
    displayStatus: displayStatus,
    headlineFor: headlineFor,
    mountIntake: mountIntake,
    paintRequests: paintRequests,
  };
});
