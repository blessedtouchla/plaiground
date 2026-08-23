'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'tonegrid.js'), 'utf8');
const requiredCode = fs.readFileSync(path.join(__dirname, 'lib', 'upload-required.js'), 'utf8');
const AUDIO = { name: 'night-drive.wav', type: 'audio/wav', size: 2048 };
const ART = { name: 'cover.jpg', type: 'image/jpeg', size: 1024 };

function makeStorage() {
  const data = Object.create(null);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

function makeEl(attrs) {
  const el = {
    id: attrs.id || '',
    value: attrs.value || '',
    textContent: '',
    hidden: true,
    checked: Boolean(attrs.checked),
    href: attrs.href || '',
    style: {},
    attrs: Object.assign({}, attrs.attrs || {}),
    listeners: {},
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    classList: {
      tokens: Object.create(null),
      toggle(name, force) {
        if (force) this.tokens[name] = true;
        else delete this.tokens[name];
      },
      add(name) {
        this.tokens[name] = true;
      },
      contains(name) {
        return Boolean(this.tokens[name]);
      },
    },
  };
  return el;
}

function load(options) {
  const opts = options || {};
  const title = makeEl({ id: 'tg-title', value: opts.title || '' });
  const artist = makeEl({ id: 'tg-artist', value: opts.artist || '' });
  const featured = makeEl({ id: 'tg-featured', value: opts.featured || '' });
  const genre = makeEl({ id: 'tg-genre', value: opts.genre || '' });
  const language = makeEl({ id: 'tg-language', value: opts.language || '' });
  const price = makeEl({ id: 'tg-price', value: opts.price || '' });
  const date = makeEl({ id: 'tg-release-date', value: opts.releaseDate || '' });
  const instrumental = makeEl({ id: 'tg-instrumental', checked: Boolean(opts.instrumental) });
  const languageField = makeEl({ attrs: { 'data-language-field': '' } });
  const loader = makeEl({ attrs: { 'data-upload-loader': '' } });
  const loaderStep = makeEl({ attrs: { 'data-upload-loader-step': '' } });
  const loaderFill = makeEl({ attrs: { 'data-upload-loader-fill': '' } });
  const loaderMeta = makeEl({ attrs: { 'data-upload-loader-meta': '' } });
  const status = makeEl({ id: 'tg-status' });
  const limit = makeEl({ id: 'tg-limit' });
  const continueBtn = makeEl({
    attrs: { href: 'attest.html', 'data-tonegrid-continue': '' },
  });
  const payBtn = makeEl({
    attrs: { href: 'submitted.html', 'data-tonegrid-submit': '' },
  });
  const calls = [];
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  if (opts.draft) {
    localStorage.setItem('plaiground.tonegrid.draft', JSON.stringify(opts.draft));
  }

  const elements = {
    'tg-title': title,
    'tg-artist': artist,
    'tg-featured': featured,
    'tg-genre': genre,
    'tg-language': language,
    'tg-price': price,
    'tg-release-date': date,
    'tg-instrumental': instrumental,
    'tg-status': status,
    'tg-upgrade': makeEl({ id: 'tg-upgrade' }),
    'tg-limit': limit,
  };

  const context = {
    localStorage,
    sessionStorage,
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector(sel) {
        if (sel === '[data-tonegrid-continue]') return opts.bind === 'review' || opts.bind === 'submitted' ? null : continueBtn;
        if (sel === '[data-tonegrid-submit]') return opts.bind === 'review' ? payBtn : null;
        if (sel === '[data-review-title]' || sel === '[data-review-meta]' || sel === '[data-submit-title]') {
          return opts.bind === 'submitted' ? makeEl({}) : null;
        }
        if (sel === '[data-audio-input]') {
          return opts.file ? { files: [opts.file], _plaigroundFile: opts.file } : null;
        }
        if (sel === '[data-art-input]') {
          return opts.artwork ? { files: [opts.artwork], _plaigroundFile: opts.artwork } : null;
        }
        if (sel === '[data-explicit].on, [data-explicit-toggle] .on') {
          return {
            getAttribute: function () { return opts.explicit ? 'true' : 'false'; },
          };
        }
        if (sel === '[data-language-field]') return languageField;
        if (sel === '[data-upload-loader]') return loader;
        if (sel === '[data-upload-loader-step]') return loaderStep;
        if (sel === '[data-upload-loader-fill]') return loaderFill;
        if (sel === '[data-upload-loader-meta]') return loaderMeta;
        if (sel === '[data-instrumental]') return instrumental;
        return null;
      },
    },
    FormData: function FakeFormData() {
      this.parts = [];
      this.append = function (name, value, filename) {
        this.parts.push({ name: name, value: value, filename: filename });
      };
    },
    fetch(url, init) {
      calls.push({ url: String(url), init: init || {} });
      if (String(url).indexOf('/api/me/catalog') !== -1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        });
      }
      const queued = (opts.responses || []).shift();
      const response = queued || { ok: true, status: 201, data: { uuid: '11111111-1111-4111-8111-111111111111' } };
      const done = Promise.resolve({
        ok: response.ok,
        status: response.status,
        json: async () => response.data,
      });
      if (opts.holdFirst && (!opts.holdWhen || String(url).indexOf(opts.holdWhen) !== -1)) {
        if (!opts._held) {
          opts._held = true;
          return Promise.resolve(opts.holdFirst).then(function () { return done; });
        }
      }
      return done;
    },
    location: { href: opts.page || 'upload.html' },
    window: {},
    PlaigroundUploadCatalog: require('./upload-catalog'),
  };
  context.window = context;
  context.window.location = context.location;
  if (opts.account) {
    context.PlaigroundMembership = {
      account: function () { return opts.account; },
      whenReady: function (cb) {
        const result = Promise.resolve({ ok: true, data: opts.account });
        if (typeof cb === 'function') result.then(cb);
        return result;
      },
    };
  }
  vm.runInNewContext(requiredCode, context);
  vm.runInNewContext(code, context);
  return {
    continueBtn,
    payBtn,
    status,
    limit,
    upgrade: elements['tg-upgrade'],
    calls,
    localStorage,
    location: context.location,
    instrumental,
    languageField,
    loader,
    loaderStep,
    date,
  };
}

