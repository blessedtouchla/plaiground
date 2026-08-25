'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const preview = require('./cover-preview');

function el(attrs) {
  const node = {
    hidden: Boolean(attrs && attrs.hidden),
    textContent: (attrs && attrs.textContent) || '',
    value: attrs && attrs.value != null ? attrs.value : '',
    files: (attrs && attrs.files) || [],
    style: {},
    attrs: Object.assign({}, (attrs && attrs.attrs) || {}),
    listeners: {},
    classList: {
      tokens: Object.create(null),
      add(name) { this.tokens[name] = true; },
      remove(name) { delete this.tokens[name]; },
      toggle(name, force) {
        if (force === false) delete this.tokens[name];
        else if (force) this.tokens[name] = true;
        else if (this.tokens[name]) delete this.tokens[name];
        else this.tokens[name] = true;
      },
      contains(name) { return Boolean(this.tokens[name]); },
    },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  };
  return node;
}

function mockUrl() {
  const live = Object.create(null);
  let n = 0;
  return {
    createObjectURL(file) {
      n += 1;
      const url = 'blob:cover-' + n + '-' + (file && file.name ? file.name : 'file');
      live[url] = file;
      return url;
    },
    revokeObjectURL(url) {
      delete live[url];
    },
    live: live,
  };
}

