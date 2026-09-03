/**
 * Local File/blob cover-art preview.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PlaigroundCoverPreview = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function isCoverFile(file) {
    if (!file) return false;
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    return /\.(jpe?g|png)$/.test(name) || /image\/(jpeg|jpg|png)/.test(type);
  }
  function selectedFile(input) {
    if (!input) return null;
    if (input.files && input.files[0]) return input.files[0];
    if (input._plaigroundFile) return input._plaigroundFile;
    return null;
  }
  function paintTile(tile, url) {
    var art = String(url || '').trim();
    var safe = art.replace(/"/g, '');
    if (!tile) return;
    if (tile.style) {
      tile.style.backgroundImage = art ? ('url("' + safe + '")') : '';
      tile.style.backgroundSize = art ? 'cover' : '';
      tile.style.backgroundPosition = art ? 'center' : '';
      tile.style.backgroundRepeat = art ? 'no-repeat' : '';
      tile.style.backgroundColor = art ? '#111' : '';
    }
    if (tile.classList && tile.classList.toggle) tile.classList.toggle('has-art', Boolean(art));
    var img = tile.querySelector && tile.querySelector('img[data-cover-photo]');
    if (art) {
      if (!img && typeof document !== 'undefined' && document.createElement && tile.appendChild) {
        img = document.createElement('img');
        img.setAttribute('data-cover-photo', '');
        img.alt = '';
        tile.appendChild(img);
      }
      if (img) { img.src = art; img.hidden = false; }
    } else if (img) {
      img.hidden = true;
    }
  }
  function bind(opts) {
    opts = opts || {};
    return { showFile: function () {}, setStored: function (u) { return u; }, clear: function () {}, currentUrl: function () { return ''; }, hasLocal: function () { return false; } };
  }
  return { bind: bind, isCoverFile: isCoverFile, paintTile: paintTile, selectedFile: selectedFile };
});
