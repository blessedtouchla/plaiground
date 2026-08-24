(function (global) {
  var MEMBERSHIP_KEY = 'plaigroundMembership';
  var SIGNED_IN_KEY = 'plaigroundSignedIn';
  var SIGNED_IN_AT_KEY = 'plaigroundSignedInAt';
  var SESSION_KEY = 'plaigroundStripeSession';
  var PENDING_KEY = 'plaigroundMembershipPending';
  var SESSION_TTL_MS = 30 * 60 * 1000;
  var VALID = { basic: true, creator: true, pro: true };
  var PAID = { creator: true, pro: true };
  var LOGIN = 'login.html';
  var PRICING = 'index.html?needplan=1#pricing';
  var HOLD_PRICING = 'index.html?hold=1#pricing';
  var PUBLISHING = 'publishing-register.html';

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
    storeSet(SIGNED_IN_AT_KEY, String(Date.now()));
    return true;
  }

  function clearSignedIn() {
    storeSet(SIGNED_IN_KEY, '');
    storeSet(SIGNED_IN_AT_KEY, '');
  }

  function expireHintCookie() {
    try {
      if (global.document) {
        global.document.cookie = 'plaiground_signed=; Path=/; Max-Age=0; SameSite=Lax';
      }
    } catch (err) {}
  }

  function clearDeadSession() {
    serverAccount = null;
    clearSignedIn();
    storeSet(MEMBERSHIP_KEY, '');
    storeSet(PENDING_KEY, '');
    storeSet(SESSION_KEY, '');
    expireHintCookie();
  }

  function signedInFresh() {
    var value = String(storeGet(SIGNED_IN_KEY) || '').toLowerCase();
    if (value !== '1' && value !== 'true' && value !== 'yes') return false;
    var at = Number(storeGet(SIGNED_IN_AT_KEY) || 0);
    if (!at) {
      storeSet(SIGNED_IN_AT_KEY, String(Date.now()));
      return true;
    }
    if (Date.now() - at > SESSION_TTL_MS) {
      if (hasSessionCookie()) {
        storeSet(SIGNED_IN_AT_KEY, String(Date.now()));
        return true;
      }
      clearSignedIn();
      return false;
    }
    return true;
  }

  var serverAccount = null;
  var serverStatus = 0;
  var accountSettled = false;
  var resolveAccountReady;
  var accountReady = new Promise(function (resolve) {
    resolveAccountReady = resolve;
  });

  function hasSessionCookie() {
    var raw = '';
    try {
      raw = String((global.document && global.document.cookie) || '');
    } catch (err) {
      return false;
    }
    var parts = raw.split(';');
    for (var i = 0; i < parts.length; i += 1) {
      var piece = String(parts[i] || '').replace(/^\s+/, '');
      var eq = piece.indexOf('=');
      if (eq <= 0) continue;
      var name = piece.slice(0, eq);
      var value = piece.slice(eq + 1);
      if ((name === 'plaiground_session' || name === 'plaiground_signed') && value) return true;
    }
    return false;
  }

  function hydrateSignedInFromCookie() {
    if (!hasSessionCookie()) return false;
    recordSignedIn();
    return true;
  }

  function hasLiveSession() {
    return isSignedIn() || hasSessionCookie() || Boolean(serverAccount);
  }

  function isConfirmedLoggedOut() {
    return accountSettled && serverStatus === 401 && !hasLiveSession();
  }

  function scriptFlag(name) {
    var doc = global.document;
    if (!doc) return false;
    try {
      var current = doc.currentScript;
      if (current && current.getAttribute(name) === 'true') return true;
      if (typeof doc.querySelector === 'function') {
        var tagged = doc.querySelector('script[' + name + '="true"]');
        if (tagged) return true;
      }
    } catch (err) {}
    return false;
  }

  function settleAccount(result) {
    accountSettled = true;
    if (typeof resolveAccountReady === 'function') {
      resolveAccountReady(result);
      resolveAccountReady = null;
    }
    accountReady = Promise.resolve(result);
    return result;
  }

  function fetchMe() {
    return global.fetch('/api/me', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data || {} };
      }).catch(function () {
        return { ok: false, status: response.status, data: {} };
      });
    }).catch(function () {
      return { ok: false, status: 503, data: { error: 'Accounts are not configured.' } };
    });
  }

  function shouldRetryMe(result) {
    var status = result && result.status ? result.status : 0;
    return status === 401 || status === 0 || status === 503;
  }

  function applyServerAccount(me) {
    if (!me || typeof me !== 'object') return null;
    serverAccount = me;
    recordSignedIn();
    if (me.plan) recordPlan(me.plan);
    if (PAID[me.plan] && me.stripe_session_id && String(me.status || '').toLowerCase() !== 'hold') {
      recordPaidMembership(me.plan, me.stripe_session_id);
    }
    return me;
  }

  function probeAccount() {
    if (typeof global.fetch !== 'function') {
      serverStatus = 0;
      return settleAccount({ ok: false, status: 0, data: null });
    }
    fetchMe().then(function (result) {
      if (shouldRetryMe(result)) return fetchMe();
      return result;
    }).then(function (result) {
      serverStatus = (result && result.status) || 0;
      if (result && result.ok) applyServerAccount(result.data);
      else if (serverStatus === 401) clearDeadSession();
      return settleAccount(result);
    }).catch(function () {
      serverStatus = 503;
      return settleAccount({ ok: false, status: 503, data: { error: 'Accounts are not configured.' } });
    });
    return accountReady;
  }

  function isSignedIn() {
    if (serverAccount) return true;
    if (hasSessionCookie()) {
      recordSignedIn();
      return true;
    }
    return signedInFresh();
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

  function accountStatus() {
    return String((serverAccount && serverAccount.status) || '').toLowerCase();
  }

  function isOnHold() {
    return accountStatus() === 'hold';
  }

  function isWarning() {
    return accountStatus() === 'warning';
  }

  function canGetPayout() {
    if (!serverAccount) return true;
    return accountStatus() !== 'warning' && accountStatus() !== 'hold';
  }

  function hasPaidAccess() {
    if (isOnHold()) return false;
    var plan = currentPlan();
    if (!PAID[plan]) return false;
    if (serverAccount) return true;
    return Boolean(storeGet(SESSION_KEY));
  }

  function hasMembership() {
    return isSignedIn() && hasPlan();
  }

  function requireMembership() {
    if (!accountSettled) return true;
    if (isConfirmedLoggedOut()) {
      global.location.replace(LOGIN);
      return false;
    }
    if (serverStatus === 200 && !hasPlan()) {
      global.location.replace(PRICING);
      return false;
    }
    return true;
  }

  function requirePaidAccess() {
    if (!requireMembership()) return false;
    if (hasPaidAccess()) return true;
    global.location.replace(isOnHold() ? HOLD_PRICING : PRICING);
    return false;
  }

  function isPublishingExplainer() {
    var path = String((global.location && global.location.pathname) || '');
    var file = path.split('/').pop();
    return file === 'publishing.html';
  }

  function publishingHref() {
    if (hasPaidAccess()) return PUBLISHING;
    if (isOnHold()) return HOLD_PRICING;
    return PRICING;
  }

  function requirePublishingAccess() {
    if (hasPaidAccess()) {
      if (isPublishingExplainer()) {
        global.location.replace(PUBLISHING);
        return false;
      }
      return true;
    }
    if (!accountSettled) return true;
    if (isConfirmedLoggedOut()) {
      global.location.replace(LOGIN);
      return false;
    }
    if (serverStatus === 200) {
      global.location.replace(isOnHold() ? HOLD_PRICING : PRICING);
      return false;
    }
    return true;
  }

  function destinationForPublishing() {
    if (hasPaidAccess()) return PUBLISHING;
    if (!accountSettled || !isConfirmedLoggedOut()) {
      if (hasLiveSession() || serverStatus === 200) return publishingHref();
      return PUBLISHING;
    }
    return LOGIN;
  }

  function destinationForSignedInUpload(href) {
    var dest = href || 'upload.html';
    if (!accountSettled || !isConfirmedLoggedOut()) return dest;
    return LOGIN;
  }

  function bindAccountClicks() {
    if (!global.document || !global.document.addEventListener) return;
    global.document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var publishing = target.closest('[data-publishing-register]');
      var upload = target.closest('[data-signed-in-upload]');
      if (!publishing && !upload) return;
      event.preventDefault();
      var href = (publishing || upload).getAttribute('href') || (publishing ? PUBLISHING : 'upload.html');
      accountReady.then(function () {
        global.location.href = publishing
          ? destinationForPublishing()
          : destinationForSignedInUpload(href);
      });
    });
  }

  function migrateSessionKeys() {
    storeGet(MEMBERSHIP_KEY);
    storeGet(SIGNED_IN_KEY);
    storeGet(SIGNED_IN_AT_KEY);
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

  function isMarketingHome() {
    var path = String((global.location && global.location.pathname) || '');
    var file = path.split('/').pop();
    return path === '/' || file === '' || file === 'index.html';
  }

  function homeWantsPricing() {
    try {
      return new URLSearchParams(global.location.search).get('needplan') === '1';
    } catch (err) {
      return false;
    }
  }

  function goDashboardFromHome() {
    if (!isMarketingHome() || homeWantsPricing()) return false;
    if (!isSignedIn()) return false;
    global.location.replace('dashboard.html');
    return true;
  }

  function isLoginPage() {
    var path = String((global.location && global.location.pathname) || '');
    var file = path.split('/').pop();
    return file === 'login.html';
  }

  function goDashboardFromLogin() {
    if (!isLoginPage()) return false;
    if (!(serverStatus === 200 && serverAccount)) return false;
    global.location.replace('dashboard.html');
    return true;
  }

  function isBoostTease() {
    var path = String((global.location && global.location.pathname) || '');
    var file = path.split('/').pop();
    return file === 'boost.html';
  }

  function goSignedInBoosts() {
    if (!isBoostTease()) return false;
    if (!isSignedIn()) return false;
    global.location.replace('boosts.html');
    return true;
  }

  function planForCopy() {
    if (!accountSettled || serverStatus === 401) return '';
    return currentPlan() || 'basic';
  }

  function applyPlanCopy() {
    var doc = global.document;
    if (!doc || typeof doc.querySelectorAll !== 'function') return;
    var plan = planForCopy();
    var nodes = doc.querySelectorAll('[data-for-plans]');
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      var allowed = String(el.getAttribute('data-for-plans') || '').toLowerCase().split(/\s+/);
      var show = Boolean(plan) && allowed.indexOf(plan) !== -1;
      el.hidden = !show;
      if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', !show);
    }
  }

  function hideAll(doc, sel) {
    if (!doc || typeof doc.querySelectorAll !== 'function') return;
    var nodes = doc.querySelectorAll(sel);
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      nodes[i].hidden = true;
    }
  }

  function clearText(doc, sel) {
    if (!doc || typeof doc.querySelectorAll !== 'function') return;
    var nodes = doc.querySelectorAll(sel);
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      nodes[i].textContent = '';
    }
  }

  function applyLoggedOutChrome() {
    var doc = global.document;
    if (!doc) return;
    var loggedOut = accountSettled && serverStatus === 401;
    var body = doc.body;
    if (body && body.classList && typeof body.classList.toggle === 'function') {
      body.classList.toggle('is-logged-out', loggedOut);
    }
    if (!loggedOut) return;
    hideAll(doc, '.who');
    hideAll(doc, '.side');
    hideAll(doc, '.pro-card');
    clearText(doc, '[data-account-who]');
    clearText(doc, '[data-account-avatar]');
    clearText(doc, '[data-account-plan]');
    clearText(doc, '[data-account-plan-title]');
    clearText(doc, '[data-account-plan-price]');
    clearText(doc, '[data-account-plan-pitch]');
    clearText(doc, '[data-account-plan-year]');
    var topbar = typeof doc.querySelector === 'function' ? doc.querySelector('.topbar') : null;
    if (topbar && typeof doc.createElement === 'function' && !topbar.querySelector('[data-logged-out-login]')) {
      var login = doc.createElement('a');
      login.className = 'login';
      login.setAttribute('data-logged-out-login', 'true');
      login.href = LOGIN;
      login.textContent = 'Log in';
      topbar.appendChild(login);
    }
  }

  function whenDomReady(cb) {
    var doc = global.document;
    if (!doc || typeof cb !== 'function') return;
    if (doc.readyState === 'loading' && typeof doc.addEventListener === 'function') {
      doc.addEventListener('DOMContentLoaded', cb);
      return;
    }
    cb();
  }

  var FLOW_STEPS = ['upload.html', 'attest.html', 'split-sheet.html', 'review.html'];

  function bindFlowStepper() {
    var doc = global.document;
    if (!doc || typeof doc.querySelector !== 'function') return;
    var root = doc.querySelector('.stepper');
    if (!root || root.getAttribute('data-flow-bound') === 'true') return;
    if (typeof root.setAttribute === 'function') root.setAttribute('data-flow-bound', 'true');
    var steps = root.querySelectorAll ? root.querySelectorAll('.st') : [];
    var i;
    for (i = 0; i < steps.length && i < FLOW_STEPS.length; i += 1) {
      var el = steps[i];
      var href = FLOW_STEPS[i];
      var tag = el.tagName ? String(el.tagName).toLowerCase() : '';
      if (tag === 'a') {
        if (!el.getAttribute('href') && el.setAttribute) el.setAttribute('href', href);
      } else if (el.setAttribute) {
        el.setAttribute('role', 'link');
        el.setAttribute('tabindex', '0');
        el.setAttribute('data-flow-step', href);
      }
    }
    function hrefOf(step) {
      if (!step) return '';
      return step.getAttribute('href') || step.getAttribute('data-flow-step') || '';
    }
    function goStep(step) {
      var href = hrefOf(step);
      if (href && global.location) global.location.href = href;
    }
    if (typeof root.addEventListener !== 'function') return;
    root.addEventListener('click', function (event) {
      var target = event && event.target;
      var step = target && target.closest ? target.closest('.st') : target;
      if (!step || (root.contains && !root.contains(step))) return;
      var tag = step.tagName ? String(step.tagName).toLowerCase() : '';
      if (tag === 'a' && hrefOf(step)) return;
      if (event && event.preventDefault) event.preventDefault();
      goStep(step);
    });
    root.addEventListener('keydown', function (event) {
      if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
      var step = event.target && event.target.closest ? event.target.closest('.st') : event.target;
      if (!step || (root.contains && !root.contains(step))) return;
      if (event.preventDefault) event.preventDefault();
      goStep(step);
    });
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
    clearSignedIn: clearSignedIn,
    isSignedIn: isSignedIn,
    hasPlan: hasPlan,
    hasPaidAccess: hasPaidAccess,
    hasMembership: hasMembership,
    isOnHold: isOnHold,
    isWarning: isWarning,
    canGetPayout: canGetPayout,
    requireMembership: requireMembership,
    requirePaidAccess: requirePaidAccess,
    requirePublishingAccess: requirePublishingAccess,
    publishingHref: publishingHref,
    destinationForPublishing: destinationForPublishing,
    destinationForSignedInUpload: destinationForSignedInUpload,
    hasLiveSession: hasLiveSession,
    isConfirmedLoggedOut: isConfirmedLoggedOut,
    currentPlan: currentPlan,
    applyPlanCopy: applyPlanCopy,
    applyLoggedOutChrome: applyLoggedOutChrome,
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
  hydrateSignedInFromCookie();
  bindPlanClicks();
  bindAccountClicks();
  probeAccount();
  if (!goDashboardFromHome()) {
    accountReady.then(function (result) {
      if (result && result.ok) {
        goDashboardFromHome();
        goDashboardFromLogin();
      }
    });
  }
  if (!goSignedInBoosts()) {
    accountReady.then(function (result) {
      if (result && result.ok) goSignedInBoosts();
    });
  }

  if (scriptFlag('data-require-membership')) {
    if (typeof global.fetch === 'function') {
      accountReady.then(function () { requireMembership(); });
    } else {
      requireMembership();
    }
  }
  if (scriptFlag('data-require-paid')) {
    if (typeof global.fetch === 'function') {
      accountReady.then(function () { requirePaidAccess(); });
    } else {
      requirePaidAccess();
    }
  }
  if (scriptFlag('data-require-publishing')) {
    if (typeof global.fetch === 'function') {
      accountReady.then(function () { requirePublishingAccess(); });
    } else {
      requirePublishingAccess();
    }
  }
  revealPricingHint();
  whenDomReady(function () {
    applyPlanCopy();
    bindFlowStepper();
    accountReady.then(function () {
      applyPlanCopy();
      applyLoggedOutChrome();
    });
  });
})(window);
