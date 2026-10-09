'use strict';

/**
 * Optional style designer.
 * Closed until someone asks. Their picks win over story clues.
 * The groove keeps one tempo. Each genre adds the sound it is known for.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StyleDesign = api;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  var LIMIT = 900;
  var TAG_CAP = 8;
  var swapsApi = loadSwaps();

  var GENRES = [
    { id: 'gospel', label: 'Gospel', bpm: 78, pace: 'slow', kit: 'soft', role: 'harmony', sound: 'choir stacks and Hammond organ', vocal: 'powerful soulful lead', arrange: 'big chorus' },
    { id: 'trap', label: 'Trap', bpm: 140, pace: 'fast', kit: 'hard', role: 'rhythm', sound: 'trap hi-hats and 808s', vocal: 'confident rap vocal', arrange: 'big chorus' },
    { id: 'bossa', label: 'Bossa nova', bpm: 112, pace: 'mid', kit: 'soft', role: 'harmony', sound: 'nylon guitar', vocal: 'hushed vocal', arrange: 'soft chorus' },
    { id: 'drill', label: 'Drill', bpm: 142, pace: 'fast', kit: 'hard', role: 'rhythm', sound: 'sliding 808s and dark hats', vocal: 'tight rap vocal', arrange: 'hard chorus' },
    { id: 'country', label: 'Country', bpm: 96, pace: 'mid', kit: 'soft', role: 'harmony', sound: 'banjo and twang', vocal: 'warm vocal', arrange: 'singalong chorus' },
    { id: 'house', label: 'House', bpm: 122, pace: 'fast', kit: 'neutral', role: 'rhythm', sound: 'four-on-the-floor and warm synth chords', vocal: 'bright vocal', arrange: 'dance chorus' },
    { id: 'doowop', label: '50s doo-wop', bpm: 86, pace: 'mid', kit: 'soft', role: 'harmony', sound: 'close chords and finger snaps', vocal: 'stacked vocal', arrange: 'catchy chorus' },
    { id: 'hiphop', label: 'Hip-hop', bpm: 92, pace: 'mid', kit: 'hard', role: 'rhythm', sound: 'boom bap drums', vocal: 'laid-back rap vocal', arrange: 'hook chorus' },
    { id: 'reggaeton', label: 'Reggaeton', bpm: 94, pace: 'mid', kit: 'neutral', role: 'rhythm', sound: 'dembow', vocal: 'rhythmic vocal', arrange: 'dance chorus' },
    { id: 'ambient', label: 'Ambient', bpm: 70, pace: 'slow', kit: 'soft', role: 'harmony', sound: 'wide pads', vocal: 'airy vocal', arrange: 'spacious chorus' },
    { id: 'afrobeats', label: 'Afrobeats', bpm: 105, pace: 'mid', kit: 'neutral', role: 'rhythm', sound: 'talking drums and guitar licks', vocal: 'warm vocal', arrange: 'dance chorus' },
    { id: 'folk', label: 'Folk', bpm: 84, pace: 'slow', kit: 'soft', role: 'harmony', sound: 'acoustic guitar', vocal: 'close vocal', arrange: 'singalong chorus' },
    { id: 'rnb', label: 'R&B', bpm: 80, pace: 'slow', kit: 'soft', role: 'harmony', sound: 'smooth electric piano', vocal: 'silky vocal', arrange: 'soft chorus' },
    { id: 'lofijazz', label: 'Lo-fi jazz', bpm: 76, pace: 'slow', kit: 'soft', role: 'harmony', sound: 'mellow keys and brushed drums', vocal: 'hushed vocal', arrange: 'soft chorus' },
    { id: 'rock', label: 'Rock', bpm: 118, pace: 'fast', kit: 'hard', role: 'rhythm', sound: 'live drums and guitar chords', vocal: 'powerful vocal', arrange: 'big chorus' },
    { id: 'pop', label: 'Pop', bpm: 108, pace: 'mid', kit: 'neutral', role: 'harmony', sound: 'bright chords', vocal: 'clear vocal', arrange: 'catchy chorus' },
    { id: 'latinguitar', label: 'Latin guitar', bpm: 100, pace: 'mid', kit: 'soft', role: 'harmony', sound: 'nylon guitar and hand percussion', vocal: 'warm vocal', arrange: 'singalong chorus' },
    { id: 'synthpop', label: 'Synth pop', bpm: 116, pace: 'mid', kit: 'neutral', role: 'rhythm', sound: 'drum machine and synth chords', vocal: 'bright vocal', arrange: 'catchy chorus' },
    { id: 'soul', label: 'Soul', bpm: 88, pace: 'mid', kit: 'soft', role: 'harmony', sound: 'warm horns', vocal: 'soulful vocal', arrange: 'big chorus' },
    { id: 'latin', label: 'Latin', bpm: 100, pace: 'mid', kit: 'neutral', role: 'rhythm', sound: 'hand percussion and warm chords', vocal: 'warm vocal', arrange: 'dance chorus' },
    { id: 'lofi', label: 'Lo-fi', bpm: 78, pace: 'slow', kit: 'soft', role: 'harmony', sound: 'soft tape and dusty drums', vocal: 'hushed vocal', arrange: 'soft chorus' },
    { id: 'indie', label: 'Indie', bpm: 112, pace: 'mid', kit: 'soft', role: 'harmony', sound: 'jangly guitar', vocal: 'close vocal', arrange: 'singalong chorus' }
  ];

  var GROUP = {
    gospel: 'soul', rnb: 'soul', soul: 'soul', doowop: 'soul',
    hiphop: 'rap', trap: 'rap', drill: 'rap',
    house: 'dance', synthpop: 'dance', pop: 'dance', reggaeton: 'dance',
    latin: 'latin', latinguitar: 'latin', bossa: 'latin', afrobeats: 'latin',
    country: 'roots', folk: 'roots', indie: 'roots', rock: 'roots',
    ambient: 'haze', lofi: 'haze', lofijazz: 'haze'
  };

  var NEAR = {
    soul: { soul: 'great', dance: 'works', haze: 'works', roots: 'works', rap: 'works', latin: 'works' },
    rap: { rap: 'great', dance: 'works', soul: 'works', latin: 'risky', roots: 'risky', haze: 'risky' },
    dance: { dance: 'great', soul: 'works', latin: 'works', rap: 'works', roots: 'works', haze: 'works' },
    latin: { latin: 'great', dance: 'works', soul: 'works', haze: 'works', roots: 'works', rap: 'risky' },
    roots: { roots: 'great', soul: 'works', dance: 'works', latin: 'works', haze: 'works', rap: 'risky' },
    haze: { haze: 'great', soul: 'works', dance: 'works', latin: 'works', roots: 'works', rap: 'risky' }
  };

  var OVERRIDES = [
    { a: 'gospel', b: 'trap', level: 'great' },
    { a: 'rnb', b: 'lofijazz', level: 'great' },
    { a: 'pop', b: 'latinguitar', level: 'great' },
    { a: 'synthpop', b: 'soul', level: 'great' },
    { a: 'rock', b: 'gospel', level: 'great' },
    { a: 'country', b: 'house', level: 'works' },
    { a: 'afrobeats', b: 'folk', level: 'works' },
    { a: 'reggaeton', b: 'ambient', level: 'works' },
    { a: 'doowop', b: 'hiphop', level: 'works' },
    { a: 'bossa', b: 'drill', level: 'risky' },
    { a: 'hiphop', b: 'soul', level: 'great' },
    { a: 'house', b: 'synthpop', level: 'great' }
  ];

  var RECIPES = [
    { name: 'gospel+trap', lead: 'gospel', flavor: 'trap' },
    { name: 'bossa nova+drill', lead: 'bossa', flavor: 'drill' },
    { name: 'country+house', lead: 'country', flavor: 'house' },
    { name: '50s doo-wop+hip hop', lead: 'doowop', flavor: 'hiphop' },
    { name: 'reggaeton+ambient', lead: 'reggaeton', flavor: 'ambient' },
    { name: 'Afrobeats+folk', lead: 'afrobeats', flavor: 'folk' },
    { name: 'R&B+lo-fi jazz', lead: 'rnb', flavor: 'lofijazz' },
    { name: 'rock+gospel', lead: 'rock', flavor: 'gospel' },
    { name: 'pop+Latin guitar', lead: 'pop', flavor: 'latinguitar' },
    { name: 'synth pop+soul', lead: 'synthpop', flavor: 'soul' }
  ];

  var ERAS = [
    { id: '50s', label: '50s' },
    { id: '60s', label: '60s' },
    { id: '70s', label: '70s' },
    { id: '80s', label: '80s' },
    { id: '90s', label: '90s' },
    { id: '2000s', label: '2000s' },
    { id: 'now', label: 'Now' },
    { id: 'future', label: 'Future' }
  ];

  var TONES = ['smooth', 'raspy', 'breathy', 'powerful', 'airy'];
  var DELIVERIES = [
    { id: 'sung', label: 'Sung' },
    { id: 'rapped', label: 'Rapped' },
    { id: 'spoken', label: 'Spoken' },
    { id: 'whispered', label: 'Whispered' },
    { id: 'response', label: 'Call and response' }
  ];
  var DISTANCES = [
    { id: 'close', label: 'Close and intimate', words: 'close and intimate' },
    { id: 'live', label: 'Big and live', words: 'big and live' }
  ];
  var RANGES = ['low', 'mid', 'high'];
  var MIXES = [
    { id: 'tape', label: 'Lo-fi tape', words: 'lo-fi tape' },
    { id: 'radio', label: 'Polished radio', words: 'polished radio' },
    { id: 'room', label: 'Live room', words: 'live room' },
    { id: 'wide', label: 'Wide and cinematic', words: 'wide and cinematic' },
    { id: 'dry', label: 'Dry and punchy', words: 'dry and punchy' }
  ];
  var MIX_DROPS = {
    tape: [/polished/, /wide mix/, /huge/],
    radio: [/lo-fi/, /tape/, /muted/],
    room: [/lo-fi/, /muted/],
    wide: [/dry/, /homey/, /\bclose\b/],
    dry: [/wide/, /cinematic/, /pad/]
  };
  var INSTRUMENTS = ['piano', 'electric piano', 'acoustic guitar', 'electric guitar', '808s', 'live drums', 'bass', 'synth', 'strings', 'handpan', 'Rhodes', 'upright bass'];
  var COMES = [
    { id: 'pocket', label: 'Same beat', line: 'Both styles play together on one shared beat.' },
    { id: 'trade', label: 'Trade off', line: 'Verses stay in one style. The chorus flips to the other.' },
    { id: 'layer', label: 'Layer them', line: 'One style\'s drums and bass sit under the other\'s tunes and singing.' },
    { id: 'colors', label: 'One leads, one colors', line: 'The first style carries the song. The other adds small touches.' },
    { id: 'drift', label: 'Slow switch', line: 'It starts in one style and drifts into the other.' },
    { id: 'collide', label: 'Collide on purpose', line: 'They clash on purpose. A bold mix.' },
    { id: 'answer', label: 'Answer each other', line: 'The styles answer each other, back and forth.' },
    { id: 'surprise', label: 'Surprise me', line: 'Plai picks the best fit for this pair.' }
  ];
  var HIT_NOTE = 'This can be hit or miss. A retry or two is normal.';
  var SCENES = [
    { id: 'sunday-kitchen', label: 'Sunday kitchen radio', words: 'warm tape tone, soft AM glow, close and homey' },
    { id: 'drive-2am', label: '2am drive', words: 'late-night glow, low headlights, muted bass' },
    { id: 'stadium-sunset', label: 'Stadium at sunset', words: 'huge live air, golden and open' },
    { id: 'tin-roof', label: 'Rain on a tin roof', words: 'soft rain-like texture, close metal ping' },
    { id: 'church-pews', label: 'Church pews on Sunday', words: 'choir pads, organ, warm room' },
    { id: 'empty-beach', label: 'Beach after the crowd', words: 'bright, breezy, soft waves' },
    { id: 'phone-dark', label: 'Phone glowing in the dark', words: 'lo-fi, muted, small speaker' },
    { id: 'empty-floor', label: 'Empty dance floor', words: 'late lights, soft echo, groove left hanging' },
    { id: 'porch-dusk', label: 'Front porch at dusk', words: 'acoustic, crickets, close' },
    { id: 'corner-store', label: 'Corner store at night', words: 'neon hum, dry, close' },
    { id: 'choir-room', label: 'Choir rehearsal', words: 'stacked voices, wooden room' },
    { id: 'subway', label: 'Subway platform', words: 'distant rumble, wide, dry' }
  ];

  function loadSwaps() {
    if (typeof require === 'function') {
      try { return require('./style-swaps'); } catch (err) {}
    }
    var host = typeof window !== 'undefined' ? window : null;
    return host && host.StyleSwaps ? host.StyleSwaps : { SWAPS: [] };
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function blank() {
    return {
      lead: '',
      flavor: '',
      third: '',
      blend: 'pocket',
      rhythm: '',
      era: '',
      tone: '',
      delivery: '',
      distance: '',
      range: '',
      accent: '',
      mix: '',
      scene: '',
      instruments: [],
      instrumental: false,
      bridge: false
    };
  }

  function active(design) {
    if (!design) return false;
    return !!((design.lead && design.flavor) || design.era || design.tone || design.delivery || design.distance || design.range || design.accent || design.mix || design.scene || (design.instruments && design.instruments.length) || design.instrumental || design.bridge);
  }

  function pairLevel(a, b) {
    if (!a || !b || a === b) return '';
    for (var i = 0; i < OVERRIDES.length; i += 1) {
      var row = OVERRIDES[i];
      if ((row.a === a && row.b === b) || (row.a === b && row.b === a)) return row.level;
    }
    var left = GROUP[a];
    var right = GROUP[b];
    if (!left || !right) return 'risky';
    if (a === 'drill' || b === 'drill') {
      var other = a === 'drill' ? right : left;
      if (other !== 'rap') return 'risky';
    }
    return (NEAR[left] && NEAR[left][right]) || 'risky';
  }

  function warning(a, b) {
    if (pairLevel(a, b) !== 'risky') return '';
    return 'These two pull in different directions. Want a bridge between them?';
  }

  function safePairs() {
    var ids = Object.keys(GROUP);
    var rows = [];
    for (var i = 0; i < ids.length; i += 1) {
      for (var j = i + 1; j < ids.length; j += 1) {
        var level = pairLevel(ids[i], ids[j]);
        if (level === 'great' || level === 'works') rows.push({ a: ids[i], b: ids[j], level: level });
      }
    }
    return rows;
  }

  function roulette(seed) {
    var list = safePairs();
    var n = Math.abs(parseInt(seed, 10) || 0) % list.length;
    return { lead: list[n].a, flavor: list[n].b, level: list[n].level };
  }

  function swapInstrument(name) {
    var key = String(name || '').toLowerCase();
    var list = (swapsApi && swapsApi.SWAPS) || [];
    for (var i = 0; i < list.length; i += 1) {
      if (String(list[i].from).toLowerCase() === key) return list[i].to;
    }
    return '';
  }

  function swapOne(instruments) {
    var list = (instruments || []).slice(0, 4);
    for (var i = 0; i < list.length; i += 1) {
      var next = swapInstrument(list[i]);
      if (!next) continue;
      if (list.some(function (name) { return String(name).toLowerCase() === next.toLowerCase(); })) continue;
      var copy = list.slice();
      copy[i] = next;
      return { instruments: copy, from: list[i], to: next };
    }
    return { instruments: list, from: '', to: '' };
  }

  function lessGeneric(design) {
    var next = blank();
    var src = design || {};
    Object.keys(next).forEach(function (key) {
      if (src[key] != null && key !== 'instruments') next[key] = src[key];
    });
    next.instruments = (src.instruments || []).slice(0, 4);
    var changes = [];
    if (!next.era || next.era === 'now') {
      next.era = '70s';
      changes.push('Era is now 70s.');
    } else if (next.era === '70s') {
      next.era = '90s';
      changes.push('Era is now 90s.');
    }
    var swapped = swapOne(next.instruments);
    if (swapped.to) {
      next.instruments = swapped.instruments;
      changes.push(labelOf(swapped.from) + ' is now ' + swapped.to + '.');
    } else if (next.instruments.length < 4) {
      next.instruments.push('handpan');
      changes.push('Added handpan.');
    }
    if (!next.tone || next.tone === 'smooth') {
      next.tone = 'breathy';
      changes.push('Vocal tone is now breathy.');
    } else if (next.tone === 'breathy') {
      next.tone = 'airy';
      changes.push('Vocal tone is now airy.');
    }
    if (!next.mix || next.mix === 'radio') {
      next.mix = 'tape';
      changes.push('Mix is now lo-fi tape.');
    } else if (next.mix === 'tape') {
      next.mix = 'dry';
      changes.push('Mix is now dry and punchy.');
    }
    return { design: next, changes: changes };
  }

  function labelOf(value) {
    var text = String(value || '');
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function capTags(list) {
    var tags = [];
    (list || []).forEach(function (value) {
      var text = String(value || '').replace(/\s+/g, ' ').trim();
      if (!text || tags.length >= TAG_CAP) return;
      var lower = text.toLowerCase();
      for (var i = 0; i < tags.length; i += 1) {
        if (tags[i].toLowerCase() === lower) return;
      }
      tags.push(text);
    });
    return tags;
  }

  function collectTags(design) {
    var row = design || {};
    var tags = [];
    var era = byId(ERAS, row.era);
    if (era) tags.push(era.label);
    var mix = byId(MIXES, row.mix);
    if (mix) tags.push(mix.words);
    if (row.bridge) tags.push('a soft bridge between them');
    var scene = byId(SCENES, row.scene);
    if (scene) scene.words.split(',').forEach(function (part) { tags.push(part); });
    return capTags(tags);
  }

  function paceOf(tempo, energy) {
    var tempoName = String(tempo || '').toLowerCase();
    var energyName = String(energy || '').toLowerCase();
    if (tempoName === 'slow' || energyName === 'low') return 'slow';
    if (tempoName === 'fast' || energyName === 'high') return 'fast';
    if (tempoName === 'mid' || energyName === 'medium' || energyName === 'building') return 'mid';
    return '';
  }

  function tempoPhrase(tempo, energy) {
    var name = tempo || ({ low: 'slow', medium: 'mid', high: 'fast', building: 'mid' })[energy] || '';
    if (name === 'slow') return 'slow tempo';
    if (name === 'mid') return 'mid tempo';
    if (name === 'fast') return 'fast tempo';
    return '';
  }

  function kitOf(list) {
    var hard = false;
    var soft = false;
    (list || []).forEach(function (name) {
      var text = String(name || '').toLowerCase();
      if (/808|distorted|heavy drum|hard drum|taiko/.test(text)) hard = true;
      if (/acoustic|rhodes|piano|guitar|handpan|cello|upright|nylon/.test(text)) soft = true;
    });
    if (hard && !soft) return 'hard';
    if (soft && !hard) return 'soft';
    return '';
  }

  function clashes(name, kit) {
    var text = String(name || '').toLowerCase();
    var hard = /808|distorted|heavy drum|hard drum/.test(text);
    var soft = /acoustic|bare guitar|soft piano|electric piano|^piano$|rhodes|nylon/.test(text);
    if (kit === 'soft' && hard) return true;
    if (kit === 'hard' && soft) return true;
    return false;
  }

  function avoidLine(pace, kit, delivery) {
    var items = ['spoken intro', 'autotune glitch', 'mismatched tempo'];
    if (delivery === 'spoken') items[0] = 'a long instrumental intro';
    if (pace === 'fast') items[2] = 'a ballad tempo';
    else if (pace === 'slow' || kit === 'soft') items[1] = 'hard 808s';
    if (kit === 'hard') items[1] = 'a soft acoustic ballad';
    return 'Avoid: ' + items.join(', ');
  }

  function soundText(value, strip) {
    var text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text || typeof strip !== 'function') return text;
    var out = strip(text);
    if (out && typeof out === 'object') {
      var next = String(out.text || '').replace(/\s+/g, ' ').trim();
      if (out.stripped && !next) return 'warm tone';
      return next;
    }
    return String(out || '').replace(/\s+/g, ' ').trim();
  }

  function touchOk(text, design) {
    var row = design || {};
    if (row.scene) return false;
    var rules = MIX_DROPS[row.mix] || [];
    for (var i = 0; i < rules.length; i += 1) {
      if (rules[i].test(text)) return false;
    }
    if (row.distance === 'close' && /huge|wide mix|anthem/.test(text)) return false;
    if (row.distance === 'live' && /intimate|homey|\bclose\b|sparse/.test(text)) return false;
    return true;
  }

  function designedVocal(design, bag, strip) {
    if (design.instrumental) return '';
    var bits = [];
    if (design.tone) bits.push(design.tone);
    if (design.range) bits.push(design.range);
    if (bag.vocal) bits.push(bag.vocal);
    var delivery = byId(DELIVERIES, design.delivery);
    if (delivery) bits.push(delivery.id === 'response' ? 'call and response' : delivery.id);
    var line = bits.join(' ');
    if (!line && !design.distance && !design.accent) return '';
    if (line && !/vocal/i.test(line)) line += ' vocal';
    var distance = byId(DISTANCES, design.distance);
    if (distance) line = line ? (line + ', ' + distance.words) : distance.words;
    var accent = soundText(design.accent, strip);
    if (accent) {
      if (!/accent/i.test(accent)) accent += ' accent';
      line = line ? (line + ', ' + accent) : accent;
    }
    return line.replace(/\s+/g, ' ').trim();
  }

  function shortName(genre) {
    var names = {
      gospel: 'gospel',
      trap: 'trap',
      bossa: 'bossa nova',
      drill: 'drill',
      country: 'country',
      house: 'house',
      doowop: 'doo-wop',
      hiphop: 'hip-hop',
      reggaeton: 'reggaeton',
      ambient: 'ambient',
      afrobeats: 'Afrobeats',
      folk: 'folk',
      rnb: 'R&B',
      lofijazz: 'lo-fi jazz',
      rock: 'rock',
      pop: 'pop',
      latinguitar: 'Latin guitar',
      synthpop: 'synth pop',
      soul: 'soul',
      latin: 'Latin',
      lofi: 'lo-fi',
      indie: 'indie'
    };
    return names[genre.id] || String(genre.label || '');
  }

  function fusionTitle(lead, flavor) {
    var a = shortName(lead);
    var b = shortName(flavor);
    var plain = /^[a-z]+$/;
    if ((flavor.id === 'trap' || flavor.id === 'house') && plain.test(a) && plain.test(b)) return a + '-' + b;
    return a + ' and ' + b;
  }

  function grooveGenre(lead, flavor, choice) {
    if (choice === 'flavor') return flavor;
    if (choice === 'lead') return lead;
    if (lead.role === 'rhythm' && flavor.role !== 'rhythm') return lead;
    if (flavor.role === 'rhythm' && lead.role !== 'rhythm') return flavor;
    return lead;
  }

  function resolveBlend(id) {
    if (id === 'mostly') return 'pocket';
    if (id === 'mix') return 'layer';
    if (id === 'touch') return 'colors';
    for (var i = 0; i < COMES.length; i += 1) {
      if (COMES[i].id === id) return id;
    }
    return 'pocket';
  }

  function bestFit(a, b) {
    var level = pairLevel(a, b);
    if (level === 'great') return 'pocket';
    if (level === 'works') return 'layer';
    return 'colors';
  }

  function comeId(design) {
    var row = design || {};
    var id = resolveBlend(row.blend);
    if (id === 'surprise') return bestFit(row.lead, row.flavor);
    return id;
  }

  function layerPhrase(lead, flavor) {
    var rhythm = null;
    var other = null;
    if (lead.role === 'rhythm' && flavor.role !== 'rhythm') {
      rhythm = lead;
      other = flavor;
    } else if (flavor.role === 'rhythm' && lead.role !== 'rhythm') {
      rhythm = flavor;
      other = lead;
    }
    if (rhythm && other) return rhythm.sound + ' under ' + other.sound;
    return lead.sound + ' layered with ' + flavor.sound;
  }

  function togetherPhrase(lead, flavor, id) {
    var name = shortName(lead);
    if (id === 'trade') return 'verses in ' + name + ', chorus flips to ' + flavor.sound;
    if (id === 'layer') return layerPhrase(lead, flavor);
    if (id === 'colors') return lead.sound + ' up front, small touches of ' + flavor.sound;
    if (id === 'drift') return 'starts with ' + lead.sound + ', drifts into ' + flavor.sound + ' by the bridge';
    if (id === 'collide') return lead.sound + ' set against ' + flavor.sound;
    if (id === 'answer') return lead.sound + ', answered by ' + flavor.sound;
    return 'both styles locked in one pocket groove, ' + lead.sound + ' with ' + flavor.sound;
  }

  function explain(design) {
    var row = design || {};
    var chosen = resolveBlend(row.blend);
    if (chosen === 'surprise' && row.lead && row.flavor && row.lead !== row.flavor) {
      var picked = byId(COMES, bestFit(row.lead, row.flavor));
      return 'Plai picked ' + picked.label + '. ' + picked.line;
    }
    var item = byId(COMES, chosen) || COMES[0];
    return item.line;
  }

  function noteFor(design) {
    var row = design || {};
    if (resolveBlend(row.blend) === 'collide') return HIT_NOTE;
    return warning(row.lead, row.flavor);
  }

  function fusionLines(design) {
    var lead = byId(GENRES, design.lead);
    var flavor = byId(GENRES, design.flavor);
    if (!lead || !flavor || lead.id === flavor.id) return null;
    var third = byId(GENRES, design.third);
    if (third && (third.id === lead.id || third.id === flavor.id)) third = null;
    var groove = grooveGenre(lead, flavor, design.rhythm);
    var sound = togetherPhrase(lead, flavor, comeId(design));
    return {
      lead: lead,
      flavor: flavor,
      third: third,
      groove: groove,
      sound: sound,
      hinted: third ? (sound + ' and a hint of ' + third.sound) : '',
      title: fusionTitle(lead, flavor),
      structure: ''
    };
  }

  function assemble(model, plan) {
    var genre = plan.third && model.withThird ? model.withThird : model.base;
    var bits = [];
    if (genre) bits.push(genre);
    if (model.mood) bits.push(model.mood);
    if (!model.fusion && model.bpm) bits.push(model.bpm);
    if (model.vocal) bits.push(model.vocal);
    if (model.instruments) bits.push(model.instruments);
    if (plan.extra && model.extraMood.length) bits.push(model.extraMood.join(', '));
    if (model.tags.length) bits.push(model.tags.join(', '));
    var text = bits.filter(Boolean).join(', ');
    if (plan.structure && model.structure) text = joinSentence(text, model.structure);
    if (model.instrumental) text = joinSentence(text, 'instrumental');
    if (model.avoid) text = joinSentence(text, model.avoid);
    return text.replace(/\s+/g, ' ').trim();
  }

  function joinSentence(text, next) {
    var head = String(text || '').replace(/[. ]+$/g, '');
    var tail = String(next || '').replace(/^[. ]+/g, '');
    if (!head) return tail;
    if (!tail) return head;
    return head + '. ' + tail;
  }

  function hardTrim(text, avoid, cap) {
    if (text.length <= cap) return text;
    if (avoid && text.indexOf(avoid) !== -1 && (avoid.length + 2) <= cap) {
      var head = text.slice(0, text.lastIndexOf(avoid)).replace(/[.,\s]+$/, '');
      var room = cap - avoid.length - 2;
      head = head.slice(0, room).replace(/[,.\s]+$/, '');
      return head ? (head + '. ' + avoid) : avoid.slice(0, cap);
    }
    return text.slice(0, cap).replace(/[,.\s]+$/, '');
  }

  function fit(model, limit) {
    var cap = limit || LIMIT;
    var plan = { structure: true, extra: true, third: true };
    var text = assemble(model, plan);
    if (text.length > cap) {
      plan.structure = false;
      text = assemble(model, plan);
    }
    if (text.length > cap) {
      plan.extra = false;
      text = assemble(model, plan);
    }
    if (text.length > cap) {
      plan.third = false;
      text = assemble(model, plan);
    }
    if (text.length > cap) text = hardTrim(text, model.avoid, cap);
    return text;
  }

  function compose(bag, design, blended, strip) {
    var data = bag || {};
    var row = design || {};
    var meta = blended && blended.meta ? blended.meta : {};
    var fusion = fusionLines(row);
    var userPace = paceOf(data.tempo, data.energy);
    var pickedInstruments = (row.instruments && row.instruments.length) ? row.instruments.slice(0, 4) : (data.instruments || []).slice(0, 4);
    var groove = fusion ? fusion.groove : null;
    var kit = kitOf(pickedInstruments) || (groove && groove.kit) || meta.kit || '';
    var pace = userPace || (groove && groove.pace) || meta.pace || '';
    var instruments = pickedInstruments.slice();
    if (!fusion && !instruments.length) {
      (meta.instruments || []).forEach(function (name) {
        if (instruments.length >= 4) return;
        if (clashes(name, kit)) return;
        instruments.push(name);
      });
    }
    instruments = instruments.slice(0, 4);
    var head = '';
    var bpm = '';
    if (fusion) {
      if (userPace) head = [tempoPhrase(data.tempo, data.energy), fusion.title].filter(Boolean).join(' ');
      else head = groove.bpm + ' BPM ' + fusion.title;
    } else if (userPace) {
      bpm = [tempoPhrase(data.tempo, data.energy), data.energy ? (String(data.energy).indexOf('energy') === -1 ? data.energy + ' energy' : data.energy) : ''].filter(Boolean).join(', ');
    } else bpm = meta.bpm || '';
    var vocal = designedVocal(row, data, strip);
    if (!vocal && !row.instrumental) vocal = meta.vocal || '';
    if (!vocal && fusion && !row.instrumental) vocal = fusion.lead.vocal;
    var extra = [];
    (meta.touches || []).forEach(function (touch) {
      if (extra.length >= 4) return;
      if (!touchOk(touch, row)) return;
      extra.push(touch);
    });
    var avoidKit = fusion && groove ? groove.kit : kit;
    var avoid = fusion ? avoidLine(pace, avoidKit, row.delivery) : (blended && blended.avoid ? blended.avoid : avoidLine(pace, kit, row.delivery));
    if (row.delivery === 'spoken' && avoid.indexOf('spoken intro') !== -1) {
      avoid = avoid.replace('spoken intro', 'a long instrumental intro');
    }
    var tags = collectTags(row);
    if (fusion && fusion.lead.arrange) tags = capTags(tags.concat([fusion.lead.arrange]));
    var model = {
      base: fusion ? (head + ', ' + fusion.sound) : (data.genre || ''),
      withThird: fusion && fusion.hinted ? (head + ', ' + fusion.hinted) : '',
      mood: data.mood || '',
      extraMood: extra,
      bpm: bpm,
      vocal: soundText(vocal, strip),
      instruments: instruments.join(', '),
      tags: tags,
      structure: '',
      fusion: !!fusion,
      instrumental: row.instrumental ? 'instrumental' : '',
      avoid: avoid
    };
    return fit(model, LIMIT);
  }

  function render(host, view, handlers) {
    if (!host || typeof document === 'undefined') return;
    var state = view || {};
    var design = state.design || blank();
    var open = !!state.open;
    var hooks = handlers || {};
    host.textContent = '';
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn btn-ghost btn-md sh-style-design-toggle';
    toggle.textContent = 'Design my style';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.addEventListener('click', function () {
      if (hooks.onToggle) hooks.onToggle(!open);
    });
    host.appendChild(toggle);
    var panel = document.createElement('div');
    panel.className = 'sh-style-design-panel';
    panel.hidden = !open;
    if (!open) {
      host.appendChild(panel);
      return;
    }

    function patch(partial) {
      var next = blank();
      Object.keys(next).forEach(function (key) {
        if (design[key] != null && key !== 'instruments') next[key] = design[key];
      });
      next.instruments = (design.instruments || []).slice();
      Object.keys(partial).forEach(function (key) { next[key] = partial[key]; });
      if (hooks.onChange) hooks.onChange(next);
    }

    function heading(text) {
      var title = document.createElement('h3');
      title.textContent = text;
      panel.appendChild(title);
      return title;
    }

    function chips(list, current, onPick) {
      var row = document.createElement('div');
      row.className = 'sh-chips';
      list.forEach(function (item) {
        var id = item.id || item;
        var label = item.label || item;
        var button = document.createElement('button');
        button.type = 'button';
        var on = current === id;
        button.className = 'sh-chip' + (on ? ' on' : '');
        button.textContent = label;
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
        button.addEventListener('click', function () { onPick(on ? '' : id); });
        row.appendChild(button);
      });
      panel.appendChild(row);
      return row;
    }

    function select(placeholder, value, options, onPick) {
      var input = document.createElement('select');
      input.className = 'sh-style-select';
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = placeholder;
      input.appendChild(empty);
      options.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.label;
        input.appendChild(option);
      });
      input.value = value || '';
      input.addEventListener('change', function () { onPick(input.value); });
      panel.appendChild(input);
      return input;
    }

    heading('Fusion');
    var help = document.createElement('p');
    help.className = 'sh-help';
    help.textContent = 'Pick a lead and a flavor. They share one tempo. Each genre adds the sound it is known for. A third is optional.';
    panel.appendChild(help);
    select('Lead genre', design.lead, GENRES, function (value) { patch({ lead: value }); });
    select('Flavor genre', design.flavor, GENRES, function (value) { patch({ flavor: value }); });
    select('Third genre, optional', design.third, GENRES, function (value) { patch({ third: value }); });
    heading('How should they come together?');
    var shown = design.blend === 'surprise' ? 'surprise' : resolveBlend(design.blend);
    chips(COMES, shown, function (value) { patch({ blend: value || 'pocket' }); });
    var explainLine = document.createElement('p');
    explainLine.className = 'sh-help sh-come-line';
    explainLine.textContent = explain(design);
    panel.appendChild(explainLine);
    if (design.lead && design.flavor) {
      heading('Who sets the tempo');
      chips([
        { id: 'lead', label: 'Lead sets the tempo' },
        { id: 'flavor', label: 'Flavor sets the tempo' }
      ], design.rhythm, function (value) {
        patch({ rhythm: value });
      });
    }
    var clash = warning(design.lead, design.flavor);
    var comeNote = noteFor(design);
    if (comeNote) {
      var note = document.createElement('p');
      note.className = 'sh-style-warn';
      note.textContent = comeNote;
      panel.appendChild(note);
      if (comeNote === clash) {
        var bridge = document.createElement('button');
        bridge.type = 'button';
        bridge.className = 'btn btn-ghost btn-md';
        bridge.textContent = design.bridge ? 'Bridge added' : 'Bridge them';
        bridge.addEventListener('click', function () { patch({ bridge: !design.bridge }); });
        panel.appendChild(bridge);
      }
    }
    var surprise = document.createElement('button');
    surprise.type = 'button';
    surprise.className = 'btn btn-ghost btn-md';
    surprise.textContent = 'Pick a pair for me';
    surprise.addEventListener('click', function () {
      var steps = 0;
      surprise.disabled = true;
      var timer = setInterval(function () {
        steps += 1;
        var pass = roulette(steps * 3 + 1);
        var selects = panel.querySelectorAll('select');
        if (selects[0]) selects[0].value = pass.lead;
        if (selects[1]) selects[1].value = pass.flavor;
        if (steps < 8) return;
        clearInterval(timer);
        var landed = roulette(Date.now());
        patch({ lead: landed.lead, flavor: landed.flavor, blend: design.blend || 'pocket' });
      }, 80);
    });
    panel.appendChild(surprise);

    heading('Era');
    chips(ERAS, design.era, function (value) { patch({ era: value }); });
    heading('Vocal');
    chips(TONES.map(function (id) { return { id: id, label: labelOf(id) }; }), design.tone, function (value) { patch({ tone: value }); });
    chips(DELIVERIES, design.delivery, function (value) { patch({ delivery: value }); });
    chips(DISTANCES, design.distance, function (value) { patch({ distance: value }); });
    chips(RANGES.map(function (id) { return { id: id, label: labelOf(id) }; }), design.range, function (value) { patch({ range: value }); });
    var accent = document.createElement('input');
    accent.className = 'sh-style-select';
    accent.maxLength = 40;
    accent.placeholder = 'Language or accent';
    accent.value = design.accent || '';
    accent.setAttribute('aria-label', 'Language or accent');
    accent.addEventListener('change', function () { patch({ accent: accent.value }); });
    panel.appendChild(accent);
    var instrumental = document.createElement('button');
    instrumental.type = 'button';
    instrumental.className = 'sh-chip' + (design.instrumental ? ' on' : '');
    instrumental.textContent = 'No vocal, keep it instrumental';
    instrumental.setAttribute('aria-pressed', design.instrumental ? 'true' : 'false');
    instrumental.addEventListener('click', function () { patch({ instrumental: !design.instrumental }); });
    panel.appendChild(instrumental);

    heading('Mix feel');
    chips(MIXES, design.mix, function (value) { patch({ mix: value }); });
    heading('Instruments');
    var instRow = document.createElement('div');
    instRow.className = 'sh-chips';
    INSTRUMENTS.forEach(function (name) {
      var on = (design.instruments || []).indexOf(name) !== -1;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip' + (on ? ' on' : '');
      button.textContent = labelOf(name);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.addEventListener('click', function () {
        var list = (design.instruments || []).slice();
        var at = list.indexOf(name);
        if (at >= 0) list.splice(at, 1);
        else if (list.length < 4) list.push(name);
        patch({ instruments: list });
      });
      instRow.appendChild(button);
    });
    panel.appendChild(instRow);
    var swap = document.createElement('button');
    swap.type = 'button';
    swap.className = 'btn btn-ghost btn-md';
    swap.textContent = 'Swap one';
    swap.addEventListener('click', function () {
      var result = swapOne(design.instruments || []);
      if (!result.to) {
        if (hooks.onNote) hooks.onNote('Pick a familiar instrument first.');
        return;
      }
      patch({ instruments: result.instruments });
      if (hooks.onNote) hooks.onNote(labelOf(result.from) + ' is now ' + result.to + '.');
    });
    panel.appendChild(swap);

    heading('Sounds like the feeling of');
    chips(SCENES, design.scene, function (value) { patch({ scene: value }); });

    var fresh = document.createElement('button');
    fresh.type = 'button';
    fresh.className = 'btn btn-purple btn-md';
    fresh.textContent = 'Make it less generic';
    fresh.addEventListener('click', function () {
      var result = lessGeneric(design);
      if (hooks.onFresh) hooks.onFresh(result);
    });
    panel.appendChild(fresh);
    if (state.note) {
      var changed = document.createElement('p');
      changed.className = 'sh-style-note';
      changed.textContent = state.note;
      panel.appendChild(changed);
    }
    if (state.canUndo) {
      var undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'btn btn-ghost btn-md';
      undo.textContent = 'Undo';
      undo.addEventListener('click', function () { if (hooks.onUndo) hooks.onUndo(); });
      panel.appendChild(undo);
    }

    var preview = hooks.promptFor ? hooks.promptFor(design) : { text: '', warning: '' };
    var text = preview.text || '';
    heading('Style prompt');
    var box = document.createElement('textarea');
    box.className = 'sh-style-box sh-style-preview';
    box.readOnly = true;
    box.rows = 6;
    box.value = text;
    box.setAttribute('aria-label', 'Style prompt');
    panel.appendChild(box);
    var meter = document.createElement('p');
    meter.className = 'sh-style-meter-label';
    meter.textContent = text.length + ' / ' + LIMIT;
    panel.appendChild(meter);
    var bar = document.createElement('div');
    bar.className = 'sh-style-meter';
    var fill = document.createElement('span');
    fill.style.width = Math.min(100, Math.round((text.length / LIMIT) * 100)) + '%';
    bar.appendChild(fill);
    panel.appendChild(bar);
    host.appendChild(panel);
  }

  return {
    LIMIT: LIMIT,
    GENRES: GENRES,
    PAIRS: OVERRIDES,
    COMES: COMES,
    RECIPES: RECIPES,
    ERAS: ERAS,
    SCENES: SCENES,
    MIXES: MIXES,
    blank: blank,
    active: active,
    pairLevel: pairLevel,
    warning: warning,
    explain: explain,
    noteFor: noteFor,
    comeId: comeId,
    roulette: roulette,
    swapInstrument: swapInstrument,
    swapOne: swapOne,
    lessGeneric: lessGeneric,
    capTags: capTags,
    collectTags: collectTags,
    fit: fit,
    compose: compose,
    render: render
  };
}));
