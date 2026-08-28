'use strict';

/**
 * Artist Profiles platform rows.
 * Dropdown comes from the live store catalog (or the same fallback
 * upload already uses). Does not invent stores.
 */

function storePick() {
  try {
    if (typeof require === 'function') return require('./store-pick');
  } catch (err) {}
  if (typeof globalThis !== 'undefined') return globalThis.PlaigroundStorePick || null;
  return null;
}

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function stripWww(host) {
  return String(host || '').replace(/^www\./i, '').toLowerCase();
}

function suffixHost(host, domain) {
  var h = stripWww(host);
  var d = String(domain || '').toLowerCase();
  return h === d || h.slice(-(d.length + 1)) === '.' + d;
}

function containsHost(host, needle) {
  return stripWww(host).indexOf(String(needle || '').toLowerCase()) !== -1;
}

var HOST_SPECS = [
  {
    slug: 'spotify',
    aliases: [],
    legacy: 'spotify',
    idRe: /^[a-zA-Z0-9]{16,34}$/,
    uriRe: /^spotify:artist:([a-zA-Z0-9]{16,34})$/i,
    pathRe: /\/artist\/([a-zA-Z0-9]+)/i,
    urlFromId: function (id) { return 'https://open.spotify.com/artist/' + id; },
    placeholder: 'https://open.spotify.com/artist/…',
    hint: 'Use the open.spotify.com/artist/… page, or a spotify:artist: URI.',
    hostOk: function (host) { return suffixHost(host, 'spotify.com'); },
  },
  {
    slug: 'apple-music',
    aliases: ['apple', 'apple_music', 'applemusic'],
    legacy: 'apple',
    idRe: /^\d{4,}$/,
    pathRe: /\/artist\/(?:[^/]+\/)?(\d+)/i,
    urlFromId: function (id) { return 'https://music.apple.com/artist/' + id; },
    placeholder: 'https://music.apple.com/…/artist/…',
    hint: 'Use the music.apple.com artist page.',
    hostOk: function (host) {
      var h = stripWww(host);
      return h === 'music.apple.com' || h === 'itunes.apple.com' || suffixHost(h, 'music.apple.com');
    },
  },
  {
    slug: 'youtube-music',
    aliases: ['youtubemusic', 'youtube_music'],
    placeholder: 'https://music.youtube.com/channel/…',
    hint: 'Use the music.youtube.com artist or channel page.',
    hostOk: function (host) { return stripWww(host) === 'music.youtube.com'; },
  },
  {
    slug: 'amazon-music',
    aliases: ['amazon', 'amazon_music', 'amazonmusic'],
    pathRe: /\/artists?\//i,
    placeholder: 'https://music.amazon.com/artists/…',
    hint: 'Use the Amazon Music artist page.',
    hostOk: function (host) { return containsHost(host, 'amazon.'); },
  },
  {
    slug: 'deezer',
    pathRe: /\/artist\/(\d+)/i,
    placeholder: 'https://www.deezer.com/artist/…',
    hint: 'Use the deezer.com/artist/… page.',
    hostOk: function (host) { return suffixHost(host, 'deezer.com'); },
  },
  {
    slug: 'tidal',
    pathRe: /\/(?:browse\/)?artist\//i,
    placeholder: 'https://tidal.com/artist/…',
    hint: 'Use the tidal.com/artist/… page.',
    hostOk: function (host) {
      var h = stripWww(host);
      return h === 'tidal.com' || h === 'listen.tidal.com' || suffixHost(h, 'tidal.com');
    },
  },
  {
    slug: 'soundcloud',
    placeholder: 'https://soundcloud.com/…',
    hint: 'Use the soundcloud.com artist page.',
    hostOk: function (host) { return suffixHost(host, 'soundcloud.com'); },
  },
  {
    slug: 'boomplay',
    placeholder: 'https://www.boomplay.com/artists/…',
    hint: 'Use the boomplay.com artist page.',
    hostOk: function (host) { return suffixHost(host, 'boomplay.com'); },
  },
  {
    slug: 'audiomack',
    placeholder: 'https://audiomack.com/…',
    hint: 'Use the audiomack.com artist page.',
    hostOk: function (host) { return suffixHost(host, 'audiomack.com'); },
  },
  {
    slug: 'pandora',
    placeholder: 'https://www.pandora.com/artist/…',
    hint: 'Use the pandora.com artist page.',
    hostOk: function (host) { return suffixHost(host, 'pandora.com'); },
  },
  {
    slug: 'napster',
    placeholder: 'https://web.napster.com/artist/…',
    hint: 'Use the napster.com artist page.',
    hostOk: function (host) { return suffixHost(host, 'napster.com'); },
  },
  {
    slug: 'anghami',
    placeholder: 'https://play.anghami.com/artist/…',
    hint: 'Use the anghami.com artist page.',
    hostOk: function (host) { return suffixHost(host, 'anghami.com'); },
  },
  {
    slug: 'tiktok',
    placeholder: 'https://www.tiktok.com/@…',
    hint: 'Use the public TikTok profile page.',
    hostOk: function (host) {
      var h = stripWww(host);
      return (h === 'tiktok.com' || suffixHost(h, 'tiktok.com')) && h !== 'music.tiktok.com';
    },
  },
  {
    slug: 'tiktok-music',
    aliases: ['tiktokmusic', 'tiktok_music'],
    placeholder: 'https://music.tiktok.com/…',
    hint: 'Use the music.tiktok.com artist page.',
    hostOk: function (host) { return stripWww(host) === 'music.tiktok.com'; },
  },
  {
    slug: 'iheartradio',
    aliases: ['iheart', 'iheart-radio'],
    placeholder: 'https://www.iheart.com/artist/…',
    hint: 'Use the iheart.com artist page.',
    hostOk: function (host) {
      var h = stripWww(host);
      return suffixHost(h, 'iheart.com') || suffixHost(h, 'iheartradio.com');
    },
  },
  {
    slug: 'kkbox',
    placeholder: 'https://www.kkbox.com/…/artist/…',
    hint: 'Use the kkbox.com artist page.',
    hostOk: function (host) { return suffixHost(host, 'kkbox.com'); },
  },
  {
    slug: 'jiosaavn',
    aliases: ['saavn'],
    placeholder: 'https://www.jiosaavn.com/artist/…',
    hint: 'Use the jiosaavn.com artist page.',
    hostOk: function (host) { return suffixHost(host, 'jiosaavn.com') || suffixHost(host, 'saavn.com'); },
  },
  {
    slug: 'youtube',
    placeholder: 'https://www.youtube.com/@…',
    hint: 'Use the public YouTube channel page.',
    hostOk: function (host) {
      var h = stripWww(host);
      if (h === 'music.youtube.com') return false;
      return h === 'youtu.be' || suffixHost(h, 'youtube.com');
    },
  },
];

