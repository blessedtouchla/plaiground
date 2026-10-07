'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const reposition = require('./cover-reposition');

function nearly(actual, expected, eps) {
  const gap = Math.abs(actual - expected);
  const limit = typeof eps === 'number' ? eps : 1e-6;
  assert.ok(gap <= limit, actual + ' !~ ' + expected);
}

function assertNoLetterbox(state, view) {
  const frame = reposition.frameOf(state);
  assert.ok(frame.sx >= -1e-6, 'crop starts inside the image');
  assert.ok(frame.sy >= -1e-6, 'crop starts inside the image');
  assert.ok(frame.sx + frame.side <= state.iw + 1e-6, 'crop stays inside the width');
  assert.ok(frame.sy + frame.side <= state.ih + 1e-6, 'crop stays inside the height');
  const box = reposition.layout(state, view);
  assert.ok(box.left <= 1e-6, 'image covers the left edge');
  assert.ok(box.top <= 1e-6, 'image covers the top edge');
  assert.ok(box.left + box.width >= view - 1e-4, 'image covers the right edge');
  assert.ok(box.top + box.height >= view - 1e-4, 'image covers the bottom edge');
}

function geometry() {
  assert.strictEqual(reposition.MIN_ZOOM, 1);
  const portrait = reposition.coverState(900, 1600);
  assert.strictEqual(portrait.zoom, 1);
  nearly(portrait.cx, 450);
  nearly(portrait.cy, 800);
  const centered = reposition.frameOf(portrait);
  nearly(centered.sx, 0);
  nearly(centered.sy, 350);
  nearly(centered.side, 900);
  assertNoLetterbox(portrait, 320);

  const wide = reposition.coverState(1600, 900);
  const wideFrame = reposition.frameOf(wide);
  nearly(wideFrame.sx, 350);
  nearly(wideFrame.sy, 0);
  nearly(wideFrame.side, 900);

  const locked = reposition.coverState(900, 1600);
  reposition.panBy(locked, 80, 0, 320);
  nearly(locked.cx, 450);
  assertNoLetterbox(locked, 320);

  const dropped = reposition.coverState(900, 1600);
  reposition.panBy(dropped, 0, 40, 320);
  assert.ok(dropped.cy < 800, 'dragging down moves the frame toward the top of a portrait');
  assertNoLetterbox(dropped, 320);

  const zoomed = reposition.coverState(900, 1600);
  reposition.setZoom(zoomed, 0.2);
  assert.strictEqual(zoomed.zoom, 1, 'zoom cannot go below the cover fit');
  reposition.setZoom(zoomed, 2);
  assert.strictEqual(zoomed.zoom, 2);
  reposition.panBy(zoomed, 40, 0, 320);
  assert.ok(zoomed.cx < 450, 'zoom in allows a sideways pan');
  assertNoLetterbox(zoomed, 320);
  reposition.panBy(zoomed, -400, -400, 320);
  assertNoLetterbox(zoomed, 320);

  reposition.reset(zoomed);
  assert.strictEqual(zoomed.zoom, 1);
  nearly(zoomed.cx, 450);
  nearly(zoomed.cy, 800);

  const upload = fs.readFileSync(path.join(__dirname, '..', 'upload.html'), 'utf8');
  assert.ok(upload.includes('data-cover-reposition'), 'submit-a-song page has the reposition frame');
  assert.ok(upload.includes('Drag to reposition'), 'hint copy is on the cover step');
  assert.ok(upload.includes('data-cover-reset'), 'Reset stays on the cover step');
  assert.ok(upload.includes('data-cover-zoom'), 'zoom slider stays on the cover step');
  assert.ok(upload.includes('lib/cover-reposition.js'), 'submit-a-song loads the reposition helper');
  assert.ok(upload.includes('Resize for me'), 'existing resize control stays');
  const song = fs.readFileSync(path.join(__dirname, '..', 'song.html'), 'utf8');
  assert.ok(!song.includes('data-cover-reposition'), 'song edit does not grow a second crop UI');
}

function loadQc() {
  const sandbox = {
    FAKE_W: 900,
    FAKE_H: 1600,
    draws: [],
    blobs: [],
    File: typeof File === 'function' ? File : function FileShim() {},
    document: {
      createElement: function () {
        return {
          width: 0,
          height: 0,
          getContext: function () {
            return {
              imageSmoothingEnabled: false,
              imageSmoothingQuality: '',
              drawImage: function () {
                sandbox.draws.push(Array.prototype.slice.call(arguments));
              }
            };
          },
          toBlob: function (cb, type, quality) {
            sandbox.blobs.push({ type: type, quality: quality });
            cb({ size: 1200, type: type });
          }
        };
      }
    }
  };
  vm.runInNewContext(
    [
      'function Image() {}',
      'Object.defineProperty(Image.prototype, "src", { set: function () {',
      '  this.naturalWidth = FAKE_W; this.naturalHeight = FAKE_H;',
      '  this.width = this.naturalWidth; this.height = this.naturalHeight;',
      '  if (typeof this.onload === "function") this.onload();',
      '} });',
      'this.Image = Image;',
      'this.URL = { createObjectURL: function () { return "blob:test"; }, revokeObjectURL: function () {} };'
    ].join('\n'),
    sandbox
  );
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'cover-qc.js'), 'utf8'), sandbox);
  return sandbox;
}

function exportTests() {
  const sandbox = loadQc();
  const qc = sandbox.PlaigroundCoverQc;
  const file = { name: 'portrait.png', type: 'image/png', size: 50 };
  return qc.resize(file).then(function () {
    const center = sandbox.draws[0];
    assert.strictEqual(center[1], 0);
    assert.strictEqual(center[2], 350);
    assert.strictEqual(center[3], 900);
    assert.strictEqual(center[4], 900);
    assert.strictEqual(center[7], 3000);
    assert.strictEqual(center[8], 3000);
    assert.strictEqual(sandbox.blobs[0].type, 'image/jpeg');
    assert.strictEqual(sandbox.blobs[0].quality, 0.92);
    sandbox.FAKE_W = 900;
    sandbox.FAKE_H = 1600;
    return qc.resize(file, { sx: 12.5, sy: 40.25, side: 500 });
  }).then(function () {
    const framed = sandbox.draws[1];
    assert.strictEqual(framed[1], 12.5);
    assert.strictEqual(framed[2], 40.25);
    assert.strictEqual(framed[3], 500);
    assert.strictEqual(framed[4], 500);
    assert.strictEqual(framed[7], 3000);
    assert.strictEqual(sandbox.blobs[1].quality, 0.92);
    return qc.resize(file, { sx: -20, sy: 1400, side: 900 });
  }).then(function () {
    const clamped = sandbox.draws[2];
    assert.strictEqual(clamped[1], 0);
    assert.strictEqual(clamped[2], 700);
    assert.strictEqual(clamped[3], 900);
  });
}

geometry();
exportTests().then(function () {
  console.log('lib/cover-reposition.test.js ok');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
