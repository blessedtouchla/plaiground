'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'membership.js'), 'utf8');

function makeStorage() {
  const data = Object.create(null);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    data,
  };
}

function load(options) {
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  if (options && options.seedLocal) {
    Object.keys(options.seedLocal).forEach(function (key) {
      localStorage.setItem(key, options.seedLocal[key]);
    });
  }
  if (options && options.seedSession) {
    Object.keys(options.seedSession).forEach(function (key) {
      sessionStorage.setItem(key, options.seedSession[key]);
    });
  }
  const search = options && options.search ? options.search : '';
  const location = { href: 'upload.html', search: search, replace(href) { location.href = href; } };
  const clicks = [];
  const context = {
    URLSearchParams,
    localStorage: localStorage,
    sessionStorage: sessionStorage,
    document: {
      currentScript: {
        getAttribute(name) {
          if (name === 'data-require-membership') return options && options.require ? 'true' : null;
          return null;
        },
      },
      querySelector() {
        return null;
      },
      addEventListener(type, handler) {
        if (type === 'click') clicks.push(handler);
      },
    },
    location,
  };
  context.window = context;
  vm.runInNewContext(code, context);
  return { api: context.PlaigroundMembership, localStorage, sessionStorage, location, clicks };
}

function run() {
  const fresh = load();
  assert.strictEqual(fresh.api.hasMembership(), false);
  assert.strictEqual(fresh.api.isSignedIn(), false);
  assert.strictEqual(fresh.api.hasPlan(), false);

  const pending = load();
  assert.strictEqual(pending.api.rememberPending('Creator'), 'creator');
  assert.strictEqual(pending.localStorage.getItem('plaigroundMembershipPending'), 'creator');
  assert.strictEqual(pending.localStorage.getItem('plaigroundMembership'), 'creator');
  assert.strictEqual(pending.sessionStorage.getItem('plaigroundMembership'), 'creator');
  pending.api.recordSignedIn();
  assert.strictEqual(pending.api.hasPlan(), false, 'pending creator without Stripe session is not paid');
  assert.strictEqual(pending.api.hasMembership(), false);

  const paid = load();
  paid.api.rememberPending('pro');
  assert.strictEqual(paid.api.recordPaidMembership('', 'cs_test_123'), 'pro');
  assert.strictEqual(paid.localStorage.getItem('plaigroundMembership'), 'pro');
  assert.strictEqual(paid.localStorage.getItem('plaigroundStripeSession'), 'cs_test_123');
  assert.strictEqual(paid.localStorage.getItem('plaigroundMembershipPending'), null);
  paid.api.recordSignedIn();
  assert.strictEqual(paid.api.hasPlan(), true);
  assert.strictEqual(paid.api.hasMembership(), true);

  const basicClick = load();
  assert.strictEqual(basicClick.api.recordPlan('Basic'), 'basic');
  assert.strictEqual(basicClick.localStorage.getItem('plaigroundMembership'), 'basic');
  assert.strictEqual(basicClick.api.hasPlan(), true, 'basic does not need Stripe');
  assert.strictEqual(basicClick.api.hasMembership(), false, 'plan alone is not enough');
  basicClick.api.recordSignedIn();
  assert.strictEqual(basicClick.localStorage.getItem('plaigroundSignedIn'), '1');
  assert.strictEqual(basicClick.api.hasMembership(), true);

  const invented = load();
  invented.api.recordPaidMembership('enterprise', '');
  invented.api.recordPlan('gold');
  assert.strictEqual(invented.localStorage.getItem('plaigroundMembership'), null);
  assert.strictEqual(invented.api.hasPlan(), false);
  assert.strictEqual(invented.api.hasMembership(), false);

  const sessionOnly = load();
  sessionOnly.api.recordPaidMembership('not-a-plan', 'cs_live_paid');
  sessionOnly.api.recordSignedIn();
  assert.strictEqual(sessionOnly.localStorage.getItem('plaigroundMembership'), null);
  assert.strictEqual(sessionOnly.api.hasPlan(), false, 'session id is extra proof, not a plan');
  assert.strictEqual(sessionOnly.api.hasMembership(), false);

  const loggedOut = load({ require: true });
  assert.ok(loggedOut.location.href.indexOf('login.html') !== -1);

  const noPlan = load({
    require: true,
    seedLocal: { plaigroundSignedIn: '1' },
  });
  assert.ok(noPlan.location.href.indexOf('index.html?needplan=1#pricing') !== -1);

  const gatedOk = load({
    require: true,
    seedLocal: { plaigroundSignedIn: '1', plaigroundMembership: 'basic' },
  });
  assert.strictEqual(gatedOk.location.href, 'upload.html');
  assert.strictEqual(gatedOk.api.requireMembership(), true);

  const paidOk = load({
    require: true,
    seedLocal: {
      plaigroundSignedIn: '1',
      plaigroundMembership: 'creator',
      plaigroundStripeSession: 'cs_test_ok',
    },
  });
  assert.strictEqual(paidOk.location.href, 'upload.html');

  const migrated = load({
    seedSession: { plaigroundSignedIn: '1', plaigroundMembership: 'basic' },
  });
  assert.strictEqual(migrated.localStorage.getItem('plaigroundMembership'), 'basic');
  assert.strictEqual(migrated.api.hasMembership(), true);

  const fromQuery = load({ search: '?plan=basic' });
  assert.strictEqual(fromQuery.localStorage.getItem('plaigroundMembership'), 'basic');
  assert.strictEqual(fromQuery.api.hasPlan(), true);

  const randomVisit = load({ search: '' });
  assert.strictEqual(randomVisit.localStorage.getItem('plaigroundMembership'), null);
  assert.strictEqual(randomVisit.api.hasPlan(), false);

  console.log('membership.test.js ok');
}

run();
