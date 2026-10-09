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
 * Cloudflare Turnstile is checked in lib/song-guard.js before a live xAI call.
 * Demo mode skips it. The in-memory limiter below is prototype-grade only. It lives on one serverless
 * instance, resets on cold start, and is not shared across instances or regions.
 * On Vercel, x-forwarded-for is set by the platform. Do not treat this as abuse-proof.
 */

const core = require('../lib/song-helper');
const xai = require('../lib/xai-client');
const guard = require('../lib/song-guard');
const modes = require('../lib/song-modes');
const slang = require('../lib/slang');
const reddit = require('../lib/reddit-slang');
const spark = require('../lib/spark');
const sparkFeed = require('../lib/spark-feed');

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

async function requestModel(interview, stronger) {
  var model = String(process.env.XAI_MODEL || core.DEFAULT_MODEL).trim() || core.DEFAULT_MODEL;
  var userContent = core.interviewPrompt(interview);
  if (stronger) userContent += '\n' + core.RETRY_INSTRUCTION;
  var payload = {
    model: model,
    temperature: 0.8,
    max_tokens: 1400,
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

function keyFromEnv() {
  return String(process.env.XAI_API_KEY || '').trim();
}

async function callGrok(interview) {
  if (!keyFromEnv()) {
    return {
      preview: true,
      source: 'sample',
      notice: core.PREVIEW_NOTICE,
      attribution: '',
      draft: core.buildSampleDraft(interview),
    };
  }
  var content = await requestModel(interview, false);
  var draft = core.draftFromModelJson(content, interview);
  if (core.draftNeedsRetry(draft, interview)) {
    try {
      var second = await requestModel(interview, true);
      draft = core.draftFromModelJson(second, interview);
    } catch (err) {
      // The first draft stays. repairLyricShape below cleans a failed retry.
    }
    if (core.draftNeedsRetry(draft, interview)) draft = core.repairLyricShape(draft, interview);
  }
  return {
    preview: false,
    source: 'grok',
    model: String(process.env.XAI_MODEL || core.DEFAULT_MODEL).trim() || core.DEFAULT_MODEL,
    notice: '',
    attribution: core.GROK_ATTRIBUTION,
    draft: draft,
  };
}

function requestAction(req) {
  var query = req && req.query;
  if (query && query.action) return String(query.action);
  var url = String((req && req.url) || '');
  var mark = url.indexOf('?');
  if (mark === -1) return '';
  return new URLSearchParams(url.slice(mark + 1)).get('action') || '';
}

async function sparkPayload() {
  var live = await sparkFeed.load();
  if (live && live.items && live.items.length) {
    return {
      ok: true,
      demo: false,
      notice: '',
      lanes: spark.LANES,
      daily: live.daily,
      items: live.items,
    };
  }
  var pack = spark.pack();
  if (live && live.failed) {
    pack.notice = 'The live feed did not load. These are samples. ' + spark.SAMPLE_LABEL;
  }
  return pack;
}

function modeInput(body) {
  try {
    return { input: modes.normalizeInput(body || {}) };
  } catch (err) {
    if (err && err.code === 'long') {
      return { error: 'That answer is a little long. Shorten it and try again.' };
    }
    return { error: 'Those answers did not come through. Try again.' };
  }
}

async function roleReply(req, res, role, body) {
  var read = modeInput(body);
  if (read.error) {
    sendJson(res, 400, { ok: false, error: read.error });
    return;
  }
  var input = read.input;
  var blocked = await guard.enforce(req, guard.clientIp(req), body, {
    text: [input.place, input.object, input.quote, input.name, input.lines].join('\n'),
  });
  if (blocked) {
    sendJson(res, blocked.status, blocked.body);
    return;
  }
  if (!limiter.allow(guard.clientIp(req))) {
    sendJson(res, 429, { ok: false, error: 'That is a lot of drafts from this connection. Wait a bit and try again.' });
    return;
  }
  if (!xai.configured()) {
    sendJson(res, 200, role === 'scoop' ? modes.scoopSample(input) : modes.scoutSample(input));
    return;
  }
  var system = role === 'scoop'
    ? 'You are Plai at PLAIGROUND. Draft a short bio and a one-sheet from only the facts given. Do not invent awards, follower counts, press quotes, or dollar amounts. Plain sentences.'
    : 'You are Plai at PLAIGROUND. Give short notes: what is working, what to fix, and who the song is for. Do not name real artists. Do not promise a result. Plain sentences.';
  try {
    var chat = await xai.chat({
      url: 'https://api.x.ai/v1/chat/completions',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: modes.userPrompt(input) },
      ],
      max_tokens: 700,
    });
    sendJson(res, 200, {
      ok: true,
      preview: false,
      source: 'grok',
      notice: '',
      role: role,
      text: String(chat.content || '').slice(0, 4000),
    });
  } catch (err) {
    var busy = err && err.status === 429;
    sendJson(res, busy ? 429 : 502, {
      ok: false,
      error: busy ? 'The writer is busy. Try again in a moment.' : 'That note did not come back. Try again in a moment.',
    });
  }
}

