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
  const teslaCutStart = css.indexOf('/* —— Upload Tesla cut (one progress line + tiny leave icons) —— */');
  const brandAccentsStart = css.indexOf('/* —— Upload brand accents (Tesla leftover: sparse purple/gold) —— */');
  const sleeveQuietStart = css.indexOf('/* —— Upload sleeve helper quiet (chips + BUILDING YOUR RELEASE stay) —— */');
  const headerOnly = headerCssStart === -1 || teslaCutStart === -1 ? '' : css.slice(headerCssStart, teslaCutStart);
  const teslaCss = teslaCutStart === -1 ? '' : css.slice(teslaCutStart, brandAccentsStart === -1 ? (sleeveQuietStart === -1 ? css.length : sleeveQuietStart) : brandAccentsStart);
  const brandCss = brandAccentsStart === -1 ? '' : css.slice(brandAccentsStart, sleeveQuietStart === -1 ? css.length : sleeveQuietStart);
  const stageCss = stageCssStart === -1 ? '' : css.slice(stageCssStart, headerCssStart === -1 ? css.length : headerCssStart);
  const headerCss = headerCssStart === -1 ? '' : css.slice(headerCssStart);
  const steps = stepperBlock(upload);
  const cssLinks = upload.match(/href="site\.css\?v=[^"]+"/g) || [];

  assert.ok(upload.includes('site.css?v=20260912ba2'), 'brand accents cache-busts site.css at 20260912ba2');
  assert.strictEqual(cssLinks.length, 1, 'one site.css link only — no sg4+ly8 double stamp');
  assert.ok(!upload.includes('site.css?v=20260912sg4'), 'sg4 stamp is retired');
  assert.ok(!upload.includes('site.css?v=20260912ly8'), 'ly8 stamp is retired');
  assert.ok(!upload.includes('site.css?v=20260912tc1'), 'tc1 stamp is retired');
  assert.ok(!upload.includes('site.css?v=20260912tc2'), 'tc2 stamp is retired');
  assert.ok(upload.includes('lib/upload-stage.js?v=20260912s7'), 'Release-stage helper stamp follows the title leftover');
  assert.ok(upload.includes('lib/upload-audio-bind.js?v=20260912tc3'), 'audio-bind stamp follows the Photo Library leftover');
  assert.ok(upload.includes('lib/audio-accept.js?v=20260912tc3'), 'audio-accept stamp follows the Photo Library leftover');

  assert.ok(upload.indexOf('data-upload-kicker') < upload.indexOf('class="stepper"'), 'Submit a song sits at the top of the page');
  assert.ok(/<b>Upload<\/b>/.test(steps), 'step 1 is Upload');
  assert.ok(/<b>Attest<\/b>/.test(steps), 'step 2 is Attest');
  assert.ok(/<b>Splits<\/b>/.test(steps), 'step 3 is Splits');
  assert.ok(/<b>Review<\/b>/.test(steps), 'step 4 is Review');
  assert.ok(steps.indexOf('href="upload.html"') !== -1, 'Upload step keeps the existing href');
  assert.ok(steps.indexOf('href="attest.html"') !== -1, 'Attest step keeps the existing href');
  assert.ok(steps.indexOf('href="split-sheet.html"') !== -1, 'Splits step keeps the existing href');
  assert.ok(/upload-step-splits sr-only/.test(steps), 'Splits is soft-stopped from the visible progress chrome only');
  assert.ok(steps.indexOf('href="review.html"') !== -1, 'Review step keeps the existing href');
  assert.ok(steps.indexOf('class="st on"') !== -1, 'current step still uses .st.on');
  assert.ok(!/Upload Audio|Attest rights|Split sheet|Review &amp; pay|Audio and details|AI disclosure|Writers and shares|Cost and delivery/.test(steps), 'tall step card copy is gone from Upload header');

  assert.ok(upload.includes('data-release-type'), 'Release type hook stays');
  assert.ok(upload.includes('data-type-toggle'), 'type toggle hook stays');
  assert.ok(/data-type="single">Single</.test(upload), 'Single control stays');
  assert.ok(/data-type="album">Album</.test(upload), 'Album control stays');
  assert.ok(upload.includes('class="upload-type-line"'), 'Release type is a quiet line');
  assert.ok(!/<section class="flow-card[^"]*" data-release-type>/.test(upload), 'Release type is not a full-width card');

  assert.ok(/data-upload-cancel[^>]*aria-label="Cancel"/.test(upload), 'Cancel is a tiny icon with an accessible name');
  assert.ok(/data-upload-start-over[^>]*aria-label="Start over"/.test(upload), 'Start over is a tiny icon with an accessible name');
  assert.ok(upload.includes('upload-leave-icon'), 'leave actions are quieter icon buttons');
  assert.ok(!/data-upload-cancel[^>]*>Cancel</.test(upload), 'Cancel word label is soft-stopped on Upload');
  assert.ok(!/data-upload-start-over[^>]*>Start over</.test(upload), 'Start over word label is soft-stopped on Upload');
  assert.ok(upload.includes('upload-progress-row'), 'steps and leave share a top row');
  assert.ok(upload.indexOf('upload-leave-actions') < upload.indexOf('data-upload-heading'), 'Cancel / Start over sit with the steps, not under the title');
  assert.ok(headerCss.includes('margin-left: auto'), 'leave actions stay on the right');
  assert.ok(headerCss.includes('.upload-page .upload-progress-row'), 'progress row pins leave clear of the title clump');
  assert.ok(teslaCss.includes('.upload-leave-icon'), 'Tesla cut paints the tiny leave icons');

  assert.ok(headerOnly.includes('text-transform: uppercase'), 'top steps are small-caps');
  assert.ok(headerOnly.includes('letter-spacing: 0.18em'), 'top steps keep tracking');
  assert.ok(headerOnly.includes('content: "·"') || headerOnly.includes("content: '·'"), 'top steps use muted middot separators');
  assert.ok(!headerOnly.includes('border-radius: 999px'), 'heavy colored progress pills are soft-stopped');
  assert.ok(!headerOnly.includes('var(--magenta)'), 'top steps do not use brand-fill pills');
  assert.ok(!headerOnly.includes('#4C7DFF') && !headerOnly.includes('#E89A3F'), 'header does not invent hex off the brand board');
  assert.ok(upload.includes('family=Space+Grotesk'), 'Space Grotesk loads from Google Fonts');
  assert.ok(upload.includes('family=Inter'), 'body Inter stays loaded');
  assert.strictEqual((upload.match(/fonts\.googleapis\.com\/css2/g) || []).length, 1, 'one Google Fonts link — Inter + Space Grotesk together');
  assert.ok(/\.upload-page \.upload-hero[\s\S]*?font-family:\s*"Space Grotesk"/.test(headerCss), 'Submit a song is Space Grotesk');
  assert.ok(/\.upload-page \.upload-hero[\s\S]*?font-size:\s*clamp\(2\.4rem/.test(headerCss), 'Submit a song is the biggest title');
  assert.ok(/data-upload-heading>Upload</.test(upload), 'Upload heading hook stays for album copy');
  assert.ok(/upload-page-label sr-only/.test(upload), 'extra Upload label is sr-only when steps already say Upload');
  assert.ok(teslaCss.includes('.upload-page .upload-page-label'), 'Tesla cut hides the extra Upload label');
  assert.ok(!/Outfit|Syne|Clash|Satoshi/.test(upload + headerCss), 'do not invent Outfit / Syne / Clash / Satoshi');
  assert.ok(css.includes('font-family: Inter, -apple-system'), 'body stays Inter');
  assert.ok(headerOnly.includes('cursor: default'), 'top steps read as progress, not a must-select control');
  assert.ok(headerCss.includes('.upload-page .upload-type-toggle a + a::before'), 'Single | Album is a quiet line');
  assert.ok(/\.upload-page \.upload-type-toggle a\.on[\s\S]*?color:\s*var\(--stage-purple\)/.test(headerCss), 'selected Single | Album is Primary Purple');
  assert.ok(/\.upload-page \.st\.on b[\s\S]*?color:\s*var\(--stage-purple\)/.test(headerCss), 'active progress step is Primary Purple');
  assert.ok(!headerOnly.includes('#e8e8ee'), 'active step is not leftover near-white chrome');
  assert.ok(headerCss.includes('color: var(--muted)'), 'caption and inactive chrome stay muted');
  assert.ok(brandCss.includes('.upload-step-splits'), 'brand accents hide Splits from the visible line');
  assert.ok(brandCss.includes('.stage-chip.chip-audio'), 'Add audio uses the primary purple accent');
  assert.ok(brandCss.includes('var(--stage-purple)'), 'primary accent stays on --stage-purple');
  assert.ok(brandCss.includes('.stage-chip.chip-cover'), 'Add cover uses the gold secondary');
  assert.ok(brandCss.includes('var(--stage-gold)'), 'gold moments stay on --stage-gold');
  assert.ok(brandCss.includes('var(--stage-magenta)'), 'magenta is reserved for rare error/attention');
  assert.ok(!/#61[Bb]63[Aa]|#F09416|#3FE07A/.test(brandCss), 'Green/Orange stay off Upload chrome this pass');
  assert.ok(!/#7[Dd]3[Cc][Ff][Ff]|#8[Aa]4[Dd][Ff][Ff]|#FF3C8E|#F5C542/.test(brandCss), 'brand accents do not invent leftover site hexes');
  assert.ok(!headerOnly.includes('.release-stage-progress'), 'header rules do not restyle BUILDING YOUR RELEASE');
  assert.ok(teslaCss.includes('.release-stage-progress'), 'Tesla cut soft-stops BUILDING YOUR RELEASE chrome');
  assert.ok(/release-stage-progress sr-only/.test(upload), 'BUILDING YOUR RELEASE stays in the DOM for AT, not a second progress line');
  assert.ok(stageCss.includes('border-top: 1px solid #f3cb47'), 'gold hairline stays on the Release stage');
  assert.ok(sleeveQuietStart !== -1, 'wordy sleeve helper chrome is quieted');
  assert.ok(css.includes('.release-stage-drop span'), 'long drop helper line is visually dropped');

  assert.ok(upload.includes('Building your release'), 'progress copy stays in the DOM');
  assert.ok(upload.includes('Audio · Cover · Credits · Send'), 'stage words stay in the DOM');
  assert.ok(/>Add audio</.test(upload), 'Add audio chip stays');
  assert.ok(/>Add cover</.test(upload), 'Add cover chip stays');
  assert.ok(upload.includes('data-release-stage'), 'Release stage stays below the header');
  const sleeveChunk = upload.slice(upload.indexOf('data-release-sleeve'), upload.indexOf('release-sleeve-actions'));
  assert.ok(!sleeveChunk.includes('id="tg-title"'), 'Song title is not overlaid on the sleeve');
  assert.ok(!upload.includes('release-sleeve-title-wrap'), 'sleeve title wrap is gone');
  assert.ok(!upload.includes('release-sleeve-title-input'), 'overlay title input class is gone');
  assert.ok(upload.includes('class="field upload-title-field"'), 'Song title is a clear text-box field');
  assert.ok(/<label for="tg-title"[^>]*>Song title</.test(upload), 'Song title label is visible');
  assert.ok(/id="tg-title"[^>]*placeholder="Song title"/.test(upload), 'existing title field keeps a visible placeholder');
  assert.ok(teslaCss.includes('.upload-title-field'), 'Tesla cut paints the off-sleeve title field');
  assert.ok(upload.includes('id="tg-instrumental"'), 'Instrumental control is left for its own lane');
  assert.ok(upload.includes('data-lyrics-open'), 'Lyrics control is left for its own lane');
  assert.ok(upload.includes('upload-audio-splat'), 'empty splat from #274 stays');
  assert.ok(upload.includes('>Preview<'), 'Preview from #274 stays');
  assert.ok(upload.includes('data-audio-clear'), 'Clear from #274 stays');
  const audioTag = upload.match(/<input[^>]*id="tg-audio-file"[^>]*>/)[0];
  assert.ok(!/accept="[^"]*audio\/\*/.test(audioTag), 'Add audio accept has no audio/*');
  assert.ok(!/accept="[^"]*\*\/\*/.test(audioTag), 'Add audio accept has no */*');
  assert.ok(!/accept="[^"]*image/.test(audioTag), 'Add audio accept has no image types');
  assert.ok(!/\bcapture\b/.test(audioTag), 'Add audio has no capture attribute');
  assert.ok(!/m4a|aiff|aif/i.test(audioTag), 'Add audio still matches Upload WAV/FLAC/MP3');
  const artTag = upload.match(/<input[^>]*id="tg-art-file"[^>]*>/)[0];
  assert.ok(/image\/jpeg|image\/png/.test(artTag), 'Cover picker stays image-capable');

  assert.ok(!/data-upload-save-draft/.test(upload), 'Save draft stays cancelled');
  assert.ok(!/Save draft/.test(upload), 'Save draft copy is not invented');
  assert.ok(!/App Store/.test(upload), 'no App Store invent');
  assert.ok(!/Sign In computer|Grok invent|splat invent/i.test(upload), 'no Sign In computer / Grok / splat invent');
  assert.ok(!/ToneGrid|DistroKid|distributor/i.test(upload.replace(/tonegrid\.js|store-client/g, '')), 'no distributor rename');
  assert.ok(!/hop\.put|create-artist/.test(stage), 'stage helper still does not invent hop');
  assert.ok(upload.indexOf('lib/object-store.js') === -1, 'no server object-store on Upload');
  assert.ok(upload.includes('data-store-continue'), 'Continue hop stays');
  assert.ok(upload.includes('href="attest.html"'), 'Continue still goes to attest');

  const attest = read('attest.html');
  const review = read('review.html');
  const split = read('split-sheet.html');
  function visibleProgress(html) {
    const start = html.indexOf('aria-label="Release progress"');
    assert.ok(start !== -1, 'flow page keeps the Tesla progress line');
    const end = html.indexOf('</nav>', start);
    return html.slice(start, end);
  }
  const attestSteps = visibleProgress(attest);
  const reviewSteps = visibleProgress(review);
  assert.ok(attest.includes('class="page wrap-wide upload-page"'), 'Attest reuses Tesla progress paint');
  assert.ok(review.includes('class="page wrap-wide upload-page"'), 'Review reuses Tesla progress paint');
  assert.ok(/class="st on"[^>]*href="attest.html"/.test(attestSteps), 'Attest is the active step on Attest');
  assert.ok(/class="st on"[^>]*href="review.html"/.test(reviewSteps), 'Review is the active step on Review');
  assert.ok(/upload-step-splits sr-only/.test(attestSteps), 'Attest hides Splits from the visible progress chrome');
  assert.ok(/upload-step-splits sr-only/.test(reviewSteps), 'Review hides Splits from the visible progress chrome');
  assert.ok(attestSteps.indexOf('href="split-sheet.html"') !== -1, 'Attest still links the splits step');
  assert.ok(reviewSteps.indexOf('href="split-sheet.html"') !== -1, 'Review still links the splits step');
  assert.ok(split.includes('class="stepper"'), 'split-sheet flow itself stays');
  assert.ok(!/01 Upload Audio|02 Attest rights|03 Split sheet|03 Writers and splits/.test(attestSteps + reviewSteps), 'tall leftover cards stay off Attest/Review chrome');

  console.log('upload-header.test.js: ok');
}

run();
