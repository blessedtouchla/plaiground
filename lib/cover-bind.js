(function (root) {
  var lastFile = null;

  function writeDraftPatch(patch) {
    var key = 'plaiground.store.draft';
    var draft = {};
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      if (raw) draft = JSON.parse(raw) || {};
    } catch (err) {
      draft = {};
    }
    if (!draft || typeof draft !== 'object') draft = {};
    Object.keys(patch || {}).forEach(function (name) {
      draft[name] = patch[name];
    });
    try { root.localStorage.setItem(key, JSON.stringify(draft)); } catch (err2) {}
    return draft;
  }

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

  function hopCover(file) {
    var hop = root.PlaigroundObjectHop;
    if (!file || !hop || typeof hop.put !== 'function') return;
    hop.put('cover', file).then(function (objectKey) {
      if (!objectKey) return;
      writeDraftPatch({ artwork_object_key: objectKey });
      var id = String((writeDraftPatch({}) || {}).release_id || '').trim();
      if (id && root.fetch) {
        root.fetch('/api/tonegrid/releases/' + encodeURIComponent(id) + '/artwork', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ object_key: objectKey })
        }).catch(function () {});
      }
      if (typeof hop.previewUrl === 'function') {
        hop.previewUrl(objectKey).then(function (url) {
          if (!url) return;
          writeDraftPatch({ artwork_url: url });
          var tile = root.document && (
            root.document.querySelector('[data-art-box]') ||
            root.document.querySelector('[data-song-cover]') ||
            root.document.querySelector('[data-review-cover]')
          );
          if (tile && tile.getAttribute && tile.getAttribute('data-cover-repositioning') === 'true') return;
          if (tile && root.PlaigroundCoverPreview && root.PlaigroundCoverPreview.paintTile) {
            root.PlaigroundCoverPreview.paintTile(tile, url);
          }
        });
      }
    }).catch(function () {});
  }

  function stampDraft(file, meta) {
    if (!file) {
      writeDraftPatch({ artwork_ok: false });
      return;
    }
    var patch = {
      artwork_name: file.name || '',
      artwork_type: file.type || '',
      artwork_size: Number(file.size) || 0,
      artwork_ok: true
    };
    if (meta && meta.width) patch.artwork_width = meta.width;
    if (meta && meta.height) patch.artwork_height = meta.height;
    writeDraftPatch(patch);
    holdCover(file);
    hopCover(file);
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
    s.src = 'lib/cover-qc.js?v=20261007crop1';
    s.onload = done;
    s.onerror = done;
    (document.head || document.body).appendChild(s);
  }

  var sourceFile = null;
  var exportGen = 0;

  function repositionApi() {
    return root.PlaigroundCoverReposition || null;
  }

  function sleeveTile() {
    return root.document && root.document.querySelector('[data-release-sleeve] [data-art-box]');
  }

  function quietNote() {
    var note = root.document && root.document.querySelector('[data-art-meta]');
    if (note && note.classList && note.classList.remove) note.classList.remove('is-error');
  }

  function closeReposition() {
    var api = repositionApi();
    if (api && typeof api.close === 'function') api.close();
  }

  function commitFramed(file) {
    var input = root.document && (root.document.querySelector('[data-art-input]') || root.document.getElementById('tg-art-file'));
    if (input && file) {
      input._plaigroundUserPick = false;
      input._plaigroundIgnoreChange = (input._plaigroundIgnoreChange || 0) + 1;
      input._plaigroundFile = file;
      input._plaigroundFramedFile = file;
      var replaced = false;
      try {
        var Transfer = root.DataTransfer || (typeof DataTransfer !== 'undefined' ? DataTransfer : null);
        if (Transfer) {
          var dt = new Transfer();
          if (dt.items && dt.items.add) dt.items.add(file);
          if (dt.files) input.files = dt.files;
          replaced = Boolean(input.files && input.files[0]);
        }
      } catch (err) {}
      if (!replaced) {
        try { input.value = ''; } catch (err2) {}
        input._plaigroundFile = file;
      }
      setTimeout(function () {
        input._plaigroundIgnoreChange = Math.max(0, (input._plaigroundIgnoreChange || 1) - 1);
      }, 0);
    }
    holdCover(file);
    stampDraft(file, { width: 3000, height: 3000 });
    showResize(false);
    var qc = root.PlaigroundCoverQc;
    if (qc && typeof qc.showOk === 'function') qc.showOk();
  }

  function exportFramed(file, frame) {
    var qc = root.PlaigroundCoverQc;
    if (!file || !qc || typeof qc.resize !== 'function') return Promise.reject(new Error('resize'));
    var gen = ++exportGen;
    return qc.resize(file, frame).then(function (next) {
      if (!next || gen !== exportGen || sourceFile !== file) return next;
      try { next._plaigroundFramed = true; } catch (err) {}
      commitFramed(next);
      return next;
    });
  }

  function readTileAspect(tile) {
    return new Promise(function (resolve) {
      var img = tile && tile.querySelector ? tile.querySelector('img[data-cover-photo]') : null;
      if (!img) {
        resolve(null);
        return;
      }
      var settled = false;
      function finish(ok) {
        if (settled) return;
        settled = true;
        if (!ok) {
          resolve(null);
          return;
        }
        resolve({
          img: img,
          w: img.naturalWidth || img.width || 0,
          h: img.naturalHeight || img.height || 0
        });
      }
      if (img.complete) {
        finish(Boolean(img.naturalWidth || img.width));
        return;
      }
      img.addEventListener('load', function () { finish(true); });
      img.addEventListener('error', function () { finish(false); });
      if (img.complete) finish(Boolean(img.naturalWidth || img.width));
    });
  }

  function showInvalid(input, bound, file, result) {
    var qc = root.PlaigroundCoverQc;
    holdCover(file);
    if (!qc) return;
    if (qc.showError) qc.showError((result && result.error) || qc.SIZE_COPY);
    if (typeof qc.canResize === 'function' && qc.canResize(file, result)) {
      var extra = (result && result.error) || qc.SIZE_COPY;
      qc.showError(extra + ' Tap Resize for me to make a 3000 \u00d7 3000 JPG.');
      showResize(true);
      return;
    }
    rejectType(input, bound, (result && result.error) || qc.TYPE_COPY);
  }

  var coverSettle = null;

  function bindContinueFlush() {
    var trigger = root.document && root.document.querySelector('[data-store-continue]');
    if (!trigger || !trigger.addEventListener || trigger.getAttribute('data-cover-flush') === 'true') return;
    trigger.setAttribute('data-cover-flush', 'true');
    trigger.addEventListener('click', function (event) {
      if (trigger._coverFlushHold) return;
      var api = repositionApi();
      var needsFlush = Boolean(api && typeof api.isOpen === 'function' && api.isOpen() && typeof api.isSettled === 'function' && !api.isSettled());
      var needsWait = Boolean(coverSettle && typeof coverSettle.then === 'function' && !coverSettle._coverSettled);
      if (!needsFlush && !needsWait) return;
      if (event && event.preventDefault) event.preventDefault();
      if (event && event.stopPropagation) event.stopPropagation();
      trigger._coverFlushHold = true;
      Promise.resolve(needsWait ? coverSettle : null).then(function () {
        var live = repositionApi();
        if (live && typeof live.isOpen === 'function' && live.isOpen() && typeof live.isSettled === 'function' && !live.isSettled()) {
          return live.flush();
        }
      }).then(function () {
        trigger._coverFlushHold = false;
        if (typeof trigger.click === 'function') trigger.click();
      }, function () {
        trigger._coverFlushHold = false;
        showResize(true);
        var qc = root.PlaigroundCoverQc;
        if (qc && typeof qc.showError === 'function') qc.showError(qc.RESIZE_COPY);
      });
    }, true);
  }

  function loadRosterHold() {
    if (!root.document || !root.document.getElementById('tg-artist-select')) return;
    if (root.PlaigroundArtistRosterHold) return;
    var s = root.document.createElement('script');
    s.src = 'lib/artist-roster-hold.js?v=20260915r2';
    (root.document.head || root.document.body).appendChild(s);
  }

  function bindCover() {
    var input = document.querySelector('[data-art-input]') || document.getElementById('edit-art');
    if (!input) return;
    if (input.addEventListener) {
      input.addEventListener('click', function () {
        input._plaigroundUserPick = true;
      });
    }
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
        input._plaigroundUserPick = true;
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
        var src = sourceFile || lastFile;
        if (!src || !qc || typeof qc.resize !== 'function') return;
        var api = repositionApi();
        var frame = api && typeof api.currentFrame === 'function' ? api.currentFrame() : null;
        btn.disabled = true;
        btn.textContent = 'Resizing\u2026';
        exportGen += 1;
        qc.resize(src, frame).then(function (next) {
          exportGen += 1;
          closeReposition();
          lastFile = next;
          sourceFile = next;
          holdCover(next);
          if (bound && typeof bound.showFile === 'function') bound.showFile(next);
          stampDraft(next, { width: 3000, height: 3000 });
          showResize(false);
          if (qc.showOk) qc.showOk();
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
        ignoreChange: function (file) {
          if (!input || input._plaigroundUserPick) return false;
          var framed = input._plaigroundFramedFile;
          if (!file || !framed) return false;
          if (file === framed) return true;
          var name = String(file.name || '');
          return Boolean(name && name === String(framed.name || '') && Number(file.size) === Number(framed.size));
        },
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
          if (input && input._plaigroundIgnoreChange) return;
          if (file && input && !input._plaigroundUserPick && file === input._plaigroundFramedFile) return;
          if (input) input._plaigroundUserPick = false;
          if (!file) {
            sourceFile = null;
            exportGen += 1;
            closeReposition();
            lastFile = null;
            showResize(false);
            stampDraft(null);
            return;
          }
          sourceFile = file;
          lastFile = file;
          var tile = sleeveTile();
          var aspectP = tile ? readTileAspect(tile) : Promise.resolve(null);
          var checkP = (qc && typeof qc.check === 'function') ? qc.check(file) : Promise.resolve(null);
          var job = Promise.all([aspectP, checkP]).then(function (pair) {
            if (sourceFile !== file) return;
            var aspect = pair[0];
            var result = pair[1];
            var api = repositionApi();
            var panel = root.document.querySelector('[data-cover-reposition]');
            var nonSquare = Boolean(aspect && aspect.w && aspect.h && aspect.w !== aspect.h);
            var canFrame = Boolean(
              nonSquare
              && tile
              && panel
              && api
              && typeof api.open === 'function'
              && qc
              && typeof qc.canResize === 'function'
              && qc.canResize(file, result || { error: qc.SQUARE_COPY })
            );
            if (result && result.ok) {
              exportGen += 1;
              closeReposition();
              showResize(false);
              if (typeof qc.showOk === 'function') qc.showOk();
              holdCover(file);
              stampDraft(file, result);
              return;
            }
            if (canFrame) {
              quietNote();
              showResize(false);
              var opened = api.open({
                tile: tile,
                panel: panel,
                img: aspect.img,
                width: aspect.w,
                height: aspect.h,
                window: root,
                onFrame: function (frame) {
                  return exportFramed(file, frame);
                }
              });
              if (opened) return;
            }
            if (!qc || typeof qc.check !== 'function') {
              closeReposition();
              holdCover(file);
              stampDraft(file);
              return;
            }
            showInvalid(input, bound, file, result);
          });
          job._coverSettled = false;
          job.then(function () { job._coverSettled = true; }, function () { job._coverSettled = true; });
          coverSettle = job;
        }
      });
    }
    if (bound) root.PlaigroundUploadCover = bound;
    else if (root.PlaigroundCoverPreview) root.PlaigroundUploadCover = root.PlaigroundCoverPreview;
    if (sleeveTile()) {
      bindContinueFlush();
      var clearBtn = root.document.querySelector('[data-art-clear]');
      if (clearBtn && clearBtn.addEventListener && !clearBtn.getAttribute('data-reposition-clear')) {
        clearBtn.setAttribute('data-reposition-clear', 'true');
        clearBtn.addEventListener('click', function () {
          sourceFile = null;
          exportGen += 1;
          closeReposition();
        }, true);
      }
    }
  }
  function start() {
    if (document.documentElement && document.documentElement.getAttribute('data-cover-bound') === 'true') return;
    if (document.documentElement && document.documentElement.setAttribute) {
      document.documentElement.setAttribute('data-cover-bound', 'true');
    }
    withQc(bindCover);
    loadRosterHold();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(typeof window !== 'undefined' ? window : this);
