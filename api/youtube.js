'use strict';

/**
 * POST /api/youtube  { title, artist } → { videoId }
 * Server-side YouTube InnerTube search. No key in the frontend.
 */

const SEARCH_URL = 'https://www.youtube.com/youtubei/v1/search?prettyPrint=false';
const WEB_CLIENT = {
  clientName: 'WEB',
  clientVersion: '2.20260101.00.00',
  hl: 'en',
  gl: 'US',
};
const cache = new Map();

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body || '{}'));
    } catch {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function cacheKey(title, artist) {
  return (title + '\u0000' + artist).toLowerCase();
}

function isVideoId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);
}

function firstVideoRendererId(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.videoRenderer && isVideoId(node.videoRenderer.videoId)) {
    return node.videoRenderer.videoId;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      const id = firstVideoRendererId(node[i]);
      if (id) return id;
    }
    return '';
  }
  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i += 1) {
    const id = firstVideoRendererId(node[keys[i]]);
    if (id) return id;
  }
  return '';
}

function firstWatchVideoId(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.watchEndpoint && isVideoId(node.watchEndpoint.videoId)) {
    return node.watchEndpoint.videoId;
  }
  if (isVideoId(node.videoId)) return node.videoId;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      const id = firstWatchVideoId(node[i]);
      if (id) return id;
    }
    return '';
  }
  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i += 1) {
    const id = firstWatchVideoId(node[keys[i]]);
    if (id) return id;
  }
  return '';
}

function parseVideoId(payload) {
  return firstVideoRendererId(payload) || firstWatchVideoId(payload);
}

async function searchYouTube(query) {
  const response = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      context: { client: WEB_CLIENT },
      query: query,
    }),
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    const err = new Error('YouTube search failed.');
    err.status = response.status >= 400 && response.status < 600 ? response.status : 502;
    throw err;
  }
  const videoId = parseVideoId(data);
  if (!videoId) {
    const err = new Error('No video found.');
    err.status = 404;
    throw err;
  }
  return videoId;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    body = {};
  }

  const title = trim(body && body.title);
  const artist = trim(body && body.artist);
  const query = trim(body && (body.query || body.q)) || [title, artist].filter(Boolean).join(' ');
  if (!query) {
    sendJson(res, 400, { error: 'Title and artist are required.' });
    return;
  }

  const key = cacheKey(title || query, artist);
  if (cache.has(key)) {
    sendJson(res, 200, { videoId: cache.get(key) });
    return;
  }

  try {
    const videoId = await searchYouTube(query);
    cache.set(key, videoId);
    sendJson(res, 200, { videoId: videoId });
  } catch (err) {
    sendJson(res, err && err.status ? err.status : 502, {
      error: err && err.message ? err.message : 'Could not search YouTube.',
    });
  }
};

module.exports._cache = cache;
module.exports._parseVideoId = parseVideoId;
module.exports._cacheKey = cacheKey;
