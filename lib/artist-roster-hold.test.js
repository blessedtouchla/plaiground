'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeSelect(names) {
  const options = names.map(function (name, i) {
    const isAction = name === 'Create new artist profile' || name === 'Import an existing artist';
    return {
      value: isAction ? (name.indexOf('Create') === 0 ? '__create__' : '__link__') : 'a' + i,
      textContent: name,
    };
  });
  return {
    options: options,
    appendChild: function (opt) { this.options.push(opt); },
    insertBefore: function (opt, before) {
      const at = this.options.indexOf(before);
      if (at === -1) this.options.push(opt);
      else this.options.splice(at, 0, opt);
    },
  };
}

function runHold(localStorage, select) {
  const context = {
    localStorage: localStorage,
    document: {
      readyState: 'complete',
      getElementById: function (id) {
        return id === 'tg-artist-select' ? select : null;
      },
      createElement: function () {
        return { value: '', textContent: '', setAttribute: function () {} };
      },
      addEventListener: function () {},
    },
    setTimeout: function () {},
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'artist-roster-hold.js'), 'utf8'), context);
  context.PlaigroundArtistRosterHold.paint();
  return context;
}

function run() {
  const select = makeSelect([
    'Select an artist',
    'Herman Watson',
    'Amplify',
    'Vicki G',
    'The kid',
    'Vickilicious',
    'VEXA',
    'Create new artist profile',
    'Import an existing artist',
  ]);
  const store = {
    data: {
      'plaiground.roster.artists': JSON.stringify([
        { id: 'orphan-1', name: 'Vikilicious' },
        { id: 'orphan-2', name: 'Vikilicioux' },
      ]),
    },
    getItem: function (key) { return this.data[key] || null; },
    setItem: function (key, value) { this.data[key] = String(value); },
  };
  runHold(store, select);
  const names = select.options.map(function (opt) { return opt.textContent; });
  assert.deepStrictEqual(names, [
    'Select an artist',
    'Herman Watson',
    'Amplify',
    'Vicki G',
    'The kid',
    'Vickilicious',
    'VEXA',
    'Create new artist profile',
    'Import an existing artist',
  ]);
  assert.ok(names.indexOf('Vikilicious') === -1, 'localStorage leftover Vikilicious must not paint');
  assert.ok(names.indexOf('Vikilicioux') === -1, 'localStorage leftover Vikilicioux must not paint');

  const src = fs.readFileSync(path.join(__dirname, 'cover-bind.js'), 'utf8');
  assert.ok(src.includes('artist-roster-hold.js?v=20260915r2'), 'cover-bind must cache-bust the hold leftover');
  assert.ok(!src.includes('artist-roster-hold.js?v=20260905r1'), 'old hold stamp is retired');
  console.log('lib/artist-roster-hold.test.js ok');
}

run();
