'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function run() {
  const index = read('index.html');
  assert.ok(index.indexOf('href="signup.html?plan=basic"') !== -1);
  assert.ok(index.indexOf('data-plan="basic"') !== -1);
  assert.ok(index.indexOf('Join for free') !== -1);
  assert.ok(index.indexOf('8 uploads + 8 publishing a month') !== -1);
  assert.ok(index.indexOf('One release for the life of the account') !== -1);
  assert.ok(index.indexOf('<strong>$0</strong>') !== -1);
  assert.ok(index.indexOf('<strong>$14.99</strong>') !== -1);
  assert.ok(index.indexOf('<strong>$19.99</strong>') !== -1);
  assert.ok(index.indexOf('or $149/year') !== -1);
  assert.ok(index.indexOf('data-checkout-interval="month"') !== -1);
  assert.ok(index.indexOf('you stay signed in on hold') !== -1);
  assert.ok(index.indexOf('Unlimited releases') === -1);

  const how = read('how-it-works.html');
  assert.ok(how.indexOf('href="signup.html?plan=basic"') !== -1);
  assert.ok(how.indexOf('8 uploads + 8 publishing a month') !== -1);
  assert.ok(how.indexOf('Unlimited releases') === -1);
  assert.ok(how.indexOf('you stay signed in on hold') !== -1);

  const creator = read('creator.html');
  assert.ok(creator.indexOf('$14.99 a month') !== -1);
  assert.ok(creator.indexOf('or $149/year') !== -1);
  assert.ok(creator.indexOf('data-checkout-interval="month"') !== -1);
  assert.ok(creator.indexOf('8 uploads + 8 publishing a month') !== -1);
  assert.ok(creator.indexOf('you stay signed in on hold') !== -1);

  const pro = read('pro.html');
  assert.ok(pro.indexOf('$19.99 a month') !== -1);
  assert.ok(pro.indexOf('or $149/year') !== -1);
  assert.ok(pro.indexOf('data-checkout-interval="month"') !== -1);
  assert.ok(pro.indexOf('Unlimited uploads and publishing') !== -1);
  assert.ok(pro.indexOf('you stay signed in on hold') !== -1);

  const faq = read('faq.html');
  assert.ok(faq.indexOf('$14.99 a month') !== -1);
  assert.ok(faq.indexOf('$19.99 a month') !== -1);
  assert.ok(faq.indexOf('Your account is on hold') !== -1);

  const basic = read('basic.html');
  assert.ok(basic.indexOf('href="signup.html?plan=basic"') !== -1);
  assert.ok(basic.indexOf('data-plan="basic"') !== -1);
  assert.ok(basic.indexOf('membership.js') !== -1);
  assert.ok(basic.indexOf('$0 forever') !== -1);
  assert.ok(basic.indexOf('you stay signed in on hold') !== -1);

  const checkout = read('checkout.js');
  assert.ok(checkout.indexOf('you stay signed in on hold') !== -1);

  const signup = read('signup.html');
  assert.ok(signup.indexOf('membership.js') !== -1);
  assert.ok(signup.indexOf('/api/auth/signup') !== -1);
  assert.ok(signup.indexOf('confirm.html') !== -1);
  assert.ok(signup.indexOf('recordSignedIn') === -1);

  const login = read('login.html');
  assert.ok(login.indexOf('membership.js') !== -1);
  assert.ok(login.indexOf('recordSignedIn') !== -1);

  const confirm = read('confirm.html');
  assert.ok(confirm.indexOf('/api/auth/mail') !== -1);
  assert.ok(confirm.indexOf('recordSignedIn') === -1);

  const confirmed = read('confirmed.html');
  assert.ok(confirmed.indexOf('membership.js') !== -1);
  assert.ok(confirmed.indexOf('recordSignedIn') !== -1);

  const dashboard = read('dashboard.html');
  assert.ok(dashboard.indexOf('href="upload.html"') !== -1);
  assert.ok(dashboard.indexOf('Submit your first song') !== -1);
  assert.ok(dashboard.indexOf('Create now') !== -1);
  assert.ok(dashboard.indexOf('data-first-song') !== -1);
  assert.ok(dashboard.indexOf('data-has-release') !== -1);
  assert.ok(dashboard.indexOf('In Review') !== -1);

  const membership = read('membership.js');
  assert.ok(membership.indexOf('localStorage') !== -1);
  assert.ok(membership.indexOf('plaigroundSignedIn') !== -1);
  assert.ok(membership.indexOf('basic: true') !== -1);
  assert.ok(membership.indexOf('login.html') !== -1);
  assert.ok(membership.indexOf('isMarketingHome') !== -1);
  assert.ok(membership.indexOf('dashboard.html') !== -1);

  const tonegrid = read('tonegrid.js');
  assert.ok(tonegrid.indexOf('Creating release…') !== -1);
  assert.ok(tonegrid.indexOf('Song title is required.') !== -1);
  assert.ok(tonegrid.indexOf('PLAN_LIMIT') !== -1);
  assert.ok(tonegrid.indexOf('Upgrade to Creator or Pro') !== -1);
  assert.ok(tonegrid.indexOf('mergeCatalogIds') !== -1);
  assert.ok(tonegrid.indexOf('showLimitPanel') !== -1);

  const upload = read('upload.html');
  assert.ok(upload.indexOf('id="tg-upgrade"') !== -1);
  assert.ok(upload.indexOf('id="tg-limit"') !== -1);
  assert.ok(upload.indexOf('href="creator.html"') !== -1);
  assert.ok(upload.indexOf('href="pro.html"') !== -1);
  assert.ok(upload.indexOf('Upgrade to Creator') !== -1);

  const plans = read('lib/plans.js');
  assert.ok(plans.indexOf('Basic includes one release. Upgrade to Creator or Pro to upload more.') !== -1);
  assert.ok(plans.indexOf('Creator includes 8 releases per month. Upgrade to Pro to upload more.') !== -1);
  assert.ok(plans.indexOf('CREATOR_MONTHLY = 8') !== -1);

  ['membership.js', 'tonegrid.js', 'checkout.js', 'signup.html', 'login.html', 'confirm.html', 'confirmed.html', 'index.html', 'basic.html'].forEach(function (file) {
    const text = read(file);
    assert.ok(!text.includes(['t', 'g', 'k', '_'].join('')), file + ' must not contain a key prefix');
    assert.ok(!/sk_live_|sk_test_|pk_live_/.test(text), file + ' must not contain Stripe secrets');
  });

  console.log('basic-plan-wiring.test.js ok');
}

run();
