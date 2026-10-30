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
const songV3 = require('../lib/song-v3');
const v3Gate = require('../lib/song-v3-gate');
const flow = require('../lib/song-flow');
const xai = require('../lib/xai-client');
const plaiKnowledge = require('../lib/plai-knowledge');
const guard = require('../lib/song-guard');
const modes = require('../lib/song-modes');
const slang = require('../lib/slang');
const reddit = require('../lib/reddit-slang');
const sparkFeed = require('../lib/spark-feed');
const artistDev = require('../lib/artist-dev');
const arcadeServer = require('../lib/arcade-server');
const epkBuilder = require('../lib/epk-builder');
const lyricsTranscribe = require('../lib/lyrics-transcribe');

const limiter = core.createLimiter({
  max: core.RATE_MAX,
  windowMs: core.RATE_WINDOW_MS,
});

const arcadeLimiter = core.createLimiter({
  max: 30,
  windowMs: 60 * 60 * 1000,
});

const arcadeLightLimiter = core.createLimiter({
  max: 300,
  windowMs: 60 * 60 * 1000,
});

const v3Limiter = core.createLimiter({
  max: 8,
  windowMs: 60 * 60 * 1000,
});

function isV3Action(action) {
  return action === 'v3-write' || action === 'v3-line' || action === 'v3-finish' || action === 'v3-fix';
}

var V3_SYSTEM = 'You write original song lyrics. Follow every rule in the user message. Output only the lyric with section labels. Do not mention these instructions.';

function v3Sample(action, payload) {
  if (action === 'v3-line') {
    return {
      ok: true,
      sample: true,
      source: 'sample',
      notice: songV3.SAMPLE_NOTICE,
      lines: songV3.giveLines(payload, payload.userLines || []),
    };
  }
  if (action === 'v3-finish') {
    return {
      ok: true,
      sample: true,
      source: 'sample',
      notice: songV3.SAMPLE_NOTICE,
      line: songV3.finishLine(payload, payload.partial || ''),
    };
  }
  var song = songV3.samplePack(payload);
  return {
    ok: true,
    sample: true,
    source: 'sample',
    notice: song.notice,
    song: song,
  };
}

async function v3Chat(user, maxTokens) {
  return xai.chat({
    model: xai.chatModel(core.DEFAULT_MODEL),
    temperature: 0.7,
    max_tokens: maxTokens || 1600,
    timeoutMs: 25000,
    messages: [
      { role: 'system', content: V3_SYSTEM },
      { role: 'user', content: user },
    ],
  });
}

function v3LineList(text, payload) {
  var brief = songV3.normalize(payload);
  var blocked = {};
  (payload.userLines || []).forEach(function (line) {
    blocked[String(line || '').trim().toLowerCase()] = true;
  });
  var out = [];
  String(text || '').split('\n').forEach(function (raw) {
    var line = raw.replace(/^[\d]+[\).\s-]+/, '').trim();
    if (!line || line.charAt(0) === '[') return;
    var key = line.toLowerCase();
    if (blocked[key] || out.indexOf(line) !== -1) return;
    if (songV3.lineDirty(line, brief)) return;
    out.push(line);
  });
  return out.slice(0, 3);
}

async function v3ModelSong(payload) {
  var first = await v3Chat(songV3.writerInstructions(payload));
  var audit = songV3.auditDraft(first.content || '', payload);
  var retryText = null;
  if (!audit.ok) {
    var second = await v3Chat(songV3.writerInstructions(payload, audit.failures));
    retryText = second.content || '';
  }
  var settled = songV3.settleDraft(first.content || '', retryText, payload);
  if (!String(settled.song.text || '').trim()) {
    var empty = new Error('empty');
    throw empty;
  }
  return settled.song;
}

async function v3ModelLines(payload) {
  var blocked = (payload.userLines || []).filter(Boolean).join('\n');
  var ask = songV3.writerInstructions(payload) + '\nWrite exactly 3 new lyric lines. One line each. Do not repeat these lines:\n' + blocked;
  var first = await v3Chat(ask, 400);
  var lines = v3LineList(first.content, payload);
  if (lines.length < 3) {
    var retry = await v3Chat(ask + '\nThe last lines were unusable. Write 3 different lines.', 400);
    var next = v3LineList(retry.content, payload);
    if (next.length) lines = next;
  }
  if (lines.length < 1) throw new Error('empty');
  return lines.slice(0, 3);
}

async function v3ModelFinish(payload) {
  var partial = String(payload.partial || '').trim();
  var ask = songV3.writerInstructions(payload) + '\nFinish this one line. Keep the opening words. Return one line only:\n' + partial;
  var first = await v3Chat(ask, 200);
  var line = v3LineList(first.content, payload)[0] || '';
  if (!line || (partial && line.toLowerCase().indexOf(partial.toLowerCase()) !== 0)) {
    var retry = await v3Chat(ask + '\nStart with the same opening words.', 200);
    line = v3LineList(retry.content, payload)[0] || line;
  }
  if (!line) throw new Error('empty');
  return line;
}

