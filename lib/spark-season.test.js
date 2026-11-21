'use strict';

const assert = require('assert');
const spark = require('./spark');

function at(iso) { return new Date(iso); }

assert.strictEqual(spark.thanksgivingOpen(at('2026-11-19T07:59:00Z'), ''), false);
assert.strictEqual(spark.thanksgivingOpen(at('2026-11-19T08:00:00Z'), ''), true);
assert.strictEqual(spark.thanksgivingOpen(at('2026-11-21T20:00:00Z'), ''), true);
assert.strictEqual(spark.thanksgivingOpen(at('2026-11-28T07:59:00Z'), ''), true);
assert.strictEqual(spark.thanksgivingOpen(at('2026-11-28T08:00:00Z'), ''), false);
assert.strictEqual(spark.thanksgivingOpen(at('2026-01-01T20:00:00Z'), 'thanksgiving'), true);
assert.strictEqual(spark.thanksgivingOpen(at('2026-11-21T20:00:00Z'), 'off'), false);
assert.strictEqual(spark.THANKSGIVING_CARDS.length, 3);
assert.ok(spark.THANKSGIVING_CARDS.some(function (card) { return card.title === 'Their hands'; }));
assert.ok(spark.THANKSGIVING_CARDS.some(function (card) { return card.title === 'On the way there'; }));
assert.ok(spark.THANKSGIVING_CARDS.some(function (card) { return card.title === "Who's at the table"; }));
assert.ok(!/—|–|Suno|%/.test(JSON.stringify(spark.THANKSGIVING_CARDS)));
assert.ok(spark.LANES.some(function (lane) { return lane.id === 'trending'; }));

console.log('spark-season.test.js ok');
