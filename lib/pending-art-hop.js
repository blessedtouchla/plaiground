/**
 * Pending leftovers already have artwork_object_key in the draft.
 * POST that key to ToneGrid /releases/:id/artwork — same hop hung up used.
 * Does not create a release. Does not rewrite submit.
 */
(function (root) {
  if (!root || !root.fetch) return;

  function draftOf() {
    try {
      return JSON.parse((root.localStorage && root.localStorage.getItem('plaiground.store.draft')) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function pageReleaseId() {
    try {
      return String(new URLSearchParams(root.location.search).get('id') || '').trim();
    } catch (err) {
      return '';
    }
  }

  function postArtwork(id, key) {
    if (!id || !key) return;
    try {
      root.fetch('/api/tonegrid/releases/' + encodeURIComponent(id) + '/artwork', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_key: key }),
      }).catch(function () {});
    } catch (err) {}
  }

  function go() {
    var draft = draftOf();
    var pageId = pageReleaseId();
    var id = String((draft && draft.release_id) || pageId || '').trim();
    var key = String((draft && (draft.artwork_object_key || draft.cover_object_key)) || '').trim();
    if (!id || !key) return;
    if (pageId && id.toLowerCase() !== pageId.toLowerCase()) {
      id = pageId;
      if (!key) return;
    }
    if (pageId && draft && draft.release_id && String(draft.release_id).toLowerCase() !== pageId.toLowerCase()) {
      return;
    }
    postArtwork(id, key);
  }

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', go);
  } else {
    go();
  }
})(typeof window !== 'undefined' ? window : this);
