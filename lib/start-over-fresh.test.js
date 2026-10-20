'use strict';
const assert = require('assert');
const leave = require('./upload-leave');
function store(init) { const m = Object.assign({}, init); return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; }
const local = store({ 'plaiground.store.draft': JSON.stringify({ release_id: '0CCD4586-53ba-49e2-b963-29e9ab9394d6', track_id: 't1', title: 'Be Sneaky' }) });
const session = store({});
const win = { localStorage: local, sessionStorage: session, location: { pathname: '/upload.html', search: '', replace() {} }, document: null };
leave.startOver(null, win);
assert.strictEqual(local.getItem('plaiground.store.draft'), null, 'draft cleared (release id + track ids gone)');
assert.deepStrictEqual(JSON.parse(local.getItem('plaiground.store.abandoned_releases')), ['0ccd4586-53ba-49e2-b963-29e9ab9394d6']);
console.log('start-over-fresh.test.js ok');
