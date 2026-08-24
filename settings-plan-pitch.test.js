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
  assert.ok(settings.includes('data-manage-plan-toggle'), 'Settings must expose Manage plan');
  assert.ok(read('site.css').includes('.plan-switch[hidden]'), 'Manage plan panel stays hidden until the button opens it');
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

  const account = read('account.js');
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

  ['releases.html', 'splits.html', 'splits-empty.html', 'library.html', 'boosts.html'].forEach(function (file) {
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

  const index = read('index.html');
  assert.ok(index.includes('or $149/year'), 'public Creator yearly stays $149');
  assert.ok(index.includes('or $199/year'), 'public Pro yearly displays $199');
  assert.ok(index.includes('$14.99'), 'public Creator monthly price stays');
  assert.ok(index.includes('$19.99'), 'public Pro monthly price stays');
  assert.ok(/data-checkout-plan="pro"\s+data-checkout-interval="year"/.test(index), 'Pro yearly checkout is live at $199');

  console.log('settings-plan-pitch.test.js ok');
}

run();
