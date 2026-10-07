const assert = require('assert');
const fs = require('fs');
const path = require('path');
const copyright = require('./copyright');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

function memory() {
  const data = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); }
  };
}

const humanScreens = copyright.screens({ lane: 'human' }).map(function (screen) { return screen.id; });
assert.deepStrictEqual(humanScreens, ['lane', 'keep', 'splits', 'publish', 'benefits']);
const aiScreens = copyright.screens({ lane: 'ai' }).map(function (screen) { return screen.id; });
assert.deepStrictEqual(aiScreens, ['lane', 'explain', 'paths']);
assert.strictEqual(copyright.screens({ lane: '' }).length, 1);
assert.strictEqual(copyright.LANE_ASK, 'Was this song fully human, or did you use AI?');
assert.strictEqual(copyright.SUMMARY_TITLE, 'These are the parts we can protect.');
assert.strictEqual(copyright.DISCLAIMER, 'General info, not legal advice.');

const parts = {
  lyrics: true,
  sing: false,
  instruments: true,
  melody: true,
  arrange: false
};
assert.deepStrictEqual(copyright.summary(parts), [
  'Lyrics you wrote',
  'Instruments you played',
  'Melody or topline you made'
]);
assert.deepStrictEqual(copyright.summary({ lyrics: false, sing: false, instruments: false, melody: false, arrange: false }), []);
assert.strictEqual(copyright.isComplete({ lane: 'human', parts: {} }), true);
assert.strictEqual(copyright.isComplete({ lane: 'ai', parts: { lyrics: true } }), true);
assert.strictEqual(copyright.isComplete({ lane: 'ai', parts: parts }), true);

const store = memory();
store.setItem(copyright.DRAFT_KEY, JSON.stringify({ title: 'Night', release_id: 'rel-a' }));
copyright.save(store, 'rel-a', { lane: 'human', parts: {} });
copyright.save(store, 'rel-b', {
  lane: 'ai',
  parts: { lyrics: true, sing: false, instruments: false, melody: false, arrange: true }
});
assert.strictEqual(copyright.load(store, 'rel-a').lane, 'human');
assert.strictEqual(copyright.load(store, 'rel-b').lane, 'ai');
assert.deepStrictEqual(copyright.summary(copyright.load(store, 'rel-b').parts), [
  'Lyrics you wrote',
  'Arrangement, selection, and edits you made'
]);
const draft = JSON.parse(store.getItem(copyright.DRAFT_KEY));
assert.strictEqual(draft.release_id, 'rel-a');
assert.strictEqual(draft.title, 'Night');
assert.strictEqual(draft.protect.lane, 'human');
const map = JSON.parse(store.getItem(copyright.MAP_KEY));
assert.strictEqual(map.releases['rel-b'].lane, 'ai');
assert.ok(!map.releases['rel-b'].release_id);

const loose = memory();
loose.setItem(copyright.DRAFT_KEY, JSON.stringify({ title: 'Demo' }));
const savedLoose = copyright.save(loose, '', {
  lane: 'ai',
  parts: { lyrics: false, sing: false, instruments: false, melody: false, arrange: false }
});
const looseDraft = JSON.parse(loose.getItem(copyright.DRAFT_KEY));
assert.ok(!looseDraft.release_id);
assert.strictEqual(looseDraft.title, 'Demo');
assert.strictEqual(looseDraft.protect.lane, 'ai');
assert.strictEqual(copyright.load(loose, '').lane, 'ai');
assert.strictEqual(copyright.isComplete(savedLoose), true);
assert.strictEqual(loose.getItem(copyright.MAP_KEY), null);

assert.strictEqual(copyright.releaseIdFromQuery('?release=rel-a&id=other'), 'rel-a');
assert.strictEqual(copyright.releaseIdFromQuery('?id=song-9'), 'song-9');

const page = ['copyright.html', 'copyright.js', 'copyright.css', 'lib/copyright.js'].map(read).join('\n');
assert.ok(page.indexOf('\u2014') === -1);
assert.ok(page.indexOf('$') === -1);
assert.ok(!/\bplans?\b/i.test(page));
assert.ok(page.indexOf('General info, not legal advice.') !== -1);
assert.ok(page.indexOf('Was this song fully human, or did you use AI?') !== -1);
assert.ok(page.indexOf('Fully human') !== -1);
assert.ok(page.indexOf('I used AI') !== -1);
assert.ok(page.indexOf('Did you write the lyrics?') !== -1);
assert.ok(page.indexOf('Did you sing it yourself?') !== -1);
assert.ok(page.indexOf('Did you play any instruments?') !== -1);
assert.ok(page.indexOf('Did you write the melody?') !== -1);
assert.ok(page.indexOf('Did you arrange or edit it?') !== -1);
assert.ok(page.indexOf('These are the parts we can protect.') !== -1);
assert.ok(page.indexOf('Performance royalties (PRO)') !== -1);
assert.ok(page.indexOf('Mechanical royalties') !== -1);
assert.ok(page.indexOf('Sync licensing') !== -1);
assert.ok(page.indexOf('Proof of ownership') !== -1);
assert.ok(page.indexOf('Extra income') !== -1);
assert.ok(page.indexOf('splits.html') !== -1);
assert.ok(page.indexOf('publishing-register.html') !== -1);
assert.ok(page.indexOf('purely AI-generated material') !== -1);
assert.ok(read('copyright.html').indexOf('lib/copyright.js') !== -1);
assert.ok(read('copyright.html').indexOf('membership.js') === -1);
assert.ok(read('vercel.json').indexOf('"/copyright"') !== -1);
assert.ok(read('destination.js').indexOf("href: '/copyright'") !== -1);
assert.ok(read('destination.js').indexOf("label: 'Protect it'") !== -1);
