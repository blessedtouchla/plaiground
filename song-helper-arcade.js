/* Song Helper arcade page. Mounts only when SONG_HELPER_ARCADE is on. */
(function () {
  var arcade = window.PlaigroundSongArcade;
  var features = window.PlaigroundFeatures;
  if (!arcade || !features || !features.enabled || !features.enabled('SONG_HELPER_ARCADE')) return;

  var shell = document.getElementById('sh-shell');
  if (!shell) return;
  document.body.classList.add('arcade-on');
  shell.classList.add('is-arcade');

  var state = arcade.blank();
  var root = document.createElement('div');
  root.id = 'sh-arcade';
  shell.insertBefore(root, shell.firstChild);

  var audioCtx = null;
  var packs = { straight: null, weird: null, write: null, style: null };

  function face() {
    return '<svg class="arcade-face" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#7D3CFF"/><circle cx="24" cy="28" r="3.2" fill="#fff"/><circle cx="40" cy="28" r="3.2" fill="#fff"/><path d="M22 40c3 5 17 5 20 0" fill="none" stroke="#F5C542" stroke-width="2.4" stroke-linecap="round"/></svg>';
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function blip() {
    if (!state.sound || reducedMotion()) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.frequency.value = 680;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.07);
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (err) {}
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function padPoints(n) {
    var value = String(Math.max(0, n || 0));
    while (value.length < 4) value = '0' + value;
    return value;
  }

  function show(node) {
    root.textContent = '';
    root.appendChild(node);
  }

  function topBar() {
    var bar = el('div', 'arcade-top');
    var sound = el('button', 'arcade-sound');
    sound.type = 'button';
    sound.textContent = state.sound ? 'Sound on' : 'Sound off';
    sound.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
    sound.addEventListener('click', function () {
      state.sound = !state.sound;
      sound.textContent = state.sound ? 'Sound on' : 'Sound off';
      sound.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
      blip();
    });
    bar.appendChild(sound);
    var credits = el('span', 'arcade-credits');
    credits.hidden = true;
    credits.setAttribute('data-arcade-credits', '1');
    bar.appendChild(credits);
    return bar;
  }

  function loadCredits() {
    fetch('/api/song-helper?action=dev-status').then(function (res) {
      return res.json();
    }).then(function (data) {
      var chip = root.querySelector('[data-arcade-credits]');
      if (!chip || !data || data.signedIn !== true || typeof data.credits !== 'number') return;
      chip.hidden = false;
      chip.textContent = 'Credits ' + data.credits;
    }).catch(function () {});
  }

  function hall() {
    state.game = '';
    state.step = 0;
    state.result = null;
    var page = el('div', 'arcade-hall');
    page.appendChild(topBar());
    page.appendChild(el('p', 'arcade-kicker', arcade.HALL_KICKER));
    page.appendChild(el('h2', 'arcade-hero', arcade.HALL_TITLE));
    var plai = el('div', 'arcade-plai');
    plai.setAttribute('data-arcade-host', 'plai');
    plai.innerHTML = face();
    plai.appendChild(el('p', '', arcade.PLAI_HALL));
    page.appendChild(plai);
    var row = el('div', 'arcade-row');
    arcade.CABINETS.forEach(function (cab) {
      var button = el('button', 'arcade-cab tone-' + cab.tone + (cab.tilt ? ' is-tilt' : ''));
      button.type = 'button';
      button.setAttribute('data-arcade-cabinet', cab.id);
      if (cab.fresh) button.appendChild(el('span', 'arcade-new', 'New'));
      button.appendChild(el('p', 'arcade-cab-head', cab.title));
      var screen = el('div', 'arcade-screen');
      if (cab.id === 'write') {
        screen.innerHTML = '<svg class="arcade-heart" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 54s-18-11-24-22C4 22 10 12 20 12c6 0 10 4 12 8 2-4 6-8 12-8 10 0 16 10 12 20-6 11-24 22-24 22z" fill="#b388ff"/></svg>';
      } else if (cab.id === 'parody') {
        screen.appendChild(el('div', 'arcade-emoji', '😜'));
      } else {
        var knobs = el('div', 'arcade-knobs');
        for (var i = 0; i < 4; i += 1) knobs.appendChild(el('span', 'arcade-knob'));
        screen.appendChild(knobs);
      }
      screen.appendChild(el('p', '', cab.blurb));
      button.appendChild(screen);
      var start = el('div', 'arcade-start-row');
      start.appendChild(el('span', 'arcade-stick'));
      start.appendChild(el('span', 'arcade-press', 'Press start'));
      button.appendChild(start);
      button.appendChild(el('p', 'arcade-time', cab.time));
      button.addEventListener('click', function () {
        blip();
        openGame(cab.id);
      });
      row.appendChild(button);
    });
    page.appendChild(row);
    var floor = el('div', 'arcade-floor');
    var line = el('p', 'arcade-credit-line');
    line.innerHTML = 'Answering questions is <strong>free</strong>. Writing with AI uses <strong>1 credit</strong>.';
    floor.appendChild(line);
    floor.appendChild(el('div', 'arcade-grid'));
    page.appendChild(floor);
    show(page);
    loadCredits();
  }

  function openGame(id) {
    state = arcade.blank();
    state.game = id;
    state.step = 0;
    packs = { straight: null, weird: null, write: null, style: null };
    if (id === 'write' && window.SongHelperV2 && window.SongHelperV2.setMode) {
      /* Keep the existing writer parked. Scenes collect the same answers. */
    }
    paintScene();
  }

  function paintScene() {
    var scene = arcade.sceneAt(state);
    if (!scene) {
      finish();
      return;
    }
    var info = arcade.trail(state);
    var page = el('div', 'arcade-scene');
    page.appendChild(topBar());
    var mode = state.game === 'parody' ? 'Parody mode' : (state.game === 'style' ? 'Style prompt' : 'Write my song');
    page.appendChild(el('span', 'arcade-mode', mode));
    var level = el('div', 'arcade-level');
    level.appendChild(el('span', '', info.label));
    var bar = el('div', 'arcade-bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '1');
    bar.setAttribute('aria-valuemax', String(info.total));
    bar.setAttribute('aria-valuenow', String(info.index + 1));
    bar.setAttribute('aria-valuetext', info.label);
    var fill = el('span');
    var pct = Math.round(((info.index + (arcade.ready(state) ? 1 : 0.45)) / info.total) * 100);
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    level.appendChild(bar);
    level.appendChild(el('span', 'arcade-pts', padPoints(state.points) + ' pts'));
    page.appendChild(level);

    var askRow = el('div', 'arcade-ask-row');
    var host = el('div');
    host.setAttribute('data-arcade-host', 'plai');
    host.innerHTML = face();
    askRow.appendChild(host);
    var copy = el('div');
    copy.appendChild(el('p', 'arcade-kicker', scene.kicker));
    var ask = el('h2', 'arcade-ask');
    ask.setAttribute('data-arcade-ask', scene.id);
    paintAsk(ask, scene.ask);
    copy.appendChild(ask);
    copy.appendChild(el('p', 'arcade-help', scene.help));
    askRow.appendChild(copy);
    page.appendChild(askRow);

    if (scene.tiles) {
      var tiles = el('div', 'arcade-tiles');
      tiles.setAttribute('role', 'group');
      scene.tiles.forEach(function (tile) {
        var on = selected(scene, tile.id);
        var button = el('button', 'arcade-tile' + (on ? ' on' : ''), tile.label);
        button.type = 'button';
        button.setAttribute('data-tile', tile.id);
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
        button.addEventListener('click', function () {
          state = arcade.pick(state, tile.id);
          blip();
          paintScene();
        });
        tiles.appendChild(button);
      });
      page.appendChild(tiles);
    }

    if (scene.take) {
      page.appendChild(el('span', 'arcade-take-label', scene.takeLabel || 'Your take'));
      var area = el('textarea', 'arcade-take');
      area.placeholder = scene.takePlaceholder || '';
      area.value = state.game === 'parody' ? state.parody.take : state.write.story;
      area.addEventListener('input', function () {
        if (state.game === 'parody') state.parody.take = area.value;
        else state.write.story = area.value;
        syncNext();
      });
      page.appendChild(area);
    }

    if (scene.line) {
      page.appendChild(el('span', 'arcade-take-label', 'Your line'));
      var lineBox = el('textarea', 'arcade-take');
      lineBox.placeholder = 'Write the line in the box.';
      lineBox.value = state.write.line;
      lineBox.addEventListener('input', function () {
        state.write.line = lineBox.value;
        syncNext();
      });
      page.appendChild(lineBox);
    }

    (scene.fields || []).forEach(function (field) {
      var label = el('label', 'arcade-field');
      label.appendChild(el('span', '', field.label));
      var input = el('input');
      input.maxLength = 80;
      input.value = fieldValue(field.id);
      input.addEventListener('input', function () {
        setField(field.id, input.value);
        syncNext();
      });
      label.appendChild(input);
      page.appendChild(label);
    });

    if (scene.version) {
      var versions = el('div', 'arcade-versions');
      versions.setAttribute('role', 'group');
      versions.setAttribute('aria-label', 'Parody version');
      [
        { id: 'straight', label: 'Straight' },
        { id: 'weird', label: 'Weird Al style mix' },
      ].forEach(function (opt) {
        var button = el('button', 'arcade-version' + (state.parody.version === opt.id ? ' on' : ''), opt.label);
        button.type = 'button';
        button.setAttribute('data-version', opt.id);
        button.setAttribute('aria-pressed', state.parody.version === opt.id ? 'true' : 'false');
        button.addEventListener('click', function () {
          state.parody.version = opt.id;
          blip();
          paintScene();
        });
        versions.appendChild(button);
      });
      versions.appendChild(el('span', '', 'Big jokes, silly sound gags'));
      page.appendChild(versions);
      page.appendChild(el('p', 'arcade-note', arcade.PARODY_NOTE));
    }

    if (scene.confirm && state.game === 'parody') {
      page.appendChild(el('p', 'arcade-note', arcade.PARODY_NOTE));
    }

    var nav = el('div', 'arcade-nav');
    var back = el('button', 'arcade-back', 'Back');
    back.type = 'button';
    back.addEventListener('click', function () {
      if (state.step === 0) hall();
      else {
        state.step -= 1;
        paintScene();
      }
    });
    nav.appendChild(back);
    nav.appendChild(el('p', 'arcade-free', scene.free ? 'This step is free' : 'This step uses 1 credit'));
    var next = el('button', 'arcade-next', scene.confirm ? creditLabel() : 'Next level');
    next.type = 'button';
    next.disabled = !arcade.ready(state);
    next.addEventListener('click', function () {
      blip();
      if (scene.confirm || state.step >= arcade.scenes(state.game).length - 1) finish();
      else {
        state.step += 1;
        state.points += 25;
        paintScene();
      }
    });
    nav.appendChild(next);
    page.appendChild(nav);
    show(page);
    loadCredits();

    function syncNext() {
      next.disabled = !arcade.ready(state);
      fill.style.width = Math.round(((info.index + (arcade.ready(state) ? 1 : 0.45)) / info.total) * 100) + '%';
    }
  }

  function paintAsk(node, text) {
    var parts = String(text || '').split(' ');
    if (parts.length < 4) {
      node.textContent = text;
      return;
    }
    var cut = Math.ceil(parts.length / 2);
    node.appendChild(document.createTextNode(parts.slice(0, cut).join(' ') + ' '));
    node.appendChild(el('em', '', parts.slice(cut).join(' ')));
  }

  function selected(scene, id) {
    if (state.game === 'parody' && scene.multi) return state.parody.tiles.indexOf(id) !== -1;
    if (state.game === 'style') return state.style[scene.id] === id || (scene.id === 'genre' && state.style.genre === id);
    if (scene.id === 'part') return state.write.part === id;
    if (scene.id === 'who') return state.write.who === id;
    return state.write.mood === id;
  }

  function fieldValue(id) {
    if (state.game === 'parody') return state.parody[id] || '';
    return state.write[id] || '';
  }

  function setField(id, value) {
    if (state.game === 'parody') state.parody[id] = value;
    else state.write[id] = value;
  }

  function creditLabel() {
    if (state.game === 'parody' && state.parody.version === 'weird') return 'Write the Weird Al style mix (1 credit)';
    if (state.game === 'parody') return 'Write the parody (1 credit)';
    return 'Write my song (1 credit)';
  }

  function finish() {
    if (state.game === 'style') {
      packs.style = arcade.stylePack(state.style);
      reveal(packs.style);
      return;
    }
    if (state.game === 'write') {
      syncWriteForm();
      var body = {
        action: 'arcade-write',
        mood: state.write.mood,
        who: state.write.who,
        story: state.write.story,
        part: state.write.part,
        line: state.write.line,
        title: state.write.title,
      };
      postJSON(body).then(function (data) {
        packs.write = data && data.ok && data.sections ? data : arcade.writePack(state.write);
        if (!data || data.ok === false) {
          packs.write = arcade.writePack(state.write);
          packs.write.notice = (data && data.error) || arcade.SIGN_IN_NOTE;
        }
        reveal(packs.write);
      }).catch(function () {
        packs.write = arcade.writePack(state.write);
        packs.write.notice = arcade.SIGN_IN_NOTE;
        reveal(packs.write);
      });
      return;
    }
    var input = arcade.parodyInput(state);
    input.action = 'parody-write';
    input.parodyVersion = input.version;
    input.mode = 'parody';
    postJSON(input).then(function (data) {
      var local = localParody(input.version);
      var pack = data && data.ok && data.draft ? fromParodyResponse(data) : local;
      if (!data || data.ok === false) {
        pack = local;
        pack.notice = (data && data.error) || arcade.SIGN_IN_NOTE;
      }
      rememberParody(pack);
      reveal(pack);
    }).catch(function () {
      var pack = localParody(input.version);
      pack.notice = arcade.SIGN_IN_NOTE;
      rememberParody(pack);
      reveal(pack);
    });
  }

  function localParody(version) {
    var input = arcade.parodyInput(state);
    input.version = version;
    var tool = window.PlaigroundParodyV2;
    if (!tool) {
      return {
        ok: true,
        title: input.title,
        version: version,
        versionLabel: version === 'weird' ? 'Weird Al style mix' : 'Straight',
        stylePrompt: '',
        sections: [],
        notice: arcade.SIGN_IN_NOTE,
        game: 'parody',
      };
    }
    var packed = tool.package(input);
    return fromParodyResponse(packed);
  }

  function fromParodyResponse(data) {
    var draft = data.draft || {};
    return {
      ok: true,
      game: 'parody',
      title: draft.title || data.title || state.parody.title,
      version: data.version || state.parody.version,
      versionLabel: data.versionLabel || draft.versionLabel || '',
      stylePrompt: data.stylePrompt || draft.stylePrompt || '',
      sections: draft.sections || [],
      notice: data.notice || '',
      credit: data.credit || 0,
    };
  }

  function rememberParody(pack) {
    if (pack.version === 'weird') packs.weird = pack;
    else packs.straight = pack;
  }

  function syncWriteForm() {
    var page = window.SongHelperPage;
    if (page && page.setMood && state.write.mood) {
      var moodMap = {
        love: 'in love',
        heartbreak: 'heartbroken',
        hype: 'hyped',
        petty: 'petty',
        grateful: 'grateful',
        nostalgic: 'nostalgic',
        angry: 'angry',
        mindset: 'mindset',
      };
      page.setMood(moodMap[state.write.mood] || state.write.mood);
    }
    var title = document.getElementById('sh-working-title');
    if (title && state.write.title) title.value = state.write.title;
    var idea = document.getElementById('sh-own-idea');
    if (idea && state.write.story) idea.value = state.write.story;
  }

  function postJSON(body) {
    return fetch('/api/song-helper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (data) {
        data = data || {};
        data.ok = res.ok && data.ok !== false;
        if (!res.ok && !data.error) data.error = arcade.SIGN_IN_NOTE;
        return data;
      });
    });
  }

  function reveal(pack) {
    state.result = pack;
    var page = el('div', 'arcade-reveal');
    page.appendChild(topBar());
    page.appendChild(el('p', 'arcade-score', 'New high score'));
    page.appendChild(el('h2', 'arcade-song', '"' + (pack.title || 'Untitled') + '"'));
    var clearBits = ['Level ' + arcade.trail(state).label.replace('Level ', '') + ' clear'];
    if (pack.game === 'parody') clearBits.push('100% original words', pack.versionLabel || 'Straight');
    else if (pack.badge) clearBits.push(pack.badge);
    page.appendChild(el('p', 'arcade-clear', clearBits.join(' · ')));
    if (pack.notice) page.appendChild(el('p', 'arcade-banner', pack.notice));

    var panels = el('div', 'arcade-panels');
    if (pack.game !== 'style') {
      var lyric = el('section', 'arcade-panel');
      var head = el('div', 'arcade-panel-head');
      head.appendChild(el('span', '', 'Your lyrics'));
      if (pack.game === 'parody') head.appendChild(versionSwitch(pack));
      lyric.appendChild(head);
      var box = el('textarea', 'arcade-lyric');
      box.readOnly = true;
      box.setAttribute('aria-label', 'Lyrics');
      box.value = arcade.plain(pack);
      lyric.appendChild(box);
      lyric.appendChild(el('p', 'arcade-note', pack.game === 'parody' ? arcade.PARODY_NOTE : 'Your line stays in the song.'));
      panels.appendChild(lyric);
    }

    var style = el('section', 'arcade-panel tone-cyan');
    var styleHead = el('div', 'arcade-panel-head');
    styleHead.appendChild(el('span', '', 'Style prompt'));
    styleHead.appendChild(el('span', '', 'No artist names'));
    style.appendChild(styleHead);
    var styleBox = el('textarea', 'arcade-lyric');
    styleBox.readOnly = true;
    styleBox.setAttribute('aria-label', 'Style prompt');
    styleBox.value = pack.stylePrompt || '';
    style.appendChild(styleBox);
    var copyStyle = el('button', 'arcade-copy-big', arcade.COPY_STYLE);
    copyStyle.type = 'button';
    copyStyle.addEventListener('click', function () { copyText(styleBox.value, copyStyle); });
    style.appendChild(copyStyle);
    var row = el('div', 'arcade-actions');
    if (pack.game !== 'style') {
      var copyLyrics = el('button', 'arcade-ghost', arcade.COPY_LYRICS);
      copyLyrics.type = 'button';
      copyLyrics.addEventListener('click', function () { copyText(arcade.plain(pack), copyLyrics); });
      row.appendChild(copyLyrics);
    }
    var share = el('button', 'arcade-ghost', pack.game === 'parody' ? 'Share my parody' : 'Share my song');
    share.type = 'button';
    share.addEventListener('click', function () {
      copyText((pack.title || '') + '\n' + arcade.plain(pack), share);
    });
    row.appendChild(share);
    style.appendChild(row);
    var open = el('button', 'arcade-open', arcade.OPEN_LABEL);
    open.type = 'button';
    open.addEventListener('click', function () {
      copyText(arcade.copyBundle(pack), open);
      window.open(arcade.OPEN_URL, '_blank', 'noopener');
    });
    style.appendChild(open);
    if (pack.game === 'parody' && window.PlaigroundParodyV2 && window.PlaigroundParodyV2.TIPS) {
      style.appendChild(el('p', 'arcade-tips', 'Parody tips: ' + window.PlaigroundParodyV2.TIPS.join(' ')));
    }
    panels.appendChild(style);
    page.appendChild(panels);

    var host = el('div', 'arcade-host-line');
    host.setAttribute('data-arcade-host', 'plai');
    host.innerHTML = face();
    var againLine = pack.game === 'parody'
      ? 'That chorus is so silly. Want another round?'
      : 'Want another round?';
    host.appendChild(el('p', '', 'Plai: ' + againLine));
    var again = el('button', 'arcade-next', 'Make another · 1 credit');
    if (pack.game === 'style') again.textContent = 'Make another';
    again.type = 'button';
    again.addEventListener('click', function () {
      if (pack.game === 'style') {
        state.step = 0;
        paintScene();
        return;
      }
      state.step = Math.max(0, arcade.scenes(state.game).length - 1);
      paintScene();
    });
    host.appendChild(again);
    page.appendChild(host);

    var back = el('button', 'arcade-back', 'Back to the games');
    back.type = 'button';
    back.addEventListener('click', hall);
    page.appendChild(back);
    show(page);
    loadCredits();
  }

  function versionSwitch(pack) {
    var wrap = el('div', 'arcade-versions');
    ['straight', 'weird'].forEach(function (id) {
      var label = id === 'weird' ? 'Weird Al style mix' : 'Straight';
      var button = el('button', 'arcade-version' + (pack.version === id ? ' on' : ''), label);
      button.type = 'button';
      button.setAttribute('data-version', id);
      button.addEventListener('click', function () {
        var cached = id === 'weird' ? packs.weird : packs.straight;
        if (cached) {
          reveal(cached);
          return;
        }
        var built = localParody(id);
        built.notice = arcade.SIGN_IN_NOTE;
        rememberParody(built);
        reveal(built);
      });
      wrap.appendChild(button);
    });
    return wrap;
  }

  function copyText(text, button) {
    var done = function () {
      var old = button.textContent;
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = old; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text || '').then(done).catch(done);
      return;
    }
    done();
  }

  hall();
})();
