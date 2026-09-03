/**
 * Chinasa hop for Pending Edit leftovers.
 * After submitEdit / applyImmediateEdit writes artwork_object_key,
 * POST it to /api/tonegrid/releases/:id/artwork. Same call hung up used.
 */
(function (root) {
  if (!root || !root.fetch) return;

  function readDraft() {
    try {
      return JSON.parse((root.localStorage && root.localStorage.getItem('plaiground.store.draft')) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function pageId() {
    try {
      return String(new URLSearchParams(root.location.search).get('id') || '').trim();
    } catch (err) {
      return '';
    }
  }

  function postArtwork(id, key) {
    if (!id || !key) return Promise.resolve();
    return root.fetch('/api/tonegrid/releases/' + encodeURIComponent(id) + '/artwork', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ object_key: key }),
    }).then(function () {}, function () {});
  }

  function attachFromDraft() {
    var draft = readDraft();
    var id = String((draft && draft.release_id) || pageId() || '').trim();
    var key = String((draft && (draft.artwork_object_key || draft.cover_object_key)) || '').trim();
    var want = pageId();
    if (want && id && want.toLowerCase() !== id.toLowerCase()) return Promise.resolve();
    if (want) id = want;
    return postArtwork(id, key);
  }

  function wrapSubmit() {
    var song = root.PlaigroundSong;
    if (!song || typeof song.submitEdit !== 'function' || song.submitEdit._plaigroundArtWrapped) return;
    var orig = song.submitEdit;
    function wrapped() {
      return Promise.resolve(orig.apply(song, arguments)).then(function (result) {
        var draft = readDraft();
        var id = String((result && result.releaseId) || (draft && draft.release_id) || pageId() || '').trim();
        var key = String((draft && (draft.artwork_object_key || draft.cover_object_key)) || '').trim();
        return postArtwork(id, key).then(function () { return result; });
      });
    }
    wrapped._plaigroundArtWrapped = true;
    song.submitEdit = wrapped;
  }

  function start() {
    wrapSubmit();
    attachFromDraft();
    setTimeout(wrapSubmit, 400);
  }

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  if (root.addEventListener) root.addEventListener('load', wrapSubmit);
})(typeof window !== 'undefined' ? window : this);
