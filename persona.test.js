'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const persona = require('./lib/persona');
const personaImport = require('./lib/persona-import');
const personaPdf = require('./lib/persona-pdf');
const profile = require('./lib/profile');
const artistProfiles = require('./artist-profiles');
const epkLive = require('./epk-live');

function read(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8');
}

function readyPersona() {
  return {
    vibe: ['warm', 'honest', 'late night'],
    story: 'She started in a kitchen in Los Angeles.',
    look: { chips: ['soft'], photo: 'https://cdn.example.com/vicki.jpg' },
    voice: { chips: ['smooth'], warmth: 4, energy: 2 },
    audience: { ages: '25-34', city: 'Los Angeles', going_through: 'a long week' },
    influences: { eras: ['90s'], places: ['the coast'], feelings: ['hope'], extra: ['Drake'] },
    colors: ['#161616', '#e2b657'],
    booking: { name: 'Vicki', email: 'book@example.com' },
  };
}

function runModel() {
  const tooMany = persona.normalize({ vibe: ['warm', 'honest', 'raw', 'bold', 'soft'], story: 'A start.' });
  assert.ok(tooMany.vibe.length <= 3);

  const named = persona.normalize({
    story: 'A start.',
    influences: { eras: ['90s', 'Drake'], places: ['Taylor Swift'], feelings: ['hope'] },
  });
  assert.deepStrictEqual(named.influences.eras, ['90s']);
  assert.deepStrictEqual(named.influences.places, []);
  assert.deepStrictEqual(named.influences.feelings, ['hope']);
  assert.strictEqual(JSON.stringify(named).indexOf('Drake'), -1);
  assert.strictEqual(JSON.stringify(named).indexOf('Taylor'), -1);

  const partial = persona.normalize({ vibe: ['warm'], story: 'A start.' });
  const questions = persona.asks(partial).map((item) => item.ask).join(' ');
  assert.ok(questions.indexOf('brand colors') !== -1);
  assert.ok(questions.toLowerCase().indexOf('password') === -1);
  assert.ok(!persona.asks(partial).some((item) => item.field === 'vibe' || item.field === 'story'));

  const meter = persona.progress(persona.normalize(readyPersona()));
  assert.strictEqual(meter.ready, true);
  assert.ok(meter.label.indexOf('Complete your persona to unlock your auto EPK') !== -1);
  assert.ok(!/[\u2014\u2013]/.test(meter.label));

  const linked = persona.linkReleases({
    artists: [{ id: 'local-1', name: 'Vicki G', tonegrid_artist_id: '11111111-1111-1111-1111-111111111111' }],
    releases: [{ id: 'rel-1', title: 'Kitchen Light', tonegrid_artist_id: '11111111-1111-1111-1111-111111111111' }],
  });
  assert.strictEqual(linked.changed, true);
  assert.strictEqual(linked.profile.releases[0].plaiground_artist_id, 'local-1');
  assert.strictEqual(linked.profile.releases[0].artist, 'Vicki G');
  const again = persona.linkReleases(linked.profile);
  assert.strictEqual(again.changed, false);

  const stored = profile.normalizeArtist({
    name: 'Vicki G',
    persona: Object.assign({ published: true }, readyPersona()),
  });
  assert.strictEqual(stored.persona.published, true);
  assert.strictEqual(stored.persona.slug, 'vicki-g');
  const release = profile.normalizeRelease({
    title: 'Kitchen Light',
    tonegrid_artist_id: '11111111-1111-1111-1111-111111111111',
    plaiground_artist_id: stored.id,
    upc: '123456789012',
  });
  assert.strictEqual(release.tonegrid_artist_id, '11111111-1111-1111-1111-111111111111');
  const kept = profile.upsertRelease({ releases: [release] }, { id: release.id, title: 'Kitchen Light' });
  assert.strictEqual(kept.releases[0].plaiground_artist_id, stored.id);
  assert.strictEqual(kept.releases[0].upc, '123456789012');

  const hidden = persona.epkView(stored, { artists: [stored], releases: [release] });
  assert.ok(hidden && hidden.published);
  assert.ok(hidden.credit.indexOf('Human + AI') !== -1);
  assert.strictEqual(hidden.releases[0].title, 'Kitchen Light');
  assert.ok(!hidden.tonegrid_artist_id);
  const draft = profile.normalizeArtist({ name: 'Vicki G', persona: readyPersona() });
  assert.strictEqual(persona.epkView(draft, { artists: [draft], releases: [] }), null);
  const preview = persona.epkView(draft, { artists: [draft], releases: [] }, { preview: true });
  assert.strictEqual(preview.preview, true);

  const pdf = personaPdf.build(hidden);
  assert.ok(pdf.indexOf('%PDF-1.4') === 0);
  assert.ok(pdf.indexOf('Vicki G') !== -1);

  const savedProfiles = artistProfiles.normalize({
    artists: [{ id: 'a1', name: 'Vicki G', persona: { story: 'Kitchen light.', vibe: ['warm'] }, picked: true }],
  });
  assert.strictEqual(savedProfiles.artists[0].persona.story, 'Kitchen light.');

  assert.deepStrictEqual(persona.trackArtistFields('Vicki G'), {
    primary_artist: 'Vicki G',
    artist_name: 'Vicki G',
  });

  assert.strictEqual(epkLive.slugFromLocation({ pathname: '/epk/vicki-g', search: '' }), 'vicki-g');
  assert.strictEqual(epkLive.slugFromLocation({ pathname: '/epk', search: '' }), '');
  const page = epkLive.render(hidden);
  assert.ok(page.indexOf('Vicki G') !== -1);
  assert.ok(page.indexOf('Human + AI') !== -1);
  assert.ok(page.indexOf('Suno') === -1);
  assert.ok(page.indexOf('ToneGrid') === -1);
}

