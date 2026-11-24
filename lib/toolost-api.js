'use strict';

/**
 * Staff-only TooLost sandbox release for one hardcoded song.
 * Base is fixed at https://api-sandbox.toolost.com/v1. No other host is called.
 * Song text is not taken from the request body.
 *
 * POST /api/toolost/sandbox-test-release
 *   step plan (default), create, upload-urls, attach, status, submit, delete-draft
 */

const { readBody, sendJson } = require('./tonegrid');

const SANDBOX_ORIGIN = 'https://api-sandbox.toolost.com';
const SANDBOX_BASE = SANDBOX_ORIGIN + '/v1';
const CONFIRM_PHRASE = 'SANDBOX-SUBMIT';
const TITLE = 'Unicorn in West Hollywood';
const ARTIST = 'Vicki G';
const WRITER = 'Victoria Imtanes';
const LABEL = 'PLAIGROUND';
const AUDIO_FILE = 'unicorn-in-west-hollywood.flac';
const ARTWORK_FILE = 'unicorn-in-west-hollywood.jpg';
const RELEASE_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const FILE_KEY_PATTERN = /^[A-Za-z0-9._~+\/=-]{1,400}$/;

const ALLOWED = [
  ['GET', /^\/me$/],
  ['GET', /^\/lookup\/languages$/],
  ['GET', /^\/lookup\/genres$/],
  ['GET', /^\/lookup\/platforms$/],
  ['GET', /^\/preferences\/artists$/],
  ['POST', /^\/releases$/],
  ['POST', /^\/releases\/[A-Za-z0-9_-]+\/tracks\/upload-url$/],
  ['POST', /^\/releases\/[A-Za-z0-9_-]+\/artwork\/upload-url$/],
  ['PUT', /^\/releases\/[A-Za-z0-9_-]+\/tracks$/],
  ['PATCH', /^\/releases\/[A-Za-z0-9_-]+\/metadata$/],
  ['PATCH', /^\/releases\/[A-Za-z0-9_-]+\/delivery$/],
  ['GET', /^\/releases\/[A-Za-z0-9_-]+$/],
  ['POST', /^\/releases\/[A-Za-z0-9_-]+\/submit$/],
  ['DELETE', /^\/releases\/[A-Za-z0-9_-]+$/],
];

const STEPS = {
  plan: true,
  create: true,
  'upload-urls': true,
  attach: true,
  status: true,
  submit: true,
  'delete-draft': true,
};

const SECRET_KEYS = {
  access_token: true,
  refresh_token: true,
  accesstoken: true,
  refreshtoken: true,
  id_token: true,
  client_secret: true,
  clientsecret: true,
  authorization: true,
  password: true,
  code_verifier: true,
};

let fetchImpl = null;

function fail(message, status, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

function currentFetch() {
  if (typeof fetchImpl === 'function') return fetchImpl;
  if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis);
  return null;
}

function assertSandboxUrl(value) {
  let url;
  try {
    url = value instanceof URL ? value : new URL(String(value));
  } catch {
    throw fail('Refusing a non-sandbox TooLost URL.', 500, 'SANDBOX_HOST');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw fail('Refusing a non-sandbox TooLost URL.', 500, 'SANDBOX_HOST');
  }
  if (url.hostname !== 'api-sandbox.toolost.com') {
    throw fail('Refusing a non-sandbox TooLost URL.', 500, 'SANDBOX_HOST');
  }
  if (url.pathname.indexOf('..') !== -1) {
    throw fail('Refusing a non-sandbox TooLost URL.', 500, 'SANDBOX_HOST');
  }
  if (url.pathname !== '/v1' && url.pathname.indexOf('/v1/') !== 0) {
    throw fail('Refusing a non-sandbox TooLost URL.', 500, 'SANDBOX_HOST');
  }
  return url;
}

