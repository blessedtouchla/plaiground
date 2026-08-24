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

function makeStorage() {
  return {
    data: Object.create(null),
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
    setItem(key, value) { this.data[key] = String(value); },
  };
}

function load(opts) {
  opts = opts || {};
  const defaultOn = Boolean(opts.defaultOn);
  const ai = makeEl({ attrs: { 'data-made-how': 'ai_assisted' }, on: 'on' });
  const noAi = makeEl({ attrs: { 'data-made-how': 'no_ai' } });
  const fullyAi = makeEl({ attrs: { 'data-made-how': 'fully_ai' } });
  const humanSection = makeEl({ attrs: { 'data-human-section': '' } });
  const tags = TAGS.map(function (label, index) {
    return makeEl({
      textContent: label,
      className: 'tag',
      attrs: { 'data-human-tag': '' },
      on: defaultOn && (index === 0 || index === 1 || index === 5 || index === 6) ? 'on' : '',
    });
  });
  const count = makeEl({
    textContent: defaultOn ? '4 selected' : '0 selected',
    attrs: { 'data-human-count': '' },
  });
  const human = makeEl({ id: 'attest-human', value: '' });
  const rights = makeEl({ id: 'attest-rights' });
  const solo = makeEl({ id: 'attest-solo' });
  const soloCard = makeEl({ id: 'solo-card' });
  const status = makeEl({ id: 'attest-status' });
  const trigger = makeEl({ attrs: { href: 'split-sheet.html', 'data-attest-continue': '' }, textContent: 'Continue to the split sheet' });
  const localStorage = opts.localStorage || makeStorage();
  const sessionStorage = opts.sessionStorage || makeStorage();
  if (opts.draft) {
    localStorage.setItem('plaiground.store.draft', JSON.stringify(opts.draft));
  }
  if (opts.sessionDraft) {
    sessionStorage.setItem('plaiground.store.draft', JSON.stringify(opts.sessionDraft));
  }
  if (opts.humanSaved) {
    sessionStorage.setItem('plaiground.attest.human_saved', '1');
  }

  const document = {
    getElementById(id) {
      if (id === 'attest-human') return human;
      if (id === 'attest-rights') return rights;
      if (id === 'attest-solo') return solo;
      if (id === 'solo-card') return soloCard;
      if (id === 'attest-status') return status;
      return null;
    },
    querySelector(sel) {
      if (sel === '[data-made-how].on') {
        if (ai.classList.contains('on')) return ai;
        if (noAi.classList.contains('on')) return noAi;
        if (fullyAi.classList.contains('on')) return fullyAi;
        return null;
      }
      if (sel === '[data-human-count]') return count;
      if (sel === '[data-attest-continue]') return trigger;
      if (sel === '[data-human-section]') return humanSection;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '[data-made-how]') return [ai, noAi, fullyAi];
      if (sel === '.tag, [data-human-tag]') return tags;
      return [];
    },
  };

  const context = {
    localStorage,
    sessionStorage,
    document,
    location: { href: 'attest.html' },
    PlaigroundUploadRequired: require('./lib/upload-required'),
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'attest.js'), 'utf8'), context);
  return {
    ai,
    noAi,
    fullyAi,
    humanSection,
    tags,
    count,
    human,
    rights,
    solo,
    soloCard,
    trigger,
    status,
    localStorage,
    sessionStorage,
    location: context.location,
  };
}

