(function () {
  var GENRES = ['Hip hop', 'R&B', 'Pop', 'Country', 'Latin', 'EDM', 'Rock', 'Gospel'];
  var rows = [];
  var f = { region: '', genre: '', explicit: false };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function safeUrl(u) { return /^https:\/\//i.test(String(u || '')) ? String(u) : ''; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'source'; } }
  function regionOf(r) { return String(r.region || r.region_tag || '').trim(); }
  function genresOf(r) { return Array.isArray(r.genre) ? r.genre : (r.genre ? [String(r.genre)] : []); }
  function dateOf(r) { return String(r.date || r.logged_on || r.first_seen || ''); }
  function pass(r) {
    if (!f.explicit && (r.profanity || r.explicit)) return false;
    if (f.region && regionOf(r) !== f.region) return false;
    if (f.genre && genresOf(r).map(function (g) { return g.toLowerCase(); }).indexOf(f.genre.toLowerCase()) === -1) return false;
    return true;
  }
  function meta(r) {
    var bits = [];
    if (regionOf(r)) bits.push('<span class="sl-pill">' + esc(regionOf(r)) + '</span>');
    genresOf(r).forEach(function (g) { bits.push('<span class="sl-pill">' + esc(g) + '</span>'); });
    if (r.first_seen) bits.push('<span class="sl-pill">First seen ' + esc(r.first_seen) + '</span>');
    if (r.logged_on) bits.push('<span class="sl-pill">Logged ' + esc(r.logged_on) + '</span>');
    if (r.confidence) bits.push('<span class="sl-pill' + (r.confidence === 'low' ? ' low' : '') + '">Confidence: ' + esc(r.confidence) + '</span>');
    if (r.profanity) bits.push('<span class="sl-pill low">Explicit</span>');
    return '<div class="sl-meta">' + bits.join('') + '</div>';
  }
  function sources(r) {
    var list = (r.sources || (r.source ? [r.source] : [])).map(safeUrl).filter(Boolean);
    if (!list.length) return '';
    return '<p class="sl-src">Source: ' + list.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener nofollow">' + esc(host(u)) + '</a>'; }).join(', ') + '</p>';
  }
  function card(r, big) {
    return (big ? '<p class="arc-kicker">Today, ' + esc(new Date().toISOString().slice(0, 10)) + '</p><h2 class="sl-word">' : '<h3>') + esc(r.word) + (big ? '</h2>' : '</h3>') +
      '<p class="sl-mean">' + esc(r.meaning) + '</p>' +
      (r.example ? '<p class="sl-ex">"' + esc(r.example) + '"</p>' : '') +
      (r.region_detail ? '<p class="hint">' + esc(r.region_detail) + '</p>' : '') +
      meta(r) + sources(r);
  }
  function chips(host, values, key) {
    host.textContent = '';
    [''].concat(values).forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'arc-chip small' + (f[key] === v ? ' on' : '');
      b.setAttribute('aria-pressed', f[key] === v ? 'true' : 'false');
      b.textContent = v || 'All';
      b.onclick = function () { f[key] = v; paint(); };
      host.appendChild(b);
    });
  }
  function paint() {
    var regions = rows.map(regionOf).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    var genres = GENRES.concat(rows.reduce(function (a, r) { return a.concat(genresOf(r)); }, [])).filter(function (v, i, a) { return a.indexOf(v) === i; });
    chips($('sl-region'), regions, 'region');
    chips($('sl-genre'), genres, 'genre');
    var shown = rows.filter(pass).sort(function (a, b) { return dateOf(b).localeCompare(dateOf(a)); });
    var today = $('sl-today');
    if (!shown.length) {
      today.innerHTML = '<p class="sl-empty">' + (f.genre ? 'No sourced slang is tagged ' + esc(f.genre) + ' yet. Try All genres.' : 'No slang matches these filters yet.') + '</p>';
      $('sl-list').innerHTML = '';
      $('sl-count').textContent = '';
      return;
    }
    var day = Math.floor(Date.now() / 86400000);
    var pick = shown[day % shown.length];
    today.innerHTML = card(pick, true);
    $('sl-count').textContent = shown.length + (shown.length === 1 ? ' word' : ' words') + ' in the log.';
    $('sl-list').innerHTML = shown.filter(function (r) { return r !== pick; }).map(function (r) { return '<article class="sl-card">' + card(r, false) + '</article>'; }).join('');
  }
  $('sl-explicit').onchange = function () { f.explicit = this.checked; paint(); };
  fetch('/data/slang.json', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (d) {
    rows = (d && Array.isArray(d.entries) ? d.entries : []).filter(function (r) { return r && r.word && r.meaning; });
    paint();
  }).catch(function () { $('sl-today').innerHTML = '<p>Slang did not load. Try again in a moment.</p>'; });
})();
