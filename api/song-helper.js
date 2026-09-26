'use strict';

/**
 * POST /api/song-helper
 * Drafts lyrics with Grok via the xAI chat completions API.
 * The key is read from XAI_API_KEY on the server only. It is never sent to the browser.
 * Model id defaults to grok-4.20-0309-non-reasoning (docs.x.ai, non-reasoning, low cost)
 * and can be overridden with XAI_MODEL.
 *
 * If XAI_API_KEY is missing, this returns a labeled sample draft. That sample is not
 * AI output and must not be shown as Grok.
 *
 * TODO(launch): Add Cloudflare Turnstile and check the token here before calling xAI.
 * The in-memory limiter below is prototype-grade only. It lives on one serverless
 * instance, resets on cold start, and is not shared across instances or regions.
 * On Vercel, x-forwarded-for is set by the platform. Do not treat this as abuse-proof.
 */

const core = require('../lib/song-helper');

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

async function callGrok(interview) {
  var key = String(process.env.XAI_API_KEY || '').trim();
  if (!key) {
    return {
      preview: true,
      source: 'sample',
      notice: core.PREVIEW_NOTICE,
      attribution: '',
      draft: core.buildSampleDraft(interview),
    };
  }
  var model = String(process.env.XAI_MODEL || core.DEFAULT_MODEL).trim() || core.DEFAULT_MODEL;
  var payload = {
    model: model,
    temperature: 0.8,
    max_tokens: 1400,
    messages: [
      { role: 'system', content: core.SYSTEM_PROMPT },
      { role: 'user', content: core.interviewPrompt(interview) },
    ],
  };
  if (!/non-reasoning/i.test(model)) payload.reasoning_effort = 'none';
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;
  try {
    var response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined,
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var failure = new Error('xai');
      failure.status = response.status;
      throw failure;
    }
    var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return {
      preview: false,
      source: 'grok',
      model: model,
      notice: '',
      attribution: core.GROK_ATTRIBUTION,
      draft: core.draftFromModelJson(content, interview),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function handler(req, res) {
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
    sendJson(res, 400, { ok: false, error: 'Those answers did not come through. Try again.' });
    return;
  }
  if (honeypotFilled(body)) {
    sendJson(res, 400, { ok: false, error: 'Could not draft that.' });
    return;
  }
  var interview;
  try {
    interview = core.normalizeInterview(body);
  } catch (err) {
    if (err && err.code === 'long') {
      sendJson(res, 400, { ok: false, error: 'That answer is a little long. Shorten it and try again.' });
      return;
    }
    sendJson(res, 400, { ok: false, error: 'Those answers did not come through. Try again.' });
    return;
  }
  if (!limiter.allow(clientIp(req))) {
    sendJson(res, 429, { ok: false, error: 'That is a lot of drafts from this connection. Wait a bit and try again.' });
    return;
  }
  try {
    var result = await callGrok(interview);
    sendJson(res, 200, {
      ok: true,
      preview: result.preview,
      source: result.source,
      notice: result.notice,
      attribution: result.attribution,
      draft: result.draft,
    });
  } catch (err) {
    var busy = err && err.status === 429;
    sendJson(res, busy ? 429 : 502, {
      ok: false,
      error: busy
        ? 'The writer is busy. Try again in a moment.'
        : 'The draft did not come back. Try again in a moment.',
    });
  }
}

handler._limiter = limiter;
module.exports = handler;
