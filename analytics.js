(function (global) {
  var ANALYTICS_URL = '/api/tonegrid/analytics';
  var DSP_COLORS = ['var(--green)', 'var(--magenta)', '#5B8CFF', '#E89A3F', 'var(--purple)', 'var(--gold)'];

  function $(sel) {
    return document.querySelector(sel);
  }

  function $all(sel) {
    return document.querySelectorAll(sel);
  }

  function toNumber(value) {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string') {
      var n = Number(String(value).replace(/[$,]/g, '').trim());
      return isFinite(n) ? n : 0;
    }
    return 0;
  }

  function formatCount(value) {
    return toNumber(value).toLocaleString('en-US');
  }

  function formatMoney(value) {
    if (value == null || value === '') return '—';
    var n = toNumber(value);
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function sanitizePartnerCopy(text) {
    var next = String(text == null ? '' : text);
    next = next.replace(/\bthe\s+ToneGrid\b/gi, 'the store');
    next = next.replace(/ToneGrid/gi, 'the store');
    next = next.replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
    return next;
  }

  function setText(sel, text) {
    var el = $(sel);
    if (el) el.textContent = text == null ? '' : sanitizePartnerCopy(text);
  }

  function setHidden(sel, hidden) {
    var el = $(sel);
    if (el) el.hidden = Boolean(hidden);
  }

  function emptyMessage() {
    return 'No plays yet. New uploads will show here when the store has numbers.';
  }

  function currentPlan() {
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.currentPlan === 'function') {
      return String(global.PlaigroundMembership.currentPlan() || '').toLowerCase();
    }
    return '';
  }

  function hasPaidAnalytics() {
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.hasPaidAccess === 'function') {
      return Boolean(global.PlaigroundMembership.hasPaidAccess());
    }
    var plan = currentPlan();
    return plan === 'creator' || plan === 'pro';
  }

  function applyLock(locked) {
    $all('[data-analytics-lock]').forEach(function (el) {
      el.hidden = !locked;
    });
    $all('.panel').forEach(function (el) {
      if (!el.querySelector || !el.querySelector('[data-analytics-lock]')) return;
      if (el.classList && el.classList.toggle) el.classList.toggle('is-locked', Boolean(locked));
    });
    if (locked) {
      setHidden('[data-metric-top-release]', true);
      setHidden('[data-metric-top-dsp]', true);
      var chart = $('[data-analytics-chart]');
      if (chart) chart.hidden = false;
    }
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.applyPlanCopy === 'function') {
      global.PlaigroundMembership.applyPlanCopy();
    }
  }

  function isEmptyCatalog(data) {
    var summary = (data && data.summary) || {};
    var streams = toNumber(summary.total_streams);
    var revenue = toNumber(summary.total_revenue_usd);
    var dspTotal = ((data && data.dsps) || []).reduce(function (sum, row) { return sum + toNumber(row.streams); }, 0);
    var locTotal = ((data && data.territories) || []).reduce(function (sum, row) { return sum + toNumber(row.streams); }, 0);
    return streams === 0 && revenue === 0 && dspTotal === 0 && locTotal === 0;
  }

  function renderMetrics(data) {
    var summary = (data && data.summary) || {};
    setText('[data-metric="streams"]', formatCount(summary.total_streams));
    setText('[data-metric="revenue"]', formatMoney(summary.total_revenue_usd == null ? 0 : summary.total_revenue_usd));

    var top = summary.top_release;
    if (top && (top.title || toNumber(top.streams))) {
      setHidden('[data-metric-top-release]', false);
      setText('[data-metric="top-release"]', top.title || '—');
      setText('[data-metric-top-release-note]', formatCount(top.streams) + ' streams');
    } else {
      setHidden('[data-metric-top-release]', true);
    }

    if (summary.top_dsp) {
      setHidden('[data-metric-top-dsp]', false);
      setText('[data-metric="top-dsp"]', summary.top_dsp);
    } else {
      setHidden('[data-metric-top-dsp]', true);
    }
  }

  function renderBars(hostSel, rows, nameKey) {
    var host = $(hostSel);
    if (!host) return;
    host.textContent = '';
    var list = rows || [];
    if (!list.length) {
      var empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = emptyMessage();
      host.appendChild(empty);
      return;
    }
    var max = 0;
    list.forEach(function (row) {
      var streams = toNumber(row.streams);
      if (streams > max) max = streams;
    });
    list.forEach(function (row, index) {
      var streams = toNumber(row.streams);
      var wrap = document.createElement('div');
      wrap.className = 'bar-row';
      var name = document.createElement('span');
      name.textContent = row[nameKey] || '—';
      var bar = document.createElement('div');
      bar.className = 'bar';
      var fill = document.createElement('i');
      fill.style.width = (max ? Math.round((streams / max) * 100) : 0) + '%';
      fill.style.background = DSP_COLORS[index % DSP_COLORS.length];
      bar.appendChild(fill);
      var count = document.createElement('span');
      count.textContent = formatCount(streams);
      wrap.appendChild(name);
      wrap.appendChild(bar);
      wrap.appendChild(count);
      host.appendChild(wrap);
    });
  }

  function renderLocations(rows) {
    var host = $('[data-analytics-territories]');
    if (!host) return;
    host.textContent = '';
    var list = rows || [];
    if (!list.length) {
      var empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = emptyMessage();
      host.appendChild(empty);
      return;
    }
    list.forEach(function (row) {
      var line = document.createElement('div');
      line.className = 'loc';
      var name = document.createElement('span');
      name.textContent = row.country_name || row.territory || '—';
      var count = document.createElement('span');
      count.textContent = formatCount(row.streams);
      line.appendChild(name);
      line.appendChild(count);
      host.appendChild(line);
    });
  }

  function renderChart(series) {
    var panel = $('[data-analytics-chart]');
    var bars = $('[data-analytics-chart-bars]');
    var labels = $('[data-analytics-chart-labels]');
    if (!panel || !bars || !labels) return;
    if (!series || !series.length) {
      panel.hidden = true;
      bars.textContent = '';
      labels.textContent = '';
      return;
    }
    panel.hidden = false;
    bars.textContent = '';
    labels.textContent = '';
    var max = 0;
    series.forEach(function (row) {
      var value = toNumber(row.revenue_usd != null ? row.revenue_usd : row.streams);
      if (value > max) max = value;
    });
    series.forEach(function (row) {
      var value = toNumber(row.revenue_usd != null ? row.revenue_usd : row.streams);
      var bar = document.createElement('b');
      bar.style.height = (max ? Math.max(4, Math.round((value / max) * 100)) : 4) + '%';
      if (!value) bar.className = 'zero';
      bars.appendChild(bar);
      var label = document.createElement('span');
      label.textContent = row.label;
      labels.appendChild(label);
    });
  }

  function render(data) {
    var payload = data || {};
    var paid = hasPaidAnalytics();
    applyLock(!paid);
    renderMetrics(paid ? payload : {
      summary: {
        total_streams: (payload.summary && payload.summary.total_streams) || 0,
        total_revenue_usd: (payload.summary && payload.summary.total_revenue_usd) || 0,
      },
    });
    renderBars('[data-analytics-dsps]', paid ? payload.dsps : [], 'dsp');
    renderLocations(paid ? payload.territories : []);
    renderChart(paid ? payload.series : []);
    if (!paid) {
      var chart = $('[data-analytics-chart]');
      if (chart) chart.hidden = false;
    }
    var empty = isEmptyCatalog(payload);
    setHidden('[data-analytics-empty]', !empty);
    if (empty) setText('[data-analytics-empty]', emptyMessage());
  }

  function setStatus(text) {
    setText('[data-analytics-status]', text || '');
    setHidden('[data-analytics-status]', !text);
  }

  function loadAccount() {
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.whenReady === 'function') {
      return global.PlaigroundMembership.whenReady().then(function (result) {
        return (result && result.data) || null;
      });
    }
    return Promise.resolve(null);
  }

  function emptyPayload() {
    return { summary: { total_streams: 0, total_revenue_usd: 0 }, dsps: [], territories: [], series: [] };
  }

  function load() {
    if (!$('[data-analytics-metrics]')) return;
    setStatus('Loading catalog…');
    fetch(ANALYTICS_URL, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.json().then(function (body) {
          return { ok: response.ok, status: response.status, data: body || {} };
        }).catch(function () {
          return { ok: false, status: response.status, data: {} };
        });
      })
      .then(function (result) {
        return loadAccount().then(function (me) {
          return { result: result, me: me };
        });
      })
      .then(function (pack) {
        var result = pack.result;
        var me = pack.me;
        var known = me && me.profile && Array.isArray(me.profile.releases) && me.profile.releases.length;
        var hasLive = typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus.accountHasLive(me);
        var hideStats = Boolean(known && !hasLive);
        if (result.status === 401) {
          setStatus('Sign in to see your plays.');
          render(emptyPayload());
          return;
        }
        if (result.status === 503 || result.data.configured === false) {
          setStatus(result.data && result.data.error === 'Accounts are not configured.'
            ? 'Accounts are not configured.'
            : 'Catalog sync is not configured yet.');
          render(emptyPayload());
          return;
        }
        if (!result.ok) {
          setStatus(result.data.error || 'Could not load analytics.');
          render(emptyPayload());
          return;
        }
        render(hideStats ? emptyPayload() : result.data);
        if (result.data.errors) {
          setStatus('Some store analytics could not be loaded.');
        } else {
          setStatus('');
        }
      })
      .catch(function () {
        setStatus('Could not reach catalog.');
        render({ summary: {}, dsps: [], territories: [], series: [] });
      });
  }

  global.PlaigroundAnalytics = {
    render: render,
    isEmptyCatalog: isEmptyCatalog,
  };

  load();
})(window);
