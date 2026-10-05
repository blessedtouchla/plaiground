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
  var slangRows = [];
  var showProfanity = false;
  var chosenSlang = '';
  var openTip = '';
  var lastDraft = null;
  var parodyAck = false;
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

  function payload() {
    return {
      mode: mode,
      place: fieldValue('place'),
      object: fieldValue('object'),
      quote: fieldValue('quote'),
      genre: fieldValue('genre'),
      title: fieldValue('title'),
      originalTitle: fieldValue('originalTitle'),
      comment: fieldValue('comment'),
      name: fieldValue('name'),
      lines: fieldValue('lines'),
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
    };
  }

  function paintModes() {
    var host = $('sh-modes');
    host.textContent = '';
    modes.MODES.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip' + (item.id === mode ? ' on' : '');
      button.textContent = item.label;
      button.setAttribute('aria-pressed', item.id === mode ? 'true' : 'false');
      button.addEventListener('click', function () { setMode(item.id); });
      host.appendChild(button);
    });
  }

  function setMode(id) {
    if (id === 'battle') {
      window.location.href = '/battle';
      return;
    }
    mode = id;
    parodyAck = false;
    undoStack = [];
    var info = modes.modeById(id);
    var shell = document.getElementById('sh-shell');
    if (shell) shell.classList.toggle('is-v2', id !== 'write');
    var panel = $('sh-v2');
    panel.hidden = id === 'write';
    $('sh-v2-blurb').textContent = info.blurb;
    $('sh-v2-out').textContent = '';
    $('sh-v2-extra').textContent = '';
    $('sh-v2-error').hidden = true;
    paintModes();
    paintFields();
    if (id === 'bars') paintSlang();
    var go = $('sh-v2-go');
    go.hidden = pageStatus.disabled;
    go.textContent = id === 'parody' ? 'Check the parody' : (id === 'cover' ? 'Show the steps' : (id === 'hook' ? 'Write the hook' : 'Make the draft'));
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
    var rabbit = craft.rabbit && mode !== 'review' && mode !== 'cover' && mode !== 'public-domain' && mode !== 'hook';
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
      note.textContent = 'Pick a region to see words from the slang list.';
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
    var select = $('sh-region');
    if (!select) return;
    var current = select.value;
    select.textContent = '';
    var any = document.createElement('option');
    any.value = '';
    any.textContent = 'Any region';
    select.appendChild(any);
    tags.forEach(function (tag) {
      var option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      select.appendChild(option);
    });
    select.value = current || '';
    craft.region = select.value;
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
    out.textContent = '';
    extra.textContent = '';
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
    if (!draft) return;
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
    }
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

  async function generate() {
    showError('');
    if (pageStatus.disabled) {
      showError('Song Helper is turned off right now.');
      return;
    }
    var body = payload();
    if (mode === 'hook') {
      var hookProblem = modes.hookError(modes.normalizeInput(body));
      if (hookProblem) {
        showError(hookProblem);
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
    var region = $('sh-region');
    if (region) region.addEventListener('change', function () {
      craft.region = region.value;
      chosenSlang = '';
      paintSlang();
    });
    document.querySelectorAll('[data-structure]').forEach(function (button) {
      button.addEventListener('click', function () {
        var kind = button.getAttribute('data-structure');
        if (kind === 'hook' && mode !== 'write' && mode !== 'hook' && !lastDraft) {
          setMode('hook');
          return;
        }
        if (mode !== 'write' && lastDraft) {
          var label = kind === 'hook' ? 'Hook' : (kind === 'bridge' ? 'Bridge' : 'Verse');
          lastDraft.sections = lastDraft.sections || [];
          lastDraft.sections.push({
            label: label,
            lines: [{ text: '', source: 'user', locked: false, vote: 0 }],
          });
          renderResult({ preview: true, notice: modes.DEMO_NOTICE, draft: lastDraft, critique: null });
          return;
        }
        if (window.SongHelperPage && window.SongHelperPage.addStructure) {
          window.SongHelperPage.addStructure(kind);
        }
      });
    });
    $('sh-v2-go').addEventListener('click', generate);
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

  function applySparkPrompt() {
    var raw = '';
    try { raw = sessionStorage.getItem('plaiground.sparkPrompt') || ''; } catch (err) { return; }
    if (!raw) return;
    var prompt = null;
    try { prompt = JSON.parse(raw); } catch (err) { return; }
    try { sessionStorage.removeItem('plaiground.sparkPrompt'); } catch (err) {}
    var line = String((prompt && (prompt.flip || prompt.answer || prompt.title)) || '').trim();
    var happened = $('sh-happened');
    if (happened && !happened.value && line) happened.value = line.slice(0, 280);
    var banner = $('sh-demo');
    if (!banner || !banner.parentNode || !line) return;
    var note = document.createElement('p');
    note.className = 'sh-note';
    note.id = 'sh-spark-note';
    note.textContent = 'From What\'s hot' + (prompt.title ? (': ' + prompt.title) : '') + '. That line is waiting in the concrete sentence.';
    banner.parentNode.insertBefore(note, banner.nextSibling);
  }

  window.SongHelperV2 = { paintLog: paintLog, setMode: setMode };
  bindCraft();
  paintModes();
  paintLog();
  applySparkPrompt();
  loadStatus();
  loadSlang();
}());
