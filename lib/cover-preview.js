/**
 * Local File/blob cover-art preview. Paints the existing cover tile from
 * the file the artist already picked. No extra cloud storage or second upload.
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
    if (!tile) return;
    if (tile.style) {
      tile.style.backgroundImage = art ? ('url("' + art.replace(/"/g, '') + '")') : '';
    }
    if (tile.classList && tile.classList.toggle) {
      tile.classList.toggle('has-art', Boolean(art));
    }
    if (tile.setAttribute) {
      tile.setAttribute('aria-label', art ? 'Cover art' : 'Cover art placeholder');
    }
  }

  function bind(opts) {
    opts = opts || {};
    var input = opts.input;
    var tile = opts.tile;
    var note = opts.note;
    var clearBtn = opts.clearButton;
    var urlApi = opts.URL || (typeof URL !== 'undefined' ? URL : null);
    var win = opts.window || (typeof window !== 'undefined' ? window : null);
    var storedUrl = String(opts.storedUrl || '');
    var emptyNote = opts.emptyNote != null ? String(opts.emptyNote) : 'No cover uploaded';
    var hasNote = opts.hasNote != null ? String(opts.hasNote) : 'Cover art';
    var localUrl = '';
    var hasLocal = false;

    function currentUrl() {
      return hasLocal ? localUrl : storedUrl;
    }

    function syncNote() {
      if (!note) return;
      note.textContent = currentUrl() ? hasNote : emptyNote;
    }

    function syncClear() {
      if (!clearBtn) return;
      clearBtn.hidden = !hasLocal;
    }

    function paint() {
      paintTile(tile, currentUrl());
      syncNote();
      syncClear();
    }

    function revokeLocal() {
      if (localUrl && urlApi && typeof urlApi.revokeObjectURL === 'function') {
        try { urlApi.revokeObjectURL(localUrl); } catch (err) {}
      }
      localUrl = '';
      hasLocal = false;
    }

    function showFile(file) {
      if (typeof opts.accept === 'function' && file && opts.accept(file) === false) return false;
      if (file && !isCoverFile(file)) return false;
      revokeLocal();
      if (!file) {
        paint();
        if (typeof opts.onChange === 'function') opts.onChange(null, currentUrl());
        return true;
      }
      if (!urlApi || typeof urlApi.createObjectURL !== 'function') {
        paint();
        if (typeof opts.onChange === 'function') opts.onChange(file, currentUrl());
        return false;
      }
      localUrl = urlApi.createObjectURL(file);
      hasLocal = true;
      paint();
      if (typeof opts.onChange === 'function') opts.onChange(file, currentUrl());
      return true;
    }

    function setStored(url) {
      storedUrl = String(url || '').trim();
      if (!hasLocal) paint();
      return storedUrl;
    }

    function clear() {
      if (input) {
        try { input.value = ''; } catch (err) {}
        input._plaigroundFile = null;
      }
      revokeLocal();
      paint();
      if (typeof opts.onChange === 'function') opts.onChange(null, currentUrl());
    }

    function onInputChange() {
      showFile(selectedFile(input));
    }

    if (input && input.addEventListener) {
      input.addEventListener('change', onInputChange);
    }
    if (clearBtn && clearBtn.addEventListener) {
      clearBtn.addEventListener('click', function (event) {
        if (event && event.preventDefault) event.preventDefault();
        clear();
      });
    }
    if (win && win.addEventListener) {
      win.addEventListener('pagehide', revokeLocal);
      win.addEventListener('beforeunload', revokeLocal);
    }

    var existing = selectedFile(input);
    if (existing) showFile(existing);
    else paint();

    return {
      showFile: showFile,
      setStored: setStored,
      clear: clear,
      revoke: revokeLocal,
      currentUrl: currentUrl,
      hasLocal: function () { return hasLocal; },
    };
  }

  return {
    bind: bind,
    isCoverFile: isCoverFile,
    paintTile: paintTile,
    selectedFile: selectedFile,
  };
});
