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
      words: ['hyphy', 'go dumb', 'hella', 'turf', 'yadadamean', 'slaps', 'mobbin', 'fa sho', 'yee', 'the Town', 'the Yay', 'scraper', 'sideshow', 'fetti', 'scrilla', 'cutty', 'potna', 'stunna', 'tighten up', 'function', 'dummy', 'sick wit it'],
      explicitWords: ['thizz', 'thizz face', 'slizzard', 'bammer'],
      rule: 'Hyphy mode: write it like the Bay. '
    }
  };
  // How hyphy? Lyrics and sound both scale with the level.
  var LEVELS = [
    { id: 'little', label: 'A little', lyric: 'Work in 1 or 2 Bay Area slang words total where they fit the meaning, never forced', sound: ['subtle Bay bounce'] },
    { id: 'hyphy', label: 'Hyphy', lyric: 'Work in 2 to 4 Bay Area slang words where they fit the meaning, never forced, at most one per line. ' + 'Hyphy structure: short punchy bars, a chantable repeated hook with call and response, crowd ad-libs in parentheses, one [Hype Break] chant section, bouncy cadence', sound: ['thumping hyphy bounce', 'heavy synth bass'], delivery: 'energetic chant-rap delivery and call and response hook' },
    { id: 'dumb', label: 'Go dumb', lyric: 'Put a Bay Area slang word in most lines and add Bay ad-libs in parentheses like (yee) and (go dumb), still keep the meaning right. ' + 'Hyphy structure: short punchy bars, a chantable repeated hook with call and response, crowd ad-libs in parentheses, a [Hype Break] chant section, double-time or bouncy cadence', sound: ['fast thumping hyphy bounce', 'heavy synth bass', 'hand claps', 'party chants'], delivery: 'energetic shouted chant-rap delivery and call and response hook', bpm: [100, 110] }
  ];
  function level(id) { for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i]; return LEVELS[1]; }
  function nextLevel(id) { var i = LEVELS.indexOf(level(id)); return LEVELS[Math.min(LEVELS.length - 1, i + 1)].id; }
  // Sound words for the style prompt (Both badge). Never slang words, only the hyphy sound.
  function soundFor(id, lvl) { if (!modeFor(id)) return null; var L = level(lvl); return { terms: L.sound.slice(), bpm: L.bpm || null, delivery: L.delivery || '' }; }
  function modeFor(id) { return MODES[id] || null; }
  // Lyric writer instruction. Slang never goes in the style prompt.
  function lyricRule(id, explicitOk, lvl) {
    var m = modeFor(id); if (!m) return '';
    var words = m.words.concat(explicitOk ? m.explicitWords : []);
    return m.rule + level(lvl).lyric + '. Pick from: ' + words.join(', ') + '. Keep the meaning right: hyphy means wild energy, go dumb means dance wild, hella means very, turf means the Oakland dance, fetti and scrilla mean money, cutty and potna mean close friend. When you rewrite an existing line, keep its last rhyme word.' + (explicitOk ? ' Thizz is a drug reference, use it lightly or not at all.' : ' No drug words.');
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
  return { LEVELS: LEVELS, level: level, nextLevel: nextLevel, soundFor: soundFor, MODES: MODES, modeFor: modeFor, lyricRule: lyricRule, matcher: matcher, findTerms: findTerms, popover: popover };
});
