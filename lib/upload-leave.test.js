'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const leave = require('./upload-leave');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

function classList() {
  const tokens = Object.create(null);
  return {
    tokens,
    add(name) { tokens[name] = true; },
    remove(name) { delete tokens[name]; },
    toggle(name, force) {
      if (force === false) delete tokens[name];
      else if (force) tokens[name] = true;
      else if (tokens[name]) delete tokens[name];
      else tokens[name] = true;
    },
    contains(name) { return Boolean(tokens[name]); },
  };
}

function el(opts) {
  opts = opts || {};
  const node = {
    id: opts.id || '',
    tagName: opts.tagName || 'DIV',
    type: opts.type || '',
    name: opts.name || '',
    value: opts.value != null ? opts.value : '',
    checked: Boolean(opts.checked),
    hidden: Boolean(opts.hidden),
    selectedIndex: opts.selectedIndex != null ? opts.selectedIndex : 0,
    options: opts.options || [{ value: '', textContent: '' }],
    textContent: opts.textContent != null ? opts.textContent : '',
    files: opts.files || [],
    _plaigroundFile: opts.file || null,
    src: opts.src || '',
    children: opts.children || [],
    attrs: Object.assign({}, opts.attrs || {}),
    listeners: {},
    captureListeners: {},
    classList: classList(),
    paused: true,
    setAttribute(name, value) { node.attrs[name] = String(value); },
    getAttribute(name) { return node.attrs[name] == null ? null : node.attrs[name]; },
    removeAttribute(name) {
      delete node.attrs[name];
      if (name === 'src') node.src = '';
    },
    addEventListener(type, fn, capture) {
      if (capture === true) node.captureListeners[type] = fn;
      else node.listeners[type] = fn;
    },
    click(event) {
      const ev = event || { preventDefault() {}, stopImmediatePropagation() {}, stopPropagation() {} };
      if (typeof node.captureListeners.click === 'function') node.captureListeners.click(ev);
      if (ev._stopped) return;
      if (typeof node.listeners.click === 'function') node.listeners.click(ev);
    },
    pause() { node.paused = true; },
    load() {},
    querySelector(sel) {
      return node.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll(sel) {
      const out = [];
      function walk(item) {
        if (!item) return;
        if (matches(item, sel)) out.push(item);
        (item.children || []).forEach(walk);
      }
      (node.children || []).forEach(walk);
      return out;
    },
  };
  if (opts.on) node.classList.add('on');
  if (opts.attrs) Object.keys(opts.attrs).forEach((key) => node.setAttribute(key, opts.attrs[key]));
  return node;
}

function matches(item, sel) {
  if (!item) return false;
  if (sel === '[data-upload-cancel]') return item.attrs && item.attrs['data-upload-cancel'] != null;
  if (sel === '[data-upload-start-over]') return item.attrs && item.attrs['data-upload-start-over'] != null;
  if (sel === '[data-audio-drop]') return item.attrs && item.attrs['data-audio-drop'] != null;
  if (sel === '[data-audio-input]') return item.attrs && item.attrs['data-audio-input'] != null;
  if (sel === '[data-audio-preview]') return item.attrs && item.attrs['data-audio-preview'] != null;
  if (sel === '[data-audio-preview-hint]') return item.attrs && item.attrs['data-audio-preview-hint'] != null;
  if (sel === '[data-audio-name]') return item.attrs && item.attrs['data-audio-name'] != null;
  if (sel === '[data-audio-meta]') return item.attrs && item.attrs['data-audio-meta'] != null;
  if (sel === '[data-audio-player]') return item.attrs && item.attrs['data-audio-player'] != null;
  if (sel === '[data-audio-play]') return item.attrs && item.attrs['data-audio-play'] != null;
  if (sel === '[data-art-input]') return item.attrs && item.attrs['data-art-input'] != null;
  if (sel === '[data-art-meta]') return item.attrs && item.attrs['data-art-meta'] != null;
  if (sel === '[data-lyrics-field]') return item.attrs && item.attrs['data-lyrics-field'] != null;
  if (sel === '[data-lyrics-open]') return item.attrs && item.attrs['data-lyrics-open'] != null;
  if (sel === '[data-language-field]') return item.attrs && item.attrs['data-language-field'] != null;
  if (sel === '[data-explicit-toggle]') return item.attrs && item.attrs['data-explicit-toggle'] != null;
  if (sel === '[data-explicit]') return item.attrs && item.attrs['data-explicit'] != null;
  if (sel === '[data-explicit="true"]') return item.attrs && item.attrs['data-explicit'] === 'true';
  if (sel === '[data-explicit="false"]') return item.attrs && item.attrs['data-explicit'] === 'false';
  if (sel === '[data-store-all]') return item.attrs && item.attrs['data-store-all'] != null;
  if (sel === '[data-store-list]') return item.attrs && item.attrs['data-store-list'] != null;
  if (sel === '[data-store-summary]') return item.attrs && item.attrs['data-store-summary'] != null;
  if (sel === '[data-upload-retry-wrap]') return item.attrs && item.attrs['data-upload-retry-wrap'] != null;
  if (sel === '[data-upload-loader]') return item.attrs && item.attrs['data-upload-loader'] != null;
  if (sel === '[data-album-tracks]') return item.attrs && item.attrs['data-album-tracks'] != null;
  if (sel === '[data-track-list]') return item.attrs && item.attrs['data-track-list'] != null;
  if (sel === '[data-store-continue]') return item.attrs && item.attrs['data-store-continue'] != null;
  if (sel === '.typeahead-input') return item.classList && item.classList.contains('typeahead-input');
  return false;
}

function storage() {
  const data = Object.create(null);
  return {
    data,
    getItem(key) { return data[key] == null ? null : data[key]; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
  };
}

function makePage(opts) {
  opts = opts || {};
  const title = el({ id: 'tg-title', tagName: 'INPUT', value: opts.title != null ? opts.title : 'Mexeu' });
  const featured = el({ id: 'tg-featured', tagName: 'INPUT', value: opts.featured != null ? opts.featured : '' });
  const genre = el({ id: 'tg-genre', tagName: 'SELECT', value: opts.genre != null ? opts.genre : '' });
  const language = el({ id: 'tg-language', tagName: 'SELECT', value: opts.language != null ? opts.language : '' });
  const price = el({ id: 'tg-price', tagName: 'SELECT', value: opts.price != null ? opts.price : '$0.99' });
  const lyrics = el({ id: 'tg-lyrics', tagName: 'TEXTAREA', value: opts.lyrics != null ? opts.lyrics : 'leftover verse' });
  const artist = el({ id: 'tg-artist', tagName: 'INPUT', value: opts.artist != null ? opts.artist : 'Ada Night' });
  const artistSelect = el({ id: 'tg-artist-select', tagName: 'SELECT', value: opts.artistId != null ? opts.artistId : 'art-1' });
  const artistNew = el({ id: 'tg-artist-new', tagName: 'INPUT', value: opts.artistNew != null ? opts.artistNew : '' });
  const artistLink = el({ id: 'tg-artist-link', tagName: 'INPUT', value: '' });
  const artistLinkName = el({ id: 'tg-artist-link-name', tagName: 'INPUT', value: '' });
  const artistMode = el({ id: 'tg-artist-mode', tagName: 'SELECT', value: 'choose', options: [{ value: 'choose' }] });
  const albumCount = el({ id: 'tg-album-count', tagName: 'INPUT', value: opts.albumCount || '' });
  const instrumental = el({ id: 'tg-instrumental', type: 'checkbox', checked: Boolean(opts.instrumental) });
  const audio = el({
    type: 'file',
    attrs: { 'data-audio-input': '' },
    files: opts.file === null ? [] : [{ name: 'mexeu.wav', type: 'audio/wav' }],
    file: opts.file === null ? null : { name: 'mexeu.wav' },
  });
  const art = el({
    type: 'file',
    attrs: { 'data-art-input': '' },
    files: opts.art === null ? [] : [{ name: 'cover.jpg', type: 'image/jpeg' }],
    file: opts.art === null ? null : { name: 'cover.jpg' },
  });
  const preview = el({ attrs: { 'data-audio-preview': '' }, hidden: opts.file === null });
  const drop = el({ attrs: { 'data-audio-drop': '' }, hidden: opts.file !== null });
  const previewHint = el({ attrs: { 'data-audio-preview-hint': '' }, hidden: true });
  const nameEl = el({ attrs: { 'data-audio-name': '' }, textContent: opts.file === null ? 'No file selected' : 'mexeu.wav' });
  const metaEl = el({ attrs: { 'data-audio-meta': '' }, textContent: 'WAV, FLAC, or MP3 · 16-bit or higher' });
  const player = el({ tagName: 'AUDIO', attrs: { 'data-audio-player': '' }, src: opts.file === null ? '' : 'blob:audio' });
  const playBtn = el({ attrs: { 'data-audio-play': '' }, textContent: '▶' });
  const artMeta = el({ attrs: { 'data-art-meta': '' }, textContent: opts.art === null ? '3000 × 3000 px · JPG or PNG' : 'cover.jpg' });
  const lyricsField = el({ attrs: { 'data-lyrics-field': '' }, hidden: !opts.lyrics });
  const lyricsOpen = el({ attrs: { 'data-lyrics-open': '' } });
  const languageField = el({ attrs: { 'data-language-field': '' } });
  const explicitNo = el({ attrs: { 'data-explicit': 'false' }, on: opts.explicit !== true });
  const explicitYes = el({ attrs: { 'data-explicit': 'true' }, on: opts.explicit === true });
  const explicitToggle = el({
    attrs: { 'data-explicit-toggle': '' },
    children: [explicitNo, explicitYes],
  });
  const storeAll = el({ type: 'checkbox', checked: opts.storesAll !== false, attrs: { 'data-store-all': '' } });
  const storeList = el({ attrs: { 'data-store-list': '' }, hidden: true });
  const storeSummary = el({ attrs: { 'data-store-summary': '' }, textContent: 'All stores will receive this release.' });
  const cancelBtn = el({ tagName: 'BUTTON', attrs: { 'data-upload-cancel': '' }, textContent: 'Cancel' });
  const startBtn = el({ tagName: 'BUTTON', attrs: { 'data-upload-start-over': '' }, textContent: 'Start over' });
  const continueBtn = el({ tagName: 'A', attrs: { 'data-store-continue': '', href: 'attest.html' } });
  const status = el({ id: 'tg-status', hidden: true });
  const retry = el({ id: 'tg-retry-wrap', attrs: { 'data-upload-retry-wrap': '' }, hidden: true });
  const loader = el({ attrs: { 'data-upload-loader': '' }, hidden: true });
  const tracks = el({ attrs: { 'data-album-tracks': '' }, hidden: true });
  const trackList = el({ attrs: { 'data-track-list': '' } });
  const createWrap = el({ id: 'artist-create-wrap', hidden: true });
  const linkWrap = el({ id: 'artist-link-wrap', hidden: true });
  const chooseWrap = el({ id: 'artist-choose-wrap' });
  const typeahead = el({ tagName: 'INPUT', value: opts.genre || '', attrs: {} });
  typeahead.classList.add('typeahead-input');
  const ids = {
    'tg-title': title,
    'tg-featured': featured,
    'tg-genre': genre,
    'tg-language': language,
    'tg-price': price,
    'tg-lyrics': lyrics,
    'tg-artist': artist,
    'tg-artist-select': artistSelect,
    'tg-artist-new': artistNew,
    'tg-artist-link': artistLink,
    'tg-artist-link-name': artistLinkName,
    'tg-artist-mode': artistMode,
    'tg-album-count': albumCount,
    'tg-instrumental': instrumental,
    'tg-status': status,
    'tg-retry-wrap': retry,
    'artist-create-wrap': createWrap,
    'artist-link-wrap': linkWrap,
    'artist-choose-wrap': chooseWrap,
  };
  const listed = [
    cancelBtn, startBtn, continueBtn, audio, art, preview, drop, previewHint, nameEl, metaEl,
    player, playBtn, artMeta, lyricsField, lyricsOpen, languageField, explicitToggle,
    storeAll, storeList, storeSummary, retry, loader, tracks, trackList, typeahead,
  ];
  const bySel = {
    '[data-upload-cancel]': cancelBtn,
    '[data-upload-start-over]': startBtn,
    '[data-store-continue]': continueBtn,
    '[data-audio-input]': audio,
    '[data-audio-drop]': drop,
    '[data-audio-preview]': preview,
    '[data-audio-preview-hint]': previewHint,
    '[data-audio-name]': nameEl,
    '[data-audio-meta]': metaEl,
    '[data-audio-player]': player,
    '[data-audio-play]': playBtn,
    '[data-art-input]': art,
    '[data-art-meta]': artMeta,
    '[data-lyrics-field]': lyricsField,
    '[data-lyrics-open]': lyricsOpen,
    '[data-language-field]': languageField,
    '[data-explicit-toggle]': explicitToggle,
    '[data-explicit="true"]': explicitYes,
    '[data-explicit="false"]': explicitNo,
    '[data-store-all]': storeAll,
    '[data-store-list]': storeList,
    '[data-store-summary]': storeSummary,
    '[data-upload-retry-wrap]': retry,
    '[data-upload-loader]': loader,
    '[data-album-tracks]': tracks,
    '[data-track-list]': trackList,
    '.typeahead-input': typeahead,
  };
  const documentElement = el({});
  const doc = {
    documentElement,
    getElementById(id) { return ids[id] || null; },
    querySelector(sel) { return bySel[sel] || listed.filter((item) => matches(item, sel))[0] || null; },
    querySelectorAll(sel) {
      if (sel === '.typeahead-input') return [typeahead];
      if (sel === '[data-explicit]') return [explicitNo, explicitYes];
      const found = bySel[sel];
      return found ? [found] : listed.filter((item) => matches(item, sel));
    },
  };
  const localStorage = storage();
  const sessionStorage = storage();
  const draft = opts.draft === null ? null : (opts.draft || {
    title: title.value,
    name: artist.value,
    audio_name: opts.file === null ? '' : 'mexeu.wav',
    artwork_name: opts.art === null ? '' : 'cover.jpg',
    lyrics: lyrics.value,
    price: price.value,
    release_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  });
  if (draft) {
    localStorage.setItem(leave.DRAFT_KEY, JSON.stringify(draft));
    sessionStorage.setItem(leave.DRAFT_KEY, JSON.stringify(draft));
  }
  const confirms = [];
  const deletedDbs = [];
  const coverClears = [];
  const win = {
    document: doc,
    location: {
      href: opts.href || 'upload.html',
      pathname: opts.pathname || '/upload.html',
      search: opts.search || '',
    },
    localStorage,
    sessionStorage,
    confirm(message) {
      confirms.push(message);
      return opts.confirm !== false;
    },
    indexedDB: {
      deleteDatabase(name) { deletedDbs.push(name); },
    },
    PlaigroundUploadCover: {
      clear() { coverClears.push(true); },
    },
  };
  return {
    win,
    title,
    featured,
    genre,
    language,
    price,
    lyrics,
    artist,
    artistSelect,
    audio,
    art,
    preview,
    drop,
    nameEl,
    storeAll,
    cancelBtn,
    startBtn,
    continueBtn,
    confirms,
    deletedDbs,
    coverClears,
    explicitYes,
    explicitNo,
    localStorage,
    sessionStorage,
  };
}

function run() {
  const upload = read('upload.html');
  const review = read('review.html');
  const css = read('site.css');
  const store = read('store-client.js');
  const catalog = read('upload-catalog.js');

  assert.ok(/data-upload-save-draft>Save draft</.test(upload), 'Save draft sits with the leave actions');
  assert.ok(upload.indexOf('data-upload-save-draft') < upload.indexOf('data-upload-cancel'), 'Save draft is left of Cancel');
  assert.ok(/class="btn btn-ghost btn-sm" data-upload-cancel>Cancel</.test(upload), 'Cancel stays the live secondary control');
  assert.ok(/class="btn btn-ghost btn-sm" data-upload-start-over>Start over</.test(upload), 'Start over label is exact');
  assert.ok(upload.indexOf('Save draft and go to Artist Profiles') !== -1, 'Import note offers Save draft and go');
  assert.ok(upload.indexOf('Stay here') !== -1, 'Import note offers Stay here');
  assert.ok(upload.indexOf('Import lives on Artist Profiles') !== -1, 'Import note explains profiles first');
  assert.ok(!/spotify|apple music|distrokid/i.test(upload), 'submit import note does not name a store');
  assert.ok(upload.indexOf('lib/upload-leave.js') !== -1);
  assert.ok(upload.indexOf('lib/upload-draft-files.js') !== -1, 'Save draft persists picked files');
  assert.ok(upload.indexOf('upload-leave-actions') !== -1);
  assert.ok(review.indexOf('data-upload-start-over') === -1, 'Start over is New release only');
  assert.ok(/\.upload-leave-actions\s*\{[\s\S]*?flex-wrap:\s*wrap/.test(css), 'phone actions wrap instead of overlap');
  assert.ok(store.indexOf("leaveAfterCancel('upload.html?new=1')") !== -1, 'store-client leftover Cancel still wipes-and-stays');
  assert.ok(catalog.indexOf('data-upload-start-over') === -1, 'genre/language catalog is not the leave owner');

  const blank = makePage({
    title: '',
    featured: '',
    genre: '',
    language: '',
    price: '',
    lyrics: '',
    artist: '',
    artistId: '',
    file: null,
    art: null,
    draft: null,
  });
  assert.strictEqual(leave.hasUnsaved(blank.win), false, 'empty New release is not destructive');
  assert.strictEqual(leave.blankNewReleaseHref({ search: '' }), 'upload.html?new=1');
  assert.strictEqual(leave.blankNewReleaseHref({ search: '?type=album' }), 'upload.html?type=album&new=1');

  const filled = makePage();
  assert.ok(leave.hasUnsaved(filled.win), 'filled title/audio/cover is destructive');
  leave.bind(filled.win);

  const storeCancelHrefs = [];
  filled.cancelBtn.addEventListener('click', function (event) {
    if (event && event.preventDefault) event.preventDefault();
    storeCancelHrefs.push('upload.html?new=1');
    filled.win.location.href = 'upload.html?new=1';
  });
  filled.continueBtn.addEventListener('click', function () {
    filled.win.location.href = 'attest.html';
  });

  const cancelEvent = {
    preventDefault() { cancelEvent.prevented = true; },
    stopImmediatePropagation() { cancelEvent._stopped = true; },
    stopPropagation() { cancelEvent.bubbled = false; },
    prevented: false,
    _stopped: false,
    bubbled: true,
  };
  filled.cancelBtn.click(cancelEvent);
  assert.strictEqual(filled.win.location.href, 'dashboard.html', 'Cancel lands on Overview');
  assert.ok(String(filled.win.location.href).indexOf('upload.html') === -1, 'Cancel must not stay on New release');
  assert.ok(cancelEvent.prevented, 'Cancel does not continue or submit');
  assert.ok(cancelEvent._stopped, 'Cancel stops the leftover wipe-and-stay handler');
  assert.deepStrictEqual(storeCancelHrefs, [], 'store-client Cancel must not fire on New release');
  assert.strictEqual(filled.confirms[0], leave.CANCEL_CONFIRM, 'Cancel asks before dropping the draft');
  assert.strictEqual(filled.localStorage.getItem(leave.DRAFT_KEY), null, 'Cancel drops the draft after confirm');
  assert.strictEqual(filled.title.value, '', 'Cancel wipes the form after confirm');

  const start = makePage({ href: 'upload.html', search: '' });
  leave.bind(start.win);
  start.startBtn.click({
    preventDefault() {},
    stopImmediatePropagation() {},
    stopPropagation() {},
  });
  assert.strictEqual(start.confirms[0], leave.START_OVER_CONFIRM, 'Start over confirms when fields are filled');
  assert.strictEqual(start.title.value, '', 'Start over clears title');
  assert.strictEqual(start.artist.value, '', 'Start over clears artist pick');
  assert.strictEqual(start.price.value, '', 'Start over clears price');
  assert.strictEqual(start.lyrics.value, '', 'Start over clears lyrics / attest leftovers');
  assert.strictEqual(start.audio._plaigroundFile, null, 'Start over clears audio');
  assert.strictEqual(start.art._plaigroundFile, null, 'Start over clears cover');
  assert.ok(start.preview.hidden, 'Start over hides the audio preview');
  assert.ok(!start.drop.hidden, 'Start over shows the empty audio drop');
  assert.ok(start.storeAll.checked, 'Start over restores all stores');
  assert.ok(!start.explicitYes.classList.contains('on'), 'Start over resets explicit');
  assert.strictEqual(start.localStorage.getItem(leave.DRAFT_KEY), null, 'Start over clears local draft');
  assert.strictEqual(start.sessionStorage.getItem(leave.DRAFT_KEY), null, 'Start over clears session draft');
  assert.ok(start.deletedDbs.indexOf('plaiground-held-audio') !== -1, 'Start over drops held audio');
  assert.strictEqual(start.coverClears.length, 1);
  assert.ok(String(start.win.location.href).indexOf('upload.html?new=1') !== -1, 'Start over stays on a blank New release');
  assert.ok(String(start.win.location.href).indexOf('dashboard.html') === -1, 'Start over does not go to Overview');

  const keep = makePage({ confirm: false });
  leave.bind(keep.win);
  keep.startBtn.click({ preventDefault() {}, stopImmediatePropagation() {}, stopPropagation() {} });
  assert.strictEqual(keep.title.value, 'Mexeu', 'dismissing Start over keeps unsaved fields');
  assert.ok(String(keep.win.location.href).indexOf('upload.html?new=1') === -1);
  assert.ok(String(keep.win.location.href).indexOf('dashboard.html') === -1);

  const emptyStart = makePage({
    title: '',
    featured: '',
    genre: '',
    language: '',
    price: '',
    lyrics: '',
    artist: '',
    artistId: '',
    file: null,
    art: null,
    draft: null,
    href: 'upload.html?type=album',
    search: '?type=album',
  });
  leave.bind(emptyStart.win);
  emptyStart.startBtn.click({ preventDefault() {}, stopImmediatePropagation() {}, stopPropagation() {} });
  assert.strictEqual(emptyStart.confirms.length, 0, 'blank Start over does not confirm');
  assert.ok(String(emptyStart.win.location.href).indexOf('upload.html?type=album&new=1') !== -1, 'album Start over stays on album New release');

  const reviewPage = {
    document: {
      querySelector() { return null; },
      documentElement: { getAttribute() { return null; }, setAttribute() {} },
    },
    location: { href: 'review.html', pathname: '/review.html', search: '' },
  };
  assert.strictEqual(leave.isNewReleasePage(reviewPage.document, reviewPage.location), false);
  assert.strictEqual(leave.bind(reviewPage), false, 'review Cancel stays on the submit path');

  console.log('lib/upload-leave.test.js ok');
}

run();
