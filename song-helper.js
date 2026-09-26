(function () {
  var core = window.SongHelperCore;
  if (!core) return;

  var packs = window.SongPacks;
  if (!packs) return;

  var STEPS = ['mood', 'genre', 'happened', 'who', 'why', 'line', 'words', 'shape', 'draft', 'style', 'record', 'next'];
  var COPY = {
    mood: ['What is the mood?', 'Tap the feeling that fits. If none of them do, write your own.'],
    genre: ['What kind of song is this?', 'Pick a genre. The picture questions will match it. Comedy is its own lane.'],
    happened: ['What happened, in one sentence?', 'Keep it concrete. This sentence can go in the song as you wrote it.'],
    who: ['Who is this song for or about?', 'A nickname is fine.'],
    why: ['What did they do, or what changed?', 'One sentence. Your words, not a polished line.'],
    line: ['If they were standing in front of you right now, what would you say?', 'A full sentence. This is the hook seed, and we keep it word for word.'],
    words: ['Give me the pictures.', 'Short phrases or full lines work better than single words. They show up in the draft exactly as you write them.'],
    shape: ['What shape is the song?', 'Language, clean or explicit, and how long you want the draft.'],
    draft: ['Your draft.', 'Pick a hook. Your lines stay underlined. Edit anything that doesn’t sound like you.'],
    style: ['Describe the sound.', 'This becomes a style prompt you can paste into Suno. We describe the sound instead of naming artists.'],
    record: ['Your authorship record.', 'What you wrote, and what was drafted around it. Download it or print it.'],
    next: ['When you want a team on it.', 'Song Helper is a free way to start. PLAIGROUND is the AI-powered music business around the song.'],
  };
  var NEXT_LABEL = {
    mood: 'Next',
    genre: 'Next',
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

  var step = 0;
  var picks = {
    mood: '',
    pack: '',
    comedyType: '',
    comedyMusic: '',
    language: 'english',
    explicit: 'clean',
    length: 'full',
    era: '',
    energy: '',
    voice: '',
    texture: '',
  };
  var instruments = [];
  var wordValues = {};
  var promptRoll = {};
  var styleTouched = false;
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
    return packs.genreLabel(picks.pack, picks.comedyMusic, picks.comedyType) || '';
  }

  function rememberWords() {
    document.querySelectorAll('#sh-words [data-word]').forEach(function (el) {
      wordValues[el.getAttribute('data-word')] = el.value;
    });
  }

  function words() {
    rememberWords();
    var out = {};
    packs.promptsFor(picks.pack || 'generic', 0).forEach(function (prompt) {
      out[prompt.key] = String(wordValues[prompt.key] || '').trim();
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
        pack: picks.pack,
        comedy: picks.pack === 'comedy',
        comedyType: picks.comedyType,
        comedyMusic: picks.comedyMusic,
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
    Object.keys(bank).forEach(function (key) { if (bank[key]) count += 1; });
    return count;
  }

  function parodyMessage(text) {
    if (/to the tune of|parody of/i.test(text || '')) {
      return 'Write an original line. This page does not parody existing songs or write to the tune of a real one.';
    }
    return '';
  }

  function validate(id) {
    if (id === 'mood') {
      if (!picks.mood) return 'Pick a mood, or write your own.';
      if (picks.mood === 'custom' && !moodValue()) return 'Tell me the mood in a few words.';
    }
    if (id === 'genre') {
      if (!picks.pack) return 'Pick a genre.';
      if (picks.pack === 'comedy' && !picks.comedyType) return 'Pick a comedy type.';
      if (picks.pack === 'comedy' && !picks.comedyMusic) return 'Pick a musical style for the comedy song.';
    }
    if (id === 'happened') {
      if ($('sh-happened').value.trim().length < 8) return 'Give me one sentence. Even a short one.';
      var happenedJoke = parodyMessage($('sh-happened').value);
      if (happenedJoke) return happenedJoke;
    }
    if (id === 'who') {
      if (!$('sh-who').value.trim()) return 'A nickname is enough.';
      if (picks.pack === 'comedy' && core.publicFigureName($('sh-who').value)) {
        return 'Roasts stay about people you know. Leave public figures and celebrities out.';
      }
    }
    if (id === 'why') {
      if ($('sh-why').value.trim().length < 8) return 'One sentence about what they did, or what changed.';
      var whyJoke = parodyMessage($('sh-why').value);
      if (whyJoke) return whyJoke;
    }
    if (id === 'line') {
      var line = $('sh-line').value.trim();
      if (line.length < 12 || line.indexOf(' ') === -1) return 'Write a full sentence. That line stays yours, word for word.';
      var lineJoke = parodyMessage(line);
      if (lineJoke) return lineJoke;
    }
    if (id === 'words') {
      if (filledWords() < 1) return 'Add at least one picture. A short phrase is perfect.';
      var bank = words();
      var wordJoke = '';
      Object.keys(bank).forEach(function (key) {
        if (!wordJoke) wordJoke = parodyMessage(bank[key]);
      });
      if (wordJoke) return wordJoke;
    }
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
    if (id === 'who' && picks.pack === 'comedy') {
      helpEl.textContent = 'A nickname for someone you know, a pet, or the snack. Public figures stay out of it.';
    }
    if (id === 'line' && picks.pack === 'comedy') {
      helpEl.textContent = 'A full sentence, as silly as you want. It stays word for word. Original lines only.';
    }
    if (id === 'words') {
      var pack = packs.get(picks.pack);
      if (pack && pack.wordHelp) helpEl.textContent = pack.wordHelp;
    }
    helpEl.hidden = id === 'record';
    shell.classList.toggle('is-compact', step > 0);
    backBtn.hidden = step === 0;
    nextBtn.hidden = id === 'next';
    nextBtn.textContent = NEXT_LABEL[id] || 'Next';
    restartBtn.hidden = id !== 'next';
    renderDots();
    showError('');
    if (id === 'genre') $('sh-comedy').hidden = picks.pack !== 'comedy';
    if (id === 'words') renderWords();
    if (id === 'style') {
      applyStyleDefaults();
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

  function renderWords() {
    var host = $('sh-words');
    if (!host) return;
    rememberWords();
    host.textContent = '';
    var rollBase = 0;
    packs.promptsFor(picks.pack || 'generic', rollBase).forEach(function (base) {
      var roll = promptRoll[base.key] || 0;
      var prompt = packs.promptsFor(picks.pack || 'generic', roll).filter(function (item) {
        return item.key === base.key;
      })[0] || base;
      var label = document.createElement('label');
      label.className = 'sh-field';
      var span = document.createElement('span');
      span.textContent = prompt.label;
      var input = document.createElement('input');
      input.className = 'sh-input';
      input.setAttribute('data-word', prompt.key);
      input.maxLength = 160;
      input.autocomplete = 'off';
      input.placeholder = prompt.placeholder || '';
      input.value = wordValues[prompt.key] || '';
      label.appendChild(span);
      label.appendChild(input);
      if (prompt.hint) {
        var hint = document.createElement('em');
        hint.className = 'sh-hint';
        hint.textContent = prompt.hint;
        label.appendChild(hint);
      }
      host.appendChild(label);
    });
    var comedyNote = $('sh-words-comedy');
    if (comedyNote) comedyNote.hidden = picks.pack !== 'comedy';
  }

  function surpriseWords() {
    packs.promptsFor(picks.pack || 'generic', 0).forEach(function (prompt) {
      var variants = (packs.get(picks.pack || 'generic') || packs.GENERIC).prompts.filter(function (item) {
        return item.key === prompt.key;
      })[0];
      var len = variants && variants.variants ? variants.variants.length : 1;
      var current = promptRoll[prompt.key] || 0;
      if (len < 2) return;
      var jump = 1 + Math.floor(Math.random() * (len - 1));
      promptRoll[prompt.key] = (current + jump) % len;
    });
    renderWords();
  }

  function setInstruments(list) {
    instruments = list.slice(0, 3);
    document.querySelectorAll('[data-group="instrument"]').forEach(function (btn) {
      var on = instruments.indexOf(btn.getAttribute('data-value')) >= 0;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function selectStyleGenre(value) {
    styleGenreInput.value = value || '';
    var matched = '';
    document.querySelectorAll('[data-group="styleGenre"]').forEach(function (btn) {
      if (matched) return;
      if ((btn.getAttribute('data-value') || '').toLowerCase() === String(value || '').toLowerCase()) {
        matched = btn.getAttribute('data-value');
      }
    });
    setPressed('styleGenre', matched);
  }

  function applyStyleDefaults() {
    if (styleTouched) return;
    var style = packs.styleFor(picks.pack, picks.comedyMusic);
    if (!style || !style.genre) return;
    picks.era = '';
    picks.energy = '';
    setPressed('era', '');
    setPressed('energy', '');
    setInstruments([]);
    if (style.era) {
      picks.era = style.era;
      setPressed('era', style.era);
    }
    if (style.energy) {
      picks.energy = style.energy;
      setPressed('energy', style.energy);
    }
    if (style.instruments && style.instruments.length) setInstruments(style.instruments);
    selectStyleGenre(style.genre);
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

  function compactLyrics(source) {
    var lines = [];
    ((source && source.sections) || []).forEach(function (section) {
      (section.lines || []).forEach(function (line) {
        var text = String((line && line.text) || '').trim();
        if (!text) return;
        lines.push({ text: text.slice(0, 280), yours: line.source === 'user' });
      });
    });
    return lines.slice(0, 80);
  }

  function persistSession() {
    var data = interview();
    var title = (titleEl && titleEl.value.trim()) || (draft && draft.title) || '';
    var artistName = $('sh-artist') ? $('sh-artist').value.trim() : '';
    if (!data.mood && !data.line && !title && !artistName) return;
    var prev = readSession();
    try {
      sessionStorage.setItem(core.SESSION_KEY, JSON.stringify({
        mood: data.mood,
        happened: data.happened,
        who: data.who,
        why: data.why,
        line: data.line,
        words: data.words,
        genre: data.shape.genre || prev.genre || '',
        pack: picks.pack || prev.pack || '',
        comedy: picks.pack === 'comedy',
        comedyType: picks.comedyType || '',
        comedyMusic: picks.comedyMusic || '',
        coverLook: packs.coverLookFor(picks.pack) || prev.coverLook || '',
        title: title || prev.title || '',
        artistName: artistName || prev.artistName || '',
        lyrics: draft ? compactLyrics(draft) : (prev.lyrics || []),
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
      styleTouched = true;
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
      styleTouched = true;
      styleGenreInput.value = value;
      setPressed(group, value);
      renderStyle();
      showError('');
      return;
    }
    if (group === 'era' || group === 'energy' || group === 'voice' || group === 'texture' || group === 'pack' || group === 'comedyMusic') {
      if (group === 'era' || group === 'energy' || group === 'voice' || group === 'texture') styleTouched = true;
    }
    picks[group] = value;
    setPressed(group, value);
    if (group === 'mood') $('sh-mood-custom').hidden = value !== 'custom';
    if (group === 'pack') {
      $('sh-comedy').hidden = value !== 'comedy';
      renderWords();
    }
    if (group === 'era' || group === 'energy' || group === 'voice' || group === 'texture') renderStyle();
    showError('');
  });

  ['sh-style-genre', 'sh-feeling', 'sh-mood-input'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', function () {
      if (id === 'sh-style-genre' || id === 'sh-feeling') styleTouched = true;
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

  var profileArtists = [];

  function packForProfile(name) {
    return packs.matchGenre(name) || '';
  }

  function applyArtistRow(row) {
    if (!row) return;
    if (!$('sh-artist').value.trim()) $('sh-artist').value = row.name || '';
    var packId = packForProfile((row.genres || [])[0]);
    if (packId && !picks.pack) {
      picks.pack = packId;
      setPressed('pack', packId);
      $('sh-comedy').hidden = packId !== 'comedy';
    }
    var note = (row.genres && row.genres[0]) ? ('Genre on file: ' + row.genres[0] + '. You can change it when you pick the genre.') : 'No genre is stored on this profile yet.';
    if (row.photo) note += ' A profile photo is on file. It shows on the cover step and is not sent to the image model.';
    note += ' Brand colors and a logo are not stored on artist profiles yet.';
    $('sh-profile-note').textContent = note;
    $('sh-profile').hidden = false;
    persistSession();
  }

  function fillArtistPick() {
    var wrap = $('sh-artist-pick-wrap');
    var select = $('sh-artist-pick');
    if (profileArtists.length < 2) {
      wrap.hidden = true;
      return;
    }
    select.textContent = '';
    profileArtists.forEach(function (row, index) {
      var option = document.createElement('option');
      option.value = String(index);
      option.textContent = row.name;
      select.appendChild(option);
    });
    wrap.hidden = false;
  }

  if ($('sh-artist')) {
    $('sh-artist').addEventListener('input', persistSession);
  }
  if ($('sh-artist-pick')) {
    $('sh-artist-pick').addEventListener('change', function () {
      var row = profileArtists[Number($('sh-artist-pick').value)] || null;
      if (!row) return;
      $('sh-artist').value = row.name || '';
      var packId = packForProfile((row.genres || [])[0]);
      if (packId) {
        picks.pack = packId;
        setPressed('pack', packId);
        $('sh-comedy').hidden = packId !== 'comedy';
      }
      applyArtistRow(row);
    });
  }

  fetch('/api/me', { credentials: 'same-origin' }).then(function (res) {
    if (!res.ok) return null;
    return res.json();
  }).then(function (me) {
    var hint = core.profileForCover(me);
    if (!hint) return;
    profileArtists = hint.artists || [];
    fillArtistPick();
    applyArtistRow(profileArtists[0]);
  }).catch(function () {});

  function renderChoiceChips(host, group, items) {
    if (!host) return;
    host.textContent = '';
    items.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sh-chip';
      btn.setAttribute('data-group', group);
      btn.setAttribute('data-value', item.id);
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = item.label;
      host.appendChild(btn);
    });
  }

  renderChoiceChips($('sh-genres'), 'pack', packs.list().map(function (pack) {
    return { id: pack.id, label: pack.name };
  }));
  renderChoiceChips($('sh-comedy-types'), 'comedyType', packs.COMEDY_TYPES.map(function (item) {
    return { id: item.id, label: item.label };
  }));
  renderChoiceChips($('sh-comedy-music'), 'comedyMusic', packs.COMEDY_MUSIC.map(function (item) {
    return { id: item.id, label: item.label };
  }));
  if ($('sh-surprise')) $('sh-surprise').addEventListener('click', surpriseWords);

  showStep();
}());
