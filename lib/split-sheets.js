'use strict';

/**
 * Split-sheet status and writer names for Overview, the full list, and song.html.
 * Does not mint PDFs. Does not call SignWell. Solo 100% is attest only.
 */

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function isPlaceholderTitle(title) {
  var next = trim(title).toLowerCase().replace(/\s+/g, ' ');
  return next === 'neon sermon' || next === 'neon shadows' || next === 'neon santos';
}

function joinLegal(first, last) {
  return [trim(first), trim(last)].filter(Boolean).join(' ');
}

function legalFromWriter(writer) {
  writer = writer || {};
  var first = trim(writer.first_name || writer.legal_first || writer.first);
  var last = trim(writer.last_name || writer.legal_last || writer.last);
  if (!first && !last && trim(writer.name)) {
    var parts = trim(writer.name).split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      first = parts[0];
      last = parts.slice(1).join(' ');
    }
  }
  return { first: first, last: last, name: joinLegal(first, last) };
}

function writersOf(row, draft) {
  if (row && Array.isArray(row.writers) && row.writers.length) return row.writers;
  if (draft && Array.isArray(draft.writers) && draft.writers.length) return draft.writers;
  return [];
}

function writerFullName(row, draft) {
  var first = trim((row && (row.legal_first || row.legalFirst)) || (draft && (draft.legal_first || draft.legalFirst)));
  var last = trim((row && (row.legal_last || row.legalLast)) || (draft && (draft.legal_last || draft.legalLast)));
  if (first && last) return joinLegal(first, last);
  var names = [];
  writersOf(row, draft).forEach(function (writer) {
    var legal = legalFromWriter(writer);
    if (legal.name) names.push(legal.name);
  });
  return names.join(', ');
}

function featuredOf(row, draft) {
  return trim((row && row.featured) || (draft && draft.featured));
}

function isSoloOwned(row, draft) {
  if (featuredOf(row, draft)) return false;
  var src = draft && (draft.solo_owned_100 === true || draft.solo_owned_100 === 'true')
    ? draft
    : (row || {});
  if (draft && row && Object.prototype.hasOwnProperty.call(draft, 'solo_owned_100')) src = draft;
  return src.solo_owned_100 === true || src.solo_owned_100 === 'true';
}

function documentIdOf(row, draft) {
  return trim(
    (draft && (draft.signwell_document_id || draft.document_id))
    || (row && (row.signwell_document_id || row.document_id))
  );
}

function signwellStatusOf(row, draft) {
  return trim((draft && draft.signwell_status) || (row && row.signwell_status));
}

function isSignWellDone(row, draft) {
  var src = Object.assign({}, row || {}, draft || {});
  if (src.signwell_signed === true || src.signwell_signed === 'true') return true;
  var status = trim(src.signwell_status);
  return /^(completed|manually completed)$/i.test(status);
}

function signatureStatus(row, draft) {
  if (isSoloOwned(row, draft)) return 'self-attested';
  if (isSignWellDone(row, draft)) return 'yes';
  var status = signwellStatusOf(row, draft);
  var writers = writersOf(row, draft);
  if (documentIdOf(row, draft) || /awaiting/i.test(status) || writers.length > 1) return 'pending';
  return 'no';
}

function statusLabel(status) {
  if (status === 'self-attested') return 'self-attested';
  if (status === 'yes') return 'yes';
  if (status === 'pending') return 'pending';
  return 'no';
}

function statusCopy(status) {
  if (status === 'self-attested') return 'self-attested, no sheet required';
  return statusLabel(status);
}

