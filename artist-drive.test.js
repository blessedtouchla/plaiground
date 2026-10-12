'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const artistDrive = require('./lib/artist-drive');
const profile = require('./lib/profile');
const store = require('./lib/object-store');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ARTIST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RELEASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function read(rel) {
  return fs.readFileSync(path.join(__dirname, rel), 'utf8');
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(chunk) { this.body = chunk == null ? '' : String(chunk); },
  };
}

function runModel() {
  const labels = artistDrive.FOLDERS.map((folder) => folder.label);
  assert.deepStrictEqual(labels, [
    'Profile photos',
    'Lifestyle / press photos',
    'Cover art',
    'Logos / brand',
    'Videos / clips',
    'Documents',
    'Audio',
  ]);
  const client = read('artist-drive.js');
  labels.forEach((label) => assert.ok(client.includes(label), label));

  assert.strictEqual(artistDrive.safeLink('http://cdn.example/stems'), '');
  assert.strictEqual(artistDrive.safeLink('https://user:secret@cdn.example/stems'), '');
  assert.strictEqual(artistDrive.safeLink('https://169.254.169.254/latest'), '');
  assert.strictEqual(artistDrive.safeLink('https://localhost/stems'), '');
  assert.ok(artistDrive.safeLink('https://cdn.example/stems').indexOf('https://cdn.example/stems') === 0);

  const photoKey = store.objectKey('drive-image', USER, 'press.jpg');
  const kept = profile.normalizeArtist({
    id: ARTIST,
    name: 'Night Drive',
    drive: {
      files: [{
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        folder: 'profile',
        name: 'Press face.jpg',
        object_key: photoKey,
        content_type: 'image/jpeg',
        size: 2048,
        use_in_epk: false,
      }],
    },
  });
  assert.strictEqual(kept.drive.files.length, 1);
  assert.strictEqual(kept.drive.files[0].use_in_epk, false);
  const again = profile.readStored({ profile: { artists: [kept] } });
  assert.strictEqual(again.artists[0].drive.files[0].name, 'Press face.jpg');
  assert.strictEqual(again.artists[0].drive.files[0].object_key, photoKey);

  const artist = {
    id: ARTIST,
    name: 'Night Drive',
    drive: null,
  };
  const roster = {
    artists: [artist],
    releases: [{
      id: RELEASE,
      title: 'First single',
      plaiground_artist_id: ARTIST,
      artwork_url: 'https://cdn.example/cover.jpg',
    }],
  };
  const listed = artistDrive.list(artist, roster);
  const cover = listed.files.find((file) => file.source === 'release');
  assert.ok(cover, 'linked release cover fills the cover folder');
  assert.strictEqual(cover.use_in_epk, false);
  assert.strictEqual(cover.folder, 'covers');
  const quiet = artistDrive.publicKit(artist, roster, USER, function () { return 'https://files.example/nope'; });
  assert.strictEqual(quiet.items.length, 0);

  const tagged = artistDrive.mutate(artist.drive, 'tag', { id: cover.id, use_in_epk: true });
  artist.drive = tagged.drive;
  const kit = artistDrive.publicKit(artist, roster, USER, function () { return ''; });
  assert.strictEqual(kit.items.length, 1);
  assert.strictEqual(kit.items[0].url, 'https://cdn.example/cover.jpg');
  assert.ok(!Object.prototype.hasOwnProperty.call(kit.items[0], 'object_key'));

  const hidden = artistDrive.mutate(artist.drive, 'delete', { id: cover.id });
  artist.drive = hidden.drive;
  assert.ok(!artistDrive.list(artist, roster).files.some((file) => file.source === 'release'));

  const link = artistDrive.mutate(null, 'add', { folder: 'audio', name: 'Stems', link: 'https://cdn.example/stems.zip' });
  assert.strictEqual(link.file.use_in_epk, false);
  assert.strictEqual(link.file.source, 'link');
  const bad = artistDrive.mutate(null, 'add', { folder: 'documents', link: 'https://cdn.example/contract.pdf' });
  assert.strictEqual(bad.error, 'Links belong in Audio.');
  const local = artistDrive.mutate(null, 'add', { folder: 'audio', link: 'https://10.0.0.8/stems' });
  assert.ok(/public https/i.test(local.error));
}

