'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const accounts = require('./accounts');
const authApi = require('../api/auth');
const meApi = require('../api/me');
const toolost = require('./toolost');
const api = require('./toolost-api');

const ACCESS = 'access-token-VALUE-test';
const REFRESH = 'refresh-token-VALUE-test';
const NEXT = 'rotated-access-token-VALUE';
const SECRET = 'toolost-test-client-secret';
const CLIENT = 'toolost-test-client-id';
const FIXED_NOW = Date.UTC(2026, 10, 24, 8, 24, 0);

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(chunk) {
      this.body = chunk == null ? '' : String(chunk);
    },
  };
}

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function jsonBody(res) {
  return JSON.parse(res.body);
}

async function withEnv(env, fn) {
  const keys = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'TOOLOST_CLIENT_ID',
    'TOOLOST_CLIENT_SECRET',
    'TOOLOST_REDIRECT_URI',
  ];
  const prev = {};
  keys.forEach((key) => {
    prev[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  });
  accounts.resetStore();
  toolost.resetForTests();
  api.resetForTests();
  if (env.memory) accounts.useMemoryStore();
  if (env.tokenStore) toolost.useMemoryStoreForTests();
  try {
    await fn();
  } finally {
    accounts.resetStore();
    toolost.resetForTests();
    api.resetForTests();
    keys.forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  }
}

function sandboxEnv(extra) {
  return Object.assign({
    memory: true,
    tokenStore: true,
    DATABASE_URL: 'postgres://toolost-test',
    SESSION_SECRET: 'toolost-test-session-secret',
    TOOLOST_CLIENT_ID: CLIENT,
    TOOLOST_CLIENT_SECRET: SECRET,
  }, extra || {});
}

async function signupUser(email) {
  const res = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/signup',
    headers: {},
    body: { email, password: 'password1', artist: 'Ada Night', plan: 'basic' },
  }, res);
  assert.strictEqual(res.statusCode, 200, res.body);
  await accounts.confirmEmail(email);
  const loginRes = mockRes();
  await authApi({
    method: 'POST',
    url: '/api/auth/login',
    headers: {},
    body: { email, password: 'password1' },
  }, loginRes);
  assert.strictEqual(loginRes.statusCode, 200, loginRes.body);
  return String(loginRes.headers['Set-Cookie'] || '').split(';')[0];
}

async function saveToken(extra) {
  const memory = toolost.useMemoryStoreForTests();
  await memory.save(Object.assign({
    env: 'sandbox',
    access_token: ACCESS,
    refresh_token: REFRESH,
    token_type: 'Bearer',
    scope: 'write:releases',
    expires_at: new Date(FIXED_NOW + 60 * 60 * 1000).toISOString(),
    updated_at: new Date(FIXED_NOW).toISOString(),
  }, extra || {}));
  return memory;
}

function lookupPayload(pathname) {
  if (pathname === '/v1/me') {
    return {
      data: {
        id: 'label-1',
        note: 'leak ' + ACCESS + ' ' + REFRESH + ' ' + SECRET,
        access_token: ACCESS,
        refresh_token: REFRESH,
      },
    };
  }
  if (pathname === '/v1/lookup/languages') return { data: [{ code: 'en', name: 'English' }] };
  if (pathname === '/v1/lookup/genres') return { data: ['Reggae', 'Pop'] };
  if (pathname === '/v1/lookup/platforms') {
    return {
      data: {
        platforms: ['Spotify', 'Apple Music', 'YouTube Music'],
        aiExcludedPlatforms: ['YouTube Music'],
      },
    };
  }
  if (pathname === '/v1/preferences/artists') return { data: [{ artist_name: 'Vicki G' }] };
  return { data: { id: 'rel-1', message: 'ok' } };
}

function installFetch(handler) {
  const calls = [];
  const fn = async (url, options) => {
    const row = {
      url: String(url),
      method: options && options.method,
      body: options && options.body,
      authorization: options && options.headers && options.headers.Authorization,
      redirect: options && options.redirect,
    };
    calls.push(row);
    if (handler) return handler(row);
    const parsed = new URL(row.url);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(lookupPayload(parsed.pathname)),
    };
  };
  toolost.setFetchForTests(fn);
  api.setFetchForTests(fn);
  return calls;
}

