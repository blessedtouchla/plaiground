'use strict';

/**
 * Pure helpers for the notebook page: sticky notes, swaps, export text, stamp.
 */
(function (root, factory) {
  var engine = (typeof module === 'object' && module.exports) ? require('./word-engine') : root.WordEngine;
  var api = factory(engine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SongLabUI = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (engine) {
  var IMAGES = ['plates', 'cup', 'window', 'kitchen', 'kettle', 'block', 'house', 'room', 'coffee', 'seats', 'lunch', 'receipts', 'call'];
  var FILLERS = ['still', 'just', 'really', 'that', 'the', 'and', 'so'];

  function last(text) {
    return engine.lastWord(text);
  }

  function locked(a, b) {
    var left = engine.rhymeOfWord(a);
    var right = engine.rhymeOfWord(b);
    return engine.relateWords(left, right) === 'exact';
  }

  function noteFor(opts) {
    var line = opts.line;
    var partner = opts.partner || { text: '' };
    var target = opts.target || 0;
    var text = line.text || '';
    var count = engine.syllables(text);
    var extra = count - target;
    var end = last(text);
    var partnerEnd = last(partner.text || '');
    var lock = end && partnerEnd && locked(end, partnerEnd);
    var bag = text.toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/);
    var image = IMAGES.filter(function (word) { return bag.indexOf(word) >= 0; })[0];
    var filler = FILLERS.filter(function (word) { return bag.indexOf(word) >= 0; })[0];
    if (opts.justPicked && line.picked === 'slang') {
      var word = opts.slangWord || '';
      return '"' + word + '" fits the ' + (opts.region || '') + ' pocket here. ' + (extra >= 2 ? extra + ' extra, ride it fast.' : 'Sits right.');
    }
    if (opts.justPicked) {
      return lock
        ? 'Blue ink still locks "' + end + '" with "' + partnerEnd + '". Nice swap.'
        : 'New ink, ' + count + ' beats. "' + end + '" wants a partner.';
    }
    if (extra >= 2) return extra + ' extra beats. Drop "' + (filler || bag[0] || end) + '" or ride it fast.';
    if (extra <= -2) return 'Room for ' + (-extra) + ' more beats after "' + end + '".';
    if (!lock && partnerEnd) return '"' + end + '" floats. Rhyme can lock it with "' + partnerEnd + '".';
    if (image) return 'Love the ' + image + '. Real picture, keep it.';
    if (partnerEnd) return '"' + end + '" and "' + partnerEnd + '" lock. Leave it.';
    return '';
  }

  function taggedLyrics(song) {
    return (song.secs || []).map(function (sec) {
      return '[' + sec.tag + ']\n' + sec.lines.map(function (line) { return line.text; }).join('\n');
    }).join('\n\n');
  }

  function cleanLyrics(song) {
    return (song.secs || []).map(function (sec) {
      return sec.lines.map(function (line) { return line.text; }).join('\n');
    }).join('\n\n');
  }

  function styleLine(state) {
    return [state.genre, state.era, state.region, state.language].filter(Boolean).join(', ');
  }

  function nextStamp(index) {
    var at = Number(index) || 0;
    return (at + 1) % 3;
  }

  return {
    noteFor: noteFor,
    taggedLyrics: taggedLyrics,
    cleanLyrics: cleanLyrics,
    styleLine: styleLine,
    nextStamp: nextStamp
  };
}));
