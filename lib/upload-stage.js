/**
 * Upload page release-stage paint: sleeve, title, waveform, side chips.
 * Routes dropped files onto the existing audio/cover inputs.
 * Does not hop, mint, attach, save drafts, or rewrite Continue.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PlaigroundUploadStage = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var MAGENTA = '#d03083';
  var PURPLE = '#782fb1';
  var GOLD = '#f3cb47';
  var WAVE_BARS = 56;

  function $(sel, node) {
    var doc = node || (typeof document !== 'undefined' ? document : null);
    return doc && doc.querySelector ? doc.querySelector(sel) : null;
  }

  function $all(sel, node) {
    var doc = node || (typeof document !== 'undefined' ? document : null);
    if (!doc || !doc.querySelectorAll) return [];
    return Array.prototype.slice.call(doc.querySelectorAll(sel));
  }

  function trim(value) {
    return String(value == null ? '' : value).trim();
  }

  function filled(value) {
    return trim(value) !== '';
  }

  function hasFile(input) {
    if (!input) return false;
    if (input.files && input.files[0]) return true;
    if (input._plaigroundFile) return true;
    return false;
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    if (el.getAttribute && el.getAttribute('hidden') != null && el.hidden !== false) {
      if (el.hidden === true) return false;
    }
    return true;
  }

  function singleAudioReady(doc) {
    var rootEl = $('[data-single-audio]', doc);
    if (rootEl && !isVisible(rootEl)) {
      return albumAudioReady(doc);
    }
    var input = $('[data-single-audio] [data-audio-input]', doc) || $('[data-audio-input]', doc);
    if (hasFile(input)) return true;
    var preview = $('[data-single-audio] [data-audio-preview]', doc) || $('[data-audio-preview]', doc);
    if (preview && isVisible(preview) && !preview.hidden) return true;
    var nameEl = $('[data-audio-name]', doc);
    var name = nameEl ? trim(nameEl.textContent) : '';
    if (name && name !== 'No file selected') return true;
    return albumAudioReady(doc);
  }

  function albumAudioReady(doc) {
    var rows = $all('[data-track-row]', doc);
    if (!rows.length) return false;
    var i;
    for (i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var uploaded = row.getAttribute && String(row.getAttribute('data-audio-uploaded') || '') === 'true';
      if (uploaded) continue;
      var input = row.querySelector ? row.querySelector('[data-audio-input]') : null;
      if (hasFile(input)) continue;
      var preview = row.querySelector ? row.querySelector('[data-audio-preview]') : null;
      if (preview && !preview.hidden) continue;
      return false;
    }
    return true;
  }

  function coverReady(doc) {
    var tile = $('[data-art-box]', doc);
    if (tile) {
      if (tile.classList && tile.classList.contains('has-art')) return true;
      var img = tile.querySelector ? tile.querySelector('img[data-cover-photo]') : null;
      if (img && img.src && !img.hidden) return true;
      var bg = tile.style && tile.style.backgroundImage;
      if (bg && bg !== 'none' && trim(bg) !== '') return true;
    }
    var input = $('[data-art-input]', doc);
    return hasFile(input);
  }

  function titleValue(doc) {
    var input = (doc || (typeof document !== 'undefined' ? document : null));
    var el = input && input.getElementById ? input.getElementById('tg-title') : $('[id="tg-title"]', doc);
    return el ? trim(el.value) : '';
  }

  function fieldValue(id, doc) {
    var rootDoc = doc || (typeof document !== 'undefined' ? document : null);
    var el = rootDoc && rootDoc.getElementById ? rootDoc.getElementById(id) : null;
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked ? 'true' : '';
    return trim(el.value);
  }

  function catalogValue(id, doc) {
    var rootDoc = doc || (typeof document !== 'undefined' ? document : null);
    var select = rootDoc && rootDoc.getElementById ? rootDoc.getElementById(id) : null;
    if (!select) return '';
    var field = select.parentNode;
    var typed = field && field.querySelector ? field.querySelector('.typeahead-input') : null;
    if (!typed && rootDoc && rootDoc.getElementById) typed = rootDoc.getElementById(id + '-type');
    if (typed && trim(typed.value)) return trim(typed.value);
    return trim(select.value);
  }

  function artistValue(doc) {
    return fieldValue('tg-artist', doc) || fieldValue('tg-artist-new', doc) || fieldValue('tg-artist-select', doc);
  }

  function creditsReady(doc) {
    if (!filled(titleValue(doc))) return false;
    if (!filled(artistValue(doc))) return false;
    if (!filled(catalogValue('tg-genre', doc))) return false;
    var instrumental = fieldValue('tg-instrumental', doc) === 'true';
    if (!instrumental && !filled(catalogValue('tg-language', doc))) return false;
    if (!filled(fieldValue('tg-price', doc))) return false;
    return true;
  }

  function collectState(doc) {
    var audio = singleAudioReady(doc);
    var cover = coverReady(doc);
    var credits = creditsReady(doc);
    return {
      audio: audio,
      cover: cover,
      credits: credits,
      send: audio && cover && credits,
      title: titleValue(doc)
    };
  }

  function missingCopy(state) {
    state = state || {};
    if (!state.audio) return 'Add audio to start this release.';
    if (!state.cover) return 'Drop cover art onto the sleeve.';
    if (!state.credits) {
      if (!filled(state.title)) return 'Type the title onto the sleeve.';
      return 'Finish credits — artist, genre, and price.';
    }
    return 'Ready to continue.';
  }

  function paintTitle(doc) {
    var title = titleValue(doc);
    var face = $('[data-stage-title]', doc);
    if (face) {
      if (face.textContent !== title) face.textContent = title;
      if (face.classList && face.classList.toggle) {
        face.classList.toggle('is-on', Boolean(title));
      }
    }
    var sleeve = $('[data-release-sleeve]', doc);
    if (sleeve && sleeve.classList && sleeve.classList.toggle) {
      sleeve.classList.toggle('has-title', Boolean(title));
    }
    return title;
  }

  function paintChips(doc, state) {
    state = state || collectState(doc);
    $all('[data-stage-chip]', doc).forEach(function (chip) {
      var key = chip.getAttribute ? chip.getAttribute('data-stage-chip') : '';
      var on = Boolean(state[key]);
      if (chip.classList && chip.classList.toggle) chip.classList.toggle('is-on', on);
      if (chip.setAttribute) chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    return state;
  }

  function paintMissing(doc, state) {
    state = state || collectState(doc);
    var copy = missingCopy(state);
    $all('[data-stage-missing]', doc).forEach(function (line) {
      line.textContent = copy;
      if (line.classList && line.classList.toggle) {
        line.classList.toggle('is-ready', Boolean(state.send));
      }
    });
    return copy;
  }

  function paintSleeveState(doc, state) {
    state = state || collectState(doc);
    var sleeve = $('[data-release-sleeve]', doc);
    if (sleeve && sleeve.classList && sleeve.classList.toggle) {
      sleeve.classList.toggle('is-filled', Boolean(state.cover));
      sleeve.classList.toggle('is-empty', !state.cover);
    }
    return state;
  }

  function peaksFromChannel(channel, bars) {
    var count = bars || WAVE_BARS;
    var data = channel || [];
    var len = data.length || 0;
    var peaks = [];
    var i;
    if (!len) {
      for (i = 0; i < count; i += 1) peaks.push(0.12);
      return peaks;
    }
    var step = Math.max(1, Math.floor(len / count));
    for (i = 0; i < count; i += 1) {
      var start = i * step;
      var end = Math.min(len, start + step);
      var peak = 0;
      var j;
      for (j = start; j < end; j += 1) {
        var v = Math.abs(data[j] || 0);
        if (v > peak) peak = v;
      }
      peaks.push(Math.max(0.2, Math.min(1, peak)));
    }
    return peaks;
  }

  function drawPeaks(ctx, peaks, width, height) {
    if (!ctx || !peaks || !peaks.length) return peaks;
    var w = width || 320;
    var h = height || 56;
    ctx.clearRect(0, 0, w, h);
    var gap = 2;
    var barW = Math.max(2, (w / peaks.length) - gap);
    var mid = h / 2;
    var i;
    for (i = 0; i < peaks.length; i += 1) {
      var amp = peaks[i] * (h * 0.46);
      var x = i * (barW + gap);
      var color = GOLD;
      if (i % 5 === 0) color = MAGENTA;
      else if (i % 3 === 0) color = PURPLE;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.82;
      ctx.fillRect(x, mid - amp, barW, amp * 2);
    }
    ctx.globalAlpha = 1;
    return peaks;
  }

  function fallbackPeaks(size, bars) {
    var count = bars || WAVE_BARS;
    var peaks = [];
    var seed = Math.max(1, Number(size) || 1);
    var i;
    for (i = 0; i < count; i += 1) {
      var n = ((seed * (i + 3)) % 97) / 97;
      peaks.push(0.16 + n * 0.55);
    }
    return peaks;
  }

  function waveCanvas(doc) {
    return $('[data-stage-wave-canvas]', doc) || $('[data-stage-wave]', doc);
  }

  function showWave(doc, on) {
    var wrap = $('[data-stage-wave]', doc);
    if (wrap) wrap.hidden = !on;
    return wrap;
  }

  function paintWaveform(file, opts) {
    opts = opts || {};
    var doc = opts.document;
    var canvas = opts.canvas || waveCanvas(doc);
    if (!canvas) return Promise.resolve(null);
    var width = opts.width || canvas.width || 320;
    var height = opts.height || canvas.height || 56;
    if (canvas.getContext && !canvas._stageSizeLock) {
      var cssW = 0;
      if (canvas.clientWidth) cssW = canvas.clientWidth;
      canvas.width = cssW || width;
      canvas.height = height;
      width = canvas.width;
    }
    var ctx = opts.context || (canvas.getContext ? canvas.getContext('2d') : null);
    function paint(peaks) {
      showWave(doc, true);
      drawPeaks(ctx, peaks, width, canvas.height || height);
      return peaks;
    }
    if (!file) {
      showWave(doc, false);
      return Promise.resolve(null);
    }
    var decode = opts.decodeAudioData;
    if (!decode && opts.audioContext && typeof opts.audioContext.decodeAudioData === 'function') {
      decode = function (buffer) { return opts.audioContext.decodeAudioData(buffer); };
    }
    if (!decode) {
      var win = opts.window || (typeof window !== 'undefined' ? window : null);
      var Ctx = opts.AudioContext || (win && (win.AudioContext || win.webkitAudioContext));
      if (typeof Ctx === 'function') {
        try {
          var audioCtx = new Ctx();
          if (audioCtx && typeof audioCtx.decodeAudioData === 'function') {
            decode = function (buffer) { return audioCtx.decodeAudioData(buffer); };
          }
        } catch (err) {}
      }
    }
    if (typeof decode === 'function' && file.arrayBuffer) {
      return Promise.resolve(file.arrayBuffer()).then(function (buf) {
        return decode(buf);
      }).then(function (audio) {
        var channel = audio && audio.getChannelData ? audio.getChannelData(0) : [];
        return paint(peaksFromChannel(channel, WAVE_BARS));
      }).catch(function () {
        return paint(fallbackPeaks(file.size, WAVE_BARS));
      });
    }
    return Promise.resolve(paint(fallbackPeaks(file && file.size, WAVE_BARS)));
  }

  function isCoverFile(file) {
    var api = typeof PlaigroundCoverPreview !== 'undefined' ? PlaigroundCoverPreview : null;
    if (api && typeof api.isCoverFile === 'function') return api.isCoverFile(file);
    if (!file) return false;
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    return /\.(jpe?g|png)$/.test(name) || /image\/(jpeg|jpg|png)/.test(type);
  }

  function isAudioFile(file) {
    var api = typeof PlaigroundAudioAccept !== 'undefined' ? PlaigroundAudioAccept : null;
    if (api && typeof api.fileLooksAllowedSync === 'function') return api.fileLooksAllowedSync(file);
    if (!file) return false;
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    if (/\.(wav|flac|mp3|mpeg|mpga|mpg)$/.test(name)) return true;
    return type.indexOf('audio/') === 0;
  }

  function stickFile(input, file) {
    if (!input || !file) return false;
    input._plaigroundFile = file;
    try {
      var Transfer = typeof DataTransfer !== 'undefined' ? DataTransfer : null;
      if (Transfer) {
        var dt = new Transfer();
        if (dt.items && dt.items.add) dt.items.add(file);
        if (dt.files) input.files = dt.files;
      }
    } catch (err) {}
    try {
      var EventFn = typeof Event !== 'undefined' ? Event : null;
      if (EventFn && input.dispatchEvent) {
        input.dispatchEvent(new EventFn('change', { bubbles: true }));
      } else if (input.onchange) {
        input.onchange();
      }
    } catch (err2) {}
    return true;
  }

  function existingAudioInput(doc) {
    var rootEl = $('[data-single-audio]', doc);
    if (rootEl && rootEl.querySelector) {
      var inside = rootEl.querySelector('[data-audio-input]');
      if (inside) return inside;
    }
    var byId = doc && doc.getElementById ? doc.getElementById('tg-audio-file') : null;
    if (byId) return byId;
    var track = $('[data-track-row] [data-audio-input]', doc);
    if (track) return track;
    return $('[data-audio-input]', doc);
  }

  function existingCoverInput(doc) {
    var byId = doc && doc.getElementById ? doc.getElementById('tg-art-file') : null;
    if (byId) return byId;
    return $('[data-art-input]', doc);
  }

  var pickerOpening = false;

  function openExistingPicker(kind, doc) {
    var input = kind === 'cover' ? existingCoverInput(doc) : existingAudioInput(doc);
    if (!input || pickerOpening) return input || null;
    pickerOpening = true;
    try {
      if (typeof input.click === 'function') input.click();
    } catch (err) {}
    pickerOpening = false;
    return input;
  }

  function isProtectedHit(node) {
    while (node && node !== (typeof document !== 'undefined' ? document : null)) {
      if (!node.getAttribute && !node.id) {
        node = node.parentNode || node.parentElement;
        continue;
      }
      if (node.id === 'tg-title') return true;
      if (node.getAttribute && (
        node.getAttribute('data-art-clear') != null
        || node.getAttribute('data-art-resize') != null
        || node.getAttribute('data-art-pick') != null
        || node.getAttribute('data-upload-cancel') != null
        || node.getAttribute('data-upload-start-over') != null
        || node.getAttribute('data-audio-play') != null
        || node.getAttribute('data-lyrics-open') != null
      )) return true;
      node = node.parentNode || node.parentElement;
    }
    return false;
  }

  function bindPickers(doc) {
    if (!doc || !doc.addEventListener) return;
    function onClick(event) {
      var node = event && event.target;
      if (node && node.getAttribute && (
        node.getAttribute('data-audio-input') != null
        || node.getAttribute('data-art-input') != null
      )) return;
      while (node && node !== doc) {
        if (isProtectedHit(node) && !(node.getAttribute && node.getAttribute('data-stage-pick') != null)) {
          return;
        }
        var pick = node.getAttribute && node.getAttribute('data-stage-pick');
        if (pick === 'audio' || pick === 'cover') {
          if (event && event.preventDefault) event.preventDefault();
          openExistingPicker(pick, doc);
          return;
        }
        node = node.parentNode || node.parentElement;
      }
    }
    function onKey(event) {
      var key = event && (event.key || event.keyCode);
      if (key !== 'Enter' && key !== ' ' && key !== 13 && key !== 32) return;
      var node = event && event.target;
      var pick = node && node.getAttribute && node.getAttribute('data-stage-pick');
      if (pick !== 'audio' && pick !== 'cover') return;
      if (event && event.preventDefault) event.preventDefault();
      openExistingPicker(pick, doc);
    }
    if (!doc._plaigroundStagePickBound) {
      doc._plaigroundStagePickBound = true;
      doc.addEventListener('click', onClick);
      doc.addEventListener('keydown', onKey);
    }
  }

  function routeFile(file, doc) {
    if (!file) return '';
    if (isCoverFile(file) && !isAudioFile(file)) {
      stickFile($('[data-art-input]', doc), file);
      return 'cover';
    }
    if (isAudioFile(file)) {
      var audioRoot = $('[data-single-audio]', doc);
      var audioInput = (audioRoot && audioRoot.querySelector)
        ? audioRoot.querySelector('[data-audio-input]')
        : $('[data-audio-input]', doc);
      stickFile(audioInput, file);
      return 'audio';
    }
    if (isCoverFile(file)) {
      stickFile($('[data-art-input]', doc), file);
      return 'cover';
    }
    return '';
  }

  function refresh(doc) {
    var state = collectState(doc);
    paintTitle(doc);
    paintChips(doc, state);
    paintMissing(doc, state);
    paintSleeveState(doc, state);
    return state;
  }

  function onAudioFile(file, opts) {
    refresh(opts && opts.document);
    return paintWaveform(file, opts);
  }

  function bindDrop(el, doc) {
    if (!el || !el.addEventListener) return;
    el.addEventListener('dragover', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      if (el.classList) el.classList.add('is-over');
    });
    el.addEventListener('dragleave', function () {
      if (el.classList) el.classList.remove('is-over');
    });
    el.addEventListener('drop', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      if (el.classList) el.classList.remove('is-over');
      var file = event && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      var kind = routeFile(file, doc);
      if (kind === 'audio') onAudioFile(file, { document: doc });
      else refresh(doc);
    });
  }

  function bind(doc, win) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    win = win || (typeof window !== 'undefined' ? window : null);
    if (!doc || !doc.querySelector) return false;
    var stage = $('[data-release-stage]', doc);
    if (!stage) return false;
    if (stage.getAttribute && stage.getAttribute('data-stage-bound') === 'true') return true;
    if (stage.setAttribute) stage.setAttribute('data-stage-bound', 'true');

    bindDrop($('[data-stage-drop]', doc), doc);
    bindPickers(doc);

    var title = doc.getElementById ? doc.getElementById('tg-title') : null;
    if (title && title.addEventListener) {
      title.addEventListener('input', function () { refresh(doc); });
      title.addEventListener('change', function () { refresh(doc); });
    }

    ['tg-artist', 'tg-artist-new', 'tg-artist-select', 'tg-artist-mode', 'tg-genre', 'tg-language', 'tg-price', 'tg-instrumental'].forEach(function (id) {
      var el = doc.getElementById ? doc.getElementById(id) : null;
      if (el && el.addEventListener) {
        el.addEventListener('input', function () { refresh(doc); });
        el.addEventListener('change', function () { refresh(doc); });
      }
    });

    var artInput = $('[data-art-input]', doc);
    if (artInput && artInput.addEventListener) {
      artInput.addEventListener('change', function () { refresh(doc); });
    }
    var audioInput = $('[data-single-audio] [data-audio-input]', doc) || $('[data-audio-input]', doc);
    if (audioInput && audioInput.addEventListener) {
      audioInput.addEventListener('change', function () {
        var file = (audioInput.files && audioInput.files[0]) || audioInput._plaigroundFile;
        onAudioFile(file, { document: doc, window: win });
      });
    }

    if (doc.addEventListener) {
      doc.addEventListener('change', function (event) {
        var t = event && event.target;
        if (!t) return;
        if (t.getAttribute && t.getAttribute('data-audio-input') != null) {
          var file = (t.files && t.files[0]) || t._plaigroundFile;
          if (t.closest && t.closest('[data-single-audio]')) onAudioFile(file, { document: doc, window: win });
          else refresh(doc);
        }
      });
    }

    refresh(doc);
    if (win && win.setTimeout) {
      win.setTimeout(function () { refresh(doc); }, 300);
      win.setTimeout(function () { refresh(doc); }, 1200);
      win.setTimeout(function () { refresh(doc); }, 2400);
    }
    return true;
  }

  function start(win) {
    win = win || (typeof window !== 'undefined' ? window : null);
    var doc = win && win.document ? win.document : (typeof document !== 'undefined' ? document : null);
    if (!doc) return false;
    if (doc.readyState === 'loading' && doc.addEventListener) {
      doc.addEventListener('DOMContentLoaded', function () { bind(doc, win); });
      return true;
    }
    return bind(doc, win);
  }

  if (typeof document !== 'undefined') start();

  return {
    MAGENTA: MAGENTA,
    PURPLE: PURPLE,
    GOLD: GOLD,
    collectState: collectState,
    missingCopy: missingCopy,
    paintTitle: paintTitle,
    paintChips: paintChips,
    paintMissing: paintMissing,
    paintSleeveState: paintSleeveState,
    peaksFromChannel: peaksFromChannel,
    drawPeaks: drawPeaks,
    fallbackPeaks: fallbackPeaks,
    paintWaveform: paintWaveform,
    routeFile: routeFile,
    existingAudioInput: existingAudioInput,
    existingCoverInput: existingCoverInput,
    openExistingPicker: openExistingPicker,
    stickFile: stickFile,
    isCoverFile: isCoverFile,
    isAudioFile: isAudioFile,
    onAudioFile: onAudioFile,
    refresh: refresh,
    bind: bind,
    start: start
  };
});
