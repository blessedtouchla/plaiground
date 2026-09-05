(function (root) {
  var MIN = 3000;
  var MAX = 5000;
  var MAX_BYTES = 10 * 1024 * 1024;
  var TYPE_COPY = 'Cover must be a JPG or PNG.';
  var SQUARE_COPY = 'Cover must be a square.';
  var SIZE_COPY = 'Cover must be 3000 \u00d7 3000 px to 5000 \u00d7 5000 px.';
  var HEAVY_COPY = 'Cover must be 10 MB or smaller.';

  function noteEl() {
    return root.document && root.document.querySelector('[data-art-meta]');
  }

  function showError(message) {
    var note = noteEl();
    if (!note) return;
    note.textContent = message;
    note.hidden = false;
    if (note.classList && note.classList.add) note.classList.add('is-error');
  }

  function showOk() {
    var note = noteEl();
    if (!note) return;
    note.textContent = 'Cover ready \u00b7 3000 \u00d7 3000 px \u00b7 JPG or PNG';
    if (note.classList && note.classList.remove) note.classList.remove('is-error');
  }

  function isTypeOk(file) {
    if (!file) return false;
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    return /\.(jpe?g|png)$/.test(name) || /image\/(jpeg|jpg|png)/.test(type);
  }

  function readSize(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error(TYPE_COPY));
        return;
      }
      if (!isTypeOk(file)) {
        reject(new Error(TYPE_COPY));
        return;
      }
      if (Number(file.size) > MAX_BYTES) {
        reject(new Error(HEAVY_COPY));
        return;
      }
      var url = root.URL && root.URL.createObjectURL ? root.URL.createObjectURL(file) : '';
      var img = new Image();
      img.onload = function () {
        if (url && root.URL && root.URL.revokeObjectURL) root.URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      };
      img.onerror = function () {
        if (url && root.URL && root.URL.revokeObjectURL) root.URL.revokeObjectURL(url);
        reject(new Error(TYPE_COPY));
      };
      img.src = url;
    });
  }

  function check(file) {
    return readSize(file).then(function (size) {
      var w = Number(size.width) || 0;
      var h = Number(size.height) || 0;
      if (!w || !h) return { ok: false, error: TYPE_COPY };
      if (w !== h) return { ok: false, error: SQUARE_COPY };
      if (w < MIN || w > MAX) return { ok: false, error: SIZE_COPY };
      return { ok: true, width: w, height: h };
    }).catch(function (err) {
      return { ok: false, error: (err && err.message) || TYPE_COPY };
    });
  }

  root.PlaigroundCoverQc = {
    MIN: MIN,
    MAX: MAX,
    check: check,
    isTypeOk: isTypeOk,
    showError: showError,
    showOk: showOk,
    TYPE_COPY: TYPE_COPY,
    SQUARE_COPY: SQUARE_COPY,
    SIZE_COPY: SIZE_COPY,
    HEAVY_COPY: HEAVY_COPY,
  };
})(typeof window !== 'undefined' ? window : this);
