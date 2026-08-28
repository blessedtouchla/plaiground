'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function attrMatch(el, sel) {
  const m = String(sel || '').match(/^\[([^\]]+)\]$/);
  if (!m) return false;
  return el && el.attrs && Object.prototype.hasOwnProperty.call(el.attrs, m[1]);
}

function walk(el, out) {
  out.push(el);
  (el.children || []).forEach(function (child) { walk(child, out); });
  return out;
}

function makeEl(attrs) {
  const el = {
    hidden: Boolean(attrs && attrs.hidden),
    textContent: (attrs && attrs.textContent) || '',
    value: attrs && attrs.value != null ? attrs.value : '',
    className: (attrs && attrs.className) || '',
    style: {},
    children: [],
    parentNode: null,
    focused: false,
    scrollCalls: 0,
    attrs: Object.assign({}, (attrs && attrs.attrs) || {}),
    classList: {
      tokens: Object.create(null),
      toggle(name, force) {
        if (force === false) delete this.tokens[name];
        else if (force) this.tokens[name] = true;
        else if (this.tokens[name]) delete this.tokens[name];
        else this.tokens[name] = true;
      },
      add(name) { this.tokens[name] = true; },
      contains(name) { return Boolean(this.tokens[name]); },
    },
    closest(sel) {
      var node = el;
      while (node) {
        if (attrMatch(node, sel)) return node;
        node = node.parentNode;
      }
      return null;
    },
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    querySelectorAll(sel) {
      return walk(el, []).filter(function (node) {
        if (node === el) return false;
        if (sel === '[data-genre]') return node.getAttribute && node.getAttribute('data-genre');
        if (sel === '[data-artist-platform-url]') return node.getAttribute && node.getAttribute('data-artist-platform-url') != null;
        if (sel === '[data-artist-platform-slug]') return node.getAttribute && node.getAttribute('data-artist-platform-slug') != null;
        if (sel === '[data-artist-platform-row]') return attrMatch(node, sel);
        return attrMatch(node, sel);
      });
    },
    querySelector(sel) {
      return (el.querySelectorAll(sel) || [])[0] || null;
    },
    focus() { el.focused = true; },
    scrollIntoView() { el.scrollCalls += 1; },
    listeners: {},
    addEventListener(type, fn) {
      const key = String(type || '');
      if (!el.listeners[key]) el.listeners[key] = [];
      el.listeners[key].push(fn);
    },
    dispatchEvent(type) {
      const list = el.listeners[String(type || '')] || [];
      list.forEach(function (fn) { fn({ type: type, target: el }); });
    },
    appendChild(child) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    removeChild(child) {
      el.children = el.children.filter(function (item) { return item !== child; });
      if (child) child.parentNode = null;
      return child;
    },
  };
  Object.defineProperty(el, 'textContent', {
    get() { return el._text || ''; },
    set(value) {
      el._text = value == null ? '' : String(value);
      if (el._text === '') {
        el.children.forEach(function (child) { child.parentNode = null; });
        el.children = [];
      }
    },
  });
  el._text = (attrs && attrs.textContent) || '';
  return el;
}

