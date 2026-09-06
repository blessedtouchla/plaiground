/**
 * Keep created artist names on the choose-artist list.
 * Profile roster is the source; this only adds names we already typed.
 */
(function (root) {
  var KEY = 'plaiground.roster.artists';

  function parse(raw) {
    try { return raw ? JSON.parse(raw) : []; } catch (err) { return []; }
  }

  function load() {
    return parse(root.localStorage && root.localStorage.getItem(KEY)).filter(function (row) {
      return row && row.name;
    });
  }

  function save(list) {
    try { root.localStorage.setItem(KEY, JSON.stringify(list || [])); } catch (err) {}
  }

  function remember(name, id) {
    name = String(name || '').trim();
    if (!name) return;
    var list = load();
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (String(list[i].name).toLowerCase() === name.toLowerCase()) {
        if (id) list[i].id = id;
        save(list);
        return;
      }
    }
    list.push({ id: String(id || name), name: name });
    save(list);
  }

  function fromDraft() {
    try {
      var draft = JSON.parse((root.localStorage && root.localStorage.getItem('plaiground.store.draft')) || '{}') || {};
      remember(draft.name || draft.artist_name || draft.artist, draft.artist_id || draft.tonegrid_artist_id);
    } catch (err) {}
  }

  function paintSelect() {
    var sel = root.document && root.document.getElementById('tg-artist-select');
    if (!sel) return;
    var have = {};
    var i;
    for (i = 0; i < sel.options.length; i += 1) {
      have[String(sel.options[i].textContent || '').trim().toLowerCase()] = true;
    }
    load().forEach(function (row) {
      var key = String(row.name || '').trim().toLowerCase();
      if (!key || have[key]) return;
      var opt = root.document.createElement('option');
      opt.value = row.id || row.name;
      if (opt.setAttribute) opt.setAttribute('data-name', row.name);
      opt.textContent = row.name;
      sel.appendChild(opt);
      have[key] = true;
    });
  }

  function watchCreate() {
    var input = root.document && root.document.getElementById('tg-artist-new');
    if (!input || input.getAttribute('data-roster-hold')) return;
    input.setAttribute('data-roster-hold', '1');
    input.addEventListener('change', function () { remember(input.value); paintSelect(); });
    input.addEventListener('blur', function () { remember(input.value); paintSelect(); });
  }

  function go() {
    fromDraft();
    watchCreate();
    paintSelect();
  }

  root.PlaigroundArtistRosterHold = { remember: remember, paint: paintSelect };

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', go);
  } else {
    go();
  }
  setTimeout(go, 600);
  setTimeout(go, 1600);
})(typeof window !== 'undefined' ? window : this);
