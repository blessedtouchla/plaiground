/**
 * Signed-in stage board: add, remove, reorder, and artist-only stats.
 */
(function (root) {
  function enabled(name) {
    return root.PlaigroundFeatures && root.PlaigroundFeatures.enabled(name);
  }

  function $(sel) {
    return root.document ? root.document.querySelector(sel) : null;
  }

  function button(label, onClick) {
    var el = root.document.createElement('button');
    el.type = 'button';
    el.className = 'btn btn-ghost btn-sm';
    el.textContent = label;
    el.addEventListener('click', onClick);
    return el;
  }

  function post(body) {
    return root.fetch('/api/me/stage', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data || {} };
      }).catch(function () {
        return { ok: false, data: {} };
      });
    });
  }

  function load() {
    if (!enabled('STAGE_ENABLED')) return Promise.resolve(null);
    return root.fetch('/api/me/stage', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data || {} };
      }).catch(function () {
        return { ok: false, data: {} };
      });
    }).then(function (result) {
      if (result.ok) paintBoard(result.data);
      return result;
    }).catch(function () {
      return null;
    });
  }

  function markAdded(items) {
    var onStage = {};
    (items || []).forEach(function (item) {
      if (item && item.lyric_id) onStage[item.lyric_id] = true;
    });
    var adds = root.document.querySelectorAll('[data-stage-add]');
    Array.prototype.forEach.call(adds, function (el) {
      var id = el.getAttribute('data-stage-add');
      if (onStage[id]) {
        el.textContent = 'On your stage';
        el.disabled = true;
      }
    });
  }

  function paintStats(item) {
    if (!enabled('STAGE_STATS_ENABLED') || !item || !item.stats) return null;
    var stats = root.document.createElement('p');
    stats.className = 'stage-stats';
    stats.setAttribute('data-stage-stats', item.slug || '');
    var missed = item.stats.most_missed || 'None yet.';
    var levels = item.stats.levels || {};
    stats.textContent = 'Plays ' + item.stats.plays
      + '. Finishes ' + item.stats.finishes
      + '. Top score ' + item.stats.top_score
      + '. Level 1 ' + (levels[1] || levels['1'] || 0)
      + '. Level 2 ' + (levels[2] || levels['2'] || 0)
      + '. Level 3 ' + (levels[3] || levels['3'] || 0)
      + '. Most missed line: ' + missed;
    return stats;
  }

  function move(items, index, delta) {
    var next = items.slice();
    var other = index + delta;
    if (other < 0 || other >= next.length) return;
    var swap = next[index];
    next[index] = next[other];
    next[other] = swap;
    post({ action: 'reorder', ids: next.map(function (item) { return item.id; }) }).then(function (result) {
      if (result.ok) paintBoard(result.data);
    });
  }

  function paintBoard(data) {
    var host = $('[data-stage-board]');
    var list = $('[data-stage-list]');
    if (!host || !list) return;
    host.hidden = false;
    list.textContent = '';
    var items = data && Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      var empty = root.document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Nothing on your stage yet. Add a saved song and it will show on your EPK.';
      list.appendChild(empty);
      markAdded([]);
      return;
    }
    items.forEach(function (item, index) {
      var row = root.document.createElement('article');
      row.className = 'stage-row';
      row.setAttribute('data-stage-item', item.id || '');
      var title = root.document.createElement('h3');
      title.textContent = item.title || 'Untitled';
      row.appendChild(title);
      if (item.play) {
        var link = root.document.createElement('a');
        link.href = item.play;
        link.textContent = 'Play link';
        row.appendChild(link);
      }
      if (item.games && item.games.length) {
        var names = root.document.createElement('p');
        names.textContent = item.games.map(function (game) { return game.name; }).join('. ');
        row.appendChild(names);
      }
      var controls = root.document.createElement('div');
      controls.className = 'stage-controls';
      var up = button('Move up', function () { move(items, index, -1); });
      var down = button('Move down', function () { move(items, index, 1); });
      var remove = button('Remove', function () {
        post({ action: 'remove', id: item.id }).then(function (result) {
          if (result.ok) paintBoard(result.data);
        });
      });
      up.disabled = index === 0;
      down.disabled = index === items.length - 1;
      controls.appendChild(up);
      controls.appendChild(down);
      controls.appendChild(remove);
      row.appendChild(controls);
      var stats = paintStats(item);
      if (stats) row.appendChild(stats);
      list.appendChild(row);
    });
    markAdded(items);
  }

  function addSong(id, el) {
    if (!id) return;
    if (el) {
      el.disabled = true;
      el.textContent = 'Adding it...';
    }
    post({ action: 'add', lyric_id: id }).then(function (result) {
      if (!result.ok) {
        if (el) {
          el.disabled = false;
          el.textContent = 'Add to my stage';
        }
        return;
      }
      paintBoard({ items: result.data.items || [] });
      if (el) {
        el.disabled = true;
        el.textContent = 'On your stage';
      }
    });
  }

  function afterLyrics(songs) {
    if (!enabled('STAGE_ENABLED') || !root.document) return;
    var list = $('[data-lyrics-list]');
    if (list) {
      var buttons = list.querySelectorAll('button');
      (Array.isArray(songs) ? songs : []).forEach(function (song, index) {
        if (!song || !song.id || !buttons[index]) return;
        if (list.querySelector('[data-stage-add="' + song.id + '"]')) return;
        var add = root.document.createElement('button');
        add.type = 'button';
        add.className = 'btn btn-gold btn-sm stage-add';
        add.setAttribute('data-stage-add', song.id);
        add.textContent = 'Add to my stage';
        add.addEventListener('click', function () { addSong(song.id, add); });
        buttons[index].insertAdjacentElement('afterend', add);
      });
    }
    load();
  }

  function boot() {
    if (!enabled('STAGE_ENABLED')) return;
    if ($('[data-stage-board]')) load();
  }

  root.PlaigroundStagePage = {
    afterLyrics: afterLyrics,
    load: load,
  };

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
