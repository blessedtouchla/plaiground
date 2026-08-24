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
  const pathname = options && options.pathname ? options.pathname : '/upload.html';
  const href = options && options.href ? options.href : 'upload.html';
  const location = { href: href, pathname: pathname, search: search, replace(next) { location.href = next; } };
  const clicks = [];
  let cookie = options && options.cookie ? String(options.cookie) : '';
  const fetches = [];
  let fetchImpl;
  if (options && typeof options.fetch === 'function') {
    fetchImpl = function () {
      fetches.push('/api/me');
      return options.fetch.apply(this, arguments);
    };
  } else if (options && Array.isArray(options.accountResponses)) {
    const queue = options.accountResponses.slice();
    fetchImpl = function () {
      fetches.push('/api/me');
      const next = queue.length ? queue.shift() : { ok: false, status: 401, data: {} };
      const status = next.status == null ? 200 : next.status;
      const data = next.data || next.account || {};
      const ok = next.ok == null ? status === 200 : Boolean(next.ok);
      return Promise.resolve({
        ok: ok,
        status: status,
        json: function () { return Promise.resolve(data); },
      });
    };
  } else if (options && options.account) {
    fetchImpl = function () {
      fetches.push('/api/me');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () { return Promise.resolve(options.account); },
      });
    };
  }
  const context = {
    URLSearchParams,
    localStorage: localStorage,
    sessionStorage: sessionStorage,
    fetch: fetchImpl,
    document: {
      get cookie() {
        return cookie;
      },
      set cookie(value) {
        cookie = String(value);
      },
      currentScript: {
        getAttribute(name) {
          if (name === 'data-require-membership') return options && options.require ? 'true' : null;
          if (name === 'data-require-paid') return options && options.requirePaid ? 'true' : null;
          if (name === 'data-require-publishing') return options && options.requirePublishing ? 'true' : null;
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
  return { api: context.PlaigroundMembership, localStorage, sessionStorage, location, clicks, fetches };
}

function clickEvent(sel, href) {
  return {
    preventDefault() { this.prevented = true; },
    target: {
      closest(name) {
        if (name === sel) return { getAttribute() { return href; } };
        return null;
      },
    },
  };
}

function fireClicks(loaded, event) {
  loaded.clicks.forEach(function (handler) { handler(event); });
}

function staffAccount() {
  return {
    email: 'emailplaiground@gmail.com',
    artist: 'Staff Pro',
    plan: 'pro',
    status: 'active',
  };
}

function runLoginWall() {
  const unpaidPro = load({
    require: true,
    pathname: '/upload.html',
    href: 'upload.html',
    account: staffAccount(),
  });
  return unpaidPro.api.whenReady().then(function () {
    assert.strictEqual(unpaidPro.api.currentPlan(), 'pro');
    assert.strictEqual(unpaidPro.api.hasPlan(), true, 'unpaid Pro from /api/me does not need stripe_session_id');
    assert.strictEqual(unpaidPro.api.hasPaidAccess(), true);
    assert.strictEqual(unpaidPro.api.requireMembership(), true);
    assert.strictEqual(unpaidPro.location.href, 'upload.html', 'signed-in unpaid Pro stays on a gated page');
    assert.ok(unpaidPro.location.href.indexOf('login.html') === -1);

    const retryThenPro = load({
      require: true,
      pathname: '/earnings.html',
      href: 'earnings.html',
      cookie: 'plaiground_session=alive',
      accountResponses: [
        { ok: false, status: 401, data: { error: 'Sign in required.' } },
        { ok: true, status: 200, data: staffAccount() },
      ],
    });
    return retryThenPro.api.whenReady().then(function () {
      assert.ok(retryThenPro.fetches.length >= 2, '401 /api/me retries once');
      assert.strictEqual(retryThenPro.api.hasPlan(), true);
      assert.strictEqual(retryThenPro.api.requireMembership(), true);
      assert.strictEqual(retryThenPro.location.href, 'earnings.html', 'retry 200 unpaid Pro must not replace location with login.html');
      assert.ok(retryThenPro.location.href.indexOf('login.html') === -1);

      const cookieStay = load({
        require: true,
        pathname: '/boosts.html',
        href: 'boosts.html',
        cookie: 'plaiground_session=alive',
        accountResponses: [
          { ok: false, status: 401, data: { error: 'Sign in required.' } },
          { ok: false, status: 503, data: { error: 'Accounts are not configured.' } },
        ],
      });
      return cookieStay.api.whenReady().then(function () {
        assert.strictEqual(cookieStay.api.requireMembership(), true);
        assert.strictEqual(cookieStay.location.href, 'boosts.html', 'session cookie present: stay even if /api/me stays 401/503');
        assert.ok(cookieStay.location.href.indexOf('login.html') === -1);

        const publishingStay = load({
          requirePublishing: true,
          pathname: '/publishing-register.html',
          href: 'publishing-register.html',
          cookie: 'plaiground_signed=1',
          accountResponses: [
            { ok: false, status: 0, data: {} },
            { ok: true, status: 200, data: staffAccount() },
          ],
        });
        return publishingStay.api.whenReady().then(function () {
          assert.strictEqual(publishingStay.api.requirePublishingAccess(), true);
          assert.strictEqual(publishingStay.location.href, 'publishing-register.html');
          assert.ok(publishingStay.location.href.indexOf('login.html') === -1);

          let releaseDeferred;
          const clickBefore = load({
            pathname: '/dashboard.html',
            href: 'dashboard.html',
            cookie: 'plaiground_session=alive',
            fetch: function () {
              return new Promise(function (resolve) {
                releaseDeferred = function () {
                  resolve({
                    ok: true,
                    status: 200,
                    json: function () { return Promise.resolve(staffAccount()); },
                  });
                };
              });
            },
          });
          const uploadEvent = clickEvent('[data-signed-in-upload]', 'upload.html');
          fireClicks(clickBefore, uploadEvent);
          assert.ok(uploadEvent.prevented, 'upload click waits for /api/me');
          assert.ok(
            clickBefore.api.destinationForSignedInUpload('upload.html').indexOf('login.html') === -1,
            'click-before-probe must not send them to login'
          );
          assert.strictEqual(clickBefore.location.href, 'dashboard.html', 'must not rewrite to login.html before accountReady');
          releaseDeferred();
          return clickBefore.api.whenReady().then(function () {
            return Promise.resolve().then(function () {
              assert.strictEqual(clickBefore.location.href, 'upload.html');
              assert.ok(clickBefore.location.href.indexOf('login.html') === -1);
              assert.strictEqual(clickBefore.api.hasPaidAccess(), true, 'staff Pro unlocks after probe without Stripe');

              const loggedOut401 = load({
                require: true,
                pathname: '/payouts.html',
                href: 'payouts.html',
                accountResponses: [
                  { ok: false, status: 401, data: { error: 'Sign in required.' } },
                  { ok: false, status: 401, data: { error: 'Sign in required.' } },
                ],
              });
              return loggedOut401.api.whenReady().then(function () {
                assert.ok(loggedOut401.location.href.indexOf('login.html') !== -1, 'true logged-out 401 still goes to login');
                console.log('membership.test.js ok');
              });
            });
          });
        });
      });
    });
  });
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
  assert.ok(Number(basicClick.localStorage.getItem('plaigroundSignedInAt')) > 0);
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

  const analyticsStay = load({
    require: true,
    pathname: '/analytics.html',
    href: 'analytics.html',
    seedLocal: { plaigroundSignedIn: '1', plaigroundMembership: 'basic' },
  });
  assert.strictEqual(analyticsStay.location.href, 'analytics.html', 'signed-in Basic stays on analytics');
  assert.strictEqual(analyticsStay.api.requireMembership(), true);
  assert.strictEqual(analyticsStay.api.requirePaidAccess(), false);
  assert.ok(analyticsStay.location.href.indexOf('needplan=1') !== -1, 'paid gate would still bounce Basic');

  const earningsStay = load({
    require: true,
    pathname: '/earnings.html',
    href: 'earnings.html',
    seedLocal: { plaigroundSignedIn: '1', plaigroundMembership: 'basic' },
  });
  assert.strictEqual(earningsStay.location.href, 'earnings.html', 'signed-in Basic stays on earnings');
  assert.strictEqual(earningsStay.api.requireMembership(), true);
  assert.strictEqual(earningsStay.api.requirePaidAccess(), false);

  const payoutsStay = load({
    require: true,
    pathname: '/payouts.html',
    href: 'payouts.html',
    seedLocal: { plaigroundSignedIn: '1', plaigroundMembership: 'basic' },
  });
  assert.strictEqual(payoutsStay.location.href, 'payouts.html', 'signed-in Basic stays on payouts');
  assert.strictEqual(payoutsStay.api.requireMembership(), true);

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

  const servered = load();
  servered.api.recordSignedIn();
  assert.ok(typeof servered.api.whenReady === 'function');

  const homeIn = load({
    pathname: '/index.html',
    href: 'index.html',
    seedLocal: { plaigroundSignedIn: '1' },
  });
  assert.ok(homeIn.location.href.indexOf('dashboard.html') !== -1);

  const homeRoot = load({
    pathname: '/',
    href: '/',
    seedLocal: { plaigroundSignedIn: '1' },
  });
  assert.ok(homeRoot.location.href.indexOf('dashboard.html') !== -1);

  const homeOut = load({ pathname: '/', href: '/' });
  assert.ok(homeOut.location.href.indexOf('dashboard.html') === -1);

  const boostTeaseIn = load({
    pathname: '/boost.html',
    href: 'boost.html',
    seedLocal: { plaigroundSignedIn: '1', plaigroundMembership: 'creator' },
  });
  assert.ok(boostTeaseIn.location.href.indexOf('boosts.html') !== -1, 'signed-in boost.html goes to signed-in boosts');
  assert.ok(boostTeaseIn.location.href.indexOf('login.html') === -1, 'signed-in boost.html must not dump to login');

  const boostTeaseOut = load({
    pathname: '/boost.html',
    href: 'boost.html',
  });
  assert.strictEqual(boostTeaseOut.location.href, 'boost.html', 'logged-out visitors keep the public Boost tease');

  const homeNeedPlan = load({
    pathname: '/index.html',
    href: 'index.html?needplan=1#pricing',
    search: '?needplan=1',
    seedLocal: { plaigroundSignedIn: '1' },
  });
  assert.ok(homeNeedPlan.location.href.indexOf('dashboard.html') === -1);

  const signupStay = load({
    pathname: '/signup.html',
    href: 'signup.html',
    seedLocal: { plaigroundSignedIn: '1' },
  });
  assert.ok(signupStay.location.href.indexOf('dashboard.html') === -1);

  const held = load({
    account: {
      email: 'ada@example.com',
      artist: 'Ada',
      plan: 'pro',
      status: 'hold',
      stripe_session_id: 'cs_hold',
    },
  });
  return held.api.whenReady().then(function () {
    assert.strictEqual(held.api.isSignedIn(), true);
    assert.strictEqual(held.api.isOnHold(), true);
    assert.strictEqual(held.api.hasMembership(), true, 'hold stays signed in');
    assert.strictEqual(held.api.hasPaidAccess(), false, 'hold locks paid features');
    assert.strictEqual(held.api.requirePaidAccess(), false);
    assert.ok(held.location.href.indexOf('hold=1') !== -1);
    assert.strictEqual(held.api.canGetPayout(), false);

    const warned = load({
      account: {
        email: 'ada@example.com',
        artist: 'Ada',
        plan: 'creator',
        status: 'warning',
        stripe_session_id: 'cs_warn',
      },
    });
    return warned.api.whenReady().then(function () {
      assert.strictEqual(warned.api.isSignedIn(), true);
      assert.strictEqual(warned.api.isWarning(), true);
      assert.strictEqual(warned.api.isOnHold(), false);
      assert.strictEqual(warned.api.hasPaidAccess(), true, 'warning keeps paid features');
      assert.strictEqual(warned.api.canGetPayout(), false, 'warning blocks payouts');
      assert.strictEqual(warned.api.requirePaidAccess(), true);

      const creatorPublishing = load({
        requirePublishing: true,
        pathname: '/publishing-register.html',
        href: 'publishing-register.html',
        account: {
          email: 'ada@example.com',
          artist: 'Ada',
          plan: 'creator',
          status: 'active',
          stripe_session_id: 'cs_creator',
        },
      });
      return creatorPublishing.api.whenReady().then(function () {
        assert.strictEqual(creatorPublishing.api.hasPaidAccess(), true);
        assert.strictEqual(creatorPublishing.api.publishingHref(), 'publishing-register.html');
        assert.strictEqual(creatorPublishing.api.requirePublishingAccess(), true);
        assert.strictEqual(creatorPublishing.location.href, 'publishing-register.html');

        const explainer = load({
          requirePublishing: true,
          pathname: '/publishing.html',
          href: 'publishing.html',
          account: {
            email: 'ada@example.com',
            artist: 'Ada',
            plan: 'pro',
            status: 'active',
            stripe_session_id: 'cs_pro',
          },
        });
        return explainer.api.whenReady().then(function () {
          assert.strictEqual(explainer.api.requirePublishingAccess(), false);
          assert.ok(explainer.location.href.indexOf('publishing-register.html') !== -1);

          const basicPublishing = load({
            requirePublishing: true,
            pathname: '/publishing-register.html',
            href: 'publishing-register.html',
            account: {
              email: 'ada@example.com',
              artist: 'Ada',
              plan: 'basic',
              status: 'active',
            },
          });
          return basicPublishing.api.whenReady().then(function () {
            assert.strictEqual(basicPublishing.api.hasPaidAccess(), false);
            assert.strictEqual(basicPublishing.api.requirePublishingAccess(), false);
            assert.ok(basicPublishing.location.href.indexOf('index.html?needplan=1#pricing') !== -1);
            assert.ok(basicPublishing.location.href.indexOf('pro.html') === -1);

            function clickEvent(sel, href) {
              return {
                preventDefault() { this.prevented = true; },
                target: {
                  closest(name) {
                    if (name === sel) return { getAttribute() { return href; } };
                    return null;
                  },
                },
              };
            }

            function fireClicks(loaded, event) {
              loaded.clicks.forEach(function (handler) { handler(event); });
            }

            const publishingClick = load({
              pathname: '/dashboard.html',
              href: 'dashboard.html',
              account: {
                email: 'ada@example.com',
                artist: 'Ada',
                plan: 'creator',
                status: 'active',
                stripe_session_id: 'cs_creator',
              },
            });
            const publishingEvent = clickEvent('[data-publishing-register]', 'publishing-register.html');
            fireClicks(publishingClick, publishingEvent);
            assert.ok(publishingEvent.prevented, 'publishing click waits for /api/me');
            assert.strictEqual(publishingClick.location.href, 'dashboard.html', 'must not dump to login before the session probe');
            return publishingClick.api.whenReady().then(function () {
              return Promise.resolve().then(function () {
                assert.strictEqual(publishingClick.location.href, 'publishing-register.html');
                assert.ok(publishingClick.location.href.indexOf('login.html') === -1);

                const uploadClick = load({
                  pathname: '/how.html',
                  href: 'how.html',
                  account: {
                    email: 'ada@example.com',
                    artist: 'Ada',
                    plan: 'creator',
                    status: 'active',
                    stripe_session_id: 'cs_creator',
                  },
                });
                const uploadEvent = clickEvent('[data-signed-in-upload]', 'upload.html');
                fireClicks(uploadClick, uploadEvent);
                return uploadClick.api.whenReady().then(function () {
                  return Promise.resolve().then(function () {
                    assert.strictEqual(uploadClick.location.href, 'upload.html', 'signed-in Start a submission opens upload');
                    assert.ok(uploadClick.location.href.indexOf('login.html') === -1);

                    const staffPro = load({
                      requirePaid: true,
                      pathname: '/publishing-register.html',
                      href: 'publishing-register.html',
                      account: {
                        email: 'emailplaiground@gmail.com',
                        artist: 'Staff Pro',
                        plan: 'pro',
                        status: 'active',
                      },
                    });
                    return staffPro.api.whenReady().then(function () {
                      assert.strictEqual(staffPro.api.currentPlan(), 'pro');
                      assert.strictEqual(staffPro.api.hasPlan(), true, 'server Pro does not need a Stripe session');
                      assert.strictEqual(staffPro.api.hasPaidAccess(), true, 'staff Pro unlocks publishing, boosts, payouts');
                      assert.strictEqual(staffPro.api.requirePaidAccess(), true);
                      assert.strictEqual(staffPro.api.requirePublishingAccess(), true);
                      assert.strictEqual(staffPro.api.canGetPayout(), true);
                      assert.strictEqual(staffPro.location.href, 'publishing-register.html');
                      return runLoginWall();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

Promise.resolve(run()).catch((err) => {
  console.error(err);
  process.exit(1);
});
