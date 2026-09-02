'use strict';

/**
 * Owner-only hybrid admin. Reads PLAIGROUND accounts, Stripe GET lists, and
 * the live catalog / deliveries hop we already use. Never writes Stripe.
 * Never invents UPC, ISRC, destinations, dates, or money.
 */

const { listUsers } = require('./accounts');
const { listSignupRows } = require('./admin-signups');
const { listEvents } = require('./growth-events');
const { normalizePlan } = require('./auth');
const { collectPriceIds, planFromPriceIds, retrieveStripe } = require('./stripe-webhook');
const releaseStatus = require('./release-status');
const livePlayer = require('./live-player');
const { LIST_HOP_TIMEOUT_MS, isUuid, tonegridFetch } = require('./tonegrid');

const KNOWN_STATUS = {
  live: true,
  delivered: true,
  approved: true,
  processing: true,
  delivering: true,
  qc_inspection: true,
  pending: true,
  pending_review: true,
  rejected: true,
  needs_fix: true,
  needsfix: true,
  error: true,
  failed: true,
  fail: true,
  delivery_failed: true,
  delivery_fail: true,
  qc_rejected: true,
  qc_reject: true,
  qc_failed: true,
  draft: true,
  signatures: true,
  taken_down: true,
  takedown_submitted: true,
  takedown_failed: true,
  takedown_fail: true,
};

function isoDate(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function dayDate(value) {
  const iso = isoDate(value);
  return iso ? iso.slice(0, 10) : '';
}

function asObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    if (payload.data.release && typeof payload.data.release === 'object') return payload.data.release;
    return payload.data;
  }
  if (payload.release && typeof payload.release === 'object') return payload.release;
  return payload;
}

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
  if (Array.isArray(payload.deliveries)) return payload.deliveries;
  if (payload.data && Array.isArray(payload.data.deliveries)) return payload.data.deliveries;
  if (Array.isArray(payload.statements)) return payload.statements;
  if (payload.data && Array.isArray(payload.data.statements)) return payload.data.statements;
  return [];
}

function sanitizePartner(text) {
  return releaseStatus.sanitizeAlert(text);
}

function destinationName(row) {
  return livePlayer.destinationName(row);
}

function pickAdminDeliveries(payload) {
  return livePlayer.pickDeliveries(payload).map((row) => ({
    destination: row.dsp_name || destinationName(row),
    status: row.label || livePlayer.deliveryLabel(row.status),
    landed: row.label === 'Landed',
    failed: row.label === 'Failed',
  })).filter((row) => row.destination);
}

