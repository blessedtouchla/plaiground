// Review page: shows the track artist, audio and songwriter that will ship, read from the saved draft.
// If anything is missing, Submit is paused and each red line links back to where to fix it.
(function () {
  'use strict';
  var blocked = false;
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function fmt(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function warn(text, href) { var a = el('a', 'review-fact-warn', text); a.href = href; a.style.color = '#e5484d'; a.style.fontWeight = '700'; a.style.textDecoration = 'underline'; return a; }
  function row(box, label, value) { var p = el('p', 'review-fact'); p.appendChild(el('small', '', label + ' ')); p.appendChild(value); box.appendChild(p); return p; }
  function probe(src, done) {
    try { var a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = function () { if (isFinite(a.duration) && a.duration > 0) done(a.duration); }; a.src = src; } catch (e) {}
  }
  function setSubmit(isBlocked) {
    blocked = isBlocked;
    var btn = document.querySelector('[data-store-submit]');
    if (!btn) return;
    var note = document.querySelector('[data-review-fix-note]');
    if (!note) {
      note = el('p', 'hint review-fix-note', 'Fix the items in red to submit.');
      note.setAttribute('data-review-fix-note', '');
      note.style.color = '#e5484d';
      var actions = btn.closest('.review-actions') || btn.parentNode;
      actions.parentNode.insertBefore(note, actions);
    }
    note.hidden = !isBlocked;
    if (isBlocked) { btn.setAttribute('aria-disabled', 'true'); btn.style.opacity = '0.45'; btn.style.pointerEvents = 'none'; }
    else { btn.removeAttribute('aria-disabled'); btn.style.opacity = ''; btn.style.pointerEvents = ''; }
  }
  document.addEventListener('click', function (e) {
    if (!blocked) return;
    var t = e.target && e.target.closest && e.target.closest('[data-store-submit]');
    if (t) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  function render() {
    var box = document.querySelector('[data-review-facts]');
    if (!box || typeof window.PlaigroundReviewFacts !== 'function') return;
    var f; try { f = window.PlaigroundReviewFacts(); } catch (e) { return; }
    var bad = false;
    box.textContent = '';
    box.appendChild(el('h3', '', 'What we will send'));
    if (f.artist) row(box, 'Track artist', el('b', '', f.artist));
    else { bad = true; row(box, 'Track artist', warn('No artist picked yet. Tap here to pick one.', 'upload.html#artist-choose-wrap')); }
    f.tracks.forEach(function (t, i) {
      var label = f.tracks.length > 1 ? 'Audio, track ' + (i + 1) : 'Audio';
      if (!t.has) { bad = true; row(box, label, warn('Missing audio. Tap here to add your song file.', 'upload.html#upload-audio')); return; }
      var b = el('b', '', t.name || 'Song file added');
      row(box, label, b);
      var add = function (d) { b.textContent = (t.name || 'Song file') + ' (' + fmt(d) + ')'; };
      if (t.duration) add(t.duration);
      else if (t.file && window.URL) probe(URL.createObjectURL(t.file), add);
      else if (t.url) probe(t.url, add);
    });
    if (f.legal_first && f.legal_last) row(box, 'Songwriter', el('b', '', f.legal_first + ' ' + f.legal_last));
    else {
      bad = true;
      var href = 'artists.html' + (f.artist_id && f.artist_id !== 'account' ? '?id=' + encodeURIComponent(f.artist_id) : '') + '#artist-legal-first';
      row(box, 'Songwriter', warn('Missing legal name. Tap here to add your legal first and last name.', href));
    }
    box.hidden = false;
    setSubmit(bad);
  }
  function boot() { render(); setTimeout(render, 1500); setTimeout(render, 4000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('pageshow', render);
  window.addEventListener('focus', render);
})();
