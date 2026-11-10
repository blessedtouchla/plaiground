'use strict';

/**
 * Authenticated publishing intake.
 *
 * The artist supplies PRO, IPI, catalog scope, writer splits, and the publisher
 * share PLAIGROUND is asked to represent. PLAIGROUND files each composition.
 * Distribution is not required.
 *
 * No PRO, MLC, or CWR call is made. SignWell is not used: it only creates
 * multi-writer split sheets. A publisher share stays unclaimed until staff
 * record the reference, version, date, and catalog scope of an agreement that
 * was already reviewed and signed outside this product. This module does not
 * contain or approve a publishing contract.
 *
 * Statuses are request_received (first event), then needs_information,
 * needs_agreement, under_review, submitted (external reference required),
 * accepted, or rejected (evidence required).
 */

const crypto = require('crypto');
const db = require('./db');
const plans = require('./plans');
const writerIpi = require('./writer-ipi');

const STATUSES = [
  'request_received',
  'needs_information',
  'needs_agreement',
  'under_review',
  'submitted',
  'accepted',
  'matched',
  'paid',
  'rejected',
];
const STATUS_LABEL = {
  request_received: 'Request received',
  needs_information: 'Needs information',
  needs_agreement: 'Needs agreement',
  under_review: 'Under review',
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
};
const MADE = { no_ai: true, ai_assisted: true, fully_ai: true, unsure: true };
const WRITER_PROS = ['BMI', 'ASCAP', 'SESAC', 'GMR', 'Other', 'None / not yet'];
const DUMMY = {
  'your release': true,
  'neon sermon': true,
  'neon shadows': true,
  'neon santos': true,
};
const OPEN = {
  request_received: true,
  needs_information: true,
  needs_agreement: true,
  under_review: true,
  submitted: true,
  accepted: true,
  matched: true,
  paid: true,
};
const FILING_NOTE = 'Manual staff filing only. No PRO or MLC API is called. Do not assume the writer and PLAIGROUND share a PRO. Do not assume CWR or bulk registration access.';
const KEY_RE = /^[A-Za-z0-9._:-]{8,80}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SSN_RE = /^\s*\d{3}[-\s]\d{2}[-\s]\d{4}\s*$/;
const FORBIDDEN = /^(password|password_hash|ssn|social|dob|birth|birthday|date_of_birth|bank|routing|account_number|pro_password|pro_login)$/i;
const CONTRACT_TEXT = /^(contract|contract_text|agreement_text|agreement_body|legal_text)$/i;

let memory = null;

function resetStore() {
  memory = { registrations: [], events: [], agreements: [] };
}

function usingMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch (err) {
    return false;
  }
}

function ensureMemory() {
  if (!memory) resetStore();
  return memory;
}

function clip(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function norm(value) {
  return clip(value, 300).toLowerCase();
}

function validation(message) {
  return { error: message };
}

function cents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function fromCents(value) {
  return Math.round(value) / 100;
}

function sameId(a, b) {
  return clip(a, 80).toLowerCase() === clip(b, 80).toLowerCase() && Boolean(clip(a, 80));
}

function isDummyTitle(title) {
  return Boolean(DUMMY[norm(title)]);
}

function walkKeys(value, hit) {
  if (!value || typeof value !== 'object') return false;
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    if (hit(keys[i])) return true;
    if (walkKeys(value[keys[i]], hit)) return true;
  }
  return false;
}

function legalReview() {
  return {
    approved_template: false,
    signing_integration: false,
    provider: null,
    distribution_required: false,
    pro_api: false,
    bulk_or_cwr: false,
    same_pro_assumed: false,
    dependency: 'A lawyer-reviewed publishing agreement is not connected. SignWell creates multi-writer split sheets only and is not a publishing contract. Staff can record the reference, version, signed date, and catalog scope of an agreement that was already reviewed and signed outside this product. Until that record covers the work, the public status stays Not covered. This product does not submit the work to a PRO, The MLC, SoundExchange, or YouTube.',
  };
}

function statusLabel(status) {
  return STATUS_LABEL[status] || 'Needs agreement';
}

const PUBLIC_STATUS = {
  draft: {
    label: 'Draft',
    explain: 'Saved with PLAIGROUND. Nothing has been sent to a society, The MLC, SoundExchange, or YouTube.',
  },
  not_covered: {
    label: 'Not covered',
    explain: 'PLAIGROUND is not filing this work. No society, MLC, SoundExchange, or YouTube status is on file.',
  },
  submitted: {
    label: 'Submitted',
    explain: 'A receipt is on file that this work was sent. That is not acceptance, a match, or a payment.',
  },
  registered: {
    label: 'Registered',
    explain: 'A receipt is on file that a registry accepted this work. The receipt is the only proof.',
  },
  matched: {
    label: 'Matched',
    explain: 'A receipt is on file that a recording was matched to this work. The receipt is the only proof.',
  },
  paid: {
    label: 'Paid',
    explain: 'A receipt is on file that money was paid for this work. The receipt is the only proof.',
  },
};

function receiptText(value) {
  return clip(value, 2000);
}

// Artist-facing status. Submitted, Registered, Matched, and Paid require the matching receipt.
function publicFacing(row) {
  const status = String((row && row.status) || '');
  const submission = receiptText(row && row.external_reference);
  const registration = receiptText(row && row.evidence);
  const match = receiptText(row && row.match_receipt);
  const payment = receiptText(row && row.payment_receipt);
  let key = 'draft';
  if (status === 'needs_agreement' || status === 'rejected' || (row && row.eligibility === 'not_eligible')) key = 'not_covered';
  if (status === 'submitted' && submission.length >= 3) key = 'submitted';
  if (status === 'accepted' && registration.length >= 8) key = 'registered';
  if (status === 'matched' && match.length >= 8) key = 'matched';
  if (status === 'paid' && payment.length >= 8) key = 'paid';
  const face = PUBLIC_STATUS[key] || PUBLIC_STATUS.draft;
  return { key: key, label: face.label, explain: face.explain };
}

