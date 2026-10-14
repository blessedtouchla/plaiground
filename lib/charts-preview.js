'use strict';

/**
 * Hidden chart preview. Numbers come from a stored source or a daily pull.
 * A missing pull is Data unavailable. Spotify and TikTok stay Coming soon.
 */

const crypto = require('crypto');
const db = require('./db');

const APPLE_URL = 'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/100/songs.json';
const YOUTUBE_SEARCH = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS = 'https://www.googleapis.com/youtube/v3/videos';

const SEED = {
  artist: {
    name: 'Xania Monet',
    ai_label: 'AI',
    ai_source_name: 'billboard.com',
    ai_source_url: 'https://www.billboard.com/pro/ai-artist-xania-monet-how-much-money-songs-made/',
  },
  songs: [
    {
      slug: 'how-was-i-supposed-to-know',
      title: 'How Was I Supposed to Know?',
      charts: [
        {
          chart_name: 'R&B Digital Song Sales',
          position: 1,
          chart_date: '2025-09-20',
          source_name: 'billboard.com',
          source_url: '',
        },
        {
          chart_name: 'Adult R&B Airplay',
          position: 30,
          chart_date: '2025-11-01',
          source_name: 'billboard.com',
          source_url: '',
        },
      ],
    },
    {
      slug: 'let-go-let-god',
      title: 'Let Go, Let God',
      charts: [
        {
          chart_name: 'Hot Gospel Songs',
          position: 21,
          chart_date: '',
          source_name: '',
          source_url: '',
        },
      ],
    },
  ],
};

let artists = [];
let songs = [];
let sources = [];
let snapshots = [];
let corrections = [];
let seeded = false;

function resetStore() {
  artists = [];
  songs = [];
  sources = [];
  snapshots = [];
  corrections = [];
  seeded = false;
}

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch (err) {
    return false;
  }
}

function memoryMode() {
  return usingAccountsMemory() || !db.hasDatabase();
}

function clip(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function norm(value) {
  return clip(value, 200).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function unavailable(sourceName, sourceUrl) {
  return {
    value: 'Data unavailable',
    source_name: sourceName || 'Data unavailable',
    source_url: sourceUrl || '',
    as_of: today(),
  };
}

function comingSoon() {
  return { value: 'Coming soon', source_name: '', source_url: '', as_of: '' };
}

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  return err;
}

async function ready() {
  if (memoryMode()) return;
  const accounts = require('./accounts');
  await accounts.ensureReady();
}

function seedMemory() {
  if (seeded) return;
  const artistId = 'artist-xania-monet';
  artists = [{
    id: artistId,
    name: SEED.artist.name,
    ai_label: SEED.artist.ai_label,
    ai_source_name: SEED.artist.ai_source_name,
    ai_source_url: SEED.artist.ai_source_url,
  }];
  songs = [];
  sources = [];
  SEED.songs.forEach((song) => {
    const songId = 'song-' + song.slug;
    songs.push({ id: songId, artist_id: artistId, title: song.title, slug: song.slug });
    song.charts.forEach((chart) => {
      sources.push({
        id: crypto.randomUUID(),
        song_id: songId,
        chart_name: chart.chart_name,
        position: chart.position,
        chart_date: chart.chart_date,
        source_name: chart.source_name,
        source_url: chart.source_url,
      });
    });
  });
  seeded = true;
}

async function ensureSeed() {
  await ready();
  if (memoryMode()) {
    seedMemory();
    return;
  }
  const existing = await db.query('SELECT id FROM chart_artists WHERE name = $1 LIMIT 1', [SEED.artist.name]);
  if (existing.length) return;
  const artistId = crypto.randomUUID();
  await db.query(
    'INSERT INTO chart_artists (id, name, ai_label, ai_source_name, ai_source_url) VALUES ($1, $2, $3, $4, $5)',
    [artistId, SEED.artist.name, SEED.artist.ai_label, SEED.artist.ai_source_name, SEED.artist.ai_source_url]
  );
  for (let i = 0; i < SEED.songs.length; i += 1) {
    const song = SEED.songs[i];
    const songId = crypto.randomUUID();
    await db.query(
      'INSERT INTO chart_songs (id, artist_id, title, slug) VALUES ($1, $2, $3, $4)',
      [songId, artistId, song.title, song.slug]
    );
    for (let c = 0; c < song.charts.length; c += 1) {
      const chart = song.charts[c];
      await db.query(
        'INSERT INTO chart_sources (song_id, chart_name, position, chart_date, source_name, source_url) VALUES ($1, $2, $3, $4, $5, $6)',
        [songId, chart.chart_name, chart.position, chart.chart_date || null, chart.source_name, chart.source_url]
      );
    }
  }
}

function memorySongs() {
  seedMemory();
  return songs.map((song) => {
    const artist = artists.filter((row) => row.id === song.artist_id)[0] || {};
    return Object.assign({}, song, { artist: artist.name, ai_label: artist.ai_label, ai_source_name: artist.ai_source_name, ai_source_url: artist.ai_source_url });
  });
}

async function loadSongs() {
  await ensureSeed();
  if (memoryMode()) return memorySongs();
  const rows = await db.query(
    'SELECT s.id, s.title, s.slug, a.name AS artist, a.ai_label, a.ai_source_name, a.ai_source_url FROM chart_songs s JOIN chart_artists a ON a.id = s.artist_id ORDER BY s.title ASC'
  );
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title || ''),
    slug: String(row.slug || ''),
    artist: String(row.artist || ''),
    ai_label: String(row.ai_label || 'Unknown'),
    ai_source_name: String(row.ai_source_name || ''),
    ai_source_url: String(row.ai_source_url || ''),
  }));
}

