(function () {
  'use strict';

  var STORAGE_KEY = 'plaiground.plai-welcome-dismissed';
  var COOKIE_NAME = 'plai_welcome_dismissed';
  var root = document.querySelector('[data-plai-coach-float]');
  if (!root) return;

  var details = root.querySelector('details');
  var dismissed = false;

  function readCookie(name) {
    var parts = String(document.cookie || '').split(';');
    var i;
    for (i = 0; i < parts.length; i += 1) {
      var part = parts[i].replace(/^\s+/, '');
      if (part.indexOf(name + '=') === 0) return decodeURIComponent(part.slice(name.length + 1));
    }
    return '';
  }

  function writeCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=31536000; SameSite=Lax';
  }

  function storageGet(key) {
    try { return window.localStorage ? window.localStorage.getItem(key) : null; } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { if (window.localStorage) window.localStorage.setItem(key, value); } catch (e) {}
  }

  function wasDismissed() {
    return storageGet(STORAGE_KEY) === '1' || readCookie(COOKIE_NAME) === '1';
  }

  function isSignedIn() {
    var api = window.PlaigroundMembership;
    return !!(api && typeof api.isSignedIn === 'function' && api.isSignedIn());
  }

  function persistDismiss() {
    dismissed = true;
    storageSet(STORAGE_KEY, '1');
    writeCookie(COOKIE_NAME, '1');
  }

  function hideWelcome() {
    root.hidden = true;
    root.setAttribute('data-plai-welcome-state', 'dismissed');
    if (details) details.open = false;
  }

  function showWelcome() {
    root.hidden = false;
    root.setAttribute('data-plai-welcome-state', 'open');
    if (details) details.open = true;
  }

  function dismiss() {
    persistDismiss();
    hideWelcome();
  }

  function shouldStayHidden() {
    return dismissed || wasDismissed() || isSignedIn();
  }

  function apply() {
    if (shouldStayHidden()) {
      hideWelcome();
      return;
    }
    showWelcome();
  }

  root.querySelectorAll('[data-plai-welcome-dismiss]').forEach(function (btn) {
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    });
  });

  root.querySelectorAll('[data-plai-talk], [data-plai-text]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      persistDismiss();
      hideWelcome();
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' && event.key !== 'Esc') return;
    if (root.hidden || shouldStayHidden()) return;
    dismiss();
  });

  if (details) {
    details.addEventListener('toggle', function () {
      if (dismissed || root.hidden) return;
      if (!details.open) dismiss();
    });
  }

  apply();
  var api = window.PlaigroundMembership;
  if (api && typeof api.whenReady === 'function') api.whenReady(apply);
})();
