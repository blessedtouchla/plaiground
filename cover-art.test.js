'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('./lib/cover-art');
const song = require('./lib/song-helper');
const handler = require('./api/cover-art');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
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

function mockReq(body, ip) {
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': ip || '198.51.100.10' },
    body: body,
  };
}

async function post(body, ip) {
  const res = mockRes();
  await handler(mockReq(body, ip), res);
  return res;
}

function payload(extra) {
  return Object.assign({
    look: 'painted',
    palette: 'night',
    idea: 'A kitchen light left on at blue hour, a chipped mug in the frame.',
    count: 3,
    session_id: 'session-cover-1',
  }, extra || {});
}

function runCore() {
  assert.strictEqual(core.DEFAULT_IMAGE_MODEL, 'grok-imagine-image-2.0');
  assert.strictEqual(core.EXPORT_PX, 3000);
  assert.strictEqual(core.PLACEHOLDER_NOTICE, 'Preview mode: placeholder art, not AI-generated.');
  assert.strictEqual(core.IMAGE_RIGHTS, song.COVER_IMAGE_RIGHTS);
  assert.strictEqual(core.SESSION_IMAGE_MAX, 8);

  const clean = core.buildImagePrompt({
    look: 'painted',
    palette: 'night',
    idea: 'A kitchen light left on at blue hour.',
  });
  assert.ok(clean.prompt.includes('No text, no letters'));
  assert.ok(clean.prompt.includes('no logos'));
  assert.ok(clean.prompt.includes('#120818'));
  assert.ok(!clean.stripped);

  const named = core.guardCoverText('a neon room in the style of Drake, with a Nike logo');
  assert.strictEqual(named.rejected, false);
  assert.strictEqual(named.stripped, true);
  assert.ok(!/drake/i.test(named.text));
  assert.ok(!/nike/i.test(named.text));
  assert.strictEqual(named.note, core.STRIP_NOTE);

  const picasso = core.guardCoverText('Painted in the style of Picasso at dusk');
  assert.ok(!/picasso/i.test(picasso.text));
  assert.ok(picasso.stripped);

  const likeness = core.guardCoverText('A portrait of Beyonce on a balcony');
  assert.ok(!/beyonce/i.test(likeness.text));
  assert.ok(likeness.stripped);

  const explicit = core.guardCoverText('a nude portrait in the kitchen');
  assert.strictEqual(explicit.rejected, true);
  assert.strictEqual(explicit.text, '');
  assert.strictEqual(explicit.note, core.EXPLICIT_NOTE);

  const suggested = core.suggestFromSong({
    mood: 'heartbroken',
    place: 'the kitchen at 2am',
    room: 'a chipped mug',
    color: 'faded red',
    time: 'just after midnight',
  });
  assert.ok(suggested.idea.includes('heartbroken'));
  assert.ok(suggested.idea.includes('the kitchen at 2am'));
  assert.ok(suggested.idea.includes('a chipped mug'));
  assert.ok(suggested.idea.includes('faded red'));
  assert.ok(suggested.idea.includes('just after midnight'));

  const images = core.placeholderImages({ look: 'minimal', palette: 'sea', idea: 'rain' }, 4);
  assert.strictEqual(images.length, 4);
  assert.ok(images.every(function (image) { return image.colors[0] === '#071820' && image.look === 'minimal'; }));
  assert.ok(!JSON.stringify(images).includes('b64'));
}

