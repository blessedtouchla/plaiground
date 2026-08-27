'use strict';

/**
 * Shape store analytics for PLAIGROUND. Numbers stay empty until a
 * release is actually live at the store. Does not open a new hop.
 * Distribution only — live streams and royalties paid on the existing hop.
 */

const releaseStatus = require('./release-status');

function toNumber(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(String(value).replace(/[$,]/g, '').trim());
    return isFinite(n) ? n : 0;
  }
  return 0;
}

function isLiveStatus(status) {
  return releaseStatus.isLive(status);
}

function liveIds(rows) {
  const out = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || !isLiveStatus(row.status)) return;
    const id = String(row.id || row.uuid || row.release_uuid || '').trim();
    if (id) out.push(id);
  });
  return out;
}

function emptySummary(query) {
  return {
    from: (query && query.from) || '',
    to: (query && query.to) || '',
    total_streams: 0,
    total_revenue_usd: 0,
    top_release: null,
    top_dsp: '',
    top_territory: '',
  };
}

function emptyPayload(query, extra) {
  return Object.assign({
    empty: true,
    from: (query && query.from) || '',
    to: (query && query.to) || '',
    summary: emptySummary(query),
    releases: [],
    territories: [],
    dsps: [],
    series: [],
  }, extra || {});
}

function untilLive(hasLive, payload, query) {
  if (hasLive) return payload || emptyPayload(query);
  return emptyPayload(query, payload && payload.errors ? { errors: payload.errors } : undefined);
}

function formatPeriod(period) {
  const raw = String(period || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})$/);
  if (!m) return raw;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(m[2]) - 1];
  return month ? (month + ' ' + m[1]) : raw;
}

function royaltiesPaid(statements) {
  return (Array.isArray(statements) ? statements : []).reduce((sum, row) => {
    return sum + toNumber(row && (row.total_usd != null ? row.total_usd : row.revenue_usd));
  }, 0);
}

function seriesFromStatements(statements) {
  const rows = (Array.isArray(statements) ? statements : []).map((row) => ({
    label: formatPeriod(row && (row.period || row.label || row.month)),
    streams: toNumber(row && row.streams),
    revenue_usd: toNumber(row && (row.total_usd != null ? row.total_usd : row.revenue_usd)),
  })).filter((row) => row.label);
  return rows.slice().reverse();
}

function isEmptyCatalog(data) {
  const summary = (data && data.summary) || {};
  const streams = toNumber(summary.total_streams);
  const revenue = toNumber(summary.total_revenue_usd);
  const dspTotal = ((data && data.dsps) || []).reduce((sum, row) => sum + toNumber(row.streams), 0);
  const locTotal = ((data && data.territories) || []).reduce((sum, row) => sum + toNumber(row.streams), 0);
  return streams === 0 && revenue === 0 && dspTotal === 0 && locTotal === 0;
}

module.exports = {
  emptyPayload,
  emptySummary,
  formatPeriod,
  isEmptyCatalog,
  isLiveStatus,
  liveIds,
  royaltiesPaid,
  seriesFromStatements,
  toNumber,
  untilLive,
};
