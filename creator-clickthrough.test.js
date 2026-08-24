'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function makeEl(attrs) {
  const tokens = Object.create(null);
  const el = {
    hidden: Boolean(attrs && attrs.hidden),
    textContent: (attrs && attrs.textContent) || '',
    value: (attrs && attrs.value) || '',
    className: (attrs && attrs.className) || '',
    attrs: Object.assign({}, (attrs && attrs.attrs) || {}),
    listeners: Object.create(null),
    children: [],
    style: {},
    getAttribute(name) {
      if (name === 'class') return this.className;
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    click(extra) {
      const ev = Object.assign({
        type: 'click',
        target: this,
        preventDefault: function () { this.prevented = true; },
      }, extra || {});
      if (typeof this.listeners.click === 'function') this.listeners.click(ev);
      return ev;
    },
    classList: {
      toggle(name, force) {
        if (force) tokens[name] = true;
        else delete tokens[name];
        el.className = Object.keys(tokens).join(' ');
      },
      contains(name) {
        return Boolean(tokens[name]);
      },
    },
  };
  String(el.className || '').split(/\s+/).filter(Boolean).forEach(function (name) {
    tokens[name] = true;
  });
  return el;
}

function run() {
  const tonegrid = read('store-client.js');
  assert.ok(tonegrid.includes('syncAlbumUi(next)'), 'album apply must sync the chosen type, not the stale Single class');
  assert.ok(tonegrid.includes('function syncAlbumUi(type)'), 'syncAlbumUi takes the type being applied');
  assert.ok(tonegrid.indexOf('if (draft && draft.type === \'album\') return \'album\'') < tonegrid.indexOf('querySelector(\'[data-type].on\')'), 'draft/query beat the leftover Single .on class');
  assert.ok(tonegrid.includes('isLeftoverArtistName'), 'upload roster strips John/Patrick mocks');
  assert.ok(tonegrid.includes('john ham'), 'John ham is treated as leftover');

  const upload = read('upload.html');
  assert.ok(upload.includes('data-type="album"'), 'Album control stays on upload');
  assert.ok(upload.includes('upload.html?type=album'), 'Album href still navigates when JS is late');
  assert.ok(upload.includes('data-album-count'), 'album step 1 asks for a song count before audio');
  assert.ok(upload.includes('plan-confirm.html?plan=pro'), 'Creator 9+ uses the existing plan confirm page');
  assert.ok(!/John ham|John Ham|Patrick/.test(upload), 'upload.html must not hardcode John/Patrick');
  assert.ok(/id="tg-artist-select"[\s\S]*?<option value="">Select an artist<\/option>/.test(upload), 'artist picker starts empty');

  const profile = read('lib/profile.js');
  assert.ok(profile.includes('!isPlaceholderArtist(row.name)'), '/api/me artists drop leftover mocks');

  const leftover = require('./lib/profile').readStored({
    profile: { artists: [{ id: 'mock', name: 'John ham', source: 'created', badge: 'PLAIGROUND' }], releases: [] },
  });
  assert.strictEqual(leftover.artists.length, 0, 'stored John ham must not become a picker option');

  const kept = require('./lib/profile').readStored({
    profile: { artists: [{ id: 'real', name: 'Fuvtu', source: 'created' }], releases: [] },
  });
  assert.strictEqual(kept.artists[0].name, 'Fuvtu');

  const auth = require('./lib/auth');
  const leftoverRoster = auth.publicUser({
    email: 'victoriaimtanes@gmail.com',
    artist_name: 'John ham',
    plan: 'creator',
    status: 'active',
    email_confirmed_at: new Date().toISOString(),
    profile: { artists: [{ id: 'mock', name: 'John ham', badge: 'PLAIGROUND' }], releases: [] },
  });
  assert.strictEqual(leftoverRoster.artist, '');
  assert.strictEqual((leftoverRoster.profile.artists || []).length, 0, '/api/me must not return John ham · PLAIGROUND');
  assert.ok(!JSON.stringify(leftoverRoster).includes('John ham'));

  const siteCss = read('site.css');
  assert.ok(siteCss.includes('body.app > .plai-bubble'), 'signed-in app pages keep the PLAI bubble in the viewport');
  assert.ok(!/body\.app[^{]*\{[^}]*display:\s*none/.test(siteCss), 'signed-in pages must not hide PLAI');
  assert.ok(!/body\.auth-full \.plai-bubble\s*\{\s*display:\s*none/.test(siteCss), 'public auth pages must not hide PLAI');
  assert.ok(siteCss.includes('body.auth-full .plai-bubble'));

  const bubbleJs = read('plai-bubble.js');
  assert.ok(bubbleJs.includes("text: 'Talk to PLAI'"));
  assert.ok(bubbleJs.includes("text: 'Text PLAI'"));
  assert.ok(bubbleJs.includes("AGENT_ID = 'agent_BDVzp3Ar3ABtyov5'"));
  assert.ok(!bubbleJs.includes('XAI_API_KEY'));
  assert.ok(!/elevenlabs/i.test(bubbleJs));

  ['dashboard.html', 'faq.html', 'earnings.html', 'boosts.html', 'upload.html', 'settings.html'].forEach(function (file) {
    const html = read(file);
    assert.ok(html.includes('plai-bubble.js'), file + ' must load Talk/Text PLAI');
    assert.ok(html.includes('plai-bubble.css'), file + ' must style Talk/Text PLAI');
  });

  const boostsHtml = read('boosts.html');
  assert.ok(boostsHtml.includes('data-boost-state="available"'));
  assert.ok(boostsHtml.includes('data-boost-state="not-live"'));
  assert.ok(boostsHtml.includes('data-boost-state="active"'));
  assert.ok(boostsHtml.includes('data-boost-panel="not-live"'));
  assert.ok(boostsHtml.includes('data-boost-panel="active"'));
  assert.ok(boostsHtml.includes('boosts.js'));
  assert.ok(boostsHtml.includes('Song not live'));
  assert.ok(boostsHtml.includes('No boost is active'));

  const available = makeEl({ className: 'on', attrs: { 'data-boost-state': 'available' } });
  const notLive = makeEl({ attrs: { 'data-boost-state': 'not-live' } });
  const active = makeEl({ attrs: { 'data-boost-state': 'active' } });
  const host = makeEl({ attrs: { 'data-boost-states': '' } });
  const panels = {
    available: makeEl({ attrs: { 'data-boost-panel': 'available' } }),
    'not-live': makeEl({ hidden: true, attrs: { 'data-boost-panel': 'not-live' } }),
    active: makeEl({ hidden: true, attrs: { 'data-boost-panel': 'active' } }),
  };
  const boostCtx = {
    document: {
      querySelector(sel) {
        if (sel === '[data-boost-states]') return host;
        if (sel === '[data-boost-state].on') {
          if (available.classList.contains('on')) return available;
          if (notLive.classList.contains('on')) return notLive;
          if (active.classList.contains('on')) return active;
          return available;
        }
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '[data-boost-state]') return [available, notLive, active];
        if (sel === '[data-boost-panel]') return [panels.available, panels['not-live'], panels.active];
        return [];
      },
    },
    window: {},
  };
  boostCtx.window = boostCtx;
  vm.runInNewContext(read('boosts.js'), boostCtx);
  host.listeners.click({
    target: { closest: function () { return notLive; } },
    preventDefault: function () {},
  });
  assert.ok(notLive.classList.contains('on'), 'Song not live tab becomes selected');
  assert.ok(!available.classList.contains('on'), 'Available tab is no longer selected');
  assert.strictEqual(panels['not-live'].hidden, false, 'Song not live empty state shows');
  assert.strictEqual(panels.available.hidden, true, 'Available packages hide on Song not live');
  host.listeners.click({
    target: { closest: function () { return active; } },
    preventDefault: function () {},
  });
  assert.ok(active.classList.contains('on'), 'Boost active tab becomes selected');
  assert.strictEqual(panels.active.hidden, false, 'Boost active empty state shows');
  assert.strictEqual(panels['not-live'].hidden, true);

  const earningsHtml = read('earnings.html');
  assert.ok(earningsHtml.includes('data-earn-download'), 'Download statement has a handler hook');
  const earnNodes = {
    '[data-earn-metrics]': makeEl({}),
    '[data-earn="available"]': makeEl({ textContent: '$0.00' }),
    '[data-earn="pending"]': makeEl({ textContent: '$0.00' }),
    '[data-earn-sources]': makeEl({}),
    '[data-earn-period]': makeEl({}),
    '[data-earn-chart]': makeEl({ hidden: true }),
    '[data-earn-chart-bars]': makeEl({}),
    '[data-earn-chart-labels]': makeEl({}),
    '[data-earn-empty]': makeEl({ hidden: true }),
    '[data-earn-status]': makeEl({ hidden: true }),
    '[data-earn-download]': makeEl({}),
  };
  const earnCtx = {
    document: {
      querySelector(sel) { return earnNodes[sel] || null; },
      createElement: function () { return makeEl({}); },
      body: makeEl({}),
    },
    fetch: function () {
      return Promise.resolve({ ok: true, status: 200, json: async function () { return {}; } });
    },
    window: {},
  };
  earnCtx.window = earnCtx;
  vm.runInNewContext(read('earnings.js'), earnCtx);
  const emptyClick = earnCtx.PlaigroundEarnings.downloadStatement({
    balance: { available_usd: 0, pending_usd: 0 },
    statements: [],
    breakdown: [],
  });
  assert.strictEqual(emptyClick, false, 'empty earnings must not invent a CSV');
  assert.strictEqual(earnNodes['[data-earn-status]'].textContent, 'No statement yet');
  assert.strictEqual(earnNodes['[data-earn-empty]'].hidden, false);
  assert.ok(/No statement yet/.test(earnNodes['[data-earn-empty]'].textContent));
  assert.strictEqual(earnNodes['[data-earn="available"]'].textContent, '$0.00');
  const csv = earnCtx.PlaigroundEarnings.statementCsv({
    statements: [{ id: 'stmt_real', period: '2026-03', total_usd: 1.5 }],
    breakdown: [{ dsp: 'Spotify', streams: 12, revenue_usd: 1.5 }],
  });
  assert.ok(csv.indexOf('Spotify') !== -1);
  assert.ok(!/Patrick|John ham|John Doe/i.test(csv), 'statement CSV must not invent mock names');

  const boostHtml = read('boost.html');
  assert.ok(boostHtml.includes('membership.js'), 'boost.html can see a signed-in session');
  assert.ok(!/data-require-membership="true"/.test(boostHtml), 'boost.html must not dump signed-in users to login');
  const membership = read('membership.js');
  assert.ok(membership.includes('goSignedInBoosts'), 'signed-in boost.html redirects to boosts.html');
  assert.ok(membership.includes("file === 'boost.html'"));
  assert.ok(membership.includes("location.replace('boosts.html')"));

  ['dashboard.html', 'earnings.html', 'settings.html', 'releases.html', 'boosts.html'].forEach(function (file) {
    assert.ok(read(file).includes('href="boosts.html">Boosts</a>'), file + ' sidebar Boosts stays on signed-in boosts.html');
    assert.ok(read(file).indexOf('href="boost.html">Boosts</a>') === -1, file + ' sidebar must not land on the public tease');
  });

  console.log('creator-clickthrough.test.js ok');
}

run();
