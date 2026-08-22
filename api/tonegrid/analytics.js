'use strict';

/**
 * GET /api/tonegrid/analytics
 * Proxies ToneGrid sandbox analytics (summary, releases, territories, dsps).
 *
 * Server-only env: TONEGRID_API_KEY, TONEGRID_BASE_URL (never echo these).
 * Optional query: from, to (YYYY-MM-DD), release_uuid (territories only).
 */

const { personalScope, idAllowed } = require('../../lib/scope');
const {
  healthPayload,
  isConfigured,
  isUuid,
  normalizeReleaseDate,
  notConfigured,
  sendJson,
  tonegridFetch,
} = require('../../lib/tonegrid');

function queryFromReq(req) {
  return req.query && typeof req.query === 'object' ? req.query : {};
}

function dateQuery(req) {
  const query = queryFromReq(req);
  const out = {};
  if (query.from !== undefined && query.from !== '') {
    const from = normalizeReleaseDate(query.from);
    if (!from) return { error: 'from must be YYYY-MM-DD.' };
    out.from = from;
  }
  if (query.to !== undefined && query.to !== '') {
    const to = normalizeReleaseDate(query.to);
    if (!to) return { error: 'to must be YYYY-MM-DD.' };
    out.to = to;
  }
  return { query: out };
}

function asObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    const merged = {};
    Object.keys(payload).forEach((key) => {
      if (key !== 'data') merged[key] = payload[key];
    });
    Object.keys(payload.data).forEach((key) => {
      merged[key] = payload.data[key];
    });
    return merged;
  }
  return payload;
}

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
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

function pickSummary(payload) {
  const raw = asObject(payload);
  const topRelease = raw.top_release && typeof raw.top_release === 'object' ? raw.top_release : null;
  return {
    from: typeof raw.from === 'string' ? raw.from : '',
    to: typeof raw.to === 'string' ? raw.to : '',
    total_streams: toNumber(raw.total_streams),
    total_revenue_usd: raw.total_revenue_usd == null || raw.total_revenue_usd === ''
      ? null
      : toNumber(raw.total_revenue_usd),
    top_release: topRelease
      ? {
          uuid: typeof topRelease.uuid === 'string' ? topRelease.uuid : '',
          title: typeof topRelease.title === 'string' ? topRelease.title : '',
          streams: toNumber(topRelease.streams),
        }
      : null,
    top_dsp: typeof raw.top_dsp === 'string' ? raw.top_dsp : '',
    top_territory: typeof raw.top_territory === 'string' ? raw.top_territory : '',
  };
}

function pickReleases(payload) {
  return asList(payload).map((row) => ({
    release_uuid: String((row && (row.release_uuid || row.uuid)) || '').trim(),
    title: String((row && row.title) || '').trim(),
    streams: toNumber(row && row.streams),
  }));
}

function pickTerritories(payload) {
  return asList(payload).map((row) => ({
    territory: String((row && (row.territory || row.country)) || '').trim(),
    country_name: String((row && (row.country_name || row.name)) || '').trim(),
    streams: toNumber(row && row.streams),
  }));
}

function pickDsps(payload) {
  return asList(payload).map((row) => ({
    dsp: String((row && (row.dsp || row.name || row.platform)) || '').trim(),
    streams: toNumber(row && row.streams),
  }));
}

function pickSeries(payload) {
  const raw = asObject(payload);
  const candidates = [raw.series, raw.monthly, raw.history, raw.months];
  for (let i = 0; i < candidates.length; i += 1) {
    if (!Array.isArray(candidates[i]) || !candidates[i].length) continue;
    const series = candidates[i].map((row) => ({
      label: String((row && (row.label || row.month || row.period || row.from)) || '').trim(),
      streams: toNumber(row && (row.streams != null ? row.streams : row.value)),
      revenue_usd: row && row.revenue_usd != null ? toNumber(row.revenue_usd) : null,
    })).filter((row) => row.label);
    if (series.length) return series;
  }
  return [];
}

function sectionError(result) {
  if (!result || result.ok) return '';
  if (result.data && typeof result.data.error === 'string') return result.data.error;
  return 'ToneGrid rejected the request.';
}

function emptyAnalytics(query) {
  const health = healthPayload();
  return {
    configured: true,
    sandbox: health.sandbox,
    empty: true,
    from: (query && query.from) || '',
    to: (query && query.to) || '',
    summary: pickSummary({}),
    releases: [],
    territories: [],
    dsps: [],
    series: [],
  };
}

