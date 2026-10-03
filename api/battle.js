'use strict';

/**
 * POST /api/battle
 * Returns only the next AI verse in a human-vs-AI battle.
 * The key is read from XAI_API_KEY on the server only. It is never sent to the browser.
 * Model id defaults to grok-4.20-0309-non-reasoning (docs.x.ai, non-reasoning, low cost)
 * and can be overridden with XAI_MODEL.
 *
 * If XAI_API_KEY is missing, this returns a labeled sample verse. That sample is not
 * AI output and must not be shown as Grok.
 *
 * Cloudflare Turnstile is checked in lib/song-guard.js before a live xAI call.
 * Demo mode skips it. The in-memory limiter below is prototype-grade only. It lives on one serverless
 * instance, resets on cold start, and is not shared across instances or regions.
 * On Vercel, x-forwarded-for is set by the platform. Do not treat this as abuse-proof.
 * Stronger abuse filtering is still needed before this page is linked in public.
 */

const core = require('../lib/battle');
const song = require('../lib/song-helper');
const xai = require('../lib/xai-client');
const guard = require('../lib/song-guard');

const limiter = song.createLimiter({
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
    if (req.body.length > core.BODY_MAX) return Promise.resolve({ __tooBig: true });
    try {
      return Promise.resolve(JSON.parse(req.body || '{}'));
    } catch (err) {
      return Promise.resolve({ __bad: true });
    }
  }
  return new Promise(function (resolve) {
    var chunks = [];
    var size = 0;
    var tooBig = false;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > core.BODY_MAX) {
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
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        resolve({ __bad: true });
      }
    });
    req.on('error', function () { resolve({ __bad: true }); });
  });
}

function clientIp(req) {
  var headers = req.headers || {};
  var fwd = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  if (fwd) return String(fwd).split(',')[0].trim().slice(0, 80) || 'unknown';
  var real = headers['x-real-ip'] || headers['X-Real-Ip'] || '';
  return String(real).trim().slice(0, 80) || 'unknown';
}

function honeypotFilled(body) {
  return Boolean(String((body && body.company_website) || '').trim());
}

function keyFromEnv() {
  return String(process.env.XAI_API_KEY || '').trim();
}

async function requestModel(setup, stronger) {
  var model = String(process.env.XAI_MODEL || core.DEFAULT_MODEL).trim() || core.DEFAULT_MODEL;
  var userContent = core.battlePrompt(setup);
  if (stronger) userContent += '\n' + core.RETRY_INSTRUCTION;
  var payload = {
    model: model,
    temperature: 0.9,
    max_tokens: 900,
    messages: [
      { role: 'system', content: core.SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  };
  if (!/non-reasoning/i.test(model)) payload.reasoning_effort = 'none';
  var response = await xai.postJson('https://api.x.ai/v1/chat/completions', keyFromEnv(), payload, 20000);
  var data = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    var failure = new Error('xai');
    failure.status = response.status;
    throw failure;
  }
  return data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
}

async function callModel(setup) {
  var last = core.lastHumanText(setup);
  var target = core.targetLineCount(last);
  if (!keyFromEnv()) {
    return {
      preview: true,
      source: 'sample',
      notice: core.PREVIEW_NOTICE,
      attribution: '',
      verse: core.buildSampleVerse(setup, last, target, setup.variant),
    };
  }
  var content = await requestModel(setup, false);
  var parsed = core.verseFromModel(content, target, last, setup);
  if (!parsed.ok || parsed.lines.length + 1 < target) {
    try {
      var second = await requestModel(setup, true);
      var again = core.verseFromModel(second, target, last, setup);
      if (again.ok && (!parsed.ok || again.lines.length >= parsed.lines.length)) parsed = again;
    } catch (err) {
      // Keep the first verse when the retry itself fails.
    }
  }
  if (!parsed.ok) {
    var failure = new Error(parsed.code || 'busy');
    failure.code = parsed.code || 'busy';
    throw failure;
  }
  return {
    preview: false,
    source: 'grok',
    notice: '',
    attribution: core.ATTRIBUTION,
    verse: parsed.text,
  };
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: core.MESSAGES.method });
    return;
  }
  var body = await readBody(req);
  if (body && body.__tooBig) {
    sendJson(res, 413, { ok: false, error: core.MESSAGES.big });
    return;
  }
  if (!body || body.__bad || typeof body !== 'object') {
    sendJson(res, 400, { ok: false, error: core.MESSAGES.bad });
    return;
  }
  if (honeypotFilled(body)) {
    sendJson(res, 400, { ok: false, error: core.MESSAGES.honey });
    return;
  }
  var setup;
  try {
    setup = core.normalizeBattle(body);
  } catch (err) {
    var normalizeCode = err && err.code;
    sendJson(res, 400, { ok: false, error: core.MESSAGES[normalizeCode] || core.MESSAGES.bad });
    return;
  }
  var guarded = core.guardSetup(setup);
  if (guarded) {
    sendJson(res, 400, { ok: false, error: core.MESSAGES[guarded] || core.MESSAGES.blocked });
    return;
  }
  var blocked = await guard.enforce(req, clientIp(req), body, { skipFilter: true });
  if (blocked) {
    sendJson(res, blocked.status, blocked.body);
    return;
  }
  if (!limiter.allow(clientIp(req))) {
    sendJson(res, 429, { ok: false, error: core.MESSAGES.rate });
    return;
  }
  try {
    var result = await callModel(setup);
    sendJson(res, 200, {
      ok: true,
      preview: result.preview,
      source: result.source,
      notice: result.notice,
      attribution: result.attribution,
      verse: result.verse,
    });
  } catch (err) {
    if (err && err.code && core.MESSAGES[err.code]) {
      sendJson(res, 400, { ok: false, error: core.MESSAGES[err.code] });
      return;
    }
    var busy = err && err.status === 429;
    sendJson(res, busy ? 429 : 502, {
      ok: false,
      error: busy ? 'The writer is busy. Try again in a moment.' : core.MESSAGES.busy,
    });
  }
}

handler._limiter = limiter;
module.exports = handler;
