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

  function takeWords(section) {
    var chosen = [];
    var count = 0;
    var lines = section && Array.isArray(section.lines) ? section.lines : [];
    for (var i = 0; i < lines.length; i += 1) {
      if (count >= WORD_MIN && chosen.length) break;
      var words = tokens(lines[i]);
      if (!words.length) continue;
      var room = WORD_MAX - count;
      if (room < 1) break;
      var take = words.slice(0, room);
      chosen.push({ text: take.join(' '), words: take });
      count += take.length;
      if (count >= WORD_MAX) break;
    }
    return chosen;
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

  function decoysFrom(parts, hookSectionRow, used) {
    var out = [];
    var seen = {};
    parts.forEach(function (part) {
      if (part === hookSectionRow) return;
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

  function build(song, opts) {
    var source = song && typeof song === 'object' ? song : {};
    var parts = sections(source.text);
    var section = hookSection(parts);
    var chosen = takeWords(section);
    if (!chosen.length) {
      parts.forEach(function (part) {
        if (chosen.length) return;
        chosen = takeWords(part);
        section = part;
      });
    }
    var hookWords = [];
    var wordLines = [];
    var hookLines = [];
    var used = {};
    chosen.forEach(function (row) {
      hookLines.push(row.text);
      row.words.forEach(function (word) {
        hookWords.push(word);
        wordLines.push(row.text);
        used[word.toLowerCase()] = true;
      });
    });
    var prefer = opts && opts.colors;
    return {
      title: String(source.title || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      hook: hookLines.join(' '),
      hookLines: hookLines,
      hookWords: hookWords,
      wordLines: wordLines,
      decoys: decoysFrom(parts, section, used),
      colors: colorsFor(source.mood, prefer),
      mood: String(source.mood || '').replace(/\s+/g, ' ').trim().slice(0, 40),
    };
  }

  return {
    build: build,
    colorsFor: colorsFor,
  };
});
