'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const modes = require('./lib/song-modes');
const slang = require('./lib/slang');
const reddit = require('./lib/reddit-slang');
const spark = require('./lib/spark');
const sparkFeed = require('./lib/spark-feed');
const guard = require('./lib/song-guard');
const cover = require('./lib/cover-art');
const importer = require('./scripts/import-slang');
const handler = require('./api/song-helper');
const questions = require('./lib/song-questions');

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

async function post(body, ip, url) {
  const res = mockRes();
  await handler({
    method: 'POST',
    url: url || '/api/song-helper',
    headers: { 'x-forwarded-for': ip || '198.51.100.8' },
    body: body,
  }, res);
  return res;
}

function concrete(extra) {
  return Object.assign({
    mode: 'flip',
    place: 'the kitchen at 2am',
    object: 'a chipped mug',
    quote: 'we will figure it out',
    genre: 'country',
    mood: 'nostalgic',
    craft: { rabbit: true, rhyme: 'slant' },
  }, extra || {});
}

function runModes() {
  const ids = modes.MODES.map(function (mode) { return mode.id; });
  ['write', 'hook', 'flip', 'funkify', 'funny', 'madlibs', 'review', 'parody', 'public-domain', 'cover', 'homage', 'superhero', 'bars', 'poem', 'battle'].forEach(function (id) {
    assert.ok(ids.indexOf(id) !== -1, id);
  });
  assert.strictEqual(modes.modeById('hook').label, 'Hook');
  assert.strictEqual(modes.modeById('flip').label, 'Flip it');
  assert.strictEqual(modes.modeById('flip').transform, true);
  assert.strictEqual(modes.modeById('funkify').transform, true);
  assert.ok(!modes.modeById('write').transform);
  assert.ok(!modes.modeById('hook').transform);
  assert.ok(modes.FUNNY_METERS.some(function (row) { return row.label === 'Savage'; }));
  assert.ok(modes.BAR_STYLES.some(function (row) { return row.id === 'drill'; }));
  assert.ok(modes.POEM_FORMS.some(function (row) { return row.id === 'fortune'; }));
  assert.ok(/not written by AI/i.test(modes.DEMO_NOTICE));
  assert.ok(!/grok/i.test(modes.DEMO_NOTICE));

  const flip = modes.buildSample(concrete());
  assert.strictEqual(flip.preview, true);
  assert.strictEqual(flip.source, 'sample');
  assert.strictEqual(flip.notice, modes.DEMO_NOTICE);
  assert.ok(modes.allLines(flip.draft).some(function (line) {
    return line.text === 'we will figure it out' && line.source === 'user';
  }));
  assert.strictEqual(modes.yoursPercent(modes.allLines(flip.draft)) > 0, true);

  const thin = modes.buildSample(concrete({ place: '', object: '', quote: '', mood: '' }));
  assert.strictEqual(thin.ok, false);
  assert.ok(/will not invent/i.test(thin.error));
  assert.ok(/Paste lyrics/i.test(thin.error));
  const funnyThin = modes.buildSample(concrete({ mode: 'funny', place: '', object: '', quote: '' }));
  assert.strictEqual(funnyThin.ok, false);
  assert.ok(/Rabbit hole/i.test(funnyThin.error));
  const noMood = modes.buildSample(concrete({ mood: '' }));
  assert.strictEqual(noMood.ok, false);
  assert.ok(/feeling/i.test(noMood.error));
  const pasted = modes.buildSample({
    mode: 'funkify',
    lines: 'I left the mug in the sink\nYou said we will figure it out',
    place: '',
    object: '',
    quote: '',
    mood: '',
    craft: { rabbit: true },
  });
  assert.strictEqual(pasted.ok, true);
  assert.ok(modes.allLines(pasted.draft).some(function (row) {
    return row.source === 'user' && row.text.indexOf('mug in the sink') !== -1;
  }));
  const flipPaste = modes.buildSample({
    mode: 'flip',
    lines: 'I left the mug in the sink',
    genre: '',
    craft: { rabbit: false },
  });
  assert.strictEqual(flipPaste.ok, false);
  assert.ok(/genre/i.test(flipPaste.error));
  const flipKept = modes.buildSample({
    mode: 'flip',
    lines: 'I left the mug in the sink',
    genre: 'country',
    craft: { rabbit: false },
  });
  assert.strictEqual(flipKept.ok, true);
  assert.ok(/country/i.test(JSON.stringify(flipKept.draft)));
  assert.ok(modes.systemPrompt(modes.normalizeInput(concrete())).toLowerCase().indexOf('first-draft') !== -1);
  assert.ok(/do not invent/i.test(modes.systemPrompt(modes.normalizeInput(concrete()))));
  const transformedPrompt = modes.systemPrompt(modes.normalizeInput({
    mode: 'funkify',
    lines: 'I left the mug in the sink',
  }));
  assert.ok(/lyrics the writer already pasted/i.test(transformedPrompt));
  const keptNorm = modes.normalizeInput({ mode: 'flip', lines: 'Line one\nLine two', genre: 'soul', mood: 'hyped', place: 'kitchen', object: 'mug', quote: 'stay' });
  assert.ok(keptNorm.lines.indexOf('\n') !== -1);
  assert.ok(modes.userPrompt(keptNorm).indexOf('Line one') !== -1);
  const modelKept = modes.draftFromModel(JSON.stringify({
    title: 'Moved',
    sections: [{ label: 'Verse', lines: ['A new pocket line.'] }],
  }), keptNorm);
  assert.ok(JSON.stringify(modelKept).indexOf('Line one') !== -1);
  assert.ok(JSON.stringify(modelKept).indexOf('Line two') !== -1);

  const hookAnswers = {
    mode: 'hook',
    line: 'I still set a place for you at the table.',
    happened: 'You left the hoodie on the chair.',
    why: 'You stopped answering when I asked you to stay.',
  };
  const hookMissing = modes.buildSample({ mode: 'hook', line: '', happened: '', why: '' });
  assert.strictEqual(hookMissing.ok, false);
  assert.ok(/hook sentence/i.test(hookMissing.error));
  const hookFake = modes.buildSample({
    mode: 'hook',
    line: 'The hook sentence, what happened, and why',
    happened: 'The heart keeps beating even when the answers stay unseen',
    why: 'Because the night was long enough already.',
  });
  assert.strictEqual(hookFake.ok, false);
  assert.ok(/placeholder/i.test(hookFake.error));
  const hookSample = modes.buildSample(hookAnswers);
  assert.strictEqual(hookSample.ok, true);
  assert.strictEqual(hookSample.preview, true);
  const hookLines = modes.allLines(hookSample.draft).map(function (row) { return row.text; });
  assert.deepStrictEqual(hookLines, [hookAnswers.line, hookAnswers.happened, hookAnswers.why]);
  assert.ok(modes.allLines(hookSample.draft).every(function (row) { return row.source === 'user'; }));
  assert.ok(!/answers stay unseen|The hook sentence, what happened, and why/i.test(JSON.stringify(hookSample)));
  const cleaned = modes.draftFromModel(JSON.stringify({
    title: 'Echo',
    sections: [{
      label: 'Chorus',
      lines: [
        'The hook sentence, what happened, and why',
        'The heart keeps beating even when the answers stay unseen',
        'A generated line that can stay.',
      ],
    }],
  }), modes.normalizeInput(hookAnswers));
  const cleanedText = JSON.stringify(cleaned);
  assert.ok(cleanedText.includes(hookAnswers.line));
  assert.ok(cleanedText.includes(hookAnswers.happened));
  assert.ok(cleanedText.includes(hookAnswers.why));
  assert.ok(cleanedText.includes('A generated line that can stay.'));
  assert.ok(!/answers stay unseen/i.test(cleanedText));
  assert.ok(!/The hook sentence, what happened, and why/.test(cleanedText));
  assert.strictEqual(modes.draftFromModel('not json', modes.normalizeInput(hookAnswers)), null);

  const parody = modes.buildSample(concrete({
    mode: 'parody',
    originalTitle: 'Old Song',
    title: 'Old Song',
    comment: 'The original pretends the town is fine.',
  }));
  assert.strictEqual(parody.ok, false);
  assert.ok(/look-alike/i.test(parody.error));

  const parodyOk = modes.buildSample(concrete({
    mode: 'parody',
    originalTitle: 'Old Song',
    title: 'The town is not fine',
    comment: 'The original pretends the town is fine.',
    parodyAck: false,
  }));
  assert.strictEqual(parodyOk.step, 'critique');
  assert.strictEqual(parodyOk.critique.ok, true);
  assert.ok(/fair use/i.test(parodyOk.critique.fairUse));
  assert.ok(/parody/i.test(parodyOk.critique.release));

  const voiced = modes.parodyCritique({
    originalTitle: 'Old Song',
    title: 'A different title',
    comment: 'Please clone the voice of the singer.',
    artNote: '',
  });
  assert.strictEqual(voiced.ok, true, 'voice clone is the shared filter, not the title check');
  assert.strictEqual(guard.contentFilter('clone the voice of the singer').ok, false);

  const pd = modes.buildSample({
    mode: 'public-domain',
    work: 'Rhapsody in Blue',
    year: '1924',
    kind: 'composition',
    craft: { rabbit: true },
  });
  assert.strictEqual(pd.ok, true);
  assert.ok(/1924/.test(JSON.stringify(pd.draft)));
  assert.ok(/Copyright Office|Music Modernization/i.test(pd.draft.notes.join(' ')));
  const late = modes.pdCheck({ year: '1931', kind: 'composition', work: 'Later' });
  assert.strictEqual(late.ok, false);
  const rec = modes.pdCheck({ year: '1926', kind: 'recording', work: 'A record' });
  assert.strictEqual(rec.ok, false);

  assert.ok(modes.MECHANICAL_STEPS.length >= 5);
  assert.ok(!modes.MECHANICAL_STEPS.join(' ').match(/\$\d/));
  const steps = modes.buildSample({ mode: 'cover', craft: { rabbit: false } });
  assert.ok(steps.draft.steps.length >= 5);

  assert.ok(modes.heroBlocked('batman'));
  assert.ok(!modes.heroBlocked('Mina'));
  assert.ok(modes.clicheHits('I wear my heart on my sleeve').length);
  const ruler = modes.lineRuler('I left the mug');
  assert.strictEqual(ruler.count, 4);
  assert.ok(/rough count/i.test(ruler.note));
  const suno = modes.sunoPrecheck('Write it in the style of someone famous.');
  assert.strictEqual(suno.ok, false);

  const homage = modes.buildSample(concrete({ mode: 'homage', name: 'Mina' }));
  assert.ok(homage.draft.notes.some(function (note) { return /not affiliated/i.test(note); }));

  const sparked = modes.normalizeInput({
    mode: 'flip',
    place: 'the kitchen at 2am',
    object: 'a chipped mug',
    sparkTitle: 'The group chat went quiet',
    sparkAngle: 'Write it from the person who muted the chat.',
    mood: 'nostalgic',
  });
  assert.strictEqual(sparked.quote, 'Write it from the person who muted the chat.');
  assert.strictEqual(sparked.mood, 'nostalgic');
  assert.ok(modes.userPrompt(sparked).includes('muted the chat'));
  const sparkedDraft = modes.buildSample(sparked);
  assert.strictEqual(sparkedDraft.ok, true);
  assert.ok(modes.allLines(sparkedDraft.draft).some(function (line) {
    return line.source === 'user' && line.text.indexOf('muted the chat') !== -1;
  }));
  const withStory = modes.normalizeInput({
    mode: 'flip',
    mood: 'nostalgic',
    place: 'the kitchen at 2am',
    object: 'a chipped mug',
    quote: 'leave the light on',
    sparkFeel: 'I feel late to my own street.',
    sparkStory: 'I got there and the gate was already down.',
    sparkKeep: 'Keep the sound of the lock.',
  });
  assert.strictEqual(withStory.sparkStory, 'I got there and the gate was already down.');
  assert.ok(modes.userPrompt(withStory).includes('gate was already down'));
  const storyDraft = modes.buildSample(withStory);
  assert.strictEqual(storyDraft.ok, true);
  ['late to my own street', 'gate was already down', 'sound of the lock'].forEach(function (bit) {
    assert.ok(modes.allLines(storyDraft.draft).some(function (line) {
      return line.source === 'user' && line.text.indexOf(bit) !== -1;
    }), bit);
  });
  const skipped = modes.buildSample({
    mode: 'flip',
    mood: 'nostalgic',
    place: 'the kitchen at 2am',
    object: 'a chipped mug',
    quote: 'leave the light on',
    sparkFeel: '',
    sparkStory: '',
    sparkKeep: '',
  });
  assert.ok(!modes.allLines(skipped.draft).some(function (line) {
    return /how do you feel|personal experience|hold onto/i.test(line.text);
  }));
  const modelStory = modes.draftFromModel(JSON.stringify({
    title: 'Kept',
    sections: [{ label: 'Verse', lines: ['A generated line.'] }],
  }), withStory);
  assert.ok(JSON.stringify(modelStory).indexOf('gate was already down') !== -1);

  const emptySection = modes.sectionFromAnswers('verse', { who: '', happened: '', why: '' });
  assert.strictEqual(emptySection.ok, false);
  assert.ok(/placeholder/i.test(emptySection.error));
  const fakeSection = modes.sectionFromAnswers('hook', {
    line: 'The hook sentence, what happened, and why',
    happened: 'You left the hoodie on the chair.',
    why: 'You stopped answering when I asked you to stay.',
  });
  assert.strictEqual(fakeSection.ok, false);
  const verse = modes.sectionFromAnswers('verse', {
    who: 'M',
    happened: 'You left the hoodie on the chair.',
    why: 'The room still smells like rain.',
  });
  assert.strictEqual(verse.ok, true);
  assert.strictEqual(verse.section.label, 'Verse');
  assert.deepStrictEqual(verse.section.lines.map(function (row) { return row.text; }), [
    'M',
    'You left the hoodie on the chair.',
    'The room still smells like rain.',
  ]);
  assert.ok(verse.section.lines.every(function (row) { return row.source === 'user'; }));
  const bridge = modes.sectionFromAnswers('bridge', {
    turn: 'The light in the kitchen goes out.',
    who: 'M',
    why: 'The song needs the quiet after the fight.',
  });
  assert.strictEqual(bridge.ok, true);
  assert.strictEqual(bridge.section.label, 'Bridge');
  assert.ok(!/placeholder|craft dial/i.test(JSON.stringify(bridge.section)));
}

