'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, rel), 'utf8');
}

function guest(html) {
  const start = html.indexOf('data-guest-home');
  const end = html.indexOf('<section class="hero">', start);
  return html.slice(start, end);
}

function runHomeTry(opts) {
  const events = [];
  const form = {
    attrs: opts.attrs || {},
    getAttribute(name) { return this.attrs[name] || ''; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    listeners: {}
  };
  const field = { value: opts.idea || 'a night bus', focus() {} };
  const marked = (opts.marked || []).map(function (node) {
    return {
      attrs: Object.assign({}, node),
      getAttribute(name) { return this.attrs[name] || ''; },
      setAttribute(name, value) { this.attrs[name] = value; }
    };
  });
  const context = {
    document: {
      body: { classList: { toggle() {} } },
      getElementById(id) {
        if (id === 'try-it') return form;
        if (id === 'try-idea') return field;
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '[data-track]') return marked;
        return [];
      },
      addEventListener() {}
    },
    URLSearchParams: URLSearchParams,
    location: { search: opts.search || '', href: '' },
    PlaigroundAnalytics: {
      track(name, data) { events.push({ name: name, data: data }); }
    }
  };
  context.window = context;
  vm.runInNewContext(read('home-try.js'), context, { filename: 'home-try.js' });
  return { events: events, form: form, marked: marked, location: context.location };
}

function runLoader(opts) {
  const timeouts = [];
  const body = {
    classList: {
      tokens: opts.energy ? { 'graffiti-energy': true } : {},
      contains(name) { return Boolean(this.tokens[name]); }
    },
    appendChild(node) { this.last = node; }
  };
  const context = {
    document: {
      body: body,
      readyState: 'complete',
      querySelector() { return null; },
      createElement() {
        return {
          style: { setProperty() {} },
          setAttribute() {},
          appendChild() {}
        };
      },
      addEventListener() {}
    },
    navigator: { connection: opts.connection || null },
    location: { search: opts.search || '' },
    matchMedia(query) {
      return { matches: Boolean(opts.reduce) && String(query).indexOf('reduce') !== -1 };
    },
    URLSearchParams: URLSearchParams,
    setTimeout(fn, ms) { timeouts.push(ms); }
  };
  context.window = context;
  vm.runInNewContext(read('graffiti-loader.js'), context, { filename: 'graffiti-loader.js' });
  return { body: body, timeouts: timeouts };
}