function dishonestStatus(value) {
  return /pending at|sent to (bmi|ascap|sesac|gmr|the mlc|mlc|soundexchange|youtube)|registered with|matched at|paid by|filed for publishing/i.test(String(value || ''));
}

function eligibilityOf(madeHow, contribution) {
  const how = MADE[madeHow] ? madeHow : '';
  const text = clip(contribution, 2000);
  const promptOnly = /^(prompts? only|prompt-only|fully ai|no human\b|none|n\/a)\b/i.test(text)
    || /without (any )?human/i.test(text)
    || /generated entirely by ai/i.test(text);
  if (how === 'fully_ai' || promptOnly) {
    return { eligibility: 'not_eligible', reason: 'BMI does not register a work made only from prompts. Distribution acceptance is separate.' };
  }
  if (how === 'no_ai') {
    if (text.length < 8) {
      return { eligibility: 'review', reason: 'The human contribution is too thin to treat as eligible. Staff review it before any filing.' };
    }
    return { eligibility: 'eligible', reason: 'Human authorship was described. Staff still review it before any filing.' };
  }
  if (how === 'ai_assisted' || how === 'unsure' || !how) {
    return { eligibility: 'review', reason: 'Partial AI or an unclear contribution stays in review. BMI accepts partial AI only when human creativity meets the Copyright Office threshold.' };
  }
  return { eligibility: 'review', reason: 'Eligibility is unclear, so the work stays in review.' };
}

function normalizeWriterPro(value) {
  const raw = clip(value, 40).toLowerCase();
  for (let i = 0; i < WRITER_PROS.length; i += 1) {
    if (WRITER_PROS[i].toLowerCase() === raw) return WRITER_PROS[i];
  }
  return '';
}

function normalizeWriters(input) {
  if (!Array.isArray(input) || !input.length) return validation('Add at least one writer and their share of the writer half.');
  if (input.length > 8) return validation('A composition can list up to 8 writers.');
  const writers = [];
  for (let i = 0; i < input.length; i += 1) {
    const row = input[i] || {};
    const name = clip(row.name || row.legal_name, 120);
    const pro = normalizeWriterPro(row.pro);
    const share = cents(row.share);
    const ipi = clip(row.ipi, 20).replace(/[\s.-]/g, '');
    if (!name) return validation('Writer ' + (i + 1) + ' needs a legal name.');
    if (!pro) return validation('Writer ' + (i + 1) + ' needs a PRO, or None / not yet.');
    if (share == null || share < 0 || share > 10000) return validation('Writer ' + (i + 1) + ' share must be from 0 to 100.');
    if (ipi && (!/^\d+$/.test(ipi) || ipi.length < 6 || ipi.length > 15 || SSN_RE.test(row.ipi))) {
      return validation('Writer ' + (i + 1) + ' IPI must be the number from their PRO, not an SSN.');
    }
    const proOther = pro === 'Other' ? clip(row.pro_other || row.proOther, 60) : '';
    if (pro === 'Other' && !proOther) return validation('Writer ' + (i + 1) + ' needs the name of their PRO.');
    writers.push({
      name,
      pro,
      pro_other: proOther,
      share: fromCents(share),
      ipi,
      email: clip(row.email, 200),
    });
  }
  const total = writers.reduce((sum, row) => sum + cents(row.share), 0);
  if (total !== 10000) return validation('Writer shares must total 100% of the writer half.');
  return { writers };
}

function normalizePublishers(input) {
  if (input == null || input === '') return { publishers: [] };
  const rows = Array.isArray(input) ? input : [];
  if (!Array.isArray(input)) return validation('Other publishers must be a list of name and share.');
  if (rows.length > 8) return validation('List up to 8 other publishers.');
  const publishers = [];
  for (let i = 0; i < rows.length; i += 1) {
    const name = clip(rows[i] && rows[i].name, 120);
    const share = cents(rows[i] && rows[i].share);
    if (!name || share == null || share <= 0 || share > 10000) {
      return validation('Each other publisher needs a name and a share from 0 to 100.');
    }
    publishers.push({ name, share: fromCents(share) });
  }
  return { publishers };
}

function normalizeCredits(input) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    performers: clip(src.performers || src.performer, 300),
    producers: clip(src.producers || src.producer, 300),
    featured: clip(src.featured, 300),
  };
}

function normalizeShare(value) {
  if (value == null || value === '') {
    return validation('Enter the publisher share PLAIGROUND is authorized to represent. It is not filled in for you.');
  }
  const share = cents(value);
  if (share == null || share < 0 || share > 10000) {
    return validation('The represented publisher share must be a number from 0 to 100.');
  }
  return { share: fromCents(share), explicit: true };
}

function accountIdentity(body, now) {
  const parsed = writerIpi.normalize({
    ipi: body && body.ipi,
    pro: body && body.pro,
    pro_other: body && (body.pro_other || body.proOther),
  }, now);
  if (parsed.error) return validation(parsed.error);
  return { identity: parsed.writer };
}