function buildSandboxUrl(method, apiPath) {
  const path = String(apiPath || '');
  if (
    path.charAt(0) !== '/'
    || path.indexOf('//') !== -1
    || path.indexOf('?') !== -1
    || path.indexOf('#') !== -1
    || path.indexOf('\\') !== -1
    || path.indexOf('://') !== -1
  ) {
    throw fail('Refusing a non-sandbox TooLost URL.', 500, 'SANDBOX_HOST');
  }
  const url = assertSandboxUrl(SANDBOX_BASE + path);
  const suffix = url.pathname.slice('/v1'.length);
  if (suffix !== path) throw fail('Refusing a non-sandbox TooLost URL.', 500, 'SANDBOX_HOST');
  const verb = String(method || '').toUpperCase();
  const allowed = ALLOWED.some((row) => row[0] === verb && row[1].test(suffix));
  if (!allowed) throw fail('That TooLost endpoint is not on the sandbox allowlist.', 500, 'SANDBOX_ALLOW');
  return url;
}

function logCall(method, apiPath, status) {
  console.info('toolost sandbox', {
    endpoint: String(method) + ' ' + String(apiPath),
    status: Number(status) || 0,
  });
}

function secretList(extra) {
  const out = [];
  function add(value) {
    const text = String(value || '');
    if (text.length < 8 || out.indexOf(text) !== -1) return;
    out.push(text);
  }
  add(process.env.TOOLOST_CLIENT_SECRET);
  (extra || []).forEach(add);
  return out;
}

function redact(value, secrets) {
  const hidden = secrets || [];
  if (typeof value === 'string') {
    let out = value;
    hidden.forEach((secret) => {
      if (secret && out.indexOf(secret) !== -1) out = out.split(secret).join('[redacted]');
    });
    return out;
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, hidden));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  Object.keys(value).forEach((key) => {
    const normal = String(key).toLowerCase().replace(/-/g, '');
    if (SECRET_KEYS[normal] || SECRET_KEYS[String(key).toLowerCase()]) return;
    out[key] = redact(value[key], hidden);
  });
  return out;
}

function unwrap(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }
  return payload;
}

function pad(value) {
  const text = String(value);
  return text.length === 1 ? '0' + text : text;
}

function pacificDate(ms) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function releaseDateValue() {
  const toolost = require('./toolost');
  const today = pacificDate(toolost.nowMillis());
  const parts = today.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw fail('Could not choose a sandbox release date.', 500);
  }
  const stamp = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 15));
  return stamp.getUTCFullYear() + '-' + pad(stamp.getUTCMonth() + 1) + '-' + pad(stamp.getUTCDate());
}

function participant() {
  return { name: ARTIST, role: ['primary'] };
}

function createBody() {
  return {
    type: 'Single',
    title: TITLE,
    participants: [participant()],
    label: LABEL,
  };
}

function audioUploadBody() {
  return {
    kind: 'audio',
    fileName: AUDIO_FILE,
    contentType: 'audio/flac',
  };
}

function artworkUploadBody() {
  return {
    fileName: ARTWORK_FILE,
    contentType: 'image/jpeg',
  };
}

function writers() {
  return [
    { name: WRITER, role: ['lyricist'] },
    { name: WRITER, role: ['instrumentalist'] },
  ];
}

function tracksBody(audioFileKey) {
  return {
    tracks: [{
      title: TITLE,
      language: 'en',
      audioFileKey: audioFileKey,
      artists: [participant()],
      writers: writers(),
      aiAssisted: true,
      lyrics: { explicit: false },
    }],
  };
}

function metadataBody(coverFileKey, releaseDate) {
  return {
    primaryGenre: 'Reggae',
    language: 'en',
    releaseDate: releaseDate,
    licenseType: 'Copyright',
    cYear: 2026,
    cLine: '2026 Vicki G',
    pYear: 2026,
    pLine: '2026 Vicki G',
    label: LABEL,
    coverFileKey: coverFileKey,
    isAiGenerated: true,
  };
}

function platformName(item) {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') return String(item.name || item.code || item.id || '').trim();
  return '';
}

function aiPlatforms(payload) {
  const data = unwrap(payload);
  let platforms = [];
  let excluded = [];
  if (Array.isArray(data)) platforms = data;
  else if (data && typeof data === 'object') {
    if (Array.isArray(data.platforms)) platforms = data.platforms;
    if (Array.isArray(data.aiExcludedPlatforms)) excluded = data.aiExcludedPlatforms;
    else if (Array.isArray(data.ai_excluded_platforms)) excluded = data.ai_excluded_platforms;
  }
  const skip = {};
  excluded.forEach((item) => {
    const name = platformName(item);
    if (name) skip[name] = true;
  });
  const out = [];
  platforms.forEach((item) => {
    const name = platformName(item);
    if (name && !skip[name] && out.indexOf(name) === -1) out.push(name);
  });
  return out;
}

