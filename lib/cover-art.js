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
    var scene = guarded.text || 'an abstract mood with no recognizable person';
    var prompt = [
      'Square original album-cover artwork.',
      look + '.',
      'Colors: ' + paletteLine(src) + '.',
      'Scene: ' + scene + '.',
      'No text, no letters, no numbers, no words, no logos, no watermarks, no signatures, no typography.',
      'Do not depict any real person, celebrity, or brand.',
    ].join(' ');
    return {
      prompt: prompt,
      text: guarded.text,
      stripped: guarded.stripped,
      rejected: false,
      note: guarded.note,
    };
  }

  function suggestFromSong(songAnswers) {
    var src = songAnswers || {};
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
    if (idea.length < 3) throw fail('idea');
    var built = buildImagePrompt({
      look: look,
      palette: palette,
      customColor: customColor,
      idea: idea,
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
    hashSeed: hashSeed,
    normalizeRequest: normalizeRequest,
    placeholderImages: placeholderImages,
    suggestFromSong: suggestFromSong,
  };
}));
