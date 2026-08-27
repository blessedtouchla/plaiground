'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'store-client.js'), 'utf8');
const requiredCode = fs.readFileSync(path.join(__dirname, 'lib', 'upload-required.js'), 'utf8');
const audioAcceptCode = fs.readFileSync(path.join(__dirname, 'lib', 'audio-accept.js'), 'utf8');
const storePickCode = fs.readFileSync(path.join(__dirname, 'lib', 'store-pick.js'), 'utf8');
const objectHopCode = fs.readFileSync(path.join(__dirname, 'lib', 'object-hop.js'), 'utf8');
const artistCheckCode = fs.readFileSync(path.join(__dirname, 'lib', 'artist-check.js'), 'utf8');
const AUDIO = { name: 'night-drive.wav', type: 'audio/wav', size: 2048 };
const ART = { name: 'cover.jpg', type: 'image/jpeg', size: 1024 };
const HOP_PUT = 'https://hop.test/put';

function isAudioAttach(url) {
  return /\/api\/tonegrid\/tracks\/[^/]+\/audio$/.test(String(url || ''));
}

function jsonBodyOf(call) {
  if (!call || !call.init) return {};
  if (call.init.body && call.init.body.parts) return { parts: call.init.body.parts };
  try { return JSON.parse(call.init.body || '{}'); } catch (err) { return {}; }
}

function assertAudioKey(call, label) {
  const body = jsonBodyOf(call);
  assert.ok(body.object_key && String(body.object_key).indexOf('audio/') === 0, (label || 'audio') + ' POST must send an object key');
  assert.ok(!body.parts, (label || 'audio') + ' POST must not be multipart');
}

function hoppedFile(calls, file) {
  return (calls || []).some(function (call) {
    return String(call.url).indexOf('https://hop.test/') === 0 && call.init && call.init.body === file;
  });
}

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
      if (!this._listeners) this._listeners = Object.create(null);
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(fn);
      const el = this;
      this.listeners[type] = function (event) {
        const list = el._listeners[type] || [];
        let i;
        for (i = 0; i < list.length; i += 1) list[i](event);
      };
    },
    setCustomValidity(msg) {
      this.customValidity = String(msg || '');
    },
    children: [],
    options: [],
    selectedIndex: -1,
    files: attrs.files || [],
    _plaigroundFile: attrs._plaigroundFile || null,
    _kids: Object.create(null),
    appendChild(child) {
      this.children.push(child);
      if (child && this.options && this.options.indexOf(child) === -1) this.options.push(child);
      return child;
    },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i !== -1) this.children.splice(i, 1);
      return child;
    },
    querySelector(sel) {
      if (this._kids && this._kids[sel]) return this._kids[sel];
      return makeEl({});
    },
    querySelectorAll() {
      return [];
    },
    closest(sel) {
      if (sel === '.st' && (this.className === 'st' || this.getAttribute('class') === 'st')) return this;
      if (sel === '[data-flow-step]' && this.getAttribute('data-flow-step')) return this;
      if (sel === 'a[href]' && this.getAttribute('href')) return this;
      return null;
    },
    hasAttribute(name) {
      return this.attrs[name] != null;
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
      remove(name) {
        delete this.tokens[name];
      },
      contains(name) {
        return Boolean(this.tokens[name]);
      },
    },
  };
  Object.defineProperty(el, 'innerHTML', {
    set(html) {
      const src = String(html || '');
      el._innerHTML = src;
      const re = /data-([a-z0-9-]+)/g;
      let m;
      const seen = {};
      while ((m = re.exec(src))) {
        const key = '[data-' + m[1] + ']';
        if (seen[key]) continue;
        seen[key] = true;
        const child = makeEl({ attrs: { ['data-' + m[1]]: '' } });
        if (m[1] === 'audio-input') {
          child.files = [];
          child._plaigroundFile = null;
        }
        if (m[1] === 'audio-preview') child.hidden = true;
        el._kids[key] = child;
      }
    },
    get() { return el._innerHTML || ''; },
  });
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
  const lyrics = makeEl({ id: 'tg-lyrics', value: opts.lyrics || '' });
  const lyricsField = makeEl({ attrs: { 'data-lyrics-field': '' }, hidden: true });
  const lyricsOpen = makeEl({ id: 'tg-lyrics-open', attrs: { 'data-lyrics-open': '', 'aria-expanded': 'false' } });
  const loader = makeEl({ attrs: { 'data-upload-loader': '' } });
  const loaderStep = makeEl({ attrs: { 'data-upload-loader-step': '' } });
  const loaderFill = makeEl({ attrs: { 'data-upload-loader-fill': '' } });
  const loaderMeta = makeEl({ attrs: { 'data-upload-loader-meta': '' } });
  const status = makeEl({ id: 'tg-status' });
  const limit = makeEl({ id: 'tg-limit' });
  const retryWrap = makeEl({ id: 'tg-retry-wrap', attrs: { 'data-upload-retry-wrap': '' } });
  const retryBtn = makeEl({ attrs: { 'data-upload-retry': '' } });
  retryBtn.textContent = 'Retry';
  const continueBtn = makeEl({
    attrs: { href: 'attest.html', 'data-store-continue': '' },
  });
  const cancelBtn = makeEl({
    attrs: { 'data-upload-cancel': '' },
  });
  cancelBtn.textContent = 'Cancel';
  const payBtn = makeEl({
    attrs: { href: 'submitted.html', 'data-store-submit': '' },
  });
  const submitStores = makeEl({ attrs: { 'data-submit-stores': '' } });
  const storeAll = makeEl({
    id: 'tg-store-all',
    type: 'checkbox',
    checked: true,
    attrs: { 'data-store-all': '' },
  });
  const storeCustomize = makeEl({ attrs: { 'data-store-customize': '' } });
  storeCustomize.textContent = 'Customize';
  const storeSummary = makeEl({ attrs: { 'data-store-summary': '' } });
  storeSummary.textContent = 'All stores will receive this release.';
  const storeList = makeEl({ attrs: { 'data-store-list': '' } });
  const storePick = makeEl({ attrs: { 'data-store-pick': '' } });
  storePick.appendChild(storeAll);
  storePick.appendChild(storeCustomize);
  storePick.appendChild(storeSummary);
  storePick.appendChild(storeList);
  storePick.querySelector = function (sel) {
    if (sel === '[data-store-all]') return storeAll;
    if (sel === '[data-store-customize]') return storeCustomize;
    if (sel === '[data-store-summary]') return storeSummary;
    if (sel === '[data-store-list]' || sel === '[data-edit-stores]') return storeList;
    return null;
  };
  const calls = [];
  const confirms = [];
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  if (opts.draft) {
    localStorage.setItem('plaiground.store.draft', JSON.stringify(opts.draft));
  }
  if (opts.sessionDraft) {
    sessionStorage.setItem('plaiground.store.draft', JSON.stringify(opts.sessionDraft));
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
    'tg-lyrics': lyrics,
    'tg-lyrics-open': lyricsOpen,
    'tg-status': status,
    'tg-upgrade': makeEl({ id: 'tg-upgrade' }),
    'tg-limit': limit,
    'tg-retry-wrap': retryWrap,
    'tg-album-count': makeEl({ id: 'tg-album-count', value: opts.albumCount || '' }),
  };
  const artistMode = makeEl({ id: 'tg-artist-mode', value: 'choose' });
  const artistSelect = makeEl({ id: 'tg-artist-select', value: '' });
  const artistNew = makeEl({ id: 'tg-artist-new', value: '' });
  const artistNameCheck = makeEl({ id: 'artist-name-check' });
  const artistYellow = makeEl({ id: 'artist-yellow-actions' });
  const artistRed = makeEl({ id: 'artist-red-actions' });
  if (opts.artistPicker) {
    elements['tg-artist-mode'] = artistMode;
    elements['tg-artist-select'] = artistSelect;
    elements['tg-artist-new'] = artistNew;
    elements['artist-name-check'] = artistNameCheck;
    elements['artist-yellow-actions'] = artistYellow;
    elements['artist-red-actions'] = artistRed;
    elements['artist-choose-wrap'] = makeEl({ id: 'artist-choose-wrap' });
    elements['artist-create-wrap'] = makeEl({ id: 'artist-create-wrap' });
    elements['artist-link-wrap'] = makeEl({ id: 'artist-link-wrap' });
    elements['artist-confirm-different'] = makeEl({ id: 'artist-confirm-different', checked: false });
    elements['artist-impersonation-wrap'] = makeEl({ id: 'artist-impersonation-wrap' });
    elements['artist-continue-different'] = makeEl({ id: 'artist-continue-different' });
    elements['artist-submit-review'] = makeEl({ id: 'artist-submit-review' });
  }

  const liveRows = (opts.trackRows || []).slice();
  const albumCount = makeEl({ attrs: { 'data-album-count': '' }, hidden: true });
  const albumCountInput = elements['tg-album-count'];
  albumCountInput.attrs['data-album-count-input'] = '';
  const albumCountGo = makeEl({ attrs: { 'data-album-count-go': '' } });
  const albumProUpgrade = makeEl({ attrs: { 'data-album-pro-upgrade': '' }, hidden: true });
  const albumProConfirm = makeEl({
    attrs: { 'data-album-pro-confirm': '', href: 'plan-confirm.html?plan=pro&interval=month' },
  });
  albumProUpgrade.querySelector = function (sel) {
    if (sel === '[data-album-pro-confirm]') return albumProConfirm;
    return null;
  };
  const albumTracksPanel = makeEl({ attrs: { 'data-album-tracks': '' }, hidden: true });
  const trackList = makeEl({ attrs: { 'data-track-list': '' } });
  trackList.appendChild = function (child) {
    liveRows.push(child);
    this.children.push(child);
    return child;
  };
  trackList.removeChild = function (child) {
    const i = liveRows.indexOf(child);
    if (i !== -1) liveRows.splice(i, 1);
    const j = this.children.indexOf(child);
    if (j !== -1) this.children.splice(j, 1);
    return child;
  };
  trackList.querySelectorAll = function (sel) {
    if (sel === '[data-track-row]') return liveRows;
    return [];
  };
  const addTrackBtn = makeEl({ attrs: { 'data-add-track': '' } });
  const uploadStep = makeEl({ href: 'upload.html', attrs: { href: 'upload.html', class: 'st' } });
  uploadStep.tagName = 'A';
  uploadStep.className = 'st';
  const attestStep = makeEl({ href: 'attest.html', attrs: { href: 'attest.html', class: 'st' } });
  attestStep.tagName = 'A';
  attestStep.className = 'st';
  const reviewStep = makeEl({ href: 'review.html', attrs: { href: 'review.html', class: 'st' } });
  reviewStep.tagName = 'A';
  reviewStep.className = 'st';
  const stepper = makeEl({ attrs: { class: 'stepper' } });
  stepper.className = 'stepper';
  stepper.contains = function () { return true; };

  const heldStore = { master: opts.heldFile || null, picked: opts.heldPicked || null };
  const context = {
    URLSearchParams,
    Promise,
    setTimeout,
    clearTimeout,
    localStorage,
    sessionStorage,
    indexedDB: {
      open: function () {
        const req = {
          result: {
            objectStoreNames: { contains: function () { return true; } },
            createObjectStore: function () {},
            transaction: function () {
              const tx = {
                objectStore: function () {
                  return {
                    put: function (file, key) { heldStore[key] = file; },
                    get: function (key) {
                      const get = { result: heldStore[key] || null };
                      setImmediate(function () {
                        if (typeof get.onsuccess === 'function') get.onsuccess();
                      });
                      return get;
                    },
                  };
                },
              };
              setImmediate(function () {
                if (typeof tx.oncomplete === 'function') tx.oncomplete();
              });
              return tx;
            },
          },
        };
        setImmediate(function () {
          if (typeof req.onupgradeneeded === 'function') req.onupgradeneeded();
          if (typeof req.onsuccess === 'function') req.onsuccess();
        });
        return req;
      },
      deleteDatabase: function () { heldStore.master = null; heldStore.picked = null; },
    },
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      createElement(tag) {
        return makeEl({ id: String(tag || '') });
      },
      querySelectorAll(sel) {
        if (sel === '[data-track-row]') return liveRows;
        if (sel === '[data-type]') return opts.typeLinks || [];
        return [];
      },
      querySelector(sel) {
        if (sel === '[data-store-continue]') return opts.bind === 'review' || opts.bind === 'submitted' ? null : continueBtn;
        if (sel === '[data-store-submit]') return opts.bind === 'review' ? payBtn : null;
        if (sel === '[data-review-title]' || sel === '[data-review-meta]' || sel === '[data-submit-title]') {
          return opts.bind === 'submitted' ? makeEl({}) : null;
        }
        if (sel === '[data-submit-stores]') {
          return opts.bind === 'submitted' ? submitStores : null;
        }
        if (opts.storePick) {
          if (sel === '[data-store-pick]') return storePick;
          if (sel === '[data-store-all]') return storeAll;
          if (sel === '[data-store-customize]') return storeCustomize;
          if (sel === '[data-store-summary]') return storeSummary;
          if (sel === '[data-store-list]' || sel === '[data-edit-stores]') return storeList;
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
        if (sel === '[data-type].on') {
          return {
            getAttribute: function () { return opts.type === 'album' ? 'album' : 'single'; },
          };
        }
        if (sel === '[data-type-toggle]') return makeEl({ attrs: { 'data-type-toggle': '' } });
        if (sel === '[data-track-list]') return trackList;
        if (sel === '[data-add-track]') return addTrackBtn;
        if (sel === '[data-album-count]') return albumCount;
        if (sel === '[data-album-count-go]') return albumCountGo;
        if (sel === '[data-album-count-input]') return albumCountInput;
        if (sel === '[data-album-pro-upgrade]') return albumProUpgrade;
        if (sel === '[data-album-pro-confirm]') return albumProConfirm;
        if (sel === '[data-album-tracks]') return albumTracksPanel;
        if (sel === '[data-album-hint]') return makeEl({ attrs: { 'data-album-hint': '' }, hidden: true });
        if (sel === '[data-single-audio]') return makeEl({ attrs: { 'data-single-audio': '' } });
        if (sel === '[data-language-field]') return languageField;
        if (sel === '[data-lyrics-field]') return lyricsField;
        if (sel === '[data-lyrics-open]') return lyricsOpen;
        if (sel === '[data-lyrics]') return lyrics;
        if (sel === '[data-review-lyrics]') return makeEl({ attrs: { 'data-review-lyrics': '' }, hidden: true });
        if (sel === '[data-review-lyrics-text]') return makeEl({ attrs: { 'data-review-lyrics-text': '' } });
        if (sel === '[data-upload-loader]') return loader;
        if (sel === '[data-upload-loader-step]') return loaderStep;
        if (sel === '[data-upload-loader-fill]') return loaderFill;
        if (sel === '[data-upload-loader-meta]') return loaderMeta;
        if (sel === '[data-instrumental]') return instrumental;
        if (sel === '[data-upload-retry]') return retryBtn;
        if (sel === '[data-upload-retry-wrap]') return retryWrap;
        if (sel === '[data-upload-cancel]') return cancelBtn;
        if (sel === '.stepper') return stepper;
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
      if (String(url).indexOf('/api/me/artists') !== -1) {
        const body = jsonBodyOf({ init: init || {} });
        const created = {
          id: body.id || 'pg-created-1',
          name: body.name || 'Created',
          source: body.action === 'link' ? 'linked' : 'created',
          tonegrid_artist_id: body.tonegrid_artist_id || '',
        };
        if (body.action === 'attach_tonegrid') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, created: created }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ created: created, check: { level: 'green' } }),
        });
      }
      if (String(url).indexOf('/api/tonegrid/stores') !== -1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ stores: opts.catalogStores || [] }),
        });
      }
      if (String(url) === '/api/tonegrid/uploads') {
        const minted = JSON.parse((init && init.body) || '{}');
        const kind = String(minted.kind || 'audio');
        const prefix = kind === 'cover' ? 'covers' : 'audio';
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            object_key: prefix + '/11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-' + (minted.filename || 'file'),
            upload_url: HOP_PUT,
            headers: { 'Content-Type': minted.content_type || 'application/octet-stream' },
            expires_in: 300,
          }),
        });
      }
      if (String(url).indexOf('/api/tonegrid/uploads?key=') === 0) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ url: 'https://hop.test/get?sig=1', object_key: String(url).split('key=')[1] }),
        });
      }
      if (String(url).indexOf('https://hop.test/') === 0) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      }
      if (opts.neverResolveWhen && String(url) === opts.neverResolveWhen) {
        opts._neverHits = (opts._neverHits || 0) + 1;
        if (opts._neverHits >= (opts.neverResolveAfter || 1)) {
          return new Promise(function () {});
        }
      }
      if (opts.hangWhen && String(url) === opts.hangWhen) {
        opts._hangHits = (opts._hangHits || 0) + 1;
        if (opts._hangHits <= (opts.hangCount || 1)) {
          return new Promise(function () {});
        }
      }
      if (opts.rejectWhen && String(url) === opts.rejectWhen) {
        return Promise.reject(new Error(opts.rejectMessage || 'ToneGrid sandbox exploded.'));
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
    location: {
      href: opts.page || 'upload.html',
      search: opts.search != null ? opts.search : (opts.type === 'album' ? '?type=album' : ''),
    },
    window: {},
    confirm: function (message) {
      confirms.push(String(message || ''));
      return opts.confirm !== false;
    },
    URL: {
      createObjectURL: function () { return 'blob:local-preview'; },
      revokeObjectURL: function () {},
    },
    PlaigroundUploadCatalog: require('./upload-catalog'),
  };
  context.window = context;
  context.window.URL = context.URL;
  context.globalThis = context;
  context.window.location = context.location;
  if (opts.catalogTimeoutMs) context.PlaigroundCatalogTimeoutMs = opts.catalogTimeoutMs;
  if (opts.audioTimeoutMs) context.PlaigroundAudioTimeoutMs = opts.audioTimeoutMs;
  vm.runInNewContext(audioAcceptCode, context);
  vm.runInNewContext(storePickCode, context);
  vm.runInNewContext(objectHopCode, context);
  context.PlaigroundAudioAccept = context.PlaigroundAudioAccept || context.window.PlaigroundAudioAccept;
  context.PlaigroundStorePick = context.PlaigroundStorePick || context.window.PlaigroundStorePick;
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
  let convertCalls = 0;
  if (opts.convertHold || opts.countConvert) {
    context.PlaigroundConvertUploadAudio = function (file) {
      convertCalls += 1;
      if (opts.convertHold) return Promise.resolve(opts.convertHold);
      return Promise.resolve(file);
    };
  }
  vm.runInNewContext(artistCheckCode, context);
  if (!context.PlaigroundArtistCheck) {
    context.PlaigroundArtistCheck = require('./lib/artist-check');
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
    confirms,
    cancelBtn,
    localStorage,
    sessionStorage,
    title,
    location: context.location,
    instrumental,
    lyrics,
    lyricsField,
    lyricsOpen,
    languageField,
    loader,
    loaderStep,
    loaderMeta,
    date,
    albumCount,
    albumCountInput,
    albumCountGo,
    albumProUpgrade,
    albumProConfirm,
    albumTracksPanel,
    addTrackBtn,
    liveRows,
    retryBtn,
    retryWrap,
    stepper,
    attestStep,
    reviewStep,
    submitStores,
    storeSummary,
    storePick,
    artist,
    artistMode,
    artistSelect,
    artistNew,
    artistNameCheck,
    artistYellow,
    artistRed,
    artistConfirm: elements['artist-confirm-different'],
    genre,
    language,
    get convertCalls() { return convertCalls; },
    get lastStoreFailure() { return context.PlaigroundLastStoreFailure || null; },
    get heldPicked() { return heldStore.picked || null; },
    get heldMaster() { return heldStore.master || null; },
  };
}