async function runImport() {
  const calls = [];
  function fakeFetch(url) {
    calls.push(String(url));
    if (String(url).indexOf('robots.txt') !== -1) {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'text/plain' },
        text: async () => 'User-agent: *\nDisallow: /private\n',
      });
    }
    if (String(url).indexOf('oembed') !== -1) {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({
          title: 'Kitchen Light',
          thumbnail_url: 'https://cdn.example.com/cover.jpg',
          author_name: 'Vicki G',
        }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, headers: { get: () => '' }, text: async () => '' });
  }
  const deps = { fetch: fakeFetch, configured: false };
  const blocked = await personaImport.extract('https://press.example.com/private/story', deps);
  assert.ok(blocked.skipped.some((row) => row.reason === 'robots'));
  assert.ok(!calls.some((url) => url.indexOf('/private/story') !== -1 && url.indexOf('robots') === -1));

  const local = await personaImport.extract('http://127.0.0.1/admin bio text is not a link', deps);
  assert.strictEqual(local.ok, true);
  assert.ok(!calls.some((url) => url.indexOf('127.0.0.1') !== -1));

  const secret = await personaImport.extract('password: hunter2', deps);
  assert.strictEqual(secret.ok, false);
  assert.ok(/password/i.test(secret.error));
  assert.ok(!calls.some((url) => url.indexOf('hunter2') !== -1));

  const imported = await personaImport.extract(
    'https://open.spotify.com/track/abc Kitchen years. "The chorus still wrecks me every single night."',
    deps
  );
  assert.strictEqual(imported.ok, true);
  assert.strictEqual(imported.published, false);
  assert.strictEqual(imported.suggestions.published, false);
  assert.ok(imported.suggestions.imported_releases.some((row) => row.title === 'Kitchen Light'));
  assert.strictEqual(imported.suggestions.imported_releases[0].cover, 'https://cdn.example.com/cover.jpg');
  assert.ok(imported.sources.imported_releases.indexOf('spotify.com') !== -1);
  assert.ok(imported.suggestions.press.some((row) => row.quote.indexOf('chorus') !== -1));
  assert.strictEqual(JSON.stringify(imported).indexOf('hunter2'), -1);
  assert.ok(imported.asks.every((item) => item.ask.toLowerCase().indexOf('password') === -1));
}

function runCopy() {
  ['persona-page.js', 'epk-live.js', 'persona.css', 'lib/persona.js', 'lib/persona-import.js', 'lib/persona-http.js'].forEach((file) => {
    const text = read(file);
    assert.ok(!/[\u2014\u2013]/.test(text), file + ' has an em dash');
    assert.ok(!/\bSuno\b/i.test(text), file + ' names Suno');
    assert.ok(!/\bToneGrid\b/.test(text), file + ' names ToneGrid');
    assert.ok(!/XAI_API_KEY/.test(text), file + ' leaks the AI key');
  });
  const panel = read('artists.html').split('id="persona-builder"')[1].split('data-artist-songs')[0];
  assert.ok(!/[\u2014\u2013]/.test(panel));
  assert.ok(!/Suno|ToneGrid|password/i.test(panel));
  const vercel = read('vercel.json');
  assert.ok(vercel.indexOf('/api/me/persona-import') !== -1);
  assert.ok(vercel.indexOf('/api/epk') !== -1);
  assert.ok(vercel.indexOf('/epk/:slug') !== -1);
  const apiFiles = fs.readdirSync(path.join(__dirname, 'api')).filter((name) => name.endsWith('.js'));
  assert.ok(apiFiles.length <= 12, 'serverless function count');
  const tonegrid = read('api/tonegrid.js');
  assert.ok(tonegrid.indexOf('primary_artist') !== -1);
  assert.ok(tonegrid.indexOf('linkStoredRelease') !== -1);
  assert.ok(tonegrid.indexOf('trackArtistRejected') !== -1);
}