async function postRelease(cookie, body, url) {
  const res = mockRes();
  await meApi({
    method: 'POST',
    url: url || '/api/toolost/sandbox-test-release',
    headers: cookie ? { cookie: cookie } : {},
    body: body || {},
  }, res);
  return res;
}

function assertNoSecrets(text) {
  const raw = String(text);
  assert.ok(raw.indexOf(ACCESS) === -1, 'access token leaked');
  assert.ok(raw.indexOf(REFRESH) === -1, 'refresh token leaked');
  assert.ok(raw.indexOf(NEXT) === -1, 'rotated token leaked');
  assert.ok(raw.indexOf(SECRET) === -1, 'client secret leaked');
}

function assertSandboxCalls(calls) {
  calls.forEach((row) => {
    const url = new URL(row.url);
    if (row.url === toolost.TOKEN_URL) return;
    assert.strictEqual(url.protocol, 'https:');
    assert.strictEqual(url.hostname, 'api-sandbox.toolost.com');
    assert.ok(url.pathname.indexOf('/v1/') === 0);
  });
}

async function run() {
  const source = read('lib/toolost-api.js');
  assert.ok(source.includes('https://api-sandbox.toolost.com/v1'));
  assert.ok(!source.includes('https://api.toolost.com'));
  assert.ok(!source.includes('https://toolost.com'));

  assert.throws(() => api.assertSandboxUrl('https://api.toolost.com/v1/me'), (err) => err.code === 'SANDBOX_HOST');
  assert.throws(() => api.assertSandboxUrl('http://api-sandbox.toolost.com/v1/me'), (err) => err.code === 'SANDBOX_HOST');
  assert.throws(() => api.assertSandboxUrl('https://user:pass@api-sandbox.toolost.com/v1/me'), (err) => err.code === 'SANDBOX_HOST');
  assert.throws(() => api.assertSandboxUrl('https://api-sandbox.toolost.com.evil.example/v1/me'), (err) => err.code === 'SANDBOX_HOST');
  assert.strictEqual(api.assertSandboxUrl(api.SANDBOX_BASE + '/me').hostname, 'api-sandbox.toolost.com');

  const blocked = [];
  api.setFetchForTests(async (url) => {
    blocked.push(String(url));
    return { ok: true, status: 200, text: async () => '{}' };
  });
  await assert.rejects(
    () => api.sandboxRequest('GET', 'https://api.toolost.com/v1/releases', { token: ACCESS }),
    (err) => err.code === 'SANDBOX_HOST' && String(err.message).indexOf(ACCESS) === -1
  );
  await assert.rejects(
    () => api.sandboxRequest('POST', '/me', { token: ACCESS, body: { title: 'nope' } }),
    (err) => err.code === 'SANDBOX_ALLOW'
  );
  await assert.rejects(
    () => api.sandboxRequest('GET', '/releases', { token: ACCESS }),
    (err) => err.code === 'SANDBOX_ALLOW'
  );
  assert.strictEqual(blocked.length, 0);
  api.resetForTests();

  await withEnv(sandboxEnv(), async () => {
    const anon = await postRelease('', { step: 'plan' });
    assert.strictEqual(anon.statusCode, 401);
    assert.ok(anon.body.includes('Sign in with the PLAIGROUND label owner account first.'));
    const rewritten = await postRelease('', { step: 'submit', confirm: api.CONFIRM_PHRASE }, '/api/me?action=toolost-sandbox-release');
    assert.strictEqual(rewritten.statusCode, 401);
    assert.ok(rewritten.body.includes('Sign in with the PLAIGROUND label owner account first.'));
    const artist = await signupUser('artist@example.com');
    const forbidden = await postRelease(artist, { step: 'plan' });
    assert.strictEqual(forbidden.statusCode, 403);
    assert.ok(forbidden.body.includes('This page connects the PLAIGROUND label account.'));
    const owner = await signupUser('emailplaiground@gmail.com');
    const wrongMethod = mockRes();
    await meApi({
      method: 'GET',
      url: '/api/toolost/sandbox-test-release',
      headers: { cookie: owner },
    }, wrongMethod);
    assert.strictEqual(wrongMethod.statusCode, 405);
    assert.strictEqual(jsonBody(wrongMethod).error, 'Use POST.');
  });

  await withEnv(sandboxEnv(), async () => {
    const owner = await signupUser('emailplaiground@gmail.com');
    await saveToken();
    toolost.setNowForTests(() => FIXED_NOW);
    const logs = [];
    const prev = console.info;
    console.info = function () { logs.push(Array.prototype.slice.call(arguments)); };
    const calls = installFetch();
    try {
      const res = await postRelease(owner, {
        title: 'HACKED',
        lyrics: 'injected lyric',
        participants: [{ name: 'Mallory', role: ['primary'] }],
      });
      assert.strictEqual(res.statusCode, 200, res.body);
      const body = jsonBody(res);
      assert.strictEqual(body.step, 'plan');
      assert.strictEqual(body.dryRun, true);
      assert.strictEqual(body.base, api.SANDBOX_BASE);
      assert.deepStrictEqual(body.requests.create.body, api.createBody());
      assert.strictEqual(body.requests.create.body.title, 'Unicorn in West Hollywood');
      assert.deepStrictEqual(body.requests.uploadUrls[0].body, api.audioUploadBody());
      assert.deepStrictEqual(body.requests.uploadUrls[1].body, api.artworkUploadBody());
      assert.strictEqual(body.requests.attach.tracks.body.tracks[0].aiAssisted, true);
      assert.deepStrictEqual(body.requests.attach.tracks.body.tracks[0].lyrics, { explicit: false });
      assert.deepStrictEqual(body.requests.attach.tracks.body.tracks[0].writers, [
        { name: 'Victoria Imtanes', role: ['lyricist'] },
        { name: 'Victoria Imtanes', role: ['instrumentalist'] },
      ]);
      assert.strictEqual(body.requests.attach.metadata.body.primaryGenre, 'Reggae');
      assert.strictEqual(body.requests.attach.metadata.body.releaseDate, '2026-12-09');
      assert.strictEqual(body.requests.attach.metadata.body.isAiGenerated, true);
      assert.deepStrictEqual(body.requests.attach.delivery.body.delivery.platforms, ['Spotify', 'Apple Music']);
      assert.deepStrictEqual(body.requests.attach.delivery.body.delivery.territories, ['Worldwide']);
      assert.strictEqual(body.requests.submit.body.acceptTerms, true);
      assert.strictEqual(body.requests.submit.body.confirmRights, true);
      assert.ok(body.lookups.me.note.indexOf('leak') === 0);
      assert.strictEqual(body.lookups.me.access_token, undefined);
      assert.strictEqual(calls.length, 5);
      calls.forEach((row) => assert.strictEqual(row.method, 'GET'));
      assert.deepStrictEqual(calls.map((row) => new URL(row.url).pathname), [
        '/v1/me',
        '/v1/lookup/languages',
        '/v1/lookup/genres',
        '/v1/lookup/platforms',
        '/v1/preferences/artists',
      ]);
      assertSandboxCalls(calls);
      calls.forEach((row) => assert.strictEqual(row.authorization, 'Bearer ' + ACCESS));
      calls.forEach((row) => assert.strictEqual(row.redirect, 'manual'));
      const sandboxLogs = logs.filter((row) => row[0] === 'toolost sandbox');
      assert.strictEqual(sandboxLogs.length, 5);
      sandboxLogs.forEach((row) => {
        assert.deepStrictEqual(Object.keys(row[1]).sort(), ['endpoint', 'status']);
        assert.strictEqual(row[1].status, 200);
      });
      assertNoSecrets(res.body);
      assertNoSecrets(JSON.stringify(logs));
    } finally {
      console.info = prev;
    }
  });

  await withEnv(sandboxEnv(), async () => {
    const owner = await signupUser('emailplaiground@gmail.com');
    await saveToken({ expires_at: new Date(FIXED_NOW - 120000).toISOString() });
    toolost.setNowForTests(() => FIXED_NOW);
    const logs = [];
    const prev = console.info;
    console.info = function () { logs.push(Array.prototype.slice.call(arguments)); };
    const calls = installFetch(async (row) => {
      if (row.url === toolost.TOKEN_URL) {
        assert.strictEqual(row.method, 'POST');
        const form = new URLSearchParams(row.body);
        assert.strictEqual(form.get('grant_type'), 'refresh_token');
        assert.strictEqual(form.get('refresh_token'), REFRESH);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            access_token: NEXT,
            refresh_token: REFRESH,
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        };
      }
      const parsed = new URL(row.url);
      const payload = lookupPayload(parsed.pathname);
      if (parsed.pathname === '/v1/me') payload.data.note += ' ' + NEXT;
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    });
    try {
      const res = await postRelease(owner, { step: 'plan' });
      assert.strictEqual(res.statusCode, 200, res.body);
      assert.strictEqual(calls[0].url, toolost.TOKEN_URL);
      calls.slice(1).forEach((row) => assert.strictEqual(row.authorization, 'Bearer ' + NEXT));
      assertSandboxCalls(calls);
      assertNoSecrets(res.body);
      assertNoSecrets(JSON.stringify(logs));
      const stored = await toolost.labelTokenForTests();
      assert.strictEqual(stored.access_token, NEXT);
    } finally {
      console.info = prev;
    }
  });

  await withEnv(sandboxEnv(), async () => {
    const owner = await signupUser('emailplaiground@gmail.com');
    await saveToken();
    const calls = installFetch();
    const missing = await postRelease(owner, { step: 'submit', releaseId: 'rel-1' });
    assert.strictEqual(missing.statusCode, 400, missing.body);
    assert.ok(jsonBody(missing).error.includes('SANDBOX-SUBMIT'));
    const wrong = await postRelease(owner, { step: 'submit', releaseId: 'rel-1', confirm: 'sandbox-submit' });
    assert.strictEqual(wrong.statusCode, 400, wrong.body);
    const unknown = await postRelease(owner, { step: 'drop-database' });
    assert.strictEqual(unknown.statusCode, 400, unknown.body);
    const badId = await postRelease(owner, { step: 'status', releaseId: '../me' });
    assert.strictEqual(badId.statusCode, 400, badId.body);
    assert.strictEqual(calls.length, 0);

    const submitCalls = installFetch();
    const logs = [];
    const prev = console.info;
    console.info = function () { logs.push(Array.prototype.slice.call(arguments)); };
    try {
      const ok = await postRelease(owner, {
        step: 'submit',
        releaseId: 'rel-1',
        confirm: api.CONFIRM_PHRASE,
        title: 'HACKED',
      });
      assert.strictEqual(ok.statusCode, 200, ok.body);
      assert.strictEqual(submitCalls.length, 1);
      assert.strictEqual(submitCalls[0].method, 'POST');
      assert.strictEqual(new URL(submitCalls[0].url).pathname, '/v1/releases/rel-1/submit');
      assert.deepStrictEqual(JSON.parse(submitCalls[0].body), api.submitBody('rel-1'));
      assertSandboxCalls(submitCalls);
      assertNoSecrets(ok.body);
      assertNoSecrets(JSON.stringify(logs));
    } finally {
      console.info = prev;
    }
  });

  await withEnv(sandboxEnv(), async () => {
    const owner = await signupUser('emailplaiground@gmail.com');
    await saveToken();
    toolost.setNowForTests(() => FIXED_NOW);
    const logs = [];
    const prev = console.info;
    console.info = function () { logs.push(Array.prototype.slice.call(arguments)); };
    try {
    const calls = installFetch(async (row) => {
      const parsed = new URL(row.url);
      if (parsed.pathname.endsWith('/tracks/upload-url')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            data: {
              uploadUrl: 'https://s3.example/audio?sig=1',
              fileKey: 'external/tracks/unicorn.flac',
              method: 'PUT',
              headers: { 'Content-Type': 'audio/flac', Authorization: ACCESS },
              access_token: ACCESS,
            },
          }),
        };
      }
      if (parsed.pathname.endsWith('/artwork/upload-url')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            data: {
              uploadUrl: 'https://s3.example/cover?sig=1',
              fileKey: 'external/artwork/unicorn.jpg',
              method: 'PUT',
              headers: { 'Content-Type': 'image/jpeg' },
            },
          }),
        };
      }
      if (row.method === 'POST' && parsed.pathname === '/v1/releases') {
        return { ok: true, status: 201, text: async () => JSON.stringify({ data: { id: 42, title: 'ignored' } }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify(lookupPayload(parsed.pathname)) };
    });
    const created = await postRelease(owner, { step: 'create', title: 'HACKED', type: 'Album' });
    assert.strictEqual(created.statusCode, 200, created.body);
    assert.strictEqual(jsonBody(created).releaseId, '42');
    assert.deepStrictEqual(JSON.parse(calls[0].body), api.createBody());

    const uploads = await postRelease(owner, { step: 'upload-urls', releaseId: '42', fileName: 'nope.mp3' });
    assert.strictEqual(uploads.statusCode, 200, uploads.body);
    const uploaded = jsonBody(uploads);
    assert.strictEqual(uploaded.audio.uploadUrl, 'https://s3.example/audio?sig=1');
    assert.strictEqual(uploaded.audio.fileKey, 'external/tracks/unicorn.flac');
    assert.strictEqual(uploaded.audio.headers.Authorization, undefined);
    assert.strictEqual(uploaded.audio.headers['Content-Type'], 'audio/flac');
    assert.strictEqual(uploaded.artwork.fileKey, 'external/artwork/unicorn.jpg');
    assert.deepStrictEqual(JSON.parse(calls[1].body), api.audioUploadBody());
    assert.deepStrictEqual(JSON.parse(calls[2].body), api.artworkUploadBody());
    assertNoSecrets(uploads.body);

    const attached = await postRelease(owner, {
      step: 'attach',
      releaseId: '42',
      audioFileKey: 'external/tracks/unicorn.flac',
      coverFileKey: 'external/artwork/unicorn.jpg',
      title: 'HACKED',
      primaryGenre: 'Pop',
      writers: [{ name: 'Mallory', role: ['lyricist'] }],
    });
    assert.strictEqual(attached.statusCode, 200, attached.body);
    const attachBody = jsonBody(attached);
    assert.deepStrictEqual(attachBody.platforms, ['Spotify', 'Apple Music']);
    assert.deepStrictEqual(attachBody.territories, ['Worldwide']);
    assert.strictEqual(attachBody.releaseDate, '2026-12-09');
    const writes = calls.slice(3);
    assert.deepStrictEqual(writes.map((row) => row.method + ' ' + new URL(row.url).pathname), [
      'GET /v1/lookup/platforms',
      'PUT /v1/releases/42/tracks',
      'PATCH /v1/releases/42/metadata',
      'PATCH /v1/releases/42/delivery',
    ]);
    const tracks = JSON.parse(writes[1].body);
    assert.strictEqual(tracks.tracks[0].title, 'Unicorn in West Hollywood');
    assert.strictEqual(tracks.tracks[0].audioFileKey, 'external/tracks/unicorn.flac');
    assert.strictEqual(tracks.tracks[0].writers[0].name, 'Victoria Imtanes');
    const metadata = JSON.parse(writes[2].body);
    assert.strictEqual(metadata.primaryGenre, 'Reggae');
    assert.strictEqual(metadata.coverFileKey, 'external/artwork/unicorn.jpg');
    assert.strictEqual(metadata.isAiGenerated, true);
    assertSandboxCalls(calls);
    assertNoSecrets(attached.body);

    const status = await postRelease(owner, { step: 'status', releaseId: '42' });
    assert.strictEqual(status.statusCode, 200, status.body);
    assert.strictEqual(jsonBody(status).release.id, 'rel-1');
    const removed = await postRelease(owner, { step: 'delete-draft', releaseId: '42' });
    assert.strictEqual(removed.statusCode, 200, removed.body);
    assert.strictEqual(jsonBody(removed).deleted, true);
    assert.strictEqual(calls[calls.length - 1].method, 'DELETE');
    assertSandboxCalls(calls);
    assertNoSecrets(JSON.stringify(logs));
    } finally {
      console.info = prev;
    }
  });

  const vercel = JSON.parse(read('vercel.json'));
  const rewrite = vercel.rewrites.find((row) => row.source === '/api/toolost/sandbox-test-release');
  assert.ok(rewrite);
  assert.strictEqual(rewrite.destination, '/api/me?action=toolost-sandbox-release');
  const apiFiles = fs.readdirSync(path.join(__dirname, '..', 'api')).filter((name) => name.endsWith('.js'));
  assert.strictEqual(apiFiles.length, 12);
  assert.ok(!apiFiles.includes('toolost.js'));

  console.log('lib/toolost-api.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
