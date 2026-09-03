/**
 * Song details cover for pending hops.
 * Uses leftover artwork_url / artwork_object_key / held file.
 * Does not hop a new upload. Does not change submit.
 */
(function (root) {
  if (!root || !root.document) return;

  function queryId() {
    try {
      return String(new URLSearchParams(root.location.search).get('id') || '').trim();
    } catch (err) {
      return '';
    }
  }

  function parse(raw) {
    try { return JSON.parse(raw || '{}') || {}; } catch (err) { return {}; }
  }

  function readDraft() {
    var draft = {};
    function merge(store, key) {
      if (!store) return;
      try {
        var next = parse(store.getItem(key));
        Object.keys(next).forEach(function (name) {
          if (draft[name] == null) draft[name] = next[name];
        });
      } catch (err) {}
    }
    try { merge(root.sessionStorage, 'plaiground.store.draft'); merge(root.sessionStorage, 'plaiground.tonegrid.draft'); } catch (err) {}
    try { merge(root.localStorage, 'plaiground.store.draft'); merge(root.localStorage, 'plaiground.tonegrid.draft'); } catch (err2) {}
    return draft;
  }

  function idsMatch(a, b) {
    var left = String(a || '').trim().toLowerCase();
    var right = String(b || '').trim().toLowerCase();
    return Boolean(left && right && left === right);
  }

  function rowFromMe(me) {
    var want = queryId();
    var list = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      var row = list[i] || {};
      var id = row.tonegrid_release_id || row.id || row.uuid;
      if (idsMatch(id, want)) return row;
    }
    return null;
  }

  function hasArt(tile) {
    if (!tile) return false;
    if (tile.classList && tile.classList.contains('has-art')) return true;
    var img = tile.querySelector && tile.querySelector('img');
    if (img && img.src) return true;
    var bg = tile.style && tile.style.backgroundImage;
    return Boolean(bg && bg !== 'none' && bg !== '');
  }

  function paint(tile, url) {
    if (!tile || !url) return;
    var preview = root.PlaigroundCoverPreview;
    if (preview && typeof preview.paintTile === 'function') preview.paintTile(tile, url);
    if (tile.style) {
      tile.style.background = '#111 center / cover no-repeat url("' + String(url).replace(/"/g, '') + '")';
    }
    if (tile.classList && tile.classList.add) tile.classList.add('has-art');
    var note = root.document.querySelector('[data-song-cover-note]');
    if (note) note.textContent = 'Cover art';
  }

  function coverFrom(row) {
    var urls = root.PlaigroundCoverUrl;
    if (urls && typeof urls.from === 'function') {
      var found = urls.from(row);
      if (found) return found;
    }
    if (!row || typeof row !== 'object') return '';
    return String(row.artwork_url || row.cover_art_url || row.cover_url || '').trim();
  }

  function keyFrom(row) {
    var urls = root.PlaigroundCoverUrl;
    if (urls && typeof urls.objectKey === 'function') {
      var key = urls.objectKey(row);
      if (key) return key;
    }
    return String((row && (row.artwork_object_key || row.cover_object_key)) || '').trim();
  }

  function paintSoon() {
    var tile = root.document.querySelector('[data-song-cover]');
    if (!tile || hasArt(tile)) return;
    var draft = readDraft();
    var url = coverFrom(draft);
    if (url) paint(tile, url);
    var key = keyFrom(draft);
    var hop = root.PlaigroundObjectHop;
    if (!url && key && hop && typeof hop.previewUrl === 'function') {
      hop.previewUrl(key).then(function (href) { if (href) paint(tile, href); });
    }
    var files = root.PlaigroundUploadDraftFiles;
    if (files && typeof files.keepHeldFiles === 'function') {
      files.keepHeldFiles(root).then(function (held) {
        if (held && held.cover && typeof URL !== 'undefined' && URL.createObjectURL) {
          paint(tile, URL.createObjectURL(held.cover));
        }
      });
    }
    fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (me) {
        var row = rowFromMe(me);
        if (!row || hasArt(tile)) return;
        var next = coverFrom(row);
        if (next) paint(tile, next);
        var rowKey = keyFrom(row);
        if (!next && rowKey && hop && typeof hop.previewUrl === 'function') {
          hop.previewUrl(rowKey).then(function (href) { if (href) paint(tile, href); });
        }
      })
      .catch(function () {});
  }

  function start() {
    paintSoon();
    setTimeout(paintSoon, 400);
    setTimeout(paintSoon, 1400);
    var song = root.PlaigroundSong;
    if (song && typeof song.render === 'function' && !song.render.__coverBound) {
      var orig = song.render;
      song.render = function (opts) {
        var result = orig.apply(this, arguments);
        setTimeout(paintSoon, 0);
        return result;
      };
      song.render.__coverBound = true;
    }
  }

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  if (root.addEventListener) root.addEventListener('load', start);
})(typeof window !== 'undefined' ? window : this);
