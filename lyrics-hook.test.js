'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const modes = require('./lib/song-modes');

const html = fs.readFileSync(path.join(__dirname, 'song-helper.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, 'song-helper-v2.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'lyrics-studio.css'), 'utf8');

assert.ok(html.includes('Start from the hook'));
assert.ok(html.includes('id="sh-choice-hook"'));
assert.ok(html.includes("Who's singing this?"));
assert.ok(html.includes('>Me</span>'));
assert.ok(html.includes('>A character</span>'));
assert.ok(html.includes('>Someone at the table</span>'));
assert.ok(html.includes('Words should amaze or amuse.'));
assert.ok(html.includes('id="sh-hook-lock"'));
assert.ok(html.includes('id="sh-hook-pin"'));
assert.ok(html.includes('id="sh-hook-unlock"'));
assert.ok(js.includes("bindPress(scratchBtn, function () { setBranch('scratch'); })"));
assert.ok(js.includes("revealStep('sh-idea')"));
assert.ok(js.includes("pointerup"));
assert.ok(css.includes('touch-action: manipulation'));
assert.ok(js.includes("fetch('/api/song-helper'"));
assert.ok(js.includes("fetch('/api/me/lyrics'"));

['me', 'character', 'table'].forEach(function (singer) {
  const input = modes.normalizeInput({ mode: 'write', singer: singer, hookFirst: true });
  assert.strictEqual(input.singer, singer);
  assert.strictEqual(input.hookFirst, true);
  const system = modes.systemPrompt(input);
  assert.ok(/own words|character|table/.test(system), system);
  assert.ok(system.includes('Write only the hook'));
  const sent = JSON.parse(modes.userPrompt(input));
  assert.strictEqual(sent.singer, singer);
  assert.strictEqual(sent.hookFirst, true);
  assert.ok(!sent.lockedHook);
});

const locked = modes.normalizeInput({
  mode: 'write',
  singer: 'me',
  lockedHook: 'I kept the kitchen light on.',
});
const lockedPrompt = modes.systemPrompt(locked);
assert.ok(lockedPrompt.includes('I kept the kitchen light on.'));
assert.ok(lockedPrompt.includes('Do not rewrite the hook'));
const lockedBody = JSON.parse(modes.userPrompt(locked));
assert.strictEqual(lockedBody.lockedHook, 'I kept the kitchen light on.');
assert.strictEqual(lockedBody.singer, 'me');

const plain = JSON.parse(modes.userPrompt(modes.normalizeInput({ mode: 'write' })));
assert.ok(!Object.prototype.hasOwnProperty.call(plain, 'singer'));
assert.ok(!Object.prototype.hasOwnProperty.call(plain, 'lockedHook'));
assert.ok(!Object.prototype.hasOwnProperty.call(plain, 'hookFirst'));
assert.strictEqual(modes.concreteError(modes.normalizeInput({ mode: 'write' })), '');

console.log('lyrics hook contract ok');
