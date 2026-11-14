'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const research = require('./lib/research-portal');
const person = require('./lib/research-person');
const lookup = require('./lib/research-lookup');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, rel), 'utf8');
}

function memory() {
  const map = new Map();
  return {
    getItem: function (key) { return map.has(key) ? map.get(key) : null; },
    setItem: function (key, value) { map.set(key, String(value)); }
  };
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader: function (name, value) { this.headers[name] = value; },
    end: function (body) { this.body = body || ''; }
  };
}

function postReq(body, ip) {
  return {
    method: 'POST',
    url: '/api/youtube?action=research',
    query: { action: 'research' },
    headers: { 'x-forwarded-for': ip || '203.0.113.10' },
    body: body
  };
}

function jsonResponse(payload, status) {
  return {
    ok: (status || 200) >= 200 && (status || 200) < 300,
    status: status || 200,
    headers: { get: function (name) { return String(name).toLowerCase() === 'content-type' ? 'application/json' : ''; } },
    text: async function () { return JSON.stringify(payload); }
  };
}

function entityFixture() {
  return {
    entities: {
      Q1: {
        labels: { en: { value: 'Example <script>' } },
        descriptions: { en: { value: 'Test group, not a real catalog row' } },
        aliases: { en: [{ value: 'Alias one' }, { value: 'Alias two' }] },
        claims: {
          P434: [
            { mainsnak: { datavalue: { type: 'string', value: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d' } } },
            { mainsnak: { datavalue: { type: 'string', value: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } } }
          ],
          P1243: [{ mainsnak: { datavalue: { type: 'string', value: 'GBAYE0601647' } } }],
          P1827: [{ mainsnak: { datavalue: { type: 'string', value: 'T-034.524.680-1' } } }],
          P31: [{ mainsnak: { datavalue: { type: 'wikibase-entityid', value: { id: 'Q215380' } } } }],
          P856: [{ mainsnak: { datavalue: { type: 'string', value: 'javascript:alert(1)' } } }],
          tags: [{ mainsnak: { datavalue: { type: 'string', value: 'should-drop' } } }]
        }
      }
    }
  };
}

async function run() {
  const name = research.parseSeed('  Radiohead  ');
  assert.strictEqual(name.op, 'search');
  assert.strictEqual(name.q, 'Radiohead');
  const mbid = research.parseSeed('https://musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
  assert.strictEqual(mbid.op, 'mbid');
  const spotify = research.parseSeed('https://open.spotify.com/intl-de/artist/3WrFJ7ztbogyGnTHbHJFl2?si=abc');
  assert.strictEqual(spotify.platform, 'spotify');
  assert.strictEqual(spotify.q, '3WrFJ7ztbogyGnTHbHJFl2');
  const apple = research.parseSeed('https://music.apple.com/us/artist/the-beatles/136975');
  assert.strictEqual(apple.platform, 'apple');
  assert.strictEqual(apple.q, '136975');
  assert.strictEqual(research.parseSeed('https://music.apple.com/us/album/abbey-road/1441164426').ok, false);
  const isrc = research.parseSeed('GB-AYE-06-01647');
  assert.strictEqual(isrc.op, 'isrc');
  assert.strictEqual(isrc.q, 'GBAYE0601647');
  const iswc = research.parseSeed('T0345246801');
  assert.strictEqual(iswc.op, 'iswc');
  assert.strictEqual(iswc.q, 'T-034.524.680-1');
  assert.strictEqual(research.parseSeed('https://evil.example/artist/1').reason, 'rejected-url');
  assert.strictEqual(research.parseSeed('http://169.254.169.254/latest/meta-data').reason, 'rejected-url');
  assert.strictEqual(research.parseSeed('javascript:alert(1)').reason, 'rejected-url');
  assert.strictEqual(research.isSafeHttpUrl('javascript:alert(1)'), false);
  assert.strictEqual(research.isSafeHttpUrl('http://169.254.169.254/latest'), false);
  assert.strictEqual(research.isSafeHttpUrl('https://musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d'), true);

  const manuals = research.manualLinks('GBAYE0601647');
  assert.ok(manuals.links.some(function (link) { return link.href.indexOf('type=recording') !== -1 && link.href.indexOf('isrc%3AGBAYE0601647') !== -1; }));
  const workLinks = research.manualLinks('T-034.524.680-1');
  assert.ok(workLinks.links.some(function (link) { return link.href.indexOf('type=work') !== -1; }));
  assert.ok(!workLinks.links.some(function (link) { return link.href.indexOf('/ws/') !== -1; }));
  manuals.links.forEach(function (link) { assert.strictEqual(research.isSafeHttpUrl(link.href), true); });

  const search = research.normalizeSearch({
    search: [
      { id: 'Q1299', label: 'Same Name', description: 'English group' },
      { id: 'Q2', label: 'Same Name', description: '1968 album' }
    ]
  }, '2026-11-09T21:00:00.000Z');
  assert.strictEqual(search.needsConfirm, true);
  assert.strictEqual(search.ambiguous, true);
  assert.strictEqual(search.entity, null);
  assert.strictEqual(search.candidates.length, 2);
  const empty = research.normalizeSearch({ search: [] }, '2026-11-09T21:00:00.000Z');
  assert.strictEqual(empty.noMatch, true);
  assert.ok(/not proof/i.test(empty.limitation));

  const entity = research.normalizeEntity(entityFixture(), 'Q1', '2026-11-09T21:00:00.000Z', {
    Q215380: { labels: { en: { value: 'musical group' } } }
  });
  assert.strictEqual(entity.entity.label, 'Example <script>');
  assert.ok(entity.conflicts.some(function (row) { return row.field === 'MusicBrainz artist ID'; }));
  const blob = JSON.stringify(entity);
  assert.ok(blob.indexOf('should-drop') === -1);
  assert.ok(blob.indexOf('GBAYE0601647') !== -1);
  assert.ok(blob.indexOf('T-034.524.680-1') !== -1);
  assert.ok(blob.indexOf('javascript:') === -1);
  assert.ok(entity.entity.fields.some(function (field) { return field.id.indexOf('P1243') === 0; }));
  assert.ok(entity.entity.fields.some(function (field) { return field.id.indexOf('P1827') === 0; }));
  assert.ok(entity.entity.fields.filter(function (field) { return field.id.indexOf('P1243') === 0; })[0].note.indexOf('composition') !== -1);
  assert.ok(entity.entity.fields.filter(function (field) { return field.id.indexOf('P434') === 0; })[0].note.indexOf('Not a result from the MusicBrainz web service') !== -1);
  assert.strictEqual(search.dataClass, 'public-wikidata');
  assert.ok(entity.entity.fields.filter(function (field) { return field.id.indexOf('P1827') === 0; })[0].note.indexOf('PRO') !== -1);

  const mbidRequest = research.requestFor(research.parseSeed('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d'));
  assert.ok(mbidRequest.url.indexOf('https://query.wikidata.org/sparql') === 0);
  assert.ok(mbidRequest.url.indexOf('musicbrainz.org') === -1);
  assert.strictEqual(research.allowedFetchUrl(mbidRequest.url), true);
  assert.strictEqual(research.allowedFetchUrl('https://musicbrainz.org/ws/2/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d?inc=aliases+url-rels+artist-rels&fmt=json'), true);
  assert.strictEqual(research.allowedFetchUrl('https://musicbrainz.org/ws/2/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d?inc=tags+ratings'), false);
  assert.strictEqual(research.allowedFetchUrl('https://musicbrainz.org/ws/2/recording?query=beatles'), false);
  assert.strictEqual(research.allowedFetchUrl('https://api.discogs.com/database/search?type=artist&q=Ada'), true);
  assert.strictEqual(research.allowedFetchUrl('https://api.discogs.com/artists/61337'), true);
  assert.strictEqual(research.allowedFetchUrl('https://api.discogs.com/marketplace/orders'), false);
  assert.strictEqual(research.allowedFetchUrl('https://evil.example/w/api.php'), false);

  const notesA = memory();
  const saved = research.saveNotes(notesA, 'a@example.com', [{
    id: 'row1',
    title: 'Outside song',
    kind: 'recording',
    isrc: 'GBAYE0601647',
    released: { state: 'documented', source: 'Wikidata CC0', checkedAt: '2026-11-09T21:00:00.000Z', note: 'identifier' }
  }, {
    id: 'typed',
    title: 'Typed code',
    kind: 'recording',
    isrc: 'GBAYE0601647',
    released: { state: 'documented', source: 'I typed this', checkedAt: '2026-11-09T21:00:00.000Z' }
  }, {
    id: 'cover',
    title: 'Someone else wrote it',
    kind: 'composition',
    role: 'cover',
    registration: { state: 'self-report' }
  }, {
    id: 'mine',
    title: 'My composition',
    kind: 'composition',
    role: 'original',
    registration: { state: 'self-report' },
    agreement: { state: 'pending' },
    lookupNote: 'No Wikidata item came back. Not proof it is unregistered.'
  }]);
  assert.strictEqual(saved.ok, true);
  assert.strictEqual(research.loadNotes(notesA, 'b@example.com').length, 0);
  const own = research.loadNotes(notesA, 'a@example.com');
  assert.strictEqual(own.length, 4);
  assert.strictEqual(own[0].released.state, 'unknown');
  assert.strictEqual(own[0].isrc, 'GBAYE0601647');
  assert.strictEqual(own[1].released.state, 'unknown');
  assert.strictEqual(own[3].registration.state, 'self-report');
  assert.ok(/this browser only/.test(own[3].registration.source));
  assert.ok(/unregistered/i.test(own[3].lookupNote));
  assert.notStrictEqual(own[3].registration.state, 'unregistered');
  const meters = research.meterSummary(own);
  assert.strictEqual(meters.released.total, 2);
  assert.strictEqual(meters.released.documented, 0);
  assert.strictEqual(meters.registration.total, 1);
  assert.strictEqual(meters.registration['self-report'], 1);
  assert.strictEqual(meters.agreement.pending, 1);
  assert.strictEqual(meters.coversLeftOut, 1);
  assert.strictEqual(meters.registration.documented, 0);
  assert.strictEqual(research.saveNotes(notesA, '', own).reason, 'signed-out');
  const royalty = research.parseCatalogPaste('Title | royalty | 12.40');
  assert.strictEqual(royalty.ok, false);
  const pasted = research.parseCatalogPaste('Night bus | GBAYE0601647 | original\nPaper song | T-034.524.680-1 | cover');
  assert.strictEqual(pasted.ok, true);
  assert.strictEqual(pasted.items[0].released.state, 'unknown');
  assert.strictEqual(pasted.items[1].role, 'cover');
  assert.ok(research.escapeHtml('<script>').indexOf('<') === -1);

  const html = read('research.html');
  const client = read('research.js');
  const server = read('lib/research-lookup.js');
  const page = read('api/youtube.js');
  const vercel = JSON.parse(read('vercel.json'));
  ['Search a person', 'Artist presence', 'Song and credits', 'Analytics', 'Opportunities', 'Payments and royalties'].forEach(function (label) {
    assert.ok(html.indexOf(label) !== -1, label);
  });
  assert.ok(html.indexOf('Not proof of ownership') !== -1);
  assert.ok(html.indexOf('data-person-form') !== -1);
  assert.ok(html.indexOf('research-page') !== -1);
  assert.ok(html.indexOf('The Beatles') === -1);
  assert.ok(html.indexOf('Q1299') === -1);
  assert.ok(html.indexOf('type="file"') === -1);
  assert.ok(html.indexOf('Not available in this free portal') !== -1);
  assert.ok(html.indexOf('Not built') !== -1);
  assert.ok(html.indexOf('does not estimate royalties') !== -1);
  assert.ok(client.indexOf('innerHTML') === -1);
  assert.ok(client.indexOf("state: 'documented'") === -1);
  assert.ok(client.indexOf('attempt < 1') === -1);
  assert.ok(client.indexOf('musicbrainz.org/ws') === -1);
  assert.ok(server.indexOf('musicbrainz.org/ws') === -1);
  const personSource = read('lib/research-person.js');
  assert.ok(personSource.indexOf('inc=aliases+url-rels+artist-rels') !== -1);
  assert.ok(personSource.indexOf('inc=tags') === -1);
  assert.ok(personSource.indexOf('recording-rels') === -1);
  assert.ok(cssSafe(read('research.css')));
  assert.ok(server.indexOf('www.wikidata.org') !== -1);
  assert.ok(page.indexOf('youtubei/v1/search') !== -1);
  assert.ok(page.indexOf("=== 'research'") !== -1);
  assert.ok(read('site.js').indexOf('setupResearchLink') !== -1);
  assert.ok(read('site.js').indexOf('"research"') !== -1);
  assert.ok(vercel.rewrites.some(function (rule) { return rule.source === '/research' && rule.destination === '/research.html'; }));
  assert.ok(vercel.rewrites.some(function (rule) { return rule.source === '/api/research'; }));
  assert.ok(read('docs/research-portal.md').indexOf('CC0') !== -1);

  lookup.resetState();
  let calls = 0;
  const fetchMock = async function (url) {
    calls += 1;
    assert.strictEqual(research.allowedFetchUrl(url), true);
    assert.ok(url.indexOf('musicbrainz.org') === -1);
    return jsonResponse({ search: [{ id: 'Q1299', label: 'Fixture act', description: 'A group' }, { id: 'Q9', label: 'Fixture act', description: 'An album' }] });
  };
  let clock = 5000;
  const first = mockRes();
  await lookup.handle(postReq({ q: 'Fixture act' }), first, { fetch: fetchMock, now: function () { return clock; } });
  const firstBody = JSON.parse(first.body);
  assert.strictEqual(first.statusCode, 200);
  assert.strictEqual(firstBody.ambiguous, true);
  assert.strictEqual(firstBody.entity, null);
  assert.strictEqual(first.headers['Cache-Control'], 'no-store');
  const blocked = mockRes();
  await lookup.handle(postReq({ q: 'Fixture act' }), blocked, { fetch: fetchMock, now: function () { return clock; } });
  assert.strictEqual(blocked.statusCode, 429);
  assert.strictEqual(JSON.parse(blocked.body).status, 'rate-limit');
  assert.strictEqual(calls, 1);
  clock = 20000;
  const cached = mockRes();
  await lookup.handle(postReq({ q: 'Fixture act' }), cached, { fetch: fetchMock, now: function () { return clock; } });
  assert.strictEqual(cached.statusCode, 200);
  assert.strictEqual(calls, 1);
  const ssrf = mockRes();
  await lookup.handle(postReq({ q: 'http://169.254.169.254/latest/meta-data' }), ssrf, { fetch: fetchMock, now: function () { return clock + 5000; } });
  assert.strictEqual(ssrf.statusCode, 400);
  assert.strictEqual(calls, 1);
  lookup.resetState();
  const offline = mockRes();
  await lookup.handle(postReq({ q: 'Offline act' }), offline, {
    fetch: async function () { throw new Error('network down'); },
    now: function () { return 100; }
  });
  assert.strictEqual(JSON.parse(offline.body).status, 'offline');
  assert.strictEqual(offline.statusCode, 503);
  lookup.resetState();
  const busy = mockRes();
  await lookup.handle(postReq({ q: 'Busy act' }), busy, {
    fetch: async function () { return jsonResponse({}, 429); },
    now: function () { return 100; }
  });
  assert.strictEqual(JSON.parse(busy.body).status, 'rate-limit');
  lookup.resetState();
  const missing = mockRes();
  await lookup.handle(postReq({ q: 'zzzznotanartist999991' }), missing, {
    fetch: async function () { return jsonResponse({ search: [] }); },
    now: function () { return 100; }
  });
  const missingBody = JSON.parse(missing.body);
  assert.strictEqual(missingBody.noMatch, true);
  assert.ok(/not proof/i.test(missingBody.limitation));

  lookup.resetState();
  const youtube = require('./api/youtube');
  const previousFetch = global.fetch;
  const youtubeCalls = [];
  global.fetch = async function (url, init) {
    youtubeCalls.push(String(url));
    const headers = (init && init.headers) || {};
    if (String(url).indexOf('wikidata.org') !== -1 || String(url).indexOf('query.wikidata.org') !== -1) {
      assert.ok(String(headers['User-Agent'] || '').indexOf('PLAIGROUND-research/1.0') !== -1);
      assert.ok(String(headers['User-Agent'] || '').indexOf('https://www.wannaplai.com/contact') !== -1);
      return jsonResponse({ search: [] });
    }
    return {
      ok: true,
      status: 200,
      headers: { get: function () { return 'application/json'; } },
      json: async function () { return {}; },
      text: async function () { return '{}'; }
    };
  };
  try {
    const researchRes = mockRes();
    await youtube(postReq({ q: 'Ada Artist' }), researchRes);
    assert.strictEqual(researchRes.statusCode, 200);
    assert.ok(youtubeCalls.length > 0);
    youtubeCalls.forEach(function (url) {
      assert.ok(url.indexOf('youtubei') === -1, url);
      assert.strictEqual(research.allowedFetchUrl(url), true);
    });
    youtubeCalls.length = 0;
    const plain = mockRes();
    await youtube({
      method: 'POST',
      url: '/api/youtube',
      query: {},
      headers: {},
      body: { title: 'Song', artist: 'Name', q: 'should-not-become-research' }
    }, plain);
    assert.ok(youtubeCalls.some(function (url) { return url.indexOf('youtubei/v1/search') !== -1; }));
    assert.ok(!youtubeCalls.some(function (url) { return url.indexOf('wikidata') !== -1; }));
    assert.strictEqual(plain.body.indexOf('video') !== -1 || plain.statusCode === 404, true);
  } finally {
    global.fetch = previousFetch;
    lookup.resetState();
  }

  lookup.resetState();
  const liveRes = mockRes();
  await lookup.handle(postReq({ q: 'The Beatles' }, '203.0.113.50'), liveRes);
  const live = JSON.parse(liveRes.body);
  if (!live.ok) {
    assert.ok(['rate-limit', 'offline', 'busy', 'unavailable'].indexOf(live.status) !== -1);
    console.log('live Wikidata search did not complete: ' + live.status);
  } else {
    assert.strictEqual(live.needsConfirm, true);
    assert.ok(live.candidates.length > 1);
    assert.ok(live.candidates.some(function (row) { return row.id === 'Q1299' && /Beatles/.test(row.label); }));
    assert.strictEqual(live.entity, null);
    assert.strictEqual(live.source.licence, 'CC0');
    await new Promise(function (resolve) { setTimeout(resolve, 1200); });
    const emptyRes = mockRes();
    await lookup.handle(postReq({ q: 'zzzznotanartist999991' }, '203.0.113.50'), emptyRes);
    const emptyLive = JSON.parse(emptyRes.body);
    if (emptyLive.ok) {
      assert.strictEqual(emptyLive.noMatch, true);
      assert.strictEqual(emptyLive.candidates.length, 0);
    } else {
      assert.ok(['rate-limit', 'offline', 'busy'].indexOf(emptyLive.status) !== -1);
    }
    await new Promise(function (resolve) { setTimeout(resolve, 1200); });
    const codeRes = mockRes();
    await lookup.handle(postReq({ q: 'GBAYE0601647' }, '203.0.113.50'), codeRes);
    const code = JSON.parse(codeRes.body);
    if (code.ok && !code.noMatch) {
      assert.ok(code.recordings.length > 0);
      assert.strictEqual(code.works.length, 0);
      assert.ok(code.recordings[0].isrcs.indexOf('GBAYE0601647') !== -1);
      assert.ok(JSON.stringify(code).indexOf('chain of title') !== -1);
    } else if (code.ok) {
      assert.strictEqual(code.noMatch, true);
    } else {
      assert.ok(['rate-limit', 'offline', 'busy'].indexOf(code.status) !== -1);
    }
    console.log('live Wikidata search ok, candidates ' + live.candidates.length);
  }

  const martin = person.normalizePersonSearch({
    musicbrainz: {
      artists: [{
        id: '6622a50e-5206-44d0-9ad5-96047a726dcf',
        name: 'Max Martin',
        'sort-name': 'Martin, Max',
        type: 'Person',
        score: 100,
        disambiguation: 'Swedish record producer',
        ipis: ['00215866753'],
        aliases: [{ name: 'Martin Karl Sandberg', type: 'Legal name' }]
      }, {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Max Martin',
        type: 'Person',
        score: 40,
        disambiguation: 'other person'
      }]
    },
    wikidata: { results: { bindings: [
      { item: { value: 'http://www.wikidata.org/entity/Q318223' }, itemLabel: { value: 'Max Martin' }, itemDescription: { value: 'Swedish record producer and songwriter' }, mb: { value: '6622a50e-5206-44d0-9ad5-96047a726dcf' }, ipi: { value: '00215866753' }, discogs: { value: '61337' } },
      { item: { value: 'http://www.wikidata.org/entity/Q9' }, itemLabel: { value: 'Max Martin' }, itemDescription: { value: 'Wikimedia disambiguation page' } }
    ] } },
    discogs: { results: [{ id: 61337, type: 'artist', title: 'Max Martin', uri: '/artist/61337-Max-Martin' }] }
  }, person.parsePerson({ first: 'Martin', last: 'Sandberg', artist: 'Max Martin', ipi: '215866753' }), '2026-11-14T12:00:00.000Z');
  assert.strictEqual(martin.ok, true);
  assert.ok(martin.candidates.length >= 2);
  assert.notStrictEqual(martin.candidates[0].id, martin.candidates[1].id);
  const top = martin.candidates[0];
  assert.strictEqual(top.confidence, 'high');
  assert.ok(top.aliases.some(function (alias) { return alias.name === 'Martin Karl Sandberg' && alias.type === 'Legal name' && alias.source === 'MusicBrainz'; }));
  assert.ok(top.profiles.some(function (profile) { return profile.href.indexOf('61337') !== -1; }));
  assert.ok(top.registries.some(function (link) { return link.id === 'bmi' && link.href.indexOf('Max+Martin') !== -1; }));
  assert.ok(top.registries.some(function (link) { return link.id === 'songview' && link.href.indexOf('searchFilter=SVW') !== -1; }));
  assert.ok(top.registries.some(function (link) { return link.id === 'mlc' && link.href.indexOf('writerFullNames=Max') !== -1 && link.href.indexOf('ipiNameNumber=00215866753') !== -1; }));
  assert.ok(!top.registries.some(function (link) { return /ascap\.com\/api|repertoire\.bmi\.com\/ws|portal\.themlc\.com\/api/i.test(link.href); }));
  assert.ok(JSON.stringify(martin).indexOf('Q9') === -1);
  assert.ok(/not proof of ownership/i.test(martin.disclaimer));
  assert.ok(!/found all your|your royalties|we found/i.test(martin.disclaimer + martin.limitation));

  const profile = person.normalizePersonProfile({
    musicbrainz: {
      id: '6622a50e-5206-44d0-9ad5-96047a726dcf',
      name: 'Max Martin',
      type: 'Person',
      aliases: [{ name: 'Martin Karl Sandberg', type: 'Legal name' }],
      relations: [
        { type: 'performance name', direction: 'forward', artist: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Stage Name' } },
        { type: 'official homepage', url: { resource: 'https://example.com/official' } },
        { type: 'social network', url: { resource: 'javascript:alert(1)' } },
        { type: 'streaming', url: { resource: 'https://open.spotify.com/artist/1' } }
      ]
    },
    discogs: {
      id: 61337,
      name: 'Max Martin',
      realname: 'Karl Martin Sandberg',
      namevariations: ['M. Martin'],
      aliases: [{ id: 433829, name: 'Martin Sandberg' }],
      urls: ['javascript:alert(1)', 'https://www.instagram.com/officialmaxmartin/'],
      profile: 'A long biography that must not be copied.'
    },
    wikidata: { entities: { Q318223: {
      labels: { en: { value: 'Max Martin' } },
      descriptions: { en: { value: 'Swedish record producer' } },
      aliases: { en: [{ value: 'Martin Sandberg' }] },
      claims: {
        P2003: [{ mainsnak: { datavalue: { value: 'officialmaxmartin' } } }],
        P2002: [{ mainsnak: { datavalue: { value: 'not a real handle with spaces' } } }]
      }
    } } }
  }, { mbid: '6622a50e-5206-44d0-9ad5-96047a726dcf', qid: 'Q318223', discogsId: '61337' }, '2026-11-14T12:00:00.000Z');
  assert.ok(profile.aliases.some(function (alias) { return alias.type === 'performs as' && alias.name === 'Stage Name'; }));
  assert.ok(profile.aliases.some(function (alias) { return alias.type === 'name variation' && alias.name === 'M. Martin' && alias.source === 'Discogs'; }));
  assert.ok(profile.links.some(function (link) { return link.href === 'https://example.com/official' && link.source === 'MusicBrainz'; }));
  assert.ok(profile.links.some(function (link) { return link.href === 'https://www.instagram.com/officialmaxmartin/' && link.source === 'Discogs'; }));
  assert.ok(profile.links.some(function (link) { return link.href === 'https://www.instagram.com/officialmaxmartin/' && link.source === 'Wikidata'; }));
  const profileBlob = JSON.stringify(profile);
  assert.ok(profileBlob.indexOf('javascript:') === -1);
  assert.ok(profileBlob.indexOf('open.spotify.com') === -1);
  assert.ok(profileBlob.indexOf('not a real handle') === -1);
  assert.ok(profileBlob.indexOf('long biography') === -1);
  assert.ok(!profile.links.some(function (link) { return link.label === 'X'; }));

  const credits = person.normalizePersonCredits({
    works: {
      'work-count': 389,
      works: [{
        id: '702f1cf7-de14-32e9-8a61-8c0a02dc01a1',
        title: 'Baby One More Time',
        relations: [
          { type: 'composer', artist: { id: '6622a50e-5206-44d0-9ad5-96047a726dcf', name: 'Max Martin' } },
          { type: 'lyricist', artist: { id: '6622a50e-5206-44d0-9ad5-96047a726dcf', name: 'Max Martin' } },
          { type: 'vocal', attributes: ['guest'], artist: { id: '6622a50e-5206-44d0-9ad5-96047a726dcf', name: 'Max Martin' } },
          { type: 'producer', artist: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'Someone else' } }
        ]
      }]
    },
    wikidata: { results: { bindings: [
      { item: { value: 'http://www.wikidata.org/entity/Q1' }, itemLabel: { value: 'A Song' }, role: { value: 'producer' } }
    ] } }
  }, { mbid: '6622a50e-5206-44d0-9ad5-96047a726dcf', qid: 'Q318223', discogsId: '' }, '2026-11-14T12:00:00.000Z');
  assert.ok(credits.credits.some(function (row) { return row.role === 'composer' && row.source === 'MusicBrainz'; }));
  assert.ok(credits.credits.some(function (row) { return row.role === 'featured' && row.source === 'MusicBrainz'; }));
  assert.ok(credits.credits.some(function (row) { return row.role === 'producer' && row.source === 'Wikidata'; }));
  assert.ok(!credits.credits.some(function (row) { return row.title === 'Baby One More Time' && row.role === 'producer'; }));
  assert.ok(/389/.test(credits.note));
  assert.strictEqual(credits.workCount, 389);

  const ambiguous = person.normalizePersonSearch({
    musicbrainz: { artists: [] },
    wikidata: { results: { bindings: [
      { item: { value: 'http://www.wikidata.org/entity/Q1' }, itemLabel: { value: 'John Smith' }, itemDescription: { value: 'one person' } },
      { item: { value: 'http://www.wikidata.org/entity/Q2' }, itemLabel: { value: 'John Smith' }, itemDescription: { value: 'another person' } }
    ] } },
    discogs: { results: [] }
  }, person.parsePerson({ first: 'John', last: 'Smith' }), '2026-11-14T12:00:00.000Z');
  assert.strictEqual(ambiguous.candidates.length, 2);
  assert.notStrictEqual(ambiguous.candidates[0].id, ambiguous.candidates[1].id);
  ambiguous.candidates.forEach(function (row) { assert.strictEqual(row.confidence, 'possible'); });

  const none = person.normalizePersonSearch({
    musicbrainz: { artists: [] },
    wikidata: { results: { bindings: [] } },
    discogs: { results: [] },
    errors: {}
  }, person.parsePerson({ first: 'Zzzzz', last: 'Notapersonqx' }), '2026-11-14T12:00:00.000Z');
  assert.strictEqual(none.noMatch, true);
  assert.ok(/not proof/i.test(none.limitation));
  assert.ok(none.registries.some(function (link) { return link.href.indexOf('Zzzzz') !== -1; }));
  assert.strictEqual(person.parsePerson({ first: 'Ada', last: 'Lovelace', ipi: '12' }).ok, false);
  assert.strictEqual(person.planSearch({ first: 'http://evil.example', last: 'Name' }), null);
  const plan = person.planSearch({ first: 'Martin', last: 'Sandberg', artist: 'Max Martin' });
  plan.requests.forEach(function (row) { assert.strictEqual(research.allowedFetchUrl(row.url), true); });
  assert.ok(plan.requests.every(function (row) { return row.url.indexOf('inc=tags') === -1 && row.url.indexOf('recording-rels') === -1; }));

  lookup.resetState();
  const personCalls = [];
  const personFetch = async function (url) {
    personCalls.push(String(url));
    assert.strictEqual(research.allowedFetchUrl(url), true);
    if (String(url).indexOf('musicbrainz.org') !== -1) {
      return jsonResponse({ artists: [{ id: '6622a50e-5206-44d0-9ad5-96047a726dcf', name: 'Max Martin', type: 'Person', score: 100, ipis: ['00215866753'] }] });
    }
    if (String(url).indexOf('discogs') !== -1) return jsonResponse({ message: 'no' }, 401);
    return jsonResponse({ results: { bindings: [] } });
  };
  const personRes = mockRes();
  await lookup.handle(postReq({ op: 'person', first: 'Max', last: 'Martin' }, '203.0.113.77'), personRes, {
    fetch: personFetch,
    now: function () { return 1000; },
    wait: function () { return Promise.resolve(); }
  });
  const personBody = JSON.parse(personRes.body);
  assert.strictEqual(personRes.statusCode, 200);
  assert.strictEqual(personBody.candidates.length, 1);
  assert.ok(personBody.sources.some(function (row) { return row.id === 'discogs' && row.status === 'blocked'; }));
  assert.ok(personCalls.some(function (url) { return url.indexOf('musicbrainz.org/ws/2/artist') !== -1; }));
  assert.ok(!personCalls.some(function (url) { return url.indexOf('ascap.com') !== -1 || url.indexOf('bmi.com') !== -1 || url.indexOf('themlc.com') !== -1; }));
  const paced = mockRes();
  await lookup.handle(postReq({ op: 'person', first: 'Max', last: 'Martin' }, '203.0.113.77'), paced, {
    fetch: personFetch,
    now: function () { return 1000; },
    wait: function () { return Promise.resolve(); }
  });
  assert.strictEqual(paced.statusCode, 429);

  lookup.resetState();
  await new Promise(function (resolve) { setTimeout(resolve, 1200); });
  const livePerson = mockRes();
  await lookup.handle(postReq({ op: 'person', first: 'Max', last: 'Martin' }, '203.0.113.88'), livePerson, {
    fetch: global.fetch,
    now: Date.now
  });
  const livePersonBody = JSON.parse(livePerson.body);
  if (!livePersonBody.ok) {
    assert.ok(['rate-limit', 'offline', 'busy'].indexOf(livePersonBody.status) !== -1);
    console.log('live person search did not complete: ' + livePersonBody.status);
  } else {
    assert.ok(livePersonBody.candidates.some(function (row) { return row.mbid === '6622a50e-5206-44d0-9ad5-96047a726dcf' || /Martin/.test(row.name); }));
    const known = livePersonBody.candidates.filter(function (row) { return row.mbid === '6622a50e-5206-44d0-9ad5-96047a726dcf'; })[0];
    if (known) {
      assert.ok(known.aliases.some(function (alias) { return /Sandberg|Martin/.test(alias.name); }) || /Martin/.test(known.name));
      console.log('live Max Martin confidence ' + known.confidence + ' aliases ' + known.aliases.length + ' sources ' + livePersonBody.sources.map(function (row) { return row.id + ':' + row.status; }).join(','));
      await new Promise(function (resolve) { setTimeout(resolve, 1500); });
      const liveProfile = mockRes();
      await lookup.handle(postReq({ op: 'person-profile', mbid: known.mbid, qid: known.qid, discogsId: known.discogsId }, '203.0.113.88'), liveProfile, { fetch: global.fetch, now: Date.now });
      const profileBody = JSON.parse(liveProfile.body);
      if (profileBody.ok) {
        const legal = (profileBody.aliases || []).filter(function (alias) { return /legal|real name|performs as|name variation/i.test(alias.type); });
        console.log('live profile aliases ' + (profileBody.aliases || []).length + ' legal-ish ' + legal.map(function (alias) { return alias.type + ':' + alias.name; }).join('; ') + ' links ' + (profileBody.links || []).length);
        if ((profileBody.sources || []).some(function (row) { return row.id === 'musicbrainz' && row.status === 'ok'; })) {
          assert.ok((profileBody.aliases || []).some(function (alias) { return /Sandberg/.test(alias.name); }));
        }
      }
      await new Promise(function (resolve) { setTimeout(resolve, 1500); });
      const liveCredits = mockRes();
      await lookup.handle(postReq({ op: 'person-credits', mbid: known.mbid, qid: known.qid }, '203.0.113.88'), liveCredits, { fetch: global.fetch, now: Date.now });
      const creditBody = JSON.parse(liveCredits.body);
      if (creditBody.ok) {
        console.log('live credits ' + (creditBody.credits || []).length + ' workCount ' + creditBody.workCount + ' roles ' + (creditBody.credits || []).slice(0, 6).map(function (row) { return row.role + ':' + row.title; }).join('; '));
        if ((creditBody.sources || []).some(function (row) { return row.status === 'ok'; })) {
          assert.ok((creditBody.credits || []).some(function (row) { return row.role === 'composer' || row.role === 'lyricist' || row.role === 'writer' || row.role === 'producer'; }));
        }
      }
    } else {
      console.log('live person search returned ' + livePersonBody.candidates.length + ' without the known mbid');
    }
    await new Promise(function (resolve) { setTimeout(resolve, 4000); });
    const liveCommon = mockRes();
    await lookup.handle(postReq({ op: 'person', first: 'John', last: 'Smith' }, '203.0.113.88'), liveCommon, { fetch: global.fetch, now: Date.now });
    const commonBody = JSON.parse(liveCommon.body);
    if (commonBody.ok && !commonBody.noMatch) {
      assert.ok(commonBody.candidates.length > 1);
      const ids = commonBody.candidates.map(function (row) { return row.id; });
      assert.strictEqual(ids.length, new Set(ids).size);
      console.log('live John Smith candidates ' + commonBody.candidates.length);
    }
    await new Promise(function (resolve) { setTimeout(resolve, 4000); });
    const liveNone = mockRes();
    await lookup.handle(postReq({ op: 'person', first: 'Zzzzz', last: 'Notapersonqx' }, '203.0.113.88'), liveNone, { fetch: global.fetch, now: Date.now });
    const noneBody = JSON.parse(liveNone.body);
    if (noneBody.ok) {
      assert.strictEqual(noneBody.noMatch, true);
      assert.ok(noneBody.registries.length >= 4);
      console.log('live empty name noMatch, registries ' + noneBody.registries.length);
    }
  }

  console.log('research-portal.test.js ok');
}

function cssSafe(css) {
  return css.indexOf('research-page') !== -1 && css.indexOf('136px') !== -1;
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
