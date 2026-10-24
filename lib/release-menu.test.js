'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const js = read('site.js');
const css = read('site.css');
assert.ok(js.includes('function appendPublishGroup'), 'Publish group is trimmed with a More toggle');
assert.ok(js.includes('More publishing tools'), 'More publishing tools label is in the menu');
assert.ok(js.includes('function setupFlowMenu'), 'release flow pages build the shared side menu');
assert.ok(js.includes('window.PLAI_FLOW_MENU_ONLY'), 'flow pages run site.js in menu-only mode');
assert.ok(css.includes('.side-more-toggle'), 'More toggle is styled');
assert.ok(/@media \(min-width: 981px\)[\s\S]*?\.app \.topbar \.menu-toggle \{ display: inline-flex; \}/.test(css), 'signed-in top bar menu button shows on desktop too');
['upload.html', 'attest.html', 'split-sheet.html', 'review.html', 'submitted.html'].forEach((f) => {
  const html = read(f);
  assert.ok(html.includes('window.PLAI_FLOW_MENU_ONLY = true'), f + ' turns on the flow menu');
  assert.ok(html.includes('site.js?v=20261023menu'), f + ' loads site.js at the menu stamp');
  assert.ok(html.includes('site.css?v=20261023menu'), f + ' cache-busts site.css at the menu stamp');
});
assert.ok(!/\u2014/.test(js.slice(js.indexOf('function appendPublishGroup'), js.indexOf('function organizeSideNav'))), 'no em dashes');
console.log('release-menu.test.js ok');
