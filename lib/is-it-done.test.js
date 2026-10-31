'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const D = require('./is-it-done');
function mem() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; }

assert.deepStrictEqual(D.QUESTIONS.map((q) => q.q), ['Did it move you?', 'Is there a line that bugs you every time?', 'Is it fun to sing out loud?']);
assert.strictEqual(D.verdict({ moved: 'yes' }).complete, false);
assert.deepStrictEqual(D.verdict({ moved: 'yes', bugs: 'no', fun: 'yes' }), { complete: true, done: true, misses: [] });
assert.deepStrictEqual(D.verdict({ moved: 'yes', bugs: 'yes', fun: 'yes' }).misses, ['bugs'], 'Yes on the line question is the bad answer');
assert.deepStrictEqual(D.verdict({ moved: 'no', bugs: 'no', fun: 'no' }).misses, ['moved', 'fun']);

const secs = [{ id: 'hook', label: 'Hook', text: 'Porch light on\n\nStay with me' }, { id: 'bridge', label: 'Bridge', text: 'I turned around' }];
assert.deepStrictEqual(D.lineChoices(secs).map((c) => c.id + ':' + c.line), ['hook:Porch light on', 'hook:Stay with me', 'bridge:I turned around']);

const store = mem();
const t0 = Date.parse('2026-10-01T12:00:00Z');
const item = D.toDrawer(store, { sections: secs }, t0);
assert.ok(item && item.at === new Date(t0).toISOString() && item.title === 'Porch light on');
assert.ok(/\[Hook\]\nPorch light on/.test(item.lyrics));
assert.strictEqual(D.due(store, t0 + 6 * 864e5), null, 'not before 7 days');
assert.strictEqual(D.due(store, t0 + 7 * 864e5).id, item.id, 'offered at 7 days');
D.markOffered(store, item.id, t0 + 7 * 864e5);
assert.strictEqual(D.due(store, t0 + 7 * 864e5 + 3600e3), null, 'not nagged twice in a day');
assert.strictEqual(D.due(store, t0 + 9 * 864e5).id, item.id);
assert.strictEqual(D.pullOut(store, item.id).id, item.id);
assert.strictEqual(D.readDrawer(store).length, 0);

const copy = JSON.stringify(D.COPY) + JSON.stringify(D.QUESTIONS) + fs.readFileSync(path.join(__dirname, 'is-it-done.js'), 'utf8');
assert.ok(!/\u2014/.test(copy), 'no em dashes');
assert.ok(!/suno|tonegrid|cohen/i.test(copy), 'no Suno, ToneGrid, or quotes');
assert.ok(!/credit/i.test(JSON.stringify(D.COPY)), 'free');
assert.ok(D.COPY.offer === 'Want to pull this one back out?');

const html = fs.readFileSync(path.join(__dirname, '..', 'song-helper.html'), 'utf8');
assert.ok(html.includes('lib/is-it-done.js?v=20261031done') && html.includes('song-helper-v2.js?v=20261031done'));
assert.ok(html.indexOf('is-it-done.js') < html.indexOf('song-helper-v2.js?v='), 'loads before v2');
const v2 = fs.readFileSync(path.join(__dirname, '..', 'song-helper-v2.js'), 'utf8');
assert.ok(v2.includes('mountDoneCheck(host)') && v2.includes('offerDrawer();'));
console.log('is-it-done tests passed');
