'use strict';

/**
 * Per-store delivery status board (read only).
 * Normalizes the distributor per-DSP delivery rows into
 * { store, status, label, tone, live_at, submitted_at, store_url, confirmed, note }.
 *
 * Never invents a green check: a store only gets tone "live" when it reports live
 * AND sent a real store release ID or link that we can open.
 * The distributor docs say stores still in onboarding run on a "simulated timeline"
 * (about 1 min submitted -> accepted -> live) with identical payloads, so a live row
 * with no store ID, or one that went live within a few minutes of submit, is shown as
 * "Reported by distributor, not yet confirmed".
 * Customer copy never names the distributor. Say "delivery status".
 */

var UNCONFIRMED_COPY = 'Reported by distributor, not yet confirmed';
var SIMULATED_WINDOW_MS = 10 * 60 * 1000;
var PARTNER_RE = /tonegrid|interspace|distrokid/i;

var STATUS = {
  pending: { label: 'Pending', tone: 'wait' },
  queued: { label: 'Pending', tone: 'wait' },
  submitted: { label: 'Processing', tone: 'wait' },
  processing: { label: 'Processing', tone: 'wait' },
  update_submitted: { label: 'Processing', tone: 'wait' },
  accepted: { label: 'Accepted', tone: 'wait' },
  live: { label: 'Landed', tone: 'live' },
  delivered: { label: 'Landed', tone: 'live' },
  rejected: { label: 'Failed', tone: 'bad' },
  failed: { label: 'Failed', tone: 'bad' },
  error: { label: 'Failed', tone: 'bad' },
  takedown_submitted: { label: 'Removing', tone: 'off' },
  taken_down: { label: 'Taken down', tone: 'off' },
};

function trim(v) { return String(v == null ? '' : v).trim(); }
function key(v) { return trim(v).toLowerCase().replace(/-/g, '_'); }
function slug(v) { return trim(v).toLowerCase().replace(/[_\s]+/g, '-'); }

function httpUrl(v) {
  var s = trim(v);
  return /^https:\/\//i.test(s) ? s : '';
}

function prettyStore(row) {
  var name = trim(row.dsp_name || row.store || row.name || '');
  if (name && !PARTNER_RE.test(name)) return name;
  var s = slug(row.dsp || row.dsp_slug || '');
  if (!s || PARTNER_RE.test(s)) return '';
  var known = { 'apple-music': 'Apple Music', 'youtube-music': 'YouTube Music', 'amazon-music': 'Amazon Music', tidal: 'TIDAL', iheartradio: 'iHeartRadio', jiosaavn: 'JioSaavn', kkbox: 'KKBOX', tiktok: 'TikTok', 'tiktok-music': 'TikTok Music', soundcloud: 'SoundCloud' };
  if (known[s]) return known[s];
  return s.replace(/-+/g, ' ').replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
}

function storeLink(dsp, id, url) {
  var href = httpUrl(url);
  if (href && !PARTNER_RE.test(href)) return href;
  var raw = trim(id);
  if (!raw) return '';
  var sp = raw.match(/spotify:(album|track):([A-Za-z0-9]{16,})/i);
  if (sp) return 'https://open.spotify.com/' + sp[1].toLowerCase() + '/' + sp[2];
  if (dsp === 'spotify' && /^[A-Za-z0-9]{22}$/.test(raw)) return 'https://open.spotify.com/album/' + raw;
  if (dsp.indexOf('apple') === 0) {
    var ap = raw.match(/(\d{6,})/);
    if (ap) return 'https://music.apple.com/album/' + ap[1];
  }
  if (dsp === 'deezer' && /^\d+$/.test(raw)) return 'https://www.deezer.com/album/' + raw;
  if (dsp === 'tidal' && /^\d+$/.test(raw)) return 'https://tidal.com/browse/album/' + raw;
  if (dsp.indexOf('youtube') === 0 && /^(OLAK5uy|PL)[A-Za-z0-9_-]+$/.test(raw)) return 'https://music.youtube.com/playlist?list=' + raw;
  return '';
}

