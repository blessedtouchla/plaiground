'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('./lib/song-helper');
const packs = require('./lib/song-packs');
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

function verbatimStrings(interview) {
  return [interview.happened, interview.why, interview.line].filter(Boolean);
}

function wordBank(interview) {
  return Object.keys(interview.words || {}).map(function (key) { return interview.words[key]; }).filter(Boolean);
}

function allLines(draft) {
  const lines = [];
  draft.hooks.forEach(function (hook) { lines.push(hook); });
  draft.sections.forEach(function (section) {
    section.lines.forEach(function (line) { lines.push(line); });
  });
  return lines;
}

function lineHasPhrase(line, phrase) {
  return String(line || '').toLowerCase().indexOf(String(phrase || '').toLowerCase()) >= 0;
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
  assert.ok(!/the hook sentence, what happened, and why are full lines/i.test(core.SYSTEM_PROMPT));
  assert.strictEqual(core.isPlaceholderLyric('The hook sentence, what happened, and why'), true);
  assert.strictEqual(core.isPlaceholderLyric('The heart keeps beating even when the answers stay unseen'), true);
  assert.strictEqual(core.isPlaceholderLyric(interview.line), false);
  assert.ok(/hook sentence/i.test(core.missingAnswers({})));
  assert.strictEqual(core.missingAnswers(interview), '');
  const sparkedInterview = core.normalizeInterview(Object.assign({}, interview, {
    sparkTitle: 'The group chat went quiet',
    sparkAngle: 'Write it from the person who muted the chat.',
  }));
  assert.strictEqual(sparkedInterview.sparkAngle, 'Write it from the person who muted the chat.');
  const sparkedDraft = core.buildSampleDraft(sparkedInterview);
  assert.ok(allLines(sparkedDraft).some(function (line) {
    return line.text.indexOf('muted the chat') !== -1 && line.source === 'user';
  }));
  assert.ok(core.interviewPrompt(sparkedInterview).includes('muted the chat'));
  const withStory = core.normalizeInterview(Object.assign({}, interview, {
    sparkTitle: 'The group chat went quiet',
    sparkAngle: 'Write it from the person who muted the chat.',
    sparkFeel: 'I feel left in the thread.',
    sparkStory: 'I watched the typing bubble and did not answer.',
    sparkKeep: '',
  }));
  const storyDraft = core.buildSampleDraft(withStory);
  assert.ok(allLines(storyDraft).some(function (line) {
    return line.source === 'user' && line.text.indexOf('typing bubble') !== -1;
  }));
  assert.ok(allLines(storyDraft).some(function (line) {
    return line.source === 'user' && line.text.indexOf('left in the thread') !== -1;
  }));
  assert.ok(!allLines(storyDraft).some(function (line) {
    return /how do you feel|personal experience/i.test(line.text);
  }));
  assert.ok(core.interviewPrompt(withStory).includes('typing bubble'));
  assert.ok(core.interviewPrompt(withStory).includes('If sparkFeel'));
  const echoed = core.draftFromModelJson(JSON.stringify({
    title: 'Echo',
    hooks: [
      { id: 'a', text: 'The hook sentence, what happened, and why', source: 'generated' },
      { id: 'b', text: 'A second original hook for the chorus.', source: 'generated' },
    ],
    sections: [{
      label: 'Chorus',
      lines: [
        { text: 'The hook sentence, what happened, and why', source: 'generated' },
        { text: 'The heart keeps beating even when the answers stay unseen', source: 'generated' },
      ],
    }],
  }), interview);
  const echoedText = JSON.stringify(echoed);
  assert.ok(echoedText.includes(interview.line));
  assert.ok(echoedText.includes(interview.happened));
  assert.ok(echoedText.includes(interview.why));
  assert.ok(!/answers stay unseen/i.test(echoedText));
  assert.ok(!/The hook sentence, what happened, and why/.test(echoedText));
  assert.ok(/word-bank answers are ingredients/i.test(core.SYSTEM_PROMPT));
  assert.ok(/at least two distinct lines/i.test(core.SYSTEM_PROMPT));
  assert.ok(/natural casing/i.test(core.SYSTEM_PROMPT));
  assert.ok(/every verse needs at least four lyric lines/i.test(core.SYSTEM_PROMPT));
  assert.ok(/mixes Spanish and English/i.test(core.SYSTEM_PROMPT));
  assert.ok(/do not stack/i.test(core.RETRY_INSTRUCTION));
  assert.ok(/natural casing|lowercase a common word/i.test(core.RETRY_INSTRUCTION));
  assert.ok(/at least four lyric lines/i.test(core.RETRY_INSTRUCTION));
  assert.ok(/JSON only/i.test(core.SYSTEM_PROMPT));
  assert.ok(/do not add attribution/i.test(core.SYSTEM_PROMPT));
  assert.ok(!/please (add|include|insert).{0,80}grok/i.test(core.SYSTEM_PROMPT));
  assert.strictEqual(core.PAGE_CREDIT, 'PLAIGROUND Song Helper · Written with Grok');
  assert.strictEqual(core.SUNO_CHAR_LIMIT, 3000);

  verbatimStrings(interview).forEach(function (text) {
    const hit = lines.filter(function (line) { return line.text === text; });
    assert.ok(hit.length, 'missing verbatim line: ' + text);
    assert.ok(hit.every(function (line) { return line.source === 'user'; }), 'user line not marked: ' + text);
  });
  wordBank(interview).forEach(function (text) {
    const hit = lines.filter(function (line) { return lineHasPhrase(line.text, text); });
    assert.ok(hit.length, 'word bank not woven: ' + text);
    assert.ok(hit.every(function (line) {
      return line.text.toLowerCase() !== text.toLowerCase() && line.source === 'user';
    }), 'word bank dumped as its own line: ' + text);
  });
  draft.sections.filter(function (section) { return /^verse\b/i.test(section.label); }).forEach(function (section) {
    assert.ok(section.lines.length >= 4, 'verse needs four lines');
  });
  assert.strictEqual(core.draftNeedsRetry(draft, interview), false);

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
  verbatimStrings(interview).forEach(function (text) {
    assert.ok(allLines(short).some(function (line) { return line.text === text && line.source === 'user'; }));
  });
  wordBank(interview).forEach(function (text) {
    assert.ok(allLines(short).some(function (line) {
      return lineHasPhrase(line.text, text) && line.text.toLowerCase() !== text.toLowerCase();
    }), 'short weave missing ' + text);
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
  assert.ok(!record.includes(core.PAGE_CREDIT));
  const grokRecord = core.formatAuthorship(draft, {
    preview: false,
    date: 'September 26, 2026',
    interview: interview,
  });
  assert.strictEqual(grokRecord.split(core.PAGE_CREDIT).length - 1, 1);
  assert.ok(grokRecord.indexOf(core.PAGE_CREDIT) < grokRecord.indexOf('[Verse]'));
  const withCover = core.formatAuthorship(draft, {
    preview: true,
    date: 'September 26, 2026',
    cover: { line: 'Cover image: placeholder art, not AI-generated.' },
  });
  assert.ok(withCover.includes('Cover image: placeholder art, not AI-generated.'));
  assert.ok(withCover.includes(core.COVER_IMAGE_RIGHTS));
  assert.ok(!withCover.includes('Written with Grok'));
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
  verbatimStrings(interview).forEach(function (text) {
    assert.ok(allLines(repaired).some(function (line) { return line.text === text; }), 'repair dropped ' + text);
  });
  wordBank(interview).forEach(function (text) {
    assert.ok(!allLines(repaired).some(function (line) { return line.text === text; }), 'word bank dumped on repair: ' + text);
  });
  assert.ok(!allLines(repaired).some(function (line) { return /drake/i.test(line.text) && line.source === 'generated'; }));

  const credited = core.draftFromModelJson(JSON.stringify({
    title: 'Made with Grok',
    hooks: [
      { id: 'a', text: 'Written with Grok', source: 'generated' },
      { id: 'b', text: 'Generated by Grok', source: 'generated' },
    ],
    sections: [
      {
        label: 'Verse — Written with Grok',
        lines: [
          { text: 'A real opening line.', source: 'generated' },
          { text: 'Written with Grok', source: 'generated' },
          { text: 'Made with Grok.', source: 'generated' },
        ],
      },
      { label: 'Chorus', lines: [{ text: 'Written by Grok', source: 'generated' }] },
    ],
  }), interview);
  const creditedBlob = JSON.stringify(credited);
  assert.ok(!/written with grok|made with grok|generated by grok|written by grok/i.test(creditedBlob));
  assert.notStrictEqual(credited.title, 'Made with Grok');
  assert.strictEqual(credited.hooks[0].text, interview.line);
  assert.ok(allLines(credited).some(function (line) { return line.text === 'A real opening line.'; }));
  assert.ok(credited.sections.some(function (section) { return section.label === 'Chorus'; }));
  assert.strictEqual(credited.sections[0].label, 'Verse');

  const suno = core.formatSunoLyrics(draft);
  assert.ok(suno.startsWith('[Verse 1]\n'));
  assert.ok(suno.includes('\n\n[Pre-Chorus]\n'));
  assert.ok(suno.includes('\n\n[Chorus]\n'));
  assert.ok(suno.includes('\n\n[Verse 2]\n'));
  assert.ok(suno.includes('\n\n[Bridge]\n'));
  assert.ok(suno.includes(interview.line));
  assert.ok(!suno.includes(core.PAGE_CREDIT));
  assert.ok(!suno.includes(core.PREVIEW_NOTICE));
  assert.ok(!suno.includes(core.GROK_ATTRIBUTION));
  assert.ok(!/written with grok|made with grok|generated by grok|written by grok/i.test(suno));
  assert.ok(!/your words/i.test(suno));
  assert.ok(!/^hook(?:\s+option)?\s*[ab]$/im.test(suno));
  assert.ok(!/preview mode/i.test(suno));
  assert.ok(!/<(?:u|br|p|div|span)\b/i.test(suno));
  suno.split('\n\n').forEach(function (block) {
    assert.ok(/^\[[^\]]+\]\n/.test(block));
    assert.ok(!/\n\n/.test(block));
  });
  assert.strictEqual(suno.split('\n\n').filter(function (block) { return block.startsWith('[Chorus]'); }).length, 3);

  const marked = core.formatSunoLyrics({
    sections: [{
      label: 'Chorus — Written with Grok',
      lines: [
        { text: '<u>your words</u>' },
        { text: 'Hook A' },
        { text: '__keep this line__' },
        { text: 'Written with Grok' },
        { text: 'Made with Grok' },
        { text: core.PREVIEW_NOTICE },
        { text: core.PAGE_CREDIT },
        { text: 'A real lyric line.' },
      ],
    }],
  });
  assert.strictEqual(marked, '[Chorus]\nkeep this line\nA real lyric line.');
  const owned = core.formatSunoLyrics({
    sections: [{
      label: 'Verse',
      lines: [
        { text: 'Garlic asada under the same light.', source: 'user' },
        { text: 'You wrote this', source: 'user' },
        { text: 'You wrote this (edited)', source: 'generated' },
      ],
    }],
  });
  assert.strictEqual(owned, '[Verse]\nGarlic asada under the same light.');
  assert.ok(!/you wrote this/i.test(owned));

  const editable = core.buildSampleDraft(interview);
  editable.sections[0].lines[0].text = 'edited in the kitchen light';
  const hookB = editable.hooks[1].text;
  editable.sections.forEach(function (section) {
    section.lines.forEach(function (line) {
      if (line.role === 'hook') line.text = hookB;
    });
  });
  const swapped = core.formatSunoLyrics(editable);
  assert.ok(swapped.includes('edited in the kitchen light'));
  swapped.split('\n\n').filter(function (block) { return block.startsWith('[Chorus]'); }).forEach(function (block) {
    assert.ok(block.includes(hookB));
  });

  const longLine = 'word '.repeat(80).trim();
  const longSections = [];
  for (let i = 0; i < 8; i += 1) {
    longSections.push({ label: i % 2 ? 'Chorus' : 'Verse', lines: [{ text: longLine }, { text: longLine }, { text: longLine }] });
  }
  const longText = core.formatSunoLyrics({ sections: longSections });
  assert.ok(longText.length > core.SUNO_CHAR_LIMIT);
  assert.ok(!/suno works best/i.test(longText));
  assert.ok(!longText.includes(core.PAGE_CREDIT));

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

    const empty = await post({}, '203.0.113.26');
    assert.strictEqual(empty.statusCode, 400);
    assert.ok(/hook sentence/i.test(empty.json.error));
    assert.ok(!empty.json.draft);
    assert.strictEqual(fetchCalls, 0);
    assert.ok(!/answers stay unseen/i.test(empty.body));
    assert.ok(!/The hook sentence, what happened, and why/.test(empty.body));

    const planted = await post(fixture({
      line: 'The hook sentence, what happened, and why',
      happened: 'The heart keeps beating even when the answers stay unseen',
    }), '203.0.113.27');
    assert.strictEqual(planted.statusCode, 400);
    assert.ok(/placeholder/i.test(planted.json.error));
    assert.ok(!planted.json.draft);
    assert.strictEqual(fetchCalls, 0);

    const parody = await post(fixture({
      line: 'Please sing this to the tune of some famous chorus tonight.',
    }), '203.0.113.70');
    assert.strictEqual(parody.statusCode, 400);
    assert.strictEqual(fetchCalls, 0);
    assert.ok(/original/i.test(parody.json.error));

    const celeb = await post(fixture({
      who: 'Drake',
      shape: {
        genre: 'Comedy',
        pack: 'comedy',
        comedy: true,
        comedyType: 'roast',
        comedyMusic: 'rap',
        language: 'english',
        explicit: 'clean',
        length: 'full',
      },
    }), '203.0.113.71');
    assert.strictEqual(celeb.statusCode, 400);
    assert.ok(/public figures/i.test(celeb.json.error));

    const comedy = await post(fixture({
      who: 'the crumb',
      shape: {
        genre: 'Comedy, tiny disaster, power ballad',
        pack: 'comedy',
        comedy: true,
        comedyType: 'tiny',
        comedyMusic: 'ballad',
        language: 'english',
        explicit: 'clean',
        length: 'short',
      },
      words: { tiny: 'the last slice of pizza', habit: 'talks to the fridge' },
    }), '203.0.113.72');
    assert.strictEqual(comedy.statusCode, 200);
    assert.strictEqual(comedy.json.preview, true);
    assert.strictEqual(comedy.json.notice, core.PREVIEW_NOTICE);
    assert.strictEqual(comedy.json.attribution, '');
    const comedyText = JSON.stringify(comedy.json.draft);
    assert.ok(/pizza|crumb|drumroll|sticky note/i.test(comedyText));
    assert.ok(!/Written with Grok/.test(comedyText));
    assert.strictEqual(fetchCalls, 0);

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

    const mixedInterview = fixture({
      line: 'Gracias por tu luz, mi amor.',
      happened: 'I woke up on a Saturday',
      why: 'Me quedé despierto contigo.',
      words: {
        both: 'Both',
        hour: '8:30',
        food: 'Garlic asada',
        car: 'Tesla x with the wings',
        dance: 'Tango',
        drink: 'Pepsi tonight?',
        neighborhood: 'West hollywood',
        juice: 'He made me watermelon Juice',
      },
      shape: { genre: 'Latin', pack: 'latin', language: 'spanglish', explicit: 'clean', length: 'full' },
    });
    const badDraft = {
      title: 'Luz',
      hooks: [
        { id: 'a', text: 'Ignored', source: 'generated' },
        { id: 'b', text: 'Quédate, the night is still warm.', source: 'generated' },
      ],
      sections: [
        { label: 'Verse', lines: [
          { text: 'Both', source: 'user' },
          { text: '8:30', source: 'user' },
          { text: 'Garlic asada', source: 'user' },
          { text: 'Tango', source: 'user' },
          { text: 'Pepsi tonight?', source: 'user' },
          { text: 'West hollywood', source: 'user' },
        ]},
        { label: 'Chorus', lines: [
          { text: 'Gracias por tu luz, mi amor.', role: 'hook', source: 'user' },
          { text: 'Gracias por tu luz, mi amor.', role: 'hook', source: 'user' },
          { text: 'Gracias por tu luz, mi amor.', role: 'hook', source: 'user' },
          { text: 'Gracias por tu luz, mi amor.', role: 'hook', source: 'user' },
        ]},
      ],
    };
    const goodDraft = {
      title: 'Luz en West Hollywood',
      hooks: [
        { id: 'a', text: 'Gracias por tu luz, mi amor.', source: 'user' },
        { id: 'b', text: 'Quédate, the night is still warm.', source: 'generated' },
      ],
      sections: [
        { label: 'Verse', lines: [
          { text: 'I woke up on a Saturday', source: 'user' },
          { text: 'Both of us still talking over Garlic asada at 8:30.', source: 'generated' },
          { text: 'Tesla x with the wings parked under a West hollywood moon.', source: 'generated' },
          { text: 'Gracias por tu luz, mi amor.', source: 'user' },
        ]},
        { label: 'Pre-Chorus', lines: [
          { text: 'Me quedé despierto contigo.', source: 'user' },
          { text: 'Tango in the doorway, Pepsi tonight? you asked.', source: 'generated' },
        ]},
        { label: 'Chorus', lines: [
          { text: 'Gracias por tu luz, mi amor.', source: 'user', role: 'hook' },
          { text: 'He made me watermelon Juice and the light stayed on.', source: 'generated' },
          { text: 'Gracias por tu luz, mi amor.', source: 'user', role: 'hook' },
        ]},
        { label: 'Verse 2', lines: [
          { text: 'The same Saturday keeps Both of the glasses on the counter.', source: 'generated' },
          { text: 'The hallway light stayed warm.', source: 'generated' },
          { text: 'We left the song half finished.', source: 'generated' },
          { text: 'Saturday can hold the rest.', source: 'generated' },
        ]},
        { label: 'Chorus', lines: [
          { text: 'Gracias por tu luz, mi amor.', source: 'user', role: 'hook' },
          { text: 'West hollywood can wait until the song is done.', source: 'generated' },
          { text: 'Gracias por tu luz, mi amor.', source: 'user', role: 'hook' },
        ]},
      ],
    };
    const attempts = [];
    global.fetch = function (url, opts) {
      attempts.push(JSON.parse(opts.body));
      const content = attempts.length === 1 ? badDraft : goodDraft;
      return Promise.resolve({
        ok: true,
        json: async function () {
          return { choices: [{ message: { content: JSON.stringify(content) } }] };
        },
      });
    };
    const retried = await post(mixedInterview, '203.0.113.80');
    assert.strictEqual(retried.statusCode, 200);
    assert.strictEqual(attempts.length, 2);
    assert.ok(!attempts[0].messages[1].content.includes(core.RETRY_INSTRUCTION));
    assert.ok(attempts[1].messages[1].content.includes(core.RETRY_INSTRUCTION));
    assert.ok(/weave every word-bank/i.test(attempts[1].messages[0].content));
    const retryLines = allLines(retried.json.draft);
    assert.ok(retryLines.some(function (line) {
      return line.text === 'Both of us still talking over garlic asada at 8:30.' && line.source === 'user';
    }));
    assert.ok(retryLines.some(function (line) {
      return line.text === 'Tesla X with the wings parked under a West Hollywood moon.' && line.source === 'user';
    }));
    assert.ok(retryLines.some(function (line) {
      return line.text === 'The same Saturday keeps both of the glasses on the counter.' && line.source === 'user';
    }));
    assert.ok(retryLines.some(function (line) {
      return line.text === 'West Hollywood can wait until the song is done.' && line.source === 'user';
    }));
    assert.ok(retryLines.some(function (line) {
      return line.text === 'He made me watermelon juice and the light stayed on.' && line.source === 'user';
    }));
    assert.ok(retryLines.some(function (line) { return line.text === 'Me quedé despierto contigo.'; }));
    assert.ok(retryLines.some(function (line) { return line.text === 'I woke up on a Saturday'; }));
    assert.ok(!retryLines.some(function (line) { return /West hollywood|Tesla x|Garlic asada|keeps Both/.test(line.text); }));
    assert.ok(!retryLines.some(function (line) { return line.text === 'Both' || line.text === '8:30' || line.text === 'Tango'; }));
    retried.json.draft.sections.filter(function (section) {
      return /^verse\b/i.test(section.label);
    }).forEach(function (section) {
      assert.ok(section.lines.length >= 4, 'retried verse needs four lines');
    });
    retried.json.draft.sections.filter(function (section) {
      return /^chorus\b/i.test(section.label);
    }).forEach(function (section) {
      const seen = {};
      section.lines.forEach(function (line) { seen[line.text.trim().toLowerCase()] = true; });
      assert.ok(Object.keys(seen).length >= 2);
      assert.ok(section.lines.filter(function (line) {
        return line.text === 'Gracias por tu luz, mi amor.';
      }).length < 4);
    });
    const retrySuno = core.formatSunoLyrics(retried.json.draft);
    assert.ok(!/you wrote this/i.test(retrySuno));
    assert.ok(retrySuno.includes('Gracias por tu luz, mi amor.'));
    assert.ok(retrySuno.includes('Both of us still talking over garlic asada at 8:30.'));
    assert.ok(retrySuno.includes('Tesla X with the wings parked under a West Hollywood moon.'));
    assert.ok(retrySuno.includes('The same Saturday keeps both of the glasses on the counter.'));
    assert.ok(retrySuno.includes('West Hollywood can wait until the song is done.'));
    assert.ok(retrySuno.includes('Pepsi tonight?'));
    assert.ok(retrySuno.includes('Me quedé despierto contigo.'));
    assert.ok(!/West hollywood|Tesla x|Garlic asada/.test(retrySuno));
    retrySuno.split('\n\n').filter(function (block) { return /^\[Verse\b/.test(block); }).forEach(function (block) {
      assert.ok(block.split('\n').length >= 5, 'copied verse needs four lyric lines');
    });
  } finally {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.XAI_MODEL;
    else process.env.XAI_MODEL = previousModel;
  }
}

function runPacks() {
  const genres = packs.list().filter(function (pack) { return pack.id !== 'comedy'; });
  assert.ok(genres.length >= 8 && genres.length <= 10);
  assert.ok(packs.get('comedy'));
  const names = ['taylor swift', 'drake', 'beyonce', 'beyoncé', 'the weeknd', 'bad bunny', 'rihanna', 'kendrick lamar', 'billie eilish', 'weeknd'];
  genres.concat([packs.get('comedy')]).forEach(function (pack) {
    assert.ok(pack.prompts.length >= 6 && pack.prompts.length <= 8, pack.id + ' prompt count');
    assert.ok(packs.LOOKS.indexOf(pack.coverLook) >= 0, pack.id + ' look');
    const style = packs.styleFor(pack.id, pack.id === 'comedy' ? 'ballad' : '');
    assert.ok(packs.ERAS.indexOf(style.era) >= 0, pack.id + ' era');
    assert.ok(packs.ENERGIES.indexOf(style.energy) >= 0, pack.id + ' energy');
    assert.ok(style.instruments.length >= 1 && style.instruments.length <= 3);
    style.instruments.forEach(function (item) {
      assert.ok(packs.INSTRUMENTS.indexOf(item) >= 0, item);
    });
    const keys = {};
    pack.prompts.forEach(function (prompt) {
      assert.ok(!keys[prompt.key], 'duplicate key ' + prompt.key);
      keys[prompt.key] = true;
      assert.ok(prompt.variants && prompt.variants.length >= 2, pack.id + ' ' + prompt.key);
    });
    const first = packs.promptsFor(pack.id, 0).map(function (item) { return item.label; }).join('|');
    const second = packs.promptsFor(pack.id, 1).map(function (item) { return item.label; }).join('|');
    assert.notStrictEqual(first, second, pack.id + ' surprise labels');
    const blob = JSON.stringify(pack).toLowerCase();
    names.forEach(function (name) {
      assert.ok(blob.indexOf(name) < 0, pack.id + ' names ' + name);
    });
    assert.ok(!/to the tune of/i.test(blob));
  });
  assert.strictEqual(packs.coverLookFor('comedy'), 'illustrated');
  assert.strictEqual(packs.coverLookFor('country'), 'photo');
  assert.strictEqual(packs.coverLookFor('lofi'), 'minimal');
  assert.strictEqual(packs.coverLookFor('hiphop'), 'collage');
  assert.strictEqual(packs.matchGenre('R&B'), 'rnb');
  assert.strictEqual(packs.matchGenre('Corridos'), 'latin');
  assert.ok(packs.genreLabel('comedy', 'country', 'roast').length <= 40);
  assert.ok(/country comedy/i.test(packs.genreLabel('comedy', 'country', 'roast')));

  const joke = core.buildSampleDraft(fixture({
    who: 'the crumb',
    shape: {
      genre: 'Comedy, tiny disaster, power ballad',
      pack: 'comedy',
      comedy: true,
      comedyType: 'tiny',
      comedyMusic: 'ballad',
      language: 'english',
      explicit: 'clean',
      length: 'short',
    },
    words: {
      habit: 'talks to the fridge',
      tiny: 'the last slice of pizza',
    },
  }));
  const jokeText = allLines(joke).map(function (line) { return line.text; }).join('\n');
  assert.ok(/pizza|crumb|drumroll|sticky note/i.test(jokeText));
  assert.ok(/very serious song/i.test(joke.title));
  assert.strictEqual(joke.hooks[0].text, fixture().line);
  assert.ok(/pizza|crumb|drumroll/i.test(joke.hooks[1].text));
  assert.ok(allLines(joke).some(function (line) {
    return lineHasPhrase(line.text, 'the last slice of pizza') && line.text.toLowerCase() !== 'the last slice of pizza' && line.source === 'user';
  }));
  assert.ok(!/written with grok/i.test(jokeText));

  assert.ok(/do not parody/i.test(core.SYSTEM_PROMPT));
  assert.ok(/to the tune of/i.test(core.SYSTEM_PROMPT));
  assert.ok(/public figures/i.test(core.SYSTEM_PROMPT));
  assert.ok(/good-natured/i.test(core.SYSTEM_PROMPT));

  const bad = core.normalizeInterview(fixture({
    line: 'Please sing this to the tune of some famous chorus tonight.',
    happened: 'A parody of my week that ran too long.',
  }));
  assert.strictEqual(core.containsParodyAsk(bad), true);
  const payload = core.interviewPrompt(bad);
  assert.ok(!/to the tune of/i.test(payload));
  assert.ok(!/parody of/i.test(payload));
  assert.strictEqual(core.publicFigureName('Drake'), true);
  assert.strictEqual(core.publicFigureName('M'), false);
  assert.strictEqual(core.publicFigureName('best friend'), false);

  const hip = core.buildSampleDraft(fixture({
    words: Object.assign({}, fixture().words, { cameup: 'the second-floor apartment' }),
    shape: { genre: 'Hip-hop', pack: 'hiphop', language: 'english', explicit: 'clean', length: 'full' },
  }));
  assert.ok(allLines(hip).some(function (line) {
    return lineHasPhrase(line.text, 'the second-floor apartment') && line.text.toLowerCase() !== 'the second-floor apartment' && line.source === 'user';
  }));

  const mixedWords = {
    both: 'Both',
    time: '8:30',
    food: 'Garlic asada',
    car: 'Tesla x with the wings',
    dance: 'Tango',
    drink: 'Pepsi tonight?',
    place: 'West hollywood',
    juice: 'He made me watermelon Juice',
  };
  const mixed = core.normalizeInterview(fixture({
    line: 'Gracias por tu luz, mi amor.',
    happened: 'I woke up on a Saturday',
    why: 'Me quedé despierto contigo.',
    words: mixedWords,
    shape: { genre: 'Latin', pack: 'latin', language: 'spanglish', explicit: 'clean', length: 'full' },
  }));
  const mixedDraft = core.buildSampleDraft(mixed);
  assert.strictEqual(mixedDraft.hooks[0].text, 'Gracias por tu luz, mi amor.');
  Object.keys(mixed.words).forEach(function (key) {
    const bit = mixed.words[key];
    assert.ok(allLines(mixedDraft).some(function (line) {
      return lineHasPhrase(line.text, bit) && line.text.toLowerCase() !== bit.toLowerCase() && line.source === 'user';
    }), 'missing weave for ' + bit);
  });
  mixedDraft.sections.filter(function (section) { return /^verse\b/i.test(section.label); }).forEach(function (section) {
    assert.ok(section.lines.length >= 4, 'sample verse needs four lines');
  });
  assert.ok(allLines(mixedDraft).some(function (line) { return line.text === 'I woke up on a Saturday'; }));
  assert.ok(allLines(mixedDraft).some(function (line) { return line.text === 'Me quedé despierto contigo.'; }));
  assert.strictEqual(core.draftNeedsRetry(mixedDraft, mixed), false);
  mixedDraft.sections.filter(function (section) { return /^chorus\b/i.test(section.label); }).forEach(function (section) {
    const seen = {};
    section.lines.forEach(function (line) { seen[line.text.trim().toLowerCase()] = true; });
    assert.ok(Object.keys(seen).length >= 2, 'chorus needs two distinct lines');
    const hookHits = section.lines.filter(function (line) { return line.text === 'Gracias por tu luz, mi amor.'; }).length;
    assert.ok(hookHits < 4);
  });
  const mixedSuno = core.formatSunoLyrics(mixedDraft);
  assert.ok(!/you wrote this/i.test(mixedSuno));
  assert.ok(mixedSuno.includes('Gracias por tu luz, mi amor.'));
  assert.ok(mixedSuno.includes('West Hollywood'));
  assert.ok(mixedSuno.includes('Tesla X'));
  assert.ok(!mixedSuno.includes('West hollywood'));
  assert.ok(!/Tesla x\b/.test(mixedSuno));

  const dumped = core.draftFromModelJson(JSON.stringify({
    title: 'Luz',
    hooks: [
      { id: 'a', text: 'Gracias por tu luz, mi amor.', source: 'user' },
      { id: 'b', text: 'Quédate, the night is still warm.', source: 'generated' },
    ],
    sections: [
      { label: 'Verse', lines: [
        { text: 'Both', source: 'user' },
        { text: '8:30', source: 'user' },
        { text: 'Garlic asada', source: 'user' },
        { text: 'Tesla x with the wings', source: 'generated' },
        { text: 'Tango', source: 'user' },
        { text: 'Pepsi tonight?', source: 'user' },
        { text: 'West hollywood', source: 'user' },
      ]},
      { label: 'Chorus', lines: [
        { text: 'Gracias por tu luz, mi amor.', source: 'user', role: 'hook' },
        { text: 'Gracias por tu luz, mi amor.', source: 'user', role: 'hook' },
        { text: 'Gracias por tu luz, mi amor.', source: 'user', role: 'hook' },
        { text: 'Gracias por tu luz, mi amor.', source: 'user', role: 'hook' },
      ]},
    ],
  }), mixed);
  assert.strictEqual(core.draftNeedsRetry(dumped, mixed), true);
  const fixed = core.repairLyricShape(dumped, mixed);
  assert.strictEqual(core.draftNeedsRetry(fixed, mixed), false);
  assert.ok(allLines(fixed).some(function (line) {
    return lineHasPhrase(line.text, 'Garlic asada') && line.text.toLowerCase() !== 'garlic asada' && core.lineHoldsUserWords(line.text, mixed);
  }));
  assert.ok(allLines(fixed).some(function (line) { return line.text.indexOf('West Hollywood') >= 0; }));
  assert.ok(allLines(fixed).some(function (line) { return line.text.indexOf('Tesla X') >= 0; }));
  assert.ok(!allLines(fixed).some(function (line) { return /West hollywood|Tesla x\b/.test(line.text); }));
  fixed.sections.filter(function (section) { return /^verse\b/i.test(section.label); }).forEach(function (section) {
    assert.ok(section.lines.length >= 4, 'repaired verse needs four lines');
  });
  fixed.sections.filter(function (section) { return /^chorus\b/i.test(section.label); }).forEach(function (section) {
    const seen = {};
    section.lines.forEach(function (line) { seen[line.text.trim().toLowerCase()] = true; });
    assert.ok(Object.keys(seen).length >= 2);
  });
  const thin = core.draftFromModelJson(JSON.stringify({
    title: 'Luz',
    hooks: [
      { id: 'a', text: 'Gracias por tu luz, mi amor.', source: 'user' },
      { id: 'b', text: 'Quédate, the night is still warm.', source: 'generated' },
    ],
    sections: [
      { label: 'Verse', lines: [
        { text: 'I woke up on a Saturday', source: 'user' },
        { text: 'Both of us still talking over Garlic asada at 8:30.', source: 'generated' },
        { text: 'Tesla x with the wings parked under a West hollywood moon.', source: 'generated' },
        { text: 'Gracias por tu luz, mi amor.', source: 'user' },
      ]},
      { label: 'Chorus', lines: [
        { text: 'Gracias por tu luz, mi amor.', source: 'user', role: 'hook' },
        { text: 'Leave the light on, mi amor.', source: 'generated' },
      ]},
      { label: 'Verse 2', lines: [
        { text: 'The same Saturday keeps Both of the glasses on the counter.', source: 'generated' },
      ]},
    ],
  }), mixed);
  assert.strictEqual(core.draftNeedsRetry(thin, mixed), true);
  assert.strictEqual(thin.sections.filter(function (section) { return section.label === 'Verse 2'; })[0].lines.length, 1);
  assert.ok(allLines(thin).some(function (line) {
    return line.text === 'Both of us still talking over garlic asada at 8:30.';
  }));
  assert.ok(allLines(thin).some(function (line) {
    return line.text === 'Tesla X with the wings parked under a West Hollywood moon.';
  }));
  assert.ok(allLines(thin).some(function (line) { return line.text === 'Me quedé despierto contigo.'; }));
  const thickened = core.repairLyricShape(thin, mixed);
  assert.strictEqual(core.draftNeedsRetry(thickened, mixed), false);
  thickened.sections.filter(function (section) { return /^verse\b/i.test(section.label); }).forEach(function (section) {
    assert.ok(section.lines.length >= 4, 'padded verse needs four lines');
  });
  assert.ok(allLines(thickened).some(function (line) {
    return line.text === 'The same Saturday keeps both of the glasses on the counter.' && line.source === 'user';
  }));
  assert.strictEqual(packs.styleFor('rnb').genre, 'R&B');
  assert.deepStrictEqual(packs.styleFor('rnb').instruments, ['electric piano', 'bass']);
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
  assert.ok(html.includes('href="/cover-art"'));
  assert.ok(html.includes('Make your cover'));
  assert.ok(!html.includes('noindex'));
  assert.ok(!nav.includes('song-helper'));
  assert.ok(!/Grok/.test(html), 'Grok stays off the page chrome');
  assert.ok(!/Powered by Grok/i.test(html + js));
  assert.ok(!/hit song|guaranteed/i.test(html + js));
  assert.ok(!html.includes('XAI_API_KEY') && !js.includes('XAI_API_KEY'));
  assert.ok(!html.includes('api.x.ai') && !js.includes('api.x.ai'));
  assert.ok(html.indexOf('data-step="genre"') < html.indexOf('data-step="happened"'));
  assert.ok(html.indexOf('data-step="happened"') < html.indexOf('data-step="words"'));
  const shape = html.match(/data-step="shape"[\s\S]*?<\/section>/)[0];
  assert.ok(!shape.includes('data-group="genre"'));
  assert.ok(html.includes('Surprise me'));
  assert.ok(html.includes('No parody of existing songs'));
  assert.ok(html.includes('public figures or celebrities'));
  assert.ok(html.includes('id="sh-comedy"'));
  assert.ok(html.indexOf('lib/song-packs.js') < html.indexOf('lib/song-helper.js'));
  assert.ok(js.includes('surpriseWords'));
  assert.ok(js.includes('publicFigureName'));
  assert.ok(js.includes('coverLook'));
  const coverHtml = read('cover-art.html');
  const coverJs = read('cover-art.js');
  assert.ok(coverHtml.indexOf('lib/song-packs.js') < coverHtml.indexOf('lib/song-helper.js'));
  assert.ok(coverJs.includes('coverLook'));
  assert.ok(js.includes('core.PREVIEW_NOTICE'));
  assert.ok(js.includes('banner.hidden = !preview'));
  assert.ok(html.includes('id="sh-suno"'));
  assert.ok(html.includes('id="sh-suno" class="sh-suno-text" readonly'));
  assert.ok(html.includes('Copy for Suno'));
  assert.ok(html.includes('id="sh-suno-warn"'));
  assert.ok(html.indexOf('id="sh-lyric"') < html.indexOf('id="sh-attr"'));
  assert.ok(html.indexOf('id="sh-attr"') < html.indexOf('id="sh-suno"'));
  assert.ok(js.includes('formatSunoLyrics'));
  assert.ok(js.includes('sh-suno-copy'));
  assert.ok(js.includes('core.PAGE_CREDIT'));
  assert.ok(js.includes('core.SUNO_CHAR_LIMIT'));
  assert.ok(js.includes('renderSuno'));
  assert.ok(js.includes('lineHoldsUserWords'));
  assert.ok(js.includes('holdsUserWords'));
  assert.ok(js.includes('isGrokCreditLine'));
  assert.ok(api.includes('XAI_API_KEY'));
  assert.ok(api.includes('https://api.x.ai/v1/chat/completions'));
  assert.ok(api.includes('Cloudflare Turnstile'));
  assert.ok(/in-memory/i.test(api));
  assert.ok(index.includes('href="/song-helper">Song Helper</a>'));
  assert.ok(index.includes('id="whats-new"'));
  assert.ok((vercel.rewrites || []).some(function (row) {
    return row.source === '/song-helper' && row.destination === '/song-helper.html';
  }));
  ['terms.html', 'privacy.html', 'rights.html'].forEach(function (file) {
    assert.ok(!read(file).includes('Song Helper'));
  });
}

async function run() {
  runCore();
  runPacks();
  await runApi();
  runPage();
  console.log('song-helper.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
