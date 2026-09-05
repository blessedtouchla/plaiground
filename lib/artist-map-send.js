/**
 * Send the Plaiground primary artist name to ToneGrid.
 * Create-or-continue /artists, then PUT the release with that artist_id.
 * Does not rebuild collect UI.
 */
(function (root) {
  if (!root || !root.fetch) return;

  function nameOf() {
    var el = root.document && (root.document.getElementById('edit-artist') || root.document.querySelector('[data-artist-name], [name="artist"]'));
    return String((el && el.value) || '').trim();
  }

  function releaseIdOf() {
    var panel = root.document && root.document.querySelector('[data-release-edit]');
    var fromPanel = panel && panel.getAttribute('data-release-id');
    if (fromPanel) return String(fromPanel).trim();
    try {
      return String(new URLSearchParams(root.location.search).get('id') || '').trim();
    } catch (err) {
      return '';
    }
  }

  function json(res) {
    return res.json().then(function (data) {
      return { ok: res.ok, data: data || {} };
    }).catch(function () {
      return { ok: false, data: {} };
    });
  }

  function pickId(data) {
    if (!data || typeof data !== 'object') return '';
    return String(data.uuid || data.id || data.artist_id || (data.artist && (data.artist.uuid || data.artist.id)) || '').trim();
  }

  function send() {
    var name = nameOf();
    var releaseId = releaseIdOf();
    if (!name) return Promise.resolve();
    return root.fetch('/api/tonegrid/artists', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    }).then(json).then(function (result) {
      var artistId = pickId(result.data);
      if (!artistId) return result;
      try {
        var raw = root.localStorage && root.localStorage.getItem('plaiground.store.draft');
        var draft = raw ? JSON.parse(raw) : {};
        draft.artist_id = artistId;
        draft.tonegrid_artist_id = artistId;
        draft.name = name;
        root.localStorage.setItem('plaiground.store.draft', JSON.stringify(draft));
      } catch (err) {}
      if (!releaseId) return result;
      var titleEl = root.document.getElementById('edit-title');
      var title = String((titleEl && titleEl.value) || '').trim();
      var body = { artist_id: artistId, name: name };
      if (title) body.title = title;
      return root.fetch('/api/tonegrid/releases/' + encodeURIComponent(releaseId), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(json);
    }).catch(function () {});
  }

  function bind() {
    var btn = root.document && root.document.querySelector('[data-edit-save]');
    if (btn && !btn.getAttribute('data-artist-map')) {
      btn.setAttribute('data-artist-map', '1');
      btn.addEventListener('click', function () { setTimeout(send, 400); });
    }
    if (nameOf() && releaseIdOf()) setTimeout(send, 800);
  }

  root.PlaigroundArtistMapSend = { send: send };

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})(typeof window !== 'undefined' ? window : this);
