'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const hop = require('./object-hop');

function run() {
  const fat = { name: 'fat-master.wav', type: 'audio/wav', size: 7 * 1024 * 1024 };
  const cover = { name: 'cover.jpg', type: 'image/jpeg', size: 2048 };
  const calls = [];
  const fetchFn = function (url, init) {
    calls.push({ url: String(url), init: init || {} });
    if (String(url) === hop.UPLOADS_URL && init && init.method === 'POST') {
      const body = JSON.parse(init.body);
      const key = (body.kind === 'cover' ? 'covers/' : 'audio/') + '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-' + (body.filename || 'file');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          object_key: key,
          upload_url: 'https://hop.test/put',
          headers: { 'Content-Type': body.content_type || 'application/octet-stream' },
        }),
      });
    }
    if (String(url) === 'https://hop.test/put') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (String(url).indexOf(hop.UPLOADS_URL + '?key=') === 0) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://hop.test/get?sig=1', object_key: decodeURIComponent(String(url).split('key=')[1] || '') }),
      });
    }
    return Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'no' }) });
  };

  return hop.put('audio', fat, { fetch: fetchFn }).then(function (key) {
    assert.ok(key.indexOf('audio/') === 0);
    const mint = calls.find((row) => row.url === hop.UPLOADS_URL);
    assert.ok(mint);
    const minted = JSON.parse(mint.init.body);
    assert.strictEqual(minted.kind, 'audio');
    assert.strictEqual(minted.size, fat.size);
    assert.ok(JSON.stringify(mint.init.body).length < 500, 'presign body stays tiny');
    const put = calls.find((row) => row.url === 'https://hop.test/put');
    assert.ok(put);
    assert.strictEqual(put.init.method, 'PUT');
    assert.strictEqual(put.init.body, fat);
    assert.ok(String(put.url).indexOf('/api/') === -1, '6-8 MB file never goes through a Vercel POST');
    return hop.put('cover', cover, { fetch: fetchFn });
  }).then(function (coverKey) {
    assert.ok(coverKey.indexOf('covers/') === 0);
    return hop.previewUrl(coverKey, { fetch: fetchFn });
  }).then(function (url) {
    assert.ok(/^https:\/\/hop\.test\//.test(url));
    const src = fs.readFileSync(path.join(__dirname, 'object-hop.js'), 'utf8');
    assert.ok(!/R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_BUCKET|R2_ENDPOINT|NEXT_PUBLIC_R2/.test(src));
    assert.ok(!/Cloudflare|InterSpace/.test(src));
    const pages = ['upload.html', 'song.html'].map((name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8'));
    pages.forEach((html) => {
      assert.ok(html.includes('lib/object-hop.js'), 'pages that hop must load the client helper');
      assert.ok(!html.includes('lib/object-store.js'), 'server object store must not ship to the browser');
    });
    const clientFiles = [
      'store-client.js',
      'song.js',
      'upload.html',
      'song.html',
      'lib/object-hop.js',
      'lib/cover-preview.js',
    ];
    clientFiles.forEach((rel) => {
      const text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
      assert.ok(!/R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|NEXT_PUBLIC_R2/.test(text), rel + ' must not contain hop keys');
    });
    console.log('lib/object-hop.test.js ok');
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
