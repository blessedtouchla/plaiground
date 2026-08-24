(function (global) {
  var ROYALTIES_URL = '/api/tonegrid/royalties';

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

  function formatMoney(value) {
    var n = toNumber(value);
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatCount(value) {
    return toNumber(value).toLocaleString('en-US');
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
    return 'No royalties yet.';
  }

  function isEmpty(data) {
    var balance = (data && data.balance) || {};
    var available = toNumber(balance.available_usd);
    var pending = toNumber(balance.pending_usd);
    var statementTotal = ((data && data.statements) || []).reduce(function (sum, row) {
      return sum + toNumber(row.total_usd);
    }, 0);
    var breakdownTotal = ((data && data.breakdown) || []).reduce(function (sum, row) {
      return sum + toNumber(row.revenue_usd) + toNumber(row.streams);
    }, 0);
    return available === 0 && pending === 0 && statementTotal === 0 && breakdownTotal === 0;
  }

  function renderMetrics(data) {
    var balance = (data && data.balance) || {};
    setText('[data-earn="available"]', formatMoney(balance.available_usd));
    setText('[data-earn="pending"]', formatMoney(balance.pending_usd));
  }

  function renderSources(data) {
    var host = $('[data-earn-sources]');
    var period = $('[data-earn-period]');
    if (!host) return;
    host.textContent = '';
    var rows = (data && data.breakdown) || [];
    if (period) {
      var latest = data && data.statements && data.statements[0];
      period.textContent = latest && latest.period ? latest.period : '';
    }
    if (!rows.length) {
      var empty = document.createElement('tr');
      var cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = emptyMessage();
      empty.appendChild(cell);
      host.appendChild(empty);
      return;
    }
    var grouped = {};
    var totalStreams = 0;
    rows.forEach(function (row) {
      var name = row.dsp || 'Other';
      if (!grouped[name]) grouped[name] = { dsp: name, streams: 0, revenue_usd: 0 };
      grouped[name].streams += toNumber(row.streams);
      grouped[name].revenue_usd += toNumber(row.revenue_usd);
      totalStreams += toNumber(row.streams);
    });
    Object.keys(grouped).forEach(function (name) {
      var row = grouped[name];
      var tr = document.createElement('tr');
      var share = totalStreams ? Math.round((row.streams / totalStreams) * 100) + '%' : '0%';
      [row.dsp, formatCount(row.streams), share, formatMoney(row.revenue_usd)].forEach(function (text) {
        var td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      host.appendChild(tr);
    });
  }

  function renderChart(statements) {
    var panel = $('[data-earn-chart]');
    var bars = $('[data-earn-chart-bars]');
    var labels = $('[data-earn-chart-labels]');
    if (!panel || !bars || !labels) return;
    var list = (statements || []).slice().reverse().slice(-6);
    if (!list.length) {
      panel.hidden = true;
      bars.textContent = '';
      labels.textContent = '';
      return;
    }
    panel.hidden = false;
    bars.textContent = '';
    labels.textContent = '';
    var max = 0;
    list.forEach(function (row) {
      var value = toNumber(row.total_usd);
      if (value > max) max = value;
    });
    list.forEach(function (row) {
      var value = toNumber(row.total_usd);
      var bar = document.createElement('b');
      bar.style.height = (max ? Math.max(4, Math.round((value / max) * 100)) : 4) + '%';
      if (!value) bar.className = 'zero';
      bars.appendChild(bar);
      var label = document.createElement('span');
      label.textContent = row.period || '';
      labels.appendChild(label);
    });
  }

  function latestStatement(data) {
    var list = (data && data.statements) || [];
    return list.length ? list[0] : null;
  }

  function csvEscape(value) {
    var text = String(value == null ? '' : value);
    if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function statementCsv(data) {
    var statement = latestStatement(data);
    var rows = [['Period', 'Source', 'Streams', 'Earnings']];
    var period = statement && statement.period ? statement.period : '';
    var breakdown = (data && data.breakdown) || [];
    if (!breakdown.length) {
      rows.push([period || '', 'No statement yet', '0', formatMoney(0)]);
    } else {
      breakdown.forEach(function (row) {
        rows.push([
          period,
          row.dsp || 'Other',
          formatCount(row.streams),
          formatMoney(row.revenue_usd),
        ]);
      });
    }
    return rows.map(function (line) {
      return line.map(csvEscape).join(',');
    }).join('\n');
  }

  function downloadBlob(filename, text) {
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var url = (global.URL && URL.createObjectURL) ? URL.createObjectURL(blob) : '';
    var link = document.createElement('a');
    link.href = url || ('data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    if (link.parentNode) link.parentNode.removeChild(link);
    if (url && global.URL && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(url); } catch (err) {}
    }
  }

  function noStatementMessage() {
    return 'No statement yet';
  }

  function downloadStatement(data) {
    var payload = data || emptyPayload();
    if (isEmpty(payload) || !latestStatement(payload)) {
      setStatus(noStatementMessage());
      setHidden('[data-earn-empty]', false);
      setText('[data-earn-empty]', noStatementMessage() + '. $0.00 available.');
      renderMetrics(emptyPayload());
      return false;
    }
    downloadBlob('plaiground-statement.csv', statementCsv(payload));
    return true;
  }

  var lastPayload = emptyPayload();

  function render(data) {
    var payload = data || {};
    lastPayload = payload;
    renderMetrics(payload);
    renderSources(payload);
    renderChart(payload.statements);
    var empty = isEmpty(payload);
    setHidden('[data-earn-empty]', !empty);
    if (empty) setText('[data-earn-empty]', emptyMessage());
  }

  function setStatus(text) {
    setText('[data-earn-status]', text || '');
    setHidden('[data-earn-status]', !text);
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
    return { balance: { available_usd: 0, pending_usd: 0 }, statements: [], breakdown: [] };
  }

  function load() {
    if (!$('[data-earn-metrics]')) return;
    setStatus('Loading earnings…');
    fetch(ROYALTIES_URL, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
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
          setStatus('Sign in to see your royalties.');
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
          setStatus(result.data.error || 'Could not load earnings.');
          render(emptyPayload());
          return;
        }
        render(hideStats ? emptyPayload() : result.data);
        setStatus(result.data.errors ? 'Some store earnings could not be loaded.' : '');
      })
      .catch(function () {
        setStatus('Could not reach catalog.');
        render({ balance: {}, statements: [], breakdown: [] });
      });
  }

  function bindDownload() {
    var btn = $('[data-earn-download]');
    if (!btn || !btn.addEventListener) return;
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      downloadStatement(lastPayload);
    });
  }

  global.PlaigroundEarnings = {
    render: render,
    isEmpty: isEmpty,
    downloadStatement: downloadStatement,
    statementCsv: statementCsv,
  };
  bindDownload();
  load();
})(window);