async function handleV3(req, res, action, body) {
  // The page flag stays off so /song-helper does not switch. This preview still
  // needs the write actions, with the same rate limit and honeypot.
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Use POST.' });
    return;
  }
  var payload = body || {};
  // Hidden link only: without the private key these actions do not exist.
  if (!v3Gate.keyOk(payload.k || v3Gate.queryKey(req))) {
    sendJson(res, 404, { ok: false, error: 'Not found.' });
    return;
  }
  payload = Object.assign({}, payload);
  delete payload.k;
  if (honeypotFilled(payload)) {
    sendJson(res, 400, { ok: false, error: 'Could not draft that.' });
    return;
  }
  if (!v3Limiter.allow(clientIp(req))) {
    sendJson(res, 429, { ok: false, error: 'That is a lot of drafts from this connection. Wait a bit and try again.' });
    return;
  }
  if (action === 'v3-fix') {
    sendJson(res, 200, { ok: true, fix: songV3.tryFix(payload.line || '', payload.kind || 'shorter', payload) });
    return;
  }
  if (!keyFromEnv()) {
    sendJson(res, 200, v3Sample(action, payload));
    return;
  }
  try {
    if (action === 'v3-line') {
      var lines = await v3ModelLines(payload);
      sendJson(res, 200, { ok: true, sample: false, source: 'model', notice: '', lines: lines });
      return;
    }
    if (action === 'v3-finish') {
      var finished = await v3ModelFinish(payload);
      sendJson(res, 200, { ok: true, sample: false, source: 'model', notice: '', line: finished });
      return;
    }
    var song = await v3ModelSong(payload);
    if (song.guardError) {
      sendJson(res, 422, { ok: false, error: song.guardError });
      return;
    }
    sendJson(res, 200, { ok: true, sample: false, source: 'model', notice: '', song: song });
  } catch (err) {
    sendJson(res, 200, v3Sample(action, payload));
  }
}

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
  try {
    return sparkFeed.publicPack(await sparkFeed.load());
  } catch (err) {
    return sparkFeed.publicPack(null);
  }
}

