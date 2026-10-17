/**
 * Free rhyme lookup helpers for Song Helper.
 * Datamuse supplies the words. This file never calls an AI model.
 * Browser and server. No secrets.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundRhyme = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var EMPTY = 'No rhymes found, try another word';
  var BLOCKED = {
    fuck: 1, fucks: 1, fucked: 1, fucker: 1, fuckers: 1, fucking: 1,
    motherfucker: 1, motherfuckers: 1,
    shit: 1, shits: 1, shitty: 1, bullshit: 1,
    bitch: 1, bitches: 1,
    ass: 1, asses: 1, asshole: 1, assholes: 1,
    dick: 1, dicks: 1, dickhead: 1,
    cock: 1, cocks: 1,
    pussy: 1, pussies: 1,
    cunt: 1, cunts: 1,
    whore: 1, whores: 1,
    pervert: 1, perverts: 1,
    slut: 1, sluts: 1,
    bastard: 1, bastards: 1,
    piss: 1, pissed: 1,
    fart: 1, farts: 1, clart: 1, arse: 1,
    tits: 1, titties: 1,
    nigger: 1, niggers: 1, nigga: 1, niggas: 1,
    faggot: 1, faggots: 1, fag: 1,
    tranny: 1,
    retard: 1, retarded: 1, retards: 1,
    kike: 1, spic: 1, spics: 1, chink: 1, chinks: 1, wetback: 1, beaner: 1,
  };

  function fold(word) {
    return String(word || '').toLowerCase()
      .replace(/0/g, 'o')
      .replace(/1/g, 'i')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/@/g, 'a')
      .replace(/\$/g, 's')
      .replace(/[^a-z]/g, '');
  }

  function blocked(word) {
    var key = fold(word);
    if (!key) return false;
    if (BLOCKED[key]) return true;
    var tight = key.replace(/(.)\1{2,}/g, '$1');
    return !!BLOCKED[tight];
  }

  function queryWord(raw) {
    var word = String(raw || '').toLowerCase().replace(/[^a-z'-]/g, '').replace(/^[-']+|[-']+$/g, '');
    if (word.length < 2 || word.length > 32) return '';
    if (!/^[a-z][a-z'-]*$/.test(word)) return '';
    if (blocked(word)) return '';
    return word;
  }

  function wordsFrom(rows) {
    var out = [];
    var seen = {};
    var list = Array.isArray(rows) ? rows : [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      var row = list[i];
      var word = String(row && row.word != null ? row.word : row || '').trim().toLowerCase();
      if (!/^[a-z][a-z'-]{0,23}$/.test(word)) continue;
      if (blocked(word)) continue;
      if (seen[word]) continue;
      seen[word] = true;
      out.push(word);
      if (out.length >= 8) break;
    }
    return out;
  }

  function packRhymes(perfectRows, closeRows) {
    var perfect = wordsFrom(perfectRows);
    var seen = {};
    perfect.forEach(function (word) { seen[word] = true; });
    var close = wordsFrom(closeRows).filter(function (word) { return !seen[word]; });
    return { perfect: perfect, close: close, empty: !perfect.length && !close.length };
  }

  function placeWord(text, start, end, word) {
    var value = String(text || '');
    var clean = String(word || '').trim();
    var a = start == null ? value.length : start;
    var b = end == null ? a : end;
    if (a < 0) a = 0;
    if (a > value.length) a = value.length;
    if (b < a) b = a;
    if (b > value.length) b = value.length;
    var before = value.slice(0, a);
    var after = value.slice(b);
    var lead = before && !/\s$/.test(before) ? ' ' : '';
    var trail = after && !/^\s/.test(after) ? ' ' : '';
    var next = before + lead + clean + trail + after;
    return { text: next, caret: (before + lead + clean).length };
  }

  function datamuseUrl(rel, word) {
    return 'https://api.datamuse.com/words?' + rel + '=' + encodeURIComponent(word) + '&max=24';
  }

  return {
    EMPTY: EMPTY,
    blocked: blocked,
    queryWord: queryWord,
    wordsFrom: wordsFrom,
    packRhymes: packRhymes,
    placeWord: placeWord,
    datamuseUrl: datamuseUrl,
  };
});
