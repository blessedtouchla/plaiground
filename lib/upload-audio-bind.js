/**
 * Single Upload audio pick: after the hidden input changes, show the filename
 * and player. Same paint album rows already use via bindTrackAudio.
 * Does not hop. Does not submit. Does not rewrite store-client.
 */
(function (root) {
  if (!root || !root.document) return;

  function $(sel, node) {
    return (node || root.document).querySelector(sel);
  }

  function reject(msg) {
    var status = root.document.getElementById('tg-status');
    if (!status) return;
    status.hidden = false;
    status.textContent = msg || 'Audio must be WAV, FLAC, or MP3.';
  }

  function clearReject() {
    var status = root.document.getElementById('tg-status');
    if (!status) return;
    status.hidden = true;
    status.textContent = '';
  }

  function paint(rootEl, file) {
    if (!rootEl || !file) return;
    var preview = $('[data-audio-preview]', rootEl);
    var nameEl = $('[data-audio-name]', rootEl);
    var metaEl = $('[data-audio-meta]', rootEl);
    var player = $('[data-audio-player]', rootEl);
    var hint = $('[data-audio-preview-hint]');
    var input = $('[data-audio-input]', rootEl);
    if (nameEl) nameEl.textContent = file.name || 'Audio file';
    if (metaEl) {
      var mb = file.size ? (Math.max(0.1, file.size / (1024 * 1024))).toFixed(1) + ' MB' : '';
      metaEl.textContent = [file.type || 'Audio', mb].filter(Boolean).join(' · ');
    }
    if (preview) preview.hidden = false;
    if (hint) hint.hidden = false;
    if (input) input._plaigroundFile = file;
    if (player && root.URL && typeof root.URL.createObjectURL === 'function') {
      try {
        if (player._plaigroundUrl) root.URL.revokeObjectURL(player._plaigroundUrl);
      } catch (err) {}
      try {
        var url = root.URL.createObjectURL(file);
        player._plaigroundUrl = url;
        player.src = url;
      } catch (err) {}
    }
    var hold = root.PlaigroundUploadDraftFiles;
    if (hold && typeof hold.persistPickedFiles === 'function') {
      try { hold.persistPickedFiles(root); } catch (err) {}
    }
  }

  function take(file) {
    if (!file) return;
    var accept = root.PlaigroundAudioAccept;
    var check = accept && typeof accept.fileLooksAllowed === 'function'
      ? accept.fileLooksAllowed(file)
      : Promise.resolve(true);
    Promise.resolve(check).then(function (ok) {
      if (!ok) {
        reject((accept && accept.ERROR) || 'Audio must be WAV, FLAC, or MP3.');
        return;
      }
      clearReject();
      paint($('[data-single-audio]') || root.document, file);
    });
  }

  function bind() {
    var rootEl = $('[data-single-audio]');
    if (!rootEl || rootEl._plaigroundAudioBound) return;
    rootEl._plaigroundAudioBound = true;
    var input = $('[data-audio-input]', rootEl);
    var drop = $('[data-audio-drop]', rootEl);
    var play = $('[data-audio-play]', rootEl);
    var player = $('[data-audio-player]', rootEl);
    if (input) {
      input.addEventListener('change', function () {
        take((input.files && input.files[0]) || input._plaigroundFile);
      });
    }
    if (drop) {
      drop.addEventListener('dragover', function (event) {
        event.preventDefault();
        drop.classList.add('is-over');
      });
      drop.addEventListener('dragleave', function () {
        drop.classList.remove('is-over');
      });
      drop.addEventListener('drop', function (event) {
        event.preventDefault();
        drop.classList.remove('is-over');
        var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (file && input) {
          try {
            var dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
          } catch (err) {}
          input._plaigroundFile = file;
        }
        take(file);
      });
    }
    if (play && player) {
      play.addEventListener('click', function (event) {
        event.preventDefault();
        try {
          if (player.paused) player.play();
          else player.pause();
        } catch (err) {}
      });
    }
  }

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})(typeof window !== 'undefined' ? window : this);
