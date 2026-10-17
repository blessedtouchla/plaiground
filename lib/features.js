/**
 * Stage, song game, stage stats, each game, and Song Helper tools
 * have their own switch. Turn one off here and the others keep working.
 * Browser and server. No secrets.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundFeatures = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var FLAGS = {
    STAGE_ENABLED: true,
    SONG_GAME_ENABLED: true,
    STAGE_STATS_ENABLED: true,
    GAME_HOOK_CATCHER: true,
    GAME_LYRIC_RACER: true,
    GAME_STAGE_HERO: true,
    // Song-part word tiles. Off. The mount code stays so it can be removed.
    WORD_TILES_ENABLED: false,
    // Song Helper small tools. The panel and each tool switch on their own.
    SONG_TOOLS_ENABLED: true,
    TOOL_RHYME_IT: true,
    // Guided question and topic tiles above each song part.
    GUIDE_TILES_ENABLED: true,
  };

  function enabled(name) {
    return FLAGS[name] === true;
  }

  return {
    FLAGS: FLAGS,
    enabled: enabled,
  };
});
