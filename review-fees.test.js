'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function run() {
  const review = read('review.html');
  const submitted = read('submitted.html');
  const split = read('split-sheet.html');
  const attest = read('attest.html');

  ['$199', '$49', '$248', 'Distribution lead', 'fees shown in full'].forEach(function (needle) {
    assert.ok(review.indexOf(needle) === -1, 'review.html still has ' + needle);
    assert.ok(submitted.indexOf(needle) === -1, 'submitted.html still has ' + needle);
    assert.ok(split.indexOf(needle) === -1, 'split-sheet.html still has ' + needle);
    assert.ok(attest.indexOf(needle) === -1, 'attest.html still has ' + needle);
  });

  assert.ok(review.indexOf('$0 · included in membership') !== -1);
  assert.ok(review.indexOf('Total</span><strong class="total">$0.00</strong>') !== -1 || review.indexOf('$0.00') !== -1);
  assert.ok(review.indexOf('Nothing is charged on this screen') !== -1);
  assert.ok(review.indexOf('data-review-upsell') !== -1);
  assert.ok(review.indexOf('checkout.js') === -1);
  assert.ok(review.indexOf('data-checkout-plan') === -1);
  assert.ok(review.indexOf('Pay and submit') === -1);
  assert.ok(review.indexOf('Charged now') === -1);
  assert.ok(review.indexOf('Every store costs the same one fee') === -1);
  assert.ok(review.indexOf('Optional · $9.99') !== -1);
  assert.ok(!/Due now[\s\S]*\$9\.99/.test(review));

  assert.ok(submitted.indexOf('$0.00 · included in membership') !== -1);
  assert.ok(split.indexOf('$0 · included in membership') !== -1);
  assert.ok(split.indexOf('None taken by PLAIGROUND') !== -1);

  const upsell = { hidden: true, classList: { tokens: Object.create(null), toggle(name, force) { if (force) this.tokens[name] = true; else delete this.tokens[name]; } } };
  function bind(plan, paid) {
    const context = {
      document: {
        querySelector(sel) { return sel === '[data-review-upsell]' ? upsell : null; },
      },
      window: {
        PlaigroundMembership: {
          currentPlan() { return plan; },
          hasPaidAccess() { return paid; },
          whenReady(cb) { cb(); },
        },
      },
    };
    context.window.document = context.document;
    const src = review.match(/<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>/);
    assert.ok(src, 'missing review upsell script');
    vm.runInNewContext(src[0].replace(/^<script>/, '').replace(/<\/script>$/, ''), context);
    return upsell.hidden;
  }

  assert.strictEqual(bind('basic', false), false, 'Basic should see the one upsell');
  upsell.hidden = true;
  assert.strictEqual(bind('creator', true), true, 'Creator should skip checkout and hide the upsell');
  upsell.hidden = true;
  assert.strictEqual(bind('pro', true), true, 'Pro should skip checkout and hide the upsell');

  console.log('review-fees.test.js ok');
}

run();
