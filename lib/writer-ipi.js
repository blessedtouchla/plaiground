'use strict';

/**
 * Writer IPI on the user's account (profile.writer).
 *
 * GET    /api/me/ipi   session required; { writer: { ipi, pro, pro_other, updated_at } | null }
 * PUT    /api/me/ipi   session required; body { ipi, pro, pro_other? }. POST is accepted too.
 * DELETE /api/me/ipi   session required; clears it.
 *
 * Rewritten onto api/me.js (?action=ipi), so no new Vercel function.
 * Only the IPI and the PRO name are stored. Never SSN, date of birth, bank details
 * or PRO login details: any such field in the body is rejected, not stored.
 */

const PROS = ['BMI', 'ASCAP', 'SESAC', 'Other'];
const MIN_DIGITS = 6;
const MAX_DIGITS = 15;
const FORBIDDEN_KEYS = ['ssn', 'social', 'dob', 'birth', 'birthday', 'date_of_birth', 'bank', 'routing', 'account_number', 'password', 'pass', 'login', 'username_pro', 'pro_password', 'pro_login'];

function validation(message) {
  return { error: message };
}

function cleanIpi(value) {
  return String(value == null ? '' : value).trim().replace(/[\s.\-]/g, '');
}

function looksLikeSsn(value) {
  return /^\s*\d{3}[-\s]\d{2}[-\s]\d{4}\s*$/.test(String(value == null ? '' : value));
}

function normalizePro(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  for (let i = 0; i < PROS.length; i += 1) {
    if (PROS[i].toLowerCase() === raw) return PROS[i];
  }
  return '';
}

function cleanProOther(value) {
  return String(value == null ? '' : value)
    .replace(/[^A-Za-z0-9 &.'()\/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function hasForbiddenField(body) {
  if (!body || typeof body !== 'object') return false;
  return Object.keys(body).some(function (key) {
    const k = String(key).toLowerCase();
    return FORBIDDEN_KEYS.some(function (bad) { return k === bad || k.indexOf(bad) === 0; });
  });
}

/** Validate client input. Returns { ok: true, writer } or { error }. */
function normalize(input, now) {
  const src = input && typeof input === 'object' ? input : {};
  if (hasForbiddenField(src)) return validation('Only your IPI and PRO are saved here. Never send an SSN, birth date, bank details or a PRO login.');
  if (looksLikeSsn(src.ipi)) return validation('That looks like a Social Security number. We never need it. Paste your IPI instead.');
  const ipi = cleanIpi(src.ipi);
  if (!ipi) return validation('Paste your IPI number.');
  if (!/^\d+$/.test(ipi)) return validation('Use numbers only, exactly as your PRO shows your IPI.');
  if (ipi.length < MIN_DIGITS || ipi.length > MAX_DIGITS) return validation("That doesn't look like a full IPI. Check it in your PRO account.");
  const pro = normalizePro(src.pro);
  if (!pro) return validation('Pick your PRO: BMI, ASCAP, SESAC or Other.');
  const proOther = pro === 'Other' ? cleanProOther(src.pro_other || src.proOther) : '';
  if (pro === 'Other' && !proOther) return validation('Type the name of your PRO.');
  return {
    ok: true,
    writer: {
      ipi: ipi,
      pro: pro,
      pro_other: proOther,
      updated_at: (now || new Date()).toISOString(),
    },
  };
}

/** Read a stored value back. Anything malformed reads as null. */
function readWriter(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const ipi = cleanIpi(raw.ipi);
  const pro = normalizePro(raw.pro);
  if (!ipi || !/^\d+$/.test(ipi) || ipi.length > MAX_DIGITS || !pro) return null;
  const updated = typeof raw.updated_at === 'string' && !isNaN(Date.parse(raw.updated_at)) ? raw.updated_at : '';
  const locked = typeof raw.locked_at === 'string' && !isNaN(Date.parse(raw.locked_at)) ? raw.locked_at : '';
  const out = {
    ipi: ipi,
    pro: pro,
    pro_other: pro === 'Other' ? cleanProOther(raw.pro_other) : '',
    updated_at: updated,
  };
  if (locked) out.locked_at = locked;
  return out;
}

/**
 * HTTP handler. deps come from api/me.js so auth and storage stay in one place:
 * { loadUser, readBody, sendJson, rejectQueryPassword, bodyHasPassword, mergeFacts, readStored, notConfigured }
 */
async function handle(req, res, deps) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'PUT' && method !== 'POST' && method !== 'DELETE') {
    res.setHeader('Allow', 'GET, PUT, POST, DELETE');
    deps.sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  if (deps.rejectQueryPassword(req, res)) return;
  const row = await deps.loadUser(req, res);
  if (!row) return;
  try {
    if (method === 'GET') {
      deps.sendJson(res, 200, { writer: readWriter(deps.readStored(row).writer) });
      return;
    }
    const current = readWriter(deps.readStored(row).writer);
    if (current && current.locked_at && method !== 'GET') {
      deps.sendJson(res, 409, { error: 'Your IPI is locked on this account. Contact support to change it.', writer: current });
      return;
    }
    if (method === 'DELETE') {
      await deps.mergeFacts(row.id, { writer: null });
      deps.sendJson(res, 200, { ok: true, writer: null });
      return;
    }
    let body;
    try {
      body = await deps.readBody(req);
    } catch (err) {
      deps.sendJson(res, 400, { error: 'Invalid JSON.' });
      return;
    }
    if (deps.bodyHasPassword(body)) {
      deps.sendJson(res, 400, { error: 'Password is not accepted here.' });
      return;
    }
    const parsed = normalize(body && (body.writer || body));
    if (parsed.ok && body && body.lock === true) parsed.writer.locked_at = new Date().toISOString();
    if (parsed.error) {
      deps.sendJson(res, 400, { error: parsed.error });
      return;
    }
    const saved = await deps.mergeFacts(row.id, { writer: parsed.writer });
    const stored = saved ? readWriter(deps.readStored(saved).writer) : parsed.writer;
    deps.sendJson(res, 200, { ok: true, writer: stored || parsed.writer });
  } catch (err) {
    if (err && err.code === 'ACCOUNTS_UNCONFIGURED') {
      deps.notConfigured(res);
      return;
    }
    deps.sendJson(res, 503, { error: 'Could not save your IPI right now.' });
  }
}

module.exports = {
  PROS: PROS,
  MIN_DIGITS: MIN_DIGITS,
  MAX_DIGITS: MAX_DIGITS,
  cleanIpi: cleanIpi,
  looksLikeSsn: looksLikeSsn,
  normalizePro: normalizePro,
  normalize: normalize,
  readWriter: readWriter,
  hasForbiddenField: hasForbiddenField,
  handle: handle,
};
