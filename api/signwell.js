'use strict';

/**
 * POST /api/signwell
 * Creates a SignWell document from the PLAIGROUND Writer Split Sheet template.
 * Env: SIGNWELL_API_KEY, SIGNWELL_TEMPLATE_ID (never echo these).
 *
 * Writer 1 can sign in-page (embedded_signing_url). Writers 2+ are emailed.
 * The live template has Writer 1 and Writer 2 slots; extra writers are kept
 * for the record and are not added as invented PDF fields.
 */

const SIGNWELL_URL = 'https://www.signwell.com/api/v1/document_templates/documents/';
const TEMPLATE_WRITER_SLOTS = 2;
const MAX_WRITERS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BLOCKED_EMAIL = /patrick@|tonegrid|wayne/i;

function isConfigured() {
  return Boolean(process.env.SIGNWELL_API_KEY && process.env.SIGNWELL_TEMPLATE_ID);
}

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

function scrub(text) {
  return String(text || '')
    .replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]')
    .slice(0, 400);
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

function signwellErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'SignWell could not create the document.';
  }
  if (typeof payload.error === 'string') return scrub(payload.error);
  if (typeof payload.message === 'string') return scrub(payload.message);
  if (Array.isArray(payload.errors)) {
    return scrub(payload.errors.map((item) => item.message || item).join(' '));
  }
  return 'SignWell could not create the document.';
}

function buildRecipients(writers, emailLinkOnly) {
  const slotted = writers.slice(0, TEMPLATE_WRITER_SLOTS);
  return slotted.map((writer, index) => {
    const recipient = {
      id: String(index + 1),
      placeholder_name: `Writer ${index + 1}`,
      name: writer.name,
      email: writer.email,
    };
    if (!emailLinkOnly) {
      // Embed mode: Writer 1 signs in-page; others get the SignWell email.
      recipient.send_email = index !== 0;
    }
    return recipient;
  });
}

async function createDocument(req, res) {
  if (!isConfigured()) {
    sendJson(res, 503, {
      error: 'SignWell is not configured. Set SIGNWELL_API_KEY and SIGNWELL_TEMPLATE_ID.',
      code: 'not_configured',
    });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }

  const songTitle = String(body.songTitle || body.song_title || '').trim();
  if (!songTitle) {
    sendJson(res, 400, { error: 'Song title is required.' });
    return;
  }

  const emailLinkOnly = Boolean(body.emailLinkOnly);
  const parsed = normalizeWriters(body.writers);
  if (parsed.error) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const { writers } = parsed;
  const excludePlaceholders = [];
  if (writers.length < 2) excludePlaceholders.push('Writer 2');

  const payload = {
    test_mode: true,
    template_id: process.env.SIGNWELL_TEMPLATE_ID,
    embedded_signing: !emailLinkOnly,
    name: `${songTitle} – Writer Split Sheet`,
    recipients: buildRecipients(writers, emailLinkOnly),
  };
  if (excludePlaceholders.length) {
    payload.exclude_placeholders = excludePlaceholders;
  }

  let response;
  try {
    response = await fetch(SIGNWELL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.SIGNWELL_API_KEY,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    sendJson(res, 502, { error: 'Could not reach SignWell.' });
    return;
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    sendJson(res, response.status >= 400 && response.status < 600 ? response.status : 502, {
      error: signwellErrorMessage(data),
    });
    return;
  }

  const extraWriters = writers.slice(TEMPLATE_WRITER_SLOTS).map((writer, index) => ({
    slot: index + TEMPLATE_WRITER_SLOTS + 1,
    name: writer.name,
    email: writer.email,
    share: writer.share,
    pro: writer.pro,
  }));

  const result = {
    mode: emailLinkOnly ? 'email' : 'embed',
    documentId: data.id || null,
    extraWritersRecorded: extraWriters,
    templateWriterSlots: TEMPLATE_WRITER_SLOTS,
  };

  if (!emailLinkOnly) {
    const recipients = Array.isArray(data.recipients) ? data.recipients : [];
    const writer1 =
      recipients.find((row) => row.placeholder_name === 'Writer 1') ||
      recipients.find((row) => String(row.id) === '1') ||
      recipients[0];
    const embedUrl = writer1 && writer1.embedded_signing_url;
    if (!embedUrl) {
      sendJson(res, 502, { error: 'SignWell did not return an embedded signing URL for Writer 1.' });
      return;
    }
    result.embeddedSigningUrl = embedUrl;
  }

  sendJson(res, 200, result);
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    sendJson(res, 200, { configured: isConfigured() });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  await createDocument(req, res);
};
