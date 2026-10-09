'use strict';

/**
 * Musical clues for the style prompt.
 * Taps and a couple of story words become sound directions.
 * The writer's own genre, vocal, and tempo still win.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StyleClues = api;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  var FOR = {
    everyone: {
      touches: ['anthem feel', 'big singalong chorus', 'wide mix'],
      size: 'huge'
    },
    someone: {
      vocal: 'close vocal',
      vocalAdj: 'close',
      touches: ['intimate', 'direct and personal'],
      size: 'intimate'
    },
    myself: {
      vocal: 'close-mic vocal',
      vocalAdj: 'close-mic',
      touches: ['reflective', 'sparse'],
      size: 'intimate'
    }
  };

  var AIM = {
    heal: { bpm: '70-85 BPM', pace: 'slow', kit: 'soft', vocal: 'tender vocal', vocalAdj: 'tender', instruments: ['warm acoustic guitar', 'piano'] },
    hype: { bpm: '125-145 BPM', pace: 'fast', kit: 'neutral', vocal: 'confident vocal', vocalAdj: 'confident', instruments: ['big drums', 'bass'] },
    laugh: { bpm: '100-120 BPM', pace: 'mid', kit: 'neutral', instruments: ['light bass'], touches: ['bouncy', 'playful'] },
    cry: { bpm: '60-75 BPM', pace: 'slow', kit: 'soft', vocal: 'raw vocal', vocalAdj: 'raw', instruments: ['piano', 'strings'] },
    inspire: { bpm: '90-110 BPM', pace: 'mid', kit: 'neutral', touches: ['building', 'drums enter late', 'uplifting'] },
    confess: { bpm: '65-80 BPM', pace: 'slow', kit: 'soft', vocal: 'whisper-close vocal', vocalAdj: 'whisper-close', instruments: ['bare guitar'] },
    celebrate: { bpm: '105-125 BPM', pace: 'mid', kit: 'neutral', instruments: ['claps', 'horns'], touches: ['bright'] },
    clapback: { bpm: '85-100 BPM', pace: 'mid', kit: 'hard', vocal: 'sharp vocal', vocalAdj: 'sharp', instruments: ['hard 808s'] },
    comfort: { bpm: '65-80 BPM', pace: 'slow', kit: 'soft', vocal: 'gentle vocal', vocalAdj: 'gentle', instruments: ['soft piano', 'pad'] },
    dance: { bpm: '115-128 BPM', pace: 'fast', kit: 'neutral', instruments: ['four-on-floor', 'synth', 'groove bass'] },
    other: null
  };

  var KIND = {
    love: { pace: 'mid', kit: 'soft', instruments: ['electric piano'], touches: ['smooth warm'] },
    heartbreak: { pace: 'slow', kit: 'soft', vocal: 'aching vocal', touches: ['slow minor'] },
    hype: { pace: 'fast', kit: 'hard', instruments: ['heavy drums'], touches: ['high energy'] },
    petty: { pace: 'mid', kit: 'neutral', touches: ['sassy', 'sparse beat', 'playful bite'] },
    grateful: { pace: 'mid', kit: 'soft', touches: ['warm gospel touch', 'hopeful'] },
    nostalgic: { pace: 'mid', kit: 'soft', touches: ['vintage tone', 'soft tape warmth'] },
    angry: { pace: 'fast', kit: 'hard', instruments: ['distorted guitar', 'hard drums'], touches: ['driving'] },
    mindset: { pace: 'mid', kit: 'neutral', touches: ['steady', 'confident', 'motivational build'] }
  };

  var STORY = [
    { id: 'radio', words: ['radio', 'car'], text: 'warm tape tone, road-trip glow', kit: '', size: '' },
    { id: 'kitchen', words: ['kitchen', 'home'], text: 'close, homey, acoustic', kit: 'soft', size: 'intimate' },
    { id: 'night', words: ['night'], text: 'late-night moody pads', kit: '', size: '' },
    { id: 'rain', words: ['rain'], text: 'soft rain-like texture', kit: '', size: '' },
    { id: 'church', words: ['church'], text: 'choir pads, organ', kit: 'soft', size: '' },
    { id: 'beach', words: ['beach', 'summer'], text: 'bright, breezy', kit: '', size: '' },
    { id: 'phone', words: ['phone', 'text', 'texted', 'texting'], text: 'lo-fi, muted', kit: '', size: '' },
    { id: 'crowd', words: ['crowd', 'stadium'], text: 'huge, live', kit: '', size: 'huge' }
  ];

  function paceOf(tempo, energy) {
    var tempoName = String(tempo || '').toLowerCase();
    var energyName = String(energy || '').toLowerCase();
    if (tempoName === 'slow' || energyName === 'low') return 'slow';
    if (tempoName === 'fast' || energyName === 'high') return 'fast';
    if (tempoName === 'mid' || energyName === 'medium' || energyName === 'building') return 'mid';
    return '';
  }

  function paceClash(a, b) {
    if (!a || !b) return false;
    return (a === 'slow' && b === 'fast') || (a === 'fast' && b === 'slow');
  }

  function kitClash(a, b) {
    if (!a || !b || a === 'neutral' || b === 'neutral') return false;
    return a !== b;
  }

  function sizeClash(a, b) {
    if (!a || !b) return false;
    return a !== b;
  }

  function kitOfInstruments(list) {
    var hard = false;
    var soft = false;
    (list || []).forEach(function (name) {
      var text = String(name || '').toLowerCase();
      if (/808|distorted|heavy drum|hard drum/.test(text)) hard = true;
      if (/acoustic|bare guitar|soft piano|electric piano|^piano$/.test(text)) soft = true;
    });
    if (hard && !soft) return 'hard';
    if (soft && !hard) return 'soft';
    return '';
  }

  function instrumentClashes(name, kit) {
    var text = String(name || '').toLowerCase();
    var hard = /808|distorted|heavy drum|hard drum/.test(text);
    var soft = /acoustic|bare guitar|soft piano|electric piano|^piano$|warm acoustic/.test(text);
    if (kit === 'soft' && hard) return true;
    if (kit === 'hard' && soft) return true;
    return false;
  }

  function hasWord(text, word) {
    var body = String(text || '').toLowerCase();
    var token = String(word || '').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!token) return false;
    return new RegExp('\\b' + token + '\\b', 'i').test(body);
  }

  function storyBlob(flow) {
    var row = flow || {};
    return [row.opener, row.scene, row.object].filter(Boolean).join(' ');
  }

  function cluesFrom(flow) {
    var row = flow || {};
    var aimId = row.aimId || (Array.isArray(row.aims) ? row.aims[0] : '') || '';
    var kindId = row.kindId || (Array.isArray(row.kinds) ? row.kinds[0] : '') || '';
    var forId = row.forId || '';
    var blob = storyBlob(row);
    var touches = [];
    STORY.forEach(function (item) {
      var hit = item.words.some(function (word) { return hasWord(blob, word); });
      if (hit) touches.push({ id: item.id, text: item.text, kit: item.kit, size: item.size });
    });
    return {
      forClue: FOR[forId] || null,
      aimClue: Object.prototype.hasOwnProperty.call(AIM, aimId) ? AIM[aimId] : null,
      kindClue: KIND[kindId] || null,
      touches: touches
    };
  }

  function pushUnique(list, value) {
    var text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    var lower = text.toLowerCase();
    for (var i = 0; i < list.length; i += 1) {
      if (String(list[i]).toLowerCase() === lower) return;
    }
    list.push(text);
  }

  function vocalTone(userVocal, userTexture, aim, forClue, kind) {
    var gender = String(userVocal || '').trim();
    var texture = String(userTexture || '').trim();
    if (gender) {
      var line = gender;
      if (texture) line = texture + ' ' + line;
      if (!/vocal/i.test(line)) line += ' vocal';
      if (aim && aim.vocalAdj && line.toLowerCase().indexOf(aim.vocalAdj) === -1) {
        line = aim.vocalAdj + ' ' + line;
      }
      return line.replace(/\s+/g, ' ').trim();
    }
    if (aim && aim.vocal) {
      var aimVocal = aim.vocal.toLowerCase();
      var forAdj = forClue && forClue.vocalAdj ? String(forClue.vocalAdj).toLowerCase() : '';
      if (forAdj && aimVocal.indexOf('close') === -1 && aimVocal.indexOf(forAdj) === -1) {
        return (aim.vocalAdj + ' ' + forAdj + ' vocal').replace(/\s+/g, ' ').trim();
      }
      return aim.vocal;
    }
    if (forClue && forClue.vocal) return forClue.vocal;
    if (kind && kind.vocal) return kind.vocal;
    if (texture) return /vocal/i.test(texture) ? texture : texture + ' vocal';
    return '';
  }

  var TEMPO_FROM_ENERGY = { low: 'slow', medium: 'mid', high: 'fast', building: 'mid' };

  function shownTempo(data) {
    var tempo = String(data.tempo || '').toLowerCase();
    if (tempo === 'slow' || tempo === 'mid' || tempo === 'fast') return tempo;
    return TEMPO_FROM_ENERGY[String(data.energy || '').toLowerCase()] || '';
  }

  function tempoPhrase(tempo) {
    if (tempo === 'slow') return 'slow tempo';
    if (tempo === 'mid') return 'mid tempo';
    if (tempo === 'fast') return 'fast tempo';
    return '';
  }

  function energyPhrase(energy) {
    if (!energy) return '';
    if (/energy/i.test(energy)) return energy;
    return energy + ' energy';
  }

  function avoidLine(pace, kit) {
    var items = ['spoken intro', 'autotune glitch', 'mismatched tempo'];
    if (pace === 'fast') items[2] = 'a ballad tempo';
    else if (pace === 'slow' || kit === 'soft') items[1] = 'hard 808s';
    if (kit === 'hard') items[1] = 'a soft acoustic ballad';
    return 'Avoid: ' + items.join(', ');
  }

  function blend(bag, flow) {
    var data = bag || {};
    var clues = cluesFrom(flow);
    var aim = clues.aimClue;
    var kind = clues.kindClue;
    var forClue = clues.forClue;
    var userPace = paceOf(data.tempo, data.energy);
    var userKit = kitOfInstruments(data.instruments);
    var winnerPace = userPace || (aim && aim.pace) || (kind && kind.pace) || '';
    var winnerSize = forClue && forClue.size || '';
    var userSetPace = !!(data.tempo || data.energy);

    if (aim && paceClash(aim.pace, winnerPace)) aim = null;
    if (kind && paceClash(kind.pace, winnerPace)) kind = null;
    var winnerKit = userKit || (aim && aim.kit) || '';
    if (aim && kitClash(aim.kit, winnerKit)) aim = null;
    if (kind && kitClash(kind.kit, winnerKit)) kind = null;

    var instruments = [];
    (Array.isArray(data.instruments) ? data.instruments : []).forEach(function (name) {
      pushUnique(instruments, name);
    });
    [aim, kind].forEach(function (clue) {
      if (!clue || !clue.instruments) return;
      clue.instruments.forEach(function (name) {
        if (instruments.length >= 4) return;
        if (instrumentClashes(name, winnerKit)) return;
        pushUnique(instruments, name);
      });
    });
    instruments = instruments.slice(0, 4);

    var bpm = '';
    if (userSetPace) {
      bpm = [tempoPhrase(shownTempo(data)), data.energy ? energyPhrase(data.energy) : ''].filter(Boolean).join(', ');
    } else if (aim && aim.bpm) {
      bpm = aim.bpm;
    } else {
      bpm = [tempoPhrase(shownTempo(data)), data.energy ? energyPhrase(data.energy) : ''].filter(Boolean).join(', ');
    }

    var touches = [];
    if (forClue && forClue.touches) forClue.touches.forEach(function (item) { pushUnique(touches, item); });
    if (aim && aim.touches) aim.touches.forEach(function (item) { pushUnique(touches, item); });
    if (kind && kind.touches) kind.touches.forEach(function (item) { pushUnique(touches, item); });
    var storyAdded = 0;
    clues.touches.forEach(function (item) {
      if (storyAdded >= 2) return;
      if (kitClash(item.kit, winnerKit) || sizeClash(item.size, winnerSize)) return;
      var before = touches.length;
      pushUnique(touches, item.text);
      if (touches.length > before) storyAdded += 1;
    });
    if (data.region) pushUnique(touches, data.region + ' feel');
    if (data.era) pushUnique(touches, data.era);

    var parts = [];
    if (data.genre) parts.push(data.genre);
    if (data.mood) parts.push(data.mood);
    if (bpm) parts.push(bpm);
    var vocal = vocalTone(data.vocal, data.texture, aim, forClue, kind);
    if (vocal) parts.push(vocal);
    if (instruments.length) parts.push(instruments.join(', '));
    if (touches.length) parts.push(touches.join(', '));

    return {
      parts: dedupeParts(parts),
      avoid: parts.length ? avoidLine(winnerPace, winnerKit) : '',
      meta: {
        bpm: bpm,
        vocal: vocal,
        instruments: instruments.slice(),
        touches: touches.slice(),
        pace: winnerPace,
        kit: winnerKit
      }
    };
  }

  function normTag(value) {
    return String(value || '').toLowerCase().replace(/808s\b/g, '808').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function containsPhrase(longer, shorter) {
    if (!shorter || longer === shorter) return false;
    return (' ' + longer + ' ').indexOf(' ' + shorter + ' ') !== -1;
  }

  function lastWord(token) {
    var parts = normTag(token).split(' ');
    return parts[parts.length - 1] || '';
  }

  function looser(loose, tight) {
    if (!loose || !tight || lastWord(loose) !== lastWord(tight)) return false;
    var a = normTag(loose).split(' ').slice(0, -1);
    var b = normTag(tight).split(' ').slice(0, -1);
    if (!a.length || !b.length) return false;
    function generic(words) {
      return words.every(function (word) { return word === 'big' || word === 'light'; });
    }
    return generic(a) && !generic(b);
  }

  function dedupeTags(list) {
    var items = [];
    (list || []).forEach(function (value) {
      String(value || '').split(',').forEach(function (part) {
        var text = String(part || '').replace(/\s+/g, ' ').trim();
        if (text) items.push(text);
      });
    });
    var drop = {};
    for (var i = 0; i < items.length; i += 1) {
      for (var j = i + 1; j < items.length; j += 1) {
        var a = normTag(items[i]);
        var b = normTag(items[j]);
        if (!a || !b) continue;
        if (a === b || containsPhrase(a, b) || looser(items[j], items[i])) drop[j] = true;
        else if (containsPhrase(b, a) || looser(items[i], items[j])) drop[i] = true;
      }
    }
    return items.filter(function (_, index) { return !drop[index]; });
  }

  function dedupeParts(parts) {
    return dedupeTags(parts);
  }

  function dedupePrompt(text) {
    var raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    var avoidAt = raw.indexOf('Avoid:');
    var body = avoidAt === -1 ? raw : raw.slice(0, avoidAt).replace(/[.\s]+$/, '');
    var avoid = avoidAt === -1 ? '' : raw.slice(avoidAt).trim();
    var tags = dedupeTags(body.split(','));
    var next = tags.join(', ');
    if (avoid) next = next ? (next + '. ' + avoid) : avoid;
    return next;
  }

  return {
    FOR: FOR,
    AIM: AIM,
    KIND: KIND,
    STORY: STORY,
    cluesFrom: cluesFrom,
    blend: blend,
    dedupeTags: dedupeTags,
    dedupePrompt: dedupePrompt
  };
}));
