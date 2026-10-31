/**
 * Album "Apply to all tracks" model.
 * Album defaults: artist profile, made_how (no_ai / ai_assisted / fully_ai),
 * AI tool, credits (contributors with roles), writers with splits.
 * Each track reads "Applied from album" until it is edited; an edited field
 * becomes a per-track override. Each track still passes its own check
 * before the album can be submitted as one release.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlaiAlbumApply = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIELDS = ['artist', 'made_how', 'ai_service', 'contributors', 'writers', 'explicit'];
  var MADE_HOW = { no_ai: 'Human', ai_assisted: 'AI-assisted', fully_ai: 'AI' };
  var ROLES = ['performer', 'producer', 'composer', 'lyricist', 'mixer', 'mastering'];

  function trim(v) { return String(v == null ? '' : v).trim(); }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function has(obj, key) { return !!obj && Object.prototype.hasOwnProperty.call(obj, key); }

  function cleanWriters(list) {
    return (Array.isArray(list) ? list : []).map(function (w) {
      return { name: trim(w && w.name), share: Number(w && w.share) || 0, ipi: trim(w && w.ipi), pro: trim(w && w.pro) };
    }).filter(function (w) { return w.name; });
  }

  function cleanContributors(list) {
    return (Array.isArray(list) ? list : []).map(function (c) {
      return { name: trim(c && c.name), role: trim(c && c.role).toLowerCase() };
    }).filter(function (c) { return c.name && c.role; });
  }

  function albumDefaults(input) {
    input = input || {};
    return {
      artist: trim(input.artist),
      made_how: trim(input.made_how),
      ai_service: trim(input.ai_service),
      contributors: cleanContributors(input.contributors),
      writers: cleanWriters(input.writers),
      explicit: input.explicit === true || input.explicit === 'true',
    };
  }

  /** Effective values for one track, plus where each came from. */
  function resolveTrack(album, track) {
    var base = albumDefaults(album);
    var over = (track && track.override) || {};
    var out = { title: trim(track && track.title), position: Number(track && track.position) || 0, source: {} };
    FIELDS.forEach(function (key) {
      if (key !== 'artist' && has(over, key)) {
        out[key] = clone(over[key]);
        out.source[key] = 'track';
      } else {
        out[key] = clone(base[key]);
        out.source[key] = 'album';
      }
    });
    out.contributors = cleanContributors(out.contributors);
    out.writers = cleanWriters(out.writers);
    out.applied_from_album = FIELDS.every(function (k) { return out.source[k] === 'album'; });
    return out;
  }

  /** Edit this track: store only the fields that differ from the album. */
  function overrideTrack(track, patch) {
    var next = Object.assign({}, track || {});
    var over = Object.assign({}, next.override || {});
    Object.keys(patch || {}).forEach(function (key) {
      if (key === 'artist' || FIELDS.indexOf(key) === -1) return;
      over[key] = clone(patch[key]);
    });
    next.override = over;
    return next;
  }

  /** Back to "Applied from album" for one field, or all of them. */
  function clearOverride(track, key) {
    var next = Object.assign({}, track || {});
    if (!key) { delete next.override; return next; }
    var over = Object.assign({}, next.override || {});
    delete over[key];
    next.override = over;
    return next;
  }

  /** Apply to all tracks: clear the chosen fields' overrides on every track. */
  function applyToAll(tracks, keys) {
    var list = Array.isArray(keys) && keys.length ? keys : FIELDS;
    return (tracks || []).map(function (t) {
      var next = Object.assign({}, t);
      if (!next.override) return next;
      var over = Object.assign({}, next.override);
      list.forEach(function (k) { delete over[k]; });
      next.override = over;
      return next;
    });
  }

  /** One track's own check. Returns { ok, problems: [] }. */
  function verifyTrack(album, track, opts) {
    opts = opts || {};
    var r = resolveTrack(album, track);
    var problems = [];
    var label = 'Track ' + (r.position || '?');
    if (!r.title) problems.push(label + ' needs a title.');
    if (!(track && (track.audio_uploaded === true || track.has_audio === true || track.audio || track.audio_name))) {
      problems.push(label + ' needs its own audio file.');
    }
    if (!r.artist) problems.push(label + ' needs an artist profile.');
    if (!MADE_HOW[r.made_how]) problems.push(label + ' needs a Human, AI-assisted, or AI label.');
    var needTool = opts.requireTool !== false || r.source.ai_service === 'track' || r.source.made_how === 'track';
    if (needTool && (r.made_how === 'ai_assisted' || r.made_how === 'fully_ai') && !r.ai_service) {
      problems.push(label + ' needs the AI tool named.');
    }
    if (r.writers.length) {
      var total = r.writers.reduce(function (s, w) { return s + w.share; }, 0);
      if (Math.round(total * 100) !== 10000) problems.push(label + ' writer splits add up to ' + total + '%, not 100%.');
    } else if (opts.requireWriters !== false) {
      problems.push(label + ' needs at least one writer.');
    }
    r.contributors.forEach(function (c) {
      if (ROLES.indexOf(c.role) === -1) problems.push(label + ' has an unknown credit role: ' + c.role + '.');
    });
    return { ok: problems.length === 0, problems: problems, resolved: r };
  }

  /**
   * Store naming: 1 to 3 tracks with every track under 10 minutes is a single,
   * up to 6 tracks and under 30 minutes is an EP, else an album.
   */
  function releaseKind(tracks) {
    var list = tracks || [];
    var secs = list.reduce(function (s, t) { return s + (Number(t && t.duration) || 0); }, 0);
    var longest = list.reduce(function (m, t) { return Math.max(m, Number(t && t.duration) || 0); }, 0);
    if (list.length <= 3 && longest < 600 && secs < 1800) return 'single';
    if (list.length <= 6 && secs < 1800) return 'ep';
    return 'album';
  }

  /** Whole album check: every track passes, titles unique, at least 2 tracks. */
  function verifyAlbum(album, tracks, opts) {
    var list = tracks || [];
    var results = list.map(function (t, i) {
      return verifyTrack(album, Object.assign({ position: i + 1 }, t, { position: i + 1 }), opts);
    });
    var problems = [];
    if (list.length < 2) problems.push('An album or EP needs at least 2 tracks.');
    var seen = {};
    list.forEach(function (t, i) {
      var key = trim(t && t.title).toLowerCase();
      if (!key) return;
      if (seen[key]) problems.push('Track ' + (i + 1) + ' has the same title as track ' + seen[key] + '.');
      else seen[key] = i + 1;
    });
    results.forEach(function (res) { problems = problems.concat(res.problems); });
    return { ok: problems.length === 0, problems: problems, tracks: results, kind: releaseKind(list) };
  }

  /** Per-track fields the server applies at submit. */
  function tracksMeta(album, tracks) {
    return (tracks || []).map(function (t, i) {
      var r = resolveTrack(album, Object.assign({}, t, { position: i + 1 }));
      return {
        track_id: trim(t && t.track_id),
        position: i + 1,
        made_how: r.made_how,
        ai_service: r.ai_service,
        contributors: r.contributors,
        writers: r.writers,
        explicit: r.explicit,
        applied_from_album: r.applied_from_album,
      };
    });
  }

  return {
    FIELDS: FIELDS,
    MADE_HOW: MADE_HOW,
    ROLES: ROLES,
    albumDefaults: albumDefaults,
    resolveTrack: resolveTrack,
    overrideTrack: overrideTrack,
    clearOverride: clearOverride,
    applyToAll: applyToAll,
    verifyTrack: verifyTrack,
    verifyAlbum: verifyAlbum,
    releaseKind: releaseKind,
    tracksMeta: tracksMeta,
  };
});
