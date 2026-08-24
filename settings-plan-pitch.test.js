'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function run() {
  const settings = read('settings.html');
  assert.ok(settings.includes('$19.99/month or $16.58/month billed yearly'), 'Settings plan pitch must show both amounts as monthly');
  assert.ok(!/\$19\.99\/month or \$149\/year/.test(settings), 'Settings must not keep the yearly dollar on the plan pitch');
  assert.ok(!/\$19\.99\/month or \$199\/year/.test(settings), 'Settings must not keep the yearly dollar on the plan pitch');
  assert.ok(settings.includes('$16.58/month billed yearly'), 'Pro yearly $199 displays as $16.58/month billed yearly');

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
