(function (root) {
  var ATTR_KEY = 'plaiground.attribution';
  var COOKIE = 'plaiground_attr';
  var PENDING_KEY = 'plaiground.eventPending';
  var GUIDE_KEY = 'plaiground.guidePending';
  var RETURN_KEY = 'plaiground.returnDay';
  var VISITOR_KEY = 'plaiground.visitor';
  var VISIT_DAY_KEY = 'plaiground.visitDay';
  var FIRST_SONG_KEY = 'plaiground.firstSong';
  var MAX_PENDING = 40;
  var KEY_EVENTS = {
    signup: true,
    song_helper_first: true,
    cover_art_generated: true,
    distro_checkout_started: true,
    distro_checkout_completed: true
  };
  var PIXEL_EVENTS = {
    song_helper_first: 'Lead',
    distro_checkout_started: 'InitiateCheckout',
    distro_checkout_completed: 'Purchase'
  };
  var MARKETING_EVENTS = {
    song_helper_first: 'song_first',
    cover_art_generated: 'cover_art',
    distro_checkout_started: 'distro_started',
    distro_checkout_completed: 'distro_purchased'
  };

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
      utm_term: clip(params && params.get('utm_term'), 120),
      fbclid: clickId(params && params.get('fbclid')),
      ttclid: clickId(params && params.get('ttclid')),
      gclid: clickId(params && params.get('gclid')),
      ref: clip(params && params.get('ref'), 64).replace(/[^A-Za-z0-9_-]/g, ''),
      referrer: externalReferrer(),
      landed_at: new Date().toISOString()
    };
    writeJson(ATTR_KEY, record);
    writeCookie(record);
    return record;
  }

  function clickId(value) {
    var text = clip(value, 200);
    if (!/^[A-Za-z0-9._~-]{4,200}$/.test(text)) return '';
    return text;
  }

  function readAttribution() {
    return readJson(ATTR_KEY) || readCookie() || captureAttribution();
  }

  function publicAttribution(record) {
    var src = record && typeof record === 'object' ? record : {};
    return {
      utm_source: clip(src.utm_source, 120),
      utm_medium: clip(src.utm_medium, 120),
      utm_campaign: clip(src.utm_campaign, 120),
      utm_content: clip(src.utm_content, 120),
      utm_term: clip(src.utm_term, 120),
      fbclid: clickId(src.fbclid),
      ttclid: clickId(src.ttclid),
      gclid: clickId(src.gclid),
      ref: clip(src.ref, 64).replace(/[^A-Za-z0-9_-]/g, ''),
      referrer: clip(src.referrer, 300),
      landed_at: clip(src.landed_at, 40)
    };
  }

  function readVisitorCookie() {
    try {
      var parts = String(root.document.cookie || '').split(';');
      for (var i = 0; i < parts.length; i += 1) {
        var bit = parts[i].replace(/^\s+/, '');
        if (bit.indexOf('plaiground_vid=') === 0) return decodeURIComponent(bit.slice('plaiground_vid='.length));
      }
    } catch (err) {}
    return '';
  }

  function visitorId() {
    var box = storage();
    var current = '';
    try { current = box ? String(box.getItem(VISITOR_KEY) || '') : ''; } catch (err) {}
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(current)) current = readVisitorCookie();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(current)) {
      var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      current = 'v';
      for (var i = 0; i < 20; i += 1) current += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    try { if (box) box.setItem(VISITOR_KEY, current); } catch (err2) {}
    try {
      root.document.cookie = 'plaiground_vid=' + encodeURIComponent(current) + '; Path=/; Max-Age=7776000; SameSite=Lax';
    } catch (err3) {}
    return current;
  }

  function safePayload(payload, eventName) {
    var src = payload && typeof payload === 'object' ? payload : {};
    var out = {};
    if (src.tier) out.tier = clip(src.tier, 20);
    if (src.lane) out.lane = clip(src.lane, 20);
    if (src.release_id) out.release_id = clip(src.release_id, 80);
    if (src.stop_id) out.stop_id = clip(src.stop_id, 80);
    if (KEY_EVENTS[eventName]) out.attribution = publicAttribution(readAttribution());
    return out;
  }

  function pixel(standard) {
    if (!standard) return;
    var api = root.PlaigroundPixel;
    if (api && api.track) {
      api.track(standard);
      return;
    }
    var q = root.PlaigroundPixelQueue || [];
    q.push(standard);
    root.PlaigroundPixelQueue = q;
  }

  function postMarketing(name) {
    var eventName = MARKETING_EVENTS[name];
    if (!eventName || !root.fetch) return;
    postJson('/api/me/marketing', {
      name: eventName,
      visitor_id: visitorId(),
      attribution: publicAttribution(readAttribution())
    }).catch(function () {});
  }

  function noteVisit() {
    var day = new Date().toISOString().slice(0, 10);
    var box = storage();
    try {
      if (box && box.getItem(VISIT_DAY_KEY) === day) return;
    } catch (err) {}
    if (!root.fetch) return;
    postJson('/api/me/marketing', {
      name: 'visit',
      visitor_id: visitorId(),
      attribution: publicAttribution(readAttribution())
    }).then(function (res) {
      if (res && (res.ok || res.status === 200)) {
        try { if (box) box.setItem(VISIT_DAY_KEY, day); } catch (err2) {}
      }
    }).catch(function () {});
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
    var body = safePayload(payload, eventName);
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
    if (MARKETING_EVENTS[eventName]) postMarketing(eventName);
    if (PIXEL_EVENTS[eventName]) pixel(PIXEL_EVENTS[eventName]);
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
    if (eventName === 'song_helper_draft' || eventName === 'song_helper_saved') noteFirstSong();
  }

  function noteFirstSong() {
    var box = storage();
    if (!box) return;
    try {
      if (box.getItem(FIRST_SONG_KEY) === '1') return;
      box.setItem(FIRST_SONG_KEY, '1');
    } catch (err) {
      return;
    }
    track('song_helper_first', {});
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
    noteVisit();
    track('return_visit', {});
    if (root.document) watchWhatsNew();
  }

  root.PlaigroundEvents = {
    captureAttribution: captureAttribution,
    readAttribution: readAttribution,
    visitorId: visitorId,
    saveGuide: saveGuide,
    track: track
  };

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
