'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const research = require('./lib/research-portal');
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
  assert.strictEqual(research.allowedFetchUrl('https://musicbrainz.org/ws/2/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d'), false);
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
  ['Artist presence', 'Song and credits', 'Analytics', 'Opportunities', 'Payments and royalties'].forEach(function (label) {
    assert.ok(html.indexOf(label) !== -1, label);
  });
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

  console.log('research-portal.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
