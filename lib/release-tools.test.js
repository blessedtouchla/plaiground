'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const audio = require('./lyrics-audio');
const lyrics = require('./lyrics-transcribe');
const artistDev = require('./artist-dev');
const auth = require('./auth');
const handler = require('../api/song-helper');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader: function (key, value) { this.headers[key] = value; },
    end: function (raw) {
      this.body = raw;
      this.json = JSON.parse(raw);
    },
  };
}

async function postAudio(bytes, cookie, language) {
  const res = mockRes();
  await handler({
    method: 'POST',
    url: '/api/song-helper?action=transcribe' + (language ? '&language=' + language : ''),
    headers: {
      'content-type': 'audio/wav',
      'x-forwarded-for': '203.0.113.80',
      cookie: cookie || '',
    },
    body: Buffer.from(bytes),
  }, res);
  return res;
}

function pageCopy() {
  const upload = read('upload.html');
  const client = read('store-client.js');
  const page = read('lib/release-lyrics.js');
  const maker = read('lib/cover-make.js');
  assert.ok(upload.includes('Use AI to transcribe'));
  assert.ok(upload.includes('Create cover with AI'));
  assert.ok(upload.includes('data-lyrics-transcribe'));
  assert.ok(upload.includes('>1 credit<'));
  assert.ok(upload.includes('Lyrics save with this release.'));
  assert.ok(upload.includes('lib/release-lyrics.js'));
  assert.ok(client.includes('data-lyrics-transcribe'));
  assert.ok(client.includes('>1 credit<'));
  assert.ok(page.includes('/api/song-helper?action=transcribe'));
  assert.ok(!page.includes('XAI_API_KEY'));
  assert.ok(!page.includes('api.x.ai'));
  assert.ok(maker.includes('dev-status'));
  assert.ok(maker.includes('That takes 1 credit.'));
  const fresh = [
    'Use AI to transcribe',
    'Create cover with AI',
    'Paste lyrics, or transcribe the audio and edit them before you submit. Lyrics save with this release.',
    'The transcript did not come back. Nothing was charged. Try again, or paste the lyrics.',
    'The covers took too long. Nothing was charged. Try again.',
  ];
  fresh.forEach(function (line) {
    assert.ok(!/[—–]/.test(line), line);
    assert.ok(!/Suno|ToneGrid|DistroKid/i.test(line), line);
    assert.ok(!/\bfree\b/i.test(line), line);
  });
  assert.ok(read('api/song-helper.js').includes('action === \'transcribe\''));
  assert.ok(read('api/song-helper.js').includes('lyrics-transcribe'));
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'api', 'transcribe.js')));
  assert.strictEqual(lyrics.DEFAULT_MODEL, 'grok-voice-transcribe-2.0');
  assert.strictEqual(lyrics.STT_URL, 'https://api.x.ai/v1/stt');
}

function audioPack() {
  const samples = new Float32Array(44100);
  samples[0] = 0.5;
  samples[100] = -0.25;
  const packed = audio.packWav(samples, 44100, audio.MAX_BYTES);
  assert.strictEqual(packed.mime, 'audio/wav');
  assert.strictEqual(packed.trimmed, false);
  assert.strictEqual(packed.rate, 16000);
  assert.strictEqual(String.fromCharCode(packed.bytes[0], packed.bytes[1], packed.bytes[2], packed.bytes[3]), 'RIFF');
  const trimmed = audio.packWav(new Float32Array(16000), 16000, 1000);
  assert.strictEqual(trimmed.trimmed, true);
  assert.ok(trimmed.bytes.length <= 1000);
  const mixed = audio.mixDown({
    numberOfChannels: 2,
    length: 2,
    sampleRate: 8000,
    getChannelData: function (channel) {
      return channel === 0 ? new Float32Array([1, 0]) : new Float32Array([0, 1]);
    },
  });
  assert.strictEqual(mixed.rate, 8000);
  assert.ok(Math.abs(mixed.samples[0] - 0.5) < 0.001);
  assert.strictEqual(lyrics.languageCode('en'), 'en');
  assert.strictEqual(lyrics.languageCode('es-MX'), 'es');
  assert.strictEqual(lyrics.languageCode('klingon'), '');
  const lines = lyrics.linesFromTranscript({
    text: 'hello there friend',
    words: [
      { text: 'hello', start: 0.1, end: 0.4 },
      { text: 'there', start: 0.5, end: 0.8 },
      { text: 'friend', start: 1.6, end: 2.0 },
    ],
  });
  assert.strictEqual(lines, 'hello there\nfriend');
}

