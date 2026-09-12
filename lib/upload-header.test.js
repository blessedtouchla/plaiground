'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function stepperBlock(html) {
  const start = html.indexOf('class="stepper"');
  assert.ok(start !== -1, 'Upload keeps the existing stepper');
  const end = html.indexOf('</nav>', start);
  assert.ok(end !== -1, 'Upload stepper is a nav');
  return html.slice(start, end);
}

function run() {
  const upload = read('upload.html');
  const css = read('site.css');
  const stage = read('lib/upload-stage.js');
  const stageCssStart = css.indexOf('/* —— Upload release stage (center sleeve, side chips) —— */');
  const headerCssStart = css.indexOf('/* —— Upload header stage (quiet text steps + type line + tiny leave) —— */');
  const sleeveQuietStart = css.indexOf('/* —— Upload sleeve helper quiet (chips + BUILDING YOUR RELEASE stay) —— */');
  const headerOnly = headerCssStart === -1 ? '' : css.slice(headerCssStart, sleeveQuietStart === -1 ? css.length : sleeveQuietStart);
  const stageCss = stageCssStart === -1 ? '' : css.slice(stageCssStart, headerCssStart === -1 ? css.length : headerCssStart);
  const headerCss = headerCssStart === -1 ? '' : css.slice(headerCssStart);
  const steps = stepperBlock(upload);

  assert.ok(upload.includes('site.css?v=20260912sg3'), 'header paint cache-busts site.css');
  assert.ok(upload.includes('lib/upload-stage.js?v=20260912s5'), 'Release-stage helper stamp is left alone');
  assert.ok(upload.includes('lib/upload-audio-bind.js?v=20260912s1'), 'audio-bind stamp is left alone');

  assert.ok(upload.indexOf('class="stepper"') < upload.indexOf('data-upload-heading'), 'quiet top steps sit above the Upload title band');
  assert.ok(/<b>Upload<\/b>/.test(steps), 'step 1 is Upload');
  assert.ok(/<b>Attest<\/b>/.test(steps), 'step 2 is Attest');
  assert.ok(/<b>Splits<\/b>/.test(steps), 'step 3 is Splits');
  assert.ok(/<b>Review<\/b>/.test(steps), 'step 4 is Review');
  assert.ok(steps.indexOf('href="upload.html"') !== -1, 'Upload step keeps the existing href');
  assert.ok(steps.indexOf('href="attest.html"') !== -1, 'Attest step keeps the existing href');
  assert.ok(steps.indexOf('href="split-sheet.html"') !== -1, 'Splits step keeps the existing href');
  assert.ok(steps.indexOf('href="review.html"') !== -1, 'Review step keeps the existing href');
  assert.ok(steps.indexOf('class="st on"') !== -1, 'current step still uses .st.on');
  assert.ok(!/Upload Audio|Attest rights|Split sheet|Review &amp; pay|Audio and details|AI disclosure|Writers and shares|Cost and delivery/.test(steps), 'tall step card copy is gone from Upload header');

  assert.ok(upload.includes('data-release-type'), 'Release type hook stays');
  assert.ok(upload.includes('data-type-toggle'), 'type toggle hook stays');
  assert.ok(/data-type="single">Single</.test(upload), 'Single control stays');
  assert.ok(/data-type="album">Album</.test(upload), 'Album control stays');
  assert.ok(upload.includes('class="upload-type-line"'), 'Release type is a quiet line');
  assert.ok(!/<section class="flow-card[^"]*" data-release-type>/.test(upload), 'Release type is not a full-width card');

  assert.ok(/class="btn btn-ghost btn-sm" data-upload-cancel>Cancel</.test(upload), 'Cancel stays tiny/outline ghost');
  assert.ok(/class="btn btn-ghost btn-sm" data-upload-start-over>Start over</.test(upload), 'Start over stays tiny/outline ghost');
  assert.ok(upload.includes('upload-progress-row'), 'pills and leave share a top row');
  assert.ok(upload.indexOf('upload-leave-actions') < upload.indexOf('data-upload-heading'), 'Cancel / Start over sit with the pills, not under the title');
  assert.ok(headerCss.includes('margin-left: auto'), 'leave actions stay on the right');
  assert.ok(headerCss.includes('.upload-page .upload-progress-row'), 'progress row pins leave clear of the title clump');

  assert.ok(headerOnly.includes('text-transform: uppercase'), 'top steps are small-caps like BUILDING YOUR RELEASE');
  assert.ok(headerOnly.includes('letter-spacing: 0.18em'), 'top steps use the same tracking as the sleeve progress row');
  assert.ok(headerOnly.includes('content: "·"') || headerOnly.includes("content: '·'"), 'top steps use muted middot separators');
  assert.ok(!headerOnly.includes('border-radius: 999px'), 'heavy colored progress pills are soft-stopped');
  assert.ok(!headerOnly.includes('var(--magenta)'), 'top steps do not use brand-fill pills');
  assert.ok(!headerOnly.includes('#4C7DFF') && !headerOnly.includes('#E89A3F'), 'header does not invent hex off the brand board');
  assert.ok(upload.includes('family=Space+Grotesk'), 'Space Grotesk loads from Google Fonts');
  assert.ok(upload.includes('family=Inter'), 'body Inter stays loaded');
  assert.ok(/\.upload-page \.upload-title[\s\S]*?font-family:\s*"Space Grotesk"/.test(headerCss), 'Upload title stays Space Grotesk');
  assert.ok(/\.upload-page \.upload-title[\s\S]*?color:\s*var\(--purple\)/.test(headerCss), 'Upload title color stays on the Upload brand token');
  assert.ok(!/Outfit|Syne|Clash|Satoshi/.test(upload + headerCss), 'do not invent Outfit / Syne / Clash / Satoshi');
  assert.ok(css.includes('font-family: Inter, -apple-system'), 'body stays Inter');
  assert.ok(headerOnly.includes('cursor: default'), 'top steps read as progress, not a must-select control');
  assert.ok(headerCss.includes('.upload-page .upload-type-toggle a + a::before'), 'Single | Album is a quiet line');
  assert.ok(headerCss.includes('color: var(--muted)'), 'caption and inactive chrome stay muted');
  assert.ok(!headerOnly.includes('.release-stage-progress'), 'header rules do not restyle BUILDING YOUR RELEASE');
  assert.ok(stageCss.includes('border-top: 1px solid #f3cb47'), 'gold hairline stays on the Release stage');
  assert.ok(stageCss.includes('.release-stage-progress'), 'BUILDING YOUR RELEASE chrome stays');
  assert.ok(sleeveQuietStart !== -1, 'wordy sleeve helper chrome is quieted on this branch');
  assert.ok(css.includes('.release-stage-drop span'), 'long drop helper line is visually dropped');

  assert.ok(upload.includes('Building your release'), 'progress copy stays');
  assert.ok(/>Add audio</.test(upload), 'Add audio chip stays');
  assert.ok(/>Add cover</.test(upload), 'Add cover chip stays');
  assert.ok(upload.includes('data-release-stage'), 'Release stage stays below the header');
  assert.ok(upload.includes('id="tg-instrumental"'), 'Instrumental control is left for its own lane');
  assert.ok(upload.includes('data-lyrics-open'), 'Lyrics control is left for its own lane');

  assert.ok(!/data-upload-save-draft/.test(upload), 'Save draft stays cancelled');
  assert.ok(!/Save draft/.test(upload), 'Save draft copy is not invented');
  assert.ok(!/App Store/.test(upload), 'no App Store invent');
  assert.ok(!/Sign In computer|Grok invent|splat invent/i.test(upload), 'no Sign In computer / Grok / splat invent');
  assert.ok(!/ToneGrid|DistroKid|distributor/i.test(upload.replace(/tonegrid\.js|store-client/g, '')), 'no distributor rename');
  assert.ok(!/hop\.put|create-artist/.test(stage), 'stage helper still does not invent hop');
  assert.ok(upload.indexOf('lib/object-store.js') === -1, 'no server object-store on Upload');
  assert.ok(upload.includes('data-store-continue'), 'Continue hop stays');
  assert.ok(upload.includes('href="attest.html"'), 'Continue still goes to attest');

  console.log('upload-header.test.js: ok');
}

run();
