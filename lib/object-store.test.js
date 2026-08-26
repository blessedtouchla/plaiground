'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const store = require('./object-store');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function withEnv(env, fn) {
  const names = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_ENDPOINT'];
  const prev = {};
  names.forEach((name) => {
    prev[name] = process.env[name];
    if (env && Object.prototype.hasOwnProperty.call(env, name)) {
      if (env[name] == null) delete process.env[name];
      else process.env[name] = env[name];
    } else {
      delete process.env[name];
    }
  });
  return Promise.resolve().then(fn).finally(() => {
    names.forEach((name) => {
      if (prev[name] === undefined) delete process.env[name];
      else process.env[name] = prev[name];
    });
  });
}

const READY = {
  R2_ACCOUNT_ID: 'acct-test',
  R2_ACCESS_KEY_ID: 'AKIA-TEST-NOT-REAL',
  R2_SECRET_ACCESS_KEY: 'secret-test-not-for-commit',
  R2_BUCKET: 'plaiground-uploads',
  R2_ENDPOINT: 'https://acct-test.example.test',
};

async function run() {
  await withEnv({}, async () => {
    assert.strictEqual(store.isConfigured(), false);
    assert.strictEqual(store.missingCopy(), 'We could not finish this step.');
    assert.ok(!/Cloudflare|R2|bucket|InterSpace|ToneGrid/i.test(store.missingCopy()));
    try {
      store.presignPut('audio/' + USER + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-song.wav', 'audio/wav');
      assert.fail('missing env must throw');
    } catch (err) {
      assert.strictEqual(err.message, store.missingCopy());
      assert.ok(!/Cloudflare|R2|bucket|secret|AKIA/i.test(err.message));
    }
  });

  await withEnv(READY, async () => {
    assert.strictEqual(store.isConfigured(), true);
    const audioKey = store.objectKey('audio', USER, 'Night Drive.wav');
    assert.ok(audioKey.indexOf('audio/' + USER + '/') === 0);
    assert.ok(/-Night-Drive.wav$/.test(audioKey));
    const coverKey = store.objectKey('cover', USER, 'cover.jpg');
    assert.ok(coverKey.indexOf('covers/' + USER + '/') === 0);
    assert.strictEqual(store.parseKind('artwork'), 'cover');
    assert.ok(store.isObjectKey(audioKey));
    assert.ok(store.isObjectKey(coverKey));
    assert.ok(!store.isObjectKey('https://cdn.example/cover.jpg'));
    assert.ok(!store.ownedKey(audioKey, OTHER));
    assert.ok(store.ownedKey(audioKey, USER, 'audio'));
    assert.ok(!store.ownedKey(coverKey, USER, 'audio'));
    assert.strictEqual(store.filenameOf(audioKey), 'Night-Drive.wav');

    const now = new Date('2026-08-26T03:00:00.000Z');
    const put = store.presignPut(audioKey, 'audio/wav', { now: now, expires: 300 });
    assert.ok(put.url.indexOf('https://acct-test.example.test/plaiground-uploads/' + audioKey) === 0);
    assert.ok(put.url.indexOf('X-Amz-Algorithm=AWS4-HMAC-SHA256') !== -1);
    assert.ok(put.url.indexOf('X-Amz-Signature=') !== -1);
    assert.ok(!put.url.includes('secret-test-not-for-commit'));
    assert.ok(!put.url.includes('R2_SECRET'));
    assert.strictEqual(put.headers['Content-Type'], 'audio/wav');
    assert.strictEqual(put.object_key, audioKey);
    assert.strictEqual(put.expires_in, 300);

    const get = store.presignGet(coverKey, { now: now });
    assert.ok(get.url.indexOf('X-Amz-Signature=') !== -1);
    assert.ok(!get.url.includes('secret-test-not-for-commit'));

    const wrapped = store.asMultipart('audio', 'song.wav', 'audio/wav', Buffer.from('RIFF....WAVE'));
    assert.ok(/multipart\/form-data; boundary=/.test(wrapped.contentType));
    assert.ok(wrapped.rawBody.indexOf(Buffer.from('filename="song.wav"')) !== -1);
    assert.ok(wrapped.rawBody.indexOf(Buffer.from('RIFF....WAVE')) !== -1);

    const missingKind = store.validateMint('poster', 'x.jpg', 'image/jpeg', 12);
    assert.strictEqual(missingKind.error, store.STEP_FAIL_COPY);
    const huge = store.validateMint('audio', 'song.wav', 'audio/wav', 201 * 1024 * 1024);
    assert.ok(/200 MB/i.test(huge.error));
    const ok = store.validateMint('audio', 'song.wav', 'audio/wav', 7 * 1024 * 1024);
    assert.ok(ok.ok);
  });

  const src = fs.readFileSync(path.join(__dirname, 'object-store.js'), 'utf8');
  assert.ok(!src.includes('NEXT_PUBLIC_'));
  assert.ok(src.includes('R2_ACCOUNT_ID'));
  assert.ok(src.includes('R2_ACCESS_KEY_ID'));
  assert.ok(src.includes('R2_SECRET_ACCESS_KEY'));
  assert.ok(src.includes('R2_BUCKET'));
  assert.ok(src.includes('R2_ENDPOINT'));

  const example = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
  assert.ok(/R2_ACCOUNT_ID=\s*$/m.test(example) || /R2_ACCOUNT_ID=$/m.test(example));
  assert.ok(!/AKIA|sk-|secret-[A-Za-z0-9]{8,}/.test(example));

  console.log('lib/object-store.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
