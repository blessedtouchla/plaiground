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

  function spellRime(word) {
    var w = normWord(word);
    if (!w) return '';
    var suffix = '';
    var stem = w;
    var ing = w.match(/^(.*)(ing)$/);
    if (ing && ing[1].length >= 3 && /[aeiouy]/.test(ing[1])) {
      stem = ing[1];
      suffix = 'ing';
    } else if (/[aeiouy][^aeiouy]y$/.test(w) && w.length > 4) {
      stem = w.slice(0, -2);
      suffix = 'i';
    }
    stem = stem
      .replace(/ph/g, 'f')
      .replace(/ght/g, 't')
      .replace(/kn/g, 'n')
      .replace(/wr/g, 'r')
      .replace(/tch/g, 'ch')
      .replace(/dge/g, 'j')
      .replace(/tion/g, 'shun')
      .replace(/sion/g, 'zhun')
      .replace(/igh/g, 'i')
      .replace(/eigh/g, 'a')
      .replace(/ck/g, 'k')
      .replace(/ee/g, 'i')
      .replace(/ea/g, 'e')
      .replace(/oo/g, 'u')
      .replace(/ai/g, 'a')
      .replace(/ay/g, 'a')
      .replace(/ey/g, 'a')
      .replace(/oa/g, 'o')
      .replace(/ow/g, 'o')
      .replace(/ou/g, 'o')
      .replace(/au/g, 'o')
      .replace(/aw/g, 'o');
    if (stem.length > 3 && /e$/.test(stem) && !/le$/.test(stem)) stem = stem.slice(0, -1);
    var idx = -1;
    var i;
    for (i = stem.length - 1; i >= 0; i--) {
      if ('aeiou'.indexOf(stem.charAt(i)) !== -1) { idx = i; break; }
    }
    if (idx === -1) return (stem || w) + suffix;
    while (idx > 0 && 'aeiou'.indexOf(stem.charAt(idx - 1)) !== -1) idx -= 1;
    if (suffix === 'i') return stem.charAt(idx) + 'i';
    return stem.slice(idx) + suffix;
  }

  function rhymeKey(word) {
    var w = normWord(word);
    if (!w) return '';
    var sounded = spellRime(w);
    if (sounded) return sounded;
    return RHYME_FAMILY[w] || w;
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
      'Country': { target: 8, verse: 4, lexicon: 'country', hook: 'twist', scheme: 'loose', place: true },
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
    return [brief.title, brief.scene, brief.addressee, brief.story, brief.vibe, brief.spice, brief.chorus, brief.verse, brief.scenePlace, brief.sceneObject, brief.sceneQuote].join(' ').toLowerCase();
  }

  function feelingAllowed(name, brief) {
    if (userBlob(brief).indexOf(String(name || '').toLowerCase()) !== -1) return true;
    var picked = brief.feelings || [];
    var i;
    for (i = 0; i < picked.length; i++) {
      if (String(picked[i]).toLowerCase() === String(name || '').toLowerCase()) return false;
    }
    return true;
  }

  function feelingForms(name) {
    var low = String(name || '').toLowerCase();
    var forms = {
      heartbreak: ['heartbreak', 'heartbroken', 'heart broken', 'heart-broken'],
      funny: ['funny'],
      nostalgia: ['nostalgia', 'nostalgic'],
      longing: ['longing'],
      anger: ['anger', 'angry'],
      pride: ['pride', 'proud'],
      peace: ['peace', 'peaceful'],
      hype: ['hype'],
      joy: ['joy', 'joyful', 'joyous'],
    };
    return forms[low] || [low];
  }

  function feelingExempt(line, name) {
    var low = String(line || '').toLowerCase();
    var which = String(name || '').toLowerCase();
    if (which === 'funny' && /\bfunny how\b/.test(low)) {
      return !/\bfunny\b/.test(low.replace(/\bfunny how\b/g, ' '));
    }
    if (which === 'joy' && /\bquiet joy\b/.test(low)) {
      return !/\b(joy|joyful|joyous)\b/.test(low.replace(/\bquiet joy\b/g, ' '));
    }
    return false;
  }

  function pickedFeelingHit(line, brief) {
    var picked = brief.feelings || [];
    var i;
    var j;
    for (i = 0; i < picked.length; i++) {
      if (FEELINGS.indexOf(picked[i]) === -1) continue;
      if (feelingAllowed(picked[i], brief)) continue;
      if (feelingExempt(line, picked[i])) continue;
      var forms = feelingForms(picked[i]);
      for (j = 0; j < forms.length; j++) {
        var re = new RegExp('\\b' + forms[j].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        if (re.test(line)) return picked[i];
      }
    }
    return '';
  }

  function aboutSong(text) {
    var low = String(text || '');
    if (/\bthis song\b/i.test(low)) return true;
    if (/\bmake them\b/i.test(low)) return true;
    if (/\bturn this into a song\b/i.test(low)) return true;
    if (/\bturn\b[^.\n]{0,60}\binto (a )?song\b/i.test(low)) return true;
    if (/\b(write|writes|writing|wrote)\b/i.test(low)) return true;
    return false;
  }

  function lineDirty(line, brief) {
    var text = String(line || '');
    var low = text.toLowerCase();
    var intent = String(brief.intent_private || '').trim().toLowerCase();
    if (intent && intent.length > 3 && low.indexOf(intent) !== -1) return true;
    if (aboutSong(low)) return true;
    if (pickedFeelingHit(text, brief)) return true;
    var i;
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
      chorus: String(src.chorus || '').trim(),
      verse: String(src.verse || '').trim(),
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
    var out = bits.join(', ');
    var pc = typeof module === 'object' && module.exports ? (function () { try { return require('./prompt-check'); } catch (e) { return null; } })() : (typeof window !== 'undefined' ? window.PromptCheck : null);
    if (pc) out = pc.checkStyle(out, {}).style;
    return out + '.';
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

  function badSpans(brief) {
    var spans = [];
    var intent = String(brief.intent_private || '').trim();
    if (intent.length > 3) spans.push(intent);
    spans.push('i want this song', 'this song', 'make them');
    BANNED.forEach(function (item) {
      if (userBlob(brief).indexOf(item.label) === -1) spans.push(item.label);
    });
    (brief.feelings || []).forEach(function (name) {
      if (feelingAllowed(name, brief)) return;
      feelingForms(name).forEach(function (form) { spans.push(form); });
    });
    if (brief.explicit !== 'Explicit' && !SWEAR.test(userBlob(brief))) {
      spans.push('damn', 'hell', 'shit', 'fuck', 'ass');
    }
    spans.push('dem', 'yuh', 'inna', 'wah', 'irie');
    spans.sort(function (a, b) { return b.length - a.length; });
    return spans;
  }

  function spanRegExp(span) {
    var esc = String(span || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!esc) return null;
    if (/\s/.test(span)) return new RegExp(esc, 'ig');
    return new RegExp('\\b' + esc + '\\b', 'ig');
  }

  function stripDirtyWords(line, brief) {
    if (aboutSong(line)) return '';
    var next = String(line || '');
    badSpans(brief).forEach(function (span) {
      var re = spanRegExp(span);
      if (re) next = next.replace(re, ' ');
    });
    next = next.replace(/\s+/g, ' ').replace(/^[,.;:\-]+|[,.;:\-]+$/g, '').trim();
    if (!next || lineDirty(next, brief)) return '';
    var words = next.split(/\s+/).filter(Boolean);
    if (words.length < 4) return '';
    if (/^[a-z]/.test(next)) return '';
    return next;
  }

  function dirtyLines(text, input) {
    var brief = normalize(input);
    return String(text || '').split('\n').filter(function (line) {
      var trim = line.trim();
      if (!trim || trim.charAt(0) === '[') return false;
      if (trim === brief.title) return false;
      return lineDirty(trim, brief);
    });
  }

  var CRAFT_WORDS = [
    [/\bpunchlines?\b/i, 'punchline'],
    [/\bdouble[- ]time\b/i, 'double-time'],
    [/\binternal\b/i, 'internal'],
    [/\bfourth line\b/i, 'fourth line'],
    [/\bbars\b/i, 'bars'],
    [/\bflow\b/i, 'flow'],
    [/\btwists?\b/i, 'twist'],
    [/\brhymes?\b/i, 'rhyme'],
  ];

  function userTypedCraft(brief, label) {
    var blob = userBlob(brief);
    if (blob.indexOf(label) !== -1) return true;
    if (label === 'double-time' && blob.indexOf('double time') !== -1) return true;
    return false;
  }

  function sungInstructionLine(line, brief) {
    if (resolve(brief).lexicon !== 'hiphop') return false;
    var i;
    for (i = 0; i < CRAFT_WORDS.length; i++) {
      if (CRAFT_WORDS[i][0].test(line) && !userTypedCraft(brief, CRAFT_WORDS[i][1])) return true;
    }
    return false;
  }

  function wordRun(line) {
    var words = String(line || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
    var run = 1;
    var i;
    for (i = 1; i < words.length; i++) {
      if (words[i] === words[i - 1]) {
        run += 1;
        if (run >= 3) return true;
      } else run = 1;
    }
    return false;
  }

  function runawayLine(line, target) {
    var trim = String(line || '').trim();
    if (!trim || trim.charAt(0) === '[') return false;
    if (wordRun(trim)) return true;
    var cap = Math.max((target || 8) * 2, 20);
    return syllableCount(trim) > cap;
  }

  function draftHardBad(text, input) {
    var brief = normalize(input);
    var target = resolve(brief).target;
    return String(text || '').split('\n').some(function (line) {
      var trim = line.trim();
      if (!trim || trim.charAt(0) === '[') return false;
      return runawayLine(trim, target) || sungInstructionLine(trim, brief);
    });
  }

  function guardText(text, input) {
    var brief = normalize(input);
    var target = resolve(brief).target;
    var kept = String(text || '').split('\n').map(function (line) {
      var trim = line.trim();
      if (!trim || trim.charAt(0) === '[') return line;
      if (trim === brief.title) return line;
      if (runawayLine(trim, target) || sungInstructionLine(trim, brief)) return '';
      if (!lineDirty(trim, brief)) return line;
      return stripDirtyWords(trim, brief);
    }).filter(function (line) { return line !== ''; });
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

  var EXAMPLES = {
    'Hip-hop': 'The cup tips, the sign flips, you still don\'t look\nI count the blinks, you check the time, I check the clock\nI say the quiet part\nYou owe the joke, and the sound stays stuck',
    'Country': 'The jacket on the chair still smells like the fair\nI leave one glass sitting on the shelf\nI almost call you, then I leave it there\nThe minute passes and I leave the glass myself',
    'Pop': 'Oh, the paper cup\nYou held it up\nOh, the morning bus\nWe let it pass',
    'R&B': 'Stay, stay\nThe cup is warm\nSay, say\nYou meant no harm',
    'Afrobeats': 'Cup in the air, say it back\nFeet on the curb, say it back',
    'Reggaeton': 'Cup in the air, say it back\nFeet on the curb, say it back',
    'Reggae': 'One drop, the cup sits, the curb is warm\nHold the bass, let the joke land late',
    'Rock': 'HEY, the cup hits the curb\nWe drive, we push, we swerve',
    'Gospel': 'Lift the cup and let the morning in\nHome is the curb and the light stays near',
    'House': 'Hands up, cup up\nHands up, cup up',
  };

  function craftNote(rules) {
    var notes = {
      'Hip-hop': 'Hip-hop craft: match two different words inside the same line, and match endings of more than one syllable. End each 4-line group on a surprise. Do not end two lines on the same word. Pull real detail from their scene. Never write about rapping, the song, or these instructions.',
      'Country': 'Country craft: plain talk and loose rhyme (ABAB or a near rhyme). Use one place and one object from their scene. Do not list trucks, porches, creeks, and towns. The last chorus twists what the title means.',
      'Pop': 'Pop craft: short lines, open vowels, and the exact title at least 3 times in the chorus. The other chorus lines have to say something new.',
      'R&B': 'R&B craft: fewer words, and a run that repeats one or two words.',
      'Afrobeats': 'Afrobeats craft: a short chant and a call back, "Say it back".',
      'Reggaeton': 'Reggaeton craft: a short chant and a call back, "Say it back".',
      'Reggae': 'Reggae craft: riddim first. A comma can hold a word off the beat. Standard spelling only.',
      'Rock': 'Rock craft: a shouted HEY, and lines that drive and push.',
      'Gospel': 'Gospel craft: a big refrain, and a lift in the bridge.',
      'House': 'House craft: a 2 to 4 line hook that repeats the same words in every chorus.',
    };
    return notes[rules.genreUsed] || ('Write in the shape of ' + rules.genreUsed + '.');
  }

  function rhymeAsk(rules) {
    if (rules.genreUsed === 'Hip-hop') {
      if (rules.scheme === 'none') return 'Do not force the line endings to match.';
      if (rules.scheme === 'loose') return 'Pair some line endings. A near match is enough.';
      if (rules.scheme === 'abab') return 'Pair the line endings ABAB. Do not end two lines on the same word.';
      return 'Pair the line endings AABB. Do not end two lines on the same word.';
    }
    if (rules.genreUsed === 'Pop') return 'Rhyme Pop endings as AABB, ABAB, or XAXA (lines 2 and 4).';
    if (rules.scheme === 'none') return 'Do not force the line endings to rhyme.';
    if (rules.scheme === 'loose') return 'Rhyme loosely. ABAB or a near rhyme is enough.';
    if (rules.scheme === 'abab') return 'Rhyme the line endings ABAB.';
    return 'Rhyme the line endings AABB.';
  }

  var OPEN_ANGLES = [
    'Open on a sound.',
    'Open on a small action.',
    'Open on an object in their hand.',
    'Open on a time of day.',
  ];

  function openAngle(brief) {
    return OPEN_ANGLES[Math.abs(brief.seed || 0) % OPEN_ANGLES.length];
  }

  function sceneAsk(brief) {
    var scene = brief.scene || 'none';
    if (brief.path === 'together' || brief.path === 'human') {
      return 'Use the scene\'s place and object in verse 1, but do not copy this sentence word for word: ' + scene + '.';
    }
    return 'Keep at least one place or object from the scene in verse 1, and invent around it. Do not copy this sentence word for word: ' + scene + '.';
  }

  function pathNote(brief) {
    var who = brief.addressee || 'someone they did not name';
    var happened = brief.story || 'they did not say what happened';
    if (brief.path === 'together' || brief.path === 'human') {
      return 'AI-assisted. Keep their own words and details, and build around them. Singing to: ' + who + '. What happened: ' + happened + '. If they did not describe a romance or a breakup, do not invent one.';
    }
    return 'Fully AI. You may invent story, images, and details beyond the scene. Keep the title, the feeling, and the genre. Singing to: ' + who + '. What happened: ' + happened + '.';
  }

  function buildPrompt(input, rules) {
    var rule = rules || resolve(input);
    var brief = rule.brief || normalize(input);
    var advanced = brief.advanced || {};
    var names = structureFor(rule.shape);
    var shapeLine = names.map(function (kind, index) {
      var verse = names.slice(0, index + 1).filter(function (item) { return item === 'verse'; }).length;
      return '[' + sectionLabel(kind, { verse: verse || 1 }) + ']';
    }).join(', ');
    var lines = [
      'Write an original song.',
      pathNote(brief),
      'Genre: ' + rule.genreUsed + '.',
      craftNote(rule),
      'Verse lines run about ' + rule.target + ' syllables.',
      rhymeAsk(rule),
      'The exact title is its own line, the first or last line of every chorus: ' + (brief.title || 'Untitled') + '.',
      'The chorus has to say something besides the title.',
      (rule.hook === 'house' ? 'Each chorus is 2 to 4 lines.' : 'Each chorus is 4 to 6 lines.'),
      'Feeling (private, never sung as a label): ' + ((brief.feelings || []).join(', ') || 'unspecified') + '.',
      'Show that feeling through detail. Only avoid the feeling name they picked. Never write "this song", "turn this into a song", "write", or "make them".',
      'Vibe: ' + (brief.vibe || 'unspecified') + '.',
      'Spice: ' + (brief.spice || 'unspecified') + '.',
      'Opening angle: ' + openAngle(brief),
      sceneAsk(brief),
      'Avoid neon, shadows, whispers, echoes, embers, velvet, rise above, stories untold, and in the night.',
      'Avoid stock images: rain on pavement, cold coffee, tears on a sleeve, tears in the rain, and "nothing feels the same".',
      'Point of view: ' + (rule.pov || 'open') + '.',
      'Language: ' + brief.language + '.',
      'Clean or explicit: ' + brief.explicit + '.',
      'Sections in this order: ' + shapeLine + '.',
      'Output only the lyric.',
      'Example of craft only. Do not copy these lines or their topic.',
      EXAMPLES[rule.genreUsed] || EXAMPLES.Pop,
    ];
    if (brief.chorus) lines.push('Their chorus, keep these words: ' + brief.chorus);
    if (brief.verse) lines.push('Their verse, keep these words: ' + brief.verse);
    if (advanced.delivery) lines.push('Delivery: ' + advanced.delivery + '.');
    if (advanced.rhymeTightness) lines.push('Rhyme tightness: ' + advanced.rhymeTightness + '.');
    if (advanced.rhymePattern) lines.push('Rhyme pattern: ' + advanced.rhymePattern + '.');
    if (advanced.density) lines.push('Words per line: ' + advanced.density + '.');
    if (advanced.shape) lines.push('Song shape: ' + advanced.shape + '.');
    if (advanced.speed) lines.push('Speed: ' + advanced.speed + '.');
    if (advanced.pov) lines.push('Point of view setting: ' + advanced.pov + '.');
    return lines.join('\n');
  }

  function writerInstructions(input, failures) {
    var text = buildPrompt(input);
    if (failures && failures.length) {
      text += '\nThe last draft failed these rules. Fix every one:\n' + failures.join('\n');
    }
    return text;
  }

  function wordHits(text, words) {
    return (words || []).filter(function (word) {
      return new RegExp('\\b' + word + '\\b', 'i').test(text);
    }).length;
  }

  var SCENE_SKIP = {
    a: 1, an: 1, the: 1, and: 1, or: 1, but: 1, if: 1, we: 1, i: 1, you: 1, he: 1, she: 1, they: 1,
    me: 1, my: 1, your: 1, our: 1, his: 1, her: 1, their: 1, them: 1, by: 1, with: 1, at: 1, to: 1,
    of: 1, in: 1, on: 1, for: 1, from: 1, into: 1, over: 1, under: 1, about: 1, that: 1, this: 1,
    just: 1, then: 1, when: 1, while: 1, as: 1, it: 1, its: 1, stood: 1, stand: 1, standing: 1,
    was: 1, were: 1, is: 1, are: 1, be: 1, been: 1, being: 1, have: 1, had: 1, has: 1, did: 1,
    do: 1, does: 1, went: 1, go: 1, got: 1, get: 1, said: 1, say: 1, look: 1, looked: 1, hold: 1,
    held: 1, there: 1, here: 1, out: 1, up: 1, down: 1, not: 1, so: 1, too: 1, very: 1, some: 1,
  };

  function sceneNouns(brief) {
    var seen = {};
    var out = [];
    String(brief.scene || '').toLowerCase().split(/[^a-z]+/).forEach(function (word) {
      if (word.length < 3 || SCENE_SKIP[word] || seen[word]) return;
      seen[word] = true;
      out.push(word);
    });
    return out;
  }

  function firstVerseLines(text) {
    var blocks = labeledBlocks(text);
    var i;
    for (i = 0; i < blocks.length; i++) {
      if (blocks[i].kind === 'verse') return blocks[i].lines;
    }
    return [];
  }

  function sceneKept(text, input) {
    var brief = normalize(input);
    var nouns = sceneNouns(brief);
    if (!nouns.length) return { ok: true, nouns: [], missing: [] };
    var verse = firstVerseLines(text).join(' ');
    var missing = nouns.filter(function (noun) {
      return !new RegExp('\\b' + noun, 'i').test(verse);
    });
    var assisted = brief.path === 'together' || brief.path === 'human';
    var ok = assisted ? missing.length === 0 : missing.length < nouns.length;
    return { ok: ok, nouns: nouns, missing: missing, assisted: assisted };
  }

  function popRhymeOk(lines) {
    var groups = 0;
    var ok = 0;
    var i;
    for (i = 0; i + 3 < lines.length; i += 4) {
      groups += 1;
      var a = rhymeKey(lastWord(lines[i]));
      var b = rhymeKey(lastWord(lines[i + 1]));
      var c = rhymeKey(lastWord(lines[i + 2]));
      var d = rhymeKey(lastWord(lines[i + 3]));
      var xaxa = b && b === d;
      var aabb = a && a === b && c && c === d;
      var abab = a && a === c && b && b === d;
      if (xaxa || aabb || abab) ok += 1;
    }
    if (!groups) return true;
    return ok === groups;
  }

  function lineHasInternalRhyme(line) {
    var skip = {
      that: 1, this: 1, with: 1, from: 1, they: 1, them: 1, your: 1, have: 1, been: 1, were: 1,
      when: 1, what: 1, just: 1, into: 1, over: 1, about: 1, there: 1, their: 1, then: 1, than: 1,
      you: 1, the: 1, and: 1, but: 1, for: 1, like: 1, was: 1, are: 1, not: 1, his: 1, her: 1,
      she: 1, our: 1, had: 1, has: 1, did: 1, its: 1, out: 1, too: 1, all: 1,
    };
    var words = String(line || '').toLowerCase().split(/[^a-z]+/).filter(function (word) {
      return word.length >= 3 && !skip[word];
    });
    var i;
    var j;
    for (i = 0; i < words.length; i++) {
      for (j = i + 1; j < words.length; j++) {
        if (words[i] === words[j]) continue;
        var ka = rhymeKey(words[i]);
        var kb = rhymeKey(words[j]);
        if (!ka || ka !== kb || ka.length < 2) continue;
        if (ka === 'ed' || ka === 'ing') continue;
        return true;
      }
    }
    return false;
  }

  function sameEndWord(lines) {
    var i;
    var j;
    for (i = 0; i < lines.length; i++) {
      var box = Math.floor(i / 4) * 4 + 4;
      for (j = i + 1; j < lines.length && j < box; j++) {
        var a = normWord(lastWord(lines[i]));
        var b = normWord(lastWord(lines[j]));
        if (a && a === b && a.length > 2) return a;
      }
    }
    return '';
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
    if (aboutSong(body)) {
      failures.push('Do not write about the song. Drop "this song", "turn this into a song", and "write".');
    }
    var sungFeeling = {};
    contentLines(body).forEach(function (line) {
      var hit = pickedFeelingHit(line, brief);
      if (hit && !sungFeeling[hit]) {
        sungFeeling[hit] = true;
        failures.push('Do not sing the feeling name ' + hit + '. Show it through details.');
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
        var minLines = rules.hook === 'house' ? 2 : 4;
        if (rows.length < minLines || rows.length > 6) {
          failures.push('Chorus ' + (index + 1) + ' should be ' + minLines + ' to 6 lines. This one has ' + rows.length + '.');
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
    var rhymeLines = verses.filter(function (line) { return line !== title; });
    var rhyme = metrics(rhymeLines.join('\n')).rhymeRate;
    if (rules.genreUsed === 'Pop') {
      if (!popRhymeOk(rhymeLines)) {
        failures.push('Pop rhyme is too loose. Use AABB, ABAB, or XAXA (lines 2 and 4).');
      }
    } else if ((rules.scheme === 'aabb' || rules.scheme === 'abab') && rhyme < 0.4) {
      failures.push(rules.lexicon === 'hiphop'
        ? 'Pair the line endings. The pattern is too loose.'
        : 'Rhyme scheme ' + rules.scheme + ' is too loose. Pair the line endings.');
    }
    if (rules.lexicon === 'hiphop' && rhymeLines.length >= 4) {
      var internalHits = rhymeLines.filter(lineHasInternalRhyme).length;
      if (internalHits / rhymeLines.length < 0.5) {
        failures.push('At least half the verse lines should match two different words inside the same line.');
      }
      var repeated = sameEndWord(rhymeLines);
      if (repeated) failures.push('Do not end two lines on the same word ("' + repeated + '" / "' + repeated + '").');
    }
    var verseBlocks = blocks.filter(function (block) { return block.kind === 'verse'; });
    verseBlocks.forEach(function (block, index) {
      var count = block.lines.filter(function (line) { return line && line !== title; }).length;
      if (count < 4) failures.push('Verse ' + (index + 1) + ' needs at least 4 lines.');
    });
    var stacked = contentLines(body).some(function (line) { return runawayLine(line, rules.target); });
    if (stacked) failures.push('Cut any line that stacks the same word, or runs far past the usual length.');
    if (rules.scheme === 'loose' && verses.length >= 4 && rhyme < 0.25) {
      failures.push('Use a loose rhyme. Pair some of the line endings.');
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
    var sceneLine = String(brief.scene || '').trim().toLowerCase();
    var opener = (contentLines(body)[0] || '').trim().toLowerCase();
    if (sceneLine && opener === sceneLine) failures.push('Do not copy the scene sentence as a line. Keep its place and object, and write a new line.');
    var scene = sceneKept(body, brief);
    if (!scene.ok) {
      var need = scene.assisted ? scene.nouns.join(', ') : 'at least one of ' + scene.nouns.join(', ');
      failures.push('Verse 1 must keep ' + need + ' from their scene.');
    }
    if (/corner store/i.test(contentLines(body).join('\n')) && userBlob(brief).indexOf('corner store') === -1) {
      failures.push('Do not use "corner store" unless they wrote it.');
    }
    if (/^you said\b/i.test(contentLines(body)[0] || '') && userBlob(brief).indexOf('you said') === -1) {
      failures.push('Start from the opening angle instead of quoting them.');
    }
    [
      ['funny how', 'Keep "funny how" to a single line.'],
      ['hits different', 'Keep "hits different" to a single line.'],
    ].forEach(function (row) {
      var found = contentLines(body).join('\n').match(new RegExp(row[0], 'ig'));
      if (found && found.length > 1) failures.push(row[1]);
    });
    if (choruses.length && title) {
      var saidMore = choruses.some(function (block) {
        return block.lines.some(function (line) { return line && line !== title; });
      });
      if (!saidMore) failures.push('The chorus has to say something besides the title.');
    }
    var lyricBody = contentLines(body).join('\n');
    var stock = [
      [/rain on (the )?pavement/i, 'rain on pavement'],
      [/cold coffee/i, 'cold coffee'],
      [/tears on (a |my |the )?sleeve/i, 'tears on a sleeve'],
      [/tears (fall )?in the rain/i, 'tears in the rain'],
      [/nothing feels the same/i, 'nothing feels the same'],
    ];
    stock.forEach(function (row) {
      if (row[0].test(lyricBody) && userBlob(brief).indexOf(row[1]) === -1) failures.push('Drop the stock image "' + row[1] + '".');
    });
    var meta = [
      [/\bbooths?\b/i, 'booth'],
      [/\bbars\b/i, 'bars'],
      [/\bbeats?\b/i, 'beat'],
      [/\bmics?\b/i, 'mic'],
      [/\bcipher\b/i, 'cipher'],
      [/\bspit\b/i, 'spit'],
      [/\bflow\b/i, 'flow'],
      [/\bverses?\b/i, 'verse'],
      [/\brapping\b/i, 'rapping'],
      [/\binternal\b/i, 'internal'],
      [/\bpunchlines?\b/i, 'punchline'],
      [/\bdouble[- ]time\b/i, 'double-time'],
      [/\bfourth line\b/i, 'fourth line'],
      [/\btwists?\b/i, 'twist'],
      [/\brhymes?\b/i, 'rhyme'],
    ];
    if (rules.lexicon === 'hiphop') {
      var sungCraft = false;
      var quietCraft = { bars: 1, flow: 1, internal: 1, punchline: 1, 'double-time': 1, 'fourth line': 1, twist: 1, rhyme: 1 };
      meta.forEach(function (row) {
        if (!row[0].test(lyricBody) || userTypedCraft(brief, row[1])) return;
        if (quietCraft[row[1]]) {
          sungCraft = true;
          return;
        }
        failures.push('Do not write about rapping or these instructions. Drop "' + row[1] + '".');
      });
      if (sungCraft) failures.push('Do not sing the writing instructions. Talk about their scene instead.');
    }
    if (rules.lexicon === 'hiphop' && wordHits(body, MARKERS.country) >= 3) {
      failures.push('These lines use country porch talk. Stay with their scene.');
    }
    if (rules.lexicon === 'country' && wordHits(body, MARKERS.hiphop) >= 3) {
      failures.push('These lines use hip-hop slang. Stay plain.');
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

  function draftRank(text, input) {
    var audit = auditDraft(text, input);
    var dirty = dirtyLines(text, input).length;
    return { audit: audit, dirty: dirty, rank: audit.failures.length * 10 + dirty };
  }

  function settleDraft(firstText, retryText, input) {
    var first = stripFences(firstText);
    var firstRank = draftRank(first, input);
    var used = first;
    var rank = firstRank;
    var retried = false;
    if (retryText != null && String(retryText).trim()) {
      retried = true;
      var second = stripFences(retryText);
      var secondRank = draftRank(second, input);
      var firstOk = firstRank.dirty <= 1;
      var secondOk = secondRank.dirty <= 1;
      var takeSecond = false;
      if (secondOk && !firstOk) takeSecond = true;
      else if (secondOk === firstOk && secondRank.rank < firstRank.rank) takeSecond = true;
      if (takeSecond && sceneKept(first, input).ok && !sceneKept(second, input).ok) takeSecond = false;
      var firstBad = draftHardBad(first, input);
      var secondBad = draftHardBad(second, input);
      var sceneLoss = sceneKept(first, input).ok && !sceneKept(second, input).ok;
      if (takeSecond && secondBad && !firstBad) takeSecond = false;
      if (!takeSecond && firstBad && !secondBad && secondOk && !sceneLoss) takeSecond = true;
      if (takeSecond) {
        used = second;
        rank = secondRank;
      }
    }
    var song;
    if (rank.dirty > 1) {
      song = songFromText(used, input);
      song.guardError = 'More than one line broke a rule. Try the write again.';
    } else {
      song = songFromText(guardText(used, input), input);
      song.guardError = '';
    }
    song.retried = retried;
    song.source = 'model';
    song.sample = false;
    song.notice = '';
    return { song: song, audit: rank.audit, retried: retried, guardError: song.guardError };
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
