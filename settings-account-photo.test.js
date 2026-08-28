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
    disabled: false,
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
  const store = opts.store || { photo: '', genres: ['Electronic'], specialties: ['Original lyrics'], artist: '', legal_name: '', country: '', username: '' };
  const header = makeEl({ textContent: 'PG', className: 'avatar' });
  const settings = makeEl({ textContent: 'PG', className: 'avatar' });
  const pick = makeEl({ tagName: 'BUTTON', textContent: 'Change photo', attrs: {} });
  const input = makeEl({ tagName: 'INPUT', attrs: { type: 'file', hidden: '' } });
  const status = makeEl({ hidden: true });
  const artist = makeEl({ tagName: 'INPUT', value: '' });
  const username = makeEl({ tagName: 'INPUT', value: '' });
  const legal = makeEl({ tagName: 'INPUT', value: '' });
  const country = makeEl({ tagName: 'INPUT', value: '' });
  const email = makeEl({ tagName: 'INPUT', value: '' });
  const save = makeEl({ tagName: 'BUTTON', textContent: 'Save changes', attrs: {} });
  const saveStatus = makeEl({ hidden: true });
  const nodes = {
    '[data-account-avatar]': [header, settings],
    '[data-account-who]': [makeEl({ textContent: 'Hi there' })],
    '[data-account-artist]': [artist],
    '[data-account-username]': [username],
    '[data-account-legal]': [legal],
    '[data-account-country]': [country],
    '[data-account-email]': [email],
    '[data-account-photo-pick]': pick,
    '[data-account-photo]': input,
    '[data-account-photo-status]': status,
    '[data-account-save]': save,
    '[data-account-save-status]': saveStatus,
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
        if (body.artist != null) store.artist = body.artist;
        store.photo = body.profile && body.profile.photo != null ? body.profile.photo : store.photo;
        if (body.profile && body.profile.genres) store.genres = body.profile.genres;
        if (body.profile && body.profile.specialties) store.specialties = body.profile.specialties;
        if (body.profile && body.profile.legal_name != null) store.legal_name = body.profile.legal_name;
        if (body.profile && body.profile.country != null) store.country = body.profile.country;
        if (body.profile && body.profile.username != null) store.username = body.profile.username;
        me.artist = store.artist || me.artist;
        me.username = store.username || me.username;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            artist: store.artist || me.artist,
            email: me.email,
            plan: me.plan,
            profile: {
              photo: store.photo,
              genres: store.genres,
              specialties: store.specialties,
              legal_name: store.legal_name || '',
              country: store.country || '',
              username: store.username || '',
            },
            username: store.username || '',
          }),
        });
      }
      if (String(url).indexOf('/api/me') !== -1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            artist: store.artist || me.artist,
            email: me.email,
            plan: me.plan,
            username: store.username || me.username || '',
            profile: {
              photo: store.photo,
              genres: store.genres,
              specialties: store.specialties,
              legal_name: store.legal_name || '',
              country: store.country || '',
              username: store.username || '',
            },
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
              return {
                photo: store.photo,
                genres: store.genres,
                specialties: store.specialties,
                legal_name: store.legal_name || '',
                country: store.country || '',
                username: store.username || '',
              };
            },
            username: store.username || me.username || '',
          },
        });
      },
      account() {
        return {
          artist: me.artist,
          email: me.email,
          plan: me.plan,
          username: store.username || me.username || '',
          profile: {
            photo: store.photo,
            genres: store.genres,
            specialties: store.specialties,
            legal_name: store.legal_name || '',
            country: store.country || '',
            username: store.username || '',
          },
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
    artist,
    username,
    legal,
    country,
    email,
    save,
    saveStatus,
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
  assert.ok(!html.includes('<label>Artist name</label>'), 'Artist name left Settings');
  assert.ok(!html.includes('data-account-artist'), 'Settings no longer edits artist name');
  assert.ok(html.includes('<label>Username</label>'), 'Username is the community handle field');
  assert.ok(html.includes('data-account-username'), 'Username is a real Settings field');
  assert.ok(html.includes('Account, login, and billing. Artist names live on Artist Profiles.'), 'Settings copy is account, not the artist');
  assert.ok(html.includes('Sign-in stays email.'), 'username is not a login');
  assert.ok(html.includes('<label>Legal name</label>'), 'Legal name label stays');
  assert.ok(html.includes('data-account-legal'), 'Legal name is a real Settings field');
  assert.ok(html.includes('data-account-country'), 'Country is a real Settings field');
  assert.ok(html.includes('data-account-save'), 'Save changes is wired to one persist path');
  assert.ok(html.includes('data-account-save-status'), 'Save reports a real write, not a fake toast');
  assert.ok(html.includes('class="app settings-page"'), 'Settings page can lift Save above Talk/Text');
  assert.strictEqual((html.match(/>Save changes</g) || []).length, 1, 'one Save changes, not a second button');
  assert.ok(!/data-account-save[^>]*disabled/.test(html), 'Save changes is not disabled in markup');
  assert.ok(/data-account-photo-pick>Change photo<\/button>/.test(html), 'Change photo stays on Account Settings');
  const siteCss = read('site.css');
  assert.ok(/\.confirm-actions\s*\{[\s\S]*?z-index:\s*4100/.test(siteCss), 'Settings Save sits above Talk/Text PLAI');
  assert.ok(/body\.app\.settings-page \.page/.test(siteCss), 'Settings page clears the bottom for Save');
  assert.ok(/body\.app\.artists-page \.page/.test(siteCss), 'Artist Profiles page clears the bottom for Save artist');
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

  async function saveAndReload(plan) {
    const writes = [];
    const memory = {
      photo: PHOTO,
      genres: ['Electronic'],
      specialties: ['Original lyrics'],
      artist: 'mexeu mexeu',
      legal_name: '',
      country: '',
      username: '',
    };
    const editor = loadSettings({ calls: writes, store: memory, plan: plan });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    editor.api.fill({
      artist: 'mexeu mexeu',
      email: 'victoriaimtanes@gmail.com',
      plan: plan,
      username: '',
      profile: {
        photo: PHOTO,
        genres: memory.genres,
        specialties: memory.specialties,
        legal_name: '',
        country: '',
        username: '',
      },
    });
    editor.username.value = 'victoria_remix';
    editor.legal.value = 'Victoria Imtanes';
    editor.country.value = 'Brazil';
    assert.strictEqual(editor.save.disabled, false, plan + ' Save changes must be tappable');
    assert.strictEqual(editor.save.getAttribute('data-bound'), 'true', plan + ' Save changes click is bound');
    await editor.api.saveAccountChanges();
    const posted = writes.find(function (row) {
      return row.method === 'POST' && String(row.url).indexOf('/api/me/profile') !== -1;
    });
    assert.ok(posted, plan + ' Save changes must POST /api/me/profile');
    const sent = JSON.parse(posted.body);
    assert.strictEqual(sent.artist, 'mexeu mexeu', plan + ' Save must keep the existing artist name, not edit it');
    assert.strictEqual(sent.profile.username, 'victoria_remix', plan + ' Save must write the username');
    assert.strictEqual(sent.profile.legal_name, 'Victoria Imtanes', plan + ' Save must write legal name');
    assert.strictEqual(sent.profile.country, 'Brazil', plan + ' Save must write country');
    assert.ok(String(sent.profile.photo || '').indexOf('data:image/jpeg') === 0, plan + ' Save must keep the photo');
    assert.strictEqual(editor.saveStatus.textContent, 'Saved on this account.');
    assert.strictEqual(editor.save.disabled, false, plan + ' Save must enable again after the write');
    assert.strictEqual(memory.artist, 'mexeu mexeu');
    assert.strictEqual(memory.username, 'victoria_remix');
    assert.strictEqual(memory.legal_name, 'Victoria Imtanes');
    assert.strictEqual(memory.country, 'Brazil');

    const after = loadSettings({
      store: {
        photo: memory.photo,
        genres: memory.genres,
        specialties: memory.specialties,
        artist: memory.artist,
        legal_name: memory.legal_name,
        country: memory.country,
        username: memory.username,
      },
      plan: plan,
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    after.api.fill({
      artist: memory.artist,
      email: 'victoriaimtanes@gmail.com',
      plan: plan,
      username: memory.username,
      profile: {
        photo: memory.photo,
        genres: memory.genres,
        specialties: memory.specialties,
        legal_name: memory.legal_name,
        country: memory.country,
        username: memory.username,
      },
    });
    assert.strictEqual(after.username.value, 'victoria_remix', plan + ' username must still be there after reload');
    assert.strictEqual(after.legal.value, 'Victoria Imtanes', plan + ' legal name must still be there after reload');
    assert.strictEqual(after.country.value, 'Brazil', plan + ' country must still be there after reload');
    assert.ok(hasPhoto(after.settings), plan + ' photo must still be there after reload');
    assert.strictEqual(after.email.value, 'victoriaimtanes@gmail.com', plan + ' email stays the signed-in account');
  }

  await saveAndReload('basic');
  await saveAndReload('creator');
  await saveAndReload('pro');

  const tapWrites = [];
  const tapStore = {
    photo: PHOTO,
    genres: ['Pop'],
    specialties: [],
    artist: 'Ada',
    legal_name: '',
    country: '',
    username: '',
  };
  const tap = loadSettings({ calls: tapWrites, store: tapStore, plan: 'basic' });
  await Promise.resolve();
  tap.username.value = 'tap_remix';
  tap.legal.value = 'Ada Lovelace';
  tap.country.value = 'Canada';
  tapWrites.length = 0;
  tap.save.click();
  await new Promise(function (resolve) { setImmediate(resolve); });
  await new Promise(function (resolve) { setImmediate(resolve); });
  const tapPost = tapWrites.find(function (row) {
    return row.method === 'POST' && String(row.url).indexOf('/api/me/profile') !== -1;
  });
  assert.ok(tapPost, 'tapping Save changes must POST /api/me/profile');
  assert.strictEqual(JSON.parse(tapPost.body).profile.username, 'tap_remix');
  assert.strictEqual(JSON.parse(tapPost.body).artist, 'Ada', 'Save tap must not move artist names off Artist Profiles');
  assert.strictEqual(tapStore.username, 'tap_remix', 'tap must persist, not only look tappable');

  const failedWrites = [];
  const failed = loadSettings({
    calls: failedWrites,
    store: { photo: '', genres: [], specialties: [], artist: 'Ada', legal_name: '', country: '', username: '' },
    plan: 'basic',
    fetch: function (url) {
      failedWrites.push({ url: String(url), method: 'POST' });
      return Promise.resolve({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Could not save changes.' }),
      });
    },
  });
  await Promise.resolve();
  failed.username.value = 'ada_remix';
  await failed.api.saveAccountChanges();
  assert.strictEqual(failed.saveStatus.textContent, 'Could not save changes.', 'failed write must not show a fake saved toast');
  assert.ok(failed.saveStatus.textContent !== 'Saved on this account.');

  console.log('settings-account-photo.test.js ok');
}

Promise.resolve(run()).catch(function (err) {
  console.error(err);
  process.exit(1);
});
