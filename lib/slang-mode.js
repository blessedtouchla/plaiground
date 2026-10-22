/*
 * Slang modes for Song Lab lyric rewrites (Bay Area / Hyphy first).
 * Shared by the page (window.SlangMode) and the server. Words live in data/slang.json with a cited source each.
 * findTerms() marks slang in any line so the page can underline it and show a tap-to-define popover.
 * Rules: no em dashes, explicit words only when explicit is OK, slang goes in lyrics only, never in the style prompt.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SlangMode = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var MODES = {
    bay: {
      id: 'bay', label: 'Hyphy / Bay Area', region: 'Bay Area',
      words: ['hyphy', 'go dumb', 'hella', 'turf'],
      explicitWords: ['thizz', 'thizz face'],
      rule: 'Hyphy mode: write it like the Bay. Work in 2 to 4 of these Bay Area slang words where they fit the meaning, never forced, at most one per line: '
    }
  };
  function modeFor(id) { return MODES[id] || null; }
  // Lyric writer instruction. Slang never goes in the style prompt.
  function lyricRule(id, explicitOk) {
    var m = modeFor(id); if (!m) return '';
    var words = m.words.concat(explicitOk ? m.explicitWords : []);
    return m.rule + words.join(', ') + '. Keep the meaning right: hyphy means wild energy, go dumb means dance wild, hella means very, turf means the Oakland dance.' + (explicitOk ? ' Thizz is a drug reference, use it lightly or not at all.' : ' No drug words.');
  }
  function esc(w) { return String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // Build a matcher from slang entries (data/slang.json). region filters (e.g. 'Bay Area'); empty = all.
  function matcher(entries, region) {
    var list = [];
    (entries || []).forEach(function (e) {
      if (region && e.region_tag !== region) return;
      [e.word].concat(e.variants || []).forEach(function (w) { if (w) list.push({ w: String(w), e: e }); });
    });
    list.sort(function (a, b) { return b.w.length - a.w.length; });
    if (!list.length) return null;
    var rx = new RegExp('(^|[^A-Za-z\'])(' + list.map(function (x) { return esc(x.w); }).join('|') + ')(?=$|[^A-Za-z])', 'gi');
    var byWord = {};
    list.forEach(function (x) { byWord[x.w.toLowerCase()] = x.e; });
    return { rx: rx, byWord: byWord };
  }
  // Split a line into [{text}, {text, entry}] parts.
  function findTerms(line, m) {
    var s = String(line || ''); var out = []; var last = 0;
    if (!m) return [{ text: s }];
    m.rx.lastIndex = 0; var hit;
    while ((hit = m.rx.exec(s))) {
      var start = hit.index + hit[1].length; var word = hit[2];
      if (start > last) out.push({ text: s.slice(last, start) });
      out.push({ text: word, entry: m.byWord[word.toLowerCase()] });
      last = start + word.length;
    }
    if (last < s.length) out.push({ text: s.slice(last) });
    return out;
  }
  // Popover copy: one or two plain lines plus an example. Sources stay in the data.
  function popover(entry) {
    if (!entry) return null;
    return { word: entry.word, define: String(entry.define || entry.meaning || '').replace(/\u2014|\u2013/g, ', '), example: entry.example || '', explicit: !!(entry.explicit || entry.profanity) };
  }
  return { MODES: MODES, modeFor: modeFor, lyricRule: lyricRule, matcher: matcher, findTerms: findTerms, popover: popover };
});
