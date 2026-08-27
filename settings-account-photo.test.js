'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(80);

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function makeEl(attrs) {
  const listeners = {};
  const el = {
    hidden: Boolean(attrs && attrs.hidden),
    textContent: (attrs && attrs.textContent) || '',
    value: attrs && attrs.value != null ? attrs.value : '',
    tagName: (attrs && attrs.tagName) || 'DIV',
    className: (attrs && attrs.className) || '',
    style: {},
    files: [],
    children: [],
    attrs: Object.assign({}, (attrs && attrs.attrs) || {}),
    clicked: false,
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
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    addEventListener(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    click() {
      this.clicked = true;
      (listeners.click || []).forEach(function (fn) { fn({ preventDefault() {} }); });
    },
    dispatchEvent(name) {
      (listeners[name] || []).forEach(function (fn) { fn({ preventDefault() {} }); });
    },
  };
  return el;
}

function loadSettings(opts) {
  opts = opts || {};
  const calls = opts.calls || [];
  const store = opts.store || { photo: '', genres: ['Electronic'], specialties: ['Original lyrics'] };
  const header = makeEl({ textContent: 'PG', className: 'avatar' });
  const settings = makeEl({ textContent: 'PG', className: 'avatar' });
  const pick = makeEl({ tagName: 'BUTTON', textContent: 'Change photo', attrs: {} });
  const input = makeEl({ tagName: 'INPUT', attrs: { type: 'file', hidden: '' } });
  const status = makeEl({ hidden: true });
  const nodes = {
    '[data-account-avatar]': [header, settings],
    '[data-account-who]': [makeEl({ textContent: 'Hi there' })],
    '[data-account-artist]': [makeEl({ tagName: 'INPUT', value: '' })],
    '[data-account-email]': [makeEl({ tagName: 'INPUT', value: '' })],
    '[data-account-photo-pick]': pick,
    '[data-account-photo]': input,
    '[data-account-photo-status]': status,
    '#account-photo': input,
  };
  const me = opts.me || {
    artist: 'mexeu mexeu',
    email: 'victoriaimtanes@gmail.com',
    plan: opts.plan || 'basic',
    profile: { photo: store.photo, genres: store.genres, specialties: store.specialties },
  };
  const context = {
    URLSearchParams,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: {
      readyState: 'complete',
      currentScript: { getAttribute() { return null; } },
      getElementById(id) { return nodes['#' + id] || null; },
      querySelector(sel) {
        if (Array.isArray(nodes[sel])) return nodes[sel][0];
        return nodes[sel] || null;
      },
      querySelectorAll(sel) {
        if (Array.isArray(nodes[sel])) return nodes[sel];
        return nodes[sel] ? [nodes[sel]] : [];
      },
      createElement() { return makeEl({}); },
      addEventListener() {},
    },
    FileReader: function FileReader() {
      this.onload = null;
      this.onerror = null;
      this.result = '';
    },
    fetch(url, options) {
      calls.push({ url: String(url), method: (options && options.method) || 'GET', body: options && options.body });
      if (opts.fetch) return opts.fetch(url, options);
      if (String(url).indexOf('/api/me/profile') !== -1) {
        const body = JSON.parse((options && options.body) || '{}');
        store.photo = body.profile && body.profile.photo != null ? body.profile.photo : store.photo;
        if (body.profile && body.profile.genres) store.genres = body.profile.genres;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            artist: me.artist,
            email: me.email,
            plan: me.plan,
            profile: { photo: store.photo, genres: store.genres, specialties: store.specialties },
          }),
        });
      }
      if (String(url).indexOf('/api/me') !== -1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            artist: me.artist,
            email: me.email,
            plan: me.plan,
            profile: { photo: store.photo, genres: store.genres, specialties: store.specialties },
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    },
    location: { href: 'settings.html', pathname: '/settings.html', search: '', hash: '', replace() {} },
    PlaigroundMembership: {
      whenReady() {
        return Promise.resolve({
          ok: true,
          data: {
            artist: me.artist,
            email: me.email,
            plan: me.plan,
            get profile() {
              return { photo: store.photo, genres: store.genres, specialties: store.specialties };
            },
          },
        });
      },
      account() {
        return {
          artist: me.artist,
          email: me.email,
          plan: me.plan,
          profile: { photo: store.photo, genres: store.genres, specialties: store.specialties },
        };
      },
    },
  };
  context.FileReader.prototype.readAsDataURL = function readAsDataURL(file) {
    const self = this;
    self.result = (file && file.dataUrl) || PHOTO;
    if (self.onload) self.onload();
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(read('account.js'), context);
  return {
    api: context.PlaigroundAccount,
    header,
    settings,
    pick,
    input,
    status,
    calls,
    store,
    me,
  };
}

function hasPhoto(el) {
  return String((el.style && el.style.backgroundImage) || '').indexOf('data:image/jpeg') !== -1;
}

