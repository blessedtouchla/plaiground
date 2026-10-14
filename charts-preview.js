(function () {
  var root = document.getElementById('charts-root');
  if (!root) return;
  var page = document.body.getAttribute('data-charts-page') || 'index';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function sourceLine(row) {
    var name = row && row.source_name ? row.source_name : 'Data unavailable';
    var when = row && row.as_of ? row.as_of : 'Data unavailable';
    var text = 'Source: ' + name + '. As of: ' + when + '.';
    if (row && row.source_url) {
      var link = document.createElement('a');
      link.href = row.source_url;
      link.rel = 'noopener';
      link.textContent = name;
      var wrap = el('p', 'charts-meta');
      wrap.appendChild(document.createTextNode('Source: '));
      wrap.appendChild(link);
      wrap.appendChild(document.createTextNode('. As of: ' + when + '.'));
      return wrap;
    }
    return el('p', 'charts-meta', text);
  }

  function metric(title, row) {
    var card = el('article', 'charts-card');
    card.appendChild(el('h3', '', title));
    card.appendChild(el('p', '', row && row.value ? row.value : 'Data unavailable'));
    if (row && row.value === 'Coming soon') {
      card.appendChild(el('p', 'charts-meta', 'Source: Coming soon.'));
      return card;
    }
    card.appendChild(sourceLine(row || {}));
    return card;
  }

  function songCard(song, linked) {
    var card = el('article', 'charts-card');
    var title = linked ? el('a', '', song.title) : el('h2', '', song.title);
    if (linked) {
      title.href = '/charts-preview/song?slug=' + encodeURIComponent(song.slug);
      var heading = el('h2');
      heading.appendChild(title);
      card.appendChild(heading);
    } else {
      card.appendChild(title);
    }
    card.appendChild(el('p', 'charts-meta', song.artist || ''));
    var ai = el('p', 'charts-meta');
    ai.textContent = 'AI label: ' + (song.ai_label || 'Unknown');
    card.appendChild(ai);
    if (song.ai_source_url) card.appendChild(sourceLine({
      source_name: song.ai_source_name || 'Data unavailable',
      source_url: song.ai_source_url,
      as_of: 'public source',
    }));
    (song.charts || []).forEach(function (chart) {
      card.appendChild(el('h3', '', chart.chart_name || 'Chart'));
      card.appendChild(el('p', '', chart.value || 'Data unavailable'));
      card.appendChild(sourceLine({
        source_name: chart.source_name,
        source_url: chart.source_url,
        as_of: chart.as_of,
      }));
    });
    card.appendChild(metric('YouTube views', song.youtube));
    card.appendChild(metric('Apple Music Most Played', song.apple));
    card.appendChild(metric('Spotify', song.spotify));
    card.appendChild(metric('TikTok', song.tiktok));
    return card;
  }

  function showError(message) {
    root.appendChild(el('p', 'charts-note', message || 'Data unavailable'));
  }

  function loadIndex() {
    fetch('/api/charts-preview', { credentials: 'same-origin' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var songs = data && data.songs ? data.songs : [];
        if (!songs.length) {
          showError('Data unavailable');
          return;
        }
        songs.forEach(function (song) { root.appendChild(songCard(song, true)); });
      })
      .catch(function () { showError('Data unavailable'); });
  }

  function loadSong() {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get('slug') || '';
    if (!slug) {
      showError('Data unavailable');
      return;
    }
    fetch('/api/charts-preview/song?slug=' + encodeURIComponent(slug), { credentials: 'same-origin' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.song) {
          showError((data && data.error) || 'Data unavailable');
          return;
        }
        root.appendChild(songCard(data.song, false));
      })
      .catch(function () { showError('Data unavailable'); });
  }

  function bindForm() {
    var form = document.getElementById('charts-correct-form');
    var note = document.getElementById('charts-correct-note');
    if (!form) return;
    fetch('/api/charts-preview', { credentials: 'same-origin' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var select = document.getElementById('charts-correct-song');
        if (!select) return;
        (data.songs || []).forEach(function (song) {
          var option = document.createElement('option');
          option.value = song.slug;
          option.textContent = song.title;
          select.appendChild(option);
        });
      })
      .catch(function () {});
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var body = {
        song_slug: document.getElementById('charts-correct-song').value,
        field_name: document.getElementById('charts-correct-field').value,
        message: document.getElementById('charts-correct-message').value,
        source_url: document.getElementById('charts-correct-source').value,
        email: document.getElementById('charts-correct-email').value,
      };
      fetch('/api/charts-preview/corrections', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (res) { return res.json(); }).then(function (data) {
        if (!note) return;
        note.textContent = data && data.ok
          ? 'Saved. This note does not change a number by itself.'
          : ((data && data.error) || 'That correction did not save.');
      }).catch(function () {
        if (note) note.textContent = 'That correction did not save.';
      });
    });
  }

  if (page === 'song') loadSong();
  else if (page === 'corrections') bindForm();
  else if (page === 'index') loadIndex();
}());
