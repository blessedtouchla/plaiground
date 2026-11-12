/* Vercel Web Analytics custom events. No lyrics, prompts, emails, or names. */
(function (root) {
  'use strict';
  if (root.PlaigroundAnalytics) return;
  root.va = root.va || function () { (root.vaq = root.vaq || []).push(arguments); };

  var NAMES = {
    try_it_submit: 1,
    song_lab_start: 1,
    song_lab_completed: 1,
    signup_start: 1,
    signup_completed: 1,
    primary_cta: 1,
    lp_view: 1,
    plai_answer: 1
  };
  var KEYS = { surface: 1, entry: 1, sample: 1, signed_in: 1, cta: 1, from: 1, variant: 1, answer: 1 };
  var PRIMARY_LABELS = {
    'release now': 'release_now',
    'join free': 'join_free',
    'create free account': 'create_account',
    'start releasing': 'start_releasing',
    'write a song free': 'write_song'
  };

  function token(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  }

  function clean(data) {
    var out = {};
    if (!data || typeof data !== 'object') return out;
    Object.keys(KEYS).forEach(function (key) {
      if (data[key] == null || data[key] === '') return;
      var value = data[key];
      if (typeof value === 'boolean') {
        out[key] = value ? 'yes' : 'no';
        return;
      }
      if (typeof value === 'number' && isFinite(value)) {
        out[key] = value;
        return;
      }
      var text = token(value);
      if (text) out[key] = text;
    });
    return out;
  }

  function track(name, data) {
    var eventName = token(name);
    if (!NAMES[eventName]) return;
    try {
      root.va('event', { name: eventName, data: clean(data) });
    } catch (err) {}
  }

  function labelOf(node) {
    return String(node && node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function onClick(event) {
    var node = event && event.target;
    if (node && node.nodeType === 3) node = node.parentElement;
    if (!node || !node.closest) return;
    var marked = node.closest('[data-track]');
    if (marked) {
      var name = marked.getAttribute('data-track');
      if (!NAMES[name]) return;
      var data = {};
      Object.keys(KEYS).forEach(function (key) {
        var value = marked.getAttribute('data-track-' + key);
        if (value) data[key] = value;
      });
      track(name, data);
      return;
    }
    var button = node.closest('a, button');
    if (!button) return;
    var cta = PRIMARY_LABELS[labelOf(button)];
    if (!cta) return;
    track('primary_cta', { cta: cta, surface: 'site' });
  }

  function ensureScript() {
    var doc = root.document;
    if (!doc || !doc.querySelector || !doc.createElement) return;
    if (doc.querySelector('script[src*="/_vercel/insights/script.js"]')) return;
    var script = doc.createElement('script');
    script.defer = true;
    script.src = '/_vercel/insights/script.js';
    (doc.head || doc.documentElement).appendChild(script);
  }

  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('click', onClick, true);
  }
  ensureScript();
  root.PlaigroundAnalytics = { track: track, names: Object.keys(NAMES) };
})(typeof window !== 'undefined' ? window : globalThis);
