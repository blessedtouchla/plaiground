/* Black-and-gold wordmark melts into the graffiti logo. At most 1.4s.
   Skipped for reduced motion and slow connections. Clicks pass through. */
(function (root) {
  var MAX_MS = 1400;

  function reduced() {
    try {
      return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (err) {
      return false;
    }
  }

  function slow() {
    var nav = root.navigator;
    var conn = nav && (nav.connection || nav.mozConnection || nav.webkitConnection);
    if (!conn) return false;
    if (conn.saveData) return true;
    var kind = String(conn.effectiveType || '');
    return kind === 'slow-2g' || kind === '2g';
  }

  function holdAt() {
    try {
      if (!root.location) return null;
      var params = new URLSearchParams(root.location.search || '');
      if (!params.has('melt')) return null;
      var raw = params.get('melt');
      if (raw === '' || raw == null) return 0.45;
      var n = Number(raw);
      if (!isFinite(n)) return 0.45;
      if (n > 1) n = n / MAX_MS;
      return Math.max(0, Math.min(1, n));
    } catch (err) {
      return null;
    }
  }

  function energyOn() {
    var doc = root.document;
    if (!doc) return false;
    var html = doc.documentElement;
    if (html && html.classList && html.classList.contains('graffiti-energy')) return true;
    return !!(doc.body && doc.body.classList && doc.body.classList.contains('graffiti-energy'));
  }

  function play() {
    var doc = root.document;
    if (!doc || !doc.body) return;
    if (!energyOn()) return;
    if (reduced() || slow()) return;
    if (doc.querySelector('.graffiti-loader')) return;
    var hold = holdAt();
    var el = doc.createElement('div');
    el.className = hold == null ? 'graffiti-loader' : 'graffiti-loader is-hold';
    el.setAttribute('aria-hidden', 'true');
    if (hold != null) el.style.setProperty('--melt-hold', String(hold));
    var stage = doc.createElement('div');
    stage.className = 'melt';
    var gold = doc.createElement('p');
    gold.className = 'melt-gold';
    gold.textContent = 'PLAIGROUND';
    var img = doc.createElement('img');
    img.className = 'melt-color';
    img.src = '/assets/plaiground-logo.png';
    img.alt = '';
    stage.appendChild(gold);
    stage.appendChild(img);
    ['d1', 'd2', 'd3'].forEach(function (name) {
      var drip = doc.createElement('span');
      drip.className = 'melt-drip ' + name;
      stage.appendChild(drip);
    });
    el.appendChild(stage);
    doc.body.appendChild(el);
    if (hold != null) return;
    root.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, MAX_MS);
  }

  root.PlaigroundGraffiti = { play: play, reduced: reduced, slow: slow };

  function start() {
    if (energyOn()) play();
  }
  if (!root.document) return;
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
