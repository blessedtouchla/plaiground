'use strict';

/**
 * Shared gates for Song Helper, Cover Art, Battle, Scout, and Scoop.
 * Demo mode (no XAI_API_KEY) skips Turnstile.
 * The daily bucket is in-memory on one serverless instance. It resets on a
 * cold start and is not shared across instances. Same limit as the hourly
 * limiter: useful, not abuse-proof.
 */

const auth = require('./auth');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAILY = 40;

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

function actorKey(req, ip) {
  if (String(process.env.SESSION_SECRET || '').trim()) {
    try {
      var token = cookieValue(req, auth.COOKIE);
      var session = token ? auth.verifySession(token) : null;
      if (session && session.userId) return 'user:' + session.userId;
    } catch (err) {
      // Fall through to the IP bucket.
    }
  }
  return 'ip:' + (ip || 'unknown');
}

function createDailyLimiter() {
  var buckets = new Map();
  return {
    allow: function (key, now) {
      var t = typeof now === 'number' ? now : Date.now();
      var max = dailyMax();
      var id = String(key || 'unknown');
      var prev = (buckets.get(id) || []).filter(function (ts) { return t - ts < DAY_MS; });
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

const dailyLimiter = createDailyLimiter();

function contentFilter(text) {
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
  if (VOICE_CLONE_RE.test(blob)) {
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
    var filtered = contentFilter(options.text != null ? options.text : JSON.stringify(body || {}));
    if (!filtered.ok) return { status: 400, body: { ok: false, error: filtered.error } };
  }
  var captcha = await verifyTurnstile(body && body.turnstile_token, ip);
  if (!captcha.ok) return { status: 400, body: { ok: false, error: captcha.error } };
  var actor = actorKey(req, ip);
  if (!dailyLimiter.allow(actor)) {
    return {
      status: 429,
      body: { ok: false, error: 'That is the daily limit for this connection. It resets tomorrow.' },
    };
  }
  return null;
}

module.exports = {
  DAY_MS: DAY_MS,
  DEFAULT_DAILY: DEFAULT_DAILY,
  actorKey: actorKey,
  clientIp: clientIp,
  contentFilter: contentFilter,
  createDailyLimiter: createDailyLimiter,
  dailyLimiter: dailyLimiter,
  dailyMax: dailyMax,
  disabled: disabled,
  enforce: enforce,
  redditConfigured: redditConfigured,
  status: status,
  turnstileRequired: turnstileRequired,
  verifyTurnstile: verifyTurnstile,
  xaiOn: xaiOn,
};