function firstText() {
  for (let i = 0; i < arguments.length; i += 1) {
    const value = arguments[i];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function pickUpc(row) {
  if (!row || typeof row !== 'object') return '';
  const ids = row.identifiers && typeof row.identifiers === 'object' ? row.identifiers : {};
  return firstText(row.upc, row.UPC, row.barcode, row.ean, row.ean13, ids.upc, ids.barcode, ids.ean);
}

function pickIsrc(row) {
  if (!row || typeof row !== 'object') return '';
  const codes = [];
  const seen = {};
  function push(value) {
    const code = String(value || '').trim();
    if (!code || seen[code]) return;
    seen[code] = true;
    codes.push(code);
  }
  push(row.isrc || row.ISRC);
  const tracks = Array.isArray(row.tracks)
    ? row.tracks
    : (row.tracks && Array.isArray(row.tracks.data) ? row.tracks.data : []);
  tracks.forEach((track) => {
    if (!track || typeof track !== 'object') return;
    push(track.isrc || track.ISRC);
  });
  return codes.join(', ');
}

function pickStreetDate(row) {
  if (!row || typeof row !== 'object') return '';
  return dayDate(row.street_date || row.release_date || row.releaseDate);
}

function pickLiveDate(row) {
  if (!row || typeof row !== 'object') return '';
  return dayDate(
    row.live_at
    || row.live_date
    || row.delivered_at
    || row.delivered_on
    || row.published_at
    || row.went_live_at
    || row.actually_live_at
  );
}

function adminStatusLabel(status) {
  const s = releaseStatus.normalize(status);
  if (!s) return 'Unknown';
  if (!KNOWN_STATUS[s]) return 'Unknown';
  return releaseStatus.label(s);
}

function qcAdminStatus(adminLabel, status, alert) {
  if (releaseStatus.isQcRejected && releaseStatus.isQcRejected(status)) return 'QC rejected';
  if (adminLabel !== 'Unknown' && alert) return 'Needs fix';
  return adminLabel;
}

function takedownLabel(status) {
  const s = releaseStatus.normalize(status);
  if (s === 'takedown_failed' || s === 'takedown_fail') return 'Takedown failed';
  if (s === 'taken_down' || s === 'takedown_submitted') return 'Taken down';
  return '';
}

function customerIdOf(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (typeof obj.customer === 'string' && obj.customer.indexOf('cus_') === 0) return obj.customer;
  if (obj.customer && typeof obj.customer === 'object' && obj.customer.id) {
    return String(obj.customer.id);
  }
  return '';
}

function emailFromStripe(obj, customers) {
  const customerId = customerIdOf(obj);
  if (customerId && customers[customerId]) return customers[customerId];
  const details = obj && obj.customer_details && typeof obj.customer_details === 'object'
    ? obj.customer_details
    : {};
  return firstText(obj && obj.customer_email, details.email, obj && obj.receipt_email, obj && obj.email);
}

function customerMap(users) {
  const map = {};
  (users || []).forEach((row) => {
    const id = String((row && row.stripe_customer_id) || '').trim();
    if (id) map[id] = String(row.email || '');
  });
  return map;
}

function planOf(obj, email, users) {
  const fromPrice = planFromPriceIds(collectPriceIds(obj));
  if (fromPrice) return fromPrice;
  const meta = obj && obj.metadata && typeof obj.metadata === 'object' ? obj.metadata : {};
  const fromMeta = normalizePlan(meta.plan);
  if (fromMeta) return fromMeta;
  const match = (users || []).find((row) => String(row.email || '') === email);
  return normalizePlan(match && match.plan);
}

function amountCents(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const keys = ['amount_total', 'amount_captured', 'amount_refunded', 'amount', 'amount_paid'];
  for (let i = 0; i < keys.length; i += 1) {
    const n = Number(obj[keys[i]]);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

async function stripeList(retrieve, path) {
  const fetchObj = typeof retrieve === 'function' ? retrieve : retrieveStripe;
  let list;
  try {
    list = await fetchObj(path);
  } catch {
    return [];
  }
  if (!list || typeof list !== 'object' || list.error) return [];
  return Array.isArray(list.data) ? list.data : [];
}

function moneyRow(kind, obj, users, customers) {
  const email = emailFromStripe(obj, customers);
  return {
    kind: kind,
    id: String((obj && obj.id) || ''),
    email: email,
    plan: planOf(obj, email, users) || '',
    amount_cents: amountCents(obj),
    currency: String((obj && obj.currency) || 'usd').toLowerCase(),
    status: String((obj && obj.status) || '').trim(),
    created_at: isoDate(obj && (obj.created || obj.arrival_date)),
  };
}

async function listPaidCheckouts(users, retrieve) {
  const customers = customerMap(users);
  const rows = await stripeList(retrieve, 'checkout/sessions?limit=100');
  return rows
    .filter((row) => row && String(row.payment_status || '') === 'paid')
    .map((row) => {
      const email = emailFromStripe(row, customers);
      return {
        id: String(row.id || ''),
        email: email,
        plan: planOf(row, email, users) || '',
        amount_cents: amountCents(row),
        currency: String(row.currency || 'usd').toLowerCase(),
        status: 'paid',
        paid_at: isoDate(row.created),
      };
    })
    .sort((a, b) => String(b.paid_at || '').localeCompare(String(a.paid_at || '')));
}

async function listSubscriptions(users, retrieve) {
  const customers = customerMap(users);
  const rows = await stripeList(retrieve, 'subscriptions?status=all&limit=100');
  return rows
    .filter((row) => row && row.id)
    .map((row) => {
      const email = emailFromStripe(row, customers);
      return {
        id: String(row.id || ''),
        email: email,
        plan: planOf(row, email, users) || '',
        status: String(row.status || '').trim(),
        started_at: isoDate(row.start_date || row.created),
      };
    })
    .sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));
}

async function listMoney(users, retrieve) {
  const customers = customerMap(users);
  const [charges, refunds, payouts] = await Promise.all([
    stripeList(retrieve, 'charges?limit=100'),
    stripeList(retrieve, 'refunds?limit=100'),
    stripeList(retrieve, 'payouts?limit=100'),
  ]);
  const rows = []
    .concat(charges.map((row) => moneyRow('charge', row, users, customers)))
    .concat(refunds.map((row) => moneyRow('refund', row, users, customers)))
    .concat(payouts.map((row) => moneyRow('payout', row, users, customers)));
  rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return {
    charges: rows.filter((row) => row.kind === 'charge'),
    refunds: rows.filter((row) => row.kind === 'refund'),
    payouts: rows.filter((row) => row.kind === 'payout'),
    rows: rows,
  };
}

function storedReleasesOf(user) {
  const out = [];
  const seen = {};
  const ids = Array.isArray(user && user.tonegrid_release_ids) ? user.tonegrid_release_ids : [];
  const times = Array.isArray(user && user.tonegrid_release_at) ? user.tonegrid_release_at : [];
  const profileRows = user && user.profile && Array.isArray(user.profile.releases)
    ? user.profile.releases
    : [];
  const byId = {};
  profileRows.forEach((row) => {
    const id = String((row && (row.tonegrid_release_id || row.id)) || '').trim();
    if (id) byId[id.toLowerCase()] = row;
  });
  ids.forEach((raw, index) => {
    const id = String(raw || '').trim();
    if (!id || !isUuid(id)) return;
    const key = id.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    out.push({
      id: id,
      stored: byId[key] || null,
      submitted_at: isoDate(times[index]),
    });
  });
  profileRows.forEach((row) => {
    const id = String((row && (row.tonegrid_release_id || row.id)) || '').trim();
    if (!id || !isUuid(id)) return;
    const key = id.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    out.push({ id: id, stored: row, submitted_at: '' });
  });
  return out;
}

function submissionFrom(user, item, live, deliveries) {
  const stored = item.stored || {};
  const title = firstText(live && live.title, stored.title);
  if (releaseStatus.isPlaceholderRelease({ title: title })) return null;
  const status = firstText(live && (live.status || live.tonegrid_status), stored.tonegrid_status, stored.status);
  const merged = Object.assign({}, stored, live || {});
  const shown = releaseStatus.displayInfo(merged, status);
  const adminLabel = adminStatusLabel(status);
  const alert = sanitizePartner(shown && shown.alert);
  return {
    id: item.id,
    email: String((user && user.email) || ''),
    artist: firstText(live && (typeof live.artist === 'string' ? live.artist : live.artist && live.artist.name), stored.artist, user && user.artist_name),
    title: title,
    status: qcAdminStatus(adminLabel, status, alert),
    alert: alert,
    upc: pickUpc(live || stored),
    isrc: pickIsrc(live || stored),
    street_date: pickStreetDate(live || stored),
    live_date: pickLiveDate(live),
    takedown: takedownLabel(status),
    submitted_at: item.submitted_at || isoDate(live && live.created_at),
    deliveries: Array.isArray(deliveries) ? deliveries : [],
  };
}

async function listSubmissions(users, storeFetch) {
  const fetchStore = typeof storeFetch === 'function' ? storeFetch : tonegridFetch;
  const jobs = [];
  (users || []).forEach((user) => {
    storedReleasesOf(user).forEach((item) => {
      jobs.push({ user: user, item: item });
    });
  });
  const fetched = await Promise.all(jobs.map(async (job) => {
    let live = null;
    let deliveries = [];
    try {
      const result = await fetchStore('/releases/' + job.item.id, {
        method: 'GET',
        timeoutMs: LIST_HOP_TIMEOUT_MS,
      });
      if (result && result.ok) live = asObject(result.data);
    } catch {
      live = null;
    }
    try {
      const hop = await fetchStore('/releases/' + job.item.id + '/ddex/deliveries', {
        method: 'GET',
        timeoutMs: LIST_HOP_TIMEOUT_MS,
      });
      if (hop && hop.ok) {
        deliveries = pickAdminDeliveries(hop.data);
      } else {
        const fallback = await fetchStore('/releases/' + job.item.id + '/distribution', {
          method: 'GET',
          timeoutMs: LIST_HOP_TIMEOUT_MS,
        });
        if (fallback && fallback.ok) deliveries = pickAdminDeliveries(fallback.data);
      }
    } catch {
      deliveries = [];
    }
    if (live && Array.isArray(live.deliveries) && !deliveries.length) {
      deliveries = pickAdminDeliveries(live.deliveries);
    }
    return submissionFrom(job.user, job.item, live, deliveries);
  }));
  return fetched.filter(Boolean).sort((a, b) => {
    const left = String(b.submitted_at || b.live_date || b.street_date || '');
    const right = String(a.submitted_at || a.live_date || a.street_date || '');
    return left.localeCompare(right);
  });
}

function toMoneyNumber(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(String(value).replace(/[$,]/g, '').trim());
    return isFinite(n) ? n : null;
  }
  return null;
}

function pickRoyaltyLines(payload) {
  const raw = payload && typeof payload === 'object' ? payload : {};
  const statement = raw.statement && typeof raw.statement === 'object' ? raw.statement : raw;
  const rows = Array.isArray(statement.breakdown)
    ? statement.breakdown
    : (Array.isArray(raw.breakdown) ? raw.breakdown : []);
  return rows.map((row) => ({
    title: firstText(row && (row.release_title || row.title)),
    destination: livePlayer.destinationName(row) || sanitizePartner(firstText(row && row.dsp)),
    streams: toMoneyNumber(row && row.streams),
    amount_usd: toMoneyNumber(row && row.revenue_usd),
  })).filter((row) => row.title || row.destination || row.amount_usd != null || row.streams != null);
}

async function listStoreRoyalties(storeFetch) {
  const fetchStore = typeof storeFetch === 'function' ? storeFetch : tonegridFetch;
  let listed = [];
  try {
    const result = await fetchStore('/royalties/statements', { method: 'GET' });
    if (!result || !result.ok) return [];
    listed = asList(result.data).filter((row) => row && (row.id || row.period));
  } catch {
    return [];
  }
  const out = [];
  for (let i = 0; i < listed.length; i += 1) {
    const item = listed[i];
    const period = firstText(item.period);
    const status = firstText(item.status);
    let lines = [];
    if (item.id) {
      try {
        const detail = await fetchStore('/royalties/statements/' + String(item.id).trim(), { method: 'GET' });
        if (detail && detail.ok) lines = pickRoyaltyLines(detail.data);
      } catch {
        lines = [];
      }
    }
    if (!lines.length) {
      const total = toMoneyNumber(item.total_usd);
      if (period || total != null) {
        out.push({
          period: period,
          destination: '',
          title: '',
          streams: null,
          amount_usd: total,
          status: status,
        });
      }
      continue;
    }
    lines.forEach((line) => {
      out.push({
        period: period,
        destination: line.destination,
        title: line.title,
        streams: line.streams,
        amount_usd: line.amount_usd,
        status: status,
      });
    });
  }
  return out;
}

function eventNameLabel(value) {
  const name = String(value || '').trim().toLowerCase();
  if (name === 'signup') return 'signup';
  if (name === 'first_upload') return 'first_upload';
  if (name === 'first_store_live') return 'first_store_live';
  if (name === 'paid') return 'paid';
  return '';
}

async function listGrowthEventRows(users) {
  const events = await listEvents();
  const byId = {};
  (users || []).forEach((row) => {
    if (row && row.id) byId[String(row.id)] = row;
  });
  return events.map((row) => {
    const user = byId[String(row && row.user_id)] || {};
    return {
      email: user.email ? String(user.email) : '',
      event: eventNameLabel(row && row.event_name),
      created_at: isoDate(row && row.created_at),
    };
  }).filter((row) => row.event);
}

async function listAdminOverview(options) {
  const retrieve = options && options.retrieve;
  const storeFetch = options && options.storeFetch;
  const users = await listUsers();
  const [signups, checkouts, subscriptions, money, submissions, storeRoyalties, events] = await Promise.all([
    listSignupRows({ retrieve: retrieve }),
    listPaidCheckouts(users, retrieve),
    listSubscriptions(users, retrieve),
    listMoney(users, retrieve),
    listSubmissions(users, storeFetch),
    listStoreRoyalties(storeFetch),
    listGrowthEventRows(users),
  ]);
  return {
    signups: signups,
    checkouts: checkouts,
    subscriptions: subscriptions,
    money: money,
    submissions: submissions,
    store_royalties: storeRoyalties,
    events: events,
  };
}

module.exports = {
  adminStatusLabel,
  listAdminOverview,
  pickAdminDeliveries,
  pickIsrc,
  pickLiveDate,
  pickStreetDate,
  pickUpc,
  takedownLabel,
};
