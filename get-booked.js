/* Get booked: on-site form. Sends through the existing apply endpoint, which alerts the PLAIGROUND inbox. */
(function () {
  var modal = null;
  var SHOWS = ['Club nights', 'Festivals', 'Private events', 'Corporate', 'Opening slots', 'Virtual shows'];
  var BUDGETS = ['Under $500', '$500 to $1,500', '$1,500 to $5,000', '$5,000+', 'Open to offers'];
  function field(label, html) { return '<label>' + label + ' ' + html + '</label>'; }
  function ensure() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'apply-modal gb-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'gb-title');
    modal.innerHTML = ''
      + '<div class="apply-modal-backdrop" data-gb-close></div>'
      + '<div class="apply-modal-panel gb-panel">'
      + '<img class="gb-plai" src="/for-david-fv/img/plai-dancing.webp" alt="" width="72" height="72" />'
      + '<h2 id="gb-title">Get booked</h2>'
      + '<p>Tell us your region, genre and budget, and we will match you with paid shows and events.</p>'
      + '<form data-gb-form>'
      + '<label class="apply-honey">Company website <input type="text" name="company_website" tabindex="-1" autocomplete="off" /></label>'
      + field('Your name', '<input name="name" type="text" autocomplete="name" required maxlength="120" />')
      + field('Artist name', '<input name="artist" type="text" required maxlength="120" />')
      + field('Email', '<input name="email" type="email" autocomplete="email" required maxlength="200" />')
      + field('Region', '<input name="region" type="text" required maxlength="120" placeholder="City, state or country" />')
      + field('Genre', '<input name="genre" type="text" required maxlength="120" />')
      + field('Links', '<textarea name="links" rows="2" maxlength="600" placeholder="Music, video, socials"></textarea>')
      + '<fieldset class="gb-shows"><legend>Show types</legend>' + SHOWS.map(function (s) { return '<label class="gb-chip"><input type="checkbox" name="shows" value="' + s + '" /> <span>' + s + '</span></label>'; }).join('') + '</fieldset>'
      + field('Budget range', '<select name="budget" required><option value="">Pick one</option>' + BUDGETS.map(function (b) { return '<option>' + b + '</option>'; }).join('') + '</select>')
      + field('Availability', '<input name="availability" type="text" maxlength="200" placeholder="Dates, weekends, travel" />')
      + '<p class="apply-status" data-gb-status aria-live="polite"></p>'
      + '<div class="apply-modal-actions">'
      + '<button class="ba-start gb-send" type="submit">&#9654; Send</button>'
      + '<button class="btn btn-ghost btn-md" type="button" data-gb-close>Close</button>'
      + '</div>'
      + '</form>'
      + '<p class="gb-done" data-gb-done hidden>Got it. We will reach out with shows that fit.</p>'
      + '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-gb-close]')) close(); });
    modal.querySelector('[data-gb-form]').addEventListener('submit', submit);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal && !modal.hidden) close(); });
    return modal;
  }
  function open() {
    var root = ensure();
    var form = root.querySelector('[data-gb-form]');
    form.hidden = false; form.reset();
    root.querySelector('[data-gb-done]').hidden = true;
    root.querySelector('[data-gb-status]').textContent = '';
    root.hidden = false;
    form.querySelector('[name="name"]').focus();
  }
  function close() { if (modal) modal.hidden = true; }
  function submit(e) {
    e.preventDefault();
    var f = e.target, status = f.querySelector('[data-gb-status]');
    var shows = Array.prototype.map.call(f.querySelectorAll('[name="shows"]:checked'), function (x) { return x.value; });
    var help = [
      'Artist name: ' + f.artist.value,
      'Region: ' + f.region.value,
      'Genre: ' + f.genre.value,
      'Links: ' + (f.links.value || '-'),
      'Show types: ' + (shows.join(', ') || '-'),
      'Budget range: ' + f.budget.value,
      'Availability: ' + (f.availability.value || '-')
    ].join(' | ');
    status.textContent = 'Sending...';
    fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: f.name.value, email: f.email.value, phone: '', package: 'Get booked', help: help, company_website: f.company_website.value })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { status.textContent = (res.d && res.d.error) || 'Could not send that. Try again in a minute.'; return; }
        f.hidden = true; modal.querySelector('[data-gb-done]').hidden = false;
      }).catch(function () { status.textContent = 'Could not send that. Try again in a minute.'; });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-get-booked], a[href$="#get-booked-form"]');
    if (!b) return;
    e.preventDefault(); open();
  });
  if (location.hash === '#get-booked-form') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', open); else open();
  }
  window.PlaiGetBooked = { open: open };
})();
