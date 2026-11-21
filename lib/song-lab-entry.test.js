'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

const site = read('site.js');
const membership = read('membership.js');
const arcade = read('arcade.js');
const arcadePage = read('lib/arcade-server.js');
const songLab = read('song-lab.html');
const lyrics = read('song-helper.html');
const home = read('index.html');

assert.ok(site.includes('{ href: "/song-lab", label: "Song Lab" }'), 'Song Lab menu entries open the notebook');
assert.ok(site.includes('labLink.setAttribute("href", "/song-lab")'));
assert.ok(site.includes('function pointSongLabEntries'));
assert.ok(site.includes('account.hidden = !signedIn'));
assert.ok(site.includes('login.hidden = !!signedIn'));
assert.ok(membership.includes("if (path === '/song-helper' || path === '/song-helper/') return '/song-lab';"));
assert.ok(membership.includes("if (path === '/song-lab' || path === '/song-lab/') return '/song-lab';"));
assert.ok(arcade.includes("link.textContent = on ? 'Account' : 'Log in';"));
assert.ok(arcade.includes("link.href = on ? '/settings.html' : '/login.html?next=/song-lab';"));
assert.ok(arcadePage.includes('membership.js'));
assert.ok(songLab.includes('id="desk-auth"'));
assert.ok(songLab.includes('membership.js'));
assert.ok(lyrics.includes('membership.js'));
assert.ok(lyrics.includes('href="/song-lab">Song Lab</a>'));
assert.ok(home.includes('href="/song-helper">Song Lab</a>'), 'homepage Song Lab link stays in the source');
assert.ok(!/[\u2014\u2013]/.test(site.slice(site.indexOf('function pointSongLabEntries'), site.indexOf('function pointSongLabEntries') + 700)));
assert.ok(!/Suno/.test(arcade.slice(arcade.indexOf('function syncArcadeAuth'), arcade.indexOf('function syncArcadeAuth') + 400)));

console.log('song-lab-entry.test.js ok');
