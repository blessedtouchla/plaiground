'use strict';
const assert = require('assert');
delete process.env.XAI_API_KEY;
const A = require('./arcade');
const srv = require('./arcade-server');

(async () => {
  const xmas = A.stylePrompt({ type: 'holiday', answers: { holiday: 'Christmas' } }, {});
  assert.ok(/sleigh bells/.test(xmas));
  assert.ok(!/\u2014/.test(xmas) && xmas.length <= 200);
  assert.ok(!/suno|tonegrid/i.test(JSON.stringify(A) + srv.PAGE_HTML));
  assert.strictEqual(A.explicitAllowed({ type: 'roast', explicit: 'ok', ageOk: false }), false);
  assert.strictEqual(A.explicitAllowed({ type: 'roast', explicit: 'ok', ageOk: true }), true);
  assert.strictEqual(A.explicitAllowed({ type: 'kids', explicit: 'ok', ageOk: true }), false);
  assert.ok(A.crisis('i want to die'));
  const human = await srv.ACTIONS['arcade-write']({ state: { type: 'jam', aiLevel: 'human', built: ['my line one', 'my line two'], answers: {} } });
  assert.strictEqual(human.status, 200);
  assert.ok(/my line one/.test(human.body.lyrics));
  const par = await srv.ACTIONS['arcade-write']({ state: { type: 'parody', aiLevel: 'full', answers: { song: 'Some Song', artist: 'Some Artist', newTopic: 'my landlord' } } });
  assert.strictEqual(par.status, 200);
  assert.ok(par.body.sample);
  const lines = await srv.ACTIONS['arcade-lines']({ state: { type: 'kids', aiLevel: 'assist', answers: {} }, slot: 'Chorus line 1' });
  assert.strictEqual(lines.body.lines.length, 3);
  const fix = await srv.ACTIONS['arcade-fix']({ state: {}, text: '[Verse]\nI walk the line tonight\nand you are always right\n[Chorus]\nhey hey hey', off: [] });
  assert.ok(fix.body.lyrics);
  const flip = await srv.ACTIONS['arcade-flip']({ state: { flip: { target: 'Country', vibe: 'dirty', level: 'Filthy', keep: [] } }, text: 'some lyrics here\nmore lyrics there' });
  assert.ok(flip.status === 400 || flip.body.ok === false, 'Filthy without 18+ must be refused');
  const battle = await srv.ACTIONS['arcade-battle']({ state: { type: 'roast', sub: 'battle', answers: {} }, round: 1, userBars: 'yo yo' });
  assert.ok(battle.body.bars);
  for (const k of Object.keys(srv.ACTIONS)) assert.ok(!/\u2014/.test(JSON.stringify((await srv.ACTIONS[k]({ state: { type: 'jam', answers: {} }, text: 'a b c d e f g h i j k l' })).body)));
  console.log('arcade tests passed');
})().catch((e) => { console.error(e); process.exit(1); });

// Parody angles always target the original song or artist (fair use).
(function () {
  const assert = require('assert');
  const A = require('./arcade.js');
  const base = A.parodyAngles('Shake It Off', 'Taylor Swift');
  assert.strictEqual(base.length, 3);
  base.forEach((t) => assert.ok(A.tiedToOriginal(t, 'Shake It Off', 'Taylor Swift'), t));
  const fixed = A.normalizeAngles({ says: 'Laundry day is the worst', how: 'Spoof the hand clap breakdown in the song', artist: 'Taylor Swift and her very public breakups' }, 'Shake It Off', 'Taylor Swift');
  assert.ok(/What it says: poke at the message of "Shake It Off"/.test(fixed[0]), 'general topic replaced');
  assert.ok(/^How it says it: Spoof the hand clap/.test(fixed[1]));
  assert.ok(/^The artist: Taylor Swift/.test(fixed[2]));
  console.log('parody angle tests passed');
})();
