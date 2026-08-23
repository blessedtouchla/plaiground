(function (global) {
  var ANALYTICS_URL = '/api/tonegrid/analytics';
  var DSP_COLORS = ['var(--green)', 'var(--magenta)', '#5B8CFF', '#E89A3F', 'var(--purple)', 'var(--gold)'];

  function $(sel) {
    return document.querySelector(sel);
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

  function setText(sel, text) {
    var el = $(sel);
    if (el) el.textContent = text;
  }

  function setHidden(sel, hidden) {
    var el = $(sel);
    if (el) el.hidden = Boolean(hidden);
  }

  function emptyMessage() {
    return 'No plays yet. New uploads will show here when ToneGrid has numbers.';
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

  function isLocked(data) {
    var plan = String((data && data.plan) || '').toLowerCase();
    if (plan === 'creator' || plan === 'pro') return false;
    return !data || plan === 'basic' || (Array.isArray(data.locked) && data.locked.length);
  }

  function render(data) {
    var payload = data || {};
    var locked = isLocked(payload);
    renderMetrics({
      summary: {
        total_streams: payload.summary && payload.summary.total_streams,
        total_revenue_usd: payload.summary && payload.summary.total_revenue_usd,
        top_release: locked ? null : payload.summary && payload.summary.top_release,
        top_dsp: locked ? '' : payload.summary && payload.summary.top_dsp,
      },
    });
    renderBars('[data-analytics-dsps]', locked ? [] : payload.dsps, 'dsp');
    renderLocations(locked ? [] : payload.territories);
    renderChart(locked ? [] : payload.series);
    var empty = isEmptyCatalog(payload);
    setHidden('[data-analytics-empty]', !empty);
    if (empty) setText('[data-analytics-empty]', emptyMessage());
  }

  function setStatus(text) {
    setText('[data-analytics-status]', text || '');
    setHidden('[data-analytics-status]', !text);
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
        if (result.status === 401) {
          setStatus('Sign in to see your plays.');
          render({ summary: {}, dsps: [], territories: [], series: [] });
          return;
        }
        if (result.status === 503 || result.data.configured === false) {
          setStatus(result.data && result.data.error === 'Accounts are not configured.'
            ? 'Accounts are not configured.'
            : 'Catalog sync is not configured yet.');
          render({ summary: {}, dsps: [], territories: [], series: [] });
          return;
        }
        if (!result.ok) {
          setStatus(result.data.error || 'Could not load analytics.');
          render({ summary: {}, dsps: [], territories: [], series: [] });
          return;
        }
        render(result.data);
        if (result.data.errors) {
          setStatus('Some ToneGrid analytics could not be loaded.');
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
