'use strict';

/**
 * Fresher stand-ins for instruments people pick on autopilot.
 * Sound words only. No artist or band names.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StyleSwaps = api;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  var SWAPS = [
    { from: 'piano', to: 'Rhodes' },
    { from: 'electric piano', to: 'Wurlitzer' },
    { from: 'soft piano', to: 'felt piano' },
    { from: 'acoustic guitar', to: 'nylon guitar' },
    { from: 'warm acoustic guitar', to: 'nylon guitar' },
    { from: 'bare guitar', to: 'resonator guitar' },
    { from: 'electric guitar', to: 'clean guitar' },
    { from: '808s', to: 'handpan' },
    { from: '808', to: 'handpan' },
    { from: 'hard 808s', to: 'handpan' },
    { from: 'sliding 808s', to: 'clay pot drum' },
    { from: 'live drums', to: 'brushed drums' },
    { from: 'big drums', to: 'frame drum' },
    { from: 'heavy drums', to: 'taiko' },
    { from: 'hard drums', to: 'frame drum' },
    { from: 'bass', to: 'upright bass' },
    { from: 'synth', to: 'analog synth' },
    { from: 'strings', to: 'solo cello' },
    { from: 'claps', to: 'finger snaps' },
    { from: 'hand claps', to: 'finger snaps' },
    { from: 'horns', to: 'muted trumpet' },
    { from: 'pad', to: 'glass harmonica' }
  ];

  return { SWAPS: SWAPS };
}));
