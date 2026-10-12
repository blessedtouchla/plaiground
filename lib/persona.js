/**
 * Artist persona and the public press kit built from it.
 * Browser and server. No secrets. No other artist names in influences.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundPersona = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var VIBE = ['warm', 'late night', 'honest', 'bright', 'heavy', 'soft', 'bold', 'playful', 'cinematic', 'raw', 'dreamy', 'direct'];
  var LOOK = ['street', 'soft', 'stage', 'vintage', 'minimal', 'neon', 'earth', 'tailored', 'DIY', 'night'];
  var VOICE = ['raspy', 'smooth', 'powerful', 'airy', 'spoken', 'melodic', 'gritty', 'bright', 'low', 'light'];
  var AGES = ['under 18', '18-24', '25-34', '35-44', '45+'];
  var ERAS = ['70s', '80s', '90s', '2000s', 'now', 'timeless'];
  var PLACES = ['the city', 'the south', 'the coast', 'a small town', 'the road', 'home', 'the club', 'the church'];
  var FEELINGS = ['heartbreak', 'hope', 'grind', 'joy', 'faith', 'anger', 'nostalgia', 'freedom'];
  var COLORS = [
    { id: 'ink', hex: '#161616', label: 'Ink' },
    { id: 'cream', hex: '#f6f1e7', label: 'Cream' },
    { id: 'gold', hex: '#e2b657', label: 'Gold' },
    { id: 'plum', hex: '#5c3d6e', label: 'Plum' },
    { id: 'rose', hex: '#c96b7b', label: 'Rose' },
    { id: 'sea', hex: '#2f6f73', label: 'Sea' },
    { id: 'night', hex: '#24324a', label: 'Night' },
    { id: 'sand', hex: '#c4a574', label: 'Sand' },
  ];
  var REQUIRED = ['vibe', 'story', 'voice'];
  var CREDIT = 'Human + AI. A person made the choices. AI helped with drafts and tools.';

  function clip(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function lower(value) {
    return clip(value, 80).toLowerCase();
  }

  function pickList(raw, allowed, max) {
    var seen = {};
    var out = [];
    (Array.isArray(raw) ? raw : [raw]).forEach(function (item) {
      var text = lower(item);
      if (!text || seen[text]) return;
      var match = '';
      allowed.forEach(function (name) {
        if (name.toLowerCase() === text) match = name;
      });
      if (!match) return;
      seen[text] = true;
      if (out.length < max) out.push(match);
    });
    return out;
  }

  function looksLikeNamedArtist(value) {
    var text = clip(value, 80);
    if (!text) return false;
    var parts = text.split(' ');
    if (!parts.length || parts.length > 3) return false;
    return parts.every(function (part) {
      return /^[A-Z][a-zA-Z.'-]{1,}$/.test(part);
    });
  }

  function influenceList(raw, allowed, max) {
    var fromChips = pickList(raw, allowed, max);
    if (fromChips.length) return fromChips;
    var out = [];
    (Array.isArray(raw) ? raw : [raw]).forEach(function (item) {
      var text = clip(item, 40);
      if (!text || looksLikeNamedArtist(text)) return;
      var known = pickList([text], allowed, 1);
      if (known.length) {
        if (out.indexOf(known[0]) === -1 && out.length < max) out.push(known[0]);
        return;
      }
      if (out.length < max) out.push(text.toLowerCase());
    });
    return out;
  }

  function privateHost(hostname) {
    var host = String(hostname || '').toLowerCase().replace(/\.+$/, '');
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
    var parts = host.split('.').map(function (part) { return Number(part); });
    if (parts.length === 4 && parts.every(function (n) { return n >= 0 && n <= 255; })) {
      if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    }
    return false;
  }

  function httpsUrl(value, max) {
    var text = clip(value, max || 300);
    if (!/^https:\/\//i.test(text)) return '';
    try {
      var url = new URL(text);
      if (url.protocol !== 'https:') return '';
      if (url.username || url.password) return '';
      if (privateHost(url.hostname)) return '';
      return url.toString().slice(0, max || 300);
    } catch (err) {
      return '';
    }
  }

  function socialValue(value) {
    var text = clip(value, 200);
    if (!text) return '';
    if (/password/i.test(text)) return '';
    if (/^https?:\/\//i.test(text)) return httpsUrl(text, 200);
    if (/^@?[A-Za-z0-9._-]{2,40}$/.test(text)) return text.replace(/^@/, '@');
    return '';
  }

  function emailValue(value) {
    var text = clip(value, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return '';
    return text;
  }

  function slider(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    n = Math.round(n);
    if (n < 1 || n > 5) return 0;
    return n;
  }

  function hexColor(value) {
    var text = clip(value, 20).toLowerCase();
    var found = '';
    COLORS.forEach(function (swatch) {
      if (swatch.hex === text || swatch.id === text || swatch.label.toLowerCase() === text) found = swatch.hex;
    });
    if (found) return found;
    return /^#[0-9a-f]{6}$/.test(text) ? text : '';
  }

  function slugify(name) {
    var slug = String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
    return slug || 'artist';
  }

  function emptyPersona() {
    return {
      vibe: [],
      story: '',
      look: { chips: [], photo: '', note: '' },
      voice: { chips: [], note: '', warmth: 0, energy: 0 },
      audience: { ages: '', city: '', going_through: '' },
      influences: { eras: [], places: [], feelings: [] },
      colors: [],
      stats: { monthly_listeners: '', followers: '', shows: '', playlist_adds: '' },
      press: [],
      booking: { name: '', email: '', url: '' },
      gallery: [],
      socials: { instagram: '', tiktok: '', youtube: '', website: '' },
      spotify_artist: '',
      apple_artist: '',
      genres: [],
      imported_releases: [],
      bios: { short: '', medium: '', long: '' },
      sources: {},
      slug: '',
      published: false,
    };
  }

  function hasPersonaContent(persona) {
    if (!persona) return false;
    if (persona.vibe.length || persona.story || persona.look.chips.length || persona.look.photo || persona.look.note) return true;
    if (persona.voice.chips.length || persona.voice.note || persona.voice.warmth || persona.voice.energy) return true;
    if (persona.audience.ages || persona.audience.city || persona.audience.going_through) return true;
    if (persona.influences.eras.length || persona.influences.places.length || persona.influences.feelings.length) return true;
    if (persona.colors.length || persona.press.length || persona.gallery.length || persona.imported_releases.length) return true;
    if (persona.booking.name || persona.booking.email || persona.booking.url) return true;
    if (persona.spotify_artist || persona.apple_artist || persona.genres.length) return true;
    if (persona.bios.short || persona.bios.medium || persona.bios.long) return true;
    var stats = persona.stats;
    if (stats.monthly_listeners || stats.followers || stats.shows || stats.playlist_adds) return true;
    return ['instagram', 'tiktok', 'youtube', 'website'].some(function (key) { return persona.socials[key]; });
  }

  function normalize(raw, opts) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (Object.prototype.hasOwnProperty.call(raw, 'password') || Object.prototype.hasOwnProperty.call(raw, 'password_hash')) {
      return null;
    }
    var base = emptyPersona();
    var look = raw.look && typeof raw.look === 'object' ? raw.look : {};
    var voice = raw.voice && typeof raw.voice === 'object' ? raw.voice : {};
    var audience = raw.audience && typeof raw.audience === 'object' ? raw.audience : {};
    var influences = raw.influences && typeof raw.influences === 'object' ? raw.influences : {};
    var stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    var booking = raw.booking && typeof raw.booking === 'object' ? raw.booking : {};
    var socials = raw.socials && typeof raw.socials === 'object' ? raw.socials : {};
    var bios = raw.bios && typeof raw.bios === 'object' ? raw.bios : {};
    base.vibe = pickList(raw.vibe, VIBE, 3);
    var vibeNote = clip(raw.vibe_note || raw.vibeNote, 80);
    if (vibeNote && base.vibe.length < 3 && !looksLikeNamedArtist(vibeNote)) base.vibe.push(vibeNote.toLowerCase());
    base.vibe = base.vibe.slice(0, 3);
    base.story = clip(raw.story, 600);
    base.look = {
      chips: pickList(look.chips || raw.look_chips, LOOK, 3),
      photo: httpsUrl(look.photo || raw.mood_photo, 300),
      note: clip(look.note, 160),
    };
    var voiceChips = Array.isArray(raw.voice) ? raw.voice : (voice.chips || []);
    base.voice = {
      chips: pickList(voiceChips, VOICE, 3),
      note: clip(voice.note, 160),
      warmth: slider(voice.warmth),
      energy: slider(voice.energy),
    };
    var age = lower(audience.ages || audience.age || raw.age);
    var ageMatch = '';
    AGES.forEach(function (name) { if (name.toLowerCase() === age) ageMatch = name; });
    base.audience = {
      ages: ageMatch,
      city: clip(audience.city, 80),
      going_through: clip(audience.going_through || audience.goingThrough, 200),
    };
    base.influences = {
      eras: influenceList(influences.eras, ERAS, 3),
      places: influenceList(influences.places, PLACES, 3),
      feelings: influenceList(influences.feelings, FEELINGS, 3),
    };
    var colors = [];
    (Array.isArray(raw.colors) ? raw.colors : []).forEach(function (item) {
      var hex = hexColor(item);
      if (hex && colors.indexOf(hex) === -1 && colors.length < 3) colors.push(hex);
    });
    base.colors = colors;
    base.stats = {
      monthly_listeners: clip(stats.monthly_listeners || stats.listeners, 40),
      followers: clip(stats.followers, 40),
      shows: clip(stats.shows, 80),
      playlist_adds: clip(stats.playlist_adds || stats.playlists, 80),
    };
    var press = [];
    (Array.isArray(raw.press) ? raw.press : []).forEach(function (item) {
      if (!item || typeof item !== 'object' || press.length >= 6) return;
      var quote = clip(item.quote, 240);
      if (!quote) return;
      press.push({ quote: quote, source: clip(item.source, 80), url: httpsUrl(item.url, 300) });
    });
    base.press = press;
    base.booking = {
      name: clip(booking.name, 80),
      email: emailValue(booking.email),
      url: httpsUrl(booking.url, 300),
    };
    var gallery = [];
    (Array.isArray(raw.gallery) ? raw.gallery : []).forEach(function (item) {
      var url = httpsUrl(item, 300);
      if (url && gallery.indexOf(url) === -1 && gallery.length < 6) gallery.push(url);
    });
    base.gallery = gallery;
    base.socials = {
      instagram: socialValue(socials.instagram),
      tiktok: socialValue(socials.tiktok),
      youtube: socialValue(socials.youtube),
      website: httpsUrl(socials.website, 300),
    };
    base.spotify_artist = httpsUrl(raw.spotify_artist || raw.spotify, 300);
    base.apple_artist = httpsUrl(raw.apple_artist || raw.apple, 300);
    var genres = [];
    (Array.isArray(raw.genres) ? raw.genres : []).forEach(function (item) {
      var text = clip(item, 40);
      if (text && genres.indexOf(text) === -1 && genres.length < 5) genres.push(text);
    });
    base.genres = genres;
    var imported = [];
    (Array.isArray(raw.imported_releases) ? raw.imported_releases : []).forEach(function (item) {
      if (!item || typeof item !== 'object' || imported.length >= 8) return;
      var title = clip(item.title, 120);
      if (!title) return;
      imported.push({
        title: title,
        url: httpsUrl(item.url, 300),
        cover: httpsUrl(item.cover || item.artwork_url, 300),
        source: clip(item.source, 300),
      });
    });
    base.imported_releases = imported;
    base.bios = {
      short: clip(bios.short || raw.bio_short, 280),
      medium: clip(bios.medium || raw.bio_medium, 600),
      long: clip(bios.long || raw.bio_long, 1200),
    };
    var sources = {};
    var sourceRaw = raw.sources && typeof raw.sources === 'object' ? raw.sources : {};
    Object.keys(sourceRaw).slice(0, 24).forEach(function (key) {
      var cleanKey = clip(key, 40);
      var cleanVal = clip(sourceRaw[key], 300);
      if (!cleanKey || !cleanVal || /password/i.test(cleanVal)) return;
      sources[cleanKey] = cleanVal;
    });
    base.sources = sources;
    base.slug = slugify(raw.slug || (opts && opts.name) || '');
    if (opts && opts.name) base.slug = slugify(opts.name);
    base.published = Boolean(opts && opts.keepPublished && raw.published === true);
    return hasPersonaContent(base) || base.published ? base : null;
  }

  function filledMap(persona) {
    var row = persona && Array.isArray(persona.vibe) && persona.look && persona.voice ? persona : emptyPersona();
    return {
      vibe: row.vibe.length > 0,
      story: Boolean(row.story),
      look: row.look.chips.length > 0 || Boolean(row.look.photo),
      voice: row.voice.chips.length > 0 || Boolean(row.voice.note),
      audience: Boolean(row.audience.ages || row.audience.city || row.audience.going_through),
      influences: row.influences.eras.length + row.influences.places.length + row.influences.feelings.length > 0,
      colors: row.colors.length >= 2,
      stats: Boolean(row.stats.monthly_listeners || row.stats.followers || row.stats.shows || row.stats.playlist_adds),
      press: row.press.length > 0,
      booking: Boolean(row.booking.email || row.booking.url || row.booking.name),
      socials: Boolean(row.socials.instagram || row.socials.tiktok || row.socials.youtube || row.socials.website || row.spotify_artist || row.apple_artist),
      photos: row.gallery.length > 0 || Boolean(row.look.photo),
    };
  }

  var ASK_COPY = {
    vibe: 'Pick up to three words for the vibe.',
    story: 'What is the moment this artist started?',
    look: 'How should this artist look? Pick a style, or add a photo link.',
    voice: 'How does the voice land? Raspy, smooth, powerful, airy, or a few words of your own.',
    audience: 'Who is this for? An age range, a city, or what they are going through.',
    influences: 'Which eras, places, or feelings shape the music? Skip other artist names.',
    colors: 'Pick two or three brand colors.',
    stats: 'Any public numbers for the press kit? Listeners, followers, shows, or playlist adds.',
    press: 'Any press quotes you want on the page?',
    booking: 'Who should bookers contact?',
    socials: 'Where else can people find this artist?',
    photos: 'Want another photo on the press kit?',
  };

  function asks(persona) {
    var have = filledMap(persona);
    return REQUIRED.filter(function (key) { return !have[key]; }).map(function (key) {
      return { field: key, ask: ASK_COPY[key] };
    });
  }

  function shouldRetryTrackWithoutArtist(result) {
    if (!result || result.ok) return false;
    if (result.status !== 400 && result.status !== 422) return false;
    var data = result.data && typeof result.data === 'object' ? result.data : {};
    var id = String(data.uuid || (data.track && data.track.uuid) || (data.data && data.data.uuid) || '').trim();
    if (/^[0-9a-f-]{36}$/i.test(id)) return false;
    var text = JSON.stringify(data).toLowerCase();
    if (text.indexOf('unknown') !== -1 && text.indexOf('primary_artist') === -1 && text.indexOf('artist_name') === -1) return false;
    return text.indexOf('primary_artist') !== -1 || text.indexOf('artist_name') !== -1;
  }

  function progress(persona) {
    var have = filledMap(persona);
    var filled = REQUIRED.filter(function (key) { return have[key]; }).length;
    return {
      filled: filled,
      total: REQUIRED.length,
      ready: filled === REQUIRED.length,
      label: filled + ' of ' + REQUIRED.length + '. Complete your persona to unlock your auto EPK.',
    };
  }

  function sampleBios(persona, name) {
    var who = clip(name, 80) || 'This artist';
    var vibe = (persona && persona.vibe || []).slice(0, 3).join(', ');
    var story = persona && persona.story ? persona.story : '';
    var city = persona && persona.audience && persona.audience.city ? persona.audience.city : '';
    var voice = persona && persona.voice && persona.voice.chips.length ? persona.voice.chips.join(', ') : '';
    var shortBits = [who];
    if (vibe) shortBits.push('a ' + vibe + ' sound');
    if (city) shortBits.push('from ' + city);
    var short = shortBits.join(', ') + '.';
    if (story) short = (who + '. ' + story).slice(0, 280);
    var medium = short;
    if (voice) medium += ' The voice sits ' + voice + '.';
    if (persona && persona.audience && persona.audience.going_through) {
      medium += ' For people going through ' + persona.audience.going_through + '.';
    }
    var long = medium;
    var influenceBits = [];
    if (persona && persona.influences) {
      influenceBits = influenceBits.concat(persona.influences.eras || [], persona.influences.places || [], persona.influences.feelings || []);
    }
    if (influenceBits.length) long += ' Shaped by ' + influenceBits.slice(0, 4).join(', ') + '.';
    long += ' ' + CREDIT;
    function plain(text) {
      return clip(String(text || '').replace(/[\u2014\u2013]/g, ', '), text.length > 600 ? 1200 : 600);
    }
    return {
      short: plain(short).slice(0, 280),
      medium: plain(medium).slice(0, 600),
      long: plain(long).slice(0, 1200),
    };
  }

  function publicRelease(row) {
    if (!row) return null;
    var title = clip(row.title, 160);
    if (!title) return null;
    var links = [];
    (Array.isArray(row.links) ? row.links : []).forEach(function (item) {
      if (!item) return;
      var url = httpsUrl(item.url || item, 300);
      if (!url) return;
      links.push({ label: clip(item.label, 40) || 'Listen', url: url });
    });
    return {
      title: title,
      artwork_url: httpsUrl(row.artwork_url || row.cover, 300),
      upc: clip(row.upc, 20),
      release_date: clip(row.release_date, 20),
      links: links,
    };
  }

  function releasesForArtist(profile, artist) {
    var list = profile && Array.isArray(profile.releases) ? profile.releases : [];
    var id = artist && (artist.id || artist.artist_id);
    return list.filter(function (row) {
      if (!row) return false;
      if (id && row.plaiground_artist_id && String(row.plaiground_artist_id) !== String(id)) return false;
      if (id && row.plaiground_artist_id) return true;
      var artists = profile && Array.isArray(profile.artists) ? profile.artists : [];
      return artists.length === 1;
    }).map(publicRelease).filter(Boolean);
  }

  function epkView(artist, profile, opts) {
    var persona = artist && artist.persona;
    if (!persona) return null;
    var preview = Boolean(opts && opts.preview);
    if (!persona.published && !preview) return null;
    var bios = persona.bios || {};
    var imported = (persona.imported_releases || []).map(function (row) {
      return publicRelease({
        title: row.title,
        artwork_url: row.cover,
        links: row.url ? [{ label: 'Listen', url: row.url }] : [],
      });
    }).filter(Boolean);
    return {
      slug: persona.slug || slugify(artist.name),
      name: clip(artist.name, 80),
      preview: preview && !persona.published,
      published: persona.published === true,
      photo: persona.look.photo || httpsUrl(artist.photo, 300),
      gallery: persona.gallery.slice(),
      vibe: persona.vibe.slice(),
      story: persona.story,
      look: persona.look.chips.slice(),
      voice: persona.voice.chips.slice(),
      audience: {
        ages: persona.audience.ages,
        city: persona.audience.city,
        going_through: persona.audience.going_through,
      },
      influences: {
        eras: persona.influences.eras.slice(),
        places: persona.influences.places.slice(),
        feelings: persona.influences.feelings.slice(),
      },
      colors: persona.colors.slice(),
      stats: Object.assign({}, persona.stats),
      press: persona.press.map(function (item) {
        return { quote: item.quote, source: item.source, url: item.url };
      }),
      booking: {
        name: persona.booking.name,
        email: persona.booking.email,
        url: persona.booking.url,
      },
      socials: Object.assign({}, persona.socials),
      spotify_artist: persona.spotify_artist,
      apple_artist: persona.apple_artist,
      genres: (artist.genres && artist.genres.length ? artist.genres : persona.genres).slice(0, 5),
      bios: {
        short: bios.short || '',
        medium: bios.medium || '',
        long: bios.long || '',
      },
      releases: releasesForArtist(profile, artist).concat(imported),
      credit: CREDIT,
      progress: progress(persona),
    };
  }

  function linkReleases(profile, accountTonegridId) {
    var next = profile && typeof profile === 'object' ? JSON.parse(JSON.stringify(profile)) : {};
    var artists = Array.isArray(next.artists) ? next.artists : [];
    var releases = Array.isArray(next.releases) ? next.releases : [];
    var changed = false;
    var accountId = String(accountTonegridId || '').trim().toLowerCase();

    function byStoreId(id) {
      var want = String(id || '').trim().toLowerCase();
      if (!want) return null;
      var hits = artists.filter(function (artist) {
        return String(artist && artist.tonegrid_artist_id || '').trim().toLowerCase() === want;
      });
      return hits.length === 1 ? hits[0] : null;
    }

    releases.forEach(function (row) {
      if (!row || typeof row !== 'object') return;
      var storeId = String(row.tonegrid_artist_id || '').trim();
      var artist = byStoreId(storeId);
      if (!artist && !storeId && accountId && artists.length === 1) {
        var only = artists[0];
        var onlyStore = String(only && only.tonegrid_artist_id || '').trim().toLowerCase();
        if (!onlyStore || onlyStore === accountId) artist = only;
      }
      if (!artist && !row.plaiground_artist_id) {
        var wantName = String(row.artist || '').trim().toLowerCase();
        if (wantName) {
          var named = artists.filter(function (item) {
            return String(item && item.name || '').trim().toLowerCase() === wantName;
          });
          if (named.length === 1) artist = named[0];
        }
      }
      if (!artist) return;
      if (!row.plaiground_artist_id && artist.id) {
        row.plaiground_artist_id = artist.id;
        changed = true;
      }
      if (!row.tonegrid_artist_id && artist.tonegrid_artist_id) {
        row.tonegrid_artist_id = artist.tonegrid_artist_id;
        changed = true;
      }
      if (!row.artist && artist.name) {
        row.artist = artist.name;
        changed = true;
      }
    });
    next.releases = releases;
    return { profile: next, changed: changed };
  }

  function trackArtistFields(name) {
    var clean = clip(name, 120);
    if (!clean || /password/i.test(clean)) return {};
    return { primary_artist: clean, artist_name: clean };
  }

  function findBySlug(users, slug, ownerId) {
    var want = slugify(slug);
    var found = null;
    (Array.isArray(users) ? users : []).forEach(function (user) {
      if (!user || found) return;
      var profile = user.profile && typeof user.profile === 'object' ? user.profile : {};
      var artists = Array.isArray(profile.artists) ? profile.artists : [];
      artists.forEach(function (artist) {
        if (found || !artist || !artist.persona) return;
        var artistSlug = artist.persona.slug || slugify(artist.name);
        if (artistSlug !== want) return;
        var owned = ownerId && String(user.id) === String(ownerId);
        if (!artist.persona.published && !owned) return;
        found = { user: user, artist: artist, profile: profile, owned: Boolean(owned) };
      });
    });
    return found;
  }

  return {
    AGES: AGES,
    ASK_COPY: ASK_COPY,
    COLORS: COLORS,
    CREDIT: CREDIT,
    ERAS: ERAS,
    FEELINGS: FEELINGS,
    LOOK: LOOK,
    PLACES: PLACES,
    REQUIRED: REQUIRED,
    VIBE: VIBE,
    VOICE: VOICE,
    asks: asks,
    emptyPersona: emptyPersona,
    epkView: epkView,
    findBySlug: findBySlug,
    httpsUrl: httpsUrl,
    privateHost: privateHost,
    influenceList: influenceList,
    linkReleases: linkReleases,
    looksLikeNamedArtist: looksLikeNamedArtist,
    normalize: normalize,
    progress: progress,
    releasesForArtist: releasesForArtist,
    sampleBios: sampleBios,
    shouldRetryTrackWithoutArtist: shouldRetryTrackWithoutArtist,
    slugify: slugify,
    trackArtistFields: trackArtistFields,
  };
});
