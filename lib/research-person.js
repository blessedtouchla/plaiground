'use strict';

const research = require('./research-portal');

const DISCLAIMER = 'Public credits and registrations. Not proof of ownership, and not who gets paid. Royalty payments are private. A missing result does not mean no rights.';
const SAMPLE_NOTE = 'A sample of what these public sources returned, not the whole public record.';
const ROLE_LABELS = {
  composer: 'composer',
  lyricist: 'lyricist',
  writer: 'writer',
  librettist: 'librettist',
  arranger: 'arranger',
  orchestrator: 'orchestrator',
  producer: 'producer',
  vocal: 'vocal',
  instrument: 'performer'
};
const LINK_TYPE = /official homepage|official site|^blog$|social network|bandcamp|soundcloud|youtube|wikidata|discogs|wikipedia|imdb|allmusic/i;

function trim(value) {
  return research.trim(value);
}

function foldName(value) {
  return trim(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function canonicalIpi(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 11) return '';
  const padded = digits.padStart(11, '0');
  if (/^0+$/.test(padded)) return '';
  return padded;
}

function badText(value) {
  return /[\u0000-\u001f<>]/.test(value) || /:\/\//.test(value);
}

function parsePerson(input) {
  const first = trim(input && input.first).slice(0, 40);
  const last = trim(input && input.last).slice(0, 40);
  const artist = trim(input && input.artist).slice(0, 80);
  const ipiRaw = trim(input && input.ipi);
  if (!first || !last || first.length + last.length < 3) return { ok: false, reason: 'invalid' };
  if (badText(first) || badText(last) || badText(artist)) return { ok: false, reason: 'invalid' };
  if (ipiRaw && !canonicalIpi(ipiRaw)) return { ok: false, reason: 'invalid' };
  return {
    ok: true,
    first: first,
    last: last,
    artist: artist,
    ipi: canonicalIpi(ipiRaw),
    label: (first + ' ' + last).slice(0, 80)
  };
}

function parseProfile(input) {
  const mbid = research.canonicalMbid(input && input.mbid);
  const qid = /^Q[1-9][0-9]{0,15}$/.test(String(input && input.qid || '')) ? String(input.qid) : '';
  const discogsId = String(input && input.discogsId || '').replace(/\D/g, '');
  const discogs = /^[1-9][0-9]{0,11}$/.test(discogsId) ? discogsId : '';
  if (!mbid && !qid && !discogs) return { ok: false, reason: 'invalid' };
  return { ok: true, mbid: mbid, qid: qid, discogsId: discogs };
}

function lucenePhrase(value) {
  return '"' + trim(value).replace(/["\\]/g, ' ') + '"';
}

function sparqlString(value) {
  return trim(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function personQuery(person) {
  const name = lucenePhrase(person.first + ' ' + person.last);
  const parts = ['artist:' + name, 'alias:' + name];
  if (person.artist) {
    const stage = lucenePhrase(person.artist);
    parts.push('artist:' + stage, 'alias:' + stage);
  }
  if (person.ipi) parts.push('ipi:' + person.ipi);
  return '(' + parts.join(' OR ') + ') AND type:person';
}

function wikidataSearchQuery(person) {
  const name = sparqlString(person.label);
  const byName = 'SERVICE wikibase:mwapi { bd:serviceParam wikibase:api "EntitySearch"; wikibase:endpoint "www.wikidata.org"; mwapi:search "' + name + '"; mwapi:language "en". ?item wikibase:apiOutputItem mwapi:item. }';
  const where = person.ipi
    ? '{ ' + byName + ' } UNION { ?item wdt:P1828 "' + person.ipi + '" }'
    : byName;
  return 'SELECT ?item ?itemLabel ?itemDescription ?mb ?ipi ?discogs WHERE { ' + where + ' OPTIONAL { ?item wdt:P434 ?mb } OPTIONAL { ?item wdt:P1828 ?ipi } OPTIONAL { ?item wdt:P1953 ?discogs } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 30';
}

function creditQuery(qid) {
  function slice(prop, role) {
    return '{ SELECT ?item ?role WHERE { ?item wdt:' + prop + ' wd:' + qid + '. BIND("' + role + '" AS ?role) } LIMIT 3 }';
  }
  return 'SELECT ?item ?itemLabel ?role WHERE { ' + [
    slice('P86', 'composer'),
    slice('P676', 'lyricist'),
    slice('P162', 'producer'),
    slice('P175', 'performer')
  ].join(' UNION ') + ' SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }';
}

function planSearch(input) {
  const person = parsePerson(input);
  if (!person.ok) return null;
  const mb = new URL('https://musicbrainz.org/ws/2/artist');
  mb.searchParams.set('query', personQuery(person));
  mb.searchParams.set('fmt', 'json');
  mb.searchParams.set('limit', '6');
  const discogs = new URL('https://api.discogs.com/database/search');
  discogs.searchParams.set('type', 'artist');
  discogs.searchParams.set('per_page', '5');
  discogs.searchParams.set('q', person.artist ? (person.label + ' ' + person.artist) : person.label);
  return {
    op: 'person',
    q: person.label,
    person: person,
    requests: [
      { key: 'musicbrainz', url: mb.toString() },
      { key: 'wikidata', url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(wikidataSearchQuery(person)) },
      { key: 'discogs', url: discogs.toString() }
    ]
  };
}

function planDetail(op, input) {
  const profile = parseProfile(input);
  if (!profile.ok || (op !== 'person-profile' && op !== 'person-credits')) return null;
  const requests = [];
  if (op === 'person-profile') {
    if (profile.mbid) {
      requests.push({
        key: 'musicbrainz',
        url: 'https://musicbrainz.org/ws/2/artist/' + profile.mbid + '?inc=aliases+url-rels+artist-rels&fmt=json'
      });
    }
    if (profile.discogsId) requests.push({ key: 'discogs', url: 'https://api.discogs.com/artists/' + profile.discogsId });
    if (profile.qid) {
      requests.push({
        key: 'wikidata',
        url: 'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' + profile.qid + '&props=labels|descriptions|aliases|claims&languages=en&format=json&maxlag=5'
      });
    }
  } else {
    if (profile.mbid) {
      requests.push({
        key: 'works',
        url: 'https://musicbrainz.org/ws/2/work?artist=' + profile.mbid + '&inc=artist-rels&limit=10&fmt=json'
      });
    }
    if (profile.qid) {
      requests.push({
        key: 'wikidata',
        url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(creditQuery(profile.qid))
      });
    }
  }
  if (!requests.length) return null;
  return { op: op, q: [profile.mbid, profile.qid, profile.discogsId].filter(Boolean).join('|'), profile: profile, requests: requests };
}

function registryLinks(name, ipi) {
  const q = trim(name).slice(0, 120);
  if (!q || badText(q)) return [];
  const bmi = new URL('https://repertoire.bmi.com/Search/Search');
  bmi.searchParams.set('SearchForm.Main_Search', 'Writer/Composer');
  bmi.searchParams.set('SearchForm.Main_Search_Text', q);
  bmi.searchParams.set('SearchForm.Search_Type', 'all');
  const mlc = new URL('https://portal.themlc.com/search');
  mlc.searchParams.set('writerFullNames', q);
  mlc.searchParams.set('fullName', q);
  if (ipi) {
    mlc.searchParams.set('writerNameNumbers', ipi);
    mlc.searchParams.set('ipiNameNumber', ipi);
  }
  const encoded = encodeURIComponent(q);
  const links = [
    {
      id: 'bmi',
      label: 'BMI repertoire search',
      href: bmi.toString(),
      limitation: 'Opens BMI with this name filled in. A listing is a registered claim, not proof of who is paid. Results stay on their site.'
    },
    {
      id: 'ascap',
      label: 'ASCAP repertory search',
      href: 'https://www.ascap.com/repertory#/ace/search/writer/' + encoded + '?searchFilter=ACE',
      limitation: 'Opens ASCAP with this writer name filled in. A listing is a claim, not a chain of title. Results stay on their site.'
    },
    {
      id: 'songview',
      label: 'Songview writer search',
      href: 'https://www.ascap.com/repertory#/ace/search/writer/' + encoded + '?searchFilter=SVW',
      limitation: 'Opens the Songview view with this name filled in. Shared claim data, not a payment. Results stay on their site.'
    },
    {
      id: 'mlc',
      label: 'The MLC public search',
      href: mlc.toString(),
      limitation: 'Opens The MLC public search with this name filled in. Their data API needs an enrollment, so nothing is copied here. A miss is not an unregistered work.'
    }
  ];
  if (ipi) {
    links.push({
      id: 'ascap-ipi',
      label: 'ASCAP writer catalog for this IPI',
      href: 'https://www.ascap.com/repertory#/ace/writer/' + ipi,
      limitation: 'Opens the ASCAP writer page for this IPI. Confirm it is the same person. Results stay on their site.'
    });
  }
  return links.filter(function (link) { return research.isSafeHttpUrl(link.href); });
}

function sourceRow(id, status, note) {
  return { id: id, status: status, note: note };
}

function sourceStatus(payload, error, empty) {
  if (error === 'blocked' || error === 401 || error === 403) return 'blocked';
  if (error === 'rate-limit') return 'rate-limit';
  if (error === 'busy' || error === 'unavailable') return 'busy';
  if (error) return 'offline';
  if (payload && payload.error) return 'busy';
  if (empty) return 'empty';
  return 'ok';
}

function pushAlias(list, alias) {
  const name = trim(alias && alias.name).slice(0, 160);
  if (!name || badText(name)) return;
  const type = trim(alias.type).slice(0, 40) || 'Alias';
  const key = foldName(name) + '|' + type.toLowerCase();
  if (list.some(function (row) { return row.key === key; })) return;
  const href = research.isSafeHttpUrl(alias.href) ? alias.href : '';
  const sourceUrl = research.isSafeHttpUrl(alias.sourceUrl) ? alias.sourceUrl : href;
  list.push({
    key: key,
    name: name,
    type: type,
    source: trim(alias.source).slice(0, 40),
    href: href,
    sourceUrl: sourceUrl
  });
}

function publicAlias(row) {
  return { name: row.name, type: row.type, source: row.source, href: row.href, sourceUrl: row.sourceUrl };
}

function namesOf(candidate) {
  return [candidate.name, candidate.sortName].concat(candidate.aliases.map(function (alias) { return alias.name; }));
}

function matchesName(candidate, forms) {
  const folds = namesOf(candidate).map(foldName).filter(Boolean);
  return forms.some(function (form) { return form && folds.indexOf(form) !== -1; });
}

function blankCandidate(id) {
  return {
    id: id,
    name: '',
    sortName: '',
    disambiguation: '',
    kind: '',
    ipis: [],
    aliases: [],
    profiles: [],
    links: [],
    mbid: '',
    qid: '',
    discogsId: '',
    facts: [],
    score: 0
  };
}

function addIpi(candidate, value) {
  const ipi = canonicalIpi(value);
  if (ipi && candidate.ipis.indexOf(ipi) === -1 && candidate.ipis.length < 6) candidate.ipis.push(ipi);
}

function addProfile(candidate, profile) {
  if (!profile || !research.isSafeHttpUrl(profile.href)) return;
  if (candidate.profiles.some(function (row) { return row.href === profile.href; })) return;
  candidate.profiles.push({
    label: trim(profile.label).slice(0, 80),
    href: profile.href,
    source: trim(profile.source).slice(0, 40)
  });
}

function addFact(candidate, fact, checkedAt) {
  const value = trim(fact && fact.value).slice(0, 200);
  if (!value) return;
  candidate.facts.push({
    label: trim(fact.label).slice(0, 80),
    value: value,
    href: research.isSafeHttpUrl(fact.href) ? fact.href : '',
    source: trim(fact.source).slice(0, 40),
    sourceUrl: research.isSafeHttpUrl(fact.sourceUrl) ? fact.sourceUrl : '',
    checkedAt: checkedAt
  });
}

function mbArtistUrl(mbid) {
  return 'https://musicbrainz.org/artist/' + mbid;
}

function absorbMusicBrainzArtist(candidate, artist, checkedAt) {
  if (!artist || !artist.id) return;
  const mbid = research.canonicalMbid(artist.id);
  if (!mbid) return;
  candidate.mbid = mbid;
  candidate.name = candidate.name || trim(artist.name);
  candidate.sortName = candidate.sortName || trim(artist['sort-name']);
  candidate.disambiguation = candidate.disambiguation || trim(artist.disambiguation);
  candidate.kind = candidate.kind || trim(artist.type) || 'Person';
  candidate.score = Math.max(candidate.score, Number(artist.score) || 0);
  (artist.ipis || []).forEach(function (ipi) { addIpi(candidate, ipi); });
  addProfile(candidate, { label: 'MusicBrainz', href: mbArtistUrl(mbid), source: 'MusicBrainz' });
  (artist.aliases || []).forEach(function (alias) {
    pushAlias(candidate.aliases, {
      name: alias.name,
      type: alias.type || 'Alias',
      source: 'MusicBrainz',
      href: mbArtistUrl(mbid),
      sourceUrl: mbArtistUrl(mbid)
    });
  });
  if (artist.country) addFact(candidate, { label: 'Country code', value: artist.country, source: 'MusicBrainz', sourceUrl: mbArtistUrl(mbid) }, checkedAt);
  const area = artist.area && artist.area.name;
  if (area) addFact(candidate, { label: 'Area', value: area, source: 'MusicBrainz', sourceUrl: mbArtistUrl(mbid) }, checkedAt);
  (artist.relations || []).forEach(function (rel) {
    const other = rel && rel.artist;
    const otherId = research.canonicalMbid(other && other.id);
    if (!otherId || otherId === mbid) return;
    const type = trim(rel.type);
    const direction = trim(rel.direction);
    let label = '';
    if (type === 'performance name' && direction === 'forward') label = 'performs as';
    else if (type === 'performance name' && direction === 'backward') label = 'legal name';
    else if (type === 'legal name' && direction !== 'backward') label = 'legal name';
    else if (type === 'legal name') label = 'performs as';
    else if (type === 'member of band') label = 'member of';
    if (!label) return;
    pushAlias(candidate.aliases, {
      name: other.name,
      type: label,
      source: 'MusicBrainz',
      href: mbArtistUrl(otherId),
      sourceUrl: mbArtistUrl(mbid) + '/relationships'
    });
  });
  (artist.relations || []).forEach(function (rel) {
    const url = rel && rel.url && rel.url.resource;
    const type = trim(rel && rel.type);
    if (!url || !LINK_TYPE.test(type) || !research.isSafeHttpUrl(url)) return;
    if (candidate.links.some(function (link) { return link.href === url && link.source === 'MusicBrainz'; })) return;
    if (candidate.links.length >= 10) return;
    candidate.links.push({
      label: type,
      href: url,
      source: 'MusicBrainz',
      sourceUrl: mbArtistUrl(mbid)
    });
  });
}

function qidOf(uri) {
  const match = String(uri || '').match(/Q[1-9][0-9]{0,15}$/);
  return match ? match[0] : '';
}

function groupWikidata(payload) {
  const rows = (((payload || {}).results || {}).bindings) || [];
  const byId = {};
  rows.forEach(function (row) {
    const qid = qidOf(row.item && row.item.value);
    if (!qid) return;
    const item = byId[qid] || { qid: qid, label: '', description: '', mbids: [], ipis: [], discogs: [] };
    item.label = item.label || trim(row.itemLabel && row.itemLabel.value);
    item.description = item.description || trim(row.itemDescription && row.itemDescription.value);
    const mb = research.canonicalMbid(row.mb && row.mb.value);
    const ipi = canonicalIpi(row.ipi && row.ipi.value);
    const discogs = String(row.discogs && row.discogs.value || '').replace(/\D/g, '');
    if (mb && item.mbids.indexOf(mb) === -1) item.mbids.push(mb);
    if (ipi && item.ipis.indexOf(ipi) === -1) item.ipis.push(ipi);
    if (/^[1-9][0-9]{0,11}$/.test(discogs) && item.discogs.indexOf(discogs) === -1) item.discogs.push(discogs);
    byId[qid] = item;
  });
  return Object.keys(byId).map(function (id) { return byId[id]; }).filter(function (item) {
    return !/disambiguation page/i.test(item.description || '');
  });
}

function absorbWikidata(candidate, item, checkedAt) {
  const href = 'https://www.wikidata.org/wiki/' + item.qid;
  candidate.qid = candidate.qid || item.qid;
  candidate.name = candidate.name || item.label;
  candidate.disambiguation = candidate.disambiguation || item.description;
  item.ipis.forEach(function (ipi) { addIpi(candidate, ipi); });
  if (item.discogs[0] && !candidate.discogsId) candidate.discogsId = item.discogs[0];
  addProfile(candidate, { label: 'Wikidata', href: href, source: 'Wikidata' });
  if (item.description) addFact(candidate, { label: 'Description', value: item.description, source: 'Wikidata', sourceUrl: href }, checkedAt);
  item.discogs.forEach(function (id) {
    addProfile(candidate, { label: 'Discogs', href: 'https://www.discogs.com/artist/' + id, source: 'Wikidata' });
  });
}

function discogsTitle(result) {
  return trim(result && result.title).replace(/\s+\(\d+\)$/, '');
}

function absorbDiscogsSearch(candidate, result) {
  const id = String(result && result.id || '').replace(/\D/g, '');
  if (!/^[1-9][0-9]{0,11}$/.test(id)) return;
  candidate.discogsId = candidate.discogsId || id;
  candidate.name = candidate.name || discogsTitle(result);
  candidate.kind = candidate.kind || 'Discogs artist';
  const uri = trim(result.uri);
  const href = uri.charAt(0) === '/' ? 'https://www.discogs.com' + uri : ('https://www.discogs.com/artist/' + id);
  addProfile(candidate, { label: 'Discogs', href: href, source: 'Discogs' });
}

function absorbDiscogsArtist(candidate, artist) {
  if (!artist || !artist.id) return;
  const id = String(artist.id);
  const page = 'https://www.discogs.com/artist/' + id;
  candidate.discogsId = id;
  candidate.name = candidate.name || trim(artist.name);
  addProfile(candidate, { label: 'Discogs', href: page, source: 'Discogs' });
  if (artist.realname) {
    pushAlias(candidate.aliases, { name: artist.realname, type: 'real name', source: 'Discogs', href: page, sourceUrl: page });
  }
  (artist.namevariations || []).slice(0, 12).forEach(function (name) {
    pushAlias(candidate.aliases, { name: name, type: 'name variation', source: 'Discogs', href: page, sourceUrl: page });
  });
  (artist.aliases || []).slice(0, 8).forEach(function (alias) {
    const aliasId = String(alias.id || '').replace(/\D/g, '');
    pushAlias(candidate.aliases, {
      name: alias.name,
      type: 'alias profile',
      source: 'Discogs',
      href: /^[1-9][0-9]{0,11}$/.test(aliasId) ? 'https://www.discogs.com/artist/' + aliasId : page,
      sourceUrl: page
    });
  });
  (artist.urls || []).forEach(function (url) {
    if (!research.isSafeHttpUrl(url) || candidate.links.length >= 10) return;
    if (candidate.links.some(function (link) { return link.href === url && link.source === 'Discogs'; })) return;
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (err) { host = ''; }
    if (!host || host === 'discogs.com') return;
    candidate.links.push({ label: host, href: url, source: 'Discogs', sourceUrl: page });
  });
}

function socialFromClaim(prop, value) {
  const text = trim(value);
  if (prop === 'P856') return research.isSafeHttpUrl(text) ? { label: 'Official website', href: text } : null;
  if (prop === 'P2002' && /^[A-Za-z0-9_]{1,15}$/.test(text)) return { label: 'X', href: 'https://x.com/' + text };
  if (prop === 'P2003' && /^[A-Za-z0-9._]{1,30}$/.test(text)) return { label: 'Instagram', href: 'https://www.instagram.com/' + text + '/' };
  if (prop === 'P2013' && /^[A-Za-z0-9.]{1,50}$/.test(text)) return { label: 'Facebook', href: 'https://www.facebook.com/' + text };
  if (prop === 'P2397' && /^[A-Za-z0-9_-]{10,40}$/.test(text)) return { label: 'YouTube', href: 'https://www.youtube.com/channel/' + text };
  if (prop === 'P345' && /^nm\d{5,10}$/.test(text)) return { label: 'IMDb', href: 'https://www.imdb.com/name/' + text + '/' };
  if (prop === 'P3040' && /^[A-Za-z0-9_-]{1,40}$/.test(text)) return { label: 'SoundCloud', href: 'https://soundcloud.com/' + text };
  return null;
}

function claimStrings(list) {
  const values = [];
  (list || []).forEach(function (claim) {
    const value = claim && claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.value;
    if (typeof value === 'string') values.push(value);
  });
  return values;
}

function absorbWikidataEntity(candidate, payload, qid, checkedAt) {
  const entity = payload && payload.entities && payload.entities[qid];
  if (!entity || entity.missing) return;
  const href = 'https://www.wikidata.org/wiki/' + qid;
  const label = trim(entity.labels && entity.labels.en && entity.labels.en.value);
  const description = trim(entity.descriptions && entity.descriptions.en && entity.descriptions.en.value);
  candidate.qid = qid;
  candidate.name = candidate.name || label;
  candidate.disambiguation = candidate.disambiguation || description;
  addProfile(candidate, { label: 'Wikidata', href: href, source: 'Wikidata' });
  ((entity.aliases && entity.aliases.en) || []).slice(0, 8).forEach(function (alias) {
    pushAlias(candidate.aliases, { name: alias.value, type: 'alias', source: 'Wikidata', href: href, sourceUrl: href });
  });
  claimStrings(entity.claims && entity.claims.P1828).forEach(function (ipi) { addIpi(candidate, ipi); });
  const mbids = claimStrings(entity.claims && entity.claims.P434).map(research.canonicalMbid).filter(Boolean);
  if (mbids[0] && !candidate.mbid) candidate.mbid = mbids[0];
  ['P856', 'P2002', 'P2003', 'P2013', 'P2397', 'P345', 'P3040'].forEach(function (prop) {
    claimStrings(entity.claims && entity.claims[prop]).forEach(function (value) {
      const link = socialFromClaim(prop, value);
      if (!link || candidate.links.some(function (row) { return row.href === link.href && row.source === 'Wikidata'; })) return;
      if (candidate.links.length >= 10) return;
      candidate.links.push({ label: link.label, href: link.href, source: 'Wikidata', sourceUrl: href });
    });
  });
  if (description) addFact(candidate, { label: 'Description', value: description, source: 'Wikidata', sourceUrl: href }, checkedAt);
}

function finishCandidate(candidate, person, exactCount, checkedAt) {
  const forms = [foldName(person.first + ' ' + person.last), foldName(person.last + ' ' + person.first)];
  const artistForm = foldName(person.artist);
  const nameMatch = matchesName(candidate, forms);
  const artistMatch = !!(artistForm && matchesName(candidate, [artistForm]));
  const ipiMatch = !!(person.ipi && candidate.ipis.indexOf(person.ipi) !== -1);
  let confidence = 'weak';
  let confidenceLabel = 'Weak match';
  let confidenceReason = 'The search touched this record, but the name is not an exact match.';
  if (ipiMatch && (nameMatch || artistMatch)) {
    confidence = 'high';
    confidenceLabel = 'High confidence';
    confidenceReason = 'The IPI matches this record, and the name lines up.';
  } else if (ipiMatch) {
    confidence = 'high';
    confidenceLabel = 'High confidence';
    confidenceReason = 'The IPI matches this record. Confirm the name before you rely on it.';
  } else if (nameMatch && artistMatch) {
    confidence = 'high';
    confidenceLabel = 'High confidence';
    confidenceReason = 'The name and the artist name both match this record.';
  } else if (nameMatch && exactCount === 1) {
    confidence = 'possible';
    confidenceLabel = 'Possible match';
    confidenceReason = 'Only one exact name came back. It is still a candidate until you confirm it.';
  } else if (nameMatch) {
    confidence = 'possible';
    confidenceLabel = 'Possible match';
    confidenceReason = 'This exact name is shared by more than one person in this result.';
  } else if (artistMatch) {
    confidence = 'possible';
    confidenceLabel = 'Possible match';
    confidenceReason = 'The artist name matches. The name on the record is different.';
  }
  candidate.ipis.forEach(function (ipi) {
    addFact(candidate, { label: 'IPI', value: ipi, source: candidate.mbid ? 'MusicBrainz' : 'Wikidata', sourceUrl: candidate.mbid ? mbArtistUrl(candidate.mbid) : ('https://www.wikidata.org/wiki/' + candidate.qid) }, checkedAt);
  });
  const registries = registryLinks(candidate.name || person.label, candidate.ipis[0] || person.ipi);
  return {
    id: candidate.id,
    name: candidate.name,
    sortName: candidate.sortName,
    disambiguation: candidate.disambiguation,
    kind: candidate.kind,
    confidence: confidence,
    confidenceLabel: confidenceLabel,
    confidenceReason: confidenceReason,
    ipis: candidate.ipis,
    aliases: candidate.aliases.map(publicAlias),
    profiles: candidate.profiles,
    links: candidate.links,
    credits: [],
    registries: registries,
    mbid: candidate.mbid,
    qid: candidate.qid,
    discogsId: candidate.discogsId,
    facts: candidate.facts.slice(0, 12),
    score: candidate.score,
    rank: confidence === 'high' ? 0 : confidence === 'possible' ? 1 : 2
  };
}

function normalizePersonSearch(pack, person, checkedAt) {
  pack = pack || {};
  const errors = pack.errors || {};
  const mbArtists = (pack.musicbrainz && pack.musicbrainz.artists) || [];
  const wdItems = groupWikidata(pack.wikidata);
  const discogsRows = (pack.discogs && pack.discogs.results) || [];
  const byMb = {};
  const list = [];
  mbArtists.forEach(function (artist) {
    const mbid = research.canonicalMbid(artist && artist.id);
    if (!mbid) return;
    const candidate = blankCandidate('mb:' + mbid);
    absorbMusicBrainzArtist(candidate, artist, checkedAt);
    byMb[mbid] = candidate;
    list.push(candidate);
  });
  wdItems.forEach(function (item) {
    const linked = item.mbids.map(function (mbid) { return byMb[mbid]; }).filter(Boolean)[0];
    const candidate = linked || blankCandidate('wd:' + item.qid);
    absorbWikidata(candidate, item, checkedAt);
    if (item.mbids[0]) candidate.mbid = candidate.mbid || item.mbids[0];
    if (!linked) list.push(candidate);
  });
  const nameOwners = {};
  list.forEach(function (candidate) {
    const key = foldName(candidate.name);
    if (!key) return;
    nameOwners[key] = nameOwners[key] || [];
    nameOwners[key].push(candidate);
  });
  discogsRows.forEach(function (row) {
    if (trim(row && row.type) && trim(row.type) !== 'artist') return;
    const id = String(row && row.id || '').replace(/\D/g, '');
    if (!/^[1-9][0-9]{0,11}$/.test(id)) return;
    const title = foldName(discogsTitle(row));
    const owners = title && nameOwners[title] && nameOwners[title].length === 1 ? nameOwners[title] : null;
    const byId = list.filter(function (candidate) { return candidate.discogsId === id; });
    const candidate = (byId[0]) || (owners && owners[0]) || blankCandidate('dc:' + id);
    absorbDiscogsSearch(candidate, row);
    if (list.indexOf(candidate) === -1) list.push(candidate);
  });
  const forms = [foldName(person.first + ' ' + person.last), foldName(person.last + ' ' + person.first)];
  const exactCount = list.filter(function (candidate) { return matchesName(candidate, forms); }).length;
  const ranked = list.map(function (candidate) {
    return finishCandidate(candidate, person, exactCount, checkedAt);
  }).sort(function (a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.mbid && !b.mbid) return -1;
    if (b.mbid && !a.mbid) return 1;
    return (b.score || 0) - (a.score || 0);
  }).slice(0, 6).map(function (candidate) {
    delete candidate.score;
    delete candidate.rank;
    return candidate;
  });
  const sources = [
    sourceRow('musicbrainz', sourceStatus(pack.musicbrainz, errors.musicbrainz, !mbArtists.length), 'MusicBrainz core data is CC0. This uses their public web service at one request a second. Commercial use of that service is something MusicBrainz asks products to support. No paid key is used here.'),
    sourceRow('wikidata', sourceStatus(pack.wikidata, errors.wikidata, !wdItems.length), 'Wikidata CC0.'),
    sourceRow('discogs', sourceStatus(pack.discogs, errors.discogs, !discogsRows.length), errors.discogs === 'blocked' ? 'Discogs search did not answer without a key, so name variations were not loaded.' : 'Discogs public API, no key. Name variations load on the artist record. Biography text is not copied.')
  ];
  const failed = sources.every(function (row) { return row.status !== 'ok' && row.status !== 'empty'; });
  return {
    ok: true,
    op: 'person',
    checkedAt: checkedAt,
    query: { first: person.first, last: person.last, ipi: person.ipi, artist: person.artist },
    disclaimer: DISCLAIMER,
    limitation: ranked.length ? SAMPLE_NOTE : (failed
      ? 'Those sources did not return a person. That is not proof nobody by this name has credits or registrations.'
      : 'No public person record came back for this search. That is not proof the person has no credits or registrations.'),
    sources: sources,
    candidates: ranked,
    noMatch: ranked.length === 0,
    registries: ranked.length ? [] : registryLinks(person.label, person.ipi)
  };
}

function normalizePersonProfile(pack, profile, checkedAt) {
  const candidate = blankCandidate(profile.mbid ? 'mb:' + profile.mbid : (profile.qid ? 'wd:' + profile.qid : 'dc:' + profile.discogsId));
  candidate.mbid = profile.mbid;
  candidate.qid = profile.qid;
  candidate.discogsId = profile.discogsId;
  if (pack.musicbrainz && !pack.musicbrainz.error) absorbMusicBrainzArtist(candidate, pack.musicbrainz, checkedAt);
  if (pack.discogs && !pack.discogs.error) absorbDiscogsArtist(candidate, pack.discogs);
  if (pack.wikidata && profile.qid) absorbWikidataEntity(candidate, pack.wikidata, profile.qid, checkedAt);
  const errors = pack.errors || {};
  return {
    ok: true,
    op: 'person-profile',
    checkedAt: checkedAt,
    id: candidate.id,
    mbid: candidate.mbid,
    qid: candidate.qid,
    discogsId: candidate.discogsId,
    name: candidate.name,
    disambiguation: candidate.disambiguation,
    kind: candidate.kind,
    ipis: candidate.ipis,
    aliases: candidate.aliases.map(publicAlias),
    profiles: candidate.profiles,
    links: candidate.links,
    facts: candidate.facts.slice(0, 12),
    disclaimer: DISCLAIMER,
    sources: [
      sourceRow('musicbrainz', profile.mbid ? sourceStatus(pack.musicbrainz, errors.musicbrainz, !(pack.musicbrainz && pack.musicbrainz.id)) : 'skipped', 'Aliases, artist relationships, and links MusicBrainz itself publishes.'),
      sourceRow('discogs', profile.discogsId ? sourceStatus(pack.discogs, errors.discogs, !(pack.discogs && pack.discogs.id)) : 'skipped', errors.discogs === 'blocked' ? 'Discogs did not answer without a key.' : 'Name variations and aliases from the Discogs artist record. Biography text is not copied.'),
      sourceRow('wikidata', profile.qid ? sourceStatus(pack.wikidata, errors.wikidata, false) : 'skipped', 'Official and social links only when Wikidata lists the identifier.')
    ]
  };
}

function creditRow(title, role, href, source, sourceUrl) {
  const name = trim(title).slice(0, 200);
  const safeHref = research.isSafeHttpUrl(href) ? href : '';
  if (!name || !role) return null;
  return {
    title: name,
    role: role,
    href: safeHref,
    source: source,
    sourceUrl: research.isSafeHttpUrl(sourceUrl) ? sourceUrl : safeHref
  };
}

function normalizePersonCredits(pack, profile, checkedAt) {
  const credits = [];
  const works = (pack.works && pack.works.works) || [];
  const workCount = pack.works && Number(pack.works['work-count']);
  works.forEach(function (work) {
    const href = work.id ? 'https://musicbrainz.org/work/' + work.id : '';
    const roles = {};
    (work.relations || []).forEach(function (rel) {
      const artistId = research.canonicalMbid(rel && rel.artist && rel.artist.id);
      if (profile.mbid && artistId && artistId !== profile.mbid) return;
      const raw = trim(rel && rel.type).toLowerCase();
      if (!ROLE_LABELS[raw]) return;
      const featured = (rel.attributes || []).some(function (attr) { return /guest|additional|featured/i.test(String(attr)); });
      const role = featured ? 'featured' : ROLE_LABELS[raw];
      roles[role] = true;
    });
    Object.keys(roles).forEach(function (role) {
      const row = creditRow(work.title, role, href, 'MusicBrainz', href);
      if (row) credits.push(row);
    });
  });
  const bindings = (((pack.wikidata || {}).results || {}).bindings) || [];
  bindings.forEach(function (row) {
    const qid = qidOf(row.item && row.item.value);
    const href = qid ? 'https://www.wikidata.org/wiki/' + qid : '';
    const credit = creditRow(row.itemLabel && row.itemLabel.value, trim(row.role && row.role.value), href, 'Wikidata', href);
    if (credit) credits.push(credit);
  });
  const seen = {};
  const unique = [];
  credits.forEach(function (credit) {
    const key = foldName(credit.title) + '|' + credit.role + '|' + credit.source;
    if (seen[key]) return;
    seen[key] = true;
    unique.push(credit);
  });
  const roleOrder = ['writer', 'composer', 'lyricist', 'producer', 'featured', 'performer', 'arranger', 'librettist', 'orchestrator', 'vocal'];
  const picked = [];
  const pickedKey = {};
  roleOrder.forEach(function (role) {
    let count = 0;
    unique.forEach(function (credit) {
      if (credit.role !== role || count >= 3 || picked.length >= 16) return;
      const key = foldName(credit.title) + '|' + credit.role + '|' + credit.source;
      if (pickedKey[key]) return;
      pickedKey[key] = true;
      picked.push(credit);
      count += 1;
    });
  });
  unique.forEach(function (credit) {
    if (picked.length >= 16) return;
    const key = foldName(credit.title) + '|' + credit.role + '|' + credit.source;
    if (pickedKey[key]) return;
    pickedKey[key] = true;
    picked.push(credit);
  });
  const errors = pack.errors || {};
  const shown = unique.length;
  let note = 'These are public credits in this sample, not a full catalog and not a payment record.';
  if (workCount && workCount > works.length) {
    note = 'MusicBrainz links ' + workCount + ' works. ' + works.length + ' are shown here. Open the artist page for the rest. ' + note;
  }
  return {
    ok: true,
    op: 'person-credits',
    checkedAt: checkedAt,
    id: profile.mbid ? 'mb:' + profile.mbid : (profile.qid ? 'wd:' + profile.qid : ''),
    credits: picked,
    shown: shown,
    workCount: workCount || 0,
    note: note,
    disclaimer: DISCLAIMER,
    sources: [
      sourceRow('musicbrainz', profile.mbid ? sourceStatus(pack.works, errors.works, !works.length) : 'skipped', 'Writer, composer, and lyricist roles from MusicBrainz work relationships. Producer and featured roles are included when that relationship is on a returned row.'),
      sourceRow('wikidata', profile.qid ? sourceStatus(pack.wikidata, errors.wikidata, !bindings.length) : 'skipped', 'Composer, lyricist, producer, and performer links Wikidata lists for this item.')
    ]
  };
}

function personFailure(statusName) {
  const messages = {
    'rate-limit': 'The lookup is pacing itself to one request a second. Wait a moment and try again. Nothing was guessed.',
    invalid: 'Enter a first and last name. An IPI, if you add one, is 9 to 11 digits.',
    offline: 'The public sources did not answer. Registry links still open in your browser. Nothing was guessed.',
    busy: 'A public source is busy. Try again later. Nothing was guessed.'
  };
  return {
    ok: false,
    status: statusName,
    message: messages[statusName] || messages.offline,
    candidates: [],
    sources: [],
    disclaimer: DISCLAIMER
  };
}

module.exports = {
  DISCLAIMER: DISCLAIMER,
  parsePerson: parsePerson,
  parseProfile: parseProfile,
  planSearch: planSearch,
  planDetail: planDetail,
  registryLinks: registryLinks,
  normalizePersonSearch: normalizePersonSearch,
  normalizePersonProfile: normalizePersonProfile,
  normalizePersonCredits: normalizePersonCredits,
  personFailure: personFailure,
  canonicalIpi: canonicalIpi,
  foldName: foldName
};
