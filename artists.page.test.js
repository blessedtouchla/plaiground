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
    value: attrs && attrs.value != null ? attrs.value : '',
    disabled: Boolean(attrs && attrs.disabled),
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
        if (sel === '[data-artist-add]' && node.attrs && Object.prototype.hasOwnProperty.call(node.attrs, 'data-artist-add')) return node;
        if (sel === '[data-artist-import]' && node.attrs && Object.prototype.hasOwnProperty.call(node.attrs, 'data-artist-import')) return node;
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
  const platformsHost = makeEl({});
  const addPlatformBtn = makeEl({ attrs: { 'data-artist-platform-add': '' } });
  const platformError = makeEl({ hidden: true });
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
    '#artist-create-check': checkMsg,
    '#artist-create-yellow': yellow,
    '#artist-create-red': red,
    '#artist-create-confirm-wrap': confirmWrap,
    '#artist-create-confirm': confirmBox,
    '#artist-name': artistName,
    '#artist-bio': bioInput,
    '#artist-change': makeEl({ value: '' }),
    '[data-artist-platforms]': platformsHost,
    '[data-artist-platform-add]': addPlatformBtn,
    '[data-artist-platform-error]': platformError,
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
      listeners: {},
      getElementById(id) { return nodes['#' + id] || null; },
      querySelector(sel) { return nodes[sel] || null; },
      querySelectorAll(sel) {
        if (sel === '[data-artist-add]') return [addBtn];
        if (sel === '[data-artist-import]') return [importBtn];
        if (sel === '[data-artist-delete]') return [deleteBtn];
        if (sel === '[data-artist-platform-add]') return [addPlatformBtn];
        if (sel === '[data-artist-platform-row]') return platformsHost.querySelectorAll('[data-artist-platform-row]');
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
    checkMsg,
    yellow,
    red,
    bioInput,
    artistName,
    saveBtn,
    addPlatformBtn,
    platformsHost,
    platformError,
    posts,
    stored,
    nodes,
    context,
  };
}