function modeInput(body) {
  try {
    return { input: modes.normalizeInput(body || {}) };
  } catch (err) {
    if (err && err.code === 'long') {
      return { error: err.message || 'That answer is a little long. Shorten it and try again.' };
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
    var system = modes.systemPrompt(input);
    if (input.mode === 'funny') {
      system += ' Funny mode shows humor through the writer\'s own words and specific details. Never say the song is funny, and never say a part is supposed to make them laugh, cry, or dance.';
    }
    var chat = await xai.chat({
      url: 'https://api.x.ai/v1/chat/completions',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: modes.userPrompt(input) },
      ],
    });
    var draft = modes.stripIntentDraft(modes.draftFromModel(chat.content, input), input);
    if (!draft || !draft.sections || !draft.sections.length) {
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
    var parodyNote = null;
    if (input.mode === 'parody') {
      parodyNote = modes.parodyCritique(input);
      draft.notes = draft.notes || [];
      [modes.FAIR_USE_NOTE, modes.RELEASE_NOTE].forEach(function (note) {
        if (draft.notes.indexOf(note) === -1) draft.notes.push(note);
      });
    }
    sendJson(res, 200, {
      ok: true,
      preview: false,
      source: 'grok',
      notice: '',
      attribution: core.GROK_ATTRIBUTION,
      mode: input.mode,
      critique: parodyNote,
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

async function handleAsk(req, res, body) {
  var text = String((body && body.text) || '');
  if (text.length > core.STORY_MAX) {
    sendJson(res, 400, {
      ok: false,
      error: 'That is a little long. The limit is ' + core.STORY_MAX + ' characters. Shorten it and try again.',
    });
    return;
  }
  var trimmed = text.trim();
  var others = String((body && body.others) || '');
  var sectionLabel = String((body && body.section) || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (text.length > core.STORY_MAX || others.length > core.STORY_MAX || text.length + others.length > core.STORY_MAX) {
    sendJson(res, 400, {
      ok: false,
      error: 'That is a little long. The limit is ' + core.STORY_MAX + ' characters. Shorten it and try again.',
    });
    return;
  }
  if (!trimmed && !others.trim()) {
    sendJson(res, 200, {
      ok: true,
      question: '',
      angle: '',
      source: 'sample',
      notice: 'Write a little in this part first. Then I can ask about what you wrote.',
    });
    return;
  }
  var lastAngle = String((body && body.lastAngle) || '').replace(/[^a-z]/g, '').slice(0, 16);
  var asked = Array.isArray(body && body.asked) ? body.asked.map(function (item) {
    return String(item || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  }).filter(Boolean).slice(0, 12) : [];
  var context = [trimmed, others.trim()].filter(Boolean).join('\n');
  var plan = core.askPlan(context, { lastAngle: lastAngle, asked: asked });
  var planned = sectionLabel ? core.sectionQuestion(sectionLabel, plan.angle, context) : plan.question;
  var blocked = await guard.enforce(req, guard.clientIp(req), body, { text: trimmed });
  if (blocked) {
    sendJson(res, blocked.status, blocked.body);
    return;
  }
  if (!xai.configured()) {
    sendJson(res, 200, {
      ok: true,
      question: planned,
      angle: plan.angle,
      source: 'sample',
      notice: 'This question comes from what you wrote. It is a backup question, not a new draft.',
    });
    return;
  }
  try {
    var chat = await xai.chat({
      url: 'https://api.x.ai/v1/chat/completions',
      messages: [
        { role: 'system', content: core.askSystem(plan) + (sectionLabel ? ' This question is only for the ' + sectionLabel + '.' : '') },
        { role: 'user', content: core.askUser(context, plan, asked) },
      ],
      max_tokens: 80,
    });
    var question = core.tidyAsk(chat && chat.content, context, {
      lastAngle: lastAngle,
      asked: asked,
      angle: plan.angle,
    });
    if (sectionLabel && core.askAngle(question) !== plan.angle) question = planned;
    sendJson(res, 200, {
      ok: true,
      question: question,
      angle: core.askAngle(question) || plan.angle,
      source: 'grok',
      notice: '',
    });
  } catch (err) {
    sendJson(res, 200, {
      ok: true,
      question: planned,
      angle: plan.angle,
      source: 'sample',
      notice: 'This question comes from what you wrote. The writer did not answer, so this is a backup question.',
    });
  }
}

function cleanSuggestLines(content, label, sectionText, otherText) {
  var lines = String(content || '').split('\n').map(function (line) {
    return line.replace(/^[\s\-\d\.\)\]]+/, '').replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
  var out = [];
  lines.forEach(function (line) {
    if (out.length >= 3) return;
    if (line.length > 180) return;
    if (core.sensoryTrivia(line, sectionText + ' ' + otherText)) return;
    if (/\b(supposed to|meant to)\b/i.test(line)) return;
    if (/suno/i.test(line)) return;
    out.push(line.charAt(line.length - 1) === '?' ? line.slice(0, -1).trim() : line);
  });
  if (!out.length) return core.suggestFallback(label, sectionText, otherText);
  return out;
}

async function handleSuggest(req, res, body) {
  var text = String((body && body.text) || '');
  var others = String((body && body.others) || '');
  var sectionLabel = String((body && body.section) || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (text.length > core.STORY_MAX || others.length > core.STORY_MAX || text.length + others.length > core.STORY_MAX) {
    sendJson(res, 400, {
      ok: false,
      error: 'That is a little long. The limit is ' + core.STORY_MAX + ' characters. Shorten it and try again.',
    });
    return;
  }
  var trimmed = text.trim();
  if (!trimmed && !others.trim()) {
    sendJson(res, 200, {
      ok: true,
      options: [],
      source: 'sample',
      notice: 'Write a little in this part first. Then I can offer a line.',
    });
    return;
  }
  var blocked = await guard.enforce(req, guard.clientIp(req), body, { text: [trimmed, others].join('\n') });
  if (blocked) {
    sendJson(res, blocked.status, blocked.body);
    return;
  }
  var fallback = core.suggestFallback(sectionLabel, trimmed, others);
  if (!xai.configured()) {
    sendJson(res, 200, {
      ok: true,
      options: fallback,
      source: 'sample',
      notice: 'These are backup lines from what you wrote. Nothing is added until you tap Use this.',
    });
    return;
  }
  try {
    var chat = await xai.chat({
      url: 'https://api.x.ai/v1/chat/completions',
      messages: [
        { role: 'system', content: core.suggestSystem(sectionLabel) },
        { role: 'user', content: 'Part: ' + (sectionLabel || 'this part') + '\nThis part:\n' + trimmed + '\nOther parts:\n' + others.trim() },
      ],
      max_tokens: 180,
    });
    sendJson(res, 200, {
      ok: true,
      options: cleanSuggestLines(chat && chat.content, sectionLabel, trimmed, others),
      source: 'grok',
      notice: '',
    });
  } catch (err) {
    sendJson(res, 200, {
      ok: true,
      options: fallback,
      source: 'sample',
      notice: 'These are backup lines from what you wrote. Nothing is added until you tap Use this.',
    });
  }
}

function cleanRewrite(content, fallback, sourceText) {
  var text = String(content || '').replace(/\u2014/g, ', ').replace(/\s+\n/g, '\n').trim();
  text = text.replace(/suno/ig, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!text || text.length > core.STORY_MAX) return fallback;
  if (core.sensoryTrivia(text, sourceText)) return fallback;
  if (/\b(supposed to|meant to)\b/i.test(text)) return fallback;
  return text;
}

async function handleRewrite(req, res, body, kind) {
  var text = String((body && body.text) || '');
  var others = String((body && body.others) || '');
  var sectionLabel = String((body && body.section) || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (text.length > core.STORY_MAX || others.length > core.STORY_MAX || text.length + others.length > core.STORY_MAX) {
    sendJson(res, 400, {
      ok: false,
      error: 'That is a little long. The limit is ' + core.STORY_MAX + ' characters. Shorten it and try again.',
    });
    return;
  }
  var trimmed = text.trim();
  if (!trimmed) {
    sendJson(res, 200, {
      ok: true,
      text: '',
      source: 'sample',
      notice: 'Write a little in this part first.',
    });
    return;
  }
  var blocked = await guard.enforce(req, guard.clientIp(req), body, { text: [trimmed, others].join('\n') });
  if (blocked) {
    sendJson(res, blocked.status, blocked.body);
    return;
  }
  var fallback = kind === 'shorten'
    ? core.shortenFallback(trimmed)
    : kind === 'rhymify'
      ? core.rhymifyFallback(sectionLabel, trimmed)
      : core.extendFallback(sectionLabel, trimmed);
  var notice = 'Nothing changes until you tap Accept. Keep mine leaves your words.';
  if (!xai.configured()) {
    sendJson(res, 200, { ok: true, text: fallback, source: 'sample', notice: notice });
    return;
  }
  try {
    var chat = await xai.chat({
      url: 'https://api.x.ai/v1/chat/completions',
      messages: [
        { role: 'system', content: core.rewriteSystem(kind, sectionLabel) },
        { role: 'user', content: 'Part: ' + (sectionLabel || 'this part') + '\nThis part:\n' + trimmed + '\nOther parts:\n' + others.trim() },
      ],
      max_tokens: 220,
    });
    sendJson(res, 200, {
      ok: true,
      text: cleanRewrite(chat && chat.content, fallback, trimmed + '\n' + others),
      source: 'grok',
      notice: notice,
    });
  } catch (err) {
    sendJson(res, 200, { ok: true, text: fallback, source: 'sample', notice: notice });
  }
}

function kindFromLabel(label) {
  var name = String(label || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (name === 'hook' || name === 'chorus') return { kind: 'hook', label: 'Hook' };
  if (name === 'bridge') return { kind: 'bridge', label: 'Bridge' };
  if (name === 'outro') return { kind: 'outro', label: 'Outro' };
  if (name === 'pre-chorus' || name === 'prechorus') return { kind: 'prechorus', label: 'Pre-chorus' };
  var verse = name.match(/^verse\s+(\d+)$/);
  if (verse) return { kind: 'verse', label: 'Verse ' + verse[1] };
  return null;
}

async function handleFormat(req, res, body) {
  var text = String((body && body.text) || '');
  var blocks = Array.isArray(body && body.blocks) ? body.blocks.map(function (row) {
    return { text: String(row && row.text || '') };
  }).filter(function (row) { return row.text.trim(); }) : [];
  if (text.length > core.STORY_MAX) {
    sendJson(res, 400, {
      ok: false,
      error: 'That is a little long. The limit is ' + core.STORY_MAX + ' characters. Shorten it and try again.',
    });
    return;
  }
  var source = blocks.length ? blocks.map(function (row) { return row.text; }).join('\n\n') : text;
  if (!source.trim()) {
    sendJson(res, 200, { ok: true, sections: [], notes: ['Paste lyrics first.'], source: 'sample' });
    return;
  }
  var proposal = blocks.length ? flow.formatSong(source) : flow.formatSong(text);
  if (blocks.length && proposal.sections.length !== blocks.length) proposal = flow.formatSong(blocks.map(function (row) { return row.text; }).join('\n\n'));
  var notice = 'These labels come from the shape of what you pasted. Your words are unchanged.';
  function sendStatic(why) {
    sendJson(res, 200, {
      ok: true,
      sections: proposal.sections,
      notes: proposal.notes,
      source: 'sample',
      notice: why || notice,
    });
  }
  if (!flow.sameWords(source, proposal.sections) && !flow.sameWords(text, proposal.sections)) {
    sendStatic('Your words stayed as you pasted them.');
    return;
  }
  if (!xai.configured()) {
    sendStatic();
    return;
  }
  try {
    var listed = proposal.sections.map(function (row, index) {
      return (index + 1) + '. ' + String(row.text || '').replace(/\n/g, ' / ');
    }).join('\n');
    var chat = await xai.chat({
      url: 'https://api.x.ai/v1/chat/completions',
      messages: [
        { role: 'system', content: 'Label each lyric block. Allowed labels: Verse 1, Verse 2, Verse 3, Hook, Pre-chorus, Bridge, Outro. Use Hook when a line repeats. Use Pre-chorus only for a short block before the hook. Use Bridge for a turn. One label per line, in order. Do not rewrite the words. Do not name a music generator.' },
        { role: 'user', content: listed },
      ],
      max_tokens: 160,
    });
    var labels = String(chat && chat.content || '').replace(/\u2014/g, ' ').split('\n').map(function (line) {
      return line.replace(/^\s*\d+[\.\)]\s*/, '').trim();
    }).filter(Boolean);
    if (labels.length !== proposal.sections.length) {
      sendStatic();
      return;
    }
    var polished = [];
    for (var i = 0; i < labels.length; i += 1) {
      var named = kindFromLabel(labels[i]);
      if (!named) {
        sendStatic();
        return;
      }
      polished.push({
        id: proposal.sections[i].id,
        kind: named.kind,
        label: named.label,
        text: proposal.sections[i].text,
        suggest: proposal.sections[i].suggest || '',
      });
    }
    if (!flow.sameWords(proposal.sections.map(function (row) { return row.text; }).join('\n'), polished)) {
      sendStatic();
      return;
    }
    sendJson(res, 200, {
      ok: true,
      sections: polished,
      notes: proposal.notes,
      source: 'grok',
      notice: 'Labels only. Your words were not rewritten.',
    });
  } catch (err) {
    sendStatic();
  }
}

function publicSound(traits) {
  if (!traits) return null;
  return {
    tempo: traits.tempo || '',
    instruments: traits.instruments || [],
    vocal: traits.vocal || '',
    era: traits.era || '',
    mix: traits.mix || '',
    genre: traits.genre || '',
    verseLength: traits.verseLength || 'medium',
    hookPlacement: traits.hookPlacement || 'after verse',
    bridge: traits.bridge !== false,
    structure: traits.structure || '',
    prompt: traits.prompt || '',
    matched: !!traits.matched,
    via: traits.via || 'plain',
    label: 'Influence, not copying.',
    note: traits.note || 'Influence, not copying.',
  };
}

async function handleSounds(req, res, body) {
  var text = String((body && body.text) || '').replace(/\s+/g, ' ').trim();
  if (text.length > 200) {
    sendJson(res, 400, { ok: false, error: 'That name is too long. Use a short artist or song.' });
    return;
  }
  text = text.slice(0, 80);
  if (!text) {
    sendJson(res, 200, {
      ok: true,
      traits: null,
      source: 'sample',
      notice: 'Type an artist or a song.',
    });
    return;
  }
  var fallback = publicSound(flow.soundsLike(text));
  var notice = fallback.note || 'Influence, not copying.';
  if (!xai.configured()) {
    sendJson(res, 200, { ok: true, traits: fallback, source: 'sample', notice: notice });
    return;
  }
  var blocked = await guard.enforce(req, guard.clientIp(req), body || {}, { text: text });
  if (blocked) {
    sendJson(res, blocked.status, blocked.body);
    return;
  }
  try {
    var chat = await xai.chat({
      url: 'https://api.x.ai/v1/chat/completions',
      temperature: 0.2,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content: 'Turn a name into musical style traits. Reply with JSON only. Keys: tempo, instruments, vocal, era, mix, genre, verseLength, hookPlacement, bridge. tempo, vocal, era, mix, and genre are short phrases under 8 words. instruments is an array of up to 3 instruments. verseLength is short, medium, or long. hookPlacement is early, after verse, or late. bridge is true or false. Describe tempo feel, instruments, vocal character, era, and mix. Add structure only as verse length, hook placement, and whether a bridge fits. Do not include the artist name or the song title. Do not quote lyrics. Do not write lyrics. Do not name a music generator.',
        },
        { role: 'user', content: 'Describe the sound only. Do not repeat this name:\n' + text },
      ],
    });
    var parsed = flow.parseSoundTraits(chat && chat.content, text);
    if (!parsed) {
      sendJson(res, 200, { ok: true, traits: fallback, source: 'sample', notice: notice });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      traits: publicSound(parsed),
      source: 'grok',
      notice: 'Influence, not copying. These are sound traits, not lyrics.',
    });
  } catch (err) {
    sendJson(res, 200, { ok: true, traits: fallback, source: 'sample', notice: notice });
  }
}

async function handleDev(req, res, action, body) {
  var userId = guard.sessionUserId(req);
  if (!userId) {
    if (action === 'dev-status') {
      sendJson(res, 200, { ok: true, signedIn: false });
      return;
    }
    sendJson(res, 401, { ok: false, error: 'Sign in to use artist tools.' });
    return;
  }
  try {
    var result;
    if (action === 'dev-status') result = await artistDev.status(userId);
    else if (action === 'vault-list') result = { ok: true, items: await artistDev.listVault(userId) };
    else if (action === 'vault-save') result = await artistDev.saveVault(userId, body);
    else if (action === 'vault-delete') result = await artistDev.deleteVault(userId, body && body.id);
    else if (action === 'read-me') result = await artistDev.readMe(userId);
    else if (action === 'persona-lock') result = await artistDev.personaLock(userId);
    else if (action === 'voice-check') result = await artistDev.voiceCheck(userId, body);
    else if (action === 'voice-rewrite') result = await artistDev.voiceRewrite(userId, body);
    else if (action === 'song-breakdown') result = await artistDev.songBreakdown(userId, body);
    else if (action === 'song-rewrite') result = await artistDev.songRewrite(userId, body);
    else {
      sendJson(res, 404, { ok: false, error: 'That action is not on this page.' });
      return;
    }
    sendJson(res, result.status || 200, result);
  } catch (err) {
    var status = err && err.code === 'CREDITS' ? 402 : (err && err.code === 'VALIDATION' ? 400 : 500);
    sendJson(res, status, { ok: false, error: err && err.message ? err.message : 'That did not save.' });
  }
}

// The new Song Helper page. Served only with the private key; everyone else
// goes to the live Song Helper. Never cached, never indexed.
function handleV3Page(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: 'Use GET.' });
    return;
  }
  if (!v3Gate.keyOk(v3Gate.queryKey(req))) {
    res.statusCode = 302;
    res.setHeader('Location', '/song-helper');
    res.end('');
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(req.method === 'HEAD' ? '' : v3Gate.PAGE_HTML);
}

// Public Song Helper Arcade (serves /song-helper). No login and no credit lock.
// Safety filters run inside lib/arcade-server. Per-IP hourly caps keep the AI bill sane.
const ARCADE_AI = { 'arcade-handle': 1, 'arcade-write': 1, 'arcade-battle': 1, 'arcade-flip': 1, 'arcade-research': 1, 'arcade-news-ideas': 1, 'arcade-ideas': 1, 'arcade-section': 1 };
const arcadeUsage = { since: new Date().toISOString(), counts: {} };
function logArcade(action, kind, ip) {
  arcadeUsage.counts[action] = (arcadeUsage.counts[action] || 0) + 1;
  try {
    console.log(JSON.stringify({ evt: 'arcade_usage', action: action, kind: kind, ipHash: require('crypto').createHash('sha256').update(String(ip || '')).digest('hex').slice(0, 12), total: arcadeUsage.counts[action] }));
  } catch (err) {}
}

async function handleArcade(req, res, action, givenBody) {
  if (action === 'arcade-page') {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(req.method === 'HEAD' ? '' : arcadeServer.PAGE_HTML);
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Use POST.' });
    return;
  }
  var body = givenBody || await readBody(req) || {};
  if (body.__tooBig || body.__bad) {
    sendJson(res, 400, { ok: false, error: 'Could not read that.' });
    return;
  }
  if (honeypotFilled(body)) {
    sendJson(res, 400, { ok: false, error: 'Could not draft that.' });
    return;
  }
  var ip = clientIp(req);
  var heavy = Boolean(ARCADE_AI[action]) || (action === 'arcade-fix' && !body.line);
  if (action !== 'arcade-status') {
    var limiter = heavy ? arcadeLimiter : arcadeLightLimiter;
    if (!limiter.allow(ip)) {
      logArcade(action, 'capped', ip);
      sendJson(res, 429, { ok: false, error: heavy ? 'You hit the hourly limit of 30 songs. Take a breather and come back soon.' : 'Slow down a little. Try again in a few minutes.' });
      return;
    }
  }
  var payload = Object.assign({}, body);
  delete payload.k;
  try {
    var out = await arcadeServer.ACTIONS[action](payload);
    logArcade(action, heavy ? 'ai' : 'light', ip);
    if (action === 'arcade-status' && out && out.body) out.body.usage = arcadeUsage;
    sendJson(res, out.status, out.body);
  } catch (err) {
    sendJson(res, 502, { ok: false, error: 'The writer is busy. Try again in a moment.' });
  }
}

const epkLimiter = core.createLimiter({ max: 20, windowMs: 60 * 60 * 1000 });
const plaiAskLimiter = core.createLimiter({ max: 30, windowMs: 60 * 60 * 1000 });

const avatarLimiter = core.createLimiter({ max: 6, windowMs: 60 * 60 * 1000 });

// EPK builder full-body avatar (9:16). Credits are charged on the page; failed or blank refunds automatically.
async function handleEpkAvatar(req, res, givenBody) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Use POST.' });
    return;
  }
  var body = givenBody || await readBody(req) || {};
  if (body.__tooBig || body.__bad) {
    sendJson(res, 400, { ok: false, refund: true, error: 'That photo is too big. Try a smaller one. Your credits come back.' });
    return;
  }
  if (honeypotFilled(body)) {
    sendJson(res, 400, { ok: false, error: 'Could not build that.' });
    return;
  }
  if (!avatarLimiter.allow(clientIp(req))) {
    sendJson(res, 429, { ok: false, refund: true, error: 'You hit the hourly avatar limit. Your credits come back. Come back soon.' });
    return;
  }
  try {
    var out = await epkBuilder.avatar(body, { key: keyFromEnv(), postJson: xai.postJson, model: xai.imageModel() });
    sendJson(res, 200, out);
  } catch (err) {
    sendJson(res, 200, { ok: true, source: 'svg', refund: true, notice: 'The avatar maker did not answer, so you got the drawn avatar. Your credits come back automatically.' });
  }
}

// Ask Plai: floating chat on every page (plai-ask.js). Knowledge lives in lib/plai-knowledge.js.
async function handlePlaiAsk(req, res, givenBody) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Use POST.' });
    return;
  }
  var body = givenBody || await readBody(req) || {};
  if (body.__tooBig || body.__bad) {
    sendJson(res, 400, { ok: false, error: 'Could not read that.' });
    return;
  }
  if (honeypotFilled(body)) {
    sendJson(res, 400, { ok: false, error: 'Could not answer that.' });
    return;
  }
  if (!plaiAskLimiter.allow(clientIp(req))) {
    sendJson(res, 429, { ok: false, error: 'Plai needs a breather. You hit the hourly limit. Come back soon.' });
    return;
  }
  try {
    var out = await plaiKnowledge.answer(body, keyFromEnv() ? xai.chat : null);
    sendJson(res, out.status || 200, out);
  } catch (err) {
    sendJson(res, 502, { ok: false, error: 'Plai did not answer. Try again in a moment.' });
  }
}

