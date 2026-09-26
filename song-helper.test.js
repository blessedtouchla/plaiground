'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('./lib/song-helper');
const handler = require('./api/song-helper');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function fixture(extra) {
  const base = {
    mood: 'heartbroken',
    happened: 'You left your hoodie on my chair and did not come back.',
    who: 'M',
    why: 'You stopped answering when I asked you to stay.',
    line: 'I still set a place for you like you are coming home.',
    words: {
      place: 'the kitchen at 2am',
      room: 'your hoodie on the chair',
      color: 'faded red',
      smell: 'cold coffee',
      sound: 'the fridge humming',
      time: 'just after midnight',
      says: 'we will figure it out',
    },
    shape: { genre: 'R&B', language: 'english', explicit: 'clean', length: 'full' },
    variant: 0,
  };
  return Object.assign(base, extra || {});
}

function userStrings(interview) {
  return core.collectUserStrings(interview).map(function (item) { return item.text; });
}

function allLines(draft) {
  const lines = [];
  draft.hooks.forEach(function (hook) { lines.push(hook); });
  draft.sections.forEach(function (section) {
    section.lines.forEach(function (line) { lines.push(line); });
  });
  return lines;
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
    headers: { 'x-forwarded-for': ip || '203.0.113.10' },
    body: body,
  };
}

async function post(body, ip) {
  const res = mockRes();
  await handler(mockReq(body, ip), res);
  return res;
}

function runCore() {
  const interview = fixture();
  const draft = core.buildSampleDraft(interview);
  const lines = allLines(draft);

  assert.strictEqual(core.DEFAULT_MODEL, 'grok-4.20-0309-non-reasoning');
  assert.ok(/never reproduce/i.test(core.SYSTEM_PROMPT));
  assert.ok(/never imitate a real artist/i.test(core.SYSTEM_PROMPT));
  assert.ok(/character for character/i.test(core.SYSTEM_PROMPT));
  assert.ok(/JSON only/i.test(core.SYSTEM_PROMPT));

  userStrings(interview).forEach(function (text) {
    const hit = lines.filter(function (line) { return line.text === text; });
    assert.ok(hit.length, 'missing verbatim line: ' + text);
    assert.ok(hit.every(function (line) { return line.source === 'user'; }), 'user line not marked: ' + text);
  });

  assert.strictEqual(draft.hooks[0].text, interview.line);
  assert.strictEqual(draft.hooks[0].source, 'user');
  assert.ok(draft.sections[0].lines.some(function (line) {
    return line.role !== 'hook' && line.text === interview.line && line.source === 'user';
  }), 'the user line stays in the verse when the chorus hook changes');
  assert.notStrictEqual(draft.hooks[1].text, interview.line);
  assert.strictEqual(draft.hooks[1].source, 'generated');
  assert.deepStrictEqual(draft.sections.map(function (section) { return section.label; }), [
    'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus',
  ]);
  assert.ok(draft.sections.filter(function (section) { return section.label === 'Chorus'; }).every(function (section) {
    return section.lines.some(function (line) { return line.role === 'hook' && line.text === interview.line; });
  }));

  const short = core.buildSampleDraft(fixture({
    shape: { genre: 'R&B', language: 'english', explicit: 'clean', length: 'short' },
  }));
  assert.deepStrictEqual(short.sections.map(function (section) { return section.label; }), [
    'Verse', 'Chorus', 'Verse', 'Chorus',
  ]);
  userStrings(interview).forEach(function (text) {
    assert.ok(allLines(short).some(function (line) { return line.text === text && line.source === 'user'; }));
  });

  const again = core.buildSampleDraft(fixture({ variant: 1 }));
  const firstGen = allLines(draft).filter(function (line) { return line.source === 'generated'; })[0].text;
  const nextGen = allLines(again).filter(function (line) { return line.source === 'generated'; })[0].text;
  assert.notStrictEqual(firstGen, nextGen);
  assert.strictEqual(again.hooks[0].text, interview.line);

  const spanish = core.buildSampleDraft(fixture({
    shape: { genre: 'Latin', language: 'spanish', explicit: 'clean', length: 'full' },
  }));
  assert.ok(allLines(spanish).some(function (line) { return line.text === 'La luz del pasillo se quedó encendida.'; }));
  assert.ok(allLines(spanish).some(function (line) { return line.text === interview.line && line.source === 'user'; }));

  const drake = core.stripArtistNames('intimate, in the style of Taylor Swift');
  assert.strictEqual(drake.stripped, true);
  assert.ok(!/taylor swift/i.test(drake.text));
  const kept = core.stripArtistNames('like Indie Pop');
  assert.strictEqual(kept.stripped, false);
  assert.ok(/indie pop/i.test(kept.text));

  const style = core.buildStylePrompt({
    genre: 'R&B',
    era: '2010s',
    energy: 'medium',
    voice: 'female',
    texture: 'smooth',
    instruments: ['piano', 'bass', 'synth', 'organ'],
    feeling: 'intimate like Drake',
  });
  assert.strictEqual(style.artistNamesStripped, true);
  assert.strictEqual(style.note, 'We describe the sound instead of naming artists.');
  assert.ok(style.prompt.includes('R&B'));
  assert.ok(style.prompt.includes('2010s'));
  assert.ok(style.prompt.includes('medium energy'));
  assert.ok(style.prompt.includes('smooth female vocal'));
  assert.ok(style.prompt.includes('piano'));
  assert.ok(style.prompt.includes('bass'));
  assert.ok(style.prompt.includes('synth'));
  assert.ok(!style.prompt.includes('organ'));
  assert.ok(!/drake/i.test(style.prompt));
  assert.ok(!/taylor/i.test(style.prompt));

  const record = core.formatAuthorship(draft, {
    preview: true,
    date: 'September 26, 2026',
    interview: interview,
  });
  assert.ok(record.includes('September 26, 2026'));
  assert.ok(record.includes(core.COPYRIGHT_SENTENCE));
  assert.ok(record.includes('You wrote this'));
  assert.ok(record.includes('Sample line, not written by AI'));
  assert.ok(record.includes(interview.line));
  assert.ok(!record.includes('Written with Grok'));
  assert.strictEqual(core.describeLine({ source: 'generated', text: 'x', original: 'x' }, false), 'Written with Grok');

  const repaired = core.draftFromModelJson(JSON.stringify({
    title: 'A draft',
    hooks: [
      { id: 'a', text: 'Not the user line at all.', source: 'generated' },
      { id: 'b', text: 'A second original hook for the chorus.', source: 'generated' },
    ],
    sections: [
      { label: 'Verse', lines: [{ text: 'Only a generated line, featuring Drake.', source: 'generated' }] },
    ],
  }), interview);
  assert.strictEqual(repaired.hooks[0].text, interview.line);
  assert.strictEqual(repaired.hooks[0].source, 'user');
  userStrings(interview).forEach(function (text) {
    assert.ok(allLines(repaired).some(function (line) { return line.text === text; }), 'repair dropped ' + text);
  });
  assert.ok(!allLines(repaired).some(function (line) { return /drake/i.test(line.text) && line.source === 'generated'; }));

  const limiter = core.createLimiter({ max: 2, windowMs: 1000 });
  assert.strictEqual(limiter.allow('10.0.0.1', 1000), true);
  assert.strictEqual(limiter.allow('10.0.0.1', 1001), true);
  assert.strictEqual(limiter.allow('10.0.0.1', 1002), false);
  assert.strictEqual(limiter.allow('10.0.0.2', 1002), true);
  assert.strictEqual(limiter.allow('10.0.0.1', 2500), true);

  assert.throws(function () {
    core.normalizeInterview({ mood: 'x'.repeat(41), words: {}, shape: {} });
  }, function (err) { return err.code === 'long'; });
}