function mergeNamed(rows, keyName) {
  const map = new Map();
  rows.forEach((row) => {
    const key = String((row && row[keyName]) || '').trim();
    if (!key) return;
    const current = map.get(key) || Object.assign({}, row, { streams: 0 });
    current.streams += toNumber(row && row.streams);
    if (!current[keyName]) current[keyName] = key;
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.streams - a.streams);
}

function summaryFromReleases(rows, query) {
  let total = 0;
  let top = null;
  rows.forEach((row) => {
    const streams = toNumber(row && row.streams);
    total += streams;
    if (!top || streams > top.streams) {
      top = {
        uuid: String((row && row.release_uuid) || ''),
        title: String((row && row.title) || ''),
        streams,
      };
    }
  });
  return {
    from: (query && query.from) || '',
    to: (query && query.to) || '',
    total_streams: total,
    total_revenue_usd: 0,
    top_release: top && top.streams ? top : null,
    top_dsp: '',
    top_territory: '',
  };
}

async function loadAnalytics(req, res) {
  const dates = dateQuery(req);
  if (dates.error) {
    sendJson(res, 400, { error: dates.error });
    return;
  }

  const scope = await personalScope(req, res);
  if (!scope) return;

  const query = dates.query || {};
  const rawRelease = String(queryFromReq(req).release_uuid || queryFromReq(req).releaseUuid || '').trim();
  if (rawRelease && !isUuid(rawRelease)) {
    sendJson(res, 400, { error: 'release_uuid must be a uuid.' });
    return;
  }
  if (rawRelease && !idAllowed(scope.allow, rawRelease)) {
    sendJson(res, 200, emptyAnalytics(query));
    return;
  }
  if (scope.empty) {
    sendJson(res, 200, emptyAnalytics(query));
    return;
  }

  const releaseFilter = rawRelease || '';
  const releasesRes = await tonegridFetch('/analytics/releases', { method: 'GET', query });
  const errors = {};
  if (!releasesRes.ok) errors.releases = sectionError(releasesRes);

  const releases = (releasesRes.ok ? pickReleases(releasesRes.data) : []).filter((row) => {
    if (releaseFilter) return String(row.release_uuid).toLowerCase() === releaseFilter.toLowerCase();
    return idAllowed(scope.allow, row.release_uuid);
  });

  const ids = releaseFilter ? [releaseFilter] : scope.releaseIds;
  const territoryLists = [];
  const dspLists = [];
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const scopedQuery = Object.assign({}, query, { release_uuid: id });
    const [territoriesRes, dspsRes] = await Promise.all([
      tonegridFetch('/analytics/territories', { method: 'GET', query: scopedQuery }),
      tonegridFetch('/analytics/dsps', { method: 'GET', query: scopedQuery }),
    ]);
    if (territoriesRes.ok) territoryLists.push(pickTerritories(territoriesRes.data));
    else errors.territories = sectionError(territoriesRes);
    if (dspsRes.ok) dspLists.push(pickDsps(dspsRes.data));
    else errors.dsps = sectionError(dspsRes);
  }

  const territories = mergeNamed(territoryLists.flat(), 'territory');
  let dsps = mergeNamed(dspLists.flat(), 'dsp');
  const userStreams = releases.reduce((sum, row) => sum + toNumber(row.streams), 0);
  const dspStreams = dsps.reduce((sum, row) => sum + toNumber(row.streams), 0);
  if (dspStreams > userStreams + 1) dsps = [];

  const summary = summaryFromReleases(releases, query);
  if (dsps[0]) summary.top_dsp = dsps[0].dsp;
  if (territories[0]) summary.top_territory = territories[0].territory || territories[0].country_name || '';

  const health = healthPayload();
  const body = {
    configured: true,
    sandbox: health.sandbox,
    empty: releases.length === 0 && userStreams === 0,
    from: summary.from || query.from || '',
    to: summary.to || query.to || '',
    summary,
    releases,
    territories,
    dsps,
    series: [],
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
  await loadAnalytics(req, res);
};

module.exports.pickSummary = pickSummary;
module.exports.pickDsps = pickDsps;
module.exports.pickTerritories = pickTerritories;
module.exports.pickSeries = pickSeries;