function chartRow(source) {
  const date = source.chart_date ? String(source.chart_date).slice(0, 10) : '';
  return {
    chart_name: String(source.chart_name || ''),
    position: source.position == null || source.position === '' ? null : Number(source.position),
    value: source.position == null || source.position === '' ? 'Data unavailable' : ('No. ' + Number(source.position)),
    chart_date: date,
    as_of: date || 'Data unavailable',
    source_name: source.source_name ? String(source.source_name) : 'Data unavailable',
    source_url: String(source.source_url || ''),
  };
}

async function sourcesFor(songId) {
  if (memoryMode()) return sources.filter((row) => row.song_id === songId).map(chartRow);
  const rows = await db.query(
    'SELECT chart_name, position, chart_date, source_name, source_url FROM chart_sources WHERE song_id = $1 ORDER BY chart_date NULLS LAST, chart_name ASC',
    [songId]
  );
  return rows.map(chartRow);
}

function latestSnapshot(songId, metric) {
  const rows = snapshots
    .filter((row) => row.song_id === songId && row.metric === metric)
    .sort((a, b) => String(b.as_of).localeCompare(String(a.as_of)));
  return rows[0] || null;
}

async function snapshotFor(songId, metric, empty) {
  if (memoryMode()) {
    const row = latestSnapshot(songId, metric);
    return row ? {
      value: row.value_text,
      source_name: row.source_name || 'Data unavailable',
      source_url: row.source_url || '',
      as_of: row.as_of || 'Data unavailable',
    } : empty;
  }
  const rows = await db.query(
    'SELECT value_text, source_name, source_url, as_of FROM chart_snapshots WHERE song_id = $1 AND metric = $2 ORDER BY as_of DESC LIMIT 1',
    [songId, metric]
  );
  if (!rows[0]) return empty;
  return {
    value: String(rows[0].value_text || 'Data unavailable'),
    source_name: rows[0].source_name ? String(rows[0].source_name) : 'Data unavailable',
    source_url: String(rows[0].source_url || ''),
    as_of: rows[0].as_of ? String(rows[0].as_of).slice(0, 10) : 'Data unavailable',
  };
}

async function publicSong(song) {
  const charts = await sourcesFor(song.id);
  return {
    slug: song.slug,
    title: song.title,
    artist: song.artist,
    ai_label: song.ai_source_url ? (song.ai_label || 'Unknown') : 'Unknown',
    ai_source_name: song.ai_source_url ? song.ai_source_name : '',
    ai_source_url: song.ai_source_url || '',
    charts,
    youtube: await snapshotFor(song.id, 'youtube_views', unavailable('YouTube Data API', '')),
    apple: await snapshotFor(song.id, 'apple_most_played', unavailable('Apple Music Most Played', APPLE_URL)),
    spotify: comingSoon(),
    tiktok: comingSoon(),
  };
}

