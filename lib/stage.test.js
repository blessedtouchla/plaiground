'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const features = require('./features');
const songGame = require('./song-game');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

const SONG = {
  title: 'Hold the Line',
  text: '[Verse]\nCity lights on the late train home\nI keep the window cracked\n\n[Chorus]\nHold the line and stay',
  mode: 'write',
  mood: 'late night',
};

const OTHER = {
  title: 'Kitchen Light',
  text: '[Verse]\nPans on the counter\n\n[Hook]\nLeave a light on for me',
  mode: 'write',
  mood: 'warm',
};

function readyPersona() {
  return {
    vibe: ['warm', 'honest', 'late night'],
    story: 'She started in a kitchen in Los Angeles.',
    look: { chips: ['soft'], photo: 'https://cdn.example.com/vicki.jpg' },
    voice: { chips: ['smooth'], warmth: 4, energy: 2 },
    audience: { ages: '25-34', city: 'Los Angeles', going_through: 'a long week' },
    influences: { eras: ['90s'], places: ['the coast'], feelings: ['hope'] },
    colors: ['#161616', '#e2b657'],
    booking: { name: 'Vicki', email: 'book@example.com' },
  };
}

function runGame() {
  const game = songGame.build(SONG, {});
  assert.deepStrictEqual(game.hookWords, ['Hold', 'the', 'line', 'and', 'stay']);
  assert.strictEqual(game.hook, 'Hold the line and stay');
  assert.ok(game.decoys.length >= 4);
  const used = {};
  game.hookWords.forEach(function (word) { used[word.toLowerCase()] = true; });
  game.decoys.forEach(function (word) {
    assert.ok(!used[word.toLowerCase()], 'decoy ' + word);
  });
  assert.ok(!String(game.hook).includes('window cracked'));
  assert.deepStrictEqual(game.colors, ['#161616', '#7D3CFF', '#F5C542']);
  const branded = songGame.build(SONG, { colors: ['#161616', '#e2b657'] });
  assert.strictEqual(branded.colors[0], '#161616');
  assert.strictEqual(branded.colors[1], '#e2b657');
  assert.ok(!/Suno|ToneGrid/.test(JSON.stringify(game)));
  assert.strictEqual(game.levels.length, 3);
  assert.strictEqual(game.levels[0].name, 'The hook');
  assert.strictEqual(game.levels[1].name, 'Verse 1');
  assert.strictEqual(game.levels[2].name, 'The whole song');
  assert.strictEqual(game.levels[1].words[0], 'City');
  assert.ok(game.levels[2].words.indexOf('City') !== -1);
  assert.ok(game.levels[2].words.indexOf('Hold') !== -1);
  assert.strictEqual(songGame.challengeLine('Sam', 1240), "Beat Sam's score: 1,240");
  assert.strictEqual(songGame.challengeLine('', 40), "Beat Friend's score: 40");
}

