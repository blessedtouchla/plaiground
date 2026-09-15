'use strict';

/**
 * One Artist Profiles roster for Your Artists and Submit New Release.
 * Selectable names are profile.artists only — never store-tenant leftovers
 * or session-remembered typo rows. Do not invent names.
 */

function normalizeName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isLeftoverArtistName(name) {
  var next = normalizeName(name);
  if (!next) return false;
  if (
    next === 'john'
    || next === 'john ham'
    || next === 'john doe'
    || next === 'john harper'
    || next === 'patrick'
    || next === 'neon shadows'
    || next === 'neon sermon'
    || next === 'neon santos'
    || next === 'victoria reyes'
    || next === 'victoria void'
  ) return true;
  var first = next.split(' ')[0];
  return first === 'john' || first === 'patrick';
}

function artistId(artist) {
  return String((artist && (
    artist.id
    || artist.artist_id
    || artist.uuid
    || artist.plaiground_artist_id
    || artist.tonegrid_artist_id
    || artist.name
  )) || '').trim();
}

function asRow(artist) {
  if (!artist || !String(artist.name || '').trim()) return null;
  if (isLeftoverArtistName(artist.name)) return null;
  var id = artistId(artist);
  return Object.assign({}, artist, { id: id || String(artist.name).trim() });
}

function dedupe(list) {
  var seen = {};
  var out = [];
  (list || []).forEach(function (row) {
    var key = normalizeName(row && row.name);
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(row);
  });
  return out;
}

function fromMe(me) {
  var row = me || {};
  var raw = row.profile && Array.isArray(row.profile.artists) ? row.profile.artists : [];
  var artists = dedupe(raw.map(asRow).filter(Boolean));
  if (artists.length) return artists;
  if (row.artist && !isLeftoverArtistName(row.artist)) {
    return [{
      id: 'account',
      name: row.artist,
      source: 'created',
      badge: 'PLAIGROUND',
      tonegrid_artist_id: row.tonegrid_artist_id || '',
      genres: [],
      photo: '',
      bio: '',
    }];
  }
  return [];
}

function namesOf(list) {
  return (list || []).map(function (row) {
    return String((row && row.name) || '').trim();
  }).filter(Boolean);
}

var api = {
  artistId: artistId,
  dedupe: dedupe,
  fromMe: fromMe,
  isLeftoverArtistName: isLeftoverArtistName,
  namesOf: namesOf,
  normalizeName: normalizeName,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundArtistRoster = api;
}
