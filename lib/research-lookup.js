'use strict';

const research = require('./research-portal');
const person = require('./research-person');

const USER_AGENT = 'PLAIGROUND-research/1.0 (https://www.wannaplai.com/contact)';
const GAP_MS = 1100;
const WINDOW_MS = 10 * 60 * 1000;
const IP_LIMIT = 30;
const CACHE_MAX = 40;
const CACHE_TTL = 10 * 60 * 1000;
const BODY_LIMIT = 20000;
const RESPONSE_LIMIT = 800000;

const state = {
  nextAt: 0,
  hits: new Map(),
  cache: []
};

function resetState() {
  state.nextAt = 0;
  state.hits = new Map();
  state.cache = [];
}

function sendJson(res, status, body, extra) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (extra && extra.retryAfter) res.setHeader('Retry-After', String(extra.retryAfter));
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body || '{}')); } catch (err) { return Promise.resolve(null); }
  }
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        failed = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) {
        resolve(null);
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try { resolve(JSON.parse(raw)); } catch (err) { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

function clientIp(req) {
  const headers = (req && req.headers) || {};
  const real = String(headers['x-real-ip'] || headers['X-Real-Ip'] || '').trim();
  if (real) return real.slice(0, 80);
  const vercel = String(headers['x-vercel-forwarded-for'] || headers['X-Vercel-Forwarded-For'] || '').split(',')[0].trim();
  if (vercel) return vercel.slice(0, 80);
  const forwarded = String(headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '');
  const parts = forwarded.split(',').map(function (part) { return part.trim(); }).filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : '';
  return (last || (req.socket && req.socket.remoteAddress) || 'local').slice(0, 80);
}

function pruneHits(now, ip) {
  const rows = (state.hits.get(ip) || []).filter((at) => now - at < WINDOW_MS);
  state.hits.set(ip, rows);
  if (state.hits.size > 500) {
    const oldest = state.hits.keys().next().value;
    state.hits.delete(oldest);
  }
  return rows;
}

function cacheGet(key, now) {
  const row = state.cache.find((item) => item.key === key && now - item.at < CACHE_TTL);
  return row ? row.body : null;
}

function cacheSet(key, body, now) {
  state.cache = state.cache.filter((item) => item.key !== key && now - item.at < CACHE_TTL);
  state.cache.push({ key: key, at: now, body: body });
  if (state.cache.length > CACHE_MAX) state.cache.shift();
}

function operation(body) {
  const op = body && body.op ? String(body.op) : '';
  const q = body && body.q ? String(body.q) : '';
  if (op === 'person') return person.planSearch(body);
  if (op === 'person-profile' || op === 'person-credits') return person.planDetail(op, body);
  if (op === 'entity' || op === 'recordings' || op === 'works') {
    return research.requestFor(null, { op: op, q: research.trim(q) });
  }
  return research.requestFor(research.parseSeed(q), null);
}

function personOp(body) {
  const op = body && body.op ? String(body.op) : '';
  return op === 'person' || op === 'person-profile' || op === 'person-credits';
}

async function pacedFetch(fetchImpl, nowFn, deps, url, first) {
  if (!first) {
    const wait = state.nextAt - nowFn();
    if (wait > 0) {
      if (deps.wait) await deps.wait(wait);
      else await new Promise(function (resolve) { setTimeout(resolve, wait); });
    }
  }
  state.nextAt = nowFn() + GAP_MS;
  return fetchJson(fetchImpl, url);
}

async function readLimited(response) {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > RESPONSE_LIMIT) {
    const err = new Error('too-big');
    err.statusName = 'busy';
    throw err;
  }
  const text = await response.text();
  if (text.length > RESPONSE_LIMIT) {
    const err = new Error('too-big');
    err.statusName = 'busy';
    throw err;
  }
  const type = String(response.headers.get('content-type') || '');
  if (type.indexOf('json') === -1 && type.indexOf('sparql-results') === -1) {
    const err = new Error('not-json');
    err.statusName = response.status === 429 ? 'rate-limit' : 'busy';
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    const parseErr = new Error('not-json');
    parseErr.statusName = 'busy';
    throw parseErr;
  }
}

function normalize(op, q, payload, checkedAt, labelMap) {
  if (payload && payload.error) {
    const code = String(payload.error.code || '');
    if (code === 'maxlag' || code === 'ratelimited') return research.failure(code === 'ratelimited' ? 'rate-limit' : 'busy', 503);
    return research.failure('busy', 503);
  }
  if (op === 'search') return research.normalizeSearch(payload, checkedAt);
  if (op === 'entity') return research.normalizeEntity(payload, q, checkedAt, labelMap || {});
  return research.normalizeSparql(payload, op, checkedAt);
}

async function fetchJson(fetchImpl, url) {
  if (!research.allowedFetchUrl(url)) {
    const err = new Error('blocked');
    err.statusName = 'invalid';
    throw err;
  }
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 12000) : null;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: 'application/json, application/sparql-results+json',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': USER_AGENT
      },
      signal: controller ? controller.signal : undefined
    });
    if (response.status >= 300 && response.status < 400) {
      const err = new Error('redirect');
      err.statusName = 'busy';
      throw err;
    }
    if (!response.ok) {
      const err = new Error('status');
      err.statusName = research.classifyStatus(response.status);
      err.http = response.status;
      throw err;
    }
    return readLimited(response);
  } catch (err) {
    if (err && err.statusName) throw err;
    const wrapped = new Error('network');
    wrapped.statusName = 'offline';
    throw wrapped;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function handle(req, res, deps) {
  deps = deps || {};
  const fetchImpl = deps.fetch || global.fetch;
  const nowFn = deps.now || Date.now;
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'POST');
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, research.failure('invalid', 405));
    return;
  }
  const body = await readBody(req);
  if (!body) {
    sendJson(res, 400, research.failure('invalid', 400));
    return;
  }
  const built = operation(body);
  const personRequest = !!(built && built.requests);
  const urlsOk = personRequest
    ? built.requests.every(function (row) { return research.allowedFetchUrl(row.url); })
    : !!(built && built.url && research.allowedFetchUrl(built.url));
  if (!built || !urlsOk) {
    sendJson(res, 400, personOp(body) ? person.personFailure('invalid') : research.failure('invalid', 400));
    return;
  }
  const now = nowFn();
  const ip = clientIp(req);
  const hits = pruneHits(now, ip);
  if (hits.length >= IP_LIMIT) {
    sendJson(res, 429, personRequest ? person.personFailure('rate-limit') : research.failure('rate-limit', 429), { retryAfter: 30 });
    return;
  }
  if (now < state.nextAt) {
    const wait = Math.ceil((state.nextAt - now) / 1000) || 1;
    sendJson(res, 429, personRequest ? person.personFailure('rate-limit') : research.failure('rate-limit', 429), { retryAfter: wait });
    return;
  }
  const cacheKey = built.op + '\n' + built.q + '\n' + (built.platform || '');
  const cached = cacheGet(cacheKey, now);
  if (cached) {
    hits.push(now);
    state.hits.set(ip, hits);
    sendJson(res, 200, cached);
    return;
  }
  state.nextAt = now + GAP_MS;
  hits.push(now);
  state.hits.set(ip, hits);
  const checkedAt = new Date(now).toISOString();
  if (personRequest) {
    const payloads = {};
    const errors = {};
    for (let i = 0; i < built.requests.length; i += 1) {
      const row = built.requests[i];
      try {
        payloads[row.key] = await pacedFetch(fetchImpl, nowFn, deps, row.url, i === 0);
      } catch (err) {
        const http = err && err.http;
        const name = err && err.statusName ? err.statusName : 'offline';
        errors[row.key] = http === 401 || http === 403 ? 'blocked' : name;
      }
    }
    const pack = Object.assign({ errors: errors }, payloads);
    const normalized = built.op === 'person'
      ? person.normalizePersonSearch(pack, built.person, checkedAt)
      : built.op === 'person-profile'
        ? person.normalizePersonProfile(pack, built.profile, checkedAt)
        : person.normalizePersonCredits(pack, built.profile, checkedAt);
    if (Object.keys(payloads).length) cacheSet(cacheKey, normalized, nowFn());
    sendJson(res, 200, normalized);
    return;
  }
  try {
    const payload = await fetchJson(fetchImpl, built.url);
    let labelMap = {};
    if (built.op === 'entity') {
      const ids = research.collectItemQids(payload, built.q);
      if (ids.length) {
        const labelUrl = 'https://www.wikidata.org/w/api.php?action=wbgetentities&ids='
          + encodeURIComponent(ids.join('|'))
          + '&props=labels&languages=en&format=json&maxlag=5&origin=*';
        if (research.allowedFetchUrl(labelUrl)) {
          const wait = state.nextAt - nowFn();
          if (deps.wait) await deps.wait(wait);
          else if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
          state.nextAt = nowFn() + GAP_MS;
          try {
            const labelled = await fetchJson(fetchImpl, labelUrl);
            labelMap = (labelled && labelled.entities) || {};
          } catch (err) {
            labelMap = {};
          }
        }
      }
    }
    const normalized = normalize(built.op, built.q, payload, checkedAt, labelMap);
    if (!normalized.ok) {
      const http = normalized.status === 'rate-limit' ? 429 : 503;
      sendJson(res, http, normalized, normalized.status === 'rate-limit' ? { retryAfter: 5 } : null);
      return;
    }
    cacheSet(cacheKey, normalized, nowFn());
    sendJson(res, 200, normalized);
  } catch (err) {
    const name = err && err.statusName ? err.statusName : 'offline';
    const http = name === 'rate-limit' ? 429 : name === 'invalid' ? 400 : 503;
    sendJson(res, http, research.failure(name, http), name === 'rate-limit' ? { retryAfter: 5 } : null);
  }
}

module.exports = {
  handle: handle,
  resetState: resetState,
  USER_AGENT: USER_AGENT
};
