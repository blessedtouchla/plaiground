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
    if (modeOf() === 'create') {
      return {
        first: val('tg-legal-first-create', doc),
        last: val('tg-legal-last-create', doc),
      };
    }
    return {
      first: val('tg-legal-first', doc),
      last: val('tg-legal-last', doc),
    };
  }

  function clearWrapLegal(doc) {
    fillVal('tg-legal-first', '', doc);
    fillVal('tg-legal-last', '', doc);
  }

  function songwriterName(doc) {
    var legal = legalInputs(doc);
    return [legal.first, legal.last].filter(Boolean).join(' ');
  }

  function defaultCopyrightYear(doc) {
    var draft = credits && credits.readDraft ? credits.readDraft(root) : {};
    var raw = String((draft && (draft.copyright_year || draft.release_date)) || '').trim();
    var match = raw.match(/^(\d{4})/);
    if (match) return match[1];
    return String((root.Date ? new root.Date() : new Date()).getFullYear());
  }

  function fillIfEmpty(id, value, doc) {
    var el = (doc || root.document) && (doc || root.document).getElementById(id);
    if (!el) return;
    if (String(el.value || '').trim()) return;
    if (value == null || value === '') return;
    el.value = String(value);
  }

  function syncAutoCredit(id, name, doc) {
    var el = (doc || root.document) && (doc || root.document).getElementById(id);
    if (!el) return;
    var cur = String(el.value || '').trim();
    var prev = el.getAttribute ? el.getAttribute('data-auto-credit') : '';
    if (!cur || (prev != null && cur === prev)) {
      el.value = name || '';
      if (el.setAttribute) el.setAttribute('data-auto-credit', name || '');
    }
  }

  function restoreCredits(doc) {
    var draft = credits && credits.readDraft ? credits.readDraft(root) : {};
    var label = String((draft && draft.label) || '').trim();
    if (label && label !== 'PLAIGROUND') fillVal('tg-label', label, doc);
    else fillVal('tg-label', '', doc);
    var cOwner = String((draft && draft.copyright_holder) || '').trim();
    var pOwner = String((draft && draft.master_owner) || '').trim();
    if (cOwner && cOwner !== 'PLAIGROUND') fillVal('tg-copyright-owner', cOwner, doc);
    if (pOwner && pOwner !== 'PLAIGROUND') fillVal('tg-phonogram-owner', pOwner, doc);
    var year = String((draft && draft.copyright_year) || '').trim();
    if (year) fillVal('tg-copyright-year', year, doc);
  }

  function paintCredits(doc) {
    var name = songwriterName(doc);
    syncAutoCredit('tg-copyright-owner', name, doc);
    syncAutoCredit('tg-phonogram-owner', name, doc);
    fillIfEmpty('tg-copyright-year', defaultCopyrightYear(doc), doc);
  }

  function persistCredits(doc) {
    if (!credits) return;
    credits.writeDraft({
      label: val('tg-label', doc),
      copyright_holder: val('tg-copyright-owner', doc),
      master_owner: val('tg-phonogram-owner', doc),
      copyright_year: val('tg-copyright-year', doc),
    }, root);
  }

  function artistSavedLegal(artist) {
    var fromArtist = credits && credits.artistLegal ? credits.artistLegal(artist) : { first: '', last: '' };
    return {
      first: fromArtist && fromArtist.first ? fromArtist.first : '',
      last: fromArtist && fromArtist.last ? fromArtist.last : '',
    };
  }

  function prefillLegal(doc) {
    var mode = modeOf();
    if (mode === 'create' || mode === 'link') {
      clearWrapLegal(doc);
      return;
    }
    var artist = selectedArtist();
    var legal = artistSavedLegal(artist);
    fillVal('tg-legal-first', legal.first, doc);
    fillVal('tg-legal-last', legal.last, doc);
  }

  function persistLegal() {
    if (!credits) return;
    var legal = legalInputs();
    var artist = selectedArtist();
    var mode = modeOf();
    credits.writeDraft({
      legal_first: legal.first,
      legal_last: legal.last,
      artist_mode: mode,
      artist_id: artist && (artist.id || artist.artist_id) || '',
      label: val('tg-label'),
      copyright_holder: val('tg-copyright-owner'),
      master_owner: val('tg-phonogram-owner'),
      copyright_year: val('tg-copyright-year'),
    }, root);
    if (mode === 'create') return;
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
    var wrap = $('[data-artist-legal]', doc);
    var hint = $('[data-artist-legal-hint]', doc);
    var mode = modeOf();
    var hide = mode === 'link' || mode === 'create';
    if (wrap) {
      wrap.hidden = hide;
      if (wrap.classList && wrap.classList.toggle) wrap.classList.toggle('is-hidden', hide);
    }
    if (hint) {
      hint.hidden = hide;
      if (hint.classList && hint.classList.toggle) hint.classList.toggle('is-hidden', hide);
    }
    if (hide) clearWrapLegal(doc);
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
    prefillLegal(doc);
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
      label: val('tg-label', doc),
      copyright_holder: val('tg-copyright-owner', doc),
      master_owner: val('tg-phonogram-owner', doc),
      copyright_year: val('tg-copyright-year', doc),
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
    restoreCredits(doc);
    paintCredits(doc);
    if (draftFiles && typeof draftFiles.restorePickedFiles === 'function') {
      draftFiles.restorePickedFiles(root);
    }

    function onLegal() {
      persistLegal();
      paintCredits(doc);
    }
    ['tg-label', 'tg-copyright-owner', 'tg-phonogram-owner', 'tg-copyright-year'].forEach(function (id) {
      var el = doc.getElementById(id);
      if (!el || !el.addEventListener) return;
      el.addEventListener('input', function () { persistCredits(doc); });
      el.addEventListener('change', function () { persistCredits(doc); });
    });
    ['tg-legal-first', 'tg-legal-last', 'tg-legal-first-create', 'tg-legal-last-create'].forEach(function (id) {
      var el = doc.getElementById(id);
      if (!el || !el.addEventListener) return;
      el.addEventListener('input', onLegal);
      el.addEventListener('change', onLegal);
    });
    var select = doc.getElementById('tg-artist-select');
    if (select && select.addEventListener) {
      select.addEventListener('change', function () {
        var legal = artistSavedLegal(selectedArtist());
        fillVal('tg-legal-first', legal.first, doc);
        fillVal('tg-legal-last', legal.last, doc);
        persistLegal();
        paintCredits(doc);
      });
    }
    var mode = doc.getElementById('tg-artist-mode');
    if (mode && mode.addEventListener) {
      mode.addEventListener('change', function () {
        showLegal(doc);
        prefillLegal(doc);
        persistLegal();
        paintCredits(doc);
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
        paintCredits(doc);
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
