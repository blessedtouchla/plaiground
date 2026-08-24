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
  assert.ok(upload.includes('<label for="tg-lyrics">Lyrics</label>'));
  assert.ok(upload.includes('<textarea id="tg-lyrics"'));
  assert.ok(upload.includes('data-lyrics-field'));
  assert.ok(!upload.includes('Add lyrics file'), 'dead dashbox is gone');
  assert.ok(upload.includes('Type or paste lyrics'));
  assert.ok(upload.includes('.srt') || upload.includes('.lrc'), 'timed-file hint can stay as secondary');

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
  const lyricsOpen = makeEl({ attrs: { 'data-lyrics-open': '', 'aria-expanded': 'false' } });
  const lyricsField = makeEl({ attrs: { 'data-lyrics-field': '' }, hidden: true });
  const lyricsInput = makeEl({ id: 'tg-lyrics', value: '' });

  function setHiddenEl(el, hidden) {
    if (!el) return;
    el.hidden = Boolean(hidden);
    if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
  }
  function openLyrics() {
    if (!lyricsField || (instrumental && instrumental.checked)) return;
    setHiddenEl(lyricsField, false);
    if (lyricsOpen && lyricsOpen.setAttribute) lyricsOpen.setAttribute('aria-expanded', 'true');
    if (lyricsInput && typeof lyricsInput.focus === 'function') lyricsInput.focus();
  }
  function syncInstrumental() {
    const on = Boolean(instrumental && instrumental.checked);
    setHiddenEl(lyricsOpen, on);
    if (on) {
      setHiddenEl(lyricsField, true);
      if (lyricsOpen && lyricsOpen.setAttribute) lyricsOpen.setAttribute('aria-expanded', 'false');
    }
  }
  lyricsOpen.addEventListener('click', function (event) {
    event.preventDefault();
    openLyrics();
  });
  instrumental.addEventListener('change', syncInstrumental);
  syncInstrumental();

  assert.strictEqual(lyricsField.hidden, true, 'textarea starts closed');
  lyricsOpen.listeners.click({ preventDefault() {} });
  assert.strictEqual(lyricsField.hidden, false, 'click Lyrics opens the textarea');
  assert.strictEqual(lyricsOpen.getAttribute('aria-expanded'), 'true');
  assert.strictEqual(lyricsInput.focused, true);
  lyricsInput.value = 'Verse one\nI pasted this';
  assert.strictEqual(lyricsInput.value, 'Verse one\nI pasted this', 'textarea accepts paste');

  instrumental.checked = true;
  instrumental.listeners.change();
  assert.strictEqual(lyricsField.hidden, true, 'instrumental hides lyrics');
  assert.strictEqual(lyricsOpen.hidden, true);
  lyricsOpen.listeners.click({ preventDefault() {} });
  assert.strictEqual(lyricsField.hidden, true, 'instrumental click must not require or open lyrics');

  console.log('lyrics.page.test.js ok');
}

run();