function run() {
  assert.ok(preview.isCoverFile({ name: 'cover.jpg', type: 'image/jpeg' }));
  assert.ok(preview.isCoverFile({ name: 'art.PNG', type: '' }));
  assert.ok(preview.isCoverFile({ name: 'art', type: 'image/png' }));
  assert.ok(!preview.isCoverFile({ name: 'track.wav', type: 'audio/wav' }));
  assert.ok(!preview.isCoverFile(null));

  const tile = el();
  const input = el({ files: [] });
  const note = el({ textContent: 'No cover uploaded' });
  const clearBtn = el({ hidden: true });
  const win = { listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
  const url = mockUrl();
  const stored = 'https://cdn.example/stored.jpg';
  const api = preview.bind({
    input: input,
    tile: tile,
    note: note,
    clearButton: clearBtn,
    storedUrl: stored,
    window: win,
    URL: url,
  });

  assert.strictEqual(tile.style.backgroundImage, 'url("https://cdn.example/stored.jpg")');
  assert.ok(tile.classList.contains('has-art'));
  assert.strictEqual(note.textContent, 'Cover art');
  assert.strictEqual(clearBtn.hidden, true, 'clear stays hidden until a local file is picked');
  assert.strictEqual(api.hasLocal(), false);

  const first = { name: 'new-cover.jpg', type: 'image/jpeg' };
  input.files = [first];
  input.listeners.change();
  assert.ok(api.hasLocal());
  assert.ok(/blob:cover-1-new-cover\.jpg/.test(tile.style.backgroundImage), tile.style.backgroundImage);
  assert.ok(url.live['blob:cover-1-new-cover.jpg']);
  assert.strictEqual(clearBtn.hidden, false);
  assert.strictEqual(api.currentUrl(), 'blob:cover-1-new-cover.jpg');

  const second = { name: 'replace.png', type: 'image/png' };
  input.files = [second];
  input.listeners.change();
  assert.ok(/blob:cover-2-replace\.png/.test(tile.style.backgroundImage), tile.style.backgroundImage);
  assert.ok(!url.live['blob:cover-1-new-cover.jpg'], 'replaced object URL must be revoked');
  assert.ok(url.live['blob:cover-2-replace.png']);

  input.files = [];
  input.listeners.change();
  assert.strictEqual(api.hasLocal(), false);
  assert.strictEqual(tile.style.backgroundImage, 'url("https://cdn.example/stored.jpg")', 'clear restores the stored cover');
  assert.ok(!url.live['blob:cover-2-replace.png'], 'cleared object URL must be revoked');
  assert.strictEqual(clearBtn.hidden, true);

  input.files = [first];
  input.listeners.change();
  assert.ok(api.hasLocal());
  clearBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(api.hasLocal(), false);
  assert.strictEqual(tile.style.backgroundImage, 'url("https://cdn.example/stored.jpg")');
  assert.strictEqual(input.value, '');

  api.setStored('https://cdn.example/later.jpg');
  assert.strictEqual(tile.style.backgroundImage, 'url("https://cdn.example/later.jpg")');

  input.files = [second];
  input.listeners.change();
  api.setStored('https://cdn.example/should-not-win.jpg');
  assert.ok(/blob:cover-/.test(tile.style.backgroundImage), 'local pick wins until cleared');
  assert.ok(!/should-not-win/.test(tile.style.backgroundImage));

  const beforeLeave = api.currentUrl();
  assert.ok(url.live[beforeLeave]);
  win.listeners.pagehide();
  assert.ok(!url.live[beforeLeave], 'leave revokes the object URL');

  const src = fs.readFileSync(path.join(__dirname, 'cover-preview.js'), 'utf8');
  assert.ok(src.includes('createObjectURL'));
  assert.ok(src.includes('revokeObjectURL'));
  assert.ok(!/S3Client|R2|PutObject|@aws-sdk|new BlobService|cloudflare/i.test(src));
  assert.ok(!/indexedDB|localStorage|sessionStorage/.test(src), 'preview file is not persisted');
  assert.ok(!/XAI_API_KEY/.test(src));

  const pages = ['upload.html', 'song.html', 'releases.html'].map(function (name) {
    return {
      name: name,
      html: fs.readFileSync(path.join(__dirname, '..', name), 'utf8'),
    };
  });
  pages.forEach(function (page) {
    assert.ok(page.html.includes('lib/cover-preview.js'), page.name + ' must load the local cover preview helper');
  });
  assert.ok(pages[0].html.includes('data-art-input'));
  assert.ok(pages[0].html.includes('data-art-box'));
  assert.ok(pages[1].html.includes('id="edit-art"'));
  assert.ok(pages[1].html.includes('data-song-cover'));
  assert.ok(pages[2].html.includes('id="edit-art"'));
  assert.ok(pages[2].html.includes('data-edit-art-box'));

  const vm = require('vm');
  const albumTile = el();
  const albumInput = el({ files: [] });
  const albumClear = el({ hidden: true });
  const albumPanel = el({ hidden: true });
  const albumUrl = mockUrl();
  const albumWin = {
    addEventListener(type, fn) { this.listeners[type] = fn; },
    listeners: {},
    URL: albumUrl,
    location: { href: 'releases.html', search: '' },
    fetch: function () {
      return Promise.resolve({ ok: true, status: 200, json: async function () { return { stores: [] }; } });
    },
    document: {
      querySelector: function (sel) {
        if (sel === '#edit-art' || sel === 'edit-art') return albumInput;
        if (sel === '[data-edit-art-box]') return albumTile;
        if (sel === '[data-art-clear]') return albumClear;
        if (sel === '[data-release-edit]') return albumPanel;
        return null;
      },
      querySelectorAll: function () { return []; },
      getElementById: function (id) { return id === 'edit-art' ? albumInput : null; },
    },
  };
  albumWin.window = albumWin;
  albumWin.globalThis = albumWin;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'cover-preview.js'), 'utf8'), albumWin);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'catalog.js'), 'utf8'), albumWin);
  assert.ok(albumWin.PlaigroundCatalog.coverPreview(), 'catalog edit binds local cover preview');
  albumWin.PlaigroundCatalog.fillEdit({
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Night Drive',
    artwork_url: 'https://cdn.example/album.jpg',
    tracks: [],
  });
  assert.ok(albumTile.style.backgroundImage.indexOf('album.jpg') !== -1, 'stored album cover stays until a new file is picked');
  albumInput.files = [{ name: 'album-new.jpg', type: 'image/jpeg' }];
  albumInput.listeners.change();
  assert.ok(/blob:cover-/.test(albumTile.style.backgroundImage), 'album/edit local pick paints the cover tile');
  albumInput.files = [];
  albumInput.listeners.change();
  assert.ok(albumTile.style.backgroundImage.indexOf('album.jpg') !== -1, 'album/edit clear restores the stored cover');

  console.log('lib/cover-preview.test.js ok');
}

run();