function workInput(raw, index) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const title = clip(src.work_title || src.title, 200);
  if (!title) return validation('Each composition needs a title.');
  if (isDummyTitle(title)) return validation('Use the real composition title.');
  const made = clip(src.made_how || src.madeHow, 40).toLowerCase();
  if (!MADE[made]) return validation('Say how the composition was made: human, AI-assisted, fully AI, or unsure.');
  const contribution = clip(src.human_contribution || src.humanContribution, 2000);
  if (contribution.length < 2) return validation('Describe the human contribution for ' + title + '.');
  const writers = normalizeWriters(src.writers);
  if (writers.error) return writers;
  const share = normalizeShare(src.publisher_share_percent != null ? src.publisher_share_percent : src.publisher_share);
  if (share.error) return share;
  const others = normalizePublishers(src.other_publishers);
  if (others.error) return others;
  const otherCents = others.publishers.reduce((sum, row) => sum + cents(row.share), 0);
  if (cents(share.share) + otherCents > 10000) {
    return validation('Represented and other publisher shares cannot total more than 100% of the publisher half.');
  }
  const eligibility = eligibilityOf(made, contribution);
  const position = Number(src.track_position || src.position || index);
  return {
    work: {
      work_title: title,
      alternate_title: clip(src.alternate_title || src.alternateTitle, 200),
      duration: clip(src.duration, 16),
      language: clip(src.language, 40),
      isrc: clip(src.isrc, 32).toUpperCase(),
      writers: writers.writers,
      publisher_share: share.share,
      publisher_share_explicit: share.explicit,
      other_publishers: others.publishers,
      made_how: made,
      human_contribution: contribution,
      eligibility: eligibility.eligibility,
      eligibility_reason: eligibility.reason,
      credits: normalizeCredits(src.credits),
      track_position: Number.isFinite(position) && position > 0 ? Math.round(position) : index,
    },
  };
}

function parseScope(input) {
  const src = input && typeof input === 'object' ? input : {};
  const kind = clip(src.kind, 20).toLowerCase();
  if (kind === 'account') return { scope: { kind: 'account' } };
  if (kind === 'titles') {
    const titles = (Array.isArray(src.titles) ? src.titles : []).map((item) => clip(item, 200)).filter(Boolean).slice(0, 40);
    if (!titles.length) return validation('Name the compositions this agreement covers.');
    return { scope: { kind: 'titles', titles } };
  }
  if (kind === 'ids') {
    const ids = (Array.isArray(src.ids) ? src.ids : []).map((item) => clip(item, 80)).filter((item) => UUID_RE.test(item)).slice(0, 40);
    if (!ids.length) return validation('Name the registration ids this agreement covers.');
    return { scope: { kind: 'ids', ids } };
  }
  return validation('Catalog scope must be the whole account, a list of titles, or a list of registration ids.');
}

function scopeCovers(scope, row) {
  if (!scope || !row) return false;
  if (scope.kind === 'account') return true;
  if (scope.kind === 'titles') {
    const titles = (scope.titles || []).map(norm);
    return titles.indexOf(norm(row.work_title)) !== -1 || (row.album_title && titles.indexOf(norm(row.album_title)) !== -1);
  }
  if (scope.kind === 'ids') {
    return (scope.ids || []).some((id) => sameId(id, row.id) || sameId(id, row.album_group_id));
  }
  return false;
}

function coveringAgreement(agreements, row) {
  const list = agreements || [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    if (!item || item.reviewed !== true) continue;
    if (!sameId(item.user_id, row.user_id)) continue;
    if (scopeCovers(item.catalog_scope, row)) return item;
  }
  return null;
}

function deriveStatus(work, agreement) {
  if (work.eligibility === 'not_eligible') return 'needs_information';
  if (!agreement) return 'needs_agreement';
  return 'under_review';
}

function statusDetail(row) {
  const face = publicFacing(row);
  if (row && row.status === 'needs_information' && row.eligibility_reason) {
    return face.explain + ' ' + row.eligibility_reason;
  }
  if (row && row.status === 'needs_agreement') {
    return face.explain + ' A reviewed publishing agreement is not on file. The filing authorization is not that contract.';
  }
  if (row && row.status === 'under_review') {
    return face.explain + ' A reviewed agreement reference is on file. Staff have not sent this composition.';
  }
  if (face.key === 'submitted') return face.explain + ' Receipt: ' + row.external_reference + '.';
  if (face.key === 'registered') return face.explain + ' Receipt: ' + row.evidence + '.';
  if (face.key === 'matched') return face.explain + ' Receipt: ' + row.match_receipt + '.';
  if (face.key === 'paid') return face.explain + ' Receipt: ' + row.payment_receipt + '.';
  if (row && row.status === 'rejected') return face.explain + ' ' + (row.evidence || '');
  return face.explain;
}

