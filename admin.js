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
    if (Number.isNaN(d.getTime())) {
      var raw = String(value);
      return raw.length >= 10 ? raw.slice(0, 10) : raw;
    }
    return d.toISOString().slice(0, 10);
  }

  function formatSignedUpAt(value) {
    if (!value) return '—';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);
    var map = {};
    parts.forEach(function (part) {
      map[part.type] = part.value;
    });
    return map.month + ' ' + map.day + ', ' + map.year + ' ' + map.hour + ':' + map.minute + ' ' + map.dayPeriod + ' PT';
  }

  function cell(label, html, extraClass) {
    var cls = extraClass ? ' class="' + extraClass + '"' : '';
    return '<td' + cls + ' data-label="' + escapeHtml(label) + '">' + html + '</td>';
  }

  function formatMoney(cents, currency) {
    if (cents == null || cents === '') return '—';
    var n = Number(cents);
    if (!isFinite(n)) return '—';
    var code = String(currency || 'usd').toUpperCase();
    try {
      return (n / 100).toLocaleString('en-US', { style: 'currency', currency: code });
    } catch (err) {
      return '$' + (n / 100).toFixed(2);
    }
  }

  function formatUsd(value) {
    if (value == null || value === '') return '—';
    var n = Number(value);
    if (!isFinite(n)) return '—';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function kindLabel(kind) {
    var next = String(kind || '').trim().toLowerCase();
    if (next === 'charge') return 'Charge';
    if (next === 'refund') return 'Refund';
    if (next === 'payout') return 'Payout';
    return next || '—';
  }

  function dash(value) {
    var next = String(value == null ? '' : value).trim();
    return next || '—';
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

  function fillTable(tableSel, emptySel, bodySel, rows, htmlFor) {
    var empty = $(emptySel);
    var table = $(tableSel);
    var body = $(bodySel);
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      if (empty) empty.hidden = false;
      if (table) table.hidden = true;
      if (body) body.innerHTML = '';
      return;
    }
    if (empty) empty.hidden = true;
    if (table) table.hidden = false;
    if (body) body.innerHTML = list.map(htmlFor).join('');
  }

  function renderSignups(signups) {
    fillTable('[data-signups-table]', '[data-signups-empty]', '[data-signups-body]', signups, function (row) {
      var name = dash(row && row.name);
      var when = formatSignedUpAt(row && row.signed_up_at);
      return '<tr>'
        + cell('Email',
          '<div class="admin-signup-email">' + escapeHtml(dash(row.email)) + '</div>'
          + '<div class="admin-signup-meta">'
          + '<span class="admin-signup-name">' + escapeHtml(name) + '</span>'
          + '<span class="admin-signup-when">' + escapeHtml(when) + '</span>'
          + '</div>',
          'admin-lead')
        + cell('Name', escapeHtml(name), 'admin-signup-dup')
        + cell('Plan', escapeHtml(planLabel(row.plan)))
        + cell('Status', escapeHtml(dash(row.status)))
        + cell('Signed up', escapeHtml(when), 'admin-signup-dup')
        + cell('Stripe', escapeHtml(stripeLabel(row.stripe)))
        + '</tr>';
    });
  }

  function renderEvents(events) {
    fillTable('[data-events-table]', '[data-events-empty]', '[data-events-body]', events, function (row) {
      return '<tr>'
        + cell('Email', escapeHtml(dash(row.email)), 'admin-lead')
        + cell('Event', escapeHtml(dash(row.event)))
        + cell('When', escapeHtml(formatSignedUpAt(row.created_at)))
        + '</tr>';
    });
  }

  function renderCheckouts(checkouts) {
    fillTable('[data-checkouts-table]', '[data-checkouts-empty]', '[data-checkouts-body]', checkouts, function (row) {
      return '<tr>'
        + cell('Email', escapeHtml(dash(row.email)), 'admin-lead')
        + cell('Plan', escapeHtml(planLabel(row.plan)))
        + cell('Amount', escapeHtml(formatMoney(row.amount_cents, row.currency)))
        + cell('Status', escapeHtml(dash(row.status)))
        + cell('Paid', escapeHtml(formatDate(row.paid_at)))
        + '</tr>';
    });
  }

  function renderSubs(subscriptions) {
    fillTable('[data-subs-table]', '[data-subs-empty]', '[data-subs-body]', subscriptions, function (row) {
      return '<tr>'
        + cell('Email', escapeHtml(dash(row.email)), 'admin-lead')
        + cell('Plan', escapeHtml(planLabel(row.plan)))
        + cell('Status', escapeHtml(dash(row.status)))
        + cell('Started', escapeHtml(formatDate(row.started_at)))
        + '</tr>';
    });
  }

  function renderMoney(money) {
    var rows = (money && Array.isArray(money.rows) && money.rows)
      || []
        .concat((money && money.charges) || [])
        .concat((money && money.refunds) || [])
        .concat((money && money.payouts) || []);
    fillTable('[data-money-table]', '[data-money-empty]', '[data-money-body]', rows, function (row) {
      return '<tr>'
        + cell('Kind', escapeHtml(kindLabel(row.kind)), 'admin-lead')
        + cell('Email', escapeHtml(dash(row.email)))
        + cell('Amount', escapeHtml(formatMoney(row.amount_cents, row.currency)))
        + cell('Status', escapeHtml(dash(row.status)))
        + cell('Date', escapeHtml(formatDate(row.created_at)))
        + '</tr>';
    });
  }

  function renderSubmissions(submissions) {
    fillTable('[data-submissions-table]', '[data-submissions-empty]', '[data-submissions-body]', submissions, function (row) {
      var alert = String(row.alert || '').trim();
      return '<tr>'
        + cell('Title', escapeHtml(dash(row.title)), 'admin-lead')
        + cell('Artist', escapeHtml(dash(row.artist)))
        + cell('Email', escapeHtml(dash(row.email)))
        + cell('Status', escapeHtml(dash(row.status)))
        + cell('Street date', escapeHtml(dash(row.street_date)))
        + cell('Live date', escapeHtml(dash(row.live_date)))
        + cell('UPC', escapeHtml(dash(row.upc)))
        + cell('ISRC', escapeHtml(dash(row.isrc)))
        + cell('Takedown', escapeHtml(dash(row.takedown)))
        + cell('Alert', escapeHtml(alert), 'admin-alert')
        + '</tr>';
    });
  }

  function flattenDeliveries(submissions) {
    var out = [];
    (submissions || []).forEach(function (row) {
      (row.deliveries || []).forEach(function (item) {
        if (!item || !item.destination) return;
        out.push({
          title: row.title,
          destination: item.destination,
          status: item.status,
        });
      });
    });
    return out;
  }

  function renderDestinations(submissions) {
    fillTable('[data-destinations-table]', '[data-destinations-empty]', '[data-destinations-body]', flattenDeliveries(submissions), function (row) {
      return '<tr>'
        + cell('Title', escapeHtml(dash(row.title)), 'admin-lead')
        + cell('Store', escapeHtml(dash(row.destination)))
        + cell('Status', escapeHtml(dash(row.status)))
        + '</tr>';
    });
  }

  function renderRoyalties(rows) {
    fillTable('[data-royalties-table]', '[data-royalties-empty]', '[data-royalties-body]', rows, function (row) {
      var streams = row.streams == null || row.streams === '' ? '—' : String(row.streams);
      return '<tr>'
        + cell('Period', escapeHtml(dash(row.period)), 'admin-lead')
        + cell('Store', escapeHtml(dash(row.destination)))
        + cell('Title', escapeHtml(dash(row.title)))
        + cell('Streams', escapeHtml(streams))
        + cell('Amount', escapeHtml(formatUsd(row.amount_usd)))
        + cell('Status', escapeHtml(dash(row.status)))
        + '</tr>';
    });
  }

  function render(data) {
    var status = $('[data-admin-status]') || $('[data-signups-status]');
    if (status) status.hidden = true;
    renderSignups(data && data.signups);
    renderEvents(data && data.events);
    renderCheckouts(data && data.checkouts);
    renderSubs(data && data.subscriptions);
    renderMoney(data && data.money);
    renderSubmissions(data && data.submissions);
    renderDestinations(data && data.submissions);
    renderRoyalties(data && data.store_royalties);
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
          var statusEl = $('[data-admin-status]') || $('[data-signups-status]');
          if (statusEl) {
            statusEl.hidden = false;
            statusEl.textContent = 'Could not load the desk.';
          }
          return;
        }
        render(list.data);
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
