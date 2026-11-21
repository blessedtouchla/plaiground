'use strict';

/**
 * Syllables and rhyme tails for the Street Notebook.
 * Dictionary counts win. Unknown words use the notebook vowel-group counter.
 * Rhyme: same vowel and same ending consonant is exact. Same vowel with a
 * different ending is near. gone/on stay exact. room/soon stay near.
 * Counts are a guide, never a grade.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WordEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var dict = {};

  var HL = [
    'rgba(255, 236, 60, .62)',
    'rgba(255, 80, 170, .40)',
    'rgba(60, 230, 255, .42)',
    'rgba(130, 255, 60, .45)',
    'rgba(255, 150, 30, .45)'
  ];
  var HL_NEAR = [
    'rgba(255, 236, 60, .28)',
    'rgba(255, 80, 170, .20)',
    'rgba(60, 230, 255, .22)',
    'rgba(130, 255, 60, .22)',
    'rgba(255, 150, 30, .22)'
  ];

  function load(table) {
    dict = {};
    if (!table || typeof table !== 'object') return;
    Object.keys(table).forEach(function (key) {
      var row = table[key];
      if (!row || typeof row !== 'object') return;
      dict[String(key).toLowerCase()] = {
        syl: Number(row.syl) > 0 ? Number(row.syl) : 0,
        vowel: row.vowel ? String(row.vowel) : '',
        coda: row.coda != null ? String(row.coda) : ''
      };
    });
  }

  function wordKey(word) {
    return String(word || '').toLowerCase().replace(/[^a-z']/g, '');
  }

  function heuristicSyllables(word) {
    var w = wordKey(word).replace(/'/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^aeiouy]es|ed)$/, function (m) { return m.length === 3 ? m.charAt(0) : ''; });
    if (/e$/.test(w) && !/[^aeiouy]le$/.test(w)) w = w.slice(0, -1);
    w = w.replace(/^y/, '');
    var groups = w.match(/[aeiouy]{1,2}/g);
    return groups ? groups.length : 1;
  }

  function spellingRhyme(word) {
    var w = wordKey(word).replace(/'/g, '');
    if (w.length > 3 && /[^s]s$/.test(w)) w = w.slice(0, -1);
    if (w.length > 3 && /[^aeiouy]e$/.test(w)) w = w.slice(0, -1);
    var match = w.match(/([aeiouy]+)([^aeiouy]*)$/);
    if (!match) return { vowel: w, coda: '', tail: w, source: 'spell' };
    return { vowel: match[1], coda: match[2], tail: match[1] + match[2], source: 'spell' };
  }

  function syllablesOfWord(word) {
    var key = wordKey(word).replace(/'/g, '');
    if (!key) return 0;
    if (dict[key] && dict[key].syl) return dict[key].syl;
    return heuristicSyllables(key);
  }

  function syllables(text) {
    return String(text || '').split(/[\s-]+/).reduce(function (sum, word) {
      return sum + syllablesOfWord(word);
    }, 0);
  }

  function lastWord(text) {
    var words = String(text || '').toLowerCase().replace(/[^a-z\s']/g, ' ').trim().split(/\s+/);
    return words[words.length - 1] || '';
  }

  function rhymeOfWord(word) {
    var key = wordKey(word).replace(/'/g, '');
    var spell = spellingRhyme(key);
    var known = dict[key];
    if (known && known.vowel) {
      return {
        vowel: known.vowel,
        coda: known.coda || '',
        tail: known.vowel + (known.coda || ''),
        source: 'dict'
      };
    }
    return spell;
  }

  function rhymeOfLine(text) {
    return rhymeOfWord(lastWord(text));
  }

  function relateWords(a, b) {
    var left = typeof a === 'string' ? rhymeOfWord(a) : a;
    var right = typeof b === 'string' ? rhymeOfWord(b) : b;
    if (!left || !right || !left.vowel || !right.vowel) return 'none';
    if (left.vowel === right.vowel && left.coda === right.coda) return 'exact';
    if (left.vowel === right.vowel) return 'near';
    if (left.tail && left.tail === right.tail) return 'exact';
    return 'none';
  }

  function colorLines(texts) {
    var lines = texts || [];
    var ends = lines.map(rhymeOfLine);
    var count = ends.length;
    var parent = [];
    var i;
    var j;
    for (i = 0; i < count; i += 1) parent[i] = i;
    function find(x) {
      while (parent[x] !== x) x = parent[x];
      return x;
    }
    for (i = 0; i < count; i += 1) {
      for (j = i + 1; j < count; j += 1) {
        if (relateWords(ends[i], ends[j]) === 'exact') parent[find(i)] = find(j);
      }
    }
    var members = {};
    for (i = 0; i < count; i += 1) {
      var root = find(i);
      if (!members[root]) members[root] = [];
      members[root].push(i);
    }
    var color = {};
    var next = 0;
    Object.keys(members).forEach(function (key) {
      if (members[key].length < 2) return;
      var index = next;
      next += 1;
      members[key].forEach(function (at) {
        color[at] = { index: index, near: false, bg: HL[index % HL.length] };
      });
    });
    for (i = 0; i < count; i += 1) {
      for (j = i + 1; j < count; j += 1) {
        if (relateWords(ends[i], ends[j]) !== 'near') continue;
        var iExact = color[i] && !color[i].near;
        var jExact = color[j] && !color[j].near;
        if (iExact && jExact) continue;
        var index = iExact ? color[i].index : (jExact ? color[j].index : (color[i] ? color[i].index : (color[j] ? color[j].index : next)));
        if (!iExact && !jExact && !color[i] && !color[j]) next += 1;
        if (!iExact) color[i] = { index: index, near: true, bg: HL_NEAR[index % HL_NEAR.length] };
        if (!jExact) color[j] = { index: index, near: true, bg: HL_NEAR[index % HL_NEAR.length] };
      }
    }
    return color;
  }

  function dotKind(index, count, target) {
    var n = Math.max(0, count);
    var goal = Math.max(0, target);
    var filled = Math.min(n, goal);
    if (index < filled) return 'fill';
    if (index < goal) return 'room';
    return 'extra';
  }

  try {
    if (typeof require === 'function') load(require('../data/cmu-trim.json'));
  } catch (err) {
    dict = dict || {};
  }

  return {
    HL: HL,
    HL_NEAR: HL_NEAR,
    load: load,
    syllables: syllables,
    syllablesOfWord: syllablesOfWord,
    lastWord: lastWord,
    rhymeOfWord: rhymeOfWord,
    relateWords: relateWords,
    colorLines: colorLines,
    dotKind: dotKind,
    spellingRhyme: spellingRhyme
  };
}));
