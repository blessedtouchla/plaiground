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
  assert.deepStrictEqual(core.recommendedIds('idea', 'money'), ['helper', 'check', 'copyright', 'contracts', 'qualify', 'persona', 'publishing', 'royalties', 'sync']);
  assert.deepStrictEqual(core.recommendedIds('out', 'fanbase'), ['persona', 'pitch', 'marketing', 'check', 'copyright', 'contracts', 'qualify']);

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
  assert.deepStrictEqual(record.stops, ['marketing', 'pitch', 'copyright', 'contracts', 'qualify', 'sync', 'billboard']);
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
  assert.strictEqual(core.audienceLine({}), '');
  assert.strictEqual(core.audienceLine({ artistCount: 'nope', genres: ['Invented'] }), '');
  assert.strictEqual(core.audienceLine({ artistCount: '1' }), 'Plai built this for your 1 artist.');
  assert.strictEqual(core.audienceLine({ artistCount: '2-5', genres: ['Hip-Hop'] }), 'Plai built this for your 2 to 5 artists in Hip-Hop.');
  assert.strictEqual(core.audienceLine({ artistCount: '6+', genres: ['Hip-Hop', 'R&B/Soul'] }), 'Plai built this for your 6+ artists in Hip-Hop and R&B/Soul.');
  assert.strictEqual(core.audienceLine({ artistCount: 'label', genres: ['Electronic'], genreOther: 'shoegaze' }), 'Plai built this for your label or manager in Electronic and shoegaze.');
  assert.strictEqual(core.audienceLine({ genres: ['Pop', 'Rock', 'Jazz'] }), 'Plai built this for Pop, Rock, and Jazz.');
  assert.ok(!core.audienceLine({ artistCount: '2-5', genres: ['Hip-Hop'] }).includes('3 artists'));
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

  assert.strictEqual(core.STOPS.helper.status, 'live');
  assert.strictEqual(core.STOPS.helper.href, '/song-helper');
  assert.ok(!core.STOPS.helper.what.includes('until the writer connection is wired'));
  assert.strictEqual(core.STOPS.cover.status, 'live');
  assert.strictEqual(core.STOPS.cover.href, '/cover-art');
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
  assert.strictEqual(params.get('artistCount'), null);
  assert.strictEqual(params.get('genres'), null);

  const withArtists = new URLSearchParams(core.signupHref({
    song: 'made',
    goal: 'money',
    stops: ['check'],
    artistCount: '2-5',
    genres: ['Hip-Hop', 'Electronic'],
    genreOther: 'alt, folk'
  }).split('?')[1]);
  assert.strictEqual(withArtists.get('artistCount'), '2-5');
  assert.strictEqual(withArtists.get('genres'), 'Hip-Hop,Electronic,alt folk');
  assert.strictEqual(new URLSearchParams(core.signupHref({
    song: 'idea',
    goal: 'release',
    stops: [],
    artistCount: 'nope',
    genres: ['Invented']
  }).split('?')[1]).get('artistCount'), null);

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
  assert.deepStrictEqual(stored.stops, ['marketing', 'pitch', 'copyright', 'contracts', 'qualify', 'sync', 'billboard']);
  assert.deepStrictEqual(core.SECTIONS.map(function (section) { return section.label; }), [
    'Make it', 'Get ready', 'Protect it', 'Put it out', 'Get heard', 'Get paid', 'Run it'
  ]);
  const placed = {};
  core.SECTIONS.forEach(function (section) {
    section.stops.forEach(function (id) {
      assert.ok(core.STOPS[id], id);
      assert.ok(!placed[id], id + ' is in one section');
      placed[id] = section.id;
    });
  });
  core.STOP_ORDER.forEach(function (id) {
    assert.ok(placed[id], id + ' has a section');
  });
  assert.deepStrictEqual(placed.helper && placed.cover, 'make');
  assert.strictEqual(placed.check, 'ready');
  assert.strictEqual(placed.copyright, 'protect');
  assert.strictEqual(placed.contracts, 'protect');
  assert.strictEqual(placed.qualify, 'protect');
  assert.strictEqual(placed.claim, 'protect');
  assert.strictEqual(placed.guide, 'make');
  assert.strictEqual(placed.makehuman, 'ready');
  assert.strictEqual(placed.distro, 'put');
  assert.strictEqual(placed.persona, 'put');
  assert.strictEqual(placed.pitch, 'heard');
  assert.strictEqual(placed.marketing, 'heard');
  assert.strictEqual(placed.billboard, 'heard');
  assert.strictEqual(placed.royalties, 'paid');
  assert.strictEqual(placed.publishing, 'paid');
  assert.strictEqual(placed.sync, 'paid');
  assert.strictEqual(placed.shows, 'run');
  const ideaRoute = core.sectionsFor(core.recommendedIds('idea', 'release'));
  assert.deepStrictEqual(ideaRoute.map(function (section) { return section.id; }), ['make', 'ready', 'put', 'paid']);
  assert.deepStrictEqual(ideaRoute[0].stops, ['helper', 'cover']);
  assert.strictEqual(core.openSectionId('idea', 'release', core.recommendedIds('idea', 'release')), 'make');
  assert.strictEqual(core.openSectionId('made', 'release', core.KITS.release.stops), 'ready');
  assert.strictEqual(core.openSectionId('out', 'fanbase', core.KITS.record.stops), 'heard');
  assert.strictEqual(core.openSectionId('out', 'money', core.recommendedIds('out', 'money')), 'paid');
  assert.strictEqual(stored.kit, 'record');
  assert.strictEqual(stored.note, 'city');
  assert.strictEqual(stored.managed, false);
  assert.strictEqual(stored.artistCount, '');
  assert.deepStrictEqual(stored.genres, []);
  const withCount = core.planRecord({
    song: 'made',
    goal: 'fanbase',
    stops: ['persona'],
    artistCount: 'label',
    genres: ['Pop', 'Pop'],
    genreOther: '  bedroom pop  '
  });
  assert.strictEqual(withCount.artistCount, 'label');
  assert.deepStrictEqual(withCount.genres, ['Pop', 'bedroom pop']);

  const pathD = core.roadPath([{ x: 10, y: 10 }, { x: 80, y: 120 }, { x: 20, y: 240 }], 'route', false);
  assert.ok(pathD.indexOf('C ') !== -1);
  assert.strictEqual(core.roadPath([{ x: 1, y: 1 }], 'route', true), '');
}