function deliveryBody(platforms) {
  return {
    delivery: {
      platforms: platforms,
      territories: ['Worldwide'],
    },
  };
}

function idempotencyKey(releaseId) {
  return 'plaiground-sandbox-unicorn-' + releaseId;
}

function submitBody(releaseId) {
  return {
    acceptTerms: true,
    confirmRights: true,
    idempotencyKey: idempotencyKey(releaseId),
  };
}

function requireReleaseId(body) {
  const id = body && body.releaseId != null ? String(body.releaseId).trim() : '';
  if (!RELEASE_ID_PATTERN.test(id)) throw fail('A sandbox release id is required.', 400);
  return id;
}

function requireFileKey(body, field) {
  const value = body && body[field] != null ? String(body[field]).trim() : '';
  if (!FILE_KEY_PATTERN.test(value) || value.indexOf('..') !== -1) {
    throw fail('A sandbox file key is required.', 400);
  }
  return value;
}

function upstreamMessage(data, secrets) {
  let message = '';
  if (data && typeof data === 'object') {
    if (typeof data.message === 'string') message = data.message;
    else if (typeof data.error === 'string') message = data.error;
  }
  message = redact(message, secrets);
  return message || 'TooLost sandbox refused the request.';
}

async function sandboxRequest(method, apiPath, options) {
  const opts = options || {};
  const verb = String(method || '').toUpperCase();
  if (opts.writes === false && verb !== 'GET') throw fail('The plan step does not write.', 500);
  const url = buildSandboxUrl(verb, apiPath);
  const headers = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
  const fetcher = currentFetch();
  if (!fetcher) throw fail('The TooLost sandbox did not answer.', 502);
  const timeout = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(15000)
    : undefined;
  let response;
  try {
    response = await fetcher(url.toString(), {
      method: verb,
      headers: headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      redirect: 'manual',
      signal: timeout,
    });
  } catch (err) {
    if (err && (err.code === 'SANDBOX_HOST' || err.code === 'SANDBOX_ALLOW')) throw err;
    logCall(verb, apiPath, 0);
    throw fail('The TooLost sandbox did not answer.', 502);
  }
  const status = Number(response && response.status) || 0;
  logCall(verb, apiPath, status);
  if (status >= 300 && status < 400) {
    const err = fail('TooLost sandbox refused the request.', 502);
    err.upstreamStatus = status;
    err.endpoint = verb + ' ' + apiPath;
    throw err;
  }
  let text = '';
  try {
    text = typeof response.text === 'function' ? await response.text() : '';
  } catch {
    text = '';
  }
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  const ok = (response && response.ok === true) || (status >= 200 && status < 300);
  if (!ok) {
    const err = fail(upstreamMessage(data, opts.secrets), 502);
    err.upstreamStatus = status;
    err.endpoint = verb + ' ' + apiPath;
    throw err;
  }
  return redact(data, opts.secrets || []);
}

async function authorized(force) {
  const toolost = require('./toolost');
  return toolost.ensureLabelAccessToken({ force: Boolean(force) });
}

async function callApi(method, apiPath, body, ctx, attempt) {
  const verb = String(method || '').toUpperCase();
  if (ctx.writes === false && verb !== 'GET') throw fail('The plan step does not write.', 500);
  ctx.calls.push(verb + ' ' + apiPath);
  try {
    return await sandboxRequest(verb, apiPath, {
      token: ctx.token,
      body: body,
      secrets: ctx.secrets,
      writes: ctx.writes,
    });
  } catch (err) {
    if (attempt || verb !== 'GET' || !(err && err.upstreamStatus === 401)) throw err;
    const session = await authorized(true);
    if (!session.ok) throw err;
    ctx.token = session.accessToken;
    ctx.secrets = secretList([session.accessToken, session.refreshToken, session.previousAccessToken].concat(ctx.secrets));
    return callApi(verb, apiPath, body, ctx, true);
  }
}

