(function () {
  var KEY = 'plaiground.playground.stage';
  var root = document.querySelector('.playground');
  if (!root) return;
  var chips = root.querySelectorAll('.play-chip[data-stage]');

  function apply(stage) {
    if (stage) root.setAttribute('data-stage', stage);
    else root.removeAttribute('data-stage');
    Array.prototype.forEach.call(chips, function (btn) {
      var on = btn.getAttribute('data-stage') === stage;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-on', on);
    });
  }

  var saved = '';
  try { saved = localStorage.getItem(KEY) || ''; } catch (err) { saved = ''; }
  if (saved === 'idea' || saved === 'made' || saved === 'out') apply(saved);

  Array.prototype.forEach.call(chips, function (btn) {
    btn.addEventListener('click', function () {
      var stage = btn.getAttribute('data-stage');
      apply(stage);
      try { localStorage.setItem(KEY, stage); } catch (err) {}
    });
  });
})();
