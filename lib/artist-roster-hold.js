/**
 * Typed / session leftovers must not appear on Submit New Release.
 * Your Artists (profile.artists) is the only selectable set.
 * Create new / Import stay as actions on the official picker.
 */
(function (root) {
  var KEY = 'plaiground.roster.artists';

  function remember() {
    return;
  }

  function paintSelect() {
    return;
  }

  root.PlaigroundArtistRosterHold = {
    remember: remember,
    paint: paintSelect,
    key: KEY,
  };
})(typeof window !== 'undefined' ? window : this);
