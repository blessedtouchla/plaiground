'use strict';

/**
 * Artist Profiles platform picker.
 * Empty start, add-one-row-at-a-time. Not the upload store checkbox grid.
 */

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

var PLATFORMS = [
  {
    slug: 'spotify',
    name: 'Spotify',
    idRe: /^[a-zA-Z0-9]{16,34}$/,
    uriRe: /^spotify:artist:([a-zA-Z0-9]{16,34})$/i,
    pathRe: /\/artist\/([a-zA-Z0-9]+)/i,
    urlFromId: function (id) { return 'https://open.spotify.com/artist/' + id; },
    hostOk: function (host) { return suffixHost(host, 'spotify.com'); },
  },
  {
    slug: 'apple',
    name: 'Apple Music',
    aliases: ['apple-music', 'apple_music', 'applemusic'],
    idRe: /^\d{4,}$/,
    pathRe: /\/artist\/(?:[^/]+\/)?(\d+)/i,
    urlFromId: function (id) { return 'https://music.apple.com/artist/' + id; },
    hostOk: function (host) {
      var h = stripWww(host);
      return h === 'music.apple.com' || h === 'itunes.apple.com' || suffixHost(h, 'music.apple.com');
    },
  },
  {
    slug: 'youtube-music',
    name: 'YouTube Music',
    aliases: ['youtubemusic', 'youtube_music'],
    hostOk: function (host) { return stripWww(host) === 'music.youtube.com'; },
  },
  {
    slug: 'amazon',
    name: 'Amazon Music',
    aliases: ['amazon-music', 'amazon_music', 'amazonmusic'],
    pathRe: /\/artists?\//i,
    hostOk: function (host) { return containsHost(host, 'amazon.'); },
  },
  {
    slug: 'deezer',
    name: 'Deezer',
    pathRe: /\/artist\/(\d+)/i,
    hostOk: function (host) { return suffixHost(host, 'deezer.com'); },
  },
  {
    slug: 'tidal',
    name: 'Tidal',
    pathRe: /\/(?:browse\/)?artist\//i,
    hostOk: function (host) {
      var h = stripWww(host);
      return h === 'tidal.com' || h === 'listen.tidal.com' || suffixHost(h, 'tidal.com');
    },
  },
  {
    slug: 'soundcloud',
    name: 'SoundCloud',
    hostOk: function (host) { return suffixHost(host, 'soundcloud.com'); },
  },
  {
    slug: 'boomplay',
    name: 'Boomplay',
    hostOk: function (host) { return suffixHost(host, 'boomplay.com'); },
  },
  {
    slug: 'audiomack',
    name: 'Audiomack',
    hostOk: function (host) { return suffixHost(host, 'audiomack.com'); },
  },
  {
    slug: 'pandora',
    name: 'Pandora',
    hostOk: function (host) { return suffixHost(host, 'pandora.com'); },
  },
  {
    slug: 'napster',
    name: 'Napster',
    hostOk: function (host) { return suffixHost(host, 'napster.com'); },
  },
  {
    slug: 'anghami',
    name: 'Anghami',
    hostOk: function (host) { return suffixHost(host, 'anghami.com'); },
  },
  {
    slug: 'tiktok',
    name: 'TikTok',
    hostOk: function (host) {
      var h = stripWww(host);
      return (h === 'tiktok.com' || suffixHost(h, 'tiktok.com')) && h !== 'music.tiktok.com';
    },
  },
  {
    slug: 'tiktok-music',
    name: 'TikTok Music',
    aliases: ['tiktokmusic', 'tiktok_music'],
    hostOk: function (host) { return stripWww(host) === 'music.tiktok.com'; },
  },
  {
    slug: 'iheartradio',
    name: 'iHeartRadio',
    aliases: ['iheart', 'iheart-radio'],
    hostOk: function (host) {
      var h = stripWww(host);
      return suffixHost(h, 'iheart.com') || suffixHost(h, 'iheartradio.com');
    },
  },
  {
    slug: 'kkbox',
    name: 'KKBOX',
    hostOk: function (host) { return suffixHost(host, 'kkbox.com'); },
  },
  {
    slug: 'jiosaavn',
    name: 'JioSaavn',
    aliases: ['saavn'],
    hostOk: function (host) { return suffixHost(host, 'jiosaavn.com') || suffixHost(host, 'saavn.com'); },
  },
  {
    slug: 'youtube',
    name: 'YouTube',
    hostOk: function (host) {
      var h = stripWww(host);
      if (h === 'music.youtube.com') return false;
      return h === 'youtu.be' || suffixHost(h, 'youtube.com');
    },
  },
];

