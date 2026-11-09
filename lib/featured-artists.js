'use strict';

/**
 * Featured-artist credits for the release form.
 * Names stay a comma-separated `featured` string so older drafts still load.
 * The store credit is track-level additional_artists with role FeaturedArtist.
 * That role is billing metadata, not a songwriter/producer contributor.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlaigroundFeaturedArtists = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var ROLE = 'FeaturedArtist';
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function trim(value) {
    return String(value == null ? '' : value).trim();
  }

  function personFrom(raw) {
    if (raw && typeof raw === 'object') {
      var name = trim(raw.name || raw.artist || [raw.first_name, raw.last_name].filter(Boolean).join(' '));
      if (!name) return null;
      var person = { name: name };
      var id = trim(raw.artist_id || raw.tonegrid_artist_id || raw.store_artist_id);
      if (UUID_RE.test(id)) person.artist_id = id;
      return person;
    }
    var text = trim(raw);
    return text ? { name: text } : null;
  }

  function dedupe(people) {
    var out = [];
    var seen = Object.create(null);
    (people || []).forEach(function (person) {
      if (!person || !person.name) return;
      var key = person.name.toLowerCase();
      if (seen[key]) {
        if (!seen[key].artist_id && person.artist_id) seen[key].artist_id = person.artist_id;
        return;
      }
      var next = { name: person.name };
      if (person.artist_id) next.artist_id = person.artist_id;
      seen[key] = next;
      out.push(next);
    });
    return out;
  }

  function peopleFrom(source) {
    var rows = [];
    function push(raw) {
      var person = personFrom(raw);
      if (person) rows.push(person);
    }
    if (Array.isArray(source)) {
      source.forEach(push);
      return dedupe(rows);
    }
    if (source && typeof source === 'object') {
      if (Array.isArray(source.featured_artists) && source.featured_artists.length) {
        source.featured_artists.forEach(push);
        return dedupe(rows);
      }
      if (Array.isArray(source.featured_list) && source.featured_list.length) {
        source.featured_list.forEach(push);
        return dedupe(rows);
      }
      if (source.featured != null) {
        trim(source.featured).split(',').forEach(push);
      }
      return dedupe(rows);
    }
    if (source != null) trim(source).split(',').forEach(push);
    return dedupe(rows);
  }

  function creditText(people) {
    return (people || []).map(function (person) { return person.name; }).join(', ');
  }

  function additionalArtists(people) {
    return dedupe(people).map(function (person) {
      var row = { name: person.name, role: ROLE };
      if (person.artist_id) row.artist_id = person.artist_id;
      return row;
    });
  }

  function isAlbum(draft) {
    return String((draft && draft.type) || '').toLowerCase() === 'album'
      && Array.isArray(draft.tracks)
      && draft.tracks.length > 0;
  }

  function trackHasOwn(track) {
    if (!track || typeof track !== 'object') return false;
    if (Array.isArray(track.featured_artists) && track.featured_artists.length) return true;
    if (Array.isArray(track.featured_list) && track.featured_list.some(function (name) { return trim(name); })) return true;
    return Boolean(trim(track.featured));
  }

  function assignments(draft) {
    draft = draft || {};
    var releasePeople = peopleFrom(draft);
    if (!isAlbum(draft)) {
      return [{
        title: trim(draft.title),
        position: 1,
        track_id: trim(draft.track_id),
        people: releasePeople,
      }];
    }
    return draft.tracks.map(function (track, index) {
      track = track || {};
      return {
        title: trim(track.title),
        position: Number(track.position) || (index + 1),
        track_id: trim(track.track_id || track.id || track.uuid),
        people: trackHasOwn(track) ? peopleFrom(track) : releasePeople.map(function (person) {
          return Object.assign({}, person);
        }),
      };
    });
  }

  function reviewLines(draft) {
    var album = isAlbum(draft);
    return assignments(draft).filter(function (row) {
      return row.people.length;
    }).map(function (row) {
      var many = row.people.length > 1;
      var label = many ? 'Featured artists' : 'Featured artist';
      if (album) {
        label += ', track ' + row.position;
        if (row.title) label += ' (' + row.title + ')';
      }
      return {
        label: label,
        text: creditText(row.people),
        position: row.position,
        track_id: row.track_id,
        title: row.title,
      };
    });
  }

  function sharedCredit(draft) {
    var rows = assignments(draft);
    var credited = rows.filter(function (row) { return row.people.length; });
    if (!credited.length) return '';
    if (isAlbum(draft) && credited.length !== rows.length) return '';
    var first = creditText(credited[0].people);
    for (var i = 1; i < credited.length; i += 1) {
      if (creditText(credited[i].people) !== first) return '';
    }
    return first;
  }

  function trackRecord(row) {
    var artists = additionalArtists(row.people);
    var item = {
      title: row.title || '',
      position: row.position,
      track_id: row.track_id || '',
      featured: creditText(row.people),
      featured_list: row.people.map(function (person) { return person.name; }),
    };
    if (artists.some(function (artist) { return artist.artist_id; })) item.featured_artists = artists;
    return item;
  }

  function storedFields(draft) {
    var people = peopleFrom(draft);
    var artists = additionalArtists(people);
    var out = {
      featured: creditText(people),
      featured_list: people.map(function (person) { return person.name; }),
    };
    if (artists.some(function (artist) { return artist.artist_id; })) out.featured_artists = artists;
    if (isAlbum(draft)) out.featured_tracks = assignments(draft).map(trackRecord);
    return out;
  }

  function submitFields(draft) {
    return storedFields(draft);
  }

  function peopleForTrackId(body, trackId, index) {
    var tracks = Array.isArray(body && body.featured_tracks) ? body.featured_tracks : [];
    var id = trim(trackId).toLowerCase();
    if (tracks.length) {
      if (id) {
        var hit = null;
        tracks.forEach(function (row) {
          if (hit) return;
          var rowId = trim(row && (row.track_id || row.id || row.uuid)).toLowerCase();
          if (rowId && rowId === id) hit = row;
        });
        if (hit) return peopleFrom(hit);
      }
      var anyId = tracks.some(function (row) {
        return Boolean(trim(row && (row.track_id || row.id || row.uuid)));
      });
      if (!anyId && index != null && tracks[index]) return peopleFrom(tracks[index]);
      if (anyId) return [];
    }
    return peopleFrom(body);
  }

  function normalizeTracks(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(function (row, index) {
      row = row || {};
      var people = peopleFrom(row);
      return trackRecord({
        title: trim(row.title),
        position: Number(row.position) || (index + 1),
        track_id: trim(row.track_id || row.id || row.uuid),
        people: people,
      });
    });
  }

  return {
    ROLE: ROLE,
    peopleFrom: peopleFrom,
    additionalArtists: additionalArtists,
    assignments: assignments,
    reviewLines: reviewLines,
    sharedCredit: sharedCredit,
    storedFields: storedFields,
    submitFields: submitFields,
    peopleForTrackId: peopleForTrackId,
    normalizeTracks: normalizeTracks,
  };
});
