(function (global) {
  function setHidden(sel, hidden) {
    var el = document.querySelector(sel);
    if (el) el.hidden = Boolean(hidden);
  }

  function readDraft() {
    try {
      var local = global.localStorage && (global.localStorage.getItem('plaiground.store.draft') || global.localStorage.getItem('plaiground.tonegrid.draft'));
      var session = global.sessionStorage && (global.sessionStorage.getItem('plaiground.store.draft') || global.sessionStorage.getItem('plaiground.tonegrid.draft'));
      return JSON.parse(local || session || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function sheetsApi() {
    return (typeof PlaigroundSplitSheets !== 'undefined' && PlaigroundSplitSheets)
      || global.PlaigroundSplitSheets
      || null;
  }

  function realWorks(me, draft) {
    var api = sheetsApi();
    if (api && typeof api.realWorks === 'function') return api.realWorks(me, draft || readDraft());
    return [];
  }

  function render(me) {
    var works = realWorks(me, readDraft());
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
      name.textContent = work.title || 'Untitled';
      wrap.appendChild(name);
      title.appendChild(wrap);
      var writer = document.createElement('td');
      writer.textContent = work.writer || '—';
      var status = document.createElement('td');
      status.textContent = work.status_copy || work.status_label || 'no';
      tr.appendChild(title);
      tr.appendChild(writer);
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
