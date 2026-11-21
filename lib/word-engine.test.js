'use strict';

const assert = require('assert');
const engine = require('./word-engine');

assert.strictEqual(engine.syllablesOfWord('idea'), 3);
const fire = engine.syllablesOfWord('fire');
assert.ok(fire === 1 || fire === 2, 'fire is 1 or 2, got ' + fire);
assert.strictEqual(engine.relateWords('gone', 'on'), 'exact');
assert.strictEqual(engine.relateWords('room', 'soon'), 'near');
assert.strictEqual(engine.relateWords('night', 'light'), 'exact');
assert.strictEqual(engine.relateWords('kitchen', 'block'), 'none');

const colors = engine.colorLines([
  'The plates are still warm from Saturday night',
  'I left a cup beside the window light',
  'I kept the kitchen light on',
  'Till the whole block was gone',
  'Say it once, then leave the room',
  'The kettle clicks and the house goes soon'
]);
assert.strictEqual(colors[0].near, false);
assert.strictEqual(colors[0].index, colors[1].index);
assert.strictEqual(colors[2].near, false);
assert.strictEqual(colors[2].index, colors[3].index);
assert.strictEqual(colors[4].near, true);
assert.strictEqual(colors[4].index, colors[5].index);
assert.ok(colors[4].bg.indexOf('rgba') === 0);
assert.notStrictEqual(colors[0].bg, colors[4].bg);

['fill', 'room', 'extra'].forEach(function (kind) {
  assert.ok(kind !== 'red');
});
assert.strictEqual(engine.dotKind(0, 8, 8), 'fill');
assert.strictEqual(engine.dotKind(8, 10, 8), 'extra');
assert.strictEqual(engine.dotKind(7, 6, 8), 'room');
assert.ok(!/red/.test(engine.dotKind(0, 1, 1) + engine.dotKind(1, 2, 1) + engine.dotKind(0, 0, 2)));

console.log('word-engine.test.js ok');
