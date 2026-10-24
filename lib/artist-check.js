'use strict';

/**
 * PLAIGROUND live name checks. Artist names first, not audio.
 * No Spotify/Apple API and no store keys. Local lists + similarity.
 */

var FAMOUS_ARTISTS = [
  'Drake',
  'Taylor Swift',
  'Beyonce',
  'Beyoncé',
  'The Weeknd',
  'Bad Bunny',
  'Ed Sheeran',
  'Ariana Grande',
  'Justin Bieber',
  'Rihanna',
  'Adele',
  'Bruno Mars',
  'Billie Eilish',
  'Post Malone',
  'Kendrick Lamar',
  'SZA',
  'Doja Cat',
  'Olivia Rodrigo',
  'Harry Styles',
  'Dua Lipa',
  'The Beatles',
  'Michael Jackson',
  'Elvis Presley',
  'Madonna',
  'Eminem',
  'Kanye West',
  'Ye',
  'Jay-Z',
  'Jay Z',
  'Lady Gaga',
  'Coldplay',
  'Metallica',
  'Pink Floyd',
  'Queen',
  'Led Zeppelin',
  'Nirvana',
  'Whitney Houston',
  'Prince',
  'Bob Dylan',
  'Elton John',
  'Stevie Wonder',
  'Aretha Franklin',
  'Travis Scott',
  'Future',
  'Metro Boomin',
  'Lizzo',
  'Miley Cyrus',
  'Shakira',
  'Karol G',
  'J Cole',
  'J. Cole',
  'Nicki Minaj',
  'Cardi B',
  'The Rolling Stones',
  'AC/DC',
  'U2',
  'Radiohead',
  'Usher',
  'Chris Brown',
];

var KNOWN_ARTISTS = [
  'Sia',
  'Lorde',
  'Hozier',
  'Tame Impala',
  'Glass Animals',
  'Phoebe Bridgers',
  'Maggie Rogers',
  'Clairo',
  'Girl in Red',
  'Rex Orange County',
  'Mac DeMarco',
  'Tyler the Creator',
  'Childish Gambino',
  'Frank Ocean',
  'Solange',
  'Blood Orange',
  'FKA Twigs',
  'James Blake',
  'Bon Iver',
  'The National',
  'Vampire Weekend',
  'Arctic Monkeys',
  'The 1975',
  'Paramore',
  'Imagine Dragons',
  'Maroon 5',
  'OneRepublic',
  'Kelly Clarkson',
  'John Legend',
  'Alicia Keys',
  'John Mayer',
  'Jack Harlow',
  'Lil Nas X',
  'Megan Thee Stallion',
  'Ice Spice',
  'Latto',
  'Gunna',
  'Lil Baby',
  '21 Savage',
  'Offset',
  'Quavo',
  'Takeoff',
  'Playboi Carti',
  'Don Toliver',
  'Brent Faiyaz',
  'Summer Walker',
  'Jhene Aiko',
  'Kehlani',
  'H.E.R.',
  'Daniel Caesar',
  'Giveon',
  'Sabrina Carpenter',
  'Chappell Roan',
  'Gracie Abrams',
  'Noah Kahan',
  'Zach Bryan',
  'Morgan Wallen',
  'Luke Combs',
  'Chris Stapleton',
  'Kacey Musgraves',
  'Lainey Wilson',
  'Tyler Childers',
  'Turnpike Troubadours',
  'Charli XCX',
  'Caroline Polachek',
  'Rina Sawayama',
  'Japanese Breakfast',
  'Mitski',
  'Soccer Mommy',
  'Snail Mail',
  'Big Thief',
  'Adrianne Lenker',
  'Julien Baker',
  'Lucy Dacus',
  'Waxahatchee',
  'Angel Olsen',
];

var TITLE_PROMO = [
  /\bofficial\b/i,
  /\bexclusive\b/i,
  /\bhd\b/i,
  /\bout\s*now\b/i,
  /\bspotify\b/i,
  /\blyric\s*video\b/i,
  /\bofficial\s*video\b/i,
  /\bfree\s*download\b/i,
  /\bvisualizer\b/i,
  /\bpremiere\b/i,
];

