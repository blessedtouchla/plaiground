'use strict';

/**
 * PLAIGROUND Song Helper core.
 * Shared by the serverless function (Node) and the page (browser).
 * No API keys live here.
 */
(function (root, factory) {
  var packs = (typeof module === 'object' && module.exports) ? require('./song-packs') : root.SongPacks;
  var api = factory(packs || {
    get: function () { return null; },
    styleFor: function () { return { genre: '', era: '', energy: '', instruments: [] }; },
    genreLabel: function () { return ''; },
    typeIds: function () { return []; },
    musicIds: function () { return []; },
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SongHelperCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (packs) {
  var DEFAULT_MODEL = 'grok-4.20-0309-non-reasoning';
  var PREVIEW_NOTICE = 'Preview mode: sample draft, not written by AI.';
  var GROK_ATTRIBUTION = 'Lyrics drafted with Grok by xAI';
  var COPYRIGHT_SENTENCE = 'Only human-written lines are protected by copyright, so keeping your own words helps you register the song.';
  var COVER_IMAGE_RIGHTS = "AI-generated images generally can't be copyrighted.";
  var SESSION_KEY = 'plaiground.songHelper';
  var ARTIST_NOTE = 'We describe the sound instead of naming artists.';
  var RATE_MAX = 10;
  var RATE_WINDOW_MS = 60 * 60 * 1000;
  var BODY_MAX = 20000;

  var LIMITS = {
    mood: 40,
    happened: 280,
    who: 80,
    why: 280,
    line: 280,
    word: 160,
    genre: 40,
    feeling: 40,
    title: 80,
  };

  var WORD_KEYS = ['place', 'room', 'color', 'smell', 'sound', 'time', 'says'];

  var ARTISTS = [
    'taylor swift', 'drake', 'beyonce', 'beyoncé', 'the weeknd', 'bad bunny',
    'rihanna', 'travis scott', 'kendrick lamar', 'kanye west', 'kanye',
    'billie eilish', 'ariana grande', 'ed sheeran', 'post malone', 'dua lipa',
    'olivia rodrigo', 'doja cat', 'the beatles', 'michael jackson', 'frank ocean',
    'adele', 'bruno mars', 'eminem', 'jay-z', 'jay z', 'nicki minaj', 'cardi b',
    'harry styles', 'lady gaga', 'justin bieber', 'shakira', 'j balvin',
    'rosalia', 'rosalía', 'peso pluma', 'karol g', 'daddy yankee', 'romeo santos',
    'metro boomin', 'pharrell williams', 'pharrell', 'morgan wallen', 'luke combs',
    'dolly parton', 'johnny cash', 'bob marley', 'bob dylan', 'stevie wonder',
    'whitney houston', 'mariah carey', 'david bowie', 'freddie mercury',
    'coldplay', 'radiohead', 'pink floyd', 'led zeppelin', 'the rolling stones',
    'fleetwood mac', 'blackpink', 'newjeans', 'lil wayne', 'playboi carti',
    'lil baby', '21 savage', 'chris brown', 'alicia keys', 'john legend',
    'sam smith', 'lana del rey', 'arctic monkeys', 'tame impala', 'kali uchis',
    'fuerza regida', 'grupo frontera', 'natanael cano', 'junior h', 'ivan cornejo',
    'madonna', 'prince', 'sza', 'the neighbourhood', 'summer walker',
    'badbunny',
  ];

  var NOT_ARTISTS = {
    'indie pop': true,
    'alt pop': true,
    'hip hop': true,
    'hip-hop': true,
    'r&b': true,
    'rnb': true,
    'neo soul': true,
    'smooth jazz': true,
    'latin pop': true,
    'bedroom pop': true,
    'synth pop': true,
    'city pop': true,
    'drum and bass': true,
    'lo-fi': true,
    'lofi': true,
    'afrobeats': true,
    'afrobeat': true,
    'dancehall': true,
    'reggaeton': true,
    'corridos': true,
    'latin': true,
    'country': true,
    'gospel': true,
    'late night': true,
    'high energy': true,
    'low energy': true,
  };

  var ARTIST_SET = {};
  ARTISTS.forEach(function (name) { ARTIST_SET[name] = true; });

  var FILL = {
    english: {
      heartbroken: [
        'The hallway light kept its promise.',
        'I learned the quiet by heart.',
        'Morning still shows up uninvited.',
        'I leave the second glass in the sink.',
        'Nobody has to say your name.',
      ],
      hyped: [
        'The floor already knows the count.',
        'We came in loud and we stay loud.',
        'Turn it up until the room agrees.',
        'This is the part where we move.',
        'Save the soft talk for later.',
      ],
      grateful: [
        'I say thank you with the lights on.',
        'Some luck walks in and sits down.',
        'I keep the good part in my pocket.',
        'It is enough that you were here.',
        'I will not rush the good night.',
      ],
      petty: [
        'I rehearse the cooler version.',
        'You can keep the last word.',
        'I look fine. That is the point.',
        'Smile like the story is mine.',
        'I will not text you first.',
      ],
      'in love': [
        'The room gets kinder when you do.',
        'I memorize the ordinary parts.',
        'Stay. That is the whole request.',
        'Even the quiet has your name in it.',
        'I am not playing this cool.',
      ],
      nostalgic: [
        'The old song still knows the way.',
        'We were younger in that light.',
        'I can walk that street with my eyes closed.',
        'Time folded the night in half.',
        'Some doors only open backward.',
      ],
      healing: [
        'I put the day down gently.',
        'The bruise is a lesson now.',
        'I breathe all the way out.',
        'I can stay without the old ending.',
        'Soft is a kind of strong.',
      ],
      default: [
        'I tell it the way it happened.',
        'The details are doing the talking.',
        'This is the part I can stand on.',
        'I keep the image and lose the noise.',
        'Say it once, then let it ring.',
      ],
    },
    spanish: [
      'La luz del pasillo se quedó encendida.',
      'Aprendí el silencio de memoria.',
      'La mañana llega igual.',
      'Dejo el vaso en el fregadero.',
      'Nadie tiene que decir tu nombre.',
    ],
    spanglish: [
      'The hallway light se quedó on.',
      'Aprendí the quiet de memoria.',
      'Morning llega igual, sin pedir permiso.',
      'Dejo the second glass en el sink.',
      'Nadie tiene to say your name.',
    ],
  };

  var COMEDY_FILL = {
    english: [
      'The leftover pizza filed a complaint.',
      'The group chat is taking the stand.',
      'A single crumb is the whole plot.',
      'This is a drumroll about nothing.',
      'The villain is a sticky note.',
      'We rehearse the catchphrase twice.',
      'The tiny thing gets a spotlight.',
    ],
    spanish: [
      'La pizza que sobró puso una queja.',
      'El chat del grupo pide la palabra.',
      'Una miga es todo el argumento.',
      'Esto es un redoble por nada.',
      'El villano es una nota adhesiva.',
      'Ensayamos la frase otra vez.',
      'La cosa diminuta tiene foco.',
    ],
    spanglish: [
      'The leftover pizza puso una queja.',
      'The group chat pide the stand.',
      'A single crumb es todo the plot.',
      'This is a drumroll por nada.',
      'The villain es una sticky note.',
      'We rehearse the catchphrase otra vez.',
      'The tiny thing tiene a spotlight.',
    ],
  };

  var SYSTEM_PROMPT = [
    'You are a co-writer for PLAIGROUND Song Helper. Write original lyrics only.',
    'Never reproduce, quote, or closely paraphrase existing song lyrics.',
    'Never imitate a real artist, band, or producer, and never name one.',
    'Use the user\'s own lines exactly as given, character for character, each as its own lyric line. Do not improve, translate, or punctuate them.',
    'The user\'s hook sentence must be hook option A, verbatim, with source "user".',
    'Offer exactly two hook options. Hook B is original. It must not copy the user\'s sentence or any existing song.',
    'Return JSON only, with no markdown.',
    'Mark every line source "user" if it is copied from the user\'s answers, otherwise "generated".',
    'If length is "full", use these sections in order: Verse, Pre-Chorus, Chorus, Verse, Chorus, Bridge, Chorus.',
    'If length is "short", use: Verse, Chorus, Verse, Chorus.',
    'Write generated lines in the requested language: english, spanish, or spanglish. Leave the user\'s lines in the language they used.',
    'If explicit is false, do not add profanity to generated lines. Never alter the user\'s lines to add or remove words.',
    'Prefer the user\'s images over clichés. Do not promise a hit, streams, placements, or royalties.',
    'Original songs only. Do not parody an existing song or melody. Do not write lyrics to the tune of any real song, and do not name real songs.',
    'If this is comedy, keep it good-natured. No slurs, no hate, and no sexual content about a real person. Do not name or target public figures or celebrities.',
    'Explicit language only if the user set explicit to true. If explicit is false, generated lines stay clean.',
    'JSON shape: {"title":"short original title","hooks":[{"id":"a","text":"...","source":"user"},{"id":"b","text":"...","source":"generated"}],"sections":[{"label":"Verse","lines":[{"text":"...","source":"user"}]}]}',
    'Put the chosen hook (hook A unless told otherwise) on its own lines inside each Chorus and set role to "hook" on those lines.',
  ].join(' ');

  function clipText(value, max) {
    return String(value == null ? '' : value).trim().slice(0, max);
  }

  function cleanField(value, max) {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (text.length > max) {
      var err = new Error('long');
      err.code = 'long';
      throw err;
    }
    return text;
  }

  function wordKeyOk(key) {
    return /^[a-z][a-z0-9_]{0,23}$/.test(String(key || ''));
  }

  function allowId(value, ids) {
    var key = String(value || '').trim().toLowerCase();
    return ids.indexOf(key) >= 0 ? key : '';
  }

  function normalizeWords(wordsIn, packId) {
    var incoming = wordsIn && typeof wordsIn === 'object' ? wordsIn : {};
    var pack = packs.get(packId);
    var order = [];
    if (pack && pack.prompts) {
      pack.prompts.forEach(function (item) {
        if (order.indexOf(item.key) < 0) order.push(item.key);
      });
    }
    WORD_KEYS.forEach(function (key) {
      if (order.indexOf(key) < 0) order.push(key);
    });
    Object.keys(incoming).forEach(function (key) {
      if (wordKeyOk(key) && order.indexOf(key) < 0) order.push(key);
    });
    var words = {};
    var count = 0;
    order.forEach(function (key) {
      if (count >= 8) return;
      if (!wordKeyOk(key)) return;
      if (!Object.prototype.hasOwnProperty.call(incoming, key)) return;
      words[key] = cleanField(incoming[key], LIMITS.word);
      count += 1;
    });
    return words;
  }

  function normalizeInterview(body) {
    var src = body || {};
    var shapeIn = src.shape || {};
    var packId = String(shapeIn.pack || '').trim().toLowerCase();
    if (!/^[a-z0-9]{1,16}$/.test(packId) || !packs.get(packId) || packId === 'generic') packId = '';
    var comedy = packId === 'comedy' || shapeIn.comedy === true;
    if (comedy) packId = 'comedy';
    var comedyType = comedy ? allowId(shapeIn.comedyType, packs.typeIds()) : '';
    var comedyMusic = comedy ? allowId(shapeIn.comedyMusic, packs.musicIds()) : '';
    var genre = cleanField(shapeIn.genre, LIMITS.genre);
    if (!genre && packId) genre = packs.genreLabel(packId, comedyMusic, comedyType);
    var language = String(shapeIn.language || '').toLowerCase();
    if (language !== 'spanish' && language !== 'spanglish') language = 'english';
    var variant = Number(src.variant);
    if (!isFinite(variant) || variant < 0) variant = 0;
    variant = Math.min(20, Math.floor(variant));
    return {
      mood: cleanField(src.mood, LIMITS.mood),
      happened: cleanField(src.happened, LIMITS.happened),
      who: cleanField(src.who, LIMITS.who),
      why: cleanField(src.why, LIMITS.why),
      line: cleanField(src.line, LIMITS.line),
      words: normalizeWords(src.words, packId),
      shape: {
        genre: genre,
        pack: packId,
        comedy: comedy,
        comedyType: comedyType,
        comedyMusic: comedyMusic,
        language: language,
        explicit: shapeIn.explicit === 'explicit' ? 'explicit' : 'clean',
        length: shapeIn.length === 'short' ? 'short' : 'full',
      },
      variant: variant,
    };
  }

  function collectUserStrings(interview) {
    var items = [];
    function add(key, text) {
      var t = String(text || '').trim();
      if (t) items.push({ key: key, text: t });
    }
    add('happened', interview.happened);
    add('why', interview.why);
    add('line', interview.line);
    var words = interview.words || {};
    Object.keys(words).forEach(function (key) { add(key, words[key]); });
    return items;
  }

  function isComedy(interview) {
    var shape = (interview && interview.shape) || {};
    if (shape.comedy === true || shape.pack === 'comedy') return true;
    return /^comedy\b/i.test(String(shape.genre || ''));
  }

  function poolFor(interview) {
    var lang = interview.shape && interview.shape.language;
    if (isComedy(interview)) {
      if (lang === 'spanish') return COMEDY_FILL.spanish;
      if (lang === 'spanglish') return COMEDY_FILL.spanglish;
      return COMEDY_FILL.english;
    }
    if (lang === 'spanish') return FILL.spanish;
    if (lang === 'spanglish') return FILL.spanglish;
    var mood = String(interview.mood || '').toLowerCase();
    return FILL.english[mood] || FILL.english.default;
  }

  var PARODY_RE = /to the tune of|parody of/i;

  function scrubAsk(text) {
    return String(text || '')
      .replace(/to the tune of/gi, '')
      .replace(/parody of/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function containsParodyAsk(interview) {
    var src = interview || {};
    var blob = [src.line, src.happened, src.why, src.who, src.mood].join('\n');
    var words = src.words || {};
    Object.keys(words).forEach(function (key) { blob += '\n' + words[key]; });
    return PARODY_RE.test(blob);
  }

  function publicFigureName(name) {
    var key = String(name || '').trim().toLowerCase();
    if (!key || NOT_ARTISTS[key]) return false;
    if (ARTIST_SET[key]) return true;
    var hit = false;
    Object.keys(ARTIST_SET).forEach(function (artist) {
      if (hit) return;
      var re = new RegExp('(^|[^\\p{L}\\p{N}])' + escapeRegExp(artist) + '(?![\\p{L}\\p{N}])', 'iu');
      if (re.test(key)) hit = true;
    });
    return hit;
  }

  function hookBText(interview) {
    var who = interview.who || 'you';
    var lang = interview.shape && interview.shape.language;
    var bank;
    if (isComedy(interview)) {
      if (lang === 'spanish') {
        bank = [
          'La última rebanada de pizza sabe lo que hiciste.',
          'Esto es un redoble por nada, y aun así entra.',
          'Si la miga hablara, pediría un verso.',
        ];
      } else if (lang === 'spanglish') {
        bank = [
          'The last slice of pizza sabe what you did.',
          'This is a drumroll por nada, and it still lands.',
          'If the crumb could talk, pediría a verse.',
        ];
      } else {
        bank = [
          'The last slice of pizza knows what you did.',
          'This is a drumroll about nothing, and it still lands.',
          'If the crumb could talk, it would demand a verse.',
        ];
      }
      var joke = bank[(interview.variant || 0) % bank.length];
      if (interview.line && joke === interview.line) joke = joke + ' — take two';
      return joke;
    }
    if (lang === 'spanish') {
      bank = [
        'Escúchame claro, ' + who + ', ya no edito la verdad.',
        who + ', esta es la frase que debí decir en voz alta.',
        'Si me oyes, ' + who + ', no la voy a retirar.',
      ];
    } else if (lang === 'spanglish') {
      bank = [
        'Hear me claro, ' + who + ', ya no edito the truth.',
        who + ', this is the line que debí decir out loud.',
        'Si me oyes, ' + who + ', I am not taking it back.',
      ];
    } else {
      bank = [
        'Hear me plain, ' + who + ', I am done editing the truth.',
        who + ', this is the line I should have said out loud.',
        'If you are listening, ' + who + ', I am not taking it back.',
      ];
    }
    var index = (interview.variant || 0) % bank.length;
    var text = bank[index];
    if (interview.line && text === interview.line) text = text + ' — take two';
    return text;
  }

  function sampleTitle(interview) {
    var who = interview.who || 'you';
    if (isComedy(interview)) {
      var subject = interview.who || 'nothing';
      var lang = interview.shape && interview.shape.language;
      if (lang === 'spanish') return clipText('Canción muy seria sobre ' + subject, LIMITS.title);
      if (lang === 'spanglish') return clipText('Canción muy seria about ' + subject, LIMITS.title);
      return clipText('A Very Serious Song About ' + subject, LIMITS.title);
    }
    var mood = interview.mood || 'this song';
    var nice = mood.charAt(0).toUpperCase() + mood.slice(1);
    return clipText(nice + ' for ' + who, LIMITS.title);
  }

  function userLine(text) {
    var t = String(text || '').trim();
    if (!t) return null;
    return { text: t, source: 'user', role: '' };
  }

  function genLine(pool, cursor) {
    var text = pool[cursor.n % pool.length];
    cursor.n += 1;
    return { text: text, source: 'generated', role: '' };
  }

  function hookLine(hook) {
    return { text: hook.text, source: hook.source, role: 'hook' };
  }

  function section(label, lines) {
    return { label: label, lines: lines.filter(Boolean) };
  }

  function chorus(hook, middle) {
    return section('Chorus', [hookLine(hook), middle || null, hookLine(hook)]);
  }

  function extraWordLines(words) {
    var classic = {};
    WORD_KEYS.forEach(function (key) { classic[key] = true; });
    var lines = [];
    Object.keys(words || {}).forEach(function (key) {
      if (classic[key]) return;
      var line = userLine(words[key]);
      if (line) lines.push(line);
    });
    return lines;
  }

  function buildSampleDraft(interview) {
    var input = interview && interview.words ? interview : normalizeInterview(interview);
    var pool = poolFor(input);
    var cursor = { n: input.variant || 0 };
    var words = input.words || {};
    var hookA = {
      id: 'a',
      text: input.line || genLine(pool, cursor).text,
      source: input.line ? 'user' : 'generated',
    };
    var hookB = { id: 'b', text: hookBText(input), source: 'generated' };
    var sections;
    if (input.shape && input.shape.length === 'short') {
      sections = [
        section('Verse', [
          userLine(input.happened),
          userLine(words.place),
          userLine(words.room),
          userLine(words.smell),
          genLine(pool, cursor),
        ].concat(extraWordLines(words))),
        chorus(hookA, userLine(input.why) || genLine(pool, cursor)),
        section('Verse', [
          userLine(words.sound),
          userLine(words.time),
          userLine(words.color),
          genLine(pool, cursor),
        ]),
        chorus(hookA, userLine(words.says) || genLine(pool, cursor)),
      ];
    } else {
      sections = [
        section('Verse', [
          genLine(pool, cursor),
          userLine(input.happened),
          userLine(words.place),
          userLine(words.room),
        ].concat(extraWordLines(words))),
        section('Pre-Chorus', [
          userLine(input.why),
          userLine(words.time),
          genLine(pool, cursor),
        ]),
        chorus(hookA, userLine(words.color) || genLine(pool, cursor)),
        section('Verse', [
          userLine(words.smell),
          userLine(words.sound),
          genLine(pool, cursor),
        ]),
        chorus(hookA, genLine(pool, cursor)),
        section('Bridge', [
          userLine(words.says),
          genLine(pool, cursor),
        ]),
        chorus(hookA, genLine(pool, cursor)),
      ];
    }
    return finalizeDraft({
      title: sampleTitle(input),
      hooks: [hookA, hookB],
      sections: sections,
    }, input);
  }

  function extractJson(content) {
    var raw = String(content || '').trim();
    if (!raw) throw new Error('empty');
    try {
      return JSON.parse(raw);
    } catch (err) {
      var start = raw.indexOf('{');
      var end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
      throw err;
    }
  }

  function normalizeHooks(rawHooks, interview) {
    var hooks = Array.isArray(rawHooks) ? rawHooks : [];
    var aText = interview.line || '';
    var bText = '';
    hooks.forEach(function (hook) {
      if (!hook) return;
      var text = clipText(hook.text, LIMITS.line);
      if (!text) return;
      if (hook.id === 'b' && !bText) bText = text;
      else if (!aText) aText = text;
      else if (!bText && text !== aText) bText = text;
    });
    if (!bText) bText = hookBText(interview);
    if (interview.line) aText = interview.line;
    return [
      { id: 'a', text: aText, source: interview.line ? 'user' : 'generated' },
      { id: 'b', text: bText, source: 'generated' },
    ];
  }

  function normalizeSections(rawSections) {
    var list = Array.isArray(rawSections) ? rawSections.slice(0, 12) : [];
    return list.map(function (sectionItem) {
      var lines = Array.isArray(sectionItem && sectionItem.lines) ? sectionItem.lines.slice(0, 16) : [];
      return {
        label: clipText(sectionItem && sectionItem.label, 40) || 'Verse',
        lines: lines.map(function (line) {
          var text = clipText(line && line.text, 400);
          if (!text) return null;
          var source = line && line.source === 'user' ? 'user' : 'generated';
          var role = line && line.role === 'hook' ? 'hook' : '';
          return { text: text, source: source, role: role };
        }).filter(Boolean),
      };
    }).filter(function (sectionItem) { return sectionItem.lines.length; });
  }

  function textsOf(draft) {
    var texts = [];
    (draft.hooks || []).forEach(function (hook) { texts.push(hook.text); });
    (draft.sections || []).forEach(function (sectionItem) {
      sectionItem.lines.forEach(function (line) { texts.push(line.text); });
    });
    return texts;
  }

  function ensureUserLines(draft, interview) {
    var present = {};
    textsOf(draft).forEach(function (text) { present[String(text).trim()] = true; });
    var missing = collectUserStrings(interview).filter(function (item) {
      return !present[item.text];
    });
    if (!missing.length) return;
    if (!draft.sections.length) draft.sections.push({ label: 'Verse', lines: [] });
    missing.forEach(function (item) {
      draft.sections[0].lines.unshift({ text: item.text, source: 'user', role: item.key === 'line' ? 'hook' : '' });
    });
  }

  function ensureHooksInChoruses(draft) {
    var hook = draft.hooks[0];
    if (!hook || !hook.text) return;
    draft.sections.forEach(function (sectionItem) {
      if (!/^chorus$/i.test(String(sectionItem.label || '').trim())) return;
      var has = sectionItem.lines.some(function (line) { return line.role === 'hook'; });
      if (has) return;
      sectionItem.lines.unshift({ text: hook.text, source: hook.source, role: 'hook' });
      sectionItem.lines.push({ text: hook.text, source: hook.source, role: 'hook' });
    });
  }

  function markExactUserSources(draft, interview) {
    var userTexts = {};
    collectUserStrings(interview).forEach(function (item) { userTexts[item.text] = true; });
    function mark(line) {
      if (userTexts[String(line.text).trim()]) line.source = 'user';
    }
    draft.hooks.forEach(mark);
    draft.sections.forEach(function (sectionItem) { sectionItem.lines.forEach(mark); });
  }

  function stripGeneratedArtists(draft) {
    draft.title = stripArtistNames(draft.title).text || draft.title;
    draft.hooks.forEach(function (hook) {
      if (hook.source === 'user') return;
      var cleaned = stripArtistNames(hook.text);
      if (cleaned.text) hook.text = cleaned.text;
    });
    draft.sections.forEach(function (sectionItem) {
      sectionItem.lines = sectionItem.lines.map(function (line) {
        if (line.source === 'user') return line;
        var cleaned = stripArtistNames(line.text);
        if (!cleaned.text) return null;
        return { text: cleaned.text, source: line.source, role: line.role };
      }).filter(Boolean);
    });
  }

  function assignIds(draft) {
    draft.sections.forEach(function (sectionItem, s) {
      sectionItem.lines.forEach(function (line, i) {
        line.id = 's' + s + 'l' + i;
        line.original = line.text;
        line.edited = false;
      });
    });
    draft.hooks.forEach(function (hook) {
      hook.original = hook.text;
    });
    return draft;
  }

  function finalizeDraft(draft, interview) {
    if (!draft.hooks || draft.hooks.length < 2) draft.hooks = normalizeHooks(draft.hooks, interview);
    if (interview.line) {
      draft.hooks[0].text = interview.line;
      draft.hooks[0].source = 'user';
    }
    ensureUserLines(draft, interview);
    markExactUserSources(draft, interview);
    stripGeneratedArtists(draft);
    ensureHooksInChoruses(draft);
    ensureUserLineOutsideChorus(draft, interview);
    return assignIds(draft);
  }

  function ensureUserLineOutsideChorus(draft, interview) {
    if (!interview.line) return;
    var parked = false;
    draft.sections.forEach(function (sectionItem) {
      sectionItem.lines.forEach(function (line) {
        if (line.role !== 'hook' && line.text === interview.line) parked = true;
      });
    });
    if (parked) return;
    if (!draft.sections.length) draft.sections.push({ label: 'Verse', lines: [] });
    draft.sections[0].lines.push({ text: interview.line, source: 'user', role: '' });
  }

  function draftFromModelJson(content, interview) {
    var input = interview && interview.shape ? interview : normalizeInterview(interview);
    var parsed = extractJson(content);
    var draft = {
      title: clipText(parsed && parsed.title, LIMITS.title) || sampleTitle(input),
      hooks: normalizeHooks(parsed && parsed.hooks, input),
      sections: normalizeSections(parsed && parsed.sections),
    };
    return finalizeDraft(draft, input);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isBlockedName(name) {
    var key = String(name || '').trim().toLowerCase();
    if (!key || NOT_ARTISTS[key]) return false;
    if (ARTIST_SET[key]) return true;
    var parts = key.split(/\s+/);
    if (parts.length >= 2 && parts.every(function (part) { return /^[\p{L}][\p{L}'’.-]{1,}$/u.test(part); })) {
      return true;
    }
    return false;
  }

  function stripArtistNames(input) {
    var text = String(input || '');
    var stripped = false;
    ARTISTS.forEach(function (name) {
      var re = new RegExp('(^|[^\\p{L}\\p{N}])' + escapeRegExp(name) + '(?![\\p{L}\\p{N}])', 'igu');
      var next = text.replace(re, '$1');
      if (next !== text) {
        stripped = true;
        text = next;
      }
    });
    text = text.replace(/\b(?:sounds like|in the style of|style of|inspired by|channeling|like)\s+([A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,3})/gu, function (match, name) {
      if (!isBlockedName(name)) return match;
      stripped = true;
      return '';
    });
    text = text.replace(/\b(?:sounds like|in the style of|style of|inspired by|channeling|like)\b[\s,.]*$/gi, '');
    text = text.replace(/\b(?:sounds like|in the style of|style of|inspired by|channeling|like)\b\s*(?=,)/gi, '');
    text = text.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').replace(/^[,\s]+|[,\s]+$/g, '').trim();
    return { text: text, stripped: stripped };
  }

  function takeClean(value, max, flag) {
    var cleaned = stripArtistNames(clipText(value, max || 80));
    if (cleaned.stripped) flag.stripped = true;
    return cleaned.text;
  }

  function buildStylePrompt(style) {
    var src = style || {};
    var flag = { stripped: false };
    var genre = takeClean(src.genre, LIMITS.genre, flag);
    var era = takeClean(src.era, 40, flag);
    var energy = takeClean(src.energy, 40, flag);
    var voice = takeClean(src.voice, 40, flag);
    var texture = takeClean(src.texture, 40, flag);
    var feeling = takeClean(src.feeling, LIMITS.feeling, flag);
    var instruments = (Array.isArray(src.instruments) ? src.instruments : []).slice(0, 3).map(function (item) {
      return takeClean(item, 40, flag);
    }).filter(Boolean);
    if (energy && !/energy/i.test(energy)) energy = energy + ' energy';
    var vocalBits = [texture, voice].filter(Boolean).join(' ');
    if (vocalBits && !/vocal/i.test(vocalBits)) vocalBits = vocalBits + ' vocal';
    var parts = [genre, era, energy, vocalBits].concat(instruments);
    if (feeling) parts.push(feeling);
    var prompt = parts.filter(Boolean).join(', ');
    var second = stripArtistNames(prompt);
    if (second.stripped) flag.stripped = true;
    return {
      prompt: second.text,
      artistNamesStripped: flag.stripped,
      note: flag.stripped ? ARTIST_NOTE : '',
    };
  }

  function describeLine(line, preview) {
    var edited = Boolean(line && line.edited) || (line && line.original != null && String(line.text) !== String(line.original));
    if (line && line.source === 'user') return edited ? 'You wrote this (edited)' : 'You wrote this';
    if (preview) return edited ? 'Sample line, then edited by you (not written by AI)' : 'Sample line, not written by AI';
    return edited ? 'Written with Grok, then edited by you' : 'Written with Grok';
  }

  function formatAuthorship(draft, meta) {
    var info = meta || {};
    var preview = Boolean(info.preview);
    var lines = [];
    lines.push('PLAIGROUND Song Helper — authorship record');
    lines.push('Date: ' + (info.date || new Date().toISOString().slice(0, 10)));
    lines.push('Title: ' + ((draft && draft.title) || 'Untitled'));
    lines.push(preview ? 'Mode: Preview sample, not written by AI.' : 'Mode: Lyrics drafted with Grok by xAI.');
    lines.push('');
    lines.push(COPYRIGHT_SENTENCE);
    lines.push('');
    if (info.interview) {
      lines.push('Your answers');
      lines.push('Mood: ' + (info.interview.mood || ''));
      lines.push('What happened: ' + (info.interview.happened || ''));
      lines.push('Who: ' + (info.interview.who || ''));
      lines.push('Why: ' + (info.interview.why || ''));
      lines.push('The line: ' + (info.interview.line || ''));
      var wordBank = info.interview.words || {};
      Object.keys(wordBank).forEach(function (key) {
        if (wordBank[key]) lines.push(key + ': ' + wordBank[key]);
      });
      lines.push('');
    }
    (draft.hooks || []).forEach(function (hook) {
      lines.push('Hook ' + hook.id + ': ' + hook.text);
      lines.push('  ' + describeLine(hook, preview));
    });
    lines.push('');
    (draft.sections || []).forEach(function (sectionItem) {
      lines.push('[' + sectionItem.label + ']');
      sectionItem.lines.forEach(function (line) {
        lines.push(line.text);
        lines.push('  ' + describeLine(line, preview));
      });
      lines.push('');
    });
    if (info.cover && info.cover.line) {
      lines.push(String(info.cover.line));
      lines.push(COVER_IMAGE_RIGHTS);
      lines.push('');
    }
    return lines.join('\n').trim() + '\n';
  }

  function interviewPrompt(interview) {
    var words = {};
    Object.keys(interview.words || {}).forEach(function (key) {
      words[key] = scrubAsk(interview.words[key]);
    });
    var shape = interview.shape || {};
    return JSON.stringify({
      task: 'Write the lyric draft JSON. Variant ' + (interview.variant || 0) + ': change the generated lines, and keep every user line identical. Original song only. No existing melody.',
      mood: scrubAsk(interview.mood),
      whatHappened: scrubAsk(interview.happened),
      who: scrubAsk(interview.who),
      why: scrubAsk(interview.why),
      hookSentenceVerbatim: scrubAsk(interview.line),
      wordBankVerbatim: words,
      genre: scrubAsk(shape.genre),
      pack: shape.pack || '',
      comedy: Boolean(shape.comedy),
      comedyType: shape.comedyType || '',
      comedyMusic: shape.comedyMusic || '',
      language: shape.language,
      explicit: shape.explicit === 'explicit',
      length: shape.length,
      rules: shape.comedy
        ? 'Good-natured comedy. No slurs, hate, or sexual content about a real person. No public figures or celebrities. Original song only.'
        : 'Original song only. No existing melody.',
    });
  }

  // HOOK(profile): lib/profile.js artist rows store name, genres, and photo.
  // There is no brand-color, palette, or logo field. brandColors and logo stay null
  // until those fields exist. Do not invent them.
  function profileForCover(me) {
    if (!me || typeof me !== 'object') return null;
    var stored = me.profile && typeof me.profile === 'object' ? me.profile : {};
    var list = Array.isArray(stored.artists) ? stored.artists : [];
    var artists = [];
    list.forEach(function (row) {
      if (!row || !String(row.name || '').trim()) return;
      var photo = String(row.photo || '');
      if (!/^data:image\/(jpeg|jpg|png);base64,/i.test(photo)) photo = '';
      var genres = Array.isArray(row.genres) ? row.genres.map(function (item) {
        return String(item || '').trim();
      }).filter(Boolean).slice(0, 5) : [];
      artists.push({
        id: String(row.id || row.artist_id || row.name).trim(),
        name: String(row.name).trim().slice(0, 80),
        genres: genres,
        photo: photo,
      });
    });
    if (!artists.length && String(me.artist || '').trim()) {
      var accountPhoto = String(stored.photo || '');
      if (!/^data:image\/(jpeg|jpg|png);base64,/i.test(accountPhoto)) accountPhoto = '';
      var accountGenres = Array.isArray(stored.genres) ? stored.genres.map(function (item) {
        return String(item || '').trim();
      }).filter(Boolean).slice(0, 5) : [];
      artists.push({
        id: 'account',
        name: String(me.artist).trim().slice(0, 80),
        genres: accountGenres,
        photo: accountPhoto,
      });
    }
    if (!artists.length) return null;
    return {
      artists: artists,
      name: artists[0].name,
      genres: artists[0].genres,
      photo: artists[0].photo,
      brandColors: null,
      logo: null,
    };
  }

  function createLimiter(opts) {
    var windowMs = (opts && opts.windowMs) || RATE_WINDOW_MS;
    var max = (opts && opts.max) || RATE_MAX;
    var buckets = new Map();
    return {
      allow: function (ip, now) {
        var t = typeof now === 'number' ? now : Date.now();
        var key = String(ip || 'unknown');
        var prev = (buckets.get(key) || []).filter(function (ts) { return t - ts < windowMs; });
        if (prev.length >= max) {
          buckets.set(key, prev);
          return false;
        }
        prev.push(t);
        buckets.set(key, prev);
        return true;
      },
    };
  }

  return {
    ARTIST_NOTE: ARTIST_NOTE,
    BODY_MAX: BODY_MAX,
    COPYRIGHT_SENTENCE: COPYRIGHT_SENTENCE,
    COVER_IMAGE_RIGHTS: COVER_IMAGE_RIGHTS,
    SESSION_KEY: SESSION_KEY,
    DEFAULT_MODEL: DEFAULT_MODEL,
    GROK_ATTRIBUTION: GROK_ATTRIBUTION,
    LIMITS: LIMITS,
    PREVIEW_NOTICE: PREVIEW_NOTICE,
    RATE_MAX: RATE_MAX,
    RATE_WINDOW_MS: RATE_WINDOW_MS,
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    WORD_KEYS: WORD_KEYS,
    buildSampleDraft: buildSampleDraft,
    buildStylePrompt: buildStylePrompt,
    collectUserStrings: collectUserStrings,
    containsParodyAsk: containsParodyAsk,
    createLimiter: createLimiter,
    describeLine: describeLine,
    draftFromModelJson: draftFromModelJson,
    formatAuthorship: formatAuthorship,
    interviewPrompt: interviewPrompt,
    normalizeInterview: normalizeInterview,
    profileForCover: profileForCover,
    publicFigureName: publicFigureName,
    stripArtistNames: stripArtistNames,
  };
}));
