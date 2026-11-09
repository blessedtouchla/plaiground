'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const featured = require('./featured-artists');
const profile = require('./profile');
const accounts = require('./accounts');
const auth = require('./auth');
const tonegridApi = require('../api/tonegrid');

const STORE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TRACK_1 = '33333333-3333-4333-8333-333333333333';
const TRACK_2 = '44444444-4444-4444-8444-444444444444';

function names(people) {
  return people.map(function (person) { return person.name; });
}

function run() {
  assert.deepStrictEqual(featured.reviewLines({ title: 'Night Drive', name: 'Ada Night' }), []);
  assert.deepStrictEqual(featured.peopleFrom({ featured: '' }), []);
  assert.deepStrictEqual(featured.additionalArtists([]), []);
  assert.strictEqual(featured.sharedCredit({}), '');

  const one = featured.peopleFrom({ featured: ' Mina Cole ' });
  assert.deepStrictEqual(names(one), ['Mina Cole']);
  assert.deepStrictEqual(featured.additionalArtists(one), [
    { name: 'Mina Cole', role: 'FeaturedArtist' },
  ]);
  assert.strictEqual(featured.additionalArtists(one)[0].artist_id, undefined);
  const oneLines = featured.reviewLines({ type: 'single', title: 'Night Drive', featured: 'Mina Cole' });
  assert.strictEqual(oneLines.length, 1);
  assert.strictEqual(oneLines[0].label, 'Featured artist');
  assert.strictEqual(oneLines[0].text, 'Mina Cole');
  assert.strictEqual(featured.sharedCredit({ type: 'single', featured: 'Mina Cole' }), 'Mina Cole');

  const many = featured.submitFields({
    type: 'single',
    title: 'Night Drive',
    featured: 'Mina Cole, Jules Park',
  });
  assert.deepStrictEqual(many.featured_list, ['Mina Cole', 'Jules Park']);
  assert.strictEqual(many.featured, 'Mina Cole, Jules Park');
  assert.strictEqual(many.featured_tracks, undefined);
  const manyLines = featured.reviewLines({ type: 'single', featured: 'Mina Cole, Jules Park' });
  assert.strictEqual(manyLines[0].label, 'Featured artists');
  assert.strictEqual(manyLines[0].text, 'Mina Cole, Jules Park');
  assert.deepStrictEqual(featured.additionalArtists(featured.peopleFrom(many)), [
    { name: 'Mina Cole', role: 'FeaturedArtist' },
    { name: 'Jules Park', role: 'FeaturedArtist' },
  ]);

  const ampersand = featured.peopleFrom({ featured: 'Herman Watson, Baby Bash & Nate Dogg' });
  assert.deepStrictEqual(names(ampersand), ['Herman Watson', 'Baby Bash & Nate Dogg']);

  const album = {
    type: 'album',
    title: 'Night Drive',
    name: 'Ada Night',
    featured: 'Should Not Smear',
    tracks: [
      { title: 'One', position: 1, track_id: TRACK_1, featured: 'Mina Cole' },
      { title: 'Two', position: 2, track_id: TRACK_2, featured: 'Jules Park, Nia Bell' },
      { title: 'Three', position: 3, track_id: '55555555-5555-4555-8555-555555555555' },
    ],
  };
  const albumLines = featured.reviewLines(album);
  assert.strictEqual(albumLines.length, 3);
  assert.strictEqual(albumLines[0].label, 'Featured artist, track 1 (One)');
  assert.strictEqual(albumLines[0].text, 'Mina Cole');
  assert.strictEqual(albumLines[0].track_id, TRACK_1);
  assert.strictEqual(albumLines[1].label, 'Featured artists, track 2 (Two)');
  assert.strictEqual(albumLines[1].text, 'Jules Park, Nia Bell');
  assert.strictEqual(albumLines[2].label, 'Featured artist, track 3 (Three)');
  assert.strictEqual(albumLines[2].text, 'Should Not Smear', 'a track with no own feature inherits the release feature');
  assert.strictEqual(featured.sharedCredit(album), '');
  assert.deepStrictEqual(names(featured.peopleForTrackId(featured.submitFields(album), TRACK_1, 0)), ['Mina Cole']);
  assert.deepStrictEqual(names(featured.peopleForTrackId(featured.submitFields(album), TRACK_2, 1)), ['Jules Park', 'Nia Bell']);
  assert.deepStrictEqual(names(featured.peopleForTrackId(featured.submitFields(album), '55555555-5555-4555-8555-555555555555', 2)), ['Should Not Smear']);
  assert.deepStrictEqual(
    featured.peopleForTrackId(featured.submitFields(album), '99999999-9999-4999-8999-999999999999', 3),
    [],
    'a track that is not in the album feature list must not inherit another track'
  );

  const inherited = featured.assignments({
    type: 'album',
    featured: 'Mina Cole',
    tracks: [
      { title: 'One', track_id: TRACK_1 },
      { title: 'Two', track_id: TRACK_2, featured: 'Jules Park' },
    ],
  });
  assert.deepStrictEqual(names(inherited[0].people), ['Mina Cole']);
  assert.deepStrictEqual(names(inherited[1].people), ['Jules Park']);
  assert.strictEqual(featured.sharedCredit({
    type: 'album',
    featured: 'Mina Cole',
    tracks: [{ title: 'One' }, { title: 'Two' }],
  }), 'Mina Cole');

  const withId = featured.peopleFrom({
    featured_artists: [{ name: 'Mina Cole', artist_id: STORE_A, role: 'FeaturedArtist' }],
  });
  assert.strictEqual(withId[0].artist_id, STORE_A);
  const sent = featured.additionalArtists(withId);
  assert.deepStrictEqual(sent, [{ name: 'Mina Cole', role: 'FeaturedArtist', artist_id: STORE_A }]);
  assert.ok(!sent.some(function (row) { return row.role !== 'FeaturedArtist'; }));

  const junkId = featured.additionalArtists(featured.peopleFrom({
    featured_artists: [{ name: 'Mina Cole', artist_id: 'not-a-store-id' }],
  }));
  assert.strictEqual(junkId[0].artist_id, undefined);

  const saved = featured.storedFields({
    type: 'single',
    title: 'Night Drive',
    featured: 'Mina Cole, Jules Park',
    featured_artists: [
      { name: 'Mina Cole', artist_id: STORE_A },
      { name: 'Jules Park' },
    ],
  });
  const round = profile.upsertRelease({ artists: [], releases: [] }, Object.assign({
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Night Drive',
  }, saved));
  const row = round.releases[0];
  assert.strictEqual(row.featured, 'Mina Cole, Jules Park');
  assert.deepStrictEqual(row.featured_list, ['Mina Cole', 'Jules Park']);
  assert.strictEqual(row.featured_artists[0].artist_id, STORE_A);
  assert.strictEqual(row.featured_artists[0].role, 'FeaturedArtist');

  const reloaded = featured.reviewLines({
    type: 'single',
    title: row.title,
    featured: row.featured,
    featured_list: row.featured_list,
    featured_artists: row.featured_artists,
  });
  assert.strictEqual(reloaded[0].text, 'Mina Cole, Jules Park');
  assert.strictEqual(featured.peopleFrom(row)[0].artist_id, STORE_A);

  const wiped = profile.upsertRelease(round, {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Night Drive',
    genre: 'Pop',
  });
  assert.strictEqual(wiped.releases[0].featured, 'Mina Cole, Jules Park', 'a later save that omits featured must keep it');
  assert.deepStrictEqual(wiped.releases[0].featured_list, ['Mina Cole', 'Jules Park']);

  const edited = featured.reviewLines(featured.storedFields({
    type: 'single',
    featured: 'Jules Park',
  }));
  assert.strictEqual(edited[0].text, 'Jules Park');
  const back = featured.submitFields({ featured: edited[0].text, type: 'single' });
  assert.strictEqual(back.featured, 'Jules Park');

  const root = path.join(__dirname, '..');
  const review = fs.readFileSync(path.join(root, 'lib/review-facts.js'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'store-client.js'), 'utf8');
  const api = fs.readFileSync(path.join(root, 'api/tonegrid.js'), 'utf8');
  assert.ok(review.includes('featured_lines'), 'review renders featured lines');
  assert.ok(client.includes('featured_lines'), 'review facts include featured lines');
  assert.ok(client.includes('featured_tracks'), 'submit payload keeps per-track features');
  assert.ok(api.includes('additional_artists'), 'store hop sends additional_artists');
  assert.ok(fs.readFileSync(path.join(root, 'lib/featured-artists.js'), 'utf8').includes("ROLE = 'FeaturedArtist'"), 'store role stays FeaturedArtist');
  assert.ok(api.indexOf('additional_artists') > api.indexOf('function stampTrackFeatured'));

}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader() {},
    end(chunk) { this.body = chunk == null ? '' : String(chunk); },
  };
}

