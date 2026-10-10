(function () {
  var modes = window.SongModes;
  var slangCore = window.SlangCore;
  if (!modes || !document.getElementById('sh-modes')) return;

  function storyMax() {
    return (window.SongFlow && window.SongFlow.STORY_MAX) || (modes.STORY_MAX || 3000);
  }

  function armStory(el) {
    if (window.SongFlow && window.SongFlow.mountStoryBox) window.SongFlow.mountStoryBox(el);
  }

  function paintStory(el) {
    if (window.SongFlow && window.SongFlow.paintStoryBox) window.SongFlow.paintStoryBox(el);
  }

  function preparedInput(body) {
    try {
      return modes.normalizeInput(body);
    } catch (err) {
      return { __long: !!(err && err.code === 'long'), __bad: true, error: err && err.message };
    }
  }

  if (!window.__plaiHelperSession) {
    window.__plaiHelperSession = 1;
    (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'song_helper_started', payload: {} });
  }

  var styleDesign = null;
  var designOpen = false;
  var designNote = '';
  var designUndo = null;
  var craft = {
    vocabulary: 'plain',
    imagery: 'concrete',
    rhyme: 'slant',
    eraSlang: 'now',
    wordplay: 'light',
    rabbit: true,
    region: '',
  };
  var mode = '';
  var making = '';
  var amount = '';
  var tone = '';
  var theme = '';
  var rapStyle = '';
  var kind = '';
  var kinds = [];
  var part = 'song';
  var questions = window.SongQuestions;
  var live = null;
  var regionTags = [];
  var addingPart = false;
  var slangRows = [];
  var showProfanity = false;
  var chosenSlang = '';
  var openTip = '';
  var goLabel = 'Make the draft';
  var lyricsReady = false;
  var styleShown = false;
  var v2StyleOpen = false;
  var v2StyleBag = null;
  var followOpen = false;
  var followSkipped = false;
  var followExtra = { place: '', object: '', quote: '' };
  var pendingRevision = '';
  var pendingPrevious = '';
  var feedbackOn = {};
  var feedbackNote = '';
  var lastDraft = null;
  var lastMeta = { preview: true, notice: '' };
  var parodyAck = false;
  var sparkPack = null;
  var sparkGroup = 'trending';
  var sparkNews = '';
  var sparkTopic = '';
  var sparkTopics = [];
  var sparkHeadline = '';
  var sparkDailyOpen = false;
  var sparkAsk = { feel: '', story: '', keep: '' };
  var sparkSeed = null;
  var seededAngle = '';
  var ideaLane = '';
  var branch = '';
  var storyBox = false;
  var pageSections = [];
  var formatState = null;
  var KIND_MOOD = {
    love: 'in love',
    heartbreak: 'heartbroken',
    hype: 'hyped',
    petty: 'petty',
    grateful: 'grateful',
    nostalgic: 'nostalgic',
    angry: 'angry',
    mindset: 'mindset'
  };
  var GENRE_LABELS = {
    hiphop: 'Hip-hop',
    rnb: 'R&B',
    country: 'Country',
    pop: 'Pop',
    latin: 'Latin',
    rock: 'Rock',
    gospel: 'Gospel',
    lofi: 'Lo-fi',
    afrobeats: 'Afrobeats',
    indie: 'Indie'
  };
  var sectionKind = '';
  var SPARK_GROUPS = (window.SparkCore && window.SparkCore.GROUPS) || [
    { id: 'trending', label: 'Trending', lanes: ['trending'] },
    { id: 'news', label: 'News', lanes: ['news-world', 'news-music', 'news-movies', 'news-regional'] },
    { id: 'causes', label: 'Causes', lanes: ['causes'] },
    { id: 'mindset', label: 'Mindset', lanes: ['mindset'] },
  ];
  var undoStack = [];
  var pageStatus = { demo: true, disabled: false, turnstile: false };
  var turnstileToken = '';
  var LOG_KEY = 'plaiground.songHelper.log';

  function $(id) { return document.getElementById(id); }

  function fieldValue(id) {
    var el = document.querySelector('#sh-v2-fields [data-field="' + id + '"]');
    if (!el) return '';
    var value = String(el.value || '').trim();
    var hint = String(el.getAttribute('placeholder') || '').trim();
    if (hint && value.toLowerCase() === hint.toLowerCase()) return '';
    return value;
  }

  function readMood() {
    if (window.SongHelperPage && window.SongHelperPage.mood) {
      var fromPage = window.SongHelperPage.mood();
      if (fromPage) return String(fromPage).slice(0, 40);
    }
    var pressed = document.querySelector('#sh-feeling .sh-chip.on[data-group="mood"]');
    if (!pressed) return '';
    var value = pressed.getAttribute('data-value') || '';
    if (value === 'custom') {
      var input = $('sh-mood-input');
      return input ? String(input.value || '').trim().slice(0, 40) : '';
    }
    return String(value).slice(0, 40);
  }

  function ownIdea() {
    rememberAsk();
    var ideaEl = $('sh-own-idea');
    return {
      idea: askValue(ideaEl).slice(0, storyMax()),
      feel: String(sparkAsk.feel || '').slice(0, storyMax()),
      story: String(sparkAsk.story || '').slice(0, storyMax()),
      keep: String(sparkAsk.keep || '').slice(0, storyMax()),
    };
  }

  function payload() {
    var own = ownIdea();
    var star = window.SongFlowPage && window.SongFlowPage.north ? window.SongFlowPage.north() : null;
    var sense = star && star.sensory ? star.sensory : {};
    var titleRaw = (($('sh-working-title') && $('sh-working-title').value) || fieldValue('title') || '').trim();
    var idea = own.idea || '';
    if (titleRaw.length > 80 && idea.indexOf(titleRaw) === -1) {
      var joined = idea ? (idea + ' ' + titleRaw) : titleRaw;
      if (joined.length <= storyMax()) idea = joined;
    }
    return {
      mode: mode,
      kind: kind,
      part: part,
      live: liveAnswers(),
      mood: readMood(),
      idea: idea.slice(0, storyMax()),
      sparkTitle: sparkSeed && sparkSeed.title ? String(sparkSeed.title).slice(0, 80) : '',
      sparkAngle: (sparkSeed && sparkSeed.angle ? String(sparkSeed.angle) : idea).slice(0, storyMax()),
      sparkFeel: (sparkSeed && sparkSeed.feel ? String(sparkSeed.feel) : own.feel).slice(0, storyMax()),
      sparkStory: (sparkSeed && sparkSeed.story ? String(sparkSeed.story) : own.story).slice(0, storyMax()),
      sparkKeep: (sparkSeed && sparkSeed.keep ? String(sparkSeed.keep) : own.keep).slice(0, storyMax()),
      place: fieldValue('place') || followExtra.place || sense.place || '',
      object: fieldValue('object') || followExtra.object || sense.object || '',
      quote: fieldValue('quote') || followExtra.quote || sense.quote || '',
      followQuote: fieldValue('quote') || followExtra.quote || sense.quote || '',
      stylePrompt: currentStyleText(),
      genre: fieldValue('genre'),
      title: titleRaw.slice(0, 80),
      north: window.SongFlowPage ? window.SongFlowPage.north() : null,
      originalTitle: fieldValue('originalTitle'),
      comment: fieldValue('comment'),
      name: fieldValue('name'),
      lines: fieldValue('lines') || pastedOrDraft(),
      year: fieldValue('year'),
      kind: fieldValue('kind') || 'composition',
      work: fieldValue('work'),
      meter: fieldValue('meter') || 'clean',
      barStyle: fieldValue('barStyle') || 'east',
      era: fieldValue('era') || 'now',
      bars: fieldValue('bars') || '8',
      rhymeMeter: fieldValue('rhymeMeter') || '3',
      wordplayMeter: fieldValue('wordplayMeter') || '3',
      varietyMeter: fieldValue('varietyMeter') || '3',
      delivery: fieldValue('delivery'),
      region: craft.region,
      slang: chosenSlang,
      form: fieldValue('form') || 'free',
      spirit: fieldValue('spirit'),
      artNote: fieldValue('artNote'),
      verb: fieldValue('verb'),
      line: fieldValue('line'),
      happened: fieldValue('happened'),
      why: fieldValue('why'),
      making: making,
      amount: amount,
      tone: tone,
      theme: theme,
      method: mode,
      rapStyle: rapStyle,
      parodyAck: parodyAck,
      craft: {
        vocabulary: craft.vocabulary,
        imagery: craft.imagery,
        rhyme: craft.rhyme,
        eraSlang: craft.eraSlang,
        region: craft.region,
        wordplay: craft.wordplay,
        rabbit: craft.rabbit,
      },
      turnstile_token: turnstileToken,
      company_website: ($('sh-honey') && $('sh-honey').value) || '',
      revision: pendingRevision || '',
      previous: pendingPrevious || '',
    };
  }

  function snapshot() {
    var info = modes.modeById(mode) || {};
    var regionBtn = document.querySelector('#sh-region .sh-chip.on');
    return {
      mode: mode,
      modeLabel: info.label || '',
      making: making,
      amount: amount,
      tone: tone,
      theme: theme,
      rapStyle: rapStyle,
      topic: ideaTopic(),
      place: fieldValue('place') || followExtra.place || '',
      object: fieldValue('object') || followExtra.object || '',
      quote: fieldValue('quote') || followExtra.quote || '',
      region: regionBtn && craft.region ? regionBtn.textContent : '',
      rhyme: craft.rhyme,
      vocabulary: craft.vocabulary,
      live: liveAnswers(),
    };
  }

  function v2Bag() {
    var snap = snapshot();
    return {
      topic: snap.topic,
      happened: fieldValue('happened') || snap.topic,
      who: fieldValue('name'),
      why: fieldValue('why'),
      line: fieldValue('line'),
      mood: readMood(),
      genre: fieldValue('genre'),
      mode: snap.modeLabel,
      place: snap.place,
      object: snap.object,
      quote: snap.quote,
      region: snap.region,
      rhyme: snap.rhyme,
      vocabulary: snap.vocabulary,
      live: snap.live,
    };
  }

  function paintV2Answers() {
    var host = $('sh-v2-answers');
    if (!host || !window.SongPass || mainPath(mode)) return;
    host.textContent = '';
    var rows = window.SongPass.summary(v2Bag());
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
      button.addEventListener('click', function () {
        var field = document.querySelector('#sh-v2-fields [data-field="' + row.id + '"]');
        var target = field || document.getElementById(row.id === 'idea' ? 'sh-own-idea' : (row.id === 'mood' ? 'sh-feeling' : 'sh-region'));
        if (target && target.focus) {
          try { target.focus(); } catch (err) {}
        }
        if (target && target.scrollIntoView) {
          try { target.scrollIntoView({ block: 'center' }); } catch (err2) {}
        }
      });
      host.appendChild(button);
    });
  }

  function hideV2Follow() {
    var host = $('sh-v2-follow');
    if (!host) return;
    host.hidden = true;
    host.textContent = '';
  }

  function showV2Follow(asks) {
    var host = $('sh-v2-follow');
    var go = $('sh-v2-go');
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
        var key = input.getAttribute('data-follow');
        var text = String(input.value || '').trim();
        followExtra[key] = text;
        var field = document.querySelector('#sh-v2-fields [data-field="' + key + '"]');
        if (field && text) field.value = text;
      });
      followOpen = false;
      followSkipped = true;
      hideV2Follow();
      if (go) go.textContent = goLabel;
      paintV2Answers();
      generate();
    });
    host.appendChild(use);
    if (go) go.textContent = 'Skip these';
    try { host.scrollIntoView({ block: 'center' }); } catch (err) {}
  }

  function modeLane(item) {
    if (!item) return '';
    if (item.lane) return item.lane;
    if (item.id === 'flip' || item.id === 'funkify' || item.id === 'review') return 'remix';
    if (item.id === 'parody' || item.id === 'cover' || item.id === 'public-domain') return 'source';
    if (item.id === 'hook' || item.id === 'bars') return 'part';
    if (item.id === 'write' || item.id === 'funny' || item.id === 'madlibs' || item.id === 'superhero' || item.id === 'poem' || item.id === 'battle') return 'create';
    return '';
  }

  function paintModeRow(host, lane) {
    if (!host) return;
    host.textContent = '';
    modes.MODES.forEach(function (item) {
      var itemLane = modeLane(item);
      var show = itemLane === lane || (lane === 'remix' && item.id === 'superhero');
      if (lane === 'create' && itemLane !== 'create') show = false;
      if (!show) return;
      if (lane === 'remix') return;
      var card = document.createElement('div');
      card.className = 'sh-mode-card';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip' + (mode && item.id === mode ? ' on' : '');
      button.textContent = item.label;
      button.setAttribute('aria-pressed', mode && item.id === mode ? 'true' : 'false');
      var about = document.createElement('p');
      about.className = 'sh-mode-line';
      about.textContent = item.blurb || '';
      button.addEventListener('click', function () {
        if (item.id === 'battle') {
          setMode(item.id);
          return;
        }
        if (item.id === mode) {
          mode = '';
          var shell = document.getElementById('sh-shell');
          if (shell) shell.classList.remove('is-v2');
          var panel = $('sh-v2');
          if (panel) panel.hidden = true;
          paintModes();
          paintBranch();
          return;
        }
        setMode(item.id);
      });
      card.appendChild(button);
      card.appendChild(about);
      host.appendChild(card);
    });
  }

  function mainPath(id) {
    return !id || id === 'write' || id === 'assist';
  }

  function paintDraftButton() {
    var btn = $('sh-cast-draft');
    if (!btn) return;
    if (mode === 'write') btn.textContent = 'Songify it for me';
    else if (mode === 'assist') btn.textContent = 'Write it for me';
    else if (mode === 'exchange') btn.textContent = 'Answer the next verse';
    else if (mode === 'madlibs') btn.textContent = 'Make the draft';
    else btn.textContent = 'Write the draft';
  }

  function choiceCard(item, on, onPick) {
    var card = document.createElement('div');
    card.className = 'sh-mode-card';
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'sh-chip' + (on ? ' on' : '');
    button.textContent = item.label;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    var about = document.createElement('p');
    about.className = 'sh-mode-line';
    about.textContent = item.blurb || '';
    button.addEventListener('click', function () { onPick(item); });
    card.appendChild(button);
    card.appendChild(about);
    return card;
  }

  function paintChoiceRow(host, rows, current, onPick) {
    if (!host) return;
    host.textContent = '';
    (rows || []).forEach(function (item) {
      host.appendChild(choiceCard(item, current === item.id, onPick));
    });
    if (window.SongHelperChips) window.SongHelperChips.fold(host);
  }

  function amountRows() {
    return making === 'poem' ? modes.POEM_AMOUNT : modes.AMOUNT;
  }

  function paintSetup() {
    paintChoiceRow($('sh-making'), modes.MAKING, making, function (item) {
      making = making === item.id ? '' : item.id;
      if (making !== 'poem' && (amount === 'short' || amount === 'long')) amount = '';
      if (making === 'poem' && amount && amount !== 'short' && amount !== 'long') amount = '';
      if (making !== 'rap') rapStyle = '';
      syncPartFromAmount();
      resetLive();
      paintSetup();
      paintFields();
      paintBranch();
    });
    var help = $('sh-amount-help');
    if (help) {
      help.textContent = making === 'poem'
        ? 'Short or long. A poem does not use a hook and a verse.'
        : 'Hook, one verse, verse and hook, or the whole song.';
    }
    paintChoiceRow($('sh-amount'), amountRows(), amount, function (item) {
      amount = amount === item.id ? '' : item.id;
      syncPartFromAmount();
      resetLive();
      paintSetup();
      paintBranch();
    });
    paintChoiceRow($('sh-modes'), modes.WRITE_WAYS, mode, function (item) {
      if (mode === item.id) {
        mode = '';
        paintSetup();
        paintModes();
        paintBranch();
        return;
      }
      setMode(item.id);
    });
    paintChoiceRow($('sh-tones'), modes.TONES, tone, function (item) {
      tone = tone === item.id ? '' : item.id;
      resetLive();
      paintSetup();
      paintFields();
      paintBranch();
    });
    paintChoiceRow($('sh-themes'), modes.THEMES, theme, function (item) {
      theme = theme === item.id ? '' : item.id;
      resetLive();
      paintSetup();
      paintFields();
      paintBranch();
    });
    paintChoiceRow($('sh-rap'), modes.RAP_STYLES, rapStyle, function (item) {
      if (item.id === 'battle') {
        setMode('battle');
        return;
      }
      rapStyle = rapStyle === item.id ? '' : item.id;
      paintSetup();
      paintBranch();
    });
  }

  function syncPartFromAmount() {
    if (amount === 'hook') part = 'hook';
    else if (amount === 'verse') part = 'verse';
    else if (amount === 'song' || amount === 'verse-hook' || amount === 'short' || amount === 'long') part = 'song';
  }

  function paintModes() {
    paintSetup();
    paintModeRow($('sh-source-modes'), 'source');
    paintKinds();
    paintParts();
    paintLive();
    if (window.SongHelperChips) window.SongHelperChips.foldAll();
  }

  function setMode(id) {
    if (id === 'battle') {
      var battleUrl = '/battle';
      if (craft.region || chosenSlang) {
        battleUrl += '?region=' + encodeURIComponent(craft.region || '') + '&slang=' + encodeURIComponent(chosenSlang || '');
      }
      window.location.href = battleUrl;
      return;
    }
    mode = id;
    parodyAck = false;
    undoStack = [];
    if (id !== 'superhero' && id !== 'flip' && id !== 'funkify') lastDraft = null;
    var info = modes.modeById(id);
    var shell = document.getElementById('sh-shell');
    if (shell) shell.classList.toggle('is-v2', !mainPath(id));
    var panel = $('sh-v2');
    panel.hidden = mainPath(id);
    $('sh-v2-blurb').textContent = info.blurb;
    $('sh-v2-out').textContent = '';
    $('sh-v2-extra').textContent = '';
    $('sh-v2-error').hidden = true;
    if (live && live.mode !== id) resetLive();
    paintModes();
    paintFields();
    paintSlang();
    goLabel = id === 'parody' ? 'Check the parody' : (id === 'cover' ? 'Show the steps' : (id === 'hook' ? 'Write the hook' : (id === 'flip' ? 'Flip the draft' : (id === 'funkify' ? 'Funkify the draft' : (id === 'exchange' ? 'Answer the next verse' : (id === 'assist' ? 'Write it for me' : 'Make the draft'))))));
    lyricsReady = false;
    styleShown = false;
    v2StyleOpen = false;
    v2StyleBag = null;
    var styleHost = $('sh-v2-style');
    if (styleHost) {
      styleHost.hidden = true;
      styleHost.textContent = '';
    }
    followOpen = false;
    hideV2Follow();
    paintV2Answers();
    seedFields();
    syncStructure();
    paintGo();
    paintSourceNotes();
    paintBranch();
  }

  function paintGo() {
    var go = $('sh-v2-go');
    if (!go) return;
    if (pageStatus.disabled || styleShown) {
      go.hidden = true;
      return;
    }
    go.hidden = false;
    if (v2StyleOpen) go.textContent = 'Skip these';
    else if (lyricsReady) go.textContent = 'Make my style prompt';
    else go.textContent = goLabel;
  }

  function addField(host, spec) {
    var label = document.createElement('label');
    label.className = 'sh-field';
    var span = document.createElement('span');
    span.textContent = spec.label;
    label.appendChild(span);
    var el;
    if (spec.kind === 'area') {
      el = document.createElement('textarea');
      el.className = 'sh-area';
      el.rows = spec.rows || 4;
    } else if (spec.kind === 'select') {
      el = document.createElement('select');
      el.className = 'sh-input';
      (spec.options || []).forEach(function (opt) {
        var option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        if (opt.id === spec.value) option.selected = true;
        el.appendChild(option);
      });
    } else {
      el = document.createElement('input');
      el.className = 'sh-input';
      el.type = spec.kind || 'text';
      if (spec.min) el.min = spec.min;
      if (spec.max) el.max = spec.max;
    }
    el.setAttribute('data-field', spec.id);
    if (spec.placeholder) el.placeholder = spec.placeholder;
    if (spec.value && spec.kind !== 'select') el.value = spec.value;
    label.appendChild(el);
    if (spec.story) {
      armStory(el);
      el.addEventListener('input', function () { paintV2Answers(); });
    }
    host.appendChild(label);
  }

  function paintFields() {
    var host = $('sh-v2-fields');
    host.textContent = '';
    var sourceMode = mode === 'parody' || mode === 'cover' || mode === 'public-domain';
    if (mode === 'parody' || mode === 'cover') {
      addField(host, {
        id: 'originalTitle',
        label: mode === 'cover' ? 'Song you want to cover' : 'Original title',
        placeholder: 'The real song title'
      });
    }
    if (mode === 'parody') {
      addField(host, { id: 'title', label: 'Your title (not a look-alike)' });
      addField(host, { id: 'comment', label: 'What are you saying about the original?', kind: 'area', story: true });
      addField(host, { id: 'artNote', label: 'Cover idea, if you have one', placeholder: 'A different picture. Not their art.' });
    }
    if (mode === 'public-domain') {
      addField(host, {
        id: 'work',
        label: 'Source title',
        kind: 'select',
        options: [{ id: '', label: 'Pick a source, or type one below' }].concat(modes.PD_WORKS.map(function (work) {
          return { id: work.title, label: work.title + ' (' + work.year + ')' };
        })),
      });
      addField(host, { id: 'title', label: 'Or type a source title' });
      addField(host, { id: 'year', label: 'Year' });
      addField(host, {
        id: 'kind',
        label: 'Composition or recording',
        kind: 'select',
        value: 'composition',
        options: [
          { id: 'composition', label: 'Composition (1930 and earlier)' },
          { id: 'recording', label: 'Recording (through 1925)' },
        ],
      });
    }
    var rabbit = !sourceMode && craft.rabbit && mode !== 'review' && mode !== 'hook' && mode !== 'madlibs';
    if (rabbit) {
      addField(host, { id: 'place', label: 'A real place', placeholder: 'the kitchen at 2am', story: true });
      addField(host, { id: 'object', label: 'An object you can touch', placeholder: 'a chipped mug', story: true });
      addField(host, { id: 'quote', label: 'Something someone said', placeholder: 'we will figure it out', story: true });
    }
    if (mode === 'hook') {
      addField(host, { id: 'line', label: 'The hook sentence', kind: 'area', placeholder: 'A full sentence you would actually sing.', story: true });
      addField(host, { id: 'happened', label: 'What happened', kind: 'area', placeholder: 'One concrete sentence about what happened.', story: true });
      addField(host, { id: 'why', label: 'Why it matters', kind: 'area', placeholder: 'One sentence about what changed.', story: true });
    }
    if (mode === 'flip') addField(host, { id: 'genre', label: 'Flip it toward', placeholder: 'country' });
    if (mode === 'flip' || mode === 'funkify') {
      addField(host, {
        id: 'lines',
        label: 'Lyrics you already have, if you want to transform them',
        kind: 'area',
        placeholder: 'Paste a verse to reshape it. Leave this blank to draft from your answers.',
      });
    }
    if (mode === 'funny' || tone === 'funny') {
      addField(host, {
        id: 'meter',
        label: 'Comedy meter',
        kind: 'select',
        value: 'clean',
        options: modes.FUNNY_METERS,
      });
    }
    if (mode === 'madlibs') addField(host, { id: 'verb', label: 'A verb', placeholder: 'wait' });
    if (mode === 'review') addField(host, { id: 'lines', label: 'Your lines', kind: 'area', placeholder: 'One line per row' });
    if (mode === 'homage' || mode === 'superhero' || theme === 'superhero') addField(host, { id: 'name', label: (mode === 'superhero' || theme === 'superhero') ? 'Your name, as the hero' : 'Who the tribute is for' });
    if (mode === 'bars' || making === 'rap') {
      addField(host, { id: 'barStyle', label: 'Style', kind: 'select', value: 'east', options: modes.BAR_STYLES });
      addField(host, {
        id: 'era',
        label: 'Era',
        kind: 'select',
        value: 'now',
        options: [
          { id: '80s', label: '80s' },
          { id: '90s', label: '90s' },
          { id: '2000s', label: '2000s' },
          { id: '2010s', label: '2010s' },
          { id: 'now', label: 'Now' },
        ],
      });
      addField(host, {
        id: 'bars',
        label: 'Length',
        kind: 'select',
        value: '8',
        options: [
          { id: '4', label: '4 bars' },
          { id: '8', label: '8 bars' },
          { id: '16', label: '16 bars' },
          { id: 'hook', label: 'A hook' },
        ],
      });
      addField(host, { id: 'rhymeMeter', label: 'Rhyme meter (1–5)', kind: 'number', min: '1', max: '5', value: '3' });
      addField(host, { id: 'wordplayMeter', label: 'Wordplay meter (1–5)', kind: 'number', min: '1', max: '5', value: '3' });
      addField(host, { id: 'varietyMeter', label: 'Variety meter (1–5)', kind: 'number', min: '1', max: '5', value: '3' });
      addField(host, { id: 'delivery', label: 'Delivery note', placeholder: 'behind the beat, spoken' });
    }
    if (mode === 'poem' || making === 'poem') {
      addField(host, { id: 'form', label: 'Form', kind: 'select', value: 'free', options: modes.POEM_FORMS });
      addField(host, { id: 'spirit', label: 'In the spirit of', kind: 'select', value: '', options: modes.POET_SPIRITS });
    }
    if (mode === 'public-domain') {
      var picker = host.querySelector('[data-field="work"]');
      if (picker) picker.addEventListener('change', function () {
        var found = modes.PD_WORKS.filter(function (work) { return work.title === picker.value; })[0];
        if (!found) return;
        var year = host.querySelector('[data-field="year"]');
        var title = host.querySelector('[data-field="title"]');
        if (year) year.value = String(found.year);
        if (title && !title.value) title.value = found.title;
      });
    }
    seedFields();
  }

  function paintSlang() {
    var host = $('sh-slang');
    if (!host) return;
    host.textContent = '';
    if (!slangCore) return;
    var rows = slangCore.suggest(slangRows, craft.region, { profanity: showProfanity });
    if (!craft.region) {
      var note = document.createElement('p');
      note.className = 'sh-help';
      note.textContent = 'Region is optional. Pick one if you want slang and everyday terms from that place.';
      host.appendChild(note);
      return;
    }
    if (!rows.length) {
      var empty = document.createElement('p');
      empty.className = 'sh-help';
      empty.textContent = 'No words in the list for that region' + (showProfanity ? '' : ' (profanity is hidden)') + '.';
      host.appendChild(empty);
      return;
    }
    rows.forEach(function (row) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip sh-slang-chip' + (chosenSlang === row.word ? ' on' : '');
      button.textContent = row.word + (row.profanity ? ' · profanity' : '');
      button.title = slangCore.tooltip(row);
      var tip = document.createElement('span');
      tip.className = 'sh-tip';
      tip.hidden = true;
      tip.textContent = row.meaning || '';
      if (row.sources && row.sources[0]) {
        var link = document.createElement('a');
        link.href = row.sources[0];
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Source';
        tip.appendChild(document.createTextNode(' '));
        tip.appendChild(link);
      }
      tip.hidden = openTip !== row.word;
      button.addEventListener('click', function () {
        if (chosenSlang === row.word) {
          chosenSlang = '';
          openTip = '';
        } else {
          chosenSlang = row.word;
          openTip = row.word;
        }
        paintSlang();
      });
      host.appendChild(button);
      host.appendChild(tip);
    });
    if (window.SongHelperChips) window.SongHelperChips.fold(host);
  }

  function fillRegions(tags) {
    if (tags) regionTags = tags;
    var host = $('sh-region');
    if (!host) return;
    host.textContent = '';
    function chip(value, label) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip' + (craft.region === value ? ' on' : '');
      button.textContent = label;
      button.setAttribute('aria-pressed', craft.region === value ? 'true' : 'false');
      button.addEventListener('click', function () {
        if (value && craft.region === value) craft.region = '';
        else craft.region = value;
        chosenSlang = '';
        fillRegions();
        paintSlang();
        paintV2Answers();
        if (window.SongHelperPage && window.SongHelperPage.refreshAnswers) window.SongHelperPage.refreshAnswers();
      });
      host.appendChild(button);
    }
    chip('', 'No region');
    regionTags.forEach(function (tag) { chip(tag, tag); });
    if (window.SongHelperChips) window.SongHelperChips.fold(host);
    if (window.SongFlowPage && window.SongFlowPage.paintCast) window.SongFlowPage.paintCast();
  }

  function ideaTopic() {
    var own = $('sh-own-idea');
    var text = own ? String(own.value || '').trim() : '';
    if (text) return text;
    if (sparkSeed && sparkSeed.angle) return String(sparkSeed.angle);
    return '';
  }

  function liveAnswers() {
    if (!questions || !live) return [];
    return questions.savedTexts(live).map(function (row) {
      return { id: row.id, ask: row.ask, text: row.text };
    });
  }

  function resetLive() {
    if (!questions) return;
    live = questions.open({
      kind: kind,
      mode: mode || 'write',
      mood: readMood(),
      topic: ideaTopic(),
      part: part,
      tone: tone,
      making: making,
      theme: theme,
    });
  }

  function touchLive() {
    if (!questions) return;
    if (!live || live.kind !== kind || live.mode !== mode || live.part !== part) {
      resetLive();
      return;
    }
    questions.sync(live, { mood: readMood(), topic: ideaTopic(), tone: tone, making: making, theme: theme });
  }

  function paintKinds() {
    var host = $('sh-kinds');
    if (!host || !questions) return;
    host.textContent = '';
    questions.KINDS.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      var on = kinds.indexOf(item.id) !== -1;
      button.className = 'sh-chip' + (on ? ' on' : '');
      button.textContent = item.label;
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.addEventListener('click', function () {
        var at = kinds.indexOf(item.id);
        if (at >= 0) kinds.splice(at, 1);
        else if (kinds.length < 2) kinds.push(item.id);
        kind = kinds[0] || '';
        if (window.SongHelperPage && window.SongHelperPage.setMood) {
          window.SongHelperPage.setMood(kind ? (KIND_MOOD[kind] || kind) : '');
        }
        if (window.SongFlowPage) window.SongFlowPage.setKinds(kinds);
        resetLive();
        paintKinds();
        paintLive();
        paintBranch();
      });
      host.appendChild(button);
    });
    if (window.SongHelperChips) window.SongHelperChips.fold(host);
  }

  function paintParts() {
    var host = $('sh-parts');
    if (!host || !questions) return;
    host.textContent = '';
    questions.PARTS.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip' + (part && item.id === part ? ' on' : '');
      button.textContent = item.label;
      button.setAttribute('aria-pressed', part && item.id === part ? 'true' : 'false');
      button.addEventListener('click', function () { setPart(item.id, true); });
      host.appendChild(button);
    });
    if (window.SongHelperChips) window.SongHelperChips.fold(host);
  }

  function setPart(id, toggle) {
    if (toggle && part === id) part = '';
    else part = id || 'song';
    addingPart = !!part && part !== 'song';
    resetLive();
    paintParts();
    paintLive();
  }

  function paintOwn() {
    var host = $('sh-own');
    if (!host || !questions) return;
    host.textContent = '';
    var idea = document.createElement('label');
    idea.className = 'sh-field';
    var ideaSpan = document.createElement('span');
    ideaSpan.textContent = 'Your idea';
    var area = document.createElement('textarea');
    area.className = 'sh-area';
    area.id = 'sh-own-idea';
    area.placeholder = 'One sentence about the song.';
    area.addEventListener('input', function () {
      if (String(area.value || '').trim() && (sparkSeed || sparkTopic || sparkHeadline)) {
        clearSparkChoice();
        if (sparkPack) paintSpark(sparkPack);
      }
      persistOwn();
      touchLive();
      paintLive();
    });
    idea.appendChild(ideaSpan);
    idea.appendChild(area);
    armStory(area);
    host.appendChild(idea);
    questions.TOPIC_FOLLOWUPS.forEach(function (item) {
      var label = document.createElement('label');
      label.className = 'sh-field';
      var span = document.createElement('span');
      span.textContent = item.ask;
      var input = document.createElement('textarea');
      input.className = 'sh-area';
      input.id = 'sh-own-' + item.id;
      input.rows = 3;
      input.placeholder = item.hint || '';
      input.setAttribute('data-spark-ask', item.id);
      input.addEventListener('input', persistOwn);
      label.appendChild(span);
      label.appendChild(input);
      armStory(input);
      host.appendChild(label);
    });
    restoreOwn();
    var note = document.createElement('p');
    note.className = 'sh-help';
    note.textContent = 'These questions are optional. The more you put in, the more human the draft feels. How do you feel about this, any personal experience, and what the song should hold onto can stay in the lyric. Start writing when you want.';
    host.appendChild(note);
  }

  function syncLiveFields() {
    if (!live) return;
    var saved = liveAnswers();
    function put(id, text) {
      var el = $(id);
      if (!el || !text) return;
      if (!String(el.value || '').trim()) {
        el.value = text;
        paintStory(el);
      }
    }
    saved.forEach(function (row) {
      if (row.id === 'who' || row.id === 'call') put('sh-who', row.text);
      if (row.id === 'moment' || row.id === 'happened' || row.id === 'story') put('sh-happened', row.text);
      if (row.id === 'changed' || row.id === 'why') put('sh-why', row.text);
      if (row.id === 'unsaid' || row.id === 'line' || row.id === 'keep-line') put('sh-line', row.text);
    });
  }

  function paintLive() {
    var ask = $('sh-live-ask');
    var hint = $('sh-live-hint');
    var done = $('sh-live-done');
    var answer = $('sh-live-answer');
    if (!ask || !questions) return;
    touchLive();
    if (answer && document.activeElement !== answer) {
      /* keep what they are typing */
    }
    var card = questions.view(live);
    if (card.done) {
      ask.textContent = addingPart
        ? 'Those part answers can be added to the draft.'
        : 'You can stop here. Anything you answered can go in the draft.';
      if (hint) hint.textContent = 'Skip was always allowed. Ask another stays on each step if you go back by changing the kind or the part.';
      if (done) {
        done.hidden = false;
        done.textContent = '';
        var line = document.createElement('span');
        line.textContent = 'Those answers can go into the draft. You can keep going, or skip the rest.';
        done.appendChild(line);
        if (addingPart && part !== 'song') {
          var add = document.createElement('button');
          add.type = 'button';
          add.className = 'btn btn-purple btn-md';
          add.textContent = part === 'bars' ? 'Add these bars' : ('Add this ' + part);
          add.addEventListener('click', appendLivePart);
          done.appendChild(document.createTextNode(' '));
          done.appendChild(add);
        }
      }
      syncLiveFields();
      return;
    }
    if (done) done.hidden = true;
    ask.textContent = card.ask;
    if (hint) hint.textContent = card.hint || '';
  }

  function readLiveDraft() {
    var answer = $('sh-live-answer');
    if (live && answer) live.draft = String(answer.value || '');
  }

  function clearLiveDraft() {
    var answer = $('sh-live-answer');
    if (answer) answer.value = '';
    if (live) live.draft = '';
  }

  function onLiveNext() {
    readLiveDraft();
    if (questions && live) questions.next(live);
    clearLiveDraft();
    paintLive();
    syncLiveFields();
  }

  function onLiveSkip() {
    if (questions && live) questions.skip(live);
    clearLiveDraft();
    paintLive();
  }

  function onLiveAnother() {
    readLiveDraft();
    if (questions && live) questions.askAnother(live);
    clearLiveDraft();
    paintLive();
    syncLiveFields();
  }

  function onLiveOwn() {
    var box = $('sh-live-custom');
    if (box) box.hidden = false;
    var own = $('sh-live-own');
    if (own) {
      try { own.focus(); } catch (err) {}
    }
  }

  function onLiveOwnGo() {
    var own = $('sh-live-own');
    var text = own ? String(own.value || '').trim() : '';
    if (!text || !questions || !live) return;
    questions.ownQuestion(live, text);
    if (own) own.value = '';
    clearLiveDraft();
    paintLive();
  }

  function appendLivePart() {
    var saved = liveAnswers();
    var byId = {};
    saved.forEach(function (row) {
      if (row.text && !byId[row.id]) byId[row.id] = row.text;
    });
    if (part === 'bars') {
      var rows = [byId.about, byId.proof].filter(Boolean).map(function (text) {
        return { text: text, source: 'user' };
      });
      if (!rows.length) {
        showSectionError('Answer a bars question first. They are optional until you add the part.');
        return;
      }
      var barsSection = { label: 'Bars', lines: rows };
      if (mainPath(mode) && window.SongHelperPage && window.SongHelperPage.appendSection) {
        window.SongHelperPage.appendSection(barsSection);
      } else if (lastDraft) {
        lastDraft.sections = (lastDraft.sections || []).concat([barsSection]);
        renderResult({ preview: lastMeta.preview, notice: lastMeta.notice, draft: lastDraft });
      }
      showSectionError('');
      syncStructure();
      return;
    }
    var built = modes.sectionFromAnswers(part, {
      who: byId.who || '',
      happened: byId.happened || byId.moment || '',
      why: byId.why || byId.changed || '',
      line: byId.line || byId.unsaid || '',
      turn: byId.turn || '',
    });
    if (!built.ok) {
      showSectionError(built.error);
      return;
    }
    showSectionError('');
    if (mainPath(mode) && window.SongHelperPage && window.SongHelperPage.appendSection && window.SongHelperPage.appendSection(built.section)) {
      syncStructure();
      return;
    }
    if (lastDraft) {
      lastDraft.sections = (lastDraft.sections || []).concat([built.section]);
      renderResult({
        preview: lastMeta.preview,
        notice: lastMeta.notice || (lastMeta.preview ? modes.DEMO_NOTICE : ''),
        draft: lastDraft,
      });
      syncStructure();
      return;
    }
    showSectionError('Write a draft first. Then this part can be added.');
  }

  function showError(message) {
    var el = $('sh-v2-error');
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function renderResult(data) {
    var out = $('sh-v2-out');
    var extra = $('sh-v2-extra');
    var banner = $('sh-v2-banner');
    var claimPanel = $('sh-v2-claim');
    if (claimPanel) claimPanel.hidden = true;
    lyricsReady = false;
    styleShown = false;
    v2StyleOpen = false;
    var styleHost = $('sh-v2-style');
    if (styleHost) {
      styleHost.hidden = true;
      styleHost.textContent = '';
    }
    out.textContent = '';
    extra.textContent = '';
    lastMeta = {
      preview: Boolean(data.preview),
      notice: data.notice || (data.preview ? modes.DEMO_NOTICE : ''),
    };
    banner.hidden = !data.preview;
    banner.textContent = data.preview ? (data.notice || modes.DEMO_NOTICE) : '';
    if (data.critique) {
      var box = document.createElement('div');
      box.className = 'sh-note-block';
      var title = document.createElement('p');
      title.textContent = data.critique.label || 'Parody check';
      box.appendChild(title);
      (data.critique.blocks || []).forEach(function (text) {
        var p = document.createElement('p');
        p.textContent = text;
        box.appendChild(p);
      });
      ['fairUse', 'release'].forEach(function (key) {
        if (!data.critique[key]) return;
        var p = document.createElement('p');
        p.textContent = data.critique[key];
        box.appendChild(p);
      });
      extra.appendChild(box);
      if (data.step === 'critique' && data.critique.ok) {
        var ack = document.createElement('button');
        ack.type = 'button';
        ack.className = 'btn btn-purple btn-md';
        ack.textContent = 'The check is clear. Write the parody.';
        ack.addEventListener('click', function () {
          parodyAck = true;
          generate();
        });
        extra.appendChild(ack);
      }
    }
    var draft = data.draft;
    if (!draft) {
      syncStructure();
      return;
    }
    if (modes.isPlaceholderLyric) {
      draft.sections = (draft.sections || []).map(function (part) {
        return {
          label: part.label,
          lines: (part.lines || []).filter(function (row) {
            return row && row.text && !modes.isPlaceholderLyric(row.text);
          }),
        };
      }).filter(function (part) { return part.lines.length; });
      if (mode === 'hook' && !modes.allLines(draft).length) {
        showError('The hook did not come back. Try again in a moment.');
        syncStructure();
        return;
      }
    }
    lastDraft = draft;
    (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'song_helper_draft', payload: {} });
    if (window.PlaigroundClaim) window.PlaigroundClaim.noteGeneration(draft);
    if (draft.steps) {
      var list = document.createElement('ol');
      list.className = 'sh-steps';
      draft.steps.forEach(function (step) {
        var item = document.createElement('li');
        item.textContent = step;
        list.appendChild(item);
      });
      out.appendChild(list);
    }
    (draft.notes || []).forEach(function (note) {
      var p = document.createElement('p');
      p.className = 'sh-help';
      p.textContent = note;
      out.appendChild(p);
    });
    if (draft.sourceWork) {
      var source = document.createElement('p');
      source.className = 'sh-note';
      source.textContent = 'Source: ' + draft.sourceWork.title + ', ' + draft.sourceWork.year + ' (' + draft.sourceWork.kind + '). ' + (draft.sourceWork.label || '');
      out.appendChild(source);
    }
    (draft.sections || []).forEach(function (part) {
      var label = document.createElement('p');
      label.className = 'sh-section-label';
      label.textContent = part.label;
      out.appendChild(label);
      (part.lines || []).forEach(function (row, index) {
        renderLine(out, part, row, index);
      });
    });
    if (draft.edits) renderEdits(out, draft.edits);
    var lines = modes.allLines(draft);
    if (lines.length) {
      remember(draft, data);
      renderSuno(out, draft);
      lyricsReady = true;
      if (claimPanel) claimPanel.hidden = false;
    }
    paintV2Feedback();
    syncStructure();
    paintGo();
  }

  function collectV2Style() {
    var page = window.SongFlowPage;
    var raw = page && page.flowState ? page.flowState() : null;
    var ids = raw && window.SongFlow && window.SongFlow.styleIds ? window.SongFlow.styleIds(raw) : null;
    var genre = fieldValue('genre') || '';
    if (!genre && raw && raw.genres && raw.genres[0]) genre = GENRE_LABELS[raw.genres[0]] || '';
    return withStyleDesign({
      genre: genre,
      mood: readMood() || '',
      region: craft.region || '',
      energy: '',
      tempo: '',
      vocal: '',
      texture: '',
      instruments: [],
      era: '',
      flow: ids
    });
  }

  function withStyleDesign(bag) {
    var next = bag || {};
    if (styleDesign && window.StyleDesign && window.StyleDesign.active(styleDesign)) next.design = styleDesign;
    return next;
  }

  function styleStrip(text) {
    return window.SongHelperCore && window.SongHelperCore.stripArtistNames ? window.SongHelperCore.stripArtistNames(text) : text;
  }

  function paintStyleDesign() {
    var host = $('sh-style-design');
    if (!host || !window.StyleDesign) return;
    if (!styleDesign) styleDesign = window.StyleDesign.blank();
    window.StyleDesign.render(host, {
      design: styleDesign,
      open: designOpen,
      note: designNote,
      canUndo: !!designUndo
    }, {
      onToggle: function (open) {
        designOpen = open;
        paintStyleDesign();
      },
      onChange: function (next) {
        styleDesign = next;
        paintStyleDesign();
        if (styleShown && !v2StyleOpen) showV2StylePrompt(collectV2Style(), { quiet: true });
      },
      onNote: function (text) {
        designNote = text || '';
        paintStyleDesign();
      },
      onFresh: function (result) {
        designUndo = styleDesign;
        styleDesign = result.design;
        designNote = (result.changes || []).join(' ');
        paintStyleDesign();
        if (styleShown && !v2StyleOpen) showV2StylePrompt(collectV2Style(), { quiet: true });
      },
      onUndo: function () {
        if (!designUndo) return;
        styleDesign = designUndo;
        designUndo = null;
        designNote = 'Back to your earlier picks.';
        paintStyleDesign();
        if (styleShown && !v2StyleOpen) showV2StylePrompt(collectV2Style(), { quiet: true });
      },
      promptFor: function (design) {
        var bag = collectV2Style();
        if (window.StyleDesign.active(design)) bag.design = design;
        else delete bag.design;
        return {
          text: window.SunoStyle ? window.SunoStyle.prompt(bag, styleStrip) : '',
          warning: window.StyleDesign.warning(design.lead, design.flavor)
        };
      }
    });
  }

  function showV2StylePrompt(bag, opts) {
    if (!window.SunoStyle) return;
    v2StyleBag = withStyleDesign(bag);
    v2StyleOpen = false;
    styleShown = true;
    var host = $('sh-v2-style');
    window.SunoStyle.renderPrompt(host, window.SunoStyle.prompt(v2StyleBag, styleStrip), function (id) {
      showV2StylePrompt(window.SunoStyle.tweak(v2StyleBag, id), { quiet: true });
    });
    paintGo();
    if (!opts || !opts.quiet) {
      try { host.scrollIntoView({ block: 'center' }); } catch (err) {}
    }
  }

  function startV2Style() {
    if (!window.SunoStyle) return;
    var bag = v2StyleBag || collectV2Style();
    var asks = window.SunoStyle.missing(bag).filter(function (ask) {
      var design = bag.design;
      if (!design) return true;
      if (ask.id === 'genre' && design.lead && design.flavor) return false;
      if (ask.id === 'vocal' && (design.tone || design.delivery || design.instrumental)) return false;
      if (ask.id === 'tempo' && design.lead && design.flavor) return false;
      return true;
    });
    if (asks.length) {
      v2StyleBag = bag;
      v2StyleOpen = true;
      window.SunoStyle.renderAsk($('sh-v2-style'), asks, function (chosen) {
        v2StyleOpen = false;
        showV2StylePrompt(window.SunoStyle.applyAnswers(bag, chosen));
      });
      paintGo();
      try { $('sh-v2-style').scrollIntoView({ block: 'center' }); } catch (err) {}
      return;
    }
    showV2StylePrompt(bag);
  }

  function compactV2(source) {
    if (!source || !source.sections) return '';
    return source.sections.map(function (section) {
      var lines = (section.lines || []).map(function (row) {
        return String(row && row.text || '').trim();
      }).filter(Boolean);
      if (!lines.length) return '';
      return (section.label || 'Verse') + '\n' + lines.join('\n');
    }).filter(Boolean).join('\n\n').slice(0, 1600);
  }

  function applyV2Feedback(chosen) {
    if (!window.SongPass) return;
    var plan = window.SongPass.feedbackPlan({
      chips: chosen || Object.keys(feedbackOn).filter(function (id) { return feedbackOn[id]; }),
      note: chosen ? '' : feedbackNote,
    });
    var hint = $('sh-v2-feedback-hint');
    var box = $('sh-v2-clarify');
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
    pendingPrevious = compactV2(lastDraft);
    generate();
  }

  function paintV2Feedback() {
    var host = $('sh-v2-feedback');
    if (!host || !window.SongPass || !lastDraft || mainPath(mode)) return;
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
        paintV2Feedback();
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
    clarify.id = 'sh-v2-clarify';
    clarify.hidden = true;
    host.appendChild(clarify);
    var apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'btn btn-purple btn-md';
    apply.textContent = 'Apply';
    apply.addEventListener('click', function () { applyV2Feedback(); });
    host.appendChild(apply);
    var hint = document.createElement('p');
    hint.className = 'sh-help';
    hint.id = 'sh-v2-feedback-hint';
    host.appendChild(hint);
    if (window.SongHelperChips) window.SongHelperChips.fold(chips);
  }

  function renderLine(parent, part, row, index) {
    var box = document.createElement('textarea');
    box.className = 'sh-line' + (row.source === 'user' ? ' is-user' : '');
    box.rows = 2;
    if (row.original == null) row.original = row.text;
    if (row.logged == null) row.logged = String(row.text || '').trim();
    box.value = row.text;
    box.addEventListener('input', function () {
      row.text = box.value;
      row.edited = String(box.value || '').trim() !== String(row.original || '').trim();
      box.classList.toggle('is-user', row.source === 'user' || row.edited);
      paint();
    });
    box.addEventListener('blur', function () {
      var before = String(row.logged || '');
      var after = String(box.value || '').trim();
      row.text = box.value;
      row.edited = after !== String(row.original || '').trim();
      if (before !== after && window.PlaigroundClaim) {
        window.PlaigroundClaim.noteEdit({ section: part.label, before: before, after: after });
      }
      row.logged = after;
    });
    parent.appendChild(box);
    var tools = document.createElement('div');
    tools.className = 'sh-line-tools';
    var ruler = document.createElement('p');
    ruler.className = 'sh-ruler';
    function paint() {
      var measure = modes.lineRuler(box.value);
      var hits = modes.clicheHits(box.value);
      var bits = [measure.count + ' syllables', measure.pattern, measure.note];
      if (hits.length && !row.locked) bits.push('Cliché: ' + hits[0]);
      if (row.locked) bits.push('Locked');
      ruler.textContent = bits.join(' · ');
    }
    function vote(value) {
      row.vote = row.vote === value ? 0 : value;
      paint();
    }
    ['Thumbs up', 'Thumbs down', row.locked ? 'Unlock line' : 'Lock line'].forEach(function (label, i) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-mini';
      button.textContent = label;
      button.addEventListener('click', function () {
        if (i === 0) vote(1);
        else if (i === 1) vote(-1);
        else {
          row.locked = !row.locked;
          button.textContent = row.locked ? 'Unlock line' : 'Lock line';
          paint();
        }
      });
      tools.appendChild(button);
    });
    tools.insertBefore(ruler, tools.firstChild);
    parent.appendChild(tools);
    paint();
    box.setAttribute('aria-label', (part.label || 'Line') + ' ' + (index + 1));
  }

  function renderEdits(parent, edits) {
    var heading = document.createElement('p');
    heading.className = 'sh-section-label';
    heading.textContent = 'Line edits';
    parent.appendChild(heading);
    edits.forEach(function (row) {
      var block = document.createElement('div');
      block.className = 'sh-edit';
      var original = document.createElement('p');
      original.textContent = 'Yours: ' + row.original;
      var suggestion = document.createElement('p');
      suggestion.textContent = 'Edit: ' + row.suggestion;
      var note = document.createElement('p');
      note.className = 'sh-help';
      note.textContent = row.note;
      var undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'sh-mini';
      undo.textContent = 'Undo';
      undo.addEventListener('click', function () {
        suggestion.textContent = 'Edit: ' + row.original;
        note.textContent = 'Undone. Your line is back.';
      });
      block.appendChild(original);
      block.appendChild(suggestion);
      block.appendChild(note);
      block.appendChild(undo);
      parent.appendChild(block);
    });
  }

  function renderSuno(parent, draft) {
    var text = draft.sections.map(function (part) {
      return '[' + part.label + ']\n' + (part.lines || []).map(function (row) { return row.text; }).join('\n');
    }).join('\n\n');
    var card = document.createElement('div');
    card.className = 'sh-suno';
    var area = document.createElement('textarea');
    area.className = 'sh-suno-text';
    area.readOnly = true;
    area.rows = 8;
    area.value = text;
    var warn = document.createElement('p');
    warn.className = 'sh-suno-warn';
    warn.hidden = true;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-purple btn-md';
    button.textContent = 'Copy lyrics';
    button.addEventListener('click', function () {
      var clichesLocked = modes.allLines(draft).filter(function (row) {
        return modes.clicheHits(row.text).length;
      }).every(function (row) { return row.locked; });
      var check = modes.sunoPrecheck(area.value, { allowCliches: clichesLocked && modes.clicheHits(area.value).length > 0 });
      if (!check.ok) {
        warn.hidden = false;
        warn.textContent = check.blocked[0];
        return;
      }
      if (check.warnings.length && !window.confirm(check.warnings[0] + ' Copy anyway?')) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(area.value).then(function () {
          button.textContent = 'Copied';
          (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'song_helper_lyrics_copied', payload: {} });
        }).catch(function () {
          area.focus();
          area.select();
        });
      }
    });
    card.appendChild(area);
    card.appendChild(warn);
    card.appendChild(button);
    parent.appendChild(card);
  }

  function remember(draft, data) {
    var lines = modes.allLines(draft);
    var entry = {
      at: new Date().toISOString(),
      mode: mode,
      title: draft.title || '',
      saved: true,
      preview: Boolean(data.preview),
      votes: lines.map(function (row) { return { text: row.text, vote: row.vote || 0, locked: !!row.locked }; }),
    };
    try {
      var log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      if (!Array.isArray(log)) log = [];
      log.unshift(entry);
      localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 30)));
    } catch (err) {}
    paintLog();
  }

  function paintLog() {
    var host = $('sh-log');
    if (!host) return;
    host.textContent = '';
    var title = document.createElement('p');
    title.className = 'sh-section-label';
    title.textContent = 'Authorship log';
    host.appendChild(title);
    var log = [];
    try { log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (err) { log = []; }
    if (!log.length) {
      var empty = document.createElement('p');
      empty.className = 'sh-help';
      empty.textContent = 'Dated drafts stay on this device until you claim them.';
      host.appendChild(empty);
      return;
    }
    log.slice(0, 6).forEach(function (entry) {
      var p = document.createElement('p');
      p.className = 'sh-help';
      var when = String(entry.at || '').slice(0, 10);
      p.textContent = when + ' · ' + (entry.mode || 'write') + ' · ' + (entry.title || 'Untitled')
        + (entry.preview ? ' · demo sample' : '');
      host.appendChild(p);
    });
  }

  function lyricsFromDraft(draft) {
    if (!draft || !draft.sections) return '';
    return draft.sections.map(function (part) {
      return (part.lines || []).map(function (row) {
        return String(row && row.text || '').trim();
      }).filter(function (text) {
        return text && !modes.isPlaceholderLyric(text);
      }).join('\n');
    }).filter(Boolean).join('\n');
  }

  function showTransformError(message) {
    var el = $('sh-transform-error');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  async function generate() {
    showError('');
    var skipping = followOpen;
    if (followOpen) {
      followOpen = false;
      followSkipped = true;
      hideV2Follow();
      var skipGo = $('sh-v2-go');
      if (skipGo) skipGo.textContent = goLabel;
    }
    if (pageStatus.disabled) {
      showError('Song Helper is turned off right now.');
      return;
    }
    var body = payload();
    var prepared = preparedInput(body);
    if (prepared.__long) {
      showError(prepared.error || 'That answer is a little long. Shorten it and try again.');
      return;
    }
    if (prepared.__bad) {
      showError('Those answers did not come through. Try again.');
      return;
    }
    if (mode === 'hook') {
      var hookProblem = modes.hookError(prepared);
      if (hookProblem) {
        showError(hookProblem);
        return;
      }
    }
    var problem = modes.concreteError(prepared);
    if (problem) {
      showError(problem);
      return;
    }
    var quiet = { cover: true, review: true, parody: true, 'public-domain': true };
    if (!skipping && !followSkipped && window.SongPass && !quiet[mode]) {
      var asks = window.SongPass.followups(v2Bag());
      if (asks.length) {
        showV2Follow(asks);
        return;
      }
    }
    if (mode === 'public-domain') {
      var picked = fieldValue('work');
      if (picked && !body.title) body.work = picked;
      else body.work = body.title || picked;
      var found = modes.PD_WORKS.filter(function (work) { return work.title === body.work; })[0];
      if (found && !body.year) body.year = String(found.year);
    }
    var go = $('sh-v2-go');
    go.disabled = true;
    try {
      var response = await fetch('/api/song-helper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      var data = await response.json().catch(function () { return null; });
      if (!data) throw new Error('offline');
      if (!response.ok || data.ok === false) {
        showError(data.error || 'That draft did not come through.');
        if (data.critique) renderResult(data);
        return;
      }
      renderResult(data);
      pendingRevision = '';
      pendingPrevious = '';
    } catch (err) {
      if (mode === 'hook') {
        showError('The hook did not come back. Try again in a moment.');
        return;
      }
      var local = modes.buildSample(body);
      if (!local.ok) {
        showError(local.error || 'That draft did not come through.');
        return;
      }
      local.notice = modes.DEMO_NOTICE;
      renderResult(local);
      pendingRevision = '';
      pendingPrevious = '';
    } finally {
      go.disabled = false;
    }
  }

  async function askRole(role) {
    var out = $('sh-team-out');
    out.hidden = false;
    out.textContent = 'Working…';
    var body = payload();
    body.action = role;
    body.name = body.name || (($('sh-artist') && $('sh-artist').value) || '');
    try {
      var response = await fetch('/api/song-helper?action=' + role, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      var data = await response.json();
      paintRole(out, data, role);
    } catch (err) {
      var sample = role === 'scoop' ? modes.scoopSample(body) : modes.scoutSample(body);
      paintRole(out, sample, role);
    }
  }

  function paintRole(out, data, role) {
    out.textContent = '';
    var banner = document.createElement('p');
    banner.className = 'sh-banner';
    banner.textContent = data.notice || (data.preview ? modes.DEMO_NOTICE : '');
    if (!banner.textContent) banner.hidden = true;
    out.appendChild(banner);
    if (data.error) {
      var err = document.createElement('p');
      err.textContent = data.error;
      out.appendChild(err);
      return;
    }
    if (role === 'scoop') {
      var bio = document.createElement('p');
      bio.textContent = data.bio || data.text || '';
      var sheet = document.createElement('p');
      sheet.className = 'sh-help';
      sheet.textContent = data.oneSheet || '';
      out.appendChild(bio);
      if (sheet.textContent) out.appendChild(sheet);
      return;
    }
    (data.notes || [data.text || '']).forEach(function (text) {
      if (!text) return;
      var p = document.createElement('p');
      p.textContent = text;
      out.appendChild(p);
    });
  }

  async function applyTransform(which) {
    showTransformError('');
    if (pageStatus.disabled) {
      showTransformError('Song Helper is turned off right now.');
      return;
    }
    var pasted = $('sh-transform-lines') ? String($('sh-transform-lines').value || '').trim() : '';
    var lines = pasted || lyricsFromDraft(activeDraft());
    if (!lines) {
      showTransformError('Paste lyrics, or finish a draft first. You can also pick Flip it or Funkify at the start and fill the feeling and the questions.');
      return;
    }
    var genre = $('sh-transform-genre') ? String($('sh-transform-genre').value || '').trim() : '';
    if (which === 'flip' && !genre) {
      showTransformError('Name the genre to flip toward.');
      return;
    }
    mode = which;
    var shell = document.getElementById('sh-shell');
    if (shell) shell.classList.add('is-v2');
    if ($('sh-v2')) $('sh-v2').hidden = false;
    paintModes();
    var body = payload();
    body.mode = which;
    body.lines = lines;
    if (genre) body.genre = genre;
    var preparedLines = preparedInput(body);
    if (preparedLines.__long) {
      showTransformError(preparedLines.error || 'That answer is a little long. Shorten it and try again.');
      return;
    }
    if (preparedLines.__bad) {
      showTransformError('Those answers did not come through. Try again.');
      return;
    }
    var problem = modes.concreteError(preparedLines);
    if (problem) {
      showTransformError(problem);
      return;
    }
    showError('');
    try {
      var response = await fetch('/api/song-helper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      var data = await response.json().catch(function () { return null; });
      if (!data) throw new Error('offline');
      if (!response.ok || data.ok === false) {
        showTransformError(data.error || 'That draft did not come through.');
        return;
      }
      renderResult(data);
    } catch (err) {
      var local = modes.buildSample(body);
      if (!local.ok) {
        showTransformError(local.error || 'That draft did not come through.');
        return;
      }
      local.notice = modes.DEMO_NOTICE;
      renderResult(local);
    }
  }

  function songRecord() {
    var draft = activeDraft();
    if (!draftHasContent(draft)) return null;
    var titleEl = document.getElementById('sh-title');
    var blocks = [];
    (draft.sections || []).forEach(function (part) {
      var rows = (part.lines || []).map(function (row) {
        return String(row && row.text || '').trim();
      }).filter(function (text) {
        return text && !modes.isPlaceholderLyric(text);
      });
      if (!rows.length) return;
      blocks.push('[' + (part.label || 'Verse') + ']\n' + rows.join('\n'));
    });
    if (!blocks.length) return null;
    var own = ownIdea();
    return {
      title: titleEl && titleEl.value ? String(titleEl.value).trim().slice(0, 80) : String(draft.title || '').slice(0, 80),
      text: blocks.join('\n\n'),
      mode: mode || 'write',
      mood: readMood(),
      sparkTitle: sparkSeed && sparkSeed.title ? String(sparkSeed.title).slice(0, 80) : '',
      sparkAngle: (sparkSeed && sparkSeed.angle ? String(sparkSeed.angle) : own.idea).slice(0, storyMax()),
      sparkFeel: (sparkSeed && sparkSeed.feel ? String(sparkSeed.feel) : own.feel).slice(0, storyMax()),
      sparkStory: (sparkSeed && sparkSeed.story ? String(sparkSeed.story) : own.story).slice(0, storyMax()),
      sparkKeep: (sparkSeed && sparkSeed.keep ? String(sparkSeed.keep) : own.keep).slice(0, storyMax()),
    };
  }

  function showSaveError(message) {
    var el = $('sh-save-error');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  function showSaveGate(message) {
    var gate = $('sh-save-gate');
    if (gate) gate.hidden = false;
    if (message) showSaveError(message);
  }

  function v2StylePrompt() {
    var box = document.querySelector('#sh-v2-style .sh-style-box');
    return box ? String(box.value || '').trim() : '';
  }

  function currentStyleText() {
    var preview = document.querySelector('#sh-style-design .sh-style-preview');
    var shown = preview ? String(preview.value || '').trim() : '';
    if (shown) return shown;
    if (window.SunoStyle && window.StyleDesign && styleDesign && window.StyleDesign.active(styleDesign)) {
      try {
        return String(window.SunoStyle.prompt(collectV2Style(), styleStrip) || '').trim();
      } catch (err) {
        return '';
      }
    }
    return v2StylePrompt();
  }

  function claimHumanParts() {
    var error = $('sh-v2-claim-error');
    var gate = $('sh-v2-claim-gate');
    if (gate) gate.hidden = true;
    var draft = activeDraft();
    if (!draftHasContent(draft) || !window.PlaigroundClaim) {
      if (error) {
        error.hidden = false;
        error.textContent = 'Write the draft first, then this record can list your lines.';
      }
      return;
    }
    if (error) error.hidden = true;
    var bag = v2Bag();
    var answers = [
      { label: 'Topic', value: bag.topic },
      { label: 'What happened', value: bag.happened },
      { label: 'Who', value: bag.who },
      { label: 'Why it mattered', value: bag.why },
      { label: 'The line', value: bag.line },
      { label: 'Where you were', value: bag.place },
      { label: 'Something you can point at', value: bag.object },
      { label: 'What someone said', value: bag.quote },
    ];
    (bag.live || []).forEach(function (row) {
      if (row && (row.ask || row.label)) answers.push({ label: row.ask || row.label, value: row.text || row.value || '' });
    });
    var choices = [
      { label: 'Mode', value: bag.mode },
      { label: 'Mood', value: bag.mood },
      { label: 'Genre', value: bag.genre },
      { label: 'Region', value: bag.region },
    ];
    var feedback = Object.keys(feedbackOn).filter(function (id) { return feedbackOn[id]; });
    if (feedback.length) choices.push({ label: 'Feedback', value: feedback.join(', ') });
    var titleEl = document.getElementById('sh-title');
    var record = window.PlaigroundClaim.build({
      title: (titleEl && titleEl.value && titleEl.value.trim()) || draft.title || '',
      answers: answers,
      choices: choices,
      lines: window.PlaigroundClaim.linesFromDraft(draft),
      stylePrompt: v2StylePrompt(),
    });
    var button = $('sh-v2-claim-go');
    if (button) button.disabled = true;
    window.PlaigroundClaim.submit(record).then(function (result) {
      if (button) button.disabled = false;
      if (result && result.needsAuth) {
        var next = '/claim?id=' + encodeURIComponent(record.id);
        var signup = $('sh-v2-claim-signup');
        var login = $('sh-v2-claim-login');
        if (signup) signup.setAttribute('href', 'signup.html?next=' + encodeURIComponent(next));
        if (login) login.setAttribute('href', 'login.html?next=' + encodeURIComponent(next));
        if (gate) gate.hidden = false;
        return;
      }
      if (!result || !result.ok) {
        if (error) {
          error.hidden = false;
          error.textContent = (result && result.error) || 'The account save did not go through. Your record stays on this device.';
        }
        if (gate) gate.hidden = false;
        return;
      }
      (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'claim_created', payload: {} });
      window.location.href = '/claim?id=' + encodeURIComponent(record.id);
    });
  }

  async function saveSong() {
    showSaveError('');
    var gate = $('sh-save-gate');
    if (gate) gate.hidden = true;
    var record = songRecord();
    if (!record) {
      showSaveError('Write a draft before you save.');
      return;
    }
    if (window.PlaigroundLyricsAccount) window.PlaigroundLyricsAccount.hold(record);
    try {
      var session = await fetch('/api/me', { credentials: 'same-origin' });
      if (session.status === 401) {
        showSaveGate('');
        return;
      }
      if (session.status !== 200) {
        showSaveGate('The account save did not go through. Your lyrics stay on this device.');
        return;
      }
      var saveRes = await fetch('/api/me/lyrics', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: record }),
      });
      var data = await saveRes.json().catch(function () { return {}; });
      if (saveRes.ok && data && data.song && data.song.id) {
        if (window.PlaigroundLyricsAccount) window.PlaigroundLyricsAccount.clearPending();
        (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'song_helper_saved', payload: {} });
        window.location.href = '/my-lyrics?id=' + encodeURIComponent(data.song.id);
        return;
      }
      showSaveGate('The account save did not go through. Your lyrics stay on this device.');
    } catch (err) {
      showSaveGate('The account save did not go through. Your lyrics stay on this device.');
    }
  }

  function bindCraft() {
    document.querySelectorAll('[data-craft]').forEach(function (button) {
      button.addEventListener('click', function () {
        var key = button.getAttribute('data-craft');
        var value = button.getAttribute('data-value');
        var already = button.classList.contains('on');
        craft[key] = already ? '' : value;
        document.querySelectorAll('[data-craft="' + key + '"]').forEach(function (peer) {
          var on = !already && peer === button;
          peer.classList.toggle('on', on);
          peer.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
    });
    var rabbit = $('sh-rabbit');
    if (rabbit) rabbit.addEventListener('change', function () {
      craft.rabbit = rabbit.checked;
      paintFields();
    });
    var heroRemix = $('sh-remix-hero');
    if (heroRemix) heroRemix.addEventListener('click', function () {
      setMode('superhero');
      var panel = $('sh-v2');
      if (panel && panel.scrollIntoView) {
        try { panel.scrollIntoView({ block: 'start' }); } catch (err) {}
      }
    });
    document.querySelectorAll('[data-structure]').forEach(function (button) {
      button.addEventListener('click', function () {
        setPart(button.getAttribute('data-structure'));
        var liveEl = $('sh-live');
        if (liveEl && liveEl.scrollIntoView) {
          try { liveEl.scrollIntoView({ block: 'start' }); } catch (err) {}
        }
      });
    });
    if ($('sh-live-next')) $('sh-live-next').addEventListener('click', onLiveNext);
    if ($('sh-live-skip')) $('sh-live-skip').addEventListener('click', onLiveSkip);
    if ($('sh-live-another')) $('sh-live-another').addEventListener('click', onLiveAnother);
    if ($('sh-live-write')) $('sh-live-write').addEventListener('click', onLiveOwn);
    if ($('sh-live-own-go')) $('sh-live-own-go').addEventListener('click', onLiveOwnGo);
    var feeling = $('sh-feeling');
    if (feeling) feeling.addEventListener('click', function () {
      touchLive();
      paintLive();
    });
    document.querySelectorAll('[data-transform]').forEach(function (button) {
      button.addEventListener('click', function () {
        applyTransform(button.getAttribute('data-transform'));
      });
    });
    $('sh-v2-go').addEventListener('click', function () {
      if (v2StyleOpen) {
        v2StyleOpen = false;
        showV2StylePrompt(v2StyleBag || collectV2Style());
        return;
      }
      if (lyricsReady) {
        startV2Style();
        return;
      }
      generate();
    });
    if ($('sh-save-song')) $('sh-save-song').addEventListener('click', saveSong);
    if ($('sh-v2-claim-go')) $('sh-v2-claim-go').addEventListener('click', claimHumanParts);
    $('sh-scout').addEventListener('click', function () { askRole('scout'); });
    $('sh-scoop').addEventListener('click', function () { askRole('scoop'); });
  }

  function mountTurnstile() {
    var host = $('sh-turnstile');
    if (!host || !pageStatus.turnstile || !pageStatus.turnstileSiteKey) {
      if (host) host.hidden = true;
      return;
    }
    host.hidden = false;
    var script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.onload = function () {
      if (!window.turnstile) return;
      window.turnstile.render(host, {
        sitekey: pageStatus.turnstileSiteKey,
        callback: function (token) { turnstileToken = token; },
      });
    };
    document.head.appendChild(script);
  }

  async function loadStatus() {
    var banner = $('sh-demo');
    try {
      var response = await fetch('/api/song-helper?action=status');
      if (!response.ok) throw new Error('status');
      pageStatus = await response.json();
    } catch (err) {
      pageStatus = { demo: true, disabled: false, turnstile: false };
    }
    if (banner) {
      banner.hidden = !(pageStatus.demo || pageStatus.disabled);
      banner.textContent = pageStatus.disabled
        ? 'Song Helper is turned off right now. The page still opens. Drafts stay samples.'
        : 'Demo mode. Samples on this page are not written by AI.';
    }
    mountTurnstile();
  }

  async function loadSlang() {
    try {
      var response = await fetch('/api/song-helper?action=slang');
      if (response.ok) {
        var data = await response.json();
        slangRows = data.entries || [];
        fillRegions(data.regions || (slangCore ? slangCore.regions(slangRows) : []));
        paintSlang();
        return;
      }
    } catch (err) {}
    try {
      var file = await fetch('/data/slang.json');
      if (!file.ok) return;
      var json = await file.json();
      slangRows = json.entries || [];
      fillRegions(slangCore ? slangCore.regions(slangRows) : []);
      paintSlang();
    } catch (err2) {}
  }

  function draftHasContent(value) {
    if (!value || !value.sections) return false;
    return value.sections.some(function (part) {
      return (part.lines || []).some(function (row) {
        var text = String(row && row.text || '').trim();
        return text && !modes.isPlaceholderLyric(text);
      });
    });
  }

  function activeDraft() {
    if (mainPath(mode) && window.SongHelperPage && window.SongHelperPage.draft) {
      return window.SongHelperPage.draft();
    }
    return lastDraft;
  }

  function hasDraft() {
    if (window.SongHelperPage && window.SongHelperPage.hasDraft && window.SongHelperPage.hasDraft()) return true;
    return draftHasContent(lastDraft);
  }

  function partPresent(draft) {
    var found = { verse: false, hook: false, bars: false, bridge: false };
    if (!draft || !draft.sections) return found;
    draft.sections.forEach(function (section) {
      var label = String(section.label || '').toLowerCase();
      if (label.indexOf('verse') !== -1) found.verse = true;
      if (label.indexOf('hook') !== -1 || label.indexOf('chorus') !== -1) found.hook = true;
      if (label.indexOf('bar') !== -1) found.bars = true;
      if (label.indexOf('bridge') !== -1) found.bridge = true;
    });
    return found;
  }

  function syncStructure() {
    var panel = $('sh-expand');
    if (!panel) return;
    var ready = hasDraft();
    panel.hidden = !ready;
    var present = partPresent(anyDraft());
    document.querySelectorAll('[data-structure]').forEach(function (button) {
      var name = button.getAttribute('data-structure');
      button.hidden = Boolean(ready && present[name]);
      button.disabled = !ready;
    });
    if (!ready) {
      var ask = $('sh-section-ask');
      if (ask) {
        ask.hidden = true;
        ask.textContent = '';
      }
      showSectionError('');
    }
  }

  function showSectionError(message) {
    var el = $('sh-section-error');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function openSectionAsk(kind) {
    if (!modes.SECTION_FIELDS[kind]) return;
    if (!hasDraft()) {
      showSectionError('Write a draft first. A verse, a hook, or a bridge adds to a song that is already on the page.');
      return;
    }
    sectionKind = kind;
    showSectionError('');
    var host = $('sh-section-ask');
    host.hidden = false;
    host.textContent = '';
    var intro = document.createElement('p');
    intro.className = 'sh-help';
    intro.textContent = kind === 'hook'
      ? 'Three answers first. The hook is written from those words.'
      : (kind === 'bridge'
        ? 'Say what turns, who sees it, and why. Then the bridge is written from those answers.'
        : 'Say who, what happened, and why. Then the verse is written from those answers.');
    host.appendChild(intro);
    modes.SECTION_FIELDS[kind].forEach(function (field) {
      addField(host, {
        id: field.id,
        label: field.label,
        kind: 'area',
        placeholder: field.placeholder,
      });
    });
    var go = document.createElement('button');
    go.type = 'button';
    go.className = 'btn btn-purple btn-md';
    go.textContent = kind === 'hook' ? 'Write this hook' : (kind === 'bridge' ? 'Write this bridge' : 'Write this verse');
    go.addEventListener('click', writeSection);
    host.appendChild(go);
    document.querySelectorAll('[data-structure]').forEach(function (button) {
      button.classList.toggle('on', button.getAttribute('data-structure') === kind);
    });
    try { host.scrollIntoView({ block: 'nearest' }); } catch (err) {}
    var first = host.querySelector('textarea, input');
    if (first) {
      try { first.focus(); } catch (err2) {}
    }
  }

  function sectionAnswers() {
    var spec = modes.SECTION_FIELDS[sectionKind] || [];
    var host = $('sh-section-ask');
    var out = {};
    spec.forEach(function (field) {
      var el = host.querySelector('[data-field="' + field.id + '"]');
      var value = el ? String(el.value || '').trim() : '';
      var hint = el ? String(el.getAttribute('placeholder') || '').trim() : '';
      if (hint && value.toLowerCase() === hint.toLowerCase()) value = '';
      if (modes.isPlaceholderLyric(value)) value = '';
      out[field.id] = value;
    });
    return out;
  }

  function writeSection() {
    var built = modes.sectionFromAnswers(sectionKind, sectionAnswers());
    if (!built.ok) {
      showSectionError(built.error);
      return;
    }
    showSectionError('');
    if (mainPath(mode)) {
      if (!window.SongHelperPage || !window.SongHelperPage.appendSection || !window.SongHelperPage.appendSection(built.section)) {
        showSectionError('Write a draft first. A verse, a hook, or a bridge adds to a song that is already on the page.');
        return;
      }
    } else if (lastDraft) {
      lastDraft.sections = (lastDraft.sections || []).concat([built.section]);
      renderResult({
        preview: lastMeta.preview,
        notice: lastMeta.notice || (lastMeta.preview ? modes.DEMO_NOTICE : ''),
        draft: lastDraft,
      });
    } else {
      showSectionError('Write a draft first. A verse, a hook, or a bridge adds to a song that is already on the page.');
      return;
    }
    var host = $('sh-section-ask');
    host.hidden = true;
    host.textContent = '';
  }

  function seedFields() {
    if (!sparkSeed || !sparkSeed.angle) return;
    var happenedValue = sparkSeed.angle.slice(0, storyMax());
    var quoteValue = sparkSeed.angle.slice(0, storyMax());
    function fill(el, next) {
      if (!el) return;
      var current = String(el.value || '').trim();
      if (!current || current === seededAngle || current === seededAngle.slice(0, next.length)) {
        el.value = next;
        paintStory(el);
      }
    }
    fill($('sh-happened'), happenedValue);
    fill(document.querySelector('#sh-v2-fields [data-field="quote"]'), quoteValue);
    fill(document.querySelector('#sh-v2-fields [data-field="happened"]'), happenedValue);
    seededAngle = happenedValue;
  }

  function clearSparkChoice() {
    sparkTopic = '';
    sparkHeadline = '';
    sparkSeed = null;
    sparkAsk = { feel: '', story: '', keep: '' };
    sparkDailyOpen = false;
    seededAngle = '';
    paintSparkNote();
  }

  function clearOwnIdea() {
    var own = $('sh-own-idea');
    if (own) own.value = '';
    var host = $('sh-own');
    if (!host) return;
    host.querySelectorAll('[data-spark-ask]').forEach(function (el) { el.value = ''; });
  }

  function paintIdeaLane() {
    var ideas = $('sh-ideas-panel');
    var own = $('sh-own-panel');
    var ideasBtn = $('sh-choice-ideas');
    var ownBtn = $('sh-choice-own');
    if (ideas) ideas.hidden = ideaLane !== 'ideas';
    if (own) own.hidden = ideaLane !== 'own';
    var titleField = $('sh-title-field');
    if (titleField) titleField.hidden = ideaLane !== 'ideas' && ideaLane !== 'own';
    if (ideasBtn) {
      var ideasOn = ideaLane === 'ideas';
      ideasBtn.classList.toggle('on', ideasOn);
      ideasBtn.setAttribute('aria-pressed', ideasOn ? 'true' : 'false');
    }
    if (ownBtn) {
      var ownOn = ideaLane === 'own';
      ownBtn.classList.toggle('on', ownOn);
      ownBtn.setAttribute('aria-pressed', ownOn ? 'true' : 'false');
    }
  }

  function showEl(id, on) {
    var el = $(id);
    if (el) el.hidden = !on;
  }

  function sourceModeOn() {
    return mode === 'parody' || mode === 'cover' || mode === 'public-domain';
  }

  function paintSourceNotes() {
    var host = $('sh-source-notes');
    if (!host || !modes) return;
    host.textContent = '';
    if (branch !== 'source' || !sourceModeOn()) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    var lines = [];
    if (mode === 'parody') lines = [modes.FAIR_USE_NOTE, modes.RELEASE_NOTE];
    else if (mode === 'cover') lines = ['Name the song first. This page does not sell a license.', modes.MECHANICAL_STEPS[0]];
    else if (mode === 'public-domain') lines = [modes.PD_NOTE];
    lines.forEach(function (text) {
      if (!text) return;
      var p = document.createElement('p');
      p.className = 'sh-help';
      p.textContent = text;
      host.appendChild(p);
    });
  }

  function paintBranch() {
    if (window.SongHelperPage && window.SongHelperPage.hasDraft && window.SongHelperPage.hasDraft() && !branch && !storyBox) {
      branch = 'scratch';
      if (!ideaLane) ideaLane = 'own';
      if (!kind) {
        kind = 'love';
        kinds = ['love'];
        if (window.SongHelperPage.setMood && window.SongHelperPage.mood && !window.SongHelperPage.mood()) {
          window.SongHelperPage.setMood(KIND_MOOD.love);
        }
      }
    }
    var scratch = branch === 'scratch';
    var source = branch === 'source';
    var methodReady = mode === 'write' || mode === 'assist' || mode === 'exchange' || mode === 'madlibs';
    var setupReady = scratch && !!making && !!amount && methodReady && !!tone;
    showEl('sh-setup', scratch);
    showEl('sh-amount-wrap', scratch && !!making);
    showEl('sh-method-wrap', scratch && !!making && !!amount);
    showEl('sh-tone-wrap', scratch && !!making && !!amount && methodReady);
    showEl('sh-rap-wrap', making === 'rap');
    showEl('sh-source', source);
    showEl('sh-feeling', setupReady);
    var feelReady = setupReady && !!kind;
    showEl('sh-idea', feelReady);
    var storyReady = feelReady && (ideaLane === 'ideas' || ideaLane === 'own');
    var pageFlow = window.SongFlowPage;
    var talk = pageFlow ? pageFlow.talk() : '';
    var draftReady = storyReady && pageFlow && pageFlow.ready();
    var drafted = window.SongHelperPage && window.SongHelperPage.hasDraft && window.SongHelperPage.hasDraft();
    showEl('sh-talk', storyReady);
    showEl('sh-purpose', storyReady && (talk === 'form' || talk === 'plai'));
    showEl('sh-cast', !!draftReady);
    showEl('sh-live', false);
    showEl('sh-craft', !!drafted);
    showEl('sh-part-pick', false);
    var main = mode === 'write' || mode === 'assist' || (!mode && drafted);
    var writeSurface = main && ((!!draftReady && pageFlow && pageFlow.opened()) || drafted);
    var v2On = (source && sourceModeOn()) || (storyReady && !!mode && !mainPath(mode) && mode !== 'battle');
    var shell = document.getElementById('sh-shell');
    if (shell) shell.classList.toggle('is-v2', v2On);
    var finishedLyrics = window.SongHelperPage && window.SongHelperPage.lyricsOpen && window.SongHelperPage.lyricsOpen();
    showEl('sh-write', writeSurface || !!finishedLyrics);
    var panel = $('sh-v2');
    if (panel) panel.hidden = !v2On;
    var scratchBtn = $('sh-choice-scratch');
    var sourceBtn = $('sh-choice-source');
    if (scratchBtn) {
      scratchBtn.classList.toggle('on', scratch);
      scratchBtn.setAttribute('aria-pressed', scratch ? 'true' : 'false');
    }
    if (sourceBtn) {
      sourceBtn.classList.toggle('on', source);
      sourceBtn.setAttribute('aria-pressed', source ? 'true' : 'false');
    }
    showEl('sh-page', !!storyBox);
    var pageBtn = $('sh-choice-page');
    if (pageBtn) {
      pageBtn.classList.toggle('on', !!storyBox);
      pageBtn.setAttribute('aria-pressed', storyBox ? 'true' : 'false');
    }
    paintIdeaLane();
    paintSourceNotes();
    paintDraftButton();
  }

  function setStoryBox(on, opts) {
    storyBox = !!on;
    if (storyBox) branch = '';
    paintBranch();
    if (storyBox && !(opts && opts.keep)) {
      var page = $('sh-page');
      if (page && page.scrollIntoView) {
        try { page.scrollIntoView({ block: 'nearest' }); } catch (err) {}
      }
    }
    if (!(opts && opts.quiet)) persistPage();
  }

  function setBranch(next) {
    if (next !== 'scratch' && next !== 'source') return;
    var wasStory = storyBox;
    storyBox = false;
    if (branch === next) {
      if (wasStory) {
        paintBranch();
        persistPage();
      }
      return;
    }
    branch = next;
    if (next === 'scratch' && sourceModeOn()) {
      mode = '';
      paintModes();
      paintFields();
    }
    paintBranch();
    if (wasStory) persistPage();
  }

  function setIdeaLane(next) {
    if (next !== 'ideas' && next !== 'own') return;
    if (next === ideaLane) return;
    ideaLane = next;
    if (next === 'own') clearSparkChoice();
    if (next === 'ideas') clearOwnIdea();
    paintIdeaLane();
    if (sparkPack) paintSpark(sparkPack);
    touchLive();
    paintLive();
    paintBranch();
  }

  function paintSparkNote() {
    var note = $('sh-spark-picked');
    if (!note) return;
    if (!sparkSeed || !sparkSeed.angle) {
      note.hidden = true;
      note.textContent = '';
      return;
    }
    note.hidden = false;
    var title = sparkSeed.title ? (': ' + sparkSeed.title) : '';
    note.textContent = 'Using this spark' + title + '. Start writing when you want. The questions are optional. The more you put in, the more human the draft feels.';
  }

  function sparkText(item) {
    return [(item && item.topic) || '', (item && item.headline) || '', (item && item.title) || '', (item && item.detail) || '', (item && item.flip) || ''].join(' ');
  }

  function askValue(el) {
    if (!el) return '';
    var value = String(el.value || '').trim();
    var hint = String(el.getAttribute('placeholder') || '').trim();
    if (hint && value.toLowerCase() === hint.toLowerCase()) return '';
    return value;
  }

  function pastedOrDraft() {
    var pasted = $('sh-transform-lines');
    var extra = pasted ? String(pasted.value || '').trim() : '';
    if (extra) return extra.slice(0, 4000);
    if (mode !== 'flip' && mode !== 'funkify' && mode !== 'superhero') return '';
    var draft = anyDraft();
    if (!draft || !modes.allLines) return '';
    return modes.allLines(draft).map(function (row) { return row.text; }).join('\n').slice(0, 4000);
  }

  function anyDraft() {
    if (window.SongHelperPage && window.SongHelperPage.hasDraft && window.SongHelperPage.hasDraft()) {
      return window.SongHelperPage.draft();
    }
    return lastDraft;
  }

  function rememberAsk() {
    var hosts = ideaLane === 'own' ? ['sh-own'] : (ideaLane === 'ideas' ? ['sh-spark'] : ['sh-spark', 'sh-own']);
    hosts.forEach(function (id) {
      var host = $(id);
      if (!host) return;
      ['feel', 'story', 'keep'].forEach(function (key) {
        var el = host.querySelector('[data-spark-ask="' + key + '"]');
        if (el) sparkAsk[key] = askValue(el);
      });
    });
    if (sparkSeed) {
      sparkSeed.feel = sparkAsk.feel;
      sparkSeed.story = sparkAsk.story;
      sparkSeed.keep = sparkAsk.keep;
    }
  }

  function persistOwn() {
    try {
      var prev = JSON.parse(localStorage.getItem('plaiground.songHelper.story') || '{}') || {};
      prev.own = ownIdea();
      localStorage.setItem('plaiground.songHelper.story', JSON.stringify(prev));
    } catch (err) {}
  }

  function restoreOwn() {
    var saved = {};
    try {
      saved = (JSON.parse(localStorage.getItem('plaiground.songHelper.story') || '{}') || {}).own || {};
    } catch (err) {
      saved = {};
    }
    function put(id, text) {
      var el = $(id);
      if (!el || String(el.value || '').trim() || !text) return;
      el.value = String(text);
      paintStory(el);
    }
    put('sh-own-idea', saved.idea);
    put('sh-own-feel', saved.feel);
    put('sh-own-story', saved.story);
    put('sh-own-keep', saved.keep);
  }

  function chooseSpark(item, which) {
    if (!item) return;
    rememberAsk();
    var whichId = which === 'flip' ? 'flip' : 'spark';
    if (sparkSeed && sparkSeed.id && sparkSeed.id === item.id && sparkSeed.which === whichId) {
      clearSparkChoice();
      if (sparkPack) paintSpark(sparkPack);
      return;
    }
    var spark = window.SparkCore;
    var angle = which === 'flip'
      ? (item.flip || item.detail || item.title || '')
      : (item.detail || item.title || '');
    angle = String(angle || '').replace(/\s+/g, ' ').trim();
    if (!angle) return;
    if (spark && spark.tragedy(sparkText(item) + ' ' + angle)) return;
    branch = 'scratch';
    if (ideaLane !== 'ideas') {
      ideaLane = 'ideas';
      paintIdeaLane();
    }
    clearOwnIdea();
    var same = sparkSeed && sparkSeed.id && sparkSeed.id === item.id;
    if (!same) sparkAsk = { feel: '', story: '', keep: '' };
    if (item.feel != null) sparkAsk.feel = String(item.feel).slice(0, storyMax());
    if (item.story != null) sparkAsk.story = String(item.story).slice(0, storyMax());
    if (item.keep != null) sparkAsk.keep = String(item.keep).slice(0, storyMax());
    sparkSeed = {
      id: item.id || '',
      title: String(item.title || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      angle: angle.slice(0, storyMax()),
      lane: item.lane || '',
      topic: item.topic || '',
      headline: item.headline || '',
      sourceLabel: item.sourceLabel || '',
      sourceUrl: item.sourceUrl || '',
      which: whichId,
      feel: sparkAsk.feel,
      story: sparkAsk.story,
      keep: sparkAsk.keep,
    };
    touchLive();
    paintLive();
    if (item.daily) sparkDailyOpen = true;
    if (item.topic) sparkTopic = item.topic;
    if (item.headline) sparkHeadline = item.headline;
    seedFields();
    paintSparkNote();
    if (sparkPack) paintSpark(sparkPack);
    paintBranch();
    var ask = document.getElementById('sh-spark-ask');
    if (ask) {
      try { ask.scrollIntoView({ block: 'nearest' }); } catch (err) {}
    }
  }

  function startFromSpark() {
    rememberAsk();
    seedFields();
    paintSparkNote();
    var feeling = $('sh-feeling');
    if (feeling) {
      try { feeling.scrollIntoView({ block: 'start' }); } catch (err) {}
    }
    var mood = document.querySelector('#sh-feeling .sh-chip');
    if (mood) {
      try { mood.focus(); } catch (err2) {}
    }
  }

  function sparkCard(item) {
    var spark = window.SparkCore;
    var article = document.createElement('article');
    article.className = 'spark-card' + (sparkSeed && sparkSeed.id && sparkSeed.id === item.id ? ' is-picked' : '');
    var title = document.createElement('h3');
    title.textContent = item.title || 'Spark';
    var detail = document.createElement('p');
    detail.textContent = item.detail || '';
    var source = document.createElement('p');
    source.className = 'spark-source';
    if (item.sourceUrl) {
      var link = document.createElement('a');
      link.href = item.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = item.sourceLabel || item.sourceUrl;
      source.appendChild(link);
    } else {
      source.textContent = item.sourceLabel || (spark ? spark.SAMPLE_LABEL : 'Sample. No live source is connected.');
    }
    article.appendChild(title);
    if (detail.textContent) article.appendChild(detail);
    article.appendChild(source);
    addSparkLine(article, 'Flip the angle', item.flip);
    addSparkLine(article, 'Answer song', item.answer);
    if (item.cause) addSparkLine(article, 'Cause drop', item.cause);
    if (item.dailyNote) {
      var daily = document.createElement('p');
      daily.className = 'spark-source';
      daily.textContent = item.dailyNote;
      article.appendChild(daily);
    }
    var actions = document.createElement('div');
    actions.className = 'sh-spark-actions';
    actions.appendChild(sparkButton('Use this spark', function () { chooseSpark(item, 'spark'); }));
    if (item.flip) actions.appendChild(sparkButton('Flip the angle', function () { chooseSpark(item, 'flip'); }));
    article.appendChild(actions);
    return article;
  }

  function addSparkLine(parent, label, text) {
    if (!text) return;
    var p = document.createElement('p');
    var strong = document.createElement('strong');
    strong.textContent = label + ': ';
    p.appendChild(strong);
    p.appendChild(document.createTextNode(text));
    parent.appendChild(p);
  }

  function sparkButton(label, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost btn-md';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function sparkChip(label, on, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'sh-chip' + (on ? ' on' : '');
    button.textContent = label;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.addEventListener('click', onClick);
    return button;
  }

  function sparkLanes() {
    var group = SPARK_GROUPS.filter(function (row) { return row.id === sparkGroup; })[0];
    var lanes = group ? group.lanes.slice() : [];
    if (sparkNews) lanes = [sparkNews];
    return lanes;
  }

  function paintSpark(pack) {
    if (pack) sparkPack = pack;
    var host = $('sh-spark');
    var spark = window.SparkCore;
    if (!host || !spark || !sparkPack) return;
    var lanes = sparkLanes();
    var topics = spark.topicsFor(sparkPack.items || [], lanes);
    if (sparkTopic && !topics.some(function (topic) { return topic.label === sparkTopic; })) {
      sparkTopic = '';
      sparkHeadline = '';
    }
    var headlines = spark.headlinesFor(sparkPack.items || [], lanes, sparkTopic);
    if (sparkHeadline && !headlines.some(function (row) { return row.label === sparkHeadline; })) sparkHeadline = '';
    host.textContent = '';
    var banner = document.createElement('p');
    banner.className = 'sh-banner';
    banner.textContent = sparkPack.notice || spark.SAMPLE_LABEL;
    host.appendChild(banner);
    if (sparkPack.daily && !spark.tragedy(sparkText(sparkPack.daily))) {
      var dailyLabel = document.createElement('h3');
      dailyLabel.className = 'sh-subhead';
      dailyLabel.textContent = (spark.BROWSE && spark.BROWSE.daily) || 'Daily spark';
      host.appendChild(dailyLabel);
      var dailyBtn = document.createElement('button');
      dailyBtn.type = 'button';
      dailyBtn.className = 'spark-headline' + (sparkDailyOpen ? ' on' : '');
      dailyBtn.setAttribute('aria-expanded', sparkDailyOpen ? 'true' : 'false');
      dailyBtn.textContent = sparkPack.daily.headline || sparkPack.daily.title || 'Daily spark';
      dailyBtn.addEventListener('click', function () {
        rememberAsk();
        var dailyId = sparkPack.daily && sparkPack.daily.id;
        var picked = sparkSeed && dailyId && sparkSeed.id === dailyId;
        if (picked) {
          sparkSeed = null;
          sparkAsk = { feel: '', story: '', keep: '' };
          sparkDailyOpen = false;
          paintSparkNote();
          paintSpark();
          return;
        }
        sparkDailyOpen = !sparkDailyOpen;
        paintSpark();
      });
      host.appendChild(dailyBtn);
      if (sparkDailyOpen) host.appendChild(sparkCard(sparkPack.daily));
    }
    var groups = document.createElement('div');
    groups.className = 'sh-modes';
    groups.setAttribute('role', 'group');
    groups.setAttribute('aria-label', "What's hot");
    SPARK_GROUPS.forEach(function (group) {
      groups.appendChild(sparkChip(group.label, group.id === sparkGroup, function () {
        rememberAsk();
        if (sparkGroup === group.id) sparkGroup = '';
        else sparkGroup = group.id;
        sparkNews = '';
        clearSparkChoice();
        paintSpark();
      }));
    });
    host.appendChild(groups);
    if (sparkGroup === 'news') {
      var desks = document.createElement('div');
      desks.className = 'sh-modes';
      desks.setAttribute('role', 'group');
      desks.setAttribute('aria-label', 'News desks');
      desks.appendChild(sparkChip('All news', !sparkNews, function () {
        rememberAsk();
        if (!sparkNews) return;
        sparkNews = '';
        clearSparkChoice();
        paintSpark();
      }));
      spark.LANES.filter(function (lane) { return lane.id.indexOf('news-') === 0; }).forEach(function (lane) {
        desks.appendChild(sparkChip(lane.label.replace(/^News · /, ''), sparkNews === lane.id, function () {
          rememberAsk();
          if (sparkNews === lane.id) sparkNews = '';
          else sparkNews = lane.id;
          clearSparkChoice();
          paintSpark();
        }));
      });
      host.appendChild(desks);
    }
    var topicLabel = document.createElement('h3');
    topicLabel.className = 'sh-subhead';
    topicLabel.textContent = (spark.BROWSE && spark.BROWSE.topics) || 'Topics';
    host.appendChild(topicLabel);
    var topicRow = document.createElement('div');
    topicRow.className = 'sh-modes';
    topicRow.setAttribute('role', 'group');
    topicRow.setAttribute('aria-label', 'Topics');
    if (!topics.length) {
      var emptyTopics = document.createElement('p');
      emptyTopics.className = 'sh-help';
      emptyTopics.textContent = (spark.BROWSE && spark.BROWSE.empty) || 'Nothing in this lane right now.';
      host.appendChild(emptyTopics);
    } else {
      topics.forEach(function (topic) {
        var topicOn = sparkTopics.indexOf(topic.label) !== -1 || sparkTopic === topic.label;
        topicRow.appendChild(sparkChip(topic.label, topicOn, function () {
          rememberAsk();
          var at = sparkTopics.indexOf(topic.label);
          if (at >= 0 || sparkTopic === topic.label) {
            if (at >= 0) sparkTopics.splice(at, 1);
            var was = topic.label;
            if (sparkTopic === topic.label) sparkTopic = sparkTopics[0] || '';
            sparkHeadline = '';
            if (sparkSeed && sparkSeed.topic === was) {
              sparkSeed = null;
              sparkAsk = { feel: '', story: '', keep: '' };
              paintSparkNote();
            }
          } else if (sparkTopics.length < 2) {
            sparkTopics.push(topic.label);
            sparkTopic = topic.label;
            sparkHeadline = '';
            if (sparkSeed && sparkSeed.topic && sparkTopics.indexOf(sparkSeed.topic) === -1) {
              sparkSeed = null;
              paintSparkNote();
            }
            clearOwnIdea();
          }
          paintSpark();
        }));
      });
      host.appendChild(topicRow);
    }
    if (!sparkTopic) {
      var pickTopic = document.createElement('p');
      pickTopic.className = 'sh-help';
      pickTopic.textContent = (spark.BROWSE && spark.BROWSE.pickTopic) || 'Pick a topic.';
      host.appendChild(pickTopic);
    } else {
      var headLabel = document.createElement('h3');
      headLabel.className = 'sh-subhead';
      headLabel.textContent = (spark.BROWSE && spark.BROWSE.headlines) || 'Headlines';
      host.appendChild(headLabel);
      var headRow = document.createElement('div');
      headRow.className = 'spark-headlines';
      headRow.setAttribute('role', 'group');
      headRow.setAttribute('aria-label', 'Headlines');
      headlines.forEach(function (row) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'spark-headline' + (sparkHeadline === row.label ? ' on' : '');
        button.setAttribute('aria-expanded', sparkHeadline === row.label ? 'true' : 'false');
        button.textContent = row.label;
        button.addEventListener('click', function () {
          rememberAsk();
          if (sparkHeadline === row.label) {
            var wasHead = row.label;
            sparkHeadline = '';
            if (sparkSeed && sparkSeed.headline === wasHead) {
              sparkSeed = null;
              sparkAsk = { feel: '', story: '', keep: '' };
              paintSparkNote();
            }
          } else {
            sparkHeadline = row.label;
            clearOwnIdea();
          }
          paintSpark();
        });
        headRow.appendChild(button);
      });
      host.appendChild(headRow);
      if (!sparkHeadline) {
        var pickHead = document.createElement('p');
        pickHead.className = 'sh-help';
        pickHead.textContent = (spark.BROWSE && spark.BROWSE.pickHeadline) || 'Pick a headline.';
        host.appendChild(pickHead);
      } else {
        var list = document.createElement('div');
        list.className = 'spark-list';
        spark.sparksFor(sparkPack.items || [], lanes, sparkTopic, sparkHeadline).forEach(function (item) {
          list.appendChild(sparkCard(item));
        });
        host.appendChild(list);
      }
    }
    if (sparkSeed && sparkSeed.angle) host.appendChild(sparkAskPanel(spark));
    if (window.SongHelperChips) window.SongHelperChips.foldAll();
  }

  function sparkAskPanel(spark) {
    var ask = (spark && spark.ASK) || {};
    var panel = document.createElement('div');
    panel.className = 'spark-ask';
    panel.id = 'sh-spark-ask';
    var lead = document.createElement('p');
    lead.textContent = ask.lead || 'You can start writing now, or answer a few questions first.';
    var optional = document.createElement('p');
    optional.className = 'sh-help';
    optional.textContent = ask.optional || 'These questions are optional. The more you put in, the more human the draft feels.';
    panel.appendChild(lead);
    panel.appendChild(optional);
    addAskField(panel, 'feel', ask.feel || 'How do you feel about this?', ask.feelHint || '');
    addAskField(panel, 'story', ask.story || 'Any personal experience with it?', ask.storyHint || '');
    addAskField(panel, 'keep', ask.keep || 'What do you want the song to hold onto?', ask.keepHint || '');
    panel.appendChild(sparkButton(ask.start || 'Start writing', startFromSpark));
    return panel;
  }

  function addAskField(parent, key, label, hint) {
    var field = document.createElement('label');
    field.className = 'sh-field';
    var span = document.createElement('span');
    span.textContent = label;
    var area = document.createElement('textarea');
    area.className = 'sh-area';
    area.rows = 2;
    area.setAttribute('data-spark-ask', key);
    if (hint) area.placeholder = hint;
    area.value = sparkAsk[key] || '';
    area.addEventListener('input', function () {
      sparkAsk[key] = askValue(area);
      if (sparkSeed) sparkSeed[key] = sparkAsk[key];
    });
    field.appendChild(span);
    field.appendChild(area);
    armStory(area);
    parent.appendChild(field);
  }

  async function loadSpark() {
    var spark = window.SparkCore;
    var pack = spark ? spark.pack() : null;
    try {
      var response = await fetch('/api/spark');
      if (response.ok) {
        var data = await response.json();
        if (data && data.items) pack = data;
      }
    } catch (err) {}
    if (pack) paintSpark(pack);
  }

  function applySparkPrompt() {
    var raw = '';
    try { raw = sessionStorage.getItem('plaiground.sparkPrompt') || ''; } catch (err) { return; }
    if (!raw) return;
    var prompt = null;
    try { prompt = JSON.parse(raw); } catch (err) { return; }
    try { sessionStorage.removeItem('plaiground.sparkPrompt'); } catch (err) {}
    if (!prompt) return;
    if (prompt.lane && String(prompt.lane).indexOf('news-') === 0) {
      sparkGroup = 'news';
      sparkNews = prompt.lane;
    } else if (prompt.lane === 'causes' || prompt.lane === 'mindset' || prompt.lane === 'trending') {
      sparkGroup = prompt.lane;
      sparkNews = '';
    }
    chooseSpark({
      id: prompt.id || 'from-spark-page',
      title: prompt.title || '',
      detail: prompt.detail || prompt.answer || prompt.flip || prompt.title || '',
      flip: prompt.flip || '',
      lane: prompt.lane || '',
      topic: prompt.topic || '',
      headline: prompt.headline || '',
      sourceLabel: prompt.sourceLabel || '',
      sourceUrl: prompt.sourceUrl || '',
      feel: prompt.feel || '',
      story: prompt.story || '',
      keep: prompt.keep || '',
    }, prompt.which === 'flip' ? 'flip' : 'spark');
  }

  function storyPatch(patch) {
    try {
      var prev = JSON.parse(localStorage.getItem('plaiground.songHelper.story') || '{}') || {};
      Object.keys(patch || {}).forEach(function (key) { prev[key] = patch[key]; });
      localStorage.setItem('plaiground.songHelper.story', JSON.stringify(prev));
    } catch (err) {}
  }

  function pageError(message) {
    var el = $('sh-page-error');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function findPart(id) {
    var found = null;
    pageSections.forEach(function (row) { if (row.id === id) found = row; });
    return found;
  }

  function partNode(attr, id) {
    var host = $('sh-page-sections');
    if (!host) return null;
    var nodes = host.querySelectorAll('[' + attr + ']');
    var found = null;
    for (var i = 0; i < nodes.length; i += 1) {
      if (nodes[i].getAttribute(attr) === id) found = nodes[i];
    }
    return found;
  }

  function otherBody(id) {
    return pageSections.filter(function (row) { return row.id !== id; }).map(function (row) {
      return String(row.text || '');
    }).join('');
  }

  function adoptSections(rows) {
    var prior = {};
    var flow = window.SongFlow;
    pageSections.forEach(function (row) { prior[row.id] = row; });
    return (rows || []).map(function (row) {
      var old = prior[row.id] || {};
      var text = String(row.text == null ? (old.text || '') : row.text);
      var marks = flow && flow.normalizeMarks ? flow.normalizeMarks(old.text || '', old.marks || '') : '';
      if (text !== String(old.text || '') && flow && flow.retagMarks) marks = flow.retagMarks(old.text || '', marks, text);
      if (flow && flow.normalizeMarks) marks = flow.normalizeMarks(text, marks);
      return {
        id: String(row.id || ''),
        kind: String(row.kind || old.kind || 'verse'),
        label: String(row.label || old.label || 'Verse'),
        text: text,
        marks: marks,
        undo: old.undo || null,
        lastAngle: old.lastAngle || '',
        asked: Array.isArray(old.asked) ? old.asked.slice(0, 12) : [],
        question: old.question || '',
      };
    });
  }

  function freshSections(rows) {
    var flow = window.SongFlow;
    return (rows || []).map(function (row) {
      var text = String(row.text || '');
      return {
        id: String(row.id || ''),
        kind: String(row.kind || 'verse'),
        label: String(row.label || 'Verse'),
        text: text,
        marks: flow && flow.normalizeMarks ? flow.normalizeMarks(text, 'u') : '',
        undo: null,
        lastAngle: '',
        asked: [],
        question: '',
      };
    });
  }

  function partError(id, message) {
    var el = partNode('data-part-error', id);
    if (!el) {
      pageError(message);
      return;
    }
    el.textContent = message || '';
    el.hidden = !message;
  }

  function paintHumanMeter() {
    var flow = window.SongFlow;
    if (!flow || !flow.humanMeter || !flow.sectionBody) return;
    var meter = flow.humanMeter(flow.humanText ? flow.humanText(pageSections) : flow.sectionBody(pageSections));
    var total = flow.sectionTotal ? flow.sectionTotal(pageSections) : meter.count;
    var guide = flow.nextGuide ? flow.nextGuide(pageSections) : null;
    var host = $('sh-meter');
    if (host) {
      host.classList.toggle('is-full', meter.band === 'full');
      host.setAttribute('aria-valuenow', String(Math.min(meter.count, meter.max)));
      host.setAttribute('aria-valuetext', guide ? (meter.line + ' ' + guide.line) : meter.line);
    }
    var label = $('sh-meter-label');
    if (label) label.textContent = meter.label;
    var count = $('sh-meter-count');
    if (count) {
      count.textContent = meter.count + ' / ' + meter.max;
      count.classList.toggle('is-near', meter.count >= (flow.STORY_NEAR || 2700) || total >= (flow.STORY_NEAR || 2700));
    }
    var line = $('sh-meter-line');
    if (line) line.textContent = meter.line;
    var next = $('sh-meter-next');
    if (next && guide) next.textContent = guide.line;
    var note = $('sh-meter-note');
    if (note) note.textContent = meter.note;
    var fill = $('sh-meter-fill');
    if (fill) fill.style.width = Math.min(100, Math.round((Math.min(meter.count, meter.max) / meter.max) * 100)) + '%';
    if (window.SongHelperPage && window.SongHelperPage.lyricsOpen && window.SongHelperPage.lyricsOpen()) paintCleanLyrics();
  }

  function paintCleanLyrics() {
    var ready = $('sh-page-ready');
    var clean = $('sh-page-clean');
    var note = $('sh-page-ready-note');
    var flow = window.SongFlow;
    if (!ready || !clean || !flow || !flow.cleanPageLyrics || !flow.sectionText) return;
    var joined = flow.sectionText(pageSections);
    var cleaned = flow.cleanPageLyrics(joined);
    clean.textContent = cleaned;
    var same = cleaned === joined.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
    if (note) {
      note.textContent = same
        ? 'Your lyrics are ready. Nothing was rewritten.'
        : 'Your lyrics, with extra blank lines folded up. Every word is still yours.';
    }
  }

  function persistPage() {
    storyPatch({
      page: {
        sections: pageSections.map(function (row) {
          return {
            id: row.id,
            kind: row.kind,
            label: row.label,
            text: row.text,
            marks: row.marks || '',
            undo: row.undo ? { text: row.undo.text || '', marks: row.undo.marks || '' } : null,
            lastAngle: row.lastAngle || '',
            asked: (row.asked || []).slice(0, 12),
            question: row.question || '',
          };
        }),
        lyrics: !!(window.SongHelperPage && window.SongHelperPage.lyricsOpen && window.SongHelperPage.lyricsOpen()),
        open: !!storyBox,
      },
    });
  }

  function syncPartCount(id) {
    var row = findPart(id);
    var count = partNode('data-count', id);
    if (count && row) {
      var full = String(row.text || '').length;
      var owned = window.SongFlow && window.SongFlow.ownedLength ? window.SongFlow.ownedLength(row) : full;
      count.textContent = owned === full
        ? (full + ' characters')
        : (full + ' characters. ' + owned + ' count toward the meter.');
    }
  }

  function bindPartInput(area, id) {
    var flow = window.SongFlow;
    function nextValue(start, end, insert) {
      return area.value.slice(0, start) + String(insert == null ? '' : insert) + area.value.slice(end);
    }
    function reject(message) {
      var caret = area.selectionStart;
      var row = findPart(id);
      var keep = row ? row.text : '';
      area.value = keep;
      try {
        var at = Math.min(typeof caret === 'number' ? caret : keep.length, keep.length);
        area.setSelectionRange(at, at);
      } catch (err) {}
      pageError(message || (flow && flow.TOO_LONG) || '');
    }
    area.addEventListener('beforeinput', function (event) {
      if (!flow || !flow.proposeSectionText) return;
      var type = event.inputType || '';
      if (type === 'insertFromPaste' || type.indexOf('insert') !== 0) return;
      var data = event.data;
      if (data == null && type === 'insertLineBreak') data = '\n';
      if (data == null) return;
      var verdict = flow.proposeSectionText(pageSections, id, nextValue(area.selectionStart, area.selectionEnd, data));
      if (!verdict.ok) {
        event.preventDefault();
        pageError(verdict.message);
      }
    });
    area.addEventListener('paste', function (event) {
      if (!flow || !flow.proposeSectionText) return;
      var text = event.clipboardData ? event.clipboardData.getData('text') : '';
      var parsed = flow.splitLyrics ? flow.splitLyrics(text) : null;
      if (parsed && parsed.length >= 2) {
        event.preventDefault();
        if (flow.sectionTotal(parsed) > storyMax()) {
          pageError(flow.TOO_LONG || '');
          return;
        }
        pageSections = freshSections(parsed);
        renderSections();
        pageError('');
        paintHumanMeter();
        persistPage();
        return;
      }
      var verdict = flow.proposeSectionText(pageSections, id, nextValue(area.selectionStart, area.selectionEnd, text));
      if (!verdict.ok) {
        event.preventDefault();
        pageError(verdict.message);
      }
    });
    area.addEventListener('input', function () {
      if (!flow || !flow.proposeSectionText) return;
      var verdict = flow.proposeSectionText(pageSections, id, area.value);
      if (!verdict.ok) {
        reject(verdict.message);
        return;
      }
      pageSections = adoptSections(verdict.sections);
      pageError('');
      partError(id, '');
      syncPartCount(id);
      paintHumanMeter();
      persistPage();
    });
  }

  function fillAskPanel(panel, id, question, notice) {
    panel.hidden = false;
    panel.textContent = '';
    var q = document.createElement('p');
    q.className = 'sh-q';
    q.textContent = question || '';
    var note = document.createElement('p');
    note.className = 'sh-help';
    note.textContent = notice || 'Answer in your own words. Adding it counts toward the meter.';
    var field = document.createElement('label');
    field.className = 'sh-field';
    var span = document.createElement('span');
    span.textContent = 'Your answer';
    var answer = document.createElement('textarea');
    answer.className = 'sh-area';
    answer.rows = 4;
    answer.placeholder = 'Your words. They get added to this part when you tap the button.';
    field.appendChild(span);
    field.appendChild(answer);
    var actions = document.createElement('div');
    actions.className = 'sh-side-actions';
    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn btn-purple btn-md';
    add.textContent = 'Add this to this part';
    add.addEventListener('click', function () { appendAnswer(id, answer); });
    actions.appendChild(add);
    panel.appendChild(q);
    panel.appendChild(note);
    panel.appendChild(field);
    panel.appendChild(actions);
  }

  function renderSections() {
    var host = $('sh-page-sections');
    if (!host) return;
    host.textContent = '';
    pageSections.forEach(function (row) {
      var article = document.createElement('article');
      article.className = 'sh-part';
      article.setAttribute('data-id', row.id);
      var head = document.createElement('div');
      head.className = 'sh-part-head';
      var title = document.createElement('h3');
      title.textContent = row.label;
      var ai = document.createElement('p');
      ai.className = 'sh-ai-label';
      ai.setAttribute('data-ai', row.id);
      ai.textContent = 'AI-assisted';
      ai.hidden = String(row.marks || '').indexOf('a') === -1;
      head.appendChild(title);
      head.appendChild(ai);
      var area = document.createElement('textarea');
      area.className = 'sh-area sh-part-box';
      area.rows = 5;
      area.setAttribute('data-part-text', row.id);
      area.setAttribute('aria-label', row.label);
      area.value = row.text || '';
      area.placeholder = 'Write ' + row.label + ' in your own words.';
      var count = document.createElement('p');
      count.className = 'sh-help sh-part-count';
      count.setAttribute('data-count', row.id);
      count.textContent = String(area.value.length) + ' characters';
      var toggles = document.createElement('div');
      toggles.className = 'sh-edit-toggles';
      toggles.setAttribute('role', 'group');
      toggles.setAttribute('aria-label', 'Edits for ' + row.label);
      [
        ['Extend', function (button) { rewriteSection(row.id, 'extend', button); }],
        ['Shorten', function (button) { rewriteSection(row.id, 'shorten', button); }],
        ['Remove', function () { removePart(row.id); }],
        ['Add section', function () { addPartAfter(row.id); }],
        ['Rhymify', function (button) { rewriteSection(row.id, 'rhymify', button); }],
      ].forEach(function (item) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-ghost btn-md sh-toggle';
        button.textContent = item[0];
        button.addEventListener('click', function () { item[1](button); });
        toggles.appendChild(button);
      });
      var undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'btn btn-ghost btn-md sh-undo';
      undo.textContent = 'Undo';
      undo.hidden = !row.undo;
      undo.setAttribute('data-undo', row.id);
      undo.addEventListener('click', function () { undoPart(row.id); });
      var actions = document.createElement('div');
      actions.className = 'sh-side-actions';
      var askBtn = document.createElement('button');
      askBtn.type = 'button';
      askBtn.className = 'btn btn-purple btn-md';
      askBtn.textContent = 'Ask me a question';
      askBtn.addEventListener('click', function () { askSection(row.id, askBtn); });
      var suggestBtn = document.createElement('button');
      suggestBtn.type = 'button';
      suggestBtn.className = 'btn btn-ghost btn-md';
      suggestBtn.textContent = 'Give me a suggestion';
      suggestBtn.addEventListener('click', function () { suggestSection(row.id, suggestBtn); });
      actions.appendChild(askBtn);
      actions.appendChild(suggestBtn);
      var askPanel = document.createElement('div');
      askPanel.className = 'sh-part-ask';
      askPanel.hidden = !row.question;
      askPanel.setAttribute('data-ask', row.id);
      var suggestPanel = document.createElement('div');
      suggestPanel.className = 'sh-part-suggest';
      suggestPanel.hidden = true;
      suggestPanel.setAttribute('data-suggest', row.id);
      var rewritePanel = document.createElement('div');
      rewritePanel.className = 'sh-rewrite';
      rewritePanel.hidden = true;
      rewritePanel.setAttribute('data-rewrite', row.id);
      var err = document.createElement('p');
      err.className = 'sh-form-error';
      err.setAttribute('role', 'alert');
      err.hidden = true;
      err.setAttribute('data-part-error', row.id);
      article.appendChild(head);
      article.appendChild(area);
      article.appendChild(count);
      article.appendChild(toggles);
      article.appendChild(undo);
      article.appendChild(actions);
      article.appendChild(askPanel);
      article.appendChild(suggestPanel);
      article.appendChild(rewritePanel);
      article.appendChild(err);
      host.appendChild(article);
      bindPartInput(area, row.id);
      syncPartCount(row.id);
      if (row.question) fillAskPanel(askPanel, row.id, row.question, 'Answer in your own words. Adding it counts toward the meter.');
    });
  }

  function bootWriteFirst() {
    var host = $('sh-page-sections');
    var lyricsBtn = $('sh-page-lyrics');
    var pageBtn = $('sh-choice-page');
    var addVerse = $('sh-add-verse');
    var addOutro = $('sh-add-outro');
    var flow = window.SongFlow;
    if (!host || !flow || !flow.blankSections) return;
    pageSections = flow.blankSections();
    var saved = {};
    try {
      saved = (JSON.parse(localStorage.getItem('plaiground.songHelper.story') || '{}') || {}).page || {};
    } catch (err) { saved = {}; }
    if (Array.isArray(saved.sections) && saved.sections.length) {
      var restored = saved.sections.map(function (row) {
        return {
          id: String(row && row.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 24),
          kind: String(row && row.kind || 'verse'),
          label: String(row && row.label || 'Verse').replace(/\s+/g, ' ').trim().slice(0, 40),
          text: String(row && row.text || ''),
          marks: String(row && row.marks || ''),
          undo: row && row.undo && typeof row.undo === 'object' ? {
            text: String(row.undo.text || ''),
            marks: String(row.undo.marks || ''),
          } : null,
          lastAngle: String(row && row.lastAngle || '').replace(/[^a-z]/g, '').slice(0, 16),
          asked: Array.isArray(row && row.asked) ? row.asked.map(function (item) { return String(item || ''); }).filter(Boolean).slice(0, 12) : [],
          question: String(row && row.question || ''),
        };
      }).filter(function (row) { return row.id && row.label; });
      restored.forEach(function (row) {
        if (flow.normalizeMarks) row.marks = flow.normalizeMarks(row.text, row.marks);
        if (row.undo && flow.normalizeMarks) row.undo.marks = flow.normalizeMarks(row.undo.text, row.undo.marks);
      });
      if (flow.sectionTotal(restored) > storyMax()) pageError(flow.TOO_LONG || '');
      else if (restored.length) pageSections = restored;
    } else if (saved.text) {
      var legacy = String(saved.text);
      if (legacy.length > storyMax()) pageError(flow.TOO_LONG || '');
      else if (legacy) pageSections[0].text = legacy;
    }
    renderSections();
    paintHumanMeter();
    var anyText = pageSections.some(function (row) { return String(row.text || '').trim(); });
    if (saved.open || saved.lyrics || anyText) setStoryBox(true, { keep: true, quiet: true });
    if (pageBtn) pageBtn.addEventListener('click', function () { setStoryBox(true); });
    if (addVerse) {
      addVerse.addEventListener('click', function () {
        pageSections = adoptSections(flow.addSection(pageSections, 'verse'));
        renderSections();
        persistPage();
        var last = host.lastElementChild;
        if (last && last.scrollIntoView) {
          try { last.scrollIntoView({ block: 'nearest' }); } catch (err) {}
        }
      });
    }
    if (addOutro) {
      addOutro.addEventListener('click', function () {
        var before = pageSections.length;
        pageSections = adoptSections(flow.addSection(pageSections, 'outro'));
        renderSections();
        persistPage();
        if (pageSections.length === before) pageError('An outro is already on the page.');
        else pageError('');
      });
    }
    if (lyricsBtn) lyricsBtn.addEventListener('click', function () { openLyricsPath(); });
    var acceptFormat = $('sh-format-accept');
    var keepFormat = $('sh-format-keep');
    var polishFormat = $('sh-format-polish');
    if (acceptFormat) acceptFormat.addEventListener('click', function () { acceptFormatStructure(); });
    if (keepFormat) keepFormat.addEventListener('click', function () { keepPastedLyrics(); });
    if (polishFormat) polishFormat.addEventListener('click', function () { polishFormatLabels(polishFormat); });
    if (saved.lyrics && anyText && window.SongHelperPage && window.SongHelperPage.openFinishedLyrics) finishLyrics();
  }

  function addPartAfter(id) {
    var flow = window.SongFlow;
    if (!flow || !flow.insertSection) return;
    pageSections = adoptSections(flow.insertSection(pageSections, id));
    pageError('');
    renderSections();
    paintHumanMeter();
    persistPage();
  }

  function paintPartChrome(id) {
    var row = findPart(id);
    if (!row) return;
    var ai = partNode('data-ai', id);
    if (ai) ai.hidden = String(row.marks || '').indexOf('a') === -1;
    var undo = partNode('data-undo', id);
    if (undo) undo.hidden = !row.undo;
    syncPartCount(id);
    var area = partNode('data-part-text', id);
    if (area && area.value !== row.text) area.value = row.text;
  }

  function commitPreview(id, nextText, kind, edited) {
    var flow = window.SongFlow;
    var row = findPart(id);
    if (!flow || !flow.proposeSectionText || !flow.previewMarks || !row) return;
    var before = String(row.text || '');
    var beforeMarks = flow.normalizeMarks(before, row.marks || '');
    var verdict = flow.proposeSectionText(pageSections, id, nextText);
    if (!verdict.ok) {
      pageError(verdict.message || flow.TOO_LONG || '');
      return;
    }
    row.text = String(nextText || '');
    row.marks = flow.previewMarks(kind, before, beforeMarks, row.text, !!edited);
    row.undo = { text: before, marks: beforeMarks };
    pageError('');
    partError(id, '');
    var panel = partNode('data-rewrite', id);
    if (panel) {
      panel.hidden = true;
      panel.textContent = '';
    }
    paintPartChrome(id);
    paintHumanMeter();
    persistPage();
  }

  function undoPart(id) {
    var flow = window.SongFlow;
    var row = findPart(id);
    if (!row || !row.undo) return;
    var next = String(row.undo.text || '');
    var marks = flow && flow.normalizeMarks ? flow.normalizeMarks(next, row.undo.marks || '') : '';
    var verdict = flow.proposeSectionText(pageSections, id, next);
    if (!verdict.ok) {
      pageError(verdict.message || flow.TOO_LONG || '');
      return;
    }
    row.text = next;
    row.marks = marks;
    row.undo = null;
    pageError('');
    paintPartChrome(id);
    paintHumanMeter();
    persistPage();
  }

  function showRewrite(id, kind, nextText, notice) {
    var row = findPart(id);
    var panel = partNode('data-rewrite', id);
    if (!row || !panel) return;
    var offered = String(nextText || '');
    if (!offered || offered === String(row.text || '')) {
      partError(id, kind === 'shorten'
        ? 'This part is already short. Your words stayed.'
        : 'Nothing new to show. Your words stayed.');
      return;
    }
    panel.hidden = false;
    panel.textContent = '';
    var grid = document.createElement('div');
    grid.className = 'sh-preview-grid';
    var mineWrap = document.createElement('div');
    var mineLabel = document.createElement('p');
    mineLabel.className = 'sh-help';
    mineLabel.textContent = 'Yours';
    var mine = document.createElement('pre');
    mine.className = 'sh-preview-mine';
    mine.textContent = row.text || '';
    mineWrap.appendChild(mineLabel);
    mineWrap.appendChild(mine);
    var altWrap = document.createElement('div');
    var altLabel = document.createElement('p');
    altLabel.className = 'sh-ai-label';
    altLabel.textContent = 'AI-assisted';
    var edit = document.createElement('textarea');
    edit.className = 'sh-area sh-preview-edit';
    edit.rows = 5;
    edit.value = offered;
    edit.setAttribute('aria-label', 'AI-assisted ' + (row.label || 'part'));
    altWrap.appendChild(altLabel);
    altWrap.appendChild(edit);
    grid.appendChild(mineWrap);
    grid.appendChild(altWrap);
    var note = document.createElement('p');
    note.className = 'sh-help';
    note.textContent = notice || 'Nothing changes until you tap Accept. Keep mine leaves your words. Edit counts toward the meter.';
    var actions = document.createElement('div');
    actions.className = 'sh-side-actions';
    var accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'btn btn-purple btn-md';
    accept.textContent = 'Accept';
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-ghost btn-md';
    editBtn.textContent = 'Edit';
    var keep = document.createElement('button');
    keep.type = 'button';
    keep.className = 'btn btn-ghost btn-md';
    keep.textContent = 'Keep mine';
    var baseline = offered;
    accept.addEventListener('click', function () {
      commitPreview(id, edit.value, kind, edit.value !== baseline);
    });
    editBtn.addEventListener('click', function () {
      commitPreview(id, edit.value, kind, true);
    });
    keep.addEventListener('click', function () {
      panel.hidden = true;
      panel.textContent = '';
      var area = partNode('data-part-text', id);
      var current = findPart(id);
      if (area && current && area.value !== current.text) area.value = current.text;
    });
    actions.appendChild(accept);
    actions.appendChild(editBtn);
    actions.appendChild(keep);
    panel.appendChild(grid);
    panel.appendChild(note);
    panel.appendChild(actions);
    if (panel.scrollIntoView) {
      try { panel.scrollIntoView({ block: 'nearest' }); } catch (err) {}
    }
  }

  function localRewrite(kind, label, text) {
    var core = window.SongHelperCore;
    if (!core) return text;
    if (kind === 'shorten' && core.shortenFallback) return core.shortenFallback(text);
    if (kind === 'rhymify' && core.rhymifyFallback) return core.rhymifyFallback(label, text);
    if (core.extendFallback) return core.extendFallback(label, text);
    return text;
  }

  function rewriteSection(id, kind, button) {
    var row = findPart(id);
    if (!row) return;
    var text = String(row.text || '');
    if (!text.trim()) {
      partError(id, 'Write a little in this part first.');
      return;
    }
    partError(id, '');
    pageError('');
    var before = text;
    var fallback = localRewrite(kind, row.label, text);
    if (button) button.disabled = true;
    fetch('/api/song-helper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: kind,
        section: row.label,
        text: text,
        others: otherBody(id),
      }),
    }).then(function (response) {
      return response.json().then(function (data) { return { ok: response.ok, data: data }; }).catch(function () { return { ok: false, data: null }; });
    }).then(function (result) {
      var current = findPart(id);
      if (!current || current.text !== before) return;
      var data = result && result.data;
      var next = data && data.text ? String(data.text) : '';
      var notice = data && data.notice ? String(data.notice) : '';
      if (!next || !result || !result.ok) {
        next = fallback;
        notice = notice || 'Nothing changes until you tap Accept. Keep mine leaves your words.';
      }
      var area = partNode('data-part-text', id);
      if (area && area.value !== before) return;
      showRewrite(id, kind, next, notice);
    }).catch(function () {
      var current = findPart(id);
      if (!current || current.text !== before) return;
      showRewrite(id, kind, fallback, 'Nothing changes until you tap Accept. Keep mine leaves your words.');
    }).then(function () {
      if (button) button.disabled = false;
    });
  }

  function removePart(id) {
    var flow = window.SongFlow;
    if (!flow || !flow.removeSection) return;
    var verdict = flow.removeSection(pageSections, id);
    if (!verdict.ok) {
      partError(id, verdict.message || '');
      return;
    }
    pageSections = adoptSections(verdict.sections);
    pageError('');
    renderSections();
    paintHumanMeter();
    persistPage();
  }

  function askSection(id, button) {
    var row = findPart(id);
    var core = window.SongHelperCore;
    if (!row) return;
    var text = String(row.text || '');
    var others = otherBody(id);
    if (!text.trim() && !others.trim()) {
      partError(id, 'Write a little in this part first. Then I can ask about what you wrote.');
      return;
    }
    partError(id, '');
    pageError('');
    var state = { lastAngle: row.lastAngle || '', asked: (row.asked || []).slice(0, 12) };
    var context = [text.trim(), others.trim()].filter(Boolean).join('\n');
    var plan = core && core.askPlan ? core.askPlan(context, state) : { angle: 'feeling', question: 'How do you feel about this?' };
    var fallback = core && core.sectionQuestion ? core.sectionQuestion(row.label, plan.angle, context) : plan.question;
    if (button) button.disabled = true;
    fetch('/api/song-helper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ask',
        section: row.label,
        text: text,
        others: others,
        lastAngle: state.lastAngle,
        asked: state.asked,
      }),
    }).then(function (response) {
      return response.json().then(function (data) { return { ok: response.ok, data: data }; }).catch(function () { return { ok: false, data: null }; });
    }).then(function (result) {
      var data = result && result.data;
      var question = data && data.question ? String(data.question) : '';
      var angle = data && data.angle ? String(data.angle) : plan.angle;
      var notice = data && data.notice ? String(data.notice) : '';
      if (!question || !result || !result.ok) {
        question = fallback;
        angle = plan.angle;
        notice = notice || 'This question comes from what you wrote. The writer did not answer, so this is a backup question.';
      }
      if (angle && angle === row.lastAngle && core && core.askPlan && core.sectionQuestion) {
        var fresh = core.askPlan(context, state);
        question = core.sectionQuestion(row.label, fresh.angle, context);
        angle = fresh.angle;
      }
      showPartQuestion(id, question, notice, angle);
    }).catch(function () {
      showPartQuestion(id, fallback, 'This question comes from what you wrote. The writer did not answer, so this is a backup question.', plan.angle);
    }).then(function () {
      if (button) button.disabled = false;
    });
  }

  function showPartQuestion(id, question, notice, angle) {
    var row = findPart(id);
    var text = String(question || '').trim();
    if (row) {
      if (text && (row.asked || []).indexOf(text) === -1) row.asked = (row.asked || []).concat([text]).slice(-12);
      row.lastAngle = angle || '';
      row.question = text;
    }
    var panel = partNode('data-ask', id);
    if (panel) fillAskPanel(panel, id, text, notice);
    persistPage();
    if (panel && panel.scrollIntoView) {
      try { panel.scrollIntoView({ block: 'nearest' }); } catch (err) {}
    }
  }

  function appendAnswer(id, answer) {
    var flow = window.SongFlow;
    var row = findPart(id);
    if (!flow || !flow.applySuggestion || !row || !answer) return;
    if (!String(answer.value || '').trim()) {
      partError(id, flow.ANSWER_EMPTY || 'Write an answer first. It stays out of the song until you add it.');
      return;
    }
    var verdict = flow.applySuggestion(pageSections, id, answer.value);
    if (!verdict.ok) {
      pageError(verdict.message || (flow.TOO_LONG || ''));
      return;
    }
    pageSections = adoptSections(verdict.sections);
    answer.value = '';
    pageError('');
    partError(id, '');
    var area = partNode('data-part-text', id);
    var next = findPart(id);
    if (area && next) area.value = next.text;
    syncPartCount(id);
    paintHumanMeter();
    persistPage();
  }

  function suggestSection(id, button) {
    var row = findPart(id);
    var core = window.SongHelperCore;
    if (!row) return;
    var text = String(row.text || '');
    var others = otherBody(id);
    if (!text.trim() && !others.trim()) {
      partError(id, 'Write a little in this part first. Then I can offer a line.');
      return;
    }
    partError(id, '');
    pageError('');
    var before = text;
    var fallback = core && core.suggestFallback ? core.suggestFallback(row.label, text, others) : [];
    if (button) button.disabled = true;
    fetch('/api/song-helper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'suggest',
        section: row.label,
        text: text,
        others: others,
      }),
    }).then(function (response) {
      return response.json().then(function (data) { return { ok: response.ok, data: data }; }).catch(function () { return { ok: false, data: null }; });
    }).then(function (result) {
      var data = result && result.data;
      var options = data && Array.isArray(data.options) ? data.options : [];
      var notice = data && data.notice ? String(data.notice) : '';
      if (!options.length || !result || !result.ok) {
        options = fallback;
        notice = notice || 'These are backup lines from what you wrote. Nothing is added until you tap Use this.';
      }
      var current = findPart(id);
      if (current && current.text !== before) return;
      showSuggestions(id, options, notice);
    }).catch(function () {
      showSuggestions(id, fallback, 'These are backup lines from what you wrote. Nothing is added until you tap Use this.');
    }).then(function () {
      if (button) button.disabled = false;
    });
  }

  function showSuggestions(id, options, notice) {
    var panel = partNode('data-suggest', id);
    if (!panel) return;
    panel.hidden = false;
    panel.textContent = '';
    var note = document.createElement('p');
    note.className = 'sh-help';
    note.textContent = 'These are options. Nothing is added until you tap Use this. You can edit a line first, or skip it.';
    if (notice) {
      var extra = document.createElement('p');
      extra.className = 'sh-help';
      extra.textContent = notice;
      panel.appendChild(extra);
    }
    panel.appendChild(note);
    (options || []).forEach(function (line) {
      var wrap = document.createElement('div');
      wrap.className = 'sh-suggest-option';
      var edit = document.createElement('textarea');
      edit.className = 'sh-area sh-suggest-edit';
      edit.rows = 2;
      edit.value = String(line || '');
      var actions = document.createElement('div');
      actions.className = 'sh-side-actions';
      var use = document.createElement('button');
      use.type = 'button';
      use.className = 'btn btn-purple btn-md';
      use.textContent = 'Use this';
      use.addEventListener('click', function () { useSuggestion(id, edit.value); });
      var skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'btn btn-ghost btn-md';
      skip.textContent = 'Skip';
      skip.addEventListener('click', function () { wrap.remove(); });
      actions.appendChild(use);
      actions.appendChild(skip);
      wrap.appendChild(edit);
      wrap.appendChild(actions);
      panel.appendChild(wrap);
    });
  }

  function useSuggestion(id, line) {
    var flow = window.SongFlow;
    if (!flow || !flow.applySuggestion) return;
    var verdict = flow.applySuggestion(pageSections, id, line);
    if (!verdict.ok) {
      pageError(verdict.message || (flow.TOO_LONG || ''));
      return;
    }
    pageSections = adoptSections(verdict.sections);
    pageError('');
    partError(id, '');
    var area = partNode('data-part-text', id);
    var next = findPart(id);
    if (area && next) area.value = next.text;
    syncPartCount(id);
    paintHumanMeter();
    persistPage();
  }

  function lyricsSource() {
    var filled = pageSections.filter(function (row) { return String(row.text || '').trim(); });
    if (!filled.length) return '';
    if (filled.length === 1) return String(filled[0].text || '');
    return filled.map(function (row) { return String(row.text || '').trim(); }).join('\n\n');
  }

  function hideFormat() {
    var panel = $('sh-format');
    if (panel) panel.hidden = true;
  }

  function renderFormat() {
    var flow = window.SongFlow;
    var panel = $('sh-format');
    var notes = $('sh-format-notes');
    var host = $('sh-format-parts');
    if (!panel || !host || !formatState) return;
    panel.hidden = false;
    if (notes) {
      notes.textContent = '';
      (formatState.notes || []).forEach(function (line) {
        var p = document.createElement('p');
        p.className = 'sh-help sh-format-note';
        p.textContent = line;
        notes.appendChild(p);
      });
    }
    host.textContent = '';
    var choices = [
      ['verse', 'Verse'],
      ['hook', 'Hook'],
      ['prechorus', 'Pre-chorus'],
      ['bridge', 'Bridge'],
      ['outro', 'Outro'],
    ];
    (formatState.sections || []).forEach(function (row, index) {
      var card = document.createElement('article');
      card.className = 'sh-format-part';
      card.setAttribute('data-format-id', row.id);
      var label = document.createElement('label');
      label.className = 'sh-field';
      var span = document.createElement('span');
      span.textContent = 'Label';
      var select = document.createElement('select');
      select.setAttribute('aria-label', 'Label for part ' + (index + 1));
      choices.forEach(function (choice) {
        var option = document.createElement('option');
        option.value = choice[0];
        option.textContent = choice[1];
        if (choice[0] === row.kind) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener('change', function () {
        formatState.sections = flow.relabelFormat(formatState.sections, row.id, select.value);
        renderFormat();
      });
      label.appendChild(span);
      label.appendChild(select);
      var body = document.createElement('pre');
      body.textContent = row.text || '';
      var moves = document.createElement('div');
      moves.className = 'sh-format-moves';
      function small(text, fn) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-ghost btn-md';
        button.textContent = text;
        button.addEventListener('click', fn);
        moves.appendChild(button);
      }
      small('Move up', function () {
        formatState.sections = flow.moveFormat(formatState.sections, row.id, -1);
        renderFormat();
      });
      small('Move down', function () {
        formatState.sections = flow.moveFormat(formatState.sections, row.id, 1);
        renderFormat();
      });
      small('Merge with next', function () {
        var verdict = flow.mergeFormat(formatState.sections, row.id);
        if (!verdict.ok) {
          pageError(verdict.message || '');
          return;
        }
        pageError('');
        formatState.sections = verdict.sections;
        renderFormat();
      });
      card.appendChild(label);
      card.appendChild(body);
      card.appendChild(moves);
      host.appendChild(card);
    });
  }

  function openLyricsPath() {
    var flow = window.SongFlow;
    if (!flow || !flow.formatSong) return;
    var text = lyricsSource();
    if (!text.trim()) {
      pageError('Paste your lyrics into the parts first.');
      return;
    }
    if (text.length > storyMax()) {
      pageError(flow.TOO_LONG || '');
      return;
    }
    var proposal = flow.formatSong(text);
    if (!flow.sameWords(text, proposal.sections)) {
      pageError('Those labels would change your words, so they stayed as you pasted them.');
      return;
    }
    formatState = { original: text, sections: proposal.sections, notes: proposal.notes || [] };
    pageError('');
    renderFormat();
    var panel = $('sh-format');
    if (panel && panel.scrollIntoView) {
      try { panel.scrollIntoView({ block: 'nearest' }); } catch (err) {}
    }
  }

  function acceptFormatStructure() {
    var flow = window.SongFlow;
    if (!formatState || !flow) return;
    if (!flow.sameWordBag(formatState.original, formatState.sections)) {
      pageError('Those labels would change your words, so they stayed as you pasted them.');
      return;
    }
    if (flow.sectionTotal(formatState.sections) > storyMax()) {
      pageError(flow.TOO_LONG || '');
      return;
    }
    pageSections = freshSections(formatState.sections);
    renderSections();
    hideFormat();
    finishLyrics();
  }

  function keepPastedLyrics() {
    hideFormat();
    pageError('');
    finishLyrics();
  }

  function polishFormatLabels(button) {
    var flow = window.SongFlow;
    if (!formatState || !flow) return;
    var before = formatState.sections.map(function (row) { return row.text; });
    if (button) button.disabled = true;
    fetch('/api/song-helper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'format',
        text: formatState.original,
        blocks: formatState.sections.map(function (row) { return { text: row.text }; }),
      }),
    }).then(function (response) {
      return response.json().then(function (data) { return { ok: response.ok, data: data }; }).catch(function () { return { ok: false, data: null }; });
    }).then(function (result) {
      var data = result && result.data;
      var next = data && Array.isArray(data.sections) ? data.sections : [];
      var texts = next.map(function (row) { return String(row.text || ''); });
      var same = texts.length === before.length && texts.every(function (line, index) { return line === before[index]; });
      if (!result || !result.ok || !same || !flow.sameWords(formatState.original, next)) {
        pageError('The polish kept your words as they are.');
        return;
      }
      formatState.sections = next.map(function (row) {
        return {
          id: String(row.id || ''),
          kind: String(row.kind || 'verse'),
          label: String(row.label || 'Verse'),
          text: String(row.text || ''),
          suggest: String(row.suggest || ''),
        };
      });
      if (data.notes) formatState.notes = data.notes;
      pageError('');
      renderFormat();
    }).catch(function () {
      pageError('Those labels stayed as they are. The polish did not come back.');
    }).then(function () {
      if (button) button.disabled = false;
    });
  }

  function applySoundLayout(hints) {
    var flow = window.SongFlow;
    if (!flow || !flow.layoutFromSounds) return { ok: false, note: 'The layout stays as it is.' };
    if (!pageSections.length && flow.blankSections) pageSections = flow.blankSections();
    function filled(rows) {
      return (rows || []).map(function (row) { return String(row.text || ''); }).filter(function (text) { return text.trim(); }).sort();
    }
    var before = filled(pageSections);
    var result = flow.layoutFromSounds(pageSections, hints || {});
    var after = filled(result.sections);
    if (before.join('\n') !== after.join('\n')) {
      return { ok: false, note: 'Those labels would change your words, so the boxes stayed.' };
    }
    pageSections = adoptSections(result.sections);
    renderSections();
    persistPage();
    return { ok: true, note: result.note || 'Layout updated. Your words stayed in their boxes.' };
  }

  function finishLyrics() {
    var ready = $('sh-page-ready');
    pageError('');
    paintCleanLyrics();
    paintHumanMeter();
    if (ready) ready.hidden = false;
    if (window.SongHelperPage && window.SongHelperPage.openFinishedLyrics) {
      window.SongHelperPage.openFinishedLyrics();
    }
    persistPage();
    if (ready && ready.scrollIntoView) {
      try { ready.scrollIntoView({ block: 'nearest' }); } catch (err) {}
    }
  }

  window.SongHelperV2 = {
    paintLog: paintLog,
    setMode: setMode,
    syncStructure: syncStructure,
    spark: function () { return sparkSeed; },
    ownIdea: ownIdea,
    snapshot: snapshot,
    setup: function () {
      return { making: making, amount: amount, tone: tone, theme: theme, method: mode, rapStyle: rapStyle };
    },
    repaint: paintBranch,
    kinds: function () { return kinds.slice(); },
    setRegion: function (value) {
      craft.region = value || '';
      chosenSlang = '';
      fillRegions();
      paintSlang();
    },
    region: function () { return craft.region || ''; },
    styleText: currentStyleText,
    pageText: function () {
      return window.SongFlow && window.SongFlow.sectionText ? window.SongFlow.sectionText(pageSections) : '';
    },
    pageSections: function () {
      return pageSections.map(function (row) {
        return { id: row.id, kind: row.kind, label: row.label, text: row.text };
      });
    },
    applySoundLayout: applySoundLayout,
  };
  bindCraft();
  paintOwn();
  paintModes();
  paintLog();
  applySparkPrompt();
  syncStructure();
  paintIdeaLane();
  var ideasBtn = $('sh-choice-ideas');
  var ownBtn = $('sh-choice-own');
  if (ideasBtn) ideasBtn.addEventListener('click', function () { setIdeaLane('ideas'); });
  if (ownBtn) ownBtn.addEventListener('click', function () { setIdeaLane('own'); });
  var scratchBtn = $('sh-choice-scratch');
  var sourceBtn = $('sh-choice-source');
  if (scratchBtn) scratchBtn.addEventListener('click', function () { setBranch('scratch'); });
  if (sourceBtn) sourceBtn.addEventListener('click', function () { setBranch('source'); });
  paintBranch();
  bootWriteFirst();
  paintStyleDesign();
  loadStatus();
  loadSlang();
  loadSpark();
}());
