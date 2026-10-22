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
      if (global.PlaigroundStagePage && global.PlaigroundStagePage.afterLyrics) {
        global.PlaigroundStagePage.afterLyrics(rows);
      }
      return;
    }
    show(empty, false);
    show(list, true);
    if (list) {
      list.textContent = '';
      rows.forEach(function (song) {
        var doc = global.document;
        var row = doc.createElement('div');
        row.className = 'ly-row';
        row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px';
        var button = doc.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-ghost btn-md';
        var title = song.title || 'Untitled';
        var when = formatWhen(song.saved_at);
        button.textContent = when ? (title + ' · ' + when) : title;
        button.setAttribute('aria-label', 'Open ' + title);
        button.addEventListener('click', function () { showSong(song); });
        var rename = doc.createElement('button');
        rename.type = 'button';
        rename.className = 'btn btn-ghost btn-sm';
        rename.textContent = 'Rename';
        rename.addEventListener('click', function () {
          var next = global.prompt('New title', song.title || '');
          if (next == null || !String(next).trim()) return;
          write({ action: 'rename', id: song.id, title: String(next).trim() }, song.id);
        });
        var del = doc.createElement('button');
        del.type = 'button';
        del.className = 'btn btn-ghost btn-sm';
        del.textContent = 'Delete';
        del.addEventListener('click', function () {
          if (!global.confirm('Delete "' + title + '" from your account? This cannot be undone.')) return;
          write({ action: 'delete', id: song.id }, '');
        });
        row.appendChild(button);
        row.appendChild(rename);
        row.appendChild(del);
        list.appendChild(row);
      });
    }
    if (global.PlaigroundStagePage && global.PlaigroundStagePage.afterLyrics) {
      global.PlaigroundStagePage.afterLyrics(rows);
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

  function write(body, keepId) {
    var status = $('[data-lyrics-status]');
    return global.fetch('/api/me/lyrics', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok && data && data.ok) {
          render(data.songs || [], keepId);
          return;
        }
        if (status) {
          status.hidden = false;
          status.textContent = (data && data.error) || 'That did not go through. Try again in a moment.';
        }
      });
    }).catch(function () {
      if (status) {
        status.hidden = false;
        status.textContent = 'That did not go through. Try again in a moment.';
      }
    });
  }

  function offerImport() {
    var account = global.PlaigroundLyricsAccount;
    var box = $('[data-lyrics-import]');
    if (!box || !account || !account.readLocal) return;
    var local = account.readLocal();
    if (!local.length) { box.hidden = true; return; }
    box.hidden = false;
    var text = $('[data-lyrics-import-text]');
    if (text) text.textContent = 'You have ' + local.length + (local.length === 1 ? ' song' : ' songs') + ' saved on this device. Import ' + (local.length === 1 ? 'it' : 'them') + ' to your account to open ' + (local.length === 1 ? 'it' : 'them') + ' on any device.';
    var go = $('[data-lyrics-import-go]');
    var skip = $('[data-lyrics-import-skip]');
    if (go) go.onclick = function () {
      go.disabled = true;
      go.textContent = 'Importing...';
      account.importLocal().then(function (r) {
        go.disabled = false;
        go.textContent = 'Import to my account';
        if (text) text.textContent = r.failed ? ('Imported ' + r.imported + '. ' + r.failed + ' did not go through. Try again.') : ('Imported ' + r.imported + (r.imported === 1 ? ' song.' : ' songs.'));
        if (!r.failed) global.setTimeout(function () { box.hidden = true; }, 2500);
        load(null);
      });
    };
    if (skip) skip.onclick = function () { box.hidden = true; };
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
      offerImport();
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
