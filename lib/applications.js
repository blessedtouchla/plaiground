'use strict';

/**
 * Waitlist applications. No account and no password.
 * Memory store when accounts are in memory. Postgres otherwise.
 */

const crypto = require('crypto');
const db = require('./db');
const { sendApplicationAlert } = require('./mail');
const { sendJson } = require('./tonegrid');
const core = require('./song-helper');

const NAME_MAX = 120;
const EMAIL_MAX = 200;
const PHONE_MAX = 40;
const PACKAGE_MAX = 120;
const HELP_MAX = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PACKAGES = {
  'Persona package': true,
  'Content engine': true,
  'Release package': true,
  'Fan growth setup': true,
  'Starter': true,
  'Grow': true,
  'Full management': true,
  'Coaching': true,
  'Sync': true,
  'Brand protection': true,
  'Playlist pitching and creator campaigns': true,
  'Monthly management': true,
  'Playlist and blog pitching': true,
  'Marketing plan': true,
  'Multiverse Album': true,
};

let rows = [];

function resetStore() {
  rows = [];
}

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch (err) {
    return false;
  }
}

function clip(value, max) {
  return String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  return err;
}

function hasPasswordField(input) {
  if (!input || typeof input !== 'object') return false;
  return Object.keys(input).some((key) => /password/i.test(key) && String(input[key] || '').trim());
}

function sanitize(input) {
  const source = input && typeof input === 'object' ? input : {};
  if (hasPasswordField(source)) {
    throw validationError('Password is not accepted here.');
  }
  const name = clip(source.name, NAME_MAX);
  const email = clip(source.email, EMAIL_MAX).toLowerCase();
  const phone = clip(source.phone, PHONE_MAX);
  const packageName = clip(source.package || source.package_name, PACKAGE_MAX);
  const help = clip(source.help || source.message, HELP_MAX);
  const digits = phone.replace(/\D/g, '');
  if (!name || !EMAIL_RE.test(email) || digits.length < 7 || digits.length > 15 || !packageName || help.length < 2) {
    throw validationError('Name, email, phone, the package, and what you want help with are required.');
  }
  if (!PACKAGES[packageName]) {
    throw validationError('Pick a package from the list.');
  }
  return { name, email, phone, package: packageName, help };
}

function publicRow(row) {
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    package: String(row.package || ''),
    help: String(row.help || ''),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

async function ready() {
  if (usingAccountsMemory()) return;
  const accounts = require('./accounts');
  await accounts.ensureReady();
}

async function saveApplication(input) {
  const row = sanitize(input);
  await ready();
  const now = new Date().toISOString();
  if (usingAccountsMemory()) {
    const saved = publicRow(Object.assign({ id: crypto.randomUUID(), created_at: now }, row));
    rows.push(saved);
    return saved;
  }
  const inserted = await db.query(
    'INSERT INTO applications (name, email, phone, package, help) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, package, help, created_at',
    [row.name, row.email, row.phone, row.package, row.help]
  );
  return publicRow(inserted[0] || Object.assign({ created_at: now }, row));
}

async function listApplications() {
  await ready();
  if (usingAccountsMemory()) {
    return rows.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  const listed = await db.query(
    'SELECT id, name, email, phone, package, help, created_at FROM applications ORDER BY created_at DESC LIMIT 200'
  );
  return (listed || []).map(publicRow);
}

const BODY_MAX = 20000;
const limiter = core.createLimiter({
  max: core.RATE_MAX,
  windowMs: core.RATE_WINDOW_MS,
});

function readApplyBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string') {
    if (req.body.length > BODY_MAX) return Promise.resolve({ __tooBig: true });
    try {
      return Promise.resolve(JSON.parse(req.body || '{}'));
    } catch (err) {
      return Promise.resolve({ __bad: true });
    }
  }
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_MAX) {
        tooBig = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) {
        resolve({ __tooBig: true });
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        resolve({ __bad: true });
      }
    });
    req.on('error', () => resolve({ __bad: true }));
  });
}

function clientIp(req) {
  const headers = req.headers || {};
  const fwd = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  if (fwd) return String(fwd).split(',')[0].trim().slice(0, 80) || 'unknown';
  const real = headers['x-real-ip'] || headers['X-Real-Ip'] || '';
  return String(real).trim().slice(0, 80) || 'unknown';
}

async function handleApply(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const body = await readApplyBody(req);
  if (body && body.__tooBig) {
    sendJson(res, 413, { error: 'That application is too long.' });
    return;
  }
  if (body && body.__bad) {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  if (String((body && body.company_website) || '').trim()) {
    sendJson(res, 400, { error: 'Could not save that application.' });
    return;
  }
  if (!limiter.allow(clientIp(req))) {
    sendJson(res, 429, { error: 'That is a lot of applications from this connection. Wait a bit and try again.' });
    return;
  }
  try {
    const saved = await saveApplication(body);
    let mail = { mail_sent: false };
    try {
      mail = await sendApplicationAlert(saved);
    } catch (err) {
      mail = { mail_sent: false, error: 'Could not send the application email.' };
    }
    sendJson(res, 200, {
      ok: true,
      id: saved.id,
      message: "We'll reach out soon.",
      mail_sent: Boolean(mail && mail.mail_sent),
    });
  } catch (err) {
    if (err && err.code === 'VALIDATION') {
      sendJson(res, 400, { error: err.message });
      return;
    }
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      sendJson(res, 503, { error: 'Accounts are not configured.' });
      return;
    }
    sendJson(res, 503, { error: 'Could not save that application.' });
  }
}

module.exports = {
  HELP_MAX,
  PACKAGES,
  handleApply,
  hasPasswordField,
  listApplications,
  resetStore,
  sanitize,
  saveApplication,
};
