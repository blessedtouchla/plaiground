(function () {
  var api = window.PlaigroundContracts;
  var view = document.querySelector('[data-contract-view]');
  var bar = document.querySelector('[data-contract-bar]');
  var fill = document.querySelector('[data-contract-fill]');
  if (!api || !view) return;

  var params = new URLSearchParams(window.location.search);
  var preset = api.typeById(params.get('type') || '');
  var answers = { type: preset ? preset.id : '' };
  var declare = params.get('declare') === '1';
  var recordId = params.get('record') || '';
  if (params.get('you')) answers.you = params.get('you').slice(0, 80);
  if (params.get('work')) answers.work = params.get('work').slice(0, 80);
  var index = 0;

  function fullDraft() {
    var draft = api.buildDraft(answers);
    if (!declare || !window.PlaigroundClaim) return draft;
    return window.PlaigroundClaim.declarationText({
      you: answers.you,
      work: answers.work,
      record: recordId,
    }) + '\n\n' + draft;
  }

  function questions() {
    return api.questionsFor(answers.type, !preset);
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render() {
    var list = questions();
    var last = index >= list.length;
    var total = list.length + 1;
    var now = Math.min(total, index + 1);
    if (bar) {
      bar.setAttribute('aria-valuemax', String(total));
      bar.setAttribute('aria-valuenow', String(now));
    }
    if (fill) fill.style.width = ((now / total) * 100) + '%';
    if (last) {
      var draft = fullDraft();
      view.innerHTML = '<h1 tabindex="-1">Your draft</h1>'
        + '<textarea class="contract-draft" readonly data-contract-draft>' + esc(draft) + '</textarea>'
        + '<div class="contract-actions"><button type="button" class="guide-cta" data-contract-copy>Copy</button>'
        + '<button type="button" class="guide-cta" data-contract-download>Download</button></div>'
        + '<p class="contract-pay">' + esc(api.PAY_LINE) + '</p>';
      return;
    }
    var step = list[index];
    var html = '<h1 tabindex="-1">' + esc(step.ask) + '</h1>';
    if (step.kind === 'type') {
      html += '<div class="guide-choices">';
      api.TYPES.forEach(function (type) {
        html += '<button type="button" data-contract-pick="type" data-value="' + esc(type.id) + '">' + esc(type.title) + '</button>';
      });
      html += '</div>';
    } else if (step.kind === 'choice') {
      html += '<div class="guide-choices">';
      step.options.forEach(function (option) {
        html += '<button type="button" data-contract-pick="' + esc(step.id) + '" data-value="' + esc(option) + '">' + esc(option) + '</button>';
      });
      html += '</div>';
    } else {
      html += '<input class="contract-box" data-contract-input placeholder="' + esc(step.placeholder || '') + '" value="' + esc(answers[step.id] || '') + '" />';
      html += '<button type="button" class="guide-cta" data-contract-next>Next</button>';
    }
    if (index > 0) html += '<button type="button" class="protect-back" data-contract-back>Back</button>';
    view.innerHTML = html;
    var heading = view.querySelector('h1');
    if (heading && heading.focus) heading.focus();
  }

  view.addEventListener('click', function (event) {
    var pick = event.target.closest('[data-contract-pick]');
    var next = event.target.closest('[data-contract-next]');
    var back = event.target.closest('[data-contract-back]');
    var copy = event.target.closest('[data-contract-copy]');
    var download = event.target.closest('[data-contract-download]');
    if (pick) {
      var key = pick.getAttribute('data-contract-pick');
      answers[key] = pick.getAttribute('data-value');
      index += 1;
      render();
      return;
    }
    if (next) {
      var input = view.querySelector('[data-contract-input]');
      var step = questions()[index];
      answers[step.id] = input ? input.value.trim() : '';
      if (!answers[step.id]) return;
      index += 1;
      render();
      return;
    }
    if (back) {
      index = Math.max(0, index - 1);
      render();
      return;
    }
    var draft = fullDraft();
    if (copy && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(draft).then(function () { copy.textContent = 'Copied'; }).catch(function () {});
    }
    if (download) {
      var blob = new Blob([draft], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'plaiground-contract-draft.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  });

  render();
})();
