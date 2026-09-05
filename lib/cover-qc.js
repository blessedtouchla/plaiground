(function (root) {
  var MIN = 3000;
  var MAX = 5000;
  var TARGET = 3000;
  var MAX_BYTES = 10 * 1024 * 1024;
  var TYPE_COPY = 'Cover must be a JPG or PNG.';
  var SQUARE_COPY = 'Cover must be a square.';
  var SIZE_COPY = 'Cover must be 3000 \u00d7 3000 px to 5000 \u00d7 5000 px.';
  var HEAVY_COPY = 'Cover must be 10 MB or smaller.';
  var RESIZE_COPY = 'Could not resize the cover.';

  function noteEl() {
    if (!root.document) return null;
    return root.document.querySelector('[data-art-meta]')
      || root.document.querySelector('[data-edit-why="artwork"]')
      || root.document.querySelector('[data-song-cover-note]');
  }

  function showError(message) {
    var note = noteEl();
    if (!note) return;
    note.hidden = false;
    if (note.removeAttribute) note.removeAttribute('hidden');
    note.textContent = message;
    if (note.classList && note.classList.add) note.classList.add('is-error');
  }

  function showOk() {
    var note = noteEl();
    if (!note) return;
    note.hidden = false;
    note.textContent = 'Cover ready \u00b7 3000 \u00d7 3000 px \u00b7 JPG or PNG';
    if (note.classList && note.classList.remove) note.classList.remove('is-error');
  }

  function isTypeOk(file) {
    if (!file) return false;
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    return /\.(jpe?g|png)$/.test(name) || /image\/(jpeg|jpg|png)/.test(type);
  }

  function canResize(file, result) {
    if (!file || !isTypeOk(file)) return false;
    var err = String((result && result.error) || '');
    return err === SQUARE_COPY || err === SIZE_COPY || err === HEAVY_COPY;
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !isTypeOk(file)) {
        reject(new Error(TYPE_COPY));
        return;
      }
      var url = root.URL && root.URL.createObjectURL ? root.URL.createObjectURL(file) : '';
      var img = new Image();
      img.onload = function () {
        if (url && root.URL && root.URL.revokeObjectURL) root.URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        if (url && root.URL && root.URL.revokeObjectURL) root.URL.revokeObjectURL(url);
        reject(new Error(TYPE_COPY));
      };
      img.src = url;
    });
  }

  function readSize(file) {
    return loadImage(file).then(function (img) {
      return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
    });
  }

  function check(file) {
    return readSize(file).then(function (size) {
      var w = Number(size.width) || 0;
      var h = Number(size.height) || 0;
      if (!w || !h) return { ok: false, error: TYPE_COPY };
      if (w !== h) return { ok: false, error: SQUARE_COPY };
      if (w < MIN || w > MAX) return { ok: false, error: SIZE_COPY };
      if (Number(file.size) > MAX_BYTES) return { ok: false, error: HEAVY_COPY };
      return { ok: true, width: w, height: h };
    }).catch(function (err) {
      return { ok: false, error: (err && err.message) || TYPE_COPY };
    });
  }

  function resize(file) {
    return loadImage(file).then(function (img) {
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      if (!w || !h) throw new Error(RESIZE_COPY);
      var side = Math.min(w, h);
      var sx = Math.floor((w - side) / 2);
      var sy = Math.floor((h - side) / 2);
      var canvas = root.document.createElement('canvas');
      canvas.width = TARGET;
      canvas.height = TARGET;
      var ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(RESIZE_COPY);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET, TARGET);
      return new Promise(function (resolve, reject) {
        if (typeof canvas.toBlob !== 'function') {
          reject(new Error(RESIZE_COPY));
          return;
        }
        canvas.toBlob(function (blob) {
          if (!blob) {
            reject(new Error(RESIZE_COPY));
            return;
          }
          var base = String(file.name || 'cover').replace(/\.[^.]+$/, '');
          var out;
          try {
            out = new File([blob], base + '-3000.jpg', { type: 'image/jpeg' });
          } catch (err) {
            out = blob;
            out.name = base + '-3000.jpg';
          }
          resolve(out);
        }, 'image/jpeg', 0.92);
      });
    });
  }

  root.PlaigroundCoverQc = {
    MIN: MIN,
    MAX: MAX,
    TARGET: TARGET,
    check: check,
    resize: resize,
    canResize: canResize,
    isTypeOk: isTypeOk,
    showError: showError,
    showOk: showOk,
    TYPE_COPY: TYPE_COPY,
    SQUARE_COPY: SQUARE_COPY,
    SIZE_COPY: SIZE_COPY,
    HEAVY_COPY: HEAVY_COPY,
    RESIZE_COPY: RESIZE_COPY,
  };
})(typeof window !== 'undefined' ? window : this);
