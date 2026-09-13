'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const stage = require('./upload-stage');

function el(attrs) {
  attrs = attrs || {};
  const node = {
    tagName: String(attrs.tagName || 'DIV').toUpperCase(),
    hidden: Boolean(attrs.hidden),
    textContent: attrs.textContent || '',
    value: attrs.value != null ? attrs.value : '',
    type: attrs.type || '',
    checked: Boolean(attrs.checked),
    files: attrs.files || [],
    _plaigroundFile: attrs._plaigroundFile || null,
    style: Object.assign({}, attrs.style || {}),
    attrs: Object.assign({}, attrs.attrs || {}),
    children: [],
    parentNode: null,
    classList: {
      tokens: Object.create(null),
      add(name) { this.tokens[name] = true; },
      remove(name) { delete this.tokens[name]; },
      toggle(name, force) {
        if (force === false) delete this.tokens[name];
        else if (force) this.tokens[name] = true;
        else if (this.tokens[name]) delete this.tokens[name];
        else this.tokens[name] = true;
      },
      contains(name) { return Boolean(this.tokens[name]); },
    },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    listeners: {},
    querySelector(sel) {
      if (sel === 'img[data-cover-photo]') return this._img || null;
      if (sel === '[data-audio-input]') return this._audioInput || null;
      if (sel === '[data-audio-preview]') return this._preview || null;
      return null;
    },
    querySelectorAll() { return []; },
    closest() { return null; },
    dispatchEvent() { return true; },
    click() { this.clicked = (this.clicked || 0) + 1; },
  };
  return node;
}

function mockDoc(map) {
  map = map || {};
  return {
    getElementById(id) { return map['#' + id] || map[id] || null; },
    querySelector(sel) { return map[sel] || null; },
    querySelectorAll(sel) {
      if (map[sel + '[]']) return map[sel + '[]'];
      const one = map[sel];
      return one ? [one] : [];
    },
  };
}

