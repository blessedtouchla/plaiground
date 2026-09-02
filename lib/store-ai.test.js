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
    human_elements: ['Original lyrics', 'Lead vocals performed'],
  });
  assert.deepStrictEqual(assisted.track_properties, ['includes_ai']);
  assert.strictEqual(assisted.ai_service_other, 'I wrote the lyrics and sang the lead.');
  assert.strictEqual(assisted.ai_service, undefined);
  assert.deepStrictEqual(assisted.ai_elements, ['instrumentation', 'composition', 'production']);
  assert.ok(!/suno/i.test(JSON.stringify(assisted)));

  const full = storeAi.trackAiFields({ made_how: 'fully_ai', human_contribution: '' });
  assert.deepStrictEqual(full.track_properties, ['includes_ai']);
  assert.strictEqual(full.ai_service_other, 'generative AI');
  assert.strictEqual(full.ai_service, undefined);
  assert.deepStrictEqual(full.ai_elements, ['vocals', 'instrumentation', 'composition', 'lyrics', 'production']);
  assert.ok(!/suno/i.test(JSON.stringify(full)));

  const chipsOnly = storeAi.trackAiFields({
    made_how: 'ai_assisted',
    human_elements: ['Original lyrics'],
    human_contribution: '   ',
  });
  assert.strictEqual(chipsOnly.ai_service_other, 'generative AI');
  assert.deepStrictEqual(chipsOnly.ai_elements, ['vocals', 'instrumentation', 'composition', 'production']);

  const allHuman = storeAi.trackAiFields({
    made_how: 'ai_assisted',
    human_elements: [
      'Original lyrics',
      'Lead vocals performed',
      'Played an instrument',
      'Melody written',
      'Mixed by a person',
    ],
  });
  assert.deepStrictEqual(allHuman.ai_elements, ['instrumentation']);

  const payload = { title: 'Night Drive' };
  storeAi.applyTrackAiFields(payload, { made_how: 'no_ai' });
  assert.strictEqual(payload.track_properties, undefined);
  assert.strictEqual(payload.ai_service_other, undefined);
  assert.strictEqual(payload.ai_elements, undefined);

  storeAi.applyTrackAiFields(payload, { made_how: 'fully_ai' });
  assert.deepStrictEqual(payload.track_properties, ['includes_ai']);
  assert.strictEqual(payload.ai_service_other, 'generative AI');
  assert.deepStrictEqual(payload.ai_elements, ['vocals', 'instrumentation', 'composition', 'lyrics', 'production']);

  console.log('lib/store-ai.test.js ok');
}

run();