function toMs(v) {
  var t = Date.parse(trim(v));
  return isNaN(t) ? 0 : t;
}

function dateOnly(v) {
  var s = trim(v);
  var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function listOf(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.deliveries)) return payload.deliveries;
  if (payload.data && Array.isArray(payload.data.deliveries)) return payload.data.deliveries;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.dsps)) return payload.dsps;
  return [];
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return null;
  var store = prettyStore(row);
  if (!store) return null;
  var dsp = slug(row.dsp || row.dsp_slug || store);
  var st = key(row.status || row.delivery_status || row.state || 'pending');
  var meta = STATUS[st] || { label: 'Unknown', tone: 'wait' };
  var storeId = trim(row.dsp_release_id || row.release_uri || row.store_id || '');
  var link = storeLink(dsp, storeId, row.store_url || row.listen_url || row.url);
  var liveAt = trim(row.live_at || row.delivered_at || '');
  var subAt = trim(row.submitted_at || '');
  var out = {
    dsp: dsp,
    store: store,
    status: st,
    label: meta.label,
    tone: meta.tone,
    live_date: dateOnly(liveAt),
    submitted_date: dateOnly(subAt),
    store_url: link,
    confirmed: false,
    simulated: false,
    note: trim(row.error_message || '') && meta.tone === 'bad' ? 'The store sent this release back.' : '',
  };
  if (meta.tone === 'live') {
    var fast = toMs(liveAt) && toMs(subAt) && (toMs(liveAt) - toMs(subAt)) >= 0 && (toMs(liveAt) - toMs(subAt)) <= SIMULATED_WINDOW_MS;
    out.simulated = Boolean(fast || !storeId);
    out.confirmed = Boolean(link) && !out.simulated;
    if (!out.confirmed) {
      out.tone = 'wait';
      out.label = 'Reported live';
      out.note = UNCONFIRMED_COPY;
    }
  }
  return out;
}

function normalize(payload) {
  var seen = {};
  var out = [];
  listOf(payload).forEach(function (row) {
    var item = normalizeRow(row);
    if (!item || seen[item.dsp]) return;
    seen[item.dsp] = true;
    out.push(item);
  });
  var rank = { live: 0, wait: 1, bad: 2, off: 3 };
  return out.sort(function (a, b) {
    return (rank[a.tone] - rank[b.tone]) || a.store.localeCompare(b.store);
  });
}

function el(doc, tag, cls, text) {
  var n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function mountBoard(host, rows) {
  if (!host || typeof document === 'undefined') return rows || [];
  host.textContent = '';
  (rows || []).forEach(function (row) {
    var line = el(document, 'div', 'store-status-row');
    line.setAttribute('data-store', row.dsp);
    line.appendChild(el(document, 'span', 'store-status-name', row.store));
    var chip = el(document, 'span', 'store-chip store-chip-' + row.tone, row.label);
    line.appendChild(chip);
    line.appendChild(el(document, 'span', 'store-status-date', row.live_date ? 'Live ' + row.live_date : ''));
    var linkCell = el(document, 'span', 'store-status-link');
    if (row.store_url) {
      var a = el(document, 'a', '', 'Open');
      a.href = row.store_url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      linkCell.appendChild(a);
    }
    line.appendChild(linkCell);
    if (row.note) line.appendChild(el(document, 'span', 'store-status-note', row.note));
    host.appendChild(line);
  });
  return rows || [];
}

var api = {
  UNCONFIRMED_COPY: UNCONFIRMED_COPY,
  SIMULATED_WINDOW_MS: SIMULATED_WINDOW_MS,
  normalize: normalize,
  normalizeRow: normalizeRow,
  storeLink: storeLink,
  mountBoard: mountBoard,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof globalThis !== 'undefined') globalThis.PlaigroundStoreStatus = api;
