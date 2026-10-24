'use strict';

/**
 * Speech to text for a release lyric box.
 * Uses xAI POST /v1/stt with XAI_API_KEY. The key never leaves the server.
 * Model defaults to grok-voice-transcribe-2.0 (override with XAI_STT_MODEL).
 * A credit is spent only after a transcript comes back.
 */

const artistDev = require('./artist-dev');
const guard = require('./song-guard');

const STT_URL = 'https://api.x.ai/v1/stt';
const DEFAULT_MODEL = 'grok-voice-transcribe-2.0';
const AUDIO_MAX = 4000000;
const LYRIC_MAX = 20000;

const LANGUAGES = {
  ar: true, bg: true, bs: true, ca: true, cs: true, da: true, de: true, el: true,
  en: true, es: true, fa: true, fi: true, fil: true, fr: true, hi: true, hr: true,
  hu: true, id: true, it: true, ja: true, ko: true, mk: true, ms: true, nb: true,
  nl: true, pl: true, pt: true, ro: true, ru: true, sk: true, sv: true, th: true,
  tr: true, uk: true, ur: true, vi: true, yue: true, zh: true,
};

function model() {
  return String(process.env.XAI_STT_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function languageCode(value) {
  var code = String(value || '').trim().toLowerCase();
  if (!code) return '';
  var base = code.split('-')[0];
  if (LANGUAGES[base]) return base;
  return '';
}

function linesFromTranscript(data) {
  var words = data && Array.isArray(data.words) ? data.words : [];
  var lines = [];
  var line = [];
  var prevEnd = 0;
  words.forEach(function (word, index) {
    var text = String(word && word.text || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    var start = Number(word.start);
    if (!isFinite(start)) start = prevEnd;
    var gap = index ? start - prevEnd : 0;
    if (line.length && gap > 1.1) {
      lines.push(line.join(' '));
      lines.push('');
      line = [];
    } else if (line.length && (gap > 0.45 || line.length >= 10)) {
      lines.push(line.join(' '));
      line = [];
    }
    line.push(text);
    var end = Number(word.end);
    prevEnd = isFinite(end) ? end : start;
  });
  if (line.length) lines.push(line.join(' '));
  var joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (joined) return joined.slice(0, LYRIC_MAX);
  return String(data && data.text || '').replace(/\r\n/g, '\n').trim().slice(0, LYRIC_MAX);
}

function fail(status, error) {
  return { ok: false, status: status, error: error, charged: false };
}

async function transcribe(bytes, opts) {
  var key = String(process.env.XAI_API_KEY || '').trim();
  if (!key) {
    var missing = new Error('unconfigured');
    missing.code = 'UNCONFIGURED';
    throw missing;
  }
  var options = opts || {};
  var mime = String(options.mime || 'audio/wav').slice(0, 80);
  var filename = String(options.filename || 'lyrics.wav').replace(/[^\w.\-]+/g, '').slice(0, 80) || 'lyrics.wav';
  var form = new FormData();
  form.append('model', model());
  var language = languageCode(options.language);
  if (language) form.append('language', language);
  form.append('file', new Blob([bytes], { type: mime }), filename);
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 45000) : null;
  try {
    var response = await fetch(STT_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: form,
      signal: controller ? controller.signal : undefined,
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var failure = new Error('stt');
      failure.status = response.status;
      throw failure;
    }
    return linesFromTranscript(data);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function transcribeRelease(userId, bytes, opts) {
  var bal = await artistDev.balance(userId);
  if (!bal.credits || bal.credits < 1) {
    return fail(402, 'That takes 1 credit.');
  }
  if (!bytes || !bytes.length) {
    return fail(400, 'Add the song audio first. Nothing was charged.');
  }
  if (bytes.length > AUDIO_MAX) {
    return fail(413, 'That audio is too large to transcribe. Nothing was charged.');
  }
  var lyrics = '';
  try {
    lyrics = await transcribe(bytes, opts);
  } catch (err) {
    if (err && err.code === 'UNCONFIGURED') {
      return fail(503, 'Transcription is not available right now. Paste the lyrics instead. Nothing was charged.');
    }
    var busy = err && err.status === 429;
    return fail(
      busy ? 429 : 502,
      busy
        ? 'The transcriber is busy. Nothing was charged. Try again in a moment.'
        : 'The transcript did not come back. Nothing was charged. Try again, or paste the lyrics.'
    );
  }
  if (!lyrics) {
    return fail(422, 'No lyrics came back from that audio. Nothing was charged. Paste them if you have them.');
  }
  var filtered = guard.contentFilter(lyrics);
  if (!filtered.ok) {
    return fail(400, 'That transcript crosses a line this page will not keep. Nothing was charged.');
  }
  if (opts && typeof opts.stillHere === 'function' && !opts.stillHere()) {
    return fail(502, 'The transcript did not come back. Nothing was charged. Try again, or paste the lyrics.');
  }
  try {
    var paid = await artistDev.spendCredit(userId);
    return {
      ok: true,
      status: 200,
      lyrics: lyrics,
      credits: paid.credits,
      charged: true,
    };
  } catch (err) {
    if (err && err.code === 'CREDITS') return fail(402, 'That takes 1 credit.');
    return fail(502, 'The transcript did not come back. Nothing was charged. Try again, or paste the lyrics.');
  }
}

module.exports = {
  AUDIO_MAX: AUDIO_MAX,
  DEFAULT_MODEL: DEFAULT_MODEL,
  STT_URL: STT_URL,
  languageCode: languageCode,
  linesFromTranscript: linesFromTranscript,
  model: model,
  transcribe: transcribe,
  transcribeRelease: transcribeRelease,
};
