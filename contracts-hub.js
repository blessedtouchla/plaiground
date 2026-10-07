(function () {
  var api = window.PlaigroundContracts;
  var box = document.querySelector('[data-contract-library]');
  if (!api || !box) return;
  var lane = 'all';
  try {
    var asked = new URLSearchParams(window.location.search).get('lane');
    if (asked === 'human' || asked === 'ai') lane = asked;
  } catch (err) {}

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render() {
    var html = '';
    api.typesFor(lane).forEach(function (type) {
      html += '<article class="contract-card">';
      html += '<span class="contract-tag">' + esc(api.tagFor(type)) + '</span>';
      html += '<h2>' + esc(type.title) + '</h2>';
      html += '<p><strong>What it is.</strong> ' + esc(type.what) + '</p>';
      html += "<p><strong>What's fair.</strong> " + esc(type.fair) + "</p>";
      html += '<p><strong>Watch-outs.</strong> ' + esc(type.watch) + '</p>';
      html += '<a href="/contracts/create?type=' + esc(type.id) + '">Create mine</a>';
      html += '</article>';
    });
    box.innerHTML = html;
  }

  document.querySelectorAll('[data-contract-filter]').forEach(function (button) {
    var on = (button.getAttribute('data-contract-filter') || 'all') === lane;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.addEventListener('click', function () {
      lane = button.getAttribute('data-contract-filter') || 'all';
      document.querySelectorAll('[data-contract-filter]').forEach(function (other) {
        var on = other === button;
        other.classList.toggle('is-on', on);
        other.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      render();
    });
  });

  render();
})();
