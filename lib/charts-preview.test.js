'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const charts = require('./charts-preview');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[key] = value; },
    end(payload) { this.body = payload; },
  };
}

(async function () {
  charts.resetStore();
  const listed = await charts.listPublic();
  assert.strictEqual(listed.songs.length, 2);
  assert.deepStrictEqual(listed.songs.map((row) => row.artist), ['Xania Monet', 'Xania Monet']);
  const know = listed.songs.filter((row) => row.title === 'How Was I Supposed to Know?')[0];
  const gospel = listed.songs.filter((row) => row.title === 'Let Go, Let God')[0];
  assert.ok(know);
  assert.ok(gospel);
  assert.strictEqual(know.ai_label, 'AI');
  assert.strictEqual(know.ai_source_name, 'billboard.com');
  assert.ok(know.ai_source_url.indexOf('billboard.com') !== -1);
  const sales = know.charts.filter((row) => row.chart_name === 'R&B Digital Song Sales')[0];
  const airplay = know.charts.filter((row) => row.chart_name === 'Adult R&B Airplay')[0];
  assert.strictEqual(sales.value, 'No. 1');
  assert.strictEqual(sales.as_of, '2025-09-20');
  assert.strictEqual(sales.source_name, 'billboard.com');
  assert.strictEqual(airplay.value, 'No. 30');
  assert.strictEqual(airplay.as_of, '2025-11-01');
  assert.strictEqual(airplay.source_name, 'billboard.com');
  const hot = gospel.charts[0];
  assert.strictEqual(hot.chart_name, 'Hot Gospel Songs');
  assert.strictEqual(hot.value, 'No. 21');
  assert.strictEqual(hot.as_of, 'Data unavailable');
  assert.strictEqual(hot.source_name, 'Data unavailable');
  assert.strictEqual(know.spotify.value, 'Coming soon');
  assert.strictEqual(know.tiktok.value, 'Coming soon');
  assert.strictEqual(know.youtube.value, 'Data unavailable');
  assert.strictEqual(know.apple.value, 'Data unavailable');
  assert.ok(!listed.songs.some((row) => row.artist !== 'Xania Monet'));

  const appleBody = {
    feed: {
      results: [
        { name: 'Someone Else', artistName: 'Other' },
        { name: 'How Was I Supposed to Know?', artistName: 'Xania Monet' },
      ],
    },
  };
  const fetched = [];
  const fetchImpl = async function (url) {
    fetched.push(url);
    if (String(url).indexOf('most-played') !== -1) {
      return { ok: true, json: async function () { return appleBody; } };
    }
    return { ok: false, json: async function () { return {}; } };
  };
  const cron = await charts.runCron({ fetch: fetchImpl, youtubeKey: '', asOf: '2026-10-14' });
  assert.strictEqual(cron.ok, true);
  assert.strictEqual(cron.youtube, 'skipped');
  assert.strictEqual(cron.apple, 'updated');
  const after = await charts.songPublic('how-was-i-supposed-to-know');
  assert.strictEqual(after.song.apple.value, 'No. 2');
  assert.strictEqual(after.song.apple.source_name, 'Apple Music Most Played');
  assert.strictEqual(after.song.apple.as_of, '2026-10-14');
  assert.strictEqual(after.song.youtube.value, 'Data unavailable');
  const missed = await charts.songPublic('let-go-let-god');
  assert.strictEqual(missed.song.apple.value, 'Data unavailable');
  assert.strictEqual(after.song.charts.filter((row) => row.chart_name === 'R&B Digital Song Sales')[0].value, 'No. 1');

  const searchItems = [
    { id: { videoId: 'abcdefghijk' }, snippet: { title: 'How Was I Supposed to Know?', channelTitle: 'Xania Monet' } },
    { id: { videoId: 'zzzzzzzzzzz' }, snippet: { title: 'How Was I Supposed to Know? Live', channelTitle: 'Xania Monet' } },
  ];
  assert.strictEqual(charts.youtubeExact(searchItems, { title: 'How Was I Supposed to Know?', artist: 'Xania Monet' }), 'abcdefghijk');
  assert.strictEqual(charts.youtubeExact(searchItems.concat(searchItems[0]), { title: 'How Was I Supposed to Know?', artist: 'Xania Monet' }), '');

  const withViews = await charts.runCron({
    asOf: '2026-10-14',
    youtubeKey: 'test-key',
    fetch: async function (url) {
      const href = String(url);
      if (href.indexOf('most-played') !== -1) return { ok: false, json: async function () { return {}; } };
      if (href.indexOf('/search') !== -1) return { ok: true, json: async function () { return { items: searchItems }; } };
      if (href.indexOf('/videos') !== -1) {
        return { ok: true, json: async function () { return { items: [{ statistics: { viewCount: '42' } }] }; } };
      }
      return { ok: false, json: async function () { return {}; } };
    },
  });
  assert.strictEqual(withViews.apple, 'unavailable');
  const viewed = await charts.songPublic('how-was-i-supposed-to-know');
  assert.strictEqual(viewed.song.youtube.value, '42');
  assert.strictEqual(viewed.song.youtube.source_name, 'YouTube Data API');
  assert.ok(viewed.song.youtube.source_url.indexOf('abcdefghijk') !== -1);
  assert.strictEqual(viewed.song.charts[0].value, 'No. 1');

  const note = await charts.saveCorrection({
    song_slug: 'let-go-let-god',
    field_name: 'Hot Gospel Songs',
    message: 'The chart date is missing.',
    source_url: 'https://www.billboard.com/',
  });
  assert.strictEqual(note.ok, true);
  assert.strictEqual(note.changed, false);
  const still = await charts.songPublic('let-go-let-god');
  assert.strictEqual(still.song.charts[0].value, 'No. 21');
  assert.strictEqual(still.song.charts[0].as_of, 'Data unavailable');

  const res = mockRes();
  await charts.handle({ method: 'GET', query: {}, url: '/api/youtube?action=charts' }, res, 'charts');
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.songs.length, 2);
  assert.strictEqual(res.headers['X-Robots-Tag'], 'noindex, nofollow');

  const pages = [
    'charts-preview.html',
    'charts-preview-song.html',
    'charts-preview-method.html',
    'charts-preview-correct.html',
    'charts-preview.js',
  ];
  pages.forEach(function (name) {
    const blob = read(name);
    assert.ok(!/—|–/.test(blob), name + ' has an em dash');
    assert.ok(!/Suno|ToneGrid/i.test(blob), name + ' names a generator');
  });
  pages.slice(0, 4).forEach(function (name) {
    assert.ok(read(name).includes('noindex, nofollow'), name + ' is noindex');
  });
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(vercel.rewrites.some((row) => row.source === '/charts-preview' && row.destination === '/charts-preview.html'));
  assert.ok(vercel.crons.some((row) => row.path === '/api/charts-preview/cron'));
  assert.strictEqual(fs.readdirSync(path.join(__dirname, '..', 'api')).filter((name) => name.endsWith('.js')).length, 12);
  assert.ok(read('schema.sql').includes('CREATE TABLE IF NOT EXISTS chart_songs'));
  assert.ok(read('schema.sql').includes('CREATE TABLE IF NOT EXISTS chart_artists'));
  assert.ok(read('schema.sql').includes('CREATE TABLE IF NOT EXISTS chart_snapshots'));
  assert.ok(read('schema.sql').includes('CREATE TABLE IF NOT EXISTS chart_sources'));
  console.log('lib/charts-preview.test.js ok');
}()).catch(function (err) {
  console.error(err);
  process.exit(1);
});
