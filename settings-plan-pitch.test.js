'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function run() {
  const settings = read('settings.html');
  assert.ok(settings.includes('data-account-plan-pitch'), 'Settings PLAN card is filled from the signed-in plan');
  assert.ok(/data-plan-renews hidden/.test(settings), 'Settings keeps a hidden Stripe renewal line on the current plan');
  assert.ok(!/data-plan-renews[^>]*>[^<]+</.test(settings), 'Settings must not hardcode a renewal date');
  assert.ok(settings.includes('data-manage-plan-toggle'), 'Settings must expose Manage plan');
  assert.ok(read('site.css').includes('.plan-switch[hidden]'), 'Manage plan panel stays hidden until the button opens it');
  assert.ok(read('site.css').includes('.plan-renews'), 'Settings renewal line uses the existing gold chrome');
  assert.ok(read('site.css').includes('[data-plan-renews][hidden]'), 'empty renewal line stays fully hidden');
  assert.ok(read('account.js').includes('scrollIntoView'), 'Manage plan scrolls to the plan options');
  assert.ok(read('account.js').includes('data-plan-option'), 'Manage plan focuses a plan option');
  assert.ok(!/location\.(href|replace).*create-checkout-session/.test(read('account.js')), 'Manage plan click must not open Checkout');
  assert.ok(settings.indexOf('data-checkout-switch') === -1, 'Settings picker must not charge on first tap');
  assert.ok(settings.includes('plan-confirm.html?plan=creator&amp;interval=year'), 'yearly redirects to the confirm page');
  assert.ok(settings.includes('plan-confirm.html?plan=creator&amp;interval=month'), 'monthly redirects to the confirm page');
  assert.ok(settings.includes('plan-confirm.html?plan=pro&amp;interval=month'), 'Pro monthly redirects to the confirm page');
  assert.ok(settings.includes('plan-confirm.html?plan=pro&amp;interval=year'), 'Pro yearly redirects to the confirm page');
  assert.ok(settings.includes('checkout.js'), 'Settings reuses checkout.js');

  const confirm = read('plan-confirm.html');
  assert.ok(confirm.includes('data-checkout-switch'), 'Submit on the confirm page starts the switch');
  assert.ok(confirm.includes('data-plan-confirm-submit'), 'confirm page has Submit');
  assert.ok(confirm.includes('data-checkout-status'), 'Stripe errors stay on the confirm page');
  assert.ok(!/data-require-membership|data-require-paid/i.test(confirm), 'confirm page must not dump to login');
  assert.ok(confirm.includes('checkout.js'), 'confirm page reuses checkout.js');
  assert.ok(settings.includes('Creator · $14.99/month'), 'locked Creator monthly');
  assert.ok(settings.includes('Creator · $12.42/month billed yearly'), 'locked Creator yearly as monthly');
  assert.ok(settings.includes('Pro · $19.99/month'), 'locked Pro monthly');
  assert.ok(settings.includes('Pro · $16.58/month billed yearly'), 'Pro yearly $199 displays as $16.58/month billed yearly');
  assert.ok(!/Pro \$149\/year/.test(settings), 'Settings must not say Pro $149/year');
  assert.ok(!/\$19\.99\/month or \$149\/year/.test(settings), 'Settings must not keep the yearly dollar on the plan pitch');
  assert.ok(!/\$19\.99\/month or \$199\/year/.test(settings), 'Settings must not keep the yearly dollar on the plan pitch');
  assert.ok(settings.indexOf('data-checkout-plan="basic"') === -1, 'Basic is not a paid switch target');
  assert.ok(settings.includes('difference now'), 'Settings says upgrades pay the difference now');
  assert.ok(settings.includes('new price next period'), 'Settings says the new price is next period');
  assert.ok(settings.includes('no refund'), 'Settings keeps downgrade no-refund copy');
  assert.ok(settings.includes('does not start a second plan'), 'Settings says the switch updates one subscription');
  assert.ok(settings.includes('offer-grid plan-picker'), 'Manage plan uses offer cards, not a raw stack of ghost links');
  assert.ok(settings.includes('btn btn-purple btn-md btn-block'), 'Manage plan monthly CTAs match Plans / Boosts');
  assert.ok(settings.includes('id="manage-billing"'), 'Settings exposes Manage billing');
  assert.ok(settings.includes('data-manage-billing'), 'Manage billing has an Update card control');
  assert.ok(settings.includes('data-change-password'), 'Settings Change password opens a signed-in form');
  assert.ok(settings.includes('data-delete-account'), 'Settings Delete account requires a confirm panel');
  assert.ok(settings.includes('Type DELETE to confirm.'), 'Delete account is not a one-click accident');
  assert.ok(settings.includes('Card numbers stay on Stripe'), 'Manage billing does not collect card numbers on this site');
  assert.ok(settings.includes('href="#manage-billing"'), 'failed-pay copy points at Manage billing');
  assert.ok(!/same as Pro|same product as Pro|same-as-Pro/i.test(settings), 'Creator copy must not say same-as-Pro');
  assert.ok(settings.includes('Same as Creator, unlimited'), 'Pro may say same as Creator, unlimited');
  assert.ok(read('dashboard.html').includes('settings.html#manage-billing'), 'dashboard failed-pay banner points at Manage billing');
  assert.ok(!read('dashboard.html').includes('data-plan-renews'), 'Overview must not show a plan renewal line');
  assert.ok(!read('dashboard.html').includes('Plan renews'), 'Overview must not keep a Plan renews row');
  assert.ok(!read('dashboard.html').includes('Split sheets signed'), 'Overview must not show Split sheets signed');

  const account = read('account.js');
  assert.ok(account.includes('stripOverviewLeftoverRows'), 'Overview leftover Split sheets signed / Plan renews rows are stripped');
  assert.ok(account.includes('current_period_end'), 'Settings paints renewal from the live Stripe current_period_end');
  assert.ok(account.includes('data-plan-renews'), 'Settings paints the renewal line in place');
  assert.ok(!/anniversary|created_at|signup_date/.test(account), 'Settings must not invent a billing anniversary');
  assert.ok(account.includes("action: 'portal'") || account.includes('action: "portal"'), 'Update card asks the existing checkout function for a portal');
  assert.ok(account.includes('There is no card on file.'), 'no Stripe customer shows a real no-card message');
  assert.ok(account.includes('billing.stripe.com'), 'portal redirect stays on Stripe Billing Portal');
  assert.ok(account.includes('dashboard.stripe.com'), 'portal redirect refuses the Stripe Dashboard');
  assert.ok(!/location\.(href|replace).*dashboard\.stripe\.com/.test(account), 'Update card must not open the Stripe Dashboard');
  assert.ok(account.includes('You pay the difference now'), 'confirm copy names the difference');
  assert.ok(account.includes('Next period you pay') || account.includes('new price next period'), 'confirm copy names the next-period price');
  assert.ok(account.includes('Due now:'), 'confirm title can show the Stripe due-now amount');
  assert.ok(account.includes('No refund for unused time'), 'downgrade copy stays no refund');
  assert.ok(account.includes('data.checkout && !data.existing'), 'Checkout copy is only for first-time unpaid');
  assert.ok(!/Due now: \$19\.99/.test(account), 'confirm must not hardcode a full Pro monthly due-now');
  assert.ok(!/Due now: \$199/.test(account), 'confirm must not hardcode a full Pro yearly due-now');

  const settingsPitch = read('settings.html');
  assert.ok(!/\$19\.99\/month or \$149\/year/.test(settingsPitch), 'settings.html still has the old month-or-year pitch');
  assert.ok(settingsPitch.includes('$16.58/month billed yearly'), 'settings.html is missing the yearly-as-monthly pitch');
  assert.ok(read('dashboard.html').includes('$16.58/month billed yearly'), 'dashboard keeps Pro yearly-as-monthly on the Pro-only line');

  ['releases.html', 'splits.html', 'splits-empty.html', 'library.html', 'boosts.html', 'chart-push.html', 'streaming-push.html', 'social-push.html', 'video-collect.html'].forEach(function (file) {
    const html = read(file);
    assert.ok(!/>On Pro</.test(html), file + ' must not default to leftover On Pro');
    assert.ok(html.includes('data-account-plan-title'), file + ' plan title comes from /api/me');
    assert.ok(html.includes('data-account-plan-price'), file + ' Creator price comes from /api/me');
    assert.ok(html.includes('data-account-plan-year'), file + ' yearly price stays on its own line');
    assert.ok(!html.includes('$16.58/month billed yearly'), file + ' must not use Pro yearly-as-monthly as the live Creator price');
    assert.ok(!html.includes('Hi Victoria!'), file + ' must not hardcode Hi Victoria');
    assert.ok(html.includes('data-account-who>Hi there'), file + ' unsigned greeting stays Hi there');
  });

  const toggle = {
    attrs: { 'data-manage-plan-toggle': '' },
    focused: false,
    listeners: {},
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  };
  const firstOption = {
    focused: false,
    getAttribute(name) { return name === 'data-plan-option' ? 'pro:month' : null; },
    focus() { this.focused = true; },
  };
  const panel = {
    hidden: true,
    attrs: { hidden: '' },
    scrolled: false,
    querySelector(sel) { return sel.indexOf('data-plan-option') !== -1 ? firstOption : null; },
    scrollIntoView() { this.scrolled = true; },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    removeAttribute(name) { delete this.attrs[name]; },
  };
  const accountContext = {
    document: {
      readyState: 'complete',
      querySelector(sel) {
        if (sel === '[data-manage-plan-toggle]') return toggle;
        if (sel === '[data-manage-plan]') return panel;
        if (sel === '[data-plan-confirm]') return null;
        if (sel === '[data-manage-billing]') return null;
        if (sel === '.sign-out') return null;
        return null;
      },
      querySelectorAll() { return []; },
      addEventListener() {},
    },
    location: { href: 'settings.html', pathname: '/settings.html', search: '' },
    fetch() { return Promise.reject(new Error('no checkout on manage plan')); },
    window: {},
  };
  accountContext.window = accountContext;
  vm.runInNewContext(read('account.js'), accountContext);
  assert.ok(typeof toggle.listeners.click === 'function', 'Manage plan must bind a click handler');
  toggle.listeners.click({ preventDefault() {} });
  assert.strictEqual(panel.hidden, false, 'Manage plan reveals the four plan options');
  assert.ok(!Object.prototype.hasOwnProperty.call(panel.attrs, 'hidden'), 'Manage plan clears the hidden attribute');
  assert.strictEqual(toggle.getAttribute('aria-expanded'), 'true');
  assert.strictEqual(panel.scrolled, true, 'Manage plan scrolls to the plan options');
  assert.strictEqual(firstOption.focused, true, 'Manage plan focuses a plan option');
  assert.ok(settings.includes('href="plan-confirm.html?plan=pro&amp;interval=month"'), 'plan options still go to plan-confirm');

  const billingButton = {
    attrs: {},
    textContent: 'Update card',
    disabled: false,
    listeners: {},
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  };
  const billingStatus = { textContent: '', hidden: true };
  const billingFetches = [];
  const billingContext = {
    document: {
      readyState: 'complete',
      getElementById() { return null; },
      querySelector(sel) {
        if (sel === '[data-manage-billing]') return billingButton;
        if (sel === '[data-manage-plan-toggle]') return null;
        if (sel === '[data-manage-plan]') return null;
        if (sel === '[data-plan-confirm]') return null;
        if (sel === '.sign-out') return null;
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '[data-manage-billing-status]') return [billingStatus];
        return [];
      },
      addEventListener() {},
    },
    location: { href: 'settings.html#manage-billing', pathname: '/settings.html', search: '', hash: '#manage-billing' },
    fetch(url, opts) {
      billingFetches.push({ url: String(url), opts: opts || {} });
      const body = JSON.parse((opts && opts.body) || '{}');
      if (body.action === 'billing') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json() { return Promise.resolve({ plan: 'pro', interval: '', no_card: true, has_card: false }); },
        });
      }
      if (body.action === 'portal') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json() { return Promise.resolve({ no_card: true, error: 'There is no card on file.' }); },
        });
      }
      return Promise.reject(new Error('unexpected ' + body.action));
    },
    window: {},
  };
  billingContext.window = billingContext;
  vm.runInNewContext(read('account.js'), billingContext);
  assert.ok(typeof billingButton.listeners.click === 'function', 'Update card must bind a click handler');
  billingButton.listeners.click({ preventDefault() {} });

  const index = read('index.html');
  assert.ok(index.includes('or $149/year'), 'public Creator yearly stays $149');
  assert.ok(index.includes('or $199/year'), 'public Pro yearly displays $199');
  assert.ok(index.includes('$14.99'), 'public Creator monthly price stays');
  assert.ok(index.includes('$19.99'), 'public Pro monthly price stays');
  assert.ok(/data-checkout-plan="pro"\s+data-checkout-interval="year"/.test(index), 'Pro yearly checkout is live at $199');

  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      try {
        assert.ok(billingFetches.some(function (item) {
          return /create-checkout-session/.test(item.url) && JSON.parse(item.opts.body || '{}').action === 'portal';
        }), 'Update card asks action=portal');
        assert.ok(!billingFetches.some(function (item) {
          const body = JSON.parse(item.opts.body || '{}');
          return body.action === 'switch' || body.plan;
        }), 'Update card must not start Checkout or switch the plan');
        assert.strictEqual(billingStatus.textContent, 'There is no card on file.');
        assert.strictEqual(billingStatus.hidden, false);
        assert.ok(String(billingContext.location.href).indexOf('billing.stripe.com') === -1, 'no-card must not open a portal');

        const renews = {
          textContent: '',
          hidden: true,
          attrs: { hidden: '' },
          getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
          setAttribute(name, value) { this.attrs[name] = String(value); },
          removeAttribute(name) { delete this.attrs[name]; },
        };
        const missingRenews = {
          textContent: 'leftover',
          hidden: false,
          attrs: {},
          getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
          setAttribute(name, value) { this.attrs[name] = String(value); },
          removeAttribute(name) { delete this.attrs[name]; },
        };
        const basicRenews = {
          textContent: 'leftover',
          hidden: false,
          attrs: {},
          getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
          setAttribute(name, value) { this.attrs[name] = String(value); },
          removeAttribute(name) { delete this.attrs[name]; },
        };
        function paintContext(node, billing) {
          const billingGate = {
            attrs: {},
            getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
            setAttribute(name, value) { this.attrs[name] = String(value); },
            addEventListener() {},
          };
          const context = {
            document: {
              readyState: 'complete',
              getElementById() { return null; },
              querySelector(sel) {
                if (sel === '[data-manage-plan], [data-manage-billing]') return billingGate;
                if (sel === '[data-manage-billing]') return billingGate;
                if (sel === '[data-manage-plan-toggle]') return null;
                if (sel === '[data-manage-plan]') return null;
                if (sel === '[data-plan-confirm]') return null;
                if (sel === '.sign-out') return null;
                return null;
              },
              querySelectorAll(sel) {
                if (sel === '[data-plan-renews]') return [node];
                if (sel === '[data-manage-billing-status]') return [];
                if (sel === '[data-account-plan-pitch]') return [];
                if (sel === '[data-plan-option]') return [];
                return [];
              },
              addEventListener() {},
            },
            location: { href: 'settings.html', pathname: '/settings.html', search: '', hash: '' },
            fetch() {
              return Promise.resolve({
                ok: true,
                status: 200,
                json() { return Promise.resolve(billing); },
              });
            },
            window: {},
          };
          context.window = context;
          vm.runInNewContext(read('account.js'), context);
          return context;
        }
        paintContext(renews, { plan: 'creator', interval: 'month', current_period_end: 1789257600, has_card: true });
        paintContext(missingRenews, { plan: 'pro', interval: 'year', has_card: true });
        paintContext(basicRenews, { plan: 'basic', no_card: true, has_card: false });

        setTimeout(function () {
          try {
            assert.strictEqual(renews.hidden, false, 'paid Settings shows the Stripe renewal date');
            assert.ok(!Object.prototype.hasOwnProperty.call(renews.attrs, 'hidden'), 'paid renewal clears hidden');
            assert.ok(/^Renews /.test(renews.textContent), 'paid renewal names the date');
            assert.ok(renews.textContent.indexOf('2026') !== -1, 'paid renewal uses the Stripe unix year');
            assert.strictEqual(missingRenews.hidden, true, 'missing current_period_end omits the line');
            assert.strictEqual(missingRenews.textContent, '', 'missing current_period_end does not guess a date');
            assert.strictEqual(basicRenews.hidden, true, 'Basic Settings hides the renewal line');
            assert.strictEqual(basicRenews.textContent, '', 'Basic Settings does not show a renewal date');
            assert.ok(!read('split-sheet.html').includes('data-plan-renews'), 'SignWell page stays off this Settings line');
            assert.ok(read('split-sheet.html').includes("showStatus('ok', 'Split sheet signed.')"), 'SignWell multi-writer signed status stays');
            console.log('settings-plan-pitch.test.js ok');
            resolve();
          } catch (err) {
            reject(err);
          }
        }, 0);
      } catch (err) {
        reject(err);
      }
    }, 0);
  });
}

Promise.resolve(run()).catch(function (err) {
  console.error(err);
  process.exit(1);
});
