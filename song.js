(function (global) {
  var DRAFT_KEY = 'plaiground.store.draft';
  var RELEASES_URL = '/api/tonegrid/releases';
  var ANALYTICS_URL = '/api/tonegrid/analytics';
  var DSP_COLORS = ['var(--green)', 'var(--magenta)', '#E24B4B', '#5B8CFF', 'var(--purple)'];

  function $(sel) {
    if (sel && sel.charAt(0) === '#' && document.getElementById) {
      var byId = document.getElementById(sel.slice(1));
      if (byId) return byId;
    }
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

  function queryEdit() {
    try {
      return String(new URLSearchParams(global.location.search).get('edit') || '').trim() === '1';
    } catch (err) {
      return false;
    }
  }

  function releaseId(release) {
    return String((release && (release.uuid || release.release_uuid || release.id)) || queryId() || '').trim();
  }

  function editHref(id) {
    var next = String(id || '').trim();
    return next ? ('song.html?id=' + encodeURIComponent(next) + '&edit=1') : 'song.html';
  }

  function showSongError(text) {
    setText('[data-song-status]', text || '');
    setHidden('[data-song-status]', !text);
  }

  function markEditHref(id) {
    var el = $('[data-song-edit]');
    if (!el || !el.setAttribute) return;
    el.setAttribute('href', editHref(id));
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

  function writeDraftFor(releaseId, patch) {
    var draft = readDraft();
    var current = String(draft.release_id || '').toLowerCase();
    var want = String(releaseId || '').toLowerCase();
    if (current && want && current !== want) return draft;
    Object.keys(patch || {}).forEach(function (key) {
      if (patch[key] !== undefined) draft[key] = patch[key];
    });
    if (want && !draft.release_id) draft.release_id = releaseId;
    var text = JSON.stringify(draft);
    try { global.localStorage.setItem(DRAFT_KEY, text); } catch (err) {}
    try { global.sessionStorage.setItem(DRAFT_KEY, text); } catch (err) {}
    return draft;
  }

  function toIsoDate(value) {
    var raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    var mdy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!mdy) return '';
    return mdy[3] + '-' + String(mdy[1]).padStart(2, '0') + '-' + String(mdy[2]).padStart(2, '0');
  }

  function pad2(n) {
    return String(n).padStart ? String(n).padStart(2, '0') : ('0' + n).slice(-2);
  }

  function toLocalIsoDate(d) {
    if (!d || typeof d.getFullYear !== 'function') return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function minSubmitDate() {
    var d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalIsoDate(d);
  }

  function todayLocal() {
    return toLocalIsoDate(new Date());
  }

  function isReadyEditDate(date, existing) {
    var picked = toIsoDate(date);
    if (!picked) return false;
    if (picked >= minSubmitDate()) return true;
    var keep = toIsoDate(existing);
    return Boolean(keep && picked === keep);
  }

  function markEditDateState(dateEl, date, existing) {
    var ready = isReadyEditDate(date, existing);
    var tooSoon = Boolean(date && !ready);
    var message = tooSoon ? 'Stores need 7 days of lead time.' : '';
    if (dateEl && typeof dateEl.setCustomValidity === 'function') {
      dateEl.setCustomValidity(message);
    }
    if (dateEl && dateEl.classList) {
      if (dateEl.classList.toggle) dateEl.classList.toggle('is-invalid', tooSoon);
      else if (tooSoon && dateEl.classList.add) dateEl.classList.add('is-invalid');
      else if (dateEl.classList.remove) dateEl.classList.remove('is-invalid');
    }
    if (dateEl && dateEl.setAttribute) {
      if (tooSoon) dateEl.setAttribute('aria-invalid', 'true');
      else if (dateEl.removeAttribute) dateEl.removeAttribute('aria-invalid');
    }
    var hint = typeof document !== 'undefined' && document.getElementById
      ? document.getElementById('edit-release-date-hint')
      : null;
    if (hint && hint.classList) {
      if (hint.classList.toggle) hint.classList.toggle('is-error', tooSoon);
      else if (tooSoon && hint.classList.add) hint.classList.add('is-error');
      else if (hint.classList.remove) hint.classList.remove('is-error');
    }
    return ready;
  }

  function todayUtc() {
    return new Date().toISOString().slice(0, 10);
  }

  function truthyFlag(value, fallback) {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return fallback;
  }

  function setSwitch(input, on) {
    if (!input) return;
    input.checked = Boolean(on);
    if (input.setAttribute) input.setAttribute('aria-checked', on ? 'true' : 'false');
    var knob = input.nextElementSibling;
    if (knob && knob.classList) {
      if (on) knob.classList.add('on');
      else knob.classList.remove('on');
    }
  }

  function setPanel(panel, show) {
    if (!panel) return;
    panel.hidden = !show;
    if (panel.classList && panel.classList.toggle) panel.classList.toggle('is-hidden', !show);
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

  function statusApi() {
    return (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus) || null;
  }

  function statusStep(release, draft) {
    var status = String((release && (release.status || release.tonegrid_status)) || '').toLowerCase();
    if (draft && draft.tonegrid_status && !status) status = String(draft.tonegrid_status).toLowerCase();
    var api = statusApi();
    var g = api ? api.group(status) : '';
    if (g === 'live' || g === 'rejected' || g === 'processing' || g === 'pending' || g === 'taken_down') return g;
    if (status === 'live' || status === 'delivered') return 'live';
    if (status === 'rejected' || status === 'needs-fix' || status === 'needs_fix') return 'rejected';
    if (status === 'approved' || status === 'processing' || status === 'delivering') return 'processing';
    if (status === 'pending') return 'pending';
    if (status === 'draft' && !(draft && draft.submitted)) return 'draft';
    var writers = (draft && Array.isArray(draft.writers)) ? draft.writers : [];
    var solo = Boolean(draft && (draft.solo_owned_100 === true || draft.solo_owned_100 === 'true')) && !String((draft && draft.featured) || '').trim();
    var signed = Boolean(draft && (draft.signwell_signed === true || String(draft.signwell_status || '') === 'Completed' || String(draft.signwell_status || '') === 'solo'));
    if (!solo && writers.length > 1 && !signed && !(draft && draft.submitted)) return 'signatures';
    if (draft && draft.submitted) return 'pending';
    return g || 'draft';
  }

  function storedRelease(me, release) {
    var list = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
    var want = String((release && (release.uuid || release.id)) || '').toLowerCase();
    var i;
    for (i = 0; i < list.length; i += 1) {
      var id = String((list[i] && (list[i].tonegrid_release_id || list[i].id)) || '').toLowerCase();
      if (want && id === want) return list[i];
    }
    return null;
  }

  function statusLabel(step) {
    var api = statusApi();
    if (api) return api.label(step);
    if (step === 'live') return 'Live';
    if (step === 'rejected') return 'Needs fix';
    if (step === 'draft') return 'Draft';
    if (step === 'signatures') return 'Awaiting signatures';
    if (step === 'processing') return 'Processing';
    return 'Pending';
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
      language: String(draft.language || '').trim(),
      artwork_url: String(draft.artwork_url || '').trim(),
      release_date: String(draft.release_date || '').trim(),
      artist: String(draft.name || (me && me.artist) || '').trim(),
      dsps: Array.isArray(draft.dsps) ? draft.dsps.slice() : [],
      tracks: draft.track_id ? [{ uuid: String(draft.track_id), title: String(draft.title || '').trim(), language: String(draft.language || '').trim() }] : [],
    };
  }

  function pickRelease(list, me, draft) {
    var ids = accountIds(me);
    var rows = Array.isArray(list) ? list.slice() : [];
    rows = rows.map(function (row) {
      if (!row || row.uuid) return row;
      var fallback = String(row.release_uuid || row.id || '').trim();
      return fallback ? Object.assign({}, row, { uuid: fallback }) : row;
    });
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
      lastEdit = { me: me, draft: draft, release: null, analytics: analytics };
      setText('[data-song-status]', opts.error || 'No release on this account yet.');
      setHidden('[data-song-status]', false);
      setText('[data-song-title]', 'Untitled');
      setText('[data-song-meta]', '');
      setText('[data-song-pill]', 'Pending');
      markLife('pending');
      setCover('');
      setText('[data-song-streams]', '0');
      setText('[data-song-earnings]', '$0.00');
      setHidden('[data-song-breakdown]', true);
      setHidden('[data-song-publishing]', true);
      setHidden('[data-song-boosts]', true);
      setHidden('[data-song-boost]', true);
      setHidden('[data-song-edit]', true);
      markEditHref('');
      setHidden('[data-song-remove]', true);
      setHidden('[data-song-split-empty]', false);
      setHidden('[data-song-rejection]', true);
      mountLivePlayer(null);
      mountSongLinks(null);
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
      pill.classList.toggle('is-yellow', step === 'pending' || step === 'processing');
      pill.classList.toggle('is-red', step === 'rejected');
    }
    var stored = storedRelease(me, release);
    if (stored && stored.tonegrid_status && !(release && release.status)) {
      release.status = stored.tonegrid_status;
    }
    var rejection = String((release && release.rejection_reason) || (stored && stored.rejection_reason) || '').trim();
    var rejected = step === 'rejected' || Boolean(rejection);
    setHidden('[data-song-rejection]', !rejected);
    setText('[data-song-rejection-reason]', rejection || 'The store sent this release back. Fix the details and resubmit.');

    var artist = String(release.artist || draft.name || (me && me.artist) || '').trim();
    var meta = [artist, typeLabel(release.type), yearOf(release.release_date), release.genre].filter(Boolean);
    setText('[data-song-meta]', meta.join(' · '));
    setCover(release.artwork_url);

    var summary = analytics.summary || {};
    var scoped = ((analytics.releases || []).filter(function (row) {
      return String(row.release_uuid || row.uuid || '').toLowerCase() === String(release.uuid || '').toLowerCase();
    })[0]) || {};
    var showStats = step === 'live';
    setText('[data-song-streams]', formatCount(showStats && scoped.streams != null ? scoped.streams : (showStats ? summary.total_streams : 0)));
    setText('[data-song-earnings]', formatMoney(showStats && scoped.revenue_usd != null ? scoped.revenue_usd : (showStats ? summary.total_revenue_usd : 0)));

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
    var id = releaseId(release);
    if (id && !release.uuid) release.uuid = id;
    markEditHref(id);
    setHidden('[data-song-edit]', false);
    setHidden('[data-song-remove]', !me || !id || step === 'taken_down');
    var boostCta = $('[data-song-boost]');
    if (boostCta) {
      boostCta.classList.toggle('is-off', !paid);
      if (paid) boostCta.removeAttribute('aria-disabled');
      else boostCta.setAttribute('aria-disabled', 'true');
    }
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.applyPlanCopy === 'function') {
      global.PlaigroundMembership.applyPlanCopy();
    }
    lastEdit = { me: me, draft: draft, release: release, analytics: analytics };
    var playerRelease = Object.assign({}, release, { status: step });
    mountLivePlayer(playerRelease);
    mountSongLinks(playerRelease);
    if (queryEdit() && !editClosed) openEdit({ me: me, draft: draft, release: release });
  }

  function mountLivePlayer(release) {
    var host = $('[data-song-player]');
    var api = global.PlaigroundLivePlayer;
    if (!host || !api) return;
    api.mount(host, release);
  }

  function mountSongLinks(release) {
    var panel = $('[data-song-links]');
    var list = $('[data-song-link-list]');
    var api = global.PlaigroundLivePlayer;
    if (!panel) return;
    var info = api && typeof api.mountLinks === 'function'
      ? api.mountLinks(list, release)
      : { live: false, links: [] };
    var show = Boolean(info && info.live && info.links && info.links.length);
    setHidden('[data-song-links]', !show);
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

  function parseSave(response) {
    return response.json().then(function (data) {
      return { ok: response.ok, status: response.status, data: data || {} };
    }).catch(function () {
      return { ok: false, status: response.status, data: { error: 'The store rejected the edit.' } };
    });
  }

  function sendJson(url, method, body) {
    return fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body == null ? undefined : JSON.stringify(body),
    }).then(parseSave);
  }

  function isCreateReleaseUrl(url, method) {
    if (String(method || '').toUpperCase() !== 'POST') return false;
    var path = String(url || '').split('?')[0].replace(/\/$/, '');
    return /\/api\/tonegrid\/releases$/.test(path) || /\/api\/tonegrid\/artists$/.test(path);
  }

  function setEditError(text) {
    setText('[data-edit-error]', text || '');
    setHidden('[data-edit-error]', !text);
  }

  function setFieldWhy(name, text) {
    var el = $('[data-edit-why="' + name + '"]');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  function lockControl(el, whyName, reason) {
    if (el) {
      el.disabled = true;
      if (el.setAttribute) el.setAttribute('aria-disabled', 'true');
      var field = el.closest ? el.closest('.field') : null;
      if (field && field.classList) field.classList.add('is-locked');
    }
    if (whyName && reason) setFieldWhy(whyName, reason);
  }

  function applyToneGridError(result, whyName, el) {
    var message = sanitizePartnerCopy((result && result.data && result.data.error) || 'The store rejected the edit.');
    if (el || whyName) lockControl(el, whyName, message);
    return message;
  }

  function storePickRoot() {
    return $('[data-store-pick]') || $('[data-edit-stores]');
  }

  function selectedStores() {
    var root = storePickRoot();
    if (root && global.PlaigroundStorePick && typeof global.PlaigroundStorePick.selected === 'function') {
      return global.PlaigroundStorePick.selected(root);
    }
    var host = $('[data-edit-stores]');
    if (!host || !host.querySelectorAll) return [];
    return Array.prototype.slice.call(host.querySelectorAll('input[type="checkbox"]:checked')).map(function (box) {
      return box.value;
    });
  }

  function fillStores(stores, selected) {
    var root = storePickRoot();
    if (root && global.PlaigroundStorePick && typeof global.PlaigroundStorePick.bind === 'function') {
      global.PlaigroundStorePick.bind(root, {
        stores: stores,
        selected: selected && selected.length ? selected : null,
      });
      return;
    }
    var host = $('[data-edit-stores]');
    if (!host) return;
    host.textContent = '';
    var picked = {};
    var allOn = !selected || !selected.length;
    (selected || []).forEach(function (slug) { picked[String(slug).toLowerCase()] = true; });
    (stores || []).forEach(function (row) {
      var slug = typeof row === 'string' ? row : row.slug;
      if (!slug) return;
      var label = document.createElement('label');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.value = slug;
      box.checked = allOn || Boolean(picked[slug.toLowerCase()]);
      label.appendChild(box);
      if (document.createTextNode) label.appendChild(document.createTextNode(' ' + (row.name || slug)));
      else label.textContent = (label.textContent || '') + ' ' + (row.name || slug);
      host.appendChild(label);
    });
  }

  function selectedExplicit() {
    var on = document.querySelector('[data-edit-explicit] [data-explicit].on');
    return Boolean(on && on.getAttribute('data-explicit') === 'true');
  }

  function selectedMadeHow() {
    var on = document.querySelector('[data-edit-made-how].on');
    return on ? on.getAttribute('data-edit-made-how') : '';
  }

  function setExplicit(on) {
    $all('[data-edit-explicit] [data-explicit]').forEach(function (el) {
      var yes = el.getAttribute('data-explicit') === 'true';
      if (el.classList && el.classList.toggle) el.classList.toggle('on', Boolean(on) === yes);
    });
  }

  function setMadeHow(value) {
    $all('[data-edit-made-how]').forEach(function (el) {
      if (el.classList && el.classList.toggle) el.classList.toggle('on', el.getAttribute('data-edit-made-how') === value);
    });
  }

  function persistEditReleaseDate(dateEl, opts) {
    opts = opts || {};
    if (!dateEl) return '';
    var raw = String(dateEl.value || '').trim();
    var picked = toIsoDate(raw);
    var release = lastEdit && lastEdit.release;
    var releaseId = release && release.uuid;
    var existing = toIsoDate(release && release.release_date);
    if (!raw && opts.ignoreEmpty) {
      var kept = toIsoDate(readDraft().release_date) || existing;
      if (kept && !dateEl.value) dateEl.value = kept;
      markEditDateState(dateEl, dateEl.value || kept, existing);
      return toIsoDate(dateEl.value) || kept || '';
    }
    if (picked) {
      if (dateEl.value !== picked) dateEl.value = picked;
      markEditDateState(dateEl, picked, existing);
      if (releaseId) writeDraftFor(releaseId, { release_date: picked });
      return picked;
    }
    var snap = (existing && existing < minSubmitDate()) ? existing : minSubmitDate();
    dateEl.value = snap;
    markEditDateState(dateEl, snap, existing);
    if (releaseId) writeDraftFor(releaseId, { release_date: snap });
    return snap;
  }

  function collectSchedule() {
    var preorderOn = $('#edit-preorder-on');
    var timeOn = $('#edit-time-on');
    var preorderEl = $('#edit-preorder-date');
    var timeEl = $('#edit-release-time');
    var zoneEl = $('#edit-release-timezone');
    var releaseDate = persistEditReleaseDate($('#edit-release-date'), { ignoreEmpty: true });
    var selectPreorder = Boolean(preorderOn && preorderOn.checked);
    var defineTime = Boolean(timeOn && timeOn.checked);
    if (preorderEl) {
      preorderEl.min = todayUtc();
      if (releaseDate) preorderEl.max = releaseDate;
      else if (preorderEl.removeAttribute) preorderEl.removeAttribute('max');
    }
    setSwitch(preorderOn, selectPreorder);
    setSwitch(timeOn, defineTime);
    setPanel($('#edit-preorder-panel'), selectPreorder);
    setPanel($('#edit-time-panel'), defineTime);
    return {
      select_preorder: selectPreorder,
      preorder_date: selectPreorder ? toIsoDate(preorderEl && preorderEl.value) : '',
      define_time: defineTime,
      release_time: timeEl ? String(timeEl.value || '').trim() : '',
      release_timezone: zoneEl ? String(zoneEl.value || '').trim() : '',
      release_date: releaseDate,
    };
  }

  function bindSchedule() {
    ['edit-preorder-on', 'edit-time-on', 'edit-preorder-date', 'edit-release-time', 'edit-release-timezone', 'edit-release-date'].forEach(function (id) {
      var el = $('#' + id);
      if (!el || !el.addEventListener) return;
      el.addEventListener('change', function () {
        if (id === 'edit-release-date') persistEditReleaseDate(el);
        collectSchedule();
      });
      el.addEventListener('input', function () {
        if (id === 'edit-release-date') persistEditReleaseDate(el, { ignoreEmpty: true });
        collectSchedule();
      });
    });
  }

  function syncLanguageField(instrumental) {
    var field = $('[data-language-field]');
    if (!field) return;
    field.hidden = Boolean(instrumental);
    if (field.classList && field.classList.toggle) field.classList.toggle('is-hidden', Boolean(instrumental));
  }

  function syncLyricsField(instrumental) {
    var field = $('[data-edit-lyrics-field]');
    if (!field) return;
    field.hidden = Boolean(instrumental);
    if (field.classList && field.classList.toggle) field.classList.toggle('is-hidden', Boolean(instrumental));
  }

  function selectedEditLyrics(instrumental) {
    if (instrumental) return '';
    var el = $('#edit-lyrics');
    return el ? String(el.value || '') : '';
  }

  function fillCatalogSelects() {
    var catalog = global.PlaigroundUploadCatalog;
    if (catalog && typeof catalog.fillUploadSelects === 'function') {
      try { catalog.fillUploadSelects(document); } catch (err) {}
    }
    var genre = $('#edit-genre');
    var language = $('#edit-language');
    if (catalog && genre && genre.options && genre.options.length < 3 && catalog.GENRES) {
      catalog.GENRES.forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        genre.appendChild(opt);
      });
    }
    if (catalog && language && language.options && language.options.length < 3 && catalog.LANGUAGES) {
      catalog.LANGUAGES.forEach(function (row) {
        var opt = document.createElement('option');
        opt.value = row.code;
        opt.textContent = row.name;
        language.appendChild(opt);
      });
    }
    if (catalog && typeof catalog.bindTypeahead === 'function') {
      if (genre && catalog.GENRES) catalog.bindTypeahead(genre, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
      if (language && catalog.LANGUAGES) {
        catalog.bindTypeahead(language, catalog.LANGUAGES, function (row) { return row.code; }, function (row) { return row.name; });
      }
    }
  }

  function syncCatalogValues() {
    var catalog = global.PlaigroundUploadCatalog;
    if (!catalog || typeof catalog.syncTypeahead !== 'function') return;
    catalog.syncTypeahead($('#edit-genre'));
    catalog.syncTypeahead($('#edit-language'));
  }

  function setCatalogValue(select, value) {
    var catalog = global.PlaigroundUploadCatalog;
    if (catalog && typeof catalog.setTypeaheadValue === 'function') {
      return catalog.setTypeaheadValue(select, value);
    }
    if (select) select.value = value || '';
    return select ? select.value : '';
  }

  function pickedGenre(fallback) {
    var raw = $('#edit-genre') ? String($('#edit-genre').value || '').trim() : '';
    var catalog = global.PlaigroundUploadCatalog;
    if (catalog && typeof catalog.canonicalCatalogValue === 'function') {
      var canon = catalog.canonicalCatalogValue($('#edit-genre'), raw);
      if (canon === '') return '';
      if (canon) return canon;
      var keep = String(fallback || '').trim();
      if (keep && raw && keep.toLowerCase() === raw.toLowerCase()) return keep;
      return null;
    }
    return raw;
  }

  function audioAllowed(file) {
    if (!file) return Promise.resolve(true);
    var accept = global.PlaigroundAudioAccept;
    if (accept && typeof accept.fileLooksAllowed === 'function') return accept.fileLooksAllowed(file);
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    return Promise.resolve(/\.(wav|flac|mp3|mpeg|mpga)$/.test(name) || /audio\/(wav|x-wav|wave|flac|x-flac|mpeg|mp3|x-mpeg|x-mp3|mpeg3|mpg)/.test(type));
  }

  function currentEditState() {
    return lastEdit || {};
  }

  var lastEdit = { me: null, draft: {}, release: null, analytics: {} };
  var editClosed = false;

  function openEdit(opts) {
    opts = opts || {};
    var panel = $('[data-release-edit]');
    var release = opts.release || lastEdit.release;
    var draft = opts.draft || lastEdit.draft || {};
    var me = opts.me || lastEdit.me;
    var id = releaseId(release);
    if (release && id && !release.uuid) release.uuid = id;
    if (!panel) {
      showSongError('Could not open the editor on this page.');
      return false;
    }
    if (!id) {
      showSongError('This release has no store ID yet, so it cannot be edited.');
      return false;
    }
    lastEdit = { me: me, draft: draft, release: release, analytics: opts.analytics || lastEdit.analytics || {} };
    editClosed = false;
    panel.hidden = false;
    if (panel.classList && panel.classList.toggle) panel.classList.toggle('is-hidden', false);
    panel.setAttribute('data-release-id', id);
    markEditHref(id);
    setText('[data-edit-status]', statusLabel(statusStep(release, draft)));
    fillCatalogSelects();
    var title = $('#edit-title');
    var artist = $('#edit-artist');
    var featured = $('#edit-featured');
    var genre = $('#edit-genre');
    var language = $('#edit-language');
    var price = $('#edit-price');
    var dateEl = $('#edit-release-date');
    var inst = $('#edit-instrumental');
    var lyrics = $('#edit-lyrics');
    var track = (release.tracks && release.tracks[0]) || {};
    if (title) title.value = release.title || draft.title || '';
    if (artist) {
      artist.value = String(release.artist || draft.name || (me && me.artist) || '').trim();
      artist.disabled = true;
    }
    if (featured) featured.value = String(draft.featured || '').trim();
    setCatalogValue(genre, release.genre || draft.genre || '');
    setCatalogValue(language, release.language || track.language || draft.language || '');
    syncCatalogValues();
    if (price) price.value = draft.price || '';
    if (inst) inst.checked = Boolean(draft.instrumental);
    if (lyrics) lyrics.value = String(draft.lyrics || (track && track.lyrics) || '');
    syncLanguageField(inst && inst.checked);
    syncLyricsField(inst && inst.checked);
    var existingDate = toIsoDate(release.release_date || draft.release_date);
    if (dateEl) {
      dateEl.type = 'date';
      // Do not set min to the 7-day lock — iOS clears any tap below min.
      if (existingDate && existingDate < todayLocal()) dateEl.min = existingDate;
      else {
        dateEl.min = '';
        if (dateEl.removeAttribute) dateEl.removeAttribute('min');
      }
      if (dateEl.setAttribute) dateEl.setAttribute('aria-describedby', 'edit-release-date-hint');
      dateEl.value = existingDate || '';
      markEditDateState(dateEl, existingDate, existingDate);
    }
    var preorderOn = $('#edit-preorder-on');
    var timeOn = $('#edit-time-on');
    var preorderEl = $('#edit-preorder-date');
    var timeEl = $('#edit-release-time');
    var zoneEl = $('#edit-release-timezone');
    setSwitch(preorderOn, truthyFlag(draft.select_preorder, Boolean(toIsoDate(draft.preorder_date))));
    setSwitch(timeOn, truthyFlag(draft.define_time, true));
    if (preorderEl) preorderEl.value = toIsoDate(draft.preorder_date);
    if (timeEl) timeEl.value = draft.release_time || timeEl.value || '00:00';
    if (zoneEl && draft.release_timezone) zoneEl.value = draft.release_timezone;
    collectSchedule();
    setExplicit(track.explicit === true || draft.explicit === true);
    var attest = $('[data-edit-attest]');
    if (attest) {
      var haveAttest = Boolean(draft.made_how);
      attest.hidden = !haveAttest;
      if (haveAttest) setMadeHow(draft.made_how);
    }
    var writers = splitWriters(release, draft, me);
    var splitCopy = $('[data-edit-splits-copy]');
    if (splitCopy) {
      splitCopy.textContent = writers.length
        ? ('Splits stay on this release · ' + writers.map(function (row) { return row.name; }).join(', ') + '.')
        : 'No split sheet on file for this release.';
    }
    if (track.uuid && $('#edit-audio')) {
      $('#edit-audio').removeAttribute('disabled');
      $('#edit-audio').setAttribute('data-track-id', track.uuid);
    } else if ($('#edit-audio')) {
      lockControl($('#edit-audio'), 'audio', 'This release has no track ID yet, so audio cannot be replaced.');
    }
    getJson('/api/tonegrid/stores').then(function (result) {
      fillStores((result.ok && result.data && result.data.stores) || [], release.dsps || draft.dsps || []);
    });
    setEditError('');
    ['title', 'genre', 'language', 'release_date', 'stores', 'artwork'].forEach(function (name) {
      setFieldWhy(name, '');
    });
    try {
      if (global.history && global.history.replaceState) {
        global.history.replaceState({}, '', editHref(id));
      }
    } catch (err) {}
    if (typeof panel.scrollIntoView === 'function') {
      try { panel.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (err) {
        try { panel.scrollIntoView(true); } catch (inner) {}
      }
    }
    return true;
  }

  function beginEdit(event) {
    var release = lastEdit.release;
    var id = releaseId(release);
    if (!id) {
      if (event && event.preventDefault) event.preventDefault();
      showSongError('This release has no store ID yet, so it cannot be edited.');
      return false;
    }
    if (!release) {
      release = { uuid: id, title: '', type: 'single', status: 'pending' };
      lastEdit.release = release;
    } else if (!release.uuid) {
      release.uuid = id;
    }
    var opened = openEdit(lastEdit);
    if (opened && event && event.preventDefault) event.preventDefault();
    return opened;
  }

  function closeEdit() {
    editClosed = true;
    var panel = $('[data-release-edit]');
    if (!panel) return;
    panel.hidden = true;
    if (panel.classList && panel.classList.toggle) panel.classList.toggle('is-hidden', true);
    try {
      var id = queryId() || (lastEdit.release && lastEdit.release.uuid) || '';
      if (global.history && global.history.replaceState) {
        global.history.replaceState({}, '', id ? ('song.html?id=' + encodeURIComponent(id)) : 'song.html');
      }
    } catch (err) {}
  }

  function stayOnRelease(releaseId) {
    var id = String(releaseId || '').trim();
    try {
      if (global.history && global.history.replaceState) {
        global.history.replaceState({}, '', id ? ('song.html?id=' + encodeURIComponent(id)) : 'song.html');
      }
    } catch (err) {}
    return load();
  }

  function submitEdit() {
    var panel = $('[data-release-edit]');
    var id = (panel && panel.getAttribute('data-release-id')) || (lastEdit.release && lastEdit.release.uuid) || queryId();
    if (!id) {
      setEditError('Open a release before submitting an edit.');
      return Promise.resolve({ ok: false, created: false });
    }
    var saveBtn = $('[data-edit-save]');
    if (saveBtn) saveBtn.setAttribute('aria-busy', 'true');
    setEditError('Submitting edit to the store…');
    var title = $('#edit-title') ? String($('#edit-title').value || '').trim() : '';
    var originalGenre = String((lastEdit.release && lastEdit.release.genre) || (lastEdit.draft && lastEdit.draft.genre) || '').trim();
    var genre = pickedGenre(originalGenre);
    if (genre === null) {
      if (saveBtn) saveBtn.removeAttribute('aria-busy');
      setEditError('Pick a genre from the list.');
      return Promise.resolve({ ok: false, created: false, releaseId: id });
    }
    var instrumental = Boolean($('#edit-instrumental') && $('#edit-instrumental').checked);
    var language = $('#edit-language') ? String($('#edit-language').value || '').trim().toLowerCase() : '';
    if (instrumental) language = '';
    var lyrics = selectedEditLyrics(instrumental);
    var price = $('#edit-price') ? String($('#edit-price').value || '').trim() : '';
    var featured = $('#edit-featured') ? String($('#edit-featured').value || '').trim() : '';
    var schedule = collectSchedule();
    var date = schedule.release_date;
    var art = $('#edit-art') && $('#edit-art').files && $('#edit-art').files[0];
    var audio = $('#edit-audio') && $('#edit-audio').files && $('#edit-audio').files[0];
    var trackId = $('#edit-audio') ? $('#edit-audio').getAttribute('data-track-id') : '';
    if (!instrumental) {
      var langs = (global.PlaigroundUploadCatalog && global.PlaigroundUploadCatalog.LANGUAGES) || [];
      var languageOk = !langs.length || langs.some(function (row) { return row.code === language; });
      if (!language || !languageOk) {
        setEditError('Language is required.');
        if (saveBtn) saveBtn.removeAttribute('aria-busy');
        return Promise.resolve({ ok: false, created: false });
      }
    }
    var draft = lastEdit.draft || readDraft();
    var me = lastEdit.me;
    var release = lastEdit.release || {};
    var artistId = String((me && me.tonegrid_artist_id) || draft.artist_id || '').trim();
    writeDraftFor(id, {
      title: title,
      genre: genre,
      language: language,
      price: price,
      featured: featured,
      instrumental: instrumental,
      lyrics: lyrics,
      explicit: selectedExplicit(),
      made_how: selectedMadeHow() || draft.made_how || '',
      release_date: date,
      select_preorder: schedule.select_preorder,
      preorder_date: schedule.preorder_date,
      define_time: schedule.define_time,
      release_time: schedule.release_time,
      release_timezone: schedule.release_timezone,
      release_id: id,
      artist_id: artistId || draft.artist_id || '',
      track_id: trackId || draft.track_id || '',
    });

    var errors = [];
    var hops = [];

    function runHop(label, task) {
      return task.then(function (result) {
        hops.push({ label: label, ok: Boolean(result && result.ok), status: result && result.status, data: result && result.data });
        return result;
      });
    }

    var releaseBody = { title: title };
    if (date) releaseBody.release_date = date;
    if (genre) releaseBody.genre = genre;
    if (language || instrumental) releaseBody.language = language;

    var chain = runHop('release', sendJson('/api/tonegrid/releases/' + encodeURIComponent(id), 'PUT', releaseBody)).then(function (result) {
      if (!result.ok) errors.push(applyToneGridError(result, result.data && /date/i.test(result.data.error || '') ? 'release_date' : 'title', $('#edit-title')));
      return runHop('dsps', sendJson('/api/tonegrid/releases/' + encodeURIComponent(id) + '/dsps', 'PUT', { dsps: selectedStores() }));
    }).then(function (result) {
      if (!result.ok) errors.push(applyToneGridError(result, 'stores', null));
      if (!trackId) return { ok: true, skipped: true };
      var trackBody = { title: title || (release.title || '') };
      if (language || instrumental) trackBody.language = language;
      trackBody.explicit = selectedExplicit();
      return runHop('track', sendJson('/api/tonegrid/tracks/' + encodeURIComponent(trackId), 'PUT', trackBody));
    }).then(function (result) {
      if (result && !result.ok && !result.skipped) errors.push(applyToneGridError(result, 'language', $('#edit-language')));
      if (!art) return { ok: true, skipped: true };
      var form = new FormData();
      form.append('artwork', art, art.name || 'artwork.jpg');
      return runHop('artwork', fetch('/api/tonegrid/releases/' + encodeURIComponent(id) + '/artwork', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        body: form,
      }).then(parseSave));
    }).then(function (result) {
      if (result && !result.ok && !result.skipped) errors.push(applyToneGridError(result, 'artwork', $('#edit-art')));
      if (!audio || !trackId) {
        if (audio && !trackId) errors.push('This release has no track ID yet, so audio cannot be replaced.');
        return { ok: true, skipped: true };
      }
      return audioAllowed(audio).then(function (ok) {
        if (!ok) {
          var message = (global.PlaigroundAudioAccept && global.PlaigroundAudioAccept.ERROR) || 'Audio must be WAV, FLAC, or MP3.';
          errors.push(message);
          return { ok: false, skipped: false, data: { error: message } };
        }
        var audioForm = new FormData();
        audioForm.append('audio', audio, audio.name || 'audio.wav');
        return runHop('audio', fetch('/api/tonegrid/tracks/' + encodeURIComponent(trackId) + '/audio', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          body: audioForm,
        }).then(parseSave));
      });
    }).then(function (result) {
      if (result && !result.ok && !result.skipped) errors.push(applyToneGridError(result, 'audio', $('#edit-audio')));
      var submitBody = {
        release_date: date || release.release_date || draft.release_date || '',
        made_how: selectedMadeHow() || draft.made_how || '',
        human_elements: Array.isArray(draft.human_elements) ? draft.human_elements : [],
        human_contribution: draft.human_contribution || '',
        rights_confirmed: draft.rights_confirmed === true,
        solo_owned_100: draft.solo_owned_100 === true || draft.solo_owned_100 === 'true',
        featured: featured,
        title: title,
        songTitle: title,
      };
      if (draft.signwell_document_id) submitBody.document_id = draft.signwell_document_id;
      if (Array.isArray(draft.writers)) submitBody.writers = draft.writers;
      return runHop('submit', sendJson('/api/tonegrid/releases/' + encodeURIComponent(id) + '/submit', 'POST', submitBody));
    }).then(function (result) {
      if (saveBtn) saveBtn.removeAttribute('aria-busy');
      if (result && !result.ok) errors.push(applyToneGridError(result, 'release_date', $('#edit-release-date')));
      if (errors.length) {
        setEditError(errors.join(' '));
        return { ok: false, created: false, hops: hops, errors: errors, releaseId: id };
      }
      var nextStatus = (result && result.data && result.data.status) || release.status || 'pending';
      setEditError('');
      closeEdit();
      return stayOnRelease(id).then(function (next) {
        return { ok: true, created: false, hops: hops, releaseId: id, status: nextStatus, release: next };
      });
    }).catch(function () {
      if (saveBtn) saveBtn.removeAttribute('aria-busy');
      setEditError('We could not reach the store.');
      return { ok: false, created: false, hops: hops, releaseId: id };
    });

    return chain;
  }

  function clearDraftIf(releaseId) {
    var draft = readDraft();
    var want = String(releaseId || '').toLowerCase();
    if (!want || String(draft.release_id || '').toLowerCase() !== want) return;
    try { if (global.localStorage) global.localStorage.removeItem(DRAFT_KEY); } catch (err) {}
    try { if (global.sessionStorage) global.sessionStorage.removeItem(DRAFT_KEY); } catch (err) {}
  }

  function confirmRemove(release) {
    var step = statusStep(release, lastEdit.draft);
    var sent = step === 'live' || step === 'processing' || step === 'pending';
    var message = sent
      ? 'Ask stores to take this release down? It stays listed until the store confirms. This cannot be undone.'
      : 'Remove this release from PLAIGROUND? This cannot be undone.';
    if (typeof global.confirm !== 'function') return false;
    return global.confirm(message);
  }

  function removeRelease() {
    var release = lastEdit.release;
    var id = (release && release.uuid) || queryId();
    var btn = $('[data-song-remove]');
    if (!id) {
      setText('[data-song-status]', 'Open a release before removing it.');
      setHidden('[data-song-status]', false);
      return Promise.resolve({ ok: false });
    }
    if (!confirmRemove(release || { uuid: id, status: (lastEdit.release && lastEdit.release.status) || '' })) {
      return Promise.resolve({ ok: false, cancelled: true });
    }
    if (btn) btn.setAttribute('aria-busy', 'true');
    setText('[data-song-status]', 'Removing…');
    setHidden('[data-song-status]', false);
    return sendJson('/api/tonegrid/releases/' + encodeURIComponent(id), 'DELETE', {}).then(function (result) {
      if (btn) btn.removeAttribute('aria-busy');
      if (!result.ok) {
        var err = (result.data && result.data.error) || 'The store could not remove this release.';
        if (/only draft or rejected releases can be deleted/i.test(err)) {
          err = 'The store could not take this release down.';
        }
        setText('[data-song-status]', err);
        setHidden('[data-song-status]', false);
        return { ok: false, result: result };
      }
      if (result.data && result.data.removed) {
        clearDraftIf(id);
        try { global.location.href = 'releases.html'; } catch (err) {}
        return { ok: true, removed: true, redirect: 'releases.html', result: result };
      }
      var status = (result.data && result.data.status) || 'takedown_submitted';
      if (lastEdit.release) lastEdit.release.status = status;
      setText('[data-song-pill]', statusLabel(statusStep({ status: status }, lastEdit.draft)));
      markLife(statusStep({ status: status }, lastEdit.draft));
      setHidden('[data-song-remove]', true);
      setText('[data-song-status]', 'Takedown submitted to stores. This release stays listed until the store confirms.');
      setHidden('[data-song-status]', false);
      return { ok: true, takedown: true, status: status, result: result };
    }).catch(function () {
      if (btn) btn.removeAttribute('aria-busy');
      setText('[data-song-status]', 'We could not reach the store.');
      setHidden('[data-song-status]', false);
      return { ok: false };
    });
  }

  function generatedOn() {
    try { return new Date().toISOString().slice(0, 10); } catch (err) { return ''; }
  }

  function releaseIdOf(release) {
    return String((release && (release.uuid || release.id)) || queryId() || '').trim();
  }

  function releaseStats(release, draft, analytics) {
    var step = statusStep(release, draft);
    var summary = (analytics && analytics.summary) || {};
    var scoped = (((analytics && analytics.releases) || []).filter(function (row) {
      return String(row.release_uuid || row.uuid || '').toLowerCase() === String((release && release.uuid) || '').toLowerCase();
    })[0]) || {};
    var showStats = step === 'live';
    return {
      streams: showStats && scoped.streams != null ? scoped.streams : (showStats ? summary.total_streams : 0),
      earnings: showStats && scoped.revenue_usd != null ? scoped.revenue_usd : (showStats ? summary.total_revenue_usd : 0),
    };
  }

  function releaseStatementDoc(opts) {
    opts = opts || {};
    var release = opts.release || lastEdit.release || {};
    var draft = opts.draft || lastEdit.draft || {};
    var me = opts.me || lastEdit.me;
    var analytics = opts.analytics || lastEdit.analytics || {};
    var artist = String(release.artist || draft.name || (me && me.artist) || '').trim();
    var step = statusStep(release, draft);
    var stats = releaseStats(release, draft, analytics);
    var rows = ((analytics.dsps) || []).map(function (row) {
      return [row.dsp || row.name || 'Store', formatCount(row.streams), row.revenue_usd == null ? formatMoney(0) : formatMoney(row.revenue_usd)];
    });
    var fields = [{ label: 'Title', value: release.title || 'Untitled' }];
    if (artist) fields.push({ label: 'Artist', value: artist });
    fields.push({ label: 'Status', value: statusLabel(step) });
    fields.push({ label: 'Streams', value: formatCount(stats.streams) });
    fields.push({ label: 'Earnings', value: formatMoney(stats.earnings) });
    return {
      title: 'PLAIGROUND',
      subtitle: 'Release statement',
      generated: generatedOn(),
      fields: fields,
      tableTitle: rows.length ? 'By platform' : '',
      columns: rows.length ? ['Platform', 'Streams', 'Earnings'] : [],
      rows: rows,
    };
  }

  function releaseStatementPdf(opts) {
    var pdf = global.PlaigroundStatementPdf;
    if (!pdf || typeof pdf.build !== 'function') return '';
    return pdf.build(releaseStatementDoc(opts));
  }

  function missingReleaseIdMessage() {
    return 'Open a release before downloading a statement.';
  }

  function downloadReleaseStatement(opts) {
    opts = opts || {};
    var release = opts.release || lastEdit.release;
    var id = releaseIdOf(release);
    if (!id) {
      setText('[data-song-status]', missingReleaseIdMessage());
      setHidden('[data-song-status]', false);
      return false;
    }
    var bytes = releaseStatementPdf({
      release: release || { uuid: id },
      draft: opts.draft || lastEdit.draft,
      me: opts.me || lastEdit.me,
      analytics: opts.analytics || lastEdit.analytics,
    });
    var pdf = global.PlaigroundStatementPdf;
    if (!bytes || !pdf || typeof pdf.download !== 'function') {
      setText('[data-song-status]', 'Could not build a statement PDF.');
      setHidden('[data-song-status]', false);
      return false;
    }
    pdf.download('plaiground-release-statement.pdf', bytes);
    return true;
  }

  function bindDownload() {
    var btn = $('[data-song-download]');
    if (!btn || !btn.addEventListener) return;
    btn.addEventListener('click', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      downloadReleaseStatement();
    });
  }

  function bindEdit() {
    var openBtn = $('[data-song-edit]');
    if (openBtn && openBtn.addEventListener) {
      openBtn.addEventListener('click', function (event) {
        beginEdit(event);
      });
    }
    var saveBtn = $('[data-edit-save]');
    if (saveBtn && saveBtn.addEventListener) {
      saveBtn.addEventListener('click', function () { submitEdit(); });
    }
    var cancelBtn = $('[data-edit-cancel]');
    if (cancelBtn && cancelBtn.addEventListener) {
      cancelBtn.addEventListener('click', closeEdit);
    }
    var removeBtn = $('[data-song-remove]');
    if (removeBtn && removeBtn.addEventListener) {
      removeBtn.addEventListener('click', function () { removeRelease(); });
    }
    var inst = $('#edit-instrumental');
    if (inst && inst.addEventListener) {
      inst.addEventListener('change', function () {
        syncLanguageField(inst.checked);
        syncLyricsField(inst.checked);
      });
    }
    $all('[data-edit-explicit] [data-explicit]').forEach(function (el) {
      if (!el.addEventListener) return;
      el.addEventListener('click', function (event) {
        event.preventDefault();
        setExplicit(el.getAttribute('data-explicit') === 'true');
      });
    });
    $all('[data-edit-made-how]').forEach(function (el) {
      if (!el.addEventListener) return;
      el.addEventListener('click', function () { setMadeHow(el.getAttribute('data-edit-made-how')); });
    });
    bindSchedule();
  }

  global.PlaigroundSong = {
    render: render,
    pickRelease: pickRelease,
    statusStep: statusStep,
    splitWriters: splitWriters,
    load: load,
    openEdit: openEdit,
    beginEdit: beginEdit,
    editHref: editHref,
    closeEdit: closeEdit,
    submitEdit: submitEdit,
    removeRelease: removeRelease,
    isCreateReleaseUrl: isCreateReleaseUrl,
    currentEditState: currentEditState,
    downloadReleaseStatement: downloadReleaseStatement,
    releaseStatementPdf: releaseStatementPdf,
    releaseStatementDoc: releaseStatementDoc,
  };
  bindEdit();
  bindDownload();
  load();
})(window);
