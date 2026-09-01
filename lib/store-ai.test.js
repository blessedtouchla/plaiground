'use strict';

const assert = require('assert');
const storeAi = require('./store-ai');

function run() {
  assert.strictEqual(storeAi.GENERIC_AI_SERVICE, 'generative AI');
  assert.strictEqual(storeAi.usesAi({ made_how: 'no_ai' }), false);
  assert.strictEqual(storeAi.usesAi({ made_how: 'ai_assisted' }), true);
  assert.strictEqual(storeAi.usesAi({ made_how: 'fully_ai' }), true);
  assert.strictEqual(storeAi.usesAi({}), false);
  assert.strictEqual(storeAi.trackAiFields({ made_how: 'no_ai' }), null);
  assert.strictEqual(storeAi.trackAiFields({ made_how: 'no_ai', human_contribution: 'I wrote it.' }), null);

  const assisted = storeAi.trackAiFields({
    made_how: 'ai_assisted',
    human_contribution: 'I wrote the lyrics and sang the lead.',
  });
  assert.deepStrictEqual(assisted.track_properties, ['includes_ai']);
  assert.strictEqual(assisted.ai_service_other, 'I wrote the lyrics and sang the lead.');
  assert.strictEqual(assisted.ai_service, undefined);
  assert.ok(!/suno/i.test(JSON.stringify(assisted)));

  const full = storeAi.trackAiFields({ made_how: 'fully_ai', human_contribution: '' });
  assert.deepStrictEqual(full.track_properties, ['includes_ai']);
  assert.strictEqual(full.ai_service_other, 'generative AI');
  assert.strictEqual(full.ai_service, undefined);
  assert.ok(!/suno/i.test(JSON.stringify(full)));

  const chipsOnly = storeAi.trackAiFields({
    made_how: 'ai_assisted',
    human_elements: ['Original lyrics'],
    human_contribution: '   ',
  });
  assert.strictEqual(chipsOnly.ai_service_other, 'generative AI');

  const payload = { title: 'Night Drive' };
  storeAi.applyTrackAiFields(payload, { made_how: 'no_ai' });
  assert.strictEqual(payload.track_properties, undefined);
  assert.strictEqual(payload.ai_service_other, undefined);

  storeAi.applyTrackAiFields(payload, { made_how: 'fully_ai' });
  assert.deepStrictEqual(payload.track_properties, ['includes_ai']);
  assert.strictEqual(payload.ai_service_other, 'generative AI');

  console.log('lib/store-ai.test.js ok');
}

run();