function publicUpload(payload, secrets) {
  const data = unwrap(payload) || {};
  const source = data.headers && typeof data.headers === 'object' && !Array.isArray(data.headers)
    ? data.headers
    : (data.requiredHeaders && typeof data.requiredHeaders === 'object' ? data.requiredHeaders : {});
  const headers = {};
  Object.keys(source).forEach((key) => {
    if (String(key).toLowerCase() === 'authorization') return;
    if (source[key] == null) return;
    headers[key] = redact(typeof source[key] === 'string' ? source[key] : String(source[key]), secrets);
  });
  const method = String(data.method || '').toUpperCase();
  const out = {
    uploadUrl: redact(String(data.uploadUrl || data.upload_url || ''), secrets),
    fileKey: redact(String(data.fileKey || data.file_key || ''), secrets),
    headers: headers,
  };
  if (method === 'PUT' || method === 'POST') out.method = method;
  if (!out.uploadUrl || !out.fileKey) throw fail('TooLost did not return an upload URL.', 502);
  return out;
}

function releaseIdFrom(payload) {
  const data = unwrap(payload);
  if (!data || typeof data !== 'object' || data.id == null) return '';
  const id = String(data.id).trim();
  return RELEASE_ID_PATTERN.test(id) ? id : '';
}

async function runPlan(ctx) {
  const me = unwrap(await callApi('GET', '/me', undefined, ctx));
  const languages = unwrap(await callApi('GET', '/lookup/languages', undefined, ctx));
  const genres = unwrap(await callApi('GET', '/lookup/genres', undefined, ctx));
  const platformsPayload = await callApi('GET', '/lookup/platforms', undefined, ctx);
  const artists = unwrap(await callApi('GET', '/preferences/artists', undefined, ctx));
  const platforms = aiPlatforms(platformsPayload);
  const date = releaseDateValue();
  const writes = ctx.calls.filter((line) => line.indexOf('GET ') !== 0);
  if (writes.length) throw fail('The plan step does not write.', 500);
  return {
    ok: true,
    step: 'plan',
    dryRun: true,
    base: SANDBOX_BASE,
    calls: ctx.calls.slice(),
    lookups: {
      me: me,
      languages: languages,
      genres: genres,
      platforms: unwrap(platformsPayload),
      artists: artists,
    },
    requests: {
      create: { method: 'POST', path: '/releases', body: createBody() },
      uploadUrls: [
        { method: 'POST', path: '/releases/{id}/tracks/upload-url', body: audioUploadBody() },
        { method: 'POST', path: '/releases/{id}/artwork/upload-url', body: artworkUploadBody() },
      ],
      attach: {
        tracks: { method: 'PUT', path: '/releases/{id}/tracks', body: tracksBody(null) },
        metadata: { method: 'PATCH', path: '/releases/{id}/metadata', body: metadataBody(null, date) },
        delivery: { method: 'PATCH', path: '/releases/{id}/delivery', body: deliveryBody(platforms) },
      },
      submit: {
        method: 'POST',
        path: '/releases/{id}/submit',
        body: {
          acceptTerms: true,
          confirmRights: true,
          idempotencyKey: 'plaiground-sandbox-unicorn-{releaseId}',
        },
      },
    },
  };
}

async function runCreate(ctx) {
  const payload = await callApi('POST', '/releases', createBody(), ctx);
  const releaseId = releaseIdFrom(payload);
  if (!releaseId) throw fail('TooLost did not return a release id.', 502);
  return { ok: true, step: 'create', releaseId: releaseId };
}

async function runUploadUrls(ctx, body) {
  const id = requireReleaseId(body);
  const audio = publicUpload(await callApi('POST', '/releases/' + id + '/tracks/upload-url', audioUploadBody(), ctx), ctx.secrets);
  const artwork = publicUpload(await callApi('POST', '/releases/' + id + '/artwork/upload-url', artworkUploadBody(), ctx), ctx.secrets);
  return { ok: true, step: 'upload-urls', releaseId: id, audio: audio, artwork: artwork };
}

