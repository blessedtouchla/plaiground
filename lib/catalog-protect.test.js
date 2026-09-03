'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tonegridApi = require('../api/tonegrid');

function run() {
  assert.ok(tonegridApi.isProtectedCatalogRelease('d412cc82-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'GOLDEN ERA'));
  assert.ok(tonegridApi.isRemovedCatalogRelease('df51342b-ba22-4093-93ff-35b6402b61c0'));
  assert.ok(tonegridApi.isRemovedCatalogRelease('7544eade-ce02-472c-92d0-a5d61609999d'));
  assert.ok(!tonegridApi.isRemovedCatalogRelease('d412cc82-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));
  assert.strictEqual(tonegridApi.protectHardDelete('1f26369b-e107-4c79-bde1-4c5382f9d511', 'Lightning'), true);
  assert.strictEqual(tonegridApi.protectHardDelete('9956c52b-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Game time'), true);
  assert.strictEqual(tonegridApi.protectHardDelete('e41e056b-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Lightning'), true);
  assert.strictEqual(tonegridApi.protectHardDelete('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Some other song'), false);

  const client = fs.readFileSync(path.join(__dirname, '..', 'store-client.js'), 'utf8');
  assert.ok(/if \(isProtectedCatalogRelease\(draft\.release_id, draft\.title\)\) return false;/.test(client));
  assert.ok(!/ToneGrid|DistroKid/i.test(fs.readFileSync(path.join(__dirname, '..', 'attest.html'), 'utf8')));

  console.log('lib/catalog-protect.test.js ok');
}

run();