var SPEC_INDEX = {};
HOST_SPECS.forEach(function (row) {
  SPEC_INDEX[row.slug] = row;
  (row.aliases || []).forEach(function (alias) {
    SPEC_INDEX[String(alias).toLowerCase()] = row;
  });
});

var liveCatalog = null;

function fallbackCatalog() {
  var pick = storePick();
  if (pick && pick.normalizeStores) return pick.normalizeStores(pick.DEFAULT_STORES || []);
  return [];
}

function setCatalog(list) {
  var pick = storePick();
  if (list && list.length && pick && pick.normalizeStores) {
    liveCatalog = pick.normalizeStores(list);
    return liveCatalog.slice();
  }
  liveCatalog = null;
  return platformList();
}

function platformList() {
  var rows = liveCatalog && liveCatalog.length ? liveCatalog : fallbackCatalog();
  return rows.map(function (row) {
    return { slug: row.slug, name: row.name };
  });
}

function catalogHas(slug) {
  var want = trim(slug).toLowerCase();
  return platformList().some(function (row) { return row.slug === want; });
}

function findPlatform(slug) {
  var key = trim(slug).toLowerCase();
  if (!key) return null;
  var spec = SPEC_INDEX[key];
  var listed = platformList().filter(function (row) { return row.slug === key || (spec && row.slug === spec.slug); })[0];
  if (listed) {
    return {
      slug: listed.slug,
      name: listed.name,
      spec: spec || null,
    };
  }
  if (spec && !liveCatalog) {
    return { slug: spec.slug, name: spec.slug, spec: spec };
  }
  return null;
}