function runCopy() {
  [
    'lib/features.js',
    'lib/song-game.js',
    'lib/stage.js',
    'lib/stage-stats.js',
    'lib/stage-http.js',
    'lib/stage-notes.js',
    'stage-public.js',
    'stage-page.js',
    'stage.css',
    'play.html',
    'play.js',
    'play.css',
  ].forEach(function (file) {
    const text = read(file);
    assert.ok(!/[\u2014\u2013]/.test(text), file + ' has a dash');
    assert.ok(!/Suno|ToneGrid/.test(text), file + ' names a tool');
  });
  const v2 = read('song-helper-v2.js');
  assert.ok(v2.includes('Make it a game'));
  assert.ok(v2.includes("action: 'make'"));
  assert.ok(v2.includes('It is on your stage.'));
  assert.ok(v2.includes('Your game is ready'));
  assert.ok(v2.includes("enabled('SONG_GAME_ENABLED')"));
  assert.ok(v2.includes('Send it to release') && v2.includes('Write another') && v2.includes('Replay'));
  assert.ok(read('stage-page.js').includes('Add to my stage'));
  assert.ok(read('stage-page.js').includes('Move up') && read('stage-page.js').includes('Remove'));
  assert.ok(read('play.html').includes('You caught it.'));
  assert.ok(read('play.html').includes('Play again, beat your score'));
  assert.ok(read('play.html').includes('Challenge a friend'));
  assert.ok(read('play.html').includes('Level 1. The hook'));
  assert.ok(read('play.html').includes('Make your own song on wannaplai'));
  assert.ok(read('play.html').includes('href="/destination">Roadmap</a>'));
  assert.ok(read('play.css').includes('prefers-reduced-motion'));
  assert.ok(read('epk-live.js').includes('PlaigroundStagePublic'));
  const vercel = read('vercel.json');
  assert.ok(vercel.includes('"/api/me/stage"') && vercel.includes('"/api/play"'));
  assert.ok(vercel.includes('"/play/:slug"') && vercel.includes('"/play.html?song=:slug"'));
  assert.strictEqual(features.FLAGS.STAGE_ENABLED, true);
  assert.strictEqual(features.FLAGS.SONG_GAME_ENABLED, true);
  assert.strictEqual(features.FLAGS.STAGE_STATS_ENABLED, true);
  assert.ok(!read('api/me.js').includes("require('../api/"));
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

async function runHttp() {
  const accounts = require('./accounts');
  const lyrics = require('./lyrics');
  const stage = require('./stage');
  const stageNotes = require('./stage-notes');
  const stageStats = require('./stage-stats');
  const authApi = require('../api/auth');
  const meApi = require('../api/me');
  const prev = {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };
  process.env.SESSION_SECRET = 'stage-test-secret';
  process.env.DATABASE_URL = 'postgres://memory';
  accounts.resetStore();
  accounts.useMemoryStore();
  lyrics.resetStore();
  stage.resetStore();
  stageStats.resetStore();
  stageNotes.resetStore();
  features.FLAGS.STAGE_ENABLED = true;
  features.FLAGS.SONG_GAME_ENABLED = true;
  features.FLAGS.STAGE_STATS_ENABLED = true;

  const signup = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/signup',
    headers: {},
    body: { email: 'stage@example.com', password: 'password1', artist: 'Vicki G' },
  }, signup);
  assert.strictEqual(signup.statusCode, 200, signup.body);
  await accounts.confirmEmail('stage@example.com');
  const login = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/login',
    headers: {},
    body: { email: 'stage@example.com', password: 'password1' },
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
  const published = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/artists',
    headers: { cookie: cookie },
    body: { artist_action: 'persona', id: artist.id, publish: true, persona: readyPersona() },
  }, published);
  assert.strictEqual(published.statusCode, 200, published.body);

  const saved = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/lyrics',
    headers: { cookie: cookie },
    body: { song: SONG },
  }, saved);
  assert.strictEqual(saved.statusCode, 200, saved.body);
  const lyric = JSON.parse(saved.body).song;
  assert.ok(lyric.id);

  const guest = mockRes();
  await meApi({ method: 'GET', url: '/api/me/stage', headers: {} }, guest);
  assert.strictEqual(guest.statusCode, 401, guest.body);

  const added = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/stage',
    headers: { cookie: cookie },
    body: { action: 'add', lyric_id: lyric.id },
  }, added);
  assert.strictEqual(added.statusCode, 200, added.body);
  const first = JSON.parse(added.body);
  assert.strictEqual(first.created, true);
  assert.ok(first.item.play.indexOf('/play/') === 0);
  assert.strictEqual(first.item.stats.plays, 0);

  const again = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/stage',
    headers: { cookie: cookie },
    body: { action: 'add', lyric_id: lyric.id },
  }, again);
  assert.strictEqual(JSON.parse(again.body).created, false);
  assert.strictEqual(JSON.parse(again.body).item.slug, first.item.slug);

  const otherSave = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/lyrics',
    headers: { cookie: cookie },
    body: { song: OTHER },
  }, otherSave);
  const other = JSON.parse(otherSave.body).song;
  const second = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/stage',
    headers: { cookie: cookie },
    body: { action: 'add', lyric_id: other.id },
  }, second);
  assert.strictEqual(second.statusCode, 200, second.body);
  const both = JSON.parse(second.body).items;
  assert.strictEqual(both.length, 2);
  assert.strictEqual(both[0].id, first.item.id);

  const moved = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/stage',
    headers: { cookie: cookie },
    body: { action: 'reorder', ids: [both[1].id, both[0].id] },
  }, moved);
  const ordered = JSON.parse(moved.body).items;
  assert.strictEqual(ordered[0].id, both[1].id);
  assert.strictEqual(ordered[1].id, both[0].id);

  const kit = mockRes();
  await meApi({ method: 'GET', url: '/api/epk?slug=vicki-g', headers: {} }, kit);
  assert.strictEqual(kit.statusCode, 200, kit.body);
  const epk = JSON.parse(kit.body).epk;
  assert.ok(Array.isArray(epk.stage) && epk.stage.length === 2);
  assert.ok(epk.stage.some(function (tile) { return tile.href === first.item.play; }));
  assert.ok(!JSON.stringify(epk.stage).includes('window cracked'));
  assert.ok(!JSON.stringify(epk).includes('book@example.com') || epk.booking);

  const play = mockRes();
  await meApi({ method: 'GET', url: '/api/play?slug=' + encodeURIComponent(first.item.slug), headers: {} }, play);
  assert.strictEqual(play.statusCode, 200, play.body);
  const payload = JSON.parse(play.body);
  assert.deepStrictEqual(payload.game.hookWords, ['Hold', 'the', 'line', 'and', 'stay']);
  assert.strictEqual(payload.game.levels.length, 3);
  assert.strictEqual(payload.game.levels[1].name, 'Verse 1');
  assert.strictEqual(payload.game.levels[2].name, 'The whole song');
  assert.strictEqual(payload.artist.photo, 'https://cdn.example.com/vicki.jpg');
  assert.ok(payload.artist.colors.indexOf('#161616') !== -1);
  assert.strictEqual(payload.artist.name, 'Vicki G');
  assert.ok(!JSON.stringify(payload).includes('window cracked'));
  assert.ok(!JSON.stringify(payload).includes('book@example.com'));
  assert.ok(!payload.game.text);

  const played = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/play',
    headers: { 'x-forwarded-for': '203.0.113.8' },
    body: { slug: first.item.slug, event: 'play', fan: 'fannotice1' },
  }, played);
  assert.strictEqual(played.statusCode, 200, played.body);
  const missed = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/play',
    headers: { 'x-forwarded-for': '203.0.113.8' },
    body: { slug: first.item.slug, event: 'miss', line: 'Hold the line and stay' },
  }, missed);
  assert.strictEqual(missed.statusCode, 200, missed.body);
  const finished = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/play',
    headers: { 'x-forwarded-for': '203.0.113.8' },
    body: { slug: first.item.slug, event: 'finish', score: 250 },
  }, finished);
  const low = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/play',
    headers: { 'x-forwarded-for': '203.0.113.8' },
    body: { slug: first.item.slug, event: 'finish', score: 40 },
  }, low);
  const board = mockRes();
  await meApi({ method: 'GET', url: '/api/me/stage', headers: { cookie: cookie } }, board);
  const statsItem = JSON.parse(board.body).items.find(function (item) { return item.slug === first.item.slug; });
  assert.strictEqual(statsItem.stats.plays, 1);
  assert.strictEqual(statsItem.stats.finishes, 2);
  assert.strictEqual(statsItem.stats.top_score, 250);
  assert.strictEqual(statsItem.stats.most_missed, 'Hold the line and stay');
  assert.strictEqual(statsItem.stats.levels[1], 250);

  const levelTwo = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/play',
    headers: { 'x-forwarded-for': '203.0.113.8' },
    body: { slug: first.item.slug, event: 'finish', score: 900, level: 2 },
  }, levelTwo);
  const levelBoard = mockRes();
  await meApi({ method: 'GET', url: '/api/me/stage', headers: { cookie: cookie } }, levelBoard);
  const levelItem = JSON.parse(levelBoard.body).items.find(function (item) { return item.slug === first.item.slug; });
  assert.strictEqual(levelItem.stats.levels[1], 250);
  assert.strictEqual(levelItem.stats.levels[2], 900);
  assert.strictEqual(levelItem.stats.levels[3], 0);
  assert.strictEqual(levelItem.stats.top_score, 900);

  const made = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/stage',
    headers: { cookie: cookie },
    body: {
      action: 'make',
      song: {
        title: 'Late window',
        text: '[Verse]\nOpen the late window wide\n\n[Chorus]\nSing it back to me',
        mood: 'night',
        prompt: 'a song added in one tap',
      },
    },
  }, made);
  assert.strictEqual(made.statusCode, 200, made.body);
  const madeBody = JSON.parse(made.body);
  assert.strictEqual(madeBody.created, true);
  assert.ok(madeBody.item.play.indexOf('/play/') === 0);
  const lyricList = mockRes();
  await meApi({ method: 'GET', url: '/api/me/lyrics', headers: { cookie: cookie } }, lyricList);
  assert.ok(JSON.parse(lyricList.body).songs.some(function (song) { return song.title === 'Late window'; }));

  const stageNote = mockRes();
  await meApi({
    method: 'GET',
    url: '/api/play?artist=vicki-g&fan=fannotice1&surface=stage',
    headers: {},
  }, stageNote);
  assert.strictEqual(stageNote.statusCode, 200, stageNote.body);
  assert.strictEqual(JSON.parse(stageNote.body).note, "New on Vicki G's stage");
  const playNote = mockRes();
  await meApi({
    method: 'GET',
    url: '/api/play?slug=' + encodeURIComponent(first.item.slug) + '&fan=fannotice1&surface=play',
    headers: {},
  }, playNote);
  assert.strictEqual(JSON.parse(playNote.body).note, "New on Vicki G's stage");
  const stageAgain = mockRes();
  await meApi({
    method: 'GET',
    url: '/api/play?artist=vicki-g&fan=fannotice1&surface=stage',
    headers: {},
  }, stageAgain);
  assert.strictEqual(JSON.parse(stageAgain.body).note, '');
  const playAgainNote = mockRes();
  await meApi({
    method: 'GET',
    url: '/api/play?slug=' + encodeURIComponent(first.item.slug) + '&fan=fannotice1',
    headers: {},
  }, playAgainNote);
  assert.strictEqual(JSON.parse(playAgainNote.body).note, '');

  const stranger = mockRes();
  await meApi({ method: 'GET', url: '/api/play?slug=' + encodeURIComponent(first.item.slug), headers: {} }, stranger);
  assert.ok(!JSON.parse(stranger.body).stats);

  let blocked = 0;
  for (let i = 0; i < stageStats.LIMIT + 2; i += 1) {
    const hit = mockRes();
    await meApi({
      method: 'POST',
      url: '/api/play',
      headers: { 'x-forwarded-for': '198.51.100.4' },
      body: { slug: first.item.slug, event: 'play' },
    }, hit);
    if (hit.statusCode === 429) blocked += 1;
  }
  assert.ok(blocked >= 1, 'rate limit');
  const beforeQuietRes = mockRes();
  await meApi({ method: 'GET', url: '/api/me/stage', headers: { cookie: cookie } }, beforeQuietRes);
  const beforeQuiet = JSON.parse(beforeQuietRes.body).items.find(function (item) { return item.slug === first.item.slug; });

  features.FLAGS.STAGE_STATS_ENABLED = false;
  const quiet = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/play',
    headers: { 'x-forwarded-for': '203.0.113.9' },
    body: { slug: first.item.slug, event: 'play' },
  }, quiet);
  assert.strictEqual(JSON.parse(quiet.body).saved, false);
  features.FLAGS.STAGE_STATS_ENABLED = true;
  const still = mockRes();
  await meApi({ method: 'GET', url: '/api/me/stage', headers: { cookie: cookie } }, still);
  const afterQuiet = JSON.parse(still.body).items.find(function (item) { return item.slug === first.item.slug; });
  assert.strictEqual(afterQuiet.stats.plays, beforeQuiet.stats.plays);

  features.FLAGS.SONG_GAME_ENABLED = false;
  const offGame = mockRes();
  await meApi({ method: 'GET', url: '/api/play?slug=' + encodeURIComponent(first.item.slug), headers: {} }, offGame);
  assert.strictEqual(offGame.statusCode, 404, offGame.body);
  const boardOff = mockRes();
  await meApi({ method: 'GET', url: '/api/me/stage', headers: { cookie: cookie } }, boardOff);
  assert.strictEqual(JSON.parse(boardOff.body).items[0].play, '');
  features.FLAGS.SONG_GAME_ENABLED = true;

  features.FLAGS.STAGE_ENABLED = false;
  const offStage = mockRes();
  await meApi({ method: 'GET', url: '/api/me/stage', headers: { cookie: cookie } }, offStage);
  assert.strictEqual(offStage.statusCode, 404, offStage.body);
  const stillPlay = mockRes();
  await meApi({ method: 'GET', url: '/api/play?slug=' + encodeURIComponent(first.item.slug), headers: {} }, stillPlay);
  assert.strictEqual(stillPlay.statusCode, 200, stillPlay.body);
  features.FLAGS.STAGE_ENABLED = true;

  const removed = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/stage',
    headers: { cookie: cookie },
    body: { action: 'remove', id: first.item.id },
  }, removed);
  assert.strictEqual(removed.statusCode, 200, removed.body);
  assert.ok(!JSON.parse(removed.body).items.some(function (item) { return item.id === first.item.id; }));
  const gone = mockRes();
  await meApi({ method: 'GET', url: '/api/play?slug=' + encodeURIComponent(first.item.slug), headers: {} }, gone);
  assert.strictEqual(gone.statusCode, 404, gone.body);

  const locked = mockRes();
  await meApi({
    method: 'POST',
    url: '/api/me/stage',
    headers: { cookie: cookie },
    body: { action: 'add', lyric_id: other.id, password: 'nope' },
  }, locked);
  assert.strictEqual(locked.statusCode, 400, locked.body);

  accounts.resetStore();
  Object.keys(prev).forEach(function (key) {
    if (prev[key] === undefined) delete process.env[key];
    else process.env[key] = prev[key];
  });
}

runGame();
runCopy();
runHttp().then(function () {
  console.log('stage.test.js ok');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
