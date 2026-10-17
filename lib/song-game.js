/**
 * Builds a playable hook game from a saved song.
 * Plain code only. No model call.
 * Browser and server.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundSongGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var BRAND = ['#7D3CFF', '#FF3C8E', '#F5C542'];
  var WORD_MIN = 4;
  var WORD_MAX = 8;
  var DECOY_MAX = 5;

  function sections(text) {
    var parts = [];
    var current = null;
    String(text || '').split('\n').forEach(function (line) {
      var head = String(line).match(/^\s*\[([^\]]+)\]\s*$/);
      if (head) {
        current = { label: head[1].trim(), lines: [] };
        parts.push(current);
        return;
      }
      if (!current) {
        current = { label: 'Verse', lines: [] };
        parts.push(current);
      }
      if (String(line).trim()) current.lines.push(String(line).trim());
    });
    return parts;
  }

  function tokens(line) {
    var found = String(line || '').match(/[A-Za-z0-9][A-Za-z0-9']*/g);
    return found || [];
  }

  function hookSection(parts) {
    var hook = null;
    var chorus = null;
    parts.forEach(function (part) {
      var label = String(part.label || '');
      if (!hook && /hook/i.test(label)) hook = part;
      if (!chorus && /chorus/i.test(label)) chorus = part;
    });
    return hook || chorus || parts[0] || { label: 'Hook', lines: [] };
  }

  function takeWords(section, min, max) {
    var chosen = [];
    var count = 0;
    var floor = min || WORD_MIN;
    var cap = max || WORD_MAX;
    var lines = section && Array.isArray(section.lines) ? section.lines : [];
    for (var i = 0; i < lines.length; i += 1) {
      if (count >= floor && chosen.length) break;
      var words = tokens(lines[i]);
      if (!words.length) continue;
      var room = cap - count;
      if (room < 1) break;
      var take = words.slice(0, room);
      chosen.push({ text: take.join(' '), words: take });
      count += take.length;
      if (count >= cap) break;
    }
    return chosen;
  }

  function firstVerse(parts, hook) {
    var verse = null;
    parts.forEach(function (part) {
      if (verse || part === hook) return;
      if (/verse/i.test(part.label || '')) verse = part;
    });
    if (verse) return verse;
    return parts.filter(function (part) { return part !== hook; })[0] || hook;
  }

  function hexes(list) {
    var picked = [];
    (Array.isArray(list) ? list : []).forEach(function (hex) {
      if (picked.length >= 3) return;
      var text = String(hex || '').trim();
      if (/^#[0-9a-fA-F]{6}$/.test(text)) picked.push(text);
    });
    return picked;
  }

  function colorsFor(mood, prefer) {
    var picked = hexes(prefer);
    if (picked.length) {
      while (picked.length < 3) picked.push(BRAND[picked.length]);
      return picked;
    }
    var text = String(mood || '').toLowerCase();
    var table = [
      [/sad|blue|heart|cry|lonely|hurt/, ['#24324a', '#7D3CFF', '#FF3C8E']],
      [/joy|happy|bright|sun|party|gold/, ['#F5C542', '#FF3C8E', '#7D3CFF']],
      [/night|dark|late|moon/, ['#161616', '#7D3CFF', '#F5C542']],
      [/love|pink|rose/, ['#FF3C8E', '#7D3CFF', '#F5C542']],
      [/calm|soft|peace|sea/, ['#2f6f73', '#7D3CFF', '#F5C542']],
    ];
    for (var i = 0; i < table.length; i += 1) {
      if (table[i][0].test(text)) return table[i][1].slice();
    }
    return BRAND.slice();
  }

  function decoysFrom(parts, skip, used) {
    var out = [];
    var seen = {};
    parts.forEach(function (part) {
      if (skip && part === skip) return;
      (part.lines || []).forEach(function (line) {
        tokens(line).forEach(function (word) {
          if (out.length >= DECOY_MAX) return;
          var key = word.toLowerCase();
          if (used[key] || seen[key] || key.length < 2) return;
          seen[key] = true;
          out.push(word);
        });
      });
    });
    return out;
  }

  function flatten(chosen) {
    var words = [];
    var wordLines = [];
    var lines = [];
    chosen.forEach(function (row) {
      lines.push(row.text);
      row.words.forEach(function (word) {
        words.push(word);
        wordLines.push(row.text);
      });
    });
    return { words: words, wordLines: wordLines, lines: lines, hook: lines.join(' ') };
  }

  function levelFrom(id, name, chosen, parts, skip) {
    var flat = flatten(chosen);
    var used = {};
    flat.words.forEach(function (word) { used[word.toLowerCase()] = true; });
    return {
      id: id,
      label: 'Level ' + id,
      name: name,
      words: flat.words,
      wordLines: flat.wordLines,
      lines: flat.lines,
      hook: flat.hook,
      decoys: decoysFrom(parts, skip, used),
    };
  }

  function wholeSong(parts, hookPart, hookChosen) {
    var hookFlat = flatten(hookChosen);
    var room = 12 - hookFlat.words.length;
    if (room < 4) room = 4;
    var front = [];
    var count = 0;
    parts.forEach(function (part) {
      if (part === hookPart || count >= room) return;
      (part.lines || []).forEach(function (line) {
        if (count >= room) return;
        var words = tokens(line).slice(0, room - count);
        if (!words.length) return;
        front.push({ text: words.join(' '), words: words });
        count += words.length;
      });
    });
    return front.concat(hookChosen);
  }

  function formatScore(value) {
    var num = Math.max(0, Math.min(100000, Math.round(Number(value) || 0)));
    return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function challengeName(value) {
    var name = String(value || '').replace(/[^A-Za-z0-9 .'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    return name || 'Friend';
  }

  function challengeLine(name, score) {
    return 'Beat ' + challengeName(name) + "'s score: " + formatScore(score);
  }

  function build(song, opts) {
    var source = song && typeof song === 'object' ? song : {};
    var parts = sections(source.text);
    var section = hookSection(parts);
    var chosen = takeWords(section, WORD_MIN, WORD_MAX);
    if (!chosen.length) {
      parts.forEach(function (part) {
        if (chosen.length) return;
        chosen = takeWords(part, WORD_MIN, WORD_MAX);
        section = part;
      });
    }
    var verse = firstVerse(parts, section);
    var verseChosen = takeWords(verse, WORD_MIN, WORD_MAX);
    if (!verseChosen.length) verseChosen = chosen;
    var whole = wholeSong(parts, section, chosen);
    var levels = [
      levelFrom(1, 'The hook', chosen, parts, section),
      levelFrom(2, 'Verse 1', verseChosen, parts, verse),
      levelFrom(3, 'The whole song', whole, parts, null),
    ];
    var hookLevel = levels[0];
    var allLines = [];
    levels.forEach(function (level) {
      (level.lines || []).forEach(function (line) {
        if (allLines.indexOf(line) === -1) allLines.push(line);
      });
    });
    var prefer = opts && opts.colors;
    return {
      title: String(source.title || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      hook: hookLevel.hook,
      hookLines: hookLevel.lines,
      hookWords: hookLevel.words,
      wordLines: hookLevel.wordLines,
      decoys: hookLevel.decoys,
      lines: allLines,
      levels: levels,
      colors: colorsFor(source.mood, prefer),
      mood: String(source.mood || '').replace(/\s+/g, ' ').trim().slice(0, 40),
    };
  }

  return {
    build: build,
    challengeLine: challengeLine,
    challengeName: challengeName,
    colorsFor: colorsFor,
    formatScore: formatScore,
  };
});
