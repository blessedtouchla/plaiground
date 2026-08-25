'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const publishing = require('./publishing-register');

function run() {
  const html = fs.readFileSync(path.join(__dirname, 'publishing-register.html'), 'utf8');
  assert.ok(html.includes('data-publishing-release'), 'register starts with a release picker');
  assert.ok(html.includes('data-publishing-pick'), 'picker is the first step');
  assert.ok(!/>Your release</.test(html), 'must not leave a dummy Your release');
  assert.ok(!html.includes('data-latest-title>Your release'), 'carried-over title is not a dummy');
  assert.ok(html.includes('data-work-title'));
  assert.ok(html.includes('data-work-artist'));
  assert.ok(html.includes('data-work-date'));
  assert.ok(html.includes('data-work-ai'));
  assert.ok(html.includes('data-work-writers'));
  assert.ok(html.includes('data-require-publishing="true"'), 'Basic still cannot open publishing');
  assert.ok(html.includes('8 publishing registrations this month'));
  assert.ok(!/ToneGrid|Tonegrid/.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, '')));

  assert.ok(publishing.isDummyTitle('Your release'));
  assert.ok(!publishing.isDummyTitle('mexeu mexeu'));

  const me = {
    plan: 'creator',
    artist: 'mexeu mexeu',
    tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
    profile: {
      artists: [{ id: 'art-1', name: 'mexeu mexeu', source: 'created' }],
      releases: [
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          tonegrid_release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          title: 'Your release',
        },
        {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          tonegrid_release_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          title: 'Night Drive',
          plaiground_artist_id: 'art-1',
        },
      ],
    },
  };
  const live = [
    {
      uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      title: 'Night Drive',
      artist: 'mexeu mexeu',
      release_date: '2026-09-12',
    },
  ];
  const catalog = publishing.catalogReleases(me, live);
  assert.ok(catalog.every(function (row) { return row.title !== 'Your release'; }), 'dummy title is dropped');
  assert.ok(catalog.some(function (row) { return row.title === 'Night Drive'; }));

  const work = publishing.workFromRelease(catalog.find(function (row) { return row.title === 'Night Drive'; }), {
    roster: me.profile.artists,
    draft: {
      release_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      title: 'Night Drive',
      name: 'mexeu mexeu',
      release_date: '2026-09-12',
      made_how: 'ai_assisted',
      human_elements: ['Original lyrics'],
      writers: [{ name: 'Ada Night', share: '50%' }, { name: 'Bo Writer', share: '50%' }],
    },
  });
  assert.strictEqual(work.title, 'Night Drive');
  assert.strictEqual(work.artist, 'mexeu mexeu');
  assert.strictEqual(work.date, '2026-09-12');
  assert.ok(/AI-assisted/.test(work.ai));
  assert.ok(/Ada Night/.test(work.writers));
  assert.ok(work.title !== 'Your release');

  const emptyWork = publishing.workFromRelease({ id: '', title: 'Your release' }, {});
  assert.strictEqual(emptyWork.title, '');

  function textNode(text) {
    return { textContent: text == null ? '' : String(text), hidden: false };
  }
  function optionNode(value, text) {
    return { value: value || '', textContent: text || '' };
  }
  const nodes = {
    '[data-publishing-pick]': { hidden: false },
    '[data-publishing-empty]': textNode(''),
    '[data-publishing-carry]': { hidden: true },
    '[data-publishing-cap]': { hidden: true },
    '[data-work-title]': textNode('Your release'),
    '[data-work-artist]': textNode('mexeu mexeu'),
    '[data-work-date]': textNode(''),
    '[data-work-ai]': textNode(''),
    '[data-work-writers]': textNode(''),
  };
  const options = [];
  const optionList = {
    get length() { return options.length; },
    set length(n) { options.length = n; },
  };
  const sel = {
    value: '',
    options: optionList,
    firstChild: null,
    addEventListener: function () {},
    appendChild: function (child) {
      options.push(child);
      this.firstChild = options[0] || null;
    },
    removeChild: function () {
      options.shift();
      this.firstChild = options[0] || null;
    },
  };
  const doc = {
    querySelector: function (selName) {
      if (selName === '[data-publishing-release]' || selName === '#pub-release') return sel;
      return nodes[selName] || null;
    },
    getElementById: function (id) {
      return id === 'pub-release' ? sel : null;
    },
    createElement: function () {
      return optionNode('', '');
    },
  };
  const bound = publishing.bind(doc, {
    me: me,
    roster: me.profile.artists,
    liveRows: live,
    plan: 'creator',
    draft: {
      release_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      title: 'Night Drive',
      name: 'mexeu mexeu',
      release_date: '2026-09-12',
      made_how: 'ai_assisted',
      human_elements: ['Original lyrics'],
      writers: [{ name: 'Ada Night', share: '50%' }, { name: 'Bo Writer', share: '50%' }],
    },
  });
  assert.ok(bound);
  assert.ok(nodes['[data-publishing-cap]'].hidden === false, 'Creator 8-reg cap still shows');
  assert.ok(options.some(function (opt) { return opt.textContent === 'Night Drive'; }));
  assert.ok(options.every(function (opt) { return opt.textContent !== 'Your release'; }), 'picker has no dummy Your release');
  assert.strictEqual(nodes['[data-work-title]'].textContent, '', 'fields stay empty until she picks');
  sel.value = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  bound.applyPick();
  assert.strictEqual(nodes['[data-work-title]'].textContent, 'Night Drive');
  assert.strictEqual(nodes['[data-work-artist]'].textContent, 'mexeu mexeu');
  assert.strictEqual(nodes['[data-work-date]'].textContent, '2026-09-12');
  assert.ok(/AI-assisted/.test(nodes['[data-work-ai]'].textContent));
  assert.ok(/Ada Night/.test(nodes['[data-work-writers]'].textContent));
  assert.strictEqual(nodes['[data-publishing-carry]'].hidden, false);

  console.log('publishing-register.page.test.js ok');
}

run();
