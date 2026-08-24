'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function run() {
  const js = read('plai-bubble.js');
  const css = read('plai-bubble.css');
  const session = read('api/plai-session.js');
  const apiFiles = fs.readdirSync(path.join(__dirname, 'api'));

  assert.ok(js.includes("text: 'Talk to PLAI'"), 'Talk to PLAI button stays');
  assert.ok(js.includes("text: 'Text PLAI'"), 'Text PLAI button stays');
  assert.ok(js.includes('is-talk') && js.includes('is-text'), 'two distinct pills');
  assert.ok(js.includes('openMode(true)') && js.includes('openMode(false)'), 'Talk and Text open different modes');
  assert.ok(js.includes('if (wantMic)'), 'mic capture is gated');
  assert.ok(js.includes('openMode(false)'), 'typed send uses text mode when closed');
  assert.ok(js.includes("AGENT_ID = 'agent_BDVzp3Ar3ABtyov5'"), 'keeps the Voice Agent Builder agent');
  assert.ok(js.includes("/api/plai-session"), 'reuses the existing session route');
  assert.ok(js.includes("replace: { PLAI: 'PLAY' }"), 'spoken PLAI is PLAY');
  assert.ok(js.includes("sounds like PLAY"), 'visible name stays PLAI with PLAY hint');
  assert.ok(!js.includes('XAI_API_KEY'), 'frontend must not contain XAI_API_KEY');
  assert.ok(!js.includes('ELEVEN') && !/elevenlabs/i.test(js), 'no ElevenLabs');
  assert.ok(!js.includes('tgk_'), 'do not invent a ToneGrid key');
  assert.ok(js.indexOf('getUserMedia') === js.lastIndexOf('getUserMedia'), 'getUserMedia lives in one place');
  assert.ok(js.indexOf('async function startCapture') < js.indexOf('getUserMedia'), 'mic is only requested inside startCapture');

  const startTalk = js.slice(js.indexOf('async function startTalk'), js.indexOf('function isLive'));
  assert.ok(startTalk.includes('if (wantMic)'), 'startTalk only captures when Talk was chosen');
  assert.ok(startTalk.includes('stopCapture()'), 'Text path stops/skips the mic');

  assert.ok(css.includes('.plai-bubble-pill.is-text'), 'Text PLAI has its own chrome');
  assert.ok(css.includes('.plai-bubble-hint'), 'PLAY pronunciation hint is styled');

  assert.ok(session.includes('process.env.XAI_API_KEY'), 'session route keeps the server key');
  assert.ok(session.includes("method === 'GET'"), 'GET still reports configured without minting');
  assert.strictEqual(apiFiles.filter((name) => name.endsWith('.js')).length, 6, 'no new api/*.js files');

  const frontend = [
    'plai-bubble.js',
    'plai-bubble.css',
    'index.html',
    'faq.html',
    'site.js',
    'checkout.js',
  ];
  frontend.forEach(function (file) {
    const text = read(file);
    assert.ok(!text.includes('XAI_API_KEY'), file + ' must not leak XAI_API_KEY');
    assert.ok(!text.includes('tgk_'), file + ' must not invent a ToneGrid key');
    assert.ok(!/elevenlabs/i.test(text), file + ' must not add ElevenLabs');
  });

  console.log('plai-bubble.test.js ok');
}

run();
