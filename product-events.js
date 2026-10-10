(function (root) {
  var ATTR_KEY = 'plaiground.attribution';
  var COOKIE = 'plaiground_attr';
  var PENDING_KEY = 'plaiground.eventPending';
  var GUIDE_KEY = 'plaiground.guidePending';
  var RETURN_KEY = 'plaiground.returnDay';
  var VISITOR_KEY = 'plaiground.visitor';
  var VISIT_DAY_KEY = 'plaiground.visitDay';
  var SESSION_DAY_KEY = 'plaiground.sessionDay';
  var TOOL_DAY_KEY = 'plaiground.toolDays';
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
    visit: 'visit',
    returned_visit: 'returned_visit',
    tool_view: 'tool_view',
    song_helper_first: 'song_first',
    song_helper_started: 'song_helper_started',
    song_helper_step: 'song_helper_step',
    song_helper_draft: 'song_helper_draft',
    song_helper_section: 'song_helper_section',
    song_helper_ask: 'song_helper_ask',
    song_helper_rhymify: 'song_helper_rhymify',
    song_helper_sounds: 'song_helper_sounds',
    song_helper_style_made: 'song_helper_style_made',
    song_helper_style_copied: 'song_helper_style_copied',
    cover_art_generated: 'cover_art',
    cover_art_downloaded: 'cover_art_downloaded',
    roadmap_stage: 'roadmap_stage',
    roadmap_goal: 'roadmap_goal',
    check_and_file_completed: 'check_and_file_completed',
    contract_opened: 'contract_opened',
    distro_checkout_started: 'distro_started',
    distro_checkout_completed: 'distro_purchased',
    plai_opened: 'plai_opened',
    plai_chip: 'plai_chip'
  };
  var MARKETING_ONLY = {
    visit: true,
    returned_visit: true,
    tool_view: true,
    song_helper_step: true,
    song_helper_section: true,
    song_helper_ask: true,
    song_helper_rhymify: true,
    song_helper_sounds: true,
    song_helper_style_made: true,
    cover_art_downloaded: true,
    roadmap_stage: true,
    roadmap_goal: true,
    check_and_file_completed: true,
    contract_opened: true,
    plai_opened: true,
    plai_chip: true
  };
  var CHIP_SLUGS = {
    'Where do I start?': 'start',
    'How does distribution work?': 'distribution',
    'What does it cost?': 'cost',
    'How do I protect my song?': 'protect'
  };
  var pageOnce = {};

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

  function consentDenied() {
    var raw = '';
    try {
      var parts = String(root.document.cookie || '').split(';');
      for (var i = 0; i < parts.length; i += 1) {
        var bit = parts[i].replace(/^\s+/, '');
        if (bit.indexOf('plaiground_consent=') === 0) raw = decodeURIComponent(bit.slice('plaiground_consent='.length));
      }
    } catch (err) {}
    if (!raw) {
      try { raw = storage() ? String(storage().getItem('plaiground.consent') || '') : ''; } catch (err2) {}
    }
    var value = String(raw || '').trim().toLowerCase();
    return value === 'denied' || value === '0' || value === 'no';
  }

  function visitorId() {
    if (consentDenied()) return '';
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

  function safeToken(value, max) {
    var text = clip(value, max || 24).toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(text)) return '';
    return text.slice(0, max || 24);
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

  function inferTool(name, payload) {
    var src = payload && typeof payload === 'object' ? payload : {};
    var tool = safeToken(src.tool, 40);
    if (tool) return tool;
    if (name.indexOf('song_helper') === 0 || name === 'song_first') return 'song_helper';
    if (name.indexOf('cover_art') === 0 || name === 'cover_art') return 'cover_art';
    if (name.indexOf('roadmap') === 0) return 'roadmap';
    if (name.indexOf('distro') === 0) return 'distribution';
    if (name.indexOf('contract') === 0) return 'contracts';
    if (name.indexOf('plai') === 0) return 'plai';
    if (name === 'check_and_file_completed') return 'qualify';
    return '';
  }

  function postMarketing(name, payload) {
    var eventName = MARKETING_EVENTS[name];
    if (!eventName || !root.fetch || consentDenied()) return null;
    var id = visitorId();
    if (!id) return null;
    var src = payload && typeof payload === 'object' ? payload : {};
    var body = {
      name: eventName,
      visitor_id: id,
      attribution: publicAttribution(readAttribution())
    };
    var tool = inferTool(eventName, src);
    var step = safeToken(src.step, 24);
    if (tool) body.tool = tool;
    if (step) body.step = step;
    return postJson('/api/me/marketing', body).catch(function () { return null; });
  }

  function noteVisit() {
    var day = new Date().toISOString().slice(0, 10);
    var box = storage();
    try {
      if (box && box.getItem(VISIT_DAY_KEY) === day) return;
    } catch (err) {}
    var sent = postMarketing('visit', {});
    if (!sent || !sent.then) return;
    sent.then(function (res) {
      if (res && (res.ok || res.status === 200)) {
        try { if (box) box.setItem(VISIT_DAY_KEY, day); } catch (err2) {}
      }
    });
  }

  function noteReturned() {
    if (consentDenied()) return;
    var day = new Date().toISOString().slice(0, 10);
    var box = storage();
    var prev = '';
    try { prev = box ? String(box.getItem(SESSION_DAY_KEY) || '') : ''; } catch (err) {}
    if (!prev) {
      try { if (box) box.setItem(SESSION_DAY_KEY, day); } catch (err2) {}
      return;
    }
    if (prev === day) return;
    var sent = postMarketing('returned_visit', {});
    if (!sent || !sent.then) return;
    sent.then(function (res) {
      if (res && (res.ok || res.status === 200)) {
        try { if (box) box.setItem(SESSION_DAY_KEY, day); } catch (err3) {}
      }
    });
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

  function track(name, payload, at, replay) {
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
    if (!replay && MARKETING_EVENTS[eventName]) postMarketing(eventName, payload);
    if (PIXEL_EVENTS[eventName]) pixel(PIXEL_EVENTS[eventName]);
    if (MARKETING_ONLY[eventName]) return;
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
        if (body && body.name) track(body.name, body, body.at, true);
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

  function pathStem() {
    var path = '/';
    try { path = String(root.location.pathname || '/').toLowerCase(); } catch (err) {}
    if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
    var bit = path.split('/').pop() || '';
    return bit.replace(/\.html$/, '');
  }

  function hashStem() {
    var hash = '';
    try { hash = String(root.location.hash || '').toLowerCase(); } catch (err) {}
    return hash.replace(/^#/, '').split('?')[0];
  }

  function toolFromLocation() {
    var stem = pathStem();
    var hash = hashStem();
    if (hash === 'pricing' && (stem === '' || stem === 'index' || stem === 'pricing')) return 'pricing';
    if (stem === 'pricing') return 'pricing';
    if (hash === 'distribute' || stem === 'upload') return 'distribution';
    if (stem === 'song-helper') return 'song_helper';
    if (stem === 'cover-art') return 'cover_art';
    if (stem === 'destination' || stem === 'my-roadmap') return 'roadmap';
    if (stem === 'qualify') return 'qualify';
    if (stem === 'contracts' || stem.indexOf('contracts-') === 0) return 'contracts';
    if (stem === 'ar') return 'ar';
    if (stem === 'epk') return 'epk';
    if (stem === 'plai') return 'plai';
    return '';
  }

  function contractStep() {
    var stem = pathStem();
    if (stem === 'contracts-review') return 'review';
    if (stem === 'contracts-fix') return 'fix';
    if (stem === 'contracts-create') return 'create';
    return '';
  }

  function markMarketing(name, payload) {
    var src = payload && typeof payload === 'object' ? payload : {};
    var key = name + ':' + safeToken(src.step, 24);
    if (pageOnce[key]) return;
    pageOnce[key] = true;
    track(name, src);
  }

  function noteToolView() {
    var tool = toolFromLocation();
    if (!tool || consentDenied()) return;
    var day = new Date().toISOString().slice(0, 10);
    var map = readJson(TOOL_DAY_KEY);
    if (!map || typeof map !== 'object' || Array.isArray(map)) map = {};
    if (map[tool] === day) return;
    var sent = postMarketing('tool_view', { tool: tool });
    if (!sent || !sent.then) return;
    sent.then(function (res) {
      if (res && (res.ok || res.status === 200)) {
        map[tool] = day;
        writeJson(TOOL_DAY_KEY, map);
      }
    });
    if (tool === 'plai') markMarketing('plai_opened', { tool: 'plai' });
    var opened = contractStep();
    if (opened) markMarketing('contract_opened', { tool: 'contracts', step: opened });
  }

  function shown(node) {
    var cur = node;
    while (cur && cur !== root.document) {
      if (cur.hidden) return false;
      cur = cur.parentElement || null;
    }
    return true;
  }

  function noteVisibleSteps() {
    if (toolFromLocation() !== 'song_helper') return;
    if (!root.document || !root.document.querySelectorAll) return;
    var nodes = root.document.querySelectorAll('[data-step]');
    for (var i = 0; i < nodes.length; i += 1) {
      if (!shown(nodes[i])) continue;
      var step = safeToken(nodes[i].getAttribute('data-step'), 24);
      if (step) markMarketing('song_helper_step', { tool: 'song_helper', step: step });
    }
  }

  function onToolClick(event) {
    var node = event && event.target;
    if (node && node.nodeType === 3) node = node.parentElement;
    if (!node || !node.closest) return;
    var choice = node.closest('#sh-choice-scratch, #sh-choice-source, #sh-choice-page, #sh-choice-ideas, #sh-choice-own');
    if (choice && choice.id) {
      var picked = choice.id.replace('sh-choice-', '');
      if (picked === 'page') picked = 'lyrics';
      markMarketing('song_helper_step', { tool: 'song_helper', step: picked });
      return;
    }
    if (node.closest('#sh-sounds-go, #sh-sounds-layout')) {
      markMarketing('song_helper_sounds', { tool: 'song_helper' });
      return;
    }
    if (node.closest('[data-contract-go]')) {
      markMarketing('contract_opened', { tool: 'contracts', step: 'read' });
      return;
    }
    var dest = node.closest('.dest-choice');
    if (dest) {
      var group = dest.getAttribute('data-group') || '';
      var value = safeToken(dest.getAttribute('data-value'), 24);
      if (group === 'song' && (value === 'idea' || value === 'made' || value === 'out')) {
        markMarketing('roadmap_stage', { tool: 'roadmap', step: value });
      }
      if (group === 'goal' && (value === 'money' || value === 'fanbase' || value === 'release')) {
        markMarketing('roadmap_goal', { tool: 'roadmap', step: value });
      }
      return;
    }
    if (node.closest('[data-plai-talk], [data-plai-text], [data-plai-coach-talk], .plai-bubble-pill')) {
      markMarketing('plai_opened', { tool: 'plai' });
    }
    var button = node.closest('button');
    if (!button) return;
    var label = clip(button.textContent, 80);
    if (label === 'Ask me a question') markMarketing('song_helper_ask', { tool: 'song_helper' });
    else if (label === 'Rhymify') markMarketing('song_helper_rhymify', { tool: 'song_helper' });
    else if (label === 'Turn it into traits' || label === 'Use this layout') markMarketing('song_helper_sounds', { tool: 'song_helper' });
    else if (label === 'Make my style prompt') markMarketing('song_helper_style_made', { tool: 'song_helper' });
    else if (CHIP_SLUGS[label]) markMarketing('plai_chip', { tool: 'plai', step: CHIP_SLUGS[label] });
  }

  function onSectionInput(event) {
    var node = event && event.target;
    if (!node || !node.closest) return;
    var box = node.closest('[data-part-text]');
    if (!box) return;
    var raw = box.getAttribute('data-part-text') || '';
    var step = /^[a-z0-9_-]{1,24}$/.test(raw) ? raw : 'section';
    if (pageOnce['section:' + step]) return;
    if (!root.setTimeout) {
      pageOnce['section:' + step] = true;
      track('song_helper_section', { tool: 'song_helper', step: step });
      return;
    }
    var timerKey = 'section-timer:' + step;
    if (pageOnce[timerKey] && root.clearTimeout) root.clearTimeout(pageOnce[timerKey]);
    pageOnce[timerKey] = root.setTimeout(function () {
      if (pageOnce['section:' + step]) return;
      pageOnce['section:' + step] = true;
      track('song_helper_section', { tool: 'song_helper', step: step });
    }, 700);
  }

  function watchTools() {
    if (!root.document || !root.document.addEventListener) return;
    noteToolView();
    noteVisibleSteps();
    root.document.addEventListener('click', onToolClick);
    root.document.addEventListener('input', onSectionInput);
    if (root.MutationObserver && root.document.body) {
      var watcher = new root.MutationObserver(function () { noteVisibleSteps(); });
      watcher.observe(root.document.body, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
    }
  }

  function boot() {
    captureAttribution();
    installQueue();
    flushPending();
    noteVisit();
    noteReturned();
    if (root.document) {
      watchTools();
      watchWhatsNew();
    }
    track('return_visit', {});
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