function existingPdf(row, draft) {
  var src = Object.assign({}, row || {}, draft || {});
  var url = trim(
    src.split_sheet_pdf
    || src.split_pdf
    || src.split_sheet_url
    || src.split_sheet_pdf_url
    || src.pdf_url
  );
  if (/^https?:\/\//i.test(url) || /^data:application\/pdf/i.test(url) || /^blob:/i.test(url)) return url;
  return '';
}

function ownedIds(me) {
  var raw = me && Array.isArray(me.tonegrid_release_ids) ? me.tonegrid_release_ids : [];
  var have = {};
  raw.forEach(function (id) {
    var key = trim(id).toLowerCase();
    if (key) have[key] = true;
  });
  return have;
}

function draftMatches(row, draft) {
  if (!draft) return false;
  var id = trim((row && (row.tonegrid_release_id || row.id || row.uuid)) || '').toLowerCase();
  var draftId = trim(draft.release_id || draft.tonegrid_release_id || draft.id || '').toLowerCase();
  return Boolean(id && draftId && id === draftId);
}

function overlayDraft(row, draft) {
  if (!draftMatches(row, draft)) return row || {};
  return Object.assign({}, row || {}, {
    legal_first: trim(draft.legal_first) || (row && row.legal_first),
    legal_last: trim(draft.legal_last) || (row && row.legal_last),
    writers: Array.isArray(draft.writers) && draft.writers.length ? draft.writers : (row && row.writers),
    solo_owned_100: draft.solo_owned_100 != null ? draft.solo_owned_100 : (row && row.solo_owned_100),
    featured: trim(draft.featured) || (row && row.featured),
    signwell_status: trim(draft.signwell_status) || (row && row.signwell_status),
    signwell_signed: draft.signwell_signed != null ? draft.signwell_signed : (row && row.signwell_signed),
    signwell_document_id: trim(draft.signwell_document_id || draft.document_id) || (row && row.signwell_document_id),
    split_sheet_pdf: trim(draft.split_sheet_pdf || draft.split_pdf || draft.split_sheet_url) || (row && row.split_sheet_pdf),
  });
}

function workFromRow(row, draft) {
  var next = overlayDraft(row, draft);
  var status = signatureStatus(next, draftMatches(row, draft) ? draft : null);
  return {
    id: trim(next.tonegrid_release_id || next.id || next.uuid),
    title: trim(next.title) || 'Untitled',
    writer: writerFullName(next, draftMatches(row, draft) ? draft : null),
    status: status,
    status_label: statusLabel(status),
    status_copy: statusCopy(status),
    solo: isSoloOwned(next, draftMatches(row, draft) ? draft : null),
    pdf: existingPdf(next, draftMatches(row, draft) ? draft : null),
  };
}

function realWorks(me, draft) {
  var have = ownedIds(me);
  var stored = me && me.profile && Array.isArray(me.profile.releases) ? me.profile.releases : [];
  var out = [];
  var seen = {};
  stored.forEach(function (row) {
    var id = trim((row && (row.tonegrid_release_id || row.id)) || '').toLowerCase();
    if (!id || !have[id] || seen[id] || isPlaceholderTitle(row && row.title)) return;
    seen[id] = true;
    out.push(workFromRow(row, draft));
  });
  Object.keys(have).forEach(function (id) {
    if (seen[id]) return;
    out.push(workFromRow({
      id: id,
      tonegrid_release_id: id,
      title: 'Untitled',
    }, draft));
  });
  return out;
}

function latestWorks(me, draft, limit) {
  var n = Number(limit) || 5;
  if (n < 1) n = 5;
  var works = realWorks(me, draft);
  return works.slice(-n).reverse();
}

function persistFields(body, solo, signwellInfo, documentId, songwriter) {
  var first = trim((songwriter && (songwriter.first || songwriter.legal_first)) || (body && (body.legal_first || body.legalFirst)));
  var last = trim((songwriter && (songwriter.last || songwriter.legal_last)) || (body && (body.legal_last || body.legalLast)));
  var writers = Array.isArray(body && body.writers) && body.writers.length ? body.writers : [];
  if (!writers.length && first && last) {
    writers = [{ first_name: first, last_name: last, name: joinLegal(first, last) }];
  }
  var info = signwellInfo || {};
  return {
    legal_first: first,
    legal_last: last,
    writers: writers,
    solo_owned_100: Boolean(solo),
    signwell_status: trim(info.status) || (solo ? 'solo' : 'awaiting_signature'),
    signwell_signed: Boolean(info.signed),
    signwell_document_id: trim(documentId),
  };
}

var api = {
  existingPdf: existingPdf,
  isSoloOwned: isSoloOwned,
  latestWorks: latestWorks,
  persistFields: persistFields,
  realWorks: realWorks,
  signatureStatus: signatureStatus,
  statusCopy: statusCopy,
  statusLabel: statusLabel,
  writerFullName: writerFullName,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof globalThis !== 'undefined') globalThis.PlaigroundSplitSheets = api;
if (typeof window !== 'undefined') window.PlaigroundSplitSheets = api;
