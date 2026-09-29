(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ArtistProfiles = api;
  if (typeof document !== 'undefined' && document.getElementById('plai-about')) api.mount(document);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var STORAGE_KEY = 'plaigroundArtistProfiles';
  var DESTINATION_KEY = 'plaigroundDestinationPlan';
  var NOTE_LIMIT = 240;
  var GENRES = ['Hip-Hop', 'R&B/Soul', 'Pop', 'Rock', 'Country', 'Electronic', 'Latin', 'Gospel', 'Jazz', 'Afrobeats', 'Alternative', 'Dance'];
  var STAGES = { idea: 'Idea', made: 'Made', out: 'Out' };
  var MAKERS = { human: 'Human', ai: 'AI', both: 'Both' };
  var COUNTS = { '1': '1', '2-5': '2 to 5', '6+': '6+', label: 'Label or manager' };
  var LINKS = [
    { id: 'spotify', label: 'Spotify' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'youtube', label: 'YouTube' }
  ];

  function storage() {
    return typeof window !== 'undefined' ? window : globalThis;
  }

  function clip(value, max) {
    return String(value == null ? '' : value).slice(0, max);
  }

  function emptyLinks() {
    return { spotify: '', instagram: '', tiktok: '', youtube: '' };
  }

  function emptyArtist(extra) {
    var artist = {
      id: 'a' + Math.random().toString(36).slice(2, 8),
      name: '',
      genre: '',
      genres: [],
      genreOther: '',
      city: '',
      stage: '',
      madeBy: '',
      links: emptyLinks(),
      picked: false
    };
    if (!extra) return artist;
    Object.keys(extra).forEach(function (key) { artist[key] = extra[key]; });
    return artist;
  }

  function isFullUrl(value) {
    var text = String(value || '').trim();
    if (!text) return true;
    if (!/^https?:\/\//i.test(text)) return false;
    try {
      var url = new URL(text);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }

  function normalize(raw) {
    raw = raw || {};
    var artists = Array.isArray(raw.artists) ? raw.artists : [];
    var clean = artists.map(function (row, index) {
      row = row || {};
      var genre = GENRES.indexOf(row.genre) !== -1 ? row.genre : '';
      var genres = [];
      (Array.isArray(row.genres) ? row.genres : []).forEach(function (name) {
        if (GENRES.indexOf(name) !== -1 && name !== genre && genres.indexOf(name) === -1) genres.push(name);
      });
      var links = emptyLinks();
      LINKS.forEach(function (link) {
        var value = row.links && row.links[link.id] != null ? String(row.links[link.id]).trim() : '';
        links[link.id] = value.slice(0, 300);
      });
      return {
        id: String(row.id || ('a' + (index + 1))),
        name: clip(row.name, 80).trim(),
        genre: genre,
        genres: genres,
        genreOther: clip(row.genreOther, 80).trim(),
        city: clip(row.city, 80).trim(),
        stage: STAGES[row.stage] ? row.stage : '',
        madeBy: MAKERS[row.madeBy] ? row.madeBy : '',
        links: links,
        picked: !!row.picked
      };
    });
    if (!clean.length) clean.push(emptyArtist({ id: 'a1', picked: true }));
    var seen = false;
    clean.forEach(function (artist) {
      if (artist.picked && !seen) seen = true;
      else artist.picked = false;
    });
    if (!seen) clean[0].picked = true;
    return {
      count: COUNTS[raw.count] ? raw.count : '',
      note: clip(raw.note, NOTE_LIMIT),
      artists: clean
    };
  }

  function genresFromPlan(list) {
    var known = [];
    var other = '';
    (Array.isArray(list) ? list : []).forEach(function (name) {
      var text = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (GENRES.indexOf(text) !== -1) {
        if (known.indexOf(text) === -1) known.push(text);
      } else if (!other) {
        other = clip(text, 80).trim();
      }
    });
    return {
      genre: known[0] || '',
      genres: known.slice(1),
      genreOther: other
    };
  }

  function genresEmpty(artist) {
    return !artist.genre && (!artist.genres || !artist.genres.length) && !artist.genreOther;
  }

  function fillEmptyFromPlan(record, plan) {
    plan = plan || {};
    var changed = false;
    if (!record.count && COUNTS[plan.artistCount]) {
      record.count = plan.artistCount;
      changed = true;
    }
    var mapped = genresFromPlan(plan.genres);
    var first = record.artists[0];
    var hasGenres = mapped.genre || mapped.genres.length || mapped.genreOther;
    if (first && genresEmpty(first) && hasGenres) {
      first.genre = mapped.genre;
      first.genres = mapped.genres.slice();
      first.genreOther = mapped.genreOther;
      changed = true;
    }
    return { record: normalize(record), changed: changed };
  }

  function seedFromPlan(plan) {
    plan = plan || {};
    var mapped = genresFromPlan(plan.genres);
    return {
      count: COUNTS[plan.artistCount] ? plan.artistCount : '',
      note: clip(plan.note, NOTE_LIMIT),
      artists: [emptyArtist({
        id: 'from-route',
        stage: STAGES[plan.song] ? plan.song : '',
        genre: mapped.genre,
        genres: mapped.genres,
        genreOther: mapped.genreOther,
        picked: true
      })]
    };
  }

  function planHasSeed(plan) {
    if (!plan) return false;
    if (plan.song || plan.note || COUNTS[plan.artistCount]) return true;
    return Array.isArray(plan.genres) && plan.genres.length > 0;
  }

  function readJson(store, key) {
    if (!store) return null;
    try {
      var raw = store.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function loadRecord(store) {
    var saved = readJson(store, STORAGE_KEY);
    var plan = readJson(store, DESTINATION_KEY);
    if (saved) {
      var filled = fillEmptyFromPlan(normalize(saved), plan);
      return { record: filled.record, persist: filled.changed };
    }
    if (planHasSeed(plan)) return { record: normalize(seedFromPlan(plan)), persist: true };
    return { record: normalize({ artists: [] }), persist: false };
  }

  function pickedStage(record) {
    var artists = record && record.artists;
    if (!artists && record == null) {
      var loaded = loadRecord(storage().localStorage);
      artists = loaded.record.artists;
    } else if (!artists) {
      return '';
    }
    var picked = null;
    artists.forEach(function (artist) {
      if (!picked && artist.picked) picked = artist;
    });
    if (!picked && artists.length === 1) picked = artists[0];
    if (!picked || !STAGES[picked.stage]) return '';
    return picked.stage;
  }

  function primaryLabel(artist) {
    if (artist.genre) return 'Primary: ' + artist.genre;
    if (artist.genreOther) return 'Primary: ' + artist.genreOther;
    return 'Pick a primary genre.';
  }

  function mount(doc) {
    var section = doc.getElementById('plai-about');
    if (!section || section.getAttribute('data-mounted') === '1') return;
    section.setAttribute('data-mounted', '1');
    var store = storage().localStorage;
    var loaded = loadRecord(store);
    var record = loaded.record;
    var list = doc.getElementById('plai-about-artists');
    var note = doc.getElementById('plai-about-note');
    var status = doc.getElementById('plai-about-status');

    function save() {
      record = normalize(record);
      try {
        if (store) store.setItem(STORAGE_KEY, JSON.stringify(record));
      } catch (err) {}
      if (!status) return;
      var bad = false;
      record.artists.forEach(function (artist) {
        LINKS.forEach(function (link) {
          if (!isFullUrl(artist.links[link.id])) bad = true;
        });
      });
      status.textContent = bad ? 'Saved on this device. Use a full link, starting with https://.' : 'Saved on this device.';
    }

    function findArtist(id) {
      for (var i = 0; i < record.artists.length; i += 1) {
        if (record.artists[i].id === id) return record.artists[i];
      }
      return null;
    }

    function button(label, className, pressed) {
      var node = doc.createElement('button');
      node.type = 'button';
      node.className = className;
      node.textContent = label;
      node.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      return node;
    }

    function field(labelText, node) {
      var wrap = doc.createElement('div');
      wrap.className = 'field';
      var label = doc.createElement('label');
      label.textContent = labelText;
      if (node.id) label.htmlFor = node.id;
      wrap.appendChild(label);
      wrap.appendChild(node);
      return wrap;
    }

    function paintCounts() {
      section.querySelectorAll('[data-plai-count]').forEach(function (node) {
        var on = node.getAttribute('data-plai-count') === record.count;
        node.classList.toggle('is-on', on);
        node.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function renderArtists() {
      if (!list) return;
      list.textContent = '';
      record.artists.forEach(function (artist, index) {
        var card = doc.createElement('article');
        card.className = 'plai-artist';
        card.setAttribute('data-plai-artist', artist.id);

        var head = doc.createElement('div');
        head.className = 'plai-artist-head';
        var title = doc.createElement('h3');
        title.textContent = 'Artist ' + (index + 1);
        var remove = button('Remove', 'btn btn-ghost btn-sm', false);
        remove.setAttribute('data-plai-remove', artist.id);
        head.appendChild(title);
        head.appendChild(remove);

        var name = doc.createElement('input');
        name.type = 'text';
        name.maxLength = 80;
        name.autocomplete = 'off';
        name.placeholder = 'Artist name';
        name.setAttribute('data-plai-field', 'name');
        name.value = artist.name;

        var primary = doc.createElement('div');
        primary.className = 'plai-chips';
        primary.setAttribute('role', 'group');
        primary.setAttribute('aria-label', 'Primary genre');
        GENRES.forEach(function (nameText) {
          var chip = button(nameText, 'plai-chip' + (artist.genre === nameText ? ' is-primary' : ''), artist.genre === nameText);
          chip.setAttribute('data-plai-primary', nameText);
          primary.appendChild(chip);
        });
        var primaryLine = doc.createElement('p');
        primaryLine.className = 'hint';
        primaryLine.textContent = primaryLabel(artist);

        var extras = doc.createElement('div');
        extras.className = 'plai-chips';
        extras.setAttribute('role', 'group');
        extras.setAttribute('aria-label', 'Other genres');
        GENRES.forEach(function (nameText) {
          if (nameText === artist.genre) return;
          var on = artist.genres.indexOf(nameText) !== -1;
          var chip = button(nameText, 'plai-chip' + (on ? ' is-on' : ''), on);
          chip.setAttribute('data-plai-extra', nameText);
          extras.appendChild(chip);
        });

        var other = doc.createElement('input');
        other.type = 'text';
        other.maxLength = 80;
        other.autocomplete = 'off';
        other.placeholder = 'Type a genre';
        other.setAttribute('data-plai-field', 'genreOther');
        other.value = artist.genreOther;

        var city = doc.createElement('input');
        city.type = 'text';
        city.maxLength = 80;
        city.autocomplete = 'off';
        city.placeholder = 'City or region';
        city.setAttribute('data-plai-field', 'city');
        city.value = artist.city;

        var stageRow = doc.createElement('div');
        stageRow.className = 'plai-chips';
        stageRow.setAttribute('role', 'group');
        stageRow.setAttribute('aria-label', 'Song stage');
        Object.keys(STAGES).forEach(function (key) {
          var chip = button(STAGES[key], 'plai-chip' + (artist.stage === key ? ' is-primary' : ''), artist.stage === key);
          chip.setAttribute('data-plai-stage', key);
          stageRow.appendChild(chip);
        });

        var makerRow = doc.createElement('div');
        makerRow.className = 'plai-chips';
        makerRow.setAttribute('role', 'group');
        makerRow.setAttribute('aria-label', 'Human or AI');
        Object.keys(MAKERS).forEach(function (key) {
          var chip = button(MAKERS[key], 'plai-chip' + (artist.madeBy === key ? ' is-primary' : ''), artist.madeBy === key);
          chip.setAttribute('data-plai-maker', key);
          makerRow.appendChild(chip);
        });

        var links = doc.createElement('div');
        links.className = 'plai-links';
        LINKS.forEach(function (link) {
          var input = doc.createElement('input');
          input.type = 'url';
          input.inputMode = 'url';
          input.placeholder = 'https://';
          input.autocomplete = 'off';
          input.setAttribute('data-plai-field', 'link-' + link.id);
          input.value = artist.links[link.id] || '';
          if (!isFullUrl(input.value)) input.className = 'is-bad';
          var wrap = field(link.label, input);
          var hint = doc.createElement('p');
          hint.className = 'hint plai-link-hint';
          hint.setAttribute('data-plai-link-hint', link.id);
          hint.textContent = 'Use a full link, starting with https://.';
          hint.hidden = isFullUrl(input.value);
          wrap.appendChild(hint);
          links.appendChild(wrap);
        });

        var pick = doc.createElement('label');
        pick.className = 'plai-pick';
        var radio = doc.createElement('input');
        radio.type = 'radio';
        radio.name = 'plai-picked';
        radio.checked = !!artist.picked;
        radio.setAttribute('data-plai-pick', artist.id);
        var pickText = doc.createElement('span');
        pickText.textContent = 'Use this song stage on your route';
        pick.appendChild(radio);
        pick.appendChild(pickText);

        card.appendChild(head);
        card.appendChild(field('Artist name', name));
        var genreLabel = doc.createElement('p');
        genreLabel.className = 'plai-label';
        genreLabel.textContent = 'Primary genre';
        card.appendChild(genreLabel);
        card.appendChild(primary);
        card.appendChild(primaryLine);
        var extraLabel = doc.createElement('p');
        extraLabel.className = 'plai-label';
        extraLabel.textContent = 'Other genres';
        card.appendChild(extraLabel);
        card.appendChild(extras);
        card.appendChild(field('Other', other));
        card.appendChild(field('City or region', city));
        var stageLabel = doc.createElement('p');
        stageLabel.className = 'plai-label';
        stageLabel.textContent = 'Song stage';
        card.appendChild(stageLabel);
        card.appendChild(stageRow);
        var makerLabel = doc.createElement('p');
        makerLabel.className = 'plai-label';
        makerLabel.textContent = 'Human or AI';
        card.appendChild(makerLabel);
        card.appendChild(makerRow);
        var linkLabel = doc.createElement('p');
        linkLabel.className = 'plai-label';
        linkLabel.textContent = 'Links';
        card.appendChild(linkLabel);
        card.appendChild(links);
        card.appendChild(pick);
        list.appendChild(card);
      });
    }

    function setChoice(artist, key, value) {
      artist[key] = artist[key] === value ? '' : value;
      if (key === 'genre') artist.genres = artist.genres.filter(function (name) { return name !== artist.genre; });
      renderArtists();
      save();
    }

    if (note) {
      note.value = record.note;
      note.addEventListener('input', function () {
        record.note = note.value.slice(0, NOTE_LIMIT);
        save();
      });
    }

    section.addEventListener('input', function (event) {
      var target = event.target;
      if (!target || target.id === 'plai-about-note') return;
      var card = target.closest('[data-plai-artist]');
      if (!card) return;
      var artist = findArtist(card.getAttribute('data-plai-artist'));
      if (!artist) return;
      var fieldName = target.getAttribute('data-plai-field');
      if (!fieldName) return;
      if (fieldName.indexOf('link-') === 0) {
        var linkId = fieldName.slice(5);
        artist.links[linkId] = target.value;
        var bad = !isFullUrl(target.value);
        target.classList.toggle('is-bad', bad);
        var hint = card.querySelector('[data-plai-link-hint="' + linkId + '"]');
        if (hint) hint.hidden = !bad;
      } else if (fieldName === 'name' || fieldName === 'city' || fieldName === 'genreOther') {
        artist[fieldName] = target.value;
        if (fieldName === 'genreOther') {
          var line = card.querySelector('.hint');
          if (line && !artist.genre) line.textContent = primaryLabel(artist);
        }
      }
      save();
    });

    section.addEventListener('click', function (event) {
      var count = event.target.closest('[data-plai-count]');
      if (count && section.contains(count)) {
        var next = count.getAttribute('data-plai-count');
        record.count = record.count === next ? '' : next;
        paintCounts();
        save();
        return;
      }
      var card = event.target.closest('[data-plai-artist]');
      if (!card || !section.contains(card)) return;
      var artist = findArtist(card.getAttribute('data-plai-artist'));
      if (!artist) return;
      var primary = event.target.closest('[data-plai-primary]');
      if (primary) {
        setChoice(artist, 'genre', primary.getAttribute('data-plai-primary'));
        return;
      }
      var extra = event.target.closest('[data-plai-extra]');
      if (extra) {
        var extraName = extra.getAttribute('data-plai-extra');
        if (extraName === artist.genre) return;
        if (artist.genres.indexOf(extraName) === -1) artist.genres.push(extraName);
        else artist.genres = artist.genres.filter(function (name) { return name !== extraName; });
        renderArtists();
        save();
        return;
      }
      var stage = event.target.closest('[data-plai-stage]');
      if (stage) {
        setChoice(artist, 'stage', stage.getAttribute('data-plai-stage'));
        return;
      }
      var maker = event.target.closest('[data-plai-maker]');
      if (maker) {
        setChoice(artist, 'madeBy', maker.getAttribute('data-plai-maker'));
        return;
      }
      var remove = event.target.closest('[data-plai-remove]');
      if (remove) {
        if (record.artists.length === 1) {
          var keepId = artist.id;
          record.artists = [emptyArtist({ id: keepId, picked: true })];
        } else {
          var wasPicked = artist.picked;
          record.artists = record.artists.filter(function (row) { return row.id !== artist.id; });
          if (wasPicked) record.artists[0].picked = true;
        }
        renderArtists();
        save();
      }
    });

    section.addEventListener('change', function (event) {
      var pick = event.target.closest('[data-plai-pick]');
      if (!pick) return;
      var id = pick.getAttribute('data-plai-pick');
      record.artists.forEach(function (artist) { artist.picked = artist.id === id; });
      save();
    });

    var add = doc.getElementById('plai-about-add');
    if (add) {
      add.addEventListener('click', function () {
        record.artists.push(emptyArtist());
        record = normalize(record);
        renderArtists();
        save();
      });
    }

    paintCounts();
    renderArtists();
    if (loaded.persist) save();
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    DESTINATION_KEY: DESTINATION_KEY,
    NOTE_LIMIT: NOTE_LIMIT,
    GENRES: GENRES,
    STAGES: STAGES,
    MAKERS: MAKERS,
    COUNTS: COUNTS,
    emptyArtist: emptyArtist,
    isFullUrl: isFullUrl,
    normalize: normalize,
    seedFromPlan: seedFromPlan,
    loadRecord: loadRecord,
    pickedStage: pickedStage,
    mount: mount
  };
});
