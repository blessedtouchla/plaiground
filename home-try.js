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

  function variantToken() {
    var raw = '';
    try {
      var params = new URLSearchParams(window.location.search);
      raw = params.get('variant') || params.get('v') || '';
    } catch (err) {}
    if (!raw) raw = form.getAttribute('data-funnel-variant') || '';
    raw = String(raw || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    if (!raw && form.getAttribute('data-funnel-surface') === 'lp') raw = 'a';
    return raw;
  }

  function surfaceOf() {
    return form.getAttribute('data-funnel-surface') || 'homepage';
  }

  var variant = variantToken();
  if (surfaceOf() === 'lp') {
    track('lp_view', { surface: 'lp', variant: variant || 'a' });
    var marked = document.querySelectorAll('[data-track]');
    Array.prototype.forEach.call(marked, function (node) {
      if (variant) node.setAttribute('data-track-variant', variant);
      if (!node.getAttribute('data-track-surface')) node.setAttribute('data-track-surface', 'lp');
    });
  }

  form.addEventListener('submit', function (event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    var idea = String(field.value || '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280);
    if (!idea) {
      field.focus();
      return;
    }
    var payload = { surface: surfaceOf() };
    var chosen = variantToken();
    if (chosen) payload.variant = chosen;
    track('try_it_submit', payload);
    window.location.href = '/song-helper?idea=' + encodeURIComponent(idea);
  });
})();
