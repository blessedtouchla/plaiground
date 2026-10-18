'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const flow = require('./song-v3-flow');
const writer = require('./song-v3');
const features = require('./features');

function textOf(state) {
  return JSON.stringify(flow.view(state));
}

function walk(state, type, id) {
  return flow.act(state, { type: type, id: id });
}

function run() {
  var hall = flow.view(flow.fresh());
  assert.strictEqual(hall.plai, "Pick a machine. I'll host.");
  assert.deepStrictEqual(hall.tiles.map(function (tile) { return tile.label; }), [
    'Write or fix my song',
    'Make a parody',
    'Remix my song',
  ]);
  assert.ok(hall.tiles[1].soon && hall.tiles[2].soon);

  var parody = walk(flow.fresh(), 'tile', 'parody');
  assert.strictEqual(parody.screen, 'soon-parody');
  assert.ok(/Coming soon/.test(flow.view(parody).plai));
  var remix = walk(flow.fresh(), 'tile', 'remix');
  assert.strictEqual(remix.screen, 'soon-remix');
  assert.ok(/Coming soon/.test(flow.view(remix).plai));

  var state = walk(flow.fresh(), 'tile', 'write');
  assert.strictEqual(state.screen, 'a1');
  assert.strictEqual(flow.view(state).skip, true);
  state = walk(state, 'tile', 'fix');
  assert.strictEqual(state.screen, 'fix-soon');
  assert.ok(/coming soon/i.test(flow.view(state).plai));

  state = walk(walk(flow.fresh(), 'tile', 'write'), 'skip');
  assert.strictEqual(state.screen, 'a2');
  assert.strictEqual(state.mode, 'fresh');
  state = walk(state, 'skip');
  assert.strictEqual(state.path, 'ai');
  assert.strictEqual(state.label, 'Fully AI');
  assert.strictEqual(state.screen, 'a3');

  var sound = flow.fresh();
  sound.screen = 'a8';
  assert.strictEqual(flow.view(sound).skip, false);
  assert.strictEqual(flow.act(sound, { type: 'skip' }).screen, 'a8');
  sound = flow.act(sound, { type: 'next' });
  assert.strictEqual(sound.screen, 'a8');
  assert.ok(/Pick the sound/.test(sound.notice));

  state = flow.fresh();
  state = walk(state, 'tile', 'write');
  state = walk(state, 'tile', 'fresh');
  state = walk(state, 'tile', 'human');
  assert.strictEqual(state.label, 'Human');
  state = walk(state, 'tile', 'love');
  assert.strictEqual(state.screen, 'a4');
  state = walk(state, 'tile', 'start');
  assert.strictEqual(state.screen, 'a5');
  state = walk(state, 'tile', 'Joy');
  state = walk(state, 'tile', 'Funny');
  state = walk(state, 'tile', 'Anger');
  assert.ok(/Pick up to 2/.test(state.notice));
  assert.deepStrictEqual(state.feelings, ['Joy', 'Funny']);
  state = flow.act(state, { type: 'next' });
  assert.strictEqual(state.screen, 'a5s');
  state = walk(state, 'tile', 'friendly');
  state = flow.act(state, { type: 'text', field: 'title', value: 'Salt on Sunday' });
  state = flow.act(state, { type: 'next' });
  assert.strictEqual(state.screen, 'a6w');
  assert.strictEqual(flow.view(state).marquee, 'Salt on Sunday');
  state = flow.act(state, { type: 'next' });
  state = flow.act(state, { type: 'text', field: 'scene', value: 'We stood by the bus stop with a paper cup' });
  state = flow.act(state, { type: 'next' });
  assert.strictEqual(state.screen, 'a8');
  var genres = flow.view(state).tiles.map(function (tile) { return tile.label; });
  assert.ok(genres.indexOf('Hip-hop') !== -1 && genres.indexOf('Surprise me') !== -1);
  assert.ok(flow.view(state).tiles.some(function (tile) { return tile.badge === 'Fits your song'; }));
  state = walk(state, 'tile', 'Country');
  assert.ok(/real place/.test(flow.view(state).note));
  state = flow.act(state, { type: 'chip', group: 'language', id: 'English' });
  state = flow.act(state, { type: 'chip', group: 'explicit', id: 'Clean' });
  state = flow.act(state, { type: 'next' });
  assert.strictEqual(state.screen, 'a9');
  assert.strictEqual(flow.view(state).advanced.open, false);
  assert.strictEqual(flow.view(state).advanced.groups.length, 7);
  state = flow.act(state, { type: 'advanced-toggle' });
  state = flow.act(state, { type: 'advanced', group: 'speed', id: 'slow' });
  state = walk(state, 'tile', 'Late night');
  state = flow.act(state, { type: 'next' });
  assert.strictEqual(state.screen, 'a10h');
  assert.ok(state.chorus.indexOf('Salt on Sunday') !== -1);
  assert.ok(flow.view(state).rhyme);
  assert.ok(flow.view(state).checks.some(function (row) { return row.id === 'title' && row.on; }));
  var asked = flow.act(state, { type: 'question', id: 'why' });
  assert.ok(/Why does this title matter/.test(flow.view(asked).plai));
  assert.strictEqual(asked.chorus, state.chorus);

  state = flow.act(state, { type: 'next' });
  assert.strictEqual(state.screen, 'a10v');
  state = flow.act(state, { type: 'next' });
  assert.strictEqual(state.screen, 'reveal');
  assert.strictEqual(flow.view(state).scoreLine, 'New high score');
  var reveal = flow.view(state);
  assert.ok(reveal.tweaks.length === 4);
  assert.ok(reveal.style.indexOf('slow tempo') !== -1);
  assert.ok(!/suno|tonegrid/i.test(reveal.style));

  var ai = flow.fresh();
  ai.screen = 'a10a';
  ai.path = 'ai';
  ai.label = 'Fully AI';
  ai.title = 'Salt on Sunday';
  ai.scene = 'We stood by the bus stop with a paper cup';
  ai.genre = 'Hip-hop';
  ai.feelings = ['Joy'];
  ai.rushed = true;
  assert.ok(/more it sounds like you/.test(flow.view(ai).note));
  var wallet = { freeLeft: 1, credits: 0 };
  assert.strictEqual(flow.quote(wallet).free, true);
  assert.strictEqual(flow.buttonPrice(wallet, 'Write my song'), 'Write my song (free)');
  wallet = flow.charge(wallet);
  assert.deepStrictEqual(wallet, { freeLeft: 0, credits: 0 });
  assert.strictEqual(flow.quote(wallet).ok, false);
  var song = writer.compose(flow.brief(ai));
  ai = flow.act(ai, { type: 'wrote', song: song });
  assert.strictEqual(ai.screen, 'reveal');
  assert.strictEqual(ai.label, 'Fully AI');
  assert.strictEqual(writer.countIntent(ai.lyrics, 'I want this song to make them smile.'), 0);
  assert.ok(!/\bjoy\b/i.test(ai.lyrics));
  assert.ok(ai.lyrics.indexOf('Salt on Sunday') !== -1);

  var human = flow.fresh();
  human.screen = 'a10t';
  human.path = 'human';
  human.label = 'Human';
  human.title = 'Salt on Sunday';
  human.chorus = 'Salt on Sunday';
  var lines = writer.giveLines(flow.brief(human), [human.chorus]);
  human = flow.act(human, { type: 'offer', lines: lines });
  human = flow.act(human, { type: 'keep', line: lines[0] });
  assert.strictEqual(human.label, 'AI-assisted');
  assert.ok(/AI-assisted now/.test(human.notice));
  assert.ok(lines.indexOf(human.chorus) === -1 || human.chorus.indexOf(lines[0]) !== -1);

  // AI-assisted path: chorus, then verse, then a reveal that shows their words.
  var together = flow.fresh();
  together.screen = 'a10t';
  together.path = 'together';
  together.label = 'AI-assisted';
  together.title = 'Conrad';
  together.chorus = 'Conrad\nYou kept the porch light on';
  together = flow.act(together, { type: 'next' });
  assert.strictEqual(together.screen, 'a10v');
  together.verse = 'We drove past the old mill road';
  together = flow.act(together, { type: 'next' });
  assert.strictEqual(together.screen, 'reveal');
  var shown = flow.view(together);
  assert.ok(!shown.empty);
  assert.ok(shown.lyrics.indexOf('[Verse 1]\nWe drove past the old mill road') !== -1);
  assert.ok(shown.lyrics.indexOf('[Chorus]\nConrad') !== -1);
  assert.ok(shown.checks.some(function (row) { return row.label === 'Sings right to them'; }));
  assert.ok(!shown.checks.some(function (row) { return /You is/.test(row.label); }));

  // An empty reveal never paints a blank box; it offers a way back.
  var blank = flow.fresh();
  blank.path = 'together';
  blank.screen = 'a10v';
  blank.chorus = '';
  blank.verse = '';
  blank = flow.act(blank, { type: 'next' });
  var blankView = flow.view(blank);
  assert.strictEqual(blankView.empty, true);
  assert.strictEqual(blankView.retry, 'back');
  assert.strictEqual(blankView.checks.length, 0);

  var screens = ['hall', 'a1', 'a2', 'a3', 'a4', 'a5', 'a5s', 'a6', 'a6w', 'a7', 'a7x', 'a8', 'a9', 'a10a', 'a10h', 'a10t', 'a10v', 'reveal', 'soon-parody', 'soon-remix', 'fix-soon'];
  screens.forEach(function (id) {
    var sample = flow.fresh();
    sample.screen = id;
    sample.title = 'Salt on Sunday';
    sample.feelings = ['Joy'];
    sample.addressee = 'love';
    var blob = textOf(sample);
    assert.ok(!/[\u2014\u2013]/.test(blob), id + ' has a dash');
    assert.ok(!/suno|tonegrid/i.test(blob), id + ' names a music app');
  });

  ['lib/song-v3-gate.js', 'song-helper-v3.js', 'song-helper-v3.css', 'lib/song-v3-flow.js'].forEach(function (file) {
    var body = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.ok(!/[\u2014\u2013]/.test(body), file);
    assert.ok(!/suno|tonegrid/i.test(body), file);
  });
  assert.strictEqual(features.FLAGS.SONG_HELPER_V3, false);
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'song-helper.html'), 'utf8').indexOf('song-helper-v3') === -1);

  return Promise.resolve();
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader: function (name, value) { this.headers[name] = value; },
    end: function (chunk) { this.body = chunk == null ? '' : String(chunk); },
  };
}

