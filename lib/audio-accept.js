/**
 * Incoming upload audio may be WAV, FLAC, or MP3 (plus MIME/extension
 * variants phones actually send). The store still gets WAV/FLAC only;
 * MP3 is converted in-house. No M4A/AAC/OGG. No ffmpeg.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PlaigroundAudioAccept = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var ERROR = 'Audio must be WAV, FLAC, or MP3.';
  var ACCEPT = 'audio/*,.wav,.flac,.mp3,.mpeg,.mpga,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/mpeg,audio/mp3,audio/x-mpeg,audio/x-mp3,audio/mpeg3,audio/mpg';

  var WAV_EXTS = { wav: true };
  var FLAC_EXTS = { flac: true };
  var MP3_EXTS = { mp3: true, mpeg: true, mpga: true, mpg: true };
  var REJECT_EXTS = {
    m4a: true, aac: true, ogg: true, oga: true, opus: true, wma: true,
    mp4: true, m4b: true, webm: true, aiff: true, aif: true, caf: true,
  };

  function normType(type) {
    return String(type || '').trim().toLowerCase().split(';')[0].trim();
  }

  function extOf(name) {
    var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  function isWavType(type) {
    var t = normType(type);
    return t === 'audio/wav' || t === 'audio/x-wav' || t === 'audio/wave' || t === 'audio/vnd.wave';
  }

  function isFlacType(type) {
    var t = normType(type);
    return t === 'audio/flac' || t === 'audio/x-flac';
  }

  function isMp3Type(type) {
    var t = normType(type);
    if (!t) return false;
    if (
      t === 'audio/mpeg' || t === 'audio/mp3' || t === 'audio/x-mpeg' || t === 'audio/x-mp3'
      || t === 'audio/mpeg3' || t === 'audio/x-mpeg-3' || t === 'audio/mpg' || t === 'audio/x-mpg'
      || t === 'audio/mpga' || t === 'audio/x-mpga'
    ) return true;
    return /^audio\/(x-)?(mpeg|mp3|mpeg3|mpg|mpga)\d?$/.test(t);
  }

  function isAllowedType(type) {
    return isWavType(type) || isFlacType(type) || isMp3Type(type);
  }

  function isRejectedType(type) {
    var t = normType(type);
    return /^(audio|application)\/(mp4|x-m4a|m4a|aac|x-aac|ogg|opus|webm|wma|x-ms-wma|aiff|x-aiff)$/.test(t);
  }

  function isRejectedExt(name) {
    return Boolean(REJECT_EXTS[extOf(name)]);
  }

  function isWavExt(name) { return Boolean(WAV_EXTS[extOf(name)]); }
  function isFlacExt(name) { return Boolean(FLAC_EXTS[extOf(name)]); }
  function isMp3Ext(name) { return Boolean(MP3_EXTS[extOf(name)]); }

  function isAllowedExt(name) {
    return isWavExt(name) || isFlacExt(name) || isMp3Ext(name);
  }

  function asBytes(data) {
    if (!data) return null;
    if (data instanceof Uint8Array) return data;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(data)) return data;
    if (typeof data.length === 'number') return data;
    return null;
  }

  function looksLikeMp3Bytes(data) {
    var bytes = asBytes(data);
    if (!bytes || bytes.length < 3) return false;
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true;
    return false;
  }

  function looksLikeWavBytes(data) {
    var bytes = asBytes(data);
    return Boolean(
      bytes && bytes.length >= 12
      && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
    );
  }

  function looksLikeFlacBytes(data) {
    var bytes = asBytes(data);
    return Boolean(
      bytes && bytes.length >= 4
      && bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43
    );
  }

  function looksLikeAllowedBytes(data) {
    return looksLikeWavBytes(data) || looksLikeFlacBytes(data) || looksLikeMp3Bytes(data);
  }

  function fileLooksLikeWav(file) {
    if (!file) return false;
    var name = file.name || file.filename || '';
    var type = file.type || file.mime || '';
    return isWavExt(name) || isWavType(type);
  }

  function fileLooksLikeFlac(file) {
    if (!file) return false;
    var name = file.name || file.filename || '';
    var type = file.type || file.mime || '';
    return isFlacExt(name) || isFlacType(type);
  }

  function fileLooksLikeMp3(file) {
    if (!file) return false;
    var name = file.name || file.filename || '';
    var type = file.type || file.mime || '';
    if (isRejectedExt(name) || isRejectedType(type)) return false;
    return isMp3Ext(name) || isMp3Type(type);
  }

  function convertProgressCopy(file, kind) {
    var k = String(kind || '').toLowerCase();
    if (file) {
      var name = file.name || file.filename || '';
      if (isWavExt(name) || isFlacExt(name)) return '';
    }
    if (!k && file) {
      if (fileLooksLikeWav(file) && !fileLooksLikeMp3(file)) return '';
      if (fileLooksLikeFlac(file) && !fileLooksLikeMp3(file)) return '';
      if (fileLooksLikeMp3(file)) k = 'mp3';
    }
    if (k === 'wav' || k === 'flac') return '';
    if (k === 'mp3') return 'Converting MP3 to WAV';
    if (k) return 'Converting to WAV';
    return '';
  }

  function sniffKind(file) {
    if (!file || typeof file.slice !== 'function') return Promise.resolve('');
    var blob = file.slice(0, 12);
    if (!blob || typeof blob.arrayBuffer !== 'function') return Promise.resolve('');
    return blob.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      if (looksLikeWavBytes(bytes)) return 'wav';
      if (looksLikeFlacBytes(bytes)) return 'flac';
      if (looksLikeMp3Bytes(bytes)) return 'mp3';
      return '';
    }).catch(function () {
      return '';
    });
  }

  function isMp3Name(name, mime) {
    return fileLooksLikeMp3({ name: name, type: mime });
  }

  function fileLooksAllowedSync(file) {
    if (!file) return false;
    var name = file.name || file.filename || '';
    var type = file.type || file.mime || '';
    if (isRejectedExt(name) || isRejectedType(type)) return false;
    if (isAllowedExt(name)) return true;
    if (isAllowedType(type)) return true;
    return false;
  }

  function sniffFile(file) {
    if (!file || isRejectedExt(file.name) || isRejectedType(file.type)) {
      return Promise.resolve(false);
    }
    if (typeof file.slice !== 'function') return Promise.resolve(false);
    var blob = file.slice(0, 12);
    if (!blob || typeof blob.arrayBuffer !== 'function') return Promise.resolve(false);
    return blob.arrayBuffer().then(function (buf) {
      return looksLikeAllowedBytes(new Uint8Array(buf));
    }).catch(function () {
      return false;
    });
  }

  function fileLooksAllowed(file) {
    if (fileLooksAllowedSync(file)) return Promise.resolve(true);
    return sniffFile(file);
  }

  function incomingPartAllowed(part) {
    var name = (part && (part.filename || part.name)) || '';
    var type = (part && (part.type || part.mime)) || '';
    var data = part && part.data;
    if (isRejectedExt(name) || isRejectedType(type)) return false;
    if (fileLooksAllowedSync({ name: name, type: type })) return true;
    if (data && looksLikeAllowedBytes(data)) return true;
    if (data && data.length >= 3) return false;
    return true;
  }

  return {
    ERROR: ERROR,
    ACCEPT: ACCEPT,
    fileLooksAllowedSync: fileLooksAllowedSync,
    fileLooksAllowed: fileLooksAllowed,
    fileLooksLikeWav: fileLooksLikeWav,
    fileLooksLikeFlac: fileLooksLikeFlac,
    fileLooksLikeMp3: fileLooksLikeMp3,
    convertProgressCopy: convertProgressCopy,
    sniffKind: sniffKind,
    isMp3Name: isMp3Name,
    isMp3Type: isMp3Type,
    isAllowedType: isAllowedType,
    isAllowedExt: isAllowedExt,
    looksLikeMp3Bytes: looksLikeMp3Bytes,
    looksLikeAllowedBytes: looksLikeAllowedBytes,
    incomingPartAllowed: incomingPartAllowed,
    sniffFile: sniffFile,
  };
});

(function loadUploadAudioBind(root) {
  if (!root || !root.document) return;
  try {
    if (root.document.querySelector('script[src*="upload-audio-bind.js"]')) return;
    var script = root.document.createElement('script');
    script.src = 'lib/upload-audio-bind.js?v=20260903aud2';
    (root.document.head || root.document.documentElement).appendChild(script);
  } catch (err) {}
})(typeof window !== 'undefined' ? window : this);
