'use strict';

/**
 * POST /api/cover-art
 * Generates square cover options with the xAI image API.
 * The key is read from XAI_API_KEY on the server only.
 * Model id defaults to grok-imagine-image-2.0
 * (https://docs.x.ai/developers/models/grok-imagine-image-2.0)
 * and can be overridden with XAI_IMAGE_MODEL.
 *
 * Documented output resolutions are "1k" and "2k" only. This route asks for 2k.
 * That is still under a 3000px distributor master, so the browser scales up on export.
 * Published price: $0.04 per image
 * (https://docs.x.ai/developers/pricing and the model page above).
 *
 * If XAI_API_KEY is missing, this returns seeds for placeholder art drawn in the browser.
 * That art is not AI output.
 *
 * TODO(launch): Add Cloudflare Turnstile and check the token here before calling xAI.
 * The in-memory IP limiter and the per-session image cap live on one serverless
 * instance, reset on cold start, and are not shared across instances or regions.
 * A client can mint a new session id. Do not treat this as abuse-proof.
 * On Vercel, x-forwarded-for is set by the platform.
 */

const core = require('../lib/cover-art');
const song = require('../lib/song-helper');

const limiter = song.createLimiter({
  max: core.RATE_MAX,
  windowMs: core.RATE_WINDOW_MS,
});
const sessions = core.createSessionCap({ max: core.SESSION_IMAGE_MAX });

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

function validationMessage(code) {
  if (code === 'explicit') return core.EXPLICIT_NOTE;
  if (code === 'idea') return 'Tell me the image in a sentence, or use Suggest from my song.';
  if (code === 'color') return 'Pick a palette, or a custom color like #7D3CFF.';
  if (code === 'session') return 'Start the cover again so this session can be counted.';
  return 'Those cover choices did not come through. Try again.';
}

async function bytesFromItem(item) {
  if (item && item.b64_json) return String(item.b64_json);
  var url = item && item.url;
  if (!url || !/^https:\/\//i.test(url)) return '';
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;
  try {
    var response = await fetch(url, { signal: controller ? controller.signal : undefined });
    if (!response.ok) return '';
    var buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString('base64');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function callImages(spec, count) {
  var key = String(process.env.XAI_API_KEY || '').trim();
  if (!key) {
    return {
      preview: true,
      source: 'placeholder',
      notice: core.PLACEHOLDER_NOTICE,
      attribution: '',
      upscale: false,
      images: core.placeholderImages(spec, count),
    };
  }
  var model = String(process.env.XAI_IMAGE_MODEL || core.DEFAULT_IMAGE_MODEL).trim() || core.DEFAULT_IMAGE_MODEL;
  var payload = {
    model: model,
    prompt: spec.prompt,
    n: count,
    aspect_ratio: '1:1',
    resolution: '2k',
    quality: 'low',
    response_format: 'b64_json',
  };
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 50000) : null;
  try {
    var response = await fetch('https://api.x.ai/v1/images/generations', {
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
    var rows = (data && data.data) || [];
    var images = [];
    var size = 0;
    for (var i = 0; i < rows.length && images.length < count; i += 1) {
      var b64 = await bytesFromItem(rows[i]);
      if (!b64) continue;
      if (size + b64.length > 3200000 && images.length) break;
      size += b64.length;
      images.push({ id: String(images.length + 1), b64: b64 });
    }
    if (!images.length) {
      var empty = new Error('xai');
      empty.status = 502;
      throw empty;
    }
    return {
      preview: false,
      source: 'grok',
      model: model,
      notice: '',
      attribution: core.ARTWORK_CREDIT,
      upscale: true,
      upscaleNote: core.UPSCALE_NOTE,
      images: images,
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
    sendJson(res, 400, { ok: false, error: 'Those cover choices did not come through. Try again.' });
    return;
  }
  if (honeypotFilled(body)) {
    sendJson(res, 400, { ok: false, error: 'Could not make that cover.' });
    return;
  }
  var spec;
  try {
    spec = core.normalizeRequest(body);
  } catch (err) {
    sendJson(res, 400, { ok: false, error: validationMessage(err && err.code), note: (err && err.note) || '' });
    return;
  }
  if (!limiter.allow(clientIp(req))) {
    sendJson(res, 429, { ok: false, error: 'That is a lot of covers from this connection. Wait a bit and try again.' });
    return;
  }
  var room = sessions.take(spec.sessionId, spec.count);
  if (!room.allowed) {
    sendJson(res, 429, { ok: false, error: 'This session has used its cover images. Start again to make more.' });
    return;
  }
  try {
    var result = await callImages(spec, room.allowed);
    if (result.images.length < room.allowed) sessions.refund(spec.sessionId, room.allowed - result.images.length);
    sendJson(res, 200, {
      ok: true,
      preview: result.preview,
      source: result.source,
      notice: result.notice,
      attribution: result.attribution,
      note: spec.note,
      upscale: result.upscale,
      upscaleNote: result.upscaleNote || '',
      images: result.images,
    });
  } catch (err) {
    sessions.refund(spec.sessionId, room.allowed);
    var busy = err && err.status === 429;
    sendJson(res, busy ? 429 : 502, {
      ok: false,
      error: busy
        ? 'The artist is busy. Try again in a moment.'
        : 'The covers did not come back. Try again in a moment.',
    });
  }
}

handler.config = { maxDuration: 60 };
handler._limiter = limiter;
handler._sessions = sessions;
module.exports = handler;
module.exports.config = handler.config;