async function handleMode(req, res, body) {
  var read = modeInput(body);
  if (read.error) {
    sendJson(res, 400, { ok: false, error: read.error });
    return;
  }
  var input = read.input;
  if (input.mode === 'battle') {
    sendJson(res, 200, { ok: true, redirect: '/battle' });
    return;
  }
  var missing = modes.concreteError(input);
  if (missing) {
    sendJson(res, 400, { ok: false, error: missing });
    return;
  }
  if (input.mode === 'parody') {
    var critique = modes.parodyCritique(input);
    if (!critique.ok) {
      sendJson(res, 400, { ok: false, error: critique.blocks[0], critique: critique });
      return;
    }
  }
  if (input.mode === 'public-domain') {
    var pd = modes.pdCheck(input);
    if (!pd.ok) {
      sendJson(res, 400, { ok: false, error: pd.error });
      return;
    }
  }
  if (input.mode === 'superhero' && modes.heroBlocked(input.name)) {
    sendJson(res, 400, { ok: false, error: 'Use yourself, not a trademarked hero.' });
    return;
  }
  var blocked = await guard.enforce(req, guard.clientIp(req), body, {
    text: JSON.stringify(input),
  });
  if (blocked) {
    sendJson(res, blocked.status, blocked.body);
    return;
  }
  if (!limiter.allow(guard.clientIp(req))) {
    sendJson(res, 429, { ok: false, error: 'That is a lot of drafts from this connection. Wait a bit and try again.' });
    return;
  }
  if (!xai.configured()) {
    var sample = modes.buildSample(input);
    sendJson(res, sample.ok ? 200 : 400, sample);
    return;
  }
  try {
    var chat = await xai.chat({
      url: 'https://api.x.ai/v1/chat/completions',
      messages: [
        { role: 'system', content: modes.systemPrompt(input) },
        { role: 'user', content: modes.userPrompt(input) },
      ],
    });
    var draft = modes.draftFromModel(chat.content, input);
    if (!draft) {
      if (input.mode === 'hook') {
        sendJson(res, 502, {
          ok: false,
          error: 'The hook did not come back. Try again in a moment.',
        });
        return;
      }
      var fallback = modes.buildSample(input);
      sendJson(res, fallback.ok ? 200 : 400, fallback);
      return;
    }
    sendJson(res, 200, {
      ok: true,
      preview: false,
      source: 'grok',
      notice: '',
      attribution: core.GROK_ATTRIBUTION,
      mode: input.mode,
      draft: draft,
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

async function handleAction(req, res, action, givenBody) {
  if (action === 'status') {
    sendJson(res, 200, guard.status());
    return;
  }
  if (action === 'slang') {
    var region = '';
    if (req.query && req.query.region) region = String(req.query.region);
    var url = String(req.url || '');
    var mark = url.indexOf('?');
    if (!region && mark !== -1) region = new URLSearchParams(url.slice(mark + 1)).get('region') || '';
    var rows = slang.suggest(null, region, { profanity: true });
    sendJson(res, 200, {
      ok: true,
      count: rows.length,
      regions: slang.regions(null),
      entries: rows,
    });
    return;
  }
  if (action === 'slang-refresh') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Use POST.' });
      return;
    }
    var refreshed = await reddit.refresh();
    sendJson(res, refreshed.ok ? 200 : (refreshed.configured ? 502 : 200), refreshed);
    return;
  }
  if (action === 'spark') {
    sendJson(res, 200, await sparkPayload());
    return;
  }
  if (action === 'scout' || action === 'scoop') {
    var body = givenBody;
    if (!body) body = await readBody(req);
    if (honeypotFilled(body)) {
      sendJson(res, 400, { ok: false, error: 'Could not draft that.' });
      return;
    }
    await roleReply(req, res, action, body || {});
    return;
  }
  sendJson(res, 404, { ok: false, error: 'That action is not on this page.' });
}

async function handler(req, res) {
  var action = requestAction(req);
  if (action) {
    await handleAction(req, res, action);
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
    sendJson(res, 400, { ok: false, error: 'Those answers did not come through. Try again.' });
    return;
  }
  if (honeypotFilled(body)) {
    sendJson(res, 400, { ok: false, error: 'Could not draft that.' });
    return;
  }
  if (body.action === 'scout' || body.action === 'scoop' || body.action === 'slang-refresh' || body.action === 'status' || body.action === 'spark' || body.action === 'slang') {
    await handleAction(req, res, String(body.action), body);
    return;
  }
  if (body.mode && body.mode !== 'write') {
    await handleMode(req, res, body);
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
  var gap = core.missingAnswers(interview);
  if (gap) {
    sendJson(res, 400, { ok: false, error: gap });
    return;
  }
  if (core.containsParodyAsk(interview)) {
    sendJson(res, 400, { ok: false, error: 'Write an original line. Song Helper does not parody existing songs or write to the tune of a real one.' });
    return;
  }
  if (interview.shape.comedy && core.publicFigureName(interview.who)) {
    sendJson(res, 400, { ok: false, error: 'Roasts stay about people you know. Leave public figures and celebrities out of the song.' });
    return;
  }
  var blocked = await guard.enforce(req, clientIp(req), body, {
    text: [interview.mood, interview.happened, interview.who, interview.why, interview.line, interview.sparkFeel, interview.sparkStory, interview.sparkKeep, interview.revision, interview.followPlace, interview.followObject].join('\n'),
  });
  if (blocked) {
    sendJson(res, blocked.status, blocked.body);
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