function runPage() {
  const html = read('destination.html');
  const css = read('destination.css');
  const js = read('destination.js');
  assert.ok(js.includes('data-section-toggle'));
  assert.ok(js.includes('sectionsFor'));
  const vercel = JSON.parse(read('vercel.json'));
  const nav = html.match(/<nav class="nav-links"[\s\S]*?<\/nav>/)[0];
  const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
  const added = html + '\n' + css + '\n' + js;

  assert.ok(!/name="robots"/i.test(html), 'destination has no robots meta');
  assert.ok(!/noindex|nofollow/i.test(html), 'destination is indexable');
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
  assert.ok(html.includes('id="dest-for"'));
  assert.ok(html.includes('id="dest-drawer-for"'));
  assert.ok(js.includes('audienceLine'));
  assert.ok(html.includes('How many artists?'));
  assert.ok(html.includes('data-count="1"'));
  assert.ok(html.includes('data-count="2-5"'));
  assert.ok(html.includes('data-count="6+"'));
  assert.ok(html.includes('data-count="label"'));
  assert.ok(html.includes('Label/manager'));
  assert.ok(html.includes('id="dest-genre-other"'));
  assert.ok(html.includes('data-genre="Hip-Hop"'));
  assert.ok(html.includes('data-genre="R&amp;B/Soul"'));
  assert.ok(js.includes("params.set('artistCount'"));
  assert.ok(js.includes("params.set('genres'"));
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
  assert.ok(/data-nav-group="roadmap"[\s\S]*href="\/destination">Roadmap<\/a>/.test(nav), 'Roadmap is the public nav link to /destination');
  assert.ok(nav.indexOf('data-nav-group="roadmap"') < nav.indexOf('data-nav-group="product"'), 'Roadmap is the first public nav item');
  assert.ok(!/href="\/destination"/.test(footer), 'footer does not grow a destination link');
  assert.ok(html.includes('id="dest-go"'));
  assert.ok(html.includes('signup.html?plan=basic'));
  assert.ok(html.includes('id="dest-save"'));
  assert.ok(html.includes('Sign up free to save your roadmap'));
  assert.ok(html.includes('Already have an account? <a id="dest-save-login" href="/login">Sign in</a>'));
  assert.ok(html.includes('id="dest-saved"'));
  assert.ok(/<script src="membership\.js"><\/script>/.test(html), 'Edit route reads the live session');
  assert.ok(!/script src="membership\.js"[^>]*data-require-membership/.test(html), 'guests can still build a route without a login bounce');
  assert.ok(html.indexOf('src="membership.js"') < html.indexOf('src="destination.js'), 'session probe is ready before the route mounts');
  assert.ok(html.includes('src="account.js"'));
  assert.ok(html.includes('<aside class="side" hidden>'));
  assert.ok(html.includes('<div class="topbar" hidden>'));
  assert.ok(js.includes('signedInFromProbe'));
  assert.ok(js.includes('planForEdit'));
  assert.ok(js.includes('editRequested'));
  assert.strictEqual(core.signedInFromProbe({ ok: true }, false), true);
  assert.strictEqual(core.signedInFromProbe(null, true), true, 'a session cookie still counts when /api/me has not answered');
  assert.strictEqual(core.signedInFromProbe(null, false), false, 'missing membership must not be treated as a session');
  assert.strictEqual(core.signedInFromProbe({ ok: false, status: 401 }, false), false);
  const savedPlan = { song: 'made', goal: 'money', stops: ['check'] };
  const staleLocal = { song: 'idea', goal: 'release', stops: ['helper'] };
  assert.strictEqual(core.planForEdit({ plan: savedPlan }, staleLocal), savedPlan, 'Edit opens the account roadmap, not a stale local draft');
  assert.strictEqual(core.planForEdit(null, staleLocal), staleLocal);
  assert.strictEqual(core.planForEdit({ plan: null }, null), null);
  assert.strictEqual(core.editRequested('?edit=1'), true);
  assert.strictEqual(core.editRequested('edit=1'), true);
  assert.strictEqual(core.editRequested(''), false);
  assert.ok(js.includes("go.setAttribute('href', showSaved ? '/my-roadmap' : href)"));
  assert.ok(!/<a[^>]+href="https?:\/\/(?:www\.)?wannaplai\.com\/destination/.test(html), 'Edit stays on the current host');
  assert.ok(js.includes('persistAccount'));
  assert.ok(js.includes('applySavedPlan'));
  assert.ok(js.includes('/my-roadmap'));
  assert.ok(html.includes('avatar-scout'));
  assert.ok(html.includes('avatar-plai'));
  assert.ok(html.includes('assets/plai-avatar.png'));

  assert.ok((vercel.rewrites || []).some(function (row) {
    return row.source === '/destination' && row.destination === '/destination.html';
  }));
  function apexTo(source, destination) {
    assert.ok((vercel.redirects || []).some(function (row) {
      return row.source === source
        && row.destination === destination
        && row.permanent === true
        && (row.has || []).some(function (rule) {
          return rule.type === 'host' && rule.value === 'wannaplai.com';
        });
    }), source + ' on the apex must land on www so the session cookie stays with the edit page');
  }
  apexTo('/destination', 'https://www.wannaplai.com/destination');
  apexTo('/destination/', 'https://www.wannaplai.com/destination');
  apexTo('/my-roadmap', 'https://www.wannaplai.com/my-roadmap');
  apexTo('/my-roadmap/', 'https://www.wannaplai.com/my-roadmap');
  apexTo('/song-helper', 'https://www.wannaplai.com/song-helper');
  apexTo('/song-helper/', 'https://www.wannaplai.com/song-helper');
  apexTo('/battle', 'https://www.wannaplai.com/battle');
  apexTo('/battle/', 'https://www.wannaplai.com/battle');
  apexTo('/my-lyrics', 'https://www.wannaplai.com/my-lyrics');
  apexTo('/my-lyrics/', 'https://www.wannaplai.com/my-lyrics');
  ['/destination', '/destination/', '/destination.html'].forEach(function (source) {
    assert.ok(!(vercel.headers || []).some(function (row) {
      return row.source === source && (row.headers || []).some(function (header) {
        return header.key === 'X-Robots-Tag' && /noindex|nofollow/i.test(header.value);
      });
    }), source + ' must not send a noindex robots header');
  });

  fs.readdirSync(__dirname).filter(function (name) { return name.endsWith('.html'); }).forEach(function (file) {
    const page = read(file);
    const pageNav = page.match(/<nav class="nav-links"[\s\S]*?<\/nav>/);
    if (pageNav) {
      assert.ok(/href="\/destination">Roadmap<\/a>/.test(pageNav[0]), file + ' public nav links Roadmap to /destination');
    }
    const sideNav = page.match(/<nav class="side-nav"[\s\S]*?<\/nav>/);
    if (sideNav && /class="side-label">Create</.test(sideNav[0])) {
      assert.ok(/<nav class="side-nav"[^>]*>\s*<a href="\/destination">Roadmap<\/a>/.test(sideNav[0]), file + ' signed-in nav leads with Roadmap');
    }
  });
  fs.readdirSync(__dirname).forEach(function (name) {
    if (!/sitemap/i.test(name)) return;
    const sitemap = read(name);
    assert.ok(/\/destination\b/.test(sitemap), name + ' lists /destination');
  });
  if (fs.existsSync(path.join(__dirname, 'robots.txt'))) {
    const robots = read('robots.txt');
    assert.ok(!/Disallow:\s*\/destination\b/i.test(robots), 'robots.txt must not block /destination');
  }

  const home = read('index.html');
  const hero = home.match(/<section class="hero"[\s\S]*?<\/section>/)[0];
  assert.ok(/class="btn btn-gold btn-md" href="signup\.html">Join free</.test(hero), 'homepage primary CTA is Join free');
  assert.ok(/href="\/destination">Build your roadmap</.test(hero), 'roadmap stays a secondary link');
  assert.ok(!/class="btn btn-gold[^"]*" href="\/destination"/.test(hero), 'roadmap is not a second gold primary');
}

runRoutes();
runPage();
console.log('destination.test.js ok');
