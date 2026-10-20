// Release form: fan songs (saved with fanSong:true) cannot be released. Blocks Continue if pasted lyrics match one.
(function () {
  'use strict';
  var F = window.FanSong;
  if (!F) return;
  function saved() { try { return JSON.parse(localStorage.getItem(F.STORE_KEY) || '[]') || []; } catch (e) { return []; } }
  function lyricsEl() { return document.getElementById('tg-lyrics'); }
  function isFan() { var el = lyricsEl(); return Boolean(el && el.value && F.matchesFanSong(el.value, saved())); }
  function note(show) {
    var el = lyricsEl(); if (!el) return;
    var n = document.querySelector('[data-fan-song-block]');
    if (!n) { n = document.createElement('p'); n.className = 'hint'; n.setAttribute('data-fan-song-block', ''); n.style.color = '#e5484d'; n.textContent = F.BLOCK_COPY; el.parentNode.insertBefore(n, el.nextSibling); }
    n.hidden = !show;
  }
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'tg-lyrics') note(isFan()); }, true);
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-store-continue]');
    if (t && isFan()) { e.preventDefault(); e.stopImmediatePropagation(); note(true); lyricsEl().scrollIntoView({ block: 'center' }); }
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { note(isFan()); }); else note(isFan());
})();
