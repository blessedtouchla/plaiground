(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    var start = function () { api.mount(root.document); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var FOLDERS = [
    { id: 'profile', label: 'Profile photos', accept: 'image/jpeg,image/png,.jpg,.jpeg,.png', max: 15 * 1024 * 1024, hint: 'JPG or PNG. 15 MB or smaller.', upload: true },
    { id: 'lifestyle', label: 'Lifestyle / press photos', accept: 'image/jpeg,image/png,.jpg,.jpeg,.png', max: 15 * 1024 * 1024, hint: 'JPG or PNG. 15 MB or smaller.', upload: true },
    { id: 'covers', label: 'Cover art', accept: 'image/jpeg,image/png,.jpg,.jpeg,.png', max: 15 * 1024 * 1024, hint: 'Cover art from linked releases shows up here. You can also upload JPG or PNG.', upload: true },
    { id: 'logos', label: 'Logos / brand', accept: 'image/jpeg,image/png,.jpg,.jpeg,.png', max: 15 * 1024 * 1024, hint: 'JPG or PNG. 15 MB or smaller.', upload: true },
    { id: 'videos', label: 'Videos / clips', accept: 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov', max: 100 * 1024 * 1024, hint: 'MP4, WEBM, or MOV. 100 MB or smaller.', upload: true },
    { id: 'documents', label: 'Documents', accept: 'application/pdf,.pdf', max: 15 * 1024 * 1024, hint: 'PDF. 15 MB or smaller. Split sheets, contracts, one-sheets.', upload: true },
    { id: 'audio', label: 'Audio', accept: 'audio/wav,audio/flac,audio/mpeg,.wav,.flac,.mp3', max: 200 * 1024 * 1024, hint: 'WAV, FLAC, or MP3, or paste a master or stems link.', upload: true, link: true },
  ];

  function sampleFiles() {
    return [
      { id: 'sample-profile', folder: 'profile', name: 'Press face.jpg', use_in_epk: true, kind: 'image', source: 'upload' },
      { id: 'sample-life', folder: 'lifestyle', name: 'Studio night.jpg', use_in_epk: false, kind: 'image', source: 'upload' },
      { id: 'sample-cover', folder: 'covers', name: 'First single', use_in_epk: true, kind: 'image', source: 'release' },
      { id: 'sample-logo', folder: 'logos', name: 'Wordmark.png', use_in_epk: true, kind: 'image', source: 'upload' },
      { id: 'sample-clip', folder: 'videos', name: 'Live clip.mp4', use_in_epk: false, kind: 'video', source: 'upload' },
      { id: 'sample-doc', folder: 'documents', name: 'One-sheet.pdf', use_in_epk: false, kind: 'doc', source: 'upload' },
      { id: 'sample-audio', folder: 'audio', name: 'Stems link', use_in_epk: false, kind: 'audio', source: 'link', link: 'https://example.com/stems' },
    ];
  }

  var globalRef = typeof window !== 'undefined' ? window : globalThis;

  function wantsSample(document) {
    if (document.body && document.body.getAttribute('data-drive-sample') === '1') return true;
    try {
      return new URLSearchParams(document.location.search).get('drive_preview') === '1';
    } catch (err) {
      return false;
    }
  }

  function folderOf(folders, id) {
    var i;
    for (i = 0; i < folders.length; i += 1) if (folders[i].id === id) return folders[i];
    return folders[0] || null;
  }

  function countIn(files, id) {
    return files.filter(function (file) { return file.folder === id; }).length;
  }

  function mount(document) {
    var host = document.getElementById('artist-drive');
    if (!host) return;
    var box = host.querySelector('[data-drive-root]');
    if (!box) return;
    var state = {
      artistId: '',
      folders: FOLDERS.slice(),
      files: [],
      active: 'profile',
      sample: false,
      busy: false,
      error: '',
      renaming: '',
    };
    var layer = document.createElement('div');
    layer.className = 'drive-preview-layer';
    layer.hidden = true;
    host.appendChild(layer);

    function setError(message) {
      state.error = message || '';
      paint();
    }

    function show() { host.hidden = false; }
    function hide() { host.hidden = true; }

    function paint() {
      box.textContent = '';
      var tabs = document.createElement('div');
      tabs.className = 'drive-folders';
      tabs.setAttribute('role', 'tablist');
      state.folders.forEach(function (folder) {
        var button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-pressed', folder.id === state.active ? 'true' : 'false');
        button.textContent = folder.label + ' ' + countIn(state.files, folder.id);
        button.addEventListener('click', function () {
          state.active = folder.id;
          state.renaming = '';
          state.error = '';
          paint();
        });
        tabs.appendChild(button);
      });
      box.appendChild(tabs);
      var folder = folderOf(state.folders, state.active);
      var hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = folder && folder.hint ? folder.hint : '';
      box.appendChild(hint);
      var files = state.files.filter(function (file) { return file.folder === state.active; });
      if (!files.length) {
        var empty = document.createElement('p');
        empty.className = 'hint drive-empty';
        empty.textContent = 'Nothing in this folder yet.';
        box.appendChild(empty);
      }
      files.forEach(function (file) { box.appendChild(fileRow(file)); });
      if (folder && folder.upload) box.appendChild(uploadRow(folder));
      if (folder && folder.link) box.appendChild(linkRow());
      if (state.error) {
        var err = document.createElement('p');
        err.className = 'hint is-red';
        err.textContent = state.error;
        box.appendChild(err);
      }
    }

    function fileRow(file) {
      var row = document.createElement('div');
      row.className = 'drive-file';
      var thumb = document.createElement('div');
      thumb.className = 'drive-thumb is-' + file.folder;
      thumb.setAttribute('aria-hidden', 'true');
      if (file.preview_url) thumb.style.backgroundImage = 'url("' + String(file.preview_url).replace(/"/g, '') + '")';
      var body = document.createElement('div');
      if (state.renaming === file.id) {
        var form = document.createElement('div');
        form.className = 'drive-rename';
        var input = document.createElement('input');
        input.type = 'text';
        input.value = file.name || '';
        input.maxLength = 80;
        var save = document.createElement('button');
        save.type = 'button';
        save.className = 'btn btn-purple btn-sm';
        save.textContent = 'Save name';
        save.addEventListener('click', function () { rename(file, input.value); });
        form.appendChild(input);
        form.appendChild(save);
        body.appendChild(form);
      } else {
        var name = document.createElement('p');
        name.className = 'drive-name';
        name.textContent = file.name || 'File';
        body.appendChild(name);
      }
      var meta = document.createElement('p');
      meta.className = 'hint drive-meta';
      meta.textContent = file.source === 'release' ? 'From a linked release' : (file.source === 'link' ? 'Link' : 'Upload');
      body.appendChild(meta);
      var actions = document.createElement('div');
      actions.className = 'drive-actions';
      var tag = document.createElement('label');
      var check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = file.use_in_epk === true;
      check.addEventListener('change', function () { tagFile(file, check.checked); });
      tag.appendChild(check);
      tag.appendChild(document.createTextNode('Use in EPK'));
      actions.appendChild(tag);
      actions.appendChild(actionButton('Preview', function () { preview(file); }));
      actions.appendChild(actionButton('Rename', function () {
        state.renaming = file.id;
        paint();
      }));
      actions.appendChild(actionButton('Download', function () { download(file); }));
      actions.appendChild(actionButton(file.source === 'release' ? 'Hide' : 'Delete', function () { remove(file); }));
      body.appendChild(actions);
      row.appendChild(thumb);
      row.appendChild(body);
      return row;
    }

    function actionButton(label, onClick) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-ghost btn-sm';
      button.textContent = label;
      button.disabled = state.busy;
      button.addEventListener('click', onClick);
      return button;
    }

    function uploadRow(folder) {
      var row = document.createElement('div');
      row.className = 'drive-upload';
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = folder.accept || '';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-purple btn-sm';
      button.textContent = state.busy ? 'Uploading…' : 'Upload';
      button.disabled = state.busy;
      button.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        input.value = '';
        if (file) upload(folder, file);
      });
      row.appendChild(button);
      row.appendChild(input);
      return row;
    }

    function linkRow() {
      var row = document.createElement('div');
      row.className = 'drive-upload';
      var input = document.createElement('input');
      input.type = 'url';
      input.placeholder = 'https:// link to a master or stems';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-ghost btn-sm';
      button.textContent = 'Add link';
      button.disabled = state.busy;
      button.addEventListener('click', function () { addLink(input.value); });
      row.appendChild(input);
      row.appendChild(button);
      return row;
    }

    function sampleStop() {
      setError('This is a sample. Sign in to use your drive.');
    }

    function applyDrive(drive) {
      state.folders = drive && drive.folders && drive.folders.length ? drive.folders : FOLDERS.slice();
      state.files = drive && Array.isArray(drive.files) ? drive.files : [];
      if (!folderOf(state.folders, state.active)) state.active = state.folders[0] ? state.folders[0].id : 'profile';
      state.busy = false;
      paint();
    }

    function post(body) {
      return fetch('/api/me/artist-drive', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      });
    }

    function load() {
      state.busy = true;
      state.error = '';
      paint();
      fetch('/api/me/artist-drive?artist_id=' + encodeURIComponent(state.artistId), {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (result) {
        if (!result.ok || !result.data || !result.data.drive) {
          state.busy = false;
          setError((result.data && result.data.error) || 'We could not open this drive.');
          return;
        }
        applyDrive(result.data.drive);
      }).catch(function () {
        state.busy = false;
        setError('We could not open this drive.');
      });
    }

    function upload(folder, file) {
      if (state.sample) return sampleStop();
      if (folder.max && file.size > folder.max) {
        setError(folder.hint || 'That file is too large.');
        return;
      }
      state.busy = true;
      state.error = '';
      paint();
      post({
        op: 'mint',
        artist_id: state.artistId,
        folder: folder.id,
        filename: file.name,
        content_type: file.type,
        size: file.size,
      }).then(function (result) {
        if (!result.ok) throw new Error((result.data && result.data.error) || 'We could not start that upload.');
        var headers = result.data.headers || {};
        return fetch(result.data.upload_url, { method: 'PUT', headers: headers, body: file }).then(function (res) {
          if (!res.ok) throw new Error('We could not upload that file.');
          return result.data;
        });
      }).then(function (minted) {
        return post({
          op: 'save',
          artist_id: state.artistId,
          folder: folder.id,
          name: file.name,
          filename: file.name,
          object_key: minted.object_key,
          content_type: file.type,
          size: file.size,
        });
      }).then(function (result) {
        if (!result.ok || !result.data.drive) throw new Error((result.data && result.data.error) || 'We could not save that file.');
        applyDrive(result.data.drive);
      }).catch(function (err) {
        state.busy = false;
        setError(err && err.message ? err.message : 'We could not upload that file.');
      });
    }

    function addLink(value) {
      if (state.sample) return sampleStop();
      state.busy = true;
      paint();
      post({
        op: 'save',
        artist_id: state.artistId,
        folder: 'audio',
        name: 'Audio link',
        link: value,
      }).then(function (result) {
        if (!result.ok || !result.data.drive) {
          state.busy = false;
          setError((result.data && result.data.error) || 'That link has to be a public https address.');
          return;
        }
        state.active = 'audio';
        applyDrive(result.data.drive);
      }).catch(function () {
        state.busy = false;
        setError('We could not save that link.');
      });
    }

    function rename(file, name) {
      if (state.sample) return sampleStop();
      state.renaming = '';
      state.busy = true;
      paint();
      post({ op: 'rename', artist_id: state.artistId, id: file.id, name: name }).then(function (result) {
        if (!result.ok || !result.data.drive) {
          state.busy = false;
          setError((result.data && result.data.error) || 'We could not rename that.');
          return;
        }
        applyDrive(result.data.drive);
      }).catch(function () {
        state.busy = false;
        setError('We could not rename that.');
      });
    }

    function tagFile(file, on) {
      if (state.sample) return sampleStop();
      post({ op: 'tag', artist_id: state.artistId, id: file.id, use_in_epk: on === true }).then(function (result) {
        if (!result.ok || !result.data.drive) {
          setError((result.data && result.data.error) || 'We could not update that tag.');
          return;
        }
        applyDrive(result.data.drive);
      }).catch(function () {
        setError('We could not update that tag.');
      });
    }

    function remove(file) {
      if (state.sample) return sampleStop();
      var message = file.source === 'release'
        ? 'Hide this cover in the drive? The release stays.'
        : 'Delete this file from your drive?';
      if (typeof globalRef.confirm === 'function' && !globalRef.confirm(message)) return;
      state.busy = true;
      paint();
      post({ op: 'delete', artist_id: state.artistId, id: file.id }).then(function (result) {
        if (!result.ok || !result.data.drive) {
          state.busy = false;
          setError((result.data && result.data.error) || 'We could not delete that.');
          return;
        }
        applyDrive(result.data.drive);
      }).catch(function () {
        state.busy = false;
        setError('We could not delete that.');
      });
    }

    function openUrl(url, kind, name) {
      layer.hidden = false;
      layer.textContent = '';
      var card = document.createElement('div');
      card.className = 'drive-preview-card';
      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'btn btn-ghost btn-sm';
      close.textContent = 'Close';
      close.addEventListener('click', function () { layer.hidden = true; layer.textContent = ''; });
      card.appendChild(close);
      var title = document.createElement('p');
      title.className = 'drive-name';
      title.textContent = name || 'File';
      card.appendChild(title);
      if (kind === 'image') {
        var img = document.createElement('img');
        img.alt = '';
        img.src = url;
        card.appendChild(img);
      } else if (kind === 'video') {
        var video = document.createElement('video');
        video.controls = true;
        video.src = url;
        card.appendChild(video);
      } else if (kind === 'audio') {
        var audio = document.createElement('audio');
        audio.controls = true;
        audio.src = url;
        card.appendChild(audio);
      } else {
        var link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Open';
        card.appendChild(link);
      }
      layer.appendChild(card);
    }

    function fetchUrl(file) {
      if (file.preview_url && file.kind === 'image') return Promise.resolve(file.preview_url);
      return fetch('/api/me/artist-drive?artist_id=' + encodeURIComponent(state.artistId) + '&file=' + encodeURIComponent(file.id), {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok || !data.url) throw new Error((data && data.error) || 'We could not open that file.');
          return data.url;
        });
      });
    }

    function preview(file) {
      if (state.sample) return sampleStop();
      fetchUrl(file).then(function (url) { openUrl(url, file.kind, file.name); }).catch(function (err) {
        setError(err && err.message ? err.message : 'We could not open that file.');
      });
    }

    function download(file) {
      if (state.sample) return sampleStop();
      fetchUrl(file).then(function (url) {
        var link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.download = file.name || '';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }).catch(function (err) {
        setError(err && err.message ? err.message : 'We could not open that file.');
      });
    }

    document.addEventListener('plaiground-artist', function (event) {
      var artist = event.detail && event.detail.artist;
      if (!artist || !artist.id) {
        if (!state.sample) hide();
        return;
      }
      state.sample = false;
      state.artistId = artist.id;
      state.active = 'profile';
      show();
      load();
    });

    if (wantsSample(document)) {
      state.sample = true;
      state.folders = FOLDERS.slice();
      state.files = sampleFiles();
      show();
      paint();
    }
  }

  return { FOLDERS: FOLDERS, mount: mount, sampleFiles: sampleFiles };
});
