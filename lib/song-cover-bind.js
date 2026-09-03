/**
 * Releases / song page: paint cover already hopped or held.
 * Does not submit. Does not rewrite hop.
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

  function paint(el, url) {
    if (!el || !url) return;
    var api = root.PlaigroundCoverPreview;
    if (api && typeof api.paintTile === 'function') api.paintTile(el, url);
    else if (el.style) {
      el.style.backgroundImage = 'url("' + String(url).replace(/"/g, '') + '")';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    }
    var note = root.document.querySelector('[data-song-cover-note]');
    if (note) note.textContent = 'Cover art';
  }

  function hasArt(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains('has-art')) return true;
    var img = el.querySelector && el.querySelector('img[data-cover-photo]');
    return Boolean(img && img.src);
  }

  function fill() {
    var el = root.document.querySelector('[data-song-cover]');
    if (!el) return;
    var draft = draftOf();
    var url = '';
    if (root.PlaigroundCoverUrl && typeof root.PlaigroundCoverUrl.from === 'function') {
      url = root.PlaigroundCoverUrl.from(draft) || '';
    }
    if (!url) {
      url = String((draft.artwork_url || draft.cover_url || draft.cover_art_url) || '').trim();
    }
    if (/^(https?:|blob:|data:image\/)/i.test(url)) paint(el, url);
    var key = String((draft.artwork_object_key || draft.cover_object_key) || '').trim();
    if (root.PlaigroundCoverUrl && typeof root.PlaigroundCoverUrl.objectKey === 'function') {
      key = root.PlaigroundCoverUrl.objectKey(draft) || key;
    }
    var hop = root.PlaigroundObjectHop;
    if (key && hop && typeof hop.previewUrl === 'function') {
      hop.previewUrl(key).then(function (href) {
        if (href) paint(el, href);
      });
    }
    var files = root.PlaigroundUploadDraftFiles;
    if (!files || typeof files.keepHeldFiles !== 'function') return;
    files.keepHeldFiles(root).then(function (held) {
      if (held && held.cover) {
        try { paint(el, URL.createObjectURL(held.cover)); } catch (err) {}
      }
    });
  }

  function start() {
    fill();
    setTimeout(fill, 400);
    setTimeout(fill, 1200);
    setTimeout(fill, 2400);
  }

  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
  else start();
  if (root.addEventListener) root.addEventListener('load', start);
})(typeof window !== 'undefined' ? window : this);
