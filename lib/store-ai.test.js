'use strict';

const assert = require('assert');
const storeAi = require('./store-ai');

function run() {
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
  assert.strictEqual(assisted.ai_service_other, undefined);
  assert.strictEqual(assisted.ai_service, undefined);
  assert.ok(!Object.prototype.hasOwnProperty.call(assisted, 'ai_service_other'));
  assert.deepStrictEqual(assisted.ai_elements, ['instrumentation', 'composition', 'production']);
  assert.ok(!/suno/i.test(JSON.stringify(assisted)));
  assert.ok(!/I wrote the lyrics/.test(JSON.stringify(assisted)), 'human description is not a tool name');

  const full = storeAi.trackAiFields({ made_how: 'fully_ai', human_contribution: '' });
  assert.deepStrictEqual(full.track_properties, ['includes_ai']);
  assert.strictEqual(full.ai_service_other, undefined);
  assert.strictEqual(full.ai_service, undefined);
  assert.deepStrictEqual(full.ai_elements, ['vocals', 'instrumentation', 'composition', 'lyrics', 'production']);
  assert.ok(!/suno/i.test(JSON.stringify(full)));
  assert.ok(!/generative AI/.test(JSON.stringify(full)));

  const fullLyrics = storeAi.trackAiFields({
    made_how: 'fully_ai',
    human_elements: ['Original lyrics'],
    human_contribution: 'I wrote the words.',
  });
  assert.deepStrictEqual(fullLyrics.ai_elements, ['vocals', 'instrumentation', 'composition', 'production']);
  assert.ok(fullLyrics.ai_elements.indexOf('lyrics') === -1);
  assert.strictEqual(fullLyrics.ai_service_other, undefined);

  const chipsOnly = storeAi.trackAiFields({
    made_how: 'ai_assisted',
    human_elements: ['Original lyrics'],
    human_contribution: '   ',
  });
  assert.strictEqual(chipsOnly.ai_service_other, undefined);
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
  assert.strictEqual(payload.ai_service_other, undefined);
  assert.deepStrictEqual(payload.ai_elements, ['vocals', 'instrumentation', 'composition', 'lyrics', 'production']);

  assert.strictEqual(storeAi.shouldClearTrackAi({ made_how: 'no_ai' }), true);
  assert.strictEqual(storeAi.shouldClearTrackAi({ made_how: 'fully_ai' }), false);
  assert.deepStrictEqual(storeAi.clearTrackProperties(['remix', 'includes_ai', '']), ['remix']);
  assert.deepStrictEqual(storeAi.clearTrackProperties(null), []);

  assert.strictEqual(storeAi.aiDisclosureOf({ made_how: 'no_ai' }), 'none');
  assert.strictEqual(storeAi.aiDisclosureOf({ made_how: 'ai_assisted' }), 'partial');
  assert.strictEqual(storeAi.aiDisclosureOf({ made_how: 'fully_ai' }), 'full');
  assert.strictEqual(storeAi.aiDisclosureOf({}), '');

  const suno = storeAi.trackAiFields({
    made_how: 'ai_assisted',
    ai_service: 'suno',
    human_contribution: 'I wrote the lyrics and sang the lead.',
    human_elements: ['Lead vocals performed', 'Original lyrics'],
  });
  assert.strictEqual(suno.ai_service, 'Suno');
  assert.strictEqual(suno.ai_service_other, undefined);
  assert.deepStrictEqual(suno.track_properties, ['includes_ai']);
  assert.deepStrictEqual(suno.ai_elements, ['instrumentation', 'composition', 'production']);
  assert.ok(!/I wrote the lyrics/.test(JSON.stringify(suno)));

  const udio = storeAi.trackAiFields({ made_how: 'fully_ai', ai_tool: 'Udio' });
  assert.strictEqual(udio.ai_service, 'Udio');
  assert.strictEqual(udio.ai_service_other, undefined);

  const other = storeAi.trackAiFields({
    made_how: 'fully_ai',
    ai_service_other: 'My Tool',
    human_elements: ['Original lyrics'],
    human_contribution: 'I wrote the words.',
  });
  assert.strictEqual(other.ai_service, undefined);
  assert.strictEqual(other.ai_service_other, 'My Tool');
  assert.deepStrictEqual(other.ai_elements, ['vocals', 'instrumentation', 'composition', 'production']);
  assert.ok(!/I wrote the words/.test(JSON.stringify(other)));

  const promoted = storeAi.trackAiFields({
    made_how: 'ai_assisted',
    ai_service_other: 'Suno',
    human_elements: ['Original lyrics'],
  });
  assert.strictEqual(promoted.ai_service, 'Suno');
  assert.strictEqual(promoted.ai_service_other, undefined);

  const both = storeAi.applyTrackAiFields({}, {
    made_how: 'ai_assisted',
    ai_service: 'Suno',
    ai_service_other: 'My Tool',
    human_elements: ['Original lyrics'],
  });
  assert.strictEqual(both.ai_service, 'Suno');
  assert.strictEqual(both.ai_service_other, undefined);

  console.log('lib/store-ai.test.js ok');
}

run();
