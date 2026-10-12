(function () {
  var modal = null;

  function ensure() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'apply-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'apply-title');
    modal.innerHTML = ''
      + '<div class="apply-modal-backdrop" data-apply-close></div>'
      + '<div class="apply-modal-panel">'
      + '<h2 id="apply-title">Apply free</h2>'
      + '<p>No charge to apply. Tell us the package and what you want help with. We will reach out.</p>'
      + '<form data-apply-form>'
      + '<label class="apply-honey">Company website <input type="text" name="company_website" tabindex="-1" autocomplete="off" /></label>'
      + '<label>Name <input name="name" type="text" autocomplete="name" required maxlength="120" /></label>'
      + '<label>Email <input name="email" type="email" autocomplete="email" required maxlength="200" /></label>'
      + '<label>Phone <input name="phone" type="tel" autocomplete="tel" required maxlength="40" /></label>'
      + '<label>Package <input name="package" type="text" readonly /></label>'
      + '<p class="apply-package" data-apply-package-label></p>'
      + '<label>What do you want help with? <textarea name="help" required maxlength="2000" rows="4"></textarea></label>'
      + '<p class="apply-status" data-apply-status></p>'
      + '<div class="apply-modal-actions">'
      + '<button class="btn btn-purple btn-md" type="submit">Send</button>'
      + '<button class="btn btn-ghost btn-md" type="button" data-apply-close>Close</button>'
      + '</div>'
      + '</form>'
      + '<p data-apply-done hidden>We\'ll reach out soon.</p>'
      + '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (event) {
      if (event.target && event.target.closest && event.target.closest('[data-apply-close]')) close();
    });
    modal.querySelector('[data-apply-form]').addEventListener('submit', onSubmit);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal && !modal.hidden) close();
    });
    return modal;
  }

  function open(packageName) {
    var root = ensure();
    var form = root.querySelector('[data-apply-form]');
    var done = root.querySelector('[data-apply-done]');
    var status = root.querySelector('[data-apply-status]');
    form.hidden = false;
    done.hidden = true;
    status.textContent = '';
    form.reset();
    form.querySelector('[name="package"]').value = packageName || '';
    root.querySelector('[data-apply-package-label]').textContent = packageName || '';
    root.hidden = false;
    var name = form.querySelector('[name="name"]');
    if (name) name.focus();
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
  }

  function onSubmit(event) {
    event.preventDefault();
    var form = event.target;
    var status = form.querySelector('[data-apply-status]');
    var body = {
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value,
      package: form.querySelector('[name="package"]').value,
      help: form.help.value,
      company_website: form.company_website.value,
    };
    status.textContent = 'Sending...';
    fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { ok: response.ok, data: data || {} };
      });
    }).then(function (result) {
      if (!result.ok) {
        status.textContent = (result.data && result.data.error) || 'Could not send that. Try again in a minute.';
        return;
      }
      form.hidden = true;
      var done = modal.querySelector('[data-apply-done]');
      done.hidden = false;
      done.textContent = "We'll reach out soon.";
    }).catch(function () {
      status.textContent = 'Could not send that. Try again in a minute.';
    });
  }

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest && event.target.closest('[data-apply-package]');
    if (!button || button.closest('.apply-modal')) return;
    event.preventDefault();
    open(button.getAttribute('data-apply-package') || '');
  });

  window.PlaigroundApply = { open: open, close: close };
})();
