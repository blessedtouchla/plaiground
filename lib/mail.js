// Owner alerts for signup, roadmap, applications, and new releases.
'use strict';

/**
 * Auth mail via Resend: signup confirm, magic sign-in, password reset.
 * Server-only env: RESEND_API_KEY, CONFIRM_SECRET (or SIGNUP_CONFIRM_SECRET), CONFIRM_FROM.
 * Never put these in HTML/JS. No NEXT_PUBLIC_ mail keys. From stays PLAIGROUND.
 */

const crypto = require('crypto');
const aiDisclosure = require('./ai-disclosure');
const { heardAboutLabel } = require('./heard-about');

const RESEND_URL = 'https://api.resend.com/emails';
const SITE_ORIGIN = 'https://www.wannaplai.com';
const TOKEN_TTL_SECONDS = 24 * 60 * 60;
const AUTH_TOKEN_TTL_SECONDS = 60 * 60;
const DEFAULT_FROM = 'PLAIGROUND <confirm@wannaplai.com>';
const MAIL_NOT_CONFIGURED = 'Mail is not configured.';
const CONTACT_EMAIL = 'emailplaiground@gmail.com';
const PROBLEM_MAX = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PURPOSES = { confirm: true, magic: true, reset: true };

function resendKey() {
  return String(process.env.RESEND_API_KEY || '').trim();
}

function confirmSecret() {
  return String(
    process.env.CONFIRM_SECRET || process.env.SIGNUP_CONFIRM_SECRET || process.env.SESSION_SECRET || ''
  ).trim();
}

function fromAddress() {
  const raw = String(process.env.CONFIRM_FROM || '').trim();
  if (!raw) return DEFAULT_FROM;
  if (raw.indexOf('<') !== -1 && raw.indexOf('>') !== -1) return raw;
  return 'PLAIGROUND <' + raw + '>';
}

function isMailConfigured() {
  return Boolean(resendKey());
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return '';
  return email;
}

