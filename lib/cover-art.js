(function (root, factory) {
  var song = (typeof module === 'object' && module.exports) ? require('./song-helper') : root.SongHelperCore;
  var api = factory(song || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CoverArtCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (song) {
  'use strict';

  var DEFAULT_IMAGE_MODEL = 'grok-imagine-image-2.0';
  var PLACEHOLDER_NOTICE = 'Preview mode: placeholder art, not AI-generated.';
  var ARTWORK_CREDIT = 'Artwork generated with Grok by xAI';
  var PLACEHOLDER_RECORD = 'Cover image: placeholder art, not AI-generated.';
  var GROK_RECORD = 'Cover image: Artwork generated with Grok by xAI.';
  var IMAGE_RIGHTS = (song && song.COVER_IMAGE_RIGHTS) || "AI-generated images generally can't be copyrighted.";
  var STRIP_NOTE = 'We left out artist names, real people, brands, and explicit wording so the cover stays original.';
  var EXPLICIT_NOTE = 'This cover stays clean. Take the explicit part out and try again.';
  var EXPORT_PX = 3000;
  var SESSION_IMAGE_MAX = 8;
  var RATE_MAX = (song && song.RATE_MAX) || 10;
  var RATE_WINDOW_MS = (song && song.RATE_WINDOW_MS) || (60 * 60 * 1000);
  var BODY_MAX = 20000;
  var UPSCALE_NOTE = 'The image model’s largest documented size is 2k, which is under 3000px. This export scales the picture up to 3000×3000, so fine detail is softer than a file made at 3000px.';

  var LOOKS = {
    photo: 'photographic album cover, natural light, realistic texture, no people',
    painted: 'painted album cover, oil paint, visible brushstrokes, no people',
    illustrated: 'illustrated album cover, editorial illustration, flat shapes, no people',
    collage: 'paper collage album cover, cut paper and tape, no printed words, no people',
    minimal: 'minimal album cover, simple color fields and one geometric shape, lots of empty space, no type',
  };

  var PALETTES = {
    night: ['#120818', '#7D3CFF', '#F3CB47'],
    dusk: ['#2A1208', '#E07A3D', '#F3CB47'],
    sea: ['#071820', '#1F6F8B', '#D7F3F0'],
    blush: ['#2A1020', '#E36A8C', '#F6D5C4'],
    ink: ['#0A0A0A', '#F4F4F4', '#7D3CFF'],
  };

  var BRANDS = [
    'nike', 'adidas', 'gucci', 'prada', 'chanel', 'louis vuitton', 'supreme',
    'starbucks', "mcdonald's", 'mcdonalds', 'coca-cola', 'coca cola', 'disney',
    'marvel', 'spotify', 'tiktok', 'instagram', 'youtube', 'rolex', 'ferrari', 'tesla',
  ];

  var EXPLICIT = /\b(nude|nudes|naked|nsfw|porn|porno|xxx|erotic|erotica|sex|sexual|intercourse|genitals|penis|vagina|blowjob|orgasm)\b/i;

  function clip(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function guardCoverText(input) {
    var original = String(input || '');
    if (EXPLICIT.test(original)) {
      return { text: '', stripped: true, rejected: true, note: EXPLICIT_NOTE };
    }
    var artist = song.stripArtistNames ? song.stripArtistNames(original) : { text: original, stripped: false };
    var text = artist.text;
    var stripped = Boolean(artist.stripped);
    var patterns = [
      /\b(?:in the style of|style of|inspired by|channeling|sounds like|looks like|looking like|portrait of|likeness of|resembling|face of)\s+[A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,3}/gu,
      /\b(?:celebrity|celebrities|famous person|real person|lookalike|likeness|logo|logos|trademark)\b/gi,
    ];
    patterns.forEach(function (re) {
      var next = text.replace(re, ' ');
      if (next !== text) stripped = true;
      text = next;
    });
    var dangling = text.replace(/\b(?:in the style of|style of|inspired by|channeling|sounds like|looks like|looking like|portrait of|likeness of|resembling|face of)\b/gi, ' ');
    if (dangling !== text) stripped = true;
    text = dangling;
    BRANDS.forEach(function (name) {
      var re = new RegExp('(^|[^\\p{L}\\p{N}])' + escapeRegExp(name) + '(?![\\p{L}\\p{N}])', 'igu');
      var next = text.replace(re, '$1');
      if (next !== text) stripped = true;
      text = next;
    });
    text = text.replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '').trim();
    return {
      text: text,
      stripped: stripped,
      rejected: false,
      note: stripped ? STRIP_NOTE : '',
    };
  }

  function colorsFor(input) {
    if (input && input.palette === 'custom' && /^#[0-9a-fA-F]{6}$/.test(input.customColor || '')) {
      return ['#0A0A0A', input.customColor, '#F4F1EA'];
    }
    return (PALETTES[input && input.palette] || PALETTES.night).slice();
  }

  function paletteLine(input) {
    return colorsFor(input).join(', ');
  }

  function buildImagePrompt(input) {
    var src = input || {};
    var guarded = guardCoverText(src.idea);
    if (guarded.rejected) return guarded;
    var look = LOOKS[src.look] || LOOKS.photo;
    var sceneBits = Array.isArray(src.chips) ? src.chips.map(function (chip) {
      return clip(typeof chip === 'string' ? chip : (chip && chip.label), 80);
    }).filter(Boolean).slice(0, 12) : [];
    var rawIdea = String(src.idea || '');
    var lyricDump = (rawIdea.match(/\n/g) || []).length >= 2 || rawIdea.length > 320;
    var scene = sceneBits.length ? sceneBits.join(', ') : (lyricDump ? '' : guarded.text);
    if (!scene && lyricDump) {
      var pulled = extractImagery({
        lines: rawIdea.split(/\n/).map(function (text) { return { text: text, yours: false }; }),
      });
      scene = pulled.map(function (chip) { return chip.label; }).join(', ');
    }
    if (!scene) scene = guarded.text || 'an abstract mood with no recognizable person';
    var prompt = [
      'Square original album-cover artwork.',
      look + '.',
      'Colors: ' + paletteLine(src) + '.',
      'Scene: ' + scene + '.',
      'No text, no letters, no numbers, no words, no logos, no watermarks, no signatures, no typography.',
      'Do not depict any real person, celebrity, or brand. Do not render any lyrics or words.',
    ].join(' ');
    return {
      prompt: prompt,
      text: guarded.text,
      stripped: guarded.stripped,
      rejected: false,
      note: guarded.note,
    };
  }

  var COLOR_WORDS = ['faded red', 'midnight blue', 'neon', 'gold', 'crimson', 'amber', 'ivory', 'violet', 'teal', 'silver', 'grey', 'gray', 'brown', 'black', 'white', 'blue', 'red', 'pink', 'purple', 'green', 'yellow', 'orange'];
  var TIME_WORDS = ['blue hour', 'golden hour', 'just after midnight', 'after midnight', 'midnight', 'sunrise', 'sunset', 'dawn', 'dusk', 'morning', 'evening', 'afternoon', 'noon', 'night', '2am', '2 am'];
  var WEATHER_WORDS = ['rain', 'raining', 'storm', 'snow', 'fog', 'mist', 'wind', 'thunder', 'lightning', 'humid', 'drizzle', 'cloudy', 'sunshine'];
  var PLACE_WORDS = ['kitchen', 'bedroom', 'hallway', 'street', 'highway', 'porch', 'church', 'bar', 'city', 'ocean', 'beach', 'apartment', 'rooftop', 'diner', 'station', 'river', 'park', 'club', 'studio', 'room', 'car'];
  var OBJECT_WORDS = ['mug', 'hoodie', 'chair', 'phone', 'light', 'window', 'door', 'keys', 'glass', 'bottle', 'ring', 'letter', 'photo', 'guitar', 'piano', 'mirror', 'coffee', 'lamp', 'table'];
  var TONE_WORDS = ['heartbroken', 'lonely', 'angry', 'tender', 'hopeful', 'bitter', 'grateful', 'nostalgic', 'healing', 'petty', 'hyped', 'soft', 'heavy', 'warm', 'cold', 'intimate', 'aching'];

  function findWords(text, list) {
    var found = [];
    var lower = String(text || '').toLowerCase();
    list.forEach(function (word) {
      var re = new RegExp('(^|[^\\p{L}\\p{N}])' + escapeRegExp(word) + '(?![\\p{L}\\p{N}])', 'iu');
      if (re.test(lower)) found.push(word);
    });
    return found;
  }

  function extractImagery(input) {
    var src = input || {};
    var lines = Array.isArray(src.lines) ? src.lines : [];
    var words = src.words || {};
    var seen = {};
    var chips = [];
    function add(kind, label, yours) {
      var text = clip(label, 80);
      if (!text || text.length < 3) return;
      var key = text.toLowerCase();
      var existing = seen[key];
      if (existing) {
        if (yours) existing.yours = true;
        return;
      }
      var chip = { id: 'img-' + chips.length, kind: kind, label: text, yours: !!yours, on: true };
      seen[key] = chip;
      chips.push(chip);
    }
    function scan(text, yours) {
      function keep(kind, word) {
        var lower = word.toLowerCase();
        var already = chips.some(function (chip) { return chip.label.toLowerCase().indexOf(lower) !== -1; });
        if (already) return;
        add(kind, word, yours);
      }
      findWords(text, COLOR_WORDS).forEach(function (word) { keep('color', word); });
      findWords(text, TIME_WORDS).forEach(function (word) { keep('time', word); });
      findWords(text, WEATHER_WORDS).forEach(function (word) { keep('weather', word); });
      findWords(text, PLACE_WORDS).forEach(function (word) { keep('place', word); });
      findWords(text, OBJECT_WORDS).forEach(function (word) { keep('object', word); });
      findWords(text, TONE_WORDS).forEach(function (word) { keep('tone', word); });
    }
    var yoursLines = [];
    var otherLines = [];
    lines.forEach(function (line) {
      var text = clip(line && (line.text || line), 280);
      if (!text) return;
      if (line && line.yours) yoursLines.push(text);
      else otherLines.push(text);
    });
    ['place', 'room', 'color', 'time', 'smell'].forEach(function (key) {
      var phrase = clip(words[key], 80);
      if (!phrase) return;
      var inYours = yoursLines.some(function (text) { return text.toLowerCase().indexOf(phrase.toLowerCase()) !== -1; });
      var inDraft = otherLines.some(function (text) { return text.toLowerCase().indexOf(phrase.toLowerCase()) !== -1; });
      if (!inYours && !inDraft) return;
      var kind = key === 'room' || key === 'smell' ? 'object' : key;
      add(kind, phrase, inYours);
    });
    yoursLines.forEach(function (text) {
      if (text.length <= 80 && text.split(/\s+/).length <= 8) add('image', text, true);
      scan(text, true);
    });
    if (src.mood) add('tone', src.mood, true);
    otherLines.forEach(function (text) { scan(text, false); });
    var yours = chips.filter(function (chip) { return chip.yours; });
    var rest = chips.filter(function (chip) { return !chip.yours; });
    return yours.concat(rest).slice(0, 12);
  }

  function suggestFromImagery(chips) {
    var kept = (chips || []).filter(function (chip) { return chip && chip.on !== false && chip.label; });
    var by = {};
    kept.forEach(function (chip) {
      var kind = chip.kind || 'image';
      if (!by[kind]) by[kind] = [];
      if (by[kind].length < 3) by[kind].push(clip(chip.label, 80));
    });
    var bits = [];
    if (by.tone && by.tone[0]) bits.push('A ' + by.tone[0] + ' feeling');
    if (by.time && by.time[0]) bits.push('at ' + by.time[0]);
    if (by.place && by.place[0]) bits.push('in ' + by.place[0]);
    if (by.weather && by.weather[0]) bits.push('with ' + by.weather[0]);
    var sentence = bits.join(' ');
    var pictures = (by.object || []).concat(by.color || []).concat(by.image || []);
    if (pictures.length) sentence += (sentence ? '. ' : '') + pictures.join(', ') + ' in the frame';
    sentence = sentence.replace(/\s+/g, ' ').trim();
    var guarded = guardCoverText(sentence);
    return {
      idea: guarded.rejected ? '' : guarded.text,
      stripped: guarded.stripped,
      rejected: guarded.rejected,
      note: guarded.note,
      chips: kept,
    };
  }

  function suggestFromSong(songAnswers) {
    var src = songAnswers || {};
    var lyricLines = src.lyrics || src.lines || [];
    if (lyricLines.length) {
      var chips = extractImagery({
        lines: lyricLines,
        words: src.words || {},
        mood: src.mood,
      });
      if (chips.length) return suggestFromImagery(chips);
    }
    var bits = [];
    if (src.mood) bits.push('A ' + clip(src.mood, 40) + ' feeling');
    if (src.time) bits.push('at ' + clip(src.time, 80));
    if (src.place) bits.push('in ' + clip(src.place, 120));
    var sentence = bits.join(' ');
    if (src.room) sentence += (sentence ? '. ' : '') + clip(src.room, 120) + ' is in the frame';
    if (src.color) sentence += (sentence ? '. ' : '') + 'Color leaning ' + clip(src.color, 80);
    sentence = sentence.replace(/\s+/g, ' ').trim();
    var guarded = guardCoverText(sentence);
    return {
      idea: guarded.rejected ? '' : guarded.text,
      stripped: guarded.stripped,
      rejected: guarded.rejected,
      note: guarded.note,
    };
  }

  function hashSeed(text) {
    var s = String(text || '');
    var h = 2166136261;
    for (var i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function placeholderImages(input, count) {
    var colors = colorsFor(input);
    var images = [];
    var n = count;
    for (var i = 0; i < n; i += 1) {
      images.push({
        id: String(i + 1),
        seed: hashSeed((input.idea || '') + '|' + (input.look || '') + '|' + colors.join(',') + '|' + i),
        look: input.look,
        colors: colors,
      });
    }
    return images;
  }

  function fail(code) {
    var err = new Error(code);
    err.code = code;
    return err;
  }

  function normalizeRequest(body) {
    var src = body || {};
    var look = String(src.look || '').trim();
    if (!LOOKS[look]) throw fail('look');
    var palette = String(src.palette || '').trim();
    if (!PALETTES[palette] && palette !== 'custom') throw fail('palette');
    var customColor = String(src.customColor || '').trim();
    if (palette === 'custom' && !/^#[0-9a-fA-F]{6}$/.test(customColor)) throw fail('color');
    var idea = clip(src.idea, 600);
    var chips = [];
    if (Array.isArray(src.chips)) {
      src.chips.forEach(function (item) {
        var label = clip(typeof item === 'string' ? item : (item && item.label), 80);
        if (label) chips.push(label);
      });
    }
    chips = chips.slice(0, 12);
    if (idea.length < 3 && !chips.length) throw fail('idea');
    var built = buildImagePrompt({
      look: look,
      palette: palette,
      customColor: customColor,
      idea: idea,
      chips: chips,
    });
    if (built.rejected) {
      var err = fail('explicit');
      err.note = built.note;
      throw err;
    }
    var count = Number(src.count);
    if (count !== 2 && count !== 3 && count !== 4) count = 3;
    var sessionId = String(src.session_id || '').trim();
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(sessionId)) throw fail('session');
    return {
      look: look,
      palette: palette,
      customColor: customColor,
      idea: idea,
      chips: chips,
      prompt: built.prompt,
      note: built.note,
      stripped: built.stripped,
      count: count,
      sessionId: sessionId,
      colors: colorsFor({ palette: palette, customColor: customColor }),
    };
  }

  function createSessionCap(opts) {
    var max = (opts && opts.max) || SESSION_IMAGE_MAX;
    var windowMs = (opts && opts.windowMs) || (6 * 60 * 60 * 1000);
    var buckets = new Map();
    return {
      take: function (sessionId, count, now) {
        var t = typeof now === 'number' ? now : Date.now();
        var key = String(sessionId || '');
        var row = buckets.get(key);
        if (!row || t - row.ts > windowMs) row = { count: 0, ts: t };
        var room = max - row.count;
        if (room <= 0) {
          buckets.set(key, row);
          return { allowed: 0, used: row.count };
        }
        var allowed = Math.min(count, room);
        row.count += allowed;
        row.ts = t;
        buckets.set(key, row);
        return { allowed: allowed, used: row.count };
      },
      refund: function (sessionId, count) {
        var row = buckets.get(String(sessionId || ''));
        if (!row) return;
        row.count = Math.max(0, row.count - count);
      },
    };
  }

  return {
    ARTWORK_CREDIT: ARTWORK_CREDIT,
    BODY_MAX: BODY_MAX,
    BRANDS: BRANDS,
    DEFAULT_IMAGE_MODEL: DEFAULT_IMAGE_MODEL,
    EXPORT_PX: EXPORT_PX,
    EXPLICIT_NOTE: EXPLICIT_NOTE,
    GROK_RECORD: GROK_RECORD,
    IMAGE_RIGHTS: IMAGE_RIGHTS,
    LOOKS: LOOKS,
    PALETTES: PALETTES,
    PLACEHOLDER_NOTICE: PLACEHOLDER_NOTICE,
    PLACEHOLDER_RECORD: PLACEHOLDER_RECORD,
    RATE_MAX: RATE_MAX,
    RATE_WINDOW_MS: RATE_WINDOW_MS,
    SESSION_IMAGE_MAX: SESSION_IMAGE_MAX,
    STRIP_NOTE: STRIP_NOTE,
    UPSCALE_NOTE: UPSCALE_NOTE,
    buildImagePrompt: buildImagePrompt,
    colorsFor: colorsFor,
    createSessionCap: createSessionCap,
    guardCoverText: guardCoverText,
    extractImagery: extractImagery,
    hashSeed: hashSeed,
    normalizeRequest: normalizeRequest,
    placeholderImages: placeholderImages,
    suggestFromImagery: suggestFromImagery,
    suggestFromSong: suggestFromSong,
  };
}));
