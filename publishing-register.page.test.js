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
  assert.ok(html.includes('data-publishing-submit'), 'submit carries the picked release');
  assert.ok(!/ToneGrid|Tonegrid/.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, '')));

  const confirmHtml = fs.readFileSync(path.join(__dirname, 'publishing-confirm.html'), 'utf8');
  assert.ok(!/Neon Sermon/.test(confirmHtml), 'confirm must not hardcode Neon Sermon');
  assert.ok(confirmHtml.includes('data-confirm-headline'));
  assert.ok(confirmHtml.includes('data-confirm-artist'));
  assert.ok(confirmHtml.includes('data-confirm-status'));
  assert.ok(confirmHtml.includes('data-confirm-filed'));
  assert.ok(confirmHtml.includes('data-confirm-paid'));
  assert.ok(confirmHtml.includes('data-confirm-song'));
  assert.ok(confirmHtml.includes('data-require-publishing="true"'), 'Basic still cannot open publishing confirm');
  assert.ok(!/ToneGrid|Tonegrid/.test(confirmHtml.replace(/<script\b[\s\S]*?<\/script>/gi, '')));

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

  const mexeuId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const mexeuMe = {
    plan: 'creator',
    profile: {
      artists: [{ id: 'art-1', name: 'mexeu mexeu', source: 'created' }],
      releases: [{
        id: mexeuId,
        tonegrid_release_id: mexeuId,
        title: 'mexeu',
        plaiground_artist_id: 'art-1',
      }],
    },
  };
  const mexeuLive = [{ uuid: mexeuId, title: 'mexeu', artist: 'mexeu mexeu', release_date: '2026-08-20' }];
  const filedView = publishing.confirmView({
    search: '?release=' + mexeuId,
    me: mexeuMe,
    liveRows: mexeuLive,
    submit: {
      id: mexeuId,
      title: 'mexeu',
      artist: 'mexeu mexeu',
      filed: '2026-08-25',
      status: 'Pending at BMI',
      paid: '$0.00 · included in membership',
    },
  });
  assert.strictEqual(filedView.title, 'mexeu');
  assert.strictEqual(filedView.artist, 'mexeu mexeu');
  assert.strictEqual(filedView.filed, '25 Aug 2026');
  assert.strictEqual(filedView.status, 'Pending at BMI');
  assert.strictEqual(filedView.paid, '$0.00 · included in membership');
  assert.strictEqual(filedView.headline, 'mexeu is filed for publishing.');
  assert.strictEqual(filedView.songHref, 'song.html?id=' + mexeuId);
  assert.ok(!/Neon Sermon/.test(filedView.headline));

  const fromQueryOnly = publishing.confirmView({
    search: '?release=' + mexeuId,
    me: mexeuMe,
    liveRows: mexeuLive,
  });
  assert.strictEqual(fromQueryOnly.title, 'mexeu');
  assert.strictEqual(fromQueryOnly.artist, 'mexeu mexeu');
  assert.ok(!/Neon Sermon/.test(fromQueryOnly.headline + fromQueryOnly.title));

  const dummyView = publishing.confirmView({
    submit: {
      title: 'Neon Sermon',
      artist: 'Victoria Reyes',
      filed: '2026-08-14',
      status: 'Pending at BMI',
      paid: '$0.00 · included in membership',
    },
  });
  assert.strictEqual(dummyView.title, '');
  assert.ok(!/Neon Sermon/.test(dummyView.headline));
  assert.strictEqual(dummyView.headline, 'This work is filed for publishing.');

  const confirmNodes = {
    '[data-confirm-headline]': textNode('Neon Sermon is filed for publishing.'),
    '[data-confirm-artist]': textNode(''),
    '[data-confirm-status]': textNode(''),
    '[data-confirm-filed]': textNode('14 Aug 2026'),
    '[data-confirm-paid]': textNode(''),
    '[data-confirm-song]': { textContent: 'Back to the song', href: 'song.html', setAttribute: function (name, value) { this[name] = value; } },
  };
  const painted = publishing.bindConfirm({
    querySelector: function (selName) { return confirmNodes[selName] || null; },
  }, {
    search: '?release=' + mexeuId,
    me: mexeuMe,
    liveRows: mexeuLive,
    submit: {
      id: mexeuId,
      title: 'mexeu',
      artist: 'mexeu mexeu',
      filed: '2026-08-25',
      status: 'Pending at BMI',
      paid: '$0.00 · included in membership',
    },
  });
  assert.ok(painted);
  assert.strictEqual(confirmNodes['[data-confirm-headline]'].textContent, 'mexeu is filed for publishing.');
  assert.strictEqual(confirmNodes['[data-confirm-artist]'].textContent, 'mexeu mexeu');
  assert.strictEqual(confirmNodes['[data-confirm-status]'].textContent, 'Pending at BMI');
  assert.strictEqual(confirmNodes['[data-confirm-filed]'].textContent, '25 Aug 2026');
  assert.strictEqual(confirmNodes['[data-confirm-paid]'].textContent, '$0.00 · included in membership');
  assert.strictEqual(confirmNodes['[data-confirm-song]'].href, 'song.html?id=' + mexeuId);

  const submitBtn = {
    href: 'publishing-confirm.html',
    classList: { contains: function () { return false; } },
    attrs: { 'aria-disabled': 'false' },
    setAttribute: function (name, value) { this.attrs[name] = value; this[name] = value; },
    getAttribute: function (name) { return this.attrs[name]; },
    addEventListener: function () {},
  };
  nodes['[data-publishing-submit]'] = submitBtn;
  const stored = {};
  const boundSubmit = publishing.bind(doc, {
    me: me,
    roster: me.profile.artists,
    liveRows: live,
    plan: 'creator',
    storage: {
      getItem: function (key) { return stored[key] || null; },
      setItem: function (key, value) { stored[key] = value; },
    },
    now: '2026-08-25',
  });
  sel.value = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  boundSubmit.applyPick();
  assert.ok(String(submitBtn.href).indexOf('release=cccccccc-cccc-4ccc-8ccc-cccccccccccc') !== -1);
  boundSubmit.persistSubmit();
  const saved = JSON.parse(stored['plaiground.publishing.submit']);
  assert.strictEqual(saved.title, 'Night Drive');
  assert.ok(saved.title !== 'Neon Sermon');
  assert.strictEqual(saved.filed, '2026-08-25');
  assert.strictEqual(saved.status, 'Pending at BMI');
  assert.strictEqual(saved.paid, '$0.00 · included in membership');

  console.log('publishing-register.page.test.js ok');
}

run();
