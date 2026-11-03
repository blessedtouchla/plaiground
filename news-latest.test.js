'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const news = require('./news-latest.js');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, rel), 'utf8');
}

const blog = read('blog.html');
const latest = news.latestPosts(blog, 3);

assert.strictEqual(latest.length, 3);
assert.strictEqual(latest[0].date, 'Oct 23, 2026');
assert.strictEqual(latest[0].title, 'How to get your music on Spotify, step by step.');
assert.strictEqual(latest[0].href, '/blog-how-to-get-your-music-on-spotify.html');
assert.strictEqual(latest[1].title, 'How to pick a distributor for AI-assisted music.');
assert.strictEqual(latest[2].title, 'Human, AI-assisted or Fully AI: how to label your music.');
assert.ok(latest.every(function (post) { return post.time === latest[0].time; }));
assert.strictEqual(news.isoDate(latest[0].time), '2026-10-23');

const fixture = [
  '<div class="tease-grid">',
  '<article><p class="eyebrow">Oct 23, 2026</p><h3><a href="blog-older.html">Older post.</a></h3><p>First.</p></article>',
  '<article><p class="eyebrow">Nov 2, 2026</p><h3><a href="blog-newer-example.html">A newer post.</a></h3><p>Later.</p></article>',
  '<article><p class="eyebrow">Oct 23, 2026</p><h3><a href="blog-second.html">Second same day.</a></h3><p>Next.</p></article>',
  '</div></section>',
  '<article><h3><a href="nope.html">Nope</a></h3></article>'
].join('');
const picked = news.latestPosts(fixture, 3);
assert.strictEqual(picked[0].title, 'A newer post.');
assert.strictEqual(picked[0].date, 'Nov 2, 2026');
assert.strictEqual(picked[0].href, '/blog-newer-example.html');
assert.strictEqual(picked[1].title, 'Older post.');
assert.strictEqual(picked[2].title, 'Second same day.');
assert.strictEqual(news.postsFromBlogHtml('<p>Footer</p><article><h3><a href="nope.html">Nope</a></h3></article>').length, 0);

const index = read('index.html');
assert.ok(index.includes('Latest from PLAIGROUND News'));
assert.ok(index.includes('data-home-news'));
assert.ok(index.includes('news-latest.js?v=20261103news1'));
assert.ok(index.includes('home-flow.css?v=20261103news1'));
assert.ok(index.includes('site.js?v=20261103news1'));
assert.ok(index.includes('site.css?v=20261103news1'));
const homeNav = index.match(/<nav class="nav-links"[^>]*>[\s\S]*?<\/nav>/);
assert.ok(homeNav && /Blog<\/a>\s*<\/div>\s*<\/nav>/.test(homeNav[0]), 'static homepage nav still ends on Blog');

const js = read('site.js');
assert.ok(js.includes('data-nav-group", "news"') || js.includes('data-nav-group", "news"'));
assert.ok(js.includes('function makeNewsGroup'));
assert.ok(js.includes('link.textContent = "News"'));
assert.ok(js.includes('href", "/blog"'));
assert.ok(js.includes('isPublicNewsAnchor'));
assert.ok(!/\u2014/.test(read('news-latest.js') + read('home-flow.css').slice(read('home-flow.css').indexOf('Homepage news strip'))));

const pages = [
  'index.html',
  'blog.html',
  'faq.html',
  'how-it-works.html',
  'login.html',
  'about.html'
];
pages.forEach(function (file) {
  const html = read(file);
  assert.ok(html.includes('class="nav-links"'), file + ' shares the public nav');
  assert.ok(/src="\/?site\.js\?v=20261103news1"/.test(html), file + ' cache-busts site.js');
});

console.log('news-latest.test.js ok');
