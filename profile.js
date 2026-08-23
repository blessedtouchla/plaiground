(function (global) {
  var MAX_GENRES = 5;
  var PHOTO_RE = /^data:image\/(jpeg|jpg|png);base64,/i;

  function $(sel) {
    if (sel && sel.charAt(0) === '#' && document.getElementById) {
      var byId = document.getElementById(sel.slice(1));
      if (byId) return byId;
    }
    return document.querySelector(sel);
  }

  function $all(sel) {
    return document.querySelectorAll(sel);
  }

  function setText(sel, text) {
    var el = $(sel);
    if (el) el.textContent = text == null ? '' : String(text);
  }

  function setHidden(sel, hidden) {
    var el = $(sel);
    if (!el) return;
    el.hidden = Boolean(hidden);
    if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
  }

  function catalog() {
    return global.PlaigroundUploadCatalog || { GENRES: [], HUMAN_TAGS: [] };
  }

  function humanTags() {
    var list = catalog().HUMAN_TAGS;
    return Array.isArray(list) && list.length ? list.slice() : [
      'Original lyrics',
      'Lead vocals performed',
      'Backing vocals',
      'Played an instrument',
      'Melody written',
      'Arrangement',
      'Prompt authorship',
      'Mixed by a person',
      'Mastered by a person',
    ];
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

  function emptyProfile() {
    return { photo: '', genres: [], specialties: [] };
  }

  function readProfile(me) {
    var raw = (me && me.profile && typeof me.profile === 'object') ? me.profile : {};
    var genres = [];
    (Array.isArray(raw.genres) ? raw.genres : []).forEach(function (name) {
      var pick = canonicalGenre(name);
      if (pick && genres.indexOf(pick) === -1) genres.push(pick);
    });
    var specialties = [];
    var tags = humanTags();
    (Array.isArray(raw.specialties) ? raw.specialties : []).forEach(function (name) {
      var want = String(name || '').trim();
      if (tags.indexOf(want) !== -1 && specialties.indexOf(want) === -1) specialties.push(want);
    });
    var photo = String(raw.photo || '').trim();
    if (photo && !PHOTO_RE.test(photo)) photo = '';
    return {
      artist: String((me && me.artist) || '').trim(),
      photo: photo,
      genres: genres,
      specialties: specialties,
    };
  }

  function setPhoto(sel, url) {
    var el = $(sel);
    if (!el) return;
    var art = String(url || '').trim();
    if (el.style) el.style.backgroundImage = art ? ('url("' + art.replace(/"/g, '') + '")') : '';
    if (el.classList && el.classList.toggle) el.classList.toggle('has-art', Boolean(art));
  }

  function renderPills(hostSel, values, emptySel) {
    var host = $(hostSel);
    if (!host) return;
    host.textContent = '';
    (values || []).forEach(function (name) {
      var pill = document.createElement('span');
      pill.className = 'tag on';
      pill.textContent = name;
      host.appendChild(pill);
    });
    setHidden(emptySel, values && values.length);
  }

  function render(state) {
    state = state || { artist: '', photo: '', genres: [], specialties: [] };
    var artist = String(state.artist || '').trim();
    setText('[data-profile-name]', artist || 'Artist name');
    setPhoto('[data-profile-photo]', state.photo);
    setPhoto('[data-profile-photo-edit]', state.photo);
    setText('[data-profile-photo-note]', state.photo ? 'Photo' : 'No photo yet');
    var filled = Boolean(artist || state.photo || (state.genres && state.genres.length) || (state.specialties && state.specialties.length));
    setHidden('[data-profile-empty]', filled);
    renderPills('[data-profile-genres]', state.genres, '[data-profile-genres-empty]');
    renderPills('[data-profile-specialties]', state.specialties, '[data-profile-specialties-empty]');
    var nameEl = $('#profile-artist');
    if (nameEl) nameEl.value = artist;
    renderGenrePicks(state.genres || []);
    markSpecialtyPicks(state.specialties || []);
    var pickBtn = $('[data-profile-photo-pick]');
    if (pickBtn) pickBtn.textContent = state.photo ? 'Change photo' : 'Add photo';
  }

  function renderGenrePicks(values) {
    var host = $('[data-profile-genre-picks]');
    if (!host) return;
    host.textContent = '';
    (values || []).forEach(function (name) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag on';
      btn.setAttribute('data-genre-pick', name);
      btn.textContent = name;
      btn.addEventListener('click', function () {
        current.genres = current.genres.filter(function (row) { return row !== name; });
        render(current);
      });
      host.appendChild(btn);
    });
  }

  function markSpecialtyPicks(values) {
    var picked = {};
    (values || []).forEach(function (name) { picked[name] = true; });
    $all('[data-profile-specialty-picks] [data-human-tag]').forEach(function (el) {
      var name = String(el.getAttribute('data-human-tag') || el.textContent || '').trim();
      if (el.classList && el.classList.toggle) el.classList.toggle('on', Boolean(picked[name]));
    });
  }

  function fillSpecialtyButtons() {
    var host = $('[data-profile-specialty-picks]');
    if (!host) return;
    host.textContent = '';
    humanTags().forEach(function (name) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag';
      btn.setAttribute('data-human-tag', name);
      btn.textContent = name;
      btn.addEventListener('click', function () {
        var next = current.specialties.slice();
        var idx = next.indexOf(name);
        if (idx === -1) next.push(name);
        else next.splice(idx, 1);
        current.specialties = next;
        markSpecialtyPicks(next);
      });
      host.appendChild(btn);
    });
  }

  function addGenre(name) {
    var pick = canonicalGenre(name);
    if (!pick) return '';
    if (current.genres.indexOf(pick) !== -1) return pick;
    if (current.genres.length >= MAX_GENRES) {
      setStatus('Pick up to 5 genres.', true);
      return '';
    }
    current.genres = current.genres.concat([pick]);
    renderGenrePicks(current.genres);
    setStatus('', false);
    return pick;
  }

  var current = emptyProfile();
  current.artist = '';

  function setStatus(text, isError) {
    setText('[data-profile-status]', text || '');
    setHidden('[data-profile-status]', !text);
    setText('[data-profile-error]', text || '');
    setHidden('[data-profile-error]', !isError || !text);
  }

  function loadMe() {
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.whenReady === 'function') {
      return global.PlaigroundMembership.whenReady().then(function (result) {
        if (result && result.ok && result.data && !result.data.pending) return result.data;
        if (global.PlaigroundMembership.account) return global.PlaigroundMembership.account();
        return null;
      });
    }
    return fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (response) {
      return response.json().then(function (body) {
        return response.ok ? body : null;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  }

  function readPhotoFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        resolve('');
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that photo.')); };
      reader.onload = function () {
        var src = String(reader.result || '');
        if (!PHOTO_RE.test(src) && !/^data:image\//i.test(src)) {
          reject(new Error('Photo must be a JPG or PNG.'));
          return;
        }
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          var size = 512;
          var scale = Math.min(size / Math.max(img.width, 1), size / Math.max(img.height, 1), 1);
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          var ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(src);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var out = canvas.toDataURL('image/jpeg', 0.8);
          if (out.length > 180000) out = canvas.toDataURL('image/jpeg', 0.6);
          resolve(out);
        };
        img.onerror = function () { reject(new Error('Photo must be a JPG or PNG.')); };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  }

  function saveProfile() {
    var artist = $('#profile-artist') ? String($('#profile-artist').value || '').trim() : '';
    current.artist = artist;
    var btn = $('[data-profile-save]');
    if (btn && btn.setAttribute) btn.setAttribute('aria-busy', 'true');
    setStatus('Saving profile…', false);
    return fetch('/api/me/profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artist: artist,
        profile: {
          photo: current.photo || '',
          genres: current.genres || [],
          specialties: current.specialties || [],
        },
      }),
    }).then(function (response) {
      return response.json().then(function (body) {
        return { ok: response.ok, status: response.status, data: body || {} };
      }).catch(function () {
        return { ok: false, status: response.status, data: { error: 'Could not save profile.' } };
      });
    }).then(function (result) {
      if (btn && btn.removeAttribute) btn.removeAttribute('aria-busy');
      if (result.status === 401) {
        setStatus('Sign in to save this profile. Viewing stays open.', true);
        return result;
      }
      if (!result.ok) {
        setStatus((result.data && result.data.error) || 'Could not save profile.', true);
        return result;
      }
      current = readProfile(result.data);
      render(current);
      if (global.PlaigroundAccount && typeof global.PlaigroundAccount.fill === 'function') {
        global.PlaigroundAccount.fill(result.data);
      }
      setStatus('Saved on this account.', false);
      return result;
    }).catch(function () {
      if (btn && btn.removeAttribute) btn.removeAttribute('aria-busy');
      setStatus('Could not save profile.', true);
      return { ok: false };
    });
  }

  function bind() {
    fillSpecialtyButtons();
    var genre = $('#profile-genre');
    if (genre && genre.addEventListener) {
      genre.addEventListener('change', function () {
        if (!genre.value) return;
        addGenre(genre.value);
        genre.value = '';
        var typed = $('#profile-genre-type');
        if (typed) typed.value = '';
      });
    }
    var pick = $('[data-profile-photo-pick]');
    var input = $('#profile-photo');
    if (pick && input && pick.addEventListener) {
      pick.addEventListener('click', function () { input.click(); });
    }
    if (input && input.addEventListener) {
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        readPhotoFile(file).then(function (photo) {
          current.photo = photo;
          setPhoto('[data-profile-photo]', photo);
          setPhoto('[data-profile-photo-edit]', photo);
          setText('[data-profile-photo-note]', photo ? 'Photo' : 'No photo yet');
          if (pick) pick.textContent = photo ? 'Change photo' : 'Add photo';
        }).catch(function (err) {
          setStatus((err && err.message) || 'Photo must be a JPG or PNG.', true);
        });
      });
    }
    var save = $('[data-profile-save]');
    if (save && save.addEventListener) save.addEventListener('click', function () { saveProfile(); });
  }

  function load() {
    if (!$('[data-profile-name]')) return Promise.resolve(null);
    bind();
    render(current);
    return loadMe().then(function (me) {
      var owner = Boolean(me && (me.email || me.artist || me.plan));
      setHidden('[data-profile-edit]', !owner);
      if (!me) {
        setStatus('', false);
        return null;
      }
      current = readProfile(me);
      render(current);
      return me;
    });
  }

  global.PlaigroundProfile = {
    readProfile: readProfile,
    addGenre: addGenre,
    canonicalGenre: canonicalGenre,
    saveProfile: saveProfile,
    render: render,
    load: load,
  };
  load();
})(window);
