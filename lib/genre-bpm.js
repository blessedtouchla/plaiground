'use strict';

/**
 * Typical tempo for each Song Lab pad. One default per pad.
 * Hip hop uses the boom bap pocket. Trap and drill sit on the side as a note.
 * These are starting points for the cassette tag, not rules.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GenreBpm = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var TABLE = {
    Pop: { min: 100, max: 130, bpm: 116 },
    'Hip hop': { min: 85, max: 95, bpm: 90, alt: { name: 'trap and drill', min: 130, max: 160, bpm: 140 } },
    'R&B': { min: 60, max: 80, bpm: 70 },
    Soul: { min: 70, max: 120, bpm: 90 },
    Country: { min: 90, max: 130, bpm: 110 },
    Reggae: { min: 60, max: 90, bpm: 75 },
    Latin: { min: 88, max: 100, bpm: 95 },
    Rock: { min: 110, max: 140, bpm: 120 },
    Electronic: { min: 118, max: 130, bpm: 125 }
  };

  function row(genre) {
    return TABLE[genre] || null;
  }

  function bpm(genre) {
    var found = row(genre);
    return found ? found.bpm : 0;
  }

  function label(genre) {
    var n = bpm(genre);
    return n ? (n + ' BPM') : '';
  }

  return {
    TABLE: TABLE,
    genres: Object.keys(TABLE),
    row: row,
    bpm: bpm,
    label: label
  };
}));
