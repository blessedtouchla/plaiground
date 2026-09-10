'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SEASON_ID = '40cec4ed-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UNICORN_ID = '1fc1dd72-00bc-4677-8f98-164d116b42a9';
const ROSE = 'https://cdn.example/3bcc5892-rose.jpg';
const UNICORN = 'https://cdn.example/unicorn.jpg';
const HOP_SRC = fs.readFileSync(path.join(__dirname, 'leftover-art-hop.js'), 'utf8');
const CACHE_BUST = 'leftover-art-hop.js?v=20260910art1';

function memoryStore(seed) {
  const data = Object.assign({}, seed || {});
  return {
    getItem(key) { return data[key] == null ? null : data[key]; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
  };
}

function makeTile(opts) {
  opts = opts || {};
  const attrs = Object.assign({}, opts.attrs || {});
  if (opts.songCover) attrs['data-song-cover'] = '';
  const titleEl = { textContent: opts.title || '' };
  const link = {
    getAttribute(name) { return name === 'href' ? (opts.href || '') : null; },
    querySelector(sel) { return sel === 'strong' ? titleEl : null; },
  };
  const el = {
    style: { backgroundImage: opts.backgroundImage || '' },
    classList: {
      tokens: Object.create(null),
      add(name) { this.tokens[name] = true; },
    },
    attrs: attrs,
    getAttribute(name) { return attrs[name] == null ? null : attrs[name]; },
    closest() { return link; },
    parentNode: link,
  };
  return el;
}

function loadHop(opts) {
  opts = opts || {};
  const songCover = makeTile({
    songCover: true,
    backgroundImage: opts.songCover || '',
  });
  const seasonTile = makeTile({
    href: 'song.html?id=' + encodeURIComponent(SEASON_ID),
    title: 'Season of love',
    backgroundImage: opts.seasonTile || ROSE,
  });
  const unicornTile = makeTile({
    href: 'song.html?id=' + encodeURIComponent(UNICORN_ID),
    title: 'Unicorn',
    backgroundImage: opts.unicornTile || '',
  });
  const tiles = [];
  if (opts.withSongCover !== false) tiles.push(songCover);
  if (opts.withOverview) {
    tiles.push(seasonTile);
    tiles.push(unicornTile);
  }
  const calls = [];
  const timers = [];
  const draft = opts.draft || {
    release_id: UNICORN_ID,
    title: 'Unicorn',
    artwork_url: UNICORN,
    artwork_object_key: 'covers/unicorn-key',
  };
  const hopPreview = opts.hopPreview || '';
  const heldCover = opts.heldCover || null;
  const root = {
    document: {
      readyState: 'complete',
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll(sel) {
        if (String(sel).indexOf('data-song-cover') !== -1 || String(sel).indexOf('release-tile-art') !== -1) {
          return tiles;
        }
        return [];
      },
    },
    location: { search: opts.search != null ? opts.search : ('?id=' + SEASON_ID) },
    localStorage: memoryStore({
      'plaiground.store.draft': JSON.stringify(draft),
    }),
    sessionStorage: memoryStore({}),
    fetch(url, init) {
      calls.push({ url: String(url), init: init || {} });
      return Promise.resolve({ ok: true, status: 200 });
    },
    setTimeout(fn) {
      timers.push(fn);
      return timers.length;
    },
    addEventListener() {},
    PlaigroundCoverPreview: {
      paintTile(el, url) {
        el.style.backgroundImage = 'url("' + String(url).replace(/"/g, '') + '")';
        if (el.classList && el.classList.add) el.classList.add('has-art');
      },
    },
    PlaigroundObjectHop: hopPreview ? {
      previewUrl() { return Promise.resolve(hopPreview); },
    } : null,
    PlaigroundUploadDraftFiles: heldCover ? {
      keepHeldFiles() { return Promise.resolve({ cover: heldCover }); },
    } : null,
    PlaigroundSong: opts.submitEdit ? {
      submitEdit: opts.submitEdit,
    } : null,
    URL: {
      createObjectURL(file) { return 'blob:held-' + (file && file.name ? file.name : 'cover'); },
    },
  };
  root.window = root;
  function setTimeoutFn(fn, ms) {
    return root.setTimeout(fn, ms);
  }
  vm.runInNewContext(HOP_SRC, {
    window: root,
    URLSearchParams: URLSearchParams,
    encodeURIComponent: encodeURIComponent,
    JSON: JSON,
    Object: Object,
    Array: Array,
    String: String,
    Boolean: Boolean,
    URL: root.URL,
    Promise: Promise,
    setTimeout: setTimeoutFn,
  });
  return {
    songCover: songCover,
    seasonTile: seasonTile,
    unicornTile: unicornTile,
    calls: calls,
    timers: timers,
    flush() {
      const pending = timers.splice(0, timers.length);
      pending.forEach(function (fn) { fn(); });
    },
  };
}

function run() {
  const seasonPage = loadHop({
    search: '?id=' + SEASON_ID,
    songCover: 'url("' + ROSE + '")',
    withOverview: true,
    hopPreview: UNICORN,
    heldCover: { name: 'unicorn.png', type: 'image/png' },
  });
  assert.ok(seasonPage.songCover.style.backgroundImage.indexOf('3bcc5892-rose') !== -1, 'Season song cover stays the rose');
  assert.ok(seasonPage.songCover.style.backgroundImage.indexOf('unicorn') === -1, 'Unicorn leftover must not paint Season detail');
  assert.ok(seasonPage.seasonTile.style.backgroundImage.indexOf('3bcc5892-rose') !== -1, 'Season Overview tile stays the rose');
  assert.ok(seasonPage.unicornTile.style.backgroundImage.indexOf('unicorn') !== -1, 'Unicorn Overview tile still gets leftover art');
  assert.ok(!seasonPage.calls.some(function (row) {
    return /\/artwork/.test(row.url);
  }), 'leftover hop must not POST artwork while Season is open with a mismatched Unicorn draft');

  seasonPage.flush();
  return Promise.resolve().then(function () {
    assert.ok(seasonPage.songCover.style.backgroundImage.indexOf('3bcc5892-rose') !== -1, 'delayed leftover paint must not overwrite Season');
    assert.ok(!seasonPage.calls.some(function (row) {
      return /\/artwork/.test(row.url);
    }), 'delayed leftover hop must not POST artwork to Season or Unicorn from the Season page');

    const matched = loadHop({
      search: '?id=' + UNICORN_ID,
      songCover: '',
      draft: {
        release_id: UNICORN_ID,
        tonegrid_release_id: UNICORN_ID,
        title: 'Unicorn',
        artwork_url: UNICORN,
        artwork_object_key: 'covers/unicorn-key',
      },
    });
    assert.ok(matched.songCover.style.backgroundImage.indexOf('unicorn') !== -1, 'matching leftover draft still paints its own song cover');
    assert.ok(matched.calls.some(function (row) {
      return row.url === '/api/tonegrid/releases/' + UNICORN_ID + '/artwork' && row.init.method === 'POST';
    }), 'matching leftover draft may POST artwork to its own release');

    const dashboard = loadHop({
      search: '',
      withSongCover: false,
      withOverview: true,
      draft: {
        release_id: UNICORN_ID,
        title: 'Unicorn',
        artwork_url: UNICORN,
        artwork_object_key: 'covers/unicorn-key',
      },
    });
    assert.ok(dashboard.seasonTile.style.backgroundImage.indexOf('3bcc5892-rose') !== -1, 'Overview Season tile is unchanged');
    assert.ok(dashboard.unicornTile.style.backgroundImage.indexOf('unicorn') !== -1, 'Overview Unicorn tile is painted');
    assert.ok(dashboard.calls.some(function (row) {
      return row.url === '/api/tonegrid/releases/' + UNICORN_ID + '/artwork';
    }), 'dashboard leftover attach still POSTs to the leftover draft release');

    const seasonDraft = loadHop({
      search: '?id=' + SEASON_ID,
      songCover: 'url("' + ROSE + '")',
      draft: {
        release_id: SEASON_ID,
        title: 'Season of love',
        artwork_url: UNICORN,
        artwork_object_key: 'covers/unicorn-key',
      },
    });
    assert.ok(!seasonDraft.calls.some(function (row) {
      return /\/artwork/.test(row.url);
    }), 'leftover hop must not POST a leftover cover onto Season');

    const songHtml = fs.readFileSync(path.join(__dirname, '..', 'song.html'), 'utf8');
    const dashHtml = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
    const preview = fs.readFileSync(path.join(__dirname, 'cover-preview.js'), 'utf8');
    assert.ok(songHtml.includes(CACHE_BUST), 'song.html cache-busts leftover-art-hop.js');
    assert.ok(dashHtml.includes(CACHE_BUST), 'dashboard.html cache-busts leftover-art-hop.js');
    assert.ok(preview.includes(CACHE_BUST), 'cover-preview injects leftover-art-hop.js with the same cache-bust');
    assert.ok(!songHtml.includes('leftover-art-hop.js?v=20260902art1'));
    assert.ok(!dashHtml.includes('leftover-art-hop.js?v=20260902art1'));
    assert.ok(!preview.includes('leftover-art-hop.js?v=20260903cov1'));
    assert.ok(!/ToneGrid|Tonegrid/.test(HOP_SRC.replace(/\/api\/tonegrid\//g, '')), 'leftover-art-hop must not name the store partner');

    console.log('lib/leftover-art-hop.test.js ok');
  });
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