async function runHttp() {
  const accounts = require('./lib/accounts');
  const authApi = require('./api/auth');
  const meApi = require('./api/me');
  const prev = {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    XAI_API_KEY: process.env.XAI_API_KEY,
  };
  process.env.SESSION_SECRET = 'persona-test-secret';
  process.env.DATABASE_URL = 'postgres://memory';
  delete process.env.XAI_API_KEY;
  accounts.resetStore();
  accounts.useMemoryStore();
  function mockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: '',
      setHeader(name, value) { this.headers[name] = value; },
      end(chunk) { this.body = chunk == null ? '' : String(chunk); },
    };
  }
  const signup = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/signup',
    headers: {},
    body: { email: 'vicki@example.com', password: 'password1', artist: 'Vicki G' },
  }, signup);
  assert.strictEqual(signup.statusCode, 200, signup.body);
  await accounts.confirmEmail('vicki@example.com');
  const login = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/login',
    headers: {},
    body: { email: 'vicki@example.com', password: 'password1' },
  }, login);
  assert.strictEqual(login.statusCode, 200, login.body);
  const cookie = String(login.headers['Set-Cookie'] || '').split(';')[0];
  const created = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/artists',
    headers: { cookie: cookie },
    body: { artist_action: 'create', name: 'Vicki G', legal_first: 'Victoria', legal_last: 'Example' },
  }, created);
  assert.strictEqual(created.statusCode, 200, created.body);
  const artist = JSON.parse(created.body).created;
  assert.ok(artist && artist.id);
  const early = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/artists',
    headers: { cookie: cookie },
    body: { artist_action: 'persona', id: artist.id, publish: true, persona: { story: 'Only a story.' } },
  }, early);
  assert.strictEqual(early.statusCode, 400, early.body);
  const saved = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/artists',
    headers: { cookie: cookie },
    body: { artist_action: 'persona', id: artist.id, publish: true, persona: readyPersona() },
  }, saved);
  assert.strictEqual(saved.statusCode, 200, saved.body);
  const savedJson = JSON.parse(saved.body);
  assert.strictEqual(savedJson.published, true);
  assert.strictEqual(savedJson.profiles_saved, true);
  const pub = mockRes();
  await meApi({ method: 'GET', url: '/api/epk?slug=vicki-g', headers: {} }, pub);
  assert.strictEqual(pub.statusCode, 200, pub.body);
  const kit = JSON.parse(pub.body).epk;
  assert.strictEqual(kit.name, 'Vicki G');
  assert.ok(kit.credit.indexOf('Human + AI') !== -1);
  assert.ok(!JSON.parse(pub.body).password);
  const pdf = mockRes();
  await meApi({ method: 'GET', url: '/api/epk?slug=vicki-g&format=pdf', headers: {} }, pdf);
  assert.ok(String(pdf.body).indexOf('%PDF') === 0);
  const pasted = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/persona-import',
    headers: { cookie: cookie },
    body: { text: 'She started in a kitchen. "The chorus still wrecks me every single night."' },
  }, pasted);
  assert.strictEqual(pasted.statusCode, 200, pasted.body);
  const pasteJson = JSON.parse(pasted.body);
  assert.strictEqual(pasteJson.published, false);
  assert.ok(pasteJson.suggestions.story);
  assert.ok(pasteJson.sources.story);
  const denied = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/persona-import',
    headers: { cookie: cookie },
    body: { text: 'hello', password: 'nope' },
  }, denied);
  assert.strictEqual(denied.statusCode, 400);
  const row = await accounts.findByEmail('vicki@example.com');
  await accounts.updateProfile(row.id, {
    profile: profile.upsertRelease(profile.readStored(row), {
      id: 'rel-http',
      title: 'Old Song',
      tonegrid_artist_id: '22222222-2222-2222-2222-222222222222',
    }),
  });
  const withArtist = profile.readStored(await accounts.findByEmail('vicki@example.com'));
  withArtist.artists[0].tonegrid_artist_id = '22222222-2222-2222-2222-222222222222';
  await accounts.updateProfile(row.id, { profile: withArtist });
  const backfill = mockRes();
  await meApi({ method: 'GET', url: '/api/me/artists', headers: { cookie: cookie } }, backfill);
  assert.strictEqual(backfill.statusCode, 200, backfill.body);
  const releases = JSON.parse(backfill.body).profile.releases;
  assert.strictEqual(releases[0].plaiground_artist_id, withArtist.artists[0].id);
  accounts.resetStore();
  Object.keys(prev).forEach(function (key) {
    if (prev[key] === undefined) delete process.env[key];
    else process.env[key] = prev[key];
  });
}

runModel();
runCopy();
runImport().then(runHttp).then(function () {
  console.log('persona.test.js ok');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
