(function (global) {
  function $(sel) {
    return global.document ? global.document.querySelector(sel) : null;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatWhen(value) {
    if (!value) return '';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  function show(el, on) {
    if (!el) return;
    el.hidden = !on;
  }

  function render(data) {
    var status = $('[data-roadmap-status]');
    var empty = $('[data-roadmap-empty]');
    var panel = $('[data-roadmap-panel]');
    var summary = $('[data-roadmap-summary]');
    var stops = $('[data-roadmap-stops]');
    var meta = $('[data-roadmap-meta]');
    var note = $('[data-roadmap-note]');
    if (status) status.hidden = true;
    var plan = data && data.plan;
    if (!plan) {
      show(empty, true);
      show(panel, false);
      return;
    }
    show(empty, false);
    show(panel, true);
    var bits = [];
    if (plan.goal) bits.push(plan.goal);
    if (plan.stage) bits.push(plan.stage);
    if (summary) summary.textContent = bits.join(' · ');
    if (stops) {
      var list = Array.isArray(plan.stops) ? plan.stops : [];
      var ids = Array.isArray(data.stopIds) ? data.stopIds : [];
      // Highlight a current step only when the artist has marked real progress.
      var current = -1;
      var anyDone = ids.some(function (id) { try { return id && localStorage.getItem('plaiground.routeDone.' + id) === '1'; } catch (err) { return false; } });
      stops.innerHTML = list.map(function (title, index) {
        var id = ids[index] || '';
        var done = false;
        try { done = id && localStorage.getItem('plaiground.routeDone.' + id) === '1'; } catch (err) {}
        var action = '';
        if (id && done) action = ' <span>Done</span>';
        else if (id) action = ' <button type="button" data-route-stop="' + escapeHtml(id) + '">Mark done</button>';
        var core = window.DestinationCore && window.DestinationCore.STOPS;
        var href = (id && core && core[id] && core[id].href) || '';
        var label = href ? '<a class="roadmap-stop-link" href="' + escapeHtml(href) + '">' + escapeHtml(title) + '</a>' : escapeHtml(title);
        var cls = done ? ' class="is-done"' : '';
        if (!done && id && current === -1 && anyDone) { current = index; cls = ' class="is-current" aria-current="step"'; }
        return '<li' + cls + '>' + label + action + '</li>';
      }).join('');
    }
    if (meta) {
      var extra = [];
      if (plan.artist_count === '1') extra.push('1 artist');
      else if (plan.artist_count === 'Label or manager') extra.push('Label or manager');
      else if (plan.artist_count) extra.push(plan.artist_count + ' artists');
      if (plan.genres && plan.genres.length) extra.push(plan.genres.join(', '));
      if (data.saved_at) extra.push('Saved ' + formatWhen(data.saved_at));
      meta.textContent = extra.join(' · ');
    }
    if (note) {
      note.textContent = plan.note || '';
      note.hidden = !plan.note;
    }
  }

  function summaryHasContent(summary) {
    if (!summary) return false;
    if (summary.goal || summary.stage || summary.note || summary.artist_count) return true;
    return Array.isArray(summary.stops) && summary.stops.length > 0;
  }

  function displayFromResponse(data) {
    if (!data) return null;
    if (summaryHasContent(data.summary)) {
      return {
        saved_at: data.saved_at,
        plan: data.summary,
        stopIds: (data.plan && data.plan.stops) || []
      };
    }
    var raw = data.plan;
    if (!raw && data.history && data.history[0] && data.history[0].plan) raw = data.history[0].plan;
    if (!raw) return null;
    var shaped = shape({ plan: raw, saved_at: data.saved_at || (data.history && data.history[0] && data.history[0].saved_at) || '' });
    if (!shaped || !summaryHasContent(shaped.plan)) return null;
    shaped.stopIds = raw.stops || [];
    return shaped;
  }

  function localPlanRecord() {
    try {
      var raw = global.localStorage.getItem('plaigroundDestinationPlan');
      if (!raw) return null;
      var plan = JSON.parse(raw);
      return plan && plan.song && plan.goal ? plan : null;
    } catch (err) {
      return null;
    }
  }

  function fetchRoadmap() {
    return global.fetch('/api/me/roadmap', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data || {} };
      }).catch(function () {
        return { ok: false, data: {} };
      });
    });
  }

  function showLoadError() {
    var status = $('[data-roadmap-status]');
    if (status) {
      status.hidden = false;
      status.textContent = 'Could not load your roadmap.';
    }
    paintSavedBanner(false);
  }

  function showRoadmap(view) {
    paintSavedBanner(Boolean(view) && savedVisit());
    render(view || { plan: null });
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      global.setTimeout(resolve, ms);
    });
  }

  function load() {
    return fetchRoadmap().then(function (result) {
      if (!result.ok) {
        showLoadError();
        return;
      }
      var view = displayFromResponse(result.data);
      if (view || !savedVisit()) {
        showRoadmap(view);
        return;
      }
      return wait(450).then(fetchRoadmap).then(function (again) {
        var second = again && again.ok ? displayFromResponse(again.data) : null;
        if (second) {
          showRoadmap(second);
          return;
        }
        var local = localPlanRecord();
        if (!local) {
          showRoadmap(null);
          return;
        }
        var account = global.PlaigroundRoadmapAccount;
        var claim = account && typeof account.savePlan === 'function'
          ? account.savePlan(local, { immediate: true, force: true })
          : null;
        return Promise.resolve(claim).then(function () {
          return fetchRoadmap();
        }).then(function (third) {
          var saved = third && third.ok ? displayFromResponse(third.data) : null;
          if (saved) {
            showRoadmap(saved);
            return;
          }
          showRoadmap(displayFromResponse({ plan: local }));
        });
      });
    }).catch(function () {
      showLoadError();
    });
  }

  function shape(data) {
    var plan = data && data.plan;
    if (!plan) return null;
    var labels = global.DestinationCore;
    var goal = labels && labels.GOALS && labels.GOALS[plan.goal] ? labels.GOALS[plan.goal].label : plan.goal;
    var stage = labels && labels.SONGS && labels.SONGS[plan.song] ? labels.SONGS[plan.song].label : plan.song;
    var stops = (plan.stops || []).map(function (id) {
      return labels && labels.STOPS && labels.STOPS[id] ? labels.STOPS[id].title : id;
    });
    var genres = (plan.genres || []).slice();
    if (plan.genreOther) genres.push(plan.genreOther);
    var counts = { '1': '1', '2-5': '2 to 5', '6+': '6+', label: 'Label or manager' };
    return {
      saved_at: data.saved_at,
      plan: {
        goal: goal || '',
        stage: stage || '',
        stops: stops,
        artist_count: counts[plan.artistCount] || '',
        genres: genres,
        note: plan.note || ''
      }
    };
  }

  function bindStops() {
    var list = $('[data-roadmap-stops]');
    if (!list || list.getAttribute('data-route-bound') === '1') return;
    list.setAttribute('data-route-bound', '1');
    list.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-route-stop]') : null;
      if (!button) return;
      var id = button.getAttribute('data-route-stop') || '';
      if (!id) return;
      (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({
        name: 'route_stop_completed',
        payload: { stop_id: id }
      });
      try { localStorage.setItem('plaiground.routeDone.' + id, '1'); } catch (err) {}
      var mark = document.createElement('span');
      mark.textContent = 'Done';
      if (button.replaceWith) button.replaceWith(mark);
      else if (button.parentNode) button.parentNode.replaceChild(mark, button);
    });
  }

  function savedVisit() {
    try {
      return new URLSearchParams(global.location.search || '').get('saved') === '1';
    } catch (err) {
      return false;
    }
  }

  function paintSavedBanner(show) {
    var banner = $('[data-roadmap-saved]');
    if (!banner) return;
    banner.hidden = !show;
  }

  function boot() {
    paintSavedBanner(false);
    var membership = global.PlaigroundMembership;
    var ready = membership && typeof membership.whenReady === 'function'
      ? membership.whenReady()
      : Promise.resolve(null);
    ready.then(function () {
      bindStops();
      load();
    });
  }

  if (global.document && global.document.getElementById('my-roadmap')) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { shape: shape, displayFromResponse: displayFromResponse, summaryHasContent: summaryHasContent };
  }
})(typeof window !== 'undefined' ? window : globalThis);
