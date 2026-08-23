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
      var label = planLabel(me.plan);
      el.textContent = label === '—' ? 'Your plan' : 'On ' + label.charAt(0) + label.slice(1).toLowerCase();
    });
    var ids = Array.isArray(me.tonegrid_release_ids) ? me.tonegrid_release_ids : [];
    $all('[data-account-releases]').forEach(function (el) { setText(el, String(ids.length)); });
    var extras = canUseExtras(me.plan);
    $all('[data-pub-call]').forEach(function (el) {
      el.hidden = false;
    });
    applyPlanLocks(extras);
  }

  function canUseExtras(plan) {
    var next = String(plan || '').trim().toLowerCase();
    return next === 'creator' || next === 'pro';
  }

  function ensureCover(el, extras) {
    var cover = el.querySelector('.plan-lock-cover');
    if (!cover) {
      cover = document.createElement('div');
      cover.className = 'plan-lock-cover';
      el.appendChild(cover);
    }
    var feature = el.getAttribute('data-plan-lock') || 'extras';
    if (feature === 'publishing') {
      cover.innerHTML = extras
        ? ''
        : 'Publishing registration is included with Creator and Pro. <a href="creator.html">Upgrade to Creator</a> or <a href="pro.html">Pro</a>.';
    } else if (feature === 'boost') {
      cover.innerHTML = extras
        ? 'Marketing Boost is not for sale.'
        : 'Marketing Boost is included with Creator and Pro. <a href="creator.html">Upgrade to Creator</a> or <a href="pro.html">Pro</a>.';
    } else {
      cover.innerHTML = extras
        ? ''
        : 'Deeper analytics are included with Creator and Pro. <a href="creator.html">Upgrade to Creator</a> or <a href="pro.html">Pro</a>.';
    }
  }

  function applyPlanLocks(extras) {
    $all('[data-plan-lock]').forEach(function (el) {
      var feature = el.getAttribute('data-plan-lock');
      var locked = feature === 'boost' ? true : !extras;
      el.classList.add('plan-lock');
      el.setAttribute('data-locked', locked ? 'true' : 'false');
      ensureCover(el, extras);
    });
  }

  function bindFeaturePosts() {
    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest && event.target.closest('[data-feature-post]');
      if (!target) return;
      event.preventDefault();
      var feature = target.getAttribute('data-feature-post');
      var href = target.getAttribute('href') || '';
      fetch('/api/tonegrid/' + feature, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: '{}',
      }).then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, status: response.status, data: data || {} };
        }).catch(function () {
          return { ok: false, status: response.status, data: {} };
        });
      }).then(function (result) {
        if (result.ok && href) {
          global.location.href = href;
          return;
        }
        var note = document.getElementById('tg-feature-status');
        if (note) {
          note.hidden = false;
          note.textContent = (result.data && result.data.error) || 'This feature is locked on Basic.';
        }
      }).catch(function () {});
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
  bindFeaturePosts();
  applyPlanLocks(false);
  fromMembership().then(function (me) {
    if (me) fillAccount(me);
    else applyPlanLocks(false);
  });

  global.PlaigroundAccount = { fill: fillAccount, applyPlanLocks: applyPlanLocks };
})(window);
