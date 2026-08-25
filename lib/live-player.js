'use strict';

/**
 * Owner playback after ToneGrid says live/delivered.
 * Streams from official DSP pages (Spotify / Apple / YouTube Music)
 * using delivery dsp_release_id. Never hosts or copies audio.
 */

var WAIT_COPY = 'Available when live.';
var LIVE_WAIT_COPY = 'Live on stores. Stream links appear when Spotify, Apple Music, or YouTube Music send a release ID.';

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function slugOf(value) {
  return trim(value).toLowerCase().replace(/_/g, '-');
}

function isLiveStatus(status) {
  var s = slugOf(status).replace(/-/g, '_');
  return s === 'live' || s === 'delivered';
}

function httpUrl(value) {
  var raw = trim(value);
  if (/^https?:\/\/[^\s]+$/i.test(raw)) return raw;
  return '';
}

function spotifyLink(kind, id) {
  if (!id) return null;
  var type = kind === 'track' ? 'track' : 'album';
  return {
    dsp: 'spotify',
    name: 'Spotify',
    id: id,
    kind: type,
    uri: 'spotify:' + type + ':' + id,
    open: 'https://open.spotify.com/' + type + '/' + id,
    embed: 'https://open.spotify.com/embed/' + type + '/' + id,
  };
}

function appleLink(id) {
  if (!id) return null;
  return {
    dsp: 'apple-music',
    name: 'Apple Music',
    id: id,
    kind: 'album',
    uri: 'apple:album:' + id,
    open: 'https://music.apple.com/album/' + id,
    embed: 'https://embed.music.apple.com/us/album/' + id,
  };
}

function youtubeLink(id, kind) {
  if (!id) return null;
  var list = kind === 'playlist' || /^OLAK5uy/i.test(id) || /^PL/i.test(id);
  if (list) {
    return {
      dsp: 'youtube-music',
      name: 'YouTube Music',
      id: id,
      kind: 'playlist',
      uri: id,
      open: 'https://music.youtube.com/playlist?list=' + encodeURIComponent(id),
      embed: 'https://www.youtube.com/embed?listType=playlist&list=' + encodeURIComponent(id),
    };
  }
  return {
    dsp: 'youtube-music',
    name: 'YouTube Music',
    id: id,
    kind: 'video',
    uri: id,
    open: 'https://music.youtube.com/watch?v=' + encodeURIComponent(id),
    embed: 'https://www.youtube.com/embed/' + encodeURIComponent(id),
  };
}

function prettyStoreName(value, fallback) {
  var slug = slugOf(value);
  if (slug === 'apple-music' || slug === 'apple_music') return 'Apple Music';
  if (slug === 'youtube-music' || slug === 'youtube_music') return 'YouTube Music';
  if (slug === 'spotify') return 'Spotify';
  if (slug && slug !== 'store') {
    return slug.replace(/[-_]+/g, ' ').replace(/\b[a-z]/g, function (ch) {
      return ch.toUpperCase();
    });
  }
  return fallback || 'Store';
}

function fromUrl(url, dspHint) {
  var href = httpUrl(url);
  if (!href) return null;
  var spotify = href.match(/open\.spotify\.com\/(album|track|playlist)\/([A-Za-z0-9]+)/i);
  if (spotify) return spotifyLink(spotify[1].toLowerCase(), spotify[2]);
  var apple = href.match(/music\.apple\.com\/[^/]+\/album\/[^/]*\/?(\d+)/i) || href.match(/[?&]i=(\d+)/);
  if (apple) return appleLink(apple[1]);
  var ytList = href.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (ytList && /youtube/i.test(href)) return youtubeLink(ytList[1], 'playlist');
  var ytVid = href.match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]{11})/);
  if (ytVid) return youtubeLink(ytVid[1], 'video');
  var slug = slugOf(dspHint);
  return {
    dsp: slug || 'store',
    name: prettyStoreName(slug, 'Store'),
    id: '',
    kind: 'link',
    uri: href,
    open: href,
    embed: '',
  };
}