function run() {
  const siteCss = read('site.css');
  assert.ok(siteCss.includes('.artist-platform-row'));
  assert.ok(siteCss.includes('.artist-edit-actions'));
  assert.ok(siteCss.includes('.artist-edit-actions [data-artist-save]'));
  assert.ok(siteCss.includes('.artist-edit-actions [data-artist-delete]'));
  assert.ok(/\.artist-edit-actions \{\s*display:\s*flex;\s*flex-wrap:\s*nowrap/.test(siteCss), 'desktop Delete/Save stay on one clean row');
  assert.ok(siteCss.includes('[data-artist-edit] .artist-edit-head') && siteCss.includes('flex-direction: column'), 'phone title/badge stack instead of overlapping');
  assert.ok(/\.artist-edit-actions \{\s*flex-direction:\s*column/.test(siteCss), 'phone Delete/Save stack full width');
  assert.ok(siteCss.includes('.artist-edit-actions [data-artist-save]') && siteCss.includes('width: 100%'), 'phone Save is a full-width tappable control');

  const html = read('artists.html');
  ['Neon Sermon', 'Victoria Reyes', 'John Doe', 'Hi John', 'Neon Shadows'].forEach(function (needle) {
    assert.strictEqual(html.indexOf(needle), -1, 'artists.html still has ' + needle);
  });
  assert.ok(html.includes('Artist Profiles'));
  assert.ok(html.includes('Your artists'));
  assert.ok(html.includes('>Add artist<'));
  assert.ok(html.includes('>Import<'));
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
  assert.ok(html.includes('href="artists.html">Artist Profiles</a>'));
  assert.ok(html.includes('href="settings.html">Settings</a>'));
  assert.ok(!html.includes('data-require-membership'));
  assert.ok(!html.includes('data-require-paid'));
  assert.ok(html.includes('skips the name warning'));
  assert.ok(html.includes('Save artist'));
  assert.ok(!html.includes('Submit for edit'));
  assert.ok(html.includes('data-artist-delete'));
  assert.ok(html.includes('class="artist-edit-actions"'));
  assert.ok(html.includes('Edits save as you type'));
  assert.ok(html.includes('Add new platform'));
  assert.ok(html.includes('data-artist-platform-add'));
  assert.ok(html.includes('data-artist-platforms'));
  assert.ok(html.includes('lib/platform-links.js'));
  assert.ok(!html.includes('id="artist-spotify"'), 'must not render a Spotify ID wall field');
  assert.ok(!html.includes('id="artist-apple"'), 'must not render an Apple ID wall field');
  assert.ok(!html.includes('id="artist-store"'), 'must not render a leftover store_url field');
  assert.ok(!html.includes('Spotify ID'), 'must not label a dummy Spotify row');
  assert.ok(!html.includes('Apple Music ID'), 'must not label a dummy Apple row');
  assert.ok(!/input type="checkbox"[^>]*spotify/i.test(html), 'must not render a store checkbox grid');
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
  assert.ok(html.lastIndexOf('data-artist-import') > emptyAt, 'empty state must also offer Import');

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
  assert.ok(!upload.includes('Add new platform'), 'upload create-new stays name-only');
  assert.ok(!upload.includes('data-artist-platform-add'));

  const settings = read('settings.html');
  assert.ok(!settings.includes('Add new platform'), 'platform picker stays off Settings');

  assert.ok(js.includes('ai_involvement_percent'));
  assert.ok(js.includes('human_contributions'));
  assert.ok(js.includes('/api/me/artists'));
  assert.ok(js.includes('platform_links'));
  assert.ok(js.includes('Add new platform') || html.includes('Add new platform'));
  assert.ok(js.includes('addPlatformRow'));

  const profile = read('profile.html');
  assert.ok(profile.includes('artists.html'));
  assert.ok(profile.includes('Artist Profiles'));

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
  assert.strictEqual(page.createPanel.hidden, true, 'switching to Import closes Add artist');
  assert.strictEqual(page.linkPanel.hidden, false, 'Import opens the store-link form');
  assert.ok(page.importBtn.classList.contains('is-on'));
  assert.ok(!page.addBtn.classList.contains('is-on'));
  assert.strictEqual(page.urlInput.focused, true);

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

  function filledPicker(secondPlatform, secondValue) {
    const page = loadArtists();
    page.api.applyMe({
      profile: { artists: [{ id: 'artist-1', name: 'Fuvtu', source: 'created', badge: 'PLAIGROUND' }] },
    });
    page.api.addPlatformRow(null, false);
    page.api.addPlatformRow(null, false);
    const rows = page.platformsHost.querySelectorAll('[data-artist-platform-row]');
    const firstSel = rows[0].querySelector('[data-artist-platform-slug]');
    const firstUrl = rows[0].querySelector('[data-artist-platform-url]');
    const secondSel = rows[1].querySelector('[data-artist-platform-slug]');
    const secondUrl = rows[1].querySelector('[data-artist-platform-url]');
    firstSel.value = 'spotify';
    firstUrl.value = 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg';
    page.api.refreshPlatformSelects();
    secondSel.value = secondPlatform;
    secondUrl.value = secondValue;
    return { page, firstSel, firstUrl, secondSel, secondUrl, rows };
  }

  const emptyPicker = loadArtists();
  emptyPicker.api.applyMe({
    profile: { artists: [{ id: 'artist-1', name: 'Fuvtu', source: 'created', badge: 'PLAIGROUND' }] },
  });
  assert.strictEqual(emptyPicker.platformsHost.querySelectorAll('[data-artist-platform-row]').length, 0, 'picker starts empty');
  assert.strictEqual(emptyPicker.addPlatformBtn.hidden, false, 'Add new platform is available on an empty profile');

  const two = filledPicker('apple', 'https://music.apple.com/us/artist/demo/123456789');
  const secondOptions = (two.secondSel.children || []).map(function (opt) { return opt.value; });
  assert.ok(secondOptions.indexOf('spotify') === -1, 'a platform already on the list drops out of the next dropdown');
  assert.ok(secondOptions.indexOf('apple') !== -1);
  two.page.posts.length = 0;
  await two.page.api.saveArtist({ quiet: true });
  const twoSaved = two.page.posts.find(function (row) {
    return row.body && row.body.action === 'update' && Array.isArray(row.body.platform_links);
  });
  assert.ok(twoSaved, 'add two platforms must POST /api/me/artists');
  assert.strictEqual(twoSaved.body.platform_links.length, 2);
  assert.strictEqual(twoSaved.body.platform_links[0].platform, 'spotify');
  assert.strictEqual(twoSaved.body.platform_links[1].platform, 'apple');
  assert.strictEqual(twoSaved.body.spotify_id, '0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(twoSaved.body.apple_id, '123456789');

  const dup = filledPicker('spotify', '4dpARuHxo51G3z768sgnrY');
  const blockedDup = dup.page.api.collectPlatformLinks({ strict: true });
  assert.strictEqual(blockedDup.error, 'That platform is already on the list.');
  dup.page.posts.length = 0;
  await dup.page.api.saveArtist();
  assert.ok(!dup.page.posts.some(function (row) {
    return row.body && row.body.action === 'update';
  }), 'duplicate platform must not save');

  const mismatchPage = filledPicker('apple', 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg');
  const mismatch = mismatchPage.page.api.collectPlatformLinks({ strict: true });
  assert.ok(mismatch.error);
  assert.match(mismatch.error, /does not match Apple Music/);
  mismatchPage.page.posts.length = 0;
  await mismatchPage.page.api.saveArtist();
  assert.ok(!mismatchPage.page.posts.some(function (row) {
    return row.body && row.body.action === 'update';
  }), 'URL / store mismatch must not save');

  const lockedPage = loadArtists();
  lockedPage.api.applyMe({
    profile: {
      artists: [{
        id: 'artist-1',
        name: 'Fuvtu',
        source: 'created',
        badge: 'PLAIGROUND',
        locked: true,
        spotify_id: '0TnOYISbd1XYRBk9myaseg',
        apple_id: '123456789',
      }],
    },
  });
  const lockedRows = lockedPage.platformsHost.querySelectorAll('[data-artist-platform-row]');
  assert.strictEqual(lockedRows.length, 2, 'locked artist still shows existing platform rows');
  assert.strictEqual(lockedPage.addPlatformBtn.hidden, true, 'locked artist cannot add platforms');
  assert.strictEqual(lockedRows[0].querySelector('[data-artist-platform-url]').value, '0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(lockedRows[0].querySelector('[data-artist-platform-url]').disabled, true);
  assert.strictEqual(lockedRows[0].querySelector('[data-artist-platform-slug]').disabled, true);
  assert.strictEqual(lockedRows[0].querySelector('[data-artist-platform-remove]').hidden, true);
  lockedPage.api.addPlatformRow(null, false);
  assert.strictEqual(lockedPage.platformsHost.querySelectorAll('[data-artist-platform-row]').length, 2, 'Add new platform is ignored while locked');

  const legacyPage = loadArtists();
  legacyPage.api.applyMe({
    profile: {
      artists: [{
        id: 'artist-1',
        name: 'Fuvtu',
        source: 'created',
        badge: 'PLAIGROUND',
        spotify_id: '0TnOYISbd1XYRBk9myaseg',
        apple_id: '123456789',
      }],
    },
  });
  const legacyRows = legacyPage.platformsHost.querySelectorAll('[data-artist-platform-row]');
  assert.strictEqual(legacyRows.length, 2, 'old spotify_id / apple_id still display');
  assert.strictEqual(legacyRows[0].querySelector('[data-artist-platform-slug]').value, 'spotify');
  assert.strictEqual(legacyRows[0].querySelector('[data-artist-platform-url]').value, '0TnOYISbd1XYRBk9myaseg');
  assert.strictEqual(legacyRows[1].querySelector('[data-artist-platform-slug]').value, 'apple');
  assert.strictEqual(legacyRows[1].querySelector('[data-artist-platform-url]').value, '123456789');

  console.log('artists.page.test.js ok');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