async function runApi() {
  const previousKey = process.env.XAI_API_KEY;
  const previousModel = process.env.XAI_MODEL;
  const originalFetch = global.fetch;
  delete process.env.XAI_API_KEY;
  let fetchCalls = 0;
  global.fetch = function () {
    fetchCalls += 1;
    return Promise.reject(new Error('fetch should not run without a key'));
  };
  try {
    const preview = await post(fixture(), '203.0.113.20');
    assert.strictEqual(preview.statusCode, 200);
    assert.strictEqual(preview.json.ok, true);
    assert.strictEqual(preview.json.preview, true);
    assert.strictEqual(preview.json.source, 'sample');
    assert.strictEqual(preview.json.notice, core.PREVIEW_NOTICE);
    assert.strictEqual(preview.json.attribution, '');
    assert.strictEqual(fetchCalls, 0);
    assert.ok(!preview.body.includes('XAI_API_KEY'));
    assert.strictEqual(preview.json.draft.hooks[0].text, fixture().line);

    const honeyIp = '203.0.113.21';
    for (let i = 0; i < core.RATE_MAX; i += 1) handler._limiter.allow(honeyIp);
    const honey = await post(Object.assign(fixture(), { company_website: 'https://spam.test' }), honeyIp);
    assert.strictEqual(honey.statusCode, 400);
    assert.strictEqual(honey.json.ok, false);
    const blocked = await post(fixture(), honeyIp);
    assert.strictEqual(blocked.statusCode, 429);

    const long = await post(Object.assign(fixture(), { happened: 'y'.repeat(281) }), '203.0.113.22');
    assert.strictEqual(long.statusCode, 400);
    assert.ok(/shorten/i.test(long.json.error));

    const huge = mockRes();
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.23' },
      body: 'x'.repeat(core.BODY_MAX + 1),
    }, huge);
    assert.strictEqual(huge.statusCode, 413);

    const get = mockRes();
    await handler({ method: 'GET', headers: {}, body: {} }, get);
    assert.strictEqual(get.statusCode, 405);

    process.env.XAI_API_KEY = 'test-key-not-real';
    process.env.XAI_MODEL = 'grok-4.3';
    let sent;
    global.fetch = function (url, opts) {
      sent = { url: url, opts: opts };
      return Promise.resolve({
        ok: true,
        json: async function () {
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  title: 'From the model',
                  hooks: [
                    { id: 'a', text: 'Rewritten hook', source: 'generated' },
                    { id: 'b', text: 'Second hook that is original.', source: 'generated' },
                  ],
                  sections: [{ label: 'Chorus', lines: [{ text: 'A generated chorus line.', source: 'generated' }] }],
                }),
              },
            }],
          };
        },
      });
    };
    const live = await post(fixture(), '203.0.113.24');
    assert.strictEqual(live.statusCode, 200);
    assert.strictEqual(live.json.preview, false);
    assert.strictEqual(live.json.source, 'grok');
    assert.strictEqual(live.json.attribution, core.GROK_ATTRIBUTION);
    assert.strictEqual(live.json.notice, '');
    assert.strictEqual(sent.url, 'https://api.x.ai/v1/chat/completions');
    const payload = JSON.parse(sent.opts.body);
    assert.strictEqual(payload.model, 'grok-4.3');
    assert.strictEqual(payload.reasoning_effort, 'none');
    assert.strictEqual(sent.opts.headers.Authorization, 'Bearer test-key-not-real');
    assert.ok(!live.body.includes('test-key-not-real'));
    assert.strictEqual(live.json.draft.hooks[0].text, fixture().line);

    process.env.XAI_MODEL = 'grok-4.20-0309-non-reasoning';
    await post(fixture(), '203.0.113.25');
    const nonReason = JSON.parse(sent.opts.body);
    assert.strictEqual(nonReason.model, 'grok-4.20-0309-non-reasoning');
    assert.strictEqual(nonReason.reasoning_effort, undefined);
  } finally {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.XAI_MODEL;
    else process.env.XAI_MODEL = previousModel;
  }
}

