/*
 * Prompt check for music style prompts. Runs before Song Lab shows a style prompt.
 * Pure functions, shared by the page (window.PromptCheck) and the server.
 * Rules: the Arcade theme is the UI only, never the sound. No robot or game words,
 * no "no X" phrasing (those go to Exclude), one vocal line, 120 to 200 chars in strict mode.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PromptCheck = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Words that push the voice robotic or the track toward chiptune. Matched per comma part.
  var BAN = [
    /chip ?tune/i, /\b(8|16)[ -]?bit\b/i, /bit ?crush/i, /\barcade\b/i, /video ?game/i, /\bgames?\b/i, /\bgaming\b/i,
    /\bpixel/i, /retro arcade/i, /retro game/i, /square wave/i, /vocoder/i, /talk ?box/i, /robot/i, /glitch/i,
    /pitched(\s+(up|down))?\s+(lead\s+)?vocal/i, /chopped pitched/i, /chipmunk/i, /formant/i, /music ?box/i, /level ?up/i
  ];
  var BAN_WORDS = ['chiptune', '8-bit', 'bitcrush', 'arcade', 'video game', 'game', 'pixel', 'retro arcade', 'vocoder', 'talkbox', 'robotic', 'glitch', 'pitched vocal', 'music box', 'level up'];
  var BASE_EXCLUDE = ['chiptune', '8-bit', 'vocoder', 'robotic vocals', 'autotune', 'synth-pop'];
  var VOCAL_RX = /\b(vocals?|voice|rap|rapped|rapping|sung|singer|singing|toasting|crooner|falsetto)\b/i;
  var SLIDERS = { weirdness: 25, styleInfluence: 65 };

  function banned(part) { return BAN.some(function (rx) { return rx.test(part); }); }
  function parts(style) { return String(style || '').split(',').map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean); }
  function uniq(list) { var seen = {}; return list.filter(function (x) { var k = String(x).toLowerCase(); if (!k || seen[k]) return false; seen[k] = 1; return true; }); }

  // checkStyle(style, ctx) -> { style, exclude, warnings, sliders, ok }
  // ctx.strict: enforce 120 to 200 chars and one vocal line in the first 60 chars.
  // ctx.gender: 'male' | 'female' to exclude the other voice. ctx.keepFirst: parts never trimmed (genre, vocal).
  function checkStyle(style, ctx) {
    ctx = ctx || {};
    var warnings = [];
    var exclude = [];
    var list = [];
    parts(String(style || '').replace(/\u2014|\u2013/g, ', ')).forEach(function (pt) {
      var neg = pt.match(/^(?:no|without|avoid:?|zero)\s+(.+)$/i);
      if (neg) { exclude.push(neg[1].toLowerCase()); warnings.push('Moved "' + pt + '" to Exclude'); return; }
      if (banned(pt)) { warnings.push('Removed "' + pt + '"'); return; }
      list.push(pt);
    });
    // Exactly one vocal line: keep the first, drop the rest. Production notes like "dry vocal up front" count too.
    var vocalSeen = false;
    list = list.filter(function (pt) {
      if (!ctx.strict || !VOCAL_RX.test(pt)) return true;
      if (!vocalSeen) { vocalSeen = true; return true; }
      warnings.push('Dropped extra vocal "' + pt + '"');
      return false;
    });
    list = uniq(list);
    var keep = Math.max(0, Number(ctx.keepFirst) || 0);
    var out = list.join(', ');
    if (ctx.strict) {
      while (out.length > 200 && list.length > keep + 1) { list.pop(); out = list.join(', '); }
      if (out.length > 200) out = out.slice(0, 200).replace(/,[^,]*$/, '');
      if (out.length < 120) warnings.push('Short prompt (' + out.length + ' chars)');
      var vi = list.findIndex(function (pt) { return VOCAL_RX.test(pt); });
      var at = vi < 0 ? -1 : out.indexOf(list[vi]);
      if (at < 0 || at > 60) warnings.push('Vocal line is not in the first 60 chars');
    }
    var balance = ctx.genreWords ? genreBalance(out, ctx.genreWords) : null;
    if (balance && balance.top > 0.6) warnings.push('Genre balance: ' + balance.lead + ' has ' + Math.round(balance.top * 100) + '% of genre words');
    var g = String(ctx.gender || '').toLowerCase();
    if (g === 'male') exclude.push('female vocals');
    if (g === 'female') exclude.push('male vocals');
    var low = out.toLowerCase();
    BASE_EXCLUDE.forEach(function (x) { if (low.indexOf(x) === -1) exclude.push(x); });
    exclude = uniq(exclude).slice(0, 8);
    return { style: out, exclude: exclude, warnings: warnings, sliders: { weirdness: SLIDERS.weirdness, styleInfluence: SLIDERS.styleInfluence }, balance: balance, ok: !BAN.some(function (rx) { return rx.test(out); }) && !(balance && balance.top > 0.6) };
  }

  // Count each fused genre's signature words in the prompt. words: { 'Hip hop': ['rap', 'boom bap'], 'Reggae': [...] }.
  function genreBalance(style, words) {
    var low = String(style || '').toLowerCase(); var counts = {}; var total = 0;
    Object.keys(words || {}).forEach(function (g) {
      counts[g] = (words[g] || []).reduce(function (n, w) { var m = low.match(new RegExp('\\b' + String(w).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')); return n + (m ? m.length : 0); }, 0);
      total += counts[g];
    });
    var lead = ''; var top = 0;
    Object.keys(counts).forEach(function (g) { var share = total ? counts[g] / total : 0; if (share > top) { top = share; lead = g; } });
    return { counts: counts, total: total, lead: lead, top: top };
  }

  function hasBanned(text) { return BAN.some(function (rx) { return rx.test(String(text || '')); }); }

  // Add voice tags under section labels so the vocal stays put: [Verse] -> [Rap], [Chorus] -> [Sung].
  // voice: { verse: 'Rap' | 'Sung', chorus: 'Sung', gender: 'Male' | 'Female' }.
  function tagLyrics(lyrics, voice) {
    voice = voice || {};
    var g = voice.gender === 'Male' || voice.gender === 'Female' ? '[' + voice.gender + ' Vocal]' : '';
    var lines = String(lyrics || '').replace(/\r/g, '').split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      out.push(line);
      var m = line.trim().match(/^\[([^\]]+)\]$/);
      if (!m) continue;
      var label = m[1].toLowerCase();
      if (/^(male|female) vocal$|^rap$|^sung$|^harmonies$|^spoken word$/.test(label)) continue;
      var next = String(lines[i + 1] || '').trim();
      if (/^\[(male vocal|female vocal|rap|sung|harmonies|spoken word)\]/i.test(next)) continue;
      var tags = [];
      if (/verse|bridge|pre/.test(label)) { if (g && /verse 1|^verse$/.test(label)) tags.push(g); tags.push('[' + (voice.verse || 'Sung') + ']'); }
      else if (/chorus|hook/.test(label)) { tags.push('[' + (voice.chorus || 'Sung') + ']'); tags.push('[Harmonies]'); }
      if (tags.length) out.push(tags.join(' '));
    }
    return out.join('\n');
  }

  return { checkStyle: checkStyle, genreBalance: genreBalance, hasBanned: hasBanned, tagLyrics: tagLyrics, BAN_WORDS: BAN_WORDS, BASE_EXCLUDE: BASE_EXCLUDE, SLIDERS: SLIDERS };
});