function parseDelivery(row) {
  if (!row || typeof row !== 'object') return null;
  var dsp = slugOf(row.dsp || row.dsp_slug || row.dsp_name || row.name);
  var raw = trim(row.dsp_release_id || row.release_uri || row.store_id || row.uri || '');
  var storeUrl = httpUrl(row.store_url || row.listen_url || row.url || '');
  var fromHref = storeUrl ? fromUrl(storeUrl, dsp) : null;
  if (fromHref && fromHref.embed) return fromHref;

  var spotify = raw.match(/spotify:(album|track|playlist):([A-Za-z0-9]+)/i);
  if (spotify) return spotifyLink(spotify[1].toLowerCase(), spotify[2]);
  if ((dsp === 'spotify' || !dsp) && /^[A-Za-z0-9]{22}$/.test(raw)) return spotifyLink('album', raw);

  var appleId = (raw.match(/id(\d+)/i) || raw.match(/(?:album|song):(\d+)/i) || raw.match(/^(\d{8,})$/));
  if (appleId && (dsp.indexOf('apple') !== -1 || /apple/i.test(raw))) return appleLink(appleId[1]);
  if (dsp.indexOf('apple') !== -1 && appleId) return appleLink(appleId[1]);

  if (dsp.indexOf('youtube') !== -1 && raw) {
    var list = raw.match(/list=([A-Za-z0-9_-]+)/);
    if (list) return youtubeLink(list[1], 'playlist');
    if (/^OLAK5uy|^PL/i.test(raw)) return youtubeLink(raw, 'playlist');
    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return youtubeLink(raw, 'video');
  }

  if (fromHref) return fromHref;
  return null;
}

function pickDeliveries(payload) {
  var list = [];
  var raw = payload && payload.data && !Array.isArray(payload) ? payload.data : payload;
  if (Array.isArray(payload)) list = payload;
  else if (raw && Array.isArray(raw.deliveries)) list = raw.deliveries;
  else if (raw && Array.isArray(raw.data)) list = raw.data;
  else if (Array.isArray(raw)) list = raw;
  var out = [];
  var seen = {};
  list.forEach(function (row) {
    if (!row || typeof row !== 'object') return;
    var parsed = parseDelivery(row);
    var item = {
      dsp: slugOf(row.dsp || row.dsp_slug || (parsed && parsed.dsp)),
      dsp_name: trim(row.dsp_name || row.name || (parsed && parsed.name)),
      status: slugOf(row.status),
      dsp_release_id: trim(row.dsp_release_id || row.release_uri || row.store_id || ''),
      store_url: httpUrl(row.store_url || row.listen_url || (parsed && parsed.open) || ''),
    };
    if (!item.dsp && !item.dsp_release_id && !item.store_url) return;
    var key = item.dsp + ':' + (item.dsp_release_id || item.store_url);
    if (seen[key]) return;
    seen[key] = true;
    out.push(item);
  });
  return out;
}

function linksFrom(release) {
  var rows = [];
  if (release && Array.isArray(release.deliveries)) rows = release.deliveries;
  else if (Array.isArray(release)) rows = release;
  var links = [];
  var seen = {};
  rows.forEach(function (row) {
    var parsed = parseDelivery(row);
    if (!parsed || !parsed.open) return;
    if (seen[parsed.dsp + ':' + parsed.open]) return;
    seen[parsed.dsp + ':' + parsed.open] = true;
    if (!parsed.name || parsed.name === 'Store') {
      parsed = Object.assign({}, parsed, {
        name: prettyStoreName(row.dsp_name || row.name || row.dsp || parsed.dsp, parsed.name),
      });
    }
    links.push(parsed);
  });
  return links;
}