function runSlang() {
  const rows = slang.entriesFrom(null);
  assert.ok(rows.length >= 10);
  const hot = rows.filter(function (row) { return row.word === 'dat bih gah'; })[0];
  assert.ok(hot.profanity);
  assert.ok(hot.sources.length);
  assert.ok(slang.regions(null).indexOf('Toronto') !== -1);
  const toronto = slang.suggest(null, 'Toronto', { profanity: false });
  assert.ok(toronto.some(function (row) { return row.word === 'crodie'; }));
  assert.ok(/urbandictionary|greenline/i.test(slang.tooltip(toronto[0])));
  const hidden = slang.suggest(null, 'national/online', { profanity: false });
  assert.ok(!hidden.some(function (row) { return row.profanity; }));
  const csv = fs.readFileSync(path.join(__dirname, 'data', 'slang-log.csv'), 'utf8');
  const imported = importer.importCsv(csv);
  assert.strictEqual(imported.length, rows.length);
  assert.strictEqual(reddit.notConfigured().configured, false);
  assert.ok(/not configured/i.test(reddit.notConfigured().error));
}

function runSpark() {
  const pack = spark.pack();
  assert.ok(pack.demo);
  assert.ok(/sample/i.test(pack.notice));
  pack.items.forEach(function (item) {
    assert.strictEqual(item.sourceLabel, spark.SAMPLE_LABEL);
    assert.strictEqual(item.sourceUrl, '');
    assert.ok(!spark.tragedy(item.title + ' ' + item.detail));
    assert.ok(!/\$\d|\b\d{3,}\b|million|billion|#1|views/i.test(JSON.stringify(item)));
  });
  assert.ok(pack.daily.dailyNote);
  assert.ok(spark.LANES.some(function (lane) { return lane.id === 'news-world'; }));
  assert.ok(spark.LANES.some(function (lane) { return lane.id === 'causes'; }));
  assert.ok(spark.GROUPS.some(function (group) { return group.id === 'news' && group.label === 'News'; }));
  ['trending', 'news-world', 'news-music', 'news-movies', 'news-regional', 'causes', 'mindset'].forEach(function (lane) {
    const topics = spark.topicsFor(pack.items, [lane]);
    assert.ok(topics.length >= 2, lane + ' topics');
    topics.forEach(function (topic) {
      const heads = spark.headlinesFor(pack.items, [lane], topic.label);
      assert.ok(heads.length >= 2, topic.label);
      heads.forEach(function (head) {
        const ideas = spark.sparksFor(pack.items, [lane], topic.label, head.label);
        assert.ok(ideas.length >= 1);
        ideas.forEach(function (idea) {
          assert.ok(idea.flip && idea.answer);
          assert.notStrictEqual(idea.headline, idea.title);
          assert.ok(idea.headline.split(/\s+/).length <= 7);
        });
      });
    });
  });
  assert.strictEqual(spark.sparksFor(pack.items, ['news-world'], 'Shop hours', '').length, 0);
  assert.ok(/optional/i.test(spark.ASK.optional));
  assert.ok(/more human the draft feels/i.test(spark.ASK.optional));
  assert.ok(/personal experience/i.test(spark.ASK.story));
  assert.strictEqual(spark.tragedy('A shooting downtown'), true);
  const xml = '<rss><channel><title>Feed</title><item><title>Library hours</title></item><item><title>A shooting downtown</title></item></channel></rss>';
  const titles = sparkFeed.titlesFromXml(xml);
  assert.deepStrictEqual(titles, ['Library hours']);
}

async function runApi() {
  const previous = {
    key: process.env.XAI_API_KEY,
    disabled: process.env.SONG_HELPER_DISABLED,
    site: process.env.TURNSTILE_SITE_KEY,
    secret: process.env.TURNSTILE_SECRET_KEY,
    limit: process.env.SONG_HELPER_DAILY_LIMIT,
    redditId: process.env.REDDIT_CLIENT_ID,
    redditSecret: process.env.REDDIT_CLIENT_SECRET,
  };
  delete process.env.XAI_API_KEY;
  delete process.env.SONG_HELPER_DISABLED;
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.REDDIT_CLIENT_ID;
  delete process.env.REDDIT_CLIENT_SECRET;
  guard.dailyLimiter.reset();
  const originalFetch = global.fetch;
  let fetches = 0;
  global.fetch = function () {
    fetches += 1;
    return Promise.reject(new Error('fetch should not run'));
  };
  try {
    const hookGap = await post({ mode: 'hook' }, '203.0.113.90');
    assert.strictEqual(hookGap.statusCode, 400);
    assert.ok(/hook sentence/i.test(hookGap.json.error));
    assert.ok(!hookGap.json.draft);
    assert.strictEqual(fetches, 0);

    const hookDemo = await post({
      mode: 'hook',
      line: 'I still set a place for you at the table.',
      happened: 'You left the hoodie on the chair.',
      why: 'You stopped answering when I asked you to stay.',
    }, '203.0.113.91');
    assert.strictEqual(hookDemo.statusCode, 200);
    assert.strictEqual(hookDemo.json.preview, true);
    assert.strictEqual(hookDemo.json.source, 'sample');
    assert.ok(JSON.stringify(hookDemo.json.draft).includes('I still set a place for you at the table.'));
    assert.ok(!/answers stay unseen|The hook sentence, what happened, and why/i.test(hookDemo.body));
    assert.strictEqual(fetches, 0);

    const demo = await post(concrete(), '203.0.113.80');
    assert.strictEqual(demo.statusCode, 200);
    assert.strictEqual(demo.json.preview, true);
    assert.strictEqual(demo.json.source, 'sample');
    assert.strictEqual(demo.json.notice, modes.DEMO_NOTICE);
    assert.strictEqual(fetches, 0);
    assert.ok(!demo.body.includes('XAI_API_KEY'));

    const slangRes = mockRes();
    await handler({ method: 'GET', url: '/api/song-helper?action=slang&region=Toronto', headers: {} }, slangRes);
    assert.strictEqual(slangRes.statusCode, 200);
    assert.ok(slangRes.json.entries.some(function (row) { return row.word === 'crodie'; }));

    const refresh = mockRes();
    await handler({ method: 'POST', url: '/api/slang/refresh', query: { action: 'slang-refresh' }, headers: {}, body: {} }, refresh);
    assert.strictEqual(refresh.statusCode, 200);
    assert.strictEqual(refresh.json.configured, false);
    assert.ok(/not configured/i.test(refresh.json.error));

    const sparkRes = mockRes();
    await handler({ method: 'GET', url: '/api/spark', query: { action: 'spark' }, headers: {} }, sparkRes);
    assert.strictEqual(sparkRes.statusCode, 200);
    assert.strictEqual(sparkRes.json.demo, true);

    const status = mockRes();
    await handler({ method: 'GET', url: '/api/song-helper?action=status', headers: {} }, status);
    assert.strictEqual(status.json.demo, true);
    assert.strictEqual(status.json.turnstile, false);
    assert.strictEqual(status.json.turnstileSiteKey, '');

    const bareGet = mockRes();
    await handler({ method: 'GET', headers: {}, body: {} }, bareGet);
    assert.strictEqual(bareGet.statusCode, 405);

    process.env.SONG_HELPER_DISABLED = '1';
    const killed = await post(concrete(), '203.0.113.81');
    assert.strictEqual(killed.statusCode, 503);
    assert.strictEqual(killed.json.disabled, true);
    delete process.env.SONG_HELPER_DISABLED;

    process.env.XAI_API_KEY = 'test-key-not-real';
    const hookBody = {
      mode: 'hook',
      line: 'I still set a place for you at the table.',
      happened: 'You left the hoodie on the chair.',
      why: 'You stopped answering when I asked you to stay.',
    };
    global.fetch = function () {
      fetches += 1;
      return Promise.reject(new Error('xai down'));
    };
    const hookDown = await post(hookBody, '203.0.113.92');
    assert.strictEqual(hookDown.statusCode, 502);
    assert.ok(/did not come back/i.test(hookDown.json.error));
    assert.ok(!hookDown.json.draft);
    assert.ok(!/answers stay unseen|The hook sentence, what happened, and why/i.test(hookDown.body));

    global.fetch = function () {
      fetches += 1;
      return Promise.resolve({
        ok: true,
        json: async function () {
          return { choices: [{ message: { content: 'not json at all' } }] };
        },
      });
    };
    const hookBad = await post(hookBody, '203.0.113.93');
    assert.strictEqual(hookBad.statusCode, 502);
    assert.ok(!hookBad.json.draft);
    assert.ok(!/answers stay unseen/i.test(hookBad.body));

    global.fetch = function () {
      fetches += 1;
      return Promise.resolve({
        ok: true,
        json: async function () {
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  title: 'From her answers',
                  sections: [{
                    label: 'Chorus',
                    lines: [
                      'The hook sentence, what happened, and why',
                      'The heart keeps beating even when the answers stay unseen',
                    ],
                  }],
                }),
              },
            }],
          };
        },
      });
    };
    const hookLive = await post(hookBody, '203.0.113.94');
    assert.strictEqual(hookLive.statusCode, 200);
    assert.strictEqual(hookLive.json.preview, false);
    assert.strictEqual(hookLive.json.source, 'grok');
    const liveHook = JSON.stringify(hookLive.json.draft);
    assert.ok(liveHook.includes(hookBody.line));
    assert.ok(liveHook.includes(hookBody.happened));
    assert.ok(liveHook.includes(hookBody.why));
    assert.ok(!/answers stay unseen/i.test(liveHook));
    assert.ok(!/The hook sentence, what happened, and why/.test(liveHook));
    delete process.env.XAI_API_KEY;
    global.fetch = function () {
      fetches += 1;
      return Promise.reject(new Error('fetch should not run'));
    };

    process.env.XAI_API_KEY = 'test-key-not-real';
    process.env.TURNSTILE_SITE_KEY = 'site-test';
    process.env.TURNSTILE_SECRET_KEY = 'secret-test';
    const fetchesBeforeCaptcha = fetches;
    const captcha = await post(concrete(), '203.0.113.82');
    assert.strictEqual(captcha.statusCode, 400);
    assert.ok(/person/i.test(captcha.json.error));
    assert.strictEqual(fetches, fetchesBeforeCaptcha);
    delete process.env.XAI_API_KEY;
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;

    process.env.SONG_HELPER_DAILY_LIMIT = '2';
    guard.dailyLimiter.reset();
    const first = await post(concrete(), '203.0.113.83');
    const second = await post(concrete(), '203.0.113.83');
    const third = await post(concrete(), '203.0.113.83');
    assert.strictEqual(first.statusCode, 200);
    assert.strictEqual(second.statusCode, 200);
    assert.strictEqual(third.statusCode, 429);
    assert.ok(/daily limit/i.test(third.json.error));

    const slur = await post(concrete({ quote: 'you are a nigga in this line' }), '203.0.113.84');
    assert.strictEqual(slur.statusCode, 400);
    assert.ok(/slurs/i.test(slur.json.error));

    const theme = cover.buildImagePrompt({ look: 'painted', palette: 'night', idea: 'a quiet room', theme: 'psychedelic' });
    assert.ok(/psychedelic/i.test(theme.prompt));
    assert.ok(/No text, no letters/.test(theme.prompt));
    const plain = cover.buildImagePrompt({ look: 'painted', palette: 'night', idea: 'a quiet room' });
    assert.ok(!/psychedelic/i.test(plain.prompt));
  } finally {
    global.fetch = originalFetch;
    guard.dailyLimiter.reset();
    ['XAI_API_KEY', 'SONG_HELPER_DISABLED', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'SONG_HELPER_DAILY_LIMIT', 'REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'].forEach(function (name) {
      if (previous[name === 'XAI_API_KEY' ? 'key' : name] === undefined && name === 'XAI_API_KEY') {
        delete process.env.XAI_API_KEY;
      }
    });
    if (previous.key === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previous.key;
    if (previous.disabled === undefined) delete process.env.SONG_HELPER_DISABLED;
    else process.env.SONG_HELPER_DISABLED = previous.disabled;
    if (previous.site === undefined) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = previous.site;
    if (previous.secret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = previous.secret;
    if (previous.limit === undefined) delete process.env.SONG_HELPER_DAILY_LIMIT;
    else process.env.SONG_HELPER_DAILY_LIMIT = previous.limit;
  }
}

function runPages() {
  const html = read('song-helper.html');
  const js = read('song-helper-v2.js');
  const sparkHtml = read('spark.html');
  const coverHtml = read('cover-art.html');
  const index = read('index.html');
  const readme = read('README.md');
  const vercel = JSON.parse(read('vercel.json'));
  const nav = html.match(/<nav class="nav-links"[\s\S]*?<\/nav>/)[0];
  const sparkNav = sparkHtml.match(/<nav class="nav-links"[\s\S]*?<\/nav>/)[0];

  assert.ok(html.includes('id="sh-modes"'));
  assert.ok(html.includes('id="sh-craft"'));
  assert.ok(html.includes('Rabbit hole'));
  assert.ok(html.includes('Thumbs') === false);
  assert.ok(js.includes('Thumbs up') && js.includes('Thumbs down'));
  assert.ok(js.includes("id: 'line'"));
  assert.ok(js.includes('hookError'));
  assert.ok(js.includes("mode === 'hook'"));
  assert.ok(js.includes('Write the hook'));
  assert.ok(read('song-helper.js').includes('isPlaceholderLyric'));
  assert.ok(html.includes('href="/spark"'));
  assert.ok(html.indexOf('id="sh-idea"') < html.indexOf('id="sh-feeling"'));
  assert.ok(html.indexOf('id="sh-feeling"') < html.indexOf('id="sh-craft"'));
  assert.ok(html.indexOf('id="sh-craft"') < html.indexOf('id="sh-v2"'));
  assert.ok(html.indexOf('id="sh-v2"') < html.indexOf('id="sh-write"'));
  assert.ok(html.indexOf('id="sh-write"') < html.indexOf('id="sh-expand"'));
  assert.ok(html.indexOf('id="sh-feeling"') < html.indexOf('data-step="genre"'));
  const craftBlock = html.slice(html.indexOf('id="sh-craft"'), html.indexOf('id="sh-v2"'));
  assert.ok(!craftBlock.includes('data-structure='));
  assert.ok(/id="sh-expand"[^>]*hidden/.test(html));
  assert.ok(html.includes('data-structure="verse"'));
  assert.ok(html.includes('data-structure="hook"'));
  assert.ok(html.includes('data-structure="bridge"'));
  assert.ok(html.includes('lib/spark.js'));
  assert.ok(html.indexOf('lib/spark.js') < html.indexOf('song-helper-v2.js'));
  assert.ok(js.includes('sectionFromAnswers'));
  assert.ok(js.includes('applyTransform'));
  assert.ok(js.includes('data-transform'));
  assert.ok(html.includes('id="sh-mode-note"'));
  assert.ok(html.includes('Region is optional'));
  assert.ok(html.includes('id="sh-kinds"'));
  assert.ok(html.includes('id="sh-live"'));
  assert.ok(html.includes('Ask another question'));
  assert.ok(html.includes('Write my own question'));
  assert.ok(html.includes('id="sh-live-skip"'));
  assert.ok(js.includes('No region'));
  assert.ok(html.includes('id="sh-parts"'));
  assert.ok(html.includes('data-structure="bars"'));
  assert.ok(read('lib/song-questions.js').includes('Who is this love song for?'));
  assert.ok(html.indexOf('id="sh-idea"') < html.indexOf('id="sh-feeling"'));
  assert.ok(html.indexOf('id="sh-feeling"') < html.indexOf('id="sh-kind"'));
  assert.ok(html.indexOf('id="sh-kind"') < html.indexOf('id="sh-live"'));
  assert.ok(html.indexOf('id="sh-live"') < html.indexOf('id="sh-craft"'));
  assert.ok(html.includes('data-transform="flip"'));
  assert.ok(html.includes('data-transform="funkify"'));
  assert.ok(html.includes('id="sh-transform-lines"'));
  assert.ok(html.includes('id="sh-save-song"'));
  assert.ok(html.indexOf('id="sh-expand"') < html.indexOf('id="sh-save-song"'));
  assert.ok(html.includes('Your lyrics stay on this device'));
  assert.ok(html.includes('login.html?next=/my-lyrics'));
  assert.ok(html.includes('signup.html?next=/my-lyrics'));
  assert.ok(js.includes('PlaigroundLyricsAccount'));
  assert.ok(read('membership.js').includes("path === '/my-lyrics'"));
  assert.ok(html.indexOf('id="sh-expand"') < html.indexOf('data-transform="flip"'));
  assert.ok(js.includes('Flip the angle'));
  assert.ok(js.includes('Trending') && js.includes('Mindset') && js.includes("label: 'News'"));
  assert.ok(js.includes('Use this spark'));
  assert.ok(js.includes('Start writing'));
  assert.ok(js.includes('These questions are optional'));
  assert.ok(js.includes('the more human the draft feels'));
  assert.ok(js.includes('How do you feel about this'));
  assert.ok(js.includes('personal experience'));
  assert.ok(js.includes('spark.topicsFor'));
  assert.ok(js.includes('spark.sparksFor'));
  assert.ok(read('spark.js').includes('Use this spark'));
  assert.ok(read('spark.js').includes('spark.headlinesFor'));
  assert.ok(read('spark.js').includes('Start writing'));
  assert.ok(html.includes('Give me ideas'));
  assert.ok(html.includes('I have my own idea'));
  assert.ok(html.includes('the more human the draft feels'));
  assert.ok(html.includes('id="sh-choice-ideas"'));
  assert.ok(html.includes('id="sh-choice-own"'));
  assert.ok(html.includes('Create from scratch'));
  assert.ok(html.includes('From a real song'));
  assert.ok(html.includes('id="sh-choice-scratch"'));
  assert.ok(html.includes('id="sh-choice-source"'));
  assert.ok(html.includes('id="sh-source"'));
  assert.ok(html.includes('How you write'));
  assert.ok(html.includes('How it feels'));
  assert.ok(!html.includes('data-group="mood"'));
  assert.ok(!html.includes('How does it feel?'));
  assert.ok(js.includes('setBranch'));
  assert.ok(js.includes('KIND_MOOD'));
  assert.ok(js.includes("heartbreak: 'heartbroken'"));
  assert.ok(js.includes('Song you want to cover'));
  assert.ok(js.includes('FAIR_USE_NOTE'));
  assert.ok(html.includes('id="sh-ideas-panel"'));
  assert.ok(html.includes('id="sh-own-panel"'));
  assert.ok(js.includes('setIdeaLane'));
  assert.ok(js.includes('clearOwnIdea'));
  assert.ok(js.includes('clearSparkChoice'));
  assert.ok(js.includes('sparkTopic === topic.label'));
  assert.ok(read('song-helper.js').includes("textContent = 'More'"));
  assert.ok(read('song-helper.js').includes('classList.contains(\'on\')'));
  assert.ok(sparkHtml.includes('the more human the draft feels'));
  assert.ok(!/—/.test(read('lib/spark.js') + read('spark.js')));
  assert.ok(!js.includes("text: ''"));
  assert.ok(read('song-helper.js').includes("var STEPS = ['genre'"));
  assert.ok(!read('song-helper.js').includes("setMode('hook')"));
  assert.ok(read('lib/song-modes.js').includes('sectionFromAnswers'));
  assert.ok(!/—/.test(html.slice(html.indexOf('id="sh-idea"'), html.indexOf('id="sh-expand"'))));
  assert.ok(!nav.includes('/spark'));
  assert.ok(!nav.includes('song-helper'));
  assert.ok(!sparkNav.includes('/spark'));
  assert.ok(!/Grok/.test(html + sparkHtml + js + read('spark.js')));
  assert.ok(!html.includes('href="/battle"') && !sparkHtml.includes('battle.html'));
  assert.ok(index.includes('href="/spark">What\'s hot</a>'));
  assert.ok(index.includes('href="/song-helper">Song Helper</a>'));
  assert.ok(!index.includes('spark.html'));
  assert.ok(coverHtml.includes('Psychedelic') && coverHtml.includes('Comic book'));
  assert.ok(!sparkHtml.includes('noindex'));
  assert.ok(sparkHtml.includes('Sample'));
  assert.ok((vercel.rewrites || []).some(function (row) {
    return row.source === '/spark' && row.destination === '/spark.html';
  }));
  assert.ok((vercel.rewrites || []).some(function (row) {
    return row.source === '/api/slang/refresh' && row.destination === '/api/song-helper?action=slang-refresh';
  }));
  assert.ok(readme.includes('## Plug in your keys'));
  ['XAI_API_KEY', 'XAI_MODEL', 'XAI_IMAGE_MODEL', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'SONG_HELPER_DAILY_LIMIT', 'SONG_HELPER_DISABLED', 'REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USER_AGENT', 'REDDIT_CITY_SUBS', 'SPARK_FEEDS'].forEach(function (name) {
    assert.ok(readme.includes(name), name);
  });
  assert.strictEqual(fs.readdirSync(path.join(__dirname, 'api')).filter(function (name) { return name.endsWith('.js'); }).length, 12);
}

function runQuestions() {
  assert.ok(questions.KINDS.some(function (row) { return row.id === 'love' && row.label === 'Love'; }));
  assert.ok(questions.KINDS.some(function (row) { return row.label === 'Grateful / healing'; }));
  assert.ok(questions.KINDS.some(function (row) { return row.label === 'Mindset / cause / news'; }));
  assert.ok(!modes.MODES.some(function (row) { return row.id === 'love' || row.id === 'heartbreak'; }));
  const write = questions.open({ kind: 'love', mode: 'write', mood: 'hyped', topic: '' });
  const funny = questions.open({ kind: 'love', mode: 'funny', mood: 'hyped', topic: '' });
  const sadFunny = questions.open({ kind: 'love', mode: 'funny', mood: 'heartbroken', topic: '' });
  assert.notStrictEqual(questions.view(write).ask, questions.view(funny).ask);
  assert.notStrictEqual(questions.view(funny).ask, questions.view(sadFunny).ask);
  assert.ok(/love song for/i.test(questions.view(write).ask));
  const themed = questions.open({ kind: 'love', mode: 'write', topic: 'the late bus' });
  assert.ok(questions.view(themed).ask.indexOf('the late bus') !== -1);
  const swap = questions.open({ kind: 'love', mode: 'write' });
  const first = questions.view(swap).ask;
  questions.askAnother(swap);
  assert.notStrictEqual(questions.view(swap).ask, first);
  assert.strictEqual(questions.view(swap).depth, 0);
  const follow = questions.open({ kind: 'love', mode: 'write' });
  follow.draft = 'Maya';
  questions.askAnother(follow);
  assert.ok(questions.view(follow).ask.indexOf('Maya') !== -1);
  assert.strictEqual(questions.view(follow).depth, 0);
  const skipped = questions.open({ kind: 'heartbreak', mode: 'write' });
  questions.skip(skipped);
  assert.strictEqual(questions.view(skipped).depth, 1);
  const custom = questions.open({ kind: 'hype', mode: 'poem' });
  questions.ownQuestion(custom, 'What color was the room?');
  assert.strictEqual(questions.view(custom).ask, 'What color was the room?');
  const loveBlanks = questions.madlibs('love').map(function (row) { return row.id; }).join(',');
  const hypeBlanks = questions.madlibs('hype').map(function (row) { return row.id; }).join(',');
  const pettyBlanks = questions.madlibs('petty').map(function (row) { return row.id; }).join(',');
  assert.notStrictEqual(loveBlanks, hypeBlanks);
  assert.notStrictEqual(loveBlanks, pettyBlanks);
  assert.ok(questions.PARTS.some(function (row) { return row.id === 'song' && row.label === 'Whole song'; }));
  assert.ok(questions.TOPIC_FOLLOWUPS.some(function (row) { return row.ask === 'How do you feel about this?'; }));
  const packed = modes.buildSample({
    mode: 'madlibs',
    kind: 'love',
    mood: 'in love',
    live: [
      { id: 'call', text: 'honey' },
      { id: 'place', text: 'the kitchen at 2am' },
      { id: 'object', text: 'a chipped mug' },
    ],
    craft: { rabbit: true },
  });
  assert.strictEqual(packed.ok, true);
  const packedText = modes.allLines(packed.draft).map(function (row) { return row.text; }).join('\n');
  assert.ok(packedText.indexOf('honey') !== -1);
  assert.ok(packedText.indexOf('a chipped mug') !== -1);
}

async function run() {
  runModes();
  runQuestions();
  runSlang();
  runSpark();
  await runApi();
  runPages();
  console.log('song-helper-v2.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
