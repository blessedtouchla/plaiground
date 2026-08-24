(function (global) {
  var CHECKOUT_URL = '/api/create-checkout-session';

  function closestTrigger(target) {
    if (!target || !target.closest) return null;
    var switcher = target.closest('[data-checkout-switch]');
    if (switcher) return switcher;
    var trigger = target.closest('[data-checkout-plan], [data-checkout-price]');
    if (!trigger) return null;
    if (trigger.hasAttribute('data-plan-option')) return null;
    return trigger;
  }

  function statusHost(trigger) {
    return (
      trigger.closest('[data-plan-confirm], .card-cta, .hero-ctas, .cta-inner, .card, .plan-switch, [data-manage-plan], .panel') ||
      trigger.parentNode
    );
  }

  function isPlanConfirmPage() {
    var path = String((global.location && global.location.pathname) || '');
    return path.split('/').pop() === 'plan-confirm.html';
  }

  function setStatus(trigger, text) {
    var host = statusHost(trigger);
    if (!host) return;
    var el = host.querySelector('[data-checkout-status]');
    if (!el) {
      el = document.createElement('p');
      el.setAttribute('data-checkout-status', '');
      el.className = 'learn';
      host.appendChild(el);
    }
    el.textContent = text || '';
    el.hidden = !text;
  }

  function isSwitch(trigger) {
    return trigger.hasAttribute('data-checkout-switch');
  }

  function requestBody(trigger) {
    var body = { cancelUrl: window.location.href };
    if (isSwitch(trigger)) body.action = 'switch';
    var priceId = trigger.getAttribute('data-checkout-price');
    if (priceId) {
      body.priceId = priceId;
      return body;
    }
    body.plan = trigger.getAttribute('data-checkout-plan');
    body.interval = trigger.getAttribute('data-checkout-interval') || 'month';
    return body;
  }

  function applySwitched(result) {
    var data = result && result.data ? result.data : {};
    if (data.account && global.PlaigroundAccount && typeof global.PlaigroundAccount.fill === 'function') {
      global.PlaigroundAccount.fill(data.account);
    }
    if (data.plan && global.PlaigroundMembership && typeof global.PlaigroundMembership.recordPlan === 'function') {
      global.PlaigroundMembership.recordPlan(data.plan);
    }
    if (global.PlaigroundAccount && typeof global.PlaigroundAccount.markPlanOption === 'function') {
      global.PlaigroundAccount.markPlanOption(data.plan, data.interval);
    }
  }

  function rememberPendingPlan(trigger) {
    var plan = String(trigger.getAttribute('data-checkout-plan') || '').trim().toLowerCase();
    if (plan !== 'creator' && plan !== 'pro') return;
    if (global.PlaigroundMembership && global.PlaigroundMembership.rememberPending) {
      global.PlaigroundMembership.rememberPending(plan);
      return;
    }
    try {
      localStorage.setItem('plaigroundMembershipPending', plan);
      localStorage.setItem('plaigroundMembership', plan);
      sessionStorage.setItem('plaigroundMembershipPending', plan);
      sessionStorage.setItem('plaigroundMembership', plan);
    } catch (err) {}
  }

  function startCheckout(trigger) {
    if (trigger.getAttribute('aria-busy') === 'true') return;
    rememberPendingPlan(trigger);
    var original = trigger.getAttribute('data-checkout-label') || trigger.textContent;
    trigger.setAttribute('data-checkout-label', original);
    trigger.setAttribute('aria-busy', 'true');
    trigger.disabled = true;
    if (trigger.classList.contains('btn')) {
      trigger.textContent = isSwitch(trigger) ? 'Updating…' : 'Redirecting…';
    }
    setStatus(trigger, '');

    fetch(CHECKOUT_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody(trigger)),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, status: response.status, data: data || {} };
        }).catch(function () {
          return { ok: false, status: response.status, data: {} };
        });
      })
      .then(function (result) {
        if (result.data && result.data.switched) {
          trigger.removeAttribute('aria-busy');
          trigger.disabled = false;
          trigger.textContent = original;
          applySwitched(result);
          if (result.data.unchanged) {
            setStatus(trigger, 'You are already on this plan.');
            return;
          }
          if (isPlanConfirmPage()) {
            global.location.replace('settings.html');
            return;
          }
          setStatus(trigger, 'Plan updated.');
          return;
        }
        if (result.data && result.data.url) {
          window.location.href = result.data.url;
          return;
        }
        trigger.removeAttribute('aria-busy');
        trigger.disabled = false;
        trigger.textContent = original;
        if (result.status === 401 && !isSwitch(trigger)) {
          var plan = trigger.getAttribute('data-checkout-plan') || '';
          var dest = 'login.html';
          if (plan) dest += '?plan=' + encodeURIComponent(plan);
          window.location.href = dest;
          return;
        }
        if (result.status === 401) {
          setStatus(trigger, 'Still signed in. Try again.');
          return;
        }
        if (result.status === 503 || result.data.configured === false) {
          setStatus(trigger, 'Checkout is not available yet.');
          return;
        }
        setStatus(trigger, result.data.error || (isSwitch(trigger) ? 'Could not update the plan.' : 'Could not start checkout.'));
      })
      .catch(function () {
        trigger.removeAttribute('aria-busy');
        trigger.disabled = false;
        trigger.textContent = original;
        setStatus(trigger, 'Could not start checkout.');
      });
  }

  document.addEventListener('click', function (event) {
    var trigger = closestTrigger(event.target);
    if (!trigger) return;
    event.preventDefault();
    startCheckout(trigger);
  });
})(window);
