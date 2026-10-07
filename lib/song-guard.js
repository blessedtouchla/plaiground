'use strict';

/**
 * Shared gates for Song Helper, Cover Art, Battle, contracts, Scout, and Scoop.
 * Demo mode (no XAI_API_KEY) skips Turnstile.
 * Each generate checks Cloudflare Turnstile when it is configured, filters the
 * prompt, then counts an hourly hit and a daily hit for the IP and, when a
 * session is present, for that user too. Anonymous visitors use a lower daily
 * cap. Buckets are in-memory on one serverless instance. They reset on a cold
 * start and are not shared across instances. Useful, not abuse-proof.
 */

const auth = require('./auth');

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_DAILY = 40;
const DEFAULT_ANON_DAILY = 8;
const DEFAULT_HOURLY = 10;

const SLURS = [
  'nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'faggots', 'fag', 'tranny',
  'retard', 'retarded', 'kike', 'spic', 'chink', 'wetback', 'beaner',
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SLUR_RE = new RegExp('\\b(' + SLURS.map(escapeRegExp).join('|') + ')\\b', 'i');
const THREAT_RE = /\b(kill you|murder you|shoot you|stab you|rape you|i('|’)ll kill|i will kill|going to kill|gonna kill|kill yourself|kys|shoot up|i know where you live|doxx|swat you)\b/i;
const MINOR_SEX_RE = /\b(child|children|underage|preteen|pre-teen|toddler|minor|minors|kid|kids|teen|teens|infant)\b[\s\S]{0,48}\b(sex|sexual|nude|naked|porn|rape|molest|xxx)\b|\b(sex|sexual|nude|naked|porn|rape|molest|xxx)\b[\s\S]{0,48}\b(child|children|underage|preteen|pre-teen|toddler|minor|minors|kid|kids|teen|teens|infant)\b/i;
const VOICE_CLONE_RE = /\b(clone(?:d)?(?:\s+\w+){0,4}\s+voice|voice clone|deepfake|sound exactly like|exact voice of|ai voice of|in (?:his|her|their) (?:real )?voice|use the original recording|original master recording|stems from the original)\b/i;

function disabled() {
  var flag = String(process.env.SONG_HELPER_DISABLED || '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'on' || flag === 'yes';
}

function dailyMax() {
  var raw = parseInt(process.env.SONG_HELPER_DAILY_LIMIT || '', 10);
  if (!isFinite(raw) || raw < 1) return DEFAULT_DAILY;
  return Math.min(500, Math.floor(raw));
}

function anonDailyMax() {
  var raw = parseInt(process.env.SONG_HELPER_ANON_DAILY_LIMIT || '', 10);
  var cap = (!isFinite(raw) || raw < 1) ? DEFAULT_ANON_DAILY : Math.floor(raw);
  return Math.min(dailyMax(), Math.max(1, cap));
}

function hourlyMax() {
  var raw = parseInt(process.env.SONG_HELPER_HOURLY_LIMIT || '', 10);
  if (!isFinite(raw) || raw < 1) return DEFAULT_HOURLY;
  return Math.min(100, Math.floor(raw));
}

function xaiOn() {
  return Boolean(String(process.env.XAI_API_KEY || '').trim());
}

function turnstileSiteKey() {
  return String(process.env.TURNSTILE_SITE_KEY || '').trim();
}

function turnstileSecret() {
  return String(process.env.TURNSTILE_SECRET_KEY || '').trim();
}

function turnstileRequired() {
  if (!xaiOn()) return false;
  return Boolean(turnstileSiteKey() && turnstileSecret());
}

function redditConfigured() {
  return Boolean(String(process.env.REDDIT_CLIENT_ID || '').trim() && String(process.env.REDDIT_CLIENT_SECRET || '').trim());
}

function status() {
  return {
    ok: true,
    demo: !xaiOn(),
    disabled: disabled(),
    turnstile: turnstileRequired(),
    turnstileSiteKey: turnstileRequired() ? turnstileSiteKey() : '',
    dailyLimit: dailyMax(),
    anonDailyLimit: anonDailyMax(),
    hourlyLimit: hourlyMax(),
    reddit: redditConfigured(),
    sparkLive: Boolean(String(process.env.SPARK_FEEDS || '').trim()),
  };
}

function clientIp(req) {
  var headers = (req && req.headers) || {};
  var fwd = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  if (fwd) return String(fwd).split(',')[0].trim().slice(0, 80) || 'unknown';
  var real = headers['x-real-ip'] || headers['X-Real-Ip'] || '';
  return String(real).trim().slice(0, 80) || 'unknown';
}

function cookieValue(req, name) {
  var headers = (req && req.headers) || {};
  var header = headers.cookie || headers.Cookie || '';
  var parts = String(header).split(';');
  for (var i = 0; i < parts.length; i += 1) {
    var part = parts[i];
    var idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    var value = part.slice(idx + 1).trim();
    try { return decodeURIComponent(value); } catch (err) { return value; }
  }
  return '';
}

function sessionUserId(req) {
  if (!String(process.env.SESSION_SECRET || '').trim()) return '';
  try {
    var token = cookieValue(req, auth.COOKIE);
    var session = token ? auth.verifySession(token) : null;
    if (session && session.userId) return String(session.userId);
  } catch (err) {
    return '';
  }
  return '';
}

function actorKey(req, ip) {
  var userId = sessionUserId(req);
  if (userId) return 'user:' + userId;
  return 'ip:' + (ip || 'unknown');
}

function createWindowLimiter(windowMs, maxFor) {
  var buckets = new Map();
  return {
    allow: function (key, now, maxOverride) {
      var t = typeof now === 'number' ? now : Date.now();
      var max = typeof maxOverride === 'number' ? maxOverride : maxFor();
      var id = String(key || 'unknown');
      var prev = (buckets.get(id) || []).filter(function (ts) { return t - ts < windowMs; });
      if (prev.length >= max) {
        buckets.set(id, prev);
        return false;
      }
      prev.push(t);
      buckets.set(id, prev);
      return true;
    },
    reset: function () { buckets.clear(); },
  };
}

function createDailyLimiter() {
  return createWindowLimiter(DAY_MS, dailyMax);
}

const dailyLimiter = createDailyLimiter();
const hourlyLimiter = createWindowLimiter(HOUR_MS, hourlyMax);

function limitBody(status, error) {
  return { status: status, body: { ok: false, error: error } };
}

function charge(req, ip, now) {
  var t = typeof now === 'number' ? now : Date.now();
  var userId = sessionUserId(req);
  var ipKey = 'ip:' + (ip || 'unknown');
  if (!hourlyLimiter.allow(ipKey, t)) {
    return limitBody(429, 'That is a lot from this connection. Wait a bit and try again.');
  }
  if (userId && !hourlyLimiter.allow('user:' + userId, t)) {
    return limitBody(429, 'That is a lot from this account. Wait a bit and try again.');
  }
  var ipDaily = userId ? dailyMax() : Math.min(dailyMax(), anonDailyMax());
  if (!dailyLimiter.allow(ipKey, t, ipDaily)) {
    return limitBody(429, userId
      ? 'That is the daily limit for this connection. It resets tomorrow.'
      : 'That is the daily limit for a visitor. Sign in for a higher cap. It resets tomorrow.');
  }
  if (userId && !dailyLimiter.allow('user:' + userId, t, dailyMax())) {
    return limitBody(429, 'That is the daily limit for this account. It resets tomorrow.');
  }
  return null;
}

function contentFilter(text, opts) {
  var blob = String(text || '');
  if (!blob.trim()) return { ok: true };
  if (SLUR_RE.test(blob)) {
    return { ok: false, error: 'That crosses a line. No slurs on this page.' };
  }
  if (MINOR_SEX_RE.test(blob)) {
    return { ok: false, error: 'That crosses a line. This page does not write sexual content about minors.' };
  }
  if (THREAT_RE.test(blob)) {
    return { ok: false, error: 'That crosses a line. No threats on this page.' };
  }
  if (!(opts && opts.allowVoice) && VOICE_CLONE_RE.test(blob)) {
    return { ok: false, error: 'Cloned voices and original recordings stay off this page.' };
  }
  return { ok: true };
}

async function verifyTurnstile(token, ip) {
  if (!turnstileRequired()) return { ok: true, skipped: xaiOn() ? 'not-configured' : 'demo' };
  var value = String(token || '').trim();
  if (!value) return { ok: false, error: 'Confirm you are a person, then try again.' };
  var body = new URLSearchParams();
  body.set('secret', turnstileSecret());
  body.set('response', value);
  if (ip && ip !== 'unknown') body.set('remoteip', ip);
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
  try {
    var response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller ? controller.signal : undefined,
    });
    var data = await response.json().catch(function () { return {}; });
    if (data && data.success) return { ok: true };
    return { ok: false, error: 'The person check did not go through. Try again.' };
  } catch (err) {
    return { ok: false, error: 'The person check did not go through. Try again.' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function enforce(req, ip, body, opts) {
  var options = opts || {};
  if (disabled()) {
    return {
      status: 503,
      body: { ok: false, disabled: true, error: 'Song Helper is turned off right now.' },
    };
  }
  if (!options.skipFilter) {
    var filtered = contentFilter(options.text != null ? options.text : JSON.stringify(body || {}), {
      allowVoice: !!options.allowVoice
    });
    if (!filtered.ok) return { status: 400, body: { ok: false, error: filtered.error } };
  }
  var captcha = await verifyTurnstile(body && body.turnstile_token, ip);
  if (!captcha.ok) return { status: 400, body: { ok: false, error: captcha.error } };
  return charge(req, ip);
}

module.exports = {
  DAY_MS: DAY_MS,
  DEFAULT_ANON_DAILY: DEFAULT_ANON_DAILY,
  DEFAULT_DAILY: DEFAULT_DAILY,
  DEFAULT_HOURLY: DEFAULT_HOURLY,
  HOUR_MS: HOUR_MS,
  actorKey: actorKey,
  anonDailyMax: anonDailyMax,
  charge: charge,
  clientIp: clientIp,
  contentFilter: contentFilter,
  createDailyLimiter: createDailyLimiter,
  dailyLimiter: dailyLimiter,
  dailyMax: dailyMax,
  disabled: disabled,
  enforce: enforce,
  hourlyLimiter: hourlyLimiter,
  hourlyMax: hourlyMax,
  redditConfigured: redditConfigured,
  sessionUserId: sessionUserId,
  status: status,
  turnstileRequired: turnstileRequired,
  verifyTurnstile: verifyTurnstile,
  xaiOn: xaiOn,
};
