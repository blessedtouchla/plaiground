(function () {
  var flow = window.SongFlow;
  if (!flow) return;

  var state = flow.blank();
  var opened = false;
  var recog = null;
  var pinned = '';
  var focusNext = false;
  var focusIndex = 0;
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
    persistFlow();
    if (window.SongHelperPage && window.SongHelperPage.refreshAnswers) window.SongHelperPage.refreshAnswers();
  }

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

  function flowSnapshot() {
    var reveals = state.reveals || {};
    return {
      forId: state.forId || '',
      forText: state.forText || '',
      aims: (state.aims || []).slice(),
      aimOther: state.aimOther || '',
      opener: state.opener || '',
      wisdom: state.wisdom || '',
      keep: state.keep || '',
      reveals: {
        never: reveals.never || '',
        scared: reveals.scared || '',
        nobody: reveals.nobody || '',
      },
      sensory: Object.assign({}, state.sensory || {}),
      notes: (state.notes || []).map(function (note) {
        return { ask: note.ask || '', text: note.text || '' };
      }),
      kinds: (state.kinds || []).slice(),
      title: state.title || '',
      talk: state.talk || '',
      genres: (state.genres || []).slice(),
      language: state.language || '',
      explicit: state.explicit || '',
      revealId: state.revealId || '',
      followByStep: Object.assign({}, state.followByStep || {}),
    };
  }

  function persistFlow() {
    writeStoryStore({ flow: flowSnapshot() });
  }

  function restoreFlow() {
    var saved = readStoryStore().flow;
    if (!saved || typeof saved !== 'object') return;
    var has = saved.opener || saved.forText || saved.keep || saved.wisdom || (saved.notes && saved.notes.length);
    if (!has) return;
    ['forId', 'forText', 'aimOther', 'opener', 'wisdom', 'keep', 'title', 'talk', 'revealId', 'language', 'explicit'].forEach(function (key) {
      if (saved[key]) state[key] = saved[key];
    });
    if (Array.isArray(saved.aims) && saved.aims.length) state.aims = saved.aims.slice();
    if (Array.isArray(saved.kinds) && saved.kinds.length) state.kinds = saved.kinds.slice();
    if (Array.isArray(saved.genres) && saved.genres.length) state.genres = saved.genres.slice();
    if (Array.isArray(saved.notes) && saved.notes.length) state.notes = saved.notes.slice();
    if (saved.reveals) state.reveals = Object.assign(state.reveals || {}, saved.reveals);
    if (saved.sensory) state.sensory = Object.assign({}, saved.sensory);
    if (saved.followByStep) state.followByStep = Object.assign({}, saved.followByStep);
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

  function field(label, value, onInput, placeholder, short, cap) {
    var wrap = document.createElement('label');
    wrap.className = 'sh-field';
    var span = document.createElement('span');
    span.textContent = label;
    var input = document.createElement('textarea');
    input.className = 'sh-area' + (short ? ' sh-area-short' : '');
    var limit = cap || flow.STORY_MAX;
    input.placeholder = placeholder || 'Your words.';
    input.value = value || '';
    if (limit < flow.STORY_MAX) input.maxLength = limit;
    input.addEventListener('input', function () {
      if (input.value.length > limit) return;
      onInput(input.value);
      refresh();
    });
    wrap.appendChild(span);
    wrap.appendChild(input);
    if (limit >= flow.STORY_MAX && flow.mountStoryBox) flow.mountStoryBox(input);
    return wrap;
  }

  function tidy(value, max) {
    var text = String(value || '').replace(/\s+/g, ' ').trim();
    var cap = max == null ? flow.STORY_MAX : max;
    if (cap >= flow.STORY_MAX) {
      if (text.length > flow.STORY_MAX) return null;
      return text;
    }
    return text.slice(0, cap);
  }

  function starterFinished(text, starters) {
    var value = tidy(text);
    var list = starters || [];
    for (var i = 0; i < list.length; i += 1) {
      var prefix = String(list[i] || '').replace(/\.\.\.$/, '').trim();
      if (prefix && value.indexOf(prefix) === 0 && value.length > prefix.length) return true;
    }
    return false;
  }

  function saveNote(ask, answer) {
    var question = tidy(ask, 220);
    var text = tidy(answer);
    if (text == null) {
      showFlowError(flow.TOO_LONG);
      return;
    }
    if (!question || !text) return;
    if (!Array.isArray(state.notes)) state.notes = [];
    for (var i = 0; i < state.notes.length; i += 1) {
      if (state.notes[i].ask === question && state.notes[i].text === text) return;
    }
    state.notes.push({ ask: question, text: text });
  }

  function rememberTurn(ask, answer) {
    var question = tidy(ask, 220);
    if (!question) return;
    var text = tidy(answer);
    if (text == null) return;
    var last = state.turns[state.turns.length - 1];
    var prev = state.turns[state.turns.length - 2];
    if (prev && prev.who === 'plai' && prev.text === question && last && last.who === 'you' && last.text === text) return;
    state.turns.push({ who: 'plai', text: question });
    if (text) state.turns.push({ who: 'you', text: text });
  }

  function clearSkip(step) {
    var skipAt = state.skipped.indexOf(step.id);
    if (skipAt >= 0) state.skipped.splice(skipAt, 1);
  }

  function setStory(step, value) {
    var text = tidy(value, step.id === 'aim' ? 80 : flow.STORY_MAX);
    if (text == null) {
      showFlowError(flow.TOO_LONG);
      return;
    }
    if (step.id === 'for') state.forText = text;
    else if (step.id === 'aim') state.aimOther = text;
    else if (step.id === 'open') state.opener = text;
    else if (step.id === 'wisdom') state.wisdom = text;
    else if (step.id === 'keep') state.keep = text;
    else if (step.id === 'reveal' && state.revealId) {
      state.reveals[state.revealId] = text;
      flow.REVEALS.forEach(function (item) {
        if (item.id !== state.revealId) state.reveals[item.id] = '';
      });
    }
    if (text) clearSkip(step);
  }

  function sceneTarget(step) {
    var boxes = step.boxes || [];
    for (var i = 0; i < boxes.length; i += 1) {
      if (!state.sensory[boxes[i].id]) return boxes[i];
    }
    return boxes[0] || null;
  }

  function applyStarter(step, starter) {
    if (step.id === 'scene') {
      var boxes = step.boxes || [];
      var picked = 0;
      for (var b = 0; b < boxes.length; b += 1) {
        if (!state.sensory[boxes[b].id]) { picked = b; break; }
      }
      if (boxes[picked]) state.sensory[boxes[picked].id] = starter;
      focusIndex = picked;
    } else if (step.id === 'reveal') {
      if (!state.revealId) state.revealId = 'never';
      state.reveals[state.revealId] = starter;
      flow.REVEALS.forEach(function (item) {
        if (item.id !== state.revealId) state.reveals[item.id] = '';
      });
      focusIndex = 0;
    } else {
      setStory(step, starter);
      focusIndex = 0;
    }
    clearSkip(step);
    focusNext = true;
    render();
  }

  function storyText(step) {
    if (!step) return '';
    if (step.id === 'for') return state.forText || '';
    if (step.id === 'open') return state.opener || '';
    if (step.id === 'wisdom') return state.wisdom || '';
    if (step.id === 'keep') return state.keep || '';
    if (step.id === 'reveal') return (state.revealId && state.reveals[state.revealId]) || '';
    if (step.id === 'scene') {
      var bits = [];
      (step.boxes || []).forEach(function (box) {
        if (state.sensory[box.id]) bits.push(state.sensory[box.id]);
      });
      return bits.join(' ');
    }
    return '';
  }

  function currentAnswer(step) {
    if (!step) return '';
    if (step.id === 'for') return [flow.forLabel(state.forId), state.forText].filter(Boolean).join('. ');
    if (step.id === 'aim') return flow.aimLine(state);
    return storyText(step);
  }

  function followAsk(step) {
    return (step && step.follows && step.follows[0]) || '';
  }

  function followText(step) {
    if (!step || state.followSkip[step.id]) return '';
    return tidy(state.followByStep[step.id] || '');
  }

  function recordStory(step, answer) {
    if (step.id === 'scene') {
      (step.boxes || []).forEach(function (box) {
        var text = tidy(state.sensory[box.id] || '');
        if (!text) return;
        saveNote(box.ask, text);
        if (state.talk === 'plai' || starterFinished(text, step.starters)) rememberTurn(box.ask, text);
      });
      return;
    }
    if (step.id === 'reveal') {
      var chosen = null;
      flow.REVEALS.forEach(function (item) {
        if (item.id === state.revealId) chosen = item;
      });
      var told = tidy(state.reveals[state.revealId] || '');
      if (chosen && told) {
        saveNote(chosen.ask, told);
        if (state.talk === 'plai' || starterFinished(told, step.starters)) rememberTurn(chosen.ask, told);
      }
      return;
    }
    if (step.id === 'for') {
      var who = flow.forLabel(state.forId);
      if (who && state.talk === 'plai') rememberTurn(step.ask, who);
      if (who) saveNote(step.ask, who);
      if (state.forText) {
        saveNote(step.storyAsk || step.ask, state.forText);
        if (state.talk === 'plai' || starterFinished(state.forText, step.starters)) rememberTurn(step.storyAsk || step.ask, state.forText);
      }
      return;
    }
    if (!answer) return;
    var question = step.ask;
    saveNote(question, answer);
    if (state.talk === 'plai' || starterFinished(answer, step.starters)) rememberTurn(question, answer);
  }

  function accept(step) {
    var answer = currentAnswer(step);
    var extraAsk = followAsk(step);
    var extra = followText(step);
    if (step.id === 'for' && !state.forId) {
      showFlowError('Pick who this song is for.');
      return;
    }
    if (step.id === 'aim' && !state.aims.length) {
      showFlowError('Pick at least one aim.');
      return;
    }
    if (step.optional && !answer && !extra) {
      skip(step);
      return;
    }
    pinned = '';
    if (answer) recordStory(step, answer);
    if (extra && extraAsk) {
      saveNote(extraAsk, extra);
      rememberTurn(extraAsk, extra);
    }
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

  function paintStarters(host, step) {
    var starters = step.starters || [];
    if (!starters.length) return;
    if (step.id === 'for' && !state.forId) return;
    if (step.id === 'reveal' && !state.revealId) return;
    var row = document.createElement('div');
    row.className = 'sh-starters';
    starters.forEach(function (starter) {
      var button = chip(starter, false, function () { applyStarter(step, starter); });
      button.classList.add('sh-starter');
      button.setAttribute('aria-pressed', 'false');
      row.appendChild(button);
    });
    host.appendChild(row);
  }

  function revealFollow(step) {
    var block = document.querySelector('.sh-flow-follow');
    if (!block || !step) return;
    block.hidden = !storyText(step);
  }

  function canFollow(step) {
    if (!step || step.kind === 'aim') return false;
    if (step.id === 'for') return !!state.forId;
    if (step.id === 'reveal') return !!state.revealId;
    return true;
  }

  function paintFollow(host, step) {
    var ask = followAsk(step);
    if (!ask || state.followSkip[step.id] || !canFollow(step)) return;
    var block = document.createElement('div');
    block.className = 'sh-flow-follow';
    block.hidden = !storyText(step);
    var note = document.createElement('p');
    note.className = 'sh-help';
    note.textContent = 'One more, if you want. Skip it and we will keep going.';
    block.appendChild(note);
    block.appendChild(field(ask, state.followByStep[step.id] || '', function (value) {
      var text = tidy(value);
      if (text == null) {
        showFlowError(flow.TOO_LONG);
        return;
      }
      state.followByStep[step.id] = text;
    }, 'Optional.', true));
    var pass = document.createElement('button');
    pass.type = 'button';
    pass.className = 'btn btn-ghost btn-md';
    pass.textContent = 'Skip';
    pass.addEventListener('click', function () {
      state.followSkip[step.id] = true;
      state.followByStep[step.id] = '';
      render();
    });
    block.appendChild(pass);
    host.appendChild(block);
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
    } else if (step.kind === 'reveal') {
      flow.REVEALS.forEach(function (option) {
        row.appendChild(chip(option.label, state.revealId === option.id, function () {
          state.revealId = state.revealId === option.id ? '' : option.id;
          if (state.revealId) {
            flow.REVEALS.forEach(function (item) {
              if (item.id !== state.revealId) state.reveals[item.id] = '';
            });
            clearSkip(step);
          }
          render();
          refresh();
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
    if (step.recommended) {
      var rec = document.createElement('p');
      rec.className = 'sh-help';
      rec.textContent = step.id === 'reveal'
        ? 'Recommended for a confess song.'
        : 'Recommended. Skip it if you want.';
      host.appendChild(rec);
    }
    if (step.kind === 'for' || step.kind === 'aim' || step.kind === 'reveal') paintChoices(host, step);
    if (step.kind === 'for' && state.forId) {
      var storyAsk = document.createElement('p');
      storyAsk.className = 'sh-scene-ask';
      storyAsk.textContent = step.storyAsk || 'Tell me a moment.';
      host.appendChild(storyAsk);
        host.appendChild(field('Your answer', state.forText, function (value) {
        var text = tidy(value);
        if (text == null) {
          showFlowError(flow.TOO_LONG);
          return;
        }
        state.forText = text;
        if (state.forText) clearSkip(step);
        revealFollow(step);
      }, 'A moment is enough.'));
      paintStarters(host, step);
    } else if (step.kind === 'aim' && state.aims.indexOf('other') !== -1) {
      host.appendChild(field('Other', state.aimOther, function (value) {
        state.aimOther = tidy(value, 80);
      }, 'What else should the song do?', false, 80));
    } else if (step.kind === 'scene') {
      (step.boxes || []).forEach(function (box) {
        var label = document.createElement('p');
        label.className = 'sh-scene-ask';
        label.textContent = box.ask;
        host.appendChild(label);
        host.appendChild(field('Your answer', state.sensory[box.id] || '', function (value) {
          var text = tidy(value);
          if (text == null) {
            showFlowError(flow.TOO_LONG);
            return;
          }
          state.sensory[box.id] = text;
          if (state.sensory[box.id]) clearSkip(step);
          revealFollow(step);
        }, 'Optional. A short scene is enough.', true));
      });
      paintStarters(host, step);
    } else if (step.kind === 'reveal' && state.revealId) {
      var chosen = null;
      flow.REVEALS.forEach(function (item) {
        if (item.id === state.revealId) chosen = item;
      });
      var deepAsk = document.createElement('p');
      deepAsk.className = 'sh-scene-ask';
      deepAsk.textContent = chosen ? chosen.ask : 'Tell me the one you picked.';
      host.appendChild(deepAsk);
      host.appendChild(field('Your answer', state.reveals[state.revealId] || '', function (value) {
        setStory(step, value);
        revealFollow(step);
      }, 'Optional. Skip if you want.', true));
      paintStarters(host, step);
    } else if (step.kind === 'story') {
      var current = step.id === 'open' ? state.opener : (step.id === 'keep' ? state.keep : state.wisdom);
      host.appendChild(field('Your answer', current, function (value) {
        setStory(step, value);
        revealFollow(step);
      }, 'Optional. Skip if you want.'));
      paintStarters(host, step);
    }
    paintFollow(host, step);
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
    host.appendChild(actions);
  }

  function paintEnough(host, label, purple) {
    var enough = document.createElement('button');
    enough.type = 'button';
    enough.className = 'btn btn-md sh-enough' + (purple ? ' btn-purple' : ' btn-ghost');
    enough.id = 'sh-flow-write';
    enough.textContent = label;
    enough.addEventListener('click', writeNow);
    host.appendChild(enough);
  }

  function stepIndex(step) {
    var list = flow.steps(state);
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === step.id) return i;
    }
    return 0;
  }

  function heardTarget(step) {
    if (followAsk(step) && storyText(step) && !state.followSkip[step.id]) return 'follow';
    if (step.id === 'scene') return 'scene';
    return 'story';
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
        var target = heardTarget(step);
        var heard = tidy(said, target === 'story' || target === 'follow' || target === 'scene' ? flow.STORY_MAX : 80);
        if (heard == null) {
          showFlowError(flow.TOO_LONG);
          recog = null;
          button.textContent = 'Talk';
          return;
        }
        if (target === 'follow') state.followByStep[step.id] = heard;
        else if (target === 'scene') {
          var box = sceneTarget(step);
          if (box) state.sensory[box.id] = heard;
        } else if (step.kind === 'aim') state.aimOther = tidy(said, 80);
        else setStory(step, heard);
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
    persistFlow();
    var host = $('sh-flow-host');
    if (!host) return;
    syncTitle();
    syncKinds();
    host.textContent = '';
    if (state.talk !== 'form' && state.talk !== 'plai') return;
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
      paintEnough(host, 'Write my song', true);
      var done = document.createElement('p');
      done.className = 'sh-help';
      done.textContent = 'That is enough to write from. You can still change an answer above.';
      host.appendChild(done);
      if (state.talk === 'plai') renderLog(host);
      return;
    }
    if (stepIndex(step) >= 2) paintEnough(host, "That's enough, write my song", false);
    if (state.talk === 'plai') renderLog(host);
    paintStep(host, step);
    if (focusNext) {
      focusNext = false;
      var areas = host.querySelectorAll('textarea');
      var box = areas[focusIndex] || areas[0];
      if (box) {
        try { box.focus(); } catch (err) {}
        var spot = box.value.length;
        try { box.setSelectionRange(spot, spot); } catch (err2) {}
      }
    }
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
      if (flow.paintStoryBox) flow.paintStoryBox(el);
    }
    var sensory = star.sensory || {};
    put('sh-happened', star.opener || sensory.moment || sensory.place || star.forText || star.aimLabels.join(', '));
    put('sh-who', sensory.who || star.forText || star.forLabel);
    put('sh-why', star.wisdomLine || star.wisdom || star.reveals.scared || star.reveals.never || star.aimLabels.join(', '));
    var hook = star.keep || star.wisdomLine || star.wisdom || star.reveals.nobody || '';
    if (!hook && star.aimLabels[0]) hook = 'I want this song to ' + star.aimLabels[0].toLowerCase() + '.';
    put('sh-line', hook || star.forText);
  }

  function currentStep() {
    var list = flow.steps(state);
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === pinned) return list[i];
    }
    return flow.nextStep(state);
  }

  function flushCurrent() {
    var step = currentStep();
    if (!step) return;
    var answer = currentAnswer(step);
    if (answer) recordStory(step, answer);
    var extraAsk = followAsk(step);
    var extra = followText(step);
    if (extra && extraAsk) {
      saveNote(extraAsk, extra);
      rememberTurn(extraAsk, extra);
    }
  }

  function writeNow() {
    syncTitle();
    syncKinds();
    flushCurrent();
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
  state.notes = [];
  state.followByStep = {};
  state.followSkip = {};
  state.revealId = '';
  restoreFlow();

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
    flowState: function () {
      syncTitle();
      syncKinds();
      var sensory = {};
      Object.keys(state.sensory || {}).forEach(function (key) {
        sensory[key] = state.sensory[key];
      });
      var reveals = state.reveals || {};
      return {
        forId: state.forId,
        forText: state.forText,
        aims: (state.aims || []).slice(),
        aimOther: state.aimOther || '',
        opener: state.opener || '',
        wisdom: state.wisdom || '',
        keep: state.keep || '',
        reveals: {
          never: reveals.never || '',
          scared: reveals.scared || '',
          nobody: reveals.nobody || ''
        },
        sensory: sensory,
        kinds: (state.kinds || []).slice(),
        genres: (state.genres || []).slice()
      };
    },
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
