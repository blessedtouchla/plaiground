(function (root) {
  var lastFile = null;

  function holdCover(file) {
    var files = root.PlaigroundUploadDraftFiles;
    if (!files) return;
    try {
      if (file && typeof files.persistCoverFile === 'function') files.persistCoverFile(root, file);
      else if (typeof files.persistPickedFiles === 'function') files.persistPickedFiles(root);
    } catch (err) {}
    if (file && root.PlaigroundStoreClient && typeof root.PlaigroundStoreClient.rememberArtworkFile === 'function') {
      try { root.PlaigroundStoreClient.rememberArtworkFile(file); } catch (err2) {}
    }
  }

  function stampDraft(file, meta) {
    var key = 'plaiground.store.draft';
    var draft = {};
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      if (raw) draft = JSON.parse(raw) || {};
    } catch (err) {
      return;
    }
    if (!draft || typeof draft !== 'object') draft = {};
    if (!file) {
      draft.artwork_ok = false;
      try { root.localStorage.setItem(key, JSON.stringify(draft)); } catch (err2) {}
      return;
    }
    draft.artwork_name = file.name || draft.artwork_name || '';
    draft.artwork_type = file.type || draft.artwork_type || '';
    draft.artwork_size = Number(file.size) || draft.artwork_size || 0;
    draft.artwork_ok = true;
    if (meta && meta.width) draft.artwork_width = meta.width;
    if (meta && meta.height) draft.artwork_height = meta.height;
    try {
      root.localStorage.setItem(key, JSON.stringify(draft));
    } catch (err3) {}
    holdCover(file);
  }

  function resizeBtn() {
    return root.document && root.document.querySelector('[data-art-resize]');
  }

  function ensureResizeBtn() {
    var existing = resizeBtn();
    if (existing) return existing;
    var clear = root.document && root.document.querySelector('[data-art-clear]');
    var host = clear && clear.parentNode;
    if (!host || !root.document.createElement) return null;
    var btn = root.document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-purple btn-sm';
    btn.setAttribute('data-art-resize', '');
    btn.hidden = true;
    btn.textContent = 'Resize for me';
    if (clear.nextSibling) host.insertBefore(btn, clear.nextSibling);
    else host.appendChild(btn);
    return btn;
  }

  function showResize(on) {
    var btn = ensureResizeBtn();
    if (!btn) return;
    btn.hidden = !on;
    btn.disabled = false;
    btn.textContent = 'Resize for me';
  }

  function rejectType(input, bound, message) {
    var qc = root.PlaigroundCoverQc;
    if (qc && typeof qc.showError === 'function') qc.showError(message);
    showResize(false);
    lastFile = null;
    if (bound && typeof bound.clear === 'function') bound.clear();
    if (input) input.value = '';
    stampDraft(null);
  }

  function withQc(done) {
    if (root.PlaigroundCoverQc && typeof root.PlaigroundCoverQc.resize === 'function') {
      done();
      return;
    }
    if (typeof document === 'undefined' || !document.createElement) {
      done();
      return;
    }
    var s = document.createElement('script');
    s.src = 'lib/cover-qc.js?v=20260905c2';
    s.onload = done;
    s.onerror = done;
    (document.head || document.body).appendChild(s);
  }

  function bindCover() {
    var input = document.querySelector('[data-art-input]') || document.getElementById('edit-art');
    if (!input) return;
    var picks = document.querySelectorAll('[data-art-pick]');
    var i;
    for (i = 0; i < picks.length; i += 1) {
      picks[i].addEventListener('click', function (event) {
        var node = event && event.target;
        while (node && node !== document) {
          if (node.getAttribute && (
            node.getAttribute('data-upload-start-over') != null ||
            node.getAttribute('data-upload-cancel') != null ||
            node.getAttribute('data-upload-save-draft') != null
          )) return;
          node = node.parentNode;
        }
        if (event && event.preventDefault) event.preventDefault();
        input.click();
      });
    }
    var bound = null;
    var btn = ensureResizeBtn();
    if (btn && !btn.getAttribute('data-bound') && btn.addEventListener) {
      btn.setAttribute('data-bound', 'true');
      btn.addEventListener('click', function (event) {
        if (event && event.preventDefault) event.preventDefault();
        var qc = root.PlaigroundCoverQc;
        if (!lastFile || !qc || typeof qc.resize !== 'function') return;
        btn.disabled = true;
        btn.textContent = 'Resizing\u2026';
        qc.resize(lastFile).then(function (next) {
          lastFile = next;
          holdCover(next);
          if (bound && typeof bound.showFile === 'function') bound.showFile(next);
          else if (qc.check) {
            return qc.check(next).then(function (result) {
              if (result && result.ok) {
                qc.showOk();
                stampDraft(next, result);
                showResize(false);
              }
            });
          }
        }).catch(function (err) {
          if (qc && typeof qc.showError === 'function') {
            qc.showError((err && err.message) || qc.RESIZE_COPY);
          }
          btn.disabled = false;
          btn.textContent = 'Resize for me';
        });
      });
    }
    if (root.PlaigroundCoverPreview && typeof root.PlaigroundCoverPreview.bind === 'function') {
      bound = root.PlaigroundCoverPreview.bind({
        input: input,
        tile: document.querySelector('[data-art-box]') || document.querySelector('[data-song-cover]'),
        note: document.querySelector('[data-art-meta]'),
        clearButton: document.querySelector('[data-art-clear]'),
        emptyNote: '3000 \u00d7 3000 px \u00b7 JPG or PNG',
        hasNote: 'Cover ready',
        accept: function (file) {
          var qc = root.PlaigroundCoverQc;
          if (qc && typeof qc.isTypeOk === 'function' && file && !qc.isTypeOk(file)) {
            if (typeof qc.showError === 'function') qc.showError(qc.TYPE_COPY);
            showResize(false);
            return false;
          }
          return true;
        },
        onChange: function (file) {
          var qc = root.PlaigroundCoverQc;
          if (!file) {
            lastFile = null;
            showResize(false);
            stampDraft(null);
            return;
          }
          lastFile = file;
          holdCover(file);
          if (!qc || typeof qc.check !== 'function') {
            stampDraft(file);
            return;
          }
          qc.check(file).then(function (result) {
            if (!result || !result.ok) {
              if (qc.showError) qc.showError((result && result.error) || qc.SIZE_COPY);
              if (typeof qc.canResize === 'function' && qc.canResize(file, result)) {
                var extra = (result && result.error) || qc.SIZE_COPY;
                qc.showError(extra + ' Tap Resize for me to make a 3000 \u00d7 3000 JPG.');
                showResize(true);
                return;
              }
              rejectType(input, bound, (result && result.error) || qc.TYPE_COPY);
              return;
            }
            showResize(false);
            if (typeof qc.showOk === 'function') qc.showOk();
            stampDraft(file, result);
          });
        }
      });
    }
    if (bound) root.PlaigroundUploadCover = bound;
    else if (root.PlaigroundCoverPreview) root.PlaigroundUploadCover = root.PlaigroundCoverPreview;
  }
  function start() {
    if (document.documentElement && document.documentElement.getAttribute('data-cover-bound') === 'true') return;
    if (document.documentElement && document.documentElement.setAttribute) {
      document.documentElement.setAttribute('data-cover-bound', 'true');
    }
    withQc(bindCover);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(typeof window !== 'undefined' ? window : this);
