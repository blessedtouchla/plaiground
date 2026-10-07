(function (root) {
  var ATTR_KEY = 'plaiground.attribution';
  var COOKIE = 'plaiground_attr';
  var PENDING_KEY = 'plaiground.eventPending';
  var GUIDE_KEY = 'plaiground.guidePending';
  var RETURN_KEY = 'plaiground.returnDay';
  var MAX_PENDING = 40;

  function storage() {
    try { return root.localStorage || null; } catch (err) { return null; }
  }

  function clip(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
  }

  function readJson(key) {
    var box = storage();
    if (!box) return null;
    try {
      var raw = box.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeJson(key, value) {
    var box = storage();
    if (!box) return;
    try { box.setItem(key, JSON.stringify(value)); } catch (err) {}
  }

  function readCookie() {
    try {
      var parts = String(root.document.cookie || '').split(';');
      for (var i = 0; i < parts.length; i += 1) {
        var bit = parts[i].replace(/^\s+/, '');
        if (bit.indexOf(COOKIE + '=') === 0) {
          return JSON.parse(decodeURIComponent(bit.slice(COOKIE.length + 1)));
        }
      }
    } catch (err) {}
    return null;
  }

  function writeCookie(value) {
    try {
      var body = encodeURIComponent(JSON.stringify(value));
      root.document.cookie = COOKIE + '=' + body + '; Path=/; Max-Age=7776000; SameSite=Lax';
    } catch (err) {}
  }

  function queryParams() {
    try { return new URLSearchParams(root.location.search || ''); } catch (err) { return null; }
  }

  function externalReferrer() {
    var ref = '';
    try { ref = String(root.document.referrer || ''); } catch (err) { return ''; }
    if (!ref) return '';
    try {
      var here = root.location.hostname;
      var host = new URL(ref).hostname;
      if (host && here && host === here) return '';
    } catch (err2) {}
    return clip(ref, 300);
  }

  function captureAttribution() {
    var existing = readJson(ATTR_KEY);
    if (existing && existing.landed_at) return existing;
    var fromCookie = readCookie();
    if (!existing && fromCookie && fromCookie.landed_at) {
      writeJson(ATTR_KEY, fromCookie);
      return fromCookie;
    }
    if (existing && existing.landed_at) return existing;
    var params = queryParams();
    var record = {
      utm_source: clip(params && params.get('utm_source'), 120),
      utm_medium: clip(params && params.get('utm_medium'), 120),
      utm_campaign: clip(params && params.get('utm_campaign'), 120),
      utm_content: clip(params && params.get('utm_content'), 120),
      ref: clip(params && params.get('ref'), 64).replace(/[^A-Za-z0-9_-]/g, ''),
      referrer: externalReferrer(),
      landed_at: new Date().toISOString()
    };
    writeJson(ATTR_KEY, record);
    writeCookie(record);
    return record;
  }

  function readAttribution() {
    return readJson(ATTR_KEY) || readCookie() || captureAttribution();
  }

  function safePayload(payload) {
    var src = payload && typeof payload === 'object' ? payload : {};
    var out = {};
    if (src.tier) out.tier = clip(src.tier, 20);
    if (src.lane) out.lane = clip(src.lane, 20);
    if (src.release_id) out.release_id = clip(src.release_id, 80);
    if (src.stop_id) out.stop_id = clip(src.stop_id, 80);
    return out;
  }

  function park(body) {
    var list = readJson(PENDING_KEY);
    if (!Array.isArray(list)) list = [];
    list.push(body);
    if (list.length > MAX_PENDING) list = list.slice(list.length - MAX_PENDING);
    writeJson(PENDING_KEY, list);
  }

  function postJson(url, body) {
    return root.fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  function signedInHint() {
    try {
      return /(?:^|; )plaiground_signed=1(?:;|$)/.test(String(root.document.cookie || ''));
    } catch (err) {
      return false;
    }
  }

  function track(name, payload, at) {
    var eventName = clip(name, 80);
    if (!eventName || !root.fetch) return;
    var body = safePayload(payload);
    body.name = eventName;
    if (at) body.at = at;
    if (eventName === 'return_visit') {
      if (!signedInHint()) return;
      var day = new Date().toISOString().slice(0, 10);
      var box = storage();
      try {
        if (box && box.getItem(RETURN_KEY) === day) return;
      } catch (err) {}
    }
    postJson('/api/me/events', body).then(function (res) {
      if (res && res.ok && eventName === 'return_visit') {
        var kept = storage();
        try { if (kept) kept.setItem(RETURN_KEY, new Date().toISOString().slice(0, 10)); } catch (err) {}
        return;
      }
      if (eventName === 'return_visit') return;
      if (!res || res.status === 401 || res.status === 403 || res.status >= 500) park(body);
    }).catch(function () {
      if (eventName !== 'return_visit') park(body);
    });
  }

  function saveGuide(body) {
    var payload = body && typeof body === 'object' ? body : {};
    if (!root.fetch) {
      writeJson(GUIDE_KEY, payload);
      return;
    }
    postJson('/api/me/guide', payload).then(function (res) {
      if (res && (res.status === 401 || res.status === 403 || res.status >= 500)) writeJson(GUIDE_KEY, payload);
      else {
        var box = storage();
        try { if (box) box.removeItem(GUIDE_KEY); } catch (err) {}
      }
    }).catch(function () {
      writeJson(GUIDE_KEY, payload);
    });
  }

  function flushPending() {
    var list = readJson(PENDING_KEY);
    var guide = readJson(GUIDE_KEY);
    if (Array.isArray(list) && list.length) {
      writeJson(PENDING_KEY, []);
      list.forEach(function (body) {
        if (body && body.name) track(body.name, body, body.at);
      });
    }
    if (guide && guide.status) saveGuide(guide);
  }

  function handle(item) {
    if (!item || typeof item !== 'object') return;
    if (item.kind === 'guide') saveGuide(item);
    else if (item.name) track(item.name, item.payload, item.at);
  }

  function installQueue() {
    var prior = root.PlaigroundEventQueue;
    var queue = [];
    queue.push = function (item) {
      handle(item);
      return 1;
    };
    root.PlaigroundEventQueue = queue;
    if (Array.isArray(prior)) prior.forEach(handle);
  }

  function watchWhatsNew() {
    var seen = false;
    function mark() {
      if (seen) return;
      seen = true;
      track('whats_new_viewed', {});
    }
    var section = root.document.querySelector('#whats-new');
    if (section && root.IntersectionObserver) {
      var watcher = new root.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry && entry.isIntersecting) mark();
        });
      }, { threshold: 0.4 });
      watcher.observe(section);
    } else if (section) {
      mark();
    }
    root.document.addEventListener('click', function (event) {
      var node = event.target && event.target.closest
        ? event.target.closest('[data-nav-group="whats-new"], [data-whats-new]')
        : null;
      if (node) track('whats_new_viewed', {});
    });
  }

  function boot() {
    captureAttribution();
    installQueue();
    flushPending();
    track('return_visit', {});
    if (root.document) watchWhatsNew();
  }

  root.PlaigroundEvents = {
    captureAttribution: captureAttribution,
    readAttribution: readAttribution,
    saveGuide: saveGuide,
    track: track
  };

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
