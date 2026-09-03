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
    if (/\.(jpe?g|png)$/.test(name) || /image\/(jpeg|jpg|png)/.test(type)) return true;
    if (file && file.size && type.indexOf('audio/') !== 0 && !/\.wav$/i.test(name)) return true;
    return false;
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
    if (tile.classList && tile.classList.toggle) {
      tile.classList.toggle('has-art', Boolean(art));
    }
    if (tile.setAttribute) {
      tile.setAttribute('aria-label', art ? 'Cover art' : 'Cover art placeholder');
    }
    var img = tile.querySelector ? tile.querySelector('img[data-cover-photo]') : null;
    if (art) {
      if (!img && typeof document !== 'undefined' && document.createElement && tile.appendChild) {
        img = document.createElement('img');
        img.setAttribute('data-cover-photo', '');
        img.alt = '';
        tile.appendChild(img);
      }
      if (img) {
        img.src = art;
        img.hidden = false;
        if (img.removeAttribute) img.removeAttribute('hidden');
        img.style.position = 'absolute';
        img.style.inset = '0';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.display = 'block';
        img.style.border = '0';
      }
    } else if (img) {
      img.hidden = true;
      if (img.removeAttribute) img.removeAttribute('src');
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

    function stickFile(file) {
      if (!input) return;
      if (!file) {
        input._plaigroundFile = null;
        return;
      }
      input._plaigroundFile = file;
      try {
        var Transfer = (opts.DataTransfer || (typeof DataTransfer !== 'undefined' ? DataTransfer : null));
        if (Transfer) {
          var dt = new Transfer();
          if (dt.items && dt.items.add) dt.items.add(file);
          if (dt.files) input.files = dt.files;
        }
      } catch (err) {}
    }

    function showFile(file) {
      if (typeof opts.accept === 'function' && file && opts.accept(file) === false) return false;
      if (file && !isCoverFile(file)) return false;
      revokeLocal();
      stickFile(file || null);
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
      if (input && input.files && input.files[0]) {
        showFile(input.files[0]);
        return;
      }
      if (input) input._plaigroundFile = null;
      showFile(null);
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
      win.addEventListener('pageshow', function () {
        var stuck = selectedFile(input);
        if (stuck) showFile(stuck);
      });
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

  function paintReviewCover() {
    if (typeof document === 'undefined' || !document.querySelector) return;
    var tile = document.querySelector('[data-review-cover]');
    if (!tile) return;
    var win = typeof window !== 'undefined' ? window : null;
    var files = win && win.PlaigroundUploadDraftFiles;
    var hop = win && win.PlaigroundObjectHop;
    var draft = {};
    try {
      var raw = (win && win.sessionStorage && win.sessionStorage.getItem('plaiground.store.draft'))
        || (win && win.localStorage && win.localStorage.getItem('plaiground.store.draft'))
        || '{}';
      draft = JSON.parse(raw || '{}') || {};
    } catch (err) {
      draft = {};
    }
    var stored = String((draft && (draft.artwork_url || draft.cover_art_url || draft.cover_url)) || '').trim();
    if (/^(https?:|data:image\/|blob:)/i.test(stored)) paintTile(tile, stored);
    if (hop && draft.artwork_object_key && typeof hop.previewUrl === 'function') {
      hop.previewUrl(draft.artwork_object_key).then(function (href) {
        if (href) paintTile(tile, href);
      }, function () {});
    }
    if (files && typeof files.keepHeldFiles === 'function') {
      files.keepHeldFiles(win).then(function (held) {
        if (!(held && held.cover)) return;
        try { paintTile(tile, URL.createObjectURL(held.cover)); } catch (err2) {}
      });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintReviewCover);
    else paintReviewCover();
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('load', paintReviewCover);
    }
    setTimeout(paintReviewCover, 300);
    setTimeout(paintReviewCover, 1200);
  }

  return {
    bind: bind,
    isCoverFile: isCoverFile,
    paintTile: paintTile,
    paintReviewCover: paintReviewCover,
    selectedFile: selectedFile,
  };
});
