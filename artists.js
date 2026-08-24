(function (global) {
  var PHOTO_RE = /^data:image\/(jpeg|jpg|png);base64,/i;
  var MAX_GENRES = 5;

  function $(sel) {
    if (sel && sel.charAt(0) === '#' && document.getElementById) {
      var byId = document.getElementById(sel.slice(1));
      if (byId) return byId;
    }
    return document.querySelector(sel);
  }

  function sanitizePartnerCopy(text) {
    var next = String(text == null ? '' : text);
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
    if (!el) return;
    el.hidden = Boolean(hidden);
    if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
  }

  function catalog() {
    return global.PlaigroundUploadCatalog || { GENRES: [] };
  }

  function checkApi() {
    return global.PlaigroundArtistCheck || null;
  }

  function canonicalGenre(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    var list = catalog().GENRES || [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i] === raw || String(list[i]).toLowerCase() === raw.toLowerCase()) return list[i];
    }
    return '';
  }

  function isLeftoverArtistName(name) {
    var next = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!next) return false;
    if (
      next === 'john'
      || next === 'john ham'
      || next === 'john doe'
      || next === 'john harper'
      || next === 'patrick'
      || next === 'neon shadows'
      || next === 'neon sermon'
      || next === 'neon santos'
      || next === 'victoria reyes'
      || next === 'victoria void'
    ) return true;
    var first = next.split(' ')[0];
    return first === 'john' || first === 'patrick';
  }

  function rosterFromMe(me) {
    var raw = me && me.profile && Array.isArray(me.profile.artists) ? me.profile.artists : [];
    var artists = raw.filter(function (artist) {
      return artist && artist.name && !isLeftoverArtistName(artist.name);
    });
    if (artists.length) return artists.slice();
    if (me && me.artist && !isLeftoverArtistName(me.artist)) {
      return [{ id: 'account', name: me.artist, source: 'created', badge: 'PLAIGROUND', genres: [], photo: '', bio: '' }];
    }
    return [];
  }

  function setPhoto(sel, url) {
    var el = $(sel);
    if (!el) return;
    var art = String(url || '').trim();
    if (el.style) el.style.backgroundImage = art ? ('url("' + art.replace(/"/g, '') + '")') : '';
    if (el.classList && el.classList.toggle) el.classList.toggle('has-art', Boolean(art));
  }

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data || {} };
      }).catch(function () {
        return { ok: false, status: response.status, data: {} };
      });
    });
  }

  function fillGenreSelect() {
    var sel = $('#artist-genre');
    if (!sel) return;
    var current = sel.value;
    sel.textContent = '';
    var blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Pick a genre';
    sel.appendChild(blank);
    (catalog().GENRES || []).forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    sel.value = current;
  }

  function renderGenrePicks(values) {
    var host = $('[data-artist-genre-picks]');
    if (!host) return;
    host.textContent = '';
    (values || []).forEach(function (name) {
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'tag on';
      pill.textContent = name;
      pill.setAttribute('data-genre', name);
      host.appendChild(pill);
    });
  }

  var current = { artists: [], selected: null, photo: '', me: null, catalog: [] };

  function renderList() {
    var host = $('[data-artist-list]');
    if (!host) return;
    host.textContent = '';
    current.artists.forEach(function (artist) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'artist-row' + (current.selected && current.selected.id === artist.id ? ' is-on' : '');
      btn.setAttribute('data-artist-id', artist.id);
      var title = document.createElement('strong');
      title.textContent = artist.name;
      var badge = document.createElement('span');
      badge.className = 'plan-badge';
      badge.textContent = artist.badge || (artist.source === 'linked' ? 'Linked' : 'PLAIGROUND');
      btn.appendChild(title);
      btn.appendChild(badge);
      host.appendChild(btn);
    });
    setHidden('[data-artist-empty]', current.artists.length > 0);
  }

  function selectArtist(artist) {
    current.selected = artist || null;
    current.photo = artist && artist.photo ? artist.photo : '';
    renderList();
    setHidden('[data-artist-edit]', !artist);
    if (!artist) {
      renderSongs(null);
      return;
    }
    setText('[data-artist-edit-title]', artist.name);
    setText('[data-artist-badge]', artist.badge || (artist.source === 'linked' ? 'Linked' : 'PLAIGROUND'));
    var nameEl = $('#artist-name');
    var spotify = $('#artist-spotify');
    var apple = $('#artist-apple');
    var store = $('#artist-store');
    var bio = $('#artist-bio');
    var change = $('#artist-change');
    renderSongs(artist);
    if (nameEl) {
      nameEl.value = artist.name || '';
      nameEl.disabled = artist.locked === true;
    }
    if (spotify) {
      spotify.value = artist.spotify_id || '';
      spotify.disabled = artist.locked === true || artist.source === 'linked';
    }
    if (apple) {
      apple.value = artist.apple_id || '';
      apple.disabled = artist.locked === true || artist.source === 'linked';
    }
    if (store) {
      store.value = artist.store_url || '';
      store.disabled = artist.locked === true || artist.source === 'linked';
    }
    if (bio) bio.value = artist.bio || '';
    if (change) change.value = artist.change_request || '';
    setPhoto('[data-artist-photo-edit]', current.photo);
    renderGenrePicks(artist.genres || []);
    paintAiFields(artist);
    setHidden('[data-artist-locked-note]', !artist.locked);
    setHidden('[data-artist-change-wrap]', !artist.locked);
    var field = $('[data-artist-name-field]');
    if (field && field.classList) field.classList.toggle('is-locked', artist.locked === true);
  }

  function setChecks(sel, values) {
    var want = values || [];
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (box) {
      var key = box.getAttribute(sel.indexOf('human') !== -1 ? 'data-human-contribution' : 'data-ai-contribution');
      box.checked = want.indexOf(key) !== -1;
    });
  }

  function readChecks(attr) {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (box) {
      if (box.checked) out.push(box.getAttribute(attr));
    });
    return out;
  }

  function involvementValue() {
    var num = $('#artist-ai-percent');
    if (!num) return null;
    var raw = String(num.value || '').trim();
    if (!raw) return null;
    var n = Number(raw);
    if (!isFinite(n)) return null;
    return Math.round(n);
  }

  function paintAiMeter() {
    var pct = involvementValue();
    var range = $('#artist-ai-range');
    var label = $('[data-artist-ai-meter]');
    var summary = $('[data-artist-ai-summary]');
    var empty = $('[data-artist-ai-empty]');
    var human = readChecks('data-human-contribution');
    var ai = readChecks('data-ai-contribution');
    var detail = $('#artist-ai-detail') ? String($('#artist-ai-detail').value || '').trim() : '';
    var has = pct != null || human.length || ai.length || Boolean(detail);
    if (range && pct != null) range.value = String(pct);
    if (label) label.textContent = pct == null ? 'Not set yet' : ('AI involvement: ' + pct + '%');
    setHidden('[data-artist-ai-empty]', has);
    setHidden('[data-artist-ai-summary]', !has || pct == null);
    if (summary && pct != null) summary.textContent = 'AI involvement: ' + pct + '%';
  }

  function paintAiFields(artist) {
    setChecks('[data-human-contribution]', artist.human_contributions || []);
    setChecks('[data-ai-contribution]', artist.ai_contributions || []);
    var detail = $('#artist-ai-detail');
    if (detail) detail.value = artist.ai_process_detail || '';
    var num = $('#artist-ai-percent');
    var range = $('#artist-ai-range');
    var pct = artist.ai_involvement_percent;
    if (num) num.value = pct == null ? '' : String(pct);
    if (range) range.value = pct == null ? '0' : String(pct);
    paintAiMeter();
  }

  function selectedGenres() {
    var host = $('[data-artist-genre-picks]');
    var out = [];
    if (!host) return out;
    Array.prototype.forEach.call(host.querySelectorAll('[data-genre]'), function (el) {
      var name = canonicalGenre(el.getAttribute('data-genre'));
      if (name && out.indexOf(name) === -1) out.push(name);
    });
    return out;
  }

  function showStatus(text) {
    setText('[data-artists-status]', text || '');
    setHidden('[data-artists-status]', !text);
  }

  function showError(text) {
    setText('[data-artist-error]', text || '');
    setHidden('[data-artist-error]', !text);
  }

  function applyMe(me) {
    current.me = me || null;
    current.artists = rosterFromMe(me);
    renderList();
    if (current.selected) {
      var keep = null;
      current.artists.forEach(function (row) {
        if (row.id === current.selected.id) keep = row;
      });
      selectArtist(keep || current.artists[0] || null);
    } else if (current.artists[0]) {
      selectArtist(current.artists[0]);
    } else {
      renderSongs(null);
    }
  }

  function storedRelease(me, release) {
    var list = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
    var want = String((release && (release.uuid || release.id || release.tonegrid_release_id)) || '').toLowerCase();
    var i;
    for (i = 0; i < list.length; i += 1) {
      var id = String((list[i] && (list[i].tonegrid_release_id || list[i].id)) || '').toLowerCase();
      if (want && id === want) return list[i];
    }
    return null;
  }

  function releaseBelongs(row, artist, me) {
    if (!row || !artist) return false;
    var stored = storedRelease(me, row) || {};
    if (stored.plaiground_artist_id && stored.plaiground_artist_id === artist.id) return true;
    if (row.plaiground_artist_id && row.plaiground_artist_id === artist.id) return true;
    var artistName = String(artist.name || '').toLowerCase();
    var rowName = String(row.artist || row.artist_name || stored.artist_name || '').toLowerCase();
    if (artistName && rowName && artistName === rowName) return true;
    if (current.artists.length === 1) return true;
    return false;
  }

  function catalogForArtist(artist) {
    var me = current.me;
    var catalog = Array.isArray(current.catalog) ? current.catalog.slice() : [];
    var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
    stored.forEach(function (item) {
      var id = String((item && (item.tonegrid_release_id || item.id)) || '');
      if (!id) return;
      var exists = catalog.some(function (row) {
        return String(row.uuid || row.id || '').toLowerCase() === id.toLowerCase();
      });
      if (!exists) {
        catalog.push({
          uuid: id,
          title: item.title || 'Untitled',
          status: item.tonegrid_status || '',
          artist: '',
          plaiground_artist_id: item.plaiground_artist_id || '',
          deliveries: [],
        });
      }
    });
    return catalog.filter(function (row) { return releaseBelongs(row, artist, me); });
  }

  function renderSongs(artist) {
    var host = $('[data-artist-song-list]');
    var empty = $('[data-artist-songs-empty]');
    var panel = $('[data-artist-songs]');
    if (panel) {
      panel.hidden = !artist;
      if (panel.classList && panel.classList.toggle) panel.classList.toggle('is-hidden', !artist);
    }
    if (!host) return;
    host.textContent = '';
    if (!artist) {
      if (empty) empty.hidden = true;
      return;
    }
    var rows = catalogForArtist(artist);
    if (empty) empty.hidden = rows.length > 0;
    var statusApi = global.PlaigroundReleaseStatus;
    var playerApi = global.PlaigroundLivePlayer;
    rows.forEach(function (row) {
      var stored = storedRelease(current.me, row);
      var status = (row && row.status) || (stored && stored.tonegrid_status) || '';
      var info = statusApi ? statusApi.info(status) : { label: status || 'Draft', live: false };
      var card = document.createElement('div');
      card.className = 'artist-song';
      var top = document.createElement('div');
      top.className = 'artist-song-top';
      var title = document.createElement('a');
      title.href = 'song.html?id=' + encodeURIComponent(row.uuid || '');
      var strong = document.createElement('strong');
      strong.textContent = row.title || 'Untitled';
      title.appendChild(strong);
      var pill = document.createElement('span');
      pill.className = 'pill' + (info.live ? ' pill-green' : (info.dot === 'yellow' ? ' is-yellow' : (info.dot === 'red' ? ' is-red' : '')));
      pill.textContent = info.label || 'Draft';
      top.appendChild(title);
      top.appendChild(pill);
      card.appendChild(top);
      var player = document.createElement('div');
      player.className = 'owner-player';
      if (playerApi) {
        playerApi.mount(player, {
          status: info.live ? 'live' : status,
          deliveries: row.deliveries || [],
        }, { compact: true });
      }
      card.appendChild(player);
      host.appendChild(card);
    });
  }

  function loadMe() {
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.whenReady === 'function') {
      return global.PlaigroundMembership.whenReady().then(function (result) {
        return (result && result.data) || null;
      });
    }
    return fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) { return response.json(); })
      .catch(function () { return null; });
  }

  function paintCreateCheck() {
    var api = checkApi();
    var name = $('#artist-create-name') ? $('#artist-create-name').value : '';
    var msg = $('#artist-create-check');
    var yellow = $('#artist-create-yellow');
    var red = $('#artist-create-red');
    if (!api) return { level: 'green' };
    var check = api.checkArtistName(name, { accountArtists: current.artists });
    if (msg) {
      msg.hidden = !name || check.level === 'empty';
      msg.textContent = check.level === 'green' && name
        ? 'No close match. This artist page can be created instantly.'
        : (check.copy || '');
    }
    if (yellow) yellow.hidden = check.level !== 'yellow';
    if (red) red.hidden = check.level !== 'red';
    if (check.level !== 'yellow') {
      var wrap = $('#artist-create-confirm-wrap');
      var box = $('#artist-create-confirm');
      if (wrap) wrap.hidden = true;
      if (box) box.checked = false;
    }
    return check;
  }

  function createArtist(forceReview) {
    var nameEl = $('#artist-create-name');
    var name = nameEl ? String(nameEl.value || '').trim() : '';
    if (!name) {
      showStatus('Artist name is required.');
      return Promise.resolve(null);
    }
    var check = paintCreateCheck();
    var confirmEl = $('#artist-create-confirm');
    var confirmDifferent = Boolean(confirmEl && confirmEl.checked);
    if (check.level === 'yellow' && !confirmDifferent) {
      showStatus((checkApi() && checkApi().YELLOW_COPY) || check.copy);
      return Promise.resolve(null);
    }
    return post('/api/me/artists', {
      action: 'create',
      name: name,
      confirm_different: confirmDifferent || Boolean(forceReview),
    }).then(function (result) {
      if (!result.ok) {
        showStatus((result.data && result.data.error) || 'Could not create artist.');
        return null;
      }
      applyMe(result.data);
      if (result.data && result.data.created) selectArtist(result.data.created);
      if (nameEl) nameEl.value = '';
      paintCreateCheck();
      showStatus(check.level === 'red' || forceReview
        ? 'Held for review. This name was not sent to the store.'
        : 'Artist profile created.');
      return result.data;
    });
  }

  function linkArtist() {
    var urlEl = $('#artist-link-url');
    var nameEl = $('#artist-link-name');
    return post('/api/me/artists', {
      action: 'link',
      url: urlEl ? urlEl.value : '',
      name: nameEl ? nameEl.value : '',
    }).then(function (result) {
      if (!result.ok) {
        showStatus((result.data && result.data.error) || 'Could not link artist.');
        return null;
      }
      applyMe(result.data);
      if (result.data && result.data.created) selectArtist(result.data.created);
      if (urlEl) urlEl.value = '';
      if (nameEl) nameEl.value = '';
      showStatus('Linked artist profile created.');
      return result.data;
    });
  }

  function saveArtist() {
    if (!current.selected) {
      showError('Select an artist first.');
      return Promise.resolve(null);
    }
    showError('');
    var nameEl = $('#artist-name');
    return post('/api/me/artists', {
      action: 'update',
      id: current.selected.id,
      artist_id: current.selected.artist_id || current.selected.id,
      name: nameEl ? nameEl.value : current.selected.name,
      photo: current.photo || '',
      bio: $('#artist-bio') ? $('#artist-bio').value : '',
      genres: selectedGenres(),
      spotify_id: $('#artist-spotify') ? $('#artist-spotify').value : '',
      apple_id: $('#artist-apple') ? $('#artist-apple').value : '',
      store_url: $('#artist-store') ? $('#artist-store').value : '',
      human_contributions: readChecks('data-human-contribution'),
      ai_contributions: readChecks('data-ai-contribution'),
      ai_process_detail: $('#artist-ai-detail') ? $('#artist-ai-detail').value : '',
      ai_involvement_percent: involvementValue(),
      change_request: $('#artist-change') ? $('#artist-change').value : '',
      confirm_different: true,
    }).then(function (result) {
      if (!result.ok) {
        showError((result.data && result.data.error) || 'Could not save artist.');
        return null;
      }
      applyMe(result.data);
      if (result.data && result.data.updated) selectArtist(result.data.updated);
      showStatus('Artist profile saved.');
      return result.data;
    });
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function bind() {
    fillGenreSelect();
    var list = $('[data-artist-list]');
    if (list) {
      list.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest && event.target.closest('[data-artist-id]');
        if (!btn) return;
        var id = btn.getAttribute('data-artist-id');
        var found = null;
        current.artists.forEach(function (row) { if (row.id === id) found = row; });
        selectArtist(found);
      });
    }
    var genreSel = $('#artist-genre');
    if (genreSel) {
      genreSel.addEventListener('change', function () {
        var pick = canonicalGenre(genreSel.value);
        if (!pick) return;
        var values = selectedGenres();
        if (values.indexOf(pick) === -1 && values.length < MAX_GENRES) values.push(pick);
        renderGenrePicks(values);
        genreSel.value = '';
      });
    }
    var picks = $('[data-artist-genre-picks]');
    if (picks) {
      picks.addEventListener('click', function (event) {
        var pill = event.target && event.target.closest && event.target.closest('[data-genre]');
        if (!pill) return;
        var next = selectedGenres().filter(function (name) { return name !== pill.getAttribute('data-genre'); });
        renderGenrePicks(next);
      });
    }
    var photoPick = $('[data-artist-photo-pick]');
    var photoInput = $('#artist-photo');
    if (photoPick && photoInput) {
      photoPick.addEventListener('click', function () { photoInput.click(); });
      photoInput.addEventListener('change', function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file) return;
        readFile(file).then(function (data) {
          if (!PHOTO_RE.test(data)) {
            showError('Photo must be a JPG or PNG.');
            return;
          }
          current.photo = data;
          setPhoto('[data-artist-photo-edit]', data);
        });
      });
    }
    var createName = $('#artist-create-name');
    if (createName) {
      createName.addEventListener('input', paintCreateCheck);
      createName.addEventListener('change', paintCreateCheck);
    }
    var createBtn = $('[data-artist-create]');
    if (createBtn) createBtn.addEventListener('click', function () { createArtist(false); });
    var reviewBtn = $('#artist-create-review');
    if (reviewBtn) reviewBtn.addEventListener('click', function () { createArtist(true); });
    var continueBtn = $('#artist-create-continue');
    if (continueBtn) {
      continueBtn.addEventListener('click', function () {
        var wrap = $('#artist-create-confirm-wrap');
        if (wrap) wrap.hidden = false;
      });
    }
    document.querySelectorAll('[data-artist-goto-link]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = $('#artist-link-panel');
        if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth' });
      });
    });
    var linkBtn = $('[data-artist-link]');
    if (linkBtn) linkBtn.addEventListener('click', function () { linkArtist(); });
    var saveBtn = $('[data-artist-save]');
    if (saveBtn) saveBtn.addEventListener('click', function () { saveArtist(); });
    var range = $('#artist-ai-range');
    var num = $('#artist-ai-percent');
    if (range && num) {
      range.addEventListener('input', function () {
        num.value = range.value;
        paintAiMeter();
      });
      num.addEventListener('input', function () {
        if (String(num.value || '').trim() !== '') range.value = String(Math.max(0, Math.min(100, Number(num.value) || 0)));
        paintAiMeter();
      });
    }
    document.querySelectorAll('[data-human-contribution], [data-ai-contribution]').forEach(function (box) {
      box.addEventListener('change', paintAiMeter);
    });
    var detail = $('#artist-ai-detail');
    if (detail) detail.addEventListener('input', paintAiMeter);

    Promise.all([
      loadMe(),
      fetch('/api/tonegrid/releases', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (response) { return response.json(); })
        .then(function (data) { return (data && data.releases) || []; })
        .catch(function () { return []; }),
    ]).then(function (results) {
      current.catalog = results[1] || [];
      applyMe(results[0]);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  global.PlaigroundArtists = {
    rosterFromMe: rosterFromMe,
    applyMe: applyMe,
    catalogForArtist: catalogForArtist,
    renderSongs: renderSongs,
    selectArtist: selectArtist,
    createArtist: createArtist,
    linkArtist: linkArtist,
    saveArtist: saveArtist,
    paintCreateCheck: paintCreateCheck,
    paintAiFields: paintAiFields,
    involvementValue: involvementValue,
  };
})(typeof window !== 'undefined' ? window : this);
