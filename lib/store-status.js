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
  var raw = trim(v);
  // Upstream sends "YYYY-MM-DD HH:MM:SS" with no zone; treat it as UTC.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw)) raw = raw.replace(' ', 'T') + 'Z';
  var t = Date.parse(raw);
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

// Real data (Oct 2026): every store on a release flips to live in the same second,
// with no store release ID. A bulk flip like that is the distributor's report, not a
// store confirming, so it can never be green.
var BATCH_MIN = 3;
var TOP_STORES = ['spotify', 'apple-music', 'youtube-music', 'amazon-music', 'tiktok', 'tidal', 'deezer', 'audiomack', 'soundcloud', 'pandora', 'iheartradio', 'youtube'];

function normalize(payload) {
  var seen = {};
  var out = [];
  var batch = {};
  listOf(payload).forEach(function (row) {
    var item = normalizeRow(row);
    if (!item || seen[item.dsp]) return;
    seen[item.dsp] = true;
    item._liveRaw = trim(row && (row.live_at || row.delivered_at));
    if (item.status === 'live' && item._liveRaw) batch[item._liveRaw] = (batch[item._liveRaw] || 0) + 1;
    out.push(item);
  });
  out.forEach(function (item) {
    if (item.status === 'live' && item._liveRaw && batch[item._liveRaw] >= BATCH_MIN) {
      item.simulated = true;
      item.confirmed = false;
      item.tone = 'wait';
      item.label = 'Reported live';
      item.note = UNCONFIRMED_COPY;
    }
    delete item._liveRaw;
  });
  var rank = { live: 0, wait: 1, bad: 2, off: 3 };
  function top(d) { var i = TOP_STORES.indexOf(d); return i < 0 ? 99 : i; }
  return out.sort(function (a, b) {
    return (rank[a.tone] - rank[b.tone]) || (top(a.dsp) - top(b.dsp)) || a.store.localeCompare(b.store);
  });
}

function counts(rows) {
  var c = { confirmed: 0, reported_not_confirmed: 0, pending: 0, rejected: 0, taken_down: 0 };
  (rows || []).forEach(function (r) {
    if (r.confirmed) c.confirmed += 1;
    else if (r.label === 'Mismatch') c.mismatch = (c.mismatch || 0) + 1;
    else if (r.status === 'live' || r.status === 'delivered') c.reported_not_confirmed += 1;
    else if (r.tone === 'bad') c.rejected += 1;
    else if (r.tone === 'off') c.taken_down += 1;
    else c.pending += 1;
  });
  return c;
}


// ---- Store auditor: our own public lookup, the only thing that can turn a store green ----
function normText(v) {
  return trim(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)|\[.*?\]|feat\..*$|-\s*(single|ep)$/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function sameText(a, b) {
  var x = normText(a), y = normText(b);
  return Boolean(x && y && (x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0));
}

async function lookupJson(fetchImpl, url) {
  try {
    var r = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!r || !r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

async function auditLookup(info, fetchImpl) {
  var f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  var upc = trim(info && info.upc).replace(/\D/g, '');
  var isrcs = ((info && info.isrcs) || []).map(trim).filter(function (x) { return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(x); });
  var out = { deezer: { found: false }, 'apple-music': { found: false } };
  if (!f || (!upc && !isrcs.length)) return out;
  var dz = upc ? await lookupJson(f, 'https://api.deezer.com/2.0/album/upc:' + upc) : null;
  if (dz && dz.id && !dz.error) out.deezer = { found: true, url: 'https://www.deezer.com/album/' + dz.id, title: dz.title, artist: dz.artist && dz.artist.name };
  for (var i = 0; !out.deezer.found && i < isrcs.length; i += 1) {
    var t = await lookupJson(f, 'https://api.deezer.com/2.0/track/isrc:' + isrcs[i]);
    if (t && t.id && !t.error && t.album) out.deezer = { found: true, url: 'https://www.deezer.com/album/' + t.album.id, title: t.album.title, artist: t.artist && t.artist.name };
  }
  var ap = upc ? await lookupJson(f, 'https://itunes.apple.com/lookup?upc=' + upc + '&entity=album') : null;
  var hit = ap && ap.results && ap.results.filter(function (x) { return x.collectionId; })[0];
  for (var j = 0; !hit && j < isrcs.length; j += 1) {
    var a2 = await lookupJson(f, 'https://itunes.apple.com/lookup?isrc=' + isrcs[j]);
    hit = a2 && a2.results && a2.results.filter(function (x) { return x.collectionId; })[0];
  }
  if (hit) out['apple-music'] = { found: true, url: trim(hit.collectionViewUrl).split('?')[0], title: hit.collectionName, artist: hit.artistName };
  Object.keys(out).forEach(function (k) {
    var v = out[k];
    if (!v.found) return;
    v.title_ok = sameText(v.title, info.title);
    v.artist_ok = !trim(info.artist) || sameText(v.artist, info.artist);
    v.match = v.title_ok && v.artist_ok;
  });
  return out;
}

// Merge our lookup into the normalized rows. Only a matching lookup hit is green.
function applyAudit(rows, audit) {
  var list = (rows || []).slice();
  Object.keys(audit || {}).forEach(function (dsp) {
    var a = audit[dsp];
    var row = list.filter(function (r) { return r.dsp === dsp; })[0];
    if (!row && !(a && a.found)) return;
    if (!row) {
      row = { dsp: dsp, store: dsp === 'deezer' ? 'Deezer' : 'Apple Music', status: 'unknown', label: '', tone: 'wait', live_date: '', submitted_date: '', store_url: '', confirmed: false, simulated: false, note: '' };
      list.push(row);
    }
    row.checked = true;
    if (a && a.found && a.match) {
      row.confirmed = true;
      row.simulated = false;
      row.tone = 'live';
      row.label = 'Confirmed';
      row.store_url = a.url;
      row.note = '';
    } else if (a && a.found) {
      row.confirmed = false;
      row.tone = 'bad';
      row.label = 'Mismatch';
      row.store_url = '';
      row.found_url = a.url;
      row.note = 'Store shows ' + (a.title_ok ? '' : '"' + trim(a.title) + '" ') + (a.artist_ok ? '' : 'by "' + trim(a.artist) + '"') + '. We are checking this.';
    } else {
      row.confirmed = false;
      if (row.status === 'live') {
        row.tone = 'wait';
        row.label = 'Not found yet';
        row.note = 'Reported live, but our own check cannot find it on the store yet.';
      }
    }
  });
  // Nothing else may be green without our own check.
  list.forEach(function (r) {
    if (r.tone === 'live' && !r.checked) {
      r.confirmed = false;
      r.tone = 'wait';
      r.label = 'Reported live';
      r.note = UNCONFIRMED_COPY;
    }
    delete r.checked;
  });
  var rank = { live: 0, bad: 1, wait: 2, off: 3 };
  return list.sort(function (x, y) { return (rank[x.tone] - rank[y.tone]) || x.store.localeCompare(y.store); });
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
  counts: counts,
  auditLookup: auditLookup,
  applyAudit: applyAudit,
  sameText: sameText,
  normalizeRow: normalizeRow,
  storeLink: storeLink,
  mountBoard: mountBoard,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof globalThis !== 'undefined') globalThis.PlaigroundStoreStatus = api;
