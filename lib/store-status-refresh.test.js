'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

function run() {
  const refreshSrc = read('lib/store-status-refresh.js');
  const statusSrc = read('lib/release-status.js');
  const context = {
    window: {},
    document: { hidden: false, addEventListener() {} },
    setInterval() { return 1; },
    clearInterval() {},
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(statusSrc, context);
  vm.runInNewContext(refreshSrc, context);
  const api = context.PlaigroundStoreStatusRefresh;
  assert.strictEqual(api.needsPoll(['pending']), true);
  assert.strictEqual(api.needsPoll(['processing']), true);
  assert.strictEqual(api.needsPoll(['qc_inspection']), true);
  assert.strictEqual(api.needsPoll(['live']), false);
  assert.strictEqual(api.needsPoll(['needs-fix']), false);
  assert.strictEqual(api.needsPoll(['draft']), false);
  assert.ok(!/setTimeout\(\s*function\s*\(\)\s*\{\s*.*Live/.test(refreshSrc), 'no fake Live timer');

  const catalog = read('catalog.js');
  assert.ok(catalog.includes('PlaigroundStoreStatusRefresh'));
  assert.ok(catalog.includes('/api/tonegrid/releases'));
  assert.ok(!catalog.includes('tonegridFetch('));

  const analytics = read('analytics.js');
  assert.ok(analytics.includes('PlaigroundStoreStatusRefresh'));
  assert.ok(analytics.includes('/api/tonegrid/analytics'));

  const song = read('song.js');
  assert.ok(song.includes('PlaigroundStoreStatusRefresh'));
  assert.ok(song.includes('/api/tonegrid/releases'));

  const account = read('account.js');
  assert.ok(account.includes('/api/tonegrid/releases'));
  assert.ok(account.includes('PlaigroundStoreStatusRefresh'));

  ['dashboard.html', 'releases.html', 'song.html', 'analytics.html'].forEach(function (file) {
    const html = read(file);
    assert.ok(html.includes('lib/store-status-refresh.js'), file + ' must load the refresh helper');
    assert.ok(!/ToneGrid|Tonegrid/.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, '')), file + ' must not name the store');
  });

  const pages = [
    read('dashboard.html'),
    read('releases.html'),
    read('song.html'),
    read('analytics.html'),
    read('analytics.js'),
    read('catalog.js'),
    read('account.js'),
    read('song.js'),
  ].join('\n');
  assert.ok(!/Neon Sermon|Patrick|7,412,908/.test(pages));

  console.log('lib/store-status-refresh.test.js ok');
}

run();
