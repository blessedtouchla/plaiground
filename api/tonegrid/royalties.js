'use strict';

/**
 * GET /api/tonegrid/royalties
 * Proxies ToneGrid sandbox /royalties/balance and /royalties/statements.
 *
 * Server-only env: TONEGRID_API_KEY, TONEGRID_BASE_URL (never echo these).
 */

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

async function loadRoyalties(req, res) {
  const [balanceRes, statementsRes] = await Promise.all([
    tonegridFetch('/royalties/balance', { method: 'GET' }),
    tonegridFetch('/royalties/statements', { method: 'GET' }),
  ]);

  const errors = {};
  if (!balanceRes.ok) errors.balance = sectionError(balanceRes);
  if (!statementsRes.ok) errors.statements = sectionError(statementsRes);

  const statements = statementsRes.ok
    ? asStatements(statementsRes.data).map(pickStatement).filter(Boolean)
    : [];

  let breakdown = [];
  const latestId = statements[0] && statements[0].id;
  if (latestId && isStatementId(latestId)) {
    const detail = await tonegridFetch('/royalties/statements/' + latestId, { method: 'GET' });
    if (detail.ok) breakdown = pickBreakdown(detail.data);
    else errors.statement = sectionError(detail);
  }

  const health = healthPayload();
  const body = {
    configured: true,
    sandbox: health.sandbox,
    balance: balanceRes.ok ? pickBalance(balanceRes.data) : pickBalance({}),
    statements,
    breakdown,
  };
  if (Object.keys(errors).length) body.errors = errors;

  const anyOk = balanceRes.ok || statementsRes.ok;
  const status = anyOk ? 200 : (balanceRes.status || statementsRes.status || 502);
  sendJson(res, status, body);
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
