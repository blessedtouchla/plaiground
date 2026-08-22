(function (global) {
  var MEMBERSHIP_KEY = 'plaigroundMembership';
  var SESSION_KEY = 'plaigroundStripeSession';
  var PENDING_KEY = 'plaigroundMembershipPending';
  var VALID = { creator: true, pro: true };
  var PRICING = 'index.html?needplan=1#pricing';

  function storeGet(key) {
    try {
      return sessionStorage.getItem(key) || '';
    } catch (err) {
      return '';
    }
  }

  function storeSet(key, value) {
    try {
      if (value) sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    } catch (err) {}
  }

  function normalizePlan(value) {
    var plan = String(value || '').trim().toLowerCase();
    return VALID[plan] ? plan : '';
  }

  function rememberPending(plan) {
    var next = normalizePlan(plan);
    if (next) storeSet(PENDING_KEY, next);
    return next;
  }

  function recordPaidMembership(plan, sessionId) {
    var next = normalizePlan(plan) || normalizePlan(storeGet(PENDING_KEY));
    if (next) storeSet(MEMBERSHIP_KEY, next);
    if (sessionId) storeSet(SESSION_KEY, String(sessionId));
    storeSet(PENDING_KEY, '');
    return next;
  }

  function hasMembership() {
    if (normalizePlan(storeGet(MEMBERSHIP_KEY))) return true;
    return Boolean(storeGet(SESSION_KEY));
  }

  function requireMembership() {
    if (hasMembership()) return true;
    global.location.replace(PRICING);
    return false;
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

  global.PlaigroundMembership = {
    rememberPending: rememberPending,
    recordPaidMembership: recordPaidMembership,
    hasMembership: hasMembership,
    requireMembership: requireMembership,
  };

  var script = document.currentScript;
  if (script && script.getAttribute('data-require-membership') === 'true') {
    requireMembership();
  }
  revealPricingHint();
})(window);