function run() {
  const upload = fs.readFileSync(path.join(__dirname, '..', 'upload.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'site.css'), 'utf8');
  const src = fs.readFileSync(path.join(__dirname, 'upload-stage.js'), 'utf8');

  assert.ok(upload.includes('data-release-stage'), 'Upload has the center-stage board');
  assert.ok(upload.includes('data-release-sleeve'), 'Upload has the sleeve');
  assert.ok(upload.includes('data-stage-chip="audio"'), 'Audio chip is present');
  assert.ok(upload.includes('data-stage-chip="cover"'), 'Cover chip is present');
  assert.ok(upload.includes('data-stage-chip="credits"'), 'Credits chip is present');
  assert.ok(upload.includes('data-stage-chip="send"'), 'Send chip is present');
  assert.ok(upload.includes('Building your release'), 'Progress copy is building your release');
  assert.ok(upload.includes('data-stage-missing'), 'Missing-state line is on the stage');
  assert.ok(upload.includes('data-stage-wave'), 'Waveform mount is near the stage');
  assert.ok(upload.includes('data-stage-title'), 'title paint hook stays, off the art');
  assert.ok(upload.includes('lib/upload-stage.js?v=20260913a1'), 'Upload cache-busts the stage helper');
  assert.ok(!upload.includes('lib/upload-stage.js?v=20260912s7'), 's7 stamp is retired after the iOS Files picker leftover');
  assert.ok(upload.includes('site.css?v=20260912cr2'), 'Upload cache-busts site.css at the Credits Tesla-cut stamp');
  assert.ok(!upload.includes('site.css?v=20260912cr1'), 'cr1 stamp is retired after English default');
  assert.ok(!upload.includes('site.css?v=20260912ca2'), 'ca2 stamp is retired after the Credits Tesla cut');
  assert.ok(!upload.includes('site.css?v=20260912ca1'), 'ca1 stamp is retired after the tiny-step leftover');
  assert.ok(!upload.includes('site.css?v=20260912ae1'), 'ae1 stamp is retired after the Credits/Send leftover');
  assert.ok(!upload.includes('site.css?v=20260912ba4'), 'ba4 stamp is retired after the Have a problem? leftover');
  assert.ok(!upload.includes('site.css?v=20260912ba3'), 'ba3 stamp is retired after the color-role lock');
  assert.ok(!upload.includes('site.css?v=20260912ba2'), 'ba2 stamp is retired after the toggle leftover');
  assert.ok(!upload.includes('site.css?v=20260912tc2'), 'tc2 stamp is retired after brand accents');
  assert.ok(upload.includes('class="field upload-title-field"'), 'Song title is a real text box');
  assert.ok(!upload.includes('release-sleeve-title-wrap'), 'title is not wrapped onto the sleeve');
  assert.ok(!upload.includes('site.css?v=20260912ly8'), 'ly8 stamp is retired after Tesla cut');
  assert.ok(!upload.includes('site.css?v=20260912sg4'), 'sg4 stamp is retired after Tesla cut');
  assert.ok(css.includes('.audio-bar[hidden]'), 'empty audio chip stays hidden until a file is attached');
  assert.ok(/data-art-meta/.test(upload) && /upload-stage-caption sr-only/.test(upload), 'sleeve size helper stays in the DOM but does not force a read');
  assert.ok(/release-stage-missing sr-only/.test(upload), 'sleeve missing line stays in the DOM but does not force a read');
  assert.ok(/sr-only">Drop WAV, FLAC, or MP3 here</.test(upload), 'drop copy is available to AT, not competing with the sleeve');
  assert.ok(/Space\+Grotesk|Space Grotesk/.test(upload), 'Space Grotesk stays on the Submit a song hero');
  assert.ok(css.includes('color: var(--muted-2)'), 'remaining muted captions stay brighter muted');
  assert.ok(!/<button[^>]*data-audio-play/.test(upload), 'single-upload chip has no extra purple play');
  assert.ok(upload.includes('data-audio-clear'), 'attached audio has Clear matching cover');
  assert.ok(src.includes('data-audio-clear'), 'Clear is a protected stage hit');
  assert.ok(upload.includes('upload-audio-splat'), 'empty audio drop has a soft purple splat');
  assert.ok(css.includes('.upload-audio-splat'), 'splat mark is painted in site.css');
  assert.ok(css.includes('.release-stage-drop[hidden]'), 'attached audio can hide the drop cue');
  const audioPickTag = upload.match(/<input[^>]*id="tg-audio-file"[^>]*>/)[0];
  assert.ok(!/accept="[^"]*audio\/\*/.test(audioPickTag), 'Add audio is file-only — no audio/* media sheet');
  assert.ok(!/accept="[^"]*audio\//.test(audioPickTag), 'Add audio is file-only — no audio MIME media sheet');
  assert.ok(!/\bcapture\b/.test(audioPickTag), 'Add audio has no capture attribute');
  assert.ok(!/accept="[^"]*image/.test(audioPickTag), 'Add audio does not accept images');
  assert.ok(audioPickTag.includes('.wav') && audioPickTag.includes('.mp3'), 'Add audio still accepts WAV/MP3');
  assert.ok(!upload.includes('Optional, helps sync licensing'), 'Instrumental helper copy is gone');
  assert.ok(!/dashbox checkline/.test(upload), 'Instrumental is not a dashed frame');
  assert.ok(!/<button[^>]*class="dashbox"/.test(upload), 'Lyrics is not a dashed button');
  assert.ok(/id="tg-lyrics-open"[^>]*role="switch"/.test(upload), 'Add lyrics is a soft switch');
  assert.ok(upload.includes('>Optional<'), 'muted Optional helper is short');
  assert.ok(!upload.includes('Optional — skip if you don’t need them.'), 'long Optional helper is gone');
  assert.ok(upload.includes('data-stage-pick="audio"'), 'Audio chip/drop opens the existing audio input');
  assert.ok(upload.includes('data-stage-pick="cover"'), 'Cover sleeve opens the existing cover input');
  assert.ok(upload.includes('id="tg-audio-file"'), 'Audio picker keeps a stable id on the existing input');
  assert.ok(upload.includes('id="tg-art-file"'), 'Cover picker keeps a stable id on the existing input');
  assert.ok(/data-stage-chip="audio"[^>]*data-stage-pick="audio"/.test(upload), 'Audio chip is a pick trigger');
  assert.ok(/>Add audio</.test(upload), 'Audio chip says Add audio');
  assert.ok(/>Add cover</.test(upload), 'Cover chip says Add cover');
  assert.ok(/data-stage-chip="cover"[^>]*data-art-pick/.test(upload), 'Cover chip uses the existing artwork pick');
  assert.ok(upload.includes('data-art-pick'), 'existing cover pick hook stays');
  assert.ok(upload.indexOf('Add artwork') === -1, 'redundant Add artwork button is gone');
  assert.ok(upload.includes('data-art-resize'), 'Resize stays on the stage next to the sleeve');
  assert.ok(upload.includes('Resize for me'), 'Resize keeps the existing control copy');
  assert.ok(upload.includes('data-stage-hairline'), 'gold hairline sits under the stage');
  assert.ok(css.includes('border-top: 1px solid #f3cb47'), 'hairline is a solid PLAIGROUND gold line');
  assert.ok(!/release-stage-audio[\s\S]{0,180}dashed/.test(css), 'stage audio drop is not a dashed box');
  assert.ok(!/<label class="dashbox audio-drop"/.test(upload), 'center-stage drop is not a dashbox');
  assert.ok(upload.includes('Drop WAV, FLAC, or MP3 here'), 'drag-audio helper copy stays');
  assert.ok(!upload.includes('MP3 is converted to WAV'), 'MP3 lecture is gone from Upload');
  assert.ok(!upload.includes('Play this file here to confirm it is the right master'), 'confirm-master lecture is gone');
  assert.ok(!upload.includes('stays on this device only'), 'device-only lecture is gone');
  assert.ok(upload.includes('>Preview<'), 'attached audio hint is Preview');
  assert.ok(upload.includes('data-art-box'), 'Existing cover tile stays');
  assert.ok(upload.includes('data-art-input'), 'Existing cover input stays');
  assert.ok(upload.includes('data-audio-input'), 'Existing audio input stays');
  assert.ok(upload.includes('data-store-continue'), 'Existing Continue stays');
  assert.ok(upload.includes('href="attest.html"'), 'Continue still hops to attest');
  assert.ok(!/data-upload-save-draft/.test(upload), 'Save draft stays cancelled');
  assert.ok(!/ToneGrid|DistroKid|distributor/i.test(upload.replace(/tonegrid\.js|store-client/g, '')), 'stage copy must not name ToneGrid / DistroKid');
  assert.ok(!/App Store/.test(upload), 'no App Store invent');
  assert.ok(upload.indexOf('lib/object-store.js') === -1, 'no server object-store on Upload');

  assert.ok(css.includes('--stage-magenta: #d03083'), 'stage magenta matches site language');
  assert.ok(css.includes('--stage-purple: #782fb1'), 'stage purple matches site language');
  assert.ok(css.includes('--stage-gold: #f3cb47'), 'stage gold matches site language');
  assert.ok(css.includes('--stage-blue: #4d7cbe'), 'stage blue matches locked Logo Blue');
  assert.ok(css.includes('.release-sleeve'), 'sleeve chrome is in site.css');
  assert.ok(css.includes('.stage-chip.is-on'), 'chips light when done');

  assert.ok(!/hop\.put|create-artist/.test(src), 'stage helper does not invent hop or create-artist');
  assert.ok(src.includes('Does not hop'), 'stage helper documents the soft-stop');
  assert.ok(src.includes('Type the song title.'), 'missing title copy points at the text box, not the sleeve');
  assert.ok(!src.includes('Type the title onto the sleeve.'), 'overlay title lecture is gone');

  const title = el({ value: '', tagName: 'INPUT' });
  const face = el();
  const sleeve = el();
  const audioChip = el({ attrs: { 'data-stage-chip': 'audio' } });
  const coverChip = el({ attrs: { 'data-stage-chip': 'cover' } });
  const creditsChip = el({ attrs: { 'data-stage-chip': 'credits' } });
  const sendChip = el({ attrs: { 'data-stage-chip': 'send' } });
  const missing = el();
  const artBox = el();
  const artInput = el({ tagName: 'INPUT', files: [] });
  const audioInput = el({ tagName: 'INPUT', files: [] });
  const audioRoot = el();
  audioRoot._audioInput = audioInput;
  const artist = el({ value: '', tagName: 'INPUT' });
  const genre = el({ value: '', tagName: 'SELECT' });
  const language = el({ value: '', tagName: 'SELECT' });
  const price = el({ value: '', tagName: 'SELECT' });
  const instrumental = el({ type: 'checkbox', tagName: 'INPUT' });

  const doc = mockDoc({
    '#tg-title': title,
    'tg-title': title,
    '[id="tg-title"]': title,
    '[data-stage-title]': face,
    '[data-release-sleeve]': sleeve,
    '[data-art-box]': artBox,
    '[data-art-input]': artInput,
    '[data-single-audio]': audioRoot,
    '[data-audio-input]': audioInput,
    '[data-single-audio] [data-audio-input]': audioInput,
    '[data-stage-chip][]': [audioChip, coverChip, creditsChip, sendChip],
    '[data-stage-missing][]': [missing],
    '[data-stage-missing]': missing,
    '#tg-artist': artist,
    'tg-artist': artist,
    '#tg-genre': genre,
    'tg-genre': genre,
    '#tg-language': language,
    'tg-language': language,
    '#tg-price': price,
    'tg-price': price,
    '#tg-instrumental': instrumental,
    'tg-instrumental': instrumental,
  });

  let state = stage.refresh(doc);
  assert.strictEqual(state.audio, false);
  assert.strictEqual(state.cover, false);
  assert.strictEqual(state.credits, false);
  assert.strictEqual(state.send, false);
  assert.ok(/Add audio/.test(missing.textContent), 'empty stage explains audio is next');
  assert.ok(!audioChip.classList.contains('is-on'));
  assert.ok(!sendChip.classList.contains('is-on'));

  audioInput._plaigroundFile = { name: 'drive.wav', type: 'audio/wav', size: 1200 };
  artBox.classList.add('has-art');
  title.value = 'Night Drive';
  artist.value = 'Ada Night';
  genre.value = 'Pop';
  language.value = 'en';
  price.value = '$0.99';
  state = stage.refresh(doc);
  assert.strictEqual(state.audio, true);
  assert.strictEqual(state.cover, true);
  assert.strictEqual(state.credits, true);
  assert.strictEqual(state.send, true);
  assert.strictEqual(face.textContent, 'Night Drive');
  assert.ok(face.classList.contains('is-on'), 'existing title field still paints the AT hook');
  assert.ok(audioChip.classList.contains('is-on'));
  assert.ok(coverChip.classList.contains('is-on'));
  assert.ok(creditsChip.classList.contains('is-on'));
  assert.ok(sendChip.classList.contains('is-on'));
  assert.strictEqual(missing.textContent, 'Ready to continue.');
  assert.ok(sleeve.classList.contains('is-filled'));

  title.value = '';
  state = stage.refresh(doc);
  assert.strictEqual(state.send, false);
  assert.ok(/title/.test(missing.textContent), 'missing line names the title when credits are otherwise ready');

  const peaks = stage.peaksFromChannel(new Float32Array([0, 0.5, -1, 0.25, 0, 0.8]), 3);
  assert.strictEqual(peaks.length, 3);
  assert.ok(peaks.every(function (n) { return n > 0 && n <= 1; }));

  const fills = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    clearRect() {},
    fillRect(x, y, w, h) { fills.push([x, y, w, h]); },
  };
  stage.drawPeaks(ctx, [0.4, 0.8, 0.2], 120, 40);
  assert.ok(fills.length >= 3, 'waveform paints bars');

  const routed = [];
  const coverIn = el({ tagName: 'INPUT', files: [] });
  const audioIn = el({ tagName: 'INPUT', files: [] });
  const routeDoc = mockDoc({
    '[data-art-input]': coverIn,
    '[data-audio-input]': audioIn,
    '[data-single-audio]': { querySelector: function (sel) { return sel === '[data-audio-input]' ? audioIn : null; } },
  });
  assert.strictEqual(stage.routeFile({ name: 'sleeve.jpg', type: 'image/jpeg' }, routeDoc), 'cover');
  assert.ok(coverIn._plaigroundFile && coverIn._plaigroundFile.name === 'sleeve.jpg');
  assert.strictEqual(stage.routeFile({ name: 'master.wav', type: 'audio/wav' }, routeDoc), 'audio');
  assert.ok(audioIn._plaigroundFile && audioIn._plaigroundFile.name === 'master.wav');

  const audioPick = el({ tagName: 'INPUT', files: [], attrs: { accept: 'audio/*,video/*', capture: 'environment' } });
  const coverPick = el({ tagName: 'INPUT', files: [], attrs: { accept: '.jpg,.jpeg,.png,image/jpeg,image/png' } });
  const pickDoc = mockDoc({
    '#tg-audio-file': audioPick,
    'tg-audio-file': audioPick,
    '#tg-art-file': coverPick,
    'tg-art-file': coverPick,
    '[data-audio-input]': audioPick,
    '[data-art-input]': coverPick,
    '[data-single-audio]': { querySelector: function (sel) { return sel === '[data-audio-input]' ? audioPick : null; } },
  });
  assert.strictEqual(stage.openExistingPicker('audio', pickDoc), audioPick);
  assert.strictEqual(audioPick.clicked, 1, 'Audio pick clicks the existing audio input');
  assert.strictEqual(audioPick.getAttribute('accept'), '.mp3,.wav,.flac', 'Audio pick re-locks to extension-only accept');
  assert.strictEqual(audioPick.getAttribute('capture'), null, 'Audio pick strips capture before click');
  assert.strictEqual(stage.openExistingPicker('cover', pickDoc), coverPick);
  assert.strictEqual(coverPick.clicked, 1, 'Cover pick clicks the existing cover input');
  assert.strictEqual(coverPick.getAttribute('accept'), '.jpg,.jpeg,.png,image/jpeg,image/png', 'Cover pick keeps the image accept list');
  assert.ok(src.includes('openExistingPicker'), 'stage helper exposes the existing-input click');
  assert.ok(src.includes('lockAudioPicker'), 'stage helper re-locks audio accept/capture on the click path');
  assert.ok(!src.includes('hop.put'), 'picker click does not hop');

  const audioBind = fs.readFileSync(path.join(__dirname, 'upload-audio-bind.js'), 'utf8');
  assert.ok(audioBind.includes('PlaigroundUploadStage'), 'audio paint notifies the stage waveform');
  assert.ok(audioBind.includes('drop.hidden = true'), 'attached audio hides the drop cue');
  assert.ok(audioBind.includes('hint.hidden = false'), 'attached audio keeps the Preview line');
  assert.ok(audioBind.includes('clearPicked'), 'audio bind can Clear the attached file');
  assert.ok(audioBind.includes('clearPickedAudio'), 'Clear drops held audio without wipeHeld');
  assert.ok(!audioBind.includes('wipeForm') && !audioBind.includes('wipeHeld'), 'Clear is not Start over');
  assert.ok(!audioBind.includes('[data-audio-play]'), 'audio bind has no extra play handler');
  assert.ok(!audioBind.includes('hop.put'), 'audio bind still does not hop');
  assert.ok(audioBind.includes('lockFilePicker'), 'audio bind re-locks accept/capture on the existing input');
  assert.ok(audioBind.includes("removeAttribute('capture')"), 'audio bind strips capture if something puts it back');
  assert.ok(!/Capacitor|native picker|createElement\('input'\)/.test(audioBind), 'audio bind does not invent a Cap/native picker');

  console.log('lib/upload-stage.test.js ok');
}

run();
