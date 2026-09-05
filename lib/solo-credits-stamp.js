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

  function nameOf(draft) {
    draft = draft || {};
    var writers = Array.isArray(draft.writers) ? draft.writers : [];
    var w = writers[0] || {};
    return String(
      draft.name
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
    var credits = (draft.credits && typeof draft.credits === 'object') ? draft.credits : {};
    if (!credits.performer) credits.performer = name;
    if (!credits.producer) credits.producer = name;
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
    if (draft.solo_owned_100 === true || !draft.writers || draft.writers.length <= 1) {
      if (!Array.isArray(draft.writers) || !draft.writers.length) {
        draft.writers = [{ name: name }];
      }
    }
    return write(draft);
  }

  root.PlaigroundSoloCreditsStamp = { stamp: stamp };

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', stamp);
  } else {
    stamp();
  }
})(typeof window !== 'undefined' ? window : this);
