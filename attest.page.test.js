'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TAGS = [
  'Original lyrics',
  'Lead vocals performed',
  'Backing vocals',
  'Played an instrument',
  'Melody written',
  'Arrangement',
  'Prompt authorship',
  'Mixed by a person',
  'Mastered by a person',
];

function makeEl(attrs) {
  const el = {
    id: attrs.id || '',
    value: attrs.value || '',
    textContent: attrs.textContent || '',
    checked: Boolean(attrs.checked),
    hidden: true,
    className: attrs.className || '',
    attrs: Object.assign({}, attrs.attrs || {}),
    listeners: {},
    children: [],
    classList: {
      tokens: Object.create(null),
      toggle(name, force) {
        if (force === undefined) {
          if (this.tokens[name]) delete this.tokens[name];
          else this.tokens[name] = true;
          return;
        }
        if (force) this.tokens[name] = true;
        else delete this.tokens[name];
      },
      add(name) { this.tokens[name] = true; },
      contains(name) { return Boolean(this.tokens[name]); },
    },
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  (attrs.on ? [attrs.on] : []).forEach(function (name) { el.classList.tokens[name] = true; });
  if (attrs.className === 'on' || /\bon\b/.test(attrs.className || '')) el.classList.tokens.on = true;
  return el;
}

function load() {
  const ai = makeEl({ attrs: { 'data-made-how': 'ai_assisted' }, on: 'on' });
  const noAi = makeEl({ attrs: { 'data-made-how': 'no_ai' } });
  const tags = TAGS.map(function (label, index) {
    return makeEl({
      textContent: label,
      className: 'tag',
      attrs: { 'data-human-tag': '' },
      on: index === 0 || index === 1 || index === 5 || index === 6 ? 'on' : '',
    });
  });
  const count = makeEl({ textContent: '4 selected', attrs: { 'data-human-count': '' } });
  const human = makeEl({ id: 'attest-human', value: '' });
  const rights = makeEl({ id: 'attest-rights' });
  const status = makeEl({ id: 'attest-status' });
  const trigger = makeEl({ attrs: { href: 'split-sheet.html', 'data-attest-continue': '' } });
  const localStorage = {
    data: Object.create(null),
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
    setItem(key, value) { this.data[key] = String(value); },
  };

  const document = {
    getElementById(id) {
      if (id === 'attest-human') return human;
      if (id === 'attest-rights') return rights;
      if (id === 'attest-status') return status;
      return null;
    },
    querySelector(sel) {
      if (sel === '[data-made-how].on') return ai.classList.contains('on') ? ai : (noAi.classList.contains('on') ? noAi : null);
      if (sel === '[data-human-count]') return count;
      if (sel === '[data-attest-continue]') return trigger;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '[data-made-how]') return [ai, noAi];
      if (sel === '.tag, [data-human-tag]') return tags;
      return [];
    },
  };

  const context = {
    localStorage,
    sessionStorage: localStorage,
    document,
    location: { href: 'attest.html' },
    PlaigroundUploadRequired: require('./lib/upload-required'),
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'attest.js'), 'utf8'), context);
  return { ai, noAi, tags, count, human, rights, trigger, status, localStorage, location: context.location };
}

function run() {
  const html = fs.readFileSync(path.join(__dirname, 'attest.html'), 'utf8');
  assert.ok(html.indexOf('attest.js') !== -1);
  assert.ok(html.indexOf('data-made-how="ai_assisted"') !== -1);
  assert.ok(html.indexOf('data-made-how="no_ai"') !== -1);
  TAGS.forEach(function (label) {
    assert.ok(html.indexOf(label) !== -1, 'missing tag ' + label);
  });
  assert.ok(html.indexOf('data-attest-continue') !== -1);

  const page = load();
  assert.ok(page.ai.classList.contains('on'));
  assert.ok(!page.noAi.classList.contains('on'));

  page.noAi.listeners.click({ preventDefault() {} });
  assert.ok(page.noAi.classList.contains('on'));
  assert.ok(!page.ai.classList.contains('on'));
  assert.ok(String(page.count.textContent).indexOf('selected') !== -1);

  page.ai.listeners.click({ preventDefault() {} });
  assert.ok(page.ai.classList.contains('on'));
  assert.ok(!page.noAi.classList.contains('on'));

  page.tags.forEach(function (tag) {
    const before = tag.classList.contains('on');
    tag.listeners.click({ preventDefault() {} });
    assert.strictEqual(tag.classList.contains('on'), !before, 'tag did not toggle: ' + tag.textContent);
    tag.listeners.click({ preventDefault() {} });
    assert.strictEqual(tag.classList.contains('on'), before);
  });

  page.noAi.listeners.click({ preventDefault() {} });
  page.human.value = '';
  page.rights.checked = false;
  page.trigger.listeners.click({ preventDefault() {} });
  assert.strictEqual(page.status.textContent, 'Rights confirmation is required.');
  assert.notStrictEqual(page.location.href, 'split-sheet.html');

  page.rights.checked = true;
  page.trigger.listeners.click({ preventDefault() {} });
  assert.strictEqual(page.location.href, 'split-sheet.html');
  const noAiDraft = JSON.parse(page.localStorage.getItem('plaiground.tonegrid.draft'));
  assert.strictEqual(noAiDraft.made_how, 'no_ai');
  assert.strictEqual(noAiDraft.rights_confirmed, true);

  const again = load();
  again.ai.listeners.click({ preventDefault() {} });
  again.tags.forEach(function (tag) {
    if (tag.classList.contains('on')) tag.listeners.click({ preventDefault() {} });
  });
  again.human.value = '';
  again.rights.checked = true;
  again.trigger.listeners.click({ preventDefault() {} });
  assert.strictEqual(again.status.textContent, 'Human element is required.');
  assert.notStrictEqual(again.location.href, 'split-sheet.html');

  again.tags[0].listeners.click({ preventDefault() {} });
  again.trigger.listeners.click({ preventDefault() {} });
  assert.strictEqual(again.status.textContent, 'Describe the human contribution is required.');

  again.human.value = 'I wrote the lyrics.';
  again.trigger.listeners.click({ preventDefault() {} });
  assert.strictEqual(again.location.href, 'split-sheet.html');

  const rules = require('./lib/upload-required');
  assert.strictEqual(rules.validateAttest({
    made_how: 'no_ai',
    rights_confirmed: true,
  }).ok, true);
  assert.ok(rules.validateAttest({
    made_how: 'ai_assisted',
    human_elements: [],
    human_contribution: '',
    rights_confirmed: true,
  }).error);

  console.log('attest.page.test.js ok');
}

run();