async function run() {
  const html = read('settings.html');
  assert.ok(html.includes('data-account-photo-pick'), 'Change photo must be wired, not chrome');
  assert.ok(html.includes('id="account-photo"'), 'Settings must expose a real file input');
  assert.ok(html.includes('type="file"'), 'Change photo must open an image picker');
  assert.ok(html.includes('accept="image/jpeg,image/png,.jpg,.jpeg,.png"'), 'picker accepts the same image types as other account photos');
  assert.ok(html.includes('<label>Artist name</label>'), 'Artist name label stays');
  assert.ok(html.includes('<label>Legal name</label>'), 'Legal name label stays');
  assert.ok(/data-account-photo-pick>Change photo<\/button>/.test(html), 'Change photo stays on Account Settings');
  assert.ok(!/tonegrid|distrokid|cdbaby/i.test(html), 'no distributor name in Settings copy');
  assert.ok(html.includes('data-account-avatar>PG'), 'unsigned initials stay PG');

  const empty = loadSettings({ store: { photo: '', genres: [], specialties: [] } });
  empty.api.fill({
    artist: 'mexeu mexeu',
    email: 'victoriaimtanes@gmail.com',
    plan: 'basic',
    profile: { photo: '', genres: [], specialties: [] },
  });
  assert.strictEqual(empty.header.textContent, 'MM', 'header uses initials when no account photo');
  assert.strictEqual(empty.settings.textContent, 'MM', 'Settings circle uses initials when no account photo');
  assert.ok(!hasPhoto(empty.header));
  assert.ok(!hasPhoto(empty.settings));

  const saved = loadSettings({
    store: { photo: PHOTO, genres: ['Electronic'], specialties: [] },
  });
  saved.api.fill({
    artist: 'mexeu mexeu',
    email: 'victoriaimtanes@gmail.com',
    plan: 'basic',
    profile: { photo: PHOTO, genres: ['Electronic'], specialties: [] },
  });
  assert.ok(hasPhoto(saved.header), 'header avatar uses the saved account photo');
  assert.ok(hasPhoto(saved.settings), 'Settings circle uses the saved account photo');
  assert.strictEqual(saved.header.textContent, '', 'saved photo replaces leftover MM initials in the header');
  assert.strictEqual(saved.settings.textContent, '', 'saved photo replaces leftover MM initials on Settings');

  const creator = loadSettings({
    plan: 'creator',
    store: { photo: PHOTO, genres: [], specialties: [] },
  });
  creator.api.fill({
    artist: 'mexeu mexeu',
    plan: 'creator',
    profile: { photo: PHOTO, genres: [], specialties: [] },
  });
  assert.ok(hasPhoto(creator.header), 'Creator/Pro header uses the same account photo');
  assert.ok(hasPhoto(creator.settings), 'Creator/Pro Settings circle uses the same account photo');

  const calls = [];
  const store = { photo: '', genres: ['Electronic'], specialties: ['Original lyrics'] };
  const page = loadSettings({ calls: calls, store: store, plan: 'basic' });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  page.api.fill({
    artist: 'mexeu mexeu',
    email: 'victoriaimtanes@gmail.com',
    plan: 'basic',
    profile: { photo: '', genres: store.genres, specialties: store.specialties },
  });
  assert.strictEqual(page.settings.textContent, 'MM');
  page.pick.click();
  assert.strictEqual(page.input.clicked, true, 'Change photo must open the file picker');
  page.input.files = [{ name: 'me.jpg', type: 'image/jpeg', dataUrl: PHOTO }];
  page.input.dispatchEvent('change');
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(hasPhoto(page.settings), 'pick updates the Settings avatar immediately');
  assert.ok(hasPhoto(page.header), 'pick updates the header avatar immediately');
  assert.strictEqual(page.settings.textContent, '', 'pick must not leave MM initials on Settings');
  const posted = calls.find(function (row) {
    return row.method === 'POST' && String(row.url).indexOf('/api/me/profile') !== -1;
  });
  assert.ok(posted, 'pick must persist on POST /api/me/profile');
  const sent = JSON.parse(posted.body);
  assert.ok(String(sent.profile.photo || '').indexOf('data:image/jpeg') === 0, 'saved photo stays on the existing profile.photo field');
  assert.deepStrictEqual(sent.profile.genres, ['Electronic'], 'photo save must not wipe other Settings profile fields');
  assert.strictEqual(store.photo, sent.profile.photo);

  const reloaded = loadSettings({
    store: { photo: store.photo, genres: store.genres, specialties: store.specialties },
  });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  const again = {
    artist: 'mexeu mexeu',
    email: 'victoriaimtanes@gmail.com',
    plan: 'basic',
    profile: { photo: store.photo, genres: store.genres, specialties: store.specialties },
  };
  reloaded.api.fill(again);
  assert.ok(hasPhoto(reloaded.settings), 'Settings avatar still shows the photo after reload');
  assert.ok(hasPhoto(reloaded.header), 'header avatar still shows the photo after reload');
  assert.strictEqual(again.profile.photo, PHOTO, 'GET /api/me still returns the saved account photo after reload');
  assert.strictEqual(store.photo, PHOTO);

  console.log('settings-account-photo.test.js ok');
}

Promise.resolve(run()).catch(function (err) {
  console.error(err);
  process.exit(1);
});
