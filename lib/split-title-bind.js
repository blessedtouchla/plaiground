/**
 * Splits already has the song name from Upload.
 * Fill #song-title from plaiground.store.draft and hide the extra ask.
 */
(function (root) {
  var STORE = 'plaiground.store.draft';
  var TONE = 'plaiground.tonegrid.draft';

  function parse(raw) {
    try {
      return JSON.parse(raw || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function readKey(store, key) {
    try {
      return parse(store.getItem(key));
    } catch (err) {
      return {};
    }
  }

  function writeKey(store, key, draft) {
    try {
      store.setItem(key, JSON.stringify(draft || {}));
    } catch (err) {}
  }

  function titleOf(draft) {
    return String((draft && (draft.title || draft.songTitle || draft.song_title)) || '').trim();
  }

  function uploadTitle() {
    var title = '';
    try {
      if (root.sessionStorage) title = titleOf(readKey(root.sessionStorage, STORE)) || titleOf(readKey(root.sessionStorage, TONE));
    } catch (err) {}
    if (title) return title;
    try {
      if (root.localStorage) title = titleOf(readKey(root.localStorage, STORE)) || titleOf(readKey(root.localStorage, TONE));
    } catch (err2) {}
    return title;
  }

  function stampTonegrid(title) {
    if (!title) return;
    function stamp(store) {
      if (!store) return;
      var draft = readKey(store, TONE);
      if (!titleOf(draft)) {
        draft.title = title;
        draft.songTitle = title;
        writeKey(store, TONE, draft);
      }
    }
    try { stamp(root.sessionStorage); } catch (err) {}
    try { stamp(root.localStorage); } catch (err2) {}
  }

  function hideField(input) {
    var field = input.closest ? input.closest('.field') : input.parentNode;
    if (!field) return;
    field.hidden = true;
    if (field.classList && field.classList.add) field.classList.add('is-hidden');
    field.style.display = 'none';
  }

  function bind() {
    var doc = root.document;
    if (!doc) return;
    var input = doc.getElementById('song-title');
    if (!input) return;
    var title = uploadTitle();
    if (!title) return;
    if (!String(input.value || '').trim()) input.value = title;
    stampTonegrid(title);
    hideField(input);
    input.setAttribute('data-from-upload', 'true');
  }

  if (!root.document) return;
  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  root.addEventListener && root.addEventListener('load', bind);
})(typeof window !== 'undefined' ? window : this);
