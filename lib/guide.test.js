const assert = require('assert');
const fs = require('fs');
const path = require('path');
const destination = require('../destination');
const guide = require('./guide');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

function memory() {
  const data = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); }
  };
}

const ideaRelease = guide.routeFor({ song: 'idea', want: 'release' });
assert.strictEqual(ideaRelease.song, 'idea');
assert.strictEqual(ideaRelease.goal, 'release');
assert.strictEqual(ideaRelease.kit, '');
assert.deepStrictEqual(ideaRelease.stops, destination.recommendedIds('idea', 'release'));
assert.strictEqual(ideaRelease.firstStop, 'helper');
assert.strictEqual(ideaRelease.firstHref, '/song-helper');
assert.strictEqual(ideaRelease.artistCount, '1');

const madeRelease = guide.routeFor({ song: 'made', want: 'release' });
assert.strictEqual(madeRelease.kit, 'release');
assert.strictEqual(madeRelease.song, 'made');
assert.strictEqual(madeRelease.goal, 'release');
assert.deepStrictEqual(madeRelease.stops, destination.KITS.release.stops);
assert.strictEqual(madeRelease.firstHref, '/epk');

const outHeard = guide.routeFor({ song: 'out', want: 'heard' });
assert.strictEqual(outHeard.kit, 'record');
assert.strictEqual(outHeard.song, 'out');
assert.strictEqual(outHeard.goal, 'fanbase');
assert.deepStrictEqual(outHeard.stops, destination.KITS.record.stops);

const ideaHeard = guide.routeFor({ song: 'idea', want: 'heard' });
assert.strictEqual(ideaHeard.kit, '');
assert.deepStrictEqual(ideaHeard.stops, destination.recommendedIds('idea', 'fanbase'));
assert.strictEqual(ideaHeard.firstHref, '/song-helper');

const paid = guide.routeFor({ song: 'made', want: 'paid' });
assert.strictEqual(paid.goal, 'money');
assert.strictEqual(paid.kit, '');
assert.deepStrictEqual(paid.stops, destination.recommendedIds('made', 'money'));

const team = guide.routeFor({ song: 'out', want: 'team' });
assert.strictEqual(team.kit, 'management');
assert.strictEqual(team.managed, true);
assert.strictEqual(team.song, 'out');
assert.strictEqual(team.goal, 'fanbase');
assert.strictEqual(team.artistCount, '1');
assert.ok(team.stops.indexOf('shows') !== -1);
assert.deepStrictEqual(team.stops, destination.applyKit('management', 'out', 'fanbase').stops);
const saved = destination.planRecord(team);
assert.strictEqual(saved.song, 'out');
assert.strictEqual(saved.kit, 'management');
assert.strictEqual(saved.artistCount, '1');
assert.strictEqual(saved.note, '');

const store = memory();
assert.strictEqual(guide.isDone(store), false);
assert.strictEqual(guide.hrefAfterAuth('dashboard.html', 'ada@example.com', { store: store }), '/guide');
assert.strictEqual(guide.hrefAfterAuth('boosts.html', 'ada@example.com', { store: store }), 'boosts.html');
assert.strictEqual(guide.hrefAfterAuth('/admin', 'owner@example.com', {
  store: store,
  membership: { isOwner: function () { return true; } }
}), '/admin');
guide.mark('skipped', { song: 'idea', want: 'release' }, store);
assert.strictEqual(guide.readFlag(store).status, 'skipped');
assert.strictEqual(guide.hrefAfterAuth('dashboard.html', 'ada@example.com', { store: store }), 'dashboard.html');
guide.mark('completed', { song: 'out', want: 'team' }, store);
assert.strictEqual(guide.readFlag(store).status, 'completed');
assert.strictEqual(guide.readFlag(store).song, 'out');

const html = read('guide.html');
const page = read('guide.js');
const css = read('guide.css');
["Where's your song?", 'Just an idea', 'Made it', "It's out", 'What do you want?', 'Get it out there', 'Get it heard', 'Get paid', 'Get a team', 'Your route', 'Tap your first stop', 'Skip'].forEach(function (line) {
  assert.ok(html.includes(line), 'guide shows ' + line);
});
assert.ok(!html.includes('Who are you?'), 'guide does not ask who they are');
assert.ok(html.includes('aria-valuemax="4"'), 'progress bar has four steps');
assert.ok(page.includes('/ steps * 100'), 'progress fill matches four steps');
assert.ok(!html.includes('\u2014') && !page.includes('\u2014') && !css.includes('\u2014'), 'guide copy has no em dash');
assert.ok(!/\bplans?\b/i.test(html), 'guide page does not talk about plans');
assert.ok(html.includes("localStorage.getItem('plaigroundGuide')"));
assert.ok(html.includes('lib/guide.js'));
assert.ok(page.includes("mark('completed'") && page.includes("mark('skipped'"));
assert.ok(page.includes('planRecord') && page.includes('savePlan'));
assert.ok(page.includes('sectionsFor') && page.includes('openSectionId') && page.includes('data-guide-fold'));
assert.ok(!page.includes('Who are you?'));
assert.ok(page.includes('guide-burst') || css.includes('guide-burst'));
assert.ok(css.includes('@keyframes guide-burst'));

const login = read('login.html');
const confirmed = read('confirmed.html');
const magic = read('magic.html');
const forgot = read('forgot.html');
[login, confirmed, magic, forgot].forEach(function (file) {
  assert.ok(file.includes('lib/guide.js'), 'auth page loads the guide');
  assert.ok(file.includes('hrefAfterAuth'), 'auth page can open the guide');
});
assert.ok(magic.includes('signedInHome') && forgot.includes('signedInHome'));
assert.ok(login.includes('afterLoginHome'));
assert.ok(confirmed.includes('claimLocal'));

const site = read('site.js');
assert.ok(site.includes('side-fresh'), 'signed-in menu gets the refreshed shell');
assert.ok(site.includes('side-roadmap'), 'Roadmap link is marked for the new look');
const dash = read('dashboard.html');
assert.ok(/<nav class="side-nav"[^>]*>\s*<a href="\/destination">Roadmap<\/a>/.test(dash), 'Roadmap stays the first signed-in link');
assert.ok(read('vercel.json').includes('"/guide"'));

console.log('guide.test.js ok');
