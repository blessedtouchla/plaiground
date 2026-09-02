/**
 * Save draft keeps picked audio + cover on this device.
 * Does not hop, attach, or send the draft to the store.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) root.PlaigroundUploadDraftFiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var HOLD_DB = 'plaiground-held-audio';
  var HOLD_STORE = 'files';
  var AUDIO_KEY = 'picked';
  var MASTER_KEY = 'master';
  var COVER_KEY = 'cover';

  function fileFromInput(el) {
    if (!el) return null;
    if (el.files && el.files[0]) return el.files[0];
    if (el._plaigroundFile) return el._plaigroundFile;
    return null;
  }

  function attachFile(el, file) {
    if (!el || !file) return false;
    try {
      if (typeof DataTransfer === 'function') {
        var dt = new DataTransfer();
        dt.items.add(file);
        el.files = dt.files;
      }
    } catch (err) {}
    el._plaigroundFile = file;
    try {
      if (typeof el.dispatchEvent === 'function') {
        var ev;
        if (typeof Event === 'function') ev = new Event('change', { bubbles: true });
        if (ev) el.dispatchEvent(ev);
        else el.dispatchEvent('change');
      }
    } catch (err2) {}
    return true;
  }

  function collectFileMeta(win) {
    var doc = win && win.document;
    var audio = doc && doc.querySelector ? fileFromInput(doc.querySelector('[data-audio-input]')) : null;
    var cover = doc && doc.querySelector ? fileFromInput(doc.querySelector('[data-art-input]')) : null;
    return {
      audio_name: audio && audio.name ? String(audio.name) : '',
      audio_type: audio && audio.type ? String(audio.type) : '',
      audio_size: audio && audio.size ? Number(audio.size) || 0 : 0,
      audio_picked_name: audio && audio.name ? String(audio.name) : '',
      audio_picked_size: audio && audio.size ? Number(audio.size) || 0 : 0,
      artwork_name: cover && cover.name ? String(cover.name) : '',
      artwork_type: cover && cover.type ? String(cover.type) : '',
      artwork_size: cover && cover.size ? Number(cover.size) || 0 : 0,
    };
  }

  function idbOf(win) {
    if (!win) return null;
    return win.indexedDB || (typeof indexedDB !== 'undefined' ? indexedDB : null);
  }

  function openHold(win) {
    return new Promise(function (resolve, reject) {
      var idb = idbOf(win);
      if (!idb || typeof idb.open !== 'function') {
        resolve(null);
        return;
      }
      var req;
      try {
        req = idb.open(HOLD_DB, 1);
      } catch (err) {
        resolve(null);
        return;
      }
      req.onerror = function () { resolve(null); };
      req.onupgradeneeded = function () {
        try {
          if (req.result && !req.result.objectStoreNames.contains(HOLD_STORE)) {
            req.result.createObjectStore(HOLD_STORE);
          }
        } catch (err) {}
      };
      req.onsuccess = function () { resolve(req.result || null); };
    });
  }

  function isHeldRecord(value) {
    return Boolean(value && value.__held === 1 && (value.buffer || Number(value.size) > 0));
  }

  function cloneForHold(file) {
    if (!file) return Promise.resolve(null);
    if (isHeldRecord(file)) return Promise.resolve(file);
    if (typeof file.arrayBuffer !== 'function') return Promise.resolve(file);
    return Promise.resolve().then(function () {
      return file.arrayBuffer();
    }).then(function (buf) {
      if (!buf || !buf.byteLength) return file;
      return {
        __held: 1,
        name: file.name || '',
        type: file.type || '',
        lastModified: file.lastModified || Date.now(),
        size: buf.byteLength,
        buffer: buf,
      };
    }).catch(function () {
      return file;
    });
  }

  function fileFromHeld(value) {
    if (!value) return null;
    if (isHeldRecord(value)) {
      if (typeof Blob === 'function' && value.buffer) {
        try {
          var blob = new Blob([value.buffer], { type: value.type || 'audio/wav' });
          if (typeof File === 'function') {
            return new File([blob], value.name || 'audio.wav', {
              type: value.type || 'audio/wav',
              lastModified: value.lastModified || Date.now(),
            });
          }
          blob.name = value.name || 'audio.wav';
          return blob;
        } catch (err) {}
      }
      return {
        name: value.name || 'audio.wav',
        type: value.type || 'audio/wav',
        size: value.size || (value.buffer && value.buffer.byteLength) || 0,
        buffer: value.buffer,
      };
    }
    return value;
  }

  function putSlot(db, key, file) {
    return cloneForHold(file).then(function (stored) {
      return new Promise(function (resolve) {
        if (!db || !stored) {
          resolve(fileFromHeld(stored) || file || null);
          return;
        }
        try {
          var tx = db.transaction(HOLD_STORE, 'readwrite');
          tx.oncomplete = function () { resolve(fileFromHeld(stored) || file); };
          tx.onerror = function () { resolve(fileFromHeld(stored) || file); };
          tx.onabort = function () { resolve(fileFromHeld(stored) || file); };
          tx.objectStore(HOLD_STORE).put(stored, key);
        } catch (err) {
          resolve(fileFromHeld(stored) || file);
        }
      });
    });
  }

  function getSlot(db, key) {
    return new Promise(function (resolve) {
      if (!db) {
        resolve(null);
        return;
      }
      try {
        var tx = db.transaction(HOLD_STORE, 'readonly');
        var req = tx.objectStore(HOLD_STORE).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      } catch (err) {
        resolve(null);
      }
    });
  }

  function persistPickedFiles(win) {
    win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
    var doc = win && win.document;
    var audio = doc && doc.querySelector ? fileFromInput(doc.querySelector('[data-audio-input]')) : null;
    var cover = doc && doc.querySelector ? fileFromInput(doc.querySelector('[data-art-input]')) : null;
    return openHold(win).then(function (db) {
      if (!db) return { audio: audio, cover: cover };
      var jobs = [];
      if (audio) {
        jobs.push(putSlot(db, AUDIO_KEY, audio));
        jobs.push(putSlot(db, MASTER_KEY, audio));
      }
      if (cover) jobs.push(putSlot(db, COVER_KEY, cover));
      return Promise.all(jobs).then(function () {
        return { audio: audio, cover: cover };
      });
    });
  }

  function wipeHeld(win) {
    win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
    try {
      if (win && win.localStorage && typeof win.localStorage.removeItem === 'function') {
        win.localStorage.removeItem('plaiground.store.draft');
        win.localStorage.removeItem('plaiground.tonegrid.draft');
      }
    } catch (err) {}
    try {
      if (win && win.sessionStorage && typeof win.sessionStorage.removeItem === 'function') {
        win.sessionStorage.removeItem('plaiground.store.draft');
        win.sessionStorage.removeItem('plaiground.tonegrid.draft');
      }
    } catch (err2) {}
    try {
      var idb = idbOf(win);
      if (idb && typeof idb.deleteDatabase === 'function') idb.deleteDatabase(HOLD_DB);
    } catch (err3) {}
    return true;
  }

  function restorePickedFiles(win) {
    win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
    var doc = win && win.document;
    return openHold(win).then(function (db) {
      if (!db || !doc) return { audio: null, cover: null };
      return Promise.all([getSlot(db, AUDIO_KEY), getSlot(db, MASTER_KEY), getSlot(db, COVER_KEY)]).then(function (rows) {
        var audio = fileFromHeld(rows[0] || rows[1] || null);
        var cover = fileFromHeld(rows[2] || null);
        var audioEl = doc.querySelector ? doc.querySelector('[data-audio-input]') : null;
        var artEl = doc.querySelector ? doc.querySelector('[data-art-input]') : null;
        if (audio) attachFile(audioEl, audio);
        if (cover) attachFile(artEl, cover);
        return { audio: audio, cover: cover };
      });
    });
  }

  function keepHeldFiles(win) {
    win = win || (typeof globalThis !== 'undefined' ? globalThis : null);
    return openHold(win).then(function (db) {
      if (!db) return { audio: null, cover: null };
      return Promise.all([getSlot(db, AUDIO_KEY), getSlot(db, MASTER_KEY), getSlot(db, COVER_KEY)]).then(function (rows) {
        var audio = rows[0] || rows[1] || null;
        var cover = rows[2] || null;
        var jobs = [];
        if (audio) {
          jobs.push(putSlot(db, AUDIO_KEY, audio));
          jobs.push(putSlot(db, MASTER_KEY, audio));
        }
        if (cover) jobs.push(putSlot(db, COVER_KEY, cover));
        return Promise.all(jobs).then(function () {
          return { audio: fileFromHeld(audio), cover: fileFromHeld(cover) };
        });
      });
    });
  }

  return {
    HOLD_DB: HOLD_DB,
    AUDIO_KEY: AUDIO_KEY,
    COVER_KEY: COVER_KEY,
    collectFileMeta: collectFileMeta,
    fileFromInput: fileFromInput,
    persistPickedFiles: persistPickedFiles,
    restorePickedFiles: restorePickedFiles,
    keepHeldFiles: keepHeldFiles,
    wipeHeld: wipeHeld,
  };
});
