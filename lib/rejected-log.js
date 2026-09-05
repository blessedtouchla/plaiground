(function (root) {
  function rowsOf(me) {
    var profile = (me && me.profile) || {};
    var list = Array.isArray(profile.rejected) ? profile.rejected : [];
    return list.filter(Boolean);
  }

  function paint(list) {
    var host = root.document && root.document.querySelector('[data-rejected-list]');
    var empty = root.document && root.document.querySelector('[data-rejected-empty]');
    if (!host) return;
    host.textContent = '';
    if (!list.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    list.forEach(function (row) {
      var item = root.document.createElement('div');
      item.className = 'rejected-row';
      var title = root.document.createElement('strong');
      title.textContent = row.title || 'Untitled';
      var meta = root.document.createElement('p');
      meta.className = 'hint';
      var bits = [];
      if (row.artist) bits.push(row.artist);
      if (row.at) bits.push(String(row.at).slice(0, 10));
      meta.textContent = bits.join(' \u00b7 ') || 'QC rejected';
      var reason = root.document.createElement('p');
      reason.className = 'hint';
      reason.textContent = row.reason || 'Rejected in QC.';
      item.appendChild(title);
      item.appendChild(meta);
      item.appendChild(reason);
      host.appendChild(item);
    });
  }

  function load() {
    if (!root.fetch) return;
    root.fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (me) { paint(rowsOf(me)); })
      .catch(function () { paint([]); });
  }

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})(typeof window !== 'undefined' ? window : this);
