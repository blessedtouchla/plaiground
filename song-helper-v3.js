(function () {
  var flow = window.SongV3Flow;
  var writer = window.SongV3;
  var root = document.getElementById('v3');
  if (!flow || !writer || !root) return;

  var DRAFT = 'plaiground.v3.draft';
  var BEST = 'plaiground.v3.best';
  var APP = 'plaiground.v3.musicApp';
  var WALLET = 'plaiground.v3.wallet';

  if (location.hash === '#fresh') {
    localStorage.removeItem(DRAFT);
    localStorage.removeItem(WALLET);
    localStorage.removeItem(BEST);
    localStorage.removeItem(APP);
  }

  var state = flow.fresh();
  state.best = readNum(BEST);

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function readNum(key) {
    var n = parseInt(localStorage.getItem(key) || '0', 10);
    return isFinite(n) ? n : 0;
  }

  function wallet() {
    try {
      var saved = JSON.parse(localStorage.getItem(WALLET) || '');
      if (saved && typeof saved.freeLeft === 'number') return saved;
    } catch (err) { /* fresh wallet */ }
    return { freeLeft: writer.FREE_AI_WRITES, credits: 0 };
  }

  function saveWallet(next) {
    localStorage.setItem(WALLET, JSON.stringify(next));
  }

  function savedDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT) || ''); }
    catch (err) { return null; }
  }

  function setState(next) {
    state = next;
    paint();
    if (state.screen === 'reveal' && state.points > readNum(BEST)) {
      localStorage.setItem(BEST, String(state.points));
    }
  }

  function spend() {
    var price = flow.quote(wallet());
    if (!price.ok) {
      state = flow.act(state, { type: 'text', field: 'notice', value: state.notice });
      state.notice = price.error;
      paint();
      return false;
    }
    saveWallet(flow.charge(wallet()));
    return true;
  }

  function paint() {
    var view = flow.view(state);
    root.setAttribute('data-screen', view.id);
    root.innerHTML = '';
    var wrap = el('div', 'v3-wrap');
    var top = el('div', 'v3-top');
    var word = el('a', 'v3-word', 'PLAIGROUND');
    word.href = 'index.html';
    top.appendChild(word);
    var purse = wallet();
    top.appendChild(el('span', 'v3-credits', purse.freeLeft > 0 ? 'FREE WRITE' : ('CREDITS ' + purse.credits)));
    wrap.appendChild(top);
    wrap.appendChild(el('p', 'v3-preview', 'Preview. The live Song Helper stays put.'));

    var points = el('div', 'v3-points');
    points.appendChild(el('b', '', 'Score ' + state.points.toLocaleString('en-US')));
    var track = el('div', 'v3-points-track');
    var fill = el('div', 'v3-points-fill');
    fill.style.width = Math.min(100, Math.round(state.points / 20)) + '%';
    track.appendChild(fill);
    points.appendChild(track);
    wrap.appendChild(points);

    if (view.id !== 'hall') {
      var bar = el('div', 'v3-bar');
      var back = el('button', 'v3-back', 'Back');
      back.type = 'button';
      back.setAttribute('data-act', 'back');
      back.addEventListener('click', function () { setState(flow.act(state, { type: 'back' })); });
      bar.appendChild(back);
      if (view.label) bar.appendChild(el('span', 'v3-badge', view.label));
      var quit = el('button', 'v3-quit', 'Save and quit');
      quit.type = 'button';
      quit.setAttribute('data-act', 'quit');
      quit.addEventListener('click', function () {
        localStorage.setItem(DRAFT, JSON.stringify(state));
        var best = state.best;
        state = flow.fresh();
        state.best = best;
        paint();
      });
      bar.appendChild(quit);
      wrap.appendChild(bar);
    }

    if (view.id === 'hall') {
      var draft = savedDraft();
      if (draft && draft.screen && draft.screen !== 'hall') {
        var title = draft.title ? draft.title : 'your song';
        var cont = el('button', 'v3-continue', 'Continue: ' + title);
        cont.type = 'button';
        cont.setAttribute('data-act', 'continue');
        cont.addEventListener('click', function () {
          state = draft;
          state.best = readNum(BEST);
          paint();
        });
        wrap.appendChild(cont);
      }
    }

    if (view.id === 'hall') {
      wrap.appendChild(el('p', 'v3-kicker', 'SONG HELPER ARCADE'));
      wrap.appendChild(el('h1', 'v3-pick', 'Pick your game'));
    }

    if (view.plai) {
      var host = el('div', 'v3-host');
      var face = el('span', 'v3-avatar');
      face.innerHTML = '<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#7D3CFF"/><circle cx="24" cy="28" r="3.2" fill="#fff"/><circle cx="40" cy="28" r="3.2" fill="#fff"/><path d="M22 40c3 5 17 5 20 0" fill="none" stroke="#F5C542" stroke-width="2.4" stroke-linecap="round"/></svg>';
      host.appendChild(face);
      host.appendChild(el('p', 'v3-plai', view.plai));
      wrap.appendChild(host);
    }
    if (view.note) wrap.appendChild(el('p', 'v3-note', view.note));
    if (view.notice) wrap.appendChild(el('p', view.sample ? 'v3-sample' : 'v3-notice', view.notice));
    if (view.marquee) {
      var board = el('div', 'v3-marquee', view.marquee);
      board.style.setProperty('--feel', view.color || '#F5C542');
      wrap.appendChild(board);
    }
    if (view.id === 'reveal') {
      var record = view.scoreLine === 'New high score';
      wrap.appendChild(el('p', 'v3-score' + (record ? ' is-record' : ''), view.scoreLine));
      if (view.label) wrap.appendChild(el('span', 'v3-badge', view.label));
      wrap.appendChild(el('pre', 'v3-lyrics', view.lyrics || ''));
      if (view.checks && view.checks.length) {
        var hit = el('ul', 'v3-checks');
        view.checks.forEach(function (row) {
          hit.appendChild(el('li', 'on', row.label));
        });
        wrap.appendChild(hit);
      }
    }

    var layout = el('div', 'v3-layout' + (view.rhyme ? ' has-rhyme' : ''));
    var main = el('div', 'v3-main');

    if (view.questions && view.questions.length) {
      var questions = el('div', 'v3-questions');
      view.questions.forEach(function (q) {
        var btn = el('button', 'v3-mini', q.label);
        btn.type = 'button';
        btn.setAttribute('data-act', 'question');
        btn.setAttribute('data-id', q.id);
        btn.addEventListener('click', function () {
          setState(flow.act(state, { type: 'question', id: q.id }));
        });
        questions.appendChild(btn);
      });
      main.appendChild(questions);
    }

    if (view.tiles && view.tiles.length) {
      var tiles = el('div', view.id === 'hall' ? 'v3-cabs' : 'v3-tiles');
      view.tiles.forEach(function (tile) {
        var btn = el('button', view.id === 'hall' ? cabinetClass(tile) : ('v3-tile' + (tile.on ? ' on' : '')));
        btn.type = 'button';
        btn.setAttribute('data-act', 'tile');
        btn.setAttribute('data-id', tile.id);
        if (view.id === 'hall') {
          btn.appendChild(cabinetFace(tile));
        } else {
          btn.appendChild(document.createTextNode(tile.label));
          if (tile.sticker) btn.appendChild(el('span', 'v3-sticker', tile.sticker));
          if (tile.small) btn.appendChild(el('small', '', tile.small));
          if (tile.badge) btn.appendChild(el('span', 'v3-badge-fit', tile.badge));
        }
        btn.addEventListener('click', function () {
          btn.classList.add('is-pop');
          setState(flow.act(state, { type: 'tile', id: tile.id }));
        });
        tiles.appendChild(btn);
      });
      main.appendChild(tiles);
    }

    if (view.box) paintBox(main, view.box);
    if (view.ideas && view.ideas.length && !state.titleHelp) {
      var ideas = el('div', 'v3-ideas');
      var ideaLabel = el('p', 'v3-note', 'Need an idea?');
      ideas.appendChild(ideaLabel);
      view.ideas.forEach(function (idea) {
        var btn = el('button', 'v3-mini', idea);
        btn.type = 'button';
        btn.setAttribute('data-act', 'idea');
        btn.addEventListener('click', function () {
          setState(flow.act(state, { type: 'idea', id: idea }));
        });
        ideas.appendChild(btn);
      });
      main.appendChild(ideas);
    }

    if (view.chips && view.chips.length) {
      view.chips.forEach(function (chip) {
        var row = el('div', 'v3-chips');
        chip.options.forEach(function (option) {
          var chipLabel = chip.group === 'language' ? ('Language: ' + option) : option;
          var btn = el('button', 'v3-chip' + (chip.value === option ? ' on' : ''), chipLabel);
          btn.type = 'button';
          btn.setAttribute('data-act', 'chip');
          btn.setAttribute('data-group', chip.group);
          btn.setAttribute('data-id', option);
          btn.addEventListener('click', function () {
            setState(flow.act(state, { type: 'chip', group: chip.group, id: option }));
          });
          row.appendChild(btn);
        });
        main.appendChild(row);
      });
    }

    if (view.advanced) {
      var toggle = el('button', 'v3-mini', view.advanced.open ? 'Hide advanced' : 'Advanced');
      toggle.type = 'button';
      toggle.setAttribute('data-act', 'advanced-toggle');
      toggle.addEventListener('click', function () {
        setState(flow.act(state, { type: 'advanced-toggle' }));
      });
      main.appendChild(toggle);
      if (view.advanced.open) {
        view.advanced.groups.forEach(function (group) {
          main.appendChild(el('p', 'v3-note', group.label));
          var row = el('div', 'v3-tiles');
          group.options.forEach(function (option) {
            var on = view.advanced.value[group.id] === option[0];
            var btn = el('button', 'v3-mini' + (on ? ' on' : ''), option[1]);
            btn.type = 'button';
            btn.setAttribute('data-act', 'advanced');
            btn.setAttribute('data-group', group.id);
            btn.setAttribute('data-id', option[0]);
            btn.addEventListener('click', function () {
              setState(flow.act(state, { type: 'advanced', group: group.id, id: option[0] }));
            });
            row.appendChild(btn);
          });
          main.appendChild(row);
        });
      }
    }

    if (view.checks && view.id !== 'reveal') {
      var list = el('ul', 'v3-checks');
      view.checks.forEach(function (row) {
        list.appendChild(el('li', row.on ? 'on' : '', row.label));
      });
      main.appendChild(list);
    }

    if (view.offers && view.offers.length) {
      var offers = el('div', 'v3-offers');
      offers.appendChild(el('p', 'v3-note', 'Pick one. These are new lines.'));
      view.offers.forEach(function (line) {
        var btn = el('button', 'v3-mini', line);
        btn.type = 'button';
        btn.setAttribute('data-act', 'keep');
        btn.addEventListener('click', function () {
          setState(flow.act(state, { type: 'keep', line: line }));
        });
        offers.appendChild(btn);
      });
      main.appendChild(offers);
    }

    if (view.together) {
      var give = el('button', 'v3-mini', flow.buttonPrice(wallet(), 'Give me a line'));
      give.type = 'button';
      give.setAttribute('data-act', 'give');
      give.addEventListener('click', function () {
        if (busy) return;
        var before = wallet();
        if (!spend()) return;
        busy = true;
        askWriter('v3-line', { userLines: [state.chorus, state.verse] }).then(function (data) {
          busy = false;
          var lines = data.lines && data.lines.length ? data.lines : writer.giveLines(flow.brief(state), [state.chorus, state.verse]);
          var next = flow.act(state, { type: 'offer', lines: lines });
          if (!data.lines || !data.lines.length || data.sample) next.notice = data.notice || writer.SAMPLE_NOTICE;
          setState(next);
        }).catch(function (err) {
          busy = false;
          if (err.status === 429 || err.status === 400) {
            saveWallet(before);
            state.notice = err.message;
            paint();
            return;
          }
          var lines = writer.giveLines(flow.brief(state), [state.chorus, state.verse]);
          var next = flow.act(state, { type: 'offer', lines: lines });
          next.notice = writer.SAMPLE_NOTICE;
          setState(next);
        });
      });
      var finish = el('button', 'v3-mini', flow.buttonPrice(wallet(), 'Finish my line'));
      finish.type = 'button';
      finish.setAttribute('data-act', 'finish');
      finish.addEventListener('click', function () {
        if (busy) return;
        var before = wallet();
        if (!spend()) return;
        busy = true;
        var partial = state.screen === 'a10v' ? state.verse : state.chorus;
        askWriter('v3-finish', { partial: partial }).then(function (data) {
          busy = false;
          var line = data.line || writer.finishLine(flow.brief(state), partial);
          var next = flow.act(state, { type: 'finish-apply', line: line });
          if (!data.line || data.sample) next.notice = data.notice || writer.SAMPLE_NOTICE;
          setState(next);
        }).catch(function (err) {
          busy = false;
          if (err.status === 429 || err.status === 400) {
            saveWallet(before);
            state.notice = err.message;
            paint();
            return;
          }
          var line = writer.finishLine(flow.brief(state), partial);
          var next = flow.act(state, { type: 'finish-apply', line: line });
          next.notice = writer.SAMPLE_NOTICE;
          setState(next);
        });
      });
      main.appendChild(give);
      main.appendChild(finish);
    }

    if (view.write) {
      var write = el('button', 'v3-go', flow.buttonPrice(wallet(), 'Write my song'));
      write.type = 'button';
      write.setAttribute('data-act', 'write');
      write.addEventListener('click', function () {
        if (busy) return;
        var before = wallet();
        if (!spend()) return;
        busy = true;
        write.disabled = true;
        write.textContent = 'Writing...';
        askWriter('v3-write').then(function (data) {
          busy = false;
          var song = data.song;
          if (!song || !song.text) song = localSample(writer.compose(flow.brief(state)));
          else if (data.sample) {
            song.sample = true;
            song.source = 'sample';
            song.notice = data.notice || writer.SAMPLE_NOTICE;
          }
          setState(flow.act(state, { type: 'wrote', song: song }));
        }).catch(function (err) {
          busy = false;
          if (err.status === 429 || err.status === 400) {
            saveWallet(before);
            state.notice = err.message;
            paint();
            return;
          }
          setState(flow.act(state, { type: 'wrote', song: localSample(writer.compose(flow.brief(state))) }));
        });
      });
      main.appendChild(write);
      main.appendChild(el('p', 'v3-note', 'New accounts get 1 free AI write. Then each AI write is 1 credit.'));
    }

    var actions = el('div', 'v3-actions');
    if (view.next) {
      var next = el('button', 'v3-go', view.next);
      next.type = 'button';
      next.setAttribute('data-act', 'next');
      next.addEventListener('click', function () { setState(flow.act(state, { type: 'next' })); });
      actions.appendChild(next);
    }
    if (view.skip) {
      var skip = el('button', 'v3-link', 'Skip');
      skip.type = 'button';
      skip.setAttribute('data-act', 'skip');
      skip.addEventListener('click', function () { setState(flow.act(state, { type: 'skip' })); });
      actions.appendChild(skip);
    }
    if (actions.childNodes.length) main.appendChild(actions);

    if (view.id === 'reveal') paintReveal(main, view);

    layout.appendChild(main);
    if (view.rhyme) layout.appendChild(rhymePanel());
    wrap.appendChild(layout);
    if (view.id === 'hall') {
      wrap.appendChild(el('p', 'v3-foot', 'Answering questions is free. Writing with AI uses 1 credit.'));
      wrap.appendChild(el('p', 'v3-foot-quiet', 'PREVIEW · ARCADE · NOT LIVE'));
    }
    root.appendChild(wrap);
  }

  var busy = false;

  function localSample(song) {
    song.sample = true;
    song.source = 'sample';
    song.notice = writer.SAMPLE_NOTICE;
    return song;
  }

  function askWriter(action, extra) {
    var body = Object.assign({ action: action, company_website: '' }, flow.brief(state), extra || {});
    return fetch('/api/song-helper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || !data || data.ok === false) {
          var err = new Error((data && data.error) || 'Could not write.');
          err.status = res.status;
          throw err;
        }
        return data;
      }).catch(function (err) {
        if (err && err.status) throw err;
        var bad = new Error('Could not write.');
        bad.status = res.status;
        throw bad;
      });
    });
  }

  function cabinetClass(tile) {
    return 'v3-cabinet cab-' + tile.id + (tile.id === 'parody' ? ' v3-tilt' : '');
  }

  function cabinetFace(tile) {
    var face = el('span', 'v3-cab-face');
    var icon = el('span', 'v3-cab-icon');
    icon.setAttribute('aria-hidden', 'true');
    face.appendChild(icon);
    var copy = el('span', 'v3-cab-copy');
    var title = el('b', '', tile.label);
    if (tile.sticker) title.appendChild(el('span', 'v3-sticker', tile.sticker));
    copy.appendChild(title);
    if (tile.small) copy.appendChild(el('small', '', tile.small));
    face.appendChild(copy);
    var press = el('span', 'v3-press', 'PRESS START');
    var meta = el('small', 'v3-cab-meta', tile.id === 'write' ? '1 PLAYER · ABOUT 5 MIN' : '1 PLAYER · ABOUT 3 MIN');
    if (tile.soon) meta.textContent = 'COMING SOON · 1 PLAYER · ABOUT 3 MIN';
    var stack = el('span', 'v3-cab-stack');
    stack.appendChild(face);
    stack.appendChild(press);
    stack.appendChild(meta);
    return stack;
  }

  function paintBox(parent, box) {
    var field = el('label', 'v3-field');
    var input = document.createElement('textarea');
    input.rows = box.rows || 3;
    input.value = box.value || '';
    input.placeholder = box.placeholder || '';
    input.setAttribute('data-field', box.field);
    input.addEventListener('input', function () {
      state = flow.act(state, { type: 'text', field: box.field, value: input.value });
      var view = flow.view(state);
      var list = root.querySelector('.v3-checks');
      if (list && view.checks) {
        list.innerHTML = '';
        view.checks.forEach(function (row) {
          list.appendChild(el('li', row.on ? 'on' : '', row.label));
        });
      }
    });
    field.appendChild(input);
    parent.appendChild(field);
  }

  function rhymePanel() {
    var panel = el('aside', 'v3-rhyme');
    panel.appendChild(el('h2', '', 'Rhyme it'));
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type a word';
    input.setAttribute('data-act', 'rhyme-word');
    var list = el('div', 'v3-tiles');
    function show() {
      list.innerHTML = '';
      flow.rhymesFor(input.value).forEach(function (word) {
        var btn = el('button', 'v3-mini', word);
        btn.type = 'button';
        btn.setAttribute('data-act', 'rhyme');
        btn.addEventListener('click', function () { insertRhyme(word); });
        list.appendChild(btn);
      });
    }
    input.addEventListener('input', show);
    panel.appendChild(input);
    panel.appendChild(list);
    return panel;
  }

  function insertRhyme(word) {
    var box = root.querySelector('textarea');
    if (!box) return;
    var start = box.selectionStart || box.value.length;
    var end = box.selectionEnd || start;
    var before = box.value.slice(0, start);
    var after = box.value.slice(end);
    var pad = before && !/\s$/.test(before) ? ' ' : '';
    var value = before + pad + word + after;
    var field = box.getAttribute('data-field');
    state = flow.act(state, { type: 'text', field: field, value: value });
    paint();
  }

  function paintReveal(parent, view) {
    var row = el('div', 'v3-actions');
    [['more', 'Keep going'], ['share', 'Share card'], ['save', 'Save']].forEach(function (pair) {
      var btn = el('button', 'v3-mini', pair[1]);
      btn.type = 'button';
      btn.setAttribute('data-act', pair[0]);
      btn.addEventListener('click', function () {
        if (pair[0] === 'save') {
          localStorage.setItem(DRAFT, JSON.stringify(state));
          state.notice = 'Saved on this device.';
          paint();
          return;
        }
        setState(flow.act(state, { type: pair[0] }));
      });
      row.appendChild(btn);
    });
    var clock = el('button', 'v3-link', 'Versions');
    clock.type = 'button';
    clock.setAttribute('data-act', 'clock');
    clock.addEventListener('click', function () { setState(flow.act(state, { type: 'clock' })); });
    row.appendChild(clock);
    parent.appendChild(row);

    if (view.moreOpen) {
      var more = el('div', 'v3-card');
      view.more.forEach(function (item) {
        var label = item.label;
        if (item.credit) label = flow.buttonPrice(wallet(), item.label);
        if (item.free) label = item.label + ' (free)';
        var btn = el('button', 'v3-mini', label);
        btn.type = 'button';
        if (item.note) btn.appendChild(el('small', '', item.note));
        more.appendChild(btn);
      });
      parent.appendChild(more);
    }
    if (view.shareOpen) {
      var card = el('div', 'v3-card');
      card.appendChild(el('p', '', (state.title || 'Untitled') + ' · ' + (state.label || '')));
      card.appendChild(el('p', '', view.scoreLine));
      parent.appendChild(card);
    }
    if (view.clockOpen) {
      var log = el('div', 'v3-card');
      (view.versions || []).forEach(function (version, index) {
        log.appendChild(el('p', '', 'Version ' + (index + 1) + ' · ' + version.label));
      });
      if (!view.versions || !view.versions.length) log.appendChild(el('p', '', 'No earlier versions yet.'));
      parent.appendChild(log);
    }

    parent.appendChild(el('p', 'v3-style', view.style));
    var tweaks = el('div', 'v3-chips');
    view.tweaks.forEach(function (tweak) {
      var btn = el('button', 'v3-chip' + (state.styleTweak === tweak.id ? ' on' : ''), tweak.label);
      btn.type = 'button';
      btn.setAttribute('data-act', 'tweak');
      btn.setAttribute('data-id', tweak.id);
      btn.addEventListener('click', function () {
        setState(flow.act(state, { type: 'tweak', id: tweak.id }));
      });
      tweaks.appendChild(btn);
    });
    parent.appendChild(tweaks);

    var copyStyle = el('button', 'v3-go' + (state.promptLit ? ' v3-lit' : ''), 'Copy style prompt');
    copyStyle.type = 'button';
    copyStyle.setAttribute('data-act', 'copy-style');
    copyStyle.addEventListener('click', function () {
      copyText(view.style);
      copyStyle.classList.add('v3-lit');
    });
    var copyOpen = el('button', 'v3-mini', 'Copy and open my music app');
    copyOpen.type = 'button';
    copyOpen.setAttribute('data-act', 'copy-open');
    copyOpen.addEventListener('click', function () {
      copyText(state.lyrics || '');
      var url = localStorage.getItem(APP) || writer.DEFAULT_MUSIC_APP;
      window.open(url, '_blank', 'noopener');
      state.promptLit = false;
      function light() {
        state.promptLit = true;
        paint();
        window.removeEventListener('focus', light);
      }
      window.addEventListener('focus', light);
    });
    var change = el('button', 'v3-link', 'Change my music app');
    change.type = 'button';
    change.setAttribute('data-act', 'change-app');
    change.addEventListener('click', function () {
      setState(flow.act(state, { type: 'app-editor' }));
    });
    parent.appendChild(copyStyle);
    parent.appendChild(copyOpen);
    parent.appendChild(change);
    if (state.appEditor) {
      var editor = el('label', 'v3-app');
      var input = document.createElement('input');
      input.type = 'url';
      input.placeholder = 'Paste a link';
      input.setAttribute('data-act', 'app-url');
      var save = el('button', 'v3-mini', 'Save on this device');
      save.type = 'button';
      save.addEventListener('click', function () {
        var value = String(input.value || '').trim();
        if (/^https:\/\//i.test(value)) localStorage.setItem(APP, value);
        state = flow.act(state, { type: 'app-editor' });
        state.notice = 'Saved on this device.';
        paint();
      });
      editor.appendChild(input);
      parent.appendChild(editor);
      parent.appendChild(save);
    }
  }

  function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).catch(function () {});
    }
  }

  paint();
})();
