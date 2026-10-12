(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { api.mount(root.document); });
    else api.mount(root.document);
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function personaApi() {
    return (typeof window !== 'undefined' && window.PlaigroundPersona) || null;
  }

  function chipButtons(list, selected, group) {
    return list.map(function (name) {
      var on = selected.indexOf(name) !== -1;
      return '<button type="button" data-persona-chip="' + group + '" data-value="' + name + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + name + '</button>';
    }).join('');
  }

  function colorButtons(colors, selected) {
    return colors.map(function (swatch) {
      var on = selected.indexOf(swatch.hex) !== -1;
      return '<button type="button" data-persona-color="' + swatch.hex + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + swatch.label + '" style="background:' + swatch.hex + '"></button>';
    }).join('');
  }

  function field(label, html) {
    return '<div class="persona-block"><h3>' + label + '</h3>' + html + '</div>';
  }

  function render(persona, catalog) {
    var row = persona || {};
    var vibe = row.vibe || [];
    var look = (row.look && row.look.chips) || [];
    var voice = (row.voice && row.voice.chips) || [];
    var ages = (row.audience && row.audience.ages) || '';
    var influences = row.influences || {};
    var colors = row.colors || [];
    var meter = catalog.progress(row);
    return ''
      + '<p class="persona-meter-label">' + meter.label + '</p>'
      + '<div class="persona-meter" aria-hidden="true"><span style="width:' + Math.round((meter.filled / meter.total) * 100) + '%"></span></div>'
      + field('Vibe', '<div class="persona-chips">' + chipButtons(catalog.VIBE, vibe, 'vibe') + '</div><p class="hint">Pick up to 3.</p>')
      + field('Story', '<textarea data-persona-story rows="3" maxlength="600" placeholder="The moment this artist started">' + esc(row.story || '') + '</textarea>')
      + field('Look', '<div class="persona-chips">' + chipButtons(catalog.LOOK, look, 'look') + '</div><input data-persona-photo type="url" placeholder="Photo link (https)" value="' + esc((row.look && row.look.photo) || '') + '" />')
      + field('Voice', '<div class="persona-chips">' + chipButtons(catalog.VOICE, voice, 'voice') + '</div>'
        + '<label>Warmth <input data-persona-warmth type="range" min="1" max="5" value="' + ((row.voice && row.voice.warmth) || 3) + '" /></label>'
        + '<label>Energy <input data-persona-energy type="range" min="1" max="5" value="' + ((row.voice && row.voice.energy) || 3) + '" /></label>')
      + field('Audience', '<div class="persona-chips">' + chipButtons(catalog.AGES, ages ? [ages] : [], 'ages') + '</div>'
        + '<input data-persona-city placeholder="City" value="' + esc((row.audience && row.audience.city) || '') + '" />'
        + '<input data-persona-through placeholder="What they are going through" value="' + esc((row.audience && row.audience.going_through) || '') + '" />')
      + field('Influences', '<p class="hint">Eras, places, feelings. Skip other artist names.</p>'
        + '<div class="persona-chips">' + chipButtons(catalog.ERAS, influences.eras || [], 'eras') + chipButtons(catalog.PLACES, influences.places || [], 'places') + chipButtons(catalog.FEELINGS, influences.feelings || [], 'feelings') + '</div>')
      + field('Brand colors', '<div class="persona-colors">' + colorButtons(catalog.COLORS, colors) + '</div><p class="hint">Pick 2 or 3.</p>')
      + field('Stats, press, booking', '<input data-persona-listeners placeholder="Monthly listeners, if public" value="' + esc((row.stats && row.stats.monthly_listeners) || '') + '" />'
        + '<input data-persona-followers placeholder="Followers, if public" value="' + esc((row.stats && row.stats.followers) || '') + '" />'
        + '<input data-persona-shows placeholder="Shows" value="' + esc((row.stats && row.stats.shows) || '') + '" />'
        + '<textarea data-persona-press rows="2" placeholder="A press quote">' + esc((row.press && row.press[0] && row.press[0].quote) || '') + '</textarea>'
        + '<input data-persona-booking-name placeholder="Booking name" value="' + esc((row.booking && row.booking.name) || '') + '" />'
        + '<input data-persona-booking-email type="email" placeholder="Booking email" autocomplete="off" value="' + esc((row.booking && row.booking.email) || '') + '" />')
      + field('Socials and store artist links', '<input data-persona-instagram placeholder="Instagram" value="' + esc((row.socials && row.socials.instagram) || '') + '" />'
        + '<input data-persona-tiktok placeholder="TikTok" value="' + esc((row.socials && row.socials.tiktok) || '') + '" />'
        + '<input data-persona-youtube placeholder="YouTube" value="' + esc((row.socials && row.socials.youtube) || '') + '" />'
        + '<input data-persona-spotify placeholder="Spotify artist link" value="' + esc(row.spotify_artist || '') + '" />'
        + '<input data-persona-apple placeholder="Apple artist link" value="' + esc(row.apple_artist || '') + '" />')
      + field('Paste what you have', '<p class="hint">Paste public links or an old bio. Spotify, Apple, Linktree, Instagram, TikTok, YouTube, a site, a press page. Plai suggests fields for you to confirm. Nothing goes public on its own. We never ask for a password.</p>'
        + '<textarea data-persona-paste rows="4" placeholder="Paste links or bio text"></textarea>'
        + '<p><button class="btn btn-ghost btn-sm" type="button" data-persona-read>Read what I pasted</button></p>'
        + '<div data-persona-suggestions></div>')
      + '<div data-persona-asks></div>'
      + '<p class="page-head-actions">'
      + '<button class="btn btn-purple btn-sm" type="button" data-persona-save>Save persona</button>'
      + '<button class="btn btn-gold btn-sm" type="button" data-persona-publish>Publish EPK</button>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-persona-bio>Draft bio</button>'
      + '</p>'
      + '<p class="hint" data-persona-status></p>'
      + '<p data-persona-links></p>';
  }

  function readChips(root, group) {
    return Array.prototype.map.call(root.querySelectorAll('[data-persona-chip="' + group + '"][aria-pressed="true"]'), function (button) {
      return button.getAttribute('data-value');
    });
  }

  function collect(root) {
    var press = String((root.querySelector('[data-persona-press]') || {}).value || '').trim();
    return {
      vibe: readChips(root, 'vibe').slice(0, 3),
      story: (root.querySelector('[data-persona-story]') || {}).value || '',
      look: { chips: readChips(root, 'look'), photo: (root.querySelector('[data-persona-photo]') || {}).value || '' },
      voice: {
        chips: readChips(root, 'voice'),
        warmth: Number((root.querySelector('[data-persona-warmth]') || {}).value || 0),
        energy: Number((root.querySelector('[data-persona-energy]') || {}).value || 0),
      },
      audience: {
        ages: (readChips(root, 'ages')[0] || ''),
        city: (root.querySelector('[data-persona-city]') || {}).value || '',
        going_through: (root.querySelector('[data-persona-through]') || {}).value || '',
      },
      influences: {
        eras: readChips(root, 'eras'),
        places: readChips(root, 'places'),
        feelings: readChips(root, 'feelings'),
      },
      colors: Array.prototype.map.call(root.querySelectorAll('[data-persona-color][aria-pressed="true"]'), function (button) {
        return button.getAttribute('data-persona-color');
      }).slice(0, 3),
      stats: {
        monthly_listeners: (root.querySelector('[data-persona-listeners]') || {}).value || '',
        followers: (root.querySelector('[data-persona-followers]') || {}).value || '',
        shows: (root.querySelector('[data-persona-shows]') || {}).value || '',
      },
      press: press ? [{ quote: press, source: 'you' }] : [],
      booking: {
        name: (root.querySelector('[data-persona-booking-name]') || {}).value || '',
        email: (root.querySelector('[data-persona-booking-email]') || {}).value || '',
      },
      socials: {
        instagram: (root.querySelector('[data-persona-instagram]') || {}).value || '',
        tiktok: (root.querySelector('[data-persona-tiktok]') || {}).value || '',
        youtube: (root.querySelector('[data-persona-youtube]') || {}).value || '',
      },
      spotify_artist: (root.querySelector('[data-persona-spotify]') || {}).value || '',
      apple_artist: (root.querySelector('[data-persona-apple]') || {}).value || '',
    };
  }

  function sourceLine(sources, key) {
    if (!sources || !sources[key]) return '';
    return '<span class="persona-source">From ' + esc(sources[key]) + '</span>';
  }

  function suggestionHtml(payload) {
    var suggestions = payload && payload.suggestions || {};
    var sources = payload && payload.sources || {};
    var bits = [];
    if (suggestions.story) bits.push('<div class="persona-suggestion"><strong>Story.</strong> ' + esc(suggestions.story) + sourceLine(sources, 'story') + '</div>');
    if (suggestions.spotify_artist) bits.push('<div class="persona-suggestion"><strong>Spotify.</strong> ' + esc(suggestions.spotify_artist) + sourceLine(sources, 'spotify_artist') + '</div>');
    if (suggestions.apple_artist) bits.push('<div class="persona-suggestion"><strong>Apple.</strong> ' + esc(suggestions.apple_artist) + sourceLine(sources, 'apple_artist') + '</div>');
    var releases = suggestions.imported_releases || [];
    releases.forEach(function (row) {
      bits.push('<div class="persona-suggestion"><strong>Release.</strong> ' + esc(row.title || '') + sourceLine({ imported_releases: row.source }, 'imported_releases') + '</div>');
    });
    var asks = payload && payload.asks || [];
    if (asks.length) bits.push('<p>Plai still needs:</p><ul class="persona-asks">' + asks.map(function (item) { return '<li>' + item.ask + '</li>'; }).join('') + '</ul>');
    bits.push('<p><button class="btn btn-purple btn-sm" type="button" data-persona-use>Use these suggestions</button></p>');
    return bits.join('');
  }

  function mount(document) {
    var host = document.getElementById('persona-builder');
    var catalog = personaApi();
    if (!host || !catalog || host.getAttribute('data-persona-ready')) return;
    host.setAttribute('data-persona-ready', '1');
    var state = { artist: null, persona: null, suggestions: null };
    function paint() {
      var body = host.querySelector('[data-persona-body]');
      if (!body) return;
      if (!state.artist) {
        body.innerHTML = '<p class="hint">Pick an artist, then build the persona here.</p>';
        return;
      }
      body.innerHTML = '<h2>' + esc(state.artist.name) + '</h2>' + render(state.persona || catalog.emptyPersona(), catalog);
      var asksHost = body.querySelector('[data-persona-asks]');
      if (asksHost) {
        var missing = catalog.asks(catalog.normalize(collect(body), { name: state.artist.name }));
        asksHost.innerHTML = missing.length ? '<p>Plai will only ask what is still open.</p><ul class="persona-asks">' + missing.slice(0, 4).map(function (item) { return '<li>' + item.ask + '</li>'; }).join('') + '</ul>' : '<p>Plai has what it needs for the press kit.</p>';
      }
    }
    function post(url, body) {
      return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data || {} }; });
      });
    }
    function status(text) {
      var el = host.querySelector('[data-persona-status]');
      if (el) el.textContent = text;
    }
    host.addEventListener('click', function (event) {
      var chip = event.target && event.target.closest && event.target.closest('[data-persona-chip], [data-persona-color]');
      if (chip) {
        var pressed = chip.getAttribute('aria-pressed') === 'true';
        if (chip.hasAttribute('data-persona-color') && !pressed) {
          var on = host.querySelectorAll('[data-persona-color][aria-pressed="true"]').length;
          if (on >= 3) return;
        }
        if (chip.getAttribute('data-persona-chip') === 'vibe' && !pressed && readChips(host, 'vibe').length >= 3) return;
        chip.setAttribute('aria-pressed', pressed ? 'false' : 'true');
        return;
      }
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest('[data-persona-read]')) {
        var paste = (host.querySelector('[data-persona-paste]') || {}).value || '';
        status('Reading the public paste.');
        post('/api/me/persona-import', { text: paste }).then(function (result) {
          var box = host.querySelector('[data-persona-suggestions]');
          if (!result.ok) {
            status((result.data && result.data.error) || 'That paste could not be read.');
            return;
          }
          state.suggestions = result.data;
          if (box) box.innerHTML = suggestionHtml(result.data);
          status('Suggestions are ready. Confirm them before anything is saved.');
        }).catch(function () { status('That paste could not be read.'); });
        return;
      }
      if (target.closest('[data-persona-use]')) {
        var suggested = state.suggestions && state.suggestions.suggestions;
        if (!suggested) return;
        var current = collect(host);
        state.persona = Object.assign({}, suggested, current);
        if (!String(current.story || '').trim() && suggested.story) state.persona.story = suggested.story;
        if (!(current.vibe || []).length) state.persona.vibe = suggested.vibe;
        state.persona.published = false;
        paint();
        status('Suggestions are in the form. Save when they look right. This does not publish.');
        return;
      }
      if (target.closest('[data-persona-save]') || target.closest('[data-persona-publish]')) {
        if (!state.artist) return;
        var publishing = Boolean(target.closest('[data-persona-publish]'));
        var payload = collect(host);
        if (state.bios) payload.bios = state.bios;
        status(publishing ? 'Publishing the press kit.' : 'Saving the persona.');
        post('/api/me/artists', {
          artist_action: 'persona',
          id: state.artist.id,
          persona: payload,
          publish: publishing,
        }).then(function (result) {
          if (!result.ok) {
            status((result.data && result.data.error) || 'Save did not go through.');
            return;
          }
          state.persona = result.data.persona;
          paint();
          var links = host.querySelector('[data-persona-links]');
          if (links && result.data.epk_path) {
            links.innerHTML = '<a href="' + esc(result.data.epk_path) + '?preview=1">Preview EPK</a>';
          }
          status(result.data.published ? 'Your EPK is public.' : 'Saved. It stays private until you publish.');
        }).catch(function () { status('Save did not go through.'); });
        return;
      }
      if (target.closest('[data-persona-bio]')) {
        if (!state.artist) return;
        status('Plai is drafting the bio.');
        post('/api/me/persona-bio', { id: state.artist.id, persona: collect(host) }).then(function (result) {
          if (!result.ok) {
            status((result.data && result.data.error) || 'The bio draft did not come back.');
            return;
          }
          state.bios = result.data.bios;
          status('Draft ready (' + (result.data.source || 'sample') + '). Short: ' + ((result.data.bios && result.data.bios.short) || ''));
        }).catch(function () { status('The bio draft did not come back.'); });
      }
    });
    document.addEventListener('plaiground-artist', function (event) {
      state.artist = event.detail && event.detail.artist;
      state.persona = state.artist && state.artist.persona;
      host.hidden = !state.artist;
      paint();
    });
    var params = '';
    try { params = new URLSearchParams(window.location.search).get('id') || ''; } catch (err) { params = ''; }
    if (typeof fetch === 'function') {
      fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (me) {
          var artists = me && me.profile && me.profile.artists || [];
          var found = null;
          artists.forEach(function (row) {
            if (!found && params && (row.id === params || row.artist_id === params)) found = row;
          });
          if (!found && artists.length === 1) found = artists[0];
          if (!found) return;
          state.artist = found;
          state.persona = found.persona || null;
          host.hidden = false;
          paint();
        })
        .catch(function () {});
    }
    paint();
  }

  return { collect: collect, mount: mount, render: render, suggestionHtml: suggestionHtml };
});
