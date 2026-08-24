'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function run() {
  const settings = read('settings.html');
  assert.ok(settings.includes('data-account-plan-pitch'), 'Settings PLAN card is filled from the signed-in plan');
  assert.ok(settings.includes('data-manage-plan-toggle'), 'Settings must expose Manage plan');
  assert.ok(settings.includes('data-checkout-switch'), 'Manage plan switches on the existing checkout function');
  assert.ok(settings.includes('checkout.js'), 'Settings reuses checkout.js');
  assert.ok(settings.includes('Creator · $14.99/month'), 'locked Creator monthly');
  assert.ok(settings.includes('Creator · $12.42/month billed yearly'), 'locked Creator yearly as monthly');
  assert.ok(settings.includes('Pro · $19.99/month'), 'locked Pro monthly');
  assert.ok(settings.includes('Pro · $16.58/month billed yearly'), 'Pro yearly $199 displays as $16.58/month billed yearly');
  assert.ok(!/Pro \$149\/year/.test(settings), 'Settings must not say Pro $149/year');
  assert.ok(!/\$19\.99\/month or \$149\/year/.test(settings), 'Settings must not keep the yearly dollar on the plan pitch');
  assert.ok(!/\$19\.99\/month or \$199\/year/.test(settings), 'Settings must not keep the yearly dollar on the plan pitch');
  assert.ok(settings.indexOf('data-checkout-plan="basic"') === -1, 'Basic is not a paid switch target');

  const pitchPages = [
    'settings.html',
    'dashboard.html',
    'releases.html',
    'splits.html',
    'splits-empty.html',
    'library.html',
    'boosts.html',
  ];
  pitchPages.forEach(function (file) {
    const html = read(file);
    assert.ok(!/\$19\.99\/month or \$149\/year/.test(html), file + ' still has the old month-or-year pitch');
    assert.ok(html.includes('$16.58/month billed yearly'), file + ' is missing the yearly-as-monthly pitch');
  });

  const index = read('index.html');
  assert.ok(index.includes('or $149/year'), 'public Creator yearly stays $149');
  assert.ok(index.includes('or $199/year'), 'public Pro yearly displays $199');
  assert.ok(index.includes('$14.99'), 'public Creator monthly price stays');
  assert.ok(index.includes('$19.99'), 'public Pro monthly price stays');
  assert.ok(/data-checkout-plan="pro"\s+data-checkout-interval="year"/.test(index), 'Pro yearly checkout is live at $199');

  console.log('settings-plan-pitch.test.js ok');
}

run();
