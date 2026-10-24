/**
 * Release lyric box: paste stays as-is. "Use AI to transcribe" sends the
 * uploaded audio to the server, then drops the transcript in the box to edit.
 * One credit, checked before the request. A failed transcript is not charged.
 */
(function (root) {
  var doc = root.document;
  if (!doc || !doc.querySelector) return;
  var audioPack = root.PlaigroundLyricsAudio;

  function closest(node, sel) {
    if (!node) return null;
    if (node.closest) return node.closest(sel);
    return null;
  }

  function audioInputFor(button) {
    var row = closest(button, '[data-track-row]');
    if (row) return row.querySelector('[data-audio-input]');
    var scope = doc.getElementById('upload-audio') || doc;
    return scope.querySelector('[data-audio-input]');
  }

  function fileFrom(input) {
    if (!input) return null;
    if (input.files && input.files[0]) return input.files[0];
    if (input._plaigroundFile) return input._plaigroundFile;
    return null;
  }

  function lyricsBoxFor(button) {
    var row = closest(button, '[data-track-row]');
    if (row) return row.querySelector('[data-track-lyrics]');
    return doc.getElementById('tg-lyrics');
  }

  function statusFor(button) {
    var row = closest(button, '[data-track-row]') || closest(button, '[data-lyrics-field]') || button.parentNode;
    if (!row || !row.querySelector) return null;
    return row.querySelector('[data-lyrics-status]');
  }

  function setStatus(button, message) {
    var el = statusFor(button);
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  function instrumentalOn() {
    var box = doc.getElementById('tg-instrumental');
    return Boolean(box && box.checked);
  }

  function languageCode() {
    var el = doc.getElementById('tg-language');
    return el && el.value ? String(el.value).trim() : '';
  }

  function creditsOk() {
    return fetch('/api/song-helper?action=dev-status', { credentials: 'same-origin' })
      .then(function (res) { return res.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (!data || !data.signedIn) return { ok: false, error: 'Sign in to use a credit.' };
        if (!(data.credits >= 1)) return { ok: false, error: 'That takes 1 credit.' };
        return { ok: true, credits: data.credits };
      })
      .catch(function () {
        return { ok: false, error: 'Could not check your credits. Try again.' };
      });
  }

  function knownContainer(file) {
    var blob = ((file && file.type) || '') + ' ' + ((file && file.name) || '');
    return /mpeg|mp3|wav|flac|ogg|mp4|m4a|webm|x-wav/i.test(blob);
  }

  function sendOriginal(file) {
    return file.arrayBuffer().then(function (buf) {
      var mime = file.type || 'application/octet-stream';
      if (/mpeg|mp3/i.test(mime + file.name)) mime = 'audio/mpeg';
      else if (/wav/i.test(mime + file.name)) mime = 'audio/wav';
      else if (/flac/i.test(mime + file.name)) mime = 'audio/flac';
      return { bytes: new Uint8Array(buf), mime: mime, filename: file.name || 'audio', trimmed: false };
    });
  }

  function decodeToWav(file) {
    var Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx || !audioPack) return Promise.reject(new Error('decode'));
    return file.arrayBuffer().then(function (buf) {
      var ctx = new Ctx();
      var copy = buf.slice ? buf.slice(0) : buf;
      return ctx.decodeAudioData(copy).then(function (decoded) {
        var mixed = audioPack.mixDown(decoded);
        var packed = audioPack.packWav(mixed.samples, mixed.rate, audioPack.MAX_BYTES);
        if (ctx.close) {
          try { ctx.close(); } catch (err) {}
        }
        return packed;
      });
    });
  }

  function prepare(file) {
    var limit = audioPack ? audioPack.MAX_BYTES : 3800000;
    if (knownContainer(file) && file.size > 0 && file.size <= limit) return sendOriginal(file);
    return decodeToWav(file).catch(function () {
      if (file.size > 0 && file.size <= limit) return sendOriginal(file);
      var err = new Error('too-big');
      err.code = 'TOO_BIG';
      throw err;
    });
  }

  function pasteLyrics(box, text) {
    if (!box) return;
    box.value = text;
    try {
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {}
  }

  function transcribe(button) {
    if (button.disabled) return;
    if (instrumentalOn()) {
      setStatus(button, 'Turn off Instrumental to transcribe lyrics.');
      return;
    }
    var box = lyricsBoxFor(button);
    if (box && String(box.value || '').trim()) {
      setStatus(button, 'The box already has lyrics. Clear it first if you want a transcript instead. Nothing was charged.');
      return;
    }
    var file = fileFrom(audioInputFor(button));
    if (!file) {
      setStatus(button, 'Add the song audio first.');
      return;
    }
    var label = button.textContent;
    button.disabled = true;
    setStatus(button, 'Checking credits...');
    creditsOk().then(function (wallet) {
      if (!wallet.ok) {
        button.disabled = false;
        setStatus(button, wallet.error);
        return null;
      }
      setStatus(button, 'Transcribing the audio...');
      return prepare(file).then(function (packed) {
        var url = '/api/song-helper?action=transcribe';
        var language = languageCode();
        if (language) url += '&language=' + encodeURIComponent(language);
        return fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': packed.mime || 'application/octet-stream' },
          body: packed.bytes,
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            data.status = res.status;
            data.trimmed = packed.trimmed;
            return data;
          });
        });
      });
    }).then(function (data) {
      if (!data) return;
      button.disabled = false;
      if (!data.ok || !data.lyrics) {
        setStatus(button, (data && data.error) || 'The transcript did not come back. Nothing was charged. Try again, or paste the lyrics.');
        return;
      }
      pasteLyrics(box, data.lyrics);
      var note = 'Transcript added. Review it and edit it before you submit.';
      if (data.trimmed) note = 'Transcribed the first part of a long song. Check it and add the rest.';
      if (data.charged) note += ' 1 credit used.';
      setStatus(button, note);
    }).catch(function (err) {
      button.disabled = false;
      if (err && err.code === 'TOO_BIG') {
        setStatus(button, 'That audio is too large to transcribe here. Paste the lyrics instead. Nothing was charged.');
        return;
      }
      setStatus(button, 'The transcript did not come back. Nothing was charged. Try again, or paste the lyrics.');
    });
    if (label) button.setAttribute('data-lyrics-label', label);
  }

  doc.addEventListener('click', function (event) {
    var button = closest(event.target, '[data-lyrics-transcribe]');
    if (!button) return;
    if (event.preventDefault) event.preventDefault();
    transcribe(button);
  });
})(typeof window !== 'undefined' ? window : this);