async function listPublic() {
  const rows = await loadSongs();
  const out = [];
  for (let i = 0; i < rows.length; i += 1) out.push(await publicSong(rows[i]));
  return { ok: true, songs: out };
}

async function songPublic(slug) {
  const rows = await loadSongs();
  const found = rows.filter((row) => row.slug === clip(slug, 80))[0];
  if (!found) return { ok: false, status: 404, error: 'That song is not in this preview.' };
  return { ok: true, song: await publicSong(found) };
}

async function saveSnapshot(songId, row) {
  const asOf = row.as_of || today();
  if (memoryMode()) {
    snapshots = snapshots.filter((item) => !(item.song_id === songId && item.metric === row.metric && item.as_of === asOf));
    snapshots.push({
      song_id: songId,
      metric: row.metric,
      value_text: row.value_text,
      source_name: row.source_name,
      source_url: row.source_url || '',
      as_of: asOf,
    });
    return;
  }
  await db.query(
    'INSERT INTO chart_snapshots (song_id, metric, value_text, source_name, source_url, as_of) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (song_id, metric, as_of) DO UPDATE SET value_text = EXCLUDED.value_text, source_name = EXCLUDED.source_name, source_url = EXCLUDED.source_url',
    [songId, row.metric, row.value_text, row.source_name, row.source_url || '', asOf]
  );
}

function applePosition(results, song) {
  const title = norm(song.title);
  const artist = norm(song.artist);
  let found = -1;
  (results || []).forEach((item, index) => {
    if (found !== -1) return;
    if (norm(item && item.name) === title && norm(item && item.artistName) === artist) found = index;
  });
  return found;
}

async function pullApple(fetchImpl, catalog, asOf) {
  try {
    const response = await fetchImpl(APPLE_URL, { headers: { Accept: 'application/json' } });
    if (!response || !response.ok) throw new Error('apple');
    const data = await response.json();
    const results = data && data.feed && Array.isArray(data.feed.results) ? data.feed.results : [];
    for (let i = 0; i < catalog.length; i += 1) {
      const song = catalog[i];
      const index = applePosition(results, song);
      await saveSnapshot(song.id, {
        metric: 'apple_most_played',
        value_text: index === -1 ? 'Data unavailable' : ('No. ' + (index + 1)),
        source_name: 'Apple Music Most Played',
        source_url: APPLE_URL,
        as_of: asOf,
      });
    }
    return 'updated';
  } catch (err) {
    for (let i = 0; i < catalog.length; i += 1) {
      await saveSnapshot(catalog[i].id, {
        metric: 'apple_most_played',
        value_text: 'Data unavailable',
        source_name: 'Apple Music Most Played',
        source_url: APPLE_URL,
        as_of: asOf,
      });
    }
    return 'unavailable';
  }
}

function youtubeExact(items, song) {
  const title = norm(song.title);
  const artist = norm(song.artist);
  const hits = (items || []).filter((item) => {
    const snippet = item && item.snippet ? item.snippet : {};
    const name = norm(snippet.title);
    const channel = norm(snippet.channelTitle);
    const id = item && item.id && item.id.videoId;
    if (!id || name !== title) return false;
    return channel.indexOf(artist) !== -1 || name.indexOf(artist) !== -1;
  });
  if (hits.length !== 1) return '';
  return String(hits[0].id.videoId);
}

