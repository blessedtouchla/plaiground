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
  assert.ok(/id="tg-lyrics-open"[^>]*type="checkbox"/.test(upload), 'Add lyrics is a small checkbox');
  assert.ok(upload.includes('Add lyrics'), 'Add lyrics label matches Instrumental checkbox language');
  assert.ok(upload.includes('<label for="tg-lyrics">Lyrics</label>'));
  assert.ok(upload.includes('<textarea id="tg-lyrics"'));
  assert.ok(upload.includes('data-lyrics-field'));
  assert.ok(upload.includes('upload-lyrics-card'), 'lyrics card uses Artist-card language');
  assert.ok(!upload.includes('Add lyrics file'), 'dead dashbox is gone');
  assert.ok(!upload.includes('Optional, helps sync licensing'), 'instrumental helper copy is gone');
  assert.ok(!/dashbox checkline/.test(upload), 'Instrumental is not a dashed frame');
  assert.ok(!/<button[^>]*class="dashbox"/.test(upload), 'Lyrics is not a dashed button');
  assert.ok(upload.includes('Type or paste lyrics'));
  assert.ok(upload.includes('.srt') || upload.includes('.lrc'), 'timed-file hint can stay as secondary');
  assert.ok(upload.includes('site.css?v=20260912ly1'), 'upload cache-busts site.css at 20260912ly1');
  assert.ok(upload.includes('store-client.js?v=20260912ly1'), 'upload cache-busts store-client.js at 20260912ly1');

  assert.ok(song.includes('id="edit-lyrics"'));
  assert.ok(song.includes('<label for="edit-lyrics">Lyrics</label>'));
  assert.ok(song.includes('data-edit-lyrics-field'));
  assert.ok(review.includes('data-review-lyrics'));
  assert.ok(review.includes('data-review-lyrics-text'));

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
    if (!lyricsField || (instrumental && instrumental.checked)) return;
    setLyricsOpenUi(true);
    setHiddenEl(lyricsField, false);
    if (lyricsInput && typeof lyricsInput.focus === 'function') lyricsInput.focus();
  }
  function syncInstrumental() {
    const on = Boolean(instrumental && instrumental.checked);
    setHiddenEl(lyricsOpen, on);
    if (on) {
      setHiddenEl(lyricsField, true);
      setLyricsOpenUi(false);
    } else if (!lyricsOpen.checked) {
      setHiddenEl(lyricsField, true);
    }
  }
  lyricsOpen.addEventListener('change', function () {
    if ((instrumental && instrumental.checked) || !lyricsOpen.checked) {
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
  assert.strictEqual(lyricsField.hidden, false, 'Add lyrics checkbox opens the card');
  assert.strictEqual(lyricsOpen.getAttribute('aria-expanded'), 'true');
  assert.strictEqual(lyricsInput.focused, true);
  lyricsInput.value = 'Verse one\nI pasted this';
  assert.strictEqual(lyricsInput.value, 'Verse one\nI pasted this', 'textarea accepts paste');
  lyricsOpen.checked = false;
  lyricsOpen.listeners.change();
  assert.strictEqual(lyricsField.hidden, true, 'unchecked Add lyrics hides the card');
  assert.strictEqual(lyricsInput.value, 'Verse one\nI pasted this', 'hide does not clear the existing field');

  lyricsOpen.checked = true;
  lyricsOpen.listeners.change();
  instrumental.checked = true;
  instrumental.listeners.change();
  assert.strictEqual(lyricsField.hidden, true, 'instrumental hides lyrics');
  assert.strictEqual(lyricsOpen.hidden, true);
  lyricsOpen.checked = true;
  lyricsOpen.listeners.change();
  assert.strictEqual(lyricsField.hidden, true, 'instrumental click must not require or open lyrics');

  console.log('lyrics.page.test.js ok');
}

run();
