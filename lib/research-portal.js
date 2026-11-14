(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundResearch = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var LICENCE_NOTE = 'Public Wikidata data, licence CC0, retrieved for this search. A miss is not proof of absence. These are not your rights and not a chain of title.';
  var MB_NOTE = 'This link opens MusicBrainz in your browser. PLAIGROUND does not call the MusicBrainz web service. A MusicBrainz ID or store link used here is only a seed for a Wikidata search. MusicBrainz says that hosted service is free for non-commercial use, and commercial use needs their commercial plans.';
  var NO_MATCH = 'No Wikidata item came back for this search. That is not proof the artist, recording, or work is missing from Wikidata, MusicBrainz, or any registry.';
  var NOTES_PREFIX = 'plaiground.research.notes.v1.';
  var MAX_NOTES = 80;
  var MAX_PASTE = 40;

  var REGISTRY_LINKS = [
    { id: 'mb-home', label: 'MusicBrainz search', href: 'https://musicbrainz.org/search', limitation: MB_NOTE },
    { id: 'ascap', label: 'ASCAP repertory (Songview data)', href: 'https://www.ascap.com/repertory', limitation: 'Registered claim, not proof of current ownership. Search on their site. PLAIGROUND does not copy the results.' },
    { id: 'bmi', label: 'BMI repertoire search', href: 'https://repertoire.bmi.com/', limitation: 'Registered claim, not proof of current ownership. Search on their site. PLAIGROUND does not copy the results.' },
    { id: 'songview', label: 'Songview', href: 'https://songview.com/', limitation: 'ASCAP and BMI repertoire. A listing is a claim, not a chain of title.' },
    { id: 'mlc', label: 'The MLC public search', href: 'https://portal.themlc.com/search', limitation: 'US digital mechanical claims. A miss is not proof the work is unregistered.' },
    { id: 'copyright', label: 'US Copyright Office public records', href: 'https://publicrecords.copyright.gov/', limitation: 'A registration or recorded document is evidence of a filing. Transfers do not have to be recorded, so a miss proves nothing.' },
    { id: 'uspto', label: 'USPTO trademark search', href: 'https://tmsearch.uspto.gov/', limitation: 'A search is not a filing and not a clearance opinion.' },
    { id: 'isrc', label: 'ISRC search', href: 'https://isrcsearch.ifpi.org/', limitation: 'Lookup of a recording code. Paste the code there. Not a proof of who owns the master today.' }
  ];

  var PROPS = {
    P31: { label: 'Instance of', kind: 'item' },
    P50: { label: 'Author', kind: 'item' },
    P86: { label: 'Composer', kind: 'item' },
    P123: { label: 'Publisher', kind: 'item' },
    P175: { label: 'Performer', kind: 'item' },
    P264: { label: 'Record label', kind: 'item' },
    P434: { label: 'MusicBrainz artist ID', kind: 'mb-artist' },
    P435: { label: 'MusicBrainz work ID', kind: 'mb-work' },
    P436: { label: 'MusicBrainz recording ID', kind: 'mb-recording' },
    P440: { label: 'MusicBrainz release group ID', kind: 'mb-release-group' },
    P569: { label: 'Date of birth', kind: 'time' },
    P570: { label: 'Date of death', kind: 'time' },
    P571: { label: 'Inception', kind: 'time' },
    P576: { label: 'End date', kind: 'time' },
    P577: { label: 'Publication date', kind: 'time' },
    P676: { label: 'Lyricist', kind: 'item' },
    P856: { label: 'Official website', kind: 'url' },
    P1243: { label: 'ISRC', kind: 'isrc' },
    P1476: { label: 'Title', kind: 'text' },
    P1827: { label: 'ISWC', kind: 'iswc' },
    P1902: { label: 'Spotify artist ID listed on Wikidata', kind: 'spotify-artist' },
    P2397: { label: 'YouTube channel ID listed on Wikidata', kind: 'youtube' },
    P2722: { label: 'Deezer artist ID listed on Wikidata', kind: 'deezer-artist' },
    P2850: { label: 'Apple Music artist ID listed on Wikidata', kind: 'apple-artist' }
  };

  function trim(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isQid(value) {
    return /^Q[1-9][0-9]{0,15}$/.test(String(value || ''));
  }

  function canonicalIsrc(value) {
    var compact = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(compact)) return '';
    return compact;
  }

  function canonicalIswc(value) {
    var compact = String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (!/^T\d{9}[0-9A-Z]$/.test(compact)) return '';
    return 'T-' + compact.slice(1, 4) + '.' + compact.slice(4, 7) + '.' + compact.slice(7, 10) + '-' + compact.slice(10);
  }

  function canonicalMbid(value) {
    var id = String(value || '').toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return '';
    return id;
  }

  function wholeToken(value) {
    return trim(value).indexOf(' ') === -1;
  }

  function isBlockedHost(hostname) {
    var host = String(hostname || '').toLowerCase().replace(/\.+$/, '').replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host === '0.0.0.0' || host.slice(-10) === '.localhost' || host.slice(-6) === '.local') return true;
    if (host === 'metadata.google.internal' || host === 'metadata.internal') return true;
    if (host === '::1' || host.indexOf('fe80:') === 0 || host.indexOf('fc') === 0 || host.indexOf('fd') === 0) return true;
    var parts = host.split('.');
    if (parts.length !== 4) return false;
    var nums = parts.map(function (part) { return /^\d{1,3}$/.test(part) ? Number(part) : NaN; });
    if (nums.some(function (n) { return !Number.isFinite(n) || n > 255; })) return false;
    var a = nums[0];
    var b = nums[1];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  function isSafeHttpUrl(value, limit) {
    var raw = String(value || '').trim();
    var max = limit || 500;
    if (!raw || raw.length > max) return false;
    var parsed;
    try {
      parsed = new URL(raw);
    } catch (err) {
      return false;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.username || parsed.password) return false;
    if (isBlockedHost(parsed.hostname)) return false;
    return true;
  }

  function parseHttpUrl(value, limit) {
    if (!isSafeHttpUrl(value, limit)) return null;
    try {
      return new URL(String(value).trim());
    } catch (err) {
      return null;
    }
  }

  function pathParts(url) {
    return url.pathname.split('/').filter(Boolean);
  }

  function parseSeed(raw) {
    var text = trim(raw);
    if (!text || text.length > 200) return { ok: false, reason: 'invalid' };
    if (/[\u0000-\u001f]/.test(text)) return { ok: false, reason: 'invalid' };
    if (/^[a-z][a-z0-9+.-]*:/i.test(text) && text.indexOf('://') === -1) return { ok: false, reason: 'rejected-url' };
    if (text.indexOf('://') !== -1 || /^\/\//.test(text)) {
      var url = parseHttpUrl(text.indexOf('://') === -1 ? 'https:' + text : text);
      if (!url) return { ok: false, reason: 'rejected-url' };
      var host = url.hostname.toLowerCase().replace(/^www\./, '');
      var parts = pathParts(url);
      if (host === 'musicbrainz.org' && parts[0] === 'artist') {
        var mbid = canonicalMbid(parts[1]);
        if (!mbid) return { ok: false, reason: 'invalid' };
        return { ok: true, type: 'mbid', op: 'mbid', q: mbid, label: mbid };
      }
      if (host === 'open.spotify.com') {
        var spot = parts.indexOf('artist');
        var spotId = spot === -1 ? '' : parts[spot + 1] || '';
        if (!/^[A-Za-z0-9]{10,40}$/.test(spotId)) return { ok: false, reason: 'invalid' };
        return { ok: true, type: 'store', op: 'store', platform: 'spotify', q: spotId, label: spotId };
      }
      if (host === 'music.apple.com' && parts.indexOf('artist') !== -1) {
        var apple = '';
        for (var i = parts.length - 1; i >= 0; i -= 1) {
          if (/^\d{2,20}$/.test(parts[i])) { apple = parts[i]; break; }
        }
        if (!apple) return { ok: false, reason: 'invalid' };
        return { ok: true, type: 'store', op: 'store', platform: 'apple', q: apple, label: apple };
      }
      if (host === 'deezer.com') {
        var deezerAt = parts.indexOf('artist');
        var deezer = deezerAt === -1 ? '' : parts[deezerAt + 1] || '';
        if (!/^\d{1,20}$/.test(deezer)) return { ok: false, reason: 'invalid' };
        return { ok: true, type: 'store', op: 'store', platform: 'deezer', q: deezer, label: deezer };
      }
      return { ok: false, reason: 'rejected-url' };
    }
    if (wholeToken(text)) {
      var isrc = canonicalIsrc(text);
      if (isrc && text.replace(/[^A-Za-z0-9]/g, '').length === 12) return { ok: true, type: 'isrc', op: 'isrc', q: isrc, label: isrc };
      var iswc = canonicalIswc(text);
      if (iswc && text.replace(/[^0-9A-Za-z]/g, '').length === 11) return { ok: true, type: 'iswc', op: 'iswc', q: iswc, label: iswc };
      var bare = canonicalMbid(text);
      if (bare) return { ok: true, type: 'mbid', op: 'mbid', q: bare, label: bare };
      if (isQid(text)) return { ok: true, type: 'qid', op: 'entity', q: text, label: text };
    }
    if (text.length < 2) return { ok: false, reason: 'invalid' };
    return { ok: true, type: 'name', op: 'search', q: text.slice(0, 120), label: text.slice(0, 120) };
  }

  function mbSearchHref(query, type) {
    return 'https://musicbrainz.org/search?query=' + encodeURIComponent(query) + '&type=' + encodeURIComponent(type) + '&method=advanced';
  }

  function manualLinks(raw) {
    var links = REGISTRY_LINKS.map(function (link) {
      return { id: link.id, label: link.label, href: link.href, limitation: link.limitation, kind: 'registry' };
    });
    var seed = parseSeed(raw);
    var typed = trim(raw);
    if (!seed.ok) {
      return { links: links, typeThis: typed ? 'This entry is not a supported name, MusicBrainz ID, store artist link, ISRC, or ISWC.' : '', seed: seed };
    }
    if (seed.type === 'name') {
      links.unshift({
        id: 'mb-name',
        label: 'Open this name on MusicBrainz',
        href: mbSearchHref('artist:"' + seed.q.replace(/["\\]/g, ' ') + '"', 'artist'),
        limitation: MB_NOTE + ' A name search can match more than one artist. Read the disambiguation there before you rely on it.',
        kind: 'presence'
      });
    } else if (seed.type === 'mbid') {
      links.unshift({
        id: 'mb-artist',
        label: 'Open this MusicBrainz artist',
        href: 'https://musicbrainz.org/artist/' + seed.q,
        limitation: MB_NOTE,
        kind: 'presence'
      });
    } else if (seed.type === 'isrc') {
      links.unshift({
        id: 'mb-isrc',
        label: 'Open this ISRC on MusicBrainz',
        href: mbSearchHref('isrc:' + seed.q, 'recording'),
        limitation: MB_NOTE + ' An ISRC identifies a recording, not the composition.',
        kind: 'recording'
      });
    } else if (seed.type === 'iswc') {
      links.unshift({
        id: 'mb-iswc',
        label: 'Open this ISWC on MusicBrainz',
        href: mbSearchHref('iswc:' + seed.q, 'work'),
        limitation: MB_NOTE + ' An ISWC identifies a composition, not a recording.',
        kind: 'work'
      });
    }
    var typeThis = '';
    if (seed.type === 'name') typeThis = 'On the registry sites, search the name: ' + seed.q + '. Then check the writers, publishers, and shares yourself.';
    if (seed.type === 'isrc') typeThis = 'Paste this recording code into ISRC search: ' + seed.q + '. Do not treat it as a composition registration.';
    if (seed.type === 'iswc') typeThis = 'Search this composition code on the society and MLC sites: ' + seed.q + '.';
    if (seed.type === 'mbid') typeThis = 'MusicBrainz artist ID ' + seed.q + ' is a Wikidata seed only. The MusicBrainz web service is not queried. Registry sites still need a title or writer name.';
    if (seed.type === 'store') typeThis = 'This store artist ID is a Wikidata seed only. That store is not queried, and no analytics are read.';
    if (seed.type === 'qid') typeThis = 'Wikidata item ' + seed.q + ' still needs a separate registry search for claims.';
    return { links: links, typeThis: typeThis, seed: seed };
  }

  function checked(now) {
    var clock = typeof now === 'function' ? now : function () { return Date.now(); };
    return new Date(clock()).toISOString();
  }

  function field(id, label, value, href, checkedAt, note) {
    var row = {
      id: id,
      label: label,
      value: value,
      source: 'Wikidata',
      licence: 'CC0',
      checkedAt: checkedAt
    };
    if (href && isSafeHttpUrl(href)) row.href = href;
    if (note) row.note = note;
    return row;
  }

  function hrefFor(kind, value) {
    if (kind === 'mb-artist' && canonicalMbid(value)) return 'https://musicbrainz.org/artist/' + canonicalMbid(value);
    if (kind === 'mb-work' && canonicalMbid(value)) return 'https://musicbrainz.org/work/' + canonicalMbid(value);
    if (kind === 'mb-recording' && canonicalMbid(value)) return 'https://musicbrainz.org/recording/' + canonicalMbid(value);
    if (kind === 'mb-release-group' && canonicalMbid(value)) return 'https://musicbrainz.org/release-group/' + canonicalMbid(value);
    if (kind === 'spotify-artist' && /^[A-Za-z0-9]{10,40}$/.test(value)) return 'https://open.spotify.com/artist/' + value;
    if (kind === 'apple-artist' && /^\d{2,20}$/.test(value)) return 'https://music.apple.com/artist/' + value;
    if (kind === 'deezer-artist' && /^\d{1,20}$/.test(value)) return 'https://www.deezer.com/artist/' + value;
    if (kind === 'youtube' && /^UC[A-Za-z0-9_-]{22}$/.test(value)) return 'https://www.youtube.com/channel/' + value;
    if (kind === 'url' && isSafeHttpUrl(value)) return value;
    if (kind === 'item' && isQid(value)) return 'https://www.wikidata.org/wiki/' + value;
    return '';
  }

  function noteFor(kind) {
    if (kind.indexOf('mb-') === 0) return 'Listed on Wikidata. Not a result from the MusicBrainz web service. The link opens their site for you to read.';
    if (kind === 'isrc') return 'Recording code listed on Wikidata. Not proof the recording is released, not a composition registration, and not chain of title.';
    if (kind === 'iswc') return 'Composition code listed on Wikidata. Not proof of a PRO or MLC registration, and not this artist\'s own rights record.';
    if (kind === 'item') return 'Public credit on Wikidata. Not this artist\'s own rights record and not chain of title.';
    if (kind === 'spotify-artist' || kind === 'apple-artist' || kind === 'deezer-artist' || kind === 'youtube') {
      return 'Identifier copied from Wikidata. PLAIGROUND does not call that service and does not show its analytics.';
    }
    if (kind === 'url') return 'Link stored on the Wikidata item. PLAIGROUND does not open it or copy the page.';
    return '';
  }

  function formatTime(value) {
    if (!value || typeof value !== 'object') return '';
    var time = String(value.time || '');
    var match = time.match(/^[+-](\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    var precision = Number(value.precision || 11);
    if (precision <= 9 || match[2] === '00') return match[1];
    if (precision === 10 || match[3] === '00') return match[1] + '-' + match[2];
    return match[1] + '-' + match[2] + '-' + match[3];
  }

  function claimValues(claimList) {
    var values = [];
    (claimList || []).forEach(function (claim) {
      var snak = claim && claim.mainsnak;
      if (!snak || snak.snaktype === 'novalue' || snak.snaktype === 'somevalue' || !snak.datavalue) return;
      var data = snak.datavalue;
      if (data.type === 'string' || data.type === 'monolingualtext') {
        var text = data.type === 'string' ? data.value : (data.value && data.value.text);
        text = trim(text);
        if (text) values.push({ value: text });
      } else if (data.type === 'wikibase-entityid' && data.value && data.value.id && isQid(data.value.id)) {
        values.push({ value: data.value.id, qid: data.value.id });
      } else if (data.type === 'time') {
        var formatted = formatTime(data.value);
        if (formatted) values.push({ value: formatted });
      }
    });
    return values;
  }

  function baseResult(op, checkedAt) {
    return {
      ok: true,
      op: op,
      checkedAt: checkedAt,
      source: { name: 'Wikidata', licence: 'CC0', page: 'https://www.wikidata.org/wiki/Wikidata:Licensing' },
      dataClass: 'public-wikidata',
      limitation: LICENCE_NOTE,
      complete: false,
      needsConfirm: false,
      ambiguous: false,
      noMatch: false,
      conflicts: [],
      candidates: [],
      entity: null,
      recordings: [],
      works: []
    };
  }

  function normalizeSearch(payload, checkedAt) {
    var result = baseResult('search', checkedAt);
    var rows = payload && Array.isArray(payload.search) ? payload.search : [];
    result.candidates = rows.slice(0, 8).map(function (row) {
      return {
        id: isQid(row && row.id) ? row.id : '',
        label: trim(row && (row.label || (row.display && row.display.label && row.display.label.value))) || 'Untitled item',
        description: trim(row && (row.description || (row.display && row.display.description && row.display.description.value))),
        source: 'Wikidata',
        licence: 'CC0',
        checkedAt: checkedAt
      };
    }).filter(function (row) { return row.id; });
    result.noMatch = result.candidates.length === 0;
    result.ambiguous = result.candidates.length > 1;
    result.needsConfirm = result.candidates.length > 0;
    if (result.noMatch) result.limitation = NO_MATCH;
    return result;
  }

  function linkedLabel(labels, qid) {
    if (!qid) return '';
    var pack = labels && labels[qid];
    var label = pack && pack.labels && pack.labels.en && pack.labels.en.value;
    return trim(label);
  }

  function normalizeEntity(payload, qid, checkedAt, labelMap) {
    var result = baseResult('entity', checkedAt);
    var entities = payload && payload.entities;
    var entity = entities && entities[qid];
    if (!entity || entity.missing === '') {
      result.noMatch = true;
      result.limitation = NO_MATCH;
      return result;
    }
    var label = trim(entity.labels && entity.labels.en && entity.labels.en.value) || qid;
    var description = trim(entity.descriptions && entity.descriptions.en && entity.descriptions.en.value);
    var fields = [
      field('label', 'Name', label, 'https://www.wikidata.org/wiki/' + qid, checkedAt, 'Preferred English label on Wikidata.'),
      field('id', 'Wikidata item', qid, 'https://www.wikidata.org/wiki/' + qid, checkedAt, '')
    ];
    if (description) fields.push(field('description', 'Description', description, '', checkedAt, 'Wikidata description, useful for telling same-name items apart. Not an identity by itself.'));
    var aliases = ((entity.aliases && entity.aliases.en) || []).map(function (alias) { return trim(alias && alias.value); }).filter(Boolean).slice(0, 8);
    aliases.forEach(function (alias, index) {
      fields.push(field('alias-' + index, 'Alias', alias, '', checkedAt, 'Alias listed on Wikidata. Not every name the artist has used.'));
    });
    if (((entity.aliases && entity.aliases.en) || []).length > aliases.length) {
      result.conflicts.push({ field: 'Alias', detail: 'Wikidata lists more aliases than this page shows. The list is capped. Nothing was dropped as wrong.' });
    }
    Object.keys(PROPS).forEach(function (prop) {
      var spec = PROPS[prop];
      var values = claimValues(entity.claims && entity.claims[prop]);
      if (!values.length) return;
      if (values.length > 1) {
        result.conflicts.push({ field: spec.label, detail: 'Wikidata returned more than one value. All returned values are shown. None is picked as the winner.' });
      }
      values.slice(0, 8).forEach(function (item, index) {
        var display = item.value;
        var href = '';
        if (spec.kind === 'url' && !isSafeHttpUrl(item.value)) return;
        if (spec.kind === 'item') {
          display = linkedLabel(labelMap, item.qid) || item.qid;
          href = hrefFor('item', item.qid);
          if (!linkedLabel(labelMap, item.qid)) {
            result.conflicts.push({ field: spec.label, detail: item.qid + ' is listed, and its English label did not load with this response.' });
          }
        } else {
          href = hrefFor(spec.kind, item.value);
        }
        fields.push(field(prop + '-' + index, spec.label, display, href, checkedAt, noteFor(spec.kind)));
      });
    });
    result.entity = { id: qid, label: label, description: description, fields: fields };
    result.needsConfirm = false;
    return result;
  }

  function qidFromUri(uri) {
    var match = String(uri || '').match(/\/(Q[1-9][0-9]{0,15})$/);
    return match ? match[1] : '';
  }

  function bindingValue(row, key) {
    var cell = row && row[key];
    return cell && cell.value ? trim(cell.value) : '';
  }

  function normalizeSparql(payload, op, checkedAt) {
    var result = baseResult(op, checkedAt);
    var rows = payload && payload.results && Array.isArray(payload.results.bindings) ? payload.results.bindings : [];
    var byId = {};
    var order = [];
    rows.forEach(function (row) {
      var id = qidFromUri(bindingValue(row, 'item'));
      if (!id) return;
      if (!byId[id]) {
        byId[id] = {
          id: id,
          label: bindingValue(row, 'itemLabel') || id,
          description: '',
          isrcs: [],
          iswcs: [],
          mbids: [],
          source: 'Wikidata',
          licence: 'CC0',
          checkedAt: checkedAt,
          href: 'https://www.wikidata.org/wiki/' + id
        };
        order.push(id);
      }
      var item = byId[id];
      var isrc = canonicalIsrc(bindingValue(row, 'isrc'));
      var iswc = canonicalIswc(bindingValue(row, 'iswc'));
      var mb = canonicalMbid(bindingValue(row, 'mb'));
      if (isrc && item.isrcs.indexOf(isrc) === -1) item.isrcs.push(isrc);
      if (iswc && item.iswcs.indexOf(iswc) === -1) item.iswcs.push(iswc);
      if (mb && item.mbids.indexOf(mb) === -1) item.mbids.push(mb);
    });
    var items = order.slice(0, 12).map(function (id) { return byId[id]; });
    if (op === 'recordings' || op === 'isrc') result.recordings = items;
    else if (op === 'works' || op === 'iswc') result.works = items;
    else result.candidates = items.map(function (item) {
      return { id: item.id, label: item.label, description: item.mbids[0] ? 'MusicBrainz artist ID ' + item.mbids[0] : 'Wikidata item', source: 'Wikidata', licence: 'CC0', checkedAt: checkedAt, mbids: item.mbids };
    });
    var bucket = result.recordings.length ? result.recordings : result.works.length ? result.works : result.candidates;
    result.noMatch = bucket.length === 0;
    result.ambiguous = bucket.length > 1 && (op === 'isrc' || op === 'iswc' || op === 'mbid' || op === 'store');
    result.needsConfirm = (op === 'mbid' || op === 'store') && bucket.length > 0;
    if (items.length && order.length > items.length) {
      result.conflicts.push({ field: 'Results', detail: 'This query returned more rows than the page shows. The list is the first 12 items, not a full catalogue.' });
    }
    if (result.noMatch) result.limitation = NO_MATCH;
    return result;
  }

  function collectItemQids(payload, qid) {
    var entity = payload && payload.entities && payload.entities[qid];
    var found = [];
    if (!entity || !entity.claims) return found;
    Object.keys(PROPS).forEach(function (prop) {
      if (PROPS[prop].kind !== 'item') return;
      claimValues(entity.claims[prop]).forEach(function (item) {
        if (item.qid && found.indexOf(item.qid) === -1 && found.length < 15) found.push(item.qid);
      });
    });
    return found;
  }

  function actionUrl(params) {
    var url = new URL('https://www.wikidata.org/w/api.php');
    Object.keys(params).forEach(function (key) { url.searchParams.set(key, params[key]); });
    url.searchParams.set('format', 'json');
    url.searchParams.set('maxlag', '5');
    url.searchParams.set('origin', '*');
    return url.toString();
  }

  function requestFor(seed, extra) {
    extra = extra || {};
    if (extra.op === 'entity' && isQid(extra.q)) {
      return { op: 'entity', url: actionUrl({ action: 'wbgetentities', ids: extra.q, props: 'labels|descriptions|aliases|claims', languages: 'en' }), q: extra.q };
    }
    if ((extra.op === 'recordings' || extra.op === 'works') && isQid(extra.q)) {
      return { op: extra.op, url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql(extra.op, extra.q)), q: extra.q };
    }
    if (!seed || !seed.ok) return null;
    if (seed.op === 'search') return { op: 'search', url: actionUrl({ action: 'wbsearchentities', search: seed.q, language: 'en', type: 'item', limit: '8' }), q: seed.q };
    if (seed.op === 'entity') return { op: 'entity', url: actionUrl({ action: 'wbgetentities', ids: seed.q, props: 'labels|descriptions|aliases|claims', languages: 'en' }), q: seed.q };
    if (seed.op === 'isrc' || seed.op === 'iswc' || seed.op === 'mbid' || seed.op === 'store') {
      return { op: seed.op, url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql(seed.op, seed.q, seed.platform)), q: seed.q, platform: seed.platform || '' };
    }
    return null;
  }

  function sparql(op, value, platform) {
    if (op === 'isrc' && canonicalIsrc(value)) {
      return 'SELECT ?item ?itemLabel ?isrc ?mb WHERE { ?item wdt:P1243 "' + canonicalIsrc(value) + '". OPTIONAL { ?item wdt:P436 ?mb } BIND("' + canonicalIsrc(value) + '" AS ?isrc) SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 8';
    }
    if (op === 'iswc' && canonicalIswc(value)) {
      return 'SELECT ?item ?itemLabel ?iswc ?mb WHERE { ?item wdt:P1827 "' + canonicalIswc(value) + '". OPTIONAL { ?item wdt:P435 ?mb } BIND("' + canonicalIswc(value) + '" AS ?iswc) SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 8';
    }
    if (op === 'mbid' && canonicalMbid(value)) {
      return 'SELECT ?item ?itemLabel ?mb WHERE { ?item wdt:P434 "' + canonicalMbid(value) + '". BIND("' + canonicalMbid(value) + '" AS ?mb) SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 8';
    }
    if (op === 'store') {
      var prop = platform === 'spotify' ? 'P1902' : platform === 'apple' ? 'P2850' : platform === 'deezer' ? 'P2722' : '';
      if (!prop || !/^[A-Za-z0-9]{1,40}$/.test(value)) return '';
      return 'SELECT ?item ?itemLabel ?mb WHERE { ?item wdt:' + prop + ' "' + value + '". OPTIONAL { ?item wdt:P434 ?mb } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 8';
    }
    if (op === 'recordings' && isQid(value)) {
      return 'SELECT ?item ?itemLabel ?isrc ?mb WHERE { ?item wdt:P175 wd:' + value + '. ?item wdt:P1243 ?isrc. OPTIONAL { ?item wdt:P436 ?mb } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 12';
    }
    if (op === 'works' && isQid(value)) {
      return 'SELECT ?item ?itemLabel ?iswc ?mb WHERE { { ?item wdt:P86 wd:' + value + ' } UNION { ?item wdt:P676 wd:' + value + ' } OPTIONAL { ?item wdt:P1827 ?iswc } OPTIONAL { ?item wdt:P435 ?mb } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 12';
    }
    return '';
  }

  function musicBrainzPath(url) {
    var path = url.pathname.replace(/\/+$/, '');
    var inc = url.searchParams.get('inc') || '';
    if (/tag|rating|annotation|genre|user-/.test(inc)) return false;
    if (path === '/ws/2/artist') return true;
    if (/^\/ws\/2\/artist\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(path)) return true;
    if (path !== '/ws/2/work' && path !== '/ws/2/recording') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(url.searchParams.get('artist') || '');
  }

  function discogsPath(url) {
    var path = url.pathname.replace(/\/+$/, '');
    if (path === '/database/search') return url.searchParams.get('type') === 'artist';
    return /^\/artists\/[1-9][0-9]{0,11}$/.test(path);
  }

  function allowedFetchUrl(value) {
    var url = parseHttpUrl(value, 2500);
    if (!url) return false;
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    if (url.hostname === 'www.wikidata.org' && url.pathname === '/w/api.php') return true;
    if (url.hostname === 'query.wikidata.org' && url.pathname === '/sparql') return true;
    if (url.hostname === 'musicbrainz.org' && musicBrainzPath(url)) return true;
    if (url.hostname === 'api.discogs.com' && discogsPath(url)) return true;
    return false;
  }

  function classifyStatus(status) {
    if (status === 429) return 'rate-limit';
    if (status === 503) return 'busy';
    if (status === 400) return 'invalid';
    if (status === 404) return 'unavailable';
    if (!status) return 'offline';
    return 'offline';
  }

  function failure(statusName, http) {
    var messages = {
      'rate-limit': 'Wikidata asked for a slower pace. Wait a moment and try again. Nothing was filled in with a guess.',
      busy: 'Wikidata did not answer in time, or it is under load. Try again later. Manual links still open in your browser.',
      offline: 'The lookup did not reach Wikidata. This can be an offline network or a block. Manual links still open in your browser.',
      unavailable: 'Live lookup is not available on this server. Manual links still open in your browser.',
      invalid: 'That entry is not a supported name, MusicBrainz ID, store artist link, ISRC, or ISWC.'
    };
    return { ok: false, status: statusName, http: http || 0, message: messages[statusName] || messages.offline, candidates: [], entity: null, recordings: [], works: [] };
  }

  function accountKey(email) {
    var text = trim(email).toLowerCase();
    if (!text || text.indexOf('@') === -1 || text.length > 200) return '';
    var a = 2166136261;
    var b = 5381;
    for (var i = 0; i < text.length; i += 1) {
      a ^= text.charCodeAt(i);
      a = Math.imul(a, 16777619);
      b = Math.imul(b, 33) + text.charCodeAt(i);
    }
    return 'u' + (a >>> 0).toString(16) + (b >>> 0).toString(16);
  }

  function blankState(state) {
    var name = state === 'self-report' || state === 'pending' || state === 'unknown' ? state : 'unknown';
    return { state: name, source: '', checkedAt: '', note: '' };
  }

  function cleanState(input) {
    var state = blankState(input && input.state);
    if (state.state === 'self-report') {
      state.source = 'Self-report by the signed-in artist, kept on this browser only.';
      state.note = 'Not checked against a registry.';
} else if (state.state === 'pending') {
      state.source = 'Marked pending by the signed-in artist, kept on this browser only.';
      state.note = 'Not confirmation that a registry received it.';
    }
    return state;
  }

  function cleanNote(input) {
  var role = input && (input.role === 'cover' || input.role === 'original') ? input.role : 'unknown';
  var kind = input && input.kind === 'composition' ? 'composition' : 'recording';
  var isrc = canonicalIsrc(input && input.isrc);
  var iswc = canonicalIswc(input && input.iswc);
  var mbid = canonicalMbid(input && input.mbid);
  var wikidataId = isQid(input && input.wikidataId) ? input.wikidataId : '';
  return {
    id: trim(input && input.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40),
    title: trim(input && input.title).slice(0, 200),
    kind: kind,
    role: role,
    isrc: isrc,
    iswc: iswc,
    mbid: mbid,
    wikidataId: wikidataId,
    released: kind === 'recording' ? cleanState(input && input.released) : blankState('unknown'),
    registration: cleanState(input && input.registration),
    agreement: cleanState(input && input.agreement),
    lookupNote: trim(input && input.lookupNote).slice(0, 240)
  };
}

  function notesKey(email) {
    var key = accountKey(email);
    return key ? NOTES_PREFIX + key : '';
  }

  function loadNotes(storage, email) {
    var key = notesKey(email);
    if (!key || !storage) return [];
    var raw = '';
    try { raw = storage.getItem(key) || ''; } catch (err) { return []; }
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.owner !== accountKey(email) || !Array.isArray(parsed.items)) return [];
      return parsed.items.map(cleanNote).filter(function (item) { return item.title && item.id; }).slice(0, MAX_NOTES);
    } catch (err) {
      return [];
    }
  }

  function saveNotes(storage, email, items) {
    var key = notesKey(email);
    if (!key || !storage) return { ok: false, reason: 'signed-out' };
    var clean = (items || []).map(cleanNote).filter(function (item) { return item.title && item.id; }).slice(0, MAX_NOTES);
    var owner = accountKey(email);
    try {
      storage.setItem(key, JSON.stringify({ owner: owner, items: clean }));
    } catch (err) {
      return { ok: false, reason: 'storage' };
    }
    return { ok: true, items: clean };
  }

  function meterSummary(items) {
    function tally(rows, key) {
      var counts = { documented: 0, 'self-report': 0, pending: 0, unknown: 0, total: rows.length };
      rows.forEach(function (row) {
        var state = row[key] && row[key].state;
        if (!Object.prototype.hasOwnProperty.call(counts, state)) state = 'unknown';
        counts[state] += 1;
      });
      return counts;
    }
    var recordings = (items || []).filter(function (item) { return item.kind === 'recording'; });
    var compositions = (items || []).filter(function (item) { return item.kind === 'composition' && item.role !== 'cover'; });
    return {
      released: tally(recordings, 'released'),
      registration: tally(compositions, 'registration'),
      agreement: tally(compositions, 'agreement'),
      coversLeftOut: (items || []).filter(function (item) { return item.kind === 'composition' && item.role === 'cover'; }).length
    };
  }

  function parseCatalogPaste(text) {
    var raw = String(text || '');
    if (/royalt|earning|payment|statement|bank|ssn|tax\s*id|routing/i.test(raw)) {
      return { ok: false, reason: 'This paste looks like a royalty or payment statement. The research portal does not take those files.' };
    }
    if (raw.length > 8000) return { ok: false, reason: 'Paste a shorter list. Forty lines is the limit.' };
    var lines = raw.split(/\r?\n/).map(function (line) { return trim(line); }).filter(Boolean).slice(0, MAX_PASTE);
    var items = [];
    lines.forEach(function (line, index) {
      var bits = line.split('|').map(function (bit) { return trim(bit); });
      var title = bits[0];
      if (!title || /^title$/i.test(title)) return;
      var isrc = '';
      var iswc = '';
      var role = 'unknown';
      bits.slice(1).forEach(function (bit) {
        if (canonicalIsrc(bit)) isrc = canonicalIsrc(bit);
        else if (canonicalIswc(bit)) iswc = canonicalIswc(bit);
        else if (/^cover$/i.test(bit)) role = 'cover';
        else if (/^original$/i.test(bit)) role = 'original';
      });
      items.push(cleanNote({
        id: 'paste' + index + title.length,
        title: title,
        kind: iswc && !isrc ? 'composition' : 'recording',
        role: role,
        isrc: isrc,
        iswc: iswc
      }));
    });
    return { ok: true, items: items };
  }

  function evidenceFromEntity(entity, checkedAt) {
    var evidence = { isrc: '', iswc: '', mbid: '', wikidataId: entity && entity.id || '' };
    var role = 'unknown';
    (entity && entity.fields || []).forEach(function (item) {
      if (item.id.indexOf('P1243') === 0 && !evidence.isrc) evidence.isrc = canonicalIsrc(item.value);
      if (item.id.indexOf('P1827') === 0 && !evidence.iswc) evidence.iswc = canonicalIswc(item.value);
      if (item.id.indexOf('P436') === 0 && !evidence.mbid) evidence.mbid = canonicalMbid(item.value);
      if (item.id.indexOf('P435') === 0 && !evidence.mbid) evidence.mbid = canonicalMbid(item.value);
      if (item.id.indexOf('P31') === 0 && /cover/i.test(item.value)) role = 'cover';
    });
    return { evidence: evidence, role: role, checkedAt: checkedAt || '' };
  }

  return {
    LICENCE_NOTE: LICENCE_NOTE,
    MB_NOTE: MB_NOTE,
    NO_MATCH: NO_MATCH,
    PROPS: PROPS,
    trim: trim,
    escapeHtml: escapeHtml,
    isSafeHttpUrl: isSafeHttpUrl,
    parseSeed: parseSeed,
    manualLinks: manualLinks,
    normalizeSearch: normalizeSearch,
    normalizeEntity: normalizeEntity,
    normalizeSparql: normalizeSparql,
    collectItemQids: collectItemQids,
    requestFor: requestFor,
    allowedFetchUrl: allowedFetchUrl,
    classifyStatus: classifyStatus,
    failure: failure,
    accountKey: accountKey,
    loadNotes: loadNotes,
    saveNotes: saveNotes,
    cleanNote: cleanNote,
    meterSummary: meterSummary,
    parseCatalogPaste: parseCatalogPaste,
    evidenceFromEntity: evidenceFromEntity,
    canonicalIsrc: canonicalIsrc,
    canonicalIswc: canonicalIswc,
    canonicalMbid: canonicalMbid
  };
});
