/**
 * New release leave actions.
 *
 * Cancel leaves the form and lands on Overview.
 * Start over wipes the in-progress new-release form and stays on it.
 * Does not submit, hop, or attach.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    root.PlaigroundUploadLeave = api;
    if (root.document) api.bind(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var DRAFT_KEY = 'plaiground.store.draft';
  var AUDIO_HOLD_DB = 'plaiground-held-audio';
  var START_OVER_CONFIRM = 'Start over? This clears the new-release form.';
  var OVERVIEW_HREF = 'dashboard.html';
  var TEXT_IDS = [
    'tg-title',
    'tg-featured',
    'tg-genre',
    'tg-language',
    'tg-price',
    'tg-lyrics',
    'tg-artist',
    'tg-artist-new',
    'tg-artist-select',
    'tg-artist-link',
    'tg-artist-link-name',
    'tg-album-count',
  ];
  var DRAFT_MARKS = [
    'title',
    'name',
    'featured',
    'genre',
    'language',
    'price',
    'lyrics',
    'audio_name',
    'artwork_name',
    'artwork_url',
    'artwork_object_key',
    'artist_id',
    'release_id',
    'track_id',
    'album_count',
    'made_how',
    'human',
    'attest',
  ];

  function pageFile(location) {
    try {
      var path = String((location && location.pathname) || (location && location.href) || '');
      return path.split('?')[0].split('#')[0].split('/').pop() || '';
    } catch (err) {
      return '';
    }
  }

  function isNewReleasePage(doc, location) {
    if (pageFile(location) === 'upload.html') return true;
    if (!doc || typeof doc.querySelector !== 'function') return false;
    return Boolean(doc.querySelector('[data-upload-start-over]') || doc.querySelector('[data-audio-drop]'));
  }

  function readDraft(win) {
    var raw = '';
    try {
      if (win.localStorage && typeof win.localStorage.getItem === 'function') {
        raw = win.localStorage.getItem(DRAFT_KEY) || '';
      }
    } catch (err) {}
    if (!raw) {
      try {
        if (win.sessionStorage && typeof win.sessionStorage.getItem === 'function') {
          raw = win.sessionStorage.getItem(DRAFT_KEY) || '';
        }
      } catch (err2) {}
    }
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (err3) {
      return {};
    }
  }

  function draftIsFilled(draft) {
    if (!draft || typeof draft !== 'object') return false;
    var i;
    for (i = 0; i < DRAFT_MARKS.length; i += 1) {
      var value = draft[DRAFT_MARKS[i]];
      if (value == null || value === '' || value === false) continue;
      if (Array.isArray(value) && !value.length) continue;
      return true;
    }
    if (draft.explicit === true) return true;
    if (draft.instrumental === true) return true;
    if (draft.dsps_all === false) return true;
    if (Array.isArray(draft.dsps) && draft.dsps.length) return true;
    if (Array.isArray(draft.tracks) && draft.tracks.length) return true;
    return false;
  }

  function elFilled(el) {
    if (!el) return false;
    if (el.type === 'checkbox' || el.type === 'radio') return Boolean(el.checked);
    if (el.type === 'file') {
      if (el.files && el.files[0]) return true;
      if (el._plaigroundFile) return true;
      return false;
    }
    return String(el.value || '').trim() !== '';
  }

  function hasUnsaved(win) {
    var doc = win.document;
    if (draftIsFilled(readDraft(win))) return true;
    if (!doc || typeof doc.getElementById !== 'function') return false;
    var i;
    for (i = 0; i < TEXT_IDS.length; i += 1) {
      if (elFilled(doc.getElementById(TEXT_IDS[i]))) return true;
    }
    if (elFilled(doc.getElementById('tg-instrumental'))) return true;
    var audio = doc.querySelector ? doc.querySelector('[data-audio-input]') : null;
    var art = doc.querySelector ? doc.querySelector('[data-art-input]') : null;
    if (elFilled(audio) || elFilled(art)) return true;
    var preview = doc.querySelector ? doc.querySelector('[data-audio-preview]') : null;
    if (preview && !preview.hidden) return true;
    var explicitYes = doc.querySelector ? doc.querySelector('[data-explicit="true"]') : null;
    if (explicitYes && explicitYes.classList && explicitYes.classList.contains('on')) return true;
    var storeAll = doc.querySelector ? doc.querySelector('[data-store-all]') : null;
    if (storeAll && storeAll.checked === false) return true;
    var typeInputs = doc.querySelectorAll ? doc.querySelectorAll('.typeahead-input') : [];
    for (i = 0; i < typeInputs.length; i += 1) {
      if (elFilled(typeInputs[i])) return true;
    }
    return false;
  }

  function removeDraft(win) {
    try {
      if (win.localStorage && typeof win.localStorage.removeItem === 'function') {
        win.localStorage.removeItem(DRAFT_KEY);
      }
    } catch (err) {}
    try {
      if (win.sessionStorage && typeof win.sessionStorage.removeItem === 'function') {
        win.sessionStorage.removeItem(DRAFT_KEY);
      }
    } catch (err2) {}
    try {
      var idb = win.indexedDB || (typeof indexedDB !== 'undefined' ? indexedDB : null);
      if (idb && typeof idb.deleteDatabase === 'function') idb.deleteDatabase(AUDIO_HOLD_DB);
    } catch (err3) {}
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = Boolean(hidden);
    if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
  }

  function resetField(el) {
    if (!el) return;
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = false;
      return;
    }
    if (el.type === 'file') {
      try { el.value = ''; } catch (err) {}
      el._plaigroundFile = null;
      try {
        if (el.files && typeof DataTransfer !== 'undefined') {
          el.files = new DataTransfer().files;
        }
      } catch (err2) {}
      return;
    }
    if (el.tagName === 'SELECT') {
      el.value = '';
      el.selectedIndex = 0;
      return;
    }
    el.value = '';
  }

  function wipeForm(win) {
    var doc = win.document;
    removeDraft(win);
    if (!doc) return;
    var i;
    for (i = 0; i < TEXT_IDS.length; i += 1) {
      resetField(doc.getElementById(TEXT_IDS[i]));
    }
    resetField(doc.getElementById('tg-instrumental'));
    resetField(doc.querySelector ? doc.querySelector('[data-audio-input]') : null);
    resetField(doc.querySelector ? doc.querySelector('[data-art-input]') : null);
    var mode = doc.getElementById('tg-artist-mode');
    if (mode) {
      mode.value = 'choose';
      if (mode.options && mode.options.length) mode.selectedIndex = 0;
    }
    var typeInputs = doc.querySelectorAll ? doc.querySelectorAll('.typeahead-input') : [];
    for (i = 0; i < typeInputs.length; i += 1) resetField(typeInputs[i]);
    var preview = doc.querySelector ? doc.querySelector('[data-audio-preview]') : null;
    var drop = doc.querySelector ? doc.querySelector('[data-audio-drop]') : null;
    var nameEl = doc.querySelector ? doc.querySelector('[data-audio-name]') : null;
    var metaEl = doc.querySelector ? doc.querySelector('[data-audio-meta]') : null;
    var player = doc.querySelector ? doc.querySelector('[data-audio-player]') : null;
    var playBtn = doc.querySelector ? doc.querySelector('[data-audio-play]') : null;
    var previewHint = doc.querySelector ? doc.querySelector('[data-audio-preview-hint]') : null;
    if (player) {
      try { if (typeof player.pause === 'function') player.pause(); } catch (err) {}
      if (player.removeAttribute) player.removeAttribute('src');
      else player.src = '';
      if (typeof player.load === 'function') player.load();
    }
    if (nameEl) nameEl.textContent = 'No file selected';
    if (metaEl) metaEl.textContent = 'WAV, FLAC, or MP3 · 16-bit or higher';
    if (playBtn) {
      playBtn.textContent = '▶';
      if (playBtn.setAttribute) playBtn.setAttribute('aria-label', 'Play');
    }
    setHidden(preview, true);
    setHidden(previewHint, true);
    setHidden(drop, false);
    if (win.PlaigroundUploadCover && typeof win.PlaigroundUploadCover.clear === 'function') {
      win.PlaigroundUploadCover.clear();
    }
    var artMeta = doc.querySelector ? doc.querySelector('[data-art-meta]') : null;
    if (artMeta) artMeta.textContent = '3000 × 3000 px · JPG or PNG';
    var lyricsField = doc.querySelector ? doc.querySelector('[data-lyrics-field]') : null;
    var lyricsOpen = doc.querySelector ? doc.querySelector('[data-lyrics-open]') : null;
    var languageField = doc.querySelector ? doc.querySelector('[data-language-field]') : null;
    setHidden(lyricsField, true);
    setHidden(lyricsOpen, false);
    if (lyricsOpen && lyricsOpen.setAttribute) lyricsOpen.setAttribute('aria-expanded', 'false');
    setHidden(languageField, false);
    var toggle = doc.querySelector ? doc.querySelector('[data-explicit-toggle]') : null;
    if (toggle && toggle.querySelectorAll) {
      var choices = toggle.querySelectorAll('[data-explicit]');
      for (i = 0; i < choices.length; i += 1) {
        var on = choices[i].getAttribute && choices[i].getAttribute('data-explicit') === 'false';
        if (choices[i].classList && choices[i].classList.toggle) choices[i].classList.toggle('on', on);
      }
    }
    var storeAll = doc.querySelector ? doc.querySelector('[data-store-all]') : null;
    if (storeAll) {
      storeAll.checked = true;
      if (storeAll.setAttribute) storeAll.setAttribute('aria-checked', 'true');
    }
    var storeList = doc.querySelector ? doc.querySelector('[data-store-list]') : null;
    setHidden(storeList, true);
    var storeSummary = doc.querySelector ? doc.querySelector('[data-store-summary]') : null;
    if (storeSummary) storeSummary.textContent = 'All stores will receive this release.';
    var status = doc.getElementById('tg-status');
    setHidden(status, true);
    if (status) status.textContent = '';
    setHidden(doc.querySelector ? doc.querySelector('[data-upload-retry-wrap]') : null, true);
    setHidden(doc.getElementById('tg-retry-wrap'), true);
    setHidden(doc.querySelector ? doc.querySelector('[data-upload-loader]') : null, true);
    setHidden(doc.querySelector ? doc.querySelector('[data-album-tracks]') : null, true);
    var trackList = doc.querySelector ? doc.querySelector('[data-track-list]') : null;
    if (trackList) trackList.textContent = '';
    var createWrap = doc.getElementById('artist-create-wrap');
    var linkWrap = doc.getElementById('artist-link-wrap');
    var chooseWrap = doc.getElementById('artist-choose-wrap');
    setHidden(createWrap, true);
    setHidden(linkWrap, true);
    setHidden(chooseWrap, false);
  }

  function blankNewReleaseHref(location) {
    var search = '';
    try { search = String((location && location.search) || ''); } catch (err) {}
    if (!search && location && location.href) {
      var qAt = String(location.href).indexOf('?');
      if (qAt !== -1) search = String(location.href).slice(qAt).split('#')[0];
    }
    var type = '';
    try {
      type = new URLSearchParams(search).get('type') || '';
    } catch (err2) {}
    if (type === 'album') return 'upload.html?type=album&new=1';
    return 'upload.html?new=1';
  }

  function go(win, href) {
    try {
      if (win.location) win.location.href = href;
    } catch (err) {}
    return href;
  }

  function confirmStartOver(win) {
    if (!hasUnsaved(win)) return true;
    try {
      if (typeof win.confirm === 'function') return Boolean(win.confirm(START_OVER_CONFIRM));
    } catch (err) {}
    return true;
  }

  function leaveToOverview(event, win) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopImmediatePropagation) event.stopImmediatePropagation();
    if (event && event.stopPropagation) event.stopPropagation();
    return go(win, OVERVIEW_HREF);
  }

  function startOver(event, win) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopImmediatePropagation) event.stopImmediatePropagation();
    if (event && event.stopPropagation) event.stopPropagation();
    if (!confirmStartOver(win)) return false;
    wipeForm(win);
    return go(win, blankNewReleaseHref(win.location));
  }

  function bind(win) {
    win = win || (typeof window !== 'undefined' ? window : null);
    if (!win || !win.document) return false;
    var doc = win.document;
    if (!isNewReleasePage(doc, win.location)) return false;
    if (doc.documentElement && doc.documentElement.getAttribute && doc.documentElement.getAttribute('data-upload-leave-bound') === 'true') {
      return true;
    }
    if (doc.documentElement && doc.documentElement.setAttribute) {
      doc.documentElement.setAttribute('data-upload-leave-bound', 'true');
    }
    var cancelBtn = doc.querySelector('[data-upload-cancel]');
    var startBtn = doc.querySelector('[data-upload-start-over]');
    if (cancelBtn && cancelBtn.addEventListener) {
      cancelBtn.addEventListener('click', function (event) {
        leaveToOverview(event, win);
      }, true);
    }
    if (startBtn && startBtn.addEventListener) {
      startBtn.addEventListener('click', function (event) {
        startOver(event, win);
      });
    }
    return true;
  }

  return {
    DRAFT_KEY: DRAFT_KEY,
    START_OVER_CONFIRM: START_OVER_CONFIRM,
    OVERVIEW_HREF: OVERVIEW_HREF,
    isNewReleasePage: isNewReleasePage,
    hasUnsaved: hasUnsaved,
    wipeForm: wipeForm,
    blankNewReleaseHref: blankNewReleaseHref,
    leaveToOverview: leaveToOverview,
    startOver: startOver,
    bind: bind,
  };
});
