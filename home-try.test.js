'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, rel), 'utf8');
}

function guest(html) {
  const start = html.indexOf('data-guest-home');
  assert.ok(start !== -1, 'guest homepage block exists');
  const end = html.indexOf('<section class="hero">', start);
  assert.ok(end > start, 'the old hero stays after the guest block');
  return html.slice(start, end);
}

const index = read('index.html');
const css = read('home-try.css');
const js = read('home-try.js');
const block = guest(index);
const docs = read('docs/web-analytics.md');
const arcade = read('arcade.js');
const page = read('lib/arcade-server.js');
const song = read('song-helper.html');

assert.ok(index.includes('home-try.css?v=20261111try'));
assert.ok(index.includes('home-try.js?v=20261111try'));
assert.ok(/What's your song about\?/.test(block));
assert.ok(block.includes('id="try-it"'));
assert.ok(block.includes('action="/song-helper"'));
assert.ok(block.includes('No account'));
assert.ok(/Write lyrics/.test(block));
assert.ok(/Suno style prompts/.test(block));
assert.ok(/Spotify and other stores/.test(block));
assert.ok(/Own it and get paid/.test(block));
assert.ok(!/split sheet/i.test(block), 'split sheets are not a homepage tile');
assert.ok(!/220\+|50\+ countries|guaranteed income|get rich/i.test(block));
assert.ok(index.includes('class="hero"'), 'signed-in visitors still have the current hero in the page');
assert.ok(/is-member/.test(css) && /try-home/.test(css));
assert.ok(/:not\(\.is-member\) \.hero/.test(css));
assert.ok(/min-height:\s*48px/.test(css));
assert.ok(/min-height:\s*72px/.test(css));
assert.ok(/font-size:\s*16px/.test(css));
assert.ok(/font-size:\s*15px/.test(css));
assert.ok(js.includes("track('try_it_submit'"));
assert.ok(js.includes("classList.toggle('is-member'"));
assert.ok(js.includes('/song-helper?idea='));

['try_it_submit', 'song_lab_start', 'song_lab_completed', 'signup_start', 'signup_completed', 'primary_cta'].forEach(function (name) {
  assert.ok(docs.includes('`' + name + '`'), name);
});
assert.ok(/Web Analytics/.test(docs));
assert.ok(/dashboard/.test(docs));

assert.ok(arcade.includes('Free to write. Sign up only to save a song.'));
assert.ok(!arcade.includes('Get starter credits to try every tool.'));
assert.ok(arcade.includes("entry: 'homepage'"));
assert.ok(arcade.includes("entry: 'door'"));
assert.ok(arcade.includes('song_lab_completed'));
assert.ok(arcade.includes("from: 'save_song'"));
assert.ok(page.includes('/_vercel/insights/script.js'));
assert.ok(page.includes('/funnel-analytics.js?v=20261111funnel'));
assert.ok(song.includes('Writing a song in Song Lab is free.'));
assert.ok(!song.includes('Writing tools use credits'));
assert.ok(read('site.js').includes('/funnel-analytics.js?v=20261111funnel'));
assert.ok(read('site.js').includes('/_vercel/insights/script.js'));
assert.ok(read('signup.html').includes("track('signup_completed'"));
assert.ok(!/Apply free/.test(block) || index.includes('Apply free'), 'EPK Apply free wording is left on the page');
assert.ok(index.includes('>Apply free</button>'), 'EPK Apply free stays on the pricing list');

console.log('home-try.test.js ok');