function run() {
  const map = require('./analytics-map');
  const countries = JSON.parse(read('assets/world-countries.json'));
  ['US', 'NG', 'BR', 'JP', 'DE', 'GB'].forEach(function (iso) {
    assert.ok(countries.some(function (row) { return row.iso === iso && row.d; }), 'map path ' + iso);
  });

  const empty = map.summarize({ territories: [], dsps: [] }, countries, { paid: true, ready: true });
  assert.strictEqual(empty.note, 'Your map lights up as your songs get played');
  assert.strictEqual(Object.keys(empty.litCountries).length, 0);
  assert.strictEqual(Object.keys(empty.litStores).length, 0);
  assert.ok(!empty.litCountries.FR);

  const lit = map.summarize({
    territories: [
      { territory: 'US', country_name: 'United States', streams: 12 },
      { territory: 'NG', country_name: 'Nigeria', streams: 4 },
      { country_name: 'United Kingdom', streams: 2 },
      { country_name: 'Brazil', streams: 0 },
      { country_name: 'Sao Paulo', streams: 3 }
    ],
    dsps: [
      { dsp: 'Spotify', streams: 10 },
      { dsp: 'Deezer', streams: 0 },
      { dsp: 'YouTube Music', streams: 2 },
      { dsp: 'YouTube', streams: 1 },
      { dsp: 'Apple Music', streams: 0 },
      { dsp: 'Amazon', streams: 5 },
      { dsp: 'TikTok', streams: 0, live: true }
    ]
  }, countries, { paid: true, ready: true });
  assert.ok(lit.litCountries.US, 'United States lights');
  assert.ok(lit.litCountries.NG, 'Nigeria lights');
  assert.ok(lit.litCountries.GB, 'United Kingdom lights');
  assert.ok(!lit.litCountries.BR, 'a country with no streams stays dark');
  assert.ok(!lit.litCountries.FR, 'a country with no row stays dark');
  assert.ok(lit.unmatched.indexOf('Sao Paulo') !== -1);
  assert.ok(lit.litStores.spotify);
  assert.ok(lit.litStores['youtube-music']);
  assert.ok(lit.litStores['amazon-music']);
  assert.ok(lit.litStores.tiktok, 'a live store with no streams still lights');
  assert.ok(!lit.litStores.deezer);
  assert.ok(!lit.litStores['apple-music']);
  assert.ok(lit.extras.some(function (store) { return store.label === 'YouTube'; }));
  assert.ok(!lit.extras.some(function (store) { return store.label === 'YouTube Music'; }));
  assert.strictEqual(lit.note, '');
  map.STORES.forEach(function (store) {
    assert.ok(store.label.indexOf('Spotiy') === -1);
    assert.strictEqual(store.label, store.label.trim());
  });

  const locked = map.summarize({
    territories: [{ territory: 'US', streams: 9 }],
    dsps: [{ dsp: 'Spotify', streams: 9 }]
  }, countries, { paid: false, ready: true });
  assert.strictEqual(locked.note, 'Location breakdown shows when stores send it.');
  assert.strictEqual(Object.keys(locked.litCountries).length, 0);
  assert.strictEqual(Object.keys(locked.litStores).length, 0);

  const analytics = read('analytics.html');
  assert.ok(analytics.includes('data-analytics-map'));
  assert.ok(analytics.includes('Your map lights up as your songs get played'));
  assert.ok(analytics.includes('analytics-map.js'));
  assert.ok(analytics.includes('>PLAIGROUND</p>'));

  const artists = read('artists.html');
  assert.ok(artists.includes('class="app artists-page"'));
  assert.ok(artists.includes('<html lang="en" class="graffiti-energy">'));
  assert.ok(artists.includes('/graffiti.css'));
  assert.ok(artists.includes('/graffiti-loader.js'));
  assert.ok(read('song-helper.html').includes('<html lang="en" class="graffiti-energy">'));
  assert.ok(read('song-helper.html').includes('class="song-helper-page"'));
  assert.ok(read('play.html').includes('<html lang="en" class="graffiti-energy">'));
  assert.ok(read('play.html').includes('class="play-page"'));
  assert.ok(read('epk-live.js').includes("classList.add('graffiti-energy')"));
  const epk = read('epk.html');
  assert.ok(epk.includes('/graffiti.css'));
  assert.ok((epk.match(/>Apply free</g) || []).length >= 4, 'EPK Apply free wording stays');

  const loaderCss = read('graffiti.css');
  assert.ok(loaderCss.includes('pointer-events: none'));
  assert.ok(loaderCss.includes('animation: melt-fade 1.4s linear forwards'));
  assert.ok(loaderCss.includes('prefers-reduced-motion: reduce'));
  assert.ok(loaderCss.includes('/assets/plaiground-logo.png') === false);
  assert.ok(read('graffiti-loader.js').includes('/assets/plaiground-logo.png'));
  assert.ok(read('graffiti-loader.js').includes('1400'));
  assert.ok(read('graffiti-loader.js').includes('saveData'));
  assert.ok(read('graffiti-loader.js').includes('slow-2g'));

  const shown = runLoader({ energy: true });
  assert.strictEqual(shown.body.last.className, 'graffiti-loader');
  assert.deepStrictEqual(shown.timeouts, [1400]);
  assert.strictEqual(runLoader({ energy: true, reduce: true }).body.last, undefined);
  assert.strictEqual(runLoader({ energy: true, connection: { saveData: true } }).body.last, undefined);
  assert.strictEqual(runLoader({ energy: true, connection: { effectiveType: '2g' } }).body.last, undefined);
  const fast = runLoader({ energy: true, connection: { effectiveType: '3g' } });
  assert.strictEqual(fast.body.last.className, 'graffiti-loader');
  const held = runLoader({ energy: true, search: '?melt=0.4' });
  assert.strictEqual(held.body.last.className, 'graffiti-loader is-hold');
  assert.strictEqual(held.timeouts.length, 0);

  const index = read('index.html');
  const block = guest(index);
  assert.ok(block.includes('assets/photos/studio-headphones.jpg'));
  assert.ok(block.includes('assets/photos/vocals-session.jpg'));
  assert.ok(/What's your song about\?/.test(block));
  assert.ok(block.includes('id="try-it"'));
  assert.ok(/class="login public-header-login" href="login.html">Log in</.test(index));
  assert.ok(!/220\+|50\+ countries|guaranteed income|get rich|instantly/i.test(block));
  assert.ok(index.includes('>Apply free</button>'));

  const lp = read('lp/index.html');
  assert.ok(/noindex,\s*nofollow/.test(lp));
  assert.ok(lp.includes('data-funnel-surface="lp"'));
  assert.ok(lp.includes('data-funnel-variant="a"'));
  assert.ok(/What's your song about\?/.test(lp));
  assert.ok(lp.includes('id="try-it"'));
  assert.ok(lp.includes('>Log in</a>'));
  assert.ok(lp.includes('/assets/photos/vocal-booth.jpg'));
  assert.ok(!/220\+|50\+ countries|guaranteed income|get rich|instantly/i.test(lp));
  assert.ok(!/\$\d/.test(lp), 'the landing template does not invent a price');
  assert.ok(!read('sitemap.xml').includes('/lp'));
  assert.ok(!read('vercel.json').includes('"/lp'));

  const home = runHomeTry({});
  assert.strictEqual(home.events.length, 0);
  home.form.listeners.submit({ preventDefault() {} });
  assert.strictEqual(home.events[0].name, 'try_it_submit');
  assert.strictEqual(home.events[0].data.surface, 'homepage');
  assert.strictEqual(home.events[0].data.variant, undefined);

  const landing = runHomeTry({
    search: '?variant=b',
    attrs: { 'data-funnel-surface': 'lp', 'data-funnel-variant': 'a' },
    marked: [{ 'data-track': 'primary_cta' }]
  });
  assert.strictEqual(landing.events[0].name, 'lp_view');
  assert.strictEqual(landing.events[0].data.variant, 'b');
  assert.strictEqual(landing.marked[0].attrs['data-track-variant'], 'b');
  landing.form.listeners.submit({ preventDefault() {} });
  assert.strictEqual(landing.events[1].name, 'try_it_submit');
  assert.strictEqual(landing.events[1].data.surface, 'lp');
  assert.strictEqual(landing.events[1].data.variant, 'b');

  const credits = read('docs/photo-credits.md');
  assert.ok(/Pexels License/.test(credits));
  assert.ok(credits.includes('Anna Pou'));
  assert.ok(credits.includes('cottonbro studio'));
  assert.ok(/Natural Earth/.test(credits));
  ['assets/photos/studio-headphones.jpg', 'assets/photos/vocals-session.jpg', 'assets/photos/vocal-booth.jpg'].forEach(function (file) {
    assert.ok(fs.existsSync(path.join(__dirname, file)), file);
  });
  assert.ok(fs.existsSync(path.join(__dirname, 'assets/plaiground-logo.png')));

  const funnel = read('funnel-analytics.js');
  assert.ok(funnel.includes('lp_view: 1'));
  assert.ok(funnel.includes('variant: 1'));
  assert.ok(read('docs/web-analytics.md').includes('`lp_view`'));
  assert.ok(read('docs/web-analytics.md').includes('variant'));

  console.log('design-pass.test.js ok');
}

run();
