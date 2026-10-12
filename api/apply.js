'use strict';

/**
 * POST /api/apply
 * No auth. Honeypot plus a per-IP limit. Saves the application and emails the owner.
 * Never accepts a password.
 *
 * The in-memory limiter is prototype-grade. It lives on one serverless instance,
 * resets on cold start, and is not shared across instances.
 */

const applications = require('../lib/applications');
const { sendApplicationAlert } = require('../lib/mail');
const core = require('../lib/song-helper');

const BODY_MAX = 20000;
const limiter = core.createLimiter({
  max: core.RATE_MAX,
  windowMs: core.RATE_WINDOW_MS,
});

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

function honeypotFilled(body) {
  return Boolean(String((body && body.company_website) || '').trim());
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const body = await readBody(req);
  if (body && body.__tooBig) {
    sendJson(res, 413, { error: 'That application is too long.' });
    return;
  }
  if (body && body.__bad) {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  if (honeypotFilled(body)) {
    sendJson(res, 400, { error: 'Could not save that application.' });
    return;
  }
  if (!limiter.allow(clientIp(req))) {
    sendJson(res, 429, { error: 'That is a lot of applications from this connection. Wait a bit and try again.' });
    return;
  }
  try {
    const saved = await applications.saveApplication(body);
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
};
