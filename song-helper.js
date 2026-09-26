(function () {
  var core = window.SongHelperCore;
  if (!core) return;

  var STEPS = ['mood', 'happened', 'who', 'why', 'line', 'words', 'shape', 'draft', 'style', 'record', 'next'];
  var COPY = {
    mood: ['What is the mood?', 'Tap the feeling that fits. If none of them do, write your own.'],
    happened: ['What happened, in one sentence?', 'Keep it concrete. This sentence can go in the song as you wrote it.'],
    who: ['Who is this song for or about?', 'A nickname is fine.'],
    why: ['What did they do, or what changed?', 'One sentence. Your words, not a polished line.'],
    line: ['If they were standing in front of you right now, what would you say?', 'A full sentence. This is the hook seed, and we keep it word for word.'],
    words: ['Give me the pictures.', 'Short phrases or full lines work better than single words. They show up in the draft exactly as you write them.'],
    shape: ['What shape is the song?', 'Genre, language, and how long you want the draft.'],
    draft: ['Your draft.', 'Pick a hook. Your lines stay underlined. Edit anything that doesn’t sound like you.'],
    style: ['Describe the sound.', 'This becomes a style prompt you can paste into Suno. We describe the sound instead of naming artists.'],
    record: ['Your authorship record.', 'What you wrote, and what was drafted around it. Download it or print it.'],
    next: ['When you want a team on it.', 'Song Helper is a free way to start. PLAIGROUND is the AI-powered music business around the song.'],
  };
  var NEXT_LABEL = {
    mood: 'Next',
    happened: 'Next',
    who: 'Next',
    why: 'Next',
    line: 'Next',
    words: 'Next',
    shape: 'Write the draft',
    draft: 'Build the style prompt',
    style: 'Authorship record',
    record: 'Next steps',
  };
  var GENRES = ['R&B', 'Pop', 'Hip-hop', 'Latin', 'Country', 'Afrobeats', 'Indie', 'Rock', 'Gospel', 'Corridos'];

  var step = 0;
  var picks = {
    mood: '',
    genre: '',
    language: 'english',
    explicit: 'clean',
    length: 'full',
    era: '',
    energy: '',
    voice: '',
    texture: '',
  };
  var instruments = [];
  var draft = null;
  var preview = true;
  var draftKey = '';
  var variant = 0;
  var busy = false;

  var shell = document.getElementById('sh-shell');
  var form = document.getElementById('sh-form');
  var qEl = document.getElementById('sh-q');
  var helpEl = document.getElementById('sh-help');
  var dotsEl = document.getElementById('sh-dots');
  var backBtn = document.getElementById('sh-back');
  var nextBtn = document.getElementById('sh-next');
  var restartBtn = document.getElementById('sh-restart');
  var formError = document.getElementById('sh-form-error');
  var banner = document.getElementById('sh-banner');
  var attr = document.getElementById('sh-attr');
  var hooksEl = document.getElementById('sh-hooks');
  var lyricEl = document.getElementById('sh-lyric');
  var titleEl = document.getElementById('sh-title');
  var loadingEl = document.getElementById('sh-loading');
  var draftError = document.getElementById('sh-error');
  var promptEl = document.getElementById('sh-prompt');
  var artistNote = document.getElementById('sh-artist-note');
  var recordEl = document.getElementById('sh-record');
  var styleGenreInput = document.getElementById('sh-style-genre');
  var feelingInput = document.getElementById('sh-feeling');

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

  function moodValue() {
    if (picks.mood === 'custom') return $('sh-mood-input').value.trim();
    return picks.mood;
  }

  function genreValue() {
    if (picks.genre === 'custom') return $('sh-genre-input').value.trim();
    return picks.genre;
  }

  function words() {
    var out = {};
    core.WORD_KEYS.forEach(function (key) {
      var el = document.querySelector('[data-word="' + key + '"]');
      out[key] = el ? el.value.trim() : '';
    });
    return out;
  }

  function interview() {
    return {
      mood: moodValue(),
      happened: $('sh-happened').value.trim(),
      who: $('sh-who').value.trim(),
      why: $('sh-why').value.trim(),
      line: $('sh-line').value.trim(),
      words: words(),
      shape: {
        genre: genreValue(),
        language: picks.language,
        explicit: picks.explicit,
        length: picks.length,
      },
      variant: variant,
      company_website: $('sh-honey').value,
    };
  }

  function interviewKey() {
    var data = interview();
    data.variant = variant;
    return JSON.stringify(data);
  }

  function filledWords() {
    var count = 0;
    var bank = words();
    core.WORD_KEYS.forEach(function (key) { if (bank[key]) count += 1; });
    return count;
  }

  function validate(id) {
    if (id === 'mood') {
      if (!picks.mood) return 'Pick a mood, or write your own.';
      if (picks.mood === 'custom' && !moodValue()) return 'Tell me the mood in a few words.';
    }
    if (id === 'happened' && $('sh-happened').value.trim().length < 8) return 'Give me one sentence. Even a short one.';
    if (id === 'who' && !$('sh-who').value.trim()) return 'A nickname is enough.';
    if (id === 'why' && $('sh-why').value.trim().length < 8) return 'One sentence about what they did, or what changed.';
    if (id === 'line') {
      var line = $('sh-line').value.trim();
      if (line.length < 12 || line.indexOf(' ') === -1) return 'Write a full sentence. That line stays yours, word for word.';
    }
    if (id === 'words' && filledWords() < 1) return 'Add at least one picture. A short phrase is perfect.';
    if (id === 'shape' && !genreValue()) return 'Pick a genre, or type one.';
    return '';
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
      if (index < step) {
        btn.addEventListener('click', function () { go(index, true); });
      } else {
        btn.disabled = true;
      }
      dotsEl.appendChild(btn);
    });
  }

  function showStep() {
    var id = STEPS[step];
    document.querySelectorAll('[data-step]').forEach(function (section) {
      section.hidden = section.getAttribute('data-step') !== id;
    });
    qEl.textContent = COPY[id][0];
    helpEl.textContent = COPY[id][1];
    helpEl.hidden = id === 'record';
    shell.classList.toggle('is-compact', step > 0);
    backBtn.hidden = step === 0;
    nextBtn.hidden = id === 'next';
    nextBtn.textContent = NEXT_LABEL[id] || 'Next';
    restartBtn.hidden = id !== 'next';
    renderDots();
    showError('');
    if (id === 'style') {
      if (!styleGenreInput.value && genreValue() && picks.genre !== 'custom') styleGenreInput.value = genreValue();
      renderStyle();
    }
    if (id === 'record') renderRecord();
    else persistSession();
    var focus = document.querySelector('[data-step="' + id + '"] textarea, [data-step="' + id + '"] input.sh-input');
    if (focus && step > 0 && id !== 'draft' && id !== 'style' && id !== 'record' && id !== 'next') {
      try { focus.focus(); } catch (err) {}
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
    }
    step = index;
    showStep();
    if (STEPS[step] === 'draft') loadDraft(false);
    window.scrollTo(0, 0);
  }

  function fit(el) {
    el.style.height = 'auto';
    el.style.height = Math.max(44, el.scrollHeight) + 'px';
  }

  function selectedHook() {
    if (!draft) return null;
    var chosen = draft.hooks.filter(function (hook) { return hook.selected; })[0];
    return chosen || draft.hooks[0];
  }

  function applyHook(id) {
    if (!draft) return;
    var hook = draft.hooks.filter(function (item) { return item.id === id; })[0];
    if (!hook) return;
    draft.hooks.forEach(function (item) { item.selected = item.id === id; });
    draft.sections.forEach(function (section) {
      section.lines.forEach(function (line) {
        if (line.role === 'hook') {
          line.text = hook.text;
          line.source = hook.source;
          line.original = hook.text;
          line.edited = false;
        }
      });
    });
    renderDraft();
  }

  function renderHooks() {
    hooksEl.textContent = '';
    draft.hooks.forEach(function (hook) {
      var btn = document.createElement('button');
      btn.type = 'button';
      var chosen = selectedHook();
      var selected = Boolean(hook.selected) || Boolean(chosen && chosen.id === hook.id);
      btn.className = 'sh-hook' + (selected ? ' on' : '');
      var label = document.createElement('small');
      label.textContent = hook.id === 'a' ? 'Hook A' : 'Hook B';
      btn.appendChild(label);
      btn.appendChild(document.createTextNode(hook.text));
      btn.addEventListener('click', function () { applyHook(hook.id); });
      hooksEl.appendChild(btn);
    });
  }

  function renderDraft() {
    if (!draft) return;
    titleEl.value = draft.title || '';
    renderHooks();
    lyricEl.textContent = '';
    draft.sections.forEach(function (section) {
      var label = document.createElement('p');
      label.className = 'sh-section-label';
      label.textContent = section.label;
      lyricEl.appendChild(label);
      section.lines.forEach(function (line) {
        var box = document.createElement('textarea');
        box.className = 'sh-line' + (line.source === 'user' ? ' is-user' : '');
        box.rows = 1;
        box.value = line.text;
        box.setAttribute('aria-label', section.label + ' line');
        box.addEventListener('input', function () {
          line.text = box.value;
          line.edited = box.value.trim() !== String(line.original || '').trim();
          if (line.source === 'user') box.classList.add('is-user');
          fit(box);
        });
        lyricEl.appendChild(box);
        fit(box);
      });
    });
    banner.hidden = !preview;
    banner.textContent = preview ? core.PREVIEW_NOTICE : '';
    attr.hidden = preview;
    attr.textContent = preview ? '' : core.GROK_ATTRIBUTION;
  }

  function setBusy(on, label) {
    busy = on;
    nextBtn.disabled = on;
    $('sh-regen').disabled = on;
    loadingEl.hidden = !on;
    if (on) loadingEl.textContent = label || 'Drafting around your words…';
  }

  async function loadDraft(force) {
    var key = interviewKey();
    if (!force && draft && draftKey === key) {
      renderDraft();
      return;
    }
    draftError.hidden = true;
    setBusy(true, force ? 'Writing another pass…' : 'Drafting around your words…');
    try {
      var response = await fetch('/api/song-helper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interview()),
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.ok || !data.draft) {
        draftError.hidden = false;
        draftError.textContent = data.error || 'The draft did not come back. Try again in a moment.';
        return;
      }
      draft = data.draft;
      preview = Boolean(data.preview);
      if (draft.hooks && draft.hooks[0]) draft.hooks[0].selected = true;
      draftKey = key;
      renderDraft();
    } catch (err) {
      draftError.hidden = false;
      draftError.textContent = 'The draft did not come back. Check the connection and try again.';
    } finally {
      setBusy(false);
    }
  }

  function styleGenre() {
    var typed = styleGenreInput.value.trim();
    if (typed) return typed;
    return genreValue();
  }

  function renderStyle() {
    var built = core.buildStylePrompt({
      genre: styleGenre(),
      era: picks.era,
      energy: picks.energy,
      voice: picks.voice,
      texture: picks.texture,
      instruments: instruments,
      feeling: feelingInput.value.trim(),
    });
    promptEl.textContent = built.prompt || 'Add a genre or a feeling and the prompt will show up here.';
    artistNote.hidden = !built.artistNamesStripped;
    promptEl.dataset.prompt = built.prompt || '';
  }

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(core.SESSION_KEY) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function persistSession() {
    var data = interview();
    var title = (titleEl && titleEl.value.trim()) || (draft && draft.title) || '';
    if (!data.mood && !data.line && !title) return;
    var prev = readSession();
    try {
      sessionStorage.setItem(core.SESSION_KEY, JSON.stringify({
        mood: data.mood,
        happened: data.happened,
        who: data.who,
        why: data.why,
        line: data.line,
        words: data.words,
        genre: data.shape.genre,
        title: title || prev.title || '',
        cover: prev.cover || null,
      }));
    } catch (err) {}
  }

  function renderRecord() {
    if (!draft) {
      recordEl.textContent = 'Write the draft first, then this record can list your lines.';
      return;
    }
    draft.title = titleEl.value.trim() || draft.title;
    var date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    var saved = readSession();
    recordEl.textContent = core.formatAuthorship(draft, {
      preview: preview,
      date: date,
      interview: interview(),
      cover: saved.cover || null,
    });
    persistSession();
  }

  function downloadRecord() {
    renderRecord();
    var blob = new Blob([recordEl.textContent], { type: 'text/plain;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plaiground-song-helper-authorship.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function editedDraft() {
    if (!draft) return false;
    return draft.sections.some(function (section) {
      return section.lines.some(function (line) { return line.edited; });
    });
  }

  form.addEventListener('submit', function (event) { event.preventDefault(); });
  form.addEventListener('click', function (event) {
    var chip = event.target.closest ? event.target.closest('.sh-chip') : null;
    if (!chip) return;
    var group = chip.getAttribute('data-group');
    var value = chip.getAttribute('data-value');
    if (group === 'instrument') {
      var index = instruments.indexOf(value);
      if (index >= 0) instruments.splice(index, 1);
      else if (instruments.length >= 3) {
        showError('Three instruments is enough. Tap one to remove it.');
        return;
      } else instruments.push(value);
      showError('');
      chip.classList.toggle('on', instruments.indexOf(value) >= 0);
      chip.setAttribute('aria-pressed', instruments.indexOf(value) >= 0 ? 'true' : 'false');
      renderStyle();
      return;
    }
    if (group === 'styleGenre') {
      styleGenreInput.value = value;
      setPressed(group, value);
      renderStyle();
      showError('');
      return;
    }
    picks[group] = value;
    setPressed(group, value);
    if (group === 'mood') $('sh-mood-custom').hidden = value !== 'custom';
    if (group === 'genre') $('sh-genre-custom').hidden = value !== 'custom';
    if (group === 'era' || group === 'energy' || group === 'voice' || group === 'texture') renderStyle();
    showError('');
  });

  ['sh-style-genre', 'sh-feeling', 'sh-genre-input', 'sh-mood-input'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', function () {
      if (STEPS[step] === 'style') renderStyle();
    });
  });

  titleEl.addEventListener('input', function () {
    if (draft) draft.title = titleEl.value;
  });

  form.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return;
    if (event.target && event.target.tagName === 'TEXTAREA') return;
    if (event.target && event.target.tagName === 'INPUT') {
      event.preventDefault();
      if (!nextBtn.hidden) nextBtn.click();
    }
  });

  backBtn.addEventListener('click', function () {
    if (step > 0) go(step - 1, true);
  });
  nextBtn.addEventListener('click', function () {
    if (step < STEPS.length - 1) go(step + 1, false);
  });
  restartBtn.addEventListener('click', function () {
    try { sessionStorage.removeItem(core.SESSION_KEY); } catch (err) {}
    window.location.reload();
  });
  $('sh-regen').addEventListener('click', function () {
    if (busy) return;
    if (editedDraft() && !window.confirm('Replace this draft with a new one? Edits on this screen will reset. Your answers stay.')) return;
    variant += 1;
    loadDraft(true);
  });
  $('sh-copy').addEventListener('click', function () {
    var text = promptEl.dataset.prompt || '';
    if (!text) {
      showError('Add a few sound choices first.');
      return;
    }
    var button = $('sh-copy');
    function done() {
      var previous = button.textContent;
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = previous; }, 1400);
    }
    function fallbackCopy() {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'absolute';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch (err) {}
      area.remove();
      done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
      return;
    }
    fallbackCopy();
  });
  $('sh-download').addEventListener('click', downloadRecord);
  $('sh-print').addEventListener('click', function () {
    renderRecord();
    window.print();
  });

  showStep();
}());