async function pullYouTube(fetchImpl, catalog, key, asOf) {
  if (!key) {
    for (let i = 0; i < catalog.length; i += 1) {
      await saveSnapshot(catalog[i].id, {
        metric: 'youtube_views',
        value_text: 'Data unavailable',
        source_name: 'YouTube Data API',
        source_url: '',
        as_of: asOf,
      });
    }
    return 'skipped';
  }
  for (let i = 0; i < catalog.length; i += 1) {
    const song = catalog[i];
    let value = 'Data unavailable';
    let url = '';
    try {
      const searchUrl = YOUTUBE_SEARCH + '?part=snippet&type=video&maxResults=5&q=' + encodeURIComponent(song.title + ' ' + song.artist) + '&key=' + encodeURIComponent(key);
      const searched = await fetchImpl(searchUrl);
      const searchBody = searched && searched.ok ? await searched.json() : {};
      const videoId = youtubeExact(searchBody.items, song);
      if (videoId) {
        const statsUrl = YOUTUBE_VIDEOS + '?part=statistics&id=' + encodeURIComponent(videoId) + '&key=' + encodeURIComponent(key);
        const statsRes = await fetchImpl(statsUrl);
        const statsBody = statsRes && statsRes.ok ? await statsRes.json() : {};
        const count = statsBody && statsBody.items && statsBody.items[0] && statsBody.items[0].statistics
          ? statsBody.items[0].statistics.viewCount
          : '';
        if (count && /^\d+$/.test(String(count))) {
          value = String(count);
          url = 'https://www.youtube.com/watch?v=' + videoId;
        }
      }
    } catch (err) {
      value = 'Data unavailable';
      url = '';
    }
    await saveSnapshot(song.id, {
      metric: 'youtube_views',
      value_text: value,
      source_name: 'YouTube Data API',
      source_url: url,
      as_of: asOf,
    });
  }
  return 'updated';
}

async function runCron(opts) {
  const options = opts || {};
  const fetchImpl = options.fetch || fetch;
  const key = options.youtubeKey != null ? String(options.youtubeKey) : String(process.env.YOUTUBE_API_KEY || '').trim();
  const asOf = options.asOf || today();
  const catalog = await loadSongs();
  const apple = await pullApple(fetchImpl, catalog, asOf);
  const youtube = await pullYouTube(fetchImpl, catalog, key, asOf);
  return { ok: true, apple, youtube, as_of: asOf };
}

async function saveCorrection(input) {
  const source = input && typeof input === 'object' ? input : {};
  const message = clip(source.message, 2000);
  if (message.length < 4) throw validationError('Write the correction.');
  const row = {
    id: crypto.randomUUID(),
    song_slug: clip(source.song_slug || source.slug, 80),
    field_name: clip(source.field_name || source.field, 80),
    message,
    source_url: clip(source.source_url, 300),
    email: clip(source.email, 200),
    created_at: new Date().toISOString(),
  };
  await ensureSeed();
  if (memoryMode()) corrections.push(row);
  else {
    await db.query(
      'INSERT INTO chart_corrections (id, song_slug, field_name, message, source_url, email) VALUES ($1, $2, $3, $4, $5, $6)',
      [row.id, row.song_slug, row.field_name, row.message, row.source_url, row.email]
    );
  }
  return { ok: true, id: row.id, changed: false };
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body || '{}')); } catch (err) { return Promise.resolve({}); }
  }
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function queryValue(req, name) {
  if (req && req.query && req.query[name]) return String(req.query[name]);
  const url = String((req && req.url) || '');
  const mark = url.indexOf('?');
  if (mark === -1) return '';
  return new URLSearchParams(url.slice(mark + 1)).get(name) || '';
}

async function handle(req, res, action) {
  try {
    if (action === 'charts-cron') {
      const secret = String(process.env.CRON_SECRET || '').trim();
      const header = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
      if (secret && header !== 'Bearer ' + secret) {
        sendJson(res, 401, { ok: false, error: 'This cron is not open.' });
        return;
      }
      const result = await runCron();
      sendJson(res, 200, result);
      return;
    }
    if (action === 'charts-corrections') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'Use POST.' });
        return;
      }
      const body = await readBody(req);
      const saved = await saveCorrection(body);
      sendJson(res, 200, saved);
      return;
    }
    if (action === 'charts-song') {
      const result = await songPublic(queryValue(req, 'slug'));
      sendJson(res, result.status || 200, result);
      return;
    }
    const result = await listPublic();
    sendJson(res, 200, result);
  } catch (err) {
    const status = err && err.code === 'VALIDATION' ? 400 : 500;
    sendJson(res, status, { ok: false, error: err && err.message ? err.message : 'The chart preview did not load.' });
  }
}

module.exports = {
  APPLE_URL,
  SEED,
  applePosition,
  handle,
  listPublic,
  resetStore,
  runCron,
  saveCorrection,
  songPublic,
  youtubeExact,
};
