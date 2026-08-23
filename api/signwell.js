'use strict';

/**
 * GET  /api/signwell            { configured }
 * GET  /api/signwell?id=        SignWell document status (server-only key)
 * POST /api/signwell            Create a document from the Writer Split Sheet template
 *
 * Env: SIGNWELL_API_KEY, SIGNWELL_TEMPLATE_ID (never echo these).
 * Create-from-template uses test_mode: false (live paid Business).
 * Writer 1 can sign in-page (embedded_signing_url). Writers 2+ are emailed.
 * Every create also assigns the template placeholder SignWell reported as
 * "document sender" (their docs title-case it "Document Sender").
 */

const { queryValue } = require('../lib/route');
const signwell = require('../lib/signwell');

const TEMPLATE_WRITER_SLOTS = 2;
const MAX_WRITERS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BLOCKED_EMAIL = /patrick@|tonegrid|wayne/i;
// Live create-from-template error: "These placeholder_names do not have a
// recipient assigned: document sender." SignWell's 422 example also lists
// recipients.duplicated_emails, so this slot uses the existing PLAIGROUND
// business address instead of Writer 1's email.
const DOCUMENT_SENDER_PLACEHOLDER = 'document sender';
const DOCUMENT_SENDER_NAME = 'PLAIGROUND';
const DOCUMENT_SENDER_EMAIL = 'emailplaiground@gmail.com';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body || '{}'));
    } catch {
      return Promise.reject(new Error('Invalid JSON'));
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sharesSumTo100(shares) {
  const cents = shares.reduce((sum, share) => sum + Math.round(Number(share) * 100), 0);
  return cents === 10000;
}

function normalizeWriters(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_WRITERS) {
    return { error: 'Provide between 1 and 5 writers.' };
  }

  const writers = [];
  for (let i = 0; i < input.length; i += 1) {
    const row = input[i] || {};
    const name = String(row.name || '').trim();
    const email = String(row.email || '').trim();
    const pro = String(row.pro || '').trim();
    const share = Number(row.share);

    if (!name) return { error: `Writer ${i + 1} needs a name.` };
    if (!email || !EMAIL_RE.test(email)) {
      return { error: `Writer ${i + 1} needs a valid email.` };
    }
    if (BLOCKED_EMAIL.test(email)) {
      return { error: `Writer ${i + 1} email cannot be used.` };
    }
    if (!Number.isFinite(share) || share < 0 || share > 100) {
      return { error: `Writer ${i + 1} share must be a number from 0 to 100.` };
    }

    writers.push({ name, email, share, pro });
  }

  if (!sharesSumTo100(writers.map((writer) => writer.share))) {
    return { error: 'Writer shares must total 100% of the writer’s 50%.' };
  }

  return { writers };
}

function isDocumentSender(row) {
  return String((row && row.placeholder_name) || '').trim().toLowerCase() === DOCUMENT_SENDER_PLACEHOLDER;
}

function buildRecipients(writers, emailLinkOnly) {
  const slotted = writers.slice(0, TEMPLATE_WRITER_SLOTS);
  const recipients = slotted.map((writer, index) => {
    const recipient = {
      id: String(index + 1),
      placeholder_name: `Writer ${index + 1}`,
      name: writer.name,
      email: writer.email,
    };
    if (!emailLinkOnly) {
      recipient.send_email = index !== 0;
    }
    return recipient;
  });
  recipients.push({
    id: String(recipients.length + 1),
    placeholder_name: DOCUMENT_SENDER_PLACEHOLDER,
    name: DOCUMENT_SENDER_NAME,
    email: DOCUMENT_SENDER_EMAIL,
    send_email: false,
  });
  return recipients;
}

function writer1FromResponse(recipients) {
  return (
    recipients.find((row) => row && row.placeholder_name === 'Writer 1') ||
    recipients.find((row) => row && String(row.id) === '1' && !isDocumentSender(row))
  );
}

async function getStatus(req, res) {
  const id = queryValue(req, 'id') || queryValue(req, 'document_id') || queryValue(req, 'documentId');
  if (!id) {
    sendJson(res, 200, { configured: signwell.isConfigured() });
    return;
  }
  if (!signwell.isConfigured()) {
    sendJson(res, 503, {
      configured: false,
      signed: false,
      error: 'SignWell is not configured. Set SIGNWELL_API_KEY and SIGNWELL_TEMPLATE_ID.',
      code: 'not_configured',
    });
    return;
  }
  const result = await signwell.getDocument(id);
  if (!result.ok) {
    sendJson(res, result.status, Object.assign({ configured: true }, result.data));
    return;
  }
  const info = signwell.publicDocument(result.data);
  sendJson(res, 200, Object.assign({ configured: true }, info));
}

async function createSplitDocument(body) {
  if (!signwell.isConfigured()) {
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

  const songTitle = String((body && (body.songTitle || body.song_title)) || '').trim();
  if (!songTitle) {
    return { ok: false, status: 400, data: { error: 'Song title is required.', signed: false } };
  }

  const emailLinkOnly = Boolean(body && body.emailLinkOnly);
  const parsed = normalizeWriters(body && body.writers);
  if (parsed.error) {
    return { ok: false, status: 400, data: { error: parsed.error, signed: false } };
  }

  const { writers } = parsed;
  const excludePlaceholders = [];
  if (writers.length < 2) excludePlaceholders.push('Writer 2');

  const payload = {
    test_mode: false,
    template_id: signwell.templateId(),
    embedded_signing: !emailLinkOnly,
    name: `${songTitle} – Writer Split Sheet`,
    recipients: buildRecipients(writers, emailLinkOnly),
  };
  if (excludePlaceholders.length) {
    payload.exclude_placeholders = excludePlaceholders;
  }

  const result = await signwell.signwellFetch(signwell.CREATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    return result;
  }

  const data = result.data || {};
  const extraWriters = writers.slice(TEMPLATE_WRITER_SLOTS).map((writer, index) => ({
    slot: index + TEMPLATE_WRITER_SLOTS + 1,
    name: writer.name,
    email: writer.email,
    share: writer.share,
    pro: writer.pro,
  }));

  const created = {
    mode: emailLinkOnly ? 'email' : 'embed',
    documentId: data.id || null,
    extraWritersRecorded: extraWriters,
    templateWriterSlots: TEMPLATE_WRITER_SLOTS,
    signed: signwell.documentSigned(data),
    signwell_status: signwell.documentSigned(data) ? String(data.status || 'Completed') : 'awaiting_signature',
  };

  if (!emailLinkOnly) {
    const recipients = Array.isArray(data.recipients) ? data.recipients : [];
    const writer1 = writer1FromResponse(recipients);
    const embedUrl = writer1 && writer1.embedded_signing_url;
    if (!embedUrl) {
      return { ok: false, status: 502, data: { error: 'SignWell did not return an embedded signing URL for Writer 1.', signed: false } };
    }
    created.embeddedSigningUrl = embedUrl;
  }

  return { ok: true, status: 200, data: created };
}

async function createDocument(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  const result = await createSplitDocument(body);
  sendJson(res, result.status, result.data || {});
}

async function handler(req, res) {
  if (req.method === 'GET') {
    await getStatus(req, res);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await createDocument(req, res);
}

handler.createSplitDocument = createSplitDocument;
module.exports = handler;
