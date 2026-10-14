'use strict';

/**
 * Hidden chart preview. Numbers come from a stored source or a daily pull.
 * A missing pull is Data unavailable. Spotify and TikTok stay Coming soon.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const APPLE_URL = 'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/100/songs.json';
const YOUTUBE_SEARCH = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS = 'https://www.googleapis.com/youtube/v3/videos';

const SEED_PATH = path.join(__dirname, '..', 'artist-dev', 'chart-hub-seeds.csv');
const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => String(value).trim() !== ''));
}

function sourceName(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (err) {
    return '';
  }
}

function slugify(title) {
  return norm(title).replace(/\s+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function aiLabel(status, disclosureUrl) {
  const text = String(status || '').trim();
  if (/^human$/i.test(text)) return 'Human';
  if (/^unknown$/i.test(text)) return 'Unknown';
  if (/^AI-assisted$/i.test(text) || /^AI$/i.test(text) || /^AI \(creator [^)]+\)$/.test(text)) {
    return disclosureUrl ? 'AI' : 'Unknown';
  }
  return 'Unknown';
}

function aiNote(artist, status) {
  if (artist === 'Breaking Rust' || artist === 'Cain Walker') {
    return 'Billboard virtual act note. This source does not say the artist disclosed AI use publicly.';
  }
  const creator = String(status || '').match(/^AI \(creator ([^)]+)\)$/);
  if (creator) return 'Source names creator ' + creator[1] + '.';
  return '';
}

function positionLabel(type) {
  const text = String(type || '').trim().toLowerCase();
  if (text === 'peak') return 'Peak';
  if (text === 'debut') return 'Debut';
  if (text === 'position at article') return 'Position at article';
  if (text === 'peak to date') return 'Peak to date';
  return '';
}

function dateParts(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return { full: text, text: '' };
  if (/^\d{4}-\d{2}$/.test(text)) return { full: '', text: text };
  return { full: '', text: '' };
}

function chartsFromRow(row, chartUrl) {
  const dated = dateParts(row.chart_date);
  const base = {
    chart_name: row.chart,
    source_name: chartUrl ? sourceName(chartUrl) : '',
    source_url: chartUrl || '',
  };
  const peakDebut = String(row.position_type || '').trim().match(/^peak \(debut No\. (\d+)\)$/i);
  if (peakDebut) {
    return [
      Object.assign({}, base, {
        position: Number(row.position),
        position_label: 'Peak',
        chart_date: dated.full,
        chart_date_text: dated.text,
      }),
      Object.assign({}, base, {
        position: Number(peakDebut[1]),
        position_label: 'Debut',
        chart_date: '',
        chart_date_text: '',
      }),
    ];
  }
  return [Object.assign({}, base, {
    position: row.position === '' ? null : Number(row.position),
    position_label: positionLabel(row.position_type),
    chart_date: dated.full,
    chart_date_text: dated.text,
  })];
}

function noteChart(notes, chartUrl) {
  const match = String(notes || '').match(/^Also No\. (\d+) debut (.+) \(([A-Za-z]+) (\d{1,2}) (\d{4})\)$/);
  if (!match) return null;
  const month = MONTHS[match[3].slice(0, 3).toLowerCase()];
  if (!month) return null;
  return {
    chart_name: match[2],
    position: Number(match[1]),
    position_label: 'Debut',
    chart_date: match[5] + '-' + month + '-' + String(match[4]).padStart(2, '0'),
    chart_date_text: '',
    source_name: chartUrl ? sourceName(chartUrl) : '',
    source_url: chartUrl || '',
  };
}

function buildSeed(csvText) {
  const table = parseCsv(csvText);
  const header = (table[0] || []).map((cell) => cell.trim());
  const col = (row, name) => String(row[header.indexOf(name)] || '').trim();
  const artists = [];
  const songs = [];
  let lastDisclosure = '';
  table.slice(1).forEach((row) => {
    let disclosure = col(row, 'ai_disclosure_source');
    if (disclosure.toLowerCase() === 'same') disclosure = lastDisclosure;
    else if (disclosure) lastDisclosure = disclosure;
    let chartUrl = col(row, 'chart_source');
    if (chartUrl.toLowerCase() === 'same') chartUrl = disclosure;
    const artistName = col(row, 'artist');
    const status = col(row, 'ai_status');
    const label = aiLabel(status, disclosure);
    const note = aiNote(artistName, status);
    let artist = artists.filter((item) => item.name === artistName)[0];
    if (!artist) {
      artist = {
        name: artistName,
        ai_label: label,
        ai_source_name: label === 'Human' ? '' : sourceName(disclosure),
        ai_source_url: label === 'Human' ? '' : disclosure,
        ai_note: note,
      };
      artists.push(artist);
    } else if (note && !artist.ai_note) artist.ai_note = note;
    const charts = chartsFromRow({
      chart: col(row, 'chart'),
      position: col(row, 'position'),
      position_type: col(row, 'position_type'),
      chart_date: col(row, 'chart_date'),
    }, chartUrl);
    const extra = noteChart(col(row, 'notes'), chartUrl);
    if (extra) charts.push(extra);
    songs.push({
      slug: slugify(col(row, 'song')),
      title: col(row, 'song'),
      artist: artistName,
      genre: col(row, 'genre'),
      scope_tag: col(row, 'in_scope_genre').toLowerCase() === 'no' ? 'benchmark' : '',
      youtube_video_id: col(row, 'youtube_video_id'),
      charts,
    });
  });
  return { artists, songs };
}

const SEED = buildSeed(fs.readFileSync(SEED_PATH, 'utf8'));

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
  const artistIds = {};
  artists = SEED.artists.map((artist) => {
    const id = 'artist-' + slugify(artist.name);
    artistIds[artist.name] = id;
    return {
      id,
      name: artist.name,
      ai_label: artist.ai_label,
      ai_source_name: artist.ai_source_name,
      ai_source_url: artist.ai_source_url,
      ai_note: artist.ai_note,
    };
  });
  songs = [];
  sources = [];
  SEED.songs.forEach((song) => {
    const songId = 'song-' + song.slug;
    songs.push({
      id: songId,
      artist_id: artistIds[song.artist],
      title: song.title,
      slug: song.slug,
      genre: song.genre,
      scope_tag: song.scope_tag,
      youtube_video_id: song.youtube_video_id,
    });
    song.charts.forEach((chart) => {
      sources.push({
        id: crypto.randomUUID(),
        song_id: songId,
        chart_name: chart.chart_name,
        position: chart.position,
        chart_date: chart.chart_date,
        chart_date_text: chart.chart_date_text,
        position_label: chart.position_label,
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
  const artistIds = {};
  for (let i = 0; i < SEED.artists.length; i += 1) {
    const artist = SEED.artists[i];
    const existing = await db.query('SELECT id FROM chart_artists WHERE name = $1 LIMIT 1', [artist.name]);
    if (existing.length) {
      artistIds[artist.name] = existing[0].id;
      await db.query(
        'UPDATE chart_artists SET ai_label = $2, ai_source_name = $3, ai_source_url = $4, ai_note = $5 WHERE id = $1',
        [existing[0].id, artist.ai_label, artist.ai_source_name, artist.ai_source_url, artist.ai_note || '']
      );
    } else {
      const artistId = crypto.randomUUID();
      artistIds[artist.name] = artistId;
      await db.query(
        'INSERT INTO chart_artists (id, name, ai_label, ai_source_name, ai_source_url, ai_note) VALUES ($1, $2, $3, $4, $5, $6)',
        [artistId, artist.name, artist.ai_label, artist.ai_source_name, artist.ai_source_url, artist.ai_note || '']
      );
    }
  }
  for (let i = 0; i < SEED.songs.length; i += 1) {
    const song = SEED.songs[i];
    const found = await db.query('SELECT id FROM chart_songs WHERE slug = $1 LIMIT 1', [song.slug]);
    let songId = found.length ? found[0].id : crypto.randomUUID();
    if (found.length) {
      await db.query(
        'UPDATE chart_songs SET artist_id = $2, title = $3, genre = $4, scope_tag = $5, youtube_video_id = $6, sort_order = $7 WHERE id = $1',
        [songId, artistIds[song.artist], song.title, song.genre || '', song.scope_tag || '', song.youtube_video_id || '', i]
      );
      await db.query('DELETE FROM chart_sources WHERE song_id = $1', [songId]);
    } else {
      await db.query(
        'INSERT INTO chart_songs (id, artist_id, title, slug, genre, scope_tag, youtube_video_id, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [songId, artistIds[song.artist], song.title, song.slug, song.genre || '', song.scope_tag || '', song.youtube_video_id || '', i]
      );
    }
    for (let c = 0; c < song.charts.length; c += 1) {
      const chart = song.charts[c];
      await db.query(
        'INSERT INTO chart_sources (song_id, chart_name, position, chart_date, chart_date_text, position_label, source_name, source_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [songId, chart.chart_name, chart.position, chart.chart_date || null, chart.chart_date_text || '', chart.position_label || '', chart.source_name || '', chart.source_url || '']
      );
    }
  }
}

function memorySongs() {
  seedMemory();
  return songs.map((song) => {
    const artist = artists.filter((row) => row.id === song.artist_id)[0] || {};
    return Object.assign({}, song, {
      artist: artist.name,
      ai_label: artist.ai_label,
      ai_source_name: artist.ai_source_name,
      ai_source_url: artist.ai_source_url,
      ai_note: artist.ai_note || '',
    });
  });
}

async function loadSongs() {
  await ensureSeed();
  if (memoryMode()) return memorySongs();
  const rows = await db.query(
    'SELECT s.id, s.title, s.slug, s.genre, s.scope_tag, s.youtube_video_id, a.name AS artist, a.ai_label, a.ai_source_name, a.ai_source_url, a.ai_note FROM chart_songs s JOIN chart_artists a ON a.id = s.artist_id ORDER BY s.sort_order ASC, s.title ASC'
  );
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title || ''),
    slug: String(row.slug || ''),
    artist: String(row.artist || ''),
    genre: String(row.genre || ''),
    scope_tag: String(row.scope_tag || ''),
    youtube_video_id: String(row.youtube_video_id || ''),
    ai_label: String(row.ai_label || 'Unknown'),
    ai_source_name: String(row.ai_source_name || ''),
    ai_source_url: String(row.ai_source_url || ''),
    ai_note: String(row.ai_note || ''),
  }));
}

function isoDate(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function chartRow(source) {
  const date = isoDate(source.chart_date) || String(source.chart_date_text || '').trim();
  const label = source.position_label ? String(source.position_label).trim() : '';
  const missing = source.position == null || source.position === '';
  const number = missing ? '' : ('No. ' + Number(source.position));
  return {
    chart_name: String(source.chart_name || ''),
    position: missing ? null : Number(source.position),
    value: missing ? 'Data unavailable' : (label ? (label + ' ' + number) : number),
    chart_date: date,
    as_of: date || 'Data unavailable',
    source_name: source.source_name ? String(source.source_name) : 'Data unavailable',
    source_url: String(source.source_url || ''),
  };
}

async function sourcesFor(songId) {
  if (memoryMode()) return sources.filter((row) => row.song_id === songId).map(chartRow);
  const rows = await db.query(
    'SELECT chart_name, position, chart_date, chart_date_text, position_label, source_name, source_url FROM chart_sources WHERE song_id = $1 ORDER BY chart_date NULLS LAST, chart_name ASC',
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
  let label = song.ai_label || 'Unknown';
  if (label === 'AI' && !song.ai_source_url) label = 'Unknown';
  const youtube = await snapshotFor(song.id, 'youtube_views', unavailable('YouTube Data API', ''));
  if (song.youtube_video_id && !youtube.source_url) {
    youtube.source_url = 'https://www.youtube.com/watch?v=' + song.youtube_video_id;
    if (!youtube.source_name || youtube.source_name === 'YouTube Data API' || youtube.source_name === 'Data unavailable') {
      youtube.source_name = 'youtube.com';
    }
  }
  return {
    slug: song.slug,
    title: song.title,
    artist: song.artist,
    genre: song.genre || '',
    scope_tag: song.scope_tag || '',
    ai_label: label,
    ai_note: song.ai_note || '',
    ai_source_name: song.ai_source_url ? song.ai_source_name : '',
    ai_source_url: song.ai_source_url || '',
    charts,
    youtube,
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
