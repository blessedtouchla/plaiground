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

function queryOf(req) {
  return req && req.query && typeof req.query === 'object' && !Array.isArray(req.query)
    ? req.query
    : {};
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
