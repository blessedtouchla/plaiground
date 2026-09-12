(function () {
  var KEY = 'plaiground.community.posts';
  var form = document.querySelector('[data-community-post]');
  var feed = document.querySelector('[data-community-feed]');
  var api = window.PlaigroundCommunityDisclose;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (err) { return []; }
  }
  function save(rows) {
    localStorage.setItem(KEY, JSON.stringify(rows));
  }

  function render() {
    if (!feed) return;
    var rows = load();
    feed.textContent = '';
    if (!rows.length) {
      feed.innerHTML = '<p class="hint">Nothing posted yet.</p>';
      return;
    }
    rows.slice().reverse().forEach(function (row) {
      var card = document.createElement('article');
      card.className = 'release-board';
      card.style.marginBottom = '12px';
      var h = document.createElement('h3');
      h.textContent = row.title || 'Untitled';
      var p = document.createElement('p');
      p.textContent = (row.badges || []).join(' · ');
      card.appendChild(h);
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
      var platform = '';
      if (made !== 'no_ai') {
        platform = String((form.platform && form.platform.value) || '');
      }
      var title = String((form.title && form.title.value) || '').trim();
      var file = form.audio && form.audio.files && form.audio.files[0];
      var rows = load();
      rows.push({
        title: title,
        file_name: file ? file.name : '',
        made: made,
        humans: humans,
        platform: platform,
        badges: api ? api.badges(made, humans) : [],
        at: new Date().toISOString()
      });
      save(rows);
      form.reset();
      if (api) api.bindForm(form);
      render();
    });
  }
  render();
})();
