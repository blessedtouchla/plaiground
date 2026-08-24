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

  function isPlaceholderName(name) {
    var next = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!next) return false;
    if (
      next === 'john'
      || next === 'john ham'
      || next === 'john doe'
      || next === 'john harper'
      || next === 'patrick'
      || next === 'neon shadows'
      || next === 'neon sermon'
      || next === 'neon santos'
      || next === 'victoria reyes'
      || next === 'victoria void'
    ) return true;
    var first = next.split(' ')[0];
    return first === 'john' || first === 'patrick';
  }

  function accountArtistField(me) {
    var artist = String((me && me.artist) || '').trim();
    if (!artist || isPlaceholderName(artist)) return '';
    return artist;
  }

  function accountDisplayName(me) {
    var names = [];
    if (me && me.artist) names.push(me.artist);
    var roster = me && me.profile && me.profile.artists;
    if (Array.isArray(roster)) {
      roster.forEach(function (row) {
        if (row && row.name) names.push(row.name);
      });
    }
    for (var i = 0; i < names.length; i += 1) {
      var name = String(names[i] || '').trim();
      if (name && !isPlaceholderName(name)) return name;
    }
    return '';
  }

  var PLAN_PITCH = {
    creator: 'Creator · $14.99/month or $12.42/month billed yearly',
    pro: 'Pro · $19.99/month or $16.58/month billed yearly',
    basic: 'Basic · $0 forever',
  };
  var PLAN_DETAIL = {
    creator: 'Creator is Basic with the paid features unlocked. 8 distribution uploads and 8 publishing registrations this UTC month, counted separately. Pro unlocks unlimited.',
    pro: 'Same product as Creator, unlimited, plus catalog migration. Unlimited distribution uploads and publishing registrations.',
    basic: 'One release for the life of the account. Canceling a paid plan drops you here.',
  };

  function planLabel(plan) {
    var next = String(plan || '').trim().toLowerCase();
    if (next === 'pro') return 'PRO';
    if (next === 'creator') return 'CREATOR';
    if (next === 'basic') return 'BASIC';
    return '—';
  }

  function planPitch(plan, interval) {
    var next = String(plan || '').trim().toLowerCase();
    var billed = String(interval || '').trim().toLowerCase();
    if (next === 'creator' && billed === 'month') return 'Creator · $14.99/month';
    if (next === 'creator' && billed === 'year') return 'Creator · $12.42/month billed yearly';
    if (next === 'pro' && billed === 'month') return 'Pro · $19.99/month';
    if (next === 'pro' && billed === 'year') return 'Pro · $16.58/month billed yearly';
    return PLAN_PITCH[next] || 'Your plan';
  }

  function sidebarPrice(plan) {
    var next = String(plan || '').trim().toLowerCase();
    if (next === 'creator') return 'Creator · $14.99/month';
    if (next === 'pro') return 'Pro · $19.99/month';
    if (next === 'basic') return 'Basic · $0 forever';
    return 'Your plan';
  }

  function sidebarYear(plan) {
    var next = String(plan || '').trim().toLowerCase();
    if (next === 'creator') return 'or $149/year';
    if (next === 'pro') return 'or $199/year';
    return '';
  }

  function markPlanOption(plan, interval) {
    var key = String(plan || '').trim().toLowerCase();
    var billed = String(interval || '').trim().toLowerCase();
    $all('[data-plan-option]').forEach(function (el) {
      var option = String(el.getAttribute('data-plan-option') || '');
      var current = billed ? option === key + ':' + billed : option.indexOf(key + ':') === 0;
      if (el.classList && el.classList.toggle) el.classList.toggle('is-current', current);
      if (current) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function fillAccount(me) {
    if (!me) return;
    var artist = accountArtistField(me);
    var display = accountDisplayName(me);
    var first = firstName(display);
    var who = first ? 'Hi ' + first + '!' : 'Hi there';
    $all('[data-account-who]').forEach(function (el) { setText(el, who); });
    $all('[data-account-avatar]').forEach(function (el) { setText(el, initials(display)); });
    $all('[data-account-email]').forEach(function (el) {
      if (el.tagName === 'INPUT') el.value = me.email || '';
      else setText(el, me.email || '');
    });
    $all('[data-account-artist]').forEach(function (el) {
      if (el.tagName === 'INPUT') el.value = artist;
      else setText(el, artist);
    });
    $all('[data-account-plan]').forEach(function (el) { setText(el, planLabel(me.plan)); });
    var interval = String(me.billing_interval || me.interval || '').toLowerCase();
    $all('[data-account-plan-pitch]').forEach(function (el) { setText(el, planPitch(me.plan, interval)); });
    $all('[data-account-plan-price]').forEach(function (el) { setText(el, sidebarPrice(me.plan)); });
    $all('[data-account-plan-year]').forEach(function (el) {
      var year = sidebarYear(me.plan);
      setText(el, year);
      el.hidden = !year;
    });
    $all('[data-account-plan-detail]').forEach(function (el) {
      setText(el, PLAN_DETAIL[String(me.plan || '').toLowerCase()] || PLAN_DETAIL.basic);
    });
    markPlanOption(me.plan, interval);
    $all('[data-account-plan-title]').forEach(function (el) {
      var status = String(me.status || '').toLowerCase();
      if (status === 'hold') {
        el.textContent = 'On hold';
        return;
      }
      if (status === 'warning') {
        el.textContent = 'Payment warning';
        return;
      }
      var label = planLabel(me.plan);
      el.textContent = label === '—' ? 'Your plan' : 'On ' + label.charAt(0) + label.slice(1).toLowerCase();
    });
    var warning = String(me.status || '').toLowerCase() === 'warning';
    var hold = String(me.status || '').toLowerCase() === 'hold';
    $all('[data-billing-warning]').forEach(function (el) { el.hidden = !warning; });
    $all('[data-billing-hold]').forEach(function (el) { el.hidden = !hold; });
    $all('[data-payout-withdraw]').forEach(function (el) {
      var plan = String(me.plan || '').toLowerCase();
      var canWithdraw = plan === 'creator' || plan === 'pro';
      el.hidden = !canWithdraw;
      if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', !canWithdraw);
      var blocked = warning || hold;
      el.disabled = !canWithdraw || blocked;
      if (!canWithdraw) return;
      if (blocked) {
        el.setAttribute('aria-disabled', 'true');
        el.textContent = 'Payouts paused — update card';
      }
    });
    var ids = Array.isArray(me.tonegrid_release_ids) ? me.tonegrid_release_ids.filter(Boolean) : [];
    var hasRelease = ids.length > 0;
    var latestId = hasRelease ? String(ids[ids.length - 1]) : '';
    var latest = latestReleaseCard(me, latestId);
    var liveN = (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus)
      ? PlaigroundReleaseStatus.liveCount(me)
      : 0;
    $all('[data-account-releases]').forEach(function (el) { setText(el, String(liveN)); });
    $all('[data-pub-call]').forEach(function (el) {
      el.hidden = liveN === 0;
    });
    var plan = String(me.plan || '').toLowerCase();
    var paid = plan === 'creator' || plan === 'pro';
    $all('[data-pub-badge]').forEach(function (el) {
      setText(el, paid ? 'INCLUDED IN YOUR PLAN' : 'INCLUDED ON CREATOR AND PRO');
    });
    $all('[data-first-song]').forEach(function (el) { el.hidden = hasRelease; });
    $all('[data-has-release]').forEach(function (el) { el.hidden = !hasRelease; });
    $all('[data-first-upload]').forEach(function (el) { el.hidden = hasRelease; });
    $all('[data-latest-title]').forEach(function (el) { setText(el, latest.title); });
    $all('[data-latest-status]').forEach(function (el) { setText(el, latest.status); });
    $all('[data-latest-link]').forEach(function (el) {
      if (latest.href) el.setAttribute('href', latest.href);
    });
    var upload = me.upload || {};
    var atLimit = upload.allowed === false;
    $all('[data-new-release]').forEach(function (el) {
      if (!atLimit) return;
      el.setAttribute('href', 'upload.html');
    });
  }

  function readDraft() {
    try {
      return JSON.parse((global.localStorage && global.localStorage.getItem('plaiground.tonegrid.draft')) || '{}') || {};
    } catch (err) {
      try {
        return JSON.parse((global.sessionStorage && global.sessionStorage.getItem('plaiground.tonegrid.draft')) || '{}') || {};
      } catch (inner) {
        return {};
      }
    }
  }

  function latestReleaseCard(me, latestId) {
    var draft = readDraft();
    var title = String((draft && draft.title) || '').trim() || 'Your release';
    var href = latestId ? ('song.html?id=' + encodeURIComponent(latestId)) : 'releases.html';
    var stored = '';
    if (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus && latestId) {
      stored = PlaigroundReleaseStatus.storedStatus(me, latestId);
    }
    if (!stored && me && me.profile && Array.isArray(me.profile.releases) && latestId) {
      me.profile.releases.forEach(function (row) {
        if (String((row && (row.tonegrid_release_id || row.id)) || '').toLowerCase() === String(latestId).toLowerCase()) {
          stored = String((row && row.tonegrid_status) || '').toLowerCase();
        }
      });
    }
    if (!stored && draft && draft.tonegrid_status) stored = String(draft.tonegrid_status).toLowerCase();
    if (!stored) stored = (draft && draft.submitted === false) ? 'draft' : 'pending';
    var status = (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus)
      ? PlaigroundReleaseStatus.label(stored)
      : (stored === 'live' ? 'Live' : stored === 'draft' ? 'Draft' : stored === 'rejected' ? 'Needs fix' : 'Pending');
    return { title: title, status: status, href: href };
  }

  function bindSignOut() {
    var link = document.querySelector('.sign-out');
    if (!link) return;
    link.addEventListener('click', function (event) {
      event.preventDefault();
      var dest = link.getAttribute('href') || 'index.html';
      if (global.PlaigroundMembership && typeof global.PlaigroundMembership.clearSignedIn === 'function') {
        global.PlaigroundMembership.clearSignedIn();
      }
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

  function dollars(cents) {
    var n = Number(cents);
    if (!Number.isFinite(n)) return '';
    return '$' + (n / 100).toFixed(2);
  }

  function nextPeriodPrice(plan, interval, cents) {
    var fromServer = dollars(cents);
    if (fromServer) return fromServer;
    var next = String(plan || '').trim().toLowerCase();
    var billed = String(interval || '').trim().toLowerCase();
    if (next === 'creator' && billed === 'month') return '$14.99';
    if (next === 'creator' && billed === 'year') return '$149.00';
    if (next === 'pro' && billed === 'month') return '$19.99';
    if (next === 'pro' && billed === 'year') return '$199.00';
    return '';
  }

  function upgradeChargeCopy(due, next) {
    if (due && next) {
      return 'You pay the difference now: ' + due + '. Next period you pay ' + next + '. Same billing date.';
    }
    if (due) return 'You pay the difference now: ' + due + '. Then the new price next period.';
    return 'You pay the difference now, then the new price next period.';
  }

  function bindPlanConfirm() {
    var root = document.querySelector('[data-plan-confirm]');
    if (!root) return;
    var params;
    try {
      params = new URLSearchParams(global.location.search);
    } catch (err) {
      params = { get: function () { return ''; } };
    }
    var plan = String(params.get('plan') || '').trim().toLowerCase();
    var interval = String(params.get('interval') || 'month').trim().toLowerCase();
    if (interval === 'yearly') interval = 'year';
    if (interval === 'monthly') interval = 'month';
    var title = document.querySelector('[data-plan-confirm-title]');
    var change = document.querySelector('[data-plan-confirm-change]');
    var charge = document.querySelector('[data-plan-confirm-charge]');
    var submit = document.querySelector('[data-plan-confirm-submit]');
    var status = document.querySelector('[data-checkout-status]');
    if (plan !== 'creator' && plan !== 'pro') {
      setText(title, 'Choose a paid plan');
      setText(change, 'Basic is not a paid switch target. Pick Creator or Pro from Settings.');
      if (submit) submit.hidden = true;
      return;
    }
    if (submit) {
      submit.setAttribute('data-checkout-plan', plan);
      submit.setAttribute('data-checkout-interval', interval);
      submit.setAttribute('data-checkout-switch', '');
    }
    setText(title, 'Confirm ' + planPitch(plan, interval));
    setText(change, 'Switch to ' + planPitch(plan, interval) + '.' + (plan === 'pro' ? ' ' + PLAN_DETAIL.pro : ''));
    setText(charge, 'You pay the difference now, then the new price next period. Downgrades take effect now with no refund.');
    if (typeof global.fetch !== 'function') return;
    global.fetch('/api/create-checkout-session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action: 'preview', plan: plan, interval: interval }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data || {} };
        }).catch(function () {
          return { ok: false, data: {} };
        });
      })
      .then(function (result) {
        var data = result.data || {};
        if (!result.ok) {
          if (status) {
            status.textContent = '';
            status.hidden = true;
          }
          return;
        }
        var from = planPitch(data.currentPlan || data.from_plan, data.currentInterval || data.from_interval);
        var to = planPitch(data.plan || plan, data.interval || interval);
        if (data.unchanged) {
          setText(change, 'You are already on ' + to + '.');
          setText(charge, 'Submit will not charge again.');
          return;
        }
        setText(change, 'Switch from ' + from + ' to ' + to + '.' + (plan === 'pro' ? ' ' + PLAN_DETAIL.pro : ''));
        if (data.proration === 'none') {
          setText(title, 'No refund');
          setText(charge, 'This is a downgrade. The change takes effect now. No refund for unused time.');
          return;
        }
        if (data.checkout && !data.existing) {
          setText(charge, 'Submit continues to Stripe Checkout to start this plan.');
          return;
        }
        var due = dollars(data.amount_due);
        var next = nextPeriodPrice(data.plan || plan, data.interval || interval, data.recurring_amount);
        if (due) setText(title, 'Due now: ' + due);
        setText(charge, upgradeChargeCopy(due, next));
      })
      .catch(function () {});
  }

  function bindManagePlan() {
    var toggle = document.querySelector('[data-manage-plan-toggle]');
    var panel = document.querySelector('[data-manage-plan]');
    if (!toggle || !panel) return;
    if (toggle.getAttribute('data-manage-bound') === 'true') return;
    toggle.setAttribute('data-manage-bound', 'true');
    toggle.addEventListener('click', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      panel.hidden = false;
      panel.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      if (typeof panel.scrollIntoView === 'function') {
        panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      var current = panel.querySelector('[data-plan-option][aria-current="true"], [data-plan-option].is-current');
      var first = current || panel.querySelector('[data-plan-option]');
      if (first && typeof first.focus === 'function') first.focus();
      if (typeof global.fetch !== 'function') return;
      global.fetch('/api/create-checkout-session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'billing' }),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data || {} };
          }).catch(function () {
            return { ok: false, data: {} };
          });
        })
        .then(function (result) {
          if (!result.ok) return;
          markPlanOption(result.data.plan, result.data.interval);
          $all('[data-account-plan-pitch]').forEach(function (el) {
            setText(el, planPitch(result.data.plan, result.data.interval));
          });
        })
        .catch(function () {});
    });
  }

  function whenDomReady(cb) {
    var doc = global.document;
    if (!doc || typeof cb !== 'function') return;
    if (doc.readyState === 'loading' && typeof doc.addEventListener === 'function') {
      doc.addEventListener('DOMContentLoaded', cb);
      return;
    }
    cb();
  }

  bindSignOut();
  whenDomReady(bindManagePlan);
  bindManagePlan();
  bindPlanConfirm();
  fromMembership().then(function (me) {
    if (me) fillAccount(me);
  });

  global.PlaigroundAccount = { fill: fillAccount, markPlanOption: markPlanOption };
})(window);
