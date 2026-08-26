'use strict';

const assert = require('assert');
const chunks = require('./audio-chunks');

function headerValue(req, name) {
  const want = String(name || '').toLowerCase();
  const headers = (req && req.headers) || {};
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i].toLowerCase() === want) return String(headers[keys[i]] || '').trim();
  }
  return '';
}

async function run() {
  chunks.resetForTests();
  assert.strictEqual(chunks.parseChunkMeta(headerValue, { headers: {} }), null);
  assert.strictEqual(chunks.parseChunkMeta(headerValue, {
    headers: {
      'x-plaiground-upload-id': 'u1',
      'x-plaiground-chunk-index': '0',
      'x-plaiground-chunk-count': '1',
    },
  }), null, 'single-shot must stay on the existing path');

  const meta0 = chunks.parseChunkMeta(headerValue, {
    headers: {
      'x-plaiground-upload-id': 'u1',
      'x-plaiground-chunk-index': '0',
      'x-plaiground-chunk-count': '2',
      'x-plaiground-filename': 'song.mp3',
      'x-plaiground-mime': 'audio/mpeg',
      'x-plaiground-total-bytes': '8',
    },
  });
  assert.strictEqual(meta0.uploadId, 'u1');
  assert.strictEqual(meta0.index, 0);
  assert.strictEqual(meta0.count, 2);

  await chunks.saveChunk({
    userId: 'user-1',
    trackId: 'track-1',
    meta: meta0,
    data: Buffer.from('ABCD'),
  });
  assert.strictEqual(await chunks.assemble({
    userId: 'user-1',
    trackId: 'track-1',
    uploadId: 'u1',
  }), null, 'incomplete upload must not assemble');

  await chunks.saveChunk({
    userId: 'user-1',
    trackId: 'track-1',
    meta: Object.assign({}, meta0, { index: 1 }),
    data: Buffer.from('EFGH'),
  });
  const assembled = await chunks.assemble({
    userId: 'user-1',
    trackId: 'track-1',
    uploadId: 'u1',
  });
  assert.ok(assembled);
  assert.strictEqual(assembled.data.toString(), 'ABCDEFGH');
  assert.strictEqual(assembled.filename, 'song.mp3');
  await chunks.drop('u1');
  assert.strictEqual(await chunks.assemble({
    userId: 'user-1',
    trackId: 'track-1',
    uploadId: 'u1',
  }), null);
  chunks.resetForTests();
  console.log('lib/audio-chunks.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
