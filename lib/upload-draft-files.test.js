'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const files = require('./upload-draft-files');

function makeFile(name, type) {
  return { name: name, type: type, size: 12 };
}

function memoryIdb() {
  const stores = { files: {} };
  function db() {
    return {
      objectStoreNames: { contains(name) { return name === 'files'; } },
      createObjectStore() {},
      transaction(name, mode) {
        const tx = {
          oncomplete: null,
          onerror: null,
          onabort: null,
          objectStore() {
            return {
              put(value, key) {
                stores.files[key] = value;
                if (typeof tx.oncomplete === 'function') setImmediate(function () { tx.oncomplete(); });
              },
              get(key) {
                const req = { result: stores.files[key] || null, onsuccess: null, onerror: null };
                setImmediate(function () {
                  if (typeof req.onsuccess === 'function') req.onsuccess();
                });
                return req;
              },
            };
          },
        };
        return tx;
      },
    };
  }
  return {
    open() {
      const req = { result: db(), onsuccess: null, onerror: null, onupgradeneeded: null };
      setImmediate(function () {
        if (typeof req.onupgradeneeded === 'function') req.onupgradeneeded();
        if (typeof req.onsuccess === 'function') req.onsuccess();
      });
      return req;
    },
    deleteDatabase() { stores.files = {}; },
    _stores: stores,
  };
}

function makeWin(audio, cover) {
  const audioEl = { files: audio ? [audio] : [], _plaigroundFile: audio || null, dispatchEvent() {} };
  const artEl = { files: cover ? [cover] : [], _plaigroundFile: cover || null, dispatchEvent() {} };
  return {
    document: {
      querySelector(sel) {
        if (sel === '[data-audio-input]') return audioEl;
        if (sel === '[data-art-input]') return artEl;
        return null;
      },
    },
    indexedDB: memoryIdb(),
    audioEl,
    artEl,
  };
}

async function run() {
  const upload = fs.readFileSync(path.join(__dirname, '..', 'upload.html'), 'utf8');
  const credits = fs.readFileSync(path.join(__dirname, 'upload-credits.js'), 'utf8');
  const leave = fs.readFileSync(path.join(__dirname, 'upload-leave.js'), 'utf8');
  assert.ok(upload.includes('lib/upload-draft-files.js'), 'Save draft loads the file persist helper');
  assert.ok(upload.indexOf('lib/upload-draft-files.js') < upload.indexOf('lib/upload-credits.js'));
  assert.ok(credits.includes('persistPickedFiles'), 'Save draft persists picked files, not form fields only');
  assert.ok(credits.includes('restorePickedFiles'), 'reopening a draft restores picked files');
  assert.ok(!/PlaigroundObjectHop\.put/.test(credits), 'Save draft does not hop / send the draft to the store');
  assert.ok(leave.includes("idb.deleteDatabase(AUDIO_HOLD_DB)"), 'Cancel and Start over still drop held files');

  const audio = makeFile('hook.wav', 'audio/wav');
  const cover = makeFile('art.png', 'image/png');
  const win = makeWin(audio, cover);
  const meta = files.collectFileMeta(win);
  assert.strictEqual(meta.audio_name, 'hook.wav');
  assert.strictEqual(meta.artwork_name, 'art.png');

  await files.persistPickedFiles(win);
  const stored = win.indexedDB._stores.files;
  assert.strictEqual(stored[files.AUDIO_KEY], audio, 'picked audio stays in the private hold');
  assert.strictEqual(stored[files.COVER_KEY], cover, 'picked cover stays in the private hold');

  const next = makeWin(null, null);
  next.indexedDB = win.indexedDB;
  const restored = await files.restorePickedFiles(next);
  assert.strictEqual(restored.audio, audio);
  assert.strictEqual(restored.cover, cover);
  assert.strictEqual(next.audioEl._plaigroundFile, audio);
  assert.strictEqual(next.artEl._plaigroundFile, cover);

  win.localStorage = {
    data: { 'plaiground.store.draft': '{"title":"The recording.","release_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}' },
    removeItem(key) { delete this.data[key]; },
  };
  files.wipeHeld(win);
  assert.strictEqual(win.localStorage.data['plaiground.store.draft'], undefined, 'wipeHeld drops the upload draft');
  assert.deepStrictEqual(win.indexedDB._stores.files, {}, 'wipeHeld drops held audio so restore cannot revive it');

  console.log('lib/upload-draft-files.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
