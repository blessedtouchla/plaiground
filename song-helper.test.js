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

function memoryStore() {
  const data = {};
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem: function (key, value) { data[key] = String(value); },
    removeItem: function (key) { delete data[key]; },
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
    return line.text.indexOf('muted the chat') !== -1 && line.assisted === true;
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
    return line.assisted === true && line.text.indexOf('typing bubble') !== -1;
  }));
  assert.ok(allLines(storyDraft).some(function (line) {
    return line.assisted === true && line.text.indexOf('left in the thread') !== -1;
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

  assert.deepStrictEqual(core.verbatimCopies(draft, interview), []);
  verbatimStrings(interview).forEach(function (text) {
    assert.ok(!lines.some(function (line) { return line.text === text; }), 'pasted answer: ' + text);
    assert.ok((draft.originalAnswers || []).some(function (item) { return item.text === text; }), 'original not saved: ' + text);
  });
  assert.ok(lines.some(function (line) { return line.assisted === true; }));
  assert.ok(/hoodie/i.test(JSON.stringify(draft.sections)));
  assert.ok(/chair/i.test(JSON.stringify(draft.sections)));
  assert.ok(/home|place/i.test(draft.hooks[0].text));
  const assistedVerse = draft.sections.filter(function (section) { return /^verse\b/i.test(section.label); })
    .reduce(function (list, section) {
      return list.concat(section.lines.filter(function (line) { return line.assisted; }));
    }, []);
  const counts = assistedVerse.map(function (line) { return core.syllableCount(line.text); }).filter(Boolean);
  if (counts.length >= 2) {
    assert.ok(Math.max.apply(null, counts) - Math.min.apply(null, counts) <= 4, 'verse syllable feel');
  }
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

  assert.notStrictEqual(draft.hooks[0].text, interview.line);
  assert.strictEqual(draft.hooks[0].assisted, true);
  assert.ok(draft.sections[0].lines.some(function (line) {
    return line.assisted === true && line.text !== interview.line;
  }), 'the verse is a reshaped song line');
  assert.notStrictEqual(draft.hooks[1].text, interview.line);
  assert.strictEqual(draft.hooks[1].source, 'generated');
  assert.deepStrictEqual(draft.sections.map(function (section) { return section.label; }), [
    'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus',
  ]);
  assert.ok(draft.sections.filter(function (section) { return section.label === 'Chorus'; }).every(function (section) {
    return section.lines.some(function (line) { return line.role === 'hook' && line.text === draft.hooks[0].text; });
  }));

  const short = core.buildSampleDraft(fixture({
    shape: { genre: 'R&B', language: 'english', explicit: 'clean', length: 'short' },
  }));
  assert.deepStrictEqual(short.sections.map(function (section) { return section.label; }), [
    'Verse', 'Chorus', 'Verse', 'Chorus',
  ]);
  assert.deepStrictEqual(core.verbatimCopies(short, interview), []);
  assert.ok(!short.sections.some(function (section) { return section.label === 'Bridge'; }));

  const rant = 'You left your hoodie on my chair and did not come back. You stopped answering when I asked you to stay. I still set a place for you like you are coming home.';
  const rantSentences = [
    'You left your hoodie on my chair and did not come back.',
    'You stopped answering when I asked you to stay.',
    'I still set a place for you like you are coming home.',
  ];
  const rantInterview = fixture({ happened: rant, why: '', line: rant, words: {} });
  const rantDraft = core.buildSampleDraft(rantInterview);
  const rantLines = allLines(rantDraft);
  assert.deepStrictEqual(core.verbatimCopies(rantDraft, rantInterview), []);
  assert.ok((rantDraft.originalAnswers || []).some(function (item) { return item.text === rant; }));
  assert.ok(!rantLines.some(function (line) { return /come back you stopped/i.test(line.text); }));
  rantSentences.forEach(function (sentence) {
    assert.ok(!rantLines.some(function (line) { return core.lyricKey(line.text) === core.lyricKey(sentence); }), 'pasted sentence: ' + sentence);
  });
  assert.ok(rantLines.some(function (line) { return line.assisted && /hoodie/i.test(line.text) && /chair/i.test(line.text); }));
  assert.ok(/hoodie|chair|home|place/i.test(rantDraft.hooks[0].text));
  assert.notStrictEqual(core.lyricKey(rantDraft.hooks[0].text), core.lyricKey(rant));
  assert.strictEqual(rantDraft.hooks[0].assisted, true);
  assert.ok(rantDraft.sections.some(function (section) { return section.label === 'Bridge'; }));
  const rantVerseCounts = rantDraft.sections.filter(function (section) { return /^verse\b/i.test(section.label); })
    .reduce(function (list, section) {
      return list.concat(section.lines.filter(function (line) { return line.assisted; }));
    }, [])
    .map(function (line) { return core.syllableCount(line.text); })
    .filter(Boolean);
  if (rantVerseCounts.length >= 2) {
    assert.ok(Math.max.apply(null, rantVerseCounts) - Math.min.apply(null, rantVerseCounts) <= 4, 'rant verse syllable feel');
  }
  const pasted = {
    hooks: [{ id: 'a', text: rantSentences[0], source: 'generated' }],
    sections: [{ label: 'Verse', lines: [{ text: rant, source: 'generated' }, { text: rantSentences[1], source: 'generated' }] }],
  };
  assert.ok(core.verbatimCopies(pasted, rantInterview).length >= 3);
  wordBank(interview).forEach(function (text) {
    assert.ok(allLines(short).some(function (line) {
      return lineHasPhrase(line.text, text) && line.text.toLowerCase() !== text.toLowerCase();
    }), 'short weave missing ' + text);
  });

  const again = core.buildSampleDraft(fixture({ variant: 1 }));
  function poolLine(sample) {
    return allLines(sample).filter(function (line) { return line.source === 'generated' && !line.assisted; })[0].text;
  }
  assert.notStrictEqual(poolLine(draft), poolLine(again));
  assert.strictEqual(again.hooks[0].text, draft.hooks[0].text);
  assert.notStrictEqual(again.hooks[0].text, interview.line);

  const spanish = core.buildSampleDraft(fixture({
    shape: { genre: 'Latin', language: 'spanish', explicit: 'clean', length: 'full' },
  }));
  assert.ok(allLines(spanish).some(function (line) { return line.text === 'La luz del pasillo se quedó encendida.'; }));
  assert.deepStrictEqual(core.verbatimCopies(spanish, interview), []);
  assert.ok((spanish.originalAnswers || []).some(function (item) { return item.text === interview.line; }));

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
  const shaped = core.buildStylePrompt({
    genre: 'R&B',
    era: '90s',
    energy: 'slow and warm',
    voice: '',
    texture: 'silky close vocal',
    instruments: ['electric piano', 'bass'],
    feeling: '',
    mix: 'polished and close',
    structure: 'medium verses, hook after the first verse, with a bridge',
  });
  assert.ok(shaped.prompt.includes('slow and warm energy'));
  assert.ok(shaped.prompt.includes('silky close vocal'));
  assert.ok(shaped.prompt.includes('polished and close'));
  assert.ok(shaped.prompt.includes('with a bridge'));
  assert.ok(!/\bSuno\b/i.test(shaped.prompt));
  assert.ok(style.prompt.includes('piano'));
  assert.ok(style.prompt.includes('bass'));
  assert.ok(style.prompt.includes('synth'));
  assert.ok(!style.prompt.includes('organ'));
  assert.ok(!/drake/i.test(style.prompt));
  assert.ok(!/taylor/i.test(style.prompt));
  assert.ok(style.prompt.indexOf('intimate') === -1);
  const feelOnly = core.buildStylePrompt({ feeling: 'heartbroken' });
  assert.strictEqual(feelOnly.prompt, 'heartbroken');
  const feelGenre = core.buildStylePrompt({ genre: 'R&B', feeling: 'heartbroken', instruments: ['piano'] });
  assert.ok(feelGenre.prompt.indexOf('R&B') !== -1);
  assert.ok(feelGenre.prompt.indexOf('piano') !== -1);
  assert.ok(feelGenre.prompt.indexOf('heartbroken') === -1);
  const feelLove = core.buildStylePrompt({ feeling: 'in love', energy: 'fast' });
  const feelAngry = core.buildStylePrompt({ feeling: 'angry', energy: 'fast' });
  assert.strictEqual(feelLove.prompt, feelAngry.prompt);
  assert.ok(feelLove.prompt.indexOf('fast energy') !== -1);
  assert.ok(feelLove.prompt.indexOf('in love') === -1);
  assert.ok(feelLove.prompt.indexOf('angry') === -1);

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
  assert.notStrictEqual(repaired.hooks[0].text, interview.line);
  assert.deepStrictEqual(core.verbatimCopies(repaired, interview), []);
  verbatimStrings(interview).forEach(function (text) {
    assert.ok((repaired.originalAnswers || []).some(function (item) { return item.text === text; }), 'repair dropped ' + text);
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
        label: 'Verse. Written with Grok',
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
  assert.notStrictEqual(credited.hooks[0].text, interview.line);
  assert.deepStrictEqual(core.verbatimCopies(credited, interview), []);
  assert.ok(allLines(credited).some(function (line) { return line.text === 'A real opening line.'; }));
  assert.ok(credited.sections.some(function (section) { return section.label === 'Chorus'; }));
  assert.strictEqual(credited.sections[0].label, 'Verse');

  const suno = core.formatSunoLyrics(draft);
  assert.ok(suno.startsWith('[Verse 1]\n'));
  assert.ok(suno.includes('\n\n[Pre-Chorus]\n'));
  assert.ok(suno.includes('\n\n[Chorus]\n'));
  assert.ok(suno.includes('\n\n[Verse 2]\n'));
  assert.ok(suno.includes('\n\n[Bridge]\n'));
  assert.ok(!suno.includes(interview.line));
  assert.ok(/hoodie|chair|home/i.test(suno));
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
      label: 'Chorus. Written with Grok',
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

  const shortLabels = core.normalizeInterview({
    mood: 'x'.repeat(41),
    title: 't'.repeat(120),
    words: {},
    shape: { genre: 'g'.repeat(60) },
  });
  assert.strictEqual(shortLabels.mood.length, 40);
  assert.strictEqual(shortLabels.title.length, 80);
  assert.strictEqual(shortLabels.shape.genre.length, 40);
  assert.ok(shortLabels.idea.indexOf('t'.repeat(80)) !== -1);
  assert.throws(function () {
    core.normalizeInterview({ idea: 'i'.repeat(core.STORY_MAX + 1), words: {}, shape: {} });
  }, function (err) { return err && err.code === 'long' && /Your idea/.test(err.message) && /3000/.test(err.message); });

  const aimHook = 'I want this song to make them laugh.';
  const toolVerse = "I'm making this song right now using song helper...";
  const toolMade = 'Song Helper made this song.';
  const toolHookB = 'Spark the wonder, feel the flow, song helper turns chaos into gold';
  const steps = 'We sat on the steps and did not say the hard part.';
  const porch = 'The porch light stayed on for her.';
  assert.strictEqual(core.isMetaLyric(aimHook), true);
  assert.strictEqual(core.isMetaLyric(toolHookB), true);
  assert.strictEqual(core.isMetaLyric(toolMade), true);
  assert.strictEqual(core.isMetaLyric(toolVerse), true);
  assert.strictEqual(core.isMetaLyric(steps), false);
  const metaOnly = {
    mood: 'hopeful',
    who: 'my sister',
    line: aimHook,
    happened: toolVerse,
    why: toolMade,
    shape: { genre: 'R&B', language: 'english', explicit: 'clean', length: 'short' },
    north: { forId: 'someone', aims: ['laugh'], opener: toolVerse },
  };
  assert.ok(/real detail/i.test(core.missingAnswers(metaOnly)));
  const metaDraft = core.buildSampleDraft(metaOnly);
  const metaBlob = JSON.stringify(metaDraft);
  assert.ok(!/make them laugh/i.test(metaBlob));
  assert.ok(!/song helper/i.test(metaBlob));
  assert.ok(!/this song/i.test(metaBlob));
  assert.strictEqual(metaDraft.hooks[0].text, '');
  assert.strictEqual(metaDraft.hooks[1].text, '');
  const storyInterview = core.normalizeInterview(Object.assign({}, metaOnly, {
    happened: steps,
    why: porch,
    north: { forId: 'someone', aims: ['laugh'], opener: steps, keep: porch },
  }));
  assert.strictEqual(core.missingAnswers(storyInterview), '');
  const leaked = core.draftFromModelJson(JSON.stringify({
    title: 'Gold',
    hooks: [
      { id: 'a', text: aimHook, source: 'user' },
      { id: 'b', text: toolHookB, source: 'generated' },
    ],
    sections: [{
      label: 'Verse',
      lines: [
        { text: toolMade, source: 'generated' },
        { text: toolVerse, source: 'user' },
        { text: steps, source: 'user' },
      ],
    }],
  }), storyInterview);
  const leakedBlob = JSON.stringify(leaked);
  assert.ok(!/I want this song to make them laugh/i.test(leakedBlob));
  assert.ok(!/song helper/i.test(leakedBlob));
  assert.ok(!/Spark the wonder/i.test(leakedBlob));
  assert.ok(!/made this song/i.test(leakedBlob));
  assert.ok(!/making this song/i.test(leakedBlob));
  assert.ok((leaked.originalAnswers || []).some(function (item) { return item.text === steps; }));
  assert.ok((leaked.originalAnswers || []).some(function (item) { return item.text === porch; }));
  assert.notStrictEqual(leaked.hooks[0].text, steps);
  assert.ok(/steps|porch/i.test(JSON.stringify(leaked.sections)));
  assert.deepStrictEqual(core.verbatimCopies(leaked, storyInterview), []);
  assert.notStrictEqual(leaked.hooks[1].text, toolHookB);
  const funnyAim = core.normalizeInterview(fixture({
    line: aimHook,
    shape: {
      genre: 'Comedy',
      pack: 'comedy',
      comedy: true,
      language: 'english',
      explicit: 'clean',
      length: 'short',
    },
  }));
  const funnyKept = core.draftFromModelJson(JSON.stringify({
    title: 'The crumb',
    hooks: [
      { id: 'a', text: aimHook, source: 'user' },
      { id: 'b', text: toolHookB, source: 'generated' },
    ],
    sections: [{
      label: 'Verse',
      lines: [
        { text: toolMade, source: 'generated' },
        { text: 'The crumb stayed on the plate.', source: 'generated' },
      ],
    }],
  }), funnyAim);
  assert.strictEqual(funnyKept.hooks[0].text, aimHook);
  assert.ok(!/song helper/i.test(JSON.stringify(funnyKept.sections)));
  assert.ok(!/Spark the wonder/i.test(funnyKept.hooks[1].text));
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
    assert.notStrictEqual(preview.json.draft.hooks[0].text, fixture().line);
    assert.deepStrictEqual(core.verbatimCopies(preview.json.draft, fixture()), []);
    assert.ok((preview.json.draft.originalAnswers || []).some(function (item) { return item.text === fixture().line; }));

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
    const funnyMode = await post({
      mode: 'funny',
      place: 'the kitchen at 2am',
      object: 'a chipped mug',
      quote: 'we will figure it out',
      mood: 'nostalgic',
      meter: 'funny',
      craft: { rabbit: true },
    }, '203.0.113.41');
    assert.strictEqual(funnyMode.statusCode, 200, funnyMode.json && funnyMode.json.error);
    const funnyBlob = JSON.stringify(funnyMode.json.draft);
    assert.ok(/chipped mug/i.test(funnyBlob));
    assert.ok(/we will figure it out/i.test(funnyBlob));
    assert.ok(!/supposed to make them laugh/i.test(funnyBlob));
    assert.ok(!/the joke waits/i.test(funnyBlob));
    assert.ok(!/this part is supposed/i.test(funnyBlob));
    assert.strictEqual(comedy.json.preview, true);
    assert.strictEqual(comedy.json.notice, core.PREVIEW_NOTICE);
    assert.strictEqual(comedy.json.attribution, '');
    const comedyText = JSON.stringify(comedy.json.draft);
    assert.ok(/pizza|crumb|sticky note/i.test(comedyText));
    assert.ok(!/supposed to make them laugh/i.test(comedyText));
    assert.ok(!/drumroll/i.test(comedyText));
    assert.ok(!/Written with Grok/.test(comedyText));
    assert.strictEqual(fetchCalls, 0);

    const aimOnly = await post({
      mood: 'hopeful',
      who: 'my sister',
      line: 'I want this song to make them laugh.',
      happened: "I'm making this song right now using song helper...",
      why: 'Song Helper made this song.',
      shape: { genre: 'R&B', language: 'english', explicit: 'clean', length: 'short' },
      north: {
        forId: 'someone',
        aims: ['laugh'],
        opener: "I'm making this song right now using song helper...",
      },
    }, '203.0.113.90');
    assert.strictEqual(aimOnly.statusCode, 400);
    assert.ok(/real detail/i.test(aimOnly.json.error));
    assert.ok(!aimOnly.json.draft);

    const honeyIp = '203.0.113.21';
    for (let i = 0; i < core.RATE_MAX; i += 1) handler._limiter.allow(honeyIp);
    const honey = await post(Object.assign(fixture(), { company_website: 'https://spam.test' }), honeyIp);
    assert.strictEqual(honey.statusCode, 400);
    assert.strictEqual(honey.json.ok, false);
    const blocked = await post(fixture(), honeyIp);
    assert.strictEqual(blocked.statusCode, 429);

    const story = ('We left for a new experience and new adventure. ').repeat(45).trim();
    assert.ok(story.length >= 2000 && story.length <= core.STORY_MAX);
    const keptStory = await post(Object.assign(fixture(), { happened: story }), '203.0.113.24');
    assert.strictEqual(keptStory.statusCode, 200);
    assert.ok(JSON.stringify(keptStory.json.draft).indexOf(story) !== -1);

    const long = await post(Object.assign(fixture(), { happened: 'y'.repeat(core.STORY_MAX + 1) }), '203.0.113.22');
    assert.strictEqual(long.statusCode, 400);
    assert.ok(/What happened/.test(long.json.error));
    assert.ok(/3000/.test(long.json.error));
    assert.ok(/shorten/i.test(long.json.error));

    const whoStory = ('For my sister on the porch. ').repeat(90).trim();
    const styleText = ('Close and homey, acoustic, Sunday kitchen. ').repeat(50).trim();
    assert.ok(whoStory.length >= 2400 && whoStory.length <= core.STORY_MAX);
    assert.ok(styleText.length >= 1800 && styleText.length <= core.STORY_MAX);
    const both = await post(Object.assign(fixture(), {
      happened: story,
      who: whoStory,
      stylePrompt: styleText,
      north: {
        forId: 'someone',
        opener: story,
        forText: whoStory,
        keep: 'I still set a place for you like you are coming home.',
      },
    }), '203.0.113.25');
    assert.strictEqual(both.statusCode, 200, both.json && both.json.error);
    assert.ok(JSON.stringify(both.json.draft).indexOf(story) !== -1);
    assert.strictEqual(both.json.ok, true);

    const whoLong = await post(Object.assign(fixture(), { who: 'n'.repeat(core.STORY_MAX + 1) }), '203.0.113.26');
    assert.strictEqual(whoLong.statusCode, 400);
    assert.ok(/Who/.test(whoLong.json.error));
    assert.ok(/3000/.test(whoLong.json.error));

    const styleLong = await post(Object.assign(fixture(), { stylePrompt: 's'.repeat(core.STORY_MAX + 1) }), '203.0.113.27');
    assert.strictEqual(styleLong.statusCode, 400);
    assert.ok(/Style prompt/.test(styleLong.json.error));
    assert.ok(/3000/.test(styleLong.json.error));

    const idea = ('A kitchen light and a long drive home. ').repeat(60).trim();
    assert.ok(idea.length > 1500 && idea.length <= core.STORY_MAX);
    const ownDraft = await post(Object.assign(fixture(), {
      idea: idea,
      title: 'Porch light ' + 'x'.repeat(100),
      mood: 'm'.repeat(80),
      sparkFeel: 'Mad and tender.',
      sparkStory: 'I stood in the doorway.',
      sparkKeep: 'The porch light.',
      shape: Object.assign({}, fixture().shape, { genre: 'Hip-hop, Afrobeats, late night soul' }),
    }), '203.0.113.28');
    assert.strictEqual(ownDraft.statusCode, 200, ownDraft.json && ownDraft.json.error);
    assert.ok(JSON.stringify(ownDraft.json.draft).indexOf('kitchen light') !== -1);
    const ownNorm = core.normalizeInterview(Object.assign(fixture(), {
      idea: 'A short idea.',
      title: 'Porch light stays on for the long drive home and the rest of this title that does not fit',
      mood: 'm'.repeat(80),
      shape: Object.assign({}, fixture().shape, { genre: 'g'.repeat(80) }),
    }));
    assert.ok(ownNorm.title.length <= 80);
    assert.ok(ownNorm.mood.length <= 40);
    assert.ok(ownNorm.shape.genre.length <= 40);
    assert.ok(ownNorm.idea.indexOf('Porch light stays on') !== -1);
    assert.ok(ownNorm.sparkAngle.indexOf('Porch light stays on') !== -1);

    const chunk = 'word '.repeat(600).trim();
    assert.ok(chunk.length <= core.STORY_MAX && chunk.length > 2500);
    const notes = [];
    for (let n = 0; n < 24; n += 1) notes.push({ ask: 'Follow up ' + n, text: chunk });
    const sensory = {};
    for (let s = 0; s < 30; s += 1) sensory['scene' + s] = chunk;
    const wide = await post(Object.assign(fixture(), {
      happened: chunk,
      who: chunk,
      why: chunk,
      idea: idea,
      stylePrompt: chunk,
      sparkFeel: 'Mad and tender.',
      sparkStory: 'I stood in the doorway.',
      sparkKeep: 'The porch light.',
      title: 'x'.repeat(200),
      mood: 'm'.repeat(90),
      north: {
        forId: 'someone',
        opener: chunk,
        forText: chunk,
        wisdom: chunk,
        keep: 'I still set a place for you like you are coming home.',
        notes: notes,
        sensory: sensory,
      },
      shape: Object.assign({}, fixture().shape, { genre: 'Hip-hop, Afrobeats' }),
    }), '203.0.113.29');
    assert.strictEqual(wide.statusCode, 200, wide.json && wide.json.error);
    assert.ok(core.BODY_MAX >= 480000);
    const fatBody = JSON.stringify(Object.assign(fixture(), { happened: 'h'.repeat(180000) }));
    assert.ok(fatBody.length > 160000 && fatBody.length < core.BODY_MAX);
    const fat = mockRes();
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.31' },
      body: fatBody,
    }, fat);
    assert.notStrictEqual(fat.statusCode, 413);
    assert.strictEqual(fat.statusCode, 400);
    assert.ok(/What happened/.test(fat.json.error));
    assert.ok(/3000/.test(fat.json.error));

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
    assert.strictEqual(live.json.draft.hooks[0].text, 'Rewritten hook');
    assert.deepStrictEqual(core.verbatimCopies(live.json.draft, fixture()), []);

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
    assert.ok(!retryLines.some(function (line) { return line.text === 'Me quedé despierto contigo.'; }));
    assert.ok(!retryLines.some(function (line) { return line.text === 'I woke up on a Saturday'; }));
    assert.deepStrictEqual(core.verbatimCopies(retried.json.draft, mixedInterview), []);
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
    assert.ok(!retrySuno.includes('Gracias por tu luz, mi amor.'));
    assert.ok(/luz/i.test(retrySuno));
    assert.ok(retrySuno.includes('Both of us still talking over garlic asada at 8:30.'));
    assert.ok(retrySuno.includes('Tesla X with the wings parked under a West Hollywood moon.'));
    assert.ok(retrySuno.includes('The same Saturday keeps both of the glasses on the counter.'));
    assert.ok(retrySuno.includes('West Hollywood can wait until the song is done.'));
    assert.ok(retrySuno.includes('Pepsi tonight?'));
    assert.ok(!retrySuno.includes('Me quedé despierto contigo.'));
    assert.ok(/contigo/i.test(retrySuno));
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

  const mug = 'The chipped mug is still in the kitchen.';
  assert.strictEqual(core.askFallback(mug), 'How do you feel about this?');
  assert.strictEqual(core.askPlan(mug, { lastAngle: 'feeling', asked: ['How do you feel about this?'] }).angle, 'who');
  const quoted = core.askPlan('She said "we will figure it out" and left.', { lastAngle: 'who' });
  assert.strictEqual(quoted.angle, 'next');
  assert.ok(/we will figure it out/.test(quoted.question));
  assert.ok(!/colou?r|smell/i.test(core.askPlan(mug, { lastAngle: 'said' }).question));
  assert.strictEqual(core.askPlan(mug, { lastAngle: 'said' }).question, 'What were you doing in the kitchen?');
  const seenAngles = [];
  let lastAngle = '';
  const askedList = [];
  for (let step = 0; step < 6; step += 1) {
    const plan = core.askPlan(mug, { lastAngle: lastAngle, asked: askedList });
    assert.notStrictEqual(plan.angle, lastAngle);
    assert.ok(askedList.indexOf(plan.question) === -1);
    assert.ok(!/colou?r|smell|what sound|texture|how hot|how cold/i.test(plan.question));
    seenAngles.push(plan.angle);
    askedList.push(plan.question);
    lastAngle = plan.angle;
  }
  assert.deepStrictEqual(seenAngles, ['feeling', 'who', 'next', 'said', 'place', 'hold']);
  assert.strictEqual(core.tidyAsk('What color is the chipped mug?', mug, { angle: 'feeling' }), 'How do you feel about this?');
  assert.strictEqual(core.tidyAsk('What color is the chipped mug?', mug, { angle: 'who', lastAngle: 'feeling', asked: ['How do you feel about this?'] }), 'Who is this about?');
  assert.ok(core.sensoryTrivia('What color is the chipped mug?', mug));
  assert.ok(!core.sensoryTrivia('What color is the blue mug?', 'the blue mug'));
  assert.strictEqual(core.tidyAsk('this song is supposed to make them laugh', mug, { angle: 'feeling' }), 'How do you feel about this?');
  assert.ok(!/colou?r/i.test(core.tidyAsk('a'.repeat(200), mug, { angle: 'next', lastAngle: 'who' })));
  const system = core.askSystem(core.askPlan(mug, {}));
  assert.ok(system.indexOf('feeling') !== -1);
  assert.ok(/do not ask about color/i.test(system));
  assert.ok(system.indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/.test(system));
  assert.ok(!/\bSuno\b/.test(core.tidyAsk('Use Suno for this', mug, { angle: 'feeling' })));
  const asked = await post({ action: 'ask', text: mug }, '203.0.113.77');
  assert.strictEqual(asked.statusCode, 200);
  assert.strictEqual(asked.json.ok, true);
  assert.ok(asked.json.question.indexOf('?') !== -1);
  assert.ok(asked.json.question.indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/.test(asked.json.question));
  assert.ok(!/colou?r/i.test(asked.json.question));
  if (!process.env.XAI_API_KEY) {
    assert.strictEqual(asked.json.source, 'sample');
    assert.strictEqual(asked.json.angle, 'feeling');
    assert.strictEqual(asked.json.question, 'How do you feel about this?');
  }
  const askedNext = await post({
    action: 'ask',
    text: mug,
    lastAngle: 'feeling',
    asked: ['How do you feel about this?'],
  }, '203.0.113.80');
  assert.strictEqual(askedNext.statusCode, 200);
  assert.ok(!/colou?r/i.test(askedNext.json.question));
  if (!process.env.XAI_API_KEY) {
    assert.strictEqual(askedNext.json.angle, 'who');
    assert.notStrictEqual(askedNext.json.angle, 'feeling');
  }
  const askEmpty = await post({ action: 'ask', text: '   ' }, '203.0.113.78');
  assert.strictEqual(askEmpty.statusCode, 200);
  assert.strictEqual(askEmpty.json.question, '');
  const askLong = await post({ action: 'ask', text: 'x'.repeat(core.STORY_MAX + 1) }, '203.0.113.79');
  assert.strictEqual(askLong.statusCode, 400);
  assert.ok(/3000/.test(askLong.json.error));
  assert.ok(read('api/song-helper.js').includes("action === 'ask'"));
  assert.ok(read('api/song-helper.js').includes('askSystem'));
  assert.ok(read('api/song-helper.js').includes('lastAngle'));
  const hookAsk = await post({
    action: 'ask',
    section: 'Hook',
    text: '',
    others: mug,
  }, '203.0.113.81');
  assert.strictEqual(hookAsk.statusCode, 200);
  assert.ok(hookAsk.json.question.indexOf('?') !== -1);
  assert.ok(!/colou?r/i.test(hookAsk.json.question));
  if (!process.env.XAI_API_KEY) {
    assert.strictEqual(hookAsk.json.source, 'sample');
    assert.strictEqual(hookAsk.json.angle, 'feeling');
    assert.ok(/Hook/.test(hookAsk.json.question));
    assert.ok(/feel/i.test(hookAsk.json.question));
  }
  const bothLong = await post({
    action: 'ask',
    section: 'Hook',
    text: 'x'.repeat(2000),
    others: 'y'.repeat(1500),
  }, '203.0.113.82');
  assert.strictEqual(bothLong.statusCode, 400);
  assert.ok(/3000/.test(bothLong.json.error));
  assert.ok(!bothLong.json.question);
  const suggested = await post({
    action: 'suggest',
    section: 'Hook',
    text: 'The mug is still in the kitchen.',
    others: '',
  }, '203.0.113.83');
  assert.strictEqual(suggested.statusCode, 200);
  assert.strictEqual(suggested.json.ok, true);
  assert.ok(suggested.json.options.length >= 1 && suggested.json.options.length <= 3);
  assert.ok(suggested.json.options.join(' ').indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/.test(suggested.json.options.join(' ')));
  assert.ok(!/colou?r/i.test(suggested.json.options.join(' ')));
  if (!process.env.XAI_API_KEY) {
    assert.strictEqual(suggested.json.source, 'sample');
    assert.ok(/Use this/.test(suggested.json.notice));
  }
  assert.ok(read('api/song-helper.js').includes('handleSuggest'));
  assert.ok(read('api/song-helper.js').includes("action === 'suggest'"));
  const extended = await post({
    action: 'extend',
    section: 'Verse 1',
    text: 'The mug is still in the kitchen.',
    others: '',
  }, '203.0.113.84');
  assert.strictEqual(extended.statusCode, 200);
  assert.strictEqual(extended.json.ok, true);
  assert.ok(extended.json.text.indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/i.test(extended.json.text));
  if (!process.env.XAI_API_KEY) {
    assert.strictEqual(extended.json.source, 'sample');
    assert.ok(extended.json.text.indexOf('The mug is still in the kitchen.') === 0);
    assert.ok(extended.json.text.length > 'The mug is still in the kitchen.'.length);
  }
  const shortened = await post({
    action: 'shorten',
    section: 'Verse 1',
    text: 'The mug is still in the kitchen after you left the light on.',
    others: '',
  }, '203.0.113.85');
  assert.strictEqual(shortened.statusCode, 200);
  assert.ok(shortened.json.text.indexOf('\u2014') === -1);
  if (!process.env.XAI_API_KEY) {
    assert.ok(shortened.json.text.length < 'The mug is still in the kitchen after you left the light on.'.length);
  }
  const rhymed = await post({
    action: 'rhymify',
    section: 'Hook',
    text: 'Stay with me tonight.',
    others: '',
  }, '203.0.113.86');
  assert.strictEqual(rhymed.statusCode, 200);
  assert.ok(/Accept/.test(rhymed.json.notice));
  assert.ok(rhymed.json.text.indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/i.test(rhymed.json.text + rhymed.json.notice));
  if (!process.env.XAI_API_KEY) {
    assert.strictEqual(rhymed.json.source, 'sample');
    assert.ok(rhymed.json.text.indexOf('Stay with me tonight.') !== -1);
    assert.notStrictEqual(rhymed.json.text, 'Stay with me tonight.');
  }
  const kept = 'The porch light stayed on.';
  const toned = core.toneFallback(kept, 'heartfelt');
  assert.strictEqual(toned.indexOf(kept), 0);
  assert.ok(toned.length > kept.length);
  assert.ok(toned.indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/.test(toned));
  assert.ok(/Fired up/.test(core.toneLabel('fired')));
  assert.ok(/Keep every word they wrote/.test(core.rewriteSystem('tone', 'Verse 1', 'Heartfelt')));
  const tonePass = await post({
    action: 'tone',
    section: 'Verse 1',
    text: kept,
    tone: 'heartfelt',
    others: '',
  }, '203.0.113.96');
  assert.strictEqual(tonePass.statusCode, 200);
  assert.ok(tonePass.json.text.indexOf(kept) === 0);
  assert.ok(tonePass.json.text.length > kept.length);
  assert.ok(/AI-assisted/.test(tonePass.json.notice));
  assert.ok(tonePass.json.text.indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/i.test(tonePass.json.text + tonePass.json.notice));
  assert.ok(read('api/song-helper.js').includes("action === 'tone'"));
  const rewriteLong = await post({
    action: 'rhymify',
    section: 'Hook',
    text: 'x'.repeat(2000),
    others: 'y'.repeat(1500),
  }, '203.0.113.87');
  assert.strictEqual(rewriteLong.statusCode, 400);
  assert.ok(/3000/.test(rewriteLong.json.error));
  const formatted = await post({
    action: 'format',
    text: 'I woke up and the porch light was on\nYou left your jacket on the chair\n\nI still set a place for you\n\nThe kettle clicked and I poured one cup\n\nI still set a place for you\n',
  }, '203.0.113.88');
  assert.strictEqual(formatted.statusCode, 200);
  assert.strictEqual(formatted.json.ok, true);
  assert.ok(formatted.json.sections.some(function (row) { return row.label === 'Hook' && row.text.indexOf('I still set a place for you') !== -1; }));
  assert.ok(formatted.json.sections.map(function (row) { return row.text; }).join('\n').indexOf('porch light') !== -1);
  const formatLines = formatted.json.sections.map(function (row) { return row.text; }).join('\n');
  assert.ok(formatLines.indexOf('I woke up and the porch light was on') !== -1);
  assert.ok(formatLines.indexOf('The kettle clicked and I poured one cup') !== -1);
  assert.ok(JSON.stringify(formatted.json.sections).indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/i.test(JSON.stringify(formatted.json)));
  if (!process.env.XAI_API_KEY) assert.strictEqual(formatted.json.source, 'sample');
  const formatLong = await post({ action: 'format', text: 'x'.repeat(core.STORY_MAX + 1) }, '203.0.113.89');
  assert.strictEqual(formatLong.statusCode, 400);
  assert.ok(/3000/.test(formatLong.json.error));
  assert.ok(read('api/song-helper.js').includes('handleFormat'));
  assert.ok(read('api/song-helper.js').includes("action === 'format'"));
  const sounded = await post({ action: 'sounds', text: 'Adele' }, '203.0.113.90');
  assert.strictEqual(sounded.statusCode, 200);
  assert.strictEqual(sounded.json.ok, true);
  assert.ok(sounded.json.traits);
  assert.strictEqual(sounded.json.traits.label, 'Influence, not copying.');
  assert.ok(/piano/.test(sounded.json.traits.prompt));
  assert.ok(!/adele/i.test(JSON.stringify(sounded.json.traits) + sounded.json.notice));
  assert.ok(sounded.json.traits.prompt.indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/i.test(JSON.stringify(sounded.json)));
  if (!process.env.XAI_API_KEY) assert.strictEqual(sounded.json.source, 'sample');
  const genreSound = await post({ action: 'sounds', text: '90s R&B' }, '203.0.113.91');
  assert.strictEqual(genreSound.statusCode, 200);
  assert.strictEqual(genreSound.json.traits.era, '90s');
  assert.ok(/R&B/.test(genreSound.json.traits.genre));
  assert.ok(/90s/.test(genreSound.json.traits.prompt));
  const songSound = await post({ action: 'sounds', text: 'Billie Jean' }, '203.0.113.92');
  assert.strictEqual(songSound.statusCode, 200);
  assert.ok(!/billie|jean/i.test(JSON.stringify(songSound.json.traits) + songSound.json.notice));
  assert.strictEqual(songSound.json.traits.era, '80s');
  const plainSound = await post({ action: 'sounds', text: 'Zelda Quill' }, '203.0.113.93');
  assert.strictEqual(plainSound.statusCode, 200);
  assert.strictEqual(plainSound.json.traits.matched, false);
  assert.ok(!/zelda|quill/i.test(JSON.stringify(plainSound.json.traits) + plainSound.json.notice));
  const emptySound = await post({ action: 'sounds', text: '   ' }, '203.0.113.94');
  assert.strictEqual(emptySound.statusCode, 200);
  assert.strictEqual(emptySound.json.traits, null);
  const longSound = await post({ action: 'sounds', text: 'x'.repeat(201) }, '203.0.113.95');
  assert.strictEqual(longSound.statusCode, 400);
  assert.ok(read('api/song-helper.js').includes('handleSounds'));
  assert.ok(read('api/song-helper.js').includes("action === 'sounds'"));
  assert.ok(read('api/song-helper.js').includes('Do not quote lyrics'));
  assert.ok(read('api/song-helper.js').includes('handleRewrite'));
  assert.ok(read('api/song-helper.js').includes("action === 'extend'"));
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
  assert.ok(/pizza|crumb|sticky note/i.test(jokeText));
  assert.ok(!/supposed to make them laugh/i.test(jokeText));
  assert.ok(!/drumroll/i.test(jokeText));
  assert.ok(/very serious song/i.test(joke.title));
  assert.notStrictEqual(joke.hooks[0].text, fixture().line);
  assert.deepStrictEqual(core.verbatimCopies(joke, fixture()), []);
  assert.ok(/pizza|crumb/i.test(joke.hooks[1].text));
  assert.ok(!/drumroll|supposed to make/i.test(joke.hooks[1].text));
  assert.ok(allLines(joke).some(function (line) {
    return lineHasPhrase(line.text, 'the last slice of pizza') && line.text.toLowerCase() !== 'the last slice of pizza' && line.source === 'user';
  }));
  assert.ok(!/written with grok/i.test(jokeText));

  assert.ok(/do not parody/i.test(core.SYSTEM_PROMPT));
  assert.ok(/to the tune of/i.test(core.SYSTEM_PROMPT));
  assert.ok(/public figures/i.test(core.SYSTEM_PROMPT));
  assert.ok(/good-natured/i.test(core.SYSTEM_PROMPT));
  assert.ok(/dump raw words/i.test(core.SYSTEM_PROMPT));

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
  assert.notStrictEqual(mixedDraft.hooks[0].text, 'Gracias por tu luz, mi amor.');
  assert.ok(/luz/i.test(mixedDraft.hooks[0].text));
  assert.deepStrictEqual(core.verbatimCopies(mixedDraft, mixed), []);
  Object.keys(mixed.words).forEach(function (key) {
    const bit = mixed.words[key];
    assert.ok(allLines(mixedDraft).some(function (line) {
      return lineHasPhrase(line.text, bit) && line.text.toLowerCase() !== bit.toLowerCase() && line.source === 'user';
    }), 'missing weave for ' + bit);
  });
  mixedDraft.sections.filter(function (section) { return /^verse\b/i.test(section.label); }).forEach(function (section) {
    assert.ok(section.lines.length >= 4, 'sample verse needs four lines');
  });
  assert.ok(!allLines(mixedDraft).some(function (line) { return line.text === 'I woke up on a Saturday'; }));
  assert.ok(!allLines(mixedDraft).some(function (line) { return line.text === 'Me quedé despierto contigo.'; }));
  assert.ok(/saturday/i.test(JSON.stringify(mixedDraft.sections)));
  assert.ok(/contigo/i.test(JSON.stringify(mixedDraft.sections)));
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
  assert.ok(!mixedSuno.includes('Gracias por tu luz, mi amor.'));
  assert.ok(/luz/i.test(mixedSuno));
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
  assert.ok(!allLines(thin).some(function (line) { return line.text === 'Me quedé despierto contigo.'; }));
  assert.ok((thin.originalAnswers || []).some(function (item) { return item.text === 'Me quedé despierto contigo.'; }));
  assert.deepStrictEqual(core.verbatimCopies(thin, mixed), []);
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
  assert.ok(html.includes('Talk it through with Plai'));
  assert.ok(html.includes('Tell me your stories. Your own words become the lyrics, and every answer is saved as your record of writing it.'));
  assert.ok(read('song-helper.js').includes("Here's what I heard in your words"));
  assert.ok(read('song-helper.js').includes("textContent = 'Shape it'"));
  assert.ok(read('song-helper.js').includes('SHAPE_TAPS'));
  assert.ok(read('lib/song-flow.js').includes('Make it funny'));
  assert.ok(read('lib/song-flow.js').includes('Make it hopeful'));
  assert.ok(read('lib/song-flow.js').includes('Make it hit harder'));
  assert.ok(read('lib/song-flow.js').includes('Change the style'));
  assert.ok(read('lib/song-flow.js').includes('Keep my words and change only the sound'));
  assert.ok(!read('song-helper.js').includes("Here's the style I'm hearing from your words"));
  assert.ok(!/\bSuno\b/.test(read('lib/song-flow.js').match(/SHAPE_TAPS = \[[\s\S]*?\];/)[0]));
  assert.ok(!/—/.test(read('lib/song-flow.js').match(/SHAPE_TAPS = \[[\s\S]*?\];/)[0]));
  assert.ok(read('song-flow-page.js').includes("That's enough, write my song"));
  assert.ok(read('song-flow-page.js').includes('Talk'));
  assert.ok(read('lib/song-flow.js').includes('Do not add a story they did not tell.'));
  assert.ok(!/\bSuno\b/.test(html.match(/id="sh-purpose"[\s\S]*?<\/section>/)[0]));
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
  assert.ok(html.includes('song-helper.js?v=20261010reset'));
  assert.ok(html.includes('song-helper-v2.js?v=20261010reset'));
  assert.ok(html.includes('lib/song-helper.js?v=20261010reset'));
  assert.ok(html.includes('lib/style-clues.js?v=20261010tint'));
  assert.ok(html.includes('lib/suno-style.js?v=20261010tint'));
  assert.ok(html.includes('lib/song-modes.js?v=20261010song'));
  assert.ok(html.includes('It tints the words a little'));
  assert.ok(html.includes('It does not choose the genre, tempo, instruments, or era.'));
  assert.ok(html.includes('song-flow-page.js?v=20261010hear'));
  assert.ok(html.includes('song-helper.css?v=20261010reset'));
  assert.ok(html.includes('lib/song-flow.js?v=20261010song'));
  const pageBlock = html.slice(html.indexOf('id="sh-page"'), html.indexOf('id="sh-source"'));
  assert.ok(pageBlock.indexOf('id="sh-page-sections"') !== -1);
  assert.ok(pageBlock.includes('Add a verse'));
  assert.ok(pageBlock.includes('Add an outro'));
  const pageJs = read('song-helper-v2.js');
  assert.ok(pageJs.includes('Ask me a question'));
  assert.ok(pageJs.includes('Give me a suggestion'));
  assert.ok(pageJs.includes('Rhymify'));
  assert.ok(pageJs.includes('Keep mine'));
  assert.ok(pageJs.includes('AI-assisted'));
  assert.ok(pageJs.includes('commitPreview'));
  assert.ok(pageJs.includes('Undo'));
  assert.ok(pageJs.includes('Make it song format') || pageBlock.includes('Make it song format'));
  assert.ok(pageJs.includes('Accept this structure') || pageBlock.includes('Accept this structure'));
  assert.ok(pageBlock.includes('Keep what I pasted'));
  assert.ok(pageBlock.includes('Polish the labels'));
  assert.ok(pageJs.includes('sameWords'));
  assert.ok(pageJs.includes('Use this'));
  assert.ok(pageJs.includes('applySuggestion'));
  assert.ok(pageJs.includes('proposeSectionText'));
  assert.ok(pageJs.includes('sh-page-sections'));
  assert.ok(pageBlock.includes('I already have my lyrics'));
  assert.ok(pageBlock.includes('id="sh-meter"'));
  assert.ok(pageBlock.includes('id="sh-meter-next"'));
  assert.ok(pageBlock.indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/.test(pageBlock));
  assert.ok(!/Human first/i.test(pageBlock));
  assert.ok(!/id="sh-start"[^>]*hidden/.test(html));
  assert.ok(/id="sh-page"[^>]*hidden/.test(html));
  assert.ok(html.indexOf('id="sh-start"') < html.indexOf('id="sh-page"'));
  assert.ok(html.includes('How do you want to start?'));
  assert.ok(html.indexOf('id="sh-restart"') < html.indexOf('id="sh-start"'));
  assert.ok(!/id="sh-restart"[^>]*hidden/.test(html));
  assert.ok(html.includes('Clear everything?'));
  assert.ok(html.includes('Save a copy to My lyrics'));
  assert.ok(html.includes('id="sh-restart-clear">Clear everything'));
  assert.ok(html.includes('Keep working'));
  assert.ok(/id="sh-restart-confirm"[^>]*hidden/.test(html));
  const restartBlock = html.slice(html.indexOf('id="sh-start-over"'), html.indexOf('id="sh-start"'));
  assert.ok(restartBlock.indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/.test(restartBlock));
  assert.ok(js.includes('sh-restart-confirm'));
  assert.ok(js.includes('clearSongHelperAutosave'));
  assert.ok(!js.includes('restartBtn.hidden'));
  assert.ok(js.includes('function restoreWizard'));
  assert.ok(read('song-flow-page.js').includes('function restoreFlow'));
  assert.ok(read('song-helper-v2.js').includes('function restoreOwn'));
  assert.ok(read('song-helper-v2.js').includes('copyRecord'));
  const store = {
    session: memoryStore(),
    local: memoryStore(),
  };
  store.local.setItem(core.STORY_STORE, '{"flow":{"opener":"the hoodie"}}');
  store.local.setItem('plaiground.songHelper.pendingSong', '{"text":"keep me"}');
  store.session.setItem(core.SESSION_KEY, '{"line":"still here"}');
  core.clearSongHelperAutosave(store);
  assert.strictEqual(store.local.getItem(core.STORY_STORE), null);
  assert.strictEqual(store.session.getItem(core.SESSION_KEY), null);
  assert.strictEqual(store.local.getItem('plaiground.songHelper.pendingSong'), '{"text":"keep me"}');
  assert.strictEqual(core.songCopyText([
    { label: 'Opening', text: 'You left the hoodie.' },
    { label: 'Opening', text: 'You left the hoodie.' },
    { label: 'Skip', text: '   ' },
    { label: '', text: 'A second line.' },
  ]), 'Opening\nYou left the hoodie.\n\nA second line.');
  assert.ok(html.includes('I already have my story or lyrics'));
  assert.ok(html.includes('I already have some lyrics'));
  assert.ok(html.includes('id="sh-choice-lyrics"'));
  assert.ok(html.includes('id="sh-have"'));
  assert.ok(html.includes('id="sh-have-finish"'));
  assert.ok(html.includes('id="sh-have-format"'));
  assert.ok(html.includes('id="sh-have-rhymify"'));
  assert.ok(html.includes('id="sh-have-tone"'));
  assert.ok(html.includes('id="sh-have-style"'));
  assert.ok(read('song-helper.js').includes("host.id === 'sh-have-actions'"));
  assert.ok(html.includes('Suggest the next verse or hook in your voice.'));
  assert.ok(html.includes('Sort what you pasted into Verse, Hook, and Bridge.'));
  assert.ok(html.includes('A side-by-side preview. Your words stay until you accept.'));
  assert.ok(html.includes('Keep your words, and add one line in the tone you pick.'));
  assert.ok(html.includes('Build the style prompt for these lyrics.'));
  assert.ok(html.includes('Your original stays saved.'));
  assert.ok(html.indexOf('id="sh-choice-lyrics"') < html.indexOf('id="sh-page"'));
  assert.ok(html.includes('id="sh-choice-page"'));
  assert.ok(html.includes('Create from scratch'));
  assert.ok(html.includes('Start with an idea'));
  assert.ok(read('song-helper-v2.js').includes('bootWriteFirst'));
  assert.ok(read('song-helper-v2.js').includes('appendAnswer'));
  assert.ok(read('song-helper-v2.js').includes('plaiground.songHelper.story'));
  assert.ok(js.includes('openFinishedLyrics'));
  assert.ok(html.includes('Sounds like'));
  assert.ok(html.includes('Influence, not copying'));
  assert.ok(html.includes('id="sh-sounds-like"'));
  assert.ok(html.includes('Turn it into traits'));
  assert.ok(html.includes('Use this layout'));
  assert.ok(js.includes('fillSoundTraits'));
  assert.ok(js.includes("action: 'sounds'"));
  assert.ok(js.includes('scrubSoundText'));
  const styleBlock = html.match(/data-step="style"[\s\S]*?<\/section>/)[0];
  assert.ok(styleBlock.indexOf('\u2014') === -1);
  assert.ok(!/\bSuno\b/.test(styleBlock));
  assert.ok(js.includes('lyricsOpen'));
  const v2 = read('song-helper-v2.js');
  assert.ok(v2.includes('function ownIdea'));
  assert.ok(v2.includes("input.id = 'sh-own-' + item.id"));
  assert.ok(v2.includes('armStory(area)'));
  assert.ok(v2.includes('armStory(input)'));
  assert.ok(v2.includes('How do you feel about this?') || read('lib/song-questions.js').includes('How do you feel about this?'));
  assert.ok(html.includes('id="sh-who"'));
  assert.ok(!/id="sh-who"[^>]*maxlength/.test(html));
  assert.ok(js.includes('plaiground.songHelper.story'));
  assert.ok(read('song-flow-page.js').includes('plaiground.songHelper.story'));
  assert.ok(read('song-flow-page.js').includes('lyricSeeds'));
  assert.ok(!/I want this song to /.test(read('song-flow-page.js')));
  assert.ok(html.includes('lib/song-modes.js?v=20261010song'));
  assert.ok(read('lib/song-flow.js').includes("className = 'sh-count'"));
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
  assert.ok(html.includes('Copy lyrics'));
  assert.ok(!html.includes('Copy for Suno'));
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
  assert.ok(index.includes('id="playground"'));
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