function draftOf(localStorage) {
  return JSON.parse(localStorage.getItem('plaiground.store.draft') || '{}');
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

function makeTrackRow(title, file, attrs) {
  const titleEl = { value: title || '' };
  const input = { files: file ? [file] : [], _plaigroundFile: file };
  const extra = attrs || {};
  return {
    getAttribute(name) {
      return extra[name] == null ? '' : extra[name];
    },
    querySelector(sel) {
      if (sel === '[data-track-title]') return titleEl;
      if (sel === '[data-audio-input]') return input;
      if (sel === '[data-track-lyrics]') return extra.lyricsEl || { value: extra.lyrics || '' };
      return null;
    },
  };
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
  assertAudioKey(audioCall);
  assert.ok(hoppedFile(upload.calls, AUDIO));
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
  assert.strictEqual(draftOf(instrumentalOk.localStorage).lyrics, '');
  assert.strictEqual(instrumentalOk.lyricsField.hidden, true);
  assert.strictEqual(instrumentalOk.location.href, 'attest.html');

  const lyricsPage = load(filledUpload({
    lyrics: '',
    responses: uploadResponses.slice(),
  }));
  assert.strictEqual(lyricsPage.lyricsField.hidden, true);
  lyricsPage.lyricsOpen.listeners.click({ preventDefault() {} });
  assert.strictEqual(lyricsPage.lyricsField.hidden, false, 'click Lyrics must open the textarea');
  lyricsPage.lyrics.value = 'Verse one\nI wrote this tonight';
  if (lyricsPage.lyrics.listeners.input) lyricsPage.lyrics.listeners.input();
  assert.strictEqual(draftOf(lyricsPage.localStorage).lyrics, 'Verse one\nI wrote this tonight');
  lyricsPage.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.strictEqual(draftOf(lyricsPage.localStorage).lyrics, 'Verse one\nI wrote this tonight');
  const lyricsRelease = lyricsPage.calls.find(function (call) { return call.url === '/api/tonegrid/releases'; });
  const lyricsTrack = lyricsPage.calls.find(function (call) { return call.url === '/api/tonegrid/tracks'; });
  assert.ok(lyricsRelease);
  assert.ok(lyricsTrack);
  assert.strictEqual(JSON.parse(lyricsRelease.init.body).lyrics, undefined, 'ToneGrid create/update has no lyrics field');
  assert.strictEqual(JSON.parse(lyricsTrack.init.body).lyrics, undefined, 'ToneGrid create/update has no lyrics field');
  assert.strictEqual(JSON.parse(lyricsTrack.init.body).lyric_text, undefined);

  const lyricsRestore = load(filledUpload({
    draft: { lyrics: 'Saved from the step bar', instrumental: false },
  }));
  assert.strictEqual(lyricsRestore.lyrics.value, 'Saved from the step bar');
  assert.strictEqual(lyricsRestore.lyricsField.hidden, false);

  const albumLyrics = load(filledUpload({
    type: 'album',
    title: 'Night Drive LP',
    file: null,
    trackRows: [
      makeTrackRow('Intro', AUDIO, { lyrics: 'Intro words' }),
    ],
    draft: { type: 'album', album_count: 1 },
    account: {
      plan: 'creator',
      artist: 'Ada Night',
      upload: { allowed: true, album_allowed: true, plan: 'creator' },
    },
    responses: uploadResponses.slice(),
  }));
  albumLyrics.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  const albumDraft = draftOf(albumLyrics.localStorage);
  assert.ok(Array.isArray(albumDraft.tracks));
  assert.strictEqual(albumDraft.tracks[0].lyrics, 'Intro words');

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
      { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [] } },
      { ok: true, status: 201, data: { track: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } } },
      { ok: true, status: 200, data: { audio_status: 'processing' } },
      { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
    ],
  }));
  reuseDraft.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  const reuseTonegrid = reuseDraft.calls.filter(function (call) { return String(call.url).indexOf('/api/tonegrid/') === 0; });
  assert.ok(reuseTonegrid.some(function (call) {
    return call.url === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  }), 'live draft.release_id must GET /api/tonegrid/releases/:id');
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
      { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
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
    d.setDate(d.getDate() + 7);
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }());
  assert.strictEqual(payNoDate.date.type, 'date');
  assert.ok(!payNoDate.date.min, 'native min must not be the 7-day lock');
  assert.strictEqual(payNoDate.date.required, true);
  payNoDate.payBtn.listeners.click({ preventDefault() {} });
  await flush(2);
  assert.strictEqual(payNoDate.status.textContent, 'Release date is required.');
  assert.ok(!payNoDate.calls.some(function (call) { return String(call.url).indexOf('/submit') !== -1; }));

  const yesterday = (function () {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }());
  payNoDate.date.value = yesterday;
  payNoDate.date.listeners.change();
  assert.strictEqual(payNoDate.date.value, yesterday, 'calendar tap before the 7-day minimum must stay visible');
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
      track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      signwell_document_id: 'doc_split_sheet_01',
      release_date: '2026-09-12',
    }),
    responses: [
      { ok: true, status: 200, data: { signed: true, status: 'Completed' } },
      { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
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
      track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      solo_owned_100: true,
      release_date: '2026-09-12',
    }),
    responses: [
      { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
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
      track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      signwell_document_id: 'doc_pending_01',
      release_date: '2026-09-12',
      writers: [
        { name: 'Ada Night', email: 'ada@example.com', share: 50 },
        { name: 'Bea Night', email: 'bea@example.com', share: 50 },
      ],
    }),
    responses: [
      { ok: true, status: 200, data: { signed: false, status: 'Pending' } },
      { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
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
  assert.ok(/Converting MP3 to WAV/.test(mp3Wait.loaderStep.textContent), 'MP3 must show converting while the file is being prepared');
  assert.ok(/take a minute/i.test(mp3Wait.loaderMeta.textContent + ' ' + mp3Wait.status.textContent));
  assert.strictEqual(mp3Wait.loader.hidden, false, 'convert bar stays visible');
  assert.ok(!/Uploading audio/.test(mp3Wait.loaderStep.textContent), 'do not call the convert wait "Uploading audio"');
  audioHold();
  await flush();

  let convertRelease;
  const convertHold = new Promise(function (resolve) { convertRelease = resolve; });
  let audioAfterConvert;
  const holdAudioAfterConvert = new Promise(function (resolve) { audioAfterConvert = resolve; });
  const mp3Phases = load(filledUpload({
    file: { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2048 },
    responses: uploadResponses.slice(),
    convertHold: convertHold,
    holdFirst: holdAudioAfterConvert,
    holdWhen: '/audio',
  }));
  mp3Phases.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(/Converting MP3 to WAV/.test(mp3Phases.loaderStep.textContent));
  assert.ok(/take a minute/i.test(mp3Phases.loaderMeta.textContent + ' ' + mp3Phases.status.textContent));
  assert.ok(!/Uploading audio/.test(mp3Phases.loaderStep.textContent), 'converting must run before the store POST');
  convertRelease();
  await flush();
  assert.ok(/Uploading audio/.test(mp3Phases.loaderStep.textContent + ' ' + mp3Phases.status.textContent), 'after convert, move to uploading');
  assert.ok(!/Converting/.test(mp3Phases.loaderStep.textContent), 'do not keep converting copy after convert finishes');
  audioAfterConvert();
  await flush();

  let wavHold;
  const holdWav = new Promise(function (resolve) { wavHold = resolve; });
  const wavWait = load(filledUpload({
    file: { name: 'night-drive.wav', type: 'audio/wav', size: 2048 },
    responses: uploadResponses.slice(),
    holdFirst: holdWav,
    holdWhen: '/audio',
  }));
  wavWait.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(/Uploading audio/.test(wavWait.loaderStep.textContent + ' ' + wavWait.status.textContent));
  assert.ok(!/Converting/.test(wavWait.loaderStep.textContent + ' ' + wavWait.status.textContent + ' ' + wavWait.loaderMeta.textContent), 'WAV must not say converting');
  wavHold();
  await flush();

  function clickStepper(page, step) {
    const ev = {
      target: step,
      prevented: false,
      stopped: false,
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; },
    };
    page.stepper.listeners.click(ev);
    return ev;
  }

  let attestStartHold;
  const holdAttestStart = new Promise(function (resolve) { attestStartHold = resolve; });
  const attestStarts = load(filledUpload({
    file: { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2048 },
    responses: uploadResponses.slice(),
    holdFirst: holdAttestStart,
    holdWhen: '/audio',
  }));
  const attestStartClick = clickStepper(attestStarts, attestStarts.attestStep);
  assert.strictEqual(attestStartClick.prevented, true, 'Attest must not leave Upload before convert/upload finishes');
  await flush();
  assert.ok(attestStarts.calls.some(function (call) {
    return String(call.url).indexOf('/audio') !== -1;
  }), 'Attest / Next starts convert+store work if it has not started');
  assert.ok(/Converting MP3 to WAV/.test(attestStarts.loaderStep.textContent), 'late Attest click still shows converting');
  assert.strictEqual(attestStarts.loader.hidden, false);
  assert.ok(String(attestStarts.location.href).indexOf('attest.html') === -1);
  assert.ok(String(attestStarts.location.href).indexOf('review.html') === -1);
  attestStartHold();
  await flush();

  let attestHold;
  const holdAttestAudio = new Promise(function (resolve) { attestHold = resolve; });
  const attestInFlight = load(filledUpload({
    file: { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2048 },
    responses: uploadResponses.slice(),
    holdFirst: holdAttestAudio,
    holdWhen: '/audio',
  }));
  attestInFlight.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  const artistsBefore = attestInFlight.calls.filter(function (call) {
    return call.url === '/api/tonegrid/artists';
  }).length;
  const audioBefore = attestInFlight.calls.filter(function (call) {
    return String(call.url).indexOf('/audio') !== -1;
  }).length;
  const stayed = clickStepper(attestInFlight, attestInFlight.attestStep);
  assert.strictEqual(stayed.prevented, true);
  await flush();
  assert.ok(String(attestInFlight.location.href).indexOf('attest.html') === -1, 'in-flight Attest must stay on Upload');
  assert.ok(/Converting MP3 to WAV/.test(attestInFlight.loaderStep.textContent));
  assert.strictEqual(attestInFlight.loader.hidden, false, 'keep the converting bar on the Attest click');
  assert.strictEqual(attestInFlight.calls.filter(function (call) {
    return call.url === '/api/tonegrid/artists';
  }).length, artistsBefore, 'do not drop and restart the in-flight upload');
  assert.strictEqual(attestInFlight.calls.filter(function (call) {
    return String(call.url).indexOf('/audio') !== -1;
  }).length, audioBefore);
  const reviewClick = clickStepper(attestInFlight, attestInFlight.reviewStep);
  assert.strictEqual(reviewClick.prevented, true);
  assert.ok(String(attestInFlight.location.href).indexOf('review.html') === -1, 'do not skip to Review while convert is running');
  attestHold();
  await flush();
  assert.strictEqual(draftOf(attestInFlight.localStorage).audio_attached, true);
  assert.ok(draftOf(attestInFlight.localStorage).audio_name);

  const phoneMp3 = load(filledUpload({
    file: { name: 'voice-memo.mp3', type: 'audio/x-mpeg', size: 2048 },
    responses: uploadResponses.slice(),
  }));
  phoneMp3.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(phoneMp3.calls.some(function (call) {
    return String(call.url).indexOf('/api/tonegrid/') === 0;
  }), 'phone MP3 MIME must not be rejected on the client');

  const mpegName = load(filledUpload({
    file: { name: 'clip.mpeg', type: '', size: 2048 },
    responses: uploadResponses.slice(),
  }));
  mpegName.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(mpegName.calls.some(function (call) {
    return String(call.url).indexOf('/api/tonegrid/') === 0;
  }));

  const m4aBlocked = load(filledUpload({
    file: { name: 'song.m4a', type: 'audio/mp4', size: 2048 },
  }));
  m4aBlocked.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.strictEqual(m4aBlocked.calls.length, 0);
  assert.strictEqual(m4aBlocked.status.textContent, 'Audio must be WAV, FLAC, or MP3.');

  const albumResponses = [
    { ok: true, status: 201, data: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
    { ok: true, status: 201, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
    { ok: true, status: 201, data: { track: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } } },
    { ok: true, status: 200, data: { audio_status: 'processing' } },
    { ok: true, status: 201, data: { track: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } } },
    { ok: true, status: 200, data: { audio_status: 'processing' } },
    { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
  ];
  const album = load(filledUpload({
    type: 'album',
    title: 'Night Drive LP',
    trackRows: [makeTrackRow('Intro', AUDIO), makeTrackRow('Outro', AUDIO)],
    account: {
      plan: 'creator',
      artist: 'Ada Night',
      upload: { allowed: true, album_allowed: true, plan: 'creator' },
    },
    responses: albumResponses.slice(),
  }));
  album.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  const albumTonegrid = album.calls.filter(function (call) { return String(call.url).indexOf('/api/tonegrid/') === 0; });
  const albumRelease = albumTonegrid.find(function (call) { return call.url === '/api/tonegrid/releases'; });
  const albumTracks = albumTonegrid.filter(function (call) { return call.url === '/api/tonegrid/tracks'; });
  assert.ok(albumRelease);
  assert.strictEqual(JSON.parse(albumRelease.init.body).type, 'album');
  assert.strictEqual(JSON.parse(albumRelease.init.body).title, 'Night Drive LP');
  assert.strictEqual(albumTracks.length, 2, 'album must add both tracks to one release');
  assert.strictEqual(JSON.parse(albumTracks[0].init.body).title, 'Intro');
  assert.strictEqual(JSON.parse(albumTracks[0].init.body).position, 1);
  assert.strictEqual(JSON.parse(albumTracks[0].init.body).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.strictEqual(JSON.parse(albumTracks[1].init.body).title, 'Outro');
  assert.strictEqual(JSON.parse(albumTracks[1].init.body).position, 2);
  assert.strictEqual(JSON.parse(albumTracks[1].init.body).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.ok(album.calls.some(function (call) {
    return String(call.url) === '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio';
  }));
  assert.ok(album.calls.some(function (call) {
    return String(call.url) === '/api/tonegrid/tracks/dddddddd-dddd-4ddd-8ddd-dddddddddddd/audio';
  }));
  assert.strictEqual(draftOf(album.localStorage).type, 'album');
  assert.strictEqual(draftOf(album.localStorage).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.strictEqual(album.location.href, 'attest.html');

  const basicAlbum = load(filledUpload({
    type: 'album',
    title: 'Night Drive LP',
    page: 'upload.html?type=album',
    trackRows: [makeTrackRow('Intro', AUDIO), makeTrackRow('Outro', AUDIO)],
    account: {
      plan: 'basic',
      artist: 'Ada Night',
      upload: { allowed: true, album_allowed: false, plan: 'basic' },
    },
    responses: [],
  }));
  await flush();
  assert.strictEqual(basicAlbum.limit.hidden, false);
  assert.strictEqual(basicAlbum.upgrade.hidden, false);
  assert.ok(/Albums are on Creator and Pro/.test(basicAlbum.status.textContent));
  assert.ok(String(basicAlbum.location.href).indexOf('login.html') === -1);
  basicAlbum.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  assert.ok(!basicAlbum.calls.some(function (call) { return String(call.url).indexOf('/api/tonegrid/') === 0; }));
  assert.ok(String(basicAlbum.location.href).indexOf('login.html') === -1);
  assert.ok(String(basicAlbum.location.href).indexOf('attest.html') === -1);

  const albumAfterSingle = load(filledUpload({
    type: 'album',
    title: 'Night Drive LP',
    trackRows: [makeTrackRow('Intro', AUDIO), makeTrackRow('Outro', AUDIO)],
    account: {
      plan: 'creator',
      artist: 'Ada Night',
      tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001'],
      tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccc0001'],
      upload: { allowed: true, album_allowed: true, used: 1, limit: 8, plan: 'creator' },
    },
    responses: albumResponses.slice(),
  }));
  albumAfterSingle.continueBtn.listeners.click({ preventDefault() {} });
  await flush();
  const afterSingleRelease = albumAfterSingle.calls.filter(function (call) { return call.url === '/api/tonegrid/releases'; });
  assert.strictEqual(afterSingleRelease.length, 1, 'new album must not reuse the existing single release');
  assert.strictEqual(JSON.parse(afterSingleRelease[0].init.body).type, 'album');
  assert.notStrictEqual(draftOf(albumAfterSingle.localStorage).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001');

  async function hungCreateTrackTrack2HidesLoader() {
    const hung = load(filledUpload({
      type: 'album',
      title: 'Night Drive LP',
      trackRows: [makeTrackRow('Intro', AUDIO), makeTrackRow('Outro', AUDIO)],
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      catalogTimeoutMs: 40,
      neverResolveWhen: '/api/tonegrid/tracks',
      neverResolveAfter: 2,
      responses: [
        { ok: true, status: 201, data: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
        { ok: true, status: 201, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
        { ok: true, status: 201, data: { track: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
      ],
    }));
    hung.continueBtn.listeners.click({ preventDefault() {} });
    await flush();
    await new Promise(function (resolve) { setTimeout(resolve, 80); });
    await flush();
    assert.strictEqual(hung.loader.hidden, true, 'hung createTrack for track 2 must hide the Working modal');
    assert.ok(/track 2 of 2/i.test(hung.status.textContent + ' ' + hung.loaderStep.textContent), 'error must name track 2 of 2');
    assert.ok(/We could not reach the store|failed/i.test(hung.status.textContent), 'error must include store/network text');
    assert.ok(!/ToneGrid/i.test(hung.status.textContent), 'timeout copy must not name the partner');
    assert.notStrictEqual(hung.continueBtn.getAttribute('aria-busy'), 'true');
    assert.notStrictEqual(hung.continueBtn.getAttribute('aria-disabled'), 'true');
    assert.ok(String(hung.location.href).indexOf('attest.html') === -1, 'must not invent a success');
    assert.strictEqual(draftOf(hung.localStorage).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  }

  async function rejectedAfterReleaseHidesLoader() {
    const rejected = load({
      bind: 'review',
      title: 'Night Drive',
      artist: 'Ada Night',
      releaseDate: '2035-01-15',
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        name: 'Ada Night',
        solo_owned_100: true,
        rights_confirmed: true,
        made_how: 'no_ai',
      },
      rejectWhen: '/api/tonegrid/tracks',
      rejectMessage: 'ToneGrid sandbox exploded.',
      responses: [
        { ok: true, status: 201, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
      ],
    });
    rejected.payBtn.listeners.click({ preventDefault() {} });
    await flush();
    assert.strictEqual(rejected.loader.hidden, true, 'rejected afterRelease must not leave the modal open');
    assert.ok(/the store sandbox exploded|Could not reach catalog/i.test(rejected.status.textContent));
    assert.ok(!/ToneGrid/i.test(rejected.status.textContent), 'rejected copy must not name the partner');
    assert.notStrictEqual(rejected.payBtn.getAttribute('aria-busy'), 'true');
  }

  async function albumRetryKeepsSameRelease() {
    const retry = load(filledUpload({
      type: 'album',
      title: 'Night Drive LP',
      trackRows: [
        makeTrackRow('Intro', AUDIO, { 'data-track-id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'data-audio-uploaded': 'true' }),
        makeTrackRow('Outro', AUDIO),
      ],
      draft: {
        type: 'album',
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        album_count: 2,
        tracks: [
          { title: 'Intro', track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', audio_uploaded: true, position: 1 },
          { title: 'Outro', track_id: '', audio_uploaded: false, position: 2 },
        ],
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: true, status: 201, data: { track: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    retry.continueBtn.listeners.click({ preventDefault() {} });
    await flush();
    const retryTonegrid = retry.calls.filter(function (call) { return String(call.url).indexOf('/api/tonegrid/') === 0; });
    assert.ok(!retryTonegrid.some(function (call) { return call.url === '/api/tonegrid/releases'; }), 'retry must not create a second album');
    assert.ok(!retryTonegrid.some(function (call) { return call.url === '/api/tonegrid/artists'; }));
    const retryTracks = retryTonegrid.filter(function (call) { return call.url === '/api/tonegrid/tracks'; });
    assert.strictEqual(retryTracks.length, 1, 'retry only creates the failed remaining track');
    assert.strictEqual(JSON.parse(retryTracks[0].init.body).position, 2);
    assert.strictEqual(JSON.parse(retryTracks[0].init.body).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    assert.strictEqual(draftOf(retry.localStorage).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    assert.strictEqual(retry.location.href, 'attest.html');
  }

  async function albumCountBeforeAudio() {
    const page = load({
      type: 'album',
      page: 'upload.html?type=album',
      account: {
        plan: 'creator',
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
    });
    await flush();
    assert.strictEqual(page.albumCount.hidden, false, 'album step 1 is the song count');
    assert.strictEqual(page.albumTracksPanel.hidden, true, 'audio rows stay hidden until the count is set');
    assert.strictEqual(page.liveRows.length, 0, 'must not dump two empty audio rows first');
    page.albumCountInput.value = '3';
    page.albumCountGo.listeners.click({ preventDefault() {} });
    await flush();
    assert.strictEqual(page.liveRows.length, 3);
    assert.strictEqual(page.albumCount.hidden, true);
    assert.strictEqual(page.albumTracksPanel.hidden, false);
    assert.strictEqual(draftOf(page.localStorage).album_count, 3);
  }

  async function creatorNineTracksPingsPro() {
    const page = load({
      type: 'album',
      page: 'upload.html?type=album',
      account: {
        plan: 'creator',
        billing_interval: 'month',
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
    });
    await flush();
    page.albumCountInput.value = '9';
    page.albumCountGo.listeners.click({ preventDefault() {} });
    await flush();
    assert.strictEqual(page.liveRows.length, 0, 'Creator cannot start a 9-track album');
    assert.ok(/Pro is \$5 extra/i.test(page.status.textContent));
    assert.ok(/14\.99/.test(page.status.textContent) && /19\.99/.test(page.status.textContent));
    assert.ok(page.albumProConfirm.getAttribute('href').indexOf('plan-confirm.html?plan=pro') !== -1);
    assert.ok(!/data-checkout-plan/.test(page.albumProConfirm.getAttribute('href') || ''));
    assert.strictEqual(page.albumTracksPanel.hidden, true);

    const yearly = load({
      type: 'album',
      account: {
        plan: 'creator',
        billing_interval: 'year',
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
    });
    await flush();
    yearly.albumCountInput.value = '9';
    yearly.albumCountGo.listeners.click({ preventDefault() {} });
    await flush();
    assert.ok(yearly.albumProConfirm.getAttribute('href').indexOf('interval=year') !== -1, 'yearly Creator uses same-interval Pro confirm');
    assert.ok(!/ \$5 /.test(yearly.albumProConfirm.getAttribute('href') || ''));
  }

  async function proAlbumCountUnlimited() {
    const page = load({
      type: 'album',
      account: {
        plan: 'pro',
        upload: { allowed: true, album_allowed: true, plan: 'pro' },
      },
    });
    await flush();
    page.albumCountInput.value = '12';
    page.albumCountGo.listeners.click({ preventDefault() {} });
    await flush();
    assert.strictEqual(page.liveRows.length, 12);
    assert.ok(!/upgrade/i.test(page.status.textContent));
    page.addTrackBtn.listeners.click({ preventDefault() {} });
    assert.strictEqual(page.liveRows.length, 13);
  }

  async function basicAlbumStaysLocked() {
    const page = load({
      type: 'album',
      page: 'upload.html?type=album',
      account: {
        plan: 'basic',
        upload: { allowed: true, album_allowed: false, plan: 'basic' },
      },
    });
    await flush();
    assert.strictEqual(page.albumCount.hidden, true, 'Basic must not see a count step that starts an album');
    assert.strictEqual(page.albumTracksPanel.hidden, true);
    page.albumCountInput.value = '2';
    page.albumCountGo.listeners.click({ preventDefault() {} });
    await flush();
    assert.strictEqual(page.liveRows.length, 0);
    assert.ok(/Albums are on Creator and Pro/.test(page.status.textContent));
  }

  async function draftTrackIdNoFileStillSubmits() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [] } },
        { ok: true, status: 201, data: { track: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(10);
    const submitCalls = page.calls.filter(function (call) {
      return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
    });
    assert.ok(submitCalls.length, 'draft with release_id + track_id and no File still submits');
    assert.ok(!page.calls.some(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    }), 'must not create a second release');
    assert.strictEqual(JSON.parse(page.calls.find(function (call) {
      return call.url === '/api/tonegrid/tracks';
    }).init.body).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function albumUploadedRowIsNotEmpty() {
    const page = load(filledUpload({
      type: 'album',
      title: 'Night Drive LP',
      file: null,
      trackRows: [
        makeTrackRow('Intro', null, {
          'data-track-id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          'data-audio-uploaded': 'true',
        }),
      ],
      draft: {
        type: 'album',
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        artwork_name: 'cover.jpg',
        album_count: 1,
        tracks: [{
          title: 'Intro',
          track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          audio_uploaded: true,
          position: 1,
        }],
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(8);
    assert.notStrictEqual(page.status.textContent, 'Track 1 needs audio.');
    assert.ok(page.location.href === 'attest.html' || !/needs audio/i.test(page.status.textContent));
  }

  async function tonegridZeroTrackErrorRetriesCreate() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: false, status: 400, data: { error: 'please add at least one track' } },
        { ok: true, status: 201, data: { track: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(12);
    const tracks = page.calls.filter(function (call) { return call.url === '/api/tonegrid/tracks'; });
    const submits = page.calls.filter(function (call) {
      return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
    });
    assert.strictEqual(tracks.length, 1, '0-track submit error creates the missing track');
    assert.strictEqual(JSON.parse(tracks[0].init.body).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    assert.ok(submits.length >= 2, 'submit is retried after creating the missing track');
    assert.ok(!page.calls.some(function (call) { return call.url === '/api/tonegrid/releases'; }), 'retry stays on the same release');
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function genuineEmptyStillErrors() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        solo_owned_100: true,
        release_date: '2026-09-12',
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [] } },
      ],
    });
    await flush(8);
    assert.ok(!page.calls.some(function (call) {
      return String(call.url).indexOf('/submit') !== -1;
    }), 'genuine empty must not POST submit');
    assert.ok(!page.calls.some(function (call) { return call.url === '/api/tonegrid/tracks'; }), 'untitled empty must not invent a track');
    assert.ok(/please add at least one track/i.test(page.status.textContent));
    assert.notStrictEqual(page.location.href, 'submitted.html');
  }

  async function titledSingleAfterRecreateCreatesTrack() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: true, status: 200, data: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', tracks: [] } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(12);
    const tracks = page.calls.filter(function (call) { return call.url === '/api/tonegrid/tracks'; });
    const submits = page.calls.filter(function (call) {
      return String(call.url) === '/api/tonegrid/releases/dddddddd-dddd-4ddd-8ddd-dddddddddddd/submit';
    });
    assert.ok(tracks.length, 'titled single after recreate must create a store track');
    assert.strictEqual(JSON.parse(tracks[0].init.body).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.strictEqual(JSON.parse(tracks[0].init.body).title, 'Night Drive');
    assert.ok(submits.length, 'titled single after recreate must submit the new track');
    assert.ok(!/please add at least one track/i.test(page.status.textContent));
    assert.ok(!/no longer on this page/i.test(page.status.textContent));
    assert.strictEqual(draftOf(page.localStorage).track_id, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    assert.strictEqual(draftOf(page.localStorage).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function titledSingleRecoverWhenAudioCannotSend() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        audio_name: 'night-drive.wav',
        release_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: true, status: 200, data: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', tracks: [] } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: false, status: 400, data: { error: 'Please add at least one track before submitting' } },
        { ok: true, status: 201, data: { track: { uuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff' } } },
        { ok: false, status: 400, data: { error: 'Please add at least one track before submitting' } },
      ],
    });
    await flush(12);
    assert.ok(page.calls.some(function (call) { return call.url === '/api/tonegrid/tracks'; }), 'must try to recreate the store track');
    assert.ok(!/no longer on this page|re-attach/i.test(page.status.textContent), 'audio_name means this draft already had audio');
    assert.ok(!/please add at least one track/i.test(page.status.textContent), 'draft audio_name must never show a false no-track line');
    assert.ok(!/could not submit the release/i.test(page.status.textContent), 'missing-track must not become a generic submit fail');
    assert.ok(/could not attach the audio/i.test(page.status.textContent), 'held audio evidence stays a nameless attach error');
    assert.strictEqual(page.retryWrap.hidden, false);
    assert.notStrictEqual(page.location.href, 'submitted.html');
  }

  async function reviewSubmitRecreatesTrackOnFreshRelease() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: false, status: 404, data: { error: 'Release not found.' } },
        { ok: true, status: 201, data: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(16);
    const createCalls = page.calls.filter(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    });
    assert.strictEqual(createCalls.length, 1, 'dead review release must mint one fresh release');
    const track = page.calls.find(function (call) { return call.url === '/api/tonegrid/tracks'; });
    assert.ok(track, 'must create a track on the new release');
    assert.strictEqual(JSON.parse(track.init.body).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.ok(page.calls.some(function (call) {
      return String(call.url) === '/api/tonegrid/releases/dddddddd-dddd-4ddd-8ddd-dddddddddddd/submit';
    }));
    assert.ok(!/please add at least one track/i.test(page.status.textContent));
    assert.strictEqual(draftOf(page.localStorage).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.strictEqual(draftOf(page.localStorage).track_id, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    assert.strictEqual(draftOf(page.localStorage).audio_attached, true);
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function staleReleaseIdRecreatesWithLiveFile() {
    const page = load(filledUpload({
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        release_idempotency_key: 'plaiground-release-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:Night Drive',
        track_idempotency_key: 'plaiground-track-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1',
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: false, status: 404, data: { error: 'release not found' } },
        { ok: true, status: 201, data: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(14);
    assert.ok(page.calls.some(function (call) {
      return call.url === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    }), 'stale id must GET /api/tonegrid/releases/:id');
    const createCalls = page.calls.filter(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    });
    assert.strictEqual(createCalls.length, 1, '404 release must mint one fresh release');
    const key = createCalls[0].init.headers['Idempotency-Key'];
    assert.ok(key);
    assert.notStrictEqual(key, 'plaiground-release-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:Night Drive');
    assert.strictEqual(JSON.parse(createCalls[0].init.body).replace_release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    const track = page.calls.find(function (call) { return call.url === '/api/tonegrid/tracks'; });
    assert.ok(track, 'live File must create a track on the new release');
    assert.strictEqual(JSON.parse(track.init.body).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.strictEqual(draftOf(page.localStorage).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.strictEqual(page.location.href, 'attest.html');
    assert.ok(!/release not found/i.test(page.status.textContent));
  }

  async function liveReleaseIdIsReused() {
    const page = load(filledUpload({
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [] } },
        { ok: true, status: 201, data: { track: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(12);
    assert.ok(page.calls.some(function (call) {
      return call.url === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    }));
    assert.ok(!page.calls.some(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    }), 'live release_id must not create a second release');
    assert.strictEqual(JSON.parse(page.calls.find(function (call) {
      return call.url === '/api/tonegrid/tracks';
    }).init.body).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    assert.strictEqual(draftOf(page.localStorage).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    assert.strictEqual(page.location.href, 'attest.html');
  }

  async function staleAlbumReleaseRecreatesOnce() {
    const page = load(filledUpload({
      type: 'album',
      title: 'Night Drive LP',
      trackRows: [makeTrackRow('Intro', AUDIO), makeTrackRow('Outro', AUDIO)],
      draft: {
        type: 'album',
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        release_idempotency_key: 'plaiground-release-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:Night Drive LP',
        album_count: 2,
        tracks: [
          { title: 'Intro', track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', audio_uploaded: true, position: 1 },
          { title: 'Outro', track_id: '', audio_uploaded: false, position: 2 },
        ],
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: false, status: 404, data: { error: 'Release not found.' } },
        { ok: true, status: 201, data: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 201, data: { track: { uuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(16);
    const createCalls = page.calls.filter(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    });
    assert.strictEqual(createCalls.length, 1, 'stale album release must recreate once');
    assert.strictEqual(JSON.parse(createCalls[0].init.body).type, 'album');
    const tracks = page.calls.filter(function (call) { return call.url === '/api/tonegrid/tracks'; });
    assert.strictEqual(tracks.length, 2);
    assert.strictEqual(JSON.parse(tracks[0].init.body).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.strictEqual(JSON.parse(tracks[1].init.body).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.strictEqual(draftOf(page.localStorage).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.strictEqual(page.location.href, 'attest.html');
    assert.ok(!/release not found/i.test(page.status.textContent));
  }

  async function newTitleDoesNotReuseOtherSongRelease() {
    const mexeu = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const page = load(filledUpload({
      title: 'Night Drive',
      artist: 'Ada Night',
      draft: {
        title: 'mexeu',
        name: 'Ada Night',
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: mexeu,
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        release_idempotency_key: 'plaiground-release-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:mexeu',
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: [mexeu],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: true, status: 201, data: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(14);
    assert.ok(!page.calls.some(function (call) {
      return call.url === '/api/tonegrid/releases/' + mexeu;
    }), 'new title must not open another song release');
    const createCalls = page.calls.filter(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    });
    assert.strictEqual(createCalls.length, 1, 'new title must mint a release for this song');
    assert.strictEqual(JSON.parse(createCalls[0].init.body).title, 'Night Drive');
    assert.strictEqual(JSON.parse(createCalls[0].init.body).replace_release_id, undefined);
    assert.strictEqual(JSON.parse(page.calls.find(function (call) {
      return call.url === '/api/tonegrid/tracks';
    }).init.body).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.strictEqual(draftOf(page.localStorage).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.strictEqual(page.location.href, 'attest.html');
    assert.ok(!/release not found/i.test(page.status.textContent));
  }

  async function staleIdSecond404RecreatesAgain() {
    const page = load(filledUpload({
      draft: {
        title: 'Night Drive',
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: false, status: 404, data: { error: 'Release not found.' } },
        { ok: true, status: 201, data: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } },
        { ok: false, status: 404, data: { error: 'Release not found.' } },
        { ok: true, status: 201, data: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } },
        { ok: true, status: 201, data: { track: { uuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(16);
    const createCalls = page.calls.filter(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    });
    assert.ok(createCalls.length >= 2, 'second 404 must create again instead of locking');
    assert.strictEqual(JSON.parse(page.calls.filter(function (call) {
      return call.url === '/api/tonegrid/tracks';
    }).pop().init.body).release_id, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    assert.strictEqual(draftOf(page.localStorage).release_id, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    assert.strictEqual(page.location.href, 'attest.html');
    assert.ok(!/release not found/i.test(page.status.textContent));
  }

  async function recreateBudgetShowsNamelessRetry() {
    const page = load(filledUpload({
      draft: {
        title: 'Night Drive',
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: false, status: 404, data: { error: 'Release not found.' } },
        { ok: false, status: 404, data: { error: 'Release not found.' } },
        { ok: false, status: 404, data: { error: 'Release not found.' } },
        { ok: false, status: 404, data: { error: 'Release not found.' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(12);
    assert.strictEqual(page.status.textContent, 'Could not create the release. Retry.');
    assert.ok(!/release not found/i.test(page.status.textContent));
    assert.ok(!/ToneGrid|Tonegrid/i.test(page.status.textContent));
    assert.strictEqual(page.retryWrap.hidden, false);
    assert.ok(String(page.location.href).indexOf('attest.html') === -1);
  }

  async function trackReleaseNotFoundIsNotRewritten() {
    const page = load(filledUpload({
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [] } },
        { ok: false, status: 404, data: { error: 'Release not found.' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(14);
    assert.ok(!/Could not create the release/.test(page.status.textContent));
    assert.ok(/release not found/i.test(page.status.textContent));
    assert.ok(!/ToneGrid|Tonegrid/i.test(page.status.textContent));
    assert.ok(String(page.location.href).indexOf('attest.html') === -1);
  }

  async function createPostShowsRealSanitizedError() {
    const page = load(filledUpload({
      draft: {
        title: 'Night Drive',
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: false, status: 404, data: { error: 'Release not found.' } },
        { ok: false, status: 400, data: { error: 'artist_id is required.' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(12);
    assert.strictEqual(page.status.textContent, 'artist_id is required.');
    assert.ok(!/Could not create the release/.test(page.status.textContent));
    assert.ok(!/ToneGrid|Tonegrid/i.test(page.status.textContent));
    assert.ok(String(page.location.href).indexOf('attest.html') === -1);
  }

  async function continuedDeadIdRetriesWithNewKey() {
    const dead = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const page = load(filledUpload({
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: dead,
        release_idempotency_key: 'plaiground-release-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:Night Drive',
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: [dead],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: false, status: 404, data: { error: 'Release not found.' } },
        { ok: true, status: 200, data: { uuid: dead, continued: true } },
        { ok: true, status: 201, data: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(16);
    const createCalls = page.calls.filter(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    });
    assert.ok(createCalls.length >= 2, 'reattached dead id must POST again with a new key');
    assert.notStrictEqual(
      createCalls[0].init.headers['Idempotency-Key'],
      createCalls[1].init.headers['Idempotency-Key']
    );
    assert.strictEqual(JSON.parse(createCalls[0].init.body).replace_release_id, dead);
    assert.strictEqual(JSON.parse(createCalls[1].init.body).replace_release_id, dead);
    assert.strictEqual(draftOf(page.localStorage).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.strictEqual(draftOf(page.localStorage).artist_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.strictEqual(page.location.href, 'attest.html');
    assert.ok(!/release not found/i.test(page.status.textContent));
  }

  async function leftoverMintOnContinueRotatesTrackKey() {
    const leftover = 'plaiground-track-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1';
    const page = load(filledUpload({
      genre: 'African Dancehall',
      language: 'am',
      price: '$0.69',
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        release_idempotency_key: 'plaiground-release-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:Night Drive',
        track_idempotency_key: leftover,
      },
      account: {
        plan: 'basic',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [] } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(16);
    const tracks = page.calls.filter(function (call) { return call.url === '/api/tonegrid/tracks'; });
    assert.ok(tracks.length, 'empty store tracks after leftover mint must POST a new track');
    assert.notStrictEqual(tracks[0].init.headers['Idempotency-Key'], leftover);
    assert.strictEqual(JSON.parse(tracks[0].init.body).language, 'am');
    assert.strictEqual(JSON.parse(tracks[0].init.body).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    assert.ok(!page.calls.some(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    }), 'living leftover release must not mint a second release');
    assert.strictEqual(draftOf(page.localStorage).track_id, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    assert.strictEqual(page.location.href, 'attest.html');
    assert.ok(!/Idempotency-Key|request body|ToneGrid/i.test(page.status.textContent));
  }

  async function basicLeftoverCatalogTrackMintsLikeCreator() {
    const file = { name: 'night-drive.mp3', type: 'audio/mpeg', size: 3 * 1024 * 1024 };
    function runPlan(plan) {
      const leftoverTrack = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const catalogTracks = plan === 'basic'
        ? [leftoverTrack]
        : [leftoverTrack, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
      return load(filledUpload({
        file: file,
        draft: {
          artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        },
        account: {
          plan: plan,
          artist: 'Ada Night',
          tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
          tonegrid_track_ids: catalogTracks,
          upload: {
            allowed: plan !== 'basic',
            used: plan === 'basic' ? 1 : 1,
            limit: plan === 'basic' ? 1 : 8,
            plan: plan,
            album_allowed: plan !== 'basic',
          },
        },
        responses: [
          { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [] } },
          { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
          { ok: true, status: 200, data: { audio_status: 'processing' } },
          { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
        ],
      }));
    }
    const basic = runPlan('basic');
    const creator = runPlan('creator');
    basic.continueBtn.listeners.click({ preventDefault() {} });
    creator.continueBtn.listeners.click({ preventDefault() {} });
    await flush(20);
    function assertSameSend(page, label) {
      const minted = page.calls.filter(function (call) { return call.url === '/api/tonegrid/tracks'; });
      assert.ok(minted.length, label + ' must mint a store track when catalog leftover is not on the store');
      assert.ok(!JSON.parse(minted[0].init.body).track_id, label + ' must not send the leftover catalog track_id');
      const audio = page.calls.filter(function (call) {
        return String(call.url).indexOf('/audio') !== -1;
      });
      assert.ok(audio.length, label + ' must POST after minting');
      audio.forEach(function (call) {
        assert.strictEqual(
          String(call.url),
          '/api/tonegrid/tracks/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/audio',
          label + ' must attach to the new store track, not the leftover catalog id'
        );
        assertAudioKey(call, label);
      });
      assert.ok(hoppedFile(page.calls, file), label + ' must hop the same file Creator hops');
      assert.ok(!page.calls.some(function (call) {
        return String(call.url) === '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio';
      }), label + ' must not POST audio to the leftover catalog track');
      assert.doesNotMatch(String(page.status.textContent || ''), /could not send the audio/i);
      assert.doesNotMatch(String(page.status.textContent || ''), /could not reach the store/i);
      assert.doesNotMatch(String(page.status.textContent || ''), /ToneGrid|InterSpace/i);
      assert.ok(String(page.location.href).indexOf('attest.html') !== -1, label + ' Continue must finish');
    }
    assertSameSend(basic, 'Basic');
    assertSameSend(creator, 'Creator');
  }

  async function leftoverIdempotencyErrorIsNamelessAndRetryRotates() {
    const leftover = 'plaiground-track-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1';
    const reused = 'Idempotency-Key reused with a different request body. Either send the exact same body, or rotate the key.';
    const page = load(filledUpload({
      genre: 'African Dancehall',
      language: 'am',
      price: '$0.69',
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_idempotency_key: leftover,
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [] } },
        { ok: false, status: 422, data: { error: reused } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(16);
    assert.strictEqual(page.status.textContent, 'We could not finish this step.');
    assert.ok(!/Idempotency-Key|request body|rotate the key|ToneGrid/i.test(page.status.textContent));
    assert.strictEqual(page.retryWrap.hidden, false, 'leftover key reuse must show Retry');
    assert.strictEqual(page.loader.hidden, true, 'Working must not hang');
    assert.ok(String(page.location.href).indexOf('attest.html') === -1);
    const first = page.calls.filter(function (call) { return call.url === '/api/tonegrid/tracks'; });
    assert.strictEqual(first.length, 1);
    assert.notStrictEqual(first[0].init.headers['Idempotency-Key'], leftover);
    page.retryBtn.listeners.click({ preventDefault() {} });
    await flush(16);
    const after = page.calls.filter(function (call) { return call.url === '/api/tonegrid/tracks'; });
    assert.ok(after.length > first.length, 'Retry must resend the track create');
    assert.notStrictEqual(after[1].init.headers['Idempotency-Key'], first[0].init.headers['Idempotency-Key']);
    assert.notStrictEqual(after[1].init.headers['Idempotency-Key'], leftover);
    assert.strictEqual(JSON.parse(after[1].init.body).language, 'am');
    assert.ok(!/Idempotency-Key|request body|rotate the key|ToneGrid/i.test(page.status.textContent));
    assert.strictEqual(page.location.href, 'attest.html');
  }

  async function reviewKeepsLivingReleaseForThisTitle() {
    const leftover = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const living = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const track = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        name: 'Ada Night',
        release_id: leftover,
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: true,
        audio_attached: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'basic',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: [living],
        tonegrid_track_ids: [track],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: false, status: 404, data: { error: 'Release not found.' } },
        { ok: true, status: 200, data: { uuid: living, title: 'Night Drive', tracks: [{ uuid: track }] } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(16);
    assert.ok(page.calls.some(function (call) {
      return call.url === '/api/tonegrid/releases/' + leftover;
    }), 'leftover draft id must GET first');
    assert.ok(page.calls.some(function (call) {
      return call.url === '/api/tonegrid/releases/' + living;
    }), 'must open the living catalog release for this title');
    assert.ok(!page.calls.some(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    }), 'must not mint a new empty release');
    assert.ok(page.calls.some(function (call) {
      return String(call.url) === '/api/tonegrid/releases/' + living + '/submit';
    }), 'Basic $0 submit uses the living store release');
    assert.ok(!/no longer on this page|re-attach/i.test(page.status.textContent));
    assert.strictEqual(draftOf(page.localStorage).release_id, living);
    assert.strictEqual(draftOf(page.localStorage).track_id, track);
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function reviewSubmitUsesStoreTracksWithoutFile() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Night Drive', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(12);
    assert.ok(!page.calls.some(function (call) { return call.url === '/api/tonegrid/tracks'; }), 'store GET tracks are enough');
    assert.ok(!page.calls.some(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    }));
    assert.ok(page.calls.some(function (call) {
      return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
    }));
    assert.ok(!/no longer on this page|re-attach/i.test(page.status.textContent));
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function reviewHeldFileUploadsAfterDeadRelease() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      file: AUDIO,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: true,
        audio_attached: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: false, status: 404, data: { error: 'Release not found.' } },
        { ok: true, status: 201, data: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(18);
    assert.strictEqual(page.calls.filter(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    }).length, 1, 'dead id with no living catalog row may mint once');
    assert.ok(page.calls.some(function (call) {
      return String(call.url) === '/api/tonegrid/tracks/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/audio';
    }), 'held File must upload onto the new track');
    assert.ok(page.calls.some(function (call) {
      return String(call.url) === '/api/tonegrid/releases/dddddddd-dddd-4ddd-8ddd-dddddddddddd/submit';
    }));
    assert.ok(!/no longer on this page|re-attach/i.test(page.status.textContent));
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function reviewReattachOnlyWhenNeverHadAudio() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: true, status: 200, data: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', tracks: [] } },
        { ok: false, status: 400, data: { error: 'Could not create the track.' } },
      ],
    });
    await flush(12);
    assert.ok(/no longer on this page|re-attach/i.test(page.status.textContent), 'titled draft that never had audio still re-attaches');
    assert.notStrictEqual(page.location.href, 'submitted.html');
  }

  async function reviewSubmitEnsuresCatalogArtist() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      draft: Object.assign(attestDraft(), {
        title: 'Night Drive',
        name: 'Ada Night',
        genre: 'Pop',
        language: 'en',
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: true, status: 201, data: { uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    page.payBtn.listeners.click({ preventDefault() {} });
    await flush(16);
    assert.strictEqual(draftOf(page.localStorage).artist_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const createCalls = page.calls.filter(function (call) {
      return call.url === '/api/tonegrid/releases' && call.init && call.init.method === 'POST';
    });
    assert.strictEqual(createCalls.length, 1, 'review submit must mint a release after restoring artist_id');
    assert.strictEqual(JSON.parse(createCalls[0].init.body).artist_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.strictEqual(JSON.parse(createCalls[0].init.body).title, 'Night Drive');
    assert.ok(page.calls.some(function (call) { return call.url === '/api/tonegrid/tracks'; }));
    assert.ok(page.calls.some(function (call) {
      return String(call.url) === '/api/tonegrid/releases/dddddddd-dddd-4ddd-8ddd-dddddddddddd/submit';
    }));
    assert.strictEqual(draftOf(page.localStorage).release_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    assert.ok(!/Could not create the release/.test(page.status.textContent));
  }

  async function reviewSubmitDoesNotReconvertHeldMp3() {
    const mp3 = { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2048 };
    const first = load(filledUpload({
      file: mp3,
      countConvert: true,
      responses: uploadResponses.slice(),
    }));
    first.continueBtn.listeners.click({ preventDefault() {} });
    await flush();
    assert.ok(first.convertCalls >= 1, 'Basic MP3 upload converts on Continue');
    assert.ok(first.calls.some(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    }), 'first convert/upload POSTs audio');
    assert.strictEqual(draftOf(first.localStorage).audio_uploaded, true);

    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      file: mp3,
      countConvert: true,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.mp3',
        audio_uploaded: true,
        audio_attached: true,
        audio_converted: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Night Drive', tracks: [] } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(16);
    assert.strictEqual(page.convertCalls, 0, 'Review Submit must not convert again');
    assert.ok(!page.calls.some(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    }), 'Submit reuses the already-uploaded track');
    assert.ok(page.calls.some(function (call) {
      return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
    }));
    assert.ok(!/audio file is required/i.test(page.status.textContent));
    assert.ok(!/Converting MP3 to WAV/.test(page.loaderStep.textContent));
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function reviewSubmitIgnoresAudioRequiredWhenHeld() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      file: { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2048 },
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: true,
        audio_attached: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: false, status: 400, data: { error: 'audio file is required.' } },
      ],
    });
    await flush(16);
    assert.ok(page.calls.some(function (call) {
      return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
    }), 'held/converted audio must still submit');
    assert.ok(!/audio file is required/i.test(page.status.textContent));
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function reviewSubmitSendsHeldWavWhenStoreTracksEmpty() {
    const heldWav = { name: 'night-drive.wav', type: 'audio/wav', size: 4096 };
    const leftoverMp3 = { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2048 };
    function runPlan(plan) {
      return load({
        bind: 'review',
        releaseDate: '2026-09-12',
        countConvert: true,
        convertHold: heldWav,
        file: leftoverMp3,
        heldFile: heldWav,
        draft: Object.assign(attestDraft(), {
          artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          title: 'Night Drive',
          release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          audio_name: 'night-drive.wav',
          audio_uploaded: false,
          audio_attached: true,
          audio_converted: true,
          audio_picked_size: leftoverMp3.size,
          audio_picked_name: leftoverMp3.name,
          solo_owned_100: true,
          release_date: '2026-09-12',
        }),
        account: {
          plan: plan,
          tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
          tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
          upload: { allowed: plan !== 'basic', used: plan === 'basic' ? 1 : 0, limit: plan === 'basic' ? 1 : 8, plan: plan },
        },
        responses: [
          { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Night Drive', tracks: [] } },
          { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
          { ok: true, status: 200, data: { audio_status: 'processing' } },
          { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
        ],
      });
    }
    const basic = runPlan('basic');
    const creator = runPlan('creator');
    await flush(20);
    function assertPlan(page, label) {
      assert.strictEqual(page.convertCalls, 0, label + ' must not convert again');
      const minted = page.calls.filter(function (call) { return call.url === '/api/tonegrid/tracks'; });
      assert.ok(minted.length, label + ' must create a store track when tracks[] is empty');
      assert.strictEqual(JSON.parse(minted[0].init.body).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
      const audio = page.calls.find(function (call) {
        return String(call.url).indexOf('/audio') !== -1;
      });
      assert.ok(audio, label + ' Submit must POST the already-converted WAV when store tracks are empty');
      assert.strictEqual(
        String(audio.url),
        '/api/tonegrid/tracks/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/audio',
        label + ' must attach the WAV to the new track, not the leftover track_id'
      );
      assert.ok(!page.calls.some(function (call) {
        return String(call.url) === '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio';
      }), label + ' must not POST audio to a leftover track_id');
      assertAudioKey(audio, label);
      assert.ok(hoppedFile(page.calls, heldWav), label + ' must hop the held WAV, not the leftover MP3');
      assert.ok(page.calls.some(function (call) {
        return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
      }), label + ' must still submit');
      assert.ok(!/please add at least one track/i.test(page.status.textContent), label + ' must not show a false no-track line');
      assert.ok(!/could not submit the release/i.test(page.status.textContent), label + ' must not mask a miss as a generic submit fail');
      assert.ok(!/ToneGrid/i.test(page.status.textContent));
      assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
      assert.strictEqual(draftOf(page.localStorage).track_id, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    }
    assertPlan(basic, 'Basic');
    assertPlan(creator, 'Creator');
  }

  async function reviewRetryAfterNoTrackResendsSameWav() {
    const heldWav = { name: 'night-drive.wav', type: 'audio/wav', size: 4096 };
    const leftoverMp3 = { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2048 };
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      countConvert: true,
      convertHold: heldWav,
      file: leftoverMp3,
      heldFile: heldWav,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: false,
        audio_attached: true,
        audio_converted: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Night Drive', tracks: [] } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: false, status: 400, data: { error: 'Please add at least one track before submitting' } },
        { ok: true, status: 201, data: { track: { uuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(20);
    assert.ok(!/please add at least one track/i.test(page.status.textContent), 'store no-track must not surface when the WAV is on the draft');
    assert.ok(!/could not submit the release/i.test(page.status.textContent), 'missing-track after attach must not become a generic submit fail');
    if (page.retryWrap.hidden === false) {
      assert.ok(/could not attach the audio/i.test(page.status.textContent), 'leftover no-track after a held WAV must stay nameless');
      page.retryBtn.listeners.click({ preventDefault() {} });
      await flush(16);
    }
    const audio = page.calls.filter(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    });
    assert.ok(audio.length >= 1, 'must POST the held WAV');
    audio.forEach(function (call) { assertAudioKey(call, 'retry'); });
    assert.ok(hoppedFile(page.calls, heldWav), 'Retry must hop the same converted WAV');
    assert.strictEqual(page.convertCalls, 0, 'Retry must not reconvert');
    assert.ok(!/please add at least one track/i.test(page.status.textContent));
    assert.ok(!/could not submit the release/i.test(page.status.textContent));
    assert.ok(!/ToneGrid/i.test(page.status.textContent));
    assert.strictEqual(page.loader.hidden, true, 'Working must not hang');
  }

  async function reviewStore4xxKeepsHeldWavRetry() {
    const heldWav = { name: 'night-drive.wav', type: 'audio/wav', size: 4096 };
    const leftoverMp3 = { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2048 };
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      countConvert: true,
      convertHold: heldWav,
      file: leftoverMp3,
      heldFile: heldWav,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: false,
        audio_attached: true,
        audio_converted: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Night Drive', tracks: [] } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: false, status: 500, data: { error: 'Internal server error' } },
        { ok: true, status: 201, data: { track: { uuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(20);
    assert.ok(/internal server error/i.test(page.status.textContent), 'real store 5xx must show the nameless store error');
    assert.ok(!/please add at least one track/i.test(page.status.textContent));
    assert.ok(!/ToneGrid/i.test(page.status.textContent));
    assert.strictEqual(page.retryWrap.hidden, false, 'real store 5xx must show Retry');
    assert.strictEqual(page.loader.hidden, true, 'Working must not hang');
    assert.strictEqual(page.convertCalls, 0, '5xx must not reconvert');
    const before = page.calls.filter(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    });
    assert.ok(before.length >= 1, 'first Submit must POST the held WAV');
    before.forEach(function (call) { assertAudioKey(call, 'first'); });
    assert.ok(hoppedFile(page.calls, heldWav), 'first hop must be the held WAV');
    page.retryBtn.listeners.click({ preventDefault() {} });
    await flush(20);
    const after = page.calls.filter(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    });
    assert.ok(after.length > before.length, 'Retry must resend the same converted WAV');
    after.forEach(function (call) { assertAudioKey(call, 'retry'); });
    assert.ok(hoppedFile(page.calls, heldWav), 'Retry must hop the same converted WAV');
    assert.strictEqual(page.convertCalls, 0, 'Retry must not convert again');
    assert.ok(!/ToneGrid/i.test(page.status.textContent));
    assert.strictEqual(page.loader.hidden, true, 'Working must not hang after Retry');
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function reviewSubmitReusesConvertedWavWithoutSecondPost() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      file: { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2048 },
      countConvert: true,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.mp3',
        audio_uploaded: false,
        audio_attached: true,
        audio_converted: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Night Drive', tracks: [] } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(16);
    assert.strictEqual(page.convertCalls, 0, 'already-converted WAV must not convert again');
    assert.ok(!page.calls.some(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    }), 'leftover MP3 must not POST audio a second time');
    assert.ok(!page.calls.some(function (call) {
      return String(call.url).indexOf('/convert') !== -1;
    }), 'must not start a second convert');
    assert.ok(page.calls.some(function (call) {
      return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
    }), 'normal song still submits JSON');
    assert.ok(!/request entry too large/i.test(page.status.textContent));
    assert.ok(!/ToneGrid/i.test(page.status.textContent));
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function reviewSubmitMapsSizeCapToHumanLimit() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: true,
        audio_attached: true,
        audio_converted: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: false, status: 413, data: { error: 'request entry too large' } },
      ],
    });
    await flush(16);
    const fail = page.lastStoreFailure || {};
    console.log('store-failure-class', fail.class, 'status', fail.status);
    assert.strictEqual(fail.class, 'platform_payload', '413 must log platform_payload, not timeout');
    assert.strictEqual(fail.status, 413);
    assert.match(String(page.status.textContent || ''), /could not send the audio/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /could not reach the store/i, '413 must not reuse the reach-the-store line');
    assert.doesNotMatch(String(page.status.textContent || ''), /200\s*MB/i, '413 payload errors are not a 200 MB cap');
    assert.doesNotMatch(String(page.status.textContent || ''), /request entry too large/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /ToneGrid/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /Idempotency-Key/i);
    assert.strictEqual(page.retryWrap.hidden, false);
  }

  async function convertedWavOverCapStillPostsWhenOriginalWasNormal() {
    const original = { name: 'night-drive.mp3', type: 'audio/mpeg', size: 5 * 1024 * 1024 };
    const fatWav = { name: 'night-drive.wav', type: 'audio/wav', size: 12 * 1024 * 1024 };
    const basic = load(filledUpload({
      file: original,
      countConvert: true,
      convertHold: fatWav,
      draft: {
        audio_picked_size: original.size,
        audio_picked_name: original.name,
      },
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        upload: { allowed: true, used: 0, limit: 1, plan: 'basic' },
      },
      responses: uploadResponses.slice(),
    }));
    basic.continueBtn.listeners.click({ preventDefault() {} });
    await flush();
    const basicAudio = basic.calls.filter(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    });
    assert.ok(basicAudio.length, 'Basic must POST audio when the picked file was a normal song');
    basicAudio.forEach(function (call) { assertAudioKey(call, 'Basic'); });
    assert.ok(hoppedFile(basic.calls, fatWav), 'hop must be the converted WAV, not the original MP3');
    assert.ok(!hoppedFile(basic.calls, original), 'original MP3 must not replace a hop-ready WAV');
    assert.doesNotMatch(String(basic.status.textContent || ''), /200\s*MB/i, 'converted WAV over the old inbound leftover is not a real cap');
    assert.doesNotMatch(String(basic.status.textContent || ''), /could not reach the store/i);

    const creator = load(filledUpload({
      file: original,
      countConvert: true,
      convertHold: fatWav,
      draft: {
        audio_picked_size: original.size,
        audio_picked_name: original.name,
      },
      account: {
        plan: 'creator',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        upload: { allowed: true, used: 0, limit: 8, plan: 'creator', album_allowed: true },
      },
      responses: uploadResponses.slice(),
    }));
    creator.continueBtn.listeners.click({ preventDefault() {} });
    await flush();
    const creatorAudio = creator.calls.filter(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    });
    assert.ok(creatorAudio.length, 'Creator must POST the same converted WAV when it is over the old inbound leftover');
    creatorAudio.forEach(function (call) { assertAudioKey(call, 'Creator'); });
    assert.ok(hoppedFile(creator.calls, fatWav), 'Creator transit hop must be the converted WAV');
    assert.ok(!hoppedFile(creator.calls, original), 'Creator must not swap the hop back to the original MP3');
    assert.doesNotMatch(String(creator.status.textContent || ''), /200\s*MB/i);
    assert.doesNotMatch(String(creator.status.textContent || ''), /could not reach the store/i);
  }

  async function basicDesktopSubmitPostsOriginalWhenWavExceedsPlatform() {
    const original = { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2 * 1024 * 1024 };
    const fatWav = { name: 'night-drive.wav', type: 'audio/wav', size: 8 * 1024 * 1024 };
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      countConvert: true,
      convertHold: fatWav,
      file: original,
      heldFile: fatWav,
      heldPicked: original,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: false,
        audio_attached: true,
        audio_converted: true,
        audio_picked_size: original.size,
        audio_picked_name: original.name,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Night Drive', tracks: [] } },
        { ok: true, status: 201, data: { track: { uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(20);
    const fail = page.lastStoreFailure;
    if (fail) console.log('store-failure-class', fail.class, 'status', fail.status);
    assert.ok(!fail || fail.class !== 'timeout', 'normal song must not die as a hang');
    assert.doesNotMatch(String(page.status.textContent || ''), /could not reach the store/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /ToneGrid/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /Idempotency-Key/i);
    assert.strictEqual(page.convertCalls, 0, 'Submit after convert must not reconvert');
    const audio = page.calls.filter(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    });
    assert.ok(audio.length, 'Basic desktop Submit must attach audio when store tracks are empty');
    audio.forEach(function (call) { assertAudioKey(call, 'Submit'); });
    assert.ok(hoppedFile(page.calls, fatWav), 'Submit must hop the converted WAV, not the original MP3');
    assert.ok(!hoppedFile(page.calls, original), 'Submit must not swap a hop-ready WAV back to MP3');
    assert.ok(page.heldMaster === fatWav, 'converted WAV must stay held');
    assert.ok(page.heldPicked === original || page.heldPicked == null || page.heldPicked === original, 'original pick stays available');
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
    assert.strictEqual(page.loader.hidden, true, 'Working must not hang');
  }

  async function platform413OnFatWavFallsBackToOriginal() {
    const original = { name: 'night-drive.mp3', type: 'audio/mpeg', size: 1024 * 1024 };
    const fatWav = { name: 'night-drive.wav', type: 'audio/wav', size: 8 * 1024 * 1024 };
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      file: original,
      heldFile: fatWav,
      heldPicked: original,
      countConvert: true,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: false,
        audio_attached: true,
        audio_converted: true,
        audio_picked_size: original.size,
        audio_picked_name: original.name,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: false, status: 413, data: { error: 'FUNCTION_PAYLOAD_TOO_LARGE' } },
      ],
    });
    await flush(20);
    const fail = page.lastStoreFailure;
    if (fail) console.log('store-failure-class', fail.class, 'status', fail.status);
    const audio = page.calls.filter(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    });
    assert.ok(audio.length >= 1, 'must POST audio');
    audio.forEach(function (call) { assertAudioKey(call, '413'); });
    assert.ok(hoppedFile(page.calls, fatWav), '413 still hops the converted WAV');
    assert.ok(!hoppedFile(page.calls, original), '413 must not swap the hop back to the original MP3');
    assert.match(String(page.status.textContent || ''), /could not send the audio/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /could not reach the store/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /ToneGrid/i);
    assert.strictEqual(page.convertCalls, 0);
    assert.ok(page.heldMaster === fatWav, 'Retry path must keep the converted WAV');
  }

  function slicedFile(name, type, size) {
    return {
      name: name,
      type: type,
      size: size,
      slice: function (start, end, typeHint) {
        var from = Math.max(0, start || 0);
        var to = end == null ? this.size : Math.min(this.size, end);
        return {
          name: this.name,
          type: typeHint || this.type,
          size: Math.max(0, to - from),
        };
      },
    };
  }

  function audioChunkHeaders(call) {
    return (call && call.init && call.init.headers) || {};
  }

  async function continueChunksOriginalOverHopCap() {
    const original = slicedFile('night-drive.mp3', 'audio/mpeg', 6 * 1024 * 1024);
    const fatWav = { name: 'night-drive.wav', type: 'audio/wav', size: 18 * 1024 * 1024 };
    const page = load(filledUpload({
      file: original,
      heldPicked: original,
      countConvert: true,
      convertHold: fatWav,
      draft: {
        audio_picked_size: original.size,
        audio_picked_name: original.name,
      },
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        upload: { allowed: true, used: 0, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 201, data: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
        { ok: true, status: 201, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
        { ok: true, status: 201, data: { track: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(24);
    const audio = page.calls.filter(function (call) {
      return isAudioAttach(call.url);
    });
    assert.strictEqual(audio.length, 1, 'normal song over the inbound cap must POST one object key');
    audio.forEach(function (call) {
      assertAudioKey(call, 'Continue');
      assert.ok(!audioChunkHeaders(call)['x-plaiground-upload-id'], 'Continue must hop, not chunk');
    });
    assert.ok(hoppedFile(page.calls, fatWav), 'hop PUT must be the converted WAV, not the original MP3');
    assert.ok(!hoppedFile(page.calls, original), 'converted WAV must stay the hop body');
    assert.ok(page.heldMaster === fatWav, 'converted WAV stays held');
    assert.strictEqual(page.convertCalls, 1, 'convert-once still runs once on Continue');
    assert.doesNotMatch(String(page.status.textContent || ''), /could not send the audio/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /could not reach the store/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /ToneGrid|Idempotency-Key/i);
    assert.ok(String(page.location.href).indexOf('attest.html') !== -1, 'Continue must finish after the hop lands');
  }

  async function reviewChunksPickedWavOverHopCap() {
    const wav = slicedFile('night-drive.wav', 'audio/wav', 6 * 1024 * 1024);
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      file: wav,
      heldFile: wav,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: false,
        audio_attached: true,
        audio_converted: true,
        audio_picked_size: wav.size,
        audio_picked_name: wav.name,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(24);
    const audio = page.calls.filter(function (call) {
      return isAudioAttach(call.url);
    });
    assert.strictEqual(audio.length, 1, 'picked WAV over the inbound cap must POST one object key');
    audio.forEach(function (call) { assertAudioKey(call, 'Submit'); });
    assert.ok(hoppedFile(page.calls, wav), 'Submit must hop the picked WAV');
    assert.ok(page.heldMaster === wav, 'picked WAV stays held');
    const fail = page.lastStoreFailure;
    assert.ok(!fail || fail.class !== 'platform_payload', 'hop send must not die as a 413');
    assert.doesNotMatch(String(page.status.textContent || ''), /could not send the audio/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /could not reach the store/i);
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
    assert.strictEqual(page.loader.hidden, true, 'Working must not hang');
  }

  async function reviewRetryResendsSameChunkedFile() {
    const original = slicedFile('night-drive.mp3', 'audio/mpeg', 6 * 1024 * 1024);
    const fatWav = { name: 'night-drive.wav', type: 'audio/wav', size: 18 * 1024 * 1024 };
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      file: original,
      heldFile: fatWav,
      heldPicked: original,
      countConvert: true,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: false,
        audio_attached: true,
        audio_converted: true,
        audio_picked_size: original.size,
        audio_picked_name: original.name,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: false, status: 413, data: { error: 'FUNCTION_PAYLOAD_TOO_LARGE' } },
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(24);
    assert.match(String(page.status.textContent || ''), /could not send the audio/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /could not reach the store/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /ToneGrid|Idempotency-Key|request body/i);
    assert.strictEqual(page.retryWrap.hidden, false, 'failed hop attach must show Retry');
    assert.strictEqual(page.loader.hidden, true, 'Working must not hang');
    assert.strictEqual(page.convertCalls, 0, 'Retry path must not reconvert');
    const before = page.calls.filter(function (call) {
      return isAudioAttach(call.url);
    });
    assert.strictEqual(before.length, 1, 'first Submit must POST one object key');
    before.forEach(function (call) { assertAudioKey(call, 'first'); });
    assert.ok(hoppedFile(page.calls, fatWav), 'first hop must be the converted WAV');
    assert.ok(!hoppedFile(page.calls, original), 'Retry path must not swap the hop back to MP3');
    page.retryBtn.listeners.click({ preventDefault() {} });
    await flush(24);
    const after = page.calls.filter(function (call) {
      return isAudioAttach(call.url);
    });
    assert.ok(after.length > before.length, 'Retry must POST the object key again');
    const retryAudio = after.slice(before.length);
    retryAudio.forEach(function (call) { assertAudioKey(call, 'retry'); });
    assert.ok(page.heldMaster === fatWav, 'converted WAV stays held across Retry');
    assert.strictEqual(page.convertCalls, 0);
    assert.doesNotMatch(String(page.status.textContent || ''), /could not send the audio/i);
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
    assert.strictEqual(page.loader.hidden, true, 'Working must not hang after Retry');
  }

  async function originalOverCapShowsSizeLineOnly() {
    const original = { name: 'night-drive.mp3', type: 'audio/mpeg', size: 210 * 1024 * 1024 };
    const wav = { name: 'night-drive.wav', type: 'audio/wav', size: 4096 };
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      file: original,
      heldFile: wav,
      heldPicked: original,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: false,
        audio_converted: true,
        audio_picked_size: original.size,
        audio_picked_name: original.name,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
      ],
    });
    await flush(16);
    const fail = page.lastStoreFailure;
    if (fail) console.log('store-failure-class', fail.class, 'status', fail.status);
    assert.match(String(page.status.textContent || ''), /200\s*MB/i);
    assert.doesNotMatch(String(page.status.textContent || ''), /could not reach the store/i);
    assert.ok(!page.calls.some(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    }), 'original over the real cap must not POST');
  }

  async function realPickedCapIsSameOnBasicAndCreator() {
    const huge = { name: 'too-big.mp3', type: 'audio/mpeg', size: 201 * 1024 * 1024 };
    function tryPlan(plan) {
      const page = load(filledUpload({
        file: huge,
        account: {
          plan: plan,
          tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          upload: { allowed: true, used: 0, limit: plan === 'basic' ? 1 : 8, plan: plan },
        },
        responses: uploadResponses.slice(),
      }));
      page.continueBtn.listeners.click({ preventDefault() {} });
      return page;
    }
    const basic = tryPlan('basic');
    const creator = tryPlan('creator');
    await flush(4);
    assert.match(String(basic.status.textContent || ''), /200\s*MB/i);
    assert.match(String(creator.status.textContent || ''), /200\s*MB/i);
    assert.ok(!basic.calls.some(function (call) { return String(call.url).indexOf('/audio') !== -1; }));
    assert.ok(!creator.calls.some(function (call) { return String(call.url).indexOf('/audio') !== -1; }));
  }

  async function reviewSubmitDoesNotFalseCapHeldWav() {
    const fatWav = { name: 'night-drive.wav', type: 'audio/wav', size: 12 * 1024 * 1024 };
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      countConvert: true,
      convertHold: fatWav,
      file: fatWav,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: false,
        audio_attached: true,
        audio_converted: true,
        audio_picked_size: 5 * 1024 * 1024,
        audio_picked_name: 'night-drive.mp3',
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(16);
    assert.ok(page.calls.some(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    }), 'Basic Submit still POSTs the held WAV when it was never uploaded');
    assert.ok(page.calls.some(function (call) {
      return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
    }), 'Basic Submit must still go through');
    assert.doesNotMatch(String(page.status.textContent || ''), /200\s*MB/i);
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function leftoverConvertedWavWithoutPickedSizeStillPosts() {
    const fatWav = { name: 'night-drive.wav', type: 'audio/wav', size: 12 * 1024 * 1024 };
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      countConvert: true,
      convertHold: fatWav,
      file: fatWav,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: false,
        audio_attached: true,
        audio_converted: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
        { ok: true, status: 200, data: { status: 'pending', signed: false, signwell_status: 'solo' } },
      ],
    });
    await flush(16);
    assert.ok(page.calls.some(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    }), 'leftover converted WAV without a stored original size must still POST');
    assert.ok(page.calls.some(function (call) {
      return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
    }), 'Basic Submit must still go through when original size was never stored');
    assert.doesNotMatch(String(page.status.textContent || ''), /200\s*MB/i);
    assert.strictEqual(draftOf(page.localStorage).tonegrid_status, 'pending');
  }

  async function reviewRetryResendsHeldWavWithoutReconvert() {
    const heldWav = { name: 'night-drive.wav', type: 'audio/wav', size: 4096 };
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      catalogTimeoutMs: 40,
      hangWhen: '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio',
      hangCount: 4,
      countConvert: true,
      convertHold: heldWav,
      file: heldWav,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: false,
        audio_attached: true,
        audio_converted: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
      ],
    });
    await flush();
    await new Promise(function (resolve) { setTimeout(resolve, 120); });
    await flush();
    assert.strictEqual(page.convertCalls, 0, 'Retry path must not reconvert');
    assert.ok(/could not reach the store/i.test(page.status.textContent));
    assert.ok(!/ToneGrid/i.test(page.status.textContent));
    assert.strictEqual(page.retryWrap.hidden, false);
    assert.strictEqual(page.loader.hidden, true, 'Working must not hang');
    const before = page.calls.filter(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    }).length;
    assert.ok(before >= 1, 'first Submit must POST the held WAV');
    page.retryBtn.listeners.click({ preventDefault() {} });
    await flush();
    await new Promise(function (resolve) { setTimeout(resolve, 120); });
    await flush();
    const after = page.calls.filter(function (call) {
      return String(call.url) === '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio';
    });
    assert.ok(after.length > before, 'Retry must resend the same already-converted WAV');
    assert.strictEqual(page.convertCalls, 0, 'Retry must not convert again');
    assert.ok(!page.calls.some(function (call) { return call.url === '/api/tonegrid/releases'; }), 'Retry must not mint a second release');
  }

  async function reviewSubmitGetHangShowsNamelessRetry() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      catalogTimeoutMs: 40,
      hangWhen: '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      hangCount: 4,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: true,
        audio_attached: true,
        audio_converted: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
    });
    await flush();
    await new Promise(function (resolve) { setTimeout(resolve, 120); });
    await flush();
    assert.ok(/could not reach the store/i.test(page.status.textContent), 'hung GET must use the timeout copy');
    assert.ok(!/ToneGrid/i.test(page.status.textContent));
    assert.strictEqual(page.retryWrap.hidden, false);
    assert.strictEqual(page.loader.hidden, true);
    assert.ok(!page.calls.some(function (call) { return call.url === '/api/tonegrid/releases'; }), 'timeout GET must not mint a second release');
  }

  async function reviewSubmitHangShowsNamelessRetry() {
    const page = load({
      bind: 'review',
      releaseDate: '2026-09-12',
      catalogTimeoutMs: 40,
      hangWhen: '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit',
      hangCount: 4,
      draft: Object.assign(attestDraft(), {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Night Drive',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        audio_name: 'night-drive.wav',
        audio_uploaded: true,
        audio_attached: true,
        solo_owned_100: true,
        release_date: '2026-09-12',
      }),
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
      ],
    });
    await flush();
    await new Promise(function (resolve) { setTimeout(resolve, 120); });
    await flush();
    assert.ok(/could not reach/i.test(page.status.textContent), 'Working must time out');
    assert.ok(!/ToneGrid/i.test(page.status.textContent));
    assert.strictEqual(page.retryWrap.hidden, false, 'timeout must show nameless Retry');
    assert.strictEqual(page.retryBtn.textContent || 'Retry', 'Retry');
    assert.ok(String(page.location.href).indexOf('submitted.html') === -1);
    page.retryBtn.listeners.click({ preventDefault() {} });
    await flush();
    await new Promise(function (resolve) { setTimeout(resolve, 120); });
    await flush();
    const submits = page.calls.filter(function (call) {
      return String(call.url) === '/api/tonegrid/releases/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/submit';
    });
    assert.ok(submits.length >= 2, 'Retry must POST submit again');
    assert.ok(!/ToneGrid/i.test(page.status.textContent));
    assert.strictEqual(page.loader.hidden, true, 'timeout must hide the Working bar');
  }

  async function genuineMissingTitleArtistStillErrors() {
    const noTitle = load(filledUpload({ title: '' }));
    noTitle.continueBtn.listeners.click({ preventDefault() {} });
    assert.strictEqual(noTitle.calls.length, 0);
    assert.strictEqual(noTitle.status.textContent, 'Song title is required.');

    const noArtist = load(filledUpload({ artist: '' }));
    noArtist.continueBtn.listeners.click({ preventDefault() {} });
    assert.strictEqual(noArtist.calls.length, 0);
    assert.ok(/artist/i.test(noArtist.status.textContent));
  }

  async function audioTimeoutRetriesSameTrackThenSucceeds() {
    const page = load(filledUpload({
      catalogTimeoutMs: 40,
      hangWhen: '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio',
      hangCount: 1,
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush();
    await new Promise(function (resolve) { setTimeout(resolve, 80); });
    await flush();
    const audioPosts = page.calls.filter(function (call) {
      return String(call.url) === '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio';
    });
    assert.ok(audioPosts.length >= 2, 'timeout must retry the same audio POST');
    assert.ok(!page.calls.some(function (call) { return call.url === '/api/tonegrid/releases'; }), 'retry must not create a second release');
    assert.ok(!page.calls.some(function (call) { return call.url === '/api/tonegrid/tracks'; }), 'must reuse track_id and not create another track');
    assert.strictEqual(draftOf(page.localStorage).track_id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    assert.strictEqual(draftOf(page.localStorage).release_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    assert.strictEqual(page.location.href, 'attest.html');
    assert.ok(!/ToneGrid/i.test(page.status.textContent));
  }

  async function leftoverMp3RetryResendsHeldWav() {
    const heldWav = { name: 'night-drive.wav', type: 'audio/wav', size: 4096 };
    const page = load(filledUpload({
      catalogTimeoutMs: 40,
      hangWhen: '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio',
      hangCount: 4,
      countConvert: true,
      convertHold: heldWav,
      file: { name: 'night-drive.mp3', type: 'audio/mpeg', size: 2048 },
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush();
    await new Promise(function (resolve) { setTimeout(resolve, 120); });
    await flush();
    assert.strictEqual(page.convertCalls, 1, 'convert once on the first hop');
    assert.ok(/could not reach the store/i.test(page.status.textContent));
    assert.strictEqual(page.retryWrap.hidden, false);
    const before = page.calls.filter(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    }).length;
    page.retryBtn.listeners.click({ preventDefault() {} });
    await flush();
    await new Promise(function (resolve) { setTimeout(resolve, 120); });
    await flush();
    const after = page.calls.filter(function (call) {
      return String(call.url) === '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio';
    });
    assert.ok(after.length > before, 'Retry must resend the held WAV');
    assert.strictEqual(page.convertCalls, 1, 'Retry must not reconvert the leftover MP3');
    assert.ok(!page.calls.some(function (call) { return call.url === '/api/tonegrid/releases'; }));
  }

  async function audioTimeoutStillDownShowsRetry() {
    const page = load(filledUpload({
      catalogTimeoutMs: 40,
      hangWhen: '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio',
      hangCount: 4,
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush();
    await new Promise(function (resolve) { setTimeout(resolve, 120); });
    await flush();
    assert.strictEqual(page.status.textContent, 'We could not reach the store. Try again.');
    assert.ok(!/ToneGrid/i.test(page.status.textContent));
    assert.ok(String(page.location.href).indexOf('attest.html') === -1, 'must not invent a success');
    assert.strictEqual(page.retryWrap.hidden, false, 'must show Retry after store timeout');
    assert.strictEqual(draftOf(page.localStorage).track_id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    const before = page.calls.filter(function (call) {
      return String(call.url).indexOf('/audio') !== -1;
    }).length;
    assert.ok(before >= 2, 'automatic retry must POST audio at least twice');
    page.retryBtn.listeners.click({ preventDefault() {} });
    await flush();
    await new Promise(function (resolve) { setTimeout(resolve, 120); });
    await flush();
    const after = page.calls.filter(function (call) {
      return String(call.url) === '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio';
    });
    assert.ok(after.length > before, 'Retry control must re-POST the same track_id');
    assert.ok(!page.calls.some(function (call) { return call.url === '/api/tonegrid/releases'; }), 'Retry must not create a second release');
    assert.strictEqual(page.status.textContent, 'We could not reach the store. Try again.');
    assert.ok(String(page.location.href).indexOf('attest.html') === -1);
    assert.strictEqual(draftOf(page.localStorage).track_id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  }

  async function audioFakeSuccessImpossible() {
    const page = load(filledUpload({
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        track_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        tonegrid_track_ids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 200, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tracks: [{ uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }] } },
        { ok: false, status: 502, data: { error: 'ToneGrid did not respond. Check your connection and try again.' } },
        { ok: false, status: 502, data: { error: 'ToneGrid did not respond. Check your connection and try again.' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush();
    assert.ok(String(page.location.href).indexOf('attest.html') === -1, 'ok only when response.ok');
    assert.ok(!/ToneGrid/i.test(page.status.textContent), 'partner body must be stripped');
    assert.ok(/could not reach the store|the store did not respond|failed/i.test(page.status.textContent));
    assert.strictEqual(page.retryWrap.hidden, false);
  }

  await audioTimeoutRetriesSameTrackThenSucceeds();
  await leftoverMp3RetryResendsHeldWav();
  await audioTimeoutStillDownShowsRetry();
  await audioFakeSuccessImpossible();
  await draftTrackIdNoFileStillSubmits();
  await albumUploadedRowIsNotEmpty();
  await tonegridZeroTrackErrorRetriesCreate();
  await genuineEmptyStillErrors();
  await titledSingleAfterRecreateCreatesTrack();
  await titledSingleRecoverWhenAudioCannotSend();
  await reviewSubmitRecreatesTrackOnFreshRelease();
  await staleReleaseIdRecreatesWithLiveFile();
  await liveReleaseIdIsReused();
  await staleAlbumReleaseRecreatesOnce();
  await newTitleDoesNotReuseOtherSongRelease();
  await staleIdSecond404RecreatesAgain();
  await recreateBudgetShowsNamelessRetry();
  await trackReleaseNotFoundIsNotRewritten();
  await createPostShowsRealSanitizedError();
  await continuedDeadIdRetriesWithNewKey();
  await leftoverMintOnContinueRotatesTrackKey();
  await basicLeftoverCatalogTrackMintsLikeCreator();
  await leftoverIdempotencyErrorIsNamelessAndRetryRotates();
  await reviewKeepsLivingReleaseForThisTitle();
  await reviewSubmitUsesStoreTracksWithoutFile();
  await reviewHeldFileUploadsAfterDeadRelease();
  await reviewReattachOnlyWhenNeverHadAudio();
  await reviewSubmitEnsuresCatalogArtist();
  await reviewSubmitDoesNotReconvertHeldMp3();
  await reviewSubmitIgnoresAudioRequiredWhenHeld();
  await reviewSubmitSendsHeldWavWhenStoreTracksEmpty();
  await reviewRetryAfterNoTrackResendsSameWav();
  await reviewStore4xxKeepsHeldWavRetry();
  await reviewSubmitReusesConvertedWavWithoutSecondPost();
  await reviewSubmitMapsSizeCapToHumanLimit();
  await convertedWavOverCapStillPostsWhenOriginalWasNormal();
  await basicDesktopSubmitPostsOriginalWhenWavExceedsPlatform();
  await platform413OnFatWavFallsBackToOriginal();
  await continueChunksOriginalOverHopCap();
  await reviewChunksPickedWavOverHopCap();
  await reviewRetryResendsSameChunkedFile();
  await originalOverCapShowsSizeLineOnly();
  await realPickedCapIsSameOnBasicAndCreator();
  await reviewSubmitDoesNotFalseCapHeldWav();
  await leftoverConvertedWavWithoutPickedSizeStillPosts();
  await reviewSubmitHangShowsNamelessRetry();
  await reviewSubmitGetHangShowsNamelessRetry();
  await reviewRetryResendsHeldWavWithoutReconvert();
  await genuineMissingTitleArtistStillErrors();
  await hungCreateTrackTrack2HidesLoader();
  await rejectedAfterReleaseHidesLoader();
  await albumRetryKeepsSameRelease();
  await albumCountBeforeAudio();
  await creatorNineTracksPingsPro();
  await proAlbumCountUnlimited();
  await basicAlbumStaysLocked();

  const catalog55 = [];
  for (let i = 0; i < 55; i += 1) catalog55.push('store-' + i);
  const submittedAll = load({
    bind: 'submitted',
    page: 'submitted.html',
    draft: {
      title: 'Night Drive',
      dsps: catalog55.slice(),
      dsps_all: true,
      dsps_total: 55,
    },
  });
  assert.strictEqual(submittedAll.submitStores.textContent, 'All 55 stores');
  assert.ok(submittedAll.submitStores.textContent.indexOf('164 of 163') === -1);

  const submittedSome = load({
    bind: 'submitted',
    page: 'submitted.html',
    draft: {
      title: 'Night Drive',
      dsps: catalog55.slice(0, 40),
      dsps_all: false,
      dsps_total: 55,
    },
  });
  assert.strictEqual(submittedSome.submitStores.textContent, '40 of 55 stores');

  const submittedLiveCatalog = load({
    bind: 'submitted',
    page: 'submitted.html',
    draft: {
      title: 'Night Drive',
      dsps: catalog55.slice(),
      dsps_all: true,
    },
    catalogStores: catalog55.map(function (slug) { return { slug: slug, name: slug }; }),
  });
  await flush();
  assert.strictEqual(submittedLiveCatalog.submitStores.textContent, 'All 55 stores');
  assert.strictEqual(draftOf(submittedLiveCatalog.localStorage).dsps_total, 55);

  const catalog41 = [];
  for (let i = 0; i < 41; i += 1) catalog41.push('dsp-' + i);
  const submittedLiveOverStale = load({
    bind: 'submitted',
    page: 'submitted.html',
    draft: {
      title: 'Night Drive',
      dsps: catalog55.slice(),
      dsps_all: true,
      dsps_total: 55,
    },
    catalogStores: catalog41.map(function (slug) { return { slug: slug, name: slug }; }),
  });
  await flush();
  assert.strictEqual(submittedLiveOverStale.submitStores.textContent, 'All 41 stores');
  assert.ok(submittedLiveOverStale.submitStores.textContent.indexOf('55') === -1);
  assert.strictEqual(draftOf(submittedLiveOverStale.localStorage).dsps_total, 41);

  const catalog87 = [];
  for (let i = 0; i < 87; i += 1) catalog87.push({ slug: 'live-' + i, name: 'Live ' + i });
  const uploadLiveCatalog = load({
    storePick: true,
    catalogStores: catalog87,
  });
  await flush();
  assert.strictEqual(uploadLiveCatalog.storeSummary.textContent, 'All 87 stores will receive this release.');
  assert.ok(uploadLiveCatalog.storeSummary.textContent.indexOf('55') === -1);
  assert.ok(uploadLiveCatalog.storeSummary.textContent.indexOf('150') === -1);
  assert.strictEqual(draftOf(uploadLiveCatalog.localStorage).dsps_total, 87);

  const reviewLiveCatalog = load({
    bind: 'review',
    page: 'review.html',
    storePick: true,
    catalogStores: catalog87,
    draft: { title: 'Night Drive', dsps_all: true },
  });
  await flush();
  assert.strictEqual(reviewLiveCatalog.storeSummary.textContent, 'All 87 stores will receive this release.');
  assert.ok(reviewLiveCatalog.storeSummary.textContent.indexOf('55') === -1);
  assert.strictEqual(draftOf(reviewLiveCatalog.localStorage).dsps_total, 87);

  const submittedLive87 = load({
    bind: 'submitted',
    page: 'submitted.html',
    draft: { title: 'Night Drive', dsps_all: true },
    catalogStores: catalog87,
  });
  await flush();
  assert.strictEqual(submittedLive87.submitStores.textContent, 'All 87 stores');
  assert.ok(submittedLive87.submitStores.textContent.indexOf('55') === -1);

  const source = fs.readFileSync(path.join(__dirname, 'store-client.js'), 'utf8');
  const uploadHtml = fs.readFileSync(path.join(__dirname, 'upload.html'), 'utf8');
  assert.ok(source.includes('Converting MP3 to WAV'));
  assert.ok(source.includes("return 'Converting to WAV'") || source.includes('Converting to WAV'));
  assert.ok(source.includes('This can take a minute.'));
  assert.ok(source.includes('Uploading audio'));
  assert.ok(source.includes('bindLeaveUploadGuard'));
  assert.ok(source.includes('guardLeaveUpload'));
  assert.ok(source.includes('function cancelInProgressUpload'));
  assert.ok(source.includes('Cancel this upload? This loses the in-progress info.'));
  assert.ok(!source.includes('function uploadCancelHasStarted'));
  assert.ok(source.includes("leaveAfterCancel('upload.html?new=1')") || source.includes("location.href = 'upload.html?new=1'"));
  assert.ok(source.includes("leaveAfterCancel('dashboard.html')") || source.includes("location.href = 'dashboard.html'"), 'Submit Cancel lands on the dashboard');
  assert.ok(source.includes('function cancelInProgressSubmit'));
  assert.ok(/data-upload-cancel/.test(uploadHtml));
  assert.ok(/class="btn btn-ghost btn-sm" data-upload-cancel>Cancel</.test(uploadHtml), 'Cancel is a real secondary button');
  assert.ok(uploadHtml.indexOf('Save and exit') === -1, 'upload must not say Save and exit');
  assert.ok(source.includes('keepUploadBarVisible'));
  assert.ok(fs.readFileSync(path.join(__dirname, 'lib', 'audio-accept.js'), 'utf8').includes("return 'Converting to WAV';"));
  assert.ok(source.includes('Uploading artwork'));
  assert.ok(source.includes('Opening SignWell'));
  assert.ok(source.includes('Audio must be WAV, FLAC, or MP3.'));
  assert.ok(!source.includes('Audio must be WAV or FLAC.'));
  assert.ok(!source.includes('Neon Shadows'));
  assert.ok(!source.includes('Victoria Reyes'));
  assert.ok(!source.includes(['t', 'g', 'k', '_'].join('')));
  assert.ok(source.includes('withCatalogTimeout'));
  assert.ok(source.includes('resolveSubmitTracks'));
  assert.ok(source.includes('createMissingTracks'));
  assert.ok(source.includes('cameThroughUpload'));
  assert.ok(source.includes('audio_attached'));
  assert.ok(source.includes('reattachResult'));
  assert.ok(source.includes('The audio file is no longer on this page.'));
  assert.ok(source.includes('findLivingSongRelease'));
  assert.ok(source.includes('shouldReattach'));
  assert.ok(source.includes('rememberAudioFile'));
  assert.ok(source.includes('heldAudioFile'));
  assert.ok(source.includes('plaiground-held-audio'));
  assert.ok(source.includes('alreadyHasAudio'));
  assert.ok(source.includes('needsAudioUpload'));
  assert.ok(source.includes('failSubmit'));
  assert.ok(source.includes('audio_converted'));
  assert.ok(source.includes('draftHasTrackFile'));
  assert.ok(source.includes('persistHeldAudio'));
  assert.ok(source.includes('isAudioRequiredError'));
  const reviewHtml = fs.readFileSync(path.join(__dirname, 'review.html'), 'utf8');
  assert.ok(/data-upload-cancel>Cancel</.test(reviewHtml), 'Submit review Cancel is a real button');
  assert.ok(reviewHtml.indexOf('Save and exit') === -1, 'Submit review must not say Save and exit');
  assert.ok(reviewHtml.indexOf('id="tg-genre"') !== -1, 'Submit review can change genre');
  assert.ok(reviewHtml.indexOf('id="tg-language"') !== -1, 'Submit review can change language');
  assert.ok(reviewHtml.includes('data-upload-retry'));
  assert.ok(reviewHtml.includes('Retry'));
  assert.ok(!/ToneGrid/.test(reviewHtml.replace(/<script\b[\s\S]*?<\/script>/gi, '')));
  assert.ok(!source.includes('XAI_API_KEY'));
  assert.ok(source.includes('resolveLiveRelease'));
  assert.ok(source.includes('clearDeadReleaseIds'));
  assert.ok(source.includes('ensureCatalogArtist'));
  assert.ok(source.includes('dsps_total'));
  assert.ok(source.includes('formatSubmitted'));
  assert.ok(source.includes('storePickSnapshot'));
  assert.ok(!source.includes('164 of 163'));
  assert.ok(source.includes('createFreshFailed'));
  assert.ok(source.includes('freshReleaseKey'));
  assert.ok(source.includes('freshTrackKey'));
  assert.ok(source.includes('takeIdempotencyKey'));
  assert.ok(source.includes('rotateIdempotencyKeys'));
  assert.ok(source.includes("return 'We could not finish this step.';") || source.includes("'We could not finish this step.'"));
  assert.ok(source.includes('isReleaseMissing'));
  assert.ok(source.includes('Could not create the release. Retry.'));
  assert.ok(source.includes('detachForeignRelease'));
  assert.ok(!source.includes('releaseRecreatedThisSession'));
  assert.ok(!source.includes("error: 'Release not found.'"));
  assert.ok(source.includes('DEFAULT_CATALOG_TIMEOUT_MS'));
  assert.ok(source.includes('AUDIO_POST_TIMEOUT_MS = 90000'));
  assert.ok(source.includes('waitMsForUrl'));
  assert.ok(source.includes('function getJson(url)'));
  assert.ok(/withCatalogTimeout\(function \(\) \{\s*return fetch\(url/.test(source.replace(/\n/g, ' ')) || source.includes('withCatalogTimeout(function ()'));
  assert.ok(source.includes('.catch(function (err)'));
  assert.ok(!source.includes("length < 2) addTrackRow()"));
  assert.ok(uploadHtml.includes('id="tg-lyrics"'));
  assert.ok(uploadHtml.includes('data-lyrics-open'));
  assert.ok(uploadHtml.includes('data-lyrics-field'));
  assert.ok(!uploadHtml.includes('Add lyrics file'));
  assert.ok(source.includes('selectedLyrics'));
  assert.ok(source.includes('openLyricsField'));
  assert.ok(!source.includes('lyric_text'));
  assert.ok(uploadHtml.includes('data-album-count'));
  assert.ok(uploadHtml.includes('data-album-count-go'));
  assert.ok(uploadHtml.includes('plan-confirm.html?plan=pro'));
  assert.ok(!uploadHtml.includes('data-checkout-plan="pro"'), 'album upgrade must not open a second Checkout');
  assert.ok(!/catalog-migrate|catalogMigrate/.test(source + uploadHtml));
  assert.ok(source.includes("return 'We could not reach the store. Try again.';"));
  assert.ok(source.includes("We could not send the audio. Retry."));
  assert.ok(source.includes('function fileForTransitUpload'));
  const transitFn = source.match(/function fileForTransitUpload\(file\) \{[\s\S]*?\n  \}/);
  assert.ok(transitFn, 'fileForTransitUpload must stay a real function');
  assert.ok(!transitFn[0].includes('PLATFORM_AUDIO_BYTES'), 'hop send must not swap a converted WAV back to the original for the old inbound leftover');
  assert.ok(!transitFn[0].includes('pickedOriginalFile'), 'hop send must keep the store file when hop is used');
  assert.ok(source.includes('function hopFile'));
  assert.ok(source.includes("object_key"));
  assert.ok(source.includes("{ object_key: next.object_key }"));
  assert.ok(source.includes('waitMsForUrl(url)'));
  assert.ok(!/function postFile\(send\) \{[\s\S]*?body\.append\('audio'/.test(source), 'Continue/Submit postFile must hop, not append a fat audio body');
  assert.ok(!source.includes("body.append('artwork'"));
  assert.ok(source.includes('PLATFORM_AUDIO_BYTES'));
  assert.ok(source.includes('AUDIO_CHUNK_BYTES'));
  assert.ok(source.includes('function postChunkedAudio'));
  assert.ok(source.includes('x-plaiground-upload-id'));
  assert.ok(source.includes('createTrackOnRelease(ready, { force: true })'));
  assert.ok(source.includes('function platformPayloadCopy'));
  assert.ok(!source.includes('if (isPlatformPayloadError(next, status)) return catalogTimeoutMessage();'));
  assert.ok(!source.includes('ToneGrid did not respond'));
  assert.ok(source.includes('result.ok'));
  assert.ok(source.includes('xhr.status >= 200 && xhr.status < 300'));
  assert.ok(uploadHtml.includes('data-upload-retry'));
  assert.ok(uploadHtml.includes('Retry'));
  assert.ok(!/An album is one ToneGrid/.test(uploadHtml));
  assert.ok(source.includes('function humanErrorText'));
  assert.ok(source.includes("trimmed === '[object Object]'"));
  assert.ok(source.includes('input._plaigroundFile = file'));
  assert.ok(!source.includes("drop.addEventListener('click', function () {\n        if (typeof input.click === 'function') input.click();"));

  async function albumPickedFileSticksWithEmptyMime() {
    const page = load(filledUpload({
      type: 'album',
      page: 'upload.html?type=album',
      account: {
        plan: 'creator',
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
    }));
    page.albumCountInput.value = '4';
    page.albumCountGo.listeners.click({ preventDefault() {} });
    await flush();
    assert.ok(page.liveRows.length >= 1, 'track rows exist so a pick can stick');
    const row = page.liveRows[0];
    const input = row.querySelector('[data-audio-input]');
    const preview = row.querySelector('[data-audio-preview]');
    const nameEl = row.querySelector('[data-audio-name]');
    const drop = row.querySelector('[data-audio-drop]');
    const file = { name: 'my-only.mp3', type: '', size: 4096 };
    input.files = [file];
    if (input.listeners.change) input.listeners.change();
    assert.strictEqual(input._plaigroundFile, file, 'empty MIME must keep the File');
    assert.strictEqual(nameEl.textContent, 'my-only.mp3');
    assert.strictEqual(preview.hidden, false);
    assert.strictEqual(drop.hidden, true);
    const player = row.querySelector('[data-audio-player]');
    assert.ok(player.src, 'local preview must use the picked File');
  }

  async function objectErrorNeverPaintsObjectObject() {
    const page = load(filledUpload({
      draft: {
        artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tonegrid_release_ids: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: false, status: 400, data: { error: { message: 'The store rejected the file.' } } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(12);
    assert.ok(page.status.textContent.indexOf('[object Object]') === -1);
    assert.ok(/store rejected the file/i.test(page.status.textContent));
    assert.ok(String(page.location.href).indexOf('attest.html') === -1, 'must not invent a success');
    assert.strictEqual(page.retryWrap.hidden, false);
  }

  async function continueReachesAttestWhenStoreStepOk() {
    const page = load(filledUpload({
      account: {
        plan: 'creator',
        artist: 'Ada Night',
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(16);
    assert.strictEqual(page.location.href, 'attest.html');
    assert.ok(page.status.textContent.indexOf('[object Object]') === -1);
  }

  async function rosterPickerListsRealArtists() {
    const page = load(filledUpload({
      artistPicker: true,
      account: {
        plan: 'creator',
        artist: 'John ham',
        profile: {
          artists: [
            { id: 'art-1', name: 'Fuvtu', source: 'created', badge: 'PLAIGROUND' },
            { id: 'art-2', name: 'Night Drive', source: 'created' },
            { id: 'mock', name: 'John ham', source: 'created' },
          ],
        },
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
    }));
    await flush();
    const storeSrc = fs.readFileSync(path.join(__dirname, 'store-client.js'), 'utf8');
    assert.ok(storeSrc.indexOf('catalog.bindTypeahead(sel, artists') === -1, 'Creator artist roster must stay a native select');
    const names = page.artistSelect.options.map(function (opt) { return opt.textContent; });
    assert.ok(names.indexOf('Fuvtu') !== -1, 'roster must list a real profile');
    assert.ok(names.indexOf('Night Drive') !== -1);
    assert.ok(names.indexOf('John ham') === -1, 'leftover John ham must not be a picker option');
    page.artistSelect.value = 'art-1';
    page.artistSelect.selectedIndex = page.artistSelect.options.findIndex(function (opt) { return opt.value === 'art-1'; });
    if (page.artistSelect.listeners.change) page.artistSelect.listeners.change();
    assert.strictEqual(page.artistNameCheck.hidden, true, 'existing pick must not run a new-name check');
    assert.strictEqual(page.artist.value, 'Fuvtu', 'Creator artist pick must write the profile name');
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(8);
    assert.ok(page.status.textContent.indexOf('Choose an artist profile') === -1, 'Creator Continue must accept the stuck artist pick');
  }

  async function creatorArtistUuidPickSticks() {
    const page = load(filledUpload({
      artistPicker: true,
      artist: '',
      account: {
        plan: 'creator',
        artist: 'Mamamastermind',
        profile: {
          artists: [
            { uuid: 'uuid-fuvtu', name: 'Fuvtu', source: 'created' },
            { tonegrid_artist_id: 'tg-night', name: 'Night Drive', source: 'created' },
          ],
        },
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
    }));
    await flush();
    const values = page.artistSelect.options.map(function (opt) { return opt.value; });
    assert.ok(values.indexOf('uuid-fuvtu') !== -1, 'Creator roster must use uuid when id is missing');
    assert.ok(values.indexOf('tg-night') !== -1, 'Creator roster must use partner artist id when id is missing');
    page.artistSelect.value = 'tg-night';
    page.artistSelect.selectedIndex = page.artistSelect.options.findIndex(function (opt) { return opt.value === 'tg-night'; });
    if (page.artistSelect.listeners.change) page.artistSelect.listeners.change();
    assert.strictEqual(page.artist.value, 'Night Drive', 'Creator uuid/partner-id pick must stick as the profile name');
  }

  async function createNewArtistPostsLiveNameOnlyAndStaysOnUpload() {
    const leftover = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const liveId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const page = load(filledUpload({
      artistPicker: true,
      artist: '',
      draft: { artist_id: leftover },
      account: {
        plan: 'creator',
        artist: 'Leftover Act',
        tonegrid_artist_id: leftover,
        profile: {
          artists: [{
            id: 'pg-leftover',
            name: 'Leftover Act',
            source: 'created',
            tonegrid_artist_id: leftover,
          }],
        },
        upload: { allowed: true, album_allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: true, status: 201, data: { uuid: liveId } },
        { ok: true, status: 201, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
        { ok: true, status: 201, data: { track: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    await flush();
    page.artistMode.value = 'create';
    if (page.artistMode.listeners.change) page.artistMode.listeners.change();
    page.artistNew.value = 'Neon Nova';
    if (page.artistNew.listeners.input) page.artistNew.listeners.input();
    assert.ok(
      page.artistNameCheck.classList.contains('is-green')
        || /created instantly/i.test(page.artistNameCheck.textContent),
      'green name check must run on create-new'
    );
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(16);
    const artistCall = page.calls.find(function (call) { return call.url === '/api/tonegrid/artists'; });
    assert.ok(artistCall, 'Create new must POST a live store artist');
    const artistBody = JSON.parse(artistCall.init.body);
    assert.strictEqual(artistBody.name, 'Neon Nova');
    assert.ok(!artistBody.artist_id);
    assert.ok(!artistBody.uuid);
    assert.ok(!artistBody.tonegrid_artist_id);
    const releaseCall = page.calls.find(function (call) { return call.url === '/api/tonegrid/releases'; });
    assert.ok(releaseCall, 'release must use the newly created artist id');
    assert.strictEqual(JSON.parse(releaseCall.init.body).artist_id, liveId);
    assert.notStrictEqual(JSON.parse(releaseCall.init.body).artist_id, leftover);
    assert.ok(String(page.location.href).indexOf('artists.html') === -1, 'must not bounce to Artist Profiles');
    assert.strictEqual(page.location.href, 'attest.html');
    assert.strictEqual(draftOf(page.localStorage).artist_id, liveId);
    page.artistMode.value = 'choose';
    if (page.artistMode.listeners.change) page.artistMode.listeners.change();
    const names = page.artistSelect.options.map(function (opt) { return opt.textContent; });
    assert.ok(names.indexOf('Neon Nova') !== -1, 'created artist must appear in Choose artist');
  }

  async function createNewArtistNameCheckGreenYellowRed() {
    const page = load(filledUpload({ artistPicker: true, artist: '' }));
    await flush();
    page.artistMode.value = 'create';
    if (page.artistMode.listeners.change) page.artistMode.listeners.change();
    page.artistNew.value = 'Fuvtu';
    if (page.artistNew.listeners.input) page.artistNew.listeners.input();
    assert.ok(page.artistNameCheck.classList.contains('is-green'));
    assert.strictEqual(page.artistYellow.hidden, true);
    assert.strictEqual(page.artistRed.hidden, true);

    page.artistNew.value = 'Sia';
    if (page.artistNew.listeners.input) page.artistNew.listeners.input();
    assert.ok(page.artistNameCheck.classList.contains('is-yellow'));
    assert.strictEqual(page.artistYellow.hidden, false);
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(8);
    assert.ok(/already exists|different artist/i.test(page.status.textContent));
    assert.ok(!page.calls.some(function (call) { return call.url === '/api/tonegrid/artists'; }), 'yellow without confirm must not POST');

    page.artistNew.value = 'Drake';
    if (page.artistNew.listeners.input) page.artistNew.listeners.input();
    assert.ok(page.artistNameCheck.classList.contains('is-red'));
    assert.strictEqual(page.artistRed.hidden, false);
  }

  async function leftoverArtistTenantErrorIsNamelessAndDropsDeadId() {
    const leftover = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const page = load(filledUpload({
      artistPicker: true,
      artist: '',
      draft: { artist_id: leftover },
      account: {
        plan: 'creator',
        tonegrid_artist_id: leftover,
        upload: { allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: false, status: 404, data: { error: 'artist not found in this tenant' } },
      ],
    }));
    await flush();
    page.artistMode.value = 'create';
    if (page.artistMode.listeners.change) page.artistMode.listeners.change();
    page.artistNew.value = 'Neon Nova';
    if (page.artistNew.listeners.input) page.artistNew.listeners.input();
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(12);
    assert.strictEqual(page.status.textContent, 'We could not create that artist. Try the name again.');
    assert.ok(page.status.textContent.toLowerCase().indexOf('tenant') === -1);
    assert.ok(page.status.textContent.toLowerCase().indexOf('tonegrid') === -1);
    assert.ok(!draftOf(page.localStorage).artist_id, 'dead leftover id must not stay on the draft');
    assert.ok(String(page.location.href).indexOf('attest.html') === -1);
  }

  async function chooseLeftoverArtistIsGoneNotRecovered() {
    const leftover = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const page = load(filledUpload({
      artistPicker: true,
      artist: '',
      account: {
        plan: 'creator',
        artist: 'Leftover Act',
        tonegrid_artist_id: leftover,
        profile: {
          artists: [{
            id: 'pg-leftover',
            name: 'Leftover Act',
            source: 'created',
            tonegrid_artist_id: leftover,
          }],
        },
        upload: { allowed: true, plan: 'creator' },
      },
      responses: [
        { ok: false, status: 404, data: { error: 'artist not found in this tenant' } },
      ],
    }));
    await flush();
    page.artistSelect.value = 'pg-leftover';
    page.artistSelect.selectedIndex = page.artistSelect.options.findIndex(function (opt) { return opt.value === 'pg-leftover'; });
    if (page.artistSelect.listeners.change) page.artistSelect.listeners.change();
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(16);
    const artistCall = page.calls.find(function (call) { return call.url === '/api/tonegrid/artists'; });
    if (artistCall) {
      const artistBody = JSON.parse(artistCall.init.body);
      assert.notStrictEqual(artistBody.artist_id, leftover, 'must not send the leftover store id');
      assert.ok(!artistBody.uuid);
      assert.ok(!artistBody.tonegrid_artist_id);
    }
    const releaseCall = page.calls.find(function (call) { return call.url === '/api/tonegrid/releases'; });
    assert.ok(!releaseCall, 'leftover sandbox artist must not be recovered onto a live release');
    assert.strictEqual(page.status.textContent, 'We could not create that artist. Try the name again.');
    assert.ok(page.status.textContent.toLowerCase().indexOf('tenant') === -1);
    assert.ok(page.status.textContent.toLowerCase().indexOf('tonegrid') === -1);
    assert.ok(!draftOf(page.localStorage).artist_id, 'dead leftover id must not stay on the draft');
    assert.ok(String(page.location.href).indexOf('attest.html') === -1);
  }

  async function basicArtistProfileAutoSelects() {
    const page = load(filledUpload({
      artistPicker: true,
      artist: '',
      account: {
        plan: 'basic',
        artist: 'mexeu mexeu',
        profile: { artists: [{ id: 'art-basic', name: 'mexeu mexeu', source: 'created' }] },
        upload: { allowed: true, album_allowed: false, plan: 'basic' },
      },
    }));
    await flush();
    const names = page.artistSelect.options.map(function (opt) { return opt.textContent; });
    assert.ok(names.indexOf('mexeu mexeu') !== -1, 'Basic roster still lists the one profile');
    assert.strictEqual(page.artistSelect.value, 'art-basic', 'Basic single profile must auto-select');
    assert.strictEqual(page.artist.value, 'mexeu mexeu', 'Basic auto-select must write the profile name');
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(8);
    assert.ok(page.status.textContent.indexOf('Choose an artist profile') === -1, 'Basic Continue must accept the auto-selected profile');
  }

  function cancelDoesNotDeleteCatalog(page) {
    return !page.calls.some(function (call) {
      const method = String((call.init && call.init.method) || 'GET').toUpperCase();
      return method === 'DELETE' || /\/releases\/.+\/(cancel|takedown)/i.test(String(call.url || ''));
    });
  }

  async function cancelClearsDraftAndNextNewReleaseIsBlank() {
    const catalogId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const mid = load({
      title: '',
      artist: '',
      genre: '',
      language: '',
      file: AUDIO,
      sessionDraft: {
        title: 'Mexeu',
        name: 'Ada Night',
        audio_name: 'mexeu.wav',
        audio_attached: true,
        lyrics: 'leftover verse',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        dsps: ['spotify'],
      },
      draft: {
        title: 'Mexeu',
        name: 'Ada Night',
        audio_name: 'mexeu.wav',
        audio_attached: true,
        lyrics: 'leftover verse',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        dsps: ['spotify'],
      },
      account: {
        plan: 'basic',
        artist: 'Ada Night',
        tonegrid_release_ids: [catalogId],
        upload: { allowed: false, used: 1, limit: 1, plan: 'basic' },
      },
    });
    assert.strictEqual(mid.title.value, 'Mexeu', 'mid-upload leftover draft still preloads until Cancel');
    assert.strictEqual(draftOf(mid.localStorage).title, 'Mexeu');
    mid.cancelBtn.listeners.click({ preventDefault() {} });
    assert.strictEqual(mid.confirms[0], 'Cancel this upload? This loses the in-progress info.');
    assert.strictEqual(mid.localStorage.getItem('plaiground.store.draft'), null, 'Cancel clears the leftover draft');
    assert.strictEqual(mid.sessionStorage.getItem('plaiground.store.draft'), null, 'Cancel clears the session draft');
    assert.ok(String(mid.location.href).indexOf('upload.html?new=1') !== -1, 'Cancel reopens a blank New release');
    assert.ok(cancelDoesNotDeleteCatalog(mid), 'Cancel must not delete existing catalog releases');
    assert.deepStrictEqual(mid.calls.filter(function (call) {
      return String((call.init && call.init.method) || '').toUpperCase() === 'DELETE';
    }), []);

    const next = load({
      search: '?new=1',
      title: '',
      artist: '',
      genre: '',
      language: '',
      draft: {
        title: 'Mexeu',
        audio_name: 'mexeu.wav',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
      account: {
        plan: 'basic',
        artist: 'Ada Night',
        tonegrid_release_ids: [catalogId],
        upload: { allowed: true, used: 1, limit: 1, plan: 'basic' },
      },
    });
    const nextDraft = draftOf(next.localStorage);
    assert.ok(!nextDraft.title && !nextDraft.audio_name && !nextDraft.release_id && !nextDraft.lyrics, 'next New release must not keep the last song');
    assert.strictEqual(next.title.value, '', 'next New release opens blank');
    assert.strictEqual(next.genre.value, '');
    assert.strictEqual(next.language.value, '');
    assert.ok(cancelDoesNotDeleteCatalog(next), 'blank New release must not delete catalog songs');

    const keep = load({
      title: 'Mexeu',
      draft: { title: 'Mexeu', release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      confirm: false,
    });
    keep.cancelBtn.listeners.click({ preventDefault() {} });
    assert.strictEqual(keep.confirms[0], 'Cancel this upload? This loses the in-progress info.');
    assert.strictEqual(draftOf(keep.localStorage).title, 'Mexeu', 'dismissing Cancel keeps the in-progress form');
    assert.ok(String(keep.location.href).indexOf('upload.html?new=1') === -1);

    const empty = load({ title: '', file: null });
    empty.cancelBtn.listeners.click({ preventDefault() {} });
    assert.strictEqual(empty.confirms.length, 1, 'first Cancel tap always confirms before drop');
    assert.strictEqual(empty.confirms[0], 'Cancel this upload? This loses the in-progress info.');
    assert.strictEqual(empty.localStorage.getItem('plaiground.store.draft'), null);
    assert.ok(String(empty.location.href).indexOf('upload.html?new=1') !== -1);
  }

  async function cancelOnSubmitReviewLandsOnDashboard() {
    const review = load({
      bind: 'review',
      page: 'review.html',
      title: 'Mexeu',
      draft: {
        title: 'Mexeu',
        name: 'Ada Night',
        genre: 'Afrobeats',
        language: 'en',
        release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        lyrics: 'leftover verse',
      },
    });
    assert.strictEqual(draftOf(review.localStorage).title, 'Mexeu');
    review.cancelBtn.listeners.click({ preventDefault() {} });
    assert.strictEqual(review.confirms[0], 'Cancel this upload? This loses the in-progress info.');
    assert.strictEqual(review.localStorage.getItem('plaiground.store.draft'), null, 'Submit Cancel clears the leftover draft');
    assert.strictEqual(review.sessionStorage.getItem('plaiground.store.draft'), null, 'Submit Cancel clears the session draft');
    assert.ok(String(review.location.href).indexOf('dashboard.html') !== -1, 'Submit Cancel lands on the signed-in dashboard');
    assert.ok(String(review.location.href).indexOf('upload.html?new=1') === -1, 'Submit Cancel is not New release Cancel');
    assert.ok(cancelDoesNotDeleteCatalog(review), 'Submit Cancel must not delete existing catalog releases');

    const keep = load({
      bind: 'review',
      page: 'review.html',
      title: 'Mexeu',
      draft: { title: 'Mexeu', release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      confirm: false,
    });
    keep.cancelBtn.listeners.click({ preventDefault() {} });
    assert.strictEqual(keep.confirms[0], 'Cancel this upload? This loses the in-progress info.');
    assert.strictEqual(draftOf(keep.localStorage).title, 'Mexeu', 'dismissing Submit Cancel keeps the in-progress form');
    assert.ok(String(keep.location.href).indexOf('dashboard.html') === -1);
  }

  async function basicGenreLanguagePickSticks() {
    const page = load(filledUpload({
      genre: '',
      language: '',
      account: {
        plan: 'basic',
        artist: 'mexeu mexeu',
        profile: { artists: [{ id: 'art-1', name: 'mexeu mexeu', source: 'created' }] },
        upload: { allowed: true, album_allowed: false, plan: 'basic' },
      },
    }));
    await flush();
    const genreInput = makeEl({ className: 'typeahead-input', value: 'Afrobeats' });
    const languageInput = makeEl({ className: 'typeahead-input', value: 'English' });
    const genreField = makeEl({});
    const languageField = makeEl({});
    genreField.querySelector = function (sel) {
      return sel === '.typeahead-input' ? genreInput : null;
    };
    languageField.querySelector = function (sel) {
      return sel === '.typeahead-input' ? languageInput : null;
    };
    page.genre.parentNode = genreField;
    page.language.parentNode = languageField;
    page.genre.value = '';
    page.language.value = '';
    page.genre.setAttribute('data-typeahead', 'on');
    page.language.setAttribute('data-typeahead', 'on');
    if (page.genre.listeners.change) page.genre.listeners.change();
    if (page.language.listeners.change) page.language.listeners.change();
    const draft = draftOf(page.localStorage);
    assert.strictEqual(draft.genre, 'Afrobeats', 'Basic genre pick from typeahead must stick');
    assert.strictEqual(draft.language, 'en', 'Basic language pick from typeahead must stick as the catalog code');
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(8);
    assert.ok(page.status.textContent.indexOf('Genre is required') === -1, 'Basic Continue must accept the stuck genre pick');
    assert.ok(page.status.textContent.indexOf('Language is required') === -1, 'Basic Continue must accept the stuck language pick');
  }

  async function basicHopAudioPostWaitsForStoreHop() {
    const hold = new Promise(function (resolve) { setTimeout(resolve, 80); });
    const page = load(filledUpload({
      account: {
        plan: 'basic',
        artist: 'Ada Night',
        upload: { allowed: true, used: 0, limit: 1, plan: 'basic' },
      },
      catalogTimeoutMs: 40,
      audioTimeoutMs: 300,
      holdWhen: '/api/tonegrid/tracks/cccccccc-cccc-4ccc-8ccc-cccccccccccc/audio',
      holdFirst: hold,
      responses: [
        { ok: true, status: 201, data: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
        { ok: true, status: 201, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
        { ok: true, status: 201, data: { track: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } } },
        { ok: true, status: 200, data: { audio_status: 'processing' } },
        { ok: true, status: 200, data: { artwork_url: 'https://cdn.example/cover.jpg' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(16);
    await new Promise(function (resolve) { setTimeout(resolve, 160); });
    await flush(16);
    const audio = page.calls.filter(function (call) { return isAudioAttach(call.url); });
    assert.ok(audio.length, 'Basic Continue must POST the hopped object key');
    audio.forEach(function (call) { assertAudioKey(call, 'Basic hop'); });
    assert.strictEqual(audio.length, 1, 'a store hop slower than catalog timeout must not abort and retry as unreachable');
    assert.doesNotMatch(String(page.status.textContent || ''), /could not reach the store/i);
    assert.ok(String(page.location.href).indexOf('attest.html') !== -1, 'slow store hop must still finish Continue');
  }

  async function creatorHopWavForwardsAndStore502IsNotSuccess() {
    const wav = { name: 'night-drive.wav', type: 'audio/wav', size: 12 * 1024 * 1024 };
    const page = load(filledUpload({
      file: wav,
      account: {
        plan: 'creator',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        upload: { allowed: true, used: 0, limit: 8, plan: 'creator', album_allowed: true },
      },
      responses: [
        { ok: true, status: 201, data: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
        { ok: true, status: 201, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
        { ok: true, status: 201, data: { track: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } } },
        { ok: false, status: 502, timedOut: true, data: { error: 'We could not reach the store. Try again.' } },
        { ok: false, status: 502, timedOut: true, data: { error: 'We could not reach the store. Try again.' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(20);
    const audio = page.calls.filter(function (call) { return isAudioAttach(call.url); });
    assert.ok(audio.length, 'Creator Continue must POST the hop key');
    audio.forEach(function (call) { assertAudioKey(call, 'Creator 502'); });
    assert.ok(hoppedFile(page.calls, wav), 'Creator Continue hops the WAV the store should receive');
    assert.ok(String(page.location.href).indexOf('attest.html') === -1, 'Creator store 502 is not a fake success');
    assert.match(String(page.status.textContent || ''), /could not reach the store/i);
    assert.ok(!/ToneGrid|retry the hop|try a smaller file/i.test(String(page.status.textContent || '')));
  }

  async function hopConvertedWavStore502IsNotSuccess() {
    const original = { name: 'night-drive.mp3', type: 'audio/mpeg', size: 5 * 1024 * 1024 };
    const wav = { name: 'night-drive.wav', type: 'audio/wav', size: 12 * 1024 * 1024 };
    const page = load(filledUpload({
      file: original,
      countConvert: true,
      convertHold: wav,
      draft: {
        audio_picked_size: original.size,
        audio_picked_name: original.name,
      },
      account: {
        plan: 'basic',
        tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        upload: { allowed: true, used: 0, limit: 1, plan: 'basic' },
      },
      responses: [
        { ok: true, status: 201, data: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
        { ok: true, status: 201, data: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
        { ok: true, status: 201, data: { track: { uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } } },
        { ok: false, status: 502, timedOut: true, data: { error: 'We could not reach the store. Try again.' } },
        { ok: false, status: 502, timedOut: true, data: { error: 'We could not reach the store. Try again.' } },
      ],
    }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush(20);
    const audio = page.calls.filter(function (call) { return isAudioAttach(call.url); });
    assert.ok(audio.length, 'must POST the hop key');
    audio.forEach(function (call) { assertAudioKey(call, '502'); });
    assert.ok(hoppedFile(page.calls, wav), '502 path still hopped the converted WAV');
    assert.ok(!hoppedFile(page.calls, original), '502 must not be "fixed" by swapping to the original MP3');
    assert.ok(String(page.location.href).indexOf('attest.html') === -1, '502 is not a fake success');
    assert.match(String(page.status.textContent || ''), /could not reach the store/i);
  }

  async function fatSongNeverHitsVercelAudioBody() {
    const fat = { name: 'fat-master.wav', type: 'audio/wav', size: 7 * 1024 * 1024 };
    const page = load(filledUpload({ file: fat, responses: uploadResponses.slice() }));
    page.continueBtn.listeners.click({ preventDefault() {} });
    await flush();
    const audio = page.calls.filter(function (call) { return isAudioAttach(call.url); });
    assert.ok(audio.length, 'fat song still attaches');
    audio.forEach(function (call) {
      assertAudioKey(call, 'fat');
      assert.ok(String(call.init.body || '').length < 400, 'Vercel audio POST body stays a tiny object key');
    });
    assert.ok(hoppedFile(page.calls, fat), '6-8 MB file PUTs to the hop URL');
    assert.ok(!page.calls.some(function (call) {
      return isAudioAttach(call.url) && call.init && call.init.body && call.init.body.parts;
    }), 'fat file must not go through a Vercel multipart audio POST');
    assert.ok(draftOf(page.localStorage).artwork_object_key.indexOf('covers/') === 0, 'covers persist via object key');
  }

  await basicHopAudioPostWaitsForStoreHop();
  await creatorHopWavForwardsAndStore502IsNotSuccess();
  await hopConvertedWavStore502IsNotSuccess();
  await fatSongNeverHitsVercelAudioBody();
  await albumPickedFileSticksWithEmptyMime();
  await objectErrorNeverPaintsObjectObject();
  await continueReachesAttestWhenStoreStepOk();
  await rosterPickerListsRealArtists();
  await creatorArtistUuidPickSticks();
  await basicArtistProfileAutoSelects();
  await createNewArtistPostsLiveNameOnlyAndStaysOnUpload();
  await createNewArtistNameCheckGreenYellowRed();
  await leftoverArtistTenantErrorIsNamelessAndDropsDeadId();
  await chooseLeftoverArtistIsGoneNotRecovered();
  await basicGenreLanguagePickSticks();
  await cancelClearsDraftAndNextNewReleaseIsBlank();
  await cancelOnSubmitReviewLandsOnDashboard();

  console.log('tonegrid.client.test.js ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
