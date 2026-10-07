(function () {
  var modes = window.SongModes;
  var slangCore = window.SlangCore;
  if (!modes || !document.getElementById('sh-modes')) return;

  var craft = {
    vocabulary: 'plain',
    imagery: 'concrete',
    rhyme: 'slant',
    eraSlang: 'now',
    wordplay: 'light',
    rabbit: true,
    region: '',
  };
  var mode = 'write';
  var kind = 'love';
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
  var sparkHeadline = '';
  var sparkDailyOpen = false;
  var sparkAsk = { feel: '', story: '', keep: '' };
  var sparkSeed = null;
  var seededAngle = '';
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
    var pressed = document.querySelector('#sh-feeling .sh-chip.on[data-group="mood"]');
    if (!pressed) return '';
    var value = pressed.getAttribute('data-value') || '';
    if (value === 'custom') {
      var input = $('sh-mood-input');
      return input ? String(input.value || '').trim().slice(0, 40) : '';
    }
    return String(value).slice(0, 40);
  }

  function payload() {
    rememberAsk();
    return {
      mode: mode,
      kind: kind,
      part: part,
      live: liveAnswers(),
      mood: readMood(),
      sparkTitle: sparkSeed && sparkSeed.title ? String(sparkSeed.title).slice(0, 80) : '',
      sparkAngle: sparkSeed && sparkSeed.angle ? String(sparkSeed.angle).slice(0, 280) : '',
      sparkFeel: sparkSeed && sparkSeed.feel ? String(sparkSeed.feel).slice(0, 280) : '',
      sparkStory: sparkSeed && sparkSeed.story ? String(sparkSeed.story).slice(0, 280) : '',
      sparkKeep: sparkSeed && sparkSeed.keep ? String(sparkSeed.keep).slice(0, 280) : '',
      place: fieldValue('place') || followExtra.place,
      object: fieldValue('object') || followExtra.object,
      quote: fieldValue('quote') || followExtra.quote,
      genre: fieldValue('genre'),
      title: fieldValue('title'),
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
    if (!host || !window.SongPass || mode === 'write') return;
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
      input.maxLength = 120;
      input.placeholder = ask.placeholder || '';
      input.setAttribute('data-follow', ask.id);
      label.appendChild(span);
      label.appendChild(input);
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
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip' + (item.id === mode ? ' on' : '');
      button.textContent = item.label;
      button.setAttribute('aria-pressed', item.id === mode ? 'true' : 'false');
      button.addEventListener('click', function () { setMode(item.id); });
      host.appendChild(button);
    });
  }

  function paintModes() {
    paintModeRow($('sh-modes'), 'create');
    paintModeRow($('sh-source-modes'), 'source');
    paintKinds();
    paintParts();
    paintLive();
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
    if (shell) shell.classList.toggle('is-v2', id !== 'write');
    var panel = $('sh-v2');
    panel.hidden = id === 'write';
    $('sh-v2-blurb').textContent = info.blurb;
    $('sh-v2-out').textContent = '';
    $('sh-v2-extra').textContent = '';
    $('sh-v2-error').hidden = true;
    if (live && live.mode !== id) resetLive();
    paintModes();
    paintFields();
    paintSlang();
    goLabel = id === 'parody' ? 'Check the parody' : (id === 'cover' ? 'Show the steps' : (id === 'hook' ? 'Write the hook' : (id === 'flip' ? 'Flip the draft' : (id === 'funkify' ? 'Funkify the draft' : 'Make the draft'))));
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
    else if (lyricsReady) go.textContent = 'Make my Suno style prompt';
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
    host.appendChild(label);
  }

  function paintFields() {
    var host = $('sh-v2-fields');
    host.textContent = '';
    var rabbit = craft.rabbit && mode !== 'review' && mode !== 'cover' && mode !== 'public-domain' && mode !== 'hook' && mode !== 'madlibs';
    if (rabbit) {
      addField(host, { id: 'place', label: 'A real place', placeholder: 'the kitchen at 2am' });
      addField(host, { id: 'object', label: 'An object you can touch', placeholder: 'a chipped mug' });
      addField(host, { id: 'quote', label: 'Something someone said', placeholder: 'we will figure it out' });
    }
    if (mode === 'hook') {
      addField(host, { id: 'line', label: 'The hook sentence', kind: 'area', placeholder: 'A full sentence you would actually sing.' });
      addField(host, { id: 'happened', label: 'What happened', kind: 'area', placeholder: 'One concrete sentence about what happened.' });
      addField(host, { id: 'why', label: 'Why it matters', kind: 'area', placeholder: 'One sentence about what changed.' });
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
    if (mode === 'funny') {
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
    if (mode === 'parody') {
      addField(host, { id: 'originalTitle', label: 'Original title' });
      addField(host, { id: 'title', label: 'Your title (not a look-alike)' });
      addField(host, { id: 'comment', label: 'What are you saying about the original?', kind: 'area' });
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
    if (mode === 'homage' || mode === 'superhero') addField(host, { id: 'name', label: mode === 'superhero' ? 'Your name, as the hero' : 'Who the tribute is for' });
    if (mode === 'bars') {
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
    if (mode === 'poem') {
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
        chosenSlang = row.word;
        openTip = openTip === row.word ? '' : row.word;
        paintSlang();
      });
      host.appendChild(button);
      host.appendChild(tip);
    });
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
        craft.region = value;
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
  }

  function ideaTopic() {
    var own = $('sh-own-idea');
    var text = own ? String(own.value || '').trim() : '';
    if (text) return text.slice(0, 120);
    if (sparkSeed && sparkSeed.angle) return String(sparkSeed.angle).slice(0, 120);
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
      mode: mode,
      mood: readMood(),
      topic: ideaTopic(),
      part: part,
    });
  }

  function touchLive() {
    if (!questions) return;
    if (!live || live.kind !== kind || live.mode !== mode || live.part !== part) {
      resetLive();
      return;
    }
    questions.sync(live, { mood: readMood(), topic: ideaTopic() });
  }

  function paintKinds() {
    var host = $('sh-kinds');
    if (!host || !questions) return;
    host.textContent = '';
    questions.KINDS.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip' + (item.id === kind ? ' on' : '');
      button.textContent = item.label;
      button.setAttribute('aria-pressed', item.id === kind ? 'true' : 'false');
      button.addEventListener('click', function () {
        kind = item.id;
        resetLive();
        paintKinds();
        paintLive();
      });
      host.appendChild(button);
    });
  }

  function paintParts() {
    var host = $('sh-parts');
    if (!host || !questions) return;
    host.textContent = '';
    questions.PARTS.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip' + (item.id === part ? ' on' : '');
      button.textContent = item.label;
      button.setAttribute('aria-pressed', item.id === part ? 'true' : 'false');
      button.addEventListener('click', function () { setPart(item.id); });
      host.appendChild(button);
    });
  }

  function setPart(id) {
    part = id || 'song';
    addingPart = part !== 'song';
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
    area.maxLength = 280;
    area.placeholder = 'One sentence. A hot topic can fill this in.';
    area.addEventListener('input', function () {
      touchLive();
      paintLive();
    });
    idea.appendChild(ideaSpan);
    idea.appendChild(area);
    host.appendChild(idea);
    questions.TOPIC_FOLLOWUPS.forEach(function (item) {
      var label = document.createElement('label');
      label.className = 'sh-field';
      var span = document.createElement('span');
      span.textContent = item.ask;
      var input = document.createElement('textarea');
      input.className = 'sh-area';
      input.rows = 2;
      input.maxLength = 280;
      input.placeholder = item.hint || '';
      input.setAttribute('data-spark-ask', item.id);
      label.appendChild(span);
      label.appendChild(input);
      host.appendChild(label);
    });
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
      if (!String(el.value || '').trim()) el.value = text;
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
      if (mode === 'write' && window.SongHelperPage && window.SongHelperPage.appendSection) {
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
    if (mode === 'write' && window.SongHelperPage && window.SongHelperPage.appendSection && window.SongHelperPage.appendSection(built.section)) {
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
      var meter = document.createElement('p');
      meter.className = 'sh-note';
      meter.textContent = modes.yoursPercent(lines) + '% yours. Human-written lines over all lines in this draft.';
      out.appendChild(meter);
      remember(draft, data);
      renderSuno(out, draft);
      lyricsReady = true;
    }
    paintV2Feedback();
    syncStructure();
    paintGo();
  }

  function collectV2Style() {
    return {
      genre: fieldValue('genre') || '',
      mood: readMood() || '',
      region: craft.region || '',
      energy: '',
      tempo: '',
      vocal: '',
      texture: '',
      instruments: [],
      era: ''
    };
  }

  function showV2StylePrompt(bag) {
    if (!window.SunoStyle) return;
    v2StyleBag = bag;
    v2StyleOpen = false;
    styleShown = true;
    var host = $('sh-v2-style');
    window.SunoStyle.renderPrompt(host, window.SunoStyle.prompt(bag, function (text) {
      return window.SongHelperCore && window.SongHelperCore.stripArtistNames ? window.SongHelperCore.stripArtistNames(text) : text;
    }), function (id) {
      showV2StylePrompt(window.SunoStyle.tweak(v2StyleBag, id));
    });
    paintGo();
    try { host.scrollIntoView({ block: 'center' }); } catch (err) {}
  }

  function startV2Style() {
    if (!window.SunoStyle) return;
    var bag = v2StyleBag || collectV2Style();
    var asks = window.SunoStyle.missing(bag);
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
          feedbackOn = {};
          feedbackOn[option.id] = true;
          feedbackNote = '';
          applyV2Feedback([option.id]);
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
    if (!host || !window.SongPass || !lastDraft || mode === 'write') return;
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
  }

  function renderLine(parent, part, row, index) {
    var box = document.createElement('textarea');
    box.className = 'sh-line' + (row.source === 'user' ? ' is-user' : '');
    box.rows = 2;
    box.value = row.text;
    box.addEventListener('input', function () {
      row.text = box.value;
      row.source = 'user';
      paint();
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
    button.textContent = 'Copy for Suno';
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
      yours: modes.yoursPercent(lines),
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
      empty.textContent = 'Dated drafts land here, with a % yours meter. Nothing is stored on a server.';
      host.appendChild(empty);
      return;
    }
    log.slice(0, 6).forEach(function (entry) {
      var p = document.createElement('p');
      p.className = 'sh-help';
      var when = String(entry.at || '').slice(0, 10);
      p.textContent = when + ' · ' + (entry.mode || 'write') + ' · ' + (entry.title || 'Untitled') + ' · ' + (entry.yours || 0) + '% yours'
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
    var prepared = modes.normalizeInput(body);
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
    var problem = modes.concreteError(modes.normalizeInput(body));
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
    return {
      title: titleEl && titleEl.value ? String(titleEl.value).trim().slice(0, 80) : String(draft.title || '').slice(0, 80),
      text: blocks.join('\n\n'),
      mode: mode || 'write',
      mood: readMood(),
      sparkTitle: sparkSeed && sparkSeed.title ? String(sparkSeed.title).slice(0, 80) : '',
      sparkAngle: sparkSeed && sparkSeed.angle ? String(sparkSeed.angle).slice(0, 280) : '',
      sparkFeel: sparkSeed && sparkSeed.feel ? String(sparkSeed.feel).slice(0, 280) : '',
      sparkStory: sparkSeed && sparkSeed.story ? String(sparkSeed.story).slice(0, 280) : '',
      sparkKeep: sparkSeed && sparkSeed.keep ? String(sparkSeed.keep).slice(0, 280) : '',
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
        craft[key] = button.getAttribute('data-value');
        document.querySelectorAll('[data-craft="' + key + '"]').forEach(function (peer) {
          var on = peer === button;
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
    if (mode === 'write' && window.SongHelperPage && window.SongHelperPage.draft) {
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
    if (mode === 'write') {
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
    var happenedValue = sparkSeed.angle.slice(0, 280);
    var quoteValue = sparkSeed.angle.slice(0, 160);
    function fill(el, next) {
      if (!el) return;
      var current = String(el.value || '').trim();
      if (!current || current === seededAngle || current === seededAngle.slice(0, next.length)) el.value = next;
    }
    fill($('sh-happened'), happenedValue);
    fill(document.querySelector('#sh-v2-fields [data-field="quote"]'), quoteValue);
    fill(document.querySelector('#sh-v2-fields [data-field="happened"]'), happenedValue);
    seededAngle = happenedValue;
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
    return value.slice(0, 280);
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
    ['sh-spark', 'sh-own'].forEach(function (id) {
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

  function chooseSpark(item, which) {
    if (!item) return;
    rememberAsk();
    var spark = window.SparkCore;
    var angle = which === 'flip'
      ? (item.flip || item.detail || item.title || '')
      : (item.detail || item.title || '');
    angle = String(angle || '').replace(/\s+/g, ' ').trim();
    if (!angle) return;
    if (spark && spark.tragedy(sparkText(item) + ' ' + angle)) return;
    var same = sparkSeed && sparkSeed.id && sparkSeed.id === item.id;
    if (!same) sparkAsk = { feel: '', story: '', keep: '' };
    if (item.feel != null) sparkAsk.feel = String(item.feel).slice(0, 280);
    if (item.story != null) sparkAsk.story = String(item.story).slice(0, 280);
    if (item.keep != null) sparkAsk.keep = String(item.keep).slice(0, 280);
    sparkSeed = {
      id: item.id || '',
      title: String(item.title || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      angle: angle.slice(0, 280),
      lane: item.lane || '',
      topic: item.topic || '',
      headline: item.headline || '',
      sourceLabel: item.sourceLabel || '',
      sourceUrl: item.sourceUrl || '',
      which: which === 'flip' ? 'flip' : 'spark',
      feel: sparkAsk.feel,
      story: sparkAsk.story,
      keep: sparkAsk.keep,
    };
    var ownIdea = $('sh-own-idea');
    if (ownIdea && !String(ownIdea.value || '').trim()) ownIdea.value = sparkSeed.angle;
    touchLive();
    paintLive();
    if (item.daily) sparkDailyOpen = true;
    if (item.topic) sparkTopic = item.topic;
    if (item.headline) sparkHeadline = item.headline;
    seedFields();
    paintSparkNote();
    if (sparkPack) paintSpark(sparkPack);
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
        sparkGroup = group.id;
        sparkNews = '';
        sparkTopic = '';
        sparkHeadline = '';
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
        sparkNews = '';
        sparkTopic = '';
        sparkHeadline = '';
        paintSpark();
      }));
      spark.LANES.filter(function (lane) { return lane.id.indexOf('news-') === 0; }).forEach(function (lane) {
        desks.appendChild(sparkChip(lane.label.replace(/^News · /, ''), sparkNews === lane.id, function () {
          rememberAsk();
          sparkNews = lane.id;
          sparkTopic = '';
          sparkHeadline = '';
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
        topicRow.appendChild(sparkChip(topic.label, sparkTopic === topic.label, function () {
          rememberAsk();
          sparkTopic = topic.label;
          sparkHeadline = '';
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
          sparkHeadline = row.label;
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
    area.maxLength = 280;
    area.setAttribute('data-spark-ask', key);
    if (hint) area.placeholder = hint;
    area.value = sparkAsk[key] || '';
    area.addEventListener('input', function () {
      sparkAsk[key] = askValue(area);
      if (sparkSeed) sparkSeed[key] = sparkAsk[key];
    });
    field.appendChild(span);
    field.appendChild(area);
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

  window.SongHelperV2 = {
    paintLog: paintLog,
    setMode: setMode,
    syncStructure: syncStructure,
    spark: function () { return sparkSeed; },
    snapshot: snapshot,
  };
  bindCraft();
  paintOwn();
  paintModes();
  paintLog();
  applySparkPrompt();
  syncStructure();
  loadStatus();
  loadSlang();
  loadSpark();
}());
