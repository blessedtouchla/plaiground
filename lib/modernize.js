'use strict';
/*
 * Flip My Song: "Modernize it". Line by line rewrite that keeps each line's syllable count,
 * end rhyme spots and story, so it still sings to the old melody. Public domain sources only.
 * Syllables are counted in code with the existing Song Helper counter (lib/song-modes.js lineRuler),
 * never trusted from the model. Shared by the page and the server.
 */
(function (root, factory) {
  var modes = (typeof module === 'object' && module.exports) ? require('./song-modes') : root.SongModes;
  var api = factory(modes);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Modernize = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (SongModes) {
  var PERSPECTIVES = [
    { id: 'woman', label: 'As a woman today' },
    { id: 'man', label: 'As a man today' },
    { id: 'teen', label: 'As a teen today' },
    { id: 'same', label: 'Same narrator, today' },
  ];
  var PD_NOTE = 'Modernize only from public domain text, like words published in the US before 1931. Never paste lyrics from a copyrighted recording or a newer version of the song.';
  var PD_CHECK = 'I confirm this source text is in the public domain.';

  var STRENGTHS = [
    { id: 'light', label: 'Light', rule: 'Light: change only 1 to 3 words per line. Keep most original words so it is still clearly the same song (a cover).', maxShare: 0.4 },
    { id: 'medium', label: 'Medium', rule: 'Medium: change up to about half the words in a line. Keep key images and the story so it is still the same song.', maxShare: 0.6 },
  ];
  function strength(id) { return STRENGTHS.filter(function (x) { return x.id === id; })[0] || STRENGTHS[0]; }
  function syllables(line) { return SongModes.lineRuler(String(line || '')).count; }
  function isTag(line) { return /^\s*\[.*\]\s*$/.test(line); }
  // Lyric lines to rewrite: blank lines and [tags] are kept out.
  function sourceLines(text) {
    return String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && !isTag(l); }).slice(0, 80);
  }
  // Hook lines never change: lines under a [Chorus]/[Hook]/[Refrain] tag, lines that repeat, lines with the title, and lines the user tapped.
  function hookLines(text, title, keep) {
    var hooks = {}; var seen = {}; var inHook = false; var t = String(title || '').toLowerCase().trim();
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var l = raw.trim(); if (!l) return;
      if (isTag(l)) { inHook = /chorus|hook|refrain/i.test(l); return; }
      var k = l.toLowerCase();
      if (inHook || seen[k] || (t && t.length > 2 && k.indexOf(t) !== -1)) hooks[k] = true;
      seen[k] = true;
    });
    (keep || []).forEach(function (l) { hooks[String(l).trim().toLowerCase()] = true; });
    return hooks;
  }
  function words(line) { return String(line || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean); }
  // Word diff by longest common subsequence. Marks each new word as kept or changed.
  function diffWords(orig, next) {
    var a = words(orig); var raw = String(next || '').split(/\s+/).filter(Boolean); var b = raw.map(function (w) { return words(w).join(''); });
    var L = []; for (var i = 0; i <= a.length; i++) { L[i] = []; for (var j = 0; j <= b.length; j++) L[i][j] = 0; }
    for (i = a.length - 1; i >= 0; i--) for (j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var kept = []; i = 0; j = 0;
    while (i < a.length && j < b.length) { if (a[i] === b[j]) { kept[j] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
    return { origWords: a.length, keptWords: L[0][0], changedWords: a.length - L[0][0], tokens: raw.map(function (w, k) { return { w: w, changed: !kept[k] }; }) };
  }
  function summary(pairs) {
    var total = 0; var changed = 0; var hookKept = true; var hooks = 0;
    pairs.forEach(function (p) { total += p.diff.origWords; changed += p.diff.changedWords; if (p.hook) { hooks++; if (p.line !== p.original) hookKept = false; } });
    var pct = total ? Math.round(100 * changed / total) : 0;
    return { pct: pct, hookKept: hookKept, hooks: hooks, note: pct + '% of original words changed' + (hooks ? (hookKept ? ', hook kept' : ', hook changed') : '') };
  }
  function perspectiveText(id, custom) {
    var c = String(custom || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (c) return c;
    var p = PERSPECTIVES.filter(function (x) { return x.id === id; })[0];
    return p ? p.label : 'Same narrator, today';
  }
  // Pair old and new lines, count both in code, flag any count that moved.
  function pairLines(orig, next, hooks, strengthId) {
    var st = strength(strengthId); hooks = hooks || {};
    return orig.map(function (o, i) {
      var hook = !!hooks[o.toLowerCase()];
      var n = hook ? o : String(next[i] || '').trim();
      var a = syllables(o); var b = syllables(n); var d = diffWords(o, n);
      var tooMuch = d.origWords ? d.changedWords / d.origWords > st.maxShare : false;
      return { i: i, original: o, line: n, hook: hook, origCount: a, newCount: b, diff: d, tooMuch: tooMuch, off: !n || a !== b };
    });
  }
  // Model output: one line per row, optional "12. " or "12) " numbering.
  function parseNumbered(text, want) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (l) {
      var m = l.match(/^\s*(\d+)[.):]\s*(.*)$/);
      if (m) { var k = Number(m[1]) - 1; if (k >= 0 && k < want) out[k] = m[2].replace(/^"|"$/g, '').trim(); }
    });
    if (out.filter(Boolean).length < Math.ceil(want / 2)) {
      out = String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && !isTag(l); });
    }
    for (var i = 0; i < want; i++) out[i] = String(out[i] || '').replace(/\u2014/g, ', ');
    return out.slice(0, want);
  }
  var RULES = 'You modernize public domain song lyrics into a close cover. Keep the title, the hook and chorus lines, the structure, the story and MOST of the original words. Only update some words. Keep the exact syllable count of each line, keep end rhymes on the same lines (lines that rhymed still rhyme with each other), and keep the story arc and the meaning of each line, so it sings to the original melody. Update the words, setting, objects and slang to today. Never use em dashes. Return only the numbered lines.';
  function prompt(lines, perspective, hooks, strengthId) {
    hooks = hooks || {};
    return 'Perspective: ' + perspective + '.\n' + strength(strengthId).rule + '\nRewrite each numbered line. Lines marked KEEP must be returned exactly as written. Return the same numbers, one line each, nothing else.\n' +
      lines.map(function (l, i) { return (i + 1) + '. ' + l + '  (' + syllables(l) + ' syllables' + (hooks[l.toLowerCase()] ? ', KEEP' : '') + ')'; }).join('\n');
  }
  function linePrompt(lines, i, perspective, tried, strengthId) {
    return 'Perspective: ' + perspective + '.\n' + strength(strengthId).rule + '\nWhole song for context:\n' + lines.join('\n') +
      '\n\nRewrite only this line: "' + lines[i] + '". It must be exactly ' + syllables(lines[i]) + ' syllables and end on a word that rhymes the same way the original line does.' +
      (tried ? ' The last try was "' + tried + '" (' + syllables(tried) + ' syllables). Fix the count.' : '') + '\nReturn only the new line.';
  }
  return { STRENGTHS: STRENGTHS, strength: strength, hookLines: hookLines, diffWords: diffWords, summary: summary, PERSPECTIVES: PERSPECTIVES, PD_NOTE: PD_NOTE, PD_CHECK: PD_CHECK, RULES: RULES, syllables: syllables, sourceLines: sourceLines, perspectiveText: perspectiveText, pairLines: pairLines, parseNumbered: parseNumbered, prompt: prompt, linePrompt: linePrompt };
}));