function present(row, events, agreement) {
  const copy = {
    id: row.id,
    user_id: row.user_id,
    album_group_id: row.album_group_id || '',
    album_title: row.album_title || '',
    track_position: row.track_position || null,
    work_title: row.work_title,
    performing_artist: row.performing_artist,
    release_id: row.release_id || '',
    alternate_title: row.alternate_title || '',
    duration: row.duration || '',
    language: row.language || '',
    isrc: row.isrc || '',
    writers: Array.isArray(row.writers) ? row.writers : [],
    publisher_share_percent: row.publisher_share,
    publisher_share_explicit: row.publisher_share_explicit === true,
    publisher_share_note: 'This is the share the artist asked PLAIGROUND to represent. It is not a default and it is not claimed until a reviewed agreement covers it.',
    other_publishers: Array.isArray(row.other_publishers) ? row.other_publishers : [],
    pro: row.pro,
    ipi: row.ipi,
    pro_other: row.pro_other || '',
    made_how: row.made_how,
    human_contribution: row.human_contribution,
    eligibility: row.eligibility,
    eligibility_reason: row.eligibility_reason || '',
    credits: row.credits || { performers: '', producers: '', featured: '' },
    status: row.status,
    public_status: publicFacing(row).key,
    status_label: publicFacing(row).label,
    status_detail: statusDetail(row),
    external_reference: row.external_reference || '',
    evidence: row.evidence || '',
    match_receipt: row.match_receipt || '',
    payment_receipt: row.payment_receipt || '',
    mandate_at: row.mandate_at || '',
    mandate_is_contract: false,
    agreement: agreement ? {
      id: agreement.id,
      reference: agreement.reference,
      version: agreement.version,
      signed_on: agreement.signed_on,
      catalog_scope: agreement.catalog_scope,
      reviewed: true,
    } : null,
    distribution_required: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (events) copy.events = events;
  return copy;
}

function checklistOf(row, agreement) {
  const writers = (row.writers || []).map((item) => [
    item.name,
    item.pro,
    item.pro_other || '',
    item.ipi || '',
    String(item.share) + '% of writer half',
  ].filter(Boolean).join(' | ')).join('; ');
  const others = (row.other_publishers || []).map((item) => item.name + ' ' + item.share + '%').join('; ');
  const credits = row.credits || {};
  return {
    work_title: row.work_title,
    album_title: row.album_title || '',
    track_position: row.track_position || '',
    performing_artist: row.performing_artist,
    writers,
    represented_publisher_share: row.publisher_share_explicit ? String(row.publisher_share) : '',
    other_publishers: others,
    account_pro: row.pro,
    account_ipi: row.ipi,
    isrc: row.isrc || '',
    duration: row.duration || '',
    language: row.language || '',
    alternate_title: row.alternate_title || '',
    made_how: row.made_how,
    human_contribution: row.human_contribution,
    eligibility: row.eligibility,
    performers: credits.performers || '',
    producers: credits.producers || '',
    featured: credits.featured || '',
    status: statusLabel(row.status),
    agreement_reference: agreement ? agreement.reference : '',
    agreement_version: agreement ? agreement.version : '',
    agreement_signed_on: agreement ? agreement.signed_on : '',
    agreement_scope: agreement ? JSON.stringify(agreement.catalog_scope) : '',
    external_reference: row.external_reference || '',
    evidence: row.evidence || '',
    filing_note: FILING_NOTE,
  };
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function checklistCsv(rows) {
  const sample = checklistOf({ writers: [], other_publishers: [], credits: {}, publisher_share_explicit: false }, null);
  const headers = Object.keys(sample);
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((key) => csvCell(row[key])).join(','));
  });
  return lines.join('\n') + '\n';
}

