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

  var serverAccount = null;
  var serverStatus = 0;
  var accountReady = Promise.resolve(null);

  function applyServerAccount(me) {
    if (!me || typeof me !== 'object') return null;
    serverAccount = me;
    recordSignedIn();
    if (me.plan) recordPlan(me.plan);
    if (PAID[me.plan] && me.stripe_session_id) {
      recordPaidMembership(me.plan, me.stripe_session_id);
    }
    return me;
  }

  function probeAccount() {
    if (typeof global.fetch !== 'function') {
      accountReady = Promise.resolve({ status: 0, data: null });
      return accountReady;
    }
    accountReady = global.fetch('/api/me', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data || {} };
      }).catch(function () {
        return { ok: false, status: response.status, data: {} };
      });
    }).then(function (result) {
      serverStatus = result.status || 0;
      if (result.ok) applyServerAccount(result.data);
      return result;
    }).catch(function () {
      serverStatus = 503;
      return { ok: false, status: 503, data: { error: 'Accounts are not configured.' } };
    });
    return accountReady;
  }

  function isSignedIn() {
    if (serverAccount) return true;
    var value = String(storeGet(SIGNED_IN_KEY) || '').toLowerCase();
    return value === '1' || value === 'true' || value === 'yes';
  }

  function currentPlan() {
    if (serverAccount && normalizePlan(serverAccount.plan)) return normalizePlan(serverAccount.plan);
    return normalizePlan(storeGet(MEMBERSHIP_KEY));
  }

  function hasPlan() {
    var plan = currentPlan();
    if (serverAccount && plan) return true;
    if (plan === 'basic') return true;
    if (PAID[plan]) return Boolean(storeGet(SESSION_KEY));
    return false;
  }

  function hasMembership() {
    return isSignedIn() && hasPlan();
  }

  function requireMembership() {
    if (serverStatus === 401) {
      global.location.replace(LOGIN);
      return false;
    }
    if (serverStatus === 200) {
      if (hasPlan()) return true;
      global.location.replace(PRICING);
      return false;
    }
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
    account: function () { return serverAccount; },
    whenReady: function (cb) {
      var next = accountReady.then(function (result) {
        if (typeof cb === 'function') cb(result);
        return result;
      });
      return next;
    },
  };

  migrateSessionKeys();
  rememberQueryPlan();
  bindPlanClicks();
  probeAccount();

  var script = document.currentScript;
  if (script && script.getAttribute('data-require-membership') === 'true') {
    if (typeof global.fetch === 'function') {
      accountReady.then(function () { requireMembership(); });
    } else {
      requireMembership();
    }
  }
  revealPricingHint();
})(window);
