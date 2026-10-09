'use strict';

/**
 * Optional style designer.
 * Closed until someone asks. Their picks win over story clues.
 * One genre keeps the tempo and the drums.
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
    { id: 'gospel', label: 'Gospel', bpm: 78, pace: 'slow', kit: 'soft', drums: 'hand claps' },
    { id: 'trap', label: 'Trap', bpm: 140, pace: 'fast', kit: 'hard', drums: '808s' },
    { id: 'bossa', label: 'Bossa nova', bpm: 112, pace: 'mid', kit: 'soft', drums: 'soft percussion' },
    { id: 'drill', label: 'Drill', bpm: 142, pace: 'fast', kit: 'hard', drums: 'sliding 808s' },
    { id: 'country', label: 'Country', bpm: 96, pace: 'mid', kit: 'soft', drums: 'train beat' },
    { id: 'house', label: 'House', bpm: 122, pace: 'fast', kit: 'neutral', drums: 'four-on-the-floor' },
    { id: 'doowop', label: '50s doo-wop', bpm: 86, pace: 'mid', kit: 'soft', drums: 'finger snaps' },
    { id: 'hiphop', label: 'Hip-hop', bpm: 92, pace: 'mid', kit: 'hard', drums: 'boom bap drums' },
    { id: 'reggaeton', label: 'Reggaeton', bpm: 94, pace: 'mid', kit: 'neutral', drums: 'dembow' },
    { id: 'ambient', label: 'Ambient', bpm: 70, pace: 'slow', kit: 'soft', drums: 'soft pulse' },
    { id: 'afrobeats', label: 'Afrobeats', bpm: 105, pace: 'mid', kit: 'neutral', drums: 'talking drums' },
    { id: 'folk', label: 'Folk', bpm: 84, pace: 'slow', kit: 'soft', drums: 'brushed kit' },
    { id: 'rnb', label: 'R&B', bpm: 80, pace: 'slow', kit: 'soft', drums: 'soft drums' },
    { id: 'lofijazz', label: 'Lo-fi jazz', bpm: 76, pace: 'slow', kit: 'soft', drums: 'brushed drums' },
    { id: 'rock', label: 'Rock', bpm: 118, pace: 'fast', kit: 'hard', drums: 'live drums' },
    { id: 'pop', label: 'Pop', bpm: 108, pace: 'mid', kit: 'neutral', drums: 'tight drums' },
    { id: 'latinguitar', label: 'Latin guitar', bpm: 100, pace: 'mid', kit: 'soft', drums: 'hand percussion' },
    { id: 'synthpop', label: 'Synth pop', bpm: 116, pace: 'mid', kit: 'neutral', drums: 'drum machine' },
    { id: 'soul', label: 'Soul', bpm: 88, pace: 'mid', kit: 'soft', drums: 'pocket drums' }
  ];

  var PAIRS = [
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
    { a: 'house', b: 'synthpop', level: 'great' },
    { a: 'folk', b: 'pop', level: 'works' },
    { a: 'ambient', b: 'gospel', level: 'works' },
    { a: 'drill', b: 'folk', level: 'risky' },
    { a: 'bossa', b: 'trap', level: 'risky' }
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
  var BLENDS = [
    { id: 'mostly', label: 'Mostly', ratio: '70/30' },
    { id: 'mix', label: 'A good mix', ratio: '50/50' },
    { id: 'touch', label: 'Just a touch', ratio: '85/15' }
  ];
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
      blend: 'mostly',
      rhythm: 'lead',
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
    for (var i = 0; i < PAIRS.length; i += 1) {
      var row = PAIRS[i];
      if ((row.a === a && row.b === b) || (row.a === b && row.b === a)) return row.level;
    }
    return 'works';
  }

  function warning(a, b) {
    if (pairLevel(a, b) !== 'risky') return '';
    return 'These two pull in different directions. Want a bridge between them?';
  }

  function safePairs() {
    return PAIRS.filter(function (row) { return row.level === 'great' || row.level === 'works'; });
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

  function fusionLines(design) {
    var lead = byId(GENRES, design.lead);
    var flavor = byId(GENRES, design.flavor);
    if (!lead || !flavor || lead.id === flavor.id) return null;
    var third = byId(GENRES, design.third);
    if (third && (third.id === lead.id || third.id === flavor.id)) third = null;
    var blend = byId(BLENDS, design.blend) || BLENDS[0];
    var rhythm = design.rhythm === 'flavor' ? flavor : lead;
    var other = rhythm.id === lead.id ? flavor : lead;
    var job = blend.id === 'touch' ? 'mood' : 'harmony';
    var place = blend.id === 'touch' ? 'bridge' : 'chorus';
    var tail = blend.ratio + '. ' + rhythm.label + ' owns rhythm and drums. ' + other.label + ' owns ' + job + ', audible in the ' + place;
    return {
      lead: lead,
      flavor: flavor,
      third: third,
      rhythm: rhythm,
      base: lead.label + ' with a ' + flavor.label + ' flavor, ' + tail,
      withThird: third ? (lead.label + ' with a ' + flavor.label + ' flavor and a hint of ' + third.label + ', ' + tail) : '',
      structure: 'Verses stay with the lead. The flavor lifts the ' + place + '.'
    };
  }

  function assemble(model, plan) {
    var genre = plan.third && model.withThird ? model.withThird : model.base;
    var bits = [];
    if (genre) bits.push(genre);
    if (model.mood) bits.push(model.mood);
    if (model.bpm) bits.push(model.bpm);
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
    var rhythm = fusion ? fusion.rhythm : null;
    var kit = kitOf(pickedInstruments) || (rhythm && rhythm.kit) || meta.kit || '';
    var pace = userPace || (rhythm && rhythm.pace) || meta.pace || '';
    var instruments = pickedInstruments.slice();
    if (!instruments.length) {
      (meta.instruments || []).forEach(function (name) {
        if (instruments.length >= 4) return;
        if (rhythm && String(name).toLowerCase() === String(rhythm === fusion.lead ? fusion.flavor.drums : fusion.lead.drums).toLowerCase()) return;
        if (clashes(name, rhythm ? rhythm.kit : kit)) return;
        instruments.push(name);
      });
    }
    if (!instruments.length && rhythm) instruments = [rhythm.drums];
    instruments = instruments.slice(0, 4);
    if (rhythm) {
      var otherDrums = (rhythm.id === fusion.lead.id ? fusion.flavor.drums : fusion.lead.drums).toLowerCase();
      if (!(row.instruments && row.instruments.length)) {
        instruments = instruments.filter(function (name) { return String(name).toLowerCase() !== otherDrums; });
        if (!instruments.length) instruments = [rhythm.drums];
      }
    }
    var bpm = '';
    if (userPace) {
      var phrase = [tempoPhrase(data.tempo, data.energy), data.energy ? (String(data.energy).indexOf('energy') === -1 ? data.energy + ' energy' : data.energy) : ''].filter(Boolean).join(', ');
      bpm = phrase;
    } else if (rhythm) bpm = rhythm.bpm + ' BPM';
    else bpm = meta.bpm || '';
    var vocal = designedVocal(row, data, strip);
    if (!vocal && !row.instrumental) vocal = meta.vocal || '';
    var extra = [];
    (meta.touches || []).forEach(function (touch) {
      if (extra.length >= 4) return;
      if (!touchOk(touch, row)) return;
      extra.push(touch);
    });
    var avoid = fusion ? avoidLine(pace, rhythm ? rhythm.kit : kit, row.delivery) : (blended && blended.avoid ? blended.avoid : avoidLine(pace, kit, row.delivery));
    if (row.delivery === 'spoken' && avoid.indexOf('spoken intro') !== -1) {
      avoid = avoid.replace('spoken intro', 'a long instrumental intro');
    }
    var model = {
      base: fusion ? fusion.base : (data.genre || ''),
      withThird: fusion ? fusion.withThird : '',
      mood: data.mood || '',
      extraMood: extra,
      bpm: bpm,
      vocal: soundText(vocal, strip),
      instruments: instruments.join(', '),
      tags: collectTags(row),
      structure: fusion ? fusion.structure : '',
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
    help.textContent = 'Pick a lead and a flavor. One of them keeps the drums and the tempo. Two is plenty. A third is optional.';
    panel.appendChild(help);
    select('Lead genre', design.lead, GENRES, function (value) { patch({ lead: value }); });
    select('Flavor genre', design.flavor, GENRES, function (value) { patch({ flavor: value }); });
    select('Third genre, optional', design.third, GENRES, function (value) { patch({ third: value }); });
    heading('How much of the flavor');
    chips(BLENDS, design.blend || 'mostly', function (value) { patch({ blend: value || 'mostly' }); });
    if (design.lead && design.flavor) {
      heading('Who owns the drums');
      chips([
        { id: 'lead', label: 'Lead owns the drums' },
        { id: 'flavor', label: 'Flavor owns the drums' }
      ], design.rhythm === 'flavor' ? 'flavor' : 'lead', function (value) {
        patch({ rhythm: value === 'flavor' ? 'flavor' : 'lead' });
      });
    }
    var clash = warning(design.lead, design.flavor);
    if (clash) {
      var note = document.createElement('p');
      note.className = 'sh-style-warn';
      note.textContent = clash;
      panel.appendChild(note);
      var bridge = document.createElement('button');
      bridge.type = 'button';
      bridge.className = 'btn btn-ghost btn-md';
      bridge.textContent = design.bridge ? 'Bridge added' : 'Bridge them';
      bridge.addEventListener('click', function () { patch({ bridge: !design.bridge }); });
      panel.appendChild(bridge);
    }
    var surprise = document.createElement('button');
    surprise.type = 'button';
    surprise.className = 'btn btn-ghost btn-md';
    surprise.textContent = 'Surprise me';
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
        patch({ lead: landed.lead, flavor: landed.flavor, blend: design.blend || 'mostly' });
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
    PAIRS: PAIRS,
    RECIPES: RECIPES,
    ERAS: ERAS,
    SCENES: SCENES,
    MIXES: MIXES,
    blank: blank,
    active: active,
    pairLevel: pairLevel,
    warning: warning,
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