function runPage() {
  const html = read('song-helper.html');
  const js = read('song-helper.js');
  const api = read('api/song-helper.js');
  const index = read('index.html');
  const vercel = JSON.parse(read('vercel.json'));
  const nav = html.match(/<nav class="nav-links"[\s\S]*?<\/nav>/)[0];

  assert.ok(html.includes('PLAIGROUND Song Helper'));
  assert.ok(html.includes('You must be 18+ to use the Song Helper.'));
  assert.ok(html.includes('your words'));
  assert.ok(html.includes('Drafts are AI-assisted.'));
  assert.ok(html.includes('name="company_website"'));
  assert.ok(html.includes('href="/ar"'));
  assert.ok(html.includes('href="/epk"'));
  assert.ok(html.includes('href="how-it-works.html#distribute"'));
  assert.ok(html.includes('noindex'));
  assert.ok(!nav.includes('song-helper'));
  assert.ok(!/Grok/.test(html), 'Grok stays off the page chrome');
  assert.ok(!/Powered by Grok/i.test(html + js));
  assert.ok(!/hit song|guaranteed/i.test(html + js));
  assert.ok(!html.includes('XAI_API_KEY') && !js.includes('XAI_API_KEY'));
  assert.ok(!html.includes('api.x.ai') && !js.includes('api.x.ai'));
  assert.ok(js.includes('core.PREVIEW_NOTICE'));
  assert.ok(js.includes('banner.hidden = !preview'));
  assert.ok(api.includes('XAI_API_KEY'));
  assert.ok(api.includes('https://api.x.ai/v1/chat/completions'));
  assert.ok(api.includes('Cloudflare Turnstile'));
  assert.ok(/in-memory/i.test(api));
  assert.ok(!index.includes('song-helper'));
  assert.ok((vercel.rewrites || []).some(function (row) {
    return row.source === '/song-helper' && row.destination === '/song-helper.html';
  }));
  ['terms.html', 'privacy.html', 'rights.html'].forEach(function (file) {
    assert.ok(!read(file).includes('Song Helper'));
  });
}

async function run() {
  runCore();
  await runApi();
  runPage();
  console.log('song-helper.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