async function runHttp() {
  const accounts = require('./lib/accounts');
  const authApi = require('./api/auth');
  const meApi = require('./api/me');
  const prev = {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
  };
  process.env.SESSION_SECRET = 'artist-drive-test-secret';
  process.env.DATABASE_URL = 'postgres://memory';
  process.env.R2_ACCOUNT_ID = 'acct-test';
  process.env.R2_ACCESS_KEY_ID = 'AKIA-TEST-NOT-REAL';
  process.env.R2_SECRET_ACCESS_KEY = 'secret-test-not-for-commit';
  process.env.R2_BUCKET = 'plaiground-uploads';
  process.env.R2_ENDPOINT = 'https://acct-test.example.test';
  accounts.resetStore();
  accounts.useMemoryStore();

  async function authed(email) {
    const signup = mockRes();
    await authApi({
      method: 'POST',
      url: '/api/auth/signup',
      headers: {},
      body: { email: email, password: 'password1', artist: 'Night Drive' },
    }, signup);
    assert.strictEqual(signup.statusCode, 200, signup.body);
    await accounts.confirmEmail(email);
    const login = mockRes();
    await authApi({
      method: 'POST',
      url: '/api/auth/login',
      headers: {},
      body: { email: email, password: 'password1' },
    }, login);
    assert.strictEqual(login.statusCode, 200, login.body);
    const cookie = String(login.headers['Set-Cookie'] || '').split(';')[0];
    const user = (await accounts.listUsers()).find((row) => row.email === email);
    return { cookie: cookie, id: user.id };
  }

  try {
    const owner = await authed('drive-owner@example.com');
    const stranger = await authed('drive-stranger@example.com');
    const created = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/artists',
      headers: { cookie: owner.cookie },
      body: { artist_action: 'create', name: 'Night Drive', legal_first: 'Ada', legal_last: 'Example' },
    }, created);
    assert.strictEqual(created.statusCode, 200, created.body);
    const artist = JSON.parse(created.body).created;

    const signedOut = mockRes();
    await meApi({ method: 'GET', url: '/api/me/artist-drive?artist_id=' + artist.id, headers: {} }, signedOut);
    assert.strictEqual(signedOut.statusCode, 401, signedOut.body);

    const denied = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/me/artist-drive?artist_id=' + artist.id,
      headers: { cookie: stranger.cookie },
    }, denied);
    assert.strictEqual(denied.statusCode, 404, denied.body);

    const linked = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/artist-drive',
      headers: { cookie: owner.cookie },
      body: { op: 'save', artist_id: artist.id, folder: 'audio', name: 'Stems', link: 'https://cdn.example/stems' },
    }, linked);
    assert.strictEqual(linked.statusCode, 200, linked.body);
    const linkedDrive = JSON.parse(linked.body).drive;
    const audio = linkedDrive.files.find((file) => file.folder === 'audio');
    assert.ok(audio);
    assert.strictEqual(audio.use_in_epk, false);
    assert.ok(!Object.prototype.hasOwnProperty.call(audio, 'object_key'));

    const row = await accounts.findById(owner.id);
    const stored = profile.readStored(row);
    stored.releases = [{
      id: RELEASE,
      title: 'First single',
      plaiground_artist_id: artist.id,
      artwork_url: 'https://cdn.example/cover.jpg',
    }];
    await accounts.updateProfile(owner.id, { profile: stored });
    const listed = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/me/artist-drive?artist_id=' + artist.id,
      headers: { cookie: owner.cookie },
    }, listed);
    assert.strictEqual(listed.statusCode, 200, listed.body);
    const covers = JSON.parse(listed.body).drive.files.filter((file) => file.folder === 'covers');
    assert.ok(covers.some((file) => file.source === 'release' && file.name === 'First single'));

    const minted = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/artist-drive',
      headers: { cookie: owner.cookie },
      body: {
        op: 'mint',
        artist_id: artist.id,
        folder: 'profile',
        filename: 'press.jpg',
        content_type: 'image/jpeg',
        size: 4096,
      },
    }, minted);
    assert.strictEqual(minted.statusCode, 200, minted.body);
    const mint = JSON.parse(minted.body);
    assert.ok(mint.object_key.indexOf('drive/image/' + owner.id + '/') === 0);
    assert.ok(mint.upload_url.indexOf('https://') === 0);
    assert.ok(!mint.upload_url.includes('secret-test-not-for-commit'));

    const stolen = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/artist-drive',
      headers: { cookie: stranger.cookie },
      body: {
        op: 'save',
        artist_id: artist.id,
        folder: 'profile',
        name: 'press.jpg',
        object_key: mint.object_key,
        content_type: 'image/jpeg',
        size: 4096,
      },
    }, stolen);
    assert.strictEqual(stolen.statusCode, 404, stolen.body);

    const strangerArtist = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/artists',
      headers: { cookie: stranger.cookie },
      body: { artist_action: 'create', name: 'Other Act', legal_first: 'Bea', legal_last: 'Example' },
    }, strangerArtist);
    const other = JSON.parse(strangerArtist.body).created;
    const cross = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/artist-drive',
      headers: { cookie: stranger.cookie },
      body: {
        op: 'save',
        artist_id: other.id,
        folder: 'profile',
        name: 'press.jpg',
        filename: 'press.jpg',
        object_key: mint.object_key,
        content_type: 'image/jpeg',
        size: 4096,
      },
    }, cross);
    assert.strictEqual(cross.statusCode, 400, cross.body);

    const svg = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/artist-drive',
      headers: { cookie: owner.cookie },
      body: { op: 'mint', artist_id: artist.id, folder: 'logos', filename: 'logo.svg', content_type: 'image/svg+xml', size: 800 },
    }, svg);
    assert.strictEqual(svg.statusCode, 400, svg.body);
    assert.ok(/JPG or PNG/i.test(JSON.parse(svg.body).error));

    const saved = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/artist-drive',
      headers: { cookie: owner.cookie },
      body: {
        op: 'save',
        artist_id: artist.id,
        folder: 'profile',
        name: 'Press face.jpg',
        filename: 'press.jpg',
        object_key: mint.object_key,
        content_type: 'image/jpeg',
        size: 4096,
      },
    }, saved);
    assert.strictEqual(saved.statusCode, 200, saved.body);
    const photo = JSON.parse(saved.body).drive.files.find((file) => file.name === 'Press face.jpg');
    assert.ok(photo);
    assert.strictEqual(photo.use_in_epk, false);
    assert.ok(!Object.prototype.hasOwnProperty.call(photo, 'object_key'));

    const fresh = profile.readStored(await accounts.findById(owner.id));
    const night = profile.findArtist(fresh, artist.id);
    const before = artistDrive.publicKit(night, fresh, owner.id, function (userId, key) {
      return store.ownedKey(key, userId) ? 'https://files.example/signed' : '';
    });
    assert.ok(!before.items.some((item) => item.name === 'Press face.jpg'));

    const tagged = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/me/artist-drive',
      headers: { cookie: owner.cookie },
      body: { op: 'tag', artist_id: artist.id, id: photo.id, use_in_epk: true },
    }, tagged);
    assert.strictEqual(tagged.statusCode, 200, tagged.body);
    const afterRow = profile.readStored(await accounts.findById(owner.id));
    const afterArtist = profile.findArtist(afterRow, artist.id);
    const after = artistDrive.publicKit(afterArtist, afterRow, owner.id, function (userId, key) {
      return store.ownedKey(key, userId) ? 'https://files.example/signed' : '';
    });
    const kitPhoto = after.items.find((item) => item.name === 'Press face.jpg');
    assert.ok(kitPhoto);
    assert.strictEqual(kitPhoto.url, 'https://files.example/signed');
    assert.strictEqual(after.hero, 'https://files.example/signed');
    assert.ok(!JSON.stringify(after).includes(mint.object_key));
  } finally {
    Object.keys(prev).forEach((name) => {
      if (prev[name] === undefined) delete process.env[name];
      else process.env[name] = prev[name];
    });
  }
}

function runCopy() {
  ['artist-drive.js', 'artist-drive.css', 'artist-drive-preview.html', 'lib/artist-drive.js', 'lib/artist-drive-http.js'].forEach((file) => {
    const text = read(file);
    assert.ok(!/[\u2014\u2013]/.test(text), file + ' has an em dash');
    assert.ok(!/\bSuno\b/i.test(text), file + ' names Suno');
    assert.ok(!/\bToneGrid\b/.test(text), file + ' names ToneGrid');
  });
  const html = read('artists.html');
  assert.ok(html.includes('id="artist-drive"'));
  assert.ok(!/>Admin</.test(html.match(/<nav class="side-nav">[\s\S]*?<\/nav>/)[0]));
  const vercel = read('vercel.json');
  assert.ok(vercel.includes('/api/me/artist-drive'));
  const apiFiles = fs.readdirSync(path.join(__dirname, 'api')).filter((name) => name.endsWith('.js'));
  assert.ok(apiFiles.length <= 12, 'serverless function count');
}

runModel();
runCopy();
runHttp().then(() => {
  console.log('artist-drive.test.js ok');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