function parseHref(value) {
  var raw = trim(value);
  if (!raw) return null;
  var href = raw;
  if (!/^https?:\/\//i.test(href) && href.indexOf('.') !== -1) href = 'https://' + href;
  try {
    return new URL(href);
  } catch (err) {
    return null;
  }
}

function mismatchError(name) {
  return 'That URL does not match ' + name + '.';
}

function matchPlatformValue(platform, value) {
  var found = findPlatform(platform);
  if (!found) return { ok: false, error: 'Pick a platform.' };
  var spec = found.spec;
  var raw = trim(value);
  if (!raw) return { ok: false, error: 'Paste the artist URL.' };

  if (spec && spec.uriRe) {
    var uri = raw.match(spec.uriRe);
    if (uri) {
      return {
        ok: true,
        platform: found.slug,
        id: uri[1],
        url: spec.urlFromId ? spec.urlFromId(uri[1]) : '',
        value: raw,
      };
    }
  }

  if (spec && spec.idRe && spec.idRe.test(raw) && raw.indexOf('/') === -1 && raw.indexOf('.') === -1) {
    return {
      ok: true,
      platform: found.slug,
      id: raw,
      url: spec.urlFromId ? spec.urlFromId(raw) : '',
      value: raw,
    };
  }

  var parsed = parseHref(raw);
  if (!parsed) return { ok: false, error: 'Paste a valid artist URL.' };
  if (spec && typeof spec.hostOk === 'function' && !spec.hostOk(parsed.hostname)) {
    return { ok: false, error: mismatchError(found.name) };
  }
  var path = String(parsed.pathname || '');
  if (spec && spec.pathRe && !spec.pathRe.test(path)) {
    return { ok: false, error: mismatchError(found.name) };
  }
  var id = '';
  if (spec && spec.pathRe) {
    var hit = path.match(spec.pathRe);
    if (hit && hit[1]) id = hit[1];
  }
  return {
    ok: true,
    platform: found.slug,
    id: id,
    url: parsed.toString(),
    value: raw,
  };
}

function guessPlatformFromUrl(value) {
  var parsed = parseHref(value);
  if (!parsed) return null;
  var i;
  for (i = 0; i < HOST_SPECS.length; i += 1) {
    if (HOST_SPECS[i].hostOk && HOST_SPECS[i].hostOk(parsed.hostname)) {
      return findPlatform(HOST_SPECS[i].slug) || { slug: HOST_SPECS[i].slug, name: HOST_SPECS[i].slug, spec: HOST_SPECS[i] };
    }
  }
  return null;
}

function normalizeOneLink(raw) {
  if (!raw || typeof raw !== 'object') return null;
  var found = findPlatform(raw.platform || raw.slug || raw.store);
  if (!found && !raw.platform) return null;
  var url = trim(raw.url || raw.link || raw.store_url || raw.href);
  var id = trim(raw.id || raw.store_id);
  var value = trim(raw.value);
  if (!url && !id && !value) return null;
  if (found) {
    var matched = matchPlatformValue(found.slug, url || value || id);
    if (matched.ok) {
      return {
        platform: found.slug,
        id: matched.id || id,
        url: matched.url || url,
        value: value || url || id,
      };
    }
  }
  if (url || id) {
    return {
      platform: found ? found.slug : trim(raw.platform),
      id: id,
      url: url,
      value: value || url || id,
    };
  }
  return null;
}

function deriveFromLegacy(raw) {
  var links = [];
  var seen = {};
  function push(link) {
    if (!link || seen[link.platform]) return;
    seen[link.platform] = true;
    links.push(link);
  }
  var spotify = trim(raw && raw.spotify_id);
  if (spotify) {
    var spotifyMatch = matchPlatformValue('spotify', spotify);
    push({
      platform: 'spotify',
      id: spotifyMatch.ok ? spotifyMatch.id : spotify,
      url: spotifyMatch.ok ? spotifyMatch.url : '',
      value: spotify,
    });
  }
  var apple = trim(raw && raw.apple_id);
  if (apple) {
    var appleMatch = matchPlatformValue('apple-music', apple);
    if (!appleMatch.ok) appleMatch = matchPlatformValue('apple', apple);
    push({
      platform: appleMatch.ok ? appleMatch.platform : 'apple-music',
      id: appleMatch.ok ? appleMatch.id : apple,
      url: appleMatch.ok ? appleMatch.url : '',
      value: apple,
    });
  }
  var store = trim(raw && (raw.store_url || raw.link || raw.url));
  if (store) {
    var guessed = guessPlatformFromUrl(store);
    var storeMatch = guessed ? matchPlatformValue(guessed.slug, store) : { ok: false };
    if (storeMatch.ok) {
      push({
        platform: storeMatch.platform,
        id: storeMatch.id,
        url: storeMatch.url,
        value: store,
      });
    }
  }
  return links;
}

function syncLegacy(links) {
  var spotify = '';
  var apple = '';
  var store = '';
  (links || []).forEach(function (row) {
    if (!store && row && (row.url || row.value)) store = row.url || row.value;
    if (row && row.platform === 'spotify') spotify = row.id || row.value || '';
    if (row && (row.platform === 'apple' || row.platform === 'apple-music')) apple = row.id || row.value || '';
  });
  return {
    spotify_id: spotify,
    apple_id: apple,
    store_url: store,
  };
}

function normalizeFromArtist(raw) {
  var src = raw && typeof raw === 'object' ? raw : {};
  var hasLinks = Object.prototype.hasOwnProperty.call(src, 'platform_links') && Array.isArray(src.platform_links);
  var links = hasLinks
    ? src.platform_links.map(normalizeOneLink).filter(Boolean)
    : deriveFromLegacy(src);
  var unique = [];
  var seen = {};
  links.forEach(function (row) {
    if (!row || seen[row.platform]) return;
    seen[row.platform] = true;
    unique.push({
      platform: row.platform,
      id: trim(row.id),
      url: trim(row.url),
      value: trim(row.value) || trim(row.url) || trim(row.id),
    });
  });
  return Object.assign({ platform_links: unique }, syncLegacy(unique));
}

function validateList(raw) {
  var list = Array.isArray(raw) ? raw : [];
  var out = [];
  var seen = {};
  var i;
  for (i = 0; i < list.length; i += 1) {
    var row = list[i] || {};
    var platform = trim(row.platform || row.slug);
    var value = trim(row.url || row.value || row.id || row.link);
    if (!platform && !value) continue;
    if (!platform) return { error: 'Pick a platform.' };
    if (!value) return { error: 'Paste the artist URL.' };
    var found = findPlatform(platform);
    if (!found) return { error: 'Pick a platform.' };
    if (seen[found.slug]) return { error: 'That platform is already on the list.' };
    var matched = matchPlatformValue(found.slug, value);
    if (!matched.ok) return { error: matched.error };
    seen[found.slug] = true;
    out.push({
      platform: found.slug,
      id: matched.id || '',
      url: matched.url || '',
      value: value,
    });
  }
  return { ok: true, links: out };
}

function availablePlatforms(used, keep) {
  var taken = {};
  (used || []).forEach(function (slug) {
    var found = findPlatform(slug);
    if (found) taken[found.slug] = true;
  });
  var keepFound = findPlatform(keep);
  return platformList().filter(function (row) {
    if (keepFound && row.slug === keepFound.slug) return true;
    return !taken[row.slug];
  });
}

function displayValue(link) {
  if (!link) return '';
  return trim(link.value) || trim(link.url) || trim(link.id);
}

function platformName(slug) {
  var found = findPlatform(slug);
  if (found && found.name) return found.name;
  var listed = platformList().filter(function (row) { return row.slug === trim(slug).toLowerCase(); })[0];
  return listed ? listed.name : trim(slug);
}

function urlPlaceholder(slug) {
  var found = findPlatform(slug);
  if (found && found.spec && found.spec.placeholder) return found.spec.placeholder;
  var name = platformName(slug);
  return name ? ('Public ' + name + ' artist URL') : 'Artist URL';
}

function urlHint(slug) {
  var found = findPlatform(slug);
  if (!trim(slug)) return 'Pick a platform to see that artist URL hint.';
  if (found && found.spec && found.spec.hint) return found.spec.hint;
  var name = platformName(slug);
  return name
    ? ('Paste the public ' + name + ' artist page.')
    : 'Paste that store’s public artist page.';
}

var api = {
  availablePlatforms: availablePlatforms,
  catalogHas: catalogHas,
  deriveFromLegacy: deriveFromLegacy,
  displayValue: displayValue,
  findPlatform: findPlatform,
  guessPlatformFromUrl: guessPlatformFromUrl,
  matchPlatformValue: matchPlatformValue,
  normalizeFromArtist: normalizeFromArtist,
  platformList: platformList,
  platformName: platformName,
  setCatalog: setCatalog,
  urlHint: urlHint,
  urlPlaceholder: urlPlaceholder,
  validateList: validateList,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundPlatformLinks = api;
}
