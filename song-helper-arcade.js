/* Song Helper arcade. Mounts only when SONG_HELPER_ARCADE is on. */
(function () {
  var features = window.PlaigroundFeatures;
  var arcade = window.PlaigroundSongArcade;
  if (!features || !features.enabled || !features.enabled('SONG_HELPER_ARCADE')) return;
  if (!arcade || !document.getElementById('sh-shell')) return;

  var shell = document.getElementById('sh-shell');
  var host = document.createElement('section');
  host.id = 'sh-arcade';
  host.className = 'sh-craft';
  var start = document.getElementById('sh-start');
  if (start && start.parentNode) start.parentNode.insertBefore(host, start);
  else shell.appendChild(host);

  var cabinet = '';
  var answers = {};
  var history = [];
  var tipAt = 0;
  var reveal = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function plan() {
    if (cabinet === 'remix') return arcade.stepRemix(answers);
    return arcade.stepWrite(answers);
  }

  function showHall() {
    cabinet = '';
    answers = {};
    history = [];
    reveal = null;
    tipAt = 0;
    shell.classList.add('is-arcade');
    if (start) start.hidden = true;
    host.hidden = false;
    paintHall();
  }

  function plaiHost(line) {
    var row = el('div', 'sh-x-host');
    row.setAttribute('data-arcade-host', 'plai');
    var face = el('span', 'sh-x-avatar');
    face.setAttribute('aria-hidden', 'true');
    face.innerHTML = '<svg viewBox="0 0 64 64" focusable="false"><circle cx="32" cy="32" r="30" fill="#7D3CFF"/><circle cx="24" cy="28" r="3.2" fill="#fff"/><circle cx="40" cy="28" r="3.2" fill="#fff"/><path d="M22 40c3 5 17 5 20 0" fill="none" stroke="#F5C542" stroke-width="2.4" stroke-linecap="round"/></svg>';
    var name = document.createElement('p');
    name.appendChild(document.createTextNode('Plai'));
    name.appendChild(el('span', '', line || 'One question at a time.'));
    row.appendChild(face);
    row.appendChild(name);
    return row;
  }

  function progressBar(done) {
    var mark = arcade.trail(cabinet, answers);
    var index = done ? mark.total : mark.index;
    var wrap = el('div', 'sh-arcade-progress');
    wrap.setAttribute('role', 'progressbar');
    wrap.setAttribute('aria-valuemin', '1');
    wrap.setAttribute('aria-valuemax', String(mark.total));
    wrap.setAttribute('aria-valuenow', String(index));
    wrap.setAttribute('aria-valuetext', index + ' of ' + mark.total);
    wrap.appendChild(el('p', 'sh-arcade-progress-label', index + ' of ' + mark.total));
    var track = el('div', 'sh-arcade-progress-track');
    var fill = el('div', 'sh-arcade-progress-fill');
    fill.style.width = Math.max(8, Math.round((index / mark.total) * 100)) + '%';
    track.appendChild(fill);
    wrap.appendChild(track);
    return wrap;
  }

  function paintHall() {
    host.textContent = '';
    host.appendChild(plaiHost('Pick a cabinet. One way in at a time.'));
    host.appendChild(el('p', 'sh-arcade-kicker', 'Arcade'));
    host.appendChild(el('h2', 'sh-arcade-title', 'Pick a cabinet'));
    host.appendChild(el('p', 'sh-arcade-help', 'Three ways in. Fresh writing, a parody, or a remix of your own song.'));
    var list = el('div', 'sh-arcade-list');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', 'Cabinets');
    arcade.CABINETS.forEach(function (item) {
      var button = el('button', 'sh-arcade-cabinet');
      button.type = 'button';
      button.setAttribute('data-arcade-cabinet', item.id);
      button.appendChild(document.createTextNode(item.title));
      button.appendChild(el('small', '', item.blurb));
      button.addEventListener('click', function () { openCabinet(item.id); });
      list.appendChild(button);
    });
    host.appendChild(list);
  }

  function openCabinet(id) {
    if (id === 'parody') {
      handoff();
      if (window.SongHelperV2 && window.SongHelperV2.openParody) window.SongHelperV2.openParody();
      return;
    }
    cabinet = id;
    answers = {};
    history = [];
    reveal = null;
    tipAt = 0;
    paint();
  }

  function handoff() {
    shell.classList.remove('is-arcade');
    host.hidden = true;
    if (start) start.hidden = true;
  }

  function remember() {
    history.push(JSON.stringify(answers));
  }

  function back() {
    if (reveal) {
      reveal = null;
      paint();
      return;
    }
    if (!history.length) {
      showHall();
      return;
    }
    answers = JSON.parse(history.pop());
    paint();
  }

  function fieldValue(id) {
    var node = host.querySelector('[data-arcade-field="' + id + '"]');
    return node ? String(node.value || '') : '';
  }

  function readFields(scene) {
    (scene.fields || []).forEach(function (field) {
      answers[field.id] = fieldValue(field.id);
    });
    if (scene.pick === 'many' && scene.key && !Array.isArray(answers[scene.key])) answers[scene.key] = [];
  }

  function paint() {
    reveal = null;
    shell.classList.add('is-arcade');
    host.hidden = false;
    var step = plan();
    host.textContent = '';
    var scene = step.scene || { ask: '', help: '', tiles: [], fields: [], tips: [] };
    host.appendChild(plaiHost(scene.ask || 'One question at a time.'));
    host.appendChild(progressBar(false));
    host.appendChild(el('h2', 'sh-arcade-title', scene.ask || ''));
    if (scene.help) host.appendChild(el('p', 'sh-arcade-help', scene.help));
    if (scene.tips && scene.tips.length) {
      var list = el('ul', 'sh-arcade-tips');
      var tip = scene.tips[tipAt % scene.tips.length];
      list.appendChild(el('li', '', tip));
      host.appendChild(list);
    }
    (scene.fields || []).forEach(function (field) {
      if (field.id === 'fromMood') return;
      var label = el('label', 'sh-arcade-field');
      label.appendChild(el('span', '', field.label));
      var box = document.createElement('textarea');
      box.setAttribute('data-arcade-field', field.id);
      box.value = answers[field.id] || scene.prefill || '';
      if (field.id === 'lyrics' || field.id === 'after') box.rows = 8;
      label.appendChild(box);
      host.appendChild(label);
    });
    var moodField = (scene.fields || []).filter(function (field) { return field.id === 'fromMood'; })[0];
    if (scene.tiles && scene.tiles.length) {
      var tiles = el('div', 'sh-arcade-tiles');
      tiles.setAttribute('role', 'group');
      tiles.setAttribute('aria-label', scene.ask || 'Choices');
      scene.tiles.forEach(function (tile) {
        var button = el('button', 'sh-arcade-tile');
        button.type = 'button';
        var selected = scene.pick === 'many'
          ? (answers[scene.key] || []).indexOf(tile.id) !== -1
          : answers[scene.key] === tile.id;
        if (selected) button.classList.add('on');
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.appendChild(document.createTextNode(tile.label));
        if (tile.note) button.appendChild(el('small', '', tile.note));
        button.addEventListener('click', function () { choose(scene, tile.id); });
        tiles.appendChild(button);
      });
      host.appendChild(tiles);
    }
    if (moodField) {
      var moodLabel = el('label', 'sh-arcade-field');
      moodLabel.appendChild(el('span', '', moodField.label));
      var input = document.createElement('input');
      input.setAttribute('data-arcade-field', moodField.id);
      input.value = answers.fromMood || '';
      input.placeholder = 'Optional';
      moodLabel.appendChild(input);
      host.appendChild(moodLabel);
    }
    var actions = el('div', 'sh-arcade-actions');
    var error = el('p', 'sh-arcade-error');
    error.hidden = true;
    error.setAttribute('role', 'alert');
    host.appendChild(error);
    if (scene.fields && scene.fields.length || scene.pick === 'many') {
      var next = el('button', 'btn btn-purple btn-md', continueLabel(scene));
      next.type = 'button';
      next.addEventListener('click', function () { continueScene(scene, step, error); });
      actions.appendChild(next);
    }
    if (scene.skip) {
      var skip = el('button', 'btn btn-ghost btn-md', 'Skip');
      skip.type = 'button';
      skip.addEventListener('click', function () { skipScene(scene); });
      actions.appendChild(skip);
    }
    if (step.secondary) actions.appendChild(actionButton(step.secondary));
    if (step.primary && scene.id === 'go') actions.appendChild(actionButton(step.primary));
    if (actions.childNodes.length) host.appendChild(actions);
    var backBtn = el('button', 'sh-arcade-back', history.length || cabinet ? 'Back' : 'All cabinets');
    backBtn.type = 'button';
    backBtn.addEventListener('click', back);
    host.appendChild(backBtn);
  }

  function continueLabel(scene) {
    if (scene.id === 'lyrics') return 'Show my song';
    if (scene.id === 'after') return 'Show the fix';
    return 'Next';
  }

  function choose(scene, id) {
    if (scene.pick === 'many') {
      var list = Array.isArray(answers[scene.key]) ? answers[scene.key].slice() : [];
      var at = list.indexOf(id);
      if (at === -1) list.push(id);
      else list.splice(at, 1);
      answers[scene.key] = list;
      paint();
      return;
    }
    if (scene.fields && scene.fields.length) {
      answers[scene.key] = id;
      paint();
      return;
    }
    remember();
    answers[scene.key] = id;
    if (scene.id === 'fromGenre') answers.genreAsked = true;
    paint();
  }

  function skipScene(scene) {
    remember();
    if (scene.id === 'who') answers.whoAsked = true;
    if (scene.id === 'keep') answers.keepAsked = true;
    if (scene.id === 'fromGenre') {
      answers.genreAsked = true;
      answers.fromGenre = '';
    }
    if (scene.id === 'fromMood') answers.moodAsked = true;
    paint();
  }

  function continueScene(scene, step, error) {
    readFields(scene);
    if (scene.id === 'paste' || scene.id === 'lyrics' || scene.id === 'after') {
      var body = String(answers.lyrics || answers.after || '').trim();
      if (body.length < 12 && scene.id !== 'lyrics') {
        error.hidden = false;
        error.textContent = 'Paste the lyrics first.';
        return;
      }
      if (scene.id === 'lyrics' && body.length < 8) {
        error.hidden = false;
        error.textContent = 'Write a little first.';
        return;
      }
    }
    if (scene.id === 'story' && !String(answers.story || '').trim()) {
      error.hidden = false;
      error.textContent = 'Tell a little of the story first.';
      return;
    }
    if (scene.id === 'voice' && !String(answers.voice || '').trim()) {
      error.hidden = false;
      error.textContent = 'Say what should stay you.';
      return;
    }
    if (scene.id === 'who') answers.whoAsked = true;
    if (scene.id === 'keep') answers.keepAsked = true;
    if (scene.id === 'fromMood') answers.moodAsked = true;
    if (scene.pick === 'many' && (!answers[scene.key] || !answers[scene.key].length)) {
      error.hidden = false;
      error.textContent = 'Pick at least one.';
      return;
    }
    if (scene.id === 'lyrics' || scene.id === 'after') {
      var shown = arcade.reveal('show', answers);
      if (!shown.ok) {
        error.hidden = false;
        error.textContent = shown.error || 'That did not come through.';
        return;
      }
      paintReveal(shown, { paid: true, free: true });
      return;
    }
    remember();
    paint();
  }

  function actionButton(spec) {
    var button = el('button', spec.credit ? 'btn btn-purple btn-md' : 'btn btn-ghost btn-md', spec.label);
    button.type = 'button';
    button.addEventListener('click', function () { runAction(spec, button); });
    return button;
  }

  function runAction(spec, button) {
    if (spec.id === 'tip') {
      tipAt += 1;
      paint();
      return;
    }
    if (spec.id === 'show') {
      var shown = arcade.reveal('show', answers);
      paintReveal(shown, { paid: true, free: true });
      return;
    }
    var action = spec.id === 'line' ? 'arcade-line'
      : (spec.id === 'fix' ? 'arcade-fix'
        : (spec.id === 'remix' ? 'arcade-remix' : 'arcade-write'));
    if (button) {
      button.disabled = true;
      button.textContent = 'Working...';
    }
    post(action, answers).then(function (data) {
      if (!data || !data.ok) {
        var kind = action === 'arcade-line' ? 'line' : (action === 'arcade-fix' ? 'fix' : (action === 'arcade-remix' ? 'remix' : 'write'));
        var local = arcade.reveal(kind, answers);
        var note = data && data.status === 402
          ? ((data.error || 'That uses 1 credit. You are out of credits.') + ' This view only keeps and rearranges your words.')
          : 'Sign in to run the AI pass. That uses 1 credit. This view only keeps and rearranges your words.';
        if (data && data.error && data.status !== 401 && data.status !== 402) note = data.error;
        if (spec.id === 'line') {
          paint();
          var err = el('p', 'sh-arcade-note', note);
          host.insertBefore(err, host.querySelector('.sh-arcade-actions') || host.lastChild);
          return;
        }
        local.note = note;
        local.source = 'kept';
        paintReveal(local, { paid: false });
        return;
      }
      if (spec.id === 'line') {
        offerLine(data.after || (data.options && data.options[0]) || '');
        return;
      }
      data.source = data.source || 'ai';
      paintReveal(data, { paid: true });
    }).catch(function () {
      var kind = action === 'arcade-remix' ? 'remix' : (action === 'arcade-fix' ? 'fix' : 'write');
      var local = arcade.reveal(kind, answers);
      local.note = 'Sign in to run the AI pass. That uses 1 credit. This view only keeps and rearranges your words.';
      local.source = 'kept';
      paintReveal(local, { paid: false });
    });
  }

  function offerLine(line) {
    paint();
    if (!line) return;
    var card = el('div', 'sh-arcade-style');
    card.appendChild(el('h3', 'sh-subhead', 'A line you can keep or edit'));
    card.appendChild(el('p', '', line));
    var row = el('div', 'sh-arcade-actions');
    var keep = el('button', 'btn btn-purple btn-md', 'Keep');
    keep.type = 'button';
    keep.addEventListener('click', function () {
      var box = host.querySelector('[data-arcade-field="lyrics"]');
      var prior = box ? String(box.value || '').trim() : String(answers.lyrics || '').trim();
      answers.lyrics = prior ? (prior + '\n' + line) : line;
      paint();
    });
    var edit = el('button', 'btn btn-ghost btn-md', 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', function () {
      var box = host.querySelector('[data-arcade-field="lyrics"]');
      if (!box) {
        answers.lyrics = line;
        paint();
        return;
      }
      box.value = String(box.value || '').trim() ? (String(box.value).replace(/\s+$/, '') + '\n' + line) : line;
      box.focus();
    });
    row.appendChild(keep);
    row.appendChild(edit);
    card.appendChild(row);
    var actions = host.querySelector('.sh-arcade-actions');
    if (actions) host.insertBefore(card, actions);
    else host.appendChild(card);
  }

  function post(action, body) {
    return fetch('/api/song-helper?action=' + action, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action }, body)),
    }).then(function (res) {
      return res.json().then(function (data) {
        data.status = res.status;
        return data;
      }).catch(function () {
        return { ok: false, status: res.status, error: 'That did not come back.' };
      });
    });
  }

  function paintReveal(data, opts) {
    reveal = data;
    host.textContent = '';
    shell.classList.add('is-arcade');
    host.hidden = false;
    host.appendChild(plaiHost('Here is the song, and a style prompt you can copy.'));
    host.appendChild(progressBar(true));
    if (data.classLabel) host.appendChild(el('p', 'sh-arcade-class', data.classLabel));
    host.appendChild(el('h2', 'sh-arcade-title', data.heading || 'Your song'));
    if (data.note) host.appendChild(el('p', 'sh-arcade-note', data.note));
    var same = String(data.before || '').trim() === String(data.after || '').trim();
    if (!same && data.before) {
      var cols = el('div', 'sh-arcade-cols');
      cols.appendChild(column('Before', String(data.before).split('\n'), null));
      cols.appendChild(column('After', data.lines && data.lines.length ? data.lines : String(data.after || '').split('\n').map(function (text) {
        return { text: text, changed: false };
      }), 'lines'));
      host.appendChild(cols);
    } else {
      host.appendChild(column('Your lyrics', String(data.after || '').split('\n').map(function (text) {
        return { text: text, changed: false };
      }), 'lines'));
    }
    var style = el('div', 'sh-arcade-style');
    style.appendChild(el('h3', 'sh-subhead', 'Your style prompt'));
    style.appendChild(el('p', '', data.style || ''));
    host.appendChild(style);
    var actions = el('div', 'sh-arcade-actions');
    var copy = el('button', 'btn btn-purple btn-md', 'Copy and open');
    copy.type = 'button';
    copy.addEventListener('click', function () { copyAndOpen(data); });
    actions.appendChild(copy);
    host.appendChild(actions);
    var backBtn = el('button', 'sh-arcade-back', 'Back');
    backBtn.type = 'button';
    backBtn.addEventListener('click', back);
    host.appendChild(backBtn);
    if (opts && opts.paid) saveDraft(data);
  }

  function column(title, rows, mode) {
    var col = el('div', 'sh-arcade-col');
    col.appendChild(el('h3', '', title));
    (rows || []).forEach(function (row) {
      var text = mode === 'lines' ? row.text : row;
      var changed = mode === 'lines' ? row.changed : false;
      var line = el('p', 'sh-arcade-line' + (changed ? ' is-changed' : ''), text || ' ');
      col.appendChild(line);
    });
    return col;
  }

  function saveDraft(data) {
    var record = arcade.draftRecord(answers, data);
    record.source = data.source || (data.credit ? 'ai' : 'kept');
    try {
      var prev = JSON.parse(localStorage.getItem('plaiground.songHelper.story') || '{}') || {};
      prev.arcadeDraft = record;
      prev.arcadeClass = { id: answers.classId || (cabinet === 'remix' ? 'full' : ''), label: record.classLabel, madeHow: record.madeHow };
      localStorage.setItem('plaiground.songHelper.story', JSON.stringify(prev));
    } catch (err) {}
  }

  function copyAndOpen(data) {
    var blob = String(data.after || '').trim() + '\n\n' + String(data.style || '').trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(blob).catch(function () {});
    }
    saveDraft(data);
    handoff();
    if (window.SongHelperV2 && window.SongHelperV2.openLyrics) window.SongHelperV2.openLyrics(data.after || '');
  }

  showHall();
})();
