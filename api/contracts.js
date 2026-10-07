'use strict';

/**
 * POST /api/contracts
 * Reads a pasted contract with Grok via the xAI chat completions API.
 * The key stays on the server. Demo mode (no XAI_API_KEY) returns a labeled sample.
 * Turnstile and the daily and hourly limits follow the Song Helper gates.
 */

const core = require('../lib/contracts');
const guard = require('../lib/song-guard');
const songHelper = require('../lib/song-helper');
const xai = require('../lib/xai-client');

const BODY_MAX = 20000;
const TEXT_MAX = 12000;
const hourly = songHelper.createLimiter({
  max: songHelper.RATE_MAX,
  windowMs: songHelper.RATE_WINDOW_MS
});
const daily = guard.createDailyLimiter();

const SYSTEM = [
  'You explain music contracts in plain English for an independent artist.',
  'You are not a lawyer. Do not say this is legal advice.',
  'Return JSON only, with keys redFlags, fair, ask, and redlines.',
  'Each redFlags, fair, and ask item is {"title","plain"}.',
  'Each redlines item is {"title","instead"} and instead is wording they can send back.',
  'Look for ownership grabs, perpetual or very long terms, high percentages, no exit, cross-collateralization, 360 clauses, and AI or voice or stem use without a named consent.',
  'Do not invent prices, fees, or dollar amounts.',
  'Do not use an em dash.',
  'Keep each plain and instead under two sentences.'
].join(' ');

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
    try { return Promise.resolve(JSON.parse(req.body || '{}')); }
    catch (err) { return Promise.resolve({ __bad: true }); }
  }
  return new Promise(function (resolve) {
    var chunks = [];
    var size = 0;
    var tooBig = false;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > BODY_MAX) {
        tooBig = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () {
      if (tooBig) {
        resolve({ __tooBig: true });
        return;
      }
      var raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try { resolve(JSON.parse(raw)); }
      catch (err) { resolve({ __bad: true }); }
    });
    req.on('error', function () { resolve({ __bad: true }); });
  });
}

function requestAction(req) {
  var url = String((req && req.url) || '');
  var q = url.indexOf('?');
  if (q === -1) return '';
  try {
    return new URLSearchParams(url.slice(q + 1)).get('action') || '';
  } catch (err) {
    return '';
  }
}

async function gate(req, body, text) {
  if (guard.disabled()) {
    return { status: 503, body: { ok: false, disabled: true, error: 'Contracts is turned off right now.' } };
  }
  var filtered = guard.contentFilter(text, { allowVoice: true });
  if (!filtered.ok) return { status: 400, body: { ok: false, error: filtered.error } };
  var ip = guard.clientIp(req);
  var captcha = await guard.verifyTurnstile(body && body.turnstile_token, ip);
  if (!captcha.ok) return { status: 400, body: { ok: false, error: captcha.error } };
  if (!daily.allow(guard.actorKey(req, ip))) {
    return { status: 429, body: { ok: false, error: 'That is the daily limit for this connection. It resets tomorrow.' } };
  }
  if (!hourly.allow(ip)) {
    return { status: 429, body: { ok: false, error: 'That is a lot of reads from this connection. Wait a bit and try again.' } };
  }
  return null;
}

function sample(text, action) {
  var read = core.analyze(text);
  read.demo = true;
  read.preview = true;
  read.source = 'sample';
  read.action = action;
  read.notice = 'Sample read. The live reader is not connected. This is not from Grok.';
  read.pay = core.PAY_LINE;
  return read;
}

async function liveRead(text, action) {
  var chat = await xai.chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: 'Action: ' + action + '\nContract:\n' + text }
    ],
    temperature: 0.2,
    max_tokens: 1200,
    timeoutMs: 20000
  });
  var parsed = core.fromModel(chat.content);
  if (!parsed) return null;
  parsed.preview = false;
  parsed.source = 'grok';
  parsed.action = action;
  parsed.notice = '';
  parsed.attribution = 'Read with Grok by xAI';
  parsed.pay = core.PAY_LINE;
  return parsed;
}

async function handler(req, res) {
  var action = requestAction(req);
  if (req.method === 'GET' && action === 'status') {
    var state = guard.status();
    sendJson(res, 200, {
      ok: true,
      demo: !guard.xaiOn(),
      disabled: state.disabled,
      turnstile: state.turnstile,
      turnstileSiteKey: state.turnstileSiteKey,
      pay: core.PAY_LINE
    });
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Use POST.' });
    return;
  }
  var body = await readBody(req);
  if (body && body.__tooBig) {
    sendJson(res, 413, { ok: false, error: 'That is more than this page can take. Shorten it and try again.' });
    return;
  }
  if (!body || body.__bad || typeof body !== 'object') {
    sendJson(res, 400, { ok: false, error: 'That did not come through. Try again.' });
    return;
  }
  if (String(body.company_website || '').trim()) {
    sendJson(res, 400, { ok: false, error: 'Could not read that.' });
    return;
  }
  var mode = body.action === 'fix' ? 'fix' : 'review';
  var text = core.tidy(body.text).slice(0, TEXT_MAX);
  if (!text) {
    sendJson(res, 400, { ok: false, error: 'Paste the contract, or upload a text file.' });
    return;
  }
  var blocked = await gate(req, body, text);
  if (blocked) {
    sendJson(res, blocked.status, blocked.body);
    return;
  }
  if (!xai.configured()) {
    sendJson(res, 200, sample(text, mode));
    return;
  }
  try {
    var read = await liveRead(text, mode);
    if (!read) {
      var fallback = sample(text, mode);
      fallback.notice = 'The live read did not come back clean. This is a sample read, not from Grok.';
      sendJson(res, 200, fallback);
      return;
    }
    sendJson(res, 200, read);
  } catch (err) {
    var busy = err && err.status === 429;
    sendJson(res, busy ? 429 : 502, {
      ok: false,
      error: busy ? 'The reader is busy. Try again in a moment.' : 'That read did not come back. Try again in a moment.'
    });
  }
}

handler._hourly = hourly;
handler._daily = daily;
module.exports = handler;
