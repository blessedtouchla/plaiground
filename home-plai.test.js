'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const plai = require('./home-plai');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, rel), 'utf8');
}

const write = plai.answerById('write');
const release = plai.answerById('release');
const protect = plai.answerById('protect');
const artist = plai.answerById('artist');

assert.strictEqual(plai.GREET, 'Where are you with your music?');
assert.strictEqual(write.pose, 'dancing');
assert.strictEqual(write.href, '/song-helper');
assert.ok(write.href.indexOf('login') === -1);
assert.ok(release.href.indexOf('login.html') === 0, 'release routes through sign-in');
assert.ok(release.href.indexOf('distribution') !== -1);
assert.strictEqual(protect.href, 'publishing.html');
assert.strictEqual(protect.pose, 'gotit');
assert.strictEqual(artist.href, '/epk');
assert.strictEqual(artist.pose, 'hello');
assert.strictEqual(plai.POSES.thinking, '/for-david-fv/img/plai-thinking.webp');
assert.strictEqual(plai.POSES.dancing, '/for-david-fv/img/plai-dancing.webp');
assert.strictEqual(plai.POSES.gotit, '/for-david-fv/img/plai-gotit.webp');
assert.strictEqual(plai.POSES.hello, '/for-david-fv/img/plai-hello.webp');

assert.strictEqual(plai.routeText('I need to release my record').id, 'release');
assert.strictEqual(plai.routeText('protect my rights').id, 'protect');
assert.strictEqual(plai.routeText('build my artist profile').id, 'artist');
const custom = plai.routeText('a late train and a second chance');
assert.strictEqual(custom.id, 'custom');
assert.ok(custom.href.indexOf('/song-helper?idea=') === 0);
assert.ok(decodeURIComponent(custom.href).indexOf('a late train') !== -1);
assert.strictEqual(plai.routeText('   '), null);

const page = read('index.html');
assert.ok(page.includes('data-plai-answer="write"'));
assert.ok(page.includes('data-plai-answer="release"'));
assert.ok(page.includes('data-plai-answer="protect"'));
assert.ok(page.includes('data-plai-answer="artist"'));
assert.ok(page.includes('/for-david-fv/img/plai-hello.webp'));
assert.ok(page.includes('id="enter-lab"'));
assert.ok(page.includes('Hear Plai'));
assert.ok(read('plai-voice.js').includes('speechSynthesis'));
assert.ok(read('plai-voice.js').includes('lip-synced'));
assert.ok(read('funnel-analytics.js').includes('plai_answer: 1'));
assert.ok(read('funnel-analytics.js').includes('answer: 1'));
assert.ok(!/220\+|50\+ countries|instantly|get rich/i.test(page.slice(page.indexOf('data-guest-home'), page.indexOf('<section class="hero">'))));

console.log('home-plai.test.js ok');
