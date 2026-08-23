'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const catalog = require('./upload-catalog');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function makeEl(attrs) {
  const el = {
    hidden: Boolean(attrs && attrs.hidden),
    textContent: (attrs && attrs.textContent) || '',
    value: attrs && attrs.value != null ? attrs.value : '',
    className: (attrs && attrs.className) || '',
    style: {},
    children: [],
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
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener() {},
  };
  return el;
}

function loadProfile(opts) {
  opts = opts || {};
  const calls = opts.calls || [];
  const nodes = {
    '[data-profile-status]': makeEl({ hidden: true }),
    '[data-profile-name]': makeEl({ textContent: 'Artist name' }),
    '[data-profile-photo]': makeEl({}),
    '[data-profile-photo-note]': makeEl({ textContent: 'No photo yet' }),
    '[data-profile-empty]': makeEl({}),
    '[data-profile-genres]': makeEl({}),
    '[data-profile-genres-empty]': makeEl({}),
    '[data-profile-specialties]': makeEl({}),
    '[data-profile-specialties-empty]': makeEl({}),
    '[data-profile-edit]': makeEl({ hidden: true }),
    '[data-profile-photo-edit]': makeEl({}),
    '[data-profile-photo-pick]': makeEl({ textContent: 'Add photo' }),
    '[data-profile-genre-picks]': makeEl({}),
    '[data-profile-specialty-picks]': makeEl({}),
    '[data-profile-save]': makeEl({}),
    '[data-profile-error]': makeEl({ hidden: true }),
    '#profile-artist': makeEl({ value: '' }),
    '#profile-genre': makeEl({ value: '' }),
    '#profile-photo': makeEl({}),
  };
  const context = {
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: {
      querySelector(sel) { return nodes[sel] || null; },
      querySelectorAll(sel) {
        if (sel === '[data-profile-specialty-picks] [data-human-tag]') return nodes['[data-profile-specialty-picks]'].children;
        return [];
      },
      getElementById(id) { return nodes['#' + id] || null; },
      createElement() { return makeEl({}); },
    },
    fetch(url, options) {
      calls.push({ url: String(url), method: (options && options.method) || 'GET', body: options && options.body });
      if (opts.fetch) return opts.fetch(url, options);
      return Promise.resolve({ ok: true, status: 200, json: async () => opts.me || { artist: '', profile: { photo: '', genres: [], specialties: [] } } });
    },
    Image: function Image() { this.onload = null; this.src = ''; },
    PlaigroundUploadCatalog: catalog,
    PlaigroundMembership: {
      whenReady() { return Promise.resolve({ ok: Boolean(opts.me), data: opts.me || null }); },
      account() { return opts.me || null; },
    },
  };
  context.window = context;
  vm.runInNewContext(read('profile.js'), context);
  return { api: context.PlaigroundProfile, nodes, calls };
}

function run() {
  const html = read('profile.html');
  [
    'Neon Sermon',
    'Victoria Reyes',
    'John Doe',
    'Hi John',
    'Neon Shadows',
  ].forEach(function (needle) {
    assert.strictEqual(html.indexOf(needle), -1, 'profile.html still has ' + needle);
  });
  assert.ok(html.includes('Artist name'));
  assert.ok(html.includes('No photo yet'));
  assert.ok(html.includes('No genres yet'));
  assert.ok(html.includes('No specialties yet'));
  assert.ok(html.includes('id="profile-genre"'));
  assert.ok(html.includes('data-profile-specialty-picks'));
  assert.ok(html.includes('href="profile.html">Profile</a>'));
  assert.ok(html.includes('href="settings.html">Settings</a>'));
  assert.ok(!html.includes('data-require-membership'));
  assert.ok(!html.includes('data-require-paid'));
  assert.ok(html.includes('upload-catalog.js'));
  assert.ok(html.includes('profile.js'));
  assert.ok(!html.includes('tonegrid.js'));
  assert.ok(!/<label[^>]*>Legal name<\/label>/i.test(html));

  const attest = read('attest.html');
  catalog.HUMAN_TAGS.forEach(function (tag) {
    assert.ok(attest.includes(tag), 'attest is missing specialty tag ' + tag);
    assert.ok(html.includes('data-profile-specialty-picks') || true);
  });
  assert.ok(catalog.GENRES.indexOf('Electronic') !== -1);
  assert.ok(catalog.GENRES.indexOf('Pop') !== -1);
  assert.ok(catalog.HUMAN_TAGS.indexOf('Original lyrics') !== -1);
  assert.ok(catalog.HUMAN_TAGS.indexOf('Played an instrument') !== -1);

  const empty = loadProfile({ me: { artist: '', profile: { photo: '', genres: [], specialties: [] } } });
  empty.api.render({ artist: '', photo: '', genres: [], specialties: [] });
  assert.strictEqual(empty.nodes['[data-profile-name]'].textContent, 'Artist name');
  assert.strictEqual(empty.nodes['[data-profile-photo-note]'].textContent, 'No photo yet');
  assert.strictEqual(empty.nodes['[data-profile-empty]'].hidden, false);
  assert.strictEqual(empty.nodes['[data-profile-genres]'].children.length, 0);

  const filled = loadProfile({
    me: { artist: 'Fuvtu', email: 'a@b.com', profile: { photo: '', genres: ['Electronic'], specialties: ['Original lyrics'] } },
  });
  filled.api.render(filled.api.readProfile({
    artist: 'Fuvtu',
    profile: { photo: '', genres: ['Electronic', 'Not A Real Genre'], specialties: ['Original lyrics', 'Made up'] },
  }));
  assert.strictEqual(filled.nodes['[data-profile-name]'].textContent, 'Fuvtu');
  assert.strictEqual(filled.nodes['[data-profile-genres]'].children.length, 1);
  assert.strictEqual(filled.nodes['[data-profile-genres]'].children[0].textContent, 'Electronic');
  assert.strictEqual(filled.nodes['[data-profile-specialties]'].children.length, 1);
  assert.strictEqual(filled.api.canonicalGenre('electronic'), 'Electronic');
  assert.strictEqual(filled.api.canonicalGenre('Not A Real Genre'), '');

  const calls = [];
  const editor = loadProfile({
    me: { artist: 'Fuvtu', email: 'a@b.com', plan: 'basic', profile: { photo: '', genres: [], specialties: [] } },
    calls: calls,
    fetch(url, options) {
      if (String(url).indexOf('/api/me/profile') !== -1) {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            artist: body.artist,
            profile: body.profile,
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ artist: 'Fuvtu', profile: { photo: '', genres: [], specialties: [] } }) });
    },
  });
  return Promise.resolve().then(function () {
    editor.nodes['#profile-artist'].value = 'Fuvtu';
    editor.api.addGenre('Electronic');
    return editor.api.saveProfile();
  }).then(function (result) {
    assert.ok(result.ok);
    assert.ok(calls.some(function (row) {
      return row.method === 'POST' && /\/api\/me\/profile/.test(row.url);
    }));
    const sent = JSON.parse(calls.filter(function (row) { return row.method === 'POST'; })[0].body);
    assert.strictEqual(sent.artist, 'Fuvtu');
    assert.deepStrictEqual(sent.profile.genres, ['Electronic']);
    assert.ok(!calls.some(function (row) { return /\/api\/tonegrid\/releases$/.test(String(row.url)); }));
    console.log('profile.page.test.js ok');
  });
}

Promise.resolve(run()).catch(function (err) {
  console.error(err);
  process.exit(1);
});
