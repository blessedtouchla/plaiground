'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('./destination.js');

function read(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8');
}

function readyPhrase(text) {
  var banned = 'when you' + String.fromCharCode(39) + 're ready';
  return text.toLowerCase().includes(banned) || text.toLowerCase().includes('when you are ready');
}

function ids(destination, level, pace) {
  return core.buildRoute(destination, level, pace).stops.map(function (stop) { return stop.id; });
}

function runRoutes() {
  const destinations = ['streams', 'profit', 'sync', 'press', 'playlists', 'fanbase'];
  const levels = ['starting', 'releases', 'momentum'];
  const paces = ['steady', 'fast'];
  const seen = new Set();

  destinations.forEach(function (destination) {
    levels.forEach(function (level) {
      paces.forEach(function (pace) {
        const route = core.buildRoute(destination, level, pace);
        assert.ok(route.stops.length >= 2, destination + ' ' + level + ' ' + pace);
        assert.strictEqual(route.shape, destination);
        route.stops.forEach(function (stop) {
          assert.ok(core.STOPS[stop.id], 'known stop ' + stop.id);
          if (stop.soon) assert.strictEqual(stop.href, '');
          else assert.ok(stop.href && stop.link, stop.id + ' links somewhere real');
        });
        const focus = route.stops.filter(function (stop) { return stop.focus; });
        assert.strictEqual(focus.length, 1);
        assert.strictEqual(focus[0].id, core.FOCUS[destination]);
        seen.add(ids(destination, level, pace).join(','));
        assert.ok(!readyPhrase(route.note));
        route.stops.forEach(function (stop) {
          assert.ok(!readyPhrase(stop.team + stop.title));
          assert.ok(!/\d/.test(stop.team), stop.id + ' copy has no numbers');
        });
      });
    });
  });

  assert.deepStrictEqual(ids('streams', 'starting', 'steady'), ['epk', 'song', 'distro', 'pitch']);
  assert.deepStrictEqual(ids('streams', 'starting', 'fast'), ['song', 'epk', 'distro', 'pitch']);
  assert.deepStrictEqual(ids('streams', 'releases', 'steady'), ['epk', 'song', 'pitch']);
  assert.ok(!ids('streams', 'releases', 'steady').includes('distro'));
  assert.ok(!ids('streams', 'momentum', 'fast').includes('distro'));

  assert.deepStrictEqual(ids('sync', 'starting', 'steady'), ['song', 'epk', 'sync']);
  assert.deepStrictEqual(ids('sync', 'starting', 'fast'), ['sync', 'song', 'epk']);
  assert.ok(!ids('sync', 'starting', 'steady').includes('distro'));
  assert.ok(!ids('sync', 'momentum', 'steady').includes('distro'));
  assert.notDeepStrictEqual(ids('streams', 'starting', 'steady'), ids('sync', 'starting', 'steady'));

  assert.ok(ids('playlists', 'starting', 'steady').includes('distro'));
  assert.strictEqual(ids('playlists', 'starting', 'fast')[0], 'pitch');
  assert.ok(ids('profit', 'starting', 'steady').includes('distro'));
  assert.strictEqual(ids('profit', 'starting', 'fast')[0], 'royalties');
  assert.ok(!ids('press', 'starting', 'steady').includes('distro'));
  assert.ok(ids('fanbase', 'starting', 'steady').includes('distro'));
  assert.ok(!ids('fanbase', 'momentum', 'steady').includes('distro'));
  assert.ok(!ids('profit', 'releases', 'fast').includes('distro'));

  const pitch = core.STOPS.pitch;
  assert.strictEqual(pitch.soon, true);
  assert.strictEqual(pitch.href, '');
  assert.strictEqual(core.STOPS.song.href, '/ar');
  assert.strictEqual(core.STOPS.epk.href, '/epk');
  assert.strictEqual(core.STOPS.sync.href, '/#pricing');
  assert.strictEqual(core.STOPS.distro.href, '/how-it-works.html#distribute');
  assert.strictEqual(core.STOPS.royalties.href, '/royalties.html');
  assert.strictEqual(core.STOPS.publishing.href, '/publishing.html');

  const href = core.signupHref('sync', 'momentum', 'fast');
  assert.strictEqual(href, 'signup.html?plan=basic&destination=sync&level=momentum&pace=fast');
  const record = core.planRecord(core.buildRoute('sync', 'momentum', 'fast'));
  assert.deepStrictEqual(record, {
    destination: 'sync',
    level: 'momentum',
    pace: 'fast',
    stops: ids('sync', 'momentum', 'fast')
  });
  assert.strictEqual(core.STORAGE_KEY, 'plaigroundDestinationPlan');
  assert.ok(seen.size > 12, 'routes are not one repeated list');

  const pathD = core.roadPath([{ x: 10, y: 10 }, { x: 80, y: 120 }, { x: 20, y: 240 }], 'streams', false);
  const syncD = core.roadPath([{ x: 10, y: 10 }, { x: 80, y: 120 }, { x: 20, y: 240 }], 'sync', false);
  assert.ok(pathD.indexOf('C ') !== -1);
  assert.notStrictEqual(pathD, syncD);
}