function loadArtists() {
  const createPanel = makeEl({ hidden: true });
  const linkPanel = makeEl({ hidden: true });
  const addBtn = makeEl({ attrs: { 'data-artist-add': '' } });
  const importBtn = makeEl({ attrs: { 'data-artist-import': '' } });
  const nameInput = makeEl({ value: '' });
  const urlInput = makeEl({ value: '' });
  const checkMsg = makeEl({ hidden: true });
  const yellow = makeEl({ hidden: true });
  const red = makeEl({ hidden: true });
  const confirmWrap = makeEl({ hidden: true });
  const confirmBox = makeEl({ value: '' });
  confirmBox.checked = false;
  const bioInput = makeEl({ value: '' });
  const artistName = makeEl({ value: '' });
  const saveBtn = makeEl({ textContent: 'Save artist' });
  saveBtn.attrs = { 'data-artist-save': '' };
  const deleteBtn = makeEl({ textContent: 'Delete' });
  deleteBtn.attrs = { 'data-artist-delete': '' };
  const photoEdit = makeEl({});
  const genrePicks = makeEl({});
  const importRows = makeEl({});
  const addImportBtn = makeEl({ attrs: { 'data-artist-import-add': '' } });
  const platformsHost = makeEl({});
  const addPlatformBtn = makeEl({ attrs: { 'data-artist-platform-add': '' } });
  const previewPanel = makeEl({ hidden: true });
  const editOpenBtn = makeEl({ attrs: { 'data-artist-edit-open': '' } });
  const editDoneBtn = makeEl({ attrs: { 'data-artist-edit-done': '' } });
  const mappingPlaiBtn = makeEl({ attrs: { 'data-artist-mapping-plai': '' }, textContent: 'Text PLAI' });
  const textPill = makeEl({ className: 'plai-bubble-pill is-text' });
  textPill.clickCalls = 0;
  textPill.click = function () { textPill.clickCalls += 1; };
  const talkPill = makeEl({ className: 'plai-bubble-pill is-talk' });
  talkPill.clickCalls = 0;
  talkPill.click = function () { talkPill.clickCalls += 1; };
  const plaiInput = makeEl({ className: 'plai-bubble-input', value: '' });
  const stored = {
    id: 'artist-1',
    name: 'Fuvtu',
    source: 'created',
    badge: 'PLAIGROUND',
    bio: '',
    photo: '',
    genres: [],
    spotify_id: '',
    apple_id: '',
    store_url: '',
    platform_links: [],
  };
  const nodes = {
    '#artist-create-panel': createPanel,
    '[data-artist-create-panel]': createPanel,
    '#artist-link-panel': linkPanel,
    '[data-artist-link-panel]': linkPanel,
    '#artist-create-name': nameInput,
    '#artist-link-url': urlInput,
    '#artist-link-name': makeEl({ value: '' }),
    '#artist-create-check': checkMsg,
    '#artist-create-yellow': yellow,
    '#artist-create-red': red,
    '#artist-create-confirm-wrap': confirmWrap,
    '#artist-create-confirm': confirmBox,
    '#artist-name': artistName,
    '#artist-bio': bioInput,
    '#artist-legal-first': makeEl({ value: '' }),
    '#artist-legal-last': makeEl({ value: '' }),
    '#artist-change': makeEl({ value: '' }),
    '[data-artist-import-rows]': importRows,
    '[data-artist-import-add]': addImportBtn,
    '[data-artist-import-error]': makeEl({ hidden: true }),
    '[data-artist-platforms]': platformsHost,
    '[data-artist-platform-add]': addPlatformBtn,
    '[data-artist-platform-error]': makeEl({ hidden: true }),
    '[data-artist-preview]': previewPanel,
    '[data-artist-preview-name]': makeEl({}),
    '[data-artist-preview-badge]': makeEl({}),
    '[data-artist-preview-bio]': makeEl({}),
    '[data-artist-preview-photo]': makeEl({}),
    '[data-artist-preview-genres]': makeEl({}),
    '[data-artist-preview-genres-empty]': makeEl({ hidden: true }),
    '[data-artist-preview-platforms]': makeEl({}),
    '[data-artist-preview-platforms-empty]': makeEl({ hidden: true }),
    '[data-artist-preview-pending]': makeEl({ hidden: true }),
    '[data-artist-edit-open]': editOpenBtn,
    '[data-artist-edit-done]': editDoneBtn,
    '[data-artist-mapping-plai]': mappingPlaiBtn,
    '[data-artist-preview] [data-artist-delete]': makeEl({ attrs: { 'data-artist-delete': '' } }),
    '[data-artist-preview] [data-artist-edit-open]': editOpenBtn,
    '#artist-ai-detail': makeEl({ value: '' }),
    '#artist-ai-percent': makeEl({ value: '' }),
    '#artist-ai-range': makeEl({ value: '0' }),
    '[data-artist-add]': addBtn,
    '[data-artist-import]': importBtn,
    '[data-artist-save]': saveBtn,
    '[data-artist-delete]': deleteBtn,
    '[data-artist-edit-title]': makeEl({}),
    '[data-artist-badge]': makeEl({}),
    '[data-artist-photo-edit]': photoEdit,
    '[data-artist-genre-picks]': genrePicks,
    '[data-artist-error]': makeEl({ hidden: true }),
    '[data-artists-status]': makeEl({ hidden: true }),
    '[data-artist-empty]': makeEl({}),
    '[data-artist-list]': makeEl({}),
    '[data-artist-edit]': makeEl({ hidden: true }),
    '[data-artist-locked-note]': makeEl({ hidden: true }),
    '[data-artist-change-wrap]': makeEl({ hidden: true }),
    '[data-artist-edit-pending]': makeEl({ hidden: true }),
    '[data-artist-pending-note]': makeEl({ hidden: true }),
    '[data-artist-name-field]': makeEl({}),
    '[data-artist-songs]': makeEl({ hidden: true }),
    '[data-artist-song-list]': makeEl({}),
    '[data-artist-songs-empty]': makeEl({ hidden: true }),
    '[data-artist-ai-meter]': makeEl({}),
    '[data-artist-ai-summary]': makeEl({ hidden: true }),
    '[data-artist-ai-empty]': makeEl({}),
  };
  const posts = [];
  const context = {
    document: {
      readyState: 'complete',
      hidden: false,
      body: makeEl({}),
      listeners: {},
      getElementById(id) { return nodes['#' + id] || null; },
      querySelector(sel) {
        if (sel === '.plai-bubble-pill.is-text') return textPill;
        if (sel === '.plai-bubble-pill.is-talk') return talkPill;
        if (sel === '.plai-bubble-input') return plaiInput;
        return nodes[sel] || null;
      },
      querySelectorAll(sel) {
        if (sel === '[data-artist-add]') return [addBtn];
        if (sel === '[data-artist-import]') return [importBtn];
        if (sel === '[data-artist-delete]') return [deleteBtn];
        if (sel === '[data-artist-import-add]') return [addImportBtn];
        if (sel === '[data-artist-platform-add]') return [addPlatformBtn];
        if (sel === '[data-artist-edit-open]') return [editOpenBtn];
        if (sel === '[data-artist-edit-done]') return [editDoneBtn];
        if (sel === '[data-artist-mapping-plai]') return [mappingPlaiBtn];
        if (sel === '[data-human-contribution]') return [];
        if (sel === '[data-ai-contribution]') return [];
        if (sel === '[data-human-contribution], [data-ai-contribution]') return [];
        if (sel === '[data-genre]') return [];
        return [];
      },
      createElement(tag) {
        const el = makeEl({});
        el.tagName = String(tag || 'div').toUpperCase();
        return el;
      },
      addEventListener(type, fn) {
        const key = String(type || '');
        if (!this.listeners[key]) this.listeners[key] = [];
        this.listeners[key].push(fn);
      },
      dispatchClick(target) {
        const event = { type: 'click', target: target, preventDefault() {}, stopPropagation() {} };
        (this.listeners.click || []).forEach(function (fn) { fn(event); });
      },
    },
    location: { hash: '', pathname: '/artists.html' },
    fetch(url, opts) {
      const body = opts && opts.body ? JSON.parse(opts.body) : {};
      posts.push({ url: url, body: body, keepalive: Boolean(opts && opts.keepalive) });
      const updated = Object.assign({}, stored, {
        name: body.name || stored.name,
        bio: body.bio != null ? body.bio : stored.bio,
        photo: body.photo != null ? body.photo : stored.photo,
        genres: Array.isArray(body.genres) ? body.genres : stored.genres,
        platform_links: Array.isArray(body.platform_links) ? body.platform_links : stored.platform_links,
        spotify_id: body.spotify_id != null ? body.spotify_id : stored.spotify_id,
        apple_id: body.apple_id != null ? body.apple_id : stored.apple_id,
        store_url: body.store_url != null ? body.store_url : stored.store_url,
      });
      if (body.action === 'update') Object.assign(stored, updated);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          profile: { artists: [Object.assign({}, stored)] },
          updated: body.action === 'update' ? Object.assign({}, stored) : undefined,
          created: body.action === 'create' ? Object.assign({}, stored) : undefined,
        }),
      });
    },
    setTimeout(fn) { fn(); return 1; },
    clearTimeout() {},
    addEventListener() {},
    URL,
    confirm() { context.confirmCalls += 1; return context.confirmResult !== false; },
    PlaigroundMembership: { whenReady() { return Promise.resolve({ ok: true, data: { profile: { artists: [Object.assign({}, stored)] } } }); } },
  };
  context.confirmCalls = 0;
  context.confirmResult = true;
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(read('lib/artist-check.js'), context);
  vm.runInNewContext(read('lib/store-pick.js'), context);
  vm.runInNewContext(read('lib/platform-links.js'), context);
  vm.runInNewContext(read('artists.js'), context);
  return {
    api: context.PlaigroundArtists,
    checkApi: context.PlaigroundArtistCheck,
    nodes,
    addBtn,
    importBtn,
    createPanel,
    linkPanel,
    nameInput,
    urlInput,
    importRows,
    addImportBtn,
    platformsHost,
    previewPanel,
    editOpenBtn,
    textPill,
    talkPill,
    plaiInput,
    checkMsg,
    yellow,
    red,
    bioInput,
    artistName,
    saveBtn,
    posts,
    stored,
    nodes,
    context,
  };
}

