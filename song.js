(function (global) {
  var DRAFT_KEY = 'plaiground.tonegrid.draft';
  var RELEASES_URL = '/api/tonegrid/releases';
  var ANALYTICS_URL = '/api/tonegrid/analytics';
  var DSP_COLORS = ['var(--green)', 'var(--magenta)', '#E24B4B', '#5B8CFF', 'var(--purple)'];

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
    return '$' + toNumber(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function setText(sel, text) {
    var el = $(sel);
    if (el) el.textContent = text == null ? '' : String(text);
  }

  function setHidden(sel, hidden) {
    var el = $(sel);
    if (!el) return;
    el.hidden = Boolean(hidden);
    if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
  }

  function queryId() {
    try {
      return String(new URLSearchParams(global.location.search).get('id') || '').trim();
    } catch (err) {
      return '';
    }
  }

  function readDraft() {
    try {
      return JSON.parse(global.localStorage.getItem(DRAFT_KEY) || '{}') || {};
    } catch (err) {
      try {
        return JSON.parse(global.sessionStorage.getItem(DRAFT_KEY) || '{}') || {};
      } catch (inner) {
        return {};
      }
    }
  }

  function currentPlan(me) {
    if (me && me.plan) return String(me.plan).toLowerCase();
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.currentPlan === 'function') {
      return String(global.PlaigroundMembership.currentPlan() || '').toLowerCase();
    }
    return '';
  }

  function isPaid(plan) {
    return plan === 'creator' || plan === 'pro';
  }

  function typeLabel(type) {
    if (type === 'ep') return 'EP';
    if (type === 'album') return 'Album';
    return 'Single';
  }

  function yearOf(date) {
    var raw = String(date || '').trim();
    if (/^\d{4}-/.test(raw)) return raw.slice(0, 4);
    if (/^\d{4}$/.test(raw)) return raw;
    return '';
  }

  function statusStep(release, draft) {
    var status = String((release && release.status) || '').toLowerCase();
    if (status === 'live') return 'live';
    if (status === 'rejected') return 'rejected';
    if (status === 'draft' && !(draft && draft.submitted)) return 'draft';
    var writers = (draft && Array.isArray(draft.writers)) ? draft.writers : [];
    var solo = Boolean(draft && (draft.solo_owned_100 === true || draft.solo_owned_100 === 'true')) && !String((draft && draft.featured) || '').trim();
    var signed = Boolean(draft && (draft.signwell_signed === true || String(draft.signwell_status || '') === 'Completed' || String(draft.signwell_status || '') === 'solo'));
    if (!solo && writers.length > 1 && !signed) return 'signatures';
    return 'review';
  }

  function statusLabel(step) {
    if (step === 'live') return 'Live';
    if (step === 'rejected') return 'Rejected';
    if (step === 'draft') return 'Draft';
    if (step === 'signatures') return 'Awaiting signatures';
    return 'In review';
  }

  function getJson(url) {
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (response) {
      return response.json().then(function (body) {
        return { ok: response.ok, status: response.status, data: body || {} };
      }).catch(function () {
        return { ok: false, status: response.status, data: {} };
      });
    });
  }

  function loadMe() {
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.whenReady === 'function') {
      return global.PlaigroundMembership.whenReady().then(function (result) {
        if (result && result.ok && result.data && !result.data.pending) return result.data;
        if (global.PlaigroundMembership.account) return global.PlaigroundMembership.account();
        return null;
      });
    }
    return getJson('/api/me').then(function (result) {
      return result.ok ? result.data : null;
    });
  }

  function accountIds(me) {
    var ids = (me && Array.isArray(me.tonegrid_release_ids)) ? me.tonegrid_release_ids.slice() : [];
    return ids.map(function (id) { return String(id || '').trim(); }).filter(Boolean);
  }

  function idAllowed(ids, id) {
    var want = String(id || '').toLowerCase();
    if (!want) return false;
    return ids.some(function (row) { return String(row).toLowerCase() === want; });
  }

  function draftRelease(draft, me) {
    if (!draft || !draft.release_id) return null;
    return {
      uuid: String(draft.release_id),
      title: String(draft.title || '').trim(),
      type: 'single',
      status: draft.submitted ? 'pending' : 'draft',
      genre: String(draft.genre || '').trim(),
      artwork_url: String(draft.artwork_url || '').trim(),
      release_date: String(draft.release_date || '').trim(),
      artist: String(draft.name || (me && me.artist) || '').trim(),
    };
  }

  function pickRelease(list, me, draft) {
    var ids = accountIds(me);
    var rows = Array.isArray(list) ? list.slice() : [];
    if (ids.length) {
      rows = rows.filter(function (row) { return idAllowed(ids, row.uuid); });
    }
    var requested = queryId();
    var draftRow = draftRelease(draft, me);
    if (draftRow && (!ids.length || idAllowed(ids, draftRow.uuid)) && !rows.some(function (row) {
      return String(row.uuid).toLowerCase() === String(draftRow.uuid).toLowerCase();
    })) {
      rows.push(draftRow);
    }
    if (ids.length && !rows.length) {
      ids.forEach(function (id) {
        rows.push({ uuid: String(id), title: '', type: 'single', status: 'pending' });
      });
    }
    function find(id) {
      var want = String(id || '').toLowerCase();
      if (!want) return null;
      for (var i = 0; i < rows.length; i += 1) {
        if (String(rows[i].uuid || '').toLowerCase() === want) return rows[i];
      }
      return null;
    }
    if (requested) {
      if (ids.length && !idAllowed(ids, requested)) return null;
      return find(requested) || (idAllowed(ids, requested) ? { uuid: requested, title: '', type: 'single', status: 'pending' } : null);
    }
    if (draftRow && idAllowed(ids, draftRow.uuid)) return find(draftRow.uuid) || draftRow;
    if (ids.length) return find(ids[ids.length - 1]) || find(ids[0]);
    return rows[0] || null;
  }

  function markLife(step) {
    $all('[data-life]').forEach(function (el) {
      var on = el.getAttribute('data-life') === step;
      if (el.classList && el.classList.toggle) el.classList.toggle('on', on);
    });
  }

  function setCover(url) {
    var el = $('[data-song-cover]');
    if (!el) return;
    var art = String(url || '').trim();
    if (el.style) {
      el.style.backgroundImage = art ? 'url("' + art.replace(/"/g, '') + '")' : '';
    }
    if (el.classList && el.classList.toggle) el.classList.toggle('has-art', Boolean(art));
    setText('[data-song-cover-note]', art ? 'Cover art' : 'No cover uploaded');
  }

  function splitWriters(release, draft, me) {
    var writers = (draft && Array.isArray(draft.writers)) ? draft.writers.filter(function (row) { return row && row.name; }) : [];
    var artist = String((release && release.artist) || (draft && draft.name) || (me && me.artist) || '').trim();
    var solo = Boolean(draft && (draft.solo_owned_100 === true || draft.solo_owned_100 === 'true')) && !String((draft && draft.featured) || '').trim();
    if (!writers.length && !solo) return [];
    if (solo || writers.length <= 1) {
      var one = writers[0] && writers[0].name ? writers[0] : { name: artist, share: 100, role: '' };
      if (!one.name) return [];
      return [{ name: one.name, role: one.role || '', share: one.share || 100, signed: true }];
    }
    var signed = Boolean(draft && (draft.signwell_signed === true || String(draft.signwell_status || '') === 'Completed'));
    return writers.map(function (row) {
      return {
        name: String((row && row.name) || '').trim() || 'Writer',
        role: String((row && (row.role || row.roles)) || '').trim(),
        share: toNumber(row && row.share),
        signed: signed,
      };
    });
  }

  function renderWriters(writers) {
    var host = $('[data-song-writers]');
    if (!host) return;
    host.textContent = '';
    writers.forEach(function (row) {
      var line = document.createElement('div');
      line.className = 'loc';
      var left = document.createElement('span');
      var bits = [row.name];
      if (row.role) bits.push(row.role);
      if (row.share) bits.push(String(row.share).replace(/\.0$/, '') + '%');
      left.textContent = bits.join(' · ');
      var right = document.createElement('span');
      right.className = row.signed ? 'live' : 'wait';
      right.textContent = row.signed ? 'Signed' : 'Awaiting signature';
      line.appendChild(left);
      line.appendChild(right);
      host.appendChild(line);
    });
  }

  function renderDsps(rows) {
    var host = $('[data-song-dsps]');
    if (!host) return;
    host.textContent = '';
    var list = rows || [];
    var total = list.reduce(function (sum, row) { return sum + toNumber(row.streams); }, 0);
    list.forEach(function (row, index) {
      var streams = toNumber(row.streams);
      var tr = document.createElement('tr');
      var name = document.createElement('td');
      name.textContent = row.dsp || row.name || 'Store';
      var count = document.createElement('td');
      count.textContent = formatCount(streams);
      var share = document.createElement('td');
      var bar = document.createElement('div');
      bar.className = 'share-bar';
      var fill = document.createElement('i');
      fill.style.width = (total ? Math.max(2, Math.round((streams / total) * 100)) : 0) + '%';
      fill.style.background = DSP_COLORS[index % DSP_COLORS.length];
      bar.appendChild(fill);
      share.appendChild(bar);
      var money = document.createElement('td');
      money.textContent = row.revenue_usd == null ? '—' : formatMoney(row.revenue_usd);
      tr.appendChild(name);
      tr.appendChild(count);
      tr.appendChild(share);
      tr.appendChild(money);
      host.appendChild(tr);
    });
    setHidden('[data-song-breakdown-empty]', list.length > 0);
  }

  function render(opts) {
    opts = opts || {};
    var me = opts.me || null;
    var draft = opts.draft || {};
    var release = opts.release || null;
    var analytics = opts.analytics || {};
    var plan = currentPlan(me);
    var paid = isPaid(plan);

    if (!release) {
      setText('[data-song-status]', opts.error || 'No release on this account yet.');
      setHidden('[data-song-status]', false);
      setText('[data-song-title]', 'Untitled');
      setText('[data-song-meta]', '');
      setText('[data-song-pill]', 'In review');
      markLife('review');
      setCover('');
      setText('[data-song-streams]', '0');
      setText('[data-song-earnings]', '$0.00');
      setHidden('[data-song-breakdown]', true);
      setHidden('[data-song-publishing]', true);
      setHidden('[data-song-boosts]', true);
      setHidden('[data-song-boost]', true);
      setHidden('[data-song-split-empty]', false);
      return;
    }

    setHidden('[data-song-status]', !opts.error);
    if (opts.error) setText('[data-song-status]', opts.error);

    var step = statusStep(release, draft);
    markLife(step);
    setText('[data-song-title]', release.title || 'Untitled');
    setText('[data-song-pill]', statusLabel(step));
    var pill = $('[data-song-pill]');
    if (pill && pill.classList) {
      pill.classList.toggle('pill-green', step === 'live');
    }
    var artist = String(release.artist || draft.name || (me && me.artist) || '').trim();
    var meta = [artist, typeLabel(release.type), yearOf(release.release_date), release.genre].filter(Boolean);
    setText('[data-song-meta]', meta.join(' · '));
    setCover(release.artwork_url);

    var summary = analytics.summary || {};
    var scoped = ((analytics.releases || []).filter(function (row) {
      return String(row.release_uuid || row.uuid || '').toLowerCase() === String(release.uuid || '').toLowerCase();
    })[0]) || {};
    setText('[data-song-streams]', formatCount(scoped.streams != null ? scoped.streams : summary.total_streams));
    setText('[data-song-earnings]', formatMoney(scoped.revenue_usd != null ? scoped.revenue_usd : summary.total_revenue_usd));

    var dsps = analytics.dsps || [];
    setHidden('[data-song-breakdown]', !paid);
    if (paid) renderDsps(dsps);

    var writers = splitWriters(release, draft, me);
    var hasWriters = writers.some(function (row) { return row.name; });
    setHidden('[data-song-split-empty]', hasWriters);
    if (hasWriters) {
      renderWriters(writers);
      var signedCount = writers.filter(function (row) { return row.signed; }).length;
      setText('[data-song-split-status]', signedCount + ' of ' + writers.length + ' signed');
      var statusEl = $('[data-song-split-status]');
      if (statusEl) statusEl.className = signedCount === writers.length ? 'live' : 'wait';
    } else {
      setText('[data-song-split-status]', '');
    }

    setHidden('[data-song-publishing]', !paid);
    setHidden('[data-song-boosts]', false);
    setHidden('[data-song-boost]', false);
    var boostCta = $('[data-song-boost]');
    if (boostCta) {
      boostCta.classList.toggle('is-off', !paid);
      if (paid) boostCta.removeAttribute('aria-disabled');
      else boostCta.setAttribute('aria-disabled', 'true');
    }
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.applyPlanCopy === 'function') {
      global.PlaigroundMembership.applyPlanCopy();
    }
  }

  function load() {
    if (!$('[data-song-title]')) return Promise.resolve(null);
    setText('[data-song-status]', 'Loading release…');
    setHidden('[data-song-status]', false);
    var draft = readDraft();
    return loadMe().then(function (me) {
      return Promise.all([
        getJson(RELEASES_URL),
        getJson(ANALYTICS_URL + (queryId() ? ('?release_uuid=' + encodeURIComponent(queryId())) : '')),
      ]).then(function (results) {
        var list = results[0];
        var analytics = results[1];
        var error = '';
        if (list.status === 401) error = 'Sign in to see this release.';
        else if (list.status === 503 || (list.data && list.data.configured === false)) error = 'Catalog sync is not configured yet.';
        else if (!list.ok && list.status) error = list.data.error || 'Could not load this release.';
        var release = pickRelease((list.ok && list.data.releases) || [], me, draft);
        if (release && queryId() && String(release.uuid).toLowerCase() === queryId().toLowerCase() && release.artwork_url == null) {
          return getJson(RELEASES_URL + '/' + encodeURIComponent(release.uuid)).then(function (one) {
            if (one.ok && one.data && one.data.uuid) release = one.data;
            render({
              me: me,
              draft: draft,
              release: release,
              analytics: analytics.ok ? analytics.data : {},
              error: error,
            });
            return release;
          });
        }
        if (release && !release.artwork_url && release.uuid) {
          return getJson(RELEASES_URL + '/' + encodeURIComponent(release.uuid)).then(function (one) {
            if (one.ok && one.data && (one.data.artwork_url || one.data.title)) {
              release = Object.assign({}, release, one.data);
            }
            render({
              me: me,
              draft: draft,
              release: release,
              analytics: analytics.ok ? analytics.data : {},
              error: error,
            });
            return release;
          });
        }
        render({
          me: me,
          draft: draft,
          release: release,
          analytics: analytics.ok ? analytics.data : {},
          error: error || (release ? '' : 'No release on this account yet.'),
        });
        return release;
      });
    }).catch(function () {
      render({ draft: draft, error: 'Could not reach catalog.' });
      return null;
    });
  }

  global.PlaigroundSong = {
    render: render,
    pickRelease: pickRelease,
    statusStep: statusStep,
    splitWriters: splitWriters,
    load: load,
  };
  load();
})(window);
