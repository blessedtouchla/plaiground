/**
 * First submit: stamp the collected solo name onto performer + producer
 * in the draft so the hop body is not writer-only.
 */
(function (root) {
  var KEY = 'plaiground.store.draft';

  function read() {
    try {
      return JSON.parse((root.localStorage && root.localStorage.getItem(KEY)) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function write(draft) {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(draft));
    } catch (err) {}
    return draft;
  }

  function liveName() {
    var doc = root.document;
    if (!doc) return '';
    var sel = doc.getElementById('tg-artist-select');
    if (sel && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) {
      var opt = sel.options[sel.selectedIndex];
      var fromOpt = String((opt.getAttribute && opt.getAttribute('data-name')) || opt.textContent || '').trim();
      if (fromOpt && fromOpt.toLowerCase() !== 'select an artist') return fromOpt;
    }
    var hidden = doc.getElementById('tg-artist');
    if (hidden && String(hidden.value || '').trim()) return String(hidden.value).trim();
    var created = doc.getElementById('tg-artist-new');
    if (created && String(created.value || '').trim()) return String(created.value).trim();
    var edit = doc.getElementById('edit-artist');
    if (edit && String(edit.value || '').trim()) return String(edit.value).trim();
    return '';
  }

  function nameOf(draft) {
    draft = draft || {};
    var writers = Array.isArray(draft.writers) ? draft.writers : [];
    var w = writers[0] || {};
    return String(
      liveName()
      || draft.name
      || draft.artist
      || draft.artist_name
      || w.name
      || [w.first_name || w.legal_first, w.last_name || w.legal_last].filter(Boolean).join(' ')
      || [draft.legal_first, draft.legal_last].filter(Boolean).join(' ')
      || ''
    ).trim();
  }

  function stamp() {
    var draft = read();
    var name = nameOf(draft);
    if (!name) return draft;
    draft.name = name;
    draft.artist = name;
    draft.artist_name = name;
    var credits = (draft.credits && typeof draft.credits === 'object') ? draft.credits : {};
    credits.performer = credits.performer || name;
    credits.producer = credits.producer || name;
    draft.credits = credits;
    var have = Array.isArray(draft.contributors) ? draft.contributors.slice() : [];
    function add(role) {
      var i;
      for (i = 0; i < have.length; i += 1) {
        if (String((have[i] && have[i].role) || '').toLowerCase() === role.toLowerCase()) return;
      }
      have.push({ name: name, role: role });
    }
    add('Songwriter');
    add('Composer');
    add('Performer');
    add('Producer');
    draft.contributors = have;
    if (!Array.isArray(draft.writers) || !draft.writers.length) {
      draft.writers = [{ name: name }];
    }
    return write(draft);
  }

  function bind() {
    stamp();
    var btn = root.document && root.document.querySelector('[data-store-submit], [data-edit-save]');
    if (btn && !btn.getAttribute('data-solo-stamp')) {
      btn.setAttribute('data-solo-stamp', '1');
      btn.addEventListener('click', function () { stamp(); }, true);
    }
  }

  root.PlaigroundSoloCreditsStamp = { stamp: stamp };

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})(typeof window !== 'undefined' ? window : this);
