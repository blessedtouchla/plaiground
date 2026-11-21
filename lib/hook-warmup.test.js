'use strict';

const assert = require('assert');
const warm = require('./hook-warmup');

const sample = warm.fallback('kitchen', 'gone');
assert.strictEqual(sample.label, 'Sample reply. Live chat is off.');
assert.strictEqual(sample.titles.length, 3);
assert.strictEqual(sample.live, false);
assert.ok(!/—|–|%/.test(sample.titles.join(' ')));
assert.deepStrictEqual(warm.parseTitles('{"titles":["One","Two","Three"]}'), ['One', 'Two', 'Three']);
assert.strictEqual(warm.parseTitles('nope'), null);

(async function () {
  const off = await warm.handle({ before: 'the car', after: 'home' }, { signedIn: false, xaiConfigured: true });
  assert.strictEqual(off.body.fallback, true);
  assert.ok(off.log.result === 'fallback');
  assert.ok(!JSON.stringify(off.log).includes('car'));

  let seen = null;
  const live = await warm.handle({ before: 'kitchen', after: 'gone' }, {
    signedIn: true,
    xaiConfigured: true,
    chat: function (messages) {
      seen = messages;
      return { content: '{"titles":["Leave the kitchen","Gone, still","From kitchen to gone"]}' };
    }
  });
  assert.strictEqual(live.body.live, true);
  assert.strictEqual(live.body.titles.length, 3);
  assert.strictEqual(seen[0].role, 'system');
  assert.ok(seen[1].content.indexOf('kitchen') >= 0);
  console.log('hook-warmup.test.js ok');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
