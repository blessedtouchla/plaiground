'use strict';

/**
 * Song Helper v2 modes, craft checks, and demo drafts.
 * Shared by the page and the server. No API key lives here.
 * Demo output is a sample. It must not be described as AI.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SongModes = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var DEMO_NOTICE = 'Demo mode. This is a sample, not written by AI.';
  var FAIR_USE_NOTE = 'A parody can be fair use when it comments on the original. A court decides that later, not this page. This is not legal advice.';
  var PARODY_LABEL = 'Parody';
  var RELEASE_NOTE = 'Label the release as a parody. Do not upload the original recording. Do not ask a generator for the original singer’s voice. A look-alike title or cover can still be a problem.';
  var AFFILIATION_NOTE = 'Not affiliated with, endorsed by, or speaking for the person this tribute names.';
  var PD_NOTE = 'US compositions published in 1930 entered the public domain on January 1, 2026. US sound recordings published in 1925 entered the public domain on January 1, 2026. Confirm the edition and the recording year before you release. This is not legal advice.';
  var PD_SOURCE = 'US Copyright Office term rules and the Music Modernization Act classics schedule.';
  var CONCRETE_RULE = 'Start with something you can point at: a place, an object, or a sentence someone said.';
  var RULER_NOTE = 'A rough count. Not a dictionary.';

  var MODES = [
    { id: 'write', label: 'Write', blurb: 'The long way in. Real details first, then a draft around your words.' },
    { id: 'hook', label: 'Hook', blurb: 'Three questions first. The chorus is built from those answers, not from a placeholder.' },
    { id: 'flip', label: 'Flip it', blurb: 'Same story, another genre. Pick it up front so the first draft already leans that way, once the feeling and the questions are filled. Or use it later on lyrics you already wrote or pasted.', transform: true },
    { id: 'funkify', label: 'Funkify', blurb: 'Put the story on the one. Bass pocket, not a costume. Pick it up front for the first draft, or later on lyrics you already have.', transform: true },
    { id: 'funny', label: 'Funny', blurb: 'A joke with a meter: Clean, Funny, Savage, or Rude.' },
    { id: 'madlibs', label: 'Mad Libs', blurb: 'You fill the blanks. The song is built from those words.' },
    { id: 'review', label: 'Review', blurb: 'Line edits you can undo.' },
    { id: 'parody', label: 'Parody', blurb: 'A critique check first. The lyric has to comment on the original.' },
    { id: 'public-domain', label: 'Public Domain Remix', blurb: 'Compositions from 1930 and earlier. Recordings through 1925. The source stays on the page.' },
    { id: 'cover', label: 'Cover it legally', blurb: 'What a mechanical license is, in plain steps. This page does not sell one.' },
    { id: 'homage', label: 'Homage', blurb: 'A tribute. It says it is not affiliated.' },
    { id: 'superhero', label: 'Superhero', blurb: 'You are the hero. Your details are the origin.' },
    { id: 'bars', label: 'Bars', blurb: 'A style, an era, a length, and a region.' },
    { id: 'poem', label: 'Poem', blurb: 'A form, or a craft note in the spirit of a poet. Not a copy of their poem.' },
    { id: 'battle', label: 'Battle', blurb: 'Trade verses, one at a time. Opens the battle page.' },
  ];

  var CLICHES = [
    'the city never sleeps',
    'heart on my sleeve',
    'rise and grind',
    'on my grind',
    'started from the bottom',
    'living my best life',
    'tears on my pillow',
    'voice of a generation',
    'in the style of',
    'chasing my dreams',
    'stars in your eyes',
    'dance like nobody is watching',
    'everything happens for a reason',
    'at the end of the day',
    'only god can judge me',
    'haters gonna hate',
    'money on my mind',
  ];

  var HEROES = [
    'batman', 'superman', 'spider-man', 'spiderman', 'iron man', 'ironman',
    'wonder woman', 'black panther', 'wolverine', 'deadpool', 'thor', 'hulk',
    'captain america', 'harley quinn', 'joker', 'darth vader', 'harry potter',
  ];

  var PD_WORKS = [
    { title: 'The Entertainer', creators: 'Scott Joplin', year: 1902, kind: 'composition', note: 'Published 1902.' },
    { title: 'Take Me Out to the Ball Game', creators: 'Jack Norworth and Albert Von Tilzer', year: 1908, kind: 'composition', note: 'Published 1908.' },
    { title: "Alexander's Ragtime Band", creators: 'Irving Berlin', year: 1911, kind: 'composition', note: 'Published 1911.' },
    { title: 'St. Louis Blues', creators: 'W. C. Handy', year: 1914, kind: 'composition', note: 'Published 1914. Later arrangements can still be protected.' },
    { title: 'Charleston', creators: 'James P. Johnson and Cecil Mack', year: 1923, kind: 'composition', note: 'Published 1923. A later recording of it may still be protected.' },
    { title: 'Rhapsody in Blue', creators: 'George Gershwin', year: 1924, kind: 'composition', note: 'The 1924 composition. Later arrangements and recordings can still be protected.' },
  ];

  var MECHANICAL_STEPS = [
    'You are recording someone else’s song. The composition is still theirs.',
    'A mechanical license covers your audio recording of that composition. It does not cover the original recording, a video, or a sampled master.',
    'In the US, many interactive streams run through the Mechanical Licensing Collective (themlc.com). Downloads and physical copies are often handled by a publisher or a licensing desk such as the Harry Fox Agency.',
    'You need the writers and the publishers named. If you cannot find them, do not guess.',
    'This page does not sell a license and does not quote a fee. Fees change, and they are not ours to invent.',
    'Changing the words can move you out of a standard mechanical license. The publisher can say no. A parody is a different lane on this page.',
  ];

  var BAR_STYLES = [
    { id: 'defjam', label: 'Def Jam poetic' },
    { id: 'east', label: 'East' },
    { id: 'west', label: 'West' },
    { id: 'south', label: 'South / trap' },
    { id: 'midwest', label: 'Midwest' },
    { id: 'drill', label: 'Drill' },
    { id: 'conscious', label: 'Conscious' },
  ];

  var POEM_FORMS = [
    { id: 'sonnet', label: 'Sonnet' },
    { id: 'haiku', label: 'Haiku' },
    { id: 'limerick', label: 'Limerick' },
    { id: 'villanelle', label: 'Villanelle' },
    { id: 'free', label: 'Free verse' },
    { id: 'confucius', label: 'Confucius Says' },
    { id: 'fortune', label: 'Fortune Cookie' },
    { id: 'lesson', label: 'Life Lesson' },
    { id: 'newage', label: 'New Age' },
    { id: 'future', label: 'Future' },
  ];

  var POET_SPIRITS = [
    { id: '', label: 'No poet note' },
    { id: 'dickinson', label: 'Dickinson (dashes, a small image)' },
    { id: 'hughes', label: 'Hughes (a city, a river, plain speech)' },
    { id: 'frost', label: 'Frost (a road, a choice, spoken meter)' },
    { id: 'rumi', label: 'Rumi (a door, a friend, a turn)' },
    { id: 'angelou', label: 'Angelou (a rising line, spoken plain)' },
    { id: 'shakespeare', label: 'Shakespeare (a turn at the end)' },
  ];

  var FUNNY_METERS = [
    { id: 'clean', label: 'Clean' },
    { id: 'funny', label: 'Funny' },
    { id: 'savage', label: 'Savage' },
    { id: 'rude', label: 'Rude' },
  ];

  function isPlaceholderLyric(text) {
    var value = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!value) return false;
    if (value.indexOf('the hook sentence, what happened, and why') !== -1) return true;
    if (value.indexOf('answers stay unseen') !== -1) return true;
    return false;
  }

  var STORY_MAX = 3000;

  function clip(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max || 280);
  }

  function takeStory(value, label) {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (text.length > STORY_MAX) {
      var err = new Error(String(label || 'That answer') + ' is a little long. The limit is ' + STORY_MAX + ' characters. Shorten it and try again.');
      err.code = 'long';
      err.field = label || 'That answer';
      err.limit = STORY_MAX;
      throw err;
    }
    return text;
  }

  function clipBlock(value, max) {
    return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, max || 4000);
  }

  function isTransformMode(id) {
    var mode = modeById(id);
    return Boolean(mode && mode.transform && mode.id === String(id || ''));
  }

  function sourceLines(input) {
    return clipBlock(input && input.lines, 4000).split('\n').map(function (text) {
      return String(text || '').trim();
    }).filter(function (text) {
      return text && !isPlaceholderLyric(text);
    }).slice(0, 24);
  }

  function modeById(id) {
    var key = String(id || 'write');
    for (var i = 0; i < MODES.length; i += 1) {
      if (MODES[i].id === key) return MODES[i];
    }
    return MODES[0];
  }

  function line(text, source) {
    return { text: text, source: source || 'generated', role: '', locked: false, vote: 0 };
  }

  function section(label, rows) {
    return { label: label, lines: rows };
  }

  function clicheHits(text) {
    var lower = String(text || '').toLowerCase();
    return CLICHES.filter(function (phrase) { return lower.indexOf(phrase) !== -1; });
  }

  function countSyllables(word) {
    var w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    var trimmed = w.replace(/e$/, '');
    var groups = trimmed.match(/[aeiouy]+/g);
    return groups ? Math.max(1, groups.length) : 1;
  }

  function lineRuler(text) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var count = 0;
    var pattern = [];
    words.forEach(function (word) {
      count += countSyllables(word);
      pattern.push(/^(a|an|the|and|or|but|of|to|in|on|for|with|at|from|by|my|your)$/i.test(word) ? 'x' : '/');
    });
    return { count: count, pattern: pattern.join(' '), note: RULER_NOTE };
  }

  function titlesTooClose(original, next) {
    function norm(value) {
      return String(value || '').toLowerCase()
        .replace(/\b(remix|remake|pt|part|vol|volume|ii|iii)\b/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    var a = norm(original);
    var b = norm(next);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length > 4 && b.length > 4 && (b.indexOf(a) !== -1 || a.indexOf(b) !== -1)) return true;
    if (Math.abs(a.length - b.length) > 2) return false;
    var diff = 0;
    var n = Math.max(a.length, b.length);
    for (var i = 0; i < n; i += 1) if (a[i] !== b[i]) diff += 1;
    return a.length > 6 && b.length > 6 && diff <= 1;
  }

  function lookalikeArt(text) {
    return /\b(same (cover|art|artwork)|look-?alike (cover|art|artwork)|copy the (cover|art|artwork)|trace the (cover|art))\b/i.test(String(text || ''));
  }

  function normalizeInput(body) {
    var src = body || {};
    var craft = src.craft || {};
    var mode = modeById(src.mode).id;
    return {
      mode: mode,
      place: takeStory(src.place, 'Where you were'),
      object: takeStory(src.object, 'Something you can point at'),
      quote: takeStory(src.quote || src.sparkAngle, 'What someone said'),
      genre: clip(src.genre, 40),
      title: clip(src.title, 80),
      originalTitle: clip(src.originalTitle, 80),
      comment: takeStory(src.comment, 'Comment'),
      name: clip(src.name, 80),
      year: clip(src.year, 8),
      kind: src.kind === 'recording' ? 'recording' : 'composition',
      work: clip(src.work, 80),
      meter: ['clean', 'funny', 'savage', 'rude'].indexOf(src.meter) === -1 ? 'clean' : src.meter,
      barStyle: clip(src.barStyle, 24) || 'east',
      era: clip(src.era, 24) || 'now',
      bars: ['4', '8', '16', 'hook'].indexOf(String(src.bars)) === -1 ? '8' : String(src.bars),
      rhymeMeter: clampMeter(src.rhymeMeter),
      wordplayMeter: clampMeter(src.wordplayMeter),
      varietyMeter: clampMeter(src.varietyMeter),
      delivery: clip(src.delivery, 160),
      region: clip(src.region, 40),
      slang: clip(src.slang, 40),
      kind: clip(src.kind, 24),
      part: clip(src.part, 16) || 'song',
      live: liveList(src.live),
      form: clip(src.form, 24) || 'free',
      spirit: clip(src.spirit, 24),
      artNote: clip(src.artNote, 160),
      parodyAck: src.parodyAck === true || src.parody_ack === true,
      lines: clipBlock(src.lines, 4000),
      verb: clip(src.verb, 40),
      line: takeStory(src.line || src.hookSentence || src.hook, 'Hook sentence'),
      happened: takeStory(src.happened, 'What happened'),
      why: takeStory(src.why, 'Why it matters'),
      mood: clip(src.mood, 40),
      sparkTitle: clip(src.sparkTitle, 80),
      sparkAngle: takeStory(src.sparkAngle, 'Spark angle'),
      sparkFeel: takeStory(src.sparkFeel, 'Spark feeling'),
      sparkStory: takeStory(src.sparkStory, 'Spark story'),
      sparkKeep: takeStory(src.sparkKeep, 'Line to keep'),
      revision: clip(src.revision, 600),
      previous: clipBlock(src.previous, 1600),
      north: src.north && typeof src.north === 'object' ? src.north : null,
      craft: {
        vocabulary: craft.vocabulary || 'plain',
        imagery: craft.imagery || 'concrete',
        rhyme: craft.rhyme || 'slant',
        eraSlang: craft.eraSlang || 'now',
        region: clip(craft.region || src.region, 40),
        wordplay: craft.wordplay || 'light',
        rabbit: craft.rabbit !== false,
      },
    };
  }

  function liveList(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 12).map(function (row) {
      return {
        id: clip(row && row.id, 40),
        ask: clip(row && row.ask, 180),
        text: takeStory(row && row.text, 'Your answer'),
      };
    }).filter(function (row) { return row.text && !isPlaceholderLyric(row.text); });
  }

  function liveTexts(input) {
    return liveList(input && input.live).map(function (row) { return row.text; });
  }

  function clampMeter(value) {
    var n = Number(value);
    if (!isFinite(n)) return 3;
    return Math.max(1, Math.min(5, Math.round(n)));
  }

  var SECTION_FIELDS = {
    verse: [
      { id: 'who', label: 'Who is in this verse?', placeholder: 'A name or a nickname', min: 1 },
      { id: 'happened', label: 'What happened in this verse?', placeholder: 'One concrete sentence', min: 8 },
      { id: 'why', label: 'Why does this verse matter?', placeholder: 'One sentence about why', min: 8 },
    ],
    hook: [
      { id: 'line', label: 'The hook sentence', placeholder: 'A full sentence you would sing', min: 12, sentence: true },
      { id: 'happened', label: 'What happened?', placeholder: 'One concrete sentence', min: 8 },
      { id: 'why', label: 'Why does it matter?', placeholder: 'One sentence about why', min: 8 },
    ],
    bridge: [
      { id: 'turn', label: 'What turns in the bridge?', placeholder: 'The moment the song changes', min: 8 },
      { id: 'who', label: 'Who sees it differently?', placeholder: 'A name or a nickname', min: 1 },
      { id: 'why', label: 'Why does the song need this turn?', placeholder: 'One sentence about why', min: 8 },
    ],
  };

  function sectionAnswer(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function sectionError(kind, answers) {
    var spec = SECTION_FIELDS[kind];
    if (!spec) return 'Pick a verse, a hook, or a bridge.';
    var src = answers || {};
    for (var i = 0; i < spec.length; i += 1) {
      var field = spec[i];
      var value = sectionAnswer(src[field.id]);
      var hint = sectionAnswer(field.placeholder);
      if (!value || (hint && value.toLowerCase() === hint.toLowerCase()) || isPlaceholderLyric(value)) {
        return 'Those lines are placeholders. Answer in your own words, then this section can be written.';
      }
      if (field.sentence && (value.length < field.min || value.indexOf(' ') === -1)) {
        return 'Write the hook sentence in your own words. A full sentence.';
      }
      if (value.length < field.min) {
        if (field.id === 'who') return 'Name who is in this part. A nickname is enough.';
        if (field.id === 'happened') return 'Say what happened, in one sentence.';
        if (field.id === 'turn') return 'Say what turns in the bridge, in one sentence.';
        if (field.id === 'why') return 'Say why it matters, in one sentence.';
        return 'Answer each question in your own words.';
      }
    }
    return '';
  }

  function sectionFromAnswers(kind, answers) {
    var problem = sectionError(kind, answers);
    if (problem) return { ok: false, error: problem };
    var spec = SECTION_FIELDS[kind];
    var label = kind === 'hook' ? 'Hook' : (kind === 'bridge' ? 'Bridge' : 'Verse');
    return {
      ok: true,
      section: {
        label: label,
        lines: spec.map(function (field) {
          return line(sectionAnswer(answers[field.id]), 'user');
        }),
      },
      notes: ['This ' + label.toLowerCase() + ' uses the answers you wrote.'],
    };
  }

  function hookError(input) {
    var src = input || {};
    var line = String(src.line || '').trim();
    var happened = String(src.happened || '').trim();
    var why = String(src.why || '').trim();
    if (isPlaceholderLyric(line) || isPlaceholderLyric(happened) || isPlaceholderLyric(why)) {
      return 'Those lines are placeholders. Answer the hook questions in your own words.';
    }
    if (line.length < 12 || line.indexOf(' ') === -1) {
      return 'Write the hook sentence first. A full sentence, in your words.';
    }
    if (happened.length < 8) return 'Say what happened, in one sentence.';
    if (why.length < 8) return 'Say why it matters, in one sentence.';
    return '';
  }

  function questionsReady(input) {
    if (input.craft && input.craft.rabbit === false) {
      return Boolean(input.place || input.object || input.quote);
    }
    return Boolean(input.place && input.object && input.quote);
  }

  function concreteError(input) {
    var mode = input.mode;
    if (mode === 'madlibs') {
      if (liveTexts(input).length) return '';
      return 'Fill a Mad Libs blank first. The pack matches the kind of song.';
    }
    if (mode === 'hook') return hookError(input);
    if (mode === 'review' || mode === 'cover' || mode === 'public-domain' || mode === 'battle' || mode === 'write') return '';
    if (input.north && (input.north.forId || (input.north.aims && input.north.aims.length) || input.north.wisdom)) return '';
    if (isTransformMode(mode)) {
      if (sourceLines(input).length) {
        if (mode === 'flip' && !String(input.genre || '').trim()) {
          return 'Name the genre to flip toward.';
        }
        return '';
      }
      if (!input.mood || !questionsReady(input)) {
        return 'Paste lyrics you already have, or fill the feeling and the questions first. Flip it and Funkify will not invent a song from the craft dials alone.';
      }
      return '';
    }
    if (!input.craft.rabbit) {
      if (input.place || input.object || input.quote) return '';
      return 'Name one concrete thing. ' + CONCRETE_RULE;
    }
    if (!input.place || !input.object || !input.quote) {
      return 'Rabbit hole is on. ' + CONCRETE_RULE;
    }
    return '';
  }

  function heroBlocked(name) {
    var key = String(name || '').trim().toLowerCase();
    return HEROES.indexOf(key) !== -1;
  }

  function pdCheck(input) {
    var year = parseInt(input.year, 10);
    if (!input.work && !input.originalTitle && !input.title) {
      return { ok: false, error: 'Name the source. A title with no source is not a public-domain remix.' };
    }
    if (!isFinite(year)) {
      return { ok: false, error: 'Add the year. Compositions from 1930 and earlier, recordings through 1925.' };
    }
    if (input.kind === 'recording' && year > 1925) {
      return { ok: false, error: 'That recording is after 1925. This lane stays with recordings through 1925.' };
    }
    if (input.kind !== 'recording' && year > 1930) {
      return { ok: false, error: 'That composition is after 1930. This lane stays with compositions from 1930 and earlier.' };
    }
    return { ok: true };
  }

  function parodyCritique(input) {
    var blocks = [];
    if (!input.originalTitle) blocks.push('Name the original. A parody has to point at a real work.');
    if (!input.comment) blocks.push('Write what you are saying about the original. The lyric has to comment on it.');
    if (titlesTooClose(input.originalTitle, input.title)) {
      blocks.push('That title sits too close to the original. Pick one that is not a look-alike.');
    }
    if (lookalikeArt(input.artNote)) {
      blocks.push('Look-alike cover art is blocked. Make a different picture.');
    }
    return {
      ok: blocks.length === 0,
      blocks: blocks,
      label: PARODY_LABEL,
      fairUse: FAIR_USE_NOTE,
      release: RELEASE_NOTE,
    };
  }

  function flowApi() {
    if (typeof module === 'object' && module.exports) return require('./song-flow');
    var box = typeof globalThis !== 'undefined' ? globalThis : {};
    return box.SongFlow || null;
  }

  function dropMetaLine(text, input) {
    var flow = flowApi();
    if (!flow || !flow.isMetaLyric || !flow.isMetaLyric(text)) return false;
    var funny = input && (input.mode === 'funny' || input.comedy === true || (input.shape && input.shape.comedy));
    if (funny && flow.isAimHook && flow.isAimHook(text)) {
      var line = String(input.line || '').replace(/\s+/g, ' ').trim().toLowerCase();
      var value = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (line && line === value) return false;
    }
    return true;
  }

  function userBits(input) {
    return [input.quote, input.place, input.object].filter(Boolean);
  }

  function intentLine(text) {
    var lineText = String(text || '').replace(/\s+/g, ' ').trim();
    if (!lineText) return false;
    var aboutPiece = /\b(this|the|that)\s+(song|part|verse|hook|chorus|bridge|bit|section|pre-?chorus)\b/i.test(lineText);
    var supposed = /\b(supposed to|meant to|here to|exists to)\b/i.test(lineText);
    var effect = /\b(laugh|laughs|laughing|funny|funnier|humou?r|joke|jokes|cry|crying|tears|dance|dancing|smile|smiling)\b/i.test(lineText);
    if (aboutPiece && (supposed || effect)) return true;
    if (supposed && effect) return true;
    if (/\bthe joke\b/i.test(lineText) && /\b(waits|bows|claps|is rude|is supposed|is meant|second bar)\b/i.test(lineText)) return true;
    if (/\b(this is a drumroll|rehearse the catchphrase|gets a spotlight)\b/i.test(lineText)) return true;
    return false;
  }

  function intentKeep(input) {
    var bag = {};
    function add(text) {
      var value = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (value) bag[value] = true;
    }
    var src = input || {};
    ['quote', 'happened', 'why', 'line', 'comment', 'idea', 'sparkFeel', 'sparkStory', 'sparkKeep', 'sparkAngle'].forEach(function (key) {
      add(src[key]);
    });
    (src.live || []).forEach(function (row) { add(row && row.text); });
    var north = src.north || {};
    add(north.opener);
    add(north.forText);
    add(north.wisdom);
    add(north.keep);
    (north.notes || []).forEach(function (note) { add(note && note.text); });
    var words = src.words || {};
    Object.keys(words).forEach(function (key) { add(words[key]); });
    return bag;
  }

  function stripIntentDraft(draft, input) {
    if (!draft) return draft;
    var keep = intentKeep(input);
    function drop(text) {
      var value = String(text || '').replace(/\s+/g, ' ').trim();
      if (!value) return false;
      if (dropMetaLine(value, input)) return true;
      if (keep[value.toLowerCase()]) return false;
      return intentLine(value);
    }
    if (draft.hooks) {
      draft.hooks.forEach(function (hook) {
        if (hook && drop(hook.text)) hook.text = '';
      });
      draft.hooks = draft.hooks.filter(function (hook) { return hook && String(hook.text || '').trim(); });
    }
    (draft.sections || []).forEach(function (part) {
      part.lines = (part.lines || []).filter(function (row) {
        var text = typeof row === 'string' ? row : (row && row.text);
        return !drop(text);
      });
    });
    draft.sections = (draft.sections || []).filter(function (part) { return part.lines && part.lines.length; });
    return draft;
  }

  function weave(input, generated) {
    var rows = [];
    if (input.quote) rows.push(line(input.quote, 'user'));
    (generated || []).forEach(function (text) {
      if (intentLine(text)) return;
      rows.push(line(text, 'generated'));
    });
    return rows;
  }

  function vocab(input, plain, vivid) {
    if (input.craft && input.craft.vocabulary === 'vivid') return vivid;
    if (input.craft && input.craft.vocabulary === 'spare') return plain.split(',')[0];
    return plain;
  }

  function sourceRows(input) {
    return sourceLines(input).map(function (text) { return line(text, 'user'); });
  }

  function buildFlip(input) {
    var genre = input.genre || 'a different room';
    var rows = sourceRows(input);
    if (rows.length) {
      return {
        title: input.title || ('Flipped toward ' + genre),
        sections: [
          section('Verse', rows.concat([
            line('The facts stay. The room is ' + genre + ' now.', 'generated'),
          ])),
        ],
        notes: ['Flipped from lyrics you already had, toward ' + genre + '. Your lines stay.'],
      };
    }
    return {
      title: input.title || ('Flipped toward ' + genre),
      sections: [
        section('Verse', weave(input, [
          'The ' + (input.object || 'object') + ' stays. The room changes to ' + genre + '.',
          vocab(input, 'Same story, new pocket', 'The story keeps its shoes and changes the floor') + '.',
        ])),
        section('Hook', [
          line('Flip the room, not the fact.', 'generated'),
          line(input.place ? ('We are still in ' + input.place + '.') : 'We are still in the same place.', 'generated'),
        ]),
      ],
      notes: ['First draft, already flipped toward ' + genre + '. Built from the feeling and the details you gave.'],
    };
  }

  function buildFunk(input) {
    var rows = sourceRows(input);
    if (rows.length) {
      return {
        title: input.title || 'On the one',
        sections: [
          section('Verse', rows.concat([
            line('On the one. The pocket moves. The story does not change clothes.', 'generated'),
          ])),
        ],
        notes: ['Funkified from lyrics you already had. Bass pocket, not a costume. Your lines stay.'],
      };
    }
    return {
      title: input.title || 'On the one',
      sections: [
        section('Verse', weave(input, [
          'The one lands on the ' + (input.object || 'table') + '.',
          input.place ? ('Boots on the floor at ' + input.place + '.') : 'Boots on the floor, then the pocket.',
        ])),
        section('Hook', [
          line('On the one. Leave the costume at home.', 'generated'),
          line('Funk is the pocket, not the outfit.', 'generated'),
        ]),
      ],
      notes: ['First draft, already on the one. Built from the feeling and the details you gave.'],
    };
  }

  function buildFunny(input) {
    var object = input.object || 'thing';
    var place = input.place || '';
    var meter = input.meter || 'funny';
    var detail = place
      ? ('The ' + object + ' is still in ' + place + '.')
      : ('The ' + object + ' stayed where you left it.');
    var aside = {
      clean: 'Nobody moved the ' + object + '.',
      funny: 'The ' + object + ' took the last word.',
      savage: 'The ' + object + ' does not apologize.',
      rude: 'The ' + object + ' made the mess and left it.',
    }[meter] || ('The ' + object + ' took the last word.');
    var verse = weave(input, [detail, aside]);
    if (input.happened) verse.push(line(input.happened, 'user'));
    if (input.line && input.line !== input.quote) verse.push(line(input.line, 'user'));
    var hook = [];
    if (input.line) hook.push(line(input.line, 'user'));
    else if (input.quote) hook.push(line(input.quote, 'user'));
    else hook.push(line(aside, 'generated'));
    if (input.why && hook.every(function (row) { return row.text !== input.why; })) hook.push(line(input.why, 'user'));
    return {
      title: input.title || object,
      sections: [
        section('Verse', verse),
        section('Hook', hook),
      ],
      notes: ['Comedy meter: ' + meter + '. The humor is in the detail you gave. Rude still blocks slurs and hate.'],
    };
  }

  function buildMadlibs(input) {
    var filled = liveTexts(input);
    if (filled.length) {
      return {
        title: input.title || 'The blanks',
        sections: [
          section('Verse', filled.map(function (text) { return line(text, 'user'); })),
          section('Hook', [line('The blanks were yours. The song keeps them.', 'generated')]),
        ],
        notes: ['Mad Libs pack for ' + (input.kind || 'this feeling') + '. Each blank is from that kind of song, not one generic template.'],
      };
    }
    var object = input.object || 'mug';
    var place = input.place || 'the kitchen';
    var quote = input.quote || 'leave it';
    var verb = input.verb || 'wait';
    return {
      title: input.title || (object + ' at ' + place),
      sections: [
        section('Verse', [
          line('I left the ' + object + ' in ' + place + '.', 'user'),
          line('You said “' + quote + '” and I had to ' + verb + '.', 'user'),
        ]),
        section('Hook', [
          line('The blank was yours. The song keeps it.', 'generated'),
        ]),
      ],
    };
  }

  function buildReview(input) {
    var rows = String(input.lines || '').split(/\n/).map(function (text) {
      return text.trim();
    }).filter(Boolean).slice(0, 24);
    if (!rows.length) return { error: 'Paste a few lines to review.', sections: [], title: '' };
    var edits = rows.map(function (original) {
      var hits = clicheHits(original);
      var suggestion = original.replace(/\b(very|really|just)\b\s+/gi, '');
      if (suggestion === original && !hits.length) suggestion = original;
      return {
        original: original,
        suggestion: suggestion,
        note: hits.length ? ('Banned cliché: ' + hits[0] + '. Lock the line if you mean it, or rewrite it.') : 'A light trim. Undo puts your line back.',
      };
    });
    return {
      title: input.title || 'Line edits',
      edits: edits,
      sections: [
        section('Edited', edits.map(function (row) {
          return line(row.suggestion, 'generated');
        })),
      ],
      notes: ['Review keeps your original on the undo stack.'],
    };
  }

  function buildParody(input) {
    var critique = parodyCritique(input);
    if (!critique.ok || !input.parodyAck) {
      return { critique: critique, needsAck: critique.ok && !input.parodyAck, sections: [], title: '' };
    }
    return {
      title: input.title || ('A note on ' + input.originalTitle),
      critique: critique,
      sections: [
        section('Verse', weave(input, [
          'They called it “' + input.originalTitle + '.” This answers that, it does not wear it.',
          input.comment,
        ])),
        section('Hook', [
          line(input.comment, 'user'),
          line('Parody. Not the original. Not their voice.', 'generated'),
        ]),
      ],
      notes: [PARODY_LABEL, FAIR_USE_NOTE, RELEASE_NOTE],
    };
  }

  function buildPd(input) {
    var check = pdCheck(input);
    if (!check.ok) return { error: check.error, sections: [], title: '' };
    var name = input.work || input.title || input.originalTitle;
    return {
      title: input.title || ('After ' + name),
      sections: [
        section('Verse', weave(input, [
          'Source: ' + name + ' (' + input.year + ', ' + input.kind + ').',
          'New words on an old composition. The source stays in the note.',
        ])),
        section('Hook', [line('The old piece stays named. These lines are the new part.', 'generated')]),
      ],
      notes: [PD_NOTE, 'Source shown: ' + name + ', ' + input.year + '.', PD_SOURCE],
      source: { title: name, year: input.year, kind: input.kind, label: PD_SOURCE },
    };
  }

  function buildCover() {
    return {
      title: 'Mechanical license, plain',
      sections: [],
      steps: MECHANICAL_STEPS,
      notes: ['This page does not sell a license and does not quote a fee.'],
    };
  }

  function buildHomage(input) {
    var who = input.name || 'them';
    return {
      title: input.title || ('For ' + who),
      sections: [
        section('Verse', weave(input, [
          'This is for ' + who + '. It is not them speaking.',
          'A tribute keeps a distance. The ' + (input.object || 'detail') + ' is yours.',
        ])),
        section('Hook', [line(AFFILIATION_NOTE, 'generated')]),
      ],
      notes: [AFFILIATION_NOTE],
    };
  }

  function buildHero(input) {
    if (heroBlocked(input.name)) {
      return { error: 'Use yourself, not a trademarked hero.', sections: [], title: '' };
    }
    var hero = input.name || 'you';
    return {
      title: input.title || (hero + ' stays'),
      sections: [
        section('Verse', weave(input, [
          hero + ' starts at ' + (input.place || 'home') + ' with the ' + (input.object || 'thing') + '.',
          'No cape from a comic company. The origin is the detail you gave.',
        ])),
        section('Hook', [line('The hero is you. The proof is the detail.', 'generated')]),
      ],
    };
  }

  function buildBars(input) {
    var style = BAR_STYLES.filter(function (row) { return row.id === input.barStyle; })[0];
    var count = input.bars === 'hook' ? 4 : Number(input.bars);
    var rows = [];
    if (input.quote) rows.push(line(input.quote, 'user'));
    var slang = input.slang ? (' Regional word in play: ' + input.slang + '.') : '';
    while (rows.length < count) {
      rows.push(line('Bar ' + (rows.length + 1) + ' keeps the ' + (input.object || 'image') + ' in frame.' + (rows.length === 1 ? slang : ''), 'generated'));
    }
    return {
      title: input.title || ((style ? style.label : 'Bars') + ', ' + input.bars),
      sections: [section(input.bars === 'hook' ? 'Hook' : 'Bars', rows.slice(0, count))],
      notes: [
        'Style: ' + (style ? style.label : input.barStyle) + '. Era: ' + input.era + '.',
        'Meters. Rhyme ' + input.rhymeMeter + ', wordplay ' + input.wordplayMeter + ', variety ' + input.varietyMeter + '.',
        input.delivery ? ('Delivery: ' + input.delivery) : 'Add a delivery note if the pocket matters.',
        input.region ? ('Region: ' + input.region + '.') : 'Region is optional.',
      ],
    };
  }

  function buildHook(input) {
    return {
      title: input.title || 'Hook',
      sections: [
        section('Chorus', [
          line(input.line, 'user'),
          line(input.happened, 'user'),
          line(input.why, 'user'),
        ]),
      ],
      notes: ['The chorus uses the three answers you wrote.'],
    };
  }

  function buildPoem(input) {
    var form = input.form || 'free';
    var spirit = input.spirit ? (' In the spirit of the craft, not a copy of a poem (' + input.spirit + ').') : '';
    var body;
    if (form === 'haiku') {
      body = [
        line('Kitchen light still on', 'generated'),
        line(input.object ? (input.object + ' cools') : 'The mug cools down', 'generated'),
        line(input.quote ? input.quote.split(' ').slice(0, 5).join(' ') : 'Morning knows the chair', 'user'),
      ];
    } else if (form === 'fortune') {
      body = [line('Fortune: the ' + (input.object || 'cup') + ' already heard you.', 'generated')];
    } else if (form === 'confucius') {
      body = [line('Confucius says: start with the ' + (input.object || 'thing') + ' in front of you.', 'generated')];
    } else if (form === 'lesson') {
      body = [line('Lesson, from the room: ' + (input.quote || 'say the true part once.'), 'user')];
    } else if (form === 'newage') {
      body = [line('You can set the ' + (input.object || 'day') + ' down. That is the whole practice.', 'generated')];
    } else if (form === 'future') {
      body = [line('Later, ' + (input.place || 'the room') + ' still has the ' + (input.object || 'light') + '.', 'generated')];
    } else if (form === 'limerick') {
      body = [
        line('A ' + (input.object || 'mug') + ' sat out in ' + (input.place || 'the room') + ',', 'generated'),
        line('And nobody came back too soon,', 'generated'),
        line('The line that was said', 'generated'),
        line('Was enough, and it spread,', 'generated'),
        line(input.quote || 'Leave the light, I will be there at noon.', 'user'),
      ];
    } else {
      body = weave(input, ['The form is ' + form + '.' + spirit]);
    }
    return {
      title: input.title || form,
      sections: [section('Poem', body)],
      notes: ['Form: ' + form + '.' + spirit, 'In the spirit of a poet means the craft, not their poem.'],
    };
  }

  function buildSample(body) {
    var input = body && body.mode ? body : normalizeInput(body);
    var missing = concreteError(input);
    if (missing) return { ok: false, error: missing, notice: DEMO_NOTICE, preview: true, source: 'sample' };
    var draft;
    if (input.mode === 'flip') draft = buildFlip(input);
    else if (input.mode === 'funkify') draft = buildFunk(input);
    else if (input.mode === 'funny') draft = buildFunny(input);
    else if (input.mode === 'madlibs') draft = buildMadlibs(input);
    else if (input.mode === 'review') draft = buildReview(input);
    else if (input.mode === 'parody') draft = buildParody(input);
    else if (input.mode === 'public-domain') draft = buildPd(input);
    else if (input.mode === 'cover') draft = buildCover();
    else if (input.mode === 'homage') draft = buildHomage(input);
    else if (input.mode === 'superhero') draft = buildHero(input);
    else if (input.mode === 'bars') draft = buildBars(input);
    else if (input.mode === 'poem') draft = buildPoem(input);
    else if (input.mode === 'hook') draft = buildHook(input);
    else draft = buildFlip(input);
    if (draft.error) {
      return { ok: false, error: draft.error, notice: DEMO_NOTICE, preview: true, source: 'sample', mode: input.mode };
    }
    if (draft.critique && draft.critique.ok === false) {
      return {
        ok: false,
        error: draft.critique.blocks[0],
        critique: draft.critique,
        notice: DEMO_NOTICE,
        preview: true,
        source: 'sample',
        mode: input.mode,
      };
    }
    if (draft.needsAck) {
      return {
        ok: true,
        preview: true,
        source: 'sample',
        notice: DEMO_NOTICE,
        mode: input.mode,
        step: 'critique',
        critique: draft.critique,
        draft: null,
      };
    }
    attachSparkAnswers(draft, input);
    attachLiveAnswers(draft, input);
    stripIntentDraft(draft, input);
    return {
      ok: true,
      preview: true,
      source: 'sample',
      notice: DEMO_NOTICE,
      attribution: '',
      mode: input.mode,
      step: draft.critique ? 'draft' : 'draft',
      critique: draft.critique || null,
      draft: {
        title: draft.title || '',
        sections: draft.sections || [],
        edits: draft.edits || null,
        steps: draft.steps || null,
        notes: draft.notes || [],
        sourceWork: draft.source || null,
      },
    };
  }

  function allLines(draft) {
    var rows = [];
    if (!draft || !draft.sections) return rows;
    draft.sections.forEach(function (part) {
      (part.lines || []).forEach(function (row) { rows.push(row); });
    });
    return rows;
  }

  function yoursPercent(lines) {
    var rows = lines || [];
    if (!rows.length) return 0;
    var yours = rows.filter(function (row) {
      return row && (row.source === 'user' || row.yours === true);
    }).length;
    return Math.round((100 * yours) / rows.length);
  }

  function sunoPrecheck(text, opts) {
    var options = opts || {};
    var value = String(text || '');
    var blocked = [];
    var warnings = [];
    if (!value.trim()) blocked.push('Nothing to copy yet.');
    if (value.length > (options.limit || 3000)) {
      blocked.push('This is ' + value.length + ' characters. The lyric box works best under about 3,000. Shorten it first.');
    }
    if (/\b(clone(?:d| a)? voice|voice clone|deepfake|original recording|in the style of|sounds like)\b/i.test(value)) {
      blocked.push('Take out style-of, cloned-voice, or original-recording language before you copy.');
    }
    var hits = clicheHits(value);
    if (hits.length && !options.allowCliches) {
      blocked.push('Banned cliché still in the lyric: “' + hits[0] + '.” Rewrite it, or lock the line if you mean it.');
    }
    if (/\b(hit song|guaranteed|viral)\b/i.test(value)) {
      warnings.push('Leave promises out of the style prompt.');
    }
    return { ok: blocked.length === 0, blocked: blocked, warnings: warnings };
  }

  function scoutSample(input) {
    var place = input.place || 'the room you named';
    return {
      ok: true,
      preview: true,
      source: 'sample',
      notice: 'Demo mode. Plai is not connected for a song check. This note is a sample, not a listen.',
      role: 'scout',
      notes: [
        'What is working: the detail at ' + place + ' is specific.',
        'What to fix: say who the song is for in one line.',
        'Who it is for: someone who knows the ' + (input.object || 'object') + '.',
        'No score. People still check the work.',
      ],
    };
  }

  function scoopSample(input) {
    var name = input.name || 'The artist';
    return {
      ok: true,
      preview: true,
      source: 'sample',
      notice: 'Demo mode. Plai is not connected for a press kit. This bio is a sample, not an AI draft.',
      role: 'scoop',
      bio: name + ' writes from ' + (input.place || 'a real place') + '. The song starts with ' + (input.object || 'one object') + '.',
      oneSheet: 'No press quotes were given, so none are listed. No follower count is listed, because none was provided.',
    };
  }

  function draftFromModel(content, input) {
    var text = String(content || '').trim();
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    var parsed;
    try { parsed = JSON.parse(text.slice(start, end + 1)); } catch (err) { return null; }
    var owned = intentKeep(input);
    var sections = [];
    (parsed.sections || []).forEach(function (part) {
      var rows = [];
      (part.lines || []).forEach(function (row) {
        var value = typeof row === 'string' ? row : (row && row.text);
        value = clip(value, 240);
        var key = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!value || isPlaceholderLyric(value)) return;
        if (intentLine(value) && !owned[key]) return;
        var yours = owned[key] || (input.quote && value.indexOf(input.quote) !== -1);
        rows.push(line(value, yours ? 'user' : 'generated'));
      });
      if (rows.length) sections.push(section(clip(part.label, 40) || 'Verse', rows));
    });
    if (input.mode === 'hook') {
      var chorus = null;
      sections.forEach(function (part) {
        if (!chorus && /^(chorus|hook)\b/i.test(part.label)) chorus = part;
      });
      if (!chorus) {
        chorus = section('Chorus', []);
        sections.unshift(chorus);
      }
      var lead = [];
      [input.line, input.happened, input.why].forEach(function (text) {
        var bit = String(text || '').trim();
        if (!bit || isPlaceholderLyric(bit)) return;
        lead.push(line(bit, 'user'));
      });
      var rest = chorus.lines.filter(function (row) {
        return !lead.some(function (item) { return item.text === row.text; });
      });
      chorus.lines = lead.concat(rest);
      sections = sections.filter(function (part) { return part.lines.length; });
    }
    if (isTransformMode(input.mode)) sections = keepSourceLines(sections, input);
    if (!sections.length) return null;
    var built = {
      title: clip(parsed.title, 80) || (input.mode === 'hook' ? 'Hook' : ''),
      sections: sections,
      notes: input.mode === 'hook' ? ['The chorus uses the three answers you wrote.'] : ['People still check the work.'],
      edits: null,
      steps: null,
      sourceWork: null,
    };
    return stripIntentDraft(attachLiveAnswers(attachSparkAnswers(built, input), input), input);
  }

  function sparkAnswerTexts(input) {
    return [input && input.sparkFeel, input && input.sparkStory, input && input.sparkKeep].map(function (text) {
      return clip(text, STORY_MAX);
    }).filter(function (text) {
      return text && !isPlaceholderLyric(text);
    });
  }

  function attachSparkAnswers(draft, input) {
    var texts = sparkAnswerTexts(input);
    if (!draft || !texts.length) return draft;
    var sections = draft.sections || [];
    var present = {};
    sections.forEach(function (part) {
      (part.lines || []).forEach(function (row) {
        var value = String(row && row.text || '').trim();
        if (value) present[value] = true;
      });
    });
    var missing = texts.filter(function (text) { return !present[text]; });
    if (!missing.length) return draft;
    if (!sections.length) {
      sections = [section('Verse', [])];
      draft.sections = sections;
    }
    var first = sections[0];
    first.lines = first.lines || [];
    missing.forEach(function (text) { first.lines.push(line(text, 'user')); });
    return draft;
  }

  function attachLiveAnswers(draft, input) {
    var texts = liveTexts(input);
    if (!draft || !texts.length || input.mode === 'madlibs') return draft;
    var sections = draft.sections || [];
    var present = {};
    sections.forEach(function (part) {
      (part.lines || []).forEach(function (row) {
        var value = String(row && row.text || '').trim();
        if (value) present[value] = true;
      });
    });
    var missing = texts.filter(function (text) { return !present[text]; });
    if (!missing.length) return draft;
    if (!sections.length) return draft;
    var first = sections[0];
    first.lines = first.lines || [];
    missing.forEach(function (text) { first.lines.push(line(text, 'user')); });
    return draft;
  }

  function keepSourceLines(sections, input) {
    var kept = sourceLines(input);
    if (!kept.length) return sections;
    var list = sections || [];
    var first = list[0];
    if (!first) {
      first = section('Verse', []);
      list.unshift(first);
    }
    var seen = {};
    list.forEach(function (part) {
      (part.lines || []).forEach(function (row) {
        var text = String(row && row.text || '').trim();
        if (!text) return;
        seen[text] = row;
      });
    });
    var lead = [];
    kept.forEach(function (text) {
      if (seen[text]) {
        seen[text].source = 'user';
        return;
      }
      lead.push(line(text, 'user'));
    });
    first.lines = lead.concat(first.lines || []);
    return list.filter(function (part) { return part.lines && part.lines.length; });
  }

  function systemPrompt(input) {
    var lines = [
      'You are PLAIGROUND Song Helper.',
      'Mode: ' + input.mode + '.',
      'Use the writer’s concrete details. Keep a sentence they wrote word for word when one is provided.',
      'Do not name real artists. Do not imitate a real voice. Do not ask for an original recording.',
      'Do not write sexual content about a minor. No slurs. No threats.',
      'No cloned voice. No look-alike title. A parody must comment on the original.',
      'Rhyme style default is slant.',
      'Return JSON only: {"title":"","sections":[{"label":"Verse","lines":["..."]}]}.',
      'Do not add an attribution line.',
      'Never write instructions or placeholder sentences as lyrics.',
      'If sparkAngle is present, the song is about that angle. Keep it. Do not replace the writer’s own sentences.',
      'If sparkFeel, sparkStory, or sparkKeep is present, keep that answer in the lyric. If a field is empty, leave it out.',
      'If live answers are present, keep each one word for word. They are optional. Do not invent replacements for blanks the writer skipped.',
      'The feeling and the mode combine. Funny with a sad or heartbroken feeling is sarcastic: the specific detail stays, the hurt stays.',
      'A feeling only tints the words a little. It does not choose the genre, tempo, instruments, or era.',
      'Never write a lyric that announces the song\'s purpose. Do not say this song, this part, this verse, this hook, or this chorus is supposed to make them laugh, cry, dance, or feel something. Do not say it is funny. Show the feeling with the writer\'s own words and specific details. Do not repeat a line about the point of the song.',
      'Do not sing an aim such as make them laugh, cry, or feel unless Funny mode is on and the writer typed that exact sentence as the hook. Never write a lyric that mentions Song Helper, says you are making this song, or describes writing the song. If the writer wrote about the tool, leave that text out of the lyrics. If the story is thin, write less instead of a filler hook.',
      'If a region or a slang word is present, use that everyday speech in any genre, not only rap. If region is empty, do not force a regional word. Region is optional.',
    ];
    if (input.north && (input.north.forId || (input.north.aims && input.north.aims.length) || input.north.wisdom || input.north.opener || input.north.keep)) {
      lines.push('North star: who the song is for, the aims, and any wisdom line. Tie the hook, every verse, and the bridge back to that person. An aim is a private note. Do not sing it. Do not write that the song is supposed to make them laugh, cry, or dance.');
      lines.push('Rank the writer\'s personal reveals and original insights ahead of any generated line. Their own words come first in the lyrics. Do not add a story they did not tell. Do not add wisdom they did not write. Do not replace a reveal with a smoother general line. When a detail is missing, write less. Leave out stock lines and cliches.');
    }
    if (input.revision) {
      lines.push('This is a revision. Change only what revision asks. Keep every other line, and keep any sentence the writer wrote word for word.');
    }
    if (input.mode === 'funny') {
      lines.push('Funny mode: the humor is the thing they named, the place, and the sentence they wrote. Do not write a line about the joke, the meter, or what the song is supposed to do.');
    }
    if (input.mode === 'hook') {
      lines.push('Hook mode: build a short chorus from hookSentence, whatHappened, and why. Keep each of those three values exactly, character for character, as its own line in the Chorus. Do not replace them. Do not invent a hook when they are present.');
    }
    if (isTransformMode(input.mode)) {
      if (sourceLines(input).length) {
        lines.push('Transform path: rewrite the lyrics the writer already pasted. Keep their facts and keep their sentences in the draft. Flip it only changes the genre room. Funkify only moves the pocket onto the one, bass first, not a costume. Do not throw those lyrics out and invent a different song from the craft dials.');
      } else {
        lines.push('First-draft path: the feeling and the concrete questions are the song. Write that first draft already flipped or funkified. Do not invent a song from craft dials when the feeling or the questions are missing.');
      }
    }
    return lines.join(' ');
  }

  function userPrompt(input) {
    return JSON.stringify({
      mode: input.mode,
      place: input.place,
      object: input.object,
      quote: input.quote,
      hookSentence: input.line || '',
      whatHappened: input.happened || '',
      why: input.why || '',
      mood: input.mood || '',
      sourceLyrics: input.lines || '',
      sparkTitle: input.sparkTitle || '',
      sparkAngle: input.sparkAngle || '',
      sparkFeel: input.sparkFeel || '',
      sparkStory: input.sparkStory || '',
      sparkKeep: input.sparkKeep || '',
      genre: input.genre,
      title: input.title,
      originalTitle: input.originalTitle,
      comment: input.comment,
      meter: input.meter,
      barStyle: input.barStyle,
      era: input.era,
      bars: input.bars,
      form: input.form,
      spirit: input.spirit,
      region: input.region,
      slang: input.slang,
      kind: input.kind || '',
      part: input.part || '',
      live: input.live || [],
      craft: input.craft,
      revision: input.revision || '',
      previousLyrics: input.previous || '',
      northStar: input.north || null,
    });
  }

  return {
    AFFILIATION_NOTE: AFFILIATION_NOTE,
    BAR_STYLES: BAR_STYLES,
    CLICHES: CLICHES,
    CONCRETE_RULE: CONCRETE_RULE,
    DEMO_NOTICE: DEMO_NOTICE,
    FAIR_USE_NOTE: FAIR_USE_NOTE,
    FUNNY_METERS: FUNNY_METERS,
    MECHANICAL_STEPS: MECHANICAL_STEPS,
    MODES: MODES,
    PARODY_LABEL: PARODY_LABEL,
    PD_NOTE: PD_NOTE,
    PD_SOURCE: PD_SOURCE,
    PD_WORKS: PD_WORKS,
    POEM_FORMS: POEM_FORMS,
    POET_SPIRITS: POET_SPIRITS,
    RELEASE_NOTE: RELEASE_NOTE,
    RULER_NOTE: RULER_NOTE,
    allLines: allLines,
    buildSample: buildSample,
    clicheHits: clicheHits,
    concreteError: concreteError,
    SECTION_FIELDS: SECTION_FIELDS,
    hookError: hookError,
    isPlaceholderLyric: isPlaceholderLyric,
    isTransformMode: isTransformMode,
    sectionError: sectionError,
    sectionFromAnswers: sectionFromAnswers,
    countSyllables: countSyllables,
    draftFromModel: draftFromModel,
    intentLine: intentLine,
    stripIntentDraft: stripIntentDraft,
    heroBlocked: heroBlocked,
    lineRuler: lineRuler,
    modeById: modeById,
    STORY_MAX: STORY_MAX,
    normalizeInput: normalizeInput,
    parodyCritique: parodyCritique,
    pdCheck: pdCheck,
    scoutSample: scoutSample,
    scoopSample: scoopSample,
    sunoPrecheck: sunoPrecheck,
    systemPrompt: systemPrompt,
    titlesTooClose: titlesTooClose,
    userPrompt: userPrompt,
    yoursPercent: yoursPercent,
  };
}));
