(function (root) {
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
    if (root.PlaigroundUploadDraftFiles && typeof root.PlaigroundUploadDraftFiles.persistPickedFiles === 'function') {
      try { root.PlaigroundUploadDraftFiles.persistPickedFiles(root); } catch (err4) {}
    }
  }

  function rejectFile(input, bound, message) {
    var qc = root.PlaigroundCoverQc;
    if (qc && typeof qc.showError === 'function') qc.showError(message);
    if (bound && typeof bound.clear === 'function') bound.clear();
    if (input) input.value = '';
    stampDraft(null);
  }

  function bindCover() {
    var input = document.querySelector('[data-art-input]');
    if (!input) return;
    var picks = document.querySelectorAll('[data-art-pick]');
    var i;
    for (i = 0; i < picks.length; i += 1) {
      picks[i].addEventListener('click', function (event) {
        if (event && event.preventDefault) event.preventDefault();
        input.click();
      });
    }
    var bound = null;
    if (root.PlaigroundCoverPreview && typeof root.PlaigroundCoverPreview.bind === 'function') {
      bound = root.PlaigroundCoverPreview.bind({
        input: input,
        tile: document.querySelector('[data-art-box]'),
        note: document.querySelector('[data-art-meta]'),
        clearButton: document.querySelector('[data-art-clear]'),
        emptyNote: '3000 \u00d7 3000 px \u00b7 JPG or PNG',
        hasNote: 'Cover ready',
        accept: function (file) {
          var qc = root.PlaigroundCoverQc;
          if (qc && typeof qc.isTypeOk === 'function' && file && !qc.isTypeOk(file)) {
            if (typeof qc.showError === 'function') qc.showError(qc.TYPE_COPY);
            return false;
          }
          return true;
        },
        onChange: function (file) {
          var qc = root.PlaigroundCoverQc;
          if (!file) {
            stampDraft(null);
            return;
          }
          if (!qc || typeof qc.check !== 'function') {
            stampDraft(file);
            return;
          }
          qc.check(file).then(function (result) {
            if (!result || !result.ok) {
              rejectFile(input, bound, (result && result.error) || qc.SIZE_COPY);
              return;
            }
            if (typeof qc.showOk === 'function') qc.showOk();
            stampDraft(file, result);
          });
        }
      });
    }
    if (bound) root.PlaigroundUploadCover = bound;
    else if (root.PlaigroundCoverPreview) root.PlaigroundUploadCover = root.PlaigroundCoverPreview;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCover);
  } else {
    bindCover();
  }
})(typeof window !== 'undefined' ? window : this);
