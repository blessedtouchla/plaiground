/**
 * Pending leftover covers already hopped locally. Attach that same
 * object_key to store /artwork and paint matching Overview tiles.
 * Song detail [data-song-cover] is painted only when the leftover
 * draft release id matches the page ?id=. Does not create a release.
 * Does not rewrite submit. Does not POST leftover art onto another song.
 */
(function (root) {
  if (!root || !root.document) return;

  function parse(raw) {
    try { return raw ? JSON.parse(raw) : {}; } catch (err) { return {}; }
  }

  function draftOf() {
    return Object.assign(
      {},
      parse(root.localStorage && root.localStorage.getItem('plaiground.tonegrid.draft')),
      parse(root.sessionStorage && root.sessionStorage.getItem('plaiground.tonegrid.draft')),
      parse(root.localStorage && root.localStorage.getItem('plaiground.store.draft')),
      parse(root.sessionStorage && root.sessionStorage.getItem('plaiground.store.draft'))
    );
  }

  function draftReleaseId(draft) {
    return String((draft && (draft.release_id || draft.tonegrid_release_id)) || '').trim().toLowerCase();
  }

  function pageReleaseId() {
    try {
      var search = String((root.location && root.location.search) || '');
      return String(new URLSearchParams(search).get('id') || '').trim().toLowerCase();
    } catch (err) {
      return '';
    }
  }

  function sameReleaseId(a, b) {
    var left = String(a || '').trim().toLowerCase();
    var right = String(b || '').trim().toLowerCase();
    return Boolean(left && right && left === right);
  }

  function isSeasonOfLove(id) {
    var n = String(id || '').trim().toLowerCase().replace(/-/g, '');
    return n.indexOf('40cec4ed') === 0;
  }

  function sentKey(id, key) {
    return 'plaiground.art-sent.' + String(id || '') + '.' + String(key || '');
  }

  function alreadySent(id, key) {
    try {
      return Boolean(root.sessionStorage && root.sessionStorage.getItem(sentKey(id, key)));
    } catch (err) {
      return false;
    }
  }

  function markSent(id, key) {
    try {
      if (root.sessionStorage) root.sessionStorage.setItem(sentKey(id, key), '1');
    } catch (err) {}
  }

  function leftoverTargetsPage(draft) {
    var wantId = draftReleaseId(draft);
    var pageId = pageReleaseId();
    if (!pageId) return true;
    return sameReleaseId(wantId, pageId);
  }

  function matchesSongPage(draft) {
    return sameReleaseId(draftReleaseId(draft), pageReleaseId());
  }

  function sendLeftoverArt() {
    var draft = draftOf();
    var id = String(draft.release_id || draft.tonegrid_release_id || '').trim();
    var key = String(draft.artwork_object_key || draft.cover_object_key || '').trim();
    if (!id || !key || alreadySent(id, key)) return;
    if (isSeasonOfLove(id) || isSeasonOfLove(pageReleaseId())) return;
    if (!leftoverTargetsPage(draft)) return;
    if (typeof root.fetch !== 'function') return;
    root.fetch('/api/tonegrid/releases/' + encodeURIComponent(id) + '/artwork', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ object_key: key }),
    }).then(function (res) {
      if (res && res.ok) markSent(id, key);
    }, function () {});
  }

  function paintTile(el, url) {
    if (!el || !url) return;
    var api = root.PlaigroundCoverPreview;
    if (api && typeof api.paintTile === 'function') {
      api.paintTile(el, url);
      return;
    }
    if (el.style) {
      el.style.backgroundImage = 'url("' + String(url).replace(/"/g, '') + '")';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    }
    if (el.classList && el.classList.add) el.classList.add('has-art');
  }

  function matchesDraft(el, draft) {
    if (!el || !draft) return false;
    if (el.getAttribute && el.getAttribute('data-song-cover') != null) {
      return matchesSongPage(draft);
    }
    var link = el.closest ? el.closest('a') : el.parentNode;
    var href = String((link && link.getAttribute && link.getAttribute('href')) || '').toLowerCase();
    var titleEl = link && link.querySelector ? link.querySelector('strong') : null;
    var title = String((titleEl && titleEl.textContent) || '').trim().toLowerCase();
    var wantId = draftReleaseId(draft);
    var wantTitle = String(draft.title || '').trim().toLowerCase();
    if (wantId && href.indexOf(encodeURIComponent(wantId).toLowerCase()) !== -1) return true;
    if (wantTitle && title === wantTitle) return true;
    return false;
  }

  function paintOverview() {
    var tiles = root.document.querySelectorAll('[data-release-tiles] .release-tile-art, [data-song-cover]');
    if (!tiles.length) return;
    var draft = draftOf();
    var stored = String((draft.artwork_url || draft.cover_art_url || draft.cover_url) || '').trim();
    var key = String(draft.artwork_object_key || draft.cover_object_key || '').trim();
    var hop = root.PlaigroundObjectHop;
    var files = root.PlaigroundUploadDraftFiles;
    Array.prototype.forEach.call(tiles, function (el) {
      if (!matchesDraft(el, draft)) return;
      if (/^(https?:|data:image\/|blob:)/i.test(stored)) paintTile(el, stored);
      if (key && hop && typeof hop.previewUrl === 'function') {
        hop.previewUrl(key).then(function (href) {
          if (!matchesDraft(el, draftOf())) return;
          if (href) paintTile(el, href);
        }, function () {});
      }
    });
    if (files && typeof files.keepHeldFiles === 'function') {
      files.keepHeldFiles(root).then(function (held) {
        if (!(held && held.cover)) return;
        try {
          var href = URL.createObjectURL(held.cover);
          var live = draftOf();
          Array.prototype.forEach.call(tiles, function (el) {
            if (!matchesDraft(el, live)) return;
            paintTile(el, href);
          });
        } catch (err) {}
      });
    }
  }

  function wrapSubmit() {
    var api = root.PlaigroundSong;
    if (!api || typeof api.submitEdit !== 'function' || api.submitEdit._leftoverArt) return;
    var orig = api.submitEdit;
    function wrapped() {
      return Promise.resolve(orig.apply(api, arguments)).then(function (result) {
        sendLeftoverArt();
        return result;
      }, function (err) {
        sendLeftoverArt();
        throw err;
      });
    }
    wrapped._leftoverArt = true;
    api.submitEdit = wrapped;
  }

  function start() {
    wrapSubmit();
    sendLeftoverArt();
    paintOverview();
    setTimeout(paintOverview, 400);
    setTimeout(paintOverview, 1400);
    setTimeout(sendLeftoverArt, 800);
  }

  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
  else start();
  if (root.addEventListener) root.addEventListener('load', start);
})(typeof window !== 'undefined' ? window : this);