// EPK builder tester (/epk-builder). Writes bios only from the artist's own answers.
async function handleEpk(req, res, givenBody) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Use POST.' });
    return;
  }
  var body = givenBody || await readBody(req) || {};
  if (body.__tooBig || body.__bad) {
    sendJson(res, 400, { ok: false, error: 'Could not read that.' });
    return;
  }
  if (honeypotFilled(body)) {
    sendJson(res, 400, { ok: false, error: 'Could not build that.' });
    return;
  }
  if (!epkLimiter.allow(clientIp(req))) {
    sendJson(res, 429, { ok: false, error: 'You hit the hourly EPK limit. Come back soon.' });
    return;
  }
  try {
    var out = await epkBuilder.write(body, keyFromEnv() ? xai.chat : null);
    sendJson(res, 200, out);
  } catch (err) {
    sendJson(res, 502, { ok: false, refund: true, error: 'The bio writer did not answer. Your credits come back automatically. Try again.' });
  }
}

function queryValue(req, name) {
  if (req && req.query && req.query[name]) return String(req.query[name]);
  var url = String((req && req.url) || '');
  var mark = url.indexOf('?');
  if (mark === -1) return '';
  return new URLSearchParams(url.slice(mark + 1)).get(name) || '';
}

function readAudio(req, max) {
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > max) return Promise.resolve({ __tooBig: true });
    return Promise.resolve(req.body);
  }
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && req.body.audio) {
    var raw = String(req.body.audio).replace(/^data:[^,]*,/, '');
    var decoded = Buffer.from(raw, 'base64');
    if (!decoded.length) return Promise.resolve({ __bad: true });
    if (decoded.length > max) return Promise.resolve({ __tooBig: true });
    return Promise.resolve(decoded);
  }
  return new Promise(function (resolve) {
    var chunks = [];
    var size = 0;
    var tooBig = false;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > max) {
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
      resolve(Buffer.concat(chunks));
    });
    req.on('error', function () { resolve({ __bad: true }); });
  });
}