function runPage() {
  const html = read('destination.html');
  const css = read('destination.css');
  const js = read('destination.js');
  const vercel = JSON.parse(read('vercel.json'));
  const nav = html.match(/<nav class="nav-links"[\s\S]*?<\/nav>/)[0];
  const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
  const added = html + '\n' + css + '\n' + js;

  assert.ok(html.includes('name="robots" content="noindex, nofollow"'));
  assert.ok(html.includes('Where are you headed?'));
  assert.ok(html.includes('class="dest-tagline"'));
  assert.ok(html.includes('Activate Autopilot'));
  assert.strictEqual((html.match(/Autopilot/g) || []).length, 2, 'Autopilot stays on the tagline and the button');
  assert.ok(html.includes('A GPS for your music career. Autopilot covers the business side. People check the work.'));
  assert.ok(!/Autopilot/.test(css + js));
  assert.ok(!added.includes('\u2014'), 'no em dash');
  assert.ok(!readyPhrase(added));
  assert.ok(!/PLAIGROUND Autopilot/.test(added));
  assert.ok(!/\bAI music\b/i.test(html));
  assert.ok(!/destination\.html|\/destination/.test(nav + footer), 'this page does not link itself from nav or footer');
  assert.ok(html.includes('id="dest-go"'));
  assert.ok(html.includes('signup.html?plan=basic'));
  assert.ok(js.includes('plaigroundDestinationPlan'));
  assert.ok(js.includes("params.set('destination'"));
  assert.ok(js.includes("params.set('level'"));
  assert.ok(js.includes("params.set('pace'"));

  assert.ok((vercel.rewrites || []).some(function (row) {
    return row.source === '/destination' && row.destination === '/destination.html';
  }));
  assert.ok((vercel.headers || []).some(function (row) {
    return row.source === '/destination' && (row.headers || []).some(function (header) {
      return header.key === 'X-Robots-Tag' && /noindex/.test(header.value);
    });
  }));

  fs.readdirSync(__dirname).filter(function (name) { return name.endsWith('.html'); }).forEach(function (file) {
    if (file === 'destination.html') return;
    const page = read(file);
    assert.ok(!page.includes('href="/destination"') && !page.includes('destination.html'), file + ' must not link the destination page');
  });
  fs.readdirSync(__dirname).forEach(function (name) {
    if (!/sitemap/i.test(name)) return;
    assert.ok(!read(name).includes('destination'), name + ' must not list the destination page');
  });

  ['index.html', 'terms.html', 'privacy.html', 'rights.html'].forEach(function (file) {
    assert.ok(!read(file).includes('destination.html') && !read(file).includes('/destination'), file + ' stays clear');
  });
}

runRoutes();
runPage();
console.log('destination.test.js ok');
