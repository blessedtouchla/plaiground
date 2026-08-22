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
  const storage = makeStorage();
  if (options && options.seed) {
    Object.keys(options.seed).forEach(function (key) {
      storage.setItem(key, options.seed[key]);
    });
  }
  const location = { href: 'upload.html', search: '', replace(href) { location.href = href; } };
  const context = {
    sessionStorage: storage,
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
    },
    location,
  };
  context.window = context;
  vm.runInNewContext(code, context);
  return { api: context.PlaigroundMembership, storage, location };
}

function run() {
  const paid = load();
  assert.strictEqual(paid.api.hasMembership(), false);
  assert.strictEqual(paid.api.rememberPending('Creator'), 'creator');
  assert.strictEqual(paid.storage.getItem('plaigroundMembershipPending'), 'creator');
  assert.strictEqual(paid.api.hasMembership(), false, 'pending checkout is not a membership');
  assert.strictEqual(paid.api.recordPaidMembership('', 'cs_test_123'), 'creator');
  assert.strictEqual(paid.storage.getItem('plaigroundMembership'), 'creator');
  assert.strictEqual(paid.storage.getItem('plaigroundStripeSession'), 'cs_test_123');
  assert.strictEqual(paid.storage.getItem('plaigroundMembershipPending'), null);
  assert.strictEqual(paid.api.hasMembership(), true);

  const invented = load();
  invented.api.recordPaidMembership('basic', '');
  assert.strictEqual(invented.storage.getItem('plaigroundMembership'), null);
  assert.strictEqual(invented.api.hasMembership(), false);

  const sessionOnly = load();
  sessionOnly.api.recordPaidMembership('not-a-plan', 'cs_live_paid');
  assert.strictEqual(sessionOnly.storage.getItem('plaigroundMembership'), null);
  assert.strictEqual(sessionOnly.api.hasMembership(), true, 'paid session id lets them through');

  const gated = load({ require: true });
  assert.ok(gated.location.href.indexOf('index.html?needplan=1#pricing') !== -1);

  const gatedOk = load({ require: true, seed: { plaigroundMembership: 'pro' } });
  assert.strictEqual(gatedOk.location.href, 'upload.html');
  assert.strictEqual(gatedOk.api.requireMembership(), true);

  console.log('membership.test.js ok');
}

run();
