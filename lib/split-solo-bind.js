/**
 * Splits: 100% owner checkbox hides the sheet. PRO field stays off the rows.
 */
(function (root) {
  var STORE = 'plaiground.store.draft';
  var TONE = 'plaiground.tonegrid.draft';

  function parse(raw) {
    try { return JSON.parse(raw || '{}') || {}; } catch (err) { return {}; }
  }

  function readKey(store, key) {
    try { return parse(store && store.getItem(key)); } catch (err) { return {}; }
  }

  function writeKey(store, key, draft) {
    try { if (store) store.setItem(key, JSON.stringify(draft || {})); } catch (err) {}
  }

  function patchDraft(patch) {
    function stamp(store, key) {
      if (!store) return;
      var draft = readKey(store, key);
      Object.keys(patch || {}).forEach(function (name) {
        if (patch[name] !== undefined) draft[name] = patch[name];
      });
      writeKey(store, key, draft);
    }
    try { stamp(root.localStorage, STORE); } catch (err) {}
    try { stamp(root.sessionStorage, STORE); } catch (err2) {}
    try { stamp(root.localStorage, TONE); } catch (err3) {}
    try { stamp(root.sessionStorage, TONE); } catch (err4) {}
  }

  function readSoloFlag() {
    var keys = [STORE, TONE];
    var stores = [root.localStorage, root.sessionStorage];
    var i;
    var j;
    var draft;
    for (i = 0; i < stores.length; i += 1) {
      for (j = 0; j < keys.length; j += 1) {
        draft = readKey(stores[i], keys[j]);
        if (draft.solo_owned_100 === true || draft.solo_owned_100 === 'true') return true;
        if (draft.solo_owned_100 === false || draft.solo_owned_100 === 'false') return false;
      }
    }
    return false;
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = Boolean(hidden);
    if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
    if (el.style) el.style.display = hidden ? 'none' : '';
  }

  function hideProFields(doc) {
    var fields = doc.querySelectorAll ? doc.querySelectorAll('[data-field="pro"]') : [];
    var i;
    for (i = 0; i < fields.length; i += 1) {
      var wrap = fields[i].closest ? fields[i].closest('.field') : fields[i].parentNode;
      setHidden(wrap || fields[i], true);
    }
  }

  function ensureBox(doc) {
    var existing = doc.getElementById('split-solo');
    if (existing) return existing;
    var form = doc.getElementById('sheet-form');
    if (!form || !form.parentNode) return null;
    var card = doc.createElement('section');
    card.className = 'flow-card';
    card.setAttribute('data-split-solo-card', '');
    card.innerHTML =
      '<h3>Who owns this song?</h3>' +
      '<label class="checkline" for="split-solo">' +
        '<input id="split-solo" type="checkbox" />' +
        '<span>I own 100% of this song. No split sheet.</span>' +
      '</label>' +
      '<p class="hint">Check this if you wrote and own the whole work. The split form stays hidden and nothing is sent out to sign.</p>';
    form.parentNode.insertBefore(card, form);
    return doc.getElementById('split-solo');
  }

  function ensureContinue(doc) {
    var existing = doc.querySelector('[data-solo-continue]');
    if (existing) return existing;
    var actions = doc.getElementById('sign-actions') || doc.querySelector('.flow-actions');
    if (!actions || !actions.parentNode) return null;
    var link = doc.createElement('a');
    link.className = 'btn btn-purple btn-md';
    link.href = 'review.html';
    link.setAttribute('data-solo-continue', '');
    link.textContent = 'Continue to review and pay';
    link.hidden = true;
    actions.parentNode.insertBefore(link, actions.nextSibling);
    return link;
  }

  function apply(doc, on) {
    setHidden(doc.getElementById('sheet-form'), on);
    setHidden(doc.getElementById('sign-actions'), on);
    setHidden(doc.getElementById('incomplete-alert'), on);
    setHidden(doc.getElementById('config-banner'), on);
    setHidden(doc.getElementById('embed-card'), true);
    var continueBtn = ensureContinue(doc);
    setHidden(continueBtn, !on);
    hideProFields(doc);
  }

  function bind() {
    var doc = root.document;
    if (!doc || !doc.getElementById('sheet-form')) return;
    if (doc.documentElement.getAttribute('data-split-solo-bound') === '1') return;
    doc.documentElement.setAttribute('data-split-solo-bound', '1');
    var box = ensureBox(doc);
    if (!box) return;
    var startOn = readSoloFlag();
    box.checked = startOn;
    apply(doc, startOn);
    if (startOn) patchDraft({ solo_owned_100: true, other_writers: false });
    box.addEventListener('change', function () {
      var on = Boolean(box.checked);
      patchDraft({ solo_owned_100: on, other_writers: !on });
      apply(doc, on);
    });
    var writers = doc.getElementById('writers');
    if (writers && typeof MutationObserver === 'function') {
      new MutationObserver(function () { hideProFields(doc); }).observe(writers, { childList: true, subtree: true });
    }
    hideProFields(doc);
    setTimeout(function () { hideProFields(doc); }, 300);
  }

  if (!root.document) return;
  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  if (root.addEventListener) root.addEventListener('load', bind);
})(typeof window !== 'undefined' ? window : this);