var YELLOW_COPY = 'An artist with this name already exists. Link their page if this is the same artist, or confirm this is a different artist.';
var RED_COPY = 'This name is too close to an existing artist and can’t be released automatically.';
var CONFIRM_COPY = 'I confirm this is not impersonation and I understand this release may be reviewed.';

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeName(value) {
  return trim(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensOf(value) {
  var n = normalizeName(value);
  return n ? n.split(' ') : [];
}

function levenshtein(a, b) {
  var s = String(a || '');
  var t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  var prev = [];
  var i;
  var j;
  for (j = 0; j <= t.length; j += 1) prev[j] = j;
  for (i = 1; i <= s.length; i += 1) {
    var next = [i];
    for (j = 1; j <= t.length; j += 1) {
      var cost = s.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1;
      next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = next;
  }
  return prev[t.length];
}

function closeNames(a, b, limit) {
  var left = normalizeName(a);
  var right = normalizeName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  var max = Math.max(left.length, right.length);
  var dist = levenshtein(left, right);
  if (max >= 5 && dist <= (limit == null ? 1 : limit)) return true;
  if (max >= 8 && dist <= 2) return true;
  return false;
}

function containsName(hay, needle) {
  var hayN = normalizeName(hay);
  var needleN = normalizeName(needle);
  if (!hayN || !needleN || needleN.length < 3) return false;
  if (hayN === needleN) return true;
  var parts = hayN.split(' ');
  var want = needleN.split(' ');
  if (want.length === 1) return parts.indexOf(want[0]) !== -1;
  return (' ' + hayN + ' ').indexOf(' ' + needleN + ' ') !== -1;
}

function parseStoreLink(value) {
  var raw = trim(value);
  if (!raw) return { ok: false, reason: 'empty' };
  var href = raw;
  if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
  var u;
  try {
    u = new URL(href);
  } catch (err) {
    return { ok: false, reason: 'invalid' };
  }
  var host = String(u.hostname || '').replace(/^www\./i, '').toLowerCase();
  var path = String(u.pathname || '');
  var spotify = path.match(/\/artist\/([a-zA-Z0-9]+)/i);
  if (host.indexOf('spotify.com') !== -1 && spotify) {
    return { ok: true, platform: 'spotify', id: spotify[1], url: u.toString() };
  }
  var apple = path.match(/\/artist\/(?:[^/]+\/)?(\d+)/i);
  if ((host.indexOf('apple.com') !== -1 || host.indexOf('itunes.apple.com') !== -1) && apple) {
    return { ok: true, platform: 'apple', id: apple[1], url: u.toString() };
  }
  var amazon = path.match(/\/artists?\/([A-Z0-9]+)/i);
  if (host.indexOf('amazon.') !== -1 && amazon) {
    return { ok: true, platform: 'amazon', id: amazon[1], url: u.toString() };
  }
  var deezer = path.match(/\/artist\/(\d+)/i);
  if (host.indexOf('deezer.com') !== -1 && deezer) {
    return { ok: true, platform: 'deezer', id: deezer[1], url: u.toString() };
  }
  return { ok: false, reason: 'unsupported' };
}

function famousMatch(name) {
  var i;
  for (i = 0; i < FAMOUS_ARTISTS.length; i += 1) {
    var famous = FAMOUS_ARTISTS[i];
    if (normalizeName(name) === normalizeName(famous)) {
      return { match: famous, reason: 'famous_exact' };
    }
    if (closeNames(name, famous, 1)) {
      return { match: famous, reason: 'famous_close' };
    }
    if (containsName(name, famous) && normalizeName(famous).length >= 4) {
      return { match: famous, reason: 'famous_contains' };
    }
  }
  return null;
}

function knownMatch(name) {
  var i;
  for (i = 0; i < KNOWN_ARTISTS.length; i += 1) {
    var known = KNOWN_ARTISTS[i];
    if (normalizeName(name) === normalizeName(known) || closeNames(name, known, 1)) {
      return { match: known, reason: 'known_similar' };
    }
  }
  return null;
}

function accountMatch(name, accountArtists, skipId) {
  var list = Array.isArray(accountArtists) ? accountArtists : [];
  var i;
  for (i = 0; i < list.length; i += 1) {
    var row = list[i] && typeof list[i] === 'object' ? list[i] : { name: list[i] };
    if (skipId && row.id && String(row.id) === String(skipId)) continue;
    if (!row.name) continue;
    if (normalizeName(name) === normalizeName(row.name) || closeNames(name, row.name, 1)) {
      return { match: row.name, reason: 'account_similar', artist: row };
    }
  }
  return null;
}

function checkArtistName(name, opts) {
  opts = opts || {};
  var parsed = parseStoreLink(opts.storeLink || opts.link || opts.url || '');
  if (parsed.ok) {
    return {
      level: 'green',
      skip: true,
      linked: true,
      reason: 'linked',
      parsed: parsed,
      copy: '',
    };
  }
  var raw = trim(name);
  if (!raw) return { level: 'empty', copy: '' };
  var red = famousMatch(raw);
  if (red) {
    return {
      level: 'red',
      match: red.match,
      reason: red.reason,
      copy: RED_COPY,
    };
  }
  var yellow = accountMatch(raw, opts.accountArtists, opts.skipId) || knownMatch(raw);
  if (yellow) {
    return {
      level: 'yellow',
      match: yellow.match,
      reason: yellow.reason,
      copy: YELLOW_COPY,
    };
  }
  return { level: 'green', copy: '' };
}

function checkTitle(title, opts) {
  opts = opts || {};
  var raw = trim(title);
  var flags = [];
  if (!raw) return { flagged: false, flags: flags, block: false };
  var i;
  for (i = 0; i < TITLE_PROMO.length; i += 1) {
    if (TITLE_PROMO[i].test(raw)) {
      flags.push('promo');
      break;
    }
  }
  var artistName = normalizeName(opts.artistName || '');
  for (i = 0; i < FAMOUS_ARTISTS.length; i += 1) {
    var famous = FAMOUS_ARTISTS[i];
    if (containsName(raw, famous) && normalizeName(famous) !== artistName && normalizeName(famous).length >= 4) {
      flags.push('famous_bait');
      break;
    }
  }
  if (raw.length > 80 || /(.)\1{4,}/.test(raw) || /(free|download|mp3|type beat|official audio)/i.test(raw)) {
    flags.push('spam');
  }
  var unique = [];
  for (i = 0; i < flags.length; i += 1) {
    if (unique.indexOf(flags[i]) === -1) unique.push(flags[i]);
  }
  return {
    flagged: unique.length > 0,
    flags: unique,
    block: false,
    copy: unique.length
      ? 'This title looks messy or promotional. Song titles are generally not copyrightable. You can keep it, or clean it up before submit.'
      : '',
  };
}

var STORE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Exact artist name key: case and accent insensitive, spaces collapsed. Nothing else is loosened.
function artistNameKey(value) {
  return trim(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function rosterRowForStoreId(roster, storeId) {
  var want = trim(storeId).toLowerCase();
  if (!want) return null;
  var list = Array.isArray(roster) ? roster : [];
  for (var i = 0; i < list.length; i += 1) {
    if (list[i] && trim(list[i].tonegrid_artist_id).toLowerCase() === want) return list[i];
  }
  return null;
}

// The store artist id for a typed name. Only an exact roster match counts.
// No match, or more than one store id, returns '' so the caller creates a new artist.
function rosterStoreIdForName(roster, name) {
  var key = artistNameKey(name);
  if (!key) return '';
  var ids = [];
  (Array.isArray(roster) ? roster : []).forEach(function (row) {
    if (!row || artistNameKey(row.name) !== key) return;
    var id = trim(row.tonegrid_artist_id);
    if (STORE_UUID.test(id) && ids.indexOf(id.toLowerCase()) === -1) ids.push(id.toLowerCase());
  });
  return ids.length === 1 ? ids[0] : '';
}

// True only when a store artist id really belongs to the typed name.
// boundName is the name saved with the id when it was chosen or created.
function storeIdBoundToName(roster, storeId, name, boundName) {
  var key = artistNameKey(name);
  if (!key || !STORE_UUID.test(trim(storeId))) return false;
  var row = rosterRowForStoreId(roster, storeId);
  if (row) return artistNameKey(row.name) === key;
  return Boolean(boundName) && artistNameKey(boundName) === key;
}

// Roster name that owns storeId when it is NOT the typed name, else ''.
function storeIdNameConflict(roster, storeId, name) {
  var key = artistNameKey(name);
  var row = rosterRowForStoreId(roster, storeId);
  if (!key || !row || !row.name) return '';
  return artistNameKey(row.name) === key ? '' : String(row.name);
}

var api = {
  FAMOUS_ARTISTS: FAMOUS_ARTISTS,
  KNOWN_ARTISTS: KNOWN_ARTISTS,
  YELLOW_COPY: YELLOW_COPY,
  RED_COPY: RED_COPY,
  CONFIRM_COPY: CONFIRM_COPY,
  normalizeName: normalizeName,
  artistNameKey: artistNameKey,
  rosterStoreIdForName: rosterStoreIdForName,
  storeIdBoundToName: storeIdBoundToName,
  storeIdNameConflict: storeIdNameConflict,
  tokensOf: tokensOf,
  levenshtein: levenshtein,
  parseStoreLink: parseStoreLink,
  checkArtistName: checkArtistName,
  checkName: checkArtistName,
  checkTitle: checkTitle,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PlaigroundArtistCheck = api;
}
