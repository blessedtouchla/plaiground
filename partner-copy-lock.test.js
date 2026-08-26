'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const USER_FILES = [
  'admin.html',
  'admin.js',
  'analytics.html',
  'analytics.js',
  'artists.html',
  'artists.js',
  'catalog.js',
  'dashboard.html',
  'earnings.html',
  'earnings.js',
  'faq.html',
  'how.html',
  'how-it-works.html',
  'releases.html',
  'review.html',
  'submitted.html',
  'song.html',
  'song.js',
  'edit-submitted.html',
  'lib/statement-pdf.js',
  'store-client.js',
  'upload.html',
  'lib/upload-required.js',
  'lib/cover-preview.js',
  'lib/cover-url.js',
  'publishing-register.html',
  'publishing-register.js',
];

function stringLiterals(src) {
  const out = [];
  String(src).split('\n').forEach(function (line) {
    const re = /'([^'\\]|\\.)*'|"([^"\\]|\\.)*"/g;
    let m;
    while ((m = re.exec(line))) out.push(m[0].slice(1, -1));
  });
  return out;
}

function isAllowedUserString(value) {
  if (!/ToneGrid|Tonegrid/.test(value)) return true;
  if (/\/api\/tonegrid\//.test(value)) return true;
  return false;
}

function htmlVisibleLeaks(src) {
  const withoutScripts = src
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const text = withoutScripts.replace(/<[^>]+>/g, ' ');
  const hits = [];
  const re = /ToneGrid|Tonegrid/g;
  let m;
  while ((m = re.exec(text))) hits.push(text.slice(Math.max(0, m.index - 24), m.index + 32).replace(/\s+/g, ' ').trim());
  return hits;
}

function run() {
  const root = __dirname;
  const leaks = [];

  fs.readdirSync(root).forEach(function (name) {
    if (!/\.html$/.test(name)) return;
    if (name === 'terms.html' || name === 'split-sheet.html') return;
    const raw = fs.readFileSync(path.join(root, name), 'utf8');
    htmlVisibleLeaks(raw).forEach(function (snippet) {
      leaks.push(name + ' html text: ' + snippet);
    });
  });

  USER_FILES.forEach(function (rel) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) return;
    const raw = fs.readFileSync(full, 'utf8');
    stringLiterals(raw).forEach(function (value) {
      if (isAllowedUserString(value)) return;
      leaks.push(rel + ' string: ' + JSON.stringify(value));
    });
  });

  assert.strictEqual(leaks.length, 0, 'user-facing ToneGrid/Tonegrid leaks:\n' + leaks.join('\n'));

  const timeoutSrc = fs.readFileSync(path.join(root, 'store-client.js'), 'utf8');
  assert.ok(timeoutSrc.includes("return 'We could not reach the store. Try again.';"));
  assert.ok(timeoutSrc.includes("We could not send the audio. Retry."));
  assert.ok(!timeoutSrc.includes('ToneGrid did not respond'));

  const uploadShipped = [
    'upload.html',
    'membership.js',
    'account.js',
    'upload-catalog.js',
    'lib/upload-required.js',
    'lib/artist-check.js',
    'lib/audio-accept.js',
    'lib/store-pick.js',
    'store-client.js',
    'plai-bubble.js',
    'plai-coach.js',
  ];
  uploadShipped.forEach(function (rel) {
    const raw = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(raw.indexOf('tonegrid.js') === -1, rel + ' must not ship tonegrid.js');
    assert.ok(raw.indexOf('data-tonegrid-') === -1, rel + ' must not ship data-tonegrid- attributes');
    assert.ok(raw.indexOf('plaiground.tonegrid.draft') === -1, rel + ' must not ship the old draft key');
  });

  console.log('partner-copy-lock.test.js ok');
}

run();