function audioMime(req) {
  var headers = (req && req.headers) || {};
  var type = String(headers['content-type'] || headers['Content-Type'] || '').split(';')[0].trim().toLowerCase();
  if (type.indexOf('audio/') === 0) return type;
  return 'audio/wav';
}

function watchClient(req, res) {
  var gone = false;
  if (res && typeof res.on === 'function') {
    res.on('close', function () {
      if (!res.writableEnded) gone = true;
    });
  }
  return function () {
    if (gone) return true;
    if (res && res.closed && !res.writableEnded) return true;
    return Boolean(req && req.aborted);
  };
}

async function handleTranscribe(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Use POST.' });
    return;
  }
  var userId = guard.sessionUserId(req);
  if (!userId) {
    sendJson(res, 401, { ok: false, charged: false, error: 'Sign in to use a credit.' });
    return;
  }
  var clientLeft = watchClient(req, res);
  var audio = await readAudio(req, lyricsTranscribe.AUDIO_MAX);
  if (audio && audio.__tooBig) {
    sendJson(res, 413, { ok: false, charged: false, error: 'That audio is too large to transcribe. Nothing was charged.' });
    return;
  }
  if (!audio || audio.__bad) {
    sendJson(res, 400, { ok: false, charged: false, error: 'Add the song audio first. Nothing was charged.' });
    return;
  }
  var mime = audioMime(req);
  if (req.body && req.body.mime) mime = String(req.body.mime).slice(0, 80);
  var result = await lyricsTranscribe.transcribeRelease(userId, audio, {
    mime: mime,
    filename: mime.indexOf('mpeg') !== -1 ? 'lyrics.mp3' : 'lyrics.wav',
    language: queryValue(req, 'language') || (req.body && req.body.language) || '',
    stillHere: function () { return !clientLeft(); },
  });
  sendJson(res, result.status || 200, result);
}

