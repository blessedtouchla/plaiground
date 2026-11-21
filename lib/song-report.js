'use strict';

/**
 * Plain notes for a song. Marks and short facts only.
 * No percentage, no grade, no score.
 */
(function (root, factory) {
  var engine = (typeof module === 'object' && module.exports) ? require('./word-engine') : root.WordEngine;
  var api = factory(engine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SongReport = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (engine) {
  var PICTURES = ['plates', 'cup', 'window', 'kitchen', 'kettle', 'block', 'house', 'room', 'coffee', 'seats', 'lunch', 'receipts', 'call'];
  var BANNED = /%|\bscore\b|\bgrade\b|\bpercent\b|—|–/i;

  function words(text) {
    return String(text || '').toLowerCase().split(/[^a-z']+/).filter(Boolean);
  }

  function build(input) {
    var song = input || {};
    var lines = Array.isArray(song.lines) ? song.lines : [];
    var texts = lines.map(function (line) { return line.text || ''; });
    var colors = engine.colorLines(texts);
    var rhyme = [];
    var seen = {};
    texts.forEach(function (text, index) {
      var mark = colors[index];
      if (!mark) {
        var alone = engine.lastWord(text);
        if (alone) rhyme.push({ text: alone + ' ~', exact: false, near: false });
        return;
      }
      var key = mark.index + ':' + (mark.near ? 'near' : 'exact');
      if (seen[key]) return;
      seen[key] = true;
      var group = [];
      texts.forEach(function (other, at) {
        var peer = colors[at];
        if (peer && peer.index === mark.index && peer.near === mark.near) group.push(engine.lastWord(other));
      });
      rhyme.push({
        text: group.join(' · ') + (mark.near ? ' ~' : ' ✓'),
        exact: !mark.near,
        near: !!mark.near,
        index: mark.index
      });
    });
    var beats = lines.map(function (line, index) {
      var count = engine.syllables(line.text || '');
      var target = Number(line.target) || 0;
      return {
        label: (line.section || 'Line') + ' · ' + (line.n || (index + 1)),
        count: count,
        target: target
      };
    });
    var pictures = [];
    texts.forEach(function (text) {
      var bag = words(text);
      PICTURES.forEach(function (word) {
        if (bag.indexOf(word) >= 0 && pictures.indexOf(word) < 0) pictures.push(word);
      });
    });
    var counts = {};
    texts.forEach(function (text) {
      words(text).forEach(function (word) {
        if (word.length > 3) counts[word] = (counts[word] || 0) + 1;
      });
    });
    var repeats = Object.keys(counts).filter(function (word) { return counts[word] > 1; }).map(function (word) {
      return { word: word, n: counts[word], text: word + ' ×' + counts[word] };
    });
    return {
      title: song.title || '',
      stamp: song.stamp || '',
      rhyme: rhyme,
      beats: beats,
      pictures: pictures,
      repeats: repeats.length ? repeats : [{ word: '', n: 0, text: 'none' }]
    };
  }

  function plainText(report) {
    var notes = report || build({});
    var lines = [notes.title || ''];
    notes.rhyme.forEach(function (row) { lines.push(row.text); });
    notes.beats.forEach(function (row) { lines.push(row.label); });
    notes.pictures.forEach(function (word) { lines.push(word + ' ✓'); });
    notes.repeats.forEach(function (row) { lines.push(row.text); });
    if (notes.stamp) lines.push(notes.stamp);
    return lines.join('\n');
  }

  function hasGrade(text) {
    return BANNED.test(String(text || ''));
  }

  return {
    PICTURES: PICTURES,
    build: build,
    plainText: plainText,
    hasGrade: hasGrade
  };
}));
