(function () {
  var Lab = window.SongLabState;
  var UI = window.SongLabUI;
  var Engine = window.WordEngine;
  var Bpm = window.GenreBpm;
  var Report = window.SongReport;
  var state = Lab.blank();
  var songs = Lab.cloneSongs();
  var brain = { regions: {} };
  var typed = [];
  var SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  var STEP_NAMES = ['chat', 'pinned', 'map', 'notebook'];
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function song() { return songs[state.songId]; }
  function flat() {
    var out = [];
    song().secs.forEach(function (sec) {
      sec.lines.forEach(function (line, index) { out.push({ line: line, sec: sec, j: index }); });
    });
    return out;
  }
  function isPhone() { return window.matchMedia('(max-width: 480px)').matches; }

  function paintDigit(node, digit) {
    var on = SEGS[digit] || '';
    Array.prototype.forEach.call(node.children, function (bar) {
      var name = bar.className.replace(' on', '');
      bar.className = name + (on.indexOf(name) >= 0 ? ' on' : '');
    });
    node.setAttribute('data-d', String(digit));
  }

  function paintCredits() {
    var box = $('credit-box');
    var n = state.credits;
    if (n == null || n === '') {
      box.setAttribute('aria-label', 'credits');
      paintDigit($('seg-a'), '');
      paintDigit($('seg-b'), '');
      return;
    }
    var value = Math.max(0, Math.min(99, Number(n) || 0));
    box.setAttribute('aria-label', value + ' credits');
    paintDigit($('seg-a'), Math.floor(value / 10));
    paintDigit($('seg-b'), value % 10);
  }

  function brainWord(region, word) {
    var pack = brain.regions && brain.regions[region];
    if (!pack || !pack.words) return null;
    for (var i = 0; i < pack.words.length; i += 1) {
      if (pack.words[i].w === word) return pack.words[i];
    }
    return null;
  }

  function slangFor(line, region) {
    if (line.rw && line.rw.slang && line.rw.slang[region]) {
      return { text: line.rw.slang[region][0], word: brainWord(region, line.rw.slang[region][1]) };
    }
    var tag = Lab.TAGWORD[region] || 'word';
    var base = line.orig || line.text;
    var rest = /^I\b/.test(base) ? base : base.charAt(0).toLowerCase() + base.slice(1);
    var pretty = tag.charAt(0).toUpperCase() + tag.slice(1);
    return { text: pretty + ', ' + rest, word: brainWord(region, tag) };
  }

  function optionsFor(index) {
    var row = flat()[index];
    var slang = slangFor(row.line, state.region);
    return [
      { kind: 'rhyme', label: 'Rhyme', text: row.line.rw.rhyme },
      { kind: 'slang', label: 'Slang', text: slang.text, word: slang.word },
      { kind: 'flow', label: 'Flow', text: row.line.rw.flow }
    ];
  }

  function dotsEl(count, target, cls) {
    var host = el('span', cls || 'dots');
    host.setAttribute('aria-label', count + ' syllables, target ' + target);
    var total = Math.max(count, target);
    for (var i = 0; i < total; i += 1) host.appendChild(el('i', 'dot ' + Engine.dotKind(i, count, target)));
    return host;
  }

  function scribble() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 22');
    svg.setAttribute('preserveAspectRatio', 'none');
    ['M0,12 C6,3 10,20 16,11 S26,3 32,12 S42,20 48,11 S58,3 64,12 S74,20 80,11 S92,4 100,12', 'M2,9 C14,16 26,5 40,13 S66,6 78,14 S94,8 99,10'].forEach(function (d) {
      var path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(path);
    });
    return svg;
  }

  function textWithHL(text, mark) {
    var frag = document.createDocumentFragment();
    var match = String(text || '').match(/^(.*?)([A-Za-z']+)([^A-Za-z']*)$/);
    if (!match || !mark) {
      frag.appendChild(document.createTextNode(text));
      return frag;
    }
    frag.appendChild(document.createTextNode(match[1]));
    var chip = el('span', 'hl', match[2]);
    chip.style.background = mark.bg;
    frag.appendChild(chip);
    frag.appendChild(document.createTextNode(match[3]));
    return frag;
  }

  function renderPads() {
    var groups = { genre: Lab.GENRES, era: Lab.ERAS, region: Lab.REGIONS, language: Lab.LANGUAGES };
    Object.keys(groups).forEach(function (key) {
      var host = document.querySelector('.pads[data-group="' + key + '"]');
      host.textContent = '';
      groups[key].forEach(function (value) {
        var button = el('button', 'pad' + (state[key] === value ? ' on' : ''), value);
        button.type = 'button';
        button.setAttribute('aria-pressed', state[key] === value ? 'true' : 'false');
        button.addEventListener('click', function () {
          state[key] = value;
          render();
        });
        host.appendChild(button);
      });
    });
    var sum = $('rack-sum');
    sum.textContent = '';
    [['genre', '#c92d6f'], ['era', '#b57a10'], ['region', '#1a8fb0'], ['language', '#4f9a2a']].forEach(function (pair) {
      var chip = el('i', null, state[pair[0]]);
      chip.style.background = pair[1];
      sum.appendChild(chip);
    });
  }

  function renderPresets(host) {
    if (!host) return;
    host.textContent = '';
    Lab.PRESETS.forEach(function (preset, index) {
      var button = el('button', 'preset' + (state.presetIdx === index ? ' on' : ''), preset.label);
      button.type = 'button';
      button.addEventListener('click', function () {
        state.genre = preset.genre;
        state.era = preset.era;
        state.topic = preset.topic;
        state.presetIdx = index;
        state.songId = 'kitchen';
        if (state.screen === 'home') state.screen = 'desk';
        render();
      });
      host.appendChild(button);
    });
  }

  function renderStamp(host, animate) {
    var stamp = Lab.STAMPS[state.stamp] || Lab.STAMPS[1];
    host.textContent = '';
    host.appendChild(el('small', null, 'written by'));
    host.appendChild(document.createTextNode(stamp.label));
    host.setAttribute('data-label', stamp.label);
    host.setAttribute('data-key', stamp.key);
    if (animate) {
      host.classList.remove('thud');
      void host.offsetWidth;
      host.classList.add('thud');
    }
  }

  function cycleStamp(host) {
    state.stamp = UI.nextStamp(state.stamp);
    document.querySelectorAll('.stamp').forEach(function (node) { renderStamp(node, node === host); });
  }

  function renderSheet() {
    var host = $('sheet');
    host.textContent = '';
    var current = song();
    var texts = flat().map(function (row) { return row.line.text; });
    var colors = Engine.colorLines(texts);
    var index = 0;
    $('song-title').textContent = current.title;
    $('song-topic').textContent = state.songId === 'kitchen' ? 'topic: ' + state.topic.toLowerCase() : 'from the couch';
    current.secs.forEach(function (sec) {
      var label = el('div', 'sec');
      label.appendChild(el('span', null, sec.tag));
      host.appendChild(label);
      sec.lines.forEach(function (line) {
        var at = index;
        index += 1;
        var count = Engine.syllables(line.text);
        var active = at === state.line;
        if (line.orig && line.orig !== line.text) {
          var oldRow = el('div', 'row');
          oldRow.appendChild(el('span', 'dots'));
          var old = el('span', 'old');
          var ink = el('span', 'ink', line.orig);
          ink.appendChild(scribble());
          old.appendChild(ink);
          oldRow.appendChild(old);
          oldRow.appendChild(el('span', 'slot'));
          host.appendChild(oldRow);
        }
        var row = el('div', 'row');
        row.appendChild(dotsEl(count, sec.target));
        var button = el('button', 'ltext' + (active ? ' on' : '') + (line.orig && line.orig !== line.text ? ' blue' : '') + (state.justPicked === at ? ' write' : ''));
        button.type = 'button';
        button.appendChild(textWithHL(line.text, colors[at]));
        button.setAttribute('aria-label', line.text + '. ' + count + ' syllables, target ' + sec.target + '.');
        button.addEventListener('click', function () {
          state.line = active ? -1 : at;
          state.justPicked = -1;
          render();
        });
        row.appendChild(button);
        var slot = el('span', 'slot');
        if (active) slot.appendChild(el('div', 'sticky', noteText(at)));
        row.appendChild(slot);
        host.appendChild(row);
        if (active) {
          host.appendChild(el('div', 'sticky inline', noteText(at)));
          host.appendChild(tray(at, line, sec));
        }
      });
    });
  }

  function noteText(index) {
    var rows = flat();
    var row = rows[index];
    if (!row) return '';
    var partner = row.sec.lines[row.j === 0 ? 1 : 0] || { text: '' };
    var slang = slangFor(row.line, state.region);
    return UI.noteFor({
      line: row.line,
      partner: partner,
      target: row.sec.target,
      justPicked: state.justPicked === index,
      region: state.region,
      slangWord: slang.word ? slang.word.w : ''
    });
  }

  function tray(index, line, sec) {
    var box = el('div', 'tray');
    optionsFor(index).forEach(function (option) {
      var button = el('button', 'swap' + (line.picked === option.kind && line.text === option.text ? ' on' : ''));
      button.type = 'button';
      button.dataset.kind = option.kind;
      button.appendChild(el('span', 'k', option.label));
      button.appendChild(el('span', 't', option.text));
      button.appendChild(dotsEl(Engine.syllables(option.text), sec.target));
      if (option.word) button.appendChild(el('span', 'w', option.word.w + ': ' + option.word.def));
      button.addEventListener('click', function () {
        if (!line.orig) line.orig = line.text;
        line.text = option.text;
        line.picked = option.kind;
        state.justPicked = index;
        if (option.kind !== 'rhyme') state.stamp = 1;
        render();
      });
      box.appendChild(button);
    });
    box.appendChild(el('span', 'preview-tag', "Preview: scene reviewers haven't checked these yet."));
    if (line.orig && line.orig !== line.text) {
      var undo = el('button', 'undo', 'undo');
      undo.type = 'button';
      undo.addEventListener('click', function () {
        line.text = line.orig;
        delete line.orig;
        delete line.picked;
        state.justPicked = -1;
        render();
      });
      box.appendChild(undo);
    }
    return box;
  }

  function renderDock() {
    $('dock-line').textContent = Lab.tip(state.genre);
    $('mic').classList.toggle('live', state.mic);
    var tempo = Bpm.label(state.genre) || '116 BPM';
    $('bpm').textContent = tempo;
    $('bpm-box').setAttribute('aria-label', 'Tempo ' + tempo.replace(' BPM', '') + ' BPM');
  }

  function renderChat() {
    var log = $('chat-log');
    log.textContent = '';
    typed.forEach(function (row) {
      if (row.u) {
        log.appendChild(el('div', 'bubble me', row.u));
        return;
      }
      if (row.loading) {
        log.appendChild(el('div', 'bubble plai-b', 'Listening.'));
        return;
      }
      if (row.error) {
        log.appendChild(el('div', 'bubble plai-b', row.error));
        var retry = el('button', 'say booth-retry', 'Try again');
        retry.type = 'button';
        retry.addEventListener('click', function () { sendTurn('', true); });
        log.appendChild(retry);
        return;
      }
      if (!row.p) return;
      var turn = el('div', 'plai-turn');
      if (row.pose) {
        var face = document.createElement('img');
        face.className = 'plai-pose plai-pose-chat';
        face.alt = 'Plai';
        face.width = 64;
        face.height = 64;
        face.src = poseSrc(row.pose);
        turn.appendChild(face);
      }
      turn.appendChild(el('div', 'bubble plai-b', row.p));
      log.appendChild(turn);
      if (row.squad && row.squad.length) paintSquad(log, row.squad);
    });
    var reply = $('reply');
    reply.textContent = '';
    var form = el('div', 'couch-form');
    var input = document.createElement('textarea');
    input.maxLength = 600;
    input.placeholder = 'Type how it went...';
    input.setAttribute('aria-label', 'Type how it went...');
    var send = el('button', 'say', 'Send');
    send.type = 'button';
    if (state.boothBusy) send.disabled = true;
    send.addEventListener('click', function () { sendTurn(input.value); });
    form.appendChild(input);
    form.appendChild(send);
    reply.appendChild(form);
    renderPins();
  }

  function renderPins() {
    var pins = { feel: [], detail: [], phrase: [], title: '', sound: '' };
    typed.forEach(function (row) {
      var pack = row.pins || {};
      ['feel', 'detail', 'phrase'].forEach(function (key) {
        if (pack[key]) pins[key] = pins[key].concat(pack[key]);
      });
      if (pack.title) pins.title = pack.title;
      if (pack.sound) pins.sound = pack.sound;
    });
    var list = $('pin-list');
    list.textContent = '';
    function pin(label, cls, values) {
      if (!values || !values.length) return;
      var card = el('div', 'pin' + (cls ? ' ' + cls : ''));
      card.appendChild(el('b', null, label));
      var body = el('div', 'v');
      values.forEach(function (value) { body.appendChild(el('span', 'chip', value)); });
      card.appendChild(body);
      list.appendChild(card);
    }
    pin('feeling', '', pins.feel);
    pin('real details', '', pins.detail);
    pin('their words', '', pins.phrase);
    if (pins.title) pin('title line?', 'title', [pins.title]);
    if (pins.sound) pin('sound', '', [pins.sound]);
  }

  function boothHistory() {
    return typed.filter(function (row) {
      return row.u || (row.p && !row.loading && !row.error);
    }).map(function (row) {
      return { role: row.u ? 'user' : 'assistant', text: row.u || row.p };
    }).slice(-8);
  }

  function dropBoothWait() {
    typed = typed.filter(function (row) { return !row.loading && !row.error; });
  }

  function sendTurn(text, retry) {
    if (state.boothBusy) return;
    var message = String(text || '').trim();
    if (!retry && !message) return;
    dropBoothWait();
    if (!retry) typed.push({ u: message });
    if (retry && !typed.some(function (row) { return row.u; })) return;
    state.boothBusy = true;
    typed.push({ loading: true });
    var room = document.querySelector('[data-room="booth"]');
    if (room) paintRoom(room, { talkback: 'Listening.', active_pose: 'thinking', live: false });
    render();
    fetch('/api/song-helper?action=couch-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns: boothHistory() })
    }).then(function (res) { return res.json(); }).then(function (data) {
      dropBoothWait();
      var spoken = data && (data.talkback || data.studio_message || data.reply);
      if (data && data.live && data.fallback === false && spoken) {
        typed.push({ p: spoken, pins: data.pins, squad: squadRows(data), pose: data.active_pose || 'idle' });
        paintRoom(room, data);
        state.liveCouch = true;
      } else {
        typed.push({ error: "Plai didn't catch that." });
        if (room) paintRoom(room, { talkback: "Plai didn't catch that.", active_pose: 'idle', live: false });
        state.liveCouch = false;
      }
      state.boothBusy = false;
      render();
    }).catch(function () {
      dropBoothWait();
      typed.push({ error: "Plai didn't catch that." });
      state.boothBusy = false;
      state.liveCouch = false;
      render();
    });
  }

  function renderMap() {
    var map = $('map');
    map.textContent = '';
    map.appendChild(el('h3', null, "Writers' room"));
    var you = el('div', 'you');
    you.appendChild(el('b', null, 'YOU'));
    you.appendChild(el('div', null, '"Invisible in my own idea"'));
    map.appendChild(you);
    var nodes = el('div', 'nodes');
    [
      ['hook', 'Hook', 'catchy, repeats', ['Title is the hook. Sing it twice.', 'Clipped or not, it repeats. That sticks.']],
      ['verse', 'Verse', 'story, details', ['Open on the coffee, two seats down.', '"I told you at lunch" is the receipt.']],
      ['flow', 'Flow', 'slang, beats, pocket', ['Title runs ' + Engine.syllables('Invisible in my own idea') + ' beats. Clip "own" and it bounces.']]
    ].forEach(function (node) {
      var card = el('div', 'node');
      card.dataset.n = node[0];
      card.appendChild(el('b', null, node[1]));
      card.appendChild(el('small', null, node[2]));
      node[3].forEach(function (text) {
        var bubble = el('div', 'hb');
        bubble.appendChild(el('i', null, node[1]));
        bubble.appendChild(document.createTextNode(text));
        card.appendChild(bubble);
      });
      nodes.appendChild(card);
    });
    map.appendChild(nodes);
    var choice = el('div', 'choice');
    choice.appendChild(el('div', 'ask', 'Plai: two ways in. Pick one.'));
    var cards = el('div', 'cards');
    Object.keys(Lab.DIRECTIONS).forEach(function (key) {
      var direction = Lab.DIRECTIONS[key];
      var sample = Lab.SONGS[key];
      var card = el('button', 'card' + (state.roomPick === key ? ' on' : (state.roomPick ? ' off' : '')));
      card.type = 'button';
      card.dataset.d = key;
      card.appendChild(el('b', null, direction.name));
      card.appendChild(el('em', null, direction.tag));
      card.appendChild(el('span', null, sample.secs[1].lines[0].text));
      card.addEventListener('click', function () { pickDirection(key); });
      cards.appendChild(card);
    });
    choice.appendChild(cards);
    map.appendChild(choice);
  }

  function pickDirection(key) {
    state.roomPick = key;
    state.songId = key;
    state.genre = Lab.DIRECTIONS[key].genre;
    state.line = -1;
    state.justPicked = -1;
    songs[key] = JSON.parse(JSON.stringify(Lab.SONGS[key]));
    render();
    if (isPhone()) goStep(3);
  }

  function renderPad() {
    var pad = $('pad');
    var acts = $('pad-actions');
    pad.textContent = '';
    acts.textContent = '';
    if (!state.roomPick) {
      pad.appendChild(el('div', 'sec')).appendChild(el('span', null, 'Hook'));
      var empty = el('div', 'row');
      empty.appendChild(el('span', 'dots'));
      empty.appendChild(el('span', 'ltext', 'Invisible in my own idea'));
      pad.appendChild(empty);
      ['pick a way in', 'lines land here'].forEach(function (text) {
        var row = el('div', 'row');
        row.appendChild(el('span', 'dots'));
        row.appendChild(el('span', 'ph', text));
        pad.appendChild(row);
      });
      return;
    }
    var current = songs[state.roomPick];
    var texts = [];
    current.secs.forEach(function (sec) { sec.lines.forEach(function (line) { texts.push(line.text); }); });
    var colors = Engine.colorLines(texts);
    var at = 0;
    current.secs.forEach(function (sec) {
      var label = el('div', 'sec');
      label.appendChild(el('span', null, sec.tag));
      pad.appendChild(label);
      sec.lines.forEach(function (line) {
        var row = el('div', 'row');
        row.appendChild(dotsEl(Engine.syllables(line.text), sec.target));
        var text = el('span', 'ltext');
        text.appendChild(textWithHL(line.text, colors[at]));
        at += 1;
        row.appendChild(text);
        pad.appendChild(row);
      });
    });
    var go = el('button', 'btn', 'Take it to the desk');
    go.type = 'button';
    go.addEventListener('click', function () {
      state.screen = 'desk';
      render();
      window.scrollTo(0, 0);
    });
    acts.appendChild(go);
  }

  function renderSteps() {
    var host = $('steps-dots');
    host.textContent = '';
    STEP_NAMES.forEach(function (name, index) {
      var button = el('button', state.step === index ? 'on' : '');
      button.type = 'button';
      button.appendChild(el('i'));
      button.appendChild(document.createTextNode(name));
      button.setAttribute('aria-label', 'Step ' + (index + 1) + ': ' + name);
      button.addEventListener('click', function () { goStep(index); });
      host.appendChild(button);
    });
    var panels = document.querySelectorAll('#session .panel');
    Array.prototype.forEach.call(panels, function (panel, index) {
      panel.classList.toggle('on', index === state.step);
    });
  }

  function goStep(index) {
    state.step = index;
    renderSteps();
  }

  function reportLines() {
    var rows = [];
    song().secs.forEach(function (sec) {
      sec.lines.forEach(function (line, index) {
        rows.push({ section: sec.tag, n: index + 1, text: line.text, target: sec.target });
      });
    });
    var stamp = Lab.STAMPS[state.stamp] || Lab.STAMPS[1];
    return Report.build({ title: song().title, lines: rows, stamp: stamp.label });
  }

  function renderResults() {
    var tabs = $('result-tabs');
    tabs.textContent = '';
    [['lyrics', 'Lyrics'], ['sound', 'Sound'], ['save', 'Save & release']].forEach(function (tab) {
      var button = el('button', state.tab === tab[0] ? 'on' : '', tab[1]);
      button.type = 'button';
      button.addEventListener('click', function () { state.tab = tab[0]; render(); });
      tabs.appendChild(button);
    });
    var body = $('result-body');
    body.textContent = '';
    var report = el('div', 'report');
    var head = el('div', 'r');
    head.appendChild(el('b', null, song().title));
    var stamp = el('button', 'stamp');
    stamp.type = 'button';
    renderStamp(stamp);
    stamp.addEventListener('click', function () { cycleStamp(stamp); });
    var marks = el('div', 'marks');
    marks.appendChild(stamp);
    head.appendChild(marks);
    report.appendChild(head);
    function row(label, fill) {
      var line = el('div', 'r');
      line.appendChild(el('b', null, label));
      var box = el('div', 'marks');
      fill(box);
      line.appendChild(box);
      report.appendChild(line);
    }
    var notes = reportLines();
    if (state.tab === 'lyrics') {
      row('Rhyme', function (box) {
        notes.rhyme.forEach(function (item) { box.appendChild(el('span', 'chip', item.text)); });
      });
      row('Beats', function (box) {
        box.classList.add('beats');
        notes.beats.forEach(function (item) {
          var line = el('span', 'ln');
          line.appendChild(el('em', null, item.label));
          line.appendChild(dotsEl(item.count, item.target));
          box.appendChild(line);
        });
      });
      row('Pictures', function (box) {
        if (!notes.pictures.length) box.appendChild(el('span', 'chip', 'none'));
        notes.pictures.forEach(function (word) { box.appendChild(el('span', 'chip', word + ' ✓')); });
      });
      row('Repeats', function (box) {
        notes.repeats.forEach(function (item) { box.appendChild(el('span', 'chip', item.text)); });
      });
    } else if (state.tab === 'sound') {
      row('Sound', function (box) {
        [state.genre, state.era, state.region, state.language, Bpm.label(state.genre)].forEach(function (value) {
          if (value) box.appendChild(el('span', 'chip', value));
        });
      });
    } else {
      row('Label', function (box) { box.appendChild(el('span', 'chip', 'tap the stamp to change it')); });
      row('Save', function (box) {
        var button = el('button', 'undo', 'Save');
        button.type = 'button';
        button.addEventListener('click', saveSong);
        box.appendChild(button);
      });
    }
    body.appendChild(report);
  }

  function show(name) {
    ['home', 'desk', 'session', 'results'].forEach(function (id) {
      var on = state.screen === id || (id === 'session' && (state.screen === 'couch' || state.screen === 'room'));
      $('screen-' + id).hidden = !on;
    });
    document.body.classList.toggle('on-desk', state.screen === 'desk');
    document.body.classList.toggle('on-home', state.screen === 'home');
    $('session').classList.toggle('room', state.screen === 'room');
    $('drawer').classList.toggle('show', name === 'export' || state.screen === 'export');
  }

  function render() {
    show();
    $('rack').classList.toggle('open', !!state.rackOpen);
    $('rack-toggle').setAttribute('aria-expanded', state.rackOpen ? 'true' : 'false');
    $('rack-caret').textContent = state.rackOpen ? '-' : '+';
    renderPads();
    renderPresets($('home-presets'));
    renderPresets($('rack-presets'));
    renderSheet();
    renderDock();
    renderStamp($('stamp'));
    renderChat();
    renderMap();
    renderPad();
    renderSteps();
    paintCredits();
    paintSave();
    if (state.screen === 'results') renderResults();
    if (state.screen === 'export') $('drawer').classList.add('show');
    if (bootReady) scheduleSave();
  }

  var lyricId = '';
  var saveBase = '';
  var bootReady = false;
  var saveTimer = 0;
  var saveFlight = null;
  var saveAgain = false;
  var saveNote = '';

  function signedInNow() {
    if (state.signedIn) return true;
    var api = window.PlaigroundMembership;
    return !!(api && typeof api.isSignedIn === 'function' && api.isSignedIn());
  }

  function songPayload() {
    var stamp = Lab.STAMPS[state.stamp] || Lab.STAMPS[1];
    var current = song();
    return {
      title: current.title,
      text: UI.cleanLyrics(current),
      label: stamp.label,
      mode: 'notebook',
      mood: state.genre,
      style: UI.styleLine(state),
      notebook: {
        genre: state.genre,
        era: state.era,
        region: state.region,
        language: state.language,
        topic: state.topic,
        stamp: stamp.label,
        secs: (current.secs || []).map(function (sec) {
          return {
            tag: sec.tag,
            target: sec.target,
            lines: (sec.lines || []).map(function (line) { return { text: line.text }; })
          };
        })
      }
    };
  }

  function fingerprint() {
    return JSON.stringify(songPayload());
  }

  function paintSave() {
    var button = $('desk-save');
    var note = $('desk-save-note');
    if (!button) return;
    button.textContent = signedInNow() ? 'Save' : 'Sign in to save';
    if (note) note.textContent = signedInNow() ? saveNote : '';
  }

  function scheduleSave() {
    if (!signedInNow()) return;
    if (fingerprint() === saveBase) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveSong(false); }, 800);
  }

  function lineFromText(text) {
    return { text: text, rw: { rhyme: text, flow: text, slang: null } };
  }

  function applySavedSong(row) {
    if (!row) return;
    lyricId = row.id || '';
    var book = row.notebook || {};
    var secs = Array.isArray(book.secs) && book.secs.length ? book.secs.map(function (sec) {
      return {
        tag: sec.tag || 'Verse 1',
        target: sec.target || 8,
        lines: (sec.lines || []).map(function (line) { return lineFromText(line.text || ''); }).filter(function (line) { return line.text; })
      };
    }).filter(function (sec) { return sec.lines.length; }) : [];
    if (!secs.length) {
      var chunks = String(row.text || '').split(/\n{2,}/).filter(function (part) { return part.trim(); });
      secs = [{
        tag: 'Verse 1',
        target: 8,
        lines: (chunks[0] || row.text || ' ').split('\n').map(function (text) { return lineFromText(text); }).filter(function (line) { return line.text.trim(); })
      }];
    }
    songs.kitchen = { title: row.title || 'Untitled', secs: secs };
    state.songId = 'kitchen';
    state.screen = 'desk';
    if (book.genre && Lab.GENRES.indexOf(book.genre) >= 0) state.genre = book.genre;
    else if (row.mood && Lab.GENRES.indexOf(row.mood) >= 0) state.genre = row.mood;
    if (book.era && Lab.ERAS.indexOf(book.era) >= 0) state.era = book.era;
    if (book.region && Lab.REGIONS.indexOf(book.region) >= 0) state.region = book.region;
    if (book.language && Lab.LANGUAGES.indexOf(book.language) >= 0) state.language = book.language;
    if (book.topic) state.topic = String(book.topic).slice(0, 120);
    var stampLabel = book.stamp || row.label || '';
    var stampAt = -1;
    Lab.STAMPS.forEach(function (stamp, index) { if (stamp.label === stampLabel) stampAt = index; });
    if (stampAt >= 0) state.stamp = stampAt;
    saveBase = fingerprint();
    saveNote = 'Saved';
    bootReady = true;
  }

  function loadSavedSong(id) {
    if (!id) return;
    fetch('/api/me/lyrics', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, status: res.status, data: data }; }); })
      .then(function (result) {
        if (result.status === 401) {
          state.signedIn = false;
          saveBase = fingerprint();
          bootReady = true;
          paintSave();
          return;
        }
        var rows = (result.data && result.data.songs) || [];
        var row = null;
        rows.forEach(function (item) { if (!row && item.id === id) row = item; });
        if (!row) {
          saveBase = fingerprint();
          bootReady = true;
          return;
        }
        state.signedIn = true;
        applySavedSong(row);
        render();
      })
      .catch(function () {
        saveBase = fingerprint();
        bootReady = true;
      });
  }

  function saveSong(manual) {
    if (!signedInNow()) {
      if (manual) window.location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search + location.hash);
      return;
    }
    var payload = songPayload();
    if (!String(payload.text || '').trim()) return;
    if (!manual && fingerprint() === saveBase) return;
    if (saveFlight) { saveAgain = true; return; }
    saveNote = 'Saving';
    paintSave();
    var body = lyricId ? { action: 'update', id: lyricId, song: payload } : payload;
    saveFlight = fetch('/api/me/lyrics', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) {
          state.signedIn = false;
          saveNote = '';
          paintSave();
          return;
        }
        if (res.ok && data && data.ok && data.song) {
          lyricId = data.song.id || lyricId;
          saveBase = fingerprint();
          saveNote = 'Saved';
        } else {
          saveNote = 'Could not save. Try again.';
        }
        paintSave();
      });
    }).catch(function () {
      saveNote = 'Could not save. Try again.';
      paintSave();
    }).then(function () {
      saveFlight = null;
      if (saveAgain) { saveAgain = false; saveSong(false); }
    });
  }

  function copyText(text, toast) {
    var done = function () { $('toast').textContent = toast; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else done();
  }

  var POSE_FILE = { idle: 'happy', thinking: 'thinking', dancing: 'dancing', autopilot: 'autopilot-wheel' };

  function poseSrc(name) {
    return '/assets/plai/' + (POSE_FILE[name] || 'happy') + '.webp';
  }

  function squadRows(data) {
    if (!data) return [];
    if (data.squad_banter && data.squad_banter.length) return data.squad_banter;
    var pitches = data.squad_pitches || {};
    return [
      { speaker: 'Vibe', pitch: pitches.vibe },
      { speaker: 'Dex', pitch: pitches.dex },
      { speaker: '808', pitch: pitches['808'] }
    ].filter(function (row) { return row.pitch; });
  }

  function paintSquad(parent, rows) {
    (rows || []).forEach(function (row) {
      if (!row || !row.pitch) return;
      var line = el('p', 'talkback-pitch');
      line.appendChild(el('b', null, row.speaker || ''));
      line.appendChild(document.createTextNode(' ' + row.pitch));
      parent.appendChild(line);
    });
  }

  function paintRoom(room, data) {
    if (!room || !data) return;
    var line = room.querySelector('.talkback-line');
    var squad = room.querySelector('.talkback-squad');
    var pose = room.querySelector('.plai-pose');
    var spoken = data.talkback || data.studio_message || data.reply;
    if (line && spoken) {
      line.textContent = spoken;
      line.setAttribute('data-live', data.live ? 'true' : 'false');
    }
    if (pose) {
      var poseName = data.active_pose || 'idle';
      pose.src = poseSrc(poseName);
      pose.setAttribute('data-pose', POSE_FILE[poseName] || 'happy');
    }
    if (!squad) return;
    var rows = squadRows(data);
    squad.textContent = '';
    if (rows.length) {
      squad.hidden = false;
      paintSquad(squad, rows);
    } else squad.hidden = true;
  }

  function sendTalkback(room, text, input, button) {
    var message = String(text || '').trim();
    if (!message || !room) return;
    if (button) button.disabled = true;
    var waiting = room.querySelector('.plai-pose');
    if (waiting) {
      waiting.src = poseSrc('thinking');
      waiting.setAttribute('data-pose', 'thinking');
    }
    fetch('/api/song-helper?action=couch-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns: [{ role: 'user', text: message }] })
    }).then(function (res) { return res.json(); }).then(function (data) {
      if (data && data.live && data.fallback === false && (data.talkback || data.studio_message || data.reply)) {
        paintRoom(room, data);
      } else {
        paintRoom(room, { talkback: "Plai didn't catch that. Try again.", live: false, active_pose: 'idle' });
      }
      if (input) input.value = '';
    }).catch(function () {
      paintRoom(room, { talkback: "Plai didn't catch that. Try again.", live: false, active_pose: 'idle' });
    }).then(function () {
      if (button) button.disabled = false;
    });
  }

  document.querySelectorAll('.talkback-ask').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var room = form.closest('[data-room]');
      var input = form.querySelector('textarea');
      if (room && room.getAttribute('data-room') === 'booth') {
        sendTurn(input && input.value);
        if (input) input.value = '';
        return;
      }
      sendTalkback(room, input && input.value, input, form.querySelector('button'));
    });
  });

  document.querySelectorAll('[data-door]').forEach(function (button) {
    button.addEventListener('click', function () {
      var door = button.getAttribute('data-door');
      if (door === 'improve') { window.location.href = '/ai-lyrics-generator?start=page'; return; }
      if (door === 'transform') { window.location.href = '/ai-lyrics-generator?start=based'; return; }
      if (door === 'couch') { state.screen = 'couch'; state.chatStep = 0; render(); goStep(0); return; }
      state.screen = 'desk';
      render();
    });
  });
  document.querySelectorAll('[data-go]').forEach(function (button) {
    button.addEventListener('click', function () {
      var go = button.getAttribute('data-go');
      if (go === 'export') { $('drawer').classList.add('show'); return; }
      state.screen = go;
      $('drawer').classList.remove('show');
      render();
    });
  });
  $('rack-toggle').addEventListener('click', function () {
    state.rackOpen = !state.rackOpen;
    render();
  });
  $('mic').addEventListener('click', function () {
    state.mic = !state.mic;
    renderDock();
  });
  $('stamp').addEventListener('click', function () { cycleStamp($('stamp')); });
  if (window.HookWarmup) {
    window.HookWarmup.mount($('hook-warm-host'), {
      onPick: function (title) {
        song().title = title;
        var first = song().secs && song().secs[1] && song().secs[1].lines && song().secs[1].lines[0];
        if (first && !first.orig) first.text = title;
        render();
      }
    });
  }
  $('copy-suno').addEventListener('click', function () {
    copyText(UI.taggedLyrics(song()) + '\n\n' + UI.styleLine(state), 'Copied.');
  });
  $('copy-clean').addEventListener('click', function () {
    copyText(UI.cleanLyrics(song()), 'Clean lyrics copied.');
  });
  $('copy-pdf').addEventListener('click', function () { window.print(); });
  $('save-plai').addEventListener('click', function () { saveSong(true); });
  $('desk-save').addEventListener('click', function () { saveSong(true); });
  $('close-drawer').addEventListener('click', function () { $('drawer').classList.remove('show'); });

  function fromHash() {
    bootReady = false;
    var hash = (location.hash || '#home').slice(1);
    var query = new URLSearchParams(location.search);
    songs = Lab.cloneSongs();
    state.line = -1;
    state.justPicked = -1;
    state.roomPick = null;
    state.songId = 'kitchen';
    state.chatStep = 0;
    typed = [];
    if (hash === 'punchin' || hash === 'scratch') state.line = 2;
    if (query.get('title')) songs.kitchen.title = String(query.get('title')).slice(0, 80);
    if (query.get('topic')) state.topic = String(query.get('topic')).slice(0, 120);
    if ((query.get('title') || query.get('topic')) && hash !== 'home') state.screen = 'desk';
    if (query.get('genre') && Lab.GENRES.indexOf(query.get('genre')) >= 0) state.genre = query.get('genre');
    if (query.get('region') && Lab.REGIONS.indexOf(query.get('region')) >= 0) state.region = query.get('region');
    if (query.get('era') && Lab.ERAS.indexOf(query.get('era')) >= 0) state.era = query.get('era');
    if (query.get('line') !== null && !isNaN(+query.get('line'))) state.line = +query.get('line');
    if (query.get('tab')) state.tab = query.get('tab');
    var pick = query.get('pick') || (hash === 'scratch' ? 'slang' : '');
    if (pick && state.line >= 0) {
      var option = optionsFor(state.line).filter(function (row) { return row.kind === pick; })[0];
      var row = flat()[state.line];
      if (option && row) {
        row.line.orig = row.line.text;
        row.line.text = option.text;
        row.line.picked = pick;
        state.justPicked = state.line;
      }
    }
    var step = 0;
    if (hash === 'couch') { state.screen = 'couch'; state.chatStep = Lab.CHAT.filter(function (row) { return row.u; }).length; }
    else if (hash === 'room' || hash === 'room-picked') {
      state.screen = 'room';
      state.chatStep = Lab.CHAT.filter(function (row) { return row.u; }).length;
      step = 2;
      if (hash === 'room-picked') {
        state.roomPick = 'quiet';
        state.songId = 'quiet';
        if (!query.get('genre')) state.genre = 'R&B';
        step = 3;
      }
    } else if (hash === 'results') state.screen = 'results';
    else if (hash === 'export') state.screen = 'desk';
    else if (hash === 'desk' || hash === 'hook' || hash === 'console' || hash === 'punchin' || hash === 'scratch') state.screen = 'desk';
    else state.screen = 'home';
    if (query.get('step') !== null) step = +query.get('step');
    var openId = query.get('song') || '';
    if (openId) state.screen = 'desk';
    render();
    goStep(step);
    if (hash === 'export') $('drawer').classList.add('show');
    if (openId) loadSavedSong(openId);
    else {
      saveBase = fingerprint();
      bootReady = true;
    }
  }

  function paintAuth() {
    var link = $('desk-auth');
    if (!link) return;
    var api = window.PlaigroundMembership;
    var on = !!(api && typeof api.isSignedIn === 'function' && api.isSignedIn());
    link.textContent = on ? 'Account' : 'Log in';
    link.setAttribute('href', on ? '/settings.html' : '/login.html?next=/song-lab');
    if (on) state.signedIn = true;
    paintSave();
  }

  function loadCredits() {
    fetch('/api/song-helper?action=dev-status', { credentials: 'same-origin' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        state.signedIn = !!(data && data.signedIn);
        state.credits = data && data.signedIn && data.credits != null ? data.credits : null;
        paintCredits();
        paintSave();
        if (bootReady) scheduleSave();
      })
      .catch(function () { paintCredits(); });
  }

  window.SL = { state: state, tip: Lab.tip, genres: Lab.GENRES, render: render };
  window.addEventListener('hashchange', fromHash);
  fetch('/data/song-lab-preview-slang.json').then(function (res) { return res.json(); }).then(function (data) {
    brain = data || brain;
  }).catch(function () {}).then(function () {
    return fetch('/data/cmu-trim.json').then(function (res) { return res.json(); }).then(function (table) {
      if (table) Engine.load(table);
    }).catch(function () {});
  }).then(fromHash);
  paintAuth();
  if (window.PlaigroundMembership && typeof window.PlaigroundMembership.whenReady === 'function') {
    window.PlaigroundMembership.whenReady(paintAuth);
  }
  loadCredits();
})();
