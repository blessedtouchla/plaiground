'use strict';
const assert = require('assert');
const sv = require('./submit-verify');
const id = '0ccd4586-53ba-49e2-b963-29e9ab9394d6';
const t = 1792470538000;
// double tap within the same minute window: same key
assert.strictEqual(sv.submitKey(id, { status: 'rejected' }, t), sv.submitKey(id, { status: 'rejected' }, t + 1000 - (t % 60000) % 1000));
// resubmit later after Returned for Changes: new key
assert.notStrictEqual(sv.submitKey(id, { status: 'pending' }, t), sv.submitKey(id, { status: 'rejected' }, t + 55 * 60000));
assert.notStrictEqual(sv.submitKey(id, { status: 'rejected' }, t), sv.submitKey(id, { status: 'rejected' }, t + 61000));
assert.notStrictEqual(sv.submitKey(id, { status: 'rejected', updated_at: 'a' }, t), sv.submitKey(id, { status: 'rejected', updated_at: 'b' }, t));
// landed checks
assert.strictEqual(sv.submitLanded('rejected', 'pending'), true);
assert.strictEqual(sv.submitLanded('draft', 'qc_inspection'), true);
assert.strictEqual(sv.submitLanded('rejected', 'rejected'), false);
assert.strictEqual(sv.submitLanded('draft', 'draft'), false);
assert.strictEqual(sv.submitLanded('', ''), false);
assert.strictEqual(sv.submitLanded('pending', 'pending'), false);
assert.ok(!/—/.test(sv.NOT_SENT_COPY));
console.log('submit-verify.test.js ok');
