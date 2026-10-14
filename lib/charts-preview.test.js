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
  assert.strictEqual(listed.songs.length, 22);
  const know = listed.songs.filter((row) => row.title === 'How Was I Supposed to Know?')[0];
  const gospel = listed.songs.filter((row) => row.title === 'Let Go, Let God')[0];
  const rust = listed.songs.filter((row) => row.title === 'Walk My Walk')[0];
  const cain = listed.songs.filter((row) => row.title === "Don't Tread On Me")[0];
  const unbound = listed.songs.filter((row) => row.title === 'You Got This')[0];
  const rest = listed.songs.filter((row) => row.title === 'Find Your Rest')[0];
  const human = listed.songs.filter((row) => row.title === 'Solar Eclipse')[0];
  const enlly = listed.songs.filter((row) => row.title === 'Through My Soul')[0];
  assert.ok(know && gospel && rust && cain && unbound && rest && human && enlly);
  assert.strictEqual(know.ai_label, 'AI');
  assert.strictEqual(know.ai_source_name, 'billboard.com');
  assert.ok(know.ai_source_url.indexOf('billboard.com/lists/ai-artists-on-billboard-charts') !== -1);
  const sales = know.charts.filter((row) => row.chart_name === 'R&B Digital Song Sales')[0];
  const airplay = know.charts.filter((row) => row.chart_name === 'Adult R&B Airplay')[0];
  assert.strictEqual(sales.value, 'Peak No. 1');
  assert.strictEqual(sales.as_of, '2025-09-20');
  assert.strictEqual(sales.source_name, 'billboard.com');
  assert.strictEqual(airplay.value, 'Debut No. 30');
  assert.strictEqual(airplay.as_of, '2025-11-01');
  assert.strictEqual(airplay.source_name, 'billboard.com');
  const peak = gospel.charts.filter((row) => row.value === 'Peak No. 3')[0];
  const debut = gospel.charts.filter((row) => row.value === 'Debut No. 21')[0];
  assert.strictEqual(peak.chart_name, 'Hot Gospel Songs');
  assert.strictEqual(peak.as_of, '2025-10-25');
  assert.strictEqual(peak.source_name, 'billboard.com');
  assert.ok(peak.source_url.indexOf('billboard.com') !== -1);
  assert.strictEqual(debut.chart_name, 'Hot Gospel Songs');
  assert.strictEqual(debut.as_of, 'Data unavailable');
  assert.strictEqual(debut.source_name, 'billboard.com');
  assert.ok(debut.source_url.indexOf('billboard.com') !== -1);
  assert.strictEqual(gospel.scope_tag, '');
  assert.strictEqual(rust.ai_label, 'Unknown');
  assert.strictEqual(cain.ai_label, 'Unknown');
  assert.ok(rust.ai_note.indexOf('virtual act') !== -1);
  assert.ok(cain.ai_note.indexOf('virtual act') !== -1);
  assert.strictEqual(rust.scope_tag, 'benchmark');
  assert.strictEqual(cain.scope_tag, 'benchmark');
  assert.strictEqual(rust.charts[0].as_of, '2025-11');
  assert.strictEqual(unbound.ai_label, 'AI');
  assert.strictEqual(unbound.scope_tag, 'benchmark');
  assert.strictEqual(unbound.youtube.source_url, '');
  assert.strictEqual(enlly.ai_label, 'AI');
  assert.ok(enlly.ai_source_url.indexOf('billboard.substack.com') !== -1);
  assert.strictEqual(rest.ai_label, 'AI');
  assert.strictEqual(rest.charts[0].value, 'Position at article No. 1');
  assert.strictEqual(rest.charts[0].as_of, '2025-11');
  assert.ok(rest.ai_note.indexOf('Christopher Townsend') !== -1);
  assert.strictEqual(human.ai_label, 'Human');
  assert.strictEqual(human.genre, '');
  assert.strictEqual(human.scope_tag, '');
  assert.strictEqual(human.charts[0].value, 'Peak to date No. 1');
  assert.strictEqual(human.charts[0].as_of, '2026-10-17');
  assert.strictEqual(human.charts[0].source_name, 'billboard.com');
  assert.strictEqual(know.spotify.value, 'Coming soon');
  assert.strictEqual(know.tiktok.value, 'Coming soon');
  assert.strictEqual(know.youtube.value, 'Data unavailable');
  assert.ok(know.youtube.source_url.indexOf('mUQCcfcpTek') !== -1);
  assert.strictEqual(know.apple.value, 'Data unavailable');
  listed.songs.forEach((song) => {
    if (song.ai_label === 'AI') assert.ok(song.ai_source_url, song.title);
  });
  assert.strictEqual(listed.songs.filter((row) => row.scope_tag === 'benchmark').length, 5);

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
  assert.strictEqual(after.song.charts.filter((row) => row.chart_name === 'R&B Digital Song Sales')[0].value, 'Peak No. 1');

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
  assert.strictEqual(viewed.song.charts[0].value, 'Peak No. 1');

  const note = await charts.saveCorrection({
    song_slug: 'let-go-let-god',
    field_name: 'Hot Gospel Songs',
    message: 'The chart date is missing.',
    source_url: 'https://www.billboard.com/',
  });
  assert.strictEqual(note.ok, true);
  assert.strictEqual(note.changed, false);
  const still = await charts.songPublic('let-go-let-god');
  assert.strictEqual(still.song.charts.filter((row) => row.value === 'Peak No. 3')[0].as_of, '2025-10-25');
  assert.strictEqual(still.song.charts.filter((row) => row.value === 'Debut No. 21')[0].as_of, 'Data unavailable');

  const res = mockRes();
  await charts.handle({ method: 'GET', query: {}, url: '/api/youtube?action=charts' }, res, 'charts');
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.songs.length, 22);
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
    assert.ok(read(name).includes('href="/charts-preview.css'), name + ' css is root absolute');
  });
  assert.ok(read('charts-preview-song.html').includes('src="/charts-preview.js'));
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
