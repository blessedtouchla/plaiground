/**
 * Submit-page legal names, import note, and draft save.
 * Does not hop, attach, or remap Continue send.
 */
(function (root) {
  var credits = root.PlaigroundReleaseCredits || null;
  var draftFiles = root.PlaigroundUploadDraftFiles || null;

  function $(sel, doc) {
    doc = doc || root.document;
    return doc ? doc.querySelector(sel) : null;
  }

  function val(id, doc) {
    var el = (doc || root.document) && (doc || root.document).getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function setVal(id, value, doc) {
    var el = (doc || root.document) && (doc || root.document).getElementById(id);
    if (!el || value == null) return;
    if (!el.value) el.value = value;
  }

  function fillVal(id, value, doc) {
    var el = (doc || root.document) && (doc || root.document).getElementById(id);
    if (!el) return;
    el.value = value == null ? '' : String(value);
  }

  function roster() {
    var me = root.PlaigroundMembership && typeof root.PlaigroundMembership.account === 'function'
      ? root.PlaigroundMembership.account()
      : null;
    var list = me && me.profile && Array.isArray(me.profile.artists) ? me.profile.artists : [];
    return list;
  }

  function selectedArtist() {
    var pick = val('tg-artist-select');
    var name = val('tg-artist') || val('tg-artist-new');
    var found = null;
    roster().forEach(function (row) {
      if (!row) return;
      if (row.id === pick || row.artist_id === pick || row.name === pick || row.name === name) found = row;
    });
    return found;
  }

  function modeOf() {
    return val('tg-artist-mode') || 'choose';
  }

  function legalInputs(doc) {
    doc = doc || root.document;
    var first = val('tg-legal-first', doc) || val('tg-legal-first-create', doc);
    var last = val('tg-legal-last', doc) || val('tg-legal-last-create', doc);
    return { first: first, last: last };
  }

  function syncCreateLegal(doc) {
    var first = val('tg-legal-first', doc);
    var last = val('tg-legal-last', doc);
    var createFirst = (doc || root.document).getElementById('tg-legal-first-create');
    var createLast = (doc || root.document).getElementById('tg-legal-last-create');
    if (createFirst && first && !createFirst.value) createFirst.value = first;
    if (createLast && last && !createLast.value) createLast.value = last;
    if (createFirst && createFirst.value && !first) fillVal('tg-legal-first', createFirst.value, doc);
    if (createLast && createLast.value && !last) fillVal('tg-legal-last', createLast.value, doc);
  }

  function prefillLegal(doc) {
    var artist = selectedArtist();
    var fromArtist = credits && credits.artistLegal ? credits.artistLegal(artist) : { first: '', last: '' };
    var remembered = credits && credits.rememberedLegal ? credits.rememberedLegal(root) : { first: '', last: '' };
    var draft = credits && credits.readDraft ? credits.readDraft(root) : {};
    var first = (fromArtist && fromArtist.first) || draft.legal_first || remembered.first;
    var last = (fromArtist && fromArtist.last) || draft.legal_last || remembered.last;
    setVal('tg-legal-first', first, doc);
    setVal('tg-legal-last', last, doc);
    setVal('tg-legal-first-create', first, doc);
    setVal('tg-legal-last-create', last, doc);
    syncCreateLegal(doc);
  }

  function persistLegal() {
    if (!credits) return;
    syncCreateLegal();
    var legal = legalInputs();
    var artist = selectedArtist();
    credits.writeDraft({
      legal_first: legal.first,
      legal_last: legal.last,
      artist_mode: modeOf(),
      artist_id: artist && (artist.id || artist.artist_id) || '',
    }, root);
    if (legal.first && legal.last) {
      credits.rememberLegal(legal.first, legal.last, root);
      credits.writeLegalToArtist(artist && (artist.id || artist.artist_id), legal.first, legal.last, root);
    }
  }

  function collectPageFields() {
    var legal = legalInputs();
    var artist = selectedArtist();
    return {
      artist_mode: modeOf(),
      legal_first: legal.first,
      legal_last: legal.last,
      name: val('tg-artist') || val('tg-artist-new') || (artist && artist.name) || '',
      creating_artist: modeOf() === 'create',
    };
  }

  function wrapGate() {
    if (!credits || typeof credits.installUploadGate !== 'function') return;
    credits.installUploadGate(root);
    var api = root.PlaigroundUploadRequired;
    if (!api || api._uploadLegalWrap) return;
    var original = api.validateUploadPage;
    api.validateUploadPage = function (fields) {
      var extra = collectPageFields();
      var merged = Object.assign({}, fields || {}, extra);
      return original(merged);
    };
    api._uploadLegalWrap = true;
  }

  function showLegal(doc) {
    var wrap = $( '[data-artist-legal]', doc);
    var hint = $('[data-artist-legal-hint]', doc);
    var mode = modeOf();
    var hide = mode === 'link';
    if (wrap) {
      wrap.hidden = hide;
      if (wrap.classList && wrap.classList.toggle) wrap.classList.toggle('is-hidden', hide);
    }
    if (hint) {
      hint.hidden = hide;
      if (hint.classList && hint.classList.toggle) hint.classList.toggle('is-hidden', hide);
    }
  }

  function stayHere(doc) {
    var mode = (doc || root.document).getElementById('tg-artist-mode');
    if (mode) mode.value = 'choose';
    var choose = (doc || root.document).getElementById('artist-choose-wrap');
    var create = (doc || root.document).getElementById('artist-create-wrap');
    var link = (doc || root.document).getElementById('artist-link-wrap');
    if (choose) choose.hidden = false;
    if (create) create.hidden = true;
    if (link) link.hidden = true;
    showLegal(doc);
    persistLegal();
  }

  function collectSavePatch(doc) {
    doc = doc || root.document;
    var legal = legalInputs(doc);
    var instrumental = doc.getElementById('tg-instrumental');
    var files = draftFiles && typeof draftFiles.collectFileMeta === 'function'
      ? draftFiles.collectFileMeta(root)
      : {};
    return Object.assign({
      saved_draft: true,
      tonegrid_status: 'draft',
      title: val('tg-title', doc),
      name: val('tg-artist', doc) || val('tg-artist-new', doc),
      featured: val('tg-featured', doc),
      genre: val('tg-genre', doc),
      language: val('tg-language', doc),
      price: val('tg-price', doc),
      lyrics: val('tg-lyrics', doc),
      legal_first: legal.first,
      legal_last: legal.last,
      artist_mode: modeOf(),
      instrumental: Boolean(instrumental && instrumental.checked),
    }, files);
  }

  function saveDraft(goHref) {
    if (!credits) return Promise.resolve(false);
    persistLegal();
    credits.writeDraft(collectSavePatch(), root);
    var persist = draftFiles && typeof draftFiles.persistPickedFiles === 'function'
      ? draftFiles.persistPickedFiles(root)
      : Promise.resolve(null);
    return Promise.resolve(persist).then(function () {
      if (goHref && root.location) root.location.href = goHref;
      return true;
    }).catch(function () {
      if (goHref && root.location) root.location.href = goHref;
      return true;
    });
  }

  function bind(doc) {
    doc = doc || root.document;
    if (!doc || !doc.getElementById) return false;
    if (!doc.getElementById('tg-artist-mode') && !doc.querySelector('[data-upload-save-draft]')) return false;
    wrapGate();
    prefillLegal(doc);
    showLegal(doc);
    if (draftFiles && typeof draftFiles.restorePickedFiles === 'function') {
      draftFiles.restorePickedFiles(root);
    }

    function onLegal() {
      persistLegal();
    }
    ['tg-legal-first', 'tg-legal-last', 'tg-legal-first-create', 'tg-legal-last-create'].forEach(function (id) {
      var el = doc.getElementById(id);
      if (!el || !el.addEventListener) return;
      el.addEventListener('input', onLegal);
      el.addEventListener('change', onLegal);
    });
    var select = doc.getElementById('tg-artist-select');
    if (select && select.addEventListener) {
      select.addEventListener('change', function () {
        var artist = selectedArtist();
        var legal = credits && credits.artistLegal ? credits.artistLegal(artist) : { first: '', last: '' };
        if (legal.first) fillVal('tg-legal-first', legal.first, doc);
        if (legal.last) fillVal('tg-legal-last', legal.last, doc);
        persistLegal();
      });
    }
    var mode = doc.getElementById('tg-artist-mode');
    if (mode && mode.addEventListener) {
      mode.addEventListener('change', function () {
        showLegal(doc);
        persistLegal();
      });
    }
    Array.prototype.forEach.call(doc.querySelectorAll('[data-upload-save-draft]'), function (btn) {
      if (!btn || !btn.addEventListener) return;
      btn.addEventListener('click', function (event) {
        if (event && event.preventDefault) event.preventDefault();
        saveDraft('dashboard.html');
      });
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-upload-save-draft-go-artists]'), function (btn) {
      if (!btn || !btn.addEventListener) return;
      btn.addEventListener('click', function (event) {
        if (event && event.preventDefault) event.preventDefault();
        saveDraft('artists.html');
      });
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-artist-import-stay]'), function (btn) {
      if (!btn || !btn.addEventListener) return;
      btn.addEventListener('click', function (event) {
        if (event && event.preventDefault) event.preventDefault();
        stayHere(doc);
      });
    });
    if (root.PlaigroundMembership && typeof root.PlaigroundMembership.whenReady === 'function') {
      root.PlaigroundMembership.whenReady().then(function () {
        prefillLegal(doc);
      });
    }
    return true;
  }

  var api = {
    bind: bind,
    collectPageFields: collectPageFields,
    prefillLegal: prefillLegal,
    saveDraft: saveDraft,
    stayHere: stayHere,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlaigroundUploadCredits = api;
  if (root.document) {
    if (root.document.readyState === 'loading' && root.document.addEventListener) {
      root.document.addEventListener('DOMContentLoaded', function () { bind(root.document); });
    } else {
      bind(root.document);
    }
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
