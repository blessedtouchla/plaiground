'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const disclosure = require('./lib/ai-disclosure');
const lab = require('./lib/song-lab-state');

const root = __dirname;
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const html = read('song-lab.html');
const js = read('song-lab.js');
const css = read('song-lab.css');
const vercel = JSON.parse(read('vercel.json'));
const page = html + '\n' + js;

assert.ok(html.includes('class="song-lab-notebook on-home"'));
assert.ok(!/class="song-lab"/.test(html));
assert.ok(html.includes('href="/song-lab.css'));
assert.ok(!html.includes('site.css'));
assert.ok(html.includes('src="/assets/plaiground-logo.png"'));
assert.ok(!read('site.css').includes('song-lab-notebook'));
assert.strictEqual(fs.readdirSync(path.join(root, 'api')).filter(function (name) { return name.endsWith('.js'); }).length, 12);

assert.ok(vercel.rewrites.some(function (row) { return row.source === '/song-lab' && row.destination === '/song-lab.html'; }));
assert.ok(vercel.rewrites.some(function (row) { return row.source === '/ai-lyrics-generator' && row.destination === '/song-helper.html'; }));
assert.ok(vercel.rewrites.some(function (row) { return row.source === '/battle' && row.destination === '/battle.html'; }));
assert.ok(vercel.redirects.some(function (row) {
  return row.source === '/battle' && row.destination === '/ai-lyrics-generator?start=battle' && !row.has;
}));
assert.ok(vercel.redirects.some(function (row) {
  return row.source === '/battle' && row.destination === 'https://www.wannaplai.com/battle' && row.permanent === true;
}));
assert.ok(!vercel.redirects.some(function (row) { return row.source === '/spark' && /ai-lyrics-generator/.test(row.destination); }));

const suno = page.match(/Suno/g) || [];
assert.deepStrictEqual(suno, ['Suno']);
assert.ok(html.includes('>Copy for Suno</button>'));
assert.ok(js.includes("'Copied.'"));
assert.ok(!/Udio/i.test(page + css));
assert.ok(!/TOKENS/.test(page));
assert.ok(html.includes('>credits</small>'));
assert.ok(page.indexOf('—') === -1 && page.indexOf('–') === -1);
assert.ok(!/\bscore\b|\bgrade\b|\bpercent\b/i.test(js));
assert.ok(!js.includes('% of'));

const stateJs = read('lib/song-lab-state.js');
['Human', 'AI-assisted', 'Fully AI'].forEach(function (label) {
  assert.ok(stateJs.includes("'" + label + "'") || stateJs.includes('"' + label + '"'));
});
lab.STAMPS.forEach(function (stamp) {
  assert.strictEqual(disclosure.label(stamp.key), stamp.label);
});
lab.GENRES.forEach(function (genre) {
  assert.strictEqual(lab.tip(genre).indexOf(genre + ':'), 0);
});

assert.ok(css.includes('@media (hover: hover)'));
assert.ok(css.includes('min-height: 48px; min-width: 44px'));
assert.ok(css.includes('prefers-reduced-motion'));
assert.ok(!css.includes(':has('));
assert.ok(!css.includes('color-mix('));
assert.ok(!css.includes('scroll-snap'));
assert.ok(css.includes(".dot.fill"));
assert.ok(css.includes('.dot.extra'));
assert.ok(!css.includes('.dot.bad') && !css.includes('.dot.red'));
assert.ok(read('song-helper-v2.js').includes("window.location.assign('/song-lab#desk')"));
assert.ok(read('song-helper-v2.js').includes("bindPress(scratchBtn, function () { setBranch('scratch'); })"));
assert.ok(read('api/song-helper.js').includes("action === 'couch-turn'"));
assert.ok(!read('api/song-helper.js').includes('XAI_API_KEY') || read('api/song-helper.js').includes('never sent to the browser') || read('api/song-helper.js').includes('server only'));
assert.ok(!js.includes('XAI_API_KEY'));
assert.ok(!js.includes('api.x.ai'));

console.log('song-lab.test.js ok');
