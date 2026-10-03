(function (root, factory) {
  var api = factory(root || globalThis);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundRoadmapAccount = api;
  if (typeof document !== 'undefined') api.boot();
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  var PLAN_KEY = 'plaigroundDestinationPlan';
  var PROFILE_KEY = 'plaigroundArtistProfiles';
  var planTimer = 0;
  var profileTimer = 0;

  function storage() {
    try {
      return root.localStorage;
    } catch (err) {
      return null;
    }
  }

  function readJson(key) {
    var store = storage();
    if (!store) return null;
    try {
      var raw = store.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function writeJson(key, value) {
    var store = storage();
    if (!store || value == null) return;
    try {
      store.setItem(key, JSON.stringify(value));
    } catch (err) {}
  }

  function hasSession() {
    var membership = root.PlaigroundMembership;
    if (membership && typeof membership.isSignedIn === 'function') {
      try {
        if (membership.isSignedIn()) return true;
      } catch (err) {}
    }
    var raw = '';
    try {
      raw = String((root.document && root.document.cookie) || '');
    } catch (err) {
      return false;
    }
    return /(?:^|;\s*)plaiground_session=/.test(raw) || /(?:^|;\s*)plaiground_signed=/.test(raw);
  }

  function planFromSearch(params) {
    if (!params || typeof params.get !== 'function') return null;
    var song = String(params.get('song') || '').trim();
    var goal = String(params.get('goal') || '').trim();
    if (!song && !goal) return null;
    return {
      song: song,
      goal: goal,
      note: String(params.get('note') || ''),
      stops: String(params.get('stops') || '').split(',').map(function (id) { return id.trim(); }).filter(Boolean),
      kit: String(params.get('kit') || ''),
      managed: String(params.get('kit') || '') === 'management',
      artistCount: String(params.get('artistCount') || ''),
      genres: String(params.get('genres') || '').split(',').map(function (name) { return name.trim(); }).filter(Boolean)
    };
  }

  function captureQueryPlan() {
    var params = null;
    try {
      params = new URLSearchParams(root.location && root.location.search || '');
    } catch (err) {
      return null;
    }
    var fromQuery = planFromSearch(params);
    if (!fromQuery) return readJson(PLAN_KEY);
    var local = readJson(PLAN_KEY);
    if (local && local.song && local.goal) return local;
    writeJson(PLAN_KEY, fromQuery);
    return fromQuery;
  }

  function profilesWorthSaving(record) {
    if (!record || typeof record !== 'object') return false;
    if (String(record.note || '').trim() || record.count) return true;
    var artists = Array.isArray(record.artists) ? record.artists : [];
    for (var i = 0; i < artists.length; i += 1) {
      var artist = artists[i] || {};
      if (artist.name || artist.city || artist.stage || artist.madeBy || artist.genre || artist.genreOther) return true;
      if (artist.genres && artist.genres.length) return true;
      var links = artist.links || {};
      if (links.spotify || links.instagram || links.tiktok || links.youtube) return true;
    }
    return false;
  }

  function post(url, body) {
    if (typeof root.fetch !== 'function') return Promise.resolve(null);
    return root.fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data || {} };
      }).catch(function () {
        return { ok: false, status: response.status, data: {} };
      });
    }).catch(function () {
      return { ok: false, status: 0, data: {} };
    });
  }

  function get(url) {
    if (typeof root.fetch !== 'function') return Promise.resolve(null);
    return root.fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data || {} };
      }).catch(function () {
        return { ok: false, status: response.status, data: {} };
      });
    }).catch(function () {
      return { ok: false, status: 0, data: {} };
    });
  }

  function savePlan(plan, options) {
    var opts = options || {};
    if (plan) writeJson(PLAN_KEY, plan);
    function run() {
      var record = readJson(PLAN_KEY);
      if (!record || !record.song || !record.goal) return Promise.resolve(null);
      if (!opts.force && !hasSession()) return Promise.resolve({ saved: false, local: true });
      return post('/api/me/roadmap', { plan: record });
    }
    if (opts.immediate) {
      if (root.clearTimeout) root.clearTimeout(planTimer);
      return run();
    }
    if (root.clearTimeout) root.clearTimeout(planTimer);
    planTimer = root.setTimeout(run, 500);
    return Promise.resolve({ queued: true });
  }

  function saveProfiles(record, options) {
    var opts = options || {};
    if (record) writeJson(PROFILE_KEY, record);
    function run() {
      var saved = readJson(PROFILE_KEY);
      if (!profilesWorthSaving(saved)) return Promise.resolve(null);
      if (!opts.force && !hasSession()) return Promise.resolve({ saved: false, local: true });
      return post('/api/me/artist-profiles', { profiles: saved });
    }
    if (opts.immediate) {
      if (root.clearTimeout) root.clearTimeout(profileTimer);
      return run();
    }
    if (root.clearTimeout) root.clearTimeout(profileTimer);
    profileTimer = root.setTimeout(run, 500);
    return Promise.resolve({ queued: true });
  }

  function claimLocal() {
    captureQueryPlan();
    var jobs = [];
    if (readJson(PLAN_KEY)) jobs.push(savePlan(null, { immediate: true, force: true }));
    if (profilesWorthSaving(readJson(PROFILE_KEY))) jobs.push(saveProfiles(null, { immediate: true, force: true }));
    if (!jobs.length) return Promise.resolve([]);
    return Promise.all(jobs);
  }

  function loadPlan() {
    return get('/api/me/roadmap').then(function (result) {
      if (!result || !result.ok || !result.data || !result.data.plan) return null;
      return result.data;
    });
  }

  function loadProfiles() {
    return get('/api/me/artist-profiles').then(function (result) {
      if (!result || !result.ok || !result.data || !result.data.profiles) return null;
      return result.data;
    });
  }

  function shouldClaimOnPath(path) {
    var value = String(path || '');
    if (/\/(confirm|confirmed|login|magic)(?:\.html)?$/.test(value)) return false;
    // Edit loads the account plan itself. Claiming localStorage here would
    // post a stale draft over the saved roadmap before that read finishes.
    if (/\/destination(?:\.html)?\/?$/.test(value)) return false;
    if (/\/my-roadmap(?:\.html)?\/?$/.test(value)) return false;
    return true;
  }

  function boot() {
    captureQueryPlan();
    var path = '';
    try {
      path = String((root.location && root.location.pathname) || '');
    } catch (err) {
      path = '';
    }
    if (!shouldClaimOnPath(path)) return;
    if (hasSession()) claimLocal();
  }

  return {
    PLAN_KEY: PLAN_KEY,
    PROFILE_KEY: PROFILE_KEY,
    boot: boot,
    shouldClaimOnPath: shouldClaimOnPath,
    captureQueryPlan: captureQueryPlan,
    claimLocal: claimLocal,
    hasSession: hasSession,
    loadPlan: loadPlan,
    loadProfiles: loadProfiles,
    planFromSearch: planFromSearch,
    profilesWorthSaving: profilesWorthSaving,
    savePlan: savePlan,
    saveProfiles: saveProfiles
  };
});
