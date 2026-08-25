'use strict';

const assert = require('assert');
const accept = require('./audio-accept');

function run() {
  assert.strictEqual(accept.ERROR, 'Audio must be WAV, FLAC, or MP3.');
  assert.ok(accept.ACCEPT.indexOf('audio/*') !== -1);
  assert.ok(accept.ACCEPT.indexOf('.mp3') !== -1);
  assert.ok(accept.ACCEPT.indexOf('.mpeg') !== -1);
  assert.ok(accept.ACCEPT.indexOf('.mpga') !== -1);
  assert.ok(accept.ACCEPT.indexOf('audio/x-mpeg') !== -1);
  assert.ok(!/m4a|aac|ogg|ffmpeg/i.test(accept.ACCEPT));

  assert.ok(accept.fileLooksAllowedSync({ name: 'song.mp3', type: '' }));
  assert.ok(accept.fileLooksAllowedSync({ name: 'song.mpeg', type: '' }));
  assert.ok(accept.fileLooksAllowedSync({ name: 'song.mpga', type: 'application/octet-stream' }));
  assert.ok(accept.fileLooksAllowedSync({ name: 'recording', type: 'audio/x-mpeg' }));
  assert.ok(accept.fileLooksAllowedSync({ name: 'recording', type: 'audio/mpeg3' }));
  assert.ok(accept.fileLooksAllowedSync({ name: 'recording', type: 'audio/mpg' }));
  assert.ok(accept.fileLooksAllowedSync({ name: 'night.wav', type: '' }));
  assert.ok(accept.fileLooksAllowedSync({ name: 'night.flac', type: 'audio/x-flac' }));
  assert.ok(!accept.fileLooksAllowedSync({ name: 'song.m4a', type: 'audio/mp4' }));
  assert.ok(!accept.fileLooksAllowedSync({ name: 'song.aac', type: '' }));

  assert.ok(accept.fileLooksLikeMp3({ name: 'a.mp3', type: '' }));
  assert.ok(accept.fileLooksLikeMp3({ name: 'a.mpeg', type: 'application/octet-stream' }));
  assert.ok(accept.fileLooksLikeMp3({ name: 'clip', type: 'audio/x-mpeg' }));
  assert.ok(!accept.fileLooksLikeMp3({ name: 'a.wav', type: 'audio/wav' }));
  assert.ok(accept.fileLooksLikeWav({ name: 'master.wav', type: '' }));
  assert.ok(accept.fileLooksLikeFlac({ name: 'master.flac', type: 'audio/x-flac' }));
  assert.strictEqual(accept.convertProgressCopy({ name: 'night-drive.mp3', type: 'audio/mpeg' }), 'Converting MP3 to WAV');
  assert.strictEqual(accept.convertProgressCopy({ name: 'voice-memo', type: 'audio/x-mpeg' }), 'Converting MP3 to WAV');
  assert.strictEqual(accept.convertProgressCopy({ name: 'night-drive.wav', type: 'audio/wav' }), '');
  assert.strictEqual(accept.convertProgressCopy({ name: 'night-drive.wav', type: 'audio/mpeg' }), '');
  assert.strictEqual(accept.convertProgressCopy({ name: 'night-drive.flac', type: 'audio/flac' }), '');
  assert.strictEqual(accept.convertProgressCopy({ name: 'clip' }, 'mp3'), 'Converting MP3 to WAV');
  assert.strictEqual(accept.convertProgressCopy({ name: 'clip' }, 'aac'), 'Converting to WAV');
  assert.strictEqual(accept.convertProgressCopy({ name: 'master.wav' }, 'mp3'), '');
  assert.ok(!/MP3/.test(accept.convertProgressCopy({ name: 'clip' }, 'compressed')));

  const id3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
  const frame = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
  assert.ok(accept.looksLikeMp3Bytes(id3));
  assert.ok(accept.looksLikeMp3Bytes(frame));
  assert.ok(accept.incomingPartAllowed({ filename: 'blob', type: '', data: id3 }));
  assert.ok(accept.incomingPartAllowed({ filename: 'audio', type: 'application/octet-stream', data: frame }));
  assert.ok(accept.incomingPartAllowed({ filename: 'clip.mpeg', type: '', data: Buffer.from('xx') }));
  assert.ok(!accept.incomingPartAllowed({ filename: 'song.m4a', type: '', data: id3 }));
  assert.ok(!accept.incomingPartAllowed({ filename: 'song.ogg', type: 'audio/ogg', data: Buffer.from('xx') }));

  console.log('lib/audio-accept.test.js ok');
}

run();