var TEST_KEY = 'test-key-0123456789';
process.env.SONG_HELPER_V3_KEY_SHA256 = require('crypto').createHash('sha256').update(TEST_KEY).digest('hex');

async function runGate() {
  var handler = require('../api/song-helper');
  var gate = require('../lib/song-v3-gate');
  var res;
  // Page: no key or a wrong key goes to the live Song Helper.
  for (var bad of ['', '&k=', '&k=wrong-key-0123456789', '&k=short']) {
    res = mockRes();
    await handler({ method: 'GET', url: '/api/song-helper?action=v3-page' + bad, headers: {} }, res);
    assert.strictEqual(res.statusCode, 302, 'page without key ' + bad);
    assert.strictEqual(res.headers.Location, '/song-helper');
    assert.ok(res.body.indexOf('v3-app') === -1);
  }
  res = mockRes();
  await handler({ method: 'GET', url: '/api/song-helper?action=v3-page&k=' + TEST_KEY, headers: {} }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(/text\/html/.test(res.headers['Content-Type']));
  assert.ok(/noindex/.test(res.headers['X-Robots-Tag']));
  assert.ok(/no-store/.test(res.headers['Cache-Control']));
  assert.strictEqual(res.headers['Referrer-Policy'], 'no-referrer');
  assert.ok(res.body.indexOf('id="v3"') !== -1 && res.body.indexOf('noindex') !== -1);
  res = mockRes();
  await handler({ method: 'GET', query: { action: 'v3-page', k: TEST_KEY }, headers: {} }, res);
  assert.strictEqual(res.statusCode, 200, 'query object form');
  // Write actions: no key or a wrong key is a 404 and never reaches the model.
  for (var action of ['v3-write', 'v3-line', 'v3-finish', 'v3-fix']) {
    for (var key of [undefined, '', 'wrong-key-0123456789']) {
      res = mockRes();
      var body = { action: action, title: 'Salt on Sunday', partial: 'I', line: 'x' };
      if (key !== undefined) body.k = key;
      await handler({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.90' }, body: body }, res);
      assert.strictEqual(res.statusCode, 404, action + ' key ' + key);
    }
  }
  // A 404 does not use up the 8/hour budget.
  res = mockRes();
  await handler({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.90' }, body: { action: 'v3-fix', k: TEST_KEY, line: 'x' } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(gate.keyOk(TEST_KEY));
  assert.ok(!gate.keyOk('test-key-0123456788'));
  // The static page file only sends people to the live Song Helper, so the page is only reachable through the gate.
  var stub = fs.readFileSync(path.join(__dirname, '..', 'song-helper-v3.html'), 'utf8');
  assert.ok(stub.indexOf('url=/song-helper"') !== -1 && stub.indexOf('noindex') !== -1);
  assert.ok(stub.indexOf('song-v3') === -1 && stub.indexOf('id="v3"') === -1);
  var vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  var v3Routes = vercel.rewrites.filter(function (r) { return r.source.indexOf('song-helper-v3') !== -1; });
  assert.ok(v3Routes.length >= 1 && v3Routes.every(function (r) { return r.destination === '/api/song-helper?action=v3-page'; }));
  // The client sends the key with every write.
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'song-helper-v3.js'), 'utf8').indexOf('body.k = pageKey()') !== -1);
}

async function runApi() {
  var handler = require('../api/song-helper');
  var xai = require('../lib/xai-client');
  var previousKey = process.env.XAI_API_KEY;
  var previousModel = process.env.XAI_MODEL;
  var originalChat = xai.chat;
  delete process.env.XAI_API_KEY;
  var res = mockRes();
  await handler({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.10' }, body: { action: 'v3-write', k: TEST_KEY, title: 'Salt on Sunday', genre: 'Pop' } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(features.FLAGS.SONG_HELPER_V3, false);
  var off = JSON.parse(res.body);
  assert.strictEqual(off.sample, true);
  assert.strictEqual(off.source, 'sample');
  assert.ok(/Sample\./.test(off.notice));
  assert.ok(res.body.indexOf('XAI_API_KEY') === -1);

  features.FLAGS.SONG_HELPER_V3 = true;
  var i;
  for (i = 0; i < 8; i++) {
    res = mockRes();
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.11' },
      body: { action: 'v3-write', k: TEST_KEY, title: 'Salt on Sunday', genre: 'Country', feelings: ['Heartbreak'], scene: 'We stood by the bus stop with a paper cup', intent_private: 'I want this song to make them cry.' },
    }, res);
    assert.strictEqual(res.statusCode, 200, 'write ' + i + ' ' + res.body.slice(0, 180));
    var payload = JSON.parse(res.body);
    assert.strictEqual(payload.sample, true);
    assert.strictEqual(writer.countIntent(payload.song.text, 'I want this song to make them cry.'), 0);
    assert.ok(res.body.indexOf('XAI_API_KEY') === -1);
  }
  res = mockRes();
  await handler({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.11' }, body: { action: 'v3-write', k: TEST_KEY, title: 'Salt on Sunday' } }, res);
  assert.strictEqual(res.statusCode, 429);
  res = mockRes();
  await handler({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.12' }, body: { action: 'v3-line', k: TEST_KEY, company_website: 'http://spam.test', title: 'Salt on Sunday' } }, res);
  assert.strictEqual(res.statusCode, 400);

  process.env.XAI_API_KEY = 'test-key-not-real';
  process.env.XAI_MODEL = 'grok-test';
  var calls = [];
  xai.chat = async function (opts) {
    calls.push(opts);
    if (calls.length === 1) return { content: 'I want this song to make them cry.', model: 'grok-test' };
    return {
      content: '[Verse 1]\nYou hold the paper cup by the bus\n[Chorus]\nSalt on Sunday\n',
      model: 'grok-test',
    };
  };
  res = mockRes();
  await handler({
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.20' },
    body: {
      action: 'v3-write', k: TEST_KEY,
      title: 'Salt on Sunday',
      genre: 'Hip-hop',
      feelings: ['Joy'],
      scene: 'We stood by the bus stop with a paper cup',
      intent_private: 'I want this song to make them cry.',
      advanced: { delivery: 'rapped' },
    },
  }, res);
  assert.strictEqual(res.statusCode, 200, res.body.slice(0, 240));
  var model = JSON.parse(res.body);
  assert.strictEqual(model.sample, false);
  assert.strictEqual(model.source, 'model');
  assert.ok(model.song.retried, 'failed rule retries once');
  assert.strictEqual(calls.length, 2);
  assert.ok(calls[0].messages[1].content.indexOf('Salt on Sunday') !== -1);
  assert.ok(calls[0].messages[1].content.indexOf('rapped') !== -1);
  assert.ok(calls[0].messages[1].content.indexOf('I want this song to make them cry.') === -1);
  assert.ok(calls[1].messages[1].content.indexOf('private aim') !== -1);
  assert.strictEqual(writer.countIntent(model.song.text, 'I want this song to make them cry.'), 0);
  assert.ok(res.body.indexOf('test-key-not-real') === -1);

  calls = [];
  xai.chat = async function () { throw new Error('xai'); };
  res = mockRes();
  await handler({
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.21' },
    body: { action: 'v3-write', k: TEST_KEY, title: 'Salt on Sunday', genre: 'Country' },
  }, res);
  var fell = JSON.parse(res.body);
  assert.strictEqual(fell.sample, true);
  assert.ok(/Sample\./.test(fell.notice));

  xai.chat = async function () {
    return { content: 'echoes in the room\nwhispers on the curb\n[Chorus]\nSalt on Sunday\n', model: 'grok-test' };
  };
  res = mockRes();
  await handler({
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.22' },
    body: { action: 'v3-write', k: TEST_KEY, title: 'Salt on Sunday', genre: 'Pop', feelings: ['Joy'] },
  }, res);
  assert.strictEqual(res.statusCode, 422, res.body.slice(0, 240));
  var blocked = JSON.parse(res.body);
  assert.strictEqual(blocked.ok, false);
  assert.ok(!/town red old/.test(res.body));

  xai.chat = originalChat;
  if (previousKey == null) delete process.env.XAI_API_KEY;
  else process.env.XAI_API_KEY = previousKey;
  if (previousModel == null) delete process.env.XAI_MODEL;
  else process.env.XAI_MODEL = previousModel;
  features.FLAGS.SONG_HELPER_V3 = false;
}

run().then(runGate).then(runApi).then(function () {
  console.log('song-v3-flow tests passed');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
