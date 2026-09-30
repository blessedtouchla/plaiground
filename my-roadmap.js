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
      stops.innerHTML = list.map(function (title) {
        return '<li>' + escapeHtml(title) + '</li>';
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

  function load() {
    return global.fetch('/api/me/roadmap', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data || {} };
      }).catch(function () {
        return { ok: false, data: {} };
      });
    }).then(function (result) {
      if (!result.ok) {
        var status = $('[data-roadmap-status]');
        if (status) {
          status.hidden = false;
          status.textContent = 'Could not load your roadmap.';
        }
        return;
      }
      render({
        saved_at: result.data.saved_at,
        plan: result.data.summary || null
      });
    }).catch(function () {
      var status = $('[data-roadmap-status]');
      if (status) {
        status.hidden = false;
        status.textContent = 'Could not load your roadmap.';
      }
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

  function boot() {
    var membership = global.PlaigroundMembership;
    var ready = membership && typeof membership.whenReady === 'function'
      ? membership.whenReady()
      : Promise.resolve(null);
    ready.then(function () {
      load();
    });
  }

  if (global.document && global.document.getElementById('my-roadmap')) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { shape: shape };
  }
})(typeof window !== 'undefined' ? window : globalThis);
