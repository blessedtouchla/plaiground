(function () {
  var api = window.PlaigroundCopyright;
  var view = document.querySelector('[data-protect-view]');
  var bar = document.querySelector('[data-protect-bar]');
  var fill = document.querySelector('[data-protect-fill]');
  var burst = document.querySelector('[data-protect-burst]');
  if (!api || !view || !bar || !fill) return;

  var releaseId = api.releaseIdFromQuery(window.location.search);
  if (!releaseId) {
    var draft = api.readDraft(window.localStorage);
    if (draft && draft.release_id) releaseId = String(draft.release_id);
  }
  var record = api.load(window.localStorage, releaseId);
  var index = 0;

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function persist() {
    record = api.save(window.localStorage, releaseId, record);
  }

  function list() {
    return api.screens(record);
  }

  function render() {
    var screens = list();
    if (index >= screens.length) index = screens.length - 1;
    if (index < 0) index = 0;
    var screen = screens[index];
    var total = screens.length;
    var now = index + 1;
    bar.setAttribute('aria-valuemax', String(total));
    bar.setAttribute('aria-valuenow', String(now));
    fill.style.width = ((now / total) * 100) + '%';
    if (burst) {
      burst.style.left = ((now / total) * 100) + '%';
      burst.classList.remove('pop');
      void burst.offsetWidth;
      burst.classList.add('pop');
    }

    var html = '<h1 tabindex="-1">' + esc(screen.title) + '</h1>';
    if (screen.kind === 'lane') {
      html += '<div class="guide-choices">';
      html += '<button type="button" data-lane="human"' + (record.lane === 'human' ? ' class="is-pick"' : '') + '>Fully human</button>';
      html += '<button type="button" data-lane="ai"' + (record.lane === 'ai' ? ' class="is-pick"' : '') + '>I used AI</button>';
      html += '</div>';
    } else if (screen.kind === 'step' || screen.kind === 'explain') {
      html += '<p class="protect-lead">' + esc(screen.body) + '</p>';
      if (screen.href) html += '<a class="protect-link" href="' + esc(screen.href) + '">' + esc(screen.link) + '</a>';
      html += '<button type="button" class="guide-cta" data-next>Next</button>';
      html += '<button type="button" class="protect-back" data-back>Back</button>';
    } else if (screen.kind === 'part') {
      html += '<div class="guide-choices">';
      html += '<button type="button" data-part="yes">Yes</button>';
      html += '<button type="button" data-part="no">No</button>';
      html += '</div>';
      html += '<button type="button" class="protect-back" data-back>Back</button>';
    } else if (screen.kind === 'summary') {
      var kept = api.summary(record.parts);
      if (!kept.length) {
        html += '<p class="protect-empty">' + esc(api.EMPTY_SUMMARY) + '</p>';
      } else {
        html += '<ul class="protect-card">';
        kept.forEach(function (line) {
          html += '<li>' + esc(line) + '</li>';
        });
        html += '</ul>';
      }
      html += '<button type="button" class="guide-cta" data-next>Next</button>';
      html += '<button type="button" class="protect-back" data-back>Back</button>';
    } else if (screen.kind === 'paths') {
      html += '<p class="protect-lead">A human re-record protects the new recording. The song itself needs human authorship.</p>';
      html += '<div class="guide-choices">';
      (screen.links || []).forEach(function (link) {
        html += '<a class="guide-choice-link" href="' + esc(link.href) + '">' + esc(link.label) + '</a>';
      });
      html += '</div>';
      html += '<button type="button" class="protect-back" data-back>Back</button>';
    } else if (screen.kind === 'benefits') {
      html += '<ul class="protect-benefits">';
      api.BENEFITS.forEach(function (item) {
        html += '<li><strong>' + esc(item.title) + '</strong><span>' + esc(item.body) + '</span></li>';
      });
      html += '</ul>';
      html += '<a class="guide-cta" href="/destination">Done</a>';
      html += '<button type="button" class="protect-back" data-back>Back</button>';
    }

    view.innerHTML = html;
    var heading = view.querySelector('h1');
    if (heading && heading.focus) heading.focus();
  }

  view.addEventListener('click', function (event) {
    var lane = event.target.closest('[data-lane]');
    var part = event.target.closest('[data-part]');
    var next = event.target.closest('[data-next]');
    var back = event.target.closest('[data-back]');
    if (lane) {
      var picked = lane.getAttribute('data-lane');
      if (record.lane !== picked) record.parts = api.blank().parts;
      record.lane = picked;
      if (picked === 'human' || picked === 'ai') {
        (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({
          name: 'copyright_choice',
          payload: { lane: picked }
        });
      }
      persist();
      index = 1;
      render();
      return;
    }
    if (part) {
      var screens = list();
      var current = screens[index];
      if (!current || current.kind !== 'part') return;
      record.parts[current.id] = part.getAttribute('data-part') === 'yes';
      persist();
      index += 1;
      render();
      return;
    }
    if (next) {
      index += 1;
      render();
      return;
    }
    if (back) {
      index -= 1;
      render();
    }
  });

  render();
})();
