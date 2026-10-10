(function () {
  var core = window.SongHelperCore;
  if (!core) return;

  var packs = window.SongPacks;
  if (!packs) return;

  function storyMax() {
    return (window.SongFlow && window.SongFlow.STORY_MAX) || 3000;
  }

  function armStory(el) {
    if (window.SongFlow && window.SongFlow.mountStoryBox) window.SongFlow.mountStoryBox(el);
  }

  function paintStory(el) {
    if (window.SongFlow && window.SongFlow.paintStoryBox) window.SongFlow.paintStoryBox(el);
  }

  ['sh-live-answer', 'sh-happened', 'sh-who', 'sh-why', 'sh-line'].forEach(function (id) {
    var el = document.getElementById(id);
    armStory(el);
    if (!el || id === 'sh-live-answer') return;
    el.addEventListener('input', function () {
      persistWizard();
      paintAnswers();
    });
  });

  var STORY_STORE = 'plaiground.songHelper.story';

  function readStoryStore() {
    try {
      return JSON.parse(localStorage.getItem(STORY_STORE) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function writeStoryStore(patch) {
    try {
      var prev = readStoryStore();
      Object.keys(patch || {}).forEach(function (key) { prev[key] = patch[key]; });
      localStorage.setItem(STORY_STORE, JSON.stringify(prev));
    } catch (err) {}
  }

  function persistWizard() {
    writeStoryStore({
      wizard: {
        happened: readAnswer('sh-happened'),
        who: ($('sh-who') && $('sh-who').value.trim()) || '',
        why: readAnswer('sh-why'),
        line: readAnswer('sh-line'),
      },
    });
  }

  function restoreWizard() {
    var saved = readStoryStore().wizard || {};
    var hasLocal = saved.happened || saved.who || saved.why || saved.line;
    if (!hasLocal) {
      var session = readSession();
      saved = {
        happened: session.happened || '',
        who: session.who || '',
        why: session.why || '',
        line: session.line || '',
      };
    }
    ['happened', 'who', 'why', 'line'].forEach(function (key) {
      var el = $('sh-' + key);
      if (!el || String(el.value || '').trim() || !saved[key]) return;
      el.value = String(saved[key]);
      paintStory(el);
    });
    if (saved.happened || saved.who || saved.why || saved.line) writeStoryStore({ wizard: saved });
  }

  var STEPS = ['genre', 'happened', 'who', 'why', 'line', 'words', 'shape', 'draft', 'style', 'record', 'next'];
  var COPY = {
    mood: ['What is the mood?', 'Tap the feeling that fits. If none of them do, write your own.'],
    genre: ['What sound should it wear?', 'Hip-hop, country, R&B, and the rest. Love, heartbreak, and the other kinds are already chosen above. Comedy is its own lane.'],
    happened: ['What happened, in one sentence?', 'Keep it concrete. This sentence can go in the song as you wrote it.'],
    who: ['Who is this song for or about?', 'A nickname is fine.'],
    why: ['What did they do, or what changed?', 'One sentence. Your words, not a polished line.'],
    line: ['If they were standing in front of you right now, what would you say?', 'A full sentence. This is the hook seed, and we keep it word for word.'],
    words: ['Give me the pictures.', 'Short phrases or full lines. I weave them into the song and keep your words.'],
    shape: ['What shape is the song?', 'Language, clean or explicit, and how long you want the draft.'],
    draft: ['Your draft.', 'Pick a hook. Your lines stay underlined. Edit anything that doesn’t sound like you.'],
    style: ['Describe the sound.', 'This becomes a style prompt you can copy. We describe the sound instead of naming artists.'],
    record: ['Your authorship record.', 'What you wrote, and what was drafted around it. Download it or print it.'],
    next: ['When you want a team on it.', 'Song Helper is a free way to start. PLAIGROUND is distribution and artist tools around the song. Autopilot for your music career.'],
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
    draft: 'Make my style prompt',
    style: 'Authorship record',
    record: 'Next steps',
  };

  var step = 0;
  var followOpen = false;
  var followSkipped = false;
  var followExtra = { place: '', object: '', quote: '' };
  var pendingRevision = '';
  var pendingPrevious = '';
  var feedbackOn = {};
  var feedbackNote = '';
  var styleOpen = false;
  var lyricsOpen = false;
  var styleDone = false;
  var styleJumped = false;
  var styleBag = null;
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
  var feelingInput = document.getElementById('sh-style-feel');

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

  function showMoodError(message) {
    var el = $('sh-mood-error');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function readAnswer(id) {
    var el = $(id);
    if (!el) return '';
    var value = String(el.value || '').trim();
    var hint = String(el.getAttribute('placeholder') || '').trim();
    if (hint && value.toLowerCase() === hint.toLowerCase()) return '';
    if (core.isPlaceholderLyric && core.isPlaceholderLyric(value)) return '';
    return value;
  }

  function moodValue() {
    if (picks.mood === 'custom') return $('sh-mood-input').value.trim();
    return picks.mood;
  }

  function genreValue() {
    var label = packs.genreLabel(picks.pack, picks.comedyMusic, picks.comedyType) || '';
    if (picks.genre2 && picks.genre2 !== label) label = label ? (label + ', ' + picks.genre2) : picks.genre2;
    return label;
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

  function sparkSeed() {
    if (!window.SongHelperV2 || !window.SongHelperV2.spark) return null;
    return window.SongHelperV2.spark() || null;
  }

  function ownIdea() {
    if (!window.SongHelperV2 || !window.SongHelperV2.ownIdea) return { idea: '', feel: '', story: '', keep: '' };
    return window.SongHelperV2.ownIdea() || { idea: '', feel: '', story: '', keep: '' };
  }

  function interview() {
    var spark = sparkSeed();
    var own = ownIdea();
    var titleRaw = ($('sh-working-title') && $('sh-working-title').value.trim()) || '';
    var idea = own.idea || '';
    if (titleRaw.length > 80 && idea.indexOf(titleRaw) === -1) {
      var joined = idea ? (idea + ' ' + titleRaw) : titleRaw;
      if (joined.length <= storyMax()) idea = joined;
    }
    return {
      mood: moodValue(),
      idea: idea.slice(0, storyMax()),
      sparkTitle: spark && spark.title ? String(spark.title).slice(0, 80) : '',
      sparkAngle: (spark && spark.angle ? String(spark.angle) : idea).slice(0, storyMax()),
      sparkFeel: (spark && spark.feel ? String(spark.feel) : (own.feel || '')).slice(0, storyMax()),
      sparkStory: (spark && spark.story ? String(spark.story) : (own.story || '')).slice(0, storyMax()),
      sparkKeep: (spark && spark.keep ? String(spark.keep) : (own.keep || '')).slice(0, storyMax()),
      happened: readAnswer('sh-happened'),
      who: $('sh-who').value.trim(),
      why: readAnswer('sh-why'),
      line: readAnswer('sh-line'),
      words: words(),
      title: titleRaw.slice(0, 80),
      north: window.SongFlowPage ? window.SongFlowPage.north() : null,
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
      followPlace: followExtra.place || '',
      followObject: followExtra.object || '',
      followQuote: followExtra.quote || '',
      stylePrompt: currentStylePrompt(),
      revision: pendingRevision || '',
      previous: pendingPrevious || '',
      company_website: $('sh-honey').value,
    };
  }

  function wordRows() {
    var bank = words();
    return packs.promptsFor(picks.pack || 'generic', 0).map(function (prompt) {
      return { label: prompt.label, text: bank[prompt.key] || '' };
    }).filter(function (row) { return row.text; });
  }

  function answerBag() {
    var snap = window.SongHelperV2 && window.SongHelperV2.snapshot ? window.SongHelperV2.snapshot() : {};
    var spark = sparkSeed();
    return {
      topic: String((snap.topic || (spark && spark.angle) || '')).trim(),
      happened: readAnswer('sh-happened'),
      who: $('sh-who').value.trim(),
      why: readAnswer('sh-why'),
      line: readAnswer('sh-line'),
      mood: moodValue(),
      genre: genreValue(),
      mode: snap.modeLabel || '',
      place: followExtra.place || snap.place || '',
      object: followExtra.object || snap.object || '',
      quote: followExtra.quote || snap.quote || '',
      region: snap.region || '',
      language: picks.language,
      explicit: picks.explicit,
      length: picks.length,
      rhyme: snap.rhyme || '',
      vocabulary: snap.vocabulary || '',
      words: wordRows(),
      live: snap.live || [],
    };
  }

  function editAnswer(id) {
    var steps = { genre: 'genre', happened: 'happened', who: 'who', why: 'why', line: 'line', words: 'words' };
    if (steps[id]) {
      go(STEPS.indexOf(steps[id]), true);
      return;
    }
    var scroll = { mood: 'sh-feeling', idea: 'sh-own', live: 'sh-purpose', filters: 'sh-cast', place: 'sh-purpose', object: 'sh-purpose', quote: 'sh-purpose', mode: 'sh-modes', for: 'sh-purpose', aim: 'sh-purpose', wisdom: 'sh-purpose', never: 'sh-purpose', scared: 'sh-purpose', nobody: 'sh-purpose', open: 'sh-purpose', scene: 'sh-purpose', reveal: 'sh-purpose', keep: 'sh-purpose' };
    var el = document.getElementById(scroll[id] || '');
    if (el && el.scrollIntoView) {
      try { el.scrollIntoView({ block: 'center' }); } catch (err) {}
    }
  }

  function paintCard(host, rows) {
    if (!host || !window.SongPass) return;
    host.textContent = '';
    if (!rows.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    var title = document.createElement('p');
    title.className = 'sh-answers-title';
    title.textContent = 'Your answers';
    host.appendChild(title);
    rows.forEach(function (row) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-answer';
      var label = document.createElement('b');
      label.textContent = row.label;
      var value = document.createElement('span');
      value.textContent = row.value;
      button.appendChild(label);
      button.appendChild(value);
      button.addEventListener('click', function () { editAnswer(row.id); });
      host.appendChild(button);
    });
  }

  function paintAnswers() {
    if (!window.SongPass) return;
    var rows = window.SongFlowPage && window.SongFlowPage.cardRows ? window.SongFlowPage.cardRows() : [];
    paintCard($('sh-answers'), rows.concat(window.SongPass.summary(answerBag())));
  }

  function hideFollow() {
    var host = $('sh-follow');
    if (!host) return;
    host.hidden = true;
    host.textContent = '';
  }

  function showFollow(asks) {
    var host = $('sh-follow');
    if (!host) return;
    followOpen = true;
    host.hidden = false;
    host.textContent = '';
    asks.forEach(function (ask) {
      var label = document.createElement('label');
      label.className = 'sh-field';
      var span = document.createElement('span');
      span.textContent = ask.ask;
      var input = document.createElement('input');
      input.className = 'sh-input';
      input.placeholder = ask.placeholder || '';
      input.setAttribute('data-follow', ask.id);
      label.appendChild(span);
      label.appendChild(input);
      armStory(input);
      host.appendChild(label);
    });
    var use = document.createElement('button');
    use.type = 'button';
    use.className = 'btn btn-purple btn-md';
    use.textContent = 'Use these';
    use.addEventListener('click', function () {
      host.querySelectorAll('[data-follow]').forEach(function (input) {
        followExtra[input.getAttribute('data-follow')] = String(input.value || '').trim();
      });
      followOpen = false;
      followSkipped = true;
      hideFollow();
      go(STEPS.indexOf('draft'), false);
    });
    host.appendChild(use);
    nextBtn.textContent = 'Skip these';
    try { host.scrollIntoView({ block: 'center' }); } catch (err) {}
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
      if (core.isPlaceholderLyric && core.isPlaceholderLyric($('sh-happened').value)) {
        return 'That line is a placeholder. Say what happened in your own words.';
      }
      if (readAnswer('sh-happened').length < 8) return 'Give me one sentence. Even a short one.';
      var happenedJoke = parodyMessage(readAnswer('sh-happened'));
      if (happenedJoke) return happenedJoke;
    }
    if (id === 'who') {
      if (!$('sh-who').value.trim()) return 'A nickname is enough.';
      if (picks.pack === 'comedy' && core.publicFigureName($('sh-who').value)) {
        return 'Roasts stay about people you know. Leave public figures and celebrities out.';
      }
    }
    if (id === 'why') {
      if (core.isPlaceholderLyric && core.isPlaceholderLyric($('sh-why').value)) {
        return 'That line is a placeholder. Say what changed in your own words.';
      }
      if (readAnswer('sh-why').length < 8) return 'One sentence about what they did, or what changed.';
      var whyJoke = parodyMessage(readAnswer('sh-why'));
      if (whyJoke) return whyJoke;
    }
    if (id === 'line') {
      if (core.isPlaceholderLyric && core.isPlaceholderLyric($('sh-line').value)) {
        return 'That line is a placeholder. Write the hook in your own words.';
      }
      var line = readAnswer('sh-line');
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
      var on = !!value && btn.getAttribute('data-value') === value;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  var moreOpen = {};
  var MORE_LIMIT = 4;

  function foldOptions(host) {
    if (!host || !host.children) return;
    var key = host.id || host.getAttribute('aria-label') || '';
    if (!key) return;
    var old = host.querySelector(':scope > button.sh-more');
    if (old) old.parentNode.removeChild(old);
    var chips = [];
    for (var i = 0; i < host.children.length; i++) {
      var el = host.children[i];
      if (!el.classList || el.classList.contains('sh-more')) continue;
      if (el.classList.contains('sh-chip') || el.classList.contains('spark-headline')) chips.push(el);
    }
    if (host.hasAttribute('data-no-fold') || chips.length <= MORE_LIMIT) {
      chips.forEach(function (el) { el.hidden = false; });
      return;
    }
    var open = !!moreOpen[key];
    chips.forEach(function (el, index) {
      if (index >= MORE_LIMIT && el.classList.contains('on')) open = true;
    });
    chips.forEach(function (el, index) {
      var hide = !open && index >= MORE_LIMIT;
      el.hidden = hide;
      var tip = el.nextElementSibling;
      if (tip && tip.classList && tip.classList.contains('sh-tip')) {
        if (hide) {
          tip.setAttribute('data-fold-hidden', tip.hidden ? '1' : '0');
          tip.hidden = true;
        } else if (tip.hasAttribute('data-fold-hidden')) {
          tip.hidden = tip.getAttribute('data-fold-hidden') === '1';
          tip.removeAttribute('data-fold-hidden');
        }
      }
    });
    if (open) {
      moreOpen[key] = true;
      return;
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sh-chip sh-more';
    btn.textContent = 'Show more';
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      moreOpen[key] = true;
      foldOptions(host);
    });
    host.appendChild(btn);
  }

  function foldAllOptionLists() {
    var root = document.getElementById('sh-shell');
    if (!root) return;
    root.querySelectorAll('.sh-chips, .sh-modes, .spark-headlines').forEach(foldOptions);
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
    if (id === 'draft') {
      if (styleOpen) nextBtn.textContent = 'Skip these';
      else if (styleDone) nextBtn.textContent = 'Authorship record';
    }
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
    if (lyricsOpen) {
      backBtn.hidden = true;
      if (dotsEl) dotsEl.hidden = true;
      var writeTitle = document.getElementById('sh-write-title');
      if (writeTitle) writeTitle.hidden = true;
    }
    if (id === 'shape') paintAnswers();
    else {
      followOpen = false;
      hideFollow();
    }
    var focus = document.querySelector('[data-step="' + id + '"] textarea, [data-step="' + id + '"] input.sh-input');
    if (focus && step > 0 && id !== 'draft' && id !== 'style' && id !== 'record' && id !== 'next') {
      try { focus.focus(); } catch (err) {}
    }
  }

  function go(index, skipValidate) {
    if (busy) return;
    if (!skipValidate && index > step) {
      var moodProblem = validate('mood');
      if (moodProblem) {
        showError(moodProblem);
        showMoodError(moodProblem);
        var feeling = document.getElementById('sh-feeling');
        if (feeling && feeling.scrollIntoView) {
          try { feeling.scrollIntoView({ block: 'center' }); } catch (err) {}
        }
        return;
      }
      showMoodError('');
      var problem = validate(STEPS[step]);
      if (problem) {
        showError(problem);
        return;
      }
    }
    step = index;
    showStep();
    if (STEPS[step] === 'draft') loadDraft(false);
    if (STEPS[step] === 'shape') {
      var card = $('sh-answers');
      if (card && card.scrollIntoView) {
        try { card.scrollIntoView({ block: 'start' }); } catch (err) {}
      }
    } else {
      var anchor = document.getElementById('sh-q');
      if (anchor && anchor.scrollIntoView) {
        try { anchor.scrollIntoView({ block: 'start' }); } catch (err2) {}
      }
    }
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
      if (core.isPlaceholderLyric && core.isPlaceholderLyric(hook.text)) return;
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

  function holdsUserWords(line) {
    if (!line) return false;
    if (line.source === 'user') return true;
    return Boolean(core.lineHoldsUserWords && core.lineHoldsUserWords(line.text, interview()));
  }

  function renderDraft() {
    if (!draft) return;
    titleEl.value = draft.title || '';
    renderHooks();
    lyricEl.textContent = '';
    draft.sections.forEach(function (section) {
      var visible = section.lines.filter(function (line) {
        if (core.isGrokCreditLine && core.isGrokCreditLine(line.text)) return false;
        if (core.isPlaceholderLyric && core.isPlaceholderLyric(line.text)) return false;
        return true;
      });
      if (!visible.length) return;
      var label = document.createElement('p');
      label.className = 'sh-section-label';
      label.textContent = section.label;
      lyricEl.appendChild(label);
      visible.forEach(function (line) {
        if (line.original == null) line.original = line.text;
        if (line.logged == null) line.logged = String(line.text || '').trim();
        var box = document.createElement('textarea');
        box.className = 'sh-line' + (holdsUserWords(line) ? ' is-user' : '');
        box.rows = 1;
        box.value = line.text;
        box.setAttribute('aria-label', section.label + ' line');
        box.addEventListener('input', function () {
          line.text = box.value;
          line.edited = box.value.trim() !== String(line.original || '').trim();
          box.classList.toggle('is-user', holdsUserWords(line));
          fit(box);
          renderSuno();
        });
        box.addEventListener('blur', function () {
          var before = String(line.logged || '');
          var after = String(box.value || '').trim();
          line.text = box.value;
          line.edited = after !== String(line.original || '').trim();
          if (before !== after && window.PlaigroundClaim) {
            window.PlaigroundClaim.noteEdit({ section: section.label, before: before, after: after });
          }
          line.logged = after;
        });
        lyricEl.appendChild(box);
        fit(box);
        if (window.SongModes) mountLineTools(lyricEl, box, line);
      });
    });
    banner.hidden = !preview;
    banner.textContent = preview ? core.PREVIEW_NOTICE : '';
    attr.hidden = preview;
    attr.textContent = preview ? '' : (core.PAGE_CREDIT || '');
    renderSuno();
    paintFeedback();
    if (window.SongHelperV2 && window.SongHelperV2.syncStructure) window.SongHelperV2.syncStructure();
  }

  function compactDraft(source) {
    if (!source || !source.sections) return '';
    return source.sections.map(function (section) {
      var lines = (section.lines || []).map(function (row) {
        return String(row && row.text || '').trim();
      }).filter(Boolean);
      if (!lines.length) return '';
      return (section.label || 'Verse') + '\n' + lines.join('\n');
    }).filter(Boolean).join('\n\n').slice(0, 1600);
  }

  function chosenChips() {
    return Object.keys(feedbackOn).filter(function (id) { return feedbackOn[id]; });
  }

  function applyFeedback(chosen) {
    if (!window.SongPass) return;
    var plan = window.SongPass.feedbackPlan({
      chips: chosen || chosenChips(),
      note: chosen ? '' : feedbackNote,
    });
    var hint = $('sh-feedback-hint');
    var box = $('sh-clarify');
    if (plan.empty) {
      if (hint) hint.textContent = 'Tap what should change.';
      return;
    }
    if (!plan.clear) {
      if (hint) hint.textContent = '';
      if (!box) return;
      box.hidden = false;
      box.textContent = '';
      var ask = document.createElement('p');
      ask.className = 'sh-help';
      ask.textContent = plan.ask;
      box.appendChild(ask);
      plan.options.forEach(function (option) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'sh-chip';
        button.textContent = option.label;
        button.addEventListener('click', function () {
          var turningOff = button.classList.contains('on');
          feedbackOn = {};
          feedbackNote = '';
          if (!turningOff) feedbackOn[option.id] = true;
          box.querySelectorAll('.sh-chip').forEach(function (chip) {
            var on = !turningOff && chip === button;
            chip.classList.toggle('on', on);
            chip.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        });
        box.appendChild(button);
      });
      return;
    }
    pendingRevision = plan.instruction;
    pendingPrevious = compactDraft(draft);
    variant += 1;
    loadDraft(true);
  }

  function paintFeedback() {
    var host = $('sh-feedback');
    if (!host || !window.SongPass || !draft) return;
    host.hidden = false;
    host.textContent = '';
    var title = document.createElement('p');
    title.className = 'sh-answers-title';
    title.textContent = 'What should change?';
    host.appendChild(title);
    var chips = document.createElement('div');
    chips.className = 'sh-chips';
    window.SongPass.CHIPS.forEach(function (chip) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip' + (feedbackOn[chip.id] ? ' on' : '');
      button.textContent = chip.label;
      button.setAttribute('aria-pressed', feedbackOn[chip.id] ? 'true' : 'false');
      button.addEventListener('click', function () {
        feedbackOn[chip.id] = !feedbackOn[chip.id];
        paintFeedback();
      });
      chips.appendChild(button);
    });
    host.appendChild(chips);
    var note = document.createElement('textarea');
    note.className = 'sh-area';
    note.maxLength = 240;
    note.placeholder = 'Or say it in a few words';
    note.value = feedbackNote;
    note.addEventListener('input', function () { feedbackNote = note.value; });
    host.appendChild(note);
    var clarify = document.createElement('div');
    clarify.className = 'sh-clarify';
    clarify.id = 'sh-clarify';
    clarify.hidden = true;
    host.appendChild(clarify);
    var apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'btn btn-purple btn-md';
    apply.textContent = 'Apply';
    apply.addEventListener('click', function () { applyFeedback(); });
    host.appendChild(apply);
    var hint = document.createElement('p');
    hint.className = 'sh-help';
    hint.id = 'sh-feedback-hint';
    host.appendChild(hint);
    foldOptions(chips);
  }

  function mountLineTools(parent, box, line) {
    var tools = document.createElement('div');
    tools.className = 'sh-line-tools';
    var ruler = document.createElement('p');
    ruler.className = 'sh-ruler';
    function paint() {
      var measure = window.SongModes.lineRuler(box.value);
      var hits = window.SongModes.clicheHits(box.value);
      var bits = [measure.count + ' syllables', measure.pattern, measure.note];
      if (hits.length && !line.locked) bits.push('Cliché: ' + hits[0]);
      if (line.locked) bits.push('Locked');
      if (line.vote === 1) bits.push('Kept');
      if (line.vote === -1) bits.push('Dropped');
      ruler.textContent = bits.join(' · ');
    }
    function vote(value) {
      line.vote = line.vote === value ? 0 : value;
      paint();
      if (window.SongHelperPage && window.SongHelperPage.remember) window.SongHelperPage.remember();
    }
    var up = document.createElement('button');
    up.type = 'button';
    up.className = 'sh-mini';
    up.textContent = 'Thumbs up';
    up.addEventListener('click', function () { vote(1); });
    var down = document.createElement('button');
    down.type = 'button';
    down.className = 'sh-mini';
    down.textContent = 'Thumbs down';
    down.addEventListener('click', function () { vote(-1); });
    var lock = document.createElement('button');
    lock.type = 'button';
    lock.className = 'sh-mini';
    lock.textContent = line.locked ? 'Unlock line' : 'Lock line';
    lock.addEventListener('click', function () {
      line.locked = !line.locked;
      lock.textContent = line.locked ? 'Unlock line' : 'Lock line';
      paint();
    });
    box.addEventListener('input', paint);
    tools.appendChild(ruler);
    tools.appendChild(up);
    tools.appendChild(down);
    tools.appendChild(lock);
    parent.appendChild(tools);
    paint();
  }

  function renderSuno() {
    var card = $('sh-suno-card');
    var area = $('sh-suno');
    var warn = $('sh-suno-warn');
    if (!card || !area) return;
    if (!draft) {
      card.hidden = true;
      area.value = '';
      if (warn) warn.hidden = true;
      return;
    }
    var text = core.formatSunoLyrics(draft);
    area.value = text;
    card.hidden = !text;
    if (!warn) return;
    var limit = core.SUNO_CHAR_LIMIT || 3000;
    if (text.length > limit) {
      warn.hidden = false;
      warn.textContent = 'This is ' + text.length.toLocaleString('en-US') + ' characters. The lyric box works best under about ' + limit.toLocaleString('en-US') + '.';
    } else {
      warn.hidden = true;
      warn.textContent = '';
    }
  }

  function copyPlain(text, button) {
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
  }

  function setBusy(on, label) {
    busy = on;
    nextBtn.disabled = on;
    $('sh-regen').disabled = on;
    loadingEl.hidden = !on;
    if (on) loadingEl.textContent = label || 'Drafting around your words…';
  }

  async function loadDraft(force) {
    if (force) {
      try {
        var held = readSession();
        if (held && held.source === 'battle') {
          delete held.source;
          delete held.battleDraft;
          delete held.battlePreview;
          sessionStorage.setItem(core.SESSION_KEY, JSON.stringify(held));
        }
      } catch (err) {}
    }
    var key = interviewKey();
    if (!force && draft && draftKey === key) {
      renderDraft();
      return;
    }
    var flowReady = window.SongFlowPage && window.SongFlowPage.ready && window.SongFlowPage.ready();
    var block = (flowReady ? ['mood'] : ['mood', 'genre', 'happened', 'who', 'why', 'line', 'words']).reduce(function (msg, id) {
      return msg || validate(id);
    }, '');
    if (block) {
      draftError.hidden = false;
      draftError.textContent = block;
      var moodProblem = validate('mood');
      if (moodProblem) showMoodError(moodProblem);
      return;
    }
    showMoodError('');
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
      if (!document.getElementById('sh-modes')) {
        (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'song_helper_draft', payload: {} });
      }
      if (window.PlaigroundClaim) window.PlaigroundClaim.noteGeneration(draft);
      if (draft.hooks && draft.hooks[0]) draft.hooks[0].selected = true;
      draftKey = key;
      pendingRevision = '';
      pendingPrevious = '';
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
      input.autocomplete = 'off';
      input.placeholder = prompt.placeholder || '';
      input.value = wordValues[prompt.key] || '';
      label.appendChild(span);
      label.appendChild(input);
      armStory(input);
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

  function readControl(el) {
    if (!el || typeof el.value !== 'string') return '';
    return el.value.trim();
  }

  function styleGenre() {
    var typed = readControl(styleGenreInput);
    if (typed) return typed;
    return genreValue();
  }

  function soundPanelOpen() {
    var box = document.getElementById('sh-sounds-traits');
    return !!(box && !box.hidden);
  }

  function readSoundForm() {
    if (!soundPanelOpen() || !window.SongFlow || !window.SongFlow.scrubSoundTraits) return null;
    var box = document.getElementById('sh-sounds-traits');
    var instrumentsField = readControl(document.getElementById('sh-sounds-instruments'));
    var raw = {
      tempo: readControl(document.getElementById('sh-sounds-tempo')),
      instruments: instrumentsField.split(',').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 3),
      vocal: readControl(document.getElementById('sh-sounds-vocal')),
      era: readControl(document.getElementById('sh-sounds-era')),
      mix: readControl(document.getElementById('sh-sounds-mix')),
      verseLength: (document.getElementById('sh-sounds-verse') || {}).value || 'medium',
      hookPlacement: (document.getElementById('sh-sounds-hook') || {}).value || 'after verse',
      bridge: (document.getElementById('sh-sounds-bridge') || {}).value !== 'no',
      genre: styleGenre(),
    };
    return window.SongFlow.scrubSoundTraits(raw, readControl(document.getElementById('sh-sounds-like')), box.getAttribute('data-via') || 'plain');
  }

  function syncSoundChips(group) {
    if (!soundPanelOpen()) return;
    if (group === 'era') {
      var era = document.getElementById('sh-sounds-era');
      if (era && picks.era) era.value = picks.era;
    }
    if (group === 'energy') {
      var tempo = document.getElementById('sh-sounds-tempo');
      if (tempo && picks.energy) tempo.value = picks.energy;
    }
    if (group === 'texture') {
      var vocal = document.getElementById('sh-sounds-vocal');
      if (vocal && picks.texture) vocal.value = picks.texture;
    }
    if (group === 'instrument') {
      var inst = document.getElementById('sh-sounds-instruments');
      if (inst) inst.value = instruments.join(', ');
    }
  }

  function renderStyle() {
    var sound = readSoundForm();
    var built = core.buildStylePrompt({
      genre: styleGenre(),
      era: sound && sound.era ? sound.era : picks.era,
      energy: sound && sound.tempo ? sound.tempo : picks.energy,
      voice: picks.voice,
      texture: sound && sound.vocal ? sound.vocal : picks.texture,
      instruments: sound && sound.instruments.length ? sound.instruments : instruments,
      feeling: readControl(feelingInput),
      mix: sound ? sound.mix : '',
      structure: sound && window.SongFlow ? window.SongFlow.structurePhrase(sound) : '',
    });
    var prompt = built.prompt || '';
    var query = readControl(document.getElementById('sh-sounds-like'));
    var box = document.getElementById('sh-sounds-traits');
    if (sound && query && window.SongFlow && window.SongFlow.scrubSoundText) {
      var cleaned = window.SongFlow.scrubSoundText(prompt, query, box.getAttribute('data-via') || 'plain');
      if (cleaned !== prompt) built.artistNamesStripped = true;
      prompt = cleaned;
    }
    promptEl.textContent = prompt || 'Add a genre or a feeling and the prompt will show up here.';
    artistNote.hidden = !built.artistNamesStripped;
    promptEl.dataset.prompt = prompt || '';
  }

  function showSoundError(message) {
    var el = document.getElementById('sh-sounds-error');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function fillSoundTraits(traits, notice) {
    if (!traits) return;
    var box = document.getElementById('sh-sounds-traits');
    var tempo = document.getElementById('sh-sounds-tempo');
    var inst = document.getElementById('sh-sounds-instruments');
    var vocal = document.getElementById('sh-sounds-vocal');
    var era = document.getElementById('sh-sounds-era');
    var mix = document.getElementById('sh-sounds-mix');
    var verse = document.getElementById('sh-sounds-verse');
    var hook = document.getElementById('sh-sounds-hook');
    var bridge = document.getElementById('sh-sounds-bridge');
    var note = document.getElementById('sh-sounds-note');
    if (tempo) tempo.value = traits.tempo || '';
    if (inst) inst.value = (traits.instruments || []).join(', ');
    if (vocal) vocal.value = traits.vocal || '';
    if (era) era.value = traits.era || '';
    if (mix) mix.value = traits.mix || '';
    if (verse) verse.value = traits.verseLength || 'medium';
    if (hook) hook.value = traits.hookPlacement || 'after verse';
    if (bridge) bridge.value = traits.bridge === false ? 'no' : 'yes';
    if (box) {
      box.hidden = false;
      box.setAttribute('data-via', traits.via || 'plain');
    }
    if (note) note.textContent = notice || traits.note || 'Influence, not copying.';
    selectStyleGenre(traits.genre || '');
    var eraChips = { '90s': true, '2000s': true, '2010s': true, now: true, timeless: true };
    if (eraChips[traits.era]) {
      picks.era = traits.era;
      setPressed('era', traits.era);
    } else {
      picks.era = '';
      setPressed('era', '');
    }
    var known = {};
    document.querySelectorAll('[data-group="instrument"]').forEach(function (btn) {
      known[btn.getAttribute('data-value')] = true;
    });
    setInstruments((traits.instruments || []).filter(function (item) { return known[item]; }).slice(0, 3));
    styleTouched = true;
    showSoundError('');
    renderStyle();
  }

  function localSoundTraits(query) {
    if (!window.SongFlow || !window.SongFlow.soundsLike) return null;
    return window.SongFlow.soundsLike(query);
  }

  function bindSounds() {
    var go = document.getElementById('sh-sounds-go');
    var layout = document.getElementById('sh-sounds-layout');
    var fields = ['sh-sounds-tempo', 'sh-sounds-instruments', 'sh-sounds-vocal', 'sh-sounds-era', 'sh-sounds-mix', 'sh-sounds-verse', 'sh-sounds-hook', 'sh-sounds-bridge'];
    fields.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () { if (soundPanelOpen()) renderStyle(); });
      el.addEventListener('change', function () { if (soundPanelOpen()) renderStyle(); });
    });
    if (go) {
      go.addEventListener('click', function () {
        var query = readControl(document.getElementById('sh-sounds-like'));
        if (!query) {
          showSoundError('Type an artist or a song.');
          return;
        }
        go.disabled = true;
        fetch('/api/song-helper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sounds', text: query }),
        }).then(function (response) {
          return response.json().then(function (data) { return { ok: response.ok, data: data }; }).catch(function () { return { ok: false, data: null }; });
        }).then(function (result) {
          var traits = result && result.ok && result.data && result.data.traits;
          if (!traits) traits = localSoundTraits(query);
          if (!traits || !traits.tempo) {
            showSoundError('Those traits did not come back. Try a genre or era, like 90s R&B.');
            return;
          }
          fillSoundTraits(traits, (result && result.data && result.data.notice) || traits.note);
        }).catch(function () {
          var traits = localSoundTraits(query);
          if (!traits || !traits.tempo) {
            showSoundError('Those traits did not come back. Try a genre or era, like 90s R&B.');
            return;
          }
          fillSoundTraits(traits, traits.note);
        }).then(function () {
          go.disabled = false;
        });
      });
    }
    if (layout) {
      layout.addEventListener('click', function () {
        var sound = readSoundForm();
        var note = document.getElementById('sh-sounds-note');
        if (!sound || !window.SongHelperV2 || !window.SongHelperV2.applySoundLayout) {
          if (note) note.textContent = 'The layout stays as it is.';
          return;
        }
        var result = window.SongHelperV2.applySoundLayout(sound);
        if (note) note.textContent = (result && result.note) || 'Layout updated. Your words stayed in their boxes.';
      });
    }
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
        lines.push({ text: text.slice(0, storyMax()), yours: line.source === 'user' });
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
      var payload = {
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
      };
      if (prev.source === 'battle' && prev.battleDraft) {
        payload.source = 'battle';
        payload.battleDraft = prev.battleDraft;
        payload.battlePreview = Boolean(prev.battlePreview);
      }
      sessionStorage.setItem(core.SESSION_KEY, JSON.stringify(payload));
    } catch (err) {}
  }

  function renderRecord() {
    if (!draft && lyricsOpen) {
      var written = window.SongHelperV2 && window.SongHelperV2.pageText ? window.SongHelperV2.pageText() : '';
      var cleaned = window.SongFlow && window.SongFlow.cleanPageLyrics
        ? window.SongFlow.cleanPageLyrics(written)
        : written;
      recordEl.textContent = cleaned
        ? ('Lyrics you wrote\n\n' + cleaned)
        : 'Paste lyrics in the writing box first.';
      return;
    }
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
    if (!group || chip.classList.contains('sh-more')) return;
    var value = chip.getAttribute('data-value');
    if (group !== 'instrument' && chip.classList.contains('on')) {
      picks[group] = '';
      setPressed(group, '');
      if (group === 'styleGenre' && styleGenreInput) styleGenreInput.value = '';
      if (group === 'mood') {
        var moodBox = $('sh-mood-custom');
        if (moodBox) moodBox.hidden = true;
        showMoodError('');
      }
      if (group === 'pack') {
        var comedyBox = $('sh-comedy');
        if (comedyBox) comedyBox.hidden = true;
      }
      if (group === 'era' || group === 'energy' || group === 'voice' || group === 'texture' || group === 'styleGenre') {
        styleTouched = true;
        syncSoundChips(group);
        renderStyle();
      }
      showError('');
      return;
    }
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
      syncSoundChips(group);
      renderStyle();
      return;
    }
    if (group === 'styleGenre') {
      styleTouched = true;
      styleGenreInput.value = value;
      setPressed(group, value);
      syncSoundChips(group);
      renderStyle();
      showError('');
      return;
    }
    if (group === 'era' || group === 'energy' || group === 'voice' || group === 'texture' || group === 'pack' || group === 'comedyMusic') {
      if (group === 'era' || group === 'energy' || group === 'voice' || group === 'texture') styleTouched = true;
    }
    picks[group] = value;
    setPressed(group, value);
    if (group === 'mood') {
      $('sh-mood-custom').hidden = value !== 'custom';
      showMoodError('');
    }
    if (group === 'pack') {
      $('sh-comedy').hidden = value !== 'comedy';
      renderWords();
    }
    if (group === 'era' || group === 'energy' || group === 'voice' || group === 'texture') {
      syncSoundChips(group);
      renderStyle();
    }
    showError('');
  });

  ['sh-style-genre', 'sh-style-feel', 'sh-mood-input'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', function () {
      if (id === 'sh-style-genre' || id === 'sh-style-feel') styleTouched = true;
      if (id === 'sh-mood-input') showMoodError('');
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

  function styleStrip(text) {
    if (core.stripArtistNames) return core.stripArtistNames(text);
    return text;
  }

  function collectStyle() {
    var base = packs.styleFor(picks.pack, picks.comedyMusic) || {};
    var snap = window.SongHelperV2 && window.SongHelperV2.snapshot ? window.SongHelperV2.snapshot() : {};
    var energy = picks.energy || base.energy || '';
    return {
      genre: genreValue() || base.genre || '',
      mood: moodValue() || readControl(feelingInput),
      region: snap.region || '',
      energy: energy,
      tempo: '',
      vocal: picks.voice || '',
      texture: picks.texture || '',
      instruments: instruments.length ? instruments.slice() : (base.instruments || []).slice(),
      era: picks.era || base.era || ''
    };
  }

  function showStylePrompt(bag) {
    if (!window.SunoStyle) return;
    styleBag = bag;
    styleOpen = false;
    styleDone = true;
    var host = $('sh-suno-style');
    window.SunoStyle.renderPrompt(host, window.SunoStyle.prompt(styleBag, styleStrip), function (id) {
      styleBag = window.SunoStyle.tweak(styleBag, id);
      if (styleBag.vocal) picks.voice = styleBag.vocal;
      if (styleBag.energy) picks.energy = styleBag.energy;
      if (styleBag.texture) picks.texture = styleBag.texture;
      if (styleBag.instruments) instruments = styleBag.instruments.slice();
      showStylePrompt(styleBag);
    });
    nextBtn.textContent = 'Authorship record';
    try { host.scrollIntoView({ block: 'center' }); } catch (err) {}
  }

  function showStyleAsk(asks) {
    if (!window.SunoStyle) return;
    styleOpen = true;
    window.SunoStyle.renderAsk($('sh-suno-style'), asks, function (chosen) {
      var bag = window.SunoStyle.applyAnswers(collectStyle(), chosen);
      if (chosen.vocal) picks.voice = chosen.vocal;
      if (chosen.genre) styleBag = bag;
      if (bag.energy) picks.energy = bag.energy;
      showStylePrompt(bag);
    });
    nextBtn.textContent = 'Skip these';
    try { $('sh-suno-style').scrollIntoView({ block: 'center' }); } catch (err) {}
  }

  function startStyle() {
    var bag = styleBag || collectStyle();
    var asks = window.SunoStyle ? window.SunoStyle.missing(bag) : [];
    if (asks.length) {
      showStyleAsk(asks);
      return;
    }
    showStylePrompt(bag);
  }

  backBtn.addEventListener('click', function () {
    if (styleOpen && STEPS[step] === 'draft') {
      styleOpen = false;
      var host = $('sh-suno-style');
      if (host) {
        host.hidden = true;
        host.textContent = '';
      }
      nextBtn.textContent = NEXT_LABEL.draft;
      return;
    }
    if (followOpen) {
      followOpen = false;
      hideFollow();
      nextBtn.textContent = NEXT_LABEL.shape || 'Write the draft';
      return;
    }
    if (styleJumped && STEPS[step] === 'record') {
      styleJumped = false;
      go(STEPS.indexOf('draft'), true);
      return;
    }
    if (step > 0) go(step - 1, true);
  });
  nextBtn.addEventListener('click', function () {
    if (STEPS[step] === 'draft') {
      if (styleOpen) {
        styleOpen = false;
        showStylePrompt(styleBag || collectStyle());
        return;
      }
      if (!styleDone) {
        startStyle();
        return;
      }
      styleJumped = true;
      go(STEPS.indexOf('record'), true);
      return;
    }
    if (followOpen) {
      followOpen = false;
      followSkipped = true;
      hideFollow();
      go(STEPS.indexOf('draft'), false);
      return;
    }
    if (STEPS[step] === 'shape' && window.SongPass && !followSkipped) {
      var asks = window.SongPass.followups(answerBag());
      if (asks.length) {
        showFollow(asks);
        return;
      }
    }
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
    copyPlain(text, $('sh-copy'));
    (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'song_helper_style_copied', payload: {} });
  });
  $('sh-suno-copy').addEventListener('click', function () {
    renderSuno();
    var text = ($('sh-suno') && $('sh-suno').value) || '';
    if (!text) {
      showError('Write the draft first.');
      return;
    }
    if (window.SongModes && window.SongModes.sunoPrecheck) {
      var clicheLines = draft ? window.SongModes.allLines(draft).filter(function (row) {
        return window.SongModes.clicheHits(row.text).length;
      }) : [];
      var clichesLocked = clicheLines.length > 0 && clicheLines.every(function (row) { return row.locked; });
      var check = window.SongModes.sunoPrecheck(text, { allowCliches: clichesLocked });
      if (!check.ok) {
        var sunoWarn = $('sh-suno-warn');
        if (sunoWarn) {
          sunoWarn.hidden = false;
          sunoWarn.textContent = check.blocked[0];
        }
        return;
      }
      if (check.warnings.length && !window.confirm(check.warnings[0] + ' Copy anyway?')) return;
    }
    showError('');
    copyPlain(text, $('sh-suno-copy'));
    (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'song_helper_lyrics_copied', payload: {} });
  });
  function claimPairs() {
    var data = interview();
    var answers = [
      { label: 'What happened', value: data.happened },
      { label: 'Who', value: data.who },
      { label: 'Why it mattered', value: data.why },
      { label: 'The line', value: data.line },
      { label: 'Where you were', value: data.followPlace },
      { label: 'Something you can point at', value: data.followObject },
    ];
    wordRows().forEach(function (row) { answers.push({ label: row.label, value: row.text }); });
    var choices = [
      { label: 'Mood', value: data.mood },
      { label: 'Genre', value: data.shape && data.shape.genre },
      { label: 'Language', value: data.shape && data.shape.language },
      { label: 'Clean or explicit', value: data.shape && data.shape.explicit },
      { label: 'Length', value: data.shape && data.shape.length },
    ];
    if (styleBag) {
      choices.push({ label: 'Vocal', value: styleBag.vocal });
      choices.push({ label: 'Tempo', value: styleBag.tempo });
      choices.push({ label: 'Energy', value: styleBag.energy });
    }
    var feedback = chosenChips();
    if (feedback.length) choices.push({ label: 'Feedback', value: feedback.join(', ') });
    return { answers: answers, choices: choices };
  }

  function currentStylePrompt() {
    if (window.SongHelperV2 && window.SongHelperV2.styleText) {
      var live = window.SongHelperV2.styleText();
      if (live) return live;
    }
    return stylePromptValue();
  }

  function stylePromptValue() {
    var boxes = [
      document.querySelector('#sh-style-design .sh-style-preview'),
      document.querySelector('#sh-suno-style .sh-style-box'),
      document.querySelector('#sh-v2-style .sh-style-box'),
    ];
    for (var i = 0; i < boxes.length; i += 1) {
      var text = boxes[i] ? String(boxes[i].value || '').trim() : '';
      if (text) return text;
    }
    return '';
  }

  function showClaimGate(id) {
    var gate = $('sh-claim-gate');
    var next = '/claim?id=' + encodeURIComponent(id);
    var signup = $('sh-claim-signup');
    var login = $('sh-claim-login');
    if (signup) signup.setAttribute('href', 'signup.html?next=' + encodeURIComponent(next));
    if (login) login.setAttribute('href', 'login.html?next=' + encodeURIComponent(next));
    if (gate) gate.hidden = false;
  }

  function claimHumanParts() {
    var error = $('sh-claim-error');
    var gate = $('sh-claim-gate');
    if (gate) gate.hidden = true;
    if (!draft || !draftHasContent(draft)) {
      if (error) {
        error.hidden = false;
        error.textContent = 'Write the draft first, then this record can list your lines.';
      }
      return;
    }
    if (error) error.hidden = true;
    draft.title = titleEl.value.trim() || draft.title;
    var pairs = claimPairs();
    var record = window.PlaigroundClaim.build({
      title: draft.title,
      answers: pairs.answers,
      choices: pairs.choices,
      lines: window.PlaigroundClaim.linesFromDraft(draft),
      stylePrompt: stylePromptValue(),
    });
    var button = $('sh-claim');
    if (button) button.disabled = true;
    window.PlaigroundClaim.submit(record).then(function (result) {
      if (button) button.disabled = false;
      if (result && result.needsAuth) {
        showClaimGate(record.id);
        return;
      }
      if (!result || !result.ok) {
        if (error) {
          error.hidden = false;
          error.textContent = (result && result.error) || 'The account save did not go through. Your record stays on this device.';
        }
        showClaimGate(record.id);
        return;
      }
      (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'claim_created', payload: {} });
      window.location.href = '/claim?id=' + encodeURIComponent(record.id);
    });
  }

  if ($('sh-claim')) $('sh-claim').addEventListener('click', claimHumanParts);
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

  function battleSavedDraft() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('from') !== 'battle') return null;
    } catch (err) {
      return null;
    }
    var saved = readSession();
    if (!saved || saved.source !== 'battle' || !saved.battleDraft || !saved.battleDraft.sections || !saved.battleDraft.sections.length) return null;
    return saved;
  }

  function openBattleDraft(saved) {
    picks.mood = 'custom';
    if ($('sh-mood-custom')) $('sh-mood-custom').hidden = false;
    if ($('sh-mood-input')) $('sh-mood-input').value = String(saved.mood || '').slice(0, 40);
    if ($('sh-happened')) $('sh-happened').value = String(saved.happened || '').slice(0, storyMax());
    if ($('sh-who')) $('sh-who').value = String(saved.who || '').slice(0, storyMax());
    if ($('sh-why')) $('sh-why').value = String(saved.why || '').slice(0, storyMax());
    if ($('sh-line')) $('sh-line').value = String(saved.line || '').slice(0, storyMax());
    paintStory($('sh-happened'));
    paintStory($('sh-why'));
    paintStory($('sh-line'));
    if (saved.pack) {
      picks.pack = saved.pack;
      setPressed('pack', saved.pack);
      if ($('sh-comedy')) $('sh-comedy').hidden = saved.pack !== 'comedy';
    }
    if (saved.artistName && $('sh-artist') && !$('sh-artist').value.trim()) $('sh-artist').value = saved.artistName;
    wordValues.cameup = String(saved.happened || saved.title || 'the battle').slice(0, storyMax());
    draft = saved.battleDraft;
    preview = Boolean(saved.battlePreview);
    if (draft.hooks && draft.hooks[0]) draft.hooks[0].selected = true;
    draftKey = interviewKey();
    step = STEPS.indexOf('draft');
    showStep();
    renderDraft();
  }

  function draftHasContent(value) {
    if (!value || !value.sections) return false;
    return value.sections.some(function (section) {
      return (section.lines || []).some(function (line) {
        var text = String(line && line.text || '').trim();
        if (!text) return false;
        if (core.isPlaceholderLyric && core.isPlaceholderLyric(text)) return false;
        if (core.isGrokCreditLine && core.isGrokCreditLine(text)) return false;
        return true;
      });
    });
  }

  function appendSection(part) {
    if (!draftHasContent(draft) || !part || !part.lines) return false;
    var lines = part.lines.filter(function (row) {
      var text = String(row && row.text || '').trim();
      if (!text) return false;
      if (core.isPlaceholderLyric && core.isPlaceholderLyric(text)) return false;
      return true;
    });
    if (!lines.length) return false;
    draft.sections.push({
      label: part.label || 'Verse',
      lines: lines.map(function (row) {
        var text = String(row.text).trim();
        return {
          text: text,
          source: 'user',
          role: /hook/i.test(part.label || '') ? 'hook' : '',
          locked: false,
          vote: 0,
          original: text,
          edited: false,
        };
      }),
    });
    var draftStep = STEPS.indexOf('draft');
    if (draftStep >= 0 && step !== draftStep) {
      step = draftStep;
      showStep();
    }
    renderDraft();
    return true;
  }

  function rememberDraft() {
    if (!window.SongModes || !draft) return;
    var lines = window.SongModes.allLines(draft);
    var entry = {
      at: new Date().toISOString(),
      mode: 'write',
      title: (titleEl && titleEl.value) || draft.title || '',
      yours: window.SongModes.yoursPercent(lines),
      votes: lines.map(function (row) { return { text: row.text, vote: row.vote || 0, locked: !!row.locked }; }),
    };
    try {
      var key = 'plaiground.songHelper.log';
      var log = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(log)) log = [];
      log.unshift(entry);
      localStorage.setItem(key, JSON.stringify(log.slice(0, 30)));
    } catch (err) {}
    if (window.SongHelperV2 && window.SongHelperV2.paintLog) window.SongHelperV2.paintLog();
  }

  window.SongHelperPage = {
    appendSection: appendSection,
    remember: rememberDraft,
    refreshAnswers: paintAnswers,
    draft: function () { return draft; },
    hasDraft: function () { return draftHasContent(draft); },
    setMood: function (value) {
      picks.mood = value || '';
      setPressed('mood', picks.mood);
      if ($('sh-mood-custom')) $('sh-mood-custom').hidden = picks.mood !== 'custom';
      showMoodError('');
    },
    mood: function () { return picks.mood; },
    setPack: function (id) {
      picks.pack = id || '';
      picks.comedyType = '';
      picks.comedyMusic = '';
    },
    setShapeBits: function (bits) {
      var next = bits || {};
      if (next.language) picks.language = next.language;
      if (next.explicit) picks.explicit = next.explicit;
      if (next.genre2) picks.genre2 = next.genre2;
      else picks.genre2 = '';
    },
    openDraft: function () {
      go(STEPS.indexOf('draft'), true);
    },
    lyricsOpen: function () { return lyricsOpen; },
    openFinishedLyrics: function () {
      lyricsOpen = true;
      var write = document.getElementById('sh-write');
      if (write) write.hidden = false;
      go(STEPS.indexOf('style'), true);
      if (window.SongHelperV2 && window.SongHelperV2.repaint) window.SongHelperV2.repaint();
    },
  };

  var feeling = document.getElementById('sh-feeling');
  if (feeling) {
    feeling.addEventListener('click', function (event) {
      var chip = event.target.closest ? event.target.closest('.sh-chip') : null;
      if (!chip || chip.classList.contains('sh-more') || chip.getAttribute('data-group') !== 'mood') return;
      if (chip.classList.contains('on')) {
        picks.mood = '';
        setPressed('mood', '');
        if ($('sh-mood-custom')) $('sh-mood-custom').hidden = true;
        showMoodError('');
        showError('');
        return;
      }
      picks.mood = chip.getAttribute('data-value');
      setPressed('mood', picks.mood);
      if ($('sh-mood-custom')) $('sh-mood-custom').hidden = picks.mood !== 'custom';
      showMoodError('');
      showError('');
    });
  }

  if (!document.getElementById('sh-modes') && !window.__plaiHelperSession) {
    window.__plaiHelperSession = 1;
    (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'song_helper_started', payload: {} });
  }

  bindSounds();
  var battleSaved = battleSavedDraft();
  if (battleSaved) openBattleDraft(battleSaved);
  else {
    restoreWizard();
    showStep();
  }
  foldAllOptionLists();
  window.SongHelperChips = { fold: foldOptions, foldAll: foldAllOptionLists };
}());
