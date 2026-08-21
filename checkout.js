(function () {
  var CHECKOUT_URL = '/api/create-checkout-session';

  function closestTrigger(target) {
    if (!target || !target.closest) return null;
    return target.closest('[data-checkout-plan], [data-checkout-price]');
  }

  function statusHost(trigger) {
    return (
      trigger.closest('.card-cta, .hero-ctas, .cta-inner, .card') ||
      trigger.parentNode
    );
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

  function requestBody(trigger) {
    var body = { cancelUrl: window.location.href };
    var priceId = trigger.getAttribute('data-checkout-price');
    if (priceId) {
      body.priceId = priceId;
      return body;
    }
    body.plan = trigger.getAttribute('data-checkout-plan');
    body.interval = trigger.getAttribute('data-checkout-interval');
    return body;
  }

  function startCheckout(trigger) {
    if (trigger.getAttribute('aria-busy') === 'true') return;
    var original = trigger.getAttribute('data-checkout-label') || trigger.textContent;
    trigger.setAttribute('data-checkout-label', original);
    trigger.setAttribute('aria-busy', 'true');
    trigger.disabled = true;
    if (trigger.classList.contains('btn')) {
      trigger.textContent = 'Redirecting…';
    }
    setStatus(trigger, '');

    fetch(CHECKOUT_URL, {
      method: 'POST',
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
        if (result.data && result.data.url) {
          window.location.href = result.data.url;
          return;
        }
        trigger.removeAttribute('aria-busy');
        trigger.disabled = false;
        trigger.textContent = original;
        if (result.status === 503 || result.data.configured === false) {
          setStatus(trigger, 'Checkout is not available yet.');
          return;
        }
        setStatus(trigger, result.data.error || 'Could not start checkout.');
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
})();
