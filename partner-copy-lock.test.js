'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function walk(dir, acc) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === 'node_modules' || entry.name === '.git') return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
      return;
    }
    if (/\.(html|js)$/.test(entry.name)) acc.push(full);
  });
  return acc;
}

function isTestFile(file) {
  return /\.test\.js$/.test(file);
}

function stripComments(src, isHtml) {
  var out = src;
  if (isHtml) {
    out = out.replace(/<!--[\s\S]*?-->/g, '');
  }
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

function stringLiterals(src) {
  const out = [];
  const re = /(['"])(?:\\.|(?!\1)[^\\])*\1/g;
  let m;
  while ((m = re.exec(src))) out.push(m[0].slice(1, -1));
  return out;
}

function isAllowedUserString(value) {
  if (!/ToneGrid|Tonegrid/.test(value)) return true;
  if (/\/api\/tonegrid\//.test(value)) return true;
  if (/plaiground\.tonegrid\.draft/.test(value)) return true;
  if (/^data-tonegrid-/.test(value)) return true;
  if (/tonegrid\.js/.test(value)) return true;
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
  while ((m = re.exec(text))) hits.push(text.slice(Math.max(0, m.index - 24), m.index + 32));
  return hits;
}

function run() {
  const root = __dirname;
  const files = walk(root, []);
  const leaks = [];

  files.forEach(function (file) {
    if (isTestFile(file)) return;
    const rel = path.relative(root, file);
    if (rel === 'terms.html' || rel === 'split-sheet.html') return;
    const raw = fs.readFileSync(file, 'utf8');
    const isHtml = /\.html$/.test(file);
    if (isHtml) {
      htmlVisibleLeaks(raw).forEach(function (snippet) {
        leaks.push(rel + ' html text: ' + snippet.replace(/\s+/g, ' ').trim());
      });
    }
    const stripped = stripComments(raw, isHtml);
    stringLiterals(stripped).forEach(function (value) {
      if (isAllowedUserString(value)) return;
      leaks.push(rel + ' string: ' + JSON.stringify(value));
    });
  });

  assert.strictEqual(leaks.length, 0, 'user-facing ToneGrid/Tonegrid leaks:\n' + leaks.join('\n'));

  const timeoutSrc = fs.readFileSync(path.join(root, 'tonegrid.js'), 'utf8');
  assert.ok(timeoutSrc.includes("return 'We could not reach the store. Try again.';"));
  assert.ok(!timeoutSrc.includes('ToneGrid did not respond'));

  console.log('partner-copy-lock.test.js ok');
}

run();