function draftOf(localStorage) {
  return JSON.parse(localStorage.getItem('plaiground.tonegrid.draft') || '{}');
}

async function flush(times) {
  var n = times || 8;
  for (var i = 0; i < n; i += 1) {
    await new Promise(function (resolve) { setImmediate(resolve); });
  }
}

function filledUpload(extra) {
  return Object.assign({
    title: 'Night Drive',
    artist: 'Ada Night',
    genre: 'Pop',
    language: 'en',
    price: '$0.99',
    file: AUDIO,
    artwork: ART,
  }, extra || {});
}

function attestDraft(extra) {
  return Object.assign({
    made_how: 'ai_assisted',
    human_elements: ['Original lyrics'],
    human_contribution: 'I wrote the lyrics and sang the lead.',
    rights_confirmed: true,
  }, extra || {});
}

async function run() {
  const blocked = load({ title: '', artist: '' });
  blocked.continueBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(blocked.calls.length, 0);
  assert.ok(/required/i.test(blocked.status.textContent));

  const noTitle = load(filledUpload({ title: '' }));
  noTitle.continueBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(noTitle.calls.length, 0);
  assert.strictEqual(noTitle.status.textContent, 'Song title is required.');

  const whitespace = load(filledUpload({ title: '   ', artist: '   ' }));
  whitespace.continueBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(whitespace.calls.length, 0);
  assert.ok(/required/i.test(whitespace.status.textContent));

  const noAudio = load(filledUpload({ file: null }));
  noAudio.continueBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(noAudio.calls.length, 0);
  assert.strictEqual(noAudio.status.textContent, 'Audio is required.');

  const noGenre = load(filledUpload({ genre: '' }));
  noGenre.continueBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(noGenre.calls.length, 0);
  assert.strictEqual(noGenre.status.textContent, 'Genre is required.');

  const noLanguage = load(filledUpload({ language: '' }));
  noLanguage.continueBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(noLanguage.calls.length, 0);
  assert.strictEqual(noLanguage.status.textContent, 'Language is required.');

  const noPrice = load(filledUpload({ price: '' }));
  noPrice.continueBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(noPrice.calls.length, 0);
  assert.strictEqual(noPrice.status.textContent, 'Download price is required.');

  const placeholderPrice = load(filledUpload({ price: 'Select price' }));
  placeholderPrice.continueBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(placeholderPrice.calls.length, 0);
  assert.strictEqual(placeholderPrice.status.textContent, 'Download price is required.');

  const featuredEmpty = load(filledUpload({ featured: '' }));
  featuredEmpty.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(featuredEmpty.calls.some(function (call) { return call.url === '/api/tonegrid/artists'; }));

  const noArtwork = load(filledUpload({ artwork: null }));
  noArtwork.continueBtn.listeners.click({ preventDefault() {} });
  assert.strictEqual(noArtwork.calls.length, 0);
  assert.strictEqual(noArtwork.status.textContent, 'Artwork is required.');

  const fakeGenre = load(filledUpload({ genre: 'Not A Real Genre' }));
  fakeGenre.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(fakeGenre.calls.length === 0 || fakeGenre.location.href.indexOf('attest.html') === -1);

  const uploadResponses = [
    { ok: true, status: 201, data: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
    { ok: true, status: 201, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
    { ok: true, status: 201, data: { track: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } } },
    { ok: true, status: 200, data: { audio_status: 'processing' } },
    { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
  ];
  const upload = load(filledUpload({ featured: '', responses: uploadResponses.slice() }));
  upload.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(/Saving artist|Uploading|Converting|Opening|Creating/i.test(upload.loaderStep.textContent));
  const uploadTonegrid = upload.calls.filter(function (call) { return String(call.url).indexOf('/api/tonegrid/') === 0; });
  assert.ok(uploadTonegrid.length >= 3);
  assert.strictEqual(uploadTonegrid[0].url, '/api/tonegrid/artists');
  assert.strictEqual(uploadTonegrid[1].url, '/api/tonegrid/releases');
  assert.strictEqual(uploadTonegrid[2].url, '/api/tonegrid/tracks');
  assert.ok(upload.calls.some(function (call) { return call.url === '/api/me/catalog'; }));
  const catalogBodies = upload.calls.filter(function (call) { return call.url === '/api/me/catalog'; }).map(function (call) {
    return JSON.parse(call.init.body);
  });
  assert.ok(catalogBodies.some(function (body) { return body.track_id; }));
  const artistBody = JSON.parse(uploadTonegrid[0].init.body);
  const releaseBody = JSON.parse(uploadTonegrid[1].init.body);
  const trackBody = JSON.parse(uploadTonegrid[2].init.body);
  assert.strictEqual(artistBody.name, 'Ada Night');
  assert.strictEqual(releaseBody.artist_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.strictEqual(releaseBody.title, 'Night Drive');
  assert.strictEqual(releaseBody.type, 'single');
  assert.strictEqual(releaseBody.genre, 'Pop');
  assert.strictEqual(releaseBody.release_date, undefined);
  assert.strictEqual(trackBody.language, 'en');
  assert.strictEqual(trackBody.release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.strictEqual(trackBody.title, 'Night Drive');
  assert.strictEqual(trackBody.position, 1);
  assert.strictEqual(trackBody.explicit, false);
  const draft = draftOf(upload.localStorage);
  assert.strictEqual(draft.artist_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.strictEqual(draft.release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.ok(draft.track_id);
  assert.strictEqual(upload.location.href, 'attest.html');
  const audioCall = upload.calls.find(function (call) {
    return String(call.url) === '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio';
  });
  assert.ok(audioCall);
  assert.ok(audioCall.init.body.parts.some(function (part) { return part.name === 'audio'; }));
  assert.ok(upload.calls.some(function (call) {
    return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/artwork';
  }));

  const instrumentalOk = load(filledUpload({
    instrumental: true,
    language: '',
    responses: uploadResponses.slice(),
  }));
  instrumentalOk.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(instrumentalOk.calls.some(function (call) { return call.url === '/api/tonegrid/artists'; }));
  assert.strictEqual(instrumentalOk.languageField.hidden, true);
  const instRelease = instrumentalOk.calls.find(function (call) { return call.url === '/api/tonegrid/releases'; });
  const instTrack = instrumentalOk.calls.find(function (call) { return call.url === '/api/tonegrid/tracks'; });
  assert.ok(instRelease);
  assert.ok(instTrack);
  assert.strictEqual(JSON.parse(instRelease.init.body).instrumental, true);
  assert.strictEqual(JSON.parse(instRelease.init.body).language, undefined);
  assert.strictEqual(JSON.parse(instTrack.init.body).language, undefined);
  assert.strictEqual(draftOf(instrumentalOk.localStorage).instrumental, true);
  assert.strictEqual(instrumentalOk.location.href, 'attest.html');

  const explicitYes = load(filledUpload({
    explicit: true,
    responses: uploadResponses.slice(),
  }));
  explicitYes.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  const explicitTrack = explicitYes.calls.find(function (call) { return call.url === '/api/tonegrid/tracks'; });
  assert.ok(explicitTrack);
  assert.strictEqual(JSON.parse(explicitTrack.init.body).explicit, true);

  const limited = load(filledUpload({
    responses: [{
      ok: false,
      status: 403,
      data: { error: 'Basic includes one release. Upgrade to Creator or Pro to upload more.', code: 'PLAN_LIMIT' },
    }],
  }));
  limited.continueBtn.listeners.click({ preventDefault() {} });
  await flush(3);
  assert.strictEqual(limited.calls.length, 1);
  assert.strictEqual(limited.calls[0].url, '/api/tonegrid/artists');
  assert.strictEqual(limited.status.textContent, 'Basic includes one release. Upgrade to Creator or Pro to upload more.');
  assert.ok(limited.status.classList.contains('upload-status-error'));
  assert.strictEqual(limited.limit.hidden, false);
  assert.strictEqual(limited.upgrade.hidden, false);
  assert.notStrictEqual(limited.continueBtn.getAttribute('aria-busy'), 'true');
  assert.notStrictEqual(limited.continueBtn.getAttribute('aria-disabled'), 'true');
  assert.notStrictEqual(limited.location.href, 'attest.html');
  assert.ok(limited.location.href.indexOf('attest.html') === -1);

  limited.continueBtn.listeners.click({ preventDefault() {} });
  await flush(3);
  assert.ok(limited.calls.length >= 2, 'later click after PLAN_LIMIT must still run');

  let frozenHold;
  const held = new Promise(function (resolve) { frozenHold = resolve; });
  const frozen = load(filledUpload({
    holdFirst: held,
    holdWhen: '/api/tonegrid/artists',
    responses: uploadResponses.slice(),
  }));
  frozen.continueBtn.listeners.click({ preventDefault() {} });
  await flush(3);
  assert.strictEqual(frozen.continueBtn.getAttribute('aria-busy'), 'true');
  frozen.continueBtn.listeners.click({ preventDefault() {} });
  await flush(2);
  assert.strictEqual(frozen.calls.filter(function (call) { return call.url === '/api/tonegrid/artists'; }).length, 1);
  frozenHold();
  await flush();

  const limitedRelease = load(filledUpload({
    responses: [
      { ok: true, status: 201, data: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
      { ok: false, status: 403, data: { error: 'Creator includes 8 releases per month. Upgrade to Pro to upload more.', code: 'PLAN_LIMIT' } },
    ],
  }));
  limitedRelease.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(limitedRelease.calls.some(function (call) { return call.url === '/api/tonegrid/releases'; }));
  assert.ok(!limitedRelease.calls.some(function (call) { return call.url === '/api/tonegrid/tracks'; }));
  assert.strictEqual(limitedRelease.status.textContent, 'Creator includes 8 releases per month. Upgrade to Pro to upload more.');
  assert.ok(limitedRelease.status.classList.contains('upload-status-error'));
  assert.strictEqual(limitedRelease.limit.hidden, false);
  assert.notStrictEqual(limitedRelease.continueBtn.getAttribute('aria-busy'), 'true');
  assert.ok(limitedRelease.location.href.indexOf('attest.html') === -1);

  const reuseDraft = load(filledUpload({
    draft: {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
    account: {
      plan: 'basic',
      artist: 'Products',
      tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
    },
    responses: [
      { ok: true, status: 201, data: { track: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } } },
      { ok: true, status: 200, data: { audio_status: 'processing' } },
      { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
    ],
  }));
  reuseDraft.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  const reuseTonegrid = reuseDraft.calls.filter(function (call) { return String(call.url).indexOf('/api/tonegrid/') === 0; });
  assert.ok(!reuseTonegrid.some(function (call) { return call.url === '/api/tonegrid/artists'; }), 'reuse must not create a second artist');
  assert.ok(!reuseTonegrid.some(function (call) { return call.url === '/api/tonegrid/releases'; }), 'reuse must not create a second release');
  assert.ok(reuseTonegrid.some(function (call) { return call.url === '/api/tonegrid/tracks'; }));
  assert.strictEqual(reuseDraft.location.href, 'attest.html');
  assert.strictEqual(draftOf(reuseDraft.localStorage).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

  const leftoverEmptyDraft = load(filledUpload({
    artist: 'Products',
    genre: 'Cajun',
    price: '$0.69',
    account: {
      plan: 'basic',
      artist: 'Products',
      tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
    },
    responses: [],
  }));
  await flush();
  assert.strictEqual(leftoverEmptyDraft.limit.hidden, false, 'Basic at lifetime limit sees PLAN_LIMIT on upload load');
  assert.strictEqual(leftoverEmptyDraft.status.textContent, 'Basic includes one release. Upgrade to Creator or Pro to upload more.');
  leftoverEmptyDraft.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  const leftoverTonegrid = leftoverEmptyDraft.calls.filter(function (call) { return String(call.url).indexOf('/api/tonegrid/') === 0; });
  assert.ok(!leftoverTonegrid.some(function (call) { return String(call.url).indexOf('/api/tonegrid/') === 0; }), 'second first upload must not hit ToneGrid');
  assert.strictEqual(leftoverEmptyDraft.limit.hidden, false);
  assert.strictEqual(leftoverEmptyDraft.upgrade.hidden, false);
  assert.ok(leftoverEmptyDraft.location.href.indexOf('attest.html') === -1);

  const retrySameIds = load(filledUpload({
    draft: {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      release_idempotency_key: 'plaiground-release-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:Night Drive',
      track_idempotency_key: 'plaiground-track-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1',
    },
    account: {
      plan: 'basic',
      tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
      upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
    },
    responses: [
      { ok: true, status: 200, data: { audio_status: 'processing' } },
      { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
    ],
  }));
  retrySameIds.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  const retryCalls = retrySameIds.calls.filter(function (call) { return String(call.url).indexOf('/api/tonegrid/') === 0; });
  assert.ok(!retryCalls.some(function (call) { return call.url === '/api/tonegrid/artists'; }));
  assert.ok(!retryCalls.some(function (call) { return call.url === '/api/tonegrid/releases'; }));
  assert.ok(!retryCalls.some(function (call) { return call.url === '/api/tonegrid/tracks'; }), 'second Continue must skip createTrack');
  assert.ok(retryCalls.some(function (call) { return String(call.url).indexOf('/audio') !== -1; }));
  assert.ok(retryCalls.some(function (call) { return String(call.url).indexOf('/artwork') !== -1; }));
  assert.strictEqual(draftOf(retrySameIds.localStorage).release_idempotency_key, 'plaiground-release-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:Night Drive');
  assert.strictEqual(draftOf(retrySameIds.localStorage).track_idempotency_key, 'plaiground-track-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1');
  assert.strictEqual(retrySameIds.location.href, 'attest.html');

  const secondSong = load(filledUpload({
    account: {
      plan: 'creator',
      tonegrid_release_ids: [
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0003',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0004',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0005',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0006',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0007',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0008',
      ],
      upload: { allowed: false, used: 8, limit: 8, plan: 'creator' },
    },
    responses: [{
      ok: false,
      status: 403,
      data: { error: 'Creator includes 8 releases per month. Upgrade to Pro to upload more.', code: 'PLAN_LIMIT' },
    }],
  }));
  secondSong.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(!secondSong.calls.some(function (call) { return String(call.url).indexOf('/api/tonegrid/') === 0; }));
  assert.strictEqual(secondSong.status.textContent, 'Creator includes 8 releases per month. Upgrade to Pro to upload more.');
  assert.ok(secondSong.status.classList.contains('upload-status-error'));
  assert.strictEqual(secondSong.limit.hidden, false);
  assert.strictEqual(secondSong.upgrade.hidden, false);
  assert.notStrictEqual(secondSong.continueBtn.getAttribute('aria-busy'), 'true');
  assert.ok(secondSong.location.href.indexOf('attest.html') === -1);
  assert.ok(!/Saving artist/.test(secondSong.status.textContent));

  const unavailable = load(filledUpload({
    responses: [{ ok: false, status: 503, data: { configured: false, error: 'ToneGrid is not configured.' } }],
  }));
  unavailable.continueBtn.listeners.click({ preventDefault() {} });
  await flush(3);
  assert.strictEqual(unavailable.calls.length, 1);
  assert.strictEqual(unavailable.status.textContent, 'Catalog sync is not configured yet.');
  assert.strictEqual(unavailable.location.href, 'attest.html');

  const payNoDate = load({
    bind: 'review',
    draft: {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      signwell_document_id: 'doc_split_sheet_01',
    },
  });
  const minDate = (function () {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }());
  assert.strictEqual(payNoDate.date.type, 'date');
  assert.strictEqual(payNoDate.date.min, minDate);
  assert.strictEqual(payNoDate.date.required, true);
  payNoDate.payBtn.listeners.click({ preventDefault() {} });
  await flush(2);
  assert.strictEqual(payNoDate.status.textContent, 'Release date is required.');
  assert.ok(!payNoDate.calls.some(function (call) { return String(call.url).indexOf('/submit') !== -1; }));

  const yesterday = (function () {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }());
  payNoDate.date.value = yesterday;
  payNoDate.date.listeners.change();
  assert.strictEqual(payNoDate.date.value, '');
  assert.strictEqual(draftOf(payNoDate.localStorage).release_date, '');
  payNoDate.date.value = minDate;
  payNoDate.date.listeners.change();
  assert.strictEqual(payNoDate.date.value, minDate);
  assert.strictEqual(draftOf(payNoDate.localStorage).release_date, minDate);

  const paySkip = load({
    bind: 'review',
    releaseDate: '2026-09-12',
    draft: {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
  });
  paySkip.payBtn.listeners.click({ preventDefault() {} });
  await flush(4);
  assert.ok(!paySkip.calls.some(function (call) { return String(call.url).indexOf('/submit') !== -1; }));
  assert.notStrictEqual(paySkip.location.href, 'submitted.html');
  assert.ok(/split sheet/i.test(paySkip.status.textContent));

  const signedSubmit = load({
    bind: 'review',
    releaseDate: '2026-09-12',
    draft: Object.assign(attestDraft(), {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      signwell_document_id: 'doc_split_sheet_01',
      release_date: '2026-09-12',
    }),
    responses: [
      { ok: true, status: 200, data: { signed: true, status: 'Completed' } },
      { ok: true, status: 200, data: { status: 'pending', signed: true } },
    ],
  });
  signedSubmit.payBtn.listeners.click({ preventDefault() {} });
  await flush(8);
  const submitCall = signedSubmit.calls.find(function (call) {
    return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
  });
  assert.ok(submitCall);
  assert.strictEqual(JSON.parse(submitCall.init.body).document_id, 'doc_split_sheet_01');
  assert.strictEqual(draftOf(signedSubmit.localStorage).tonegrid_status, 'pending');

  const soloSubmit = load({
    bind: 'review',
    releaseDate: '2026-09-12',
    draft: Object.assign(attestDraft(), {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      solo_owned_100: true,
      release_date: '2026-09-12',
    }),
    responses: [
      { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
    ],
  });
  await flush(8);
  const soloCall = soloSubmit.calls.find(function (call) {
    return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
  });
  assert.ok(soloCall);
  assert.strictEqual(JSON.parse(soloCall.init.body).solo_owned_100, true);
  assert.ok(!JSON.parse(soloCall.init.body).document_id);
  assert.ok(!soloSubmit.calls.some(function (call) {
    return String(call.url).indexOf('/api/signwell') !== -1;
  }));

  const pendingSubmit = load({
    bind: 'review',
    releaseDate: '2026-09-12',
    draft: Object.assign(attestDraft(), {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      signwell_document_id: 'doc_pending_01',
      release_date: '2026-09-12',
      writers: [
        { name: 'Ada Night', email: 'ada@example.com', share: 50 },
        { name: 'Bea Night', email: 'bea@example.com', share: 50 },
      ],
    }),
    responses: [
      { ok: true, status: 200, data: { signed: false, status: 'Pending' } },
      { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'awaiting_signature' } },
    ],
  });
  await flush(8);
  const pendingCall = pendingSubmit.calls.find(function (call) {
    return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
  });
  assert.ok(pendingCall);
  assert.strictEqual(JSON.parse(pendingCall.init.body).document_id, 'doc_pending_01');
  assert.strictEqual(draftOf(pendingSubmit.localStorage).tonegrid_status, 'pending');

  const submittedRetry = load({
    bind: 'submitted',
    page: 'submitted.html',
    draft: {
      artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Night Drive',
      type: 'single',
    },
    responses: [{ ok: true, status: 201, data: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } }],
  });
  await flush();
  const retryTonegrid = submittedRetry.calls.filter(function (call) { return String(call.url).indexOf('/api/tonegrid/') === 0; });
  assert.ok(retryTonegrid.some(function (call) { return call.url === '/api/tonegrid/releases'; }));
  assert.ok(retryTonegrid.some(function (call) { return call.url === '/api/tonegrid/tracks'; }));
  assert.strictEqual(draftOf(submittedRetry.localStorage).release_id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

  let releaseHold;
  const holdFirst = new Promise(function (resolve) { releaseHold = resolve; });
  const doubleClick = load(filledUpload({
    responses: uploadResponses.slice(),
    holdFirst: holdFirst,
    holdWhen: '/api/tonegrid/artists',
  }));
  doubleClick.continueBtn.listeners.click({ preventDefault() {} });
  await flush(2);
  doubleClick.continueBtn.listeners.click({ preventDefault() {} });
  await flush(2);
  assert.strictEqual(doubleClick.calls.filter(function (call) {
    return call.url === '/api/tonegrid/artists';
  }).length, 1);
  releaseHold();
  await flush();

  let audioHold;
  const holdAudio = new Promise(function (resolve) { audioHold = resolve; });
  const mp3Wait = load(filledUpload({
    file: { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2048 },
    responses: uploadResponses.slice(),
    holdFirst: holdAudio,
    holdWhen: '/audio',
  }));
  mp3Wait.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(/Converting MP3 to WAV|Uploading audio/i.test(mp3Wait.loaderStep.textContent + ' ' + mp3Wait.status.textContent));
  audioHold();
  await flush();

  const source = fs.readFileSync(path.join(__dirname, 'tonegrid.js'), 'utf8');
  assert.ok(source.includes('Converting MP3 to WAV'));
  assert.ok(source.includes('Uploading audio'));
  assert.ok(source.includes('Uploading artwork'));
  assert.ok(source.includes('Opening SignWell'));
  assert.ok(!source.includes('Neon Shadows'));
  assert.ok(!source.includes('Victoria Reyes'));
  assert.ok(!source.includes(['t', 'g', 'k', '_'].join('')));

  console.log('tonegrid.client.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