async function runApi() {
  const previousKey = process.env.XAI_API_KEY;
  const previousModel = process.env.XAI_IMAGE_MODEL;
  delete process.env.XAI_API_KEY;
  delete process.env.XAI_IMAGE_MODEL;
  const originalFetch = global.fetch;
  let fetched = false;
  global.fetch = function () {
    fetched = true;
    return Promise.reject(new Error('fetch should not run'));
  };
  try {
    const sample = await post(payload({ session_id: 'preview-session-a' }), '198.51.100.20');
    assert.strictEqual(sample.statusCode, 200);
    assert.strictEqual(fetched, false);
    assert.strictEqual(sample.json.preview, true);
    assert.strictEqual(sample.json.source, 'placeholder');
    assert.strictEqual(sample.json.notice, core.PLACEHOLDER_NOTICE);
    assert.strictEqual(sample.json.attribution, '');
    assert.strictEqual(sample.json.upscale, false);
    assert.strictEqual(sample.json.images.length, 3);
    assert.ok(!sample.body.includes('Written with Grok'));
    assert.ok(!sample.body.includes(core.ARTWORK_CREDIT));

    const honey = await post(payload({ company_website: 'https://spam.example', session_id: 'honey-session-1' }), '198.51.100.21');
    assert.strictEqual(honey.statusCode, 400);

    const dirty = await post(payload({ idea: 'a naked portrait', session_id: 'explicit-session' }), '198.51.100.22');
    assert.strictEqual(dirty.statusCode, 400);
    assert.strictEqual(dirty.json.error, core.EXPLICIT_NOTE);
    assert.ok(!dirty.body.includes('naked'));

    const stripped = await post(payload({
      idea: 'blue hour in the style of Drake with a Spotify logo',
      session_id: 'strip-session-1',
    }), '198.51.100.23');
    assert.strictEqual(stripped.statusCode, 200);
    assert.strictEqual(stripped.json.note, core.STRIP_NOTE);

    for (let i = 0; i < 10; i += 1) {
      const ok = await post(payload({ session_id: 'rate-session-' + i }), '198.51.100.30');
      assert.strictEqual(ok.statusCode, 200, 'request ' + i);
    }
    const limited = await post(payload({ session_id: 'rate-over' }), '198.51.100.30');
    assert.strictEqual(limited.statusCode, 429);

    const first = await post(payload({ count: 3, session_id: 'cap-session-99' }), '198.51.100.40');
    const second = await post(payload({ count: 3, session_id: 'cap-session-99' }), '198.51.100.40');
    const third = await post(payload({ count: 4, session_id: 'cap-session-99' }), '198.51.100.40');
    const fourth = await post(payload({ count: 2, session_id: 'cap-session-99' }), '198.51.100.40');
    assert.strictEqual(first.json.images.length, 3);
    assert.strictEqual(second.json.images.length, 3);
    assert.strictEqual(third.json.images.length, 2);
    assert.strictEqual(fourth.statusCode, 429);

    process.env.XAI_API_KEY = 'test-image-key';
    process.env.XAI_IMAGE_MODEL = 'grok-imagine-image-2.0';
    let sent = null;
    global.fetch = function (url, opts) {
      sent = { url: url, opts: opts };
      return Promise.resolve({
        ok: true,
        json: async function () {
          return { data: [{ b64_json: 'aGVsbG8=' }, { b64_json: 'd29ybGQ=' }] };
        },
      });
    };
    const live = await post(payload({
      count: 2,
      session_id: 'grok-session-1',
      idea: 'a quiet room in the style of Drake',
    }), '198.51.100.50');
    assert.strictEqual(live.statusCode, 200);
    assert.strictEqual(live.json.preview, false);
    assert.strictEqual(live.json.source, 'grok');
    assert.strictEqual(live.json.attribution, core.ARTWORK_CREDIT);
    assert.strictEqual(live.json.notice, '');
    assert.strictEqual(live.json.upscale, true);
    assert.ok(live.json.upscaleNote.includes('3000'));
    assert.strictEqual(sent.url, 'https://api.x.ai/v1/images/generations');
    const body = JSON.parse(sent.opts.body);
    assert.strictEqual(body.model, 'grok-imagine-image-2.0');
    assert.strictEqual(body.resolution, '2k');
    assert.strictEqual(body.aspect_ratio, '1:1');
    assert.strictEqual(body.quality, 'low');
    assert.strictEqual(body.response_format, 'b64_json');
    assert.strictEqual(body.n, 2);
    assert.ok(body.prompt.includes('No text, no letters'));
    assert.ok(!/drake/i.test(body.prompt));
    assert.strictEqual(sent.opts.headers.Authorization, 'Bearer test-image-key');
    assert.ok(!live.body.includes('test-image-key'));
  } finally {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.XAI_IMAGE_MODEL;
    else process.env.XAI_IMAGE_MODEL = previousModel;
  }
}

function runPage() {
  const html = read('cover-art.html');
  const js = read('cover-art.js');
  const api = read('api/cover-art.js');
  const index = read('index.html');
  const vercel = JSON.parse(read('vercel.json'));
  const nav = html.match(/<nav class="nav-links"[\s\S]*?<\/nav>/)[0];
  const songPage = read('song-helper.html');
  const songNav = songPage.match(/<nav class="nav-links"[\s\S]*?<\/nav>/)[0];

  assert.ok(html.includes('PLAIGROUND Song Helper'));
  assert.ok(html.includes('You must be 18+ to use the Song Helper.'));
  assert.ok(html.includes('Covers are AI-assisted'));
  assert.ok(html.includes('name="company_website"'));
  assert.ok(html.includes('Suggest from my song'));
  assert.ok(html.includes('No URLs'));
  assert.ok(html.includes('No social handles'));
  assert.ok(html.includes('No prices'));
  assert.ok(html.includes('No store logos'));
  assert.ok(html.includes('3000×3000'));
  assert.ok(html.includes('noindex'));
  assert.ok(!nav.includes('cover-art'));
  assert.ok(!nav.includes('song-helper'));
  assert.ok(!songNav.includes('cover-art'));
  assert.ok(songPage.includes('href="/cover-art"'));
  assert.ok(!/Grok/.test(html), 'Grok stays off the page chrome');
  assert.ok(!/Powered by Grok/i.test(html + js));
  assert.ok(!/hit song|guaranteed/i.test(html + js));
  assert.ok(!html.includes('XAI_API_KEY') && !js.includes('XAI_API_KEY'));
  assert.ok(!html.includes('api.x.ai') && !js.includes('api.x.ai'));
  assert.ok(js.includes('core.PLACEHOLDER_NOTICE'));
  assert.ok(js.includes('banner.hidden = !preview'));
  assert.ok(js.includes('imageSmoothingQuality = \'high\''));
  assert.ok(js.includes('core.EXPORT_PX'));
  assert.ok(api.includes('XAI_API_KEY'));
  assert.ok(api.includes('XAI_IMAGE_MODEL'));
  assert.ok(api.includes('https://api.x.ai/v1/images/generations'));
  assert.ok(api.includes('Cloudflare Turnstile'));
  assert.ok(/in-memory/i.test(api));
  assert.ok(api.includes('resolution: \'2k\''));
  assert.ok(!index.includes('cover-art'));
  assert.ok(!index.includes('song-helper'));
  assert.ok((vercel.rewrites || []).some(function (row) {
    return row.source === '/cover-art' && row.destination === '/cover-art.html';
  }));
  ['terms.html', 'privacy.html', 'rights.html'].forEach(function (file) {
    assert.ok(!read(file).includes('Cover image'));
    assert.ok(!read(file).includes('Song Helper'));
  });
}

async function run() {
  runCore();
  await runApi();
  runPage();
  console.log('cover-art.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
