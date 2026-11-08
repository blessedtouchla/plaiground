(function () {
  var api = window.SpotlightPreview;
  var form = document.getElementById('spot-form');
  var panel = document.getElementById('spot-result');
  var errors = document.getElementById('spot-errors');
  var count = document.getElementById('spot-count');
  var story = document.getElementById('spot-story');
  if (!api || !form || !panel || !errors) return;

  var fields = {
    name: document.getElementById('spot-name'),
    email: document.getElementById('spot-email'),
    link: document.getElementById('spot-link'),
    story: story
  };

  function line(parent, tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    parent.appendChild(node);
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function setInvalid(input, message) {
    var slot = document.getElementById(input.id + '-error');
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      if (slot) slot.textContent = message;
    } else {
      input.removeAttribute('aria-invalid');
      if (slot) slot.textContent = '';
    }
  }

  function readForm() {
    return {
      name: fields.name.value,
      email: fields.email.value,
      link: fields.link.value,
      story: fields.story.value,
      updates: form.updates && form.updates.checked ? 'yes' : '',
      company: form.company ? form.company.value : ''
    };
  }

  function showErrors(result) {
    panel.hidden = true;
    form.hidden = false;
    clear(errors);
    var keys = Object.keys(result.errors || {});
    if (!keys.length) {
      errors.hidden = true;
      return;
    }
    errors.hidden = false;
    line(errors, 'p', '', keys.length === 1 ? 'Check one field.' : 'Check the fields below.');
    ['name', 'email', 'link', 'story'].forEach(function (key) {
      setInvalid(fields[key], result.errors[key] || '');
    });
    if (result.errors.form) line(errors, 'p', '', result.errors.form);
    errors.focus();
  }

  function addLink(parent, href, label) {
    var link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    parent.appendChild(link);
  }

  function showResult(result) {
    clear(errors);
    errors.hidden = true;
    ['name', 'email', 'link', 'story'].forEach(function (key) {
      setInvalid(fields[key], '');
    });
    clear(panel);
    form.hidden = true;
    panel.hidden = false;

    line(panel, 'p', 'spot-kicker', 'Preview result');
    line(panel, 'h2', '', 'Not saved.');
    line(panel, 'p', '', 'Nothing was stored, emailed, or sent to an editor. These answers stay on this screen only. Refresh or leave, and they are gone.');
    line(panel, 'p', 'spot-private', 'Your email is shown here so you can check it. It is not published.');

    var list = document.createElement('dl');
    list.className = 'spot-recap';
    [
      ['Public name', result.preview.name],
      ['Email, this screen only', result.preview.email],
      ['Link', result.preview.link],
      ['Story', result.preview.story]
    ].forEach(function (row) {
      var term = document.createElement('dt');
      term.textContent = row[0];
      var detail = document.createElement('dd');
      detail.textContent = row[1];
      list.appendChild(term);
      list.appendChild(detail);
    });
    panel.appendChild(list);

    line(panel, 'p', '', result.updatesChecked
      ? 'You checked email updates. That choice was not saved, and you were not subscribed.'
      : 'Email updates stayed off. You were not subscribed.');

    var next = document.createElement('div');
    next.className = 'spot-next';
    line(next, 'h3', '', 'Optional, and separate');
    line(next, 'p', '', 'These are the live pages. This form does not create an account.');
    var song = document.createElement('p');
    addLink(song, 'https://wannaplai.com/song-helper', 'Song Lab');
    song.appendChild(document.createTextNode(' loads without signing in. A signed-out copy stays on that device, and saving needs an account.'));
    next.appendChild(song);
    var road = document.createElement('p');
    addLink(road, 'https://wannaplai.com/destination', 'Roadmap');
    road.appendChild(document.createTextNode(' is the public route builder. Signup is free if you want to save a route.'));
    next.appendChild(road);
    panel.appendChild(next);

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'spot-button spot-button-ghost';
    back.textContent = 'Change answers';
    back.addEventListener('click', function () {
      panel.hidden = true;
      form.hidden = false;
      fields.name.focus();
    });
    panel.appendChild(back);
    panel.focus();
  }

  function updateCount() {
    if (!count || !story) return;
    count.textContent = String(story.value.length) + ' of 800 characters';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var result = api.check(readForm());
    if (!result.ok) showErrors(result);
    else showResult(result);
  });

  if (story) story.addEventListener('input', updateCount);
  updateCount();
})();
