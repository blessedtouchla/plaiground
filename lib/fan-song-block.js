// Fan songs can be released, with three checks:
// 1) the celebrity's name is not the artist, 2) the title has no "Official" or "feat./ft. <celebrity>",
// 3) on Attest, the user confirms the cover does not use their photo.
(function () {
  'use strict';
  var F = window.FanSong;
  if (!F) return;
  function saved() { try { return JSON.parse(localStorage.getItem(F.STORE_KEY) || '[]') || []; } catch (e) { return []; } }
  function draft() { try { return JSON.parse(localStorage.getItem('plaiground.store.draft') || sessionStorage.getItem('plaiground.store.draft') || '{}') || {}; } catch (e) { return {}; } }
  function val(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
  function fanRow() {
    var lyrics = val('tg-lyrics') || String(draft().lyrics || '');
    return lyrics ? F.matchedFanSong(lyrics, saved()) : null;
  }
  function selectedArtistText() {
    var sel = document.getElementById('tg-artist-select');
    var label = sel && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
    return [val('tg-artist'), val('tg-artist-new'), label].join(' ');
  }
  function noteBox(anchor, key) {
    var n = document.querySelector('[data-fan-check="' + key + '"]');
    if (!n && anchor) {
      n = document.createElement('p'); n.className = 'hint'; n.setAttribute('data-fan-check', key); n.style.color = '#e5484d';
      anchor.parentNode.insertBefore(n, anchor);
    }
    return n;
  }

  // Upload page
  function uploadProblems() {
    var row = fanRow();
    if (!row) return [];
    return F.releaseProblems({ artist: selectedArtistText(), title: val('tg-title') }, row.for);
  }
  function showUpload() {
    var btn = document.querySelector('[data-store-continue]');
    if (!btn) return [];
    var probs = uploadProblems();
    var n = noteBox(btn, 'upload');
    if (n) { n.textContent = probs.map(function (p) { return p.msg; }).join(' '); n.hidden = !probs.length; }
    return probs;
  }

  // Attest page
  function attestBox() {
    var btn = document.querySelector('[data-attest-continue]');
    if (!btn || !fanRow()) return null;
    var wrap = document.querySelector('[data-fan-cover-check]');
    if (!wrap) {
      wrap = document.createElement('label'); wrap.className = 'toggle-line'; wrap.setAttribute('data-fan-cover-check', '');
      var box = document.createElement('input'); box.type = 'checkbox'; box.id = 'fan-cover-ok';
      var span = document.createElement('span'); span.textContent = ' ' + F.COVER_CHECK;
      wrap.appendChild(box); wrap.appendChild(span);
      btn.parentNode.insertBefore(wrap, btn);
    }
    return wrap.querySelector('input');
  }

  document.addEventListener('input', function (e) { if (e.target && /^tg-(lyrics|title|artist)/.test(e.target.id || '')) showUpload(); }, true);
  document.addEventListener('change', function (e) { if (e.target && /^tg-artist/.test(e.target.id || '')) showUpload(); }, true);
  document.addEventListener('click', function (e) {
    var up = e.target && e.target.closest && e.target.closest('[data-store-continue]');
    if (up && showUpload().length) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    var at = e.target && e.target.closest && e.target.closest('[data-attest-continue]');
    if (at) {
      var box = attestBox();
      if (box && !box.checked) {
        e.preventDefault(); e.stopImmediatePropagation();
        var n = noteBox(box.parentNode, 'cover'); if (n) { n.textContent = 'Please confirm the cover does not use their photo.'; n.hidden = false; }
      }
    }
  }, true);
  function boot() { showUpload(); attestBox(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
