/**
 * If a new release has no cover on the store yet, hop the held cover
 * file and POST /artwork. Does not mint a release. Does not rewrite submit.
 */
(function (root) {
  if (!root || !root.fetch) return;

  function parse(raw) {
    try { return raw ? JSON.parse(raw) : {}; } catch (err) { return {}; }
  }

  function draftOf() {
    return Object.assign(
      {},
      parse(root.localStorage && root.localStorage.getItem('plaiground.tonegrid.draft')),
      parse(root.sessionStorage && root.sessionStorage.getItem('plaiground.tonegrid.draft')),
      parse(root.localStorage && root.localStorage.getItem('plaiground.store.draft')),
      parse(root.sessionStorage && root.sessionStorage.getItem('plaiground.store.draft'))
    );
  }

  function writeDraft(patch) {
    var next = Object.assign(draftOf(), patch || {});
    try {
      if (root.localStorage) root.localStorage.setItem('plaiground.store.draft', JSON.stringify(next));
    } catch (err) {}
  }

  function postArtwork(id, key) {
    if (!id || !key) return Promise.resolve(false);
    return root.fetch('/api/tonegrid/releases/' + encodeURIComponent(id) + '/artwork', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ object_key: key })
    }).then(function (res) { return Boolean(res && res.ok); }, function () { return false; });
  }

  function paint(url) {
    if (!url || !root.document || !root.document.querySelectorAll) return;
    var tiles = root.document.querySelectorAll('[data-release-tiles] .release-tile-art, [data-song-cover], [data-art-box], [data-review-cover]');
    var i;
    var api = root.PlaigroundCoverPreview;
    for (i = 0; i < tiles.length; i += 1) {
      if (api && typeof api.paintTile === 'function') api.paintTile(tiles[i], url);
    }
  }

  function sendKey(id, key) {
    return postArtwork(id, key).then(function (ok) {
      if (!ok) return;
      writeDraft({ artwork_object_key: key });
      var hop = root.PlaigroundObjectHop;
      if (hop && typeof hop.previewUrl === 'function') {
        hop.previewUrl(key).then(function (url) {
          if (url) {
            writeDraft({ artwork_url: url });
            paint(url);
          }
        });
      }
    });
  }

  function run() {
    var draft = draftOf();
    var id = String((draft && (draft.release_id || draft.tonegrid_release_id)) || '').trim();
    var key = String((draft && (draft.artwork_object_key || draft.cover_object_key)) || '').trim();
    var hop = root.PlaigroundObjectHop;
    if (id && key) {
      sendKey(id, key);
      return;
    }
    if (!id || !hop || typeof hop.put !== 'function') return;
    var files = root.PlaigroundUploadDraftFiles;
    var held = files && typeof files.keepHeldFiles === 'function'
      ? files.keepHeldFiles(root)
      : Promise.resolve({ cover: null });
    held.then(function (got) {
      var file = got && got.cover;
      if (!file) return;
      return hop.put('cover', file).then(function (objectKey) {
        if (!objectKey) return;
        writeDraft({ artwork_object_key: objectKey });
        return sendKey(id, objectKey);
      });
    }).catch(function () {});
  }

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  setTimeout(run, 1200);
})(typeof window !== 'undefined' ? window : this);
