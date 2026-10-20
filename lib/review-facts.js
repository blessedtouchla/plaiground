// Review page: shows the track artist, audio and songwriter that will ship, read from the saved draft.
(function () {
  'use strict';
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function fmt(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function warn(text) { var b = el('b', 'review-fact-warn', text); b.style.color = '#e5484d'; return b; }
  function row(box, label, value) { var p = el('p', 'review-fact'); p.appendChild(el('small', '', label + ' ')); p.appendChild(value); box.appendChild(p); return p; }
  function probe(src, done) {
    try {
      var a = new Audio(); a.preload = 'metadata';
      a.onloadedmetadata = function () { if (isFinite(a.duration) && a.duration > 0) done(a.duration); };
      a.src = src;
    } catch (e) {}
  }
  function render() {
    var box = document.querySelector('[data-review-facts]');
    if (!box || typeof window.PlaigroundReviewFacts !== 'function') return;
    var f; try { f = window.PlaigroundReviewFacts(); } catch (e) { return; }
    box.textContent = '';
    box.appendChild(el('h3', '', 'What we will send'));
    row(box, 'Track artist', f.artist ? el('b', '', f.artist) : warn('No artist picked yet. Go back to Upload and pick one.'));
    f.tracks.forEach(function (t, i) {
      var label = f.tracks.length > 1 ? 'Audio, track ' + (i + 1) : 'Audio';
      if (!t.has) { row(box, label, warn('Missing audio. Go back to Upload and add your song file.')); return; }
      var b = el('b', '', t.name || 'Song file added');
      row(box, label, b);
      var add = function (d) { b.textContent = (t.name || 'Song file') + ' (' + fmt(d) + ')'; };
      if (t.duration) add(t.duration);
      else if (t.file && window.URL) probe(URL.createObjectURL(t.file), add);
      else if (t.url) probe(t.url, add);
    });
    var legal = [f.legal_first, f.legal_last].filter(Boolean).join(' ');
    row(box, 'Songwriter', f.legal_first && f.legal_last ? el('b', '', legal) : warn('Missing legal name. Add your legal first and last name before you submit.'));
    box.hidden = false;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  window.addEventListener('pageshow', render);
})();
