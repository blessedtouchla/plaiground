'use strict';

const assert = require('assert');
const coverUrl = require('./cover-url');

function run() {
  assert.strictEqual(coverUrl.from(null), '');
  assert.strictEqual(coverUrl.from({}), '');
  assert.strictEqual(coverUrl.from({ artwork_url: '' }), '');
  assert.strictEqual(coverUrl.from({ artwork_url: 'https://cdn.example/cover.jpg' }), 'https://cdn.example/cover.jpg');
  assert.strictEqual(coverUrl.from({ cover_art_url: 'https://cdn.example/art.png' }), 'https://cdn.example/art.png');
  assert.strictEqual(coverUrl.from({ cover_url: 'https://cdn.example/c.jpg' }), 'https://cdn.example/c.jpg');
  assert.strictEqual(coverUrl.from({ artwork: { url: 'https://cdn.example/nested.jpg' } }), 'https://cdn.example/nested.jpg');
  assert.strictEqual(coverUrl.from({ cover: { src: 'https://cdn.example/src.jpg' } }), 'https://cdn.example/src.jpg');
  assert.strictEqual(coverUrl.from({ images: [{ url: 'https://cdn.example/img0.jpg' }] }), 'https://cdn.example/img0.jpg');
  assert.strictEqual(coverUrl.from({ release: { artwork_url: 'https://cdn.example/wrap.jpg' } }), 'https://cdn.example/wrap.jpg');
  assert.strictEqual(coverUrl.from({ data: { cover_art: { url: 'https://cdn.example/data.jpg' } } }), 'https://cdn.example/data.jpg');
  assert.strictEqual(coverUrl.from({ artwork_url: 'javascript:alert(1)' }), '');
  assert.strictEqual(coverUrl.from({ artwork_url: '/relative.jpg' }), '');
  assert.ok(coverUrl.isPaintUrl('blob:cover-1'));
  assert.ok(coverUrl.isPaintUrl('data:image/jpeg;base64,xx'));
  assert.strictEqual(coverUrl.stored({ artwork_url: 'blob:cover-1' }), '');
  assert.strictEqual(coverUrl.stored({ artwork_url: 'https://cdn.example/ok.jpg' }), 'https://cdn.example/ok.jpg');
  assert.strictEqual(coverUrl.stored({ artwork_url: 'data:image/jpeg;base64,xx' }), 'data:image/jpeg;base64,xx');
  console.log('lib/cover-url.test.js ok');
}

run();