async function ready() {
  if (usingMemory()) {
    ensureMemory();
    return;
  }
  const accounts = require('./accounts');
  await accounts.ensureReady();
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

function rowFromDb(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    client_key: row.client_key || '',
    idempotency_key: row.idempotency_key || '',
    album_group_id: row.album_group_id ? String(row.album_group_id) : '',
    album_title: row.album_title || '',
    track_position: row.track_position == null ? null : Number(row.track_position),
    work_title: row.work_title || '',
    performing_artist: row.performing_artist || '',
    release_id: row.release_id || '',
    alternate_title: row.alternate_title || '',
    duration: row.duration || '',
    language: row.language || '',
    isrc: row.isrc || '',
    writers: parseJson(row.writers, []),
    publisher_share: row.publisher_share == null ? null : Number(row.publisher_share),
    publisher_share_explicit: row.publisher_share_explicit === true,
    other_publishers: parseJson(row.other_publishers, []),
    pro: row.pro || '',
    ipi: row.ipi || '',
    pro_other: row.pro_other || '',
    made_how: row.made_how || '',
    human_contribution: row.human_contribution || '',
    eligibility: row.eligibility || '',
    eligibility_reason: eligibilityOf(row.made_how, row.human_contribution).reason,
    credits: parseJson(row.credits, {}),
    status: row.status,
    agreement_id: row.agreement_id ? String(row.agreement_id) : '',
    external_reference: row.external_reference || '',
    evidence: row.evidence || '',
    match_receipt: row.match_receipt || '',
    payment_receipt: row.payment_receipt || '',
    mandate_at: row.mandate_at ? new Date(row.mandate_at).toISOString() : '',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

function agreementFromDb(row) {
  if (!row) return null;
  const signed = row.signed_on instanceof Date
    ? row.signed_on.toISOString().slice(0, 10)
    : String(row.signed_on || '').slice(0, 10);
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    reference: row.reference,
    version: row.version,
    signed_on: signed,
    catalog_scope: parseJson(row.catalog_scope, {}),
    reviewed: row.reviewed === true,
    recorded_by: row.recorded_by || '',
    note: row.note || '',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

async function allRegistrations() {
  await ready();
  if (usingMemory()) return ensureMemory().registrations.map((row) => Object.assign({}, row));
  const listed = await db.query('SELECT * FROM publishing_registrations ORDER BY created_at ASC');
  return (listed || []).map(rowFromDb);
}

async function allAgreements() {
  await ready();
  if (usingMemory()) return ensureMemory().agreements.map((row) => Object.assign({}, row));
  const listed = await db.query('SELECT * FROM publishing_agreements ORDER BY created_at ASC');
  return (listed || []).map(agreementFromDb);
}

async function eventsFor(registrationId) {
  await ready();
  if (usingMemory()) {
    return ensureMemory().events.filter((row) => sameId(row.registration_id, registrationId))
      .map((row) => Object.assign({}, row));
  }
  const listed = await db.query(
    'SELECT * FROM publishing_events WHERE registration_id = $1 ORDER BY created_at ASC',
    [registrationId]
  );
  return (listed || []).map((row) => ({
    id: String(row.id),
    registration_id: String(row.registration_id),
    user_id: String(row.user_id),
    from_status: row.from_status || '',
    to_status: row.to_status,
    actor: row.actor || '',
    note: row.note || '',
    reference: row.reference || '',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
  }));
}

async function insertEvent(event) {
  const row = Object.assign({
    id: crypto.randomUUID(),
    from_status: '',
    note: '',
    reference: '',
    created_at: new Date().toISOString(),
  }, event);
  if (usingMemory()) {
    ensureMemory().events.push(row);
    return row;
  }
  await db.query(
    'INSERT INTO publishing_events (id, registration_id, user_id, from_status, to_status, actor, note, reference, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [row.id, row.registration_id, row.user_id, row.from_status, row.to_status, row.actor, row.note, row.reference, row.created_at]
  );
  return row;
}

async function insertRegistration(row) {
  if (usingMemory()) {
    ensureMemory().registrations.push(row);
    return row;
  }
  await db.query(
    `INSERT INTO publishing_registrations (
      id, user_id, client_key, idempotency_key, album_group_id, album_title, track_position,
      work_title, performing_artist, release_id, alternate_title, duration, language, isrc,
      writers, publisher_share, publisher_share_explicit, other_publishers, pro, ipi, pro_other,
      made_how, human_contribution, eligibility, credits, status, agreement_id, external_reference,
      evidence, mandate_at, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18::jsonb,$19,$20,$21,
      $22,$23,$24,$25::jsonb,$26,$27,$28,$29,$30,$31,$32
    )`,
    [
      row.id, row.user_id, row.client_key, row.idempotency_key, row.album_group_id || null, row.album_title,
      row.track_position, row.work_title, row.performing_artist, row.release_id, row.alternate_title,
      row.duration, row.language, row.isrc, JSON.stringify(row.writers), row.publisher_share,
      row.publisher_share_explicit, JSON.stringify(row.other_publishers), row.pro, row.ipi, row.pro_other,
      row.made_how, row.human_contribution, row.eligibility, JSON.stringify(row.credits), row.status,
      row.agreement_id || null, row.external_reference, row.evidence, row.mandate_at, row.created_at, row.updated_at,
    ]
  );
  return row;
}

async function updateRegistration(row) {
  row.updated_at = new Date().toISOString();
  if (usingMemory()) {
    const list = ensureMemory().registrations;
    const index = list.findIndex((item) => sameId(item.id, row.id));
    if (index >= 0) list[index] = row;
    return row;
  }
  await db.query(
    `UPDATE publishing_registrations SET
      work_title=$2, alternate_title=$3, duration=$4, language=$5, isrc=$6, writers=$7::jsonb,
      publisher_share=$8, publisher_share_explicit=$9, other_publishers=$10::jsonb, pro=$11, ipi=$12,
      pro_other=$13, made_how=$14, human_contribution=$15, eligibility=$16, credits=$17::jsonb,
      status=$18, agreement_id=$19, external_reference=$20, evidence=$21, performing_artist=$22,
      album_title=$23, updated_at=$24
     WHERE id=$1`,
    [
      row.id, row.work_title, row.alternate_title, row.duration, row.language, row.isrc,
      JSON.stringify(row.writers), row.publisher_share, row.publisher_share_explicit,
      JSON.stringify(row.other_publishers), row.pro, row.ipi, row.pro_other, row.made_how,
      row.human_contribution, row.eligibility, JSON.stringify(row.credits), row.status,
      row.agreement_id || null, row.external_reference, row.evidence, row.performing_artist,
      row.album_title, row.updated_at,
    ]
  );
  return row;
}

function responseMeta() {
  return {
    agreement_integration: {
      available: false,
      provider: null,
      reason: legalReview().dependency,
    },
    legal_review: legalReview(),
  };
}

function owned(rows, userId) {
  return rows.filter((row) => sameId(row.user_id, userId));
}

function planCap(user) {
  const decision = plans.evaluate(user || {});
  if (decision.plan === 'creator') return plans.CREATOR_MONTHLY;
  return null;
}

function monthCount(rows, userId, now) {
  const key = plans.calendarMonthKey(now || new Date());
  return rows.filter((row) => sameId(row.user_id, userId) && plans.calendarMonthKey(row.created_at, now) === key).length;
}

function validateEnvelope(body, now) {
  const src = body && typeof body === 'object' ? body : {};
  if (walkKeys(src, (key) => FORBIDDEN.test(key))) {
    return validation('Password, SSN, bank, and PRO login fields are not accepted.');
  }
  if (walkKeys(src, (key) => CONTRACT_TEXT.test(key))) {
    return validation('Do not send a contract. This intake does not store or approve agreement text.');
  }
  if (src.status || src.external_reference || src.evidence || src.agreement_id || src.reviewed === true) {
    return validation('Status and filing references are recorded by staff.');
  }
  if (src.mandate !== true && src.mandate !== 'true') {
    return validation('Authorization to prepare the filing is required. This is not a publishing contract.');
  }
  const identity = accountIdentity(src, now);
  if (identity.error) return identity;
  const artist = clip(src.performing_artist || src.artist, 120);
  if (!artist) return validation('Name the performing artist.');
  const releaseId = clip(src.release_id || src.releaseId, 80);
  if (releaseId && !UUID_RE.test(releaseId)) return validation('Catalog release id must be a uuid, or leave it blank if this work was not distributed here.');
  const existingId = UUID_RE.test(clip(src.id, 80)) ? clip(src.id, 80) : '';
  const albumTitle = existingId ? '' : clip(src.album_title || src.albumTitle, 200);
  if (albumTitle && isDummyTitle(albumTitle)) return validation('Use the real album title.');
  let rawWorks;
  if (albumTitle) {
    if (!Array.isArray(src.works) || src.works.length < 2) {
      return validation('An album needs at least two compositions. Each one keeps its own writers, shares, and credits.');
    }
    if (src.works.length > 30) return validation('An album group can hold up to 30 compositions.');
    rawWorks = src.works;
  } else {
    rawWorks = [src];
  }
  const works = [];
  for (let i = 0; i < rawWorks.length; i += 1) {
    const parsed = workInput(rawWorks[i], i + 1);
    if (parsed.error) return parsed;
    works.push(parsed.work);
  }
  const seen = {};
  for (let i = 0; i < works.length; i += 1) {
    const key = norm(works[i].work_title);
    if (seen[key]) return validation('Each composition in this request needs its own title.');
    seen[key] = true;
  }
  const clientKey = clip(src.idempotency_key || src.client_key, 80);
  if (!KEY_RE.test(clientKey)) return validation('Include an idempotency key of 8 to 80 letters, numbers, dots, colons, or dashes.');
  return {
    envelope: {
      client_key: clientKey,
      album_title: albumTitle,
      performing_artist: artist,
      release_id: releaseId,
      identity: identity.identity,
      works,
      existing_id: existingId,
    },
  };
}

async function submitOwn(user, body, now) {
  const clock = now || new Date();
  const iso = clock.toISOString();
  const parsed = validateEnvelope(body, clock);
  if (parsed.error) return { ok: false, status: 400, body: { error: parsed.error } };
  const envelope = parsed.envelope;
  await ready();
  const registrations = await allRegistrations();
  const agreements = await allAgreements();
  const mine = owned(registrations, user.id);

  if (envelope.existing_id) {
    const current = mine.find((row) => sameId(row.id, envelope.existing_id));
    if (!current) return { ok: false, status: 404, body: { error: 'Not found.' } };
    if (current.status !== 'needs_information' && current.status !== 'needs_agreement') {
      return { ok: false, status: 409, body: { error: 'This request is already with staff.' } };
    }
    const work = envelope.works[0];
    const agreement = coveringAgreement(agreements, current);
    const nextStatus = deriveStatus(work, agreement);
    const previous = current.status;
    Object.assign(current, {
      work_title: work.work_title,
      alternate_title: work.alternate_title,
      duration: work.duration,
      language: work.language,
      isrc: work.isrc,
      writers: work.writers,
      publisher_share: work.publisher_share,
      publisher_share_explicit: true,
      other_publishers: work.other_publishers,
      pro: envelope.identity.pro,
      ipi: envelope.identity.ipi,
      pro_other: envelope.identity.pro_other,
      made_how: work.made_how,
      human_contribution: work.human_contribution,
      eligibility: work.eligibility,
      eligibility_reason: work.eligibility_reason,
      credits: work.credits,
      performing_artist: envelope.performing_artist,
      status: nextStatus,
      agreement_id: agreement ? agreement.id : '',
    });
    await updateRegistration(current);
    if (previous !== nextStatus) {
      await insertEvent({
        registration_id: current.id,
        user_id: user.id,
        from_status: previous,
        to_status: nextStatus,
        actor: String(user.id),
        note: 'Artist updated the request.',
        created_at: iso,
      });
    }
    const events = await eventsFor(current.id);
    return {
      ok: true,
      status: 200,
      body: Object.assign({ registration: present(current, events, agreement) }, responseMeta()),
    };
  }

  const replay = mine.filter((row) => row.client_key === envelope.client_key);
  if (replay.length) {
    const shown = [];
    for (let i = 0; i < replay.length; i += 1) {
      const agreement = coveringAgreement(agreements, replay[i]);
      shown.push(present(replay[i], await eventsFor(replay[i].id), agreement));
    }
    return {
      ok: true,
      status: 200,
      body: Object.assign({ registrations: shown, idempotent: true }, responseMeta()),
    };
  }

  const duplicate = mine.find((row) => OPEN[row.status] && row.status !== 'rejected' && norm(row.album_title) === norm(envelope.album_title) && envelope.works.some((work) => norm(work.work_title) === norm(row.work_title)));
  if (duplicate) {
    const agreement = coveringAgreement(agreements, duplicate);
    return {
      ok: false,
      status: 409,
      body: { error: 'This composition is already in your publishing requests.', registration: present(duplicate, null, agreement) },
    };
  }

  const cap = planCap(user);
  const used = monthCount(mine, user.id, clock);
  if (cap != null && used + envelope.works.length > cap) {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'This account has reached the publishing requests allowed this month.',
        code: 'PLAN_LIMIT',
        used,
        limit: cap,
      },
    };
  }

  const groupId = envelope.album_title ? crypto.randomUUID() : '';
  const saved = [];
  for (let i = 0; i < envelope.works.length; i += 1) {
    const work = envelope.works[i];
    const draft = {
      id: crypto.randomUUID(),
      user_id: String(user.id),
      album_title: envelope.album_title,
      album_group_id: groupId,
      work_title: work.work_title,
    };
    const agreement = coveringAgreement(agreements, draft);
    const status = deriveStatus(work, agreement);
    const row = {
      id: draft.id,
      user_id: String(user.id),
      client_key: envelope.client_key,
      idempotency_key: i === 0 ? envelope.client_key : envelope.client_key + '#' + (i + 1),
      album_group_id: groupId,
      album_title: envelope.album_title,
      track_position: envelope.album_title ? work.track_position : null,
      work_title: work.work_title,
      performing_artist: envelope.performing_artist,
      release_id: envelope.release_id,
      alternate_title: work.alternate_title,
      duration: work.duration,
      language: work.language,
      isrc: work.isrc,
      writers: work.writers,
      publisher_share: work.publisher_share,
      publisher_share_explicit: true,
      other_publishers: work.other_publishers,
      pro: envelope.identity.pro,
      ipi: envelope.identity.ipi,
      pro_other: envelope.identity.pro_other,
      made_how: work.made_how,
      human_contribution: work.human_contribution,
      eligibility: work.eligibility,
      eligibility_reason: work.eligibility_reason,
      credits: work.credits,
      status,
      agreement_id: agreement ? agreement.id : '',
      external_reference: '',
      evidence: '',
      match_receipt: '',
      payment_receipt: '',
      mandate_at: iso,
      created_at: iso,
      updated_at: iso,
    };
    await insertRegistration(row);
    await insertEvent({
      registration_id: row.id,
      user_id: String(user.id),
      from_status: '',
      to_status: 'request_received',
      actor: String(user.id),
      note: 'Request received from the artist.',
      created_at: iso,
    });
    if (status !== 'request_received') {
      await insertEvent({
        registration_id: row.id,
        user_id: String(user.id),
        from_status: 'request_received',
        to_status: status,
        actor: String(user.id),
        note: statusDetail(row),
        created_at: iso,
      });
    }
    saved.push(present(row, await eventsFor(row.id), agreement));
  }
  return {
    ok: true,
    status: 201,
    body: Object.assign({ registrations: saved, idempotent: false }, responseMeta()),
  };
}

async function readOwn(user, query) {
  await ready();
  const registrations = owned(await allRegistrations(), user.id);
  const agreements = await allAgreements();
  const id = clip(query && query.id, 80);
  const group = clip(query && query.group, 80);
  if (id) {
    const row = registrations.find((item) => sameId(item.id, id));
    if (!row) return { ok: false, status: 404, body: { error: 'Not found.' } };
    const agreement = coveringAgreement(agreements, row);
    return {
      ok: true,
      status: 200,
      body: Object.assign({ registration: present(row, await eventsFor(row.id), agreement) }, responseMeta()),
    };
  }
  if (group) {
    const rows = registrations.filter((item) => sameId(item.album_group_id, group));
    if (!rows.length) return { ok: false, status: 404, body: { error: 'Not found.' } };
    const shown = [];
    for (let i = 0; i < rows.length; i += 1) {
      shown.push(present(rows[i], await eventsFor(rows[i].id), coveringAgreement(agreements, rows[i])));
    }
    return { ok: true, status: 200, body: Object.assign({ registrations: shown }, responseMeta()) };
  }
  const shown = registrations.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return {
    ok: true,
    status: 200,
    body: Object.assign({
      registrations: shown.map((row) => present(row, null, coveringAgreement(agreements, row))),
    }, responseMeta()),
  };
}

function validateAgreement(staff, body, now) {
  const src = body && typeof body === 'object' ? body : {};
  if (walkKeys(src, (key) => CONTRACT_TEXT.test(key))) {
    return validation('Do not store agreement text here. Record the reviewed reference, version, date, and catalog scope.');
  }
  if (src.reviewed !== true) {
    return validation('An unreviewed draft cannot be recorded. Review happens outside this product.');
  }
  const reference = clip(src.reference, 200);
  const version = clip(src.version, 80);
  const signed = clip(src.signed_on || src.signedOn, 10);
  const note = clip(src.note, 2000);
  const userId = clip(src.user_id || src.userId, 80);
  if (!UUID_RE.test(userId)) return validation('Name the artist account this agreement covers.');
  if (reference.length < 4 || /^(none|pending|draft|n\/a)$/i.test(reference)) {
    return validation('Enter the external reference of the reviewed agreement.');
  }
  if (!version || /draft|unreviewed|template only/i.test(version)) {
    return validation('Enter the reviewed version. An unreviewed draft is not a version.');
  }
  if (!DATE_RE.test(signed) || signed > (now || new Date()).toISOString().slice(0, 10)) {
    return validation('Enter the signed date as YYYY-MM-DD. It cannot be in the future.');
  }
  const scope = parseScope(src.catalog_scope || src.catalogScope);
  if (scope.error) return scope;
  return {
    agreement: {
      id: crypto.randomUUID(),
      user_id: userId,
      reference,
      version,
      signed_on: signed,
      catalog_scope: scope.scope,
      reviewed: true,
      recorded_by: String(staff && staff.id || ''),
      note,
      created_at: (now || new Date()).toISOString(),
    },
  };
}

async function insertAgreement(row) {
  if (usingMemory()) {
    ensureMemory().agreements.push(row);
    return row;
  }
  await db.query(
    'INSERT INTO publishing_agreements (id, user_id, reference, version, signed_on, catalog_scope, reviewed, recorded_by, note, created_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,true,$7,$8,$9)',
    [row.id, row.user_id, row.reference, row.version, row.signed_on, JSON.stringify(row.catalog_scope), row.recorded_by, row.note, row.created_at]
  );
  return row;
}

async function promoteForAgreement(agreement, actor) {
  const registrations = await allRegistrations();
  const moved = [];
  for (let i = 0; i < registrations.length; i += 1) {
    const row = registrations[i];
    if (!sameId(row.user_id, agreement.user_id)) continue;
    if (row.status !== 'needs_agreement') continue;
    if (!scopeCovers(agreement.catalog_scope, row)) continue;
    if (row.eligibility === 'not_eligible') continue;
    const previous = row.status;
    row.status = 'under_review';
    row.agreement_id = agreement.id;
    await updateRegistration(row);
    await insertEvent({
      registration_id: row.id,
      user_id: row.user_id,
      from_status: previous,
      to_status: 'under_review',
      actor,
      note: 'Reviewed agreement ' + agreement.reference + ' version ' + agreement.version + ' signed ' + agreement.signed_on + ' covers this work. Not submitted to a PRO.',
      reference: agreement.reference,
      created_at: agreement.created_at,
    });
    moved.push(row.id);
  }
  return moved;
}

function transitionError(row, next, body) {
  const reference = clip(body.reference || body.external_reference, 200);
  const evidence = clip(body.evidence, 2000);
  const note = clip(body.note, 2000);
  if (!STATUSES.includes(next) || next === 'request_received' || next === 'needs_agreement') {
    return validation('Staff can record under review, submitted, registered, matched, paid, rejected, or needs information.');
  }
  if (next === 'submitted') {
    if (row.status !== 'under_review') return validation('Submit only after the request is under review.');
    if (!row.agreement_id) return validation('A reviewed agreement reference has to cover this work before it is submitted.');
    if (row.eligibility === 'not_eligible') return validation('This composition is not eligible for PRO registration.');
    if (!reference || reference.length < 3) return validation('Record the outside submission reference. A local save is not a submission.');
    if (row.eligibility === 'review' && note.length < 8) {
      return validation('Partial or unclear AI needs a staff note that the human contribution was reviewed before submission.');
    }
  }
  if (next === 'accepted') {
    if (row.status !== 'submitted') return validation('Registration follows a recorded submission.');
    if (evidence.length < 8) return validation('Record the registration receipt. A local note is not registration.');
  }
  const matchReceipt = clip(body.match_receipt || (next === 'matched' ? body.reference : ''), 2000);
  const paymentReceipt = clip(body.payment_receipt || (next === 'paid' ? body.reference : ''), 2000);
  if (next === 'matched') {
    if (row.status !== 'accepted') return validation('Matched follows a recorded registration.');
    if (matchReceipt.length < 8) return validation('Record the match receipt from The MLC, SoundExchange, or YouTube.');
  }
  if (next === 'paid') {
    if (row.status !== 'matched') return validation('Paid follows a recorded match.');
    if (paymentReceipt.length < 8) return validation('Record the payment receipt.');
  }
  if (next === 'rejected') {
    if (evidence.length < 8) return validation('Record the rejection evidence.');
    if (row.status === 'accepted' || row.status === 'matched' || row.status === 'paid') {
      return validation('A work with a registration receipt is not rejected from this screen.');
    }
  }
  if (next === 'under_review') {
    if (!row.agreement_id) return validation('Under review requires a reviewed agreement reference on the work.');
    if (row.eligibility === 'not_eligible') return validation('A work that is not eligible stays at needs information.');
    if (row.status !== 'needs_information' && row.status !== 'needs_agreement') {
      return validation('That status change is not available.');
    }
  }
  if (next === 'needs_information' && note.length < 8) {
    return validation('Say what information is still needed.');
  }
  return { reference, evidence, note, matchReceipt, paymentReceipt };
}

async function staffWrite(staff, body, now) {
  const src = body && typeof body === 'object' ? body : {};
  const action = clip(src.action, 40).toLowerCase();
  await ready();
  if (action === 'agreement') {
    const parsed = validateAgreement(staff, src, now || new Date());
    if (parsed.error) return { ok: false, status: 400, body: { error: parsed.error } };
    await insertAgreement(parsed.agreement);
    const moved = await promoteForAgreement(parsed.agreement, String(staff.id));
    return {
      ok: true,
      status: 201,
      body: {
        agreement: {
          id: parsed.agreement.id,
          user_id: parsed.agreement.user_id,
          reference: parsed.agreement.reference,
          version: parsed.agreement.version,
          signed_on: parsed.agreement.signed_on,
          catalog_scope: parsed.agreement.catalog_scope,
          reviewed: true,
          recorded_by: parsed.agreement.recorded_by,
        },
        promoted: moved,
        legal_review: legalReview(),
        contract_stored: false,
      },
    };
  }
  if (action === 'status') {
    const id = clip(src.id, 80);
    const next = clip(src.status, 40).toLowerCase();
    if (dishonestStatus(next)) return { ok: false, status: 400, body: { error: 'Pending at BMI is not a status. Record a real submission reference or leave the work unsent.' } };
    const registrations = await allRegistrations();
    const row = registrations.find((item) => sameId(item.id, id));
    if (!row) return { ok: false, status: 404, body: { error: 'Not found.' } };
    const checked = transitionError(row, next, src);
    if (checked.error) return { ok: false, status: 409, body: { error: checked.error } };
    const previous = row.status;
    row.status = next;
    if (next === 'submitted') row.external_reference = checked.reference;
    if (next === 'accepted' || next === 'rejected') row.evidence = checked.evidence;
    if (next === 'matched') row.match_receipt = checked.matchReceipt;
    if (next === 'paid') row.payment_receipt = checked.paymentReceipt;
    await updateRegistration(row);
    await insertEvent({
      registration_id: row.id,
      user_id: row.user_id,
      from_status: previous,
      to_status: next,
      actor: String(staff.id),
      note: checked.note,
      reference: next === 'submitted' ? checked.reference : (next === 'matched' ? checked.matchReceipt : (next === 'paid' ? checked.paymentReceipt : '')),
      created_at: (now || new Date()).toISOString(),
    });
    const agreement = coveringAgreement(await allAgreements(), row);
    return {
      ok: true,
      status: 200,
      body: Object.assign({ registration: present(row, await eventsFor(row.id), agreement) }, responseMeta()),
    };
  }
  return { ok: false, status: 400, body: { error: 'Staff action must be agreement or status.' } };
}

async function staffRead(query) {
  await ready();
  const registrations = await allRegistrations();
  const agreements = await allAgreements();
  const rows = registrations.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const checklists = rows.map((row) => checklistOf(row, coveringAgreement(agreements, row)));
  if (clip(query && query.format, 8).toLowerCase() === 'csv') {
    return { ok: true, status: 200, csv: checklistCsv(checklists) };
  }
  const shown = [];
  for (let i = 0; i < rows.length; i += 1) {
    const agreement = coveringAgreement(agreements, rows[i]);
    const view = present(rows[i], await eventsFor(rows[i].id), agreement);
    view.checklist = checklists[i];
    shown.push(view);
  }
  return {
    ok: true,
    status: 200,
    body: Object.assign({ registrations: shown }, responseMeta()),
  };
}

module.exports = {
  FILING_NOTE,
  STATUS_LABEL,
  checklistCsv,
  checklistOf,
  deriveStatus,
  dishonestStatus,
  eligibilityOf,
  isDummyTitle,
  legalReview,
  readOwn,
  resetStore,
  staffRead,
  staffWrite,
  statusDetail,
  statusLabel,
  publicFacing,
  submitOwn,
  validateEnvelope,
};
