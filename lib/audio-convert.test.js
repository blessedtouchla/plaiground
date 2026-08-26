'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const convert = require('./audio-convert');

async function run() {
  const mp3 = fs.readFileSync(path.join(__dirname, 'fixtures', 'tone.mp3'));
  const multipart = Buffer.concat([
    Buffer.from('--bound\r\nContent-Disposition: form-data; name="audio"; filename="tone.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'),
    mp3,
    Buffer.from('\r\n--bound--\r\n'),
  ]);

  const prepared = await convert.prepareToneGridAudio(multipart);
  assert.ok(!prepared.error, prepared.error);
  assert.strictEqual(prepared.converted, true);
  assert.strictEqual(prepared.kind, 'wav');
  assert.ok(convert.toneGridBodyIsWav(prepared.rawBody));
  assert.ok(!/audio\/mpeg|audio\/mp3|\.mp3/i.test(prepared.rawBody.slice(0, 400).toString('latin1')));
  assert.ok(/filename="tone.wav"/i.test(prepared.rawBody.slice(0, 400).toString('latin1')));
  assert.ok(prepared.rawBody.indexOf(Buffer.from('RIFF')) !== -1);
  assert.ok(prepared.rawBody.indexOf(Buffer.from('WAVE')) !== -1);
  const wavStart = prepared.rawBody.indexOf(Buffer.from('RIFF'));
  assert.strictEqual(prepared.rawBody.readUInt16LE(wavStart + 34), 16);

  const wavIn = Buffer.from(
    '------bound\r\nContent-Disposition: form-data; name="audio"; filename="song.wav"\r\nContent-Type: audio/wav\r\n\r\nRIFF....WAVE\r\n------bound--\r\n'
  );
  const passed = await convert.prepareToneGridAudio(wavIn);
  assert.strictEqual(passed.converted, false);
  assert.strictEqual(passed.kind, 'wav');
  assert.strictEqual(passed.rawBody, wavIn);

  const fromBytes = await convert.prepareFromBytes(mp3, 'tone.mp3', 'audio/mpeg');
  assert.ok(!fromBytes.error, fromBytes.error);
  assert.strictEqual(fromBytes.converted, true);
  assert.ok(convert.toneGridBodyIsWav(fromBytes.rawBody));

  const m4a = Buffer.from('Content-Disposition: form-data; name="audio"; filename="song.m4a"\r\n\r\nxx');
  const rejected = await convert.prepareToneGridAudio(m4a);
  assert.ok(rejected.error);
  assert.ok(/WAV, FLAC, or MP3/.test(rejected.error));

  assert.strictEqual(convert.incomingAudioAllowed(Buffer.from(
    'Content-Disposition: form-data; name="audio"; filename="clip.mpeg"\r\nContent-Type: audio/x-mpeg\r\n\r\nID3xx'
  )), true);
  assert.strictEqual(convert.incomingAudioAllowed(Buffer.from(
    'Content-Disposition: form-data; name="audio"; filename="memo"\r\nContent-Type: audio/mpeg3\r\n\r\nID3xx'
  )), true);
  assert.strictEqual(convert.incomingAudioAllowed(Buffer.concat([
    Buffer.from('--bound\r\nContent-Disposition: form-data; name="audio"; filename="blob"\r\nContent-Type: application/octet-stream\r\n\r\n'),
    Buffer.from([0xff, 0xfb, 0x90, 0x00]),
    Buffer.from('\r\n--bound--\r\n'),
  ])), true);
  assert.strictEqual(convert.incomingAudioAllowed(Buffer.from(
    'Content-Disposition: form-data; name="audio"; filename="song.m4a"\r\n\r\nxx'
  )), false);

  const phone = Buffer.concat([
    Buffer.from('--bound\r\nContent-Disposition: form-data; name="audio"; filename="voice-memo"\r\nContent-Type: audio/x-mpeg\r\n\r\n'),
    mp3,
    Buffer.from('\r\n--bound--\r\n'),
  ]);
  const phonePrepared = await convert.prepareToneGridAudio(phone);
  assert.ok(!phonePrepared.error, phonePrepared.error);
  assert.strictEqual(phonePrepared.converted, true);
  assert.ok(convert.toneGridBodyIsWav(phonePrepared.rawBody));

  console.log('lib/audio-convert.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