function run() {
  const siteCss = read('site.css');
  assert.ok(siteCss.includes('.artist-edit-screen'));
  assert.ok(siteCss.includes('position: fixed'));
  assert.ok(siteCss.includes('.artist-platform-row'));
  assert.ok(siteCss.includes('.artist-edit-actions'));
  assert.ok(siteCss.includes('.artist-edit-actions [data-artist-save]'));
  assert.ok(siteCss.includes('.artist-edit-actions [data-artist-delete]'));
  assert.ok(/\.artist-edit-actions \{\s*display:\s*flex;\s*flex-wrap:\s*nowrap/.test(siteCss), 'desktop Delete/Save stay on one clean row');
  assert.ok(siteCss.includes('[data-artist-edit] .artist-edit-head') && siteCss.includes('flex-direction: column'), 'phone title/badge stack instead of overlapping');
  assert.ok(/\.artist-edit-actions \{\s*flex-direction:\s*column/.test(siteCss), 'phone Delete/Save stack full width');
  assert.ok(siteCss.includes('.artist-edit-actions [data-artist-save]') && siteCss.includes('width: 100%'), 'phone Save is a full-width tappable control');
  assert.ok(/\.artist-edit-actions \{\s*[\s\S]*?z-index:\s*4100/.test(siteCss), 'Save artist sits above Talk/Text PLAI');
  assert.ok(siteCss.includes('body.app.artists-page .page'), 'Artist Profiles page clears the bottom for Save artist');

  const html = read('artists.html');
  ['Neon Sermon', 'Victoria Reyes', 'John Doe', 'Hi John', 'Neon Shadows'].forEach(function (needle) {
    assert.strictEqual(html.indexOf(needle), -1, 'artists.html still has ' + needle);
  });
  assert.ok(html.includes('Artist Profiles'));
  assert.ok(html.includes('Your artists'));
  assert.ok(html.includes('>Add artist<'));
  assert.ok(html.includes('>Import Artist<'));
  assert.ok(html.includes('>Artist mapping<'));
  assert.ok(html.includes('Having a hard time finding your URL, or confused about mapping?'));
  assert.ok(html.includes('data-artist-mapping-plai'));
  assert.ok(!/We deliver to 55|150 platforms|every store we deliver to:/.test(html), 'do not write a store-catalog essay on Artist mapping');
  assert.ok(!html.includes('Manage the names music is released under'));
  assert.ok(html.includes('Create the artist once. Later songs pick that profile — no retype every submit.'));
  assert.ok(html.includes('After first live, the store page stays attached. No duplicate. Photo, bio, and genres stay editable.'));
  assert.ok(html.includes('Import or merge here, not on submit.'));
  assert.ok(html.includes('data-artist-preview'));
  const previewChunk = html.slice(html.indexOf('data-artist-preview'), html.indexOf('class="artist-edit-screen"'));
  assert.ok(/data-artist-edit-open[\s\S]*data-artist-delete/.test(previewChunk), 'Preview Edit stays left of Delete');
  assert.ok(!/Legal first|Legal last|legal_first|legal_last/.test(previewChunk), 'public Preview must not show legal names');
  assert.ok(html.includes('data-artist-import-rows'));
  assert.ok(html.includes('data-artist-import-add'));
  assert.ok(html.includes('data-artist-edit-done'));
  assert.ok(html.includes('class="artist-edit-screen"'));
  assert.ok(html.includes('lib/platform-links.js'));
  assert.ok(html.includes('lib/store-pick.js'));
  assert.ok(!html.includes('id="artist-spotify"'));
  assert.ok(!html.includes('id="artist-apple"'));
  assert.ok(!html.includes('id="artist-store"'));
  assert.ok(!/legal first\+last/i.test(html.split('data-artist-preview')[1].split('artist-edit-screen')[0]));
  assert.ok(!html.includes('Legal first name</label>\n          <input id="artist-preview'));
  assert.ok(html.includes('data-artist-add'));
  assert.ok(html.includes('data-artist-import'));
  assert.ok(html.includes('id="artist-create-panel"'));
  assert.ok(html.includes('id="artist-link-panel"'));
  assert.ok(html.includes('data-artist-create-panel hidden'));
  assert.ok(html.includes('data-artist-link-panel hidden'));
  assert.ok(html.includes('How this artist usually creates'));
  assert.ok(html.includes('AI musician type'));
  assert.ok(html.includes('Estimated AI involvement'));
  assert.ok(html.includes('Self-declared. This is a profile average, not a verified score for every song.'));
  assert.ok(html.includes('data-human-contribution="lyrics"'));
  assert.ok(html.includes('data-ai-contribution="full_track_support"'));
  assert.ok(html.includes('I write all lyrics and sing. AI builds the beat and helps with arrangement.'));
  assert.ok(html.includes('class="app artists-page"'), 'Artist Profiles page can lift Save artist above Talk/Text');
  assert.ok(html.includes('href="artists.html">Artist Profiles</a>'));
  assert.ok(html.includes('href="settings.html">Settings</a>'));
  assert.ok(!html.includes('data-require-membership'));
  assert.ok(!html.includes('data-require-paid'));
  assert.ok(html.includes('Plus adds another row. Link artist saves.'));
  assert.ok(html.includes('Save artist'));
  assert.ok(!html.includes('Submit for edit'));
  assert.ok(html.includes('data-artist-delete'));
  assert.ok(html.includes('class="artist-edit-actions"'));
  assert.ok(html.includes('Edits save as you type'));
  assert.ok(/class="artist-edit-actions"[\s\S]*data-artist-save[\s\S]*data-artist-delete/.test(html), 'Delete and Save artist share one chrome row');
  assert.ok(!/<div class="head-row">[\s\S]*data-artist-delete/.test(html), 'Delete must not sit in the title/badge row');
  assert.ok(html.includes('Pending edit'));
  assert.ok(html.includes('Edit submitted. Waiting on the store / the distributor.'));
  assert.ok(!/ToneGrid|Tonegrid/.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, '')));

  const createAt = html.indexOf('id="artist-create-panel"');
  const linkAt = html.indexOf('id="artist-link-panel"');
  const rosterAt = html.indexOf('>Your artists<');
  const emptyAt = html.indexOf('data-artist-empty');
  const editAt = html.indexOf('data-artist-edit');
  assert.ok(createAt !== -1 && createAt < rosterAt, 'Add artist form must sit above Your artists');
  assert.ok(linkAt !== -1 && linkAt < rosterAt, 'Import form must sit above Your artists');
  assert.ok(emptyAt !== -1 && emptyAt > rosterAt, 'empty state stays inside Your artists');
  assert.ok(editAt !== -1 && editAt > rosterAt, 'edit extras stay below Your artists');
  assert.strictEqual(html.indexOf('Create new artist'), -1, 'old bottom Create new artist heading must be gone');
  assert.strictEqual(html.indexOf('Link existing artist'), -1, 'old bottom Link existing artist heading must be gone');
  assert.ok(html.indexOf('data-artist-add') < rosterAt, 'Add artist choice must appear before Your artists');
  assert.ok(html.indexOf('data-artist-import') < rosterAt, 'Import choice must appear before Your artists');
  assert.ok(html.lastIndexOf('data-artist-add') > emptyAt, 'empty state must also offer Add artist');
  assert.ok(html.lastIndexOf('data-artist-import') > emptyAt, 'empty state must also offer Import Artist');
  const previewAt = html.indexOf('data-artist-preview');
  assert.ok(previewAt !== -1 && previewAt > rosterAt, 'Preview sits below Your artists');
  const screenAt = html.indexOf('class="artist-edit-screen"');
  assert.ok(screenAt !== -1 && screenAt > rosterAt, 'full-screen Edit sits off the list');

  const js = read('artists.js');
  assert.ok(html.includes('artists.js'));
  assert.ok(html.includes('This artist\'s songs'));
  assert.ok(html.includes('data-artist-song-list'));
  assert.ok(html.includes('lib/live-player.js'));
  assert.ok(html.includes('waits until the store says live'));
  assert.ok(!js.includes('indexedDB'));
  assert.ok(!html.includes('tonegrid.js'));
  assert.ok(html.indexOf('human_contributions') === -1 || html.includes('data-human-contribution'));
  assert.ok(js.includes('openArtistForm'));
  assert.ok(js.includes("openArtistForm('add')"));
  assert.ok(js.includes("openArtistForm('import')"));
  assert.ok(js.includes("Held for review. This name was not sent to the store."));
  assert.ok(js.includes("action: 'update'"));
  assert.ok(js.includes("artist_action: 'update'"));
  assert.ok(!js.includes('submit_edit'));
  assert.ok(js.includes("action: 'delete'"));
  assert.ok(js.includes("artist_action: 'delete'"));
  assert.ok(js.includes('scheduleSave'));
  assert.ok(js.includes('flushSave'));
  assert.ok(js.includes("addEventListener('input', scheduleSave)"));
  assert.ok(js.includes("addEventListener('pagehide', flushSave)"));
  assert.ok(js.includes('keepQuietSave'));
  assert.ok(!js.includes('object-hop'));
  assert.ok(!js.includes('store-client'));
  assert.ok(js.includes('The store / the distributor cannot delete this artist.'));
  assert.ok(js.indexOf('/api/tonegrid/artists') === -1, 'do not fake a store artist delete');
  assert.ok(js.includes("classList.toggle('is-green'"));
  assert.ok(js.includes("classList.toggle('is-yellow'"));
  assert.ok(js.includes("classList.toggle('is-red'"));

  const upload = read('upload.html');
  assert.ok(upload.includes('Create new artist profile'));
  assert.ok(!upload.includes('How this artist usually creates'));
  assert.ok(!upload.includes('Estimated AI involvement'));
  assert.ok(!upload.includes('data-human-contribution'));

  assert.ok(js.includes('ai_involvement_percent'));
  assert.ok(js.includes('human_contributions'));
  assert.ok(js.includes('/api/me/artists'));

  const profile = read('profile.html');
  assert.ok(profile.includes('artists.html'));
  assert.ok(profile.includes('Artist Profiles'));

  const settings = read('settings.html');
  assert.ok(settings.includes('href="artists.html">Artist Profiles</a>'));
  assert.ok(settings.includes('href="settings.html">Settings</a>'));

  const apiFiles = fs.readdirSync(path.join(__dirname, 'api')).filter(function (name) { return name.endsWith('.js'); }).sort();
  assert.deepStrictEqual(apiFiles, [
    'auth.js',
    'create-checkout-session.js',
    'me.js',
    'plai-session.js',
    'signwell.js',
    'tonegrid.js',
  ]);

  const page = loadArtists();
  assert.ok(page.checkApi, 'name checks must load');
  assert.strictEqual(page.checkApi.checkArtistName('Fuvtu').level, 'green');
  assert.strictEqual(page.checkApi.checkArtistName('Sia').level, 'yellow');
  assert.strictEqual(page.checkApi.checkArtistName('Drake').level, 'red');
  assert.strictEqual(page.checkApi.checkArtistName('Drake', {
    storeLink: 'https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4',
  }).level, 'green');
  assert.strictEqual(page.createPanel.hidden, true, 'Add artist form stays closed until chosen');
  assert.strictEqual(page.linkPanel.hidden, true, 'Import form stays closed until chosen');
  assert.strictEqual(page.api.openArtistForm('add'), 'add');
  assert.strictEqual(page.createPanel.hidden, false, 'Add artist opens the name-only form');
  assert.strictEqual(page.linkPanel.hidden, true, 'Import stays closed while adding');
  page.api.openArtistForm('import');
  assert.strictEqual(page.createPanel.hidden, true);
  page.context.document.dispatchClick(page.addBtn);
  assert.strictEqual(page.createPanel.hidden, false, 'Add artist click must open the form immediately');
  assert.strictEqual(page.linkPanel.hidden, true);
  assert.ok(page.addBtn.classList.contains('is-on'));
  assert.ok(!page.importBtn.classList.contains('is-on'));
  assert.strictEqual(page.nameInput.focused, true);
  assert.strictEqual(page.api.openArtistForm('import'), 'import');
  assert.strictEqual(page.createPanel.hidden, true, 'switching to Import Artist closes Add artist');
  assert.strictEqual(page.linkPanel.hidden, false, 'Import Artist opens plus-rows');
  assert.ok(page.importBtn.classList.contains('is-on'));
  assert.ok(!page.addBtn.classList.contains('is-on'));
  assert.ok(page.importRows.querySelectorAll('[data-artist-platform-row]').length >= 1, 'Import Artist starts with a platform + URL row');
  const firstImportUrl = page.importRows.querySelector('[data-artist-platform-url]');
  assert.ok(firstImportUrl, 'each Import Artist row has a URL field');
  assert.ok(page.importRows.querySelector('[data-artist-platform-slug]'), 'each Import Artist row has a platform dropdown');
  const beforePlus = page.importRows.querySelectorAll('[data-artist-platform-row]').length;
  page.api.addImportRow(null);
  assert.strictEqual(page.importRows.querySelectorAll('[data-artist-platform-row]').length, beforePlus + 1, 'plus adds another Import Artist row');
  const hintRow = page.importRows.querySelector('[data-artist-platform-row]');
  const hintSel = hintRow.querySelector('[data-artist-platform-slug]');
  const hintUrl = hintRow.querySelector('[data-artist-platform-url]');
  const hintCopy = hintRow.querySelector('[data-artist-platform-hint]');
  hintSel.value = 'spotify';
  hintSel.dispatchEvent('change');
  assert.ok(/open\.spotify\.com\/artist/.test(hintUrl.placeholder), 'placeholder follows the picked store');
  assert.ok(/open\.spotify\.com\/artist/.test(hintCopy.textContent), 'hint follows the picked store');
  assert.strictEqual(page.api.openMappingPlai(), true);
  assert.strictEqual(page.textPill.clickCalls, 1, 'Artist mapping opens Text PLAI');
  assert.strictEqual(page.talkPill.clickCalls, 0, 'Artist mapping must not open Talk / the mic');
  assert.ok(/Do not log into any store account/.test(page.plaiInput.value));
  assert.ok(/Do not ask for a password/.test(page.plaiInput.value));
  assert.ok(/Do not list every store/.test(page.plaiInput.value));
  assert.ok(/Spotify, Apple Music, YouTube Music, Amazon, Deezer, Tidal/.test(page.plaiInput.value));
  assert.ok(!/55/.test(page.plaiInput.value));

  page.api.applyMe({
    profile: { artists: [{ id: 'preview-1', name: 'Preview Act', source: 'created', badge: 'PLAIGROUND', bio: 'Shown on preview', genres: ['Pop'] }] },
  });
  page.api.selectArtist({ id: 'preview-1', name: 'Preview Act', source: 'created', badge: 'PLAIGROUND', bio: 'Shown on preview', genres: ['Pop'] }, 'preview');
  assert.strictEqual(page.previewPanel.hidden, false, 'clicking a profile opens Preview');
  assert.strictEqual(page.nodes['[data-artist-edit]'].hidden, true, 'Edit stays closed until Edit is tapped');
  assert.strictEqual(page.nodes['[data-artist-preview-name]'].textContent, 'Preview Act');
  assert.ok(!String(page.nodes['[data-artist-preview]'].textContent || '').includes('Legal first'));
  page.api.editArtist({ id: 'preview-1', name: 'Preview Act', source: 'created', badge: 'PLAIGROUND', bio: 'Shown on preview', genres: ['Pop'] });
  assert.strictEqual(page.nodes['[data-artist-edit]'].hidden, false, 'Edit opens the full-screen form');
  assert.strictEqual(page.previewPanel.hidden, true, 'full-screen Edit hides Preview');
  assert.ok(page.context.document.body.classList.contains('artist-editing'));

  page.api.openArtistForm('add');
  page.nameInput.value = 'Fuvtu';
  assert.strictEqual(page.api.paintCreateCheck().level, 'green');
  assert.strictEqual(page.checkMsg.hidden, false);
  assert.ok(page.checkMsg.classList.contains('is-green'));
  assert.strictEqual(page.yellow.hidden, true);
  assert.strictEqual(page.red.hidden, true);
  page.nameInput.value = 'Sia';
  assert.strictEqual(page.api.paintCreateCheck().level, 'yellow');
  assert.ok(page.checkMsg.classList.contains('is-yellow'));
  assert.strictEqual(page.yellow.hidden, false);
  assert.strictEqual(page.red.hidden, true);
  page.nameInput.value = 'Drake';
  assert.strictEqual(page.api.paintCreateCheck().level, 'red');
  assert.ok(page.checkMsg.classList.contains('is-red'));
  assert.strictEqual(page.yellow.hidden, true);
  assert.strictEqual(page.red.hidden, false);

  assert.strictEqual(page.api.isAccepted({ name: 'Ada', source: 'created', review_status: '' }), true);
  assert.strictEqual(page.api.isAccepted({ name: 'Ada', source: 'linked' }), true);
  assert.strictEqual(page.api.isAccepted({ name: 'Drake', source: 'created', name_check: 'red', review_status: 'pending' }), false);
  page.api.applyMe({
    profile: { artists: [{ id: 'keep', name: 'Keep Me', source: 'created', badge: 'PLAIGROUND' }] },
  });
  assert.strictEqual(page.api.applyMe({ ok: true }), undefined, 'a 200 without a roster must not wipe Your artists');

  return persistAndImmediateSave();
}

async function persistAndImmediateSave() {
  const page = loadArtists();
  page.api.applyMe({
    profile: {
      artists: [{
        id: 'artist-1',
        name: 'Fuvtu',
        source: 'created',
        badge: 'PLAIGROUND',
        bio: '',
        photo: '',
        genres: [],
      }],
    },
  });
  page.api.editArtist({
    id: 'artist-1',
    name: 'Fuvtu',
    source: 'created',
    badge: 'PLAIGROUND',
    bio: '',
    photo: '',
    genres: [],
  });
  page.bioInput.value = 'saved from the phone';
  page.posts.length = 0;
  page.api.scheduleSave();
  const update = page.posts.find(function (row) {
    return row.body && row.body.action === 'update';
  });
  assert.ok(update, 'scheduleSave must POST /api/me/artists without tapping Save artist');
  assert.strictEqual(update.body.bio, 'saved from the phone');
  assert.strictEqual(update.url, '/api/me/artists');
  assert.strictEqual(update.body.artist_action, 'update');
  assert.ok(!update.body.submit_edit);

  await page.api.saveArtist({ quiet: true });

  const afterReload = loadArtists();
  afterReload.stored.bio = 'saved from the phone';
  afterReload.stored.photo = 'data:image/jpeg;base64,abc';
  afterReload.api.applyMe({
    profile: { artists: [Object.assign({}, afterReload.stored)] },
  });
  afterReload.api.editArtist(Object.assign({}, afterReload.stored));
  assert.strictEqual(afterReload.bioInput.value, 'saved from the phone', 'bio must persist after reload');
  assert.strictEqual(afterReload.artistName.value, 'Fuvtu');
  assert.ok(String(afterReload.nodes['[data-artist-photo-edit]'].style.backgroundImage || '').indexOf('data:image/jpeg') !== -1, 'photo must persist after reload');

  afterReload.bioInput.value = 'typed without submit';
  afterReload.posts.length = 0;
  afterReload.bioInput.dispatchEvent('input');
  assert.ok(afterReload.posts.some(function (row) {
    return row.body && row.body.action === 'update' && row.body.bio === 'typed without submit';
  }), 'input event must save without Submit');

  const leave = loadArtists();
  leave.api.applyMe({
    profile: { artists: [Object.assign({}, leave.stored, { bio: 'stay on reload' })] },
  });
  leave.api.editArtist(Object.assign({}, leave.stored, { bio: 'stay on reload' }));
  leave.bioInput.value = 'stay on reload';
  await Promise.resolve();
  await Promise.resolve();
  leave.posts.length = 0;
  await leave.api.flushSave();
  assert.ok(leave.posts.some(function (row) {
    return row.body && row.body.action === 'update' && row.body.bio === 'stay on reload' && row.keepalive === true;
  }), 'leaving the page flushes the pending artist save');

  afterReload.api.applyMe({
    profile: { artists: [{ id: 'artist-1', name: 'Fuvtu', source: 'created', badge: 'PLAIGROUND' }] },
  });
  afterReload.context.confirmResult = false;
  const cancelled = await afterReload.api.deleteArtist('artist-1');
  assert.ok(cancelled && cancelled.cancelled === true, 'Delete still confirms first');
  assert.ok(afterReload.context.confirmCalls >= 1, 'Delete still confirms first');

  const emptyPage = loadArtists();
  emptyPage.api.applyMe({ profile: { artists: [] } });
  emptyPage.context.document.dispatchClick(emptyPage.addBtn);
  assert.strictEqual(emptyPage.createPanel.hidden, false, 'Add artist click works when the roster is empty');
  emptyPage.nameInput.value = 'Fresh Act';
  emptyPage.posts.length = 0;
  await emptyPage.api.createArtist(false);
  assert.ok(emptyPage.posts.some(function (row) {
    return row.url === '/api/me/artists' && row.body && row.body.artist_action === 'create' && row.body.name === 'Fresh Act';
  }), 'create artist must POST when the page shows empty');

  const accountPage = loadArtists();
  accountPage.api.applyMe({
    artist: 'Seeded Act',
    profile: { artists: [{ id: 'account', name: 'Seeded Act', source: 'created', badge: 'PLAIGROUND' }] },
  });
  accountPage.nameInput.value = 'Second Act';
  accountPage.posts.length = 0;
  await accountPage.api.createArtist(false);
  assert.ok(accountPage.posts.some(function (row) {
    return row.body && row.body.artist_action === 'create' && row.body.name === 'Second Act';
  }), 'create artist must POST when the page only has the seeded account id');

  console.log('artists.page.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
