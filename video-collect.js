(function (global) {
  var PLAN_LOCK = 'Creator and Pro only.';
  var CONNECTION_ERROR = 'Video Collect could not be turned on. The payout connection is not available.';

  function $(sel) {
    return global.document && global.document.querySelector(sel);
  }

  function hasPaidAccess() {
    var api = global.PlaigroundMembership;
    return !!(api && typeof api.hasPaidAccess === 'function' && api.hasPaidAccess());
  }

  function setError(text) {
    var el = $('[data-video-collect-error]');
    if (el) el.textContent = text;
    return text;
  }

  function lockToggle(toggle) {
    if (!toggle) return;
    toggle.checked = false;
    toggle.disabled = true;
    toggle.setAttribute('aria-disabled', 'true');
    toggle.setAttribute('aria-checked', 'false');
    var label = $('[data-video-collect-label]');
    if (label && label.classList && label.classList.add) label.classList.add('is-locked');
    var knob = toggle.nextElementSibling;
    if (knob && knob.classList && knob.classList.remove) knob.classList.remove('on');
  }

  function status() {
    var paid = hasPaidAccess();
    return {
      on: false,
      locked: true,
      paid: paid,
      error: paid ? CONNECTION_ERROR : PLAN_LOCK,
    };
  }

  function apply() {
    var toggle = $('[data-video-collect-toggle]');
    if (!toggle) return status();
    lockToggle(toggle);
    var next = status();
    setError(next.error);
    return next;
  }

  function bind() {
    var toggle = $('[data-video-collect-toggle]');
    if (!toggle) return apply();
    toggle.addEventListener('click', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      lockToggle(toggle);
      setError(status().error);
    });
    toggle.addEventListener('change', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      lockToggle(toggle);
      setError(status().error);
    });
    return apply();
  }

  global.PlaigroundVideoCollect = {
    apply: apply,
    bind: bind,
    status: status,
    PLAN_LOCK: PLAN_LOCK,
    CONNECTION_ERROR: CONNECTION_ERROR,
  };
  bind();
})(window);
