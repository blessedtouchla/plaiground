/**
 * Stage, song game, and stage stats each have their own switch.
 * Turn one off here and the others keep working.
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
  };

  function enabled(name) {
    return FLAGS[name] === true;
  }

  return {
    FLAGS: FLAGS,
    enabled: enabled,
  };
});
