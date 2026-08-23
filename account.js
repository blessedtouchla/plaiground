(function (global) {
  function $(sel) {
    return document.querySelector(sel);
  }

  function $all(sel) {
    return document.querySelectorAll(sel);
  }

  function firstName(artist) {
    var parts = String(artist || '').trim().split(/\s+/).filter(Boolean);
    return parts[0] || '';
  }

  function initials(artist) {
    var parts = String(artist || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'PG';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function planLabel(plan) {
    var next = String(plan || '').trim().toLowerCase();
    if (next === 'pro') return 'PRO';
    if (next === 'creator') return 'CREATOR';
    if (next === 'basic') return 'BASIC';
    return '—';
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function fillAccount(me) {
    if (!me) return;
    var artist = String(me.artist || '').trim();
    var first = firstName(artist);
    var who = first ? 'Hi ' + first + '!' : 'Hi there';
    $all('[data-account-who]').forEach(function (el) { setText(el, who); });
    $all('[data-account-avatar]').forEach(function (el) { setText(el, initials(artist)); });
    $all('[data-account-email]').forEach(function (el) {
      if (el.tagName === 'INPUT') el.value = me.email || '';
      else setText(el, me.email || '');
    });
    $all('[data-account-artist]').forEach(function (el) {
      if (el.tagName === 'INPUT') el.value = artist;
      else setText(el, artist);
    });
    $all('[data-account-plan]').forEach(function (el) { setText(el, planLabel(me.plan)); });
    $all('[data-account-plan-title]').forEach(function (el) {
      if (String(me.status || '').toLowerCase() === 'hold') {
        el.textContent = 'On hold';
        return;
      }
      var label = planLabel(me.plan);
      el.textContent = label === '—' ? 'Your plan' : 'On ' + label.charAt(0) + label.slice(1).toLowerCase();
    });
    var ids = Array.isArray(me.tonegrid_release_ids) ? me.tonegrid_release_ids : [];
    $all('[data-account-releases]').forEach(function (el) { setText(el, String(ids.length)); });
    $all('[data-pub-call]').forEach(function (el) {
      el.hidden = ids.length === 0;
    });
  }

  function bindSignOut() {
    var link = document.querySelector('.sign-out');
    if (!link) return;
    link.addEventListener('click', function (event) {
      event.preventDefault();
      var dest = link.getAttribute('href') || 'index.html';
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .catch(function () {})
        .then(function () {
          global.location.href = dest;
        });
    });
  }

  function bounceUnfinished(result) {
    var path = String((global.location && global.location.pathname) || '');
    var file = path.split('/').pop();
    if (file === 'confirm.html' || file === 'confirmed.html' || file === 'login.html' || file === 'signup.html') {
      return;
    }
    if (result && result.data && result.data.pending) {
      global.location.replace('confirm.html');
    }
  }

  function fromMembership() {
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.whenReady === 'function') {
      return global.PlaigroundMembership.whenReady().then(function (result) {
        bounceUnfinished(result);
        if (result && result.ok && result.data && !result.data.pending) return result.data;
        if (global.PlaigroundMembership.account) return global.PlaigroundMembership.account();
        return null;
      });
    }
    return fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.json().then(function (data) {
          bounceUnfinished({ ok: response.ok, data: data || {} });
          if (!response.ok) return null;
          return data;
        });
      })
      .catch(function () {
        return null;
      });
  }

  bindSignOut();
  fromMembership().then(function (me) {
    if (me) fillAccount(me);
  });

  global.PlaigroundAccount = { fill: fillAccount };
})(window);
