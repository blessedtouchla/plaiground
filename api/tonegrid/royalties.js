'use strict';

/**
 * GET /api/tonegrid/royalties
 * Proxies ToneGrid sandbox /royalties/balance and /royalties/statements.
 *
 * Server-only env: TONEGRID_API_KEY, TONEGRID_BASE_URL (never echo these).
 */

const { personalScope } = require('../../lib/scope');
const {
  healthPayload,
  isConfigured,
  notConfigured,
  sendJson,
  tonegridFetch,
} = require('../../lib/tonegrid');

function asObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  if (payload.balance && typeof payload.balance === 'object') return payload.balance;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    if (payload.data.balance && typeof payload.data.balance === 'object') return payload.data.balance;
    return payload.data;
  }
  return payload;
}

function asStatements(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.statements)) return payload.statements;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.statements)) return payload.data.statements;
  return [];
}

function toNumber(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(String(value).replace(/[$,]/g, '').trim());
    return isFinite(n) ? n : 0;
  }
  return 0;
}

function pickBalance(payload) {
  const raw = asObject(payload);
  return {
    available_usd: toNumber(raw.available_usd),
    pending_usd: toNumber(raw.pending_usd),
    currency: typeof raw.currency === 'string' && raw.currency ? raw.currency : 'USD',
    last_updated: typeof raw.last_updated === 'string' ? raw.last_updated : '',
  };
}

function isStatementId(value) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(String(value || ''));
}

function pickStatement(row) {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.id || '').trim();
  return {
    id,
    period: String(row.period || '').trim(),
    total_usd: toNumber(row.total_usd),
    status: String(row.status || '').trim(),
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

function pickBreakdown(payload) {
  const raw = payload && typeof payload === 'object' ? payload : {};
  const statement = raw.statement && typeof raw.statement === 'object' ? raw.statement : raw;
  const rows = Array.isArray(statement.breakdown)
    ? statement.breakdown
    : (Array.isArray(raw.breakdown) ? raw.breakdown : []);
  return rows.map((row) => ({
    release_title: String((row && row.release_title) || '').trim(),
    dsp: String((row && row.dsp) || '').trim(),
    streams: toNumber(row && row.streams),
    revenue_usd: toNumber(row && row.revenue_usd),
  }));
}

function sectionError(result) {
  if (!result || result.ok) return '';
  if (result.data && typeof result.data.error === 'string') return result.data.error;
  return 'ToneGrid rejected the request.';
}

function emptyRoyalties() {
  const health = healthPayload();
  return {
    configured: true,
    sandbox: health.sandbox,
    empty: true,
    balance: pickBalance({}),
    statements: [],
    breakdown: [],
  };
}

function unwrapRelease(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.release && typeof payload.release === 'object') return payload.release;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    if (payload.data.release && typeof payload.data.release === 'object') return payload.data.release;
    return payload.data;
  }
  return payload;
}

function lineMatches(row, allow, titles) {
  const uuid = String((row && (row.release_uuid || row.uuid)) || '').trim().toLowerCase();
  if (uuid && allow.has(uuid)) return true;
  const title = String((row && (row.release_title || row.title)) || '').trim().toLowerCase();
  return Boolean(title && titles.has(title));
}

async function loadRoyalties(req, res) {
  const scope = await personalScope(req, res);
  if (!scope) return;

  const health = healthPayload();
  if (scope.empty) {
    sendJson(res, 200, emptyRoyalties());
    return;
  }

  const titles = new Set();
  for (let i = 0; i < scope.releaseIds.length; i += 1) {
    const result = await tonegridFetch('/releases/' + scope.releaseIds[i], { method: 'GET' });
    const row = result.ok ? unwrapRelease(result.data) : null;
    const title = row && String(row.title || '').trim().toLowerCase();
    if (title) titles.add(title);
  }

  const statementsRes = await tonegridFetch('/royalties/statements', { method: 'GET' });
  const errors = {};
  if (!statementsRes.ok) errors.statements = sectionError(statementsRes);

  const listed = statementsRes.ok
    ? asStatements(statementsRes.data).map(pickStatement).filter(Boolean)
    : [];

  const statements = [];
  let breakdown = [];
  for (let i = 0; i < listed.length; i += 1) {
    const item = listed[i];
    if (!item.id || !isStatementId(item.id)) continue;
    const detail = await tonegridFetch('/royalties/statements/' + item.id, { method: 'GET' });
    if (!detail.ok) {
      errors.statement = sectionError(detail);
      continue;
    }
    const lines = pickBreakdown(detail.data).filter((row) => lineMatches(row, scope.allow, titles));
    if (!lines.length) continue;
    const total = lines.reduce((sum, row) => sum + toNumber(row.revenue_usd), 0);
    statements.push(Object.assign({}, item, { total_usd: total }));
    if (!breakdown.length) breakdown = lines;
  }

  const lifetime = statements.reduce((sum, row) => sum + toNumber(row.total_usd), 0);
  const body = {
    configured: true,
    sandbox: health.sandbox,
    empty: statements.length === 0 && breakdown.length === 0,
    balance: {
      available_usd: lifetime,
      pending_usd: 0,
      currency: 'USD',
      last_updated: '',
    },
    statements,
    breakdown,
  };
  if (Object.keys(errors).length) body.errors = errors;
  sendJson(res, 200, body);
}

module.exports = async function handler(req, res) {
  if (!isConfigured()) {
    notConfigured(res);
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await loadRoyalties(req, res);
};
