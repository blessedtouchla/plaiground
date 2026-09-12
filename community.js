(function () {
  var form = document.querySelector('[data-community-post]');
  var feed = document.querySelector('[data-community-feed]');
  var api = window.PlaigroundCommunityDisclose;

  function render(rows) {
    if (!feed) return;
    feed.textContent = '';
    if (!rows || !rows.length) {
      feed.innerHTML = '<p class="hint">Nothing posted yet.</p>';
      return;
    }
    rows.forEach(function (row) {
      var card = document.createElement('article');
      card.className = 'release-board';
      card.style.marginBottom = '12px';
      var h = document.createElement('h3');
      h.textContent = row.title || 'Untitled';
      var who = document.createElement('p');
      who.className = 'hint';
      who.textContent = row.artist_name || 'Artist';
      var p = document.createElement('p');
      p.textContent = (row.badges || []).join(' \u00b7 ');
      card.appendChild(h);
      card.appendChild(who);
      card.appendChild(p);
      if (row.platform) {
        var s = document.createElement('p');
        s.className = 'hint';
        s.textContent = 'Platform: ' + row.platform;
        card.appendChild(s);
      }
      feed.appendChild(card);
    });
  }

  function loadFeed() {
    return fetch('/api/community', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (got) {
        render((got.data && got.data.posts) || []);
      })
      .catch(function () {
        render([]);
      });
  }

  if (api && form) api.bindForm(form);
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var made = (form.querySelector('input[name="made"]:checked') || {}).value;
      if (!made) return;
      var humans = [];
      form.querySelectorAll('input[name="human"]:checked').forEach(function (box) {
        humans.push(box.value);
      });
      var platform = made === 'no_ai' ? '' : String((form.platform && form.platform.value) || '');
      var title = String((form.title && form.title.value) || '').trim();
      var file = form.audio && form.audio.files && form.audio.files[0];
      fetch('/api/community', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          made: made,
          humans: humans,
          platform: platform,
          audio_name: file ? file.name : ''
        })
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (got) {
        if (!got.ok) {
          window.alert((got.data && got.data.error) || 'Sign in to post.');
          return;
        }
        form.reset();
        if (api) api.bindForm(form);
        loadFeed();
      }).catch(function () {
        window.alert('Could not post.');
      });
    });
  }
  loadFeed();
})();
