(function (global) {
  var MEMBERSHIP_KEY = 'plaigroundMembership';
  var SIGNED_IN_KEY = 'plaigroundSignedIn';
  var SESSION_KEY = 'plaigroundStripeSession';
  var PENDING_KEY = 'plaigroundMembershipPending';
  var VALID = { basic: true, creator: true, pro: true };
  var PAID = { creator: true, pro: true };
  var LOGIN = 'login.html';
  var PRICING = 'index.html?needplan=1#pricing';

  function storageGet(storage, key) {
    if (!storage) return '';
    try {
      return storage.getItem(key) || '';
    } catch (err) {
      return '';
    }
  }

  function storageSet(storage, key, value) {
    if (!storage) return;
    try {
      if (value) storage.setItem(key, value);
      else storage.removeItem(key);
    } catch (err) {}
  }

  function storeGet(key) {
    var local = storageGet(global.localStorage, key);
    if (local) return local;
    var session = storageGet(global.sessionStorage, key);
    if (session) {
      storageSet(global.localStorage, key, session);
      return session;
    }
    return '';
  }

  function storeSet(key, value) {
    storageSet(global.localStorage, key, value);
    storageSet(global.sessionStorage, key, value);
  }

  function normalizePlan(value) {
    var plan = String(value || '').trim().toLowerCase();
    return VALID[plan] ? plan : '';
  }

  function recordPlan(plan) {
    var next = normalizePlan(plan);
    if (!next) return '';
    storeSet(MEMBERSHIP_KEY, next);
    if (PAID[next]) storeSet(PENDING_KEY, next);
    return next;
  }

  function rememberPending(plan) {
    var next = normalizePlan(plan);
    if (!next) return '';
    if (next === 'basic') {
      storeSet(MEMBERSHIP_KEY, next);
      return next;
    }
    storeSet(PENDING_KEY, next);
    storeSet(MEMBERSHIP_KEY, next);
    return next;
  }

  function recordPaidMembership(plan, sessionId) {
    var next = normalizePlan(plan) || normalizePlan(storeGet(PENDING_KEY)) || normalizePlan(storeGet(MEMBERSHIP_KEY));
    if (sessionId) storeSet(SESSION_KEY, String(sessionId));
    if (next === 'basic') {
      storeSet(MEMBERSHIP_KEY, next);
      storeSet(PENDING_KEY, '');
      return next;
    }
    if (PAID[next] && sessionId) {
      storeSet(MEMBERSHIP_KEY, next);
      storeSet(PENDING_KEY, '');
      return next;
    }
    return normalizePlan(storeGet(MEMBERSHIP_KEY));
  }

  function recordSignedIn() {
    storeSet(SIGNED_IN_KEY, '1');
    return true;
  }

  function isSignedIn() {
    var value = String(storeGet(SIGNED_IN_KEY) || '').toLowerCase();
    return value === '1' || value === 'true' || value === 'yes';
  }

  function currentPlan() {
    return normalizePlan(storeGet(MEMBERSHIP_KEY));
  }

  function hasPlan() {
    var plan = currentPlan();
    if (plan === 'basic') return true;
    if (PAID[plan]) return Boolean(storeGet(SESSION_KEY));
    return false;
  }

  function hasMembership() {
    return isSignedIn() && hasPlan();
  }

  function requireMembership() {
    if (!isSignedIn()) {
      global.location.replace(LOGIN);
      return false;
    }
    if (!hasPlan()) {
      global.location.replace(PRICING);
      return false;
    }
    return true;
  }

  function migrateSessionKeys() {
    storeGet(MEMBERSHIP_KEY);
    storeGet(SIGNED_IN_KEY);
    storeGet(SESSION_KEY);
    storeGet(PENDING_KEY);
  }

  function rememberQueryPlan() {
    var params;
    try {
      params = new URLSearchParams(global.location.search);
    } catch (err) {
      return '';
    }
    return recordPlan(params.get('plan'));
  }

  function revealPricingHint() {
    var params;
    try {
      params = new URLSearchParams(global.location.search);
    } catch (err) {
      return;
    }
    if (params.get('needplan') !== '1') return;
    var el = document.querySelector('[data-need-plan]');
    if (el) el.hidden = false;
  }

  function bindPlanClicks() {
    if (!global.document || !global.document.addEventListener) return;
    global.document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var el = target.closest('[data-plan]');
      if (!el) return;
      recordPlan(el.getAttribute('data-plan'));
    });
  }

  global.PlaigroundMembership = {
    rememberPending: rememberPending,
    recordPaidMembership: recordPaidMembership,
    recordPlan: recordPlan,
    recordSignedIn: recordSignedIn,
    isSignedIn: isSignedIn,
    hasPlan: hasPlan,
    hasMembership: hasMembership,
    requireMembership: requireMembership,
    currentPlan: currentPlan,
  };

  migrateSessionKeys();
  rememberQueryPlan();
  bindPlanClicks();

  var script = document.currentScript;
  if (script && script.getAttribute('data-require-membership') === 'true') {
    requireMembership();
  }
  revealPricingHint();
})(window);
