/**
 * Review and pay thumb: show the cover already picked on Upload.
 * Does not hop. Does not submit. Reads the held file on this device.
 */
(function (root) {
  function hasArt(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains('has-art')) return true;
    var bg = el.style && el.style.backgroundImage;
    return Boolean(bg && bg !== 'none' && bg !== '');
  }

  function paintUrl(el, url) {
    var preview = root.PlaigroundCoverPreview;
    if (preview && typeof preview.paintTile === 'function') {
      preview.paintTile(el, url);
      return;
    }
    if (!el || !el.style) return;
    el.style.backgroundImage = url ? ('url("' + String(url).replace(/"/g, '') + '")') : '';
    el.style.backgroundSize = url ? 'cover' : '';
    el.style.backgroundPosition = url ? 'center' : '';
    if (el.classList && el.classList.toggle) el.classList.toggle('has-art', Boolean(url));
  }

  function paintHeld() {
    var el = root.document && root.document.querySelector('[data-review-cover]');
    if (!el || hasArt(el)) return;
    var files = root.PlaigroundUploadDraftFiles;
    if (!files || typeof files.keepHeldFiles !== 'function') return;
    files.keepHeldFiles(root).then(function (held) {
      var file = held && held.cover;
      if (!file || !el.isConnected) return;
      try {
        paintUrl(el, URL.createObjectURL(file));
      } catch (err) {}
    });
  }

  function start() {
    paintHeld();
    setTimeout(paintHeld, 300);
    setTimeout(paintHeld, 1000);
  }

  if (!root.document) return;
  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(typeof window !== 'undefined' ? window : this);