function preferEmbeds(links) {
  var rank = { spotify: 1, 'apple-music': 2, 'youtube-music': 3 };
  return (links || []).slice().sort(function (a, b) {
    return (rank[a.dsp] || 9) - (rank[b.dsp] || 9);
  });
}

function state(release) {
  var live = isLiveStatus(release && (release.status || release.tonegrid_status));
  var links = live ? preferEmbeds(linksFrom(release)) : [];
  return {
    live: live,
    links: links,
    disabled: !live || !links.length,
    note: !live ? WAIT_COPY : (links.length ? '' : LIVE_WAIT_COPY),
  };
}

function clearHost(host) {
  while (host.firstChild) host.removeChild(host.firstChild);
}

function mount(host, release, opts) {
  if (!host) return state(release);
  var info = state(release);
  var compact = Boolean(opts && opts.compact);
  clearHost(host);
  host.className = (host.className || '').replace(/\bis-live\b|\bis-wait\b/g, '').trim() + (info.live && info.links.length ? ' is-live' : ' is-wait');
  host.setAttribute('data-owner-player', info.live ? 'live' : 'wait');

  var note = document.createElement('p');
  note.className = 'hint';
  note.setAttribute('data-owner-player-note', '');
  note.textContent = info.note || (info.live ? 'Stream from the store, not PLAIGROUND.' : WAIT_COPY);

  if (!info.live) {
    var disabled = document.createElement('button');
    disabled.type = 'button';
    disabled.className = 'btn btn-ghost btn-sm owner-play is-off';
    disabled.disabled = true;
    disabled.setAttribute('aria-disabled', 'true');
    disabled.textContent = 'Play';
    host.appendChild(disabled);
    host.appendChild(note);
    return info;
  }

  if (!info.links.length) {
    var pending = document.createElement('button');
    pending.type = 'button';
    pending.className = 'btn btn-ghost btn-sm owner-play is-off';
    pending.disabled = true;
    pending.setAttribute('aria-disabled', 'true');
    pending.textContent = 'Play';
    host.appendChild(pending);
    host.appendChild(note);
    return info;
  }

  info.links.forEach(function (link, index) {
    if (!compact && link.embed && index === 0) {
      var frame = document.createElement('iframe');
      frame.src = link.embed;
      frame.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
      frame.setAttribute('loading', 'lazy');
      frame.setAttribute('title', link.name + ' player');
      frame.className = 'owner-embed';
      host.appendChild(frame);
    }
    var open = document.createElement('a');
    open.className = 'btn btn-purple btn-sm owner-play';
    open.href = link.open;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = compact || index > 0 ? ('Play on ' + link.name) : ('Play on ' + link.name);
    host.appendChild(open);
  });
  if (!info.note) {
    note.textContent = 'Streams from the live store page. PLAIGROUND does not host this file.';
  }
  host.appendChild(note);
  return info;
}

function mountLinks(host, release) {
  var info = state(release);
  if (!host) return info;
  clearHost(host);
  var show = Boolean(info.live && info.links.length);
  host.hidden = !show;
  if (host.classList && host.classList.toggle) host.classList.toggle('is-hidden', !show);
  if (host.setAttribute) host.setAttribute('data-owner-links', show ? 'ready' : (info.live ? 'wait' : 'off'));
  if (!show) return info;
  info.links.forEach(function (link) {
    if (!link || !httpUrl(link.open)) return;
    var line = document.createElement('div');
    line.className = 'loc';
    var open = document.createElement('a');
    open.href = link.open;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = link.name || 'Store';
    line.appendChild(open);
    host.appendChild(line);
  });
  return info;
}

var api = {
  LIVE_WAIT_COPY: LIVE_WAIT_COPY,
  WAIT_COPY: WAIT_COPY,
  isLiveStatus: isLiveStatus,
  linksFrom: linksFrom,
  mount: mount,
  mountLinks: mountLinks,
  parseDelivery: parseDelivery,
  pickDeliveries: pickDeliveries,
  state: state,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundLivePlayer = api;
}
