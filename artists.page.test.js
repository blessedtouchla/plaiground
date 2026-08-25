'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    focus() { el.focused = true; },
    scrollIntoView() { el.scrollCalls += 1; },
    addEventListener() {},
  };
  return el;
}

function loadArtists() {
  const createPanel = makeEl({ hidden: true });
  const linkPanel = makeEl({ hidden: true });
  const addBtn = makeEl({});
  const importBtn = makeEl({});
  const nameInput = makeEl({ value: '' });
  const urlInput = makeEl({ value: '' });
  const nodes = {
    '#artist-create-panel': createPanel,
    '[data-artist-create-panel]': createPanel,
    '#artist-link-panel': linkPanel,
    '[data-artist-link-panel]': linkPanel,
    '#artist-create-name': nameInput,
    '#artist-link-url': urlInput,
    '[data-artist-add]': addBtn,
    '[data-artist-import]': importBtn,
    '[data-artists-status]': makeEl({ hidden: true }),
    '[data-artist-empty]': makeEl({}),
    '[data-artist-list]': makeEl({}),
    '[data-artist-edit]': makeEl({ hidden: true }),
  };
  const context = {
    document: {
      readyState: 'loading',
      getElementById(id) { return nodes['#' + id] || null; },
      querySelector(sel) { return nodes[sel] || null; },
      querySelectorAll(sel) {
        if (sel === '[data-artist-add]') return [addBtn];
        if (sel === '[data-artist-import]') return [importBtn];
        return [];
      },
      addEventListener() {},
    },
    location: { hash: '', pathname: '/artists.html' },
    fetch() { return Promise.resolve({ ok: true, status: 200, json: async () => ({}) }); },
    setTimeout(fn) { fn(); },
    PlaigroundMembership: { whenReady() { return Promise.resolve({ ok: true, data: { profile: { artists: [] } } }); } },
  };
  context.window = context;
  vm.runInNewContext(read('artists.js'), context);
  return { api: context.PlaigroundArtists, nodes, addBtn, importBtn, createPanel, linkPanel, nameInput, urlInput };
}

function run() {
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
  assert.strictEqual(page.createPanel.hidden, true, 'Add artist form stays closed until chosen');
  assert.strictEqual(page.linkPanel.hidden, true, 'Import form stays closed until chosen');
  assert.strictEqual(page.api.openArtistForm('add'), 'add');
  assert.strictEqual(page.createPanel.hidden, false, 'Add artist opens the name-only form');
  assert.strictEqual(page.linkPanel.hidden, true, 'Import stays closed while adding');
  assert.ok(page.addBtn.classList.contains('is-on'));
  assert.ok(!page.importBtn.classList.contains('is-on'));
  assert.strictEqual(page.nameInput.focused, true);
  assert.strictEqual(page.api.openArtistForm('import'), 'import');
  assert.strictEqual(page.createPanel.hidden, true, 'switching to Import closes Add artist');
  assert.strictEqual(page.linkPanel.hidden, false, 'Import opens the store-link form');
  assert.ok(page.importBtn.classList.contains('is-on'));
  assert.ok(!page.addBtn.classList.contains('is-on'));
  assert.strictEqual(page.urlInput.focused, true);

  console.log('artists.page.test.js ok');
}

run();