var SLUG_INDEX = {};
PLATFORMS.forEach(function (row) {
  SLUG_INDEX[row.slug] = row;
  (row.aliases || []).forEach(function (alias) {
    SLUG_INDEX[String(alias).toLowerCase()] = row;
  });
});

function platformList() {
  return PLATFORMS.map(function (row) {
    return { slug: row.slug, name: row.name };
  });
}

function findPlatform(slug) {
  return SLUG_INDEX[trim(slug).toLowerCase()] || null;
}

function samePlatform(a, b) {
  var left = findPlatform(a);
  var right = findPlatform(b);
  return Boolean(left && right && left.slug === right.slug);
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

function mismatchError(spec) {
  return 'That URL does not match ' + spec.name + '.';
}

function matchPlatformValue(platform, value) {
  var spec = findPlatform(platform);
  if (!spec) return { ok: false, error: 'Pick a platform.' };
  var raw = trim(value);
  if (!raw) return { ok: false, error: 'Paste the artist URL or ID.' };

  if (spec.uriRe) {
    var uri = raw.match(spec.uriRe);
    if (uri) {
      return {
        ok: true,
        platform: spec.slug,
        id: uri[1],
        url: spec.urlFromId ? spec.urlFromId(uri[1]) : '',
        value: raw,
      };
    }
  }

  if (spec.idRe && spec.idRe.test(raw) && raw.indexOf('/') === -1 && raw.indexOf('.') === -1) {
    return {
      ok: true,
      platform: spec.slug,
      id: raw,
      url: spec.urlFromId ? spec.urlFromId(raw) : '',
      value: raw,
    };
  }

  var parsed = parseHref(raw);
  if (!parsed) return { ok: false, error: 'Paste a valid ' + spec.name + ' artist URL.' };
  if (typeof spec.hostOk === 'function' && !spec.hostOk(parsed.hostname)) {
    return { ok: false, error: mismatchError(spec) };
  }
  var path = String(parsed.pathname || '');
  if (spec.pathRe && !spec.pathRe.test(path)) {
    return { ok: false, error: mismatchError(spec) };
  }
  var id = '';
  if (spec.pathRe) {
    var hit = path.match(spec.pathRe);
    if (hit && hit[1]) id = hit[1];
  }
  return {
    ok: true,
    platform: spec.slug,
    id: id,
    url: parsed.toString(),
    value: raw,
  };
}

function guessPlatformFromUrl(value) {
  var parsed = parseHref(value);
  if (!parsed) return null;
  var i;
  for (i = 0; i < PLATFORMS.length; i += 1) {
    if (PLATFORMS[i].hostOk && PLATFORMS[i].hostOk(parsed.hostname)) return PLATFORMS[i];
  }
  return null;
}

function normalizeOneLink(raw) {
  if (!raw || typeof raw !== 'object') return null;
  var spec = findPlatform(raw.platform || raw.slug || raw.store);
  if (!spec) return null;
  var url = trim(raw.url || raw.link || raw.store_url || raw.href);
  var id = trim(raw.id || raw.store_id);
  var value = trim(raw.value);
  if (!url && !id && !value) return null;
  var matched = matchPlatformValue(spec.slug, url || value || id);
  if (matched.ok) {
    return {
      platform: spec.slug,
      id: matched.id || id,
      url: matched.url || url,
      value: value || url || id,
    };
  }
  if (url || id) {
    return {
      platform: spec.slug,
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
    var appleMatch = matchPlatformValue('apple', apple);
    push({
      platform: 'apple',
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
    if (row && row.platform === 'apple') apple = row.id || row.value || '';
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
    if (!value) return { error: 'Paste the artist URL or ID.' };
    var spec = findPlatform(platform);
    if (!spec) return { error: 'Pick a platform.' };
    if (seen[spec.slug]) return { error: 'That platform is already on the list.' };
    var matched = matchPlatformValue(spec.slug, value);
    if (!matched.ok) return { error: matched.error };
    seen[spec.slug] = true;
    out.push({
      platform: spec.slug,
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
    var spec = findPlatform(slug);
    if (spec) taken[spec.slug] = true;
  });
  var keepSlug = findPlatform(keep);
  return platformList().filter(function (row) {
    if (keepSlug && row.slug === keepSlug.slug) return true;
    return !taken[row.slug];
  });
}

function displayValue(link) {
  if (!link) return '';
  return trim(link.value) || trim(link.url) || trim(link.id);
}

var api = {
  PLATFORMS: PLATFORMS,
  availablePlatforms: availablePlatforms,
  deriveFromLegacy: deriveFromLegacy,
  displayValue: displayValue,
  findPlatform: findPlatform,
  matchPlatformValue: matchPlatformValue,
  normalizeFromArtist: normalizeFromArtist,
  platformList: platformList,
  samePlatform: samePlatform,
  validateList: validateList,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundPlatformLinks = api;
}