function scrub(text) {
  return String(text || '')
    .replace(/\b(?:re|sk|rk)_[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]')
    .slice(0, 400);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function normalizePurpose(value) {
  const purpose = String(value || '').trim().toLowerCase();
  return PURPOSES[purpose] ? purpose : 'confirm';
}

function signToken(email, purpose) {
  const secret = confirmSecret();
  if (!secret) return '';
  const kind = normalizePurpose(purpose);
  const ttl = kind === 'confirm' ? TOKEN_TTL_SECONDS : AUTH_TOKEN_TTL_SECONDS;
  const payload = JSON.stringify({
    email,
    exp: Math.floor(Date.now() / 1000) + ttl,
    p: kind,
  });
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', secret).update(body).digest();
  return body + '.' + b64url(sig);
}

function verifyToken(token, purpose) {
  const secret = confirmSecret();
  if (!secret) return null;
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const expected = b64url(crypto.createHmac('sha256', secret).update(parts[0]).digest());
  const given = Buffer.from(parts[1]);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  const email = normalizeEmail(payload.email);
  const exp = Number(payload.exp);
  if (!email || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  const got = payload.p ? normalizePurpose(payload.p) : 'confirm';
  const wantPurpose = purpose ? normalizePurpose(purpose) : got;
  if (got !== wantPurpose) return null;
  return { email, purpose: got, exp };
}

function confirmLink(email) {
  return authLink(email, 'confirm');
}

function authLink(email, purpose) {
  const kind = normalizePurpose(purpose);
  const path = kind === 'magic' ? '/magic.html' : kind === 'reset' ? '/forgot.html' : '/confirmed.html';
  const url = new URL(path, SITE_ORIGIN);
  url.searchParams.set('email', email);
  const token = signToken(email, kind);
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

function mailCopy(purpose) {
  if (purpose === 'magic') {
    return {
      subject: 'Your PLAIGROUND sign-in link',
      line: 'Sign in to PLAIGROUND with this one-time link:',
      ttl: 'This link is good for about one hour. If it is not in the inbox, check Spam and Promotions.',
    };
  }
  if (purpose === 'reset') {
    return {
      subject: 'Reset your PLAIGROUND password',
      line: 'Reset the password on your PLAIGROUND account with this link:',
      ttl: 'This link is good for about one hour. If it is not in the inbox, check Spam and Promotions.',
    };
  }
  return {
    subject: 'Confirm your PLAIGROUND email',
    line: 'Confirm this email for your PLAIGROUND account:',
    ttl: 'This link is good for about 24 hours.',
  };
}

function mailBodies(email, artist, link, purpose) {
  const name = String(artist || '').trim();
  const greeting = name ? 'Hi ' + name + ',' : 'Hi,';
  const copy = mailCopy(normalizePurpose(purpose));
  const text = [
    greeting,
    '',
    copy.line,
    link,
    '',
    copy.ttl,
    '',
    'PLAIGROUND',
  ].join('\n');
  const html = [
    '<p>' + escapeHtml(greeting) + '</p>',
    '<p>' + escapeHtml(copy.line) + '</p>',
    '<p><a href="' + escapeHtml(link) + '">' + escapeHtml(link) + '</a></p>',
    '<p>' + escapeHtml(copy.ttl) + '</p>',
  ].join('');
  return { text, html, subject: copy.subject };
}

function resendErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== 'object') {
    return fallback || 'Could not send the confirmation email.';
  }
  const raw =
    (payload.error && typeof payload.error.message === 'string' && payload.error.message) ||
    (typeof payload.error === 'string' && payload.error) ||
    (typeof payload.message === 'string' && payload.message) ||
    '';
  if (/api[\s_-]*key|secret|bearer|authorization/i.test(raw)) {
    return 'Mail provider rejected the request.';
  }
  if (!raw) return fallback || 'Could not send the confirmation email.';
  return scrub(raw);
}

async function postResend(payload, fallback) {
  if (!isMailConfigured()) {
    return { mail_sent: false, error: MAIL_NOT_CONFIGURED };
  }

  let response;
  try {
    response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + resendKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { mail_sent: false, error: 'Could not reach the mail provider.' };
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    return { mail_sent: false, error: resendErrorMessage(data, fallback) };
  }

  return { mail_sent: true, from: payload.from };
}

async function sendAuthEmail(input) {
  const email = normalizeEmail(input && input.email);
  if (!email) {
    return { mail_sent: false, error: 'A valid email is required.' };
  }

  const purpose = normalizePurpose(input && (input.purpose || input.kind));
  const artist = String((input && input.artist) || '').trim().slice(0, 120);
  const link = authLink(email, purpose);
  const mail = mailBodies(email, artist, link, purpose);
  const from = fromAddress();
  const sent = await postResend({
    from,
    to: [email],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  if (!sent.mail_sent) return sent;
  return { mail_sent: true, email, link, purpose, from };
}

function clipProblem(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, PROBLEM_MAX);
}

function clipPageId(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
}

function pageLink(path, id) {
  const safe = clipPageId(id);
  if (!safe) return '';
  return SITE_ORIGIN + '/' + path + '?id=' + encodeURIComponent(safe);
}

function problemLinks(input) {
  return {
    release: pageLink('song.html', input && (input.release || input.release_id)),
    artist: pageLink('artists.html', input && (input.artist || input.artist_id)),
  };
}

function problemLinkLines(links) {
  const lines = [];
  if (links && links.release) lines.push('Release: ' + links.release);
  if (links && links.artist) lines.push('Artist profile: ' + links.artist);
  return lines;
}

async function sendProblemReport(input) {
  const problem = clipProblem(input && (input.problem || input.text || input.message));
  if (!problem) {
    return { mail_sent: false, error: 'Describe the problem.' };
  }

  const reporter = normalizeEmail(input && input.email);
  const accountLine = reporter || '(no email on the session)';
  const links = problemLinks(input);
  const linkLines = problemLinkLines(links);
  const from = fromAddress();
  const sent = await postResend({
    from,
    to: [CONTACT_EMAIL],
    subject: 'PLAIGROUND problem report',
    text: [
      'A signed-in PLAIGROUND account sent a problem report.',
      '',
      'Account: ' + accountLine,
      '',
    ].concat(linkLines.length ? linkLines.concat(['']) : []).concat([problem]).join('\n'),
    html: [
      '<p>A signed-in PLAIGROUND account sent a problem report.</p>',
      '<p>Account: ' + escapeHtml(accountLine) + '</p>',
    ].concat(linkLines.map(function (line) {
      return '<p>' + escapeHtml(line) + '</p>';
    })).concat([
      '<p>' + escapeHtml(problem).replace(/\n/g, '<br />') + '</p>',
    ]).join(''),
  }, 'Could not send the problem report.');
  if (!sent.mail_sent) return sent;
  return {
    mail_sent: true,
    to: CONTACT_EMAIL,
    email: reporter,
    from,
    release: links.release || '',
    artist: links.artist || '',
  };
}

function clipLine(value, max) {
  return String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 200);
}

function formatPacificTime(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  const when = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(when).replace(/\bPDT\b/, 'PT').replace(/\bPST\b/, 'PT');
}

async function sendQcReleaseAlert(input) {
  const fields = input && typeof input === 'object' ? input : {};
  const releaseId = clipLine(fields.release_id || fields.releaseId, 80);
  if (!releaseId) return { mail_sent: false, error: 'Release id is required.' };
  const lines = [
    'Artist: ' + (clipLine(fields.artist || fields.artist_name, 120) || '(no artist)'),
    'Title: ' + (clipLine(fields.title || fields.song_title, 200) || '(no title)'),
    'Release id: ' + releaseId,
    'Time: ' + formatPacificTime(fields.at || fields.submitted_at),
    'QC: ' + SITE_ORIGIN + '/admin#submissions',
  ];
  if (fields.ai_disclosure) {
    aiDisclosure.emailLines(fields.ai_disclosure).forEach((line) => {
      lines.push(clipLine(line, 4200));
    });
  }
  const from = fromAddress();
  const sent = await postResend({
    from,
    to: [CONTACT_EMAIL],
    subject: 'New release in QC',
    text: lines.join('\n'),
    html: lines.map((line) => '<p>' + escapeHtml(line) + '</p>').join(''),
  }, 'Could not send the QC alert.');
  if (!sent.mail_sent) return sent;
  return { mail_sent: true, to: CONTACT_EMAIL, from, subject: 'New release in QC' };
}

function displayPlan(value) {
  const next = clipLine(value, 120);
  const key = next.toLowerCase();
  if (key === 'basic' || key === 'creator' || key === 'pro' || key === 'free') return 'Free account';
  return next;
}

async function sendOwnerAlert(input) {
  const subject = clipLine(input && input.subject, 120);
  const lines = (Array.isArray(input && input.lines) ? input.lines : [])
    .map((line) => clipLine(line, 2000))
    .filter((line) => line && !/^\s*password\b/i.test(line));
  if (!subject || !lines.length) {
    return { mail_sent: false, error: 'Nothing to send.' };
  }
  const from = fromAddress();
  const text = lines.join('\n');
  const sent = await postResend({
    from,
    to: [CONTACT_EMAIL],
    subject,
    text,
    html: lines.map((line) => '<p>' + escapeHtml(line) + '</p>').join(''),
  }, 'Could not send the owner alert.');
  if (!sent.mail_sent) return sent;
  return { mail_sent: true, to: CONTACT_EMAIL, from, subject };
}

function releasePlanLabel(value) {
  const key = clipLine(value, 40).toLowerCase();
  if (!key || key === 'basic' || key === 'free') return 'Free account';
  if (key === 'creator') return 'Creator';
  if (key === 'pro') return 'Pro';
  return clipLine(value, 120) || '(no plan)';
}

async function sendReleaseAlert(input) {
  const fields = input && typeof input === 'object' ? input : {};
  const releaseId = clipLine(fields.release_id || fields.releaseId, 80);
  if (!releaseId) return { mail_sent: false, error: 'Release id is required.' };
  return sendOwnerAlert({
    subject: 'New release',
    lines: [
      'Artist: ' + (clipLine(fields.artist || fields.artist_name, 120) || '(no artist)'),
      'Title: ' + (clipLine(fields.title || fields.song_title || fields.songTitle, 200) || '(no title)'),
      'Release id: ' + releaseId,
      'Time: ' + formatPacificTime(fields.at || fields.submitted_at),
      'Plan: ' + releasePlanLabel(fields.plan),
    ],
  });
}

function signupSourceLine(attribution) {
  const a = attribution && typeof attribution === 'object' ? attribution : {};
  const parts = [];
  ['utm_source', 'utm_medium', 'utm_campaign', 'ref'].forEach((key) => {
    const value = clipLine(a[key], 80);
    if (value) parts.push(key.replace('utm_', '') + '=' + value);
  });
  ['fbclid', 'ttclid', 'gclid'].forEach((key) => {
    if (clipLine(a[key], 10)) parts.push(key);
  });
  return parts.length ? parts.join(', ') : '(direct or unknown)';
}

function signupTraceLines(trace) {
  if (!trace || typeof trace !== 'object') return [];
  const a = trace.attribution && typeof trace.attribution === 'object' ? trace.attribution : {};
  const place = [trace.city, trace.region, trace.country].map((v) => clipLine(v, 60)).filter(Boolean).join(', ');
  const ms = Number(trace.time_to_submit_ms);
  const flags = Array.isArray(trace.flags) ? trace.flags.map((f) => clipLine(f, 40)).filter(Boolean) : [];
  return [
    'Source: ' + signupSourceLine(a),
    'Heard about: ' + (heardAboutLabel(a) || '(not answered)'),
    'Referrer: ' + (clipLine(a.referrer, 200) || '(none)'),
    'Landing page: ' + (clipLine(a.path, 200) || '(unknown)'),
    'IP: ' + (clipLine(trace.ip, 64) || '(unknown)'),
    'Location: ' + (place || '(unknown)'),
    'Browser: ' + (clipLine(trace.user_agent, 200) || '(unknown)'),
    'Time to submit: ' + (Number.isFinite(ms) && ms > 0 ? (ms / 1000).toFixed(1) + 's' : '(unknown)'),
    'Flags: ' + (flags.length ? flags.join(', ') + ' (welcome and confirm emails held)' : 'none'),
  ];
}

async function sendSignupAlert(input) {
  const fields = input && typeof input === 'object' ? input : {};
  const trace = fields.trace && typeof fields.trace === 'object' ? fields.trace : null;
  const suspected = Boolean(trace && trace.suspected_bot);
  return sendOwnerAlert({
    subject: suspected ? 'New signup (suspected bot)' : 'New signup',
    lines: [
      'Name: ' + (clipLine(fields.name || fields.artist_name || fields.artist, 120) || '(no name)'),
      'Email: ' + (clipLine(fields.email, 200) || '(no email)'),
      'Plan: ' + (displayPlan(fields.plan) || '(no plan)'),
      'Time: ' + formatPacificTime(fields.at || fields.created_at),
    ].concat(signupTraceLines(trace)),
  });
}

function roadmapKitLabel(value) {
  const key = clipLine(value, 40);
  if (key === 'release') return 'Release Kit';
  if (key === 'record') return 'Break Your Record';
  if (key === 'management') return 'Management';
  return '(none)';
}

function roadmapList(value) {
  const names = [];
  (Array.isArray(value) ? value : []).forEach((item) => {
    const text = clipLine(item, 120);
    if (text) names.push(text);
  });
  return names;
}

async function sendRoadmapAlert(input) {
  const fields = input && typeof input === 'object' ? input : {};
  const lines = [
    'Name: ' + (clipLine(fields.name || fields.artist_name, 120) || '(no name)'),
  ];
  if (clipLine(fields.email, 200)) lines.push('Email: ' + clipLine(fields.email, 200));
  lines.push('Plan: ' + (clipLine(fields.plan, 500) || '(no plan)'));
  lines.push('Note: ' + (clipLine(fields.note, 240) || '(none)'));
  const genres = roadmapList(fields.genres);
  lines.push('Genres: ' + (genres.length ? genres.join(', ') : '(none)'));
  lines.push('Kit: ' + roadmapKitLabel(fields.kit));
  const stops = roadmapList(fields.stops);
  if (!stops.length) {
    lines.push('Stops: (none)');
  } else {
    lines.push('Stops:');
    stops.forEach((title, index) => {
      lines.push((index + 1) + '. ' + title);
    });
  }
  lines.push('Time: ' + formatPacificTime(fields.at || fields.created_at));
  return sendOwnerAlert({ subject: 'New roadmap', lines });
}

async function sendApplicationAlert(input) {
  const fields = input && typeof input === 'object' ? input : {};
  return sendOwnerAlert({
    subject: (fields.packageName || fields.package) === 'Get booked' ? 'New Get booked submission' : ((fields.packageName || fields.package) === 'EPK dispute' ? 'New EPK dispute ticket' : 'New application'),
    lines: [
      'Name: ' + (clipLine(fields.name, 120) || '(no name)'),
      'Email: ' + (clipLine(fields.email, 200) || '(no email)'),
      'Phone: ' + (clipLine(fields.phone, 40) || '(no phone)'),
      'Package: ' + (clipLine(fields.packageName || fields.package, 120) || '(no package)'),
      'Help: ' + (clipLine(fields.help, 2000) || '(none)'),
      'Time: ' + formatPacificTime(fields.at || fields.created_at),
    ],
  });
}

function sendConfirmEmail(input) {
  return sendAuthEmail(Object.assign({}, input, { purpose: 'confirm' }));
}

function sendMagicEmail(input) {
  return sendAuthEmail(Object.assign({}, input, { purpose: 'magic' }));
}

function sendResetEmail(input) {
  return sendAuthEmail(Object.assign({}, input, { purpose: 'reset' }));
}

module.exports = {
  AUTH_TOKEN_TTL_SECONDS,
  CONTACT_EMAIL,
  DEFAULT_FROM,
  MAIL_NOT_CONFIGURED,
  PROBLEM_MAX,
  SITE_ORIGIN,
  clipPageId,
  pageLink,
  problemLinks,
  authLink,
  confirmLink,
  confirmSecret,
  fromAddress,
  isMailConfigured,
  normalizeEmail,
  normalizePurpose,
  sendAuthEmail,
  sendConfirmEmail,
  sendMagicEmail,
  displayPlan,
  formatPacificTime,
  sendApplicationAlert,
  sendOwnerAlert,
  sendProblemReport,
  sendQcReleaseAlert,
  sendReleaseAlert,
  sendResetEmail,
  sendRoadmapAlert,
  sendSignupAlert,
  postResend,
  signToken,
  verifyToken,
};
