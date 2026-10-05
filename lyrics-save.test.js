'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const accounts = require('./lib/accounts');
const db = require('./lib/db');
const lyrics = require('./lib/lyrics');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

async function run() {
  const schema = read('schema.sql');
  const statements = db.splitStatements(schema);
  assert.ok(statements.some((sql) => /CREATE TABLE IF NOT EXISTS saved_lyrics/i.test(sql)));
  assert.ok(schema.includes('saved_lyrics_user_created_idx'));
  assert.ok(read('api/me.js').includes("path === '/api/me/lyrics'"));
  assert.ok(read('vercel.json').includes('"/api/me/lyrics"'));
  assert.ok(read('my-lyrics.html').includes('data-require-membership="true"'));
  assert.ok(read('my-lyrics.html').includes('href="/song-helper"'));
  assert.ok(!read('my-lyrics.html').includes('href="/battle"'));

  accounts.useMemoryStore();
  lyrics.resetStore();
  await assert.rejects(function () { return lyrics.saveOwn('user-1', { text: '   ' }); }, function (err) {
    return err && err.code === 'VALIDATION';
  });
  const saved = await lyrics.saveOwn('user-1', {
    title: 'Night bus',
    text: 'I waited in the rain\nThe light stayed on',
    mode: 'hook',
    mood: 'hopeful',
    sparkTitle: 'Late bus',
    sparkAngle: 'The wait was the song',
  });
  assert.strictEqual(saved.created, true);
  assert.strictEqual(saved.songs.length, 1);
  assert.strictEqual(saved.song.title, 'Night bus');
  assert.ok(saved.song.text.indexOf('\n') !== -1);
  const again = await lyrics.saveOwn('user-1', {
    title: 'Night bus',
    text: 'I waited in the rain\nThe light stayed on',
    mode: 'hook',
    mood: 'hopeful',
  });
  assert.strictEqual(again.created, false);
  assert.strictEqual(again.songs.length, 1);
  const listed = await lyrics.listOwn('user-1');
  assert.strictEqual(listed.songs[0].id, saved.song.id);
  const other = await lyrics.listOwn('user-2');
  assert.strictEqual(other.songs.length, 0);

  const store = {};
  const previous = global.localStorage;
  global.localStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { store[key] = String(value); },
    removeItem: function (key) { delete store[key]; },
  };
  delete require.cache[require.resolve('./lyrics-account.js')];
  const fresh = require('./lyrics-account.js');
  assert.strictEqual(fresh.hold({ title: 'Night bus', text: 'I waited in the rain' }), true);
  assert.strictEqual(fresh.pendingHome(), '/my-lyrics');
  assert.strictEqual(fresh.readPending().title, 'Night bus');
  fresh.clearPending();
  assert.strictEqual(fresh.pendingHome(), '');
  assert.strictEqual(fresh.hold({ title: 'Empty', text: '   ' }), false);
  if (previous === undefined) delete global.localStorage;
  else global.localStorage = previous;
}

run().then(function () {
  console.log('lyrics-save.test.js ok');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