async function runAttach(ctx, body) {
  const id = requireReleaseId(body);
  const audioFileKey = requireFileKey(body, 'audioFileKey');
  const coverFileKey = requireFileKey(body, 'coverFileKey');
  const platformsPayload = await callApi('GET', '/lookup/platforms', undefined, ctx);
  const platforms = aiPlatforms(platformsPayload);
  if (!platforms.length) throw fail('TooLost did not return a platform that accepts AI music.', 502);
  const date = releaseDateValue();
  await callApi('PUT', '/releases/' + id + '/tracks', tracksBody(audioFileKey), ctx);
  await callApi('PATCH', '/releases/' + id + '/metadata', metadataBody(coverFileKey, date), ctx);
  await callApi('PATCH', '/releases/' + id + '/delivery', deliveryBody(platforms), ctx);
  return {
    ok: true,
    step: 'attach',
    releaseId: id,
    releaseDate: date,
    platforms: platforms,
    territories: ['Worldwide'],
  };
}

async function runStatus(ctx, body) {
  const id = requireReleaseId(body);
  const payload = await callApi('GET', '/releases/' + id, undefined, ctx);
  return { ok: true, step: 'status', releaseId: id, release: unwrap(payload) };
}

async function runSubmit(ctx, body) {
  const id = requireReleaseId(body);
  const payload = await callApi('POST', '/releases/' + id + '/submit', submitBody(id), ctx);
  const message = payload && typeof payload.message === 'string' ? payload.message : '';
  return { ok: true, step: 'submit', releaseId: id, message: message };
}

async function runDelete(ctx, body) {
  const id = requireReleaseId(body);
  await callApi('DELETE', '/releases/' + id, undefined, ctx);
  return { ok: true, step: 'delete-draft', releaseId: id, deleted: true };
}

function stepOf(body) {
  if (!body || body.step == null || String(body.step).trim() === '') return 'plan';
  return String(body.step).trim().toLowerCase();
}

async function runStep(step, body) {
  if (step !== 'plan' && step !== 'create') requireReleaseId(body);
  if (step === 'attach') {
    requireFileKey(body, 'audioFileKey');
    requireFileKey(body, 'coverFileKey');
  }
  const session = await authorized(false);
  if (!session.ok) throw fail(session.error || 'No sandbox label token is stored.', session.status || 409);
  const ctx = {
    token: session.accessToken,
    secrets: secretList([session.accessToken, session.refreshToken, session.previousAccessToken]),
    writes: step !== 'plan',
    calls: [],
  };
  if (step === 'plan') return runPlan(ctx);
  if (step === 'create') return runCreate(ctx);
  if (step === 'upload-urls') return runUploadUrls(ctx, body);
  if (step === 'attach') return runAttach(ctx, body);
  if (step === 'status') return runStatus(ctx, body);
  if (step === 'submit') return runSubmit(ctx, body);
  return runDelete(ctx, body);
}

function send(res, status, body) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  sendJson(res, status, body);
}

async function handleSandboxRelease(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    send(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    send(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  const step = stepOf(body);
  if (!STEPS[step]) {
    send(res, 400, { error: 'Unknown step.' });
    return;
  }
  if (step === 'submit' && body.confirm !== CONFIRM_PHRASE) {
    send(res, 400, { error: 'Submit needs confirm set to SANDBOX-SUBMIT.' });
    return;
  }
  try {
    const payload = await runStep(step, body);
    send(res, 200, redact(payload, secretList()));
  } catch (err) {
    if (res.headersSent || res.writableEnded) return;
    const status = err && err.status >= 400 && err.status < 600 ? err.status : 500;
    const message = status === 500
      ? 'The sandbox release did not finish.'
      : redact(String((err && err.message) || 'The sandbox release did not finish.'), secretList());
    const out = { error: message };
    if (err && err.endpoint) out.endpoint = err.endpoint;
    if (err && err.upstreamStatus) out.status = err.upstreamStatus;
    send(res, status, out);
  }
}

function setFetchForTests(fn) {
  fetchImpl = fn;
}

function resetForTests() {
  fetchImpl = null;
}

module.exports = {
  CONFIRM_PHRASE,
  SANDBOX_BASE,
  assertSandboxUrl,
  audioUploadBody,
  artworkUploadBody,
  createBody,
  handleSandboxRelease,
  resetForTests,
  sandboxRequest,
  setFetchForTests,
  submitBody,
};