async function billing() {
  const previousKey = process.env.XAI_API_KEY;
  const previousSecret = process.env.SESSION_SECRET;
  const originalFetch = global.fetch;
  process.env.SESSION_SECRET = 'lyric-test-secret';
  delete process.env.XAI_API_KEY;
  artistDev.resetStore();
  try {
    const missing = await lyrics.transcribeRelease('lyric-user', Buffer.from('abc'), { mime: 'audio/wav' });
    assert.strictEqual(missing.status, 503);
    assert.strictEqual(missing.charged, false);
    assert.ok(/Nothing was charged/.test(missing.error));
    assert.strictEqual((await artistDev.balance('lyric-user')).credits, artistDev.ALLOWANCE);

    process.env.XAI_API_KEY = 'test-stt-key-not-real';
    let calls = 0;
    global.fetch = function (url, opts) {
      calls += 1;
      assert.strictEqual(url, lyrics.STT_URL);
      assert.strictEqual(opts.headers.Authorization, 'Bearer test-stt-key-not-real');
      assert.ok(opts.body instanceof FormData);
      return Promise.resolve({
        ok: true,
        json: async function () {
          return {
            text: 'kitchen light',
            words: [
              { text: 'kitchen', start: 0, end: 0.4 },
              { text: 'light', start: 0.5, end: 0.9 },
            ],
          };
        },
      });
    };
    const token = auth.signSession('lyric-user');
    const cookie = auth.COOKIE + '=' + encodeURIComponent(token);
    const wav = audio.encodeWav(new Float32Array([0.1, -0.1, 0.2]), 16000);
    const ok = await postAudio(wav, cookie, 'en');
    assert.strictEqual(ok.statusCode, 200, ok.body);
    assert.strictEqual(ok.json.charged, true);
    assert.strictEqual(ok.json.lyrics, 'kitchen light');
    assert.strictEqual(ok.json.credits, artistDev.ALLOWANCE - 1);
    assert.strictEqual(calls, 1);
    assert.ok(!ok.body.includes('test-stt-key-not-real'));

    global.fetch = function () {
      return Promise.resolve({ ok: false, status: 500, json: async function () { return {}; } });
    };
    const failed = await postAudio(wav, cookie, 'en');
    assert.strictEqual(failed.statusCode, 502);
    assert.strictEqual(failed.json.charged, false);
    assert.ok(/Nothing was charged/.test(failed.json.error));
    assert.strictEqual((await artistDev.balance('lyric-user')).credits, artistDev.ALLOWANCE - 1);

    global.fetch = function () {
      return Promise.resolve({
        ok: true,
        json: async function () { return { text: 'you are a nigga in this verse' }; },
      });
    };
    const blocked = await postAudio(wav, cookie);
    assert.strictEqual(blocked.statusCode, 400);
    assert.strictEqual(blocked.json.charged, false);
    assert.strictEqual((await artistDev.balance('lyric-user')).credits, artistDev.ALLOWANCE - 1);

    const beforeLeft = (await artistDev.balance('lyric-user')).credits;
    global.fetch = function () {
      return Promise.resolve({
        ok: true,
        json: async function () { return { text: 'kitchen light stayed on' }; },
      });
    };
    const gone = await lyrics.transcribeRelease('lyric-user', wav, {
      mime: 'audio/wav',
      stillHere: function () { return false; },
    });
    assert.strictEqual(gone.status, 502);
    assert.strictEqual(gone.charged, false);
    assert.ok(/Nothing was charged/.test(gone.error));
    assert.strictEqual((await artistDev.balance('lyric-user')).credits, beforeLeft);

    const anon = await postAudio(wav, '');
    assert.strictEqual(anon.statusCode, 401);
    assert.strictEqual((await artistDev.balance('lyric-user')).credits, artistDev.ALLOWANCE - 1);

    let left = (await artistDev.balance('lyric-user')).credits;
    while (left > 0) {
      await artistDev.spendCredit('lyric-user');
      left -= 1;
    }
    calls = 0;
    global.fetch = function () {
      calls += 1;
      return Promise.resolve({ ok: true, json: async function () { return { text: 'nope' }; } });
    };
    const broke = await postAudio(wav, cookie);
    assert.strictEqual(broke.statusCode, 402);
    assert.strictEqual(broke.json.error, 'That takes 1 credit.');
    assert.strictEqual(calls, 0);
  } finally {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousKey;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
}

async function run() {
  pageCopy();
  audioPack();
  await billing();
  console.log('lib/release-tools.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
