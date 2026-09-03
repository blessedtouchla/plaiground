'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tonegridApi = require('../api/tonegrid');

function run() {
  assert.strictEqual(tonegridApi.protectedCatalogIdMatch('d412cc82', 'd412cc82-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), true);
  assert.strictEqual(tonegridApi.protectedCatalogIdMatch('37524790', '37524790-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), true);
  assert.strictEqual(tonegridApi.protectedCatalogIdMatch('e41e056b', 'e41e056b-cccc-4ccc-8ccc-cccccccccccc'), true);
  assert.strictEqual(tonegridApi.protectedCatalogIdMatch('9956c52b', '9956c52b-dddd-4ddd-8ddd-dddddddddddd'), true);
  assert.strictEqual(tonegridApi.protectedCatalogIdMatch('df51342b-ba22-4093-93ff-35b6402b61c0', 'df51342b'), true);
  assert.strictEqual(tonegridApi.protectedCatalogIdMatch('6629b532-2e78-4be6-84eb-e4dfa9ac33e5', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), false);

  assert.ok(tonegridApi.isProtectedCatalogRelease('d412cc82-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'GOLDEN ERA'));
  assert.ok(tonegridApi.isProtectedCatalogRelease('37524790-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Night sky'));
  assert.ok(tonegridApi.isProtectedCatalogRelease('e41e056b-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Lightning'));
  assert.ok(tonegridApi.isProtectedCatalogRelease('9956c52b-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Game time'));
  assert.ok(tonegridApi.isProtectedCatalogRelease('6629b532-2e78-4be6-84eb-e4dfa9ac33e5', 'Metete'));
  assert.ok(tonegridApi.isProtectedCatalogRelease('df51342b-ba22-4093-93ff-35b6402b61c0', 'Thank You, Dolly'));
  assert.ok(tonegridApi.isProtectedCatalogRelease('7544eade-ce02-472c-92d0-a5d61609999d', 'Too the moon'));

  assert.strictEqual(tonegridApi.protectHardDelete('1f26369b-e107-4c79-bde1-4c5382f9d511', 'Lightning'), true);
  assert.strictEqual(tonegridApi.protectHardDelete('9956c52b-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Game time'), true);
  assert.strictEqual(tonegridApi.protectHardDelete('e41e056b-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Lightning'), true);
  assert.strictEqual(tonegridApi.protectHardDelete('d412cc82-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'GOLDEN ERA'), true);
  assert.strictEqual(tonegridApi.protectHardDelete('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Some other song'), false);

  const attest = fs.readFileSync(path.join(__dirname, '..', 'attest.html'), 'utf8');
  assert.ok(attest.indexOf('id="attest-performer"') !== -1);
  assert.ok(attest.indexOf('id="attest-producer"') !== -1);
  assert.ok(attest.indexOf('id="attest-engineer"') !== -1);
  assert.ok(attest.indexOf('data-credits-card') !== -1);

  const client = fs.readFileSync(path.join(__dirname, '..', 'store-client.js'), 'utf8');
  assert.ok(client.indexOf('e41e056b') !== -1, 'Lightning draft prefix must stay off leftover Retry dump');
  assert.ok(/if \(isProtectedCatalogRelease\(draft\.release_id, draft\.title\)\) return false;/.test(client));

  console.log('lib/catalog-protect.test.js ok');
}

run();
