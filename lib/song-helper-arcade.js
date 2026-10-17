'use strict';

/**
 * Song Helper arcade. One question per scene.
 * Tiles pick options only. They never drop into a lyric.
 * Browser and server. No API key lives here.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundSongArcade = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var CREDIT_LINE = 'Answering questions is free. Writing with AI uses 1 credit.';
  var HALL_KICKER = 'Song Helper arcade';
  var HALL_TITLE = 'Pick your game';
  var PLAI_HALL = "Hey, I'm Plai! Pick a machine and I'll walk you through it.";
  var PARODY_NOTE = 'This is a parody. All new words, nothing copied.';
  var OPEN_LABEL = 'Copy and open my music app';
  var OPEN_URL = 'https://suno.com/create';
  var SIGN_IN_NOTE = 'Sign in to run the AI pass. That uses 1 credit. This view is a sample from your notes.';
  var COPY_STYLE = 'Copy style prompt';
  var COPY_LYRICS = 'Copy lyrics';

  var CABINETS = [
    {
      id: 'write',
      title: 'Write my song',
      blurb: "Tell me your story, one question at a time. I'll help it turn into a song.",
      time: '1 player · about 5 min',
      tone: 'pink',
    },
    {
      id: 'parody',
      title: 'Make a parody',
      blurb: 'Poke fun at a famous song with all new words. Weird Al style mix included.',
      time: '1 player · about 3 min',
      tone: 'gold',
      tilt: true,
      fresh: true,
    },
    {
      id: 'style',
      title: 'Style prompt only',
      blurb: 'Already have lyrics? Pick the sound and get a style prompt to paste.',
      time: '1 player · about 1 min',
      tone: 'cyan',
    },
  ];

  var PARODY_TILES = [
    { id: 'preach', label: 'Preaching one thing, doing another' },
    { id: 'brag', label: 'Over the top bragging' },
    { id: 'image', label: 'A too perfect image' },
    { id: 'beef', label: 'Beef and diss tracks' },
    { id: 'dance', label: 'A dance craze' },
    { id: 'else', label: 'Something else' },
  ];

  var MOODS = [
    { id: 'love', label: 'Love' },
    { id: 'heartbreak', label: 'Heartbreak' },
    { id: 'hype', label: 'Hype' },
    { id: 'grateful', label: 'Grateful' },
    { id: 'petty', label: 'Petty' },
    { id: 'nostalgic', label: 'Nostalgic' },
    { id: 'angry', label: 'Angry' },
    { id: 'mindset', label: 'Mindset' },
  ];

  var WHO = [
    { id: 'everyone', label: 'Everyone' },
    { id: 'someone', label: 'Someone specific' },
    { id: 'myself', label: 'Myself' },
  ];

  var PARTS = [
    { id: 'hook', label: 'Hook' },
    { id: 'verse-1', label: 'Verse 1' },
    { id: 'verse-2', label: 'Verse 2' },
    { id: 'bridge', label: 'Bridge' },
  ];

  var GENRES = [
    { id: 'pop', label: 'Pop' },
    { id: 'hiphop', label: 'Hip-hop' },
    { id: 'rnb', label: 'R&B' },
    { id: 'country', label: 'Country' },
    { id: 'rock', label: 'Rock' },
    { id: 'afrobeats', label: 'Afrobeats' },
    { id: 'lofi', label: 'Lo-fi' },
    { id: 'gospel', label: 'Gospel' },
  ];

  var ENERGY = [
    { id: 'soft', label: 'Soft' },
    { id: 'steady', label: 'Steady' },
    { id: 'loud', label: 'Loud' },
  ];

  var MOOD_STYLE = {
    love: 'warm pop, soft electric piano, close vocal, gentle kick, intimate and direct',
    heartbreak: 'minor key pop, sparse piano, low vocal, slow kick, tender and close',
    hype: 'bright pop, claps, bouncy bass, stacked vocal, high energy',
    grateful: 'warm gospel lean, organ chords, soft drums, open vocal, hopeful',
    petty: 'tight pop, dry drums, talk-sung vocal, side-eye energy, punchy',
    nostalgic: 'lo fi pop, dusty keys, soft drums, close vocal, hazy and warm',
    angry: 'driven rock, distorted guitar, hard kick, shouted vocal, tense',
    mindset: 'minimal hip-hop, deep bass, sparse hats, calm vocal, focused',
  };

  var GENRE_STYLE = {
    pop: 'modern pop, tight drums, bright synths, conversational vocal, punchy and bouncy',
    hiphop: 'minimal hip-hop, hard drums, deep bass, close vocal, punchy and bouncy',
    rnb: 'smooth R&B, electric piano, warm bass, close vocal, late night',
    country: 'modern country, acoustic guitar, steady kick, conversational vocal, dry humor',
    rock: 'live rock, electric guitar, room drums, forward vocal, driving',
    afrobeats: 'afrobeats, log drum, airy guitar, melodic vocal, sunny and bouncing',
    lofi: 'lo fi, dusty keys, soft drums, quiet vocal, hazy and warm',
    gospel: 'choir gospel, organ, hand claps, open vocal, hopeful',
  };

  function blank() {
    return {
      game: '',
      step: 0,
      points: 0,
      sound: false,
      write: { mood: '', who: '', story: '', part: 'hook', line: '', title: '' },
      parody: { tiles: [], take: '', version: 'straight', song: '', artist: '', title: '' },
      style: { genre: '', energy: '' },
      result: null,
    };
  }

  function cabinet(id) {
    for (var i = 0; i < CABINETS.length; i += 1) {
      if (CABINETS[i].id === id) return CABINETS[i];
    }
    return null;
  }

  function labelOf(list, id) {
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i].label;
    }
    return '';
  }

  function scenes(game) {
    if (game === 'parody') {
      return [
        {
          id: 'target',
          kicker: 'The target',
          ask: 'What are you poking fun at?',
          help: 'Pick one or more, then tell the joke in your own words.',
          plai: 'Pick the joke. I will not copy their lyric.',
          tiles: PARODY_TILES,
          multi: true,
          take: true,
          takeLabel: 'Your take',
          takePlaceholder: 'A famous "be humble" song. He tells everyone to stay humble, then picks fights. The family man image does not match what the lyrics admit.',
          version: true,
          free: true,
        },
        {
          id: 'original',
          kicker: 'The original',
          ask: 'What song are you answering?',
          help: 'Name it so the joke has a target. The style prompt will not use the name.',
          plai: 'Song and artist. I only need the aim.',
          fields: [
            { id: 'song', label: 'Song title' },
            { id: 'artist', label: 'Artist' },
          ],
          free: true,
        },
        {
          id: 'title',
          kicker: 'Your title',
          ask: 'What do you want to call it?',
          help: 'Pick a title that is not a look-alike.',
          plai: 'Make it yours.',
          fields: [{ id: 'title', label: 'Your title' }],
          free: true,
        },
        {
          id: 'write',
          kicker: 'Press start',
          ask: 'Ready for the parody?',
          help: 'Straight is sharp. Weird Al style mix is the funny one.',
          plai: 'This is the writing step. It uses 1 credit.',
          confirm: true,
          free: false,
        },
      ];
    }
    if (game === 'style') {
      return [
        {
          id: 'genre',
          kicker: 'The sound',
          ask: 'What sound are we painting?',
          help: 'Tiles pick the feel. Nothing here writes a lyric.',
          plai: 'Pick a lane. I will describe the feel only.',
          tiles: GENRES,
          free: true,
        },
        {
          id: 'energy',
          kicker: 'The energy',
          ask: 'How hard does it hit?',
          help: 'One more choice, then the style prompt.',
          plai: 'Soft, steady, or loud.',
          tiles: ENERGY,
          free: true,
        },
      ];
    }
    return [
      {
        id: 'mood',
        kicker: 'The feeling',
        ask: 'How does it feel?',
        help: 'One feeling. The questions after follow it.',
        plai: 'Pick a feeling. One question at a time.',
        tiles: MOODS,
        free: true,
      },
      {
        id: 'story',
        kicker: 'The story',
        ask: 'What happened?',
        help: 'Your words stay in the song.',
        plai: 'Tell me the real moment.',
        take: true,
        takeLabel: 'What happened',
        takePlaceholder: 'The kitchen light stayed on and nobody came back.',
        free: true,
      },
      {
        id: 'who',
        kicker: 'Who it is for',
        ask: 'Who is it for?',
        help: 'Everyone, someone specific, or yourself.',
        plai: 'This is the same fork the helper already uses.',
        tiles: WHO,
        free: true,
      },
      {
        id: 'part',
        kicker: 'The part',
        ask: 'Which part do you want first?',
        help: 'Hook, verse, or bridge. You write the line. Tiles only pick the part.',
        plai: 'Pick the part, then give me a line.',
        tiles: PARTS,
        line: true,
        free: true,
      },
      {
        id: 'write',
        kicker: 'Press start',
        ask: 'What should we call it?',
        help: 'The next step writes with AI and uses 1 credit.',
        plai: 'Name it, then I will write around your line.',
        fields: [{ id: 'title', label: 'Song title' }],
        confirm: true,
        free: false,
      },
    ];
  }

  function sceneAt(state) {
    var list = scenes(state.game);
    return list[state.step] || null;
  }

  function trail(state) {
    var list = scenes(state.game);
    var index = Math.max(0, Math.min(state.step, list.length - 1));
    return { index: index, total: list.length, label: 'Level ' + (index + 1) + '/' + list.length };
  }

  function ready(state) {
    var scene = sceneAt(state);
    if (!scene) return false;
    if (state.game === 'parody' && scene.id === 'target') {
      return state.parody.tiles.length > 0 || String(state.parody.take || '').trim().length > 0;
    }
    if (state.game === 'parody' && scene.id === 'original') {
      return String(state.parody.song || '').trim().length > 0;
    }
    if (state.game === 'parody' && scene.id === 'title') {
      return String(state.parody.title || '').trim().length > 0;
    }
    if (state.game === 'parody' && scene.id === 'write') return true;
    if (state.game === 'style' && scene.id === 'genre') return !!state.style.genre;
    if (state.game === 'style' && scene.id === 'energy') return !!state.style.energy;
    if (state.game === 'write' && scene.id === 'mood') return !!state.write.mood;
    if (state.game === 'write' && scene.id === 'story') return String(state.write.story || '').trim().length > 0;
    if (state.game === 'write' && scene.id === 'who') return !!state.write.who;
    if (state.game === 'write' && scene.id === 'part') {
      return !!state.write.part && String(state.write.line || '').trim().length > 0;
    }
    if (state.game === 'write' && scene.id === 'write') return String(state.write.title || '').trim().length > 0;
    return false;
  }

  function pick(state, id) {
    var scene = sceneAt(state);
    var next = clone(state);
    if (!scene || !scene.tiles) return next;
    if (state.game === 'parody' && scene.multi) {
      var tiles = next.parody.tiles.slice();
      var at = tiles.indexOf(id);
      if (at === -1) {
        tiles.push(id);
        next.points += 50;
      } else {
        tiles.splice(at, 1);
      }
      next.parody.tiles = tiles;
      return next;
    }
    var bag = state.game === 'style' ? next.style : next.write;
    var key = scene.id === 'energy' ? 'energy' : (scene.id === 'genre' ? 'genre' : (scene.id === 'part' ? 'part' : (scene.id === 'who' ? 'who' : 'mood')));
    if (bag[key] !== id) next.points += 50;
    bag[key] = id;
    return next;
  }

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function wordsOf(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  function filterNames(text, blocked) {
    var out = String(text || '');
    (blocked || []).forEach(function (token) {
      String(token || '').split(/[^A-Za-z0-9]+/).forEach(function (word) {
        if (!word || word.length < 3) return;
        if (/^(the|and|song|feat|with|from)$/i.test(word)) return;
        var re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'ig');
        out = out.replace(re, '');
      });
    });
    return out.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/^[,\s]+|[,\s]+$/g, '').trim();
  }

  function line(text) {
    return { text: String(text || '').replace(/\s+/g, ' ').trim(), source: 'generated' };
  }

  function writePack(input) {
    var src = input || {};
    var story = String(src.story || src.line || '').replace(/\s+/g, ' ').trim();
    var kept = String(src.line || '').replace(/\s+/g, ' ').trim();
    var title = String(src.title || '').trim() || 'Untitled';
    var mood = labelOf(MOODS, src.mood) || 'the feeling';
    var who = labelOf(WHO, src.who);
    var part = src.part || 'hook';
    var userLine = kept || story || ('This one is about ' + mood.toLowerCase() + '.');
    var hookLines = part === 'hook' ? [userLine, mood + ' stays in the pocket.'] : [story || userLine, 'The ' + mood.toLowerCase() + ' hook, in new words around yours.'];
    var verse = [
      story || userLine,
      who ? ('It is for ' + who.toLowerCase() + '.') : 'The detail is the one you wrote.',
    ];
    var sections = [
      { label: 'Hook', lines: hookLines.map(line) },
      { label: 'Verse 1', lines: verse.map(line) },
      { label: 'Verse 2', lines: [line(userLine), line('Same story, second look, none of it invented past your line.')] },
      { label: 'Bridge', lines: [line(who ? ('Hold it for ' + who.toLowerCase() + '.') : 'Hold the line you wrote.'), line('Then let the hook come back.')] },
    ];
    var prompt = filterNames(MOOD_STYLE[src.mood] || MOOD_STYLE.love, [title]);
    return {
      ok: true,
      preview: true,
      game: 'write',
      title: title,
      credit: 1,
      notice: 'Demo mode. This is a sample, not written by AI.',
      stylePrompt: prompt,
      sections: sections,
      badge: mood,
    };
  }

  function stylePack(input) {
    var src = input || {};
    var base = GENRE_STYLE[src.genre] || GENRE_STYLE.pop;
    if (src.energy === 'soft') base = base.replace('punchy and bouncy', 'soft and close');
    if (src.energy === 'loud') base += ', high energy';
    return {
      ok: true,
      preview: false,
      game: 'style',
      title: 'Style prompt',
      credit: 0,
      notice: '',
      stylePrompt: filterNames(base, []),
      sections: [],
      badge: labelOf(GENRES, src.genre),
    };
  }

  function parodyInput(state) {
    var row = state.parody || state || {};
    var tiles = (row.tiles || []).map(function (id) { return labelOf(PARODY_TILES, id); }).filter(Boolean);
    var take = String(row.take || '').trim();
    var comment = [tiles.join('. '), take].filter(Boolean).join('. ');
    var original = [String(row.song || '').trim(), String(row.artist || '').trim()].filter(Boolean).join(' by ');
    return {
      title: String(row.title || '').trim() || 'Parody',
      originalTitle: original,
      comment: comment,
      happened: '',
      version: row.version === 'weird' ? 'weird' : 'straight',
      lines: '',
    };
  }

  function plain(pack) {
    var parts = [];
    (pack.sections || []).forEach(function (part) {
      parts.push(part.label);
      (part.lines || []).forEach(function (row) {
        parts.push(typeof row === 'string' ? row : row.text);
      });
      parts.push('');
    });
    return parts.join('\n').trim();
  }

  function copyBundle(pack) {
    return [plain(pack), pack && pack.stylePrompt ? pack.stylePrompt : ''].filter(Boolean).join('\n\n');
  }

  function userFacing() {
    var bits = [CREDIT_LINE, HALL_KICKER, HALL_TITLE, PLAI_HALL, PARODY_NOTE, OPEN_LABEL, COPY_STYLE, COPY_LYRICS];
    CABINETS.forEach(function (cab) {
      bits.push(cab.title, cab.blurb, cab.time, 'Press start');
    });
    ['write', 'parody', 'style'].forEach(function (game) {
      scenes(game).forEach(function (scene) {
        bits.push(scene.ask, scene.help, scene.plai, scene.kicker);
        (scene.tiles || []).forEach(function (tile) { bits.push(tile.label); });
      });
    });
    bits.push('Straight', 'Weird Al style mix', 'New', 'New high score', 'Make another');
    return bits.join('\n');
  }

  return {
    CREDIT_LINE: CREDIT_LINE,
    HALL_KICKER: HALL_KICKER,
    HALL_TITLE: HALL_TITLE,
    PLAI_HALL: PLAI_HALL,
    PARODY_NOTE: PARODY_NOTE,
    OPEN_LABEL: OPEN_LABEL,
    OPEN_URL: OPEN_URL,
    SIGN_IN_NOTE: SIGN_IN_NOTE,
    COPY_STYLE: COPY_STYLE,
    COPY_LYRICS: COPY_LYRICS,
    CABINETS: CABINETS,
    PARODY_TILES: PARODY_TILES,
    MOODS: MOODS,
    WHO: WHO,
    PARTS: PARTS,
    GENRES: GENRES,
    ENERGY: ENERGY,
    blank: blank,
    cabinet: cabinet,
    scenes: scenes,
    sceneAt: sceneAt,
    trail: trail,
    ready: ready,
    pick: pick,
    writePack: writePack,
    stylePack: stylePack,
    parodyInput: parodyInput,
    plain: plain,
    copyBundle: copyBundle,
    filterNames: filterNames,
    userFacing: userFacing,
    labelOf: labelOf,
  };
});
