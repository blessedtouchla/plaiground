'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const parody = require('./parody-v2');
const features = require('./features');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

const comment = 'preaching humility while picking fights, alleged bought streams, a family-man image vs lyrics admitting cheating and absence';
const base = {
  title: 'Me Sneaky',
  originalTitle: 'HUMBLE. by Kendrick Lamar',
  comment: comment,
  happened: '',
};

const straight = parody.package(Object.assign({ version: 'straight' }, base));
const weird = parody.package(Object.assign({ version: 'weird' }, base));

assert.deepStrictEqual(straight.draft.sections.map(function (part) { return part.label; }), parody.SECTIONS);
assert.deepStrictEqual(weird.draft.sections.map(function (part) { return part.label; }), parody.SECTIONS);
assert.strictEqual(straight.versionLabel, 'Straight');
assert.strictEqual(weird.versionLabel, 'Weird Al style mix');
assert.strictEqual(parody.CREDIT, 1);

const straightText = parody.plain(straight);
const weirdText = parody.plain(weird);
assert.ok(/humil/i.test(straightText));
assert.ok(/fight/i.test(straightText));
assert.ok(/stream/i.test(straightText));
assert.ok(/family/i.test(straightText));
assert.ok(/cheat/i.test(straightText));
assert.ok(/absence/i.test(straightText));
assert.ok(/Be sneaky, be sneaky/i.test(straightText));
assert.ok(!/\([^)]+\)/.test(straightText), 'straight stays free of sound gags');

assert.ok(weirdText.indexOf('Be sneaky (sneaky), be sneaky (shh),') !== -1);
assert.ok(weirdText.indexOf('Tiptoe in Timberlands, squeaky, squeaky') !== -1);
assert.ok(weirdText.indexOf("(chair squeaks loudly)") !== -1);
assert.ok(/tripped on my own shoe/i.test(weirdText));
assert.ok(/joke/i.test(weirdText));
assert.ok(weirdText !== straightText);

assert.strictEqual(straight.stylePrompt, parody.HUMBLE_FEEL);
assert.strictEqual(weird.stylePrompt, parody.HUMBLE_FEEL);
assert.ok(!/kendrick|lamar|humble/i.test(straight.stylePrompt));
assert.ok(!/suno|tonegrid/i.test(straight.stylePrompt + weirdText + straightText));
assert.ok(!/—|–/.test(straightText + weirdText + parody.TIPS.join(' ') + parody.SIGN_IN_NOTE));

assert.ok(parody.TIPS.some(function (tip) { return /Label it as a parody/.test(tip); }));
assert.ok(parody.TIPS.some(function (tip) { return /jokes or opinion/.test(tip); }));
assert.ok(parody.TIPS.some(function (tip) { return /sound-alike/.test(tip); }));
assert.ok(parody.TIPS.some(function (tip) { return /YouTube and TikTok/.test(tip); }));
assert.ok(/fair use/i.test(straight.draft.notes.join(' ')));
assert.ok(/not legal advice/i.test(straight.draft.notes.join(' ')));

const cleaned = parody.cleanVoice('teh song dont sit and humbl3 xyzzzq');
assert.ok(cleaned.text.indexOf('the song') === 0);
assert.ok(cleaned.text.indexOf("don't") !== -1);
assert.ok(cleaned.unsure.indexOf('humbl3') !== -1);
assert.ok(cleaned.unsure.indexOf('xyzzzq') !== -1);

const leaked = parody.filterNames('minimal Kendrick Lamar humble piano', {
  originalTitle: 'HUMBLE. by Kendrick Lamar',
});
assert.ok(!/kendrick|lamar|humble/i.test(leaked));
assert.ok(/piano/i.test(leaked));

const stolen = 'purple lanterns drift over the quiet bakery at midnight';
const copied = parody.package({
  title: 'Me Sneaky',
  originalTitle: 'Old Song by Someone Else',
  comment: stolen,
  lines: stolen,
  version: 'straight',
});
assert.ok(!/purple lanterns drift over the quiet/i.test(JSON.stringify(copied.draft)));
assert.strictEqual(copied.rewritten, true);

const model = parody.fromModel(JSON.stringify({
  title: 'Me Sneaky',
  stylePrompt: 'booming 808s in the style of Kendrick Lamar, humble piano',
  sections: [
    { label: 'Intro', lines: ['purple lanterns drift over the quiet bakery tonight'] },
    { label: 'Chorus', lines: ['A fresh chorus that does not quote anybody at all.'] },
  ],
}), {
  title: 'Me Sneaky',
  originalTitle: 'HUMBLE. by Kendrick Lamar',
  comment: comment,
  lines: stolen,
  version: 'weird',
});
assert.ok(model);
assert.strictEqual(model.draft.sections.length, 7);
assert.ok(!/purple lanterns drift over the quiet/i.test(JSON.stringify(model.draft)));
assert.ok(!/kendrick|lamar|humble/i.test(model.stylePrompt));
assert.ok(/808s/i.test(model.stylePrompt));
assert.ok(model.draft.sections.some(function (part) {
  return part.label === 'Chorus' && /fresh chorus/i.test(part.lines.map(function (row) { return row.text; }).join(' '));
}));

assert.strictEqual(features.enabled('PARODY_V2_ENABLED'), true);
assert.ok(read('lib/features.js').includes('PARODY_V2_ENABLED: true'));
assert.ok(read('lib/features.js').includes('WORD_TILES_ENABLED: false'));

const api = read('api/song-helper.js');
assert.ok(api.includes("action === 'parody-write'"));
assert.ok(api.includes('chargeCredit'));
assert.ok(api.includes('parodyV2.scrubPackage') || api.includes('scrubPackage'));

const page = read('song-helper-v2.js');
assert.ok(page.includes('Check the parody'));
assert.ok(page.includes('Write the parody (1 credit)'));
assert.ok(page.includes('Weird Al style mix'));
assert.ok(page.includes("We weren't sure about:"));
assert.ok(page.includes("enabled('PARODY_V2_ENABLED')"));
assert.ok(!/—|–/.test(read('lib/parody-v2.js')));
assert.ok(!/\bSuno\b/.test(read('lib/parody-v2.js')));

console.log('parody-v2 ok');
