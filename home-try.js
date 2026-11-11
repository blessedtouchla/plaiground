/* Signed-out try-it box. Signed-in visitors keep the existing homepage. */
(function () {
  'use strict';
  function signedIn() {
    var api = window.PlaigroundMembership;
    return !!(api && typeof api.isSignedIn === 'function' && api.isSignedIn());
  }
  function paint() {
    if (!document.body) return;
    document.body.classList.toggle('is-member', signedIn());
  }
  function track(name, data) {
    if (window.PlaigroundAnalytics && typeof window.PlaigroundAnalytics.track === 'function') {
      window.PlaigroundAnalytics.track(name, data);
      return;
    }
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    window.va('event', { name: name, data: data || {} });
  }
  paint();
  var api = window.PlaigroundMembership;
  if (api && typeof api.whenReady === 'function') api.whenReady(paint);

  var form = document.getElementById('try-it');
  var field = document.getElementById('try-idea');
  if (!form || !field) return;
  form.addEventListener('submit', function (event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    var idea = String(field.value || '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280);
    if (!idea) {
      field.focus();
      return;
    }
    track('try_it_submit', { surface: 'homepage' });
    window.location.href = '/song-helper?idea=' + encodeURIComponent(idea);
  });
})();
