'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STAMP = '20260912ae1';

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function visibleProgress(html, label) {
  const start = html.indexOf('aria-label="Release progress"');
  assert.ok(start !== -1, label + ' keeps the Tesla progress line');
  const end = html.indexOf('</nav>', start);
  assert.ok(end !== -1, label + ' progress is a nav');
  return html.slice(start, end);
}

function run() {
  const css = read('site.css');
  const upload = read('upload.html');
  const attest = read('attest.html');
  const splits = read('split-sheet.html');
  const review = read('review.html');
  const submitted = read('submitted.html');
  const dashboard = read('dashboard.html');
  const releases = read('releases.html');
  const settings = read('settings.html');
  const boosts = read('boosts.html');
  const artists = read('artists.html');
  const index = read('index.html');
  const how = read('how-it-works.html');
  const howIn = read('how.html');
  const faq = read('faq.html');
  const problem = read('problem.html');
  const teslaPassStart = css.indexOf('/* —— Site Tesla pass (flow + rest-of-site visual system) —— */');
  const teslaPass = teslaPassStart === -1 ? '' : css.slice(teslaPassStart);
  const flow = attest + splits + review + submitted;
  const rest = dashboard + releases + settings + boosts + artists + index + how + howIn + faq + problem;

  assert.ok(teslaPassStart !== -1, 'site Tesla pass is appended after Upload accents');
  assert.ok(css.includes('--stage-blue: #4d7cbe'), 'Logo Blue token stays locked');
  assert.ok(css.includes('--stage-gold: #f3cb47'), 'Gold token stays locked');
  assert.ok(css.includes('--stage-purple: #782fb1'), 'Purple token stays locked');
  const rootBlock = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
  assert.ok(rootBlock.includes('--stage-gold: #f3cb47'), 'Gold token is global so rest-of-site CTAs resolve');
  assert.ok(rootBlock.includes('--stage-purple: #782fb1'), 'Purple token is global so selected segments resolve');
  assert.ok(rootBlock.includes('--stage-blue: #4d7cbe'), 'Logo Blue token is global so progress paint resolves');
  assert.ok(teslaPass.includes('font-family: "Space Grotesk"'), 'titles and pills use Space Grotesk');
  assert.ok(css.includes('font-family: Inter, -apple-system'), 'body stays Inter');
  assert.ok(/\.upload-page \.st\.on b[\s\S]*?color:\s*var\(--stage-blue\)/.test(css), 'active progress stays Logo Blue');
  assert.ok(teslaPass.includes('var(--stage-gold)'), 'Gold click CTAs stay in the rest-of-site pass');
  assert.ok(teslaPass.includes('var(--stage-purple)'), 'Purple selected segments stay in the rest-of-site pass');
  assert.ok(!teslaPass.includes('#d03083') && !teslaPass.includes('#D03083'), 'Magenta stays off this chrome pass');
  assert.ok(!/#3[Ff][Ee]07[Aa]|#F09416/.test(teslaPass), 'Green/Orange stay off this chrome pass');

  [attest, splits, review, dashboard, releases, settings, boosts, artists, index, how, howIn, faq, problem].forEach(function (html) {
    assert.ok(html.includes('site.css?v=' + STAMP), 'touched page cache-busts site.css at ' + STAMP);
    assert.ok(html.includes('family=Space+Grotesk'), 'Space Grotesk loads');
    assert.ok(html.includes('family=Inter'), 'Inter stays loaded');
  });
  assert.ok(upload.includes('site.css?v=20260912cr2'), 'Upload Credits Tesla cut cache-busts site.css at 20260912cr2');
  assert.ok(upload.includes('family=Space+Grotesk'), 'Upload still loads Space Grotesk');
  assert.ok(upload.includes('family=Inter'), 'Upload still loads Inter');

  const attestSteps = visibleProgress(attest, 'Attest');
  const splitSteps = visibleProgress(splits, 'Splits');
  const reviewSteps = visibleProgress(review, 'Review');
  assert.ok(/<b>Upload<\/b>/.test(attestSteps + splitSteps + reviewSteps), 'visible line still names Upload');
  assert.ok(/<b>Attest<\/b>/.test(attestSteps + splitSteps + reviewSteps), 'visible line still names Attest');
  assert.ok(/<b>Review<\/b>/.test(attestSteps + splitSteps + reviewSteps), 'visible line still names Review');
  assert.ok(/upload-step-splits sr-only/.test(attestSteps), 'Attest hides Splits from the visible line');
  assert.ok(/upload-step-splits sr-only/.test(splitSteps), 'Splits hides itself from the visible line');
  assert.ok(/upload-step-splits sr-only/.test(reviewSteps), 'Review hides Splits from the visible line');
  assert.ok(!/01 Upload|02 Attest rights|03 Split sheet|04 Review/.test(splitSteps), 'tall leftover cards stay off Splits chrome');

  assert.ok(attest.includes('upload-leave-icon') && review.includes('upload-leave-icon') && splits.includes('upload-leave-icon'), 'flow pages keep tiny leave icons');
  assert.ok(/data-upload-cancel[^>]*aria-label="Cancel"/.test(attest + review + splits), 'Cancel stays an accessible icon');
  assert.ok(/data-upload-start-over[^>]*aria-label="Start over"/.test(attest + review + splits), 'Start over stays an accessible icon');
  assert.ok(!/data-upload-cancel[^>]*>Cancel</.test(attest + review + splits), 'Cancel word label is soft-stopped on later flow pages');

  assert.ok(attest.indexOf('data-attest-continue') < attest.indexOf('data-have-problem'), 'Attest Have a problem? sits after Continue');
  assert.ok(review.indexOf('data-store-submit') < review.indexOf('data-have-problem'), 'Review Have a problem? sits after Submit');
  assert.ok(splits.indexOf('id="sign-in-page"') < splits.indexOf('data-have-problem'), 'Splits Have a problem? sits after the primary sign CTA');
  assert.ok(submitted.indexOf('Back to dashboard') < submitted.indexOf('data-have-problem'), 'Submitted Have a problem? sits after the primary CTA');

  assert.ok(attest.includes('btn-gold') && review.includes('btn-gold') && splits.includes('btn-gold'), 'later flow pages use gold click CTAs');
  assert.ok(upload.includes('btn-purple btn-lg') && upload.includes('data-store-continue'), 'Upload Continue stays idle after #277');
  assert.ok(!/ToneGrid|DistroKid/i.test((attest + review + submitted + dashboard + index).replace(/<script\b[\s\S]*?<\/script>/gi, '')), 'no distributor name invented in user copy');
  assert.ok(!/Save draft/.test(flow), 'no Save draft invent');
  assert.ok(!/hop\.put|create-artist|Photo Library|Cap invent/.test(flow), 'no hop / attach / Cap / Photo Library invent');
  assert.ok(!/plainow|wannaplai\.com DNS|Porkbun/i.test(flow + rest + teslaPass), 'no DNS invent');

  assert.ok(dashboard.includes('Overview') && releases.includes('Releases') && settings.includes('Settings'), 'rest-of-site pages stay');
  assert.ok(boosts.includes('Boosts') && artists.includes('Artist Profiles'), 'Boosts and Artist Profiles stay');
  assert.ok(how.includes('How it works') && faq.includes('FAQ'), 'How it works and FAQ stay');
  assert.ok(/class="btn btn-purple btn-md"[^>]*data-new-release/.test(releases), 'Releases New release class stays for tests');
  assert.ok(!/Join for free[\s\S]{0,80}Have a problem\?/.test(index), 'signed-out homepage does not add Have a problem?');

  console.log('aesthetic-preview.test.js: ok');
}

run();
