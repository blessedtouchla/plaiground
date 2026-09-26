(function () {
  var core = window.CoverArtCore;
  var song = window.SongHelperCore;
  if (!core || !song) return;

  var STEPS = ['identity', 'look', 'idea', 'options', 'overlay'];
  var COPY = {
    identity: ['Who is releasing this?', 'Artist name and song title. If you just used Song Helper, the title may already be here.'],
    look: ['What should it look like?', 'Pick a look and a color feel. The picture will not contain words.'],
    idea: ['What is in the picture?', 'Your lyric pictures are chips. Keep the ones you want, then suggest a prompt. The full lyric stays off the cover.'],
    options: ['Pick a cover.', 'Tap the one that feels like the song. You can ask for another set.'],
    overlay: ['Put your name on it.', 'The letters are drawn here, not inside the picture. Then download a square 3000×3000 JPG.'],
  };
  var NEXT_LABEL = {
    identity: 'Next',
    look: 'Next',
    idea: 'Make the covers',
    options: 'Add the title',
  };
  var FONTS = {
    grotesk: { css: "'Space Grotesk', sans-serif", weight: 600, load: "600 64px 'Space Grotesk'" },
    inter: { css: 'Inter, sans-serif', weight: 700, load: '700 64px Inter' },
    fraunces: { css: 'Fraunces, serif', weight: 600, load: '600 64px Fraunces' },
    oswald: { css: 'Oswald, sans-serif', weight: 500, load: '500 64px Oswald' },
    baskerville: { css: "'Libre Baskerville', serif", weight: 700, load: "700 64px 'Libre Baskerville'" },
    caveat: { css: 'Caveat, cursive', weight: 600, load: '600 64px Caveat' },
  };

  var step = 0;
  var picks = { look: '', palette: 'night', count: '3', font: 'grotesk', position: 'center' };
  var images = [];
  var selected = 0;
  var preview = true;
  var upscaleNote = '';
  var busy = false;
  var sessionId = '';
  var imagery = [];
  var ideaAuto = true;
  var profileArtists = [];

  var shell = document.getElementById('ca-shell');
  var form = document.getElementById('ca-form');
  var qEl = document.getElementById('ca-q');
  var helpEl = document.getElementById('ca-help');
  var dotsEl = document.getElementById('ca-dots');
  var backBtn = document.getElementById('ca-back');
  var nextBtn = document.getElementById('ca-next');
  var formError = document.getElementById('ca-form-error');
  var banner = document.getElementById('ca-banner');
  var attr = document.getElementById('ca-attr');
  var noteEl = document.getElementById('ca-note');
  var stripEl = document.getElementById('ca-strip');
  var grid = document.getElementById('ca-grid');
  var loadingEl = document.getElementById('ca-loading');
  var genError = document.getElementById('ca-gen-error');
  var previewCanvas = document.getElementById('ca-preview');
  var rightsEl = document.getElementById('ca-rights');
  var upscaleEl = document.getElementById('ca-upscale');
  var checkNote = document.getElementById('ca-check-note');

  function $(id) { return document.getElementById(id); }

  function showError(message) {
    if (!message) {
      formError.hidden = true;
      formError.textContent = '';
      return;
    }
    formError.hidden = false;
    formError.textContent = message;
  }

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(song.SESSION_KEY) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function writeCover(line) {
    var prev = readSession();
    prev.cover = { line: line, preview: preview };
    try {
      sessionStorage.setItem(song.SESSION_KEY, JSON.stringify(prev));
    } catch (err) {}
  }

  function ensureSessionId() {
    if (sessionId) return sessionId;
    var saved = readSession();
    if (saved.coverSessionId && /^[A-Za-z0-9_-]{8,80}$/.test(saved.coverSessionId)) {
      sessionId = saved.coverSessionId;
      return sessionId;
    }
    sessionId = 'ca' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    saved.coverSessionId = sessionId;
    try { sessionStorage.setItem(song.SESSION_KEY, JSON.stringify(saved)); } catch (err) {}
    return sessionId;
  }

  function prefill() {
    var saved = readSession();
    if (saved.title && !$('ca-title').value) $('ca-title').value = saved.title;
    if (saved.artistName && !$('ca-artist').value) $('ca-artist').value = saved.artistName;
    if (saved.genre && !$('ca-genre').value) $('ca-genre').value = saved.genre;
    if (!picks.look && /^(photo|painted|illustrated|collage|minimal)$/.test(saved.coverLook || '')) {
      picks.look = saved.coverLook;
      setPressed('look', picks.look);
    }
    imagery = core.extractImagery({
      lines: saved.lyrics || [],
      words: saved.words || {},
      mood: saved.mood,
    });
  }

  function keptChips() {
    return imagery.filter(function (chip) { return chip.on !== false; });
  }

  function renderPrefill() {
    var name = $('ca-artist').value.trim();
    var genre = $('ca-genre').value.trim();
    var line = name ? ('Artist: ' + name) : '';
    if (genre) line += (line ? ' · ' : '') + genre;
    var el = $('ca-prefill');
    el.hidden = !line;
    el.textContent = line;
  }

  function renderChips() {
    var host = $('ca-chips');
    var wrap = $('ca-imagery');
    host.textContent = '';
    if (!imagery.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    imagery.forEach(function (chip) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip ca-chip' + (chip.on === false ? ' off' : ' on');
      button.setAttribute('data-group', 'imagery');
      button.setAttribute('data-id', chip.id);
      button.setAttribute('aria-pressed', chip.on === false ? 'false' : 'true');
      button.textContent = chip.label;
      host.appendChild(button);
    });
  }

  function fillIdeaFromChips() {
    if (!ideaAuto && $('ca-idea').value.trim()) return;
    var built = core.suggestFromImagery(keptChips());
    if (!built.idea) return;
    $('ca-idea').value = built.idea;
    ideaAuto = true;
    stripEl.hidden = !built.note;
    stripEl.textContent = built.note || '';
  }

  function setPressed(group, value) {
    document.querySelectorAll('[data-group="' + group + '"]').forEach(function (btn) {
      var on = btn.getAttribute('data-value') === value;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderDots() {
    dotsEl.textContent = '';
    STEPS.forEach(function (id, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sh-dot' + (index === step ? ' on' : '') + (index < step ? ' done' : '');
      btn.setAttribute('aria-label', 'Step ' + (index + 1) + ' of ' + STEPS.length);
      if (index < step) btn.addEventListener('click', function () { go(index, true); });
      else btn.disabled = true;
      dotsEl.appendChild(btn);
    });
  }

  function validate(id) {
    if (id === 'identity') {
      if (!$('ca-artist').value.trim()) return 'Add the artist name. A stage name is fine.';
      if (!$('ca-title').value.trim()) return 'Add the song title.';
    }
    if (id === 'look' && !picks.look) return 'Pick a look. Photo, painted, illustrated, collage, or minimal.';
    if (id === 'idea' && $('ca-idea').value.trim().length < 3) return 'Tell me the image in a sentence, or use Suggest from my song.';
    if (id === 'options' && !images.length) return 'Make the covers first.';
    if (id === 'options' && (selected < 0 || !images[selected])) return 'Tap the cover you want.';
    return '';
  }

  function showStep() {
    var id = STEPS[step];
    document.querySelectorAll('[data-step]').forEach(function (section) {
      section.hidden = section.getAttribute('data-step') !== id;
    });
    qEl.textContent = COPY[id][0];
    helpEl.textContent = COPY[id][1];
    shell.classList.toggle('is-compact', step > 0);
    backBtn.hidden = step === 0;
    nextBtn.hidden = id === 'overlay';
    nextBtn.textContent = NEXT_LABEL[id] || 'Next';
    renderDots();
    showError('');
    if (id === 'idea') {
      renderPrefill();
      renderChips();
      if (!$('ca-idea').value.trim()) fillIdeaFromChips();
    }
    if (id === 'overlay') {
      $('ca-overlay-artist').value = $('ca-artist').value.trim();
      $('ca-overlay-title').value = $('ca-title').value.trim();
      paintPreview();
      rightsEl.textContent = (preview ? core.PLACEHOLDER_RECORD : core.GROK_RECORD) + ' ' + core.IMAGE_RIGHTS;
      writeCover(preview ? core.PLACEHOLDER_RECORD : core.GROK_RECORD);
      checkReleaseText();
    }
  }

  function go(index, skipValidate) {
    if (busy) return;
    if (!skipValidate && index > step) {
      var problem = validate(STEPS[step]);
      if (problem) {
        showError(problem);
        return;
      }
      if (STEPS[step] === 'idea') {
        step = index;
        showStep();
        loadCovers();
        window.scrollTo(0, 0);
        return;
      }
    }
    step = index;
    showStep();
    window.scrollTo(0, 0);
  }

  function rng(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawPlaceholder(ctx, spec, size) {
    var colors = spec.colors || ['#120818', '#7D3CFF', '#F3CB47'];
    var rand = rng(spec.seed || 1);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, size, size);
    var look = spec.look || 'photo';
    var n = look === 'minimal' ? 2 : 6;
    for (var i = 0; i < n; i += 1) {
      ctx.save();
      ctx.globalAlpha = look === 'painted' ? 0.55 : 0.9;
      ctx.fillStyle = colors[(i % (colors.length - 1)) + 1] || colors[1];
      var x = rand() * size;
      var y = rand() * size;
      var w = size * (0.18 + rand() * 0.45);
      if (look === 'collage') {
        ctx.translate(x, y);
        ctx.rotate((rand() - 0.5) * 0.8);
        ctx.fillRect(-w / 2, -w / 3, w, w * 0.62);
      } else if (look === 'illustrated' || look === 'minimal') {
        ctx.beginPath();
        ctx.arc(x, y, w * (look === 'minimal' ? 0.7 : 0.45), 0, Math.PI * 2);
        ctx.fill();
      } else {
        var g = ctx.createRadialGradient(x, y, size * 0.02, x, y, w);
        g.addColorStop(0, colors[(i % (colors.length - 1)) + 1] || colors[1]);
        g.addColorStop(1, colors[0]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
      }
      ctx.restore();
    }
  }

  function renderOptions() {
    grid.textContent = '';
    images.forEach(function (spec, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'ca-option' + (index === selected ? ' on' : '');
      button.setAttribute('aria-pressed', index === selected ? 'true' : 'false');
      button.setAttribute('aria-label', 'Cover option ' + (index + 1));
      if (spec.b64) {
        var img = document.createElement('img');
        img.alt = '';
        img.src = 'data:image/jpeg;base64,' + spec.b64;
        button.appendChild(img);
      } else {
        var canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 480;
        drawPlaceholder(canvas.getContext('2d'), spec, 480);
        button.appendChild(canvas);
      }
      button.addEventListener('click', function () {
        selected = index;
        renderOptions();
      });
      grid.appendChild(button);
    });
  }

  function setBusy(on) {
    busy = on;
    loadingEl.hidden = !on;
    nextBtn.disabled = on;
    $('ca-regen').disabled = on;
  }

  async function loadCovers() {
    setBusy(true);
    genError.hidden = true;
    var guarded = core.guardCoverText($('ca-idea').value);
    if (guarded.rejected) {
      setBusy(false);
      genError.hidden = false;
      genError.textContent = guarded.note;
      return;
    }
    try {
      var response = await fetch('/api/cover-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          look: picks.look,
          palette: picks.palette,
          customColor: $('ca-custom').value,
          idea: $('ca-idea').value.trim(),
          count: Number(picks.count) || 3,
          chips: keptChips().map(function (chip) { return chip.label; }),
          session_id: ensureSessionId(),
          company_website: $('ca-honey').value,
        }),
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.ok) {
        genError.hidden = false;
        genError.textContent = data.error || 'The covers did not come back. Try again in a moment.';
        return;
      }
      images = data.images || [];
      selected = 0;
      preview = Boolean(data.preview);
      upscaleNote = data.upscaleNote || '';
      banner.hidden = !preview;
      banner.textContent = preview ? core.PLACEHOLDER_NOTICE : '';
      attr.hidden = preview || !data.attribution;
      attr.textContent = preview ? '' : (data.attribution || '');
      noteEl.hidden = !data.note;
      noteEl.textContent = data.note || '';
      upscaleEl.hidden = preview || !data.upscale;
      upscaleEl.textContent = preview ? '' : (data.upscaleNote || core.UPSCALE_NOTE);
      renderOptions();
      writeCover(preview ? core.PLACEHOLDER_RECORD : core.GROK_RECORD);
    } catch (err) {
      genError.hidden = false;
      genError.textContent = 'The covers did not come back. Check the connection and try again.';
    } finally {
      setBusy(false);
    }
  }

  function fontOf(size) {
    var face = FONTS[picks.font] || FONTS.grotesk;
    return face.weight + ' ' + size + 'px ' + face.css;
  }

  function wrapText(ctx, text, maxWidth) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    var lines = [];
    var current = '';
    words.forEach(function (word) {
      var trial = current ? current + ' ' + word : word;
      if (ctx.measureText(trial).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else current = trial;
    });
    if (current) lines.push(current);
    return lines.slice(0, 3);
  }

  function paint(ctx, size, source) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (source && source.b64 && source.image) {
      ctx.drawImage(source.image, 0, 0, size, size);
    } else if (source) {
      drawPlaceholder(ctx, source, size);
    } else {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, size, size);
    }
    var artist = $('ca-overlay-artist').value.trim();
    var title = $('ca-overlay-title').value.trim();
    var color = $('ca-text-color').value || '#F3CB47';
    var scale = size / 720;
    var titleSize = Math.round(Number($('ca-size').value || 92) * scale);
    var maxWidth = size * 0.84;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = Math.max(8, size * 0.012);
    ctx.font = fontOf(Math.round(titleSize * 0.42));
    var artistLines = wrapText(ctx, artist, maxWidth);
    ctx.font = fontOf(titleSize);
    var titleLines = wrapText(ctx, title, maxWidth);
    var artistSize = Math.round(titleSize * 0.42);
    var gap = Math.round(titleSize * 0.28);
    var block = artistLines.length * artistSize * 1.15 + gap + titleLines.length * titleSize * 1.12;
    var y;
    if (picks.position === 'top') y = size * 0.08;
    else if (picks.position === 'bottom') y = size - block - size * 0.08;
    else y = (size - block) / 2;
    ctx.font = fontOf(artistSize);
    artistLines.forEach(function (line) {
      ctx.fillText(line, size / 2, y);
      y += artistSize * 1.15;
    });
    y += gap * 0.35;
    ctx.font = fontOf(titleSize);
    titleLines.forEach(function (line) {
      ctx.fillText(line, size / 2, y);
      y += titleSize * 1.12;
    });
    ctx.shadowBlur = 0;
  }

  function currentSource() {
    return images[selected] || null;
  }

  function paintPreview() {
    var ctx = previewCanvas.getContext('2d');
    var source = currentSource();
    loadFont();
    if (source && source.b64) {
      var img = new Image();
      img.onload = function () {
        source.image = img;
        if (img.naturalWidth >= core.EXPORT_PX) upscaleEl.hidden = true;
        paint(ctx, previewCanvas.width, source);
      };
      img.src = 'data:image/jpeg;base64,' + source.b64;
      return;
    }
    paint(ctx, previewCanvas.width, source);
  }

  function loadFont() {
    var face = FONTS[picks.font] || FONTS.grotesk;
    if (document.fonts && document.fonts.load) return document.fonts.load(face.load);
    return Promise.resolve();
  }

  function releaseWarning(text) {
    if (/https?:\/\/|www\./i.test(text)) return 'That text has a URL. Covers usually leave links off the art.';
    if (/@[A-Za-z0-9_]/.test(text)) return 'That text has a social handle. Covers usually leave handles off the art.';
    if (/\$\s?\d/.test(text)) return 'That text looks like a price. Covers usually leave prices off the art.';
    if (/\b(spotify|apple music|itunes|amazon music|youtube music|tidal|deezer)\b/i.test(text)) {
      return 'That text names a store. Covers usually leave store logos and names off the art.';
    }
    return '';
  }

  function checkReleaseText() {
    var text = $('ca-overlay-artist').value + ' ' + $('ca-overlay-title').value;
    var warning = releaseWarning(text);
    checkNote.hidden = !warning;
    checkNote.textContent = warning;
  }

  function downloadBlob(blob, name) {
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1500);
  }

  async function exportCover() {
    await loadFont();
    var canvas = document.createElement('canvas');
    canvas.width = core.EXPORT_PX;
    canvas.height = core.EXPORT_PX;
    var source = currentSource();
    if (source && source.b64 && !source.image) {
      await new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          source.image = img;
          resolve();
        };
        img.onerror = function () { resolve(); };
        img.src = 'data:image/jpeg;base64,' + source.b64;
      });
    }
    paint(canvas.getContext('2d'), core.EXPORT_PX, source);
    var blob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });
    if (!blob) {
      showError('The file did not export. Try again.');
      return;
    }
    downloadBlob(blob, 'plaiground-cover.jpg');
    writeCover(preview ? core.PLACEHOLDER_RECORD : core.GROK_RECORD);
  }

  function suggest() {
    var built = core.suggestFromImagery(keptChips());
    if (!built.idea) {
      var saved = readSession();
      built = core.suggestFromSong({
        mood: saved.mood,
        place: saved.words && saved.words.place,
        room: saved.words && saved.words.room,
        color: saved.words && saved.words.color,
        time: saved.words && saved.words.time,
      });
    }
    if (!built.idea) {
      showError('Use Song Helper first, or write the idea yourself.');
      return;
    }
    ideaAuto = true;
    $('ca-idea').value = built.idea;
    stripEl.hidden = !built.note;
    stripEl.textContent = built.note || '';
    showError('');
  }

  form.addEventListener('submit', function (event) { event.preventDefault(); });
  form.addEventListener('click', function (event) {
    var chip = event.target.closest ? event.target.closest('[data-group]') : null;
    if (!chip || chip.tagName === 'INPUT') return;
    var group = chip.getAttribute('data-group');
    var value = chip.getAttribute('data-value');
    if (group === 'imagery') {
      var id = chip.getAttribute('data-id');
      imagery.forEach(function (item) {
        if (item.id === id) item.on = item.on === false;
      });
      renderChips();
      fillIdeaFromChips();
      showError('');
      return;
    }
    if (!group || !value) return;
    picks[group] = value;
    setPressed(group, value);
    if (group === 'look') {
      var savedLook = readSession();
      savedLook.coverLook = value;
      try { sessionStorage.setItem(song.SESSION_KEY, JSON.stringify(savedLook)); } catch (err) {}
    }
    if (group === 'palette') $('ca-custom-wrap').hidden = value !== 'custom';
    if (group === 'font' || group === 'position') paintPreview();
    showError('');
  });

  ['ca-overlay-artist', 'ca-overlay-title'].forEach(function (id) {
    $(id).addEventListener('input', function () {
      if (id === 'ca-overlay-artist') $('ca-artist').value = $(id).value;
      if (id === 'ca-overlay-title') $('ca-title').value = $(id).value;
      paintPreview();
      checkReleaseText();
    });
  });
  $('ca-text-color').addEventListener('input', paintPreview);
  $('ca-size').addEventListener('input', paintPreview);
  $('ca-idea').addEventListener('input', function () {
    ideaAuto = false;
    var guarded = core.guardCoverText($('ca-idea').value);
    stripEl.hidden = !guarded.note;
    stripEl.textContent = guarded.note || '';
  });
  $('ca-suggest').addEventListener('click', suggest);
  $('ca-regen').addEventListener('click', function () {
    if (!busy) loadCovers();
  });
  $('ca-export').addEventListener('click', function () {
    exportCover();
  });
  backBtn.addEventListener('click', function () {
    if (step > 0) go(step - 1, true);
  });
  nextBtn.addEventListener('click', function () {
    if (step < STEPS.length - 1) go(step + 1, false);
  });
  form.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return;
    if (event.target && event.target.tagName === 'TEXTAREA') return;
    if (event.target && event.target.tagName === 'INPUT' && event.target.type !== 'color' && event.target.type !== 'range') {
      event.preventDefault();
      if (!nextBtn.hidden) nextBtn.click();
    }
  });

  function applyProfile(me) {
    var hint = song.profileForCover(me);
    if (!hint) return;
    profileArtists = hint.artists || [];
    var saved = readSession();
    if (!$('ca-artist').value.trim()) $('ca-artist').value = saved.artistName || hint.name || '';
    if (!$('ca-genre').value.trim()) $('ca-genre').value = saved.genre || ((hint.genres || [])[0] || '');
    var note = $('ca-profile-note');
    note.hidden = false;
    var genreLine = (hint.genres && hint.genres[0]) ? ('Genre on file: ' + hint.genres[0] + '. ') : '';
    note.textContent = 'Artist name from your profile. You can edit it. ' + genreLine + 'Brand colors and a logo are not stored on artist profiles yet.';
    if (hint.photo) {
      $('ca-photo').src = hint.photo;
      $('ca-photo-wrap').hidden = false;
    }
    var pickWrap = $('ca-artist-pick-wrap');
    var select = $('ca-artist-pick');
    if (profileArtists.length > 1) {
      select.textContent = '';
      profileArtists.forEach(function (row, index) {
        var option = document.createElement('option');
        option.value = String(index);
        option.textContent = row.name;
        select.appendChild(option);
      });
      pickWrap.hidden = false;
    }
    renderPrefill();
  }

  if ($('ca-photo-remove')) {
    $('ca-photo-remove').addEventListener('click', function () {
      $('ca-photo').removeAttribute('src');
      $('ca-photo-wrap').hidden = true;
    });
  }
  if ($('ca-artist-pick')) {
    $('ca-artist-pick').addEventListener('change', function () {
      var row = profileArtists[Number($('ca-artist-pick').value)];
      if (!row) return;
      $('ca-artist').value = row.name || '';
      if ((row.genres || [])[0]) $('ca-genre').value = row.genres[0];
      if (row.photo) {
        $('ca-photo').src = row.photo;
        $('ca-photo-wrap').hidden = false;
      } else {
        $('ca-photo-wrap').hidden = true;
      }
      renderPrefill();
    });
  }
  $('ca-artist').addEventListener('input', renderPrefill);
  $('ca-genre').addEventListener('input', function () {
    renderPrefill();
    if (ideaAuto) fillIdeaFromChips();
  });

  fetch('/api/me', { credentials: 'same-origin' }).then(function (res) {
    if (!res.ok) return null;
    return res.json();
  }).then(applyProfile).catch(function () {});

  rightsEl.textContent = core.IMAGE_RIGHTS;
  prefill();
  showStep();
})();