function run() {
  const html = fs.readFileSync(path.join(__dirname, 'attest.html'), 'utf8');
  assert.ok(html.indexOf('attest.js') !== -1);
  assert.ok(html.indexOf('data-made-how="ai_assisted"') !== -1);
  assert.ok(html.indexOf('data-made-how="no_ai"') !== -1);
  assert.ok(html.indexOf('data-made-how="fully_ai"') !== -1);
  assert.ok(html.indexOf('Full AI tracks are accepted.') !== -1);
  assert.ok(!/human authorship is required/i.test(html));
  TAGS.forEach(function (label) {
    assert.ok(html.indexOf(label) !== -1, 'missing tag ' + label);
  });
  assert.ok(html.indexOf('data-attest-continue') !== -1);
  assert.ok(html.indexOf('id="attest-solo"') !== -1);
  assert.ok(html.indexOf('I own 100% / I attest') !== -1);
  assert.ok(html.indexOf('0 selected') !== -1);
  assert.ok(html.indexOf('4 selected') === -1);
  assert.ok(!/class="tag on"/.test(html), 'chips must not be preselected in HTML');

  const page = load();
  assert.ok(page.ai.classList.contains('on'));
  assert.ok(!page.noAi.classList.contains('on'));
  assert.strictEqual(page.count.textContent, '0 selected');
  page.tags.forEach(function (tag) {
    assert.ok(!tag.classList.contains('on'), 'fresh page must not preselect ' + tag.textContent);
  });

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
  const noAiDraft = JSON.parse(page.localStorage.getItem('plaiground.store.draft'));
  assert.strictEqual(noAiDraft.made_how, 'no_ai');
  assert.strictEqual(noAiDraft.rights_confirmed, true);
  assert.strictEqual(
    page.localStorage.getItem('plaiground.tonegrid.draft'),
    page.localStorage.getItem('plaiground.store.draft'),
    'attest mirrors the draft for split-sheet.html, which we must not edit'
  );

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
  again.human.value = '';
  again.trigger.listeners.click({ preventDefault() {} });
  assert.notStrictEqual(again.status.textContent, 'Describe the human contribution is required.');
  assert.strictEqual(again.location.href, 'split-sheet.html');

  const full = load();
  full.fullyAi.listeners.click({ preventDefault() {} });
  assert.ok(full.fullyAi.classList.contains('on'));
  assert.ok(!full.ai.classList.contains('on'));
  assert.ok(!full.noAi.classList.contains('on'));
  assert.strictEqual(full.humanSection.hidden, true);
  full.rights.checked = false;
  full.trigger.listeners.click({ preventDefault() {} });
  assert.strictEqual(full.status.textContent, 'Rights confirmation is required.');
  assert.notStrictEqual(full.location.href, 'split-sheet.html');
  full.rights.checked = true;
  full.trigger.listeners.click({ preventDefault() {} });
  assert.strictEqual(full.location.href, 'split-sheet.html');
  const fullDraft = JSON.parse(full.localStorage.getItem('plaiground.store.draft'));
  assert.strictEqual(fullDraft.made_how, 'fully_ai');
  assert.strictEqual(fullDraft.rights_confirmed, true);

  const soloPage = load();
  soloPage.noAi.listeners.click({ preventDefault() {} });
  soloPage.rights.checked = true;
  soloPage.solo.checked = true;
  if (soloPage.solo.listeners.change) soloPage.solo.listeners.change();
  soloPage.trigger.listeners.click({ preventDefault() {} });
  assert.strictEqual(soloPage.location.href, 'review.html');
  const soloDraft = JSON.parse(soloPage.localStorage.getItem('plaiground.store.draft'));
  assert.strictEqual(soloDraft.solo_owned_100, true);
  assert.strictEqual(soloDraft.made_how, 'no_ai');

  const featured = load();
  featured.localStorage.setItem('plaiground.store.draft', JSON.stringify({ featured: 'Guest Star' }));
  featured.noAi.listeners.click({ preventDefault() {} });
  featured.rights.checked = true;
  featured.solo.checked = true;
  if (featured.solo.listeners.change) featured.solo.listeners.change();
  featured.trigger.listeners.click({ preventDefault() {} });
  assert.strictEqual(featured.location.href, 'split-sheet.html');
  const featuredDraft = JSON.parse(featured.localStorage.getItem('plaiground.store.draft'));
  assert.strictEqual(featuredDraft.solo_owned_100, false);

  const leftoverEmpty = load({
    defaultOn: true,
    draft: { made_how: 'ai_assisted', human_elements: [] },
  });
  leftoverEmpty.tags.forEach(function (tag) {
    assert.ok(!tag.classList.contains('on'), 'empty leftover must not restore ' + tag.textContent);
  });
  assert.strictEqual(leftoverEmpty.count.textContent, '0 selected');

  const leftoverMissing = load({
    defaultOn: true,
    draft: { made_how: 'ai_assisted' },
  });
  leftoverMissing.tags.forEach(function (tag) {
    assert.ok(!tag.classList.contains('on'), 'missing leftover must not restore ' + tag.textContent);
  });
  assert.strictEqual(leftoverMissing.count.textContent, '0 selected');

  const leftoverStale = load({
    defaultOn: true,
    draft: {
      made_how: 'ai_assisted',
      human_elements: ['Original lyrics', 'Lead vocals performed', 'Arrangement', 'Prompt authorship'],
    },
  });
  leftoverStale.tags.forEach(function (tag) {
    assert.ok(!tag.classList.contains('on'), 'stale leftover chips must not restore unless saved this session');
  });
  assert.strictEqual(leftoverStale.count.textContent, '0 selected');

  const savedThisSession = load({
    draft: { made_how: 'ai_assisted', human_elements: ['Original lyrics'] },
    sessionDraft: { made_how: 'ai_assisted', human_elements: ['Original lyrics'] },
    humanSaved: true,
  });
  assert.ok(savedThisSession.tags[0].classList.contains('on'));
  assert.strictEqual(savedThisSession.count.textContent, '1 selected');

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
  assert.ok(rules.validateAttest({
    made_how: 'ai_assisted',
    human_elements: ['Original lyrics'],
    human_contribution: '',
    rights_confirmed: true,
  }).ok);
  assert.ok(!rules.validateAttestPage({
    made_how: 'ai_assisted',
    human_elements: ['Original lyrics'],
    human_contribution: '',
    rights_confirmed: true,
  }).error);

  console.log('attest.page.test.js ok');
}

run();