function submitRelease(req, res) {
  return tonegridApi(Object.assign({ url: '/api/tonegrid/releases/' + req.id + '/submit' }, req), res);
}

async function submitHop() {
  const prevDb = process.env.DATABASE_URL;
  const prevSecret = process.env.SESSION_SECRET;
  const prevKey = process.env.TONEGRID_API_KEY;
  const prevBase = process.env.TONEGRID_BASE_URL;
  process.env.DATABASE_URL = 'postgres://memory';
  process.env.SESSION_SECRET = 'featured-artist-test-secret';
  process.env.TONEGRID_API_KEY = 'test-key-value-not-for-commit';
  process.env.TONEGRID_BASE_URL = 'https://api-sandbox.tonegrid.pro/api';
  accounts.useMemoryStore();
  const mine = '11111111-1111-4111-8111-111111111111';
  const trackA = TRACK_1;
  const trackB = TRACK_2;
  const created = await accounts.createUser({
    email: 'featured@example.com',
    password: 'password1',
    artist: 'Ada Night',
    plan: 'basic',
  });
  let row = await accounts.confirmEmail(created.email);
  row = await accounts.updateCatalog(row.id, { releaseId: mine });
  const seeded = profile.upsertArtist(profile.readStored(row), {
    name: 'Ada Night',
    legal_first: 'Ada',
    legal_last: 'Night',
  });
  row = await accounts.updateProfile(row.id, { profile: seeded });
  const headers = { cookie: auth.COOKIE + '=' + auth.signSession(row.id) };
  const calls = [];
  let rejectFeatured = false;
  let pendingOnNextRead = false;
  const originalFetch = global.fetch;
  global.fetch = async function mockFetch(url, options) {
    const method = String((options && options.method) || 'GET').toUpperCase();
    const bodyText = options && options.body ? String(options.body) : '';
    calls.push({ url: String(url), method: method, body: bodyText });
    if (rejectFeatured && method === 'PATCH' && bodyText.indexOf('additional_artists') !== -1) {
      return { ok: false, status: 422, json: async () => ({ error: 'unknown field additional_artists' }) };
    }
    if (String(url).indexOf('/releases/' + mine + '/submit') !== -1 && method === 'POST') {
      pendingOnNextRead = true;
      return { ok: true, status: 200, json: async () => ({ message: 'Release submitted for review.', status: 'pending' }) };
    }
    if (String(url).indexOf('/releases/' + mine + '/dsps') !== -1) {
      return { ok: true, status: 200, json: async () => ({ dsps: [{ dsp_name: 'Spotify' }] }) };
    }
    if (String(url).indexOf('/releases/' + mine) !== -1 && method === 'PATCH') {
      return { ok: true, status: 200, json: async () => ({ release: { uuid: mine, status: 'draft' } }) };
    }
    if (String(url).indexOf('/releases/' + mine) !== -1) {
      const payload = {
        release: {
          uuid: mine,
          title: 'Night Drive',
          status: 'draft',
          artwork_url: 'https://cdn.example/night-drive.jpg',
          tracks: [
            { uuid: trackA, title: 'One', audio_url: 'https://cdn.example/one.wav' },
            { uuid: trackB, title: 'Two', audio_url: 'https://cdn.example/two.wav' },
          ],
        },
      };
      if (pendingOnNextRead) {
        payload.release.status = 'pending';
        pendingOnNextRead = false;
      }
      return { ok: true, status: 200, json: async () => payload };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  function featurePatches(from) {
    return calls.slice(from).filter(function (call) {
      return call.method === 'PATCH' && String(call.body || '').indexOf('additional_artists') !== -1;
    }).map(function (call) {
      return { url: call.url, body: JSON.parse(call.body) };
    });
  }
  const plain = {
    solo_owned_100: true,
    solo_writer_confirmed: true,
    release_date: '2026-09-12',
    made_how: 'no_ai',
    rights_confirmed: true,
    legal_first: 'Ada',
    legal_last: 'Night',
  };
  try {
    const none = mockRes();
    const beforeNone = calls.length;
    await submitRelease({ method: 'POST', headers: headers, id: mine, body: plain }, none);
    assert.strictEqual(none.statusCode, 200, none.body);
    assert.strictEqual(featurePatches(beforeNone).length, 0, 'no featured artist means no store feature credit');

    const single = mockRes();
    const beforeSingle = calls.length;
    await submitRelease({
      method: 'POST',
      headers: headers,
      id: mine,
      body: Object.assign({}, plain, {
        featured: 'Mina Cole, Jules Park',
        featured_artists: [
          { name: 'Mina Cole', artist_id: STORE_A, role: 'FeaturedArtist' },
          { name: 'Jules Park' },
        ],
      }),
    }, single);
    assert.strictEqual(single.statusCode, 200, single.body);
    const singlePatches = featurePatches(beforeSingle);
    assert.ok(singlePatches.length >= 2, 'the shared feature is sent on each track');
    singlePatches.forEach(function (patch) {
      assert.deepStrictEqual(patch.body.additional_artists, [
        { name: 'Mina Cole', role: 'FeaturedArtist', artist_id: STORE_A },
        { name: 'Jules Park', role: 'FeaturedArtist' },
      ]);
      assert.strictEqual(patch.body.contributors, undefined);
    });
    const saved = profile.readStored(await accounts.findById(row.id));
    const kept = (saved.releases || []).find(function (item) {
      return String(item.tonegrid_release_id || item.id) === mine;
    });
    assert.ok(kept, 'featured credit is stored on the Plaiground release');
    assert.strictEqual(kept.featured, 'Mina Cole, Jules Park');
    assert.strictEqual(kept.featured_artists[0].artist_id, STORE_A);
    assert.strictEqual(kept.featured_artists[0].role, 'FeaturedArtist');
    assert.deepStrictEqual(featured.reviewLines(kept).map(function (line) { return line.text; }), ['Mina Cole, Jules Park']);

    const distinct = mockRes();
    const beforeDistinct = calls.length;
    await submitRelease({
      method: 'POST',
      headers: headers,
      id: mine,
      body: Object.assign({}, plain, {
        type: 'album',
        featured_tracks: [
          { title: 'One', position: 1, track_id: trackA, featured: 'Mina Cole' },
          { title: 'Two', position: 2, track_id: trackB, featured: 'Jules Park, Nia Bell' },
        ],
      }),
    }, distinct);
    assert.strictEqual(distinct.statusCode, 200, distinct.body);
    const byTrack = {};
    featurePatches(beforeDistinct).forEach(function (patch) {
      byTrack[String(patch.url).split('/tracks/')[1]] = patch.body.additional_artists;
    });
    assert.deepStrictEqual(byTrack[trackA], [{ name: 'Mina Cole', role: 'FeaturedArtist' }]);
    assert.deepStrictEqual(byTrack[trackB], [
      { name: 'Jules Park', role: 'FeaturedArtist' },
      { name: 'Nia Bell', role: 'FeaturedArtist' },
    ]);

    rejectFeatured = true;
    const blocked = mockRes();
    const beforeBlocked = calls.length;
    await submitRelease({
      method: 'POST',
      headers: headers,
      id: mine,
      body: Object.assign({}, plain, { featured: 'Mina Cole' }),
    }, blocked);
    assert.strictEqual(blocked.statusCode, 422, blocked.body);
    assert.strictEqual(JSON.parse(blocked.body).error, 'Featured artist could not be saved. Check the name and try again.');
    assert.ok(!calls.slice(beforeBlocked).some(function (call) {
      return String(call.url).indexOf('/submit') !== -1;
    }), 'a rejected feature credit must not submit the release');
    const still = profile.readStored(await accounts.findById(row.id));
    const held = (still.releases || []).find(function (item) {
      return String(item.tonegrid_release_id || item.id) === mine;
    });
    assert.ok(held && held.featured, 'the saved feature credit remains after the store refuses the hop');
  } finally {
    if (originalFetch === undefined) delete global.fetch;
    else global.fetch = originalFetch;
    accounts.resetStore();
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
    if (prevKey === undefined) delete process.env.TONEGRID_API_KEY;
    else process.env.TONEGRID_API_KEY = prevKey;
    if (prevBase === undefined) delete process.env.TONEGRID_BASE_URL;
    else process.env.TONEGRID_BASE_URL = prevBase;
  }
}

run();
submitHop().then(function () {
  console.log('featured-artists.test.js ok');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
