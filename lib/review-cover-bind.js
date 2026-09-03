/**
 * Review and pay thumb: show the cover already picked on Upload.
 * Does not hop a new file. Does not submit.
 */
(function (root) {
  var STORE = 'plaiground.store.draft';

  function parse(raw) {
    try {
      return JSON.parse(raw || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function readDraft() {
    var draft = {};
    try {
      if (root.sessionStorage) draft = parse(root.sessionStorage.getItem(STORE));
    } catch (err) {}
    try {
      if (root.localStorage) {
        var local = parse(root.localStorage.getItem(STORE));
        Object.keys(local).forEach(function (key) {
          if (draft[key] == null || draft[key] === '') draft[key] = local[key];
        });
      }
    } catch (err2) {}
    return draft;
  }

  function paintUrl(el, url) {
    if (!el || !url) return false;
    var preview = root.PlaigroundCoverPreview;
    if (preview && typeof preview.paintTile === 'function') {
      preview.paintTile(el, url);
    } else if (el.style) {
      el.style.backgroundImage = 'url("' + String(url).replace(/"/g, '') + '")';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
      if (el.classList && el.classList.add) el.classList.add('has-art');
    }
    var img = el.querySelector && el.querySelector('img[data-cover-photo]');
    if (img) {
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.display = 'block';
    }
    return true;
  }

  function paint() {
    var el = root.document && root.document.querySelector('[data-review-cover]');
    if (!el) return;
    var draft = readDraft();
    var url = String((draft.artwork_url || draft.cover_art_url || draft.cover_url) || '').trim();
    if (/^(https?:|data:image\/|blob:)/i.test(url)) paintUrl(el, url);
    var key = String(draft.artwork_object_key || '').trim();
    var hop = root.PlaigroundObjectHop;
    if (key && hop && typeof hop.previewUrl === 'function') {
      hop.previewUrl(key).then(function (href) {
        if (href) paintUrl(el, href);
      });
    }
    var files = root.PlaigroundUploadDraftFiles;
    if (files && typeof files.keepHeldFiles === 'function') {
      files.keepHeldFiles(root).then(function (held) {
        var file = held && held.cover;
        if (!file) return;
        try {
          paintUrl(el, URL.createObjectURL(file));
        } catch (err) {}
      });
    }
  }

  function start() {
    paint();
    setTimeout(paint, 200);
    setTimeout(paint, 800);
    setTimeout(paint, 1800);
  }

  if (!root.document) return;
  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  if (root.addEventListener) root.addEventListener('load', start);
})(typeof window !== 'undefined' ? window : this);