async function handleAction(req, res, action, givenBody) {
  if (action === 'transcribe') {
    await handleTranscribe(req, res);
    return;
  }
  if (action === 'epk-avatar') {
    await handleEpkAvatar(req, res, givenBody);
    return;
  }
  if (action === 'plai-ask') {
    await handlePlaiAsk(req, res, givenBody);
    return;
  }
  if (action === 'epk-write') {
    await handleEpk(req, res, givenBody);
    return;
  }
  if (action === 'v3-page') {
    handleV3Page(req, res);
    return;
  }
  if (action === 'arcade-page' || Object.prototype.hasOwnProperty.call(arcadeServer.ACTIONS, action)) {
    await handleArcade(req, res, action, givenBody);
    return;
  }
  if (isV3Action(action)) {
    var v3Body = givenBody;
    if (!v3Body && req.method === 'POST') v3Body = await readBody(req);
    await handleV3(req, res, action, v3Body || {});
    return;
  }
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
  if (action === 'ask') {
    var askBody = givenBody;
    if (!askBody) askBody = await readBody(req);
    await handleAsk(req, res, askBody || {});
    return;
  }
  if (action === 'suggest') {
    var suggestBody = givenBody;
    if (!suggestBody) suggestBody = await readBody(req);
    await handleSuggest(req, res, suggestBody || {});
    return;
  }
  if (action === 'format') {
    var formatBody = givenBody;
    if (!formatBody) formatBody = await readBody(req);
    await handleFormat(req, res, formatBody || {});
    return;
  }
  if (action === 'sounds') {
    var soundsBody = givenBody;
    if (!soundsBody) soundsBody = await readBody(req);
    await handleSounds(req, res, soundsBody || {});
    return;
  }
  if (action === 'extend' || action === 'shorten' || action === 'rhymify') {
    var rewriteBody = givenBody;
    if (!rewriteBody) rewriteBody = await readBody(req);
    await handleRewrite(req, res, rewriteBody || {}, action);
    return;
  }
  if (action === 'dev-status' || action === 'vault-list' || action === 'vault-save' || action === 'vault-delete' || action === 'read-me' || action === 'persona-lock' || action === 'voice-check' || action === 'voice-rewrite' || action === 'song-breakdown' || action === 'song-rewrite') {
    var devBody = givenBody;
    if (!devBody && req.method === 'POST') devBody = await readBody(req);
    await handleDev(req, res, action, devBody || {});
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
  if (isV3Action(body.action)) {
    await handleAction(req, res, String(body.action), body);
    return;
  }
  if (honeypotFilled(body)) {
    sendJson(res, 400, { ok: false, error: 'Could not draft that.' });
    return;
  }
  if (body.action === 'ask' || body.action === 'suggest' || body.action === 'extend' || body.action === 'shorten' || body.action === 'rhymify' || body.action === 'format' || body.action === 'sounds' || body.action === 'scout' || body.action === 'scoop' || body.action === 'slang-refresh' || body.action === 'status' || body.action === 'spark' || body.action === 'slang' || body.action === 'dev-status' || body.action === 'vault-list' || body.action === 'vault-save' || body.action === 'vault-delete' || body.action === 'read-me' || body.action === 'persona-lock' || body.action === 'voice-check' || body.action === 'voice-rewrite' || body.action === 'song-breakdown' || body.action === 'song-rewrite') {
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
      sendJson(res, 400, { ok: false, error: err.message || 'That answer is a little long. Shorten it and try again.' });
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
    text: [interview.mood, interview.happened, interview.who, interview.why, interview.line, interview.idea, interview.sparkAngle, interview.sparkFeel, interview.sparkStory, interview.sparkKeep, interview.revision, interview.followPlace, interview.followObject].join('\n'),
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
      draft: modes.stripIntentDraft(result.draft, interview),
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

handler.config = {
  api: { bodyParser: false },
  maxDuration: 60,
};
handler._limiter = limiter;
module.exports = handler;
module.exports.config = handler.config;
