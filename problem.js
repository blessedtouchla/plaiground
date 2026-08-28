(function (global) {
  var LABEL = 'Have a problem?';
  var THANKS = 'Thank you. We will look at this within 24 hours.';
  var OVERVIEW = 'dashboard.html';
  var ENDPOINT = '/api/me/problem';
  var IMPORT_PREFILL = 'Import / artist mapping issue.';

  function queryParam(name) {
    try {
      return String(new URLSearchParams((global.location && global.location.search) || '').get(name) || '').trim();
    } catch (err) {
      return '';
    }
  }

  function clipPageId(value) {
    return String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  }

  function problemContext() {
    var importFlag = queryParam('import');
    return {
      import: Boolean(importFlag && importFlag !== '0' && importFlag !== 'false'),
      release: clipPageId(queryParam('release')),
      artist: clipPageId(queryParam('artist')),
    };
  }

  function applyPrefill() {
    var field = document.querySelector && document.querySelector('[data-problem-text]');
    if (!field) return;
    if (String(field.value || '').trim()) return;
    var ctx = problemContext();
    if (ctx.import) field.value = IMPORT_PREFILL;
  }

  function problemHref(opts) {
    opts = opts || {};
    var params = [];
    if (opts.import) params.push('import=1');
    if (opts.release) params.push('release=' + encodeURIComponent(clipPageId(opts.release)));
    if (opts.artist) params.push('artist=' + encodeURIComponent(clipPageId(opts.artist)));
    return params.length ? ('problem.html?' + params.join('&')) : 'problem.html';
  }

  function isSignedIn() {
    var api = global.PlaigroundMembership;
    return !!(api && typeof api.isSignedIn === 'function' && api.isSignedIn());
  }

  function makeLink(className) {
    var a = document.createElement('a');
    a.href = 'problem.html';
    a.className = className;
    a.setAttribute('data-have-problem', '1');
    a.textContent = LABEL;
    return a;
  }

  function syncExisting(show) {
    if (!document.querySelectorAll) return;
    document.querySelectorAll('[data-have-problem]').forEach(function (el) {
      el.hidden = !show;
      if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', !show);
    });
  }

  function injectSideNav(show) {
    var nav = document.querySelector && document.querySelector('.side-nav');
    if (!nav) return;
    var existing = nav.querySelector('[data-have-problem]');
    if (!show) {
      if (existing) existing.hidden = true;
      return;
    }
    if (existing) {
      existing.hidden = false;
      if ((existing.textContent || '').replace(/\s+/g, ' ').trim() !== LABEL) {
        existing.textContent = LABEL;
      }
      return;
    }
    nav.appendChild(makeLink('side-problem'));
  }

  function injectFlowTop(show) {
    var top = document.querySelector && document.querySelector('.flow-top');
    if (!top) return;
    var existing = top.querySelector('[data-have-problem]');
    if (!show) {
      if (existing) existing.hidden = true;
      return;
    }
    if (existing) {
      existing.hidden = false;
      return;
    }
    var link = makeLink('btn btn-ghost btn-sm have-problem');
    var who = top.querySelector('.who');
    if (who && who.parentNode === top) top.insertBefore(link, who);
    else top.appendChild(link);
  }

  function mount() {
    var show = isSignedIn();
    syncExisting(show);
    injectSideNav(show);
    injectFlowTop(show);
    return show;
  }

  function sessionEmail() {
    var api = global.PlaigroundMembership;
    var account = api && typeof api.account === 'function' ? api.account() : null;
    return String((account && account.email) || '').trim();
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = Boolean(hidden);
    if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
  }

  function bindForm() {
    var form = document.querySelector('[data-problem-form]');
    if (!form || form.getAttribute('data-problem-bound') === '1') return;
    form.setAttribute('data-problem-bound', '1');

    var field = form.querySelector('[data-problem-text]');
    var submit = form.querySelector('[data-problem-submit]');
    var error = document.querySelector('[data-problem-error]');
    var thanks = document.querySelector('[data-problem-thanks]');
    var thanksCopy = document.querySelector('[data-problem-thanks-copy]');
    if (thanksCopy) thanksCopy.textContent = THANKS;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var text = field ? String(field.value || '').trim() : '';
      if (!text) {
        if (error) {
          error.textContent = 'Describe the problem.';
          setHidden(error, false);
        }
        return;
      }
      if (error) {
        error.textContent = '';
        setHidden(error, true);
      }
      if (submit) {
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
      }
      var payload = { problem: text };
      var email = sessionEmail();
      if (email) payload.email = email;
      var ctx = problemContext();
      if (ctx.release) payload.release = ctx.release;
      if (ctx.artist) payload.artist = ctx.artist;
      fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, status: response.status, data: data || {} };
        }).catch(function () {
          return { ok: response.ok, status: response.status, data: {} };
        });
      }).then(function (result) {
        if (submit) {
          submit.disabled = false;
          if (typeof submit.removeAttribute === 'function') submit.removeAttribute('aria-busy');
        }
        if (result && result.ok && result.data && result.data.mail_sent) {
          setHidden(form, true);
          if (thanks) setHidden(thanks, false);
          return;
        }
        var message = (result && result.data && result.data.error) || 'Could not send the problem report.';
        if (error) {
          error.textContent = message;
          setHidden(error, false);
        }
      }).catch(function () {
        if (submit) {
          submit.disabled = false;
          if (typeof submit.removeAttribute === 'function') submit.removeAttribute('aria-busy');
        }
        if (error) {
          error.textContent = 'Could not send the problem report.';
          setHidden(error, false);
        }
      });
    });
  }

  function start() {
    mount();
    applyPrefill();
    bindForm();
    var api = global.PlaigroundMembership;
    if (api && typeof api.whenReady === 'function') {
      api.whenReady(function () {
        mount();
      });
    }
  }

  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  global.PlaigroundProblem = {
    LABEL: LABEL,
    THANKS: THANKS,
    OVERVIEW: OVERVIEW,
    ENDPOINT: ENDPOINT,
    IMPORT_PREFILL: IMPORT_PREFILL,
    clipPageId: clipPageId,
    problemContext: problemContext,
    problemHref: problemHref,
    applyPrefill: applyPrefill,
    mount: mount,
    bindForm: bindForm,
  };
})(typeof window !== 'undefined' ? window : this);
