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

function runRoutes() {
  const songs = ['idea', 'made', 'out'];
  const goals = ['money', 'fanbase', 'release'];

  songs.forEach(function (song) {
    const lists = goals.map(function (goal) { return core.recommendedIds(song, goal).join(','); });
    assert.notStrictEqual(lists[0], lists[1], song);
    assert.notStrictEqual(lists[1], lists[2], song);
    assert.notStrictEqual(lists[0], lists[2], song);
    goals.forEach(function (goal) {
      const ids = core.recommendedIds(song, goal);
      assert.ok(ids.length >= 3, song + ' ' + goal);
      ids.forEach(function (id) { assert.ok(core.STOPS[id], id); });
      const line = core.headline(song, goal);
      assert.ok(line.indexOf(core.GOALS[goal].label) !== -1);
      assert.ok(line.indexOf(core.SONGS[song].from) !== -1);
      assert.ok(!readyPhrase(line));
    });
  });

  assert.notStrictEqual(core.recommendedIds('idea', 'money').join(), core.recommendedIds('made', 'money').join());
  assert.notStrictEqual(core.recommendedIds('made', 'money').join(), core.recommendedIds('out', 'money').join());

  assert.deepStrictEqual(core.recommendedIds('made', 'release'), ['persona', 'check', 'cover', 'distro']);
  assert.deepStrictEqual(core.recommendedIds('idea', 'money'), ['helper', 'check', 'persona', 'publishing', 'royalties', 'sync']);
  assert.deepStrictEqual(core.recommendedIds('out', 'fanbase'), ['persona', 'pitch', 'marketing', 'check']);

  goals.forEach(function (goal) {
    assert.ok(core.recommendedIds('idea', goal).includes('helper'), goal);
    assert.ok(!core.recommendedIds('made', goal).includes('helper'));
    assert.ok(!core.recommendedIds('out', goal).includes('helper'));
    assert.ok(!core.recommendedIds('out', goal).includes('distro'), goal);
  });
  assert.ok(core.recommendedIds('idea', 'release').includes('distro'));
  assert.ok(core.recommendedIds('made', 'fanbase').includes('distro'));
  assert.ok(!core.recommendedIds('idea', 'money').includes('distro'));

  const release = core.applyKit('release', 'idea', 'money');
  assert.deepStrictEqual(release.stops, ['persona', 'check', 'cover', 'distro']);
  assert.strictEqual(release.song, 'made');
  assert.strictEqual(release.goal, 'release');
  assert.strictEqual(release.total, 'Free to start');
  assert.strictEqual(release.managed, false);

  const record = core.applyKit('record', 'made', 'release');
  assert.deepStrictEqual(record.stops, ['marketing', 'pitch', 'sync', 'billboard']);
  assert.strictEqual(record.song, 'out');
  assert.ok(core.headsUp(record.stops, record.song, record.goal).indexOf('Sync pitching needs splits registered first.') !== -1);

  const managed = core.applyKit('management', 'made', 'money');
  assert.ok(managed.stops.indexOf('shows') === managed.stops.length - 1);
  assert.ok(managed.stops.indexOf('publishing') !== -1);
  assert.ok(managed.stops.indexOf('sync') !== -1);
  assert.strictEqual(managed.total, 'By application');
  assert.strictEqual(managed.managed, true);
  assert.strictEqual(managed.song, 'made');
  assert.strictEqual(managed.goal, 'money');

  assert.deepStrictEqual(core.headsUp(core.recommendedIds('made', 'money'), 'made', 'money'), []);
  assert.ok(core.headsUp(['sync'], 'out', 'money').indexOf('Sync pitching needs splits registered first.') !== -1);
  const trimmed = core.headsUp(['helper', 'persona'], 'idea', 'release');
  assert.ok(trimmed.indexOf('Distribution is how this song gets to the stores.') !== -1);
  assert.ok(trimmed.indexOf('A song check is how the release stays honest.') !== -1);
  assert.deepStrictEqual(core.headsUp(['persona'], 'out', 'fanbase'), []);

  assert.strictEqual(core.headline('made', 'money'), "For Make money, starting from a made song, here's your route.");
  assert.strictEqual(core.packageTotal(false), 'Free to start');
  assert.strictEqual(core.packageTotal(true), 'By application');

  Object.keys(core.STOPS).forEach(function (id) {
    const stop = core.STOPS[id];
    assert.ok(core.STATUS[stop.status], id + ' status');
    if (stop.status === 'live') assert.ok(stop.href, id + ' live link');
    else assert.strictEqual(stop.href, '', id + ' has no live link');
    ['what', 'get', 'who'].concat(['money', 'fanbase', 'release'].map(function (goal) { return stop.why[goal]; })).forEach(function (line) {
      const text = typeof line === 'string' ? line : stop.why[line] || line;
      assert.strictEqual(typeof text, 'string');
    });
    const blob = [stop.what, stop.get, stop.who, stop.title, stop.why.money, stop.why.fanbase, stop.why.release].join(' ');
    assert.ok(!blob.includes('$'), id + ' has no price');
    assert.ok(!/\d/.test(blob), id + ' copy has no numbers');
    assert.ok(!readyPhrase(blob), id);
    assert.ok(!blob.toLowerCase().includes('when you want it'), id);
    assert.ok(!blob.includes('\u2014'), id);
  });

  assert.strictEqual(core.STOPS.helper.status, 'soon');
  assert.ok(core.STOPS.helper.what.includes('until the writer connection is wired'));
  assert.strictEqual(core.STOPS.cover.status, 'soon');
  assert.ok(/themes/i.test(core.STOPS.cover.what));
  assert.strictEqual(core.STOPS.check.href, '/ar');
  assert.strictEqual(core.STOPS.persona.href, '/epk');
  assert.strictEqual(core.STOPS.distro.href, '/how-it-works.html#distribute');
  assert.strictEqual(core.STOPS.royalties.href, '/royalties.html');
  assert.strictEqual(core.STOPS.publishing.href, '/publishing.html');
  assert.strictEqual(core.STOPS.sync.href, '/#pricing');
  assert.ok(core.STOPS.sync.what.includes('No placement promise'));
  assert.strictEqual(core.STOPS.pitch.status, 'soon');
  assert.strictEqual(core.STOPS.pitch.href, '');
  assert.strictEqual(core.STOPS.marketing.status, 'soon');
  assert.strictEqual(core.STOPS.multiverse.status, 'soon');
  assert.ok(/several genres/i.test(core.STOPS.multiverse.what));
  assert.strictEqual(core.STOPS.billboard.status, 'ask');
  assert.strictEqual(core.STATUS.ask, 'Ask us');
  assert.ok(/Times Square/.test(core.STOPS.billboard.what));
  assert.strictEqual(core.STOPS.shows.status, 'apply');
  assert.strictEqual(core.STATUS.apply, 'By application');
  assert.ok(/HW team/.test(core.STOPS.shows.who));
  assert.ok(/People, not a bot/.test(core.STOPS.billboard.who));

  const sync = core.explain('sync', 'money');
  assert.strictEqual(sync.statusLabel, 'Live');
  assert.ok(sync.why.includes('earn'));
  assert.strictEqual(core.explain('missing', 'money'), null);

  const href = core.signupHref({
    song: 'made',
    goal: 'money',
    stops: ['check', 'sync'],
    note: 'rap in LA',
    kit: ''
  });
  const params = new URLSearchParams(href.split('?')[1]);
  assert.strictEqual(params.get('plan'), 'basic');
  assert.strictEqual(params.get('song'), 'made');
  assert.strictEqual(params.get('goal'), 'money');
  assert.strictEqual(params.get('stops'), 'check,sync');
  assert.strictEqual(params.get('note'), 'rap in LA');
  assert.strictEqual(params.get('kit'), null);

  const longNote = 'a'.repeat(300);
  const capped = new URLSearchParams(core.signupHref({
    song: 'idea',
    goal: 'release',
    stops: ['helper'],
    note: longNote,
    kit: 'release'
  }).split('?')[1]);
  assert.strictEqual(capped.get('note').length, 240);
  assert.strictEqual(capped.get('kit'), 'release');

  const recordPlan = core.planRecord(core.applyKit('record', 'idea', 'fanbase'));
  recordPlan.note = 'city';
  const stored = core.planRecord(recordPlan);
  assert.strictEqual(core.STORAGE_KEY, 'plaigroundDestinationPlan');
  assert.deepStrictEqual(stored.stops, ['marketing', 'pitch', 'sync', 'billboard']);
  assert.strictEqual(stored.kit, 'record');
  assert.strictEqual(stored.note, 'city');
  assert.strictEqual(stored.managed, false);

  const pathD = core.roadPath([{ x: 10, y: 10 }, { x: 80, y: 120 }, { x: 20, y: 240 }], 'route', false);
  assert.ok(pathD.indexOf('C ') !== -1);
  assert.strictEqual(core.roadPath([{ x: 1, y: 1 }], 'route', true), '');
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
  assert.ok(html.includes("Where's your song?"));
  assert.ok(html.includes('Where do you want to go?'));
  assert.ok(html.includes('Just an idea'));
  assert.ok(html.includes("It's made"));
  assert.ok(html.includes("It's out"));
  assert.ok(html.includes('Make money'));
  assert.ok(html.includes('Build a fanbase'));
  assert.ok(html.includes('Just release it right'));
  assert.ok(html.includes('Tell Plai about you'));
  assert.ok(html.includes('Edit route'));
  assert.ok(html.includes('Add to your route'));
  assert.ok(html.includes('Release Kit'));
  assert.ok(html.includes('Break Your Record'));
  assert.ok(html.includes('Management'));
  assert.ok(html.includes('Free to start'));
  assert.ok(html.includes('By application'));
  assert.ok(html.includes('Activate Autopilot'));
  assert.strictEqual((html.match(/Autopilot/g) || []).length, 1);
  assert.ok(!/Autopilot/.test(css + js));
  assert.ok(html.includes('People check the work'));
  assert.ok(/checked by people/i.test(html));
  assert.ok(html.includes('id="dest-drawer"'));
  assert.ok(html.includes('id="dest-edit"'));
  assert.ok(html.includes('id="dest-about"'));
  assert.ok(js.includes('Recommended for your goal'));
  assert.ok(js.includes('plaigroundDestinationPlan'));
  assert.ok(js.includes("params.set('song'"));
  assert.ok(js.includes("params.set('goal'"));
  assert.ok(js.includes("params.set('stops'"));
  assert.ok(js.includes("params.set('note'"));
  assert.ok(!added.includes('\u2014'), 'no em dash');
  assert.ok(!readyPhrase(added));
  assert.ok(!/when you want it/i.test(added));
  assert.ok(!/PLAIGROUND Autopilot/.test(added));
  assert.ok(!/\$/.test(added), 'no dollar amounts');
  assert.ok(!/\bAI music\b/i.test(html));
  assert.ok(!/destination\.html|\/destination/.test(nav + footer), 'this page does not link itself from nav or footer');
  assert.ok(html.includes('id="dest-go"'));
  assert.ok(html.includes('signup.html?plan=basic'));
  assert.ok(html.includes('avatar-scout'));
  assert.ok(html.includes('avatar-plai'));
  assert.ok(html.includes('assets/plai-avatar.png'));

  assert.ok((vercel.rewrites || []).some(function (row) {
    return row.source === '/destination' && row.destination === '/destination.html';
  }));
  assert.ok((vercel.headers || []).some(function (row) {
    return row.source === '/destination' && (row.headers || []).some(function (header) {
      return header.key === 'X-Robots-Tag' && /noindex/.test(header.value) && /nofollow/.test(header.value);
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
