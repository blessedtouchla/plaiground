(function (global) {
  function isPlaceholderTitle(title) {
    var next = String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return next === 'neon sermon' || next === 'neon shadows' || next === 'neon santos';
  }

  function ownedIds(me) {
    var raw = me && Array.isArray(me.tonegrid_release_ids) ? me.tonegrid_release_ids : [];
    var have = {};
    raw.forEach(function (id) {
      var key = String(id || '').trim().toLowerCase();
      if (key) have[key] = true;
    });
    return have;
  }

  function realWorks(me) {
    var have = ownedIds(me);
    var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
    var out = [];
    var seen = {};
    stored.forEach(function (row) {
      var id = String((row && (row.tonegrid_release_id || row.id)) || '').trim().toLowerCase();
      if (!id || !have[id] || seen[id] || isPlaceholderTitle(row && row.title)) return;
      seen[id] = true;
      out.push({
        id: id,
        title: String((row && row.title) || '').trim() || 'Untitled',
      });
    });
    Object.keys(have).forEach(function (id) {
      if (seen[id]) return;
      out.push({ id: id, title: 'Untitled' });
    });
    return out;
  }

  function setHidden(sel, hidden) {
    var el = document.querySelector(sel);
    if (el) el.hidden = Boolean(hidden);
  }

  function render(me) {
    var works = realWorks(me);
    var empty = !works.length;
    setHidden('[data-splits-empty]', !empty);
    setHidden('[data-splits-table]', empty);
    var host = document.querySelector('[data-splits-rows]');
    if (!host) return;
    host.textContent = '';
    if (empty) return;
    works.forEach(function (work) {
      var tr = document.createElement('tr');
      var title = document.createElement('td');
      var wrap = document.createElement('div');
      var name = document.createElement('b');
      name.textContent = work.title;
      var meta = document.createElement('small');
      meta.style.color = 'var(--muted)';
      meta.textContent = 'Work';
      wrap.appendChild(name);
      wrap.appendChild(document.createElement('br'));
      wrap.appendChild(meta);
      title.appendChild(wrap);
      var writers = document.createElement('td');
      writers.textContent = '—';
      var signatures = document.createElement('td');
      signatures.textContent = '—';
      var status = document.createElement('td');
      status.textContent = 'Pending';
      tr.appendChild(title);
      tr.appendChild(writers);
      tr.appendChild(signatures);
      tr.appendChild(status);
      host.appendChild(tr);
    });
  }

  function loadAccount() {
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.whenReady === 'function') {
      return global.PlaigroundMembership.whenReady().then(function (result) {
        if (result && result.ok && result.data && !result.data.pending) return result.data;
        return global.PlaigroundMembership.account ? global.PlaigroundMembership.account() : null;
      });
    }
    if (typeof global.fetch !== 'function') return Promise.resolve(null);
    return global.fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.json().then(function (data) {
          return response.ok ? data : null;
        }).catch(function () { return null; });
      })
      .catch(function () { return null; });
  }

  if (document.querySelector('[data-splits-empty]') || document.querySelector('[data-splits-rows]')) {
    loadAccount().then(function (me) { render(me); });
  }

  global.PlaigroundSplits = { render: render, realWorks: realWorks };
})(window);
