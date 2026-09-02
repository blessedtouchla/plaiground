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
  assert.ok(files.keepHeldFiles, 'attest and split-sheet re-hold the same IndexedDB slots');
  const attestHtml = fs.readFileSync(path.join(__dirname, '..', 'attest.html'), 'utf8');
  const sheetHtml = fs.readFileSync(path.join(__dirname, '..', 'split-sheet.html'), 'utf8');
  const reviewHtml = fs.readFileSync(path.join(__dirname, '..', 'review.html'), 'utf8');
  assert.ok(attestHtml.includes('lib/upload-draft-files.js'), 'attest keeps step-1 files through the page');
  assert.ok(sheetHtml.includes('lib/upload-draft-files.js'), 'split-sheet keeps step-1 files through the page');
  assert.ok(reviewHtml.includes('lib/upload-draft-files.js'), 'Review restores step-1 files before hop');
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'attest.js'), 'utf8').includes('keepHeldFiles'), 'attest Continue re-holds files');
  assert.ok(sheetHtml.includes('keepHeldFiles'), 'split-sheet Continue re-holds files');
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

  const wavBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
  const liveWav = {
    name: 'The recording.wav',
    type: 'audio/wav',
    size: wavBytes.byteLength,
    arrayBuffer: function () { return Promise.resolve(wavBytes.buffer); },
  };
  const byteWin = makeWin(liveWav, null);
  await files.persistPickedFiles(byteWin);
  const held = byteWin.indexedDB._stores.files[files.AUDIO_KEY];
  assert.ok(held && held.__held === 1 && held.buffer, 'Save draft clones picker bytes so they survive navigation');
  assert.strictEqual(held.name, 'The recording.wav');
  assert.strictEqual(held.size, wavBytes.byteLength);
  const restoredBytes = await files.restorePickedFiles({
    document: {
      querySelector: function () { return { files: [], _plaigroundFile: null, dispatchEvent: function () {} }; },
    },
    indexedDB: byteWin.indexedDB,
  });
  assert.ok(restoredBytes.audio && Number(restoredBytes.audio.size) === wavBytes.byteLength, 'restore rebuilds a file with the held bytes');

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
  const kept = await files.keepHeldFiles(win);
  assert.strictEqual(kept.audio.name, 'hook.wav');
  assert.strictEqual(kept.cover.name, 'art.png');
  assert.ok(win.indexedDB._stores.files[files.AUDIO_KEY], 'keepHeldFiles leaves the audio slot');
  assert.ok(win.indexedDB._stores.files[files.COVER_KEY], 'keepHeldFiles leaves the cover slot');

  files.wipeHeld(win);
  assert.strictEqual(win.localStorage.data['plaiground.store.draft'], undefined, 'wipeHeld drops the upload draft');
  assert.deepStrictEqual(win.indexedDB._stores.files, {}, 'wipeHeld drops held audio so restore cannot revive it');

  console.log('lib/upload-draft-files.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
