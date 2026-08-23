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

  const how = read('how-it-works.html');
  assert.ok(how.indexOf('href="signup.html?plan=basic"') !== -1);

  const basic = read('basic.html');
  assert.ok(basic.indexOf('href="signup.html?plan=basic"') !== -1);
  assert.ok(basic.indexOf('data-plan="basic"') !== -1);
  assert.ok(basic.indexOf('membership.js') !== -1);

  const signup = read('signup.html');
  assert.ok(signup.indexOf('membership.js') !== -1);
  assert.ok(signup.indexOf('recordSignedIn') !== -1);
  assert.ok(signup.indexOf('recordPlan') !== -1);

  const login = read('login.html');
  assert.ok(login.indexOf('membership.js') !== -1);
  assert.ok(login.indexOf('recordSignedIn') !== -1);

  const confirm = read('confirm.html');
  assert.ok(confirm.indexOf('recordSignedIn') !== -1);

  const confirmed = read('confirmed.html');
  assert.ok(confirmed.indexOf('membership.js') !== -1);
  assert.ok(confirmed.indexOf('recordSignedIn') !== -1);

  const dashboard = read('dashboard.html');
  assert.ok(dashboard.indexOf('href="upload.html"') !== -1);
  assert.ok(dashboard.indexOf('Submit your first song') !== -1);
  assert.ok(dashboard.indexOf('Create now') !== -1);

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

  ['membership.js', 'tonegrid.js', 'checkout.js', 'signup.html', 'login.html', 'confirm.html', 'confirmed.html', 'index.html', 'basic.html'].forEach(function (file) {
    const text = read(file);
    assert.ok(!text.includes(['t', 'g', 'k', '_'].join('')), file + ' must not contain a key prefix');
    assert.ok(!/sk_live_|sk_test_|pk_live_/.test(text), file + ' must not contain Stripe secrets');
  });

  console.log('basic-plan-wiring.test.js ok');
}

run();
