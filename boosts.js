(function (global) {
  var VALID = { available: true, 'not-live': true, active: true };

  function $(sel) {
    return document.querySelector(sel);
  }

  function $all(sel) {
    return document.querySelectorAll(sel);
  }

  function currentState() {
    var on = $('[data-boost-state].on');
    var key = on && on.getAttribute('data-boost-state');
    return VALID[key] ? key : 'available';
  }

  function setState(next) {
    var key = VALID[next] ? next : 'available';
    $all('[data-boost-state]').forEach(function (el) {
      if (el.classList && el.classList.toggle) {
        el.classList.toggle('on', el.getAttribute('data-boost-state') === key);
      }
    });
    $all('[data-boost-panel]').forEach(function (el) {
      var show = el.getAttribute('data-boost-panel') === key;
      el.hidden = !show;
      if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', !show);
    });
    return key;
  }

  function bind() {
    var host = $('[data-boost-states]');
    if (!host) return;
    host.addEventListener('click', function (event) {
      var choice = event.target && event.target.closest && event.target.closest('[data-boost-state]');
      if (!choice) return;
      event.preventDefault();
      setState(choice.getAttribute('data-boost-state'));
    });
    setState(currentState());
  }

  global.PlaigroundBoosts = { setState: setState, currentState: currentState };
  bind();
})(window);
