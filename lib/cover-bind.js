(function (root) {
  function stampDraft(file) {
    var key = 'plaiground.store.draft';
    var draft = {};
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      if (raw) draft = JSON.parse(raw) || {};
    } catch (err) {
      return;
    }
    if (!file) return;
    if (!draft || typeof draft !== 'object') draft = {};
    draft.artwork_name = file.name || draft.artwork_name || '';
    draft.artwork_type = file.type || draft.artwork_type || '';
    draft.artwork_size = Number(file.size) || draft.artwork_size || 0;
    try {
      root.localStorage.setItem(key, JSON.stringify(draft));
    } catch (err2) {}
    if (root.PlaigroundUploadDraftFiles && typeof root.PlaigroundUploadDraftFiles.persistPickedFiles === 'function') {
      try { root.PlaigroundUploadDraftFiles.persistPickedFiles(root); } catch (err3) {}
    }
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
        onChange: function (file) { stampDraft(file); }
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
