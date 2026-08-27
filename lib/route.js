'use strict';

/**
 * Resolve the public API path after a vercel.json rewrite.
 * Prefer req.url (tests and most runtimes), then rewrite query, then headers.
 */

function pathnameOf(req) {
  const headers = req && req.headers && typeof req.headers === 'object' ? req.headers : {};
  const candidates = [
    req && req.url,
    headers['x-forwarded-uri'],
    headers['x-vercel-original-url'],
    headers['x-invoke-path'],
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const raw = candidates[i] == null ? '' : String(candidates[i]);
    if (!raw) continue;
    try {
      const path = new URL(raw, 'http://localhost').pathname;
      const trimmed = path.replace(/\/+$/, '') || '/';
      if (trimmed && trimmed !== '/') return trimmed;
    } catch {
      const path = raw.split('?')[0].replace(/\/+$/, '') || '/';
      if (path && path !== '/') return path;
    }
  }
  return '';
}

function searchParamsOf(raw) {
  const text = raw == null ? '' : String(raw);
  if (!text || text.indexOf('?') === -1) return {};
  try {
    const out = {};
    new URL(text, 'http://localhost').searchParams.forEach((value, key) => {
      if (key && out[key] == null) out[key] = value;
    });
    return out;
  } catch {
    const out = {};
    String(text.split('?')[1] || '').split('&').forEach((part) => {
      if (!part) return;
      const idx = part.indexOf('=');
      const key = decodeURIComponent((idx === -1 ? part : part.slice(0, idx)).replace(/\+/g, ' '));
      const value = idx === -1 ? '' : decodeURIComponent(part.slice(idx + 1).replace(/\+/g, ' '));
      if (key && out[key] == null) out[key] = value;
    });
    return out;
  }
}

function queryFromUrl(req) {
  const headers = req && req.headers && typeof req.headers === 'object' ? req.headers : {};
  const candidates = [
    req && req.url,
    headers['x-forwarded-uri'],
    headers['x-vercel-original-url'],
  ];
  const out = {};
  for (let i = 0; i < candidates.length; i += 1) {
    Object.assign(out, searchParamsOf(candidates[i]));
  }
  return out;
}

function queryOf(req) {
  const fromReq = req && req.query && typeof req.query === 'object' && !Array.isArray(req.query)
    ? req.query
    : {};
  // Hobby rewrites land on /api/me?resource=artists. Vercel sometimes leaves
  // that only on req.url, so URL search must count even when req.query is empty.
  return Object.assign({}, queryFromUrl(req), fromReq);
}

function queryValue(req, key) {
  const value = queryOf(req)[key];
  if (value == null || value === '') return '';
  return String(Array.isArray(value) ? value[0] : value).trim();
}

module.exports = {
  pathnameOf,
  queryOf,
  queryValue,
};
