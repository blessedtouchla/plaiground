(function () {
  var flow = window.SongFlow;
  if (!flow) return;

  var state = flow.blank();
  var opened = false;
  var recog = null;
  var pinned = '';
  var GENRES = [
    { id: 'hiphop', label: 'Hip-hop' },
    { id: 'rnb', label: 'R&B' },
    { id: 'country', label: 'Country' },
    { id: 'pop', label: 'Pop' },
    { id: 'latin', label: 'Latin' },
    { id: 'rock', label: 'Rock' },
    { id: 'gospel', label: 'Gospel' },
    { id: 'lofi', label: 'Lo-fi' },
    { id: 'afrobeats', label: 'Afrobeats' },
    { id: 'indie', label: 'Indie' },
  ];
  var PACKS = { hiphop: 1, rnb: 1, country: 1, pop: 1, latin: 1, rock: 1, gospel: 1, lofi: 1 };

  function $(id) { return document.getElementById(id); }

  function syncTitle() {
    var input = $('sh-working-title');
    state.title = input ? String(input.value || '').trim().slice(0, 80) : state.title;
  }

  function syncKinds() {
    if (window.SongHelperV2 && window.SongHelperV2.kinds) state.kinds = window.SongHelperV2.kinds();
  }

  function showFlowError(message) {
    var el = $('sh-flow-error');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  function refresh() {
    if (window.SongHelperPage && window.SongHelperPage.refreshAnswers) window.SongHelperPage.refreshAnswers();
  }

  function repaint() {
    if (window.SongHelperV2 && window.SongHelperV2.repaint) window.SongHelperV2.repaint();
  }

  function chip(label, on, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'sh-chip' + (on ? ' on' : '');
    button.textContent = label;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.addEventListener('click', onClick);
    return button;
  }

  function field(label, value, onInput, placeholder) {
    var wrap = document.createElement('label');
    wrap.className = 'sh-field';
    var span = document.createElement('span');
    span.textContent = label;
    var input = document.createElement('textarea');
    input.className = 'sh-area';
    input.maxLength = 280;
    input.placeholder = placeholder || 'Your words.';
    input.value = value || '';
    input.addEventListener('input', function () { onInput(input.value); });
    wrap.appendChild(span);
    wrap.appendChild(input);
    return wrap;
  }

  function saveText(step, value) {
    var text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 280);
    if (step.id === 'for') state.forText = text;
    else if (step.id === 'aim') state.aimOther = text.slice(0, 80);
    else if (step.id === 'wisdom') state.wisdom = text;
    else if (state.reveals[step.id] != null) state.reveals[step.id] = text;
    else state.sensory[step.id] = text;
    var skipAt = state.skipped.indexOf(step.id);
    if (text && skipAt >= 0) state.skipped.splice(skipAt, 1);
  }

  function rememberTurn(ask, answer) {
    state.turns.push({ who: 'plai', text: ask });
    if (answer) state.turns.push({ who: 'you', text: answer });
  }

  function currentAnswer(step) {
    if (!step) return '';
    if (step.id === 'for') return [flow.forLabel(state.forId), state.forText].filter(Boolean).join('. ');
    if (step.id === 'aim') return flow.aimLine(state);
    if (step.id === 'wisdom') return state.wisdom;
    if (state.reveals[step.id] != null) return state.reveals[step.id];
    return state.sensory[step.id] || '';
  }

  function accept(step) {
    var answer = currentAnswer(step);
    if (step.id === 'for' && !state.forId) {
      showFlowError('Pick who this song is for.');
      return;
    }
    if (step.id === 'aim' && !state.aims.length) {
      showFlowError('Pick at least one aim.');
      return;
    }
    if (step.optional && !answer) {
      skip(step);
      return;
    }
    pinned = '';
    if (state.talk === 'plai' && answer) rememberTurn(step.ask, answer);
    showFlowError('');
    render();
    refresh();
    repaint();
  }

  function skip(step) {
    pinned = '';
    if (state.skipped.indexOf(step.id) === -1) state.skipped.push(step.id);
    if (state.talk === 'plai') rememberTurn(step.ask, '');
    showFlowError('');
    render();
    refresh();
  }

  function paintChoices(host, step) {
    var row = document.createElement('div');
    row.className = 'sh-modes';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', step.ask);
    if (step.kind === 'for') {
      flow.FOR_OPTIONS.forEach(function (option) {
        row.appendChild(chip(option.label, state.forId === option.id, function () {
          state.forId = state.forId === option.id ? '' : option.id;
          render();
          refresh();
          repaint();
        }));
      });
    } else if (step.kind === 'aim') {
      flow.AIM_OPTIONS.forEach(function (option) {
        row.appendChild(chip(option.label, state.aims.indexOf(option.id) !== -1, function () {
          state.aims = flow.toggle(state.aims, option.id);
          render();
          refresh();
          repaint();
        }));
      });
    }
    host.appendChild(row);
    if (window.SongHelperChips) window.SongHelperChips.fold(row);
  }

  function paintStep(host, step) {
    var ask = document.createElement('p');
    ask.className = 'sh-q';
    ask.textContent = step.ask;
    host.appendChild(ask);
    if (step.kind === 'for' || step.kind === 'aim') paintChoices(host, step);
    if (step.kind === 'for') {
      host.appendChild(field('Say a little more, if you want', state.forText, function (value) {
        state.forText = String(value || '').trim().slice(0, 160);
      }, 'A name, or who you mean'));
    } else if (step.kind === 'aim' && state.aims.indexOf('other') !== -1) {
      host.appendChild(field('Other', state.aimOther, function (value) {
        state.aimOther = String(value || '').trim().slice(0, 80);
      }, 'What else should the song do?'));
    } else if (step.kind === 'text') {
      var current = step.id === 'wisdom' ? state.wisdom : (state.reveals[step.id] != null ? state.reveals[step.id] : (state.sensory[step.id] || ''));
      host.appendChild(field('Your answer', current, function (value) {
        saveText(step, value);
      }, 'Optional. Skip if you want.'));
    }
    var actions = document.createElement('div');
    actions.className = 'sh-plai-actions';
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-purple btn-md';
    next.textContent = 'Next';
    next.addEventListener('click', function () { accept(step); });
    actions.appendChild(next);
    if (step.optional) {
      var pass = document.createElement('button');
      pass.type = 'button';
      pass.className = 'btn btn-ghost btn-md';
      pass.textContent = 'Skip';
      pass.addEventListener('click', function () { skip(step); });
      actions.appendChild(pass);
    }
    if (state.talk === 'plai') actions.appendChild(micButton(step));
    var write = document.createElement('button');
    write.type = 'button';
    write.className = 'btn btn-ghost btn-md';
    write.id = 'sh-flow-write';
    write.textContent = 'Write it now';
    write.addEventListener('click', writeNow);
    actions.appendChild(write);
    host.appendChild(actions);
  }

  function micButton(step) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost btn-md';
    button.textContent = 'Talk';
    var Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      button.disabled = true;
      button.textContent = 'Typing works here';
      return button;
    }
    button.addEventListener('click', function () {
      if (recog) {
        try { recog.stop(); } catch (err) {}
        recog = null;
        button.textContent = 'Talk';
        return;
      }
      recog = new Speech();
      recog.lang = 'en-US';
      recog.interimResults = false;
      recog.onresult = function (event) {
        var said = '';
        for (var i = 0; i < event.results.length; i += 1) said += event.results[i][0].transcript;
        if (step.kind === 'for') state.forText = String(said || '').trim().slice(0, 160);
        else if (step.kind === 'aim') state.aimOther = String(said || '').trim().slice(0, 80);
        else saveText(step, said);
        recog = null;
        render();
      };
      recog.onerror = function () {
        recog = null;
        button.textContent = 'Talk';
        showFlowError('Voice did not come through. You can type it.');
      };
      recog.onend = function () {
        recog = null;
        button.textContent = 'Talk';
      };
        button.textContent = 'Listening...';
      try { recog.start(); } catch (err) {
        showFlowError('Voice did not come through. You can type it.');
      }
    });
    return button;
  }

  function renderLog(host) {
    if (!state.turns.length) return;
    var log = document.createElement('div');
    log.className = 'sh-plai-log';
    log.setAttribute('aria-live', 'polite');
    state.turns.forEach(function (turn) {
      var line = document.createElement('p');
      line.className = 'sh-plai-turn' + (turn.who === 'you' ? ' is-user' : '');
      line.textContent = (turn.who === 'you' ? 'You: ' : 'Plai: ') + turn.text;
      log.appendChild(line);
    });
    host.appendChild(log);
  }

  function render() {
    var host = $('sh-flow-host');
    if (!host) return;
    syncTitle();
    syncKinds();
    host.textContent = '';
    if (state.talk !== 'form' && state.talk !== 'plai') return;
    if (state.talk === 'plai') renderLog(host);
    var list = flow.steps(state);
    var step = null;
    if (pinned) {
      for (var i = 0; i < list.length; i += 1) {
        if (list[i].id === pinned) step = list[i];
      }
    }
    if (!step) step = flow.nextStep(state);
    if (step) pinned = step.id;
    if (!step) {
      var done = document.createElement('p');
      done.className = 'sh-help';
      done.textContent = 'That is enough to write from. You can still change an answer above.';
      host.appendChild(done);
      var write = document.createElement('button');
      write.type = 'button';
      write.className = 'btn btn-purple btn-md';
      write.textContent = 'Write it now';
      write.addEventListener('click', writeNow);
      host.appendChild(write);
      return;
    }
    paintStep(host, step);
  }

  function paintCast() {
    var host = $('sh-cast-host');
    if (!host) return;
    host.textContent = '';
    function group(title, aria, nodes) {
      var block = document.createElement('div');
      block.className = 'sh-group';
      var heading = document.createElement('h3');
      heading.textContent = title;
      var row = document.createElement('div');
      row.className = 'sh-modes';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', aria);
      nodes.forEach(function (node) { row.appendChild(node); });
      block.appendChild(heading);
      block.appendChild(row);
      host.appendChild(block);
      if (window.SongHelperChips) window.SongHelperChips.fold(row);
    }
    group('Language', 'Language', [
      chip('English', state.language === 'english', function () { state.language = 'english'; applyShape(); paintCast(); }),
      chip('Spanish', state.language === 'spanish', function () { state.language = 'spanish'; applyShape(); paintCast(); }),
      chip('Spanglish', state.language === 'spanglish', function () { state.language = 'spanglish'; applyShape(); paintCast(); }),
    ]);
    group('Clean or explicit', 'Clean or explicit', [
      chip('Clean', state.explicit !== 'explicit', function () { state.explicit = 'clean'; applyShape(); paintCast(); }),
      chip('Explicit', state.explicit === 'explicit', function () { state.explicit = 'explicit'; applyShape(); paintCast(); }),
    ]);
    var regions = ['No region'];
    document.querySelectorAll('#sh-region .sh-chip').forEach(function (button) {
      var label = button.textContent || '';
      if (label && label !== 'No region' && regions.indexOf(label) === -1) regions.push(label);
    });
    group('Region', 'Region', regions.map(function (label) {
      var value = label === 'No region' ? '' : label;
      var on = (window.SongHelperV2 && window.SongHelperV2.region ? window.SongHelperV2.region() : '') === value;
      return chip(label, on || (!value && !(window.SongHelperV2 && window.SongHelperV2.region && window.SongHelperV2.region())), function () {
        if (window.SongHelperV2 && window.SongHelperV2.setRegion) window.SongHelperV2.setRegion(value);
        paintCast();
      });
    }));
    group('Genre', 'Genre', GENRES.map(function (item) {
      var on = state.genres.indexOf(item.id) !== -1;
      return chip(item.label, on, function () {
        state.genres = flow.toggle(state.genres, item.id, 2);
        applyShape();
        paintCast();
      });
    }));
  }

  function applyShape() {
    var page = window.SongHelperPage;
    if (!page) return;
    var primary = state.genres[0] || '';
    var second = state.genres[1] || '';
    var primaryRow = null;
    var secondRow = null;
    GENRES.forEach(function (item) {
      if (item.id === primary) primaryRow = item;
      if (item.id === second) secondRow = item;
    });
    if (page.setPack) page.setPack(primary && PACKS[primary] ? primary : '');
    var tint = '';
    if (primary && !PACKS[primary] && primaryRow) tint = primaryRow.label;
    if (secondRow) tint = tint ? (tint + ', ' + secondRow.label) : secondRow.label;
    if (page.setShapeBits) page.setShapeBits({ language: state.language || 'english', explicit: state.explicit || 'clean', genre2: tint });
  }

  function seedWizard() {
    var star = flow.northStar(state);
    function put(id, value) {
      var el = $(id);
      var text = String(value || '').trim();
      if (!el || !text || String(el.value || '').trim()) return;
      el.value = text;
    }
    var sensory = star.sensory || {};
    put('sh-happened', sensory.moment || sensory.place || star.forText || star.aimLabels.join(', '));
    put('sh-who', sensory.who || star.forText || star.forLabel);
    put('sh-why', star.wisdom || star.reveals.scared || star.reveals.never || star.aimLabels.join(', '));
    var hook = star.wisdom || star.reveals.nobody || '';
    if (!hook && star.aimLabels[0]) hook = 'I want this song to ' + star.aimLabels[0].toLowerCase() + '.';
    put('sh-line', hook || star.forText);
  }

  function writeNow() {
    syncTitle();
    syncKinds();
    if (!flow.readyForDraft(state)) {
      showFlowError('Pick who this song is for, or what you aim to do. Then I can write.');
      return;
    }
    showFlowError('');
    applyShape();
    seedWizard();
    opened = true;
    var panel = $('sh-v2');
    if (panel && !panel.hidden) {
      repaint();
      var go = $('sh-v2-go');
      if (go) go.click();
      refresh();
      return;
    }
    var page = window.SongHelperPage;
    if (page && page.setMood && page.mood && !page.mood() && state.kinds[0]) page.setMood(state.kinds[0]);
    repaint();
    if (page && page.openDraft) page.openDraft();
    refresh();
  }

  function setTalk(next) {
    state.talk = state.talk === next ? '' : next;
    var formBtn = $('sh-talk-form');
    var plaiBtn = $('sh-talk-plai');
    if (formBtn) {
      formBtn.classList.toggle('on', state.talk === 'form');
      formBtn.setAttribute('aria-pressed', state.talk === 'form' ? 'true' : 'false');
    }
    if (plaiBtn) {
      plaiBtn.classList.toggle('on', state.talk === 'plai');
      plaiBtn.setAttribute('aria-pressed', state.talk === 'plai' ? 'true' : 'false');
    }
    render();
    repaint();
  }

  state.language = 'english';
  state.explicit = 'clean';
  state.genres = [];
  state.turns = [];

  window.SongFlowPage = {
    talk: function () { return state.talk; },
    ready: function () { syncTitle(); syncKinds(); return flow.readyForDraft(state); },
    opened: function () { return opened; },
    north: function () { syncTitle(); syncKinds(); return flow.northStar(state); },
    cardRows: function () { syncTitle(); syncKinds(); return flow.cardRows(state); },
    setKinds: function (list) {
      state.kinds = (list || []).slice(0, 2);
      render();
    },
    paintCast: function () { paintCast(); },
  };

  var formBtn = $('sh-talk-form');
  var plaiBtn = $('sh-talk-plai');
  if (formBtn) formBtn.addEventListener('click', function () { setTalk('form'); });
  if (plaiBtn) plaiBtn.addEventListener('click', function () { setTalk('plai'); });
  var draftBtn = $('sh-cast-draft');
  if (draftBtn) draftBtn.addEventListener('click', writeNow);
  var title = $('sh-working-title');
  if (title) title.addEventListener('input', function () { syncTitle(); refresh(); });
  paintCast();
  render();
  repaint();
})();
