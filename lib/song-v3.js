/**
 * Song Helper v3 writer.
 * Browser and server. No network in this file.
 * compose() is the offline sample only. A live write asks the model with
 * writerInstructions(), checks the draft, and may retry once.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SongV3 = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var FREE_AI_WRITES = 1;
  var CREDIT_COST = 1;
  var SAMPLE_NOTICE = 'Sample. The live writer is not connected.';
  var DEFAULT_MUSIC_APP = 'https://suno.com/create';
  var PARODY_MIXES = ['Straight', 'Goofy mix'];

  var GENRES = [
    'Hip-hop', 'R&B', 'Pop', 'Country', 'Afrobeats', 'Reggaeton',
    'Reggae', 'Rock', 'Gospel', 'House', 'Surprise me',
  ];

  var FEELINGS = [
    'Joy', 'Heartbreak', 'Hype', 'Longing', 'Anger', 'Pride', 'Peace', 'Nostalgia', 'Funny',
  ];

  var BANNED = [
    { re: /\bneon\b/i, label: 'neon' },
    { re: /\bshadows\b/i, label: 'shadows' },
    { re: /\bwhispers\b/i, label: 'whispers' },
    { re: /\bechoes\b/i, label: 'echoes' },
    { re: /\bembers\b/i, label: 'embers' },
    { re: /\bvelvet\b/i, label: 'velvet' },
    { re: /rise above/i, label: 'rise above' },
    { re: /stories untold/i, label: 'stories untold' },
    { re: /in the night/i, label: 'in the night' },
  ];

  var ACCENT = /\b(dem|yuh|inna|wah|irie|mi)\b/i;
  var SWEAR = /\b(damn|hell|shit|fuck|ass)\b/i;

  var RHYME_FAMILY = {
    stay: 'ay', play: 'ay', day: 'ay', way: 'ay', say: 'ay', hey: 'ay',
    block: 'ock', clock: 'ock', lock: 'ock', rock: 'ock',
    truck: 'uck', luck: 'uck',
    creek: 'eek', week: 'eek',
    road: 'oad', load: 'oad',
    tape: 'ape', cape: 'ape',
    cup: 'up', up: 'up',
    pocket: 'ocket', locket: 'ocket',
    kick: 'ick', booth: 'ooth',
    porch: 'orch', fence: 'ence', field: 'ield', bus: 'us', salt: 'alt',
    lamp: 'amp', drum: 'um', sand: 'and', stop: 'op', plus: 'us2', glow: 'ow',
  };

  function sylWord(word) {
    var w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (w === 'quiet' || w === 'every' || w === 'fire') return 2;
    if (w === 'hallelujah') return 4;
    var x = w;
    if (x.length > 3 && /e$/.test(x) && !/le$/.test(x)) x = x.slice(0, -1);
    var m = x.match(/[aeiouy]+/g);
    return Math.max(1, m ? m.length : 1);
  }

  function syllableCount(text) {
    return String(text || '').split(/\s+/).filter(Boolean).reduce(function (n, word) {
      return n + sylWord(word);
    }, 0);
  }

  function normWord(word) {
    return String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  function lastWord(line) {
    var parts = String(line || '').trim().split(/\s+/);
    return parts.length ? parts[parts.length - 1] : '';
  }

  function rhymeKey(word) {
    var w = normWord(word);
    return RHYME_FAMILY[w] || w || '';
  }

  function contentLines(text) {
    return String(text || '').split('\n').map(function (line) {
      return line.trim();
    }).filter(function (line) {
      return line && line.charAt(0) !== '[';
    });
  }

  function tokensOf(text) {
    var found = {};
    String(text || '').toLowerCase().split(/[^a-z]+/).forEach(function (word) {
      if (word) found[word] = true;
    });
    return found;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function hashSeed(value) {
    var s = String(value || '');
    var n = 0;
    for (var i = 0; i < s.length; i++) n = (n + s.charCodeAt(i) * (i + 1)) % 997;
    return n;
  }

  function genreBase(name) {
    var key = String(name || 'Pop');
    var table = {
      'Hip-hop': { target: 12, verse: 8, lexicon: 'hiphop', hook: 'punch', internal: true, scheme: 'aabb' },
      'Country': { target: 8, verse: 4, lexicon: 'country', hook: 'twist', scheme: 'none', place: true },
      'Pop': { target: 7, verse: 4, lexicon: 'pop', hook: 'title3', scheme: 'aabb', vowels: true },
      'R&B': { target: 6, verse: 4, lexicon: 'rnb', hook: 'run', scheme: 'aabb' },
      'Afrobeats': { target: 6, verse: 4, lexicon: 'afro', hook: 'call', scheme: 'aabb' },
      'Reggaeton': { target: 6, verse: 4, lexicon: 'afro', hook: 'call', scheme: 'aabb' },
      'Reggae': { target: 7, verse: 4, lexicon: 'reggae', hook: 'riddim', scheme: 'none' },
      'Rock': { target: 7, verse: 4, lexicon: 'rock', hook: 'shout', scheme: 'aabb' },
      'Gospel': { target: 8, verse: 4, lexicon: 'gospel', hook: 'refrain', scheme: 'aabb', lift: true },
      'House': { target: 6, verse: 4, lexicon: 'house', hook: 'house', scheme: 'aabb' },
    };
    return table[key] || table.Pop;
  }

  function surprisePick(seed) {
    var pool = GENRES.filter(function (name) { return name !== 'Surprise me'; });
    return pool[Math.abs(seed) % pool.length];
  }

  var BAGS = {
    hiphop: ['kick', 'tape', 'block', 'booth', 'hot', 'red', 'mic', 'bar', 'town', 'side', 'hand', 'cape', 'clock'],
    country: ['porch', 'gravel', 'tulsa', 'creek', 'truck', 'kitchen', 'fence', 'field', 'old', 'dirt', 'home', 'back'],
    pop: ['oh', 'hey', 'heart', 'radio', 'light', 'smile', 'high', 'yes', 'hand'],
    rnb: ['stay', 'slow', 'honey', 'soft', 'hold', 'close', 'warm'],
    afro: ['hey', 'clap', 'move', 'drum', 'hands', 'now', 'go'],
    reggae: ['step', 'hold', 'riddim', 'skank', 'bass', 'one', 'drop'],
    rock: ['drive', 'push', 'loud', 'run', 'amp', 'crash', 'hey'],
    gospel: ['lift', 'hands', 'home', 'light', 'praise', 'high', 'sing'],
    house: ['clap', 'hands', 'move', 'kick', 'now', 'go', 'hey'],
    neutral: ['hand', 'side', 'back', 'down', 'town', 'red', 'old', 'small', 'left', 'just'],
  };

  var MOOD = {
    Joy: ['bright', 'laugh', 'grin', 'clap', 'sunlight'],
    Heartbreak: ['cold', 'ache', 'tear', 'empty', 'hollow'],
    Hype: ['loud', 'now', 'go', 'fast', 'jump'],
    Longing: ['far', 'still', 'old', 'letter', 'wait'],
    Anger: ['hot', 'mad', 'slam', 'burn', 'sharp'],
    Pride: ['tall', 'won', 'crown', 'strong', 'gold'],
    Peace: ['calm', 'slow', 'still', 'soft', 'easy'],
    Nostalgia: ['old', 'photo', 'back', 'then', 'worn'],
    Funny: ['joke', 'grin', 'oops', 'silly', 'wink'],
  };

  var MARKERS = {
    hiphop: ['kick', 'tape', 'booth', 'pocket', 'cipher', 'block'],
    country: ['porch', 'gravel', 'tulsa', 'creek', 'truck', 'kitchen'],
  };

  function moodWords(feelings) {
    var list = [];
    (feelings || []).forEach(function (name) {
      (MOOD[name] || []).forEach(function (word) {
        if (list.indexOf(word) === -1) list.push(word);
      });
    });
    return list;
  }

  var UNIQUE_ENDS = [
    'home', 'lamp', 'box', 'sky', 'club', 'fog', 'run', 'far', 'old', 'dirt',
    'back', 'side', 'hand', 'town', 'red', 'small', 'left', 'just', 'down', 'wet',
    'dry', 'blue', 'long', 'true', 'real', 'open', 'under', 'after', 'music', 'water',
    'table', 'summer', 'winter', 'morning', 'coffee', 'jacket', 'river', 'garden',
  ];

  function craft(target, end, required, bag, seed) {
    var words = [];
    (required || []).forEach(function (word) {
      if (words.indexOf(word) === -1) words.push(word);
    });
    var endS = sylWord(end);
    var have = 0;
    words.forEach(function (word) { have += sylWord(word); });
    var need = target - endS - have;
    while (need < 0 && words.length) need += sylWord(words.pop());
    var i = Math.abs(seed || 0);
    var guard = 0;
    var source = (bag && bag.length) ? bag : BAGS.neutral;
    while (need > 0 && guard < 60) {
      var word = source[i % source.length];
      var s = sylWord(word);
      if (s <= need && words.indexOf(word) === -1 && normWord(word) !== normWord(end)) {
        words.push(word);
        need -= s;
      }
      i += 1;
      guard += 1;
    }
    while (need > 0) {
      words.push('and');
      need -= 1;
    }
    words.push(end);
    return words.join(' ');
  }

  function runLine(target, moodWord, bag, seed) {
    var words = ['stay', 'stay'];
    if (moodWord && moodWord !== 'stay') words.push(moodWord);
    var end = 'soft';
    var have = sylWord(end);
    words.forEach(function (word) { have += sylWord(word); });
    var need = target - have;
    var source = bag && bag.length ? bag : BAGS.neutral;
    var i = Math.abs(seed || 0);
    var guard = 0;
    while (need > 0 && guard < 40) {
      var word = source[i % source.length];
      var s = sylWord(word);
      if (s <= need && word !== 'stay' && word !== end) {
        words.push(word);
        need -= s;
      }
      i += 1;
      guard += 1;
    }
    while (need > 0) {
      words.push('and');
      need -= 1;
    }
    words.push(end);
    return words.join(' ');
  }

  function takeUnique(rules, count) {
    if (!rules._endAt) rules._endAt = 0;
    var out = [];
    var i;
    for (i = 0; i < count; i++) {
      out.push(UNIQUE_ENDS[rules._endAt % UNIQUE_ENDS.length]);
      rules._endAt += 1;
    }
    return out;
  }

  function schemeEnds(scheme, count, seed) {
    var tightA = ['stay', 'play'];
    var tightB = ['block', 'clock'];
    var loose = [
      ['sand', 'road'], ['kick', 'truck'], ['cup', 'stop'], ['bus', 'plus'],
      ['fog', 'bag'], ['glow', 'snow'], ['club', 'grab'], ['box', 'fix'],
    ];
    var out = [];
    var i;
    if (scheme === 'abab') {
      for (i = 0; i < count; i++) out.push(i % 2 === 0 ? tightA[Math.floor(i / 2) % 2 === 0 ? 0 : 1] : tightB[Math.floor(i / 2) % 2 === 0 ? 0 : 1]);
      // 0 stay, 1 block, 2 play, 3 clock, 4 stay, 5 block...
      out = [];
      for (i = 0; i < count; i++) {
        var pair = Math.floor(i / 2) % 2;
        if (i % 2 === 0) out.push(pair === 0 ? 'stay' : 'play');
        else out.push(pair === 0 ? 'block' : 'clock');
      }
      // That is AABB-ish. Force ABAB explicitly.
      out = [];
      var a = ['stay', 'play', 'day', 'way'];
      var b = ['block', 'clock', 'lock', 'rock'];
      for (i = 0; i < count; i++) {
        if (i % 2 === 0) out.push(a[Math.floor(i / 2) % a.length]);
        else out.push(b[Math.floor(i / 2) % b.length]);
      }
      return out;
    }
    if (scheme === 'none') {
      for (i = 0; i < count; i++) out.push(UNIQUE_ENDS[(seed + i) % UNIQUE_ENDS.length]);
      return out;
    }
    if (scheme === 'loose') {
      for (i = 0; i < count; i++) {
        var pair = loose[(Math.floor(i / 2) + seed) % loose.length];
        out.push(pair[i % 2]);
      }
      return out;
    }
    for (i = 0; i < count; i++) {
      var group = Math.floor(i / 2) % 2;
      var side = i % 2;
      out.push(group === 0 ? tightA[side] : tightB[side]);
    }
    return out;
  }

  function structureFor(shape) {
    if (shape === 'short') return ['verse', 'chorus', 'verse', 'chorus'];
    if (shape === 'hook') return ['chorus', 'verse', 'chorus', 'verse', 'chorus'];
    return ['verse', 'lift', 'chorus', 'verse', 'chorus', 'bridge', 'chorus'];
  }

  function sectionLabel(kind, index) {
    if (kind === 'verse') return 'Verse ' + index.verse;
    if (kind === 'chorus') return 'Chorus';
    if (kind === 'lift') return 'Lift';
    if (kind === 'bridge') return 'Bridge';
    return kind;
  }

  function userBlob(brief) {
    return [brief.title, brief.scene, brief.addressee, brief.story, brief.scenePlace, brief.sceneObject, brief.sceneQuote].join(' ').toLowerCase();
  }

  function feelingAllowed(name, brief) {
    var blob = userBlob(brief);
    return blob.indexOf(String(name || '').toLowerCase()) !== -1;
  }

  function lineDirty(line, brief) {
    var text = String(line || '');
    var low = text.toLowerCase();
    var intent = String(brief.intent_private || '').trim().toLowerCase();
    if (intent && intent.length > 3 && low.indexOf(intent) !== -1) return true;
    if (/\bi want this song\b/.test(low) || /\bmake them\b/.test(low) || /\bthis song\b/.test(low)) return true;
    var i;
    for (i = 0; i < FEELINGS.length; i++) {
      var name = FEELINGS[i];
      var re = new RegExp('\\b' + name.toLowerCase() + '\\b', 'i');
      if (re.test(text) && !feelingAllowed(name, brief)) return true;
    }
    for (i = 0; i < BANNED.length; i++) {
      if (BANNED[i].re.test(text) && userBlob(brief).indexOf(BANNED[i].label) === -1) return true;
    }
    if (brief.explicit !== 'Explicit' && SWEAR.test(text) && !SWEAR.test(userBlob(brief))) return true;
    if (ACCENT.test(text)) return true;
    return false;
  }

  function resolve(input) {
    var brief = normalize(input);
    var named = brief.genre === 'Surprise me' ? surprisePick(brief.seed + hashSeed(brief.title)) : brief.genre;
    var base = genreBase(named);
    var densityTarget = { few: 7, mid: 10, packed: 14 }[brief.advanced.density] || 0;
    var target = densityTarget || base.target;
    if (brief.advanced.speed === 'slow') target -= 2;
    if (brief.advanced.speed === 'fast') target += 2;
    target = clamp(target, 6, 16);
    var scheme = base.scheme;
    if (brief.advanced.rhymePattern === 'aabb') scheme = 'aabb';
    if (brief.advanced.rhymePattern === 'abab') scheme = 'abab';
    if (brief.advanced.rhymeTightness === 'tight') scheme = brief.advanced.rhymePattern === 'abab' ? 'abab' : 'aabb';
    if (brief.advanced.rhymeTightness === 'loose') scheme = 'loose';
    if (brief.advanced.rhymeTightness === 'none') scheme = 'none';
    var shape = brief.advanced.shape || 'full';
    var hook = base.hook;
    var story = String(brief.story || '');
    if (!brief.advanced.delivery && (story === 'Dance' || story === 'Sing along')) hook = 'chant';
    if (brief.advanced.delivery === 'chant') hook = 'chant';
    if (brief.advanced.delivery === 'call') hook = 'call';
    if (brief.advanced.delivery === 'spoken') scheme = 'none';
    var pov = brief.advanced.pov || (personAddressee(brief.addressee) ? 'you' : '');
    return {
      brief: brief,
      genreUsed: named,
      target: target,
      verseLines: base.verse,
      lexicon: base.lexicon,
      hook: hook,
      scheme: scheme,
      shape: shape,
      internal: base.internal || brief.advanced.delivery === 'rapped',
      vowels: base.vowels || brief.advanced.delivery === 'sung',
      place: !!base.place,
      lift: !!base.lift || brief.advanced.delivery === 'sung' && named === 'Gospel',
      gospelLift: !!base.lift,
      pov: pov,
      youEarly: pov === 'you',
    };
  }

  function personAddressee(value) {
    return value === 'Someone I love' || value === 'Someone I miss' || value === 'Someone I\'m done with' || value === 'love' || value === 'miss' || value === 'done';
  }

  function normalize(input) {
    var src = input || {};
    var advanced = src.advanced || {};
    var feelings = Array.isArray(src.feelings) ? src.feelings.slice(0, 2) : [];
    var genre = String(src.genre || 'Pop');
    if (GENRES.indexOf(genre) === -1) genre = 'Pop';
    return {
      title: String(src.title || '').trim(),
      scene: String(src.scene || '').trim(),
      scenePlace: String(src.scenePlace || '').trim(),
      sceneObject: String(src.sceneObject || '').trim(),
      sceneQuote: String(src.sceneQuote || '').trim(),
      addressee: String(src.addressee || '').trim(),
      story: String(src.story || '').trim(),
      feelings: feelings,
      spice: String(src.spice || '').trim(),
      genre: genre,
      language: String(src.language || 'English'),
      explicit: src.explicit === 'Explicit' ? 'Explicit' : 'Clean',
      vibe: String(src.vibe || '').trim(),
      intent_private: String(src.intent_private || src.intent || '').trim(),
      path: String(src.path || 'ai'),
      seed: Math.abs(parseInt(src.seed, 10) || 0),
      advanced: {
        delivery: advanced.delivery || '',
        rhymeTightness: advanced.rhymeTightness || advanced.rhyme_tightness || '',
        rhymePattern: advanced.rhymePattern || advanced.rhyme_scheme || '',
        density: advanced.density || advanced.syllable_density || '',
        shape: advanced.shape || advanced.song_shape || '',
        speed: advanced.speed || '',
        pov: advanced.pov || '',
      },
    };
  }

  function spreadMarkers(lexicon, lineCount) {
    var markers = (MARKERS[lexicon] || []).slice();
    var rows = [];
    var i;
    for (i = 0; i < lineCount; i++) rows.push([]);
    markers.forEach(function (word, index) {
      rows[index % lineCount].push(word);
    });
    return rows;
  }

  function commaRiddim(line) {
    var parts = String(line || '').split(/\s+/);
    if (parts.length < 3) return line;
    if (parts[0].slice(-1) === ',') return line;
    parts[0] = parts[0] + ',';
    return parts.join(' ');
  }

  function buildChorus(rules, index, chorusCount, shared) {
    var brief = rules.brief;
    var title = brief.title || 'Untitled';
    var target = rules.target;
    var bag = BAGS[rules.lexicon] || BAGS.neutral;
    var mood = moodWords(brief.feelings);
    var seed = brief.seed + index * 17;
    var lines = [];
    var crafted = function (required, end) {
      var req = (required || []).slice();
      if (mood.length) req.push(mood[(index + lines.length + brief.seed) % mood.length]);
      if (rules._youPending) {
        req.push('you');
        rules._youPending = false;
      }
      return craft(target, end || 'stay', req, bag, seed + lines.length);
    };
    lines.push(title);
    var plainEnds = rules.scheme === 'none' ? takeUnique(rules, 3) : ['day', 'way', 'say'];
    if (rules.hook === 'title3') {
      lines.push(title);
      lines.push(title);
      lines.push(crafted(rules.vowels ? ['oh'] : [], 'say'));
    } else if (rules.hook === 'run') {
      lines.push(runLine(target, mood[0], bag, seed));
      lines.push(title);
      lines.push(runLine(target, mood[1 % mood.length], bag, seed + 3));
    } else if (rules.hook === 'call' || rules.hook === 'chant') {
      if (rules.hook === 'chant') lines.push(title);
      lines.push(crafted(['say', 'it', 'back'], 'hey'));
      while (lines.length < 4) lines.push(crafted([], 'day'));
    } else if (rules.hook === 'house') {
      var hookLine = crafted(['clap', 'hands'], 'hey');
      lines.push(hookLine);
      lines.push(hookLine);
      return lines.slice(0, 3);
    } else if (rules.hook === 'shout') {
      lines.push('HEY');
      lines.push(crafted(['drive', 'push'], 'hey'));
      lines.push(crafted([], 'say'));
    } else if (rules.hook === 'refrain') {
      lines.push(title);
      lines.push(crafted(['hands'], 'day'));
      lines.push(crafted([], 'way'));
    } else if (rules.hook === 'twist' && index === chorusCount - 1) {
      lines.push(crafted(['salt', 'means'], plainEnds[0]));
      lines.push(crafted([], plainEnds[1]));
      lines.push(title);
    } else {
      lines.push(crafted([], plainEnds[0]));
      lines.push(crafted([], plainEnds[1]));
      lines.push(crafted([], plainEnds[2]));
    }
    if (brief.language === 'Spanish' || brief.language === 'Spanglish') {
      var langWord = brief.language === 'Spanish' ? 'contigo' : 'con';
      var langAt = lines.length - 1;
      while (langAt > 0 && lines[langAt] === title) langAt -= 1;
      if (lines[langAt] !== title) lines[langAt] = craft(target, 'stay', [langWord], bag, seed + 8);
    }
    if (shared) return shared.slice();
    return lines;
  }

  var PLAIN = {
    'Hip-hop': {
      joy: {
        verse: [
          'I kick the hot tape by the bus and you just stay',
          'You laugh and clap with the paper cup and you play',
          'I clock the hot booth and the pocket on the block',
          'A bright hot grin in the cipher hits the clock',
          'You laugh in the booth while I kick the tape and stay',
          'The bright sunlight and the loud clap can start to play',
          'My hot pocket and the cipher now sit on the block',
          'I clock the hot tape in the booth and face the clock',
        ],
        lift: [
          'You laugh and clap while the hot bar starts to play',
          'The bright sunlight and the loud clap can start to play',
        ],
        chorus: [
          'You laugh and clap with the paper cup and you play',
          'The bright sunlight and the loud clap can start to play',
          'You laugh in the booth while I kick the tape and stay',
        ],
        bridge: [
          'A bright grin stays with you and the bar can play',
          'You clap and the sunlight hits the booth and stays',
          'I kick the tape and the cipher finds the block',
          'The pocket and the booth both race the clock',
        ],
      },
      sad: {
        verse: [
          'I kick the cold tape by the bus and you just stay',
          'You ache and tear while the lost bar can start to play',
          'I clock the cold booth and the pocket on the block',
          'The hollow ache in the cipher hits the clock',
          'You ache in the booth while I kick the tape and stay',
          'The cold empty and the lost tear can start to play',
          'My cold pocket and the cipher now sit on the block',
          'I clock the cold tape in the booth and face the clock',
        ],
        lift: [
          'You ache and tear while the lost bar can start to play',
          'The cold empty and the lost tear can start to play',
        ],
        chorus: [
          'You ache and tear while the lost bar can start to play',
          'The hollow ache in the cipher hits the clock',
          'The cold empty and the lost tear can start to play',
        ],
        bridge: [
          'A hollow ache stays with you by the bus',
          'The empty cup is cold and the tear can stay',
          'I kick the tape and the cipher finds the block',
          'The pocket and the booth both face the clock',
        ],
      },
    },
    Country: {
      joy: {
        verse: [
          'Porch light in Tulsa feels like home',
          'Gravel road, a creek, and the truck',
          'You by the bus stop with a cup',
          'A bright grin on the Tulsa porch',
          'A bright laugh in the kitchen field',
          'You and the truck roll past the creek',
          'A bright clap under the gold lamp',
          'Bright sunlight on the Tulsa sky',
        ],
        lift: [
          'A bright laugh on the Tulsa porch',
          'You by the bus stop with a cup',
        ],
        chorus: [
          'A bright laugh on the open road',
          'You clap beside the gravel truck',
          'Bright sunlight on the Tulsa sky',
        ],
        twist: [
          'Same salt means a brand new warm home',
          'You by the bus stop with a cup',
        ],
        bridge: [
          'The kitchen holds a bright laugh now',
          'Gravel, creek, and the Tulsa truck',
          'A grin stays on the porch a while',
          'Sunlight warms the cup in your hand',
        ],
      },
      sad: {
        verse: [
          'Porch light in Tulsa feels like home',
          'Gravel road, a creek, and the truck',
          'You by the bus stop with a cup',
          'A cold ache on the Tulsa porch',
          'Hollow tear in the kitchen field',
          'You and the empty truck roll past',
          'A cold ache under the gold lamp',
          'Cold tear under the Tulsa sky',
        ],
        lift: [
          'A cold ache on the Tulsa porch',
          'You by the bus stop with a cup',
        ],
        chorus: [
          'A cold ache on the open road',
          'You ache beside the gravel truck',
          'Hollow tear under the Tulsa sky',
        ],
        twist: [
          'Same salt means a cold empty home',
          'You by the bus stop with a cup',
        ],
        bridge: [
          'The kitchen holds a hollow tear',
          'Gravel, creek, and the Tulsa truck',
          'An ache stays on the porch a while',
          'The empty cup is cold in hand',
        ],
      },
    },
  };

  function plainMood(brief) {
    var feelings = brief.feelings || [];
    if (feelings.indexOf('Heartbreak') !== -1 && feelings.indexOf('Joy') === -1) return 'sad';
    if (feelings.indexOf('Joy') !== -1) return 'joy';
    return '';
  }

  function plainOk(brief) {
    var advanced = brief.advanced || {};
    return !advanced.delivery && !advanced.rhymeTightness && !advanced.rhymePattern && !advanced.density && !advanced.shape && !advanced.speed && !advanced.pov && brief.language === 'English' && brief.explicit !== 'Explicit';
  }

  function takeBook(lines, count, cursor) {
    var out = [];
    var i;
    for (i = 0; i < count; i++) out.push(lines[(cursor + i) % lines.length]);
    return out;
  }

  function plainSections(rules, names) {
    if (!plainOk(rules.brief)) return null;
    var mood = plainMood(rules.brief);
    var book = PLAIN[rules.genreUsed] && PLAIN[rules.genreUsed][mood];
    if (!book) return null;
    var title = rules.brief.title || 'Untitled';
    var cursor = { verse: 0, chorus: 0 };
    var chorusTotal = names.filter(function (kind) { return kind === 'chorus'; }).length;
    var seen = { verse: 0, chorus: 0 };
    return names.map(function (kind) {
      var lines;
      if (kind === 'verse') {
        lines = takeBook(book.verse, rules.verseLines, cursor.verse);
        cursor.verse += rules.verseLines;
        seen.verse += 1;
      } else if (kind === 'chorus') {
        var tail = (rules.hook === 'twist' && seen.chorus === chorusTotal - 1 && book.twist) ? book.twist : book.chorus;
        lines = [title].concat(tail);
        seen.chorus += 1;
      } else if (kind === 'lift') {
        lines = book.lift.slice();
      } else {
        lines = book.bridge.slice();
      }
      return { kind: kind, label: sectionLabel(kind, { verse: seen.verse }), lines: lines };
    });
  }

  function compose(input) {
    var rules = resolve(input);
    var brief = rules.brief;
    var names = structureFor(rules.shape);
    var plain = plainSections(rules, names);
    if (plain) {
      if (rules.youEarly && !songHasYou(plain)) forceWord(plain, 'you', rules);
      plain = scrubSections(plain, brief, rules);
      return {
        title: brief.title,
        genre: brief.genre,
        genreUsed: rules.genreUsed,
        label: labelFor(brief.path),
        target: rules.target,
        scheme: rules.scheme,
        shape: rules.shape,
        hook: rules.hook,
        sections: plain,
        text: formatSong(plain),
        prompt: buildPrompt(brief, rules),
        style: stylePrompt(brief),
      };
    }
    var bag = BAGS[rules.lexicon] || BAGS.neutral;
    var mood = moodWords(brief.feelings);
    var verseMarks = spreadMarkers(rules.lexicon, rules.verseLines);
    var counts = { verse: 0, chorus: 0 };
    names.forEach(function (kind) {
      if (kind === 'verse') counts.verse += 1;
      if (kind === 'chorus') counts.chorus += 1;
    });
    var houseChorus = null;
    rules._youPending = !!rules.youEarly;
    var sections = [];
    var verseSeen = 0;
    var chorusSeen = 0;
    var placedYou = false;
    names.forEach(function (kind) {
      var lines = [];
      var labelIndex = { verse: verseSeen + 1 };
      if (kind === 'chorus') {
        lines = buildChorus(rules, chorusSeen, counts.chorus, rules.hook === 'house' ? houseChorus : null);
        if (rules.hook === 'house' && !houseChorus) houseChorus = lines.slice();
        if (rules.hook === 'house') lines = houseChorus.slice();
        chorusSeen += 1;
      } else {
        var count = kind === 'verse' ? rules.verseLines : (kind === 'lift' ? 2 : 4);
        var endScheme = kind === 'verse' ? rules.scheme : (rules.scheme === 'none' ? 'none' : 'aabb');
        var ends = endScheme === 'none' ? takeUnique(rules, count) : schemeEnds(endScheme, count, verseSeen * 4 + brief.seed);
        var n;
        for (n = 0; n < count; n++) {
          var required = [];
          if (kind === 'verse' && verseMarks[n]) required = required.concat(verseMarks[n]);
          if (mood.length) required.push(mood[(brief.seed + n + verseSeen) % mood.length]);
          if (rules.place && kind === 'verse' && n === 0) required.push('tulsa');
          if (rules.internal && kind === 'verse' && n === 1) required.push('block', 'cape');
          if (rules.vowels && kind === 'lift' && n === 0) required.push('oh');
          if (brief.advanced.delivery === 'sung' && n === 0) required.push('oh');
          if (brief.advanced.delivery === 'spoken' && kind === 'verse' && n === 0) required.push('said');
          if (brief.explicit === 'Explicit' && kind === 'verse' && verseSeen === 0 && n === 0) required.push('damn');
          if (rules.gospelLift && kind === 'bridge' && n === 0) required.push('lift');
          if ((rules.lexicon === 'hiphop' || rules.hook === 'punch') && kind === 'verse' && n === count - 1) required.push('but');
          if (rules.place && kind === 'verse' && n === count - 1) required.push('but');
          var sceneBit = '';
          if (kind === 'verse' && verseSeen === 0 && n === 0 && brief.scene) sceneBit = 'bus';
          if (sceneBit) required.push(sceneBit);
          if (kind === 'verse' && verseSeen === 0 && n === 2 && brief.scene) required.push('paper', 'cup');
          var povWord = '';
          if (rules._youPending) {
            required.push('you');
            rules._youPending = false;
            placedYou = true;
          } else if (!placedYou && kind !== 'chorus') {
            if (rules.pov === 'you') povWord = 'you';
            else if (rules.pov === 'them') povWord = 'them';
            else if (rules.pov === 'we') povWord = 'we';
            else if (rules.pov === 'story') povWord = 'Mina';
            if (povWord) {
              required.push(povWord);
              placedYou = true;
            }
          }
          var end = ends[n] || 'stay';
          if (rules.internal && kind === 'verse' && n === 1) end = 'clock';
          var line = craft(rules.target, end, required, bag, brief.seed + n * 3 + verseSeen * 11);
          if (rules.hook === 'riddim' || rules.lexicon === 'reggae') line = commaRiddim(line);
          lines.push(line);
        }
        if (kind === 'verse') verseSeen += 1;
      }
      sections.push({
        kind: kind,
        label: sectionLabel(kind, labelIndex),
        lines: lines,
      });
    });
    if (rules.youEarly && !songHasYou(sections)) {
      forceWord(sections, 'you', rules);
    }
    sections = scrubSections(sections, brief, rules);
    var text = formatSong(sections);
    return {
      title: brief.title,
      genre: brief.genre,
      genreUsed: rules.genreUsed,
      label: labelFor(brief.path),
      target: rules.target,
      scheme: rules.scheme,
      shape: rules.shape,
      hook: rules.hook,
      sections: sections,
      text: text,
      prompt: buildPrompt(brief, rules),
      style: stylePrompt(brief),
    };
  }

  function songHasYou(sections) {
    var lines = [];
    sections.forEach(function (section) {
      section.lines.forEach(function (line) { lines.push(line); });
    });
    return lines.slice(0, 4).some(function (line) { return /\byou\b/i.test(line); });
  }

  function forceWord(sections, word, rules) {
    var i;
    for (i = 0; i < sections.length; i++) {
      var section = sections[i];
      var n;
      for (n = 0; n < section.lines.length; n++) {
        if (section.lines[n] === rules.brief.title) continue;
        if (syllableCount(word + ' ' + section.lines[n]) > rules.target + 2) {
          section.lines[n] = craft(rules.target, 'stay', [word], BAGS[rules.lexicon], rules.brief.seed);
        } else if (!new RegExp('\\b' + word + '\\b', 'i').test(section.lines[n])) {
          section.lines[n] = word + ' ' + section.lines[n];
        }
        return;
      }
    }
  }

  function scrubSections(sections, brief, rules) {
    return sections.map(function (section) {
      return {
        kind: section.kind,
        label: section.label,
        lines: section.lines.map(function (line, index) {
          if (!lineDirty(line, brief)) return line;
          if (line === brief.title) return line;
          return craft(rules.target, 'stay', [], BAGS.neutral, brief.seed + index + 9);
        }),
      };
    });
  }

  function formatSong(sections) {
    return sections.map(function (section) {
      return '[' + section.label + ']\n' + section.lines.join('\n');
    }).join('\n\n');
  }

  function labelFor(path) {
    if (path === 'human') return 'Human';
    if (path === 'together') return 'AI-assisted';
    return 'Fully AI';
  }

  function madeHow(label) {
    if (label === 'Human') return 'no_ai';
    if (label === 'AI-assisted') return 'ai_assisted';
    return 'fully_ai';
  }

  function buildPrompt(brief, rules) {
    var rule = rules || resolve(brief);
    var feelingLine = (brief.feelings || []).join(', ') || 'unspecified';
    return [
      'Write an original song.',
      'Genre: ' + rule.genreUsed + '.',
      'About ' + rule.target + ' syllables a line.',
      'Rhyme scheme: ' + rule.scheme + '.',
      'Hook shape: ' + rule.hook + '.',
      'Title, exact, in the first or last line of every chorus: ' + (brief.title || 'Untitled') + '.',
      'Scene details to keep when they fit: ' + (brief.scene || 'none') + '.',
      'Feeling (private, never sung): ' + feelingLine + '.',
      'Show the feeling through details.',
      'Never write the feeling name, "this song", or "make them" unless the user wrote those words.',
      'Avoid neon, shadows, whispers, echoes, embers, velvet, rise above, stories untold, and in the night.',
      'Point of view: ' + (rule.pov || 'open') + '.',
      'Language: ' + brief.language + '.',
      'Clean or explicit: ' + brief.explicit + '.',
    ].join(' ');
  }

  function stylePrompt(input, tweak) {
    var brief = normalize(input);
    var named = brief.genre === 'Surprise me' ? surprisePick(brief.seed + hashSeed(brief.title)) : brief.genre;
    var speed = brief.advanced.speed || 'medium';
    var bits = [
      named,
      brief.vibe || 'steady',
      (brief.feelings || []).join(' and '),
      speed + ' tempo',
      brief.explicit === 'Explicit' ? 'explicit language allowed' : 'clean',
      brief.language,
    ].filter(Boolean);
    if (tweak === 'more-energy') bits.push('more energy');
    if (tweak === 'softer') bits.push('softer');
    if (tweak === 'different-voice') bits.push('a different voice');
    if (tweak === 'more-instruments') bits.push('more instruments');
    return bits.join(', ') + '.';
  }

  function metrics(text) {
    var lines = contentLines(text);
    var scored = lines.filter(function (line) { return line !== 'HEY'; });
    var titled = {};
    var syls = [];
    scored.forEach(function (line) {
      syls.push(syllableCount(line));
    });
    var mean = syls.length ? syls.reduce(function (a, b) { return a + b; }, 0) / syls.length : 0;
    var keys = lines.map(function (line) { return rhymeKey(lastWord(line)); });
    var sharing = 0;
    keys.forEach(function (key, index) {
      if (!key) return;
      var hit = keys.some(function (other, j) { return j !== index && other === key; });
      if (hit) sharing += 1;
    });
    var lastMatch = 0;
    var pairs = 0;
    for (var i = 0; i < lines.length - 1; i++) {
      pairs += 1;
      var a = normWord(lastWord(lines[i]));
      var b = normWord(lastWord(lines[i + 1]));
      if (a && b && a.slice(-1) === b.slice(-1)) lastMatch += 1;
    }
    return {
      lines: lines,
      meanSyllables: mean,
      rhymeRate: lines.length ? sharing / lines.length : 0,
      lastLetterRate: pairs ? lastMatch / pairs : 0,
      tokens: tokensOf(text),
      titled: titled,
    };
  }

  function verseLinesOf(song) {
    var lines = [];
    (song.sections || []).forEach(function (section) {
      if (section.kind === 'verse') lines = lines.concat(section.lines);
    });
    return lines;
  }

  function meanOf(lines, title) {
    var use = lines.filter(function (line) {
      return line && line !== title && line !== 'HEY';
    });
    if (!use.length) return 0;
    return use.reduce(function (sum, line) { return sum + syllableCount(line); }, 0) / use.length;
  }

  var OFFER_LINES = {
    joy: [
      'You laugh and clap with the paper cup',
      'Bright sunlight hits the bus stop glass',
      'A grin stays with you on the ride',
    ],
    sad: [
      'The empty cup is cold in your hand',
      'A hollow ache stays by the bus',
      'You hold the tear and let it go',
    ],
    plain: [
      'We stood by the bus stop with the cup',
      'The paper cup was in your hand',
      'You look up and the light holds still',
    ],
  };

  function giveLines(input, userLines) {
    var brief = normalize(input);
    var rules = resolve(brief);
    var bag = BAGS[rules.lexicon] || BAGS.neutral;
    var blocked = {};
    (userLines || []).forEach(function (line) {
      blocked[String(line || '').trim().toLowerCase()] = true;
    });
    var out = [];
    var offerMood = plainMood(brief) || 'plain';
    (OFFER_LINES[offerMood] || []).forEach(function (line) {
      var key = line.trim().toLowerCase();
      if (!blocked[key] && out.indexOf(line) === -1 && !lineDirty(line, brief)) out.push(line);
    });
    var seed = brief.seed;
    var guard = 0;
    while (out.length < 3 && guard < 24) {
      var line = craft(rules.target, schemeEnds(rules.scheme, 1, seed + guard)[0] || 'stay', moodWords(brief.feelings).slice(0, 1), bag, seed + guard * 5 + 2);
      if (rules.lexicon === 'reggae') line = commaRiddim(line);
      var key = line.trim().toLowerCase();
      if (!blocked[key] && out.indexOf(line) === -1 && !lineDirty(line, brief)) out.push(line);
      guard += 1;
    }
    return out;
  }

  function finishLine(input, partial) {
    var brief = normalize(input);
    var rules = resolve(brief);
    var start = String(partial || '').trim();
    var bag = BAGS[rules.lexicon] || BAGS.neutral;
    if (!start) return craft(rules.target, 'stay', [], bag, brief.seed + 4);
    var have = syllableCount(start);
    var extra = [];
    var need = Math.max(1, rules.target - have);
    var i = 0;
    while (need > 0 && i < 20) {
      var word = bag[(brief.seed + i) % bag.length];
      var s = sylWord(word);
      if (s <= need && start.toLowerCase().indexOf(word) === -1) {
        extra.push(word);
        need -= s;
      }
      i += 1;
    }
    if (!extra.length) extra.push('today');
    var line = start + ' ' + extra.join(' ');
    if (lineDirty(line, brief)) line = start + ' today';
    return line;
  }

  function tryFix(line, kind, context) {
    var src = String(line || '').trim();
    var ctx = context || {};
    var words = src.split(/\s+/).filter(Boolean);
    var next = src;
    if (kind === 'shorter') {
      if (words.length > 3) next = words.slice(0, Math.max(2, words.length - 2)).join(' ');
      else if (words.length > 1) next = words.slice(0, words.length - 1).join(' ');
      else next = src + ' cut';
    } else if (kind === 'rhyme') {
      var end = normWord(lastWord(ctx.withLine || src));
      var partner = 'day';
      Object.keys(RHYME_FAMILY).forEach(function (word) {
        if (word !== end && RHYME_FAMILY[word] === (RHYME_FAMILY[end] || 'ay') && partner === 'day') partner = word;
      });
      if (!words.length) next = partner;
      else {
        words[words.length - 1] = partner;
        next = words.join(' ');
      }
      if (normWord(lastWord(next)) === normWord(lastWord(src))) {
        words[words.length - 1] = 'play';
        next = words.join(' ');
      }
    } else if (kind === 'catchier') {
      var title = String(ctx.title || '').trim();
      if (title && src.indexOf(title) === -1) next = title + '. ' + src;
      else if (words.length) next = words[0] + ' ' + words[0] + ' ' + src;
      else next = 'hey hey';
    } else if (kind === 'less-cheesy') {
      next = src
        .replace(/\bneon\b/ig, 'plain')
        .replace(/\bshadows\b/ig, 'shade')
        .replace(/\bwhispers\b/ig, 'talk')
        .replace(/\bechoes\b/ig, 'calls')
        .replace(/\bembers\b/ig, 'coals')
        .replace(/\bvelvet\b/ig, 'soft')
        .replace(/rise above/ig, 'get up')
        .replace(/stories untold/ig, 'old news')
        .replace(/in the night/ig, 'today');
      if (next === src) next = src.replace(/\b(very|really|beautiful|destiny)\b/ig, 'plain');
    }
    if (next.trim().toLowerCase() === src.toLowerCase()) next = src + ' now';
    return { line: next.trim(), changed: next.trim().toLowerCase() !== src.toLowerCase() };
  }

  function guardText(text, input) {
    var brief = normalize(input);
    var rules = resolve(brief);
    var kept = String(text || '').split('\n').map(function (line) {
      if (!line.trim() || line.trim().charAt(0) === '[') return line;
      if (!lineDirty(line, brief)) return line;
      if (line.trim() === brief.title) return line;
      return craft(rules.target, 'stay', [], BAGS.neutral, brief.seed + 3);
    });
    return kept.join('\n');
  }

  function isLabel(line) {
    var text = String(line || '').trim();
    var bracket = text.match(/^\[([^\]]+)\]$/);
    if (bracket) return bracket[1].trim();
    var plain = text.match(/^(verse\s*\d*|chorus|pre-chorus|lift|bridge|final chorus)\s*:?$/i);
    return plain ? plain[1].trim() : '';
  }

  function kindOfLabel(label) {
    var low = String(label || '').toLowerCase();
    if (low.indexOf('chorus') !== -1) return 'chorus';
    if (low.indexOf('bridge') !== -1) return 'bridge';
    if (low.indexOf('lift') !== -1 || low.indexOf('pre') !== -1) return 'lift';
    return 'verse';
  }

  function labeledBlocks(text) {
    var blocks = [];
    var current = null;
    String(text || '').split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var label = isLabel(line);
      if (label) {
        current = { label: label, kind: kindOfLabel(label), lines: [] };
        blocks.push(current);
        return;
      }
      if (!current) {
        current = { label: 'Verse 1', kind: 'verse', lines: [] };
        blocks.push(current);
      }
      current.lines.push(line);
    });
    return blocks;
  }

  function stripFences(text) {
    return String(text || '').replace(/```[\w]*\n?/g, '').trim();
  }

  function hookNote(rules) {
    var notes = {
      punch: 'Hip-hop hook: longer verses, internal rhyme, and a punchline turn.',
      twist: 'Country hook: plain talk, one real place, a setup then a turn. The last chorus twists the title instead of copying the first chorus.',
      title3: 'Pop hook: short lines, open vowels, and the exact title at least 3 times in the chorus.',
      run: 'R&B hook: fewer words, and a run that repeats one or two words such as "stay stay".',
      call: 'Short chantable hook with a call and a response, like "Say it back".',
      riddim: 'Riddim first. A comma can hold a word off the beat. Standard spelling only.',
      refrain: 'Gospel: a big refrain, and a lift in the bridge.',
      house: 'House: a 2 to 4 line hook that repeats identically in every chorus.',
      shout: 'Rock: a shouted HEY in the hook, and driving lines.',
      chant: 'A short chant the room can sing back.',
    };
    return notes[rules.hook] || ('Hook shape: ' + rules.hook + '.');
  }

  function genreVocab(rules) {
    var lines = {
      'Hip-hop': 'Use hip-hop vocabulary: a booth, a pocket, a block, bars, a beat. Concrete and rhythmic. Not country porch talk. Do not stack random nouns.',
      'Country': 'Use plain country vocabulary: a truck, a kitchen, a porch, a creek, and one real town name. Not hip-hop slang.',
      'Pop': 'Use simple singable words and open vowels.',
      'R&B': 'Use fewer words. Leave space. Stay close and slow.',
      'Afrobeats': 'Use a short chant the room can answer.',
      'Reggaeton': 'Use a short chant and a call back.',
      'Reggae': 'Use bass, riddim, and one drop. No fake accent spelling.',
      'Rock': 'Use drive, push, and loud.',
      'Gospel': 'Use lift, home, and a refrain people can sing back.',
      'House': 'Use a repeated dance instruction. Keep the hook identical.',
    };
    return lines[rules.genreUsed] || ('Use words that belong to ' + rules.genreUsed + '.');
  }

  function writerInstructions(input, failures) {
    var rules = resolve(input);
    var brief = rules.brief;
    var advanced = brief.advanced || {};
    var names = structureFor(rules.shape);
    var shapeLine = names.map(function (kind, index) {
      var verse = names.slice(0, index + 1).filter(function (item) { return item === 'verse'; }).length;
      return '[' + sectionLabel(kind, { verse: verse || 1 }) + ']';
    }).join(', ');
    var lines = [
      buildPrompt(brief, rules),
      'Line length: about ' + rules.target + ' syllables on verse lines.',
      'Rhyme rate: scheme ' + rules.scheme + '.',
      hookNote(rules),
      genreVocab(rules),
      'Advanced settings, follow these:',
      'Delivery: ' + (advanced.delivery || 'default for the genre') + '.',
      'Rhyme tightness: ' + (advanced.rhymeTightness || 'default for the genre') + '.',
      'Rhyme pattern: ' + (advanced.rhymePattern || rules.scheme) + '.',
      'Words per line: ' + (advanced.density || ('about ' + rules.target + ' syllables')) + '.',
      'Song shape: ' + rules.shape + '.',
      'Speed: ' + (advanced.speed || 'medium') + '.',
      'Point of view: ' + (rules.pov || 'open') + '.',
      'Sections in this order: ' + shapeLine + '.',
      'Output only the lyric. Use those section labels.',
      'The exact title is its own line, the first or last line of every chorus. Do not change a letter of the title.',
      'Do not repeat a whole verse.',
      'The private aim is context only. Never sing it, and never write the words "this song" or "make them".',
    ];
    if (failures && failures.length) {
      lines.push('The last draft failed these rules. Fix every one:');
      failures.forEach(function (failure) { lines.push(failure); });
    }
    return lines.join('\n');
  }

  function wordHits(text, words) {
    return (words || []).filter(function (word) {
      return new RegExp('\\b' + word + '\\b', 'i').test(text);
    }).length;
  }

  function auditDraft(text, input) {
    var brief = normalize(input);
    var rules = resolve(brief);
    var failures = [];
    var body = String(text || '');
    var title = brief.title;
    if (!body.trim()) failures.push('The draft was empty. Write the full lyric.');
    if (brief.intent_private && countIntent(body, brief.intent_private) > 0) {
      failures.push('The private aim was sung. Take it out.');
    }
    if (/\bthis song\b/i.test(body) || /\bmake them\b/i.test(body)) {
      failures.push('Do not write "this song" or "make them".');
    }
    FEELINGS.forEach(function (name) {
      var re = new RegExp('\\b' + name + '\\b', 'i');
      if (re.test(body) && !feelingAllowed(name, brief)) {
        failures.push('Do not sing the feeling name ' + name + '. Show it through details.');
      }
    });
    BANNED.forEach(function (item) {
      if (item.re.test(body) && userBlob(brief).indexOf(item.label) === -1) {
        failures.push('Drop the cliche "' + item.label + '".');
      }
    });
    var blocks = labeledBlocks(body);
    var choruses = blocks.filter(function (block) { return block.kind === 'chorus'; });
    if (title) {
      if (!choruses.length) failures.push('Add a [Chorus]. Put the exact title "' + title + '" on the first or last line.');
      choruses.forEach(function (block, index) {
        var rows = block.lines;
        var first = rows[0] || '';
        var last = rows.length ? rows[rows.length - 1] : '';
        if (first !== title && last !== title) {
          failures.push('Chorus ' + (index + 1) + ' must start or end with the exact title "' + title + '".');
        }
      });
    }
    var verses = [];
    blocks.forEach(function (block) {
      if (block.kind === 'verse') verses = verses.concat(block.lines);
    });
    var mean = meanOf(verses, title);
    if (!verses.length) failures.push('Add a [Verse] with lines around ' + rules.target + ' syllables.');
    else if (mean < rules.target - 3 || mean > rules.target + 3) {
      failures.push('Verse lines should be about ' + rules.target + ' syllables. These averaged ' + mean.toFixed(1) + '.');
    }
    var rhyme = metrics(verses.filter(function (line) { return line !== title; }).join('\n')).rhymeRate;
    if ((rules.scheme === 'aabb' || rules.scheme === 'abab') && rhyme < 0.4) {
      failures.push('Rhyme scheme ' + rules.scheme + ' is too loose. Pair the line endings.');
    }
    if (rules.scheme === 'none' && verses.length > 2 && rhyme > 0.75) {
      failures.push('Rhyme is too tight for this genre. Loosen the endings.');
    }
    if (rules.hook === 'title3') {
      var titleHits = 0;
      choruses.forEach(function (block) {
        block.lines.forEach(function (line) { if (line === title) titleHits += 1; });
      });
      if (titleHits < 3) failures.push('The chorus needs the exact title at least 3 times.');
    }
    if (rules.hook === 'house' && choruses.length > 1) {
      var hook = choruses[0].lines.join('\n');
      var same = choruses.every(function (block) { return block.lines.join('\n') === hook; });
      if (!same) failures.push('Every chorus must repeat the same hook lines.');
    }
    if (rules.hook === 'twist' && choruses.length > 1) {
      if (choruses[0].lines.join('\n') === choruses[choruses.length - 1].lines.join('\n')) {
        failures.push('The last chorus must twist the title. Do not copy the first chorus.');
      }
    }
    if (rules.hook === 'shout' && !/\bHEY\b/.test(body)) failures.push('Put a shouted HEY in the hook.');
    if (rules.hook === 'run') {
      var run = body.split('\n').some(function (line) { return /(\b[a-z]{2,}\b)\s+\1\b/i.test(line); });
      if (!run) failures.push('Add a run that repeats one or two words.');
    }
    if (rules.hook === 'call' && !/say it back/i.test(body)) failures.push('Add a call and response, "Say it back".');
    if (rules.youEarly) {
      var early = contentLines(body).slice(0, 4).join(' ');
      if (!/\byou\b/i.test(early)) failures.push('Say "you" in the first four lines.');
    }
    if (rules.place) {
      var places = body.match(/\b[A-Z][a-z]{2,}\b/g) || [];
      var titleWords = {};
      String(title || '').split(/\s+/).forEach(function (word) { titleWords[word] = true; });
      var named = places.filter(function (word) {
        return !titleWords[word] && word !== 'Verse' && word !== 'Chorus' && word !== 'Bridge' && word !== 'Lift' && word !== 'Final';
      });
      if (!named.length) failures.push('Name one real place.');
    }
    if (rules.lexicon === 'hiphop' && wordHits(body, MARKERS.country) >= 3 && wordHits(body, MARKERS.hiphop) === 0) {
      failures.push('These lines use country words. Rewrite them with hip-hop vocabulary.');
    }
    if (rules.lexicon === 'country' && wordHits(body, MARKERS.hiphop) >= 3 && wordHits(body, MARKERS.country) === 0) {
      failures.push('These lines use hip-hop words. Rewrite them as plain country talk.');
    }
    return { ok: failures.length === 0, failures: failures };
  }

  function songFromText(text, input) {
    var rules = resolve(input);
    var brief = rules.brief;
    var blocks = labeledBlocks(text);
    if (!blocks.length) blocks = [{ kind: 'verse', label: 'Verse 1', lines: contentLines(text) }];
    var sections = blocks.map(function (block) {
      return { kind: block.kind, label: block.label, lines: block.lines.slice() };
    });
    return {
      title: brief.title,
      genre: brief.genre,
      genreUsed: rules.genreUsed,
      label: labelFor(brief.path),
      target: rules.target,
      scheme: rules.scheme,
      shape: rules.shape,
      hook: rules.hook,
      sections: sections,
      text: String(text || '').trim(),
      prompt: writerInstructions(input),
      style: stylePrompt(brief),
      source: 'model',
      sample: false,
      notice: '',
      retried: false,
    };
  }

  function settleDraft(firstText, retryText, input) {
    var cleanedFirst = stripFences(firstText);
    var audit = auditDraft(cleanedFirst, input);
    var used = cleanedFirst;
    var retried = false;
    if (!audit.ok && retryText != null) {
      retried = true;
      var cleanedRetry = stripFences(retryText);
      if (cleanedRetry) used = cleanedRetry;
    }
    var guarded = guardText(used, input);
    var song = songFromText(guarded, input);
    song.retried = retried;
    song.source = 'model';
    song.sample = false;
    song.notice = '';
    return { song: song, audit: audit, retried: retried };
  }

  function samplePack(input) {
    var song = compose(input);
    song.source = 'sample';
    song.sample = true;
    song.notice = SAMPLE_NOTICE;
    song.retried = false;
    return song;
  }

  function countIntent(text, intent) {
    var needle = String(intent || '').trim().toLowerCase();
    if (!needle) return 0;
    var hay = String(text || '').toLowerCase();
    var n = 0;
    var at = 0;
    while (at >= 0) {
      at = hay.indexOf(needle, at);
      if (at === -1) break;
      n += 1;
      at += needle.length;
    }
    return n;
  }

  return {
    FREE_AI_WRITES: FREE_AI_WRITES,
    CREDIT_COST: CREDIT_COST,
    SAMPLE_NOTICE: SAMPLE_NOTICE,
    DEFAULT_MUSIC_APP: DEFAULT_MUSIC_APP,
    PARODY_MIXES: PARODY_MIXES,
    GENRES: GENRES,
    FEELINGS: FEELINGS,
    BANNED: BANNED,
    sylWord: sylWord,
    syllableCount: syllableCount,
    rhymeKey: rhymeKey,
    genreBase: genreBase,
    normalize: normalize,
    resolve: resolve,
    compose: compose,
    buildPrompt: buildPrompt,
    stylePrompt: stylePrompt,
    metrics: metrics,
    verseLinesOf: verseLinesOf,
    meanOf: meanOf,
    giveLines: giveLines,
    finishLine: finishLine,
    tryFix: tryFix,
    guardText: guardText,
    lineDirty: lineDirty,
    countIntent: countIntent,
    writerInstructions: writerInstructions,
    auditDraft: auditDraft,
    settleDraft: settleDraft,
    samplePack: samplePack,
    songFromText: songFromText,
    labelFor: labelFor,
    madeHow: madeHow,
    contentLines: contentLines,
    tokensOf: tokensOf,
  };
});
