/** Per-song disclosure. Not used on profile. */
(function (root) {
  var BADGE = {
    lyrics: 'HUMAN Words',
    vocal: 'HUMAN Vox',
    played: 'HUMAN Played',
    mix: 'HUMAN Mix'
  };

  function badges(made, humans) {
    if (made === 'full_ai') return ['FULL AI'];
    if (made === 'no_ai') return ['NO AI'];
    var out = ['AI assisted'];
    (humans || []).forEach(function (key) {
      if (BADGE[key]) out.push(BADGE[key]);
    });
    return out;
  }

  function bindForm(form) {
    if (!form) return;
    var assisted = form.querySelector('[data-assisted-fields]');
    var platform = form.querySelector('[data-platform-fields]');
    function sync() {
      var made = (form.querySelector('input[name="made"]:checked') || {}).value;
      if (assisted) assisted.hidden = made !== 'ai_assisted';
      if (platform) platform.hidden = made === 'no_ai';
    }
    form.addEventListener('change', sync);
    sync();
  }

  root.PlaigroundCommunityDisclose = { badges: badges, bindForm: bindForm };
})(typeof window !== 'undefined' ? window : this);
