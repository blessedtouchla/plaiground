'use strict';

/**
 * Server-only SignWell helpers. Read SIGNWELL_API_KEY and SIGNWELL_TEMPLATE_ID
 * from process.env. Never log the key.
 *
 * Create: POST https://www.signwell.com/api/v1/document_templates/documents/
 * Status: GET  https://www.signwell.com/api/v1/documents/:id
 */

const CREATE_URL = 'https://www.signwell.com/api/v1/document_templates/documents/';
const DOCUMENT_BASE = 'https://www.signwell.com/api/v1/documents/';
const DOCUMENT_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const COMPLETED = new Set(['completed', 'manually completed']);

function apiKey() {
  return String(process.env.SIGNWELL_API_KEY || '').trim();
}

function templateId() {
  return String(process.env.SIGNWELL_TEMPLATE_ID || '').trim();
}

function isConfigured() {
  return Boolean(apiKey() && templateId());
}

function isDocumentId(value) {
  return DOCUMENT_ID_RE.test(String(value || '').trim());
}

function scrub(text) {
  return String(text || '')
    .replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]')
    .slice(0, 400);
}

function signwellErrorMessage(payload, fallback) {
  if (typeof payload === 'string' && payload.trim()) return scrub(payload);
  if (!payload || typeof payload !== 'object') {
    return fallback || 'SignWell rejected the request.';
  }
  if (typeof payload.error === 'string' && payload.error.trim()) return scrub(payload.error);
  if (payload.error && typeof payload.error.message === 'string') return scrub(payload.error.message);
  if (typeof payload.message === 'string' && payload.message.trim()) return scrub(payload.message);
  if (Array.isArray(payload.errors)) {
    return scrub(payload.errors.map((item) => item.message || item).join(' '));
  }
  return fallback || 'SignWell rejected the request.';
}

function isTrialError(text) {
  const raw = String(text || '');
  return /trial/i.test(raw) && /expir|ended|lapse/i.test(raw);
}

function errorCode(message) {
  if (isTrialError(message)) return 'SIGNWELL_TRIAL';
  return 'SIGNWELL_ERROR';
}

function isCompletedStatus(value) {
  return COMPLETED.has(String(value || '').trim().toLowerCase());
}

function recipientsOf(doc) {
  if (!doc || typeof doc !== 'object') return [];
  if (Array.isArray(doc.recipients)) return doc.recipients;
  if (doc.data && Array.isArray(doc.data.recipients)) return doc.data.recipients;
  return [];
}

function unwrapDocument(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.document && typeof payload.document === 'object') return payload.document;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
}

function documentSigned(payload) {
  const doc = unwrapDocument(payload);
  if (!doc) return false;
  if (isCompletedStatus(doc.status)) return true;
  const recipients = recipientsOf(doc);
  if (!recipients.length) return false;
  return recipients.every((row) => isCompletedStatus(row && (row.status || row.signed_status)));
}

function publicDocument(payload) {
  const doc = unwrapDocument(payload) || {};
  const recipients = recipientsOf(doc).map((row) => ({
    id: row && row.id != null ? String(row.id) : '',
    name: String((row && (row.name || row.placeholder_name)) || '').trim(),
    status: String((row && row.status) || '').trim(),
    signed: isCompletedStatus(row && (row.status || row.signed_status)),
  }));
  return {
    id: String(doc.id || '').trim(),
    status: String(doc.status || '').trim(),
    signed: documentSigned(doc),
    recipients,
  };
}

async function signwellFetch(url, options) {
  const opts = options || {};
  if (!isConfigured()) {
    return {
      ok: false,
      status: 503,
      data: {
        error: 'SignWell is not configured. Set SIGNWELL_API_KEY and SIGNWELL_TEMPLATE_ID.',
        code: 'not_configured',
        signed: false,
      },
    };
  }

  let response;
  try {
    response = await fetch(url, {
      method: String(opts.method || 'GET').toUpperCase(),
      headers: Object.assign({
        Accept: 'application/json',
        'X-Api-Key': apiKey(),
      }, opts.headers || {}),
      body: opts.body,
    });
  } catch {
    return { ok: false, status: 502, data: { error: 'Could not reach SignWell.', code: 'SIGNWELL_ERROR', signed: false } };
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = signwellErrorMessage(data, 'SignWell rejected the request.');
    return {
      ok: false,
      status: response.status >= 400 && response.status < 600 ? response.status : 502,
      data: {
        error,
        code: errorCode(error),
        signed: false,
      },
    };
  }

  return { ok: true, status: response.status, data };
}

async function getDocument(id) {
  const documentId = String(id || '').trim();
  if (!isDocumentId(documentId)) {
    return { ok: false, status: 400, data: { error: 'SignWell document id is required.', code: 'SIGNWELL_REQUIRED', signed: false } };
  }
  return signwellFetch(DOCUMENT_BASE + encodeURIComponent(documentId), { method: 'GET' });
}

async function requireSignedDocument(id) {
  const documentId = String(id || '').trim();
  if (!isDocumentId(documentId)) {
    return {
      ok: false,
      status: 403,
      code: 'SIGNWELL_REQUIRED',
      error: 'Sign the split sheet in SignWell before submitting.',
      signed: false,
    };
  }
  if (!isConfigured()) {
    return {
      ok: false,
      status: 503,
      code: 'not_configured',
      error: 'SignWell is not configured. Set SIGNWELL_API_KEY and SIGNWELL_TEMPLATE_ID.',
      signed: false,
    };
  }
  const result = await getDocument(documentId);
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      code: result.data.code || errorCode(result.data.error),
      error: result.data.error,
      signed: false,
    };
  }
  const info = publicDocument(result.data);
  if (!info.signed) {
    return {
      ok: false,
      status: 403,
      code: 'SIGNWELL_UNSIGNED',
      error: info.status
        ? ('SignWell document is ' + info.status + '. Every required signer must finish before submit.')
        : 'SignWell document is not completed. Every required signer must finish before submit.',
      signed: false,
      document: info,
    };
  }
  return { ok: true, status: 200, signed: true, document: info };
}

module.exports = {
  CREATE_URL,
  DOCUMENT_BASE,
  documentSigned,
  errorCode,
  getDocument,
  isConfigured,
  isDocumentId,
  isTrialError,
  publicDocument,
  requireSignedDocument,
  signwellErrorMessage,
  signwellFetch,
  templateId,
};
