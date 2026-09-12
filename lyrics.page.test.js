'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function makeEl(attrs) {
  const el = {
    hidden: Boolean(attrs && attrs.hidden),
    value: attrs && attrs.value != null ? attrs.value : '',
    checked: Boolean(attrs && attrs.checked),
    textContent: '',
    focused: false,
    attrs: Object.assign({}, (attrs && attrs.attrs) || {}),
    classList: {
      tokens: Object.create(null),
      toggle(name, force) {
        if (force === false) delete this.tokens[name];
        else if (force) this.tokens[name] = true;
        else if (this.tokens[name]) delete this.tokens[name];
        else this.tokens[name] = true;
      },
      contains(name) { return Boolean(this.tokens[name]); },
    },
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    addEventListener(type, fn) {
      this.listeners = this.listeners || {};
      this.listeners[type] = fn;
    },
    focus() { el.focused = true; },
  };
  return el;
}

function run() {
  const upload = read('upload.html');
  const song = read('song.html');
  const review = read('review.html');
  const tonegrid = read('store-client.js');
  const songJs = read('song.js');

  assert.ok(upload.includes('id="tg-lyrics-open"'), 'upload has a Lyrics control');
  assert.ok(upload.includes('data-lyrics-open'));
  assert.ok(/id="tg-instrumental"[^>]*role="switch"/.test(upload), 'Instrumental is a soft switch');
  assert.ok(/id="tg-lyrics-open"[^>]*role="switch"/.test(upload), 'Add lyrics is a soft switch');
  assert.ok(upload.includes('toggle-line'), 'pair uses existing soft toggle language');
  assert.ok(upload.includes('Add lyrics'), 'Add lyrics label stays');
  assert.ok(upload.includes('>Optional<'), 'one short Optional helper under the pair');
  assert.ok(!upload.includes('Optional — skip if you don’t need them.'), 'long Optional helper is gone');
  assert.ok(!upload.includes('Play this file here to confirm it is the right master'), 'confirm-master lecture is gone');
  assert.ok(!upload.includes('stays on this device only'), 'device-only lecture is gone');
  assert.ok(upload.includes('data-audio-preview-hint hidden>Preview<'), 'attached audio hint is Preview');
  assert.ok(!upload.includes('MP3 is converted to WAV'), 'MP3 lecture is gone from Upload');
  assert.ok(upload.includes('<label for="tg-lyrics">Lyrics</label>'));
  assert.ok(upload.includes('<textarea id="tg-lyrics"'));
  assert.ok(upload.includes('data-lyrics-field'));
  assert.ok(upload.includes('upload-lyrics-card'), 'lyrics card uses Artist-card language');
  assert.ok(!upload.includes('Add lyrics file'), 'dead dashbox is gone');
  assert.ok(!upload.includes('Optional, helps sync licensing'), 'instrumental helper copy is gone');
  assert.ok(!/dashbox checkline/.test(upload), 'Instrumental is not a dashed frame');
  assert.ok(!/<button[^>]*class="dashbox"/.test(upload), 'Lyrics is not a dashed button');
  const optChunk = upload.slice(upload.indexOf('upload-opt-toggles'), upload.indexOf('tg-lyrics-panel'));
  assert.ok(!/\*/.test(optChunk), 'no required asterisks on the optional pair');
  assert.ok(!/aria-checked="true"/.test(optChunk), 'both toggles default off');
  assert.ok(!/<input[^>]*\schecked(?:\s|>)/.test(optChunk), 'neither switch ships a checked attribute');
  assert.ok(!/type="radio"/.test(optChunk), 'pair is not a pick-one radio');
  assert.ok(upload.includes('Type or paste lyrics'));
  assert.ok(upload.includes('.srt') || upload.includes('.lrc'), 'timed-file hint can stay as secondary');
  assert.ok(upload.includes('site.css?v=20260912ca2'), 'upload cache-busts site.css at 20260912ca2');
  assert.ok(!upload.includes('site.css?v=20260912ly8'), 'upload must cache-bust past 20260912ly8');
  assert.ok(!upload.includes('site.css?v=20260912tc1'), 'upload must cache-bust past 20260912tc1');
  assert.ok(/upload-stage-caption sr-only/.test(upload), 'sleeve helpers do not force a read');
  assert.ok(upload.includes('store-client.js?v=20260912tc3'), 'upload cache-busts store-client.js at 20260912tc3');
  assert.ok(!/<button[^>]*data-audio-play/.test(upload), 'single-upload chip has no extra play');
  assert.ok(upload.includes('data-audio-clear>Clear<'), 'attached audio Clear matches cover language');
  assert.ok(upload.includes('upload-audio-splat'), 'empty drop has a soft splat mark');
  assert.ok(upload.includes('role="switch"') && upload.includes('toggle-line'), 'Instrumental/Add lyrics stay soft toggles');
  const audioTag = upload.match(/<input[^>]*id="tg-audio-file"[^>]*>/)[0];
  assert.ok(audioTag.includes('accept="'), 'Add audio has an accept list');
  assert.ok(!/accept="[^"]*audio\/\*/.test(audioTag), 'Add audio must not use audio/* (iOS Photo Library)');
  assert.ok(!/accept="[^"]*\*\/\*/.test(audioTag), 'Add audio must not accept */*');
  assert.ok(!/accept="[^"]*image/.test(audioTag), 'Add audio must not accept image types');
  assert.ok(!/\bcapture\b/.test(audioTag), 'Add audio must not set capture');
  assert.ok(audioTag.includes('.wav') && audioTag.includes('.flac') && audioTag.includes('.mp3'), 'Add audio accept matches existing WAV/FLAC/MP3');
  assert.ok(!/m4a|aiff|aif/i.test(audioTag), 'Add audio must not widen to M4A/AIFF');
  const artTag = upload.match(/<input[^>]*id="tg-art-file"[^>]*>/)[0];
  assert.ok(/image\/jpeg|image\/png/.test(artTag), 'Cover picker stays image-capable');

  assert.ok(song.includes('id="edit-lyrics"'));
  assert.ok(song.includes('<label for="edit-lyrics">Lyrics</label>'));
  assert.ok(song.includes('data-edit-lyrics-field'));
  assert.ok(review.includes('data-review-lyrics'));
  assert.ok(review.includes('data-review-lyrics-text'));

  assert.ok(!/accept="audio\/\*,\.wav/.test(tonegrid), 'album-track Add audio is file-only too');
  assert.ok(!tonegrid.includes("'audio/*,.wav"), 'store-client fallback accept no longer starts with audio/*');
  assert.ok(tonegrid.includes("lyrics: instrumental ? '' : (selectedLyrics() || draft.lyrics || '')"));
  assert.ok(tonegrid.includes('openLyricsField'));
  assert.ok(tonegrid.includes('data-track-lyrics'));
  assert.ok(!tonegrid.includes('lyric_text'), 'do not invent a ToneGrid lyric_text field');
  assert.ok(songJs.includes('selectedEditLyrics'));
  assert.ok(songJs.includes('lyrics: lyrics'));

  const instrumental = makeEl({ id: 'tg-instrumental', checked: false });
  const lyricsOpen = makeEl({ checked: false, attrs: { 'data-lyrics-open': '', 'aria-expanded': 'false' } });
  const lyricsField = makeEl({ attrs: { 'data-lyrics-field': '' }, hidden: true });
  const lyricsInput = makeEl({ id: 'tg-lyrics', value: '' });

  function setHiddenEl(el, hidden) {
    if (!el) return;
    el.hidden = Boolean(hidden);
    if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
  }
  function setLyricsOpenUi(on) {
    lyricsOpen.checked = Boolean(on);
    if (lyricsOpen && lyricsOpen.setAttribute) lyricsOpen.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  function openLyrics() {
    if (!lyricsField) return;
    setLyricsOpenUi(true);
    setHiddenEl(lyricsField, false);
    if (lyricsInput && typeof lyricsInput.focus === 'function') lyricsInput.focus();
  }
  function syncInstrumental() {
    if (!lyricsOpen.checked) setHiddenEl(lyricsField, true);
  }
  lyricsOpen.addEventListener('change', function () {
    if (!lyricsOpen.checked) {
      setLyricsOpenUi(false);
      setHiddenEl(lyricsField, true);
      return;
    }
    openLyrics();
  });
  instrumental.addEventListener('change', syncInstrumental);
  syncInstrumental();

  assert.strictEqual(lyricsField.hidden, true, 'textarea starts closed');
  lyricsOpen.checked = true;
  lyricsOpen.listeners.change();
  assert.strictEqual(lyricsField.hidden, false, 'Add lyrics toggle opens the card');
  assert.strictEqual(lyricsOpen.getAttribute('aria-expanded'), 'true');
  assert.strictEqual(lyricsInput.focused, true);
  lyricsInput.value = 'Verse one\nI pasted this';
  assert.strictEqual(lyricsInput.value, 'Verse one\nI pasted this', 'textarea accepts paste');
  lyricsOpen.checked = false;
  lyricsOpen.listeners.change();
  assert.strictEqual(lyricsField.hidden, true, 'Add lyrics off hides the card');
  assert.strictEqual(lyricsInput.value, 'Verse one\nI pasted this', 'hide does not clear the existing field');

  lyricsOpen.checked = true;
  lyricsOpen.listeners.change();
  instrumental.checked = true;
  instrumental.listeners.change();
  assert.strictEqual(lyricsOpen.hidden, false, 'Instrumental does not hide Add lyrics — both stay independent');
  assert.strictEqual(lyricsField.hidden, false, 'Add lyrics on still shows the card when Instrumental is also on');
  lyricsOpen.checked = false;
  lyricsOpen.listeners.change();
  assert.strictEqual(lyricsField.hidden, true, 'Add lyrics off hides the card even if Instrumental is on');

  console.log('lyrics.page.test.js ok');
}

run();
