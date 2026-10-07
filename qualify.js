(function () {
  var api = window.PlaigroundQualify;
  var view = document.querySelector('[data-qualify-view]');
  var bar = document.querySelector('[data-qualify-bar]');
  var fill = document.querySelector('[data-qualify-fill]');
  if (!api || !view) return;

  var answers = {};
  var index = 0;

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render() {
    var total = api.QUESTIONS.length + 1;
    var now = Math.min(total, index + 1);
    if (bar) {
      bar.setAttribute('aria-valuemax', String(total));
      bar.setAttribute('aria-valuenow', String(now));
    }
    if (fill) fill.style.width = ((now / total) * 100) + '%';
    if (index >= api.QUESTIONS.length) {
      var card = api.result(answers);
      var html = '<h1 tabindex="-1">' + esc(card.title) + '</h1>';
      html += '<p class="qualify-lead">' + esc(card.lead) + '</p>';
      html += '<p class="qualify-lead">' + esc(card.truth) + '</p>';
      html += '<p class="qualify-lead">' + esc(card.clear) + '</p>';
      html += '<ul class="qualify-steps">';
      card.steps.forEach(function (step) {
        html += '<li>' + esc(step) + '</li>';
      });
      html += '</ul>';
      html += '<a class="guide-cta" href="' + esc(card.href) + '">' + esc(card.cta) + '</a>';
      html += '<button type="button" class="qualify-back" data-qualify-back>Back</button>';
      view.innerHTML = html;
      return;
    }
    var step = api.QUESTIONS[index];
    var html = '<h1 tabindex="-1">' + esc(step.ask) + '</h1><div class="guide-choices">';
    step.options.forEach(function (option) {
      html += '<button type="button" data-qualify-pick="' + esc(option.id) + '">' + esc(option.label) + '</button>';
    });
    html += '</div>';
    if (index > 0) html += '<button type="button" class="qualify-back" data-qualify-back>Back</button>';
    view.innerHTML = html;
    var heading = view.querySelector('h1');
    if (heading && heading.focus) heading.focus();
  }

  view.addEventListener('click', function (event) {
    var pick = event.target.closest('[data-qualify-pick]');
    var back = event.target.closest('[data-qualify-back]');
    if (pick) {
      answers[api.QUESTIONS[index].id] = pick.getAttribute('data-qualify-pick');
      index += 1;
      render();
      return;
    }
    if (back) {
      index = Math.max(0, index - 1);
      render();
    }
  });

  render();
})();
