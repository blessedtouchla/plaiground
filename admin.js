(function (global) {
  var OWNER = 'emailplaiground@gmail.com';
  var LOGIN = 'login.html';
  var DENY = 'dashboard.html';

  function normalizeEmail(value) {
    return String(value || '')
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
      .trim()
      .toLowerCase();
  }

  function gmailLocalKey(value) {
    var email = normalizeEmail(value);
    var at = email.lastIndexOf('@');
    if (at <= 0) return '';
    var domain = email.slice(at + 1);
    if (domain !== 'gmail.com' && domain !== 'googlemail.com') return '';
    return email.slice(0, at).split('+')[0].replace(/\./g, '');
  }

  function isOwner(email) {
    var a = normalizeEmail(email);
    var b = OWNER;
    if (a && a === b) return true;
    var keyA = gmailLocalKey(a);
    var keyB = gmailLocalKey(b);
    return Boolean(keyA && keyA === keyB);
  }

  function planLabel(plan) {
    var next = String(plan || '').trim().toLowerCase();
    if (next === 'basic') return 'Basic';
    if (next === 'creator') return 'Creator';
    if (next === 'pro') return 'Pro';
    return next || '—';
  }

  function stripeLabel(value) {
    if (value === 'yes') return 'Yes';
    if (value === 'no') return 'No';
    return 'Unknown';
  }

  function formatDate(value) {
    if (!value) return '—';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function $(sel) {
    return global.document ? global.document.querySelector(sel) : null;
  }

  function render(signups) {
    var empty = $('[data-signups-empty]');
    var table = $('[data-signups-table]');
    var body = $('[data-signups-body]');
    var status = $('[data-signups-status]');
    var rows = Array.isArray(signups) ? signups : [];
    if (status) status.hidden = true;
    if (!rows.length) {
      if (empty) empty.hidden = false;
      if (table) table.hidden = true;
      if (body) body.innerHTML = '';
      return;
    }
    if (empty) empty.hidden = true;
    if (table) table.hidden = false;
    if (body) {
      body.innerHTML = rows.map(function (row) {
        return '<tr>'
          + '<td>' + escapeHtml(row.email) + '</td>'
          + '<td>' + escapeHtml(planLabel(row.plan)) + '</td>'
          + '<td>' + escapeHtml(row.status || '—') + '</td>'
          + '<td>' + escapeHtml(formatDate(row.signed_up_at)) + '</td>'
          + '<td>' + escapeHtml(stripeLabel(row.stripe)) + '</td>'
          + '</tr>';
      }).join('');
    }
  }

  function loadList() {
    return global.fetch('/api/admin/signups', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data || {} };
      }).catch(function () {
        return { ok: false, status: response.status, data: {} };
      });
    });
  }

  function boot() {
    var membership = global.PlaigroundMembership;
    var ready = membership && typeof membership.whenReady === 'function'
      ? membership.whenReady()
      : Promise.resolve(null);
    ready.then(function (result) {
      if (!result || !result.ok) {
        global.location.replace(LOGIN);
        return null;
      }
      var me = result.data || (membership.account && membership.account()) || {};
      if (!isOwner(me.email)) {
        global.location.replace(DENY);
        return null;
      }
      return loadList().then(function (list) {
        if (!list || list.status === 401) {
          global.location.replace(LOGIN);
          return;
        }
        if (!list.ok) {
          global.location.replace(DENY);
          return;
        }
        render(list.data && list.data.signups);
      });
    }).catch(function () {
      global.location.replace(LOGIN);
    });
  }

  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
