(function (global) {
  function $(sel) {
    return global.document ? global.document.querySelector(sel) : null;
  }

  function show(el, on) {
    if (!el) return;
    el.hidden = !on;
  }

  function formatWhen(value) {
    if (!value) return '';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  function selectedId() {
    try {
      return new URLSearchParams(global.location.search).get('id') || '';
    } catch (err) {
      return '';
    }
  }

  function render(songs, preferId) {
    var status = $('[data-lyrics-status]');
    var empty = $('[data-lyrics-empty]');
    var list = $('[data-lyrics-list]');
    var view = $('[data-lyrics-view]');
    if (status) status.hidden = true;
    var rows = Array.isArray(songs) ? songs : [];
    if (!rows.length) {
      show(empty, true);
      show(list, false);
      show(view, false);
      return;
    }
    show(empty, false);
    show(list, true);
    if (list) {
      list.textContent = '';
      rows.forEach(function (song) {
        var button = global.document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-ghost btn-md';
        button.style.display = 'block';
        button.style.marginTop = '8px';
        var title = song.title || 'Untitled';
        var when = formatWhen(song.saved_at);
        button.textContent = when ? (title + ' · ' + when) : title;
        button.addEventListener('click', function () { showSong(song); });
        list.appendChild(button);
      });
    }
    var pick = null;
    rows.forEach(function (song) {
      if (!pick && preferId && song.id === preferId) pick = song;
    });
    showSong(pick || rows[0]);
  }

  function showSong(song) {
    var view = $('[data-lyrics-view]');
    var title = $('[data-lyrics-title]');
    var meta = $('[data-lyrics-meta]');
    var text = $('[data-lyrics-text]');
    if (!song) {
      show(view, false);
      return;
    }
    show(view, true);
    if (title) title.textContent = song.title || 'Untitled';
    if (meta) {
      var bits = [];
      if (song.mode) bits.push(song.mode);
      if (song.mood) bits.push(song.mood);
      if (song.sparkTitle) bits.push(song.sparkTitle);
      if (song.saved_at) bits.push('Saved ' + formatWhen(song.saved_at));
      meta.textContent = bits.join(' · ');
    }
    if (text) text.textContent = song.text || '';
  }

  function load(claimed) {
    var claimedId = claimed && claimed.song && claimed.song.id ? claimed.song.id : '';
    return global.fetch('/api/me/lyrics', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data || {} };
      }).catch(function () {
        return { ok: false, data: {} };
      });
    }).then(function (result) {
      if (!result.ok) {
        var status = $('[data-lyrics-status]');
        if (status) {
          status.hidden = false;
          status.textContent = (result.data && result.data.error) || 'Your songs did not load. Try again in a moment.';
        }
        return;
      }
      render(result.data.songs || [], selectedId() || claimedId);
      var pending = global.PlaigroundLyricsAccount && global.PlaigroundLyricsAccount.readPending
        ? global.PlaigroundLyricsAccount.readPending()
        : null;
      var note = $('[data-lyrics-pending]');
      if (note) {
        note.hidden = !pending;
        note.textContent = pending
          ? 'This song is still on this device. The account save did not go through yet.'
          : '';
      }
    }).catch(function () {
      var status = $('[data-lyrics-status]');
      if (status) {
        status.hidden = false;
        status.textContent = 'Your songs did not load. Try again in a moment.';
      }
    });
  }

  function boot() {
    var account = global.PlaigroundLyricsAccount;
    var claim = account && account.claim ? account.claim() : Promise.resolve(null);
    claim.then(load, function () { load(null); });
  }

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
